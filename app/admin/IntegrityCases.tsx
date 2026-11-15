'use client';

/**
 * The Providers tab's integrity and spot-check views (Phase 3 plan §10.2, §10.6, §10.7; M7; M9b).
 *
 * Integrity cases (M9b, design-features §2.3, §2.4: "we decide manually"): every case, open first, with its
 * account-free summary, a "held" pill and its owner-email line. Nothing happens to a listing because of a case until a
 * person decides:
 * [Hold measurement] (an admin pause with the kind's ground and a "no finding has been made" statement, which tells the
 * provider and opens its reply box), [Dismiss with reason] (a held case's pause is reversed) or [Confirm] (suspend or
 * terminate, a retraction only when chosen, the kind's ground; a provider never told needs a hold first or a recorded
 * reason). The API refuses any text that reaches the provider and names the spot account (a hold's reason, a held
 * case's dismissal reason, Confirm's facts); Hold needs a published listing. A case opens from /admin?case=<id>#providers (the
 * owner's mail links there; the tab stays hash-driven, AdminDashboard.tsx). While case emails cannot reach the owner
 * (no address, mail off, a bounced test, the health unit silent), a note heads the pane.
 *
 * Spot checks: the keys, status only (provider, hint, procured, rotation due, burned), and each listing's checks this
 * month. Adding, rotating and burning keys, and the amounts a spot account was billed, happen only in
 * admin/spotcheck-keys.js on the server (stdin): a key never passes through the web app or its logs.
 *
 * F6: the integrity kinds on fresh task versions are listed and decided here like every other kind; F6c: each case comes
 * with its kind's words from the API (`kindLabel`), shown as given (the raw kind from an API without them). F6b (F6r
 * re-check web SHOULD-1): under the cases, "Notes to decide": the notes on the standard tasks a person marks decided (the
 * API's `notes`: a check that compared nothing, naming the listings and the models to measure again), each with "Mark decided" and a
 * recorded reason; with none, the Calibration pane's "Nothing waits for a person." in a ruled row, as "No integrity cases."
 * is above it. Both panes follow the Smart Router dashboard's studio look, as
 * F5's Calibration pane beside them: ruled rows inside the pane body's padding, what a row is on the left with a faint
 * second line, its pills and its action (a small studio button) on the right, under the text on a phone; the same Pane
 * props while loading and after (a revealed pane keeps its class).
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Loader, Modal, Note, Pane, Pill } from '@/components/studio';
import { fullDate } from './format';

/* eslint-disable @typescript-eslint/no-explicit-any */
async function call(path: string, method: 'GET' | 'POST', body?: unknown): Promise<{ ok: boolean; data: any; message: string | null; status: number }> {
  try {
    const r = await fetch(`/api/admin/marketplace/${path}`, {
      method, cache: 'no-store', ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) } : {}),
    });
    const j = await r.json().catch(() => null);
    return { ok: r.ok && !!j?.success, data: j?.data ?? null, message: j?.message || (r.ok ? null : j?.error || `The API answered ${r.status}.`), status: r.status };
  } catch {
    return { ok: false, data: null, message: 'Could not reach the server.', status: 0 };
  }
}

