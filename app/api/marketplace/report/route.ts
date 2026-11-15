import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { refuseMailForm } from '@/lib/mail-form-guard';
import { clientIp, limited } from '@/lib/ip-rate-limit';

const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
const DAY_MS = 86_400_000;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/report — "Report this listing" (Phase 3 plan §9.5, DSA Art. 16). The public mail-form
 * guard first (it mails a receipt), then 10 reports a day per IP and 3 a day per listing per IP, and a honeypot
 * field (`website`) that people never fill; then the API, over loopback, which counts again from its database,
 * stores the IP only as an HMAC and queues the receipt. A signed-in reporter is named to the API by id.
 */
export async function POST(request: NextRequest) {
  const refused = await refuseMailForm(request, 'marketplace report');
  if (refused) return refused;
  let body: Record<string, unknown> | null = null;
  try { body = await request.json(); } catch { body = null; }
  if (!body || typeof body !== 'object') return NextResponse.json({ success: false, error: 'invalid_body', message: 'Send the form again.' }, { status: 400 });
  // The honeypot: answered as a success, so a script learns nothing.
  if (typeof body.website === 'string' && body.website.trim()) return NextResponse.json({ success: true, data: { received: true } });
  const provider = typeof body.provider === 'string' ? body.provider : '';
  const entry = typeof body.entry === 'string' && body.entry ? body.entry : null;
  if (!SLUG.test(provider) || (entry !== null && !SLUG.test(entry))) return NextResponse.json({ success: false, error: 'not_found', message: 'We could not find that listing.' }, { status: 404 });
  const ip = clientIp(request);
  const tooMany = { success: false, error: 'rate_limited', message: 'You have sent the most reports we accept in a day. Try again tomorrow.' };
  if (limited(`mp-report:${ip}`, 10, DAY_MS)) return NextResponse.json(tooMany, { status: 429 });
  if (limited(`mp-report:${ip}:${provider}/${entry ?? ''}`, 3, DAY_MS)) {
    return NextResponse.json({ ...tooMany, message: 'You have reported this listing three times today. Try again tomorrow.' }, { status: 429 });
  }
  const token = process.env.ROUTER_INTERNAL_TOKEN;
  if (!token) return NextResponse.json({ success: false, error: 'unavailable', message: 'Reports are not available right now. Try again in a moment.' }, { status: 503 });
  const session = await auth().catch(() => null);
  const userId = session?.user?.id && /^[0-9]{1,15}$/.test(String(session.user.id)) ? Number(session.user.id) : null;
  try {
    const r = await fetch(`${API_URL}/internal/admin/marketplace/reports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-token': token, 'x-asl-report-relay': '1' },
      body: JSON.stringify({
        provider, entry, category: body.category, explanation: body.explanation, url: body.url, name: body.name, email: body.email,
        goodFaith: body.goodFaith === true, reporterUserId: userId, ip,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    const payload = await r.json().catch(() => null);
    if (!payload) return NextResponse.json({ success: false, error: 'bad_gateway', message: 'Something went wrong on our side. Try again in a moment.' }, { status: 502 });
    return NextResponse.json(payload, { status: r.status });
  } catch {
    return NextResponse.json({ success: false, error: 'unavailable', message: 'Reports are not available right now. Try again in a moment.' }, { status: 503 });
  }
}
