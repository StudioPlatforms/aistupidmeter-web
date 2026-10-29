import { NextRequest, NextResponse } from 'next/server';
import { readCancelLink } from '@/lib/cancel-link';
import { cancelFromLink } from '@/lib/billing-watch';

export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/cancel — the button on /billing/cancel. The signed link is the authorisation
 * (no sign-in), and it can only end that one subscription, at the close of the period already
 * paid for. Always returns to the page, which reads the result from Stripe.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const field = (k: string) => {
    const v = form?.get(k);
    return typeof v === 'string' ? v : undefined;
  };
  const p = { u: field('u'), s: field('s'), t: field('t') };
  // Built from config: behind nginx, request.url is the loopback address.
  const base = process.env.NEXT_PUBLIC_APP_URL || request.url;
  const link = readCancelLink(p);
  if (!link) return NextResponse.redirect(new URL('/billing/cancel', base), 303);

  let ok = true;
  try {
    const st = await cancelFromLink(link.userId, link.subscriptionId);
    ok = st.state !== 'invalid';
  } catch (err) {
    ok = false;
    console.error('[billing/cancel] failed:', err instanceof Error ? err.message : err);
  }
  const q = new URLSearchParams({ u: p.u!, s: p.s!, t: p.t!, ...(ok ? { done: '1' } : { error: '1' }) });
  return NextResponse.redirect(new URL(`/billing/cancel?${q}`, base), 303);
}
