'use client';

/**
 * The watchlist view.
 *
 * Shows coverage, not just scores. A model that has not been measured for eight
 * weeks is displayed as exactly that, rather than quietly presenting a stale
 * number as current — the same correction the digest job needed.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { PLANS, isUnlimited } from '@/lib/entitlements';
import {
  PageHead, Pane, Stats, Stat, CountUp, Loader, Empty, Note, Pill, ProviderMark, Meter, PROVIDER_LABEL,
} from '@/components/studio';
import { lpBody, lpDisplay } from '@/lib/fonts';
import '@/styles/landing.css';
import '@/styles/studio-account.css';

interface WatchedModel {
  modelId: number;
  name: string;
  vendor: string | null;
  score: number | null;
  scoredAt: string | null;
  addedAt: string;
  alertsEnabled: boolean;
}

interface Payload {
  plan: string;
  limit: number | null;
  used: number;
  /** Which board the scores come from: the latest run on paid plans, 24 hours on free. */
  scorePeriod?: 'latest' | '24h';
  models: WatchedModel[];
}

const daysAgo = (iso: string | null): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86_400_000);
};

const vendorName = (v: string) => PROVIDER_LABEL[v.toLowerCase()] ?? (v.charAt(0).toUpperCase() + v.slice(1));

/** "20 on Pro and Developer" when the two match, as they do today; each named when they do not. */
const paidCaps = (): string => {
  const cap = (n: number) => (isUnlimited(n) ? 'unlimited' : String(n));
  const pro = PLANS.pro.watchedModels, dev = PLANS.developer.watchedModels;
  const mid = pro === dev ? `${cap(pro)} on Pro and Developer` : `${cap(pro)} on Pro, ${cap(dev)} on Developer`;
  return `${mid}, ${cap(PLANS.teams.watchedModels)} on Teams`;
};

