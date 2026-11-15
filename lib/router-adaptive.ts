import type { ModelSwitching, PreviewConversation, PreviewDetails, RecentRequest, StrategyScope, TieBreak, UserPreferences } from './api-client';

/**
 * Router release A2 on the web (adaptive-routing plan §5.1–5.5, §7.5; owner decisions D11–D14, D23, D28): Match each
 * request, Apply this strategy to and Model switching, with the preview's sample request and the request lists'
 * "Ranked on" and Kept / Switched.
 *
 * The API sends the four settings in GET /router/preferences (and a project's in its policy) only where the features
 * apply to the account, staff first. Every page detects them (hasAdaptive) and renders exactly as before without them,
 * and sends them back only when it read them. No announcement (D23): the options simply exist where they apply. Every
 * plan (D28). Copy states only what the API does: never "#1". Code is written between
 * backticks here; the pages render it as code (components/router/AdaptiveSettings Rich).
 */

export interface AdaptiveSettings {
  requestMatching: boolean;
  strategyScope: StrategyScope;
  modelSwitching: ModelSwitching;
  switchCostCapUsd: number | null;
}

/** The defaults, which Reset sends (plan §5.5). */
export const ADAPTIVE_DEFAULTS: AdaptiveSettings = { requestMatching: false, strategyScope: 'auto', modelSwitching: 'conversation', switchCostCapUsd: 0.5 };

/**
 * Every strategy id a saved preference or X-AISM-Strategy can name (plan §7.6): the saved ones, the effective ones
 * (best_agentic_coding, the value variants), custom_split, and pinned for a request that named its model. Moved here from
 * app/router/RouterDashboard.tsx (router release AW3) so the dashboard and the model changes (components/router/
 * ModelChanges.tsx) name a strategy alike.
 */
export const STRATEGY_NAME: Readonly<Record<string, string>> = {
  best_overall: 'Best overall', best_coding: 'Best for coding', best_reasoning: 'Best for reasoning', best_tooling: 'Best for tool use',
  best_agentic_coding: 'Best for agentic coding',
  best_value: 'Best value overall', best_value_coding: 'Best value for coding', best_value_reasoning: 'Best value for reasoning',
  best_value_tooling: 'Best value for tool use', fastest_quality: 'Fastest good model', best_consistent: 'Most consistent',
  fastest: 'Fastest response', cheapest: 'Lowest list price', match_task: 'Match each request', custom_split: 'Your traffic split',
  pinned: 'Named model',
};

/** The A2 settings are there: the features apply to this account (or this project's workspace). */
export const hasAdaptive = (p: object | null | undefined): boolean => !!p && 'modelSwitching' in p;

/** Facts GET /router/preferences adds with A2. Not settings: kept apart and never sent back. */
export interface AdaptiveFacts {
  /** The drift exit is active: One model per conversation also moves at the next message after a drift alert. */
  driftExit: boolean;
  /** The account's own move cost at its median request (≥ 20 routed requests in 30 days), else null. */
  switchCostExample: { medianTokensIn: number; fromModel: string; toModel: string; extraUsd: number } | null;
  /** The last 7 days' routed requests: how many, how many were sent as `auto`, and the mode most of them named. */
  routedLast7d: { routed: number; sentAsAuto: number; topMode: string | null } | null;
}
export const NO_FACTS: AdaptiveFacts = { driftExit: false, switchCostExample: null, routedLast7d: null };

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** The facts, read field by field: anything malformed is left out. */
export function adaptiveFactsOf(raw: { driftExit?: unknown; switchCostExample?: unknown; routedLast7d?: unknown }): AdaptiveFacts {
  const ex = raw.switchCostExample as Record<string, unknown> | null | undefined;
  const r7 = raw.routedLast7d as Record<string, unknown> | null | undefined;
  return {
    driftExit: raw.driftExit === true,
    switchCostExample: ex && typeof ex === 'object' && num(ex.medianTokensIn) && ex.medianTokensIn > 0 && str(ex.fromModel) && str(ex.toModel) && num(ex.extraUsd) && ex.extraUsd >= 0
      ? { medianTokensIn: ex.medianTokensIn, fromModel: ex.fromModel, toModel: ex.toModel, extraUsd: ex.extraUsd }
      : null,
    routedLast7d: r7 && typeof r7 === 'object' && num(r7.routed) && num(r7.sentAsAuto)
      ? { routed: r7.routed, sentAsAuto: r7.sentAsAuto, topMode: str(r7.topMode) ? r7.topMode : null }
      : null,
  };
}

