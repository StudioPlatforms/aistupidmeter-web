/**
 * AI Router API Client
 * Type-safe API client for communicating with the backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ============================================================================
// Types
// ============================================================================

export interface UniversalKey {
  id: number;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
  /** waiting_for_provider_key: the account has no working provider key, so live requests are refused. */
  status?: 'active' | 'revoked' | 'waiting_for_provider_key';
}

/** The account's routing setup, as GET /router/keys reports it. */
export interface RouterSetup {
  /** Providers with a working (active) key. */
  providers: string[];
  /**
   * The API's verdict on whether the account's router keys can answer anything live: true when it
   * has no working provider key and (from R3) no endpoint model of its own that a request can name.
   */
  waitingForProviderKey: boolean;
  /** From R3: how many of its own endpoint models the account's keys can name; absent when none. */
  endpointModels?: number;
  /** Phase 3 M8: how many listed hosts the account connected with its own key (set up), when it has no other route. */
  listedHosts?: number;
}

/**
 * What the account's router keys can answer, read from GET /router/keys `setup`, so every page
 * words it the same way and as the API decides it:
 * - `waiting`: nothing live (no provider key, and no endpoint model of its own);
 * - `endpointsOnly`: requests that name one of its endpoint models, but no automatic routing, which
 *   ranks benchmarked cloud models and needs a provider key;
 * - neither: provider keys, so automatic routing works.
 * An API older than R3 sends no endpoint count, and its verdict is the provider keys alone.
 */
export function setupOf(setup: RouterSetup): { waiting: boolean; endpointsOnly: boolean; endpointModels: number; listedHosts: number } {
  const providers = Array.isArray(setup.providers) ? setup.providers.length : 0;
  const waiting = typeof setup.waitingForProviderKey === 'boolean' ? setup.waitingForProviderKey : providers === 0;
  const endpointModels = Math.max(0, Math.floor(Number(setup.endpointModels) || 0));
  const listedHosts = Math.max(0, Math.floor(Number(setup.listedHosts) || 0));
  return { waiting, endpointsOnly: !waiting && providers === 0, endpointModels, listedHosts };
}

// ── Listed hosts in the Smart Router (Phase 3 M8, GET /router/marketplace) ───────────────────────

/** A provider's data statement (plan §9.9): declared by the host, not audited by AI Stupid Level. */
export interface DataDeclaration {
  version: number;
  promptsRetention: 'none' | 'days' | 'not_stated'; retentionDays: number | null;
  trainingUse: 'never' | 'opt_in' | 'opt_out' | 'yes' | 'not_stated';
  logContents: string | null; processingRegions: string[]; subprocessors: string[]; certifications: string[];
  privacyUrl: string | null; termsUrl: string | null; dpaUrl: string | null; declaredAt: string;
}

/** An offer a host makes (plan §8.7): display only, shown with its disclosure line. */
export interface ListedOffer {
  id: number; kind: 'router_discount' | 'promo_code' | 'early_access' | 'rate_limits'; kindLabel: string; title: string; details: string | null;
  code: string | null; percent: number | null; termsUrl: string; endsAt: string | null; listingId: number | null; disclosure: string;
}

/**
 * M13 (privacy 1.9): a listed host's international-transfer arrangement, before connection: each declared processing
 * region, the countries it means and the arrangement that covers it (the EEA, an EU adequacy decision, or the EU-US Data
 * Privacy Framework for a host we recorded as certified). `covered` false: the host cannot be connected (the API refuses
 * with 409 transfer_not_covered) and a connection to it is suspended; `reason` says why.
 */
export interface TransferView {
  covered: boolean;
  reason: string | null;
  regions: Array<{ region: string; countries: string[]; mechanism: 'eea' | 'adequacy' | 'dpf' | 'none'; covered: boolean; words: string }>;
  source: { name: string; url: string; checkedOn: string };
}

/**
 * API M22: an account's choice for a connected listed host: 'auto' (our recommendation: ordered by our measurements),
 * 'prefer' (first when it can serve the request), 'never' (never used automatically; requests that name its models still
 * reach it).
 */
export type ListedChoice = 'auto' | 'prefer' | 'never';

/** API M22: a listed model's published scores (its newest published daily mean per suite, whole points). */
export type ListedScores = Partial<Record<'combined' | 'coding' | 'reasoning' | 'tooling', number>>;

export interface ListedHost {
  slug: string; displayName: string; kind: string; country: string | null; regions: string[]; logoUrl: string | null; getKeyUrl: string | null;
  /** API M23: the host's "Top up credit" page (where a customer adds credit or pays), or null; absent from an older API. */
  billingUrl?: string | null;
  /** M24: an internal test host (staff only; no public page). */
  internal?: boolean;
  /** M13: the company operating the host, as its public page names it. */
  operatedBy?: string | null;
  /** M13 (privacy 1.9): the transfer arrangement; absent from an older API (the API still decides at connect time). */
  transfer?: TransferView;
  /** The endpoint hosts a new key for this provider is sent to, checked at and confirmed for: what the Add-key dialog names. */
  hosts: string[];
  /** From API M22: each model's published scores (none before its first published day) and the newest such day. */
  models: Array<{ id: string; name: string; measured: boolean; contextTokens: number; scores?: ListedScores; scoredDay?: string | null }>;
  measured: number; total: number;
  /** From API M22: when the host was first listed, and whether it is new to this account (listed since it last looked; 30 days at most). */
  listedSince?: string | null;
  isNew?: boolean;
  health: 'up' | 'degraded' | 'down' | 'unknown';
  /** How a key is checked: GET /models (free), or a 1-token chat (the host's model list answers any key). */
  checkBy: 'models' | 'chat';
  /** Stopped for a security reason ('security': a suspension; 'domain_lapse', 'tls_issuer_change': a safety hold): shown to connected users only. */
  stopped?: string | null;
  connection: null | {
    state: 'connected' | 'key_refused' | 'no_credit' | 'paused' | 'confirm_host';
    keyHint: string | null; useInRouting: boolean; pausedReason: string | null; unconfirmedHosts: string[]; lastValidatedAt: string | null;
    /** The hosts Check key sends the stored key to (the confirmed ones), and how it checks there. */
    checkHosts: string[];
    checkBy: 'models' | 'chat';
    /** From API M22: the account's choice for the host (absent from an older API, which has only useInRouting). */
    choice?: ListedChoice;
  };
  offers: ListedOffer[];
  declaration: DataDeclaration | null;
}

export interface ListedKeyResult {
  verdict: KeyVerdict; message: string; reaches: string[]; hosts?: string[]; by?: 'models' | 'chat'; host: ListedHost | null;
}

/** What the provider said when a key was checked (router/keys/key-check.ts in the API). */
export type KeyVerdict = 'valid' | 'invalid' | 'no_credit' | 'unverified';

export interface ProviderKey {
  id: number;
  // 'xai' is retired — no Grok models are benchmarked, so the router cannot
  // select one. Existing keys still come back from the API so they can be
  // removed, hence the widened type.
  provider: 'openai' | 'anthropic' | 'google' | 'glm' | 'deepseek' | 'kimi' | (string & {});
  isActive: boolean;
  createdAt: string;
  lastValidated: string | null;
  /** The latest sign from real requests that the key is not working (refused, or out of credit). */
  problem?: { kind: 'rejected' | 'no_credit'; at: string; message: string } | null;
}

export type RoutingStrategyId = 'best_overall' | 'best_coding' | 'best_reasoning' | 'best_tooling' | 'best_creative' | 'cheapest' | 'fastest'
  | 'best_value' | 'best_value_coding' | 'best_value_reasoning' | 'best_value_tooling'
  | 'best_consistent' | 'fastest_quality' | 'match_task' | 'custom_split';

