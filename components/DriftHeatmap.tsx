/**
 * Drift by dimension - the model x axis matrix under the Drift Monitor.
 *
 * WHAT CHANGED AND WHY. The previous version rendered one emoji per cell for four of
 * the seven axes: every cell was 🟢/🟡/🔴 and nothing else. Two problems, both fatal
 * for a monitor:
 *
 *   1. It threw the measurement away. The API returns `changeMagnitude` (a signed
 *      percentage) and `trend` for every axis, and neither was displayed - so the panel
 *      could tell you a dimension was "stable" but never how far it had moved or which
 *      way. Drift is a change; the change was the one thing missing.
 *   2. The signal was invisible. 161 of 168 readings are STABLE, so the grid was a wall
 *      of identical green in which the ~4% of cells that actually moved looked exactly
 *      like the 96% that did not.
 *
 * Now each cell shows the signed change as a number, tinted on a diverging scale, with
 * near-zero rendered untinted so the movers are the only thing with colour on screen.
 * Rows sort by largest movement, so the worst offender is the first row rather than
 * something you find by reading all 24.
 *
 * COLOUR. The diverging pair is blue (improved) <-> red (declined), which is measured
 * as colourblind-safe: red<->green scored ΔE 5.0 under deuteranopia (a fail), red<->blue
 * scores 29.1 (a pass). Red<->amber, which the old status emoji relied on to separate
 * DEGRADED from VOLATILE, scores 1.5 - effectively one colour. The signed number is in
 * every cell regardless, so colour is reinforcement and never the only encoding.
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { slugifyModelName } from '../lib/model-slug';
import '../styles/drift-cards.css';

interface AxisReading {
  status: 'STABLE' | 'VOLATILE' | 'DEGRADED';
  value: number;
  /** Signed percentage change against the model's own baseline. */
  changeMagnitude?: number;
  trend?: 'up' | 'down' | 'stable';
  /** 0 means the API had no observation for this axis. */
  sampleSize?: number;
}

interface DriftStatus {
  modelId: number;
  modelName: string;
  provider: string;
  regime: 'STABLE' | 'VOLATILE' | 'DEGRADED' | 'RECOVERING';
  driftStatus: 'NORMAL' | 'WARNING' | 'ALERT';
  axes: { [key: string]: AxisReading };
  dataSource?: 'measured' | 'synthetic' | 'unknown';
  axesSource?: 'measured' | 'synthetic' | 'none';
}

interface HeatmapProps {
  models: { id: string; name: string; provider: string }[];
}

/** All seven axes the API scores. The old table showed four of them. */
const AXES = [
  { key: 'correctness', label: 'Correctness', short: 'Corr' },
  { key: 'spec',        label: 'Spec',        short: 'Spec' },
  { key: 'codeQuality', label: 'Code quality',short: 'Code' },
  { key: 'efficiency',  label: 'Efficiency',  short: 'Effic' },
  { key: 'stability',   label: 'Stability',   short: 'Stab' },
  { key: 'refusal',     label: 'Refusal',     short: 'Ref' },
  { key: 'recovery',    label: 'Recovery',    short: 'Recov' },
] as const;

/**
 * Where the colour scale saturates. The observed spread is -21..+23 with p95 at 10,
 * so 12 puts almost everything on-scale and lets the genuine outliers peg the end
 * instead of compressing the middle into mush.
 */
const SCALE_MAX = 12;
/** Below this a reading is noise, and tinting it would drown the real movers. */
const TINT_FLOOR = 2;
/**
 * Fewer runs than this and there is nothing to compare against yet, so the API returns
 * changeMagnitude 0. Rendering that as a measured "0" claims we looked and found no
 * movement, when the truth is that we cannot tell yet - so these cells render as "–".
 */
const MIN_RUNS = 3;

