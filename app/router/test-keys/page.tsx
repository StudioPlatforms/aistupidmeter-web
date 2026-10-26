'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import { PageHead, Pane, Stats, Stat, CountUp, Loader, Empty, Note, Tag, Pill, ProviderMark } from '@/components/studio';
import '@/styles/studio-keys.css';

/**
 * Test your keys.
 *
 * Rebuilt 2026-09-11. The previous version was left behind by the clean redesign (17
 * retro vintage and terminal classes against 0 on every other router page), offered only "QUICK
 * CHAT TEST" and "FULL BENCHMARK" — the latter being the coding suite alone, a third of
 * what the leaderboard reports — spent up to 50 billable calls on the user's key with no
 * price shown anywhere, and wrote its result into the public `scores` table.
 */

type Provider = 'openai' | 'anthropic' | 'xai' | 'google' | 'glm' | 'deepseek' | 'kimi';
type Suite = 'connectivity' | 'coding' | 'reasoning' | 'tooling';

interface CostEstimate {
  suite: Suite;
  label: string;
  description: string;
  apiCalls: number;
  typicalSeconds: number;
  estimatedUsd: number | null;
  estimatedRangeUsd: [number, number] | null;
  basis: 'measured' | 'typical' | 'unpriced';
  notes: string[];
}

interface TestRun {
  success: boolean;
  suite: Suite;
  score: number | null;
  axes: Record<string, number> | null;
  latencyMs: number;
  avgLatencyMs: number;
  tokensIn: number;
  tokensOut: number;
  apiCalls: number;
  tasksTotal: number | null;
  tasksPassed: number | null;
  estCostUsd: number | null;
  referenceScore?: number | null;
  /** What the reference number is — e.g. the same reasoning scenario, not the four-task mean. */
  referenceBasis?: string | null;
  error?: string;
  breakdown?: Array<{ label: string; passed: boolean; detail?: string; latencyMs?: number }>;
}

interface HistoryRow {
  id: number;
  provider: string;
  model_name: string;
  suite: Suite;
  ts: string;
  success: boolean;
  score: number | null;
  est_cost_usd: number | null;
  reference_score: number | null;
  tasks_passed: number | null;
  tasks_total: number | null;
  avg_latency_ms: number | null;
  error: string | null;
}

// Kept current deliberately: the old copy still advertised GPT-4o/o3, Gemini 2.5,
// GLM-4.6, DeepSeek R1 and Kimi K2, several generations behind what is benchmarked.
const PROVIDERS: { id: Provider; name: string; description: string }[] = [
  { id: 'openai',    name: 'OpenAI',    description: 'GPT-6.1 Sol, GPT-6 Astra / Sol / Luna, GPT-5.6 Sol / Terra / Luna, GPT-5.5' },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude Opus 5, Sonnet 5, Fable 5.1' },
  { id: 'google',    name: 'Google',    description: 'Gemini 3.8 Flash, 3.1 Pro, 3.5 Flash-Lite' },
  { id: 'deepseek',  name: 'DeepSeek',  description: 'DeepSeek V4 Pro and V4.1 Flash' },
  { id: 'kimi',      name: 'Kimi',      description: 'Kimi K3.1 Pro' },
  { id: 'glm',       name: 'GLM',       description: 'GLM-5.3' },
];

const SUITE_ORDER: Suite[] = ['connectivity', 'coding', 'reasoning', 'tooling'];

function money(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'unknown';
  if (v < 0.01) return `<$0.01`;
  return `$${v.toFixed(2)}`;
}

