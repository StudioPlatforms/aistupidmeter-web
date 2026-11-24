/**
 * The stay offer: a discount shown when a customer starts to cancel.
 *
 * Cancel subscription on the billing page opens Stripe's own cancel page (a billing portal
 * session opened on its cancel flow). When the account qualifies, the session carries a retention
 * coupon, so the page first offers the discount: accepting applies the coupon to the
 * subscription and keeps it, declining goes on to cancel as usual. Nothing about cancelling is
 * hidden or slowed: the offer is one screen with both choices, and Manage billing still opens the
 * whole portal.
 *
 * Offered once per account, and only where it means something:
 *  - the subscription is running (active or in a trial) and not already set to end;
 *  - it carries no discount already;
 *  - the account has not taken a stay offer before (the webhook records it when the coupon lands
 *    on the subscription: billing_notices `stay_offer_accepted`).
 * A subscription with a payment owed gets no offer: cancelling that one ends it at once
 * (lib/billing-end.ts).
 *
 * The coupons live in Stripe. A monthly subscription is offered STAY30-3M (30% off for three
 * months); a yearly one STAY30-1Y (30% off the next year), since a three-month coupon would run
 * out before a yearly renewal comes. Either id can be replaced from the environment.
 */
import Stripe from 'stripe';
import { withNotices } from '@/lib/billing-notices';

export const STAY_COUPONS = {
  month: process.env.STRIPE_COUPON_STAY_MONTHLY || 'STAY30-3M',
  year: process.env.STRIPE_COUPON_STAY_ANNUAL || 'STAY30-1Y',
} as const;

export const isStayCoupon = (id: string | null | undefined): boolean =>
  !!id && (id === STAY_COUPONS.month || id === STAY_COUPONS.year);

/** Whether the account has already taken a stay offer. */
export function stayOfferTaken(userId: number): boolean {
  return withNotices(db => !!db.prepare(`SELECT 1 FROM billing_notices WHERE kind = 'stay_offer_accepted' AND user_id = ?`).get(userId));
}

/** The coupon to offer this account on this subscription's cancel page, or null for none. */
export function stayCouponFor(userId: number, sub: Stripe.Subscription): string | null {
  const raw = sub as any;
  if (sub.status !== 'active' && sub.status !== 'trialing') return null;
  if (raw.cancel_at || raw.cancel_at_period_end) return null;
  if (sub.metadata?.asl_refund_requested_at) return null;
  if (Array.isArray(raw.discounts) ? raw.discounts.length > 0 : !!raw.discount) return null;
  if (stayOfferTaken(userId)) return null;
  const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
  return interval === 'year' ? STAY_COUPONS.year : interval === 'month' ? STAY_COUPONS.month : null;
}

/** The coupon id behind one expanded discount (null for an id that was not expanded). */
export function couponIdOf(discount: unknown): string | null {
  if (!discount || typeof discount !== 'object') return null;
  const d = discount as { source?: { coupon?: unknown }; coupon?: unknown };
  const c = d.source?.coupon ?? d.coupon;
  if (typeof c === 'string') return c;
  const id = c && typeof c === 'object' ? (c as { id?: unknown }).id : null;
  return typeof id === 'string' ? id : null;
}

/** The stay coupon among a subscription's discounts (read with `expand: ['discounts']`), if any. */
export function stayCouponOn(sub: Stripe.Subscription): string | null {
  const list = (sub as any).discounts;
  if (!Array.isArray(list)) return null;
  for (const d of list) {
    const id = couponIdOf(d);
    if (isStayCoupon(id)) return id;
  }
  return null;
}
