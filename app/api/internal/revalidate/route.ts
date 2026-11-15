import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

// Never prerendered or cached: every call changes the cache.
export const dynamic = 'force-dynamic';

function tokenOk(given: string | null): boolean {
  const want = process.env.ROUTER_INTERNAL_TOKEN;
  if (!want || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

const TAG_RE = /^[a-z][a-z0-9-]*(?::[A-Za-z0-9._-]{1,80}){0,2}$/;
const PATH_RE = /^\/[A-Za-z0-9._~\/-]{0,200}$/;

function list(v: unknown, re: RegExp, max: number): string[] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > max) return null;
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== 'string' || !re.test(x) || x.includes('..') || x.includes('//')) return null;
    out.push(x);
  }
  return Array.from(new Set(out));
}

/**
 * POST /api/internal/revalidate — the API's marketplace outbox asks the web to drop cached pages and fetches
 * (Phase 3 plan MD23, §4.9): `revalidateTag` for each tag, `revalidatePath` for each path. Called by :4000 over
 * loopback with the internal token. A request that came through nginx (which always sets X-Real-IP) is refused
 * even with the token, as /api/internal/billing-watch does: this is not a public endpoint. Body: JSON
 * {tags: string[], paths: string[]}, at most 200 of each, plain tags and site paths only.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get('x-real-ip') || !tokenOk(request.headers.get('x-internal-token'))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  let body: { tags?: unknown; paths?: unknown } | null = null;
  try { body = await request.json(); } catch { body = null; }
  const tags = list(body?.tags, TAG_RE, 200);
  const paths = list(body?.paths, PATH_RE, 200);
  if (!body || !tags || !paths) return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
  for (const t of tags) revalidateTag(t);
  for (const p of paths) revalidatePath(p);
  return NextResponse.json({ success: true, data: { tags: tags.length, paths: paths.length } }, { headers: { 'Cache-Control': 'no-store' } });
}
