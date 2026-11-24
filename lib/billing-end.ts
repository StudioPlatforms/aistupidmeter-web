/**
 * Ending billing for good: once this has run, nothing more is collected.
 *
 * A cancellation normally takes effect at the end of the period already paid for, which is right
 * while that period is paid for. When the latest payment has failed (the subscription is past
 * due), the period is not paid for, and Stripe keeps retrying its open invoice whatever the
 * cancellation says. So three things end a subscription at once instead of at the period's end:
 *
 *  - the customer cancels while a payment is owed;
 *  - a payment has failed MAX_PAYMENT_ATTEMPTS times (the first charge and one retry);
 *  - the account is deleted.
 *
 * Each cancels the subscription now and voids its open invoices. The order matters: cancelled is
 * a final state and switches off automatic collection on the subscription's unpaid invoices,
 * while voiding first would let Stripe read the status from an earlier paid invoice and report
 * the subscription active again for a moment.
 *
 * The reason is checked again on a fresh reading, here, at the moment of cancelling. The callers
 * decide from what they were told (an event that may be delivered late or twice, a list read
 * seconds or minutes ago), and a subscription paid in between must not be ended: cancelling is
 * final. Only a subscription that Stripe charges automatically is ended for a payment owed; one
 * billed by invoice is overdue, not failing, and is left for a person.
 *
 * After the cancel nothing here throws: an invoice that could not be voided is reported, and the
 * billing watch voids it on a later run. Both steps are safe to repeat.
 *
 * Callers: the Stripe webhook (as it happens), the account deletion route, and the billing watch
 * (lib/billing-watch.ts), which catches whatever those two missed.
 */
import Stripe from 'stripe';

// Short limits: the deletion route waits on these calls with a person at the other end.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-09-30.clover', timeout: 15_000, maxNetworkRetries: 1 });

/** Payment attempts on one invoice before its subscription is ended: the first charge and one retry. */
export const MAX_PAYMENT_ATTEMPTS = 2;

const ENDED: ReadonlySet<string> = new Set(['canceled', 'incomplete_expired']);

/** Stripe states in which the subscription's latest payment is owed. */
export const isUnpaid = (status: string): boolean => status === 'past_due' || status === 'unpaid';

/** Why a subscription is being ended: what must still be true when Stripe is asked. */
export type EndReason = 'cancelled_unpaid' | 'failed_twice' | 'account_deleted';

/**
 * The comment each ending leaves on the subscription in Stripe (cancellation_details.comment). The
 * deletion event carries it, which is how the webhook knows an ending was made here, at once and
 * without waiting for any record of it.
 */
export const END_COMMENT: Record<EndReason, string> = {
  account_deleted: 'The account was deleted',
  cancelled_unpaid: 'Cancelled by the customer while a payment was owed',
  failed_twice: `Payment failed ${MAX_PAYMENT_ATTEMPTS} times`,
};

/** Whether a subscription's cancellation comment is one of ours. */
export const isOwnEnding = (comment: unknown): boolean => typeof comment === 'string' && Object.values(END_COMMENT).includes(comment);

