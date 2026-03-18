'use client';

import { useEffect, useState } from 'react';

interface Model {
  id: string;
  name: string;
  displayName?: string;
  provider: string;
  currentScore: number;
  rank: number;
  trend: 'up' | 'down' | 'stable';
}

export default function IntelligencePreview() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopModels();
  }, []);

  const fetchTopModels = async () => {
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/dashboard/scores?period=latest&sortBy=combined`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const topModels = data.data.slice(0, 8).map((model: any, index: number) => ({
            id: model.id,
            name: model.name,
            displayName: model.displayName || model.name,
            provider: model.provider,
            currentScore: typeof model.currentScore === 'number' ? model.currentScore : 0,
            rank: index + 1,
            trend: model.trend || 'stable',
          }));
          setModels(topModels);
        }
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrial = () => {
    window.location.href = '/api/stripe/checkout';
  };

  const getTrendLabel = (trend: string) => {
    if (trend === 'up') return '▲';
    if (trend === 'down') return '▼';
    return '→';
  };
  const getTrendColor = (trend: string) => {
    if (trend === 'up') return 'var(--phosphor-green)';
    if (trend === 'down') return 'var(--red-alert)';
    return 'var(--phosphor-dim)';
  };

  return (
    <div className="rv4-body">
      {/* Sticky upgrade banner */}
      <div className="rv4-upgrade-sticky" style={{ borderColor: 'rgba(0,191,255,0.4)', background: 'rgba(0,191,255,0.06)' }}>
        <div className="rv4-upgrade-sticky-msg">
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#00bfff', fontWeight: 'bold' }}>[LOCKED]</span>
          <div>
            <div className="rv4-upgrade-sticky-title" style={{ color: '#00bfff' }}>PREVIEW MODE — Intelligence Features Locked</div>
            <div className="rv4-upgrade-sticky-sub">Unlock model comparison, downloads, and advanced analytics with Pro</div>
          </div>
        </div>
        <button onClick={handleStartTrial} className="rv4-ctrl-btn primary" style={{ padding: '8px 18px', fontSize: '11px' }}>
          START FREE TRIAL →
        </button>
      </div>

      {/* Page header */}
      <div className="rv4-page-header" style={{ position: 'relative', top: 'auto', marginBottom: '16px', borderRadius: '3px' }}>
        <div className="rv4-page-header-left">
          <div>
            <div className="rv4-page-title">MODEL INTELLIGENCE<span className="blinking-cursor"></span></div>
            <div className="rv4-page-title-sub">Comprehensive AI model analytics, benchmarks, and comparison tools</div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="rv4-stat-bar cols-4" style={{ borderRadius: '3px', marginBottom: '16px' }}>
        {[
          { label: 'Live Models', value: loading ? '...' : String(models.length), accent: 'accent-green' },
          { label: 'Providers', value: loading ? '...' : String(new Set(models.map(m => m.provider)).size), accent: 'accent-green' },
          { label: 'Benchmarks', value: '171+', accent: 'accent-blue' },
          { label: 'Data Points', value: '10K+', accent: 'accent-amber' },
        ].map((s, i) => (
          <div key={i} className={`rv4-stat-cell ${s.accent}`}>
            <div className={`rv4-stat-value${s.accent === 'accent-amber' ? ' amber' : ''}`}>{s.value}</div>
            <div className="rv4-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Live model rankings — VISIBLE */}
      <div className="rv4-panel" style={{ marginBottom: '16px' }}>
        <div className="rv4-panel-header">
          <span className="rv4-panel-title">LIVE MODEL RANKINGS</span>
          <span className="rv4-badge green">LIVE</span>
        </div>
        <div className="rv4-panel-body">
          {loading ? (
            <div className="rv4-loading">
              <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
              <span>LOADING MODEL DATA</span>
            </div>
          ) : (
            <div className="rv4-intel-grid">
              {models.map((model) => (
                <div key={model.id} className="rv4-intel-card">
                  <div className="rv4-intel-card-header">
                    <div>
                      <div className="rv4-intel-card-name">{model.displayName || model.name}</div>
                      <div className="rv4-intel-card-provider">{model.provider.toUpperCase()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="rv4-intel-card-score">{model.currentScore.toFixed(1)}</div>
                      <div className="rv4-intel-card-score-label" style={{ color: getTrendColor(model.trend) }}>
                        {getTrendLabel(model.trend)} SCORE
                      </div>
                    </div>
                  </div>
                  <div className="rv4-intel-card-rank">#{model.rank}</div>
                  <div className="rv4-intel-card-actions">
                    <a
                      href={`/models/${model.id}`}
                      className="rv4-ctrl-btn"
                      style={{ fontSize: '10px', flex: 1, textAlign: 'center', textDecoration: 'none' }}
                    >
                      VIEW DETAILS
                    </a>
                    <button
                      onClick={handleStartTrial}
                      className="rv4-ctrl-btn"
                      style={{ fontSize: '10px', flex: 1, opacity: 0.6 }}
                    >
                      DOWNLOAD [PRO]
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Locked features grid */}
      <div className="rv4-cols-2">
        {/* Model Comparison — locked */}
        <div className="rv4-panel" style={{ position: 'relative', overflow: 'hidden', minHeight: '200px' }}>
          <div className="rv4-pro-lock-overlay">
            <div className="rv4-pro-lock-title">UNLOCK MODEL COMPARISON</div>
            <div className="rv4-pro-lock-text">Compare up to 4 models side-by-side with overlaid performance charts and deep analytics</div>
            <button onClick={handleStartTrial} className="rv4-ctrl-btn primary" style={{ marginTop: '6px' }}>
              START FREE TRIAL →
            </button>
          </div>
          <div style={{ filter: 'blur(3px)', padding: '14px', pointerEvents: 'none', userSelect: 'none' }}>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>COMPARISON TOOL</div>
            <div style={{ height: '120px', background: 'rgba(0,255,65,0.05)', borderRadius: '3px', border: '1px solid rgba(0,255,65,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>Demo Chart</span>
            </div>
          </div>
        </div>

        {/* Advanced Filters — locked */}
        <div className="rv4-panel" style={{ position: 'relative', overflow: 'hidden', minHeight: '200px' }}>
          <div className="rv4-pro-lock-overlay">
            <div className="rv4-pro-lock-title">UNLOCK ADVANCED FILTERS</div>
            <div className="rv4-pro-lock-text">Filter by category, provider, test type, and time period for targeted analysis</div>
            <button onClick={handleStartTrial} className="rv4-ctrl-btn primary" style={{ marginTop: '6px' }}>
              START FREE TRIAL →
            </button>
          </div>
          <div style={{ filter: 'blur(3px)', padding: '14px', pointerEvents: 'none', userSelect: 'none' }}>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>FILTERS AND CONTROLS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['Category', 'Provider', 'Sort By', 'Time Period'].map((f, i) => (
                <div key={i} style={{ padding: '8px 10px', background: 'rgba(0,255,65,0.05)', borderRadius: '2px', fontSize: '10px', color: 'var(--phosphor-dim)' }}>{f}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade CTA */}
      <div className="rv4-panel" style={{ marginBottom: '16px', marginTop: '4px' }}>
        <div className="rv4-panel-header">
          <span className="rv4-panel-title">UNLOCK FULL INTELLIGENCE</span>
        </div>
        <div className="rv4-panel-body">
          <div className="rv4-upgrade-benefits" style={{ marginBottom: '16px' }}>
            {[
              { title: 'MODEL COMPARISON', desc: 'Compare up to 4 models with overlaid charts and detailed analytics' },
              { title: 'DATA EXPORT', desc: 'Download comprehensive model data in CSV or JSON format' },
              { title: 'ADVANCED FILTERS', desc: 'Filter by category, provider, test type, and custom time periods' },
              { title: 'HISTORICAL TRENDS', desc: 'View 30-day performance trends and identify degradation patterns' },
            ].map((b, i) => (
              <div key={i} className="rv4-upgrade-benefit" style={{ borderColor: 'rgba(0,191,255,0.2)', background: 'rgba(0,191,255,0.04)' }}>
                <div className="rv4-upgrade-benefit-icon" style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: '#00bfff' }}>→</div>
                <div className="rv4-upgrade-benefit-title">{b.title}</div>
                <div className="rv4-upgrade-benefit-desc">{b.desc}</div>
              </div>
            ))}
          </div>
          <div style={{
            background: 'rgba(0,191,255,0.06)', border: '2px solid rgba(0,191,255,0.3)',
            borderRadius: '3px', padding: '16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#00bfff', marginBottom: '4px' }}>$4.99/month</div>
            <div style={{ fontSize: '11px', color: 'var(--phosphor-green)', fontWeight: 'bold', marginBottom: '12px' }}>7-Day Free Trial • No Credit Card • Cancel Anytime</div>
            <button onClick={handleStartTrial} className="rv4-upgrade-cta">
              UNLOCK INTELLIGENCE NOW →
            </button>
          </div>
        </div>
      </div>

      <div className="rv4-footer">
        Data sourced from AI Stupid Meter • Real-time benchmarks • <a href="/">View Main Site</a>
      </div>
    </div>
  );
}
