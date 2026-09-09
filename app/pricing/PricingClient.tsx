'use client';

/**
 * The pricing page.
 *
 * EVERY NUMBER HERE COMES FROM lib/entitlements.ts.
 *
 * Nothing on this page is typed out by hand. The previous site had $4.99
 * hard-coded in fourteen places and an entitlement story that contradicted what
 * the dashboard actually locked; rendering from the plan table makes that class
 * of drift impossible. If a limit looks wrong, fix the table, not this file.
 */

import { useState } from 'react';
import Link from 'next/link';
import { PLANS, SELLABLE_PLANS, isUnlimited, type Plan } from '@/lib/entitlements';
import { SAVINGS_PCT, SAVINGS_QUALIFIER } from '@/lib/savings-estimate';

type Interval = 'monthly' | 'annual';

const fmt = (n: number) => (isUnlimited(n) ? 'Unlimited' : n.toLocaleString());

const ROWS: Array<{ label: string; get: (p: Plan) => string; note?: string }> = [
  { label: 'Tracked models',        get: p => fmt(PLANS[p].watchedModels) },
  { label: 'Comparable history',    get: p => PLANS[p].historyDays === null ? 'Everything we hold' : `${PLANS[p].historyDays} days` },
  { label: 'Category rankings',     get: p => PLANS[p].categorySorts ? 'Yes' : 'No', note: 'Coding, reasoning, tool-calling and price sorts' },
  { label: 'Data API',              get: p => `${PLANS[p].dataApiTier} tier` },
  { label: 'Routed requests / mo',  get: p => fmt(PLANS[p].routerRequestsPerMonth), note: 'You bring your own provider keys; providers bill you for inference directly' },
  { label: 'Evaluation units / mo', get: p => fmt(PLANS[p].evalUnitsPerMonth) },
  { label: 'Decision-log history',  get: p => `${PLANS[p].routerDiagnosticDays} days` },
  { label: 'Editor seats',          get: p => fmt(PLANS[p].seats) },
  { label: 'Projects',              get: p => PLANS[p].projects === 0 ? '—' : fmt(PLANS[p].projects) },
  { label: 'Exports',               get: p => PLANS[p].exports ? 'Yes' : '—' },
  { label: 'Webhooks',              get: p => PLANS[p].webhooks ? 'Yes' : '—' },
  { label: 'Custom alert thresholds', get: p => PLANS[p].customAlerts ? 'Yes' : '—' },
];

