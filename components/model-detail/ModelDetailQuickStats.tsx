'use client';

import { Pane, CountUp, Tag } from '@/components/studio';

interface ModelDetailQuickStatsProps {
  currentScore: number;
  status: string;
  totalRuns: number;
  successRate: number;
  averageLatency: number;
  averageCorrectness: number;
  selectedPeriod: string;
}

const STATUS_TONE: Record<string, 'good' | 'warn' | 'bad' | undefined> = {
  excellent: 'good', good: 'good', warning: 'warn', critical: 'bad',
};
const PERIOD_WORDS: Record<string, string> = { '24h': '24 hours', '7d': '7 days', '1m': '30 days' };

/** Healthy values stay ink; below 80 reads as a warning, below 60 as a problem. */
const toneClass = (value: number) => (value < 60 ? 'sm-kv-bad' : value < 80 ? 'sm-kv-warn' : undefined);
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function ModelDetailQuickStats({
  currentScore,
  status,
  totalRuns,
  successRate,
  averageLatency,
  averageCorrectness,
  selectedPeriod,
}: ModelDetailQuickStatsProps) {
  const periodLabel = selectedPeriod === 'latest'
    ? 'Current performance'
    : `Performance (${PERIOD_WORDS[selectedPeriod] ?? selectedPeriod})`;

  const periodDesc = selectedPeriod === 'latest'
    ? 'Latest benchmark results'
    : `Metrics within the last ${selectedPeriod === '24h' ? '24 hours' : selectedPeriod === '7d' ? '7 days' : '30 days'}`;

  const correctness = Math.round((averageCorrectness || 0) * 100);

  return (
    <Pane
      title={periodLabel}
      sub={periodDesc}
      foot="Coding scores are a weighted composite of 9 axes."
    >
      <div className="sm-big">
        <div className="sm-big-v"><CountUp value={currentScore || 0} /></div>
        <div className="sm-big-l">
          {selectedPeriod === 'latest' ? 'Latest score' : 'Average score'}
          <Tag tone={STATUS_TONE[status]}>{cap(status)}</Tag>
        </div>
      </div>

      <dl className="st-kv sm-kv">
        <div><dt>Total runs</dt><dd>{(totalRuns || 0).toLocaleString('en-US')}</dd></div>
        <div><dt>Success rate</dt><dd className={toneClass(successRate || 0)}>{successRate || 0}%</dd></div>
        <div><dt>Avg latency</dt><dd>{Math.round(averageLatency || 0).toLocaleString('en-US')} ms</dd></div>
        <div><dt>Correctness</dt><dd className={toneClass(correctness)}>{correctness}%</dd></div>
      </dl>
    </Pane>
  );
}
