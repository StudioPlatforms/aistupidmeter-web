'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import { safeReturnPath, withReturn } from '@/lib/return-path';

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
  return safeReturnPath(sp.get('callbackUrl') || sp.get('next'));
}

/** Where a new provider account starts (Phase 3 plan §2.1). */
const PROVIDER_START = '/account/provider/new';

/**
 * The return path for what the visitor chose in the switch. "List models as a provider" sends
 * them to the provider set-up page; "Use AI Stupid Level" keeps the page that sent them, unless
 * that page was the provider set-up itself (a provider link, switched back).
 */
function returnPathFor(as: 'use' | 'provider'): string {
  if (as === 'provider') return PROVIDER_START;
  const path = returnPath();
  return path.startsWith('/account/provider') ? '/' : path;
}

/**
 * `providerSignup`: whether the API has provider accounts open to new sign-ups (the server page
 * asks it). Until it says so the page is exactly the ordinary sign-up page, with no switch.
 */
export default function SignUpClient({ providerSignup = false }: { providerSignup?: boolean }) {
  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // The same path for the sign-in links, set after mount (the page is statically rendered). A
  // visitor who picked a plan keeps it whichever way they finish: a Google/GitHub sign-up, the
  // confirmation email, "I have confirmed, sign in", or switching to sign-in.
  const [ret, setRet] = useState('/');
  // The switch: what the account is for. Preset by ?as=provider; shown only when the API has
  // provider sign-ups open, and never on the way to a checkout.
  const [as, setAs] = useState<'use' | 'provider'>('use');
  useEffect(() => {
    const preset = providerSignup && new URLSearchParams(window.location.search).get('as') === 'provider'
      && !returnPath().startsWith('/api/stripe/checkout');
    setAs(preset ? 'provider' : 'use');
    setRet(providerSignup ? returnPathFor(preset ? 'provider' : 'use') : returnPath());
  }, [providerSignup]);
  const choose = (next: 'use' | 'provider') => { setAs(next); setRet(returnPathFor(next)); };
  const toCheckout = ret.startsWith('/api/stripe/checkout');
  const asProvider = providerSignup && as === 'provider' && !toCheckout;
  // Without the switch the return path is exactly what it always was.
  const finalReturn = () => (providerSignup ? returnPathFor(asProvider ? 'provider' : 'use') : returnPath());
  const planName = toCheckout
    ? ({ pro: 'Pro', developer: 'Developer', teams: 'Teams' } as Record<string, string>)[new URLSearchParams(ret.split('?')[1] ?? '').get('plan') ?? ''] ?? null
    : null;
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
        body: JSON.stringify({ email: formData.email, password: formData.password, callbackUrl: finalReturn() }),
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
    signIn(provider, { callbackUrl: finalReturn() });
  };

  /** Mail a fresh confirmation link. Rate-limited server-side; the button is a convenience. */
  const resendConfirmation = async () => {
    if (!sentTo) return;
    setResendState('sending');
    try {
      const r = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sentTo, callbackUrl: finalReturn() }),
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
          We sent a confirmation link to <b>{sentTo}</b>. Open it to finish creating your account, then sign in{toCheckout ? ' — you will go straight on to checkout for your plan' : ''}.
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
          <Link href={withReturn('/auth/signin', ret)} className="au-btn au-btn-primary au-btn-block">I have confirmed, sign in</Link>
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
      {toCheckout ? (
        <>
          <h1 className="au-title">Create your account</h1>
          <p className="au-sub">Make an account and you go straight on to checkout{planName ? ` for ${planName}` : ''}.</p>
        </>
      ) : asProvider ? (
        <>
          <h1 className="au-title">Create your provider account</h1>
          <p className="au-sub">Free, with no card. After you confirm your email you add your company, your endpoint and your API key.</p>
        </>
      ) : (
        <>
          <h1 className="au-title">Create your free account</h1>
          <p className="au-sub">See every ranking, watch three models and route your first 1,000 requests. No card required.</p>
        </>
      )}

      {providerSignup && !toCheckout && (
        <fieldset className="au-choice">
          <legend className="au-label">What will you use AI Stupid Level for?</legend>
          <div className="au-choice-opts">
            <label className={`au-choice-opt${as === 'use' ? ' is-on' : ''}`}>
              <input type="radio" name="au-as" value="use" checked={as === 'use'} onChange={() => choose('use')} disabled={loading} />
              <span>Use AI Stupid Level</span>
            </label>
            <label className={`au-choice-opt${as === 'provider' ? ' is-on' : ''}`}>
              <input type="radio" name="au-as" value="provider" checked={as === 'provider'} onChange={() => choose('provider')} disabled={loading} />
              <span>List models as a provider</span>
            </label>
          </div>
        </fieldset>
      )}

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

      <p className="au-alt">Already have an account? <Link href={withReturn('/auth/signin', ret)}>Sign in</Link></p>
    </AuthShell>
  );
}
