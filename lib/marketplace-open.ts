/**
 * Whether the API's public marketplace answers can be anything but "unavailable" (Phase 3 plan §4.9, §5.9; M5
 * review SHOULD-3), from ONE cached read: the directory, GET /marketplace/public/providers, with the same URL and
 * options as the sitemap's read, so both share one entry of Next's data cache (60 s, tag mp:directory).
 *
 * The API's gate is the same for every slug: while provider pages are a staff preview (ASL_MARKETPLACE=staff) or the
 * `marketplace.public` kill switch is off, every per-slug public answer is the same "unavailable". The per-slug reads
 * (provider and entry pages, /models/<open model>, the public proxy, the share cards) then fetch nothing, because
 * every made-up slug would otherwise leave one file in the data cache until the next web deploy. Once open, a made-up
 * slug is a plain 404 from the API, which Next never stores. No import of auth here: the proxy and the share card use
 * it too.
 */
const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
export const DIRECTORY_PATH = '/marketplace/public/providers';

export type PublicGate = 'open' | 'closed' | 'error';

export async function marketplacePublicOpen(): Promise<PublicGate> {
  try {
    const r = await fetch(`${API_URL}${DIRECTORY_PATH}`, { next: { revalidate: 60, tags: ['mp:directory'] }, signal: AbortSignal.timeout(4_000) });
    if (!r.ok) return 'error';
    const j = await r.json().catch(() => null) as { success?: boolean; data?: unknown; unavailable?: boolean } | null;
    if (!j?.success) return 'error';
    return j.unavailable === true || j.data === null || j.data === undefined ? 'closed' : 'open';
  } catch {
    return 'error';
  }
}
