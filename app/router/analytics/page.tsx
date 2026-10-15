'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import RouterLayout from '@/components/RouterLayout';
import SubscriptionGuard, { useCapability } from '@/components/SubscriptionGuard';
import { apiClient } from '@/lib/api-client';
import type { AnalyticsOverview, TimelineData, CostSavings, RecentRequest } from '@/lib/api-client';
import { PageHead, Pane, Stats, Stat, CountUp, Loader, Empty, Note, Tag, ProviderMark, useModelNames, PROVIDER_LABEL } from '@/components/studio';
import { useReducedMotion } from '@/components/landing/util';
import '@/styles/studio-insights.css';

type Range = '7d' | '30d' | '90d';

const RANGES: Array<{ key: Range; label: string; days: number }> = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
];

const LEAD = 'Track usage, costs and performance metrics for the requests the Smart Router served.';

/** The API sends most figures as strings ("12.3456", "98.50"); 0 when absent or unreadable. */
const num = (v: string | number | null | undefined): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};
/** Dollars: cents from $1 up, four decimals below that so a small spend never reads as $0.00. */
const moneyFor = (final: number) => {
  const d = final === 0 || Math.abs(final) >= 1 ? 2 : 4;
  return (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
};
const money = (n: number) => moneyFor(n)(n);
const tokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : Math.round(n).toLocaleString('en-US'));
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K` : String(Math.round(n)));
const axisMoney = (v: number) => (v === 0 ? '$0' : `$${v < 0.01 ? v.toFixed(4) : v < 10 ? v.toFixed(2) : Math.round(v).toLocaleString('en-US')}`);

/** A log time: the clock time for today's entries, the date as well for older ones. */
function when(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString()
    : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface DayPoint { key: string; label: string; long: string; requests: number; cost: number; successRate: number | null }

/**
 * One point per UTC day across the chosen window. The API groups by day and leaves out days
 * with no requests; they are filled in as zero so the x-axis is real time, not a list of
 * active days.
 */
function dailySeries(rows: TimelineData['timeline'], days: number): { points: DayPoint[]; active: number } {
  const DAY = 86_400_000;
  const startKey = new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
  const todayKey = new Date().toISOString().slice(0, 10);
  const byDay = new Map(rows.map(r => [String(r.period).slice(0, 10), r]));
  const points: DayPoint[] = [];
  let active = 0;
  for (let t = Date.parse(`${startKey}T00:00:00Z`); ; t += DAY) {
    const key = new Date(t).toISOString().slice(0, 10);
    if (key > todayKey || points.length > 400) break;
    const r = byDay.get(key);
    if (r) active++;
    const d = new Date(t);
    points.push({
      key,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      long: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
      requests: r ? num(r.requests) : 0,
      cost: r ? num(r.cost) : 0,
      successRate: r ? num(r.successRate) : null,
    });
  }
  return { points, active };
}

function ChartTip({ active, payload, value, detail }: {
  active?: boolean; payload?: Array<{ payload: DayPoint }>;
  value: (p: DayPoint) => string; detail?: (p: DayPoint) => string | null;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const extra = detail?.(p);
  return (
    <div className="sa-tip">
      <strong>{value(p)}</strong>
      <span><i className="sa-tip-k" aria-hidden="true" />{p.long}</span>
      {extra && <span>{extra}</span>}
    </div>
  );
}

/** A single-series daily trend: accent line over a 10% wash, hairline grid, crosshair tooltip. */
function TrendChart({ points, dataKey, label, axis, value, detail }: {
  points: DayPoint[]; dataKey: 'requests' | 'cost'; label: string;
  axis: (v: number) => string; value: (p: DayPoint) => string; detail?: (p: DayPoint) => string | null;
}) {
  const reduced = useReducedMotion();
  return (
    <div className="sa-chart" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--lp-line)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--lp-line2)' }} tickMargin={8}
            minTickGap={26} interval="preserveStartEnd" tick={{ fill: 'var(--lp-fg3)', fontSize: 11 }} />
          <YAxis width={56} tickLine={false} axisLine={false} tickMargin={6} tickFormatter={axis}
            allowDecimals={dataKey === 'cost'} tick={{ fill: 'var(--lp-fg3)', fontSize: 11 }} />
          <Tooltip cursor={{ stroke: 'var(--lp-line2)', strokeWidth: 1 }} isAnimationActive={false}
            content={<ChartTip value={value} detail={detail} />} />
          <Area type="monotone" dataKey={dataKey} stroke="var(--lp-accent)" strokeWidth={2} fill="var(--lp-accent)" fillOpacity={0.1}
            dot={false} activeDot={{ r: 4.5, fill: 'var(--lp-accent)', stroke: 'var(--lp-card)', strokeWidth: 2 }}
            isAnimationActive={!reduced} animationDuration={900} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ShareRow { id: string; lead?: ReactNode; name: ReactNode; title?: string; value: string; meta: string; pct: number }

/** A ranked share list: name and amount, a bar for the share, the count and the percentage under it. */
function ShareList({ rows }: { rows: ShareRow[] }) {
  return (
    <ul className="sa-shares">
      {rows.map((r, i) => (
        <li key={r.id} className={`sa-share${r.lead ? '' : ' is-plain'}${i === 0 ? ' is-top' : ''}`}>
          {r.lead}
          <div className="sa-share-main">
            <div className="sa-share-top">
              <span className="sa-share-name" title={r.title}>{r.name}</span>
              <span className="sa-share-val">{r.value}</span>
            </div>
            <div className="sa-bar" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, r.pct))}%` }} /></div>
            <div className="sa-share-meta"><span>{r.meta}</span><span>{r.pct.toFixed(1)}%</span></div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function RouterAnalyticsPage() {
  const { data: session, status } = useSession();
  const [timeRange, setTimeRange] = useState<Range>('30d');
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [costSavings, setCostSavings] = useState<CostSavings | null>(null);
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const names = useModelNames();

  const access = useCapability('routing-analytics');
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id && access.allowed) {
      apiClient.setUserId(session.user.id);
      fetchAnalytics();
    } else if (status === 'unauthenticated') {
      setError('User authentication required');
      setLoading(false);
    }
  }, [status, session, timeRange, access.allowed]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const [overviewData, timelineData, savingsData, requestsData] = await Promise.all([
        apiClient.getAnalyticsOverview(),
        apiClient.getTimeline('daily', days),
        apiClient.getCostSavings().catch(() => null),
        apiClient.getRecentRequests(20, 0),
      ]);
      setOverview(overviewData);
      setTimeline(timelineData);
      setCostSavings(savingsData);
      setRecentRequests(requestsData.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const range = RANGES.find(r => r.key === timeRange)!;
  const series = useMemo(() => dailySeries(timeline?.timeline ?? [], range.days), [timeline, range.days]);

  // A lower plan sees the upgrade screen, not a failed fetch.
  if (access.ready && !access.allowed) {
    return (
      <RouterLayout>
        <SubscriptionGuard feature="Routing analytics" requires="routing-analytics"><></></SubscriptionGuard>
      </RouterLayout>
    );
  }

  const handleExport = (format: 'csv' | 'json') => {
    if (!overview) return;
    const timestamp = new Date().toISOString().split('T')[0];
    if (format === 'csv') {
      let csv = '# ANALYTICS OVERVIEW\n';
      csv += `Export Date,${new Date().toLocaleString()}\nTime Range,${timeRange}\n`;
      csv += `Total Requests,${overview.overview.totalRequests}\nSuccess Rate,${overview.overview.successRate}\n`;
      csv += `Total Cost,$${overview.overview.totalCost}\nTotal Tokens,${overview.overview.totalTokens}\n`;
      if (costSavings) {
        csv += `\n# COST SAVINGS\nActual Cost,$${costSavings.actualCost}\nWorse Case,$${costSavings.worstCaseCost}\nSavings,$${costSavings.savings}\n`;
      }
      if (overview.providers.length > 0) {
        csv += '\n# PROVIDER BREAKDOWN\nProvider,Requests,Percentage,Total Cost\n';
        overview.providers.forEach(p => { csv += `${p.provider},${p.requests},${p.percentage},${p.totalCost}\n`; });
      }
      if (recentRequests.length > 0) {
        csv += '\n# RECENT REQUESTS\nTimestamp,Model,Provider,Status,Tokens,Cost,Latency\n';
        recentRequests.forEach(r => { csv += `${new Date(r.timestamp).toISOString()},${r.model},${r.provider},${r.success ? 'OK' : 'FAIL'},${r.tokensIn + r.tokensOut},${r.cost},${r.latency}\n`; });
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `analytics-${timeRange}-${timestamp}.csv`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const json = JSON.stringify({ exportDate: new Date().toISOString(), timeRange, overview: overview.overview, costSavings, providers: overview.providers, topModels: overview.topModels, recentRequests }, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `analytics-${timeRange}-${timestamp}.json`; a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (loading && !overview) {
    return (
      <RouterLayout>
        <PageHead kicker="Smart Router" title="Analytics" lead={LEAD} />
        <div className="st-body" data-page-loading>
          <Loader label="Loading analytics" minHeight={320} />
        </div>
      </RouterLayout>
    );
  }

  if (error || !overview) {
    return (
      <RouterLayout>
        <PageHead kicker="Smart Router" title="Analytics" lead={LEAD} />
        <div className="st-body">
          <Note tone="bad" title="Analytics could not load">
            <div className="sa-note-row">
              <span>{error || 'Failed to load analytics data'}</span>
              <button type="button" onClick={fetchAnalytics} className="st-btn is-sm">Retry</button>
            </div>
          </Note>
        </div>
      </RouterLayout>
    );
  }

  const o = overview.overview;
  const totalCost = num(o.totalCost);
  const savings = costSavings ? num(costSavings.savings) : 0;
  const actualCost = costSavings ? num(costSavings.actualCost) : 0;
  const worstCost = costSavings ? num(costSavings.worstCaseCost) : 0;
  const { points, active } = series;
  const reqValues = points.map(p => p.requests);
  const costValues = points.map(p => p.cost);
  const maxReq = Math.max(0, ...reqValues);
  const maxCost = Math.max(0, ...costValues);
  const avgReq = reqValues.length ? reqValues.reduce((a, b) => a + b, 0) / reqValues.length : 0;
  const avgCost = costValues.length ? costValues.reduce((a, b) => a + b, 0) / costValues.length : 0;
  const span = `Daily, last ${range.label}`;
  const nameOf = (id: string) => names[id] ?? id;

  return (
    <RouterLayout>
      <SubscriptionGuard feature="Routing analytics" requires="routing-analytics">
        <PageHead
          kicker="Smart Router"
          title="Analytics"
          lead={LEAD}
          actions={
            <div className="st-seg is-scroll" role="group" aria-label="Chart period">
              {RANGES.map(r => (
                <button key={r.key} type="button" aria-pressed={timeRange === r.key} onClick={() => setTimeRange(r.key)}>
                  {r.label}
                </button>
              ))}
            </div>
          }
        />

        <div className="st-body">
          {/* Totals cover every request on the account; the period above scopes the charts. */}
          <p className="st-label sa-scope">All time</p>
          <Stats columns={4}>
            <Stat value={<CountUp value={o.totalRequests} />} label="Total requests"
              sub={`${o.successfulRequests.toLocaleString()} successful`} />
            <Stat value={<CountUp value={totalCost} format={moneyFor(totalCost)} />} label="Total cost"
              sub={costSavings ? `Saved ${money(savings)}` : undefined} />
            {/* With no requests the API reports 0.00, which would read as "everything failed". */}
            <Stat value={o.totalRequests > 0 ? <CountUp value={num(o.successRate)} format={n => `${n.toFixed(2)}%`} /> : '—'} label="Success rate"
              sub={o.totalRequests > 0 ? `${o.successfulRequests.toLocaleString()} of ${o.totalRequests.toLocaleString()}` : 'No requests yet'} />
            <Stat value={<CountUp value={o.totalTokens} format={tokens} />} label="Total tokens"
              sub={`${tokens(o.totalTokensIn)} in · ${tokens(o.totalTokensOut)} out`} />
          </Stats>

          {costSavings && savings > 0 && (
            <Pane tone="accent" title={`You've saved ${money(savings)}`}
              sub={`That's ${num(costSavings.savingsPercentage).toFixed(2)}% less than using the most expensive model.`}>
              <div className="sa-compare">
                <div className="sa-compare-row">
                  <span>Your cost</span>
                  <div className="sa-bar" aria-hidden="true"><i style={{ width: `${worstCost > 0 ? Math.min(100, (actualCost / worstCost) * 100) : 0}%` }} /></div>
                  <b>{money(actualCost)}</b>
                </div>
                <div className="sa-compare-row">
                  <span>Without router</span>
                  <div className="sa-bar is-muted" aria-hidden="true"><i style={{ width: '100%' }} /></div>
                  <b>{money(worstCost)}</b>
                </div>
              </div>
            </Pane>
          )}

          <div className={`st-grid${loading ? ' sa-stale' : ''}`} aria-busy={loading}>
            <Pane title="Requests over time" sub={span} delay={0.04}
              actions={active > 0 && (
                <div className="sa-chart-meta"><span>Max<b>{maxReq.toLocaleString()}</b></span><span>Avg<b>{avgReq.toFixed(0)}</b></span></div>
              )}>
              {active > 0 ? (
                <TrendChart points={points} dataKey="requests" axis={compact}
                  label={`Requests per day over the last ${range.label}. The busiest day had ${maxReq.toLocaleString()}.`}
                  value={p => `${p.requests.toLocaleString()} request${p.requests === 1 ? '' : 's'}`}
                  detail={p => (p.successRate === null ? null : `${p.successRate.toFixed(2)}% successful`)} />
              ) : (
                <Empty title={`No requests in the last ${range.label}`}>
                  Requests you send with a router key are counted here, one point per day.
                </Empty>
              )}
            </Pane>
            <Pane title="Cost over time" sub={span} delay={0.1}
              actions={active > 0 && (
                <div className="sa-chart-meta"><span>Max<b>{money(maxCost)}</b></span><span>Avg<b>{money(avgCost)}</b></span></div>
              )}>
              {active > 0 ? (
                <TrendChart points={points} dataKey="cost" axis={axisMoney}
                  label={`Cost per day over the last ${range.label}. The most expensive day cost ${money(maxCost)}.`}
                  value={p => money(p.cost)}
                  detail={p => `${p.requests.toLocaleString()} request${p.requests === 1 ? '' : 's'}`} />
              ) : (
                <Empty title={`No spend in the last ${range.label}`}>
                  What your routed requests cost at your providers' prices shows up here, per day.
                </Empty>
              )}
            </Pane>
          </div>

          <div className="st-grid">
            <Pane title="Provider usage" sub="Share of all requests, with what each provider cost." delay={0.04}>
              {overview.providers.length > 0 ? (
                <ShareList rows={overview.providers.map(p => ({
                  id: p.provider,
                  lead: <ProviderMark provider={p.provider} size="sm" />,
                  name: PROVIDER_LABEL[p.provider] ?? p.provider,
                  value: money(num(p.totalCost)),
                  meta: `${p.requests.toLocaleString()} requests`,
                  pct: num(p.percentage),
                }))} />
              ) : (
                <Empty title="No provider data yet">Once requests go through the router, each provider's share and cost appears here.</Empty>
              )}
            </Pane>

            <Pane title="Top models" sub="The models that served the most requests." delay={0.1}>
              {overview.topModels.length > 0 ? (
                <ShareList rows={overview.topModels.slice(0, 5).map((m, index) => ({
                  id: m.model,
                  lead: <span className="sa-rank">{index + 1}</span>,
                  name: nameOf(m.model),
                  title: m.model,
                  value: money(num(m.totalCost)),
                  meta: `${m.requests.toLocaleString()} requests`,
                  pct: num(m.percentage),
                }))} />
              ) : (
                <Empty title="No model data yet">The models the router picks for your requests are ranked here by how many they served.</Empty>
              )}
            </Pane>
          </div>

          {recentRequests.length > 0 && (
            <Pane title="Recent requests" sub={`Last ${recentRequests.length}`} ruled flush>
              <div className="st-table-wrap">
                <table className="st-table is-stack sa-log">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Model</th>
                      <th>Provider</th>
                      <th className="is-num">Tokens</th>
                      <th className="is-num">Cost</th>
                      <th className="is-num">Latency</th>
                      <th className="is-num">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRequests.map((req) => (
                      <tr key={req.id}>
                        <td className="sa-c-end" data-label="Status">
                          {req.success ? <Tag tone="good">OK</Tag> : <Tag tone="bad">Failed</Tag>}
                        </td>
                        <td className="sa-c-head" data-label="Model">
                          {names[req.model] ? <span className="sa-name" title={req.model}>{names[req.model]}</span> : <span className="sa-id">{req.model}</span>}
                        </td>
                        <td className="sa-c-meta is-dim" data-label="Provider">{PROVIDER_LABEL[req.provider] ?? req.provider}</td>
                        <td className="sa-c-meta is-num" data-label="Tokens">{(req.tokensIn + req.tokensOut).toLocaleString()}<span className="sa-unit"> tokens</span></td>
                        <td className="sa-c-meta is-num" data-label="Cost">${req.cost}</td>
                        <td className="sa-c-meta is-num is-dim" data-label="Latency">{req.latency == null ? '—' : `${req.latency.toLocaleString()} ms`}</td>
                        <td className="sa-c-meta is-num is-dim sa-when" data-label="Time" title={new Date(req.timestamp).toLocaleString()}>{when(req.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Pane>
          )}

          <Pane title="Export data" sub="The figures on this page, to take into your own spreadsheets and dashboards.">
            <div className="st-actions">
              <button type="button" onClick={() => handleExport('csv')} className="st-btn">Export CSV</button>
              <button type="button" onClick={() => handleExport('json')} className="st-btn">Export JSON</button>
            </div>
          </Pane>
        </div>
      </SubscriptionGuard>
    </RouterLayout>
  );
}
