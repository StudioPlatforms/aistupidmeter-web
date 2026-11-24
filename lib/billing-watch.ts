/**
 * Billing watch: keeps every account in step with what its owner actually pays, and tells the
 * customer when that changes. The owner's rules (2026-10-22):
 *
 *  - Charged twice. An account with two live subscriptions keeps the dearer one (the one in use
 *    when they cost the same) and the other is cancelled at once. Nothing is refunded
 *    automatically, and there is no email. When the dearer one is not the one the account
 *    uses, nothing is done: the admin dashboard shows it for a person to sort out. Nor is a paid
 *    start in its first 7 days (2026-11-14): it was charged at checkout and promised its refund
 *    window, so cancelling it unrefunded would keep money for a plan the account never gets; a
 *    person refunds and cancels it (the dashboard lists it as charged twice).
 *  - A renewal that fails. The customer is emailed, once per unpaid invoice, that the
 *    subscription will be cancelled if the payment keeps failing. Stripe retries, then cancels.
 *  - A subscription that ends unpaid. The account moves to Free and the customer is emailed that
 *    there is a problem with their billing. The webhook does this as it happens; the watch
 *    catches any cancellation the webhook missed (an account whose plan stayed active while
 *    unpaid), and moves the account again, without a second email, if a late Stripe event
 *    links it to the ended subscription once more.
 *  - Legacy $4.99 (changed 2026-10-29: these move to the current price instead of ending).
 *    Twelve months after a subscriber's first subscription, the subscription moves to the current
 *    Pro price, $12 a month. The customer is emailed from 37 days before the 12-month mark, and
 *    the first $12 charge is the first renewal that is both on or after the mark and at least 30
 *    days after the email (the terms promise 30 days' notice of a price change). Two days before
 *    that renewal the price is switched with no proration, so the period already paid for stays
 *    at $4.99; the account keeps its plan until the first $12 period begins, then becomes Pro.
 *    The email's cancel link ends the subscription at the close of the period already paid for.
 *    The emails go only with LEGACY_PRICE_CHANGE=on (the owner approves the wording first); a dry
 *    run shows who would get one.
 *  - Paid start (2026-11-13; lib/paid-start.ts). Every new subscription is paid at checkout, and
 *    an account's refund within 7 days ends its plan at once. The watch finishes a refund that
 *    was asked for in time but did not complete (rule 5), and grants and confirms a paid
 *    subscription whose webhook events never arrived (rule 6).
 *  - Plan changes are paid at once (app/api/stripe/change-plan). One whose payment has not gone
 *    through stays pending; after 24 hours the watch voids its invoice, which ends it (rule 7).
 *    Stripe's own expiry (about 23 hours) usually gets there first; this is the safety net.
 *  - Cancelled means nothing more is collected, and a payment is tried twice at most (2026-11-24;
 *    lib/billing-end.ts). A subscription ends at once, with its open invoice voided, when its
 *    account was deleted (rule 8), when the customer cancelled while a payment was owed (rule 9),
 *    or when a payment has failed twice (rule 10: the account moves to Free and the customer is
 *    emailed). Only a subscription our checkout made, charged automatically, and only if that
 *    still holds on a fresh reading. The webhook and the account deletion route do this as it
 *    happens; the watch catches what they missed and tidies what a failure left open.
 *
 * The API worker calls POST /api/internal/billing-watch every six hours. Every action and
 * email is recorded in billing_notices, one per kind and Stripe object, so a rerun never
 * repeats one; an email that fails to send is not recorded and is tried again next run.
 */
import Stripe from 'stripe';
import { PLANS, isPlan, ownPlanFor, type Plan } from '@/lib/entitlements';
import { cancelSubscription, downgradeToFree, findUserById, moveLegacyToPro } from '@/lib/db-client';
import { syncDataApiTier } from '@/lib/data-api-tier';
import { recordActivation } from '@/lib/activation';
import { stripeSnapshot, type StripeSubscriptionRecord } from '@/lib/admin-stripe';
import { REFUND_DAYS, priceIdFor } from '@/lib/stripe-plans';
import { PREVIEW_SUBSCRIPTION, cancelLink } from '@/lib/cancel-link';
import {
  sendCancellationConfirmedEmail, sendCancelledNowEmail, sendLegacyPriceChangeEmail, sendPaymentFailedEmail,
  sendSubscriptionCancelledUnpaidEmail, sendSubscriptionEndedEmail,
} from '@/lib/email-service';
import { finishInterrupted, hasNotice, once, recentNotices, withNotices, type NoticeKind, type WatchAction } from '@/lib/billing-notices';
import { activatePaidStart, finishRefund } from '@/lib/paid-start';
import { END_COMMENT, MAX_PAYMENT_ATTEMPTS, endBillingNow, isUnpaid, removeSavedPaymentMethods, voidOpenInvoices } from '@/lib/billing-end';

// The log's helpers live in lib/billing-notices.ts (shared with lib/paid-start.ts); these names
// stay importable from here.
export { once, recentNotices, type NoticeKind, type WatchAction };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-09-30.clover' });

const DAY = 86_400_000;
/** Stripe states in which a subscription still bills or will bill. */
const LIVE = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete']);
const ENDED = new Set(['canceled', 'incomplete_expired']);
/** The terms: a price change is announced at least 30 days before it applies. */
const NOTICE_MS = 30 * DAY;
/**
 * The $4.99 → $12 email goes this long before the 12-month mark, so the first renewal after the
 * mark can take the new price with the 30 days' notice kept even if the watch misses some runs.
 */
