'use client';

import { useCallback, useMemo, useState } from 'react';
import { bucketOf, fleetTrend, VOLATILE_STANDARD_ERROR } from '../../lib/fleet-buckets';
import StatCellDetail, { DetailEntry, type StatCellClasses } from './StatCellDetail';
import CountUp from '../studio/CountUp';
import '../../styles/studio-board.css';

interface StatBarProps {
  globalIndex: any;
  modelScores: any[];
  driftIncidents?: any[];
}

const scoreOf = (m: any): number | null =>
  typeof m?.currentScore === 'number' ? Math.round(m.currentScore) : null;

/** Highest score first; a model without one sorts last. */
const byScoreDesc = (a: any, b: any) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1);

/** The studio stat look (styles/studio-board.css): the number first, in the display face. */
const CELL: StatCellClasses = { value: 'sb-stat-v', label: 'sb-stat-l', detail: 'sb-stat-s', more: 'sb-stat-more' };

/** Colour only what needs a look; a healthy figure stays in ink. */
const cellClass = (tone?: 'warn' | 'bad' | 'accent') => `sb-stat${tone ? ` is-${tone}` : ''}`;

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

  // Ink at 70 and above (the old "phosphor" colour was the theme's ink), amber from 50, red below;
  // no score at all is a dash, not a warning.
  const indexTone = !globalScore || globalScore >= 70 ? undefined : globalScore >= 50 ? 'warn' : 'bad';
  const trendTone = globalTrend === 'improving' ? ' is-good' : globalTrend === 'declining' ? ' is-bad' : '';
  const incidents = driftIncidents?.length || 0;

  return (
    // The wrapper only draws the phone strip's "more this way" fade; the card is .sb-stats.
    <div className="sb-stats-wrap">
    <div className="sb-stats" role="group" aria-label="Fleet summary">
      <StatCellDetail
        id="stat-index"
        className={cellClass(indexTone as 'warn' | 'bad' | undefined)}
        classes={CELL}
        valueFirst
        title="Mean score of the models listed below, for the period and benchmark currently selected."
        label="Global index"
        value={globalScore ? <CountUp value={globalScore} /> : '—'}
        detail={<span className={`sb-trend${trendTone}`}>{trendSymbol} {globalTrend}</span>}
        caption={`Mean of ${availableModels.length} scored model${availableModels.length === 1 ? '' : 's'} — highest and lowest`}
        entries={indexEntries}
        emptyText="No scored models in this view."
        {...cell('index')}
      />

      <StatCellDetail
        id="stat-stable"
        className={cellClass()}
        classes={CELL}
        valueFirst
        title="Neither trending, nor noisy enough to flag. One model counts in exactly one of these four, for the period and benchmark currently selected. This is a summary of the board below — the formal drift regime, computed from a model's own history, is on the drift monitor."
        label="Stable"
        value={<CountUp value={stableCount} />}
        detail={`${stablePercent}% of fleet`}
        caption="Holding steady — not trending, not noisy"
        entries={rows(grouped.stable)}
        emptyText="No model is currently steady in this view."
        {...cell('stable')}
      />

      <StatCellDetail
        id="stat-volatile"
        className={cellClass(volatileCount > 0 ? 'warn' : undefined)}
        classes={CELL}
        valueFirst
        title={`Standard error of ${VOLATILE_STANDARD_ERROR} points or more across recent runs, against a fleet median near 3. Genuinely noisy, not merely declining.`}
        label="Volatile"
        value={<CountUp value={volatileCount} />}
        detail={volatileCount > 0 ? 'high variance' : 'all clear'}
        caption={`Standard error ≥ ${VOLATILE_STANDARD_ERROR} points across recent runs`}
        entries={rows(grouped.volatile)}
        emptyText="No model is unusually noisy right now."
        {...cell('volatile')}
      />

      <StatCellDetail
        id="stat-degraded"
        className={cellClass(degradedCount > 0 ? 'bad' : undefined)}
        classes={CELL}
        valueFirst
        title="Its latest runs on the selected benchmark score clearly below its own recent baseline: the median of its last day of coding runs (or last three daily reasoning or tool-use runs) is more than 5 points under the runs before them, and by more than its normal run-to-run variation. Only runs on the current benchmark configuration are compared."
        label="Degraded"
        value={<CountUp value={degradedCount} />}
        detail={degradedCount > 0 ? 'needs attention' : 'none'}
        caption="Clearly below its own recent baseline"
        entries={rows(grouped.degraded)}
        emptyText="No model is clearly below its own recent baseline."
        {...cell('degraded')}
      />

      <StatCellDetail
        id="stat-improving"
        className={cellClass(recoveringCount > 0 ? 'accent' : undefined)}
        classes={CELL}
        valueFirst
        title="Its latest runs on the selected benchmark score clearly above its own recent baseline, by the same test. Not the same as 'recovering', which would require knowing it had been down."
        label="Improving"
        value={<CountUp value={recoveringCount} />}
        detail={recoveringCount > 0 ? 'trending up' : 'none'}
        caption="Clearly above its own recent baseline"
        entries={rows(grouped.improving)}
        emptyText="No model is clearly above its own recent baseline."
        {...cell('improving')}
      />

      <StatCellDetail
        id="stat-models"
        className={cellClass()}
        classes={CELL}
        valueFirst
        label="Models"
        value={<CountUp value={totalModels} />}
        detail={`${availableModels.length} active`}
        caption={`${availableModels.length} scored, ${unavailable.length} without a score in this view`}
        entries={modelEntries}
        emptyText="No models tracked."
        {...cell('models')}
      />

      <StatCellDetail
        id="stat-incidents"
        className={cellClass(incidents > 0 ? 'warn' : undefined)}
        classes={CELL}
        valueFirst
        label="Incidents"
        value={<CountUp value={incidents} />}
        detail="last 24h"
        caption="Drift incidents recorded in the last 24 hours"
        entries={incidentEntries}
        emptyText="No incidents in the last 24 hours."
        {...cell('incidents')}
      />

      <StatCellDetail
        id="stat-providers"
        className={cellClass()}
        classes={CELL}
        valueFirst
        label="Providers"
        value={<CountUp value={providerEntries.length} />}
        detail="monitored"
        caption="Providers on the board, and how many of their models are scored"
        entries={providerEntries}
        emptyText="No providers tracked."
        {...cell('providers')}
      />
    </div>
    </div>
  );
}
