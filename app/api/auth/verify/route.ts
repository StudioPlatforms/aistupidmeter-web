import { NextRequest, NextResponse } from 'next/server';
import { consumeEmailVerificationToken } from '@/lib/db-client';

/**
 * Consume a verification link.
 *
 * GET is a mutation here, which is normally wrong — but a confirmation link in an
 * email has to work by being clicked, and the token is single-use and unguessable.
 * The mitigation is that consuming it twice is harmless: the second visit simply
 * reports that it is already done.
 */
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://aistupidlevel.info';
  const ok = consumeEmailVerificationToken(token);
  return NextResponse.redirect(`${base}/account/settings?verified=${ok ? '1' : '0'}`);
}
