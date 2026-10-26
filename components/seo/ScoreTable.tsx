import Link from 'next/link';
import { trendWord } from '@/lib/seo-data';

/**
 * The SEO pages' score table: place (with "=" for a statistical tie), model (linked), vendor,
 * score ± standard error, then any extra columns the page adds. Server component; the look is
 * reading.css's ruled table plus the few rules in styles/seo.css. Rows are rendered in the order
 * given, which is board order; places come from lib/boards-core, never from the row index.
 */
export interface ScoreTableRow {
  name: string;
  slug: string;
  /** As people write it: OpenAI, DeepSeek, Moonshot AI. */
  vendor: string;
  score: number | null;
  se: number | null;
  /** 1-based place among the ranked rows; null when not ranked. */
  place: number | null;
  joint: boolean;
  /** "up" | "down" | "stable"; a Trend column appears when any row has one. */
  trend?: string | null;
  status?: string | null;
  /** Extra columns, keyed by their heading; the key order of the first row that has them wins. */
  extra?: Record<string, string>;
}

function formatScore(score: number | null, se: number | null) {
  if (score === null) return null;
  const s = Number.isInteger(score) ? String(score) : score.toFixed(1);
  if (se === null || !Number.isFinite(se)) return <>{s}</>;
  return <>{s} <span className="seo-se">± {se.toFixed(1)}</span></>;
}

export function ScoreTable({ rows, caption, showVendor = true }: { rows: ScoreTableRow[]; caption: string; showVendor?: boolean }) {
  const extraKeys: string[] = [];
  for (const r of rows) for (const k of Object.keys(r.extra ?? {})) if (!extraKeys.includes(k)) extraKeys.push(k);
  const hasTrend = rows.some((r) => !!r.trend);
  if (!rows.length) return null;
  return (
    <div className="rd-table-wrap seo-table-wrap lp-up">
      <table className="rd-table seo-table">
        <caption className="seo-table-cap">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="seo-num seo-place">Place</th>
            <th scope="col">Model</th>
            {showVendor && <th scope="col">Vendor</th>}
            <th scope="col" className="seo-num">Score</th>
            {hasTrend && <th scope="col">Trend</th>}
            {extraKeys.map((k) => <th key={k} scope="col" className="seo-num">{k}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.slug}>
              <td className="seo-num seo-place">
                {r.place === null
                  ? <span className="seo-unranked">not ranked</span>
                  : <>{r.joint && <span className="seo-joint" title="Statistical tie">=</span>}{r.place}</>}
              </td>
              <th scope="row"><Link href={`/models/${r.slug}`}>{r.name}</Link></th>
              {showVendor && <td>{r.vendor}</td>}
              <td className="seo-num">{formatScore(r.score, r.se)}</td>
              {hasTrend && <td>{r.trend ? trendWord(r.trend) : ''}</td>}
              {extraKeys.map((k) => <td key={k} className="seo-num">{r.extra?.[k] ?? ''}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
