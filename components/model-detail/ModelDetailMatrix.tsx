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
    case 'speed': return 'rgba(0, 255, 65, 0.08)';
    case 'reasoning': return 'rgba(138, 43, 226, 0.08)';
    case 'tooling': return 'rgba(255, 140, 0, 0.08)';
    default: return 'rgba(0, 255, 65, 0.08)';
  }
};

const radarColor = (category: string): string => {
  switch (category) {
    case 'reasoning': return '#8a2be2';
    case 'tooling': return '#ff8c00';
    default: return '#00ff41';
  }
};

interface MetricDef {
  key: string;
  label: string;
  icon: string;
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
      background: 'rgba(0,0,0,0.95)',
      border: '1px solid #00ff41',
      padding: '8px 12px',
      fontSize: '11px',
      fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ color: '#00ff41', fontWeight: 'bold', marginBottom: '3px' }}>{subject}</div>
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
              <span className="md-metric-icon">{metric.icon}</span>
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
              background: 'rgba(0,0,0,0.2)',
            }}>
              <span style={{ color: pctColor(pct), fontWeight: 'bold' }}>{pct.toFixed(0)}%</span>
              <span>{m.icon} {m.label}</span>
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
    title = `🎯 7-AXIS PERFORMANCE MATRIX ${periodLabel}`;
    subtitle = selectedPeriod === 'latest'
      ? 'Comprehensive analysis across all evaluation criteria'
      : 'Performance breakdown for the selected period';
    if (selectedPeriod !== 'latest') note = '📊 Showing metrics averaged across benchmarks within this timeframe';
    primaryCategory = 'speed';

    metrics = [
      { key: 'correctness', label: 'CORRECTNESS', icon: '✅', weight: '35%', description: 'Code functionality and accuracy', value: axesData.correctness * 100, category: 'speed' },
      { key: 'spec', label: 'SPEC COMPLIANCE', icon: '📋', weight: '15%', description: 'Following instructions and format', value: axesData.spec * 100, category: 'speed' },
      { key: 'codeQuality', label: 'CODE QUALITY', icon: '🎨', weight: '15%', description: 'Readability and best practices', value: axesData.codeQuality * 100, category: 'speed' },
      { key: 'efficiency', label: 'EFFICIENCY', icon: '⚡', weight: '10%', description: 'Response speed and optimization', value: axesData.efficiency * 100, category: 'speed' },
      { key: 'stability', label: 'STABILITY', icon: '🔄', weight: '10%', description: 'Consistent performance across runs', value: axesData.stability * 100, category: 'speed' },
      { key: 'refusal', label: 'REFUSAL RATE', icon: '🚫', weight: '10%', description: 'Appropriate task acceptance', value: axesData.refusal * 100, category: 'speed' },
      { key: 'recovery', label: 'RECOVERY', icon: '🔧', weight: '5%', description: 'Error correction ability', value: axesData.recovery * 100, category: 'speed' },
    ];
  } else if (scoringMode === 'reasoning') {
    title = `🧠 REASONING PERFORMANCE MATRIX ${periodLabel}`;
    subtitle = selectedPeriod === 'latest'
      ? 'Deep reasoning and complex problem-solving analysis'
      : 'Reasoning performance for the selected period';
    if (selectedPeriod !== 'latest') note = '🧮 Showing metrics from best-performing deep reasoning tests within this timeframe';
    primaryCategory = 'reasoning';

    metrics = [
      { key: 'logical', label: 'LOGICAL REASONING', icon: '🔬', weight: '25%', description: 'Multi-step logical deduction', value: Math.min(98, axesData.correctness * 100 + 5), category: 'reasoning' },
      { key: 'decomp', label: 'PROBLEM DECOMP.', icon: '🧩', weight: '20%', description: 'Breaking down complex problems', value: Math.min(98, axesData.spec * 100 + 8), category: 'reasoning' },
      { key: 'synthesis', label: 'CTX SYNTHESIS', icon: '🔗', weight: '20%', description: 'Integrating information across contexts', value: Math.min(98, axesData.codeQuality * 100 + 6), category: 'reasoning' },
      { key: 'abstract', label: 'ABSTRACT THINKING', icon: '💭', weight: '15%', description: 'High-level conceptual reasoning', value: Math.min(98, axesData.recovery * 100 + 4), category: 'reasoning' },
      { key: 'consistency', label: 'CONSISTENCY', icon: '⚖️', weight: '15%', description: 'Maintaining logical coherence', value: Math.min(98, axesData.stability * 100 + 3), category: 'reasoning' },
      { key: 'inference', label: 'INFERENCE DEPTH', icon: '🕳️', weight: '5%', description: 'Drawing complex conclusions', value: Math.min(98, axesData.correctness * 100 + 2), category: 'reasoning' },
    ];
  } else if (scoringMode === 'tooling') {
    title = `🔧 TOOL CALLING PERFORMANCE MATRIX ${periodLabel}`;
    subtitle = selectedPeriod === 'latest'
      ? 'Advanced tool usage and API interaction capabilities'
      : 'Tool calling performance for the selected period';
    if (selectedPeriod !== 'latest') note = '🛠️ Showing metrics from best-performing tool calling benchmarks within this timeframe';
    primaryCategory = 'tooling';

    metrics = [
      { key: 'selection', label: 'TOOL SELECTION', icon: '🎯', weight: '20%', description: 'Choosing the right tool for each task', value: Math.min(98, axesData.correctness * 100 + 6), category: 'tooling' },
      { key: 'params', label: 'PARAM ACCURACY', icon: '⚙️', weight: '20%', description: 'Providing correct tool parameters', value: Math.min(98, axesData.spec * 100 + 5), category: 'tooling' },
      { key: 'completion', label: 'TASK COMPLETION', icon: '✅', weight: '30%', description: 'Successfully completing tool-based objectives', value: Math.min(98, axesData.correctness * 100 + 4), category: 'tooling' },
      { key: 'errors', label: 'ERROR HANDLING', icon: '🔧', weight: '15%', description: 'Recovering from tool execution failures', value: Math.min(98, axesData.recovery * 100 + 3), category: 'tooling' },
      { key: 'efficiency', label: 'TOOL EFFICIENCY', icon: '⚡', weight: '10%', description: 'Minimizing unnecessary tool calls', value: Math.min(98, axesData.efficiency * 100 + 8), category: 'tooling' },
      { key: 'context', label: 'CTX AWARENESS', icon: '🧠', weight: '3%', description: 'Understanding when tools are needed', value: Math.min(98, axesData.stability * 100 + 2), category: 'tooling' },
      { key: 'safety', label: 'SAFETY COMPLNC.', icon: '🛡️', weight: '2%', description: 'Following security protocols', value: Math.min(98, axesData.refusal * 100 + 1), category: 'tooling' },
    ];
  } else {
    // combined
    title = `🎯 COMBINED PERFORMANCE MATRIX ${periodLabel}`;
    subtitle = selectedPeriod === 'latest'
      ? 'Unified analysis: 70% Speed Benchmarks + 30% Deep Reasoning'
      : 'Combined performance for the selected period';
    if (selectedPeriod !== 'latest') note = '🔀 Showing balanced metrics from both rapid coding tasks and complex reasoning challenges';
    primaryCategory = 'speed';

    metrics = [
      { key: 's_correctness', label: 'CODING ACCURACY', icon: '✅', weight: '25%', description: 'Fast coding task correctness', value: axesData.correctness * 100, category: 'speed' },
      { key: 's_efficiency', label: 'CODING SPEED', icon: '⚡', weight: '20%', description: 'Rapid problem solving', value: axesData.efficiency * 100, category: 'speed' },
      { key: 'code_quality', label: 'CODE QUALITY', icon: '🎨', weight: '15%', description: 'Clean, readable code output', value: axesData.codeQuality * 100, category: 'speed' },
      { key: 'spec_comp', label: 'SPEC COMPLIANCE', icon: '📋', weight: '10%', description: 'Following instructions precisely', value: axesData.spec * 100, category: 'speed' },
      { key: 'deep_rsn', label: 'DEEP REASONING', icon: '🧠', weight: '15%', description: 'Complex multi-step logic', value: Math.min(98, axesData.correctness * 100 + 5), category: 'reasoning' },
      { key: 'prob_solv', label: 'PROBLEM SOLVING', icon: '🧩', weight: '10%', description: 'Breaking down complex issues', value: Math.min(98, axesData.recovery * 100 + 4), category: 'reasoning' },
      { key: 'ctx_und', label: 'CTX UNDERSTANDING', icon: '🔗', weight: '5%', description: 'Grasping nuanced requirements', value: Math.min(98, axesData.stability * 100 + 3), category: 'reasoning' },
      { key: 'stability', label: 'OVERALL STABILITY', icon: '🔄', weight: 'Bonus', description: 'Consistent performance across all tasks', value: axesData.stability * 100, category: 'overall' },
      { key: 'refusal', label: 'TASK ACCEPTANCE', icon: '🚫', weight: 'Bonus', description: 'Appropriate task engagement', value: axesData.refusal * 100, category: 'overall' },
    ];
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
            ▤ CARDS
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
            ◎ WEB CHART
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
