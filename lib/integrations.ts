import type { BoardKey } from './boards-core';
import { ccSwitchProviderLink } from './cc-switch';
import { PLANS, ROUTER_CREDITS } from './entitlements';

/**
 * The registry behind /router/integrations and /router/integrations/<tool>: one entry per tool
 * with the settings a visitor pastes, the routing modes that fit, what the tool supports, the
 * troubleshooting rows and the FAQ. Pure data, no React: the pages, the sitemap registry
 * (lib/seo-routes.ts ROUTER_INTEGRATIONS lists the same slugs) and any script can read it.
 *
 * Every base URL, header, environment variable, config key and limit below is copied from
 * app/router/docs/page.tsx (the INTEGRATIONS, APP_INTEGRATIONS, CLAUDE_CODE and MCP samples, the
 * endpoint notes and the error table) or app/router/help/page.tsx (the TOOLS rows, TOOL_SETTINGS,
 * the Known limitations note and the FIXES rows). Nothing here is a guess about a tool; where the
 * docs have no setting, the text says what the docs say and no more. The opencode.json block is
 * the one sample not on /router/docs: it follows OpenCode's own custom-provider format with the
 * router's documented values (see the comment at the entry).
 *
 * Copy rules (owner): no model names or ranks in static text, provider families only; the
 * numbers come from lib/entitlements.ts; "AI Stupid Level" in full first, "ASL" after.
 */

/** The router's base URL, as /router/docs prints it (BASE_URL). */
export const ROUTER_BASE_URL = 'https://aistupidlevel.info/v1';
/** The site root: what ANTHROPIC_BASE_URL is set to in the docs' Claude Code sample (no /v1). */
export const ROUTER_SITE = 'https://aistupidlevel.info';
/** The key placeholder every docs sample uses. */
export const KEY_PLACEHOLDER = 'aism_your_key_here';
export const INTEGRATIONS_PATH = '/router/integrations';
export const DOCS_INTEGRATIONS_PATH = '/router/docs#integrations';
export const DOCS_STRATEGIES_PATH = '/router/docs#strategies';
export const DOCS_ERRORS_PATH = '/router/docs#errors';

export const integrationPath = (slug: string): string => `${INTEGRATIONS_PATH}/${slug}`;

/* ───────────────────────── categories ───────────────────────── */

export type IntegrationCategory = 'coding agent' | 'IDE' | 'framework' | 'automation' | 'chat UI';

export const CATEGORY_ORDER: IntegrationCategory[] = ['coding agent', 'IDE', 'framework', 'automation', 'chat UI'];

export const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  'coding agent': 'Coding agents',
  IDE: 'Editors',
  framework: 'Frameworks',
  automation: 'Automation',
  'chat UI': 'Chat interfaces',
};

/** One line under each group heading on the hub: which modes the group usually wants. */
export const CATEGORY_BLURB: Record<IntegrationCategory, string> = {
  'coding agent': 'Agents that edit repositories and call tools: auto-coding for the code, auto-tooling for long agent sessions, auto-value-coding to spend less per run.',
  IDE: 'Editor assistants that take a custom OpenAI base URL: auto-coding as the model name, with the tool’s own limits noted truthfully.',
  framework: 'Libraries that build agents and chains: auto-best for general work, auto-tooling for agents that call tools, auto-reasoning for analysis.',
  automation: 'Workflow tools: the Chat Model sub-node for agents and chains, and benchmark data as workflow steps.',
  'chat UI': 'Self-hosted chat front ends: every routing mode as a model in the menu, with the model that answered shown per reply.',
};

/* ───────────────────────── routing modes (text from /router/docs#strategies) ───────────────────────── */

export type ModeId =
  | 'auto' | 'auto-task' | 'auto-coding' | 'auto-reasoning' | 'auto-tooling' | 'auto-best'
  | 'auto-value' | 'auto-value-coding' | 'auto-value-reasoning' | 'auto-value-tooling'
  | 'auto-fastest-quality' | 'auto-consistent';

export interface Mode {
  id: ModeId;
  /** The strategy column of the docs table. */
  label: string;
  /** The description column of the docs table, verbatim. */
  desc: string;
  /** The leaderboard the quality modes read; value and speed modes have no single board. */
  board?: BoardKey;
}

export const MODES: Record<ModeId, Mode> = {
  'auto': { id: 'auto', label: 'Default', desc: 'Uses your saved routing strategy from Preferences' },
  'auto-task': { id: 'auto-task', label: 'Per request', desc: 'Reads each request and picks the matching benchmark: tools → tool use, design or long sessions → reasoning, code → coding, else overall; simple requests use the Best value version. The routing reason names the rule' },
  'auto-coding': { id: 'auto-coding', label: 'Coding', desc: 'Best for code generation, debugging, refactoring', board: 'coding' },
  'auto-reasoning': { id: 'auto-reasoning', label: 'Reasoning', desc: 'Best for complex analysis, math, logic', board: 'reasoning' },
  'auto-tooling': { id: 'auto-tooling', label: 'Tool use', desc: 'Best at calling tools correctly — scored on our tool-calling suite', board: 'tooling' },
  'auto-best': { id: 'auto-best', label: 'Overall', desc: 'Best combined score regardless of category; among statistically tied leaders, your tie-break decides (the cheaper by default)', board: 'combined' },
  'auto-value': { id: 'auto-value', label: 'Value', desc: 'Most combined-score points per measured dollar, among models within 5 points of the best one you can use' },
  'auto-value-coding': { id: 'auto-value-coding', label: 'Value', desc: 'Most coding points per dollar (measured cost of a coding run), near-top models only' },
  'auto-value-reasoning': { id: 'auto-value-reasoning', label: 'Value', desc: 'Most reasoning points per dollar (measured cost of a reasoning run), near-top models only' },
  'auto-value-tooling': { id: 'auto-value-tooling', label: 'Value', desc: 'Most tool-use points per dollar (measured cost of a tool-use run), near-top models only' },
  'auto-fastest-quality': { id: 'auto-fastest-quality', label: 'Speed', desc: 'Among models within 5 points of the best one you can use, the fastest (measured latency) — auto-fastest has no quality bar' },
  'auto-consistent': { id: 'auto-consistent', label: 'Consistency', desc: 'Among models within 5 points of the best one you can use, the one whose score swings least from run to run' },
};

/* ───────────────────────── shapes ───────────────────────── */

export type CodeLang = 'bash' | 'text' | 'yaml' | 'json' | 'python' | 'ts';

export interface Code {
  lang: CodeLang;
  src: string;
  /** The code card's title bar; defaults to the step heading or the tool name. */
  title?: string;
}

/** Text with `code` spans and [label](href) links; components/seo/integrations/RichText renders it. */
export type Rich = string;

export interface Step {
  heading: string;
  body: Rich;
  code?: Code;
  /** A button under the body, for deep links such as CC Switch's import. */
  link?: { href: string; label: string };
}

export interface FaqEntry { q: string; a: Rich }
export interface Trouble { problem: string; fix: Rich }

export interface Integration {
  slug: string;
  name: string;
  /** The H1's first line when it is more than the name ("Cline, Kilo Code and Roo Code"). */
  headline?: string;
  /** Tools the page also covers, for the hub and the description. */
  aliases?: string[];
  category: IntegrationCategory;
  /** Without the " | AI Stupid Level" suffix: at most 42 characters. */
  title: string;
  /** 120–155 characters. */
  description: string;
  keywords: string[];
  /** The verdict under the H1 and the hub's blurb: one or two sentences. */
  summary: Rich;
  /** The compact settings card in the hero. */
  settings: Code;
  steps: Step[];
  /** 'modes' for the OpenAI-compatible endpoint; 'passthrough' for the Anthropic Messages path, which does not route. */
  routing: 'modes' | 'passthrough';
  /** The routing modes that fit this tool, in the order to show them. Empty for a passthrough. */
  modes: ModeId[];
  /** Shown above the modes (or instead of them for a passthrough). */
  modesNote?: Rich;
  /** What the tool supports behind the router: only facts from the docs or help pages. */
  caveats: Rich[];
  /** Tool-specific rows, shown before the shared ones. */
  troubleshooting?: Trouble[];
  /** Five visible Q&As; the same strings feed the FAQPage structured data. */
  faq: FaqEntry[];
  /** Where the docs cover this tool. */
  docsAnchor: string;
}

/* ───────────────────────── shared text ───────────────────────── */

