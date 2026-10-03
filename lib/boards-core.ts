import { slugifyModelName } from './model-slug';
import { statisticalRanks } from './board-ranks';

export { statisticalRanks };

/**
 * The four leaderboards: building, ranking and grouping them. No React here, so the model
 * pages' server-rendered text can use exactly what the leaderboards use (lib/use-boards.ts holds
 * the browser hooks).
 *
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
 *                On Combined that is any community-funded suite: without our reasoning and
 *                tool-use runs there is no complete combined score, so it is "not ranked"
 *                (never "coding only", which read as if only coding were community-funded).
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
  /** For an unranked row: the date of the measurement shown ("24 Sep") or "not ranked" (Combined). */
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

export function buildBoard(key: BoardKey, raw: any[]): Board {
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
      board.community.push({ ...base, when: key === 'combined' ? 'not ranked' : dayLabel(ts) });
    } else {
      board.other.push({ ...base, when: score === null ? 'no data' : 'not ranked' });
    }
  }
  return board;
}

/** All four boards from a /dashboard/boards payload. */
export function buildBoards(data: Record<string, any[]>): Boards {
  const out = {} as Boards;
  for (const k of BOARD_KEYS) out[k] = buildBoard(k, Array.isArray(data?.[k]) ? data[k] : []);
  return out;
}

/** A model's place on one board: ranked (with its rank among the ranked), community-funded, or neither. */
export type Standing =
  | { kind: 'ranked'; row: BoardRow; rankedCount: number; tied: boolean }
  | { kind: 'community'; row: BoardRow }
  | { kind: 'other'; row: BoardRow }
  | { kind: 'absent' };

export function standingOnBoard(board: Board, id: string): Standing {
  const r = board.ranked.find((x) => x.id === id);
  if (r) return { kind: 'ranked', row: r, rankedCount: board.ranked.length, tied: r.rankText.startsWith('=') };
  const c = board.community.find((x) => x.id === id);
  if (c) return { kind: 'community', row: c };
  const o = board.other.find((x) => x.id === id);
  if (o) return { kind: 'other', row: o };
  return { kind: 'absent' };
}

