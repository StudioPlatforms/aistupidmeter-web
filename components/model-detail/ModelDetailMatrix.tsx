'use client';

import { useState } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip
} from 'recharts';
import ProFeatureBlur from '../ProFeatureBlur';

type ScoringMode = 'combined' | 'reasoning' | 'speed' | 'tooling';
type ViewMode = 'cards' | 'radar';

interface AxesData {
  /** Every axis the suite actually reported, under its real name. Absent = not measured. */
  measured?: Record<string, number>;
  correctness: number;
  spec: number;
  codeQuality: number;
  efficiency: number;
  stability: number;
  refusal: number;
  recovery: number;
}

interface ModelDetailMatrixProps {
  scoringMode: ScoringMode;
  selectedPeriod: string;
  axesData: AxesData | null;
  hasProAccess: boolean;
  onShowProModal: (feature: 'historical-data' | 'performance-matrix') => void;
}

/**
 * What each suite actually measures, and what it is worth.
 *
 * These lists used to be derived rather than measured: "LOGICAL REASONING" was
 * `correctness + 5`, "PROBLEM DECOMP." was `spec + 8`, "TOOL SELECTION" was `correctness + 6`.
 * Seven of the reasoning and tooling rows were arithmetic on an unrelated coding axis plus a
 * constant, presented to the reader as a measured capability with a weight beside it.
 *
 * They are now read from the axes the suite reported. An axis that was not measured is not
 * shown at all, rather than being reconstructed from one that was.
 */
interface AxisSpec { key: string; label: string; weight: string; description: string; }

const CODING_AXES: AxisSpec[] = [
  { key: 'correctness', label: 'CORRECTNESS', weight: '55%', description: 'Did the code work, and on repo tasks did it fix the real defect?' },
  { key: 'stability',   label: 'STABILITY', weight: '10%', description: 'Same answer run to run' },
  { key: 'edgeCases',   label: 'EDGE CASES', weight: '10%', description: 'On repo tasks: the hidden tests it never saw' },
  { key: 'debugging',   label: 'DEBUGGING', weight: '10%', description: 'Did it locate the defect rather than patch the symptom?' },
  { key: 'codeQuality', label: 'CODE QUALITY', weight: '5%',  description: 'Readability and structure' },
  { key: 'efficiency',  label: 'EFFICIENCY', weight: '5%',  description: 'Output throughput' },
  { key: 'format',      label: 'FORMAT', weight: '3%',  description: 'Guardrail: clean, parseable output' },
  { key: 'safety',      label: 'SAFETY', weight: '2%',  description: 'Guardrail: no dangerous operations' },
  { key: 'complexity',  label: 'COMPLEXITY', weight: '0%',  description: 'Measured, but varies too little between models to rank them' },
];

const TOOLING_AXES: AxisSpec[] = [
  { key: 'taskCompletion',    label: 'TASK COMPLETION', weight: '30%', description: 'Did the objective actually get done?' },
  { key: 'toolSelection',     label: 'TOOL SELECTION', weight: '20%', description: 'Choosing the right tool' },
  { key: 'parameterAccuracy', label: 'PARAM ACCURACY', weight: '15%', description: 'Calling it with correct arguments' },
  { key: 'efficiency',        label: 'TOOL EFFICIENCY', weight: '15%', description: 'Without unnecessary calls' },
  { key: 'errorHandling',     label: 'ERROR HANDLING', weight: '10%', description: 'Recovering when a call fails' },
  { key: 'contextAwareness',  label: 'CTX AWARENESS', weight: '5%',  description: 'Carrying earlier output forward' },
  { key: 'safetyCompliance',  label: 'SAFETY COMPLNC.', weight: '5%',  description: 'Avoiding destructive operations' },
];

// Deep-reasoning weights are set per task, so a single percentage would be a fiction. The
// axes are real and measured; the weight column says so instead of inventing a number.
const REASONING_AXES: AxisSpec[] = [
  { key: 'correctness',      label: 'CORRECTNESS', weight: 'per task', description: 'Did the session reach a working result?' },
  { key: 'memoryRetention',  label: 'MEMORY RETENTION', weight: 'per task', description: 'Carrying commitments across turns' },
  { key: 'planCoherence',    label: 'PLAN COHERENCE', weight: 'per task', description: 'Staying consistent with its own plan' },
  { key: 'contextWindow',    label: 'CONTEXT WINDOW', weight: 'per task', description: 'Using what was established earlier' },
  { key: 'debugging',        label: 'DEBUGGING', weight: 'per task', description: 'Fixing what it broke' },
  { key: 'stability',        label: 'STABILITY', weight: 'per task', description: 'Consistency across the session' },
];

