'use client';

/**
 * Models (phase3-plan §2.9, §2.8 readiness; M4): the provider's listings. One row per listing with its state,
 * prices, precision, context and readiness results; one row per tested model on the endpoints with
 * [List this model]; "Request a model we don't have". The readiness check is a job our benchmark unit runs
 * (fixed, published prompts; never published itself): this page queues it and follows it.
 *
 * Shapes: the API contract (GET /account/provider/models and its children).
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Pane, Loader, Note, Pill, Modal, Empty } from '@/components/studio';
import { ProviderHead, FieldError, canEdit, useProviderSummary } from '@/components/marketplace/ProviderBits';
import { mpApi, startUnavailableText, type ProviderSummary } from '@/lib/provider-account';
import { StartBenchDialog, StopBenchDialog, CalibrationDialog, WithdrawCalibrationDialog, BENCH_STATE, MEASURING } from '@/components/marketplace/BenchDialogs';
import { SubmitButton, SubmitLine } from './SubmitForReview';
import '@/styles/studio-provider-models.css';

interface OpenModel { id: number; slug: string; name: string; maker: string; contextTokens: number | null }
/** A stored readiness result. An older or partial record can lack any of its checks: ReadinessView shows "—" for those. */
interface Readiness {
  passed: boolean; blocking: string[]; current: boolean;
  parameters?: { accepted?: boolean; dropped?: string[] } | null;
  outputLimit?: number | null; output?: Array<{ maxTokens: number; accepted: boolean; status: number | null }>;
  concurrency?: { declared?: number; sent?: number; answered?: number; ok?: boolean } | null;
  rate?: { sent?: number; rateLimited?: number; ok?: boolean } | null;
  streamUsage?: boolean | null; keyCheck?: { bogusKeyRefused?: boolean | null; status?: number | null } | null;
  costUsd?: number | null; finishedAt?: string | null;
}
interface Run { id: string; status: string; reason: string | null; createdAt: string; finishedAt: string | null; costUsd: number | null }
interface Listing {
  id: number; publicId: string; entrySlug: string;
  openModel: { id: number; slug: string; name: string; maker: string } | null;
  endpoint: { id: string; name: string; baseUrl: string } | null;
  model: string; precision: string; precisionNote: string | null; contextTokens: number; maxOutputTokens: number;
  priceIn: number; priceOut: number; priceCached: number | null; regions: string[]; rateLimits: string | null; modelUrl: string | null;
  state: string; pauseReason: string | null; benchState: string;
  readiness: Readiness | null; readinessAt: string | null; lastReadinessRun: Run | null;
  submissionGaps: Array<{ code: string; message: string }>;
  effective?: { row: number; scheduler: string; schedulerReason: string | null };
}
interface Probed { endpoint: { id: string; name: string }; model: string; chatPassed: boolean; testedAt: string | null; contextTokens: number | null; refusal: { code: string; message: string } | null }
interface Data {
  listings: Listing[]; probedModels: Probed[]; openModels: OpenModel[];
  precisions: Array<{ value: string; label: string }>; regions: string[];
  limits: { max: number; used: number; rateLimitsText: number };
  readiness: { prompts: Record<string, string> };
  canManage: boolean; individual: boolean;
  /** F4 (revision 4 §R2.3): each listing's "Fresh task versions" line by public id; an older API sends none. */
  calibration?: Record<string, { state: string; text: string }>;
}

const STATE: Record<string, { label: string; tone?: 'good' | 'warn' | 'bad' }> = {
  draft: { label: 'Draft' }, in_review: { label: 'Awaiting approval', tone: 'warn' }, published: { label: 'Listed', tone: 'good' },
  paused: { label: 'Paused', tone: 'warn' }, delisted: { label: 'Delisted', tone: 'bad' },
};
const fmt = (n: number) => n.toLocaleString('en-US');
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const money = (n: number | null) => (n === null ? '—' : `$${n.toLocaleString('en-US', { maximumFractionDigits: 4 })}`);
const running = (r: Run | null) => !!r && (r.status === 'queued' || r.status === 'running');

