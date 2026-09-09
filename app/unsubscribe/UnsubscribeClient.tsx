'use client';

import { useState } from 'react';

export default function UnsubscribeClient({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  const go = async () => {
    setState('busy');
    try {
      const r = await fetch(`/api/unsubscribe?t=${encodeURIComponent(token)}`, { method: 'POST' });
      setState(r.ok ? 'done' : 'error');
    } catch { setState('error'); }
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '60px 20px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '1.3em', marginBottom: 12 }}>Stop these emails?</h1>
      {state === 'done' ? (
        <p style={{ lineHeight: 1.6 }}>
          Done — no more digests or alerts. Your watchlist is untouched, and you can turn
          them back on any time from your account settings.
        </p>
      ) : (
        <>
          <p style={{ color: '#5f6368', lineHeight: 1.6, marginBottom: 24 }}>
            This turns off the weekly digest and change alerts. It does not delete your
            account or your watchlist.
          </p>
          <button onClick={go} disabled={state === 'busy' || !token} className="vintage-btn"
            style={{ padding: '10px 20px', cursor: token ? 'pointer' : 'not-allowed' }}>
            {state === 'busy' ? 'Working…' : 'Unsubscribe'}
          </button>
          {state === 'error' && (
            <p style={{ color: '#d93025', marginTop: 14, fontSize: '0.9em' }}>
              That did not work. The link may have expired — you can change this in account settings.
            </p>
          )}
          {!token && <p style={{ color: '#d93025', marginTop: 14, fontSize: '0.9em' }}>Missing unsubscribe token.</p>}
        </>
      )}
    </div>
  );
}
