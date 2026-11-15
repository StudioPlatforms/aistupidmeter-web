'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Pane, Note, Tag, Pill, Loader, Empty, Stats, Stat, CountUp } from '@/components/studio';

/**
 * Test your keys, the "Listed host" option (Phase 3 plan §7.7, as Phase 4 §6.4 changes it; F7): a test of a model at a
 * host listed on AI Stupid Level, with the tester's own key at that host (their Smart Router connection's, or one pasted
 * for this test), on fresh task versions. The API (GET and POST /router/marketplace/tests) decides what can be tested and
 * when; this pane only shows it. The tester sees their own score at once, never a per-task breakdown (the API sends none).
 * Shown only when the API offers a listing (its switch on, a family covered); otherwise the page is as it was.
 *
 * The tester's choices (the key's source, the test) change only when they change them or pick another listing; the page's
 * reloads keep them (F7 review web SHOULD-6). A test that waits shows no animation and is asked about every 30 s; one that
 * runs, every 5 s, by its own id (SHOULD-2, code-security MINOR-10).
 */

export type LhSuite = 'coding' | 'reasoning' | 'tooling';
export interface LhListing {
  publicId: string; label: string; host: string; path: string | null;
  provider: { slug: string | null; displayName: string; logoUrl: string | null };
  connection: { state: 'usable' | 'confirm_host' | 'paused'; keyHint: string | null } | null;
  /** The tester belongs to this listing's provider: their result shows as an account of the provider, never with a name. */
  asProviderAccount: boolean;
  suites: Array<{ suite: LhSuite; label: string; open: boolean; left: number; startsAt: string | null; usedToday: boolean; estimateUsd: number; runCapUsd: number; apiCalls: number; typicalSeconds: number }>;
}
export interface LhTest {
  id: number; suite: LhSuite; suiteLabel: string; state: 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'interrupted'; score: number | null; why: string | null;
  listing: { publicId: string; label: string; path: string | null; provider: string }; requestedAt: string; finishedAt: string | null; costUsd: number | null;
  showName: boolean; byProviderAccount: boolean; hidden: null | { at: string | null; statement: string };
}
export interface LhData {
  enabled: boolean;
  limits: { perListingSuiteDay: number; perListingSuiteWindow: number; windowHours: number; perTesterSuiteDay: number };
  /** Whether this account may test listed hosts (its age and email confirmation), why not, and the name "Show my name" shows. */
  account: { canTest: boolean; message: string | null; name: string | null;
    /** F6c (F6b web review MINOR-7): why not, as a code; `account_unavailable` is ours and passes (an older API sends none). */
    problem?: 'account_too_new' | 'email_unconfirmed' | 'account_unavailable' | null };
  listings: LhListing[]; tests: LhTest[];
}

