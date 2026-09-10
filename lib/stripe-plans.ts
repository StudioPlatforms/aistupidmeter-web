/**
 * Which Stripe Price backs which plan.
 *
 * WHAT CHANGED AND WHY
 * --------------------
 * Checkout used to hard-code a single `STRIPE_PRICE_ID` with
 * `trial_period_days: 7` written into the code. That made the price and the
 * trial length deployment artefacts: changing either meant a code change, a
 * build, and a restart of a live site.
 *
 * Now the plan ladder maps to named env vars, and the trial length is read off
 * the Stripe Price itself at checkout time (`recurring.trial_period_days`). Set
 * the trial in the Stripe dashboard and it takes effect on the next checkout —
 * no deploy — and each plan can carry a different length.
 *
 * A CARD IS ALWAYS COLLECTED. Stripe's default for a Checkout Session is to
 * collect a payment method even during a trial; you have to opt *out* with
 * `payment_method_collection: 'if_required'`. We never pass that. The old
 * `/router` overlay promised "NO CREDIT CARD", which was never true — Checkout
 * asked for one anyway — and that copy has been removed.
 *
 * `legacy_pro` has no entry on purpose: existing subscribers keep the Stripe
 * subscription they already have, at the price they already pay. Nothing in the
 * new ladder should ever create or migrate one.
 */
import type { Plan } from '@/lib/entitlements';

export type Interval = 'monthly' | 'annual';

/** Plans a customer can buy through self-serve checkout. */
export type SellablePlan = Extract<Plan, 'pro' | 'developer' | 'teams'>;

const PRICE_ENV: Record<SellablePlan, Record<Interval, string>> = {
  pro:       { monthly: 'STRIPE_PRICE_PRO_MONTHLY',   annual: 'STRIPE_PRICE_PRO_ANNUAL' },
  developer: { monthly: 'STRIPE_PRICE_DEV_MONTHLY',   annual: 'STRIPE_PRICE_DEV_ANNUAL' },
  teams:     { monthly: 'STRIPE_PRICE_TEAMS_MONTHLY', annual: 'STRIPE_PRICE_TEAMS_ANNUAL' },
};

/** One-off charges. */
export const ONE_TIME_ENV = {
  assessment: 'STRIPE_PRICE_ASSESSMENT',   // $490 assisted assessment
} as const;

/** Metered usage. Only billed once the corresponding meter is wired up. */
export const METERED_ENV = {
  routerOverage: 'STRIPE_PRICE_ROUTER_OVERAGE',   // $0.0001 per successful request
  evalUnits:     'STRIPE_PRICE_EVAL_UNITS',       // $0.005 per completed unit
} as const;

export function isSellablePlan(v: unknown): v is SellablePlan {
  return v === 'pro' || v === 'developer' || v === 'teams';
}

export function isInterval(v: unknown): v is Interval {
  return v === 'monthly' || v === 'annual';
}

/**
 * Resolve a plan+interval to a configured Stripe Price id.
 * Returns null when that combination has not been configured yet, so the caller
 * can answer 400 rather than sending `undefined` to Stripe.
 */
export function priceIdFor(plan: SellablePlan, interval: Interval): string | null {
  const id = process.env[PRICE_ENV[plan][interval]];
  return id && id.trim() ? id.trim() : null;
}

/** Every plan/interval pair that is currently purchasable. For the pricing page. */
export function configuredPlans(): Array<{ plan: SellablePlan; interval: Interval; priceId: string }> {
  const out: Array<{ plan: SellablePlan; interval: Interval; priceId: string }> = [];
  for (const plan of ['pro', 'developer', 'teams'] as SellablePlan[]) {
    for (const interval of ['monthly', 'annual'] as Interval[]) {
      const priceId = priceIdFor(plan, interval);
      if (priceId) out.push({ plan, interval, priceId });
    }
  }
  return out;
}

/**
 * There is deliberately NO price fallback for new checkouts.
 *
 * An earlier version fell back to the original `STRIPE_PRICE_ID` for pro/monthly
 * so checkout would not break before the new Prices existed. That was wrong in a
 * way worse than breaking: the pricing page advertises Pro at $9, the legacy Price
 * charges $4.99, and the customer would have been billed an amount the page never
 * showed them. Charging anything other than the displayed price is not a
 * degradation to tolerate.
 *
 * Until a plan's Price is configured, `priceIdFor` returns null, the pricing page
 * marks it unavailable, and checkout refuses. `STRIPE_PRICE_ID` still has a job —
 * `planForPriceId` uses it to map existing subscribers to legacy_pro — but it can
 * never back a new purchase. The `priceIdWithLegacyFallback` wrapper that used to
 * sit here was removed once its last caller was gone: a function whose name
 * promises a fallback it does not perform is an invitation to reintroduce one.
 */

/** Reverse lookup for the webhook: which plan does this Price grant? */
export function planForPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  for (const plan of ['pro', 'developer', 'teams'] as SellablePlan[]) {
    for (const interval of ['monthly', 'annual'] as Interval[]) {
      if (priceIdFor(plan, interval) === priceId) return plan;
    }
  }
  // An existing subscriber on the original $4.99 Price keeps legacy entitlements.
  if (process.env.STRIPE_PRICE_ID && priceId === process.env.STRIPE_PRICE_ID.trim()) {
    return 'legacy_pro';
  }
  return null;
}
