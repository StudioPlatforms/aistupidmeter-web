'use client';

import { useEffect, useRef, useState } from 'react';
import { BOARD_KEYS, buildBoard, type BoardKey, type Boards } from './boards-core';

export * from './boards-core';

const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
const REFRESH_MS = 5 * 60 * 1000;

export function useBoards(period: string, enabled = true) {
  const [boards, setBoards] = useState<Boards | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      const mine = ++seq.current;
      setLoading(true);
      try {
        const r = await fetch(`${API_BASE}/dashboard/boards?period=${encodeURIComponent(period)}`);
        const j = await r.json();
        if (cancelled || mine !== seq.current) return;
        if (!j?.success || !j.data) throw new Error('bad response');
        const next = {} as Boards;
        for (const k of BOARD_KEYS) next[k] = buildBoard(k, Array.isArray(j.data[k]) ? j.data[k] : []);
        setBoards(next);
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

  return { boards, loading, error };
}

/** A model's place on one board, in words: rank and score, or why it has none. */
export function standingOn(boards: Boards, k: BoardKey, id: string): { v: string; sub: string; ranked: boolean } {
  const r = boards[k].ranked.find((x) => x.id === id);
  if (r) return { v: r.rankText, sub: `score ${r.score}`, ranked: true };
  const c = boards[k].community.find((x) => x.id === id);
  if (c) return { v: '—', sub: k === 'combined' ? 'not ranked' : `${c.score} on ${c.when}`, ranked: false };
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