export interface EndedBilling {
  subscriptionId: string;
  /** False when it had already ended (only its open invoices were left to void). */
  cancelled: boolean;
  voided: string[];
  /** Open invoices that could not be voided now: collection is off, the billing watch voids them later. */
  notVoided: Array<{ id: string; error: string }>;
  /** Set when nothing was done, because the reason no longer holds (paid meanwhile, say). */
  skipped?: string;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Why `reason` no longer holds for this fresh reading, or null when it does. */
async function noLongerHolds(sub: Stripe.Subscription, reason: EndReason): Promise<string | null> {
  if (reason === 'account_deleted') return null;
  const raw = sub as any;
  if (raw.collection_method !== 'charge_automatically') return 'it is billed by invoice';
  if (!isUnpaid(sub.status)) return `no payment is owed any more (${sub.status})`;
  if (reason === 'cancelled_unpaid') return raw.cancel_at || raw.cancel_at_period_end ? null : 'it is no longer cancelled';
  const latest = typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice?.id;
  if (!latest) return 'it has no invoice';
  const inv = await stripe.invoices.retrieve(latest);
  if (inv.status !== 'open') return `its invoice is ${inv.status}`;
  if ((inv.attempt_count ?? 0) < MAX_PAYMENT_ATTEMPTS) return `its invoice has been tried ${inv.attempt_count ?? 0} time(s)`;
  return null;
}

/** Void every open invoice the listing yields; a failure is reported, not thrown. */
async function voidOpen(params: Stripe.InvoiceListParams): Promise<Pick<EndedBilling, 'voided' | 'notVoided'>> {
  const voided: string[] = [];
  const notVoided: EndedBilling['notVoided'] = [];
  try {
    for await (const inv of stripe.invoices.list({ ...params, status: 'open', limit: 100 })) {
      if (!inv.id) continue;
      try {
        await stripe.invoices.voidInvoice(inv.id);
        voided.push(inv.id);
      } catch (err) {
        notVoided.push({ id: inv.id, error: message(err) });
      }
    }
  } catch (err) {
    notVoided.push({ id: 'the open invoices', error: message(err) });
  }
  return { voided, notVoided };
}

/**
 * Cancel one subscription now, with no final invoice, and void the invoices it left open. Throws
 * only before anything has changed (Stripe could not be read, or refused the cancel).
 */
export async function endBillingNow(subscriptionId: string, comment: string, reason: EndReason): Promise<EndedBilling> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  let cancelled = false;
  // Billed by invoice: what is open there is owed, not failing. Never ended or voided for a
  // payment owed, also when it has ended some other way in the meantime.
  if (reason !== 'account_deleted' && (sub as any).collection_method !== 'charge_automatically') {
    return { subscriptionId, cancelled: false, voided: [], notVoided: [], skipped: 'it is billed by invoice' };
  }
  if (!ENDED.has(sub.status)) {
    const skipped = await noLongerHolds(sub, reason);
    if (skipped) return { subscriptionId, cancelled: false, voided: [], notVoided: [], skipped };
    await stripe.subscriptions.cancel(subscriptionId, {
      invoice_now: false,
      prorate: false,
      cancellation_details: { comment },
    });
    cancelled = true;
  }
  return { subscriptionId, cancelled, ...(await voidOpen({ subscription: subscriptionId })) };
}

/** Void what a subscription this code ended still has open (the billing watch's tidy-up). */
export async function voidOpenInvoices(subscriptionId: string): Promise<Pick<EndedBilling, 'voided' | 'notVoided'>> {
  return voidOpen({ subscription: subscriptionId });
}

/** Detach every saved payment method from a customer. Returns how many were removed. */
export async function removeSavedPaymentMethods(customerId: string): Promise<number> {
  let removed = 0;
  for await (const pm of stripe.customers.listPaymentMethods(customerId, { limit: 100 })) {
    await stripe.paymentMethods.detach(pm.id);
    removed += 1;
  }
  return removed;
}

/**
 * Everything of one customer, for an account that is being deleted: every subscription that has
 * not ended is cancelled now, every open invoice is voided, and the saved payment methods are
 * removed. Throws when any of it could not be done, so the caller can refuse the deletion: an
 * account must not go while something of it can still be charged. A customer Stripe no longer
 * has (removed in the dashboard) has nothing left to end, and is not a failure. Safe to run
 * again. Stripe keeps the customer record and its past invoices, as it must.
 */
export async function endCustomerBilling(
  customerId: string,
  comment: string,
): Promise<{ subscriptions: string[]; voided: string[]; paymentMethodsRemoved: number }> {
  const subscriptions: string[] = [];
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ((customer as Stripe.DeletedCustomer).deleted) return { subscriptions, voided: [], paymentMethodsRemoved: 0 };
  } catch (err) {
    if ((err as { code?: string })?.code === 'resource_missing') return { subscriptions, voided: [], paymentMethodsRemoved: 0 };
    throw err;
  }
  for await (const s of stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })) {
    if (ENDED.has(s.status)) continue;
    await stripe.subscriptions.cancel(s.id, { invoice_now: false, prorate: false, cancellation_details: { comment } });
    subscriptions.push(s.id);
  }
  const { voided, notVoided } = await voidOpen({ customer: customerId });
  if (notVoided.length) throw new Error(`could not void ${notVoided.map(n => n.id).join(', ')}: ${notVoided[0].error}`);
  const paymentMethodsRemoved = await removeSavedPaymentMethods(customerId);
  return { subscriptions, voided, paymentMethodsRemoved };
}
