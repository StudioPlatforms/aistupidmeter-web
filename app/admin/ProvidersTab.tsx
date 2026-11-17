'use client';

/**
 * The admin dashboard's Providers tab (Phase 3 plan §10.1–§10.5): the review queue,
 * oldest first with how long each item has waited, and every provider account with its state,
 * owner, team size and domains. Our own test accounts (`internal`) are listed with a tag and left
 * out of every count, as our own accounts are everywhere else on this dashboard.
 *
 * Data: /api/admin/marketplace/{providers,queue} → the API's /internal/admin/marketplace/*. Loaded
 * when the tab is first opened, not with the overview.
 *
 * Logos (M3): the detail lists the provider's uploads with their previews and checks (LogoReview),
 * and a logo waiting in the queue opens its provider's detail.
 *
 * Decisions (M5): the detail's record and decision forms (ProviderDecisions: submissions, listings, logos,
 * measures, appeals, complaints), and the tab's Agreement versions and Reports panes.
 *
 * Integrity (M7): the Integrity cases and Spot checks panes (IntegrityCases); F4: the Calibration pane beside them.
 */
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader, Modal, Note, Pane, Pill, Stats, Stat, Tag } from '@/components/studio';
import { countryName } from '@/lib/countries';
import { KIND_LABEL, STATE_LABEL, stateTone, type ProviderKind, type ProviderState } from '@/lib/provider-account';
import type { AdminLogoRow } from '@/lib/provider-logo';
import { EmptyRow } from './bits';
import { ago, fullDate, num } from './format';

/** Loaded when a provider's detail first shows its logos, with its previews' stylesheet: /admin itself loads nothing new. */
const LogoReview = dynamic(() => import('./LogoReview'), { ssr: false, loading: () => <Loader label="Loading the logos" /> });
/** M4: the open-model registry, loaded with the tab. */
const OpenModels = dynamic(() => import('./OpenModels'), { ssr: false, loading: () => <Loader label="Loading the registry" /> });
/** M5: decisions, measures and the record; agreement versions; reports. */
const ProviderDecisions = dynamic(() => import('./ProviderDecisions'), { ssr: false, loading: () => <Loader label="Loading the record" /> });
const AgreementVersions = dynamic(() => import('./ProviderDecisions').then(m => m.AgreementVersions), { ssr: false, loading: () => <Loader label="Loading the versions" /> });
const Reports = dynamic(() => import('./ProviderDecisions').then(m => m.Reports), { ssr: false, loading: () => <Loader label="Loading the reports" /> });
/** M8: offers waiting for review, loaded with the tab. */
const OfferReview = dynamic(() => import('./OfferReview'), { ssr: false });
/** M7: integrity cases (§10.7) and spot checks (§10.6). */
const IntegrityCases = dynamic(() => import('./IntegrityCases'), { ssr: false, loading: () => <Loader label="Loading the integrity cases" /> });
const SpotChecks = dynamic(() => import('./IntegrityCases').then(m => m.SpotChecks), { ssr: false, loading: () => <Loader label="Loading the spot checks" /> });
// F4 (phase4-plan revision 4 §R2.13): the Calibration pane, beside Integrity cases and Spot checks.
const CalibrationPane = dynamic(() => import('./CalibrationPane'), { ssr: false, loading: () => <Loader label="Loading the calibration" /> });
// F7: user-run tests of listed hosts (nothing while the switch is off and no test exists).
const UserTestsPane = dynamic(() => import('./UserTestsPane'), { ssr: false });

