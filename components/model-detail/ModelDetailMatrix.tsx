'use client';

import { useState } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip
} from 'recharts';
import { Pane, Empty, Locked, Tag } from '@/components/studio';

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
  { key: 'correctness', label: 'Correctness', weight: '55%', description: 'Did the code work, and on repo tasks did it fix the real defect?' },
  { key: 'stability',   label: 'Stability', weight: '10%', description: 'Same answer run to run' },
  { key: 'edgeCases',   label: 'Edge cases', weight: '10%', description: 'On repo tasks: the hidden tests it never saw' },
  { key: 'debugging',   label: 'Debugging', weight: '10%', description: 'Did it locate the defect rather than patch the symptom?' },
  { key: 'codeQuality', label: 'Code quality', weight: '5%',  description: 'Readability and structure' },
  { key: 'efficiency',  label: 'Efficiency', weight: '5%',  description: 'Output throughput' },
  { key: 'format',      label: 'Format', weight: '3%',  description: 'Guardrail: clean, parseable output' },
  { key: 'safety',      label: 'Safety', weight: '2%',  description: 'Guardrail: no dangerous operations' },
  { key: 'complexity',  label: 'Complexity', weight: '0%',  description: 'Measured, but varies too little between models to rank them' },
];

const TOOLING_AXES: AxisSpec[] = [
  { key: 'taskCompletion',    label: 'Task completion', weight: '30%', description: 'Did the objective actually get done?' },
  { key: 'toolSelection',     label: 'Tool selection', weight: '20%', description: 'Choosing the right tool' },
  { key: 'parameterAccuracy', label: 'Parameter accuracy', weight: '15%', description: 'Calling it with correct arguments' },
  { key: 'efficiency',        label: 'Tool efficiency', weight: '15%', description: 'Without unnecessary calls' },
  { key: 'errorHandling',     label: 'Error handling', weight: '10%', description: 'Recovering when a call fails' },
  { key: 'contextAwareness',  label: 'Context awareness', weight: '5%',  description: 'Carrying earlier output forward' },
  { key: 'safetyCompliance',  label: 'Safety compliance', weight: '5%',  description: 'Avoiding destructive operations' },
];

// Deep-reasoning weights are set per task, so a single percentage would be a fiction. The
// axes are real and measured; the weight column says so instead of inventing a number.
const REASONING_AXES: AxisSpec[] = [
  { key: 'correctness',      label: 'Correctness', weight: 'per task', description: 'Steps that passed their tests or checks' },
  // Since 2026-09-23 the three continuity axes are executable: rules stated once in the
  // conversation (at the start or mid-session), and the decisions a model declares in its own plan, are checked by running
  // code at every later step. They used to compare words (identifier overlap).
  { key: 'memoryRetention',  label: 'Memory retention', weight: 'per task', description: 'Rules stated once in the session, still followed later' },
  { key: 'planCoherence',    label: 'Plan coherence', weight: 'per task', description: 'Code keeps the decisions declared in its own plan' },
  { key: 'contextWindow',    label: 'Context window', weight: 'per task', description: 'Rules from the first message still followed at the end' },
  // `debugging` was correctness under another name and is folded into it; `codeQuality`,
  // `stability` and `safety` are retracted. `edgeCases` is reported only when a code step
  // failed, since recovery cannot be observed otherwise.
  { key: 'edgeCases',        label: 'Recovery', weight: 'per task', description: 'Code passing again after a failed step' },
];

/** Only axes the suite actually reported. No stand-ins, no derived values. */
function measuredMetrics(specs: AxisSpec[], measured: Record<string, number> | undefined, category: string) {
  if (!measured) return [];
  return specs
    .filter(sp => typeof measured[sp.key] === 'number')
    .map(sp => ({ ...sp, value: measured[sp.key] * 100, category }));
}

const tierLabel = (pct: number): string => {
  if (pct >= 90) return 'Elite';
  if (pct >= 80) return 'Excellent';
  if (pct >= 70) return 'Good';
  if (pct >= 60) return 'Fair';
  if (pct >= 40) return 'Poor';
  return 'Critical';
};

/** Same thresholds as ever: 80 and up healthy, 60–80 a warning, under 60 a problem. */
const tierTone = (pct: number): 'good' | 'warn' | 'bad' => (pct >= 80 ? 'good' : pct >= 60 ? 'warn' : 'bad');
const barTone = (pct: number): string => (pct < 60 ? ' is-bad' : pct < 80 ? ' is-warn' : '');

