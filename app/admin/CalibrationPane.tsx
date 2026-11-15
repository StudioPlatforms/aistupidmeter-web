'use client';

/**
 * The Providers tab's Calibration pane (phase4-plan revision 4 §R2.13; F4), beside Integrity cases and Spot checks.
 *
 * What staff see: whether consented calibration is switched on (marketplace.fresh_calibration, the owner's switch); the
 * items a person decides (a decline or a lapsed invitation under reading (B), a pilot or interim stop, a decision's admin
 * item, an enrolment paused for the day); every campaign with its suites' states and its enrolments (provider, listing,
 * state, cap, spend, runs done of the share; never a score, a run's time or a task: tasks are named by anonymous index
 * in the stored reports only); the coverage and comparability rows; and what the methodology page would publish
 * (covered families only, F8 makes it public).
 *
 * What staff decide, each with a recorded reason (at least 10 characters): exclude a listing from the calibration (the
 * family is decided again without it), keep a listing in for ONE case the analysis opened (that suite is decided again
 * with it; the dialog says how), keep it on the standard tasks (its move is stopped), resume a suite the pilot or the
 * interim stopped, cancel a campaign, revoke a suite's coverage, or mark an item decided; F5: stop a move (a listing or
 * the family) during its notice, restart a stopped one (the Fresh task versions section). F5b (F5 code review SHOULD-8):
 * no "Regraded": no regrade tool ships, so a grader-only correction is a protocol change (the API refuses `regraded`). Integrity cases themselves (hold, dismiss, confirm) stay in the Integrity cases pane. Nobody consents for a
 * provider: there is no consent here.
 *
 * F6b (F6r re-check web SHOULD-1): every item in "To decide" can be marked decided. An item of a calibration goes through
 * that calibration's route as before; one no calibration owns (the weekly notes no calibration owns) through its own
 * (calibration/items/<id>/decision). A weekly note shows its newest row only (the API's pendingItems), and the standard
 * tasks' weekly note is the Integrity cases pane's.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
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

interface SuiteState { suite: string; word: string; state: { state: string; code?: string | null } | null }
interface Enrolment {
  id: number; state: string; listing: { publicId: string; model: string; benchState: string } | null; provider: { name: string; identity: string };
  capUsd: number | null; estimateUsd: number | null; maxUsd: number | null; standingCheck: boolean; invitedAt: string; answeredAt: string | null; endedAt: string | null; endReason: string | null;
  progress: { done: number; of: number; spendUsd: number; capUsd: number | null };
}
/** A case the campaign's analysis opened (F4 review S4): "Keep in" answers one case, for its suite only. */
export interface CaseRow { id: number; suite: string; listing: string | null; kind: string; basis: 'g5' | 'confined'; status: string; kept: boolean; openedAt: string }
interface Campaign { id: string; family: string; kind: string; state: string; openedAt: string; inviteUntil: string; windowEnd: string | null; decidedAt: string | null; suites: SuiteState[]; enrolments: Enrolment[]; poolsWith: string | null; planSha256: string | null;
  cases?: CaseRow[] }
interface Pending { id: number; kind: string; campaign: string | null; listing: string | null; at: string; detail: string }
/** F5: the per-family fresh switch, the moves, the standing check and the stale certificates (statistics only). */
interface SwitchRow { family: string; name: string; suite: string; generatorVersion: string; company: { open: boolean; reason: string | null }; individual: { open: boolean; reason: string | null } }
interface MoveRowDTO { family: string; suite: string; generatorVersion: string; listing: string; provider: string; campaign: string | null; role: string; state: string; noticeAt: string; moveAt: string; movedAt: string | null;
  stoppedAt: string | null; stopReason: string | null; step: { excess: number | null; se: number | null; flag: number | null; judgedAt: string } | null }
interface FreshData { flag: string; switches: SwitchRow[]; moves: MoveRowDTO[]; standing: any[]; events: Array<{ action: string; target: string; at: string; detail: any }> }
export interface CalibrationData { available: boolean; flag: string; campaigns: Campaign[]; coverage: any[]; comparability: any[]; pending: Pending[]; publication: { suites: any[] } | null; fresh?: FreshData }