function when(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** "codeQuality" → "Code quality". */
function axisLabel(key: string): string {
  const words = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A pane title with the landing's step numeral in front. */
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return <><span className="sk-n">{String(n).padStart(2, '0')}</span>{children}</>;
}

export default function TestKeysPage() {
  const { status } = useSession();
  const [provider, setProvider] = useState<Provider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [suite, setSuite] = useState<Suite>('connectivity');
  const [estimates, setEstimates] = useState<CostEstimate[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TestRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch('/api/test-adapters/history');
      if (r.ok) setHistory((await r.json()).tests || []);
    } catch { /* history is a nice-to-have, never blocks a test */ }
  }, []);

  useEffect(() => { if (status === 'authenticated') loadHistory(); }, [status, loadHistory]);

  // Refresh the price the moment the model changes — the user should never have to click
  // to find out what a run will cost them.
  useEffect(() => {
    if (!model) { setEstimates([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/test-adapters/estimate?provider=${provider}&model=${encodeURIComponent(model)}`);
        if (r.ok && !cancelled) setEstimates((await r.json()).estimates || []);
      } catch { /* the UI falls back to "unknown", never to "free" */ }
    })();
    return () => { cancelled = true; };
  }, [provider, model]);

  const discover = async () => {
    if (!apiKey.trim()) { setError('Enter your API key first.'); return; }
    setDiscovering(true); setError(null); setModels([]);
    try {
      const r = await fetch(`/api/test-adapters/discovery?provider=${provider}`, {
        headers: { 'x-user-api-key': apiKey },
      });
      const data = await r.json();
      const res = data?.results?.[provider];
      if (!r.ok || !res?.success) throw new Error(res?.error || data?.error || 'Could not list models with that key.');
      setModels(res.models || []);
      if (res.models?.length) setModel(res.models[0]);
    } catch (e: any) {
      setError(e?.message || 'Model discovery failed.');
    } finally {
      setDiscovering(false);
    }
  };

  const run = async () => {
    if (!apiKey.trim() || !model) return;
    setRunning(true); setError(null); setResult(null);
    try {
      const r = await fetch('/api/test-adapters/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-api-key': apiKey },
        body: JSON.stringify({ provider, model, suite }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'The test could not be completed.');
      setResult(data);
      loadHistory();
    } catch (e: any) {
      setError(e?.message || 'The test could not be completed.');
    } finally {
      setRunning(false);
    }
  };

  const chosen = estimates.find(e => e.suite === suite);
  const modelHistory = history.filter(h => h.model_name === model);
  const providerName = PROVIDERS.find(p => p.id === provider)?.name;

  if (status === 'loading') {
    return (
      <RouterLayout>
        <Loader label="Loading" minHeight={320} />
      </RouterLayout>
    );
  }

  const hasAxes = !!result?.axes;
  const hasBreakdown = !!result?.breakdown && result.breakdown.length > 0;

  return (
    <RouterLayout>
      <PageHead
        kicker="Smart Router"
        title="Test your keys"
        lead="Run the same benchmarks behind the public leaderboard against your own API key, and see how your access compares to ours."
      />

      <div className="st-body">
        <Note title="Your key is never stored, and your results stay yours">
          The key is used for this run and discarded. Results are saved to your account only — they never
          change a public ranking. Your provider bills you directly for whatever the test uses.
        </Note>

        {error && <Note tone="bad">{error}</Note>}

        {/* ── 1. Provider ─────────────────────────────────────────────── */}
        <Pane title={<Step n={1}>Provider</Step>} delay={0.04}>
          <div className="st-cards sk-picker" role="group" aria-label="Provider">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                type="button"
                aria-pressed={provider === p.id}
                onClick={() => { setProvider(p.id); setModels([]); setModel(''); setResult(null); }}
                className={`st-card${provider === p.id ? ' is-on' : ''}`}
              >
                <span className="st-card-t">
                  <ProviderMark provider={p.id} />
                  {p.name}
                  <span className="st-card-tick" aria-hidden="true" />
                </span>
                <span className="st-card-d">{p.description}</span>
              </button>
            ))}
          </div>
        </Pane>

        {/* ── 2. Key + model ──────────────────────────────────────────── */}
        <Pane title={<Step n={2}>Your API key</Step>} delay={0.04}>
          <div className="st-field">
            <label className="st-field-label" htmlFor="sk-test-key">{providerName} API key</label>
            <div className="sk-key-row">
              <input
                id="sk-test-key"
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Paste your key"
                className="st-input is-code sk-field-16"
                autoComplete="off"
              />
              <button type="button" onClick={discover} disabled={!apiKey.trim() || discovering} className="st-btn">
                {discovering ? 'Checking…' : 'Find my models'}
              </button>
            </div>
            <p className="st-hint">Sent once, used for this test, never written to disk.</p>
          </div>

          {models.length > 0 && (
            <div className="st-field sk-field-gap">
              <label className="st-field-label" htmlFor="sk-test-model">
                Model <small>{models.length} available on this key</small>
              </label>
              <select
                id="sk-test-model"
                value={model}
                onChange={e => { setModel(e.target.value); setResult(null); }}
                className="st-select is-code sk-field-16"
              >
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
        </Pane>

        {/* ── 3. What to test, with the price up front ────────────────── */}
        {model && (
          <Pane title={<Step n={3}>What to test</Step>} sub="Costs are charged by your provider, not by us.">
            <div className="st-cards sk-suites" role="group" aria-label="Test">
              {SUITE_ORDER.map(s => {
                const est = estimates.find(e => e.suite === s);
                const priceTone = !est || est.estimatedUsd === null ? undefined : est.estimatedUsd > 0.2 ? 'warn' : 'good';
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={suite === s}
                    onClick={() => setSuite(s)}
                    className={`st-card sk-suite${suite === s ? ' is-on' : ''}`}
                  >
                    <span className="st-card-t">{est?.label ?? s}<span className="st-card-tick" aria-hidden="true" /></span>
                    <span className="st-card-d">{est?.description ?? ''}</span>
                    <span className="sk-suite-tags">
                      <Tag tone={priceTone}>{est ? money(est.estimatedUsd) : '—'}</Tag>
                      <Tag>{est?.apiCalls ?? '—'} calls</Tag>
                      <Tag>~{est ? Math.round(est.typicalSeconds / 60) || 1 : '—'} min</Tag>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="sk-run">
              {chosen && (
                <Note
                  title={
                    <>
                      Estimated {money(chosen.estimatedUsd)}
                      {chosen.estimatedRangeUsd && ` (typically ${money(chosen.estimatedRangeUsd[0])}–${money(chosen.estimatedRangeUsd[1])})`}
                      {chosen.basis === 'measured' && ' · based on this model’s real usage'}
                      {/* The old copy here said "we have not benchmarked this model", which was
                          untrue for nearly every model on the list — a fallback only means we
                          have no token count for THIS suite on THIS model, usually because the
                          suite is a connectivity ping we do not record usage for. */}
                      {chosen.basis === 'typical' && ' · typical usage across the models we run'}
                    </>
                  }
                >
                  {chosen.notes.join(' ')}
                </Note>
              )}

              <button
                type="button"
                onClick={run}
                disabled={running || !apiKey.trim() || !model}
                className="st-btn is-primary is-lg is-block"
              >
                {running ? `Running ${chosen?.label ?? ''} test…` : `Run ${chosen?.label ?? ''} test`}
              </button>
              {running && <Loader label="This can take a few minutes. Leave the tab open." />}
            </div>
          </Pane>
        )}

        {/* ── 4. Result, against our published number ─────────────────── */}
        {result && (
          <Pane
            title={<>Result <span className="sk-title-meta">· {model}</span></>}
            actions={<Pill tone={result.success ? 'good' : 'bad'}>{result.success ? 'Completed' : 'Failed'}</Pill>}
            ruled
          >
            <div className="sk-result">
              {result.error && <Note tone="bad">{result.error}</Note>}

              <Stats columns={4} reveal={false}>
                <Stat
                  value={result.score != null ? <CountUp value={result.score} /> : '—'}
                  label="Your score"
                  tone="accent"
                  sub={result.tasksPassed !== null && result.tasksTotal !== null
                    ? `${result.tasksPassed} of ${result.tasksTotal} passed`
                    : 'connectivity check'}
                />
                <Stat
                  value={result.referenceScore != null ? Math.round(result.referenceScore) : '—'}
                  label="Our published score"
                  sub={
                    <>
                      {result.referenceBasis && <span className="sk-basis" title={result.referenceBasis}>{result.referenceBasis}</span>}
                      <span className="sk-delta">
                        {result.referenceScore != null && result.score != null
                          ? `${result.score >= result.referenceScore ? '+' : ''}${Math.round(result.score - result.referenceScore)} vs ours`
                          : 'no comparable public score'}
                      </span>
                    </>
                  }
                />
                <Stat
                  value={money(result.estCostUsd)}
                  label="What it cost you"
                  sub={`${result.apiCalls} calls · ${(result.tokensIn + result.tokensOut).toLocaleString()} tokens`}
                />
                <Stat
                  value={result.avgLatencyMs ? (result.avgLatencyMs / 1000).toFixed(1) : '—'}
                  unit={result.avgLatencyMs ? 's' : undefined}
                  label="Avg latency"
                  sub={`${(result.latencyMs / 1000).toFixed(0)}s total`}
                />
              </Stats>

              {result.referenceScore != null && result.score != null && Math.abs(result.score - result.referenceScore) >= 8 && (
                <Note title="Why your number can differ from ours">
                  Both are scored by the same code, on the same version of the test. Yours is one run on your
                  key; ours is our latest scheduled run, which for coding makes seven attempts per task where
                  yours makes one. Rate limits, account tier and ordinary run-to-run variance all move a single sample.
                </Note>
              )}

              {(hasAxes || hasBreakdown) && (
                <div className={`sk-result-grid${hasAxes && hasBreakdown ? '' : ' is-one'}`}>
                  {result.axes && (
                    <div>
                      <p className="st-label">Per-axis breakdown</p>
                      <div className="sk-axes">
                        {Object.entries(result.axes).map(([k, v], i) => (
                          <div key={k} style={{ ['--d' as string]: `${i * 0.05}s` }}>
                            <div className="sk-axis-top"><span>{axisLabel(k)}</span><b>{Math.round(v * 100)}%</b></div>
                            <div className="st-meter"><i style={{ width: `${Math.min(100, v * 100)}%` }} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasBreakdown && (
                    <div>
                      <p className="st-label">Tasks</p>
                      <div className="sk-sub">
                        <div className="st-table-wrap">
                          <table className="st-table is-stack sk-tasks">
                            <thead><tr><th>Task</th><th>Result</th><th>Detail</th><th className="is-num">Time</th></tr></thead>
                            <tbody>
                              {result.breakdown!.map((b, i) => (
                                <tr key={i}>
                                  <td className="is-head"><span className="sk-task">{b.label}</span></td>
                                  <td data-label="Result"><Tag tone={b.passed ? 'good' : 'bad'}>{b.passed ? 'Pass' : 'Fail'}</Tag></td>
                                  <td data-label="Detail" className="is-dim">{b.detail || '—'}</td>
                                  <td data-label="Time" className="is-num">{b.latencyMs ? `${(b.latencyMs / 1000).toFixed(1)}s` : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Pane>
        )}

        {/* ── 5. History ──────────────────────────────────────────────────
            Always flush, so the pane's class never changes after it has faded in (a changed
            className would drop the reveal's is-in and hide the pane again). */}
        <Pane
          title="Your test history"
          actions={history.length > 0 && <Tag>{history.length} runs</Tag>}
          ruled={history.length > 0}
          flush
          delay={0.04}
        >
          {history.length === 0 ? (
            <div className="sk-pad">
              <Empty title="No tests yet">
                Run one above and it will appear here, with what it scored and what it cost.
              </Empty>
            </div>
          ) : (
            <>
              {model && modelHistory.length > 1 && (
                <p className="sk-history-note">
                  You have tested <strong>{model}</strong> {modelHistory.length} times — scores{' '}
                  {modelHistory.filter(h => h.score != null).map(h => Math.round(h.score!)).join(', ')}.
                </p>
              )}
              <div className="st-table-wrap">
                <table className="st-table is-stack sk-history">
                  <thead>
                    <tr>
                      <th>When</th><th>Model</th><th>Test</th>
                      <th className="is-num">Score</th>
                      <th className="is-num">vs ours</th>
                      <th className="is-num">Cost</th>
                      <th className="is-num">Avg latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => {
                      const delta = h.score != null && h.reference_score != null ? h.score - h.reference_score : null;
                      return (
                        <tr key={h.id}>
                          <td className="is-head sk-when">{when(h.ts)}</td>
                          <td data-label="Model" className="is-code is-model">{h.model_name}</td>
                          <td data-label="Test"><Tag>{h.suite}</Tag></td>
                          <td data-label="Score" className="is-num">
                            {h.success ? (h.score != null ? <b>{Math.round(h.score)}</b> : <Tag tone="good">Passed</Tag>)
                              : <Tag tone="bad" title={h.error || ''}>Failed</Tag>}
                          </td>
                          <td data-label="vs ours" className="is-num">
                            {delta === null ? '—' : (
                              <Tag tone={delta >= 0 ? 'good' : 'warn'}>{delta >= 0 ? '+' : ''}{Math.round(delta)}</Tag>
                            )}
                          </td>
                          <td data-label="Cost" className="is-num">{money(h.est_cost_usd)}</td>
                          <td data-label="Avg latency" className="is-num">{h.avg_latency_ms ? `${(h.avg_latency_ms / 1000).toFixed(1)}s` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Pane>
      </div>
    </RouterLayout>
  );
}
