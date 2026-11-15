'use client';

/**
 * Agreement & notices, second half (Phase 3 plan §2.15, §9.3, §9.6): the notices inbox (the durable-medium log:
 * statements of reasons, decisions, change and termination notices), each to be acknowledged; the decisions with
 * their appeal window; appeals; and complaints about our compliance, technical issues or our conduct (P2B Art. 11).
 * Text is shown as text; every notice also has its PDF.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { Pane, Loader, Note } from '@/components/studio';
import { ProviderHead, useProviderSummary, canEdit } from '@/components/marketplace/ProviderBits';
import { LegalTabs } from '../agreement/AgreementClient';
import { chosenProvider, mpApi, type ProviderSummary } from '@/lib/provider-account';
import '@/styles/studio-provider-legal.css';

interface Notice { id: number; kind: string; subject: string; body: string; pdfReady: boolean; createdAt: string; acknowledgedAt: string | null; relatedActionId: number | null }
interface Decision { id: number; scope: string; action: string; ground: string | null; groundTitle: string | null; facts: string; effectiveAt: string; appealUntil: string | null; appliedAt: string | null; createdAt: string }
interface Appeal { id: number; actionId: number; text: string; state: string; decidedAt: string | null; decisionText: string | null; createdAt: string }
interface Complaint { id: number; category: string; text: string; state: string; decidedAt: string | null; decisionText: string | null; createdAt: string }
interface View { notices: Notice[]; decisions: Decision[]; appeals: Appeal[]; complaints: Complaint[]; complaintCategories: string[]; openComplaintsMax: number }

const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
const KIND: Record<string, string> = {
  agreement_change: 'Agreement change', statement_of_reasons: 'Statement of reasons', termination_notice: 'Termination notice', review_decision: 'Review decision',
  appeal_decision: 'Appeal decision', domain_lapse: 'Domain check', safety_hold: 'Safety hold', complaint_decision: 'Answer to a complaint',
};
const CATEGORY: Record<string, string> = { non_compliance: 'Our compliance with the P2B Regulation', technical: 'A technical issue', our_conduct: 'Our measures or conduct', other: 'Something else' };

export default function NoticesClient({ initial }: { initial: ProviderSummary }) {
  const [s] = useProviderSummary(initial);
  const [v, setV] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [appealFor, setAppealFor] = useState<number | null>(null);
  const editor = canEdit(s);

  const load = async () => {
    const r = await mpApi<View>('/notices');
    if (r.ok && r.data) setV(r.data); else setError(r.error ?? 'Could not load the notices.');
  };
  useEffect(() => { void load(); }, []);
  if (!v) return <div data-page-loading>{error ? <Note tone="bad">{error}</Note> : <Loader label="Loading the notices" minHeight={420} />}</div>;

  const ack = async (id: number) => {
    const r = await mpApi(`/notices/${id}/acknowledge`, { method: 'POST' });
    if (!r.ok) { setError(r.error); return; }
    await load();
  };
  const appeal = async (e: FormEvent<HTMLFormElement>, actionId: number) => {
    e.preventDefault();
    const text = String(new FormData(e.currentTarget).get('text') ?? '');
    const r = await mpApi('/appeals', { method: 'POST', body: { actionId, text } });
    if (!r.ok) { setError(r.error); return; }
    setAppealFor(null); setFlash('Your appeal is with us. A person decides it and we email you the decision.');
    await load();
  };
  const complain = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await mpApi('/complaints', { method: 'POST', body: { category: f.get('category'), text: f.get('text') } });
    if (!r.ok) { setError(r.error); return; }
    e.currentTarget.reset();
    setFlash('Your complaint is with us. A person answers it in writing.');
    await load();
  };
  const pick = chosenProvider();
  const openAppeals = new Set(v.appeals.filter(a => a.state === 'open').map(a => a.actionId));
  const now = Date.now();

  return (
    <>
      <ProviderHead summary={s} title="Agreement & notices" lead="Notices we send you, our decisions with their reasons, and your appeals and complaints." />
      <div className="st-body sw-body">
        <LegalTabs current="notices" />
        {flash && <div role="status" className="st-note is-good sw-flash"><div>{flash}</div></div>}
        {error && <div role="alert" className="st-note is-bad sw-flash"><div>{error}</div></div>}

        <Pane title="Notices" sub="Each notice must be acknowledged. Every notice is also emailed, with its PDF." ruled flush>
          {v.notices.length === 0 ? <p className="sw-pad sw-quiet">No notices.</p> : (
            <ul className="mp-legal-list is-notices">
              {v.notices.map(n => (
                <li key={n.id} className={n.acknowledgedAt ? '' : 'is-new'}>
                  <div className="mp-notice-head"><b>{n.subject}</b><span className="mp-muted">{KIND[n.kind] ?? n.kind} · {day(n.createdAt)}</span></div>
                  <div className="mp-notice-body">{n.body}</div>
                  <div className="mp-notice-actions">
                    {n.pdfReady && <a className="st-btn is-sm is-quiet" href={`/api/account/provider/notices/${n.id}/pdf${pick ? `?provider=${pick}` : ''}`}>PDF</a>}
                    {n.acknowledgedAt ? <span className="mp-muted">Acknowledged {day(n.acknowledgedAt)}</span>
                      : editor ? <button type="button" className="st-btn is-sm" onClick={() => void ack(n.id)}>Acknowledge</button> : <span className="mp-muted">Not acknowledged yet</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Pane>

        <Pane title="Decisions" sub="Every decision about your account, with its ground and facts. You can appeal a restrictive one for six months." ruled flush>
          {v.decisions.length === 0 ? <p className="sw-pad sw-quiet">No decisions yet.</p> : (
            <ul className="mp-legal-list">
              {v.decisions.map(d => {
                const canAppeal = editor && !!d.appealUntil && Date.parse(d.appealUntil) > now && !openAppeals.has(d.id);
                return (
                  <li key={d.id}>
                    <div className="mp-notice-head"><b>#{d.id} {d.action.replace(/_/g, ' ')} ({d.scope})</b><span className="mp-muted">{d.ground ? `${d.ground}, ${d.groundTitle} · ` : ''}effective {day(d.effectiveAt)}</span></div>
                    <div className="mp-notice-body">{d.facts}</div>
                    <div className="mp-notice-actions">
                      {openAppeals.has(d.id) && <span className="mp-muted">Appeal open</span>}
                      {canAppeal && appealFor !== d.id && <button type="button" className="st-btn is-sm" onClick={() => setAppealFor(d.id)}>Appeal</button>}
                    </div>
                    {appealFor === d.id && (
                      <form className="mp-appeal" onSubmit={e => void appeal(e, d.id)}>
                        <label className="st-field"><span className="st-field-label">Why the decision should change (20–5,000 characters)</span><textarea className="st-input" name="text" rows={5} minLength={20} maxLength={5000} required /></label>
                        <div className="st-actions"><button type="submit" className="st-btn is-primary is-sm">Send appeal</button><button type="button" className="st-btn is-sm is-quiet" onClick={() => setAppealFor(null)}>Cancel</button></div>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Pane>

        {v.appeals.length > 0 && (
          <Pane title="Appeals" ruled flush>
            <ul className="mp-legal-list">
              {v.appeals.map(a => (
                <li key={a.id}><div className="mp-notice-head"><b>Against decision #{a.actionId}</b><span className="mp-muted">{a.state.replace('_', ' ')} · {day(a.createdAt)}</span></div>
                  {a.decisionText && <div className="mp-notice-body">{a.decisionText}</div>}</li>
              ))}
            </ul>
          </Pane>
        )}

        <Pane title="Complaints" sub={`About our compliance, a technical issue, or our measures or conduct. At most ${v.openComplaintsMax} open at a time.`}>
          <div className="sw-pad">
            {v.complaints.length > 0 && (
              <ul className="mp-legal-list">
                {v.complaints.map(c => (
                  <li key={c.id}><div className="mp-notice-head"><b>{CATEGORY[c.category] ?? c.category}</b><span className="mp-muted">{c.state} · {day(c.createdAt)}</span></div>
                    <div className="mp-notice-body">{c.text}</div>{c.decisionText && <div className="mp-notice-body"><b>Our answer:</b> {c.decisionText}</div>}</li>
                ))}
              </ul>
            )}
            {editor && (
              <form className="mp-complaint" onSubmit={e => void complain(e)}>
                <label className="st-field"><span className="st-field-label">About</span>
                  <select className="st-select" name="category" required defaultValue="">{[<option key="" value="" disabled>Choose one</option>, ...v.complaintCategories.map(c => <option key={c} value={c}>{CATEGORY[c] ?? c}</option>)]}</select>
                </label>
                <label className="st-field"><span className="st-field-label">Your complaint (20–5,000 characters)</span><textarea className="st-input" name="text" rows={5} minLength={20} maxLength={5000} required /></label>
                <button type="submit" className="st-btn is-primary is-sm">Send complaint</button>
              </form>
            )}
          </div>
        </Pane>
      </div>
    </>
  );
}