const CODE: Record<string, string> = {
  comparable: 'covered, comparable', covered_one_provider: 'covered on one provider', covered_straddles: 'covered, margin straddled', covered_shifted: 'covered, shifted (a person decides)',
  inconclusive_one_provider: 'inconclusive: one provider', inconclusive_withdrawn: 'inconclusive: withdrawn', inconclusive_caps: 'inconclusive: caps reached', pending_case: 'waiting for a case decision',
  not_covered: 'not covered (a person decides)', pilot_stopped: 'stopped by the pilot', pilot: 'stopped by the pilot', interim_failure: 'stopped at the interim look', no_data: 'no data', topup: 'top-up',
  hosts_disagree: 'the two providers disagree (a person decides)', resumed: 'running (resumed by a person)',
};
const SUITE_WORD: Record<string, string> = { coding: 'coding', reasoning: 'reasoning', tooling: 'tool use', canary: 'probe' };
/**
 * What "Keep in" does for one case (said in its dialog before the decision is recorded). `others`: the cases its verdict
 * opened with it (one per listing of the provider it names) not kept in yet (F4 re-verification N4): the suite is decided
 * again only once every one of them is kept in.
 */
export const keepNote = (c: CaseRow, others = 0) => (c.basis === 'g5'
  ? `For this case only: ${SUITE_WORD[c.suite] ?? c.suite} is decided again with this listing's runs, without rule G5 (by C, G1f, G2 and G3). A new failure confined to one provider opens a new case.`
  : `For this case only: the failure is taken as real, so ${SUITE_WORD[c.suite] ?? c.suite} is decided again with this listing's runs as a failure not confined to one provider (not covered, or covered and shifted when only the composite moved; inconclusive if one provider is left). Another suite, look or top-up opens its own case.`)
  + (others > 0 ? ` ${others} other case${others === 1 ? '' : 's'} opened with this one for ${SUITE_WORD[c.suite] ?? c.suite} (the same provider's other listing${others === 1 ? '' : 's'}) ${others === 1 ? 'is' : 'are'} not kept in yet: the suite is decided again only once all of them are kept in.` : '');
const usd = (n: number | null | undefined) => (typeof n === 'number' ? `$${n.toFixed(2)}` : '—');
const stateTone = (s: string): 'good' | 'warn' | 'bad' | undefined => (s === 'decided' ? 'good' : s === 'cancelled' ? 'bad' : s === 'inviting' || s === 'running' || s === 'analysing' ? 'warn' : undefined);
const suiteText = (x: SuiteState) => `${x.word}: ${x.state ? (CODE[String(x.state.code ?? '')] ?? (x.state.state === 'pilot_passed' ? 'running (pilot passed)' : x.state.state)) : '—'}`;

const SUITE_W = SUITE_WORD;
const REASON_W: Record<string, string> = { fresh_off: 'fresh measurement off', family_not_covered: 'not covered', coverage_revoked: 'revoked', certificate_revoked: 'certificate revoked', not_comparable: 'not comparable', one_provider: 'one provider',
  awaiting_confirmation: 'comparable: waits for a person to confirm its providers are unaffiliated (the decision\'s item)' };
const day = (x: string | null | undefined) => (x ? x.slice(0, 10) : '—');
/**
 * F5b (web review MINOR-1), F6c (F5b re-verification §6): a family as every list of the pane names it, its name and slug
 * ("DeepSeek V4 Pro (deepseek-v4-pro)"), from the fresh switch rows' names (every active open model, each suite); the slug
 * alone when its name is not known (an older API without `fresh`, a family no longer active).
 */
const familyLabeller = (switches: SwitchRow[] | undefined) => {
  const nameOf = new Map((switches ?? []).map(x => [x.family, x.name]));
  return (slug: string) => { const n = nameOf.get(slug); return n && n !== slug ? `${n} (${slug})` : slug; };
};

