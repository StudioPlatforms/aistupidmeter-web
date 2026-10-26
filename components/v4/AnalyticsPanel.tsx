'use client';

import { routerPrice } from '@/lib/pricing-display';


import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { getModelPricing } from '../../lib/model-pricing';
import { PLANS } from '@/lib/entitlements';
import { REQUIRED_PLAN } from '@/lib/capabilities';
import { Locked } from '../studio';
import '../../styles/studio-boards.css';

interface AnalyticsPanelProps {
  modelScores: any[];
  transparencyMetrics: any;
  modelHistoryData: Map<string, any[]>;
  leaderboardSortBy: string;
  leaderboardPeriod: string;
  /** A free account (lib/capabilities 'board-insights'): radar, heatmap and prices become one Pro card. */
  locked?: boolean;
  /** False for subscribers: the Smart Router plan card is not shown. */
  showRouterAd?: boolean;
  onUnlock?: () => void;
}

// Combined/Speed benchmark: 9 axes (suite=combined & suite=hourly)
const combinedAxisLabels = ['CORR', 'CMPL', 'QUAL', 'EFF', 'STBL', 'EDGE', 'DBG', 'FMT', 'SAFE'];
const combinedAxisFullNames = ['Correctness', 'Complexity', 'Code Quality', 'Efficiency', 'Stability', 'Edge Cases', 'Debugging', 'Format', 'Safety'];

/**
 * How much each axis actually moves the published score, so a reader can tell what they are
 * looking at. Two of these need saying out loud rather than being inferred from a radar shape:
 *
 *   Complexity carries NO weight. It varies by four thousandths across all 24 ranked models,
 *   which means it cannot change anyone's position. It is still measured and still shown --
 *   it just does not pretend to rank you. It used to carry 20%.
 *
 *   Efficiency carries no weight either (5% until 2026-10-12, moved to correctness). It is
 *   output tokens per second, and output includes the hidden reasoning, so it rewarded a model
 *   for thinking at length rather than for answering quickly.
 *
 *   Format and Safety are guardrails. They sit near 100% for everybody by design; their job is
 *   to cost a model points if it ever starts emitting malformed or dangerous code. Reading the
 *   same for everyone is the intended outcome, not a broken axis.
 */
const combinedAxisWeights: Record<string, number> = {
  Correctness: 60, Stability: 10, 'Edge Cases': 10, Debugging: 10,
  'Code Quality': 5, Efficiency: 0, Format: 3, Safety: 2, Complexity: 0,
};

/** Why a measured axis carries no weight, in the tooltip's words. */
const unweightedReason: Record<string, string> = {
  Complexity: 'cannot separate models',
  Efficiency: 'hidden reasoning counts as output',
};

/** Label for a tooltip: "Correctness — 60% of score" / "Complexity — measured, not scored". */
export function axisWeightLabel(fullName: string): string {
  const w = combinedAxisWeights[fullName];
  if (w === undefined) return fullName;
  if (w === 0) return `${fullName} — measured, not scored (${unweightedReason[fullName] ?? 'carries no weight'})`;
  if (fullName === 'Format' || fullName === 'Safety') return `${fullName} — ${w}% of score (guardrail)`;
  return `${fullName} — ${w}% of score`;
}
const combinedAxKeys = ['correctness', 'complexity', 'codeQuality', 'efficiency', 'stability', 'edgeCases', 'debugging', 'format', 'safety'];

// Reasoning benchmark: 5 axes (suite=deep) since 2026-09-23 — correctness, recovery, and three
// continuity axes checked by running code against rules stated early and decisions the model
// declared. debugging was folded into correctness; codeQuality, stability and safety retracted.
const reasoningAxisLabels = ['CORR', 'RECOV', 'CTX', 'MEM', 'PLAN'];
const reasoningAxisFullNames = ['Correctness', 'Recovery', 'Context Window', 'Memory Retention', 'Plan Coherence'];
const reasoningAxKeys = ['correctness', 'edgeCases', 'contextWindow', 'memoryRetention', 'planCoherence'];

