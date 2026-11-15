'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { buildHostedGroup, type BoardKey, type BoardRow } from '@/lib/boards-core';

/**
 * /leaderboard's hosted rows (Phase 3 plan §7.1 "Where hosted rows render", MD21, rev: S13; M9): fetched in the browser
 * through the web's public proxy (/api/marketplace/boards/24h, ≤ 60 s), never by the server, so the page keeps its
 * `revalidate = 900` and its server-rendered top 10 is the fleet's alone. Nothing renders while there is no hosted row
 * (marketplace.boards off, the staff phase, a failed fetch): the page is then exactly what the server sent.
 * One fetch for the page's four boards.
 */

let shared: Promise<Record<string, unknown[]> | null> | null = null;
function hostedOnce(): Promise<Record<string, unknown[]> | null> {
  if (!shared) {
    shared = fetch('/api/marketplace/boards/24h')
      .then(r => (r.ok ? r.json() : null))
      .then(j => (j && j.success && j.data && typeof j.data === 'object' ? (j.data as Record<string, unknown[]>) : null))
      .catch(() => null);
  }
  return shared;
}

export default function LeaderboardHosted({ board }: { board: BoardKey }) {
  const [rows, setRows] = useState<BoardRow[]>([]);
  useEffect(() => {
    let live = true;
    hostedOnce().then(d => { if (live) setRows(buildHostedGroup(board, Array.isArray(d?.[board]) ? (d?.[board] as unknown[]) : [])); });
    return () => { live = false; };
  }, [board]);
  if (!rows.length) return null;
  return (
    <div className="rd-table-wrap seo-table-wrap lp-hosted">
      <table className="rd-table seo-table">
        <caption className="seo-table-cap">Hosted by independent providers: measured with our tests through each host&apos;s own API, ranked among themselves</caption>
        <thead>
          <tr>
            <th scope="col" className="seo-num seo-place">Place</th>
            <th scope="col">Model</th>
            <th scope="col">Host</th>
            <th scope="col" className="seo-num">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className={r.paused ? 'is-paused' : undefined}>
              <td className="seo-num seo-place">{r.rank === null ? <span className="seo-unranked">{r.paused ? 'paused' : 'not ranked'}</span> : r.rankText}</td>
              <td><Link href={r.href ?? '#'} title={r.label} aria-label={r.label} className="lp-hosted-name">{r.label.split(' — hosted by ')[0]}</Link></td>
              <td>{r.vendor}</td>
              <td className="seo-num">{r.score === null ? '—' : <>{r.score}{typeof r.standardError === 'number' && <span className="seo-se"> ± {r.standardError.toFixed(1)}</span>}</>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="seo-table-note">
        A hosted model joins the ranking above once it meets the published criteria. Each day&apos;s mean is published one to two days after the day ends.{' '}
        <Link href="/inference-providers/ranking-criteria#order">How hosts are ordered</Link> · <Link href="/inference-providers/ranking-criteria#join">How hosted models join</Link>
      </p>
    </div>
  );
}
