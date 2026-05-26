'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import RouterLayout from '@/components/RouterLayout';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import { apiClient } from '@/lib/api-client';
import type { KeyActivity, KeySummary, BudgetAlert, PromptAuditEntry, EfficiencyMetrics, KeyCostBreakdown } from '@/lib/api-client';

type Tab = 'activity' | 'costs' | 'prompts' | 'budgets';

const CATEGORY_COLORS: Record<string, string> = {
  coding: '#4a9eff',
  reasoning: '#b266ff',
  creative: '#33cc77',
  analysis: '#ffb020',
  general: '#888',
};

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return <span className="rv4-badge dim" style={{ fontSize: '9px' }}>—</span>;
  const color = CATEGORY_COLORS[category] || '#888';
  return (
    <span className="rv4-badge" style={{ fontSize: '9px', background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {category.toUpperCase()}
    </span>
  );
}

function MonitoringPageContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'activity');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      apiClient.setUserId(session.user.id);
      loadInitialData();
    }
  }, [status, session]);

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

  if (loading && keys.length === 0) {
    return (
      <RouterLayout>
        <div className="rv4-page-header">
          <div className="rv4-page-header-left">
            <span style={{ fontSize: '18px' }}>🔍</span>
            <div className="rv4-page-title">API MONITORING<span className="blinking-cursor"></span></div>
          </div>
        </div>
        <div className="rv4-loading" style={{ minHeight: '300px' }}>
          <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
          <span>LOADING MONITORING</span>
        </div>
      </RouterLayout>
    );
  }

  return (
    <RouterLayout>
      <SubscriptionGuard feature="API Monitoring">
        {/* Page header */}
        <div className="rv4-page-header">
          <div className="rv4-page-header-left">
            <span style={{ fontSize: '18px' }}>🔍</span>
            <div>
              <div className="rv4-page-title">API MONITORING<span className="blinking-cursor"></span></div>
              <div className="rv4-page-title-sub">Track key usage, costs, prompts, and budgets</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="rv4-body">
          <div className="rv4-ctrl-group" style={{ marginBottom: '16px' }}>
            {([
              { id: 'activity', label: '📋 KEY ACTIVITY' },
              { id: 'costs', label: '💰 COST DASHBOARD' },
              { id: 'prompts', label: '📝 PROMPT AUDIT' },
              { id: 'budgets', label: '🎯 BUDGETS & ALERTS' },
            ] as const).map(t => (
              <button
                key={t.id}
                className={`rv4-ctrl-btn${tab === t.id ? ' active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="rv4-error-banner" style={{ marginBottom: '14px' }}>
              <span>⚠</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>ERROR</div>
                <div style={{ fontSize: '10px' }}>{error}</div>
              </div>
            </div>
          )}

          {/* Key selector (shared across tabs) */}
          {keys.length > 0 && (tab === 'activity' || tab === 'costs') && (
            <div className="rv4-panel" style={{ marginBottom: '14px' }}>
              <div className="rv4-panel-body" style={{ padding: '10px 14px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)' }}>SELECT KEY:</label>
                <select
                  value={selectedKeyId || ''}
                  onChange={e => setSelectedKeyId(parseInt(e.target.value))}
                  className="rv4-select"
                  style={{ flex: 1, maxWidth: '300px' }}
                >
                  {keys.map(k => (
                    <option key={k.id} value={k.id}>
                      {k.name} {k.department ? `(${k.department})` : ''} — {k.keyPrefix}
                    </option>
                  ))}
                </select>
                {tab === 'activity' && (
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="rv4-select"
                    style={{ maxWidth: '160px' }}
                  >
                    <option value="">ALL CATEGORIES</option>
                    <option value="coding">CODING</option>
                    <option value="reasoning">REASONING</option>
                    <option value="creative">CREATIVE</option>
                    <option value="analysis">ANALYSIS</option>
                    <option value="general">GENERAL</option>
                  </select>
                )}
                {tab === 'costs' && (
                  <div className="rv4-ctrl-group">
                    {(['7d', '30d', '90d'] as const).map(p => (
                      <button key={p} className={`rv4-ctrl-btn${costPeriod === p ? ' active' : ''}`} onClick={() => setCostPeriod(p)}>
                        {p === '7d' ? '7 DAYS' : p === '30d' ? '30 DAYS' : '90 DAYS'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 1: KEY ACTIVITY */}
          {/* ================================================================ */}
          {tab === 'activity' && (
            <>
              {/* Key summary cards */}
              <div style={{ display: 'flex', gap: '1px', marginBottom: '14px', background: 'rgba(0,255,65,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                {keys.slice(0, 4).map(k => (
                  <div
                    key={k.id}
                    className={`rv4-stat-cell${k.id === selectedKeyId ? ' accent-green' : ''}`}
                    style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
                    onClick={() => setSelectedKeyId(k.id)}
                  >
                    <div className="rv4-stat-label" style={{ fontSize: '9px' }}>{k.name}</div>
                    <div className="rv4-stat-value" style={{ fontSize: '16px' }}>
                      {k.requestCount}
                    </div>
                    <div className="rv4-stat-sub">
                      ${k.currentSpend.toFixed(4)} {k.budgetLimit ? `/ $${k.budgetLimit}` : ''}
                    </div>
                  </div>
                ))}
              </div>

              {/* Activity table */}
              <div className="rv4-panel">
                <div className="rv4-panel-header">
                  <span className="rv4-panel-title">📋 REQUEST LOG</span>
                  <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>{activity.length} requests</span>
                </div>
                <div className="rv4-panel-body" style={{ padding: 0 }}>
                  {activity.length > 0 ? (
                    <div className="rv4-table-wrapper">
                      <table className="rv4-table">
                        <thead>
                          <tr>
                            <th>Status</th>
                            <th>Model</th>
                            <th>Category</th>
                            <th>Tokens</th>
                            <th>Cost</th>
                            <th>Latency</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activity.map(a => (
                            <tr key={a.id}>
                              <td>{a.success ? <span className="rv4-badge green">✓</span> : <span className="rv4-badge red">✗</span>}</td>
                              <td className="td-green td-mono" style={{ fontSize: '10px' }}>{a.model}</td>
                              <td><CategoryBadge category={a.category} /></td>
                              <td className="td-dim">{(a.tokensIn + a.tokensOut).toLocaleString()}</td>
                              <td className="td-amber">${a.cost}</td>
                              <td className="td-dim">{a.latency}ms</td>
                              <td className="td-dim" style={{ fontSize: '9px' }}>{new Date(a.timestamp).toLocaleTimeString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rv4-empty" style={{ padding: '40px' }}>
                      <div className="rv4-empty-icon">📋</div>
                      <div className="rv4-empty-title">No Activity</div>
                      <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>
                        No requests recorded for this key yet
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {activityCursor && (
                <button className="rv4-ctrl-btn primary" style={{ marginTop: '10px', width: '100%' }} onClick={loadMoreActivity}>
                  LOAD MORE
                </button>
              )}
            </>
          )}

          {/* ================================================================ */}
          {/* TAB 2: COST DASHBOARD */}
          {/* ================================================================ */}
          {tab === 'costs' && (
            <>
              {keyCosts ? (
                <>
                  {/* Cost KPIs */}
                  <div className="rv4-stat-bar cols-4" style={{ marginBottom: '14px' }}>
                    <div className="rv4-stat-cell accent-amber">
                      <div className="rv4-stat-label">Total Cost</div>
                      <div className="rv4-stat-value amber">${keyCosts.totalCost}</div>
                      <div className="rv4-stat-sub">{keyCosts.period} period</div>
                    </div>
                    <div className="rv4-stat-cell accent-green">
                      <div className="rv4-stat-label">Requests</div>
                      <div className="rv4-stat-value">{keyCosts.totalRequests.toLocaleString()}</div>
                    </div>
                    <div className="rv4-stat-cell accent-blue">
                      <div className="rv4-stat-label">Total Tokens</div>
                      <div className="rv4-stat-value blue">{(keyCosts.totalTokens / 1000).toFixed(1)}K</div>
                    </div>
                    <div className="rv4-stat-cell">
                      <div className="rv4-stat-label">Budget Forecast</div>
                      <div className="rv4-stat-value" style={{ fontSize: '14px' }}>
                        {keyCosts.forecast.daysUntilBudget !== null
                          ? `${keyCosts.forecast.daysUntilBudget}d`
                          : '∞'}
                      </div>
                      <div className="rv4-stat-sub">
                        Projected: ${keyCosts.forecast.projectedMonthEnd.toFixed(4)}
                      </div>
                    </div>
                  </div>

                  {/* Daily cost sparkline */}
                  {keyCosts.dailyCosts.length > 0 && (
                    <div className="rv4-panel" style={{ marginBottom: '14px' }}>
                      <div className="rv4-panel-header">
                        <span className="rv4-panel-title">DAILY COST TREND</span>
                      </div>
                      <div className="rv4-panel-body" style={{ padding: '10px 14px' }}>
                        {(() => {
                          const data = keyCosts.dailyCosts;
                          const maxCost = Math.max(...data.map(d => d.cost), 0.001);
                          const w = 100;
                          const h = 50;
                          const points = data.map((d, i) => {
                            const x = (i / Math.max(data.length - 1, 1)) * w;
                            const y = h - (d.cost / maxCost) * (h - 4) - 2;
                            return `${x},${y}`;
                          }).join(' ');
                          return (
                            <>
                              <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
                                <polyline points={points} fill="none" stroke="var(--amber-warning)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                              </svg>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--phosphor-dim)', marginTop: '4px' }}>
                                <span>{data[0]?.date}</span>
                                <span>{data[data.length - 1]?.date}</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Model breakdown */}
                  {keyCosts.modelBreakdown.length > 0 && (
                    <div className="rv4-panel">
                      <div className="rv4-panel-header">
                        <span className="rv4-panel-title">MODEL BREAKDOWN</span>
                      </div>
                      <div className="rv4-panel-body">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {keyCosts.modelBreakdown.map(m => {
                            const pct = parseFloat(m.percentage);
                            return (
                              <div key={m.model}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)' }}>{m.model}</span>
                                  <span style={{ fontSize: '10px', color: 'var(--amber-warning)' }}>${m.cost}</span>
                                </div>
                                <div className="rv4-progress">
                                  <div className="rv4-progress-fill amber" style={{ width: `${pct}%` }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--phosphor-dim)', marginTop: '2px' }}>
                                  <span>{m.requests} requests</span>
                                  <span>{m.percentage}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rv4-empty" style={{ padding: '40px' }}>
                  <div className="rv4-empty-icon">💰</div>
                  <div className="rv4-empty-title">Select a Key</div>
                  <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>
                    Choose an API key above to view its cost breakdown
                  </div>
                </div>
              )}
            </>
          )}

          {/* ================================================================ */}
          {/* TAB 3: PROMPT AUDIT */}
          {/* ================================================================ */}
          {tab === 'prompts' && (
            <>
              {/* Prompt logging toggle */}
              <div className="rv4-panel" style={{ marginBottom: '14px' }}>
                <div className="rv4-panel-header">
                  <span className="rv4-panel-title">🔒 PROMPT LOGGING</span>
                </div>
                <div className="rv4-panel-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={promptLoggingEnabled}
                        onChange={handleTogglePromptLogging}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: promptLoggingEnabled ? 'var(--phosphor-green)' : 'var(--phosphor-dim)' }}>
                        {promptLoggingEnabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </label>
                    <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>
                      Retention: {retentionDays > 0 ? `${retentionDays} days` : 'Forever'}
                    </span>
                  </div>
                  <div className="rv4-info-banner" style={{ padding: '8px 12px', fontSize: '10px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--amber-warning)' }}>[INFO]</span>
                    <span style={{ marginLeft: '8px' }}>
                      Prompts are automatically scrubbed for API keys, passwords, tokens, emails, and high-entropy secrets before encryption at rest.
                    </span>
                  </div>
                </div>
              </div>

              {/* Category distribution */}
              {categories.length > 0 && (
                <div className="rv4-panel" style={{ marginBottom: '14px' }}>
                  <div className="rv4-panel-header">
                    <span className="rv4-panel-title">📊 CATEGORY DISTRIBUTION</span>
                  </div>
                  <div className="rv4-panel-body" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {categories.map(c => (
                      <div key={c.category} style={{
                        padding: '6px 12px',
                        background: `${CATEGORY_COLORS[c.category] || '#888'}15`,
                        border: `1px solid ${CATEGORY_COLORS[c.category] || '#888'}44`,
                        borderRadius: '3px',
                        fontSize: '10px',
                      }}>
                        <span style={{ fontWeight: 'bold', color: CATEGORY_COLORS[c.category] || '#888' }}>
                          {c.category?.toUpperCase()}
                        </span>
                        <span style={{ marginLeft: '8px', color: 'var(--phosphor-dim)' }}>
                          {c.count} ({c.percentage})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prompt log */}
              {promptLoggingEnabled ? (
                <div className="rv4-panel">
                  <div className="rv4-panel-header">
                    <span className="rv4-panel-title">📝 PROMPT LOG</span>
                    <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>{prompts.length} entries</span>
                  </div>
                  <div className="rv4-panel-body" style={{ padding: 0 }}>
                    {prompts.length > 0 ? (
                      <div className="rv4-table-wrapper">
                        <table className="rv4-table">
                          <thead>
                            <tr>
                              <th>Key</th>
                              <th>Category</th>
                              <th>Prompt Preview</th>
                              <th>Model</th>
                              <th>Cost</th>
                              <th>Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {prompts.map(p => (
                              <tr key={p.id}>
                                <td className="td-dim" style={{ fontSize: '9px' }}>{p.keyName}</td>
                                <td><CategoryBadge category={p.category} /></td>
                                <td style={{ fontSize: '10px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {p.promptPreview}
                                </td>
                                <td className="td-green td-mono" style={{ fontSize: '9px' }}>{p.model}</td>
                                <td className="td-amber">${p.cost}</td>
                                <td className="td-dim" style={{ fontSize: '9px' }}>{new Date(p.timestamp).toLocaleTimeString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="rv4-empty" style={{ padding: '40px' }}>
                        <div className="rv4-empty-icon">📝</div>
                        <div className="rv4-empty-title">No Prompts Logged</div>
                        <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>
                          Prompts will appear here after requests are made with logging enabled
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rv4-panel">
                  <div className="rv4-panel-body" style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', marginBottom: '10px' }}>📝</div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '6px' }}>
                      PROMPT LOGGING IS DISABLED
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', marginBottom: '14px', maxWidth: '400px', margin: '0 auto 14px' }}>
                      Enable prompt logging above to record and audit what prompts are being sent through your API keys.
                      Prompts are automatically scrubbed for secrets and encrypted at rest.
                    </div>
                    <button className="rv4-ctrl-btn primary" onClick={handleTogglePromptLogging}>
                      ENABLE PROMPT LOGGING
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ================================================================ */}
          {/* TAB 4: BUDGETS & ALERTS */}
          {/* ================================================================ */}
          {tab === 'budgets' && (
            <>
              {/* Active alerts */}
              {alerts.length > 0 && (
                <div className="rv4-panel" style={{ marginBottom: '14px' }}>
                  <div className="rv4-panel-header">
                    <span className="rv4-panel-title">🚨 ACTIVE ALERTS</span>
                    <span className="rv4-badge red" style={{ fontSize: '9px' }}>{alerts.length}</span>
                  </div>
                  <div className="rv4-panel-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {alerts.map(a => (
                        <div key={a.id} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '8px 12px',
                          background: a.alertType === 'budget_exceeded' ? 'rgba(255,80,80,0.08)' : 'rgba(255,176,0,0.08)',
                          border: `1px solid ${a.alertType === 'budget_exceeded' ? 'var(--red-alert)' : 'var(--amber-warning)'}`,
                          borderRadius: '3px',
                        }}>
                          <span style={{ fontSize: '14px' }}>{a.alertType === 'budget_exceeded' ? '🔴' : '🟡'}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '11px', fontWeight: 'bold' }}>
                              {a.keyName}: {a.alertType === 'budget_exceeded' ? 'BUDGET EXCEEDED' : 'THRESHOLD WARNING'}
                            </div>
                            <div style={{ fontSize: '9px', color: 'var(--phosphor-dim)' }}>
                              ${a.amountSpent.toFixed(4)} / ${a.budgetLimit.toFixed(2)} — {new Date(a.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <button className="rv4-ctrl-btn" style={{ fontSize: '9px' }} onClick={() => handleAcknowledgeAlert(a.id)}>
                            ACK
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Budget status per key */}
              <div className="rv4-panel" style={{ marginBottom: '14px' }}>
                <div className="rv4-panel-header">
                  <span className="rv4-panel-title">💰 BUDGET STATUS</span>
                </div>
                <div className="rv4-panel-body">
                  {budgetStatus.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {budgetStatus.map((k: any) => {
                        const util = k.utilization;
                        const barColor = !util ? 'var(--phosphor-dim)' : util >= 100 ? 'var(--red-alert)' : util >= 80 ? 'var(--amber-warning)' : 'var(--phosphor-green)';
                        return (
                          <div key={k.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)' }}>
                                {k.name} {k.department ? `(${k.department})` : ''}
                              </span>
                              <span style={{ fontSize: '10px' }}>
                                <span style={{ color: 'var(--amber-warning)' }}>${k.currentSpend.toFixed(4)}</span>
                                {k.budgetLimit ? (
                                  <span style={{ color: 'var(--phosphor-dim)' }}> / ${k.budgetLimit.toFixed(2)}</span>
                                ) : (
                                  <span style={{ color: 'var(--phosphor-dim)' }}> (no limit)</span>
                                )}
                              </span>
                            </div>
                            {k.budgetLimit && (
                              <div className="rv4-progress">
                                <div className="rv4-progress-fill" style={{ width: `${Math.min(util || 0, 100)}%`, background: barColor }} />
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', fontSize: '9px', color: 'var(--phosphor-dim)' }}>
                              <span>{k.budgetHardLimit ? '🔒 HARD LIMIT' : '📊 SOFT LIMIT'}</span>
                              {util !== null && <span>{util.toFixed(1)}%</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rv4-empty" style={{ padding: '30px' }}>
                      <div className="rv4-empty-icon">💰</div>
                      <div className="rv4-empty-title">No Keys</div>
                      <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>
                        Create API keys and set budgets in the API Keys page
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Efficiency metrics */}
              {efficiency.length > 0 && (
                <div className="rv4-panel">
                  <div className="rv4-panel-header">
                    <span className="rv4-panel-title">⚡ KEY EFFICIENCY</span>
                  </div>
                  <div className="rv4-panel-body" style={{ padding: 0 }}>
                    <div className="rv4-table-wrapper">
                      <table className="rv4-table">
                        <thead>
                          <tr>
                            <th>Key</th>
                            <th>Requests</th>
                            <th>Avg Tokens</th>
                            <th>Avg Cost</th>
                            <th>Error Rate</th>
                            <th>Avg Latency</th>
                            <th>Top Category</th>
                          </tr>
                        </thead>
                        <tbody>
                          {efficiency.map(e => (
                            <tr key={e.keyId}>
                              <td className="td-green td-mono" style={{ fontSize: '10px' }}>{e.keyName}</td>
                              <td className="td-dim">{e.requestCount}</td>
                              <td className="td-dim">{e.avgTokensPerRequest.toLocaleString()}</td>
                              <td className="td-amber">${e.avgCostPerRequest.toFixed(6)}</td>
                              <td style={{ color: parseFloat(e.errorRate) > 5 ? 'var(--red-alert)' : 'var(--phosphor-dim)' }}>
                                {e.errorRate}
                              </td>
                              <td className="td-dim">{e.avgLatency}ms</td>
                              <td>
                                {e.topCategories[0] ? (
                                  <CategoryBadge category={e.topCategories[0].category} />
                                ) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SubscriptionGuard>
    </RouterLayout>
  );
}

export default function MonitoringPage() {
  return (
    <Suspense fallback={
      <RouterLayout>
        <div className="rv4-page-header">
          <div className="rv4-page-header-left">
            <span style={{ fontSize: '18px' }}>🔍</span>
            <div className="rv4-page-title">API MONITORING<span className="blinking-cursor"></span></div>
          </div>
        </div>
        <div className="rv4-loading" style={{ minHeight: '300px' }}>
          <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
          <span>LOADING</span>
        </div>
      </RouterLayout>
    }>
      <MonitoringPageContent />
    </Suspense>
  );
}
