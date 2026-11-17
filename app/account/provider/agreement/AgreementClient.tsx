'use client';

/**
 * Agreement & notices, first half (Phase 3 plan §2.10, §2.15): the text of the agreement in force or offered, the
 * acceptances with their PDFs, the notice email's confirmation, and "Accept and sign" for the owner or an admin with
 * a confirmed email. Internal test accounts and individuals have no agreement; nothing is ever signed on anyone's
 * behalf. While the release offers no version for signature (before legal review), the form is not shown.
 *
 * M13 (v1.0's ELECTRONIC ACCEPTANCE block): the company block (legal name, registration number, registered office, the
 * representative's name, title and email, the confirmed notice email), the lawyer's two checkboxes word for word (the API
 * sends them), and the button "Accept Agreement and Continue". A missing company field shows its reason and a profile link.
 */

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Pane, Loader, Note } from '@/components/studio';
import { ProviderHead, useProviderSummary, canEdit, FieldError } from '@/components/marketplace/ProviderBits';
import AgreementText from '@/components/marketplace/AgreementText';
import { chosenProvider, mpApi, type ProviderSummary } from '@/lib/provider-account';
import '@/styles/studio-provider-legal.css';

interface Acceptance { id: number; version: string; acceptedAt: string; signerName: string | null; signerTitle: string | null; signerEmail: string | null; offDomain: boolean; early: boolean; pdfReady: boolean; recordSha256: string; supersededAt: string | null; terminatedAt: string | null; redactedAt: string | null }
interface View {
  /** null for a member who is not staff while no version is public (the public page shows nothing then either): textNote says so. */
  text: { version: string; title: string; body: string; bodySha256: string; state: string; legalReview: string; effectiveAt: string | null } | null;
  textNote: string | null;
  offered: { version: string; effectiveAt: string | null; signable: boolean } | null;
  inForce: { version: string } | null;
  early: boolean; textPdfReady: boolean; acceptances: Acceptance[]; notApplicable: string | null; canSign: boolean; blocked: string | null;
  signer: { email: string | null; onVerifiedDomain: boolean }; entityName: string; country: string | null;
  noticeEmail: { address: string | null; confirmedAt: string | null };
  /** M13: the company block (what is missing, with reasons), the two checkbox texts and the button's label. */
  company?: { legalName: string | null; companyNumber: string | null; registeredOffice: string | null; gaps: Array<{ key: string; message: string }> };
  ticks?: [string, string] | null;
  button?: string;
}

const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');

function pdfHref(path: string): string {
  const pick = chosenProvider();
  return `/api/account/provider${path}${path.includes('?') ? '&' : '?'}${pick ? `provider=${pick}` : ''}`.replace(/[?&]$/, '');
}

export function LegalTabs({ current }: { current: 'agreement' | 'notices' }) {
  return (
    <div className="st-tabs sw-tabs mp-legal-tabs" role="navigation" aria-label="Agreement and notices">
      <Link href="/account/provider/agreement" className={`st-tab${current === 'agreement' ? ' is-on' : ''}`} aria-current={current === 'agreement' ? 'page' : undefined}>Agreement</Link>
      <Link href="/account/provider/notices" className={`st-tab${current === 'notices' ? ' is-on' : ''}`} aria-current={current === 'notices' ? 'page' : undefined}>Notices and appeals</Link>
    </div>
  );
}

