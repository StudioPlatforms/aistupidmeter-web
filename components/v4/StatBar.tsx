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
  
  // These four buckets used to overlap and mislabel.
  //
  // "Stable" counted trend 'stable' OR 'up', and "recovering" counted trend 'up' again, so a
  // model that was improving was counted twice: 21 stable + 3 volatile + 3 recovering on a
  // fleet of 24. "Volatile" meant trend === 'down', while the caption under it read "high
  // variance" — a different thing entirely, and one we actually measure.
  //
  // Now: one model, one bucket, and the words mean what they say. Ordered by what a reader
  // needs to see first, so a model that is both declining and noisy is reported as declining.
  const VOLATILE_SE = 8;   // Fleet median standard error is ~3; this is the noisy tail.

  const bucketOf = (m: any): 'degraded' | 'volatile' | 'improving' | 'stable' => {
    if (m.trend === 'down') return 'degraded';
    if (typeof m.standardError === 'number' && m.standardError >= VOLATILE_SE) return 'volatile';
    if (m.trend === 'up') return 'improving';
    return 'stable';
  };

  const buckets = availableModels.map(bucketOf);
  const degradedCount   = buckets.filter(b => b === 'degraded').length;
  const volatileCount   = buckets.filter(b => b === 'volatile').length;
  const recoveringCount = buckets.filter(b => b === 'improving').length;
  const stableCount     = buckets.filter(b => b === 'stable').length;

  // The headline must be the mean of the rows actually shown. It used to come from
  // /global-index, which takes no period or sort parameter and always reports the same
  // 24-hour combined figure — so selecting "tooling" moved every row on the board while the
  // number above it did not, and the two disagreed by six points.
  const globalScore = availableModels.length > 0
    ? Math.round(availableModels.reduce((sum: number, m: any) => sum + (m.currentScore as number), 0) / availableModels.length)
    : 0;

  const globalTrend = globalIndex?.trend || 'stable';
  const trendSymbol = globalTrend === 'improving' ? '↗' : globalTrend === 'declining' ? '↘' : '→';

  const totalModels = modelScores.length;
  const stablePercent = totalModels > 0 ? Math.round((stableCount / totalModels) * 100) : 0;

  return (
    <div className="v4-stat-bar">
      <div className={`v4-stat-cell ${globalScore >= 70 ? 'color-green' : globalScore >= 50 ? 'color-amber' : 'color-red'}`}
           title="Mean score of the models listed below, for the period and benchmark currently selected.">
        <div className="v4-stat-label">GLOBAL INDEX</div>
        <div className="v4-stat-value" style={{ color: globalScore >= 70 ? 'var(--phosphor-green)' : globalScore >= 50 ? 'var(--amber-warning)' : 'var(--red-alert)' }}>
          {globalScore || '—'}
        </div>
        <div className="v4-stat-detail">{trendSymbol} {globalTrend}</div>
      </div>

      <div className="v4-stat-cell color-green"
           title="Neither trending, nor noisy enough to flag. One model counts in exactly one of these four.">
        <div className="v4-stat-label">STABLE</div>
        <div className="v4-stat-value" style={{ color: 'var(--phosphor-green)' }}>{stableCount}</div>
        <div className="v4-stat-detail">{stablePercent}% of fleet</div>
      </div>

      <div className={`v4-stat-cell ${volatileCount > 0 ? 'color-amber' : 'color-green'}`}
           title="Standard error of 8 points or more across recent runs, against a fleet median near 3. Genuinely noisy, not merely declining.">
        <div className="v4-stat-label">VOLATILE</div>
        <div className="v4-stat-value" style={{ color: volatileCount > 0 ? 'var(--amber-warning)' : 'var(--phosphor-green)' }}>{volatileCount}</div>
        <div className="v4-stat-detail">{volatileCount > 0 ? 'high variance' : 'all clear'}</div>
      </div>

      <div className={`v4-stat-cell ${degradedCount > 0 ? 'color-red' : 'color-green'}`}
           title="Score moved down since the previous measurement, in the period and benchmark currently selected.">
        <div className="v4-stat-label">DEGRADED</div>
        <div className="v4-stat-value" style={{ color: degradedCount > 0 ? 'var(--red-alert)' : 'var(--phosphor-green)' }}>{degradedCount}</div>
        <div className="v4-stat-detail">{degradedCount > 0 ? 'needs attention' : 'none'}</div>
      </div>

      <div className={`v4-stat-cell ${recoveringCount > 0 ? 'color-blue' : 'color-green'}`}
           title="Score moved up since the previous measurement. Not the same as 'recovering', which would require knowing it had been down.">
        <div className="v4-stat-label">IMPROVING</div>
        <div className="v4-stat-value" style={{ color: recoveringCount > 0 ? '#1a73e8' : 'var(--phosphor-green)' }}>{recoveringCount}</div>
        <div className="v4-stat-detail">{recoveringCount > 0 ? 'trending up' : 'none'}</div>
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