const GROUPS: Array<{ category: string; label: string }> = [
  { category: 'speed', label: 'Coding' },
  { category: 'reasoning', label: 'Reasoning' },
  { category: 'tooling', label: 'Tool use' },
];

const PERIOD_WORDS: Record<string, string> = { '24h': '24 hours', '7d': '7 days', '1m': '1 month' };

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
  const { fullLabel, subject, value } = payload[0].payload;
  return (
    <div className="sm-tip">
      <span className="sm-tip-h">{fullLabel ?? subject}</span>
      <span className="sm-tip-v"><strong>{value.toFixed(1)}%</strong> {tierLabel(value)}</span>
    </div>
  );
};

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ metric }: { metric: MetricDef }) {
  const pct = Math.max(0, Math.min(100, metric.value));
  return (
    <div className="sm-mx-card">
      <div className="sm-mx-top">
        <div>
          <div className="sm-mx-name">
            {metric.label}
            <Tag tone="line" title="Weight in the suite's score">{metric.weight}</Tag>
          </div>
          <div className="sm-mx-desc">{metric.description}</div>
        </div>
        <div className="sm-mx-pct">{pct.toFixed(1)}<small>%</small></div>
      </div>
      <div className="sm-mx-bar" aria-hidden="true"><i className={barTone(pct).trim()} style={{ width: `${pct}%` }} /></div>
      <div className="sm-mx-foot"><Tag tone={tierTone(pct)}>{tierLabel(pct)}</Tag></div>
    </div>
  );
}

