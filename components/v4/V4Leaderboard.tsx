'use client';

import { useRouter } from 'next/navigation';

interface V4LeaderboardProps {
  modelScores: any[];
  modelHistoryData: Map<string, any[]>;
  isLoading: boolean;
  showBatchRefreshing: boolean;
  leaderboardSortBy: string;
  leaderboardPeriod: string;
  driftIncidents: any[];
}

const scoreColorClass = (score: number) =>
  score >= 80 ? 'score-hi' : score >= 60 ? 'score-mi' : 'score-lo';

const scoreColor = (score: number) =>
  score >= 80 ? 'var(--phosphor-green)' : score >= 60 ? 'var(--amber-warning)' : 'var(--red-alert)';

const trendIcon = (trend: string) =>
  trend === 'up' ? '▲' : trend === 'down' ? '▼' : '→';

const trendColor = (trend: string) =>
  trend === 'up' ? 'var(--phosphor-green)' : trend === 'down' ? 'var(--red-alert)' : 'var(--phosphor-dim)';

const regimeMap: Record<string, { label: string; cls: string }> = {
  excellent: { label: 'STBL', cls: 'regime-st' },
  good: { label: 'STBL', cls: 'regime-st' },
  warning: { label: 'VOLA', cls: 'regime-vo' },
  critical: { label: 'DEGR', cls: 'regime-de' },
  unavailable: { label: '—', cls: '' },
};

const providerDotClass = (provider: string): string => {
  const map: Record<string, string> = {
    openai: 'openai', anthropic: 'anthropic', google: 'google',
    xai: 'xai', deepseek: 'deepseek', glm: 'glm', kimi: 'kimi',
  };
  return map[provider?.toLowerCase()] || 'openai';
};

// OFFICIAL VERIFIED pricing (Feb 17, 2026) - Display format
const getModelPricing = (name: string, provider: string): string => {
  const n = name.toLowerCase();
  const p = provider.toLowerCase();
  if (p === 'openai') {
    if (n.includes('gpt-5') && n.includes('turbo')) return '$10/$30';
    if (n.includes('gpt-5') && n.includes('mini')) return '$0.25/$2';
    if (n.includes('gpt-5.2') || n.includes('gpt-5-2')) return '$1.75/$14';
    if (n.includes('gpt-5')) return '$1.25/$10';
    if (n.includes('o3-pro')) return '$60/$240';
    if (n.includes('o3-mini')) return '$3.5/$14';
    if (n.includes('o3')) return '$15/$60';
    if (n.includes('gpt-4o') && n.includes('mini')) return '$0.15/$0.6';
    if (n.includes('gpt-4o')) return '$2.5/$10';
    return '$3/$9';
  }
  if (p === 'anthropic') {
    // Note: Opus 4.1 legacy $15/$75; Opus 4.5/4.6 current $5/$25
    if (n.includes('opus-4-1') || n.includes('opus-4.1')) return '$15/$75';
    if (n.includes('opus')) return '$5/$25';
    if (n.includes('sonnet')) return '$3/$15';
    if (n.includes('haiku')) return '$0.25/$1.25';
    return '$3/$15';
  }
  if (p === 'xai' || p === 'x.ai') {
    if (n.includes('grok-code-fast')) return '$0.20/$1.50';
    return '$3/$15';
  }
  if (p === 'google') {
    if (n.includes('gemini-3') && n.includes('pro')) return '$2/$12';
    if (n.includes('2.5-pro')) return '$1.25/$10';
    if (n.includes('flash-lite')) return '$0.1/$0.4';
    if (n.includes('2.5-flash')) return '$0.3/$2.5';
    if (n.includes('1.5-pro')) return '$1.25/$5';
    if (n.includes('1.5-flash')) return '$0.075/$0.3';
    return '$1/$3';
  }
  if (p === 'deepseek') return '$0.28/$0.42';
  if (p === 'glm') return '$0.60/$2.20';
  if (p === 'kimi') return '$0.60/$2.50';
  return '$2/$6';
};

function formatTimeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function MiniSparkline({ history, modelId, modelHistoryData }: { history: any[]; modelId: string; modelHistoryData: Map<string, any[]> }) {
  const data = modelHistoryData.get(modelId) || history || [];
  if (!data || data.length === 0) return <span style={{ color: 'var(--phosphor-dim)', fontSize: '9px' }}>—</span>;

  const scores = data.slice(0, 7).reverse().map((d: any) => {
    if (typeof d.score === 'number') return d.score;
    if (typeof d.stupidScore === 'number' && d.stupidScore >= 0 && d.stupidScore <= 100) return d.stupidScore;
    return null;
  }).filter((v: any): v is number => v !== null);

  if (scores.length === 0) return <span style={{ color: 'var(--phosphor-dim)', fontSize: '9px' }}>—</span>;

  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const range = max - min || 1;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1px', height: '20px' }}>
      {scores.map((v, i) => {
        const h = Math.max(2, ((v - min) / range) * 18 + 2);
        const c = v >= 80 ? 'var(--phosphor-green)' : v >= 60 ? 'var(--amber-warning)' : 'var(--red-alert)';
        return <div key={i} style={{ width: '3px', height: `${h}px`, background: c, boxShadow: `0 0 2px ${c}` }}></div>;
      })}
    </div>
  );
}