const NOTICE_LEAD_MS = 37 * DAY;
/** How long before that renewal the price is switched; the watch runs every six hours. */
const SWITCH_LEAD_MS = 2 * DAY;
/** Our own accounts and the demo account: never billed, never emailed by this. */
const DEMO_ACCOUNT_ID = 1360;
const INTERNAL_ROLES = new Set(['admin', 'superadmin', 'system']);

interface Account {
  id: number;
  email: string;
  role: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_tier: string | null;
  trial_ends_at: string | null;
  subscription_canceled_at: string | null;
  subscription_ends_at: string | null;
}

export const isInternal = (a: { id: number; role?: string | null }) => INTERNAL_ROLES.has(a.role ?? '') || a.id === DEMO_ACCOUNT_ID;

/** The plan's name as a customer sees it: a legacy payer is never shown the word "legacy". */
const customerPlanLabel = (plan: Plan) => (plan === 'legacy_pro' ? 'Pro' : PLANS[plan].label);
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const isoOf = (unix: unknown) => (typeof unix === 'number' && unix > 0 ? new Date(unix * 1000).toISOString() : null);
const addYear = (iso: string) => { const d = new Date(iso); d.setUTCFullYear(d.getUTCFullYear() + 1); return d.toISOString(); };

/**
 * The first renewal of a monthly subscription at or after `notBefore`, counting from the current
 * period's end. Stripe renews on the billing anchor's day of the month (a shorter month's last
 * day) at the anchor's time.
 */
function renewalOnOrAfter(periodEnd: string, anchor: string, notBefore: number): string {
  const a = new Date(anchor);
  let at = new Date(periodEnd);
  while (at.getTime() < notBefore) {
    const year = at.getUTCFullYear();
    const month = at.getUTCMonth() + 1;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    at = new Date(Date.UTC(year, month, Math.min(a.getUTCDate(), lastDay), a.getUTCHours(), a.getUTCMinutes(), a.getUTCSeconds()));
  }
  return at.toISOString();
}

/** Email about a failed renewal, once per invoice. Used by the watch and by the invoice.payment_failed webhook. */
export function notifyPaymentFailed(
  user: { id: number; email: string; plan: Plan },
  invoice: { id: string; amountDue: number; nextAttemptAt: string | null },
  dryRun = false,
) {
  return once(
    {
      kind: 'payment_failed', userId: user.id, email: user.email, ref: invoice.id,
      detail: `${money(invoice.amountDue)} due${invoice.nextAttemptAt ? `, next attempt ${invoice.nextAttemptAt.slice(0, 10)}` : ', no retry scheduled'}`,
    },
    () => sendPaymentFailedEmail(user.email, {
      planLabel: customerPlanLabel(user.plan),
      amount: money(invoice.amountDue),
      nextAttempt: invoice.nextAttemptAt ? longDate(invoice.nextAttemptAt) : null,
    }),
    dryRun,
  );
}

/** Email that the subscription ended unpaid, once per subscription. Used by the watch and the deletion webhook. */
export function notifyCancelledUnpaid(user: { id: number; email: string }, subscriptionId: string, plan: Plan, dryRun = false) {
  return once(
    { kind: 'cancelled_unpaid', userId: user.id, email: user.email, ref: subscriptionId, detail: `${PLANS[plan].label} cancelled for non-payment; emailed` },
    () => sendSubscriptionCancelledUnpaidEmail(user.email, { planLabel: customerPlanLabel(plan) }),
    dryRun,
  );
}

/**
 * The cancellation emails (2026-11-24): one when the customer cancels, one when the subscription
 * reaches its end. They go only with CANCEL_EMAILS=on (the wording is approved first); without
 * it nothing is sent and nothing is recorded, so switching it on starts from that moment.
 */
export const cancelEmailsOn = (): boolean => process.env.CANCEL_EMAILS === 'on';
/**
 * A cancellation is confirmed, and an ending announced, only while it is news: within two days of
 * it. An event delivered late, or the emails being switched on, must not write to someone about a
 * cancellation of weeks ago.
 */
export const STILL_NEWS_MS = 2 * 86_400_000;

/**
 * Email confirming a cancellation that runs to the end of the paid period. Once per cancellation:
 * a subscription resumed and cancelled again is confirmed again (the reference carries when it
 * was cancelled).
 */
export async function notifyCancellationConfirmed(
  user: { id: number; email: string },
  sub: { id: string; canceledAt: number | null; endsAt: string | null; trial?: boolean },
  plan: Plan,
  dryRun = false,
) {
  if (!cancelEmailsOn()) return null;
  if (sub.canceledAt !== null && Date.now() - sub.canceledAt * 1000 > STILL_NEWS_MS) return null;
  return once(
    {
      kind: 'cancel_confirmed', userId: user.id, email: user.email, ref: `${sub.id}:${sub.canceledAt ?? 0}`,
      detail: `${customerPlanLabel(plan)} cancelled by the customer; ends ${sub.endsAt ? sub.endsAt.slice(0, 10) : 'at the period end'}; emailed`,
    },
    () => sendCancellationConfirmedEmail(user.email, { planLabel: customerPlanLabel(plan), endsOn: sub.endsAt ? longDate(sub.endsAt) : null, trial: !!sub.trial }),
    dryRun,
  );
}

/** Email that a subscription cancelled while a payment was owed ended at once. Once per subscription. */
export async function notifyCancelledNow(user: { id: number; email: string }, subscriptionId: string, plan: Plan, dryRun = false) {
  if (!cancelEmailsOn()) return null;
  return once(
    { kind: 'cancel_confirmed', userId: user.id, email: user.email, ref: subscriptionId, detail: `${customerPlanLabel(plan)} cancelled with a payment owed; ended at once; emailed` },
    () => sendCancelledNowEmail(user.email, { planLabel: customerPlanLabel(plan) }),
    dryRun,
  );
}

