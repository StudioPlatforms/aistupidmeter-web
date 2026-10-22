'use client';

/**
 * The admin page's charts: columns per day (stacked when there are two series) and lines per
 * day. Hand-drawn SVG at the container's real width, so text never scales. Marks follow the
 * dataviz rules: bars at most 24px with 4px rounded tops and a 2px surface gap between stacked
 * segments, 2px lines, ringed markers, hairline grids, a legend for two or more series, and a
 * tooltip on hover and keyboard focus. Every chart pane can switch to the same numbers as a table.
 *
 * Colours are tokens (styles/studio-admin.css): --ad-c1/--ad-c2 for series, --ad-fail for failed
 * requests, each validated for both themes.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Pane } from '@/components/studio';
import { compact, day, num } from './format';

export interface Series { key: string; label: string; color: string }

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.floor(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(entries => setWidth(Math.floor(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A clean top for the axis, so the ticks (0, half, top) are round numbers. */
function niceMax(v: number): number {
  if (v <= 4) return 4;
  if (v <= 10) return Math.ceil(v / 2) * 2;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 4 ? 4 : f <= 5 ? 5 : f <= 8 ? 8 : 10) * exp;
}

const PAD = { left: 40, right: 10, top: 12, bottom: 26 };

function Legend({ series, shape }: { series: Series[]; shape: 'rect' | 'line' }) {
  if (series.length < 2) return null;
  return (
    <ul className="ad-legend">
      {series.map(s => (
        <li key={s.key}><i className={shape === 'line' ? 'is-line' : undefined} style={{ background: s.color }} />{s.label}</li>
      ))}
    </ul>
  );
}

function Tip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 76), Math.max(76, width - 76));
  return <div className="ad-tip" role="status" style={{ left, top: y }}>{children}</div>;
}

/** Columns per day; stacked bottom-up in series order. */
export function DayColumns({ dates, series, values, unit, height = 210 }: {
  dates: string[]; series: Series[]; values: number[][]; unit: string; height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const totals = dates.map((_, i) => series.reduce((n, _s, k) => n + (values[k]?.[i] ?? 0), 0));
  const max = niceMax(Math.max(0, ...totals));
  const band = dates.length ? plotW / dates.length : 0;
  const barW = Math.max(2, Math.min(24, band - 2));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const every = dates.length > 20 ? 7 : dates.length > 10 ? 3 : 1;
  const sum = totals.reduce((a, b) => a + b, 0);

  return (
    <div className="ad-chart-wrap">
      <Legend series={series} shape="rect" />
      <div className="ad-chart" ref={ref} style={{ height }} onPointerLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={`${num(sum)} ${unit} over ${dates.length} days, per day`}>
            {[0, max / 2, max].map(t => (
              <g key={t}>
                <line className="ad-grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
                <text className="ad-tick" x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">{compact(t)}</text>
              </g>
            ))}
            {dates.map((d, i) => {
              const x = PAD.left + i * band + (band - barW) / 2;
              let cum = 0;
              const segs = series.map((s, k) => {
                const v = values[k]?.[i] ?? 0;
                const from = cum;
                cum += v;
                return { s, v, from, to: cum };
              }).filter(seg => seg.v > 0);
              const dim = hover !== null && hover !== i;
              return (
                <g key={d} style={{ opacity: dim ? 0.45 : 1, transition: 'opacity .15s' }}>
                  {segs.map((seg, j) => {
                    const yTop = y(seg.to);
                    // A 2px gap in the card colour separates a segment from the one under it.
                    const yBottom = y(seg.from) - (j > 0 ? 2 : 0);
                    const h = Math.max(1, yBottom - yTop);
                    if (j < segs.length - 1) {
                      return <rect key={seg.s.key} x={x} y={yTop} width={barW} height={h} style={{ fill: seg.s.color }} />;
                    }
                    const r = Math.min(4, barW / 2, h);
                    const path = `M${x},${yTop + h} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${yTop + h} Z`;
                    return <path key={seg.s.key} d={path} style={{ fill: seg.s.color }} />;
                  })}
                </g>
              );
            })}
            {dates.map((d, i) => {
              if ((dates.length - 1 - i) % every !== 0) return null;
              // The newest day's label ends at the plot's edge, so it is never clipped.
              const last = i === dates.length - 1;
              return (
                <text key={`l${d}`} className="ad-tick" x={last ? PAD.left + (i + 1) * band : PAD.left + i * band + band / 2} y={height - 8} textAnchor={last ? 'end' : 'middle'}>{day(d)}</text>
              );
            })}
            {dates.map((d, i) => (
              <rect
                key={`h${d}`}
                className="ad-hit"
                x={PAD.left + i * band} y={PAD.top} width={band} height={plotH}
                tabIndex={0}
                aria-label={`${day(d)}: ${series.map((s, k) => `${num(values[k]?.[i] ?? 0)} ${s.label.toLowerCase()}`).join(', ')}`}
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            ))}
          </svg>
        )}
        {hover !== null && width > 0 && (
          <Tip x={PAD.left + hover * band + band / 2} y={y(totals[hover]) - 10} width={width}>
            <span className="ad-tip-d">{day(dates[hover])}</span>
            {series.length === 1
              ? <span className="ad-tip-r"><b>{num(values[0]?.[hover] ?? 0)}</b> {unit}</span>
              : [...series].reverse().map(s => {
                  const k = series.indexOf(s);
                  return <span key={s.key} className="ad-tip-r"><i style={{ background: s.color }} /><b>{num(values[k]?.[hover] ?? 0)}</b> {s.label.toLowerCase()}</span>;
                })}
          </Tip>
        )}
      </div>
    </div>
  );
}

