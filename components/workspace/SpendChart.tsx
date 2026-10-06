'use client';

/**
 * Spend per day: one series, so one colour (the accent) and no legend; the title names it.
 * Hovering (or tapping) a day shows its spend, requests and who spent most. The same numbers are
 * available as a table under the chart, for screen readers and for copying.
 */
import { useMemo, useState } from 'react';
import { money, num } from './ws';

export interface DayPoint { date: string; spendUsd: number; requests: number; successful: number; top: Array<{ userId: number; spendUsd: number }> }

/** Round the axis to 1, 2 or 5 × a power of ten, with at most four steps. */
function axis(max: number): number[] {
  if (!(max > 0)) return [0];
  const raw = max / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map(m => m * p).find(s => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.0001; v += step) out.push(Math.round(v / p) * p);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

const label = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });

export default function SpendChart({ days, nameOf }: { days: DayPoint[]; nameOf?: (userId: number) => string }) {
  const [on, setOn] = useState<number | null>(null);
  const max = useMemo(() => Math.max(0, ...days.map(d => d.spendUsd)), [days]);
  const ticks = useMemo(() => axis(max), [max]);
  const top = ticks[ticks.length - 1] || 1;
  const total = days.reduce((a, d) => a + d.spendUsd, 0);

  if (!days.length) return null;
  const hovered = on !== null ? days[on] : null;
  const leftPct = on !== null ? ((on + 0.5) / days.length) * 100 : 0;

  return (
    <div>
      {total === 0 ? (
        <p className="ws-empty">No Smart Router spend in this period.</p>
      ) : (
        <div className="ws-chart" onMouseLeave={() => setOn(null)}>
          <div className="ws-chart-plot">
            {ticks.map(t => (
              <div key={t} className="ws-chart-grid" style={{ bottom: `${(t / top) * 100}%` }}>
                <span className="ws-chart-tick">{money(t)}</span>
              </div>
            ))}
            {days.map((d, i) => (
              <div
                key={d.date}
                className={`ws-chart-col${on === i ? ' on' : ''}`}
                onMouseEnter={() => setOn(i)}
                onClick={() => setOn(on === i ? null : i)}
                aria-label={`${label(d.date, { day: 'numeric', month: 'short' })}: ${money(d.spendUsd)}`}
              >
                <div className="ws-chart-bar" style={{ height: `${(d.spendUsd / top) * 100}%` }} />
              </div>
            ))}
            {hovered && (
              <div
                className="ws-chart-tip"
                style={{ bottom: 'calc(100% - 4px)', left: `clamp(0px, calc(${leftPct}% - 75px), calc(100% - 160px))` }}
              >
                <strong>{label(hovered.date, { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
                {money(hovered.spendUsd)} · {num(hovered.requests)} request{hovered.requests === 1 ? '' : 's'}
                {hovered.requests > hovered.successful && <> · {num(hovered.requests - hovered.successful)} failed</>}
                {nameOf && hovered.top.length > 0 && (
                  <div style={{ marginTop: 4, color: 'var(--phosphor-dim)' }}>
                    {hovered.top.map(t => <div key={t.userId}>{nameOf(t.userId)}: {money(t.spendUsd)}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="ws-chart-x">
            <span>{label(days[0].date, { day: 'numeric', month: 'short' })}</span>
            {days.length > 6 && <span>{label(days[Math.floor(days.length / 2)].date, { day: 'numeric', month: 'short' })}</span>}
            <span>{label(days[days.length - 1].date, { day: 'numeric', month: 'short' })}</span>
          </div>
        </div>
      )}
      <details style={{ marginTop: 8 }}>
        <summary className="ws-note" style={{ cursor: 'pointer' }}>Show as a table</summary>
        <div className="ws-table-wrap" style={{ marginTop: 6 }}>
          <table className="ws-table">
            <thead><tr><th>Day</th><th className="num">Spend</th><th className="num">Requests</th><th className="num">Failed</th></tr></thead>
            <tbody>
              {days.filter(d => d.requests > 0).map(d => (
                <tr key={d.date}>
                  <td>{label(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                  <td className="num">{money(d.spendUsd)}</td>
                  <td className="num">{num(d.requests)}</td>
                  <td className="num">{num(d.requests - d.successful)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