interface AdminProvider {
  id: number;
  publicId: string;
  kind: ProviderKind;
  displayName: string;
  legalName?: string | null;
  country?: string | null;
  state: ProviderState;
  standing?: string;
  internal?: boolean;
  createdAt?: string;
  updatedAt?: string;
  owner?: { userId: number; email: string | null } | null;
  members?: number;
  domains?: { verified: number; pending: number };
  /** OD-8 (M10): members holding a paid plan (their own, or a workspace seat). */
  paidPlans?: number;
  /** OD-8 (M10 fix round): members holding a plan we granted (no Stripe subscription, no payment), counted apart. */
  complimentaryPlans?: number;
}
interface QueueItem {
  id?: number | string; kind: string; providerId?: number; providerName?: string | null; since: string; detail?: string | null;
  /** Logo items (M3 contract §3): the upload and its provider's public id. */
  logoId?: number; publicId?: string;
  /** M5: a legal mail's item (delivery problem, still retrying, held): what [Resend] sends again. */
  mail?: { kind: 'notice' | 'acceptance'; id: number };
}
interface Counts { total: number; byState: Partial<Record<ProviderState, number>> }
/** GET providers/:publicId (M2 contract §5): everything about one account, read-only. */
interface Detail {
  provider: AdminProvider & { tradingName?: string | null; slug?: string | null; proposedSlug?: string | null; testTier?: string };
  members?: Array<{ id: number; role: string; email: string | null; name?: string | null; pending?: boolean }>;
  /** OD-8 (M10): every paid plan a member holds: our independence wording counts no listing, test, ranking or routed-traffic money, and staff see these. */
  paidPlans?: Array<{ userId: number; email: string | null; via: 'own' | 'workspace'; tier: string; status: string | null; stripe: boolean; lastPaymentAt: string | null; complimentary?: boolean }>;
  domains?: Array<{ id: number; domain: string; state: string; verifiedAt?: string | null }>;
  profile?: Record<string, unknown> | null;
  declaration?: { version: number; declaredAt: string } | null;
  events?: Array<{ at: string; actorKind?: string; actorUserId?: number | null; action: string; target?: string | null; detail?: string | null }>;
  /** The provider's logo uploads, newest first, at most 20 (M3 contract §3). */
  logos?: AdminLogoRow[];
  /** M4: endpoints (no key), their safety holds and TLS record; the listings; an internal account's attested hosts. */
  endpoints?: Array<{ id: string; name: string; host: string; healthState: string; hold: { reason: string; since: string } | null;
    tls: { confirmed: { issuer: string; at: string } | null; pending: { issuer: string; from: string; at: string } | null } }>;
  listings?: Array<{ id: number; publicId?: string; model: string; precision: string; state: string; openModel: { name: string } | null }>;
  attestedHosts?: string[];
  /** M13 (privacy 1.9): the transfer arrangement per declared region, and the EU-US Data Privacy Framework flag staff set. */
  transfer?: {
    covered: boolean; reason: string | null; current: boolean; evaluatedAt: string | null;
    regions: Array<{ region: string; countries: string[]; mechanism: string; covered: boolean; words: string }>;
    dpfCertified: boolean; dpfSetBy: number | null; dpfSetAt: string | null;
  };
}

/** Queue kinds and details that read better than their codes; any other is shown as the API names it. */
const QUEUE_KIND: Record<string, string> = {
  logo: 'Logo', open_model_request: 'Model requested', domain_lapse: 'Domain not verified for 7 days', tls_issuer_change: 'New TLS certificate issuer',
  provider_submission: 'Submission', listing: 'Listing added after approval', name_change: 'Name change (pre-moderated)', report: 'Report', appeal: 'Appeal',
  complaint: 'Complaint', offdomain_signer: 'Signer off the verified domain', notice_bounced: 'Legal notice bounced', notice_failed: 'Legal notice not sent',
  notice_deferred: 'Legal notice deferred 24 h', notice_unacknowledged: 'Notice not acknowledged in 7 days', reconcile_failure: 'Decision not applied', mirror_stale: 'Profile mirror older than 30 minutes',
  notice_held: 'Legal mail held (mail was off)', notice_pending: 'Legal mail send not confirmed (a restart)', mail_retrying: 'Legal mail failing (retried)',
  mail_held: 'Legal mail not sent for an hour', acceptance_pdf_missing: 'Signed copy without its PDF',
  // M8 (§8.7): an offer a provider sent for review (decided under "Offers to review" below the queue).
  offer: 'Offer to review',
  integrity: 'Integrity case', spot_key_rotation: 'Spot key due for rotation', spot_key_problem: 'Spot account needs attention',
  // F6c (F6b code review MINOR-1): a note on the standard tasks, decided under "Notes to decide" in the Integrity cases pane.
  integrity_note: 'Integrity note to decide',
  // F6c: the Calibration pane's items (decided there), by the words of its "To decide" rows.
  calibration_decline: 'Calibration declined', calibration_lapsed: 'Calibration invitation lapsed', calibration_admin_item: 'Calibration item to decide',
  calibration_paused_day: 'Calibration paused for the day',
  // M9b (design-features §2.4): the owner's own mail (integrity cases, replies, the address's test send, the digest).
  owner_mail_bounced: 'Owner email bounced', owner_mail_deferred: 'Owner email deferred 24 h', owner_mail_failed: 'Owner email failed',
  owner_mail_held: 'Owner email held (mail was off)', owner_mail_pending: 'Owner email send not confirmed (a restart)',
};
const QUEUE_DETAIL: Record<string, Record<string, string>> = {
  logo: { pending_review: 'Waiting for review', lookalike: 'Looks like another brand’s mark' },
};

