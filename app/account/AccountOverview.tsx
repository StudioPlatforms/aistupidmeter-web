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
import { PageHead, Pane, Stats, Stat, CountUp, Loader, Empty, Meter as MeterBar, ProviderMark, Tag } from '@/components/studio';

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
interface Watchlist { limit: number | null; used: number; scorePeriod?: 'latest' | '24h'; models: WatchedModel[] }

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
  if (loading) return <div data-page-loading><Loader label="Loading your account" minHeight={420} /></div>;

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
    <>
      <PageHead
        kicker="Account"
        title={firstName ? `Welcome back, ${firstName}` : 'Your account'}
        lead="Your plan, what you are tracking, and how much of it you have used."
        actions={plan === 'free'
          ? <Link href="/pricing" className="st-btn is-primary">See plans <span className="st-ar" aria-hidden="true">→</span></Link>
          : <Link href="/account/billing" className="st-btn">Manage plan</Link>}
      />

      <div className="st-body">
        <Stats columns={meters.some(m => m.key === 'dataApi') ? 4 : 3}>
          <Stat value={planLabel} label="Current plan" sub={price} tone="accent" />
          <Stat
            value={<CountUp value={tracked} />}
            unit={watchCap ? `of ${watchCap}` : undefined}
            label="Tracked models"
            sub={tracked === 0 ? 'Nothing tracked yet' : 'Measured on every benchmark run'}
          />
          <Stat value={<CountUp value={alerting} />} label="Drift alerts on" sub="Email when a watched model moves" />
          {meters.filter(m => m.key === 'dataApi').map(m => (
            <Stat
              key={m.key}
              value={<CountUp value={m.used} />}
              unit={isUnlimited(m.limit) ? undefined : `of ${m.limit.toLocaleString()}`}
              label="Data API calls"
              sub={m.period === 'now' ? 'Right now' : m.period.charAt(0).toUpperCase() + m.period.slice(1)}
            />
          ))}
        </Stats>

        <div className="st-split">
          <Pane
            title="Your watchlist"
            sub={tracked === 0
              ? `Models you track show up here with their ${watch?.scorePeriod === '24h' ? '24-hour' : 'latest'} score.`
              : `${tracked} tracked · ${alerting} with drift alerts${watch?.scorePeriod === '24h' ? ' · 24-hour scores' : ''}`}
            actions={tracked > 0 && <Link href="/watchlist" className="st-btn is-sm">Open watchlist</Link>}
            ruled={tracked > 0}
            flush={tracked > 0}
          >
            {tracked === 0 ? (
              <Empty
                title="You are not tracking anything yet"
                actions={<Link href="/" className="st-btn is-primary">Find models to track <span className="st-ar" aria-hidden="true">→</span></Link>}
              >
                Star a model on the leaderboard and we will tell you when its measured score moves.
              </Empty>
            ) : (
              <div className="st-rows">
                {watch!.models.slice(0, 6).map(m => (
                  <Link key={m.modelId} href={`/models/${m.modelId}`} className="st-row" style={{ color: 'inherit', textDecoration: 'none' }}>
                    <ProviderMark provider={m.vendor || ''} />
                    <div className="st-row-main">
                      <div className="st-row-t">{m.name}</div>
                      <div className="st-row-s">{m.vendor ? m.vendor.charAt(0).toUpperCase() + m.vendor.slice(1) : 'Model'}</div>
                    </div>
                    <div className="st-row-end">
                      {m.alertsEnabled && <Tag tone="accent">alerts on</Tag>}
                      <b style={{ fontSize: 18, fontFamily: 'var(--lp-font-disp)', letterSpacing: '-.02em' }}>{m.score !== null ? Math.round(m.score) : '—'}</b>
                    </div>
                  </Link>
                ))}
                {tracked > 6 && (
                  <Link href="/watchlist" className="st-row" style={{ color: 'inherit', textDecoration: 'none' }}>
                    <span />
                    <span className="st-more">{tracked - 6} more on your watchlist</span>
                    <span />
                  </Link>
                )}
              </div>
            )}
          </Pane>

          <Pane title="Usage" sub="This plan's allowances, as the API enforces them." delay={0.08}
            foot={<Link href="/account/billing" className="st-more">Full usage and limits</Link>}>
            {meters.length === 0 ? (
              <p className="st-text">Nothing on this plan is metered yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 18 }}>
                {meters.map(m => (
                  <div key={m.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, marginBottom: 8 }}>
                      <span>{m.label}</span>
                      <span className="st-num st-muted">
                        <b style={{ color: 'var(--lp-fg)' }}>{m.used.toLocaleString()}</b>
                        {isUnlimited(m.limit) ? ' · no limit' : ` of ${m.limit.toLocaleString()}`}
                        {m.period === 'now' ? '' : ` ${m.period}`}
                      </span>
                    </div>
                    <MeterBar used={m.used} limit={isUnlimited(m.limit) ? -1 : m.limit} />
                  </div>
                ))}
              </div>
            )}
          </Pane>
        </div>

        {/* Where to go next. */}
        <section className="st-up">
          <p className="st-label">Everything in your account</p>
          <div className="st-cards" style={{ ['--min' as string]: '250px' }}>
            {links.map((l, i) => (
              <Link key={l.href} href={l.href} className="st-card st-up" style={{ ['--d' as string]: `${i * 0.04}s` }}>
                <span className="st-card-t">{l.title}<span className="st-ar" aria-hidden="true" style={{ marginLeft: 'auto', color: 'var(--lp-fg3)' }}>→</span></span>
                <span className="st-card-d">{l.desc}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
