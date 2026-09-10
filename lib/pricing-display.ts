/**
 * Prices for marketing surfaces, derived from the plan table.
 *
 * Every upgrade CTA on the site used to say "$4.99/mo" because there was one paid
 * plan. Under the ladder the honest answer depends on what the CTA is selling, so
 * this names the cheapest plan that actually unlocks the thing being advertised.
 *
 * Nothing here types a price. If a plan's price changes in entitlements.ts, every
 * CTA follows.
 */
import { PLANS, type Plan } from '@/lib/entitlements';

/** Cheapest plan that unlocks deeper analysis: full history, exports, alerts. */
export const ENTRY_PAID_PLAN: Plan = 'pro';

/**
 * Cheapest plan for production routing.
 *
 * Routing itself is not paywalled — Free carries 1,000 successful requests so the
 * proxy can be evaluated properly. What Developer buys is production volume plus
 * decision logs, so a routing CTA should quote Developer, not Pro.
 */
export const ROUTER_PLAN: Plan = 'developer';

const money = (n: number | null): string =>
  n === null ? 'Custom' : n === 0 ? 'Free' : Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;

/**
 * A period suffix only makes sense on an actual amount. Without this guard,
 * `monthly('free')` renders "Free/mo" and enterprise renders "Custom/mo" —
 * neither is used by a current CTA, but both are the kind of thing that ships
 * the day someone reuses the helper somewhere new.
 */
const withPeriod = (plan: Plan, suffix: string): string => {
  const amount = PLANS[plan].priceMonthly;
  const text = money(amount);
  return amount === null || amount === 0 ? text : `${text}${suffix}`;
};

/** e.g. "$9/mo", or plain "Free" / "Custom" where a period is meaningless. */
export const monthly = (plan: Plan): string => withPeriod(plan, '/mo');

/** e.g. "$9/month". */
export const monthlyLong = (plan: Plan): string => withPeriod(plan, '/month');

/**
 * Annual-equivalent monthly price, e.g. "$15.83/mo".
 *
 * The pricing page leads with annual, so a CTA that quotes the monthly figure
 * sends people to a page showing a different, lower number — which reads as a
 * bait-and-switch in reverse and undersells the offer. These keep every surface
 * on the same footing.
 */
export const annualMonthly = (plan: Plan): string => {
  const annual = PLANS[plan].priceAnnual;
  if (annual === null || annual === 0) return monthly(plan);
  const per = annual / 12;
  return Number.isInteger(per) ? `$${per}/mo` : `$${per.toFixed(2)}/mo`;
};

/** What a year on the annual plan saves against paying monthly, e.g. "$38". */
export const annualSaving = (plan: Plan): string | null => {
  const { priceMonthly, priceAnnual } = PLANS[plan];
  if (!priceMonthly || priceAnnual === null) return null;
  const saved = priceMonthly * 12 - priceAnnual;
  return saved > 0 ? (Number.isInteger(saved) ? `$${saved}` : `$${saved.toFixed(2)}`) : null;
};

/** e.g. "from $9/mo" — for CTAs that unlock across several plans. */
export const fromMonthly = (plan: Plan): string => `from ${monthly(plan)}`;

/** Plan name as shown to customers. legacy_pro is never labelled "legacy". */
export const planName = (plan: Plan): string =>
  plan === 'legacy_pro' ? 'Pro' : PLANS[plan].label;

/** Bare number for structured data, which must not carry a currency symbol. */
export const priceNumber = (plan: Plan): string =>
  PLANS[plan].priceMonthly === null ? '0' : String(PLANS[plan].priceMonthly);