export interface UserPreferences {
  routingStrategy: RoutingStrategyId;
  fallbackEnabled: boolean;
  maxCostPer1kTokens: number | null;
  maxLatencyMs: number | null;
  requireToolCalling: boolean;
  requireStreaming: boolean;
  excludedProviders: string[];
  excludedModels: string[];
  /** Deprioritise models with an active drift alert (default on). */
  avoidDrifting?: boolean;
  /** Models tried, in this order, when the primary fails — before the automatic fallbacks. */
  fallbackOrder?: string[];
  /** custom_split: the caller's weighted traffic split. */
  trafficSplit?: Array<{ model: string; weight: number }>;
  /** Which of several statistically tied leaders to use (default: the cheaper). */
  tieBreak?: TieBreak;
  /**
   * From R4 (plan D20, D45): which models the account's personal keys may use. The API advertises
   * the setting by sending it in GET /router/preferences; an older API sends none, and then the
   * Preferences page shows no Model source pane and never sends one. PUT answers with the stored
   * value, and the page reports a save only when that echo equals what it sent.
   */
  modelSource?: ModelSource;
  /*
   * From the API's A2 release (adaptive-routing plan §5.1–5.5), present only where the features apply to the
   * account (staff first): the Preferences page shows Match each request, Apply this strategy to and Model
   * switching only when GET /router/preferences carries them ('modelSwitching' in the answer), and sends them
   * back only then. lib/router-adaptive reads them.
   */
  /** Match each request: rank Best overall and Best value requests on the benchmark that matches each one. */
  requestMatching?: boolean;
  /** Apply this strategy to: requests sent as `auto` only, or every routed request (`auto` and every `auto-*`). */
  strategyScope?: StrategyScope;
  /** Model switching: when a conversation under way may move to another model. */
  modelSwitching?: ModelSwitching;
  /** The largest estimated re-send cost a move may have, in USD; null for no limit. */
  switchCostCapUsd?: number | null;
  /**
   * From the API's M18 release: "Same model, cheaper host" (off by default). The Preferences page shows the setting only
   * when GET /router/preferences carries it, and sends it back only then.
   */
  sameModelCheaperHost?: boolean;
}

/** Apply this strategy to (A2): requests sent as `auto`, or every routed request. */
export type StrategyScope = 'auto' | 'all';
/** Model switching (A2): one model per conversation, a re-check at each new message, or at every request. */
export type ModelSwitching = 'conversation' | 'message' | 'request';

/** How the router chooses among models the measurement cannot tell apart. */
export type TieBreak = 'cheaper' | 'faster' | 'highest';

/**
 * Model source (R4): `all` = benchmarked cloud models, the account's own endpoints when a request
 * names them (and, with fallback on, up to two as a last resort); `prefer_endpoints` = its endpoints
 * first, then the cloud; `only_endpoints` = its endpoints and nothing else.
 */
export type ModelSource = 'all' | 'prefer_endpoints' | 'only_endpoints';

export function isModelSource(v: unknown): v is ModelSource {
  return v === 'all' || v === 'prefer_endpoints' || v === 'only_endpoints';
}

/** One ranked model as the router sees it for this caller (POST /router/preferences/preview). */
export interface PreviewCandidate {
  model: string; provider: string; score: number; rankable: boolean;
  costPer1kBlended: number; latencyMs: number | null; latencyMeasured: boolean;
  status: 'eligible' | 'no_key' | 'excluded' | 'over_cost' | 'over_latency' | 'no_tools' | 'no_forced_tools';
  driftFlag: string | null; circuitOpen: boolean;
}

/** A model in the preview's routing order: the first choice, or one of the models tried after it. */
export interface PreviewChainEntry {
  /** A cloud model's name, or an endpoint model's id as requests name it (ep/<prefix>/<model>). */
  model: string;
  provider: string;
  reasoning: string;
  /**
   * From R4: 'endpoint' for one of the account's own servers. Absent from older APIs: cloud. From the API's M18 release,
   * 'listed' for a listed host that "Same model, cheaper host" sends the request to (provider 'marketplace').
   */
  source?: 'cloud' | 'endpoint' | 'listed';
  /** From R4: false for endpoint models, which are never benchmarked. */
  measured?: boolean;
  /** From R4: the endpoint's name ("GPU box A"), on endpoint entries. */
  endpointName?: string | null;
  /** M18, on listed entries: the host's name ("Together AI") and the model it serves ("DeepSeek V4 Pro (FP8)"). */
  host?: string | null;
  modelName?: string | null;
  /**
   * API M22, on a listed entry under Prefer my endpoints: the account's choice for that host ('prefer' or 'auto'). Absent on
   * the entry "Same model, cheaper host" adds.
   */
  choice?: 'prefer' | 'auto';
  /** From R4: null on endpoint entries (the router never prices an endpoint); shown nowhere. */
  estimatedCost?: number | null;
}

/**
 * Why an endpoint model can or cannot take the previewed request (plan §5.1). The page words each
 * one (§6.2 "Endpoint statuses in the preview"); a status it does not know is shown as the API's
 * `reason`. R4 never produces `gone`; `quarantined` it can.
 */
export type PreviewEndpointStatus =
  | 'eligible' | 'paused' | 'needs_test' | 'blocked' | 'auth_failed' | 'endpoint_down' | 'busy' | 'no_tools'
  | 'context_too_small' | 'over_cost' | 'over_latency' | 'over_plan_limit' | 'gone' | 'quarantined';

/** One of the account's endpoint models, as the preview sees it (R4: POST /router/preferences/preview `endpoints`). */
export interface PreviewEndpoint {
  /** The endpoint's public id (as in /router/endpoints/:id). */
  publicId: string;
  /** The id requests name: ep/<prefix>/<model>, or ep/team.<prefix>/<model> for a shared server. */
  id: string;
  /** The endpoint's name ("GPU box A"). */
  name: string;
  /** The upstream model id, exactly as the server lists it. */
  model: string;
  scope: 'personal' | 'shared' | 'project';
  status: PreviewEndpointStatus | (string & {});
  /**
   * A short clause, never naming the endpoint: for exactly the endpoints the previewed chain tries,
   * why each is where it is ("first in your order", "you tagged it for coding", "lowest price you
   * declared (…)"); for an unusable one, why it is skipped ("not answering (next try in 25 s)", a price
   * limit per 1M); null for a usable endpoint the chain does not try (beyond six or All's two, fallback
   * off, or endpoints paused).
   */
  reason?: string | null;
  /** Declared USD per 1M tokens; null = not declared (counts as $0). */
  priceInPerMTok: number | null;
  priceOutPerMTok: number | null;
  /** Median latency on this account's own requests; counted only from 5 samples on. */
  latencyP50Ms: number | null;
  latencySamples: number;
}

/** A routing step that is one of the account's own endpoints (R4 `source` / `provider`; an ep/ id from any API). */
export function isEndpointEntry(e: { model: string; source?: string; provider?: string }): boolean {
  return e.source === 'endpoint' || e.provider === 'endpoint' || e.model.startsWith('ep/');
}

/**
 * An endpoint routing step as "GPU box A · Qwen/Qwen3-32B": the endpoint's name and the upstream
 * model, from the entry, else the preview's `endpoints` list, else the ep/<prefix>/<model> id itself.
 */
export function endpointEntryLabel(e: PreviewChainEntry, endpoints?: PreviewEndpoint[]): string {
  const row = endpoints?.find(x => x.id === e.model);
  let prefix = '';
  let model = e.model;
  if (e.model.startsWith('ep/')) {
    const rest = e.model.slice(3);
    const i = rest.indexOf('/');
    if (i > 0) { prefix = rest.slice(0, i); model = rest.slice(i + 1); }
  }
  return `${e.endpointName || row?.name || prefix || 'Your endpoint'} · ${row?.model || model}`;
}

export interface PreviewDetails {
  requestedStrategy: string; effectiveStrategy: string; taskRule?: string;
  candidates: PreviewCandidate[];
  split?: Array<{ model: string; weight: number; share: number; usable: boolean; reason?: string }>;
  /* From the API's A2 release, where its features apply to the account (lib/router-adaptive reads them). */
  /** The benchmark the previewed request is ranked on. */
  benchmark?: 'overall' | 'coding' | 'reasoning' | 'tool_use' | 'agentic_coding' | null;
  /** The rule Match each request matched (classifier v2), or null when matching did not apply. */
  requestKind?: 'tools_code' | 'tools' | 'long_session' | 'planning' | 'code' | 'general' | null;
  /** The rule's words as the routing reason gives them ("the request offers tools"), or null. */
  matchPhrase?: string | null;
  /** Where the previewed strategy came from (always the preferences, for a preview). */
  strategySource?: string;
  /** What Model switching does with the previewed request in a conversation; only when the preview sent a conversation model. */
  conversation?: PreviewConversation;
}

/** The previewed request continuing a conversation (A2): the gate's event, the models, why, and the API's reason clause. */
export interface PreviewConversation {
  event: 'new' | 'stayed' | 'kept' | 'kept_cost' | 'switched' | 'moved' | (string & {});
  /** A code for the cause (within_se, leads, contender, cap, …). Never shown. */
  why: string;
  /** The conversation's model before this request. */
  from: string | null;
  /** Where the request would go: for a keep, the conversation's model; for a move, the model moved to. */
  to: string;
  /** The quality leader the conversation's model was compared with; null when no quality comparison was made. */
  leader: string | null;
  /** The estimated cost of re-sending the conversation to `to`, in USD. */
  costUsd: number | null;
  /** The conversation's size in tokens, as the cost estimate counted it. */
  tokens?: number | null;
  /** The exact reason clause for this event; the page shows it as it is. */
  sentence: string;
}