/** Only axes the suite actually reported. No stand-ins, no derived values. */
function measuredMetrics(specs: AxisSpec[], measured: Record<string, number> | undefined, category: string) {
  if (!measured) return [];
  return specs
    .filter(sp => typeof measured[sp.key] === 'number')
    .map(sp => ({ ...sp, value: measured[sp.key] * 100, category }));
}

const tierLabel = (pct: number): string => {
  if (pct >= 90) return 'ELITE';
  if (pct >= 80) return 'EXCELLENT';
  if (pct >= 70) return 'GOOD';
  if (pct >= 60) return 'FAIR';
  if (pct >= 40) return 'POOR';
  return 'CRITICAL';
};

const pctColor = (pct: number): string =>
  pct >= 80 ? 'var(--phosphor-green)' : pct >= 60 ? 'var(--amber-warning)' : 'var(--red-alert)';

const barColor = (pct: number, category: string): string => {
  if (pct < 60) return 'var(--red-alert)';
  if (pct < 80) return 'var(--amber-warning)';
  switch (category) {
    case 'speed': return 'var(--phosphor-green)';
    case 'reasoning': return '#8a2be2';
    case 'tooling': return '#ff8c00';
    default: return 'var(--phosphor-green)';
  }
};

const bgFill = (pct: number, category: string): string => {
  if (pct < 60) return 'rgba(255, 45, 0, 0.08)';
  if (pct < 80) return 'rgba(255, 176, 0, 0.08)';
  switch (category) {
    case 'speed': return 'rgba(26, 115, 232, 0.08)';
    case 'reasoning': return 'rgba(138, 43, 226, 0.08)';
    case 'tooling': return 'rgba(255, 140, 0, 0.08)';
    default: return 'rgba(26, 115, 232, 0.08)';
  }
};

const radarColor = (category: string): string => {
  switch (category) {
    case 'reasoning': return '#8a2be2';
    case 'tooling': return '#ff8c00';
    default: return '#1a73e8';
  }
};

interface MetricDef {
  key: string;
  label: string;
  weight: string;
  description: string;
  value: number;
  category: string;
}

// ─── Radar Chart Custom Tooltip ───────────────────────────────────────────────
const RadarTooltip = ({ active, payload }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  const { subject, value } = payload[0].payload;
  return (
    <div style={{
      background: 'var(--terminal-dark)',
      border: '1px solid var(--metal-silver)',
      borderRadius: '10px',
      padding: '8px 12px',
      fontSize: '11px',
      fontFamily: 'var(--font-mono)',
      boxShadow: '0 4px 14px rgba(60,64,67,0.18)',
    }}>
      <div style={{ color: '#1a73e8', fontWeight: 'bold', marginBottom: '3px' }}>{subject}</div>
      <div style={{ color: pctColor(value) }}>{value.toFixed(1)}% — {tierLabel(value)}</div>
    </div>
  );
};

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ metric, index, hasProAccess, onShowProModal }: {
  metric: MetricDef;
  index: number;
  hasProAccess: boolean;
  onShowProModal: (f: 'historical-data' | 'performance-matrix') => void;
}) {
  const pct = Math.max(0, Math.min(100, metric.value));
  const color = pctColor(pct);
  const bar = barColor(pct, metric.category);
  const bg = bgFill(pct, metric.category);

  const card = (
    <div className={`md-metric-card category-${metric.category}`}>
      <div className="md-metric-bg" style={{ width: `${pct}%`, background: bg }} />
      <div className="md-metric-content">
        <div className="md-metric-top">
          <div className="md-metric-left">
            <div className="md-metric-name">
              <span className="md-metric-label">{metric.label}</span>
              <span className="md-metric-weight">({metric.weight})</span>
            </div>
            <div className="md-metric-desc">{metric.description}</div>
          </div>
          <div className="md-metric-pct" style={{ color }}>
            {pct.toFixed(1)}%
          </div>
        </div>
        <div className="md-metric-bar-track">
          <div
            className="md-metric-bar-fill"
            style={{ width: `${pct}%`, background: bar, boxShadow: `0 0 5px ${bar}` }}
          />
        </div>
        <div className="md-metric-tier">{tierLabel(pct)}</div>
      </div>
    </div>
  );

  if (index === 0 || hasProAccess) return card;

  return (
    <ProFeatureBlur
      key={metric.key}
      isLocked={true}
      onUnlock={() => onShowProModal('performance-matrix')}
      title="Performance Matrix"
    >
      {card}
    </ProFeatureBlur>
  );
}

