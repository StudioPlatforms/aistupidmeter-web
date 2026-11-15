import type { MetadataRoute } from 'next';
import { getBoards24h, getRoster } from '@/lib/seo-data';
import { allRoutes, type MarketplaceDirectoryRow } from '@/lib/seo-routes';
import { publicRead } from '@/lib/marketplace-public';
import { providerSignupOpenNow } from '@/lib/provider-public';

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
  // The public directory only (never a staff preview): empty before the opening. The provider terms pages only once
  // provider accounts are open to everyone (M10), read through Next's fetch cache (revalidate 60, any failure reads as
  // closed), so the sitemap stays a cached page (an uncached fetch here made it render on every request).
  const [roster, boards, dir, termsOpen] = await Promise.all([getRoster(), getBoards24h(),
    publicRead<{ providers: MarketplaceDirectoryRow[] }>('/marketplace/public/providers', ['mp:directory']).catch(() => null), providerSignupOpenNow()]);
  return allRoutes(roster, boards, dir && dir.kind === 'ok' ? dir.data.providers : null, termsOpen);
}
