'use client';

export default function DashboardPreview() {
  const handleStartTrial = () => {
    window.location.href = '/api/stripe/checkout';
  };

  return (
    <div className="rv4-body">
      {/* Sticky upgrade banner */}
      <div className="rv4-upgrade-sticky">
        <div className="rv4-upgrade-sticky-msg">
          <span style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', color: 'var(--amber-warning)' }}>[LOCKED]</span>
          <div>
            <div className="rv4-upgrade-sticky-title">PREVIEW MODE — Upgrade to Access Full Dashboard</div>
            <div className="rv4-upgrade-sticky-sub">7-day free trial • No credit card required • Cancel anytime</div>
          </div>
        </div>
        <button onClick={handleStartTrial} className="rv4-ctrl-btn primary" style={{ fontSize: '11px', padding: '8px 18px' }}>
          START FREE TRIAL →
        </button>
      </div>

      {/* Page header */}
      <div className="rv4-page-header" style={{ position: 'relative', top: 'auto', marginBottom: '16px', borderRadius: '3px' }}>
        <div className="rv4-page-header-left">
          <div>
            <div className="rv4-page-title">AI SMART ROUTER<span className="blinking-cursor"></span></div>
            <div className="rv4-page-title-sub">Universal API Gateway • Intelligent Model Selection • Cost Optimization</div>
          </div>
        </div>
        <span className="rv4-badge amber">[LOCKED]</span>
      </div>

      {/* Metric cards — blurred */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <div className="rv4-stat-bar cols-4" style={{ borderRadius: '3px', filter: 'blur(3px)', userSelect: 'none' }}>
          {['Total Requests', 'Total Cost', 'Success Rate', 'Total Tokens'].map((label, i) => (
            <div key={i} className="rv4-stat-cell accent-green">
              <div className="rv4-stat-label">{label}</div>
              <div className="rv4-stat-value" style={{ opacity: 0.3 }}>—</div>
            </div>
          ))}
        </div>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(2px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          borderRadius: '3px', gap: '6px',
          border: '1px dashed rgba(0,255,65,0.3)',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', letterSpacing: '1px', fontFamily: 'var(--font-mono)' }}>[ACTIVATE TO TRACK]</div>
          <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>Real-time metrics with Pro</div>
        </div>
      </div>

      {/* Hero upgrade section */}
      <div className="rv4-upgrade-hero">
        <div className="rv4-upgrade-hero-title">STOP OVERPAYING FOR AI</div>
        <div className="rv4-upgrade-hero-sub">Save 50-70% on costs • Get better results with intelligence-based routing</div>
        <div className="rv4-upgrade-price-original">$49.99/month</div>
        <div className="rv4-upgrade-price">$4.99<sub>/mo</sub></div>
        <div className="rv4-upgrade-trial-badge">7-DAY FREE TRIAL — NO CREDIT CARD</div>
        <button onClick={handleStartTrial} className="rv4-upgrade-cta">
          Start Free Trial — No Credit Card →
        </button>
        <div className="rv4-upgrade-fine-print">Cancel anytime • Instant access • Powered by AI Stupid Meter benchmarks</div>
      </div>

      {/* Pain points */}
      <div className="rv4-pain-points">
        <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--red-alert)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
          WITHOUT AI ROUTER PRO:
        </div>
        {[
          'Overpaying for underperforming models without knowing it',
          'Model degradation happens silently — you get bad results',
          'Manually checking which model is best wastes developer time',
          'No visibility into your actual AI spend and savings',
        ].map((p, i) => (
          <div key={i} className="rv4-pain-point">
            <span className="cross">✗</span>
            <span>{p}</span>
          </div>
        ))}
      </div>

      {/* Benefits grid */}
      <div className="rv4-panel" style={{ marginBottom: '16px' }}>
        <div className="rv4-panel-header">
          <span className="rv4-panel-title">WHAT YOU GET WITH PRO</span>
        </div>
        <div className="rv4-panel-body">
          <div className="rv4-upgrade-benefits">
            {[
              { icon: '→', title: 'Cut Costs 50-70%', desc: 'Smart routing picks cheaper models when quality matches. Save real money.' },
              { icon: '→', title: 'Best Model Always', desc: 'Real-time benchmarks from AI Stupid Meter prevent degraded models.' },
              { icon: '→', title: 'Zero Downtime', desc: 'Auto-failover ensures your apps keep running if a model goes down.' },
              { icon: '→', title: 'One Universal Key', desc: 'Replace all provider keys with one key for GPT, Claude, Grok, Gemini.' },
              { icon: '→', title: 'Full Analytics', desc: 'See every request, cost, latency, and provider breakdown in real-time.' },
              { icon: '→', title: 'Live Intelligence', desc: '171+ benchmarks run 24/7. When GPT-5 degrades, you benefit immediately.' },
            ].map((b, i) => (
              <div key={i} className="rv4-upgrade-benefit">
                <div className="rv4-upgrade-benefit-icon" style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--phosphor-green)' }}>{b.icon}</div>
                <div className="rv4-upgrade-benefit-title">{b.title}</div>
                <div className="rv4-upgrade-benefit-desc">{b.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="rv4-panel" style={{ marginBottom: '16px' }}>
        <div className="rv4-panel-header">
          <span className="rv4-panel-title">WORLD'S FIRST INTELLIGENCE-BASED AI ROUTER</span>
        </div>
        <div className="rv4-panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            {[
              { step: '01', title: 'LIVE INTELLIGENCE', desc: 'AI Stupid Meter runs 171+ benchmarks 24/7 tracking real performance' },
              { step: '02', title: 'SMART ANALYSIS', desc: 'Router analyzes your request and matches with current model rankings' },
              { step: '03', title: 'OPTIMAL ROUTING', desc: 'Automatically selects the best model for quality, speed, and cost' },
              { step: '04', title: 'SAVE 50-70%', desc: 'Get better results while paying less — no manual switching needed' },
            ].map((step, i) => (
              <div key={i} style={{
                padding: '12px', background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(0,255,65,0.15)', borderRadius: '3px',
                position: 'relative',
              }}>
                <div style={{
                  fontSize: '9px', fontWeight: 'bold', color: 'var(--phosphor-dim)',
                  letterSpacing: '0.8px', marginBottom: '6px', fontFamily: 'var(--font-mono)',
                }}>
                  STEP {step.step}
                </div>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{step.title}</div>
                <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.4' }}>{step.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(255,176,0,0.06)', border: '1px solid rgba(255,176,0,0.25)', borderRadius: '3px' }}>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--amber-warning)', marginBottom: '3px', letterSpacing: '0.5px' }}>NO ONE ELSE DOES THIS</div>
            <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.5' }}>
              Other routers use static rules. We use <strong style={{ color: 'var(--phosphor-green)' }}>live benchmark intelligence</strong> from AI Stupid Meter.
              When GPT-5 degrades, we know instantly. When Claude improves, you benefit immediately.
            </div>
          </div>
        </div>
      </div>

      {/* Stats proof */}
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

      {/* Features checklist */}
      <div className="rv4-panel" style={{ marginBottom: '16px' }}>
        <div className="rv4-panel-header">
          <span className="rv4-panel-title">EVERYTHING INCLUDED IN PRO</span>
        </div>
        <div className="rv4-panel-body">
          <div className="rv4-features-checklist">
            {[
              'Unlimited API requests', 'All AI models', 'Real-time monitoring', 'Cost optimization',
              'Auto failover', 'Priority support', 'Analytics dashboard', 'Custom routing preferences',
              'Model Intelligence', 'Provider key management', 'Historical data', 'CSV/JSON exports',
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
        <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--amber-warning)', textShadow: '0 0 8px rgba(255,176,0,0.4)', marginBottom: '6px' }}>
          $4.99/month
        </div>
        <div style={{ fontSize: '11px', color: 'var(--phosphor-green)', fontWeight: 'bold', marginBottom: '14px' }}>
          7-Day Free Trial • No Credit Card • Cancel Anytime
        </div>
        <button onClick={handleStartTrial} className="rv4-upgrade-cta">
          UNLOCK FULL ACCESS — START FREE TRIAL →
        </button>
      </div>

      <div className="rv4-footer">
        Powered by AI Stupid Meter • Real-time intelligence from 16+ models • <a href="/">View Live Rankings</a>
      </div>
    </div>
  );
}
