'use client';

import PerformanceChart from '../PerformanceChart';
import { Pane, Empty } from '@/components/studio';

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

const MODE_LABEL: Record<ScoringMode, string> = {
  combined: 'Combined', reasoning: 'Reasoning', speed: 'Coding', tooling: 'Tool use',
};
const PERIOD_SPAN: Record<HistoricalPeriod, string> = {
  latest: 'latest runs', '24h': 'last 24 hours', '7d': 'last 7 days', '1m': 'last month',
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

  const modeLabel = MODE_LABEL[selectedScoringMode] ?? selectedScoringMode;
  const sub = `${modeLabel} score · ${PERIOD_SPAN[selectedPeriod] ?? selectedPeriod}`;

  // Build empty state info
  const isEmpty = data.length === 0;
  let emptyMessage = 'No data available for this period';
  let emptySuggestion = 'No benchmark run of this kind finished in the selected period. Try a longer period.';
  let showSwitch = false;

  if (isEmpty) {
    if (selectedScoringMode === 'reasoning' && selectedPeriod === '24h') {
      emptyMessage = 'Reasoning data unavailable for 24 hours';
      emptySuggestion = 'Deep reasoning tests run daily. Try 7 days for data.';
      showSwitch = true;
    } else if (selectedScoringMode === 'tooling' && selectedPeriod === '24h') {
      emptyMessage = 'Tool-use data unavailable for 24 hours';
      emptySuggestion = 'Tool calling tests run daily. Try 7 days for data.';
      showSwitch = true;
    } else if (selectedPeriod === '24h') {
      emptyMessage = 'No data in the last 24 hours';
      emptySuggestion = 'Benchmarks may be paused. Try the 7-day view.';
      showSwitch = true;
    }

    return (
      <Pane title="Performance timeline" sub={sub}>
        <Empty
          title={emptyMessage}
          actions={showSwitch && (
            <button type="button" className="st-btn is-primary" onClick={() => onSwitchPeriod('7d')}>
              View 7-day data <span className="st-ar" aria-hidden="true">→</span>
            </button>
          )}
        >
          {emptySuggestion}
        </Empty>
      </Pane>
    );
  }

  // The first and last time in view decide how much a tick needs to say.
  const first = new Date(data[0].timestamp);
  const last = new Date(data[data.length - 1].timestamp);
  const spanDays = Math.abs(last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24);

  // Format time labels based on period (the tooltip's heading)
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

  // Axis ticks stay flat and short — a time inside one day, otherwise one date per day (on the
  // day's first run) — and the axis drops whichever would collide, so phones get a few clean
  // labels instead of rotated soup. The tooltip keeps the full label.
  const multiDay = spanDays >= 1.5;
  const tick = (value: string) => {
    const ts = new Date(value);
    if (Number.isNaN(ts.getTime())) return String(value);
    return multiDay
      ? ts.toLocaleDateString([], { month: 'short', day: 'numeric' })
      : ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const dayTicks = multiDay
    ? chartData
        .filter((p, i) => i === 0 || new Date(p.timestamp).toDateString() !== new Date(chartData[i - 1].timestamp).toDateString())
        .map(p => p.timestamp)
    : undefined;

  const latest = chartData[chartData.length - 1];
  const ariaLabel = `${modeLabel} score over ${chartData.length} ${chartData.length === 1 ? 'run' : 'runs'}, `
    + `from ${chartData[0].name} to ${latest.name}; latest ${latest.score}.`;

  return (
    <Pane title="Performance timeline" sub={sub} className="sm-timeline">
      <PerformanceChart
        variant="studio"
        data={chartData}
        chartType="historical"
        height={360}
        mobileHeight={250}
        xKey="timestamp"
        xTickFormatter={tick}
        xTicks={dayTicks}
        xAxisInterval="preserveStartEnd"
        lineColor="var(--lp-accent)"
        ariaLabel={ariaLabel}
      />
    </Pane>
  );
}
