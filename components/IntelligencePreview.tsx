'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PixelIcon from './PixelIcon';

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
  const router = useRouter();
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
          // Show top 8 models
          const topModels = data.data.slice(0, 8).map((model: any, index: number) => ({
            id: model.id,
            name: model.name,
            displayName: model.displayName || model.name,
            provider: model.provider,
            currentScore: typeof model.currentScore === 'number' ? model.currentScore : 0,
            rank: index + 1,
            trend: model.trend || 'stable'
          }));
          setModels(topModels);
        }
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrial = () => {
    router.push('/api/stripe/checkout');
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return '📈';
    if (trend === 'down') return '📉';
    return '➡️';
  };

  const getTrendColor = (trend: string) => {
    if (trend === 'up') return 'var(--phosphor-green)';
    if (trend === 'down') return 'var(--red-alert)';
    return 'var(--phosphor-dim)';
  };

  return (
    <div className="vintage-container">
      {/* Sticky Upgrade Banner */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'rgba(138, 43, 226, 0.15)',
        border: '2px solid rgba(138, 43, 226, 0.5)',
        borderRadius: '6px',
        padding: '12px 16px',
        marginBottom: '20px',
        boxShadow: '0 4px 12px rgba(138, 43, 226, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.5em' }}>🧠</span>
            <div>
              <div className="terminal-text" style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '2px' }}>
                PREVIEW MODE - Intelligence Features Locked
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                Unlock model comparison, downloads, and advanced analytics
              </div>
            </div>
          </div>
          <button
            onClick={handleStartTrial}
            className="vintage-btn vintage-btn--active"
            style={{
              padding: '8px 20px',
              fontSize: '0.9em',
              whiteSpace: 'nowrap'
            }}
          >
            START FREE TRIAL →
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="crt-monitor" style={{ marginBottom: '20px' }}>
        <div className="terminal-text">
          <h1 style={{ fontSize: '1.5em', marginBottom: '8px' }}>
            <span className="terminal-text--green">🧠 MODEL INTELLIGENCE</span>
            <span className="blinking-cursor"></span>
          </h1>
          <p className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
            Comprehensive AI model analytics, benchmarks, and comparison tools
          </p>
        </div>
      </div>

      {/* Live Model Rankings */}
      <div className="crt-monitor" style={{ marginBottom: '20px' }}>
        <div className="terminal-text">
          <div style={{ fontSize: '1.2em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PixelIcon name="chart" size={24} />
            <span className="terminal-text--green" style={{ fontWeight: 'bold' }}>
              🏆 LIVE MODEL RANKINGS
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div className="terminal-text--dim">
                LOADING MODEL DATA<span className="vintage-loading"></span>
              </div>
            </div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
              gap: '16px' 
            }}>
              {models.map((model) => (
                <div
                  key={model.id}
                  style={{
                    padding: '16px',
                    border: '2px solid rgba(0, 255, 65, 0.3)',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, rgba(0, 255, 65, 0.08), rgba(0, 255, 65, 0.02))',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="terminal-text--green" style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {model.displayName || model.name}
                      </div>
                      <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                        {model.provider.toUpperCase()}
                      </div>
                    </div>
                    <span style={{ fontSize: '1.3em', color: getTrendColor(model.trend) }}>
                      {getTrendIcon(model.trend)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ 
                      padding: '6px 10px', 
                      background: 'rgba(0, 255, 65, 0.2)', 
                      borderRadius: '4px',
                      fontSize: '1em',
                      fontWeight: 'bold'
                    }}>
                      #{model.rank}
                    </div>
                    <div>
                      <div className="terminal-text--dim" style={{ fontSize: '0.7em', marginBottom: '2px' }}>
                        SCORE
                      </div>
                      <div className="terminal-text--green" style={{ fontSize: '1.3em', fontWeight: 'bold', textShadow: '0 0 5px currentColor' }}>
                        {model.currentScore.toFixed(1)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <a 
                      href={`/models/${model.id}`}
                      className="vintage-btn vintage-btn--sm"
                      style={{ textAlign: 'center', fontSize: '0.75em' }}
                    >
                      VIEW DETAILS
                    </a>
                    <button
                      onClick={handleStartTrial}
                      className="vintage-btn vintage-btn--sm"
                      style={{ fontSize: '0.75em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: 0.7 }}
                    >
                      💾 DOWNLOAD 🔒
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Locked Features Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Model Comparison - Locked */}
        <div className="crt-monitor" style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backdropFilter: 'blur(6px)',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            borderRadius: '6px'
          }}>
            <div style={{ fontSize: '2.5em', marginBottom: '12px' }}>📊</div>
            <div className="terminal-text--green" style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>
              UNLOCK MODEL COMPARISON
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '16px', textAlign: 'center', maxWidth: '300px' }}>
              Compare up to 4 models side-by-side with charts and analytics
            </div>
            <button
              onClick={handleStartTrial}
              className="vintage-btn vintage-btn--active"
              style={{ padding: '10px 24px' }}
            >
              START FREE TRIAL
            </button>
          </div>

          <div className="terminal-text" style={{ padding: '20px', filter: 'blur(4px)' }}>
            <div style={{ fontSize: '1.1em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PixelIcon name="analytics" size={20} />
              <span className="terminal-text--green" style={{ fontWeight: 'bold' }}>COMPARISON TOOL</span>
            </div>
            <div style={{ height: '200px', background: 'rgba(0, 255, 65, 0.05)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="terminal-text--dim">Demo Chart</div>
            </div>
          </div>
        </div>

        {/* Advanced Filters - Locked */}
        <div className="crt-monitor" style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backdropFilter: 'blur(6px)',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            borderRadius: '6px'
          }}>
            <div style={{ fontSize: '2.5em', marginBottom: '12px' }}>🎛️</div>
            <div className="terminal-text--green" style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>
              UNLOCK ADVANCED FILTERS
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '16px', textAlign: 'center', maxWidth: '300px' }}>
              Filter by category, provider, test type, and time period
            </div>
            <button
              onClick={handleStartTrial}
              className="vintage-btn vintage-btn--active"
              style={{ padding: '10px 24px' }}
            >
              START FREE TRIAL
            </button>
          </div>

          <div className="terminal-text" style={{ padding: '20px', filter: 'blur(4px)' }}>
            <div style={{ fontSize: '1.1em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PixelIcon name="settings" size={20} />
              <span className="terminal-text--green" style={{ fontWeight: 'bold' }}>FILTERS & CONTROLS</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['Category', 'Provider', 'Sort By', 'Time Period'].map((filter, i) => (
                <div key={i} style={{ padding: '8px', background: 'rgba(0, 255, 65, 0.05)', borderRadius: '4px' }}>
                  <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>{filter}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {[
          { label: 'Total Models', value: models.length, icon: 'chart' },
          { label: 'Providers', value: new Set(models.map(m => m.provider)).size, icon: 'plug' },
          { label: 'Live Benchmarks', value: '171+', icon: 'lightning' },
          { label: 'Data Points', value: '10K+', icon: 'numbers' }
        ].map((stat, index) => (
          <div key={index} className="crt-monitor" style={{ padding: '16px', textAlign: 'center' }}>
            <PixelIcon name={stat.icon} size={24} style={{ marginBottom: '8px' }} />
            <div className="terminal-text--green" style={{ fontSize: '2em', fontWeight: 'bold', textShadow: '0 0 10px currentColor' }}>
              {stat.value}
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginTop: '4px' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Why Upgrade Section */}
      <div className="crt-monitor">
        <div className="terminal-text">
          <div style={{ fontSize: '1.2em', marginBottom: '16px', textAlign: 'center' }}>
            <span className="terminal-text--amber">💎 UNLOCK FULL INTELLIGENCE</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            {[
              { icon: '📊', title: 'Model Comparison', desc: 'Compare up to 4 models side-by-side with overlaid charts and detailed analytics' },
              { icon: '💾', title: 'Data Export', desc: 'Download comprehensive model data in CSV or JSON format for your own analysis' },
              { icon: '🎛️', title: 'Advanced Filters', desc: 'Filter by category, provider, test type, and custom time periods' },
              { icon: '📈', title: 'Historical Trends', desc: 'View 30-day performance trends and identify degradation patterns' }
            ].map((benefit, index) => (
              <div key={index} style={{ 
                padding: '16px',
                border: '1px solid rgba(138, 43, 226, 0.3)',
                borderRadius: '4px',
                backgroundColor: 'rgba(138, 43, 226, 0.05)'
              }}>
                <div style={{ fontSize: '2em', marginBottom: '8px' }}>{benefit.icon}</div>
                <div className="terminal-text--green" style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '6px' }}>
                  {benefit.title}
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.85em', lineHeight: '1.4' }}>
                  {benefit.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Final CTA */}
          <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'rgba(138, 43, 226, 0.1)', borderRadius: '6px', border: '2px solid rgba(138, 43, 226, 0.5)' }}>
            <div className="terminal-text--amber" style={{ fontSize: '1.3em', fontWeight: 'bold', marginBottom: '8px' }}>
              $4.99/mo • 7-Day Free Trial
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '16px' }}>
              No credit card required • Cancel anytime
            </div>
            <button
              onClick={handleStartTrial}
              className="vintage-btn vintage-btn--active"
              style={{
                padding: '14px 32px',
                fontSize: '1.1em',
                fontWeight: 'bold'
              }}
            >
              UNLOCK INTELLIGENCE NOW →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
