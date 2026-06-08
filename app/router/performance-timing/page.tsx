'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import PerformanceChart from '@/components/PerformanceChart';

type HistoricalPeriod = 'latest' | '24h' | '7d' | '1m';
type ScoringMode = 'combined' | 'reasoning' | 'speed' | 'tooling';

interface Model {
  id: number;
  name: string;
  displayName?: string;
  provider: string;
}

interface HistoryPoint {
  timestamp: string;
  stupidScore: number;
  displayScore?: number;
  score?: number;
  axes: Record<string, number>;
}

interface HourBucket {
  hour: number;
  avg: number | null;
  min: number | null;
  max: number | null;
  count: number;
}

interface HourRecommendation {
  bestHours: string;   // e.g. "14:00 – 18:00 UTC"
  worstHours: string;  // e.g. "02:00 – 06:00 UTC"
  peakHour: string;    // e.g. "16:00 UTC"
  peakScore: number;
  lowHour: string;     // e.g. "04:00 UTC"
  lowScore: number;
  avgScore: number;
  variance: number;
  coverage: number;    // % of hours with data
}

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

const toDisplayScore = (point: any): number | null => {
  if (!point) return null;
  if (typeof point.score === 'number' && !Number.isNaN(point.score)) return clamp(Math.round(point.score));
  const ds = typeof point.displayScore === 'number' ? point.displayScore : typeof point.currentScore === 'number' ? point.currentScore : null;
  if (typeof ds === 'number' && !Number.isNaN(ds)) return clamp(Math.round(ds));
  const z = typeof point.stupidScore === 'number' ? point.stupidScore : null;
  if (z !== null && !Number.isNaN(z)) {
    if (z >= 0 && z <= 100) return clamp(Math.round(z));
    return clamp(Math.round(50 + z * 10));
  }
  return null;
};

