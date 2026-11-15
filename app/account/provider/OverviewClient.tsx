'use client';

/**
 * The provider account's overview (§2.3): a ruled checklist, one row per step, each with its
 * state, the one action that moves it on, and, when something is in the way, the exact reason as
 * the API states it. Beside it, the account's own facts. Rows come from the API (GET
 * /account/provider `checklist`); a step it does not report is not shown.
 *
 * Look: the studio shell plus styles/studio-team.css and styles/studio-provider.css (mp-).
 */

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Pane, Empty, Loader, Note } from '@/components/studio';
import { ProviderHead, ProviderSwitch, useProviderSummary } from '@/components/marketplace/ProviderBits';
import {
  CHECKLIST, KIND_LABEL, PAGE_BASE, ROLE_LABEL, chooseProvider, mpApi,
  type ChecklistRow, type ProviderSummary,
} from '@/lib/provider-account';
import { countryName } from '@/lib/countries';

const ar = <span className="st-ar" aria-hidden="true">→</span>;

const day = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function Mark({ state }: { state: ChecklistRow['state'] }) {
  const cls = state === 'done' ? 'is-done' : state === 'blocked' ? 'is-blocked' : state === 'not_applicable' || state === 'unavailable' ? 'is-na' : '';
  const word = state === 'done' ? 'Done' : state === 'blocked' ? 'Blocked' : state === 'not_applicable' ? 'Not needed' : state === 'unavailable' ? 'Not available yet' : 'To do';
  return (
    <span className={`mp-mark ${cls}`}>
      {state === 'done' && (
        <svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 6.3l2.2 2.2L9.5 3.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      )}
      {state === 'blocked' && (
        <svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 2.8v4M6 9.2v.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      )}
      <span className="st-sr">{word}</span>
    </span>
  );
}

