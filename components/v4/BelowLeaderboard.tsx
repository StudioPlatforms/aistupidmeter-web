'use client';

interface BelowLeaderboardProps {
  transparencyMetrics: any;
  modelScores: any[];
}

export default function BelowLeaderboard({ transparencyMetrics, modelScores }: BelowLeaderboardProps) {
  const totalModels = modelScores.length;
  const availableModels = modelScores.filter(m => m.currentScore !== 'unavailable').length;
  const providers = new Set(modelScores.map(m => m.provider)).size;
  // transparencyMetrics from API has shape: { summary: { coverage, confidence, ... }, modelFreshness: [...] }
  const summary = transparencyMetrics?.summary || transparencyMetrics || {};
  const coverage = summary?.coverage != null
    ? `${Math.round(summary.coverage)}%`
    : totalModels > 0 ? `${Math.round((availableModels / totalModels) * 100)}%` : '—';
  const confidence = summary?.confidence != null
    ? `${Math.round(summary.confidence)}%`
    : '—';
  const ciWidth = summary?.avgCIWidth != null
    ? Number(summary.avgCIWidth).toFixed(1)
    : '—';

  return (
    <div className="v4-below-lb">
      <div className="v4-info-grid">
        {/* Data Transparency */}
        <div className="v4-info-col">
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--amber-warning)', marginBottom: '8px', textShadow: '0 0 2px var(--amber-warning)' }}>
            DATA TRANSPARENCY
          </div>
          <div className="v4-info-row">
            <span className="v4-info-label">Test Coverage</span>
            <span className="v4-info-value" style={{ color: 'var(--phosphor-green)' }}>{coverage}</span>
          </div>
          <div className="v4-info-row">
            <span className="v4-info-label">Statistical Confidence</span>
            <span className="v4-info-value" style={{ color: 'var(--phosphor-green)' }}>{confidence}</span>
          </div>
          <div className="v4-info-row">
            <span className="v4-info-label">Avg CI Width</span>
            <span className="v4-info-value" style={{ color: 'var(--phosphor-green)' }}>{ciWidth}</span>
          </div>
          <div className="v4-info-row">
            <span className="v4-info-label">Models Tracked</span>
            <span className="v4-info-value" style={{ color: 'var(--phosphor-green)' }}>{totalModels}</span>
          </div>
          <div className="v4-info-row">
            <span className="v4-info-label">Providers Monitored</span>
            <span className="v4-info-value" style={{ color: 'var(--phosphor-green)' }}>{providers}</span>
          </div>
          <div className="v4-info-row">
            <span className="v4-info-label">Detection Method</span>
            <span className="v4-info-value" style={{ color: 'var(--phosphor-green)' }}>CUSUM + Page-Hinkley</span>
          </div>
        </div>

        {/* Benchmark Schedule */}
        <div className="v4-info-col">
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--amber-warning)', marginBottom: '8px', textShadow: '0 0 2px var(--amber-warning)' }}>
            BENCHMARK SCHEDULE
          </div>
          <div className="v4-info-row">
            <span className="v4-info-label">Canary (drift detect)</span>
            <span className="v4-info-value" style={{ color: 'var(--phosphor-green)' }}>Every hour</span>
          </div>
          <div className="v4-info-row">
            <span className="v4-info-label">Full 7-axis (speed)</span>
            <span className="v4-info-value" style={{ color: 'var(--phosphor-green)' }}>Every 4 hours</span>
          </div>
          <div className="v4-info-row">
            <span className="v4-info-label">Deep reasoning</span>
            <span className="v4-info-value" style={{ color: 'var(--phosphor-green)' }}>Daily 3:00 AM CET</span>
          </div>
          <div className="v4-info-row">
            <span className="v4-info-label">Tool calling</span>
            <span className="v4-info-value" style={{ color: 'var(--phosphor-green)' }}>Daily 4:00 AM CET</span>
          </div>
          <div className="v4-info-row">
            <span className="v4-info-label">Health monitoring</span>
            <span className="v4-info-value" style={{ color: 'var(--phosphor-green)' }}>Every 10 minutes</span>
          </div>
          <div className="v4-info-row">
            <span className="v4-info-label">Scoring</span>
            <span className="v4-info-value" style={{ color: 'var(--phosphor-green)' }}>7-axis w/ 95% CI</span>
          </div>
        </div>
      </div>

      {/* System description */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(192,192,192,.06)', fontSize: '12px' }}>
        <div style={{ fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '6px', textShadow: '0 0 2px var(--phosphor-green)' }}>
          &gt; WHAT IS STUPID METER?
        </div>
        <div style={{ color: 'var(--phosphor-dim)', lineHeight: 1.6 }}>
          The world&apos;s first AI intelligence degradation detection system. We continuously benchmark {totalModels}+ AI models
          across {providers} providers using automated coding challenges, deep reasoning tasks, and tool-calling evaluations.
          Our CUSUM + Page-Hinkley change-point detection algorithms identify performance regressions within hours, not days.
        </div>
        <div style={{ fontWeight: 'bold', color: 'var(--phosphor-green)', marginTop: '10px', marginBottom: '6px', textShadow: '0 0 2px var(--phosphor-green)' }}>
          &gt; TEST YOUR OWN KEYS
        </div>
        <div style={{ color: 'var(--phosphor-dim)', lineHeight: 1.6 }}>
          Run the exact same benchmarks with your own API keys. Verify our results independently.
          Compare your provider&apos;s performance against our public rankings.
        </div>
      </div>
    </div>
  );
}
