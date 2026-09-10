import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/auth';
import { findUserById } from '@/lib/db-client';
import { recordActivation } from '@/lib/activation';
import { isSellablePlan, isInterval, priceIdFor } from '@/lib/stripe-plans';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

/**
 * Move an existing subscriber between plans.
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
 * `create_prorations` credits the unused remainder of the old plan against the
 * new one, which is what a customer expects when they upgrade mid-month.
 *
 * Customers with no subscription are sent to checkout instead — there is nothing
 * to update, and creating one there is correct.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const plan = body.plan;
    const interval = body.interval ?? 'annual';

    if (!isSellablePlan(plan)) {
      return NextResponse.json({ success: false, error: 'Unknown plan' }, { status: 400 });
    }
    if (!isInterval(interval)) {
      return NextResponse.json({ success: false, error: 'Unknown interval' }, { status: 400 });
    }

    const priceId = priceIdFor(plan, interval);
    if (!priceId) {
      return NextResponse.json(
        { success: false, error: 'plan_unavailable', message: 'That plan is not open for sign-up yet.' },
        { status: 400 }
      );
    }

    const user = findUserById(Number(session.user.id));
    if (!user?.stripe_subscription_id) {
      // Nothing to change — the caller should start a fresh checkout.
      return NextResponse.json(
        { success: false, error: 'no_subscription', checkoutUrl: `/api/stripe/checkout?plan=${plan}&interval=${interval}` },
        { status: 409 }
      );
    }

    const current = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
    const item = current.items.data[0];
    if (!item) {
      return NextResponse.json({ success: false, error: 'Subscription has no billable item' }, { status: 409 });
    }

    if (item.price.id === priceId) {
      return NextResponse.json({ success: true, data: { unchanged: true } });
    }

    const updated = await stripe.subscriptions.update(user.stripe_subscription_id, {
      items: [{ id: item.id, price: priceId }],
      // Credit the unused portion of the old plan against the new one.
      proration_behavior: 'create_prorations',
      // Keep our own metadata current so the webhook's fallback path — used when
      // a Price cannot be mapped — does not resolve to a stale plan.
      metadata: { ...(current.metadata ?? {}), userId: String(user.id), plan, interval },
    });

    recordActivation(user.id, 'checkout_started', plan, { interval, change: true });
    console.log(`[stripe] user ${user.id} moved to ${plan}/${interval} (${updated.id})`);

    // The tier itself is written by `customer.subscription.updated`, which fires
    // from this call. Reporting success here is about the request, not the grant.
    return NextResponse.json({ success: true, data: { plan, interval, subscriptionId: updated.id } });
  } catch (error: any) {
    console.error('[stripe] plan change failed:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Could not change your plan' },
      { status: 500 }
    );
  }
}