export default function PricingClient({ buyable = [] }: { buyable?: string[] }) {
  const [interval, setInterval] = useState<Interval>('monthly');

  const priceLabel = (p: Plan): string => {
    const e = PLANS[p];
    if (e.priceMonthly === null) return 'Talk to us';
    if (e.priceMonthly === 0) return 'Free';
    return interval === 'annual' && e.priceAnnual !== null
      ? `$${e.priceAnnual}/yr`
      : `$${e.priceMonthly}/mo`;
  };

  const cta = (p: Plan): { href: string | null; label: string } => {
    if (p === 'free') return { href: '/auth/signup', label: 'Create account' };
    if (p === 'enterprise') return { href: '/assessment', label: 'Talk to us' };
    // Not yet configured in Stripe: show it, do not sell it.
    if (!buyable.includes(p)) return { href: null, label: 'Available shortly' };
    return { href: `/api/stripe/checkout?plan=${p}&interval=${interval}`, label: 'Start free trial' };
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px 70px' }}>
      <h1 style={{ fontSize: '1.6em', margin: '0 0 8px' }}>Know when your model decisions stop being right</h1>
      <p style={{ color: 'var(--phosphor-dim)', lineHeight: 1.6, maxWidth: 680, margin: '0 0 24px' }}>
        The evidence is free — current scores, every category ranking, seven days of history and the
        full methodology. Paid plans buy depth and workflow: longer comparable history, the diagnosis
        behind a change, more tracked models, routing and team features.
      </p>

      <div style={{ display: 'inline-flex', gap: 4, marginBottom: 24, padding: 3, borderRadius: 4, border: '1px solid var(--border-subtle, #2a2a2a)' }}>
        {(['monthly', 'annual'] as Interval[]).map(i => (
          <button key={i} onClick={() => setInterval(i)} className="md-ctrl-btn"
            style={{
              padding: '6px 14px', fontSize: '0.85em',
              background: interval === i ? 'rgba(26,115,232,0.12)' : 'transparent',
              borderColor: interval === i ? 'var(--phosphor-green)' : 'transparent',
            }}>
            {i === 'monthly' ? 'Monthly' : 'Annual — 2 months free'}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 36 }}>
        {SELLABLE_PLANS.map(p => {
          const e = PLANS[p];
          const c = cta(p);
          const highlight = p === 'developer';
          return (
            <div key={p} style={{
              padding: 16, borderRadius: 4,
              border: `1px solid ${highlight ? 'var(--phosphor-green)' : 'var(--border-subtle, #2a2a2a)'}`,
              background: highlight ? 'rgba(26,115,232,0.04)' : 'transparent',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ fontWeight: 700 }}>{e.label}</div>
              <div style={{ fontSize: '1.5em', fontWeight: 700 }}>{priceLabel(p)}</div>
              <div style={{ fontSize: '0.82em', color: 'var(--phosphor-dim)', lineHeight: 1.5, flex: 1 }}>
                {p === 'free' && 'Track three models and get a weekly summary.'}
                {p === 'pro' && 'Full history, saved comparisons, exports and custom alerts.'}
                {p === 'developer' && 'Adds production routing, decision logs and private evaluations.'}
                {p === 'teams' && 'Five editors, shared monitoring, webhooks and reporting.'}
                {p === 'enterprise' && 'Contracted scope, SSO/RBAC, audit controls and support.'}
              </div>
              {c.href ? (
                <Link href={c.href} className="vintage-btn"
                  style={{
                    padding: '9px 10px', textAlign: 'center', textDecoration: 'none',
                    fontSize: '0.85em', whiteSpace: 'normal', lineHeight: 1.3,
                  }}>
                  {c.label}
                </Link>
              ) : (
                <span
                  title="This plan is not open for sign-up yet"
                  style={{
                    padding: '9px 10px', textAlign: 'center', fontSize: '0.85em',
                    lineHeight: 1.3, border: '1px dashed var(--border-subtle, #2a2a2a)',
                    borderRadius: 3, color: 'var(--phosphor-dim)', cursor: 'default',
                  }}>
                  {c.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.05em', margin: '0 0 12px' }}>What each plan includes</h2>
        {/* On a phone the table is wider than the viewport and the paid columns sit
            off-screen. Without this the page silently hides the plans someone is
            most likely to buy. */}
        <span className="pricing-scroll-hint" style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)' }}>
          swipe to compare →
        </span>
      </div>
      <div className="pricing-table-scroll" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85em', minWidth: 640 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--phosphor-dim)' }}>
              <th className="pricing-row-label" style={{ padding: '8px 10px 8px 0' }}></th>
              {SELLABLE_PLANS.map(p => <th key={p} style={{ padding: '8px 10px' }}>{PLANS[p].label}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(r => (
              <tr key={r.label} style={{ borderTop: '1px solid var(--border-subtle, #2a2a2a)' }}>
                <td className="pricing-row-label" style={{ padding: '9px 10px 9px 0', color: 'var(--phosphor-dim)' }}>
                  {r.label}
                  {r.note && <div style={{ fontSize: '0.85em', opacity: 0.7, lineHeight: 1.4 }}>{r.note}</div>}
                </td>
                {SELLABLE_PLANS.map(p => (
                  <td key={p} style={{ padding: '9px 10px' }}>{r.get(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 28, display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <section>
          <h3 style={{ fontSize: '0.95em', margin: '0 0 6px' }}>What we do not charge for</h3>
          <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: 0 }}>
            Provider inference. You connect your own OpenAI, Anthropic, Google, DeepSeek, Kimi or GLM
            keys, and those providers bill you directly at their rates. We charge for the software and
            the measurement, never a markup on tokens.
          </p>
        </section>
        <section>
          <h3 style={{ fontSize: '0.95em', margin: '0 0 6px' }}>Existing subscribers</h3>
          <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: 0 }}>
            If you already subscribe, you keep your current price and everything you already had for
            at least twelve months. Nothing about these plans reduces what you have today. Your plan
            only changes if you choose to change it, or if you cancel and come back later.
          </p>
        </section>
        <section>
          <h3 style={{ fontSize: '0.95em', margin: '0 0 6px' }}>Does routing save money?</h3>
          <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: 0 }}>
            In our own benchmark the cheapest model matching the top score cost about {SAVINGS_PCT}% less
            per request. {SAVINGS_QUALIFIER}
          </p>
        </section>
      </div>

      <p style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)', marginTop: 26, lineHeight: 1.6 }}>
        Prices in USD, excluding any applicable tax. Every plan collects a payment method at checkout,
        including during a free trial, and you can cancel at any time from the billing portal.
      </p>
    </div>
  );
}
