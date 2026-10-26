import Link from 'next/link';
import { BOARD_KEYS, BOARD_TITLE } from '@/lib/boards-core';
import { dayLabel } from '@/lib/seo';
import type { Placement } from '@/lib/seo-data';
import type { ModelWorse } from './worse-data';

/**
 * The live table of a "getting worse" page: one row per model on the 24-hour boards with its
 * four scores and places, its trend word, the state of its three Page-Hinkley detectors and the
 * day it was first tracked. Places come from lib/boards-core through placementOn (a "=" is the
 * leaderboard's statistical tie), never from the row index. A missing figure leaves its cell
 * empty. Server component on reading.css's ruled table; the wr-* rules are in styles/seo-worse.css.
 */

const fmtScore = (s: number): string => (Number.isInteger(s) ? String(s) : s.toFixed(1));

function Cell({ p }: { p: Placement }) {
  if (p.kind === 'absent' || p.score === null) return <td className="seo-num" />;
  const place = p.kind === 'ranked' && p.place !== null ? `${p.joint ? '=' : ''}${p.place} of ${p.rankedCount}` : 'not ranked';
  return (
    <td className="seo-num">
      {fmtScore(p.score)}
      <small>{place}</small>
    </td>
  );
}

export function WorseTable({ models, caption }: { models: ModelWorse[]; caption: string }) {
  const rows = models.filter((m) => m.onBoard && m.placements);
  if (!rows.length) return null;
  const anySince = rows.some((m) => !!m.model.createdAt);
  return (
    <div className="rd-table-wrap seo-table-wrap wr-wrap lp-up">
      <table className="rd-table seo-table wr-table">
        <caption className="seo-table-cap">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Model</th>
            {BOARD_KEYS.map((k) => <th key={k} scope="col" className="seo-num">{BOARD_TITLE[k]}</th>)}
            <th scope="col">Trend</th>
            <th scope="col">Drift detectors</th>
            {anySince && <th scope="col">Tracked since</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.model.id}>
              <th scope="row"><Link href={`/models/${m.model.slug}`}>{m.model.displayName}</Link></th>
              {BOARD_KEYS.map((k) => <Cell key={k} p={m.placements![k]} />)}
              <td className="wr-trend">{m.trend ?? ''}</td>
              <td>
                <ul className="wr-det">
                  {m.detectors.map((d) => (
                    <li key={d.suite} className={d.kind}><span>{d.label}</span> {d.text}</li>
                  ))}
                </ul>
              </td>
              {anySince && <td className="wr-since">{m.model.createdAt ? dayLabel(m.model.createdAt) : ''}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
