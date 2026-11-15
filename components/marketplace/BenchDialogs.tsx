'use client';

/**
 * "Start benchmarking <Model (precision)>?" and "Stop benchmarking" (Phase 3 plan §2.13, §2.14; M6b), opened from a
 * listing row (Models, Benchmarks). The consent is recorded by the API with the estimate EXACTLY as shown here: the
 * dialog sends the figure it displays, and a changed estimate (prices moved meanwhile) comes back to be shown again.
 * M7: the spot-check sentence of §2.13 (spot checks exist from M7).
 * F4 (the single consent bump, start-v2): the API sends the dialog's variable sentences (`startText`): the spot-check
 * sentence only with a published spot month of this listing (OD-11: omit, never deny), and the calibration sentence in the
 * owner's reading (B); the dialog shows exactly those and sends back which it showed. "and stay published" is gone
 * (retractions exist). The calibration dialogs (phase4-plan revision 4 §R2.4): [Take part in calibration] shows the API's
 * exact text (its sha256 goes back with the consent), the sole-taker estimate and maximum, the cap with its floor; withdraw.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Modal, Note } from '@/components/studio';
import { mpApi } from '@/lib/provider-account';

export interface Estimate {
  perSuiteMonthUsd: { coding: number; reasoning: number; tooling: number; canary: number };
  perRunUsd: Record<string, number>; monthUsd: number; defaultCapUsd: number;
  price: { inPerMTok: number; outPerMTok: number };
}
export interface BenchSection {
  benchState: string; startAfter: string | null; profile: string; estimate: Estimate; capUsd: number; monthSpendUsd: number;
  waitlistPosition: number | null; sameSettings: string; nextRun: string | null; canStart: boolean; schedulerReason: string | null; canManage: boolean;
  measurement: import('@/lib/marketplace-public').PublishedScores;
  /** F5b (web review SHOULD-4): `fresh: true` on a day on fresh task versions. */
  daily: Array<{ day: string; suite: string; mean: number; runs: number; fresh?: true }>;
  runs: Array<{ day: string; suite: string | null; kind: string; counted: boolean; status: string; reasonClass: string; tokensIn: number; tokensOut: number; costUsd: number | null; durationSec: number | null;
    /** F3b: the task version the run used (null when the run never started, e.g. a readiness check or a run abandoned before it began). Older API builds send none: missing reads as null. */
    taskVersion?: { kind: 'standard' } | { kind: 'fresh'; version: number } | null;
    /** F4: a calibration run's line ("Calibration (coding) · not counted"); absent on a measurement run. */
    label?: string }>;
  /** M7: the ranking checklist's spot-check row (I1), from the published month only; and a review the provider was told about. */
  criteria?: Array<{ code: string; pass: boolean; value: string; threshold: string }>;
  review?: { status: string; summary: string; replied: boolean } | null;
  /** M9b (D-C7): a published spot month of this listing among the recent ones: only then does the section describe spot checks. Missing reads as false. */
  spotPractice?: boolean;
  /** F4 (start-v2): the Start dialog's variable sentences, as the API computes them; an older API sends none. */
  startText?: { consentVersion: string; spotSentence: string | null; calibrationSentence: string; reading: string };
  /** F4: the calibration section (an open invitation; the enrolment's counts and spend against its cap). */
  calibration?: CalibrationSection & { spend?: { campaign: string; spendUsd: number; capUsd: number | null; state: string } | null } | null;
}

/** F4 (revision 4 §R2.4): what the consent dialog shows, exactly as the API rendered it. */
export interface CalibrationQuote { campaign: string; kind: string; model: string; suites: string[]; runs: number; estimateUsd: number; maxUsd: number; minimumUsd: number;
  /** The cap the field starts at: the maximum shown, or the floor when that is higher (an older API sends none: the maximum). */
  defaultCapUsd?: number;
  standing: { runsPerMonth: number; probesPerMonth: number; usdPerMonth: number }; inviteUntil: string }
