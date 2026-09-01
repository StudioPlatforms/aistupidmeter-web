'use client';

import { useEffect, useState } from 'react';
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

type CusumPeriod = '7d' | '1m' | 'all';
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
  threshold: number;
  minObservations: number;
  rearmObservations: number;
  detections: string[];
  period: string;
}

interface ModelDetailCusumProps {
  modelId: number;
  hasProAccess: boolean;
  onShowProModal: (feature: 'drift-cusum') => void;
}

/* Validated against scripts/validate_palette.js (light, surface #ffffff):
   #1a73e8 ↔ #d93025 — CVD ΔE 29.1 (protan), normal ΔE 36.5, all checks pass. */
const LINE = '#1a73e8';
const DETECTION = '#d93025';

const PERIOD_LABEL: Record<CusumPeriod, string> = {
  '7d': '7D',
  '1m': '30D',
  'all': 'ALL',
};

const fmtDay = (ts: string) =>
  new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function ModelDetailCusum({
  modelId,
  hasProAccess,
  onShowProModal,
}: ModelDetailCusumProps) {
  const [period, setPeriod] = useState<CusumPeriod>('1m');
  const [series, setSeries] = useState<CusumSeries | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const res = await fetch(`/api/pro/drift-cusum/${modelId}?period=${period}`);
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
  }, [modelId, period, hasProAccess]);

  const Section = ({ children }: { children: React.ReactNode }) => (
    <div className="md-chart-section">
      <div className="md-chart-title">📉 DRIFT DETECTION — CUSUM</div>
      {children}
    </div>
  );

  // ── Locked ────────────────────────────────────────────────────────────
  if (!hasProAccess) {
    return (
      <Section>
        <div
          className="md-chart-empty"
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          onClick={() => onShowProModal('drift-cusum')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onShowProModal('drift-cusum'); }}
        >
          <div className="md-chart-empty-inner">
            <div className="md-chart-empty-icon">🔒</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              CUSUM drift curve is a Pro feature
            </div>
            <div style={{ color: 'var(--phosphor-dim)', fontSize: 12, maxWidth: 420, margin: '0 auto' }}>
              See the Page-Hinkley statistic behind every drift alert, with detected
              change-points marked on the day they happened.
            </div>
          </div>
        </div>
      </Section>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading && !series) {
    return (
      <Section>
        <div className="md-chart-empty">
          <div className="md-chart-empty-inner" style={{ color: 'var(--phosphor-dim)' }}>
            Loading drift history…
          </div>
        </div>
      </Section>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Section>
        <div className="md-chart-empty">
          <div className="md-chart-empty-inner">
            <div className="md-chart-empty-icon">⚠️</div>
            <div style={{ color: 'var(--phosphor-dim)', fontSize: 12 }}>
              Could not load drift history — {error}
            </div>
          </div>
        </div>
      </Section>
    );
  }

  // ── Not enough verified data ──────────────────────────────────────────
  // Below the detector's cold-start window there is no baseline to deviate from,
  // so a curve would be meaningless regardless of what the scores are. Never
  // draw an interpolated or partial line here.
  if (series && !series.sufficientData) {
    return (
      <Section>
        <div className="md-chart-empty">
          <div className="md-chart-empty-inner">
            <div className="md-chart-empty-icon">📊</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              Not enough history yet
            </div>
            <div style={{ color: 'var(--phosphor-dim)', fontSize: 12, maxWidth: 460, margin: '0 auto' }}>
              Change detection needs at least {series.minObservations} days of history to
              establish a baseline before a curve means anything. This model has{' '}
              {series.totalDays} {series.totalDays === 1 ? 'day' : 'days'}{' '}
              ({series.totalRuns} runs) — about {series.daysUntilAvailable} more to go.
            </div>
          </div>
        </div>
      </Section>
    );
  }

  if (!series || series.points.length === 0) {
    return (
      <Section>
        <div className="md-chart-empty">
          <div className="md-chart-empty-inner" style={{ color: 'var(--phosphor-dim)', fontSize: 12 }}>
            No drift data in this period.
          </div>
        </div>
      </Section>
    );
  }

  // ── Chart ─────────────────────────────────────────────────────────────
  const data = series.points.map((p) => ({
    ...p,
    day: fmtDay(p.ts),
    // Separate key so detections render as their own marker layer.
    detection: p.driftDetected ? p.cusum : null,
  }));

  const peak = Math.max(...series.points.map((p) => p.cusum));
  const yMax = Math.max(peak, series.threshold) * 1.15;
  const detectionCount = series.detections.length;
  const latest = series.points[series.points.length - 1];

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
      <div
        style={{
          background: 'var(--terminal-dark)',
          border: '1px solid var(--metal-silver)',
          borderRadius: 6,
          padding: '10px 12px',
          fontSize: 12,
          color: 'var(--phosphor-green)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>
          {new Date(d.ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
        </div>
        <div>CUSUM: <strong>{d.cusum.toFixed(3)}</strong> / {series.threshold.toFixed(2)}</div>
        <div style={{ color: 'var(--phosphor-dim)' }}>
          Daily median score: {d.score.toFixed(1)}
        </div>
        <div style={{ color: 'var(--phosphor-dim)' }}>
          {d.samples} {d.samples === 1 ? 'run' : 'runs'} that day
        </div>
        {d.driftDetected && (
          <div style={{ color: DETECTION, fontWeight: 600, marginTop: 6 }}>
            ▲ Change-point detected
          </div>
        )}
        {!d.armed && (
          <div style={{ marginTop: 6, maxWidth: 230, color: 'var(--phosphor-dim)' }}>
            ⏳ {d.minRequired === series.minObservations ? 'Building baseline' : 'Re-arming after a change-point'}
            {' '}— day {d.n} of {d.minRequired}. The threshold is inactive until the
            baseline is established.
          </div>
        )}
      </div>
    );
  };

  return (
    <Section>
      {/* Period selector */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
        {(Object.keys(PERIOD_LABEL) as CusumPeriod[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: 4,
              border: `1px solid ${period === p ? LINE : 'var(--metal-silver)'}`,
              background: period === p ? 'var(--accent-bg)' : 'transparent',
              color: period === p ? LINE : 'var(--phosphor-dim)',
            }}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--metal-silver)" strokeDasharray="3 3" vertical={false} />

          {/* Warm-up windows: the threshold is inactive here. */}
          {warmupSpans.map((span, i) => (
            <ReferenceArea
              key={`warmup-${i}`}
              x1={span.from}
              x2={span.to}
              fill="var(--phosphor-dim)"
              fillOpacity={0.07}
              stroke="none"
              label={{
                value: span.kind === 'baseline' ? 'BUILDING BASELINE' : 'RE-ARMING',
                position: 'insideTop',
                fill: 'var(--phosphor-dim)',
                fontSize: 9,
              }}
            />
          ))}

          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: 'var(--phosphor-dim)' }}
            stroke="var(--metal-silver)"
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            domain={[0, yMax]}
            tick={{ fontSize: 11, fill: 'var(--phosphor-dim)' }}
            stroke="var(--metal-silver)"
            width={48}
            tickFormatter={(v: number) => v.toFixed(2)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--phosphor-dim)', strokeWidth: 1 }} />

          {/* Reference rule in muted ink, directly labelled — not a third hue. */}
          <ReferenceLine
            y={series.threshold}
            stroke="var(--phosphor-dim)"
            strokeDasharray="6 4"
            strokeWidth={1}
            label={{
              value: `ALERT THRESHOLD ${series.threshold.toFixed(2)}`,
              position: 'insideTopRight',
              fill: 'var(--phosphor-dim)',
              fontSize: 10,
            }}
          />

          <Area
            type="monotone"
            dataKey="cusum"
            stroke="none"
            fill={LINE}
            fillOpacity={0.10}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="cusum"
            stroke={LINE}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: LINE, stroke: 'var(--terminal-dark)', strokeWidth: 2 }}
            isAnimationActive={false}
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

      {/* Reading guide — identity never rests on color alone */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          justifyContent: 'center',
          marginTop: 10,
          fontSize: 11,
          color: 'var(--phosphor-dim)',
        }}
      >
        <span>
          <span style={{ display: 'inline-block', width: 14, height: 2, background: LINE, verticalAlign: 'middle', marginRight: 6 }} />
          Accumulated degradation
        </span>
        <span>
          <span style={{ color: DETECTION, marginRight: 4 }}>▲</span>
          Change-point detected
        </span>
        {warmupSpans.length > 0 && (
          <span>
            <span
              style={{
                display: 'inline-block',
                width: 14,
                height: 10,
                background: 'var(--phosphor-dim)',
                opacity: 0.18,
                verticalAlign: 'middle',
                marginRight: 6,
              }}
            />
            {hasBaselineSpan && hasRearmSpan
              ? 'Building baseline / re-arming (threshold inactive)'
              : hasBaselineSpan
                ? 'Building baseline (threshold inactive)'
                : 'Detector re-arming (threshold inactive)'}
          </span>
        )}
        <span>
          Current: <strong style={{ color: 'var(--phosphor-green)' }}>{latest.cusum.toFixed(3)}</strong>
        </span>
        <span>
          {detectionCount} {detectionCount === 1 ? 'detection' : 'detections'} in view
        </span>
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          lineHeight: 1.6,
          color: 'var(--phosphor-dim)',
          textAlign: 'center',
          maxWidth: 620,
          margin: '10px auto 0',
        }}
      >
        The Page-Hinkley statistic accumulates each day a model scores below its own
        running baseline, and decays when it recovers. A sustained regression pushes
        it past the threshold; ordinary day-to-day noise does not. After a
        change-point the detector resets and spends {series.rearmObservations} days
        re-learning the new baseline — in those shaded windows the threshold is
        inactive by design. Computed over the same hourly series shown in the
        performance timeline above: {series.totalRuns} runs across {series.totalDays} days.
      </div>
    </Section>
  );
}
