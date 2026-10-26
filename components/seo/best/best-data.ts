import type { BoardKey, BoardRow } from '@/lib/boards-core';
import { modelSlug } from '@/lib/model-slug';
import {
  boardLabel, ordinal, placementOn, placementSentence, priceRowFor, topOfBoard, vendorByKey, vendorKeyOf,
  type Placement, type PriceCodingRow, type PriceSnapshot, type SeoBoards, type SeoModel,
} from '@/lib/seo-data';
import { duration, per1k, pct, times } from '@/components/landing/price-format';
import type { BestCategory } from './best-config';

/**
 * Everything a best-for page says, computed from the data it fetched: the 24-hour boards (with
 * the leaderboard's statistical ties) for the coding, reasoning and tool-use pages, and the price
 * snapshot's rolling window for the value and speed pages. Pure functions, no fetch, no React.
 * Every sentence degrades to null (never to a placeholder) when the figure behind it is missing.
 *
 * Wording rules: visitor-facing scores are "on the 24-hour board"; cost and time are "over the
 * last N days"; a lead is claimed only beyond the measurement noise; ranks come from
 * lib/boards-core, never from a row's index.
 */

/** The near-top bar: the router's VALUE_FLOOR_POINTS and the methodology's "within five points of the top". */
export const NEAR_TOP_POINTS = 5;
/** The same bar on a 0–1 pass rate, used only when the boards feed is down. */
export const NEAR_TOP_PASS_RATE = 0.05;

export const WINDOW_24H = 'in the last 24 hours';

export interface Entry { row: BoardRow; placement: Placement }

export const fmtScore = (score: number, se: number | null): string =>
  `${Number.isInteger(score) ? score : score.toFixed(1)}${se !== null && Number.isFinite(se) ? ` ± ${se.toFixed(1)}` : ''}`;

/** "98 ± 0.7", or '' when the placement has no score. */
export const scoreText = (p: Placement): string => (p.score === null ? '' : fmtScore(p.score, p.se));

/** "joint 3rd of 19" / "not ranked". */
export const placeShort = (p: Placement): string =>
  p.kind === 'ranked' && p.place !== null ? `${p.joint ? 'joint ' : ''}${ordinal(p.place)} of ${p.rankedCount}` : 'not ranked';

export const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
export const and = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const pts = (n: number): string => {
  const v = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return v === '1' ? '1 point' : `${v} points`;
};

/** The company as the tables write it: OpenAI, Anthropic, Google, DeepSeek, Moonshot AI, Z.ai. */
export const companyOf = (provider: string | null | undefined, fallback = ''): string =>
  vendorByKey(String(provider ?? ''))?.label ?? fallback;

/** The product family a model belongs to, for "Claude leads": GPT, Claude, Gemini, DeepSeek, Kimi, GLM. */
export const familyOf = (provider: string | null | undefined): string | null =>
  vendorByKey(String(provider ?? ''))?.family ?? null;

/* ───────────────────────── board pages ───────────────────────── */

/** The first `n` ranked rows of a board with their placements, in board order. */
export const boardTop = (boards: SeoBoards, key: BoardKey, n: number): Entry[] => topOfBoard(boards, key, n);

/** Every model sharing first place on a board (one entry when the leader stands alone). */
export function leadersOf(boards: SeoBoards, key: BoardKey): Entry[] {
  const out: Entry[] = [];
  for (const row of boards.boards[key].ranked) {
    const placement = placementOn(boards, key, row.id);
    if (placement.place !== 1) break;
    out.push({ row, placement });
  }
  return out;
}

/**
 * The second ranked row: the model listed next on the board, inside the leaders' tie when there
 * is one. For pair links, and for the lead sentence when the leader stands alone.
 */
export function runnerUpOf(boards: SeoBoards, key: BoardKey): Entry | null {
  const next = boards.boards[key].ranked[1];
  return next ? { row: next, placement: placementOn(boards, key, next.id) } : null;
}

/**
 * "<name> leads: 1st of the 24 models on the Coding board in the last 24 hours, scoring 98 ± 0.7."
 * or "<A>, <B> and <C> share first place: joint 1st of the 24 models on the Reasoning board in the
 * last 24 hours, each within the measurement noise of the leader (…)." A tie wider than three
 * names only its two ends, so the line under the H1 stays a line.
 */
