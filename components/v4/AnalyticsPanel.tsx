'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface AnalyticsPanelProps {
  modelScores: any[];
  transparencyMetrics: any;
  modelHistoryData: Map<string, any[]>;
  leaderboardSortBy: string;
  leaderboardPeriod: string;
}

// Combined/Speed benchmark: 9 axes (suite=combined & suite=hourly)
const combinedAxisLabels = ['CORR', 'CMPL', 'QUAL', 'EFF', 'STBL', 'EDGE', 'DBG', 'FMT', 'SAFE'];
const combinedAxisFullNames = ['Correctness', 'Complexity', 'Code Quality', 'Efficiency', 'Stability', 'Edge Cases', 'Debugging', 'Format', 'Safety'];
const combinedAxKeys = ['correctness', 'complexity', 'codeQuality', 'efficiency', 'stability', 'edgeCases', 'debugging', 'format', 'safety'];

// Reasoning benchmark: 13 axes (suite=deep) — same 9 + 4 reasoning-specific
const reasoningAxisLabels = ['CORR', 'CMPL', 'QUAL', 'EFF', 'STBL', 'EDGE', 'DBG', 'FMT', 'SAFE', 'CTX', 'HALL', 'MEM', 'PLAN'];
const reasoningAxisFullNames = ['Correctness', 'Complexity', 'Code Quality', 'Efficiency', 'Stability', 'Edge Cases', 'Debugging', 'Format', 'Safety', 'Context Window', 'Hallucination Rate', 'Memory Retention', 'Plan Coherence'];
const reasoningAxKeys = ['correctness', 'complexity', 'codeQuality', 'efficiency', 'stability', 'edgeCases', 'debugging', 'format', 'safety', 'contextWindow', 'hallucinationRate', 'memoryRetention', 'planCoherence'];

// Tooling benchmark: 7 different axes (suite=tooling)
const toolingAxisLabels = ['TOOL', 'PARAM', 'ERR', 'TASK', 'EFF', 'CTX', 'SAFE'];
const toolingAxisFullNames = ['Tool Selection', 'Parameter Accuracy', 'Error Handling', 'Task Completion', 'Efficiency', 'Context Awareness', 'Safety Compliance'];
const toolingAxKeys = ['toolSelection', 'parameterAccuracy', 'errorHandling', 'taskCompletion', 'efficiency', 'contextAwareness', 'safetyCompliance'];

// Mode-specific axis configurations (9 axes: CORR, CMPL, QUAL, EFF, STBL, EDGE, DBG, FMT, SAFE)
const modeConfig: Record<string, {
  title: string;
  subtitle: string;
  heatmapTitle: string;
  axisIndices: number[];  // which of the 9 axes to show
  highlightIndices: number[];  // which axes to visually emphasize
  showHeatmap: boolean;  // whether to show full heatmap grid (false for tooling)
}> = {
  combined: {
    title: 'PERFORMANCE RADAR',
    subtitle: 'Top 3 vs Bottom 3 across all dimensions',
    heatmapTitle: 'BENCHMARK HEATMAP',
    axisIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    highlightIndices: [],
    showHeatmap: true,
  },
  reasoning: {
    title: 'DEEP REASONING RADAR',
    subtitle: 'All 13 reasoning axes incl. context, hallucination, memory',
    heatmapTitle: 'DEEP REASONING HEATMAP',
    axisIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // 13 reasoning axes
    highlightIndices: [9, 10, 11, 12], // reasoning-specific: contextWindow, hallucination, memory, plan
    showHeatmap: true,
  },
  speed: {
    title: '7-AXIS PERFORMANCE RADAR',
    subtitle: 'Full benchmark with efficiency & stability emphasis',
    heatmapTitle: '7-AXIS HEATMAP',
    axisIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    highlightIndices: [3, 4], // efficiency, stability
    showHeatmap: true,
  },
  tooling: {
    title: 'TOOL CALLING RADAR',
    subtitle: 'Tool selection, params, error handling, completion',
    heatmapTitle: 'TOOL CALLING HEATMAP',
    axisIndices: [0, 1, 2, 3, 4, 5, 6], // 7 tooling axes
    highlightIndices: [0, 3], // toolSelection, taskCompletion
    showHeatmap: true,
  },
  price: {
    title: 'COST-EFFICIENCY RADAR',
    subtitle: 'Performance per dollar across dimensions',
    heatmapTitle: 'COST-EFFICIENCY HEATMAP',
    axisIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    highlightIndices: [3], // efficiency
    showHeatmap: true,
  },
};

