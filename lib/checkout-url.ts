/**
 * Where an upgrade button should send someone.
 *
 * WHY THIS EXISTS
 * ---------------
 * Five upgrade CTAs used to do `window.location.href = '/api/stripe/checkout'`
 * with no parameters. The checkout route defaults a missing plan to
 * `pro/monthly`, so every one of those buttons sold the cheapest plan —
 * including four that displayed the Developer price of $19 on the same screen.
 * A button that shows one price and charges another is the single worst bug a
 * pricing surface can have, and it was reachable from the router dashboard, the
 * intelligence panel, the analytics panel and every locked page.
 *
 * There is no zero-argument form here on purpose. To link to checkout you must
 * name the plan and the interval, which makes the display-vs-charge mismatch a
 * type error rather than a silent default.
 */
import type { Plan } from '@/lib/entitlements';
import type { Interval, SellablePlan } from '@/lib/stripe-plans';

export type { Interval };

/**
 * Checkout link for a plan a customer can actually buy through Stripe.
 *
 * Free and Enterprise are not sellable: Free needs an account rather than a
 * payment, and Enterprise is negotiated. Both are handled by `upgradeHref`.
 */
export function checkoutHref(plan: SellablePlan, interval: Interval): string {
  return `/api/stripe/checkout?plan=${plan}&interval=${interval}`;
}

/**
 * Where any plan's primary call to action should go, sellable or not.
 *
 * Enterprise goes to the contact form rather than a checkout — it is the one
 * plan with no self-serve price, and sending it to `/assessment` (as the pricing
 * page used to) offered a $490 one-off engagement to someone asking about an
 * annual contract.
 */
export function upgradeHref(plan: Plan, interval: Interval): string {
  if (plan === 'free') return '/auth/signup';
  if (plan === 'enterprise') return '/contact?topic=enterprise';
  // legacy_pro is never sold; anyone on it who wants to move picks a current
  // plan from the pricing page, where the trade-off is spelled out.
  if (plan === 'legacy_pro') return '/pricing';
  return checkoutHref(plan as SellablePlan, interval);
}