/**
 * F5 (phase4-plan revision 4 §R2.10, §R2.11): the per-family fresh switch (company hosts by comparability, individuals and
 * user-run tests by coverage), each listing's move with its notice and the movers' check, the standing check's months and
 * the stale certificates. Staff stop a move (one listing or the family) during its notice or restart a stopped one, each
 * with its reason. F5b (web review MINOR-1): the moves are grouped by family (one row per family, its listings' rows under
 * it, "Stop the family's move" on the family's row while a notice runs), and every list names a family alike: its name and
 * slug. Exported for the render tests.
 */
export function FreshView({ fresh, onDecide }: { fresh: FreshData; onDecide: (campaign: string, body: Record<string, unknown>, title: string, note?: string) => void }) {
  const open = fresh.switches.filter(x => x.company.open || x.individual.open || (x.company.reason && x.company.reason !== 'family_not_covered' && x.company.reason !== 'fresh_off'));
  const famLabel = familyLabeller(fresh.switches);
  const byFamily = new Map<string, MoveRowDTO[]>();
  for (const m of fresh.moves) { const xs = byFamily.get(m.family) ?? []; xs.push(m); byFamily.set(m.family, xs); }
  const diff = fresh.standing.filter((r: any) => r.arm === 'difference');
  const stale = fresh.events.filter(e => e.action !== 'fresh.drift_harness');
  return (
    <>
      <p className="st-label mp-admin-h">Fresh task versions</p>
      {fresh.flag !== 'on' && <Note>Fresh measurement is off (marketplace.fresh): no listing moves and no fresh instance is issued. The owner turns it on.</Note>}
      <ul className="mp-cal-list">
        {open.length === 0 && <Row main={<span className="st-faint">No family is covered: every switch is closed.</span>} />}
        {open.map(x => (
          <Row key={`${x.family}|${x.suite}`}
            main={`${famLabel(x.family)} · ${SUITE_W[x.suite] ?? x.suite} (${x.generatorVersion}) · company hosts ${x.company.open ? 'open' : `closed (${REASON_W[x.company.reason ?? ''] ?? x.company.reason})`} · individuals ${x.individual.open ? 'open' : `closed (${REASON_W[x.individual.reason ?? ''] ?? x.individual.reason})`}`} />
        ))}
      </ul>
      <p className="st-label mp-admin-h">Moves</p>
      <ul className="mp-cal-list">
        {fresh.moves.length === 0 && <Row main={<span className="st-faint">No listing has moved or been given notice.</span>} />}
        {[...byFamily.entries()].map(([family, ms]) => {
          const inNotice = ms.find(m => m.state === 'notice' && m.campaign);
          const n = (st: string) => ms.filter(m => m.state === st).length;
          const counts = [['notice', 'in notice'], ['moved', 'moved'], ['stopped', 'stopped']].map(([st, w]) => (n(st) ? `${n(st)} ${w}` : '')).filter(Boolean).join(' · ');
          return (
            <Row key={`fam-${family}`} className="mp-cal-campaign" main={<><strong>{famLabel(family)}</strong>{counts ? ` · ${counts}` : ''}</>}
              acts={inNotice ? <Act onClick={() => onDecide(inNotice.campaign as string, { action: 'stop_move' }, `Stop the move of every listing of ${famLabel(family)}`)}>Stop the family&apos;s move</Act> : undefined}>
              <ul className="mp-cal-enrol">
                {ms.map(m => (
                  <li key={`${m.listing}|${m.suite}|${m.generatorVersion}`}>
                    <span className="mp-cal-main">{`${m.provider} · listing ${m.listing} · ${SUITE_W[m.suite] ?? m.suite} · ${m.role} · ${m.state === 'notice' ? `moves on ${day(m.moveAt)}` : m.state === 'moved' ? `on fresh since ${day(m.movedAt)}` : `${m.state}${m.stopReason ? ` (${m.stopReason.replace(/_/g, ' ')})` : ''}`}`}
                      {m.step && m.step.excess !== null && <span className="mp-cal-sub st-faint">{`at the move: excess ${m.step.excess} ± ${m.step.se}${m.step.flag ? ` · flagged ${m.step.flag < 0 ? 'down' : 'up'}` : ' · not flagged'}`}</span>}</span>
                    {m.campaign && (m.state === 'notice' || m.state === 'stopped') && (
                      <span className="mp-cal-acts">
                        {m.state === 'notice'
                          ? <Act onClick={() => onDecide(m.campaign as string, { action: 'stop_move', listing: m.listing }, `Stop the move of listing ${m.listing} (${m.provider})`)}>Stop</Act>
                          : <Act onClick={() => onDecide(m.campaign as string, { action: 'restart_move', listing: m.listing }, `Restart the move of listing ${m.listing} (${m.provider})`)}>Restart</Act>}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Row>
          );
        })}
      </ul>
      <p className="st-label mp-admin-h">Standing check</p>
      <ul className="mp-cal-list">
        {diff.length === 0 && <Row main={<span className="st-faint">No standing check has run yet.</span>} />}
        {diff.map((r: any) => (
          <Row key={`${r.family}|${r.suite}|${r.month}`}
            main={`${famLabel(r.family)} · ${SUITE_W[r.suite] ?? r.suite} · ${r.month} · ${r.runs} founder${r.runs === 1 ? '' : 's'} · difference ${r.mean ?? '—'} ± ${r.sd ?? '—'}${typeof r.cusum_high === 'number' ? ` · CUSUM ${Math.max(r.cusum_high, r.cusum_low ?? 0).toFixed(2)} of 4.0` : ''}`}
            acts={r.alarm ? <Pill tone="bad">alarm</Pill> : <Pill tone="good">no alarm</Pill>} />
        ))}
      </ul>
      <p className="st-label mp-admin-h">Stale certificates</p>
      <ul className="mp-cal-list">
        {stale.length === 0 && <Row main={<span className="st-faint">No standard change has made a calibration stale.</span>} />}
        {stale.map(e => (
          <Row key={`${e.target}|${e.at}`}
            main={`${e.detail?.family ? famLabel(e.detail.family) : '—'} · ${SUITE_W[e.detail?.suite] ?? e.detail?.suite ?? '—'} · ${e.action === 'fresh.stale_lapsed' ? 'grace ended: not comparable' : `${String(e.detail?.kind ?? '').replace(/_/g, ' ')}${e.detail?.graderOnly ? ' (a grader-only correction)' : ''}`}`}
            sub={fullDate(e.at)} />
        ))}
      </ul>
    </>
  );
}

/**
 * One row of the pane (the router pages' ruled rows): what it is on the left, with a faint second line for its date or
 * state; its decisions as small buttons in one column on the right (under the text on a phone).
 */
function Row({ main, sub, acts, children, className }: { main: ReactNode; sub?: ReactNode; acts?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <li className={`mp-cal-row${className ? ` ${className}` : ''}`}>
      <span className="mp-cal-main">{main}{sub !== undefined && sub !== null && <span className="mp-cal-sub st-faint">{sub}</span>}</span>
      {acts && <span className="mp-cal-acts">{acts}</span>}
      {children}
    </li>
  );
}
/**
 * A staff decision's button; the ones that cannot be undone in this pane read as such (is-danger: Cancel, Revoke, Exclude;
 * F5b, web review MINOR-3). Stop, Stop the family's move and Keep on standard are plain: Restart undoes them.
 */
function Act({ danger, onClick, children }: { danger?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={`st-btn is-sm${danger ? ' is-danger' : ''}`} onClick={onClick}>{children}</button>;
}

/** F6c (F6b web review MINOR-3): an item's words, as its row shows them and its "Mark decided" dialog repeats them. */
export const itemWords = (p: Pending) => `${p.kind.replace(/_/g, ' ')}${p.listing ? ` · listing ${p.listing}` : ''} — ${p.detail}`;
/** F6c (MINOR-4): the "To decide" heading, which takes the focus after a decision (the row and its button leave the list). */
export const TODO_HEADING_ID = 'mp-cal-todo-h';

/** The pane's body, given its data (exported for the render tests). */
export function CalibrationView({ data, onDecide, onDecideItem }: { data: CalibrationData; onDecide: (campaign: string, body: Record<string, unknown>, title: string, note?: string) => void;
  /** F6b: mark an item no calibration owns decided (its own route); without it such an item shows no action, as before. */
  onDecideItem?: (item: number, title: string, note?: string) => void }) {
  if (!data.available) return <div className="mp-cal"><p className="st-faint">The calibration tables are not there yet (an older release).</p></div>;
  // F6c: the campaigns, coverage and publication rows name a family as the fresh rows do, and a suite in its words.
  const famLabel = familyLabeller(data.fresh?.switches);
  return (
    <div className="mp-cal">
      {data.flag !== 'on' && <Note>Consented calibration is off (marketplace.fresh_calibration): no campaign opens, no invitation goes out and no calibration run is claimed. The owner turns it on. To turn it off again, set the row to &apos;off&apos;; never delete it (the next deploy&apos;s DDL check needs it).</Note>}
      <p className="st-label mp-admin-h" id={TODO_HEADING_ID} tabIndex={-1}>To decide</p>
      <ul className="mp-cal-list">
        {data.pending.length === 0 && <Row main={<span className="st-faint">Nothing waits for a person.</span>} />}
        {data.pending.map(p => (
          <Row key={p.id} main={itemWords(p)} sub={fullDate(p.at)}
            acts={p.campaign ? <Act onClick={() => onDecide(p.campaign as string, { action: 'decided', item: p.id }, 'Mark this item decided', itemWords(p))}>Mark decided</Act>
              : onDecideItem ? <Act onClick={() => onDecideItem(p.id, 'Mark this item decided', itemWords(p))}>Mark decided</Act> : undefined} />
        ))}
      </ul>
      <p className="st-label mp-admin-h">Campaigns</p>
      <ul className="mp-cal-list">
        {data.campaigns.length === 0 && <Row main={<span className="st-faint">No calibration yet.</span>} />}
        {data.campaigns.map(k => (
          <Row key={k.id} className="mp-cal-campaign"
            main={<><strong>{famLabel(k.family)}</strong> · {k.kind}{k.poolsWith ? ` (pools with ${k.poolsWith})` : ''} · opened {fullDate(k.openedAt)} · {k.windowEnd ? `window to ${k.windowEnd.slice(0, 10)}` : `answers by ${k.inviteUntil.slice(0, 10)}`}</>}
            sub={k.suites.map(suiteText).join(' · ')}
            acts={<>
              <Pill tone={stateTone(k.state)}>{k.state}</Pill>
              {k.state === 'running' && k.suites.filter(x => x.state?.state === 'stopped').map(x => (
                <Act key={x.suite} onClick={() => onDecide(k.id, { action: 'resume_suite', suite: x.suite }, `Resume ${x.word} for ${famLabel(k.family)}`)}>Resume {x.word}</Act>
              ))}
              {['inviting', 'running', 'analysing'].includes(k.state) && <Act danger onClick={() => onDecide(k.id, { action: 'cancel' }, `Cancel the calibration of ${famLabel(k.family)}`)}>Cancel</Act>}
            </>}>
            {(k.cases ?? []).length > 0 && (
              <ul className="mp-cal-enrol">
                {(k.cases ?? []).map(c => {
                  const e = k.enrolments.find(x => x.listing?.publicId === c.listing);
                  // The cases one verdict opened together (one per listing of the provider it names): the same suite, basis and time.
                  const others = (k.cases ?? []).filter(x => x.id !== c.id && x.suite === c.suite && x.basis === c.basis && x.openedAt === c.openedAt && !x.kept).length;
                  const who = e ? `${e.listing ? e.listing.model : '—'} (${e.provider.name})` : (c.listing ?? '—');
                  const waiting = k.suites.some(x => x.suite === c.suite && x.state?.code === 'pending_case');
                  return (
                    <li key={`case-${c.id}`}>
                      <span className="mp-cal-main">Case #{c.id} · {SUITE_WORD[c.suite] ?? c.suite} · {who} · {c.basis === 'g5' ? 'rule G5' : 'confined failure'} · {c.status}{c.kept ? ' · kept in' : ''}</span>
                      {waiting && !c.kept && c.listing && (
                        <span className="mp-cal-acts">
                          <Act onClick={() => onDecide(k.id, { action: 'include', listing: c.listing, suite: c.suite, case: c.id }, `Keep ${who} in for case #${c.id}`, keepNote(c, others))}>Keep in</Act>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {k.enrolments.length > 0 && (
              <ul className="mp-cal-enrol">
                {k.enrolments.map(e => (
                  <li key={e.id}>
                    <span className="mp-cal-main">{e.provider.name} · {e.listing ? e.listing.model : '—'} · {e.state}{e.progress.of ? ` · ${e.progress.done} of ${e.progress.of} runs · ${usd(e.progress.spendUsd)} of ${usd(e.capUsd)}` : ''}</span>
                    {e.listing && ['consented', 'closed', 'withdrawn'].includes(e.state) && ['running', 'analysing', 'decided'].includes(k.state) && (
                      <span className="mp-cal-acts">
                        <Act danger onClick={() => onDecide(k.id, { action: 'exclude', listing: e.listing!.publicId }, `Exclude ${e.listing!.model} (${e.provider.name}) from the calibration`,
                          'Its runs leave this family\'s calibration (every suite, this campaign and its top-ups), and the family is decided again without it.')}>Exclude</Act>
                        <Act onClick={() => onDecide(k.id, { action: 'keep_standard', listing: e.listing!.publicId }, `Keep ${e.listing!.model} (${e.provider.name}) on the standard tasks`)}>Keep on standard</Act>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Row>
        ))}
      </ul>
      <p className="st-label mp-admin-h">Coverage and comparability</p>
      <ul className="mp-cal-list">
        {data.coverage.length === 0 && <Row main={<span className="st-faint">No family is covered yet.</span>} />}
        {data.coverage.map((c: any) => {
          const cmp = data.comparability.find((x: any) => x.family === c.family && x.suite === c.suite && x.generator_version === c.generator_version);
          const k = data.campaigns.find(x => x.family === c.family);
          return (
            <Row key={`${c.family}|${c.suite}|${c.generator_version}`}
              main={`${famLabel(c.family)} · ${SUITE_W[c.suite] ?? c.suite} (${c.generator_version}) · ${c.status} · ${c.listings} listing${c.listings === 1 ? '' : 's'}, ${c.providers} provider${c.providers === 1 ? '' : 's'}${cmp ? ` · ${cmp.status}${cmp.reason ? ` (${String(cmp.reason).replace(/_/g, ' ')})` : ''}${typeof cmp.margin === 'number' ? ` · margin ±${cmp.margin}` : ''}` : ''}`}
              sub={fullDate(c.decided_at)}
              acts={k && c.status !== 'revoked' ? <Act danger onClick={() => onDecide(k.id, { action: 'revoke_coverage', suite: c.suite }, `Revoke ${SUITE_W[c.suite] ?? c.suite} coverage of ${famLabel(c.family)}`)}>Revoke</Act> : undefined} />
          );
        })}
      </ul>
      {data.fresh && <FreshView fresh={data.fresh} onDecide={onDecide} />}
      <p className="st-label mp-admin-h">Would be published (covered families only; not public yet)</p>
      <ul className="mp-cal-list">
        {(!data.publication || data.publication.suites.length === 0) && <Row main={<span className="st-faint">Nothing to publish yet.</span>} />}
        {data.publication?.suites.map((x: any) => (
          <Row key={`${x.suite}|${x.generatorVersion}`}
            main={`${SUITE_W[x.suite] ?? x.suite} (${x.generatorVersion}): ${x.families.map((f: any) => `${famLabel(f.family)} · ${f.providers} provider${f.providers === 1 ? '' : 's'}${f.c && typeof f.c.estimate === 'number' ? `, C ${f.c.estimate} [${f.c.ciLow}, ${f.c.ciHigh}] within ±${f.c.margin}` : ''}`).join('; ')}`}
            sub={x.g1p ? 'panel claim computed' : 'panel claim from three families'} />
        ))}
      </ul>
    </div>
  );
}

export default function CalibrationPane() {
  const [data, setData] = useState<CalibrationData | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // F6b: `campaign` null for an item no calibration owns (its own route, the reason alone).
  const [ask, setAsk] = useState<{ campaign: string | null; body: Record<string, unknown>; title: string; note?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await call('calibration', 'GET');
    if (r.ok) { setData(r.data); setMsg(null); } else setMsg(r.message);
  }, []);
  useEffect(() => { void load(); }, [load]);
  // F6c (MINOR-4): after a decision focus goes to "To decide", once the pane shows the change (the dialog has given focus
  // back to its button by then, and the button may have left with its row). Closing a dialog after a 409 (`stale`, the
  // pane reloaded behind it) sends it there only when the dialog could not give it back (its button left with its row):
  // the dialog's own restore runs first in the same commit. A later reload never moves the focus.
  const [refocus, setRefocus] = useState(0);
  useEffect(() => { if (refocus) document.getElementById(TODO_HEADING_ID)?.focus(); }, [refocus]);
  const [recover, setRecover] = useState(0);
  useEffect(() => { const a = document.activeElement; if (recover && (!a || a === document.body)) document.getElementById(TODO_HEADING_ID)?.focus(); }, [recover]);
  const stale = useRef(false);
  const closeAsk = () => { setAsk(null); if (stale.current) { stale.current = false; setRecover(n => n + 1); } };
  const decide = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ask) return;
    const form = e.currentTarget;
    const reason = String(new FormData(form).get('reason') ?? '').trim();
    setBusy(true); setErr(null);
    const r = ask.campaign ? await call(`calibration/${ask.campaign}/decision`, 'POST', { ...ask.body, reason })
      : await call(`calibration/items/${Number(ask.body.item)}/decision`, 'POST', { reason });
    setBusy(false);
    // F6c (MINOR-4): a 409 (decided in another tab, the state moved on) reloads the pane behind the dialog, so Cancel leaves
    // nothing stale.
    // A refusal keeps the dialog open: the focus goes back into it, to the reason (the submit button was disabled while
    // it waited, which drops the focus).
    if (!r.ok) { setErr(r.message); if (r.status === 409) { stale.current = true; void load(); } form.querySelector('textarea')?.focus(); return; }
    stale.current = false;
    setAsk(null);
    await load();
    setRefocus(n => n + 1);
  };
  // The same Pane props while loading and after (StudioEffects marks a revealed pane with a class that a re-rendered
  // className would wipe): the padding is the pane body's, never a flush toggle.
  const SUB = 'Consented, provider-side calibration of fresh task versions: hosts run both versions on their own endpoints, at their own cost. A person decides every failure and every case.';
  if (!data) return <Pane title="Calibration" sub={SUB} ruled>{msg ? <Note tone="bad">{msg}</Note> : <Loader label="Loading" />}</Pane>;
  return (
    <Pane title="Calibration" sub={SUB} ruled>
      <CalibrationView data={data} onDecide={(campaign, body, title, note) => { setErr(null); setAsk({ campaign, body, title, note }); }}
        onDecideItem={(item, title, note) => { setErr(null); setAsk({ campaign: null, body: { action: 'decided', item }, title, note }); }} />
      <Modal open={!!ask} onClose={closeAsk} title={ask?.title ?? ''}
        footer={<div className="st-actions"><button type="button" className="st-btn" onClick={closeAsk}>Cancel</button><button type="submit" form="mp-cal-decide" className="st-btn is-primary" disabled={busy}>{busy ? 'Recording…' : 'Record the decision'}</button></div>}>
        <form id="mp-cal-decide" className="mp-cal-form" onSubmit={decide}>
          {ask?.note && <p className="st-faint mp-cal-note">{ask.note}</p>}
          <label className="st-field"><span className="st-field-label">Reason</span>
            <textarea className="st-textarea" name="reason" rows={3} minLength={10} required placeholder="What you decided and why (kept with the decision)" /></label>
          {err && <Note tone="bad">{err}</Note>}
        </form>
      </Modal>
    </Pane>
  );
}
