import { BOARD_KEYS, type BoardKey } from '@/lib/boards-core';
import {
  boardLabel, byDisplayName, listPrice, ordinal, pairSlug, placementOn, priceRowFor, relatedModels, trendWord, vendorOfModel,
  type DriftSignature, type DriftSuite, type Placement, type PriceCodingRow, type PriceSnapshot, type PriceTaskRow,
  type SeoBoards, type SeoModel, type Vendor,
} from '@/lib/seo-data';
import { DESC_MAX, TITLE_MAX, TITLE_SUFFIX, clampDesc, dayLabel } from '@/lib/seo';
import { duration, pct, per1k, times } from '@/components/landing/price-format';

/**
 * Everything a /compare/<a>-vs-<b> page says, computed from the data the page fetched: the
 * 24-hour boards (places with statistical ties), the list prices, the price snapshot's last 30
 * days (pass rate, median response time, cost per correct answer) and the two drift signatures.
 * Pure functions, no fetch, no React: the page and its metadata call the same code, and every
 * sentence degrades to nothing (not to a placeholder) when the figure behind it is missing.
 *
 * Wording rules kept here: visitor-facing scores are "on the 24-hour board"; the rolling window
 * is "over the last 30 days", never "measured"; a lead is claimed only beyond the leaderboard's own
 * tie rule (lib/board-ranks.ts), so the verdict can never contradict the places in the table.
 */

export type SuiteKey = 'coding' | 'reasoning' | 'tooling';
export const SUITES: SuiteKey[] = ['coding', 'reasoning', 'tooling'];
/** The suite in words, lower case, as it reads mid-sentence. */
export const SUITE_WORD: Record<SuiteKey, string> = { coding: 'coding', reasoning: 'reasoning', tooling: 'tool use' };
const DRIFT_SUITE: Record<SuiteKey, DriftSuite> = { coding: 'hourly', reasoning: 'deep', tooling: 'tooling' };

export const WINDOW_24H = 'in the last 24 hours';
export const WINDOW_30D = 'over the last 30 days';

/* ───────────────────────── one side of the pair ───────────────────────── */

export interface Side {
  m: SeoModel;
  name: string;
  slug: string;
  vendor: Vendor | undefined;
  /** Place on each board, or null when the boards could not be read. */
  place: Record<BoardKey, Placement> | null;
  price: { input: number; output: number; blended: number } | null;
  coding: PriceCodingRow | null;
  reasoning: PriceTaskRow | null;
  tooling: PriceTaskRow | null;
  drift: DriftSignature | null;
}

export function makeSide(m: SeoModel, boards: SeoBoards | null, price: PriceSnapshot | null, drift: DriftSignature | null): Side {
  let place: Side['place'] = null;
  if (boards) {
    place = { combined: placementOn(boards, 'combined', m.id), coding: placementOn(boards, 'coding', m.id), reasoning: placementOn(boards, 'reasoning', m.id), tooling: placementOn(boards, 'tooling', m.id) };
  }
  return {
    m, name: m.displayName, slug: m.slug, vendor: vendorOfModel(m), place, price: listPrice(m),
    coding: priceRowFor(price, 'coding', m.numericId),
    reasoning: priceRowFor(price, 'reasoning', m.numericId),
    tooling: priceRowFor(price, 'tooling', m.numericId),
    drift,
  };
}

/* ───────────────────────── formatting ───────────────────────── */

export const fmtScore = (score: number, se: number | null): string =>
  `${Number.isInteger(score) ? score : score.toFixed(1)}${se !== null && Number.isFinite(se) ? ` ± ${se.toFixed(1)}` : ''}`;

/** "joint 3rd of 19" / "not ranked". */
export const placeShort = (p: Placement): string =>
  p.kind === 'ranked' && p.place !== null ? `${p.joint ? 'joint ' : ''}${ordinal(p.place)} of ${p.rankedCount}` : 'not ranked';

/** "$4", "$1.32", "$0.10". */
export const usd = (n: number): string => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
export const pricePair = (p: { input: number; output: number }): string => `${usd(p.input)} in / ${usd(p.output)} out`;

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const and = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const or = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);
const pts = (n: number): string => {
  const v = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return v === '1' ? '1 point' : `${v} points`;
};
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const word = (n: number): string => WORDS[n] ?? String(n);

