'use client';

/**
 * Benchmarks (Phase 3 plan §2.15 "Benchmarks"; M6b): per listing, the run history (UTC day, suite, counted or not with
 * the reason, tokens, cost at the declared price, duration; never a score per run and never a time of day), the
 * published daily means and the suite means ± SE exactly as the public sees them (24-48 h after the day), the
 * estimate, the cap and the month's spend, and a CSV of the same fields. No per-task results, no axes, task coverage
 * only as counts. Start and Stop are the same dialogs as on Models.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Pane, Loader, Note, Pill, Empty } from '@/components/studio';
import { ProviderHead, canEdit, useProviderSummary } from '@/components/marketplace/ProviderBits';
import MeasuredScores from '@/components/marketplace/MeasuredScores';
import { StartBenchDialog, StopBenchDialog, BENCH_STATE, MEASURING, usd2, type BenchSection } from '@/components/marketplace/BenchDialogs';
import { mpApi, chosenProvider, type ProviderSummary } from '@/lib/provider-account';
import { ConsoleSpotChecks } from '@/components/marketplace/SpotCopy';
import '@/styles/studio-provider-models.css';

interface ListingLite { id: number; publicId: string; model: string; precision: string; openModel: { name: string } | null; state: string; benchState: string }

const REASON: Record<string, string> = {
  counted: 'Counted', key_refused: 'Not counted: key refused', out_of_credit: 'Not counted: out of credit', rate_limited: 'Not counted: rate limited',
  cap_reached: 'Not counted: monthly cap reached', run_cap_reached: 'Not counted: stopped at the per-run cap', endpoint_down: 'Not counted: endpoint down',
  interrupted_by_us: 'Not counted: interrupted by us', not_counted: 'Not counted',
  // F4: a calibration run (never published, never counted).
  calibration: 'Not counted: calibration',
};
const SUITE: Record<string, string> = { coding: 'Coding', reasoning: 'Reasoning', tooling: 'Tool use', canary: 'Hourly probe', readiness: 'Readiness check', resume_probe: 'Resume check' };
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * M7: a review the provider was told about (any kind, after a person's Hold; Phase 3 plan §6.7, §10.7): the
 * account-free summary, and one reply (owner and admins), which the person deciding the case reads.
 */
function ReviewBox({ listingId, review, editable, onDone }: { listingId: number; review: NonNullable<BenchSection['review']>; editable: boolean; onDone: (t: string) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    setBusy(true); setErr(null);
    const r = await mpApi(`/models/${listingId}/integrity/contest`, { method: 'POST', body: { text } });
    setBusy(false);
    if (r.ok) { setText(''); onDone('Your reply was sent. A person reads it before deciding.'); } else setErr(r.error);
  };
  return (
    <Note tone="warn" title="Under review">
      <p>{review.summary}</p>
      <p className="sw-quiet">Measurement is on hold while a person reviews this; published scores stay. You will receive the decision with its reasons.</p>
      {review.replied && <p className="sw-quiet">We have your reply.</p>}
      {editable && (
        <div className="sw-stack">
          <label className="st-field">
            <span className="st-field-label">Your reply</span>
            <textarea className="st-textarea" rows={4} maxLength={4000} value={text} onChange={e => setText(e.target.value)} />
          </label>
          {err && <p className="st-field-error">{err}</p>}
          <div className="mp-bench-reply"><button type="button" className="st-btn is-sm" disabled={busy || text.trim().length < 20} onClick={() => void send()}>{busy ? 'Sending…' : 'Send your reply'}</button></div>
        </div>
      )}
    </Note>
  );
}

/**
 * The run history table (M6b), at most 100 rows. F3b: the task version each run used, "standard" or "fresh (vN)", and
 * "—" for a run that never started (or from an API that does not send it). Exported for tests/f3b.
 */
