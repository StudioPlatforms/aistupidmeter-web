'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

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

/** Where to go after signing in: the page that sent them here, if it is on this site. */
function safeReturnPath(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : '/router';
}

export function SignInForm() {
  const searchParams = useSearchParams();
  const verified = searchParams.get('verified');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
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

      // Use window.location for hard redirect to ensure session is properly loaded
      window.location.href = safeReturnPath(searchParams.get('callbackUrl'));
    } catch (err) {
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

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    console.log('[CLIENT] OAuth button clicked', { provider });
    try {
      console.log('[CLIENT] Calling signIn...');
      const result = await signIn(provider, { redirect: true });
      console.log('[CLIENT] signIn returned', { result });
    } catch (error) {
      console.error('[CLIENT] signIn error', error);
    }
  };

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
            Sign in
          </div>
          <div className="terminal-text--dim" style={{ textAlign: 'center', marginBottom: '20px', lineHeight: 1.55 }}>
            Your watchlist, alerts, plan and the Smart Router — all in one account.
          </div>
          
          {searchParams.get('deleted') === '1' && !unverified && !error && (
            <div className="auth-note auth-note--good" role="status">
              Your account has been deleted. We have sent a confirmation to your email address.
            </div>
          )}
          {verified === '1' && !unverified && !error && (
            <div className="auth-note auth-note--good" role="status">
              Your email is confirmed. Sign in to start using your account.
            </div>
          )}
          {searchParams.get('sso') === 'required' && !unverified && !error && (
            <div className="auth-note auth-note--warn" role="status">
              Your organisation signs in with single sign-on. Use &ldquo;Continue with SSO&rdquo; below
              with your work email.
            </div>
          )}
          {verified === 'expired' && !unverified && !error && (
            <div className="auth-note auth-note--warn" role="status">
              That confirmation link has expired or was already used. If you have already confirmed,
              just sign in. If not, sign in and we will offer you a new link.
            </div>
          )}

          {unverified && (
            <div className="auth-note auth-note--warn" role="alert">
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Confirm your email first</div>
              <div>
                We sent a confirmation link to <b>{formData.email}</b> when you signed up. Open it, then
                sign in here.
              </div>
              <div style={{ marginTop: 10 }}>
                {resendState === 'sent' ? (
                  <span>A new link is on its way. It can take a minute; check your spam folder too.</span>
                ) : (
                  <button type="button" className="vintage-btn" onClick={resendConfirmation}
                    disabled={resendState === 'sending'} style={{ padding: '7px 14px', fontSize: '0.9em' }}>
                    {resendState === 'sending' ? 'Sending…' : 'Send a new link'}
                  </button>
                )}
                {resendState === 'failed' && (
                  <span style={{ marginLeft: 10 }}>That did not work. Please wait a minute and try again.</span>
                )}
              </div>
              <div style={{ marginTop: 10, fontSize: '0.88em', opacity: 0.85 }}>
                Still nothing? Some email providers block new senders.{' '}
                <Link href="/contact" style={{ color: 'inherit', textDecoration: 'underline' }}>Contact us</Link>{' '}
                and we will sort it out.
              </div>
            </div>
          )}

          {error && (
            <div className="terminal-text--red" style={{ 
              marginBottom: '16px', 
              textAlign: 'center',
              padding: '8px',
              border: '1px solid var(--red-alert)',
              backgroundColor: 'rgba(255, 45, 0, 0.1)',
              borderRadius: '4px'
            }}>
              ⚠ {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <div className="terminal-text" style={{ marginBottom: '8px' }}>
                Email address
              </div>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your@email.com"
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'var(--terminal-black)',
                  border: '1px solid var(--metal-silver)',
                  borderRadius: '4px',
                  color: 'var(--phosphor-green)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div className="terminal-text" style={{ marginBottom: '8px' }}>
                Password
              </div>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter your password"
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'var(--terminal-black)',
                  border: '1px solid var(--metal-silver)',
                  borderRadius: '4px',
                  color: 'var(--phosphor-green)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px'
                }}
              />
              <div style={{ textAlign: 'right', marginTop: '8px' }}>
                <Link 
                  href="/auth/forgot-password" 
                  className="terminal-text--amber"
                  style={{ 
                    fontSize: '0.9em',
                    textDecoration: 'none',
                    opacity: 0.8,
                    transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                >
                  Forgot password?
                </Link>
              </div>
            </div>
            
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <button type="submit" disabled={loading} className="vintage-btn" style={{ padding: '12px 32px', fontSize: '1.1em' }}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div style={{ 
            textAlign: 'center', 
            margin: '20px 0',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '0',
              right: '0',
              height: '1px',
              background: 'var(--metal-silver)',
              opacity: '0.3'
            }}></div>
            <span style={{
              position: 'relative',
              background: 'var(--terminal-black)',
              padding: '0 16px',
              color: 'var(--phosphor-dim)',
              fontSize: '0.9em'
            }}>OR</span>
          </div>

          {/* OAuth Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            <button
              onClick={() => handleOAuthSignIn('google')}
              disabled={loading}
              className="vintage-btn"
              style={{ width: '100%', padding: '12px' }}
            >
              Continue with Google
            </button>

            <button
              onClick={() => handleOAuthSignIn('github')}
              disabled={loading}
              className="vintage-btn"
              style={{ width: '100%', padding: '12px' }}
            >
              Continue with GitHub
            </button>

            <Link href="/auth/sso" className="vintage-btn"
              style={{ width: '100%', padding: '12px', textAlign: 'center', textDecoration: 'none' }}>
              Continue with SSO
            </Link>
          </div>

          {/* Sign Up Link */}
          <div style={{ 
            textAlign: 'center',
            borderTop: '1px solid var(--metal-silver)',
            paddingTop: '16px'
          }}>
            <div className="terminal-text--amber" style={{ marginBottom: '8px' }}>
              New to AI Stupid Level?
            </div>
            <Link href="/auth/signup" className="vintage-btn" style={{ textDecoration: 'none' }}>
              Create a free account
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: '20px',
        fontSize: '0.8em'
      }}>
        <div className="terminal-text--dim">
          Free to create. We never sell your data, and we take no money from any model provider.
        </div>
      </div>
    </div>
  );
}