/** The four settings of a preferences or policy object, or null when the API did not send them. */
export function adaptiveOf(p: Partial<AdaptiveSettings> | null | undefined): AdaptiveSettings | null {
  if (!p || !hasAdaptive(p)) return null;
  return {
    requestMatching: p.requestMatching === true,
    strategyScope: p.strategyScope === 'all' ? 'all' : 'auto',
    modelSwitching: p.modelSwitching === 'message' || p.modelSwitching === 'request' ? p.modelSwitching : 'conversation',
    switchCostCapUsd: p.switchCostCapUsd === null ? null : num(p.switchCostCapUsd) ? p.switchCostCapUsd : ADAPTIVE_DEFAULTS.switchCostCapUsd,
  };
}

/** Matching changes what a strategy ranks on only for Best overall and Best value (plan §4.5). */
export const MATCHABLE: ReadonlySet<string> = new Set(['best_overall', 'best_value']);
/** The Best quality cards that always rank on their own benchmark. */
export const OWN_BENCHMARK: ReadonlySet<string> = new Set(['best_coding', 'best_reasoning', 'best_tooling']);
/** Matching applies to requests sent as `auto` with these settings. */
export const matchingApplies = (p: Pick<UserPreferences, 'routingStrategy' | 'requestMatching'>): boolean =>
  p.requestMatching === true && MATCHABLE.has(p.routingStrategy);

/** The move-cost limits offered (D13: $0.50 by default); any other stored value is shown as it is. */
export const SWITCH_CAPS: ReadonlyArray<number | null> = [0.1, 0.5, 2, null];
export const capLabel = (v: number | null): string => (v === null ? 'No limit' : usd(v));
/** The limits to offer: the four, plus a stored value that is none of them, in order of size, No limit last. */
export function capOptions(stored: number | null): Array<number | null> {
  const out = [...SWITCH_CAPS];
  if (stored !== null && !out.includes(stored)) out.splice(out.findIndex(v => v === null || v > stored), 0, stored);
  return out;
}

/** "$0.22", "$2.00"; under a cent "$0.004". */
export function usd(v: number): string {
  return v > 0 && v < 0.01 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`;
}
/** 91,430 tokens → "91K"; under a thousand as the number. */
export function tokensShort(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000).toLocaleString('en-US')}K` : String(Math.round(n));
}

/* ── Routing preferences: the copy (plan §5.2, word for word; D11's names) ─────────────────────────────── */

/** The page lead once the A2 settings are there. */
export const PAGE_LEAD = 'How the Smart Router picks a model for your requests. Requests sent as `model: "auto"` use the strategy below; a request that names a mode, such as `auto-coding`, uses that mode unless you apply your strategy to every routed request. Model switching, the tie-break, limits and exclusions apply to every routed request. Every change is previewed live against your own keys before you save, and the preview spends nothing.';

/** The Routing strategy pane's sub. */
export const STRATEGY_SUB = 'What the router ranks models on.';

/**
 * "Your own rules" without its "Match each request" card, whose job is the toggle: the group note's "Decide per
 * request" would point at a card that is not there. Not in plan §5.2 (AW2-report: for the coordinator).
 */
export const OWN_RULES_NOTE = 'Split traffic between models yourself.';