/** The cap the consent dialog starts at (exported for the render tests). */
export const startingCap = (q: CalibrationQuote) => q.defaultCapUsd ?? q.maxUsd;
/**
 * The cap field's hint (F4 re-verification N1 and N7): below the floor the smallest share could never complete; the sink
 * runs that share first and the rest while the cap allows (the share mail counts them); a floor above the most shown is
 * only the runs' set-asides, never a cost.
 */
export const capHint = (q: CalibrationQuote) => `${capFloor(q)} ${capNote(q)}`;
/** F5b (web review MINOR-7): the hint's two parts, the same words: the floor stays under the field, the rest reads above it. */
export const capFloor = (q: CalibrationQuote) => `At least ${usd2(q.minimumUsd)}.`;
export const capNote = (q: CalibrationQuote) => `Below that, even this listing's smallest share could not run to the end: each run sets aside up to its own run cap before it starts. The smallest share's runs go first; the rest of your share runs while your cap allows, and the email with your share says how many runs it covers at the per-run estimate.${q.minimumUsd > q.maxUsd ? ` This is above the ${usd2(q.maxUsd)} shown as the most only because of those set-asides: the cap limits what runs can set aside, and you pay only what the runs cost.` : ''} Separate from your monthly benchmarking cap: reaching it stops calibration, never measurement.`;
export interface CalibrationText { title: string; paragraphs: string[]; capLabel: string; checkbox: string; sha256: string }
export interface CalibrationSection {
  available: boolean;
  status: { state: string; text: string } | null;
  invitation: { campaign: string; kind: string; inviteUntil: string; declined: boolean; quote: CalibrationQuote; text: CalibrationText; measuring: boolean; flagOn: boolean } | null;
  enrolment: { campaign: string; state: string; campaignState: string; capUsd: number | null; estimateUsd: number | null; maxUsd: number | null; standingCheck: boolean;
    progress: { done: number; of: number; spendUsd: number; capUsd: number | null }; windowEnd: string | null; canWithdraw: boolean } | null;
  canManage?: boolean;
}

export const BENCH_STATE: Record<string, { label: string; tone?: 'good' | 'warn' | 'bad' }> = {
  not_started: { label: 'Not benchmarked' }, waiting_slot: { label: 'Waiting for a slot', tone: 'warn' }, active: { label: 'Benchmarking', tone: 'good' },
  paused_provider: { label: 'Stopped by you' }, paused_credit: { label: 'Paused: out of credit', tone: 'bad' }, paused_auth: { label: 'Paused: key refused', tone: 'bad' },
  paused_rate: { label: 'Paused: rate limited', tone: 'bad' }, paused_cap: { label: 'Paused: spending cap reached', tone: 'warn' },
  paused_unreachable: { label: 'Paused: endpoint down', tone: 'bad' }, paused_admin: { label: 'Paused by AI Stupid Level', tone: 'bad' },
  paused_detached: { label: 'Paused: endpoint removed', tone: 'bad' }, under_review: { label: 'Under review', tone: 'warn' }, quarantined: { label: 'Quarantined', tone: 'bad' },
  stopped: { label: 'Stopped' },
};
export const MEASURING = new Set(['active', 'waiting_slot', 'paused_credit', 'paused_auth', 'paused_rate', 'paused_cap', 'paused_unreachable']);
export const usd2 = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The Start dialog's words (start-v2): exported for the render tests. The spot-check sentence only when the API sends it (a
 * published spot month of this listing), the calibration sentence in the owner's reading (B); "and stay published" is gone.
 */