export default function OverviewClient({ initial }: { initial: ProviderSummary }) {
  const { status } = useSession();
  const [s, reload] = useProviderSummary(initial);
  const [closing, setClosing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'loading') return <div data-page-loading><Loader label="Loading your provider account" minHeight={420} /></div>;

  const p = s.provider;
  if (!p) {
    return (
      <>
        <ProviderHead summary={s} title="Provider account" lead="Where an inference provider sets up its account: company details, domains and data handling." />
        <div className="st-body sw-body">
          <Empty
            title="You do not have a provider account yet"
            actions={s.canCreate !== false
              ? <Link href="/account/provider/new" className="st-btn is-primary">Create a provider account {ar}</Link>
              : undefined}
          >
            {s.canCreate === false && s.createBlocked?.message
              ? s.createBlocked.message
              : 'A provider account is free. You add your company and its details, and verify your domain.'}
          </Empty>
        </div>
      </>
    );
  }

  // The API's rows, in the plan's order; a key the web has no words for is shown under its own name.
  const order = new Map(CHECKLIST.map((c, i) => [c.key, i]));
  const rows = [...(s.checklist ?? [])].sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));
  const address = p.slug ?? p.proposedSlug ?? null;
  const isOwner = s.role === 'owner';
  // The name to type before closing: the legal name, or an individual's handle (M2 contract §4).
  const confirmName = p.kind === 'company' ? (p.legalName || p.displayName) : p.displayName;
  const canRestart = p.state === 'refused' && !!p.restartAfter && Date.parse(p.restartAfter) <= Date.now();

  const close = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const typed = String(new FormData(e.currentTarget).get('confirm') ?? '').trim();
    setClosing(true); setProblem(null);
    const r = await mpApi('/close', { method: 'POST', body: { confirm: typed } });
    setClosing(false);
    if (!r.ok) { setProblem(r.error ?? 'Could not close the provider account.'); return; }
    chooseProvider(null);
    // A full page load: the sidebar's Provider group goes with the next session read.
    window.location.assign('/account');
  };

  // §2.11: the API checks every row up to the agreement, the notice email and the limits; its reason is shown.
  const submit = async () => {
    setSubmitting(true); setProblem(null);
    const r = await mpApi<{ message?: string }>('/submit', { method: 'POST' });
    setSubmitting(false);
    if (!r.ok) { setProblem(r.error ?? 'Could not submit.'); return; }
    setProblem(null);
    await reload();
  };

  const restart = async () => {
    setRestarting(true); setProblem(null);
    const r = await mpApi('/restart', { method: 'POST' });
    setRestarting(false);
    if (!r.ok) { setProblem(r.error ?? 'Could not start again.'); return; }
    await reload();
  };

  return (
    <>
      <ProviderHead
        summary={s}
        title={p.displayName}
        lead="Your provider account: what is done, what comes next, and anything in the way."
        actions={<ProviderSwitch summary={s} onChange={() => void reload()} />}
      />

      <div className="st-body sw-body">
        {p.state === 'refused' && (
          <Note tone="bad" title="This application was refused">
            {canRestart
              ? 'You can start again: your account goes back to a draft, with its history kept.'
              : p.restartAfter ? <>You can start again from {day(p.restartAfter)}.</> : null}
            {canRestart && isOwner && (
              <div className="st-actions sw-gap-top mp-ov-acts">
                <button type="button" className="st-btn is-sm" onClick={restart} disabled={restarting}>{restarting ? 'Starting again…' : 'Start again'}</button>
              </div>
            )}
          </Note>
        )}
        {problem && <div role="alert" className="st-note is-bad sw-flash"><div>{problem}</div></div>}

        <div className="st-split">
          <Pane
            title="Steps"
            sub="Each step says what is done and what is next. When something is in the way, the row says what."
            ruled
            flush
          >
            {rows.length === 0 ? (
              <p className="sw-pad sw-quiet">Nothing to show yet.</p>
            ) : (
              <div className="mp-checks">
                {rows.map(row => {
                  const meta = CHECKLIST.find(c => c.key === row.key);
                  const label = meta?.label ?? row.key;
                  const muted = row.state === 'not_applicable' || row.state === 'unavailable';
                  const reason = row.reason
                    || (row.key === 'agreement' && row.state === 'not_applicable' && p.internal ? 'Internal test account: no agreement' : null)
                    || (row.state === 'unavailable' ? 'Not available yet.' : null);
                  return (
                    <div key={row.key} className={`mp-check${row.state === 'blocked' ? ' is-blocked' : ''}${muted ? ' is-muted' : ''}`}>
                      <Mark state={row.state} />
                      <div className="mp-check-main">
                        <div className="mp-check-t">{label}</div>
                        {reason && <div className="mp-check-s">{reason}</div>}
                      </div>
                      <div className="mp-check-end">
                        {row.key === 'submit' && row.state !== 'done' && (s.role === 'owner' || s.role === 'admin') && (
                          <button type="button" className="st-btn is-sm is-primary" onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit for review'}</button>
                        )}
                        {meta?.href && !muted && (
                          <Link href={meta.href} className={`st-btn is-sm${row.state === 'done' ? ' is-quiet' : ''}`}>
                            {row.state === 'done' ? 'Review' : meta.action}
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {p.kind === 'individual' && (
              <p className="sw-pad st-hint">Public listing for individual hosts opens later. Your setup is kept until then.</p>
            )}
          </Pane>

          <div className="sw-col">
            <Pane title="Your account" delay={0.06}>
              <dl className="st-kv">
                <div><dt>Name</dt><dd>{p.displayName}</dd></div>
                {p.kind === 'company' && <div><dt>Legal name</dt><dd>{p.legalName || '—'}</dd></div>}
                <div><dt>Kind</dt><dd>{KIND_LABEL[p.kind] ?? p.kind}</dd></div>
                <div><dt>Country</dt><dd>{p.country ? countryName(p.country) : '—'}</dd></div>
                {address && (
                  <div>
                    <dt>Page address</dt>
                    <dd>
                      <span className="mp-url">{PAGE_BASE}<b>{address}</b></span>
                      {!p.slug && <div className="sw-s">Held for you until your page is published.</div>}
                    </dd>
                  </div>
                )}
                {p.counts && (
                  <div>
                    <dt>Team</dt>
                    <dd>
                      {p.counts.members} {p.counts.members === 1 ? 'person' : 'people'}
                      {p.counts.pendingInvites ? `, ${p.counts.pendingInvites} invited` : ''}
                    </dd>
                  </div>
                )}
                {p.counts && p.kind === 'company' && (
                  <div>
                    <dt>Domains</dt>
                    <dd>{p.counts.verifiedDomains} verified{p.counts.pendingDomains ? `, ${p.counts.pendingDomains} not verified yet` : ''}</dd>
                  </div>
                )}
                <div><dt>Created</dt><dd>{day(p.createdAt)}</dd></div>
                {s.role && <div><dt>Your role</dt><dd>{ROLE_LABEL[s.role]}</dd></div>}
              </dl>
              <div className="st-actions sw-gap-top mp-ov-acts">
                <Link href="/account/provider/profile" className="st-btn is-sm">Edit the profile</Link>
                <Link href="/account/provider/team" className="st-btn is-sm">Team</Link>
              </div>
              {isOwner && p.state !== 'closed' && (
                <details className="sw-details mp-close">
                  <summary>Close the provider account</summary>
                  <form className="sw-stack" onSubmit={close}>
                    <p className="sw-quiet">
                      Every member loses access to it. To keep it running without you,{' '}
                      <Link href="/account/provider/team" className="st-link-inline">transfer ownership</Link> instead.
                    </p>
                    <label className="st-field">
                      <span className="st-field-label">Type {p.kind === 'company' ? 'its legal name' : 'its handle'}, {confirmName}, to confirm</span>
                      <input name="confirm" className="st-input" autoComplete="off" spellCheck={false} required />
                    </label>
                    <button type="submit" className="st-btn is-danger" disabled={closing}>{closing ? 'Closing…' : 'Close provider account'}</button>
                  </form>
                </details>
              )}
            </Pane>
          </div>
        </div>
      </div>
    </>
  );
}
