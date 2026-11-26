import { CLUSTER, GUIDES, ROUTER_BASE_URL, VALUE_FLOOR_POINTS } from '@/components/seo/routers/routers-data';

/**
 * The facts behind the Smart Router's routing guides: /llm-routing-by-task, /llm-fallback-routing,
 * /llm-cost-routing, /byok-llm-router and /llm-routing-for-coding-agents.
 *
 * Everything here restates what the running router does, read from the API's router (its selector,
 * request classifier, proxy, circuit breaker and key store) and from the pages that already publish
 * it: /router, /router/docs, /docs/teams and the integration guides. The constants the AI router
 * pages share stay in components/seo/routers/routers-data.ts; the ones below are the rest, each
 * with the part of the router it is copied from, so a change there has one place to follow here.
 *
 * Copy rules for these five pages: no other product is named, static text names provider families
 * and never a model, and the router's limits are these constants or come from the plan table.
 */

/** The day the five guides were written and every rule on them was read against the router. */
export const ROUTING_PUBLISHED_ISO = '2026-11-26';

/* ── constants copied from the API's router, each with its source ── */

/** Selector: a caller's own fallback order and traffic split each hold at most 10 models. */
export const MAX_OWN_LIST = 10;
/** Selector: after the split and the caller's own order, at most 2 automatic fallbacks, preferring providers not yet in the chain. */
export const MAX_AUTO_FALLBACKS = 2;
/** Circuit breaker SUCCESS_THRESHOLD: successful probes in a row that close a circuit again (one probe at a time). */
export const CIRCUIT_PROBE_SUCCESSES = 2;
/** Proxy FIRST_BYTE_DEADLINE_MS: a streamed attempt that has sent nothing by then gives way to the next model. */
export const FIRST_BYTE_DEADLINE_S = 120;
/** Key cooldown BASE_MS and MAX_MS: how long a rate-limited provider key rests on one model (doubling per 429 in a row). */
export const KEY_REST_BASE_S = 15;
export const KEY_REST_MAX_S = 120;

/** Request classifier CLASSIFY_LIMITS: minCodingTools, minCodeWords, longSessionMessages and maxToolNames. */
export const MIN_CODING_TOOLS = 2;
export const MIN_CODE_WORDS = 2;
export const LONG_SESSION_MESSAGES = 8;
export const MAX_TOOL_NAMES_READ = 64;
/** The classifier's text bound: of a longer latest user message, the first and the last 8,192 characters are read. */
export const TEXT_READ_CHARS = 8192;

/** Model switching: DEFAULT_SWITCH_COST_CAP_USD, and the continuity gate's KEEP_Z and MOVE_LIMIT_REQUESTS. */
export const SWITCH_COST_DEFAULT_USD = 0.5;
export const SWITCH_STANDARD_ERRORS = 2.58;
export const MOVE_LIMIT_REQUESTS = 10;
/** Tool-turn memory TTL_MS: a model's own turn is kept for its agent loop. */
export const TURN_MEMORY_HOURS = 24;
/** Proxy ROUTER_BODY_LIMIT. */
export const BODY_LIMIT_MB = 32;

/* ── request-level routing: the classifier's rules ── */

/** The boards a request can be ranked on (the classifier's four benchmarks), as the leaderboard names them. */
export const BOARDS = ['Coding', 'Reasoning', 'Tool use', 'Combined'];

/**
 * The six rules in the order the classifier tries them, worded as on /router (RouterLanding's table),
 * so the two pages cannot disagree. `kind` is the value X-AISM-Request-Kind carries.
 */
export const MATCH_RULES: Array<{ rule: string; kind: string; reads: string; board: string }> = [
  { rule: 'Tools that work on code', kind: 'tools_code', reads: 'Tools offered, at least two of them for files, code or a terminal (read, edit, grep, bash and the like).', board: 'Coding' },
  { rule: 'Tools', kind: 'tools', reads: 'Any other request that offers tools.', board: 'Tool use' },
  { rule: 'Long session', kind: 'long_session', reads: 'A conversation already eight or more messages long when it first reaches the router.', board: 'Reasoning' },
  { rule: 'Design and planning', kind: 'planning', reads: 'Architecture, system design, trade-offs, a migration plan, a roadmap, a step-by-step plan.', board: 'Reasoning' },
  { rule: 'Code', kind: 'code', reads: 'A code block, code syntax, or two or more programming terms in the latest message.', board: 'Coding' },
  { rule: 'Anything else', kind: 'general', reads: 'Questions, writing, summaries and the rest of everyday work.', board: 'Combined' },
];