const RUN_REASON: Record<string, string> = {
  auth: 'the endpoint refused the key', key_unreadable: 'the stored key could not be read', config_changed: 'the listing or its endpoint changed',
  hold: 'the endpoint is paused for a security check', not_allowed: 'the listing cannot run checks now', not_https: 'the endpoint is not https',
  failed: 'it failed on our side', interrupted_by_us: 'we restarted the checker', crash: 'the checker stopped',
  unreachable: 'the endpoint gave no usable answer (no reply in time, or server errors only)', timeout: 'it took longer than 5 minutes',
};

/** What a readiness row shows for a check the record does not carry: neutral, never red. */
const MISSING = '—';
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function ReadinessView({ r }: { r: Readiness }) {
  // Every check is read defensively: a record without one (no concurrency or rate, say) shows "—" on that row
  // instead of throwing, which took the whole page to the error screen.
  const p = r.parameters, c = r.concurrency, rt = r.rate, kc = r.keyCheck;
  const dropped = p?.dropped ?? [];
  const lines: Array<[string, string, boolean]> = [
    typeof p?.accepted !== 'boolean' ? ['Parameters', MISSING, true] : ['Parameters', p.accepted
      ? (dropped.length ? `accepted after dropping ${dropped.join(', ')}` : 'temperature 0.1, reasoning_effort "high" and max_tokens 64,000 accepted')
      : 'refused, with no fallback', p.accepted],
    r.outputLimit === undefined ? ['Output limit', MISSING, true]
      : ['Output limit', r.outputLimit !== null ? `${fmt(r.outputLimit)} tokens` : 'no max_tokens value was accepted', r.outputLimit !== null],
    ['Concurrency', !c ? MISSING
      : isNum(c.sent) && c.sent > 0 ? (isNum(c.answered) ? `${c.answered} of ${c.sent} parallel requests answered within 60 s` : MISSING)
      : isNum(c.declared) ? `the endpoint takes ${c.declared} requests at a time; 4 are needed` : MISSING, c?.ok !== false],
    ['Rate', !rt || !isNum(rt.sent) || !isNum(rt.rateLimited) ? MISSING
      : rt.rateLimited ? `${rt.rateLimited} of ${rt.sent} requests in 20 s answered 429` : `${rt.sent} requests in 20 s without a 429`, rt?.ok !== false],
    ['Streaming with usage', r.streamUsage === null ? 'not checked' : typeof r.streamUsage === 'boolean' ? (r.streamUsage ? 'yes' : 'no') : MISSING, true],
    ['Key check', !kc ? MISSING : kc.bogusKeyRefused === true ? 'GET /models refuses a wrong key' : kc.bogusKeyRefused === false ? 'GET /models answers a wrong key too: users’ key checks use a 1-token chat on this host' : 'not determined', true],
  ];
  return (
    <dl className="st-kv mp-rd">
      {lines.map(([k, v, okay]) => (
        <div key={k}><dt>{k}</dt><dd className={okay ? undefined : 'mp-rd-bad'}>{v}</dd></div>
      ))}
      <div><dt>Cost</dt><dd>{isNum(r.costUsd) ? `${money(r.costUsd)} at your declared price` : MISSING}{r.finishedAt ? ` · ${day(r.finishedAt)}` : ''}</dd></div>
    </dl>
  );
}

interface FormState {
  listingId: number | null; endpointId: string; model: string; openModelId: string; precision: string; precisionNote: string;
  contextTokens: string; maxOutputTokens: string; priceIn: string; priceOut: string; priceCached: string; regions: string[]; rateLimits: string; modelUrl: string;
}

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

/**
 * A listing's "Fresh task versions" line (F4; F5b, web review MINOR-4): the API's words without the model's label; a move's
 * own words (moving, on fresh) read on their own ("Calibrated: moving to fresh task versions on 23 Nov 2026"), the others
 * after "Fresh task versions:". Exported for the render tests.
 */