/**
 * Why a preview found nothing to route to. From R4 the endpoint codes come with Prefer and Only
 * (plan §6.3): `no_endpoints` (none set up), `no_endpoint_can_serve` (each one filtered),
 * `endpoints_unavailable` (each one down, blocked or paused), `endpoints_disabled` (endpoints are
 * switched off on the server) and `plan_required` (the plan includes no endpoints).
 */
export type PreviewError =
  | 'no_provider_keys' | 'no_candidates'
  | 'no_endpoints' | 'no_endpoint_can_serve' | 'endpoints_unavailable' | 'endpoints_disabled' | 'plan_required';

/**
 * How a traffic split (custom_split) combines with the Model source (R4, chain.ts `splitRule`):
 * the preview sends it whenever the previewed strategy is custom_split, and `text` is the one
 * sentence the page shows where the split appears.
 */
export interface SplitRule {
  /**
   * cloud_after_endpoints (Prefer, fallback on), cloud_if_no_endpoint (Prefer, fallback off: the split only
   * when no endpoint can serve), cloud_endpoints_paused (Prefer while endpoints are out of play: like All),
   * cloud_then_last_resort and cloud (All), not_used (Only). The page shows `text`, whatever the code.
   */
  code: 'cloud_after_endpoints' | 'cloud_if_no_endpoint' | 'cloud_endpoints_paused' | 'cloud_then_last_resort' | 'cloud' | 'not_used' | (string & {});
  text: string;
}

export type PreferencesPreview =
  | {
      ok: true;
      /** `score` is null (or 0) for an endpoint model, which has none. */
      primary: PreviewChainEntry & { score: number | null };
      fallbacks: PreviewChainEntry[];
      providers: string[];
      /** The cloud ranking. An API may leave it out when no cloud model is considered (Only my endpoints). */
      details?: PreviewDetails;
      /** From R4: the Model source this preview used. */
      modelSource?: ModelSource;
      /** From R4: the account's endpoint models and what each would do with this request. */
      endpoints?: PreviewEndpoint[];
      splitRule?: SplitRule;
      /**
       * From the R4 API's 58add09: true while the kill switch, ASL_ENDPOINTS or an endpoint runtime that
       * did not load stops endpoint routing for the account (a saved Prefer then previews like All).
       * False for a plan without endpoints (that is not a pause). Absent from R3's exact answer.
       */
      endpointsPaused?: boolean;
    }
  | {
      ok: false; error: PreviewError; message: string;
      /** Present when models exist but none qualify: every model's status, for the page. */
      details?: PreviewDetails;
      modelSource?: ModelSource;
      endpoints?: PreviewEndpoint[];
      splitRule?: SplitRule;
      /**
       * From the R4 API's 58add09: true while the kill switch, ASL_ENDPOINTS or an endpoint runtime that
       * did not load stops endpoint routing for the account (a saved Prefer then previews like All).
       * False for a plan without endpoints (that is not a pause). Absent from R3's exact answer.
       */
      endpointsPaused?: boolean;
    };

export interface AnalyticsOverview {
  overview: {
    totalRequests: number;
    successfulRequests: number;
    successRate: string;
    totalTokensIn: number;
    totalTokensOut: number;
    totalTokens: number;
    totalCost: string;
  };
  providers: Array<{
    provider: string;
    requests: number;
    totalCost: string;
    percentage: string;
  }>;
  topModels: Array<{
    model: string;
    requests: number;
    totalCost: string;
    percentage: string;
  }>;
}

export interface TimelineData {
  period: string;
  days: number;
  timeline: Array<{
    period: string;
    requests: number;
    successfulRequests: number;
    successRate: string;
    tokensIn: number;
    tokensOut: number;
    totalTokens: number;
    cost: string;
  }>;
}

export interface CostSavings {
  actualCost: string;
  worstCaseCost: string;
  savings: string;
  savingsPercentage: string;
  totalRequests: number;
  averageCostPerRequest: string;
}

export interface RecentRequest {
  id: number;
  provider: string;
  model: string;
  /** Phase 3 M8: a row routed to a listed host, "<Host> · <model> (listed host)"; absent on every other row. */
  providerLabel?: string;
  /**
   * Why the router chose the model, as stored when the request was routed (never rewritten).
   * "Refused before routing: <code>" for a request refused before any model was chosen.
   */
  reason: string | null;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  cost: string;
  latency: number;
  success: boolean;
  /** The message the caller got, when the request failed. */
  error?: string | null;
  /** Why a failed request failed: a failure class, 'no_provider_key' or 'refused'; null when it succeeded. */
  cause?: string | null;
  timestamp: string;
  /*
   * From the API's A1 release (adaptive-routing plan §7.4): on every item from then on, each possibly
   * null (nothing recorded, or a row from before A1); absent before it. Pages show them only when sent.
   */
  /** The request's `model` field as sent: `auto`, a mode such as `auto-best`, or a model id. */
  requestedModel?: string | null;
  /** What the router ranked on (as X-AISM-Strategy): `best_tooling`, …, `custom_split`, or `pinned`. */
  strategy?: string | null;
  /** The benchmark behind that ranking. */
  benchmark?: 'overall' | 'coding' | 'reasoning' | 'tool_use' | 'agentic_coding' | null;
  /**
   * Whether the request started a conversation, stayed on its model, or moved it (as X-AISM-Conversation). From the
   * API's A2 release also kept, kept_cost (Model switching re-checked it and kept its model) and switched (moved on
   * scores).
   */
  conversation?: 'new' | 'stayed' | 'kept' | 'kept_cost' | 'switched' | 'moved' | null;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

/**
 * A request the API refused, with its status and JSON body, for pages that act on more than the
 * message: a 404 that means "not available to this account", a 429's `retryAfterSec` (the web
 * proxy forwards the body and status only, so a Retry-After header never reaches the browser), a
 * 400's `code`. It is an Error with the same message as before, so `err.message` callers are unchanged.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  /** The body's `error`: the API's name for the failure (invalid_endpoint, rate_limited, needs_test…). */
  readonly error: string | null;
  /** A finer code, when the API gives one (the guard's dns_failed inside invalid_endpoint). */
  readonly code: string | null;
  readonly body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>, fallback: string) {
    const nested = body.error && typeof body.error === 'object' ? body.error as Record<string, unknown> : null;
    const message = typeof body.message === 'string' && body.message ? body.message
      : nested && typeof nested.message === 'string' && nested.message ? nested.message
      : fallback;
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.body = body;
    this.error = typeof body.error === 'string' ? body.error : nested && typeof nested.code === 'string' ? nested.code : null;
    this.code = typeof body.code === 'string' ? body.code : null;
  }

  /** Seconds to wait before retrying (429 bodies carry it; null when absent). */
  get retryAfterSec(): number | null {
    const v = Number(this.body.retryAfterSec);
    return Number.isFinite(v) && v >= 0 ? Math.ceil(v) : null;
  }

  /** The field a 400 names (invalid_model_settings {field}). */
  get field(): string | null {
    return typeof this.body.field === 'string' ? this.body.field : null;
  }
}

// ============================================================================
// Private endpoints (R3, staff only)
//
// OpenAI-compatible servers an account adds itself (vLLM, SGLang, llama.cpp, Ollama, LM Studio,
// TGI, a hosting company). GET /router/endpoints answers 404 to every account the API's
// ASL_ENDPOINTS setting does not include, and the Providers page uses that as feature detection.
// Requests reach an endpoint model when they name it: ep/<slug>/<model>.
// ============================================================================

export type EndpointAuthScheme = 'bearer' | 'x-api-key' | 'api-key' | 'none';

export type EndpointHealthState =
  | 'unknown' | 'up' | 'degraded' | 'down' | 'auth_failed' | 'blocked' | 'stopped_checking' | 'quarantined';

export type EndpointProbeStatus = 'queued' | 'running' | 'passed' | 'partial' | 'failed' | 'blocked' | 'interrupted';

