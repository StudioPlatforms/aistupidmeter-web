'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const errorMessages: Record<string, string> = {
    Configuration: 'Server configuration malfunction detected.',
    AccessDenied: 'Access denied. Insufficient clearance level.',
    Verification: 'Verification token expired or corrupted.',
    Default: 'Authentication protocol failure.',
  };

  const message = errorMessages[error || 'Default'] || errorMessages.Default;

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
            <span className="terminal-text--red">SYSTEM ERROR</span>
            <span className="blinking-cursor"></span>
          </div>
          <div className="terminal-text--dim" style={{ textAlign: 'center', marginBottom: '20px' }}>
            Authentication Protocol Failure
          </div>
          
          {/* Error Display */}
          <div className="terminal-text--red" style={{ 
            marginBottom: '20px', 
            textAlign: 'center',
            padding: '16px',
            border: '2px solid var(--red-alert)',
            backgroundColor: 'rgba(255, 45, 0, 0.1)',
            borderRadius: '8px',
            fontSize: '1.1em'
          }}>
            <div style={{ fontSize: '2em', marginBottom: '8px' }}>⚠</div>
            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
              AUTHENTICATION ERROR
            </div>
            <div className="terminal-text--amber">
              {message}
            </div>
          </div>

          {/* Error Code Display */}
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '20px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.9em'
          }}>
            <div className="terminal-text--dim">ERROR CODE:</div>
            <div className="terminal-text--green">
              {error || 'UNKNOWN'}_{Date.now().toString().slice(-6)}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            <Link href="/auth/signin" className="vintage-btn" style={{ 
              textDecoration: 'none',
              textAlign: 'center',
              padding: '12px',
              fontSize: '1.1em'
            }}>
              🔄 RETRY AUTHENTICATION
            </Link>

            <Link href="/" className="vintage-btn" style={{ 
              textDecoration: 'none',
              textAlign: 'center',
              padding: '12px'
            }}>
              🏠 RETURN TO MAIN TERMINAL
            </Link>
          </div>

          {/* Help Section */}
          <div style={{ 
            textAlign: 'center',
            borderTop: '1px solid var(--metal-silver)',
            paddingTop: '16px'
          }}>
            <div className="terminal-text--amber" style={{ marginBottom: '8px', fontSize: '0.9em' }}>
              NEED ASSISTANCE?
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
              Contact system administrator if error persists
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: '20px',
        fontSize: '0.8em'
      }}>
        <div className="terminal-text--red">
          <span className="blinking-cursor">█</span> SECURITY BREACH DETECTED
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="vintage-container" style={{ 
        maxWidth: '500px', 
        margin: '0 auto', 
        paddingTop: '60px',
        textAlign: 'center'
      }}>
        <div className="crt-monitor">
          <div className="terminal-text">
            <div className="terminal-text--green">LOADING...</div>
            <span className="blinking-cursor"></span>
          </div>
        </div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
