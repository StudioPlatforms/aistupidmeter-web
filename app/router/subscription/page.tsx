'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import RouterLayout from '@/components/RouterLayout';
import PixelIcon from '@/components/PixelIcon';

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
          apiCalls: { 
            used: totalRequests, 
            limit: result.data.hasAccess ? null : 100 
          },
          apiKeys: { 
            used: activeKeysCount, 
            limit: result.data.hasAccess ? null : 1 
          },
          dataRetention: result.data.hasAccess ? '90 days' : '7 days',
          analyticsHistory: result.data.hasAccess ? 'Unlimited' : '7 days'
        });
      }
    } catch (err) {
      console.error('Failed to fetch subscription data:', err);
      setUsage({
        apiCalls: { used: 0, limit: 100 },
        apiKeys: { used: 0, limit: 1 },
        dataRetention: '7 days',
        analyticsHistory: '7 days'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setProcessingAction(true);
    try {
      window.location.href = '/api/stripe/portal';
    } catch (err) {
      console.error('Failed to open billing portal:', err);
      setProcessingAction(false);
    }
  };

  const handleUpgrade = () => {
    window.location.href = '/api/stripe/checkout';
  };

  if (status === 'loading' || loading) {
    return (
      <RouterLayout>
        <div className="vintage-container">
          <div className="crt-monitor">
            <div className="terminal-text terminal-text--green" style={{ fontSize: '1.5em', textAlign: 'center', padding: 'var(--space-xl)' }}>
              LOADING SUBSCRIPTION<span className="vintage-loading"></span>
            </div>
          </div>
        </div>
      </RouterLayout>
    );
  }

  if (!session?.user || !subscription) {
    return null;
  }

  const isPro = subscription.hasAccess;
  const isTrial = subscription.isTrialing;
  const isFree = !isPro;

  const getStatusBadge = () => {
    if (isTrial) {
      return { text: 'PRO TRIAL', color: 'var(--amber-warning)', bg: 'rgba(255, 176, 0, 0.1)' };
    } else if (isPro) {
      return { text: 'PRO ACTIVE', color: 'var(--phosphor-green)', bg: 'rgba(0, 255, 65, 0.1)' };
    }
    return { text: 'FREE PLAN', color: 'var(--phosphor-dim)', bg: 'rgba(128, 128, 128, 0.1)' };
  };

  const badge = getStatusBadge();

  const getUsagePercentage = (used: number, limit: number | null) => {
    if (limit === null) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'var(--red-alert)';
    if (percentage >= 70) return 'var(--amber-warning)';
    return 'var(--phosphor-green)';
  };

  return (
    <RouterLayout>
      <div className="vintage-container">
        {/* Header */}
        <div className="crt-monitor" style={{ marginBottom: '24px' }}>
          <div className="terminal-text" style={{ padding: 'clamp(16px, 4vw, 24px)' }}>
            <div style={{ fontSize: 'clamp(1.3em, 4vw, 1.75em)', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <PixelIcon name="credit-card" size={28} className="terminal-text--green" />
              <span className="terminal-text--green">SUBSCRIPTION</span>
              <span className="blinking-cursor"></span>
            </div>
            <div className="terminal-text--dim" style={{ fontSize: 'clamp(0.85em, 2.5vw, 1em)' }}>
              Manage your subscription and billing settings
            </div>
          </div>
        </div>

        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Current Plan Overview */}
          <div className="crt-monitor" style={{ marginBottom: '24px' }}>
            <div className="terminal-text" style={{ padding: 'clamp(20px, 5vw, 32px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <div className="terminal-text--green" style={{ fontSize: 'clamp(1.1em, 3vw, 1.2em)', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PixelIcon name="star" size={20} />
                    CURRENT PLAN
                  </div>
                  <div style={{ 
                    display: 'inline-block',
                    padding: '6px 14px',
                    background: badge.bg,
                    border: `2px solid ${badge.color}`,
                    borderRadius: '4px',
                    color: badge.color,
                    fontSize: '1em',
                    fontWeight: 'bold'
                  }}>
                    {badge.text}
                  </div>
                </div>
                
                <div style={{ textAlign: 'right', flex: '0 1 auto' }}>
                  <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginBottom: '4px' }}>
                    {isPro ? 'Monthly Price' : 'Current Cost'}
                  </div>
                  <div className="terminal-text--green" style={{ fontSize: 'clamp(1.5em, 5vw, 2em)', fontWeight: 'bold' }}>
                    ${isPro ? '19.99' : '0.00'}
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                    per month
                  </div>
                </div>
              </div>

              {isTrial && subscription.trialEndsAt && (
                <div style={{ 
                  padding: '12px', 
                  background: 'rgba(255, 176, 0, 0.1)', 
                  border: '1px solid var(--amber-warning)',
                  borderRadius: '4px',
                  marginBottom: '16px'
                }}>
                  <div className="terminal-text--amber" style={{ fontSize: '0.9em', fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <PixelIcon name="clock" size={16} />
                    Trial Period Active
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                    Your free trial ends on {new Date(subscription.trialEndsAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </div>
                </div>
              )}

              {isPro && subscription.currentPeriodEnd && (
                <div className="control-panel" style={{ padding: '12px', marginBottom: '16px' }}>
                  <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <PixelIcon name="calendar" size={14} />
                    Next Billing Date
                  </div>
                  <div className="terminal-text--green" style={{ fontSize: '0.95em' }}>
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </div>
                  {subscription.cancelAtPeriodEnd && (
                    <div className="terminal-text--red" style={{ fontSize: '0.8em', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <PixelIcon name="warning" size={14} />
                      Subscription will cancel at period end
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {isFree ? (
                  <button 
                    onClick={handleUpgrade}
                    className="vintage-btn vintage-btn--active"
                    style={{ flex: '1 1 auto', minWidth: '140px', justifyContent: 'center', padding: '12px 20px' }}
                  >
                    <PixelIcon name="arrow-up" size={16} style={{ marginRight: '6px' }} />
                    Upgrade to PRO
                  </button>
                ) : (
                  <button 
                    onClick={handleManageBilling}
                    disabled={processingAction}
                    className="vintage-btn"
                    style={{ flex: '1 1 auto', minWidth: '140px', justifyContent: 'center', padding: '12px 20px' }}
                  >
                    {processingAction ? (
                      <>LOADING<span className="vintage-loading"></span></>
                    ) : (
                      <>
                        <PixelIcon name="settings" size={16} style={{ marginRight: '6px' }} />
                        Manage Billing
                      </>
                    )}
                  </button>
                )}
                <button 
                  onClick={() => router.push('/router/profile')}
                  className="vintage-btn"
                  style={{ flex: '1 1 auto', minWidth: '140px', justifyContent: 'center', padding: '12px 20px' }}
                >
                  <PixelIcon name="profile" size={16} style={{ marginRight: '6px' }} />
                  View Profile
                </button>
              </div>
            </div>
          </div>

          {/* Usage & Limits */}
          {usage && (
            <div className="crt-monitor" style={{ marginBottom: '24px' }}>
              <div className="terminal-text" style={{ padding: 'clamp(20px, 5vw, 32px)' }}>
                <div className="terminal-text--green" style={{ fontSize: 'clamp(1.1em, 3vw, 1.2em)', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PixelIcon name="chart" size={22} />
                  USAGE & LIMITS
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {/* API Calls */}
                  <div className="control-panel" style={{ padding: '12px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <PixelIcon name="analytics" size={16} />
                        API Calls
                      </div>
                      <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                        {usage.apiCalls.used.toLocaleString()} / {usage.apiCalls.limit ? usage.apiCalls.limit.toLocaleString() : '∞'}
                      </div>
                    </div>
                    {usage.apiCalls.limit && (
                      <div style={{ width: '100%', height: '6px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${getUsagePercentage(usage.apiCalls.used, usage.apiCalls.limit)}%`, 
                          height: '100%', 
                          background: getUsageColor(getUsagePercentage(usage.apiCalls.used, usage.apiCalls.limit)),
                          borderRadius: '3px',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    )}
                    {!usage.apiCalls.limit && (
                      <div className="terminal-text--green" style={{ fontSize: '0.8em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <PixelIcon name="sparkles" size={14} />
                        Unlimited
                      </div>
                    )}
                  </div>

                  {/* API Keys */}
                  <div className="control-panel" style={{ padding: '12px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <PixelIcon name="key" size={16} />
                        API Keys
                      </div>
                      <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                        {usage.apiKeys.used} / {usage.apiKeys.limit || '∞'}
                      </div>
                    </div>
                    {usage.apiKeys.limit && (
                      <div style={{ width: '100%', height: '6px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${getUsagePercentage(usage.apiKeys.used, usage.apiKeys.limit)}%`, 
                          height: '100%', 
                          background: getUsageColor(getUsagePercentage(usage.apiKeys.used, usage.apiKeys.limit)),
                          borderRadius: '3px',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    )}
                    {!usage.apiKeys.limit && (
                      <div className="terminal-text--green" style={{ fontSize: '0.8em' }}>
                        ✨ Unlimited
                      </div>
                    )}
                  </div>

                  {/* Data Retention */}
                  <div className="control-panel" style={{ padding: '12px', overflow: 'hidden' }}>
                    <div className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <PixelIcon name="shield" size={16} />
                      Data Retention
                    </div>
                    <div className="terminal-text" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
                      {usage.dataRetention}
                    </div>
                  </div>

                  {/* Analytics History */}
                  <div className="control-panel" style={{ padding: '12px', overflow: 'hidden' }}>
                    <div className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <PixelIcon name="analytics" size={16} />
                      Analytics History
                    </div>
                    <div className="terminal-text" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
                      {usage.analyticsHistory}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feature Comparison */}
          <div className="crt-monitor">
            <div className="terminal-text" style={{ padding: 'clamp(20px, 5vw, 32px)' }}>
              <div className="terminal-text--green" style={{ fontSize: 'clamp(1.1em, 3vw, 1.2em)', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <PixelIcon name="target" size={22} />
                PLAN COMPARISON
              </div>

              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '100%' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(0, 255, 65, 0.3)' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>
                        <span className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold' }}>Feature</span>
                      </th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>
                        <span className="terminal-text--dim" style={{ fontSize: '0.9em', fontWeight: 'bold' }}>FREE</span>
                      </th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>
                        <span className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold' }}>PRO</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { feature: 'AI Router Access', free: false, pro: true },
                      { feature: 'Universal API Keys', free: false, pro: 'Unlimited' },
                      { feature: 'Provider Keys Management', free: false, pro: true },
                      { feature: 'API Calls', free: false, pro: 'Unlimited' },
                      { feature: 'Analytics & Insights', free: false, pro: true },
                      { feature: 'Cost Tracking', free: false, pro: true },
                      { feature: 'Model Intelligence', free: false, pro: true },
                      { feature: 'Custom Preferences', free: false, pro: true },
                      { feature: 'Automatic Failover', free: false, pro: true },
                      { feature: 'Priority Support', free: false, pro: true }
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(0, 255, 65, 0.1)' }}>
                        <td style={{ padding: '8px 10px' }}>
                          <span className="terminal-text--dim" style={{ fontSize: '0.85em' }}>{row.feature}</span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          {typeof row.free === 'boolean' ? (
                            <PixelIcon name={row.free ? 'check' : 'close'} size={14} className={row.free ? 'terminal-text--green' : 'terminal-text--red'} />
                          ) : (
                            <span className="terminal-text--dim" style={{ fontSize: '0.8em' }}>{row.free}</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          {typeof row.pro === 'boolean' ? (
                            <PixelIcon name={row.pro ? 'check' : 'close'} size={14} className={row.pro ? 'terminal-text--green' : 'terminal-text--red'} />
                          ) : (
                            <span className="terminal-text--green" style={{ fontSize: '0.8em', fontWeight: 'bold' }}>{row.pro}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {isFree && (
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  <button 
                    onClick={handleUpgrade}
                    className="vintage-btn vintage-btn--active"
                    style={{ fontSize: 'clamp(0.95em, 2.5vw, 1.1em)', padding: '14px 28px', width: '100%', maxWidth: '400px' }}
                  >
                    <PixelIcon name="arrow-up" size={18} style={{ marginRight: '8px' }} />
                    Upgrade to PRO - $19.99/month
                  </button>
                  <div className="terminal-text--dim" style={{ marginTop: '12px', fontSize: '0.8em' }}>
                    7-Day Free Trial • Cancel Anytime
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RouterLayout>
  );
}
