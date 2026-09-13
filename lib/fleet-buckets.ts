/**
 * One definition of a model's status, used by everything that counts or marks it.
 *
 * The summary bar, the STUPID/SMART meter and the leaderboard row each used to decide this
 * for themselves, and they disagreed in public: the bar counted 21 stable + 3 volatile + 3
 * recovering on a fleet of 24 because "stable" and "recovering" both counted trend 'up'; the
 * meter reported a top-weighted mean that read 80 beside an index of 78; and the board marked
 * two models as high-variance while the bar said one was volatile.
 *
 * Exported from one place so they cannot drift apart again.
 */

export type FleetBucket = 'volatile' | 'degraded' | 'improving' | 'stable';

/**
 * Standard error at which a model's score is too noisy to read a trend from.
 * Fleet median is around 3 points; this is the noisy tail.
 */
export const VOLATILE_STANDARD_ERROR = 8;

export interface BucketableModel {
  trend?: string;
  standardError?: number;
  currentScore?: number | string;
}

export function isVolatile(m: BucketableModel): boolean {
  return typeof m.standardError === 'number' && m.standardError >= VOLATILE_STANDARD_ERROR;
}

/**
 * Volatility is checked BEFORE direction, deliberately.
 *
 * A model whose score moves +/-8 points between identical runs has not "degraded" when this
 * run happens to be low — the measurement is too noisy to support that claim, and calling it
 * degraded asserts a certainty the data does not have. It also keeps the VOLATILE count equal
 * to the number of rows marked on the board, so a reader told "2 are volatile" can find both.
 */
export function bucketOf(m: BucketableModel): FleetBucket {
  if (isVolatile(m)) return 'volatile';
  if (m.trend === 'down') return 'degraded';
  if (m.trend === 'up') return 'improving';
  return 'stable';
}

/** Trend of what is on screen, rather than of a fixed 24-hour combined window. */
export function fleetTrend(models: BucketableModel[]): 'improving' | 'declining' | 'stable' {
  const risers = models.filter(m => bucketOf(m) === 'improving').length;
  const fallers = models.filter(m => bucketOf(m) === 'degraded').length;
  return fallers > risers ? 'declining' : risers > fallers ? 'improving' : 'stable';
}
