import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/auth';
import { findUserById } from '@/lib/db-client';
import { stayCouponFor } from '@/lib/stay-offer';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

export const dynamic = 'force-dynamic';

const ENDED: ReadonlySet<string> = new Set(['canceled', 'incomplete_expired']);

/**
 * Cancel subscription (the billing page's button): opens Stripe's cancel page for the account's
 * subscription and comes back to the billing page afterwards.
 *
 * An account that qualifies is first shown the stay offer there (lib/stay-offer.ts): a discount
 * to accept, or decline and cancel. If Stripe will not open the page with the offer, it is opened
 * without it: the way to cancel must never depend on the offer. A subscription that has ended or
 * is already set to end opens the whole portal instead, which shows where it stands and lets the
 * customer resume it.
 */
export async function GET() {
  const app = process.env.NEXT_PUBLIC_APP_URL;
  const back = `${app}/account/billing`;
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.redirect(`${app}/auth/signin`);

    const user = findUserById(parseInt(session.user.id));
    if (!user) return NextResponse.redirect(`${back}?error=user_not_found`);
    if (!user.stripe_customer_id || !user.stripe_subscription_id) return NextResponse.redirect(`${back}?error=no_subscription`);

    const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
    const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    if (customer !== user.stripe_customer_id) return NextResponse.redirect(`${back}?error=no_subscription`);

    const raw = sub as any;
    if (ENDED.has(sub.status) || raw.cancel_at || raw.cancel_at_period_end) {
      const portal = await stripe.billingPortal.sessions.create({ customer, return_url: back });
      return NextResponse.redirect(portal.url);
    }

    const open = (coupon: string | null) => stripe.billingPortal.sessions.create({
      customer,
      return_url: back,
      flow_data: {
        type: 'subscription_cancel',
        subscription_cancel: {
          subscription: sub.id,
          ...(coupon ? { retention: { type: 'coupon_offer' as const, coupon_offer: { coupon } } } : {}),
        },
        after_completion: { type: 'redirect', redirect: { return_url: back } },
      },
    });

    const coupon = stayCouponFor(user.id, sub);
    let portal: Stripe.BillingPortal.Session;
    try {
      portal = await open(coupon);
    } catch (err) {
      if (!coupon) throw err;
      console.warn(`[stripe/cancel] the cancel page would not open with the stay offer for user ${user.id}; opening it without:`, err instanceof Error ? err.message : err);
      portal = await open(null);
    }
    return NextResponse.redirect(portal.url);
  } catch (error: any) {
    console.error('[stripe/cancel] Error:', error?.message || error);
    return NextResponse.redirect(`${back}?error=portal_failed`);
  }
}
