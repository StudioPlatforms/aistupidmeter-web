'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send reset email');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
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
          <div style={{ fontSize: '1.5em', marginBottom: '16px', textAlign: 'center' }}>
            <span className="terminal-text--amber">PASSWORD RECOVERY</span>
            <span className="blinking-cursor"></span>
          </div>
          
          {!success ? (
            <>
              <div className="terminal-text--dim" style={{ textAlign: 'center', marginBottom: '20px' }}>
                Enter your email address and we'll send you a link to reset your password
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
                <div style={{ marginBottom: '20px' }}>
                  <div className="terminal-text" style={{ marginBottom: '8px' }}>
                    EMAIL ADDRESS:
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="vintage-btn" 
                    style={{ padding: '12px 32px', fontSize: '1.1em' }}
                  >
                    {loading ? 'SENDING...' : 'SEND RESET LINK'}
                  </button>
                </div>
              </form>

              <div style={{ 
                textAlign: 'center',
                borderTop: '1px solid var(--metal-silver)',
                paddingTop: '16px'
              }}>
                <div className="terminal-text--dim" style={{ marginBottom: '8px' }}>
                  REMEMBER YOUR PASSWORD?
                </div>
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
                  CHECK YOUR EMAIL
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
                  If an account exists with <strong>{email}</strong>, you will receive a password reset link shortly.
                </div>
              </div>

              <div className="terminal-text--amber" style={{ 
                padding: '12px',
                border: '1px solid var(--amber-glow)',
                backgroundColor: 'rgba(255, 170, 0, 0.05)',
                borderRadius: '4px',
                marginBottom: '20px',
                fontSize: '0.9em'
              }}>
                <strong>⚠️ IMPORTANT:</strong>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>The reset link will expire in 1 hour</li>
                  <li>Check your spam folder if you don't see the email</li>
                  <li>You can request a new link if needed</li>
                </ul>
              </div>

              <div style={{ textAlign: 'center' }}>
                <Link href="/auth/signin" className="vintage-btn" style={{ textDecoration: 'none' }}>
                  BACK TO SIGN IN
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
