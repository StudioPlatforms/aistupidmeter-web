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

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [visitorStats, setVisitorStats] = useState<VisitorStats | null>(null);
  const [recentVisitors, setRecentVisitors] = useState<RecentVisitor[]>([]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'Password123$') {
      setIsAuthenticated(true);
      setError('');
      fetchVisitorData();
    } else {
      setError('Invalid password');
    }
  };

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

      // Fetch recent visitors
      const recentResponse = await fetch(`${apiUrl}/visitors/recent`);
      if (recentResponse.ok) {
        const recentData = await recentResponse.json();
        setRecentVisitors(recentData.visitors || []);
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
      const response = await fetch(`${apiUrl}/visitors/update-daily-stats`, {
        method: 'POST'
      });
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
    return (
      <div className="vintage-container" style={{ maxWidth: '400px', margin: '0 auto', paddingTop: '100px' }}>
        <div className="crt-monitor">
          <div className="terminal-text">
            <div style={{ fontSize: '1.5em', marginBottom: '16px', textAlign: 'center' }}>
              <span className="terminal-text--amber">ADMIN ACCESS</span>
              <span className="blinking-cursor"></span>
            </div>
            <div className="terminal-text--dim" style={{ textAlign: 'center', marginBottom: '20px' }}>
              Enter password to access visitor statistics
            </div>
            
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '16px' }}>
                <div className="terminal-text" style={{ marginBottom: '8px' }}>
                  PASSWORD:
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  autoComplete="new-password"
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'var(--terminal-black)',
                    border: '1px solid var(--metal-silver)',
                    borderRadius: '4px',
                    color: 'var(--phosphor-green)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              {error && (
                <div className="terminal-text--red" style={{ marginBottom: '16px', textAlign: 'center' }}>
                  {error}
                </div>
              )}
              
              <div style={{ textAlign: 'center' }}>
                <button type="submit" className="vintage-btn">
                  LOGIN
                </button>
              </div>
            </form>
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
            <button onClick={() => setIsAuthenticated(false)} className="vintage-btn vintage-btn--warning">
              LOGOUT
            </button>
          </div>
        </div>
      </div>

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
                  {visitor.country && ` • ${visitor.country}`}
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