/* ── modes that route on cost ── */

/** The modes that rank on cost, each with its rule as /router states it (the selector's value order and its cheapest sort). */
export const COST_MODES: Array<{ id: string; ranks: string }> = [
  { id: 'auto-value', ranks: `Among the models within ${VALUE_FLOOR_POINTS} points of the best Combined score, the most points per dollar of one coding run.` },
  { id: 'auto-value-coding', ranks: `The same rule on the Coding board: within ${VALUE_FLOOR_POINTS} points of the best, then points per dollar of one coding run.` },
  { id: 'auto-value-reasoning', ranks: `Within ${VALUE_FLOOR_POINTS} points of the best Reasoning score, then points per dollar of one reasoning session.` },
  { id: 'auto-value-tooling', ranks: `Within ${VALUE_FLOOR_POINTS} points of the best Tool use score, then points per dollar of one tool-use session.` },
  { id: 'auto-cheapest', ranks: 'The lowest list price per token, input and output averaged. No quality bar.' },
];

/* ── coding agents: how each one connects (the registry in lib/integrations.ts has the full settings) ── */

export interface AgentTool {
  /** The guide at /router/integrations/<slug>. */
  slug: string;
  name: string;
  connects: string;
  model: string;
}

export const AGENT_TOOLS: AgentTool[] = [
  { slug: 'cline', name: 'Cline, Kilo Code and Roo Code', connects: 'The OpenAI Compatible provider, with the base URL and your router key.', model: 'auto-coding, or auto-tooling for long agent sessions.' },
  { slug: 'aider', name: 'Aider', connects: 'OPENAI_API_BASE and OPENAI_API_KEY in the shell.', model: 'openai/auto-coding, as the --model flag.' },
  { slug: 'opencode', name: 'OpenCode', connects: 'A custom OpenAI-compatible provider in opencode.json, or one click with CC Switch.', model: 'aistupidlevel/auto-coding, or auto-tooling for sessions that call many tools.' },
  { slug: 'continue', name: 'Continue', connects: 'A model block in ~/.continue/config.yaml, with provider openai and apiBase.', model: 'auto-coding, for the chat, edit and apply roles.' },
  { slug: 'cursor', name: 'Cursor', connects: 'Override OpenAI Base URL in Cursor’s settings, used by chat and plan mode.', model: 'auto-coding, as the custom model name.' },
  { slug: 'claude-code', name: 'Claude Code', connects: 'ANTHROPIC_BASE_URL, set to the site root, and ANTHROPIC_API_KEY: the native Anthropic Messages endpoint.', model: 'The Claude model you choose in Claude Code, called with your own Anthropic key.' },
];

/* ── code samples: each one shows the request for the feature and the headers that confirm it ── */

const KEY = 'aism_your_key_here';

/** auto-task on a planning request: the classifier's `planning` rule, ranked on the Reasoning board. */
export const TASK_SAMPLE = `curl -i ${ROUTER_BASE_URL}/chat/completions \\
  -H "Authorization: Bearer ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "auto-task",
    "messages": [{"role": "user", "content": "Write a migration plan for moving our billing tables to a multi-tenant schema"}]
  }'

# Response headers
# X-AISM-Request-Kind: planning
# X-AISM-Benchmark: reasoning
# X-AISM-Strategy: best_reasoning
# X-AISM-Strategy-Source: request
# X-AISM-Model: <the model that answered>`;

/** The sandbox's simulated fallback: the chain's second model answers, with the reason a real fallback carries. */
export const FALLBACK_SAMPLE = `curl -i ${ROUTER_BASE_URL}/chat/completions \\
  -H "Authorization: Bearer ${KEY}" \\
  -H "Content-Type: application/json" \\
  -H "X-ASL-Sandbox: true" \\
  -H "X-ASL-Sandbox-Simulate: fallback" \\
  -d '{"model": "auto-coding", "messages": [{"role": "user", "content": "Hello!"}]}'

# Response headers
# X-AISM-Sandbox: true
# X-AISM-Model: <the second model in the chain>
# X-AISM-Reasoning: Sandbox: Fallback activated: <first model> failed -> routed to <second model>. ...`;

