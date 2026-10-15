'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import { apiClient } from '@/lib/api-client';
import type { UserPreferences, RoutingStrategyId, PreferencesPreview, PreviewCandidate } from '@/lib/api-client';
import { PageHead, Pane, Loader, Note, Tag, ProviderMark, RankList, previewToSnap, useModelNames } from '@/components/studio';
import { scoreLabel } from '@/components/landing/util';
import '@/styles/studio-router.css';

/**
 * Smart Router preferences: what `model: "auto"` does for this account.
 *
 * Routing is a Free capability, so this page is open on every plan (it used to require a paid
 * plan, which left Free accounts able to route but not to choose how). Every change is previewed
 * live against the caller's own keys — POST /router/preferences/preview runs the real selection
 * pipeline on the unsaved settings and spends nothing — so the page shows what the next request
 * will actually go to before anything is saved. The preview is drawn as the landing page's
 * animated ranking (RankList): change a setting and the models slide to their new places.
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
const plural = (n: number, word: string) => (n ? `${n} ${word}${n === 1 ? '' : 's'}` : '');

/** Model id → display name, falling back to the id while names load (or for an unlisted model). */
type NameOf = (model: string) => string;

export default function RouterPreferencesPage() {
  return (
    <RouterLayout>
      <SubscriptionGuard feature="Routing preferences" requires="routing">
        <Preferences />
      </SubscriptionGuard>
    </RouterLayout>
  );
}

