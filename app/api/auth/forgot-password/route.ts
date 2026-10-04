import { NextRequest, NextResponse } from 'next/server';
import { createPasswordResetToken, findUserByEmail } from '@/lib/db-client';
import { sendPasswordResetEmail } from '@/lib/email-service';
import { clientIp, limited, secondsSince } from '@/lib/ip-rate-limit';

const SENT = 'If an account exists with this email, you will receive a password reset link.';

export async function POST(request: NextRequest) {
  try {
    // Every reset email costs sending reputation, and an unlimited form can flood an inbox
    // from our server: five requests per IP per fifteen minutes.
    if (limited(`forgot-password:${clientIp(request)}`, 5, 15 * 60_000)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a few minutes and try again.' },
        { status: 429 }
      );
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // One reset email per account a minute. The answer is the same as a sent one, so it
    // reveals nothing about whether the account exists.
    const since = secondsSince(findUserByEmail(email)?.reset_requested_at);
    if (since !== null && since < 60) {
      return NextResponse.json({ success: true, message: SENT });
    }

    // Create reset token (returns null if user doesn't exist)
    const result = createPasswordResetToken(email);

    // Always return success to prevent email enumeration
    // Even if user doesn't exist, we return success
    if (!result) {
      console.log(`[AUTH] Password reset requested for non-existent email: ${email}`);
      return NextResponse.json({
        success: true,
        message: SENT,
      });
    }

    // Generate reset link
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/auth/reset-password?token=${result.token}`;

    // Send email
    const emailResult = await sendPasswordResetEmail(email, result.token, resetLink);

    if (!emailResult.success) {
      console.error('[AUTH] Failed to send password reset email:', emailResult.error);
      return NextResponse.json(
        { error: 'Failed to send reset email. Please try again later.' },
        { status: 500 }
      );
    }

    console.log(`[AUTH] Password reset email sent to: ${email}`);

    return NextResponse.json({
      success: true,
      message: SENT,
    });
  } catch (error) {
    console.error('[AUTH] Error in forgot-password:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}
