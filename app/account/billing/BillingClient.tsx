'use client';

/**
 * Plan & billing — replaces the binary Free/Pro `/router/subscription`.
 *
 * The old page hard-coded $4.99 twice, could only express two plans, and told Pro
 * customers they had "Unlimited" API calls when the real limit was 10,000/day. It
 * also showed the free API limit as 100/day when it is 10. Every number here is
 * read from the entitlement table or measured usage instead.
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { PLANS, SELLABLE_PLANS, isPlan, isUnlimited, type Plan } from '@/lib/entitlements';

interface Meter { key: string; label: string; used: number; limit: number; period: string }
interface Usage {
  plan: Plan; label: string; priceMonthly: number | null;
  meters: Meter[];
  retention: { decisionLogDays: number; historyDays: number | null };
  seats: number; projects: number;
}

const card: React.CSSProperties = {
  border: '1px solid var(--border-subtle, #2a2a2a)', borderRadius: 6,
  padding: '18px 20px', marginBottom: 16,
};

function Bar({ used, limit }: { used: number; limit: number }) {
  if (isUnlimited(limit)) {
    return <div style={{ fontSize: '0.8em', color: 'var(--phosphor-green)' }}>No limit on your plan</div>;
  }
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const colour = pct >= 90 ? 'var(--red-alert, #d93025)' : pct >= 70 ? 'var(--amber-warning)' : 'var(--phosphor-green)';
  return (
    <div style={{ height: 6, borderRadius: 999, background: 'rgba(128,128,128,0.18)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: colour, transition: 'width .3s ease' }} />
    </div>
  );
}

export default function BillingClient({ buyable = [] }: { buyable?: string[] }) {
  const { data: session, status } = useSession();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== 'authenticated') { if (status === 'unauthenticated') setLoading(false); return; }
    fetch('/api/account/usage', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d?.success) setUsage(d.data); })
      .finally(() => setLoading(false));
  }, [status]);

  if (status === 'unauthenticated') {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.3em', marginBottom: 12 }}>Plan &amp; billing</h1>
        <p style={{ color: 'var(--phosphor-dim)', marginBottom: 22 }}>Sign in to see your plan.</p>
        <Link href="/auth/signin" className="vintage-btn" style={{ padding: '11px 22px', textDecoration: 'none' }}>Sign in</Link>
      </div>
    );
  }
  if (loading) return <div style={{ padding: 50, textAlign: 'center', color: 'var(--phosphor-dim)' }}>Loading…</div>;

  const plan: Plan = usage && isPlan(usage.plan) ? usage.plan : 'free';
  const e = PLANS[plan];
  const isLegacy = plan === 'legacy_pro';
  // Never shown as "legacy" — see uiplan.md §5.1.
  const planLabel = isLegacy ? 'Pro' : e.label;
  const price = e.priceMonthly === null ? 'Contracted' : e.priceMonthly === 0 ? 'Free' : `$${e.priceMonthly}/month`;

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '26px 20px 70px' }}>
      <h1 style={{ fontSize: '1.4em', margin: '0 0 20px' }}>Plan &amp; billing</h1>

      {/* Current plan */}
      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Current plan</div>
            <div style={{ fontSize: '1.6em', fontWeight: 700, margin: '4px 0' }}>{planLabel}</div>
            <div style={{ fontSize: '0.95em', color: 'var(--phosphor-dim)' }}>{price}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {plan === 'free'
              ? <Link href="/pricing" className="vintage-btn" style={{ padding: '9px 16px', textDecoration: 'none', fontSize: '0.86em' }}>See plans</Link>
              : <a href="/api/stripe/portal" className="md-ctrl-btn" style={{ padding: '9px 16px', textDecoration: 'none', fontSize: '0.86em' }}>Manage billing</a>}
          </div>
        </div>

        {isLegacy && (
          <p style={{
            marginTop: 16, marginBottom: 0, padding: '11px 13px', borderRadius: 4,
            background: 'rgba(26,115,232,0.06)', border: '1px solid rgba(26,115,232,0.25)',
            fontSize: '0.85em', lineHeight: 1.6,
          }}>
            You are on our original Pro plan — routing and Data API access included, at your
            original <strong>$4.99/month</strong>, held until September 2027. Nothing in our
            current pricing reduces what you have; you only move if you choose to.
          </p>
        )}
      </section>

      {/* Allowances */}
      <section style={card}>
        <h2 style={{ fontSize: '1.02em', margin: '0 0 4px', fontWeight: 600 }}>Your allowances</h2>
        <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', margin: '0 0 18px', lineHeight: 1.6 }}>
          What you are using against what your plan includes. Provider inference is billed by
          your own providers and never appears here.
        </p>
        {(usage?.meters ?? []).map(m => (
          <div key={m.key} style={{ marginBottom: 15 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86em', marginBottom: 6 }}>
              <span>{m.label} <span style={{ color: 'var(--phosphor-dim)' }}>· {m.period}</span></span>
              <span style={{ color: 'var(--phosphor-dim)' }}>
                {m.used.toLocaleString()} / {isUnlimited(m.limit) ? '∞' : m.limit.toLocaleString()}
              </span>
            </div>
            <Bar used={m.used} limit={m.limit} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: '0.82em', color: 'var(--phosphor-dim)', marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-subtle, #2a2a2a)' }}>
          <span>History: {usage?.retention.historyDays === null ? 'everything we hold' : `${usage?.retention.historyDays} days`}</span>
          <span>Decision logs: {usage?.retention.decisionLogDays} days</span>
          <span>Seats: {isUnlimited(usage?.seats ?? 1) ? '∞' : usage?.seats}</span>
          <span>Projects: {usage?.projects === 0 ? '—' : isUnlimited(usage?.projects ?? 0) ? '∞' : usage?.projects}</span>
        </div>
      </section>

      {/* Change plan */}
      <section style={{ ...card, marginBottom: 0 }}>
        <h2 style={{ fontSize: '1.02em', margin: '0 0 4px', fontWeight: 600 }}>Change plan</h2>
        <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', margin: '0 0 16px', lineHeight: 1.6 }}>
          {isLegacy
            ? 'Moving to a current plan ends your held $4.99 price. Compare carefully before switching — your plan already includes routing and Data API access.'
            : 'Every plan collects a payment method at checkout, including during a free trial, and you can cancel any time.'}
        </p>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {SELLABLE_PLANS.map(p => {
            const pe = PLANS[p];
            const current = p === plan || (isLegacy && p === 'pro');
            return (
              <div key={p} style={{
                border: `1px solid ${current ? 'var(--phosphor-green)' : 'var(--border-subtle, #2a2a2a)'}`,
                borderRadius: 5, padding: '12px 13px',
              }}>
                <div style={{ fontSize: '0.86em', fontWeight: 600 }}>{pe.label}</div>
                <div style={{ fontSize: '1.05em', fontWeight: 700, margin: '3px 0 8px' }}>
                  {pe.priceMonthly === null ? 'Talk to us' : pe.priceMonthly === 0 ? 'Free' : `$${pe.priceMonthly}/mo`}
                </div>
                {current ? (
                  <div style={{ fontSize: '0.78em', color: 'var(--phosphor-green)' }}>Your plan</div>
                ) : p === 'free' || p === 'enterprise' ? (
                  <Link href={p === 'free' ? '/pricing' : '/assessment'} style={{ fontSize: '0.8em', color: 'var(--phosphor-green)' }}>
                    {p === 'enterprise' ? 'Talk to us →' : 'Compare →'}
                  </Link>
                ) : buyable.includes(p) ? (
                  <Link href={`/api/stripe/checkout?plan=${p}&interval=monthly`} style={{ fontSize: '0.8em', color: 'var(--phosphor-green)' }}>
                    Switch →
                  </Link>
                ) : (
                  <span style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)' }}>Available shortly</span>
                )}
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)', marginTop: 16, marginBottom: 0 }}>
          Full comparison on the <Link href="/pricing" style={{ color: 'var(--phosphor-green)' }}>pricing page</Link>.
        </p>
      </section>
    </div>
  );
}
