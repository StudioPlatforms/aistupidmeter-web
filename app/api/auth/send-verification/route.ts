import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createEmailVerificationToken, secondsSinceVerificationSent, findUserByEmail } from '@/lib/db-client';
import { sendVerificationEmail } from '@/lib/email-service';

/** Send (or resend) the confirmation link to the signed-in user's own address. */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const user = findUserByEmail(session.user.email);
    if (!user) return NextResponse.json({ success: false, error: 'No such account' }, { status: 404 });
    if (user.email_verified === 1) {
      return NextResponse.json({ success: true, alreadyVerified: true });
    }

    // One a minute is plenty, and it stops this being used to post mail at
    // someone repeatedly.
    const since = secondsSinceVerificationSent(user.id);
    if (since !== null && since < 60) {
      return NextResponse.json(
        { success: false, error: 'too_soon', message: `Try again in ${60 - since} seconds.` },
        { status: 429 }
      );
    }

    const issued = createEmailVerificationToken(user.id);
    if (!issued) return NextResponse.json({ success: false, error: 'Could not issue a token' }, { status: 500 });

    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://aistupidlevel.info';
    await sendVerificationEmail(session.user.email, `${base}/api/auth/verify?token=${issued.token}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[verify] send failed:', error);
    return NextResponse.json({ success: false, error: 'Could not send the email' }, { status: 500 });
  }
}
