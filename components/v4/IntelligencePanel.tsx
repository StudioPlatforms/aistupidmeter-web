'use client';

import { useRouter } from 'next/navigation';

interface IntelligencePanelProps {
  recommendations: any;
  degradations: any[];
  providerReliability: any[];
  modelScores: any[];
  driftIncidents: any[];
}

const providerDotClass = (provider: string): string => {
  const map: Record<string, string> = {
    openai: 'openai', anthropic: 'anthropic', google: 'google',
    xai: 'xai', deepseek: 'deepseek', glm: 'glm', kimi: 'kimi',
  };
  return map[provider?.toLowerCase()] || 'openai';
};

const getCompactName = (name: string): string => {
  if (!name) return name;
  // Auto-format: capitalize each segment, handle common patterns
  return name
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/\.\s/g, '.')
    .replace(/\s(\d)/g, ' $1');
};

const scoreColor = (score: number) =>
  score >= 80 ? 'var(--phosphor-green)' : score >= 60 ? 'var(--amber-warning)' : 'var(--red-alert)';

const getModelPricing = (name: string, provider: string): { input: number; output: number } => {
  const n = name.toLowerCase();
  const p = provider.toLowerCase();
  if (p === 'openai') {
    if (n.includes('gpt-5') && n.includes('mini')) return { input: 0.25, output: 2 };
    if (n.includes('gpt-5')) return { input: 1.25, output: 10 };
    if (n.includes('o3-pro')) return { input: 60, output: 240 };
    if (n.includes('o3-mini')) return { input: 3.5, output: 14 };
    if (n.includes('o3')) return { input: 15, output: 60 };
    return { input: 3, output: 9 };
  }
  if (p === 'anthropic') {
    if (n.includes('opus')) return { input: 5, output: 25 };
    if (n.includes('sonnet')) return { input: 3, output: 15 };
    if (n.includes('haiku')) return { input: 0.25, output: 1.25 };
    return { input: 3, output: 15 };
  }
  if (p === 'xai') return { input: 3, output: 15 };
  if (p === 'google') {
    if (n.includes('2.5-pro')) return { input: 1.25, output: 10 };
    if (n.includes('flash-lite')) return { input: 0.1, output: 0.4 };
    if (n.includes('flash')) return { input: 0.3, output: 2.5 };
    return { input: 1, output: 3 };
  }
  if (p === 'deepseek') return { input: 0.55, output: 2.19 };
  if (p === 'glm') return { input: 0.55, output: 2.19 };
  if (p === 'kimi') return { input: 0.15, output: 2.5 };
  return { input: 2, output: 6 };
};

