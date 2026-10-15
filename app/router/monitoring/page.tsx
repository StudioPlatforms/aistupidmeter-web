'use client';

import { Suspense, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import RouterLayout from '@/components/RouterLayout';
import SubscriptionGuard, { useCapability } from '@/components/SubscriptionGuard';
import { apiClient } from '@/lib/api-client';
import type { KeyActivity, KeySummary, BudgetAlert, PromptAuditEntry, EfficiencyMetrics, KeyCostBreakdown } from '@/lib/api-client';
import { PageHead, Pane, Stats, Stat, CountUp, Loader, Empty, Note, Tag, Pill, useModelNames } from '@/components/studio';
import { useReducedMotion } from '@/components/landing/util';
import '@/styles/studio-insights.css';

type Tab = 'activity' | 'costs' | 'prompts' | 'budgets';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'activity', label: 'Key activity' },
  { id: 'costs', label: 'Cost dashboard' },
  { id: 'prompts', label: 'Prompt audit' },
  { id: 'budgets', label: 'Budgets & alerts' },
];

const CATEGORIES = ['coding', 'reasoning', 'creative', 'analysis', 'general'];
const PERIOD_LABEL: Record<'7d' | '30d' | '90d', string> = { '7d': '7 days', '30d': '30 days', '90d': '90 days' };
const LEAD = 'Track each key’s usage, costs, prompts and budgets.';

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
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
const axisMoney = (v: number) => (v === 0 ? '$0' : `$${v < 0.01 ? v.toFixed(4) : v < 10 ? v.toFixed(2) : Math.round(v).toLocaleString('en-US')}`);

/** A log time: the clock time for today's entries, the date as well for older ones. */
function when(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString()
    : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Budget use: accent below 80%, warning from 80%, over budget from 100%. */
const budgetTone = (util: number | null | undefined) => (!util ? '' : util >= 100 ? ' is-bad' : util >= 80 ? ' is-warn' : '');

function BudgetMeter({ util, label }: { util: number | null | undefined; label: string }) {
  const pct = Math.max(0, Math.min(util ?? 0, 100));
  return (
    <div className={`sa-meter${budgetTone(util)}`} role="meter" aria-label={label}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(util ?? 0)}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return <span className="st-faint">—</span>;
  return <Tag>{cap(category)}</Tag>;
}

/** A model id as its display name when the public model list knows it, else the id itself. */
function ModelName({ id, names }: { id: string; names: Record<string, string> }) {
  return names[id] ? <span className="sa-name" title={id}>{names[id]}</span> : <span className="sa-id">{id}</span>;
}

interface DayPoint { key: string; label: string; long: string; cost: number; requests: number }

/** One point per UTC day across the period; days without requests are zero, so the x-axis is real time. */
function dailySeries(rows: KeyCostBreakdown['dailyCosts'], days: number): DayPoint[] {
  const DAY = 86_400_000;
  const startKey = new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
  const todayKey = new Date().toISOString().slice(0, 10);
  const byDay = new Map(rows.map(r => [String(r.date).slice(0, 10), r]));
  const out: DayPoint[] = [];
  for (let t = Date.parse(`${startKey}T00:00:00Z`); ; t += DAY) {
    const key = new Date(t).toISOString().slice(0, 10);
    if (key > todayKey || out.length > 400) break;
    const r = byDay.get(key);
    const d = new Date(t);
    out.push({
      key,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      long: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
      cost: r ? num(r.cost) : 0,
      requests: r ? num(r.requests) : 0,
    });
  }
  return out;
}

function CostTip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DayPoint }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="sa-tip">
      <strong>{money(p.cost)}</strong>
      <span><i className="sa-tip-k" aria-hidden="true" />{p.long}</span>
      <span>{p.requests.toLocaleString()} request{p.requests === 1 ? '' : 's'}</span>
    </div>
  );
}

