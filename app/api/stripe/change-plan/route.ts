import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/auth';
import { findUserById, type User } from '@/lib/db-client';
import { recordActivation } from '@/lib/activation';
import { PLANS } from '@/lib/entitlements';
import { isSellablePlan, isInterval, priceIdFor, type Interval, type SellablePlan } from '@/lib/stripe-plans';
import { sameOrigin } from '@/lib/same-origin';
import { refundRequested } from '@/lib/paid-start';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

// Per account and acting on live billing state: never prerendered or cached.
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
/** A preview's proration date is honoured this long, so the charge is the amount the customer saw. */
const PRORATION_WINDOW_S = 15 * 60;

/**
 * Move an existing subscriber between plans, paid at once (an upgrade has no trial period: it is
 * charged directly).
 *
 * WHY THIS IS NOT CHECKOUT
 * ------------------------
 * The billing page's "Switch" link used to point at
 * `/api/stripe/checkout?plan=…`, which calls `checkout.sessions.create` in
 * subscription mode. For someone who already subscribes that does not replace
 * anything — Stripe happily opens a *second* subscription alongside the first,
 * and the customer is billed for both. It got worse afterwards: when the
 * abandoned subscription was eventually cancelled, `customer.subscription.deleted`
 * downgraded the account to free while the new, more expensive plan was still
 * being paid for.
 *
 * A plan change is an update to the existing subscription's line item.
 *
 * WHY IT IS CHARGED NOW
 * ---------------------
 * Until 2026-11-13 the update used `create_prorations`: the new plan applied at once and the
 * difference waited for the next invoice, up to a year away for an annual plan. Now:
 *  - GET previews the charge (`invoices.createPreview`, the same proration date), for the
 *    billing page's confirmation;
 *  - POST invoices the difference immediately (`always_invoice`) with
 *    `payment_behavior: 'pending_if_incomplete'`: the change applies only once that invoice is
 *    paid. If the card declines or needs 3D Secure, Stripe keeps the change pending and the
 *    customer pays on Stripe's hosted invoice page (402 + payUrl); until then the plan stays as
 *    it is. Stripe drops an unpaid change after about a day, and the billing watch (rule 7)
 *    voids one still open after 24 hours;
 *  - a trialing subscription that changes plan ends its trial (`trial_end: 'now'`) and pays
 *    the new plan now: otherwise a trial could move to Teams and fail at trial end.
 * Only active and trialing subscriptions can change plan: a past-due one has an unpaid invoice,
 * and a proration would credit time that was never paid for. Nor can one whose Cancel and refund
 * has been asked for (lib/paid-start.ts).
 *
 * A move to a cheaper plan invoices a negative total: Stripe puts the unused part of the dearer
 * plan on the customer's credit balance, which pays their next invoices. If the account then uses
 * Cancel and refund inside its 7 days, every payment comes back in cash and finishRefund takes
 * that credit back too.
 *
 * Customers with no subscription are sent to checkout instead — there is nothing
 * to update, and creating one there is correct.
 */

type Resolved =
  | { error: NextResponse }
  | { unchanged: true }
  | {
      user: User; sub: Stripe.Subscription; item: Stripe.SubscriptionItem;
      plan: SellablePlan; interval: Interval; priceId: string; trialing: boolean;
    };

async function resolveChange(userId: number, rawPlan: unknown, rawInterval: unknown): Promise<Resolved> {
  const fail = (status: number, body: Record<string, unknown>) =>
    ({ error: NextResponse.json({ success: false, ...body }, { status, headers: NO_STORE }) });
  if (!isSellablePlan(rawPlan)) return fail(400, { error: 'Unknown plan' });
  const interval = rawInterval ?? 'annual';
  if (!isInterval(interval)) return fail(400, { error: 'Unknown interval' });
  const plan = rawPlan;

  const priceId = priceIdFor(plan, interval);
  if (!priceId) return fail(400, { error: 'plan_unavailable', message: 'That plan is not open for sign-up yet.' });

  const user = findUserById(userId);
  if (!user?.stripe_subscription_id) {
    // Nothing to change — the caller should start a fresh checkout.
    return fail(409, { error: 'no_subscription', checkoutUrl: `/api/stripe/checkout?plan=${plan}&interval=${interval}` });
  }

  const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
  // Cancel and refund has been asked for (lib/paid-start.ts): the plan is ending, and a change now
  // would charge a card that is being refunded.
  if (refundRequested(sub)) {
    return fail(409, { error: 'refund_pending', message: 'Your refund is being finished and this plan is ending, so it cannot be changed. You can choose a new plan once the refund is done.' });
  }
  const item = sub.items.data[0];
  if (!item) return fail(409, { error: 'Subscription has no billable item' });
  if (item.price.id === priceId) return { unchanged: true };
  if (sub.status !== 'active' && sub.status !== 'trialing') {
    return fail(409, {
      error: 'not_switchable',
      message: 'Your last payment has not gone through yet. Update your payment method with Manage billing first; then you can change plan.',
    });
  }
  return { user, sub, item, plan, interval, priceId, trialing: sub.status === 'trialing' };
}

const customerOf = (sub: Stripe.Subscription) => (typeof sub.customer === 'string' ? sub.customer : sub.customer.id);

