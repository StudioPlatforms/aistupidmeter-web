import { slugifyModelName } from './model-slug';
import { statisticalRanks } from './board-ranks';
import { mergeHosted, type HostedFields } from './board-merge';

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
 *   hosted     — M9 (Phase 3 plan §7.1): models served by independent inference providers, measured with
 *                our tests through each host's own API (GET /api/marketplace/boards/<period>, merged by
 *                lib/board-merge.ts). Ranked among themselves; they join the ranked group only under the
 *                published criteria, which no row meets in Phase 3. Never called "community".
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
  /** M9: a hosted row's host, open model, entry page, and whether it joined the main ranking or is paused (§7.1). */
  host?: HostedFields['host'];
  openModel?: HostedFields['openModel'];
  href?: string;
  joined?: boolean;
  paused?: boolean;
  /** M16: a leaderboard model's hosts on this board, combined (GET /api/marketplace/fleet-hosts/<period>); absent when none. */
  hostsSummary?: HostsSummary;
}

/** M16: one host under a leaderboard model's row: the hosted group's own row (its listing page and whole-point score; no SE). */
export interface HostsSummaryRow {
  provider: { slug: string; displayName: string };
  /** "DeepSeek V4 Pro (FP8) — hosted by Together AI", as on the hosted rows. */
  label: string;
  entrySlug: string;
  score: number;
  href: string;
}
/** M16: "3 hosts · best 71 · median 68": distinct hosts, the highest score, the median of the rows' scores. */
export interface HostsSummary { hosts: number; best: number; median: number; rows: HostsSummaryRow[] }
/** Per board, keyed by the leaderboard model's id; the API sends a board only while its comparable-fleet gate passes. */
export type HostsSummaries = Partial<Record<BoardKey, Record<string, unknown>>>;

export interface Board {
  key: BoardKey;
  title: string;
  ranked: BoardRow[];
  community: BoardRow[];
  other: BoardRow[];
  /** M9: models hosted by independent providers, ranked among themselves (empty while none is shown). */
  hosted: BoardRow[];
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