// Tooling benchmark: 7 different axes (suite=tooling)
const toolingAxisLabels = ['TOOL', 'PARAM', 'ERR', 'TASK', 'EFF', 'CTX', 'SAFE'];
const toolingAxisFullNames = ['Tool Selection', 'Parameter Accuracy', 'Error Handling', 'Task Completion', 'Efficiency', 'Context Awareness', 'Safety Compliance'];
const toolingAxKeys = ['toolSelection', 'parameterAccuracy', 'errorHandling', 'taskCompletion', 'efficiency', 'contextAwareness', 'safetyCompliance'];

// Mode-specific axis configurations (9 axes: CORR, CMPL, QUAL, EFF, STBL, EDGE, DBG, FMT, SAFE)
export const modeConfig: Record<string, {
  title: string;
  subtitle: string;
  heatmapTitle: string;
  axisIndices: number[];  // which of the 9 axes to show
  highlightIndices: number[];  // which axes to visually emphasize
  showHeatmap: boolean;  // whether to show full heatmap grid (false for tooling)
}> = {
  combined: {
    title: 'Performance radar',
    subtitle: 'Top 3 vs Bottom 3 across all dimensions',
    heatmapTitle: 'Benchmark heatmap',
    axisIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    highlightIndices: [],
    showHeatmap: true,
  },
  reasoning: {
    title: 'Deep reasoning radar',
    subtitle: 'All 5 reasoning axes; continuity is checked by running code',
    heatmapTitle: 'Deep reasoning heatmap',
    axisIndices: [0, 1, 2, 3, 4], // 5 reasoning axes
    highlightIndices: [2, 3, 4], // continuity axes: contextWindow, memory, plan
    showHeatmap: true,
  },
  speed: {
    title: 'Coding radar',
    subtitle: 'The nine coding measures; efficiency and stability highlighted',
    heatmapTitle: 'Coding heatmap',
    axisIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    highlightIndices: [3, 4], // efficiency, stability
    showHeatmap: true,
  },
  tooling: {
    title: 'Tool calling radar',
    subtitle: 'Tool selection, params, error handling, completion',
    heatmapTitle: 'Tool calling heatmap',
    axisIndices: [0, 1, 2, 3, 4, 5, 6], // 7 tooling axes
    highlightIndices: [0, 3], // toolSelection, taskCompletion
    showHeatmap: true,
  },
  price: {
    title: 'Cost-efficiency radar',
    subtitle: 'The nine coding measures; cost is in the price-performance table',
    heatmapTitle: 'Cost-efficiency heatmap',
    axisIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    highlightIndices: [3], // efficiency
    showHeatmap: true,
  },
};

/** The axis set a sort shows: Combined, Coding and Price use the nine coding axes; Reasoning and Tool use their own. */
export function axesForSort(sortBy: string) {
  const config = modeConfig[sortBy] || modeConfig.combined;
  const isTooling = sortBy === 'tooling';
  const isReasoning = sortBy === 'reasoning';
  const baseLabels = isTooling ? toolingAxisLabels : isReasoning ? reasoningAxisLabels : combinedAxisLabels;
  const baseFullNames = isTooling ? toolingAxisFullNames : isReasoning ? reasoningAxisFullNames : combinedAxisFullNames;
  const baseAxKeys = isTooling ? toolingAxKeys : isReasoning ? reasoningAxKeys : combinedAxKeys;
  return {
    config,
    axisLabels: config.axisIndices.map(i => baseLabels[i]).filter(Boolean),
    axisFullNames: config.axisIndices.map(i => baseFullNames[i]).filter(Boolean),
    axKeys: config.axisIndices.map(i => baseAxKeys[i]).filter(Boolean),
  };
}

