'use client';

import { ROUTER_PLAN, annualMonthly, annualSaving } from '@/lib/pricing-display';

import { SAVINGS_PCT } from '@/lib/savings-estimate';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { isVolatile } from '../../lib/fleet-buckets';

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
    .map(w => (w === 'gpt' ? 'GPT' : w === 'glm' ? 'GLM' : w === 'deepseek' ? 'DeepSeek' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .replace(/\.\s/g, '.')
    .replace(/\s(\d)/g, ' $1')
    .replace(/^(GPT|GLM) (\d)/, '$1-$2');
};

const scoreColor = (score: number) =>
  score >= 80 ? 'var(--phosphor-green)' : score >= 60 ? 'var(--amber-warning)' : 'var(--red-alert)';

// OFFICIAL VERIFIED pricing (Feb 17, 2026) - USD per 1M tokens
// Pricing comes from the shared table in lib/model-pricing.ts so this panel
// cannot disagree with the leaderboard or the model detail page.

export default function IntelligencePanel({
  recommendations,
  degradations,
  providerReliability,
  modelScores,
  driftIncidents,
}: IntelligencePanelProps) {
  const router = useRouter();
  const { data: session } = useSession();

  // Build recommendation items from real data
  const recoItems: Array<{ type: string; name: string; detail: string; score: number; status: string; danger?: boolean; providerDot?: string }> = [];

  // Every card below is one category computed from measurements by the API
  // (routes/analytics.ts /recommendations) and is shown under that category's own name.
  const nameOf = (x: any) => x?.displayName || getCompactName(x?.name);

  if (recommendations?.bestForCode?.name) {
    const b = recommendations.bestForCode;
    recoItems.push({
      type: 'BEST FOR CODE',
      name: nameOf(b),
      detail: b.reason || (typeof b.correctness === 'number' ? `${Math.round(b.correctness)}% correct` : 'top coding score'),
      score: b.codingScore ?? b.score ?? 0,
      status: 'STBL',
      providerDot: b.vendor || b.provider,
    });
  }

  if (recommendations?.mostReliable?.name) {
    const r = recommendations.mostReliable;
    recoItems.push({
      type: 'MOST RELIABLE',
      name: nameOf(r),
      detail: r.reason || 'Lowest variance',
      score: r.score || 0,
      status: 'STBL',
      providerDot: r.vendor || r.provider,
    });
  }

  if (recommendations?.fastestResponse?.name) {
    const f = recommendations.fastestResponse;
    recoItems.push({
      type: 'FASTEST RESPONSE',
      name: nameOf(f),
      detail: f.reason || 'Quick response time',
      score: f.score || 0,
      status: 'FAST',
      providerDot: f.vendor || f.provider,
    });
  }

  // Best value: points per MEASURED dollar of one identical coding run. This used to be
  // computed here from list price per token, which ranks verbose models backwards — a model
  // that writes four times as much costs four times as much per task at the same price.
  if (recommendations?.bestValue?.name) {
    const v = recommendations.bestValue;
    recoItems.push({
      type: 'BEST VALUE',
      name: nameOf(v),
      detail: v.reason || 'Most points per dollar',
      score: v.score || 0,
      status: typeof v.costPerRun === 'number' ? `$${v.costPerRun < 0.1 ? v.costPerRun.toFixed(3) : v.costPerRun.toFixed(2)}` : 'VALUE',
      providerDot: v.vendor || v.provider,
    });
  }

  // Poor value: another ranked model scores at least as high for a third of the cost or less.
  // A price judgement, not a fault, so it is not styled as one.
  if (Array.isArray(recommendations?.poorValue)) {
    recommendations.poorValue.slice(0, 2).forEach((model: any) => {
      if (!model?.name) return;
      recoItems.push({
        type: '⚠ POOR VALUE',
        name: nameOf(model),
        detail: model.reason || 'A cheaper model scores as high',
        score: model.score || 0,
        status: 'COST',
        providerDot: model.vendor || model.provider,
      });
    });
  }

  // Avoid now: genuine problems only (serious degradation or a failing score).
  if (Array.isArray(recommendations?.avoidNow)) {
    recommendations.avoidNow.slice(0, 2).forEach((model: any) => {
      if (!model?.name) return;
      recoItems.push({
        type: '⛔ AVOID NOW',
        name: nameOf(model),
        detail: model.reason || 'Performance problem',
        score: typeof model.score === 'number' ? model.score : 0,
        status: 'AVOID',
        danger: true,
        providerDot: model.provider,
      });
    });
  }

  // Genuinely noisy models, measured by the SAME standard error the front-page VOLATILE
  // count uses (lib/fleet-buckets), so the two cannot disagree in public again.
  //
  // This used to fire on `trend === 'down'` and label the result "UNRELIABLE · High
  // variance detected". Direction is not variance: on 15 September 2026 it called
  // gpt-5.6-terra unreliable for high variance while that model had one of the LOWEST
  // standard errors on the board and the stat bar's VOLATILE count read 0.
  const volatileModels = modelScores
    .filter(m =>
      typeof m.currentScore === 'number' &&
      isVolatile(m) &&
      !recoItems.some(ri => ri.name === getCompactName(m.name))
    )
    .slice(0, 1);

  volatileModels.forEach(m => {
    recoItems.push({
      type: '⚠ UNRELIABLE',
      name: getCompactName(m.name),
      detail: typeof m.standardError === 'number'
        ? `±${m.standardError.toFixed(1)} pts between identical runs`
        : 'High variance between identical runs',
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

  // Provider trust data — show the top 4 providers by trust score.
  // xAI / Grok are excluded: the API no longer returns them, and the
  // fallback builder filters them as a safety net.
  const providerData = (providerReliability.length > 0
    ? providerReliability
    : buildProviderTrustFromScores(modelScores)
  )
    .filter((prov: any) => {
      const key = String(prov.provider || prov.name || '').toLowerCase();
      return key !== 'xai' && key !== 'x.ai' && key !== 'grok';
    })
    .sort((a: any, b: any) => (b.score || b.trustScore || 0) - (a.score || a.trustScore || 0))
    .slice(0, 4);

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

      {/*
        Sends signed-out visitors to /pricing, not /router. /router is behind
        auth, so an advert that landed there bounced the reader straight into a
        sign-in wall before they had been told what they would be buying.
      */}
      <div className="v4-pro-cta" onClick={() => router.push(session ? '/router' : '/pricing')}>
        <div className="v4-pro-cta-title">SMART ROUTER</div>
        <div className="v4-pro-cta-sub">
          Every request goes to the model measuring best right now. Bring your own provider keys —
          in our benchmark the cheapest model matching the top score cost {SAVINGS_PCT}% less.
        </div>
        <div className="v4-pro-cta-price">
          {annualMonthly(ROUTER_PLAN)}{' '}
          <span className="cta-note">
            billed annually{annualSaving(ROUTER_PLAN) ? ` · saves ${annualSaving(ROUTER_PLAN)} a year` : ''}
          </span>
        </div>
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
    // Exclude xAI/Grok models from the fallback builder as well
    const vendor = String(m.provider || '').toLowerCase();
    if (vendor === 'xai' || vendor === 'x.ai' || vendor === 'grok') return;
    if (typeof m.currentScore === 'number' && m.provider) {
      const existing = providers.get(m.provider) || { total: 0, count: 0 };
      existing.total += m.currentScore;
      existing.count += 1;
      providers.set(m.provider, existing);
    }
  });
  return Array.from(providers.entries())
    .map(([name, data]) => ({
      name,
      provider: name,
      score: Math.round(data.total / data.count),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}