/** Lines per day, with a crosshair that snaps to the nearest day. */
export function DayLines({ dates, series, values, height = 230 }: {
  dates: string[]; series: Series[]; values: number[][]; height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(0, ...values.map(v => Math.max(0, ...v))));
  const step = dates.length > 1 ? plotW / (dates.length - 1) : 0;
  const x = (i: number) => PAD.left + i * step;
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const every = dates.length > 20 ? 7 : dates.length > 10 ? 3 : 1;

  const pick = (clientX: number, el: Element) => {
    const box = el.getBoundingClientRect();
    const i = Math.round((clientX - box.left - PAD.left) / (step || 1));
    setHover(Math.min(dates.length - 1, Math.max(0, i)));
  };
  const onKey = (e: KeyboardEvent<SVGRectElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setHover(h => Math.min(dates.length - 1, Math.max(0, (h ?? dates.length - 1) + (e.key === 'ArrowRight' ? 1 : -1))));
  };

  return (
    <div className="ad-chart-wrap">
      <Legend series={series} shape="line" />
      <div className="ad-chart" ref={ref} style={{ height }} onPointerLeave={() => setHover(null)}>
        {width > 0 && dates.length > 0 && (
          <svg width={width} height={height} role="img" aria-label={`${series.map(s => s.label).join(' and ')} per day, ${dates.length} days`}>
            {[0, max / 2, max].map(t => (
              <g key={t}>
                <line className="ad-grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
                <text className="ad-tick" x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">{compact(t)}</text>
              </g>
            ))}
            {dates.map((d, i) => ((dates.length - 1 - i) % every === 0) && (
              <text key={`l${d}`} className="ad-tick" x={x(i)} y={height - 8} textAnchor={i === dates.length - 1 ? 'end' : 'middle'}>{day(d)}</text>
            ))}
            {hover !== null && <line className="ad-cross" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} />}
            {series.map((s, k) => (
              <path
                key={s.key}
                d={values[k].map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
                style={{ stroke: s.color }}
                className="ad-line"
              />
            ))}
            {hover !== null && series.map((s, k) => (
              <circle key={s.key} cx={x(hover)} cy={y(values[k][hover])} r={4} className="ad-dot" style={{ fill: s.color }} />
            ))}
            <rect
              className="ad-hit"
              x={PAD.left - step / 2} y={PAD.top} width={plotW + step} height={plotH}
              tabIndex={0}
              aria-label="Use the arrow keys to read each day"
              onPointerMove={e => pick(e.clientX, e.currentTarget.ownerSVGElement ?? e.currentTarget)}
              onPointerDown={e => pick(e.clientX, e.currentTarget.ownerSVGElement ?? e.currentTarget)}
              onFocus={() => setHover(h => h ?? dates.length - 1)}
              onBlur={() => setHover(null)}
              onKeyDown={onKey}
            />
          </svg>
        )}
        {hover !== null && width > 0 && (
          <Tip x={x(hover)} y={Math.min(...series.map((_, k) => y(values[k][hover]))) - 12} width={width}>
            <span className="ad-tip-d">{day(dates[hover])}</span>
            {series.map((s, k) => (
              <span key={s.key} className="ad-tip-r"><i className="is-line" style={{ background: s.color }} /><b>{num(values[k][hover])}</b> {s.label.toLowerCase()}</span>
            ))}
          </Tip>
        )}
      </div>
    </div>
  );
}

/**
 * A pane holding a chart, with a switch to the same numbers as a table.
 *
 * The pane's own props stay the same in both views: StudioEffects marks a pane revealed by adding
 * a class to it, and a className React re-renders (flush/ruled toggling) would wipe that class and
 * hide the pane for good. The padding lives in the body instead.
 */
export function ChartPane({ title, sub, dates, series, values, children, delay }: {
  title: ReactNode; sub?: ReactNode; dates: string[]; series: Series[]; values: number[][]; children: ReactNode; delay?: number;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <Pane
      title={title}
      sub={sub}
      delay={delay}
      flush
      actions={
        <div className="st-seg" role="group" aria-label="View">
          <button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')}>Chart</button>
          <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
        </div>
      }
    >
      {view === 'chart' ? <div className="ad-pad">{children}</div> : (
        <div className="st-table-wrap ad-scroll ad-ruled">
          <table className="st-table">
            <thead><tr><th>Day</th>{series.map(s => <th key={s.key} className="is-num">{s.label}</th>)}</tr></thead>
            <tbody>
              {dates.map((d, i) => ({ d, i })).reverse().map(({ d, i }) => (
                <tr key={d}><td>{day(d)}</td>{series.map((s, k) => <td key={s.key} className="is-num">{num(values[k]?.[i] ?? 0)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Pane>
  );
}