/* ───────────────────────── board comparison ───────────────────────── */

export type Leader = 'a' | 'b' | 'tie';
export interface BoardCompare {
  key: BoardKey;
  a: Placement | null;
  b: Placement | null;
  /**
   * Who leads, when both are ranked. The leaderboard's tie rule (lib/board-ranks.ts): a gap beyond
   * 1.96 × the combined standard error is a lead; within it, or when the two share a place on the
   * board, a statistical tie.
   */
  leader: Leader | null;
  /** a − b, when both are ranked. */
  diff: number | null;
}

/** 1.96 × the combined standard error: the gap a lead must clear, as lib/board-ranks.ts ranks the boards. */
export const noiseOf = (pa: Placement, pb: Placement): number => 1.96 * Math.hypot(pa.se ?? 0, pb.se ?? 0);

/** True when one ranked placement measurably leads the other: different places and a gap beyond the noise. */
export function pairLead(pa: Placement, pb: Placement): boolean {
  if (pa.score === null || pb.score === null) return false;
  if (pa.place !== null && pa.place === pb.place) return false;
  return Math.abs(pa.score - pb.score) > noiseOf(pa, pb);
}

export function compareBoard(a: Side, b: Side, key: BoardKey): BoardCompare {
  const pa = a.place?.[key] ?? null;
  const pb = b.place?.[key] ?? null;
  if (!pa || !pb || pa.kind !== 'ranked' || pb.kind !== 'ranked' || pa.score === null || pb.score === null) {
    return { key, a: pa, b: pb, leader: null, diff: null };
  }
  const diff = pa.score - pb.score;
  const leader: Leader = pairLead(pa, pb) ? (diff > 0 ? 'a' : 'b') : 'tie';
  return { key, a: pa, b: pb, leader, diff };
}

export type Compares = Record<BoardKey, BoardCompare>;

export function compareAll(a: Side, b: Side): Compares {
  const out = {} as Compares;
  for (const k of BOARD_KEYS) out[k] = compareBoard(a, b, k);
  return out;
}

/* ───────────────────────── sentences ───────────────────────── */

/** "<name> scores 97 ± 0.7 — joint 1st of the 24 models on the Coding board in the last 24 hours". null when absent. */
export function scoreSentence(s: Side, key: BoardKey): string | null {
  const p = s.place?.[key];
  if (!p || p.kind === 'absent' || p.score === null) return null;
  const label = boardLabel(key);
  if (p.kind === 'ranked' && p.place !== null) {
    return `${s.name} scores ${fmtScore(p.score, p.se)} — ${p.joint ? 'joint ' : ''}${ordinal(p.place)} of the ${p.rankedCount} models on the ${label} board ${WINDOW_24H}`;
  }
  return `${s.name} is not ranked on the ${label} board ${WINDOW_24H}`;
}

/** Both score sentences plus the lead-or-tie conclusion for one board; '' when neither side has data. */
export function suiteParagraph(a: Side, b: Side, c: BoardCompare): string {
  const parts = [scoreSentence(a, c.key), scoreSentence(b, c.key)].filter((s): s is string => !!s).map((s) => `${s}.`);
  if (c.leader && c.diff !== null) {
    const w = (SUITE_WORD as Record<string, string>)[c.key] ?? boardLabel(c.key).toLowerCase();
    const gap = Math.abs(c.diff);
    if (c.leader === 'tie') {
      const apart = c.a?.place !== null && c.b?.place !== null && c.a?.place !== c.b?.place;
      parts.push(gap === 0
        ? `They score the same: a statistical tie on ${w}.`
        : apart
          ? `The gap of ${pts(gap)} is within the measurement noise, so head to head the two are a statistical tie on ${w}; the board places them apart because a place is set against the leader of the group above, not against the other model.`
          : `The gap of ${pts(gap)} is within the measurement noise, so the two are a statistical tie on ${w}.`);
    } else {
      parts.push(`The gap of ${pts(gap)} is beyond the measurement noise, so ${(c.leader === 'a' ? a : b).name} leads on ${w}.`);
    }
  }
  return parts.join(' ');
}

/** Pass rate on the coding tasks over the last 30 days, when both sides have one. */
export function passRateSentence(a: Side, b: Side): string | null {
  if (!a.coding || !b.coding) return null;
  return `${cap(WINDOW_30D)}, ${a.name} passed ${pct(a.coding.passRate)} of its coding attempts and ${b.name} ${pct(b.coding.passRate)}.`;
}