export interface CaseRules { defaultGround: string | null; grounds: string[]; automatedDetection: boolean; retractDefault: 'last_consistent' | 'none' }
export interface CaseEmail { status: string; at: string | null; summary: boolean }
/** The health unit's owner-mail state, as the API reads it from its state file: never the address. */
export interface StaffMail { reported: boolean; addressSet: boolean; mailEnabled: boolean; test: { status: string | null; at: string | null }; fingerprint: string | null; problem: string | null }
export interface Case {
  /** F6c: `kindLabel`, the kind in the staff pane's words (the API's). */
  id: number; kind: string; kindLabel?: string | null; severity: string; status: string; openedAt: string; notifiedAt?: string | null; resolvedAt: string | null; reasonText: string | null; actionId: number | null;
  /** M9b: staff hold its listing's measurement; Hold is open now; the provider was told (a hold). */
  held?: boolean; holdable?: boolean; heard?: boolean; rules?: CaseRules; email?: CaseEmail;
  listing: { publicId: string; entrySlug: string; model: string; precision?: string; state: string; benchState: string } | null;
  provider: { name: string; publicId: string | null; internal: boolean };
  summary: string;
}
export interface CaseDetail extends Case {
  evidence: unknown; contests: Array<{ at: string; text: string }>; history: Array<{ at: string; actor: string; action: string; detail: string | null }>;
  checks: Array<{ id: number; test: string; suite: string; result: string; spot_score: number | null; statistic: number | null; threshold: number | null; p: number | null; day: string; kind: string }>;
  lastConsistentDay: string | null; retractDefaultDay?: string | null; firstScoreDay?: string | null;
}
export type Decision = 'hold' | 'dismiss' | 'confirm';

/** F6c: a case's kind in words: the API's `kindLabel`, else the kind it sent. */
const kindText = (c: { kind: string; kindLabel?: string | null }) => (typeof c.kindLabel === 'string' && c.kindLabel ? c.kindLabel : c.kind);
/** Annex B's grounds, as the API names them (marketplace/moderation.ts GROUNDS). */
const GROUND: Record<string, string> = {
  G1: 'Identity or domain verification failed or lapsed', G2: 'Impersonation or infringement', G3: 'Misleading listing data', G4: 'Measurement manipulation',
  G5: 'Breach of test confidentiality', G6: 'Security risk to users', G7: 'Illegal content or sanctions', G8: 'Unavailability or exhausted credit', G9: 'Changed terms not accepted',
  G10: 'Offer not honoured', G11: 'Abuse of AI Stupid Level services', G12: 'Inactive for 90 days', G13: 'Required by law or by an authority',
};
const TEST: Record<string, string> = { trend_rule: 'single check', latency: 'speed', welch: 'probe test', power_welch: '30-day power test', price: 'price' };
const HISTORY: Record<string, string> = {
  'integrity.opened': 'opened', 'integrity.held': 'measurement held', 'integrity.dismissed': 'dismissed', 'integrity.confirmed': 'confirmed', 'integrity.contest': 'the provider replied',
  'staff.case_mailed': 'mailed to the owner', 'staff.case_journal_only': 'no owner address: in the journal only', 'staff.reply_mailed': 'the reply mailed to the owner', 'staff.reply_journal_only': 'no owner address: the reply in the journal only',
};
const tone = (s: string): 'warn' | 'bad' | 'good' | undefined => (s === 'open' || s === 'contested' ? 'warn' : s === 'confirmed' ? 'bad' : s === 'dismissed' ? 'good' : undefined);
const n1 = (x: number | null | undefined) => (typeof x === 'number' ? (Math.round(x * 10) / 10).toString() : '—');
const today = () => new Date().toISOString().slice(0, 10);

const EMAIL: Record<string, string> = {
  sent: 'sent', delivered: 'delivered', deferred: 'deferred', bounced: 'bounced', failed: 'failed, tried again shortly', sending: 'sending',
  waiting_mail_off: 'waiting — mail is off', no_address: 'not sent — no owner address', queued: 'queued, goes within a minute', not_sent: 'not sent', unknown: 'not known — the health unit has not reported',
};
/** A case's email line: "Email: delivered" (and "in the hour's summary" when the summary mail covered it). */
export function emailText(e?: CaseEmail | null): string | null {
  if (!e) return null;
  return `Email: ${EMAIL[e.status] ?? e.status}${e.summary ? ' (in the hour’s summary)' : ''}`;
}

/** The pane's head note while case emails cannot reach the owner. */
export function MailNote({ mail }: { mail: StaffMail | null | undefined }) {
  if (!mail || !mail.problem) return null;
  return <Note tone="warn">Case emails are not reaching you: {mail.problem}. Cases still appear here and in the daily queue.</Note>;
}

