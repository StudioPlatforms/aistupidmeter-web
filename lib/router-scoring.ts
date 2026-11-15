import type { TieBreak } from './api-client';

/**
 * How the Smart Router scores models right now, as the API reports it, and the copy that describes it.
 *
 * The API's A1 release adds two flags it switches without a restart (adaptive-routing plan §2.3, §8.8, D26):
 * - router.estimator: `v1`, a model ranks on the mean of its last five results; `v2`, on a weighted mean of
 *   its recent results, the newest weighted most. v2 also counts two benchmark latencies within 10% as equal
 *   (the higher score decides) and keeps a model already routed to under "Highest score" while it is within
 *   one standard error of the leader;
 * - router.tie_band: `wide`, "Cheaper" and "Faster" choose among every model statistically tied with the
 *   leader; `narrow`, among the models within one standard error of the leader.
 * It reports them as `scoring: { estimator, tieBand }` on GET /router/preferences and at the top of
 * GET /dashboard/landing. Pages that have one of those answers word themselves on it, so the text never
 * runs ahead of or behind the router; an answer without it is an API before A1, which scores as today
 * (v1, wide), and then every sentence here is today's, character for character.
 *
 * Pages with no API answer (/router/docs, lib/integrations) use wording true under every combination.
 *
 * A score comes from benchmark results.
 */
export type Estimator = 'v1' | 'v2';
export type TieBand = 'wide' | 'narrow';
export interface RouterScoring { estimator: Estimator; tieBand: TieBand }

/** Today's scoring, and what an answer without `scoring` means. */
export const SCORING_TODAY: RouterScoring = { estimator: 'v1', tieBand: 'wide' };

/** The API's `scoring`, read flag by flag: a missing or unknown value is today's. */
export function scoringOf(raw: unknown): RouterScoring {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { estimator: o.estimator === 'v2' ? 'v2' : 'v1', tieBand: o.tieBand === 'narrow' ? 'narrow' : 'wide' };
}

const today = (s: RouterScoring) => s.estimator === 'v1' && s.tieBand === 'wide';
const BAND = 'Among the models within one standard error of the leader';

/**
 * Which earlier picks stay under v1, in either band: only "Cheaper" and "Faster" keep a model the caller was already
 * routed to, while it is within 2.58 standard errors of the leader (unless the tie-break's own choice is much better
 * and within one standard error); "Highest score" keeps none (API selector `by !== 'highest' && incumbent`). "Close
 * to the leader" rather than "tied": the keep reaches past the 1.96 tie.
 */
const KEEP_V1 = 'A conversation stays on the model that answered it, and with Cheaper or Faster a model you were already routed to stays while it is still close to the leader, so the pick does not change with every new run.';

/**
 * v2's rule for the fastest good model (fastest_quality, auto-fastest-quality), in one phrasing wherever a page has the
 * router's `scoring` (plan §2.3; the selector's orderForCaller with v2's majority guard): benchmark latency is compared
 * only on at least 21 runs, two within 10% of each other count as equal and the higher score decides, and when fewer
 * than half of the near-top models have that many runs they are ordered by score. It follows ", " after what the
 * sentence ranks on; "these models" are the near-top models that sentence names.
 */
const FASTEST_QUALITY_V2 = 'compared on at least 21 runs; response times within 10% of each other count as equal, and the higher score decides. When fewer than half of these models have 21 runs, they are ordered by score.';

/* ── Routing preferences, "When models are tied" (app/router/preferences/page.tsx; plan §5.2) ───── */

/** The pane's sub. It speaks of the estimate and of what a tie is, not of the band. */
export function tiePaneSub(s: RouterScoring): string {
  return s.estimator === 'v2'
    ? 'Models rank on a weighted mean of their recent results, newest weighted most. Two are tied when the gap between them is smaller than the tests can confirm at 95% confidence.'
    : 'Models rank on the average of their last five benchmark results. Two models are tied when the gap between them is smaller than the measurement can confirm (95%), the same rule the leaderboard\'s “=” ranks use.';
}

