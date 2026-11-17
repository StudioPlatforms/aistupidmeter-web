'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import { apiClient, ApiRequestError, endpointEntryLabel, isEndpointEntry, isModelSource } from '@/lib/api-client';
import type {
  UserPreferences, RoutingStrategyId, PreferencesPreview, PreviewCandidate, PreviewChainEntry, PreviewEndpoint, TieBreak,
  ModelSource, EndpointList, ListedHost,
} from '@/lib/api-client';
import { PageHead, Pane, Loader, Note, Tag, ProviderMark, RankList, previewToSnap, useModelNames } from '@/components/studio';
import { scoreLabel } from '@/components/landing/util';
import { addKeyHref, providerList, routerProvider } from '@/lib/router-providers';
import { SCORING_TODAY, fastestQualityCard, scoringOf, tieBreakDesc, tieHint, tiePaneSub, type RouterScoring } from '@/lib/router-scoring';
import {
  ADAPTIVE_DEFAULTS, MATCH, NO_FACTS, OWN_RULES_NOTE, PAGE_LEAD, ROUTER_SCORE_V2, STRATEGY_SUB, adaptiveFactsOf, adaptiveOf, conversationLine,
  hasAdaptive, matchedLine, matchingApplies, scopeNote, splitNote, tieHintAdaptive, toolNamesOf, type AdaptiveFacts,
} from '@/lib/router-adaptive';
import { MatchBlock, Rich, SAMPLE_EMPTY, SampleInputs, ScopeControl, SwitchingPane, type SampleState } from '@/components/router/AdaptiveSettings';
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
 *
 * Model source (R4, staff only; plan "Private endpoints" §3 R4 "Web", §6.2, D45) decides where
 * models come from: All connected, Prefer my endpoints or Only my endpoints. It is the one control
 * for that. The other panes keep their jobs and say how the source changes them: under Only the
 * cloud-only panes (Providers and models, ties, the traffic split, the fallback order) step aside,
 * and the stored exclusions come back on a switch. The pane appears only when GET
 * /router/preferences carries `modelSource` (the API's way of saying it supports it), and then
 * when GET /router/endpoints answers 200, or whenever the saved source is not All, so a user can
 * always switch back. A save that sent a Model source counts as saved only when the PUT echoes it.
 *
 * Router release A2 (adaptive-routing plan §5.2; staff first): when GET /router/preferences carries the four A2
 * settings, the page adds Match each request (under the Best overall and Best value cards), Apply this strategy to
 * (under the cards), the Model switching pane (after Routing strategy) and the preview's sample request, and words its
 * lead, the strategy pane, the tie-break hint and the split note for them (lib/router-adaptive). A stored "Match each
 * request" strategy then comes back as Best overall with matching on, so its card leaves "Your own rules". Without the
 * settings every pane is as before and nothing new is sent.
 *
 * Listed hosts (Phase 3 M8, plan §2.17, §8.2): when GET /router/marketplace answers 200 with hosts the account
 * connected, "Providers and models" gains a "Listed providers" group with a "Use in routing" toggle per host (saved
 * at once, on the connection), and Model source is shown with Prefer available even without an endpoint of the
 * account's own: under Prefer the measured models of the listed hosts it connected come after its own endpoints.
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
    note: 'The best model you can use on the benchmark that matches the work. When several are statistically tied, your tie-break below picks among them.',
    items: [
      { id: 'best_overall', name: 'Best overall', desc: 'Best combined score across all three benchmarks.', basis: 'Combined score: coding 50%, reasoning 25%, tool use 25%', modelId: 'auto-best', recommended: true },
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
      // Its desc and basis follow the router's live scoring (lib/router-scoring fastestQualityCard); these are v1's.
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
      { id: 'match_task', name: 'Match each request', desc: 'Reads each request and picks the matching benchmark: tools → tool use, or coding when they work on files, code or a terminal; design, planning, or a conversation already eight or more messages long when it first reaches the router → reasoning; code → coding; anything else → overall.', basis: 'Chosen per request; the routing reason names the rule', modelId: 'auto-task' },
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
  avoidDrifting: true, fallbackOrder: [], trafficSplit: [], tieBreak: 'cheaper',
};

/** The strategies whose pick a tie-break can settle (match_task resolves to them per request). */
const TIE_STRATEGIES = new Set<RoutingStrategyId>(['best_overall', 'best_coding', 'best_reasoning', 'best_tooling', 'match_task']);

/** Each one's description follows the router's live scoring (lib/router-scoring tieBreakDesc). */
const TIE_BREAKS: Array<{ id: TieBreak; label: string }> = [
  { id: 'cheaper', label: 'Cheaper' },
  { id: 'faster', label: 'Faster' },
  { id: 'highest', label: 'Highest score' },
];

const STATUS_TEXT: Record<PreviewCandidate['status'], string> = {
  eligible: 'can be used', no_key: 'no provider key', excluded: 'excluded', over_cost: 'over your cost limit',
  over_latency: 'over your latency limit', no_tools: 'no tool calling', no_forced_tools: 'cannot force a tool call',
};

// ── Model source (R4) ─────────────────────────────────────────────────────────────────────────

const SOURCE_NAME: Record<ModelSource, string> = {
  all: 'All connected', prefer_endpoints: 'Prefer my endpoints', only_endpoints: 'Only my endpoints',
};

/** The three choices, one row each; the selected one is explained in full under the list (SourceExplanation). */
const SOURCES: Array<{ id: ModelSource; short: string; danger?: string }> = [
  { id: 'all', short: 'Benchmarked cloud models. Your endpoints answer when a request names them.' },
  { id: 'prefer_endpoints', short: 'Your endpoints first, then benchmarked cloud models.' },
  { id: 'only_endpoints', short: 'Your endpoints and nothing else.', danger: 'No built-in provider is ever called for your personal keys.' },
];

/** Prefer's line for an account with a listed host connected (M8). */
const LISTED_PREFER_SHORT = 'Your endpoints first, then measured models of the listed hosts you connected, then benchmarked cloud models.';

/** §6.2 "Endpoint statuses in the preview". STATUS_TEXT above stays cloud-only. */
const ENDPOINT_STATUS_TEXT: Record<string, string> = {
  eligible: 'can be used', paused: 'paused', needs_test: 'needs a new test', blocked: 'blocked address', auth_failed: 'key refused',
  endpoint_down: 'not answering', busy: 'at its limit', no_tools: 'no tool calling', context_too_small: 'context too small for this prompt',
  over_cost: 'over your cost limit', over_latency: 'over your latency limit', over_plan_limit: 'over your plan’s endpoint limit',
  gone: 'no longer available', quarantined: 'paused after a router crash',
};

/** GET /router/endpoints, read only when the API advertises Model source. */
type EndpointsState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; list: EndpointList }
  /** 404: endpoints are not switched on for this account. */
  | { kind: 'off' }
  /** 503: the server's endpoint code is not available right now. */
  | { kind: 'unavailable' }
  | { kind: 'error' };

/** A save that sent a Model source which the PUT did not echo (D45). */
interface SourceNotice { echo: ModelSource | null; sourceChanged: boolean; otherSaved: boolean }

