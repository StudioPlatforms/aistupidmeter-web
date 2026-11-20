'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BOARD_KEYS, buildBoardWithHosted, withHostsSummaries, type BoardKey, type Boards, type HostsSummaries } from './boards-core';

export * from './boards-core';

const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
const REFRESH_MS = 5 * 60 * 1000;
const HOSTED_PERIODS = new Set(['latest', '24h', '7d', '1m']);

/**
 * M9 (Phase 3 plan §7.1, MD21): the boards' hosted rows, through the web's public proxy (≤ 60 s cache, no identity),
 * next to /dashboard/boards. Any failure, the kill switches and the staff phase all read as "no hosted rows": the
 * fleet boards never wait for, or break on, this fetch.
 */
export async function fetchHostedBoards(period: string): Promise<Record<string, unknown[]> | null> {
  if (!HOSTED_PERIODS.has(period)) return null;
  try {
    const r = await fetch(`/api/marketplace/boards/${period}`, { signal: AbortSignal.timeout(8_000) });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.success && j.data && typeof j.data === 'object' ? (j.data as Record<string, unknown[]>) : null;
  } catch {
    return null;
  }
}

/**
 * M16 (owner 2026-11-18): each leaderboard model's hosted providers combined, per board, through the same public proxy. The
 * API sends a board only while its comparable-fleet gate passes; any failure reads as "no summaries", and the fleet boards
 * never wait for this fetch.
 */
export async function fetchFleetHosts(period: string): Promise<HostsSummaries | null> {
  if (!HOSTED_PERIODS.has(period)) return null;
  try {
    const r = await fetch(`/api/marketplace/fleet-hosts/${period}`, { signal: AbortSignal.timeout(8_000) });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.success && j.data && typeof j.data === 'object' ? (j.data as HostsSummaries) : null;
  } catch {
    return null;
  }
}

export function useBoards(period: string, enabled = true) {
  const [fleet, setFleet] = useState<Record<string, any[]> | null>(null);
  const [hosted, setHosted] = useState<Record<string, unknown[]> | null>(null);
  const [summaries, setSummaries] = useState<HostsSummaries | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      const mine = ++seq.current;
      setLoading(true);
      // The hosted rows on their own: they arrive when they arrive and never hold up the fleet's boards.
      fetchHostedBoards(period).then((h) => { if (!cancelled && mine === seq.current) setHosted(h); });
      fetchFleetHosts(period).then((x) => { if (!cancelled && mine === seq.current) setSummaries(x); });
      try {
        const r = await fetch(`${API_BASE}/dashboard/boards?period=${encodeURIComponent(period)}`);
        const j = await r.json();
        if (cancelled || mine !== seq.current) return;
        if (!j?.success || !j.data) throw new Error('bad response');
        setFleet(j.data);
        setError(false);
      } catch {
        if (!cancelled && mine === seq.current) setError(true);
      } finally {
        if (!cancelled && mine === seq.current) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, [period, enabled]);

  const boards = useMemo(() => {
    if (!fleet) return null;
    const next = {} as Boards;
    for (const k of BOARD_KEYS) next[k] = buildBoardWithHosted(k, Array.isArray(fleet[k]) ? fleet[k] : [], hosted?.[k]);
    return withHostsSummaries(next, summaries);
  }, [fleet, hosted, summaries]);

  return { boards, loading, error };
}

/** A model's place on one board, in words: rank and score, or why it has none. */
export function standingOn(boards: Boards, k: BoardKey, id: string): { v: string; sub: string; ranked: boolean } {
  const r = boards[k].ranked.find((x) => x.id === id);
  if (r) return { v: r.rankText, sub: `score ${r.score}`, ranked: true };
  const c = boards[k].community.find((x) => x.id === id);
  if (c) return { v: '—', sub: k === 'combined' ? 'not ranked' : `${c.score} on ${c.when}`, ranked: false };
  // M9: a hosted row's place among the hosted rows only (it is not in the main ranking).
  const h = boards[k].hosted.find((x) => x.id === id);
  if (h) return { v: h.rank === null ? '—' : h.rankText, sub: h.score === null ? 'hosted · no score' : `hosted · score ${h.score}`, ranked: false };
  return { v: '—', sub: 'not ranked', ranked: false };
}

/** Width of an element, tracked. 0 until measured. */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** True when the viewport is at least `px` wide. False on the server and before mount. */
export function useMinWidth(px: number) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const on = () => setOk(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [px]);
  return ok;
}