export const MATCH = {
  label: 'Match each request',
  sub: 'Rank each request on the benchmark that tests its kind of work.',
  body: 'Requests with tools are ranked on tool use, or on coding when the tools work on files, code or a terminal. Code without tools is ranked on coding. Design and planning requests are ranked on reasoning, and so is a conversation that is already eight or more messages long when it first reaches the router. Anything else is ranked on the overall score. The routing reason names the rule that matched.',
  scope: 'Applies to Best overall and Best value, and so to `auto`, `auto-best`, `auto-value` and `auto-task`. A mode that names a benchmark, such as `auto-coding` or `auto-value-tooling`, is used as sent.',
  /** Shown whenever the tie-break is not Highest score. */
  tieHint: 'Matching picks the benchmark; the tie-break picks among the models that benchmark cannot separate. To get the top-scoring model on each request\'s benchmark, choose Highest score under When models are tied.',
  /** The Best quality card chosen is one that ranks on its own benchmark. */
  ownBenchmark: 'Best coding, Best reasoning and Best tool use always rank on their own benchmark.',
  /** Both new panes hidden under Model source "Only my endpoints". */
  onlyEndpoints: 'Match each request and Model switching choose among the models we benchmark, so they are off while Model source is Only my endpoints.',
} as const;

export const SCOPE = {
  label: 'Apply this strategy to',
  options: [
    { id: 'auto' as const, name: 'Requests sent as auto', desc: 'A request that names a mode, such as `auto-best` or `auto-coding`, uses that mode. Set your app\'s model to `auto` to control routing from this page.' },
    { id: 'all' as const, name: 'Every routed request', desc: '`auto` and every `auto-*` name use this strategy, so you can change routing here without changing your apps. A request that names a model, such as `gpt-6.1-sol`, still goes to that model.' },
  ],
} as const;

/**
 * The scope's inline note: ≥ 20 routed requests in the last 7 days, none sent as `auto`, while the scope is
 * "Requests sent as auto". null otherwise, and when the API names no mode.
 */
export function scopeNote(scope: StrategyScope, routed: AdaptiveFacts['routedLast7d']): string | null {
  if (scope !== 'auto' || !routed || routed.routed < 20 || routed.sentAsAuto !== 0 || !routed.topMode) return null;
  return `Your requests in the last 7 days named \`${routed.topMode}\`, so this strategy was not used for them.`;
}

export const SWITCHING = {
  title: 'Model switching',
  sub: 'Whether a conversation that is under way can move to another model. A new conversation always starts on the current pick. Applies to every routed request, whatever mode it names.',
  /** The re-send cost, before the limits; the limits sit between `before` and `after`. */
  costIntro: 'A move re-sends the whole conversation to a model that has not cached it, at your provider\'s full input price.',
  costBefore: 'Skip a move that would cost more than',
  costAfter: 'to re-send.',
  note: 'Moves on scores alone are rare: replayed over 18 days of real results, this rule released a conversation\'s model 0 to 2 times per strategy. Most moves come from a message of a different kind, or a model that can no longer serve it.',
} as const;

/** The three options, as worded for these settings: the drift sentence when the API reports the drift exit active, and
 * "on the benchmark that matches it" when Match each request is on. */