export default function IntelligencePanel({
  recommendations,
  degradations,
  providerReliability,
  modelScores,
  driftIncidents,
}: IntelligencePanelProps) {
  const router = useRouter();

  // Build recommendation items from real data
  const recoItems: Array<{ type: string; name: string; detail: string; score: number; status: string; danger?: boolean; providerDot?: string }> = [];

  if (recommendations?.bestForCode?.name) {
    const b = recommendations.bestForCode;
    const acc = b.correctness ? `${Math.round(b.correctness)}%` : b.score ? `${Math.round(b.score)}%` : 'High';
    recoItems.push({
      type: 'BEST FOR CODE',
      name: getCompactName(b.name),
      detail: `${acc} correct | ${b.provider || ''}`,
      score: b.score || b.correctness || 0,
      status: 'STBL',
      providerDot: b.provider,
    });
  }

  if (recommendations?.mostReliable?.name) {
    const r = recommendations.mostReliable;
    recoItems.push({
      type: 'MOST RELIABLE',
      name: getCompactName(r.name),
      detail: r.reason || 'Lowest variance',
      score: r.score || 0,
      status: 'STBL',
      providerDot: r.provider,
    });
  }

  if (recommendations?.fastestResponse?.name) {
    const f = recommendations.fastestResponse;
    recoItems.push({
      type: 'FASTEST RESPONSE',
      name: getCompactName(f.name),
      detail: f.reason || 'Quick response time',
      score: f.score || 0,
      status: 'FAST',
      providerDot: f.provider,
    });
  }

  // Best Value (pts/$) — computed from live modelScores data
  const availableWithPrice = modelScores
    .filter(m => typeof m.currentScore === 'number' && m.currentScore > 0 && m.provider)
    .map(m => {
      const pricing = getModelPricing(m.name, m.provider);
      const cost = pricing.input * 0.4 + pricing.output * 0.6;
      const value = cost > 0 ? m.currentScore / cost : 0;
      return { ...m, value, cost };
    })
    .sort((a, b) => b.value - a.value);

  if (availableWithPrice.length > 0) {
    const best = availableWithPrice[0];
    recoItems.push({
      type: 'BEST VALUE (pts/$)',
      name: getCompactName(best.name),
      detail: `${best.value.toFixed(1)} pts/$ | best ROI`,
      score: best.currentScore,
      status: `$${best.cost.toFixed(2)}`,
      providerDot: best.provider,
    });
  }

  // Avoid Now — from recommendations API
  if (recommendations?.avoidNow && Array.isArray(recommendations.avoidNow)) {
    recommendations.avoidNow.slice(0, 2).forEach((model: any) => {
      if (model?.name) {
        recoItems.push({
          type: '⚠ AVOID NOW',
          name: getCompactName(model.name),
          detail: model.reason || 'Poor performance detected',
          score: model.score || 0,
          status: 'DEGR',
          danger: true,
          providerDot: model.provider,
        });
      }
    });
  }

  // Unreliable — volatile models from real scores (high variance / volatile status)
  const volatileModels = modelScores
    .filter(m =>
      typeof m.currentScore === 'number' &&
      (m.status === 'warning' || m.trend === 'down') &&
      !recoItems.some(ri => ri.name === getCompactName(m.name)) // avoid duplicates
    )
    .slice(0, 1);

  volatileModels.forEach(m => {
    recoItems.push({
      type: '⚠ UNRELIABLE',
      name: getCompactName(m.name),
      detail: m.stability ? `σ=${m.stability.toFixed(1)} | volatile` : 'High variance detected',
      score: m.currentScore,
      status: 'VOLA',
      danger: true,
      providerDot: m.provider,
    });
  });

  // Build activity feed from recent events
  const activityItems: Array<{ time: string; icon: string; text: string }> = [];

  // Degradation events
  degradations.slice(0, 3).forEach((deg: any) => {
    if (deg.modelName) {
      activityItems.push({
        time: deg.detectedAt ? formatTimeAgo(deg.detectedAt) : 'recent',
        icon: deg.severity === 'critical' ? '🔴' : '🟡',
        text: `<b class="${deg.severity === 'critical' ? 'crit' : 'warn'}">${getCompactName(deg.modelName)}</b> ${deg.message || 'performance issue'}`,
      });
    }
  });

  // Recently benchmarked models (trend up)
  modelScores
    .filter(m => m.trend === 'up' && typeof m.currentScore === 'number')
    .slice(0, 2)
    .forEach(m => {
      activityItems.push({
        time: formatTimeAgo(m.lastUpdated),
        icon: '🟢',
        text: `<b>${getCompactName(m.name)}</b> benchmarked: <b>${m.currentScore}</b>`,
      });
    });

  // Stable models
  modelScores
    .filter(m => m.trend === 'stable' && typeof m.currentScore === 'number' && m.currentScore >= 80)
    .slice(0, 2)
    .forEach(m => {
      activityItems.push({
        time: formatTimeAgo(m.lastUpdated),
        icon: '🟢',
        text: `<b>${getCompactName(m.name)}</b> stable: <b>${m.currentScore}</b>`,
      });
    });

  // Drift incidents
  if (driftIncidents && driftIncidents.length > 0) {
    driftIncidents.slice(0, 2).forEach((inc: any) => {
      activityItems.push({
        time: inc.detectedAt ? formatTimeAgo(inc.detectedAt) : 'recent',
        icon: '🔵',
        text: `<b>${getCompactName(inc.modelName || 'Model')}</b> ${inc.type || 'drift detected'}`,
      });
    });
  }

  // Provider trust data
  const providerData = providerReliability.length > 0
    ? providerReliability
    : buildProviderTrustFromScores(modelScores);

  return (
    <div className="v4-panel v4-left-panel">
      <div className="v4-panel-header">
        <span>INTELLIGENCE CENTER</span>
        <span className="v4-badge v4-badge-green">LIVE</span>
      </div>

      {/* Recommendations */}
      <div className="v4-section-divider">SMART RECOMMENDATIONS</div>
      <div className="v4-reco-section">
        {recoItems.length > 0 ? (
          recoItems.map((item, i) => (
            <div key={i} className={`v4-reco-item ${item.danger ? 'danger' : ''}`}>
              <div className="v4-reco-left">
                <div className="v4-reco-type" style={item.danger ? { color: 'var(--red-alert)' } : undefined}>
                  {item.type}
                </div>
                <div className="v4-reco-name" style={item.danger ? { color: 'var(--red-alert)', textShadow: '0 0 2px var(--red-alert)' } : undefined}>
                  {item.providerDot && (
                    <span className={`v4-prov-dot ${providerDotClass(item.providerDot)}`} style={{ display: 'inline-block', width: '6px', height: '6px', marginRight: '4px' }}></span>
                  )}
                  {item.name}
                </div>
                <div className="v4-reco-detail">{item.detail}</div>
              </div>
              <div className="v4-reco-right">
                <div className="v4-reco-score" style={{ color: item.danger ? 'var(--red-alert)' : scoreColor(item.score) }}>
                  {item.score > 0 ? Math.round(item.score) : '—'}
                </div>
                <div className="v4-reco-sub" style={item.danger ? { color: 'var(--red-alert)' } : undefined}>
                  {item.status}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '8px', color: 'var(--phosphor-dim)', fontSize: '10px', textAlign: 'center' }}>
            Loading recommendations...
          </div>
        )}
      </div>

      {/* Active Degradations */}
      {degradations.length > 0 && (
        <>
          <div className="v4-section-divider">ACTIVE DEGRADATIONS</div>
          <div className="v4-deg-list">
            {degradations.slice(0, 4).map((deg: any, i: number) => (
              <div key={i} className={`v4-deg-card ${deg.severity === 'critical' ? 'critical' : ''}`}>
                <div className="v4-deg-header">
                  <span className="v4-deg-model" style={{ color: deg.severity === 'critical' ? 'var(--red-alert)' : 'var(--amber-warning)' }}>
                    {(deg.modelName || 'Unknown').toUpperCase()} ({(deg.provider || '').toUpperCase()})
                  </span>
                  <span className="v4-deg-badge" style={{
                    background: deg.severity === 'critical' ? 'var(--red-alert)' : 'var(--amber-warning)',
                    color: 'var(--terminal-black)',
                  }}>
                    {deg.severity === 'critical' ? 'CRIT' : 'WARN'}
                  </span>
                </div>
                <div className="v4-deg-detail">
                  {deg.message || `Score dropped ${deg.dropPercentage || 0}%. ${deg.currentScore ? `Now at ${deg.currentScore}.` : ''}`}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Provider Trust */}
      <div className="v4-section-divider">PROVIDER TRUST</div>
      <div className="v4-trust-grid">
        {providerData.map((prov: any, i: number) => (
          <div key={i} className="v4-trust-card">
            <div className="v4-trust-left">
              <div className={`v4-prov-dot ${providerDotClass(prov.provider || prov.name)}`}></div>
              <span className="v4-trust-name">{(prov.name || prov.provider || '').charAt(0).toUpperCase() + (prov.name || prov.provider || '').slice(1)}</span>
            </div>
            <div className="v4-trust-score" style={{ color: (prov.score || prov.trustScore || 0) >= 75 ? 'var(--phosphor-green)' : 'var(--amber-warning)' }}>
              {Math.round(prov.score || prov.trustScore || 0)}
            </div>
          </div>
        ))}
      </div>

      {/* Pro CTA */}
      <div className="v4-pro-cta" onClick={() => router.push('/router')}>
        <div className="v4-pro-cta-title">⚡ UNLOCK PRO ROUTER</div>
        <div className="v4-pro-cta-sub">Intelligent routing powered by live benchmark data</div>
        <div className="v4-pro-cta-sub">Save 50-70% on AI costs • One API key for all models</div>
        <div className="v4-pro-cta-price">$4.99/mo — 7-day free trial</div>
      </div>

      {/* Activity Feed */}
      <div className="v4-section-divider">LIVE ACTIVITY</div>
      <ul className="v4-activity">
        {activityItems.length > 0 ? (
          activityItems.slice(0, 8).map((item, i) => (
            <li key={i} className="v4-act-item">
              <span className="v4-act-time">{item.time}</span>
              <span className="v4-act-icon">{item.icon}</span>
              <span className="v4-act-text" dangerouslySetInnerHTML={{ __html: item.text }}></span>
            </li>
          ))
        ) : (
          <li className="v4-act-item">
            <span className="v4-act-time">—</span>
            <span className="v4-act-icon">⏳</span>
            <span className="v4-act-text" style={{ color: 'var(--phosphor-dim)' }}>Waiting for activity data...</span>
          </li>
        )}
      </ul>

      {/* Sponsored — QELT Blockchain */}
      <a
        href="https://presale.qelt.ai/"
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="v4-sponsor-card"
        style={{
          display: 'block',
          margin: '8px 12px',
          padding: '12px 16px',
          border: '1px solid rgba(255, 176, 0, 0.25)',
          background: 'rgba(255, 176, 0, 0.03)',
          textAlign: 'center',
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <div style={{ fontSize: '6px', color: 'var(--phosphor-dim)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px', opacity: 0.5 }}>
          SPONSORED
        </div>
        <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--amber-warning)', textShadow: '0 0 3px rgba(255, 176, 0, 0.4)', marginBottom: '4px' }}>
          🔗 QELT BLOCKCHAIN PRESALE
        </div>
        <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', marginBottom: '2px' }}>
          World&apos;s first RWA blockchain • $1.1T in-ground assets on-chain
        </div>
        <div style={{ fontSize: '11px', color: 'var(--amber-warning)', marginTop: '4px' }}>
          Join the presale →
        </div>
      </a>
    </div>
  );
}

function formatTimeAgo(date: Date | string): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function buildProviderTrustFromScores(modelScores: any[]): any[] {
  const providers = new Map<string, { total: number; count: number }>();
  modelScores.forEach(m => {
    if (typeof m.currentScore === 'number' && m.provider) {
      const existing = providers.get(m.provider) || { total: 0, count: 0 };
      existing.total += m.currentScore;
      existing.count += 1;
      providers.set(m.provider, existing);
    }
  });
  return Array.from(providers.entries()).map(([name, data]) => ({
    name,
    provider: name,
    score: Math.round(data.total / data.count),
  }));
}
