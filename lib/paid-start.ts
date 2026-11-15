/**
 * Paid start and the 7-day refund window (owner, 2026-11-13).
 *
 * Every subscription Checkout starts is paid on the spot: subscription mode, cards only, no trial
 * (app/api/stripe/checkout). Checkout stamps it `asl_start: 'paid_v1'` and, on an account's first
 * subscription, `asl_refund: '7d'`. Such a subscription is an ordinary active one to Stripe,
 * the portal and the admin MRR; this module adds what the trial used to give:
 *
 *  - activatePaidStart: grants the plan, records the payment and sends the confirmation, once,
 *    whichever of checkout.session.completed, customer.subscription.created/updated or the
 *    billing watch gets there first (they arrive milliseconds apart; lib/billing-notices once());
 *  - refundState / requestRefund / finishRefund: within 7 days of the subscription's start,
 *    Cancel and refund on /account/billing ends the plan at once and refunds every payment on it.
 *    The request is written on the subscription first (`asl_refund_requested_at`), so a refund
 *    asked for in time is finished even if a step fails: the billing watch completes it.
 *  - isFirstSubscription: the window is for an account's first subscription only (owner,
 *    2026-11-13), so Checkout offers it to nobody who has subscribed before, trial or paid.
 *
 * Old trials (before this release) never carry `asl_start`, so nothing here touches them.
 */
import Stripe from 'stripe';
import { downgradeToFree, findUserById, recordPayment, setSubscriptionStatus, startUserTrial, type User } from '@/lib/db-client';
import { PLANS, isPlan, ownPlanFor } from '@/lib/entitlements';
import { syncDataApiTier } from '@/lib/data-api-tier';
import { recordActivation } from '@/lib/activation';
import { REFUND_DAYS, planForSubscription, type Interval } from '@/lib/stripe-plans';
import { hasNotice, once, recordNotice, withNotices } from '@/lib/billing-notices';
import { sendPurchaseConfirmationEmail, sendRefundConfirmationEmail } from '@/lib/email-service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-09-30.clover' });

const DAY_MS = 86_400_000;

/**
 * For reads that only decide what the billing page shows: bounded, so a slow Stripe never holds
 * the page up (stripe-node's own default is 80 s, retried).
 */
const QUICK: Stripe.RequestOptions = { timeout: 10_000, maxNetworkRetries: 0 };

// ── Formatting ─────────────────────────────────────────────────────────────

