import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';
import StatusBoard from '@/components/landing/StatusBoard';
import LandingEffects from '@/components/landing/LandingEffects';
import type { HealthRow } from '@/components/landing/types';
import { lpBody, lpDisplay } from '@/lib/fonts';
import '@/styles/landing.css';
import '@/styles/status-page.css';

/**
 * Public provider status.
 *
 * The health monitor has probed every provider every ten minutes for a year and the
 * result was rendered nowhere: the one component that read it (`StupidMeter`) is
 * imported and never mounted, and the homepage strip that looks like a status display
 * is computed from benchmark score trends, not availability.
 *
 * The hard part of this page is not the chart. It is refusing to overclaim. We probe
 * from ONE machine, with OUR key, once every ten minutes. So:
 *
 *   - a check that failed because our own key was rejected or our own bill was unpaid
 *     is reported as "not measured", never as the provider being down;
 *   - so is a check that came back empty because our probe asked a thinking model for
 *     one token — which is exactly what made Google look dead for 27 hours this week,
 *     and which this page shows rather than hides;
 *   - "slow" is our round-trip latency from a box that is often running a benchmark
 *     sweep at the same time, so the median sits next to it.
 *
 * Everything here comes from GET /providers/status, which does that classification and
 * also turns each provider's JSON error body into a sentence (summariseProviderError),
 * so the page and the outage email show the same words.
 */

export const metadata: Metadata = {
  title: 'AI Provider Status | Live Uptime for OpenAI, Anthropic, Google and more',
  description:
    'Live availability for every AI provider we benchmark — OpenAI, Anthropic, Google, DeepSeek, Kimi and GLM. Checked every 10 minutes, with the checks we could not make reported separately.',
  alternates: { canonical: '/status' },
  openGraph: {
    title: 'AI Provider Status',
    description: 'Live availability for every AI provider we benchmark, checked every 10 minutes.',
    url: 'https://aistupidlevel.info/status',
    type: 'website',
  },
};

/** One minute: the check cadence is ten, so anything finer is just load. */
export const revalidate = 60;

interface HourBucket { t: string; total: number; down: number; degraded: number; unmeasured: number }
interface ProviderStatus {
  provider: string;
  status: 'operational' | 'degraded' | 'down' | 'unmeasured';
  cause: 'provider' | 'our-account' | 'probe' | 'our-server' | null;
  responseTime: number | null;
  lastChecked: string;
  error: string | null;
  uptime24h: number | null;
  uptime7d: number | null;
  checks24h: number;
  unmeasured24h: number;
  checks7d: number;
  unmeasured7d: number;
  medianLatencyMs: number | null;
  hours: HourBucket[];
}
interface Episode {
  provider: string;
  kind: 'down' | 'slow';
  cause: 'provider' | 'our-account' | 'probe' | 'our-server' | 'latency';
  startedAt: string;
  endedAt: string;
  checks: number;
  minutes: number;
  ongoing: boolean;
  error: string | null;
}
interface StatusPayload {
  generatedAt: string;
  meta: { checkIntervalMinutes: number; retentionDays: number; degradedAboveMs: number; probe: string; ourFaultSince?: string | null };
  providers: ProviderStatus[];
  episodes: Episode[];
}

const LABEL: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  deepseek: 'DeepSeek',
  kimi: 'Moonshot (Kimi)',
  glm: 'Z.ai (GLM)',
  xai: 'xAI',
};

async function getStatus(): Promise<StatusPayload | null> {
  // Absolute URL: a relative path has no origin server-side. Straight to the API on
  // loopback, so nginx is not in the way.
  const base = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  try {
    const res = await fetch(`${base}/providers/status`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.success ? (json as StatusPayload) : null;
  } catch {
    // A failed fetch must not break the page — it renders an honest "unavailable".
    return null;
  }
}

function ago(iso: string): string {
  const ms = Date.now() - Date.parse(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z'));
  if (!Number.isFinite(ms)) return 'unknown';
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m === 1) return '1 minute ago';
  if (m < 60) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h === 1) return '1 hour ago';
  if (h < 48) return `${h} hours ago`;
  return `${Math.round(h / 24)} days ago`;
}

function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

const STATE_TEXT: Record<ProviderStatus['status'], string> = {
  operational: 'Answering',
  degraded: 'Slow',
  down: 'Not answering',
  unmeasured: 'Not measured',
};

