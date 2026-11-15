import { apiClient, ApiRequestError, type RecentRequest } from './api-client';
import { STRATEGY_NAME } from './router-adaptive';

/**
 * Model changes, Layer 1 (router release A1c on the API, AW3 here; design-features §3.2). The answer of GET
 * /router/analytics/model-changes and GET /account/org/projects/:id/model-changes,
 * and every sentence the pane says, as pure functions (tests/aw3 and tests/aw4 check each one in full).
 *
 * The copy only states what the two requests' own records show: which model a key's automatic requests went to before and
 * after, the strategy each was ranked on, when, and what each cost. Layer 1 never says why a pick moved beyond the stored
 * reasons themselves (it cannot tell a ranking change from a removed key or a provider out of credit), so its words never
 * say "ranking", and nothing is announced (D23).
 * Layer 2 (router release A1d on the API, AW4 here; design-features §3.3): a change whose request after recorded why its
 * pick replaced the caller's previous one carries that `cause`, and only then does the pane say why in words of cause
 * (causeTag, causeLine): "Ranking changed" for ranked_lower and tied, "No longer available to this key" for not_allowed.
 * A change without one keeps Layer 1's words.
 */

export type ModelChangeKind = 'change' | 'settings' | 'budget' | 'conversation';
/** Layer 2's causes (the API's pick_cause): the only words of cause the pane may say. */
export type ModelChangeCause = 'tied' | 'not_allowed' | 'ranked_lower';
export const CAUSES: readonly ModelChangeCause[] = ['tied', 'not_allowed', 'ranked_lower'];
const causeOf = (v: unknown): ModelChangeCause | null => (typeof v === 'string' && (CAUSES as readonly string[]).includes(v) ? (v as ModelChangeCause) : null);

export interface ModelChange {
  at: string;
  keyId: number;
  mode: string | null;
  strategy: string | null;
  fromStrategy: string | null;
  from: string;
  to: string;
  fromProvider: string | null;
  toProvider: string | null;
  kind: ModelChangeKind;
  /** Layer 2's recorded cause (A1d): why the request after's pick replaced the previous one; null when none was recorded. */
  cause: ModelChangeCause | null;
  /** The last new conversation on the old model (null for an in-conversation change), and the first on the new one. */
  before: RecentRequest | null;
  after: RecentRequest | null;
  /** Mean cost per request on each side (USD), when each side has enough answered requests. */
  cost: { before: number; after: number } | null;
  requestsSince: number | null;
  /** Alternations folded into this row (D-D3). */
  folded?: { times: number; first: string; sameWay?: boolean };
}

export interface ModelChangeKey { id: number; name: string | null; prefix: string; revoked: boolean }

export interface ModelChanges {
  window: { from: string; days: number };
  keys: ModelChangeKey[];
  /** The projects whose keys the caller holds (the personal route only). */
  projectKeys?: Array<{ projectId: number; name: string; keys: number }>;
  current: Array<{ keyId: number; mode: string | null; strategy: string | null; model: string; since: string | null }>;
  changes: ModelChange[];
  more: boolean;
  /** With `more`: the next page's `before` (the last listed change's time and request after). */
  next: string | null;
  /** Only the newest 20,000 requests were read. */
  capped: boolean;
  /** All keys: only the 200 most recently used keys were read. */
  keysCapped: boolean;
  labelsSince: string | null;
  beforeLabels: boolean;
  split: boolean;
  /** The project route: without spend detail, only your own keys. */
  ownOnly?: boolean;
}