function priceClause(a: Side, b: Side): string | null {
  if (!a.price || !b.price) return null;
  if (a.price.blended < b.price.blended) return `${a.name} is cheaper per million tokens`;
  if (b.price.blended < a.price.blended) return `${b.name} is cheaper per million tokens`;
  return 'both list at the same price per million tokens';
}

/**
 * The one-sentence verdict under the H1, from the three suites and the list price:
 * "<A> leads on coding and tool use; reasoning is a statistical tie; <B> is cheaper per million tokens."
 */
export function verdict(a: Side, b: Side, cmp: Compares): string {
  const lead = (who: Leader) => SUITES.filter((s) => cmp[s].leader === who).map((s) => SUITE_WORD[s]);
  const aL = lead('a');
  const bL = lead('b');
  const ties = lead('tie');
  const clauses: string[] = [];
  if (aL.length) clauses.push(`${a.name} leads on ${and(aL)}`);
  if (bL.length) clauses.push(`${b.name} leads on ${and(bL)}`);
  if (ties.length) clauses.push(ties.length === 1 ? `${ties[0]} is a statistical tie` : `${and(ties)} are statistical ties`);
  const pc = priceClause(a, b);
  if (pc) clauses.push(pc);
  if (!clauses.length) return `${a.name} and ${b.name} are tested on the same coding, reasoning and tool-use tasks on the same schedule.`;
  return `${cap(clauses[0])}${clauses.slice(1).map((c) => `; ${c}`).join('')}.`;
}

/** List prices, the blended ratio, and cost per correct answer over the last 30 days. */
export function priceParagraph(a: Side, b: Side): string[] {
  const out: string[] = [];
  if (a.price && b.price) {
    out.push(`${a.name} lists at ${pricePair(a.price)} per 1M tokens; ${b.name} at ${pricePair(b.price)}.`);
    const [cheap, dear] = a.price.blended <= b.price.blended ? [a, b] : [b, a];
    const ratio = cheap.price!.blended > 0 ? dear.price!.blended / cheap.price!.blended : 1;
    out.push(ratio >= 1.05
      ? `On a 40/60 input–output blend, ${dear.name} costs about ${times(ratio)} as much per token as ${cheap.name}.`
      : 'On a 40/60 input–output blend the two list at the same price.');
  }
  if (a.coding?.costPerSuccess != null && b.coding?.costPerSuccess != null) {
    out.push(`${cap(WINDOW_30D)}, 1,000 correct coding answers cost about ${per1k(a.coding.costPerSuccess)} with ${a.name} and ${per1k(b.coding.costPerSuccess)} with ${b.name}, every attempt billed, failed ones included.`);
  }
  return out;
}

/** Median response times over the last 30 days: coding first, then the two daily suites. */
export function speedParagraph(a: Side, b: Side): string[] {
  const out: string[] = [];
  if (a.coding?.medianMs != null && b.coding?.medianMs != null) {
    out.push(`Median response time on the coding tasks ${WINDOW_30D}: ${a.name} ${duration(a.coding.medianMs)}, ${b.name} ${duration(b.coding.medianMs)}.`);
    const [fast, slow] = a.coding.medianMs <= b.coding.medianMs ? [a, b] : [b, a];
    const ratio = fast.coding!.medianMs! > 0 ? slow.coding!.medianMs! / fast.coding!.medianMs! : 1;
    out.push(ratio >= 1.2 ? `${fast.name} answers about ${times(ratio)} faster.` : 'The two are close.');
  }
  const rest: string[] = [];
  if (a.reasoning?.medianMs != null && b.reasoning?.medianMs != null) rest.push(`on the reasoning sessions ${duration(a.reasoning.medianMs)} against ${duration(b.reasoning.medianMs)}`);
  if (a.tooling?.medianMs != null && b.tooling?.medianMs != null) rest.push(`on the tool-use sessions ${duration(a.tooling.medianMs)} against ${duration(b.tooling.medianMs)}`);
  if (rest.length) out.push(`${cap(and(rest))} (${a.name} first).`);
  return out;
}