export const scoreColor = (v: number) =>
  v >= 80 ? 'var(--lp-good)' : v >= 65 ? 'var(--lp-warn)' : 'var(--lp-bad)';

export const scoreBg = (v: number) =>
  v >= 80 ? 'var(--lp-good-bg)' : v >= 65 ? 'var(--lp-warn-bg)' : 'var(--lp-bad-bg)';

/** The same three bands as a tag tone (styles/studio.css .st-tag.is-good / is-warn / is-bad). */
const scoreTone = (v: number) => (v >= 80 ? 'is-good' : v >= 65 ? 'is-warn' : 'is-bad');

// OFFICIAL VERIFIED pricing (Feb 17, 2026) - USD per 1M tokens
// Pricing comes from the shared table in lib/model-pricing.ts so this panel
// cannot disagree with the leaderboard or the model detail page.

// Average axes across all history entries for the selected period
export function getAveragedAxes(history: any[]): Record<string, number> {
  const entriesWithAxes = history.filter((h: any) => h.axes && typeof h.axes === 'object');
  if (entriesWithAxes.length === 0) return {};
  if (entriesWithAxes.length === 1) return entriesWithAxes[0].axes;

  // Collect all axis keys and average their values
  const allKeys = new Set<string>();
  entriesWithAxes.forEach(e => Object.keys(e.axes).forEach(k => allKeys.add(k)));

  const result: Record<string, number> = {};
  allKeys.forEach(key => {
    const vals = entriesWithAxes
      .map(e => e.axes[key])
      .filter((v): v is number => typeof v === 'number');
    if (vals.length > 0) {
      result[key] = vals.reduce((s, v) => s + v, 0) / vals.length;
    }
  });
  return result;
}

