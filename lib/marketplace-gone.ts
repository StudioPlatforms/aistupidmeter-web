/**
 * The delisted set for the middleware's 410 (Phase 3 plan §4.8 "How a 410 is answered", rev: S13): App Router
 * pages cannot answer 410, so middleware.ts answers it for any /inference-providers or /badge path in this set,
 * fetched from the API's GET /marketplace/public/gone and kept for at most 60 s. A provider in the set takes
 * its entries with it. Edge-runtime safe: fetch and plain objects only.
 *
 * A stale set is refreshed before it is used (waiting at most 1.5 s, then the last set is used), so a delisting
 * reaches the 410 within 60 s of the API's answer changing; a failed refresh keeps the last set and asks again
 * after 10 s.
 */
const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
const TTL_MS = 60_000;
const RETRY_MS = 10_000;
const WAIT_MS = 1_500;

let gone: Set<string> = new Set();
let nextAt = 0;
let loading: Promise<void> | null = null;

const PATH_RE = /^\/(inference-providers|badge)\/([a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)(?:\/([a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?))?\/?$/;

async function refresh(): Promise<void> {
  try {
    const r = await fetch(`${API_URL}/marketplace/public/gone`, { cache: 'no-store', signal: AbortSignal.timeout(WAIT_MS) });
    const j = r.ok ? await r.json().catch(() => null) as { data?: { paths?: unknown } } | null : null;
    const paths = Array.isArray(j?.data?.paths) ? (j!.data!.paths as unknown[]).filter((p): p is string => typeof p === 'string') : null;
    if (paths) { gone = new Set(paths); nextAt = Date.now() + TTL_MS; } else nextAt = Date.now() + RETRY_MS;
  } catch {
    nextAt = Date.now() + RETRY_MS;
  } finally {
    loading = null;
  }
}

/** The key the set holds for a path: '<provider>' or '<provider>/<entry>', or null for any other path. */
export function goneKey(pathname: string): { provider: string; entry: string | null } | null {
  const m = PATH_RE.exec(pathname);
  if (!m) return null;
  return { provider: m[2], entry: m[3] ?? null };
}

export async function isGone(pathname: string): Promise<boolean> {
  const k = goneKey(pathname);
  if (!k) return false;
  if (Date.now() >= nextAt) {
    if (!loading) loading = refresh();
    await Promise.race([loading, new Promise(resolve => setTimeout(resolve, WAIT_MS))]);
  }
  return gone.has(k.provider) || (k.entry !== null && gone.has(`${k.provider}/${k.entry}`));
}
