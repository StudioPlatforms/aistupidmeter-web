'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';
import { Pane, Locked, Loader, Empty, Note } from '@/components/studio';
import { useChartReveal } from '../PerformanceChart';

type CusumPeriod = '7d' | '1m' | 'all';
// One curve per suite, never a blend: each suite has its own scale, noise and configuration.
type CusumSuite = 'hourly' | 'tooling' | 'deep';
type Provenance = 'real' | 'synthetic' | 'mixed';

interface CusumPoint {
  ts: string;
  score: number;
  cusum: number;
  driftDetected: boolean;
  /** observations the detector had when it evaluated this point */
  n: number;
  /** false while the detector is warming up and cannot fire */
  armed: boolean;
  /** observations this point needed to be armed (cold start vs post-detection re-arm) */
  minRequired: number;
  samples: number;
  realSamples: number;
  syntheticSamples: number;
  provenance: Provenance;
}

interface CusumSeries {
  modelId: number;
  points: CusumPoint[];
  totalDays: number;
  totalRuns: number;
  realRuns: number;
  syntheticRuns: number;
  provenance: Provenance;
  realShare: number;
  sufficientData: boolean;
  daysUntilAvailable: number;
  daysOnCurrentConfig: number;
  threshold: number;
  minObservations: number;
  rearmObservations: number;
  /** consecutive daily points above the threshold before a detection (tool use: 3; absent = 1) */
  confirmObservations?: number;
  detections: string[];
  period: string;
}

interface ModelDetailCusumProps {
  modelId: number;
  /** the suite the page is currently in; the chips can still switch */
  initialSuite?: CusumSuite;
  hasProAccess: boolean;
  onShowProModal: (feature: 'drift-cusum') => void;
}

/* The curve is the accent, change-points the "bad" token: in light theme exactly the pair
   validated against scripts/validate_palette.js (#1a73e8 ↔ #d93025 — CVD ΔE 29.1 protan,
   normal ΔE 36.5); dark theme swaps both for its own lighter tokens. Change-points never rest
   on colour alone: a triangle, a dashed day rule and a tooltip line mark them too. */
const LINE = 'var(--lp-accent)';
const DETECTION = 'var(--lp-bad)';

const PERIOD_LABEL: Record<CusumPeriod, string> = {
  '7d': '7 days',
  '1m': '30 days',
  'all': 'All',
};
const SUITE_LABEL: Record<CusumSuite, string> = {
  hourly: 'Coding',
  tooling: 'Tool use',
  deep: 'Reasoning',
};
const SUITE_TITLE: Record<CusumSuite, string> = {
  hourly: 'Coding suite: six sweeps a day, daily median',
  tooling: 'Tool-use suite: nine sessions a day',
  deep: 'Reasoning suite: four multi-turn tasks a day',
};

