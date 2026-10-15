'use client';

/**
 * Gate a page on the plan it actually requires.
 *
 * WHAT CHANGED
 * ------------
 * This used to POST to /api/subscription/check and read a single `hasAccess`
 * boolean, which is true for any paid plan. Every guarded page therefore had the
 * same price of entry — $9 — while four of them displayed $19 and one of them
 * (API monitoring) was described elsewhere as a Developer feature. It also sent
 * every upgrade click to `/api/stripe/checkout` with no plan, which the checkout
 * route defaults to `pro/monthly`: the button charged $9 no matter what it said.
 *
 * The plan is already on the session — `auth.ts` resolves it and attaches the
 * whole entitlement object — so no fetch is needed at all. The guard now
 * compares that plan against the capability the page names, and the upgrade CTA
 * quotes and sells exactly the plan that would unlock it.
 */

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { isPlan, planMeets, PLANS, DATA_API_LIMITS, type Plan } from '@/lib/entitlements';
import { REQUIRED_PLAN, CAPABILITY_LABEL, type Capability } from '@/lib/capabilities';
import { upgradeHref } from '@/lib/checkout-url';
import { monthlyLong, planName } from '@/lib/pricing-display';
import Pane from '@/components/studio/Pane';
import { Loader } from '@/components/studio/Bits';

/**
 * Whether the signed-in account's plan unlocks `requires`. `ready` is false while the session
 * loads. Pages that FETCH gated data use it to skip the fetch on a lower plan: since 2026-10-05
 * the API refuses those requests (403), and a page that fetched first showed that refusal as a
 * red error banner instead of this guard's upgrade screen.
 */
export function useCapability(requires: Capability): { ready: boolean; allowed: boolean } {
  const { data: session, status } = useSession();
  if (status === 'loading') return { ready: false, allowed: false };
  const plan: Plan = isPlan((session?.user as any)?.plan) ? (session!.user as any).plan : 'free';
  return { ready: true, allowed: planMeets(plan, REQUIRED_PLAN[requires]) };
}

interface SubscriptionGuardProps {
  children: React.ReactNode;
  /** Display name of the locked page. */
  feature: string;
  /** The entitlement this page needs. */
  requires: Capability;
}

