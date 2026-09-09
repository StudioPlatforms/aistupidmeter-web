/**
 * What each plan is entitled to. ONE source of truth.
 *
 * ============================================================================
 * THIS FILE IS DUPLICATED, BYTE FOR BYTE, IN apps/web/lib/entitlements.ts
 * The two repos deploy separately and cannot share a package, so the copy is
 * deliberate. If you change one, change the other. `verify-entitlements.ts`
 * compares them and fails if they drift.
 * ============================================================================
 *
 * WHY THIS EXISTS
 * ---------------
 * Entitlement used to be a single boolean: `subscription_tier === 'pro'`.
 * Everything downstream — the leaderboard locks, the Pro API proxy, the upgrade
 * modals, the marketing copy — re-derived that boolean independently, so the
 * FAQ could promise something the dashboard locked and nobody noticed for
 * months. Rendering the entitlement table from this module means the copy and
 * the enforcement cannot disagree.
 *
 * Pure data and pure functions. No I/O, no imports. Both a Fastify route and a
 * React server component have to be able to call it.
 */

export type Plan =
  | 'free'
  | 'pro'
  | 'developer'
  | 'teams'
  | 'enterprise'
  /** Subscribers from before the September 2026 repricing. See NOTE below. */
  | 'legacy_pro';

/** Quota tiers on the public Data API. Must stay in sync with lib/data-api-keys.ts. */
export type DataApiTier = 'free' | 'pro' | 'teams' | 'enterprise';

/** Sentinel for "no limit". JSON-safe, unlike Infinity. */
export const UNLIMITED = -1;
export const isUnlimited = (n: number): boolean => n === UNLIMITED;

export interface Entitlements {
  plan: Plan;
  /** Name shown in the UI. */
  label: string;
  /** Models a user may track. */
  watchedModels: number;
  /** Days of leaderboard/model history. null = everything we hold. */
  historyDays: number | null;
  /** Non-combined leaderboard sorts (reasoning, coding, tooling). */
  categorySorts: boolean;
  /** Quota tier granted to Data API keys issued under this plan. */
  dataApiTier: DataApiTier;
  /** Successful routed requests included per month. */
  routerRequestsPerMonth: number;
  /** Standard private-evaluation units included per month. */
  evalUnitsPerMonth: number;
  /** Retention of per-request router decision logs, in days. */
  routerDiagnosticDays: number;
  /** Editor seats. Viewers are unlimited on plans that have projects. */
  seats: number;
  projects: number;
  exports: boolean;
  webhooks: boolean;
  /** User-defined alert thresholds, as opposed to the standard confirmed-change alert. */
  customAlerts: boolean;
  /** USD. null = negotiated, no self-serve checkout. */
  priceMonthly: number | null;
  priceAnnual: number | null;
}

/**
 * NOTE ON `legacy_pro` — this is a commitment, not a convenience.
 *
 * 64 accounts were paying $4.99/month when the five-plan ladder was introduced.
 * They keep that price and at least their existing access for twelve months.
 * The old Pro included router access and Data API access, so legacy_pro is
 * mapped to the *Developer* feature set rather than the new $9 Pro, which would
 * have been a silent downgrade. Do not "tidy" this into `pro`.
 */