export function boardVerdict(boards: SeoBoards, key: BoardKey): string | null {
  const leaders = leadersOf(boards, key);
  if (!leaders.length) return null;
  const label = boardLabel(key);
  if (leaders.length === 1) {
    const { row, placement } = leaders[0];
    return `${row.label} leads: ${placementSentence(placement, label)}${placement.score !== null ? `, scoring ${scoreText(placement)}` : ''}.`;
  }
  const place = placementSentence(leaders[0].placement, label);
  if (leaders.length <= 3) {
    const names = and(leaders.map((e) => e.row.label));
    const scores = leaders.map((e) => `${e.row.label} ${scoreText(e.placement)}`).join(', ');
    return `${names} share first place: ${place}, each within the measurement noise of the leader (${scores}).`;
  }
  const first = leaders[0];
  const last = leaders[leaders.length - 1];
  return `${leaders.length} models share first place — ${place} — from ${first.row.label} (${scoreText(first.placement)}) to ${last.row.label} (${scoreText(last.placement)}), none of them measurably behind the leader.`;
}

/** The best-placed ranked model of one vendor on a board. */
export function familyBest(boards: SeoBoards, key: BoardKey, vendorKey: string): Entry | null {
  const row = boards.boards[key].ranked.find((r) => vendorKeyOf(r.provider) === vendorKey);
  return row ? { row, placement: placementOn(boards, key, row.id) } : null;
}

export interface FamilyCompare {
  a: Entry | null;
  g: Entry | null;
  text: string;
}

/**
 * "Is Claude better than GPT for coding?", answered from each family's best-placed model on the
 * board: a shared place is a tie; otherwise a lead is claimed only beyond max(seA, seB), the same
 * rule the pair pages use.
 */
export function claudeVsGptOnBoard(boards: SeoBoards, key: BoardKey, x: string): FamilyCompare {
  const a = familyBest(boards, key, 'anthropic');
  const g = familyBest(boards, key, 'openai');
  const label = boardLabel(key);
  if (!a || !g) {
    const missing = !a && !g ? 'Neither a Claude nor a GPT model' : !a ? 'No Claude model' : 'No GPT model';
    const present = a ?? g;
    return {
      a, g,
      text: `${missing} is ranked on the ${label} board ${WINDOW_24H}${present ? `; the best-placed ${a ? 'Claude' : 'GPT'} model is ${present.row.label}, ${placeShort(present.placement)}, scoring ${scoreText(present.placement)}` : ''}.`,
    };
  }
  const lead = `On the ${label} board ${WINDOW_24H}, the best-placed Claude model is ${a.row.label} (${placeShort(a.placement)}, ${scoreText(a.placement)}) and the best-placed GPT model is ${g.row.label} (${placeShort(g.placement)}, ${scoreText(g.placement)}).`;
  const sa = a.placement.score;
  const sg = g.placement.score;
  if (sa === null || sg === null) return { a, g, text: lead };
  if (a.placement.place !== null && a.placement.place === g.placement.place) {
    return { a, g, text: `${lead} They share a place, so neither family leads on ${x}: a statistical tie.` };
  }
  const gap = Math.abs(sa - sg);
  const noise = Math.max(a.placement.se ?? 0, g.placement.se ?? 0);
  if (gap <= noise) {
    return { a, g, text: `${lead} The gap of ${pts(gap)} is within the measurement noise, so the two are a statistical tie on ${x}.` };
  }
  const winner = sa > sg ? 'Claude' : 'GPT';
  return { a, g, text: `${lead} The gap of ${pts(gap)} is beyond the measurement noise, so ${winner} leads on ${x} in this window.` };
}