export function switchingOptions(opts: { driftExit: boolean; matching: boolean }): Array<{ id: ModelSwitching; name: string; tag?: string; desc: string }> {
  return [
    {
      id: 'conversation', name: 'One model per conversation', tag: 'Recommended for agents',
      desc: `The model that answered keeps the conversation while you can still use it. It keeps its own reasoning between steps, and your provider keeps the conversation in its prompt cache, so long conversations and agent loops cost the least. This is how routing has always worked.${opts.driftExit ? ' It also moves at your next message if that model gets a drift alert.' : ''}`,
    },
    {
      // The rule per strategy family (plan §4.6; review W3): 2.58 standard errors for the quality strategies, the 5-point
      // bar for the value and contender ones, membership for a split; with the drift exit, a drift alert (held by the
      // cost limit like any move: continuity.ts decideContinuity).
      id: 'message', name: 'At each new message',
      desc: `Each new message you send is ranked again${opts.matching ? ', on the benchmark that matches it' : ''}. The conversation moves only when its model is no longer a good fit for your strategy and the move costs less than your limit below, or when its model can no longer serve it. For Best overall, Best coding, Best reasoning and Best tool use, that means another model leads it by more than 2.58 standard errors (a wider margin than the one that defines a tie). For the Best value strategies, Most consistent and Fastest good model, it has fallen more than 5 points behind the best score. For a traffic split, it is no longer in the split.${opts.driftExit ? ' A drift alert on its model also makes it no longer a good fit.' : ''} Tool calls and their results stay on the model that made them.`,
    },
    {
      // A drift alert moves a conversation only with the drift exit active (router.drift_exit).
      id: 'request', name: 'At every request',
      desc: `The same check at every request, tool results included, so a model can change in the middle of an agent loop. Inside a loop the benchmark rarely changes, so this mostly lets a loop react to new results${opts.driftExit ? ', a drift alert' : ''} or a failure one step sooner. The new model starts without the previous model's hidden reasoning.`,
    },
  ];
}

/** The personal line under the cost limits, from the account's own requests; null without the API's example. */
export function costExampleLine(ex: AdaptiveFacts['switchCostExample'], nameOf: (model: string) => string): string | null {
  if (!ex) return null;
  return `At your median request of ${tokensShort(ex.medianTokensIn)} tokens, a move to ${nameOf(ex.toModel)} would cost about ${usd(ex.extraUsd)} more than staying.`;
}

/**
 * When models are tied, the hint after each tie-break's description once Model switching exists (plan §5.2): across
 * conversations the keep of Cheaper and Faster (lib/router-scoring, as before), within one Model switching. "Highest
 * score" keeps no pick under v1 and states its v2 keep in its own description, so its hint is the second sentence.
 */
export function tieHintAdaptive(id: TieBreak): string {
  return id === 'highest'
    ? 'Within a conversation, Model switching decides.'
    : 'Across conversations, a model you were already routed to stays while it is still within the margin, so the pick does not change with every new run. Within a conversation, Model switching decides.';
}

/** The preview's split note once a conversation keeps its model (plan §5.2). */
export const splitNote = (shares: string): string => `Split: ${shares}. Each new conversation draws its model in these proportions.`;

/** §2.9: the preview's score label under estimator v2. */
export const ROUTER_SCORE_V2 = 'Router score: weighted mean of recent results, newest weighted most (the leaderboard shows the latest single result).';

/* ── The preview's sample request and its results ─────────────────────────────────────────────────────── */

export const SAMPLE = {
  hasTools: 'It offers tools',
  toolNames: 'Tool names',
  toolNamesHint: 'e.g. read_file, write_to_file, execute_command',
  conversation: 'Continue a conversation on',
  conversationNone: 'None',
  turnKind: 'Last message is',
  turnNew: 'A new message',
  turnTool: 'A tool result',
} as const;

/** The tool names typed in the sample box, as the API takes them: at most 64 names of at most 100 characters. */
export function toolNamesOf(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[\s,]+/)) {
    const name = raw.trim().slice(0, 100);
    if (name && !out.includes(name)) out.push(name);
    if (out.length === 64) break;
  }
  return out;
}

/** A benchmark in a sentence ("ranked on the tool-use benchmark") and as a label ("Ranked on: Tool use"). */
export const BENCHMARK_WORD: Readonly<Record<string, string>> = {
  overall: 'combined', coding: 'coding', reasoning: 'reasoning', tool_use: 'tool-use', agentic_coding: 'coding and tool-use',
};
export const BENCHMARK_LABEL: Readonly<Record<string, string>> = {
  overall: 'Combined', coding: 'Coding', reasoning: 'Reasoning', tool_use: 'Tool use', agentic_coding: 'Coding + tool use',
};

