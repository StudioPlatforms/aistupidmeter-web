'use client';

export default function SalesOverlay() {
  const handleStartTrial = () => {
    window.location.href = '/api/stripe/checkout';
  };

  return (
    <div className="rv4-body">
      {/* Hero */}
      <div className="rv4-upgrade-hero">
        <div className="rv4-upgrade-hero-title">STOP OVERPAYING FOR AI<span className="blinking-cursor"></span></div>
        <div className="rv4-upgrade-hero-sub">Save 50-70% on AI costs • Get better results with intelligence-based routing</div>
        <div className="rv4-upgrade-price-original">$49.99/month</div>
        <div className="rv4-upgrade-price">$4.99<sub>/mo</sub></div>
        <div className="rv4-upgrade-trial-badge">7-DAY FREE TRIAL — NO CREDIT CARD</div>
        <button onClick={handleStartTrial} className="rv4-upgrade-cta">
          Start Free Trial →
        </button>
        <div className="rv4-upgrade-fine-print">Cancel anytime • Instant access • Powered by real-time AI benchmarks</div>
      </div>

      {/* Intelligence section */}
      <div className="rv4-panel" style={{ marginBottom: '16px' }}>
        <div className="rv4-panel-header">
          <span className="rv4-panel-title">WORLD'S FIRST INTELLIGENCE-BASED AI ROUTER</span>
          <span className="rv4-badge blue">UNIQUE</span>
        </div>
        <div className="rv4-panel-body">
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <p style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.6', maxWidth: '600px', margin: '0 auto' }}>
              Unlike other routers that guess, we use live data from{' '}
              <strong style={{ color: 'var(--phosphor-green)' }}>171+ benchmarks</strong> across{' '}
              <strong style={{ color: 'var(--phosphor-green)' }}>16+ models</strong> to route your requests
              to the best-performing, most cost-effective model in real-time.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            {[
              { step: '01', title: 'LIVE INTELLIGENCE', desc: 'AI Stupid Meter runs 171+ benchmarks 24/7 tracking real performance' },
              { step: '02', title: 'SMART ANALYSIS', desc: 'Router analyzes your request and matches with current model rankings' },
              { step: '03', title: 'OPTIMAL ROUTING', desc: 'Selects the best model for quality, speed, and cost automatically' },
              { step: '04', title: 'SAVE 50-70%', desc: 'Get better results while paying less — no manual switching needed' },
            ].map((s, i) => (
              <div key={i} style={{
                padding: '12px', background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(0,255,65,0.15)', borderRadius: '3px',
              }}>
                <div style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--phosphor-dim)', letterSpacing: '0.8px', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>STEP {s.step}</div>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.title}</div>
                <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.4' }}>{s.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: '10px', background: 'rgba(255,176,0,0.06)', border: '1px solid rgba(255,176,0,0.2)', borderRadius: '3px' }}>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--amber-warning)', marginBottom: '3px', letterSpacing: '0.5px' }}>NO ONE ELSE DOES THIS</div>
            <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.5' }}>
              Other routers use static rules or outdated data. We use <strong style={{ color: 'var(--phosphor-green)' }}>live benchmark intelligence</strong>.
              When GPT-5 degrades, we know instantly. When Claude improves, you benefit immediately.
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
              { title: 'CUT COSTS 50-70%', desc: 'Smart routing picks cheaper models when quality matches' },
              { title: 'BEST SELECTION', desc: 'Real-time benchmarks prevent degraded models from being used' },
              { title: 'ZERO DOWNTIME', desc: 'Auto-failover with intelligent fallback to alternative models' },
              { title: 'ONE API KEY', desc: 'Access GPT, Claude, Grok, Gemini & more from a single endpoint' },
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
          { label: 'Benchmarks', value: '171+', accent: 'accent-green' },
          { label: 'AI Models', value: '16+', accent: 'accent-green' },
          { label: 'Monitoring', value: '24/7', accent: 'accent-blue' },
          { label: 'Cost Savings', value: '50-70%', accent: 'accent-amber' },
        ].map((s, i) => (
          <div key={i} className={`rv4-stat-cell ${s.accent}`}>
            <div className={`rv4-stat-value${s.accent === 'accent-amber' ? ' amber' : ''}`}>{s.value}</div>
            <div className="rv4-stat-label">{s.label}</div>
          </div>
        ))}
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
          7-Day Free Trial • No Credit Card • Cancel Anytime
        </div>
        <button onClick={handleStartTrial} className="rv4-upgrade-cta">
          START FREE TRIAL →
        </button>
      </div>

      <div className="rv4-footer">
        Powered by AI Stupid Meter • Real-time intelligence from 16+ models • <a href="/">View Live Rankings</a>
      </div>
    </div>
  );
}
