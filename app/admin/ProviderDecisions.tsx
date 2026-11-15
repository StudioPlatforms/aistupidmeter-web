'use client';

/**
 * The admin's decision views (Phase 3 plan §10.4, §10.5, §9.3, §9.5, §9.6; M5), inside a provider's detail: its
 * record (decisions with their statements, notices and their deliveries, signed copies with the chain check,
 * appeals, complaints), and the forms that decide — the submission, a listing added after approval, a logo waiting
 * for review, and every measure (pause, restrict, suspend, terminate, reinstate, retract, the main ranking, removing
 * content, a rename). Each restrictive decision needs a ground and at least 40 characters of facts; the API writes
 * the statement of reasons first, then applies the effect. The sanctions check is ticked by the admin, never for them.
 *
 * Also exported: AgreementVersions and Reports, the tab's two panes for versions (§9.3) and reports (§9.5).
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Loader, Note, Pane } from '@/components/studio';
import { fullDate } from './format';
import '@/styles/studio-provider-legal.css';

const GROUNDS: Array<[string, string]> = [
  ['G1', 'Identity or domain verification failed or lapsed'], ['G2', 'Impersonation or infringement'], ['G3', 'Misleading listing data'],
  ['G4', 'Measurement manipulation'], ['G5', 'Breach of test confidentiality'], ['G6', 'Security risk to users'], ['G7', 'Illegal content or sanctions'],
  ['G9', 'Changed terms not accepted'], ['G10', 'Offer not honoured'], ['G11', 'Abuse of our services'], ['G12', 'Inactive for 90 days'], ['G13', 'Required by law'],
];
const MEASURES: Array<[string, string]> = [
  ['pause', 'Pause measurement (admin)'], ['resume', 'Resume'], ['restrict', 'Restrict'], ['suspend', 'Suspend'], ['terminate', 'Terminate (delist)'],
  ['reinstate', 'Reinstate'], ['retract_score', 'Retract results for a period'], ['remove_from_main', 'Remove from the main ranking'], ['rejoin_main', 'Return to the main ranking'],
  ['remove_content', 'Remove content (logo or page text)'], ['rename', 'Approve the pending name change'],
];

interface Record_ {
  actions: Array<{ id: number; scope: string; targetId: number | null; action: string; ground: string | null; facts: string; effectiveAt: string; appliedAt: string | null; appealUntil: string | null; automatedDecision: boolean }>;
  notices: Array<{ id: number; kind: string; subject: string; createdAt: string; acknowledgedAt: string | null; pdfReady: boolean }>;
  acceptances: Array<{ id: number; version: string; acceptedAt: string; signerName: string | null; signerTitle: string | null; signerEmail: string | null; offDomain: boolean; pdfReady: boolean; recordSha256: string; redactedAt: string | null }>;
  chain: { ok: boolean; rows: number; redacted: number; problems: string[] };
  appeals: Array<{ id: number; actionId: number; text: string; state: string; createdAt: string }>;
  complaints: Array<{ id: number; category: string; text: string; state: string; createdAt: string }>;
  deliveries: Array<{ id: number; kind: string; ref_id: number; to_email: string; status: string; dsn: string | null; status_at: string | null }>;
}

async function call(path: string, method: 'GET' | 'POST', body?: unknown): Promise<{ ok: boolean; data: any; message: string | null; fields: Record<string, string> | null }> {
  try {
    const r = await fetch(`/api/admin/marketplace/${path}`, {
      method, cache: 'no-store', ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) } : {}),
    });
    const j = await r.json().catch(() => null);
    return { ok: r.ok && !!j?.success, data: j?.data ?? null, message: j?.message || (r.ok ? null : j?.error || `The API answered ${r.status}.`), fields: j?.fields ?? null };
  } catch {
    return { ok: false, data: null, message: 'Could not reach the server.', fields: null };
  }
}

function FactsField({ name = 'facts', required = true }: { name?: string; required?: boolean }) {
  return <label className="st-field"><span className="st-field-label">Facts (dates, measurements, a report reference; at least 40 characters)</span><textarea className="st-input" name={name} rows={3} minLength={required ? 40 : 0} required={required} /></label>;
}

function GroundField({ optional }: { optional?: boolean }) {
  return (
    <label className="st-field"><span className="st-field-label">Ground (Annex B)</span>
      <select className="st-select" name="ground" defaultValue="" required={!optional}>
        <option value="">{optional ? 'None' : 'Choose a ground'}</option>
        {GROUNDS.map(([g, t]) => <option key={g} value={g}>{g} — {t}</option>)}
      </select>
    </label>
  );
}

export default function ProviderDecisions({ publicId, state, internal, kind, listings, logos, onChange }: {
  publicId: string; state: string; internal: boolean; kind: string;
  listings: Array<{ publicId?: string; id: number; model: string; precision: string; state: string; openModel: { name: string } | null }>;
  logos: Array<{ id: number; state: string }>;
  onChange: () => void;
}) {
  const [rec, setRec] = useState<Record_ | null>(null);
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await call(`providers/${publicId}/record`, 'GET');
    if (r.ok) setRec(r.data); else setMsg({ tone: 'bad', text: r.message ?? 'The record did not load.' });
  }, [publicId]);
  useEffect(() => { void load(); }, [load]);

  const submit = async (path: string, body: Record<string, unknown>, done: string) => {
    setBusy(true); setMsg(null);
    const r = await call(path, 'POST', body);
    setBusy(false);
    setMsg(r.ok ? { tone: 'good', text: done } : { tone: 'bad', text: [r.message, ...Object.values(r.fields ?? {})].filter(Boolean).join(' ') });
    if (r.ok) { await load(); onChange(); }
  };
  const form = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); return Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>; };

  const decide = (e: FormEvent<HTMLFormElement>) => {
    const f = form(e);
    void submit(`providers/${publicId}/decision`, { action: f.action, ground: f.ground || null, facts: f.facts || '', sanctionsChecked: f.sanctionsChecked === 'on' }, 'Decided: the statement of reasons is in the provider\'s notices.');
  };
  const measure = (e: FormEvent<HTMLFormElement>) => {
    const f = form(e);
    const body: Record<string, unknown> = { scope: f.scope === 'provider' ? 'provider' : 'listing', action: f.action, ground: f.ground || null, facts: f.facts || '' };
    if (f.scope === 'provider') body.provider = publicId; else body.listing = f.scope;
    if (f.effectiveAt) body.effectiveAt = new Date(f.effectiveAt).toISOString();
    if (f.art44) body.art44 = f.art44;
    if (f.from) body.from = new Date(f.from).toISOString();
    if (f.to) body.to = new Date(f.to).toISOString();
    void submit('actions', body, 'Recorded and applied (a future-dated measure applies on its date; its notice goes now).');
  };

  const inReview = listings.filter(l => l.state === 'in_review');
  const pendingLogos = logos.filter(l => l.state === 'pending_review');
  return (
    <div className="mp-admin-decisions">
      {msg && <Note tone={msg.tone === 'bad' ? 'bad' : 'good'}>{msg.text}</Note>}

      {state === 'in_review' && (
        <form className="mp-admin-form" onSubmit={decide}>
          <p className="st-label mp-admin-h">Decide the submission</p>
          <label className="st-field"><span className="st-field-label">Decision</span>
            <select className="st-select" name="action" required defaultValue="approve">
              <option value="approve">Approve</option><option value="request_changes">Request changes</option><option value="refuse">Refuse</option>
            </select>
          </label>
          <GroundField optional />
          <FactsField required={false} />
          {!internal && kind === 'company' && <label className="st-check"><input type="checkbox" name="sanctionsChecked" /> I checked the company against the consolidated EU sanctions list</label>}
          <button type="submit" className="st-btn is-primary is-sm" disabled={busy}>Record the decision</button>
          <p className="st-faint">Approving publishes the provider page and its listings in review, each "Listed · not measured yet". Refusing needs a ground; changes requested list the reasons in the facts.</p>
        </form>
      )}

      {state === 'approved' && inReview.map(l => (
        <form key={l.id} className="mp-admin-form" onSubmit={e => { const f = form(e); void submit(`listings/${l.publicId}/decision`, { action: f.action, ground: f.ground || null, facts: f.facts || '' }, 'Listing decided.'); }}>
          <p className="st-label mp-admin-h">Listing in review: {l.openModel?.name ?? l.model} · {l.precision.toUpperCase()}</p>
          <label className="st-field"><span className="st-field-label">Decision</span>
            <select className="st-select" name="action" defaultValue="approve"><option value="approve">Approve</option><option value="request_changes">Request changes</option><option value="refuse">Refuse</option></select>
          </label>
          <GroundField optional />
          <FactsField required={false} />
          <button type="submit" className="st-btn is-sm" disabled={busy || !l.publicId}>Record</button>
        </form>
      ))}

      {pendingLogos.map(l => (
        <form key={l.id} className="mp-admin-form" onSubmit={e => { const f = form(e); void submit(`logos/${l.id}/decision`, { action: f.action, facts: f.facts || '' }, 'Logo decided.'); }}>
          <p className="st-label mp-admin-h">Logo #{l.id} waiting for review (its previews are above)</p>
          <label className="st-field"><span className="st-field-label">Decision</span>
            <select className="st-select" name="action" defaultValue="approve"><option value="approve">Approve</option><option value="refuse">Refuse</option></select>
          </label>
          <FactsField required={false} />
          <button type="submit" className="st-btn is-sm" disabled={busy}>Record</button>
        </form>
      ))}

      {state === 'approved' && (
        <form className="mp-admin-form" onSubmit={measure}>
          <p className="st-label mp-admin-h">A measure</p>
          <label className="st-field"><span className="st-field-label">Scope</span>
            <select className="st-select" name="scope" defaultValue="provider">
              <option value="provider">The whole provider</option>
              {listings.filter(l => l.publicId).map(l => <option key={l.id} value={l.publicId}>{l.openModel?.name ?? l.model} · {l.precision.toUpperCase()}</option>)}
            </select>
          </label>
          <label className="st-field"><span className="st-field-label">Measure</span>
            <select className="st-select" name="action" defaultValue="pause">{MEASURES.map(([a, t]) => <option key={a} value={a}>{t}</option>)}</select>
          </label>
          <GroundField optional />
          <FactsField required={false} />
          <label className="st-field"><span className="st-field-label">Effective (a termination defaults to 30 days ahead)</span><input className="st-input" type="datetime-local" name="effectiveAt" /></label>
          <label className="st-field"><span className="st-field-label">A termination at once: the P2B Art. 4(4) exception</span>
            <select className="st-select" name="art44" defaultValue=""><option value="">None (30 days&apos; notice)</option><option value="legal_obligation">A legal obligation</option><option value="repeated_infringement">Repeated infringement</option><option value="force_majeure_security">Security, fraud or force majeure</option></select>
          </label>
          <label className="st-field"><span className="st-field-label">Retraction period: from</span><input className="st-input" type="datetime-local" name="from" /></label>
          <label className="st-field"><span className="st-field-label">to</span><input className="st-input" type="datetime-local" name="to" /></label>
          <button type="submit" className="st-btn is-sm" disabled={busy}>Record the measure</button>
        </form>
      )}

      {!rec && <Loader label="Loading the record" />}
      {rec && (
        <>
          <p className="st-label mp-admin-h">Decisions</p>
          <ul className="mp-admin-list">
            {rec.actions.length === 0 && <li><span className="st-faint">None yet.</span></li>}
            {rec.actions.map(a => (
              <li key={a.id}>
                <span>#{a.id} {a.action.replace(/_/g, ' ')} ({a.scope}{a.targetId ? ` ${a.targetId}` : ''}){a.ground ? ` · ${a.ground}` : ''}{a.automatedDecision ? ' · automatic' : ''} — {a.facts}</span>
                <span className="st-faint">{a.appliedAt ? `applied ${fullDate(a.appliedAt)}` : `effective ${fullDate(a.effectiveAt)} (not applied yet)`}</span>
              </li>
            ))}
          </ul>
          <p className="st-label mp-admin-h">Notices and their deliveries</p>
          <ul className="mp-admin-list">
            {rec.notices.length === 0 && <li><span className="st-faint">None yet.</span></li>}
            {rec.notices.map(n => {
              const ds = rec.deliveries.filter(d => d.kind === 'notice' && d.ref_id === n.id);
              return (
                <li key={n.id}>
                  <span>{n.subject}</span>
                  <span className="st-faint">{fullDate(n.createdAt)} · {n.acknowledgedAt ? 'acknowledged' : 'not acknowledged'}{ds.length ? ` · ${ds.map(d => `${d.status}${d.dsn ? ` ${d.dsn}` : ''}`).join(', ')}` : ' · not sent yet'}</span>
                </li>
              );
            })}
          </ul>
          <p className="st-label mp-admin-h">Signed copies {rec.chain.ok ? '(the chain verifies)' : '(THE CHAIN DOES NOT VERIFY)'}</p>
          {!rec.chain.ok && <Note tone="bad">{rec.chain.problems.join(' · ')}</Note>}
          <ul className="mp-admin-list">
            {rec.acceptances.length === 0 && <li><span className="st-faint">{internal ? 'Internal test account: no agreement.' : 'None yet.'}</span></li>}
            {rec.acceptances.map(a => (
              <li key={a.id}>
                <span>v{a.version} · {a.signerName ?? '[redacted]'}{a.signerTitle ? ` (${a.signerTitle})` : ''} · {a.signerEmail ?? ''}{a.offDomain ? ' · off-domain signer' : ''}</span>
                <span className="st-faint">
                  {fullDate(a.acceptedAt)}
                  {a.pdfReady && <> · <a href={`/api/admin/marketplace/acceptances/${a.id}/pdf`}>PDF</a></>}
                  {a.offDomain && <> · <button type="button" className="st-more ad-linkbtn" onClick={() => void submit(`acceptances/${a.id}/offdomain-reviewed`, {}, 'Marked as reviewed.')}>Reviewed</button></>}
                </span>
              </li>
            ))}
          </ul>
          {rec.appeals.length > 0 && (
            <>
              <p className="st-label mp-admin-h">Appeals</p>
              {rec.appeals.map(a => (
                <form key={a.id} className="mp-admin-form" onSubmit={e => { const f = form(e); void submit(`appeals/${a.id}/decide`, { decision: f.decision, text: f.text }, 'Appeal decided.'); }}>
                  <p>Against #{a.actionId} ({a.state}, {fullDate(a.createdAt)}): {a.text}</p>
                  {a.state === 'open' && (
                    <>
                      <label className="st-field"><span className="st-field-label">Decision</span><select className="st-select" name="decision" defaultValue="upheld"><option value="upheld">Uphold</option><option value="reversed">Reverse</option><option value="partly_reversed">Reverse in part</option></select></label>
                      <label className="st-field"><span className="st-field-label">Reasons (at least 40 characters)</span><textarea className="st-input" name="text" rows={3} minLength={40} required /></label>
                      <button type="submit" className="st-btn is-sm" disabled={busy}>Decide</button>
                    </>
                  )}
                </form>
              ))}
            </>
          )}
          {rec.complaints.length > 0 && (
            <>
              <p className="st-label mp-admin-h">Complaints</p>
              {rec.complaints.map(c => (
                <form key={c.id} className="mp-admin-form" onSubmit={e => { const f = form(e); void submit(`complaints/${c.id}/answer`, { text: f.text }, 'Answered.'); }}>
                  <p>{c.category.replace(/_/g, ' ')} ({c.state}, {fullDate(c.createdAt)}): {c.text}</p>
                  {c.state === 'open' && (
                    <>
                      <label className="st-field"><span className="st-field-label">Answer (at least 40 characters)</span><textarea className="st-input" name="text" rows={3} minLength={40} required /></label>
                      <button type="submit" className="st-btn is-sm" disabled={busy}>Send the answer</button>
                    </>
                  )}
                </form>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Agreement versions (§9.3): create one from a text the release has; publish it with its effective date. */
