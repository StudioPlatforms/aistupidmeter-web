'use client';

import { useRouter } from 'next/navigation';
import ProviderLogo from '../ProviderLogo';
import { slugifyModelName } from '../../lib/model-slug';
import { getModelPricing } from '../../lib/model-pricing';

const PROVIDER_KEYS = ['openai', 'anthropic', 'xai', 'google', 'glm', 'deepseek', 'kimi'] as const;
type ProviderKey = typeof PROVIDER_KEYS[number];

const normalizeProvider = (provider: string): ProviderKey => {
  const p = (provider || '').toLowerCase().replace('x.ai', 'xai');
  return (PROVIDER_KEYS.includes(p as ProviderKey) ? p : 'openai') as ProviderKey;
};

const providerColor: Record<ProviderKey, string> = {
  openai: '#10a37f', anthropic: '#d97757', xai: '#111111',
  google: '#4285f4', glm: '#e91e63', deepseek: '#4d6bfe', kimi: '#ff6b35',
};

interface V4LeaderboardProps {
  modelScores: any[];
  modelHistoryData: Map<string, any[]>;
  isLoading: boolean;
  showBatchRefreshing: boolean;
  leaderboardSortBy: string;
  leaderboardPeriod: string;
  driftIncidents: any[];
}

const scoreColor = (score: number) =>
  score >= 70 ? 'var(--good)' : score >= 50 ? 'var(--warn)' : 'var(--bad)';

const trendIcon = (trend: string) =>
  trend === 'up' ? '▲' : trend === 'down' ? '▼' : '→';

const trendColor = (trend: string) =>
  trend === 'up' ? 'var(--good)' : trend === 'down' ? 'var(--bad)' : 'var(--phosphor-dim)';

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

// Formats the shared pricing table (lib/model-pricing.ts) for the $/1M column.
// This used to be a sixth independent copy of the price list and was the one
// actually rendered on ?sortBy=price, so it is what users saw: Fable 5 fell
// through to $3/$15, every GPT-5.x to $1.25/$10, and Gemini 3.1 Flash Lite
// matched the 2.5-era 'flash-lite' rule at $0.1/$0.4.
const fmt = (n: number): string => `$${Number(n.toFixed(4))}`;
const getModelPricingLabel = (name: string, provider: string): string => {
  const p = getModelPricing(name, provider);
  return `${fmt(p.input)}/${fmt(p.output)}`;
};

function formatTimeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Guard against invalid/epoch dates (e.g. null timestamps producing 1970 dates)
  const MIN_VALID_DATE = new Date('2024-01-01').getTime();
  if (isNaN(d.getTime()) || d.getTime() < MIN_VALID_DATE) {
    return '—'; // Show dash instead of "20581d" for invalid dates
  }
  
  const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutes < 0) return 'now'; // Future dates (clock skew)
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days > 365) return '—'; // Clearly invalid if > 1 year ago
  return `${days}d`;
}

function MiniSparkline({ history, modelId, modelHistoryData }: { history: any[]; modelId: string; modelHistoryData: Map<string, any[]> }) {
  const data = modelHistoryData.get(modelId) || history || [];
  if (!data || data.length === 0) return <span style={{ color: 'var(--phosphor-dim)', fontSize: '9px' }}>—</span>;

  const scores = data.slice(0, 7).reverse().map((d: any) => {
    if (typeof d.score === 'number') return d.score;
    if (typeof d.stupidScore === 'number' && d.stupidScore >= 0 && d.stupidScore <= 100) return d.stupidScore;
    return null;
  }).filter((v: any): v is number => v !== null);

  if (scores.length < 2) return <span style={{ color: 'var(--phosphor-dim)', fontSize: '11px' }}>—</span>;

  const w = 76, h = 24, pad = 3;
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const range = max - min || 1;
  const pts = scores.map((v, i) => {
    const x = pad + (i / (scores.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((v - min) / range) * (h - 2 * pad);
    return [x, y] as const;
  });
  const line = pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${pad},${h - pad} ${line} ${(w - pad)},${h - pad}`;
  const delta = scores[scores.length - 1] - scores[0];
  const color = delta > 1 ? 'var(--good)' : delta < -1 ? 'var(--bad)' : 'var(--accent)';
  const last = pts[pts.length - 1];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      <polygon points={area} fill={color} opacity={0.10} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2} fill={color} />
    </svg>
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

        // SEO-friendly slug for crawlable model links (falls back to id).
        const modelHref = `/models/${slugifyModelName(model.name) || model.id}`;

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
            onClick={() => router.push(modelHref)}
          >
            {/* Rank */}
            <div style={{ textAlign: 'center' }}>
              <span className={`v4-lb-rank ${rank <= 3 ? 'top' : ''}`}>{rank}</span>
            </div>

            {/* Model Name + Provider */}
            <div className="v4-lb-model">
              <span className="v4-lb-logo">
                <ProviderLogo provider={normalizeProvider(model.provider)} size={18} />
              </span>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div className="v4-lb-model-name">
                  <a
                    href={modelHref}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(modelHref); }}
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: 'inherit', textDecoration: 'none' }}
                  >
                    {model.displayName || model.name}
                  </a>
                  <span className="v4-lb-model-badges">
                    {usesReasoning && <span className="v4-tag v4-tag-blue">RSN</span>}
                    {hasIncident && <span className="v4-tag v4-tag-red">ALERT</span>}
                    {model.isNew && <span className="v4-tag v4-tag-green">NEW</span>}
                  </span>
                </div>
                <div className="v4-lb-model-prov">{model.provider}</div>
              </div>
            </div>

            {/* Score */}
            <div style={{ textAlign: 'center' }}>
              {isUnavailable ? (
                <span style={{ color: 'var(--phosphor-dim)', fontSize: '12px' }}>N/A</span>
              ) : (
                <span className="v4-lb-score" style={{ color: scoreColor(score!) }}>{score}</span>
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
                {getModelPricingLabel(model.name, model.provider)}
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
