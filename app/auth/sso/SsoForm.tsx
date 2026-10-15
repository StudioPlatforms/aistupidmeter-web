'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';

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
    <AuthShell mode="signin">
      <h1 className="au-title">Sign in with SSO</h1>
      <p className="au-sub">Enter your work email and we will send you to your organisation&rsquo;s identity provider.</p>
      {error && <div className="au-note au-note-bad" role="alert">{ERRORS[error] ?? 'Single sign-on did not complete. Please try again.'}</div>}
      <form className="au-form" onSubmit={() => setBusy(true)} action="/api/sso/start" method="GET">
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="au-field">
          <label className="au-label" htmlFor="au-sso-email">Work email</label>
          <input id="au-sso-email" className="au-input" type="email" name="email" required value={email}
            onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
        </div>
        <button type="submit" className="au-btn au-btn-primary au-btn-block" disabled={busy}>{busy ? 'Redirecting…' : 'Continue'}</button>
      </form>
      <p className="au-alt">
        Not using single sign-on? <Link href="/auth/signin">Sign in with a password</Link>
        <br />
        <span style={{ fontSize: 13 }}>SSO is part of Teams and Enterprise. <Link href="/contact?topic=enterprise">Talk to us</Link> about setting it up.</span>
      </p>
    </AuthShell>
  );
}