/** Each tie-break's description: the band follows tie_band (Cheaper, Faster), the 10% latency rule and Highest's keep follow v2. */
export function tieBreakDesc(id: TieBreak, s: RouterScoring): string {
  const narrow = s.tieBand === 'narrow';
  if (id === 'cheaper') {
    if (narrow) return `${BAND}, the one with the lowest measured cost per task.`;
    return s.estimator === 'v2'
      ? 'Within the measurement margin of the leader, the one with the lowest measured cost per task.'
      : 'The one that cost least per task in our measurements. The same quality as far as the tests can tell, for less.';
  }
  if (id === 'faster') {
    if (s.estimator === 'v2') {
      return `${narrow ? BAND : 'Within the measurement margin of the leader'}, the one with the lowest median latency on the benchmark tasks; latencies within 10% count as equal.`;
    }
    return narrow
      ? `${BAND}, the one with the lowest measured latency on the same benchmark tasks.`
      : 'The one with the lowest measured latency on the same benchmark tasks.';
  }
  return s.estimator === 'v2'
    ? 'The leader, even when its lead is within the measurement margin. A model you were already routed to stays while it is within one standard error of the leader. On our records the leader scored higher than the cheapest tied model on later runs, on average; it usually costs more per task.'
    : 'The one with the highest average score, even when its lead is smaller than the measurement can confirm.';
}

/**
 * What follows the description in the pane's hint. Plan §5.2's hint ends "Within a conversation, Model
 * switching decides", a pane that arrives with A2; until then a conversation stays on the model that
 * answered it, as today's hint says. "Highest score" keeps a model across conversations only under v2,
 * where its own description says so. With today's flags (v1, wide) the hint is one sentence for all three
 * tie-breaks, as on main, and it names the two that keep a pick (KEEP_V1, the /router ties row's own words).
 */
export function tieHint(id: TieBreak, s: RouterScoring): string {
  if (today(s)) return KEEP_V1;
  if (id === 'highest') return 'A conversation stays on the model that answered it.';
  return 'A conversation stays on the model that answered it. Across conversations, a model you were already routed to stays while it is still within the margin, so the pick does not change with every new run.';
}

/* ── /router for visitors (components/seo/router/RouterLanding.tsx), from the landing snapshot ──── */

/**
 * The API's selector (v1): a quality mode ranks on the mean of a model’s last five scored runs (a tie needs three of
 * them). Moved here from RouterLanding.
 */
const RUNS_AVERAGED = 5;

/** The FAQ answer "How does the Smart Router choose a model?": its three scoring sentences. */
export function landingFaqScoring(s: RouterScoring): { average: string; tie: string; fastestQuality: string } {
  return {
    average: s.estimator === 'v2'
      ? 'A quality mode uses a weighted mean of a model’s recent results, newest weighted most, never one run.'
      : `A quality mode uses the average of a model’s last ${RUNS_AVERAGED} scored runs, never one run.`,
    tie: s.tieBand === 'narrow'
      ? 'Leaders closer than 1.96 times their combined standard error are a statistical tie, and your tie-break decides: cheapest per task by default, or fastest, among the models within one standard error of the leader, or highest.'
      : 'Leaders closer than 1.96 times their combined standard error are a statistical tie, and your tie-break decides: cheapest per task by default, or fastest, or highest.',
    fastestQuality: s.estimator === 'v2'
      ? `auto-fastest-quality takes the lowest median response time among them, ${FASTEST_QUALITY_V2}`
      : 'auto-fastest-quality takes the lowest median response time among them.',
  };
}

/** The "How does the Smart Router decide" section lead: its first clause. */
export function landingLeadScoring(s: RouterScoring): string {
  return s.estimator === 'v2'
    ? 'A quality mode ranks on a weighted mean of a model’s recent results on that suite, newest weighted most, never on one run'
    : `A quality mode ranks on the average of a model’s last ${RUNS_AVERAGED} scored runs of that suite, never on one run`;
}