/** One endpoint (router_endpoints, camelCased). The key itself never leaves the API. */
export interface Endpoint {
  /** The public id: every /router/endpoints/:id call uses it. */
  id: string;
  /** Fixed at creation: requests name its models ep/<slug>/<model> (a workspace's ep/team.<slug>/<model>). */
  slug: string;
  /** The API's endpointView (R3 on): `personal` for ep/<slug>/, `team` for a workspace's or project's ep/team.<slug>/. */
  namespace?: 'personal' | 'team';
  /** The API's endpointView (R3 on): the id every model of this endpoint starts with, "ep/gpu-a/" or "ep/team.gpu-a/". */
  idPrefix?: string;
  /**
   * The API's endpointView (R3 on): no key, or the "No key" scheme (tagged Unprotected). Read before
   * `keyHint`, which the R5 API sends as null to seat holders who cannot manage a workspace's server.
   */
  unprotected?: boolean;
  hasKey?: boolean;
  name: string;
  baseUrl: string;
  host: string;
  /** Plain HTTP, accepted with "I understand this is unencrypted" (tagged Unencrypted). */
  allowHttp: boolean;
  authScheme: EndpointAuthScheme;
  /** The key's last 4 characters; null when the endpoint has no key (tagged Unprotected). */
  keyHint: string | null;
  /** A Cloudflare Access service token is stored. */
  hasAccessHeaders?: boolean;
  /** Per attempt: response headers, or a stream's first byte. */
  timeoutMs: number;
  maxConcurrency: number;
  position: number;
  /** false = paused by its owner. */
  active: boolean;
  healthState: EndpointHealthState;
  /** What the last failure was, in a sentence (key-scrubbed by the API). */
  healthError?: string | null;
  /** When healthState last changed ("Down since 14:02"). */
  healthChangedAt?: string | null;
  healthCheckedAt?: string | null;
  /** The URL, key or auth changed since the last passing test, so every model is off until one passes. */
  needsTest?: boolean;
  /** Beyond the plan's endpoint count after a downgrade: kept, not routed. */
  overPlanLimit?: boolean;
  /** Models the server listed (or were added by hand), and how many are turned on. */
  modelCount?: number;
  enabledModelCount?: number;
  /** Median latency over the last 24 h, ms; null without samples. */
  p50Ms24h?: number | null;
  /** The newest probe, so a page can show "Testing…" and pick a running one up again. */
  lastProbe?: { id: number; status: EndpointProbeStatus; finishedAt?: string | null } | null;
  createdAt?: string;
  /**
   * (R6) Its turned-on models whose bare name a cloud model now also has. Absent from an older API
   * (no banner then, D45). `claim`: requests for the bare name fail with model_name_conflict until
   * the owner lets the name go; without one, the bare name goes to `vendor`.
   */
  nameConflicts?: EndpointNameConflict[];
}

/** (R6) A turned-on endpoint model whose bare name a cloud model now also has. */
export interface EndpointNameConflict {
  /** The model row id: the :modelId of PATCH /router/endpoints/:id/models/:modelId. */
  modelRowId: number;
  /** The upstream name, exactly as the server lists it. */
  model: string;
  /** The cloud vendor the bare name now also resolves to (openai, google…). */
  vendor: string;
  claim: boolean;
}

/** One bucket of GET /router/endpoints/:id/health: requests, tests and health checks together. */
export interface EndpointHealthBucket {
  start: string;
  requests: number;
  failures: number;
  /** Median latency of the successful samples in the bucket; null without one. */
  p50Ms: number | null;
}

/** One failed sample: a health check (ping), a test step (probe) or live requests (live). */
export interface EndpointHealthFailure {
  ts: string;
  source: 'ping' | 'probe' | 'live' | string;
  /** unreachable | timeout | tls | server | auth | busy | rejected | redirect | bad_response | blocked | tunnel_offline */
  cause: string | null;
  status: number | null;
  /** The model row the sample was for; null for a server-level check. */
  modelId: number | null;
}

/**
 * GET /router/endpoints/:id/health?window=24h|7d. From R6: 48 buckets of 30 minutes over 24 h (28 of
 * 6 h over 7 days), `bucketMs`, `uptime7d` and the newest 20 failures. Before R6: 24 hourly buckets
 * and the window's failures, without `bucketMs` or `uptime7d`.
 */
export interface EndpointHealthHistory {
  window: string;
  bucketMs?: number;
  buckets: EndpointHealthBucket[];
  uptime7d?: number | null;
  failures: EndpointHealthFailure[];
}

/** A workspace endpoint shared with this account: read-only here (from R5; empty before). */
export interface SharedEndpoint extends Endpoint {
  /** The workspace that shares it. */
  orgName?: string;
}

/** One model on an endpoint (router_endpoint_models, camelCased). */
export interface EndpointModel {
  /**
   * The row id: the :modelId of PATCH /router/endpoints/:id/models/:modelId. Never the upstream
   * name in a path: names like Qwen/Qwen3-32B contain "/", and the web proxy re-joins path segments.
   */
  id: number;
  /** The upstream id, exactly as the server lists it. */
  model: string;
  /** listed = from GET /models; manual = typed by hand. */
  source?: 'listed' | 'manual';
  /** Present in the server's last model list. */
  listed?: boolean;
  enabled: boolean;
  position?: number;
  /** The id requests name it by, ep/<slug>/<model> or ep/team.<slug>/<model> (the API's modelView, R3 on). */
  modelId?: string;
  /**
   * What its owner tagged it for (the API's modelView, R3 on; set by PATCH `roles`). auto-coding,
   * auto-reasoning and auto-tooling try tagged models first (plan §5.2 step 3); `general` orders nothing.
   */
  roles?: EndpointRole[];
  /** Effective context (the smaller of declared and discovered); null = unknown. */
  contextTokens: number | null;
  /** Where contextTokens came from. */
  contextSource: 'declared' | 'vllm' | 'sglang' | 'llamacpp' | 'ollama_ps' | 'ollama_assumed' | 'lmstudio' | 'tgi' | 'listing' | 'learned' | null;
  declaredContextTokens: number | null;
  maxOutputTokens: number | null;
  /** Declared USD per 1M tokens; null = not declared (counts as $0). */
  priceInPerMTok: number | null;
  priceOutPerMTok: number | null;
  /** From the last test: true native tool calls, false answered in prose, null untested. */
  supportsTools: boolean | null;
  forcedTools: 'native' | 'emulated' | null;
  supportsStream: boolean | null;
  streamUsage: boolean | null;
  thinkFormat: 'none' | 'field' | 'tags' | 'leading_close' | 'harmony';
  /** The cloud vendor that also resolves this bare name (openai, google…); null when none does. */
  bareNameConflict: string | null;
  /** Turned on while the bare name had no cloud resolution: requests for the bare name stay here. */
  bareNameClaim: boolean;
  /** The last chat test passed: only then can the model be turned on. */
  lastProbeOk: boolean | null;
  lastProbeAt: string | null;
}

/** One line of a test: what was checked, and what happened, in a sentence. */
export interface EndpointProbeStep {
  /** address | models | context | chat | tools | stream */
  step: string;
  /** Set on the per-model steps. */
  model?: string | null;
  ok: boolean;
  code?: string | null;
  message: string;
  ms?: number | null;
}

export interface EndpointProbe {
  id?: number;
  status: EndpointProbeStatus;
  steps: EndpointProbeStep[];
  /** The models this test asks to answer; none = the address and the model list only. */
  models: string[] | null;
  /** GET /models answered under this address instead (a base URL without /v1). */
  suggestedBaseUrl?: string | null;
  startedAt?: string;
  finishedAt?: string | null;
}

/** GET /router/endpoints/:id */
export interface EndpointView {
  endpoint: Endpoint;
  models: EndpointModel[];
  lastProbe: EndpointProbe | null;
  health: {
    state: EndpointHealthState;
    since: string | null;
    checkedAt: string | null;
    lastError: string | null;
    p50Ms24h: number | null;
    uptime7d: number | null;
  };
}

export interface EndpointLimits {
  plan: string;
  /** Endpoints this account may have (STAFF_LIMITS while endpoints are staff-only). */
  max: number;
  used: number;
  /** Over the limit is logged, never refused (Enterprise). */
  soft: boolean;
  modelsPerEndpoint: { listed: number; enabled: number };
}

/** GET /router/endpoints */
export interface EndpointList {
  endpoints: Endpoint[];
  shared: SharedEndpoint[];
  limits: EndpointLimits;
  /** While endpoints are staff-only: the address endpoint requests come from. */
  egress?: { ips: string[]; ipv4Only: boolean };
}

export interface EndpointCreate {
  name: string;
  slug?: string;
  baseUrl: string;
  authScheme?: EndpointAuthScheme;
  apiKey?: string;
  allowHttp?: boolean;
  acknowledgeUnencrypted?: boolean;
  timeoutMs?: number;
  maxConcurrency?: number;
  /** A Cloudflare Access service token, sent as CF-Access-Client-Id / -Secret. */
  accessHeaders?: { clientId: string; clientSecret: string };
}

export interface EndpointPatch {
  name?: string;
  baseUrl?: string;
  authScheme?: EndpointAuthScheme;
  /** null removes the key. */
  apiKey?: string | null;
  allowHttp?: boolean;
  acknowledgeUnencrypted?: boolean;
  timeoutMs?: number;
  maxConcurrency?: number;
  active?: boolean;
}

/**
 * A test the API did not start with a create or an address/key/auth change (from the R4 API's 58add09):
 * `message` is the sentence Test itself would answer, so the page shows it instead of calling Test.
 */
