import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { clientIp } from '@/lib/ip-rate-limit';
import { forgetProviderFor } from '@/lib/provider-membership';

import { backendUrlFor } from '@/lib/proxy-path';
const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

/**
 * This route is the ONLY authenticated way into the /account/* API.
 *
 * Identical trust model to app/api/router/[...path]/route.ts: the user id is
 * read from the NextAuth session HERE, server-side, and vouched for to the API
 * with ROUTER_INTERNAL_TOKEN. The API refuses any x-user-id that arrives
 * without that token, so a browser cannot claim to be another user.
 *
 * ⚠️ nginx must NOT have an /api/account/ location. If it proxies straight to
 * port 4000 it bypasses this route, and the API then sees a browser-supplied
 * x-user-id with no internal token and rejects it — every request 401s.
 */

/**
 * The only answers that pass through without being JSON, as the admin proxy's PNG rule
 * (app/api/admin/marketplace/[...path]/route.ts):
 * - a provider logo's preview PNG, on its own path only, once its first bytes are a PNG signature;
 * - a CSV download sent as an attachment: the audit trail (org/audit?format=csv) and a project's
 *   request log (org/projects/:id/requests?format=csv);
 * - a provider's PDF sent as an attachment, on its own paths only, once its first bytes are "%PDF-" (Phase 3 M5:
 *   a signed copy of the agreement, the agreement's text, a notice).
 * Anything else that is not JSON is a 502. An answer typed by the API is served on this site's
 * origin to a signed-in browser, so one slip on any /account path (an SVG, an HTML page) would be
 * script running as that account; this proxy never relies on the API's own headers for that. What
 * passes always goes out with nosniff, a sandboxing CSP and no-store.
 */
const LOGO_PNG_PATH = /^provider\/logo\/[1-9]\d{0,15}\/png\/(?:64|128|256|512)$/;
const PDF_PATH = /^provider\/(?:agreement\/acceptances\/[1-9]\d{0,15}\/pdf|agreement\/text\.pdf|notices\/[1-9]\d{0,15}\/pdf)$/;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];
const ATTACHMENT = /^\s*attachment\s*(?:;|$)/i;

const badGateway = () =>
  NextResponse.json({ success: false, error: 'Bad gateway response' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });

/** A non-JSON answer from the API: passed on only as one of the kinds above, else a 502. */
async function passThrough(res: Response, path: string[]): Promise<NextResponse> {
  const media = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const disposition = res.headers.get('content-disposition') || '';
  let body: ArrayBuffer | null = null;
  let type = '';
  if (media === 'image/png' && LOGO_PNG_PATH.test(path.join('/'))) {
    const buf = await res.arrayBuffer();
    const b = new Uint8Array(buf);
    if (b.length > 8 && PNG_SIGNATURE.every((v, i) => b[i] === v)) { body = buf; type = 'image/png'; }
  } else if (media === 'text/csv' && ATTACHMENT.test(disposition)) {
    body = await res.arrayBuffer();
    type = 'text/csv; charset=utf-8';
  } else if (media === 'application/pdf' && ATTACHMENT.test(disposition) && PDF_PATH.test(path.join('/'))) {
    const buf = await res.arrayBuffer();
    const b = new Uint8Array(buf);
    if (b.length > 5 && PDF_SIGNATURE.every((v, i) => b[i] === v)) { body = buf; type = 'application/pdf'; }
  } else {
    // Read and dropped, not cancelled: inside Next's server the body can be one branch of a tee, and
    // cancelling one branch waits for the other, so the answer never left (a hang, not a 502).
    await res.arrayBuffer().catch(() => undefined);
  }
  if (!body) return badGateway();
  const out = new NextResponse(body, { status: res.status });
  out.headers.set('Content-Type', type);
  if (type.startsWith('text/csv') || type === 'application/pdf') out.headers.set('Content-Disposition', disposition);
  out.headers.set('X-Content-Type-Options', 'nosniff');
  out.headers.set('Content-Security-Policy', "default-src 'none'; sandbox");
  out.headers.set('Cache-Control', 'no-store');
  return out;
}

async function proxyRequest(request: NextRequest, path: string[], method: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Sign in to manage your watchlist' },
      { status: 401 }
    );
  }

  const internalToken = process.env.ROUTER_INTERNAL_TOKEN;
  if (!internalToken) {
    console.error('[Account Proxy] ROUTER_INTERNAL_TOKEN is not set');
    return NextResponse.json({ success: false, error: 'Service misconfigured' }, { status: 503 });
  }

  try {
    const url = new URL(request.url);
    const backendUrl = backendUrlFor(API_URL, 'account', path, url.search);
    // A piece that could leave /account/ ("..", an encoded slash, ...) never reaches the API (lib/proxy-path.ts).
    if (!backendUrl) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const headers: Record<string, string> = {
      'x-user-id': session.user.id,
      'x-internal-token': internalToken,
      // Who is acting, for the workspace audit trail: without these the API saw only this
      // server (127.0.0.1, "node"). Trusted there only alongside the internal token.
      'x-asl-client-ip': clientIp(request),
      // Printable ASCII only: fetch rejects a header value outside Latin-1, and a malformed
      // User-Agent must not be able to fail the whole request.
      'x-asl-client-ua': (request.headers.get('user-agent') ?? '').replace(/[^\x20-\x7e]/g, '').slice(0, 400),
    };

    let body: string | undefined;
    if (method !== 'GET' && method !== 'DELETE') {
      const text = await request.text();
      if (text) {
        body = text;
        headers['Content-Type'] = 'application/json';
      }
    }

    const res = await fetch(backendUrl, { method, headers, body, cache: 'no-store' });
    // A change to provider accounts (one created, an invitation accepted, a member leaving) can
    // change who sees the sidebar's Provider group: drop this account's cached membership so the
    // next session read sees it (lib/provider-membership.ts).
    if (path[0] === 'provider' && method !== 'GET') forgetProviderFor(session.user.id);
    // Downloads (the audit trail and a project's request log as CSV) and a provider logo's preview
    // PNGs (/account/provider/logo/:id/png/:size) are not JSON: parsing them turned every export into
    // "Bad gateway response". They pass through passThrough()'s rules; any other non-JSON answer is a 502.
    const type = res.headers.get('content-type') || '';
    if (!type.includes('application/json')) return await passThrough(res, path);
    const payload = await res.json().catch(() => ({ success: false, error: 'Bad gateway response' }));
    return NextResponse.json(payload, { status: res.status });
  } catch (error) {
    console.error('[Account Proxy] Request failed:', error);
    return NextResponse.json({ success: false, error: 'Upstream request failed' }, { status: 502 });
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return proxyRequest(request, params.path, 'GET');
}
export async function POST(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return proxyRequest(request, params.path, 'POST');
}
export async function PUT(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return proxyRequest(request, params.path, 'PUT');
}
export async function PATCH(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return proxyRequest(request, params.path, 'PATCH');
}
export async function DELETE(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return proxyRequest(request, params.path, 'DELETE');
}
