'use client';

import { PLANS } from '@/lib/entitlements';

type HistoricalPeriod = 'latest' | '24h' | '7d' | '1m';
type ScoringMode = 'combined' | 'reasoning' | 'speed' | 'tooling';

interface ModelDetailControlsProps {
  selectedPeriod: HistoricalPeriod;
  selectedScoringMode: ScoringMode;
  hasProAccess: boolean;
  isRefreshing: boolean;
  onPeriodChange: (period: HistoricalPeriod) => void;
  onScoringModeChange: (mode: ScoringMode) => void;
  onShowProModal: (feature: 'historical-data' | 'performance-matrix') => void;
}

/**
 * History depth is an entitlement, not a hard-coded flag — same rule as the
 * leaderboard's ControlsBar. Free covers everything inside PLANS.free.historyDays;
 * beyond that is paid. Diagnosis (the Page-Hinkley curve, the axis matrix) stays
 * paid regardless of window, which is the line the pricing is drawn on: basic
 * evidence is public, interpreting it is the product.
 */
const PERIOD_DAYS: Record<HistoricalPeriod, number | null> = {
  latest: null, '24h': 1, '7d': 7, '1m': 30,
};

function periodsFor(hasProAccess: boolean): Array<{ key: HistoricalPeriod; label: string; proOnly: boolean }> {
  const freeDays = PLANS.free.historyDays;
  const locked = (d: number | null) =>
    !hasProAccess && d !== null && freeDays !== null && d > freeDays;
  return ([['latest', 'LATEST'], ['24h', '24H'], ['7d', '7D'], ['1m', '1M']] as const)
    .map(([key, label]) => ({ key, label, proOnly: locked(PERIOD_DAYS[key]) }));
}

const scoringModes: Array<{ key: ScoringMode; label: string }> = [
  { key: 'combined', label: 'COMBINED' },
  { key: 'reasoning', label: 'REASONING' },
  { key: 'speed', label: 'CODING' },
  { key: 'tooling', label: 'TOOLING' },
];

export default function ModelDetailControls({
  selectedPeriod,
  selectedScoringMode,
  hasProAccess,
  isRefreshing,
  onPeriodChange,
  onScoringModeChange,
  onShowProModal,
}: ModelDetailControlsProps) {
  const periods = periodsFor(hasProAccess);

  const handlePeriodClick = (period: typeof periods[number]) => {
    if (period.proOnly && !hasProAccess) {
      onShowProModal('historical-data');
      return;
    }
    onPeriodChange(period.key);
  };

  return (
    <div className="md-controls">
      <span className="md-ctrl-label">Period</span>
      <div className="md-ctrl-group">
        {periods.map(p => (
          <button
            key={p.key}
            className={`md-ctrl-btn ${selectedPeriod === p.key ? 'active' : ''} ${p.proOnly && !hasProAccess ? 'pro-locked' : ''}`}
            onClick={() => handlePeriodClick(p)}
            disabled={isRefreshing}
          >
            {p.label}
            {p.proOnly && !hasProAccess && <span className="lock-icon">🔒</span>}
          </button>
        ))}
      </div>

      <div className="md-ctrl-sep" />

      <span className="md-ctrl-label">Mode</span>
      <div className="md-ctrl-group">
        {scoringModes.map(m => (
          <button
            key={m.key}
            className={`md-ctrl-btn ${selectedScoringMode === m.key ? 'active' : ''}`}
            onClick={() => onScoringModeChange(m.key)}
            disabled={isRefreshing}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="md-ctrl-right">
        {isRefreshing && (
          <span style={{ fontSize: '10px', color: 'var(--amber-warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="vintage-loading" style={{ fontSize: '10px' }}></span>
            REFRESHING
          </span>
        )}
      </div>
    </div>
  );
}
