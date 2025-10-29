'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link');
      setValidating(false);
      return;
    }

    // Validate token on mount
    fetch(`/api/auth/reset-password?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.valid) {
          setTokenValid(true);
          setEmail(data.email);
        } else {
          setError(data.error || 'Invalid or expired reset link');
        }
        setValidating(false);
      })
      .catch(() => {
        setError('Failed to validate reset link');
        setValidating(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset password');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      // Redirect to sign in after 3 seconds
      setTimeout(() => {
        router.push('/auth/signin');
      }, 3000);
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="vintage-container" style={{ 
        maxWidth: '500px', 
        margin: '0 auto', 
        paddingTop: '60px'
      }}>
        <div className="crt-monitor">
          <div className="terminal-text" style={{ textAlign: 'center', padding: '40px' }}>
            <div className="terminal-text--amber" style={{ fontSize: '1.2em' }}>
              VALIDATING RESET LINK<span className="blinking-cursor"></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="vintage-container" style={{ 
        maxWidth: '500px', 
        margin: '0 auto', 
        paddingTop: '60px'
      }}>
        <div className="crt-monitor">
          <div className="terminal-text">
            <div style={{ fontSize: '1.5em', marginBottom: '16px', textAlign: 'center' }}>
              <span className="terminal-text--red">INVALID LINK</span>
            </div>
            
            <div className="terminal-text--red" style={{ 
              textAlign: 'center',
              padding: '20px',
              border: '2px solid var(--red-alert)',
              backgroundColor: 'rgba(255, 45, 0, 0.1)',
              borderRadius: '4px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '2em', marginBottom: '10px' }}>⚠</div>
              <div style={{ marginBottom: '10px' }}>{error}</div>
              <div className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
                The reset link may have expired or been used already
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <Link href="/auth/forgot-password" className="vintage-btn" style={{ textDecoration: 'none', marginRight: '10px' }}>
                REQUEST NEW LINK
              </Link>
              <Link href="/auth/signin" className="vintage-btn" style={{ textDecoration: 'none' }}>
                BACK TO SIGN IN
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            <span className="terminal-text--green">RESET PASSWORD</span>
            <span className="blinking-cursor"></span>
          </div>
          
          {!success ? (
            <>
              <div className="terminal-text--dim" style={{ textAlign: 'center', marginBottom: '20px' }}>
                Enter a new password for <strong>{email}</strong>
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
                    NEW PASSWORD:
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    disabled={loading}
                    minLength={8}
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
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    disabled={loading}
                    minLength={8}
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

                <div className="terminal-text--dim" style={{ 
                  fontSize: '0.85em',
                  marginBottom: '20px',
                  padding: '8px',
                  border: '1px solid var(--metal-silver)',
                  borderRadius: '4px'
                }}>
                  <strong>Password requirements:</strong>
                  <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                    <li>At least 8 characters long</li>
                    <li>Mix of letters, numbers, and symbols recommended</li>
                  </ul>
                </div>
                
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="vintage-btn" 
                    style={{ padding: '12px 32px', fontSize: '1.1em' }}
                  >
                    {loading ? 'RESETTING...' : 'RESET PASSWORD'}
                  </button>
                </div>
              </form>

              <div style={{ 
                textAlign: 'center',
                borderTop: '1px solid var(--metal-silver)',
                paddingTop: '16px'
              }}>
                <Link href="/auth/signin" className="vintage-btn" style={{ textDecoration: 'none' }}>
                  BACK TO SIGN IN
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="terminal-text--green" style={{ 
                textAlign: 'center',
                padding: '20px',
                border: '2px solid var(--phosphor-green)',
                backgroundColor: 'rgba(0, 255, 0, 0.05)',
                borderRadius: '4px',
                marginBottom: '20px'
              }}>
                <div style={{ fontSize: '2em', marginBottom: '10px' }}>✓</div>
                <div style={{ fontSize: '1.2em', marginBottom: '10px' }}>
                  PASSWORD RESET SUCCESSFUL
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
                  Your password has been updated. Redirecting to sign in...
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <Link href="/auth/signin" className="vintage-btn" style={{ textDecoration: 'none' }}>
                  SIGN IN NOW
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="vintage-container" style={{ 
        maxWidth: '500px', 
        margin: '0 auto', 
        paddingTop: '60px'
      }}>
        <div className="crt-monitor">
          <div className="terminal-text" style={{ textAlign: 'center', padding: '40px' }}>
            <div className="terminal-text--amber" style={{ fontSize: '1.2em' }}>
              LOADING<span className="blinking-cursor"></span>
            </div>
          </div>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