type Load = 'loading' | 'ok' | 'off' | 'error';

/** "3d 4h" — how long a queue item has waited. */
function waited(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const h = Math.max(0, (Date.now() - t) / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 48) return `${Math.floor(h)}h`;
  return `${Math.floor(h / 24)}d ${Math.floor(h % 24)}h`;
}

export default function ProvidersTab() {
  const [load, setLoad] = useState<Load>('loading');
  const [error, setError] = useState('');
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [open, setOpen] = useState<AdminProvider | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailError, setDetailError] = useState('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [queueMsg, setQueueMsg] = useState<string | null>(null);

  const openDetail = useCallback(async (p: AdminProvider) => {
    setOpen(p); setDetail(null); setDetailError('');
    try {
      const r = await fetch(`/api/admin/marketplace/providers/${encodeURIComponent(p.publicId)}`, { cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) {
        setDetail(j.data);
        // M12 (M11 review MINOR-10): an account opened from a mail link by its id alone gets its name and state from the detail.
        if (j.data?.provider) setOpen(prev => (prev && prev.publicId === p.publicId && !prev.displayName ? { ...prev, ...j.data.provider } : prev));
      } else setDetailError(j?.message || j?.error || `The API answered ${r.status}.`);
    } catch {
      setDetailError('Could not reach the server.');
    }
  }, []);

  /** M4 staff actions on the open account: confirm a TLS issuer change, attest or withdraw a host. */
  const post = useCallback(async (path: string, body: unknown, done: string) => {
    try {
      const r = await fetch(`/api/admin/marketplace/${path}`, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => null);
      setActionMsg(r.ok && j?.success ? done : (j?.message || j?.error || `The API answered ${r.status}.`));
    } catch {
      setActionMsg('Could not reach the server.');
    }
    if (open) void openDetail(open);
  }, [open, openDetail]);
  /** M5: [Resend] a legal mail from its queue item: one more copy through the outbox (the health unit sends it within a minute). */
  const resend = useCallback(async (m: NonNullable<QueueItem['mail']>) => {
    try {
      const r = await fetch(`/api/admin/marketplace/${m.kind === 'notice' ? 'notices' : 'acceptances'}/${m.id}/resend`, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json().catch(() => null);
      setQueueMsg(r.ok && j?.success ? `Queued: the ${m.kind === 'notice' ? 'notice' : 'signed copy'} #${m.id} goes again within a minute.` : (j?.message || j?.error || `The API answered ${r.status}.`));
    } catch {
      setQueueMsg('Could not reach the server.');
    }
  }, []);
  const confirmTls = (endpointId: string) => post(`holds/${encodeURIComponent(endpointId)}/confirm-tls`, {}, 'Confirmed: the hold is lifted.');
  const attest = (host: string, attested: boolean) => open ? post(`providers/${encodeURIComponent(open.publicId)}/hosts`, { host, attested }, attested ? `${host} attested` : `${host} withdrawn`) : Promise.resolve();
  /** M13: staff record (or withdraw) the host's EU-US Data Privacy Framework certification; its US regions count only then. */
  const setDpf = (certified: boolean) => {
    if (!open) return Promise.resolve();
    if (!confirm(certified
      ? `Record that ${open.displayName || 'this host'} is certified under the EU-US Data Privacy Framework? Check it on the DPF list first: its US regions then count as covered, and its connections to the Smart Router resume.`
      : `Withdraw the EU-US Data Privacy Framework certification of ${open.displayName || 'this host'}? A host that declares US regions is then not covered: its connections are suspended at once and its connected users are emailed.`)) return Promise.resolve();
    return post(`providers/${encodeURIComponent(open.publicId)}/dpf`, { certified }, certified ? 'Recorded: certified under the EU-US Data Privacy Framework.' : 'Withdrawn: not certified under the EU-US Data Privacy Framework.');
  };

  const fetchAll = useCallback(async () => {
    try {
      const [p, q] = await Promise.all([
        fetch('/api/admin/marketplace/providers', { cache: 'no-store' }),
        fetch('/api/admin/marketplace/queue', { cache: 'no-store' }),
      ]);
      if (p.status === 404) { setLoad('off'); return; }
      const pj = await p.json().catch(() => null);
      const qj = q.ok ? await q.json().catch(() => null) : null;
      if (!p.ok || !pj?.success) { setError(pj?.error || `The API answered ${p.status}.`); setLoad('error'); return; }
      setProviders(Array.isArray(pj.data?.providers) ? pj.data.providers : []);
      setCounts(pj.data?.counts ?? null);
      setQueue(Array.isArray(qj?.data?.items) ? qj.data.items : []);
      setLoad('ok');
    } catch {
      setError('Could not reach the server.');
      setLoad('error');
    }
  }, []);
  useEffect(() => { void fetchAll(); }, [fetchAll]);
  // M11: the owner's submission mail links to /admin?provider=<public id>#providers: once the accounts are loaded, that
  // account's review opens, and the parameter is dropped from the address (the hash stays), as ?case= in Integrity cases.
  useEffect(() => {
    if (load !== 'ok') return;
    const id = new URLSearchParams(window.location.search).get('provider');
    if (!id || !/^[a-z2-7]{10}$/.test(id)) return;
    const u = new URL(window.location.href); u.searchParams.delete('provider');
    window.history.replaceState(null, '', `${u.pathname}${u.search}${u.hash}`);
    // M12 (M11 review MINOR-10): the list holds the newest 500 accounts; an older one opens by its id (the detail read
    // needs only the id, and fills the name and state in).
    const p = providers.find(x => x.publicId === id);
    void openDetail(p ?? ({ publicId: id } as AdminProvider));
  }, [load, providers, openDetail]);

  if (load === 'loading') return <Loader label="Loading provider accounts" minHeight={240} />;
  if (load === 'off') {
    return (
      <Note title="No provider accounts to show">
        The API does not answer for provider accounts: they are switched off, or this API release does not have them.
      </Note>
    );
  }
  if (load === 'error') {
    return (
      <Note tone="bad" title="Provider accounts did not load">
        {error} <button type="button" className="st-more ad-linkbtn" onClick={() => { setLoad('loading'); void fetchAll(); }}>Try again</button>
      </Note>
    );
  }

  // Our own test accounts are shown, tagged, and never counted: the API's counts leave them out,
  // and the fallback below does the same.
  const customers = providers.filter(p => !p.internal);
  // A logo waiting for review opens its provider's detail, where the upload is shown.
  const queueProvider = (it: QueueItem) => {
    const label = it.providerName ?? (it.providerId ? `#${it.providerId}` : '—');
    const p = it.publicId ? providers.find(x => x.publicId === it.publicId) : undefined;
    return p
      ? <button type="button" className="mp-admin-open" title={`Open ${p.displayName}`} onClick={() => openDetail(p)}>{label}</button>
      : label;
  };
  const count = (s: ProviderState) => counts?.byState?.[s] ?? customers.filter(p => p.state === s).length;
  const total = counts?.total ?? customers.length;
  const ordered = [...queue].sort((a, b) => Date.parse(a.since) - Date.parse(b.since));

  return (
    <>
      <Stats columns={4}>
        <Stat value={num(total)} label="Provider accounts" sub="our test accounts left out" />
        <Stat value={num(count('in_review'))} label="Awaiting approval" sub={`${num(count('changes_requested'))} with changes requested`} />
        <Stat value={num(count('approved'))} label="Approved" sub={`${num(count('draft'))} still in draft`} />
        <Stat value={num(providers.length - customers.length)} label="Internal test accounts" sub="never public, never counted" />
      </Stats>

      <Pane title="Review queue" sub="Oldest first, with how long each item has waited." ruled flush>
        {queueMsg && <Note>{queueMsg}</Note>}
        <div className="st-table-wrap">
          <table className="st-table">
            <thead><tr><th>Waiting</th><th>Item</th><th>Provider</th><th className="ad-hide-sm">Since</th></tr></thead>
            <tbody>
              {ordered.length === 0 && <EmptyRow cols={4}>Nothing is waiting for review.</EmptyRow>}
              {ordered.map((it, i) => (
                <tr key={`${it.kind}-${it.id ?? i}`}>
                  <td className="is-num">{waited(it.since)}</td>
                  <td>
                    <div className="ad-acct">
                      <span className="ad-acct-e ad-queue-kind">{QUEUE_KIND[it.kind] ?? it.kind.replace(/_/g, ' ')}</span>
                      {it.detail && <span className="ad-acct-s">{QUEUE_DETAIL[it.kind]?.[it.detail] ?? it.detail}</span>}
                      {it.mail && <button type="button" className="st-more ad-linkbtn" onClick={() => { const m = it.mail; if (m) void resend(m); }}>Resend</button>}
                    </div>
                  </td>
                  <td>{queueProvider(it)}</td>
                  <td className="ad-hide-sm is-dim" title={fullDate(it.since)}>{ago(it.since)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Pane>

      <OfferReview onChange={() => void fetchAll()} />

      <Pane title="Provider accounts" sub="Every provider account, newest first. Open one to see its record and decide." ruled flush>
        <div className="st-table-wrap">
          <table className="st-table">
            <thead>
              <tr>
                <th>Provider</th><th>State</th><th className="ad-hide-sm">Owner</th>
                <th className="is-num ad-hide-md">People</th><th className="is-num ad-hide-md">Domains</th><th className="is-num">Created</th>
              </tr>
            </thead>
            <tbody>
              {providers.length === 0 && <EmptyRow cols={6}>No provider accounts yet.</EmptyRow>}
              {[...providers].sort((a, b) => Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? '')).map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="ad-acct">
                      <button type="button" className="ad-acct-e mp-admin-open" title={`Open ${p.displayName}`} onClick={() => openDetail(p)}>{p.displayName}</button>
                      <span className="ad-acct-s">
                        {p.internal && <Tag tone="line" title="One of our own test accounts, left out of every total">Internal</Tag>}
                        {p.paidPlans ? <Tag tone="line" title="Members of this provider hold a paid plan: open the account to see them">Paid plan × {p.paidPlans}</Tag> : null}
                        {p.complimentaryPlans ? <Tag tone="line" title="Members of this provider hold a plan we granted (no Stripe subscription, no payment): open the account to see them">Complimentary plan × {p.complimentaryPlans}</Tag> : null}
                        {KIND_LABEL[p.kind] ?? p.kind}
                        {p.legalName ? ` · ${p.legalName}` : ''}
                        {p.country ? ` · ${countryName(p.country)}` : ''}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="ad-acct">
                      <span><Pill tone={stateTone(p.state)}>{STATE_LABEL[p.state] ?? p.state}</Pill></span>
                      {p.standing && p.standing !== 'good' && <span className="ad-acct-s">Standing: {p.standing.replace(/_/g, ' ')}</span>}
                    </div>
                  </td>
                  <td className="ad-hide-sm">{p.owner?.email ?? <span className="st-faint">—</span>}</td>
                  <td className="is-num ad-hide-md">{typeof p.members === 'number' ? num(p.members) : '—'}</td>
                  <td className="is-num ad-hide-md">
                    {p.domains ? <>{num(p.domains.verified)} verified{p.domains.pending ? <span className="st-faint">, {num(p.domains.pending)} pending</span> : null}</> : '—'}
                  </td>
                  <td className="is-num" title={fullDate(p.createdAt ?? null)}>{ago(p.createdAt ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Pane>

      <OpenModels />
      <AgreementVersions />
      <Reports />
      <IntegrityCases />
      <SpotChecks />
      <CalibrationPane />
      <UserTestsPane />

      <Modal
        open={!!open}
        onClose={() => { setOpen(null); setActionMsg(null); }}
        title={open?.displayName || 'Provider account'}
        sub={open && open.kind ? `${KIND_LABEL[open.kind] ?? open.kind} · ${STATE_LABEL[open.state] ?? open.state}${open.internal ? ' · internal test account' : ''}` : undefined}
        size="wide"
      >
        {!detail && !detailError && <Loader label="Loading" />}
        {detailError && <Note tone="bad" title="This account did not load">{detailError}</Note>}
        {detail && (
          <div className="mp-admin-detail">
            <dl className="st-kv is-tight">
              <div><dt>Public id</dt><dd>{detail.provider.publicId}</dd></div>
              {detail.provider.legalName && <div><dt>Legal name</dt><dd>{detail.provider.legalName}</dd></div>}
              {detail.provider.tradingName && <div><dt>Trading name</dt><dd>{detail.provider.tradingName}</dd></div>}
              <div><dt>Country</dt><dd>{detail.provider.country ? countryName(detail.provider.country) : '—'}</dd></div>
              <div><dt>Address</dt><dd>{detail.provider.slug ?? detail.provider.proposedSlug ?? '—'}{!detail.provider.slug && detail.provider.proposedSlug ? ' (held)' : ''}</dd></div>
              <div><dt>Standing</dt><dd>{(detail.provider.standing ?? 'good').replace(/_/g, ' ')}{detail.provider.testTier ? ` · tier ${detail.provider.testTier.replace(/_/g, ' ')}` : ''}</dd></div>
              <div><dt>Created</dt><dd>{fullDate(detail.provider.createdAt ?? null)}</dd></div>
              <div><dt>Data declaration</dt><dd>{detail.declaration ? `version ${detail.declaration.version}, ${fullDate(detail.declaration.declaredAt)}` : 'none yet'}</dd></div>
            </dl>
            {detail.members && detail.members.length > 0 && (
              <>
                <p className="st-label mp-admin-h">People</p>
                <ul className="mp-admin-list">
                  {detail.members.map(m => (
                    <li key={m.id}><span>{m.name ? `${m.name} · ` : ''}{m.email ?? '—'}</span><span className="st-faint">{m.role}{m.pending ? ', invited' : ''}</span></li>
                  ))}
                </ul>
              </>
            )}
            {detail.paidPlans && detail.paidPlans.length > 0 && (
              <>
                <p className="st-label mp-admin-h">Plans held by its members</p>
                <ul className="mp-admin-list">
                  {detail.paidPlans.map((x, i) => (
                    <li key={`${x.userId}-${x.via}-${i}`}><span>{x.email ?? `user #${x.userId}`} · {x.tier}{x.status ? ` (${x.status})` : ''}{x.via === 'workspace' ? ', through a workspace seat' : ''}</span>
                      <span className="st-faint">{x.complimentary ? 'complimentary: no Stripe subscription, no payment' : x.stripe ? 'Stripe subscription' : 'no Stripe subscription'}{x.lastPaymentAt ? ` · last paid ${fullDate(x.lastPaymentAt)}` : ''}</span></li>
                  ))}
                </ul>
              </>
            )}
            {detail.domains && detail.domains.length > 0 && (
              <>
                <p className="st-label mp-admin-h">Domains</p>
                <ul className="mp-admin-list">
                  {detail.domains.map(d => (
                    <li key={d.id}><span>{d.domain}</span><span className="st-faint">{d.state}{d.verifiedAt ? `, ${fullDate(d.verifiedAt)}` : ''}</span></li>
                  ))}
                </ul>
              </>
            )}
            {detail.endpoints && detail.endpoints.length > 0 && (
              <>
                <p className="st-label mp-admin-h">Endpoints</p>
                <ul className="mp-admin-list">
                  {detail.endpoints.map(e => (
                    <li key={e.id}>
                      <span>
                        {e.name} · {e.host}
                        {e.hold ? ` · held (${e.hold.reason.replace(/_/g, ' ')}) since ${fullDate(e.hold.since)}` : ''}
                        {e.tls.pending ? ` · new issuer ${e.tls.pending.issuer} (was ${e.tls.pending.from})` : e.tls.confirmed ? ` · issuer ${e.tls.confirmed.issuer}` : ''}
                      </span>
                      <span className="st-faint">
                        {e.healthState}
                        {e.tls.pending && <> · <button type="button" className="st-more ad-linkbtn" onClick={() => void confirmTls(e.id)}>Confirm the new issuer</button></>}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {detail.listings && detail.listings.length > 0 && (
              <>
                <p className="st-label mp-admin-h">Listings</p>
                <ul className="mp-admin-list">
                  {detail.listings.map(l => <li key={l.id}><span>{l.openModel?.name ?? l.model} · {l.precision.toUpperCase()}</span><span className="st-faint">{l.state.replace(/_/g, ' ')}</span></li>)}
                </ul>
              </>
            )}
            {detail.transfer && (
              <>
                <p className="st-label mp-admin-h">International transfers (Smart Router connections)</p>
                <p className="st-faint">
                  {detail.transfer.covered ? 'Covered: users can connect this host.' : `Not covered: users cannot connect this host, and connections to it are suspended. ${detail.transfer.reason ?? ''}`}
                  {detail.transfer.evaluatedAt ? ` Evaluated ${fullDate(detail.transfer.evaluatedAt)}.` : ' Not evaluated yet.'}
                </p>
                <ul className="mp-admin-list">
                  {detail.transfer.regions.map(r => (
                    <li key={r.region}><span>{r.region}{r.countries.length && r.mechanism !== 'eea' && r.countries.join(', ') !== r.region ? ` (${r.countries.join(', ')})` : ''}</span><span className="st-faint">{r.words}</span></li>
                  ))}
                  <li>
                    <span>EU-US Data Privacy Framework: {detail.transfer.dpfCertified ? 'certified' : 'not recorded'}{detail.transfer.dpfSetAt ? ` (set ${fullDate(detail.transfer.dpfSetAt)}${detail.transfer.dpfSetBy ? ` by user #${detail.transfer.dpfSetBy}` : ''})` : ''}</span>
                    <span><button type="button" className="st-more ad-linkbtn" onClick={() => void setDpf(!detail.transfer!.dpfCertified)}>{detail.transfer.dpfCertified ? 'Withdraw' : 'Record certification'}</button></span>
                  </li>
                </ul>
                {actionMsg && !detail.provider.internal && <Note>{actionMsg}</Note>}
              </>
            )}
            {detail.provider.internal && (
              <>
                <p className="st-label mp-admin-h">Attested hosts</p>
                <p className="st-faint">An internal test account may use endpoint hosts outside its verified domains once staff attest them (§2.2).</p>
                <ul className="mp-admin-list">
                  {(detail.attestedHosts ?? []).map(h => (
                    <li key={h}><span>{h}</span><span><button type="button" className="st-more ad-linkbtn" onClick={() => void attest(h, false)}>Withdraw</button></span></li>
                  ))}
                </ul>
                <form className="mp-admin-attest" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const h = String(f.get('host') ?? '').trim(); if (h) void attest(h, true); e.currentTarget.reset(); }}>
                  <input name="host" className="st-input" placeholder="gpu1.example.net" aria-label="Host to attest" />
                  <button type="submit" className="st-btn is-sm">Attest host</button>
                </form>
                {actionMsg && <Note>{actionMsg}</Note>}
              </>
            )}
            {detail.logos && (
              <>
                <p className="st-label mp-admin-h">Logo</p>
                <LogoReview logos={detail.logos} name={detail.provider.displayName} />
              </>
            )}
            <ProviderDecisions
              publicId={detail.provider.publicId}
              state={detail.provider.state}
              internal={!!detail.provider.internal}
              kind={detail.provider.kind}
              listings={detail.listings ?? []}
              logos={(detail.logos ?? []).map(l => ({ id: Number((l as { id?: unknown }).id), state: String((l as { state?: unknown }).state ?? '') }))}
              onChange={() => { if (open) void openDetail(open); void fetchAll(); }}
            />
            {detail.events && detail.events.length > 0 && (
              <>
                <p className="st-label mp-admin-h">Recent events</p>
                <ul className="mp-admin-list">
                  {detail.events.slice(0, 30).map((e, i) => (
                    <li key={`${e.at}-${i}`}>
                      <span>{e.action.replace(/_/g, ' ')}{e.target ? ` · ${e.target}` : ''}{e.detail ? ` · ${e.detail}` : ''}</span>
                      <span className="st-faint" title={fullDate(e.at)}>{ago(e.at)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