export function AgreementVersions() {
  const [v, setV] = useState<{ versions: Array<{ version: string; state: string; publishedAt: string | null; effectiveAt: string | null; legalReview: string; signable: boolean }>; inForce: string | null; releaseTexts: string[]; chain: boolean } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await call('agreement/versions', 'GET'); if (r.ok) setV(r.data); else setMsg(r.message); }, []);
  useEffect(() => { void load(); }, [load]);
  if (!v) return <Pane title="Agreement versions">{msg ? <Note tone="bad">{msg}</Note> : <Loader label="Loading" />}</Pane>;
  const missing = v.releaseTexts.filter(t => !v.versions.some(x => x.version === t));
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 16);
  return (
    <Pane title="Agreement versions" sub={`In force: ${v.inForce ?? 'none'} · acceptance chain ${v.chain ? 'verifies' : 'DOES NOT VERIFY'}. v0.9 is a draft for staff previews: no version is offered for signature before legal review.`} ruled flush>
      {msg && <Note>{msg}</Note>}
      <ul className="mp-admin-list sw-pad">
        {v.versions.map(x => (
          <li key={x.version}>
            <span>v{x.version} · {x.state}{x.legalReview === 'reviewed' ? ' · reviewed' : ' · no legal review'}{x.effectiveAt ? ` · in force from ${fullDate(x.effectiveAt)}` : ''}</span>
            {x.state === 'draft' && (
              <form className="mp-admin-inline" onSubmit={async e => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const r = await call(`agreement/versions/${x.version}/publish`, 'POST', { effectiveAt: new Date(String(f.get('effectiveAt'))).toISOString(), summary: f.get('summary'), emergencyGround: f.get('emergencyGround') || null });
                setMsg(r.ok ? `Published v${x.version}; ${r.data?.notices ?? 0} notice(s) sent.` : r.message); void load();
              }}>
                <input className="st-input" type="datetime-local" name="effectiveAt" defaultValue={in30} aria-label="Effective" />
                <input className="st-input" name="summary" placeholder="Summary of changes" aria-label="Summary of changes" />
                <input className="st-input" name="emergencyGround" placeholder="Emergency ground (P2B Art. 3(4)), if any" aria-label="Emergency ground" />
                <button type="submit" className="st-btn is-sm">Publish</button>
              </form>
            )}
          </li>
        ))}
        {missing.map(t => (
          <li key={t}><span>v{t}: the release has this text</span>
            <button type="button" className="st-btn is-sm" onClick={async () => { const r = await call('agreement/versions', 'POST', { version: t }); setMsg(r.ok ? `Created v${t} as a draft.` : r.message); void load(); }}>Create the draft</button>
          </li>
        ))}
      </ul>
    </Pane>
  );
}