/** Per-suite Page-Hinkley state of one side: the suites with an open detection, and those armed with none. */
export function driftState(s: Side): { fired: string[]; armed: string[] } {
  const ph = s.drift?.pageHinkleyBySuite ?? {};
  const fired = SUITES.filter((k) => ph[DRIFT_SUITE[k]]?.fired).map((k) => SUITE_WORD[k]);
  const armed = SUITES.filter((k) => ph[DRIFT_SUITE[k]]?.armed && !ph[DRIFT_SUITE[k]]?.fired).map((k) => SUITE_WORD[k]);
  return { fired, armed };
}

export const trendOf = (s: Side): string | null => s.place?.combined?.trend ?? s.place?.coding?.trend ?? null;

/** "<name> is holding steady on the 24-hour board; no Page-Hinkley detection on coding, reasoning or tool use." */
export function driftSentence(s: Side): string | null {
  const bits: string[] = [];
  const trend = trendOf(s);
  if (trend) bits.push(`${s.name} is ${trendWord(trend)} on the 24-hour board`);
  const { fired, armed } = driftState(s);
  if (fired.length) bits.push(`a Page-Hinkley detection is open on ${and(fired)}`);
  else if (armed.length) bits.push(`no Page-Hinkley detection on ${or(armed)}`);
  if (!bits.length) return null;
  return `${cap(bits.join('; '))}.`;
}

/** The short drift cell of the at-a-glance table: "Holding steady · no detection". */
export function driftCell(s: Side): { main: string; sub: string | null } | null {
  const trend = trendOf(s);
  const { fired, armed } = driftState(s);
  if (!trend && !fired.length && !armed.length) return null;
  return {
    main: trend ? cap(trendWord(trend)) : fired.length ? 'Detection open' : 'No detection',
    sub: fired.length ? `detection open on ${and(fired)}` : armed.length ? `no detection on ${and(armed)}` : null,
  };
}

/* ───────────────────────── choose A when / choose B when ───────────────────────── */

export interface ChooseWhen { a: string[]; b: string[] }

/** Bullets from the differences that clear a threshold: a board lead beyond the noise, 10% on price, 20% on time or cost. */
export function chooseWhen(a: Side, b: Side, cmp: Compares): ChooseWhen {
  const out: ChooseWhen = { a: [], b: [] };
  for (const s of SUITES) {
    const c = cmp[s];
    if (c.leader !== 'a' && c.leader !== 'b') continue;
    const [win, lose] = c.leader === 'a' ? [a, b] : [b, a];
    const pw = win.place![s];
    const pl = lose.place![s];
    out[c.leader].push(`the work is ${SUITE_WORD[s]}: it leads the ${boardLabel(s)} board by ${pts(Math.abs(c.diff!))} ${WINDOW_24H} (${fmtScore(pw.score!, pw.se)} against ${fmtScore(pl.score!, pl.se)})`);
  }
  if (a.price && b.price && a.price.blended !== b.price.blended) {
    const [cheap, dear, who] = a.price.blended < b.price.blended ? [a, b, 'a' as const] : [b, a, 'b' as const];
    if (dear.price!.blended / cheap.price!.blended >= 1.1) {
      out[who].push(`price per token matters: it lists at ${pricePair(cheap.price!)} per 1M tokens against ${pricePair(dear.price!)}`);
    }
  }
  if (a.coding?.costPerSuccess != null && b.coding?.costPerSuccess != null && a.coding.costPerSuccess !== b.coding.costPerSuccess) {
    const [cheap, dear, who] = a.coding.costPerSuccess < b.coding.costPerSuccess ? [a, b, 'a' as const] : [b, a, 'b' as const];
    if (dear.coding!.costPerSuccess! / cheap.coding!.costPerSuccess! >= 1.2) {
      out[who].push(`cost per correct answer matters: about ${per1k(cheap.coding!.costPerSuccess!)} per 1,000 correct coding answers against ${per1k(dear.coding!.costPerSuccess!)} ${WINDOW_30D}`);
    }
  }
  if (a.coding?.medianMs != null && b.coding?.medianMs != null && a.coding.medianMs !== b.coding.medianMs) {
    const [fast, slow, who] = a.coding.medianMs < b.coding.medianMs ? [a, b, 'a' as const] : [b, a, 'b' as const];
    if (fast.coding!.medianMs! > 0 && slow.coding!.medianMs! / fast.coding!.medianMs! >= 1.2) {
      out[who].push(`response time matters: a median of ${duration(fast.coding!.medianMs)} on the coding tasks against ${duration(slow.coding!.medianMs)} ${WINDOW_30D}`);
    }
  }
  return out;
}

