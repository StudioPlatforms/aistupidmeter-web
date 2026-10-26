import type { ReactNode } from 'react';

/**
 * The pair page's "At a glance" table: one row per measure, one column per model. Rows are given
 * by the page, which omits any measure either model lacks (no placeholder cells). Server
 * component on reading.css's ruled table; the sp-* rules in styles/seo-pair.css let the header
 * wrap and stack the figure over its note on phones.
 */
export interface GlanceCell { main: ReactNode; sub?: ReactNode | null }
export interface GlanceRow { label: string; note?: string | null; a: GlanceCell; b: GlanceCell }

function Cell({ c }: { c: GlanceCell }) {
  return (
    <td>
      <b>{c.main}</b>
      {c.sub ? <small>{c.sub}</small> : null}
    </td>
  );
}

export function Glance({ a, b, rows, caption }: { a: string; b: string; rows: GlanceRow[]; caption: string }) {
  if (!rows.length) return null;
  return (
    <div className="rd-table-wrap sp-glance-wrap lp-up">
      <table className="rd-table sp-glance">
        <caption className="seo-table-cap">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">{a}</th>
            <th scope="col">{b}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">
                {r.label}
                {r.note ? <small>{r.note}</small> : null}
              </th>
              <Cell c={r.a} />
              <Cell c={r.b} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
