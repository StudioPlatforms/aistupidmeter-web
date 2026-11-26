import { PLANS, ROUTER_CREDITS } from '@/lib/entitlements';
import { monthly, planName } from '@/lib/pricing-display';
import { SITE } from '@/lib/seo';

/**
 * The facts behind the AI router pages: /ai-router, /ai-aggregator, /best-ai-router and
 * /openrouter-alternatives.
 *
 * COMPETITOR FACTS: every sentence below restates what the vendor's own page said when it was
 * checked (CHECKED), and the page it came from is in `sources`. Nothing here is from a review site,
 * a competitor's comparison or memory. Re-check every entry before changing CHECKED; if a vendor's
 * page no longer says something, delete the sentence rather than keep it. Only facts a vendor
 * publishes about itself appear: what the product is, how it picks a model, where it runs, and its
 * published pricing. No entry says what a product lacks.
 *
 * ASL FACTS are read from code: the plan table (lib/entitlements.ts), the router's constants
 * (copied with their source in components/seo/router/RouterLanding.tsx) and the documented base URL
 * (app/router/docs/page.tsx).
 */

/** The day every competitor sentence was re-read on the vendor's own site. */
export const CHECKED = '26 November 2026';
export const CHECKED_ISO = '2026-11-26';
/** The day the AI router pages were first published; CHECKED_ISO is the day they were last re-checked and modified. */
export const PUBLISHED_ISO = '2026-10-30';

export const ROUTER_BASE_URL = `${SITE}/v1`;
/** The SoftwareApplication node app/router (components/seo/router/RouterLanding.tsx) declares. */
export const ROUTER_APP_ID = `${SITE}/router#software`;
/** components/seo/router/RouterLanding.tsx MODES: the auto-* modes GET /v1/models publishes. */
export const MODE_COUNT = 14;
/** apps/api/src/router/selector/index.ts VALUE_FLOOR_POINTS. */
export const VALUE_FLOOR_POINTS = 5;
/** apps/api/src/router/selector/index.ts: at most 5 fallbacks per request. */
export const MAX_FALLBACKS = 5;
/** apps/api/src/router/lib/circuit-breaker.ts FAILURE_THRESHOLD and COOLDOWN_MS. */
export const CIRCUIT_FAILURES = 5;
export const CIRCUIT_COOLDOWN_S = 60;
/** apps/api/src/router/keys/encryption.ts ALGORITHM. */
export const KEY_CIPHER = 'AES-256-GCM';
export const CADENCE = 'coding every four hours, reasoning and tool use daily, with an hourly canary probe';
export const OPENNESS = 'The methodology is public: every weight, statistical test and drift constant. The test tasks are private, so no lab can train on them.';

const n = (x: number) => x.toLocaleString('en-US');
const FREE = PLANS.free;
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/** "nine" for 9; digits past twelve. */
export const word = (x: number): string => WORDS[x] ?? n(x);
export const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** The free-tier sentence, every number from the plan table. */
export const FREE_ROUTER = `${n(FREE.routerRequestsPerMonth)} routed requests a month on every provider and every mode, with your own provider keys and no card`;
/** "Pro $12/mo for 10,000 requests a month; Developer $25/mo for 100,000." */
export const PAID_ROUTER = `${planName('pro')} ${monthly('pro')} for ${n(PLANS.pro.routerRequestsPerMonth)} routed requests a month; ${planName('developer')} ${monthly('developer')} for ${n(PLANS.developer.routerRequestsPerMonth)}`;
export const CREDITS = `top-up credits at $1 per ${n(ROUTER_CREDITS.requestsPerUsd)} requests, minimum $${ROUTER_CREDITS.minimumUsd}, that do not expire`;
/** The Free plan's routed requests, for the CTA captions. */
export const FREE_REQUESTS = n(FREE.routerRequestsPerMonth);

/**
 * The modes the live table on /ai-router shows, each with the key GET /dashboard/landing answers
 * under (components/landing/types.ts) and the rule it ranks on (RouterLanding.tsx MODES).
 */
