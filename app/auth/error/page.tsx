'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import AuthShell from '@/components/auth/AuthShell';

interface ErrorCopy {
  title: string;
  body: string;
  /** What the person should actually do next, when there is a better move than retrying. */
  action?: { label: string; href: string };
}

/**
 * NextAuth hands us a machine code in ?error=. Every one of these is an ordinary
 * failure — a stale link, an account that already exists under a different
 * provider, a cancelled consent screen. None of them is an attack, so none of
 * them gets alarm styling: the page used to shout SECURITY BREACH DETECTED at
 * someone who had merely closed the Google popup.
 *
 * OAuthAccountNotLinked is the one worth spelling out. It fires when an email
 * already registered with a password tries Google or GitHub, and the generic
 * message left people stuck on a door they had the key to.
 */
const ERRORS: Record<string, ErrorCopy> = {
  OAuthAccountNotLinked: {
    title: 'This email is already registered',
    body: 'You created this account with an email and password rather than a social login. Sign in that way and it will be the same account, with your watchlist and plan intact.',
    action: { label: 'Sign in with your password', href: '/auth/signin' },
  },
  AccessDenied: {
    title: 'Sign-in was not completed',
    body: 'The provider did not grant access — usually because the consent screen was closed or cancelled. Nothing was changed on your account.',
  },
  Verification: {
    title: 'This link has expired',
    body: 'Sign-in links can only be used once, and they stop working after a while. Request a fresh one and it will arrive in a moment.',
    action: { label: 'Send a new link', href: '/auth/forgot-password' },
  },
  Configuration: {
    title: 'Sign-in is temporarily unavailable',
    body: 'This one is on us, not on you — the sign-in service is misconfigured. Please try again shortly, and get in touch through the contact form if it persists.',
    action: { label: 'Contact us', href: '/contact?topic=support' },
  },
  OAuthCallback: {
    title: 'The provider did not complete sign-in',
    body: 'Google or GitHub returned before finishing. This is almost always transient — trying again usually works.',
  },
  SessionRequired: {
    title: 'Please sign in to continue',
    body: 'That page needs an account. Sign in and we will take you straight there.',
  },
  Default: {
    title: 'Sign-in did not go through',
    body: 'Something interrupted the process. Trying again usually resolves it; if it keeps happening, tell us through the contact form and we will look into it.',
    action: { label: 'Contact us', href: '/contact?topic=support' },
  },
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('error') || 'Default';
  const copy = ERRORS[code] || ERRORS.Default;

  return (
    <AuthShell mode="account">
      <h1 className="au-title">{copy.title}</h1>
      <p className="au-sub">{copy.body}</p>
      <div className="au-stack" style={{ marginTop: 24 }}>
        {copy.action && <Link href={copy.action.href} className="au-btn au-btn-primary au-btn-block">{copy.action.label}</Link>}
        <Link href="/auth/signin" className={`au-btn au-btn-block ${copy.action ? 'au-btn-ghost' : 'au-btn-primary'}`}>
          {copy.action ? 'Back to sign in' : 'Try again'}
        </Link>
        <Link href="/" className="au-btn au-btn-ghost au-btn-block">Go to the home page</Link>
      </div>
      {/* Support needs the code; the reader does not need it shouted at them. */}
      <p className="au-ref">Reference: {code}</p>
    </AuthShell>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<AuthShell mode="account"><p className="au-busy" role="status">Loading…</p></AuthShell>}>
      <ErrorContent />
    </Suspense>
  );
}
