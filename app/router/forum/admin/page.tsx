'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import ForumLayout from '@/components/forum/ForumLayout';
import ForumAdminSidebar from '@/components/forum/ForumAdminSidebar';
import { isAdmin as isAdminRole, formatDate } from '@/components/forum/forum-utils';

interface ForumStats {
  totalTopics: number;
  totalPosts: number;
  totalUsers: number;
  activeToday: number;
  pendingReports: number;
  recentActivity?: Array<{
    type: string;
    description: string;
    created_at: string;
    user?: string;
  }>;
}

export default function ForumAdminDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<ForumStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const role = (session?.user as any)?.role || 'user';

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (!isAdminRole(role)) return;

    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/forum/admin/stats');
        const data = await res.json();

        if (data.success) {
          setStats(data.stats || data);
        } else {
          setError(data.error || 'Failed to load stats');
        }
      } catch {
        setError('Failed to connect to the server.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [status, role]);

  if (status === 'loading') {
    return (
      <ForumLayout title="FORUM ADMIN" subtitle="Management Dashboard">
        <div className="rv4-loading" style={{ minHeight: '300px' }}>
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <span>LOADING</span>
        </div>
      </ForumLayout>
    );
  }

  if (!isAdminRole(role)) {
    return (
      <ForumLayout>
        <div className="rv4-page-header">
          <div className="rv4-page-header-left">
            <div className="rv4-page-title">ACCESS DENIED</div>
          </div>
        </div>
        <div className="rv4-body">
          <div className="rv4-error-banner">
            🔒 You don&apos;t have permission to access this page. Admin access required.
          </div>
        </div>
      </ForumLayout>
    );
  }

  return (
    <ForumLayout title="FORUM ADMIN" subtitle="Management Dashboard">
      <ForumAdminSidebar currentPath={pathname} />

      {loading && (
        <div className="rv4-loading" style={{ minHeight: '200px' }}>
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <span>LOADING STATS</span>
        </div>
      )}

      {error && (
        <div className="rv4-error-banner">{error}</div>
      )}

      {!loading && !error && stats && (
        <>
          {/* Stats Grid */}
          <div className="rv4-stat-bar cols-5" style={{ borderRadius: '3px', marginBottom: '14px' }}>
            <div className="rv4-stat-cell accent-green">
              <div className="rv4-stat-label">Total Topics</div>
              <div className="rv4-stat-value">{stats.totalTopics.toLocaleString()}</div>
            </div>
            <div className="rv4-stat-cell accent-green">
              <div className="rv4-stat-label">Total Posts</div>
              <div className="rv4-stat-value">{stats.totalPosts.toLocaleString()}</div>
            </div>
            <div className="rv4-stat-cell accent-blue">
              <div className="rv4-stat-label">Forum Users</div>
              <div className="rv4-stat-value blue">{stats.totalUsers.toLocaleString()}</div>
            </div>
            <div className="rv4-stat-cell accent-green">
              <div className="rv4-stat-label">Active Today</div>
              <div className="rv4-stat-value">{stats.activeToday.toLocaleString()}</div>
            </div>
            <div className={`rv4-stat-cell ${stats.pendingReports > 0 ? 'accent-amber' : 'accent-green'}`}>
              <div className="rv4-stat-label">Pending Reports</div>
              <div className={`rv4-stat-value ${stats.pendingReports > 0 ? 'amber' : ''}`}>
                {stats.pendingReports}
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="rv4-panel" style={{ marginBottom: '14px' }}>
            <div className="rv4-panel-header">
              <span className="rv4-panel-title">QUICK ACTIONS</span>
            </div>
            <div className="rv4-panel-body">
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="rv4-ctrl-btn primary"
                  onClick={() => router.push('/router/forum/admin/categories')}
                >
                  📁 Manage Categories
                </button>
                <button
                  className="rv4-ctrl-btn"
                  onClick={() => router.push('/router/forum/admin/reports')}
                  style={stats.pendingReports > 0 ? { borderColor: 'var(--amber-warning)', color: 'var(--amber-warning)' } : {}}
                >
                  ⚑ Review Reports {stats.pendingReports > 0 ? `(${stats.pendingReports})` : ''}
                </button>
                {(role === 'admin' || role === 'superadmin') && (
                  <button
                    className="rv4-ctrl-btn"
                    onClick={() => router.push('/router/forum/admin/users')}
                  >
                    👥 Manage Users
                  </button>
                )}
                <button
                  className="rv4-ctrl-btn"
                  onClick={() => router.push('/router/forum')}
                >
                  ← Back to Forum
                </button>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          {stats.recentActivity && stats.recentActivity.length > 0 && (
            <div className="rv4-panel" style={{ marginBottom: '14px' }}>
              <div className="rv4-panel-header">
                <span className="rv4-panel-title">RECENT ACTIVITY</span>
              </div>
              <div className="rv4-panel-body">
                <div className="rv4-activity-list">
                  {stats.recentActivity.map((activity, i) => (
                    <div key={i} className="rv4-activity-item" style={{ padding: '8px 0', borderBottom: '1px solid rgba(192,192,192,0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                        <div>
                          <span style={{ color: 'var(--phosphor-green)', fontSize: '11px', fontWeight: 'bold', marginRight: '8px' }}>
                            [{activity.type.toUpperCase()}]
                          </span>
                          <span style={{ color: 'var(--phosphor-dim)', fontSize: '12px' }}>
                            {activity.description}
                          </span>
                          {activity.user && (
                            <span style={{ color: 'var(--phosphor-green)', fontSize: '11px', marginLeft: '6px' }}>
                              — {activity.user}
                            </span>
                          )}
                        </div>
                        <span style={{ color: 'var(--phosphor-dim)', fontSize: '10px', whiteSpace: 'nowrap' }}>
                          {formatDate(activity.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Forum Overview Panel */}
          <div className="rv4-panel">
            <div className="rv4-panel-header">
              <span className="rv4-panel-title">FORUM OVERVIEW</span>
            </div>
            <div className="rv4-panel-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(192,192,192,0.12)', borderRadius: '3px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Your Role</div>
                  <div style={{ fontSize: '12px', color: 'var(--phosphor-green)', fontWeight: 'bold', textTransform: 'uppercase' }}>{role}</div>
                </div>
                <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(192,192,192,0.12)', borderRadius: '3px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Posts per Topic</div>
                  <div style={{ fontSize: '12px', color: 'var(--phosphor-green)', fontWeight: 'bold' }}>
                    {stats.totalTopics > 0 ? (stats.totalPosts / stats.totalTopics).toFixed(1) : '0'}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(192,192,192,0.12)', borderRadius: '3px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Report Status</div>
                  <div style={{ fontSize: '12px', color: stats.pendingReports > 0 ? 'var(--amber-warning)' : 'var(--phosphor-green)', fontWeight: 'bold' }}>
                    {stats.pendingReports > 0 ? `${stats.pendingReports} PENDING` : 'ALL CLEAR'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </ForumLayout>
  );
}
