'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

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
    body: 'This one is on us, not on you — the sign-in service is misconfigured. Please try again shortly, and email support@aistupidlevel.info if it persists.',
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
    body: 'Something interrupted the process. Trying again usually resolves it; if it keeps happening, email support@aistupidlevel.info and we will look into it.',
  },
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('error') || 'Default';
  const copy = ERRORS[code] || ERRORS.Default;

  return (
    <div className="vintage-container" style={{
      maxWidth: '500px',
      margin: '0 auto',
      paddingTop: '60px'
    }}>
      <style jsx>{`
        @media (min-width: 768px) {
          .vintage-container {
            max-width: 650px !important;
          }
        }
      `}</style>

      <div className="crt-monitor">
        <div className="terminal-text">
          <div style={{ fontSize: '1.5em', marginBottom: '10px', textAlign: 'center' }}>
            {copy.title}
          </div>

          <div className="terminal-text--dim" style={{
            textAlign: 'center',
            marginBottom: '24px',
            lineHeight: 1.55
          }}>
            {copy.body}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {copy.action && (
              <Link href={copy.action.href} className="vintage-btn vintage-btn--primary" style={{
                textDecoration: 'none',
                textAlign: 'center',
                padding: '12px'
              }}>
                {copy.action.label}
              </Link>
            )}

            <Link href="/auth/signin" className="vintage-btn" style={{
              textDecoration: 'none',
              textAlign: 'center',
              padding: '12px'
            }}>
              {copy.action ? 'Back to sign in' : 'Try again'}
            </Link>

            <Link href="/" className="vintage-btn" style={{
              textDecoration: 'none',
              textAlign: 'center',
              padding: '12px'
            }}>
              Return to the leaderboard
            </Link>
          </div>

          {/* Support needs the code; the reader does not need it shouted at them. */}
          <div style={{
            textAlign: 'center',
            borderTop: '1px solid var(--metal-silver)',
            paddingTop: '16px'
          }}>
            <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
              Reference: {code}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="vintage-container" style={{
        maxWidth: '500px',
        margin: '0 auto',
        paddingTop: '60px',
        textAlign: 'center'
      }}>
        <div className="crt-monitor">
          <div className="terminal-text terminal-text--dim">Loading…</div>
        </div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