  const board: Board = { key, title: BOARD_TITLE[key], ranked: [], community: [], other: [], hosted: [], tiedForFirst: counts.get(1) ?? 0 };
  let position = 0;
  for (const m of raw) {
    const score = typeof m.currentScore === 'number' ? m.currentScore : null;
    const community: string[] = Array.isArray(m.community) ? m.community : [];
    const isCommunity = key === 'combined' ? community.length > 0 : !!suite && community.includes(suite);
    const base = {
      ...m,
      community,
      label: m.displayName || m.name,
      vendor: m.host && typeof m.host.name === 'string' ? m.host.name : vendorName(m.provider),
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

/**
 * The hosted group of one board (§7.1): the API's order (score, the statistical tie broken by price, then the name),
 * ranked among themselves with the board's statisticalRanks. Paused, under-review and not-yet-rankable rows keep their
 * place after the ranked ones with rank "–" (paused ones greyed).
 */
export function buildHostedGroup(key: BoardKey, raw: any[]): BoardRow[] {
  const rankable = raw.filter((m) => m.rankable !== false && m.paused !== true && typeof m.currentScore === 'number');
  const ranks = statisticalRanks(rankable, true);
  const counts = new Map<number, number>();
  ranks.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
  let position = 0;
  return raw.map((m) => {
    const score = typeof m.currentScore === 'number' ? m.currentScore : null;
    const base = {
      ...m,
      community: [],
      label: m.displayName || m.name,
      vendor: m.host && typeof m.host.name === 'string' ? m.host.name : vendorName(m.provider),
      slug: slugifyModelName(m.name) || String(m.id),
      score,
      note: null as string | null,
      when: null as string | null,
      rank: null as number | null,
      rankText: '–',
      top: false,
    } as BoardRow;
    if (rankable.includes(m)) {
      position++;
      const r = ranks.get(String(m.id)) ?? position;
      const tied = (counts.get(r) ?? 0) > 1;
      return { ...base, rank: r, rankText: `${tied ? '=' : ''}${r}`, note: shortCoverage(m.coverage) };
    }
    return { ...base, when: m.paused ? 'paused' : score === null ? 'no data' : 'not ranked' };
  });
}

/** One board with its hosted rows (M9): joined rows merged into the fleet's order, the others as the hosted group. */
export function buildBoardWithHosted(key: BoardKey, rawFleet: any[], rawHosted: unknown): Board {
  const m = mergeHosted(rawFleet, rawHosted);
  const board = buildBoard(key, m.fleet);
  board.hosted = buildHostedGroup(key, m.hosted);
  return board;
}

/** All four boards from a /dashboard/boards payload (and, M9, the boards' hosted rows). */
export function buildBoards(data: Record<string, any[]>, hosted?: Record<string, unknown> | null): Boards {
  const out = {} as Boards;
  for (const k of BOARD_KEYS) out[k] = buildBoardWithHosted(k, Array.isArray(data?.[k]) ? data[k] : [], hosted?.[k]);
  return out;
}

// ── M16 (owner 2026-11-18): a leaderboard model's hosted providers, combined ────────────────────────────────

const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const str = (x: unknown): x is string => typeof x === 'string' && x.length > 0;

/** One summary from the API, or null when anything in it is off (then nothing renders for that row). */
export function parseHostsSummary(raw: unknown): HostsSummary | null {
  const x = raw as Record<string, any> | null;
  if (!x || typeof x !== 'object' || !num(x.hosts) || x.hosts < 1 || !num(x.best) || !num(x.median) || !Array.isArray(x.rows) || !x.rows.length) return null;
  const rows: HostsSummaryRow[] = [];
  for (const r of x.rows as Array<Record<string, any>>) {
    if (!r || typeof r !== 'object' || !r.provider || !str(r.provider.slug) || !str(r.provider.displayName) || !str(r.label) || !str(r.entrySlug)
      || !num(r.score) || !str(r.href) || !r.href.startsWith('/inference-providers/')) return null;
    rows.push({ provider: { slug: r.provider.slug, displayName: r.provider.displayName }, label: r.label, entrySlug: r.entrySlug, score: r.score, href: r.href });
  }
  return { hosts: x.hosts, best: x.best, median: x.median, rows };
}

/** Each fleet row's summary on its own board (a hosted row never gets one). The boards come back unchanged when there is none. */
export function withHostsSummaries(boards: Boards, raw: HostsSummaries | null | undefined): Boards {
  if (!raw) return boards;
  let out: Boards | null = null;
  for (const k of BOARD_KEYS) {
    const map = raw[k];
    if (!map || typeof map !== 'object' || !Object.keys(map).length) continue;
    const add = (r: BoardRow): BoardRow => {
      if (r.host) return r;
      const s = parseHostsSummary((map as Record<string, unknown>)[r.id]);
      return s ? { ...r, hostsSummary: s } : r;
    };
    const b = boards[k];
    out = out ?? { ...boards };
    out[k] = { ...b, ranked: b.ranked.map(add), community: b.community.map(add), other: b.other.map(add) };
  }
  return out ?? boards;
}

/** "3 hosts · best 71 · median 68"; one row: "1 host · score 71". */
export function hostsSummaryText(s: HostsSummary): string {
  const hosts = `${s.hosts} host${s.hosts === 1 ? '' : 's'}`;
  return s.rows.length === 1 ? `${hosts} · score ${s.best}` : `${hosts} · best ${s.best} · median ${s.median}`;
}

/** A host row's model part ("DeepSeek V4 Pro (FP8)") and its precision when the label names one ("FP8"). */
export function hostModelPart(label: string): string {
  return label.split(' — hosted by ')[0];
}
export function hostPrecision(label: string): string | null {
  const m = /\(([^()]+)\)$/.exec(hostModelPart(label));
  return m ? m[1] : null;
}

/** A model's summary on `prefer` when it has one, else on the first board that has one (with that board's key). */
export function hostsSummaryOn(boards: Boards, id: string, prefer: BoardKey): { board: BoardKey; summary: HostsSummary } | null {
  for (const k of [prefer, ...BOARD_KEYS.filter((x) => x !== prefer)]) {
    const b = boards[k];
    const r = b.ranked.find((x) => x.id === id) ?? b.community.find((x) => x.id === id) ?? b.other.find((x) => x.id === id);
    if (r?.hostsSummary) return { board: k, summary: r.hostsSummary };
  }
  return null;
}

/** A model's place on one board: ranked (with its rank among the ranked), community-funded, or neither. */
export type Standing =
  | { kind: 'ranked'; row: BoardRow; rankedCount: number; tied: boolean }
  | { kind: 'hosted'; row: BoardRow }
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
  const h = board.hosted.find((x) => x.id === id);
  if (h) return { kind: 'hosted', row: h };
  return { kind: 'absent' };
}

