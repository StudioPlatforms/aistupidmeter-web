/**
 * The Stripe side of the admin dashboard: every subscription, and what was collected in the
 * last 30 days. Read-only.
 *
 * Every subscription, ended ones included: a legacy subscriber's 12-month mark runs from their
 * first $4.99 subscription, which may be a duplicate that has since been cancelled, and an
 * account that still has paid access after Stripe ended its subscription is only visible by
 * comparing the two.
 *
 * Cached for five minutes (about four list calls a load otherwise); Refresh on the page
 * bypasses it.
 */
import Stripe from 'stripe';
import { planForPriceId } from '@/lib/stripe-plans';
import { isPlan, type Plan } from '@/lib/entitlements';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-09-30.clover' });

export interface StripeSubscriptionRecord {
  id: string;
  customerId: string;
  customerEmail: string | null;
  metaUserId: number | null;
  status: Stripe.Subscription.Status;
  plan: Plan | null;
  amount: number;
  interval: string;
  monthly: number;
  startedAt: string;
  periodEnd: string | null;
  trialEnd: string | null;
  cancelAt: string | null;
  endedAt: string | null;
  discounted: boolean;
  latestInvoiceId: string | null;
  invoice?: { attempts: number; nextAttemptAt: string | null; amountDue: number };
}

export interface StripeSnapshot {
  fetchedAt: string;
  subscriptions: StripeSubscriptionRecord[];
  collected30: number;
  invoicesPaid30: number;
}

const TTL_MS = 5 * 60_000;
let cached: { at: number; data: StripeSnapshot } | null = null;
let inflight: Promise<StripeSnapshot> | null = null;

const iso = (unix: unknown): string | null =>
  typeof unix === 'number' && unix > 0 ? new Date(unix * 1000).toISOString() : null;

/** Cents per month for one billing interval's price. */
function perMonth(amount: number, interval: string, count: number): number {
  const n = Math.max(1, count || 1);
  switch (interval) {
    case 'year': return amount / (12 * n);
    case 'week': return (amount * 52) / (12 * n);
    case 'day': return (amount * 365) / (12 * n);
    default: return amount / n;
  }
}

function record(s: Stripe.Subscription): StripeSubscriptionRecord {
  const raw = s as any;
  const item = s.items?.data?.[0];
  const price = item?.price;
  const quantity = item?.quantity ?? 1;
  const amount = (price?.unit_amount ?? 0) * quantity;
  const interval = price?.recurring?.interval ?? 'month';
  const customer = typeof s.customer === 'string' ? null : (s.customer as Stripe.Customer | Stripe.DeletedCustomer);
  const metaPlan = s.metadata?.plan;
  const metaUser = Number(s.metadata?.userId);
  return {
    id: s.id,
    customerId: typeof s.customer === 'string' ? s.customer : s.customer.id,
    customerEmail: customer && !('deleted' in customer && customer.deleted) ? ((customer as Stripe.Customer).email ?? null) : null,
    metaUserId: Number.isInteger(metaUser) && metaUser > 0 ? metaUser : null,
    status: s.status,
    plan: planForPriceId(price?.id) ?? (isPlan(metaPlan) ? metaPlan : null),
    amount,
    interval,
    monthly: Math.round(perMonth(amount, interval, price?.recurring?.interval_count ?? 1)),
    startedAt: iso(raw.start_date) ?? iso(s.created)!,
    periodEnd: iso(item?.current_period_end ?? raw.current_period_end),
    trialEnd: iso(raw.trial_end),
    // The customer portal cancels by setting cancel_at; older cancellations set the flag.
    cancelAt: iso(raw.cancel_at) ?? (raw.cancel_at_period_end ? iso(item?.current_period_end) : null),
    endedAt: iso(raw.ended_at),
    discounted: Array.isArray(raw.discounts) ? raw.discounts.length > 0 : !!raw.discount,
    latestInvoiceId: typeof s.latest_invoice === 'string' ? s.latest_invoice : s.latest_invoice?.id ?? null,
  };
}

async function load(): Promise<StripeSnapshot> {
  const subscriptions: StripeSubscriptionRecord[] = [];
  for await (const s of stripe.subscriptions.list({ status: 'all', limit: 100, expand: ['data.customer'] })) {
    subscriptions.push(record(s));
  }

  // A charge that failed: how many times Stripe has tried and when it tries next.
  await Promise.all(subscriptions
    .filter(s => (s.status === 'past_due' || s.status === 'unpaid') && s.latestInvoiceId)
    .map(async s => {
      try {
        const inv = await stripe.invoices.retrieve(s.latestInvoiceId!);
        s.invoice = { attempts: inv.attempt_count ?? 0, nextAttemptAt: iso(inv.next_payment_attempt), amountDue: inv.amount_due ?? 0 };
      } catch { /* the row still shows as past due */ }
    }));

  let collected30 = 0;
  let invoicesPaid30 = 0;
  const since = Math.floor(Date.now() / 1000) - 30 * 86_400;
  for await (const inv of stripe.invoices.list({ status: 'paid', created: { gte: since }, limit: 100 })) {
    if ((inv.amount_paid ?? 0) > 0) { collected30 += inv.amount_paid; invoicesPaid30 += 1; }
  }

  return { fetchedAt: new Date().toISOString(), subscriptions, collected30, invoicesPaid30 };
}

export async function stripeSnapshot(fresh = false): Promise<StripeSnapshot> {
  if (!fresh && cached && Date.now() - cached.at < TTL_MS) return cached.data;
  if (!inflight) {
    inflight = load()
      .then(data => { cached = { at: Date.now(), data }; return data; })
      .finally(() => { inflight = null; });
  }
  return inflight;
}