/** An answer read field by field: anything malformed is left out, so one odd row never takes the pane down. */
export function modelChangesOf(raw: unknown): ModelChanges | null {
  const j = raw as Record<string, unknown> | null;
  if (!j || typeof j !== 'object' || !j.window || !Array.isArray(j.changes) || !Array.isArray(j.keys)) return null;
  const w = j.window as { from?: unknown; days?: unknown };
  return {
    window: { from: String(w.from ?? ''), days: Number(w.days) || 0 },
    keys: (j.keys as ModelChangeKey[]).filter(k => k && Number.isInteger(k.id)),
    projectKeys: Array.isArray(j.projectKeys) ? (j.projectKeys as ModelChanges['projectKeys'])!.filter(p => p && Number.isInteger(p.projectId) && typeof p.name === 'string') : undefined,
    current: Array.isArray(j.current) ? (j.current as ModelChanges['current']).filter(c => c && typeof c.model === 'string') : [],
    // A cause the pane does not know reads as none: Layer 1's words, never a guess.
    changes: (j.changes as ModelChange[]).filter(c => c && typeof c.from === 'string' && typeof c.to === 'string' && typeof c.at === 'string')
      .map(c => ({ ...c, cause: c.kind === 'change' ? causeOf(c.cause) : null })),
    more: j.more === true,
    next: typeof j.next === 'string' && j.next ? j.next : null,
    capped: j.capped === true,
    keysCapped: j.keysCapped === true,
    labelsSince: typeof j.labelsSince === 'string' ? j.labelsSince : null,
    beforeLabels: j.beforeLabels === true,
    split: j.split === true,
    ownOnly: j.ownOnly === true ? true : j.ownOnly === false ? false : undefined,
  };
}

/* ── The pane's words ───────────────────────────────────────────────────────────────────────────────────────── */

export const PANE_TITLE = 'Model changes';
export const KEY_LABEL = 'Key';
export const ALL_KEYS = 'All keys';
export const SHOW_OLDER = 'Show older';
export const DISCLOSURE = 'Requests before and after';
export const DISCLOSURE_MOVE = 'Request after';
export const LOADING = 'Loading model changes';
export const UNAVAILABLE = 'Model changes could not be loaded.';
export const RETRY = 'Try again';
export const SPLIT_NOTE = 'Your traffic split draws each request\'s model by weight; those draws are not listed.';
/** The project tab's: a project's policy may hold the split. */
export const SPLIT_NOTE_PROJECT = 'A traffic split draws each request\'s model by weight; those draws are not listed.';
export const CAPPED_NOTE = 'Only your newest 20,000 requests are read, so older changes are not listed.';
/** The project Requests view's own words for a member without spend detail (components/workspace/project/ActivityTab.tsx). */
export const OWN_ONLY = ' — yours only, as this project shows each person\'s spending to managers only';

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/**
 * Whose requests the pane read, for its sentences: /router (personal) or a project's tab; there, a member without spend
 * detail sees only their own keys (`ownOnly`); one key chosen in the select, or every key.
 */
export interface PaneScope { project?: boolean; ownOnly?: boolean; key?: 'all' | number }

/** The keys the answer read, in a sentence: "this key", "your keys", "this project's keys", "your keys in this project"; the key cap's "200 most recently used". */
export function keysPhrase(s: PaneScope, keysCapped = false): string {
  if (typeof s.key === 'number') return 'this key';
  const own = s.project && s.ownOnly;
  if (keysCapped) return own ? 'your 200 most recently used keys in this project' : s.project ? 'this project\'s 200 most recently used keys' : 'your 200 most recently used keys';
  return own ? 'your keys in this project' : s.project ? 'this project\'s keys' : 'your keys';
}
/** What a capped answer read: the newest 20,000 requests (of the keys read). */
export function newestPhrase(s: PaneScope, keysCapped = false): string {
  return !s.project && typeof s.key !== 'number' && !keysCapped ? 'your newest 20,000 requests' : `the newest 20,000 requests on ${keysPhrase(s, keysCapped)}`;
}

/** The sub-line: the personal pane (design-features §3.2), and the project tab's (yours only, in the Requests view's words). */
export function subLine(n: number, project = false, ownOnly = false): string {
  return project
    ? `When a key's automatic requests started going to another model, and why. Covers the last ${days(n)} of this project's routing decisions${ownOnly ? OWN_ONLY : ''}.`
    : `When a key's automatic requests started going to another model, and why. Covers your last ${days(n)} of routing decisions.`;
}

