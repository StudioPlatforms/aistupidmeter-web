import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, createEmailVerificationToken, secondsSinceVerificationSent } from '@/lib/db-client';
import { sendVerificationEmail } from '@/lib/email-service';
import { clientIp, limited } from '@/lib/ip-rate-limit';

/**
 * Send a new confirmation link to someone who cannot sign in yet.
 *
 * Public, because the person is signed out by definition: password sign-ups since
 * 2026-10-04 must confirm their email before they can sign in. The answer is the same
 * whether or not the address has an account waiting, so it cannot be used to learn who
 * has an account. At most one email per address a minute, and five requests per IP per
 * fifteen minutes. The signed-in equivalent is /api/auth/send-verification.
 */
const SENT = {
  success: true,
  message: 'If that address has an account waiting for confirmation, a new link is on its way.',
};

export async function POST(request: NextRequest) {
  if (limited(`resend-verification:${clientIp(request)}`, 5, 15 * 60_000)) {
    return NextResponse.json(
      { success: false, error: 'rate_limited', message: 'Too many requests. Please wait a few minutes and try again.' },
      { status: 429 },
    );
  }

  let email = '';
  try {
    email = String((await request.json())?.email ?? '').trim();
  } catch {
    /* empty or malformed body: handled below */
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: 'invalid_email', message: 'Enter a valid email address.' }, { status: 400 });
  }

  const user = findUserByEmail(email);
  if (!user || !user.password_hash || user.email_verified) return NextResponse.json(SENT);

  const since = secondsSinceVerificationSent(user.id);
  if (since !== null && since < 60) return NextResponse.json(SENT);

  const issued = createEmailVerificationToken(user.id);
  if (issued) {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://aistupidlevel.info';
    void sendVerificationEmail(user.email, `${base}/api/auth/verify?token=${issued.token}`).catch(() => {});
  }
  return NextResponse.json(SENT);
}
