'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import { apiClient } from '@/lib/api-client';
import type { UserPreferences, RoutingStrategyId, PreferencesPreview, PreviewCandidate } from '@/lib/api-client';

/**
 * Smart Router preferences: what `model: "auto"` does for this account.
 *
 * Routing is a Free capability, so this page is open on every plan (it used to require a paid
 * plan, which left Free accounts able to route but not to choose how). Every change is previewed
 * live against the caller's own keys — POST /router/preferences/preview runs the real selection
 * pipeline on the unsaved settings and spends nothing — so the page shows what the next request
 * will actually go to before anything is saved.
 */

type Strategy = {
  id: RoutingStrategyId;
  name: string;
  desc: string;
  basis: string;
  modelId: string;
  recommended?: boolean;
};

const GROUPS: Array<{ title: string; note: string; items: Strategy[] }> = [
  {
    title: 'Best quality',
    note: 'The highest-scoring model you can use, on the benchmark that matches the work.',
    items: [
      { id: 'best_overall', name: 'Best overall', desc: 'Highest combined score across all three benchmarks.', basis: 'Combined score: coding 50%, reasoning 25%, tool use 25%', modelId: 'auto-best', recommended: true },
      { id: 'best_coding', name: 'Best for coding', desc: 'Best at finding and fixing bugs in real code.', basis: 'Coding benchmark (repository bug fixes, every 4 hours)', modelId: 'auto-coding' },
      { id: 'best_reasoning', name: 'Best for reasoning', desc: 'Best at long, multi-step work that keeps track of requirements.', basis: 'Reasoning benchmark (multi-turn sessions, daily)', modelId: 'auto-reasoning' },
      { id: 'best_tooling', name: 'Best for tool use', desc: 'Best at picking the right tool and arguments, and recovering from tool errors. For agents and coding assistants.', basis: 'Tool-use benchmark (daily)', modelId: 'auto-tooling' },
    ],
  },
  {
    title: 'Best value',
    note: 'Near-top quality for less: among models within 5 points of the best you can use, the most points per dollar a benchmark run actually cost.',
    items: [
      { id: 'best_value', name: 'Best value overall', desc: 'Most combined-score points per dollar.', basis: 'Combined score ÷ measured cost of a benchmark run', modelId: 'auto-value' },
      { id: 'best_value_coding', name: 'Best value for coding', desc: 'Near-top coding quality at the lowest measured cost.', basis: 'Coding score ÷ measured cost of a coding run', modelId: 'auto-value-coding' },
      { id: 'best_value_reasoning', name: 'Best value for reasoning', desc: 'Near-top reasoning at the lowest measured cost.', basis: 'Reasoning score ÷ measured cost of a reasoning run', modelId: 'auto-value-reasoning' },
      { id: 'best_value_tooling', name: 'Best value for tool use', desc: 'Near-top tool use at the lowest measured cost: agents on a budget.', basis: 'Tool-use score ÷ measured cost of a tool-use run', modelId: 'auto-value-tooling' },
    ],
  },
  {
    title: 'Speed and stability',
    note: 'The first two keep the 5-point quality bar; the last two do not.',
    items: [
      { id: 'fastest_quality', name: 'Fastest good model', desc: 'The fastest of the near-top models, on measured latency only.', basis: 'Measured latency, among models within 5 points of your best', modelId: 'auto-fastest-quality' },
      { id: 'best_consistent', name: 'Most consistent', desc: 'The near-top model whose scores swing least from run to run.', basis: 'Spread of the coding score over recent runs', modelId: 'auto-consistent' },
      { id: 'fastest', name: 'Fastest response', desc: 'Lowest response time, with no quality bar.', basis: 'Benchmark latency over the last 7 days', modelId: 'auto-fastest' },
      { id: 'cheapest', name: 'Lowest list price', desc: 'Cheapest per token, with no quality bar. For near-top quality at low cost, use a Best value option.', basis: 'Published provider prices', modelId: 'auto-cheapest' },
    ],
  },
  {
    title: 'Your own rules',
    note: 'Decide per request, or split traffic yourself.',
    items: [
      { id: 'match_task', name: 'Match each request', desc: 'Reads each request and picks the matching benchmark: tools → tool use, design or long sessions → reasoning, code → coding, anything else → overall. Simple requests use the Best value version of the same choice.', basis: 'Chosen per request; the routing reason names the rule', modelId: 'auto-task' },
      { id: 'custom_split', name: 'Your traffic split', desc: 'Send a share of requests to each model you choose, for example 80% to one model and 20% to another.', basis: 'Your weights; the rest of the split is the first fallback', modelId: 'auto-split' },
    ],
  },
];
const ALL = GROUPS.flatMap(g => g.items);
const PROVIDERS = ['openai', 'anthropic', 'google', 'deepseek', 'kimi', 'glm'];
const PROVIDER_LABEL: Record<string, string> = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', deepseek: 'DeepSeek', kimi: 'Kimi', glm: 'GLM (Z.ai)' };

