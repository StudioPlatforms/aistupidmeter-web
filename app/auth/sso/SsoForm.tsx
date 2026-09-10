'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const ERRORS: Record<string, string> = {
  invalid_email: 'That does not look like an email address.',
  no_connection:
    'We could not find single sign-on for that domain. Check the address, or sign in with your password instead.',
  idp_unreachable: 'Your identity provider did not respond. Please try again in a moment.',
  denied: 'Your identity provider declined the sign-in.',
  expired: 'That sign-in took too long and expired. Please start again.',
  bad_callback: 'Your identity provider sent back something we could not read.',
  rejected: 'We could not verify the response from your identity provider.',
  unsupported: 'That connection uses a protocol we do not support.',
  ticket: 'That sign-in link has already been used. Please start again.',
};

export function SsoForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const error = params.get('error');
  const returnTo = params.get('returnTo') || '/account';

  return (
    <div className="vintage-container" style={{ maxWidth: '500px', margin: '0 auto', paddingTop: '60px' }}>
      <div className="crt-monitor">
        <div className="terminal-text">
          <div style={{ fontSize: '1.5em', marginBottom: '10px', textAlign: 'center' }}>
            Sign in with SSO
          </div>
          <div className="terminal-text--dim" style={{ textAlign: 'center', marginBottom: '20px', lineHeight: 1.55 }}>
            Enter your work email and we will send you to your organisation&rsquo;s identity provider.
          </div>

          {error && (
            <div className="terminal-text--red" style={{
              marginBottom: '16px', textAlign: 'center', padding: '10px',
              border: '1px solid var(--red-alert)', backgroundColor: 'rgba(255, 45, 0, 0.1)',
              borderRadius: '4px', lineHeight: 1.5,
            }}>
              {ERRORS[error] ?? 'Single sign-on did not complete. Please try again.'}
            </div>
          )}

          <form
            onSubmit={() => setBusy(true)}
            action="/api/sso/start"
            method="GET"
          >
            <input type="hidden" name="returnTo" value={returnTo} />
            <div style={{ marginBottom: '16px' }}>
              <div className="terminal-text" style={{ marginBottom: '8px' }}>Work email</div>
              <input
                type="email" name="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com" autoComplete="email"
                style={{
                  width: '100%', padding: '8px', background: 'var(--terminal-black)',
                  border: '1px solid var(--metal-silver)', borderRadius: '4px',
                  color: 'var(--phosphor-green)', fontFamily: 'var(--font-mono)', fontSize: '14px',
                }}
              />
            </div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <button type="submit" disabled={busy} className="vintage-btn"
                style={{ padding: '12px 32px', fontSize: '1.1em' }}>
                {busy ? 'Redirecting…' : 'Continue'}
              </button>
            </div>
          </form>

          <div style={{ textAlign: 'center', borderTop: '1px solid var(--metal-silver)', paddingTop: '16px' }}>
            <div className="terminal-text--dim" style={{ marginBottom: '8px', fontSize: '0.9em' }}>
              Not using single sign-on?
            </div>
            <Link href="/auth/signin" className="vintage-btn" style={{ textDecoration: 'none' }}>
              Sign in with a password
            </Link>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.8em' }}>
        <div className="terminal-text--dim">
          SSO is part of Teams and Enterprise. <Link href="/contact?topic=enterprise" style={{ color: 'var(--accent, #1a73e8)' }}>Talk to us</Link> about setting it up.
        </div>
      </div>
    </div>
  );
}