export function calibrationLine(c: { state: string; text: string }): string {
  const t = c.text.replace(/^[^:]*: /, '');
  return c.state === 'moving' || c.state === 'on_fresh' ? `${t.charAt(0).toUpperCase()}${t.slice(1)}` : `Fresh task versions: ${t}`;
}

export default function ModelsClient({ initial }: { initial: ProviderSummary }) {
  const { status } = useSession();
  const [s] = useProviderSummary(initial);
  const [d, setD] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  const [bench, setBench] = useState<{ id: number; label: string; kind: 'start' | 'stop' | 'calibrate' | 'withdraw' } | null>(null);
  const editable = canEdit(s) && (d?.canManage ?? true);

  const load = useCallback(async () => {
    const r = await mpApi<Data>('/models');
    if (r.ok && r.data) { setD(r.data); setLoadError(null); } else setLoadError(r.error);
  }, []);
  useEffect(() => { if (status === 'authenticated') void load(); }, [status, load]);
  // A readiness check is followed every 3 s while one runs.
  const anyRunning = !!d?.listings.some(l => running(l.lastReadinessRun));
  useEffect(() => {
    if (!anyRunning) return;
    const t = window.setInterval(() => { void load(); }, 3000);
    return () => window.clearInterval(t);
  }, [anyRunning, load]);

  const flash = (text: string, bad = false) => { setMsg({ text, bad }); window.setTimeout(() => setMsg(null), 9000); };

  const openNew = (p: Probed) => {
    const match = d?.openModels.find(o => p.model.toLowerCase().includes(o.slug.replace(/-/g, '').slice(0, 6)) || p.model.toLowerCase().includes(o.name.toLowerCase()));
    setFields({}); setFormError(null);
    setForm({
      listingId: null, endpointId: p.endpoint.id, model: p.model, openModelId: match ? String(match.id) : '', precision: 'bf16', precisionNote: '',
      contextTokens: p.contextTokens ? String(p.contextTokens) : '', maxOutputTokens: '', priceIn: '', priceOut: '', priceCached: '', regions: [], rateLimits: '', modelUrl: '',
    });
  };
  const openEdit = (l: Listing) => {
    setFields({}); setFormError(null);
    setForm({
      listingId: l.id, endpointId: l.endpoint?.id ?? '', model: l.model, openModelId: l.openModel ? String(l.openModel.id) : '', precision: l.precision,
      precisionNote: l.precisionNote ?? '', contextTokens: String(l.contextTokens), maxOutputTokens: String(l.maxOutputTokens),
      priceIn: String(l.priceIn), priceOut: String(l.priceOut), priceCached: l.priceCached === null ? '' : String(l.priceCached),
      regions: l.regions, rateLimits: l.rateLimits ?? '', modelUrl: l.modelUrl ?? '',
    });
  };
  const editingDraft = useMemo(() => !form?.listingId || d?.listings.find(l => l.id === form.listingId)?.state === 'draft', [form, d]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || saving) return;
    const body: Record<string, unknown> = {
      priceIn: numOrNull(form.priceIn), priceOut: numOrNull(form.priceOut), priceCached: numOrNull(form.priceCached),
      regions: form.regions, rateLimits: form.rateLimits.trim() || null, modelUrl: form.modelUrl.trim() || null,
    };
    if (editingDraft) Object.assign(body, {
      endpointId: form.endpointId, model: form.model, openModelId: Number(form.openModelId) || null, precision: form.precision,
      precisionNote: form.precision === 'other' ? form.precisionNote.trim() : null,
      contextTokens: numOrNull(form.contextTokens), maxOutputTokens: numOrNull(form.maxOutputTokens),
    });
    setSaving(true); setFormError(null);
    const r = form.listingId
      ? await mpApi(`/models/${form.listingId}`, { method: 'PATCH', body })
      : await mpApi('/models', { method: 'POST', body });
    setSaving(false);
    if (r.ok) { setForm(null); flash(form.listingId ? 'Saved' : `${form.model} is listed as a draft. Run its readiness check next.`); void load(); }
    else { setFields(r.fields ?? {}); setFormError(r.error); }
  };

  const readiness = async (l: Listing) => {
    setBusy(l.id);
    const r = await mpApi(`/models/${l.id}/readiness`, { method: 'POST', body: {} });
    setBusy(null);
    if (r.ok) flash('The readiness check is queued. It takes a minute or two; this page follows it.');
    else flash(r.error ?? 'Not started', true);
    void load();
  };
  // M11: a listing added after approval goes to review on its own (POST /models/:id/submit); the owner is mailed at once.
  // M12 (M11 review MINOR-9): the button reads "Submitting…" meanwhile; once submitted the row loses its button, so focus
  // moves to the row (its pill now reads "Awaiting approval") instead of falling to the page's top.
  const submitListing = async (l: Listing) => {
    setBusy(l.id);
    const r = await mpApi<{ message?: string }>(`/models/${l.id}/submit`, { method: 'POST', body: {} });
    setBusy(null);
    if (r.ok) flash(r.data?.message ?? 'Submitted: the listing is awaiting approval.'); else flash(r.error ?? 'Not submitted', true);
    await load();
    if (r.ok) window.setTimeout(() => document.getElementById(`lst-${l.id}`)?.focus(), 0);
  };
  const remove = async (l: Listing) => {
    if (!confirm(`Remove the draft listing of ${l.openModel?.name ?? l.model}?`)) return;
    setBusy(l.id);
    const r = await mpApi(`/models/${l.id}`, { method: 'DELETE' });
    setBusy(null);
    if (r.ok) flash('Removed'); else flash(r.error ?? 'Not removed', true);
    void load();
  };
  const ask = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const form2 = e.currentTarget;
    setAsking(true);
    const r = await mpApi('/models/request', { method: 'POST', body: { name: String(f.get('name') ?? ''), maker: String(f.get('maker') ?? ''), weightsUrl: String(f.get('weightsUrl') ?? '') || null } });
    setAsking(false);
    if (r.ok) { form2.reset(); flash('Sent. We add models to the registry by hand; you will see it here once it is in.'); }
    else flash(r.error ?? 'Not sent', true);
  };

  if (status === 'loading') return <div data-page-loading><Loader label="Loading your models" minHeight={420} /></div>;
  const listed = new Set((d?.listings ?? []).map(l => `${l.endpoint?.id}|${l.model}`));
  const probed = (d?.probedModels ?? []).filter(p => p.chatPassed && !listed.has(`${p.endpoint.id}|${p.model}`));
  const untested = (d?.probedModels ?? []).filter(p => !p.chatPassed && !listed.has(`${p.endpoint.id}|${p.model}`));

  return (
    <>
      <ProviderHead summary={s} title="Models" lead="The models you serve, open-source or closed, at the price and precision you serve them. Each one needs a passing readiness check before it can be submitted." />
      <div className="st-body sw-body">
        {msg && <div role="status" className={`st-note sw-flash${msg.bad ? ' is-bad' : ''}`}><div>{msg.text}</div></div>}
        {/* F4 (revision 4 §R2.3): the console banner of an open calibration (console first: mail is never the only channel). */}
        {d && d.calibration && Object.values(d.calibration).some(c => c.state === 'needs_answer') && (
          <Note tone="warn" title="Calibration needed">
            {Object.values(d.calibration).filter(c => c.state === 'needs_answer').map(c => c.text.replace(': calibration needed: ', ': ')).join('; ')}. Review it on the listing below: nothing runs before you confirm.
          </Note>
        )}
        {/* F5 (revision 4 §R2.11): the move's console banner during its 15-day notice (an operational notice, as the mail). */}
        {d && d.calibration && Object.values(d.calibration).some(c => c.state === 'moving') && (
          <Note title="Moving to fresh task versions">
            {Object.values(d.calibration).filter(c => c.state === 'moving').map(c => c.text.replace(': calibrated: moving to fresh task versions on ', ': on ')).join('; ')}. Each listing&apos;s published scores start a new series on its day: the listing reads &ldquo;Re-measuring&rdquo; until 3 runs per suite are published.
          </Note>
        )}
        {loadError && <Note tone="bad" title="Not loaded">{loadError}</Note>}
        {!d && !loadError && <Loader label="Loading your models" />}
        {d?.individual && <Note>Public listing for individual hosts opens later.</Note>}
        {d && (
          <>
            <Pane title="Listings" sub={<>{fmt(d.limits.used)} of {fmt(d.limits.max)}{d.individual ? null : <> · whether people can reach them through the Smart Router is set on <Link href="/account/provider/router">Router &amp; offers</Link></>}</>} ruled flush>
              {d.listings.length === 0 ? (
                <div className="sw-pad"><p className="sw-quiet">No model listed yet. Test a model on one of your <Link href="/account/provider/endpoints">endpoints</Link>, then list it below.</p></div>
              ) : d.listings.map(l => {
                const st = STATE[l.state] ?? { label: l.state };
                const run = l.lastReadinessRun;
                return (
                  <div className="mp-check mp-lst is-plain" key={l.id} id={`lst-${l.id}`} tabIndex={-1}>
                    <div className="mp-check-main">
                      <div className="mp-check-t">{l.openModel?.name ?? l.model} · {l.precision.toUpperCase()}{l.precisionNote ? ` (${l.precisionNote})` : ''}</div>
                      <div className="mp-check-s">
                        {l.endpoint ? <>{l.endpoint.name} · <span className="mp-lst-id">{l.model}</span></> : 'Its endpoint was removed'}
                        {' · '}{fmt(l.contextTokens)} context · max output {fmt(l.maxOutputTokens)} · ${l.priceIn} in / ${l.priceOut} out per 1M
                      </div>
                      {running(run) && <p className="mp-check-s">Readiness check {run!.status === 'queued' ? 'queued' : 'running'}…</p>}
                      {!running(run) && run && (run.status === 'abandoned' || run.status === 'interrupted' || run.status === 'failed') && (
                        <p className="mp-check-s mp-rd-bad">The last readiness check did not finish: {RUN_REASON[run.reason ?? ''] ?? run.reason ?? run.status}.</p>
                      )}
                      {l.readiness && (
                        <details className="mp-lst-rd" open={!l.readiness.passed}>
                          <summary>Readiness: {l.readiness.passed ? 'passed' : 'failed'}{l.readiness.current ? '' : ' (before a change: run it again)'}</summary>
                          <ReadinessView r={l.readiness} />
                        </details>
                      )}
                      {l.submissionGaps.length > 0 && (
                        <ul className="sw-list mp-lst-gaps">{l.submissionGaps.map(g => <li key={g.code}>{g.message}</li>)}</ul>
                      )}
                      {/* M11: once the account is approved, a new listing is submitted on its own (owners and admins: a viewer cannot submit).
                          M12: outside good standing the line says why and there is no button (MINOR-5); the button points here (MINOR-9). */}
                      <SubmitLine l={l} provider={s.provider} editable={editable} />
                      {d?.calibration?.[l.publicId] && d.calibration[l.publicId].state !== 'not_available' && (
                        <p className="mp-check-s">{calibrationLine(d.calibration[l.publicId])}</p>
                      )}
                    </div>
                    <div className="mp-check-end">
                      <Pill tone={st.tone}>{st.label}</Pill>
                      {l.benchState !== 'not_started' && BENCH_STATE[l.benchState] && <Pill tone={BENCH_STATE[l.benchState].tone}>{BENCH_STATE[l.benchState].label}</Pill>}
                      {editable && l.state !== 'delisted' && (
                        <>
                          {(l.effective?.scheduler === 'yes' || l.effective?.scheduler === 'resume_probe_only') && l.readiness?.passed && l.readiness.current && !['active', 'waiting_slot'].includes(l.benchState) && (
                            <button type="button" className="st-btn is-sm is-primary" onClick={() => setBench({ id: l.id, label: `${l.openModel?.name ?? l.model} (${l.precision.toUpperCase()})`, kind: 'start' })}>{l.benchState === 'not_started' ? 'Start benchmarking' : 'Resume benchmarking'}</button>
                          )}
                          {/* M13 (M11 review SHOULD-2): where Start is not offered, say why. */}
                          {!(l.effective?.scheduler === 'yes' || l.effective?.scheduler === 'resume_probe_only') && l.state !== 'draft' && !['active', 'waiting_slot'].includes(l.benchState) && startUnavailableText(l.effective?.schedulerReason) && (
                            <span className="mp-muted">{startUnavailableText(l.effective?.schedulerReason)}</span>
                          )}
                          {MEASURING.has(l.benchState) && (
                            <button type="button" className="st-btn is-sm" onClick={() => setBench({ id: l.id, label: `${l.openModel?.name ?? l.model} (${l.precision.toUpperCase()})`, kind: 'stop' })}>Stop benchmarking</button>
                          )}
                          {/* F4: beside Start and Stop, the calibration's answer (owners and admins), or the withdrawal while it runs. */}
                          {d?.calibration?.[l.publicId]?.state === 'needs_answer' && (
                            <button type="button" className="st-btn is-sm is-primary" onClick={() => setBench({ id: l.id, label: `${l.openModel?.name ?? l.model} (${l.precision.toUpperCase()})`, kind: 'calibrate' })}>Review calibration</button>
                          )}
                          {d?.calibration?.[l.publicId]?.state === 'calibrating' && (
                            <button type="button" className="st-btn is-sm" onClick={() => setBench({ id: l.id, label: `${l.openModel?.name ?? l.model} (${l.precision.toUpperCase()})`, kind: 'withdraw' })}>Withdraw from calibration</button>
                          )}
                          <button type="button" className="st-btn is-sm" onClick={() => void readiness(l)} disabled={busy === l.id || running(run) || !l.endpoint}>
                            {running(run) ? 'Checking…' : l.readiness ? 'Run readiness again' : 'Run readiness check'}
                          </button>
                          <SubmitButton l={l} provider={s.provider} editable={editable} busy={busy === l.id} onSubmit={() => void submitListing(l)} />
                          <button type="button" className="st-btn is-sm" onClick={() => openEdit(l)}>Edit</button>
                          {l.state === 'draft' && <button type="button" className="st-btn is-sm is-quiet sw-bad-text" onClick={() => void remove(l)} disabled={busy === l.id}>Remove</button>}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </Pane>

            <Pane title="Tested models" sub="Models whose chat test passed on your endpoints" ruled flush>
              {probed.length === 0 ? (
                <div className="sw-pad"><p className="sw-quiet">{untested.length
                  ? `${untested.length} model${untested.length === 1 ? ' has' : 's have'} not passed a test yet. Open its endpoint's Models and test it.`
                  : <>Nothing to list yet. Add an <Link href="/account/provider/endpoints">endpoint</Link> and test its models.</>}</p></div>
              ) : probed.map(p => (
                <div className="mp-check is-plain" key={`${p.endpoint.id}|${p.model}`}>
                  <div className="mp-check-main">
                    <div className="mp-check-t"><span className="mp-lst-id">{p.model}</span></div>
                    <div className="mp-check-s">{p.endpoint.name}{p.contextTokens ? ` · ${fmt(p.contextTokens)} context` : ' · context not known yet'}{p.testedAt ? ` · tested ${day(p.testedAt)}` : ''}</div>
                    {p.refusal && <p className="mp-check-s mp-rd-bad">{p.refusal.message}</p>}
                  </div>
                  <div className="mp-check-end">
                    {editable && <button type="button" className="st-btn is-sm is-primary" onClick={() => openNew(p)} disabled={!!p.refusal || d.limits.used >= d.limits.max}>List this model</button>}
                  </div>
                </div>
              ))}
            </Pane>

            <Pane title="The readiness check" sub="Fixed prompts, never from a benchmark. It costs a few cents at your declared price." ruled>
              <ul className="sw-list">
                <li>Parameters: temperature 0.1, reasoning_effort &ldquo;high&rdquo; and max_tokens 64,000 with &ldquo;{d.readiness.prompts.parameters}&rdquo;.</li>
                <li>Output limit: the largest of 64,000, 32,768 and 16,384 that is accepted.</li>
                <li>Concurrency: 4 parallel &ldquo;{d.readiness.prompts.pong}&rdquo; requests, all answered within 60 s.</li>
                <li>Rate: 20 requests in 20 s without a 429. Streaming with usage, and whether GET /models refuses a wrong key.</li>
              </ul>
              <p className="sw-quiet">Only refused parameters with no fallback, and fewer than 4 requests at a time, block a submission. A low output limit or rate is shown on the model&rsquo;s page instead.</p>
              <p className="sw-quiet">Results are not published while the listing is a draft. You and our staff see them; once the listing is published, its output limit and any refused parameters appear on its page.</p>
            </Pane>

            {editable && (
              <Pane title="Request a model we don't have" sub="Open-source or closed. We add them to the registry by hand." ruled>
                <form className="sw-stack mp-lst-ask" onSubmit={ask}>
                  <label className="st-field"><span className="st-field-label">Model</span><input name="name" required maxLength={80} className="st-input" placeholder="e.g. Qwen3 235B A22B" /></label>
                  <label className="st-field"><span className="st-field-label">Who publishes the weights</span><input name="maker" required maxLength={60} className="st-input" placeholder="e.g. Qwen" /></label>
                  <label className="st-field"><span className="st-field-label">Weights URL <small>optional</small></span><input name="weightsUrl" type="url" maxLength={300} className="st-input" placeholder="https://huggingface.co/…" /></label>
                  <div className="st-actions"><button type="submit" className="st-btn" disabled={asking}>{asking ? 'Sending…' : 'Send request'}</button></div>
                </form>
              </Pane>
            )}
          </>
        )}
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.listingId ? 'Edit listing' : 'List this model'} sub={form ? <span className="mp-lst-id">{form.model}</span> : undefined}
        footer={<div className="st-actions"><button type="button" className="st-btn" onClick={() => setForm(null)}>Cancel</button><button type="submit" form="mp-lst-form" className="st-btn is-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></div>}>
        {form && d && (
          <form id="mp-lst-form" className="sw-stack" onSubmit={save} noValidate>
            {!editingDraft && <Note>After submission only the prices, regions, rate limits and model page change here.</Note>}
            <label className="st-field">
              <span className="st-field-label">Model</span>
              <select className="st-select" value={form.openModelId} disabled={!editingDraft} onChange={e => setForm({ ...form, openModelId: e.target.value })} aria-invalid={!!fields.openModelId}>
                <option value="">Choose…</option>
                {d.openModels.map(o => <option key={o.id} value={o.id}>{o.maker} · {o.name}</option>)}
              </select>
              <FieldError text={fields.openModelId} />
              {d.openModels.length === 0 && <span className="st-hint">The registry is empty: request the model below this form.</span>}
            </label>
            <div className="mp-lst-row">
              <label className="st-field">
                <span className="st-field-label">Precision served</span>
                <select className="st-select" value={form.precision} disabled={!editingDraft} onChange={e => setForm({ ...form, precision: e.target.value })}>
                  {d.precisions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <FieldError text={fields.precision} />
              </label>
              {form.precision === 'other' && (
                <label className="st-field">
                  <span className="st-field-label">Which precision</span>
                  <input className="st-input" value={form.precisionNote} maxLength={80} disabled={!editingDraft} onChange={e => setForm({ ...form, precisionNote: e.target.value })} />
                  <FieldError text={fields.precisionNote} />
                </label>
              )}
            </div>
            <div className="mp-lst-row">
              <label className="st-field">
                <span className="st-field-label">Context served <small>tokens</small></span>
                <input className="st-input" inputMode="numeric" value={form.contextTokens} disabled={!editingDraft} onChange={e => setForm({ ...form, contextTokens: e.target.value.replace(/[^0-9]/g, '') })} aria-invalid={!!fields.contextTokens} />
                <FieldError text={fields.contextTokens} />
              </label>
              <label className="st-field">
                <span className="st-field-label">Max output <small>tokens</small></span>
                <input className="st-input" inputMode="numeric" value={form.maxOutputTokens} disabled={!editingDraft} onChange={e => setForm({ ...form, maxOutputTokens: e.target.value.replace(/[^0-9]/g, '') })} aria-invalid={!!fields.maxOutputTokens} />
                <FieldError text={fields.maxOutputTokens} />
              </label>
            </div>
            <div className="mp-lst-row is-3">
              <label className="st-field">
                <span className="st-field-label">Input <small>USD per 1M</small></span>
                <input className="st-input" inputMode="decimal" value={form.priceIn} onChange={e => setForm({ ...form, priceIn: e.target.value })} aria-invalid={!!fields.priceIn} />
                <FieldError text={fields.priceIn} />
              </label>
              <label className="st-field">
                <span className="st-field-label">Output <small>USD per 1M</small></span>
                <input className="st-input" inputMode="decimal" value={form.priceOut} onChange={e => setForm({ ...form, priceOut: e.target.value })} aria-invalid={!!fields.priceOut} />
                <FieldError text={fields.priceOut} />
              </label>
              <label className="st-field">
                <span className="st-field-label">Cached input <small>optional</small></span>
                <input className="st-input" inputMode="decimal" value={form.priceCached} onChange={e => setForm({ ...form, priceCached: e.target.value })} aria-invalid={!!fields.priceCached} />
                <FieldError text={fields.priceCached} />
              </label>
            </div>
            <fieldset className="st-field mp-lst-regions">
              <legend className="st-field-label">Regions</legend>
              <div className="mp-lst-chips">
                {d.regions.map(r => {
                  const on = form.regions.includes(r);
                  return (
                    <label key={r} className={`st-chip${on ? ' is-on' : ''}`}>
                      <input type="checkbox" className="st-sr" checked={on} onChange={e => setForm({ ...form, regions: e.target.checked ? [...form.regions, r] : form.regions.filter(x => x !== r) })} />
                      {r}
                    </label>
                  );
                })}
              </div>
              <FieldError text={fields.regions} />
            </fieldset>
            <label className="st-field">
              <span className="st-field-label">Rate limits <small>{d.limits.rateLimitsText} characters</small></span>
              <input className="st-input" value={form.rateLimits} maxLength={d.limits.rateLimitsText} onChange={e => setForm({ ...form, rateLimits: e.target.value })} placeholder="e.g. 600 requests a minute per key" />
              <FieldError text={fields.rateLimits} />
            </label>
            <label className="st-field">
              <span className="st-field-label">Model page URL <small>on a verified domain, optional</small></span>
              <input className="st-input" type="url" value={form.modelUrl} maxLength={300} onChange={e => setForm({ ...form, modelUrl: e.target.value })} />
              <FieldError text={fields.modelUrl} />
            </label>
            {fields.endpointId && <Note tone="bad">{fields.endpointId}</Note>}
            {fields.model && <Note tone="bad">{fields.model}</Note>}
            {formError && <Note tone="bad" title="Not saved">{formError}</Note>}
          </form>
        )}
      </Modal>
      {bench && <StartBenchDialog listingId={bench.id} label={bench.label} open={bench.kind === 'start'} onClose={() => setBench(null)} onDone={t => { flash(t); void load(); }} />}
      {bench && <CalibrationDialog listingId={bench.id} open={bench.kind === 'calibrate'} onClose={() => setBench(null)} onDone={t => { flash(t); void load(); }} />}
      {bench && <WithdrawCalibrationDialog listingId={bench.id} label={bench.label} open={bench.kind === 'withdraw'} onClose={() => setBench(null)} onDone={t => { flash(t); void load(); }} />}
      {bench && <StopBenchDialog listingId={bench.id} label={bench.label} open={bench.kind === 'stop'} onClose={() => setBench(null)} onDone={t => { flash(t); void load(); }} />}
      {d && d.listings.length === 0 && probed.length === 0 && untested.length === 0 && !loadError && (
        <div className="st-body sw-body"><Empty title="Start with an endpoint">Add the API your models are served from on <Link href="/account/provider/endpoints">Endpoints</Link>, test its models, then list them here.</Empty></div>
      )}
    </>
  );
}