const FREE = PLANS.free;
const n = (x: number) => x.toLocaleString('en-US');
/** "$5" per 10,000 requests, from the credit price ($1 buys requestsPerUsd). */
const CREDITS_PER_10K = Math.round((10_000 / ROUTER_CREDITS.requestsPerUsd) * 100) / 100;

/** The help page's cost answer, with the numbers read from the plan table. */
export const COST_FAQ: FaqEntry = {
  q: 'Does this cost extra?',
  a: `No. You pay the providers directly for tokens, with your own keys; the router adds nothing to token prices. The Free plan includes ${n(FREE.routerRequestsPerMonth)} routed requests a month (${PLANS.pro.label} ${n(PLANS.pro.routerRequestsPerMonth)}, ${PLANS.developer.label} ${n(PLANS.developer.routerRequestsPerMonth)}, ${PLANS.teams.label} ${n(PLANS.teams.routerRequestsPerMonth)}), and prepaid credits cover any beyond that at $${CREDITS_PER_10K} per 10,000. Only successful requests count. No card for the Free plan.`,
};

/** Help centre, Quick start, step 01. */
const STEP_KEY: Step = {
  heading: 'Create a router key',
  body: 'Go to [API keys](/router/keys), click Create key and copy it somewhere safe. The key starts with `aism_` and is the one key for every tool you connect.',
};

/** Help centre, Quick start, step 02. */
const STEP_PROVIDERS: Step = {
  heading: 'Add your provider keys',
  body: 'Under [Providers](/router/providers), add keys for OpenAI, Anthropic, Google, DeepSeek, Kimi or GLM. The more providers you add, the better the routing. You pay them directly for tokens; the router adds nothing to token prices, and provider keys are encrypted at rest (AES-256-GCM) and never shown again.',
};

/** What a visitor gets from an OpenAI-compatible tool on the router (docs: Virtual models, Response headers; help: FAQ). */
export const GETS_ROUTED: [string, Rich][] = [
  ['Routing on benchmark results', 'A routing mode as the model name sends each request to the model placing highest on the relevant board — coding, reasoning or tool use — ranked on the average of its last five benchmark runs, never a single run. Statistically tied leaders are split by your tie-break preference, the cheaper measured cost per task by default. Drift-aware routing moves a model whose drift detector has fired for that skill behind every unflagged model.'],
  ['Your own provider keys', 'You pay OpenAI, Anthropic, Google, DeepSeek, Moonshot AI (Kimi) or Z.ai (GLM) directly for tokens. Provider keys are encrypted at rest (AES-256-GCM) and never shown again.'],
  ['No token markup', `The router adds nothing to token prices. Free includes ${n(FREE.routerRequestsPerMonth)} routed requests a month, and only successful requests count.`],
  ['The model that answered, every time', 'Every response carries `X-AISM-Model` and `X-AISM-Reasoning`: which model answered and why, including any fallback. If the chosen model fails before answering, the router tries your own fallback order, then up to 2 automatic fallbacks from different providers.'],
];

/** What Claude Code gets: the Anthropic Messages passthrough (docs: Anthropic Messages). */
export const GETS_PASSTHROUGH: [string, Rich][] = [
  ['A native Anthropic Messages passthrough', '`POST /v1/messages` forwards Claude Code’s requests to Anthropic with your Anthropic key, for the Claude model Claude Code names, and returns the native Anthropic response format — not an OpenAI translation.'],
  ['One key for every tool', 'The same `aism_` key serves Claude Code and every OpenAI-compatible tool you connect. Your Anthropic key is stored once under Providers, encrypted at rest (AES-256-GCM) and never shown again.'],
  ['No token markup', `The router adds nothing to token prices. Free includes ${n(FREE.routerRequestsPerMonth)} routed requests a month, and only successful requests count.`],
  ['Allowance, budgets and request logs', 'Your plan allowance, budgets and request logs apply as on the other endpoints. Token counting, `POST /v1/messages/count_tokens`, is free at Anthropic and is not counted against your plan.'],
];

/** The docs' error table and the help centre's fixes, for every tool. */
export const TROUBLE_SHARED: Trouble[] = [
  { problem: '401 invalid_api_key', fix: 'Missing or invalid `aism_` key. Check the key is correct and not revoked, and that the tool sends it as `Authorization: Bearer aism_…`. If a field insists on an `sk-` prefix, `sk-aism_…` is accepted: the prefix is stripped automatically. A key that had an expiry date and passed it gets `401 expired_api_key`, and the message says when.' },
  { problem: '400 model_not_found', fix: 'An unknown `auto-*` name is a 400 that lists the valid routing modes. For a real model id, check the spelling: direct pin routing infers the provider from the model name prefix, and `GET /v1/models` lists every id you can use.' },
  { problem: 'No models in the dropdown', fix: 'The tool fills its list from `GET /v1/models`, which requires a valid `aism_` key. Check that the key and the base URL `https://aistupidlevel.info/v1` are both in place.' },
  { problem: '400 provider_key_rejected or no_provider_keys', fix: 'Your provider key is missing or was refused. Add or update it under [Providers](/router/providers), re-check it on the provider’s dashboard, and make sure it has active credits and the right permissions.' },
  { problem: 'Streaming', fix: 'Set `stream: true`. Text arrives as the model writes it (`X-AISM-Streaming-Mode: native`); tool calls arrive in one chunk each once the model has finished them, then the finish reason, then usage if you set `stream_options.include_usage`. If the chosen model fails before sending anything, or its provider sends nothing for 120 seconds, the next fallback is tried.' },
  { problem: '400 unsupported_content', fix: 'The router routes text only, on purpose: it picks a model from benchmark results for coding, reasoning and tool use, and none of those measure image, audio or file understanding. Send such requests to the provider directly.' },
  { problem: '429 allowance_exhausted', fix: 'This month’s requests are used up and you have no prepaid credits. Credits top up the allowance; moving up a plan is the cheaper way to buy regular volume.' },
];

/** The help centre's generic tool settings (TOOL_SETTINGS). */
export const TOOL_SETTINGS: Code = {
  lang: 'text',
  title: 'Tool settings',
  src: `Base URL: ${ROUTER_BASE_URL}
API Key: ${KEY_PLACEHOLDER}
Model: auto-coding (or auto, auto-reasoning, etc.)`,
};

/** The docs' MCP sample for Claude Desktop and Cursor (APP_INTEGRATIONS "MCP (Claude, Cursor)"). */
const MCP_JSON = `{
  "mcpServers": {
    "aistupidlevel": {
      "command": "npx",
      "args": ["-y", "@aistupidlevel/mcp"],
      "env": { "ASL_DATA_KEY": "asl_live_...", "ASL_ROUTER_KEY": "aism_..." }
    }
  }
}`;

const MCP_BODY: Rich = 'Rankings, drift, incidents, route previews and router answers become tools in the editor. The benchmark tools take a Data API key (`asl_live_…`) from [Data API keys](/account/data-keys); the router answers use your `aism_` key.';

/* ───────────────────────── the tools ───────────────────────── */

