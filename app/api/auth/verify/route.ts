import { NextRequest, NextResponse } from 'next/server';
import { consumeEmailVerificationToken } from '@/lib/db-client';
import { auth } from '@/auth';

/**
 * Consume a verification link.
 *
 * GET is a mutation here, which is normally wrong — but a confirmation link in an
 * email has to work by being clicked, and the token is single-use and unguessable.
 * The mitigation is that consuming it twice is harmless: the second visit simply
 * reports that it is already done.
 *
 * Where it lands: since 2026-10-04 a new password account cannot sign in until it has
 * confirmed, so the person clicking is usually signed out. They go to the sign-in page,
 * which says the address is confirmed (or that the link has expired, with a way to get
 * a new one). Someone already signed in, confirming from Settings, goes back there.
 */
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://aistupidlevel.info';
  const ok = consumeEmailVerificationToken(token);
  const session = await auth().catch(() => null);
  if (session?.user) {
    return NextResponse.redirect(`${base}/account/settings?verified=${ok ? '1' : '0'}`);
  }
  return NextResponse.redirect(`${base}/auth/signin?verified=${ok ? '1' : 'expired'}`);
}
