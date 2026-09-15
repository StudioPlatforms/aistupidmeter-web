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

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import StatCellDetail, { DetailEntry } from './v4/StatCellDetail';
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
  /** Whether changeMagnitude compares two disjoint windows. False = cannot tell yet. */
  comparable?: boolean;
  /** Runs needed before a change can be measured at all. */
  runsForComparison?: number;
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
  /** Page-Hinkley state for THIS suite. `armed: false` means the detector cannot fire yet. */
  ph?: { days?: number; armed?: boolean; coldStart?: number };
}

interface HeatmapProps {
  /** In leaderboard order for the selected sort — the default row order here. */
  models: { id: string; name: string; provider: string }[];
  /** Window the movement is measured over; 'latest' is the 28-day alerting signature. */
  period?: 'latest' | '24h' | '7d' | '1m';
  /** The top-bar sort. Only used to reset the row order when it changes. */
  sortBy?: string;
}

const PERIOD_TEXT: Record<string, string> = { '24h': '24 hours', '7d': '7 days', '1m': '30 days' };

/** All seven axes the API scores. The old table showed four of them. */
type Suite = 'hourly' | 'tooling' | 'deep';
interface Axis { key: string; label: string; short: string }
// One column set per suite, read from that suite's own series. The leaderboard sort decides
// which: Reasoning → the nine reasoning axes, Tooling → the seven tool-use axes, anything
// else → the coding suite's seven canonical axes.
const AXES_BY_SUITE: Record<Suite, readonly Axis[]> = {
  hourly: [
    { key: 'correctness', label: 'Correctness', short: 'Corr' },
    { key: 'spec',        label: 'Spec',        short: 'Spec' },
    { key: 'codeQuality', label: 'Code quality',short: 'Code' },
    { key: 'efficiency',  label: 'Efficiency',  short: 'Effic' },
    { key: 'stability',   label: 'Stability',   short: 'Stab' },
    { key: 'refusal',     label: 'Refusal',     short: 'Ref' },
    { key: 'recovery',    label: 'Recovery',    short: 'Recov' },
  ],
  deep: [
    { key: 'correctness',       label: 'Correctness',     short: 'Corr' },
    { key: 'codeQuality',       label: 'Code quality',    short: 'Code' },
    { key: 'stability',         label: 'Stability',       short: 'Stab' },
    { key: 'edgeCases',         label: 'Edge cases',      short: 'Edge' },
    { key: 'debugging',         label: 'Debugging',       short: 'Debug' },
    { key: 'safety',            label: 'Safety',          short: 'Safe' },
    { key: 'memoryRetention',   label: 'Memory',          short: 'Mem' },
    { key: 'planCoherence',     label: 'Plan coherence',  short: 'Plan' },
    { key: 'contextWindow',     label: 'Context use',     short: 'Ctx' },
  ],
  tooling: [
    { key: 'taskCompletion',    label: 'Task completion',   short: 'Done' },
    { key: 'toolSelection',     label: 'Tool selection',    short: 'Select' },
    { key: 'parameterAccuracy', label: 'Parameter accuracy',short: 'Params' },
    { key: 'efficiency',        label: 'Efficiency',        short: 'Effic' },
    { key: 'errorHandling',     label: 'Error handling',    short: 'Errors' },
    { key: 'contextAwareness',  label: 'Context awareness', short: 'Ctx' },
    { key: 'safetyCompliance',  label: 'Safety compliance', short: 'Safe' },
  ],
};
const SUITE_NAME: Record<Suite, string> = { hourly: 'coding', deep: 'reasoning', tooling: 'tool-use' };
const AXES = AXES_BY_SUITE.hourly;

/** The drift tiles keep their own look; only the reveal is shared with the stat bar. */
const KPI_CLASSES = { value: 'dm-kpi-val', label: 'dm-kpi-lab', more: 'dm-kpi-more' } as const;

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
const MIN_RUNS = 6;