function CostChart({ points, label }: { points: DayPoint[]; label: string }) {
  const reduced = useReducedMotion();
  return (
    <div className="sa-chart" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--lp-line)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--lp-line2)' }} tickMargin={8}
            minTickGap={26} interval="preserveStartEnd" tick={{ fill: 'var(--lp-fg3)', fontSize: 11 }} />
          <YAxis width={56} tickLine={false} axisLine={false} tickMargin={6} tickFormatter={axisMoney}
            tick={{ fill: 'var(--lp-fg3)', fontSize: 11 }} />
          <Tooltip cursor={{ stroke: 'var(--lp-line2)', strokeWidth: 1 }} isAnimationActive={false} content={<CostTip />} />
          <Area type="monotone" dataKey="cost" stroke="var(--lp-accent)" strokeWidth={2} fill="var(--lp-accent)" fillOpacity={0.1}
            dot={false} activeDot={{ r: 4.5, fill: 'var(--lp-accent)', stroke: 'var(--lp-card)', strokeWidth: 2 }}
            isAnimationActive={!reduced} animationDuration={900} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonitoringHead() {
  return <PageHead kicker="Smart Router" title="API monitoring" lead={LEAD} />;
}

function MonitoringPageContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'activity');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const names = useModelNames();

  // Key Activity state
  const [keys, setKeys] = useState<KeySummary[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(
    searchParams.get('key') ? parseInt(searchParams.get('key')!) : null
  );
  const [activity, setActivity] = useState<KeyActivity[]>([]);
  const [activityCursor, setActivityCursor] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // Cost Dashboard state
  const [costPeriod, setCostPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [keyCosts, setKeyCosts] = useState<KeyCostBreakdown | null>(null);

  // Prompt Audit state
  const [promptLoggingEnabled, setPromptLoggingEnabled] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);
  const [prompts, setPrompts] = useState<PromptAuditEntry[]>([]);
  const [promptCursor, setPromptCursor] = useState<string | null>(null);
  const [categories, setCategories] = useState<Array<{ category: string; count: number; percentage: string }>>([]);

  // Budget state
  const [budgetStatus, setBudgetStatus] = useState<Array<any>>([]);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);

  // Efficiency state
  const [efficiency, setEfficiency] = useState<EfficiencyMetrics[]>([]);

  const access = useCapability('api-monitoring');
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id && access.allowed) {
      apiClient.setUserId(session.user.id);
      loadInitialData();
    }
  }, [status, session, access.allowed]);

  useEffect(() => {
    if (keys.length > 0) {
      if (tab === 'activity') loadActivity();
      if (tab === 'costs' && selectedKeyId) loadCosts();
      if (tab === 'prompts') loadPrompts();
      if (tab === 'budgets') loadBudgets();
    }
  }, [tab, selectedKeyId, categoryFilter, costPeriod]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [summaryRes, loggingRes] = await Promise.all([
        apiClient.getKeysSummary(),
        apiClient.getPromptLoggingState(),
      ]);
      setKeys(summaryRes.keys);
      setPromptLoggingEnabled(loggingRes.enabled);
      setRetentionDays(loggingRes.retentionDays);
      if (summaryRes.keys.length > 0 && !selectedKeyId) {
        setSelectedKeyId(summaryRes.keys[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const loadActivity = async () => {
    if (!selectedKeyId) return;
    try {
      const res = await apiClient.getKeyActivity(selectedKeyId, {
        limit: 50,
        category: categoryFilter || undefined,
      });
      setActivity(res.activity);
      setActivityCursor(res.nextCursor);
    } catch {}
  };

  const loadMoreActivity = async () => {
    if (!selectedKeyId || !activityCursor) return;
    try {
      const res = await apiClient.getKeyActivity(selectedKeyId, {
        before: activityCursor,
        limit: 50,
        category: categoryFilter || undefined,
      });
      setActivity(prev => [...prev, ...res.activity]);
      setActivityCursor(res.nextCursor);
    } catch {}
  };

  const loadCosts = async () => {
    if (!selectedKeyId) return;
    try {
      const res = await apiClient.getKeyCosts(selectedKeyId, costPeriod);
      setKeyCosts(res.costs);
    } catch {}
  };

  const loadPrompts = async () => {
    try {
      const [promptsRes, catsRes] = await Promise.all([
        apiClient.getPromptAudit({ limit: 50, keyId: selectedKeyId || undefined }),
        apiClient.getPromptCategories(),
      ]);
      setPrompts(promptsRes.prompts);
      setPromptCursor(promptsRes.nextCursor);
      setCategories(catsRes.categories);
    } catch {}
  };

  const loadBudgets = async () => {
    try {
      const [statusRes, alertsRes, effRes] = await Promise.all([
        apiClient.getBudgetStatus(),
        apiClient.getBudgetAlerts(),
        apiClient.getEfficiencyMetrics(),
      ]);
      setBudgetStatus(statusRes.keys);
      setAlerts(alertsRes.alerts);
      setEfficiency(effRes.keys);
    } catch {}
  };

  const handleTogglePromptLogging = async () => {
    const newState = !promptLoggingEnabled;
    try {
      await apiClient.togglePromptLogging(newState, retentionDays);
      setPromptLoggingEnabled(newState);
    } catch {}
  };

  const handleAcknowledgeAlert = async (alertId: number) => {
    try {
      await apiClient.acknowledgeBudgetAlert(alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch {}
  };

  // A lower plan sees the upgrade screen, not an endless loader or a failed fetch.
  if (access.ready && !access.allowed) {
    return (
      <RouterLayout>
        <SubscriptionGuard feature="API monitoring" requires="api-monitoring"><></></SubscriptionGuard>
      </RouterLayout>
    );
  }

  if (loading && keys.length === 0) {
    return (
      <RouterLayout>
        <MonitoringHead />
        <div className="st-body" data-page-loading>
          <Loader label="Loading monitoring" minHeight={320} />
        </div>
      </RouterLayout>
    );
  }

  // The activity and cost views are per key: with no key there is nothing to select or show.
  const keyless = keys.length === 0;
  const noKeys = keyless && !error ? (
    <Empty
      title="No router keys yet"
      actions={<Link href="/router/keys" className="st-btn is-primary">Create a router key <span className="st-ar" aria-hidden="true">→</span></Link>}
    >
      Each Smart Router key gets its own request log, costs and budget here once it makes its first call.
    </Empty>
  ) : null;

  return (
    <RouterLayout>
      <SubscriptionGuard feature="API monitoring" requires="api-monitoring">
        <MonitoringHead />

        <div className="st-body">
          <div className="st-tabs" role="tablist" aria-label="Monitoring views">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`sa-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls="sa-tabpanel"
                className="st-tab"
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="sa-panel" id="sa-tabpanel" role="tabpanel" aria-labelledby={`sa-tab-${tab}`}>
            {error && (
              <Note tone="bad" title="Monitoring could not load">{error}</Note>
            )}

            {/* Key selector (shared by the activity and cost views) */}
            {keys.length > 0 && (tab === 'activity' || tab === 'costs') && (
              <div className="sa-toolbar">
                <label className="st-field">
                  <span className="st-field-label">Key</span>
                  <select
                    value={selectedKeyId || ''}
                    onChange={e => setSelectedKeyId(parseInt(e.target.value))}
                    className="st-select"
                  >
                    {keys.map(k => (
                      <option key={k.id} value={k.id}>
                        {k.name} {k.department ? `(${k.department})` : ''} — {k.keyPrefix}
                      </option>
                    ))}
                  </select>
                </label>
                {tab === 'activity' && (
                  <div className="st-field sa-grow">
                    <span className="st-field-label" id="sa-cat-label">Category</span>
                    <div className="sa-chips" role="group" aria-labelledby="sa-cat-label">
                      <button type="button" className="st-chip" aria-pressed={categoryFilter === ''} onClick={() => setCategoryFilter('')}>All categories</button>
                      {CATEGORIES.map(c => (
                        <button key={c} type="button" className="st-chip" aria-pressed={categoryFilter === c} onClick={() => setCategoryFilter(c)}>{cap(c)}</button>
                      ))}
                    </div>
                  </div>
                )}
                {tab === 'costs' && (
                  <div className="st-field">
                    <span className="st-field-label" id="sa-period-label">Period</span>
                    <div className="st-seg is-scroll" role="group" aria-labelledby="sa-period-label">
                      {(['7d', '30d', '90d'] as const).map(p => (
                        <button key={p} type="button" aria-pressed={costPeriod === p} onClick={() => setCostPeriod(p)}>
                          {PERIOD_LABEL[p]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Key activity ─────────────────────────────────────── */}
            {tab === 'activity' && (keyless ? noKeys : (
              <>
                {/* Key summary cards: this month's requests and spend; a card picks the key */}
                <div className="st-cards" style={{ '--min': '220px' } as CSSProperties}>
                  {keys.slice(0, 4).map((k, i) => (
                    <button
                      key={k.id}
                      type="button"
                      className="st-card sa-keycard st-up"
                      style={{ '--d': `${i * 0.04}s` } as CSSProperties}
                      aria-pressed={k.id === selectedKeyId}
                      onClick={() => setSelectedKeyId(k.id)}
                    >
                      <span className="st-card-t"><span>{k.name}</span><span className="st-card-tick" aria-hidden="true" /></span>
                      <span className="sa-keycard-v"><CountUp value={k.requestCount} /><small>requests</small></span>
                      <span className="st-card-d">
                        ${k.currentSpend.toFixed(4)}{k.budgetLimit ? ` of $${k.budgetLimit}` : ''} this month
                      </span>
                      {k.budgetLimit ? <BudgetMeter util={k.budgetUtilization} label={`${k.name}: budget used`} /> : null}
                    </button>
                  ))}
                </div>

                <Pane title="Request log" sub={`${activity.length} requests`} ruled flush>
                  {activity.length > 0 ? (
                    <div className="st-table-wrap">
                      <table className="st-table is-stack sa-log">
                        <thead>
                          <tr>
                            <th>Status</th>
                            <th>Model</th>
                            <th>Category</th>
                            <th className="is-num">Tokens</th>
                            <th className="is-num">Cost</th>
                            <th className="is-num">Latency</th>
                            <th className="is-num">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activity.map(a => (
                            <tr key={a.id}>
                              <td className="sa-c-end" data-label="Status">{a.success ? <Tag tone="good">OK</Tag> : <Tag tone="bad">Failed</Tag>}</td>
                              <td className="sa-c-head" data-label="Model"><ModelName id={a.model} names={names} /></td>
                              <td className="sa-c-meta" data-label="Category"><CategoryBadge category={a.category} /></td>
                              <td className="sa-c-meta is-num" data-label="Tokens">{(a.tokensIn + a.tokensOut).toLocaleString()}<span className="sa-unit"> tokens</span></td>
                              <td className="sa-c-meta is-num" data-label="Cost">${a.cost}</td>
                              <td className="sa-c-meta is-num is-dim" data-label="Latency">{a.latency.toLocaleString()} ms</td>
                              <td className="sa-c-meta is-num is-dim sa-when" data-label="Time" title={new Date(a.timestamp).toLocaleString()}>{when(a.timestamp)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty title="No activity">
                      No requests recorded for this key{categoryFilter ? ` in ${cap(categoryFilter).toLowerCase()}` : ''} yet. Calls made with it appear here as they arrive.
                    </Empty>
                  )}
                </Pane>
                {activityCursor && (
                  <button type="button" className="st-btn is-block" onClick={loadMoreActivity}>
                    Load more
                  </button>
                )}
              </>
            ))}

            {/* ── Cost dashboard ───────────────────────────────────── */}
            {tab === 'costs' && (keyless ? noKeys : (
              keyCosts ? (
                <>
                  <Stats columns={4}>
                    <Stat value={<CountUp value={num(keyCosts.totalCost)} format={moneyFor(num(keyCosts.totalCost))} />}
                      label="Total cost" sub={`Last ${PERIOD_LABEL[keyCosts.period as '7d' | '30d' | '90d'] ?? keyCosts.period}`} />
                    <Stat value={<CountUp value={keyCosts.totalRequests} />} label="Requests" />
                    <Stat value={<CountUp value={keyCosts.totalTokens} format={tokens} />} label="Total tokens" />
                    <Stat
                      value={keyCosts.forecast.daysUntilBudget !== null ? <CountUp value={keyCosts.forecast.daysUntilBudget} /> : '∞'}
                      unit={keyCosts.forecast.daysUntilBudget !== null ? 'days left' : undefined}
                      label="Budget forecast"
                      sub={`Projected $${keyCosts.forecast.projectedMonthEnd.toFixed(4)} by month end`}
                    />
                  </Stats>

                  {keyCosts.dailyCosts.length > 0 && (() => {
                    const days = keyCosts.period === '7d' ? 7 : keyCosts.period === '90d' ? 90 : 30;
                    const points = dailySeries(keyCosts.dailyCosts, days);
                    const max = Math.max(0, ...points.map(p => p.cost));
                    return (
                      <Pane title="Daily cost trend" sub={`${keyCosts.keyName}, daily, last ${PERIOD_LABEL[keyCosts.period as '7d' | '30d' | '90d'] ?? keyCosts.period}`}
                        actions={<div className="sa-chart-meta"><span>Max<b>{money(max)}</b></span></div>}>
                        <CostChart points={points} label={`Daily cost for ${keyCosts.keyName}. The most expensive day cost ${money(max)}.`} />
                      </Pane>
                    );
                  })()}

                  {keyCosts.modelBreakdown.length > 0 && (
                    <Pane title="Model breakdown" sub="What each model cost on this key in the period.">
                      <ul className="sa-shares">
                        {keyCosts.modelBreakdown.map((m, i) => {
                          const pct = num(m.percentage);
                          return (
                            <li key={m.model} className={`sa-share${i === 0 ? ' is-top' : ''}`}>
                              <span className="sa-rank">{i + 1}</span>
                              <div className="sa-share-main">
                                <div className="sa-share-top">
                                  <span className="sa-share-name" title={m.model}>{names[m.model] ?? m.model}</span>
                                  <span className="sa-share-val">{money(num(m.cost))}</span>
                                </div>
                                <div className="sa-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, pct)}%` }} /></div>
                                <div className="sa-share-meta"><span>{m.requests.toLocaleString()} requests</span><span>{m.percentage}</span></div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </Pane>
                  )}
                </>
              ) : (
                <Empty title="Select a key">Choose an API key above to view its cost breakdown.</Empty>
              )
            ))}

            {/* ── Prompt audit ─────────────────────────────────────── */}
            {tab === 'prompts' && (
              <>
                <Pane title="Prompt logging" sub="Record and audit the prompts sent through your API keys."
                  actions={promptLoggingEnabled ? <Pill tone="good">Enabled</Pill> : <Pill>Disabled</Pill>}>
                  <div className="sa-switch">
                    <label className="st-toggle">
                      <input
                        type="checkbox"
                        className="st-check"
                        checked={promptLoggingEnabled}
                        onChange={handleTogglePromptLogging}
                      />
                      <div>
                        <b>{promptLoggingEnabled ? 'Prompt logging is on' : 'Prompt logging is off'}</b>
                        <span>Retention: {retentionDays > 0 ? `${retentionDays} days` : 'Forever'}</span>
                      </div>
                    </label>
                    <Note>
                      Prompts are automatically scrubbed for API keys, passwords, tokens, emails, and high-entropy secrets before encryption at rest.
                    </Note>
                  </div>
                </Pane>

                {categories.length > 0 && (
                  <Pane title="Category distribution" sub="Requests this month by prompt category.">
                    <ul className="sa-shares">
                      {categories.map(c => (
                        <li key={c.category} className="sa-share is-plain">
                          <div className="sa-share-main">
                            <div className="sa-share-top">
                              <span className="sa-share-name">{cap(c.category ?? '')}</span>
                              <span className="sa-share-val">{c.percentage}</span>
                            </div>
                            <div className="sa-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, num(c.percentage))}%` }} /></div>
                            <div className="sa-share-meta"><span>{c.count.toLocaleString()} requests</span></div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Pane>
                )}

                {promptLoggingEnabled ? (
                  <Pane title="Prompt log" sub={`${prompts.length} entries`} ruled flush>
                    {prompts.length > 0 ? (
                      <div className="st-table-wrap">
                        <table className="st-table is-stack sa-log">
                          <thead>
                            <tr>
                              <th>Key</th>
                              <th>Category</th>
                              <th>Prompt preview</th>
                              <th>Model</th>
                              <th className="is-num">Cost</th>
                              <th className="is-num">Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {prompts.map(p => (
                              <tr key={p.id}>
                                <td className="sa-c-head" data-label="Key">{p.keyName}</td>
                                <td className="sa-c-meta" data-label="Category"><CategoryBadge category={p.category} /></td>
                                <td className="sa-c-wide" data-label="Prompt preview"><p className="sa-prompt" title={p.promptPreview}>{p.promptPreview}</p></td>
                                <td className="sa-c-meta" data-label="Model"><ModelName id={p.model} names={names} /></td>
                                <td className="sa-c-meta is-num" data-label="Cost">${p.cost}</td>
                                <td className="sa-c-end is-num is-dim sa-when" data-label="Time" title={new Date(p.timestamp).toLocaleString()}>{when(p.timestamp)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty title="No prompts logged">
                        Prompts will appear here after requests are made with logging enabled.
                      </Empty>
                    )}
                  </Pane>
                ) : (
                  <Pane>
                    <Empty
                      title="Prompt logging is disabled"
                      actions={<button type="button" className="st-btn is-primary" onClick={handleTogglePromptLogging}>Enable prompt logging</button>}
                    >
                      Enable prompt logging above to record and audit what prompts are being sent through your API keys.
                      Prompts are automatically scrubbed for secrets and encrypted at rest.
                    </Empty>
                  </Pane>
                )}
              </>
            )}

            {/* ── Budgets and alerts ───────────────────────────────── */}
            {tab === 'budgets' && (
              <>
                {alerts.length > 0 && (
                  <Pane title="Active alerts" actions={<Tag tone="bad">{alerts.length}</Tag>} ruled flush>
                    <div className="st-rows">
                      {alerts.map(a => {
                        const over = a.alertType === 'budget_exceeded';
                        return (
                          <div key={a.id} className="st-row sa-alert">
                            <span className={`st-key is-${over ? 'bad' : 'warn'}`} aria-hidden="true" />
                            <div className="st-row-main">
                              <div className="st-row-t">
                                {a.keyName}
                                <Tag tone={over ? 'bad' : 'warn'}>{over ? 'Budget exceeded' : 'Threshold warning'}</Tag>
                              </div>
                              <div className="st-row-s">
                                ${a.amountSpent.toFixed(4)} of ${a.budgetLimit.toFixed(2)} · {new Date(a.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="st-row-end">
                              <button type="button" className="st-btn is-sm" onClick={() => handleAcknowledgeAlert(a.id)}>
                                Acknowledge
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Pane>
                )}

                <Pane title="Budget status" sub="This month’s spend per key, against its monthly budget." ruled flush>
                  {budgetStatus.length > 0 ? (
                    <div className="sa-budgets">
                      {budgetStatus.map((k: any) => {
                        const util: number | null = k.utilization;
                        return (
                          <div key={k.id} className="sa-budget">
                            <div className="sa-budget-top">
                              <span className="sa-budget-name">
                                {k.name}{k.department ? <small>{k.department}</small> : null}
                              </span>
                              <span className="sa-budget-amt">
                                <b>${k.currentSpend.toFixed(4)}</b>
                                {k.budgetLimit ? <> of ${k.budgetLimit.toFixed(2)}</> : <> · no limit</>}
                              </span>
                            </div>
                            {k.budgetLimit ? <BudgetMeter util={util} label={`${k.name}: budget used`} /> : null}
                            <div className="sa-budget-meta">
                              <span>
                                {k.budgetLimit
                                  ? (k.budgetHardLimit
                                    ? <><Tag tone="ink">Hard limit</Tag>Requests over budget are refused</>
                                    : <><Tag>Soft limit</Tag>Alerts only</>)
                                  : 'No budget set'}
                              </span>
                              {util !== null && <b className={budgetTone(util).trim()}>{util.toFixed(1)}% used</b>}
                            </div>
                            <BudgetEditor keyRow={k} onSaved={loadBudgets} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Empty
                      title="No keys"
                      actions={<Link href="/router/keys" className="st-btn is-primary">Router API keys <span className="st-ar" aria-hidden="true">→</span></Link>}
                    >
                      Create a Smart Router key on the Router API keys page; its budget can then be set here.
                    </Empty>
                  )}
                </Pane>

                {efficiency.length > 0 && (
                  <Pane title="Key efficiency" sub="Per key, this month." ruled flush>
                    <div className="st-table-wrap">
                      <table className="st-table is-stack">
                        <thead>
                          <tr>
                            <th>Key</th>
                            <th className="is-num">Requests</th>
                            <th className="is-num">Avg tokens</th>
                            <th className="is-num">Avg cost</th>
                            <th className="is-num">Error rate</th>
                            <th className="is-num">Avg latency</th>
                            <th>Top category</th>
                          </tr>
                        </thead>
                        <tbody>
                          {efficiency.map(e => (
                            <tr key={e.keyId}>
                              <td className="is-head" data-label="Key"><span className="sa-name">{e.keyName}</span></td>
                              <td className="is-num" data-label="Requests">{e.requestCount.toLocaleString()}</td>
                              <td className="is-num" data-label="Avg tokens">{e.avgTokensPerRequest.toLocaleString()}</td>
                              <td className="is-num" data-label="Avg cost">${e.avgCostPerRequest.toFixed(6)}</td>
                              <td className={`is-num${parseFloat(e.errorRate) > 5 ? ' sa-bad' : ' is-dim'}`} data-label="Error rate">
                                {e.errorRate}
                              </td>
                              <td className="is-num is-dim" data-label="Avg latency">{e.avgLatency.toLocaleString()} ms</td>
                              <td data-label="Top category">
                                {e.topCategories[0] ? (
                                  <CategoryBadge category={e.topCategories[0].category} />
                                ) : <span className="st-faint">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Pane>
                )}
              </>
            )}
          </div>
        </div>
      </SubscriptionGuard>
    </RouterLayout>
  );
}

export default function MonitoringPage() {
  return (
    <Suspense fallback={
      <RouterLayout>
        <MonitoringHead />
        <div className="st-body" data-page-loading>
          <Loader label="Loading" minHeight={320} />
        </div>
      </RouterLayout>
    }>
      <MonitoringPageContent />
    </Suspense>
  );
}

/**
 * Set or change one key's monthly budget (Developer and above; the API enforces the plan too).
 * A hard limit refuses a request whose reserved cost would take the month over budget; a soft one
 * only sends alerts at the threshold and at 100%.
 */
function BudgetEditor({ keyRow, onSaved }: { keyRow: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState<string>(keyRow.budgetLimit ? String(keyRow.budgetLimit) : '');
  const [hard, setHard] = useState<boolean>(!!keyRow.budgetHardLimit);
  const [threshold, setThreshold] = useState<string>(String(Math.round((keyRow.budgetAlertThreshold ?? 0.8) * 100)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (clear = false) => {
    setError(null);
    const value = clear ? null : limit.trim() === '' ? null : Number(limit);
    if (value !== null && !(value >= 0.01)) { setError('Enter a monthly budget of at least $0.01, or leave it empty for no budget.'); return; }
    const pct = Number(threshold);
    if (!(pct >= 10 && pct <= 100)) { setError('The alert threshold must be between 10% and 100%.'); return; }
    setSaving(true);
    try {
      await apiClient.updateKey(keyRow.id, { budgetLimitMonthly: value, budgetHardLimit: value === null ? false : hard, budgetAlertThreshold: pct / 100 });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the budget.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="st-btn is-sm" onClick={() => setOpen(true)}>
        {keyRow.budgetLimit ? 'Edit budget' : 'Set a budget'}
      </button>
    );
  }
  return (
    <div className="sa-budget-form">
      <div className="st-form-row">
        <label className="st-field">
          <span className="st-field-label">Monthly budget (USD)</span>
          <input type="number" min={0.01} step={1} className="st-input" value={limit}
            placeholder="No budget" onChange={e => setLimit(e.target.value)} aria-label="Monthly budget in US dollars" />
        </label>
        <label className="st-field">
          <span className="st-field-label">Alert at</span>
          <span className="sa-suffix">
            <input type="number" min={10} max={100} step={5} className="st-input" value={threshold}
              onChange={e => setThreshold(e.target.value)} aria-label="Alert threshold in percent" />
            <span>% of the budget</span>
          </span>
        </label>
      </div>
      <label className="st-toggle">
        <input type="checkbox" className="st-check" checked={hard} onChange={e => setHard(e.target.checked)} />
        <div>
          <b>Refuse requests over budget</b>
          <span>Off: alerts only. On: a request that would take the month past the budget is refused with HTTP 429 before any model is called.</span>
        </div>
      </label>
      {error && <div role="alert" className="st-error">{error}</div>}
      <div className="st-actions">
        <button type="button" className="st-btn is-primary is-sm" disabled={saving} onClick={() => save(false)}>{saving ? 'Saving…' : 'Save budget'}</button>
        {keyRow.budgetLimit && <button type="button" className="st-btn is-sm" disabled={saving} onClick={() => save(true)}>Remove budget</button>}
        <button type="button" className="st-btn is-quiet is-sm" disabled={saving} onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
      </div>
    </div>
  );
}
