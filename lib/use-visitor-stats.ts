'use client';

import { useEffect, useState } from 'react';

/**
 * Site visit counts from /visitors/stats, shared by the header and the footer.
 *
 * The header used to receive these as props, and only the home page passed them, so every other
 * page showed "… visits today" (and the model page passed the all-time total into the "today"
 * slot). One cached request per five minutes now serves every component on every page.
 */
export interface VisitorStats { total: number | null; today: number | null }

const EMPTY: VisitorStats = { total: null, today: null };
const TTL_MS = 5 * 60_000;
let cache: { at: number; promise: Promise<VisitorStats> } | null = null;

function load(): Promise<VisitorStats> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.promise;
  const base = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
  const promise = fetch(`${base}/visitors/stats`)
    .then((r) => r.json())
    .then((d): VisitorStats => ({
      total: typeof d?.totals?.visits === 'number' ? d.totals.visits : null,
      today: typeof d?.today?.visits === 'number' ? d.today.visits : null,
    }))
    .catch(() => { cache = null; return EMPTY; });
  cache = { at: Date.now(), promise };
  return promise;
}

export function useVisitorStats(): VisitorStats {
  const [stats, setStats] = useState<VisitorStats>(EMPTY);
  useEffect(() => {
    let live = true;
    load().then((s) => { if (live) setStats(s); });
    return () => { live = false; };
  }, []);
  return stats;
}