export default function AnalyticsPanel({
  modelScores,
  transparencyMetrics,
  modelHistoryData,
  leaderboardSortBy,
  leaderboardPeriod,
  locked = false,
  showRouterAd = true,
  onUnlock,
}: AnalyticsPanelProps) {
  const { data: session } = useSession();
  const available = modelScores.filter(m => typeof m.currentScore === 'number' && m.currentScore > 0);

  // Get mode config — pick the right axis set per benchmark suite
  const { config, axisLabels, axisFullNames, axKeys } = axesForSort(leaderboardSortBy);

  // Sort for radar: top 3 and bottom 3
  const sorted = [...available].sort((a, b) => (b.currentScore as number) - (a.currentScore as number));
  const top3 = sorted.slice(0, 3);
  const bottom3 = sorted.slice(-3).reverse();
  const radarModels = [...top3, ...bottom3];
  const radarColors = ['#1a73e8', '#12b5cb', '#7c4dff', '#f9ab00', '#9aa0a6', '#d93025'];

  // Price-performance
  const priceData = available.map(m => {
    const pricing = getModelPricing(m.name, m.provider);
    const cost = pricing.input * 0.4 + pricing.output * 0.6;
    const value = cost > 0 ? (m.currentScore as number) / cost : 0;
    return { ...m, pricing, cost, value };
  }).sort((a, b) => b.value - a.value);

  // Period label for display
  const periodLabel = leaderboardPeriod === 'latest' ? 'Latest' : leaderboardPeriod === '24h' ? '24 hours' : leaderboardPeriod === '7d' ? '7 days' : '1 month';
  const waiting = modelHistoryData.size === 0;

  /** One model's axes as small tags, for the reasoning and tool-use breakdowns. */
  const axisTags = (pairs: [string, number | null][], none: string) => {
    const shown = pairs.filter(([, v]) => v !== null) as [string, number][];
    if (shown.length === 0) return <span className="sl-dim" style={{ fontSize: 12.5 }}>{none}</span>;
    return shown.map(([label, v]) => <span key={label} className={`st-tag ${scoreTone(v)}`}>{label} {v}</span>);
  };
  const pct = (axes: any, k: string) => (typeof axes[k] === 'number' ? Math.round(axes[k] * 100) : null);

  return (
    <div className="v4-panel v4-right-panel sl-rail">
      <div className="sl-rail-head">
        <p className="st-label">Analytics</p>
        <span className="st-tag is-accent">{periodLabel}</span>
      </div>

      {locked ? (
        <section className="sl-pane st-up" aria-label="Analytics">
          <div className="sl-lock is-compact">
            <Locked plan={PLANS[REQUIRED_PLAN['board-insights']].label} title="Compare every model on every measure" onOpen={onUnlock ?? (() => {})}>
              The performance radar, the benchmark heatmap and price-performance for every model, on every board.
            </Locked>
          </div>
        </section>
      ) : (<>
      {/* Radar Chart — adapts title/subtitle per mode */}
      <section className="sl-pane st-up" aria-label={config.title}>
        <h3 className="sl-pane-t">{config.title}</h3>
        <p className="sl-pane-sub">{config.subtitle} · {periodLabel}</p>
        {waiting ? (
          <div className="sl-loading" role="status">
            <span className="st-bars" aria-hidden="true"><i /><i /><i /></span>
            Loading radar data…
          </div>
        ) : (
          <>
            <div className="sl-radar">
              <RadarChart
                models={radarModels}
                colors={radarColors}
                modelHistoryData={modelHistoryData}
                axKeys={axKeys}
                axisLabels={axisLabels}
                highlightIndices={config.highlightIndices}
              />
            </div>
            <div className="sl-radar-keys">
              {radarModels.map((m, i) => (
                <span key={m.id || i}><i style={{ background: radarColors[i] }} />{m.displayName || m.name}</span>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Heatmap — adapts title per mode, highlights relevant axes */}
      <section className="sl-pane st-up" aria-label={config.heatmapTitle}>
        <h3 className="sl-pane-t">{config.heatmapTitle}</h3>
        {waiting ? (
          <div className="sl-loading" role="status">
            <span className="st-bars" aria-hidden="true"><i /><i /><i /></span>
            Loading heatmap data…
          </div>
        ) : config.showHeatmap ? (
          <div className="sl-mini-heat" style={{ gridTemplateColumns: `minmax(64px, 1.15fr) repeat(${axKeys.length}, minmax(0, 1fr))` }}>
            <span className="sl-heat-hdr is-model" />
            {axisLabels.map((label, i) => {
              const hot = config.highlightIndices.includes(config.axisIndices[i]);
              return (
                <span key={i} className={`sl-heat-hdr${hot ? ' is-hot' : ''}`}
                      title={`${axisWeightLabel(axisFullNames[i])}${hot ? ' · highlighted for this board' : ''}`}>
                  {label}
                </span>
              );
            })}
            {sorted.slice(0, 14).map(model => {
              const axes = getAveragedAxes(modelHistoryData.get(model.id) || model.history || []);
              return (
                <React.Fragment key={model.id}>
                  <Link href={`/models/${model.id}`} className="sl-heat-model" title={model.displayName || model.name}>
                    <span>{model.displayName || model.name}</span>
                  </Link>
                  {axKeys.map((key, i) => {
                    const rawVal = axes[key];
                    const val = typeof rawVal === 'number' ? Math.round(rawVal * 100) : null;
                    const isHighlighted = config.highlightIndices.includes(config.axisIndices[i]);
                    if (val === null) {
                      return <span key={i} className="sl-heat-cell is-none">—</span>;
                    }
                    return (
                      <span key={i} className="sl-heat-cell" style={{
                        background: val === 0 ? 'var(--lp-bad-bg)' : scoreBg(val),
                        color: val === 0 ? 'var(--lp-bad)' : scoreColor(val),
                        fontWeight: isHighlighted ? 700 : undefined,
                      }} title={`${axisWeightLabel(axisFullNames[i])} · this model: ${val}%`}>
                        {val}
                      </span>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          /* Tooling mode: show score-based list instead of empty heatmap */
          <div className="sl-break">
            <p className="sl-pane-sub">Tooling scores based on overall model performance</p>
            {sorted.slice(0, 14).map(m => (
              <div key={m.id} className="sl-break-row">
                <div className="sl-break-top">
                  <Link href={`/models/${m.id}`} className="sl-name sl-stretch">{m.displayName || m.name}</Link>
                  <b style={{ color: scoreColor(m.currentScore as number) }}>{m.currentScore}</b>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Mode-specific analysis section */}
      {leaderboardSortBy === 'reasoning' && (
        <section className="sl-pane st-up" aria-label="Deep reasoning breakdown">
          <h3 className="sl-pane-t">Deep reasoning breakdown</h3>
          <div className="sl-break">
            {sorted.slice(0, 10).map(m => {
              const history = modelHistoryData.get(m.id) || m.history || [];
              const latestWithAxes = history.find((h: any) => h.axes && typeof h.axes === 'object');
              const axes = latestWithAxes?.axes || {};
              return (
                <div key={m.id} className="sl-break-row">
                  <div className="sl-break-top">
                    <Link href={`/models/${m.id}`} className="sl-name sl-stretch">{m.displayName || m.name}</Link>
                    <b>{m.currentScore}</b>
                  </div>
                  <div className="sl-break-axes">
                    {axisTags([
                      ['Context', pct(axes, 'contextWindow')],
                      ['Hallucination', pct(axes, 'hallucinationRate')],
                      ['Memory', pct(axes, 'memoryRetention')],
                      ['Plan', pct(axes, 'planCoherence')],
                    ], 'No deep reasoning data')}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {leaderboardSortBy === 'tooling' && (
        <section className="sl-pane st-up" aria-label="Tool calling breakdown">
          <h3 className="sl-pane-t">Tool calling breakdown</h3>
          <div className="sl-break">
            {sorted.slice(0, 10).map(m => {
              const history = modelHistoryData.get(m.id) || m.history || [];
              const latestWithAxes = history.find((h: any) => h.axes && typeof h.axes === 'object');
              const axes = latestWithAxes?.axes || {};
              return (
                <div key={m.id} className="sl-break-row">
                  <div className="sl-break-top">
                    <Link href={`/models/${m.id}`} className="sl-name sl-stretch">{m.displayName || m.name}</Link>
                    <b>{m.currentScore}</b>
                  </div>
                  <div className="sl-break-axes">
                    {axisTags([
                      ['Selection', pct(axes, 'toolSelection')],
                      ['Parameters', pct(axes, 'parameterAccuracy')],
                      ['Task', pct(axes, 'taskCompletion')],
                      ['Errors', pct(axes, 'errorHandling')],
                    ], 'No tooling data')}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Price-Performance Analysis — always shown, emphasized in price mode */}
      <section className={`sl-pane st-up${leaderboardSortBy === 'price' ? ' is-focus' : ''}`} aria-label="Price-performance analysis">
        <h3 className="sl-pane-t">Price-performance analysis</h3>
        <div className="sl-plist">
          <div className="sl-plist-row is-head">
            <span>Model</span>
            <span className="sl-plist-cost">Cost (I/O)</span>
            <span className="sl-plist-num">Score</span>
            <span className="sl-plist-num">Value</span>
          </div>
          {priceData.slice(0, leaderboardSortBy === 'price' ? 14 : 10).map(m => {
            const valueColor = m.value >= 10 ? 'var(--lp-fg)' : m.value >= 3 ? 'var(--lp-warn)' : 'var(--lp-bad)';
            return (
              <div key={m.id} className="sl-plist-row">
                <Link href={`/models/${m.id}`} className="sl-name sl-stretch">{m.displayName || m.name}</Link>
                <span className="sl-plist-cost">${m.pricing.input}/${m.pricing.output}</span>
                <span className="sl-plist-num" style={{ color: scoreColor(m.currentScore as number) }}>{m.currentScore}</span>
                <span className="sl-plist-num" style={{ color: valueColor }}>{m.value.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      </section>

      </>)}

      {/* Signed-out readers go to /pricing; /router is behind auth. */}
      {showRouterAd && (
      <Link href={session ? '/router' : '/pricing'} className="sl-cta st-up">
        <span className="st-kicker">Smart Router</span>
        <span className="sl-cta-sub">
          Stop picking a model by reputation. Route each request to whichever one is measuring best,
          across every provider you already pay for.
        </span>
        <span className="sl-cta-price">
          <b>{routerPrice().price}</b>
          <small>{routerPrice().plan} · {routerPrice().free}</small>
        </span>
      </Link>
      )}
    </div>
  );
}

// SVG Radar Chart — adapts axes based on mode
export function RadarChart({
  models, colors, modelHistoryData, axKeys, axisLabels, highlightIndices,
}: {
  models: any[];
  colors: string[];
  modelHistoryData: Map<string, any[]>;
  axKeys: string[];
  axisLabels: string[];
  highlightIndices: number[];
}) {
  const cx = 150, cy = 150, R = 100;
  const nAxes = axKeys.length;

  const polarToXY = (angle: number, radius: number) => {
    const d = (angle - 90) * Math.PI / 180;
    return { x: cx + radius * Math.cos(d), y: cy + radius * Math.sin(d) };
  };

  // Background rings
  const rings = [20, 40, 60, 80, 100].map(pct => {
    const r = R * pct / 100;
    const points = Array.from({ length: nAxes }, (_, i) => {
      const a = (360 / nAxes) * i;
      const p = polarToXY(a, r);
      return `${p.x},${p.y}`;
    }).join(' ');
    return <polygon key={pct} points={points} fill="none" stroke="var(--lp-line)" strokeWidth="1" />;
  });

  // Axis lines and labels
  const axes = Array.from({ length: nAxes }, (_, i) => {
    const a = (360 / nAxes) * i;
    const end = polarToXY(a, R);
    const label = polarToXY(a, R + 14);
    const isHighlighted = highlightIndices.includes(i);
    return (
      <g key={i}>
        <line x1={cx} y1={cy} x2={end.x} y2={end.y} stroke={isHighlighted ? 'var(--lp-accent)' : 'var(--lp-line)'} strokeOpacity={isHighlighted ? '0.6' : '1'} strokeWidth={isHighlighted ? '1' : '0.8'} />
        <text
          x={label.x} y={label.y}
          textAnchor="middle" dominantBaseline="middle"
          fill={isHighlighted ? 'var(--lp-accent)' : 'var(--lp-fg3)'}
          fontSize="9"
          fontFamily="var(--lp-font-body)"
          fontWeight={isHighlighted ? 700 : 600}
        >
          {axisLabels[i]}
        </text>
      </g>
    );
  });

  // Model polygons
  const polygons = models.map((model, mi) => {
    const axesData = getAveragedAxes(modelHistoryData.get(model.id) || model.history || []);

    const points = axKeys.map((key, i) => {
      const rawVal = axesData[key];
      const val = typeof rawVal === 'number' ? rawVal * 100 : 50;
      const a = (360 / nAxes) * i;
      return polarToXY(a, R * val / 100);
    });

    const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
    const color = colors[mi] || '#1a73e8';

    return (
      <g key={model.id || mi}>
        <polygon points={pointsStr} fill={color} fillOpacity="0.07" stroke={color} strokeWidth="1.75" strokeOpacity="0.95" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.6" fill={color} />
        ))}
      </g>
    );
  });

  return (
    <svg viewBox="0 0 300 300" width="100%" style={{ maxWidth: '280px' }}>
      {rings}
      {axes}
      {polygons}
    </svg>
  );
}