export default function DriftHeatmap({ models, period = 'latest', sortBy = 'combined' }: HeatmapProps) {
  const suite: Suite = sortBy === 'reasoning' ? 'deep' : sortBy === 'tooling' ? 'tooling' : 'hourly';
  const axes = AXES_BY_SUITE[suite];

  const router = useRouter();
  const [driftData, setDriftData] = useState<DriftStatus[]>([]);
  const [loading, setLoading] = useState(true);
  // Rows open in leaderboard order, so the top-bar sort (combined / reasoning / coding /
  // tooling / price) is what orders this table too. "Biggest movers" and the per-column
  // sorts are one click away and give way again whenever the top bar changes.
  const [sortKey, setSortKey] = useState<string>('__board');
  const [measuredOnly, setMeasuredOnly] = useState(false);

  // `models` is a fresh array on every parent render; key the fetch on its contents.
  const modelKey = models.map(m => m.id).join(',');

  useEffect(() => { setSortKey('__board'); }, [sortBy, period]);

  useEffect(() => {
    const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
    const modelIds = new Set(models.map(m => m.id));
    setLoading(true);

    // The suite travels in the PATH: the edge cache keys /api/drift on a fixed list of query
    // arguments that does not include it. The hourly batch keeps the scheduler-cached path.
    fetch(`${apiUrl}/api/drift/batch${suite === 'hourly' ? '' : `/${suite}`}${period === 'latest' ? '' : `?period=${period}`}`)
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
                ph: (item.data.pageHinkleyBySuite || {})[suite],
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelKey, period, suite]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const boardOrder = useMemo(() => new Map(models.map((m, i) => [String(m.id), i])), [modelKey]);

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
    if (sortKey === '__board') {
      return rows.sort((a, b) =>
        (boardOrder.get(String(a.modelId)) ?? Infinity) - (boardOrder.get(String(b.modelId)) ?? Infinity));
    }
    if (sortKey === '__movement') {
      // Biggest mover first: a monitor should open on whatever needs attention.
      return rows.sort((a, b) => biggestMove(b, axes) - biggestMove(a, axes));
    }
    if (sortKey === '__name') {
      return rows.sort((a, b) => a.modelName.localeCompare(b.modelName));
    }
    // Sorting by a dimension puts the steepest decline at the top.
    return rows.sort((a, b) => changeOf(a, sortKey) - changeOf(b, sortKey));
  }, [visible, sortKey, boardOrder]);

  const summary = useMemo(() => {
    // Count a reading as off baseline ONLY if it is comparable — the same gate the cell
    // itself uses before it will flag, tint or put a number on anything. Counting merely
    // `measured` readings meant the tile could claim "5 readings off baseline" while every
    // cell below showed no colour and no delta, because a status can be VOLATILE from
    // variance alone before there are two windows to compare against. The matrix was right
    // and the headline was wrong; they now ask the same question.
    const moved = visible.reduce(
      (n, m) => n + axes.filter(a => comparable(m.axes[a.key]) && m.axes[a.key].status !== 'STABLE').length,
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
      warmingUp: visible.filter(m => axes.every(a => !comparable(m.axes[a.key]))).length,
      // Median runs behind a cell. Movement is measured within one benchmark configuration,
      // so right after a configuration change every cell is comparable-but-flat: the matrix is
      // populated and reads as empty. Say so, with the number, instead of letting it look broken.
      typicalRuns: (() => {
        const ns = visible.flatMap(m => axes.map(a => m.axes[a.key]?.sampleSize).filter((n): n is number => typeof n === 'number' && n > 0)).sort((x, y) => x - y);
        return ns.length ? ns[Math.floor(ns.length / 2)] : 0;
      })(),
    };
  }, [visible, driftData]);

  // The names behind each headline number. Same reveal as the home page's stat bar:
  // the reader's next question after "3 need watching" is always "which three", and the
  // rows are already on the client.
  const kpiEntries = useMemo(() => {
    const row = (m: DriftStatus, value?: string | number | null): DetailEntry => ({
      label: m.modelName,
      note: m.provider || null,
      value: value ?? null,
    });
    const regime = (m: DriftStatus) => m.regime.charAt(0) + m.regime.slice(1).toLowerCase();
    const movedRows: DetailEntry[] = [];
    for (const m of visible) {
      const off = axes.filter(a => comparable(m.axes[a.key]) && m.axes[a.key].status !== 'STABLE');
      if (off.length === 0) continue;
      movedRows.push({
        label: m.modelName,
        note: off.map(a => a.label).join(', '),
        value: off.length,
      });
    }
    movedRows.sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));
    return {
      total: visible.map(m => row(m, regime(m))),
      stable: visible.filter(m => m.regime === 'STABLE').map(m => row(m)),
      watch: visible.filter(m => m.regime !== 'STABLE').map(m => row(m, regime(m))),
      moved: movedRows,
    };
  }, [visible, axes]);

  // Zero has two very different meanings here, and saying the wrong one is how a monitor
  // gets trusted when it should not be: nothing has moved, versus nothing can be compared yet.
  // Is the change detector actually able to fire for this suite? After a configuration
  // change it sits in cold start for ten days, during which `regime` falls through to
  // STABLE for every model — a default, not a finding. Reporting that as "holding steady"
  // is a clean bill of health nobody has earned, and it is the same error as counting
  // readings off a baseline that does not exist yet.
  const detector = useMemo(() => {
    const armed = visible.filter(m => m.ph?.armed).length;
    const days = visible.map(m => m.ph?.days).filter((n): n is number => typeof n === 'number');
    const coldStart = visible.map(m => m.ph?.coldStart).filter((n): n is number => typeof n === 'number');
    return {
      armed,
      anyArmed: armed > 0,
      days: days.length ? Math.max(...days) : 0,
      coldStart: coldStart.length ? Math.max(...coldStart) : 10,
      known: visible.some(m => m.ph !== undefined),
    };
  }, [visible]);

  const nothingComparable = useMemo(
    () => visible.length > 0 && visible.every(m => axes.every(a => !comparable(m.axes[a.key]))),
    [visible, axes]
  );

  const [kpiPinned, setKpiPinned] = useState<string | null>(null);
  const [kpiHovered, setKpiHovered] = useState<string | null>(null);
  const kpiCloseAll = useCallback(() => { setKpiPinned(null); setKpiHovered(null); }, []);
  const kpiCell = (key: string) => ({
    open: kpiPinned === key || kpiHovered === key,
    onHover: (v: boolean) => setKpiHovered(v ? key : null),
    onToggle: () => { setKpiPinned(p => (p === key ? null : key)); setKpiHovered(null); },
    onClose: kpiCloseAll,
  });

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
            Each cell is the model&rsquo;s current level on that dimension (0&ndash;100).
            {' '}{period === 'latest'
              ? 'The colour, and the small signed number, are how far it has moved from its own baseline on the current benchmark configuration'
              : `The colour, and the small signed number, are how far it has moved over the last ${PERIOD_TEXT[period]} — its newest runs in that window against its oldest`}
            ; positive is better than baseline, negative is worse. A level with no number is measured but too new to compare.
          </p>
        </div>
        <div className="dm-head-actions">
          <button
            type="button"
            className={`dm-toggle${sortKey === '__board' ? ' is-on' : ''}`}
            onClick={() => setSortKey('__board')}
            title="Same order as the leaderboard for the selected sort"
          >
            Leaderboard order
          </button>
          <button
            type="button"
            className={`dm-toggle${sortKey === '__movement' ? ' is-on' : ''}`}
            onClick={() => setSortKey('__movement')}
            title="Largest movement on any dimension first"
          >
            Biggest movers
          </button>
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
      </div>

      {/* Headline numbers first - the panel should answer "is anything wrong?" before
          asking anyone to read a grid. */}
      <div className="dm-kpis">
        <StatCellDetail
          id="dm-kpi-total"
          className="dm-kpi"
          valueFirst
          classes={KPI_CLASSES}
          label="Models tracked"
          value={summary.total}
          title="Every model on the board that has a drift reading for this suite."
          caption={`All ${summary.total} tracked, with the regime each is in`}
          entries={kpiEntries.total}
          emptyText="No model has a drift reading in this view."
          {...kpiCell('total')}
        />
        <StatCellDetail
          id="dm-kpi-stable"
          className="dm-kpi"
          valueFirst
          classes={KPI_CLASSES}
          label={detector.known && !detector.anyArmed ? 'Detector warming up' : 'Holding steady'}
          value={detector.known && !detector.anyArmed ? summary.total : summary.stable}
          title={detector.known && !detector.anyArmed
            ? `The change detector needs ${detector.coldStart} days of history on this configuration before it can report anything, and has ${detector.days}. Until then no model can be called steady, because nothing has been tested.`
            : 'Models whose own history shows no sustained change.'}
          caption={detector.known && !detector.anyArmed
            ? `Waiting for ${detector.coldStart} days on this configuration — ${detector.days} so far`
            : 'No sustained change against their own past'}
          entries={detector.known && !detector.anyArmed ? [] : kpiEntries.stable}
          emptyText={detector.known && !detector.anyArmed
            ? `Every model's detector is still in cold start after the last configuration change. "Steady" is not a finding yet, it is the absence of one.`
            : 'No model is in a steady regime right now.'}
          {...kpiCell('stable')}
        />
        <StatCellDetail
          id="dm-kpi-watch"
          className={`dm-kpi${summary.watch ? ' is-watch' : ''}`}
          valueFirst
          classes={KPI_CLASSES}
          label="Need watching"
          value={summary.watch}
          title={detector.known && !detector.anyArmed
            ? 'Nothing can be flagged yet: the change detector is in cold start after the last configuration change.'
            : 'Models in a volatile, degraded or recovering regime.'}
          caption={detector.known && !detector.anyArmed
            ? 'Nothing can be flagged while the detector is warming up'
            : 'In a volatile, degraded or recovering regime'}
          entries={kpiEntries.watch}
          emptyText={detector.known && !detector.anyArmed
            ? 'Zero here means the detector has not been able to look yet, not that everything is fine.'
            : 'Every model is holding steady.'}
          {...kpiCell('watch')}
        />
        <StatCellDetail
          id="dm-kpi-moved"
          className={`dm-kpi${summary.moved ? ' is-watch' : ''}`}
          valueFirst
          classes={KPI_CLASSES}
          label="Readings off baseline"
          value={summary.moved}
          title="Individual dimension readings that have moved away from their own baseline. One model can contribute several."
          caption={nothingComparable ? 'Nothing is comparable yet on this configuration' : 'Which dimensions moved, and on which model'}
          entries={kpiEntries.moved}
          emptyText={nothingComparable
            ? `No dimension has enough runs on this configuration yet to compare against a baseline, so nothing can be off it. Readings return after ${MIN_RUNS} runs.`
            : 'Every dimension is sitting on its baseline.'}
          {...kpiCell('moved')}
        />
      </div>

      {summary.typicalRuns > 0 && summary.typicalRuns < 12 && (
        <p className="dm-note">
          The {SUITE_NAME[suite]} suite&rsquo;s configuration changed recently: a typical cell has {summary.typicalRuns} run{summary.typicalRuns === 1 ? '' : 's'} on
          it. Movement is measured within one configuration, comparing a model&rsquo;s newest runs against its
          oldest on the same tasks and scoring &mdash; which needs {MIN_RUNS} runs, two windows of three. So the
          &plusmn;point movement and its colour return {suite === 'hourly' ? 'about a day after a configuration change, since the coding suite runs every four hours' : 'six days after a configuration change, since this suite runs once a day'}.
          Until then a cell shows the current level alone &mdash; &ldquo;no change measured yet&rdquo;, not &ldquo;no change&rdquo;.
        </p>
      )}
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
              {axes.map(a => (
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
                  {/* Same rule as the headline tiles: while this model's detector is in cold
                      start, `regime` is a fall-through default and "Steady" would be a verdict
                      nobody reached. Say what is actually true — it has not been tested yet. */}
                  {m.ph && m.ph.armed === false ? (
                    <span
                      className="dm-pill dm-pill--warming"
                      title={`Not tested yet. The detector needs ${m.ph.coldStart ?? MIN_RUNS} days of history on this configuration and has ${m.ph.days ?? 0}.`}
                    >
                      Warming up
                    </span>
                  ) : (
                    <span className={`dm-pill dm-pill--${m.regime.toLowerCase()}`}>
                      {regimeLabel(m.regime)}
                    </span>
                  )}
                </td>
                {axes.map(a => {
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
                      {measured(axis)
                        ? (
                          <span className="dm-reading">
                            <span className={`dm-level${ok ? '' : ' dm-level-young'}`}>{Math.round(axis.value * 100)}</span>
                            {ok && change !== 0 && <span className="dm-delta">{signed(change as number)}</span>}
                          </span>
                        )
                        : <span className="dm-none">·</span>}
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
          const movers = axes
            .map(a => ({ ...a, axis: m.axes[a.key] }))
            .filter(x => comparable(x.axis) && Math.abs(Math.round(x.axis?.changeMagnitude ?? 0)) >= TINT_FLOOR)
            .sort((x, y) => Math.abs(y.axis?.changeMagnitude ?? 0) - Math.abs(x.axis?.changeMagnitude ?? 0));
          const tooFew = axes.every(a => !comparable(m.axes[a.key]));
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
                {/* The phone card is a second render path for the same row; it must not say
                    "Steady" when the table says "Warming up". Same rule, one condition. */}
                {m.ph && m.ph.armed === false ? (
                  <span
                    className="dm-pill dm-pill--warming"
                    title={`Not tested yet. The detector needs ${m.ph.coldStart ?? MIN_RUNS} days of history on this configuration and has ${m.ph.days ?? 0}.`}
                  >
                    Warming up
                  </span>
                ) : (
                  <span className={`dm-pill dm-pill--${m.regime.toLowerCase()}`}>{regimeLabel(m.regime)}</span>
                )}
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
  // The API knows whether it had two disjoint windows; trust it when it says.
  if (axis && typeof axis.comparable === 'boolean') return axis.comparable;
  if (!measured(axis)) return false;
  return axis.sampleSize === undefined || axis.sampleSize >= MIN_RUNS;
}

function changeOf(m: DriftStatus, key: string): number {
  const axis = m.axes[key];
  // Not-yet-comparable sorts last rather than looking like a flat reading.
  return comparable(axis) ? axis?.changeMagnitude ?? 0 : Infinity;
}

function biggestMove(m: DriftStatus, axes: readonly Axis[]): number {
  return axes.reduce((max, a) => {
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
      `Needs ${axis.runsForComparison ?? MIN_RUNS} on this configuration before a change can be measured.`;
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
