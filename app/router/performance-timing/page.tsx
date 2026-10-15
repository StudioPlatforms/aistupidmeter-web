'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import BestHoursPanel from '@/components/BestHoursPanel';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import PerformanceChart from '@/components/PerformanceChart';
import { PageHead, Pane, Stats, Stat, CountUp, Loader, Empty, Note } from '@/components/studio';
import '@/styles/studio-insights.css';

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

const periods: Array<{ key: HistoricalPeriod; label: string; span: string }> = [
  { key: 'latest', label: 'Latest', span: 'Latest runs' },
  { key: '24h', label: '24 hours', span: 'Last 24 hours' },
  { key: '7d', label: '7 days', span: 'Last 7 days' },
  { key: '1m', label: '1 month', span: 'Last month' },
];

const scoringModes: Array<{ key: ScoringMode; label: string }> = [
  { key: 'combined', label: 'Combined' },
  { key: 'reasoning', label: 'Reasoning' },
  { key: 'speed', label: 'Coding' },
  { key: 'tooling', label: 'Tool use' },
];

const LEAD = 'Track model performance over time, with the same charts as the model detail pages.';

export default function PerformanceTimingPage() {
  const { data: session, status } = useSession();
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [period, setPeriod] = useState<HistoricalPeriod>('latest');
  const [scoringMode, setScoringMode] = useState<ScoringMode>('combined');
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [canonicalScore, setCanonicalScore] = useState<number | null>(null);
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

  const selectedModel = models.find(m => m.id === selectedModelId);
  const modelName = selectedModel?.displayName || selectedModel?.name;
  const modeLabel = scoringModes.find(m => m.key === scoringMode)?.label ?? scoringMode;
  const periodInfo = periods.find(p => p.key === period) ?? periods[0];

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
        <PageHead kicker="Smart Router" title="Performance timing" lead={LEAD} />
        <div className="st-body" data-page-loading>
          <Loader label="Loading" minHeight={320} />
        </div>
      </RouterLayout>
    );
  }

  return (
    <RouterLayout>
      <SubscriptionGuard feature="Performance timing" requires="routing-analytics">
        <PageHead
          kicker="Smart Router"
          title="Performance timing"
          lead={LEAD}
          actions={
            <label className="sa-model">
              <span className="st-field-label">Model</span>
              <select
                value={selectedModelId || ''}
                onChange={(e) => setSelectedModelId(parseInt(e.target.value))}
                className="st-select"
              >
                {models.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.displayName || model.name}
                  </option>
                ))}
              </select>
            </label>
          }
        >
          <div className="sa-controls">
            <div className="sa-control">
              <span className="st-label" id="sa-pt-period">Period</span>
              <div className="st-seg is-scroll" role="group" aria-labelledby="sa-pt-period">
                {periods.map(p => (
                  <button key={p.key} type="button" aria-pressed={period === p.key} onClick={() => setPeriod(p.key)} disabled={loading}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sa-control">
              <span className="st-label" id="sa-pt-suite">Benchmark suite</span>
              <div className="st-seg is-scroll" role="group" aria-labelledby="sa-pt-suite">
                {scoringModes.map(m => (
                  <button key={m.key} type="button" aria-pressed={scoringMode === m.key} onClick={() => setScoringMode(m.key)} disabled={loading}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {loading && (
              <span className="sa-busy" role="status">
                <span className="st-bars" aria-hidden="true"><i /><i /><i /></span>
                Loading
              </span>
            )}
          </div>
        </PageHead>

        <div className="st-body">
          {error && (
            <Note tone="bad" title="Performance data could not load">
              <div className="sa-note-row">
                <span>{error}</span>
                <button type="button" onClick={fetchHistory} className="st-btn is-sm">Retry</button>
              </div>
            </Note>
          )}

          {/* Best and worst hours of the day, from the hourly canary (two weeks, every hour). */}
          <BestHoursPanel modelId={selectedModelId} modelName={modelName} />

          {/* Stat row with chart insights */}
          {insights && (
            <Stats columns={4}>
              <Stat value={<CountUp value={insights.bestScore} />} label="Best score" sub={periodInfo.span} tone="good" />
              <Stat value={<CountUp value={insights.worstScore} />} label="Worst score" sub={`${insights.variance} pt range`} tone="bad" />
              <Stat value={<CountUp value={insights.avgScore} />} label="Average score" sub={`${modeLabel} suite`} />
              <Stat value={<CountUp value={insights.dataPoints} />} label="Data points" sub={modelName} />
            </Stats>
          )}

          {/* Chart */}
          <Pane
            className="sa-perf"
            title="Performance timeline"
            sub={`${modeLabel} score · ${modelName || 'Select a model'} · ${periodInfo.label}`}
            ruled
          >
            {loading ? (
              <Loader label="Analyzing performance data" minHeight={300} />
            ) : isEmpty ? (
              <Empty
                title={scoringMode === 'reasoning' && period === '24h'
                  ? 'Reasoning data unavailable for 24 hours'
                  : scoringMode === 'tooling' && period === '24h'
                    ? 'Tool use data unavailable for 24 hours'
                    : 'No data available for this period'}
                actions={period === '24h' && (
                  <button type="button" onClick={() => setPeriod('7d')} className="st-btn is-primary">
                    View 7-day data <span className="st-ar" aria-hidden="true">→</span>
                  </button>
                )}
              >
                {scoringMode === 'reasoning' && period === '24h'
                  ? 'Deep reasoning tests run daily. Try 7 days for data.'
                  : scoringMode === 'tooling' && period === '24h'
                    ? 'Tool calling tests run daily. Try 7 days for data.'
                    : 'Try selecting a different time period or benchmark suite.'}
              </Empty>
            ) : (
              <PerformanceChart
                data={chartData}
                chartType="historical"
                height={380}
                showLegend={false}
                showMinMax={false}
                xAxisInterval="preserveStartEnd"
                yAxisLabel="Score"
                lineColor="var(--lp-accent)"
              />
            )}
          </Pane>

          {/* Warning for reasoning/tooling with limited data */}
          {(scoringMode === 'reasoning' || scoringMode === 'tooling') && insights && insights.dataPoints < 5 && (
            <Note tone="warn" title={`Limited data for ${modeLabel.toLowerCase()}`}>
              {scoringMode === 'reasoning'
                ? 'Reasoning tests run once daily at 3:00 AM UTC. For hourly patterns, switch to Coding.'
                : 'Tool calling tests run once daily at 4:00 AM UTC. For hourly patterns, switch to Coding.'}
            </Note>
          )}

          {/* Canonical score info */}
          {canonicalScore !== null && (
            <Note title={`Current ${modeLabel.toLowerCase()} score: ${canonicalScore}`}>
              Canonical score from the latest benchmark run, consistent with{' '}
              <Link href={`/models/${selectedModelId}`}>/models/{selectedModelId}</Link>
            </Note>
          )}
        </div>
      </SubscriptionGuard>
    </RouterLayout>
  );
}
