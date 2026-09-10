'use client';

/**
 * Account home.
 *
 * The account area had every subpage and no front door: the header menu's last
 * item pointed at /router, so "go to my account" landed on the router product
 * page and the sidebar appeared to belong to something the customer may never
 * use. Under the new pricing most subscribers are here for the watchlist, not
 * the proxy, so this page answers their three questions — what am I on, what am
 * I tracking, how much of it have I used — and routes onward from there.
 *
 * Everything shown is measured. Nothing on this page is a placeholder.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PLANS, isPlan, isUnlimited, type Plan } from '@/lib/entitlements';

interface Meter { key: string; label: string; used: number; limit: number; period: string }
interface Usage {
  plan: Plan; label: string; priceMonthly: number | null;
  meters: Meter[];
  retention: { decisionLogDays: number; historyDays: number | null };
  seats: number; projects: number;
}
interface WatchedModel {
  modelId: number; name: string; vendor: string | null;
  score: number | null; scoredAt: string | null; alertsEnabled: boolean;
}
interface Watchlist { limit: number | null; used: number; models: WatchedModel[] }

const card: React.CSSProperties = {
  border: '1px solid var(--border-subtle, #2a2a2a)', borderRadius: 6,
  padding: '18px 20px', marginBottom: 16,
};
const label: React.CSSProperties = {
  fontSize: '0.78em', color: 'var(--phosphor-dim)',
  textTransform: 'uppercase', letterSpacing: '.6px',
};

function Bar({ used, limit }: { used: number; limit: number }) {
  if (isUnlimited(limit)) return null;
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const colour = pct >= 90 ? 'var(--red-alert, #d93025)' : pct >= 70 ? 'var(--amber-warning)' : 'var(--phosphor-green)';
  return (
    <div style={{ height: 5, borderRadius: 999, background: 'rgba(128,128,128,0.18)', overflow: 'hidden', marginTop: 7 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: colour, transition: 'width .3s ease' }} />
    </div>
  );
}

export default function AccountOverview() {
  const { data: session, status } = useSession();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [watch, setWatch] = useState<Watchlist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== 'authenticated') { if (status === 'unauthenticated') setLoading(false); return; }
    Promise.all([
      fetch('/api/account/usage', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      fetch('/api/account/watchlist', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
    ]).then(([u, w]) => {
      if (u?.success) setUsage(u.data);
      if (w?.success) setWatch(w.data);
    }).finally(() => setLoading(false));
  }, [status]);

  if (status === 'unauthenticated') {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.3em', marginBottom: 12 }}>Your account</h1>
        <p style={{ color: 'var(--phosphor-dim)', marginBottom: 22 }}>Sign in to see your plan, watchlist and usage.</p>
        <Link href="/auth/signin" className="vintage-btn" style={{ padding: '11px 22px', textDecoration: 'none' }}>Sign in</Link>
      </div>
    );
  }
  if (loading) return <div style={{ padding: 50, textAlign: 'center', color: 'var(--phosphor-dim)' }}>Loading…</div>;

  const plan: Plan = usage && isPlan(usage.plan) ? usage.plan : 'free';
  const e = PLANS[plan];
  // A legacy payer is never shown the word "legacy" — see uiplan.md §5.1.
  const planLabel = plan === 'legacy_pro' ? 'Pro' : e.label;
  const price = e.priceMonthly === null ? 'Contracted' : e.priceMonthly === 0 ? 'Free plan' : `$${e.priceMonthly}/month`;

  const rawName = (session?.user?.name || session?.user?.email || '').split(/[@ ]/)[0];
  const firstName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : '';
  const tracked = watch?.used ?? 0;
  const watchCap = watch?.limit;
  const alerting = watch?.models.filter(m => m.alertsEnabled).length ?? 0;

  // Only meters that mean something on this plan. Showing a routed-request bar to
  // someone who has never issued a provider key is noise, not information.
  const meters = (usage?.meters ?? []).filter(m => m.limit !== 0 && (m.used > 0 || m.key === 'watchedModels' || m.key === 'dataApi'));

  const links: Array<{ href: string; title: string; desc: string }> = [
    { href: '/watchlist', title: 'Watchlist', desc: 'Models you track and what you hear about' },
    { href: '/account/billing', title: 'Plan & billing', desc: 'Change plan, invoices, payment method' },
    { href: '/account/settings', title: 'Settings', desc: 'Email, alerts and digest preferences' },
    { href: '/router/intelligence', title: 'Model intelligence', desc: 'Rankings, drift and the full matrix' },
    { href: '/router', title: 'Smart Router', desc: 'Route requests to the model measuring best' },
    { href: '/account/data-keys', title: 'Data API keys', desc: 'Programmatic access to benchmark data' },
    { href: '/contact?topic=support', title: 'Contact us', desc: 'Questions, problems, or anything else' },
  ];

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '26px 20px 70px' }}>
      <h1 style={{ fontSize: '1.4em', margin: '0 0 4px' }}>
        {firstName ? `Welcome back, ${firstName}` : 'Your account'}
      </h1>
      <p style={{ color: 'var(--phosphor-dim)', margin: '0 0 22px', fontSize: '0.92em' }}>
        Your plan, what you are tracking, and how much of it you have used.
      </p>

      {/* Plan */}
      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={label}>Current plan</div>
            <div style={{ fontSize: '1.5em', fontWeight: 700, margin: '4px 0' }}>{planLabel}</div>
            <div style={{ fontSize: '0.92em', color: 'var(--phosphor-dim)' }}>{price}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {plan === 'free'
              ? <Link href="/pricing" className="vintage-btn vintage-btn--primary" style={{ padding: '9px 16px', textDecoration: 'none', fontSize: '0.86em' }}>See plans</Link>
              : <Link href="/account/billing" className="vintage-btn" style={{ padding: '9px 16px', textDecoration: 'none', fontSize: '0.86em' }}>Manage plan</Link>}
          </div>
        </div>
      </section>

      {/* Watchlist */}
      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: tracked ? 14 : 0 }}>
          <div>
            <div style={label}>Tracked models</div>
            <div style={{ fontSize: '1.5em', fontWeight: 700, margin: '4px 0' }}>
              {tracked}{watchCap ? <span style={{ fontSize: '0.55em', fontWeight: 400, color: 'var(--phosphor-dim)' }}> of {watchCap}</span> : null}
            </div>
            <div style={{ fontSize: '0.86em', color: 'var(--phosphor-dim)' }}>
              {tracked === 0
                ? 'You are not tracking anything yet.'
                : `${alerting} set to alert you when the measurement moves.`}
            </div>
          </div>
          <Link href={tracked === 0 ? '/' : '/watchlist'} className="vintage-btn" style={{ padding: '9px 16px', textDecoration: 'none', fontSize: '0.86em' }}>
            {tracked === 0 ? 'Find models to track' : 'Open watchlist'}
          </Link>
        </div>

        {tracked > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {watch!.models.slice(0, 6).map(m => (
              <Link
                key={m.modelId}
                href={`/models/${m.modelId}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
                  border: '1px solid var(--border-subtle, #2a2a2a)', borderRadius: 999,
                  padding: '5px 12px', fontSize: '0.84em', color: 'inherit',
                }}
              >
                <span>{m.name}</span>
                {m.score !== null && (
                  <span style={{ color: 'var(--phosphor-dim)' }}>{Math.round(m.score)}</span>
                )}
              </Link>
            ))}
            {tracked > 6 && (
              <span style={{ alignSelf: 'center', fontSize: '0.84em', color: 'var(--phosphor-dim)' }}>
                +{tracked - 6} more
              </span>
            )}
          </div>
        )}
      </section>

      {/* Usage */}
      {meters.length > 0 && (
        <section style={card}>
          <div style={{ ...label, marginBottom: 14 }}>Usage</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 18 }}>
            {meters.map(m => (
              <div key={m.key}>
                <div style={{ fontSize: '0.86em', marginBottom: 3 }}>{m.label}</div>
                <div style={{ fontSize: '0.95em', fontWeight: 600 }}>
                  {m.used.toLocaleString()}
                  <span style={{ fontWeight: 400, color: 'var(--phosphor-dim)' }}>
                    {isUnlimited(m.limit) ? ' · no limit' : ` of ${m.limit.toLocaleString()}`}
                    {m.period === 'now' ? '' : ` ${m.period}`}
                  </span>
                </div>
                <Bar used={m.used} limit={m.limit} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <Link href="/account/billing" style={{ fontSize: '0.84em', color: 'var(--accent, #1a73e8)' }}>
              Full usage and limits →
            </Link>
          </div>
        </section>
      )}

      {/* Where to go next */}
      <section>
        <div style={{ ...label, marginBottom: 12 }}>Everything in your account</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                display: 'block', textDecoration: 'none', color: 'inherit',
                border: '1px solid var(--border-subtle, #2a2a2a)', borderRadius: 6,
                padding: '14px 16px',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.94em' }}>{l.title}</div>
              <div style={{ fontSize: '0.82em', color: 'var(--phosphor-dim)', lineHeight: 1.5 }}>{l.desc}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