// ─── Radar View ───────────────────────────────────────────────────────────────
function RadarView({ metrics }: { metrics: MetricDef[] }) {
  const radarData = metrics.map(m => ({
    subject: m.label.length > 14 ? m.label.substring(0, 13) + '…' : m.label,
    fullLabel: m.label,
    value: Math.max(0, Math.min(100, m.value)),
  }));

  return (
    <div>
      <p className="sm-mx-note">Web chart showing all axes — hover a point for details</p>
      <div className="sm-chart sm-radar">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} margin={{ top: 10, right: 34, bottom: 10, left: 34 }} outerRadius="72%">
            <PolarGrid stroke="var(--lp-line)" gridType="polygon" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--lp-fg2)', fontSize: 11.5, fontWeight: 600 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--lp-fg3)', fontSize: 10.5 }} tickCount={5} stroke="var(--lp-line)" axisLine={false} />
            <Radar
              name="Score"
              dataKey="value"
              stroke="var(--lp-accent)"
              strokeWidth={2}
              fill="var(--lp-accent)"
              fillOpacity={0.14}
              dot={{ fill: 'var(--lp-accent)', stroke: 'var(--lp-card)', strokeWidth: 1.5, r: 3.5 }}
              activeDot={{ fill: 'var(--lp-card)', stroke: 'var(--lp-accent)', strokeWidth: 2.5, r: 5 }}
            />
            <Tooltip content={<RadarTooltip />} wrapperStyle={{ outline: 'none' }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend: every axis with its value, so nothing rests on reading the web alone */}
      <div className="sm-radar-keys">
        {metrics.map(m => {
          const pct = Math.max(0, Math.min(100, m.value));
          return <Tag key={m.key} tone="line"><b>{pct.toFixed(0)}%</b> {m.label}</Tag>;
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
      <Pane title="Performance matrix">
        <Empty title="No performance data available for this period">
          Try selecting a different time period or check back later
        </Empty>
      </Pane>
    );
  }

  let metrics: MetricDef[] = [];
  let title = '';
  let subtitle = '';
  let note = '';

  if (scoringMode === 'speed') {
    title = 'Coding performance matrix';
    subtitle = 'The nine coding measures, with the weight each carries in the coding score';
    if (selectedPeriod !== 'latest') note = 'Averaged over the runs in this period';

    metrics = measuredMetrics(CODING_AXES, axesData.measured, 'speed');
  } else if (scoringMode === 'reasoning') {
    title = 'Reasoning performance matrix';
    subtitle = 'The reasoning measures; each task weights them differently';
    if (selectedPeriod !== 'latest') note = 'Averaged over the runs in this period';

    metrics = measuredMetrics(REASONING_AXES, axesData.measured, 'reasoning');
  } else if (scoringMode === 'tooling') {
    title = 'Tool calling performance matrix';
    subtitle = 'The seven tool-use measures, with the weight each carries in the tool-use score';
    if (selectedPeriod !== 'latest') note = 'Averaged over the runs in this period';

    metrics = measuredMetrics(TOOLING_AXES, axesData.measured, 'tooling');
  } else {
    // combined
    title = 'Combined performance matrix';
    // The combined score is coding 50%, reasoning 25%, tool use 25%. This said "70% Speed
    // Benchmarks + 30% Deep Reasoning", a weighting the site has not used in a long time.
    subtitle = 'Measures from all three suites · combined score: coding 50%, reasoning 25%, tool use 25%';
    if (selectedPeriod !== 'latest') note = 'Averaged over the runs in this period';

    // Combined view: the coding axes are the ones that exist on every model, and the
    // deep/tooling axes appear only when those suites reported for this period.
    metrics = [
      ...measuredMetrics(CODING_AXES, axesData.measured, 'speed'),
      ...measuredMetrics(REASONING_AXES.filter(a => !CODING_AXES.some(c => c.key === a.key)), axesData.measured, 'reasoning'),
      ...measuredMetrics(TOOLING_AXES.filter(a => !CODING_AXES.some(c => c.key === a.key)), axesData.measured, 'tooling'),
    ];
  }

  const titleNode = (
    <>
      {title}
      {selectedPeriod !== 'latest' && <> <Tag>{PERIOD_WORDS[selectedPeriod] ?? selectedPeriod}</Tag></>}
    </>
  );
  const subNode = note ? `${subtitle}. ${note}.` : subtitle;

  // Measured-only: if this suite reported nothing for the period, say so rather than drawing a
  // chart out of whatever other suite happened to have data. The old code could not reach this
  // state because it synthesised every missing axis from a coding one.
  if (metrics.length === 0) {
    return (
      <Pane title={titleNode} sub={subNode}>
        <Empty title="Nothing measured for this view in the selected period">
          This suite has not reported for this model in the chosen timeframe. Try a wider
          period, or a different benchmark view.
        </Empty>
      </Pane>
    );
  }

  // Pro gating, as before: everyone sees the first measure; the rest are Pro.
  const visible = hasProAccess ? metrics : metrics.slice(0, 1);
  const locked = hasProAccess ? [] : metrics.slice(1);
  const groups = GROUPS
    .map(g => ({ ...g, items: visible.filter(m => m.category === g.category) }))
    .filter(g => g.items.length > 0);
  const labelGroups = new Set(metrics.map(m => m.category)).size > 1;
  const lockedNames = locked.map(m => m.label.toLowerCase());
  const lockedList = lockedNames.length > 6
    ? `${lockedNames.slice(0, 5).join(', ')} and ${lockedNames.length - 5} more`
    : lockedNames.join(', ');

  return (
    <Pane
      title={titleNode}
      sub={subNode}
      actions={
        <div className="st-seg" role="group" aria-label="Matrix view">
          <button type="button" aria-pressed={viewMode === 'cards'} onClick={() => setViewMode('cards')}>Cards</button>
          <button type="button" aria-pressed={viewMode === 'radar'} onClick={() => setViewMode('radar')}>Web chart</button>
        </div>
      }
    >
      {/* Card Grid View */}
      {viewMode === 'cards' && (
        hasProAccess ? (
          groups.map(g => (
            <div key={g.category} className="sm-mx-group">
              {labelGroups && <p className="st-label">{g.label}</p>}
              <div className="sm-mx-grid">
                {g.items.map(metric => <MetricCard key={metric.key} metric={metric} />)}
              </div>
            </div>
          ))
        ) : (
          <div className="sm-mx-lockrow">
            {visible.map(metric => <MetricCard key={metric.key} metric={metric} />)}
            {locked.length > 0 && (
              <Locked title="The full performance matrix" onOpen={() => onShowProModal('performance-matrix')}>
                {locked.length} more {locked.length === 1 ? 'measure' : 'measures'} for this view ({lockedList}),
                each with its weight, score and tier.
              </Locked>
            )}
          </div>
        )
      )}

      {/* Radar / Web Chart View */}
      {viewMode === 'radar' && (
        <RadarView metrics={metrics} />
      )}
    </Pane>
  );
}
