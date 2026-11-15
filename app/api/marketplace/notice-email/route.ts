import { NextRequest, NextResponse } from 'next/server';
import { clientIp, limited } from '@/lib/ip-rate-limit';

const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/notice-email — the notice email's confirmation (Phase 3 plan §2.10): the page the link opens
 * posts its three values here, and they go to the API over loopback. The link's token is the only credential (the
 * mailbox may belong to nobody with an account); 20 tries an hour per address. Never a GET, so a mail scanner that
 * opens the link confirms nothing.
 */
export async function POST(request: NextRequest) {
  if (limited(`mp-notice-confirm:${clientIp(request)}`, 20, 3_600_000)) {
    return NextResponse.json({ success: false, error: 'rate_limited', message: 'Too many tries. Try again in an hour.' }, { status: 429 });
  }
  let b: Record<string, unknown> | null = null;
  try { b = await request.json(); } catch { b = null; }
  const p = typeof b?.p === 'string' ? b.p : ''; const at = typeof b?.at === 'string' ? b.at : ''; const t = typeof b?.t === 'string' ? b.t : '';
  if (!/^[a-z2-7]{10}$/.test(p) || !/^[0-9]{10,16}$/.test(at) || !/^[0-9a-f]{40}$/.test(t)) {
    return NextResponse.json({ success: false, error: 'link_invalid', message: 'This link is not valid. Ask for a new one from your provider console.' }, { status: 400 });
  }
  try {
    const r = await fetch(`${API_URL}/marketplace/public/notice-email/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ p, at, t }), cache: 'no-store', signal: AbortSignal.timeout(5_000),
    });
    const j = await r.json().catch(() => null);
    return NextResponse.json(j ?? { success: false, error: 'bad_gateway' }, { status: j ? r.status : 502, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'unavailable', message: 'We could not confirm it just now. Try again in a moment.' }, { status: 503 });
  }
}
