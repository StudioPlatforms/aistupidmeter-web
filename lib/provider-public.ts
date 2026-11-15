/**
 * Whether provider accounts are open to everyone (GET /marketplace/public/status → providerSignup,
 * true only at ASL_MARKETPLACE=on), for pages that must never wait on the API for it: the account
 * home's way in (§2.0) and the signed-out door of the provider pages.
 *
 * One answer for the whole server, not per account: read from memory, refreshed in the background
 * at most once a minute (sooner after a failure), false until the first answer arrives. A slow or
 * stalled API therefore never slows a page; it only keeps the last known answer a little longer.
 * The sign-up page asks the same route through Next's fetch cache instead (it is rendered ahead).
 */
const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
const TTL_MS = 60_000;
const RETRY_MS = 15_000;

let open = false;
let nextAt = 0;
let refreshing = false;

async function refresh(): Promise<void> {
  try {
    const r = await fetch(`${API_URL}/marketplace/public/status`, { cache: 'no-store', signal: AbortSignal.timeout(1500) });
    const j = r.ok ? await r.json().catch(() => null) : null;
    // An API without the route (before the marketplace release) answers 404: closed.
    open = r.status === 404 ? false : j?.success === true && j?.data?.providerSignup === true ? true : r.ok ? false : open;
    nextAt = Date.now() + (r.ok || r.status === 404 ? TTL_MS : RETRY_MS);
  } catch {
    nextAt = Date.now() + RETRY_MS;   // keep the last known answer; ask again soon
  } finally {
    refreshing = false;
  }
}

/** The last known answer; never waits. Starts a background refresh when it is due. */
export function providerSignupOpenCached(): boolean {
  if (!refreshing && Date.now() >= nextAt) {
    refreshing = true;
    void refresh();
  }
  return open;
}

/**
 * The same answer for a page that may wait for it (M10: the ranking criteria, the logo standards and the router
 * signature become public at the opening): GET /marketplace/public/status through Next's fetch cache, refreshed at most
 * once a minute, as the sign-up page reads it. Any failure reads as false: a page whose door cannot be asked stays the
 * staff preview it was.
 */
export async function providerSignupOpenNow(): Promise<boolean> {
  try {
    const r = await fetch(`${API_URL}/marketplace/public/status`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(3000) });
    if (!r.ok) return false;
    const j = await r.json().catch(() => null) as { success?: boolean; data?: { providerSignup?: boolean } } | null;
    return j?.success === true && j?.data?.providerSignup === true;
  } catch {
    return false;
  }
}
