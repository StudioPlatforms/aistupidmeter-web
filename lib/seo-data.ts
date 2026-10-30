import { BOARD_KEYS, BOARD_TITLE, buildBoards, standingOnBoard, type BoardKey, type BoardRow, type Boards } from './boards-core';
import { modelSlug, resolveModelParam } from './model-slug';
import { getBlendedCostPer1M, getModelPricing } from './model-pricing';
import { getPriceSnapshot } from '@/components/landing/data';
import { compactHealth, type HourBucket, type PriceCodingRow, type PriceSnapshot, type PriceTaskRow } from '@/components/landing/types';

/**
 * Server-side data for the SEO pages: the roster, the 24-hour boards with the leaderboard's own
 * statistical ranks, the price snapshot, provider health, drift signatures, the vendor table and
 * the pair/related-model rules. Every fetch goes straight to the API on loopback (a relative URL
 * has no origin in a server component: the bug that broke the share card for eleven months),
 * sets next.revalidate so the page can stay ISR, and swallows every error into null, which the
 * pages render honestly (prose stays, table goes).
 *
 * Only the free periods are ever requested (24h); the newest run is paid and is never fetched here.
 */

export const API_INTERNAL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

async function getJson<T>(path: string, revalidate: number, timeoutMs = 8000): Promise<T | null> {
  try {
    const res = await fetch(`${API_INTERNAL}${path}`, { next: { revalidate }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* ───────────────────────── vendors ───────────────────────── */

export type VendorKey = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'kimi' | 'glm';

export interface Vendor {
  key: VendorKey;
  /** The company, as written in copy: "Moonshot AI (Kimi)" on first mention is `${label} (${family})`. */
  label: string;
  /** The product family: GPT, Claude, Gemini, DeepSeek, Kimi, GLM. */
  family: string;
  /** URL segment of /models/<slug> and /status/<slug>; equals the key. */
  slug: string;
  /** The API host the benchmark adapters call (apps/api/src/llm/adapters.ts). */
  apiHost: string;
  /** The vendor's own status page; null where none was verified. */
  officialStatusUrl: string | null;
  /** The consumer app people ask about, and why it is not what we probe. */
  consumerName: string;
  consumerNote: string;
  modelsPath: string;
  statusPath: string;
  /** The "is X getting worse" page for this family; null where there is none. */
  worsePath: string | null;
}

export const VENDORS: Vendor[] = [
  {
    key: 'openai', label: 'OpenAI', family: 'GPT', slug: 'openai', apiHost: 'api.openai.com',
    officialStatusUrl: 'https://status.openai.com', consumerName: 'ChatGPT',
    consumerNote: 'ChatGPT is not the OpenAI API: we probe the API, which is what applications and the Smart Router call.',
    modelsPath: '/models/openai', statusPath: '/status/openai', worsePath: '/is-chatgpt-getting-worse',
  },
  {
    key: 'anthropic', label: 'Anthropic', family: 'Claude', slug: 'anthropic', apiHost: 'api.anthropic.com',
    officialStatusUrl: 'https://status.claude.com', consumerName: 'Claude',
    consumerNote: 'The Claude app is not the Anthropic API: we probe the API, which is what applications and the Smart Router call.',
    modelsPath: '/models/anthropic', statusPath: '/status/anthropic', worsePath: '/is-claude-getting-worse',
  },
  {
    key: 'google', label: 'Google', family: 'Gemini', slug: 'google', apiHost: 'generativelanguage.googleapis.com',
    officialStatusUrl: 'https://aistudio.google.com/status', consumerName: 'Gemini',
    consumerNote: 'The Gemini app is not the Gemini API: we probe the API, which is what applications and the Smart Router call.',
    modelsPath: '/models/google', statusPath: '/status/google', worsePath: '/is-gemini-getting-worse',
  },
  {
    key: 'deepseek', label: 'DeepSeek', family: 'DeepSeek', slug: 'deepseek', apiHost: 'api.deepseek.com',
    officialStatusUrl: 'https://status.deepseek.com', consumerName: 'DeepSeek',
    consumerNote: 'The DeepSeek app is not the DeepSeek API: we probe the API, which is what applications and the Smart Router call.',
    modelsPath: '/models/deepseek', statusPath: '/status/deepseek', worsePath: '/is-deepseek-getting-worse',
  },
  {
    key: 'kimi', label: 'Moonshot AI', family: 'Kimi', slug: 'kimi', apiHost: 'api.moonshot.ai',
    officialStatusUrl: null, consumerName: 'Kimi',
    consumerNote: 'The Kimi app is not the Moonshot AI API: we probe the API, which is what applications and the Smart Router call.',
    modelsPath: '/models/kimi', statusPath: '/status/kimi', worsePath: null,
  },
  {
    key: 'glm', label: 'Z.ai', family: 'GLM', slug: 'glm', apiHost: 'api.z.ai',
    officialStatusUrl: null, consumerName: 'GLM',
    consumerNote: 'The GLM chat app is not the Z.ai API: we probe the API, which is what applications and the Smart Router call.',
    modelsPath: '/models/glm', statusPath: '/status/glm', worsePath: null,
  },
];

export const VENDOR_KEYS: VendorKey[] = VENDORS.map((v) => v.key);

/** Vendor strings as the API and older code write them, folded to the six keys. */
const VENDOR_ALIAS: Record<string, VendorKey> = {
  openai: 'openai', anthropic: 'anthropic', google: 'google', deepseek: 'deepseek',
  kimi: 'kimi', moonshot: 'kimi', 'moonshot ai': 'kimi', moonshotai: 'kimi',
  glm: 'glm', zhipu: 'glm', 'zhipu ai': 'glm', 'z.ai': 'glm', zai: 'glm',
};

/** The canonical vendor key for an API vendor string; the lower-cased input when it is not one of ours. */
export function vendorKeyOf(raw: string | null | undefined): string {
  const k = String(raw ?? '').trim().toLowerCase();
  return VENDOR_ALIAS[k] ?? k;
}

export function vendorByKey(k: string): Vendor | undefined {
  const key = vendorKeyOf(k);
  return VENDORS.find((v) => v.key === key);
}

export function vendorOfModel(m: Pick<SeoModel, 'vendor'>): Vendor | undefined {
  return vendorByKey(m.vendor);
}

/** "Moonshot AI (Kimi)" on first mention, "OpenAI" where the family name is the company's. */
export function vendorMention(v: Vendor): string {
  return v.label === v.family ? v.label : `${v.label} (${v.family})`;
}

/* ───────────────────────── roster ───────────────────────── */

export interface SeoModel {
  /** The API's numeric id as a string: boards and scores rows carry string ids. */
  id: string;
  numericId: number;
  name: string;
  displayName: string;
  /** Canonical vendor key (openai, anthropic, google, deepseek, kimi, glm). */
  vendor: string;
  /** URL segment of /models/<slug>, from lib/model-slug.ts. */
  slug: string;
  createdAt: string | null;
  daysTracked: number | null;
  isNew: boolean;
  /** Suites funded by the community rather than by us ("deep", "tooling"): not ranked on those boards. */
  community: string[];
}

function parseCommunity(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Every model shown in the rankings, from GET /api/models. Empty when the API cannot answer. */
export async function getRoster(): Promise<SeoModel[]> {
  const data = await getJson<any[]>('/api/models', 900, 6000);
  if (!Array.isArray(data)) return [];
  return data
    .filter((m: any) => m && m.showInRankings && m.name)
    .map((m: any): SeoModel => ({
      id: String(m.id),
      numericId: Number(m.id),
      name: String(m.name),
      displayName: String(m.displayName || m.name),
      vendor: vendorKeyOf(m.vendor ?? m.provider),
      slug: modelSlug({ id: m.id, name: String(m.name) }) || String(m.id),
      createdAt: typeof m.createdAt === 'string' ? m.createdAt : null,
      daysTracked: typeof m.daysTracked === 'number' && Number.isFinite(m.daysTracked) ? m.daysTracked : null,
      isNew: m.isNew === true,
      community: parseCommunity(m.communitySuites),
    }));
}

/** Display-name order that reads naturally ("GPT-6" before "GPT-6.1"). */
export const byDisplayName = (a: SeoModel, b: SeoModel): number =>
  a.displayName.localeCompare(b.displayName, 'en', { numeric: true });

export const modelsOfVendor = (roster: SeoModel[], key: string): SeoModel[] => {
  const k = vendorKeyOf(key);
  return roster.filter((m) => m.vendor === k);
};

/** The model a /models/<param> or pair half names (slug or legacy numeric id); lowest id wins a slug collision. */
export function findModel(roster: SeoModel[], param: string): SeoModel | null {
  const r = resolveModelParam(param, roster);
  return r ? roster.find((m) => m.id === String(r.model.id)) ?? null : null;
}

/**
 * Where a retired model's old numeric address (/models/185) should go: its vendor's page. The
 * API's detail route still answers retired ids because their history is kept, so a model retired
 * later is covered without a new line in next.config.js. null when the API does not know the id,
 * when the model is still ranked (a roster a few minutes stale must never send a live model's page
 * away for good), and when the vendor has no page of ours. Named successors (kimi-k3 → K3.1 Pro)
 * stay in next.config.js, which runs first.
 */
export async function retiredModelTarget(param: string): Promise<string | null> {
  if (!/^\d+$/.test(param)) return null;
  const m = await getJson<{ vendor?: string; showInRankings?: boolean }>(`/api/models/${param}`, 3600, 5000);
  if (!m || m.showInRankings !== false) return null;
  const v = vendorByKey(String(m.vendor ?? ''));
  return v ? `/models/${v.slug}` : null;
}

/* ───────────────────────── boards (24h, statistical ranks) ───────────────────────── */

export type BoardPeriod = '24h' | '7d' | '1m';

export interface SeoBoards {
  period: BoardPeriod;
  generatedAt: string;
  boards: Boards;
  /** Every row of every board by model id, so a page can read a model's four rows without searching. */
  byId: Record<string, Record<BoardKey, BoardRow | undefined>>;
}

/**
 * The four leaderboards for a free period, built with lib/boards-core so places, ties, community
 * rows and coverage notes are exactly the leaderboard's. 24h is the public default; 7d/1m exist
 * for text that wants a steadier window. Never "latest": that is paid.
 */
export async function getBoards(period: BoardPeriod = '24h'): Promise<SeoBoards | null> {
  const json = await getJson<any>(`/dashboard/boards?period=${period}`, 900);
  if (!json?.success || !json.data) return null;
  const boards = buildBoards(json.data);
  const byId: SeoBoards['byId'] = {};
  for (const k of BOARD_KEYS) {
    for (const row of [...boards[k].ranked, ...boards[k].community, ...boards[k].other]) {
      byId[row.id] ??= { combined: undefined, coding: undefined, reasoning: undefined, tooling: undefined };
      byId[row.id][k] = row;
    }
  }
  const generatedAt = typeof json.meta?.generatedAt === 'string' ? json.meta.generatedAt : new Date().toISOString();
  return { period, generatedAt, boards, byId };
}

export const getBoards24h = (): Promise<SeoBoards | null> => getBoards('24h');

export interface Placement {
  /** 1-based place among the ranked rows; null when not ranked. */
  place: number | null;
  /** True when the place is a statistical tie ("joint 3rd"). */
  joint: boolean;
  /** How many models are ranked on the board. */
  rankedCount: number;
  score: number | null;
  se: number | null;
  trend: string | null;
  status: string | null;
  lastUpdated: string | null;
  kind: 'ranked' | 'unranked' | 'absent';
}

/** The API's status word ("excellent", "good", "warning") rides along on the row, untyped in boards-core. */
const rowStatus = (row: BoardRow): string | null => {
  const s = (row as unknown as { status?: unknown }).status;
  return typeof s === 'string' ? s : null;
};

/** A model's place on one board, mapped from boards-core's Standing (ranked / community / other / absent). */
export function placementOn(boards: SeoBoards, key: BoardKey, id: string | number): Placement {
  const board = boards.boards[key];
  const st = standingOnBoard(board, String(id));
  const rankedCount = board.ranked.length;
  if (st.kind === 'absent') {
    return { place: null, joint: false, rankedCount, score: null, se: null, trend: null, status: null, lastUpdated: null, kind: 'absent' };
  }
  const row = st.row;
  const base = {
    score: row.score,
    se: typeof row.standardError === 'number' ? row.standardError : null,
    trend: row.trend || null,
    status: rowStatus(row),
    lastUpdated: row.lastUpdated ?? null,
  };
  if (st.kind === 'ranked') return { place: row.rank, joint: st.tied, rankedCount: st.rankedCount, ...base, kind: 'ranked' };
  return { place: null, joint: false, rankedCount, ...base, kind: 'unranked' };
}

/** "1st", "2nd", "3rd", "11th", "22nd". */
export function ordinal(n: number): string {
  const v = Math.abs(Math.round(n)) % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][v % 10 > 3 ? 0 : v % 10];
  return `${Math.round(n)}${suffix}`;
}

/** The board's title as the leaderboard writes it: Combined, Coding, Reasoning, Tool use. */
export const boardLabel = (key: BoardKey): string => BOARD_TITLE[key];

/**
 * "joint 3rd of the 19 models on the Coding board in the last 24 hours", or
 * "not ranked on the Coding board in the last 24 hours". `boardLabel` is the board's title.
 */
export function placementSentence(p: Placement, boardLabel: string, window = 'in the last 24 hours'): string {
  const where = `on the ${boardLabel} board ${window}`;
  if (p.kind === 'ranked' && p.place !== null) {
    return `${p.joint ? 'joint ' : ''}${ordinal(p.place)} of the ${p.rankedCount} models ${where}`;
  }
  return `not ranked ${where}`;
}

/** The leaderboard's trend word for a row's trend code. */
export function trendWord(trend: string | null | undefined): string {
  return trend === 'up' ? 'improving' : trend === 'down' ? 'declining' : 'holding steady';
}

/** The first `n` ranked rows of a board, in board order, each with its placement (ties included). */
export function topOfBoard(boards: SeoBoards, key: BoardKey, n: number): Array<{ row: BoardRow; placement: Placement }> {
  return boards.boards[key].ranked.slice(0, n).map((row) => ({ row, placement: placementOn(boards, key, row.id) }));
}

/** The newest score timestamp a model has on any board; null when it is on none. */
export function lastUpdatedOf(boards: SeoBoards | null, id: string | number): string | null {
  const rows = boards?.byId[String(id)];
  if (!rows) return null;
  let newest: string | null = null;
  for (const k of BOARD_KEYS) {
    const ts = rows[k]?.lastUpdated;
    if (ts && (!newest || ts > newest)) newest = ts;
  }
  return newest;
}

/* ───────────────────────── price snapshot (last 30 days) ───────────────────────── */

export const getPrice = getPriceSnapshot;
export type { PriceSnapshot, PriceCodingRow, PriceTaskRow };

export function priceRowFor(price: PriceSnapshot | null, suite: 'coding', numericId: number | string): PriceCodingRow | null;
export function priceRowFor(price: PriceSnapshot | null, suite: 'reasoning' | 'tooling', numericId: number | string): PriceTaskRow | null;
export function priceRowFor(price: PriceSnapshot | null, suite: 'coding' | 'reasoning' | 'tooling', numericId: number | string): PriceCodingRow | PriceTaskRow | null {
  const rows = price?.[suite]?.models as Array<PriceCodingRow | PriceTaskRow> | undefined;
  const id = Number(numericId);
  return rows?.find((r) => Number(r.id) === id) ?? null;
}

/* ───────────────────────── provider status ───────────────────────── */

export type ProviderState = 'operational' | 'degraded' | 'down' | 'unmeasured';
export type ProviderCause = 'provider' | 'our-account' | 'probe' | 'our-server' | null;

export interface ProviderStatus {
  provider: string;
  status: ProviderState;
  cause: ProviderCause;
  responseTime: number | null;
  /** "YYYY-MM-DD HH:MM:SS", UTC without a zone: parse with toDate() from lib/seo.ts. */
  lastChecked: string;
  error: string | null;
  uptime24h: number | null;
  uptime7d: number | null;
  checks24h: number;
  unmeasured24h: number;
  checks7d: number;
  unmeasured7d: number;
  medianLatencyMs: number | null;
  /** One bucket per hour, oldest first, 168 of them (seven days). */
  hours: HourBucket[];
}

export interface ProviderEpisode {
  provider: string;
  kind: 'down' | 'slow';
  cause: 'provider' | 'our-account' | 'probe' | 'our-server' | 'latency';
  startedAt: string;
  endedAt: string;
  checks: number;
  minutes: number;
  ongoing: boolean;
  error: string | null;
}

export interface ProvidersStatus {
  generatedAt: string;
  meta: { checkIntervalMinutes: number; retentionDays: number; ourFaultSince?: string | null; degradedAboveMs: number; probe: string };
  providers: ProviderStatus[];
  episodes: ProviderEpisode[];
}

/** GET /providers/status: every provider's health, the only all-provider feed. */
export async function getProviders(): Promise<ProvidersStatus | null> {
  const json = await getJson<any>('/providers/status', 60, 6000);
  if (!json?.success || !Array.isArray(json.providers)) return null;
  return {
    generatedAt: typeof json.generatedAt === 'string' ? json.generatedAt : new Date().toISOString(),
    meta: {
      checkIntervalMinutes: Number(json.meta?.checkIntervalMinutes) || 10,
      retentionDays: Number(json.meta?.retentionDays) || 7,
      ourFaultSince: json.meta?.ourFaultSince ?? null,
      degradedAboveMs: Number(json.meta?.degradedAboveMs) || 5000,
      probe: String(json.meta?.probe ?? ''),
    },
    providers: json.providers as ProviderStatus[],
    episodes: Array.isArray(json.episodes) ? (json.episodes as ProviderEpisode[]) : [],
  };
}

export const providerStatusOf = (s: ProvidersStatus | null, key: string): ProviderStatus | null =>
  s?.providers.find((p) => p.provider === vendorKeyOf(key)) ?? null;

export const episodesOf = (s: ProvidersStatus | null, key: string): ProviderEpisode[] =>
  s?.episodes.filter((e) => e.provider === vendorKeyOf(key)) ?? [];

/**
 * One character per hour, oldest first, for the .seo-bars strip: '.' answered, 'w' slow,
 * 'b' did not answer, 'o' our side (not counted), 'e' no check. Same codes as the status board.
 */
export const hourCells = (p: ProviderStatus): string => compactHealth(p).cells;

/* ───────────────────────── drift signature ───────────────────────── */

export interface PageHinkleySuite {
  cusum: number;
  days: number;
  armed: boolean;
  threshold: number;
  coldStart: number;
  confirm: number;
  above: number;
  fired: boolean;
}

export type DriftSuite = 'hourly' | 'deep' | 'tooling';

export interface DriftSignature {
  modelId: number;
  modelName: string;
  timestamp: string;
  baselineScore: number | null;
  currentScore: number | null;
  confidenceInterval: [number, number] | null;
  goldenBaselineScore?: number | null;
  driftVsGolden?: number | null;
  regime: string;
  variance24h: number | null;
  driftStatus: string;
  pageHinkleyCUSUM: number | null;
  /** hourly = coding, deep = reasoning, tooling = tool use. */
  pageHinkleyBySuite: Partial<Record<DriftSuite, PageHinkleySuite>>;
  suite: string;
  lastSignificantChange: string | null;
  hoursSinceChange: number | null;
  axes?: Record<string, { value: number; trend: string; changeMagnitude: number; status: string; sampleSize: number; comparable: boolean; runsForComparison: number }>;
  dataSource: string;
  axesSource: string;
  windowHours: number;
}

/** GET /api/drift/signature/:id. null when the model is unknown or the API cannot answer. */
export async function getDriftSignature(id: string | number): Promise<DriftSignature | null> {
  const json = await getJson<any>(`/api/drift/signature/${encodeURIComponent(String(id))}`, 900);
  if (!json?.success || !json.data) return null;
  const d = json.data;
  return { ...d, pageHinkleyBySuite: d.pageHinkleyBySuite && typeof d.pageHinkleyBySuite === 'object' ? d.pageHinkleyBySuite : {} } as DriftSignature;
}

/* ───────────────────────── pairs ───────────────────────── */

export const PAIR_SEP = '-vs-';

/** "<slugA>-vs-<slugB>" with the slugs in ascending order, so every pair has one URL. */
export function pairSlug(a: SeoModel, b: SeoModel): string {
  const [x, y] = [a.slug, b.slug].sort();
  return `${x}${PAIR_SEP}${y}`;
}

/** Both models in canonical order (sorted by slug). */
function orderPair(a: SeoModel, b: SeoModel): [SeoModel, SeoModel] {
  return a.slug <= b.slug ? [a, b] : [b, a];
}

/**
 * Resolve a /compare/<pair> segment. `a` and `b` come back in canonical order; when `canonical`
 * differs from the slug given, the page should permanentRedirect to `/compare/${canonical}`.
 * null when either half is not a model, or both halves are the same model.
 */
export function parsePairSlug(slug: string, roster: SeoModel[]): { a: SeoModel; b: SeoModel; canonical: string } | null {
  const s = String(slug || '').toLowerCase();
  const cuts: number[] = [];
  for (let i = s.indexOf(PAIR_SEP); i > 0; i = s.indexOf(PAIR_SEP, i + 1)) cuts.push(i);
  for (const i of cuts) {
    const a = findModel(roster, s.slice(0, i));
    const b = findModel(roster, s.slice(i + PAIR_SEP.length));
    if (a && b && a.id !== b.id) {
      const [x, y] = orderPair(a, b);
      return { a: x, b: y, canonical: pairSlug(x, y) };
    }
  }
  return null;
}

/** Tracked for 60 days or less: a model people are still deciding about. */
const isYoung = (m: SeoModel): boolean => m.daysTracked !== null && m.daysTracked <= 60;

/**
 * The pairs that get a page and a sitemap entry: every same-vendor pair, every cross-vendor pair
 * where both models are in the top 12 of the combined 24-hour board, and every pair that includes
 * a model tracked for 60 days or less. Deduplicated, each in canonical order, sorted by slug.
 */
export function curatedPairs(roster: SeoModel[], boards: SeoBoards | null): Array<[SeoModel, SeoModel]> {
  const top12 = new Set(boards ? boards.boards.combined.ranked.slice(0, 12).map((r) => r.id) : []);
  const out = new Map<string, [SeoModel, SeoModel]>();
  for (let i = 0; i < roster.length; i++) {
    for (let j = i + 1; j < roster.length; j++) {
      const a = roster[i];
      const b = roster[j];
      if (a.slug === b.slug) continue;
      const same = a.vendor === b.vendor;
      const top = top12.has(a.id) && top12.has(b.id);
      const young = isYoung(a) || isYoung(b);
      if (!same && !top && !young) continue;
      const pair = orderPair(a, b);
      out.set(pairSlug(pair[0], pair[1]), pair);
    }
  }
  return Array.from(out.entries()).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).map(([, pair]) => pair);
}

/* ───────────────────────── related models ───────────────────────── */

export interface RelatedModels {
  /** Same vendor, best combined place first. */
  siblings: SeoModel[];
  /** The three closest by combined 24-hour score, any vendor. */
  nearest: SeoModel[];
  /** The best-placed ranked model of each other vendor. */
  flagships: SeoModel[];
}

export function relatedModels(m: SeoModel, roster: SeoModel[], boards: SeoBoards | null): RelatedModels {
  const others = roster.filter((x) => x.id !== m.id);
  const placeOf = (x: SeoModel): Placement | null => (boards ? placementOn(boards, 'combined', x.id) : null);
  const placeKey = (x: SeoModel): number => placeOf(x)?.place ?? Number.POSITIVE_INFINITY;
  const byPlace = (x: SeoModel, y: SeoModel): number => placeKey(x) - placeKey(y) || byDisplayName(x, y);

  const siblings = others.filter((x) => x.vendor === m.vendor).sort(byPlace);

  const mine = placeOf(m)?.score ?? null;
  const nearest = mine === null ? [] : others
    .map((x) => ({ x, score: placeOf(x)?.score ?? null }))
    .filter((e): e is { x: SeoModel; score: number } => e.score !== null)
    .sort((p, q) => Math.abs(p.score - mine) - Math.abs(q.score - mine) || byPlace(p.x, q.x))
    .slice(0, 3)
    .map((e) => e.x);

  const flagships: SeoModel[] = [];
  for (const v of VENDORS) {
    if (v.key === m.vendor) continue;
    const best = others.filter((x) => x.vendor === v.key && placeOf(x)?.kind === 'ranked').sort(byPlace)[0];
    if (best) flagships.push(best);
  }
  return { siblings, nearest, flagships };
}

/* ───────────────────────── list prices ───────────────────────── */

/** Providers lib/model-pricing.ts has a table for; anything else gets no price rather than a guess. */
const PRICED_VENDORS = new Set(['openai', 'anthropic', 'google', 'deepseek', 'kimi', 'glm', 'xai']);

/** List price in USD per 1M tokens (cache-miss input, output, and the 40/60 blend the price view ranks). */
export function listPrice(m: Pick<SeoModel, 'name' | 'vendor'>): { input: number; output: number; blended: number } | null {
  const vendor = vendorKeyOf(m.vendor);
  if (!PRICED_VENDORS.has(vendor)) return null;
  const p = getModelPricing(m.name, vendor);
  return { input: p.input, output: p.output, blended: getBlendedCostPer1M(m.name, vendor) };
}