const fmtDay = (ts: string) =>
  new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function ModelDetailCusum({
  modelId,
  initialSuite = 'hourly',
  hasProAccess,
  onShowProModal,
}: ModelDetailCusumProps) {
  const [period, setPeriod] = useState<CusumPeriod>('1m');
  const [suite, setSuite] = useState<CusumSuite>(initialSuite);
  useEffect(() => { setSuite(initialSuite); }, [initialSuite]);
  const [series, setSeries] = useState<CusumSeries | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const host = useRef<HTMLDivElement>(null);
  // The chart (and so its host) only renders once a Pro series with points has arrived.
  const { inView, reduced } = useChartReveal(host, hasProAccess && !error && !!series && series.points.length > 0);
  const gid = `sm-ph-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  useEffect(() => {
    // Deliberately no fetch for non-pro visitors. Blurring fetched data would
    // still ship it to the browser, where it is one devtools tab away.
    if (!hasProAccess) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Always same-origin: this goes to the Next.js route, which verifies the
        // NextAuth session server-side before touching the API. The check below
        // is only a UX affordance — the real gate is on the server, because the
        // browser can lie about everything it sends.
        const res = await fetch(`/api/pro/drift-cusum/${modelId}?period=${period}&suite=${suite}`);
        if (res.status === 401 || res.status === 403) {
          throw new Error('This chart requires an active Pro subscription');
        }
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = await res.json();
        if (cancelled) return;
        if (!json.success) throw new Error(json.error || 'Failed to load drift data');
        setSeries(json.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [modelId, period, suite, hasProAccess]);

  // The suite and period pickers sit in the pane's head in every Pro state, so a period with
  // nothing in it never strands the reader without the way back.
  const pickers = (
    <div className="sm-pane-segs">
      {/* Suite selector — the detector runs one series per suite (coding, tool use, reasoning) */}
      <div className="st-seg is-scroll" role="group" aria-label="Suite">
        {(Object.keys(SUITE_LABEL) as CusumSuite[]).map((sName) => (
          <button key={sName} type="button" aria-pressed={suite === sName} onClick={() => setSuite(sName)} title={SUITE_TITLE[sName]}>
            {SUITE_LABEL[sName]}
          </button>
        ))}
      </div>
      {/* Period selector */}
      <div className="st-seg is-scroll" role="group" aria-label="Period">
        {(Object.keys(PERIOD_LABEL) as CusumPeriod[]).map((p) => (
          <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>
    </div>
  );

  const frame = (children: ReactNode, opts: { foot?: ReactNode; withPickers?: boolean } = {}) => (
    <Pane
      title="Drift detection"
      sub={hasProAccess ? `Page-Hinkley statistic · ${SUITE_LABEL[suite].toLowerCase()} suite` : 'Page-Hinkley statistic'}
      actions={opts.withPickers ? pickers : undefined}
      foot={opts.foot}
    >
      {children}
    </Pane>
  );

  // ── Locked ────────────────────────────────────────────────────────────
  if (!hasProAccess) {
    return frame(
      <Locked title="CUSUM drift curve" onOpen={() => onShowProModal('drift-cusum')}>
        See the Page-Hinkley statistic behind every drift alert, with detected
        change-points marked on the day they happened.
      </Locked>,
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading && !series) {
    return frame(<Loader label="Loading drift history…" minHeight={280} />, { withPickers: true });
  }

  // ── Error ─────────────────────────────────────────────────────────────
  if (error) {
    return frame(
      <Note tone="warn" title="Could not load drift history">{error}</Note>,
      { withPickers: true },
    );
  }

  // ── Nothing measured yet ──────────────────────────────────────────────
  // Only when there is genuinely no series. Below the cold-start window the
  // detector has no baseline and may not fire, but the daily medians and the
  // running statistic are real measurements, and the chart already shades
  // un-armed spans and says so per point — so it is shown, marked provisional,
  // rather than replaced by a paragraph explaining why it is absent.
  if (series && !series.sufficientData && series.points.length === 0) {
    return frame(
      <Empty title="Not enough history yet">
        Change detection needs at least {series.minObservations} days on the current
        benchmark configuration to establish a baseline before a curve means anything.
        Earlier days were measured on a previous configuration and are not comparable.
        This model has {series.totalDays} {series.totalDays === 1 ? 'day' : 'days'} on
        the current one — about {series.daysUntilAvailable} more to go.
      </Empty>,
      { withPickers: true },
    );
  }

  if (!series || series.points.length === 0) {
    return frame(<Empty title="No drift data in this period." />, { withPickers: true });
  }

  // ── Chart ─────────────────────────────────────────────────────────────
  const data = series.points.map((p) => ({
    ...p,
    day: fmtDay(p.ts),
    // Separate key so detections render as their own marker layer.
    detection: p.driftDetected ? p.cusum : null,
  }));

  // Warming up: the curve is real but nothing on it may be treated as a detection.
  const provisional = !series.sufficientData;

  const peak = Math.max(...series.points.map((p) => p.cusum));
  const yMax = Math.max(peak, series.threshold) * 1.15;
  const detectionCount = series.detections.length;
  const latest = series.points[series.points.length - 1];
  const detectionDays = data.filter((p) => p.driftDetected).map((p) => p.day);

  // Contiguous spans where the detector could not fire. Shaded on the chart so a
  // curve crossing the threshold during warm-up doesn't read as a missed alert.
  //
  // Two distinct causes, labelled differently: the cold start at the beginning
  // of a model's history (no baseline exists yet) versus the shorter window
  // after a detection (re-learning the post-change level). Calling a cold start
  // "re-arming" would imply a change-point that never happened.
  type WarmupSpan = { from: string; to: string; kind: 'baseline' | 'rearm' };
  const warmupSpans: WarmupSpan[] = [];
  data.forEach((p, i) => {
    if (p.armed) return;
    const kind: WarmupSpan['kind'] =
      p.minRequired === series.minObservations ? 'baseline' : 'rearm';
    const last = warmupSpans[warmupSpans.length - 1];
    if (last && i > 0 && !data[i - 1].armed && last.kind === kind) {
      last.to = p.day;
    } else {
      warmupSpans.push({ from: p.day, to: p.day, kind });
    }
  });

  const hasBaselineSpan = warmupSpans.some((s) => s.kind === 'baseline');
  const hasRearmSpan = warmupSpans.some((s) => s.kind === 'rearm');

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const d: typeof data[number] = payload[0].payload;
    return (
      <div className="sm-tip">
        <span className="sm-tip-h">
          {new Date(d.ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
        </span>
        <span className="sm-tip-v">
          <i className="sm-tip-k" aria-hidden="true" />
          Page-Hinkley <strong>{d.cusum.toFixed(3)}</strong> / {series.threshold.toFixed(2)}
        </span>
        <span className="sm-tip-s">Daily median score: {d.score.toFixed(1)}</span>
        <span className="sm-tip-s">{d.samples} {d.samples === 1 ? 'run' : 'runs'} that day</span>
        {d.driftDetected && (
          <span className="sm-tip-bad"><i className="sm-tri" aria-hidden="true" />Change-point detected</span>
        )}
        {!d.armed && (
          <span className="sm-tip-note">
            {d.minRequired === series.minObservations ? 'Building baseline' : 'Re-arming after a change-point'}
            {' '}— day {d.n} of {d.minRequired}. The threshold is inactive until the
            baseline is established.
          </span>
        )}
      </div>
    );
  };

  const tickStyle = { fill: 'var(--lp-fg3)', fontSize: 11.5 };

  return frame(
    <>
      {/* Warming up. Stated before the chart rather than under it, because the one thing a
          reader must not do with this curve is treat a rise as a detection: the threshold
          is inactive until the baseline is established. The shaded spans on the chart say
          the same thing per day. */}
      {provisional && (
        <div style={{ marginBottom: 14 }}>
          <Note tone="warn" title="Baseline still forming">
            {series.daysOnCurrentConfig} of{' '}
            {series.minObservations} measured days on the current benchmark configuration
            {series.daysUntilAvailable > 0 && <> ({series.daysUntilAvailable} to go)</>}. The curve
            below is real, but the detector cannot fire yet, so nothing on it counts as a detection.
          </Note>
        </div>
      )}

      <div
        ref={host}
        className={`sm-chart${loading ? ' is-busy' : ''}`}
        style={{ ['--sm-h' as string]: '300px', ['--sm-hm' as string]: '240px' }}
        aria-busy={loading || undefined}
        role="img"
        aria-label={`Page-Hinkley statistic for the ${SUITE_LABEL[suite].toLowerCase()} suite over ${data.length} days; current ${latest.cusum.toFixed(3)} against a threshold of ${series.threshold.toFixed(2)}; ${detectionCount} ${detectionCount === 1 ? 'detection' : 'detections'} in view.`}
      >
        {inView ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 22, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={LINE} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={LINE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--lp-line)" vertical={false} />

              {/* Warm-up windows: the threshold is inactive here. */}
              {warmupSpans.map((span, i) => (
                <ReferenceArea
                  key={`warmup-${i}`}
                  x1={span.from}
                  x2={span.to}
                  fill="var(--lp-fg3)"
                  fillOpacity={0.09}
                  stroke="none"
                  label={{
                    value: span.kind === 'baseline' ? 'Building baseline' : 'Re-arming',
                    position: 'insideTop',
                    fill: 'var(--lp-fg3)',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
              ))}

              <XAxis
                dataKey="day"
                tick={tickStyle}
                tickLine={false}
                axisLine={{ stroke: 'var(--lp-line2)' }}
                tickMargin={10}
                height={34}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                domain={[0, yMax]}
                tick={tickStyle}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v: number) => v.toFixed(2)}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--lp-line2)', strokeWidth: 1 }} wrapperStyle={{ outline: 'none' }} />

              {/* Change-points: a dashed rule on the day, in the detection colour. */}
              {detectionDays.map((day) => (
                <ReferenceLine key={`cp-${day}`} x={day} stroke={DETECTION} strokeDasharray="3 3" strokeOpacity={0.75} />
              ))}

              {/* Reference rule in muted ink, directly labelled — not a third hue. */}
              <ReferenceLine
                y={series.threshold}
                stroke="var(--lp-fg2)"
                strokeDasharray="6 4"
                strokeWidth={1}
                label={{
                  value: (series.confirmObservations ?? 1) > 1
                    ? `Alert threshold ${series.threshold.toFixed(2)} · held ${series.confirmObservations} days`
                    : `Alert threshold ${series.threshold.toFixed(2)}`,
                  position: 'insideTopRight',
                  fill: 'var(--lp-fg2)',
                  fontSize: 11.5,
                  fontWeight: 600,
                }}
              />

              <Area
                type="monotone"
                dataKey="cusum"
                stroke="none"
                fill={`url(#${gid})`}
                isAnimationActive={!reduced}
                animationDuration={1100}
                animationEasing="ease-out"
                activeDot={false}
              />
              <Line
                type="monotone"
                dataKey="cusum"
                stroke={LINE}
                strokeWidth={2.25}
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 4.5, fill: 'var(--lp-card)', stroke: LINE, strokeWidth: 2.5 }}
                isAnimationActive={!reduced}
                animationDuration={1100}
                animationEasing="ease-out"
              />
              {/* Detections as their own marked layer: identity is shape + color + tooltip label. */}
              <Scatter
                dataKey="detection"
                fill={DETECTION}
                shape="triangle"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="sm-chart-wait" aria-hidden="true" />
        )}
      </div>

      {/* Reading guide — identity never rests on color alone */}
      <ul className="sm-legend">
        <li><i className="st-key is-accent" aria-hidden="true" />Accumulated degradation</li>
        <li><i className="sm-tri" aria-hidden="true" />Change-point detected</li>
        {warmupSpans.length > 0 && (
          <li>
            <i className="sm-swatch" aria-hidden="true" />
            {hasBaselineSpan && hasRearmSpan
              ? 'Building baseline / re-arming (threshold inactive)'
              : hasBaselineSpan
                ? 'Building baseline (threshold inactive)'
                : 'Detector re-arming (threshold inactive)'}
          </li>
        )}
        <li className="sm-legend-end">Current <b>{latest.cusum.toFixed(3)}</b></li>
        <li>{detectionCount} {detectionCount === 1 ? 'detection' : 'detections'} in view</li>
      </ul>
    </>,
    {
      withPickers: true,
      foot: (
        <>
          The Page-Hinkley statistic accumulates each day a model scores below its own
          running baseline, and decays when it recovers. A sustained regression pushes
          it past the threshold; ordinary day-to-day noise does not. After a
          change-point the detector resets and spends {series.rearmObservations} days
          re-learning the new baseline — in those shaded windows the threshold is
          inactive by design. Computed over the same hourly series shown in the
          performance timeline above: {series.totalRuns} runs across {series.totalDays} days.
        </>
      ),
    },
  );
}