/** Build a fixed 168-hour timeline so gaps in the data are visible as gaps. */
function timeline(hours: HourBucket[]): Array<HourBucket & { known: boolean }> {
  const byHour = new Map(hours.map(h => [h.t, h]));
  const out: Array<HourBucket & { known: boolean }> = [];
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  for (let i = 167; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 3600_000).toISOString().replace('.000Z', 'Z');
    const found = byHour.get(t);
    out.push(found ? { ...found, known: true } : { t, total: 0, down: 0, degraded: 0, unmeasured: 0, known: false });
  }
  return out;
}

/** The board's cell code for one hour (components/landing/StatusBoard): an hour with no check stays empty. */
function cell(h: HourBucket & { known: boolean }): string {
  if (!h.known || h.total === 0) return 'e';
  if (h.down > 0) return 'b';
  if (h.unmeasured >= h.total) return 'o';
  if (h.degraded > 0) return 'w';
  return '.';
}

/** A provider as the board draws it, on the fixed 168-hour timeline, so gaps stay gaps. */
function boardRow(p: ProviderStatus): HealthRow {
  const hours = timeline(p.hours);
  return {
    provider: p.provider,
    status: p.status,
    uptime7d: p.uptime7d,
    latencyMs: p.medianLatencyMs ?? p.responseTime,
    lastChecked: p.lastChecked,
    lastHour: hours[hours.length - 1].t,
    cells: hours.map(cell).join(''),
  };
}

/** One line per provider+cause, rather than one line per episode. */
interface GroupedEpisodes { provider: string; cause: Episode['cause']; episodes: number; minutes: number; error: string | null; lastEndedAt: string | null; ongoing: boolean }
/**
 * Grouping used to drop the timestamps, so this list showed a duration and nothing else.
 * "DeepSeek 7h 20m — our key or our bill" reads as happening now; it was seven days old and
 * long resolved. The outage list above has always shown when an episode started, and the
 * omission here is the whole reason a settled record looked like a live incident. Keep the
 * most recent end so the line can say when it was, and whether it is still going.
 */
function groupEpisodes(list: Episode[]): GroupedEpisodes[] {
  const by = new Map<string, GroupedEpisodes>();
  for (const e of list) {
    const key = `${e.provider}:${e.cause}`;
    const g = by.get(key);
    const end = e.endedAt ?? e.startedAt ?? null;
    if (g) {
      g.episodes++; g.minutes += e.minutes;
      if (!g.error) g.error = e.error;
      if (end && (!g.lastEndedAt || end > g.lastEndedAt)) g.lastEndedAt = end;
      g.ongoing = g.ongoing || !!e.ongoing;
    } else {
      by.set(key, { provider: e.provider, cause: e.cause, episodes: 1, minutes: e.minutes, error: e.error, lastEndedAt: end, ongoing: !!e.ongoing });
    }
  }
  return Array.from(by.values()).sort((a, b) => (b.lastEndedAt ?? '').localeCompare(a.lastEndedAt ?? ''));
}

const CAUSE_TEXT: Record<Episode['cause'], string> = {
  provider: 'provider did not answer',
  'our-account': 'our key or our bill',
  probe: 'our probe was wrong for this model',
  'our-server': 'our server or its connection',
  latency: 'slow response',
};

/** The board's order (components/landing/StatusBoard), so the cards below read in the same order. */
const ORDER = ['openai', 'anthropic', 'google', 'deepseek', 'kimi', 'glm'];
const byOrder = (a: ProviderStatus, b: ProviderStatus) =>
  (ORDER.indexOf(a.provider) + 1 || 99) - (ORDER.indexOf(b.provider) + 1 || 99);

/** An hour's tooltip, in UTC: the server does not know the visitor's time zone. */
function hourTitle(h: HourBucket & { known: boolean }): string {
  const when = h.t.replace('T', ' ').replace(':00:00Z', ':00 UTC');
  if (!h.known || h.total === 0) return `${when} — no checks`;
  const parts = [`${h.total} check${h.total === 1 ? '' : 's'}`];
  if (h.down) parts.push(`${h.down} not answering`);
  if (h.degraded) parts.push(`${h.degraded} slow`);
  if (h.unmeasured) parts.push(`${h.unmeasured} not measured`);
  return `${when} — ${parts.join(', ')}`;
}

const STATE_TONE: Record<ProviderStatus['status'], string> = {
  operational: 'ok', degraded: 'warn', down: 'bad', unmeasured: 'na',
};

const up = (d?: string, cls = ''): { className: string; style?: CSSProperties } =>
  ({ className: `${cls} lp-up`.trim(), ...(d ? { style: { '--d': d } as CSSProperties } : {}) });
