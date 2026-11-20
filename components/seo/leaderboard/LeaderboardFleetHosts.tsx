'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { hostModelPart, hostsSummaryText, parseHostsSummary, type BoardKey, type HostsSummaries, type HostsSummary } from '@/lib/boards-core';

/**
 * M16 (owner 2026-11-18): under a board's table on /leaderboard, the models shown there that independent providers host too,
 * combined ("3 hosts · best 71 · median 68"), each a button that opens one row per host (its listing page and its score).
 * Fetched in the browser through the web's public proxy (/api/marketplace/fleet-hosts/24h, ≤ 60 s), never by the server,
 * so the page keeps its `revalidate = 900`. The API sends a board only while its comparable-fleet gate passes, and nothing
 * renders without a summary: the page is then exactly what the server sent. One fetch for the page's four boards.
 */

let shared: Promise<HostsSummaries | null> | null = null;
function summariesOnce(): Promise<HostsSummaries | null> {
  if (!shared) {
    shared = fetch('/api/marketplace/fleet-hosts/24h')
      .then(r => (r.ok ? r.json() : null))
      .then(j => (j && j.success && j.data && typeof j.data === 'object' ? (j.data as HostsSummaries) : null))
      .catch(() => null);
  }
  return shared;
}

export default function LeaderboardFleetHosts({ board, models }: { board: BoardKey; models: Array<{ id: string; name: string }> }) {
  const [items, setItems] = useState<Array<{ id: string; name: string; s: HostsSummary }>>([]);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const ids = models.map(m => m.id).join(',');
  useEffect(() => {
    let live = true;
    summariesOnce().then(d => {
      if (!live) return;
      const map = d?.[board];
      setItems(map && typeof map === 'object'
        ? models.flatMap(m => { const s = parseHostsSummary((map as Record<string, unknown>)[m.id]); return s ? [{ id: m.id, name: m.name, s }] : []; })
        : []);
    });
    return () => { live = false; };
    // `ids` stands for `models` (a new array from the server on every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, ids]);
  if (!items.length) return null;
  const toggle = (id: string) => setOpen(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return (
    <div className="lp-fleet-hosts">
      <p className="lp-fleet-hosts-t">Also served by independent hosts, measured with our tests through each host&apos;s own API:</p>
      <ul className="lp-fleet-hosts-list">
        {items.map(({ id, name, s }) => {
          const listId = `lp-fh-${board}-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
          const isOpen = open.has(id);
          return (
            <li key={id}>
              <div className="lp-fleet-hosts-head">
                <span className="lp-fleet-hosts-model">{name}</span>
                <button type="button" className="lp-fleet-hosts-chip" aria-expanded={isOpen} aria-controls={listId} onClick={() => toggle(id)}>
                  <span>{hostsSummaryText(s)}</span>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </div>
              {isOpen && (
                <ul id={listId} className="lp-fleet-hosts-rows" aria-label={`Hosts of ${name}`}>
                  {s.rows.map(r => (
                    <li key={r.href}>
                      <Link href={r.href} title={r.label}>{r.provider.displayName}</Link>
                      <span className="lp-fleet-hosts-as">{hostModelPart(r.label)}</span>
                      <span className="lp-fleet-hosts-score">{r.score}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
