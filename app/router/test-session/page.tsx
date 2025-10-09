'use client';

import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';

export default function TestSessionPage() {
  const { data: session, status } = useSession();

  return (
    <RouterLayout>
      <div className="vintage-container">
        <div className="crt-monitor">
          <div className="terminal-text">
            <div style={{ fontSize: '1.5em', marginBottom: '16px' }}>
              <span className="terminal-text--green">SESSION DEBUG</span>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <div className="terminal-text--dim">Status:</div>
              <div className="terminal-text--green">{status}</div>
            </div>

            {session && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <div className="terminal-text--dim">User ID:</div>
                  <div className="terminal-text--green">{session.user?.id || 'NOT SET'}</div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div className="terminal-text--dim">Email:</div>
                  <div className="terminal-text--green">{session.user?.email || 'NOT SET'}</div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div className="terminal-text--dim">Name:</div>
                  <div className="terminal-text--green">{session.user?.name || 'NOT SET'}</div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div className="terminal-text--dim">Full Session Object:</div>
                  <pre style={{ 
                    background: 'var(--terminal-black)', 
                    padding: '12px', 
                    borderRadius: '4px',
                    overflow: 'auto',
                    fontSize: '0.8em'
                  }}>
                    {JSON.stringify(session, null, 2)}
                  </pre>
                </div>
              </>
            )}

            {!session && status === 'unauthenticated' && (
              <div className="terminal-text--red">
                NOT AUTHENTICATED - Please sign in first
              </div>
            )}
          </div>
        </div>
      </div>
    </RouterLayout>
  );
}