export const LIVE_MODES: Array<{ id: string; key: string; ranks: string }> = [
  { id: 'auto-best', key: 'best_overall', ranks: 'The Combined board: coding 50%, reasoning 25%, tool use 25%.' },
  { id: 'auto-coding', key: 'best_coding', ranks: 'The Coding board: repository bug fixes graded by the project’s own tests.' },
  { id: 'auto-reasoning', key: 'best_reasoning', ranks: 'The Reasoning board: long, multi-turn working sessions.' },
  { id: 'auto-tooling', key: 'best_tooling', ranks: 'The Tool use board: sandboxed agent tasks with real tools.' },
  { id: 'auto-value', key: 'best_value', ranks: `Within ${VALUE_FLOOR_POINTS} points of the best Combined score, the most points per dollar of a scored run.` },
  { id: 'auto-fastest-quality', key: 'fastest_quality', ranks: `Within ${VALUE_FLOOR_POINTS} points of the best Combined score, the lowest median response time.` },
  { id: 'auto-fastest', key: 'fastest', ranks: 'The lowest response time outright.' },
  { id: 'auto-cheapest', key: 'cheapest', ranks: 'The lowest list price per token.' },
];

/** The first request through the router, in the documentation's own form (app/router/docs/page.tsx). */
export const PYTHON_SAMPLE = `from openai import OpenAI

client = OpenAI(
    base_url="${ROUTER_BASE_URL}",
    api_key="aism_your_key_here",
)

response = client.chat.completions.create(
    model="auto-coding",
    messages=[{"role": "user", "content": "Fix the failing test in parser.py"}],
)
print(response.choices[0].message.content)`;

export const CURL_SAMPLE = `curl ${ROUTER_BASE_URL}/chat/completions \\
  -H "Authorization: Bearer aism_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "auto-best",
    "messages": [{"role": "user", "content": "Summarise this contract in five points"}]
  }'`;

/** The OpenRouter migration: the three lines that change, marked. */
export const MIGRATE_SAMPLE = `import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: '${ROUTER_BASE_URL}',  // was https://openrouter.ai/api/v1
  apiKey: process.env.ASL_ROUTER_KEY,        // your aism_ router key
});

const response = await client.chat.completions.create({
  model: 'auto-coding',                      // a mode, or a model id from GET /v1/models
  messages: [{ role: 'user', content: 'Fix the failing test in parser.ts' }],
});`;

export interface Source { label: string; url: string }

export interface RouterEntry {
  key: string;
  name: string;
  /** Where the entry's name links: ASL's own page, or the vendor's site (nofollow). */
  url: string;
  /** One sentence: what the product is. */
  what: string;
  /** How it decides which model or provider answers. */
  picks: string;
  /** Where it runs. */
  hosting?: string;
  /** Prices and plans as the vendor publishes them. */
  pricing?: string;
  /** Your own provider keys, when the vendor documents it. */
  keys?: string;
  sources: Source[];
}

/** The Smart Router, from code. */
export function aslEntry(providerCount: number, modelCount: number): RouterEntry {
  const reach = modelCount > 0
    ? `${modelCount} models from ${providerCount} providers on the leaderboard`
    : 'every model on the leaderboard';
  return {
    key: 'asl',
    name: 'AI Stupid Level Smart Router',
    url: '/router',
    what: `An AI router with an OpenAI-compatible endpoint and a native Anthropic Messages endpoint, in front of ${reach}, all tested on the same tasks on the same schedule, and of your own OpenAI-compatible servers.`,
    picks: `Request by request: with auto-task, or Match each request on, each request is read on its own (its tools, its latest message, the length of the conversation) and ranked on the benchmark for that kind of work, with no extra model call. Its ${MODE_COUNT} auto-* modes rank on the public benchmark boards for coding, reasoning, tool use or all three, re-tested ${CADENCE}, or on response time, price or a split you set. Within a conversation, Model switching keeps the model that answered, or moves at a new message when another is clearly ahead and the re-send stays within your limit. Statistical ties go to your tie-break, cost per task by default. The value modes pick within ${VALUE_FLOOR_POINTS} points of the best, then the lowest cost of a scored run. A model whose drift detector has fired, or that has an open canary incident, moves behind the healthy ones, and every response names the model and why it won.`,
    hosting: 'Hosted. Requests go to each provider with your own key, or to OpenAI-compatible servers you run yourself; nothing is resold.',
    pricing: `No markup on tokens: providers bill you directly at their own list price. Free: ${FREE_ROUTER}. ${PAID_ROUTER}. Past an allowance, ${CREDITS}.`,
    keys: `Always your own provider keys, stored encrypted with ${KEY_CIPHER}, at every volume.`,
    sources: [
      { label: 'Smart Router', url: `${SITE}/router` },
      { label: 'Router documentation', url: `${SITE}/router/docs` },
      { label: 'Pricing', url: `${SITE}/pricing` },
    ],
  };
}