/** A strategy as the dashboard names it. */
export const strategyName = (s: string | null | undefined): string => (s ? STRATEGY_NAME[s] ?? s : 'its strategy');

/** A key in the select and in a row: "name — prefix", or the prefix alone; a revoked key says so. */
export function keyOption(k: ModelChangeKey): string {
  const base = k.name && k.name.trim() ? `${k.name.trim()} — ${k.prefix}` : k.prefix;
  return k.revoked ? `${base} (revoked)` : base;
}
/** A key in a sentence: its name, or its prefix. */
export const keyWord = (k: ModelChangeKey | undefined, id: number): string => (k ? (k.name && k.name.trim() ? k.name.trim() : k.prefix) : `Key ${id}`);

/** Layer 2's tags (design-features §3.3). */
export const CAUSE_TAG: Readonly<Record<ModelChangeCause, string>> = { ranked_lower: 'Ranking changed', tied: 'Ranking changed', not_allowed: 'No longer available to this key' };

/**
 * The kind's tag. Layer 1 never says "ranking": everything it cannot attribute is "Model changed". A change with Layer 2's
 * recorded cause (the neutral kind only) gets the cause's tag.
 */
export function kindTag(c: Pick<ModelChange, 'kind' | 'after'> & { cause?: ModelChange['cause'] }): string {
  if (c.kind === 'conversation') return c.after?.conversation === 'switched' ? 'Switched' : 'Moved';
  if (c.kind === 'settings') return 'Strategy changed';
  if (c.kind === 'budget') return 'Project budget';
  const cause = causeOf(c.cause);
  return cause ? CAUSE_TAG[cause] : 'Model changed';
}

/**
 * Layer 2's sentence for a change with a recorded cause (design-features §3.3, word for word), or null (Layer 1's words
 * stay): the old model, the new one and the strategy the request after was ranked on, as the row names them.
 */
export function causeLine(c: Pick<ModelChange, 'kind' | 'cause' | 'from' | 'to' | 'strategy'>, nameOf: (m: string) => string): string | null {
  const cause = c.kind === 'change' ? causeOf(c.cause) : null;
  if (!cause) return null;
  const old = nameOf(c.from); const fresh = nameOf(c.to); const st = strategyName(c.strategy);
  if (cause === 'ranked_lower') return `${old} now ranks below ${fresh} for ${st}.`;
  if (cause === 'tied') return `${old} and ${fresh} are tied for ${st}, and the tie-break chose ${fresh}.`;
  return `${old} is no longer available to this key.`;
}

/** The row's title: "<old> → <new>", or the fold (D-D3). */
export function changeTitle(c: Pick<ModelChange, 'from' | 'to' | 'kind' | 'folded'>, nameOf: (m: string) => string): string {
  const a = nameOf(c.from); const b = nameOf(c.to);
  if (c.folded && c.folded.times > 1) {
    if (c.kind === 'conversation') {
      // "changed": a fold may hold moved and switched conversations alike (the tag names the newest one's).
      return c.folded.sameWay ? `${c.folded.times} conversations changed from ${a} to ${b}` : `Conversations alternated between ${a} and ${b} (${c.folded.times} times)`;
    }
    return `Alternated between ${a} and ${b} (${c.folded.times} times)`;
  }
  return `${a} → ${b}`;
}

