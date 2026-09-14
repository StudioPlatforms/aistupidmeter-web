'use client';

import { useCallback, useMemo, useState } from 'react';
import { bucketOf, fleetTrend, VOLATILE_STANDARD_ERROR } from '../../lib/fleet-buckets';
import StatCellDetail, { DetailEntry } from './StatCellDetail';

interface StatBarProps {
  globalIndex: any;
  modelScores: any[];
  driftIncidents?: any[];
}

const scoreOf = (m: any): number | null =>
  typeof m?.currentScore === 'number' ? Math.round(m.currentScore) : null;

/** Highest score first; a model without one sorts last. */
const byScoreDesc = (a: any, b: any) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1);

export default function StatBar({ globalIndex, modelScores, driftIncidents }: StatBarProps) {
  // Which cell's detail panel is showing. `pinned` survives a tap; `hovered` does not.
  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const closeAll = useCallback(() => { setPinned(null); setHovered(null); }, []);

  // Compute stats from real data
  const availableModels = modelScores.filter(
    m => m.currentScore !== 'unavailable' && typeof m.currentScore === 'number'
  );

  // One definition, shared with the meter and the leaderboard mark. See lib/fleet-buckets.
  const grouped = useMemo(() => {
    const g: Record<string, any[]> = { degraded: [], volatile: [], improving: [], stable: [] };
    for (const m of availableModels) g[bucketOf(m)].push(m);
    for (const k of Object.keys(g)) g[k].sort(byScoreDesc);
    return g;
  }, [availableModels]);

  const degradedCount   = grouped.degraded.length;
  const volatileCount   = grouped.volatile.length;
  const recoveringCount = grouped.improving.length;
  const stableCount     = grouped.stable.length;

  const globalScore = availableModels.length > 0
    ? Math.round(availableModels.reduce((sum: number, m: any) => sum + (m.currentScore as number), 0) / availableModels.length)
    : 0;

  const globalTrend = fleetTrend(availableModels);
  const trendSymbol = globalTrend === 'improving' ? '↗' : globalTrend === 'declining' ? '↘' : '→';

  const totalModels = modelScores.length;
  const stablePercent = totalModels > 0 ? Math.round((stableCount / totalModels) * 100) : 0;

  // ── The rows each cell reveals ────────────────────────────────────────────
  const rows = (list: any[]): DetailEntry[] =>
    list.map(m => ({ label: m.name, note: m.provider, value: scoreOf(m) ?? '—' }));

  const ranked = useMemo(() => [...availableModels].sort(byScoreDesc), [availableModels]);
  const indexEntries: DetailEntry[] = ranked.length
    ? [
        ...rows(ranked.slice(0, 3)),
        ...(ranked.length > 6 ? [{ label: `… ${ranked.length - 6} in between`, note: null, value: null }] : []),
        ...rows(ranked.slice(-3).filter(m => !ranked.slice(0, 3).includes(m))),
      ]
    : [];

  const unavailable = modelScores.filter(m => !availableModels.includes(m));
  const modelEntries: DetailEntry[] = [
    ...rows(ranked),
    ...unavailable.map(m => ({ label: m.name, note: m.provider, value: 'no score' })),
  ];

  const providerEntries: DetailEntry[] = useMemo(() => {
    const counts = new Map<string, { total: number; scored: number }>();
    for (const m of modelScores) {
      const p = m.provider ?? 'unknown';
      const c = counts.get(p) ?? { total: 0, scored: 0 };
      c.total++;
      if (scoreOf(m) != null) c.scored++;
      counts.set(p, c);
    }
    // Array.from, not spread: this project's tsconfig targets pre-ES2015 iteration.
    return Array.from(counts.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([p, c]) => ({ label: p, note: `${c.scored} scored`, value: c.total }));
  }, [modelScores]);

  const incidentEntries: DetailEntry[] = (driftIncidents ?? []).map((i: any) => ({
    label: i.modelName ?? i.model_name ?? 'unknown model',
    note: i.provider ?? null,
    value: i.severity ?? null,
  }));

  const cell = (key: string) => ({
    open: pinned === key || hovered === key,
    onHover: (v: boolean) => setHovered(v ? key : null),
    onToggle: () => { setPinned(p => (p === key ? null : key)); setHovered(null); },
    onClose: closeAll,
  });

  const indexColor = globalScore >= 70 ? 'var(--phosphor-green)' : globalScore >= 50 ? 'var(--amber-warning)' : 'var(--red-alert)';

  return (
    <div className="v4-stat-bar">
      <StatCellDetail
        id="stat-index"
        className={`v4-stat-cell ${globalScore >= 70 ? 'color-green' : globalScore >= 50 ? 'color-amber' : 'color-red'}`}
        title="Mean score of the models listed below, for the period and benchmark currently selected."
        label="GLOBAL INDEX"
        value={<span style={{ color: indexColor }}>{globalScore || '—'}</span>}
        detail={<>{trendSymbol} {globalTrend}</>}
        caption={`Mean of ${availableModels.length} scored model${availableModels.length === 1 ? '' : 's'} — highest and lowest`}
        entries={indexEntries}
        emptyText="No scored models in this view."
        {...cell('index')}
      />

      <StatCellDetail
        id="stat-stable"
        className="v4-stat-cell color-green"
        title="Neither trending, nor noisy enough to flag. One model counts in exactly one of these four, for the period and benchmark currently selected. This is a summary of the board below — the formal drift regime, computed from a model's own history, is on the drift monitor."
        label="STABLE"
        value={<span style={{ color: 'var(--phosphor-green)' }}>{stableCount}</span>}
        detail={`${stablePercent}% of fleet`}
        caption="Holding steady — not trending, not noisy"
        entries={rows(grouped.stable)}
        emptyText="No model is currently steady in this view."
        {...cell('stable')}
      />

      <StatCellDetail
        id="stat-volatile"
        className={`v4-stat-cell ${volatileCount > 0 ? 'color-amber' : 'color-green'}`}
        title={`Standard error of ${VOLATILE_STANDARD_ERROR} points or more across recent runs, against a fleet median near 3. Genuinely noisy, not merely declining.`}
        label="VOLATILE"
        value={<span style={{ color: volatileCount > 0 ? 'var(--amber-warning)' : 'var(--phosphor-green)' }}>{volatileCount}</span>}
        detail={volatileCount > 0 ? 'high variance' : 'all clear'}
        caption={`Standard error ≥ ${VOLATILE_STANDARD_ERROR} points across recent runs`}
        entries={rows(grouped.volatile)}
        emptyText="No model is unusually noisy right now."
        {...cell('volatile')}
      />

      <StatCellDetail
        id="stat-degraded"
        className={`v4-stat-cell ${degradedCount > 0 ? 'color-red' : 'color-green'}`}
        title="Score moved down since the previous measurement, in the period and benchmark currently selected."
        label="DEGRADED"
        value={<span style={{ color: degradedCount > 0 ? 'var(--red-alert)' : 'var(--phosphor-green)' }}>{degradedCount}</span>}
        detail={degradedCount > 0 ? 'needs attention' : 'none'}
        caption="Scored lower than at the previous measurement"
        entries={rows(grouped.degraded)}
        emptyText="No model scored lower than last time."
        {...cell('degraded')}
      />

      <StatCellDetail
        id="stat-improving"
        className={`v4-stat-cell ${recoveringCount > 0 ? 'color-blue' : 'color-green'}`}
        title="Score moved up since the previous measurement. Not the same as 'recovering', which would require knowing it had been down."
        label="IMPROVING"
        value={<span style={{ color: recoveringCount > 0 ? '#1a73e8' : 'var(--phosphor-green)' }}>{recoveringCount}</span>}
        detail={recoveringCount > 0 ? 'trending up' : 'none'}
        caption="Scored higher than at the previous measurement"
        entries={rows(grouped.improving)}
        emptyText="No model scored higher than last time."
        {...cell('improving')}
      />

      <StatCellDetail
        id="stat-models"
        className="v4-stat-cell color-green"
        label="MODELS"
        value={<span style={{ color: 'var(--phosphor-green)' }}>{totalModels}</span>}
        detail={`${availableModels.length} active`}
        caption={`${availableModels.length} scored, ${unavailable.length} without a score in this view`}
        entries={modelEntries}
        emptyText="No models tracked."
        {...cell('models')}
      />

      <StatCellDetail
        id="stat-incidents"
        className="v4-stat-cell color-green"
        label="INCIDENTS"
        value={
          <span style={{ color: (driftIncidents?.length || 0) > 0 ? 'var(--amber-warning)' : 'var(--phosphor-green)' }}>
            {driftIncidents?.length || 0}
          </span>
        }
        detail="last 24h"
        caption="Drift incidents recorded in the last 24 hours"
        entries={incidentEntries}
        emptyText="No incidents in the last 24 hours."
        {...cell('incidents')}
      />

      <StatCellDetail
        id="stat-providers"
        className="v4-stat-cell color-green"
        label="PROVIDERS"
        value={<span style={{ color: 'var(--phosphor-green)' }}>{providerEntries.length}</span>}
        detail="monitored"
        caption="Providers on the board, and how many of their models are scored"
        entries={providerEntries}
        emptyText="No providers tracked."
        {...cell('providers')}
      />
    </div>
  );
}