export interface DeferredProbe { deferred: boolean; code?: string; retryAfterSec?: number; message?: string }

export interface EndpointModelPatch {
  enabled?: boolean;
  declaredContextTokens?: number | null;
  maxOutputTokens?: number | null;
  priceInPerMTok?: number | null;
  priceOutPerMTok?: number | null;
  /** false: let the bare name go to the cloud vendor that now also has it. */
  bareNameClaim?: false;
  /** The uses it is tagged for; null or [] clears them (the API takes at most the four roles). */
  roles?: EndpointRole[] | null;
}

/** The uses an endpoint model can be tagged for (router_endpoint_models.roles). */
export type EndpointRole = 'coding' | 'reasoning' | 'tooling' | 'general';

// ============================================================================
// Workspace and project servers (R5, staff only)
//
// The same OpenAI-compatible servers, owned by a workspace instead of a person: workspace-wide
// ("Servers for every project": the owner adds them, shares them with every project or chosen ones,
// and may let members name them with their personal keys) or one project's ("Servers for this
// project": its managers add them). Their models are named ep/team.<slug>/<model>. They are reached
// through the web's /api/account proxy, whose answers use the { success, data, error, message } shape;
// teamEndpointsApi() unwraps `data` and throws ApiRequestError with the body on a refusal, as the
// personal calls do, so one pane (components/router/EndpointsPane) serves all three scopes.
// ============================================================================

/** Who may use a workspace-wide server (the R5 POST / PATCH body adds these). */
export interface EndpointSharing {
  /** Every project in the workspace, or only those in `projectIds`. */
  shareProjects?: 'all' | 'selected';
  projectIds?: number[];
  /** Seat holders' personal keys may use it: only by naming it (ep/team.…) or under their own Prefer or Only. */
  membersCanUse?: boolean;
}

/**
 * A workspace or project server as the account API lists it (R5 contract §1 OrgEndpoint /
 * ProjectEndpointItem). Seat holders who cannot manage it get `baseUrl`, `keyHint`, `healthError` null.
 */
export interface TeamEndpoint extends Endpoint, EndpointSharing {
  /** 'workspace' = a workspace-wide server, 'project' = one project's own. */
  scope?: 'workspace' | 'project';
  projectId?: number | null;
  /** In a project's list: 'project' = its own server, 'workspace' = a workspace server shared with it. */
  source?: 'project' | 'workspace';
  /** Every model row (the personal `shared` list: the turned-on ones), with the id requests use. */
  models?: Array<{ model: string; enabled?: boolean; modelId?: string; roles?: EndpointRole[] }>;
  /** Models turned on, tested and with a context size, on this server. */
  readyModels?: number;
}

/** GET /account/org/endpoints (seat holders; viewers get none) and GET /account/org/projects/:id/endpoints. */
export interface TeamEndpointList {
  endpoints: TeamEndpoint[];
  /** The workspace's endpoint allowance (limits.ts): one count for workspace and project servers together. */
  limits?: EndpointLimits;
  /** While endpoints are staff-only: the address endpoint requests come from. */
  egress?: { ips: string[]; ipv4Only: boolean };
  /** Whether the caller may change these servers (the workspace's owner; a project's manager or the owner). */
  canManage?: boolean;
  /** Workspace list, owner: every project of the workspace, for "Share with". */
  projects?: Array<{ id: number; name: string }>;
  /** Project list: the models its keys can be routed to now (its own servers and the workspace's shared with it). */
  readyModels?: number;
}

/**
 * GET /account/org/endpoints/:id `usage30d` (owner or manager): requests routed to this server in the
 * last 30 days, counted from router_requests, never their content. `byKeySource.project`: project keys
 * of a project server's own project; `workspace`: project keys of the projects a workspace server is
 * shared with; `personal`: members' personal keys.
 */
export interface EndpointUsage {
  requests: number;
  byKeySource: { project: number; workspace: number; personal: number };
  byMember: Array<{ label: string; requests: number }>;
}

/** The calls one endpoints pane makes, whichever account owns the endpoints. */
export interface EndpointsApi {
  get(id: string): Promise<EndpointView & { usage30d?: EndpointUsage }>;
  create(body: EndpointCreate & EndpointSharing): Promise<{ endpoint: Endpoint; probeId: number | null; probe?: DeferredProbe }>;
  update(id: string, patch: EndpointPatch & EndpointSharing): Promise<{ endpoint?: Endpoint; probeId?: number | null; probe?: DeferredProbe }>;
  reorder(ids: string[]): Promise<unknown>;
  remove(id: string): Promise<{ warnings?: string[] }>;
  probe(id: string, models?: string[]): Promise<{ probeId: number }>;
  getProbe(id: string, probeId: number): Promise<EndpointProbe>;
  addModel(id: string, model: string): Promise<{ model?: EndpointModel }>;
  updateModel(id: string, modelId: number, patch: EndpointModelPatch): Promise<{ model?: EndpointModel }>;
  /** R6: the health over time (GET …/:id/health?window=24h|7d; a workspace's and a project's from R5's API). */
  health(id: string, window?: '24h' | '7d'): Promise<EndpointHealthHistory>;
  /**
   * M4, provider endpoints only: "Replace key and re-test listed models" (POST …/:id/replace-key). The listed
   * models are tested again with the new key; a listing whose test passes stays listed.
   */
  replaceKey?(id: string, apiKey: string): Promise<{ endpoint?: Endpoint; probeId?: number | null; models?: string[]; probe?: DeferredProbe; notices?: string[] }>;
}

/** M4: what a provider endpoint adds to the endpoint view (GET /account/provider/endpoints). */
export interface ProviderEndpointExtras {
  /** A safety hold (phase3-plan §2.4): requests and our runs to it stop until it is resolved. */
  hold: { reason: 'domain_lapse' | 'tls_issuer_change'; reasons: string[]; since: string } | null;
  /** The TLS certificate issuer recorded from the health checks, and a new one waiting for staff. */
  tls: { issuer: string; since: string; pendingIssuer: string | null } | null;
  listings: Array<{ id: number; model: string; state: string }>;
}
export type ProviderEndpoint = Endpoint & { provider?: ProviderEndpointExtras };

/** GET /account/provider/endpoints */
export interface ProviderEndpointList {
  endpoints: ProviderEndpoint[];
  limits: EndpointLimits & { listingsMax?: number; listingsUsed?: number };
  verifiedDomains: string[];
  attestedHosts: string[];
  /** verified: the host must be on a verified domain; verified_or_attested: an internal test account; none: an individual. */
  hostRule: 'verified' | 'verified_or_attested' | 'none';
  canManage: boolean;
  /** After approval a change of base URL is reviewed by a person. */
  baseUrlLocked: boolean;
  egress?: { ips: string[]; ipv4Only: boolean };
}

// ============================================================================
// API Monitoring Types
// ============================================================================

export interface KeyActivity {
  id: number;
  model: string;
  provider: string;
  /** Phase 3 M8: a row routed to a listed host, "<Host> · <model> (listed host)". */
  providerLabel?: string;
  category: string | null;
  language: string | null;
  complexity: string | null;
  promptPreview: string | null;
  tokensIn: number;
  tokensOut: number;
  cost: string;
  latency: number;
  success: boolean;
  timestamp: string;
}

export interface KeyCostBreakdown {
  keyId: number;
  keyName: string;
  department: string | null;
  assignedTo: string | null;
  period: string;
  totalCost: string;
  totalRequests: number;
  totalTokens: number;
  dailyCosts: Array<{ date: string; cost: number; requests: number }>;
  modelBreakdown: Array<{ model: string; cost: string; requests: number; percentage: string }>;
  forecast: { daysUntilBudget: number | null; projectedMonthEnd: number };
}

export interface KeySummary {
  id: number;
  name: string;
  keyPrefix: string;
  department: string | null;
  assignedTo: string | null;
  tags: string[];
  budgetLimit: number | null;
  budgetHardLimit: boolean;
  currentSpend: number;
  budgetUtilization: number | null;
  requestCount: number;
  lastUsed: string | null;
  topCategory: string | null;
}

export interface BudgetAlert {
  id: number;
  keyId: number;
  keyName: string;
  alertType: 'threshold_warning' | 'budget_exceeded';
  thresholdPct: number;
  amountSpent: number;
  budgetLimit: number;
  acknowledged: boolean;
  createdAt: string;
}

export interface PromptAuditEntry {
  id: number;
  keyId: number;
  keyName: string;
  department: string | null;
  promptPreview: string;
  category: string;
  language: string;
  complexity: string;
  model: string;
  provider: string;
  /** Phase 3 M8: a row routed to a listed host, "<Host> · <model> (listed host)". */
  providerLabel?: string;
  cost: string;
  timestamp: string;
}

