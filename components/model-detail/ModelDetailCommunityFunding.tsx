'use client';

/**
 * Community-funded reasoning and tool-use runs (API: routes/community-runs.ts,
 * lib/community-runs.ts).
 *
 * For a model whose reasoning and tool-use tests we no longer run at our own expense, this page:
 *   1. says so, plainly, in a card near the top (always);
 *   2. explains it once in a pop-up (remembered per model in the visitor's browser);
 *   3. lets a signed-in visitor pay for TODAY's run with their own API key.
 *
 * A funded run is our scheduled test, unchanged, billed to their key, and is published like any
 * other run. One slot per test per day. The key goes to our server once, is used only for that
 * run, and is never stored — the card says exactly what happens to it rather than just "safe".
 */

import { useCallback, useEffect, useState } from 'react';

type Suite = 'deep' | 'tooling';
interface Estimate { usd: number | null; min: number | null; max: number | null; runs: number; capUsd: number }
interface Slot {
  suite: Suite;
  label: string;
  state: 'open' | 'queued' | 'running' | 'completed';
  run?: { creditName: string | null; score: number | null; finishedAt: string | null };
  estimate: Estimate;
}
interface State {
  communitySuites: Suite[];
  slotDate: string;
  nextSlotOpensAt: string;
  slots: Slot[];
  recent: Array<{ suite: Suite; slotDate: string; creditName: string | null; score: number | null }>;
}
interface MyRun {
  id: number; modelId: number; suite: Suite; status: string; estimateUsd: number | null; capUsd: number | null;
  costUsd: number | null; score: number | null; error: string | null; queuePosition: number | null;
}

