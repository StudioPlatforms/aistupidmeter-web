import { NextRequest, NextResponse } from 'next/server';
import { allowedPath, rawPathRefused } from '@/lib/marketplace-proxy';
import { DIRECTORY_PATH, marketplacePublicOpen } from '@/lib/marketplace-open';

const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

/**
 * GET /api/marketplace/<path> — the browser's way to the API's public marketplace reads (Phase 3 plan §4.9,
 * rev: S6). It forwards only GETs on an allowlist of public paths, after normalising the path; it refuses "..",
 * encoded slashes and backslashes (%2F, %5C) anywhere in the raw URL, any piece that is not a plain slug, any
 * path outside the allowlist and every other method; it never attaches the internal token or any identity, so
 * it can only ever return what the API gives everyone; and it keeps answers for at most 60 s. While the API's
 * public gate is closed (a staff preview, the kill switch) a per-slug path answers the API's "unavailable" without a
 * fetch, and a made-up slug is the API's 404 once it is open: neither leaves a data-cache file (M5 review SHOULD-3).
 */
export const dynamic = 'force-dynamic';

const notFound = () => NextResponse.json({ success: false, error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  if (rawPathRefused(request.url)) return notFound();
  const target = allowedPath(Array.isArray(params.path) ? params.path : []);
  if (!target) return notFound();
  if (target !== DIRECTORY_PATH && (await marketplacePublicOpen()) === 'closed') {
    return NextResponse.json({ success: true, data: null, unavailable: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    // No query string, no header of the visitor's: the answer is the same for everyone.
    const r = await fetch(`${API_URL}${target}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(5_000) });
    const body = await r.json().catch(() => null);
    if (!body) return NextResponse.json({ success: false, error: 'bad_gateway' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    // "Not found" comes as a 200 with notFound (the API's note on Next's data cache): the browser gets the 404.
    if (r.status === 404 || body.notFound === true) return notFound();
    return NextResponse.json(body, { status: r.status === 200 ? 200 : 502, headers: { 'Cache-Control': r.status === 200 ? 'public, max-age=60' : 'no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'unavailable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}

const methodNotAllowed = () => NextResponse.json({ success: false, error: 'method_not_allowed' }, { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store' } });
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const HEAD = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