const intro = (d: string): CSSProperties => ({ '--d': d } as CSSProperties);

function Logo({ provider }: { provider: string }) {
  return (
    <span className="lp-lgc" aria-hidden="true">
      <img src={`/logos/${provider}.svg`} alt="" width={18} height={18} loading="lazy" />
    </span>
  );
}

/** The landing page's look (styles/landing.css) inside the site's own top bar, like /ai-drift-detection. */
function Shell({ children }: { children: ReactNode }) {
  return (
    <SubpageLayout>
      <div className={`lp lp-sub lp-status ${lpBody.variable} ${lpDisplay.variable}`}>
        {/* Reveal-on-scroll hides blocks only once scripts run; the failsafe shows everything if they never do. */}
        <script dangerouslySetInnerHTML={{ __html: "(function(){var d=document.documentElement;d.classList.add('lp-js');setTimeout(function(){if(!window.__lpReady)d.classList.remove('lp-js')},4000)})();" }} />
        <LandingEffects />
        {children}
      </div>
    </SubpageLayout>
  );
}

export default async function StatusPage() {
  const data = await getStatus();

  if (!data) {
    return (
      <Shell>
        <header className="lp-hero lp-textured">
          <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="lp-wrap">
            <p className="lp-kicker lp-intro" style={intro('.04s')}>Provider status</p>
            <h1 className="lp-h1 lp-intro" style={intro('.1s')}>Provider status</h1>
            <p className="lp-lead lp-intro" style={intro('.18s')}>
              The status feed is not responding right now. That says nothing about the providers —
              only about this page.
            </p>
          </div>
        </header>
      </Shell>
    );
  }

  const answering = data.providers.filter(p => p.status === 'operational').length;
  const notAnswering = data.providers.filter(p => p.status === 'down');
  const unmeasured = data.providers.filter(p => p.status === 'unmeasured');

  const outages = data.episodes.filter(e => e.kind === 'down' && e.cause === 'provider');
  const notMeasured = data.episodes.filter(e => e.cause === 'our-account' || e.cause === 'probe' || e.cause === 'our-server');
  const slow = data.episodes.filter(e => e.cause === 'latency');

  const headline =
    notAnswering.length > 0
      ? `${notAnswering.map(p => LABEL[p.provider] ?? p.provider).join(', ')} did not answer our last check`
      : unmeasured.length > 0
        ? `${answering} of ${data.providers.length} providers answered the last check; ${unmeasured.length} could not be measured`
        : `All ${data.providers.length} providers answered the last check`;
  const tone = notAnswering.length ? 'is-bad' : unmeasured.length ? 'is-na' : 'is-ok';
  const days = data.meta.retentionDays;

  return (
    <Shell>
      <header className="lp-hero lp-textured">
        <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="lp-wrap">
          <div className="lp-hero-row">
            <div>
              <p className="lp-kicker lp-intro" style={intro('.04s')}>Provider status</p>
              <h1 className="lp-h1 lp-intro" style={intro('.1s')}>
                Provider status <span className="lp-b">checked every {data.meta.checkIntervalMinutes} minutes</span>
              </h1>
              <p className="lp-lead lp-intro" style={intro('.18s')}>
                We ask every provider one small question every {data.meta.checkIntervalMinutes} minutes and record what
                comes back. This is that record, kept for {days} days.
              </p>
              <p className={`ps-banner ${tone} lp-intro`} style={intro('.26s')} role="status">
                <span className="ps-dot" aria-hidden="true" />
                <b>{headline}</b>
                <span className="ps-when">checked {ago(data.providers[0]?.lastChecked ?? data.generatedAt)}</span>
              </p>
            </div>
            <dl className="lp-facts lp-intro" style={intro('.34s')}>
              <div><dt>{answering}/{data.providers.length}</dt><dd>providers answered the last check</dd></div>
              <div><dt>{data.meta.checkIntervalMinutes} min</dt><dd>between checks, the same call for every provider</dd></div>
              <div><dt>{days} d</dt><dd>of record kept, with the checks we could not make listed separately</dd></div>
            </dl>
          </div>
        </div>
      </header>

      {/* ── The board ─────────────────────────────────────────────────── */}
      <section className="lp-sec lp-A">
        <div className="lp-wrap">
          <div className="lp-head lp-head-split lp-up">
            <p className="lp-kicker">Last 7 days</p>
            <h2 className="lp-h2">Every provider, hour by hour</h2>
            <p className="lp-lead">
              Each bar is one hour of checks. A check that failed on our side is hatched and counts as neither uptime
              nor downtime, and an hour with no check at all stays empty, so a gap in the record shows as a gap.
            </p>
          </div>
          <StatusBoard providers={data.providers.map(boardRow)} wording="status" labels={LABEL} />
        </div>
      </section>

      {/* ── Providers ─────────────────────────────────────────────────── */}
      <section className="lp-sec lp-B">
        <div className="lp-wrap">
          <div className="lp-head lp-head-split lp-up">
            <p className="lp-kicker">By provider</p>
            <h2 className="lp-h2">The last 24 hours and 7 days</h2>
            <p className="lp-lead">
              &ldquo;Answered&rdquo; counts only the checks we could make. The median reply is our round trip, from a
              machine that is often running a benchmark sweep at the same time.
            </p>
          </div>
          <div className="ps-grid">
            {[...data.providers].sort(byOrder).map((p, i) => {
              const total24 = p.checks24h + p.unmeasured24h;
              const day = timeline(p.hours).slice(-24);
              return (
                <article key={p.provider} {...up(`${(i % 3) * 0.06}s`, 'ps-card')}>
                  <header className="ps-card-head">
                    <Logo provider={p.provider} />
                    <h3>{LABEL[p.provider] ?? p.provider}</h3>
                    <span className={`lp-pill ${STATE_TONE[p.status]}`}>{STATE_TEXT[p.status]}</span>
                  </header>

                  <div className="ps-figs">
                    <div>
                      <div className="ps-fig">{p.uptime24h === null ? '—' : `${p.uptime24h}%`}</div>
                      <div className="ps-fig-l">answered, 24h</div>
                    </div>
                    <div>
                      <div className="ps-fig">{p.uptime7d === null ? '—' : `${p.uptime7d}%`}</div>
                      <div className="ps-fig-l">answered, 7d</div>
                    </div>
                    <div>
                      <div className="ps-fig">
                        {p.medianLatencyMs === null ? '—' : `${(p.medianLatencyMs / 1000).toFixed(1)}s`}
                      </div>
                      <div className="ps-fig-l">median reply</div>
                    </div>
                  </div>

                  <div className="ps-measured">
                    {/* The last 24 hours, one cell an hour: where in the day the 24h figure above came from. */}
                    <div className="ps-day" aria-hidden="true">
                      {day.map((h, k) => (
                        <i key={h.t} className={cell(h)} title={hourTitle(h)} style={{ '--d': `${(k * 0.025).toFixed(3)}s` } as CSSProperties} />
                      ))}
                    </div>
                    <div className="ps-day-axis" aria-hidden="true"><span>24 hours ago</span><span>now</span></div>
                    <p>
                      {p.checks24h} of {total24} checks measured in the last 24h
                      {p.unmeasured24h > 0 && (
                        <>
                          {' '}— the other {p.unmeasured24h} failed on our side, so they count as neither uptime nor
                          downtime.
                        </>
                      )}
                    </p>
                  </div>
                  {p.status !== 'operational' && p.error && (
                    <p className="ps-error">
                      Last error: <span>{p.error}</span>
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── What we recorded ──────────────────────────────────────────── */}
      <section className="lp-sec lp-A">
        <div className="lp-wrap">
          <div className="lp-head lp-up">
            <p className="lp-kicker">The record</p>
            <h2 className="lp-h2">What we recorded</h2>
          </div>

          <div className="ps-block lp-up">
            <div>
              <h3>Outages we recorded</h3>
            </div>
            {outages.length === 0 ? (
              <p className="ps-empty">
                <span className="ps-empty-dot" aria-hidden="true" />
                No provider failed to answer in the last {days} days.
              </p>
            ) : (
              <ul className="ps-log is-bad">
                {outages.map((e, i) => (
                  <li key={i}>
                    <span className="ps-log-p"><Logo provider={e.provider} />{LABEL[e.provider] ?? e.provider}</span>
                    <span className="ps-log-dur">lasted {duration(e.minutes)}</span>
                    <span className="ps-log-when">
                      {e.startedAt.replace(' ', ' · ')} UTC{e.ongoing ? ' — ongoing' : ''}
                    </span>
                    {e.error && <span className="ps-log-err">{e.error}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="ps-block lp-up">
            <div>
              <h3>Checks we could not make</h3>
              <p className="ps-note">
                These are our failures, not the providers&rsquo;. We publish them because leaving them out would
                turn our own expired keys, unpaid invoices, broken probes and server trouble into somebody else&rsquo;s downtime —
                and because a gap in the record is a fact about the record. Each line says how long it
                lasted and when it last happened: anything not marked ongoing is over, and stays listed
                only until it falls out of the {days}-day window.
                {data.meta.ourFaultSince && (
                  <> This list starts from{' '}
                  {new Date(data.meta.ourFaultSince).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
                  Before that the provider accounts were unfunded and every provider returned a billing
                  error; those checks are still recorded and still count against our uptime, but
                  republishing a resolved funding gap for a week alongside live figures said something
                  about today that was not true.</>
                )}
              </p>
            </div>
            {notMeasured.length === 0 ? (
              <p className="ps-empty">
                <span className="ps-empty-dot" aria-hidden="true" />
                None in the last {days} days.
              </p>
            ) : (
              <ul className="ps-log is-ours">
                {groupEpisodes(notMeasured).map((g, i) => (
                  <li key={i}>
                    <span className="ps-log-p"><Logo provider={g.provider} />{LABEL[g.provider] ?? g.provider}</span>
                    <span className="ps-log-dur">lasted {duration(g.minutes)}</span>
                    <span className="ps-log-when">
                      {CAUSE_TEXT[g.cause]} · {g.episodes} episode{g.episodes === 1 ? '' : 's'}
                      {g.ongoing
                        ? ' — ongoing'
                        : g.lastEndedAt
                          ? ` · last seen ${ago(g.lastEndedAt)}, since resolved`
                          : ''}
                    </span>
                    {g.error && <span className="ps-log-err">{g.error}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {slow.length > 0 && (
            <div className="ps-block lp-up">
              <div>
                <h3>Slow periods</h3>
                <p className="ps-note">
                  Two or more consecutive checks that took longer than {(data.meta.degradedAboveMs / 1000).toFixed(0)}{' '}
                  seconds. Measured from our machine, which is often running a benchmark sweep at the same time, so
                  read these next to the median above rather than on their own.
                </p>
              </div>
              <ul className="ps-log is-warn">
                {groupEpisodes(slow).map((g, i) => (
                  <li key={i}>
                    <span className="ps-log-p"><Logo provider={g.provider} />{LABEL[g.provider] ?? g.provider}</span>
                    <span className="ps-log-dur">lasted {duration(g.minutes)}</span>
                    <span className="ps-log-when">
                      {g.episodes} episode{g.episodes === 1 ? '' : 's'} in the last {days} days
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* ── Method ────────────────────────────────────────────────────── */}
      <section className="lp-sec lp-C" aria-labelledby="ps-method">
        <div className="lp-wrap lp-faq">
          <div className="lp-head lp-up">
            <p className="lp-kicker">Method</p>
            <h2 className="lp-h2" id="ps-method">How this is measured</h2>
          </div>
          <div className="lp-up">
            <dl className="ps-method">
              <div>
                <dt>The check</dt>
                <dd>{data.meta.probe} It is the same call for every provider, so the numbers are comparable.</dd>
              </div>
              <div>
                <dt>What &ldquo;answered&rdquo; means</dt>
                <dd>
                  The provider returned usable content. It does not mean the model was correct, fast, or good —
                  that is what the <Link href="/">benchmarks</Link> are for.
                </dd>
              </div>
              <div>
                <dt>When a check fails</dt>
                <dd>
                  We ask again fifteen seconds later and record the second answer, so one dropped connection is not
                  published as ten minutes of outage. If the provider still cannot be reached, we test our own side
                  before blaming theirs: whether our server stalled while the check was in flight, whether other
                  providers failed to connect at the same moment, and whether two independent control endpoints
                  answer. Any of those means the failure was ours — it is listed under checks we could not make
                  and counts as neither uptime nor downtime.
                </dd>
              </div>
              <div>
                <dt>What we do not claim</dt>
                <dd>
                  One probe, every {data.meta.checkIntervalMinutes} minutes, from one machine in Germany, on one
                  account. A provider can be down for us and up for you, or the reverse. If your own traffic
                  disagrees with this page, trust your own traffic.
                </dd>
              </div>
              <div>
                <dt>When a provider is down</dt>
                <dd>
                  We stop benchmarking it rather than publishing a number we did not measure, and run the missed
                  models as soon as it answers again. An outage leaves a gap in the charts — that gap is deliberate.
                </dd>
              </div>
            </dl>
            <p className="ps-gen">
              Generated {new Date(data.generatedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC · refreshed
              every minute
            </p>
          </div>
        </div>
      </section>
    </Shell>
  );
}
