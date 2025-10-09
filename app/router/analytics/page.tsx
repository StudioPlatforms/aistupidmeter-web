'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import PixelIcon from '@/components/PixelIcon';
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
      console.error('Failed to fetch analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (!overview) return;
    
    const timestamp = new Date().toISOString().split('T')[0];
    
    if (format === 'csv') {
      // Overview metrics
      let csv = '# ANALYTICS OVERVIEW\n';
      csv += 'Metric,Value\n';
      csv += `Export Date,${new Date().toLocaleString()}\n`;
      csv += `Time Range,${timeRange}\n`;
      csv += `Total Requests,${overview.overview.totalRequests}\n`;
      csv += `Successful Requests,${overview.overview.successfulRequests}\n`;
      csv += `Failed Requests,${overview.overview.totalRequests - overview.overview.successfulRequests}\n`;
      csv += `Success Rate,${overview.overview.successRate}\n`;
      csv += `Total Cost,$${overview.overview.totalCost}\n`;
      csv += `Total Tokens,${overview.overview.totalTokens}\n`;
      csv += `Input Tokens,${overview.overview.totalTokensIn}\n`;
      csv += `Output Tokens,${overview.overview.totalTokensOut}\n`;
      
      // Cost savings
      if (costSavings) {
        csv += '\n# COST SAVINGS\n';
        csv += 'Metric,Value\n';
        csv += `Actual Cost,$${costSavings.actualCost}\n`;
        csv += `Worst Case Cost,$${costSavings.worstCaseCost}\n`;
        csv += `Savings,$${costSavings.savings}\n`;
        csv += `Savings Percentage,${costSavings.savingsPercentage}\n`;
      }
      
      // Provider breakdown
      if (overview.providers.length > 0) {
        csv += '\n# PROVIDER BREAKDOWN\n';
        csv += 'Provider,Requests,Percentage,Total Cost\n';
        overview.providers.forEach(p => {
          csv += `${p.provider},${p.requests},${p.percentage},${p.totalCost}\n`;
        });
      }
      
      // Top models
      if (overview.topModels.length > 0) {
        csv += '\n# TOP MODELS\n';
        csv += 'Model,Requests,Percentage,Total Cost\n';
        overview.topModels.forEach(m => {
          csv += `${m.model},${m.requests},${m.percentage},${m.totalCost}\n`;
        });
      }
      
      // Recent requests
      if (recentRequests.length > 0) {
        csv += '\n# RECENT REQUESTS\n';
        csv += 'Timestamp,Model,Provider,Status,Tokens In,Tokens Out,Cost,Latency (ms)\n';
        recentRequests.forEach(r => {
          csv += `${new Date(r.timestamp).toISOString()},${r.model},${r.provider},${r.success ? 'Success' : 'Failed'},${r.tokensIn},${r.tokensOut},${r.cost},${r.latency}\n`;
        });
      }
      
      // Timeline data
      if (timeline && timeline.timeline.length > 0) {
        csv += '\n# TIMELINE DATA\n';
        csv += 'Date,Requests,Cost,Tokens In,Tokens Out,Total Tokens\n';
        timeline.timeline.forEach(t => {
          csv += `${new Date(t.period).toLocaleDateString()},${t.requests},${t.cost},${t.tokensIn},${t.tokensOut},${t.totalTokens}\n`;
        });
      }
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${timeRange}-${timestamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // JSON export with all data
      const exportData = {
        exportDate: new Date().toISOString(),
        timeRange,
        overview: {
          totalRequests: overview.overview.totalRequests,
          successfulRequests: overview.overview.successfulRequests,
          failedRequests: overview.overview.totalRequests - overview.overview.successfulRequests,
          successRate: overview.overview.successRate,
          totalCost: overview.overview.totalCost,
          totalTokens: overview.overview.totalTokens,
          totalTokensIn: overview.overview.totalTokensIn,
          totalTokensOut: overview.overview.totalTokensOut,
        },
        costSavings: costSavings ? {
          actualCost: costSavings.actualCost,
          worstCaseCost: costSavings.worstCaseCost,
          savings: costSavings.savings,
          savingsPercentage: costSavings.savingsPercentage,
        } : null,
        providers: overview.providers,
        topModels: overview.topModels,
        recentRequests: recentRequests.map(r => ({
          timestamp: r.timestamp,
          model: r.model,
          provider: r.provider,
          success: r.success,
          tokensIn: r.tokensIn,
          tokensOut: r.tokensOut,
          totalTokens: r.tokensIn + r.tokensOut,
          cost: r.cost,
          latency: r.latency,
        })),
        timeline: timeline ? timeline.timeline.map(t => ({
          period: t.period,
          requests: t.requests,
          cost: t.cost,
          tokensIn: t.tokensIn,
          tokensOut: t.tokensOut,
          totalTokens: t.totalTokens,
        })) : [],
      };
      
      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${timeRange}-${timestamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (loading && !overview) {
    return (
      <RouterLayout>
        <div className="vintage-container">
          <div className="dashboard-loading">
            <div className="terminal-text terminal-text--green" style={{ fontSize: '1.5em', textAlign: 'center' }}>
              LOADING ANALYTICS<span className="vintage-loading"></span>
            </div>
          </div>
        </div>
      </RouterLayout>
    );
  }

  if (error || !overview) {
    return (
      <RouterLayout>
        <div className="vintage-container">
          <div className="error-banner">
            <div className="terminal-text">
              <div className="terminal-text--red" style={{ fontSize: '1.2em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PixelIcon name="warning" size={20} />
                ANALYTICS ERROR
              </div>
              <div className="terminal-text--dim" style={{ marginBottom: '12px' }}>
                {error || 'Failed to load analytics data'}
              </div>
              <button onClick={fetchAnalytics} className="vintage-btn vintage-btn--danger">
                RETRY
              </button>
            </div>
          </div>
        </div>
      </RouterLayout>
    );
  }

  return (
    <RouterLayout>
      <SubscriptionGuard feature="Analytics">
      <div className="vintage-container">
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">
              <span className="terminal-text--green" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <PixelIcon name="analytics" size={28} />
                ANALYTICS
              </span>
              <span className="blinking-cursor"></span>
            </h1>
            <p className="dashboard-subtitle terminal-text--dim">
              Track usage, costs, and performance metrics
            </p>
          </div>
          <div className="time-range-selector">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`time-range-btn ${timeRange === range ? 'active' : ''}`}
              >
                {range === '7d' && '7 DAYS'}
                {range === '30d' && '30 DAYS'}
                {range === '90d' && '90 DAYS'}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="metrics-grid">
          <MetricCard
            label="Total Requests"
            value={overview.overview.totalRequests.toLocaleString()}
            iconName="chart"
            color="green"
            subtitle={`${overview.overview.successfulRequests} successful`}
          />
          <MetricCard
            label="Total Cost"
            value={`$${overview.overview.totalCost}`}
            iconName="money"
            color="amber"
            subtitle={costSavings ? `Saved $${costSavings.savings}` : undefined}
          />
          <MetricCard
            label="Success Rate"
            value={overview.overview.successRate}
            iconName="check"
            color="green"
            subtitle={`${overview.overview.successfulRequests}/${overview.overview.totalRequests} requests`}
          />
          <MetricCard
            label="Total Tokens"
            value={(overview.overview.totalTokens / 1000).toFixed(1) + 'K'}
            iconName="numbers"
            color="green"
            subtitle={`${(overview.overview.totalTokensIn / 1000).toFixed(1)}K in / ${(overview.overview.totalTokensOut / 1000).toFixed(1)}K out`}
          />
        </div>

        {/* Cost Savings Hero */}
        {costSavings && parseFloat(costSavings.savings) > 0 && (
          <div className="savings-banner">
            <div className="terminal-text">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <PixelIcon name="diamond" size={48} />
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <div className="terminal-text--green" style={{ fontSize: '1.5em', fontWeight: 'bold', marginBottom: '8px' }}>
                    YOU'VE SAVED ${costSavings.savings}
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '12px' }}>
                    That's {costSavings.savingsPercentage} less than using the most expensive model
                  </div>
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '0.9em' }}>
                    <div>
                      <span className="terminal-text--dim">Your Cost: </span>
                      <span className="terminal-text--green" style={{ fontWeight: 'bold' }}>${costSavings.actualCost}</span>
                    </div>
                    <div>
                      <span className="terminal-text--dim">Without Router: </span>
                      <span className="terminal-text--red" style={{ fontWeight: 'bold' }}>${costSavings.worstCaseCost}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts Section */}
        {timeline && timeline.timeline.length > 0 && (
          <div className="charts-section">
            <div className="section-card">
              <div className="section-header">
                <span className="terminal-text--green" style={{ fontSize: '1.2em', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PixelIcon name="analytics" size={22} />
                  USAGE TRENDS
                </span>
              </div>
              <div className="charts-grid">
                <LineChart
                  title="Requests Over Time"
                  data={timeline.timeline.slice(-14)}
                  dataKey="requests"
                  color="var(--phosphor-green)"
                  formatValue={(v) => v.toLocaleString()}
                />
                <LineChart
                  title="Cost Over Time"
                  data={timeline.timeline.slice(-14)}
                  dataKey="cost"
                  color="var(--amber-warning)"
                  formatValue={(v) => `$${v}`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Provider & Model Analytics */}
        <div className="analytics-columns">
          {/* Provider Distribution */}
          <div className="section-card">
            <div className="section-header">
              <span className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PixelIcon name="plug" size={20} />
                PROVIDER USAGE
              </span>
            </div>
            {overview.providers.length > 0 ? (
              <div className="analytics-list">
                {overview.providers.map((provider) => (
                  <div key={provider.provider} className="analytics-item">
                    <div className="analytics-item-header">
                      <span className="terminal-text--green" style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {provider.provider}
                      </span>
                      <span className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                        {provider.requests} requests
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ 
                          width: `${provider.percentage}%`,
                          backgroundColor: 'var(--phosphor-green)'
                        }}
                      />
                    </div>
                    <div className="analytics-item-footer">
                      <span className="terminal-text--dim">{provider.percentage}</span>
                      <span className="terminal-text--amber">${provider.totalCost}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="terminal-text--dim">No provider data available</div>
              </div>
            )}
          </div>

          {/* Top Models */}
          <div className="section-card">
            <div className="section-header">
              <span className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PixelIcon name="trophy" size={20} />
                TOP MODELS
              </span>
            </div>
            {overview.topModels.length > 0 ? (
              <div className="analytics-list">
                {overview.topModels.slice(0, 5).map((model, index) => (
                  <div key={model.model} className="analytics-item">
                    <div className="analytics-item-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="rank-badge">#{index + 1}</span>
                        <span className="terminal-text--green" style={{ fontWeight: 'bold', fontSize: '0.9em' }}>
                          {model.model}
                        </span>
                      </div>
                      <span className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                        {model.requests} requests
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ 
                          width: `${model.percentage}%`,
                          backgroundColor: 'var(--amber-warning)'
                        }}
                      />
                    </div>
                    <div className="analytics-item-footer">
                      <span className="terminal-text--dim">{model.percentage}</span>
                      <span className="terminal-text--amber">${model.totalCost}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="terminal-text--dim">No model data available</div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Requests Table */}
        {recentRequests.length > 0 && (
          <div className="section-card">
            <div className="section-header">
              <span className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PixelIcon name="list" size={20} />
                RECENT REQUESTS
              </span>
              <span className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                Last {recentRequests.length} requests
              </span>
            </div>
            <div className="requests-table-container">
              <table className="requests-table">
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
                  {recentRequests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        {request.success ? (
                          <span className="status-badge success">
                            <PixelIcon name="check" size={14} />
                          </span>
                        ) : (
                          <span className="status-badge error">
                            <PixelIcon name="close" size={14} />
                          </span>
                        )}
                      </td>
                      <td className="terminal-text--green">{request.model}</td>
                      <td className="terminal-text--dim">{request.provider}</td>
                      <td className="terminal-text--dim">{(request.tokensIn + request.tokensOut).toLocaleString()}</td>
                      <td className="terminal-text--amber">${request.cost}</td>
                      <td className="terminal-text--dim">{request.latency}ms</td>
                      <td className="terminal-text--dim">
                        {new Date(request.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Export Section */}
        <div className="section-card">
          <div className="section-header">
            <span className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
              💾 EXPORT DATA
            </span>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={() => handleExport('csv')} className="vintage-btn" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PixelIcon name="list" size={16} />
              EXPORT CSV
            </button>
            <button onClick={() => handleExport('json')} className="vintage-btn" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PixelIcon name="chart" size={16} />
              EXPORT JSON
            </button>
          </div>
        </div>
      </div>
      </SubscriptionGuard>
    </RouterLayout>
  );
}

// Metric Card Component
function MetricCard({ 
  label, 
  value, 
  iconName, 
  color,
  subtitle
}: { 
  label: string; 
  value: string; 
  iconName: string; 
  color: 'green' | 'amber' | 'red';
  subtitle?: string;
}) {
  const colorClass = 
    color === 'green' ? 'terminal-text--green' :
    color === 'amber' ? 'terminal-text--amber' : 'terminal-text--red';

  return (
    <div className="metric-card">
      <div className="metric-icon">
        <PixelIcon name={iconName} size={24} />
      </div>
      <div className="metric-content">
        <div className="metric-label terminal-text--dim">{label}</div>
        <div className={`metric-value ${colorClass}`}>{value}</div>
        {subtitle && (
          <div className="metric-subtitle terminal-text--dim">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

// Line Chart Component
function LineChart({
  title,
  data,
  dataKey,
  color,
  formatValue
}: {
  title: string;
  data: any[];
  dataKey: string;
  color: string;
  formatValue: (value: any) => string;
}) {
  const values = data.map(d => parseFloat(d[dataKey]) || 0);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;

  return (
    <div className="chart-container">
      <div className="chart-title terminal-text--green">{title}</div>
      <div className="line-chart">
        <svg width="100%" height="200" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`gradient-${dataKey}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.3 }} />
              <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.05 }} />
            </linearGradient>
          </defs>
          
          {/* Area under line */}
          <path
            d={`M 0 200 ${data.map((d, i) => {
              const x = (i / (data.length - 1)) * 100;
              const value = parseFloat(d[dataKey]) || 0;
              const y = 200 - ((value - minValue) / range) * 180;
              return `L ${x} ${y}`;
            }).join(' ')} L 100 200 Z`}
            fill={`url(#gradient-${dataKey})`}
          />
          
          {/* Line */}
          <path
            d={`M ${data.map((d, i) => {
              const x = (i / (data.length - 1)) * 100;
              const value = parseFloat(d[dataKey]) || 0;
              const y = 200 - ((value - minValue) / range) * 180;
              return `${x} ${y}`;
            }).join(' L ')}`}
            fill="none"
            stroke={color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          
          {/* Data points */}
          {data.map((d, i) => {
            const x = (i / (data.length - 1)) * 100;
            const value = parseFloat(d[dataKey]) || 0;
            const y = 200 - ((value - minValue) / range) * 180;
            return (
              <circle
                key={i}
                cx={`${x}%`}
                cy={y}
                r="3"
                fill={color}
                style={{ filter: `drop-shadow(0 0 3px ${color})` }}
              />
            );
          })}
        </svg>
      </div>
      <div className="chart-labels">
        <span className="terminal-text--dim">
          {new Date(data[0]?.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        <span className="terminal-text--dim">
          {new Date(data[data.length - 1]?.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
      <div className="chart-stats">
        <div>
          <span className="terminal-text--dim">Max: </span>
          <span style={{ color }}>{formatValue(maxValue)}</span>
        </div>
        <div>
          <span className="terminal-text--dim">Avg: </span>
          <span style={{ color }}>{formatValue(values.reduce((a, b) => a + b, 0) / values.length)}</span>
        </div>
      </div>
    </div>
  );
}
