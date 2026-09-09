import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, createUserWithPassword, createEmailVerificationToken } from '@/lib/db-client';
import { recordActivation } from '@/lib/activation';
import { sendWelcomeEmail } from '@/lib/email-service';
import { hashPassword, validateEmail, validatePasswordStrength } from '@/lib/password';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.message },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = findUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = createUserWithPassword(email, passwordHash, name);
    // Entry point of the funnel. Everything downstream — first watchlist save,
    // checkout, renewal — is measured relative to this row.
    recordActivation((user as any)?.id ?? null, 'account_created', 'free');

    // Fire-and-forget: a mail failure must never fail a signup. sendWelcomeEmail
    // already swallows its own errors, and this catch covers the promise itself.
    // Password signups start unverified, and bulk mail only goes to verified
    // addresses — so the welcome email carries the confirmation link. OAuth
    // accounts arrive already verified by the provider and skip this.
    const uid = (user as any)?.id ?? null;
    const issued = uid ? createEmailVerificationToken(uid) : null;
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://aistupidlevel.info';
    const verifyLink = issued ? `${base}/api/auth/verify?token=${issued.token}` : null;
    void sendWelcomeEmail(email, name, verifyLink).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        message: 'Account created successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Sign-up error:', error);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}
