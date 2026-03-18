'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import RouterLayout from '@/components/RouterLayout';
import DashboardPreview from '@/components/DashboardPreview';
import { apiClient } from '@/lib/api-client';
import type { AnalyticsOverview, RecentRequest, CostSavings } from '@/lib/api-client';

export const dynamic = 'force-dynamic';

function RouterDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [costSavings, setCostSavings] = useState<CostSavings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [showSalesOverlay, setShowSalesOverlay] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      setShowSuccessBanner(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.pathname);
      setTimeout(() => setShowSuccessBanner(false), 10000);
    }

    if (status === 'authenticated' && session?.user?.email) {
      checkUserSubscription();
    } else if (status === 'unauthenticated') {
      setError('User authentication required');
      setLoading(false);
      setCheckingSubscription(false);
    }
  }, [status, session, searchParams]);

  const checkUserSubscription = async () => {
    try {
      setCheckingSubscription(true);
      const response = await fetch('/api/subscription/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session!.user!.email! })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Failed to check subscription');
      if (!result.data.hasAccess) {
        setShowSalesOverlay(true);
        setHasAccess(false);
        setLoading(false);
        return;
      }
      setHasAccess(true);
      if (session?.user?.id) {
        apiClient.setUserId(session.user.id);
        fetchDashboardData();
      }
    } catch (err) {
      setError('Failed to verify subscription status');
      setLoading(false);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [overviewData, requestsData, savingsData] = await Promise.all([
        apiClient.getAnalyticsOverview(),
        apiClient.getRecentRequests(5, 0),
        apiClient.getCostSavings().catch(() => null)
      ]);
      setOverview(overviewData);
      setRecentRequests(requestsData.requests);
      setCostSavings(savingsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (showSalesOverlay && !hasAccess) {
    return (
      <RouterLayout>
        <DashboardPreview />
      </RouterLayout>
    );
  }

  if (checkingSubscription || (loading && !overview)) {
    return (
      <RouterLayout>
        <div className="rv4-page-header">
          <div className="rv4-page-header-left">
            <div className="rv4-page-title">AI SMART ROUTER<span className="blinking-cursor"></span></div>
          </div>
        </div>
        <div className="rv4-loading" style={{ minHeight: '300px' }}>
          <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
          <span>LOADING DASHBOARD</span>
        </div>
      </RouterLayout>
    );
  }

  const stats = overview ? {
    totalRequests: overview.overview.totalRequests,
    totalCost: overview.overview.totalCost,
    successRate: overview.overview.successRate,
    totalTokens: overview.overview.totalTokens,
  } : null;

  return (
    <RouterLayout>
      {/* Page header */}
      <div className="rv4-page-header">
        <div className="rv4-page-header-left">
          <div>
            <div className="rv4-page-title">AI SMART ROUTER<span className="blinking-cursor"></span></div>
            <div className="rv4-page-title-sub">Intelligent Model Selection • Save 50-70% on AI Costs</div>
          </div>
        </div>
        <div className="rv4-page-header-right">
          {loading ? (
            <span className="rv4-badge amber">REFRESHING</span>
          ) : error ? (
            <span className="rv4-badge red">ERROR</span>
          ) : (
            <span className="rv4-badge green">● ONLINE</span>
          )}
          <button onClick={fetchDashboardData} className="rv4-ctrl-btn" title="Refresh">↺</button>
        </div>
      </div>

      <div className="rv4-body">
        {/* Success banner */}
        {showSuccessBanner && (
          <div className="rv4-success-banner" style={{ marginBottom: '14px' }}>
            <span>✓</span>
            <div>
              <strong>SUBSCRIPTION ACTIVATED</strong>
              <span style={{ fontWeight: 'normal', marginLeft: '8px', opacity: 0.8 }}>Welcome to AI Router Pro • 7-day trial started • Full access unlocked</span>
            </div>
            <button onClick={() => setShowSuccessBanner(false)} className="rv4-ctrl-btn" style={{ marginLeft: 'auto', fontSize: '10px' }}>×</button>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="rv4-error-banner" style={{ marginBottom: '14px' }}>
            <span>⚠</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>CONNECTION ERROR</div>
              <div style={{ fontSize: '10px' }}>{error}</div>
            </div>
            <button onClick={fetchDashboardData} className="rv4-ctrl-btn danger" style={{ marginLeft: 'auto', fontSize: '10px' }}>RETRY</button>
          </div>
        )}

        {/* KPI stat bar */}
        <div className="rv4-stat-bar cols-4" style={{ borderRadius: '3px', marginBottom: '16px' }}>
          <div className="rv4-stat-cell accent-green">
            <div className="rv4-stat-label">Total Requests</div>
            {loading ? <div className="rv4-stat-value" style={{ opacity: 0.4 }}>...</div>
              : <div className="rv4-stat-value">{stats?.totalRequests.toLocaleString() || '0'}</div>}
          </div>
          <div className="rv4-stat-cell accent-amber">
            <div className="rv4-stat-label">Total Cost</div>
            {loading ? <div className="rv4-stat-value amber" style={{ opacity: 0.4 }}>...</div>
              : <div className="rv4-stat-value amber">${stats?.totalCost || '0.00'}</div>}
          </div>
          <div className="rv4-stat-cell accent-green">
            <div className="rv4-stat-label">Success Rate</div>
            {loading ? <div className="rv4-stat-value" style={{ opacity: 0.4 }}>...</div>
              : <div className="rv4-stat-value">{stats?.successRate || '0%'}</div>}
          </div>
          <div className="rv4-stat-cell accent-blue">
            <div className="rv4-stat-label">Total Tokens</div>
            {loading ? <div className="rv4-stat-value blue" style={{ opacity: 0.4 }}>...</div>
              : <div className="rv4-stat-value blue">{stats?.totalTokens.toLocaleString() || '0'}</div>}
          </div>
        </div>

        {/* Cost savings highlight */}
        {costSavings && parseFloat(costSavings.savings) > 0 && (
          <div className="rv4-info-banner green" style={{ marginBottom: '14px' }}>
            <span className="rv4-info-banner-icon" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>[SAVED]</span>
            <div className="rv4-info-banner-content">
              <div className="rv4-info-banner-title">COST SAVINGS: ${costSavings.savings}</div>
              <div className="rv4-info-banner-text">{costSavings.savingsPercentage} saved vs. worst case • {costSavings.totalRequests} requests processed</div>
            </div>
          </div>
        )}

        {/* Two column layout */}
        <div className="rv4-cols-2">
          {/* Recent Activity */}
          <div className="rv4-panel">
            <div className="rv4-panel-header">
              <span className="rv4-panel-title">RECENT ACTIVITY</span>
              <a href="/router/analytics" className="rv4-ctrl-btn" style={{ fontSize: '10px', textDecoration: 'none' }}>VIEW ALL →</a>
            </div>
            <div className="rv4-panel-body" style={{ padding: 0 }}>
              {loading ? (
                <div className="rv4-loading" style={{ padding: '24px' }}>
                  <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
                </div>
              ) : recentRequests.length > 0 ? (
                <div className="rv4-activity-list">
                  {recentRequests.map((req) => (
                    <div key={req.id} className="rv4-activity-item">
                      <div className="rv4-activity-status">
                        {req.success
                          ? <span style={{ color: 'var(--phosphor-green)', fontSize: '12px', fontWeight: 'bold' }}>✓</span>
                          : <span style={{ color: 'var(--red-alert)', fontSize: '12px', fontWeight: 'bold' }}>✗</span>}
                      </div>
                      <div className="rv4-activity-model">
                        <div className="rv4-activity-model-name">{req.model}</div>
                        <div className="rv4-activity-meta">{req.provider} • {req.tokensIn + req.tokensOut} tokens • {req.latency}ms</div>
                      </div>
                      <div className="rv4-activity-cost">${req.cost}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rv4-empty" style={{ padding: '32px 16px' }}>
                  <div className="rv4-empty-title">NO ACTIVITY YET</div>
                  <div className="rv4-empty-text">Start making requests to see your activity here</div>
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Provider Breakdown */}
            {overview && overview.providers.length > 0 && (
              <div className="rv4-panel">
                <div className="rv4-panel-header">
                  <span className="rv4-panel-title">PROVIDER USAGE</span>
                </div>
                <div className="rv4-panel-body">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {overview.providers.map((provider) => {
                      const pct = parseFloat(provider.percentage);
                      return (
                        <div key={provider.provider}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase' }}>{provider.provider}</span>
                            <span style={{ fontSize: '10px', color: 'var(--amber-warning)' }}>${provider.totalCost}</span>
                          </div>
                          <div className="rv4-progress">
                            <div className="rv4-progress-fill green" style={{ width: `${pct}%` }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                            <span style={{ fontSize: '9px', color: 'var(--phosphor-dim)' }}>{provider.requests} requests</span>
                            <span style={{ fontSize: '9px', color: 'var(--phosphor-dim)' }}>{provider.percentage}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="rv4-panel">
              <div className="rv4-panel-header">
                <span className="rv4-panel-title">QUICK ACTIONS</span>
              </div>
              <div className="rv4-panel-body">
                <div className="rv4-actions-grid">
                  {[
                    { title: 'API KEYS', desc: 'Manage universal keys', href: '/router/keys' },
                    { title: 'PROVIDERS', desc: 'Connect AI providers', href: '/router/providers' },
                    { title: 'PREFERENCES', desc: 'Configure routing', href: '/router/preferences' },
                    { title: 'ANALYTICS', desc: 'View statistics', href: '/router/analytics' },
                  ].map((a) => (
                    <a key={a.href} href={a.href} className="rv4-action-btn">
                      <div>
                        <div className="rv4-action-btn-title">{a.title}</div>
                        <div className="rv4-action-btn-desc">{a.desc}</div>
                      </div>
                      <span style={{ marginLeft: 'auto', color: 'var(--phosphor-dim)', fontSize: '12px', flexShrink: 0 }}>→</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Smart routing features */}
            <div className="rv4-panel">
              <div className="rv4-panel-header">
                <span className="rv4-panel-title">SMART ROUTING FEATURES</span>
              </div>
              <div className="rv4-panel-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { title: 'LIVE BENCHMARK DATA', desc: 'Real-time performance data from AI Stupid Meter 7-axis testing' },
                    { title: '6 ROUTING STRATEGIES', desc: 'Best Overall, Coding, Reasoning, Creative, Cheapest, or Fastest' },
                    { title: 'COST OPTIMIZATION', desc: 'Save 50-70% by auto-selecting cost-effective models' },
                    { title: 'AUTO FAILOVER', desc: 'Zero downtime with intelligent fallback to alternatives' },
                  ].map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', padding: '8px 0', borderBottom: i < 3 ? '1px solid rgba(192,192,192,0.08)' : 'none' }}>
                      <span style={{ fontSize: '11px', color: 'var(--phosphor-green)', flexShrink: 0, marginTop: '1px' }}>→</span>
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{f.title}</div>
                        <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.4' }}>{f.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rv4-footer">
          Powered by AI Stupid Meter • Real-time model intelligence from 16+ models tested every 4 hours • <a href="/">View Live Rankings</a>
        </div>
      </div>
    </RouterLayout>
  );
}

export default function RouterDashboard() {
  return (
    <Suspense fallback={
      <RouterLayout>
        <div className="rv4-page-header">
          <div className="rv4-page-header-left">
            <div className="rv4-page-title">AI SMART ROUTER<span className="blinking-cursor"></span></div>
          </div>
        </div>
        <div className="rv4-loading" style={{ minHeight: '300px' }}>
          <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
          <span>LOADING</span>
        </div>
      </RouterLayout>
    }>
      <RouterDashboardContent />
    </Suspense>
  );
}
