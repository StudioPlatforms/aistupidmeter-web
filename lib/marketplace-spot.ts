/**
 * The spot-check sentence and month names (Phase 3 plan §4.5 row 12, §2.15; M7). Pure, with no import: client
 * components (the provider console, MeasuredScores) and server pages use it alike.
 */

/** The newest published month of spot checks, as the API's DTOs carry it (PublishedScores.spotChecks). */
export interface SpotMonth { month: string; checks: number; consistent: number; inconsistent: number; mdePoints: number | null }

/** "October 2026" for a 'YYYY-MM' month (UTC). */
export const monthName = (m: string): string => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "4 spot checks in October 2026, all consistent; they detect a difference of 1.8 coding points or more". */
export function spotSentence(s: SpotMonth): string {
  const counts = s.checks === 0 ? `No completed spot check in ${monthName(s.month)}`
    : `${s.checks} spot check${s.checks === 1 ? '' : 's'} in ${monthName(s.month)}, ${s.inconsistent === 0 ? (s.checks === 1 ? 'consistent' : 'all consistent') : `${s.consistent} consistent and ${s.inconsistent} not`}`;
  return s.mdePoints === null ? counts : `${counts}; they detect a difference of ${s.mdePoints.toFixed(1)} coding points or more`;
}
