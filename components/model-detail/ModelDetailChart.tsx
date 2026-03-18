'use client';

import PerformanceChart from '../PerformanceChart';

type HistoricalPeriod = 'latest' | '24h' | '7d' | '1m';
type ScoringMode = 'combined' | 'reasoning' | 'speed' | 'tooling';

interface HistoryPoint {
  timestamp: string;
  stupidScore: number;
  displayScore?: number;
  axes: Record<string, number>;
}

interface ModelDetailChartProps {
  history: HistoryPoint[];
  selectedPeriod: HistoricalPeriod;
  selectedScoringMode: ScoringMode;
  onSwitchPeriod: (period: HistoricalPeriod) => void;
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

export default function ModelDetailChart({
  history,
  selectedPeriod,
  selectedScoringMode,
  onSwitchPeriod,
}: ModelDetailChartProps) {
  // Filter/limit history based on period
  let filteredHistory: HistoryPoint[] = [];
  if (selectedPeriod === 'latest') {
    filteredHistory = history.slice(0, 24);
  } else {
    filteredHistory = history;
  }

  const data = [...filteredHistory].reverse(); // oldest → newest (left to right)

  const modeLabel = selectedScoringMode === 'speed' ? '7AXIS'
    : selectedScoringMode.toUpperCase();

  // Build empty state info
  const isEmpty = data.length === 0;
  let emptyMessage = 'NO DATA AVAILABLE FOR THIS PERIOD';
  let emptySuggestion = 'Showing most recent available data instead';
  let showSwitch = false;

  if (isEmpty) {
    if (selectedScoringMode === 'reasoning' && selectedPeriod === '24h') {
      emptyMessage = 'REASONING DATA UNAVAILABLE FOR 24H';
      emptySuggestion = 'Deep reasoning tests run daily. Try 7D for data.';
      showSwitch = true;
    } else if (selectedScoringMode === 'tooling' && selectedPeriod === '24h') {
      emptyMessage = 'TOOLING DATA UNAVAILABLE FOR 24H';
      emptySuggestion = 'Tool calling tests run daily. Try 7D for data.';
      showSwitch = true;
    } else if (selectedPeriod === '24h') {
      emptyMessage = 'NO DATA IN LAST 24 HOURS';
      emptySuggestion = 'Benchmarks may be paused. Try 7D view.';
      showSwitch = true;
    }

    return (
      <div className="md-chart-section">
        <div className="md-chart-title">📈 PERFORMANCE TIMELINE — {modeLabel}</div>
        <div className="md-chart-empty">
          <div className="md-chart-empty-inner">
            <div className="md-chart-empty-icon">📊</div>
            <div className="md-chart-empty-title">{emptyMessage}</div>
            <div className="md-chart-empty-sub">{emptySuggestion}</div>
            {showSwitch && (
              <button
                onClick={() => onSwitchPeriod('7d')}
                className="vintage-btn"
                style={{ fontSize: '11px', padding: '6px 14px', marginTop: '4px' }}
              >
                VIEW 7-DAY DATA →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Format time labels based on period
  const chartData = data.map((point) => {
    const ts = new Date(point.timestamp);
    let name = '';
    if (selectedPeriod === '24h') {
      name = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (selectedPeriod === '7d') {
      name = ts.toLocaleDateString([], { weekday: 'short', hour: '2-digit' });
    } else if (selectedPeriod === '1m') {
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

  return (
    <div className="md-chart-section">
      <div className="md-chart-title">📈 PERFORMANCE TIMELINE — {modeLabel}</div>
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
    </div>
  );
}
