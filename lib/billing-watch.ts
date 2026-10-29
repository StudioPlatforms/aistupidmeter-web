/**
 * Billing watch: keeps every account in step with what its owner actually pays, and tells the
 * customer when that changes. The owner's rules (2026-10-22):
 *
 *  - Charged twice. An account with two live subscriptions keeps the dearer one (the one in use
 *    when they cost the same) and the other is cancelled at once. Nothing is refunded
 *    automatically, and there is no email. When the dearer one is not the one the account
 *    uses, nothing is done: the admin dashboard shows it for a person to sort out.
 *  - A renewal that fails. The customer is emailed, once per unpaid invoice, that the
 *    subscription will be cancelled if the payment keeps failing. Stripe retries, then cancels.
 *  - A subscription that ends unpaid. The account moves to Free and the customer is emailed that
 *    there is a problem with their billing. The webhook does this as it happens; the watch
 *    catches any cancellation the webhook missed (account 168 kept its plan unpaid for three
 *    and a half months that way).
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
 *
 * The API worker calls POST /api/internal/billing-watch every six hours. Every action and
 * email is recorded in billing_notices, one per kind and Stripe object, so a rerun never
 * repeats one; an email that fails to send is not recorded and is tried again next run.
 */
import Stripe from 'stripe';
import { openIdentityDb } from '@/lib/identity-db';
import { PLANS, ownPlanFor, type Plan } from '@/lib/entitlements';
import { cancelSubscription, downgradeToFree, findUserById, moveLegacyToPro } from '@/lib/db-client';
import { syncDataApiTier } from '@/lib/data-api-tier';
import { recordActivation } from '@/lib/activation';
import { stripeSnapshot, type StripeSubscriptionRecord } from '@/lib/admin-stripe';
import { priceIdFor } from '@/lib/stripe-plans';
import { PREVIEW_SUBSCRIPTION, cancelLink } from '@/lib/cancel-link';
import { sendLegacyPriceChangeEmail, sendPaymentFailedEmail, sendSubscriptionCancelledUnpaidEmail } from '@/lib/email-service';

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

export type NoticeKind =
  | 'duplicate_cancelled' | 'payment_failed' | 'downgraded' | 'cancelled_unpaid'
  | 'legacy_price_notice' | 'legacy_price_changed' | 'legacy_now_pro' | 'cancelled_from_email'
  // Before 2026-10-29 a $4.99 subscription ended at 12 months; these remain in the log.
  | 'legacy_end_scheduled' | 'legacy_ended' | 'legacy_end_reverted';

export interface WatchAction {
  kind: NoticeKind;
  userId: number | null;
  email: string | null;
  /** The Stripe object it is about (a subscription or invoice id), or user:<id> for per-account notices. */
  ref: string;
  detail: string;
  done: boolean;
  error?: string;
}

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

const isInternal = (a: { id: number; role?: string | null }) => INTERNAL_ROLES.has(a.role ?? '') || a.id === DEMO_ACCOUNT_ID;

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

function withNotices<T>(fn: (db: ReturnType<typeof openIdentityDb>) => T): T {
  const db = openIdentityDb();
  try {
    // user_id cascades with the account, so account deletion removes these with everything else.
    db.exec(`
      CREATE TABLE IF NOT EXISTS billing_notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES router_users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        ref TEXT NOT NULL,
        detail TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE (kind, ref)
      )
    `);
    return fn(db);
  } finally {
    db.close();
  }
}

/** The most recent notices, newest first, for the admin dashboard. */
export function recentNotices(limit = 40): Array<{ createdAt: string; kind: NoticeKind; userId: number | null; ref: string; detail: string | null }> {
  return withNotices(db => db.prepare(`
    SELECT created_at AS createdAt, kind, user_id AS userId, ref, detail
      FROM billing_notices ORDER BY id DESC LIMIT ?
  `).all(limit) as Array<{ createdAt: string; kind: NoticeKind; userId: number | null; ref: string; detail: string | null }>);
}

type Outcome = void | { success: boolean; error?: string };

/**
 * Do something once per (kind, ref): skipped when already recorded, only described when dry,
 * and recorded only when it worked (an email that did not send is tried again next run).
 */
async function once(a: Omit<WatchAction, 'done'>, run: () => Promise<Outcome>, dryRun: boolean): Promise<WatchAction | null> {
  const done = withNotices(db => !!db.prepare('SELECT 1 FROM billing_notices WHERE kind = ? AND ref = ?').get(a.kind, a.ref));
  if (done) return null;
  if (dryRun) return { ...a, done: false };
  try {
    const out = await run();
    if (out && !out.success) return { ...a, done: false, error: out.error || 'not sent' };
    withNotices(db => db.prepare('INSERT OR IGNORE INTO billing_notices (user_id, kind, ref, detail) VALUES (?, ?, ?, ?)')
      .run(a.userId, a.kind, a.ref, a.detail));
    return { ...a, done: true };
  } catch (err) {
    return { ...a, done: false, error: err instanceof Error ? err.message : String(err) };
  }
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

  // 1. Charged twice: keep the dearer subscription (the one in use on a tie), cancel the rest.
  const liveByOwner = new Map<number, typeof subs>();
  for (const x of subs) {
    if (!x.owner || !LIVE.has(x.s.status) || x.s.cancelAt) continue;
    liveByOwner.set(x.owner.id, [...(liveByOwner.get(x.owner.id) ?? []), x]);
  }
  const cancelled = new Set<string>();
  for (const group of Array.from(liveByOwner.values())) {
    if (group.length < 2) continue;
    const owner = group[0].owner!;
    const inUse = (x: (typeof group)[number]) => (x.s.id === owner.stripe_subscription_id ? 1 : 0);
    const ranked = [...group].sort((a, b) => b.s.monthly - a.s.monthly || inUse(b) - inUse(a) || a.s.startedAt.localeCompare(b.s.startedAt));
    const keep = ranked[0];
    if (keep.s.id !== owner.stripe_subscription_id) continue;   // left for a person: see the dashboard
    for (const x of ranked.slice(1)) {
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
    if (!x.owner || (x.s.status !== 'past_due' && x.s.status !== 'unpaid')) continue;
    if (x.s.id !== x.owner.stripe_subscription_id || !x.s.latestInvoiceId) continue;
    const invoice = await openInvoice(x.s.latestInvoiceId);
    if (!invoice || invoice.amountDue <= 0) continue;
    push(await notifyPaymentFailed({ id: x.owner.id, email: x.owner.email, plan: ownPlanFor(x.owner) }, invoice, dryRun));
  }

  // 3. Paid access whose subscription Stripe has ended (a cancellation the webhook missed).
  for (const acc of accounts) {
    if (isInternal(acc) || !acc.stripe_subscription_id) continue;
    const plan = ownPlanFor(acc);
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
    push(moved);
    if (s.cancelReason === 'payment_failed' && (dryRun || moved?.done)) {
      push(await notifyCancelledUnpaid(acc, s.id, plan, dryRun));
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
