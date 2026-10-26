import type { MetadataRoute } from 'next';
import { getBoards24h, getRoster } from '@/lib/seo-data';
import { allRoutes } from '@/lib/seo-routes';

/**
 * /sitemap.xml from the route registry (lib/seo-routes.ts), so a page and its sitemap entry
 * cannot drift: the static pages with their last commit date (lib/page-dates.json, written at
 * build time), the model pages dated by their newest score on the 24-hour boards, the vendor,
 * best-for, getting-worse, status and research pages, and the curated compare pairs.
 *
 * Entries with no known date carry no lastmod; a fabricated "now" on every URL is what makes a
 * crawler ignore the field. Both fetches swallow errors, so the sitemap still serves the static
 * pages when the API is down.
 */
export const revalidate = 900;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [roster, boards] = await Promise.all([getRoster(), getBoards24h()]);
  return allRoutes(roster, boards);
}
