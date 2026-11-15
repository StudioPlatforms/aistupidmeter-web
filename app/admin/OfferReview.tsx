'use client';

/**
 * Offers waiting for review (Phase 3 plan §8.7, §10.3; M8): a person reviews each offer before it goes live. Approve
 * puts it live (at most 3 live per provider, the API checks); Refuse sends it back to draft with a statement of reasons
 * (a ground and at least 40 characters of facts), which reaches the provider as a notice. Shown only while an offer is
 * in review. The terms page must be on one of the provider's verified domains; they are listed beside it to check.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Note, Pane } from '@/components/studio';
import { fullDate } from './format';
import '@/styles/studio-provider-legal.css';

interface ReviewOffer {
  id: number; kind: string; kindLabel: string; title: string; details: string | null; code: string | null; percent: number | null; termsUrl: string;
  endsAt: string | null; createdAt: string; providerPublicId: string | null; providerName: string | null; internal: boolean; verifiedDomains: string[];
}

const GROUNDS: Array<[string, string]> = [
  ['G3', 'Misleading listing data'], ['G10', 'Offer not honoured'], ['G2', 'Impersonation or infringement'], ['G7', 'Illegal content or sanctions'], ['G11', 'Abuse of our services'],
];

export default function OfferReview({ onChange }: { onChange: () => void }) {
  const [offers, setOffers] = useState<ReviewOffer[]>([]);
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refusing, setRefusing] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/marketplace/offers', { cache: 'no-store' });
      const j = await r.json().catch(() => null);
      setOffers(r.ok && j?.success && Array.isArray(j.data?.offers) ? j.data.offers : []);
    } catch {
      setOffers([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const decide = async (o: ReviewOffer, body: Record<string, unknown>) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/admin/marketplace/offers/${o.id}/decision`, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => null);
      const ok = r.ok && !!j?.success;
      setMsg(ok ? { tone: 'good', text: body.action === 'approve' ? `Approved: “${o.title}” is live.` : `Refused: “${o.title}” is back in draft; the statement is in the provider's notices.` }
        : { tone: 'bad', text: [j?.message || j?.error || `The API answered ${r.status}.`, ...Object.values((j?.fields ?? {}) as Record<string, string>)].join(' ') });
      if (ok) { setRefusing(null); await load(); onChange(); }
    } catch {
      setMsg({ tone: 'bad', text: 'Could not reach the server.' });
    } finally {
      setBusy(false);
    }
  };
  const refuse = (o: ReviewOffer) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    void decide(o, { action: 'refuse', ground: f.ground || null, facts: f.facts || '' });
  };

  if (offers.length === 0 && !msg) return null;
  return (
    <Pane title="Offers to review" sub="Each offer goes live only after a person approves it. Check the terms page is on a verified domain and says what the offer says." ruled>
      {msg && <Note tone={msg.tone === 'bad' ? 'bad' : 'good'}>{msg.text}</Note>}
      <div className="mp-admin-decisions">
        {offers.map(o => (
          <div key={o.id} className="mp-admin-offer">
            <p><b>{o.title}</b> · {o.kindLabel}{o.percent != null ? `: ${o.percent}%` : ''} · {o.providerName ?? '—'}{o.internal ? ' (internal test account)' : ''} · since {fullDate(o.createdAt)}</p>
            {o.details && <p>{o.details}</p>}
            <p>
              {o.code && <>Code <code className="st-ic">{o.code}</code> · </>}
              Ends {o.endsAt ? fullDate(o.endsAt) : 'never'} · Terms <a href={o.termsUrl} target="_blank" rel="noopener noreferrer nofollow">{o.termsUrl}</a>
              {' '}· verified domains: {o.verifiedDomains.length ? o.verifiedDomains.join(', ') : 'none'}
            </p>
            <div className="st-actions">
              <button type="button" className="st-btn is-sm is-primary" disabled={busy} onClick={() => void decide(o, { action: 'approve' })}>Approve</button>
              <button type="button" className="st-btn is-sm" disabled={busy} onClick={() => setRefusing(refusing === o.id ? null : o.id)}>Refuse…</button>
            </div>
            {refusing === o.id && (
              <form className="mp-admin-form" onSubmit={refuse(o)}>
                <label className="st-field"><span className="st-field-label">Ground (Annex B)</span>
                  <select className="st-select" name="ground" defaultValue="" required>
                    <option value="">Choose a ground</option>
                    {GROUNDS.map(([g, t]) => <option key={g} value={g}>{g} — {t}</option>)}
                  </select>
                </label>
                <label className="st-field"><span className="st-field-label">Facts (what is wrong with the offer; at least 40 characters)</span>
                  <textarea className="st-input" name="facts" rows={3} minLength={40} required />
                </label>
                <div className="st-actions"><button type="submit" className="st-btn is-sm is-danger" disabled={busy}>Refuse with this statement</button></div>
              </form>
            )}
          </div>
        ))}
      </div>
    </Pane>
  );
}
