/**
 * The public marketplace proxy's path rules (app/api/marketplace/[...path]/route.ts; Phase 3 plan §4.9, rev: S6).
 */
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

/** The boards' periods and the chart's suites and days (M9: §7.1, §7.6), the only values those paths take. */
const PERIODS = new Set(['latest', '24h', '7d', '1m']);
const SUITES = new Set(['combined', 'coding', 'reasoning', 'tooling', 'canary']);
const DAYS = new Set(['7', '30', '90']);

/** The public paths, as patterns over the pieces after /api/marketplace/. */
export function allowedPath(pieces: string[]): string | null {
  if (!pieces.length || pieces.length > 5) return null;
  if (!pieces.every(p => typeof p === 'string' && /^[a-z0-9-]{1,64}$/.test(p))) return null;
  const [a, b, c, d, e] = pieces;
  // M9: the boards' hosted rows (§7.1, MD21), path-addressed so every period is its own ≤ 60 s cache entry, and the
  // per-host chart of one open model (§7.6). The API answers both the same for everyone.
  if (pieces.length === 2 && a === 'boards' && PERIODS.has(b)) return `/marketplace/public/boards?period=${b}`;
  if (pieces.length === 5 && a === 'open-models' && SLUG.test(b) && c === 'series' && SUITES.has(d) && DAYS.has(e)) return `/marketplace/public/open-models/${b}/series/${d}/${e}`;
  if (pieces.length > 3) return null;
  if (pieces.length === 1 && a === 'providers') return '/marketplace/public/providers';
  if (pieces.length === 2 && a === 'providers' && SLUG.test(b)) return `/marketplace/public/providers/${b}`;
  if (pieces.length === 3 && a === 'providers' && SLUG.test(b) && SLUG.test(c)) return `/marketplace/public/providers/${b}/${c}`;
  if (pieces.length === 2 && a === 'open-models' && SLUG.test(b)) return `/marketplace/public/open-models/${b}`;
  return null;
}

/** "..", an encoded slash or backslash, or a control character anywhere in the raw path. */
export function rawPathRefused(rawUrl: string): boolean {
  const i = rawUrl.indexOf('?');
  const raw = (i >= 0 ? rawUrl.slice(0, i) : rawUrl).toLowerCase();
  return raw.includes('..') || raw.includes('%2f') || raw.includes('%5c') || raw.includes('%2e') || raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw);
}