const scoreColor = (v: number) =>
  v >= 80 ? 'var(--phosphor-green)' : v >= 65 ? 'var(--amber-warning)' : 'var(--red-alert)';

const scoreBg = (v: number) =>
  v >= 80 ? 'rgba(0,255,65,.04)' : v >= 65 ? 'rgba(255,176,0,.04)' : 'rgba(255,45,0,.04)';

// OFFICIAL VERIFIED pricing (Feb 17, 2026) - USD per 1M tokens
const getModelPricing = (name: string, provider: string): { input: number; output: number } => {
  const n = name.toLowerCase();
  const p = provider.toLowerCase();
  if (p === 'openai') {
    if (n.includes('gpt-5') && n.includes('turbo')) return { input: 10, output: 30 };
    if (n.includes('gpt-5') && n.includes('mini')) return { input: 0.25, output: 2 };
    if (n.includes('gpt-5.2') || n.includes('gpt-5-2')) return { input: 1.75, output: 14 };
    if (n.includes('gpt-5')) return { input: 1.25, output: 10 };
    if (n.includes('o3-pro')) return { input: 60, output: 240 };
    if (n.includes('o3-mini')) return { input: 3.5, output: 14 };
    if (n.includes('o3')) return { input: 15, output: 60 };
    if (n.includes('gpt-4o') && n.includes('mini')) return { input: 0.15, output: 0.6 };
    if (n.includes('gpt-4o')) return { input: 2.5, output: 10 };
    return { input: 3, output: 9 };
  }
  if (p === 'anthropic') {
    // Note: Opus 4.1 legacy $15/$75; Opus 4.5/4.6 current $5/$25
    if (n.includes('opus-4-1') || n.includes('opus-4.1')) return { input: 15, output: 75 };
    if (n.includes('opus')) return { input: 5, output: 25 };
    if (n.includes('sonnet')) return { input: 3, output: 15 };
    if (n.includes('haiku')) return { input: 0.25, output: 1.25 };
    return { input: 3, output: 15 };
  }
  if (p === 'xai' || p === 'x.ai') {
    if (n.includes('grok-code-fast')) return { input: 0.20, output: 1.50 };
    return { input: 3, output: 15 };
  }
  if (p === 'google') {
    if (n.includes('gemini-3') && n.includes('pro')) return { input: 2, output: 12 };
    if (n.includes('2.5-pro')) return { input: 1.25, output: 10 };
    if (n.includes('flash-lite')) return { input: 0.1, output: 0.4 };
    if (n.includes('2.5-flash')) return { input: 0.3, output: 2.5 };
    if (n.includes('1.5-pro')) return { input: 1.25, output: 5 };
    if (n.includes('1.5-flash')) return { input: 0.075, output: 0.3 };
    return { input: 1, output: 3 };
  }
  if (p === 'deepseek') return { input: 0.28, output: 0.42 };
  if (p === 'glm') return { input: 0.60, output: 2.20 };
  if (p === 'kimi') return { input: 0.60, output: 2.50 };
  return { input: 2, output: 6 };
};

