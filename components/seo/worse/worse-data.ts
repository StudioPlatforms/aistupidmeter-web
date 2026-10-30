import { BOARD_KEYS, BOARD_TITLE, type BoardKey } from '@/lib/boards-core';
import { bucketOf } from '@/lib/fleet-buckets';
import { dayLabel } from '@/lib/seo';
import {
  byDisplayName, getBoards24h, getDriftSignature, getProviders, getRoster, modelsOfVendor, ordinal, placementOn,
  type DriftSignature, type DriftSuite, type PageHinkleySuite, type Placement, type ProvidersStatus, type SeoBoards,
  type SeoModel, type VendorKey,
} from '@/lib/seo-data';

/**
 * The data behind the "is X getting worse" pages and the drift page's monitor block: every
 * model's four 24-hour placements, its trend bucket (lib/fleet-buckets, so "declining" here is
 * the leaderboard's own word) and the per-suite Page-Hinkley state from its drift signature.
 * Everything is computed from the same free-period feeds the leaderboard reads; nothing is
 * typed. A feed that does not answer leaves its part out (null boards → no verdict, no table;
 * no signature → no detector states), never a placeholder.
 */

/** The three drift series, in the order the pages list them, with the board each one scores. */
export const DRIFT_SUITES: ReadonlyArray<{ key: DriftSuite; board: BoardKey; label: string }> = [
  { key: 'hourly', board: 'coding', label: 'Coding' },
  { key: 'deep', board: 'reasoning', label: 'Reasoning' },
  { key: 'tooling', board: 'tooling', label: 'Tool use' },
];

const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
/** "three" for 3; numerals beyond ten. */
export const numWord = (x: number): string => NUM_WORDS[x] ?? x.toLocaleString('en-US');

/** "a, b and c". */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/* ───────────────────────── detector state ───────────────────────── */

export type DetectorKind = 'fired' | 'armed' | 'cold' | 'none';

export interface DetectorState {
  suite: DriftSuite;
  board: BoardKey;
  label: string;
  kind: DetectorKind;
  /** "armed, no detection" / "fired (as of 23 Oct 2026)" / "younger than ten days" / "no baseline yet". */
  text: string;
  coldStart: number;
}

/**
 * One suite's Page-Hinkley state in words. The API's `armed` flag is its own answer to "past the
 * cold start"; `fired` is a state, not an event, and the signature carries no date for it, so a
 * fired detector is dated by the signature it was read from.
 */
export function detectorState(suite: DriftSuite, state: PageHinkleySuite | undefined, asOf: string | null): DetectorState {
  const def = DRIFT_SUITES.find((s) => s.key === suite) ?? DRIFT_SUITES[0];
  const base = { suite, board: def.board, label: def.label };
  const coldStart = state && Number.isFinite(state.coldStart) && state.coldStart > 0 ? state.coldStart : 10;
  if (!state) return { ...base, kind: 'none', text: 'no baseline yet', coldStart };
  if (state.fired) return { ...base, kind: 'fired', text: asOf ? `fired (as of ${dayLabel(asOf)})` : 'fired', coldStart };
  if (state.armed) return { ...base, kind: 'armed', text: 'armed, no detection', coldStart };
  if (state.days > 0) return { ...base, kind: 'cold', text: `younger than ${numWord(coldStart)} days`, coldStart };
  return { ...base, kind: 'none', text: 'no baseline yet', coldStart };
}

/* ───────────────────────── per-model summary ───────────────────────── */

/** Board statuses that count as degraded on their own (the API's absolute bands; 'warning' is a level, not a fall). */
const DEGRADED_STATUSES = new Set(['critical']);

export interface ModelWorse {
  model: SeoModel;
  /** The four 24-hour placements, or null when the boards did not answer. */
  placements: Record<BoardKey, Placement> | null;
  /** True when the model has a row on at least one 24-hour board. */
  onBoard: boolean;
  /** The Combined row's trend code ('up' | 'down' | 'stable'), or the first board's that has one. */
  trend: string | null;
  /** Boards on which the row is declining (fleet bucket 'degraded') or marked critical. */
  downOn: BoardKey[];
  detectors: DetectorState[];
  /** The raw per-suite Page-Hinkley state (statistic, threshold, days), for pages that show how close a detector is to firing. */
  ph: Partial<Record<DriftSuite, PageHinkleySuite>>;
  /** True when a board is declining or a detector has fired. */
  flagged: boolean;
  /** Why it is flagged, in words: "declining on the Coding board", "reasoning detector fired". */
  reasons: string[];
  signatureAt: string | null;
}