/** The "Statistical ties, your tie-break" row, up to "The rule is on the methodology page." */
export function landingTieRow(s: RouterScoring): string {
  const tied = 'When the leaders are closer than 1.96 times their combined standard error, the test behind the leaderboard’s “=” places, they are tied, and your tie-break in Preferences decides:';
  const v2 = s.estimator === 'v2';
  const fastest = v2 ? 'the fastest (latencies within 10% count as equal)' : 'the fastest';
  const highest = v2 ? 'the highest score' : 'the highest average';
  const decides = s.tieBand === 'narrow'
    ? `among the models within one standard error of the leader, the one that cost least per task in our runs (the default) or ${fastest}; or ${highest}.`
    : `the one that cost least per task in our runs (the default), ${fastest}, or ${highest}.`;
  // Under v1 "Highest score" keeps no earlier pick; under v2 it keeps one within one standard error.
  const keep = v2
    ? 'A conversation stays on the model that answered it, and across conversations a model you were already routed to stays while it is still close to the leader, so the pick does not change with every new run.'
    : KEEP_V1;
  return `${tied} ${decides} ${keep}`;
}

/* ── The default tie-break on the public explorer (components/landing/RouterExplorer.tsx: home and /router) ── */

/**
 * The Best quality modes' "Ordered by" and auto-best's description, for a visitor's default tie-break ("Cheaper").
 * With the wide band it takes the cheapest of every model statistically tied with the leader; with the narrow band
 * (D26) the cheapest of those within one standard error of the leader, so "the cheaper of tied leaders" would no
 * longer be true. v2 changes neither ("cheaper" orders a tie as v1 does).
 */
export function explorerQuality(s: RouterScoring): { order: string; bestDesc: string } {
  return s.tieBand === 'narrow'
    ? {
      order: 'Quality, then the cheaper of the models within one standard error of the leader',
      bestDesc: `The best combined score among the models you have keys for. ${BAND}, the one that costs less.`,
    }
    : {
      order: 'Quality, then the cheaper of tied leaders',
      bestDesc: 'The best combined score among the models you have keys for. When leaders are statistically tied, the one that costs less.',
    };
}

/* ── The fastest good model (fastest_quality, auto-fastest-quality) ──────────────────────────────── */

/*
 * v1: the fastest of the near-top models (within 5 points of the best) on measured benchmark latency, the median of
 * the last 7 days on at least 5 runs. v2: FASTEST_QUALITY_V2, the same words in every sentence below and in the /router
 * FAQ. Pages without the router's `scoring` say "one of the fastest", true of both.
 */

/** The Routing preferences card: its description and its "Ranks on" line. */
export function fastestQualityCard(s: RouterScoring): { desc: string; basis: string } {
  const basis = 'Measured latency, among models within 5 points of your best';
  return s.estimator === 'v2'
    ? { desc: `The fastest of the near-top models, on measured latency only, ${FASTEST_QUALITY_V2}`, basis }
    : { desc: 'The fastest of the near-top models, on measured latency only.', basis };
}

/** The public explorer's description of auto-fastest-quality. */
export function explorerFastestQuality(s: RouterScoring): string {
  return s.estimator === 'v2'
    ? `The fastest measured model among those within 5 points of the best, ${FASTEST_QUALITY_V2} Never ranks on estimates.`
    : 'The fastest measured model among those within 5 points of the best. Never ranks on estimates.';
}

/** /router's modes table, the auto-fastest-quality row ("Ranks on"); `floor` is the near-top bar in points. */
export function landingFastestQualityRow(s: RouterScoring, floor: number): string {
  const rule = `Within ${floor} points of the best Combined score, then the lowest median response time over each model’s most recent week of benchmark runs`;
  return s.estimator === 'v2'
    ? `${rule}, ${FASTEST_QUALITY_V2}`
    : `${rule}.`;
}

/* ── /ai-router (app/ai-router/page.tsx and its live picks, components/seo/routers/RouterBlocks.tsx) ── */

/** The "Modes that name a job" row's last sentence: who decides a statistical tie, and among which models. */
export function aiRouterTieSentence(s: RouterScoring): string {
  return s.tieBand === 'narrow'
    ? 'A statistical tie goes to your tie-break, cheapest per task by default, among the models within one standard error of the leader.'
    : 'A statistical tie goes to your tie-break, cheapest per task by default.';
}

/** The live picks table's "Ranks on" cell for auto-fastest-quality; `floor` is the near-top bar in points. */
export function livePicksFastestQuality(s: RouterScoring, floor: number): string {
  const rule = `Within ${floor} points of the best Combined score, the lowest median response time`;
  return s.estimator === 'v2' ? `${rule}, ${FASTEST_QUALITY_V2}` : `${rule}.`;
}
