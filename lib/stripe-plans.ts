/**
 * Which Stripe Price backs which plan, and how a subscription starts.
 *
 * PAID START. There is no trial: Checkout charges the first period before the plan starts.
 * Checkout runs in subscription mode, cards only, so a completed session means the money was
 * taken, never a promise to pay later. In place of a trial an account's FIRST subscription gets
 * a 7-day refund window: within REFUND_DAYS of a subscription whose checkout offered it (`asl_refund: '7d'`),
 * Cancel and refund on /account/billing ends the plan at once and refunds every payment on it
 * (lib/paid-start.ts). Checkout offers it only when the account has never subscribed before,
 * trial or paid (isFirstSubscription).
 *
 * The Prices still carry `recurring.trial_period_days` (7/7/14). It is ignored: Checkout has no
 * `trial_from_plan`, so a session only gets a trial when the code passes one, and none is passed.
 * Prices cannot be edited, and new Prices are not needed: swapping the env ids would also stop
 * the webhook recognising existing subscriptions.
 *
 * Subscriptions that began with a trial before this release keep their trial and convert as
 * promised; every trial path in the webhook stays for them.
 *
 * The plan ladder maps to named env vars (`STRIPE_PRICE_{PRO,DEV,TEAMS}_{MONTHLY,ANNUAL}`).
 * `legacy_pro` has no entry on purpose: existing subscribers keep the Stripe subscription they
 * already have, at the price they already pay. Nothing in the new ladder should ever create or
 * migrate one.
 */
import type Stripe from 'stripe';
import type { Plan } from '@/lib/entitlements';

export type Interval = 'monthly' | 'annual';

/** Stamped on every subscription Checkout starts paid (`metadata.asl_start`); trials never carry it. */
export const PAID_START = 'paid_v1';
/** How long after a subscription starts its refund window stays open, when the checkout offered one. */
export const REFUND_DAYS = 7;

/** Plans a customer can buy through self-serve checkout. */
export type SellablePlan = Extract<Plan, 'pro' | 'developer' | 'teams'>;

const PRICE_ENV: Record<SellablePlan, Record<Interval, string>> = {
  pro:       { monthly: 'STRIPE_PRICE_PRO_MONTHLY',   annual: 'STRIPE_PRICE_PRO_ANNUAL' },
  developer: { monthly: 'STRIPE_PRICE_DEV_MONTHLY',   annual: 'STRIPE_PRICE_DEV_ANNUAL' },
  teams:     { monthly: 'STRIPE_PRICE_TEAMS_MONTHLY', annual: 'STRIPE_PRICE_TEAMS_ANNUAL' },
};

/** One-off charges. */
export const ONE_TIME_ENV = {
  assessment: 'STRIPE_PRICE_ASSESSMENT',   // one-off workload assessment (lib/assessment-price.ts)
} as const;

/** Metered usage. Only billed once the corresponding meter is wired up. */
export const METERED_ENV = {
  routerOverage: 'STRIPE_PRICE_ROUTER_OVERAGE',   // $0.00013 per successful request
  evalUnits:     'STRIPE_PRICE_EVAL_UNITS',       // $0.0065 per completed unit
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

/**
 * Which plan did this subscription actually buy?
 *
 * Read off the Price on the subscription's first line item. Falls back to the plan recorded in
 * checkout metadata, then to 'pro'. Getting this wrong means selling someone Teams and granting
 * them Pro, so it is resolved from the money rather than from anything the browser sent.
 */
export function planForSubscription(subscription: Pick<Stripe.Subscription, 'items' | 'metadata'>): string {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const fromPrice = planForPriceId(priceId);
  if (fromPrice) return fromPrice;
  const fromMetadata = subscription.metadata?.plan;
  if (fromMetadata) return fromMetadata;
  console.warn(`[stripe] could not map price ${priceId} to a plan; defaulting to pro`);
  return 'pro';
}
