import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { backendUrlFor } from '@/lib/proxy-path';

const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

// Per-request: the answer depends on who is signed in, and must never be prerendered or cached.
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/marketplace/* — the admin dashboard's Providers tab (read-only): the review
 * queue and the provider accounts, from the API's /internal/admin/marketplace/* over loopback
 * with the internal token (nginx answers 404 for /internal/ from outside). Admin session only
 * (lib/admin-auth), the pattern of /api/admin/visitors/recent.
 *
 * It sends exactly the headers the API asks of this proxy (M2 contract v3.2 §1): the internal
 * token, `x-asl-admin-proxy: 1` and `x-asl-admin-user` (the id requireAdminSession verified; the
 * API checks it is an admin account too). Never x-user-id, x-asl-client-ip or x-asl-client-ua:
 * those mark a user-scoped proxy, and the API answers 404 to them here.
 *
 * Only GET, and only the paths below. The backend URL is built by lib/proxy-path.ts like every
 * catch-all proxy's: a piece that is empty, "." or "..", or holds a slash, a backslash, a percent
 * sign or a control character is refused, and the normalised URL must stay under
 * /internal/admin/marketplace/. The allowlist then narrows it to the read-only views: the four of
 * M2, and the logo review's three of M3 (contract §3).
 *
 * The logo previews are PNGs (logos/<id>/png/<size>): those answers pass through as bytes, with
 * nosniff, the API's sandboxing CSP and no-store, once their first bytes are a PNG signature. The
 * uploaded SVG is never asked for: no route of the API returns it, and none of these paths could.
 */
const PNG_PATH = /^logos\/[1-9][0-9]{0,9}\/png\/(?:64|128|256|512)$/;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ALLOWED: RegExp[] = [
  /^overview$/,
  /^queue$/,
  /^providers$/,
  /^providers\/[a-z2-7]{10}$/,
  /^logos$/,
  /^logos\/[1-9][0-9]{0,9}$/,
  PNG_PATH,
  // M4: the open-model registry.
  /^open-models$/,
  // M5: a provider's record (actions, notices, acceptances, appeals, complaints, deliveries), the agreement versions,
  // reports, open appeals and complaints, and a signed copy for the review screen (passed through as a PDF, below).
  /^providers\/[a-z2-7]{10}\/record$/,
  /^agreement\/versions$/,
  /^reports$/,
  /^appeals$/,
  /^complaints$/,
  /^acceptances\/[1-9][0-9]{0,9}\/pdf$/,
  // M8 (§8.7): the offers waiting for review.
  /^offers$/,
  // M7: integrity cases (§10.7) and spot checks (§10.6), read-only views.
  /^integrity$/,
  /^integrity\/[1-9][0-9]{0,9}$/,
  /^spot-checks$/,
  // F4: the Calibration pane (phase4-plan revision 4 §R2.13), read-only view.
  /^calibration$/,
  // F7: the User-run tests pane (the newest tests; hiding one is a measure, POST actions).
  /^user-tests$/,
];
const PDF_PATH = /^acceptances\/[1-9][0-9]{0,9}\/pdf$/;

/**
 * M4: the staff writes, each one exact method and path: the open-model registry (add, edit), a new TLS
 * certificate issuer confirmed (the endpoint's safety hold lifts), an internal test account's attested host.
 * A JSON body of at most 8 KiB is passed on as it is; the API validates every field.
 */
const WRITES: Array<{ method: 'POST' | 'PATCH'; path: RegExp }> = [
  { method: 'POST', path: /^open-models$/ },
  { method: 'PATCH', path: /^open-models\/[1-9][0-9]{0,9}$/ },
  { method: 'POST', path: /^holds\/[a-z2-7]{10}\/confirm-tls$/ },
  { method: 'POST', path: /^providers\/[a-z2-7]{10}\/hosts$/ },
  // M5: decisions (§10.4), measures (§10.5), agreement versions (§9.3), reports (§9.5), appeals and complaints (§9.6).
  { method: 'POST', path: /^providers\/[a-z2-7]{10}\/decision$/ },
  { method: 'POST', path: /^listings\/[a-z0-9]{6,32}\/decision$/ },
  { method: 'POST', path: /^logos\/[1-9][0-9]{0,9}\/decision$/ },
  { method: 'POST', path: /^actions$/ },
  { method: 'POST', path: /^agreement\/versions$/ },
  { method: 'POST', path: /^agreement\/versions\/[0-9]{1,3}\.[0-9]{1,3}\/publish$/ },
  { method: 'POST', path: /^acceptances\/[1-9][0-9]{0,9}\/offdomain-reviewed$/ },
  { method: 'POST', path: /^reports\/[1-9][0-9]{0,9}\/triage$/ },
  { method: 'POST', path: /^appeals\/[1-9][0-9]{0,9}\/decide$/ },
  { method: 'POST', path: /^complaints\/[1-9][0-9]{0,9}\/answer$/ },
  // M5 review SHOULD-2: [Resend] a legal mail (a notice, a signed copy) from its queue item.
  { method: 'POST', path: /^(?:notices|acceptances)\/[1-9][0-9]{0,9}\/resend$/ },
  // M8 (§8.7): approve or refuse an offer in review.
  { method: 'POST', path: /^offers\/[1-9][0-9]{0,9}\/decision$/ },
  // M7: an integrity case's decision, [Dismiss with reason] or [Confirm] (§10.7).
  { method: 'POST', path: /^integrity\/[1-9][0-9]{0,9}\/decision$/ },
  // F4: a staff decision on a calibration (exclude, keep in, keep on standard, resume a suite, cancel, revoke, an item decided).
  { method: 'POST', path: /^calibration\/[a-z2-7]{10}\/decision$/ },
  // F6b (F6r re-check web SHOULD-1): an item no calibration owns, marked decided (the Calibration and Integrity cases panes).
  { method: 'POST', path: /^calibration\/items\/[1-9][0-9]{0,15}\/decision$/ },
];
const WRITE_MAX_BYTES = 8 * 1024;
/** Query parameters the API's lists take (M2 contract §5; `state` also filters the logo list, M3 §3), each a short plain value. */
const QUERY_KEYS = new Set(['state', 'internal', 'q']);