export default function SubscriptionGuard({ children, feature, requires }: SubscriptionGuardProps) {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <Loader label="Checking access" minHeight={300} />;
  }

  const plan: Plan = isPlan((session?.user as any)?.plan) ? (session!.user as any).plan : 'free';
  const needed = REQUIRED_PLAN[requires];

  if (planMeets(plan, needed)) return <>{children}</>;

  const benefits = FEATURE_BENEFITS[requires];
  const neededLabel = planName(needed);
  const price = monthlyLong(needed);

  return (
    <div className="st-body">
      <section className="st-pane is-accent st-lock st-up">
        <div className="st-lock-main">
          <p className="st-kicker">Part of {neededLabel}</p>
          <h2 className="st-lock-t">{feature}</h2>
          <p className="st-lead">
            {CAPABILITY_LABEL[requires]} is part of {neededLabel}. You are on {planName(plan)} today.
          </p>
          <p className="st-lock-price">{price}</p>
          <div className="st-actions">
            {/* An API route (Stripe checkout): prefetching it as a page only logs a failed RSC fetch. */}
            <Link href={upgradeHref(needed, 'monthly')} prefetch={false} className="st-btn is-primary is-lg">
              Upgrade to {neededLabel} <span className="st-ar" aria-hidden="true">→</span>
            </Link>
            <Link href="/pricing" className="st-btn is-lg">Compare plans</Link>
          </div>
          <p className="st-hint" style={{ marginTop: 14 }}>
            Cancel any time · a payment method is collected at checkout, including during a trial
          </p>
        </div>
        <div className="st-lock-side">
          <p className="st-label">What {neededLabel} adds</p>
          <ul className="st-lock-list">
            {benefits.map((b, i) => (
              <li key={i}>
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div><b>{b.title}</b><span>{b.description}</span></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The measured allowances, straight from the plan table. Nothing here is
          typed by hand, so a limit cannot drift from what is enforced. */}
      <Pane title={`Your plan vs ${neededLabel}`} sub="Every limit below is the one the API enforces." ruled flush>
        <div className="st-table-wrap">
          <table className="st-table">
            <thead>
              <tr>
                <th></th>
                <th>{planName(plan)}</th>
                <th>{neededLabel}</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map(row => (
                <tr key={row.label}>
                  <td className="is-dim">{row.label}</td>
                  <td>{row.get(plan)}</td>
                  <td style={{ fontWeight: 600 }}>{row.get(needed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Pane>
    </div>
  );
}

const fmt = (n: number) => (n === -1 ? 'Unlimited' : n.toLocaleString());

const COMPARISON: Array<{ label: string; get: (p: Plan) => string }> = [
  { label: 'Tracked models', get: p => fmt(PLANS[p].watchedModels) },
  { label: 'Comparable history', get: p => (PLANS[p].historyDays === null ? 'Full history' : `${PLANS[p].historyDays} days`) },
  { label: 'Smart Router requests / mo', get: p => fmt(PLANS[p].routerRequestsPerMonth) },
  { label: 'Decision-log history', get: p => `${PLANS[p].routerDiagnosticDays} days` },
  { label: 'Data API', get: p => `${fmt(DATA_API_LIMITS[PLANS[p].dataApiTier].daily)} requests/day` },
];

const FEATURE_BENEFITS: Record<Capability, Array<{ title: string; description: string }>> = {
  routing: [
    { title: 'Bring your own keys', description: 'Connect OpenAI, Anthropic, Google, DeepSeek, Kimi or GLM. Providers bill you directly; we never mark up tokens.' },
    { title: 'Eight strategies', description: 'Best overall, coding, reasoning, creative, cheapest, fastest, tool-use or agentic — chosen from live benchmarks.' },
    { title: 'Automatic failover', description: 'A provider outage falls through to the next best model rather than failing your request.' },
  ],
  'data-api': [
    { title: 'Programmatic access', description: 'Read scores, rankings, history, drift and incidents from your own tooling.' },
    { title: 'Quota that scales', description: 'Free is an evaluation tier; paid plans lift the daily and per-minute limits.' },
    { title: 'Stable contract', description: 'Versioned endpoints with rate-limit headers on every response.' },
  ],
  analysis: [
    { title: 'Full history', description: 'Every measurement we hold, not the last seven days — so you can see a slow decline, not just today.' },
    { title: 'The whole matrix', description: 'All nine axes per model, plus the deep-reasoning and tool-calling suites.' },
    { title: 'Exports and custom alerts', description: 'CSV and JSON out, and thresholds you choose instead of our default.' },
  ],
  'routing-analytics': [
    { title: 'Cost and latency trends', description: 'What each routed request cost, which model served it, and how that moved over time.' },
    { title: 'Timing breakdowns', description: 'Hour-of-day performance so you can schedule around a provider’s bad windows.' },
    { title: 'Exports', description: 'Take the analysis into your own spreadsheets and dashboards.' },
  ],
  calibration: [
    { title: 'Fabrication rate', description: 'How often a model answers a question that has no answer — an invented library, a company that does not exist, a fact it cannot observe.' },
    { title: 'Confidence you can use', description: 'Expected Calibration Error: whether a stated 90% actually comes out right about 90% of the time, or is a reassuring round number.' },
    { title: 'The questions behind the number', description: 'Per-item results for the latest sweep, so the figure can be checked rather than taken on trust.' },
  ],
  substitutes: [
    { title: 'What switching actually costs', description: 'For every cheaper model, the measured share of requests this one completes that the cheaper one would fail — not a score gap, the overlap behind it.' },
    { title: 'Read per trial, not per verdict', description: 'A published verdict is the median of seven trials. One request is not seven, so this reads the trials underneath and reports the variance the median removes.' },
    { title: 'Bounded, not assumed', description: 'Each figure comes with the range it must fall in for any dependence between the two models’ failures, so nothing rests on an unstated assumption.' },
  ],
  'context-rot': [
    { title: 'Accuracy as the input grows', description: 'Every pilot model tested at 8K, 32K, 128K, 256K, 512K and 1M tokens of the same kind of document.' },
    { title: 'What breaks first', description: 'Finding a fact, linking facts, tracking a value that changes, and counting across the whole document — scored separately.' },
    { title: 'Where in the document', description: 'The same fact placed at 10% to 90% of the way through, so "lost in the middle" shows up if it is there.' },
  ],
  'api-monitoring': [
    { title: 'Per-key request logs', description: 'See exactly how each key is used, by which model, at what cost and latency.' },
    { title: 'Prompt auditing', description: 'Opt-in prompt retention with automatic secret scrubbing.' },
    { title: 'Budget controls', description: 'Spending limits per key with soft or hard enforcement and threshold alerts.' },
  ],
  team: [
    { title: 'Five editors, each on Teams', description: 'Every editor gets the full plan — history, analysis, routing and Data API limits. Viewers are unlimited and read-only.' },
    { title: 'Outbound webhooks', description: 'Signed HTTP callbacks when a model you depend on regresses.' },
  ],
  'latest-scores': [
    { title: 'The newest run, as it lands', description: 'Every model’s score from its latest benchmark run, refreshed after each run — coding every four hours, reasoning and tool use daily.' },
    { title: 'On the board and every model page', description: 'The Latest view on the leaderboard and on each model’s page, next to the 24-hour, 7-day and 30-day views every account has.' },
    { title: 'With the rest of Pro', description: 'Full history, the complete performance matrix, drift curves, calibration and substitution analysis.' },
  ],
  governance: [
    { title: 'Single sign-on', description: 'OIDC or SAML against your own identity provider, with domain-based routing.' },
    { title: 'Directory provisioning', description: 'SCIM 2.0, so joiners and leavers are handled by your directory rather than by hand.' },
    { title: 'Audit trail', description: 'An exportable record of who changed what, and when.' },
  ],
};