export const OPENROUTER: RouterEntry = {
  key: 'openrouter',
  name: 'OpenRouter',
  url: 'https://openrouter.ai',
  what: 'One OpenAI-compatible API in front of hundreds of models from many providers, with routing, fallbacks and cost tracking.',
  picks: 'Its Auto Router has a fast decision model rate eleven aspects of each request, such as the kind of task and how hard it is, then weighs that rating against live prices, cache status and benchmark performance, within your cost tier, to pick the model and its reasoning effort. Among the providers of one model, a request goes by each provider’s price, throughput, latency and reliability, with fallbacks when one fails.',
  hosting: 'Hosted.',
  pricing: 'Provider prices passed through with no markup on inference; a fee applies when you buy credits. Free models carry low rate limits: 50 requests a day, or 1,000 a day after buying at least 10 credits.',
  keys: 'Supported. Pay-as-you-go includes $25,000 a month of list-price usage with no fee on your own keys; above that, the fee is 5% of what the same model and provider would cost on OpenRouter.',
  sources: [
    { label: 'openrouter.ai', url: 'https://openrouter.ai/' },
    { label: 'OpenRouter FAQ', url: 'https://openrouter.ai/docs/faq' },
    { label: 'OpenRouter Auto Router', url: 'https://openrouter.ai/docs/guides/routing/routers/auto-router' },
    { label: 'OpenRouter provider selection', url: 'https://openrouter.ai/docs/guides/routing/provider-selection' },
    { label: 'OpenRouter quickstart', url: 'https://openrouter.ai/docs/quickstart' },
  ],
};

