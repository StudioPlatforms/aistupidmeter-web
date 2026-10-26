import type { HourBucket } from '@/components/landing/types';
import { cell, hourTitle, weekRows } from './status-utils';

/**
 * Seven days of checks, hour by hour, as a calendar: one row per UTC day, one column per hour,
 * oldest day first. Server-rendered, 168 real cells plus blanks for the hours outside the window
 * so the columns line up. The cell colours are the status board's (blue/red/warn, hatched for our
 * side, faint for no check); 24 columns fit a phone, so nothing scrolls sideways.
 */
const LEGEND: Array<[string, string]> = [
  ['', 'Answered'],
  ['w', 'Slow'],
  ['b', 'Did not answer'],
  ['o', 'Not measured — our side, counted as neither'],
  ['e', 'No check'],
];

export function WeekGrid({ hours, now, label }: { hours: HourBucket[]; now: Date; label: string }) {
  const rows = weekRows(hours, now);
  if (!rows.length) return null;
  return (
    <div className="ps-week lp-up">
      <div className="ps-week-cols" aria-hidden="true">
        <span />
        <div><span>00</span><span>06</span><span>12</span><span>18</span></div>
      </div>
      <div role="img" aria-label={`${label}: one cell per hour over the last 7 days, UTC`}>
        {rows.map((r) => (
          <div className="ps-week-row" key={r.date}>
            <span className="ps-week-day">{r.label}</span>
            <div className="ps-week-cells">
              {r.cells.map((h, i) => (h
                ? <i key={i} className={cell(h) === '.' ? undefined : cell(h)} title={hourTitle(h)} />
                : <i key={i} className="x" />))}
            </div>
          </div>
        ))}
      </div>
      <div className="seo-bars-legend">
        {LEGEND.map(([cls, text]) => <span key={text} className={cls || undefined}><i />{text}</span>)}
        <span className="ps-week-utc">Hours in UTC</span>
      </div>
    </div>
  );
}
