'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import RouterLayout from '@/components/RouterLayout';

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
        memberSince: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      });
    } catch {
      setStats({ totalRequests: 0, totalSaved: 0, mostUsedModel: 'N/A', successRate: '0%', activeKeys: 0, memberSince: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) });
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <RouterLayout>
        <div className="rv4-loading" style={{ minHeight: '300px' }}>
          <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
          <span>LOADING PROFILE</span>
        </div>
      </RouterLayout>
    );
  }

  if (!session?.user) return null;

  const displayName = session.user.name || session.user.email || 'User';
  const nameInitial = displayName.charAt(0).toUpperCase();

  const getBadge = () => {
    if (subscriptionStatus === 'trial') return { text: 'PRO TRIAL', color: 'var(--amber-warning)', border: 'rgba(255,176,0,0.4)', bg: 'rgba(255,176,0,0.1)' };
    if (subscriptionStatus === 'pro') return { text: 'PRO', color: 'var(--phosphor-green)', border: 'rgba(0,255,65,0.4)', bg: 'rgba(0,255,65,0.1)' };
    return { text: 'FREE', color: 'var(--phosphor-dim)', border: 'rgba(128,128,128,0.3)', bg: 'rgba(128,128,128,0.08)' };
  };

  const badge = getBadge();

  return (
    <RouterLayout>
      {/* Page header */}
      <div className="rv4-page-header">
        <div className="rv4-page-header-left">
          <div>
            <div className="rv4-page-title">PROFILE<span className="blinking-cursor"></span></div>
            <div className="rv4-page-title-sub">Manage your account settings and view your statistics</div>
          </div>
        </div>
      </div>

      <div className="rv4-body">
        {/* User info card */}
        <div className="rv4-panel" style={{ marginBottom: '14px' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">ACCOUNT</span>
            <div className="rv4-sub-badge" style={{ borderColor: badge.border, color: badge.color, background: badge.bg, padding: '3px 10px', border: `1px solid ${badge.border}`, borderRadius: '2px', fontSize: '10px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>
              {badge.text}
            </div>
          </div>
          <div className="rv4-panel-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div className="rv4-avatar">{nameInitial}</div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '4px' }}>
                  {session.user.name || 'User'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--phosphor-dim)' }}>{session.user.email}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button onClick={() => router.push('/router/subscription')} className="rv4-ctrl-btn" style={{ flex: '1 1 auto' }}>
                SUBSCRIPTION
              </button>
              {subscriptionStatus === 'free' && (
                <button onClick={() => window.location.href = '/api/stripe/checkout'} className="rv4-ctrl-btn primary" style={{ flex: '1 1 auto' }}>
                  UPGRADE TO PRO →
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(192,192,192,0.12)', borderRadius: '3px' }}>
                <div style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Email</div>
                <div style={{ fontSize: '11px', color: 'var(--phosphor-green)', wordBreak: 'break-all' }}>{session.user.email}</div>
              </div>
              <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(192,192,192,0.12)', borderRadius: '3px' }}>
                <div style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Member Since</div>
                <div style={{ fontSize: '11px', color: 'var(--phosphor-green)' }}>{stats?.memberSince || 'N/A'}</div>
              </div>
              <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(192,192,192,0.12)', borderRadius: '3px' }}>
                <div style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Authentication</div>
                <div style={{ fontSize: '11px', color: 'var(--phosphor-green)' }}>
                  {session.user.image?.includes('google') ? 'Google OAuth' : session.user.image?.includes('github') ? 'GitHub OAuth' : 'Email and Password'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="rv4-stat-bar cols-4" style={{ borderRadius: '3px', marginBottom: '14px' }}>
          <div className="rv4-stat-cell accent-green">
            <div className="rv4-stat-label">API Calls</div>
            <div className="rv4-stat-value">{stats?.totalRequests.toLocaleString() || '0'}</div>
          </div>
          <div className="rv4-stat-cell accent-amber">
            <div className="rv4-stat-label">Total Saved</div>
            <div className="rv4-stat-value amber">${stats?.totalSaved.toFixed(2) || '0.00'}</div>
          </div>
          <div className="rv4-stat-cell accent-green">
            <div className="rv4-stat-label">Success Rate</div>
            <div className="rv4-stat-value">{stats?.successRate || '0%'}</div>
          </div>
          <div className="rv4-stat-cell accent-blue">
            <div className="rv4-stat-label">Active Keys</div>
            <div className="rv4-stat-value blue">{stats?.activeKeys || '0'}</div>
          </div>
        </div>

        {stats?.mostUsedModel && stats.mostUsedModel !== 'N/A' && (
          <div className="rv4-panel" style={{ marginBottom: '14px' }}>
            <div className="rv4-panel-header">
              <span className="rv4-panel-title">MOST USED MODEL</span>
            </div>
            <div className="rv4-panel-body">
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--phosphor-green)', letterSpacing: '0.5px' }}>
                {stats.mostUsedModel}
              </div>
            </div>
          </div>
        )}

        {/* Quick navigation */}
        <div className="rv4-panel" style={{ marginBottom: '14px' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">QUICK NAVIGATION</span>
          </div>
          <div className="rv4-panel-body">
            <div className="rv4-actions-grid">
              {[
                { label: 'DASHBOARD', href: '/router' },
                { label: 'API KEYS', href: '/router/keys' },
                { label: 'ANALYTICS', href: '/router/analytics' },
                { label: 'MAIN SITE', href: '/' },
              ].map((a) => (
                <button key={a.href} onClick={() => router.push(a.href)} className="rv4-action-btn">
                  <div className="rv4-action-btn-title">{a.label}</div>
                  <span style={{ marginLeft: 'auto', color: 'var(--phosphor-dim)', fontSize: '12px' }}>→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </RouterLayout>
  );
}
