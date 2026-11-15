'use client';

import { useState } from 'react';

export default function ConfirmNoticeEmail({ p, at, t }: { p: string; at: string; t: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [text, setText] = useState<string>('');
  const valid = /^[a-z2-7]{10}$/.test(p) && /^[0-9]{10,16}$/.test(at) && /^[0-9a-f]{40}$/.test(t);
  const confirm = async () => {
    setState('busy');
    try {
      const r = await fetch('/api/marketplace/notice-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p, at, t }) });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) { setState('done'); setText(`Confirmed: ${j.data?.email ?? 'this address'} now receives legal notices for ${j.data?.providerName ?? 'the provider account'}.`); }
      else { setState('error'); setText(j?.message || 'We could not confirm this address.'); }
    } catch {
      setState('error'); setText('We could not reach the server. Try again in a moment.');
    }
  };
  if (!valid) return <p role="alert">This link is not complete. Open the link from the email again, or ask for a new one from your provider console.</p>;
  if (state === 'done') return <p role="status">{text}</p>;
  return (
    <div className="mp-confirm">
      <p>Press the button to confirm that this address receives legal notices for the provider account that sent you the link.</p>
      <button type="button" className="lp-btn lp-btn-primary lp-btn-lg" onClick={confirm} disabled={state === 'busy'}>{state === 'busy' ? 'Confirming…' : 'Confirm this address'}</button>
      {state === 'error' && <p role="alert">{text}</p>}
    </div>
  );
}