export interface EfficiencyMetrics {
  keyId: number;
  keyName: string;
  department: string | null;
  avgTokensPerRequest: number;
  avgCostPerRequest: number;
  errorRate: string;
  avgLatency: number;
  requestCount: number;
  topCategories: Array<{ category: string; percentage: string }>;
}

export interface DataApiKey {
  id: number;
  name: string | null;
  keyPrefix: string;
  tier: string;
  appUrl: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
  usedToday: number;
  dailyLimit: number;
  totalRequests: number;
}

export interface DataApiTier {
  daily: number;
  perMinute: number;
  label: string;
}

// ============================================================================
// API Client Class
// ============================================================================

class ApiClient {
  private baseUrl: string;
  private userId: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Set the user ID for authenticated requests
   */
  setUserId(userId: string) {
    this.userId = userId;
  }

  /**
   * Make a fetch request with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {};

    // Only add Content-Type if there's a body
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    // Add existing headers from options
    if (options.headers) {
      const existingHeaders = new Headers(options.headers);
      existingHeaders.forEach((value, key) => {
        headers[key] = value;
      });
    }

    // Add user ID header if available (temporary until auth is implemented)
    if (this.userId) {
      headers['x-user-id'] = this.userId;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const parsed: unknown = await response.json().catch(() => ({
          error: 'Unknown Error',
          message: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        }));
        const body = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
        throw new ApiRequestError(response.status, body, `Request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unknown error occurred');
    }
  }

  // ==========================================================================
  // Universal Keys API
  // ==========================================================================

  /**
   * Get all universal API keys for the current user
   */
  async getUniversalKeys(): Promise<{ keys: UniversalKey[]; setup?: RouterSetup }> {
    return this.request('/api/router/keys');
  }

