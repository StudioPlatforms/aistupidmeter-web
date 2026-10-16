import { PLANS, DATA_API_LIMITS, isUnlimited, type Plan } from '@/lib/entitlements';

/**
 * What each plan card says, shared by the pricing page and the landing page so the two can never
 * describe a plan differently. Derived from the plan table (lib/entitlements.ts): change a limit
 * there and both pages follow.
 */

const fmt = (n: number) => (isUnlimited(n) ? 'Unlimited' : n.toLocaleString('en-US'));

/** Price to two decimals only when it needs them — "$7.50", but "$9" and "$1,290". */
export const money = (n: number) => (Number.isInteger(n)
  ? `$${n.toLocaleString('en-US')}`
  : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

/** One-line summary of what a plan is for. */
export const PITCH: Record<Plan, string> = {
  free: 'The public evidence, plus a watchlist of three models with email alerts and a weekly summary.',
  pro: 'The drift monitor and the full leaderboard analysis, full history, calibration and substitute analysis, exports and custom alerts.',
  developer: 'For running the Smart Router in production: ten times the requests, API monitoring and 30-day decision logs.',
  teams: 'Five editors, each with the full Teams plan, three projects with their own router keys, budgets and spend reports, plus webhooks, single sign-on and an audit trail.',
  enterprise: 'Contracted scope, unlimited seats and requests, 365-day decision logs and invoicing.',
  legacy_pro: '',
};

/** What each card lists, derived from the plan table so a changed limit shows up here too. */
export function highlights(p: Plan): { lead?: string; items: string[] } {
  const e = PLANS[p];
  const api = DATA_API_LIMITS[e.dataApiTier];
  const router = isUnlimited(e.routerRequestsPerMonth) ? 'Unlimited Smart Router requests' : `Smart Router: ${fmt(e.routerRequestsPerMonth)} requests a month`;
  const dataApi = `Data API: ${fmt(api.daily)} requests a day`;
  switch (p) {
    case 'free': return { items: [
      `${fmt(e.watchedModels)} tracked models, with email alerts`, `${e.historyDays} days of history`, 'Every category ranking', router, dataApi,
    ] };
    case 'pro': return { lead: 'Everything in Free, plus', items: [
      `${fmt(e.watchedModels)} tracked models and custom alert thresholds`, 'The drift monitor, quick answers, heatmap, radar and price-performance',
      'Full history and the drift diagnosis behind every change',
      'Calibration and cheaper-substitute analysis', 'Context-rot pilot: long-context accuracy up to 1M tokens',
      'Routing analytics and CSV/JSON exports', router, dataApi,
    ] };
    case 'developer': return { lead: 'Everything in Pro, plus', items: [
      router, 'API monitoring: per-key logs, costs, prompt auditing and budget limits', `${e.routerDiagnosticDays}-day decision logs`, dataApi,
      'A workspace with one project and a shared watchlist; viewers free',
    ] };
    case 'teams': return { lead: 'Everything in Developer, plus', items: [
      `${fmt(e.seats)} editors, each with the full Teams plan`,
      `${fmt(e.projects)} projects, each with its own router keys, rules, budget and spend report`,
      'A team watchlist with alerts to everyone', router, `${e.routerDiagnosticDays}-day decision logs`, dataApi,
      'Webhooks for regressions and budgets', 'Single sign-on (OIDC or SAML), SCIM and an audit trail',
    ] };
    case 'enterprise': return { items: [
      'Unlimited editor seats and projects', router, dataApi, `${e.routerDiagnosticDays}-day decision logs`, 'Contract and invoicing',
    ] };
    default: return { items: [] };
  }
}
