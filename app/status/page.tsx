import type { Metadata } from 'next';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';

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
  cause: 'provider' | 'our-account' | 'probe' | null;
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
  cause: 'provider' | 'our-account' | 'probe' | 'latency';
  startedAt: string;
  endedAt: string;
  checks: number;
  minutes: number;
  ongoing: boolean;
  error: string | null;
}
interface StatusPayload {
  generatedAt: string;
  meta: { checkIntervalMinutes: number; retentionDays: number; degradedAboveMs: number; probe: string };
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

function barClass(h: HourBucket & { known: boolean }): string {
  if (!h.known || h.total === 0) return 'status-bar status-bar--none';
  if (h.down > 0) return 'status-bar status-bar--down';
  if (h.unmeasured >= h.total) return 'status-bar status-bar--unmeasured';
  if (h.degraded > 0) return 'status-bar status-bar--slow';
  return 'status-bar status-bar--up';
}

function barTitle(h: HourBucket & { known: boolean }): string {
  const when = h.t.replace('T', ' ').replace(':00:00Z', ':00 UTC');
  if (!h.known || h.total === 0) return `${when} — no checks`;
  const parts = [`${h.total} check${h.total === 1 ? '' : 's'}`];
  if (h.down) parts.push(`${h.down} not answering`);
  if (h.degraded) parts.push(`${h.degraded} slow`);
  if (h.unmeasured) parts.push(`${h.unmeasured} not measured`);
  return `${when} — ${parts.join(', ')}`;
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
  latency: 'slow response',
};

export default async function StatusPage() {
  const data = await getStatus();

  if (!data) {
    return (
      <SubpageLayout>
        <div className="status-page">
          <h1 className="status-h1">Provider status</h1>
          <p className="status-lede">
            The status feed is not responding right now. That says nothing about the providers —
            only about this page.
          </p>
        </div>
      </SubpageLayout>
    );
  }

  const answering = data.providers.filter(p => p.status === 'operational').length;
  const notAnswering = data.providers.filter(p => p.status === 'down');
  const unmeasured = data.providers.filter(p => p.status === 'unmeasured');

  const outages = data.episodes.filter(e => e.kind === 'down' && e.cause === 'provider');
  const notMeasured = data.episodes.filter(e => e.cause === 'our-account' || e.cause === 'probe');
  const slow = data.episodes.filter(e => e.cause === 'latency');

  const headline =
    notAnswering.length > 0
      ? `${notAnswering.map(p => LABEL[p.provider] ?? p.provider).join(', ')} did not answer our last check`
      : unmeasured.length > 0
        ? `${answering} of ${data.providers.length} providers answered the last check; ${unmeasured.length} could not be measured`
        : `All ${data.providers.length} providers answered the last check`;

  return (
    <SubpageLayout>
      <div className="status-page">
        <h1 className="status-h1">Provider status</h1>
        <p className="status-lede">
          We ask every provider one small question every {data.meta.checkIntervalMinutes} minutes and record what
          comes back. This is that record, kept for {data.meta.retentionDays} days.
        </p>

        <div className={`status-banner ${notAnswering.length ? 'status-banner--bad' : 'status-banner--ok'}`}>
          <strong>{headline}</strong>
          <span className="status-banner-time">checked {ago(data.providers[0]?.lastChecked ?? data.generatedAt)}</span>
        </div>

        <div className="status-legend">
          <span><i className="status-bar status-bar--up" /> answered</span>
          <span><i className="status-bar status-bar--slow" /> slow</span>
          <span><i className="status-bar status-bar--down" /> did not answer</span>
          <span><i className="status-bar status-bar--unmeasured" /> not measured</span>
          <span><i className="status-bar status-bar--none" /> no check</span>
        </div>

        {/* ── Providers ─────────────────────────────────────────────────── */}
        <div className="status-grid">
          {data.providers.map(p => (
            <section key={p.provider} className="status-card">
              <header className="status-card-head">
                <h2 className="status-name">{LABEL[p.provider] ?? p.provider}</h2>
                <span className={`status-pill status-pill--${p.status}`}>{STATE_TEXT[p.status]}</span>
              </header>

              <div className="status-figures">
                <div>
                  <div className="status-figure">{p.uptime24h === null ? '—' : `${p.uptime24h}%`}</div>
                  <div className="status-figure-label">answered, 24h</div>
                </div>
                <div>
                  <div className="status-figure">{p.uptime7d === null ? '—' : `${p.uptime7d}%`}</div>
                  <div className="status-figure-label">answered, 7d</div>
                </div>
                <div>
                  <div className="status-figure">
                    {p.medianLatencyMs === null ? '—' : `${(p.medianLatencyMs / 1000).toFixed(1)}s`}
                  </div>
                  <div className="status-figure-label">median reply</div>
                </div>
              </div>

              <div className="status-bars" aria-hidden="true">
                {timeline(p.hours).map(h => (
                  <span key={h.t} className={barClass(h)} title={barTitle(h)} />
                ))}
              </div>
              <div className="status-bars-axis">
                <span>7 days ago</span>
                <span>now</span>
              </div>

              <p className="status-measured">
                {p.checks24h} of {p.checks24h + p.unmeasured24h} checks measured in the last 24h
                {p.unmeasured24h > 0 && (
                  <>
                    {' '}— the other {p.unmeasured24h} failed on our side, so they count as neither uptime nor
                    downtime.
                  </>
                )}
              </p>
              {p.status !== 'operational' && p.error && (
                <p className="status-error">
                  Last error: <span>{p.error}</span>
                </p>
              )}
            </section>
          ))}
        </div>

        {/* ── What we recorded ──────────────────────────────────────────── */}
        <section className="status-section">
          <h2 className="status-h2">Outages we recorded</h2>
          {outages.length === 0 ? (
            <p className="status-empty">
              No provider failed to answer in the last {data.meta.retentionDays} days.
            </p>
          ) : (
            <ul className="status-episodes">
              {outages.map((e, i) => (
                <li key={i}>
                  <span className="status-episode-provider">{LABEL[e.provider] ?? e.provider}</span>
                  <span className="status-episode-dur">{duration(e.minutes)}</span>
                  <span className="status-episode-when">
                    {e.startedAt.replace(' ', ' · ')} UTC{e.ongoing ? ' — ongoing' : ''}
                  </span>
                  {e.error && <span className="status-episode-err">{e.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="status-section">
          <h2 className="status-h2">Checks we could not make</h2>
          <p className="status-note">
            These are our failures, not the providers&rsquo;. We publish them because leaving them out would
            turn our own expired keys, unpaid invoices and broken probes into somebody else&rsquo;s downtime —
            and because a gap in the record is a fact about the record. Each line says when it last
            happened: anything not marked ongoing is over, and stays listed only until it falls out of
            the {data.meta.retentionDays}-day window.
          </p>
          {notMeasured.length === 0 ? (
            <p className="status-empty">None in the last {data.meta.retentionDays} days.</p>
          ) : (
            <ul className="status-episodes">
              {groupEpisodes(notMeasured).map((g, i) => (
                <li key={i}>
                  <span className="status-episode-provider">{LABEL[g.provider] ?? g.provider}</span>
                  <span className="status-episode-dur">{duration(g.minutes)}</span>
                  <span className="status-episode-when">
                    {CAUSE_TEXT[g.cause]} · {g.episodes} episode{g.episodes === 1 ? '' : 's'}
                    {g.ongoing
                      ? ' — ongoing'
                      : g.lastEndedAt
                        ? ` · last seen ${ago(g.lastEndedAt)}, since resolved`
                        : ''}
                  </span>
                  {g.error && <span className="status-episode-err">{g.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {slow.length > 0 && (
          <section className="status-section">
            <h2 className="status-h2">Slow periods</h2>
            <p className="status-note">
              Two or more consecutive checks that took longer than {(data.meta.degradedAboveMs / 1000).toFixed(0)}{' '}
              seconds. Measured from our machine, which is often running a benchmark sweep at the same time, so
              read these next to the median above rather than on their own.
            </p>
            <ul className="status-episodes">
              {groupEpisodes(slow).map((g, i) => (
                <li key={i}>
                  <span className="status-episode-provider">{LABEL[g.provider] ?? g.provider}</span>
                  <span className="status-episode-dur">{duration(g.minutes)}</span>
                  <span className="status-episode-when">
                    {g.episodes} episode{g.episodes === 1 ? '' : 's'} in the last {data.meta.retentionDays} days
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Method ────────────────────────────────────────────────────── */}
        <section className="status-section">
          <h2 className="status-h2">How this is measured</h2>
          <dl className="status-method">
            <dt>The check</dt>
            <dd>{data.meta.probe} It is the same call for every provider, so the numbers are comparable.</dd>

            <dt>What &ldquo;answered&rdquo; means</dt>
            <dd>
              The provider returned usable content. It does not mean the model was correct, fast, or good —
              that is what the <Link href="/">benchmarks</Link> are for.
            </dd>

            <dt>What we do not claim</dt>
            <dd>
              One probe, every {data.meta.checkIntervalMinutes} minutes, from one machine in Germany, on one
              account. A provider can be down for us and up for you, or the reverse. If your own traffic
              disagrees with this page, trust your own traffic.
            </dd>

            <dt>When a provider is down</dt>
            <dd>
              We stop benchmarking it rather than publishing a number we did not measure, and run the missed
              models as soon as it answers again. An outage leaves a gap in the charts — that gap is deliberate.
            </dd>
          </dl>
          <p className="status-generated">
            Generated {new Date(data.generatedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC · refreshed
            every minute
          </p>
        </section>
      </div>
    </SubpageLayout>
  );
}