function money(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'unknown';
  if (v < 0.01) return '<$0.01';
  return `$${v.toFixed(2)}`;
}
function when(ts: string): string {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
/** "16:00 UTC", or "15 Nov, 00:00 UTC" for another UTC day than today's. */
function utcAt(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return 'later today (UTC)';
  const hm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
  return ts.slice(0, 10) === new Date().toISOString().slice(0, 10) ? hm : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}, ${hm}`;
}
const STATE_WORD: Record<LhTest['state'], string> = { queued: 'Queued', running: 'Running', done: 'Done', failed: 'Failed', cancelled: 'Cancelled', interrupted: 'Interrupted' };
const stateTone = (s: LhTest['state']): 'good' | 'bad' | 'warn' | undefined => (s === 'done' ? 'good' : s === 'failed' ? 'bad' : s === 'cancelled' || s === 'interrupted' ? 'warn' : undefined);
type LhSuiteRow = LhListing['suites'][number];
/** A test the tester can start now: room at the listing in this window and today, and not tested by them today. */
const canStart = (s: LhSuiteRow) => s.left > 0 && !s.usedToday && !s.startsAt;
const firstStartable = (l: LhListing | null | undefined): LhSuite | null => l?.suites.find(canStart)?.suite ?? null;
function suiteWords(s: LhSuiteRow, perDay: number): string {
  if (s.usedToday) return 'You tested this one today.';
  if (s.left <= 0) return 'No tests left today at this listing.';
  if (s.startsAt) return `The next test here can start at ${utcAt(s.startsAt)}.`;
  return `${s.left} of ${perDay} tests left today at this listing`;
}

/** Withdraw one of the account's queued tests (POST tests/withdraw); the updated test, or the API's words. */
async function withdrawTest(id: number): Promise<{ test: LhTest | null; message: string | null }> {
  try {
    const r = await fetch('/api/router/marketplace/tests/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test: id }) });
    const j = await r.json().catch(() => null) as { test?: LhTest; message?: string } | null;
    return r.ok && j?.test ? { test: j.test, message: null } : { test: null, message: j?.message || 'The test could not be withdrawn.' };
  } catch {
    return { test: null, message: 'The test could not be withdrawn. Try again in a moment.' };
  }
}

/** The steps of a test of a listed host: the listing and the key, what to test, the result. */
export function ListedHostTest({ data, reload, preselect }: { data: LhData; reload: () => Promise<LhData | null>; preselect: string | null }) {
  const first = data.listings.find(l => l.publicId === preselect) ?? data.listings[0] ?? null;
  const [listingId, setListingId] = useState<string>(first ? first.publicId : '');
  const listing = data.listings.find(l => l.publicId === listingId) ?? null;
  const canUseConnection = !!listing?.connection && listing.connection.state === 'usable';
  const [source, setSource] = useState<'connection' | 'paste'>(canUseConnection ? 'connection' : 'paste');
  const [apiKey, setApiKey] = useState('');
  const [showName, setShowName] = useState(false);
  const [suite, setSuite] = useState<LhSuite | null>(firstStartable(listing));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<LhTest | null>(null);
  const [wError, setWError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const shownListing = useRef(listingId);

  // Another listing chosen: its own connection and first test that can start. Never on a reload (SHOULD-6).
  useEffect(() => {
    if (shownListing.current === listingId) return;
    shownListing.current = listingId;
    const l = data.listings.find(x => x.publicId === listingId);
    setSource(l?.connection?.state === 'usable' ? 'connection' : 'paste');
    setSuite(firstStartable(l));
    setError(null);
  }, [listingId, data.listings]);
  // A reload keeps the tester's choices; only one that can no longer be used is let go.
  useEffect(() => {
    const l = data.listings.find(x => x.publicId === listingId);
    setSuite(s => (s && l?.suites.some(x => x.suite === s && canStart(x)) ? s : null));
    setSource(src => (src === 'connection' && l?.connection?.state !== 'usable' ? 'paste' : src));
  }, [data.listings, listingId]);

  // The test the tester just started, by its own id: every 30 s while it waits, every 5 s while it runs; once it ends, the
  // page's own numbers (the day's room, the history) are read again.
  const poll = useCallback(async (id: number) => {
    let next: LhTest | null = null; let ok = false;
    try {
      const r = await fetch(`/api/router/marketplace/tests?test=${id}`, { cache: 'no-store' });
      const j = r.ok ? await r.json().catch(() => null) as { test?: LhTest } | null : null;
      next = j?.test ?? null; ok = r.ok;
    } catch { ok = false; }
    if (!alive.current) return;
    if (next) setPending(next);
    if (!ok || !next || next.state === 'queued' || next.state === 'running') {
      timer.current = setTimeout(() => { void poll(id); }, next && next.state === 'running' ? 5000 : 30000);
    } else {
      await reload();
    }
  }, [reload]);
  useEffect(() => () => { alive.current = false; if (timer.current) clearTimeout(timer.current); }, []);

  const chosen = listing?.suites.find(s => s.suite === suite) ?? null;
  const run = async () => {
    if (!listing || !chosen) return;
    if (source === 'paste' && !apiKey.trim()) { setError('Paste your key for this host first.'); return; }
    setSending(true); setError(null); setWError(null); setPending(null);
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    try {
      const r = await fetch('/api/router/marketplace/tests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing: listing.publicId, suite: chosen.suite, source, host: listing.host, showName: showName && !listing.asProviderAccount && !!data.account.name,
          ...(source === 'paste' ? { apiKey } : {}) }),
      });
      const j = await r.json().catch(() => null) as { test?: LhTest; message?: string } | null;
      if (!r.ok || !j?.test) throw new Error(j?.message || 'The test could not be started.');
      const t = j.test;
      setApiKey('');
      setPending(t);
      void reload();
      timer.current = setTimeout(() => { void poll(t.id); }, t.state === 'running' ? 5000 : 30000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'The test could not be started.');
    } finally {
      setSending(false);
    }
  };
  const withdraw = async () => {
    if (!pending) return;
    setWError(null);
    const w = await withdrawTest(pending.id);
    if (!alive.current) return;
    if (w.test) { if (timer.current) { clearTimeout(timer.current); timer.current = null; } setPending(w.test); void reload(); } else setWError(w.message);
  };

  if (!listing) return null;
  const waiting = !!pending && pending.state === 'queued';
  const running = !!pending && pending.state === 'running';
  const none = listing.suites.every(s => !canStart(s));
  const blocked = !data.account.canTest;
  return (
    <>
      <Pane className="sk-lh-step" title={<><span className="sk-n">02</span>Listed host and key</>} delay={0.04}>
        <div className="st-field">
          <label className="st-field-label" htmlFor="sk-lh-listing">Model at a listed host</label>
          <select id="sk-lh-listing" className="st-select sk-field-16" value={listingId} onChange={e => setListingId(e.target.value)}>
            {data.listings.map(l => <option key={l.publicId} value={l.publicId}>{l.provider.displayName} · {l.label}</option>)}
          </select>
          <p className="st-hint">{listing.provider.displayName} · {listing.label}: your key is sent only to {listing.host}, the address this listing gives.</p>
        </div>
        <div className="st-field sk-field-gap" role="radiogroup" aria-label="Which key">
          <span className="st-field-label">Key</span>
          <label className={`st-toggle sk-lh-choice${!canUseConnection ? ' is-off' : ''}`}>
            <input type="radio" className="st-check" name="sk-lh-source" checked={source === 'connection'} disabled={!canUseConnection} onChange={() => setSource('connection')} />
            <span>
              <b>Use my {listing.provider.displayName} key in the Smart Router{listing.connection?.keyHint ? ` (${listing.connection.keyHint})` : ''}</b>
              {!listing.connection && <span>You have none for this host.</span>}
              {listing.connection?.state === 'confirm_host' && <span>Confirm {listing.host} for it on the <Link href="/router/providers">Providers page</Link> first.</span>}
              {listing.connection?.state === 'paused' && <span>Your connection to this host is paused.</span>}
            </span>
          </label>
          <label className="st-toggle sk-lh-choice">
            <input type="radio" className="st-check" name="sk-lh-source" checked={source === 'paste'} onChange={() => setSource('paste')} />
            <span><b>Paste a key for this test</b></span>
          </label>
          {source === 'paste' && (
            <input type="password" className="st-input is-code sk-field-16" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder={`Your ${listing.provider.displayName} key`} autoComplete="off" aria-label={`Your ${listing.provider.displayName} key`} />
          )}
        </div>
        {listing.asProviderAccount ? (
          <p className="st-hint sk-field-gap">You belong to {listing.provider.displayName}: your result shows as an account of {listing.provider.displayName}, apart from the median and never with your name.</p>
        ) : data.account.name ? (
          <label className="st-toggle sk-lh-choice sk-field-gap">
            <input type="checkbox" className="st-check" checked={showName} onChange={e => setShowName(e.target.checked)} />
            <span><b>Show my name, {data.account.name}, with this result</b><span>Otherwise it is counted without your name. You can remove your name later.</span></span>
          </label>
        ) : data.account.problem === 'account_unavailable' ? null : (
          <p className="st-hint sk-field-gap">Your result is counted without a name: your account has none we can show.</p>
        )}
      </Pane>

      <Pane className="sk-lh-step" title={<><span className="sk-n">03</span>What to test</>} sub={`Charged by ${listing.provider.displayName} to your own account there.`}>
        <div className="st-cards sk-suites" role="group" aria-label="Test">
          {listing.suites.map(s => {
            const off = !canStart(s);
            return (
              <button key={s.suite} type="button" aria-pressed={suite === s.suite} disabled={off} onClick={() => setSuite(s.suite)} className={`st-card sk-suite${suite === s.suite ? ' is-on' : ''}`}>
                <span className="st-card-t">{s.label}<span className="st-card-tick" aria-hidden="true" /></span>
                <span className="st-card-d">{suiteWords(s, data.limits.perListingSuiteDay)}</span>
                <span className="sk-suite-tags">
                  <Tag tone={s.estimateUsd > 0.2 ? 'warn' : 'good'}>{money(s.estimateUsd)}</Tag>
                  <Tag>{s.apiCalls} calls</Tag>
                  <Tag>~{Math.round(s.typicalSeconds / 60) || 1} min</Tag>
                </span>
              </button>
            );
          })}
        </div>
        <div className="sk-run">
          <Note title={blocked ? (data.account.problem === 'account_unavailable' ? 'We could not check your account right now' : 'Your account cannot test listed hosts yet') : chosen ? `Estimated ${money(chosen.estimateUsd)} at ${listing.provider.displayName}'s listed prices` : none ? 'No test left at this listing for now (UTC)' : 'Choose a test'}>
            {blocked && <>{data.account.message} </>}
            {chosen && !blocked && <>The test stops if it reaches {money(chosen.runCapUsd)} at those prices. </>}
            One test per listing, suite and UTC day for each tester; for everyone together, one per listing and suite in each {data.limits.windowHours}-hour block of the UTC day
            {' '}(from 00:00, 08:00 and 16:00), so {data.limits.perListingSuiteDay} a day. The same key, address, provider account or workspace counts as one tester.
            {' '}Your test counts from the moment you start it, even if the host refuses the key; one you withdraw or we cancel before it runs, or that ends on our side, does not.
          </Note>
          {error && <Note tone="bad">{error}</Note>}
          <button type="button" onClick={run} disabled={blocked || sending || waiting || running || !chosen || (source === 'paste' && !apiKey.trim())} className="st-btn is-primary is-lg is-block">
            {sending ? 'Starting…' : chosen ? `Run ${chosen.label.toLowerCase()} test` : 'Run test'}
          </button>
        </div>
      </Pane>

      {pending && (
        <Pane title={<>Result <span className="sk-title-meta">· {pending.listing.provider} · {pending.listing.label}</span></>}
          actions={<Pill tone={stateTone(pending.state)}>{STATE_WORD[pending.state]}</Pill>} ruled>
          <div className="sk-result">
            {waiting ? (
              <div className="sk-lh-wait">
                <p className="st-hint">It starts when a test slot is free, within 6 hours; if it cannot start by then it is cancelled and does not count. You can leave this page: the result appears under &ldquo;Your tests of listed hosts&rdquo;.</p>
                {wError && <Note tone="bad">{wError}</Note>}
                <button type="button" className="st-btn is-sm" onClick={withdraw}>Withdraw this test</button>
              </div>
            ) : running ? <Loader label="Running. This can take a few minutes." /> : (
              <>
                {pending.why && <Note tone={pending.state === 'failed' ? 'bad' : undefined}>{pending.why}</Note>}
                <Stats columns={2} reveal={false}>
                  <Stat value={pending.score != null ? <CountUp value={pending.score} /> : '—'} label="Your score" tone="accent" sub={pending.suiteLabel} />
                  <Stat value={money(pending.costUsd)} label="At the listed prices" sub="your host bills you at your own prices" />
                </Stats>
                <p className="st-hint">Tests of listed hosts run on fresh task versions, a new copy of each task for every test, so no per-task detail is shown.</p>
              </>
            )}
          </div>
        </Pane>
      )}
    </>
  );
}