const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`;

// Given sorted hour buckets with scores, find the best/worst contiguous window of ~4 hours
function findHourWindow(buckets: Array<{ hour: number; avg: number }>, best: boolean): { start: number; end: number; avgScore: number } {
  if (buckets.length === 0) return { start: 0, end: 0, avgScore: 0 };
  if (buckets.length <= 4) {
    const sorted = [...buckets].sort((a, b) => best ? b.avg - a.avg : a.avg - b.avg);
    return { start: sorted[0].hour, end: sorted[sorted.length - 1].hour, avgScore: sorted[0].avg };
  }

  // Build a full 24-hour ring of scores
  const hourScores: (number | null)[] = new Array(24).fill(null);
  for (const b of buckets) {
    hourScores[b.hour] = b.avg;
  }

  // Find best/worst 4-hour window (sliding window on circular array)
  let bestStart = 0;
  let bestSum = best ? -Infinity : Infinity;
  const windowSize = Math.min(4, buckets.length);

  for (let start = 0; start < 24; start++) {
    let sum = 0;
    let count = 0;
    for (let offset = 0; offset < windowSize; offset++) {
      const h = (start + offset) % 24;
      if (hourScores[h] !== null) {
        sum += hourScores[h]!;
        count++;
      }
    }
    if (count === 0) continue;
    const avg = sum / count;
    if (best ? avg > bestSum : avg < bestSum) {
      bestSum = avg;
      bestStart = start;
    }
  }

  const endHour = (bestStart + windowSize - 1) % 24;
  return { start: bestStart, end: endHour, avgScore: Math.round(bestSum) };
}

const periods: Array<{ key: HistoricalPeriod; label: string }> = [
  { key: 'latest', label: 'LATEST' },
  { key: '24h', label: '24H' },
  { key: '7d', label: '7D' },
  { key: '1m', label: '1M' },
];

const scoringModes: Array<{ key: ScoringMode; label: string }> = [
  { key: 'combined', label: 'COMBINED' },
  { key: 'reasoning', label: 'REASONING' },
  { key: 'speed', label: 'CODING' },
  { key: 'tooling', label: 'TOOLING' },
];

// Map scoring mode to hour-analysis suite param
const modeToSuite = (mode: ScoringMode): string => {
  if (mode === 'speed' || mode === 'combined') return 'hourly';
  if (mode === 'reasoning') return 'deep';
  if (mode === 'tooling') return 'tooling';
  return 'hourly';
};

export default function PerformanceTimingPage() {
  const { data: session, status } = useSession();
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [period, setPeriod] = useState<HistoricalPeriod>('latest');
  const [scoringMode, setScoringMode] = useState<ScoringMode>('combined');
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [canonicalScore, setCanonicalScore] = useState<number | null>(null);
  const [hourRec, setHourRec] = useState<HourRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Fetch models on mount
  useEffect(() => {
    fetchModels();
  }, []);

  // Fetch history when model/period/scoring mode changes
  useEffect(() => {
    if (selectedModelId) {
      fetchHistory();
    }
  }, [selectedModelId, period, scoringMode]);

  // Fetch hour-of-day analysis (always 7d) when model or scoring mode changes
  useEffect(() => {
    if (selectedModelId) {
      fetchHourAnalysis();
    }
  }, [selectedModelId, scoringMode]);

  const fetchModels = async () => {
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/models`);

      if (response.ok) {
        const modelsData = await response.json();
        setModels(modelsData);

        // Auto-select first model
        if (modelsData.length > 0 && !selectedModelId) {
          setSelectedModelId(modelsData[0].id);
        }
        setModelsLoaded(true);
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
      setModelsLoaded(true);
    }
  };

  const fetchHistory = async () => {
    if (!selectedModelId) return;

    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
      const sortByParam = scoringMode === 'speed' ? '7axis' : scoringMode;
      const response = await fetch(
        `${apiUrl}/dashboard/history/${selectedModelId}?period=${period}&sortBy=${sortByParam}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch performance data');
      }

      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        const points = data.data.map((point: any) => ({
          timestamp: point.timestamp || new Date().toISOString(),
          stupidScore: point.stupidScore || 0,
          displayScore: point.score || point.displayScore || toDisplayScore(point) || 0,
          score: point.score,
          axes: point.axes || {},
        }));
        setHistory(points);
        setCanonicalScore(data.canonicalScore ?? null);
      } else {
        setHistory([]);
        setCanonicalScore(null);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchHourAnalysis = async () => {
    if (!selectedModelId) return;

    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
      const suite = modeToSuite(scoringMode);
      const response = await fetch(
        `${apiUrl}/api/models/${selectedModelId}/hour-analysis?period=7d&suite=${suite}`
      );

      if (!response.ok) {
        setHourRec(null);
        return;
      }

      const data = await response.json();

      if (!data.hours || data.hours.length === 0) {
        setHourRec(null);
        return;
      }

      // Build hour buckets from the response
      const validBuckets = data.hours
        .filter((h: any) => h.avg !== null && h.avg !== undefined && h.hour !== undefined)
        .map((h: any) => ({ hour: h.hour as number, avg: h.avg as number }));

      if (validBuckets.length < 2) {
        setHourRec(null);
        return;
      }

      const allScores = validBuckets.map((b: { hour: number; avg: number }) => b.avg);
      const avgScore = Math.round(allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length);
      const peakBucket = validBuckets.reduce((best: { hour: number; avg: number }, cur: { hour: number; avg: number }) => cur.avg > best.avg ? cur : best);
      const lowBucket = validBuckets.reduce((worst: { hour: number; avg: number }, cur: { hour: number; avg: number }) => cur.avg < worst.avg ? cur : worst);
      const variance = Math.round(peakBucket.avg - lowBucket.avg);
      const coverage = Math.round((validBuckets.length / 24) * 100);

      const bestWindow = findHourWindow(validBuckets, true);
      const worstWindow = findHourWindow(validBuckets, false);

      setHourRec({
        bestHours: `${fmtHour(bestWindow.start)} – ${fmtHour((bestWindow.end + 1) % 24)} UTC`,
        worstHours: `${fmtHour(worstWindow.start)} – ${fmtHour((worstWindow.end + 1) % 24)} UTC`,
        peakHour: `${fmtHour(peakBucket.hour)} UTC`,
        peakScore: Math.round(peakBucket.avg),
        lowHour: `${fmtHour(lowBucket.hour)} UTC`,
        lowScore: Math.round(lowBucket.avg),
        avgScore,
        variance,
        coverage,
      });
    } catch (err) {
      console.error('Failed to fetch hour analysis:', err);
      setHourRec(null);
    }
  };

  const selectedModel = models.find(m => m.id === selectedModelId);
  const modeLabel = scoringMode === 'speed' ? 'CODING' : scoringMode.toUpperCase();

  // Build chart data (same logic as ModelDetailChart)
  const buildChartData = () => {
    let filteredHistory: HistoryPoint[] = [];
    if (period === 'latest') {
      filteredHistory = history.slice(0, 24);
    } else {
      filteredHistory = history;
    }

    const data = [...filteredHistory].reverse(); // oldest → newest (left to right)

    return data.map((point) => {
      const ts = new Date(point.timestamp);
      let name = '';
      if (period === '24h') {
        name = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (period === '7d') {
        name = ts.toLocaleDateString([], { weekday: 'short', hour: '2-digit' });
      } else if (period === '1m') {
        name = ts.toLocaleDateString([], { month: 'short', day: 'numeric' });
      } else {
        // latest: smart label
        const first = new Date(data[0].timestamp);
        const last = new Date(data[data.length - 1].timestamp);
        const spanDays = Math.abs(last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24);
        if (spanDays < 3) {
          name = ts.toLocaleTimeString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } else {
          name = ts.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
        }
      }
      return {
        name,
        score: toDisplayScore(point) || 0,
        timestamp: point.timestamp,
      };
    });
  };

  const chartData = buildChartData();
  const isEmpty = chartData.length === 0;

  // Compute quick stat insights from chart data
  const computeInsights = () => {
    if (chartData.length === 0) return null;
    const scores = chartData.map(d => d.score).filter(s => s > 0);
    if (scores.length === 0) return null;

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const best = Math.max(...scores);
    const worst = Math.min(...scores);
    const variance = best - worst;

    return {
      avgScore: Math.round(avg),
      bestScore: best,
      worstScore: worst,
      dataPoints: scores.length,
      variance: Math.round(variance),
    };
  };

  const insights = computeInsights();

  // Loading state
  if (!modelsLoaded) {
    return (
      <RouterLayout>
        <div className="rv4-page-header">
          <div className="rv4-page-header-left">
            <span style={{ fontSize: '18px' }}>⏰</span>
            <div className="rv4-page-title">PERFORMANCE TIMING<span className="blinking-cursor"></span></div>
          </div>
        </div>
        <div className="rv4-loading" style={{ minHeight: '300px' }}>
          <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
          <span>LOADING</span>
        </div>
      </RouterLayout>
    );
  }

  return (
    <RouterLayout>
      <SubscriptionGuard feature="Performance Timing">
        {/* Page header */}
        <div className="rv4-page-header">
          <div className="rv4-page-header-left">
            <span style={{ fontSize: '18px' }}>⏰</span>
            <div>
              <div className="rv4-page-title">PERFORMANCE TIMING<span className="blinking-cursor"></span></div>
              <div className="rv4-page-title-sub">Track model performance over time — same charts as model detail pages</div>
            </div>
          </div>
          <div className="rv4-page-header-right">
            {/* Model selector */}
            <select
              value={selectedModelId || ''}
              onChange={(e) => setSelectedModelId(parseInt(e.target.value))}
              className="rv4-ctrl-btn"
              style={{
                background: 'var(--terminal-dark)',
                color: 'var(--phosphor-green)',
                cursor: 'pointer',
                minWidth: '160px',
                padding: '5px 10px',
              }}
            >
              {models.map(model => (
                <option key={model.id} value={model.id}>
                  {model.displayName || model.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Controls bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 20px',
          background: 'rgba(0,0,0,0.3)',
          borderBottom: '1px solid rgba(192, 192, 192, 0.15)',
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--phosphor-dim)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Period</span>
            <div className="rv4-ctrl-group">
              {periods.map(p => (
                <button
                  key={p.key}
                  className={`rv4-ctrl-btn${period === p.key ? ' active' : ''}`}
                  onClick={() => setPeriod(p.key)}
                  disabled={loading}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--phosphor-dim)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Benchmark Suite</span>
            <div className="rv4-ctrl-group">
              {scoringModes.map(m => (
                <button
                  key={m.key}
                  className={`rv4-ctrl-btn${scoringMode === m.key ? ' active' : ''}`}
                  onClick={() => setScoringMode(m.key)}
                  disabled={loading}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <span style={{ fontSize: '10px', color: 'var(--amber-warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="vintage-loading" style={{ fontSize: '10px' }}></span>
              LOADING
            </span>
          )}
        </div>

        <div className="rv4-body">
          {error && (
            <div className="rv4-error-banner" style={{ marginBottom: '14px' }}>
              <span>⚠</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>DATA ERROR</div>
                <div style={{ fontSize: '10px' }}>{error}</div>
              </div>
              <button onClick={fetchHistory} className="rv4-ctrl-btn danger" style={{ marginLeft: 'auto', fontSize: '10px' }}>RETRY</button>
            </div>
          )}

          {/* Hour-of-day recommendation banner (based on 7-day data) */}
          {hourRec && hourRec.coverage >= 30 && (
            <div className="rv4-panel" style={{ marginBottom: '16px' }}>
              <div className="rv4-panel-header">
                <span className="rv4-panel-title">⏰ OPTIMAL HOURS — {modeLabel} (7-DAY ANALYSIS)</span>
                <span style={{ fontSize: '9px', color: 'var(--phosphor-dim)' }}>
                  {hourRec.coverage}% hourly coverage • {hourRec.variance} pt variance
                </span>
              </div>
              <div className="rv4-panel-body" style={{ padding: '0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'rgba(192,192,192,0.15)' }}>
                  {/* Best hours */}
                  <div style={{
                    padding: '16px 18px',
                    background: 'var(--terminal-dark)',
                  }}>
                    <div style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--phosphor-dim)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>
                      ✅ BEST HOURS TO USE THIS MODEL
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--phosphor-green)', textShadow: '0 0 6px rgba(0,255,65,0.4)', marginBottom: '6px', letterSpacing: '1px' }}>
                      {hourRec.bestHours}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.5' }}>
                      Peak at <strong style={{ color: 'var(--phosphor-green)' }}>{hourRec.peakHour}</strong> with score <strong style={{ color: 'var(--phosphor-green)' }}>{hourRec.peakScore}</strong>
                    </div>
                  </div>

                  {/* Worst hours */}
                  <div style={{
                    padding: '16px 18px',
                    background: 'var(--terminal-dark)',
                  }}>
                    <div style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--phosphor-dim)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>
                      ⚠️ WORST HOURS TO USE THIS MODEL
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--red-alert)', textShadow: '0 0 6px rgba(255,45,0,0.4)', marginBottom: '6px', letterSpacing: '1px' }}>
                      {hourRec.worstHours}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.5' }}>
                      Low at <strong style={{ color: 'var(--red-alert)' }}>{hourRec.lowHour}</strong> with score <strong style={{ color: 'var(--red-alert)' }}>{hourRec.lowScore}</strong>
                    </div>
                  </div>
                </div>

                {/* Recommendation text */}
                <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(192,192,192,0.15)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--metal-silver)', lineHeight: '1.6' }}>
                    {hourRec.variance > 10 ? (
                      <>
                        <strong style={{ color: 'var(--amber-warning)' }}>⚡ Significant time-of-day impact.</strong>{' '}
                        This model&apos;s {modeLabel.toLowerCase()} performance varies by <strong>{hourRec.variance} points</strong> depending on the hour.
                        For best results, schedule important tasks during <strong style={{ color: 'var(--phosphor-green)' }}>{hourRec.bestHours}</strong>.
                        Average score across all hours: <strong>{hourRec.avgScore}</strong>.
                      </>
                    ) : hourRec.variance > 5 ? (
                      <>
                        <strong style={{ color: 'var(--amber-warning)' }}>📊 Moderate time variation.</strong>{' '}
                        Performance varies by <strong>{hourRec.variance} points</strong>. Slight preference for{' '}
                        <strong style={{ color: 'var(--phosphor-green)' }}>{hourRec.bestHours}</strong>.
                        Average score: <strong>{hourRec.avgScore}</strong>.
                      </>
                    ) : (
                      <>
                        <strong style={{ color: 'var(--phosphor-green)' }}>✅ Stable performance.</strong>{' '}
                        Only <strong>{hourRec.variance} points</strong> of variation across the day.
                        This model performs consistently regardless of time. Average score: <strong>{hourRec.avgScore}</strong>.
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stat bar with chart insights */}
          {insights && (
            <div className="rv4-stat-bar cols-4" style={{ borderRadius: '3px', marginBottom: '16px' }}>
              <div className="rv4-stat-cell accent-green">
                <div className="rv4-stat-label">Best Score</div>
                <div className="rv4-stat-value">{insights.bestScore}</div>
                <div className="rv4-stat-sub">{period === 'latest' ? 'LATEST' : period.toUpperCase()} period</div>
              </div>
              <div className="rv4-stat-cell accent-red">
                <div className="rv4-stat-label">Worst Score</div>
                <div className="rv4-stat-value red">{insights.worstScore}</div>
                <div className="rv4-stat-sub">{insights.variance} pt range</div>
              </div>
              <div className="rv4-stat-cell accent-amber">
                <div className="rv4-stat-label">Average Score</div>
                <div className="rv4-stat-value amber">{insights.avgScore}</div>
                <div className="rv4-stat-sub">{modeLabel}</div>
              </div>
              <div className="rv4-stat-cell accent-blue">
                <div className="rv4-stat-label">Data Points</div>
                <div className="rv4-stat-value blue">{insights.dataPoints}</div>
                <div className="rv4-stat-sub">{selectedModel?.displayName || selectedModel?.name}</div>
              </div>
            </div>
          )}

          {/* Chart panel */}
          <div className="rv4-panel" style={{ marginBottom: '16px' }}>
            <div className="rv4-panel-header">
              <span className="rv4-panel-title">
                📈 PERFORMANCE TIMELINE — {modeLabel}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>
                {selectedModel?.displayName || selectedModel?.name || 'Select a model'} • {period === 'latest' ? 'LATEST' : period.toUpperCase()}
              </span>
            </div>
            <div className="rv4-panel-body" style={{ padding: '10px 14px' }}>
              {loading ? (
                <div className="rv4-loading" style={{ minHeight: '200px' }}>
                  <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
                  <span>ANALYZING PERFORMANCE DATA</span>
                </div>
              ) : isEmpty ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '250px',
                  gap: '8px',
                }}>
                  <div style={{ fontSize: '2em' }}>📊</div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--phosphor-green)', letterSpacing: '0.5px' }}>
                    {scoringMode === 'reasoning' && period === '24h'
                      ? 'REASONING DATA UNAVAILABLE FOR 24H'
                      : scoringMode === 'tooling' && period === '24h'
                        ? 'TOOLING DATA UNAVAILABLE FOR 24H'
                        : 'NO DATA AVAILABLE FOR THIS PERIOD'}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>
                    {scoringMode === 'reasoning' && period === '24h'
                      ? 'Deep reasoning tests run daily. Try 7D for data.'
                      : scoringMode === 'tooling' && period === '24h'
                        ? 'Tool calling tests run daily. Try 7D for data.'
                        : 'Try selecting a different time period or benchmark suite.'}
                  </div>
                  {(period === '24h') && (
                    <button
                      onClick={() => setPeriod('7d')}
                      className="rv4-ctrl-btn primary"
                      style={{ marginTop: '8px', fontSize: '10px', padding: '6px 14px' }}
                    >
                      VIEW 7-DAY DATA →
                    </button>
                  )}
                </div>
              ) : (
                <PerformanceChart
                  data={chartData}
                  chartType="historical"
                  height={380}
                  showLegend={false}
                  showMinMax={false}
                  xAxisInterval="preserveStartEnd"
                  yAxisLabel="SCORE"
                  lineColor="#00ff41"
                />
              )}
            </div>
          </div>

          {/* Warning for reasoning/tooling with limited data */}
          {(scoringMode === 'reasoning' || scoringMode === 'tooling') && insights && insights.dataPoints < 5 && (
            <div className="rv4-info-banner amber" style={{ marginBottom: '14px', padding: '12px 14px' }}>
              <span className="rv4-info-banner-icon" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold' }}>[NOTE]</span>
              <div className="rv4-info-banner-content">
                <div className="rv4-info-banner-title">LIMITED DATA FOR {modeLabel}</div>
                <div className="rv4-info-banner-text">
                  {scoringMode === 'reasoning'
                    ? 'Reasoning tests run once daily at 3:00 AM UTC. For hourly patterns, switch to CODING.'
                    : 'Tool calling tests run once daily at 4:00 AM UTC. For hourly patterns, switch to CODING.'}
                </div>
              </div>
            </div>
          )}

          {/* Canonical score info */}
          {canonicalScore !== null && (
            <div className="rv4-info-banner green" style={{ marginBottom: '14px', padding: '12px 14px' }}>
              <span className="rv4-info-banner-icon" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold' }}>[SCORE]</span>
              <div className="rv4-info-banner-content">
                <div className="rv4-info-banner-title">CURRENT {modeLabel} SCORE: {canonicalScore}</div>
                <div className="rv4-info-banner-text">
                  Canonical score from the latest benchmark run, consistent with /models/{selectedModelId}
                </div>
              </div>
            </div>
          )}
        </div>
      </SubscriptionGuard>
    </RouterLayout>
  );
}
