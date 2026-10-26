import type { ReactNode } from 'react';

/**
 * A data table on reading.css's sheet (.rd-table-wrap scrolls sideways on a phone). The first
 * cell of each row is a row header; numeric columns are right-aligned with tabular figures.
 * Rows are rendered as given; nothing here ranks anything.
 */
export interface ResearchColumn {
  label: ReactNode;
  num?: boolean;
}

export function ResearchTable({ caption, columns, rows, narrow = true }: {
  caption?: ReactNode;
  columns: ResearchColumn[];
  rows: ReactNode[][];
  narrow?: boolean;
}) {
  if (!rows.length) return null;
  return (
    <div className={`rd-table-wrap lp-up${narrow ? ' is-narrow' : ''}`}>
      <table className="rd-table rs-table">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c, i) => <th key={i} scope="col" className={c.num ? 'num' : undefined}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (j === 0
                ? <th key={j} scope="row">{cell}</th>
                : <td key={j} className={columns[j]?.num ? 'num' : undefined}>{cell}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