/** F6b: a note on the standard tasks that a person marks decided (GET integrity's `notes`; decided via calibration/items/<id>). */
export interface IntegrityNote { id: number; target: string; at: string; detail: string; listings: Array<{ listing: string; model: string }> }

/**
 * F6b: the notes to decide, under the cases, each with its date and "Mark decided"; the heading as the Calibration pane's
 * sections have it, and with no note its faint empty row. F6c (F6b web review MINOR-2): "No note to decide.", as "No
 * integrity cases." above it (under open cases "Nothing waits for a person." said the opposite of the list above). The
 * heading takes the focus after a decision (MINOR-4: the row and its button leave the list).
 */
export const NOTES_HEADING_ID = 'mp-case-notes-h';
export function NoteList({ notes, onDecide }: { notes: IntegrityNote[]; onDecide: (n: IntegrityNote) => void }) {
  return (
    <>
      <p className="st-label mp-admin-h" id={NOTES_HEADING_ID} tabIndex={-1}>Notes to decide</p>
      <ul className="mp-cal-list mp-case-notes">
        {notes.length === 0 && <li className="mp-cal-row"><span className="mp-cal-main st-faint">No note to decide.</span></li>}
        {notes.map(n => (
          <li key={n.id} className="mp-cal-row">
            <span className="mp-cal-main">{n.detail}<span className="mp-cal-sub st-faint">{fullDate(n.at)}</span></span>
            <span className="mp-cal-acts"><button type="button" className="st-btn is-sm" onClick={() => onDecide(n)}>Mark decided</button></span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The list: open first, each with its summary, its pills and its email line (a ruled row, its Open button on the right). */
export function CaseList({ rows, onOpen }: { rows: Case[]; onOpen: (id: number) => void }) {
  return (
    <ul className="mp-cal-list mp-case-list">
      {rows.length === 0 && <li className="mp-cal-row"><span className="mp-cal-main st-faint">No integrity cases.</span></li>}
      {rows.map(c => (
        <li key={c.id} className="mp-cal-row">
          <span className="mp-cal-main">
            <span className="mp-case-title">#{c.id} {kindText(c)}</span>
            {' · '}{c.provider.name}{c.provider.internal ? ' (internal)' : ''}{c.listing ? ` · ${c.listing.model}` : ''}
            <span className="mp-cal-sub st-faint">{c.summary}</span>
            {emailText(c.email) && <span className="mp-cal-sub st-faint">{emailText(c.email)}</span>}
          </span>
          <span className="mp-cal-acts">
            <span className="mp-case-pills"><Pill tone={tone(c.status)}>{c.status}</Pill>{c.held && <> <Pill tone="warn">held</Pill></>}<span className="st-faint"> · {fullDate(c.openedAt)}</span></span>
            <button type="button" className="st-btn is-sm" onClick={() => onOpen(c.id)}>Open</button>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Confirm's retraction as chosen: none, or from a UTC day (the kind's default preselected). */
function defaultRetraction(c: CaseDetail): string | null {
  return c.rules?.retractDefault === 'last_consistent' && c.retractDefaultDay ? c.retractDefaultDay : null;
}

/**
 * F6's fix round (F6 code review SHOULD-2): how old the fleet baseline of a case compared with our own runs of the model
 * was when the case opened (its tasks' newest and oldest of those runs, in days), from the evidence; null for any other
 * case.
 */
export function baselineAge(e: unknown): { newest: number; oldest: number; max: number | null } | null {
  const ev = e && typeof e === 'object' && !Array.isArray(e) ? (e as { tasks?: unknown; maxAgeDays?: unknown }) : null;
  const tasks = ev && Array.isArray(ev.tasks) ? (ev.tasks as Array<{ twinNewestAgeDays?: unknown; twinOldestAgeDays?: unknown } | null>) : [];
  const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
  const newest = tasks.map(t => t?.twinNewestAgeDays).filter(num); const oldest = tasks.map(t => t?.twinOldestAgeDays).filter(num);
  if (!newest.length) return null;
  return { newest: Math.min(...newest), oldest: oldest.length ? Math.max(...oldest) : Math.max(...newest), max: ev && num(ev.maxAgeDays) ? ev.maxAgeDays : null };
}

/** One case: its evidence, replies, checks and history, and while it is open the three decisions. */
export function CaseView({ c, busy, onDecide }: { c: CaseDetail; busy: boolean; onDecide: (decision: Decision, body: Record<string, unknown>) => void }) {
  const def = defaultRetraction(c);
  const [retractMode, setRetractMode] = useState<'none' | 'from'>(def ? 'from' : 'none');
  const [retractFrom, setRetractFrom] = useState<string>(def ?? c.firstScoreDay ?? today());
  const rules = c.rules ?? { defaultGround: 'G4', grounds: ['G4'], automatedDetection: true, retractDefault: 'none' as const };
  const open = c.status === 'open' || c.status === 'contested';
  const heard = c.heard ?? !!c.notifiedAt;
  const age = baselineAge(c.evidence);
  const groundSelect = (
    <label className="st-field"><span className="st-field-label">Ground (Annex B)</span>
      <select className="st-input" name="ground" defaultValue={rules.defaultGround ?? ''} required>
        {!rules.defaultGround && <option value="">Choose a ground</option>}
        {rules.grounds.map(g => <option key={g} value={g}>{g} · {GROUND[g] ?? g}</option>)}
      </select></label>
  );
  const submit = (decision: Decision) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => { const v = f.get(k); return typeof v === 'string' && v.trim() ? v.trim() : undefined; };
    const body: Record<string, unknown> = { facts: text('facts') ?? '' };
    if (decision !== 'dismiss' && text('ground')) body.ground = text('ground');
    if (decision === 'confirm') {
      body.measure = text('measure'); body.scope = text('scope');
      body.retract = retractMode === 'none' ? 'none' : { from: retractFrom };
      if (!heard) body.withoutHearing = text('withoutHearing') ?? '';
    }
    onDecide(decision, body);
  };
  return (
    <div className="mp-admin-detail">
      <p>{c.summary}</p>
      <dl className="st-kv is-tight">
        <div><dt>Opened</dt><dd>{fullDate(c.openedAt)}</dd></div>
        <div><dt>Listing</dt><dd>{c.listing ? `${c.listing.state}, measurement ${c.listing.benchState.replace(/_/g, ' ')}` : '—'}</dd></div>
        <div><dt>The provider</dt><dd>{heard ? `told${c.notifiedAt ? ` (${fullDate(c.notifiedAt)})` : ''}${c.held ? ': measurement held' : ''}` : 'not told: nothing has happened to the listing because of this case'}</dd></div>
        <div><dt>Email</dt><dd>{emailText(c.email)?.replace(/^Email: /, '') ?? '—'}</dd></div>
        <div><dt>Last consistent check</dt><dd>{c.lastConsistentDay ?? 'none'}{rules.retractDefault === 'last_consistent' ? ` (Confirm retracts ${def ? `from ${def}` : 'nothing'} unless you choose otherwise)` : ' (Confirm retracts nothing unless you choose a day)'}</dd></div>
        {c.reasonText && <div><dt>Decision note</dt><dd>{c.reasonText}</dd></div>}
        {age && <div><dt>Fleet baseline</dt><dd>{`the same model's runs on our own account, ${age.newest === age.oldest ? `${age.newest}` : `${age.newest} to ${age.oldest}`} days old when the case opened${age.max !== null ? ` (compared only while the newest is at most ${age.max} days old)` : ''}`}</dd></div>}
      </dl>
      <p className="st-label mp-admin-h">Evidence</p>
      <pre className="mp-admin-pre">{JSON.stringify(c.evidence, null, 2)}</pre>
      <p className="st-label mp-admin-h">The provider&apos;s replies</p>
      <ul className="mp-cal-list">
        {c.contests.length === 0 && <li className="mp-cal-row"><span className="mp-cal-main st-faint">None.</span></li>}
        {c.contests.map((x, i) => <li key={i} className="mp-cal-row"><span className="mp-cal-main">{x.text}</span><span className="mp-cal-acts st-faint">{fullDate(x.at)}</span></li>)}
      </ul>
      <p className="st-label mp-admin-h">The listing&apos;s spot checks (staff only)</p>
      <ul className="mp-cal-list">
        {c.checks.length === 0 && <li className="mp-cal-row"><span className="mp-cal-main st-faint">None.</span></li>}
        {c.checks.map(x => (
          <li key={x.id} className="mp-cal-row"><span className="mp-cal-main">{x.day} · {TEST[x.test] ?? x.test} ({x.suite}{x.kind === 'confirmation' ? ', confirmation' : ''}): spot {n1(x.spot_score)}, statistic {n1(x.statistic)}, threshold {n1(x.threshold)}{x.p !== null ? `, p ${x.p.toFixed(4)}` : ''}</span><span className="mp-cal-acts st-faint">{x.result}</span></li>
        ))}
      </ul>
      <p className="st-label mp-admin-h">History</p>
      <ul className="mp-cal-list">
        {c.history.map((h, i) => <li key={i} className="mp-cal-row"><span className="mp-cal-main">{HISTORY[h.action] ?? h.action.replace(/^integrity\./, '').replace(/_/g, ' ')}</span><span className="mp-cal-acts st-faint">{h.actor} · {fullDate(h.at)}</span></li>)}
      </ul>
      {open && (
        <>
          {c.holdable === false && !c.held && (
            <p className="st-faint">Hold is not open: the listing is {c.listing ? c.listing.state.replace(/_/g, ' ') : 'gone'}, not published, so a hold would pause nothing. Dismiss or confirm the case.</p>
          )}
          {c.holdable !== false && !c.held && (
            <form className="mp-cal-form" onSubmit={submit('hold')}>
              <p className="st-label mp-admin-h">Hold measurement</p>
              <p className="st-faint">Pauses the listing&apos;s measurement as a measure of ours and sends the provider the statement of reasons: a review of the case, no finding made, with the summary above and your reason. The provider can then reply and appeal.</p>
              {groundSelect}
              <label className="st-field"><span className="st-field-label">Reason (in the statement; never name the spot account)</span><textarea className="st-textarea" name="facts" rows={2} minLength={10} required /></label>
              <div><button type="submit" className="st-btn is-sm" disabled={busy}>Hold measurement</button></div>
            </form>
          )}
          <form className="mp-cal-form" onSubmit={submit('dismiss')}>
            <p className="st-label mp-admin-h">Dismiss with reason</p>
            <p className="st-faint">{c.held ? 'Measurement resumes as it was before the hold, and the provider gets the statement that the review ended without a measure.' : 'The provider was not told about this case, so nothing is sent.'}</p>
            <label className="st-field"><span className="st-field-label">{c.held ? 'Reason (in the statement to the provider; never name the spot account)' : 'Reason (kept on the case)'}</span><textarea className="st-textarea" name="facts" rows={2} minLength={10} required /></label>
            <div><button type="submit" className="st-btn is-sm" disabled={busy}>Dismiss</button></div>
          </form>
          <form className="mp-cal-form" onSubmit={submit('confirm')}>
            <p className="st-label mp-admin-h">Confirm</p>
            <p className="st-faint">{retractMode === 'from' ? `Retracts the scores from ${retractFrom} to now and takes the measure below.` : 'Takes the measure below; no score is retracted.'} The statement of reasons is the summary above plus your text; never name the spot account.</p>
            <fieldset className="st-field mp-admin-retract">
              <legend className="st-field-label">Retract scores</legend>
              <label><input type="radio" name="retractMode" value="none" checked={retractMode === 'none'} onChange={() => setRetractMode('none')} /> None</label>
              <label><input type="radio" name="retractMode" value="from" checked={retractMode === 'from'} onChange={() => setRetractMode('from')} /> From</label>
              <input className="st-input" type="date" name="retractFrom" value={retractFrom} min={c.firstScoreDay ?? undefined} max={today()} disabled={retractMode !== 'from'}
                onChange={e => setRetractFrom(e.target.value)} aria-label="Retract scores from this UTC day" />
            </fieldset>
            {groundSelect}
            <label className="st-field"><span className="st-field-label">Measure</span>
              <select className="st-input" name="measure" defaultValue="suspend"><option value="suspend">Suspend</option><option value="terminate">Terminate (delist after 30 days&apos; notice)</option></select></label>
            <label className="st-field"><span className="st-field-label">Scope</span>
              <select className="st-input" name="scope" defaultValue="listing"><option value="listing">This listing</option><option value="provider">The whole provider</option></select></label>
            <label className="st-field"><span className="st-field-label">Facts to add</span><textarea className="st-textarea" name="facts" rows={2} /></label>
            {!heard && (
              <>
                <Note tone="warn">The provider has not been told about this case yet. Hold it first, or give the reason you decide without hearing it.</Note>
                <label className="st-field"><span className="st-field-label">Why you decide without hearing the provider (kept on the case)</span><textarea className="st-textarea" name="withoutHearing" rows={2} minLength={10} required /></label>
              </>
            )}
            <div><button type="submit" className="st-btn is-sm is-primary" disabled={busy}>Confirm and take the measure</button></div>
          </form>
        </>
      )}
    </div>
  );
}

const CASE_ERR_ID = 'mp-case-err';
const DONE: Record<Decision, string> = { hold: 'measurement held; the provider gets the statement of reasons', dismiss: 'dismissed', confirm: 'confirmed' };

export default function IntegrityCases() {
  const [rows, setRows] = useState<Case[] | null>(null);
  const [mail, setMail] = useState<StaffMail | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState<CaseDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<IntegrityNote[]>([]);
  const [ask, setAsk] = useState<IntegrityNote | null>(null);
  const [askErr, setAskErr] = useState<string | null>(null);
  // F6c (MINOR-4): after a decision the note and its button leave the list: focus goes to the list's heading, once the list
  // shows the change (the dialog has given focus back to the button by then).
  const [refocus, setRefocus] = useState(0);
  useEffect(() => { if (refocus) document.getElementById(NOTES_HEADING_ID)?.focus(); }, [refocus]);
  // A dialog closed after a 409 (the list reloaded behind it): the heading takes the focus only when the dialog could not
  // give it back (its button left with the note; the dialog's own restore runs first in the same commit).
  const [recover, setRecover] = useState(0);
  useEffect(() => { const a = document.activeElement; if (recover && (!a || a === document.body)) document.getElementById(NOTES_HEADING_ID)?.focus(); }, [recover]);
  const stale = useRef(false);
  const closeAsk = () => { setAsk(null); if (stale.current) { stale.current = false; setRecover(n => n + 1); } };
  // F6c: a case decision the API refuses is said inside the case's dialog (it was said in the pane behind it), at its
  // top, and the focus goes to it (its button was disabled while it waited).
  const [caseErr, setCaseErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await call('integrity', 'GET');
    if (r.ok) { setRows(r.data?.cases ?? []); setMail(r.data?.staffMail ?? null); setNotes(Array.isArray(r.data?.notes) ? r.data.notes : []); } else setMsg(r.message);
  }, []);
  const show = useCallback(async (id: number) => { const r = await call(`integrity/${id}`, 'GET'); if (r.ok) { setCaseErr(null); setOpen(r.data); } else setMsg(r.message); }, []);
  useEffect(() => { void load(); }, [load]);
  // The owner's mail links to /admin?case=<id>#providers: read once, then dropped from the address (the hash stays).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('case');
    if (id && /^[1-9][0-9]{0,15}$/.test(id)) {
      void show(Number(id));
      const u = new URL(window.location.href); u.searchParams.delete('case');
      window.history.replaceState(null, '', `${u.pathname}${u.search}${u.hash}`);
    }
  }, [show]);
  const decide = async (decision: Decision, body: Record<string, unknown>) => {
    if (!open) return;
    setBusy(true); setCaseErr(null);
    const r = await call(`integrity/${open.id}/decision`, 'POST', { decision, ...body });
    setBusy(false);
    if (r.ok) { setMsg(`Case #${open.id}: ${DONE[decision]}.${r.data?.note ? ` ${r.data.note}` : ''}`); setOpen(null); }
    else setCaseErr(r.message);
    void load();
  };
  // A refused decision is said at the top of the case's dialog and takes the focus, which scrolls the dialog's body to
  // it (the pressed button can sit far below it). decide() clears it first, so the same refusal again moves it again.
  useEffect(() => { if (caseErr) document.getElementById(CASE_ERR_ID)?.focus(); }, [caseErr]);
  // F6b: a note marked decided, with its reason (the item route; the note leaves the list).
  const decideNote = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ask) return;
    const form = e.currentTarget;
    const reason = String(new FormData(form).get('reason') ?? '').trim();
    setBusy(true); setAskErr(null);
    const r = await call(`calibration/items/${ask.id}/decision`, 'POST', { reason });
    setBusy(false);
    // F6c (MINOR-4): a 409 (decided in another tab or by another person) reloads the list behind the dialog, so Cancel
    // leaves no stale note.
    // A refusal keeps the dialog open: the focus goes back into it, to the reason (the submit button was disabled).
    if (!r.ok) { setAskErr(r.message); if (r.status === 409) { stale.current = true; void load(); } form.querySelector('textarea')?.focus(); return; }
    stale.current = false;
    setAsk(null);
    await load();
    setRefocus(n => n + 1);
  };
  // The same Pane props while loading and after (StudioEffects marks a revealed pane with a class that a re-rendered
  // className would wipe, F5 web review MINOR-8): the padding is the pane body's, never a flush toggle.
  const SUB = 'Automated checks and users\' reports open these; a person decides each one (target: 5 working days). Nothing happens to a listing because of a case until you decide: hold its measurement, dismiss the case, or confirm it.';
  if (!rows) return <Pane title="Integrity cases" sub={SUB} ruled>{msg ? <Note tone="bad">{msg}</Note> : <Loader label="Loading" />}</Pane>;
  return (
    <Pane title="Integrity cases" sub={SUB} ruled>
      <div className="mp-cal">
        <MailNote mail={mail} />
        {msg && <Note>{msg}</Note>}
        <CaseList rows={rows} onOpen={id => void show(id)} />
        <NoteList notes={notes} onDecide={n => { setAskErr(null); setAsk(n); }} />
      </div>
      <Modal open={!!open} onClose={() => { setOpen(null); setCaseErr(null); }} title={open ? `Case #${open.id}: ${kindText(open)}` : ''} sub={open ? `${open.provider.name}${open.listing ? ` · ${open.listing.model} (${open.listing.publicId})` : ''} · ${open.status}${open.held ? ' · held' : ''}` : undefined} size="wide">
        {open && caseErr && <div id={CASE_ERR_ID} className="mp-case-err" tabIndex={-1}><Note tone="bad">{caseErr}</Note></div>}
        {open && <CaseView key={open.id} c={open} busy={busy} onDecide={(dc, b) => void decide(dc, b)} />}
      </Modal>
      <Modal open={!!ask} onClose={closeAsk} title="Mark this note decided"
        footer={<div className="st-actions"><button type="button" className="st-btn" onClick={closeAsk}>Cancel</button><button type="submit" form="mp-note-decide" className="st-btn is-primary" disabled={busy}>{busy ? 'Recording…' : 'Record the decision'}</button></div>}>
        <form id="mp-note-decide" className="mp-cal-form" onSubmit={decideNote}>
          {ask && <p className="st-faint mp-cal-note">{ask.detail}</p>}
          <label className="st-field"><span className="st-field-label">Reason</span>
            <textarea className="st-textarea" name="reason" rows={3} minLength={10} required placeholder="What you decided and why (kept with the decision)" /></label>
          {askErr && <Note tone="bad">{askErr}</Note>}
        </form>
      </Modal>
    </Pane>
  );
}

export interface SpotKey { id: number; provider: { name: string; internal: boolean }; hint: string | null; procuredAt: string; rotateAfter: string; status: string; retiredReason: string | null; rotationDue: boolean }
export interface SpotListing { listing: { publicId: string; model: string; benchState: string; provider: { name: string } } | null; month: string; checks: Array<{ test: string; result: string; n: number }>;
  runs: Array<{ kind: string; suite: string; status: string; n: number }>; lastMonth: { month: string; spot_runs: number; consistent: number; inconsistent: number; mde_points: number | null; published_after: string } | null }

export function SpotChecks() {
  const [data, setData] = useState<{ keys: SpotKey[]; listings: SpotListing[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { void call('spot-checks', 'GET').then(r => { if (r.ok) setData(r.data); else setMsg(r.message); }); }, []);
  const SUB = 'Ordinary customer accounts we buy and pay for. Keys are added, rotated and burned only with admin/spotcheck-keys.js on the server (stdin).';
  if (!data) return <Pane title="Spot checks" sub={SUB} ruled>{msg ? <Note tone="bad">{msg}</Note> : <Loader label="Loading" />}</Pane>;
  return (
    <Pane title="Spot checks" sub={SUB} ruled>
      <SpotChecksView data={data} />
    </Pane>
  );
}

/** The Spot checks pane's body (exported for the render tests): ruled rows, pills on the right. */
export function SpotChecksView({ data }: { data: { keys: SpotKey[]; listings: SpotListing[] } }) {
  return (
    <div className="mp-cal">
      <p className="st-label mp-admin-h">Keys (status only)</p>
      <ul className="mp-cal-list">
        {data.keys.length === 0 && <li className="mp-cal-row"><span className="mp-cal-main st-faint">No spot key yet.</span></li>}
        {data.keys.map(k => (
          <li key={k.id} className="mp-cal-row">
            <span className="mp-cal-main">#{k.id} · {k.provider.name}{k.provider.internal ? ' (internal)' : ''} · …{k.hint ?? '????'}
              <span className="mp-cal-sub st-faint">procured {k.procuredAt.slice(0, 10)} · rotate by {k.rotateAfter.slice(0, 10)}{k.rotationDue ? ' (due)' : ''}{k.retiredReason ? ` · ${k.retiredReason}` : ''}</span></span>
            <span className="mp-cal-acts"><Pill tone={k.status === 'active' ? (k.rotationDue ? 'warn' : 'good') : k.status === 'burned' ? 'bad' : undefined}>{k.status}</Pill></span>
          </li>
        ))}
      </ul>
      <p className="st-label mp-admin-h">Listings</p>
      <ul className="mp-cal-list">
        {data.listings.length === 0 && <li className="mp-cal-row"><span className="mp-cal-main st-faint">No spot run yet.</span></li>}
        {data.listings.map((x, i) => (
          <li key={x.listing?.publicId ?? i} className="mp-cal-row">
            <span className="mp-cal-main">
              {x.listing ? `${x.listing.provider.name} · ${x.listing.model}` : '—'} · {x.month}:{' '}
              {x.checks.length ? x.checks.map(c => `${TEST[c.test] ?? c.test} ${c.result} ${c.n}`).join(', ') : 'no check yet'}
              {x.lastMonth && <span className="mp-cal-sub st-faint">{x.lastMonth.month}: {x.lastMonth.spot_runs} runs, {x.lastMonth.consistent} consistent, {x.lastMonth.inconsistent} not, MDE {x.lastMonth.mde_points ?? '—'}; public from {fullDate(x.lastMonth.published_after)}</span>}
              {x.runs.length > 0 && <span className="mp-cal-sub st-faint">{x.runs.map(r => `${r.kind.replace('_', ' ')} ${r.suite} ${r.status} ${r.n}`).join(' · ')}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