/** The account's tests of listed hosts: state and score, a moderation decision's statement, "remove my name", withdrawing a queued test. */
export function ListedHostHistory({ tests, onChanged }: { tests: LhTest[]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const named = tests.some(t => t.showName);
  const removeName = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/router/marketplace/tests/name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ showName: false }) });
      if (!r.ok) throw new Error('not removed');
      setMsg('Your name no longer shows with any of your tests.');
      onChanged();
    } catch {
      setMsg('Your name could not be removed. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async (id: number) => {
    setBusy(true); setMsg(null);
    const w = await withdrawTest(id);
    setBusy(false);
    if (w.test) onChanged(); else setMsg(w.message);
  };
  return (
    <Pane className="sk-lh-hist" title="Your tests of listed hosts" actions={named ? <button type="button" className="st-btn is-sm" disabled={busy} onClick={removeName}>Stop showing my name</button> : <Tag>{tests.length} test{tests.length === 1 ? '' : 's'}</Tag>}
      ruled flush delay={0.04}>
      {msg && <div className="sk-pad"><Note>{msg}</Note></div>}
      {tests.length === 0 ? <div className="sk-pad"><Empty title="No tests yet" /></div> : (
        <div className="st-table-wrap">
          <table className="st-table is-stack sk-history">
            <thead><tr><th>When</th><th>Host</th><th>Test</th><th>State</th><th className="is-num">Score</th><th className="is-num">Cost</th></tr></thead>
            <tbody>
              {tests.map(t => (
                <tr key={t.id}>
                  <td className="is-head sk-when">{when(t.requestedAt)}</td>
                  <td data-label="Host">{t.listing.provider} <span className="st-faint">· {t.listing.label}</span></td>
                  <td data-label="Test"><Tag>{t.suiteLabel}</Tag></td>
                  <td data-label="State">
                    <Tag tone={stateTone(t.state)}>{STATE_WORD[t.state]}</Tag>
                    {t.why && t.state !== 'done' && <span className="sk-lh-why">{t.why}</span>}
                    {t.hidden && <span className="sk-lh-hidden"><b>Hidden from the public rows.</b> {t.hidden.statement} <Link href="/contact">Ask for a review</Link></span>}
                    {t.state === 'queued' && <span className="sk-lh-act"><button type="button" className="st-btn is-sm" disabled={busy} onClick={() => { void withdraw(t.id); }}>Withdraw</button></span>}
                  </td>
                  <td data-label="Score" className="is-num">{t.score != null ? <b>{Math.round(t.score)}</b> : '—'}</td>
                  <td data-label="Cost" className="is-num">{money(t.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Pane>
  );
}
