'use client';

const ROUTING_STRATEGIES = [
  { id: 'best_overall', name: 'BEST OVERALL', desc: 'Best general-purpose model across all categories', recommended: true },
  { id: 'best_coding', name: 'BEST FOR CODING', desc: 'Optimized for code generation, debugging, and programming', recommended: false },
  { id: 'best_reasoning', name: 'BEST FOR REASONING', desc: 'Optimized for complex reasoning, problem-solving, and analysis', recommended: false },
  { id: 'best_creative', name: 'BEST FOR CREATIVE', desc: 'Optimized for creative writing, content generation, and storytelling', recommended: false },
  { id: 'cheapest', name: 'MOST COST-EFFECTIVE', desc: 'Always selects the cheapest available model', recommended: false },
  { id: 'fastest', name: 'FASTEST RESPONSE', desc: 'Prioritizes models with the lowest latency', recommended: false },
];

const PROVIDERS = ['openai', 'anthropic', 'xai', 'google', 'glm', 'deepseek', 'kimi'];

export default function PreferencesPreview() {
  const handleStartTrial = () => {
    window.location.href = '/api/stripe/checkout';
  };

  return (
    <div className="rv4-body">
      {/* Sticky upgrade banner */}
      <div className="rv4-upgrade-sticky" style={{ borderColor: 'rgba(255,140,0,0.5)', background: 'rgba(255,140,0,0.06)' }}>
        <div className="rv4-upgrade-sticky-msg">
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--amber-warning)', fontWeight: 'bold' }}>[LOCKED]</span>
          <div>
            <div className="rv4-upgrade-sticky-title" style={{ color: 'var(--amber-warning)' }}>PREVIEW MODE — Configuration Locked</div>
            <div className="rv4-upgrade-sticky-sub">Unlock full routing customization and preferences with Pro</div>
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
            <div className="rv4-page-title">SMART ROUTER PREFERENCES<span className="blinking-cursor"></span></div>
            <div className="rv4-page-title-sub">Configure intelligent model selection powered by real-time benchmarks</div>
          </div>
        </div>
      </div>

      <div className="rv4-info-banner amber" style={{ marginBottom: '16px' }}>
        <span className="rv4-info-banner-icon" style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>[!]</span>
        <div className="rv4-info-banner-content">
          <div className="rv4-info-banner-title">PRO FEATURE</div>
          <div className="rv4-info-banner-text">Upgrade to Pro to customize these routing settings and control exactly how your requests are routed.</div>
        </div>
      </div>

      {/* Routing Strategy — blurred */}
      <div className="rv4-panel" style={{ position: 'relative', overflow: 'hidden', marginBottom: '14px', minHeight: '220px' }}>
        <div className="rv4-pro-lock-overlay">
          <div className="rv4-pro-lock-title">UNLOCK ROUTING STRATEGIES</div>
          <div className="rv4-pro-lock-text">Choose from 6 intelligent routing strategies tailored to your needs</div>
          <button onClick={handleStartTrial} className="rv4-ctrl-btn primary" style={{ marginTop: '6px' }}>
            START FREE TRIAL →
          </button>
        </div>
        <div style={{ filter: 'blur(2px)', pointerEvents: 'none', userSelect: 'none' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">SMART ROUTING STRATEGY</span>
          </div>
          <div className="rv4-panel-body">
            <div className="rv4-strategy-grid">
              {ROUTING_STRATEGIES.map((s) => (
                <div key={s.id} className={`rv4-strategy-card${s.recommended ? ' active' : ''}`} style={{ opacity: 0.7 }}>
                  <div className="rv4-strategy-card-header">
                    <span className="rv4-strategy-card-name">{s.name}</span>
                    {s.recommended && <span className="rv4-strategy-card-recommended">RECOMMENDED</span>}
                  </div>
                  <div className="rv4-strategy-card-desc">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Constraints — blurred */}
      <div className="rv4-panel" style={{ position: 'relative', overflow: 'hidden', marginBottom: '14px', minHeight: '160px' }}>
        <div className="rv4-pro-lock-overlay">
          <div className="rv4-pro-lock-title">UNLOCK CONSTRAINTS</div>
          <div className="rv4-pro-lock-text">Set cost limits, latency thresholds, and feature requirements</div>
          <button onClick={handleStartTrial} className="rv4-ctrl-btn primary" style={{ marginTop: '6px' }}>
            START FREE TRIAL →
          </button>
        </div>
        <div style={{ filter: 'blur(2px)', pointerEvents: 'none', userSelect: 'none' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">CONSTRAINTS</span>
          </div>
          <div className="rv4-panel-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', opacity: 0.6 }}>
              {['Max Cost Per 1K Tokens', 'Max Latency', 'Require Tool Calling', 'Require Streaming'].map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '2px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--phosphor-green)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{c}</span>
                  <div style={{ width: '40px', height: '16px', background: 'rgba(0,255,65,0.2)', borderRadius: '8px' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Provider Exclusions — blurred */}
      <div className="rv4-panel" style={{ position: 'relative', overflow: 'hidden', marginBottom: '16px', minHeight: '120px' }}>
        <div className="rv4-pro-lock-overlay">
          <div className="rv4-pro-lock-title">UNLOCK PROVIDER CONTROL</div>
          <div className="rv4-pro-lock-text">Choose which AI providers to include or exclude from routing</div>
          <button onClick={handleStartTrial} className="rv4-ctrl-btn primary" style={{ marginTop: '6px' }}>
            START FREE TRIAL →
          </button>
        </div>
        <div style={{ filter: 'blur(2px)', pointerEvents: 'none', userSelect: 'none' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">EXCLUDED PROVIDERS</span>
          </div>
          <div className="rv4-panel-body">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', opacity: 0.6 }}>
              {PROVIDERS.map((p) => (
                <div key={p} className="rv4-ctrl-btn" style={{ cursor: 'not-allowed', textTransform: 'uppercase' }}>
                  {p}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Why customize */}
      <div className="rv4-panel" style={{ marginBottom: '16px' }}>
        <div className="rv4-panel-header">
          <span className="rv4-panel-title">WHY CUSTOMIZE YOUR ROUTER?</span>
        </div>
        <div className="rv4-panel-body">
          <div className="rv4-upgrade-benefits">
            {[
              { title: 'PERFECT FOR YOUR USE CASE', desc: 'Choose routing strategies optimized for coding, reasoning, creative work, or cost' },
              { title: 'CONTROL YOUR COSTS', desc: 'Set maximum cost limits and always stay within your budget' },
              { title: 'OPTIMIZE FOR SPEED', desc: 'Set latency thresholds for time-critical applications' },
              { title: 'PROVIDER FLEXIBILITY', desc: 'Exclude providers you don\'t want and focus on your favorites' },
            ].map((b, i) => (
              <div key={i} className="rv4-upgrade-benefit" style={{ borderColor: 'rgba(255,140,0,0.2)', background: 'rgba(255,140,0,0.03)' }}>
                <div className="rv4-upgrade-benefit-icon" style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--amber-warning)' }}>→</div>
                <div className="rv4-upgrade-benefit-title">{b.title}</div>
                <div className="rv4-upgrade-benefit-desc">{b.desc}</div>
              </div>
            ))}
          </div>
          <div style={{
            background: 'rgba(255,140,0,0.06)', border: '2px solid rgba(255,140,0,0.4)',
            borderRadius: '3px', padding: '16px', textAlign: 'center', marginTop: '14px',
          }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--amber-warning)', marginBottom: '4px' }}>$4.99/month</div>
            <div style={{ fontSize: '11px', color: 'var(--phosphor-green)', fontWeight: 'bold', marginBottom: '12px' }}>7-Day Free Trial • No Credit Card • Cancel Anytime</div>
            <button onClick={handleStartTrial} className="rv4-upgrade-cta">
              CUSTOMIZE YOUR ROUTER NOW →
            </button>
          </div>
        </div>
      </div>

      <div className="rv4-footer">
        Powered by AI Stupid Meter • Real-time benchmarks • <a href="/">View Live Rankings</a>
      </div>
    </div>
  );
}
