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
import { isPlan, planMeets, PLANS, type Plan } from '@/lib/entitlements';
import { REQUIRED_PLAN, CAPABILITY_LABEL, type Capability } from '@/lib/capabilities';
import { upgradeHref } from '@/lib/checkout-url';
import { monthlyLong, planName } from '@/lib/pricing-display';

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
    return (
      <div className="rv4-loading" style={{ minHeight: '300px' }}>
        <div className="rv4-loading-dot" />
        <div className="rv4-loading-dot" />
        <div className="rv4-loading-dot" />
        <span>Checking access</span>
      </div>
    );
  }

  const plan: Plan = isPlan((session?.user as any)?.plan) ? (session!.user as any).plan : 'free';
  const needed = REQUIRED_PLAN[requires];

  if (planMeets(plan, needed)) return <>{children}</>;

  const benefits = FEATURE_BENEFITS[requires];
  const neededLabel = planName(needed);
  const price = monthlyLong(needed);

  return (
    <div className="rv4-body">
      <div className="rv4-upgrade-container">
        <div className="rv4-upgrade-hero">
          <div className="rv4-upgrade-hero-title">{feature}</div>
          <div className="rv4-upgrade-hero-sub">
            {CAPABILITY_LABEL[requires]} is part of {neededLabel}. You are on{' '}
            {planName(plan)} today.
          </div>
          <div className="rv4-upgrade-price">{price}</div>
          <Link href={upgradeHref(needed, 'monthly')} className="rv4-upgrade-cta" style={{ textDecoration: 'none' }}>
            Upgrade to {neededLabel}
          </Link>
          <div className="rv4-upgrade-fine-print">
            Cancel any time · a payment method is collected at checkout, including during a trial
          </div>
        </div>

        <div className="rv4-panel" style={{ marginBottom: '16px' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">What {neededLabel} adds</span>
          </div>
          <div className="rv4-panel-body">
            <div className="rv4-upgrade-benefits">
              {benefits.map((b, i) => (
                <div key={i} className="rv4-upgrade-benefit">
                  <div
                    className="rv4-upgrade-benefit-icon"
                    style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--phosphor-green)' }}
                  >
                    →
                  </div>
                  <div className="rv4-upgrade-benefit-title">{b.title}</div>
                  <div className="rv4-upgrade-benefit-desc">{b.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* The measured allowances, straight from the plan table. Nothing here is
            typed by hand, so a limit cannot drift from what is enforced. */}
        <div className="rv4-panel" style={{ marginBottom: '16px' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">Your plan vs {neededLabel}</span>
          </div>
          <div className="rv4-panel-body">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ color: 'var(--phosphor-dim)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px 6px 0' }}></th>
                  <th style={{ padding: '6px 8px' }}>{planName(plan)}</th>
                  <th style={{ padding: '6px 8px' }}>{neededLabel}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(row => (
                  <tr key={row.label} style={{ borderTop: '1px solid var(--metal-silver)' }}>
                    <td style={{ padding: '7px 8px 7px 0', color: 'var(--phosphor-dim)' }}>{row.label}</td>
                    <td style={{ padding: '7px 8px' }}>{row.get(plan)}</td>
                    <td style={{ padding: '7px 8px', color: 'var(--phosphor-green)' }}>{row.get(needed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <Link href="/pricing" style={{ fontSize: '11px', color: 'var(--phosphor-dim)' }}>
            Compare every plan, including annual →
          </Link>
        </div>
      </div>
    </div>
  );
}

const fmt = (n: number) => (n === -1 ? 'Unlimited' : n.toLocaleString());

const COMPARISON: Array<{ label: string; get: (p: Plan) => string }> = [
  { label: 'Tracked models', get: p => fmt(PLANS[p].watchedModels) },
  { label: 'Comparable history', get: p => (PLANS[p].historyDays === null ? 'Everything we hold' : `${PLANS[p].historyDays} days`) },
  { label: 'Routed requests / mo', get: p => fmt(PLANS[p].routerRequestsPerMonth) },
  { label: 'Decision-log history', get: p => `${PLANS[p].routerDiagnosticDays} days` },
  { label: 'Data API', get: p => `${PLANS[p].dataApiTier} tier` },
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
  'api-monitoring': [
    { title: 'Per-key request logs', description: 'See exactly how each key is used, by which model, at what cost and latency.' },
    { title: 'Prompt auditing', description: 'Opt-in prompt retention with automatic secret scrubbing.' },
    { title: 'Budget controls', description: 'Spending limits per key with soft or hard enforcement and threshold alerts.' },
  ],
  team: [
    { title: 'Five editor seats', description: 'Viewers are unlimited — only people who change things consume a seat.' },
    { title: 'Shared watchlists', description: 'Projects the whole team follows, rather than one person’s private list.' },
    { title: 'Outbound webhooks', description: 'Signed HTTP callbacks when a model you depend on regresses.' },
  ],
  governance: [
    { title: 'Single sign-on', description: 'OIDC or SAML against your own identity provider, with domain-based routing.' },
    { title: 'Directory provisioning', description: 'SCIM 2.0, so joiners and leavers are handled by your directory rather than by hand.' },
    { title: 'Audit trail', description: 'An exportable record of who changed what, and when.' },
  ],
};
