'use client';

import { SAVINGS_PCT, SAVINGS_QUALIFIER } from '@/lib/savings-estimate';

export default function SalesOverlay() {
  const handleStartTrial = () => {
    window.location.href = '/api/stripe/checkout';
  };

  return (
    <div className="rv4-body">
      <div className="rv4-upgrade-container">
      {/* Hero */}
      <div className="rv4-upgrade-hero">
        <div className="rv4-upgrade-hero-title">ROUTE ON MEASURED PERFORMANCE<span className="blinking-cursor"></span></div>
        <div className="rv4-upgrade-hero-sub">Pick models from live benchmark data instead of guesswork — in our own benchmark the cheapest model matching the top score cost {SAVINGS_PCT}% less per request</div>
        <div className="rv4-upgrade-price">$4.99<sub>/mo</sub></div>
        <div className="rv4-upgrade-trial-badge">7-DAY FREE TRIAL</div>
        <button onClick={handleStartTrial} className="rv4-upgrade-cta">
          Start Free Trial →
        </button>
        <div className="rv4-upgrade-fine-print">Cancel anytime • Instant access • Powered by real-time AI benchmarks</div>
      </div>

      {/* Intelligence section */}
      <div className="rv4-panel" style={{ marginBottom: '16px' }}>
        <div className="rv4-panel-header">
          <span className="rv4-panel-title">BENCHMARK-DRIVEN MODEL SELECTION</span>
          <span className="rv4-badge blue">LIVE DATA</span>
        </div>
        <div className="rv4-panel-body">
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <p style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.6', maxWidth: '600px', margin: '0 auto' }}>
              Routing decisions come from our own continuous measurements —{' '}
              <strong style={{ color: 'var(--phosphor-green)' }}>24 models</strong> re-benchmarked{' '}
              <strong style={{ color: 'var(--phosphor-green)' }}>every 4 hours</strong> — rather than a
              static list. You keep your provider keys; we choose which model each request goes to.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            {[
              { step: '01', title: 'LIVE MEASUREMENT', desc: 'Every tracked model is re-benchmarked around the clock, not scored once' },
              { step: '02', title: 'SMART ANALYSIS', desc: 'Router analyzes your request and matches with current model rankings' },
              { step: '03', title: 'OPTIMAL ROUTING', desc: 'Selects the best model for quality, speed, and cost automatically' },
              { step: '04', title: 'SEE THE RESULT', desc: 'Per-request logs of model, cost and latency, so you can check the trade-off yourself' },
            ].map((s, i) => (
              <div key={i} style={{
                padding: '12px', background: 'rgba(0,0,0,0.04)',
                border: '1px solid rgba(26, 115, 232,0.15)', borderRadius: '3px',
              }}>
                <div style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--phosphor-dim)', letterSpacing: '0.8px', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>STEP {s.step}</div>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.title}</div>
                <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.4' }}>{s.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: '10px', background: 'rgba(255,176,0,0.06)', border: '1px solid rgba(255,176,0,0.2)', borderRadius: '3px' }}>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--amber-warning)', marginBottom: '3px', letterSpacing: '0.5px' }}>WHY THIS DIFFERS</div>
            <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.5' }}>
              Routing follows our own <strong style={{ color: 'var(--phosphor-green)' }}>live measurements</strong> rather than a
              static rule or a launch-day score. When a model&apos;s measured quality moves, the ranking it is routed on moves with it.
            </div>
          </div>
        </div>
      </div>

      {/* Pain points */}
      <div className="rv4-pain-points">
        <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--red-alert)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
          WITHOUT AI ROUTER PRO:
        </div>
        {[
          'Overpaying for underperforming models?',
          'Models degrading without warning?',
          'Wrong model selected for each task?',
          'No visibility into AI costs?',
        ].map((p, i) => (
          <div key={i} className="rv4-pain-point">
            <span className="cross">✗</span>
            <span>{p}</span>
          </div>
        ))}
      </div>

      {/* Benefits */}
      <div className="rv4-panel" style={{ marginBottom: '16px' }}>
        <div className="rv4-panel-header">
          <span className="rv4-panel-title">WHAT YOU GET</span>
        </div>
        <div className="rv4-panel-body">
          <div className="rv4-upgrade-benefits">
            {[
              { title: 'COST-AWARE', desc: `Prefers a cheaper model when the measured quality is equivalent — a ${SAVINGS_PCT}% gap in our own measurements` },
              { title: 'BEST SELECTION', desc: 'Real-time benchmarks prevent degraded models from being used' },
              { title: 'ZERO DOWNTIME', desc: 'Auto-failover with intelligent fallback to alternative models' },
              { title: 'ONE API KEY', desc: 'Access GPT, Claude, Gemini, DeepSeek, Kimi and GLM from a single endpoint' },
            ].map((b, i) => (
              <div key={i} className="rv4-upgrade-benefit">
                <div className="rv4-upgrade-benefit-icon" style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--phosphor-green)' }}>→</div>
                <div className="rv4-upgrade-benefit-title">{b.title}</div>
                <div className="rv4-upgrade-benefit-desc">{b.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="rv4-stat-bar cols-4" style={{ borderRadius: '3px', marginBottom: '16px' }}>
        {[
          { label: 'Models tracked', value: '24', accent: 'accent-green' },
          { label: 'Scores recorded', value: '175K+', accent: 'accent-green' },
          { label: 'Re-benchmarked', value: '4-hourly', accent: 'accent-blue' },
          { label: 'Cost gap (measured)', value: `~${SAVINGS_PCT}%`, accent: 'accent-amber' },
        ].map((s, i) => (
          <div key={i} className={`rv4-stat-cell ${s.accent}`}>
            <div className={`rv4-stat-value${s.accent === 'accent-amber' ? ' amber' : ''}`}>{s.value}</div>
            <div className="rv4-stat-label">{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '9px', color: 'var(--phosphor-dim)', lineHeight: '1.5', marginBottom: '16px', textAlign: 'center' }}>
        {SAVINGS_QUALIFIER}
      </div>

      {/* Features included */}
      <div className="rv4-panel" style={{ marginBottom: '16px' }}>
        <div className="rv4-panel-header">
          <span className="rv4-panel-title">EVERYTHING INCLUDED</span>
        </div>
        <div className="rv4-panel-body">
          <div className="rv4-features-checklist">
            {[
              'Unlimited API requests', 'All AI models', 'Real-time monitoring',
              'Cost optimization', 'Auto failover', 'Priority support',
              'Analytics dashboard', 'Custom routing', 'Model Intelligence',
              'Provider key management',
            ].map((f, i) => (
              <div key={i} className="rv4-feature-check">
                <span className="check">✓</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div style={{
        background: 'rgba(255,176,0,0.06)', border: '2px solid var(--amber-warning)',
        borderRadius: '3px', padding: '20px', textAlign: 'center', marginBottom: '16px',
      }}>
        <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--amber-warning)', textShadow: '0 0 8px rgba(255,176,0,0.4)', marginBottom: '4px' }}>
          $4.99/month
        </div>
        <div style={{ fontSize: '11px', color: 'var(--phosphor-green)', fontWeight: 'bold', marginBottom: '14px' }}>
          7-Day Free Trial • Cancel Anytime
        </div>
        <button onClick={handleStartTrial} className="rv4-upgrade-cta">
          START FREE TRIAL →
        </button>
      </div>

      <div className="rv4-footer">
        Powered by AI Stupid Meter • Real-time intelligence from 16+ models • <a href="/">View Live Rankings</a>
      </div>
      </div>{/* /rv4-upgrade-container */}
    </div>
  );
}