/** The other routers and gateways, in the order the comparison lists them. */
export const OTHERS: RouterEntry[] = [
  {
    key: 'requesty',
    name: 'Requesty',
    url: 'https://www.requesty.ai',
    what: 'A unified AI gateway, LLM router and OpenAI-compatible API for 600+ AI models.',
    picks: 'Latency-based routing, automatic failover chains and weighted load balancing across models.',
    hosting: 'Hosted, at router.requesty.ai.',
    pricing: 'Free plan with 200 requests a day; pay as you go carries a 5% markup; Enterprise is custom.',
    keys: 'Bring your own keys is listed on the pay-as-you-go plan.',
    sources: [
      { label: 'requesty.ai', url: 'https://www.requesty.ai/' },
      { label: 'Requesty pricing', url: 'https://www.requesty.ai/pricing' },
    ],
  },
  {
    key: 'vercel',
    name: 'Vercel AI Gateway',
    url: 'https://vercel.com/ai-gateway',
    what: 'A managed gateway for calling models across providers, with central credentials, request logs, spend budgets and failover.',
    picks: 'Routes requests across providers and fallback models; you can set a provider order and ordered model fallbacks.',
    hosting: 'Hosted by Vercel; your application does not need to run on Vercel.',
    pricing: 'No markup and no platform fee on tokens. The free tier covers a subset of models with per-model rate limits; some optional features are charged separately.',
    keys: 'Your own keys carry no markup, and no fee by default, and need the paid tier, which means purchased credits.',
    sources: [
      { label: 'Vercel AI Gateway docs', url: 'https://vercel.com/docs/ai-gateway' },
      { label: 'Vercel AI Gateway pricing', url: 'https://vercel.com/docs/ai-gateway/pricing' },
    ],
  },
  {
    key: 'litellm',
    name: 'LiteLLM',
    url: 'https://www.litellm.ai',
    what: 'An open-source AI gateway and LLM proxy that puts an AI stack behind one OpenAI-compatible API, for 140+ providers.',
    picks: 'Load balancing across providers, regions and keys, with fallbacks and model aliases; virtual keys carry hard budgets and rate limits.',
    hosting: 'Self-hosted. MIT-licensed and free to self-host.',
    pricing: 'Free to self-host; Enterprise adds SSO, RBAC, audit logs and support, priced on request.',
    sources: [
      { label: 'litellm.ai', url: 'https://www.litellm.ai/' },
      { label: 'LiteLLM AI Gateway docs', url: 'https://docs.litellm.ai/docs/simple_proxy' },
    ],
  },
  {
    key: 'portkey',
    name: 'Portkey',
    url: 'https://portkey.ai',
    what: 'An AI gateway whose core is open source, run locally with one command or self-hosted and connected to Portkey.',
    picks: 'Fallbacks between providers and models, load balancing between API keys, and conditional routing on checks you define.',
    hosting: 'Hosted, or the open-source gateway on your own servers.',
    sources: [
      { label: 'Portkey AI Gateway docs', url: 'https://portkey.ai/docs/product/ai-gateway' },
    ],
  },
  {
    key: 'cloudflare',
    name: 'Cloudflare AI Gateway',
    url: 'https://developers.cloudflare.com/ai-gateway/',
    what: 'A gateway to observe and control AI applications, with request retries and model fallback.',
    picks: 'Dynamic routing checks conditions on request metadata, splits traffic by percentage, and switches to a fallback when a request or budget quota is exceeded.',
    hosting: 'Hosted on Cloudflare, available on all plans.',
    keys: 'You can store provider API keys in the Cloudflare dashboard and reference them from the gateway.',
    sources: [
      { label: 'Cloudflare AI Gateway docs', url: 'https://developers.cloudflare.com/ai-gateway/' },
      { label: 'Cloudflare dynamic routing', url: 'https://developers.cloudflare.com/ai-gateway/features/routing/dynamic-routing/' },
      { label: 'Cloudflare stored keys', url: 'https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/' },
    ],
  },
  {
    key: 'helicone',
    name: 'Helicone AI Gateway',
    url: 'https://www.helicone.ai',
    what: 'A unified API for 100+ LLM providers in the OpenAI SDK format, part of Helicone’s open-source LLM observability platform.',
    picks: 'Automatic failover across providers, with routing and fallbacks you configure.',
    pricing: 'Credits with 0% markup. Hobby plan free with 10,000 requests, 1 GB storage and one seat; Pro $79 a month; Team $799 a month.',
    sources: [
      { label: 'Helicone AI Gateway docs', url: 'https://docs.helicone.ai/gateway/overview' },
      { label: 'Helicone pricing', url: 'https://www.helicone.ai/pricing' },
    ],
  },
  {
    key: 'notdiamond',
    name: 'Not Diamond',
    url: 'https://www.notdiamond.ai',
    what: 'An intelligent model router for coding agents.',
    picks: 'Predicts which model to use for each input, aiming to cut cost while keeping accuracy.',
    sources: [{ label: 'notdiamond.ai', url: 'https://www.notdiamond.ai/' }],
  },
  {
    key: 'kong',
    name: 'Kong AI Gateway',
    url: 'https://konghq.com/products/kong-ai-gateway',
    what: 'A gateway that governs LLM, MCP and agent-to-agent (A2A) traffic, with one consistent API across the major LLM providers.',
    picks: 'Load balancing across AI models with the strategy you configure: weighted round-robin, consistent hashing, least connections, lowest usage, lowest latency, semantic similarity between the prompt and model descriptions, or priority groups, with built-in retries and fallbacks.',
    hosting: 'Managed through Kong Konnect: data plane nodes run in your own environment, or Kong hosts them on Dedicated Cloud Gateways. Self-hosted deployments are supported too.',
    pricing: 'AI Management on the Plus plan from $25 a month plus usage, billed monthly, with a 30-day free trial and no credit card; Enterprise is custom, billed annually.',
    keys: 'LLM provider credentials are centralized in one place and rotated without touching each team’s configuration.',
    sources: [
      { label: 'Kong AI Gateway', url: 'https://konghq.com/products/kong-ai-gateway' },
      { label: 'Kong AI Gateway docs', url: 'https://developer.konghq.com/ai-gateway/' },
      { label: 'Kong AI Gateway load balancing', url: 'https://developer.konghq.com/ai-gateway/load-balancing/' },
      { label: 'Kong pricing', url: 'https://konghq.com/pricing' },
    ],
  },
  {
    key: 'truefoundry',
    name: 'TrueFoundry AI Gateway',
    url: 'https://www.truefoundry.com/ai-gateway',
    what: 'A proxy layer between your applications and LLM providers and MCP servers: one endpoint with an OpenAI-compatible schema for every provider, with observability and governance.',
    picks: 'A virtual model carries the routing strategy you choose: weight-based, priority-based with fallback to the next target on failure, latency-based on recent latency, or Auto Routing, which classifies each request as simple, medium or complex and routes it to the target set for that tier.',
    hosting: 'SaaS, hybrid, or fully self-hosted in your own VPC.',
    pricing: 'Model-provider costs are passed through with no markup on tokens. Developer plan free for up to 3 users, with 10K requests and tool calls per user a month; Pro $25 per user a month, with 20K per user; Enterprise custom, on an annual commitment.',
    keys: 'Provider keys are stored once in the gateway, and applications use one gateway key.',
    sources: [
      { label: 'TrueFoundry AI Gateway', url: 'https://www.truefoundry.com/ai-gateway' },
      { label: 'TrueFoundry AI Gateway docs', url: 'https://www.truefoundry.com/docs/ai-gateway/intro-to-llm-gateway' },
      { label: 'TrueFoundry virtual models', url: 'https://www.truefoundry.com/docs/ai-gateway/virtual-model' },
      { label: 'TrueFoundry pricing', url: 'https://www.truefoundry.com/pricing' },
    ],
  },
  {
    key: 'bifrost',
    name: 'Bifrost by Maxim AI',
    url: 'https://www.getmaxim.ai',
    what: 'An open-source AI gateway that unifies 20+ providers behind a single OpenAI-compatible API.',
    picks: 'Weighted load balancing across API keys, routing that directs requests to specific models, providers and keys, and automatic failover between providers and models. In Bifrost Enterprise, Adaptive Routing picks the provider and the API key for each request from what it observes on live traffic.',
    hosting: 'Self-hosted with Docker, Kubernetes or a Go binary; Enterprise runs in a VPC, on-prem or air-gapped.',
    pricing: 'The open-source gateway is free forever; Enterprise has custom pricing and a 14-day free trial.',
    sources: [
      { label: 'getmaxim.ai', url: 'https://www.getmaxim.ai/' },
      { label: 'Bifrost docs', url: 'https://docs.getbifrost.ai/overview' },
      { label: 'Bifrost adaptive routing', url: 'https://docs.getbifrost.ai/enterprise/adaptive-routing/overview' },
      { label: 'Bifrost pricing', url: 'https://www.getmaxim.ai/pricing' },
    ],
  },
  {
    key: 'edenai',
    name: 'Eden AI',
    url: 'https://www.edenai.co',
    what: 'An AI gateway and LLM router: one OpenAI-compatible API to around 1,000 LLMs and expert models across 80+ providers.',
    picks: 'Name a model without a provider and Eden AI picks which provider serves it: by default the cheapest for the shape of your request, with cheaper providers receiving proportionally more traffic, or by an objective you set, such as speed or latency. Failing providers rank below healthy ones, and fallbacks are fields on the request.',
    hosting: 'Hosted, at api.edenai.run, with a dedicated EU endpoint; you pick the region your workspace lives in at sign-up.',
    pricing: 'Provider prices with no per-token markup, plus a 5.5% platform fee when you buy credits. No subscription, and credits never expire. The Advanced plan has custom pricing.',
    keys: 'Supported: with your own provider API keys, requests routed to that provider are billed directly by the provider. Bring your own keys is listed as included on every plan.',
    sources: [
      { label: 'edenai.co', url: 'https://www.edenai.co/' },
      { label: 'Eden AI provider routing', url: 'https://www.edenai.co/docs/v3/llms/provider-routing' },
      { label: 'Eden AI bring your own keys', url: 'https://www.edenai.co/docs/v3/general/byok' },
      { label: 'Eden AI pricing', url: 'https://www.edenai.co/pricing' },
    ],
  },
  {
    key: 'orcarouter',
    name: 'OrcaRouter',
    url: 'https://www.orcarouter.ai',
    what: 'An AI gateway built for privacy and cybersecurity, with 200+ models behind one OpenAI-compatible API.',
    picks: 'With orcarouter/auto, each prompt is classified by how hard it is and what it needs, then routed to the model that clears your bar. The choice is tuned on your own traffic, or follows the policy you set: cheapest that clears the bar, highest quality or balanced. A fallback chain you configure covers failures.',
    hosting: 'Hosted, at api.orcarouter.ai. OrcaRouter Lite is an MIT-licensed gateway for your own infrastructure and provider keys.',
    pricing: 'Tokens are billed at each provider’s published rate, with no markup. Hacker plan free; Team $499 a month; Enterprise custom.',
    keys: 'Bring your own key: your own provider keys, rate limits and credits.',
    sources: [
      { label: 'orcarouter.ai', url: 'https://www.orcarouter.ai/' },
      { label: 'OrcaRouter pricing', url: 'https://www.orcarouter.ai/pricing' },
    ],
  },
  {
    key: 'orq',
    name: 'Orq.ai',
    url: 'https://orq.ai/platform/ai-gateway',
    what: 'An AI gateway and router: one OpenAI-compatible API for 500+ models from 30+ providers.',
    picks: 'You switch models with a string change, or let Orq.ai’s own Smart Router feature choose: it auto-routes each request to the best model by a cost and quality strategy. Load balancing is weighted, round-robin or latency-based, with cross-provider fallback chains and routing rules that redirect by header, identity, metadata or project.',
    hosting: 'EU SaaS, fully managed; Enterprise adds VPC and on-prem deployment options.',
    pricing: 'Pay as you go and free to start: model traffic is billed at provider rates, with a 4.5% fee on credits when you use Orq.ai’s keys. Usage is metered in spans and processed data, with 100k spans and 5 GB included each month. Enterprise is custom.',
    keys: 'Bring your own keys: billing stays with your provider, with unlimited requests and no fee.',
    sources: [
      { label: 'Orq.ai AI Gateway', url: 'https://orq.ai/platform/ai-gateway' },
      { label: 'Orq.ai AI Gateway docs', url: 'https://docs.orq.ai/ai-gateway/get-started/introduction' },
      { label: 'Orq.ai pricing', url: 'https://orq.ai/pricing' },
    ],
  },
];