export const PLANS: Record<Plan, Entitlements> = {
  free: {
    plan: 'free', label: 'Free',
    watchedModels: 3, historyDays: 7, categorySorts: true,
    dataApiTier: 'free',
    // 1,000 not 10,000. The GTM draft proposed 10K, but that is a running budget
    // rather than a taste, and it undercuts the $19 plan directly above it — if
    // Free routes 10K requests there is little reason to pay for Developer. The
    // developer-activation gate is 100 successful requests across three days, so
    // 1,000 is ten times what is needed to integrate, evaluate and decide.
    // Same principle already governs the Data API: evaluation tier, not a budget.
    routerRequestsPerMonth: 1_000, evalUnitsPerMonth: 0, routerDiagnosticDays: 3,
    seats: 1, projects: 0,
    exports: false, webhooks: false, customAlerts: false,
    priceMonthly: 0, priceAnnual: 0,
  },
  pro: {
    plan: 'pro', label: 'Pro Intelligence',
    watchedModels: 20, historyDays: null, categorySorts: true,
    dataApiTier: 'pro',
    routerRequestsPerMonth: 10_000, evalUnitsPerMonth: 0, routerDiagnosticDays: 3,
    seats: 1, projects: 0,
    exports: true, webhooks: false, customAlerts: true,
    priceMonthly: 9, priceAnnual: 90,
  },
  developer: {
    plan: 'developer', label: 'Developer',
    watchedModels: 20, historyDays: null, categorySorts: true,
    dataApiTier: 'pro',
    routerRequestsPerMonth: 100_000, evalUnitsPerMonth: 250, routerDiagnosticDays: 30,
    seats: 1, projects: 1,
    exports: true, webhooks: false, customAlerts: true,
    priceMonthly: 19, priceAnnual: 190,
  },
  teams: {
    plan: 'teams', label: 'Teams',
    watchedModels: UNLIMITED, historyDays: null, categorySorts: true,
    dataApiTier: 'teams',
    routerRequestsPerMonth: 1_000_000, evalUnitsPerMonth: 1_000, routerDiagnosticDays: 90,
    seats: 5, projects: 3,
    exports: true, webhooks: true, customAlerts: true,
    priceMonthly: 99, priceAnnual: 990,
  },
  enterprise: {
    plan: 'enterprise', label: 'Enterprise',
    watchedModels: UNLIMITED, historyDays: null, categorySorts: true,
    dataApiTier: 'enterprise',
    routerRequestsPerMonth: UNLIMITED, evalUnitsPerMonth: UNLIMITED, routerDiagnosticDays: 365,
    seats: UNLIMITED, projects: UNLIMITED,
    exports: true, webhooks: true, customAlerts: true,
    priceMonthly: null, priceAnnual: null,
  },
  legacy_pro: {
    plan: 'legacy_pro', label: 'Pro (legacy)',
    watchedModels: 20, historyDays: null, categorySorts: true,
    dataApiTier: 'pro',
    routerRequestsPerMonth: 100_000, evalUnitsPerMonth: 250, routerDiagnosticDays: 30,
    seats: 1, projects: 1,
    exports: true, webhooks: false, customAlerts: true,
    priceMonthly: 4.99, priceAnnual: null,
  },
};

/** Plans offered on the pricing page, in ladder order. legacy_pro is not sold. */
export const SELLABLE_PLANS: Plan[] = ['free', 'pro', 'developer', 'teams', 'enterprise'];

/** Plans that carry paid access. Used for "is this a customer" checks. */
export const PAID_PLANS: Plan[] = ['pro', 'developer', 'teams', 'enterprise', 'legacy_pro'];

export function isPlan(value: unknown): value is Plan {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLANS, value);
}

/**
 * Shape of the account row this module needs. Deliberately minimal so both the
 * Drizzle row and the better-sqlite3 row satisfy it without adapting.
 *
 * `subscription_status` is NOT part of it. That column reads 'trial' for every
 * account including active payers — it has been dead for months and nothing
 * should start depending on it.
 */
export interface EntitlementSubject {
  subscription_tier?: string | null;
  trial_ends_at?: string | null;
  subscription_canceled_at?: string | null;
  subscription_ends_at?: string | null;
}

/** Resolve the plan an account is currently on. */
export function planFor(user: EntitlementSubject | null | undefined): Plan {
  if (!user) return 'free';

  const tier = user.subscription_tier;
  if (!isPlan(tier) || tier === 'free') {
    // An unexpired trial grants Pro even with no tier set.
    return inTrial(user) ? 'pro' : 'free';
  }

  // A cancelled subscription keeps its entitlements until the paid period it has
  // already been billed for runs out, then drops to free. For a legacy_pro
  // account that is the end of the grandfathered $4.99 price: once it lapses,
  // coming back means buying a current plan at current prices.
  //
  // If the cancellation date is set but the end date is missing or unparseable,
  // access is KEPT. That only happens when our own webhook data is incomplete,
  // and wrongly cutting off someone who is still paying is a far worse error
  // than carrying a lapsed account for a few extra days. Stripe always sends a
  // period end, so this is a data-integrity fallback, not a normal path.
  if (user.subscription_canceled_at) {
    const endsAt = user.subscription_ends_at ? Date.parse(user.subscription_ends_at) : NaN;
    if (!Number.isNaN(endsAt) && endsAt <= Date.now()) return 'free';
  }

  return tier;
}

function inTrial(user: EntitlementSubject): boolean {
  if (!user.trial_ends_at) return false;
  const ends = Date.parse(user.trial_ends_at);
  return !Number.isNaN(ends) && ends > Date.now();
}

/** The entitlements an account currently has. Never throws; unknown → free. */
export function entitlementsFor(user: EntitlementSubject | null | undefined): Entitlements {
  return PLANS[planFor(user)];
}

/** True when the account carries any paid access (including an active trial). */
export function hasPaidAccess(user: EntitlementSubject | null | undefined): boolean {
  return PAID_PLANS.includes(planFor(user));
}

/** Whether a plan may watch another model, given how many it already has. */
export function canWatchMore(plan: Plan, currentCount: number): boolean {
  const max = PLANS[plan].watchedModels;
  return isUnlimited(max) || currentCount < max;
}