  /**
   * Create a new universal API key
   */
  async createUniversalKey(name: string): Promise<{
    key: string;
    keyId: number;
    name: string;
    keyPrefix: string;
    message: string;
    providers?: string[];
    waitingForProviderKey?: boolean;
  }> {
    return this.request('/api/router/keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  /**
   * Revoke a universal API key
   */
  async revokeUniversalKey(keyId: number): Promise<{
    success: boolean;
    message: string;
    keyId: number;
  }> {
    return this.request(`/api/router/keys/${keyId}`, {
      method: 'DELETE',
    });
  }

  // ==========================================================================
  // Public Data API Keys (asl_*)
  // ==========================================================================

  /**
   * List the caller's Data API keys. These gate /api/v1/* — the read-only
   * benchmark API — and are separate from the aism_ router keys above, which
   * can spend money through connected provider accounts.
   */
  async getDataKeys(): Promise<{ keys: DataApiKey[]; tiers: Record<string, DataApiTier> }> {
    return this.request('/api/router/data-keys');
  }

  async createDataKey(name: string, appUrl?: string): Promise<{
    key: string;
    id: number;
    name: string;
    keyPrefix: string;
    tier: string;
    limits: DataApiTier;
    message: string;
  }> {
    return this.request('/api/router/data-keys', {
      method: 'POST',
      body: JSON.stringify({ name, appUrl }),
    });
  }

  async revokeDataKey(keyId: number): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/router/data-keys/${keyId}`, { method: 'DELETE' });
  }

  // ==========================================================================
  // Provider Keys API
  // ==========================================================================

  /**
   * Get all provider API keys for the current user
   */
  async getProviderKeys(): Promise<{ keys: ProviderKey[] }> {
    return this.request('/api/router/provider-keys');
  }

  /**
   * Add a new provider API key
   */
  /**
   * Add a provider key, or replace the one saved for that provider. The API asks the provider
   * first: a refused key is not saved and the call throws with the provider's reason.
   */
  async addProviderKey(
    provider: string,
    apiKey: string,
    replace = false,
  ): Promise<{
    success: boolean;
    message: string;
    keyId: number;
    provider: string;
    verdict?: KeyVerdict;
    replaced?: boolean;
    modelsAvailable?: number;
    providers?: string[];
  }> {
    return this.request('/api/router/provider-keys', {
      method: 'POST',
      body: JSON.stringify({ provider, apiKey, replace }),
    });
  }

  /**
   * Check a saved provider key with the provider
   */
  async validateProviderKey(keyId: number): Promise<{
    success: boolean;
    valid: boolean;
    message: string;
    verdict?: KeyVerdict;
    modelsAvailable?: number;
    models?: string[];
    providers?: string[];
  }> {
    return this.request(`/api/router/provider-keys/${keyId}/validate`, {
      method: 'POST',
    });
  }

  /**
   * Delete a provider API key
   */
  async deleteProviderKey(keyId: number): Promise<{
    success: boolean;
    message: string;
    keyId: number;
  }> {
    return this.request(`/api/router/provider-keys/${keyId}`, {
      method: 'DELETE',
    });
  }

  // ==========================================================================
  // Private endpoints (staff only in R3: GET answers 404 to everyone else)
  // ==========================================================================

  /** The account's endpoints, limits and (staff phase) egress address. Throws ApiRequestError 404 when off for this account. */
  async getEndpoints(): Promise<EndpointList> {
    return this.request('/api/router/endpoints');
  }

  /** One endpoint with its models, newest test and health. */
  async getEndpoint(id: string): Promise<EndpointView> {
    return this.request(`/api/router/endpoints/${encodeURIComponent(id)}`);
  }

  /** Add an endpoint. The API saves it and starts a test of the address and model list (no model is asked to answer). */
  async createEndpoint(body: EndpointCreate): Promise<{ endpoint: Endpoint; probeId: number | null; probe?: DeferredProbe }> {
    return this.request('/api/router/endpoints', { method: 'POST', body: JSON.stringify(body) });
  }

  /**
   * Change an endpoint. A new base URL, key or auth scheme turns every model off until a test
   * passes again; the API may start that test itself and say so with `probeId`.
   */
  async updateEndpoint(id: string, patch: EndpointPatch): Promise<{ endpoint?: Endpoint; probeId?: number | null; probe?: DeferredProbe }> {
    return this.request(`/api/router/endpoints/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
  }

  // ── Listed hosts (Phase 3 M8) ──

  /** The Listed providers pane; 404 (ApiRequestError) for accounts the marketplace is not open to. */
  async getListedHosts(): Promise<{ hosts: ListedHost[]; staffPreview?: boolean }> {
    return this.request('/api/router/marketplace');
  }

  /**
   * Add or replace the key for a listed host: checked first; 409 chat_check_needed until a 1-token check is confirmed.
   * `hosts` are the addresses the dialog named: the API refuses (409 hosts_changed, nothing sent) if the host has another.
   */
  async connectListedHost(slug: string, apiKey: string, chatConfirmed: boolean, hosts: string[]): Promise<ListedKeyResult> {
    return this.request(`/api/router/marketplace/${encodeURIComponent(slug)}/key`, { method: 'POST', body: JSON.stringify({ apiKey, hosts, ...(chatConfirmed ? { chatConfirmed: true } : {}) }) });
  }

  /** Check the stored key again. */
  async checkListedHost(slug: string, chatConfirmed = false): Promise<ListedKeyResult> {
    return this.request(`/api/router/marketplace/${encodeURIComponent(slug)}/check`, { method: 'POST', body: JSON.stringify(chatConfirmed ? { chatConfirmed: true } : {}) });
  }

  /** The account's choice for a host (API M22; "Use in routing" before it), or "Send my key to <host>" after a host change. */
  async updateListedHost(slug: string, patch: { useInRouting?: boolean; confirmHost?: string; choice?: ListedChoice }): Promise<{ host: ListedHost | null }> {
    return this.request(`/api/router/marketplace/${encodeURIComponent(slug)}`, { method: 'PATCH', body: JSON.stringify(patch) });
  }

  /** API M22: this account has seen the listed providers now (later ones are marked new). */
  async markListedSeen(): Promise<{ seenAt: string | null }> {
    return this.request('/api/router/marketplace/seen', { method: 'POST', body: '{}' });
  }

  async removeListedHost(slug: string): Promise<{ removed: boolean }> {
    return this.request(`/api/router/marketplace/${encodeURIComponent(slug)}`, { method: 'DELETE' });
  }

  /** The order routing tries endpoints in: every id, first to last. */
  async reorderEndpoints(ids: string[]): Promise<unknown> {
    return this.request('/api/router/endpoints/order', { method: 'PUT', body: JSON.stringify({ ids }) });
  }

  async deleteEndpoint(id: string): Promise<{ warnings?: string[] }> {
    return this.request(`/api/router/endpoints/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  /** Start a test. With models (at most 4), each one is asked to answer; without, the address and model list only. */
  async probeEndpoint(id: string, models?: string[]): Promise<{ probeId: number }> {
    return this.request(`/api/router/endpoints/${encodeURIComponent(id)}/probe`, {
      method: 'POST',
      body: JSON.stringify(models && models.length ? { models } : {}),
    });
  }

  async getEndpointProbe(id: string, probeId: number): Promise<EndpointProbe> {
    return this.request(`/api/router/endpoints/${encodeURIComponent(id)}/probes/${encodeURIComponent(String(probeId))}`);
  }

  /** A model the server does not list, by name. */
  async addEndpointModel(id: string, model: string): Promise<{ model?: EndpointModel }> {
    return this.request(`/api/router/endpoints/${encodeURIComponent(id)}/models`, { method: 'POST', body: JSON.stringify({ model }) });
  }

  async updateEndpointModel(id: string, modelId: number, patch: EndpointModelPatch): Promise<{ model?: EndpointModel }> {
    return this.request(`/api/router/endpoints/${encodeURIComponent(id)}/models/${encodeURIComponent(String(modelId))}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  /** An endpoint's health over time: buckets, the 7-day uptime (R6) and its recent failures. */
  async getEndpointHealth(id: string, window: '24h' | '7d' = '24h'): Promise<EndpointHealthHistory> {
    return this.request(`/api/router/endpoints/${encodeURIComponent(id)}/health?window=${window}`);
  }

  // ==========================================================================
  // Preferences API
  // ==========================================================================

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<UserPreferences & { scoring?: unknown; driftExit?: unknown; switchCostExample?: unknown; routedLast7d?: unknown }> {
    // From the API's A1 release the answer also says how the router scores right now (`scoring`, read with
    // lib/router-scoring scoringOf). It is the router's state, not a setting. From A2, where its features apply,
    // three more facts that are not settings either (lib/router-adaptive adaptiveFactsOf): whether the drift exit is
    // active, the account's own move-cost example and its last 7 days' routed requests.
    return this.request('/api/router/preferences');
  }

  /**
   * Update user preferences. From R4 the answer carries the stored `modelSource` (plan D45): the
   * page treats a save that sent one as done only when this echo equals it. An older API, which
   * ignores the field, sends no echo.
   *
   * From R4b the source changes only by compare-and-set: `modelSourceFrom` is the source the page last
   * read (or saved). Without it the API keeps the stored source and ignores `modelSource`; with a value
   * that is no longer the stored one it answers 409 `model_source_changed` `{message, modelSource}`
   * and saves nothing (or, in a rare race the message names, the other settings but not the source).
   */
  async updatePreferences(
    preferences: Partial<UserPreferences> & { modelSourceFrom?: ModelSource }
  ): Promise<{
    success: boolean;
    message: string;
    modelSource?: ModelSource;
    /** From the API's A2 release, where its features apply: the stored values. */
    requestMatching?: boolean;
    strategyScope?: StrategyScope;
    modelSwitching?: ModelSwitching;
    switchCostCapUsd?: number | null;
    /** From the API's M18 release, when the request sent it: the stored value. */
    sameModelCheaperHost?: boolean;
  }> {
    return this.request('/api/router/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }

  // ==========================================================================
  // Analytics API
  // ==========================================================================

  /**
   * Get analytics overview
   */
  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    return this.request('/api/router/analytics/overview');
  }

  /**
   * Get timeline data
   */
  async getTimeline(
    period: 'hourly' | 'daily' = 'daily',
    days: number = 7
  ): Promise<TimelineData> {
    return this.request(`/api/router/analytics/timeline?period=${period}&days=${days}`);
  }

  /**
   * Get cost savings data
   */
  async getCostSavings(): Promise<CostSavings> {
    return this.request('/api/router/analytics/cost-savings');
  }

  /**
   * Get recent requests
   */
  async getRecentRequests(
    limit: number = 10,
    offset: number = 0
  ): Promise<{
    requests: RecentRequest[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    return this.request(`/api/router/analytics/recent-requests?limit=${limit}&offset=${offset}`);
  }

  /**
   * Model changes (router release A1c): when a key's automatic requests started going to another model, and why.
   * Every plan. `key` is a key id or 'all'; `before` an ISO time (the previous answer's last change). The raw answer:
   * lib/model-changes.ts modelChangesOf reads it. An API before A1c answers 404 (ApiRequestError status 404).
   */
  async getModelChanges(params: { key?: number | 'all'; before?: string; limit?: number } = {}): Promise<unknown> {
    const q = new URLSearchParams();
    if (params.key !== undefined) q.set('key', String(params.key));
    if (params.before) q.set('before', params.before);
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return this.request(`/api/router/analytics/model-changes${qs ? `?${qs}` : ''}`);
  }

  /**
   * Get monthly usage summary
   */
  async getMonthlyUsage(): Promise<{
    month: string;
    totalRequests: number;
    successfulRequests: number;
    totalCost: string;
    totalTokens: number;
    averageCostPerRequest: string;
  }> {
    return this.request('/api/router/analytics/monthly-usage');
  }

  /**
   * Get model performance data
   */
  async getModelPerformance(): Promise<{
    models: Array<{
      model: string;
      provider: string;
      requests: number;
      successRate: string;
      averageLatency: number;
      totalCost: string;
    }>;
  }> {
    return this.request('/api/router/analytics/model-performance');
  }

  /**
   * Get available models
   */
  /**
   * Models currently in the routing pool, ranked best first.
   * `name` is the model id used to pin a model on /v1/chat/completions and the
   * value stored in the excludedModels preference.
   */
  /** What these (unsaved) preferences would route to right now. Spends nothing. */
  async previewPreferences(prefs: Partial<UserPreferences> & {
    samplePrompt?: string; sampleHasTools?: boolean;
    /** From the API's A2 release: the sample request's tool names, the conversation it continues and its last message. */
    sampleToolNames?: string[]; sampleConversationModel?: string | null; sampleTurnKind?: 'new_message' | 'tool_result';
  }): Promise<PreferencesPreview> {
    return this.request('/api/router/preferences/preview', { method: 'POST', body: JSON.stringify(prefs) });
  }

  async getAvailableModels(): Promise<{
    models: Array<{
      modelId: number;
      name: string;
      provider: string;
      rank: number;
      score: number;
      costPer1k: number | null;
      avgLatency: number | null;
      supportsToolCalling: boolean;
      supportsStreaming: boolean;
    }>;
  }> {
    return this.request('/api/router/analytics/available-models');
  }

  // ==========================================================================
  // API Monitoring
  // ==========================================================================

  async getPromptLoggingState(): Promise<{ enabled: boolean; retentionDays: number }> {
    return this.request('/api/router/monitoring/prompt-logging');
  }

  async togglePromptLogging(enabled: boolean, retentionDays?: number): Promise<{ success: boolean }> {
    return this.request('/api/router/monitoring/prompt-logging', {
      method: 'PUT',
      body: JSON.stringify({ enabled, retentionDays }),
    });
  }

  async getKeyActivity(keyId: number, opts?: { before?: string; limit?: number; category?: string }): Promise<{
    activity: KeyActivity[];
    nextCursor: string | null;
  }> {
    const params = new URLSearchParams();
    if (opts?.before) params.set('before', opts.before);
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.category) params.set('category', opts.category);
    return this.request(`/api/router/monitoring/keys/${keyId}/activity?${params}`);
  }

  async getKeyCosts(keyId: number, period?: '7d' | '30d' | '90d'): Promise<{ costs: KeyCostBreakdown | null }> {
    return this.request(`/api/router/monitoring/keys/${keyId}/costs?period=${period || '30d'}`);
  }

  async getKeysSummary(): Promise<{ keys: KeySummary[] }> {
    return this.request('/api/router/monitoring/keys/summary');
  }

  async getPromptAudit(opts?: { before?: string; limit?: number; keyId?: number; category?: string }): Promise<{
    prompts: PromptAuditEntry[];
    nextCursor: string | null;
  }> {
    const params = new URLSearchParams();
    if (opts?.before) params.set('before', opts.before);
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.keyId) params.set('keyId', String(opts.keyId));
    if (opts?.category) params.set('category', opts.category);
    return this.request(`/api/router/monitoring/prompts?${params}`);
  }

  async getPromptCategories(): Promise<{
    categories: Array<{ category: string; count: number; percentage: string }>;
  }> {
    return this.request('/api/router/monitoring/prompt-categories');
  }

  async getBudgetStatus(): Promise<{ keys: Array<{
    id: number; name: string; department: string | null;
    budgetLimit: number | null; budgetHardLimit: boolean; budgetAlertThreshold: number;
    currentSpend: number; utilization: number | null;
  }> }> {
    return this.request('/api/router/monitoring/budget-status');
  }

  async getBudgetAlerts(acknowledged?: boolean): Promise<{ alerts: BudgetAlert[] }> {
    return this.request(`/api/router/monitoring/budget-alerts?acknowledged=${acknowledged || false}`);
  }

  async acknowledgeBudgetAlert(alertId: number): Promise<{ success: boolean }> {
    return this.request(`/api/router/monitoring/budget-alerts/${alertId}/acknowledge`, { method: 'POST' });
  }

  async getEfficiencyMetrics(): Promise<{ keys: EfficiencyMetrics[] }> {
    return this.request('/api/router/monitoring/efficiency');
  }

  async deletePrompt(requestId: number): Promise<{ success: boolean }> {
    return this.request(`/api/router/monitoring/prompts/${requestId}`, { method: 'DELETE' });
  }

  async purgePrompts(opts?: { keyId?: number; before?: string }): Promise<{ success: boolean; purged: number }> {
    const params = new URLSearchParams();
    params.set('confirm', 'true'); // Fix #10: explicit confirm required by backend
    if (opts?.keyId) params.set('keyId', String(opts.keyId));
    if (opts?.before) params.set('before', opts.before);
    return this.request(`/api/router/monitoring/prompts/purge?${params}`, { method: 'DELETE' });
  }

  async updateKey(keyId: number, data: {
    department?: string | null;
    assignedTo?: string | null;
    tags?: string[];
    budgetLimitMonthly?: number | null;
    budgetHardLimit?: boolean;
    budgetAlertThreshold?: number;
    promptLoggingOverride?: number | null;
  }): Promise<{ success: boolean }> {
    return this.request(`/api/router/keys/${keyId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const apiClient = new ApiClient();

// ============================================================================
// Endpoints by scope (R5): the personal calls above, or a workspace's and a project's
// ============================================================================

/** The account's own endpoints (/router/endpoints): the calls above, unchanged. */
export const personalEndpointsApi: EndpointsApi = {
  get: id => apiClient.getEndpoint(id),
  create: body => apiClient.createEndpoint(body),
  update: (id, patch) => apiClient.updateEndpoint(id, patch),
  reorder: ids => apiClient.reorderEndpoints(ids),
  remove: id => apiClient.deleteEndpoint(id),
  probe: (id, models) => apiClient.probeEndpoint(id, models),
  getProbe: (id, probeId) => apiClient.getEndpointProbe(id, probeId),
  addModel: (id, model) => apiClient.addEndpointModel(id, model),
  updateModel: (id, modelId, patch) => apiClient.updateEndpointModel(id, modelId, patch),
  health: (id, window = '24h') => apiClient.getEndpointHealth(id, window),
};

/**
 * One call to the account API through the web's /api/account proxy (same origin, as the workspace
 * pages call it). Its answers are { success, data, error, message }: `data` comes back, and a refusal
 * throws ApiRequestError with the body, so `error` is the code and `message` the sentence to show.
 * Some older account routes put the sentence in `error`; it is moved to `message` so it is shown.
 */
async function accountCall<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/account${path}`, {
      method: init.method ?? 'GET',
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const parsed: unknown = await res.json().catch(() => null);
  const j = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  if (!res.ok || j.success === false) {
    const body = typeof j.message !== 'string' && typeof j.error === 'string' && /\s/.test(j.error) ? { ...j, message: j.error } : j;
    throw new ApiRequestError(res.status, body, `Request failed with status ${res.status}`);
  }
  return ('data' in j ? j.data : parsed) as T;
}

const seg = (v: string | number) => encodeURIComponent(String(v));

/**
 * The servers of the caller's workspace (no projectId) or of one of its projects, through
 * /account/org/endpoints and /account/org/projects/:id/endpoints (plan §3 R5). The paths mirror the
 * personal ones (/:id, /:id/probe, /:id/probes/:probeId, /:id/models[/:modelId], /order, /:id/health).
 */
export function teamEndpointsApi(projectId?: number): EndpointsApi & { list(): Promise<TeamEndpointList> } {
  const base = projectId == null ? '/org/endpoints' : `/org/projects/${seg(projectId)}/endpoints`;
  return {
    list: async () => {
      const d = await accountCall<TeamEndpointList | TeamEndpoint[] | null>(base);
      // A viewer's answer is an empty list; either shape is read.
      return Array.isArray(d) ? { endpoints: d } : { ...(d ?? {}), endpoints: Array.isArray(d?.endpoints) ? d!.endpoints : [] };
    },
    get: id => accountCall(`${base}/${seg(id)}`),
    create: body => accountCall(base, { method: 'POST', body }),
    update: (id, patch) => accountCall(`${base}/${seg(id)}`, { method: 'PATCH', body: patch }),
    reorder: ids => accountCall(`${base}/order`, { method: 'PUT', body: { ids } }),
    remove: async id => (await accountCall<{ warnings?: string[] } | null>(`${base}/${seg(id)}`, { method: 'DELETE' })) ?? {},
    probe: (id, models) => accountCall(`${base}/${seg(id)}/probe`, { method: 'POST', body: models && models.length ? { models } : {} }),
    getProbe: (id, probeId) => accountCall(`${base}/${seg(id)}/probes/${seg(probeId)}`),
    addModel: (id, model) => accountCall(`${base}/${seg(id)}/models`, { method: 'POST', body: { model } }),
    updateModel: (id, modelId, patch) => accountCall(`${base}/${seg(id)}/models/${seg(modelId)}`, { method: 'PATCH', body: patch }),
    // The workspace owner's (/org/endpoints/:id/health) or a project manager's (…/projects/:id/endpoints/:eid/health).
    health: (id, window = '24h') => accountCall(`${base}/${seg(id)}/health?window=${window}`),
  };
}

/**
 * M4: a provider account's endpoints (/account/provider/endpoints/*, the same shapes as /router/endpoints),
 * for the provider variant of EndpointsPane. `provider` is the account's public id (?provider=), or null for
 * the API's default account.
 */
export function providerEndpointsApi(provider: string | null): EndpointsApi & { list(): Promise<ProviderEndpointList> } {
  const q = provider ? `?provider=${seg(provider)}` : '';
  const base = '/provider/endpoints';
  const at = (p: string) => `${base}${p}${q}`;
  const withQ = (p: string, extra: string) => `${base}${p}${q ? `${q}&${extra}` : `?${extra}`}`;
  return {
    list: async () => {
      const d = await accountCall<ProviderEndpointList | null>(at(''));
      return { ...(d ?? {} as ProviderEndpointList), endpoints: Array.isArray(d?.endpoints) ? d!.endpoints : [] };
    },
    get: id => accountCall(at(`/${seg(id)}`)),
    create: body => accountCall(at(''), { method: 'POST', body }),
    update: (id, patch) => accountCall(at(`/${seg(id)}`), { method: 'PATCH', body: patch }),
    reorder: ids => accountCall(at('/order'), { method: 'PUT', body: { ids } }),
    remove: async id => (await accountCall<{ warnings?: string[] } | null>(at(`/${seg(id)}`), { method: 'DELETE' })) ?? {},
    probe: (id, models) => accountCall(at(`/${seg(id)}/probe`), { method: 'POST', body: models && models.length ? { models } : {} }),
    getProbe: (id, probeId) => accountCall(at(`/${seg(id)}/probes/${seg(probeId)}`)),
    addModel: (id, model) => accountCall(at(`/${seg(id)}/models`), { method: 'POST', body: { model } }),
    updateModel: (id, modelId, patch) => accountCall(at(`/${seg(id)}/models/${seg(modelId)}`), { method: 'PATCH', body: patch }),
    health: (id, window = '24h') => accountCall(withQ(`/${seg(id)}/health`, `window=${window}`)),
    replaceKey: (id, apiKey) => accountCall(at(`/${seg(id)}/replace-key`), { method: 'POST', body: { apiKey } }),
  };
}

/**
 * Copy one of the caller's own endpoints into the workspace (no projectId: the owner) or into a
 * project (its manager). The API makes a new server with a new public id and encrypts the key again
 * on its side; the key never passes through the browser. The personal endpoint is not changed. A
 * plain-HTTP endpoint needs `acknowledgeUnencrypted` again (the team's prompts would cross it; the R5
 * API's importPersonalEndpoint, not yet in contract v1).
 */
export function importEndpoint(fromEndpoint: string, projectId?: number, extra: { slug?: string; acknowledgeUnencrypted?: boolean } = {}): Promise<{ endpoint: Endpoint; probeId?: number | null; probe?: DeferredProbe; notices?: string[] }> {
  return accountCall('/org/endpoints/import', { method: 'POST', body: { fromEndpoint, ...(projectId == null ? {} : { projectId }), ...extra } });
}

// ============================================================================
// React Hooks (optional, for easier usage in components)
// ============================================================================

export function useApiClient() {
  return apiClient;
}