export default function V4Leaderboard({
  modelScores,
  modelHistoryData,
  isLoading,
  showBatchRefreshing,
  leaderboardSortBy,
  leaderboardPeriod,
  driftIncidents,
}: V4LeaderboardProps) {
  const router = useRouter();

  const available = modelScores.filter(m => m.currentScore !== 'unavailable');
  const unavailable = modelScores.filter(m => m.currentScore === 'unavailable');
  const sorted = [...available, ...unavailable];

  return (
    <div style={{ position: 'relative' }}>
      {/* Loading Overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 10,
        }}>
          <div style={{ fontSize: '2em', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>⚡</div>
          <div className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '6px' }}>
            UPDATING RANKINGS
          </div>
          <div className="vintage-loading"></div>
        </div>
      )}

      {/* Table Header */}
      <div className="v4-lb-header">
        <div style={{ textAlign: 'center' }}>RK</div>
        <div style={{ textAlign: 'left', paddingLeft: '10px' }}>MODEL</div>
        <div style={{ textAlign: 'center' }}>SCORE</div>
        <div style={{ textAlign: 'center' }}>TRND</div>
        <div style={{ textAlign: 'center' }} className="v4-col-regime">REGIME</div>
        <div className="v4-col-upd">UPDATED</div>
        <div style={{ textAlign: 'center' }} className="v4-col-price">$/1M</div>
        <div style={{ textAlign: 'center' }} className="v4-col-tools">TOOLS</div>
        <div style={{ textAlign: 'center' }} className="v4-col-spark">7-DAY</div>
      </div>

      {/* Table Rows */}
      {sorted.map((model, index) => {
        const rank = index + 1;
        const score = typeof model.currentScore === 'number' ? model.currentScore : null;
        const isUnavailable = score === null;
        const isHighlight = model.status === 'critical' || model.trend === 'down';
        const regime = regimeMap[model.status] || regimeMap.good;

        // Check for reasoning badge
        const usesReasoning = model.usesReasoningEffort;

        // Check for incidents
        const hasIncident = driftIncidents.some((inc: any) =>
          inc.modelName?.toLowerCase() === model.name.toLowerCase() ||
          inc.modelId === parseInt(model.id)
        );

        return (
          <div
            key={model.id}
            className={`v4-lb-row ${isHighlight ? 'highlight' : ''}`}
            onClick={() => router.push(`/models/${model.id}`)}
          >
            {/* Rank */}
            <div style={{ textAlign: 'center' }}>
              <span style={{
                fontWeight: 'bold', fontSize: '13px',
                ...(rank <= 3 ? { color: 'var(--phosphor-green)', textShadow: '0 0 3px var(--phosphor-green)' } : { color: 'var(--phosphor-dim)' }),
              }}>
                #{rank}
              </span>
            </div>

            {/* Model Name + Provider */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, overflow: 'hidden' }}>
              <div style={{
                fontWeight: 'bold', fontSize: '12px', color: 'var(--phosphor-green)',
                textShadow: '0 0 2px var(--phosphor-green)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                display: 'flex', alignItems: 'center', gap: '3px',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {(model.displayName || model.name).toUpperCase()}
                </span>
                <span className="v4-lb-model-badges" style={{ display: 'inline-flex', gap: '2px', flexShrink: 0 }}>
                  {usesReasoning && (
                    <span style={{ background: '#00BFFF', color: 'var(--terminal-black)', fontSize: '7px', padding: '1px 3px', fontWeight: 'bold', lineHeight: '1.2' }}>RSN</span>
                  )}
                  {hasIncident && (
                    <span style={{ background: 'var(--red-alert)', color: 'white', fontSize: '7px', padding: '1px 3px', fontWeight: 'bold', lineHeight: '1.2' }}>ALERT</span>
                  )}
                  {model.isNew && (
                    <span style={{ background: 'var(--phosphor-green)', color: 'var(--terminal-black)', fontSize: '7px', padding: '1px 3px', fontWeight: 'bold', lineHeight: '1.2' }}>NEW</span>
                  )}
                </span>
              </div>
              <div style={{ fontSize: '9px', color: 'var(--phosphor-dim)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '1px' }}>
                <span className={`v4-prov-dot ${providerDotClass(model.provider)}`} style={{ width: '4px', height: '4px', display: 'inline-block' }}></span>
                {model.provider?.toUpperCase()}
              </div>
            </div>

            {/* Score */}
            <div style={{ textAlign: 'center' }}>
              {isUnavailable ? (
                <span style={{ color: 'var(--phosphor-dim)', fontSize: '12px' }}>N/A</span>
              ) : (
                <span style={{
                  fontSize: '16px', fontWeight: 'bold',
                  color: scoreColor(score!),
                  textShadow: `0 0 5px ${scoreColor(score!)}`,
                }}>
                  {score}
                </span>
              )}
            </div>

            {/* Trend */}
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '14px', color: trendColor(model.trend) }}>
                {trendIcon(model.trend)}
              </span>
            </div>

            {/* Regime */}
            <div style={{ textAlign: 'center' }} className="v4-col-regime">
              {regime.cls && (
                <span className={`regime-badge ${regime.cls}`}>{regime.label}</span>
              )}
            </div>

            {/* Updated */}
            <div className="v4-col-upd" style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>
              {formatTimeAgo(model.lastUpdated)}
            </div>

            {/* Price */}
            <div style={{ textAlign: 'center', fontSize: '10px' }} className="v4-col-price">
              <span style={{ color: 'var(--phosphor-dim)' }}>
                {getModelPricing(model.name, model.provider)}
              </span>
            </div>

            {/* Tools */}
            <div style={{ textAlign: 'center', fontSize: '11px' }} className="v4-col-tools">
              <span style={{ color: 'var(--phosphor-dim)' }}>—</span>
            </div>

            {/* 7-Day Sparkline */}
            <div style={{ textAlign: 'center' }} className="v4-col-spark">
              <MiniSparkline
                history={model.history || []}
                modelId={model.id}
                modelHistoryData={modelHistoryData}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
