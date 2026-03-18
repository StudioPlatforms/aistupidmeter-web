'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import RouterLayout from '@/components/RouterLayout';

interface SubscriptionData {
  hasAccess: boolean;
  isTrialing: boolean;
  trialEndsAt: string | null;
  subscriptionId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface UsageData {
  apiCalls: { used: number; limit: number | null };
  apiKeys: { used: number; limit: number | null };
  dataRetention: string;
  analyticsHistory: string;
}

export default function SubscriptionPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchSubscriptionData();
    }
  }, [status, router]);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/subscription/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session!.user!.email! })
      });
      const result = await response.json();
      if (result.success) {
        setSubscription(result.data);
        const [overviewRes, keysRes] = await Promise.all([
          fetch('/api/router/analytics/overview').catch(() => null),
          fetch('/api/router/keys').catch(() => null)
        ]);
        const overview = overviewRes?.ok ? await overviewRes.json() : null;
        const keysData = keysRes?.ok ? await keysRes.json() : null;
        const totalRequests = overview?.overview?.totalRequests || 0;
        const activeKeysCount = keysData?.keys?.filter((k: any) => !k.revoked).length || 0;
        setUsage({
          apiCalls: { used: totalRequests, limit: result.data.hasAccess ? null : 100 },
          apiKeys: { used: activeKeysCount, limit: result.data.hasAccess ? null : 1 },
          dataRetention: result.data.hasAccess ? '90 days' : '7 days',
          analyticsHistory: result.data.hasAccess ? 'Unlimited' : '7 days',
        });
      }
    } catch {
      setUsage({ apiCalls: { used: 0, limit: 100 }, apiKeys: { used: 0, limit: 1 }, dataRetention: '7 days', analyticsHistory: '7 days' });
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setProcessingAction(true);
    window.location.href = '/api/stripe/portal';
  };

  const handleUpgrade = () => {
    window.location.href = '/api/stripe/checkout';
  };

  if (status === 'loading' || loading) {
    return (
      <RouterLayout>
        <div className="rv4-loading" style={{ minHeight: '300px' }}>
          <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
          <span>LOADING SUBSCRIPTION</span>
        </div>
      </RouterLayout>
    );
  }

  if (!session?.user || !subscription) return null;

  const isPro = subscription.hasAccess;
  const isTrial = subscription.isTrialing;
  const isFree = !isPro;

  const getStatusBadge = () => {
    if (isTrial) return { text: 'PRO TRIAL', color: 'var(--amber-warning)', bg: 'rgba(255,176,0,0.1)', border: 'rgba(255,176,0,0.4)' };
    if (isPro) return { text: 'PRO ACTIVE', color: 'var(--phosphor-green)', bg: 'rgba(0,255,65,0.1)', border: 'rgba(0,255,65,0.4)' };
    return { text: 'FREE PLAN', color: 'var(--phosphor-dim)', bg: 'rgba(128,128,128,0.1)', border: 'rgba(128,128,128,0.3)' };
  };

  const badge = getStatusBadge();

  const getUsagePct = (used: number, limit: number | null) => limit === null ? 0 : Math.min((used / limit) * 100, 100);
  const getUsageColor = (pct: number) => pct >= 90 ? 'var(--red-alert)' : pct >= 70 ? 'var(--amber-warning)' : 'var(--phosphor-green)';

  return (
    <RouterLayout>
      {/* Page header */}
      <div className="rv4-page-header">
        <div className="rv4-page-header-left">
          <div>
            <div className="rv4-page-title">SUBSCRIPTION<span className="blinking-cursor"></span></div>
            <div className="rv4-page-title-sub">Manage your subscription and billing settings</div>
          </div>
        </div>
        <div className="rv4-page-header-right">
          <span className="rv4-badge" style={{ background: badge.bg, borderColor: badge.border, color: badge.color }}>
            {badge.text}
          </span>
        </div>
      </div>

      <div className="rv4-body">
        {/* Current Plan */}
        <div className="rv4-panel" style={{ marginBottom: '14px' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">CURRENT PLAN</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--phosphor-green)' }}>
              ${isPro ? '4.99' : '0.00'}<span style={{ fontSize: '11px', color: 'var(--phosphor-dim)', fontWeight: 'normal' }}>/month</span>
            </span>
          </div>
          <div className="rv4-panel-body">
            <div className="rv4-sub-status">
              <div>
                <div className="rv4-sub-badge" style={{ borderColor: badge.border, color: badge.color, background: badge.bg }}>
                  {badge.text}
                </div>
              </div>
            </div>

            {isTrial && subscription.trialEndsAt && (
              <div className="rv4-info-banner amber" style={{ marginBottom: '14px' }}>
                <span className="rv4-info-banner-icon" style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>[!]</span>
                <div className="rv4-info-banner-content">
                  <div className="rv4-info-banner-title">TRIAL PERIOD ACTIVE</div>
                  <div className="rv4-info-banner-text">
                    Your free trial ends on {new Date(subscription.trialEndsAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              </div>
            )}

            {isPro && subscription.currentPeriodEnd && (
              <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(192,192,192,0.15)', borderRadius: '3px', marginBottom: '14px' }}>
                <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Next Billing Date</div>
                <div style={{ fontSize: '12px', color: 'var(--phosphor-green)', fontWeight: 'bold' }}>
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                {subscription.cancelAtPeriodEnd && (
                  <div style={{ fontSize: '10px', color: 'var(--red-alert)', marginTop: '4px' }}>
                    ⚠ Subscription will cancel at period end
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {isFree ? (
                <button onClick={handleUpgrade} className="rv4-ctrl-btn primary" style={{ flex: '1 1 auto' }}>
                  UPGRADE TO PRO →
                </button>
              ) : (
                <button onClick={handleManageBilling} disabled={processingAction} className="rv4-ctrl-btn" style={{ flex: '1 1 auto' }}>
                  {processingAction ? 'LOADING...' : 'MANAGE BILLING'}
                </button>
              )}
              <button onClick={() => router.push('/router/profile')} className="rv4-ctrl-btn" style={{ flex: '1 1 auto' }}>
                VIEW PROFILE
              </button>
            </div>
          </div>
        </div>

        {/* Usage */}
        {usage && (
          <div className="rv4-panel" style={{ marginBottom: '14px' }}>
            <div className="rv4-panel-header">
              <span className="rv4-panel-title">USAGE AND LIMITS</span>
            </div>
            <div className="rv4-panel-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {/* API Calls */}
                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(192,192,192,0.15)', borderRadius: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)' }}>API CALLS</span>
                    <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>{usage.apiCalls.used.toLocaleString()} / {usage.apiCalls.limit ? usage.apiCalls.limit.toLocaleString() : '∞'}</span>
                  </div>
                  {usage.apiCalls.limit ? (
                    <div className="rv4-progress">
                      <div className="rv4-progress-fill" style={{ width: `${getUsagePct(usage.apiCalls.used, usage.apiCalls.limit)}%`, background: getUsageColor(getUsagePct(usage.apiCalls.used, usage.apiCalls.limit)), height: '100%', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                    </div>
                  ) : (
                    <div style={{ fontSize: '10px', color: 'var(--phosphor-green)' }}>✓ Unlimited</div>
                  )}
                </div>

                {/* API Keys */}
                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(192,192,192,0.15)', borderRadius: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)' }}>API KEYS</span>
                    <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>{usage.apiKeys.used} / {usage.apiKeys.limit || '∞'}</span>
                  </div>
                  {usage.apiKeys.limit ? (
                    <div className="rv4-progress">
                      <div className="rv4-progress-fill" style={{ width: `${getUsagePct(usage.apiKeys.used, usage.apiKeys.limit)}%`, background: getUsageColor(getUsagePct(usage.apiKeys.used, usage.apiKeys.limit)), height: '100%', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                    </div>
                  ) : (
                    <div style={{ fontSize: '10px', color: 'var(--phosphor-green)' }}>✓ Unlimited</div>
                  )}
                </div>

                {/* Data Retention */}
                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(192,192,192,0.15)', borderRadius: '3px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '6px' }}>DATA RETENTION</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--phosphor-green)' }}>{usage.dataRetention}</div>
                </div>

                {/* Analytics History */}
                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(192,192,192,0.15)', borderRadius: '3px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '6px' }}>ANALYTICS HISTORY</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--phosphor-green)' }}>{usage.analyticsHistory}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Plan comparison */}
        <div className="rv4-panel" style={{ marginBottom: '14px' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">PLAN COMPARISON</span>
          </div>
          <div className="rv4-panel-body" style={{ padding: 0 }}>
            <div className="rv4-table-wrapper">
              <table className="rv4-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th style={{ textAlign: 'center' }}>FREE</th>
                    <th style={{ textAlign: 'center', color: 'var(--phosphor-green)' }}>PRO</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: 'AI Router Access', free: false, pro: true },
                    { feature: 'Universal API Keys', free: false, pro: 'Unlimited' },
                    { feature: 'Provider Key Management', free: false, pro: true },
                    { feature: 'API Calls', free: false, pro: 'Unlimited' },
                    { feature: 'Analytics and Insights', free: false, pro: true },
                    { feature: 'Cost Tracking', free: false, pro: true },
                    { feature: 'Model Intelligence', free: false, pro: true },
                    { feature: 'Custom Preferences', free: false, pro: true },
                    { feature: 'Automatic Failover', free: false, pro: true },
                    { feature: 'Priority Support', free: false, pro: true },
                  ].map((row, i) => (
                    <tr key={i}>
                      <td className="td-dim">{row.feature}</td>
                      <td style={{ textAlign: 'center' }}>
                        {typeof row.free === 'boolean'
                          ? <span style={{ color: row.free ? 'var(--phosphor-green)' : 'var(--red-alert)', fontWeight: 'bold' }}>{row.free ? '✓' : '✗'}</span>
                          : <span className="td-dim">{row.free}</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {typeof row.pro === 'boolean'
                          ? <span style={{ color: row.pro ? 'var(--phosphor-green)' : 'var(--red-alert)', fontWeight: 'bold' }}>{row.pro ? '✓' : '✗'}</span>
                          : <span style={{ color: 'var(--phosphor-green)', fontWeight: 'bold', fontSize: '11px' }}>{row.pro}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {isFree && (
          <div style={{
            background: 'rgba(255,176,0,0.06)', border: '2px solid var(--amber-warning)',
            borderRadius: '3px', padding: '20px', textAlign: 'center', marginBottom: '16px',
          }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--amber-warning)', marginBottom: '4px' }}>$4.99/month</div>
            <div style={{ fontSize: '11px', color: 'var(--phosphor-green)', fontWeight: 'bold', marginBottom: '14px' }}>
              7-Day Free Trial • No Credit Card • Cancel Anytime
            </div>
            <button onClick={handleUpgrade} className="rv4-upgrade-cta">
              UPGRADE TO PRO — START FREE TRIAL →
            </button>
          </div>
        )}
      </div>
    </RouterLayout>
  );
}
