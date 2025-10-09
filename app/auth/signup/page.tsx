'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignUpPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create account');
        setLoading(false);
        return;
      }

      // Auto sign in after successful registration
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError('Account created but sign in failed. Please try signing in manually.');
        setLoading(false);
        return;
      }

      // Redirect to router dashboard
      router.push('/router');
    } catch (err) {
      setError('An error occurred during registration');
      setLoading(false);
    }
  };

  const handleOAuthSignIn = (provider: 'google' | 'github') => {
    signIn(provider, { callbackUrl: '/router' });
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
          <div style={{ fontSize: '1.5em', marginBottom: '16px', textAlign: 'center' }}>
            <span className="terminal-text--green">CREATE ACCOUNT</span>
            <span className="blinking-cursor"></span>
          </div>
          <div className="terminal-text--dim" style={{ textAlign: 'center', marginBottom: '20px' }}>
            Join the AI Router Network
          </div>
          
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
                EMAIL ADDRESS:
              </div>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@domain.com"
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

            <div style={{ marginBottom: '16px' }}>
              <div className="terminal-text" style={{ marginBottom: '8px' }}>
                PASSWORD:
              </div>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Min 8 chars, 1 upper, 1 lower, 1 number"
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
                CONFIRM PASSWORD:
              </div>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Re-enter your password"
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
            
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <button type="submit" disabled={loading} className="vintage-btn" style={{ padding: '12px 32px', fontSize: '1.1em' }}>
                {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
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
              🔗 CONTINUE WITH GOOGLE
            </button>

            <button
              onClick={() => handleOAuthSignIn('github')}
              disabled={loading}
              className="vintage-btn"
              style={{ width: '100%', padding: '12px' }}
            >
              ⚡ CONTINUE WITH GITHUB
            </button>
          </div>

          {/* Sign In Link - Fixed opacity */}
          <div style={{ 
            textAlign: 'center',
            borderTop: '1px solid var(--metal-silver)',
            paddingTop: '16px'
          }}>
            <div className="terminal-text--amber" style={{ marginBottom: '8px' }}>
              ALREADY HAVE AN ACCOUNT?
            </div>
            <Link href="/auth/signin" className="vintage-btn" style={{ textDecoration: 'none' }}>
              SIGN IN
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
          <span className="blinking-cursor">█</span> SECURE CONNECTION ESTABLISHED
        </div>
      </div>
    </div>
  );
}
