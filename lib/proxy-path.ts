/**
 * The backend URL a catch-all proxy (app/api/{account,router,test-adapters,community-runs}/[...path])
 * may forward to, or null when the request's path pieces could leave the proxy's own prefix.
 *
 * Those proxies attach ROUTER_INTERNAL_TOKEN to what they forward, so an unchecked "..", or an encoded
 * one such as "..%2F", would let a browser reach the API's token-only /internal/* routes through them
 * (M2 web review MUST-1, 2026-11-11). Every piece must be a plain, non-empty path segment: not "." or
 * "..", and no "/", "\", "%" or control characters (Next.js has already decoded the pieces once, so a
 * "%" here means the request double-encoded something). Each piece is then encoded, and the final URL
 * must still sit under /<prefix>/ after the URL parser has normalised it.
 */
export function backendUrlFor(apiUrl: string, prefix: string, segments: unknown, search: string): string | null {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  for (const s of segments) {
    if (typeof s !== 'string' || s === '' || s === '.' || s === '..') return null;
    if (/[\/\\%]/.test(s) || /[\u0000-\u001f\u007f]/.test(s)) return null;
  }
  const path = `/${prefix}/${(segments as string[]).map(encodeURIComponent).join('/')}`;
  let url: URL;
  try {
    url = new URL(`${apiUrl}${path}${search}`);
  } catch {
    return null;
  }
  if (!url.pathname.startsWith(`/${prefix}/`)) return null;
  return url.toString();
}