/** Reports (§9.5): oldest first; triage, dismiss, merge a duplicate, or link the action taken. Never an automatic sanction. */
export function Reports() {
  const [rows, setRows] = useState<Array<{ id: number; targetKind: string; targetId: number; category: string; explanation: string; url: string | null; reporterName: string | null; reporterEmail: string; state: string; createdAt: string }> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await call('reports', 'GET'); if (r.ok) setRows(r.data?.reports ?? []); else setMsg(r.message); }, []);
  useEffect(() => { void load(); }, [load]);
  if (!rows) return <Pane title="Reports">{msg ? <Note tone="bad">{msg}</Note> : <Loader label="Loading" />}</Pane>;
  const triage = async (id: number, body: Record<string, unknown>) => { const r = await call(`reports/${id}/triage`, 'POST', body); setMsg(r.ok ? `Report R-${id}: ${String(body.state)}.` : r.message); void load(); };
  return (
    <Pane title="Reports" sub="Notices from anyone about a listing (DSA Art. 16). A person decides; reports never sanction anything by themselves." ruled flush>
      {msg && <Note>{msg}</Note>}
      <ul className="mp-admin-list sw-pad">
        {rows.length === 0 && <li><span className="st-faint">No reports.</span></li>}
        {rows.map(r => (
          <li key={r.id}>
            <span>R-{r.id} · {r.category.replace(/_/g, ' ')} · {r.targetKind} {r.targetId} · {r.explanation} {r.url ? `(${r.url})` : ''} — {r.reporterName ?? ''} {r.reporterEmail}</span>
            <span className="st-faint">
              {r.state} · {fullDate(r.createdAt)}
              {(r.state === 'new' || r.state === 'triaged') && <>
                {r.state === 'new' && <> · <button type="button" className="st-more ad-linkbtn" onClick={() => void triage(r.id, { state: 'triaged' })}>Triaged</button></>}
                {' · '}<button type="button" className="st-more ad-linkbtn" onClick={() => void triage(r.id, { state: 'dismissed' })}>Dismiss</button>
                {' · '}<button type="button" className="st-more ad-linkbtn" onClick={() => { const of = Number(prompt('Duplicate of report number:') || 0); if (of) void triage(r.id, { state: 'duplicate', duplicateOf: of }); }}>Duplicate…</button>
                {' · '}<button type="button" className="st-more ad-linkbtn" onClick={() => { const a = Number(prompt('The action taken (decision number):') || 0); if (a) void triage(r.id, { state: 'actioned', actionId: a }); }}>Actioned…</button>
              </>}
            </span>
          </li>
        ))}
      </ul>
    </Pane>
  );
}
