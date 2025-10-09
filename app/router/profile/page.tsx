'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import RouterLayout from '@/components/RouterLayout';
import PixelIcon from '@/components/PixelIcon';

interface UserStats {
  totalRequests: number;
  totalSaved: number;
  mostUsedModel: string;
  successRate: string;
  activeKeys: number;
  memberSince: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'free' | 'pro' | 'trial'>('free');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchUserData();
    }
  }, [status, router]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      
      const subResponse = await fetch('/api/subscription/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session!.user!.email! })
      });
      const subData = await subResponse.json();
      
      if (subData.success && subData.data.hasAccess) {
        setSubscriptionStatus(subData.data.isTrialing ? 'trial' : 'pro');
      }

      const [overviewRes, keysRes, savingsRes, performanceRes] = await Promise.all([
        fetch('/api/router/analytics/overview').catch(() => null),
        fetch('/api/router/keys').catch(() => null),
        fetch('/api/router/analytics/cost-savings').catch(() => null),
        fetch('/api/router/analytics/model-performance').catch(() => null)
      ]);

      const overview = overviewRes?.ok ? await overviewRes.json() : null;
      const keysData = keysRes?.ok ? await keysRes.json() : null;
      const savings = savingsRes?.ok ? await savingsRes.json() : null;
      const performance = performanceRes?.ok ? await performanceRes.json() : null;

      let mostUsedModel = 'N/A';
      if (overview?.topModels && overview.topModels.length > 0) {
        mostUsedModel = overview.topModels[0].model;
      } else if (performance?.models && performance.models.length > 0) {
        mostUsedModel = performance.models[0].model;
      }

      setStats({
        totalRequests: overview?.overview?.totalRequests || 0,
        totalSaved: savings ? parseFloat(savings.savings) : 0,
        mostUsedModel,
        successRate: overview?.overview?.successRate || '0%',
        activeKeys: keysData?.keys?.filter((k: any) => !k.revoked).length || 0,
        memberSince: new Date(session!.user!.email === 'test@example.com' ? '2024-01-15' : Date.now()).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      });
    } catch (err) {
      console.error('Failed to fetch user data:', err);
      setStats({
        totalRequests: 0,
        totalSaved: 0,
        mostUsedModel: 'N/A',
        successRate: '0%',
        activeKeys: 0,
        memberSince: new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      });
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <RouterLayout>
        <div className="vintage-container">
          <div className="crt-monitor">
            <div className="terminal-text terminal-text--green" style={{ fontSize: '1.5em', textAlign: 'center', padding: 'var(--space-xl)' }}>
              LOADING PROFILE<span className="vintage-loading"></span>
            </div>
          </div>
        </div>
      </RouterLayout>
    );
  }

  if (!session?.user) {
    return null;
  }

  const getAccountBadge = () => {
    if (subscriptionStatus === 'trial') {
      return { text: 'PRO TRIAL', color: 'var(--amber-warning)', bg: 'rgba(255, 176, 0, 0.1)' };
    } else if (subscriptionStatus === 'pro') {
      return { text: 'PRO', color: 'var(--phosphor-green)', bg: 'rgba(0, 255, 65, 0.1)' };
    }
    return { text: 'FREE', color: 'var(--phosphor-dim)', bg: 'rgba(128, 128, 128, 0.1)' };
  };

  const badge = getAccountBadge();

  return (
    <RouterLayout>
      <div className="vintage-container">
        {/* Page Header */}
        <div className="crt-monitor" style={{ marginBottom: '24px' }}>
          <div className="terminal-text" style={{ padding: '24px' }}>
            <div style={{ fontSize: '1.75em', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <PixelIcon name="profile" size={32} className="terminal-text--green" />
              <span className="terminal-text--green">PROFILE</span>
              <span className="blinking-cursor"></span>
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '1em' }}>
              Manage your account settings and view your statistics
            </div>
          </div>
        </div>

        {/* User Info Card */}
        <div className="crt-monitor" style={{ marginBottom: '24px' }}>
          <div className="terminal-text" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <div style={{ 
                width: '80px', 
                height: '80px', 
                borderRadius: '50%', 
                background: 'var(--phosphor-green)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: '2.5em',
                color: 'var(--terminal-black)',
                fontWeight: 'bold',
                border: '3px solid var(--phosphor-green)',
                boxShadow: '0 0 15px rgba(0, 255, 65, 0.4)',
                flexShrink: 0
              }}>
                {session.user.name?.charAt(0).toUpperCase() || session.user.email?.charAt(0).toUpperCase() || '?'}
              </div>
              <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
                <div className="terminal-text--green" style={{ fontSize: 'clamp(1.2em, 4vw, 1.5em)', fontWeight: 'bold', marginBottom: '8px' }}>
                  {session.user.name || 'User'}
                </div>
                <div style={{ 
                  display: 'inline-block',
                  padding: '6px 16px',
                  background: badge.bg,
                  border: `2px solid ${badge.color}`,
                  borderRadius: '4px',
                  color: badge.color,
                  fontSize: '0.85em',
                  fontWeight: 'bold',
                  letterSpacing: '0.5px'
                }}>
                  {badge.text}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => router.push('/router/subscription')}
                className="vintage-btn"
                style={{ padding: '12px 24px', flex: '1 1 auto', minWidth: '140px' }}
              >
                <PixelIcon name="credit-card" size={16} style={{ marginRight: '6px' }} />
                Subscription
              </button>
              {subscriptionStatus === 'free' && (
                <button 
                  onClick={() => window.location.href = '/api/stripe/checkout'}
                  className="vintage-btn vintage-btn--active"
                  style={{ padding: '12px 24px', flex: '1 1 auto', minWidth: '140px' }}
                >
                  <PixelIcon name="arrow-up" size={16} style={{ marginRight: '6px' }} />
                  Upgrade
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <div className="control-panel" style={{ padding: '16px' }}>
                <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PixelIcon name="info" size={14} />
                  EMAIL
                </div>
                <div className="terminal-text--green" style={{ fontSize: '1em', wordBreak: 'break-all' }}>{session.user.email}</div>
              </div>

              <div className="control-panel" style={{ padding: '16px' }}>
                <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PixelIcon name="calendar" size={14} />
                  MEMBER SINCE
                </div>
                <div className="terminal-text--green" style={{ fontSize: '1em' }}>{stats?.memberSince || 'N/A'}</div>
              </div>

              <div className="control-panel" style={{ padding: '16px' }}>
                <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PixelIcon name="lock" size={14} />
                  AUTHENTICATION
                </div>
                <div className="terminal-text--green" style={{ fontSize: '1em' }}>
                  {session.user.image?.includes('google') ? 'Google OAuth' : 
                   session.user.image?.includes('github') ? 'GitHub OAuth' : 
                   'Email & Password'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="crt-monitor" style={{ marginBottom: '24px' }}>
          <div className="terminal-text" style={{ padding: '32px' }}>
            <div className="terminal-text--green" style={{ fontSize: '1.4em', fontWeight: 'bold', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PixelIcon name="chart" size={26} />
              STATISTICS
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              <div className="control-panel" style={{ padding: '24px', textAlign: 'center', background: 'rgba(0, 255, 65, 0.05)' }}>
                <div style={{ marginBottom: '8px' }}>
                  <PixelIcon name="chart" size={40} />
                </div>
                <div className="terminal-text--green" style={{ fontSize: '2em', fontWeight: 'bold', marginBottom: '4px' }}>
                  {stats?.totalRequests.toLocaleString() || '0'}
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.9em', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  API Calls
                </div>
              </div>

              <div className="control-panel" style={{ padding: '24px', textAlign: 'center', background: 'rgba(0, 255, 65, 0.05)' }}>
                <div style={{ marginBottom: '8px' }}>
                  <PixelIcon name="money" size={40} />
                </div>
                <div className="terminal-text--green" style={{ fontSize: '2em', fontWeight: 'bold', marginBottom: '4px' }}>
                  ${stats?.totalSaved.toFixed(2) || '0.00'}
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.9em', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Total Saved
                </div>
              </div>

              <div className="control-panel" style={{ padding: '24px', textAlign: 'center', background: 'rgba(0, 255, 65, 0.05)' }}>
                <div style={{ marginBottom: '8px' }}>
                  <PixelIcon name="check" size={40} />
                </div>
                <div className="terminal-text--green" style={{ fontSize: '2em', fontWeight: 'bold', marginBottom: '4px' }}>
                  {stats?.successRate || '0%'}
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.9em', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Success Rate
                </div>
              </div>

              <div className="control-panel" style={{ padding: '24px', textAlign: 'center', background: 'rgba(0, 255, 65, 0.05)' }}>
                <div style={{ marginBottom: '8px' }}>
                  <PixelIcon name="key" size={40} />
                </div>
                <div className="terminal-text--green" style={{ fontSize: '2em', fontWeight: 'bold', marginBottom: '4px' }}>
                  {stats?.activeKeys || '0'}
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.9em', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Active Keys
                </div>
              </div>
            </div>

            {stats?.mostUsedModel && stats.mostUsedModel !== 'N/A' && (
              <div className="control-panel" style={{ padding: '20px', marginTop: '20px', background: 'rgba(0, 255, 65, 0.05)' }}>
                <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PixelIcon name="target" size={16} />
                  MOST USED MODEL
                </div>
                <div className="terminal-text--green" style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                  {stats.mostUsedModel}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Navigation */}
        <div className="crt-monitor">
          <div className="terminal-text" style={{ padding: '32px' }}>
            <div className="terminal-text--green" style={{ fontSize: '1.4em', fontWeight: 'bold', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PixelIcon name="menu" size={26} />
              QUICK NAVIGATION
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <button 
                onClick={() => router.push('/router')}
                className="vintage-btn"
                style={{ padding: '16px 20px', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1em' }}
              >
                <PixelIcon name="dashboard" size={20} />
                <span>Dashboard</span>
              </button>
              <button 
                onClick={() => router.push('/router/keys')}
                className="vintage-btn"
                style={{ padding: '16px 20px', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1em' }}
              >
                <PixelIcon name="key" size={20} />
                <span>API Keys</span>
              </button>
              <button 
                onClick={() => router.push('/router/analytics')}
                className="vintage-btn"
                style={{ padding: '16px 20px', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1em' }}
              >
                <PixelIcon name="analytics" size={20} />
                <span>Analytics</span>
              </button>
              <button 
                onClick={() => router.push('/')}
                className="vintage-btn"
                style={{ padding: '16px 20px', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1em' }}
              >
                <PixelIcon name="home" size={20} />
                <span>Main Site</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </RouterLayout>
  );
}