export default function WatchlistClient() {
  const { status } = useSession();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch('/api/account/watchlist', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d?.success) { setData(d.data); setError(null); }
        else setError(d?.message || d?.error || 'Could not load your watchlist');
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (status === 'authenticated') load();
    else if (status === 'unauthenticated') setLoading(false);
  }, [status]);

  const remove = async (modelId: number) => {
    await fetch(`/api/account/watchlist/${modelId}`, { method: 'DELETE' });
    load();
  };

  const setAlerts = async (modelId: number, alertsEnabled: boolean) => {
    setData(d => d && ({
      ...d,
      models: d.models.map(m => (m.modelId === modelId ? { ...m, alertsEnabled } : m)),
    }));
    await fetch(`/api/account/watchlist/${modelId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertsEnabled }),
    });
  };

  // Signed out, AccountShell renders this page without the app shell, so the pitch wears the
  // landing's look (its scope, fonts and classes) rather than the shell's.
  const guest = `lp ${lpBody.variable} ${lpDisplay.variable} sc-guest`;

  if (status === 'unauthenticated') {
    return (
      <div className={guest}>
        <section className="lp-hero lp-textured sc-guest-hero">
          <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="lp-wrap sc-guest-grid">
            <div>
              <p className="lp-kicker lp-intro">Watchlist &amp; alerts</p>
              <h1 className="sc-guest-t lp-intro" style={{ ['--d' as string]: '.06s' }}>Track the models you depend on</h1>
              <p className="lp-lead lp-intro" style={{ ['--d' as string]: '.12s' }}>
                Pick the models your product actually uses and we will tell you when their
                measured performance changes — and, just as usefully, when it does not.
                Three models on the free plan.
              </p>
              <div className="lp-cta lp-intro" style={{ ['--d' as string]: '.18s' }}>
                <Link href="/auth/signup" className="lp-btn lp-btn-primary lp-btn-lg">
                  Create a free account <span className="lp-ar" aria-hidden="true">→</span>
                </Link>
                <Link href="/auth/signin?callbackUrl=%2Fwatchlist" className="lp-btn lp-btn-ghost lp-btn-lg">Sign in</Link>
              </div>
            </div>
            <div className="sc-guest-card lp-intro" style={{ ['--d' as string]: '.26s' }}>
              <p className="sc-guest-label">What you get</p>
              <ul className="lp-ticks">
                <li><b>{PLANS.free.watchedModels} models free</b>, {paidCaps()}.</li>
                <li><b>Change alerts</b> by email, sent the day a confirmed drop or a task-level regression appears.</li>
                <li><b>A weekly digest</b> on Mondays: what moved across everything you track, and what held steady.</li>
                <li><b>Tracking and alerting are separate choices</b>: watch as many as your plan allows, and be interrupted only about the ones you actually run.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (loading) {
    return (
      status === 'authenticated'
        ? <div data-page-loading><Loader label="Loading your watchlist" minHeight={420} /></div>
        // Session still resolving: the public chrome is up and studio.css may not be, so no shared Loader.
        : <div data-page-loading className={guest}><div className="sc-guest-load" role="status"><span className="sc-bars" aria-hidden="true"><i /><i /><i /></span>Loading…</div></div>
    );
  }

  const head = (actions?: ReactNode) => (
    <PageHead
      kicker="Monitoring"
      title="Your watchlist"
      lead="The models you track, their latest measured score, and which of them can email you."
      actions={actions}
    />
  );

  if (error) {
    return (
      <>
        {head()}
        <div className="st-body">
          <Note tone="warn">{error}</Note>
        </div>
      </>
    );
  }

  const models = data?.models ?? [];
  const used = data?.used ?? 0;
  const limit = data?.limit ?? null;
  const atLimit = !!limit && used >= limit;
  const hasStale = models.some(m => { const a = daysAgo(m.scoredAt); return a !== null && a > 7; });
  const alerting = models.filter(m => m.alertsEnabled !== false).length;
  const fresh = models.filter(m => { const a = daysAgo(m.scoredAt); return a !== null && a <= 7; }).length;
  const day = data?.scorePeriod === '24h';

  return (
    <>
      {head(
        <>
          <Link href="/account/settings#email" className="st-btn">Email settings</Link>
          {atLimit
            ? <Link href="/pricing" className="st-btn is-primary">Track more <span className="st-ar" aria-hidden="true">→</span></Link>
            : <Link href="/" className="st-btn is-primary">Add models <span className="st-ar" aria-hidden="true">→</span></Link>}
        </>,
      )}

      <div className="st-body">
        <Stats columns={3}>
          <Stat
            value={<CountUp value={used} />}
            unit={limit ? `of ${limit}` : undefined}
            label="Tracked"
            sub={limit
              ? <><Meter used={used} limit={limit} /><span className="sc-stat-note">{atLimit ? 'Your plan’s limit is reached' : `${limit - used} more on your plan`}</span></>
              : 'No limit on your plan'}
          />
          <Stat value={<CountUp value={alerting} />} label="Email me is on" sub="Models that can interrupt you" />
          <Stat
            value={<CountUp value={fresh} />}
            unit={models.length ? `of ${models.length}` : undefined}
            label="Measured in the last 7 days"
            sub={hasStale ? 'Older measurements are marked in amber' : undefined}
          />
        </Stats>

        {models.length === 0 ? (
          <Pane title="Tracked models" sub={`${used}${limit ? ` of ${limit}` : ''} tracked`} ruled>
            <Empty
              title="You are not tracking anything yet"
              actions={<Link href="/" className="st-btn is-primary">Find models to track <span className="st-ar" aria-hidden="true">→</span></Link>}
            >
              Tap the <span className="sc-star" aria-hidden="true">☆</span><span className="st-sr">star</span> beside any model on the{' '}
              <Link href="/">leaderboard</Link> — or open a model and choose <strong>Track this model</strong>.
            </Empty>
          </Pane>
        ) : (
          <Pane
            title="Tracked models"
            sub={<>
              {used}{limit ? ` of ${limit}` : ''} tracked
              {atLimit ? <> · <Link href="/pricing" className="st-link-inline">track more</Link></> : null}
            </>}
            ruled
            flush
            delay={0.06}
            foot={
              <div className="sc-wl-foot">
                <p>
                  Add more with the <span className="sc-star" aria-hidden="true">☆</span><span className="st-sr">star</span> beside any model on the{' '}
                  <Link href="/">leaderboard</Link>. Turning off &ldquo;Email me&rdquo; keeps a model tracked and in your
                  weekly digest, but stops it interrupting you.
                </p>
                {hasStale && (
                  <p>
                    Dates in amber were last measured more than a week ago. We show the
                    measurement date rather than presenting an old number as current.
                  </p>
                )}
                {day && (
                  <p>
                    Scores are each model&rsquo;s Combined average over the last 24 hours. The latest
                    run is part of <Link href="/pricing" className="st-link-inline">{PLANS.pro.label}</Link>.
                  </p>
                )}
              </div>
            }
          >
            <table className="sc-wl">
              <thead>
                <tr>
                  <th scope="col">Model</th>
                  <th scope="col" className="is-num">{day ? '24h score' : 'Score'}</th>
                  <th scope="col">Last measured</th>
                  <th scope="col">Email me</th>
                  <th scope="col"><span className="st-sr">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {models.map(m => {
                  const age = daysAgo(m.scoredAt);
                  const stale = age !== null && age > 7;
                  const on = m.alertsEnabled !== false;
                  return (
                    <tr key={m.modelId}>
                      <td className="sc-c-model">
                        <div className="sc-wl-model">
                          <ProviderMark provider={m.vendor || ''} size="lg" />
                          <div className="sc-wl-id">
                            <Link href={`/models/${m.modelId}`} className="sc-wl-name">{m.name}</Link>
                            <span className="sc-wl-vendor">{m.vendor ? vendorName(m.vendor) : 'Model'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="sc-c-score is-num">
                        <span className={`sc-wl-score${m.score === null ? ' is-none' : ''}`}>{m.score === null ? '—' : m.score.toFixed(1)}</span>
                      </td>
                      <td className="sc-c-age">
                        <Pill tone={stale ? 'warn' : age === null ? undefined : 'good'}>
                          {age === null ? (day ? 'Not in 24 hours' : 'Never measured') : age === 0 ? 'Measured today' : `Measured ${age}d ago`}
                        </Pill>
                      </td>
                      <td className="sc-c-mail">
                        <label className="sc-wl-mail">
                          <span className="sc-sw">
                            <input
                              type="checkbox"
                              role="switch"
                              checked={on}
                              onChange={e => setAlerts(m.modelId, e.target.checked)}
                              aria-label={`Email me about ${m.name}`}
                              title={on ? `Stop emailing me about ${m.name}` : `Email me when ${m.name} changes`}
                            />
                            <i aria-hidden="true" />
                          </span>
                          Email me
                        </label>
                      </td>
                      <td className="sc-c-act">
                        <button type="button" onClick={() => remove(m.modelId)} className="st-btn is-sm is-quiet">
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Pane>
        )}
      </div>
    </>
  );
}