/**
 * What the matched request "reads as", by the rule (details.requestKind). The API's phrases are written for the routing
 * reason ("the request offers tools"), and do not read after "reads as"; these say the same of each rule. A rule the
 * page does not know reads as the API's phrase. (AW2-report: for the coordinator.)
 */
const KIND_READS_AS: Readonly<Record<string, string>> = {
  tools_code: 'a request whose tools work on code',
  tools: 'a request that offers tools',
  long_session: 'a long session',
  planning: 'a design or planning request',
  code: 'a coding request',
  general: 'a general request',
};

/** "This request reads as a request that offers tools, so it is ranked on the tool-use benchmark." null when matching did not apply. */
export function matchedLine(d: Pick<PreviewDetails, 'requestKind' | 'matchPhrase' | 'benchmark'> | null | undefined): string | null {
  if (!d || !d.benchmark || !BENCHMARK_WORD[d.benchmark] || (!d.requestKind && !str(d.matchPhrase))) return null;
  let reads = d.requestKind ? KIND_READS_AS[d.requestKind] : undefined;
  // long_session carries its count in the API's phrase: "long session (12 messages)".
  const count = d.requestKind === 'long_session' && typeof d.matchPhrase === 'string' ? /\((\d+) messages\)/.exec(d.matchPhrase) : null;
  if (reads && count) reads = `${reads} (${count[1]} messages)`;
  if (!reads) reads = (d.matchPhrase as string).trim();
  return `This request reads as ${reads}, so it is ranked on the ${BENCHMARK_WORD[d.benchmark]} benchmark.`;
}

/**
 * "In this conversation: …" for a previewed request that continues a conversation (plan §5.2; review W2): the API's own
 * reason clause (`sentence`), which is exact for every cause; "stays on {from}" for a conversation that stays and has no
 * clause; nothing for a new conversation. `why` is a code and is never shown, and the page adds no claim of its own.
 */
export function conversationLine(c: PreviewConversation | null | undefined, nameOf: (model: string) => string): string | null {
  if (!c || c.event === 'new') return null;
  if (str(c.sentence)) return `In this conversation: ${c.sentence.trim()}`;
  if (c.event === 'stayed' && str(c.from)) return `In this conversation: stays on ${nameOf(c.from)}`;
  return null;
}

/* ── Recent requests (/router, /router/analytics): Ranked on, and Kept / Switched (plan §7.5) ─────────── */

/**
 * Strategies that rank on no benchmark (review W1): Lowest list price sorts on price, Fastest response on latency, a
 * split is a weighted draw, and a named model is not ranked. A1 still records `benchmark = 'overall'` for the first three.
 */
const NO_BENCHMARK: ReadonlySet<string> = new Set(['cheapest', 'fastest', 'custom_split', 'pinned']);

/**
 * The benchmark a request was ranked on, as a label: only when its strategy ranks on one (not cheapest, fastest,
 * custom_split or pinned, and not when no strategy was recorded); null otherwise, and for older rows.
 */
export function rankedOn(req: Pick<RecentRequest, 'benchmark' | 'strategy'>): string | null {
  if (typeof req.strategy !== 'string' || !req.strategy.trim() || NO_BENCHMARK.has(req.strategy)) return null;
  return typeof req.benchmark === 'string' ? BENCHMARK_LABEL[req.benchmark] ?? null : null;
}

/**
 * Kept: Model switching re-checked a conversation and kept its model (within the noise, or by the cost limit).
 * Switched: it moved the conversation on scores. A move because the model could no longer serve it (`moved`, since A1)
 * and every other value carry no tag, as before.
 */
export function conversationTag(req: Pick<RecentRequest, 'conversation'>): 'Kept' | 'Switched' | null {
  return req.conversation === 'kept' || req.conversation === 'kept_cost' ? 'Kept' : req.conversation === 'switched' ? 'Switched' : null;
}