/** Email that a cancelled subscription has reached its end. Once per subscription. */
export async function notifySubscriptionEnded(user: { id: number; email: string }, subscriptionId: string, plan: Plan, dryRun = false) {
  if (!cancelEmailsOn()) return null;
  return once(
    { kind: 'ended_confirmed', userId: user.id, email: user.email, ref: subscriptionId, detail: `${customerPlanLabel(plan)} ended; emailed` },
    () => sendSubscriptionEndedEmail(user.email, { planLabel: customerPlanLabel(plan) }),
    dryRun,
  );
}

/** Read the invoice a failed renewal left open (its amount and Stripe's next attempt). */
async function openInvoice(id: string): Promise<{ id: string; amountDue: number; nextAttemptAt: string | null } | null> {
  try {
    const inv = await stripe.invoices.retrieve(id);
    if (inv.status !== 'open') return null;
    return { id: inv.id!, amountDue: inv.amount_due ?? 0, nextAttemptAt: isoOf(inv.next_payment_attempt) };
  } catch {
    return null;
  }
}

export async function runBillingWatch({ dryRun = false } = {}): Promise<{ at: string; dryRun: boolean; actions: WatchAction[] }> {
  const snap = await stripeSnapshot(true);
  const accounts = withNotices(db => db.prepare(`
    SELECT id, email, role, stripe_customer_id, stripe_subscription_id, subscription_tier,
           trial_ends_at, subscription_canceled_at, subscription_ends_at
      FROM router_users
  `).all() as Account[]);
  const byId = new Map(accounts.map(a => [a.id, a]));
  const byCustomer = new Map(accounts.filter(a => a.stripe_customer_id).map(a => [a.stripe_customer_id!, a]));
  const byEmail = new Map(accounts.map(a => [a.email.toLowerCase(), a]));
  const ownerOf = (s: StripeSubscriptionRecord): Account | null =>
    (s.metaUserId ? byId.get(s.metaUserId) : undefined)
    ?? byCustomer.get(s.customerId)
    ?? (s.customerEmail ? byEmail.get(s.customerEmail.toLowerCase()) : undefined)
    ?? null;
  const subs = snap.subscriptions.map(s => ({ s, owner: ownerOf(s) })).filter(x => !x.owner || !isInternal(x.owner));
  const subById = new Map(snap.subscriptions.map(s => [s.id, s]));
  const now = Date.now();
  const actions: WatchAction[] = [];
  const push = (a: WatchAction | null) => { if (a) actions.push(a); };

  // 8 to 10 end billing at once (lib/billing-end.ts). They run first: a subscription ended here is
  // not a duplicate to weigh (rule 1) and is not sent the failed-payment warning (rule 2). Each is
  // decided again on a fresh reading at the moment of cancelling, so one paid in the meantime is
  // left alone.
  const cancelled = new Set<string>();
  /** Subscriptions an ending was planned or made for in this run. */
  const thisRun = new Set<string>();
  /**
   * Endings already recorded (subscription → kind). One recorded is left alone by all three,
   * whatever this run's reading of Stripe says. A claim still in progress is not in here: once()
   * decides about it (another worker holds it, or it is stale and is taken over).
   */
  // An ending interrupted after its cancel (the server stopped): the subscription has ended but
  // its claim was never finished. Finished here, so its email and tidy-up below still happen.
  if (!dryRun) {
    for (const n of finishInterrupted(['ended_no_account', 'ended_cancel_unpaid', 'ended_unpaid'], ref => ENDED.has(subById.get(ref)?.status ?? ''))) {
      console.warn(`[billing-watch] ${n.kind} of ${n.ref} was interrupted after its cancel; its record is finished now`);
    }
  }
  const recorded = new Map(withNotices(db => db.prepare(`
    SELECT ref, kind FROM billing_notices
     WHERE kind IN ('ended_no_account', 'ended_cancel_unpaid', 'ended_unpaid') AND detail NOT LIKE '(in progress) %'
  `).all() as Array<{ ref: string; kind: NoticeKind }>).map(n => [n.ref, n.kind]));
  /** Accounts recorded as deleted (the deletion route writes it): user:<id>. */
  const deleted = new Set(withNotices(db => db.prepare(`SELECT ref FROM billing_notices WHERE kind = 'account_deleted'`).all() as Array<{ ref: string }>).map(n => n.ref));
  const skip = (id: string) => recorded.has(id) || thisRun.has(id);
  const ending = (a: WatchAction | null, id: string) => {
    if (a) thisRun.add(id);
    if (a?.done) cancelled.add(id);
    push(a);
  };
  /** What one ending did, for the record: an invoice that could not be voided is said, not hidden. */
  const leftOpen = (out: { notVoided: Array<{ id: string; error: string }> }) =>
    (out.notVoided.length ? `; NOT voided yet: ${out.notVoided.map(n => n.id).join(', ')} (${out.notVoided[0].error})` : '');
  /**
   * The account's side of an ending, read now, not as it was when the run began: a plan bought in
   * between is on another subscription and stays. The deletion event does the same when it
   * arrives first; whichever comes second finds nothing linked and does nothing.
   */
  const toFree = (userId: number, subscriptionId: string): string => {
    try {
      const linked = findUserById(userId);
      if (!linked || linked.stripe_subscription_id !== subscriptionId) return '';
      downgradeToFree(userId);
      syncDataApiTier(userId);
      recordActivation(userId, 'subscription_cancelled', null, { subscriptionId, reconciled: true });
      return '';
    } catch (err) {
      return `; the account was NOT moved to Free here (${err instanceof Error ? err.message : String(err)})`;
    }
  };
  /** Ours to end for a payment owed: made by our checkout for an account, or the one an account uses. */
  const ours = (x: (typeof subs)[number]) => !!x.s.metaUserId || (!!x.owner && x.owner.stripe_subscription_id === x.s.id);

  // 8. The account was deleted. Only on the deletion route's own record of it, and only a
  // subscription our checkout made for that account: a missing row alone (a restored database,
  // say) ends nothing, and one set up by hand in Stripe is not ours to end.
  for (const { s } of subs) {
    if (skip(s.id) || !s.metaUserId || !deleted.has(`user:${s.metaUserId}`) || byId.has(s.metaUserId) || byCustomer.has(s.customerId)) continue;
    if (!LIVE.has(s.status) || s.status === 'incomplete') continue;
    // Paid at a Checkout page left open and completed after the deletion: ending it here would
    // keep the money for a plan nobody can use. For a person to refund and cancel.
    if (s.paidStart && s.status === 'active' && now - Date.parse(s.startedAt) <= REFUND_DAYS * DAY) {
      push({
        kind: 'ended_no_account', userId: null, email: s.customerEmail, ref: s.id, done: false,
        detail: `Account ${s.metaUserId} was deleted, and ${s.id} was paid after that: not ended here`,
        error: 'refund and cancel it by hand',
      });
      continue;
    }
    const what = `Account ${s.metaUserId} was deleted: ${s.id} (${s.status}) cancelled, its open invoices voided`;
    const act: Omit<WatchAction, 'done'> = { kind: 'ended_no_account', userId: null, email: s.customerEmail, ref: s.id, detail: `${what}, the saved payment methods removed` };
    ending(await once(
      act,
      async () => {
        const out = await endBillingNow(s.id, END_COMMENT.account_deleted, 'account_deleted');
        // Billing has ended whatever happens next: a card that could not be removed is said in
        // the record, and the tidy-up below tries again.
        let cards = ', the saved payment methods removed';
        try {
          await removeSavedPaymentMethods(s.customerId);
        } catch (err) {
          cards = `; the saved payment methods NOT removed yet (${err instanceof Error ? err.message : String(err)})`;
        }
        act.detail = `${what}${cards}${leftOpen(out)}`;
      },
      dryRun,
    ), s.id);
  }

  // 9. Cancelled by the customer while a payment is owed: the period the cancellation would run
  // to was never paid for, so it ends now. The account, if this is the subscription it uses,
  // moves to Free.
  for (const x of subs) {
    const s = x.s;
    if (skip(s.id) || !ours(x) || !isUnpaid(s.status) || !s.cancelAt || s.refundRequestedAt) continue;
    const user = x.owner && x.owner.stripe_subscription_id === s.id ? x.owner : null;
    const plan = user ? ownPlanFor(user) : 'free';
    const what = `Cancelled by the customer with ${s.invoice ? money(s.invoice.amountDue) : 'a payment'} unpaid: ${s.id} ended now, its open invoice voided`
      + (user && plan !== 'free' ? `; ${PLANS[plan].label} → Free` : '');
    const told = !!user && plan !== 'free';
    const act: Omit<WatchAction, 'done'> = { kind: 'ended_cancel_unpaid', userId: told ? user!.id : null, email: x.owner?.email ?? s.customerEmail, ref: s.id, detail: what };
    const a = await once(
      act,
      async () => {
        const out = await endBillingNow(s.id, END_COMMENT.cancelled_unpaid, 'cancelled_unpaid');
        if (out.skipped) return { success: false, error: `not ended: ${out.skipped}` };
        act.detail = `${what}${leftOpen(out)}${user ? toFree(user.id, s.id) : ''}`;
      },
      dryRun,
    );
    ending(a, s.id);
    if (told && a && (dryRun || a.done)) push(await notifyCancelledNow(user!, s.id, plan, dryRun));
  }

  // 10. A payment that has failed twice (the first charge and one retry): cancelled, nothing more
  // collected. The account, if this is the subscription it uses, moves to Free and is emailed;
  // the record carries that account exactly when an email is due, which is how one that did not
  // send is found below.
  for (const x of subs) {
    const s = x.s;
    if (skip(s.id) || !ours(x) || !isUnpaid(s.status) || s.refundRequestedAt) continue;
    if (!s.invoice?.open || s.invoice.attempts < MAX_PAYMENT_ATTEMPTS || s.invoice.amountDue <= 0) continue;
    const user = x.owner && x.owner.stripe_subscription_id === s.id ? x.owner : null;
    const plan = user ? ownPlanFor(user) : 'free';
    const tell = !!user && plan !== 'free';
    const what = `${money(s.invoice.amountDue)} failed ${s.invoice.attempts} times: ${s.id} cancelled, its invoice voided`
      + (tell ? `; ${PLANS[plan].label} → Free` : '');
    const act: Omit<WatchAction, 'done'> = { kind: 'ended_unpaid', userId: tell ? user!.id : null, email: x.owner?.email ?? s.customerEmail, ref: s.id, detail: what };
    const a = await once(
      act,
      async () => {
        const out = await endBillingNow(s.id, END_COMMENT.failed_twice, 'failed_twice');
        if (out.skipped) return { success: false, error: `not ended: ${out.skipped}` };
        act.detail = `${what}${leftOpen(out)}${user ? toFree(user.id, s.id) : ''}`;
      },
      dryRun,
    );
    ending(a, s.id);
    if (tell && a && (dryRun || a.done)) push(await notifyCancelledUnpaid(user!, s.id, plan, dryRun));
  }
  // An email that did not send (the webhook's too): tried again until it does, while it is news.
  // Each ending's record carries the account exactly when an email is due, and its email is a
  // record of its own; a claim on that still in progress does not count as sent (once() decides
  // about it). The plan is the ended subscription's own, since the account is on Free by now;
  // and only an account that still is: one that has subscribed again is not told it is on Free.
  const owed = (ending: NoticeKind, email: NoticeKind) => withNotices(db => db.prepare(`
    SELECT e.ref, e.user_id AS userId FROM billing_notices e
     WHERE e.kind = ? AND e.user_id IS NOT NULL AND e.detail NOT LIKE '(in progress) %'
       AND e.created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days')
       AND NOT EXISTS (SELECT 1 FROM billing_notices c WHERE c.kind = ? AND c.ref = e.ref
                          AND (c.detail IS NULL OR c.detail NOT LIKE '(in progress) %'))
  `).all(ending, email) as Array<{ ref: string; userId: number }>);
  const sendOwed = async (ending: NoticeKind, email: NoticeKind, send: (user: Account, ref: string, plan: Plan) => Promise<WatchAction | null>) => {
    for (const n of owed(ending, email)) {
      if (thisRun.has(n.ref)) continue;   // ended in this run: emailed (or planned) just above
      const user = byId.get(n.userId);
      const plan = subById.get(n.ref)?.plan;
      if (!user || isInternal(user) || !plan || plan === 'free') continue;
      if (user.stripe_subscription_id || ownPlanFor(user) !== 'free') continue;   // has a plan again: no longer true
      push(await send(user, n.ref, plan));
    }
  };
  await sendOwed('ended_unpaid', 'cancelled_unpaid', (u, ref, plan) => notifyCancelledUnpaid(u, ref, plan, dryRun));
  await sendOwed('ended_cancel_unpaid', 'cancel_confirmed', (u, ref, plan) => notifyCancelledNow(u, ref, plan, dryRun));
  await sendOwed('ended_cancelled', 'ended_confirmed', (u, ref, plan) => notifySubscriptionEnded(u, ref, plan, dryRun));

  // A cancellation the webhook did not confirm (its email failed, or the event has not come):
  // confirmed here while it is news. once() keeps it to one per cancellation.
  for (const x of subs) {
    const s = x.s;
    if (!x.owner || !s.cancelAt || !s.cancelRequestedAt || (s.status !== 'active' && s.status !== 'trialing')) continue;
    if (x.owner.stripe_subscription_id !== s.id || s.refundRequestedAt || skip(s.id)) continue;
    const plan = ownPlanFor(x.owner);
    if (plan === 'free') continue;
    push(await notifyCancellationConfirmed(x.owner,
      { id: s.id, canceledAt: Math.floor(Date.parse(s.cancelRequestedAt) / 1000), endsAt: s.cancelAt, trial: s.status === 'trialing' }, plan, dryRun));
  }

  // The tidy-up of an ending recorded earlier (the last two weeks): an invoice that could not be
  // voided then, and for a deleted account a saved card that could not be removed. Collection is
  // already off; this closes what is left. Nothing is recorded: it is the same ending.
  if (!dryRun) {
    for (const [id, kind] of Array.from(recorded)) {
      const s = subById.get(id);
      if (!s || !ENDED.has(s.status) || !s.endedAt || now - Date.parse(s.endedAt) > 14 * DAY) continue;
      const out = await voidOpenInvoices(id);
      let cards = 0;
      let cardsError = '';
      if (kind === 'ended_no_account') {
        try { cards = await removeSavedPaymentMethods(s.customerId); } catch (err) { cardsError = err instanceof Error ? err.message : String(err); }
      }
      if (!out.voided.length && !out.notVoided.length && !cards && !cardsError) continue;
      push({
        kind, userId: null, email: s.customerEmail, ref: id, done: !out.notVoided.length && !cardsError,
        detail: `Tidied after the ending: ${out.voided.length} invoice(s) voided${cards ? `, ${cards} saved payment method(s) removed` : ''}`,
        ...(out.notVoided.length || cardsError ? { error: out.notVoided[0]?.error ?? cardsError } : {}),
      });
    }
  }

  // 1. Charged twice: keep the dearer subscription (the one in use on a tie), cancel the rest.
  const liveByOwner = new Map<number, typeof subs>();
  for (const x of subs) {
    // An unpaid checkout (3D Secure abandoned, a decline) is not a second charge: it never paid.
    if (!x.owner || !LIVE.has(x.s.status) || x.s.status === 'incomplete' || x.s.cancelAt || skip(x.s.id)) continue;
    liveByOwner.set(x.owner.id, [...(liveByOwner.get(x.owner.id) ?? []), x]);
  }
  for (const group of Array.from(liveByOwner.values())) {
    if (group.length < 2) continue;
    const owner = group[0].owner!;
    const inUse = (x: (typeof group)[number]) => (x.s.id === owner.stripe_subscription_id ? 1 : 0);
    const ranked = [...group].sort((a, b) => b.s.monthly - a.s.monthly || inUse(b) - inUse(a) || a.s.startedAt.localeCompare(b.s.startedAt));
    const keep = ranked[0];
    if (keep.s.id !== owner.stripe_subscription_id) continue;   // left for a person: see the dashboard
    // The one to keep has a payment owed: cancelling the paid one beside it could leave the account
    // with neither. Left for a person too.
    if (isUnpaid(keep.s.status)) continue;
    for (const x of ranked.slice(1)) {
      // A paid start was charged at checkout and promised its 7-day refund: cancelled unrefunded, the
      // account would have paid for a plan it never gets. Left for a person to refund and cancel.
      if (x.s.paidStart && now - Date.parse(x.s.startedAt) <= REFUND_DAYS * DAY) continue;
      const a = await once(
        {
          kind: 'duplicate_cancelled', userId: owner.id, email: owner.email, ref: x.s.id,
          detail: `Kept ${keep.s.id} (${money(keep.s.monthly)}/mo, in use); cancelled ${x.s.id} (${money(x.s.monthly)}/mo). Not refunded.`,
        },
        async () => { await stripe.subscriptions.cancel(x.s.id); },
        dryRun,
      );
      if (a?.done) cancelled.add(x.s.id);
      push(a);
    }
  }

  // 2. A renewal that failed: tell the customer, once per unpaid invoice.
  for (const x of subs) {
    if (!x.owner || skip(x.s.id) || (x.s.status !== 'past_due' && x.s.status !== 'unpaid')) continue;
    if (x.s.id !== x.owner.stripe_subscription_id || !x.s.latestInvoiceId) continue;
    const invoice = await openInvoice(x.s.latestInvoiceId);
    if (!invoice || invoice.amountDue <= 0) continue;
    push(await notifyPaymentFailed({ id: x.owner.id, email: x.owner.email, plan: ownPlanFor(x.owner) }, invoice, dryRun));
  }

  // 3. Paid access whose subscription Stripe has ended (a cancellation the webhook missed).
  for (const acc of accounts) {
    if (isInternal(acc) || !acc.stripe_subscription_id) continue;
    // The plan this subscription was giving: ownPlanFor already reads Free once a cancelled period
    // has run out, which is when such a subscription ends, so the stored tier is read then.
    const own = ownPlanFor(acc);
    const plan: Plan = own !== 'free' ? own : (isPlan(acc.subscription_tier) ? acc.subscription_tier : 'free');
    if (plan === 'free') continue;
    const s = subById.get(acc.stripe_subscription_id);
    if (!s || !ENDED.has(s.status)) continue;   // not in Stripe at all: left for a person
    const moved = await once(
      {
        kind: 'downgraded', userId: acc.id, email: acc.email, ref: s.id,
        detail: `Stripe ended ${s.id}${s.endedAt ? ` on ${s.endedAt.slice(0, 10)}` : ''} (${s.cancelReason ?? 'no reason given'}); ${PLANS[plan].label} → Free`,
      },
      async () => {
        downgradeToFree(acc.id);
        syncDataApiTier(acc.id);
        recordActivation(acc.id, 'subscription_cancelled', null, { subscriptionId: s.id, reconciled: true });
      },
      dryRun,
    );
    if (!moved) {
      // Moved to Free for this subscription before, and linked to it again since: a Stripe event
      // from before it ended, delivered or retried late. Free again, every time; the log and the
      // customer already have it, so no second notice or email.
      const again: WatchAction = {
        kind: 'downgraded', userId: acc.id, email: acc.email, ref: s.id,
        detail: `Linked again to ${s.id}, which Stripe ended (a late event); ${PLANS[plan].label} → Free again`, done: false,
      };
      if (!dryRun) {
        downgradeToFree(acc.id);
        syncDataApiTier(acc.id);
        console.warn(`[billing-watch] account ${acc.id} was linked again to ended ${s.id}; moved to Free again`);
        again.done = true;
      }
      push(again);
      continue;
    }
    push(moved);
    if (s.cancelReason === 'payment_failed' && (dryRun || moved.done)) {
      push(await notifyCancelledUnpaid(acc, s.id, plan, dryRun));
    } else if (!s.refundRequestedAt && !skip(s.id) && cancelEmailsOn() && (dryRun || moved.done)
      && !!s.endedAt && now - Date.parse(s.endedAt) <= STILL_NEWS_MS) {
      // Reached its end some other way (the customer's cancellation, usually), and recently. One
      // ended by rules 9 and 10 or refunded has had its own email. The record is what the email is
      // owed on, should it not send now.
      if (!dryRun) withNotices(db => db.prepare('INSERT OR IGNORE INTO billing_notices (user_id, kind, ref, detail) VALUES (?, ?, ?, ?)')
        .run(acc.id, 'ended_cancelled', s.id, `${PLANS[plan].label} ended after its cancellation`));
      push(await notifySubscriptionEnded(acc, s.id, plan, dryRun));
    }
  }

  // 4. Legacy $4.99: twelve months from the account's first subscription, then the current Pro price.
  const proMonthly = priceIdFor('pro', 'monthly');
  const noticesOn = process.env.LEGACY_PRICE_CHANGE === 'on';
  const noticed = new Set(withNotices(db => db.prepare(`SELECT ref FROM billing_notices WHERE kind = 'legacy_price_notice'`).all() as Array<{ ref: string }>)
    .map(n => n.ref));
  const firstLegacy = new Map<number, string>();
  for (const x of subs) {
    if (!x.owner || x.s.plan !== 'legacy_pro') continue;
    const prev = firstLegacy.get(x.owner.id);
    if (!prev || x.s.startedAt < prev) firstLegacy.set(x.owner.id, x.s.startedAt);
  }
  for (const acc of accounts) {
    if (isInternal(acc) || ownPlanFor(acc) !== 'legacy_pro') continue;
    const current = acc.stripe_subscription_id ? subById.get(acc.stripe_subscription_id) : undefined;
    if (!current || !LIVE.has(current.status) || cancelled.has(current.id)) continue;
    const changeAt = current.priceChangeAt ? Date.parse(current.priceChangeAt) : NaN;

    // Already on the $12 price: the account becomes Pro once the first period at that price has begun.
    if (current.plan === 'pro') {
      if (Number.isNaN(changeAt) || !current.periodStart || Date.parse(current.periodStart) < changeAt - DAY) continue;
      push(await once(
        { kind: 'legacy_now_pro', userId: acc.id, email: acc.email, ref: current.id, detail: `First $12 period began ${current.periodStart.slice(0, 10)}; account moved to Pro` },
        async () => { moveLegacyToPro(acc.id); syncDataApiTier(acc.id); },
        dryRun,
      ));
      continue;
    }
    // One that is ending is not renewed at any price; if it is renewed later, it is picked up then.
    const first = firstLegacy.get(acc.id);
    if (!first || current.plan !== 'legacy_pro' || current.cancelAt || !current.periodEnd) continue;
    const mark = addYear(first);
    const markAt = Date.parse(mark);

    // The email: from 37 days before the mark, naming the first renewal that is on or after the
    // mark and at least 30 days away. A renewal that begins inside the twelve months stays $4.99.
    if (!noticed.has(current.id)) {
      if (now < markAt - NOTICE_LEAD_MS || current.interval !== 'month' || !current.billingAnchor) continue;
      if (!noticesOn && !dryRun) continue;
      const changes = renewalOnOrAfter(current.periodEnd, current.billingAnchor, Math.max(markAt, now + NOTICE_MS));
      push(await once(
        {
          kind: 'legacy_price_notice', userId: acc.id, email: acc.email, ref: current.id,
          detail: `12 months from ${first.slice(0, 10)} reach ${mark.slice(0, 10)}; $12 from the renewal on ${changes.slice(0, 10)}; emailed${noticesOn ? '' : ' once LEGACY_PRICE_CHANGE=on'}`,
        },
        async () => {
          // Stripe keeps the date the email names, for the switch below and for anyone reading the subscription.
          await stripe.subscriptions.update(current.id, { metadata: { asl_price_change_at: changes } });
          return sendLegacyPriceChangeEmail(acc.email, { started: longDate(first), changes: longDate(changes), cancelUrl: cancelLink(acc.id, current.id) });
        },
        dryRun,
      ));
      continue;
    }

    // The switch: in the last two days before that renewal. No proration, so the period already
    // paid for stays at $4.99 and the renewal charges $12.
    const periodEnd = Date.parse(current.periodEnd);
    if (!proMonthly || !current.itemId || Number.isNaN(changeAt) || periodEnd < changeAt - DAY || now < periodEnd - SWITCH_LEAD_MS) continue;
    push(await once(
      { kind: 'legacy_price_changed', userId: acc.id, email: acc.email, ref: current.id, detail: `${current.id} moved to the $12 Pro price; the renewal on ${current.periodEnd.slice(0, 10)} charges $12` },
      async () => {
        // The Pro price carries a 7-day trial for new checkouts; a switch must not start one.
        await stripe.subscriptions.update(current.id, {
          items: [{ id: current.itemId!, price: proMonthly }],
          proration_behavior: 'none',
          trial_from_plan: false,
        });
      },
      dryRun,
    ));
  }

  // 5. Cancel and refund asked for in time but not finished (a step failed): finish it. Stripe's
  // side is idempotent, so a refund already made is not made again; once it is recorded, only
  // the customer's email is left to retry.
  for (const x of subs) {
    const s = x.s;
    if (!s.refundRequestedAt || !s.metaUserId) continue;
    const owner = byId.get(s.metaUserId);
    if (!owner || isInternal(owner)) continue;
    const refunded = hasNotice('refunded_in_window', s.id);
    if (refunded && hasNotice('refund_confirmed', s.id)) continue;
    const a: WatchAction = {
      kind: refunded ? 'refund_confirmed' : 'refunded_in_window', userId: owner.id, email: owner.email, ref: s.id,
      detail: refunded
        ? 'Refunded and ended; the plan-change credit or the refund email still to do; finishing them'
        : `Refund asked for ${s.refundRequestedAt.slice(0, 16).replace('T', ' ')}Z and not finished; finishing it`,
      done: false,
    };
    if (dryRun) { push(a); continue; }
    try {
      const out = await finishRefund(owner.id, s.id);
      push({ ...a, done: refunded ? out.emailed === true : true, ...(refunded && out.emailed === false ? { error: 'not sent' } : {}) });
    } catch (err) {
      push({ ...a, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // 6. A paid subscription the account does not have yet, or never confirmed (its webhook events
  // were missed): grant the plan and send the confirmation. Only while it is new; never one the
  // duplicate rule has just cancelled, nor over another live subscription the account uses.
  for (const x of subs) {
    const s = x.s;
    if (!s.paidStart || s.status !== 'active' || s.cancelAt || !s.metaUserId || cancelled.has(s.id)) continue;
    if (now - Date.parse(s.startedAt) > REFUND_DAYS * DAY) continue;
    const owner = byId.get(s.metaUserId);
    if (!owner || isInternal(owner)) continue;
    const linked = owner.stripe_subscription_id === s.id;
    if (linked && hasNotice('purchase_confirmed', s.id)) continue;
    const other = !linked && owner.stripe_subscription_id ? subById.get(owner.stripe_subscription_id) : undefined;
    if (other && LIVE.has(other.status) && other.status !== 'incomplete' && !other.cancelAt) continue;   // a duplicate: rule 1 / a person
    if (dryRun) {
      push({
        kind: linked ? 'purchase_confirmed' : 'granted_late', userId: owner.id, email: owner.email, ref: s.id,
        detail: linked ? 'Paid subscription never confirmed; emailing the confirmation' : `Paid ${s.plan ?? 'plan'} subscription not on the account; granting it`,
        done: false,
      });
      continue;
    }
    try {
      const res = await activatePaidStart(owner.id, await stripe.subscriptions.retrieve(s.id));
      if (res.granted) {
        push(await once(
          { kind: 'granted_late', userId: owner.id, email: owner.email, ref: s.id, detail: `${PLANS[(s.plan ?? 'pro') as Plan]?.label ?? s.plan} granted by the watch: its paid subscription's webhook events never arrived` },
          async () => {},
          false,
        ));
      }
      if (res.emailed !== null) {
        push({ kind: 'purchase_confirmed', userId: owner.id, email: owner.email, ref: s.id, detail: 'Emailed the subscription confirmation', done: res.emailed, ...(res.emailed ? {} : { error: 'not sent' }) });
      }
    } catch (err) {
      push({ kind: 'granted_late', userId: owner.id, email: owner.email, ref: s.id, detail: 'Could not activate the paid subscription', done: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // 7. A plan change still unpaid after 24 hours: void its invoice, so Stripe discards the change
  // and nothing more is collected for it. The plan never changed, so the account stays as it is.
  for (const x of subs) {
    const s = x.s;
    if (!s.pendingUpdate || !s.latestInvoiceId || !x.owner || ENDED.has(s.status)) continue;
    let inv: Stripe.Invoice;
    try {
      inv = await stripe.invoices.retrieve(s.latestInvoiceId);
    } catch {
      continue;
    }
    if (inv.status !== 'open' || inv.billing_reason !== 'subscription_update' || !inv.id || now - inv.created * 1000 < DAY) continue;
    const to = s.pendingUpdate.plan ? PLANS[s.pendingUpdate.plan].label : 'another plan';
    push(await once(
      {
        kind: 'upgrade_voided', userId: x.owner.id, email: x.owner.email, ref: inv.id,
        detail: `Change of ${s.id} to ${to} unpaid for 24 hours: invoice ${inv.id} (${money(inv.amount_due ?? 0)}) voided; the plan stays as it was`,
      },
      async () => { await stripe.invoices.voidInvoice(inv.id!); },
      dryRun,
    ));
  }

  return { at: new Date().toISOString(), dryRun, actions };
}

/** What the cancel link in a price-change email can still do, for app/billing/cancel. */
export type CancelLinkState =
  | { state: 'invalid' }
  | { state: 'ended' }
  | { state: 'ending'; endsAt: string | null }
  | { state: 'live'; amount: string; periodEnd: string | null };

function linkState(s: Stripe.Subscription): CancelLinkState {
  if (ENDED.has(s.status)) return { state: 'ended' };
  const raw = s as any;
  const item = s.items?.data?.[0];
  const periodEnd = isoOf(item?.current_period_end ?? raw.current_period_end);
  if (raw.cancel_at || raw.cancel_at_period_end) return { state: 'ending', endsAt: isoOf(raw.cancel_at) ?? periodEnd };
  return { state: 'live', amount: money((item?.price?.unit_amount ?? 0) * (item?.quantity ?? 1)), periodEnd };
}

/** The subscription a link names, when it belongs to the account the link was signed for. */
async function linkedSubscription(userId: number, subscriptionId: string) {
  const acc = findUserById(userId);
  if (!acc) return null;
  try {
    const s = await stripe.subscriptions.retrieve(subscriptionId);
    const customer = typeof s.customer === 'string' ? s.customer : s.customer.id;
    return s.metadata?.userId === String(userId) || customer === acc.stripe_customer_id ? { acc, s } : null;
  } catch {
    return null;
  }
}

/**
 * The page behind a cancel link. Opening it changes nothing. The preview subscription shows the
 * page to us (demo account only) and, after its button, what a customer would see.
 */
export async function cancelLinkState(userId: number, subscriptionId: string, afterCancel = false): Promise<CancelLinkState> {
  if (subscriptionId === PREVIEW_SUBSCRIPTION) {
    if (userId !== DEMO_ACCOUNT_ID) return { state: 'invalid' };
    const end = new Date(Date.now() + 9 * DAY).toISOString();
    return afterCancel ? { state: 'ending', endsAt: end } : { state: 'live', amount: '$4.99', periodEnd: end };
  }
  const found = await linkedSubscription(userId, subscriptionId);
  return found ? linkState(found.s) : { state: 'invalid' };
}

/** The cancel link's button: the subscription ends at the close of the period already paid for. */
export async function cancelFromLink(userId: number, subscriptionId: string): Promise<CancelLinkState> {
  if (subscriptionId === PREVIEW_SUBSCRIPTION) return cancelLinkState(userId, subscriptionId, true);
  const found = await linkedSubscription(userId, subscriptionId);
  if (!found) return { state: 'invalid' };
  const before = linkState(found.s);
  if (before.state !== 'live') return before;
  const after = linkState(await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
    metadata: { asl_end_reason: 'declined_price_change' },
  }));
  const endsAt = after.state === 'ending' ? after.endsAt : before.periodEnd;
  // The webhook records this too; doing it here shows it on the account at once.
  if (found.acc.stripe_subscription_id === subscriptionId) cancelSubscription(userId, endsAt);
  withNotices(db => db.prepare('INSERT OR IGNORE INTO billing_notices (user_id, kind, ref, detail) VALUES (?, ?, ?, ?)')
    .run(userId, 'cancelled_from_email', subscriptionId, `Customer cancelled from the price-change email; ends ${endsAt ? endsAt.slice(0, 10) : 'at the period end'}`));
  return after;
}