const SUITE_NAME: Record<Suite, string> = { deep: 'Reasoning', tooling: 'Tool use' };
const SUITE_WHAT: Record<Suite, string> = {
  deep: 'four multi-turn sessions, code run against tests',
  tooling: 'nine agentic tasks in a sandbox',
};
const VENDOR_NAME: Record<string, string> = {
  anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', deepseek: 'DeepSeek', kimi: 'Moonshot', glm: 'Z.ai', xai: 'xAI',
};
const usd = (v: number | null | undefined) => (v == null ? '—' : v < 0.1 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`);

export default function ModelDetailCommunityFunding({
  modelId,
  modelName,
  vendor,
  signedIn,
}: {
  modelId: number;
  modelName: string;
  vendor: string;
  signedIn: boolean;
}) {
  const [state, setState] = useState<State | null>(null);
  const [introOpen, setIntroOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/community-runs/model/${modelId}`, { cache: 'no-store' });
      const j = await r.json();
      if (j?.success) setState(j.data);
    } catch { /* the notice is supplementary — never block the page */ }
  }, [modelId]);

  useEffect(() => { load(); }, [load]);

  // The one-time explanation, per model, remembered in this browser.
  const seenKey = `stupidmeter-community-seen:${modelId}`;
  useEffect(() => {
    if (!state?.communitySuites?.length) return;
    let seen = false;
    try { seen = localStorage.getItem(seenKey) === 'true'; } catch { /* private mode: show it */ }
    if (seen) return;
    const t = setTimeout(() => setIntroOpen(true), 700);
    return () => clearTimeout(t);
  }, [state, seenKey]);
  const closeIntro = () => {
    try { localStorage.setItem(seenKey, 'true'); } catch { /* ignore */ }
    setIntroOpen(false);
  };

  if (!state || !state.communitySuites.length) return null;
  const open = state.slots.filter(s => s.state === 'open');
  const suitesText = state.slots.map(s => SUITE_NAME[s.suite].toLowerCase()).join(' and ');

  return (
    <>
      <div className="md-chart-section md-cf-card">
        <div className="md-cf-head">
          <span className="md-cf-badge">Community-funded</span>
          <div className="md-cf-title">{capitalise(suitesText)} tests for this model are funded by the community</div>
        </div>
        <p className="md-cf-text">
          We no longer run {suitesText} tests for {modelName} at our own expense. We still test its coding every
          four hours and watch it for drift every hour. Anyone can pay for today&apos;s run with their own{' '}
          {VENDOR_NAME[vendor] || vendor} API key — it is the same test we run for every model, and the result is published here.
        </p>
        <div className="md-cf-slots">
          {state.slots.map(s => (
            <div key={s.suite} className="md-cf-slot">
              <div className="md-cf-slot-name">{SUITE_NAME[s.suite]}</div>
              <div className="md-cf-slot-state">
                {s.state === 'open' && <>Today&apos;s run is open · about {usd(s.estimate.usd)}</>}
                {s.state === 'queued' && <>Funded today{s.run?.creditName ? ` by ${s.run.creditName}` : ''} · waiting to start</>}
                {s.state === 'running' && <>Funded today{s.run?.creditName ? ` by ${s.run.creditName}` : ''} · running now</>}
                {s.state === 'completed' && <>Funded today{s.run?.creditName ? ` by ${s.run.creditName}` : ''} · scored {s.run?.score != null ? Math.round(s.run.score) : '—'}</>}
              </div>
            </div>
          ))}
        </div>
        <div className="md-cf-actions">
          {open.length > 0 ? (
            <button className="pro-modal-btn primary md-cf-btn" onClick={() => setFundOpen(true)}>Fund today&apos;s run</button>
          ) : (
            <span className="md-cf-muted">Today&apos;s runs are funded — thank you. The next slot opens at 00:00 UTC.</span>
          )}
          {state.recent.length > 0 && (
            <span className="md-cf-muted">{state.recent.length} funded run{state.recent.length === 1 ? '' : 's'} in the last 14 days</span>
          )}
        </div>
      </div>

      {introOpen && (
        <div className="pro-modal md-cf-overlay" onClick={closeIntro}>
          <div className="pro-modal-card md-cf-intro" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="md-cf-intro-title">
            <button className="pro-modal-close" onClick={closeIntro} aria-label="Close">×</button>
            <span className="pro-modal-badge">Community-funded</span>
            <div className="pro-modal-title" id="md-cf-intro-title">We have stopped paying for {suitesText} tests on {modelName}</div>
            <ul className="pro-modal-features md-cf-points">
              <li><span className="pro-modal-check">✓</span><span>We still test its <b>coding every four hours</b> and watch it for <b>drift every hour</b>.</span></li>
              <li><span className="pro-modal-check">✓</span><span>Its {suitesText} tests are now <b>funded by the community</b>: one run per test per day, paid for with the funder&apos;s own API key.</span></li>
              <li><span className="pro-modal-check">✓</span><span>A funded run is exactly the test we run for every other model, and its result is published on this page.</span></li>
            </ul>
            <div className="pro-modal-actions md-cf-buttons">
              {open.length > 0 && (
                <button className="pro-modal-btn primary" onClick={() => { closeIntro(); setFundOpen(true); }}>Fund today&apos;s run</button>
              )}
              <button className="pro-modal-btn ghost" onClick={closeIntro}>Not now</button>
            </div>
          </div>
        </div>
      )}

      {fundOpen && (
        <FundDialog
          modelId={modelId}
          modelName={modelName}
          vendor={vendor}
          signedIn={signedIn}
          slots={state.slots}
          onClose={() => { setFundOpen(false); load(); }}
        />
      )}
    </>
  );
}