export default function AgreementClient({ initial }: { initial: ProviderSummary }) {
  const [s] = useProviderSummary(initial);
  const [v, setV] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = async () => {
    const r = await mpApi<View>('/agreement');
    if (r.ok && r.data) setV(r.data); else setError(r.error ?? 'Could not load the agreement.');
  };
  useEffect(() => { void load(); }, []);
  // "Preparing your PDF…" turns into the download within a minute: the health unit renders it.
  useEffect(() => {
    if (!v || !v.acceptances.some(a => !a.pdfReady && !a.redactedAt)) return;
    const t = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(t);
  }, [v]);

  if (!v) return <div data-page-loading>{error ? <Note tone="bad">{error}</Note> : <Loader label="Loading the agreement" minHeight={420} />}</div>;
  const p = s.provider;
  const legal = v.entityName;

  const accept = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setFields({}); setError(null);
    const r = await mpApi('/agreement/accept', { method: 'POST', body: {
      version: v.offered?.version, fullName: f.get('fullName'), title: f.get('title'),
      termsConfirmed: f.get('terms') === 'on', expressConfirmed: f.get('express') === 'on', offDomainConfirmed: f.get('offDomain') === 'on',
    } });
    setBusy(false);
    if (!r.ok) { setError(r.error); setFields(r.fields ?? {}); return; }
    setFlash('Accepted. Preparing your PDF…');
    await load();
  };

  const sendLink = async () => {
    setBusy(true); setError(null);
    const r = await mpApi<{ sentTo: string }>('/notice-email/send', { method: 'POST' });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setFlash(`We sent the link to ${r.data?.sentTo}. It works for 7 days.`);
  };

  return (
    <>
      <ProviderHead summary={s} title="Agreement & notices" lead="The agreement your account lists under, its signed copies, and where legal notices go." />
      <div className="st-body sw-body">
        <LegalTabs current="agreement" />
        {flash && <div role="status" className="st-note is-good sw-flash"><div>{flash}</div></div>}
        {error && <div role="alert" className="st-note is-bad sw-flash"><div>{error}</div></div>}
        {v.notApplicable && <Note title="No agreement for this account">{v.notApplicable}</Note>}

        <Pane title="Notice email" sub="Legal notices about this account go to this address, and to every owner and admin." id="notice">
          <div className="sw-pad">
            {v.noticeEmail.address ? (
              <p>{v.noticeEmail.address} — {v.noticeEmail.confirmedAt ? `confirmed on ${day(v.noticeEmail.confirmedAt)}` : 'not confirmed yet'}</p>
            ) : <p>No notice email yet. <Link href="/account/provider/profile">Add one on your profile</Link>.</p>}
            {v.noticeEmail.address && !v.noticeEmail.confirmedAt && canEdit(s) && (
              <button type="button" className="st-btn is-sm" onClick={sendLink} disabled={busy}>Send the confirmation link</button>
            )}
          </div>
        </Pane>

        {v.acceptances.length > 0 && (
          <Pane title="Signed copies" ruled flush>
            <ul className="mp-legal-list">
              {v.acceptances.map(a => (
                <li key={a.id}>
                  <span>Signed v{a.version}{a.signerName ? ` by ${a.signerName}${a.signerTitle ? ` (${a.signerTitle})` : ''}` : ''} on {day(a.acceptedAt)}{a.offDomain ? ' · signer off the verified domain (in review)' : ''}{a.early ? ' · accepted early' : ''}{a.supersededAt ? ' · superseded' : ''}{a.terminatedAt ? ' · ended' : ''}</span>
                  {a.redactedAt ? <span className="mp-muted">Copy deleted at the end of its retention</span>
                    : a.pdfReady ? <a className="st-btn is-sm is-quiet" href={pdfHref(`/agreement/acceptances/${a.id}/pdf`)}>Download PDF</a>
                    : <span className="mp-muted">Preparing your PDF…</span>}
                </li>
              ))}
            </ul>
          </Pane>
        )}

        {v.text ? (
          <Pane title={v.text.title} sub={v.text.legalReview === 'reviewed' ? `In force from ${day(v.text.effectiveAt)}.`
            : v.text.state === 'draft' || v.text.state === 'text' ? 'A generic draft for staff previews: not offered for signature.' : 'Not offered for signature yet.'}>
            <div className="sw-pad">
              {v.offered && v.textPdfReady && <p><a className="st-btn is-sm is-quiet" href={pdfHref(`/agreement/text.pdf?version=${encodeURIComponent(v.offered.version)}`)}>Download PDF of the text</a></p>}
              <AgreementText body={v.text.body} />
              <p className="mp-muted">SHA-256 of this text: <code>{v.text.bodySha256}</code></p>
            </div>
          </Pane>
        ) : (
          <Pane title="Provider Terms and Listing Agreement">
            <div className="sw-pad"><p>{v.textNote}</p></div>
          </Pane>
        )}

        {v.canSign && v.offered && p && v.ticks && (
          <Pane title={`Accept v${v.offered.version}`} sub={v.early ? 'Accepting now waives the notice period for this version.' : 'Electronic acceptance'}>
            <form className="sw-pad mp-accept" onSubmit={accept}>
              <dl className="mp-accept-company">
                <div><dt>Company legal name</dt><dd>{v.company?.legalName ?? legal}</dd></div>
                <div><dt>Company registration number</dt><dd>{v.company?.companyNumber ?? '—'}</dd></div>
                <div><dt>Registered office</dt><dd>{v.company?.registeredOffice ?? '—'}</dd></div>
                <div><dt>Email</dt><dd>{v.signer.email ?? '—'}</dd></div>
                <div><dt>Company notice email</dt><dd>{v.noticeEmail.address ?? '—'}{v.noticeEmail.confirmedAt ? ' (confirmed)' : ''}</dd></div>
              </dl>
              <p className="mp-muted">The company details come from your <Link href="/account/provider/profile">profile</Link>. Enter yours as the authorised representative:</p>
              <label className="st-field"><span className="st-field-label">Authorised representative (full name)</span><input className="st-input" name="fullName" required maxLength={120} autoComplete="name" /><FieldError text={fields.fullName} /></label>
              <label className="st-field"><span className="st-field-label">Title</span><input className="st-input" name="title" required maxLength={80} autoComplete="organization-title" /><FieldError text={fields.title} /></label>
              <label className="st-check"><input type="checkbox" name="terms" required /> {v.ticks[0]}</label>
              <FieldError text={fields.termsConfirmed} />
              <label className="st-check"><input type="checkbox" name="express" required /> {v.ticks[1]}</label>
              <FieldError text={fields.expressConfirmed} />
              {!v.signer.onVerifiedDomain && (
                <>
                  <label className="st-check"><input type="checkbox" name="offDomain" required /> I confirm I sign for {legal} although my email address is not on its domain</label>
                  <FieldError text={fields.offDomainConfirmed} />
                </>
              )}
              <p className="mp-muted">We record the company details above, your name, title, email address, IP address, browser and the time, both ticks, with a fingerprint of the exact text, and email a PDF copy to you and to {v.noticeEmail.address ?? 'your notice email'}.</p>
              <button type="submit" className="st-btn is-primary" disabled={busy}>{busy ? 'Accepting…' : (v.button ?? 'Accept Agreement and Continue')}</button>
            </form>
          </Pane>
        )}
        {!v.canSign && !v.notApplicable && (v.company?.gaps.length ?? 0) > 0 && v.text && v.offered?.signable
          && !v.acceptances.some(a => a.version === v.offered?.version && !a.terminatedAt) && (
          <Note title="Before you can accept">
            <ul>{v.company!.gaps.map(g => <li key={g.key}>{g.message}</li>)}</ul>
            <p><Link href="/account/provider/profile">Open your profile</Link></p>
          </Note>
        )}
        {!v.canSign && !v.notApplicable && v.blocked && v.text && !((v.company?.gaps.length ?? 0) > 0 && v.offered?.signable && !v.acceptances.some(a => a.version === v.offered?.version && !a.terminatedAt)) && <Note>{v.blocked}</Note>}
      </div>
    </>
  );
}