/** The leader's lead over the runner-up, for "does it change week to week": a tie, or a gap inside or beyond the noise. */
export function leadSentence(boards: SeoBoards, key: BoardKey): string | null {
  const leaders = leadersOf(boards, key);
  const label = boardLabel(key);
  if (!leaders.length) return null;
  if (leaders.length > 1) {
    return `On the ${label} board ${WINDOW_24H}, ${leaders.length} models share first place: the measurement cannot separate them, and the one listed first could be listed last after the next run without anything having changed.`;
  }
  const next = runnerUpOf(boards, key);
  const lp = leaders[0].placement;
  if (!next || lp.score === null || next.placement.score === null) return null;
  const gap = lp.score - next.placement.score;
  if (next.row.note) {
    // A row graded on fewer tasks keeps its own place whatever the gap, so no claim about the noise.
    return `On the ${label} board ${WINDOW_24H}, ${leaders[0].row.label} ${gap > 0 ? `is ${pts(gap)} ahead of` : 'is level with'} ${next.row.label}, which was graded on fewer tasks (${next.row.note}) and so keeps a place of its own rather than being called tied.`;
  }
  return `On the ${label} board ${WINDOW_24H}, ${leaders[0].row.label} is ${pts(gap)} ahead of ${next.row.label}, a gap beyond the measurement noise, so the order at the top is a real difference rather than a coin toss.`;
}

/* ───────────────────────── price pages ───────────────────────── */

export interface Candidate {
  id: string;
  name: string;
  slug: string;
  /** The API's vendor key. */
  vendorKey: string;
  price: PriceCodingRow;
  /** The model's row and place on the Coding board; null in the pass-rate fallback. */
  row: BoardRow | null;
  placement: Placement | null;
}

export interface NearTop {
  candidates: Candidate[];
  /** How the bar was set: the Coding board's score, or the pass rate when the boards feed is down. */
  basis: 'board' | 'passRate' | null;
  /** The best score (0–100) or pass rate (0–1) the bar was measured from. */
  best: number | null;
  /** The number of days in the price window. */
  days: number;
}

const windowDays = (price: PriceSnapshot | null): number => price?.windowDays ?? 30;

/**
 * The models within five points of the best on the Coding board (24 hours), each with its price
 * row over the window: the group the value and speed pages order. Without the boards, the same
 * bar on the window's pass rate, so the page still answers.
 */
export function nearTop(boards: SeoBoards | null, price: PriceSnapshot | null): NearTop {
  const days = windowDays(price);
  const rows = price?.coding?.models ?? [];
  if (!rows.length) return { candidates: [], basis: null, best: null, days };
  const vendorOf = (r: PriceCodingRow): string => vendorKeyOf(r.vendor);
  if (boards) {
    const board = boards.boards.coding;
    const best = board.ranked[0]?.score ?? null;
    if (best === null) return { candidates: [], basis: null, best: null, days };
    const bar = best - NEAR_TOP_POINTS;
    const candidates: Candidate[] = [];
    for (const row of board.ranked) {
      if (row.score === null || row.score < bar) continue;
      const p = priceRowFor(price, 'coding', row.id);
      if (!p) continue;
      candidates.push({ id: row.id, name: row.label, slug: row.slug, vendorKey: vendorOf(p), price: p, row, placement: placementOn(boards, 'coding', row.id) });
    }
    return { candidates, basis: 'board', best, days };
  }
  const best = Math.max(...rows.map((r) => r.passRate));
  const bar = best - NEAR_TOP_PASS_RATE;
  const candidates = rows
    .filter((r) => r.passRate >= bar)
    .map((p): Candidate => ({ id: String(p.id), name: p.displayName || p.name, slug: modelSlug({ id: p.id, name: p.name }) || String(p.id), vendorKey: vendorOf(p), price: p, row: null, placement: null }));
  return { candidates, basis: 'passRate', best, days };
}

/** The candidates ordered by the page's metric, those without a figure left out. */
export function orderBy(c: Candidate[], metric: 'costPerSuccess' | 'medianMs'): Candidate[] {
  return c
    .filter((x) => x.price[metric] != null && Number.isFinite(x.price[metric] as number))
    .sort((x, y) => (x.price[metric] as number) - (y.price[metric] as number));
}

/** "within five points of the best on the Coding board in the last 24 hours" / "...of the best pass rate over the last 30 days". */
export function barPhrase(nt: NearTop): string {
  return nt.basis === 'passRate'
    ? `within five points of the best pass rate over the last ${nt.days} days`
    : `within five points of the best on the Coding board ${WINDOW_24H}`;
}

/** The metric as a figure: "$0.34 per 1,000 correct coding answers" / "3.6 s". */
export function metricText(c: Candidate, metric: 'costPerSuccess' | 'medianMs'): string {
  return metric === 'costPerSuccess' ? `${per1k(c.price.costPerSuccess as number)} per 1,000 correct coding answers` : duration(c.price.medianMs);
}

