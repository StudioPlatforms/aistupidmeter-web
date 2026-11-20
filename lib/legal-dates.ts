/**
 * The "Last updated" days of /privacy and /terms, for the sitemap's lastmod (M12, the web and legal review MINOR-20): the
 * pages' own UPDATED constants say the same day (tests/m12 checks they agree). Change both together, on the deploy day.
 */
export const LEGAL_UPDATED: Readonly<Record<string, string>> = Object.freeze({
  '/privacy': '18 November 2026',
  '/terms': '17 November 2026',
});

/** The day as a Date (midnight UTC), or undefined for a path without one or a day that does not parse. */
export function legalUpdated(path: string): Date | undefined {
  const s = LEGAL_UPDATED[path];
  if (!s) return undefined;
  const d = new Date(`${s} 00:00:00 UTC`);
  return isNaN(d.getTime()) ? undefined : d;
}
