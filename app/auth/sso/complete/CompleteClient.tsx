'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

/**
 * Redeem the one-use SSO ticket for a session.
 *
 * The identity provider has already been verified server-side by the time we get
 * here; this page exists only because NextAuth issues sessions from the client
 * side of its credentials flow. It runs once — the ticket is consumed on first
 * redemption, so a React strict-mode double-invoke would otherwise burn it and
 * show a spurious failure.
 */
export default function CompleteClient() {
  const params = useSearchParams();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const ticket = params.get('ticket');
    const returnTo = params.get('returnTo') || '/account';
    if (!ticket) {
      window.location.href = '/auth/sso?error=ticket';
      return;
    }

    signIn('sso-ticket', { ticket, redirect: false })
      .then(res => {
        if (res?.error) {
          setFailed(true);
          window.location.href = '/auth/sso?error=ticket';
          return;
        }
        // Hard navigation so the new session cookie is picked up everywhere.
        window.location.href = returnTo;
      })
      .catch(() => {
        setFailed(true);
        window.location.href = '/auth/sso?error=ticket';
      });
  }, [params]);

  return (
    <div style={{ padding: '80px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.2em', marginBottom: 8 }}>
        {failed ? 'Sign-in failed' : 'Signing you in…'}
      </div>
      <div className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
        {failed ? 'Taking you back to try again.' : 'One moment.'}
      </div>
    </div>
  );
}