function summarise(model: SeoModel, boards: SeoBoards | null, sig: DriftSignature | null): ModelWorse {
  let placements: Record<BoardKey, Placement> | null = null;
  if (boards) {
    const p = {} as Record<BoardKey, Placement>;
    for (const k of BOARD_KEYS) p[k] = placementOn(boards, k, model.id);
    placements = p;
  }
  const onBoard = !!placements && BOARD_KEYS.some((k) => placements![k].kind !== 'absent');
  const downOn: BoardKey[] = [];
  if (placements) {
    for (const k of BOARD_KEYS) {
      const p = placements[k];
      if (p.kind === 'absent' || p.score === null) continue;
      const bucket = bucketOf({ trend: p.trend ?? undefined, standardError: p.se ?? undefined, currentScore: p.score });
      if (bucket === 'degraded' || (p.status !== null && DEGRADED_STATUSES.has(p.status))) downOn.push(k);
    }
  }
  const trend = placements
    ? placements.combined.trend ?? BOARD_KEYS.map((k) => placements![k].trend).find((t): t is string => !!t) ?? null
    : null;
  const signatureAt = sig?.timestamp ?? null;
  const detectors = DRIFT_SUITES.map((s) => detectorState(s.key, sig?.pageHinkleyBySuite?.[s.key], signatureAt));
  const fired = detectors.filter((d) => d.kind === 'fired');
  const reasons = [
    ...downOn.map((k) => `declining on the ${BOARD_TITLE[k]} board`),
    ...fired.map((d) => `${d.label.toLowerCase()} detector fired`),
  ];
  return { model, placements, onBoard, trend, downOn, detectors, ph: sig?.pageHinkleyBySuite ?? {}, flagged: reasons.length > 0, reasons, signatureAt };
}

/** Models in Combined board order (ranked, then community, then other), then any on no board by name. */
export function orderByBoard(models: SeoModel[], boards: SeoBoards | null): SeoModel[] {
  const byId = new Map(models.map((m) => [m.id, m] as const));
  const ordered: SeoModel[] = [];
  if (boards) {
    const b = boards.boards.combined;
    for (const row of [...b.ranked, ...b.community, ...b.other]) {
      const m = byId.get(row.id);
      if (m && !ordered.includes(m)) ordered.push(m);
    }
  }
  for (const m of [...models].sort(byDisplayName)) if (!ordered.includes(m)) ordered.push(m);
  return ordered;
}

export interface WorseData {
  roster: SeoModel[];
  boards: SeoBoards | null;
  providers: ProvidersStatus | null;
  /** The selected models (one vendor's, or all), in board order. */
  models: ModelWorse[];
  /** The boards' timestamp, else the newest signature's, else null. */
  asOf: string | null;
}

/** Everything a page needs, for one vendor or for the whole board. */
export async function getWorseData(vendor?: VendorKey): Promise<WorseData> {
  const [roster, boards, providers] = await Promise.all([getRoster(), getBoards24h(), getProviders()]);
  const mine = vendor ? modelsOfVendor(roster, vendor) : roster;
  const ordered = orderByBoard(mine, boards);
  const sigs = await Promise.all(ordered.map((m) => getDriftSignature(m.id)));
  const models = ordered.map((m, i) => summarise(m, boards, sigs[i]));
  const newestSig = sigs.map((s) => s?.timestamp ?? '').filter(Boolean).sort().pop() ?? null;
  return { roster, boards, providers, models, asOf: boards?.generatedAt ?? newestSig };
}

/* ───────────────────────── sentences ───────────────────────── */

/**
 * The verdict under the H1. `family` is the product family ("Claude", "GPT"); null means the
 * whole board. null when nothing can be judged (no boards).
 *
 *   "Over the last 24 hours none of the 9 Claude models we track is below its recent baseline on
 *    any board, and no drift detector has fired."
 *   "Over the last 24 hours 2 of the 24 models on the board show a downward trend or a drift
 *    detection on the 24-hour boards: X (declining on the Coding board) and Y (reasoning detector fired)."
 */
