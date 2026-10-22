'use client';

import { useState, type FormEvent } from 'react';
import { Pane } from '@/components/studio';
import { ExternalLink } from './bits';

type Outcome = 'unsubscribed' | 'already' | 'no_account';
const OUTCOME: Record<Outcome, string> = {
  unsubscribed: 'Unsubscribed',
  already: 'Already unsubscribed',
  no_account: 'No account with this address',
};

export default function ToolsTab({ onUpdateDaily, updating, updateNote, onRefresh, refreshing }: {
  onUpdateDaily: () => void;
  updating: boolean;
  updateNote: { tone: 'good' | 'bad'; text: string } | null;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<{ email: string; outcome: Outcome }[]>([]);

  // People who reply "unsubscribe" to product mail: same change as the one-click unsubscribe link.
  const unsubscribe = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setResults([]);
    try {
      const r = await fetch('/api/admin/unsubscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || `Failed (${r.status}). Nothing was changed.`); return; }
      setResults(j.results || []);
      setText('');
    } catch {
      setError('Could not reach the server. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="st-split">
      <Pane
        title="Unsubscribe"
        sub="Paste the addresses of people who replied “unsubscribe”: one or several, or the whole reply. Their weekly digest and alerts are switched off and product emails skip them. Sign-in and password emails still work."
      >
        <form onSubmit={unsubscribe} className="ad-form">
          <div className="st-field">
            <label htmlFor="unsub-text" className="st-field-label">Email addresses</label>
            <textarea
              id="unsub-text"
              className="st-textarea"
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
              placeholder="name@example.com"
            />
          </div>
          <div>
            <button type="submit" className="st-btn is-primary" disabled={busy || !text.trim()}>
              {busy ? 'Unsubscribing…' : 'Unsubscribe'}
            </button>
          </div>
        </form>
        {error && <p className="st-error ad-gap" role="alert">{error}</p>}
        {results.length > 0 && (
          <ul className="ad-results" role="status">
            {results.map(r => (
              <li key={r.email}>
                <span className={r.outcome === 'no_account' ? 'st-error' : 'ad-ok'}>{OUTCOME[r.outcome]}</span>
                <span className="ad-ellip">{r.email}</span>
              </li>
            ))}
          </ul>
        )}
      </Pane>

      <div className="ad-stack">
        <Pane title="Maintenance" delay={0.06}>
          <div className="ad-tool">
            <div>
              <p className="ad-tool-t">Update daily stats</p>
              <p className="st-hint">Recomputes the visitor totals per day now, instead of at the next hourly roll-up.</p>
            </div>
            <button type="button" className="st-btn is-sm" onClick={onUpdateDaily} disabled={updating}>{updating ? 'Updating…' : 'Update'}</button>
          </div>
          {updateNote && <p className={updateNote.tone === 'good' ? 'ad-ok ad-gap' : 'st-error ad-gap'} role="status">{updateNote.text}</p>}
          <div className="ad-tool">
            <div>
              <p className="ad-tool-t">Refresh everything</p>
              <p className="st-hint">Reads the databases, Stripe and the router usage again, skipping the five-minute Stripe cache.</p>
            </div>
            <button type="button" className="st-btn is-sm" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
          </div>
        </Pane>
        <Pane title="Elsewhere" delay={0.1}>
          <ul className="ad-links">
            <li><ExternalLink href="https://dashboard.stripe.com">Stripe dashboard</ExternalLink><span className="st-hint">Payments, refunds, customers</span></li>
            <li><a className="ad-int" href="/router/forum/admin">Forum admin</a><span className="st-hint">Reports, roles, moderation</span></li>
            <li><a className="ad-int" href="/status">Status page</a><span className="st-hint">Providers and our own service</span></li>
          </ul>
        </Pane>
      </div>
    </div>
  );
}