/** "$1,290.00", from cents. */
export function formatMoney(cents: number, currency = 'usd'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

/** "13 November 2027" (UTC). */
export const longDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "20 November 2026, 15:06 UTC": a deadline, so the time is part of it. */
export function utcDateTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${longDate(ms)}, ${hh}:${mm} UTC`;
}

const idOf = (ref: unknown): string | null =>
  typeof ref === 'string' ? ref : ref && typeof ref === 'object' && typeof (ref as { id?: unknown }).id === 'string' ? (ref as { id: string }).id : null;

/** The plan as a customer sees it: a legacy payer is never shown the word "legacy". */
function customerPlanLabel(plan: string): string {
  if (plan === 'legacy_pro') return 'Pro';
  return isPlan(plan) ? PLANS[plan].label : plan;
}

/**
 * The words above Checkout's button (custom_text.submit). Stripe's page shows the price, the
 * interval and the total due today; this says the rest before the customer agrees: they pay now,
 * it renews until cancelled, and whether this purchase can be refunded.
 */
export function submitMessage(interval: Interval, refundWindow: boolean): string {
  const every = interval === 'annual' ? 'year' : 'month';
  return `You are charged today. The plan renews every ${every} at the price shown until you cancel. ` + (refundWindow
    ? 'Changed your mind? Within 7 days, choose Cancel and refund on your billing page: the plan ends at once and we refund what you paid in full.'
    : 'Cancel any time from your billing page to stop the next renewal.');
}

// ── The window ─────────────────────────────────────────────────────────────

type SubLike = Pick<Stripe.Subscription, 'metadata' | 'start_date'>;

/** When this subscription's refund window closes (ms), or null when its checkout offered none. */
export function refundUntil(sub: SubLike): number | null {
  if (sub.metadata?.asl_refund !== '7d') return null;
  const start = sub.start_date;
  return typeof start === 'number' && start > 0 ? (start + REFUND_DAYS * 86_400) * 1000 : null;
}

/** The account has had its one refund. */
export function hasUsedRefund(userId: number): boolean {
  return withNotices(db => !!db.prepare(`SELECT 1 FROM billing_notices WHERE kind = 'refunded_in_window' AND user_id = ? LIMIT 1`).get(userId));
}

/** A subscription_started activation: every subscription since activation events began. */
function startedBefore(userId: number): boolean {
  try {
    return withNotices(db => !!db.prepare(`SELECT 1 FROM activation_events WHERE user_id = ? AND event = 'subscription_started' LIMIT 1`).get(userId));
  } catch {
    return false;   // no activation_events table: the other records still decide
  }
}

/**
 * Whether a subscription bought now would be the account's first: the 7-day refund is for "an
 * account's FIRST subscription" (owner, 2026-11-13; the terms' "7-day refund" row). Any earlier
 * subscription counts, trial or paid. Our own records first: a trial, a payment, a linked
 * subscription (one cancelled and still running included), a refund, a started subscription;
 * then Stripe's own list for the customer. A checkout that never paid (incomplete,
 * incomplete_expired) was never a subscription. When Stripe cannot be read the answer is yes:
 * Checkout's text tells the buyer which applies, and a refund offered in error costs less than
 * one wrongly refused.
 */
export async function isFirstSubscription(userId: number, customerId?: string | null): Promise<boolean> {
  const u = findUserById(userId);
  if (u?.trial_started_at || u?.last_payment_at || u?.stripe_subscription_id) return false;
  if (hasUsedRefund(userId) || startedBefore(userId)) return false;
  if (!customerId) return true;
  try {
    for await (const s of stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })) {
      if (s.status !== 'incomplete' && s.status !== 'incomplete_expired') return false;
    }
    return true;
  } catch (err) {
    console.error(`[paid-start] could not read the earlier subscriptions of account ${userId}; offering the refund window:`, err instanceof Error ? err.message : err);
    return true;
  }
}

/** Started paid by Checkout (any version of the paid start). */
export const isPaidStart = (sub: Pick<Stripe.Subscription, 'metadata'>) => !!sub.metadata?.asl_start;

/**
 * Cancel and refund has been asked for on this subscription, or done: its plan is ending or has
 * ended, and no event may grant it again. From the request on, the subscription carries the
 * marker, so every event sent after it does too. An event from before the request that Stripe
 * delivers or retries later (it retries a failed delivery for up to three days, in no order)
 * carries the subscription as it was then, so only our own record of the refund can tell.
 * Between the request and that record the account still has the plan anyway: finishRefund moves
 * it to Free and writes the record in one synchronous step.
 */
export function refundRequested(sub: Pick<Stripe.Subscription, 'id' | 'metadata'>): boolean {
  return !!sub.metadata?.asl_refund_requested_at || hasNotice('refunded_in_window', sub.id);
}

function itemOf(sub: Stripe.Subscription) {
  const item = sub.items?.data?.[0];
  const unit = item?.price?.unit_amount ?? 0;
  return {
    listCents: unit * (item?.quantity ?? 1),
    interval: (item?.price?.recurring?.interval ?? (sub.metadata?.interval === 'annual' ? 'year' : 'month')) as string,
    periodEnd: item?.current_period_end ?? null,
  };
}

async function latestInvoice(sub: Stripe.Subscription): Promise<Stripe.Invoice | null> {
  const ref = sub.latest_invoice;
  if (ref && typeof ref === 'object') return ref as Stripe.Invoice;
  if (typeof ref !== 'string') return null;
  return stripe.invoices.retrieve(ref);
}

async function paidInvoices(subscriptionId: string, options?: Stripe.RequestOptions): Promise<Stripe.Invoice[]> {
  const out: Stripe.Invoice[] = [];
  const params: Stripe.InvoiceListParams = { subscription: subscriptionId, status: 'paid', limit: 100 };
  for await (const inv of options ? stripe.invoices.list(params, options) : stripe.invoices.list(params)) out.push(inv);
  return out;
}

const paidAtMsOf = (inv: Stripe.Invoice | null): number | null => {
  const s = inv?.status_transitions?.paid_at;
  return typeof s === 'number' && s > 0 ? s * 1000 : null;
};

// ── Activation ─────────────────────────────────────────────────────────────

export interface PaidStartResult {
  /** The account's plan or link had to be set (it was not already this subscription's). */
  granted: boolean;
  /** Whether the confirmation was sent by this call (null: already sent, or not due). */
  emailed: boolean | null;
  /** Why nothing was done. */
  skipped?: 'not_live' | 'other_account' | 'refund_requested' | 'no_account';
}

/**
 * Give the account the plan its paid subscription bought, record the payment, and confirm it.
 * Idempotent: called by three webhook events and the billing watch, often at once. The plan and
 * payment writes repeat harmlessly; the activation and the email happen once per subscription.
 */
export async function activatePaidStart(userId: number, sub: Stripe.Subscription): Promise<PaidStartResult> {
  if (!isPaidStart(sub) || sub.status !== 'active') return { granted: false, emailed: null, skipped: 'not_live' };
  if (sub.metadata?.userId !== String(userId)) return { granted: false, emailed: null, skipped: 'other_account' };
  // A refund has been asked for or made: the plan is ending, and a late event must never grant it again.
  if (refundRequested(sub)) return { granted: false, emailed: null, skipped: 'refund_requested' };
  const user = findUserById(userId);
  if (!user) {
    console.error(`[paid-start] no account ${userId} for ${sub.id}`);
    return { granted: false, emailed: null, skipped: 'no_account' };
  }

  // 1–2. The plan, from the Price.
  const plan = planForSubscription(sub);
  const customer = idOf(sub.customer) ?? '';
  const granted = user.stripe_subscription_id !== sub.id || ownPlanFor(user) !== plan;
  if (granted || user.stripe_customer_id !== customer) {
    startUserTrial(userId, customer, sub.id, plan, null, 'active');
    // A cancelled subscription still running to its end left its dates on the account; they
    // belonged to that one, and would otherwise end this paid plan on the old date.
    setSubscriptionStatus(userId, 'active', { clearCancellation: true });
    syncDataApiTier(userId);
  }

  // 3. The payment: the newest invoice, which is the purchase itself until a plan change is paid.
  // An invoice.payment_succeeded that came before the account was linked to this subscription was
  // skipped by its current-subscription check, so it is recorded here; never over a later payment
  // already recorded (a late event carries an older invoice).
  let latest: Stripe.Invoice | null = null;
  try {
    latest = await latestInvoice(sub);
  } catch (err) {
    // Without the invoice the amount is unknown: the activation and the email wait for the
    // billing watch (rule 6), which runs this again.
    console.error(`[paid-start] could not read the latest invoice of ${sub.id}:`, err instanceof Error ? err.message : err);
    return { granted, emailed: null };
  }
  if (latest?.status === 'paid' && (latest.amount_paid ?? 0) > 0) {
    const at = paidAtMsOf(latest) ?? Date.now();
    const before = Date.parse(user.last_payment_at ?? '');
    if (Number.isNaN(before) || before < at) recordPayment(userId, new Date(at).toISOString());
  }

  // 4–5 happen once each. Nothing is left once both are recorded, or once the activation is and
  // the email is no longer due (a renewal a year on is not a purchase).
  const startedMs = (sub.start_date ?? 0) * 1000;
  const emailDue = Date.now() - startedMs <= REFUND_DAYS * DAY_MS && !hasNotice('purchase_confirmed', sub.id);
  if (!emailDue && hasNotice('paid_start', sub.id)) return { granted, emailed: null };

  // What was paid. At the purchase the newest invoice is the first one. A confirmation the billing
  // watch sends late, after a plan change, states every payment on the subscription (what Cancel
  // and refund gives back) dated from the first, never the change's invoice alone ($0.00 while
  // the change is unpaid).
  let inv: Stripe.Invoice | null = latest;
  let paidCents = latest && latest.status === 'paid' ? latest.amount_paid ?? 0 : 0;
  if (latest && latest.billing_reason !== 'subscription_create') {
    try {
      const paid = await paidInvoices(sub.id);
      paidCents = paid.reduce((n, i) => n + (i.amount_paid ?? 0), 0);
      inv = paid.find(i => i.billing_reason === 'subscription_create') ?? paid[paid.length - 1] ?? latest;
    } catch (err) {
      console.error(`[paid-start] could not read the invoices of ${sub.id}:`, err instanceof Error ? err.message : err);
      return { granted, emailed: null };
    }
  }
  const paidAtMs = paidAtMsOf(inv) ?? Date.now();

  const currency = inv?.currency ?? sub.currency ?? 'usd';
  const { listCents, interval, periodEnd } = itemOf(sub);
  const label = customerPlanLabel(plan);
  // Nothing paid (a 100% discount) means nothing to refund, so no deadline is promised.
  const until = paidCents > 0 ? refundUntil(sub) : null;

  // 4. The activation record, once.
  await once(
    {
      kind: 'paid_start', userId, email: user.email, ref: sub.id,
      detail: `${label}, ${formatMoney(listCents, currency)}/${interval}: paid ${formatMoney(paidCents, currency)}${until ? `; refundable until ${utcDateTime(until)}` : '; no refund window'}`,
    },
    async () => {
      recordActivation(userId, 'subscription_started', plan, {
        start: 'paid', amountPaid: paidCents, refundUntil: until ? new Date(until).toISOString() : null, subscriptionId: sub.id,
      });
    },
    false,
  );

  // 5. The confirmation, once, while the subscription is new: a renewal a year on is not a purchase.
  if (Date.now() - startedMs > REFUND_DAYS * DAY_MS) return { granted, emailed: null };
  const todayUtc = new Date(Date.now()).toISOString().slice(0, 10);
  const sent = await once(
    {
      kind: 'purchase_confirmed', userId, email: user.email, ref: sub.id,
      detail: `Emailed the ${label} confirmation: paid ${formatMoney(paidCents, currency)}${until ? `, refundable until ${utcDateTime(until)}` : ''}`,
    },
    () => sendPurchaseConfirmationEmail(user.email, {
      planLabel: label,
      amount: formatMoney(listCents, currency),
      interval,
      paid: {
        amount: formatMoney(paidCents, currency),
        paidOn: new Date(paidAtMs).toISOString().slice(0, 10) === todayUtc ? null : longDate(paidAtMs),
        nextCharge: typeof periodEnd === 'number' && periodEnd > 0 ? longDate(periodEnd * 1000) : null,
        refundUntil: until ? utcDateTime(until) : null,
      },
    }),
    false,
  );
  return { granted, emailed: sent ? sent.done : null };
}

// ── Refund window ──────────────────────────────────────────────────────────

export type RefundState =
  | {
      eligible: false;
      reason: 'no_subscription' | 'already_refunded' | 'unavailable' | 'not_owner' | 'not_active' | 'no_window' | 'expired' | 'nothing_paid';
    }
  | {
      eligible: true;
      subscriptionId: string;
      /** When the window closes (ISO). */
      until: string;
      /** Every payment on the subscription, which is what a refund gives back. */
      amountCents: number;
      currency: string;
      planLabel: string;
      /** Asked for already, and not finished yet. */
      requested: boolean;
    };

/**
 * Whether this account's subscription can be cancelled and refunded now, and for how much.
 * `quick` (the billing page's GET): Stripe gets 10 seconds and no retry, so a slow Stripe only
 * leaves the pane out instead of holding the page.
 */
export async function refundState(userId: number, opts: { quick?: boolean } = {}): Promise<RefundState> {
  const user = findUserById(userId);
  if (!user?.stripe_subscription_id) return { eligible: false, reason: 'no_subscription' };
  if (hasUsedRefund(userId)) return { eligible: false, reason: 'already_refunded' };
  let sub: Stripe.Subscription;
  try {
    sub = opts.quick
      ? await stripe.subscriptions.retrieve(user.stripe_subscription_id, {}, QUICK)
      : await stripe.subscriptions.retrieve(user.stripe_subscription_id);
  } catch (err) {
    console.error(`[paid-start] could not read ${user.stripe_subscription_id}:`, err instanceof Error ? err.message : err);
    return { eligible: false, reason: 'unavailable' };
  }
  return stateOf(user, sub, opts.quick ? QUICK : undefined);
}

async function stateOf(user: User, sub: Stripe.Subscription, options?: Stripe.RequestOptions): Promise<RefundState> {
  // A paid start always carries the account id; any other subscription is judged by its customer.
  const metaUser = sub.metadata?.userId;
  const owns = metaUser ? metaUser === String(user.id) : idOf(sub.customer) === user.stripe_customer_id;
  if (!owns) return { eligible: false, reason: 'not_owner' };
  if (sub.status !== 'active') return { eligible: false, reason: 'not_active' };
  const until = refundUntil(sub);
  if (!until) return { eligible: false, reason: 'no_window' };
  // Asked for in time and not finished: still honoured after the deadline.
  const askedAt = Date.parse(sub.metadata?.asl_refund_requested_at ?? '');
  const requested = !Number.isNaN(askedAt) && askedAt <= until;
  if (!(Date.now() < until || requested)) return { eligible: false, reason: 'expired' };
  let invoices: Stripe.Invoice[];
  try {
    invoices = await paidInvoices(sub.id, options);
  } catch (err) {
    console.error(`[paid-start] could not list the invoices of ${sub.id}:`, err instanceof Error ? err.message : err);
    return { eligible: false, reason: 'unavailable' };
  }
  const amountCents = invoices.reduce((n, i) => n + (i.amount_paid ?? 0), 0);
  if (amountCents <= 0) return { eligible: false, reason: 'nothing_paid' };
  return {
    eligible: true,
    subscriptionId: sub.id,
    until: new Date(until).toISOString(),
    amountCents,
    currency: invoices[0]?.currency ?? sub.currency ?? 'usd',
    planLabel: customerPlanLabel(planForSubscription(sub)),
    requested,
  };
}

export type RefundResult =
  | { result: 'ok'; refundedCents: number; currency: string }
  | { result: 'not_eligible' }
  | { result: 'nothing_changed' }
  | { result: 'incomplete' };

/** One request per account at a time in this server: a double click waits for the first. */
const inflight = new Map<number, Promise<RefundResult>>();

/** Cancel and refund, for the account's own subscription (app/api/stripe/refund). */
export function requestRefund(userId: number): Promise<RefundResult> {
  const running = inflight.get(userId);
  if (running) return running;
  const p = doRequestRefund(userId).finally(() => inflight.delete(userId));
  inflight.set(userId, p);
  return p;
}

async function doRequestRefund(userId: number): Promise<RefundResult> {
  const state = await refundState(userId);
  // Stripe could not be read: nothing was done, and the window may well still be open.
  if (!state.eligible) return state.reason === 'unavailable' ? { result: 'nothing_changed' } : { result: 'not_eligible' };
  if (!state.requested) {
    // Written first, so the request survives any later failure and the watch can finish it.
    try {
      await stripe.subscriptions.update(state.subscriptionId, {
        metadata: { asl_refund_requested_at: new Date(Date.now()).toISOString() },
      });
    } catch (err) {
      console.error(`[paid-start] refund request for ${state.subscriptionId} not recorded:`, err instanceof Error ? err.message : err);
      return { result: 'nothing_changed' };
    }
  }
  try {
    const done = await finishRefund(userId, state.subscriptionId);
    return { result: 'ok', refundedCents: done.refundedCents, currency: done.currency };
  } catch (err) {
    console.error(`[paid-start] refund of ${state.subscriptionId} not finished (the billing watch retries):`, err instanceof Error ? err.message : err);
    return { result: 'incomplete' };
  }
}

/**
 * A move to a cheaper plan inside the window (change-plan, always_invoice) credits the unused part
 * of the dearer plan to the Stripe customer, and Stripe applies that credit to the customer's next
 * invoices. Every payment has just been refunded in cash, so the credit goes too: left there, it
 * would pay for the next purchase (Teams annual to Pro annual on day 1 leaves about $1,167, and a
 * new Teams annual would then cost about $123). Taken back: what this subscription's invoices
 * credited, less what its own later invoices used, never more than the credit the customer
 * holds (so a debt paid on an invoice is never read as credit). One balance transaction, under an
 * idempotency key.
 *
 * Decided once per subscription, then never worked out again (2026-11-14). The billing watch reruns
 * finishRefund until the refund email goes, and a rerun would cap at the credit the customer holds
 * by then, credit from elsewhere included, under a key that Stripe refuses with other parameters
 * for 24 hours and then forgets: a second reversal a day later. So the decision is recorded
 * (`credit_reversed`, also when there was nothing left to take), and a reversal that Stripe made
 * but whose answer never reached us is found among the customer's balance transactions by its
 * metadata before anything is worked out.
 */
async function reverseWindowCredit(userId: number, sub: Stripe.Subscription, invoices: Stripe.Invoice[], currency: string): Promise<void> {
  const credited = invoices.reduce((n, i) => {
    const total = i.total ?? 0;
    const start = i.starting_balance ?? 0;
    if (total < 0) return n - total;                                   // a downgrade's credit
    if (total > 0 && start < 0) return n - Math.min(total, -start);   // credit a later invoice used
    return n;
  }, 0);
  const customerId = idOf(sub.customer);
  if (credited <= 0 || !customerId) return;
  if (hasNotice('credit_reversed', sub.id)) return;
  const cus = await stripe.customers.retrieve(customerId);
  if ((cus as Stripe.DeletedCustomer).deleted) {
    recordNotice(userId, 'credit_reversed', sub.id, `Nothing to take back: ${formatMoney(credited, currency)} of plan-change credit, but the Stripe customer is deleted`);
    return;
  }
  const curr = (cus as Stripe.Customer).currency ?? currency;
  for await (const t of stripe.customers.listBalanceTransactions(customerId, { limit: 100 })) {
    if (t.metadata?.subscriptionId === sub.id && t.metadata?.asl_reason === 'refund_window') {
      recordNotice(userId, 'credit_reversed', sub.id, `Took back ${formatMoney(t.amount, t.currency || curr)} of plan-change credit (found in Stripe, ${t.id})`);
      return;
    }
  }
  const held = -((cus as Stripe.Customer).balance ?? 0);
  const take = Math.min(credited, held);
  if (take > 0) {
    await stripe.customers.createBalanceTransaction(customerId, {
      amount: take,
      currency: curr,
      description: `Cancel and refund: plan-change credit of ${sub.id} reversed, every payment on it refunded`,
      metadata: { userId: String(userId), subscriptionId: sub.id, asl_reason: 'refund_window' },
    }, { idempotencyKey: `asl-refund-window-credit-${sub.id}` });
    console.log(`[paid-start] ${sub.id}: reversed ${take} of plan-change credit on the customer`);
  }
  recordNotice(userId, 'credit_reversed', sub.id, take > 0
    ? `Took back ${formatMoney(take, curr)} of plan-change credit`
    : `Nothing to take back: ${formatMoney(credited, curr)} of plan-change credit, none left on the customer`);
}

/**
 * Refund every payment on the subscription, end it, move the account to Free, take back any
 * plan-change credit and email the customer. Idempotent on Stripe's state, so the billing watch
 * can run it again after any failure: refunds carry idempotency keys and an already refunded
 * charge counts as done, a cancelled subscription is not cancelled again, the credit is decided
 * once (`credit_reversed`, or its balance transaction found in Stripe), and once
 * `refunded_in_window` is recorded only the credit and the email are left to retry (rule 5 runs
 * this until `refund_confirmed` is recorded). Throws when a step fails.
 */
export async function finishRefund(userId: number, subscriptionId: string): Promise<{ refundedCents: number; currency: string; emailed: boolean | null }> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  if (sub.metadata?.userId !== String(userId)) throw new Error(`${subscriptionId} does not belong to account ${userId}`);
  if (!sub.metadata?.asl_refund_requested_at) throw new Error(`${subscriptionId}: no refund was requested`);
  const plan = planForSubscription(sub);
  const label = customerPlanLabel(plan);
  const moneyDone = hasNotice('refunded_in_window', subscriptionId);
  let endedS = sub.ended_at ?? null;

  // 1. A plan change still waiting for payment (change-plan, pending_if_incomplete) leaves an
  // open invoice. Voided first, so nothing can be collected once the payments are refunded: paid
  // on Stripe's page between a listing of the paid invoices and the void, it would have been
  // neither refunded nor voided.
  if (!moneyDone) {
    for await (const open of stripe.invoices.list({ subscription: subscriptionId, status: 'open', limit: 100 })) {
      if (open.id) await stripe.invoices.voidInvoice(open.id);
    }
  }
  const invoices = await paidInvoices(subscriptionId);
  let refundedCents = invoices.reduce((n, i) => n + (i.amount_paid ?? 0), 0);
  const currency = invoices[0]?.currency ?? sub.currency ?? 'usd';

  if (!moneyDone) {
    // 2. Every payment on every paid invoice, in full.
    for (const inv of invoices) {
      if (!inv.id || !((inv.amount_paid ?? 0) > 0)) continue;
      for await (const pay of stripe.invoicePayments.list({ invoice: inv.id, status: 'paid', limit: 100 })) {
        const pi = idOf(pay.payment?.payment_intent);
        const charge = idOf(pay.payment?.charge);
        const target = pi ?? charge;
        if (!target) {
          // Paid outside Stripe (marked paid by hand): nothing here can refund it, so it is not
          // reported as refunded either.
          refundedCents -= pay.amount_paid ?? 0;
          console.warn(`[paid-start] ${inv.id}: a payment with no charge on it was not refunded (${subscriptionId})`);
          continue;
        }
        try {
          await stripe.refunds.create(
            {
              ...(pi ? { payment_intent: pi } : { charge: charge! }),
              reason: 'requested_by_customer',
              metadata: { userId: String(userId), subscriptionId, invoiceId: inv.id, asl_reason: 'refund_window' },
            },
            { idempotencyKey: `asl-refund-window-${target}` },
          );
        } catch (err) {
          if ((err as { code?: string })?.code === 'charge_already_refunded') continue;
          throw err;
        }
      }
    }
    // 3. End it now.
    if (sub.status !== 'canceled' && sub.status !== 'incomplete_expired') {
      const ended = await stripe.subscriptions.cancel(subscriptionId, {
        invoice_now: false,
        prorate: false,
        cancellation_details: { comment: 'Refunded within 7 days at the customer’s request' },
      });
      endedS = ended.ended_at ?? endedS;
    }
    // 4. The account, if this is still the subscription it uses: read now, since a late event may
    // have linked it while the steps above ran. The move to Free and the record that makes every
    // later event ignore this subscription (refundRequested) happen together, with nothing awaited
    // in between, so no event can land between them.
    const linked = findUserById(userId);
    const current = !!linked && linked.stripe_subscription_id === subscriptionId;
    if (current) {
      downgradeToFree(userId);
      syncDataApiTier(userId);
    }
    if (recordNotice(userId, 'refunded_in_window', subscriptionId,
      `Refunded ${formatMoney(refundedCents, currency)} and ended ${label}${current ? '; account moved to Free' : ' (not the subscription the account uses)'}`)) {
      recordActivation(userId, 'subscription_refunded', plan, { subscriptionId, refundedCents });
    }
  }

  // 5. Credit a plan change left on the customer, taken back once per subscription (a failure
  // throws, and the watch tries again: the email waits for it; a rerun after it was done takes
  // nothing more).
  await reverseWindowCredit(userId, sub, invoices, currency);

  // 6. Tell the customer, once; a failed email is retried by the watch.
  const user = findUserById(userId);
  if (!user) return { refundedCents, currency, emailed: null };
  const endedMs = typeof endedS === 'number' && endedS > 0 ? endedS * 1000 : Date.now();
  const sent = await once(
    { kind: 'refund_confirmed', userId, email: user.email, ref: subscriptionId, detail: `Emailed: ${formatMoney(refundedCents, currency)} refunded, ${label} ended` },
    () => sendRefundConfirmationEmail(user.email, { planLabel: label, amount: formatMoney(refundedCents, currency), ended: longDate(endedMs) }),
    false,
  );
  return { refundedCents, currency, emailed: sent ? sent.done : null };
}