const HEAD_LEAD = <>How the Smart Router picks a model when a request says <code>model: &quot;auto&quot;</code>. Every change is previewed live against your own keys before you save, and the preview spends nothing.</>;

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
  const names = useModelNames();
  const nameOf: NameOf = useCallback(m => names[m] ?? m, [names]);

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
      <>
        <PageHead kicker="Smart Router" title="Routing preferences" lead={HEAD_LEAD} />
        <div className="st-body">
          <div className="st-note is-bad sr-banner" role="alert">
            <div><b>Could not load your preferences</b>{loadError}</div>
            <button type="button" onClick={load} className="st-btn is-sm is-danger">Try again</button>
          </div>
        </div>
      </>
    );
  }
  if (!prefs) {
    return (
      <>
        <PageHead kicker="Smart Router" title="Routing preferences" lead={HEAD_LEAD} />
        <div data-page-loading><Loader label="Loading preferences" minHeight={300} /></div>
      </>
    );
  }

  const set = (patch: Partial<UserPreferences>) => setPrefs({ ...prefs, ...patch });
  const strategy = ALL.find(s => s.id === prefs.routingStrategy) || ALL[0];
  const excludedCount = prefs.excludedProviders.length + prefs.excludedModels.length;

  return (
    <>
      <PageHead
        kicker="Smart Router"
        title="Routing preferences"
        lead={HEAD_LEAD}
        actions={<>
          <button type="button" onClick={() => setPrefs(norm(DEFAULTS))} className="st-btn" disabled={saving}>Reset to defaults</button>
          <button type="button" onClick={save} disabled={saving || !dirty || !!validation} className="st-btn is-primary">
            {saving ? 'Saving…' : justSaved ? 'Saved' : 'Save changes'}
          </button>
        </>}
      />

      <div className="st-body sr-prefs">
        {saveError && <Note tone="bad" title="Not saved">{saveError}</Note>}

        <div className="sr-pgrid">
          <aside className="sr-pside" aria-label="Live preview">
            <PreviewPanel preview={preview} previewing={previewing} strategy={strategy} dirty={dirty}
              samplePrompt={samplePrompt} onSamplePrompt={setSamplePrompt} names={names} nameOf={nameOf} />
          </aside>

          <div className="sr-pmain">
            {/* Strategy */}
            <Pane title="Routing strategy" sub={<>Used for <code className="st-ic">model: &quot;auto&quot;</code>. Any request can pick another by sending its model id.</>} ruled>
              {GROUPS.map(g => (
                <div key={g.title} className="sr-group">
                  <h3 className="sr-group-t">{g.title}</h3>
                  <p className="sr-group-n">{g.note}</p>
                  <div className="st-cards" style={{ '--min': '230px' } as CSSProperties}>
                    {g.items.map(s => {
                      const active = prefs.routingStrategy === s.id;
                      return (
                        <button type="button" key={s.id} aria-pressed={active}
                          className={`st-card sr-strat${active ? ' is-on' : ''}`}
                          onClick={() => set({ routingStrategy: s.id })}>
                          <span className="st-card-t">
                            {s.name}
                            {s.recommended && <Tag tone="solid">Recommended</Tag>}
                            <span className="st-card-tick" aria-hidden="true" />
                          </span>
                          <span className="st-card-d">{s.desc}</span>
                          <span className="sr-strat-basis">Ranks on: {s.basis}</span>
                          <span className="sr-strat-id">Per request: <code>{s.modelId}</code></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </Pane>

            {prefs.routingStrategy === 'custom_split' && (
              <SplitEditor prefs={prefs} set={set} modelNames={modelNames} candidates={candidates} nameOf={nameOf}
                split={preview ? (preview.ok ? preview.details.split : preview.details?.split) : undefined} />
            )}

            {/* Limits */}
            <Pane title="Limits">
              <div className="sr-stack">
                <LimitCost prefs={prefs} set={set} candidates={candidates} />
                <LimitLatency prefs={prefs} set={set} candidates={candidates} />
                <label className="st-toggle">
                  <input type="checkbox" className="st-check" checked={prefs.requireToolCalling}
                    onChange={e => set({ requireToolCalling: e.target.checked })} />
                  <span>
                    <b>Only models that support tool calling</b>
                    <span>Requests that offer tools already go only to models that can use them.</span>
                  </span>
                </label>
                {prefs.routingStrategy === 'custom_split' && <p className="sr-note-line">Cost and latency limits do not apply to models you list in your traffic split.</p>}
              </div>
            </Pane>

            {/* Providers and models */}
            <Pane
              title="Providers and models"
              sub={excludedCount
                ? `${[plural(prefs.excludedProviders.length, 'provider'), plural(prefs.excludedModels.length, 'model')].filter(Boolean).join(', ')} excluded`
                : 'Nothing excluded'}
            >
              <p className="st-label sr-sublabel">Providers</p>
              <div className="sr-chips">
                {PROVIDERS.map(p => {
                  const excluded = prefs.excludedProviders.includes(p);
                  const noKey = keyed !== null && !keyed.includes(p);
                  return (
                    <button type="button" key={p} aria-pressed={excluded}
                      className={`st-chip sr-chip${excluded ? ' is-off' : ''}${noKey ? ' is-nokey' : ''}`}
                      title={noKey ? 'No key added for this provider' : excluded ? 'Excluded — click to include' : 'Click to exclude'}
                      onClick={() => set({ excludedProviders: excluded ? prefs.excludedProviders.filter(x => x !== p) : [...prefs.excludedProviders, p] })}>
                      <ProviderMark provider={p} size="sm" />
                      {excluded && <span className="sr-x" aria-hidden="true">✕</span>}
                      {PROVIDER_LABEL[p]}{noKey ? ' · no key' : ''}
                    </button>
                  );
                })}
              </div>
              <p className="st-hint">
                The router only uses providers you have added a key for. <Link href="/router/providers">Manage provider keys</Link>.
              </p>
              <p className="st-label sr-sublabel">Models</p>
              {candidates.length === 0 ? (
                <p className="st-hint">{previewing ? 'Loading models…' : 'No ranked models to show yet.'}</p>
              ) : (
                <div className="sr-chips">
                  {[...candidates].sort((a, b) => b.score - a.score).map(c => {
                    const excluded = prefs.excludedModels.includes(c.model);
                    const covered = prefs.excludedProviders.includes(c.provider);
                    return (
                      <button type="button" key={c.model} aria-pressed={excluded}
                        className={`st-chip sr-chip${excluded ? ' is-off' : ''}${(covered || c.status === 'no_key') && !excluded ? ' is-dim' : ''}`}
                        title={`${c.model} · ${PROVIDER_LABEL[c.provider] || c.provider} · score ${Math.round(c.score)} · ${STATUS_TEXT[c.status]}`}
                        onClick={() => set({ excludedModels: excluded ? prefs.excludedModels.filter(x => x !== c.model) : [...prefs.excludedModels, c.model] })}>
                        {excluded && <span className="sr-x" aria-hidden="true">✕</span>}
                        {nameOf(c.model)}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="st-hint">Click a model to exclude it. Faded models have no key, or their provider is excluded.</p>
            </Pane>

            {/* Fallbacks */}
            <Pane title="When a model fails">
              <div className="sr-stack">
                <label className="st-toggle">
                  <input type="checkbox" className="st-check" checked={prefs.fallbackEnabled}
                    onChange={e => set({ fallbackEnabled: e.target.checked })} />
                  <span>
                    <b>Try other models automatically</b>
                    <span>If the chosen model fails before answering, the next one is tried, preferring a different provider. Off: the request fails with that model&apos;s error.</span>
                  </span>
                </label>
                {prefs.fallbackEnabled && <FallbackOrder prefs={prefs} set={set} modelNames={modelNames} candidates={candidates} nameOf={nameOf} />}
                <label className="st-toggle">
                  <input type="checkbox" className="st-check" checked={prefs.avoidDrifting !== false}
                    onChange={e => set({ avoidDrifting: e.target.checked })} />
                  <span>
                    <b>Avoid models with an active drift alert</b>
                    <span>A model our drift detectors flag as degrading on the skill your strategy uses, or whose hourly canary is failing, goes behind every unflagged model. It is never removed: if every option is flagged, the best of them is used and the routing reason says so.</span>
                  </span>
                </label>
              </div>
            </Pane>
          </div>
        </div>

        <div className="st-savebar">
          {validation ? <span className="sr-warn" role="alert">{validation}</span> : dirty ? <span>You have unsaved changes.</span> : <span>All changes saved.</span>}
          <button type="button" onClick={() => prefs && saved && setPrefs(saved)} className="st-btn" disabled={!dirty || saving}>Discard changes</button>
          <button type="button" onClick={save} disabled={saving || !dirty || !!validation} className="st-btn is-primary">
            {saving ? 'Saving…' : justSaved ? 'Saved' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  );
}

function PreviewPanel({ preview, previewing, strategy, dirty, samplePrompt, onSamplePrompt, names, nameOf }: {
  preview: PreferencesPreview | null; previewing: boolean; strategy: Strategy; dirty: boolean;
  samplePrompt: string; onSamplePrompt: (s: string) => void; names: Record<string, string>; nameOf: NameOf;
}) {
  // The landing's animated ranking, fed with this caller's own preview: pick, fallbacks, the rest.
  const view = useMemo(() => previewToSnap(preview, names), [preview, names]);
  const stateText = previewing ? 'Updating…' : dirty ? 'Preview of your unsaved settings' : 'With your saved settings';
  return (
    <Pane
      title="Where your next request goes"
      sub={<span className={`sr-pv-state${previewing ? ' is-busy' : dirty ? ' is-dirty' : ''}`} aria-live="polite">{stateText}</span>}
      tone="accent"
      reveal={false}
    >
      {strategy.id === 'match_task' && (
        <div className="st-field sr-sample">
          <label className="st-field-label" htmlFor="rp-sample">Try a request</label>
          <textarea id="rp-sample" className="st-textarea" rows={2} maxLength={4000}
            placeholder="Paste a prompt to see which strategy and model it would get, e.g. “Fix this TypeError in my React component”"
            value={samplePrompt} onChange={e => onSamplePrompt(e.target.value)} />
        </div>
      )}
      {!preview ? (
        <>
          <p className="st-hint" role="status">Working out where your requests go…</p>
          <div className="sr-skel" aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <span key={i} className="st-skel" />)}</div>
        </>
      ) : !preview.ok ? (
        <>
          <div className="sr-pv-empty" aria-live="polite">
            {preview.error === 'no_provider_keys'
              ? <>
                  <p><b>Add a provider key first:</b> the router calls models with your own keys.</p>
                  <Link href="/router/providers" className="st-btn is-primary is-sm">Add a key</Link>
                </>
              : <p><b>No model can be used with these settings.</b> {preview.message}</p>}
          </div>
          {view && view.snap.rows.length > 0 && (
            <div className={`sr-rank${previewing ? ' is-busy' : ''}`}>
              <p className="st-label"><span>Every model, and why it is out</span><span>{scoreLabel(view.snap.effectiveStrategy, view.kind)}</span></p>
              <RankList rows={view.snap.rows} kind={view.kind} winLabel="your pick" />
            </div>
          )}
        </>
      ) : (
        <>
          <div aria-live="polite">
            {preview.details.taskRule && (
              <p className="sr-rule">This request reads as a <b>{preview.details.taskRule}</b>, so it uses <b>{ALL.find(s => s.id === preview.details.effectiveStrategy)?.name || preview.details.effectiveStrategy}</b>.</p>
            )}
            <ol className="sr-chain" aria-label="Routing order">
              <li className="is-pick">
                <span className="sr-chain-k">First choice</span>
                <span className="sr-chain-m" title={preview.primary.model}>
                  <b>{nameOf(preview.primary.model)}</b>
                  <small>{PROVIDER_LABEL[preview.primary.provider] || preview.primary.provider}{preview.primary.score ? ` · score ${preview.primary.score.toFixed(1)}` : ''}</small>
                </span>
              </li>
              {preview.fallbacks.map((f, i) => (
                <li key={f.model}>
                  <span className="sr-chain-k">{i === 0 ? 'If it fails' : 'Then'}</span>
                  <span className="sr-chain-m" title={f.model}>
                    <b>{nameOf(f.model)}</b>
                    <small>{PROVIDER_LABEL[f.provider] || f.provider}{/your (fallback order|traffic split)/.test(f.reasoning) ? ' · your choice' : ''}</small>
                  </span>
                </li>
              ))}
              {preview.fallbacks.length === 0 && (
                <li className="is-none">
                  <span className="sr-chain-k">If it fails</span>
                  <span className="sr-chain-m"><small>The request fails: automatic fallback is off.</small></span>
                </li>
              )}
            </ol>
          </div>
          {view && (
            <div className={`sr-rank${previewing ? ' is-busy' : ''}`}>
              <p className="st-label"><span>Ranking for your settings</span><span>{scoreLabel(view.snap.effectiveStrategy, view.kind)}</span></p>
              <RankList rows={view.snap.rows} kind={view.kind} winLabel="your pick" />
            </div>
          )}
          {preview.details.split && preview.details.split.length > 0 && (
            <p className="sr-split-note">
              Split: {preview.details.split.map(x => `${nameOf(x.model)} ${Math.round(x.share * 100)}%${x.usable ? '' : ` (unusable: ${x.reason})`}`).join(' · ')}. The first choice above changes from request to request in these proportions.
            </p>
          )}
          <div className="sr-why">
            <p className="st-label">Why this model</p>
            <p>{preview.primary.reasoning}</p>
          </div>
        </>
      )}
    </Pane>
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
      <label className="st-toggle">
        <input type="checkbox" className="st-check" checked={on}
          onChange={e => set({ maxCostPer1kTokens: e.target.checked ? Math.max(0.0001, Math.ceil(median * 100) / 100 / 1000) : null })} />
        <span>
          <b>Maximum price</b>
          <span>Average of a model&apos;s input and output list price, per million tokens.</span>
        </span>
      </label>
      {on && (
        <div className="sr-inline">
          <span>$</span>
          <input type="number" min={0.01} step={0.05} className="st-input sr-num" value={perM}
            aria-label="Maximum price per million tokens"
            onChange={e => set({ maxCostPer1kTokens: (parseFloat(e.target.value) || 0) / 1000 })} />
          <span>per 1M tokens</span>
          {usable.length > 0 && <span className="sr-fit">{fit} of {usable.length} usable models fit{prices.length ? ` (they range ${fmtUsd(prices[0])}–${fmtUsd(prices[prices.length - 1])})` : ''}</span>}
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
      <label className="st-toggle">
        <input type="checkbox" className="st-check" checked={on}
          // Starts at the median of your usable models, so turning it on never empties the list.
          onChange={e => set({ maxLatencyMs: e.target.checked ? Math.ceil(median / 1000) * 1000 : null })} />
        <span>
          <b>Maximum response time</b>
          <span>Measured over the last 7 days of benchmark runs, blended with what the router observes. Reasoning models often take 10–60 s on hard tasks.</span>
        </span>
      </label>
      {on && (
        <div className="sr-inline">
          <input type="number" min={0.1} step={0.5} className="st-input sr-num" value={prefs.maxLatencyMs! / 1000}
            aria-label="Maximum response time in seconds"
            onChange={e => set({ maxLatencyMs: Math.round((parseFloat(e.target.value) || 0) * 1000) })} />
          <span>seconds</span>
          {usable.length > 0 && <span className="sr-fit">{fit} of {usable.length} usable models fit (fastest {fmtSec(lat[0])}, median {fmtSec(median)})</span>}
        </div>
      )}
    </div>
  );
}

function SplitEditor({ prefs, set, modelNames, candidates, split, nameOf }: {
  prefs: UserPreferences; set: (p: Partial<UserPreferences>) => void; modelNames: string[]; candidates: PreviewCandidate[];
  split?: Array<{ model: string; weight: number; share: number; usable: boolean; reason?: string }>;
  nameOf: NameOf;
}) {
  const rows = prefs.trafficSplit || [];
  const total = rows.reduce((a, r) => a + (r.weight || 0), 0);
  const unused = modelNames.filter(m => !rows.some(r => r.model === m));
  const update = (i: number, patch: Partial<{ model: string; weight: number }>) =>
    set({ trafficSplit: rows.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  return (
    <Pane title="Your traffic split" sub="Up to 10 models" reveal={false}>
      {rows.length === 0 && <p className="st-hint sr-split-empty">Add the models to split traffic between, and how much each should get.</p>}
      {rows.length > 0 && total > 0 && (
        <div className="sr-splitbar" aria-hidden="true">
          {rows.map((r, i) => (
            <span key={i} style={{ flexGrow: Math.max(0, r.weight || 0), flexBasis: 0 }} title={`${nameOf(r.model)} ${Math.round(((r.weight || 0) / total) * 100)}%`}>
              {nameOf(r.model)} · {Math.round(((r.weight || 0) / total) * 100)}%
            </span>
          ))}
        </div>
      )}
      <div className="sr-split-rows">
        {rows.map((r, i) => {
          const info = split?.find(x => x.model === r.model);
          const cand = candidates.find(c => c.model === r.model);
          return (
            <div key={i} className="sr-split-row">
              <select className="st-select" value={r.model} aria-label={`Model ${i + 1}`}
                onChange={e => update(i, { model: e.target.value })}>
                {[r.model, ...unused].map(m => <option key={m} value={m}>{nameOf(m)}</option>)}
              </select>
              <input type="number" min={1} max={100} className="st-input sr-num" value={r.weight} aria-label={`Weight for ${r.model}`}
                onChange={e => update(i, { weight: Math.round(parseFloat(e.target.value) || 0) })} />
              <span className="sr-share">{total ? Math.round(((r.weight || 0) / total) * 100) : 0}%</span>
              <span className={`sr-split-state${info && !info.usable ? ' is-bad' : ''}`}>
                {info && !info.usable ? `Not used: ${info.reason}` : cand ? `score ${Math.round(cand.score)}` : ''}
              </span>
              <button type="button" className="st-btn is-sm is-quiet" onClick={() => set({ trafficSplit: rows.filter((_, k) => k !== i) })} aria-label={`Remove ${r.model}`}>Remove</button>
            </div>
          );
        })}
      </div>
      {rows.length < 10 && unused.length > 0 && (
        <button type="button" className="st-btn is-sm sr-split-add"
          onClick={() => set({ trafficSplit: [...rows, { model: unused[0], weight: rows.length ? 20 : 100 }] })}>Add a model</button>
      )}
      <p className="st-hint sr-split-hint">
        Weights are relative: 80 and 20 send about 80% and 20% of requests. If a model fails, the others in your split are tried first, then your fallback order, then the automatic fallbacks. A model with no key, or one you excluded, is skipped.
      </p>
    </Pane>
  );
}

function FallbackOrder({ prefs, set, modelNames, candidates, nameOf }: {
  prefs: UserPreferences; set: (p: Partial<UserPreferences>) => void; modelNames: string[]; candidates: PreviewCandidate[]; nameOf: NameOf;
}) {
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
    <div className="sr-fb">
      <div>
        <div className="sr-fb-t">Your fallback order <small>(optional)</small></div>
        <p className="st-hint">Tried in this order before the automatic fallbacks. Models with no key, excluded ones, and models failing right now are skipped.</p>
      </div>
      {list.length > 0 && (
        <ol className="sr-fb-list">
          {list.map((m, i) => {
            const c = candidates.find(x => x.model === m);
            return (
              <li key={m} className="sr-fb-item">
                <span className="sr-fb-n">{i + 1}</span>
                <ProviderMark provider={c?.provider ?? ''} size="sm" />
                <span className="sr-fb-name" title={m}>
                  <span>{nameOf(m)}</span>
                  {c && c.status !== 'eligible' && <small>{STATUS_TEXT[c.status]}</small>}
                  {!c && candidates.length > 0 && <small>not a ranked model</small>}
                </span>
                <span className="sr-fb-act">
                  <button type="button" className="st-btn is-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${m} up`}>↑</button>
                  <button type="button" className="st-btn is-sm" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={`Move ${m} down`}>↓</button>
                  <button type="button" className="st-btn is-sm is-quiet" onClick={() => set({ fallbackOrder: list.filter(x => x !== m) })} aria-label={`Remove ${m}`}>Remove</button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {list.length < 10 && (
        <div className="sr-add">
          <select className="st-select" value={pick} onChange={e => setPick(e.target.value)} aria-label="Model to add to your fallback order">
            <option value="">Choose a model…</option>
            {options.map(m => <option key={m} value={m}>{nameOf(m)}</option>)}
          </select>
          <button type="button" className="st-btn" disabled={!pick}
            onClick={() => { if (pick) { set({ fallbackOrder: [...list, pick] }); setPick(''); } }}>Add</button>
        </div>
      )}
    </div>
  );
}
