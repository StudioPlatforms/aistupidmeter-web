'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import { apiClient } from '@/lib/api-client';
import type { AnalyticsOverview, TimelineData, CostSavings, RecentRequest } from '@/lib/api-client';

export default function RouterAnalyticsPage() {
  const { data: session, status } = useSession();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [costSavings, setCostSavings] = useState<CostSavings | null>(null);
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      apiClient.setUserId(session.user.id);
      fetchAnalytics();
    } else if (status === 'unauthenticated') {
      setError('User authentication required');
      setLoading(false);
    }
  }, [status, session, timeRange]);

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

  const renderMiniChart = (data: any[], dataKey: string, color: string) => {
    if (!data || data.length === 0) return null;
    const values = data.map(d => parseFloat(d[dataKey]) || 0);
    const maxVal = Math.max(...values, 1);
    const minVal = Math.min(...values, 0);
    const range = maxVal - minVal || 1;
    const w = 100; const h = 50;
    const points = values.map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = h - ((v - minVal) / range) * (h - 4) - 2;
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${h} ${points} ${w},${h}`} fill={`url(#grad-${dataKey})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  };

  if (loading && !overview) {
    return (
      <RouterLayout>
        <div className="rv4-page-header">
          <div className="rv4-page-header-left">
            <span style={{ fontSize: '18px' }}>◈</span>
            <div className="rv4-page-title">ANALYTICS<span className="blinking-cursor"></span></div>
          </div>
        </div>
        <div className="rv4-loading" style={{ minHeight: '300px' }}>
          <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
          <span>LOADING ANALYTICS</span>
        </div>
      </RouterLayout>
    );
  }

  if (error || !overview) {
    return (
      <RouterLayout>
        <div className="rv4-page-header">
          <div className="rv4-page-header-left">
            <span style={{ fontSize: '18px' }}>◈</span>
            <div className="rv4-page-title">ANALYTICS</div>
          </div>
        </div>
        <div className="rv4-body">
          <div className="rv4-error-banner">
            <span>⚠</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>ANALYTICS ERROR</div>
              <div style={{ fontSize: '10px' }}>{error || 'Failed to load analytics data'}</div>
            </div>
            <button onClick={fetchAnalytics} className="rv4-ctrl-btn danger" style={{ marginLeft: 'auto', fontSize: '10px' }}>RETRY</button>
          </div>
        </div>
      </RouterLayout>
    );
  }

  return (
    <RouterLayout>
      <SubscriptionGuard feature="Analytics">
        {/* Page header */}
        <div className="rv4-page-header">
          <div className="rv4-page-header-left">
            <span style={{ fontSize: '18px' }}>◈</span>
            <div>
              <div className="rv4-page-title">ANALYTICS<span className="blinking-cursor"></span></div>
              <div className="rv4-page-title-sub">Track usage, costs, and performance metrics</div>
            </div>
          </div>
          <div className="rv4-page-header-right">
            <div className="rv4-ctrl-group">
              {(['7d', '30d', '90d'] as const).map(r => (
                <button key={r} className={`rv4-ctrl-btn${timeRange === r ? ' active' : ''}`} onClick={() => setTimeRange(r)}>
                  {r === '7d' ? '7 DAYS' : r === '30d' ? '30 DAYS' : '90 DAYS'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rv4-body">
          {/* KPI stat bar */}
          <div className="rv4-stat-bar cols-4" style={{ borderRadius: '3px', marginBottom: '16px' }}>
            <div className="rv4-stat-cell accent-green">
              <div className="rv4-stat-label">Total Requests</div>
              <div className="rv4-stat-value">{overview.overview.totalRequests.toLocaleString()}</div>
              <div className="rv4-stat-sub">{overview.overview.successfulRequests} successful</div>
            </div>
            <div className="rv4-stat-cell accent-amber">
              <div className="rv4-stat-label">Total Cost</div>
              <div className="rv4-stat-value amber">${overview.overview.totalCost}</div>
              {costSavings && <div className="rv4-stat-sub">Saved ${costSavings.savings}</div>}
            </div>
            <div className="rv4-stat-cell accent-green">
              <div className="rv4-stat-label">Success Rate</div>
              <div className="rv4-stat-value">{overview.overview.successRate}</div>
              <div className="rv4-stat-sub">{overview.overview.successfulRequests}/{overview.overview.totalRequests}</div>
            </div>
            <div className="rv4-stat-cell accent-blue">
              <div className="rv4-stat-label">Total Tokens</div>
              <div className="rv4-stat-value blue">{(overview.overview.totalTokens / 1000).toFixed(1)}K</div>
              <div className="rv4-stat-sub">{(overview.overview.totalTokensIn / 1000).toFixed(1)}K in / {(overview.overview.totalTokensOut / 1000).toFixed(1)}K out</div>
            </div>
          </div>

          {/* Cost savings hero */}
          {costSavings && parseFloat(costSavings.savings) > 0 && (
            <div className="rv4-info-banner green" style={{ marginBottom: '14px', padding: '14px' }}>
              <span className="rv4-info-banner-icon" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold' }}>[SAVED]</span>
              <div className="rv4-info-banner-content">
                <div className="rv4-info-banner-title">YOU'VE SAVED ${costSavings.savings}</div>
                <div className="rv4-info-banner-text">
                  That's {costSavings.savingsPercentage} less than using the most expensive model
                  <span style={{ marginLeft: '16px' }}>Your cost: <strong style={{ color: 'var(--phosphor-green)' }}>${costSavings.actualCost}</strong></span>
                  <span style={{ marginLeft: '12px' }}>Without router: <strong style={{ color: 'var(--red-alert)' }}>${costSavings.worstCaseCost}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Timeline charts */}
          {timeline && timeline.timeline.length > 0 && (
            <div className="rv4-cols-2" style={{ marginBottom: '14px' }}>
              {[
                { title: 'REQUESTS OVER TIME', dataKey: 'requests', color: 'var(--phosphor-green)' },
                { title: 'COST OVER TIME', dataKey: 'cost', color: 'var(--amber-warning)' },
              ].map((chart) => {
                const data = timeline.timeline.slice(-14);
                const values = data.map((d: any) => parseFloat(d[chart.dataKey]) || 0);
                const maxVal = Math.max(...values, 1);
                const avgVal = values.reduce((a, b) => a + b, 0) / values.length;
                return (
                  <div key={chart.dataKey} className="rv4-panel">
                    <div className="rv4-panel-header">
                      <span className="rv4-panel-title">{chart.title}</span>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '10px' }}>
                        <span style={{ color: 'var(--phosphor-dim)' }}>Max: <strong style={{ color: chart.color }}>{chart.dataKey === 'cost' ? `$${maxVal.toFixed(2)}` : maxVal.toLocaleString()}</strong></span>
                        <span style={{ color: 'var(--phosphor-dim)' }}>Avg: <strong style={{ color: chart.color }}>{chart.dataKey === 'cost' ? `$${avgVal.toFixed(2)}` : avgVal.toFixed(0)}</strong></span>
                      </div>
                    </div>
                    <div className="rv4-panel-body" style={{ padding: '10px 14px' }}>
                      <div style={{ marginBottom: '6px' }}>
                        {renderMiniChart(data, chart.dataKey, chart.color)}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--phosphor-dim)' }}>
                        <span>{new Date(data[0]?.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        <span>{new Date(data[data.length - 1]?.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Provider + Top Models */}
          <div className="rv4-cols-2">
            <div className="rv4-panel">
              <div className="rv4-panel-header">
                <span className="rv4-panel-title">🔌 PROVIDER USAGE</span>
              </div>
              <div className="rv4-panel-body">
                {overview.providers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {overview.providers.map((prov) => {
                      const pct = parseFloat(prov.percentage);
                      return (
                        <div key={prov.provider}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase' }}>{prov.provider}</span>
                            <span style={{ fontSize: '10px', color: 'var(--amber-warning)' }}>${prov.totalCost}</span>
                          </div>
                          <div className="rv4-progress">
                            <div className="rv4-progress-fill green" style={{ width: `${pct}%` }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                            <span style={{ fontSize: '9px', color: 'var(--phosphor-dim)' }}>{prov.requests} requests</span>
                            <span style={{ fontSize: '9px', color: 'var(--phosphor-dim)' }}>{prov.percentage}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rv4-empty">
                    <div className="rv4-empty-icon">🔌</div>
                    <div className="rv4-empty-title">No Provider Data</div>
                  </div>
                )}
              </div>
            </div>

            <div className="rv4-panel">
              <div className="rv4-panel-header">
                <span className="rv4-panel-title">🏆 TOP MODELS</span>
              </div>
              <div className="rv4-panel-body">
                {overview.topModels.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {overview.topModels.slice(0, 5).map((model, index) => {
                      const pct = parseFloat(model.percentage);
                      return (
                        <div key={model.model}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-dim)', minWidth: '20px' }}>#{index + 1}</span>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.model}</span>
                            <span style={{ fontSize: '10px', color: 'var(--amber-warning)', flex: 'none' }}>${model.totalCost}</span>
                          </div>
                          <div className="rv4-progress">
                            <div className="rv4-progress-fill amber" style={{ width: `${pct}%` }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                            <span style={{ fontSize: '9px', color: 'var(--phosphor-dim)' }}>{model.requests} requests</span>
                            <span style={{ fontSize: '9px', color: 'var(--phosphor-dim)' }}>{model.percentage}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rv4-empty">
                    <div className="rv4-empty-icon">🏆</div>
                    <div className="rv4-empty-title">No Model Data</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Requests table */}
          {recentRequests.length > 0 && (
            <div className="rv4-panel" style={{ marginTop: '14px' }}>
              <div className="rv4-panel-header">
                <span className="rv4-panel-title">📋 RECENT REQUESTS</span>
                <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>Last {recentRequests.length}</span>
              </div>
              <div className="rv4-panel-body" style={{ padding: 0 }}>
                <div className="rv4-table-wrapper">
                  <table className="rv4-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Model</th>
                        <th>Provider</th>
                        <th>Tokens</th>
                        <th>Cost</th>
                        <th>Latency</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRequests.map((req) => (
                        <tr key={req.id}>
                          <td>
                            {req.success
                              ? <span className="rv4-badge green">✓ OK</span>
                              : <span className="rv4-badge red">✗ FAIL</span>}
                          </td>
                          <td className="td-green td-mono">{req.model}</td>
                          <td className="td-dim">{req.provider}</td>
                          <td className="td-dim">{(req.tokensIn + req.tokensOut).toLocaleString()}</td>
                          <td className="td-amber">${req.cost}</td>
                          <td className="td-dim">{req.latency}ms</td>
                          <td className="td-dim">{new Date(req.timestamp).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Export */}
          <div className="rv4-panel" style={{ marginTop: '14px' }}>
            <div className="rv4-panel-header">
              <span className="rv4-panel-title">EXPORT DATA</span>
            </div>
            <div className="rv4-panel-body">
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={() => handleExport('csv')} className="rv4-ctrl-btn primary">
                  EXPORT CSV
                </button>
                <button onClick={() => handleExport('json')} className="rv4-ctrl-btn primary">
                  EXPORT JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      </SubscriptionGuard>
    </RouterLayout>
  );
}