/** Dollars per request: four decimals under a cent, cents under $100 (the workspace pages' rule). */
export function perRequest(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '$0';
  return Math.abs(n) < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

/** "2 h ago": the time words of Recent activity. */
export function agoWords(ts: string, now = Date.now()): string {
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** The row's second line: key · mode · strategy (and the one before, when it changed) · when · cost · requests since. */
export function changeMeta(c: ModelChange, key: string, now = Date.now()): string {
  const parts = [key];
  if (c.mode) parts.push(c.mode);
  const st = strategyName(c.strategy);
  parts.push(c.fromStrategy && c.strategy && c.fromStrategy !== c.strategy ? `${strategyName(c.fromStrategy)} → ${st}` : st);
  const when = agoWords(c.at, now);
  if (when) parts.push(when);
  if (c.cost) parts.push(`${perRequest(c.cost.before)} → ${perRequest(c.cost.after)} per request`);
  if (typeof c.requestsSince === 'number' && c.requestsSince > 0) parts.push(`${c.requestsSince.toLocaleString('en-US')} ${c.requestsSince === 1 ? 'request' : 'requests'} since`);
  return parts.join(' · ');
}

/** The labels over the two requests in the disclosure. */
export const beforeLabel = (old: string) => `Before: the last new conversation on ${old}`;
export const afterLabel = (fresh: string) => `After: the first new conversation on ${fresh}`;
export const moveLabel = (c: Pick<ModelChange, 'after'>, fresh: string) =>
  c.after?.conversation === 'switched' ? `The request that switched to ${fresh}` : `The request that moved to ${fresh}`;

/** A day for "Changes are listed from …". */
export function dayOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/* ── Empty states (design-features §3.2), in this order ─────────────────────────────────────────────────────── */

/** Only project keys: one line per project, its name the link (the caller fills it in). */
export const projectPointer = (project: string) => ({ before: 'Your keys belong to ', project, after: '. Their model changes are on the project\'s Activity tab.' });
export const projectHref = (id: number) => `/account/team/projects/${id}?tab=activity&view=model-changes`;

const NAMED = 'Requests that name a model always go to that model, so they never change.';
const cap1 = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * No change: what each key's automatic requests went to, in the window, or (`newest`: a capped answer) in what was read:
 * "No change in your newest 20,000 requests: …".
 */
export function noChangeLine(n: number, key: string, model: string, strategy: string | null, newest?: string): string {
  return `No change in ${newest ?? `the last ${days(n)}`}: ${key}'s automatic requests went to ${model} for ${strategyName(strategy)}.`;
}
/** No automatic request: on /router as design-features §3.2 words it; `on` names the keys read (the project tab, the key cap); `newest` a capped answer. */
export function noAutomatic(n: number, on?: string, newest?: string): string {
  if (newest) return `None of ${newest} was automatic. ${NAMED}`;
  return on ? `No automatic requests on ${on} in the last ${days(n)}. ${NAMED}` : `No automatic requests in the last ${days(n)}. ${NAMED}`;
}
/** Requests from before the labels: from when changes are listed. */
export const labelsNote = (since: string) => `Changes are listed from ${dayOf(since)}, when requests started recording how they were routed.`;
/** Every automatic request read came before the labels: on /router as §3.2 words it; `on` and `newest` as noAutomatic's. */
export function allBeforeLabels(n: number, on?: string, newest?: string): string {
  const tail = 'were made before requests recorded how they were routed, so no change can be listed for them.';
  if (newest) return `${cap1(newest)} ${tail}`;
  return on ? `The automatic requests on ${on} in the last ${days(n)} ${tail}` : `Your automatic requests in the last ${days(n)} ${tail}`;
}
/** A capped answer's note: what was read, so older changes are not listed. */
export function cappedNote(s: PaneScope, keysCapped = false): string {
  const newest = newestPhrase(s, keysCapped);
  return newest === 'your newest 20,000 requests' ? CAPPED_NOTE : `Only ${newest} are read, so older changes are not listed.`;
}
/** The key cap's note (All keys over more than 200 keys). */
export const keysCappedNote = (s: PaneScope) => `Only ${keysPhrase({ ...s, key: 'all' }, true)} are read, so changes on other keys are not listed.`;

export type EmptyState =
  | { kind: 'hidden' }
  | { kind: 'projects'; projects: Array<{ projectId: number; name: string }> }
  | { kind: 'list' }
  | { kind: 'nochange'; lines: string[] }
  | { kind: 'labels'; line: string }
  | { kind: 'noauto'; line: string }
  | { kind: 'split' };

/** The scope of an answer as shown: the project tab or /router, yours only, the key chosen. */
const scopeOf = (d: ModelChanges, s: PaneScope | boolean | undefined): PaneScope => {
  const o = typeof s === 'object' ? s : { project: s === true };
  return { project: !!o.project, ownOnly: !!o.project && (o.ownOnly ?? d.ownOnly === true), key: o.key ?? 'all' };
};

/**
 * What the pane shows for an answer (personal: `scope` false or { project: false }). Every sentence says what was read: the
 * window, or the newest 20,000 requests when capped; on the project tab and under the key cap, whose keys.
 */
export function stateOf(d: ModelChanges, nameOf: (m: string) => string, scope: PaneScope | boolean = false): EmptyState {
  const s = scopeOf(d, scope);
  const project = s.project;
  const newest = d.capped ? newestPhrase(s, d.keysCapped) : undefined;
  const on = project || d.keysCapped ? keysPhrase(s, d.keysCapped) : undefined;
  if (!project && !d.keys.length) {
    const ps = (d.projectKeys ?? []).filter(p => p.keys > 0);
    return ps.length ? { kind: 'projects', projects: ps.map(p => ({ projectId: p.projectId, name: p.name })) } : { kind: 'hidden' };
  }
  if (d.changes.length) return { kind: 'list' };
  if (d.current.length) {
    const byKey = new Map(d.keys.map(k => [k.id, k]));
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const c of d.current) {
      const line = noChangeLine(d.window.days, keyWord(byKey.get(c.keyId), c.keyId), nameOf(c.model), c.strategy, newest);
      if (!seen.has(line)) { seen.add(line); lines.push(line); }
    }
    return { kind: 'nochange', lines: lines.slice(0, 4) };
  }
  if (d.beforeLabels) return { kind: 'labels', line: d.labelsSince ? labelsNote(d.labelsSince) : allBeforeLabels(d.window.days, on, newest) };
  if (d.split) return { kind: 'split' };
  return { kind: 'noauto', line: noAutomatic(d.window.days, on, newest) };
}

/** The notes under a list (or an empty state): from when changes are listed, the split's draws, the row cap, the key cap. */
export function notesOf(d: ModelChanges, state: EmptyState, scope: PaneScope | boolean = false): string[] {
  const s = scopeOf(d, scope);
  const out: string[] = [];
  const shown = state.kind !== 'hidden' && state.kind !== 'projects';
  if ((state.kind === 'list' || state.kind === 'nochange') && d.beforeLabels && d.labelsSince) out.push(labelsNote(d.labelsSince));
  if (d.split && shown) out.push(s.project ? SPLIT_NOTE_PROJECT : SPLIT_NOTE);
  if (d.capped && shown) out.push(cappedNote(s, d.keysCapped));
  if (d.keysCapped && shown && s.key === 'all') out.push(keysCappedNote(s));
  return out;
}

/**
 * The probe's key: a well-formed id no key has, so the route answers its empty list (200) without reading any request, and
 * a browser logs nothing (a 400 would show as an error in its console). An API without the route answers 404.
 */
export const PROBE_KEY = Number.MAX_SAFE_INTEGER;

/**
 * Whether the API serves the model changes: the probe answers 200 where it does, 404 where it does not (an API before A1c,
 * or one rolled back). Any other failure: assume it does (the pane says so itself).
 */
export async function modelChangesServed(): Promise<boolean> {
  try { await apiClient.getModelChanges({ key: PROBE_KEY, limit: 1 }); return true; } catch (e) { return !(e instanceof ApiRequestError && e.status === 404); }
}