export function StartBenchText({ e, startText }: { e: Estimate; startText?: BenchSection['startText'] }) {
  return (
    <>
      <p>We test this model with our coding, reasoning and tool-use suites and an hourly probe, on our schedule: coding about every 4 hours, reasoning and tool use daily, the probe every hour. We choose the exact times and never announce them.</p>
      <p>Each run uses the API key on this endpoint, so your own provider account pays for the tokens: about <strong>{usd2(e.monthUsd)} a month</strong> at your declared prices (coding {usd2(e.perSuiteMonthUsd.coding)}, reasoning {usd2(e.perSuiteMonthUsd.reasoning)}, tool use {usd2(e.perSuiteMonthUsd.tooling)}, probe {usd2(e.perSuiteMonthUsd.canary)}).</p>
      <p>Results count from the first run, good or bad. We publish each day&apos;s mean score, rounded to a whole point, one to two days after the day ends, never single runs, and you see the same numbers at the same time. A run that fails because the key is refused or out of credit, or because the endpoint is down, never counts: measurement pauses until it works again.</p>
      {startText?.spotSentence && <p>{startText.spotSentence}</p>}
      {startText?.calibrationSentence && <p>{startText.calibrationSentence}</p>}
    </>
  );
}

export function StartBenchDialog({ listingId, label, open, onClose, onDone }: { listingId: number; label: string; open: boolean; onClose: () => void; onDone: (text: string) => void }) {
  const [sec, setSec] = useState<BenchSection | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cap, setCap] = useState('');
  const [when, setWhen] = useState<'asap' | 'date'>('asap');
  const [date, setDate] = useState('');
  const [same, setSame] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setSec(null); setErr(null); setSame(false); setWhen('asap'); setDate('');
    void mpApi<BenchSection>(`/models/${listingId}/bench`).then(r => {
      if (r.ok && r.data) { setSec(r.data); setCap(String(r.data.estimate.defaultCapUsd)); } else setErr(r.error ?? 'Not loaded');
    });
  }, [open, listingId]);
  const e = sec?.estimate;
  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!e) return;
    setBusy(true); setErr(null);
    const r = await mpApi<{ benchState: string; waitlistPosition: number | null }>(`/models/${listingId}/bench/start`, { method: 'POST', body: {
      shownMonthUsd: e.monthUsd, capUsd: Number(cap), start: when, ...(when === 'date' ? { date } : {}), sameSettings: same,
      // start-v2: the text version and whether the spot-check sentence was shown (the API refuses a dialog of other words).
      consentVersion: sec?.startText?.consentVersion, spotSentence: !!sec?.startText?.spotSentence,
    } });
    setBusy(false);
    if (r.ok && r.data) {
      onDone(r.data.benchState === 'waiting_slot' ? `Benchmarking starts when a measurement slot frees up (position ${r.data.waitlistPosition ?? '?'}).` : 'Benchmarking started. The first run of each suite falls inside the next 24 hours, at a time we draw.');
      onClose();
    } else if (r.code === 'estimate_changed') {
      const fresh = (r as unknown as { data?: { estimate?: Estimate } }).data?.estimate;
      if (fresh && sec) setSec({ ...sec, estimate: fresh });
      setErr(r.error ?? 'The estimate changed. Check the new figure and start again.');
    } else if (r.code === 'text_changed') {
      const t = (r as unknown as { data?: { startText?: BenchSection['startText'] } }).data?.startText;
      if (t && sec) setSec({ ...sec, startText: t });
      setErr(r.error ?? 'The wording of this dialog changed. Read it again and start again.');
    } else setErr(r.error ?? 'Not started');
  };
  const max = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const min = new Date().toISOString().slice(0, 10);
  return (
    <Modal open={open} onClose={onClose} title={`Start benchmarking ${label}?`}
      footer={<div className="st-actions"><button type="button" className="st-btn" onClick={onClose}>Cancel</button><button type="submit" form="mp-bench-start" className="st-btn is-primary" disabled={busy || !e || !same}>{busy ? 'Starting…' : 'Start benchmarking'}</button></div>}>
      {!sec && !err && <p className="sw-quiet">Loading the estimate…</p>}
      {err && <Note tone="bad">{err}</Note>}
      {e && (
        <form id="mp-bench-start" className="sw-stack mp-bench-form" onSubmit={submit}>
          <StartBenchText e={e} startText={sec?.startText} />
          <label className="st-field">
            <span className="st-field-label">Monthly spending cap <small>USD</small></span>
            <input className="st-input" inputMode="decimal" value={cap} onChange={ev => setCap(ev.target.value.replace(/[^0-9.]/g, ''))} />
            <span className="st-hint">Twice the estimate by default. Reaching it pauses measurement until the next month or a raised cap.</span>
          </label>
          <fieldset className="st-field">
            <legend className="st-field-label">Start</legend>
            <label className="st-toggle mp-agree"><input type="radio" className="st-check" name="when" checked={when === 'asap'} onChange={() => setWhen('asap')} /><span className="mp-agree-t">As soon as possible</span></label>
            <label className="st-toggle mp-agree"><input type="radio" className="st-check" name="when" checked={when === 'date'} onChange={() => setWhen('date')} /><span className="mp-agree-t">On a date</span></label>
            {when === 'date' && <input type="date" className="st-input mp-agree-date" aria-label="The start date" min={min} max={max} value={date} onChange={ev => setDate(ev.target.value)} required />}
          </fieldset>
          <label className="st-toggle mp-agree"><input type="checkbox" className="st-check" checked={same} onChange={ev => setSame(ev.target.checked)} /><span className="mp-agree-t">{sec?.sameSettings}</span></label>
        </form>
      )}
    </Modal>
  );
}