/** Every vendor page cited by an entry list, deduplicated, for a page's sources block. */
export function sourcesOf(entries: RouterEntry[]): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const e of entries) {
    if (e.key === 'asl') continue;
    for (const s of e.sources) {
      if (seen.has(s.url)) continue;
      seen.add(s.url);
      out.push(s);
    }
  }
  return out;
}

/** "A, B and C". */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** The four pages of the cluster and the product page, for each page's link row. */
/**
 * The Smart Router's routing guides: one page per job (by task, fallbacks, cost, own keys, coding
 * agents). Listed here so every AI router page links to them from one list; what they say is in
 * components/seo/routing/routing-data.ts.
 */
export const GUIDES: Array<{ path: string; label: string }> = [
  { path: '/llm-routing-by-task', label: 'LLM routing by task' },
  { path: '/llm-fallback-routing', label: 'LLM fallback routing' },
  { path: '/llm-cost-routing', label: 'LLM cost routing' },
  { path: '/byok-llm-router', label: 'BYOK LLM router' },
  { path: '/llm-routing-for-coding-agents', label: 'Model routing for coding agents' },
];

export const CLUSTER: Array<{ path: string; label: string }> = [
  { path: '/ai-router', label: 'What an AI router is' },
  { path: '/ai-aggregator', label: 'AI aggregator' },
  { path: '/best-ai-router', label: 'Best AI routers' },
  { path: '/openrouter-alternatives', label: 'OpenRouter alternatives' },
  { path: '/router', label: 'Smart Router' },
];