export function RunHistory({ runs }: { runs: BenchSection['runs'] }) {
  if (runs.length === 0) return <p className="sw-quiet">No run yet.</p>;
  return (
    <div className="mp-table-wrap">
      <table className="mp-table">
        <thead><tr><th scope="col">Day (UTC)</th><th scope="col">Suite</th><th scope="col">Task version</th><th scope="col">Result</th><th scope="col">Tokens in / out</th><th scope="col">Cost</th><th scope="col">Duration</th></tr></thead>
        <tbody>{runs.slice(0, 100).map((r, i) => (
          <tr key={i}>
            <td data-label="Day">{day(r.day)}</td>
            <td data-label="Suite">{r.label ?? SUITE[r.suite ?? ''] ?? r.suite}</td>
            <td data-label="Task version">{r.taskVersion?.kind === 'fresh' ? `fresh (v${r.taskVersion.version})` : r.taskVersion?.kind === 'standard' ? 'standard' : '—'}</td>
            <td data-label="Result">{REASON[r.reasonClass] ?? r.reasonClass}</td>
            <td data-label="Tokens">{r.tokensIn.toLocaleString('en')} / {r.tokensOut.toLocaleString('en')}</td>
            <td data-label="Cost">{r.costUsd === null ? '—' : `$${r.costUsd.toFixed(4)}`}</td>
            <td data-label="Duration">{r.durationSec === null ? '—' : r.durationSec >= 120 ? `${Math.round(r.durationSec / 60)} min` : `${r.durationSec} s`}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function ListingBench({ l, editable, onFlash }: { l: ListingLite; editable: boolean; onFlash: (t: string) => void }) {
  const [sec, setSec] = useState<BenchSection | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dlg, setDlg] = useState<'start' | 'stop' | null>(null);
  const load = useCallback(async () => {
    const r = await mpApi<BenchSection>(`/models/${l.id}/bench`);
    if (r.ok && r.data) { setSec(r.data); setErr(null); } else setErr(r.error);
  }, [l.id]);
  useEffect(() => { void load(); }, [load]);
  const label = `${l.openModel?.name ?? l.model} (${l.precision.toUpperCase()})`;
  const st = BENCH_STATE[sec?.benchState ?? l.benchState] ?? { label: l.benchState };
  const pick = chosenProvider();
  const csv = `/api/account/provider/models/${l.id}/bench/runs.csv${pick ? `?provider=${pick}` : ''}`;
  return (
    <Pane title={label} sub={st.label} ruled>
      {err && <Note tone="bad">{err}</Note>}
      {!sec && !err && <Loader label="Loading" />}
      {sec && (
        <div className="sw-stack">
          <div className="mp-bench-head">
            <Pill tone={st.tone}>{st.label}</Pill>
            {sec.waitlistPosition !== null && <span className="sw-quiet">Starts when a measurement slot frees up (position {sec.waitlistPosition}).</span>}
            {sec.nextRun && <span className="sw-quiet">Next run: {sec.nextRun}.</span>}
            {editable && sec.canManage && sec.canStart && !['active', 'waiting_slot'].includes(sec.benchState) && (
              <button type="button" className="st-btn is-sm is-primary" onClick={() => setDlg('start')}>{sec.benchState === 'not_started' ? 'Start benchmarking' : 'Resume benchmarking'}</button>
            )}
            {editable && sec.canManage && MEASURING.has(sec.benchState) && <button type="button" className="st-btn is-sm" onClick={() => setDlg('stop')}>Stop benchmarking</button>}
          </div>
          <dl className="st-kv">
            <div><dt>Estimate</dt><dd>about {usd2(sec.estimate.monthUsd)} a month at your declared prices</dd></div>
            <div><dt>Monthly spending cap</dt><dd>{usd2(sec.capUsd)}</dd></div>
            <div><dt>Spent this month</dt><dd>{usd2(sec.monthSpendUsd)} at your declared prices</dd></div>
            {/* F4 (revision 4 §R2.6): the calibration's spend against its own cap (separate from the monthly cap). */}
            {sec.calibration?.spend && (
              <div><dt>Calibration</dt><dd>{usd2(sec.calibration.spend.spendUsd)} spent{sec.calibration.spend.capUsd !== null ? ` of its ${usd2(sec.calibration.spend.capUsd)} cap` : ''}, at your declared prices{sec.calibration.spend.state === 'withdrawn' ? ' (withdrawn)' : ''}</dd></div>
            )}
          </dl>
          {sec.review && <ReviewBox listingId={l.id} review={sec.review} editable={editable && sec.canManage} onDone={t => { onFlash(t); void load(); }} />}
          {sec.measurement.publishedDays > 0
            ? <MeasuredScores scores={sec.measurement} daily={sec.daily} />
            : <p className="sw-quiet">No published day yet. Each day&apos;s mean appears here and on your public page at the same time, one to two days after the day ends.</p>}
          {sec.daily.length > 0 && (
            <div className="mp-table-wrap">
              <table className="mp-table">
                {/* F5b (web review SHOULD-4): once a day of the list is on fresh task versions, each row says which tasks it is on. */}
                <thead><tr><th scope="col">Day (UTC)</th><th scope="col">Suite</th><th scope="col">Mean</th><th scope="col">Runs</th>{sec.daily.slice(0, 60).some(d => d.fresh) && <th scope="col">Tasks</th>}</tr></thead>
                <tbody>{sec.daily.slice(0, 60).map(d => <tr key={`${d.day}|${d.suite}`}><td data-label="Day">{day(d.day)}</td><td data-label="Suite">{d.suite === 'combined' ? 'Combined' : SUITE[d.suite] ?? d.suite}</td><td data-label="Mean">{d.mean}</td><td data-label="Runs">{d.runs}</td>{sec.daily.slice(0, 60).some(x => x.fresh) && <td data-label="Tasks">{d.fresh ? 'fresh task versions' : 'standard tasks'}</td>}</tr>)}</tbody>
              </table>
            </div>
          )}
          {/* M9b (D-C7): the spot-check practice only with a published month of this listing; otherwise left out. */}
          <ConsoleSpotChecks spotPractice={sec.spotPractice} spotChecks={sec.measurement.spotChecks} />
          {sec.criteria && sec.criteria.length > 0 && (
            <div className="mp-table-wrap">
              <table className="mp-table">
                <thead><tr><th scope="col">Ranking criterion</th><th scope="col">Value</th><th scope="col">Threshold</th><th scope="col">Met</th></tr></thead>
                <tbody>{sec.criteria.map(cr => (
                  <tr key={cr.code}><td data-label="Criterion">{cr.code}</td><td data-label="Value">{cr.value}</td><td data-label="Threshold">{cr.threshold}</td><td data-label="Met">{cr.pass ? 'Yes' : 'No'}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <h3 className="mp-bench-sub">Run history</h3>
          <RunHistory runs={sec.runs} />
          <p className="sw-quiet"><a href={csv}>Download the run history (CSV)</a> · No per-task results, no scores per run and no times of day: a prompt seen in your logs next to its verdict would be an answer key.</p>
        </div>
      )}
      <StartBenchDialog listingId={l.id} label={label} open={dlg === 'start'} onClose={() => setDlg(null)} onDone={t => { onFlash(t); void load(); }} />
      <StopBenchDialog listingId={l.id} label={label} open={dlg === 'stop'} onClose={() => setDlg(null)} onDone={t => { onFlash(t); void load(); }} />
    </Pane>
  );
}

export default function BenchmarksClient({ initial }: { initial: ProviderSummary }) {
  const { status } = useSession();
  const [s] = useProviderSummary(initial);
  const [listings, setListings] = useState<ListingLite[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (status !== 'authenticated') return;
    void mpApi<{ listings: ListingLite[] }>('/models').then(r => { if (r.ok && r.data) setListings(r.data.listings); else setErr(r.error); });
  }, [status]);
  const editable = canEdit(s);
  if (status === 'loading') return <div data-page-loading><Loader label="Loading your benchmarks" minHeight={420} /></div>;
  const shown = (listings ?? []).filter(l => l.state !== 'draft' || l.benchState !== 'not_started');
  return (
    <>
      <ProviderHead summary={s} title="Benchmarks" lead="What we measured on each listing, published one to two days after each day ends, exactly as the public sees it." />
      <div className="st-body sw-body">
        {msg && <div role="status" className="st-note sw-flash"><div>{msg}</div></div>}
        {err && <Note tone="bad" title="Not loaded">{err}</Note>}
        {!listings && !err && <Loader label="Loading your listings" />}
        {listings && shown.length === 0 && <Empty title="Nothing benchmarked yet">Start benchmarking a published listing on <Link href="/account/provider/models">Models</Link>.</Empty>}
        {shown.map(l => <ListingBench key={l.id} l={l} editable={editable} onFlash={t => { setMsg(t); window.setTimeout(() => setMsg(null), 9000); }} />)}
      </div>
    </>
  );
}