export function StopBenchDialog({ listingId, label, open, onClose, onDone }: { listingId: number; label: string; open: boolean; onClose: () => void; onDone: (text: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const stop = async () => {
    setBusy(true); setErr(null);
    const r = await mpApi(`/models/${listingId}/bench/stop`, { method: 'POST', body: {} });
    setBusy(false);
    if (r.ok) { onDone('Benchmarking stopped. Published scores stay; the page says "Measurement paused" from now on.'); onClose(); } else setErr(r.error ?? 'Not stopped');
  };
  return (
    <Modal open={open} onClose={onClose} title={`Stop benchmarking ${label}?`}
      footer={<div className="st-actions"><button type="button" className="st-btn" onClick={onClose}>Cancel</button><button type="button" className="st-btn is-primary" onClick={() => void stop()} disabled={busy}>{busy ? 'Stopping…' : 'Stop benchmarking'}</button></div>}>
      <p>No new run starts; a run already in progress finishes. Everything published so far stays published, and the page says &ldquo;Measurement paused&rdquo; from today. You can start again at any time.</p>
      {err && <Note tone="bad">{err}</Note>}
    </Modal>
  );
}

const dateOnly = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** The consent dialog's paragraphs exactly as the API rendered them (their sha256 goes back with the consent): exported for the render tests. */
export function CalibrationParagraphs({ text }: { text: CalibrationText }) {
  return <>{text.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</>;
}

/**
 * F4 (revision 4 §R2.4): "Take part in calibrating fresh task versions for <Model (precision)>?". The words are the API's,
 * shown exactly; the figures are the sole-taker estimate and maximum (a top-up: its own frozen share); the cap defaults to
 * the maximum and may not go below the floor (the listing's smallest share plus one run cap of set-aside; the sink runs
 * that share first: F4 re-verification N1 and N7). A changed figure or text comes back to be
 * shown again (409 estimate_changed), as Start's does. Owners and admins only (the API refuses others).
 */
export function CalibrationDialog({ listingId, open, onClose, onDone }: { listingId: number; open: boolean; onClose: () => void; onDone: (text: string) => void }) {
  const [sec, setSec] = useState<CalibrationSection | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cap, setCap] = useState('');
  const [same, setSame] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setSec(null); setErr(null); setSame(false);
    void mpApi<CalibrationSection>(`/models/${listingId}/calibration`).then(r => {
      if (r.ok && r.data) { setSec(r.data); if (r.data.invitation) setCap(String(startingCap(r.data.invitation.quote))); } else setErr(r.error ?? 'Not loaded');
    });
  }, [open, listingId]);
  const inv = sec?.invitation ?? null;
  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!inv) return;
    setBusy(true); setErr(null);
    const r = await mpApi<{ state: string }>(`/models/${listingId}/calibration/consent`, { method: 'POST', body: {
      campaign: inv.campaign, shownEstimateUsd: inv.quote.estimateUsd, shownMaxUsd: inv.quote.maxUsd, capUsd: Number(cap), sameSettings: same, textSha256: inv.text.sha256,
    } });
    setBusy(false);
    if (r.ok) { onDone('We recorded your consent. We tell you your share before the calibration runs start.'); onClose(); return; }
    if (r.code === 'estimate_changed') {
      const d = (r as unknown as { data?: { quote?: CalibrationQuote; text?: CalibrationText } }).data;
      if (d?.quote && d.text && sec && inv) { setSec({ ...sec, invitation: { ...inv, quote: { ...inv.quote, ...d.quote }, text: d.text } }); setCap(String(startingCap(d.quote))); }
    }
    setErr(r.error ?? 'Not recorded');
  };
  const decline = async () => {
    setBusy(true); setErr(null);
    const r = await mpApi(`/models/${listingId}/calibration/decline`, { method: 'POST', body: {} });
    setBusy(false);
    if (r.ok) { onDone('You declined this calibration. The listing stays on the standard tasks.'); onClose(); } else setErr(r.error ?? 'Not recorded');
  };
  const t = inv?.text;
  return (
    <Modal open={open} onClose={onClose} title={t?.title ?? 'Calibration of fresh task versions'}
      footer={<div className="st-actions"><button type="button" className="st-btn" onClick={onClose}>Not now</button><button type="submit" form="mp-cal-consent" className="st-btn is-primary" disabled={busy || !inv || !same}>{busy ? 'Recording…' : 'Take part in calibration'}</button></div>}>
      {!sec && !err && <p className="sw-quiet">Loading the calibration…</p>}
      {err && <Note tone="bad">{err}</Note>}
      {sec && !inv && <p>There is no open calibration for this listing.</p>}
      {inv && t && (
        <form id="mp-cal-consent" className="sw-stack mp-bench-form" onSubmit={submit}>
          <CalibrationParagraphs text={t} />
          <p className="sw-quiet">Answer by {dateOnly(inv.inviteUntil)}.</p>
          <p className="sw-quiet mp-cap-note">{capNote(inv.quote)}</p>
          <label className="st-field">
            <span className="st-field-label">{t.capLabel} <small>USD</small></span>
            <input className="st-input" inputMode="decimal" value={cap} onChange={ev => setCap(ev.target.value.replace(/[^0-9.]/g, ''))} />
            <span className="st-hint">{capFloor(inv.quote)}</span>
          </label>
          <label className="st-toggle mp-agree"><input type="checkbox" className="st-check" checked={same} onChange={ev => setSame(ev.target.checked)} /><span className="mp-agree-t">{t.checkbox}</span></label>
          {!inv.declined && <p className="sw-quiet">Not taking part? <button type="button" className="st-btn is-sm is-quiet" onClick={() => void decline()} disabled={busy}>Decline this calibration</button></p>}
        </form>
      )}
    </Modal>
  );
}

/** F4 (revision 4 §R2.4 "Revocable"): withdraw from a calibration. No further calibration run starts; a run in progress finishes. */
export function WithdrawCalibrationDialog({ listingId, label, open, onClose, onDone }: { listingId: number; label: string; open: boolean; onClose: () => void; onDone: (text: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setErr(null);
    const r = await mpApi(`/models/${listingId}/calibration/withdraw`, { method: 'POST', body: {} });
    setBusy(false);
    if (r.ok) { onDone('You withdrew from the calibration. No further calibration run starts.'); onClose(); } else setErr(r.error ?? 'Not withdrawn');
  };
  return (
    <Modal open={open} onClose={onClose} title={`Withdraw ${label} from its calibration?`}
      footer={<div className="st-actions"><button type="button" className="st-btn" onClick={onClose}>Cancel</button><button type="button" className="st-btn is-primary" onClick={() => void go()} disabled={busy}>{busy ? 'Withdrawing…' : 'Withdraw'}</button></div>}>
      <p>No further calibration run starts; a run in progress finishes. The runs already completed still count. Your benchmarking is not affected.</p>
      {err && <Note tone="bad">{err}</Note>}
    </Modal>
  );
}
