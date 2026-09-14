'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import ProviderLogo from '@/components/ProviderLogo';

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
  { id: 'openai',    name: 'OpenAI',    description: 'GPT-6 Astra, GPT-5.6 Sol / Terra / Luna, GPT-5.5' },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude Opus 5, Sonnet 5, Fable 5.1' },
  { id: 'google',    name: 'Google',    description: 'Gemini 3.8 Flash, 3.1 Pro, 3.5 Flash-Lite' },
  { id: 'deepseek',  name: 'DeepSeek',  description: 'DeepSeek V4 Pro and V4 Flash' },
  { id: 'kimi',      name: 'Kimi',      description: 'Kimi K3 and K2.7 Code' },
  { id: 'glm',       name: 'GLM',       description: 'GLM-5.2' },
  { id: 'xai',       name: 'xAI',       description: 'Grok models' },
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

  if (status === 'loading') {
    return (
      <RouterLayout>
        <div className="rv4-loading" style={{ padding: 40 }}>
          <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
          <span>Loading</span>
        </div>
      </RouterLayout>
    );
  }

  return (
    <RouterLayout>
      <div className="rv4-page-header">
        <div className="rv4-page-header-left">
          <h1 className="rv4-page-title">Test your keys</h1>
          <div className="rv4-page-title-sub">
            Run the same benchmarks behind the public leaderboard against your own API key, and see how your
            access compares to ours.
          </div>
        </div>
      </div>

      <div className="rv4-info-banner" style={{ marginBottom: 14 }}>
        <div className="rv4-info-banner-icon">🔒</div>
        <div className="rv4-info-banner-content">
          <div className="rv4-info-banner-title">Your key is never stored, and your results stay yours</div>
          <div className="rv4-info-banner-text">
            The key is used for this run and discarded. Results are saved to your account only — they never
            change a public ranking. Your provider bills you directly for whatever the test uses.
          </div>
        </div>
      </div>

      {error && (
        <div className="rv4-error-banner" style={{ marginBottom: 14 }}>{error}</div>
      )}

      {/* ── 1. Provider ─────────────────────────────────────────────── */}
      <div className="rv4-panel" style={{ marginBottom: 14 }}>
        <div className="rv4-panel-header"><span className="rv4-panel-title">1 · Provider</span></div>
        <div className="rv4-panel-body">
          <div className="rv4-provider-grid">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => { setProvider(p.id); setModels([]); setModel(''); setResult(null); }}
                className={`rv4-provider-card ${provider === p.id ? 'active' : ''}`}
              >
                <ProviderLogo provider={p.id} size={20} />
                <div className="rv4-provider-card-name">{p.name}</div>
                <div className="rv4-provider-card-desc">{p.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. Key + model ──────────────────────────────────────────── */}
      <div className="rv4-panel" style={{ marginBottom: 14 }}>
        <div className="rv4-panel-header"><span className="rv4-panel-title">2 · Your API key</span></div>
        <div className="rv4-panel-body">
          <div className="rv4-form-group">
            <label className="rv4-input-label">{PROVIDERS.find(p => p.id === provider)?.name} API key</label>
            <div className="rv4-form-row">
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Paste your key"
                className="rv4-input"
                style={{ flex: 1 }}
                autoComplete="off"
              />
              <button onClick={discover} disabled={!apiKey.trim() || discovering} className="rv4-ctrl-btn">
                {discovering ? 'Checking…' : 'Find my models'}
              </button>
            </div>
            <div className="rv4-input-hint">
              Sent once, used for this test, never written to disk.
            </div>
          </div>

          {models.length > 0 && (
            <div className="rv4-form-group" style={{ marginTop: 12 }}>
              <label className="rv4-input-label">Model ({models.length} available on this key)</label>
              <select value={model} onChange={e => { setModel(e.target.value); setResult(null); }} className="rv4-select">
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. What to test, with the price up front ────────────────── */}
      {model && (
        <div className="rv4-panel" style={{ marginBottom: 14 }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">3 · What to test</span>
            <span style={{ fontSize: 10, opacity: 0.6 }}>costs are charged by your provider, not by us</span>
          </div>
          <div className="rv4-panel-body">
            <div className="rv4-strategy-grid">
              {SUITE_ORDER.map(s => {
                const est = estimates.find(e => e.suite === s);
                return (
                  <button key={s} onClick={() => setSuite(s)} className={`rv4-strategy-card ${suite === s ? 'active' : ''}`}>
                    <div className="rv4-strategy-card-header">
                      <span className="rv4-strategy-card-name">{est?.label ?? s}</span>
                      {suite === s && <span className="rv4-strategy-checkmark">✓</span>}
                    </div>
                    <div className="rv4-strategy-card-desc">{est?.description ?? ''}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <span className={`rv4-badge ${est?.estimatedUsd === null ? 'dim' : est && est.estimatedUsd > 0.2 ? 'amber' : 'green'}`}>
                        {est ? money(est.estimatedUsd) : '—'}
                      </span>
                      <span className="rv4-badge dim">{est?.apiCalls ?? '—'} calls</span>
                      <span className="rv4-badge dim">~{est ? Math.round(est.typicalSeconds / 60) || 1 : '—'} min</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {chosen && (
              <div className="rv4-info-banner" style={{ marginTop: 12 }}>
                <div className="rv4-info-banner-icon">💰</div>
                <div className="rv4-info-banner-content">
                  <div className="rv4-info-banner-title">
                    Estimated {money(chosen.estimatedUsd)}
                    {chosen.estimatedRangeUsd && ` (typically ${money(chosen.estimatedRangeUsd[0])}–${money(chosen.estimatedRangeUsd[1])})`}
                    {chosen.basis === 'measured' && ' · based on this model’s real usage'}
                    {/* The old copy here said "we have not benchmarked this model", which was
                        untrue for nearly every model on the list — a fallback only means we
                        have no token count for THIS suite on THIS model, usually because the
                        suite is a connectivity ping we do not record usage for. */}
                    {chosen.basis === 'typical' && ' · typical usage across the models we run'}
                  </div>
                  <div className="rv4-info-banner-text">
                    {chosen.notes.join(' ')}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={run}
              disabled={running || !apiKey.trim() || !model}
              className="rv4-ctrl-btn primary"
              style={{ marginTop: 12, width: '100%', padding: '12px' }}
            >
              {running ? `Running ${chosen?.label ?? ''} test…` : `Run ${chosen?.label ?? ''} test`}
            </button>
            {running && (
              <div className="rv4-loading" style={{ marginTop: 10 }}>
                <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
                <span>This can take a few minutes. Leave the tab open.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 4. Result, against our published number ─────────────────── */}
      {result && (
        <div className="rv4-panel" style={{ marginBottom: 14 }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">Result · {model}</span>
            <span className={`rv4-badge ${result.success ? 'green' : 'red'}`}>{result.success ? 'Completed' : 'Failed'}</span>
          </div>
          <div className="rv4-panel-body">
            {result.error && <div className="rv4-error-banner" style={{ marginBottom: 12 }}>{result.error}</div>}

            <div className="rv4-metrics-grid">
              <div className="rv4-metric-card">
                <div className="rv4-metric-content">
                  <div className="rv4-metric-label">Your score</div>
                  <div className="rv4-metric-value">{result.score ?? '—'}</div>
                  <div className="rv4-metric-sub">
                    {result.tasksPassed !== null && result.tasksTotal !== null
                      ? `${result.tasksPassed} of ${result.tasksTotal} passed`
                      : 'connectivity check'}
                  </div>
                </div>
              </div>
              <div className="rv4-metric-card">
                <div className="rv4-metric-content">
                  <div className="rv4-metric-label">Our published score</div>
                  <div className="rv4-metric-value">{result.referenceScore != null ? Math.round(result.referenceScore) : '—'}</div>
                  {result.referenceBasis && (
                    <div className="rv4-metric-sub" title={result.referenceBasis}>{result.referenceBasis}</div>
                  )}
                  <div className="rv4-metric-sub">
                    {result.referenceScore != null && result.score != null
                      ? `${result.score >= result.referenceScore ? '+' : ''}${Math.round(result.score - result.referenceScore)} vs ours`
                      : 'no comparable public score'}
                  </div>
                </div>
              </div>
              <div className="rv4-metric-card">
                <div className="rv4-metric-content">
                  <div className="rv4-metric-label">What it cost you</div>
                  <div className="rv4-metric-value">{money(result.estCostUsd)}</div>
                  <div className="rv4-metric-sub">{result.apiCalls} calls · {result.tokensIn + result.tokensOut} tokens</div>
                </div>
              </div>
              <div className="rv4-metric-card">
                <div className="rv4-metric-content">
                  <div className="rv4-metric-label">Avg latency</div>
                  <div className="rv4-metric-value">{result.avgLatencyMs ? `${(result.avgLatencyMs / 1000).toFixed(1)}s` : '—'}</div>
                  <div className="rv4-metric-sub">{(result.latencyMs / 1000).toFixed(0)}s total</div>
                </div>
              </div>
            </div>

            {result.referenceScore != null && result.score != null && Math.abs(result.score - result.referenceScore) >= 8 && (
              <div className="rv4-info-banner" style={{ marginTop: 12 }}>
                <div className="rv4-info-banner-icon">ℹ️</div>
                <div className="rv4-info-banner-content">
                  <div className="rv4-info-banner-title">Why your number can differ from ours</div>
                  <div className="rv4-info-banner-text">
                    This is one run on your key. Ours is a median over repeated runs on a fixed schedule. Rate
                    limits, account tier and ordinary run-to-run variance all move a single sample.
                  </div>
                </div>
              </div>
            )}

            {result.axes && (
              <div style={{ marginTop: 14 }}>
                <div className="rv4-stat-label" style={{ marginBottom: 8 }}>Per-axis breakdown</div>
                {Object.entries(result.axes).map(([k, v]) => (
                  <div key={k} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1')}</span>
                      <span>{Math.round(v * 100)}%</span>
                    </div>
                    <div className="rv4-progress"><div className="rv4-progress-fill" style={{ width: `${Math.min(100, v * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            )}

            {result.breakdown && result.breakdown.length > 0 && (
              <div className="rv4-table-wrapper" style={{ marginTop: 14 }}>
                <table className="rv4-table">
                  <thead><tr><th>Task</th><th>Result</th><th>Detail</th><th style={{ textAlign: 'right' }}>Time</th></tr></thead>
                  <tbody>
                    {result.breakdown.map((b, i) => (
                      <tr key={i}>
                        <td>{b.label}</td>
                        <td><span className={`rv4-badge ${b.passed ? 'green' : 'red'}`}>{b.passed ? 'pass' : 'fail'}</span></td>
                        <td style={{ opacity: 0.75 }}>{b.detail || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{b.latencyMs ? `${(b.latencyMs / 1000).toFixed(1)}s` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 5. History ──────────────────────────────────────────────── */}
      <div className="rv4-panel">
        <div className="rv4-panel-header">
          <span className="rv4-panel-title">Your test history</span>
          {history.length > 0 && <span className="rv4-badge dim">{history.length} runs</span>}
        </div>
        <div className="rv4-panel-body" style={{ padding: history.length ? 0 : undefined }}>
          {history.length === 0 ? (
            <div className="rv4-empty" style={{ padding: 32 }}>
              <div className="rv4-empty-icon">📊</div>
              <div className="rv4-empty-title">No tests yet</div>
              <div className="rv4-empty-text">Run one above and it will appear here, with what it scored and what it cost.</div>
            </div>
          ) : (
            <>
              {model && modelHistory.length > 1 && (
                <div style={{ padding: '10px 14px', fontSize: 12, opacity: 0.75 }}>
                  You have tested <strong>{model}</strong> {modelHistory.length} times — scores{' '}
                  {modelHistory.filter(h => h.score != null).map(h => Math.round(h.score!)).join(', ')}.
                </div>
              )}
              <div className="rv4-table-wrapper">
                <table className="rv4-table">
                  <thead>
                    <tr>
                      <th>When</th><th>Model</th><th>Test</th>
                      <th style={{ textAlign: 'right' }}>Score</th>
                      <th style={{ textAlign: 'right' }}>vs ours</th>
                      <th style={{ textAlign: 'right' }}>Cost</th>
                      <th style={{ textAlign: 'right' }}>Avg latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => {
                      const delta = h.score != null && h.reference_score != null ? h.score - h.reference_score : null;
                      return (
                        <tr key={h.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{when(h.ts)}</td>
                          <td>{h.model_name}</td>
                          <td><span className="rv4-badge dim">{h.suite}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            {h.success ? (h.score != null ? Math.round(h.score) : '✓')
                              : <span className="rv4-badge red" title={h.error || ''}>failed</span>}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {delta === null ? '—' : (
                              <span className={`rv4-badge ${delta >= 0 ? 'green' : 'amber'}`}>
                                {delta >= 0 ? '+' : ''}{Math.round(delta)}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>{money(h.est_cost_usd)}</td>
                          <td style={{ textAlign: 'right' }}>{h.avg_latency_ms ? `${(h.avg_latency_ms / 1000).toFixed(1)}s` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </RouterLayout>
  );
}