export function verdictSentence(models: ModelWorse[], family: string | null): string | null {
  if (!models.length || !models.some((m) => m.onBoard)) return null;
  const count = models.length;
  const haveDetectors = models.some((m) => m.detectors.some((d) => d.kind !== 'none'));
  const flagged = models.filter((m) => m.flagged);
  if (!flagged.length) {
    const subject = family
      ? count === 1 ? `the ${family} model we track is not` : `none of the ${count} ${family} models we track is`
      : count === 1 ? 'the model on the board is not' : `none of the ${count} models on the board is`;
    return `Over the last 24 hours ${subject} below its recent baseline on any board${haveDetectors ? ', and no drift detector has fired' : ''}.`;
  }
  const who = family ? `${count} ${family} ${count === 1 ? 'model' : 'models'} we track` : `${count} models on the board`;
  const list = listJoin(flagged.map((m) => `${m.model.displayName} (${listJoin(m.reasons)})`));
  return `Over the last 24 hours ${flagged.length} of the ${who} ${flagged.length === 1 ? 'shows' : 'show'} a downward trend or a drift detection on the 24-hour boards: ${list}.`;
}

/** One sentence per model for the "nerfed right now?" list. */
export function modelSentence(m: ModelWorse): string {
  const parts: string[] = [];
  const c = m.placements?.combined ?? null;
  if (!m.onBoard) {
    parts.push('not on the 24-hour boards');
  } else {
    let first = m.downOn.length
      ? `declining on the ${listJoin(m.downOn.map((k) => BOARD_TITLE[k]))} ${m.downOn.length === 1 ? 'board' : 'boards'} over the last 24 hours`
      : m.trend === 'up' ? 'improving on the 24-hour boards' : 'holding steady on the 24-hour boards';
    if (c && c.kind === 'ranked' && c.place !== null) first += ` (${c.joint ? 'joint ' : ''}${ordinal(c.place)} of ${c.rankedCount} on Combined)`;
    else if (c && c.kind === 'unranked') first += ' (not ranked on Combined)';
    parts.push(first);
  }
  const fired = m.detectors.filter((d) => d.kind === 'fired');
  const armed = m.detectors.filter((d) => d.kind === 'armed');
  const cold = m.detectors.filter((d) => d.kind === 'cold');
  const det: string[] = [];
  if (fired.length) det.push(`the ${listJoin(fired.map((d) => d.label.toLowerCase()))} ${fired.length === 1 ? 'detector has' : 'detectors have'} fired`);
  if (armed.length) det.push(`${fired.length ? 'the ' : ''}detectors armed on ${listJoin(armed.map((d) => d.label.toLowerCase()))} with no detection`);
  if (cold.length) det.push(`${listJoin(cold.map((d) => d.label.toLowerCase()))} younger than ${numWord(cold[0].coldStart)} days`);
  if (det.length) parts.push(det.join(', '));
  if (m.model.createdAt) parts.push(`tracked since ${dayLabel(m.model.createdAt)}`);
  return `${m.model.displayName}: ${parts.join('; ')}.`;
}

/* ───────────────────────── fleet counts ───────────────────────── */

export interface FleetCounts {
  models: number;
  onBoard: number;
  flagged: number;
  /** Model-suite series with a detector state (armed, fired or cold). */
  series: number;
  armed: number;
  fired: number;
  cold: number;
  /** Models with every detector armed and none fired. */
  modelsClear: number;
  modelsFired: number;
  /** Models with no detection and at least one suite still in its cold start. */
  modelsCold: number;
}

export function fleetCounts(models: ModelWorse[]): FleetCounts {
  const out: FleetCounts = { models: models.length, onBoard: 0, flagged: 0, series: 0, armed: 0, fired: 0, cold: 0, modelsClear: 0, modelsFired: 0, modelsCold: 0 };
  for (const m of models) {
    if (m.onBoard) out.onBoard++;
    if (m.flagged) out.flagged++;
    const ds = m.detectors.filter((d) => d.kind !== 'none');
    out.series += ds.length;
    const fired = ds.filter((d) => d.kind === 'fired').length;
    const cold = ds.filter((d) => d.kind === 'cold').length;
    const armed = ds.filter((d) => d.kind === 'armed').length;
    out.fired += fired;
    out.cold += cold;
    out.armed += armed;
    if (fired) out.modelsFired++;
    else if (cold) out.modelsCold++;
    else if (ds.length && armed === ds.length) out.modelsClear++;
  }
  return out;
}

/** The oldest `createdAt` among the models: "tracked since" for a family. */
export function trackedSince(models: ModelWorse[]): string | null {
  const dates = models.map((m) => m.model.createdAt).filter((d): d is string => !!d).sort();
  return dates[0] ?? null;
}
