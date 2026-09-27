import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findUserByEmail } from '@/lib/db-client';
import { ROUTER_CREDITS } from '@/lib/entitlements';
import { confirmCreditSession, parseTopupUsd, startCreditCheckout, MAX_TOPUP_USD } from '@/lib/router-credits';

/**
 * POST /api/stripe/credits { amountUsd } — open a Checkout for a Smart Router top-up.
 * GET  /api/stripe/credits?session_id= — credit a completed top-up on return from Stripe
 *      (the webhook does the same; whichever arrives first wins, the other is a no-op).
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Sign in to buy credits.' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const amountUsd = parseTopupUsd(body?.amountUsd);
  if (amountUsd === null) {
    return NextResponse.json({
      success: false,
      error: `Enter an amount of at least $${ROUTER_CREDITS.minimumUsd}` +
        ` (and no more than $${MAX_TOPUP_USD.toLocaleString('en-US')} in one payment).`,
    }, { status: 400 });
  }
  const user = findUserByEmail(session.user.email);
  if (!user) return NextResponse.json({ success: false, error: 'Account not found.' }, { status: 404 });
  try {
    const url = await startCreditCheckout({
      userId: user.id, email: user.email, amountUsd, stripeCustomerId: (user as any).stripe_customer_id ?? null,
    });
    return NextResponse.json({ success: true, data: { url } });
  } catch (err: any) {
    if (err?.code === 'unconfigured') {
      return NextResponse.json({ success: false, error: 'Top-ups are unavailable right now. Please try again later.' }, { status: 503 });
    }
    console.error('[credits] checkout failed:', err?.message || err);
    return NextResponse.json({ success: false, error: 'Could not start checkout. Please try again.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const sessionId = request.nextUrl.searchParams.get('session_id') ?? '';
  if (!session?.user?.email || !/^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId)) {
    return NextResponse.json({ success: false }, { status: 400 });
  }
  const user = findUserByEmail(session.user.email);
  if (!user) return NextResponse.json({ success: false }, { status: 404 });
  try {
    const r = await confirmCreditSession(sessionId, user.id);
    return NextResponse.json({ success: !!r, data: r ? { requests: r.requests } : null });
  } catch (err: any) {
    console.error('[credits] confirm failed:', err?.message || err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