/** The verdict under the H1 of a price page. */
export function priceVerdict(ordered: Candidate[], nt: NearTop, metric: 'costPerSuccess' | 'medianMs'): string | null {
  const lead = ordered[0];
  if (!lead) return null;
  const k = nt.candidates.length;
  const group = `the ${k === 1 ? 'one model' : `${k} models`} ${barPhrase(nt)}`;
  if (metric === 'costPerSuccess') {
    return `${lead.name} is the best value: about ${metricText(lead, metric)} over the last ${nt.days} days, every attempt billed, the lowest among ${group}.`;
  }
  return `${lead.name} is the fastest: a median response time of ${metricText(lead, metric)} per coding attempt over the last ${nt.days} days, the lowest among ${group}.`;
}

/** "Is Claude better than GPT for value / speed?", from each family's best candidate by the metric. */
export function claudeVsGptByMetric(ordered: Candidate[], nt: NearTop, metric: 'costPerSuccess' | 'medianMs'): FamilyCompare & { ca: Candidate | null; cg: Candidate | null } {
  const ca = ordered.find((c) => c.vendorKey === 'anthropic') ?? null;
  const cg = ordered.find((c) => c.vendorKey === 'openai') ?? null;
  const what = metric === 'costPerSuccess' ? 'cost per correct answer' : 'median response time';
  if (!ca || !cg) {
    const missing = !ca && !cg ? 'Neither a Claude nor a GPT model' : !ca ? 'No Claude model' : 'No GPT model';
    const present = ca ?? cg;
    return {
      a: null, g: null, ca, cg,
      text: `${missing} is ${barPhrase(nt)}, so none qualifies here${present ? `; the ${ca ? 'Claude' : 'GPT'} model that does is ${present.name}, at ${metricText(present, metric)}` : ''}.`,
    };
  }
  const va = ca.price[metric] as number;
  const vg = cg.price[metric] as number;
  const lead = `Among the models ${barPhrase(nt)}, the ${metric === 'costPerSuccess' ? 'cheapest' : 'fastest'} Claude model is ${ca.name} at ${metricText(ca, metric)} and the ${metric === 'costPerSuccess' ? 'cheapest' : 'fastest'} GPT model is ${cg.name} at ${metricText(cg, metric)}, over the last ${nt.days} days.`;
  if (va === vg) return { a: null, g: null, ca, cg, text: `${lead} The two are level on ${what}.` };
  const [win, lose] = va < vg ? [ca, cg] : [cg, ca];
  const ratio = (lose.price[metric] as number) / Math.max(win.price[metric] as number, 1e-9);
  const winner = win === ca ? 'Claude' : 'GPT';
  const verb = metric === 'costPerSuccess' ? 'cheaper per correct answer' : 'faster';
  return { a: null, g: null, ca, cg, text: `${lead} ${winner} is ${ratio >= 1.05 ? `about ${times(ratio)} ` : 'slightly '}${verb} in this window.` };
}

/* ───────────────────────── shared ───────────────────────── */

/** The roster entry for a board row or candidate, for pair slugs. */
export const rosterModel = (roster: SeoModel[], id: string): SeoModel | null => roster.find((m) => m.id === String(id)) ?? null;

/** "4.2 s" / "93%" for the table cells. */
export const passText = (c: Candidate): string => pct(c.price.passRate);
export const costText = (c: Candidate): string | null => (c.price.costPerSuccess != null ? per1k(c.price.costPerSuccess) : null);
export const msText = (c: Candidate): string | null => (c.price.medianMs != null ? duration(c.price.medianMs) : null);

/** "98 (1st)" / "95 (=4)": a candidate's Coding score and place, for the price tables. */
export function scorePlaceText(c: Candidate): string | null {
  if (!c.placement || c.placement.score === null) return null;
  const p = c.placement;
  const mark = p.kind === 'ranked' && p.place !== null ? `${p.joint ? '=' : ''}${p.place}` : 'not ranked';
  return `${Number.isInteger(p.score) ? p.score : (p.score as number).toFixed(1)} (${mark})`;
}

export type { BestCategory };