/** GET ?plan&interval — what switching costs today, for the confirmation. */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    }
    const q = request.nextUrl.searchParams;
    const r = await resolveChange(Number(session.user.id), q.get('plan'), q.get('interval') ?? 'annual');
    if ('error' in r) return r.error;
    if ('unchanged' in r) return NextResponse.json({ success: true, data: { unchanged: true } }, { headers: NO_STORE });

    const prorationDate = Math.floor(Date.now() / 1000);
    const preview = await stripe.invoices.createPreview({
      customer: customerOf(r.sub),
      subscription: r.sub.id,
      subscription_details: {
        items: [{ id: r.item.id, price: r.priceId }],
        proration_behavior: 'always_invoice',
        proration_date: prorationDate,
        ...(r.trialing ? { trial_end: 'now' as const } : {}),
      },
    });
    return NextResponse.json({
      success: true,
      data: {
        plan: r.plan, interval: r.interval, planLabel: PLANS[r.plan].label,
        amountDueCents: preview.amount_due, totalCents: preview.total, currency: preview.currency,
        prorationDate, endsTrial: r.trialing,
      },
    }, { headers: NO_STORE });
  } catch (error: any) {
    console.error('[stripe] plan change preview failed:', error?.message ?? error);
    return NextResponse.json({ success: false, error: 'Could not price the change' }, { status: 500, headers: NO_STORE });
  }
}

/** The hosted page for an invoice, where the customer can pay (3D Secure, another card). */
async function payUrlOf(invoice: unknown): Promise<string | null> {
  if (invoice && typeof invoice === 'object') return (invoice as Stripe.Invoice).hosted_invoice_url ?? null;
  if (typeof invoice !== 'string') return null;
  try { return (await stripe.invoices.retrieve(invoice)).hosted_invoice_url ?? null; } catch { return null; }
}

/** POST { plan, interval, prorationDate } — change plan now, paid now. */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    }
    // A plan change charges the card: only our own billing page may ask for one.
    if (!sameOrigin(request)) return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403, headers: NO_STORE });

    const body = await request.json().catch(() => ({}));
    const r = await resolveChange(Number(session.user.id), body.plan, body.interval ?? 'annual');
    if ('error' in r) return r.error;
    if ('unchanged' in r) return NextResponse.json({ success: true, data: { unchanged: true } }, { headers: NO_STORE });
    const { user, sub, item, plan, interval, priceId, trialing } = r;

    // The previewed proration date, while fresh, so the charge is the amount that was shown.
    const now = Math.floor(Date.now() / 1000);
    const asked = Number(body.prorationDate);
    let prorationDate = Number.isInteger(asked) && asked <= now && asked >= now - PRORATION_WINDOW_S ? asked : now;
    if (prorationDate < (item.current_period_start ?? 0)) prorationDate = now;

    const params: Stripe.SubscriptionUpdateParams = {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: 'always_invoice',
      payment_behavior: 'pending_if_incomplete',
      proration_date: prorationDate,
      ...(trialing ? { trial_end: 'now' as const } : {}),
      // Keep our own metadata current so the webhook's fallback path — used when
      // a Price cannot be mapped — does not resolve to a stale plan.
      metadata: { ...(sub.metadata ?? {}), userId: String(user.id), plan, interval },
      expand: ['latest_invoice'],
    };
    let updated: Stripe.Subscription;
    try {
      updated = await stripe.subscriptions.update(sub.id, params);
    } catch (err: any) {
      // A decline should leave a pending update rather than throw; if Stripe threw anyway, look.
      if (err?.type !== 'StripeCardError') throw err;
      updated = await stripe.subscriptions.retrieve(sub.id, { expand: ['latest_invoice'] });
      if (!updated.pending_update) {
        return NextResponse.json({ success: false, error: 'payment_failed', message: err?.message ?? 'Your card was declined.' }, { status: 402, headers: NO_STORE });
      }
    }

    if (updated.pending_update) {
      // Not paid yet (a decline, or 3D Secure): the plan stays as it is until the invoice is paid,
      // and Stripe drops the change unpaid at pending_update.expires_at (about 23 hours).
      const payUrl = await payUrlOf(updated.latest_invoice);
      const expires = updated.pending_update.expires_at;
      const payBy = typeof expires === 'number' && expires > 0 ? new Date(expires * 1000).toISOString() : null;
      recordActivation(user.id, 'checkout_started', plan, { interval, change: true, pending: true, ...(trialing ? { endsTrial: true } : {}) });
      console.warn(`[stripe] user ${user.id}: change to ${plan}/${interval} waits for payment (${sub.id})`);
      return NextResponse.json({ success: false, error: 'payment_required', payUrl, payBy }, { status: 402, headers: NO_STORE });
    }

    // What this change charged: the invoice it created, if any.
    const inv = updated.latest_invoice && typeof updated.latest_invoice === 'object' ? updated.latest_invoice as Stripe.Invoice : null;
    const before = typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice?.id;
    const paidCents = inv && inv.id !== before && inv.status === 'paid' ? inv.amount_paid ?? 0 : 0;
    recordActivation(user.id, 'checkout_started', plan, { interval, change: true, paidCents, ...(trialing ? { endsTrial: true } : {}) });
    console.log(`[stripe] user ${user.id} moved to ${plan}/${interval} (${updated.id}), charged ${paidCents}`);

    // The tier itself is written by `customer.subscription.updated`, which fires
    // from this call. Reporting success here is about the request, not the grant.
    return NextResponse.json({ success: true, data: { plan, interval, subscriptionId: updated.id, paidCents } }, { headers: NO_STORE });
  } catch (error: any) {
    console.error('[stripe] plan change failed:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Could not change your plan' },
      { status: 500, headers: NO_STORE }
    );
  }
}