const fmtUsd = (n: number) => (n >= 1 ? `$${n.toFixed(2)}` : n >= 0.1 ? `$${n.toFixed(2)}` : `$${n.toFixed(3)}`);
const fmtSec = (ms: number | null) => (ms == null ? '—' : ms < 10_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 1000)} s`);
const norm = (p: UserPreferences): UserPreferences => ({ ...DEFAULTS, ...p, fallbackOrder: p.fallbackOrder ?? [], trafficSplit: p.trafficSplit ?? [] });
/**
 * This page's own edits (each setting where `mine` differs from `base`, the version the page read) on top of
 * `fresh`, the settings stored now. Used after a 409 (R4b): a setting changed elsewhere and not here shows its
 * stored value, so a later save does not quietly put back what this page read.
 */
const rebase = (mine: UserPreferences, base: UserPreferences, fresh: UserPreferences): UserPreferences => {
  const m = norm(mine) as unknown as Record<string, unknown>;
  const b = norm(base) as unknown as Record<string, unknown>;
  const out = { ...norm(fresh) } as unknown as Record<string, unknown>;
  for (const k of Object.keys(m)) if (JSON.stringify(m[k]) !== JSON.stringify(b[k])) out[k] = m[k];
  return out as unknown as UserPreferences;
};
const plural = (n: number, word: string) => (n ? `${n} ${word}${n === 1 ? '' : 's'}` : '');

/**
 * The preview's sample fields once the A2 settings are there (POST /router/preferences/preview): the prompt and its
 * tools while Match each request applies to requests sent as auto, and the conversation it continues, which Model
 * switching re-checks. Under Only my endpoints, neither (both panes are hidden there). Only what the page shows is sent.
 */
function sampleFor(prefs: UserPreferences, prompt: string, sample: SampleState): {
  samplePrompt?: string; sampleHasTools?: boolean; sampleToolNames?: string[];
  sampleConversationModel?: string | null; sampleTurnKind?: 'new_message' | 'tool_result';
} {
  if (prefs.modelSource === 'only_endpoints') return {};
  return {
    ...(matchingApplies(prefs) ? { samplePrompt: prompt, sampleHasTools: sample.hasTools, sampleToolNames: sample.hasTools ? toolNamesOf(sample.toolNames) : [] } : {}),
    sampleConversationModel: sample.conversationModel || null,
    sampleTurnKind: sample.conversationModel ? sample.turnKind : 'new_message',
  };
}

/** Declared price per 1M tokens for an endpoint model ("price not declared" counts as $0). */
function declaredPrice(e: PreviewEndpoint): string {
  if (e.priceInPerMTok == null && e.priceOutPerMTok == null) return 'price not declared';
  const usd = (n: number | null) => (!n ? '$0' : fmtUsd(n));
  return `${usd(e.priceInPerMTok)} in / ${usd(e.priceOutPerMTok)} out per 1M`;
}

/** Model id → display name, falling back to the id while names load (or for an unlisted model). */
type NameOf = (model: string) => string;

/** "an Anthropic", "a Google". */
const an = (word: string) => `${/^[AEIOU]/i.test(word) ? 'an' : 'a'} ${word}`;

/** A model in a picker, marked when its provider has no key (choosing it would be skipped). */
function optionLabel(model: string, candidates: PreviewCandidate[], nameOf: NameOf): string {
  const c = candidates.find(x => x.model === model);
  return c?.status === 'no_key' ? `${nameOf(model)} (no ${PROVIDER_LABEL[c.provider] || c.provider} key)` : nameOf(model);
}

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
  // Model source (R4): the account's endpoints, read only when the API advertises the setting.
  const [endpoints, setEndpoints] = useState<EndpointsState>({ kind: 'idle' });
  // Listed hosts the account connected (M8): [] while unknown and for every account the marketplace is not open to.
  const [listedHosts, setListedHosts] = useState<ListedHost[]>([]);
  const [listedMsg, setListedMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [listedBusy, setListedBusy] = useState<string | null>(null);
  // A save whose Model source the API did not echo (D45); shown in the Model source pane.
  const [sourceNotice, setSourceNotice] = useState<SourceNotice | null>(null);
  // A save refused because the source was changed elsewhere since this page read it (409
  // model_source_changed, R4b): the API's own message.
  const [conflict, setConflict] = useState<string | null>(null);
  // The newest preview's word on whether endpoint routing is paused for this account (`endpointsPaused`,
  // R4 API 58add09: the kill switch, the flag or a runtime that did not load), which GET /router/endpoints
  // does not show for the kill switch. An older answer says it only through Only's endpoints_disabled.
  const [pausedNow, setPausedNow] = useState(false);
  // How the router scores right now (API A1: GET /router/preferences `scoring`), which the tie pane's words follow.
  const [scoring, setScoring] = useState<RouterScoring>(SCORING_TODAY);
  // A2's facts from the same answer (the drift exit, the account's move-cost example, its last 7 days): not settings.
  const [facts, setFacts] = useState<AdaptiveFacts>(NO_FACTS);
  // The preview's sample request beyond its prompt (A2): tools, and the conversation it continues.
  const [sample, setSample] = useState<SampleState>(SAMPLE_EMPTY);
  const previewSeq = useRef(0);
  const names = useModelNames();
  const nameOf: NameOf = useCallback(m => names[m] ?? m, [names]);

  const loadEndpoints = useCallback(async () => {
    setEndpoints({ kind: 'loading' });
    try {
      setEndpoints({ kind: 'ok', list: await apiClient.getEndpoints() });
    } catch (err) {
      const code = err instanceof ApiRequestError ? err.status : 0;
      setEndpoints({ kind: code === 404 ? 'off' : code === 503 ? 'unavailable' : 'error' });
    }
  }, []);

  const loadListed = useCallback(async () => {
    try {
      const r = await apiClient.getListedHosts();
      setListedHosts((Array.isArray(r.hosts) ? r.hosts : []).filter(h => h.connection));
    } catch {
      setListedHosts([]);   // 404 (not offered), or unreadable: the page is as it is without listed hosts
    }
  }, []);

  const toggleListed = useCallback(async (h: ListedHost, on: boolean) => {
    setListedBusy(h.slug);
    setListedMsg(null);
    try {
      const r = await apiClient.updateListedHost(h.slug, { useInRouting: on });
      setListedHosts(l => l.map(x => (x.slug === h.slug ? (r.host ?? { ...x, connection: x.connection ? { ...x.connection, useInRouting: on } : null }) : x)));
      setListedMsg({ tone: 'good', text: on ? `${h.displayName} is used in routing again.` : `${h.displayName} is no longer used in routing. Requests that name its models still reach it.` });
    } catch (err) {
      setListedMsg({ tone: 'bad', text: err instanceof Error ? err.message : 'Not saved. Try again.' });
    } finally {
      setListedBusy(null);
    }
  }, []);

  /**
   * The saved preferences, as the page keeps them: a Model source it does not know is dropped, so a save never
   * sends it back. The router's `scoring` (A1) is the API's state, not a setting: it is kept apart, never saved.
   */
  const readSaved = useCallback(async (): Promise<UserPreferences> => {
    const { scoring: live, driftExit, switchCostExample, routedLast7d, ...saved } = await apiClient.getPreferences();
    setScoring(scoringOf(live));
    setFacts(adaptiveFactsOf({ driftExit, switchCostExample, routedLast7d }));
    const p = norm(saved);
    if (!isModelSource(p.modelSource)) delete p.modelSource;
    return p;
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const p = await readSaved();
      // best_creative is routed as best_overall since 2026-10-05; the API already returns that.
      setSaved(p);
      setPrefs(p);
      // The API advertises Model source by sending it (D45); only then do the account's endpoints matter here.
      if (p.modelSource) void loadEndpoints();
      else setEndpoints({ kind: 'idle' });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your preferences.');
    }
  }, [readSaved, loadEndpoints]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      apiClient.setUserId(session.user.id);
      load();
      void loadListed();
    }
  }, [status, session, load, loadListed]);

  // Live preview of the unsaved settings, debounced.
  useEffect(() => {
    if (!prefs) return;
    const seq = ++previewSeq.current;
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        // A2: the sample request goes with the settings it tests (sampleFor); before A2, today's body exactly.
        const r = await apiClient.previewPreferences(hasAdaptive(prefs)
          ? { ...prefs, ...sampleFor(prefs, samplePrompt, sample) }
          : { ...prefs, samplePrompt: prefs.routingStrategy === 'match_task' ? samplePrompt : undefined });
        if (seq === previewSeq.current) {
          setPreview(r);
          if (r.details?.candidates?.length) setCandidates(r.details.candidates);
          // Under Only my endpoints no cloud model is considered, so that preview says nothing about provider keys.
          if (r.ok && r.modelSource !== 'only_endpoints' && Array.isArray(r.providers)) setKeyed(r.providers);
          else if (!r.ok && r.error === 'no_provider_keys') setKeyed([]);
          if (typeof r.endpointsPaused === 'boolean') setPausedNow(r.endpointsPaused);
          else if (!r.ok && r.error === 'endpoints_disabled') setPausedNow(true);
        }
      } catch (err) {
        if (seq === previewSeq.current) setPreview({ ok: false, error: 'no_candidates', message: err instanceof Error ? err.message : 'Preview unavailable.' });
      } finally {
        if (seq === previewSeq.current) setPreviewing(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [prefs, samplePrompt, sample]);

  const dirty = useMemo(() => !!prefs && !!saved && JSON.stringify(norm(prefs)) !== JSON.stringify(norm(saved)), [prefs, saved]);
  const modelNames = useMemo(() => [...candidates].sort((a, b) => b.score - a.score).map(c => c.model), [candidates]);
  // Providers this account has a working key for. Read off the candidates (a model's status is
  // no_key before anything else), so it stays right when a preview finds nothing usable.
  const keyedProviders = useMemo<string[] | null>(() => {
    if (candidates.length) return Array.from(new Set(candidates.filter(c => c.status !== 'no_key').map(c => c.provider)));
    return keyed;
  }, [candidates, keyed]);
  const noKeyProviders = useMemo(() => (keyedProviders === null ? [] : PROVIDERS.filter(p => !keyedProviders.includes(p))), [keyedProviders]);

  const validation = useMemo(() => {
    if (!prefs) return null;
    if (prefs.routingStrategy === 'custom_split' && !(prefs.trafficSplit || []).length) {
      // Under Only my endpoints the split editor is not shown (the split names cloud models).
      return prefs.modelSource === 'only_endpoints'
        ? 'Your traffic split is empty. Choose another strategy, or add models to the split under another Model source.'
        : 'Add at least one model to your traffic split.';
    }
    if ((prefs.trafficSplit || []).some(x => !(x.weight >= 1 && x.weight <= 100))) return 'Each weight must be between 1 and 100.';
    if (prefs.maxCostPer1kTokens !== null && !(prefs.maxCostPer1kTokens > 0)) return 'Set a maximum cost above $0, or turn the limit off.';
    if (prefs.maxLatencyMs !== null && !(prefs.maxLatencyMs >= 100)) return 'Set a maximum latency of at least 0.1 s, or turn the limit off.';
    return null;
  }, [prefs]);

  const save = async () => {
    if (!prefs || !saved || validation) return;
    setSaving(true);
    setSaveError(null);
    setSourceNotice(null);
    setConflict(null);
    const sent = prefs.modelSource;
    // R4b: the source changes only by compare-and-set. `saved.modelSource` is the source this page last
    // read or had echoed (D45), sent on every save; a stale page gets 409 instead of undoing a newer choice.
    const from = saved.modelSource;
    try {
      const r = await apiClient.updatePreferences({ ...prefs, requireStreaming: false, ...(from ? { modelSourceFrom: from } : {}) });
      const echo = isModelSource(r?.modelSource) ? r.modelSource : null;
      if (sent !== undefined && echo !== sent) {
        // D45: the API answers with the Model source it stored. No echo means a server without the
        // setting, which saves the other fields and ignores this one; any other echo means it kept
        // another value. Either way it is not reported as saved: say so, and show what was stored.
        setSourceNotice({
          echo,
          sourceChanged: sent !== saved.modelSource,
          otherSaved: JSON.stringify(norm({ ...prefs, modelSource: saved.modelSource })) !== JSON.stringify(norm(saved)),
        });
        try {
          const p = await readSaved();
          setSaved(p);
          setPrefs(p);
        } catch {
          const kept = { ...prefs, modelSource: echo ?? saved.modelSource };
          setSaved(kept);
          setPrefs(kept);
        }
        return;
      }
      // A2: the PUT answers with the stored settings where the features apply. The page keeps what was stored; with no
      // echo for settings it sent (the features no longer apply), it reads the preferences again, without the panes.
      if (hasAdaptive(prefs)) {
        const stored = adaptiveOf(r);
        if (!stored) {
          try { const p = await readSaved(); setSaved(p); setPrefs(p); } catch { setSaved(prefs); }
        } else {
          const kept = { ...prefs, ...stored };
          setSaved(kept);
          if (JSON.stringify(norm(kept)) !== JSON.stringify(norm(prefs))) setPrefs(kept);
        }
      } else {
        setSaved(prefs);
      }
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409 && err.error === 'model_source_changed') {
        // The source was changed elsewhere (another tab or device). Nothing was saved, or in a rare race
        // the other settings but not the source; the API's message says which. Show it, read the stored
        // settings again and take their source as current, with this page's other edits kept on top, so a
        // new save is an informed one.
        setConflict(err.message || 'Model source was changed elsewhere since this page loaded. Nothing was saved. Reload to see the current settings, then save again.');
        const current = isModelSource(err.body.modelSource) ? err.body.modelSource : undefined;
        try {
          const p = await readSaved();
          setSaved(p);
          setPrefs({ ...rebase(prefs, saved, p), modelSource: p.modelSource });
        } catch {
          setSaved({ ...saved, modelSource: current ?? saved.modelSource });
          setPrefs({ ...prefs, modelSource: current ?? saved.modelSource });
        }
        return;
      }
      setSaveError(saveErrorText(err));
      // A refusal about endpoints may mean they changed since the page loaded: read them again.
      if (err instanceof ApiRequestError && ['no_endpoints', 'endpoints_disabled', 'plan_required'].includes(err.error ?? '')) void loadEndpoints();
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
  // A2 (plan §5.2): the API sent the four settings, so the features apply to this account.
  const a2 = hasAdaptive(saved);
  const excludedCount = prefs.excludedProviders.length + prefs.excludedModels.length;

  // ── Model source (R4) ──
  // The saved value is the API's capability flag (D45); the unsaved one drives the rest of the page.
  const savedSource: ModelSource | null = saved?.modelSource ?? null;
  const source: ModelSource | null = savedSource ? prefs.modelSource ?? savedSource : null;
  const only = source === 'only_endpoints';
  const prefer = source === 'prefer_endpoints';
  const epList = endpoints.kind === 'ok' ? endpoints.list : null;
  // Why only All connected can be chosen: endpoints off for this account or on the server, a plan
  // without them, or not known yet. Switching to All is never blocked (§2.5).
  const lock: 'paused' | 'plan' | 'unknown' | null = !savedSource ? null
    : endpoints.kind === 'off' || endpoints.kind === 'unavailable' ? 'paused'
    : epList ? (epList.limits.max === 0 ? 'plan' : null)
    : 'unknown';
  // Endpoints with a model a request can be routed to: on, within the plan, a tested model turned on.
  // From R5 a workspace server shared with members counts too: Prefer and Only use it (contract §5).
  const usableEndpoints = epList
    ? [...epList.endpoints, ...epList.shared].filter(e => e.active && !e.overPlanLimit && (e.enabledModelCount ?? 0) > 0 && e.healthState !== 'quarantined')
    : [];
  // M8: connected listed hosts the router may use under Prefer (in use, not paused).
  const listedInUse = listedHosts.filter(h => h.connection && h.connection.useInRouting && h.connection.state !== 'paused');
  const listedPrefer = listedInUse.length > 0;
  const showSource = (!!savedSource && (endpoints.kind === 'ok' || savedSource !== 'all' || listedHosts.length > 0)) || !!sourceNotice;
  // Prefer with listed hosts and no endpoints offered to the account: nothing is paused, the listed hosts answer first.
  const banner: 'paused' | 'plan' | null = !savedSource || savedSource === 'all' ? null
    : savedSource === 'prefer_endpoints' && listedPrefer && (endpoints.kind === 'off' || lock === 'plan') ? null
    : lock === 'paused' || pausedNow ? 'paused'
    : lock === 'plan' ? 'plan'
    : null;
  const sourceDisabled = (id: ModelSource) => id !== 'all' && !(id === 'prefer_endpoints' && listedPrefer) && (lock !== null || usableEndpoints.length === 0);
  const sourceHint: ReactNode = !savedSource || banner ? null
    : listedPrefer && usableEndpoints.length === 0 ? 'Prefer my endpoints uses the listed hosts you connected. Only my endpoints needs an endpoint of your own.'
    : lock === 'plan' ? 'Your own endpoints are included in Pro and above.'
    : lock === 'unknown'
      ? (endpoints.kind === 'error'
          ? <>Your endpoints could not be read, so only All connected can be chosen right now. <button type="button" className="sr-linkbtn" onClick={() => void loadEndpoints()}>Try again</button></>
          : 'Checking your endpoints…')
      : usableEndpoints.length === 0 ? <>Add and test an endpoint on <Link href="/router/providers">Providers</Link> first.</> : null;
  const noneReady = only && !banner && lock === null && (usableEndpoints.length === 0
    || (!!preview && !preview.ok && (preview.error === 'no_endpoints' || preview.error === 'endpoints_unavailable')));
  const sharedWorkspace = (epList?.shared.length ?? 0) > 0;
  // Provider keys matter unless Only my endpoints is chosen, and "nothing can be routed" holds only
  // while the preview finds nothing (under All with fallback on, or Prefer, endpoints may answer).
  // An account with a listed host connected can already route requests that name its models (M8): not "nothing".
  const needKeyNote = keyedProviders !== null && keyedProviders.length === 0 && !only && !(preview && preview.ok) && listedHosts.length === 0;

  return (
    <>
      <PageHead
        kicker="Smart Router"
        title="Routing preferences"
        lead={a2 ? <Rich text={PAGE_LEAD} /> : HEAD_LEAD}
        actions={<>
          {/* Reset keeps the Model source (§2.5): DEFAULTS has none, and Model source has its own control. The A2
              settings, when the API sent them, go back to theirs (plan §5.5). */}
          <button type="button" onClick={() => setPrefs({ ...norm(DEFAULTS), modelSource: prefs.modelSource, ...(a2 ? ADAPTIVE_DEFAULTS : {}) })} className="st-btn" disabled={saving}
            title={savedSource ? 'Resets routing settings. Model source is not changed.' : undefined}>Reset to defaults</button>
          <button type="button" onClick={save} disabled={saving || !dirty || !!validation} className="st-btn is-primary">
            {saving ? 'Saving…' : justSaved ? 'Saved' : 'Save changes'}
          </button>
        </>}
      />

      <div className="st-body sr-prefs">
        {saveError && <Note tone="bad" title="Not saved">{saveError}</Note>}
        {conflict && <Note tone="warn" title="Model source changed elsewhere">{conflict}</Note>}
        {needKeyNote && (
          <Note tone="warn" title="Add a provider key first">
            These settings decide among the models your provider keys can reach, and you have not added one yet, so nothing
            can be routed. You can still choose your settings now: they apply as soon as you add a key.
            <div className="sk-note-act">
              <Link href={addKeyHref()} className="st-btn is-primary is-sm">Add a provider key <span className="st-ar" aria-hidden="true">→</span></Link>
            </div>
          </Note>
        )}

        <div className="sr-pgrid">
          <aside className="sr-pside" aria-label="Live preview">
            <PreviewPanel preview={preview} previewing={previewing} strategy={strategy} dirty={dirty}
              samplePrompt={samplePrompt} onSamplePrompt={setSamplePrompt} names={names} nameOf={nameOf}
              source={source} fallbackOn={prefs.fallbackEnabled} paused={pausedNow}
              adaptive={a2 ? { matching: matchingApplies(prefs), sample, onSample: setSample, models: modelNames, scoring } : null} />
          </aside>

          <div className="sr-pmain">
            {/* Model source (R4): where models come from. First, because every pane below depends on it. */}
            {showSource && (
              <SourcePane
                value={source}
                savedSource={savedSource}
                onPick={id => set({ modelSource: id })}
                isDisabled={sourceDisabled}
                banner={banner}
                hint={sourceHint}
                noneReady={noneReady}
                notice={sourceNotice}
                sharedWorkspace={sharedWorkspace}
                listed={listedHosts.length > 0}
              />
            )}

            {/* Strategy */}
            <Pane title="Routing strategy" sub={a2 ? STRATEGY_SUB : <>Used for <code className="st-ic">model: &quot;auto&quot;</code>. Any request can pick another by sending its model id.</>} ruled>
              {(only || prefer) && (
                <div className="sr-src-strat">
                  <Note>
                    {only
                      ? <>Your endpoints are not benchmarked. Quality and value strategies use your endpoint order and what you tagged each model for (Use for, on Providers); Lowest list price uses your declared prices; Fastest uses the latency measured on your own requests.</>
                      : <>Your endpoints come first and are not benchmarked: quality and value strategies keep your endpoint order and what you tagged each model for, Lowest list price uses your declared prices, and Fastest the latency measured on your own requests. The cloud models after them are ranked as each strategy below describes.</>}
                  </Note>
                </div>
              )}
              {GROUPS.map(g => (
                <div key={g.title} className="sr-group">
                  <h3 className="sr-group-t">{g.title}</h3>
                  {/* The group notes and "Ranks on" lines describe benchmark rankings, which Only my endpoints never uses. */}
                  {!only && <p className="sr-group-n">{a2 && g.items.some(s => s.id === 'match_task') ? OWN_RULES_NOTE : g.note}</p>}
                  <div className="st-cards" style={{ '--min': '230px' } as CSSProperties}>
                    {/* A2: Match each request is the toggle under Best value, so its card is not offered twice. */}
                    {g.items.filter(item => !(a2 && item.id === 'match_task')).map(item => {
                      const s = item.id === 'fastest_quality' ? { ...item, ...fastestQualityCard(scoring) } : item;
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
                          {!only && <span className="sr-strat-basis">Ranks on: {s.basis}</span>}
                          <span className="sr-strat-id">Per request: <code>{s.modelId}</code></span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Under Only the split editor is hidden, so the split's one sentence (splitRule) goes where its card is. */}
                  {only && g.items.some(s => s.id === 'custom_split') && prefs.routingStrategy === 'custom_split' && preview?.splitRule?.text && (
                    <p className="sr-note-line sr-split-src is-only">{preview.splitRule.text}</p>
                  )}
                  {/* A2: Match each request under the Best overall and Best value cards; under Only my endpoints, one line instead. */}
                  {a2 && g.items.some(s => s.id === 'best_value') && (only
                    ? <p className="sr-note-line sr-match-off">{MATCH.onlyEndpoints}</p>
                    : <MatchBlock on={prefs.requestMatching === true} strategy={prefs.routingStrategy} scope={prefs.strategyScope === 'all' ? 'all' : 'auto'}
                        tieBreak={prefs.tieBreak ?? 'cheaper'} onChange={on => set({ requestMatching: on })} />)}
                </div>
              ))}
              {/* A2: which requests follow this page, under the cards. */}
              {a2 && (
                <ScopeControl value={prefs.strategyScope === 'all' ? 'all' : 'auto'} note={scopeNote(prefs.strategyScope === 'all' ? 'all' : 'auto', facts.routedLast7d)}
                  onChange={v => set({ strategyScope: v })} />
              )}
            </Pane>

            {/* A2: Model switching, after Routing strategy; hidden under Only my endpoints (the line above says why). */}
            {a2 && !only && (
              <SwitchingPane value={prefs.modelSwitching ?? 'conversation'} cap={prefs.switchCostCapUsd === undefined ? ADAPTIVE_DEFAULTS.switchCostCapUsd : prefs.switchCostCapUsd}
                matching={prefs.requestMatching === true} facts={facts} nameOf={nameOf}
                onSwitching={v => set({ modelSwitching: v })} onCap={v => set({ switchCostCapUsd: v })} />
            )}

            {/* Ties, the traffic split and the fallback order are about cloud models: not shown under Only (§6.2). */}
            {!only && <TieBreakPane prefs={prefs} set={set} scoring={scoring} a2={a2} />}

            {!only && prefs.routingStrategy === 'custom_split' && (
              <SplitEditor prefs={prefs} set={set} modelNames={modelNames} candidates={candidates} nameOf={nameOf}
                split={preview?.details?.split} rule={preview?.splitRule?.text} />
            )}

            {/* Limits */}
            <Pane title="Limits">
              <div className="sr-stack">
                <LimitCost prefs={prefs} set={set} candidates={candidates} source={source} />
                <LimitLatency prefs={prefs} set={set} candidates={candidates} source={source} />
                <label className="st-toggle">
                  <input type="checkbox" className="st-check" checked={prefs.requireToolCalling}
                    onChange={e => set({ requireToolCalling: e.target.checked })} />
                  <span>
                    <b>Only models that support tool calling</b>
                    <span>Requests that offer tools already go only to models that can use them.</span>
                  </span>
                </label>
                {!only && prefs.routingStrategy === 'custom_split' && <p className="sr-note-line">Cost and latency limits do not apply to models you list in your traffic split.</p>}
              </div>
            </Pane>

            {/* Providers and models */}
            <Pane
              title="Providers and models"
              sub={excludedCount
                ? `${[plural(prefs.excludedProviders.length, 'provider'), plural(prefs.excludedModels.length, 'model')].filter(Boolean).join(', ')} excluded`
                : 'Nothing excluded'}
            >
              {only ? (
                // §6.2: replaced under Only. The API keeps the list (the tombstone holds the real one aside, §2.5).
                <p className="st-text sr-src-kept">Cloud providers are not used for your personal keys (Only my endpoints). Your exclusions are kept and come back if you switch.</p>
              ) : (<>
              <p className="st-label sr-sublabel">Providers</p>
              <div className="sr-chips">
                {PROVIDERS.map(p => {
                  const excluded = prefs.excludedProviders.includes(p);
                  const noKey = noKeyProviders.includes(p);
                  // A provider with no key cannot be used, so excluding it means nothing: the chip
                  // says what is missing and opens the dialog to add the key instead.
                  if (noKey && !excluded) {
                    return (
                      <Link key={p} href={addKeyHref(p)} className="st-chip sr-chip is-nokey"
                        title={`No ${PROVIDER_LABEL[p]} key yet: the router skips its models. Click to add one.`}>
                        <ProviderMark provider={p} size="sm" />
                        {PROVIDER_LABEL[p]} · <span className="sr-addkey">Add key</span>
                      </Link>
                    );
                  }
                  return (
                    <button type="button" key={p} aria-pressed={excluded}
                      className={`st-chip sr-chip${excluded ? ' is-off' : ''}`}
                      title={excluded ? 'Excluded: click to include' : 'Click to exclude'}
                      onClick={() => set({ excludedProviders: excluded ? prefs.excludedProviders.filter(x => x !== p) : [...prefs.excludedProviders, p] })}>
                      <ProviderMark provider={p} size="sm" />
                      {excluded && <span className="sr-x" aria-hidden="true">✕</span>}
                      {PROVIDER_LABEL[p]}
                    </button>
                  );
                })}
              </div>
              <p className="st-hint">
                {noKeyProviders.length > 0 && keyedProviders && keyedProviders.length > 0
                  ? <>The router only uses providers you have a key for. With no key yet for {providerList(noKeyProviders)}, their models are skipped: add a key to include them. </>
                  : <>The router only uses providers you have added a key for. Click one to exclude it. </>}
                {/* Said once, here, where the exclusions are (Model source does not repeat it). */}
                {savedSource && <>Exclusions apply to cloud models, under All connected and Prefer my endpoints alike. </>}
                <Link href="/router/providers">Manage provider keys</Link>.
              </p>
              <p className="st-label sr-sublabel">Models</p>
              {candidates.length === 0 ? (
                <p className="st-hint">{previewing ? 'Loading models…' : 'No ranked models to show yet.'}</p>
              ) : (() => {
                const sorted = [...candidates].sort((a, b) => b.score - a.score);
                // Models whose provider has no key go in their own list, by provider, with the way to
                // add that key: excluding them would change nothing.
                const needKey = sorted.filter(c => c.status === 'no_key' && !prefs.excludedModels.includes(c.model));
                const usable = sorted.filter(c => !needKey.includes(c));
                const byProvider = PROVIDERS.map(p => ({ p, models: needKey.filter(c => c.provider === p) })).filter(g => g.models.length);
                return (
                  <>
                    {usable.length > 0 ? (
                      <div className="sr-chips">
                        {usable.map(c => {
                          const excluded = prefs.excludedModels.includes(c.model);
                          const covered = prefs.excludedProviders.includes(c.provider);
                          return (
                            <button type="button" key={c.model} aria-pressed={excluded}
                              className={`st-chip sr-chip${excluded ? ' is-off' : ''}${covered && !excluded ? ' is-dim' : ''}`}
                              title={`${c.model} · ${PROVIDER_LABEL[c.provider] || c.provider} · score ${Math.round(c.score)} · ${STATUS_TEXT[c.status]}`}
                              onClick={() => set({ excludedModels: excluded ? prefs.excludedModels.filter(x => x !== c.model) : [...prefs.excludedModels, c.model] })}>
                              {excluded && <span className="sr-x" aria-hidden="true">✕</span>}
                              {nameOf(c.model)}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="st-hint">No model can be used until you add a provider key.</p>
                    )}
                    <p className="st-hint">Click a model to exclude it. Faded models belong to a provider you excluded.</p>
                    {byProvider.length > 0 && (
                      <div className="sr-needkey">
                        <p className="st-label sr-sublabel">Need a key you have not added</p>
                        {byProvider.map(({ p, models }) => (
                          <div key={p} className="sr-needkey-row">
                            <span className="sr-needkey-p"><ProviderMark provider={p} size="sm" />{PROVIDER_LABEL[p]}</span>
                            <span className="sr-needkey-m">{models.map((c, i) => <Fragment key={c.model}>{i ? ', ' : ''}<span className="sr-nowrap">{nameOf(c.model)}</span></Fragment>)}</span>
                            <Link href={addKeyHref(p)} className="st-btn is-sm">Add {routerProvider(p)?.name ?? PROVIDER_LABEL[p]} key</Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
              {listedHosts.length > 0 && (
                <ListedGroup hosts={listedHosts} busy={listedBusy} msg={listedMsg} prefer={prefer} onToggle={(h, on) => void toggleListed(h, on)} />
              )}
              </>)}
            </Pane>

            {/* Fallbacks. The same toggle drives endpoint failover under Only (§6.2), so it is worded for endpoints there. */}
            <Pane title="When a model fails">
              <div className="sr-stack">
                <label className="st-toggle">
                  <input type="checkbox" className="st-check" checked={prefs.fallbackEnabled}
                    onChange={e => set({ fallbackEnabled: e.target.checked })} />
                  {only ? (
                    <span>
                      <b>Try other endpoints automatically</b>
                      <span>If the chosen endpoint fails before answering, the next one in your order is tried. Off: the request fails with that endpoint&apos;s error.</span>
                    </span>
                  ) : (
                    <span>
                      <b>Try other models automatically</b>
                      <span>If the chosen model fails before answering, the next one is tried, preferring a different provider. Off: the request fails with that model&apos;s error.</span>
                    </span>
                  )}
                </label>
                {!only && prefs.fallbackEnabled && <FallbackOrder prefs={prefs} set={set} modelNames={modelNames} candidates={candidates} nameOf={nameOf} />}
                {/* Drift alerts belong to benchmarked cloud models; under Only the toggle has nothing to act on. Its value is kept. */}
                {!only && (
                  <label className="st-toggle">
                    <input type="checkbox" className="st-check" checked={prefs.avoidDrifting !== false}
                      onChange={e => set({ avoidDrifting: e.target.checked })} />
                    <span>
                      <b>Avoid models with an active drift alert</b>
                      <span>A model our drift detectors flag as degrading on the skill your strategy uses, or whose hourly canary is failing, goes behind every unflagged model. It is never removed: if every option is flagged, the best of them is used and the routing reason says so.</span>
                    </span>
                  </label>
                )}
              </div>
            </Pane>
          </div>
        </div>

        <div className="st-savebar">
          {validation ? <span className="sr-warn" role="alert">{validation}</span>
            : preview && !preview.ok && !previewing
              ? <span className="sr-warn" role="status">{saveBarWarning(preview.error, dirty)}</span>
              : conflict ? <span className="sr-warn" role="status">{conflict.split('. ')[0].replace(/\.?$/, '.')}</span>
              : sourceNotice ? <span className="sr-warn" role="status">{sourceNotice.echo ? `Model source stays ${SOURCE_NAME[sourceNotice.echo]}.` : 'Model source is not available on this server yet.'}</span>
              : dirty ? <span>You have unsaved changes.</span> : <span>All changes saved.</span>}
          <button type="button" onClick={() => prefs && saved && setPrefs(saved)} className="st-btn" disabled={!dirty || saving}>Discard changes</button>
          <button type="button" onClick={save} disabled={saving || !dirty || !!validation} className="st-btn is-primary">
            {saving ? 'Saving…' : justSaved ? 'Saved' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  );
}

/** The sticky save bar's line when the preview finds nothing to route to. */
function saveBarWarning(error: Extract<PreferencesPreview, { ok: false }>['error'], dirty: boolean): string {
  const still = dirty ? ' You can still save.' : '';
  switch (error) {
    case 'no_provider_keys': return 'No provider key yet: these settings apply once you add one.';
    case 'no_endpoints':
    case 'no_endpoint_can_serve':
    case 'endpoints_unavailable':
      return `With these settings, requests sent as "auto" fail: none of your endpoints can take them (the preview says why).${still}`;
    case 'endpoints_disabled': return `With these settings, requests fail: private endpoints are paused on AI Stupid Level.${still}`;
    case 'plan_required': return `With these settings, requests fail: your plan does not include private endpoints.${still}`;
    default: return `With these settings, requests sent as "auto" are refused: no model qualifies (the preview says why).${still}`;
  }
}

/** A refused save, in a sentence: the API's own message when it sends one (§3 R4 PUT errors). */
function saveErrorText(err: unknown): string {
  if (err instanceof ApiRequestError) {
    if (err.message && !/^Request failed with status \d+$/.test(err.message)) return err.message;
    switch (err.error) {
      case 'no_endpoints': return 'Add and test an endpoint before choosing Prefer or Only my endpoints.';
      case 'endpoints_disabled': return 'Private endpoints are paused on AI Stupid Level, so only All connected can be chosen right now.';
      case 'plan_required': return 'Your plan does not include private endpoints, so only All connected can be chosen.';
    }
  }
  return err instanceof Error && err.message ? err.message : 'Could not save your preferences.';
}

/** D45: a save whose Model source was not echoed. "Your other changes" were stored by the same PUT. */
function sourceNoticeText(n: SourceNotice): string {
  const others = n.otherSaved ? ' Your other changes were saved.' : '';
  if (n.echo) return `Model source was not changed: the server kept ${SOURCE_NAME[n.echo]}.${others}`;
  if (!n.sourceChanged) return `Model source is not available on this server yet.${others}`;
  return n.otherSaved
    ? 'Model source is not available on this server yet, so it was not changed. Your other changes were saved.'
    : 'Model source is not available on this server yet. Nothing was changed.';
}

/**
 * "Listed providers" under Providers and models (M8, plan §2.17): the hosts the account connected, each with a "Use in
 * routing" toggle (on by default), saved at once on the connection. Off: automatic routing skips the host; requests
 * that name one of its models still reach it.
 */
function ListedGroup({ hosts, busy, msg, prefer, onToggle }: {
  hosts: ListedHost[]; busy: string | null; msg: { tone: 'good' | 'bad'; text: string } | null; prefer: boolean;
  onToggle: (h: ListedHost, on: boolean) => void;
}) {
  return (
    <div className="sr-listed">
      <p className="st-label sr-sublabel">Listed providers</p>
      <div className="sr-stack">
        {hosts.map(h => (
          <label key={h.slug} className="st-toggle">
            <input type="checkbox" className="st-check" checked={!!h.connection?.useInRouting} disabled={busy === h.slug || h.connection?.state === 'paused'}
              onChange={e => onToggle(h, e.target.checked)} />
            <span>
              <b>{h.displayName} · Use in routing</b>
              <span>{h.measured} of {h.total} {h.total === 1 ? 'model' : 'models'} measured. Only measured models are chosen automatically, and only
                when Model source is Prefer my endpoints; any of its models can be named, for example <code className="st-ic">{h.models[0]?.id ?? `mp/${h.slug}/<model>`}</code>.</span>
            </span>
          </label>
        ))}
      </div>
      {msg && <p className={`st-hint ${msg.tone === 'bad' ? 'sr-warn' : ''}`} role="status">{msg.text}</p>}
      <p className="st-hint">
        {prefer ? 'Saved as you switch it. ' : 'Saved as you switch it; it applies when Model source is Prefer my endpoints. '}
        <Link href="/router/providers#listed-providers">Manage listed hosts</Link>.
      </p>
    </div>
  );
}

/** §6.2 banners: the saved source is not All, and only All can be chosen now. */
function sourceBanner(kind: 'paused' | 'plan', saved: ModelSource): ReactNode {
  if (saved === 'only_endpoints') {
    return kind === 'paused'
      ? <>Private endpoints are paused on AI Stupid Level. Model source is still Only my endpoints, so requests fail with <code className="st-ic">endpoints_disabled</code> until endpoints are back or you switch to All connected.</>
      : <>Your plan no longer includes private endpoints. Model source is still Only my endpoints, so requests fail with <code className="st-ic">plan_required</code> until you <Link href="/account/billing">upgrade</Link> or switch to All connected.</>;
  }
  // Prefer behaves like All in both cases (§5.3): nothing fails, the endpoints are just skipped.
  return kind === 'paused'
    ? 'Private endpoints are paused on AI Stupid Level. Model source is still Prefer my endpoints, so requests go to benchmarked cloud models, as under All connected, until endpoints are back.'
    : 'Your plan no longer includes private endpoints. Model source is still Prefer my endpoints, so requests go to benchmarked cloud models, as under All connected.';
}

/** The selected source in full (§6.2 card copy, worded for what R4 does). */
function SourceExplanation({ id, sharedWorkspace, listed = false }: { id: ModelSource; sharedWorkspace: boolean; listed?: boolean }) {
  if (id === 'all') {
    return (
      <p>
        Benchmarked cloud models first, ranked on their benchmark scores. Your own endpoints answer when a request names one of their
        models, as <code className="st-ic">ep/&lt;prefix&gt;/&lt;model&gt;</code>. When Try other models automatically is on, up to two of
        them are also tried as a last resort when no cloud model can answer.{sharedWorkspace ? ' Servers your workspace shares are used only when you name them.' : ''}
      </p>
    );
  }
  if (id === 'prefer_endpoints') {
    return (
      <p>
        Your endpoints first, in your order{sharedWorkspace ? ', including servers your workspace shares with members' : ''}.{listed
          ? <> Then the measured models of the listed hosts you connected and use in routing, ordered by their measured scores; a listed host&rsquo;s
            model that is not measured yet answers only when a request names it (<code className="st-ic">mp/&lt;host&gt;/&lt;model&gt;</code>).</> : null}{' '}
        If none of them can take a request, it goes to the best-ranked cloud model. If one fails, the next {listed ? 'one' : 'endpoint'} and then the cloud
        models are tried when Try other models automatically is on. The <code className="st-ic">X-AISM-Provider</code> header says which one answered.
      </p>
    );
  }
  return (
    <>
      <p>
        Strict: no request made with your personal router keys is ever sent to a built-in provider (OpenAI, Anthropic, Google, DeepSeek,
        Kimi, GLM or xAI). Requests go only to the servers you added. If one of them is itself a gateway, such as OpenRouter or Azure, that
        service decides where the request goes next.
      </p>
      <p>
        If every endpoint is down, or none can take a request (no tool calling, prompt too long), the request fails with an error that names
        each endpoint and why. <code className="st-ic">/v1/messages</code>, <code className="st-ic">/v1/messages/count_tokens</code> and{' '}
        <code className="st-ic">/v1/embeddings</code> stop working for your personal router keys, because only built-in providers serve them.
      </p>
      {/* The scope of Only (R4 routing review S1; the API's dossier §7 item 7, word for word). */}
      <p>
        Applies to requests made with your personal router keys. Project keys you hold follow their project’s rules and may still use your
        provider keys if the project allows it.
      </p>
    </>
  );
}

/**
 * Model source (R4): the one place that decides where models come from. Three cards, the chosen
 * one explained under them. Prefer and Only can be chosen only with an endpoint ready and endpoints
 * available to the account; All can always be chosen, so a saved Prefer or Only can always be undone.
 */
function SourcePane({ value, savedSource, onPick, isDisabled, banner, hint, noneReady, notice, sharedWorkspace, listed = false }: {
  value: ModelSource | null; savedSource: ModelSource | null; onPick: (id: ModelSource) => void; isDisabled: (id: ModelSource) => boolean;
  banner: 'paused' | 'plan' | null; hint: ReactNode; noneReady: boolean; notice: SourceNotice | null; sharedWorkspace: boolean;
  /** M8: the account connected a listed host, so Prefer covers listed hosts too. */
  listed?: boolean;
}) {
  return (
    <Pane title="Model source" sub="Which models requests made with your personal router keys may use. Project keys follow their project’s own routing rules.">
      <div className="sr-src">
        {notice && <Note tone="warn">{sourceNoticeText(notice)}</Note>}
        {value && savedSource && (
          <>
            {banner && <Note tone={savedSource === 'only_endpoints' ? 'bad' : 'warn'}>{sourceBanner(banner, savedSource)}</Note>}
            {/* One bordered list, a row per choice: the settings column is too narrow for three cards side by side. */}
            <div className="sr-src-list" role="radiogroup" aria-label="Model source">
              {SOURCES.map(s => (
                <button type="button" role="radio" key={s.id} aria-checked={value === s.id} disabled={isDisabled(s.id)}
                  className="sr-src-opt" onClick={() => onPick(s.id)}>
                  <span className="sr-src-tick" aria-hidden="true" />
                  <span className="sr-src-txt">
                    <b>{SOURCE_NAME[s.id]}</b>
                    <span>{listed && s.id === 'prefer_endpoints' ? LISTED_PREFER_SHORT : s.short}{s.danger && <> <em className="sr-src-danger">{s.danger}</em></>}</span>
                  </span>
                </button>
              ))}
            </div>
            {hint && <p className="st-hint sr-src-hint">{hint}</p>}
            {noneReady && <Note tone="bad">None of your endpoints is ready, so every request made with your personal keys would fail.</Note>}
            <div className="sr-src-desc"><SourceExplanation id={value} sharedWorkspace={sharedWorkspace} listed={listed} /></div>
            <p className="sr-note-line">Testing a provider key on the Providers page still calls that provider, whichever source you choose.</p>
          </>
        )}
      </div>
    </Pane>
  );
}

/** What the preview found when nothing can be routed to (§6.2 PreviewPanel copy for the endpoint codes). */
function PreviewFailure({ preview }: { preview: Extract<PreferencesPreview, { ok: false }> }) {
  switch (preview.error) {
    case 'no_provider_keys':
      return (
        <>
          <p><b>Add a provider key first:</b> the router calls models with your own keys.</p>
          <Link href="/router/providers" className="st-btn is-primary is-sm">Add a key</Link>
        </>
      );
    case 'no_endpoints':
      return (
        <>
          <p><b>No endpoint is ready,</b> so requests would fail with <code className="st-ic">no_endpoints</code>.</p>
          <Link href="/router/providers" className="st-btn is-primary is-sm">Add an endpoint</Link>
        </>
      );
    case 'no_endpoint_can_serve': {
      const out = (preview.endpoints ?? []).filter(e => e.status !== 'eligible');
      return (
        <p>
          <b>None of your endpoints can take this request:</b>{' '}
          {out.length
            ? `${out.map(e => `${e.name} · ${e.model} — ${e.reason || ENDPOINT_STATUS_TEXT[e.status] || e.status}`).join('; ')}.`
            : preview.message}
        </p>
      );
    }
    case 'endpoints_unavailable': {
      // The API previews a busy or key-refused set as endpoints_unavailable too; a request would get
      // 429 endpoints_busy or 400 endpoint_key_rejected then (§5.3), so the code named follows the set.
      const live = (preview.endpoints ?? []).filter(e => e.status !== 'needs_test' && e.status !== 'over_plan_limit');
      const all = (st: string) => live.length > 0 && live.every(e => e.status === st);
      return all('busy')
        ? <p><b>Right now every endpoint is at its limit,</b> so requests would get 429 <code className="st-ic">endpoints_busy</code>. No cloud model is tried.</p>
        : all('auth_failed')
          ? <p><b>Every endpoint refuses its key,</b> so requests would get 400 <code className="st-ic">endpoint_key_rejected</code>. No cloud model is tried.</p>
          : <p><b>Right now every endpoint is unavailable,</b> so requests would get 503 <code className="st-ic">endpoints_unavailable</code>. No cloud model is tried.</p>;
    }
    // The API's own texts for these two (dossier §7 item 7, S1): scoped to your personal keys.
    case 'endpoints_disabled':
      return <p><b>Private endpoints are paused on AI Stupid Level.</b> Requests made with your personal keys would fail with 503 <code className="st-ic">endpoints_disabled</code>; no cloud model is tried.</p>;
    case 'plan_required':
      return <p><b>Your plan does not include private endpoints,</b> so requests made with your personal keys would fail with 403 <code className="st-ic">plan_required</code>. No cloud model is tried.</p>;
    default:
      return <p><b>No model can be used with these settings.</b> {preview.message}</p>;
  }
}

/** "Your endpoints" in the preview: under the ranking, never inside it (§6.2), each with what it would do now. */
function EndpointRows({ endpoints, source, fallbackOn, paused }: {
  endpoints: PreviewEndpoint[]; source: ModelSource | null; fallbackOn: boolean;
  /** Endpoint routing is paused for this account (the preview's endpointsPaused). */
  paused: boolean;
}) {
  const shown = endpoints.slice(0, 8);
  const note = paused ? 'Not used while private endpoints are paused on AI Stupid Level.'
    : source === 'only_endpoints' ? 'Requests go only to these, in this order.'
    : source === 'prefer_endpoints' ? 'Tried before cloud models, in this order.'
    : fallbackOn ? 'Used when a request names one, and up to two as a last resort when no cloud model can answer.'
    : 'Used when a request names one.';
  return (
    <div className="sr-eps">
      <p className="st-label"><span>Your endpoints</span><span>not benchmarked</span></p>
      <p className="sr-eps-note">{note}</p>
      <ul className="sr-eps-list">
        {shown.map(e => {
          // The API's clause leads: for exactly the endpoints the previewed chain tries, where each is in
          // the order and why ("first in your order", "you tagged it for coding"); for an unusable one, why it
          // is skipped. A usable one with no clause is one the chain does not try (R4 API 58add09).
          const ok = e.status === 'eligible';
          const tried = ok && !!e.reason;
          const lead = e.reason || (ok
            ? (paused ? 'not used while private endpoints are paused' : 'can be used; not tried with these settings')
            : ENDPOINT_STATUS_TEXT[e.status] ?? String(e.status));
          const price = /price you declared|no price declared/.test(lead) ? '' : ` · ${declaredPrice(e)}`;
          const lat = e.latencyP50Ms != null && e.latencySamples >= 5 && !/latency measured/.test(lead) ? ` · p50 ${fmtSec(e.latencyP50Ms)}` : '';
          return (
            <li key={e.id}>
              <ProviderMark provider="endpoint" size="sm" />
              <span className="sr-eps-m">
                <b>{e.name} · {e.model}</b>
                <small><span className={!ok ? 'sr-eps-out' : tried ? 'sr-eps-ok' : undefined}>{lead}</span>{price}{lat}</small>
              </span>
            </li>
          );
        })}
      </ul>
      {endpoints.length > shown.length && <p className="sr-eps-more">and {endpoints.length - shown.length} more</p>}
    </div>
  );
}

function PreviewPanel({ preview, previewing, strategy, dirty, samplePrompt, onSamplePrompt, names, nameOf, source, fallbackOn, paused, adaptive }: {
  preview: PreferencesPreview | null; previewing: boolean; strategy: Strategy; dirty: boolean;
  samplePrompt: string; onSamplePrompt: (s: string) => void; names: Record<string, string>; nameOf: NameOf;
  source: ModelSource | null; fallbackOn: boolean; paused: boolean;
  /**
   * A2 (plan §5.2), null without its settings: whether Match each request applies to requests sent as auto (the sample
   * box shows then, not only for the old Match each request strategy), the sample request beyond its prompt, the models
   * a conversation can continue on, and how the router scores (the score label under v2).
   */
  adaptive: { matching: boolean; sample: SampleState; onSample: (s: SampleState) => void; models: string[]; scoring: RouterScoring } | null;
}) {
  const only = source === 'only_endpoints';
  // A2: the conversation inputs whenever Model switching can act on the preview (not under Only my endpoints).
  const showConversation = !!adaptive && !only;
  const showPrompt = adaptive ? adaptive.matching && !only : strategy.id === 'match_task';
  // The landing's animated ranking, fed with this caller's own preview: pick, fallbacks, the rest.
  // It ranks cloud models, so Only my endpoints has none (§6.2).
  const view = useMemo(() => (only ? null : previewToSnap(preview, names)), [only, preview, names]);
  const stateText = previewing ? 'Updating…' : dirty ? 'Preview of your unsaved settings' : 'With your saved settings';
  const eps = preview?.endpoints ?? [];
  /** One step of the routing order: a cloud model as before, an endpoint by its name and model. */
  const step = (e: PreviewChainEntry & { score?: number | null }, pick: boolean) => (isEndpointEntry(e)
    ? { name: endpointEntryLabel(e, preview?.endpoints), sub: 'your endpoint · not benchmarked' }
    : {
        name: nameOf(e.model),
        sub: `${PROVIDER_LABEL[e.provider] || e.provider}${pick && e.score ? ` · score ${e.score.toFixed(1)}` : ''}${!pick && /your (fallback order|traffic split)/.test(e.reasoning) ? ' · your choice' : ''}`,
      });
  return (
    <Pane
      title="Where your next request goes"
      sub={<span className={`sr-pv-state${previewing ? ' is-busy' : dirty ? ' is-dirty' : ''}`} aria-live="polite">{stateText}</span>}
      tone="accent"
      reveal={false}
    >
      {showPrompt && (
        <div className="st-field sr-sample">
          <label className="st-field-label" htmlFor="rp-sample">Try a request</label>
          <textarea id="rp-sample" className="st-textarea" rows={2} maxLength={4000}
            placeholder="Paste a prompt to see which strategy and model it would get, e.g. “Fix this TypeError in my React component”"
            value={samplePrompt} onChange={e => onSamplePrompt(e.target.value)} />
        </div>
      )}
      {adaptive && (showPrompt || showConversation) && (
        <SampleInputs value={adaptive.sample} onChange={adaptive.onSample} showMatch={showPrompt} showConversation={showConversation}
          models={adaptive.models} nameOf={nameOf} />
      )}
      {!preview ? (
        <>
          <p className="st-hint" role="status">Working out where your requests go…</p>
          <div className="sr-skel" aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <span key={i} className="st-skel" />)}</div>
        </>
      ) : !preview.ok ? (
        <>
          <div className="sr-pv-empty" aria-live="polite"><PreviewFailure preview={preview} /></div>
          {view && view.snap.rows.length > 0 && (
            <div className={`sr-rank${previewing ? ' is-busy' : ''}`}>
              <p className="st-label"><span>Every model, and why it is out</span><span>{scoreLabel(view.snap.effectiveStrategy, view.kind)}</span></p>
              <RankList rows={view.snap.rows} kind={view.kind} winLabel="your pick" />
            </div>
          )}
          {/* Each endpoint's state explains no_endpoints and endpoints_unavailable; no_endpoint_can_serve already lists them. */}
          {eps.length > 0 && (preview.error === 'no_endpoints' || preview.error === 'endpoints_unavailable') && (
            <EndpointRows endpoints={eps} source={source} fallbackOn={fallbackOn} paused={paused} />
          )}
        </>
      ) : (
        <>
          <div aria-live="polite">
            {adaptive ? (() => {
              // A2: the benchmark Match each request chose, and what Model switching does in the sample's conversation.
              const matched = matchedLine(preview.details);
              const conv = conversationLine(preview.details?.conversation, nameOf);
              return <>{matched && <p className="sr-rule">{matched}</p>}{conv && <p className="sr-rule">{conv}</p>}</>;
            })() : preview.details?.taskRule && (
              <p className="sr-rule">This request reads as a <b>{preview.details.taskRule}</b>, so it uses <b>{ALL.find(s => s.id === preview.details?.effectiveStrategy)?.name || preview.details.effectiveStrategy}</b>.</p>
            )}
            <ol className="sr-chain" aria-label="Routing order">
              {(() => {
                const s = step(preview.primary, true);
                return (
                  <li className="is-pick">
                    <span className="sr-chain-k">First choice</span>
                    <span className="sr-chain-m" title={preview.primary.model}><b>{s.name}</b><small>{s.sub}</small></span>
                  </li>
                );
              })()}
              {preview.fallbacks.map((f, i) => {
                const s = step(f, false);
                // Under All connected an endpoint is only ever a last resort (D27).
                const label = source === 'all' && isEndpointEntry(f) && !isEndpointEntry(preview.primary) ? 'Last resort' : i === 0 ? 'If it fails' : 'Then';
                return (
                  <li key={f.model}>
                    <span className="sr-chain-k">{label}</span>
                    <span className="sr-chain-m" title={f.model}><b>{s.name}</b><small>{s.sub}</small></span>
                  </li>
                );
              })}
              {preview.fallbacks.length === 0 && (
                <li className="is-none">
                  <span className="sr-chain-k">If it fails</span>
                  <span className="sr-chain-m"><small>
                    {!fallbackOn ? 'The request fails: automatic fallback is off.'
                      : only ? 'No other endpoint can take it, so the request fails with this one’s error.'
                      : 'No other model qualifies, so the request fails with this one’s error.'}
                  </small></span>
                </li>
              )}
            </ol>
          </div>
          {/* R4b sends details with no candidates for an endpoint-only chain: no ranking to show then. */}
          {view && view.snap.rows.length > 0 && (
            <div className={`sr-rank${previewing ? ' is-busy' : ''}`}>
              <p className="st-label"><span>{source === 'prefer_endpoints' ? 'Cloud ranking' : 'Ranking for your settings'}</span><span>{scoreLabel(view.snap.effectiveStrategy, view.kind)}</span></p>
              <RankList rows={view.snap.rows} kind={view.kind} winLabel="your pick" />
              {/* A2 under estimator v2 (plan §2.9): the router's score is not the leaderboard's latest single result. */}
              {adaptive?.scoring.estimator === 'v2' && view.kind === 'score' && <p className="sr-note-line sr-score-note">{ROUTER_SCORE_V2}</p>}
            </div>
          )}
          {eps.length > 0 && <EndpointRows endpoints={eps} source={source} fallbackOn={fallbackOn} paused={paused} />}
          {preview.details?.split && preview.details.split.length > 0 && (() => {
            // The router draws only among the split's usable models, so a skipped model's traffic
            // goes to the others in proportion to their weights.
            const split = preview.details.split;
            const live = split.filter(x => x.usable);
            const skipped = split.filter(x => !x.usable);
            const liveTotal = live.reduce((a, x) => a + x.weight, 0);
            const shares = (rows: typeof split, total: number) =>
              rows.map(x => `${nameOf(x.model)} ${total ? Math.round((x.weight / total) * 100) : 0}%`).join(' · ');
            // Under Prefer my endpoints an endpoint goes first and the split shares out the cloud models after it.
            const afterEndpoints = isEndpointEntry(preview.primary);
            return (
              <p className="sr-split-note">
                {skipped.length === 0
                  ? afterEndpoints
                    ? <>Cloud split: {shares(split, split.reduce((a, x) => a + x.weight, 0))}.</>
                    : adaptive
                      ? <>{splitNote(shares(split, split.reduce((a, x) => a + x.weight, 0)))}</>
                      : <>Split: {shares(split, split.reduce((a, x) => a + x.weight, 0))}. The first choice above changes from request to request in these proportions.</>
                  : <>Skipped from your split: {skipped.map(x => `${nameOf(x.model)} (${x.reason || 'unavailable'})`).join(', ')}. Until that changes, {afterEndpoints ? 'cloud ' : ''}requests go {shares(live, liveTotal)}.</>}
              </p>
            );
          })()}
          <div className="sr-why">
            <p className="st-label">Why this model</p>
            <p>{preview.primary.reasoning}</p>
          </div>
        </>
      )}
    </Pane>
  );
}

function TieBreakPane({ prefs, set, scoring, a2 }: { prefs: UserPreferences; set: (p: Partial<UserPreferences>) => void; scoring: RouterScoring; a2: boolean }) {
  const current = TIE_BREAKS.find(t => t.id === (prefs.tieBreak ?? 'cheaper')) ?? TIE_BREAKS[0];
  const applies = TIE_STRATEGIES.has(prefs.routingStrategy);
  return (
    <Pane title="When models are tied" sub={tiePaneSub(scoring)}>
      <div className="sr-stack">
        <div className="st-seg is-scroll" role="group" aria-label="When models are tied, use">
          {TIE_BREAKS.map(t => (
            <button type="button" key={t.id} aria-pressed={current.id === t.id} onClick={() => set({ tieBreak: t.id })}>{t.label}</button>
          ))}
        </div>
        {/* A2: within a conversation Model switching decides (plan §5.2); before it, a conversation stays on its model. */}
        <p className="st-hint">{`${tieBreakDesc(current.id, scoring)} ${a2 ? tieHintAdaptive(current.id) : tieHint(current.id, scoring)}`}</p>
        {!applies && <p className="sr-note-line">Your current strategy orders models by something else, so this applies only to requests that ask for a Best quality strategy (auto-best, auto-coding, auto-reasoning, auto-tooling) or match it.</p>}
      </div>
    </Pane>
  );
}

function LimitCost({ prefs, set, candidates, source }: { prefs: UserPreferences; set: (p: Partial<UserPreferences>) => void; candidates: PreviewCandidate[]; source: ModelSource | null }) {
  // The API's limit is the average of input and output price per 1K tokens; prices are quoted
  // per million everywhere else, so the page shows and takes it per million.
  const on = prefs.maxCostPer1kTokens !== null;
  const perM = on ? Math.round(prefs.maxCostPer1kTokens! * 1000 * 1000) / 1000 : 0;
  const usable = candidates.filter(c => c.status !== 'no_key' && c.status !== 'excluded');
  const fit = usable.filter(c => !on || c.costPer1kBlended <= prefs.maxCostPer1kTokens!).length;
  const prices = usable.map(c => c.costPer1kBlended * 1000).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : 5;
  // The same limit filters endpoint models by their declared price (§5.1 over_cost); the cloud counts below do not apply under Only.
  const what = source === 'only_endpoints'
    ? 'Average of an endpoint model’s declared input and output price, per million tokens. A model with no declared price is never filtered out.'
    : source === 'prefer_endpoints'
      ? 'Average of a model’s input and output price, per million tokens: the list price for cloud models, your declared price for your endpoints (a model with no declared price is never filtered out).'
      : <>Average of a model&apos;s input and output list price, per million tokens.</>;
  return (
    <div>
      <label className="st-toggle">
        <input type="checkbox" className="st-check" checked={on}
          onChange={e => set({ maxCostPer1kTokens: e.target.checked ? Math.max(0.0001, Math.ceil(median * 100) / 100 / 1000) : null })} />
        <span>
          <b>Maximum price</b>
          <span>{what}</span>
        </span>
      </label>
      {on && (
        <div className="sr-inline">
          <span>$</span>
          <input type="number" min={0.01} step={0.05} className="st-input sr-num" value={perM}
            aria-label="Maximum price per million tokens"
            onChange={e => set({ maxCostPer1kTokens: (parseFloat(e.target.value) || 0) / 1000 })} />
          <span>per 1M tokens</span>
          {source !== 'only_endpoints' && usable.length > 0 && <span className="sr-fit">{fit} of {usable.length} usable {source === 'prefer_endpoints' ? 'cloud ' : ''}models fit{prices.length ? ` (they range ${fmtUsd(prices[0])}–${fmtUsd(prices[prices.length - 1])})` : ''}</span>}
        </div>
      )}
    </div>
  );
}

function LimitLatency({ prefs, set, candidates, source }: { prefs: UserPreferences; set: (p: Partial<UserPreferences>) => void; candidates: PreviewCandidate[]; source: ModelSource | null }) {
  const on = prefs.maxLatencyMs !== null;
  const usable = candidates.filter(c => c.status !== 'no_key' && c.status !== 'excluded' && c.latencyMs != null);
  const lat = usable.map(c => c.latencyMs!).sort((a, b) => a - b);
  const median = lat.length ? lat[Math.floor(lat.length / 2)] : 10_000;
  const fit = usable.filter(c => !on || c.latencyMs! <= prefs.maxLatencyMs!).length;
  // Endpoint models are filtered on the median measured on this account's own requests, from 5 of them (§5.1 over_latency).
  const what = source === 'only_endpoints'
    ? 'The median measured on your own requests to each endpoint model over the last 24 hours. A model with fewer than 5 requests is never filtered out.'
    : source === 'prefer_endpoints'
      ? 'For cloud models, the median of the last 7 days of benchmark runs, blended with what the router observes; for your endpoints, the median measured on your own requests (from 5 requests). Reasoning models often take 10–60 s on hard tasks.'
      : 'The median of the last 7 days of benchmark runs, blended with what the router observes. Reasoning models often take 10–60 s on hard tasks.';
  return (
    <div>
      <label className="st-toggle">
        <input type="checkbox" className="st-check" checked={on}
          // Starts at the median of your usable models, so turning it on never empties the list.
          onChange={e => set({ maxLatencyMs: e.target.checked ? Math.ceil(median / 1000) * 1000 : null })} />
        <span>
          <b>Maximum response time</b>
          <span>{what}</span>
        </span>
      </label>
      {on && (
        <div className="sr-inline">
          <input type="number" min={0.1} step={0.5} className="st-input sr-num" value={prefs.maxLatencyMs! / 1000}
            aria-label="Maximum response time in seconds"
            onChange={e => set({ maxLatencyMs: Math.round((parseFloat(e.target.value) || 0) * 1000) })} />
          <span>seconds</span>
          {source !== 'only_endpoints' && usable.length > 0 && <span className="sr-fit">{fit} of {usable.length} usable {source === 'prefer_endpoints' ? 'cloud ' : ''}models fit (fastest {fmtSec(lat[0])}, median {fmtSec(median)})</span>}
        </div>
      )}
    </div>
  );
}

function SplitEditor({ prefs, set, modelNames, candidates, split, nameOf, rule }: {
  prefs: UserPreferences; set: (p: Partial<UserPreferences>) => void; modelNames: string[]; candidates: PreviewCandidate[];
  split?: Array<{ model: string; weight: number; share: number; usable: boolean; reason?: string }>;
  nameOf: NameOf;
  /** How the split combines with the Model source, in the API's words (the preview's splitRule, R4). */
  rule?: string;
}) {
  const rows = prefs.trafficSplit || [];
  const total = rows.reduce((a, r) => a + (r.weight || 0), 0);
  const unused = modelNames.filter(m => !rows.some(r => r.model === m));
  const update = (i: number, patch: Partial<{ model: string; weight: number }>) =>
    set({ trafficSplit: rows.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  return (
    <Pane title="Your traffic split" sub="Up to 10 models" reveal={false}>
      {rule && <p className="sr-note-line sr-split-src">{rule}</p>}
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
                {/* The chosen model shows its plain name: the note beside it says when it has no key. */}
                {[r.model, ...unused].map(m => <option key={m} value={m}>{m === r.model ? nameOf(m) : optionLabel(m, candidates, nameOf)}</option>)}
              </select>
              <input type="number" min={1} max={100} className="st-input sr-num" value={r.weight} aria-label={`Weight for ${r.model}`}
                onChange={e => update(i, { weight: Math.round(parseFloat(e.target.value) || 0) })} />
              <span className="sr-share">{total ? Math.round(((r.weight || 0) / total) * 100) : 0}%</span>
              <span className={`sr-split-state${(info && !info.usable) || cand?.status === 'no_key' ? ' is-bad' : ''}`}>
                {cand?.status === 'no_key'
                  ? <>Needs {an(PROVIDER_LABEL[cand.provider] || cand.provider)} key · <Link href={addKeyHref(cand.provider)}>Add it</Link></>
                  : info && !info.usable ? `Not used: ${info.reason}` : cand ? `score ${Math.round(cand.score)}` : ''}
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
                  {c && c.status === 'no_key' && (
                    <small className="is-bad">Skipped: needs {an(PROVIDER_LABEL[c.provider] || c.provider)} key · <Link href={addKeyHref(c.provider)}>Add it</Link></small>
                  )}
                  {c && c.status !== 'eligible' && c.status !== 'no_key' && <small>{STATUS_TEXT[c.status]}</small>}
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
            {options.map(m => <option key={m} value={m}>{optionLabel(m, candidates, nameOf)}</option>)}
          </select>
          <button type="button" className="st-btn" disabled={!pick}
            onClick={() => { if (pick) { set({ fallbackOrder: [...list, pick] }); setPick(''); } }}>Add</button>
        </div>
      )}
    </div>
  );
}
