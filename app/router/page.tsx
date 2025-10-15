'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import RouterLayout from '@/components/RouterLayout';
import DashboardPreview from '@/components/DashboardPreview';
import PixelIcon from '@/components/PixelIcon';

export const dynamic = 'force-dynamic';

import { apiClient } from '@/lib/api-client';
import type { AnalyticsOverview, RecentRequest, CostSavings } from '@/lib/api-client';

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
    // Check if user just completed a subscription
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      setShowSuccessBanner(true);
      // Clean up URL by removing session_id parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.pathname);
      
      // Auto-hide success banner after 10 seconds
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
      
      // Call API route to check subscription server-side
      const response = await fetch('/api/subscription/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: session!.user!.email!
        })
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to check subscription');
      }
      
      const subscriptionStatus = result.data;
      
      if (!subscriptionStatus.hasAccess) {
        // User doesn't have active subscription - show sales overlay
        setShowSalesOverlay(true);
        setHasAccess(false);
        setLoading(false);
        return;
      }
      
      // User has active subscription - proceed to load dashboard
      setHasAccess(true);
      if (session?.user?.id) {
        apiClient.setUserId(session.user.id);
        fetchDashboardData();
      }
    } catch (err) {
      console.error('[Dashboard] Failed to check subscription:', err);
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
      console.error('[Dashboard] Failed to fetch dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Show dashboard preview for non-subscribers
  if (showSalesOverlay && !hasAccess) {
    return (
      <RouterLayout>
        <DashboardPreview />
      </RouterLayout>
    );
  }

  if (loading && !overview) {
    return (
      <RouterLayout>
        <div className="vintage-container">
          <div className="dashboard-loading">
            <div className="terminal-text terminal-text--green" style={{ fontSize: '1.5em', textAlign: 'center' }}>
              LOADING DASHBOARD<span className="vintage-loading"></span>
            </div>
          </div>
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
      <div className="vintage-container">
        {/* Success Banner */}
        {showSuccessBanner && (
          <div className="savings-banner" style={{ marginBottom: '20px' }}>
            <div className="terminal-text">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <PixelIcon name="check" size={32} />
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div className="terminal-text--green" style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                    SUBSCRIPTION ACTIVATED!
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                    Welcome to AI Router Pro • Your 7-day trial has started • Full access unlocked
                  </div>
                </div>
                <button 
                  onClick={() => setShowSuccessBanner(false)} 
                  className="vintage-btn vintage-btn--sm"
                  style={{ fontSize: '0.85em' }}
                >
                  DISMISS
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="error-banner">
            <div className="terminal-text">
              <div className="terminal-text--red" style={{ fontSize: '1em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PixelIcon name="warning" size={18} />
                CONNECTION ERROR
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '8px' }}>
                {error}
              </div>
              <button onClick={fetchDashboardData} className="vintage-btn vintage-btn--danger" style={{ fontSize: '0.85em' }}>
                RETRY
              </button>
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">
              <span className="terminal-text--green">AI ROUTER</span>
              <span className="blinking-cursor"></span>
            </h1>
            <p className="dashboard-subtitle terminal-text--dim">
              Universal API Gateway • Intelligent Model Selection • Cost Optimization
            </p>
          </div>
          <div className="dashboard-status">
            {loading ? (
              <span className="terminal-text--amber">
                <PixelIcon name="hourglass" size={16} style={{ marginRight: '6px' }} />
                LOADING<span className="vintage-loading"></span>
              </span>
            ) : error ? (
              <span className="terminal-text--red">
                <PixelIcon name="warning" size={16} style={{ marginRight: '6px' }} />
                ERROR
              </span>
            ) : (
              <span className="terminal-text--green">
                <span className="status-led status-led--green"></span> ONLINE
              </span>
            )}
          </div>
        </div>

        {/* Key Metrics - Compact Cards */}
        <div className="metrics-grid">
          <MetricCard
            label="Total Requests"
            value={stats?.totalRequests.toLocaleString() || '0'}
            iconName="chart"
            color="green"
            loading={loading}
          />
          <MetricCard
            label="Total Cost"
            value={`$${stats?.totalCost || '0.00'}`}
            iconName="money"
            color="amber"
            loading={loading}
          />
          <MetricCard
            label="Success Rate"
            value={stats?.successRate || '0%'}
            iconName="check"
            color="green"
            loading={loading}
          />
          <MetricCard
            label="Total Tokens"
            value={stats?.totalTokens.toLocaleString() || '0'}
            iconName="numbers"
            color="green"
            loading={loading}
          />
        </div>

        {/* Cost Savings Highlight */}
        {costSavings && parseFloat(costSavings.savings) > 0 && (
          <div className="savings-banner">
            <div className="terminal-text">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <PixelIcon name="diamond" size={32} />
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div className="terminal-text--green" style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                    COST SAVINGS: ${costSavings.savings}
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                    {costSavings.savingsPercentage} saved vs. worst case • {costSavings.totalRequests} requests
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Two Column Layout */}
        <div className="dashboard-columns">
          {/* Left Column - Recent Activity */}
          <div className="dashboard-column">
            <div className="section-card">
              <div className="section-header">
                <span className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PixelIcon name="list" size={20} />
                  RECENT ACTIVITY
                </span>
                <a href="/router/analytics" className="vintage-btn vintage-btn--sm">
                  VIEW ALL →
                </a>
              </div>
              
              {loading ? (
                <div className="activity-loading">
                  <div className="terminal-text--dim">LOADING<span className="vintage-loading"></span></div>
                </div>
              ) : recentRequests.length > 0 ? (
                <div className="activity-list">
                  {recentRequests.map((request) => (
                    <div key={request.id} className="activity-item">
                      <div className="activity-status">
                        {request.success ? (
                          <PixelIcon name="check" size={16} className="terminal-text--green" />
                        ) : (
                          <PixelIcon name="close" size={16} className="terminal-text--red" />
                        )}
                      </div>
                      <div className="activity-details">
                        <div className="activity-model terminal-text--green">
                          {request.model}
                        </div>
                        <div className="activity-meta terminal-text--dim">
                          {request.provider} • {request.tokensIn + request.tokensOut} tokens • ${request.cost} • {request.latency}ms
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="activity-empty">
                  <div className="terminal-text--dim" style={{ textAlign: 'center' }}>
                    No activity yet<br/>
                    Start making requests to see your activity here
                  </div>
                </div>
              )}
            </div>

            {/* Provider Breakdown */}
            {overview && overview.providers.length > 0 && (
              <div className="section-card">
                <div className="section-header">
                  <span className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PixelIcon name="plug" size={20} />
                    PROVIDER USAGE
                  </span>
                </div>
                <div className="provider-list">
                  {overview.providers.map((provider) => (
                    <div key={provider.provider} className="provider-item">
                      <div className="provider-info">
                        <span className="terminal-text--green">{provider.provider.toUpperCase()}</span>
                        <span className="terminal-text--dim">{provider.requests} requests</span>
                      </div>
                      <div className="provider-stats">
                        <span className="terminal-text--amber">${provider.totalCost}</span>
                        <span className="terminal-text--dim">{provider.percentage}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Quick Actions & Info */}
          <div className="dashboard-column">
            <div className="section-card">
              <div className="section-header">
                <span className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PixelIcon name="lightning" size={20} />
                  QUICK ACTIONS
                </span>
              </div>
              <div className="actions-grid">
                <ActionButton
                  title="API Keys"
                  description="Manage universal keys"
                  iconName="key"
                  href="/router/keys"
                />
                <ActionButton
                  title="Providers"
                  description="Connect AI providers"
                  iconName="plug"
                  href="/router/providers"
                />
                <ActionButton
                  title="Preferences"
                  description="Configure routing"
                  iconName="settings"
                  href="/router/preferences"
                />
                <ActionButton
                  title="Analytics"
                  description="View statistics"
                  iconName="analytics"
                  href="/router/analytics"
                />
              </div>
            </div>

            {/* Features */}
            <div className="section-card">
              <div className="section-header">
                <span className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PixelIcon name="sparkles" size={20} />
                  KEY FEATURES
                </span>
              </div>
              <div className="features-list">
                <FeatureItem
                  iconName="target"
                  title="Intelligent Routing"
                  description="Auto-selects best model based on real-time benchmarks"
                />
                <FeatureItem
                  iconName="money"
                  title="Cost Optimization"
                  description="Save 50-70% on AI costs without sacrificing quality"
                />
                <FeatureItem
                  iconName="refresh"
                  title="Automatic Failover"
                  description="Zero downtime with automatic failover"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="dashboard-footer">
          <div className="terminal-text--dim">
            Powered by AI Stupid Meter • Real-time model intelligence • <a href="/" className="footer-link">View Live Rankings</a>
          </div>
        </div>
      </div>
    </RouterLayout>
  );
}

// Compact Metric Card Component
function MetricCard({ 
  label, 
  value, 
  iconName, 
  color,
  loading 
}: { 
  label: string; 
  value: string; 
  iconName: string; 
  color: 'green' | 'amber' | 'red';
  loading?: boolean;
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
        {loading ? (
          <div className="metric-value terminal-text--dim">
            <span className="vintage-loading"></span>
          </div>
        ) : (
          <div className={`metric-value ${colorClass}`}>{value}</div>
        )}
      </div>
    </div>
  );
}

// Action Button Component
function ActionButton({ 
  title, 
  description, 
  iconName, 
  href 
}: { 
  title: string; 
  description: string; 
  iconName: string; 
  href: string;
}) {
  return (
    <a href={href} className="action-button">
      <div className="action-icon">
        <PixelIcon name={iconName} size={24} />
      </div>
      <div className="action-content">
        <div className="action-title terminal-text--green">{title}</div>
        <div className="action-description terminal-text--dim">{description}</div>
      </div>
    </a>
  );
}

// Feature Item Component
function FeatureItem({ 
  iconName, 
  title, 
  description 
}: { 
  iconName: string; 
  title: string; 
  description: string;
}) {
  return (
    <div className="feature-item">
      <div className="feature-icon">
        <PixelIcon name={iconName} size={24} />
      </div>
      <div className="feature-content">
        <div className="feature-title terminal-text--green">{title}</div>
        <div className="feature-description terminal-text--dim">{description}</div>
      </div>
    </div>
  );
}

// Wrapper component with Suspense boundary
export default function RouterDashboard() {
  return (
    <Suspense fallback={
      <RouterLayout>
        <div className="vintage-container">
          <div className="dashboard-loading">
            <div className="terminal-text terminal-text--green" style={{ fontSize: '1.5em', textAlign: 'center' }}>
              LOADING DASHBOARD<span className="vintage-loading"></span>
            </div>
          </div>
        </div>
      </RouterLayout>
    }>
      <RouterDashboardContent />
    </Suspense>
  );
}