export const INTEGRATIONS: Integration[] = [
  /* ── Claude Code ── */
  {
    slug: 'claude-code',
    name: 'Claude Code',
    category: 'coding agent',
    title: 'Claude Code: ANTHROPIC_BASE_URL setup',
    description: 'Point Claude Code at the Smart Router with ANTHROPIC_BASE_URL and your aism_ key: the native Anthropic Messages passthrough on your own Anthropic key.',
    keywords: ['Claude Code custom API endpoint', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'Claude Code proxy', 'Claude Code gateway', 'Claude Code environment variables', 'Claude Code API key'],
    summary: 'Two environment variables send Claude Code through the router’s native Anthropic Messages passthrough: your own Anthropic key, no token markup, and the same allowance, budgets and request logs as every other endpoint.',
    settings: {
      lang: 'bash',
      title: 'Shell',
      src: `export ANTHROPIC_BASE_URL="${ROUTER_SITE}"
export ANTHROPIC_API_KEY="${KEY_PLACEHOLDER}"
claude`,
    },
    steps: [
      STEP_KEY,
      {
        heading: 'Add your Anthropic provider key',
        body: 'The Messages passthrough requires an active Anthropic provider key: add it under [Providers](/router/providers). It is encrypted at rest (AES-256-GCM) and never shown again; the request to Anthropic is made with it.',
      },
      {
        heading: 'Set two environment variables and start Claude Code',
        body: '`ANTHROPIC_BASE_URL` is the site root without `/v1`: Claude Code calls the Messages endpoint, `POST https://aistupidlevel.info/v1/messages`, itself. The router key goes in `ANTHROPIC_API_KEY`. The endpoint accepts `aism_` keys via either `x-api-key` or `Authorization: Bearer`, so Claude Code’s `ANTHROPIC_AUTH_TOKEN`, which sends a Bearer header, works as well.',
        code: {
          lang: 'bash',
          title: 'Shell',
          src: `export ANTHROPIC_BASE_URL="${ROUTER_SITE}"
export ANTHROPIC_API_KEY="${KEY_PLACEHOLDER}"
claude`,
        },
      },
      {
        heading: 'Optional: add the MCP server for benchmark tools',
        body: MCP_BODY,
        code: {
          lang: 'bash',
          title: 'Claude Code',
          src: 'claude mcp add aistupidlevel -e ASL_DATA_KEY=asl_live_... -e ASL_ROUTER_KEY=aism_... -- npx -y @aistupidlevel/mcp',
        },
      },
    ],
    routing: 'passthrough',
    modes: [],
    modesNote: 'There is no routing on this path: the request goes to Anthropic, with your Anthropic key, for the Claude model Claude Code names, so you choose the model in Claude Code as you normally do. The `auto-*` routing modes belong to the OpenAI-compatible endpoint, `POST /v1/chat/completions`, which Claude Code does not speak. For benchmark data inside Claude Code, the MCP server adds rankings, drift, incidents, route previews and router answers as tools.',
    caveats: [
      'Native Anthropic Messages API passthrough: `POST /v1/messages` and `POST /v1/messages/count_tokens`, returning the native Anthropic response format, not OpenAI-translated.',
      'The `anthropic-version` header is forwarded as sent (default `2023-06-01`), and so is any `anthropic-beta` header.',
      '`count_tokens` is free at Anthropic, so it is not counted against your plan.',
      'The `aism_` key is accepted via either `x-api-key` or `Authorization: Bearer`.',
      'No routing on this path: the request goes to Anthropic, with your Anthropic key, for the Claude model Claude Code names. Your plan allowance, budgets and request logs apply as on the other endpoints.',
    ],
    troubleshooting: [
      { problem: 'Claude Code reports an invalid key on start', fix: 'The variable that reaches the router must hold the `aism_` key, not your Anthropic key: `ANTHROPIC_API_KEY` (sent as `x-api-key`) or `ANTHROPIC_AUTH_TOKEN` (sent as a Bearer header). Your real Anthropic key lives under [Providers](/router/providers).' },
      { problem: 'Requests reach Anthropic but fail', fix: 'A `400 provider_key_rejected` or `no_provider_keys` means the Anthropic key under Providers is missing or was refused; `429 provider_quota_exceeded` means your Anthropic account refused for credit or quota. Re-check the key and its credits on Anthropic’s dashboard.' },
    ],
    faq: [
      {
        q: 'Does Claude Code route between models through the Smart Router?',
        a: 'No. Claude Code speaks the Anthropic Messages API, and the router passes it through natively: the request goes to Anthropic, with your Anthropic key, for the Claude model Claude Code names. What you gain is one key for every tool, plus the same allowance, budgets and request logs as every other endpoint. Benchmark-driven routing lives on the OpenAI-compatible endpoint, which the other integrations use; inside Claude Code, the MCP server adds route previews and router answers as tools.',
      },
      {
        q: 'Why is ANTHROPIC_BASE_URL set without /v1?',
        a: 'Because Claude Code appends the Messages path itself. The passthrough endpoint is `POST https://aistupidlevel.info/v1/messages`, so the base URL is `https://aistupidlevel.info`. A base URL ending in `/v1` would double the segment.',
      },
      COST_FAQ,
      {
        q: 'Which key goes where?',
        a: '`ANTHROPIC_API_KEY` (or `ANTHROPIC_AUTH_TOKEN`) holds your router key, `aism_…`; the endpoint accepts it via `x-api-key` or `Authorization: Bearer`. Your real Anthropic key is stored once under [Providers](/router/providers), encrypted at rest (AES-256-GCM) and never shown again.',
      },
      {
        q: 'Is token counting counted against my plan?',
        a: 'No. `POST /v1/messages/count_tokens` is passed through and is free at Anthropic, so it is not counted. Chat requests count as usual, and only successful requests count.',
      },
    ],
    docsAnchor: '/router/docs#anthropic',
  },

  /* ── Cursor ── */
  {
    slug: 'cursor',
    name: 'Cursor',
    category: 'IDE',
    title: 'Cursor custom OpenAI endpoint setup',
    description: 'Set Cursor’s Override OpenAI Base URL to https://aistupidlevel.info/v1 with your aism_ key and auto-coding as the model name, for chat and plan mode.',
    keywords: ['Cursor custom OpenAI endpoint', 'Cursor override OpenAI base URL', 'Cursor OpenAI compatible API', 'Cursor AI router', 'Cursor custom model', 'Cursor MCP server'],
    summary: 'Cursor’s Override OpenAI Base URL points chat and plan mode at the router: your own provider keys, no token markup, and `auto-coding` as the model name. The MCP server adds rankings and route previews to the editor.',
    settings: {
      lang: 'text',
      title: 'Cursor settings',
      src: `Settings → Override OpenAI Base URL
Base URL:  ${ROUTER_BASE_URL}
API Key:   ${KEY_PLACEHOLDER}
Model:     auto-coding   (or auto, auto-reasoning, etc.)`,
    },
    steps: [
      STEP_KEY,
      STEP_PROVIDERS,
      {
        heading: 'Override the OpenAI base URL',
        body: 'In Cursor’s settings, turn on Override OpenAI Base URL, enter `https://aistupidlevel.info/v1` and paste your `aism_` key as the OpenAI key. If the field insists on an `sk-` prefix, enter `sk-aism_…`: the prefix is stripped automatically.',
        code: {
          lang: 'text',
          title: 'Cursor settings',
          src: `Settings → Override OpenAI Base URL
Base URL:  ${ROUTER_BASE_URL}
API Key:   ${KEY_PLACEHOLDER}`,
        },
      },
      {
        heading: 'Use a routing mode as the model name',
        body: 'Enter `auto-coding` as the model name (or `auto`, `auto-reasoning`, and so on). The router picks the model from the benchmark results on every request and names it in the `X-AISM-Model` response header; any real model id from `GET /v1/models` pins that model instead.',
      },
      {
        heading: 'Optional: add the MCP server to Cursor',
        body: MCP_BODY,
        code: { lang: 'json', title: '~/.cursor/mcp.json', src: MCP_JSON },
      },
    ],
    routing: 'modes',
    modes: ['auto-coding', 'auto-value-coding', 'auto-reasoning', 'auto-best'],
    caveats: [
      'Only chat/plan mode uses your base URL — Composer, inline edit, and autocomplete are locked to Cursor’s backend.',
      'The router is an OpenAI Chat Completions endpoint; it has no Responses API. Cursor features that talk to Cursor’s own backend are not affected by the override.',
      'Some tools enforce an `sk-` prefix for API keys. The router accepts `sk-aism_…`; the prefix is stripped automatically.',
      'The MCP server runs in Cursor from `~/.cursor/mcp.json`: rankings, drift, incidents, route previews and router answers as tools.',
      'Text only: a request with images, audio or files gets a `400 unsupported_content` rather than a routing decision the benchmarks cannot back.',
    ],
    faq: [
      {
        q: 'Which Cursor features use the custom OpenAI endpoint?',
        a: 'Only chat/plan mode uses your base URL. Composer, inline edit and autocomplete are locked to Cursor’s backend, so they keep using Cursor’s own models whatever the override says. For agent-style work on routed models, the coding agents on this site — [Cline, Kilo Code and Roo Code](/router/integrations/cline), [OpenCode](/router/integrations/opencode), [Aider](/router/integrations/aider) — take the base URL for everything they do.',
      },
      {
        q: 'What model name do I enter in Cursor?',
        a: 'A routing mode. `auto-coding` is best for code generation, debugging and refactoring; `auto-value-coding` picks the most coding points per dollar among near-top models; `auto-reasoning` is best for complex analysis. Any real model id listed by `GET /v1/models` pins that model and bypasses routing.',
      },
      COST_FAQ,
      {
        q: 'Cursor says the key is invalid. What now?',
        a: 'Check that the `aism_` key is correct and not revoked, and that the base URL is exactly `https://aistupidlevel.info/v1`. If the key field wants an `sk-` prefix, enter `sk-aism_…`; the router strips the prefix automatically.',
      },
      {
        q: 'Can Cursor see the leaderboard?',
        a: 'Yes, through the MCP server `@aistupidlevel/mcp`, listed in the official MCP Registry. Add it to `~/.cursor/mcp.json` and rankings, drift, incidents, route previews and router answers become tools in the editor. The benchmark tools take a Data API key (`asl_live_…`) from [Data API keys](/account/data-keys).',
      },
    ],
    docsAnchor: DOCS_INTEGRATIONS_PATH,
  },

  /* ── Cline, Kilo Code, Roo Code ── */
  {
    slug: 'cline',
    name: 'Cline',
    headline: 'Cline, Kilo Code and Roo Code',
    aliases: ['Kilo Code', 'Roo Code'],
    category: 'coding agent',
    title: 'Cline OpenAI-compatible provider setup',
    description: 'Cline, Kilo Code and Roo Code on the Smart Router: the OpenAI Compatible provider, base URL https://aistupidlevel.info/v1, your aism_ key and auto-coding.',
    keywords: ['Cline OpenAI compatible provider', 'Cline custom base URL', 'Kilo Code OpenAI compatible', 'Roo Code OpenAI compatible', 'Cline API provider', 'Cline LLM router', 'Roo Code custom endpoint'],
    summary: 'Pick the OpenAI Compatible provider in Cline, Kilo Code or Roo Code, paste the base URL and your `aism_` key, and use a routing mode as the model ID: your own provider keys, no token markup, and the model that answered in every response.',
    settings: {
      lang: 'text',
      title: 'Cline / Kilo Code / Roo',
      src: `API Provider:  OpenAI Compatible
Base URL:      ${ROUTER_BASE_URL}
API Key:       ${KEY_PLACEHOLDER}
Model ID:      auto-coding   (or auto-tooling for long agent sessions)`,
    },
    steps: [
      STEP_KEY,
      STEP_PROVIDERS,
      {
        heading: 'Choose the OpenAI Compatible provider',
        body: 'Cline and Roo Code: Settings → “OpenAI Compatible” → paste the base URL and the key. Kilo Code: Settings → API Provider “OpenAI Compatible” → paste the base URL and the key.',
        code: {
          lang: 'text',
          title: 'Cline / Kilo Code / Roo',
          src: `API Provider:  OpenAI Compatible
Base URL:      ${ROUTER_BASE_URL}
API Key:       ${KEY_PLACEHOLDER}
Model ID:      auto-coding   (or auto-tooling for long agent sessions)`,
        },
      },
      {
        heading: 'Set the model ID',
        body: '`auto-coding` for code generation, debugging and refactoring, or `auto-tooling` for long agent sessions: the model best at calling tools correctly, scored on the tool-calling suite. The response header `X-AISM-Model` names the model that answered.',
      },
      {
        heading: 'Alternative: the Anthropic provider',
        body: 'Cline’s and Roo Code’s Anthropic provider can reach the router too, through the native Anthropic Messages passthrough at `POST https://aistupidlevel.info/v1/messages` (the base URL is the site root, as for [Claude Code](/router/integrations/claude-code)). There is no routing on that path: the request goes to Anthropic, with your Anthropic key, for the Claude model named.',
      },
    ],
    routing: 'modes',
    modes: ['auto-coding', 'auto-tooling', 'auto-value-coding'],
    caveats: [
      'Tool calling works end to end: the router remembers each model’s own turn for 24 hours, so multi-step agent loops keep working, and a conversation stays on the model that started it.',
      'Prompt caching is on: agent loops resend the whole conversation every turn, and every provider can serve the part it has seen from its prompt cache at a fraction of the input price. Cached tokens are reported in `usage.prompt_tokens_details.cached_tokens`.',
      'Model dropdowns are filled from `GET /v1/models`, which needs a valid `aism_` key.',
      'Text only: a request with images, audio or files gets a `400 unsupported_content`.',
      'Windsurf: Cascade is locked to Codeium’s backend. Install Roo Code or Cline inside Windsurf instead.',
    ],
    faq: [
      {
        q: 'Does this work with Kilo Code and Roo Code?',
        a: 'Yes, with the same three values. Cline and Roo Code: Settings → “OpenAI Compatible” → paste the base URL and the key. Kilo Code: Settings → API Provider “OpenAI Compatible” → paste the base URL and the key. The model ID is a routing mode such as `auto-coding`.',
      },
      {
        q: 'auto-coding or auto-tooling?',
        a: '`auto-coding` is best for code generation, debugging and refactoring. `auto-tooling` is best at calling tools correctly, scored on the tool-calling suite, and the docs suggest it for long agent sessions. `auto-value-coding` picks the most coding points per dollar among near-top models, using the measured cost of a coding run rather than list prices.',
      },
      COST_FAQ,
      {
        q: 'Can I use Cline inside Windsurf with the router?',
        a: 'Yes. Windsurf’s own Cascade is locked to Codeium’s backend, so install Roo Code or Cline inside Windsurf and point that extension at `https://aistupidlevel.info/v1` with your `aism_` key.',
      },
      {
        q: 'Why is the model list empty?',
        a: 'The list comes from `GET /v1/models`, which requires a valid `aism_` key. Check the key and the base URL. You can also type the model ID by hand: a routing mode such as `auto-coding`, or any real model id.',
      },
    ],
    docsAnchor: DOCS_INTEGRATIONS_PATH,
  },

  /* ── Continue ── */
  {
    slug: 'continue',
    name: 'Continue',
    category: 'IDE',
    title: 'Continue.dev OpenAI-compatible setup',
    description: 'Add the Smart Router to Continue’s config.yaml: provider openai, apiBase https://aistupidlevel.info/v1, your aism_ key, model auto-coding.',
    keywords: ['Continue.dev custom API provider', 'Continue config.yaml openai apiBase', 'Continue.dev AI router', 'Continue OpenAI compatible model', 'Continue.dev LLM router'],
    summary: 'One block in `~/.continue/config.yaml` gives Continue’s chat, edit and apply roles a benchmark-routed model: your own provider keys, no token markup, and the model that answered in every response header.',
    settings: {
      lang: 'yaml',
      title: '~/.continue/config.yaml',
      src: `models:
  - name: ASL auto-coding
    provider: openai
    model: auto-coding
    apiBase: ${ROUTER_BASE_URL}
    apiKey: ${KEY_PLACEHOLDER}
    roles: [chat, edit, apply]`,
    },
    steps: [
      STEP_KEY,
      STEP_PROVIDERS,
      {
        heading: 'Add the model block to config.yaml',
        body: 'Edit `~/.continue/config.yaml`: `provider: openai`, `apiBase` set to the router and `apiKey` set to your `aism_` key. The `roles` line gives the same entry to chat, edit and apply.',
        code: {
          lang: 'yaml',
          title: '~/.continue/config.yaml',
          src: `models:
  - name: ASL auto-coding
    provider: openai
    model: auto-coding
    apiBase: ${ROUTER_BASE_URL}
    apiKey: ${KEY_PLACEHOLDER}
    roles: [chat, edit, apply]`,
        },
      },
      {
        heading: 'Add more modes as more entries',
        body: 'Each routing mode is one more entry with its own `name` and `model`: `auto-tooling` for agent work, `auto-value-coding` to spend less per coding run. Continue lists them by name, and the `X-AISM-Model` response header names the model that answered.',
      },
      {
        heading: 'Optional: embeddings for RAG',
        body: '`POST /v1/embeddings` proxies to OpenAI’s embedding models, `text-embedding-3-small` (also `auto-embedding`) and `text-embedding-3-large`, which Continue uses for its RAG features. It requires an active OpenAI provider key, and each call counts as one request against your plan.',
      },
    ],
    routing: 'modes',
    modes: ['auto-coding', 'auto-value-coding', 'auto-tooling'],
    caveats: [
      'Model dropdowns are filled from `GET /v1/models`, which needs a valid `aism_` key.',
      'Embeddings for RAG go through `POST /v1/embeddings`, which requires an active OpenAI provider key; supported models are `text-embedding-3-small` (also `auto-embedding`) and `text-embedding-3-large`.',
      'Streaming is real: text arrives as the model writes it (`X-AISM-Streaming-Mode: native`).',
      'Text only: a request with images, audio or files gets a `400 unsupported_content`.',
    ],
    faq: [
      {
        q: 'Where does the configuration go?',
        a: 'In `~/.continue/config.yaml`, under `models`: `provider: openai`, `model: auto-coding`, `apiBase: https://aistupidlevel.info/v1`, `apiKey: aism_…` and `roles: [chat, edit, apply]`. The sample above is the one from the [router documentation](/router/docs#integrations).',
      },
      {
        q: 'Can Continue use the router for embeddings?',
        a: 'Yes. `POST /v1/embeddings` proxies to OpenAI’s `text-embedding-3-small` (also `auto-embedding`) and `text-embedding-3-large`. It requires an active OpenAI provider key under [Providers](/router/providers); each call counts as one request against your plan, and per-key budgets apply.',
      },
      COST_FAQ,
      {
        q: 'Which routing mode for edit and apply?',
        a: 'The sample gives chat, edit and apply the same `auto-coding` entry, best for code generation, debugging and refactoring. To spend less per coding run, add an `auto-value-coding` entry: the most coding points per dollar among near-top models, on the measured cost of a coding run rather than list prices.',
      },
      {
        q: 'How do I see which model answered?',
        a: 'Every response carries `X-AISM-Model` (the model that answered) and `X-AISM-Reasoning` (why it was chosen, including any fallback). The per-request log on the Monitoring page shows the same for every key.',
      },
    ],
    docsAnchor: DOCS_INTEGRATIONS_PATH,
  },

  /* ── Aider ── */
  {
    slug: 'aider',
    name: 'Aider',
    category: 'coding agent',
    title: 'Aider OPENAI_API_BASE: custom API setup',
    description: 'Run Aider on the Smart Router: OPENAI_API_BASE=https://aistupidlevel.info/v1, OPENAI_API_KEY set to your aism_ key, and --model openai/auto-coding.',
    keywords: ['Aider OPENAI_API_BASE', 'Aider custom OpenAI API', 'Aider OpenAI compatible API', 'Aider AI router', 'Aider model metadata json', 'Aider LLM router'],
    summary: 'Two environment variables and a model flag put Aider on benchmark-routed models: `OPENAI_API_BASE`, `OPENAI_API_KEY` and `--model openai/auto-coding`, with your own provider keys and no token markup.',
    settings: {
      lang: 'bash',
      title: 'Shell',
      src: `export OPENAI_API_BASE=${ROUTER_BASE_URL}
export OPENAI_API_KEY=${KEY_PLACEHOLDER}
aider --model openai/auto-coding`,
    },
    steps: [
      STEP_KEY,
      STEP_PROVIDERS,
      {
        heading: 'Export the two variables and start Aider',
        body: 'Aider works with any OpenAI-compatible API. `OPENAI_API_BASE` is the router, `OPENAI_API_KEY` is your `aism_` key, and the model is a routing mode with the `openai/` prefix, which tells Aider to use the OpenAI chat format.',
        code: {
          lang: 'bash',
          title: 'Shell',
          src: `# Aider works with any OpenAI-compatible API
export OPENAI_API_BASE=${ROUTER_BASE_URL}
export OPENAI_API_KEY=${KEY_PLACEHOLDER}
aider --model openai/auto-coding`,
        },
      },
      {
        heading: 'Optional: tell Aider the router’s limits',
        body: 'A `.aider.model.metadata.json` next to your project gives Aider the routing mode’s context and output limits, so its own accounting matches the router.',
        code: {
          lang: 'json',
          title: '.aider.model.metadata.json',
          src: `{
  "openai/auto-coding": {
    "max_input_tokens": 262144,
    "max_output_tokens": 64000,
    "litellm_provider": "openai",
    "mode": "chat"
  }
}`,
        },
      },
    ],
    routing: 'modes',
    modes: ['auto-coding', 'auto-value-coding', 'auto-best'],
    caveats: [
      'The model takes the `openai/` prefix: `aider --model openai/auto-coding`. Any routing mode or real model id works after the prefix.',
      'Limits for the metadata file: 262,144 input tokens and 64,000 output tokens per request on the routing modes.',
      'Streaming is real: text arrives as the model writes it (`X-AISM-Streaming-Mode: native`).',
      'Text only: a request with images, audio or files gets a `400 unsupported_content`.',
    ],
    faq: [
      {
        q: 'Why openai/ in front of the model?',
        a: 'Aider works with any OpenAI-compatible API; the `openai/` prefix tells it which API format to speak, and everything after it is sent to the router as the model. `openai/auto-coding` routes; `openai/` followed by a real model id pins that model.',
      },
      {
        q: 'Do I need .aider.model.metadata.json?',
        a: 'It is optional. The file tells Aider the routing mode’s limits, 262,144 input tokens and 64,000 output tokens, with `litellm_provider` set to `openai` and `mode` to `chat`, so Aider’s own token accounting matches what the router accepts.',
      },
      COST_FAQ,
      {
        q: 'Which mode gives the cheapest good answers?',
        a: '`auto-value-coding`: the most coding points per dollar among models within 5 points of the best one you can use, on the measured cost of a coding run rather than list price. `auto-coding` is the quality pick for code generation, debugging and refactoring.',
      },
      {
        q: 'Can I pin one model?',
        a: 'Yes. Send any real model id after the prefix, for example `openai/` plus an id from `GET /v1/models`; the router forwards directly to that provider, and your plan allowance and key budgets still apply.',
      },
    ],
    docsAnchor: DOCS_INTEGRATIONS_PATH,
  },

  /* ── OpenCode ── */
  {
    slug: 'opencode',
    name: 'OpenCode',
    category: 'coding agent',
    title: 'OpenCode custom provider setup',
    description: 'OpenCode on the Smart Router: one click with CC Switch, or a custom provider on https://aistupidlevel.info/v1 with your aism_ key and auto-coding.',
    keywords: ['OpenCode custom provider', 'OpenCode opencode.json provider', 'OpenCode OpenAI compatible', 'OpenCode CC Switch', 'OpenCode LLM router', 'OpenCode base URL'],
    summary: 'OpenCode takes the router as a custom OpenAI-compatible provider: one click through CC Switch, or a provider block in `opencode.json`, with your own provider keys, no token markup and `auto-coding` as the default model.',
    settings: {
      lang: 'text',
      title: 'OpenCode provider',
      src: `Provider:  OpenAI-compatible
Base URL:  ${ROUTER_BASE_URL}
API key:   ${KEY_PLACEHOLDER}
Model:     auto-coding   (or auto-tooling for agent sessions)`,
    },
    steps: [
      STEP_KEY,
      STEP_PROVIDERS,
      {
        heading: 'One click with CC Switch',
        body: 'If you use [CC Switch](https://ccswitch.io), one click adds AI Stupid Level to OpenCode with `auto-coding` as the model, and CC Switch asks for your router key. A key you create on the [Keys](/router/keys) page comes with the same button, with the key already filled in.',
        link: { href: ccSwitchProviderLink('opencode'), label: 'Add to OpenCode with CC Switch' },
      },
      {
        // Not on /router/docs: OpenCode's custom-provider format (opencode.json, @ai-sdk/openai-compatible,
        // options.baseURL / options.apiKey, {env:…} substitution) with the router's documented values.
        heading: 'Or add the provider in opencode.json',
        body: 'OpenCode’s custom providers use the `@ai-sdk/openai-compatible` package with a base URL and a key; the models you list under the provider appear in its model picker. The key can come from the environment as `{env:ASL_ROUTER_KEY}`, the variable the SDKs read too.',
        code: {
          lang: 'json',
          title: 'opencode.json',
          src: `{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "aistupidlevel": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "AI Stupid Level",
      "options": {
        "baseURL": "${ROUTER_BASE_URL}",
        "apiKey": "{env:ASL_ROUTER_KEY}"
      },
      "models": {
        "auto-coding": { "name": "ASL auto-coding" },
        "auto-tooling": { "name": "ASL auto-tooling" }
      }
    }
  }
}`,
        },
      },
      {
        heading: 'Pick the model',
        body: 'Choose `aistupidlevel/auto-coding` for code, or `aistupidlevel/auto-tooling` for sessions that call many tools. The `X-AISM-Model` response header names the model that answered on every request.',
      },
    ],
    routing: 'modes',
    modes: ['auto-coding', 'auto-tooling', 'auto-value-coding'],
    caveats: [
      'Tool calling works end to end: the router remembers each model’s own turn for 24 hours, so multi-step agent loops keep working, and a conversation stays on the model that started it.',
      'Prompt caching is on: the part of a conversation a provider has already seen is served from its prompt cache at a fraction of the input price.',
      'CC Switch imports the provider with the OpenAI chat format, `https://aistupidlevel.info/v1` as the endpoint and `auto-coding` as the model.',
      'Text only: a request with images, audio or files gets a `400 unsupported_content`.',
    ],
    faq: [
      {
        q: 'What does the CC Switch button do?',
        a: 'It opens CC Switch’s import link, which adds AI Stupid Level to OpenCode as a provider with the endpoint `https://aistupidlevel.info/v1`, the OpenAI chat format and `auto-coding` as the model, then asks for your router key. A key created on the [Keys](/router/keys) page comes with the same button, with the key already filled in.',
      },
      {
        q: 'Which model id goes in opencode.json?',
        a: 'A routing mode under the provider’s `models`: `auto-coding` for code, `auto-tooling` for agent sessions that call tools, `auto-value-coding` to spend less per coding run. Any real model id from `GET /v1/models` pins that model instead.',
      },
      COST_FAQ,
      {
        q: 'Does tool calling work in OpenCode sessions?',
        a: 'Yes. Send OpenAI-format tools and return results as `tool` messages, exactly as with OpenAI. The router keeps each model’s own turn for 24 hours, so multi-step loops work, and a loop stays on the model that started it.',
      },
      {
        q: 'How do I check which model answered?',
        a: 'Every response carries `X-AISM-Model` and `X-AISM-Reasoning`. To see the decision before sending anything, `POST /v1/route/preview` takes the same body as a chat request and returns the model, fallbacks and reasons it would get, without calling a provider or counting a request.',
      },
    ],
    docsAnchor: DOCS_INTEGRATIONS_PATH,
  },

  /* ── n8n ── */
  {
    slug: 'n8n',
    name: 'n8n',
    category: 'automation',
    title: 'n8n community node for the Smart Router',
    description: 'Install n8n-nodes-aistupidlevel from Settings → Community Nodes: a node for chat, routing and benchmark data, plus a Chat Model for the AI Agent.',
    keywords: ['n8n AI Stupid Level node', 'n8n-nodes-aistupidlevel', 'n8n LLM router', 'n8n AI Agent chat model', 'n8n community node AI', 'n8n OpenAI compatible model'],
    summary: 'The `n8n-nodes-aistupidlevel` community node adds an AI Stupid Level node for chat, routing and benchmark data, and an AI Stupid Level Chat Model that plugs into the AI Agent, so every call, tool turns included, goes through the router.',
    settings: {
      lang: 'text',
      title: 'n8n',
      src: `Install (self-hosted n8n):
  Settings → Community Nodes → Install → n8n-nodes-aistupidlevel

Credentials:
  AI Stupid Level Router API   router key (aism_…)      chat and routing
  AI Stupid Level Data API     Data API key (asl_live_…) rankings, drift, incidents`,
    },
    steps: [
      STEP_KEY,
      STEP_PROVIDERS,
      {
        heading: 'Install the community node',
        body: 'On a self-hosted n8n: Settings → Community Nodes → Install → `n8n-nodes-aistupidlevel`.',
        code: {
          lang: 'text',
          title: 'n8n',
          src: `Install (self-hosted n8n):
  Settings → Community Nodes → Install → n8n-nodes-aistupidlevel`,
        },
      },
      {
        heading: 'Add the credentials',
        body: 'Two credentials: AI Stupid Level Router API takes your router key (`aism_…`) for chat and routing; AI Stupid Level Data API takes a Data API key (`asl_live_…`) from [Data API keys](/account/data-keys) for rankings, drift and incidents.',
        code: {
          lang: 'text',
          title: 'Credentials',
          src: `AI Stupid Level Router API   router key (aism_…)      chat and routing
AI Stupid Level Data API     Data API key (asl_live_…) rankings, drift, incidents`,
        },
      },
      {
        heading: 'Use the nodes',
        body: 'The AI Stupid Level node has Chat, Router (preview, usage) and Benchmark data operations. The AI Stupid Level Chat Model plugs into an AI Agent or LLM chain; every call, tool turns included, goes through the router.',
        code: {
          lang: 'text',
          title: 'Nodes',
          src: `AI Stupid Level              Chat · Router (preview, usage) · Benchmark data
AI Stupid Level Chat Model   plug into an AI Agent or LLM chain; every call,
                             tool turns included, goes through the router`,
        },
      },
    ],
    routing: 'modes',
    modes: ['auto-tooling', 'auto-best', 'auto-value'],
    caveats: [
      'Community nodes install on a self-hosted n8n, from Settings → Community Nodes.',
      'The Chat Model sub-node sends every call through the router, tool turns included, so an AI Agent’s whole loop is routed and logged.',
      'The Benchmark data operations take a Data API key (`asl_live_…`); chat and routing take the router key (`aism_…`).',
      'Text only: a request with images, audio or files gets a `400 unsupported_content`.',
    ],
    faq: [
      {
        q: 'Does the AI Agent’s tool calling go through the router?',
        a: 'Yes. The AI Stupid Level Chat Model plugs into an AI Agent or LLM chain, and every call, tool turns included, goes through the router. `auto-tooling` picks the model best at calling tools correctly, scored on the tool-calling suite.',
      },
      {
        q: 'Which credential do I need?',
        a: 'For chat and routing, the AI Stupid Level Router API credential with your `aism_` key. For rankings, drift and incidents, the AI Stupid Level Data API credential with a Data API key (`asl_live_…`) from [Data API keys](/account/data-keys). A Free account has both.',
      },
      COST_FAQ,
      {
        q: 'Can a workflow read the leaderboard?',
        a: 'Yes. The AI Stupid Level node’s Benchmark data operations return rankings, drift and incidents through the Data API, so a workflow can react to a change on the boards, and its Router operations preview a routing decision or read your usage without sending a chat request.',
      },
      {
        q: 'Which routing mode for an AI Agent?',
        a: '`auto-tooling` for agents that call tools, `auto-best` for general chains (the best combined score, with your tie-break among statistically tied leaders), and `auto-value` for the most combined-score points per measured dollar among near-top models.',
      },
    ],
    docsAnchor: DOCS_INTEGRATIONS_PATH,
  },

  /* ── LangChain ── */
  {
    slug: 'langchain',
    name: 'LangChain',
    category: 'framework',
    title: 'LangChain ChatAISL chat model setup',
    description: 'pip install langchain-aistupidlevel, then ChatAISL(model="auto-coding"): tools, structured output, streaming, and the model that answered.',
    keywords: ['LangChain ChatAISL', 'langchain-aistupidlevel', 'LangChain LLM router', 'LangChain OpenAI compatible chat model', 'LangChain model routing', 'LangChain benchmark routing'],
    summary: '`langchain-aistupidlevel` adds `ChatAISL`, a LangChain chat model on the Smart Router: tools, structured output and streaming, your own provider keys, no token markup, and the model that answered and why in `response_metadata`.',
    settings: {
      lang: 'python',
      title: 'Python',
      src: `# pip install langchain-aistupidlevel
from langchain_aistupidlevel import ChatAISL

llm = ChatAISL(model="auto-coding", api_key="${KEY_PLACEHOLDER}")
msg = llm.invoke("Write a Python function")
print(msg.content)
print(msg.response_metadata["routed_model"])    # the model that answered
print(msg.response_metadata["routing_reason"])  # why it was chosen`,
    },
    steps: [
      STEP_KEY,
      STEP_PROVIDERS,
      {
        heading: 'Install the package',
        body: 'The chat model is published on PyPI as `langchain-aistupidlevel` and listed in the LangChain documentation’s chat-model table.',
        code: { lang: 'bash', title: 'Shell', src: 'pip install langchain-aistupidlevel' },
      },
      {
        heading: 'Create the chat model with a routing mode',
        body: '`ChatAISL` takes a routing mode as `model` and your `aism_` key. The answer’s `response_metadata` carries `routed_model`, the model that answered, and `routing_reason`, why it was chosen.',
        code: {
          lang: 'python',
          title: 'Python',
          src: `from langchain_aistupidlevel import ChatAISL

llm = ChatAISL(model="auto-coding", api_key="${KEY_PLACEHOLDER}")
msg = llm.invoke("Write a Python function")
print(msg.content)
print(msg.response_metadata["routed_model"])    # the model that answered
print(msg.response_metadata["routing_reason"])  # why it was chosen`,
        },
      },
      {
        heading: 'Agents, tools and structured output',
        body: '`ChatAISL` supports tools, structured output and streaming. For an agent that calls tools, use `auto-tooling`; for analysis, `auto-reasoning`; for general chains, `auto-best`.',
      },
    ],
    routing: 'modes',
    modes: ['auto-best', 'auto-tooling', 'auto-reasoning', 'auto-value'],
    caveats: [
      '`ChatAISL` supports tools, structured output and streaming, plus the model that answered and why in `response_metadata`.',
      'JSON output: `response_format` `json_object` and `json_schema` are supported for every provider; the schema is enforced natively by OpenAI, Gemini and the Claude models that support structured output, and sent as an instruction in JSON mode to DeepSeek, Kimi and GLM.',
      'Tool calling works end to end, with each model’s own turn remembered for 24 hours so multi-step agent loops keep working.',
      'Text only: a request with images, audio or files gets a `400 unsupported_content`.',
    ],
    faq: [
      {
        q: 'How do I know which model answered?',
        a: 'Read `msg.response_metadata["routed_model"]` for the model and `msg.response_metadata["routing_reason"]` for why it was chosen, including any fallback. The same facts are in the `X-AISM-Model` and `X-AISM-Reasoning` response headers for any OpenAI client.',
      },
      {
        q: 'Does ChatAISL support tool calling and structured output?',
        a: 'Yes: tools, structured output and streaming. JSON output through `response_format` is supported for every provider; OpenAI, Gemini and the Claude models that support structured output enforce the schema natively, and DeepSeek, Kimi and GLM receive it as an instruction in JSON mode.',
      },
      COST_FAQ,
      {
        q: 'Which routing mode for an agent?',
        a: '`auto-tooling`: the model best at calling tools correctly, scored on the tool-calling suite. `auto-best` picks the best combined score for general chains; `auto-reasoning` is best for complex analysis, math and logic.',
      },
      {
        q: 'Can I use the plain OpenAI client instead?',
        a: 'Yes. Any OpenAI client works with `base_url="https://aistupidlevel.info/v1"` and your `aism_` key; read the `x-aism-model` header from a raw response to see which model answered. The SDKs and `ChatAISL` add what an OpenAI client cannot see, such as the routing reason on every answer.',
      },
    ],
    docsAnchor: DOCS_INTEGRATIONS_PATH,
  },

  /* ── Zed ── */
  {
    slug: 'zed',
    name: 'Zed',
    category: 'IDE',
    title: 'Zed OpenAI-compatible provider setup',
    description: 'Add the Smart Router to Zed as an OpenAI-compatible provider: API URL https://aistupidlevel.info/v1, your aism_ key and auto-coding as the model.',
    keywords: ['Zed OpenAI compatible provider', 'Zed custom LLM provider', 'Zed editor AI router', 'Zed settings.json language_models openai_compatible', 'Zed LLM router'],
    summary: 'Zed’s OpenAI-compatible provider takes the router’s API URL, your `aism_` key and a routing mode as the model; the key is kept in the system keychain, and the models can also go in `settings.json`.',
    settings: {
      lang: 'text',
      title: 'Zed',
      src: `Settings → AI → LLM Providers → Add Provider (OpenAI compatible)
API URL:  ${ROUTER_BASE_URL}
API key:  ${KEY_PLACEHOLDER}
Model:    auto-coding`,
    },
    steps: [
      STEP_KEY,
      STEP_PROVIDERS,
      {
        heading: 'Add the provider in Zed’s settings',
        body: 'Settings → AI → LLM Providers → Add Provider (OpenAI compatible): the API URL `https://aistupidlevel.info/v1`, your router key and `auto-coding` as the model. The key is kept in the system keychain.',
        code: {
          lang: 'text',
          title: 'Zed',
          src: `Settings → AI → LLM Providers → Add Provider (OpenAI compatible)
API URL:  ${ROUTER_BASE_URL}
API key:  ${KEY_PLACEHOLDER}
Model:    auto-coding`,
        },
      },
      {
        heading: 'Or declare the models in settings.json',
        body: 'The same provider can be written into Zed’s `settings.json`, with one entry per routing mode; the sample lists `auto-coding` and `auto-tooling`.',
        code: {
          lang: 'json',
          title: 'settings.json',
          src: `{
  "language_models": {
    "openai_compatible": {
      "AI Stupid Level": {
        "api_url": "${ROUTER_BASE_URL}",
        "available_models": [
          { "name": "auto-coding", "display_name": "ASL auto-coding", "max_tokens": 262144 },
          { "name": "auto-tooling", "display_name": "ASL auto-tooling", "max_tokens": 262144 }
        ]
      }
    }
  }
}`,
        },
      },
    ],
    routing: 'modes',
    modes: ['auto-coding', 'auto-tooling', 'auto-value-coding'],
    caveats: [
      'The router key is kept in the system keychain; the model list can live in `settings.json`.',
      'The sample sets `max_tokens` to 262144, the routing modes’ context limit.',
      'Streaming is real: text arrives as the model writes it (`X-AISM-Streaming-Mode: native`).',
      'Text only: a request with images, audio or files gets a `400 unsupported_content`.',
    ],
    faq: [
      {
        q: 'Where is my router key stored?',
        a: 'In the system keychain, when the provider is added through Settings → AI → LLM Providers. The `settings.json` block holds only the API URL and the model list, so it can be shared without the key.',
      },
      {
        q: 'What is max_tokens in the sample?',
        a: 'The context size Zed may use for that model: 262144 tokens, the routing modes’ context limit (the same figure the Aider metadata sample uses as `max_input_tokens`). Output is capped at 64,000 tokens per request.',
      },
      COST_FAQ,
      {
        q: 'Which mode for agent work in Zed?',
        a: '`auto-tooling`, the second model in the sample: the model best at calling tools correctly, scored on the tool-calling suite. `auto-coding` is best for code generation, debugging and refactoring; `auto-value-coding` picks the most coding points per dollar among near-top models.',
      },
      {
        q: 'Can I add more models?',
        a: 'Yes. Add any routing mode or any real model id from `GET /v1/models` to `available_models`, each with a display name. A real id pins that model and bypasses routing; your plan allowance and key budgets still apply.',
      },
    ],
    docsAnchor: DOCS_INTEGRATIONS_PATH,
  },

  /* ── Open WebUI ── */
  {
    slug: 'open-webui',
    name: 'Open WebUI',
    category: 'chat UI',
    title: 'Open WebUI Function: Smart Router setup',
    description: 'Install the AI Stupid Level Function in Open WebUI, set API_KEY in its Valves and make the models Public: every routing mode as a model in the menu.',
    keywords: ['Open WebUI custom OpenAI connection', 'Open WebUI function AI Stupid Level', 'Open WebUI LLM router', 'Open WebUI OpenAI compatible API', 'Open WebUI add connection base URL'],
    summary: 'The AI Stupid Level Function on openwebui.com gives Open WebUI every routing mode as a model, with the model that answered and why above each reply; a plain OpenAI connection on `https://aistupidlevel.info/v1` works too.',
    settings: {
      lang: 'text',
      title: 'Open WebUI',
      src: `Admin Panel → Functions → Import from URL (or openwebui.com → Get)
Admin Panel → Functions → AI Stupid Level → Valves
  API_KEY: ${KEY_PLACEHOLDER}
Admin Panel → Settings → Models: make the AI Stupid Level models Public`,
    },
    steps: [
      STEP_KEY,
      STEP_PROVIDERS,
      {
        heading: 'Install the Function',
        body: 'Open the [AI Stupid Level Function on openwebui.com](https://openwebui.com/posts/f838dc6c-247f-4b98-a61a-4b3e046b81ec) and click Get, or use Admin Panel → Functions → Import from URL with the GitHub link.',
        code: {
          lang: 'text',
          title: 'Open WebUI',
          src: `# Install the AI Stupid Level Function:
#   openwebui.com/posts/f838dc6c-247f-4b98-a61a-4b3e046b81ec → Get
#   (or Admin Panel → Functions → Import from URL with the GitHub link)`,
        },
      },
      {
        heading: 'Set the key in Valves',
        body: 'Admin Panel → Functions → AI Stupid Level → Valves → `API_KEY`. Each user can set their own `API_KEY` in User Valves, so one installation can route on several accounts.',
        code: {
          lang: 'text',
          title: 'Valves',
          src: `Admin Panel → Functions → AI Stupid Level → Valves
  API_KEY: ${KEY_PLACEHOLDER}   (each user can set their own API_KEY in User Valves)`,
        },
      },
      {
        heading: 'Make the models Public',
        body: 'Admin Panel → Settings → Models: make the AI Stupid Level models Public so they appear in everyone’s model menu. Every routing mode is a model, and the model that answered and why is shown above each reply.',
      },
      {
        heading: 'Alternative: a plain OpenAI connection',
        body: 'Without the Function: Admin → Connections → OpenAI → Add Connection with the base URL `https://aistupidlevel.info/v1` and your `aism_` key. The model menu then fills from `GET /v1/models`.',
        code: {
          lang: 'text',
          title: 'Connection',
          src: `Admin → Connections → OpenAI → Add Connection
Base URL: ${ROUTER_BASE_URL}
API Key:  ${KEY_PLACEHOLDER}`,
        },
      },
    ],
    routing: 'modes',
    modes: ['auto-best', 'auto-value', 'auto-fastest-quality', 'auto-reasoning'],
    caveats: [
      'The Function shows the model that answered and why above each reply, and every routing mode appears as a model.',
      'Each user can set their own `API_KEY` in User Valves; admins must make the models Public.',
      'With a plain connection, the model menu is filled from `GET /v1/models`, which needs a valid `aism_` key.',
      'Embeddings for RAG go through `POST /v1/embeddings`, which requires an active OpenAI provider key.',
      'Text only: a request with images, audio or files gets a `400 unsupported_content`.',
    ],
    faq: [
      {
        q: 'Function or connection?',
        a: 'The Function adds every routing mode as a model and prints the model that answered and why above each reply; users can bring their own keys in User Valves. A plain OpenAI connection (Admin → Connections → OpenAI → Add Connection) also works, with the model menu filled from `GET /v1/models`.',
      },
      {
        q: 'Can each user bring their own router key?',
        a: 'Yes. The admin sets a default `API_KEY` in the Function’s Valves, and each user can set their own `API_KEY` in User Valves, so each person routes on their own account and allowance.',
      },
      COST_FAQ,
      {
        q: 'Does RAG work?',
        a: 'Document embeddings go through `POST /v1/embeddings`, which proxies to OpenAI’s `text-embedding-3-small` (also `auto-embedding`) and `text-embedding-3-large`. It requires an active OpenAI provider key under [Providers](/router/providers); each call counts as one request.',
      },
      {
        q: 'Why are there no models in the menu?',
        a: 'For the Function: make the AI Stupid Level models Public under Admin Panel → Settings → Models. For a plain connection: the menu fills from `GET /v1/models`, which requires a valid `aism_` key and the base URL `https://aistupidlevel.info/v1`.',
      },
    ],
    docsAnchor: DOCS_INTEGRATIONS_PATH,
  },

  /* ── LibreChat ── */
  {
    slug: 'librechat',
    name: 'LibreChat',
    category: 'chat UI',
    title: 'LibreChat librechat.yaml custom endpoint',
    description: 'Add the Smart Router to LibreChat as a custom endpoint in librechat.yaml: baseURL https://aistupidlevel.info/v1, your aism_ key and fetch: true.',
    keywords: ['LibreChat custom endpoint', 'librechat.yaml custom endpoint', 'LibreChat OpenAI compatible API', 'LibreChat LLM router', 'LibreChat fetch models', 'LibreChat titleModel'],
    summary: 'A custom endpoint in `librechat.yaml` puts the routing modes in LibreChat’s model menu, with `fetch: true` to list every model the router offers and `auto-fastest-quality` for conversation titles.',
    settings: {
      lang: 'yaml',
      title: 'librechat.yaml',
      src: `endpoints:
  custom:
    - name: "AI Stupid Level"
      apiKey: "\${ASL_ROUTER_KEY}"
      baseURL: "${ROUTER_BASE_URL}"
      models:
        default: ["auto-coding", "auto-reasoning", "auto-tooling", "auto-best", "auto-value"]
        fetch: true
      titleConvo: true
      titleModel: "auto-fastest-quality"
      modelDisplayLabel: "AI Stupid Level"`,
    },
    steps: [
      STEP_KEY,
      STEP_PROVIDERS,
      {
        heading: 'Put the key in LibreChat’s environment',
        body: 'The sample reads the key as `${ASL_ROUTER_KEY}`, so set that variable where LibreChat runs (its `.env`, or the container’s environment) to your `aism_` key.',
        code: { lang: 'bash', title: '.env', src: `ASL_ROUTER_KEY=${KEY_PLACEHOLDER}` },
      },
      {
        heading: 'Add the custom endpoint to librechat.yaml',
        body: 'One entry under `endpoints.custom`: the base URL, the key from the environment, the routing modes as default models, `fetch: true` to list every model the router offers, and `auto-fastest-quality` as the title model.',
        code: {
          lang: 'yaml',
          title: 'librechat.yaml',
          src: `endpoints:
  custom:
    - name: "AI Stupid Level"
      apiKey: "\${ASL_ROUTER_KEY}"
      baseURL: "${ROUTER_BASE_URL}"
      models:
        default: ["auto-coding", "auto-reasoning", "auto-tooling", "auto-best", "auto-value"]
        fetch: true
      titleConvo: true
      titleModel: "auto-fastest-quality"
      modelDisplayLabel: "AI Stupid Level"`,
        },
      },
      {
        heading: 'Restart LibreChat and pick AI Stupid Level',
        body: 'LibreChat reads `librechat.yaml` when it starts. The endpoint then appears in the menu as AI Stupid Level with the routing modes as models, and every reply is routed by the model name you choose.',
      },
    ],
    routing: 'modes',
    modes: ['auto-best', 'auto-value', 'auto-reasoning', 'auto-fastest-quality'],
    caveats: [
      '`fetch: true` fills the menu from `GET /v1/models`, which needs a valid `aism_` key; the `default` list shows the routing modes first.',
      'Conversation titles use `auto-fastest-quality`: the fastest model among those within 5 points of the best one you can use.',
      'Embeddings for RAG go through `POST /v1/embeddings`, which requires an active OpenAI provider key.',
      'Text only: a request with images, audio or files gets a `400 unsupported_content`.',
    ],
    faq: [
      {
        q: 'What does fetch: true do?',
        a: 'It makes LibreChat call `GET /v1/models` and list every model the router offers: the `auto-*` routing modes plus every real model you can pin. The `default` list in the sample puts the routing modes first. The call needs a valid `aism_` key.',
      },
      {
        q: 'Why auto-fastest-quality for titles?',
        a: 'A title is a short, cheap request, and `auto-fastest-quality` picks the fastest model among those within 5 points of the best one you can use, so titles come back quickly without dropping to a weak model. The chat itself uses whichever mode you choose in the menu.',
      },
      COST_FAQ,
      {
        q: 'Does RAG work?',
        a: 'Document embeddings go through `POST /v1/embeddings`, which proxies to OpenAI’s `text-embedding-3-small` (also `auto-embedding`) and `text-embedding-3-large`. It requires an active OpenAI provider key under [Providers](/router/providers); each call counts as one request.',
      },
      {
        q: 'Where does the key go?',
        a: 'In the environment as `ASL_ROUTER_KEY`, which the sample reads with `apiKey: "${ASL_ROUTER_KEY}"`. Keeping it out of `librechat.yaml` lets the file be shared or committed without the key.',
      },
    ],
    docsAnchor: DOCS_INTEGRATIONS_PATH,
  },
];

export const INTEGRATION_SLUGS: string[] = INTEGRATIONS.map((i) => i.slug);

export function integrationBySlug(slug: string): Integration | undefined {
  const s = String(slug || '').toLowerCase();
  return INTEGRATIONS.find((i) => i.slug === s);
}

export const integrationsOf = (category: IntegrationCategory): Integration[] =>
  INTEGRATIONS.filter((i) => i.category === category);

/** "Cline, Kilo Code and Roo Code" or just the name: how the hub lists a page. */
export const integrationLabel = (i: Integration): string => i.headline ?? i.name;
