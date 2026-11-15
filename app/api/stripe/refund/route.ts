import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { refundState, requestRefund } from '@/lib/paid-start';
import { sameOrigin } from '@/lib/same-origin';

// Per account and acting on live billing state: never prerendered or cached.
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Cancel and refund within 7 days of a subscription's start (lib/paid-start.ts).
 *
 * GET — whether the signed-in account's subscription can be refunded now, until when and for
 * how much (the billing page shows the pane from this).
 * POST — do it: the plan ends at once and every payment on it is refunded.
 *   200 { success, refundedCents }  · 403 not_eligible, or forbidden (another site's request)
 *   503 nothing_changed (Stripe could not be reached or read; nothing was done)
 *   502 incomplete (the request is recorded and started; the billing watch finishes it)
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  // Only decides whether the billing page shows the pane: Stripe is given 10 seconds, no retry.
  const state = await refundState(Number(session.user.id), { quick: true });
  return NextResponse.json({ success: true, data: state }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  // A refund ends the plan: only our own billing page may ask for one.
  if (!sameOrigin(request)) return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403, headers: NO_STORE });
  const out = await requestRefund(Number(session.user.id));
  switch (out.result) {
    case 'ok':
      return NextResponse.json({ success: true, refundedCents: out.refundedCents, currency: out.currency }, { headers: NO_STORE });
    case 'not_eligible':
      return NextResponse.json({ success: false, error: 'not_eligible' }, { status: 403, headers: NO_STORE });
    case 'nothing_changed':
      return NextResponse.json({ success: false, error: 'nothing_changed' }, { status: 503, headers: NO_STORE });
    default:
      return NextResponse.json({ success: false, error: 'incomplete' }, { status: 502, headers: NO_STORE });
  }
}
