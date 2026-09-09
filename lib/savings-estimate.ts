/**
 * The cost-saving figure used in router marketing copy.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The site used to claim "Save 50-70% on AI costs" in sixteen places. Nobody
 * could say where the number came from, and it was not derived from anything we
 * measure. This module replaces it with one figure that is computed from our own
 * data, states its assumptions, and lives in exactly one place so the copy and
 * the methodology cannot drift apart.
 *
 * HOW IT WAS COMPUTED
 * -------------------
 * Reproduce with `src/jobs/verify-savings.ts` in the API repo.
 *
 *   Quality   median hourly-suite score per model over the trailing 120 days,
 *             REAL rows only (synthetic fallback rows excluded), minimum 20
 *             scores per model. 16 models qualified.
 *   Price     lib/model-pricing.ts, the same table the leaderboard price sort
 *             uses. List prices; cache-hit and promotional rates are lower.
 *   Requests  139 input / 678 output tokens — the mean of real benchmark runs,
 *             which are code-generation tasks and therefore output-heavy.
 *   Rule      route to the cheapest model scoring within 1 point of the best
 *             available score.
 *
 * RESULT
 * ------
 * The routed pick cost 90-94% less per request than the five models that scored
 * at least as well as it did. We publish the low end.
 *
 * WHAT IT IS NOT
 * --------------
 * This is measured on our coding benchmark with one token profile, at one
 * moment in list-price history. It is an illustration of the spread between
 * price and measured quality — not a promise about anyone's workload. Copy that
 * uses it must keep it dated and must invite the reader to measure their own.
 */

/** Conservative headline: the low end of the measured range. */
export const SAVINGS_PCT = 90;

/** Month the figure was computed, for dating the claim in copy. */
export const SAVINGS_AS_OF = 'September 2026';

/** Number of models in the comparison set. */
export const SAVINGS_MODEL_COUNT = 16;

/** One-line qualifier that must accompany the number wherever it appears. */
export const SAVINGS_QUALIFIER =
  `Measured on our own coding benchmark across ${SAVINGS_MODEL_COUNT} models, ${SAVINGS_AS_OF}. ` +
  `Your workload will differ — that is what the comparison is for.`;

/** Short form for tight spaces (stat cells, badges). */
export const SAVINGS_SHORT = `~${SAVINGS_PCT}%`;