const DEFAULTS: UserPreferences = {
  routingStrategy: 'best_overall', fallbackEnabled: true, maxCostPer1kTokens: null, maxLatencyMs: null,
  requireToolCalling: false, requireStreaming: false, excludedProviders: [], excludedModels: [],
  avoidDrifting: true, fallbackOrder: [], trafficSplit: [],
};

const STATUS_TEXT: Record<PreviewCandidate['status'], string> = {
  eligible: 'can be used', no_key: 'no provider key', excluded: 'excluded', over_cost: 'over your cost limit',
  over_latency: 'over your latency limit', no_tools: 'no tool calling', no_forced_tools: 'cannot force a tool call',
};

const fmtUsd = (n: number) => (n >= 1 ? `$${n.toFixed(2)}` : n >= 0.1 ? `$${n.toFixed(2)}` : `$${n.toFixed(3)}`);
const fmtSec = (ms: number | null) => (ms == null ? '—' : ms < 10_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 1000)} s`);
const norm = (p: UserPreferences): UserPreferences => ({ ...DEFAULTS, ...p, fallbackOrder: p.fallbackOrder ?? [], trafficSplit: p.trafficSplit ?? [] });

export default function RouterPreferencesPage() {
  return (
    <RouterLayout>
      <SubscriptionGuard feature="Routing preferences" requires="routing">
        <Preferences />
      </SubscriptionGuard>
    </RouterLayout>
  );
}

function Preferences() {
  const { data: session, status } = useSession();
  const [saved, setSaved] = useState<UserPreferences | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [preview, setPreview] = useState<PreferencesPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [samplePrompt, setSamplePrompt] = useState('');
  // The last model list a preview returned. Kept when a later preview finds no usable model, so
  // the exclusion list, the fallback picker and the split editor never go empty under the user.
  const [candidates, setCandidates] = useState<PreviewCandidate[]>([]);
  const [keyed, setKeyed] = useState<string[] | null>(null);
  const previewSeq = useRef(0);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const p = norm(await apiClient.getPreferences());
      // best_creative is routed as best_overall since 2026-10-05; the API already returns that.
      setSaved(p);
      setPrefs(p);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your preferences.');
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      apiClient.setUserId(session.user.id);
      load();
    }
  }, [status, session, load]);

  // Live preview of the unsaved settings, debounced.
  useEffect(() => {
    if (!prefs) return;
    const seq = ++previewSeq.current;
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        const r = await apiClient.previewPreferences({ ...prefs, samplePrompt: prefs.routingStrategy === 'match_task' ? samplePrompt : undefined });
        if (seq === previewSeq.current) {
          setPreview(r);
          const details = r.ok ? r.details : r.details;
          if (details?.candidates?.length) setCandidates(details.candidates);
          if (r.ok) setKeyed(r.providers);
          else if (r.error === 'no_provider_keys') setKeyed([]);
        }
      } catch (err) {
        if (seq === previewSeq.current) setPreview({ ok: false, error: 'no_candidates', message: err instanceof Error ? err.message : 'Preview unavailable.' });
      } finally {
        if (seq === previewSeq.current) setPreviewing(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [prefs, samplePrompt]);

  const dirty = useMemo(() => !!prefs && !!saved && JSON.stringify(norm(prefs)) !== JSON.stringify(norm(saved)), [prefs, saved]);
  const modelNames = useMemo(() => [...candidates].sort((a, b) => b.score - a.score).map(c => c.model), [candidates]);

  const validation = useMemo(() => {
    if (!prefs) return null;
    if (prefs.routingStrategy === 'custom_split' && !(prefs.trafficSplit || []).length) return 'Add at least one model to your traffic split.';
    if ((prefs.trafficSplit || []).some(x => !(x.weight >= 1 && x.weight <= 100))) return 'Each weight must be between 1 and 100.';
    if (prefs.maxCostPer1kTokens !== null && !(prefs.maxCostPer1kTokens > 0)) return 'Set a maximum cost above $0, or turn the limit off.';
    if (prefs.maxLatencyMs !== null && !(prefs.maxLatencyMs >= 100)) return 'Set a maximum latency of at least 0.1 s, or turn the limit off.';
    return null;
  }, [prefs]);

  const save = async () => {
    if (!prefs || validation) return;
    setSaving(true);
    setSaveError(null);
    try {
      await apiClient.updatePreferences({ ...prefs, requireStreaming: false });
      setSaved(prefs);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save your preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="rv4-body">
        <div className="rv4-error-banner">
          <span>⚠</span>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 600, marginBottom: 2 }}>Could not load your preferences</div><div style={{ fontSize: 12 }}>{loadError}</div></div>
          <button onClick={load} className="rv4-ctrl-btn danger" style={{ marginLeft: 'auto' }}>Try again</button>
        </div>
      </div>
    );
  }
  if (!prefs) {
    return (
      <div className="rv4-loading" style={{ minHeight: 300 }}>
        <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
        <span>Loading preferences</span>
      </div>
    );
  }

  const set = (patch: Partial<UserPreferences>) => setPrefs({ ...prefs, ...patch });
  const strategy = ALL.find(s => s.id === prefs.routingStrategy) || ALL[0];

  return (
    <>
      <div className="rv4-page-header">
        <div className="rv4-page-header-left">
          <div>
            <div className="rv4-page-title">Routing preferences</div>
            <div className="rv4-page-title-sub">How the Smart Router picks a model when a request says <code>model: &quot;auto&quot;</code></div>
          </div>
        </div>
        <div className="rv4-page-header-right">
          <button onClick={() => setPrefs(norm(DEFAULTS))} className="rv4-ctrl-btn" disabled={saving}>Reset to defaults</button>
          <button onClick={save} disabled={saving || !dirty || !!validation} className="rv4-ctrl-btn primary">
            {saving ? 'Saving…' : justSaved ? 'Saved ✓' : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="rv4-body rp">
        {saveError && (
          <div className="rv4-error-banner" style={{ marginBottom: 14 }} role="alert">
            <span>⚠</span><div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>Not saved</div><div style={{ fontSize: 12 }}>{saveError}</div></div>
          </div>
        )}

        <PreviewPanel preview={preview} previewing={previewing} strategy={strategy} dirty={dirty}
          samplePrompt={samplePrompt} onSamplePrompt={setSamplePrompt} />

        {/* Strategy */}
        <section className="rv4-panel rp-section">
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">Routing strategy</span>
            <span className="rp-muted">Used for <code>model: &quot;auto&quot;</code>. Any request can pick another by sending its model id.</span>
          </div>
          <div className="rv4-panel-body">
            {GROUPS.map(g => (
              <div key={g.title} className="rp-group">
                <div className="rp-group-title">{g.title}</div>
                <div className="rp-group-note">{g.note}</div>
                <div className="rv4-strategy-grid rp-grid">
                  {g.items.map(s => {
                    const active = prefs.routingStrategy === s.id;
                    return (
                      <button type="button" key={s.id} aria-pressed={active}
                        className={`rv4-strategy-card rp-card${active ? ' active' : ''}`}
                        onClick={() => set({ routingStrategy: s.id })}>
                        <div className="rv4-strategy-card-header">
                          <span className="rp-card-name">{s.name}</span>
                          {s.recommended && <span className="rv4-strategy-card-recommended">Recommended</span>}
                          {active && <span className="rp-check" aria-hidden="true">✓</span>}
                        </div>
                        <div className="rv4-strategy-card-desc">{s.desc}</div>
                        <div className="rp-basis">Ranks on: {s.basis}</div>
                        <div className="rp-modelid">Per request: <code>{s.modelId}</code></div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {prefs.routingStrategy === 'custom_split' && (
          <SplitEditor prefs={prefs} set={set} modelNames={modelNames} candidates={candidates} split={preview ? (preview.ok ? preview.details.split : preview.details?.split) : undefined} />
        )}

        {/* Limits */}
        <section className="rv4-panel rp-section">
          <div className="rv4-panel-header"><span className="rv4-panel-title">Limits</span></div>
          <div className="rv4-panel-body rp-stack">
            <LimitCost prefs={prefs} set={set} candidates={candidates} />
            <LimitLatency prefs={prefs} set={set} candidates={candidates} />
            <label className="rp-toggle">
              <input type="checkbox" className="rv4-checkbox" checked={prefs.requireToolCalling}
                onChange={e => set({ requireToolCalling: e.target.checked })} />
              <span>
                <span className="rp-toggle-title">Only models that support tool calling</span>
                <span className="rp-hint">Requests that offer tools already go only to models that can use them.</span>
              </span>
            </label>
            {prefs.routingStrategy === 'custom_split' && <div className="rp-hint">Cost and latency limits do not apply to models you list in your traffic split.</div>}
          </div>
        </section>

        {/* Providers and models */}
        <section className="rv4-panel rp-section">
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">Providers and models</span>
            <span className="rp-muted">{prefs.excludedProviders.length + prefs.excludedModels.length ? `${prefs.excludedProviders.length} provider(s), ${prefs.excludedModels.length} model(s) excluded` : 'Nothing excluded'}</span>
          </div>
          <div className="rv4-panel-body">
            <div className="rp-label">Providers</div>
            <div className="rp-chips">
              {PROVIDERS.map(p => {
                const excluded = prefs.excludedProviders.includes(p);
                const noKey = keyed !== null && !keyed.includes(p);
                return (
                  <button type="button" key={p} aria-pressed={excluded}
                    className={`rp-chip${excluded ? ' is-off' : ''}${noKey ? ' is-nokey' : ''}`}
                    title={noKey ? 'No key added for this provider' : excluded ? 'Excluded — click to include' : 'Click to exclude'}
                    onClick={() => set({ excludedProviders: excluded ? prefs.excludedProviders.filter(x => x !== p) : [...prefs.excludedProviders, p] })}>
                    {excluded ? '✕ ' : ''}{PROVIDER_LABEL[p]}{noKey ? ' · no key' : ''}
                  </button>
                );
              })}
            </div>
            <div className="rp-hint">
              The router only uses providers you have added a key for. <Link href="/router/providers">Manage provider keys</Link>.
            </div>
            <div className="rp-label" style={{ marginTop: 16 }}>Models</div>
            {candidates.length === 0 ? (
              <div className="rp-hint">{previewing ? 'Loading models…' : 'No ranked models to show yet.'}</div>
            ) : (
              <div className="rp-chips">
                {[...candidates].sort((a, b) => b.score - a.score).map(c => {
                  const excluded = prefs.excludedModels.includes(c.model);
                  const covered = prefs.excludedProviders.includes(c.provider);
                  return (
                    <button type="button" key={c.model} aria-pressed={excluded}
                      className={`rp-chip mono${excluded ? ' is-off' : ''}${(covered || c.status === 'no_key') && !excluded ? ' is-dim' : ''}`}
                      title={`${PROVIDER_LABEL[c.provider] || c.provider} · score ${Math.round(c.score)} · ${STATUS_TEXT[c.status]}`}
                      onClick={() => set({ excludedModels: excluded ? prefs.excludedModels.filter(x => x !== c.model) : [...prefs.excludedModels, c.model] })}>
                      {excluded ? '✕ ' : ''}{c.model}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="rp-hint">Click a model to exclude it. Faded models have no key, or their provider is excluded.</div>
          </div>
        </section>

        {/* Fallbacks */}
        <section className="rv4-panel rp-section">
          <div className="rv4-panel-header"><span className="rv4-panel-title">When a model fails</span></div>
          <div className="rv4-panel-body rp-stack">
            <label className="rp-toggle">
              <input type="checkbox" className="rv4-checkbox" checked={prefs.fallbackEnabled}
                onChange={e => set({ fallbackEnabled: e.target.checked })} />
              <span>
                <span className="rp-toggle-title">Try other models automatically</span>
                <span className="rp-hint">If the chosen model fails before answering, the next one is tried, preferring a different provider. Off: the request fails with that model&apos;s error.</span>
              </span>
            </label>
            {prefs.fallbackEnabled && <FallbackOrder prefs={prefs} set={set} modelNames={modelNames} candidates={candidates} />}
            <label className="rp-toggle">
              <input type="checkbox" className="rv4-checkbox" checked={prefs.avoidDrifting !== false}
                onChange={e => set({ avoidDrifting: e.target.checked })} />
              <span>
                <span className="rp-toggle-title">Avoid models with an active drift alert</span>
                <span className="rp-hint">A model our drift detectors flag as degrading on the skill your strategy uses, or whose hourly canary is failing, goes behind every unflagged model. It is never removed: if every option is flagged, the best of them is used and the routing reason says so.</span>
              </span>
            </label>
          </div>
        </section>

        <div className="rp-savebar">
          {validation ? <span className="rp-warn">{validation}</span> : dirty ? <span className="rp-muted">You have unsaved changes.</span> : <span className="rp-muted">All changes saved.</span>}
          <button onClick={() => prefs && saved && setPrefs(saved)} className="rv4-ctrl-btn" disabled={!dirty || saving}>Discard changes</button>
          <button onClick={save} disabled={saving || !dirty || !!validation} className="rv4-ctrl-btn primary">
            {saving ? 'Saving…' : justSaved ? 'Saved ✓' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  );
}

function PreviewPanel({ preview, previewing, strategy, dirty, samplePrompt, onSamplePrompt }: {
  preview: PreferencesPreview | null; previewing: boolean; strategy: Strategy; dirty: boolean;
  samplePrompt: string; onSamplePrompt: (s: string) => void;
}) {
  return (
    <section className="rv4-panel rp-section rp-preview" aria-live="polite">
      <div className="rv4-panel-header">
        <span className="rv4-panel-title">Where your next request goes</span>
        <span className="rp-muted">{previewing ? 'Updating…' : dirty ? 'Preview of your unsaved settings' : 'With your saved settings'}</span>
      </div>
      <div className="rv4-panel-body">
        {strategy.id === 'match_task' && (
          <div style={{ marginBottom: 12 }}>
            <label className="rp-label" htmlFor="rp-sample">Try a request</label>
            <textarea id="rp-sample" className="rv4-input rp-textarea" rows={2} maxLength={4000}
              placeholder="Paste a prompt to see which strategy and model it would get, e.g. “Fix this TypeError in my React component”"
              value={samplePrompt} onChange={e => onSamplePrompt(e.target.value)} />
          </div>
        )}
        {!preview ? (
          <div className="rp-hint">Working out where your requests go…</div>
        ) : !preview.ok ? (
          <div className="rp-preview-empty">
            {preview.error === 'no_provider_keys'
              ? <>Add a provider key first: the router calls models with your own keys. <Link href="/router/providers">Add a key</Link></>
              : <>No model can be used with these settings. {preview.message}</>}
          </div>
        ) : (
          <>
            {preview.details.taskRule && (
              <div className="rp-hint" style={{ marginBottom: 8 }}>This request reads as a <b>{preview.details.taskRule}</b>, so it uses <b>{ALL.find(s => s.id === preview.details.effectiveStrategy)?.name || preview.details.effectiveStrategy}</b>.</div>
            )}
            <div className="rp-route">
              <div className="rp-route-step is-primary">
                <div className="rp-route-k">First choice</div>
                <div className="rp-route-model">{preview.primary.model}</div>
                <div className="rp-route-sub">{PROVIDER_LABEL[preview.primary.provider] || preview.primary.provider}{preview.primary.score ? ` · score ${preview.primary.score.toFixed(1)}` : ''}</div>
              </div>
              {preview.fallbacks.map((f, i) => (
                <div key={f.model} className="rp-route-step">
                  <div className="rp-route-k">{i === 0 ? 'If it fails' : 'Then'}</div>
                  <div className="rp-route-model">{f.model}</div>
                  <div className="rp-route-sub">{PROVIDER_LABEL[f.provider] || f.provider}{/your (fallback order|traffic split)/.test(f.reasoning) ? ' · your choice' : ''}</div>
                </div>
              ))}
              {preview.fallbacks.length === 0 && (
                <div className="rp-route-step is-none"><div className="rp-route-k">If it fails</div><div className="rp-route-sub">The request fails: automatic fallback is off.</div></div>
              )}
            </div>
            {preview.details.split && preview.details.split.length > 0 && (
              <div className="rp-hint" style={{ marginTop: 8 }}>
                Split: {preview.details.split.map(x => `${x.model} ${Math.round(x.share * 100)}%${x.usable ? '' : ` (unusable: ${x.reason})`}`).join(' · ')}. The first choice above changes from request to request in these proportions.
              </div>
            )}
            <details className="rp-why">
              <summary>Why this model</summary>
              <p>{preview.primary.reasoning}</p>
            </details>
          </>
        )}
      </div>
    </section>
  );
}

function LimitCost({ prefs, set, candidates }: { prefs: UserPreferences; set: (p: Partial<UserPreferences>) => void; candidates: PreviewCandidate[] }) {
  // The API's limit is the average of input and output price per 1K tokens; prices are quoted
  // per million everywhere else, so the page shows and takes it per million.
  const on = prefs.maxCostPer1kTokens !== null;
  const perM = on ? Math.round(prefs.maxCostPer1kTokens! * 1000 * 1000) / 1000 : 0;
  const usable = candidates.filter(c => c.status !== 'no_key' && c.status !== 'excluded');
  const fit = usable.filter(c => !on || c.costPer1kBlended <= prefs.maxCostPer1kTokens!).length;
  const prices = usable.map(c => c.costPer1kBlended * 1000).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : 5;
  return (
    <div>
      <label className="rp-toggle">
        <input type="checkbox" className="rv4-checkbox" checked={on}
          onChange={e => set({ maxCostPer1kTokens: e.target.checked ? Math.max(0.0001, Math.ceil(median * 100) / 100 / 1000) : null })} />
        <span>
          <span className="rp-toggle-title">Maximum price</span>
          <span className="rp-hint">Average of a model&apos;s input and output list price, per million tokens.</span>
        </span>
      </label>
      {on && (
        <div className="rp-inline">
          <span>$</span>
          <input type="number" min={0.01} step={0.05} className="rv4-input rp-num" value={perM}
            aria-label="Maximum price per million tokens"
            onChange={e => set({ maxCostPer1kTokens: (parseFloat(e.target.value) || 0) / 1000 })} />
          <span className="rp-muted">per 1M tokens</span>
          {usable.length > 0 && <span className="rp-muted">· {fit} of {usable.length} usable models fit{prices.length ? ` (they range ${fmtUsd(prices[0])}–${fmtUsd(prices[prices.length - 1])})` : ''}</span>}
        </div>
      )}
    </div>
  );
}

function LimitLatency({ prefs, set, candidates }: { prefs: UserPreferences; set: (p: Partial<UserPreferences>) => void; candidates: PreviewCandidate[] }) {
  const on = prefs.maxLatencyMs !== null;
  const usable = candidates.filter(c => c.status !== 'no_key' && c.status !== 'excluded' && c.latencyMs != null);
  const lat = usable.map(c => c.latencyMs!).sort((a, b) => a - b);
  const median = lat.length ? lat[Math.floor(lat.length / 2)] : 10_000;
  const fit = usable.filter(c => !on || c.latencyMs! <= prefs.maxLatencyMs!).length;
  return (
    <div>
      <label className="rp-toggle">
        <input type="checkbox" className="rv4-checkbox" checked={on}
          // Starts at the median of your usable models, so turning it on never empties the list.
          onChange={e => set({ maxLatencyMs: e.target.checked ? Math.ceil(median / 1000) * 1000 : null })} />
        <span>
          <span className="rp-toggle-title">Maximum response time</span>
          <span className="rp-hint">Measured over the last 7 days of benchmark runs, blended with what the router observes. Reasoning models often take 10–60 s on hard tasks.</span>
        </span>
      </label>
      {on && (
        <div className="rp-inline">
          <input type="number" min={0.1} step={0.5} className="rv4-input rp-num" value={prefs.maxLatencyMs! / 1000}
            aria-label="Maximum response time in seconds"
            onChange={e => set({ maxLatencyMs: Math.round((parseFloat(e.target.value) || 0) * 1000) })} />
          <span className="rp-muted">seconds</span>
          {usable.length > 0 && <span className="rp-muted">· {fit} of {usable.length} usable models fit (fastest {fmtSec(lat[0])}, median {fmtSec(median)})</span>}
        </div>
      )}
    </div>
  );
}

function SplitEditor({ prefs, set, modelNames, candidates, split }: {
  prefs: UserPreferences; set: (p: Partial<UserPreferences>) => void; modelNames: string[]; candidates: PreviewCandidate[];
  split?: Array<{ model: string; weight: number; share: number; usable: boolean; reason?: string }>;
}) {
  const rows = prefs.trafficSplit || [];
  const total = rows.reduce((a, r) => a + (r.weight || 0), 0);
  const unused = modelNames.filter(m => !rows.some(r => r.model === m));
  const update = (i: number, patch: Partial<{ model: string; weight: number }>) =>
    set({ trafficSplit: rows.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  return (
    <section className="rv4-panel rp-section">
      <div className="rv4-panel-header">
        <span className="rv4-panel-title">Your traffic split</span>
        <span className="rp-muted">Up to 10 models</span>
      </div>
      <div className="rv4-panel-body">
        {rows.length === 0 && <div className="rp-hint" style={{ marginBottom: 10 }}>Add the models to split traffic between, and how much each should get.</div>}
        {rows.map((r, i) => {
          const info = split?.find(x => x.model === r.model);
          const cand = candidates.find(c => c.model === r.model);
          return (
            <div key={i} className="rp-split-row">
              <select className="rv4-input rp-select" value={r.model} aria-label={`Model ${i + 1}`}
                onChange={e => update(i, { model: e.target.value })}>
                {[r.model, ...unused].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input type="number" min={1} max={100} className="rv4-input rp-num" value={r.weight} aria-label={`Weight for ${r.model}`}
                onChange={e => update(i, { weight: Math.round(parseFloat(e.target.value) || 0) })} />
              <span className="rp-share">{total ? Math.round(((r.weight || 0) / total) * 100) : 0}%</span>
              <span className={`rp-split-state${info && !info.usable ? ' is-bad' : ''}`}>
                {info && !info.usable ? `Not used: ${info.reason}` : cand ? `score ${Math.round(cand.score)}` : ''}
              </span>
              <button type="button" className="rv4-ctrl-btn" onClick={() => set({ trafficSplit: rows.filter((_, k) => k !== i) })} aria-label={`Remove ${r.model}`}>Remove</button>
            </div>
          );
        })}
        {rows.length < 10 && unused.length > 0 && (
          <button type="button" className="rv4-ctrl-btn" style={{ marginTop: 6 }}
            onClick={() => set({ trafficSplit: [...rows, { model: unused[0], weight: rows.length ? 20 : 100 }] })}>+ Add a model</button>
        )}
        <div className="rp-hint" style={{ marginTop: 10 }}>
          Weights are relative: 80 and 20 send about 80% and 20% of requests. If a model fails, the others in your split are tried first, then your fallback order, then the automatic fallbacks. A model with no key, or one you excluded, is skipped.
        </div>
      </div>
    </section>
  );
}

function FallbackOrder({ prefs, set, modelNames, candidates }: { prefs: UserPreferences; set: (p: Partial<UserPreferences>) => void; modelNames: string[]; candidates: PreviewCandidate[] }) {
  const list = prefs.fallbackOrder || [];
  const [pick, setPick] = useState('');
  const options = modelNames.filter(m => !list.includes(m));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    set({ fallbackOrder: next });
  };
  return (
    <div className="rp-fallbacks">
      <div className="rp-toggle-title">Your fallback order <span className="rp-muted">(optional)</span></div>
      <div className="rp-hint" style={{ marginBottom: 8 }}>Tried in this order before the automatic fallbacks. Models with no key, excluded ones, and models failing right now are skipped.</div>
      {list.length > 0 && (
        <ol className="rp-fb-list">
          {list.map((m, i) => {
            const c = candidates.find(x => x.model === m);
            return (
              <li key={m}>
                <span className="mono">{m}</span>
                {c && c.status !== 'eligible' && <span className="rp-warn"> · {STATUS_TEXT[c.status]}</span>}
                {!c && candidates.length > 0 && <span className="rp-warn"> · not a ranked model</span>}
                <span className="rp-fb-actions">
                  <button type="button" className="rv4-ctrl-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${m} up`}>↑</button>
                  <button type="button" className="rv4-ctrl-btn" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={`Move ${m} down`}>↓</button>
                  <button type="button" className="rv4-ctrl-btn" onClick={() => set({ fallbackOrder: list.filter(x => x !== m) })} aria-label={`Remove ${m}`}>Remove</button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {list.length < 10 && (
        <div className="rp-inline">
          <select className="rv4-input rp-select" value={pick} onChange={e => setPick(e.target.value)} aria-label="Model to add to your fallback order">
            <option value="">Choose a model…</option>
            {options.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button type="button" className="rv4-ctrl-btn" disabled={!pick}
            onClick={() => { if (pick) { set({ fallbackOrder: [...list, pick] }); setPick(''); } }}>Add</button>
        </div>
      )}
    </div>
  );
}
