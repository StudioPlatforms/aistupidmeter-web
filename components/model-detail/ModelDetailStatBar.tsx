'use client';

import { Stats, Stat, CountUp, type Tone } from '@/components/studio';

interface ModelDetailStatBarProps {
  currentScore: number;
  status: string;
  totalRuns: number;
  successRate: number;
  averageLatency: number;
  averageCorrectness: number;
  lastUpdated: string;
  /** What `lastUpdated` refers to — for a composite, its oldest contributing suite. */
  lastUpdatedNote?: string;
  /** Tooltip: the age of every contributing suite. */
  lastUpdatedTitle?: string;
  /** e.g. "2 of 3 suites (no deep)"; null when every suite contributed. */
  coverage?: string | null;
  staleReason?: string | null;
}

/** Colour only what needs a look: below 80 is a warning, below 60 a problem; healthy stays ink. */
const toneFor = (value: number, warnBelow: number, badBelow: number): Tone | undefined =>
  value < badBelow ? 'bad' : value < warnBelow ? 'warn' : undefined;

const pct = (n: number) => `${Math.round(n)}%`;
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function ModelDetailStatBar({
  currentScore,
  status,
  totalRuns,
  successRate,
  averageLatency,
  averageCorrectness,
  lastUpdated,
  lastUpdatedNote,
  lastUpdatedTitle,
  coverage,
  staleReason,
}: ModelDetailStatBarProps) {
  const runs = totalRuns || 0;
  const rate = successRate || 0;
  const correctness = Math.round((averageCorrectness || 0) * 100);

  return (
    <Stats columns={6}>
      <Stat
        value={currentScore ? <CountUp value={currentScore} /> : '—'}
        label="Score"
        keyTone="accent"
        tone={currentScore ? toneFor(currentScore, 80, 60) : undefined}
        sub={<span title={staleReason ?? undefined}>{coverage ?? cap(status)}</span>}
      />
      <Stat
        value={<CountUp value={rate} format={pct} />}
        label="Success rate"
        tone={toneFor(rate, 80, 60)}
        sub={`${runs.toLocaleString('en-US')} total runs`}
      />
      <Stat value={<CountUp value={runs} />} label="Total runs" sub="Benchmark tasks" />
      <Stat
        value={averageLatency ? <CountUp value={Math.round(averageLatency)} /> : '—'}
        unit={averageLatency ? 'ms' : undefined}
        label="Latency"
        sub="Average"
      />
      <Stat
        value={<CountUp value={correctness} format={pct} />}
        label="Correctness"
        tone={toneFor(correctness, 80, 60)}
        sub="Average accuracy"
      />
      {/* The tooltip carries every contributing suite's age, so it sits on the whole cell. */}
      <div className="st-stat" title={lastUpdatedTitle}>
        <div className="st-stat-v">{lastUpdated || '—'}</div>
        <div className="st-stat-l">Last update</div>
        <div className="st-stat-s">{cap(lastUpdatedNote ?? 'benchmark time')}</div>
      </div>
    </Stats>
  );
}