export default function DriftHeatmap({ models }: HeatmapProps) {
  const router = useRouter();
  const [driftData, setDriftData] = useState<DriftStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<string>('__movement');
  const [measuredOnly, setMeasuredOnly] = useState(false);

  useEffect(() => {
    const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
    const modelIds = new Set(models.map(m => m.id));

    fetch(`${apiUrl}/api/drift/batch`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const rows: DriftStatus[] = [];
          for (const item of data.data) {
            if (modelIds.has(String(item.modelId)) && item.data) {
              const model = models.find(m => m.id === String(item.modelId));
              rows.push({
                modelId: item.modelId,
                modelName: item.modelName || model?.name || `Model ${item.modelId}`,
                provider: model?.provider || '',
                regime: item.data.regime || 'STABLE',
                driftStatus: item.data.driftStatus || 'NORMAL',
                axes: item.data.axes || {},
                dataSource: item.data.dataSource,
                axesSource: item.data.axesSource,
              });
            }
          }
          setDriftData(rows);
        }
        setLoading(false);
      })
      .catch(error => {
        console.error('Failed to load drift matrix:', error);
        setLoading(false);
      });
  }, [models]);

  // NOTE: axesSource, not dataSource. This table is entirely about the axis breakdown,
  // and the two can disagree — glm-5.2 has a measured score series but a modelled
  // breakdown, so filtering on dataSource would leave modelled numbers on screen under
  // a "measured only" label.
  const visible = useMemo(
    () => (measuredOnly ? driftData.filter(d => d.axesSource === 'measured') : driftData),
    [driftData, measuredOnly]
  );

  const sorted = useMemo(() => {
    const rows = [...visible];
    if (sortKey === '__movement') {
      // Biggest mover first: a monitor should open on whatever needs attention.
      return rows.sort((a, b) => biggestMove(b) - biggestMove(a));
    }
    if (sortKey === '__name') {
      return rows.sort((a, b) => a.modelName.localeCompare(b.modelName));
    }
    // Sorting by a dimension puts the steepest decline at the top.
    return rows.sort((a, b) => changeOf(a, sortKey) - changeOf(b, sortKey));
  }, [visible, sortKey]);

  const summary = useMemo(() => {
    const moved = visible.reduce(
      (n, m) => n + AXES.filter(a => measured(m.axes[a.key]) && m.axes[a.key].status !== 'STABLE').length,
      0
    );
    return {
      total: visible.length,
      stable: visible.filter(m => m.regime === 'STABLE').length,
      watch: visible.filter(m => m.regime !== 'STABLE').length,
      moved,
      measuredCount: driftData.filter(d => d.axesSource === 'measured').length,
      modelledCount: driftData.filter(d => d.axesSource !== 'measured').length,
      // Models whose every axis is still below the run threshold: real data, just not
      // enough of it yet. Worth stating, because they render as a row of "–".
      warmingUp: visible.filter(m => AXES.every(a => !comparable(m.axes[a.key]))).length,
    };
  }, [visible, driftData]);

  if (loading) {
    return (
      <div className="drift-heatmap">
        <div className="dm-empty">Loading drift readings…</div>
      </div>
    );
  }

  if (driftData.length === 0) {
    return (
      <div className="drift-heatmap">
        <div className="dm-empty">No drift data available</div>
      </div>
    );
  }

  return (
    <div className="drift-heatmap dm">
      <div className="dm-head">
        <div>
          <h3 className="dm-title">Drift by dimension</h3>
          <p className="dm-sub">
            How far each model has moved from its own baseline on every scored dimension.
            Positive is better than baseline, negative is worse.
          </p>
        </div>
        {summary.modelledCount > 0 && (
          <button
            type="button"
            className={`dm-toggle${measuredOnly ? ' is-on' : ''}`}
            onClick={() => setMeasuredOnly(v => !v)}
            title="Hide rows whose dimension figures are modelled while live benchmarking is paused"
          >
            {measuredOnly ? 'Showing measured only' : 'Hide modelled'}
          </button>
        )}
      </div>

      {/* Headline numbers first - the panel should answer "is anything wrong?" before
          asking anyone to read a grid. */}
      <div className="dm-kpis">
        <div className="dm-kpi">
          <div className="dm-kpi-val">{summary.total}</div>
          <div className="dm-kpi-lab">Models tracked</div>
        </div>
        <div className="dm-kpi">
          <div className="dm-kpi-val">{summary.stable}</div>
          <div className="dm-kpi-lab">Holding steady</div>
        </div>
        <div className={`dm-kpi${summary.watch ? ' is-watch' : ''}`}>
          <div className="dm-kpi-val">{summary.watch}</div>
          <div className="dm-kpi-lab">Need watching</div>
        </div>
        <div className={`dm-kpi${summary.moved ? ' is-watch' : ''}`}>
          <div className="dm-kpi-val">{summary.moved}</div>
          <div className="dm-kpi-lab">Readings off baseline</div>
        </div>
      </div>

      {summary.warmingUp > 0 && (
        <p className="dm-note">
          {summary.warmingUp} {summary.warmingUp === 1 ? 'model has' : 'models have'} fewer than {MIN_RUNS} benchmark
          runs so far, so there is nothing to compare against yet. Those rows show
          <span className="dm-note-dash"> – </span> rather than a change of zero.
        </p>
      )}

      <div className="dm-scroll">
        <table className="dm-table">
          <thead>
            <tr>
              <th className="dm-th-model">
                <button type="button" className="dm-sort" onClick={() => setSortKey('__name')}>
                  Model
                </button>
              </th>
              <th className="dm-th-status">Status</th>
              {AXES.map(a => (
                <th key={a.key} className="dm-th-axis">
                  <button
                    type="button"
                    className={`dm-sort${sortKey === a.key ? ' is-active' : ''}`}
                    onClick={() => setSortKey(a.key)}
                    title={`Sort by ${a.label}, steepest decline first`}
                  >
                    <span className="dm-axis-full">{a.label}</span>
                    <span className="dm-axis-short">{a.short}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(m => (
              <tr
                key={m.modelId}
                onClick={() => router.push(`/models/${slugifyModelName(m.modelName)}`)}
                title={`Open ${m.modelName}`}
              >
                <td className="dm-model">
                  <span className="dm-model-name">{m.modelName}</span>
                  <span className="dm-model-meta">
                    {m.provider}
                    {m.axesSource !== 'measured' && (
                      <span
                        className="dm-modelled"
                        title="These dimension figures are modelled while live benchmarking is paused - they are not evidence of real drift."
                      >
                        modelled
                      </span>
                    )}
                  </span>
                </td>
                <td className="dm-status-cell">
                  <span className={`dm-pill dm-pill--${m.regime.toLowerCase()}`}>
                    {regimeLabel(m.regime)}
                  </span>
                </td>
                {AXES.map(a => {
                  const axis = m.axes[a.key];
                  const ok = comparable(axis);
                  const change = ok ? Math.round(axis?.changeMagnitude ?? 0) : null;
                  return (
                    <td
                      key={a.key}
                      className={`dm-cell${ok && axis?.status !== 'STABLE' ? ' is-flagged' : ''}`}
                      style={ok ? tintFor(change as number) : undefined}
                      title={cellTitle(m.modelName, a.label, axis)}
                    >
                      {ok
                        ? (change === 0 ? <span className="dm-flat">0</span> : signed(change as number))
                        : <span className="dm-none">{measured(axis) ? '–' : '·'}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Below ~700px a 7-column matrix can only be read by scrolling sideways, so the
          same data is re-cut as one card per model listing just the dimensions that
          actually moved - which is what the matrix is scanned for anyway. */}
      <div className="dm-cards">
        {sorted.map(m => {
          const movers = AXES
            .map(a => ({ ...a, axis: m.axes[a.key] }))
            .filter(x => comparable(x.axis) && Math.abs(Math.round(x.axis?.changeMagnitude ?? 0)) >= TINT_FLOOR)
            .sort((x, y) => Math.abs(y.axis?.changeMagnitude ?? 0) - Math.abs(x.axis?.changeMagnitude ?? 0));
          const tooFew = AXES.every(a => !comparable(m.axes[a.key]));
          return (
            <div
              className="dm-card"
              key={m.modelId}
              onClick={() => router.push(`/models/${slugifyModelName(m.modelName)}`)}
            >
              <div className="dm-card-top">
                <div className="dm-card-id">
                  <span className="dm-model-name">{m.modelName}</span>
                  <span className="dm-model-meta">
                    {m.provider}
                    {m.axesSource !== 'measured' && <span className="dm-modelled">modelled</span>}
                  </span>
                </div>
                <span className={`dm-pill dm-pill--${m.regime.toLowerCase()}`}>{regimeLabel(m.regime)}</span>
              </div>
              {tooFew ? (
                <div className="dm-card-none">Not enough runs yet to measure change</div>
              ) : movers.length === 0 ? (
                <div className="dm-card-none">No dimension has moved from baseline</div>
              ) : (
                <div className="dm-chips">
                  {movers.map(x => {
                    const change = Math.round(x.axis?.changeMagnitude ?? 0);
                    return (
                      <span
                        key={x.key}
                        className={`dm-chip${x.axis?.status !== 'STABLE' ? ' is-flagged' : ''}`}
                        style={tintFor(change)}
                      >
                        <span className="dm-chip-lab">{x.label}</span>
                        <b>{signed(change)}</b>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="dm-legend">
        <div className="dm-legend-scale">
          <span className="dm-legend-cap">Declined</span>
          <span className="dm-ramp" aria-hidden="true" />
          <span className="dm-legend-cap">Improved</span>
        </div>
        <div className="dm-legend-ticks" aria-hidden="true">
          <span>-{SCALE_MAX}%</span><span>0</span><span>+{SCALE_MAX}%</span>
        </div>
        <div className="dm-legend-notes">
          <span><span className="dm-legend-flag" aria-hidden="true" /> flagged by the detector</span>
          <span><b>–</b> fewer than {MIN_RUNS} runs, no change measurable yet</span>
          <span><b>·</b> not measured</span>
          {summary.modelledCount > 0 && (
            <span>
              {summary.measuredCount} measured, {summary.modelledCount} modelled while benchmarking is paused
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** True only when the API actually measured this axis. */
function measured(axis?: AxisReading): axis is AxisReading {
  if (!axis || typeof axis.value !== 'number') return false;
  return axis.sampleSize === undefined || axis.sampleSize > 0;
}

/**
 * Enough runs behind this axis for its change figure to mean anything.
 * Deliberately a plain boolean, not a type predicate: narrowing to `never` on the
 * false branch would make the "not enough runs yet" copy unwritable.
 */
function comparable(axis?: AxisReading): boolean {
  if (!measured(axis)) return false;
  return axis.sampleSize === undefined || axis.sampleSize >= MIN_RUNS;
}

function changeOf(m: DriftStatus, key: string): number {
  const axis = m.axes[key];
  // Not-yet-comparable sorts last rather than looking like a flat reading.
  return comparable(axis) ? axis?.changeMagnitude ?? 0 : Infinity;
}

function biggestMove(m: DriftStatus): number {
  return AXES.reduce((max, a) => {
    const axis = m.axes[a.key];
    if (!comparable(axis)) return max;
    return Math.max(max, Math.abs(axis?.changeMagnitude ?? 0));
  }, 0);
}

function cellTitle(model: string, label: string, axis?: AxisReading): string {
  if (!measured(axis)) return `${model} · ${label}: not measured`;
  const n = axis.sampleSize ?? 0;
  if (!comparable(axis)) {
    return `${model} · ${label}\nNow ${Math.round(axis.value * 100)}%, from ${n} run${n === 1 ? '' : 's'}.\n` +
      `Needs ${MIN_RUNS} before a change can be measured.`;
  }
  return `${model} · ${label}\n` +
    `${signed(Math.round(axis.changeMagnitude ?? 0))}% vs baseline · now ${Math.round(axis.value * 100)}%\n` +
    `${axis.status.toLowerCase()} · ${n} runs`;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/**
 * Diverging tint. Readings inside the noise floor get no colour at all, which is what
 * makes the handful of real movers findable in a 168-cell grid.
 */
function tintFor(change: number): React.CSSProperties | undefined {
  const mag = Math.abs(change);
  if (mag < TINT_FLOOR) return undefined;
  // Cap the alpha so the ink token stays readable on top of the strongest tint.
  const alpha = Math.min(1, (mag - TINT_FLOOR) / (SCALE_MAX - TINT_FLOOR)) * 0.42 + 0.06;
  const rgb = change > 0 ? 'var(--dm-up-rgb)' : 'var(--dm-down-rgb)';
  return { background: `rgba(${rgb}, ${alpha.toFixed(3)})` };
}

function regimeLabel(regime: string): string {
  switch (regime) {
    case 'STABLE': return 'Steady';
    case 'VOLATILE': return 'Volatile';
    case 'DEGRADED': return 'Degraded';
    case 'RECOVERING': return 'Recovering';
    default: return regime;
  }
}
