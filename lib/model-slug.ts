/**
 * Model slug helpers — SEO-friendly URLs for model detail pages.
 *
 * The backend keys models by numeric DB id (e.g. /models/160). Those URLs are
 * meaningless to users and to search engines. This module derives a stable,
 * human-readable slug from a model's `name` (e.g. "claude-sonnet-4-6") so the
 * site can serve /models/claude-sonnet-4-6 and 301 the old numeric URLs to it.
 *
 * Slugs are derived purely from `name`, so any place holding a model object can
 * compute the slug without a round-trip. Resolution back to a numeric id (needed
 * by the existing data-fetching endpoints, which are still id-keyed) is done
 * against the /api/models list via `resolveModelParam`.
 */

export interface SlugModel {
  id: number | string;
  name: string;
  displayName?: string | null;
  vendor?: string;
}

/**
 * Turn a raw model name into a URL slug.
 * - lowercased
 * - trailing provider date stamps (…-20250929) are dropped so the canonical URL
 *   stays clean and stable across re-releases of the same family
 * - dots and whitespace collapse to single dashes (gemini-3.1-pro → gemini-3-1-pro)
 * - any other non [a-z0-9-] char becomes a dash; runs collapse; ends trimmed
 */
export function slugifyModelName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/-20\d{6}$/, '') // strip trailing YYYYMMDD date suffix
    .replace(/[.\s_]+/g, '-') // dots / spaces / underscores → dash
    .replace(/[^a-z0-9-]/g, '-') // anything else → dash
    .replace(/-+/g, '-') // collapse runs
    .replace(/^-+|-+$/g, ''); // trim
}

/** Slug for a model object. */
export function modelSlug(model: SlugModel): string {
  return slugifyModelName(model.name);
}

/** True when a route param looks like a raw numeric DB id (legacy URL). */
export function isNumericId(param: string): boolean {
  return /^\d+$/.test(param);
}

/**
 * Resolve a /models/[param] route value (either a numeric id or a slug) against
 * the full models list. Returns the matched model and its canonical slug, or
 * null if nothing matches.
 *
 * Numeric params match by id; slug params match by slugified name. If two active
 * models ever slugify identically, the lowest id wins deterministically (callers
 * can add a display-name qualifier later if needed).
 */
export function resolveModelParam(
  param: string,
  models: SlugModel[]
): { model: SlugModel; slug: string; matchedByNumericId: boolean } | null {
  if (!param || !Array.isArray(models) || models.length === 0) return null;

  if (isNumericId(param)) {
    const idNum = parseInt(param, 10);
    const model = models.find((m) => Number(m.id) === idNum);
    if (!model) return null;
    return { model, slug: modelSlug(model), matchedByNumericId: true };
  }

  const target = param.toLowerCase();
  const matches = models.filter((m) => modelSlug(m) === target);
  if (matches.length === 0) return null;
  const model = matches.sort((a, b) => Number(a.id) - Number(b.id))[0];
  return { model, slug: modelSlug(model), matchedByNumericId: false };
}
