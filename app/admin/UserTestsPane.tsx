'use client';

/**
 * The Providers tab's User-run tests pane (Phase 3 plan §7.7, Phase 4 §6.4; F7), beside Integrity cases, Spot checks and
 * Calibration. Staff see the newest tests of listed hosts: the host and model, the suite, its state and score, who ran it
 * (an individual tester, by name only if they chose to show it, or an account of the listed provider) and the account id a
 * decision needs; never a task, a scenario or a run's detail. Shown only while the API's switch is on or a test exists.
 *
 * What staff decide: hide one test from the public rows (a moderation measure with a ground and at least 40 characters of
 * facts: the statement of reasons, DSA Art. 17, which goes to the TESTER by mail and in their own list, never to the
 * provider), or show a hidden one again (a reinstate that reverses that decision). Both through POST actions.
 *
 * The signals (F7 review code-security SHOULD-4), so a hide on G4 is a decision on evidence: per listing, its tests of the
 * last 30 days, how many came from accounts under 30 days old, and how many of the last 48 hours' requests came from one
 * address range (counts only: the API never sends an address, and drops them after 48 hours).
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Modal, Note, Pane, Tag } from '@/components/studio';
import { fullDate } from './format';

interface StaffTest {
  id: number; suite: string; state: string; reason: string | null; score: number | null; testerKind: string; label: string | null; userId: number | null;
  listing: { publicId: string; label: string; provider: string }; requestedAt: string; hiddenActionId: number | null;
}
interface Signal { listing: { publicId: string; label: string; provider: string }; tests: number; newAccounts: number; unknownAccounts: number; recentWithAddress: number; recentOneRange: number }
interface Data {
  enabled: boolean; limits: { perListingSuiteDay: number; perListingSuiteWindow?: number; windowHours?: number; perTesterSuiteDay: number };
  minAccountAgeDays?: number; signals?: Signal[]; tests: StaffTest[];
}

const GROUNDS: Array<[string, string]> = [['G11', 'Abuse of our services'], ['G2', 'Impersonation or infringement'], ['G7', 'Illegal content or sanctions'], ['G4', 'Measurement manipulation']];
const SUITE: Record<string, string> = { coding: 'Coding', reasoning: 'Reasoning', tooling: 'Tool use' };

/* eslint-disable @typescript-eslint/no-explicit-any */
async function call(path: string, method: 'GET' | 'POST', body?: unknown): Promise<{ ok: boolean; status: number; data: any; message: string | null }> {
  try {
    const r = await fetch(`/api/admin/marketplace/${path}`, { method, cache: 'no-store', ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) } : {}) });
    const j = await r.json().catch(() => null);
    return { ok: r.ok && !!j?.success, status: r.status, data: j?.data ?? null, message: j?.message || (r.ok ? null : j?.error || `The API answered ${r.status}.`) };
  } catch {
    return { ok: false, status: 0, data: null, message: 'Could not reach the server.' };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const who = (t: StaffTest) => (t.testerKind === 'provider_staff' ? `an account of ${t.listing.provider}` : t.label ? `${t.label} (named)` : 'an individual tester');

/** The pane's rows, given its data (exported for the render tests). */
export function UserTestsView({ data, onHide, onShow }: { data: Data; onHide: (t: StaffTest) => void; onShow: (t: StaffTest) => void }) {
  const signals = data.signals ?? [];
  return (
    <div className="mp-cal mp-ut-staff">
      {!data.enabled && <Note>User-run tests are off (marketplace.user_tests): none can be started, and queued ones are cancelled.</Note>}
      <p className="mp-cal-note st-faint">
        At most {data.limits.perListingSuiteDay} tests per listing, suite and UTC day{data.limits.perListingSuiteWindow ? `, ${data.limits.perListingSuiteWindow} in each ${data.limits.windowHours ?? 8}-hour block` : ''},
        {' '}{data.limits.perTesterSuiteDay} per tester (the same key, address, provider account or workspace is one tester){data.minAccountAgeDays ? `; accounts at least ${data.minAccountAgeDays} days old` : ''}.
      </p>
      {signals.length > 0 && (
        <>
          <p className="st-label mp-admin-h">Who tests each listing (last 30 days)</p>
          <ul className="mp-cal-list mp-ut-signals">
            {signals.map(g => (
              <li key={g.listing.publicId} className="mp-cal-row">
                <span className="mp-cal-main">
                  {g.listing.provider} · {g.listing.label}: {g.tests} test{g.tests === 1 ? '' : 's'}, {g.newAccounts} from accounts under 30 days old{g.unknownAccounts ? `, ${g.unknownAccounts} of an unknown age` : ''}
                  <span className="mp-cal-sub st-faint">Last 48 hours: {g.recentWithAddress ? `${g.recentOneRange} of ${g.recentWithAddress} requests with an address from one address range` : 'no request with an address'}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <ul className="mp-cal-list">
        {data.tests.length === 0 && <li className="mp-cal-row"><span className="mp-cal-main st-faint">No tests yet.</span></li>}
        {data.tests.map(t => (
          <li key={t.id} className="mp-cal-row">
            <span className="mp-cal-main">
              {t.listing.provider} · {t.listing.label} · {SUITE[t.suite] ?? t.suite} · {t.state}{t.score !== null ? ` · ${t.score}` : ''}{t.reason && t.state !== 'done' ? ` (${t.reason})` : ''}
              {t.hiddenActionId !== null && <> · <Tag tone="warn">hidden</Tag></>}
              <span className="mp-cal-sub st-faint">#{t.id} · by {who(t)}{t.userId !== null ? `, account ${t.userId}` : ''} · {fullDate(t.requestedAt)}</span>
            </span>
            {(t.hiddenActionId !== null || t.state === 'done') && (
              <span className="mp-cal-acts">
                {t.hiddenActionId === null
                  ? <button type="button" className="st-btn is-sm is-danger" onClick={() => onHide(t)}>Hide…</button>
                  : <button type="button" className="st-btn is-sm" onClick={() => onShow(t)}>Show again…</button>}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function UserTestsPane() {
  const [data, setData] = useState<Data | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ t: StaffTest; hide: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await call('user-tests', 'GET');
    // An API without the route (a release before F7): nothing to show, never an error pane.
    if (r.ok) { setData(r.data); setMsg(null); } else if (r.status === 404) { setData({ enabled: false, limits: { perListingSuiteDay: 3, perTesterSuiteDay: 1 }, signals: [], tests: [] }); setMsg(null); } else setMsg(r.message);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const decide = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ask) return;
    const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    setBusy(true); setErr(null);
    const body = ask.hide
      ? { scope: 'user_test', test: ask.t.id, action: 'remove_content', ground: f.ground || null, facts: f.facts || '' }
      : { scope: 'user_test', test: ask.t.id, action: 'reinstate', facts: `Reverses decision #${ask.t.hiddenActionId}: ${f.facts || ''}` };
    const r = await call('actions', 'POST', body);
    setBusy(false);
    if (!r.ok) { setErr(r.message); return; }
    setAsk(null);
    await load();
  };
  const SUB = 'Tests people ran with their own key at a listed host, on fresh task versions. Hiding one is a decision whose reasons go to its tester.';
  // Nothing at all until the data says the pane has something to show (switched off with no test: never a pane, never a
  // loading flash), so the Pane mounts once, with the same props from then on (StudioEffects keeps its reveal class).
  if (!data) return msg ? <Pane title="User-run tests" sub={SUB} ruled><Note tone="bad">{msg}</Note></Pane> : null;
  if (!data.enabled && data.tests.length === 0) return null;
  return (
    <Pane title="User-run tests" sub={SUB} ruled>
      <UserTestsView data={data} onHide={t => { setErr(null); setAsk({ t, hide: true }); }} onShow={t => { setErr(null); setAsk({ t, hide: false }); }} />
      <Modal open={!!ask} onClose={() => setAsk(null)} title={ask ? `${ask.hide ? 'Hide' : 'Show again'} test #${ask.t.id}` : ''}
        footer={<div className="st-actions"><button type="button" className="st-btn" onClick={() => setAsk(null)}>Cancel</button>
          <button type="submit" form="mp-ut-decide" className={`st-btn ${ask?.hide ? 'is-danger' : 'is-primary'}`} disabled={busy}>{busy ? 'Recording…' : 'Record the decision'}</button></div>}>
        <form id="mp-ut-decide" className="mp-ut-form" onSubmit={decide}>
          {ask?.hide && (
            <label className="st-field"><span className="st-field-label">Ground</span>
              <select className="st-select" name="ground" required defaultValue="G11">{GROUNDS.map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}</select></label>
          )}
          <label className="st-field"><span className="st-field-label">{ask?.hide ? 'Facts (the tester reads these)' : 'Why it shows again'}</span>
            <textarea className="st-textarea" name="facts" rows={4} minLength={ask?.hide ? 40 : 10} required placeholder={ask?.hide ? 'What the test or its name breaks, specifically (at least 40 characters)' : 'What changed'} /></label>
          {err && <Note tone="bad">{err}</Note>}
        </form>
      </Modal>
    </Pane>
  );
}
