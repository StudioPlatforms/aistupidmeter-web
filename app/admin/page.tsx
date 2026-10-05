'use client';

import { useState, useEffect } from 'react';
import '../../styles/vintage.css';

interface VisitorStats {
  today: {
    visits: number;
    unique: number;
    topPages: Record<string, number>;
    topCountries: Record<string, number>;
  };
  totals: {
    visits: number;
    unique: number;
  };
  sevenDays: {
    visits: number;
    unique: number;
  };
  thirtyDays: {
    visits: number;
    unique: number;
  };
  daily: Array<{
    date: string;
    visits: number;
    unique: number;
    topPages: Record<string, number>;
    topCountries: Record<string, number>;
  }>;
}

interface RecentVisitor {
  id: number;
  path: string;
  timestamp: string;
  country: string | null;
  city: string | null;
  referer: string | null;
  isUnique: boolean;
}

interface UserStats {
  total: number;
  pro: number;
  free: number;
  today: number;
  week: number;
  month: number;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Who may see this page is decided by the server: /api/admin/users answers 401 to visitors who
  // are not signed in and 403 to accounts without the admin role (lib/admin-auth). Until
  // 2026-10-05 this page compared a password typed here against one written into the page's own
  // JavaScript, which every visitor's browser downloads.
  const [access, setAccess] = useState<'checking' | 'signin' | 'forbidden' | 'error'>('checking');
  const [loading, setLoading] = useState(false);
  const [visitorStats, setVisitorStats] = useState<VisitorStats | null>(null);
  const [recentVisitors, setRecentVisitors] = useState<RecentVisitor[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/admin/users', { cache: 'no-store' });
        if (r.status === 401) { setAccess('signin'); return; }
        if (r.status === 403) { setAccess('forbidden'); return; }
        if (!r.ok) { setAccess('error'); return; }
        setIsAuthenticated(true);
        fetchVisitorData();
      } catch {
        setAccess('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getApiUrl = () => {
    // Always use the production API URL since we're running in production
    return 'https://aistupidlevel.info';
  };

  const fetchVisitorData = async () => {
    setLoading(true);
    try {
      const apiUrl = getApiUrl();
      
      // Fetch visitor statistics
      const statsResponse = await fetch(`${apiUrl}/visitors/stats`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setVisitorStats(statsData);
      }

      // Fetch recent visitors (admin-only: through the signed-in route)
      const recentResponse = await fetch('/api/admin/visitors/recent', { cache: 'no-store' });
      if (recentResponse.ok) {
        const recentData = await recentResponse.json();
        setRecentVisitors(recentData.visitors || []);
      }

      // Fetch user statistics
      const userResponse = await fetch('/api/admin/users');
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.success) {
          setUserStats(userData.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch visitor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDailyStats = async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch('/api/admin/update-daily-stats', { method: 'POST' });
      if (response.ok) {
        alert('Daily stats updated successfully');
        fetchVisitorData();
      } else {
        alert('Failed to update daily stats');
      }
    } catch (error) {
      alert('Error updating daily stats');
    }
  };

  if (!isAuthenticated) {
    const message = access === 'checking' ? 'Checking access…'
      : access === 'signin' ? 'Sign in with an administrator account to see visitor statistics.'
      : access === 'forbidden' ? 'This page is for administrators only.'
      : 'Could not check access right now. Try again in a moment.';
    return (
      <div className="vintage-container" style={{ maxWidth: '400px', margin: '0 auto', paddingTop: '100px' }}>
        <div className="crt-monitor">
          <div className="terminal-text" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5em', marginBottom: '16px' }}>
              <span className="terminal-text--amber">ADMIN ACCESS</span>
            </div>
            <div className="terminal-text--dim" style={{ marginBottom: '20px' }}>{message}</div>
            {access === 'signin' && (
              <a href="/auth/signin?callbackUrl=%2Fadmin" className="vintage-btn">SIGN IN</a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vintage-container">
      <div className="crt-monitor">
        <div className="terminal-text">
          <div style={{ fontSize: '1.5em', marginBottom: '16px', textAlign: 'center' }}>
            <span className="terminal-text--green">ADMIN DASHBOARD</span>
            <span className="blinking-cursor"></span>
          </div>
          <div className="terminal-text--dim" style={{ textAlign: 'center', marginBottom: '20px' }}>
            Visitor Statistics & Analytics
          </div>
          
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
            <button onClick={fetchVisitorData} className="vintage-btn" disabled={loading}>
              {loading ? 'LOADING...' : 'REFRESH DATA'}
            </button>
            <button onClick={updateDailyStats} className="vintage-btn">
              UPDATE DAILY STATS
            </button>
            <button onClick={() => { window.location.href = '/'; }} className="vintage-btn vintage-btn--warning">
              LOGOUT
            </button>
          </div>
        </div>
      </div>

      {/* User Statistics */}
      {userStats && (
        <div className="crt-monitor">
          <div className="terminal-text" style={{ marginBottom: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.2em', marginBottom: '8px' }}>
              👥 USER ACCOUNTS
            </div>
          </div>
          
          <div className="vintage-grid">
            <div className="terminal-text" style={{ textAlign: 'center', padding: '12px', border: '1px solid rgba(26, 115, 232, 0.3)', borderRadius: '4px' }}>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '4px' }}>TOTAL USERS</div>
              <div className="terminal-text--green" style={{ fontSize: '2em', fontWeight: 'bold' }}>{userStats.total}</div>
            </div>
            
            <div className="terminal-text" style={{ textAlign: 'center', padding: '12px', border: '1px solid rgba(255, 176, 0, 0.3)', borderRadius: '4px' }}>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '4px' }}>PRO USERS</div>
              <div className="terminal-text--amber" style={{ fontSize: '2em', fontWeight: 'bold' }}>{userStats.pro}</div>
            </div>
            
            <div className="terminal-text" style={{ textAlign: 'center', padding: '12px', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '4px' }}>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '4px' }}>FREE USERS</div>
              <div className="terminal-text" style={{ fontSize: '2em', fontWeight: 'bold' }}>{userStats.free}</div>
            </div>
          </div>
          
          <div className="vintage-grid" style={{ marginTop: '12px' }}>
            <div className="terminal-text" style={{ padding: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '4px' }}>
              <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>TODAY</div>
              <div className="terminal-text--green">{userStats.today} new</div>
            </div>
            
            <div className="terminal-text" style={{ padding: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '4px' }}>
              <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>7 DAYS</div>
              <div className="terminal-text--green">{userStats.week} new</div>
            </div>
            
            <div className="terminal-text" style={{ padding: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '4px' }}>
              <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>30 DAYS</div>
              <div className="terminal-text--green">{userStats.month} new</div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Overview */}
      {visitorStats && (
        <div className="vintage-grid">
          {/* Today's Stats */}
          <div className="crt-monitor">
            <div className="terminal-text" style={{ marginBottom: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2em', marginBottom: '8px' }}>
                📊 TODAY'S STATS
              </div>
            </div>
            
            <div className="terminal-text">
              <div style={{ marginBottom: '12px' }}>
                <span className="terminal-text--green">VISITS:</span> {visitorStats.today.visits}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <span className="terminal-text--green">UNIQUE:</span> {visitorStats.today.unique}
              </div>
              
              <div style={{ marginBottom: '8px' }}>
                <span className="terminal-text--amber">TOP PAGES:</span>
              </div>
              {Object.entries(visitorStats.today.topPages).slice(0, 5).map(([page, count]) => (
                <div key={page} className="terminal-text--dim" style={{ fontSize: '0.9em', marginLeft: '12px' }}>
                  {page}: {count}
                </div>
              ))}

              <div style={{ margin: '12px 0 8px' }}>
                <span className="terminal-text--amber">TOP COUNTRIES:</span>
              </div>
              {Object.keys(visitorStats.today.topCountries || {}).length === 0 && (
                <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginLeft: '12px' }}>
                  Locating today&apos;s visitors — filled in within a minute of each visit.
                </div>
              )}
              {Object.entries(visitorStats.today.topCountries || {}).slice(0, 8).map(([country, count]) => (
                <div key={country} className="terminal-text--dim" style={{ fontSize: '0.9em', marginLeft: '12px' }}>
                  {country}: {count}
                </div>
              ))}
              <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginTop: '10px' }}>
                <a href="https://db-ip.com" target="_blank" rel="noopener noreferrer">IP Geolocation by DB-IP</a>
              </div>
            </div>
          </div>

          {/* Overall Stats */}
          <div className="crt-monitor">
            <div className="terminal-text" style={{ marginBottom: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2em', marginBottom: '8px' }}>
                📈 TOTALS
              </div>
            </div>
            
            <div className="terminal-text">
              <div style={{ marginBottom: '12px' }}>
                <span className="terminal-text--green">TOTAL VISITS:</span> {visitorStats.totals.visits}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <span className="terminal-text--green">TOTAL UNIQUE:</span> {visitorStats.totals.unique}
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <span className="terminal-text--amber">7 DAYS:</span>
                <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginLeft: '12px' }}>
                  Visits: {visitorStats.sevenDays.visits}
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginLeft: '12px' }}>
                  Unique: {visitorStats.sevenDays.unique}
                </div>
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <span className="terminal-text--amber">30 DAYS:</span>
                <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginLeft: '12px' }}>
                  Visits: {visitorStats.thirtyDays.visits}
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginLeft: '12px' }}>
                  Unique: {visitorStats.thirtyDays.unique}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Visitors */}
      {recentVisitors.length > 0 && (
        <div className="crt-monitor">
          <div className="terminal-text" style={{ marginBottom: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.2em', marginBottom: '8px' }}>
              🕒 RECENT VISITORS
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
              Last {recentVisitors.length} visits
            </div>
          </div>
          
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {recentVisitors.map((visitor) => (
              <div key={visitor.id} style={{ 
                marginBottom: '8px', 
                padding: '8px', 
                border: '1px solid rgba(255,255,255,0.1)',
                fontSize: '0.85em'
              }}>
                <div className="terminal-text">
                  <span className="terminal-text--green">{visitor.path}</span>
                  {visitor.isUnique && <span className="terminal-text--amber"> [UNIQUE]</span>}
                </div>
                <div className="terminal-text--dim">
                  {new Date(visitor.timestamp).toLocaleString()}
                  {visitor.country && ` • ${visitor.city ? `${visitor.city}, ` : ''}${visitor.country}`}
                  {visitor.referer && (() => {
                    try {
                      return ` • From: ${new URL(visitor.referer).hostname}`;
                    } catch {
                      return ` • From: ${visitor.referer}`;
                    }
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily History */}
      {visitorStats && visitorStats.daily.length > 0 && (
        <div className="crt-monitor">
          <div className="terminal-text" style={{ marginBottom: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.2em', marginBottom: '8px' }}>
              📅 DAILY HISTORY
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
              Last {visitorStats.daily.length} days
            </div>
          </div>
          
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {visitorStats.daily.map((day) => (
              <div key={day.date} style={{ 
                marginBottom: '6px', 
                padding: '6px', 
                border: '1px solid rgba(255,255,255,0.1)',
                fontSize: '0.85em'
              }}>
                <div className="terminal-text">
                  <span className="terminal-text--green">{day.date}</span>
                  <span style={{ marginLeft: '12px' }}>
                    Visits: {day.visits} | Unique: {day.unique}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="crt-monitor">
          <div className="terminal-text" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.2em' }}>
              LOADING DATA<span className="vintage-loading"></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
