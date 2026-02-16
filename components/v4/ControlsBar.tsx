'use client';

interface ControlsBarProps {
  leaderboardPeriod: 'latest' | '24h' | '7d' | '1m';
  leaderboardSortBy: 'combined' | 'reasoning' | 'speed' | 'tooling' | 'price';
  dashboardMode: 'leaderboard' | 'drift';
  hasProAccess: boolean;
  isLoading: boolean;
  onPeriodChange: (period: 'latest' | '24h' | '7d' | '1m') => void;
  onSortByChange: (sortBy: 'combined' | 'reasoning' | 'speed' | 'tooling' | 'price') => void;
  onModeChange: (mode: 'leaderboard' | 'drift') => void;
  onShowProModal: (feature: 'historical-data' | 'performance-matrix') => void;
}

export default function ControlsBar({
  leaderboardPeriod,
  leaderboardSortBy,
  dashboardMode,
  hasProAccess,
  isLoading,
  onPeriodChange,
  onSortByChange,
  onModeChange,
  onShowProModal,
}: ControlsBarProps) {
  const periods: Array<{ key: 'latest' | '24h' | '7d' | '1m'; label: string; proOnly: boolean }> = [
    { key: 'latest', label: 'LATEST', proOnly: false },
    { key: '24h', label: '24H', proOnly: true },
    { key: '7d', label: '7D', proOnly: true },
    { key: '1m', label: '1M', proOnly: true },
  ];

  const sortModes: Array<{ key: 'combined' | 'reasoning' | 'speed' | 'tooling' | 'price'; label: string; proOnly: boolean }> = [
    { key: 'combined', label: 'COMBINED', proOnly: false },
    { key: 'reasoning', label: 'REASONING', proOnly: true },
    { key: 'speed', label: '7AXIS', proOnly: true },
    { key: 'tooling', label: 'TOOLING', proOnly: true },
    { key: 'price', label: 'PRICE', proOnly: false },
  ];

  const handlePeriodClick = (period: typeof periods[number]) => {
    if (period.proOnly && !hasProAccess) {
      onShowProModal('historical-data');
      return;
    }
    onPeriodChange(period.key);
  };

  const handleSortClick = (sort: typeof sortModes[number]) => {
    if (sort.proOnly && !hasProAccess) {
      onShowProModal('performance-matrix');
      return;
    }
    onSortByChange(sort.key);
  };

  return (
    <div className="v4-controls">
      <span className="v4-ctrl-label">Period</span>
      <div className="v4-ctrl-group">
        {periods.map(p => (
          <button
            key={p.key}
            className={`v4-ctrl-btn ${leaderboardPeriod === p.key ? 'active' : ''} ${p.proOnly && !hasProAccess ? 'pro-locked' : ''}`}
            onClick={() => handlePeriodClick(p)}
            disabled={isLoading}
          >
            {p.label}
            {p.proOnly && !hasProAccess && <span className="lock-icon">🔒</span>}
          </button>
        ))}
      </div>

      <div className="v4-ctrl-sep"></div>

      <span className="v4-ctrl-label">Sort</span>
      <div className="v4-ctrl-group">
        {sortModes.map(s => (
          <button
            key={s.key}
            className={`v4-ctrl-btn ${leaderboardSortBy === s.key ? 'active' : ''} ${s.proOnly && !hasProAccess ? 'pro-locked' : ''}`}
            onClick={() => handleSortClick(s)}
            disabled={isLoading}
          >
            {s.label}
            {s.proOnly && !hasProAccess && <span className="lock-icon">🔒</span>}
          </button>
        ))}
      </div>

      <div className="v4-ctrl-right">
        <div style={{ display: 'flex', gap: '1px' }}>
          <button
            className={`v4-mode-btn ${dashboardMode === 'leaderboard' ? 'active' : ''}`}
            onClick={() => onModeChange('leaderboard')}
          >
            LEADERBOARD
          </button>
          <button
            className={`v4-mode-btn ${dashboardMode === 'drift' ? 'active' : ''}`}
            onClick={() => onModeChange('drift')}
          >
            DRIFT MONITOR
          </button>
        </div>
      </div>
    </div>
  );
}
