import Link from 'next/link';

/**
 * The value and speed pages' table: the near-top candidates in the page's order, with their
 * Coding score and place on the 24-hour board, pass rate, cost per 1,000 correct answers and
 * median response time over the price window. No place column: the order is the page's metric,
 * and the board place sits beside the score so the reader can see every row is near the top.
 * Server component on reading.css's ruled table and seo.css's number cells.
 */
export interface PriceTableRow {
  name: string;
  slug: string;
  /** As people write it: OpenAI, DeepSeek, Moonshot AI. */
  vendor: string;
  /** "98 (1st)"; null in the pass-rate fallback, which drops the column. */
  score: string | null;
  passRate: string;
  cost: string | null;
  median: string | null;
}

export function PriceTable({ rows, caption, days, highlight }: { rows: PriceTableRow[]; caption: string; days: number; highlight: 'cost' | 'median' }) {
  if (!rows.length) return null;
  const showScore = rows.some((r) => r.score !== null);
  const showCost = rows.some((r) => r.cost !== null);
  const showMedian = rows.some((r) => r.median !== null);
  const hl = (k: 'cost' | 'median') => (k === highlight ? 'seo-num bp-hl' : 'seo-num');
  return (
    <div className="rd-table-wrap seo-table-wrap lp-up">
      <table className="rd-table seo-table bp-table">
        <caption className="seo-table-cap">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Model</th>
            <th scope="col">Vendor</th>
            {showScore && <th scope="col" className="seo-num">Coding score (24 h)</th>}
            <th scope="col" className="seo-num">Pass rate ({days} days)</th>
            {showCost && <th scope="col" className={hl('cost')}>Cost per 1,000 correct answers</th>}
            {showMedian && <th scope="col" className={hl('median')}>Median response</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.slug}>
              <th scope="row"><Link href={`/models/${r.slug}`}>{r.name}</Link></th>
              <td>{r.vendor}</td>
              {showScore && <td className="seo-num">{r.score ?? ''}</td>}
              <td className="seo-num">{r.passRate}</td>
              {showCost && <td className={hl('cost')}>{r.cost ?? ''}</td>}
              {showMedian && <td className={hl('median')}>{r.median ?? ''}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