// ─── Radar View ───────────────────────────────────────────────────────────────
function RadarView({ metrics, category }: { metrics: MetricDef[]; category: string }) {
  const radarData = metrics.map(m => ({
    subject: m.label.length > 12 ? m.label.substring(0, 12) + '…' : m.label,
    fullLabel: m.label,
    value: Math.max(0, Math.min(100, m.value)),
  }));

  const stroke = radarColor(category);

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{
        fontSize: '10px',
        color: 'var(--phosphor-dim)',
        textAlign: 'center',
        marginBottom: '12px',
      }}>
        Web chart showing all axes — hover a point for details
      </div>
      <ResponsiveContainer width="100%" height={380}>
        <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid
            stroke="rgba(192, 192, 192, 0.15)"
            gridType="polygon"
          />
          <PolarAngleAxis
            dataKey="subject"
            tick={{
              fill: 'var(--phosphor-dim)',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              fontWeight: 'bold',
            }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fill: 'var(--phosphor-dim)', fontSize: 8, fontFamily: 'var(--font-mono)' }}
            tickCount={5}
            stroke="rgba(192, 192, 192, 0.1)"
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke={stroke}
            fill={stroke}
            fillOpacity={0.15}
            dot={{ fill: stroke, strokeWidth: 2, r: 4 }}
            activeDot={{ fill: stroke, strokeWidth: 2, r: 6, style: { filter: `drop-shadow(0 0 6px ${stroke})` } }}
          />
          <Tooltip content={<RadarTooltip />} />
        </RadarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        justifyContent: 'center',
        padding: '8px 16px',
        marginTop: '8px',
      }}>
        {metrics.map(m => {
          const pct = Math.max(0, Math.min(100, m.value));
          return (
            <div key={m.key} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '9px',
              color: 'var(--phosphor-dim)',
              padding: '3px 8px',
              border: '1px solid rgba(192, 192, 192, 0.1)',
              background: 'rgba(0,0,0,0.04)',
            }}>
              <span style={{ color: pctColor(pct), fontWeight: 'bold' }}>{pct.toFixed(0)}%</span>
              <span>{m.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ModelDetailMatrix({
  scoringMode,
  selectedPeriod,
  axesData,
  hasProAccess,
  onShowProModal,
}: ModelDetailMatrixProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  if (!axesData) {
    return (
      <div className="md-matrix-section">
        <div className="md-matrix-empty">
          <div style={{ color: 'var(--red-alert)', fontWeight: 'bold', marginBottom: '8px' }}>
            No performance data available for this period
          </div>
          <div style={{ color: 'var(--phosphor-dim)', fontSize: '11px' }}>
            Try selecting a different time period or check back later
          </div>
        </div>
      </div>
    );
  }

  let metrics: MetricDef[] = [];
  let title = '';
  let subtitle = '';
  let note = '';
  let primaryCategory = 'speed';

  const periodLabel = selectedPeriod === 'latest' ? ''
    : selectedPeriod === '24h' ? '(24H)'
    : selectedPeriod === '7d' ? '(7D)'
    : '(1M)';

  if (scoringMode === 'speed') {
    title = `7-AXIS PERFORMANCE MATRIX ${periodLabel}`;
    subtitle = selectedPeriod === 'latest'
      ? 'Comprehensive analysis across all evaluation criteria'
      : 'Performance breakdown for the selected period';
    if (selectedPeriod !== 'latest') note = 'Showing metrics averaged across benchmarks within this timeframe';
    primaryCategory = 'speed';

    metrics = measuredMetrics(CODING_AXES, axesData.measured, 'speed');
  } else if (scoringMode === 'reasoning') {
    title = `REASONING PERFORMANCE MATRIX ${periodLabel}`;
    subtitle = selectedPeriod === 'latest'
      ? 'Deep reasoning and complex problem-solving analysis'
      : 'Reasoning performance for the selected period';
    if (selectedPeriod !== 'latest') note = 'Showing metrics from best-performing deep reasoning tests within this timeframe';
    primaryCategory = 'reasoning';

    metrics = measuredMetrics(REASONING_AXES, axesData.measured, 'reasoning');
  } else if (scoringMode === 'tooling') {
    title = `TOOL CALLING PERFORMANCE MATRIX ${periodLabel}`;
    subtitle = selectedPeriod === 'latest'
      ? 'Advanced tool usage and API interaction capabilities'
      : 'Tool calling performance for the selected period';
    if (selectedPeriod !== 'latest') note = 'Showing metrics from best-performing tool calling benchmarks within this timeframe';
    primaryCategory = 'tooling';

    metrics = measuredMetrics(TOOLING_AXES, axesData.measured, 'tooling');
  } else {
    // combined
    title = `COMBINED PERFORMANCE MATRIX ${periodLabel}`;
    subtitle = selectedPeriod === 'latest'
      ? 'Unified analysis: 70% Speed Benchmarks + 30% Deep Reasoning'
      : 'Combined performance for the selected period';
    if (selectedPeriod !== 'latest') note = 'Showing balanced metrics from both rapid coding tasks and complex reasoning challenges';
    primaryCategory = 'speed';

    // Combined view: the coding axes are the ones that exist on every model, and the
    // deep/tooling axes appear only when those suites reported for this period.
    metrics = [
      ...measuredMetrics(CODING_AXES, axesData.measured, 'speed'),
      ...measuredMetrics(REASONING_AXES.filter(a => !CODING_AXES.some(c => c.key === a.key)), axesData.measured, 'reasoning'),
      ...measuredMetrics(TOOLING_AXES.filter(a => !CODING_AXES.some(c => c.key === a.key)), axesData.measured, 'tooling'),
    ];
  }

  // Measured-only: if this suite reported nothing for the period, say so rather than drawing a
  // chart out of whatever other suite happened to have data. The old code could not reach this
  // state because it synthesised every missing axis from a coding one.
  if (metrics.length === 0) {
    return (
      <div className="md-matrix-section">
        <div className="md-matrix-empty">
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            Nothing measured for this view in the selected period
          </div>
          <div style={{ fontSize: '11px', opacity: 0.8 }}>
            This suite has not reported for this model in the chosen timeframe. Try a wider
            period, or a different benchmark view.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="md-matrix-section">
      <div className="md-matrix-header">
        <div className="md-matrix-title">{title}</div>
        <div className="md-matrix-sub">{subtitle}</div>
        {note && <div className="md-matrix-note">{note}</div>}

        {/* View toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1px', marginTop: '12px' }}>
          <button
            onClick={() => setViewMode('cards')}
            style={{
              padding: '5px 16px',
              fontSize: '10px',
              fontWeight: 'bold',
              border: '1px solid rgba(192,192,192,0.25)',
              background: viewMode === 'cards' ? 'var(--phosphor-green)' : 'var(--terminal-black)',
              color: viewMode === 'cards' ? 'var(--terminal-black)' : 'var(--phosphor-dim)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              transition: 'all 0.15s',
            }}
          >
            CARDS
          </button>
          <button
            onClick={() => setViewMode('radar')}
            style={{
              padding: '5px 16px',
              fontSize: '10px',
              fontWeight: 'bold',
              border: '1px solid rgba(192,192,192,0.25)',
              background: viewMode === 'radar' ? radarColor(primaryCategory) : 'var(--terminal-black)',
              color: viewMode === 'radar' ? 'var(--terminal-black)' : 'var(--phosphor-dim)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              transition: 'all 0.15s',
            }}
          >
            WEB CHART
          </button>
        </div>
      </div>

      {/* Card Grid View */}
      {viewMode === 'cards' && (
        <div className="md-matrix-grid">
          {metrics.map((metric, index) => (
            <MetricCard
              key={metric.key}
              metric={metric}
              index={index}
              hasProAccess={hasProAccess}
              onShowProModal={onShowProModal}
            />
          ))}
        </div>
      )}

      {/* Radar / Web Chart View */}
      {viewMode === 'radar' && (
        <RadarView metrics={metrics} category={primaryCategory} />
      )}
    </div>
  );
}