/** The sentence used when no bullet survives the thresholds; without boards it says only what the prices say. */
export function nothingSeparates(a: Side, b: Side): string {
  const pc = priceClause(a, b);
  if (!a.place || !b.place) {
    return `${pc ? `${cap(pc)}; the` : 'The'} boards decide the rest: both models' current places are on the leaderboard. Let the Smart Router switch if the boards move.`;
  }
  const samePrice = !!a.price && !!b.price && a.price.blended === b.price.blended;
  return `${cap(WINDOW_24H)} nothing separates ${a.name} from ${b.name} beyond the measurement noise${pc ? `, and ${pc}` : ''}. ${samePrice ? 'Either will do; let' : 'Choose by price, and let'} the Smart Router switch if the boards move.`;
}

/* ───────────────────────── title, description, related pairs ───────────────────────── */

/**
 * "<A> vs <B>: benchmark comparison (October 2026)", shortened step by step until the whole title
 * fits 60 characters. Two long names ("DeepSeek V4.1 Flash vs Gemini 3.5 Flash Lite") still overrun
 * by a character or two: the names are live and the suffix is pageMeta's, so that is left as is.
 */
export function pairTitle(a: string, b: string, month: string): string {
  const base = `${a} vs ${b}`;
  const variants = [`${base}: benchmark comparison (${month})`, `${base}: benchmark comparison`, `${base}: comparison`, base];
  return variants.find((v) => v.length + TITLE_SUFFIX.length <= TITLE_MAX) ?? base;
}

/** The description, shortened clause by clause until it fits 155 characters. */
export function pairDescription(a: string, b: string): string {
  const head = `${a} vs ${b} on the same coding, reasoning and tool-use tests: scores with statistical ties, price per 1M tokens`;
  const variants = [
    `${head}, speed and drift status, re-tested on a fixed schedule.`,
    `${head}, speed and drift status.`,
    `${head}.`,
  ];
  return variants.find((v) => v.length <= DESC_MAX) ?? clampDesc(variants[variants.length - 1]);
}

export interface RelatedPair { slug: string; label: string }

/** The version-free part of a model name: claude-opus-5-5 → claude-opus, gpt-6.1-sol → gpt-sol. */
const lineOf = (m: SeoModel): string => m.name.toLowerCase().replace(/[\d.]+/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');

/** The previous and next version on the same line; the best-placed sibling when the line has no other member. */
function adjacentVersions(m: SeoModel, siblings: SeoModel[]): SeoModel[] {
  const line = siblings.filter((x) => lineOf(x) === lineOf(m));
  if (!line.length) return siblings.slice(0, 1);
  const sorted = [...line, m].sort(byDisplayName);
  const i = sorted.findIndex((x) => x.id === m.id);
  return [sorted[i - 1], sorted[i + 1]].filter((x): x is SeoModel => !!x);
}

/** Each model's two nearest neighbours by combined score and its same-vendor previous/next version, as pair links. */
export function relatedPairs(a: SeoModel, b: SeoModel, roster: SeoModel[], boards: SeoBoards | null): RelatedPair[] {
  const out = new Map<string, RelatedPair>();
  const current = pairSlug(a, b);
  const add = (x: SeoModel, y: SeoModel) => {
    if (x.id === y.id) return;
    const slug = pairSlug(x, y);
    if (slug === current || out.has(slug)) return;
    const [p, q] = x.slug <= y.slug ? [x, y] : [y, x];
    out.set(slug, { slug, label: `${p.displayName} vs ${q.displayName}` });
  };
  for (const [m, other] of [[a, b], [b, a]] as const) {
    const rel = relatedModels(m, roster, boards);
    for (const x of rel.nearest.filter((x) => x.id !== other.id).slice(0, 2)) add(m, x);
    for (const x of adjacentVersions(m, rel.siblings)) add(m, x);
  }
  return Array.from(out.values());
}

/** "22 Sep 2026" for the "Tracked since" row; null without a date. */
export const trackedSince = (m: SeoModel): string | null => (m.createdAt ? dayLabel(m.createdAt) : null);
