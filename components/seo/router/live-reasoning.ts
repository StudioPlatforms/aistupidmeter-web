import type { LandingSnapshot } from '@/components/landing/types';

/**
 * The live picks as /router shows them (RouterLanding): RouterExplorer prints each pick's reason in
 * a sample X-AISM-Reasoning header, and RankList puts a passed-over model's note in its tag's title.
 *
 * A pick that carries primary.explain (the reason as fields) is shown exactly as sent. An older API's
 * reason text (one that does not send the fields) is shown in the boards' words: "first" for "#1",
 * and the rest as below. The API text itself is never changed, only this page's rendering of it.
 */

/** An older API's reason text, in the boards' words. */
export const scrubReasoning = (t: string): string => t
  .replace(/Ranked #1 of/g, 'Ranked first of')
  .replace(/\bmeasured runs\b/g, 'scored runs')
  .replace(/\bper measured task\b/g, 'per task')
  .replace(/\bper measured dollar\b/g, 'per dollar')
  .replace(/\bLast measured\b/g, 'Last run');

/** The snapshot the page renders: picks with explain as sent, the others with their text in the boards' words. */
export function routerPageSnapshot(snapshot: LandingSnapshot): LandingSnapshot {
  const strategies: LandingSnapshot['strategies'] = {};
  for (const k of Object.keys(snapshot.strategies)) {
    const st = snapshot.strategies[k];
    strategies[k] = st && !st.primary.explain
      ? { ...st, primary: { ...st.primary, reasoning: scrubReasoning(st.primary.reasoning) }, rows: st.rows.map((r) => (r.note ? { ...r, note: scrubReasoning(r.note) } : r)) }
      : st;
  }
  return { ...snapshot, strategies };
}
