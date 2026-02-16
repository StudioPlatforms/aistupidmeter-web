'use client';

interface StatBarProps {
  globalIndex: any;
  modelScores: any[];
  driftIncidents?: any[];
}

export default function StatBar({ globalIndex, modelScores, driftIncidents }: StatBarProps) {
  // Compute stats from real data
  const availableModels = modelScores.filter(
    m => m.currentScore !== 'unavailable' && typeof m.currentScore === 'number'
  );
  
  const stableCount = availableModels.filter(m => m.trend === 'stable' || m.trend === 'up').length;
  const volatileCount = availableModels.filter(m => {
    if (typeof m.currentScore !== 'number') return false;
    // Volatile = score between 50-70 and trending down, or high variance
    return m.trend === 'down' && m.currentScore >= 50;
  }).length;
  const degradedCount = availableModels.filter(m => {
    if (typeof m.currentScore !== 'number') return false;
    return m.currentScore < 50 || (m.trend === 'down' && m.currentScore < 60);
  }).length;
  const recoveringCount = availableModels.filter(m => m.trend === 'up' && typeof m.currentScore === 'number' && m.currentScore < 75).length;

  const globalScore = globalIndex?.current?.globalScore || 
    (availableModels.length > 0 
      ? Math.round(availableModels.reduce((sum: number, m: any) => sum + (m.currentScore as number), 0) / availableModels.length) 
      : 0);

  const globalTrend = globalIndex?.trend || 'stable';
  const trendSymbol = globalTrend === 'improving' ? '↗' : globalTrend === 'declining' ? '↘' : '→';

  const totalModels = modelScores.length;
  const stablePercent = totalModels > 0 ? Math.round((stableCount / totalModels) * 100) : 0;

  return (
    <div className="v4-stat-bar">
      <div className={`v4-stat-cell ${globalScore >= 70 ? 'color-green' : globalScore >= 50 ? 'color-amber' : 'color-red'}`}>
        <div className="v4-stat-label">GLOBAL INDEX</div>
        <div className="v4-stat-value" style={{ color: globalScore >= 70 ? 'var(--phosphor-green)' : globalScore >= 50 ? 'var(--amber-warning)' : 'var(--red-alert)' }}>
          {globalScore || '—'}
        </div>
        <div className="v4-stat-detail">{trendSymbol} {globalTrend}</div>
      </div>

      <div className="v4-stat-cell color-green">
        <div className="v4-stat-label">STABLE</div>
        <div className="v4-stat-value" style={{ color: 'var(--phosphor-green)' }}>{stableCount}</div>
        <div className="v4-stat-detail">{stablePercent}% of fleet</div>
      </div>

      <div className={`v4-stat-cell ${volatileCount > 0 ? 'color-amber' : 'color-green'}`}>
        <div className="v4-stat-label">VOLATILE</div>
        <div className="v4-stat-value" style={{ color: volatileCount > 0 ? 'var(--amber-warning)' : 'var(--phosphor-green)' }}>{volatileCount}</div>
        <div className="v4-stat-detail">{volatileCount > 0 ? 'high variance' : 'all clear'}</div>
      </div>

      <div className={`v4-stat-cell ${degradedCount > 0 ? 'color-red' : 'color-green'}`}>
        <div className="v4-stat-label">DEGRADED</div>
        <div className="v4-stat-value" style={{ color: degradedCount > 0 ? 'var(--red-alert)' : 'var(--phosphor-green)' }}>{degradedCount}</div>
        <div className="v4-stat-detail">{degradedCount > 0 ? 'needs attention' : 'none'}</div>
      </div>

      <div className={`v4-stat-cell ${recoveringCount > 0 ? 'color-blue' : 'color-green'}`}>
        <div className="v4-stat-label">RECOVERING</div>
        <div className="v4-stat-value" style={{ color: recoveringCount > 0 ? '#00BFFF' : 'var(--phosphor-green)' }}>{recoveringCount}</div>
        <div className="v4-stat-detail">{recoveringCount > 0 ? 'improving' : 'none'}</div>
      </div>

      <div className="v4-stat-cell color-green">
        <div className="v4-stat-label">MODELS</div>
        <div className="v4-stat-value" style={{ color: 'var(--phosphor-green)' }}>{totalModels}</div>
        <div className="v4-stat-detail">{availableModels.length} active</div>
      </div>

      <div className="v4-stat-cell color-green">
        <div className="v4-stat-label">INCIDENTS</div>
        <div className="v4-stat-value" style={{ color: (driftIncidents?.length || 0) > 0 ? 'var(--amber-warning)' : 'var(--phosphor-green)' }}>
          {driftIncidents?.length || 0}
        </div>
        <div className="v4-stat-detail">last 24h</div>
      </div>

      <div className="v4-stat-cell color-green">
        <div className="v4-stat-label">PROVIDERS</div>
        <div className="v4-stat-value" style={{ color: 'var(--phosphor-green)' }}>
          {new Set(modelScores.map(m => m.provider)).size}
        </div>
        <div className="v4-stat-detail">monitored</div>
      </div>
    </div>
  );
}