function capitalise(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function FundDialog({
  modelId, modelName, vendor, signedIn, slots, onClose,
}: {
  modelId: number; modelName: string; vendor: string; signedIn: boolean; slots: Slot[]; onClose: () => void;
}) {
  const openSlots = slots.filter(s => s.state === 'open');
  const [chosen, setChosen] = useState<Suite[]>(openSlots.map(s => s.suite));
  const [apiKey, setApiKey] = useState('');
  const [credit, setCredit] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<number[] | null>(null);
  const [mine, setMine] = useState<MyRun[]>([]);
  const vendorName = VENDOR_NAME[vendor] || vendor;

  const picked = openSlots.filter(s => chosen.includes(s.suite));
  const estimate = picked.reduce((a, s) => a + (s.estimate.usd ?? 0), 0);
  const cap = picked.reduce((a, s) => a + s.estimate.capUsd, 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  // After submitting: follow the user's own runs until they finish.
  useEffect(() => {
    if (!submitted) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch('/api/community-runs/mine', { cache: 'no-store' });
        const j = await r.json();
        if (!stop && j?.success) setMine((j.data as MyRun[]).filter(x => submitted.includes(x.id)));
      } catch { /* keep polling */ }
    };
    tick();
    const t = setInterval(tick, 15_000);
    return () => { stop = true; clearInterval(t); };
  }, [submitted]);

  const submit = async () => {
    setError(null);
    if (!picked.length) return setError('Choose at least one test.');
    if (!apiKey.trim()) return setError(`Paste your ${vendorName} API key.`);
    if (!consent) return setError('Please confirm the cost first.');
    setBusy(true);
    try {
      const r = await fetch('/api/community-runs/fund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-api-key': apiKey.trim() },
        body: JSON.stringify({ modelId, suites: picked.map(s => s.suite), consent: true, creditName: credit.trim() || null }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.success) {
        setError(j?.error || 'Something went wrong. Nothing was run.');
        return;
      }
      setSubmitted((j.data.runs as Array<{ id: number }>).map(x => x.id));
    } catch {
      setError('Could not reach the server. Nothing was run.');
    } finally {
      setApiKey('');   // never keep the key in the page once it has been sent (or refused)
      setBusy(false);
    }
  };

  const toggle = (s: Suite) => setChosen(c => (c.includes(s) ? c.filter(x => x !== s) : [...c, s]));

  return (
    <div className="pro-modal md-cf-overlay" onClick={() => { if (!busy) onClose(); }}>
      <div className={`pro-modal-card md-cf-dialog${submitted || !signedIn ? ' md-cf-dialog--narrow' : ''}`} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="md-cf-fund-title">
        <button className="pro-modal-close" onClick={onClose} aria-label="Close" disabled={busy}>×</button>
        <span className="pro-modal-badge">Community-funded</span>
        <div className="pro-modal-title" id="md-cf-fund-title">Fund today&apos;s {modelName} run</div>

        {submitted ? (
          <>
            <p className="pro-modal-sub">
              Thank you. Your run is queued. It starts as soon as the server is free — never during our nightly
              runs — and takes up to about an hour. Results appear on this page. You can close this window;
              your key is not needed again and is discarded when the run ends.
            </p>
            <div className="md-cf-status">
              {mine.map(r => (
                <div key={r.id} className="md-cf-status-row">
                  <b>{SUITE_NAME[r.suite]}</b>
                  <span>
                    {r.status === 'queued' && `Waiting${r.queuePosition ? ` · position ${r.queuePosition} in line` : ''}`}
                    {r.status === 'running' && 'Running now'}
                    {r.status === 'completed' && `Done · scored ${r.score != null ? Math.round(r.score) : '—'} · cost ${usd(r.costUsd)}`}
                    {(r.status === 'failed' || r.status === 'interrupted') && `Not published · ${r.error || 'the run did not finish'}${r.costUsd ? ` · cost ${usd(r.costUsd)}` : ''}`}
                  </span>
                </div>
              ))}
            </div>
            <div className="pro-modal-actions md-cf-buttons">
              <button className="pro-modal-btn ghost" onClick={onClose}>Close</button>
            </div>
          </>
        ) : !signedIn ? (
          <>
            <p className="pro-modal-sub">
              Please sign in first. Funding is limited to one run per test per day, and an account lets us
              show you your run&apos;s progress and result.
            </p>
            <div className="pro-modal-actions md-cf-buttons">
              <a className="pro-modal-btn primary md-cf-link" href={`/auth/signin?callbackUrl=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : `/models/${modelId}`)}`}>Sign in</a>
              <button className="pro-modal-btn ghost" onClick={onClose}>Not now</button>
            </div>
          </>
        ) : (
          <>
            <p className="pro-modal-sub">
              This runs our standard test for {modelName} on your {vendorName} account. The result is published
              on this page as today&apos;s measurement.
            </p>

            <div className="md-cf-grid">
              <section className="md-cf-col" aria-labelledby="md-cf-step1">
                <div className="md-cf-step" id="md-cf-step1"><span>1</span>Choose what to run</div>
                <div className="md-cf-choices">
                  {openSlots.map(s => (
                    <label key={s.suite} className={`md-cf-choice${chosen.includes(s.suite) ? ' is-on' : ''}`}>
                      <input type="checkbox" checked={chosen.includes(s.suite)} onChange={() => toggle(s.suite)} disabled={busy} />
                      <span className="md-cf-choice-body">
                        <span className="md-cf-choice-top"><b>{SUITE_NAME[s.suite]}</b><b className="md-cf-choice-price">≈ {usd(s.estimate.usd)}</b></span>
                        <span className="md-cf-muted">{capitalise(SUITE_WHAT[s.suite])}</span>
                        <span className="md-cf-choice-cost">
                          {s.estimate.runs > 1 && s.estimate.min != null && s.estimate.max != null
                            ? <>Last {s.estimate.runs} runs cost {usd(s.estimate.min)}–{usd(s.estimate.max)} · </>
                            : null}
                          stopped if it reaches {usd(s.estimate.capUsd)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="md-cf-total">
                  <span>Estimated total</span>
                  <b>{usd(estimate)}</b>
                  <span className="md-cf-muted">never more than {usd(cap)}</span>
                </div>
              </section>

              <section className="md-cf-col" aria-labelledby="md-cf-step2">
                <div className="md-cf-step" id="md-cf-step2"><span>2</span>Your {vendorName} API key</div>
                <label className="md-cf-field">
                  <span className="md-cf-sr">{vendorName} API key</span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={vendor === 'anthropic' ? 'sk-ant-…' : vendor === 'openai' ? 'sk-…' : 'API key'}
                    disabled={busy}
                  />
                </label>
                <div className="md-cf-safety">
                  <div className="md-cf-safety-title">What happens to your key</div>
                  <ul>
                    <li>Sent once, encrypted, and used only for the test{picked.length > 1 ? 's' : ''} you choose here, today.</li>
                    <li>Only ever sent to {vendorName}. Never written to our database, files or logs; discarded when the run ends.</li>
                    <li>Checked first with one tiny request. If it does not work, nothing runs.</li>
                    <li>Safest: create a new key just for this, give it a spending limit in your {vendorName} console, and delete it afterwards.</li>
                  </ul>
                </div>
                <label className="md-cf-field">
                  <span>Name to show as the funder <span className="md-cf-muted">(optional)</span></span>
                  <input type="text" value={credit} onChange={e => setCredit(e.target.value.slice(0, 40))} maxLength={40} placeholder="Leave empty to stay anonymous" disabled={busy} />
                </label>
              </section>
            </div>

            <div className="md-cf-footer">
              <label className="md-cf-consent">
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={busy} />
                <span>
                  I agree that ASL may use this key to run the selected test{picked.length > 1 ? 's' : ''} once today, costing
                  about <b>{usd(estimate)}</b> at {vendorName}&apos;s list prices and never more than <b>{usd(cap)}</b>. The cost
                  is charged by {vendorName} to my account, including for a run that does not finish.
                </span>
              </label>
              {error && <div className="md-cf-error" role="alert">{error}</div>}
              <div className="pro-modal-actions md-cf-buttons">
                <button className="pro-modal-btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
                <button className="pro-modal-btn primary" onClick={submit} disabled={busy || !picked.length}>
                  {busy ? 'Checking your key…' : `Fund ${picked.length > 1 ? 'both runs' : 'this run'}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