const notFound = () => NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });

export async function GET(request: NextRequest, props: { params: Promise<{ path?: string[] }> }) {
  const params = await props.params;
  const admin = await requireAdminSession();
  if (admin instanceof NextResponse) return admin;

  const segments = params.path ?? [];
  const query = new URLSearchParams();
  request.nextUrl.searchParams.forEach((value, key) => {
    if (QUERY_KEYS.has(key) && value.length <= 80 && /^[\w .@-]*$/.test(value)) query.set(key, value);
  });
  const qs = query.toString();
  const backendUrl = backendUrlFor(API_URL, 'internal/admin/marketplace', segments, qs ? `?${qs}` : '');
  if (!backendUrl || !ALLOWED.some(re => re.test((segments as string[]).join('/')))) return notFound();

  const token = process.env.ROUTER_INTERNAL_TOKEN;
  if (!token) return NextResponse.json({ success: false, error: 'Service misconfigured' }, { status: 503 });

  try {
    const r = await fetch(backendUrl, {
      headers: { 'x-internal-token': token, 'x-asl-admin-proxy': '1', 'x-asl-admin-user': String(admin.userId) },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    const type = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (type === 'image/png' && PNG_PATH.test(segments.join('/'))) {
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (bytes.length <= 8 || !PNG_SIGNATURE.every((v, i) => bytes[i] === v)) {
        return NextResponse.json({ success: false, error: 'Bad gateway response' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
      }
      return new NextResponse(bytes, {
        status: r.status,
        headers: {
          'Content-Type': 'image/png',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
          'Cache-Control': 'no-store',
        },
      });
    }
    if (type === 'application/pdf' && PDF_PATH.test(segments.join('/'))) {
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (bytes.length < 5 || Buffer.from(bytes.subarray(0, 5)).toString('latin1') !== '%PDF-') {
        return NextResponse.json({ success: false, error: 'Bad gateway response' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
      }
      return new NextResponse(bytes, {
        status: r.status,
        headers: {
          'Content-Type': 'application/pdf', 'Content-Disposition': r.headers.get('content-disposition') || 'attachment',
          'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'no-store',
        },
      });
    }
    const body = await r.json().catch(() => ({ success: false, error: 'Bad gateway response' }));
    return NextResponse.json(body, { status: r.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'The API did not answer' }, { status: 502 });
  }
}

async function write(method: 'POST' | 'PATCH', request: NextRequest, segments: string[]): Promise<NextResponse> {
  const admin = await requireAdminSession();
  if (admin instanceof NextResponse) return admin;
  const joined = segments.join('/');
  const backendUrl = backendUrlFor(API_URL, 'internal/admin/marketplace', segments, '');
  if (!backendUrl || !WRITES.some(w => w.method === method && w.path.test(joined))) return notFound();
  // JSON only (the unsubscribe route's rule): a cross-site form cannot send it, so the session cookie alone cannot call this.
  if (!(request.headers.get('content-type') || '').includes('application/json')) {
    return NextResponse.json({ success: false, error: 'json_required' }, { status: 415 });
  }
  const token = process.env.ROUTER_INTERNAL_TOKEN;
  if (!token) return NextResponse.json({ success: false, error: 'Service misconfigured' }, { status: 503 });
  const text = await request.text().catch(() => '');
  if (text.length > WRITE_MAX_BYTES) return NextResponse.json({ success: false, error: 'too_large' }, { status: 413 });
  let body: unknown = {};
  try { body = text ? JSON.parse(text) : {}; } catch { return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 });
  try {
    const r = await fetch(backendUrl, {
      method,
      headers: { 'content-type': 'application/json', 'x-internal-token': token, 'x-asl-admin-proxy': '1', 'x-asl-admin-user': String(admin.userId) },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    const out = await r.json().catch(() => ({ success: false, error: 'Bad gateway response' }));
    return NextResponse.json(out, { status: r.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'The API did not answer' }, { status: 502 });
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ path?: string[] }> }) {
  const params = await props.params;
  return write('POST', request, params.path ?? []);
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ path?: string[] }> }) {
  const params = await props.params;
  return write('PATCH', request, params.path ?? []);
}
