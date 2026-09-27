'use client';

import { useEffect, useRef, useState } from 'react';
import { slugifyModelName } from './model-slug';

/**
 * The four leaderboards for the layouts that show them together.
 *
 * Data: GET /dashboard/boards — every board read from the same cache entry the single-board
 * view uses, so the numbers here are the numbers everywhere else.
 *
 * Each board is split into three groups, because "not ranked" has two very different causes
 * and a visitor should be told which:
 *   ranked     — measured on this board and ranked, with statistical ties
 *   community  — this board's suite is community-funded for the model (we stopped paying for
 *                it); shown with its last funded run, never ranked against measured models.
 *                On Combined that is any community-funded suite: its combined score is
 *                coding only.
 *   other      — not ranked for any other reason (stale, too few suites); the API's
 *                staleReason says why.
 */

export type BoardKey = 'combined' | 'coding' | 'reasoning' | 'tooling';
export const BOARD_KEYS: BoardKey[] = ['combined', 'coding', 'reasoning', 'tooling'];
export const BOARD_TITLE: Record<BoardKey, string> = {
  combined: 'Combined', coding: 'Coding', reasoning: 'Reasoning', tooling: 'Tool use',
};
/** How often each board is re-measured, for the one-line meta under its title. */
export const BOARD_CADENCE: Record<BoardKey, string> = {
  combined: 'All three suites', coding: 'Tested every 4 hours',
  reasoning: 'Tested daily', tooling: 'Tested daily',
};
const BOARD_SUITE: Record<BoardKey, string | null> = { combined: null, coding: 'hourly', reasoning: 'deep', tooling: 'tooling' };

/** The dashboard's sort keys, which the table layout shares with the rest of the page. */
export type SortKey = 'combined' | 'reasoning' | 'speed' | 'tooling' | 'price';
export const SORT_TO_BOARD: Record<Exclude<SortKey, 'price'>, BoardKey> = {
  combined: 'combined', speed: 'coding', reasoning: 'reasoning', tooling: 'tooling',
};
export const BOARD_TO_SORT: Record<BoardKey, SortKey> = {
  combined: 'combined', coding: 'speed', reasoning: 'reasoning', tooling: 'tooling',
};

export interface BoardRow {
  id: string;
  name: string;
  displayName: string | null;
  provider: string | null;
  currentScore: number | string | null;
  standardError: number | null;
  rankable: boolean;
  coverage: string | null;
  staleReason: string | null;
  isStale: boolean;
  trend: string;
  lastUpdated: string | null;
  suiteUpdatedAt: Record<string, string> | null;
  community: string[];
  // derived
  label: string;
  /** Provider as people write it: OpenAI, DeepSeek, GLM. */
  vendor: string;
  slug: string;
  score: number | null;
  rank: number | null;
  rankText: string;
  /** Rank 1-3, drawn as a pill. */
  top: boolean;
  /** Short coverage note ("5/7 tasks"), amber, with the full sentence as its title. */
  note: string | null;
  /** For an unranked row: the date of the measurement shown ("24 Sep") or "coding only". */
  when: string | null;
}

export interface Board {
  key: BoardKey;
  title: string;
  ranked: BoardRow[];
  community: BoardRow[];
  other: BoardRow[];
  /** How many models share first place. */
  tiedForFirst: number;
}

export type Boards = Record<BoardKey, Board>;

/**
 * Statistical tie ranks — the rule the single-board view has always used
 * (components/v4/V4Leaderboard.tsx), unchanged: standard competition numbering, and a row
 * joins the group above it when it is not measurably worse than that group's leader
 * (gap ≤ 1.96 × combined standard error). A row graded on fewer tasks than the rest keeps
 * its position and never joins or anchors a tie.
 */
export function statisticalRanks(rows: any[], statisticalTies = true): Map<string, number> {
  const hasSE = (m: any) => m.rankable !== false && typeof m.standardError === 'number' && typeof m.currentScore === 'number';
  const better = (o: any, m: any) =>
    o.currentScore - m.currentScore > 1.96 * Math.sqrt(o.standardError * o.standardError + m.standardError * m.standardError);
  const ranks = new Map<string, number>();
  let leader: any = null;
  let leaderRank = 1;
  let position = 0;
  for (const m of rows) {
    if (!hasSE(m)) continue;
    position++;
    if (!statisticalTies || m.coverage) { ranks.set(String(m.id), position); continue; }
    if (leader === null || better(leader, m)) { leader = m; leaderRank = position; }
    ranks.set(String(m.id), leaderRank);
  }
  return ranks;
}

function shortCoverage(note: string | null): string | null {
  if (!note) return null;
  const tasks = /^(\d+) of (\d+) (?:coding |reasoning |tool )?tasks/.exec(note);
  if (tasks) return `${tasks[1]}/${tasks[2]} tasks`;
  const suites = /^(\d+) of (\d+) suites/.exec(note);
  if (suites) return `${suites[1]}/${suites[2]} suites`;
  return null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "24 Sep". Built by hand: en-GB now writes "Sept" in some runtimes and not others. */
function dayLabel(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

const VENDOR: Record<string, string> = {
  openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', deepseek: 'DeepSeek',
  glm: 'GLM', kimi: 'Kimi', xai: 'xAI', 'x.ai': 'xAI',
};
const vendorName = (p: string | null) => {
  const k = (p || '').toLowerCase();
  return VENDOR[k] ?? (k ? k[0].toUpperCase() + k.slice(1) : '');
};

function buildBoard(key: BoardKey, raw: any[]): Board {
  const suite = BOARD_SUITE[key];
  const ranks = statisticalRanks(raw, true);
  const counts = new Map<number, number>();
  ranks.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));

  const board: Board = { key, title: BOARD_TITLE[key], ranked: [], community: [], other: [], tiedForFirst: counts.get(1) ?? 0 };
  let position = 0;
  for (const m of raw) {
    const score = typeof m.currentScore === 'number' ? m.currentScore : null;
    const community: string[] = Array.isArray(m.community) ? m.community : [];
    const isCommunity = key === 'combined' ? community.length > 0 : !!suite && community.includes(suite);
    const base = {
      ...m,
      community,
      label: m.displayName || m.name,
      vendor: vendorName(m.provider),
      slug: slugifyModelName(m.name) || String(m.id),
      score,
      note: null as string | null,
      when: null as string | null,
      rank: null as number | null,
      rankText: '–',
      top: false,
    } as BoardRow;

    if (m.rankable !== false && score !== null) {
      position++;
      const r = ranks.get(String(m.id)) ?? position;
      const tied = (counts.get(r) ?? 0) > 1;
      board.ranked.push({ ...base, rank: r, rankText: `${tied ? '=' : ''}${r}`, top: r <= 3, note: shortCoverage(m.coverage) });
    } else if (isCommunity && score !== null) {
      const ts = key === 'combined' ? null : (suite && m.suiteUpdatedAt?.[suite]) || m.lastUpdated;
      board.community.push({ ...base, when: key === 'combined' ? 'coding only' : dayLabel(ts) });
    } else {
      board.other.push({ ...base, when: score === null ? 'no data' : 'not ranked' });
    }
  }
  return board;
}

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
  if (c) return { v: '—', sub: k === 'combined' ? 'coding only' : `${c.score} on ${c.when}`, ranked: false };
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