// Average axes across all history entries for the selected period
function getAveragedAxes(history: any[]): Record<string, number> {
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
}: AnalyticsPanelProps) {
  const router = useRouter();
  const available = modelScores.filter(m => typeof m.currentScore === 'number' && m.currentScore > 0);

  // Get mode config — pick the right axis set per benchmark suite
  const config = modeConfig[leaderboardSortBy] || modeConfig.combined;
  const isToolingMode = leaderboardSortBy === 'tooling';
  const isReasoningMode = leaderboardSortBy === 'reasoning';
  const baseLabels = isToolingMode ? toolingAxisLabels : isReasoningMode ? reasoningAxisLabels : combinedAxisLabels;
  const baseFullNames = isToolingMode ? toolingAxisFullNames : isReasoningMode ? reasoningAxisFullNames : combinedAxisFullNames;
  const baseAxKeys = isToolingMode ? toolingAxKeys : isReasoningMode ? reasoningAxKeys : combinedAxKeys;
  const axisLabels = config.axisIndices.map(i => baseLabels[i]).filter(Boolean);
  const axisFullNames = config.axisIndices.map(i => baseFullNames[i]).filter(Boolean);
  const axKeys = config.axisIndices.map(i => baseAxKeys[i]).filter(Boolean);

  // Sort for radar: top 3 and bottom 3
  const sorted = [...available].sort((a, b) => (b.currentScore as number) - (a.currentScore as number));
  const top3 = sorted.slice(0, 3);
  const bottom3 = sorted.slice(-3).reverse();
  const radarModels = [...top3, ...bottom3];
  const radarColors = ['#00ff41', '#00BFFF', '#a855f7', '#ffb000', '#c0c0c0', '#ff2d00'];

  // Price-performance
  const priceData = available.map(m => {
    const pricing = getModelPricing(m.name, m.provider);
    const cost = pricing.input * 0.4 + pricing.output * 0.6;
    const value = cost > 0 ? (m.currentScore as number) / cost : 0;
    return { ...m, pricing, cost, value };
  }).sort((a, b) => b.value - a.value);

  // Period label for display
  const periodLabel = leaderboardPeriod === 'latest' ? 'Latest' : leaderboardPeriod === '24h' ? '24 Hours' : leaderboardPeriod === '7d' ? '7 Days' : '1 Month';

  return (
    <div className="v4-panel v4-right-panel">
      <div className="v4-panel-header">
        <span>ANALYTICS</span>
        <span className="v4-badge v4-badge-green">{leaderboardPeriod.toUpperCase()}</span>
      </div>

      {/* Radar Chart — adapts title/subtitle per mode */}
      <div className="v4-radar-wrap">
        <div className="v4-radar-title">{config.title}</div>
        <div className="v4-radar-sub">{config.subtitle} • {periodLabel}</div>
        {modelHistoryData.size === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 0', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px',
              border: '2px solid rgba(0, 255, 65, 0.1)',
              borderTop: '2px solid var(--phosphor-green)',
              borderRadius: '50%',
              animation: 'v4-analytics-spin 1s linear infinite'
            }} />
            <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', letterSpacing: '1px' }}>LOADING RADAR DATA...</div>
            <style dangerouslySetInnerHTML={{ __html: `@keyframes v4-analytics-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }` }} />
          </div>
        ) : (
          <>
            <RadarChart
              models={radarModels}
              colors={radarColors}
              modelHistoryData={modelHistoryData}
              axKeys={axKeys}
              axisLabels={axisLabels}
              highlightIndices={config.highlightIndices}
            />
            <div className="v4-radar-legend">
              {radarModels.map((m, i) => (
                <div key={m.id || i} className="v4-radar-legend-item">
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: radarColors[i], boxShadow: `0 0 3px ${radarColors[i]}` }}></div>
                  {m.name}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Heatmap — adapts title per mode, highlights relevant axes */}
      <div className="v4-section-divider">{config.heatmapTitle}</div>
      {modelHistoryData.size === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px',
            border: '2px solid rgba(0, 255, 65, 0.1)',
            borderTop: '2px solid var(--phosphor-green)',
            borderRadius: '50%',
            animation: 'v4-analytics-spin 1s linear infinite'
          }} />
          <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', letterSpacing: '1px' }}>LOADING HEATMAP DATA...</div>
        </div>
      ) : config.showHeatmap ? (
        <div className="v4-heatmap" style={{ gridTemplateColumns: `80px repeat(${axKeys.length}, 1fr)` }}>
          <div className="v4-hm-hdr"></div>
          {axisLabels.map((label, i) => (
            <div
              key={i}
              className="v4-hm-hdr"
              title={axisFullNames[i]}
              style={config.highlightIndices.includes(config.axisIndices[i]) ? {
                color: 'var(--phosphor-green)',
                textShadow: '0 0 2px var(--phosphor-green)',
              } : undefined}
            >
              {label}
              {config.highlightIndices.includes(config.axisIndices[i]) && ' ★'}
            </div>
          ))}
          {sorted.slice(0, 14).map(model => {
            const axes = getAveragedAxes(modelHistoryData.get(model.id) || model.history || []);
            return (
              <React.Fragment key={model.id}>
                <div className="v4-hm-model" style={{ cursor: 'pointer' }} onClick={() => router.push(`/models/${model.id}`)}>
                  {model.name.substring(0, 12)}
                </div>
                {axKeys.map((key, i) => {
                  const rawVal = axes[key];
                  const val = typeof rawVal === 'number' ? Math.round(rawVal * 100) : null;
                  const isHighlighted = config.highlightIndices.includes(config.axisIndices[i]);
                  if (val === null) {
                    return <div key={i} className="v4-hm-cell" style={{ color: 'var(--phosphor-dim)', opacity: 0.3 }}>—</div>;
                  }
                  return (
                    <div key={i} className="v4-hm-cell" style={{
                      background: val === 0 ? 'rgba(255,45,0,.08)' : scoreBg(val),
                      color: val === 0 ? 'var(--red-alert)' : scoreColor(val),
                      textShadow: val === 0 ? 'none' : `0 0 2px ${scoreColor(val)}`,
                      ...(isHighlighted ? { fontWeight: 'bold', borderBottom: `1px solid ${scoreColor(val)}` } : {}),
                    }} title={`${axisFullNames[i]}: ${val}%`}>
                      {val}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        /* Tooling mode: show score-based list instead of empty heatmap */
        <div style={{ padding: '8px 10px', fontSize: '11px' }}>
          <div style={{ color: 'var(--phosphor-dim)', fontSize: '10px', marginBottom: '6px', textAlign: 'center' }}>
            Tooling scores based on overall model performance
          </div>
          {sorted.slice(0, 14).map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(192,192,192,.04)', cursor: 'pointer' }} onClick={() => router.push(`/models/${m.id}`)}>
              <span style={{ color: 'var(--phosphor-green)', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{m.name}</span>
              <span style={{ color: scoreColor(m.currentScore as number), fontWeight: 'bold', textShadow: `0 0 2px ${scoreColor(m.currentScore as number)}` }}>
                {m.currentScore}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Mode-specific analysis section */}
      {leaderboardSortBy === 'reasoning' && (
        <>
          <div className="v4-section-divider">DEEP REASONING BREAKDOWN</div>
          <div style={{ padding: '8px 10px', fontSize: '11px' }}>
            {sorted.slice(0, 10).map(m => {
              const history = modelHistoryData.get(m.id) || m.history || [];
              const latestWithAxes = history.find((h: any) => h.axes && typeof h.axes === 'object');
              const axes = latestWithAxes?.axes || {};
              const ctxWin = typeof axes.contextWindow === 'number' ? Math.round(axes.contextWindow * 100) : null;
              const hallRate = typeof axes.hallucinationRate === 'number' ? Math.round(axes.hallucinationRate * 100) : null;
              const memRet = typeof axes.memoryRetention === 'number' ? Math.round(axes.memoryRetention * 100) : null;
              const planCoh = typeof axes.planCoherence === 'number' ? Math.round(axes.planCoherence * 100) : null;

              return (
                <div key={m.id} style={{ padding: '4px 0', borderBottom: '1px solid rgba(192,192,192,.04)', cursor: 'pointer' }} onClick={() => router.push(`/models/${m.id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ color: 'var(--phosphor-green)', fontWeight: 'bold', fontSize: '11px' }}>{m.name.substring(0, 20)}</span>
                    <span style={{ color: scoreColor(m.currentScore as number), fontWeight: 'bold' }}>{m.currentScore}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '9px' }}>
                    {ctxWin !== null && <span style={{ color: scoreColor(ctxWin) }}>CTX:{ctxWin}</span>}
                    {hallRate !== null && <span style={{ color: scoreColor(hallRate) }}>HAL:{hallRate}</span>}
                    {memRet !== null && <span style={{ color: scoreColor(memRet) }}>MEM:{memRet}</span>}
                    {planCoh !== null && <span style={{ color: scoreColor(planCoh) }}>PLN:{planCoh}</span>}
                    {ctxWin === null && hallRate === null && <span style={{ color: 'var(--phosphor-dim)' }}>No deep reasoning data</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {leaderboardSortBy === 'tooling' && (
        <>
          <div className="v4-section-divider">TOOL CALLING BREAKDOWN</div>
          <div style={{ padding: '8px 10px', fontSize: '11px' }}>
            {sorted.slice(0, 10).map(m => {
              const history = modelHistoryData.get(m.id) || m.history || [];
              const latestWithAxes = history.find((h: any) => h.axes && typeof h.axes === 'object');
              const axes = latestWithAxes?.axes || {};
              const toolSel = typeof axes.toolSelection === 'number' ? Math.round(axes.toolSelection * 100) : null;
              const paramAcc = typeof axes.parameterAccuracy === 'number' ? Math.round(axes.parameterAccuracy * 100) : null;
              const taskComp = typeof axes.taskCompletion === 'number' ? Math.round(axes.taskCompletion * 100) : null;
              const errHand = typeof axes.errorHandling === 'number' ? Math.round(axes.errorHandling * 100) : null;

              return (
                <div key={m.id} style={{ padding: '4px 0', borderBottom: '1px solid rgba(192,192,192,.04)', cursor: 'pointer' }} onClick={() => router.push(`/models/${m.id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ color: 'var(--phosphor-green)', fontWeight: 'bold', fontSize: '11px' }}>{m.name.substring(0, 20)}</span>
                    <span style={{ color: scoreColor(m.currentScore as number), fontWeight: 'bold' }}>{m.currentScore}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '9px' }}>
                    {toolSel !== null && <span style={{ color: scoreColor(toolSel) }}>SEL:{toolSel}</span>}
                    {paramAcc !== null && <span style={{ color: scoreColor(paramAcc) }}>PAR:{paramAcc}</span>}
                    {taskComp !== null && <span style={{ color: scoreColor(taskComp) }}>TSK:{taskComp}</span>}
                    {errHand !== null && <span style={{ color: scoreColor(errHand) }}>ERR:{errHand}</span>}
                    {toolSel === null && paramAcc === null && <span style={{ color: 'var(--phosphor-dim)' }}>No tooling data</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Price-Performance Analysis — always shown, emphasized in price mode */}
      <div className="v4-section-divider">
        {leaderboardSortBy === 'price' ? '★ PRICE-PERFORMANCE ANALYSIS' : 'PRICE-PERFORMANCE ANALYSIS'}
      </div>
      <div className="v4-price-grid">
        <div className="v4-price-row v4-price-hdr">
          <div>MODEL</div>
          <div style={{ textAlign: 'right' }}>COST (I/O)</div>
          <div style={{ textAlign: 'center' }}>SCORE</div>
          <div style={{ textAlign: 'center' }}>VALUE</div>
        </div>
        {priceData.slice(0, leaderboardSortBy === 'price' ? 14 : 10).map(m => {
          const valueColor = m.value >= 10 ? 'var(--phosphor-green)' : m.value >= 3 ? 'var(--amber-warning)' : 'var(--red-alert)';
          return (
            <div key={m.id} className="v4-price-row" style={{ cursor: 'pointer' }} onClick={() => router.push(`/models/${m.id}`)}>
              <div className="v4-price-model">
                {m.name}
              </div>
              <div className="v4-price-cost">
                ${m.pricing.input}/${m.pricing.output}
              </div>
              <div className="v4-price-score" style={{ color: scoreColor(m.currentScore as number), textShadow: `0 0 2px ${scoreColor(m.currentScore as number)}` }}>
                {m.currentScore}
              </div>
              <div className="v4-price-value" style={{ color: valueColor, textShadow: `0 0 2px ${valueColor}` }}>
                {m.value.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pro CTA */}
      <div className="v4-pro-cta" onClick={() => router.push('/router')} style={{ margin: '8px 10px' }}>
        <div className="v4-pro-cta-title">⚡ PRO ROUTER — $4.99/mo</div>
        <div className="v4-pro-cta-sub">Benchmark-powered routing • All models • Save 50-70%</div>
        <div className="v4-pro-cta-price">7-day free trial → Start now</div>
      </div>
    </div>
  );
}

// SVG Radar Chart — adapts axes based on mode
function RadarChart({
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
    return <polygon key={pct} points={points} fill="none" stroke="rgba(192,192,192,.08)" strokeWidth="0.5" />;
  });

  // Axis lines and labels
  const axes = Array.from({ length: nAxes }, (_, i) => {
    const a = (360 / nAxes) * i;
    const end = polarToXY(a, R);
    const label = polarToXY(a, R + 14);
    const isHighlighted = highlightIndices.includes(i);
    return (
      <g key={i}>
        <line x1={cx} y1={cy} x2={end.x} y2={end.y} stroke={isHighlighted ? 'rgba(0,255,65,.15)' : 'rgba(192,192,192,.05)'} strokeWidth={isHighlighted ? '1' : '0.5'} />
        <text
          x={label.x} y={label.y}
          textAnchor="middle" dominantBaseline="middle"
          fill={isHighlighted ? 'var(--phosphor-green)' : 'var(--phosphor-dim)'}
          fontSize={isHighlighted ? '9' : '8'}
          fontFamily="monospace"
          fontWeight={isHighlighted ? 'bold' : 'normal'}
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
    const color = colors[mi] || '#00ff41';

    return (
      <g key={model.id || mi}>
        <polygon points={pointsStr} fill={color} fillOpacity="0.04" stroke={color} strokeWidth="1.2" strokeOpacity="0.6" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={color} opacity="0.6" />
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
