import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

/**
 * GET /media/providers/<slug>-<sha8>-<size>.png — a listed host's approved mark, the PNG the server
 * rendered (Phase 3 plan §3.4 step 5, M3 API contract §4). The address changes with the content, so
 * the bytes are fetched from the API once, over loopback, and kept in Next's data cache for a year
 * under the tag `logo:<sha8>` (revalidateTag('logo:<sha8>') removes them): later requests do not
 * reach :4000 on every browser cache miss.
 *
 * Never a cached refusal. Next stores a fetch in its data cache only when the answer is a 200
 * (node_modules/next/dist/server/lib/patch-fetch.js: 15.5.29 :624, 14.2.35 :458), so the API's 404
 * — every request until a mark is approved and published (M5, M10), and again after one is
 * withdrawn — is asked afresh each time. And the route must stay dynamic: Next already renders a
 * route handler with a dynamic segment and no generateStaticParams on demand, but were it ever
 * static, its whole answer, status included, would be stored as a "ROUTE" cache entry
 * (base-server.js) with the fetch's one-year revalidate, and a first 404 would be served for a year
 * (a control build with generateStaticParams did exactly that); force-dynamic pins it. A 200 that
 * is not a PNG is refused and dropped from the cache.
 *
 * Its own headers, because the nginx block for .png files sets add_header and so drops the
 * server-level nosniff: image/png, nosniff, a sandboxing CSP and a cross-origin resource policy
 * (the mark is meant to be shown on other sites too, e.g. a provider's own pages).
 */
export const dynamic = 'force-dynamic';

const FILE_RE = /^[a-z0-9-]{1,32}-([0-9a-f]{8})-(64|128|256|512)\.png$/;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const YEAR = 31_536_000;

const isPng = (b: Uint8Array) => b.length > 8 && PNG_SIGNATURE.every((v, i) => b[i] === v);

function notFound() {
  return new NextResponse('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' },
  });
}

export async function GET(_request: Request, props: { params: Promise<{ file: string }> }) {
  const params = await props.params;
  const file = params.file;
  const m = typeof file === 'string' ? FILE_RE.exec(file) : null;
  if (!m) return notFound();
  const tag = `logo:${m[1]}`;
  try {
    // Never a redirect: the bytes come from this one API route, or the answer is a 404.
    const r = await fetch(`${API_URL}/marketplace/public/logos/${file}`, {
      redirect: 'error',
      next: { revalidate: YEAR, tags: [tag] },
      signal: AbortSignal.timeout(5_000),
    });
    if (r.status !== 200) return notFound();
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (!isPng(bytes)) {
      revalidateTag(tag);
      return notFound();
    }
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cache-Control': `public, max-age=${YEAR}, immutable`,
      },
    });
  } catch {
    return notFound();
  }
}
