import Link from 'next/link';
import type { ReactNode } from 'react';
import type { CanaryCell, SuiteCell, Tone, TrackerRow } from './tracker-data';

/**
 * One family's rows on the AI degradation tracker: per suite, the detector's verdict as a pill,
 * a bar for how close its statistic is to the threshold, and the 24-hour score; then the hourly
 * canary's state. The first column carries the model's overall status and, while it has an
 * alarm, what drift-aware routing does with it. On phones each row becomes a card (the cells
 * keep their labels through data-label). Server component on reading.css's ruled table; the
 * tk-* rules are in styles/seo-tracker.css.
 */

const fmtScore = (s: number): string => (Number.isInteger(s) ? String(s) : s.toFixed(1));

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`lp-pill ${tone}`}>{children}</span>;
}

function Suite({ c }: { c: SuiteCell }) {
  const near = c.tone === 'ok' && c.meter !== null && c.meter >= 0.8;
  return (
    <td className="tk-cell" data-label={c.label}>
      <Pill tone={c.tone}>{c.state}</Pill>
      {c.meter !== null && (
        <span className={`tk-meter ${near ? 'near' : c.tone}`} aria-hidden="true">
          <i style={{ width: `${Math.max(2, Math.round(c.meter * 100))}%` }} />
        </span>
      )}
      {c.detail && <small>{c.detail}</small>}
      {c.score !== null && <small className="tk-score">24-hour score {fmtScore(c.score)}</small>}
    </td>
  );
}

function Canary({ c }: { c: CanaryCell }) {
  return (
    <td className="tk-cell" data-label="Canary">
      <Pill tone={c.tone}>{c.state}</Pill>
      {c.detail && <small>{c.detail}</small>}
    </td>
  );
}

export function TrackerTable({ rows, caption }: { rows: TrackerRow[]; caption: string }) {
  if (!rows.length) return null;
  return (
    <div className="rd-table-wrap seo-table-wrap tk-wrap lp-up">
      <table className="rd-table seo-table tk-table">
        <caption className="seo-table-cap">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Model</th>
            {rows[0].cells.map((c) => <th key={c.suite} scope="col">{c.label}</th>)}
            <th scope="col">Canary, hourly</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.model.id} className={`is-${r.tone}`}>
              <th scope="row">
                <Link href={`/models/${r.model.slug}`}>{r.model.displayName}</Link>
                {/* All-clear rows say so in every cell; the row's own pill is kept for the rows that need a look. */}
                {r.tone !== 'ok' && <span className="tk-status"><Pill tone={r.tone}>{r.status}</Pill></span>}
                {r.routerNote && <small className="tk-router">{r.routerNote}</small>}
              </th>
              {r.cells.map((c) => <Suite key={c.suite} c={c} />)}
              <Canary c={r.canary} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
