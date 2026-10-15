import { Children, type ReactNode } from 'react';

export type Tone = 'good' | 'warn' | 'bad' | 'accent';

interface StatProps {
  /** The number (or short text). Pass <CountUp value={n} /> to animate it. */
  value: ReactNode;
  /** Unit after the number, smaller: "ms", "/ 1,000". */
  unit?: ReactNode;
  label: ReactNode;
  /** A detail line under the label. */
  sub?: ReactNode;
  tone?: Tone;
  /** Slanted colour key before the label, for stats that match a chart series. */
  keyTone?: Tone | 'ink';
}

export function Stat({ value, unit, label, sub, tone, keyTone }: StatProps) {
  return (
    <div className={`st-stat${tone ? ` is-${tone}` : ''}`}>
      <div className="st-stat-v">{value}{unit && <small>{unit}</small>}</div>
      <div className="st-stat-l">{keyTone && <i className={`st-key is-${keyTone}`} />}{label}</div>
      {sub && <div className="st-stat-s">{sub}</div>}
    </div>
  );
}

/**
 * A ruled row of big display numbers in one card, as on the landing's proof strip. Columns default
 * to the number of stats (1–6); narrower screens fold 4+ into rows, phones into two columns.
 */
export default function Stats({ children, columns, reveal = true }: { children: ReactNode; columns?: number; reveal?: boolean }) {
  const n = Math.max(1, Math.min(6, columns ?? Children.toArray(children).length));
  return <div className={`st-stats is-n${n}${reveal ? ' st-up' : ''}`}>{children}</div>;
}
