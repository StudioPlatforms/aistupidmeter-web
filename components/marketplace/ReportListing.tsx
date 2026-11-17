'use client';

import { useState, type FormEvent } from 'react';

/**
 * "Report this listing" (Phase 3 plan §9.5, DSA Art. 16): every public marketplace page carries it. The form posts
 * to /api/marketplace/report (mail-form guard, IP limits, a honeypot), which relays it to the API. Name and email are
 * required; the URL is the page's own; no file uploads.
 */
const CATEGORIES: Array<[string, string]> = [
  ['misleading', 'Misleading information (price, model, data handling)'],
  ['wrong_price', 'Wrong price'],
  ['impersonation', 'Impersonation or trademark'],
  ['intellectual_property', 'Intellectual property'],
  ['illegal', 'Illegal content'],
  ['security', 'Security (credential phishing, malware, a compromised endpoint)'],
  ['measurement', 'Measurement manipulation'],
  ['other', 'Other'],
];

export default function ReportListing({ provider, entry, path }: { provider: string; entry?: string | null; path: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/marketplace/report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider, entry: entry ?? null, category: f.get('category'), explanation: f.get('explanation'), name: f.get('name'), email: f.get('email'),
          goodFaith: f.get('goodFaith') === 'on', url: `https://aistupidlevel.info${path}`, website: f.get('website'),
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.success) { setError(j?.message || 'We could not send your report. Try again in a moment.'); return; }
      setDone(j.data?.reference ? `Thank you. Your reference is ${j.data.reference}; we emailed you a receipt.` : 'Thank you. We emailed you a receipt.');
    } catch {
      setError('We could not send your report. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return <button type="button" className="mp-report-btn" onClick={() => setOpen(true)}>Report this listing</button>;
  if (done) return <p className="mp-report-done" role="status">{done}</p>;
  return (
    <form className="mp-report" onSubmit={submit}>
      <label>What is wrong?
        <select name="category" required defaultValue="">
          <option value="" disabled>Choose one</option>
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>Explain (up to 2,000 characters)
        <textarea name="explanation" required minLength={10} maxLength={2000} rows={5} />
      </label>
      <label>Your name <input name="name" required maxLength={120} autoComplete="name" /></label>
      <label>Your email <input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
      <label className="mp-report-hp" aria-hidden="true">Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
      <label className="mp-report-check"><input type="checkbox" name="goodFaith" required /> I report this in good faith, and what I say is accurate to my knowledge.</label>
      {error && <p role="alert" className="mp-report-err">{error}</p>}
      <div className="mp-report-actions">
        <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>
        <button type="button" className="is-quiet" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {/* M12 (the web and legal review SHOULD-3): as privacy 1.5 says, and the privacy information where the collection starts. */}
      <p className="mp-report-note">A person reviews every report. We tell you our decision; the provider learns about the report only if we act. We don&apos;t routinely tell the provider who sent a report. How we handle your details: <a href="/privacy#providers">our privacy policy</a>.</p>
    </form>
  );
}