/** A value mode through the OpenAI SDK, reading the routing headers and the usage the provider reported. */
export const COST_SAMPLE = `from openai import OpenAI

client = OpenAI(
    base_url="${ROUTER_BASE_URL}",
    api_key="${KEY}",
)

raw = client.chat.completions.with_raw_response.create(
    model="auto-value-coding",
    messages=[{"role": "user", "content": "Write unit tests for parse_date()"}],
)
print(raw.headers["x-aism-strategy"])   # best_value_coding
print(raw.headers["x-aism-model"])      # the model that answered
print(raw.headers["x-aism-reasoning"])  # why it was chosen

usage = raw.parse().usage
print(usage.prompt_tokens, usage.completion_tokens)
print(usage.prompt_tokens_details.cached_tokens)  # served from your provider's prompt cache`;

/** A first request with the caller's own keys, then what the router itself counts. */
export const BYOK_SAMPLE = `curl -i ${ROUTER_BASE_URL}/chat/completions \\
  -H "Authorization: Bearer ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "auto-best", "messages": [{"role": "user", "content": "Summarise this contract in five points"}]}'

# Response headers
# X-AISM-Provider: <the provider whose key was used, and who bills the tokens>
# X-AISM-Model: <the model that answered>

curl ${ROUTER_BASE_URL}/usage -H "Authorization: Bearer ${KEY}"`;

/** A coding agent's request: two tools for files and code, so auto-task ranks it on the Coding board. */
export const AGENT_SAMPLE = `curl -i ${ROUTER_BASE_URL}/chat/completions \\
  -H "Authorization: Bearer ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "auto-task",
    "messages": [{"role": "user", "content": "The date parser drops time zones. Find the bug and fix it."}],
    "tools": [
      {"type": "function", "function": {"name": "read_file", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}}}},
      {"type": "function", "function": {"name": "apply_diff", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "diff": {"type": "string"}}}}}
    ]
  }'

# Response headers
# X-AISM-Request-Kind: tools_code
# X-AISM-Benchmark: coding
# X-AISM-Strategy: best_coding
# X-AISM-Conversation: new
# X-AISM-Model: <the model that answered>`;

/* ── links between the guides ── */

export interface GuideLink { path: string; label: string }

/** The five guides, each with the label its links carry: one list, kept beside the AI router pages' cluster. */
export const ROUTING_GUIDES: GuideLink[] = GUIDES;

/** The guides closest to each one, in the order to show them. */
const RELATED: Record<string, string[]> = {
  '/llm-routing-by-task': ['/llm-routing-for-coding-agents', '/llm-cost-routing', '/llm-fallback-routing'],
  '/llm-fallback-routing': ['/byok-llm-router', '/llm-routing-for-coding-agents', '/llm-routing-by-task'],
  '/llm-cost-routing': ['/byok-llm-router', '/llm-routing-by-task', '/llm-fallback-routing'],
  '/byok-llm-router': ['/llm-cost-routing', '/llm-fallback-routing', '/llm-routing-by-task'],
  '/llm-routing-for-coding-agents': ['/llm-routing-by-task', '/llm-fallback-routing', '/llm-cost-routing'],
};

export function relatedGuides(current: string): GuideLink[] {
  return (RELATED[current] ?? [])
    .map((path) => ROUTING_GUIDES.find((g) => g.path === path))
    .filter((g): g is GuideLink => !!g);
}

/** The AI router pages a closing band links to from here, by path; their labels come from the cluster's own list. */
const CLUSTER_PATHS = ['/ai-router', '/router'];

/** A guide's closing band: its related guides, what an AI router is, the product page and the documentation. */
export function exploreLinks(current: string): GuideLink[] {
  return [
    ...relatedGuides(current),
    ...CLUSTER.filter((c) => CLUSTER_PATHS.includes(c.path)),
    { path: '/router/docs', label: 'Router documentation' },
  ];
}
