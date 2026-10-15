'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';

/**
 * Where to go once the account exists: the page that sent them here (?callbackUrl=, or the
 * older ?next= the watch star uses), so "Sign up to track this model" lands back on it. Only a
 * same-site path is honoured — never another origin. Otherwise the leaderboard, which is what the
 * account unlocks. Read at submit time rather than with useSearchParams, which would need a
 * Suspense boundary on this statically rendered page.
 */
function returnPath(): string {
  if (typeof window === 'undefined') return '/';
  const sp = new URLSearchParams(window.location.search);
  const raw = sp.get('callbackUrl') || sp.get('next') || '';
  return raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : '/';
}

export default function SignUpPage() {
  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Set once the account exists: the address the confirmation link went to.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) return 'Password must be at least 8 characters long';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to create account');
        setLoading(false);
        return;
      }
      // Since 2026-10-04 a password account is finished by confirming the email: the
      // welcome email carries the link, and signing in waits until it has been opened.
      // (Google and GitHub sign-ups skip this; the provider has verified the address.)
      setSentTo(formData.email);
      setResendState('idle');
      setLoading(false);
    } catch {
      setError('An error occurred during registration');
      setLoading(false);
    }
  };

  const handleOAuthSignIn = (provider: 'google' | 'github') => {
    signIn(provider, { callbackUrl: returnPath() });
  };

  /** Mail a fresh confirmation link. Rate-limited server-side; the button is a convenience. */
  const resendConfirmation = async () => {
    if (!sentTo) return;
    setResendState('sending');
    try {
      const r = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sentTo }),
      });
      setResendState(r.ok ? 'sent' : 'failed');
    } catch {
      setResendState('failed');
    }
  };

  if (sentTo) {
    return (
      <AuthShell mode="signup">
        <h1 className="au-title">Check your inbox</h1>
        <p className="au-sub">
          We sent a confirmation link to <b>{sentTo}</b>. Open it to finish creating your account, then sign in.
          The link is valid for 24 hours.
        </p>
        <div className="au-stack" style={{ marginTop: 24 }}>
          {resendState === 'sent' ? (
            <div className="au-note au-note-good" role="status" style={{ marginTop: 0 }}>
              A new link is on its way. It can take a minute; check your spam folder too.
            </div>
          ) : (
            <button type="button" className="au-btn au-btn-ghost au-btn-block" onClick={resendConfirmation} disabled={resendState === 'sending'}>
              {resendState === 'sending' ? 'Sending…' : 'Send the link again'}
            </button>
          )}
          {resendState === 'failed' && (
            <div className="au-note au-note-warn" role="alert" style={{ marginTop: 0 }}>That did not work. Please wait a minute and try again.</div>
          )}
          <Link href="/auth/signin" className="au-btn au-btn-primary au-btn-block">I have confirmed, sign in</Link>
        </div>
        <p className="au-alt">
          Wrong address?{' '}
          <button type="button" className="au-text-btn" onClick={() => { setSentTo(null); setFormData({ email: '', password: '', confirmPassword: '' }); }}>
            Start again
          </button>
          <br />
          Nothing after a few minutes? Check your spam folder. Some email providers block new senders;{' '}
          <Link href="/contact">contact us</Link> and we will sort it out.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell mode="signup">
      <h1 className="au-title">Create your free account</h1>
      <p className="au-sub">See every ranking, watch three models and route your first 1,000 requests. No card required.</p>

      {error && <div className="au-note au-note-bad" role="alert">{error}</div>}

      <form className="au-form" onSubmit={handleSubmit}>
        <div className="au-field">
          <label className="au-label" htmlFor="au-email">Email address</label>
          <input id="au-email" className="au-input" type="email" autoComplete="email" value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="you@company.com" required disabled={loading} />
        </div>
        <div className="au-field">
          <label className="au-label" htmlFor="au-password">Password</label>
          <input id="au-password" className="au-input" type="password" autoComplete="new-password" value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="At least 8 characters" required disabled={loading} />
          <span className="au-hint">At least 8 characters, with an uppercase letter, a lowercase letter and a number.</span>
        </div>
        <div className="au-field">
          <label className="au-label" htmlFor="au-confirm">Confirm password</label>
          <input id="au-confirm" className="au-input" type="password" autoComplete="new-password" value={formData.confirmPassword}
            onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} placeholder="Type it again" required disabled={loading} />
        </div>
        <button type="submit" className="au-btn au-btn-primary au-btn-block" disabled={loading}>{loading ? 'Creating your account…' : 'Create account'}</button>
      </form>

      <div className="au-or">or</div>
      <div className="au-stack">
        <button type="button" className="au-btn au-btn-ghost au-btn-block" onClick={() => handleOAuthSignIn('google')} disabled={loading}>Continue with Google</button>
        <button type="button" className="au-btn au-btn-ghost au-btn-block" onClick={() => handleOAuthSignIn('github')} disabled={loading}>Continue with GitHub</button>
      </div>

      <p className="au-alt">Already have an account? <Link href="/auth/signin">Sign in</Link></p>
    </AuthShell>
  );
}
