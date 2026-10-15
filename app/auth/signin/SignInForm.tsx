'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';

/**
 * What each sign-in failure code (auth.ts, SignInFailure) means to the person.
 * NextAuth only passes the code; the sentence is ours.
 */
const FAILURE: Record<string, string> = {
  missing: 'Enter your email address and password.',
  no_account: 'No account uses this email address. Check it for typos, or create a free account below.',
  wrong_password: 'Incorrect password. Try again, or use “Forgot password?” to choose a new one.',
  use_google: 'This account signs in with Google. Use “Continue with Google” below.',
  use_github: 'This account signs in with GitHub. Use “Continue with GitHub” below.',
  use_social: 'This account signs in with Google or GitHub. Use one of the buttons below.',
  use_sso: 'Your organisation signs in with single sign-on. Use “Continue with SSO” below with your work email.',
};

/**
 * Where to go after signing in: the page that sent them here, if it is on this site; otherwise the
 * leaderboard, which is what an account unlocks.
 */
export function safeReturnPath(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : '/';
}

export function SignInForm() {
  const searchParams = useSearchParams();
  const verified = searchParams.get('verified');
  const returnTo = safeReturnPath(searchParams.get('callbackUrl'));
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUnverified(false);
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        if (result.code === 'unverified') {
          setUnverified(true);
          setResendState('idle');
        } else {
          setError(FAILURE[result.code ?? ''] ?? 'Sign-in failed. Please try again in a moment.');
        }
        setLoading(false);
        return;
      }

      // A hard redirect, so the next page loads with the new session.
      window.location.href = returnTo;
    } catch {
      setError('Sign-in failed. Please try again in a moment.');
      setLoading(false);
    }
  };

  /** Mail a fresh confirmation link to the address typed above. */
  const resendConfirmation = async () => {
    setResendState('sending');
    try {
      const r = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });
      setResendState(r.ok ? 'sent' : 'failed');
    } catch {
      setResendState('failed');
    }
  };

  const handleOAuthSignIn = (provider: 'google' | 'github') => {
    signIn(provider, { callbackUrl: returnTo });
  };

  const quiet = !unverified && !error;
  const signupHref = returnTo === '/' ? '/auth/signup' : `/auth/signup?callbackUrl=${encodeURIComponent(returnTo)}`;

  return (
    <AuthShell mode="signin">
      <h1 className="au-title">Sign in</h1>
      <p className="au-sub">Your leaderboard, watchlist, alerts and Smart Router — all in one account.</p>

      {searchParams.get('deleted') === '1' && quiet && (
        <div className="au-note au-note-good" role="status">
          Your account has been deleted. We have sent a confirmation to your email address.
        </div>
      )}
      {verified === '1' && quiet && (
        <div className="au-note au-note-good" role="status">
          Your email is confirmed. Sign in to start using your account.
        </div>
      )}
      {searchParams.get('sso') === 'required' && quiet && (
        <div className="au-note au-note-warn" role="status">
          Your organisation signs in with single sign-on. Use &ldquo;Continue with SSO&rdquo; below with your work email.
        </div>
      )}
      {verified === 'expired' && quiet && (
        <div className="au-note au-note-warn" role="status">
          That confirmation link has expired or was already used. If you have already confirmed, just sign in.
          If not, sign in and we will offer you a new link.
        </div>
      )}

      {unverified && (
        <div className="au-note au-note-warn" role="alert">
          <b>Confirm your email first.</b> We sent a confirmation link to <b>{formData.email}</b> when you signed up.
          Open it, then sign in here.
          <div>
            {resendState === 'sent' ? (
              <p style={{ marginTop: 10 }}>A new link is on its way. It can take a minute; check your spam folder too.</p>
            ) : (
              <button type="button" className="au-btn au-btn-ghost au-btn-sm" onClick={resendConfirmation} disabled={resendState === 'sending'}>
                {resendState === 'sending' ? 'Sending…' : 'Send a new link'}
              </button>
            )}
            {resendState === 'failed' && <p style={{ marginTop: 8 }}>That did not work. Please wait a minute and try again.</p>}
          </div>
          <p style={{ marginTop: 10, fontSize: 13 }}>
            Still nothing? Some email providers block new senders. <Link href="/contact">Contact us</Link> and we will sort it out.
          </p>
        </div>
      )}

      {error && <div className="au-note au-note-bad" role="alert">{error}</div>}

      <form className="au-form" onSubmit={handleSubmit}>
        <div className="au-field">
          <label className="au-label" htmlFor="au-email">Email address</label>
          <input id="au-email" className="au-input" type="email" autoComplete="email" value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="you@company.com" required disabled={loading} />
        </div>
        <div className="au-field">
          <span className="au-label"><label htmlFor="au-password">Password</label><Link href="/auth/forgot-password">Forgot password?</Link></span>
          <input id="au-password" className="au-input" type="password" autoComplete="current-password" value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="Your password" required disabled={loading} />
        </div>
        <button type="submit" className="au-btn au-btn-primary au-btn-block" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>

      <div className="au-or">or</div>
      <div className="au-stack">
        <button type="button" className="au-btn au-btn-ghost au-btn-block" onClick={() => handleOAuthSignIn('google')} disabled={loading}>Continue with Google</button>
        <button type="button" className="au-btn au-btn-ghost au-btn-block" onClick={() => handleOAuthSignIn('github')} disabled={loading}>Continue with GitHub</button>
        <Link href="/auth/sso" className="au-btn au-btn-ghost au-btn-block">Continue with SSO</Link>
      </div>

      <p className="au-alt">New to AI Stupid Level? <Link href={signupHref}>Create a free account</Link></p>
    </AuthShell>
  );
}
