'use client';

/**
 * One shared view of "which models am I tracking".
 *
 * The leaderboard renders 24 rows and every one needs to know its own tracked
 * state. Asking per row would be 24 requests for one answer, so the list is
 * fetched once here and shared. Toggles update optimistically and reconcile
 * against the server response, because a star that lags a click feels broken.
 *
 * Signed out this holds an empty set and never calls the API — the star still
 * renders, and clicking it routes to sign-up with the intent preserved.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

interface WatchlistState {
  ready: boolean;
  tracked: Set<string>;
  limit: number | null;
  used: number;
  /** Returns the reason it failed, or null on success. */
  toggle: (modelId: string | number) => Promise<string | null>;
  isTracked: (modelId: string | number) => boolean;
  refresh: () => void;
}

const Ctx = createContext<WatchlistState | null>(null);

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [tracked, setTracked] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState<number | null>(null);
  const [used, setUsed] = useState(0);
  const [ready, setReady] = useState(false);

  const load = useCallback(() => {
    if (status !== 'authenticated') { setReady(true); return; }
    fetch('/api/account/watchlist', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d?.success) {
          setTracked(new Set((d.data.models ?? []).map((m: any) => String(m.modelId))));
          setLimit(d.data.limit ?? null);
          setUsed(d.data.used ?? 0);
        }
      })
      .catch(() => { /* leave the set empty; stars render untracked */ })
      .finally(() => setReady(true));
  }, [status]);

  useEffect(() => {
    if (status === 'loading') return;
    setReady(false);
    load();
  }, [status, load]);

  const isTracked = useCallback((id: string | number) => tracked.has(String(id)), [tracked]);

  const toggle = useCallback(async (id: string | number): Promise<string | null> => {
    const key = String(id);
    const wasTracked = tracked.has(key);

    // Optimistic: flip immediately, roll back if the server disagrees.
    setTracked(prev => {
      const next = new Set(prev);
      wasTracked ? next.delete(key) : next.add(key);
      return next;
    });
    setUsed(u => (wasTracked ? Math.max(0, u - 1) : u + 1));

    try {
      const res = wasTracked
        ? await fetch(`/api/account/watchlist/${key}`, { method: 'DELETE' })
        : await fetch('/api/account/watchlist', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelId: Number(key) }),
          });
      const d = await res.json();
      if (d?.success) return null;

      setTracked(prev => {
        const next = new Set(prev);
        wasTracked ? next.add(key) : next.delete(key);
        return next;
      });
      setUsed(u => (wasTracked ? u + 1 : Math.max(0, u - 1)));
      return d?.message ?? d?.error ?? 'Could not update your watchlist';
    } catch {
      setTracked(prev => {
        const next = new Set(prev);
        wasTracked ? next.add(key) : next.delete(key);
        return next;
      });
      setUsed(u => (wasTracked ? u + 1 : Math.max(0, u - 1)));
      return 'Network error';
    }
  }, [tracked]);

  const value = useMemo<WatchlistState>(
    () => ({ ready, tracked, limit, used, toggle, isTracked, refresh: load }),
    [ready, tracked, limit, used, toggle, isTracked, load]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Safe outside the provider: returns a no-op state rather than throwing. */
export function useWatchlist(): WatchlistState {
  return useContext(Ctx) ?? {
    ready: false, tracked: new Set(), limit: null, used: 0,
    toggle: async () => 'Watchlist unavailable',
    isTracked: () => false,
    refresh: () => {},
  };
}
