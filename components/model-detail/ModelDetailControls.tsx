'use client';

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

const periods: Array<{ key: HistoricalPeriod; label: string; proOnly: boolean }> = [
  { key: 'latest', label: 'LATEST', proOnly: false },
  { key: '24h', label: '24H', proOnly: true },
  { key: '7d', label: '7D', proOnly: true },
  { key: '1m', label: '1M', proOnly: true },
];

const scoringModes: Array<{ key: ScoringMode; label: string }> = [
  { key: 'combined', label: 'COMBINED' },
  { key: 'reasoning', label: 'REASONING' },
  { key: 'speed', label: '7AXIS' },
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
