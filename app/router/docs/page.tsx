'use client';

/**
 * /router/docs — the Smart Router API reference.
 *
 * Every section is on the page at once (it used to be an accordion that showed one at a time).
 * A sticky "On this page" rail on wide screens, and a sticky row of chips under the header below
 * that, jump between sections and follow the scroll. The content is the reference as it was:
 * every endpoint, parameter, model id, header, limit and example is unchanged.
 */

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import RouterLayout from '@/components/RouterLayout';
import { PageHead, Pane, CodeBlock, CopyButton, Tag, type CodeSample } from '@/components/studio';
import '@/styles/studio-docs.css';

const BASE_URL = 'https://aistupidlevel.info/v1';

type Method = 'GET' | 'POST';

const SECTIONS: Array<{ id: string; label: string; method?: Method }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'sdks', label: 'SDKs' },
  { id: 'chat', label: 'Chat completions', method: 'POST' },
  { id: 'strategies', label: 'Virtual models' },
  { id: 'models', label: 'Models', method: 'GET' },
  { id: 'features', label: 'Tools, JSON and streaming' },
  { id: 'sandbox', label: 'Sandbox and preview' },
  { id: 'reliability', label: 'Retries and idempotency' },
  { id: 'embeddings', label: 'Embeddings', method: 'POST' },
  { id: 'anthropic', label: 'Anthropic Messages', method: 'POST' },
  { id: 'errors', label: 'Error handling' },
  { id: 'integrations', label: 'Integrations' },
];
const SECTION_IDS = SECTIONS.map(s => s.id);

const ENDPOINTS: Array<{ method: Method; path: string; desc: ReactNode; to?: string }> = [
  { method: 'POST', path: '/v1/chat/completions', desc: 'Chat completions (auto-routing or direct pin)', to: 'chat' },
  { method: 'GET', path: '/v1/models', desc: 'List available models (requires auth)', to: 'models' },
  { method: 'POST', path: '/v1/embeddings', desc: 'Embeddings (proxied to OpenAI)', to: 'embeddings' },
  { method: 'POST', path: '/v1/messages', desc: 'Native Anthropic Messages API passthrough (Claude Code)', to: 'anthropic' },
  { method: 'POST', path: '/v1/messages/count_tokens', desc: 'Anthropic token counter (free; not counted against your plan)', to: 'anthropic' },
  { method: 'POST', path: '/v1/router/feedback', desc: 'Rate an answer up or down by its completion id', to: 'features' },
  { method: 'POST', path: '/v1/route/preview', desc: 'The model, fallbacks and reasons a chat request would get, without sending it', to: 'sandbox' },
  { method: 'GET', path: '/v1/usage', desc: "This month's requests, prepaid credits and the key's budget", to: 'sandbox' },
  { method: 'GET', path: '/v1/openapi.json', desc: 'OpenAPI 3.1 description of the router API (no key needed)', to: 'sdks' },
  { method: 'POST', path: '/v1/explain', desc: <>Which model &ldquo;auto&rdquo; would pick for a prompt, without sending it</> },
  { method: 'POST', path: '/v1/compare', desc: 'What every strategy would pick for a prompt' },
  { method: 'POST', path: '/v1/analyze', desc: 'How the router classifies a prompt' },
];

const PARAMS: Array<{ n: string; t: string; r: boolean; d: string }> = [
  { n: 'model', t: 'string', r: true, d: '"auto-coding", "auto-reasoning", or a real model ID like "claude-opus-5-5"' },
  { n: 'messages', t: 'array', r: true, d: 'Array of {role, content} message objects' },
  { n: 'temperature', t: 'number', r: false, d: 'Sampling temperature (0-2). Default varies by provider.' },
  { n: 'max_tokens', t: 'number', r: false, d: 'Max tokens to generate. For reasoning models use max_completion_tokens.' },
  { n: 'max_completion_tokens', t: 'number', r: false, d: 'Max output tokens including reasoning tokens (GPT-5.x, o-series).' },
  { n: 'stream', t: 'boolean', r: false, d: 'Enable SSE streaming. Default: false.' },
  { n: 'stream_options', t: 'object', r: false, d: '{ include_usage: true } — emit final usage chunk in SSE.' },
  { n: 'tools', t: 'array', r: false, d: 'Function tool definitions for tool calling.' },
  { n: 'tool_choice', t: 'string|object', r: false, d: '"auto", "none", "required", or {type:"function", function:{name}}.' },
  { n: 'response_format', t: 'object', r: false, d: '{ type: "json_object" } or { type: "json_schema", json_schema: {...} }.' },
  { n: 'reasoning_effort', t: 'string', r: false, d: '"none"|"minimal"|"low"|"medium"|"high"|"xhigh"|"max". Any value works with any model: the router maps it to the nearest level the chosen model supports (a tie goes to the deeper level).' },
  { n: 'top_p', t: 'number', r: false, d: 'Nucleus sampling. Default: 1.' },
  { n: 'frequency_penalty', t: 'number', r: false, d: 'Frequency penalty (-2 to 2). Not supported by all providers.' },
  { n: 'presence_penalty', t: 'number', r: false, d: 'Presence penalty (-2 to 2). Not supported by all providers.' },
  { n: 'stop', t: 'string|array', r: false, d: 'Stop sequences. Not supported by all providers.' },
  { n: 'seed', t: 'number', r: false, d: 'Random seed for reproducibility.' },
];

const STRATEGIES: Array<{ id: string; cat: string; desc: string }> = [
  { id: 'auto', cat: 'Default', desc: 'Uses your saved routing strategy from Preferences' },
  { id: 'auto-task', cat: 'Per request', desc: 'Reads each request and picks the matching benchmark: tools → tool use, design or long sessions → reasoning, code → coding, else overall; simple requests use the Best value version. The routing reason names the rule' },
  { id: 'auto-split', cat: 'Your split', desc: 'Your own weighted traffic split across models you choose (set it in Preferences); the rest of the split is the first fallback' },
  { id: 'auto-coding', cat: 'Coding', desc: 'Best for code generation, debugging, refactoring' },
  { id: 'auto-reasoning', cat: 'Reasoning', desc: 'Best for complex analysis, math, logic' },
  { id: 'auto-consistent', cat: 'Consistency', desc: 'Among models within 5 points of the best one you can use, the one whose score swings least from run to run' },
  { id: 'auto-fastest-quality', cat: 'Speed', desc: 'Among models within 5 points of the best one you can use, the fastest (measured latency) — auto-fastest has no quality bar' },
  { id: 'auto-creative', cat: 'Legacy', desc: 'Still accepted and routed as auto-best — there is no creative-writing benchmark' },
  { id: 'auto-cheapest', cat: 'Cost', desc: 'Lowest list price per token among your providers — no quality bar' },
  { id: 'auto-value', cat: 'Value', desc: 'Most combined-score points per measured dollar, among models within 5 points of the best one you can use' },
  { id: 'auto-value-coding', cat: 'Value', desc: 'Most coding points per dollar (measured cost of a coding run), near-top models only' },
  { id: 'auto-value-reasoning', cat: 'Value', desc: 'Most reasoning points per dollar (measured cost of a reasoning run), near-top models only' },
  { id: 'auto-value-tooling', cat: 'Value', desc: 'Most tool-use points per dollar (measured cost of a tool-use run), near-top models only' },
  { id: 'auto-value-agentic', cat: 'Value', desc: 'Alias for auto-value-tooling' },
  { id: 'auto-fastest', cat: 'Speed', desc: 'Lowest latency response time' },
  { id: 'auto-tooling', cat: 'Tool use', desc: 'Best at calling tools correctly — scored on our tool-calling suite' },
  { id: 'auto-agentic', cat: 'Tool use', desc: 'Alias for auto-tooling; "agentic" is what most tools call it' },
  { id: 'auto-best', cat: 'Overall', desc: 'Highest combined score regardless of category' },
];

const ERRORS: Array<{ http: number; type: string; code: string; desc: string }> = [
  { http: 400, type: 'invalid_request_error', code: 'invalid_messages / invalid_tools / unsupported_content / model_not_found', desc: 'The request cannot be routed as sent (the message says what to change)' },
  { http: 400, type: 'invalid_request_error', code: 'provider_rejected_request', desc: 'The provider rejected the request itself; its own words are in the message' },
  { http: 400, type: 'invalid_request_error', code: 'provider_key_rejected / no_provider_keys', desc: 'Your provider key is missing or was refused — add or update it in Providers' },
  { http: 400, type: 'invalid_request_error', code: 'no_routable_model', desc: 'Your preferences exclude every model (the message names the setting)' },
  { http: 401, type: 'authentication_error', code: 'invalid_api_key', desc: 'Missing or invalid aism_ key' },
  { http: 401, type: 'authentication_error', code: 'expired_api_key', desc: 'The key had an expiry date and it has passed (the message says when)' },
  { http: 400, type: 'invalid_request_error', code: 'pinning_not_allowed / model_not_allowed / provider_not_allowed', desc: 'Project keys: the project routes every request, or does not allow that model or provider' },
  { http: 403, type: 'permission_error', code: 'not_in_workspace / not_in_project / seat_required / project_deleted / plan_lapsed', desc: 'Project keys: the holder left, lost their seat, or the project or its plan is gone' },
  { http: 429, type: 'rate_limit_error', code: 'rate_limited', desc: 'Project keys: the project’s requests-per-minute limit for this key (see Retry-After)' },
  { http: 429, type: 'rate_limit_error', code: 'project_budget_exceeded', desc: 'Project keys: the request could take the project past its monthly budget' },
  { http: 429, type: 'rate_limit_error', code: 'member_cap_reached', desc: 'Project keys: you reached your monthly cap in the project' },
  { http: 429, type: 'rate_limit_error', code: 'budget_downgraded', desc: 'Project keys: the budget is spent and the project now routes only (cheapest models); naming a model is refused' },
  { http: 429, type: 'rate_limit_error', code: 'allowance_exhausted', desc: "This month's requests are used up and you have no prepaid credits" },
  { http: 429, type: 'rate_limit_error', code: 'insufficient_quota', desc: "This key's monthly hard budget would be exceeded" },
  { http: 429, type: 'rate_limit_error', code: 'provider_quota_exceeded', desc: 'Your provider account refused for credit or rate limits' },
  { http: 400, type: 'invalid_request_error', code: 'invalid_idempotency_key', desc: 'Idempotency-Key must be 1–255 printable ASCII characters' },
  { http: 422, type: 'invalid_request_error', code: 'idempotency_key_reused', desc: 'The Idempotency-Key was already used with a different request body' },
  { http: 409, type: 'conflict_error', code: 'idempotency_in_progress', desc: 'A request with this Idempotency-Key is still running (see Retry-After)' },
  { http: 413, type: '—', code: '—', desc: 'The request body is over 32 MB' },
  { http: 502, type: 'api_error', code: 'model_unavailable', desc: 'Every model tried failed on the provider side' },
  { http: 502, type: 'api_error', code: 'tool_choice_not_honoured', desc: 'You forced a tool call and the model answered without one, twice (only models that cannot be forced natively; see Tools above)' },
  { http: 500, type: 'server_error', code: 'internal_error', desc: 'Internal server error' },
];

const CHAT_BODY = `{
  "model": "auto-coding",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Write a Python fibonacci function"}
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "stream": false
}`;

const CHAT_EXAMPLES: CodeSample[] = [
  { label: 'Python', lang: 'python', code: `from openai import OpenAI

client = OpenAI(
    api_key="aism_your_key_here",
    base_url="https://aistupidlevel.info/v1"
)

response = client.chat.completions.create(
    model="auto-coding",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)` },
  { label: 'Node', lang: 'ts', code: `import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: 'aism_your_key_here',
    baseURL: 'https://aistupidlevel.info/v1'
});

const response = await client.chat.completions.create({
    model: 'auto-coding',
    messages: [{ role: 'user', content: 'Hello!' }]
});
console.log(response.choices[0].message.content);` },
  { label: 'cURL', lang: 'bash', code: `curl -X POST https://aistupidlevel.info/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer aism_your_key_here" \\
  -d '{
    "model": "auto-coding",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'` },
];

const CHAT_RESPONSE = `{
  "id": "chatcmpl-1748250000000",
  "object": "chat.completion",
  "created": 1748250000,
  "model": "claude-opus-5-5",
  "system_fingerprint": "aism_v1_anthropic",
  "service_tier": "default",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you today?",
      "refusal": null,
      "annotations": []
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 9,
    "total_tokens": 21,
    "prompt_tokens_details": { "cached_tokens": 0 },
    "completion_tokens_details": { "reasoning_tokens": 0 }
  }
}`;

const MODELS_CURL = `curl https://aistupidlevel.info/v1/models \\
  -H "Authorization: Bearer aism_your_key_here"`;

const FEEDBACK_CURL = `curl -X POST https://aistupidlevel.info/v1/router/feedback \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer aism_your_key_here" \\
  -d '{"id": "chatcmpl-...", "rating": "up"}'`;

const EMBED_CURL = `curl -X POST https://aistupidlevel.info/v1/embeddings \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer aism_your_key_here" \\
  -d '{"model": "text-embedding-3-small", "input": "Hello world"}'`;

const CLAUDE_CODE = `export ANTHROPIC_BASE_URL="https://aistupidlevel.info"
export ANTHROPIC_API_KEY="aism_your_key_here"
claude`;

const ANTHROPIC_CURL = `curl -X POST https://aistupidlevel.info/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: aism_your_key_here" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{
    "model": "claude-sonnet-5-5",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;

const ERROR_EXAMPLE = `{
  "error": {
    "message": "Invalid API key. Generate a new key at https://aistupidlevel.info/router/keys",
    "type": "authentication_error",
    "code": "invalid_api_key"
  }
}`;

const SDK_SAMPLES: CodeSample[] = [
  { label: 'TypeScript', lang: 'ts', code: `// npm install @aistupidlevel/router
import { ASLRouter } from '@aistupidlevel/router';

const router = new ASLRouter(); // reads ASL_ROUTER_KEY

const r = await router.chat.completions.create({
  model: 'auto-coding',
  messages: [{ role: 'user', content: 'Fix the off-by-one in this loop: ...' }],
});
console.log(r.choices[0].message.content);
console.log(r.routing.model, r.routing.reasoning); // which model answered, and why

// Streaming
const stream = await router.chat.completions.create({ model: 'auto-best', messages, stream: true });
for await (const text of stream.textStream()) process.stdout.write(text);` },
  { label: 'Python', lang: 'python', code: `# pip install aistupidlevel
from aistupidlevel import ASLRouter

router = ASLRouter()  # reads ASL_ROUTER_KEY

r = router.chat.completions.create(
    model="auto-coding",
    messages=[{"role": "user", "content": "Fix the off-by-one in this loop: ..."}],
)
print(r.choices[0].message.content)
print(r.routing.model, r.routing.reasoning)  # which model answered, and why

# Streaming (AsyncASLRouter has the same API with await)
with router.chat.completions.create(model="auto-best", messages=messages, stream=True) as s:
    for text in s.text_stream():
        print(text, end="")` },
  { label: 'Vercel AI SDK', lang: 'ts', code: `// npm install @aistupidlevel/ai-sdk-provider ai
import { asl } from '@aistupidlevel/ai-sdk-provider';
import { generateText } from 'ai';

const { text, providerMetadata } = await generateText({
  model: asl('auto-coding'), // reads ASL_ROUTER_KEY
  prompt: 'Write a React hook that debounces a value',
});
console.log(providerMetadata?.aistupidlevel); // { model, provider }` },
];

const TOOL_LOOP: CodeSample[] = [
  { label: 'TypeScript', lang: 'ts', code: `const { completion, rounds } = await router.chat.runTools(
  { model: 'auto-tooling', messages, tools },
  { handlers: { get_weather: async ({ city }) => ({ city, temp: 7 }) } },
);` },
  { label: 'Python', lang: 'python', code: `out = router.chat.run_tools(
    model="auto-tooling", messages=messages, tools=tools,
    handlers={"get_weather": lambda city: {"city": city, "temp": 7}},
)
print(out["completion"].choices[0].message.content, out["rounds"])` },
];

const SANDBOX_SAMPLES: CodeSample[] = [
  { label: 'cURL', lang: 'bash', code: `curl https://aistupidlevel.info/v1/chat/completions \\
  -H "Authorization: Bearer aism_your_key_here" \\
  -H "Content-Type: application/json" \\
  -H "X-ASL-Sandbox: true" \\
  -d '{"model": "auto-coding", "messages": [{"role": "user", "content": "Hello!"}]}'` },
  { label: 'TypeScript', lang: 'ts', code: `const test = new ASLRouter({ sandbox: true });
const r = await test.chat.completions.create({ model: 'auto-coding', messages });
r.routing.sandbox; // true

// Make the next request fail the way a real one can
await test.chat.completions.create({ model: 'auto', messages }, { simulate: 'allowance_exhausted' });
// → throws AllowanceExhaustedError` },
  { label: 'Python', lang: 'python', code: `test = ASLRouter(sandbox=True)
r = test.chat.completions.create(model="auto-coding", messages=messages)
r.routing.sandbox  # True

# Make the next request fail the way a real one can
test.chat.completions.create(model="auto", messages=messages, simulate="allowance_exhausted")
# → raises AllowanceExhaustedError` },
];

const PREVIEW_CURL = `curl https://aistupidlevel.info/v1/route/preview \\
  -H "Authorization: Bearer aism_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "auto-coding", "messages": [{"role": "user", "content": "Fix this bug"}]}'`;

const PREVIEW_RESPONSE = `{
  "object": "route.preview",
  "requested_model": "auto-coding",
  "strategy": "best_coding",
  "sandbox": false,
  "primary": {
    "model": "claude-opus-5-5",
    "provider": "anthropic",
    "score": 99,
    "reasoning": "Selected claude-opus-5-5 from anthropic for best coding performance ...",
    "estimated_cost_usd": 0.012
  },
  "fallbacks": [
    { "model": "gpt-5.6-sol", "provider": "openai", "score": 96, "reasoning": "Fallback: ...", "estimated_cost_usd": 0.012 }
  ],
  "fallback_enabled": true
}`;

const USAGE_CURL = `curl https://aistupidlevel.info/v1/usage \\
  -H "Authorization: Bearer aism_your_key_here"`;

const IDEMPOTENCY_CURL = `curl https://aistupidlevel.info/v1/chat/completions \\
  -H "Authorization: Bearer aism_your_key_here" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order-4821-summary" \\
  -d '{"model": "auto", "messages": [{"role": "user", "content": "Summarise order 4821"}]}'`;

/** Integrations in code: SDKs and frameworks. */
const INTEGRATIONS: CodeSample[] = [
  { label: 'OpenAI SDK', lang: 'python', code: `from openai import OpenAI

client = OpenAI(api_key="aism_your_key_here", base_url="https://aistupidlevel.info/v1")

raw = client.chat.completions.with_raw_response.create(
    model="auto-coding", messages=[{"role": "user", "content": "Hello!"}]
)
print(raw.headers["x-aism-model"])   # the model that answered
print(raw.parse().choices[0].message.content)` },
  { label: 'LangChain', lang: 'python', code: `from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="auto-coding",
    api_key="aism_your_key_here",
    base_url="https://aistupidlevel.info/v1",
)
print(llm.invoke("Write a Python function").content)` },
  { label: 'LlamaIndex', lang: 'python', code: `# pip install llama-index-llms-openai-like
from llama_index.llms.openai_like import OpenAILike

llm = OpenAILike(
    model="auto-reasoning",
    api_key="aism_your_key_here",
    api_base="https://aistupidlevel.info/v1",
    is_chat_model=True,
    is_function_calling_model=True,
    context_window=200000,
)
print(llm.complete("Explain this stack trace: ..."))` },
  { label: 'Vercel AI SDK', lang: 'ts', code: `import { createASL } from '@aistupidlevel/ai-sdk-provider';
import { streamText } from 'ai';

const asl = createASL({ apiKey: process.env.ASL_ROUTER_KEY });

const result = streamText({ model: asl('auto-best'), prompt: 'Draft a release note' });
for await (const text of result.textStream) process.stdout.write(text);` },
  { label: 'LiteLLM', lang: 'text', code: `model_list:
  - model_name: aism-auto
    litellm_params:
      model: openai/auto-coding
      api_key: aism_your_key_here
      api_base: https://aistupidlevel.info/v1` },
  { label: 'CrewAI', lang: 'python', code: `from crewai import Agent, LLM

llm = LLM(
    model="openai/auto-tooling",   # routing mode; agents that call tools do best on auto-tooling
    base_url="https://aistupidlevel.info/v1",
    api_key="aism_your_key_here",
)
agent = Agent(role="Researcher", goal="Answer with sources", backstory="...", llm=llm)` },
  { label: 'promptfoo', lang: 'text', code: `# promptfooconfig.yaml — compare routing modes on the same prompts
providers:
  - id: openai:chat:auto-coding
    config: &asl
      apiBaseUrl: https://aistupidlevel.info/v1
      apiKeyEnvar: ASL_ROUTER_KEY
  - id: openai:chat:auto-value-coding
    config: *asl` },
];

/** Integrations in apps and agents: no code, a few settings. */
const APP_INTEGRATIONS: CodeSample[] = [
  { label: 'n8n', lang: 'text', code: `Install (self-hosted n8n):
  Settings → Community Nodes → Install → n8n-nodes-aistupidlevel

Credentials:
  AI Stupid Level Router API   router key (aism_…)      chat and routing
  AI Stupid Level Data API     Data API key (asl_live_…) rankings, drift, incidents

Nodes:
  AI Stupid Level              Chat · Router (preview, usage) · Benchmark data
  AI Stupid Level Chat Model   plug into an AI Agent or LLM chain; every call,
                               tool turns included, goes through the router` },
  { label: 'MCP (Claude, Cursor)', lang: 'text', code: `# Claude Code
claude mcp add aistupidlevel -e ASL_DATA_KEY=asl_live_... -e ASL_ROUTER_KEY=aism_... -- npx -y @aistupidlevel/mcp

# Claude Desktop (claude_desktop_config.json) and Cursor (~/.cursor/mcp.json)
{
  "mcpServers": {
    "aistupidlevel": {
      "command": "npx",
      "args": ["-y", "@aistupidlevel/mcp"],
      "env": { "ASL_DATA_KEY": "asl_live_...", "ASL_ROUTER_KEY": "aism_..." }
    }
  }
}` },
  { label: 'Dify', lang: 'text', code: `Settings → Model Provider → install "OpenAI-API-compatible", then Add Model:
  Model Type:        LLM
  Model Name:        auto-coding        (or any routing mode)
  API Key:           aism_your_key_here
  API endpoint URL:  https://aistupidlevel.info/v1
  Function calling:  Tool Call` },
  { label: 'RAGFlow', lang: 'text', code: `Model providers → AI Stupid Level → Add the model
  API Key:  aism_your_key_here
  Model:    auto-coding        (or any routing mode)

On a RAGFlow version without the AI Stupid Level provider, choose
OpenAI-API-Compatible with base URL https://aistupidlevel.info/v1` },
  { label: 'Cherry Studio', lang: 'text', code: `Settings → Model Provider → + Add
  Provider Type:  OpenAI
  API Key:        aism_your_key_here
  API Host:       https://aistupidlevel.info
Models → Add:     auto-coding, auto-reasoning, auto-tooling, auto-best` },
  { label: 'LibreChat', lang: 'text', code: `# librechat.yaml
endpoints:
  custom:
    - name: "AI Stupid Level"
      apiKey: "\${ASL_ROUTER_KEY}"
      baseURL: "https://aistupidlevel.info/v1"
      models:
        default: ["auto-coding", "auto-reasoning", "auto-tooling", "auto-best", "auto-value"]
        fetch: true
      titleConvo: true
      titleModel: "auto-fastest-quality"
      modelDisplayLabel: "AI Stupid Level"` },
  { label: 'Crush', lang: 'text', code: `# crushrc
provider add aistupidlevel --type openai-compat \\
  --base-url "https://aistupidlevel.info/v1" \\
  --api-key "$ASL_ROUTER_KEY"

model add aistupidlevel/auto-coding \\
  --name "ASL auto-coding" \\
  --context-window 262144 \\
  --default-max-tokens 16000` },
  { label: 'Cline / Kilo Code / Roo', lang: 'text', code: `API Provider:  OpenAI Compatible
Base URL:      https://aistupidlevel.info/v1
API Key:       aism_your_key_here
Model ID:      auto-coding   (or auto-tooling for long agent sessions)` },
  { label: 'Continue', lang: 'text', code: `# ~/.continue/config.yaml
models:
  - name: ASL auto-coding
    provider: openai
    model: auto-coding
    apiBase: https://aistupidlevel.info/v1
    apiKey: aism_your_key_here
    roles: [chat, edit, apply]` },
];

/** Inline code in running text. */
function C({ children }: { children: ReactNode }) {
  return <code className="st-ic">{children}</code>;
}

function MethodTag({ method }: { method: Method }) {
  return <Tag tone={method === 'GET' ? 'good' : 'accent'}>{method}</Tag>;
}

/** An endpoint as a pane title: method tag, path, and an optional note ("Anthropic"). */
function Endpoint({ method, path, note }: { method: Method; path: string; note?: string }) {
  return (
    <span className="sd-ep">
      <MethodTag method={method} />
      <code className="sd-ep-path">{path}</code>
      {note && <span className="sd-ep-note">{note}</span>}
    </span>
  );
}

/** A URL with line-break chances after its path slashes, so a narrow screen wraps it at "/", not mid-word. */
function withBreaks(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  let buf = '';
  for (let i = 0; i < s.length; i++) {
    buf += s[i];
    if (s[i] === '/' && s[i - 1] !== '/' && s[i + 1] && s[i + 1] !== '/') { out.push(buf, <wbr key={i} />); buf = ''; }
  }
  if (buf) out.push(buf);
  return out;
}

/** One-line value with a copy button. */
function CopyLine({ text }: { text: string }) {
  return (
    <div className="sd-copyline">
      <code>{withBreaks(text)}</code>
      <CopyButton text={text} />
    </div>
  );
}

const one = (label: string, lang: CodeSample['lang'], code: string): CodeSample[] => [{ label, lang, code }];

/**
 * The section in view: the last one whose top has passed a line a little below the sticky
 * bars. A jump from the navigation sets it straight away and holds it while the page scrolls
 * there, so the highlight does not flicker through every section on the way.
 */
function useSectionInView(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  const holdUntil = useRef(0);

  useEffect(() => {
    let raf = 0;
    const pick = () => {
      raf = 0;
      if (performance.now() < holdUntil.current) return;
      const els = ids.map(id => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
      if (!els.length) return;
      const line = Math.max(150, window.innerHeight * 0.3);
      let current = els[0].id;
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id;
      setActive(current);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(pick); };
    pick();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ids]);

  const jump = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    // Let the browser handle new-tab clicks and the like.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    holdUntil.current = performance.now() + (still ? 120 : 900);
    setActive(id);
    el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    // Keep the address shareable (history.state carries the router's own entry, so pass it on).
    window.history.replaceState(window.history.state, '', `#${id}`);
    // Move keyboard focus to the section, as following a plain #link would.
    const heading = el.querySelector<HTMLElement>('h2');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  };

  return { active, jump };
}

export default function DocsPage() {
  const { active, jump } = useSectionInView(SECTION_IDS);
  const chipsRef = useRef<HTMLElement>(null);

  // Keep the active chip in view in the sideways row (scrolls the row only, never the page).
  useEffect(() => {
    const row = chipsRef.current;
    if (!row || row.scrollWidth <= row.clientWidth) return;
    const chip = row.querySelector<HTMLElement>('[aria-current="location"]');
    if (!chip) return;
    const left = chip.offsetLeft;
    const right = left + chip.offsetWidth;
    if (left < row.scrollLeft + 16 || right > row.scrollLeft + row.clientWidth - 16) {
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      row.scrollTo({ left: Math.max(0, left - 16), behavior: still ? 'auto' : 'smooth' });
    }
  }, [active]);

  return (
    <RouterLayout>
      <div className="sd-page sd-docs">
        <PageHead
          kicker="Support"
          title="API documentation"
          lead={<>Complete developer reference for the AI Smart Router. Requests go to <code>{BASE_URL}</code> with your <code>aism_</code> key as a Bearer token.</>}
          actions={<>
            <Link href="/router/help" className="st-btn">Help center</Link>
            <Link href="/router/keys" className="st-btn is-primary">Create an API key <span className="st-ar" aria-hidden="true">→</span></Link>
          </>}
        >
          <dl className="sd-ref">
            <div className="sd-ref-wide"><dt>Base URL</dt><dd><code>{withBreaks(BASE_URL)}</code><CopyButton text={BASE_URL} /></dd></div>
            <div><dt>Auth</dt><dd><code>Bearer aism_key</code></dd></div>
            <div><dt>Format</dt><dd>OpenAI-compatible</dd></div>
            <div className="sd-ref-wide"><dt>Providers</dt><dd>6 (OpenAI, Anthropic, …)</dd></div>
          </dl>
        </PageHead>

        <nav className="sd-chips" aria-label="On this page" ref={chipsRef}>
          {SECTIONS.map(s => (
            <a key={s.id} href={`#${s.id}`} className={`st-chip${active === s.id ? ' is-on' : ''}`}
              aria-current={active === s.id ? 'location' : undefined} onClick={e => jump(e, s.id)}>
              {s.label}
            </a>
          ))}
        </nav>

        <div className="st-body">
          <div className="sd-layout">
            <div className="sd-main">
              {/* ── Overview ── */}
              <Pane id="overview" title="API overview" ruled>
                <div className="sd-flow">
                  <h3 className="sd-h3">Introduction</h3>
                  <p className="st-text">
                    The AI Smart Router provides an OpenAI-compatible API that intelligently routes your requests to the best AI model
                    based on real-time benchmarks. Use a single <C>aism_</C> key &mdash; your <strong>SR (Smart Router) key</strong> &mdash;
                    to access models from 6 providers: OpenAI, Anthropic, Google (Gemini), DeepSeek, Kimi (Moonshot), and GLM (Z.AI).
                  </p>

                  <h3 className="sd-h3">Base URL</h3>
                  <CopyLine text={BASE_URL} />

                  <h3 className="sd-h3">Authentication</h3>
                  <p className="st-text">All requests require a Bearer token in the Authorization header:</p>
                  <CopyLine text="Authorization: Bearer aism_your_api_key_here" />
                  <p className="st-text">
                    Some tools enforce an <C>sk-</C> prefix for API keys. The router accepts <C>sk-aism_...</C> — the prefix is stripped automatically.
                  </p>
                  <p className="st-text">
                    <strong>Project keys.</strong> A key made on a workspace project&rsquo;s page works the same way, but follows the
                    project&rsquo;s routing rules (strategy, allowed models, limits), pays with the project&rsquo;s or workspace&rsquo;s
                    provider keys, and counts against the project&rsquo;s budget and the holder&rsquo;s cap in it — see the{' '}
                    <a href="/docs/teams#keys">workspace guide</a>. Keys can also expire; an expired key gets a 401 saying when it expired.
                  </p>

                  <h3 className="sd-h3">Endpoints</h3>
                  <div className="sd-tbox">
                    <div className="st-table-wrap">
                      <table className="st-table is-stack sd-t-ep">
                        <thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
                        <tbody>
                          {ENDPOINTS.map(ep => (
                            <tr key={ep.path}>
                              <td data-label="Method"><MethodTag method={ep.method} /></td>
                              <td className="is-head" data-label="Path">
                                {ep.to
                                  ? <a className="sd-path" href={`#${ep.to}`} onClick={e => jump(e, ep.to!)}><code>{ep.path}</code></a>
                                  : <span className="sd-path"><code>{ep.path}</code></span>}
                              </td>
                              <td className="sd-desc" data-label="Description">{ep.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </Pane>

              {/* ── SDKs ── */}
              <Pane
                id="sdks"
                ruled
                title="SDKs"
                sub={<>Official clients for TypeScript and Python, and a provider for the Vercel AI SDK. Any OpenAI client works too (see <a href="#integrations" onClick={e => jump(e, 'integrations')}>Integrations</a>); the SDKs add what an OpenAI client cannot see.</>}
              >
                <div className="sd-flow">
                  <dl className="st-kv sd-hdrs">
                    <div><dt><code>@aistupidlevel/router</code></dt><dd>TypeScript and JavaScript, Node 18+, ESM and CommonJS. No dependencies: it uses the built-in <C>fetch</C></dd></div>
                    <div><dt><code>aistupidlevel</code></dt><dd>Python 3.9+, sync and asyncio clients. Depends only on httpx</dd></div>
                    <div><dt><code>@aistupidlevel/ai-sdk-provider</code></dt><dd>Provider for the Vercel AI SDK (<C>generateText</C>, <C>streamText</C>, tools)</dd></div>
                  </dl>
                  <CodeBlock samples={SDK_SAMPLES} />

                  <h3 className="sd-h3">What the SDKs add</h3>
                  <div className="sd-notes">
                    <p>
                      <strong>Routing on every answer.</strong> <C>routing</C> carries the provider and model that answered, why they were chosen, the
                      latency, the request id, and whether a fallback answered (<C>routing.fallback</C>). For a stream it is known before the first chunk.
                    </p>
                    <p>
                      <strong>Safe retries.</strong> Connection failures, timeouts, 408, 409, 429 and 5xx are retried twice by default with backoff,
                      honouring <C>Retry-After</C>. Every non-streaming request carries an <C>Idempotency-Key</C>, so a retry of a request whose answer was
                      lost is never charged twice. Errors that retrying cannot fix (allowance used up, a budget reached, a provider key refused) are not retried.
                    </p>
                    <p>
                      <strong>Errors that say whose problem it is.</strong> Each error class has a <C>party</C> (<C>request</C>, <C>account</C>,{' '}
                      <C>provider_key</C>, <C>provider</C>, <C>router</C> or <C>network</C>) and a <C>retryable</C> flag, so an app can tell its user to top
                      up, to fix a provider key, or simply to try again.
                    </p>
                    <p>
                      <strong>Tool loops.</strong> <C>chat.runTools</C> (Python: <C>chat.run_tools</C>) runs a tool-calling conversation to its final answer:
                      it calls your handlers, sends their results back, and reports a handler&apos;s exception to the model instead of crashing. The loop
                      stays on one model throughout.
                    </p>
                  </div>
                  <CodeBlock samples={TOOL_LOOP} />
                  <p className="st-text">
                    The API is also described in OpenAPI 3.1 at <a href="/v1/openapi.json"><C>/v1/openapi.json</C></a>, for generating a client in any
                    other language. Source:{' '}
                    <a href="https://github.com/StudioPlatforms/aistupidlevel-sdk" target="_blank" rel="noopener noreferrer">github.com/StudioPlatforms/aistupidlevel-sdk</a>.
                  </p>
                </div>
              </Pane>

              {/* ── Chat completions ── */}
              <Pane
                id="chat"
                ruled
                title={<Endpoint method="POST" path="/v1/chat/completions" />}
                sub={<>Create a chat completion. Use an <C>auto-*</C> virtual model for intelligent routing, or a real model ID for direct pin routing.</>}
              >
                <div className="sd-flow">
                  <h3 className="sd-h3">Request body</h3>
                  <CodeBlock samples={one('JSON', 'json', CHAT_BODY)} />

                  <h3 className="sd-h3">Parameters</h3>
                  <div className="sd-tbox">
                    <div className="st-table-wrap">
                      <table className="st-table is-stack sd-t-params">
                        <thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
                        <tbody>
                          {PARAMS.map(p => (
                            <tr key={p.n}>
                              <td className="is-head" data-label="Parameter"><code className="sd-name">{p.n}</code></td>
                              <td className="sd-type" data-label="Type">{p.t}</td>
                              <td className="sd-req" data-label="Required" data-req={p.r ? 'Required' : 'Optional'}><span className="sd-yn">{p.r ? 'Yes' : 'No'}</span></td>
                              <td className="sd-desc" data-label="Description">{p.d}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <h3 className="sd-h3">Code examples</h3>
                  <CodeBlock samples={CHAT_EXAMPLES} />

                  <h3 className="sd-h3">Response</h3>
                  <CodeBlock samples={one('JSON', 'json', CHAT_RESPONSE)} />

                  <h3 className="sd-h3">Response headers</h3>
                  <dl className="st-kv sd-hdrs">
                    <div><dt><code>X-AISM-Provider</code></dt><dd>The provider that answered</dd></div>
                    <div><dt><code>X-AISM-Model</code></dt><dd>The model that answered</dd></div>
                    <div><dt><code>X-AISM-Reasoning</code></dt><dd>Why it was chosen, including any fallback</dd></div>
                    <div><dt><code>X-AISM-Latency</code></dt><dd>How long the request took</dd></div>
                    <div><dt><code>X-AISM-Request-Id</code></dt><dd>The completion id, for feedback</dd></div>
                    <div>
                      <dt><code>X-AISM-Streaming-Mode</code></dt>
                      <dd>
                        <C>native</C> when streamed text arrives as the model writes it; <C>buffered</C> for a streamed forced tool call,
                        which is checked before anything is sent — see <a href="#features" onClick={e => jump(e, 'features')}>Tools, JSON and streaming</a>
                      </dd>
                    </div>
                  </dl>
                </div>
              </Pane>

              {/* ── Virtual models ── */}
              <Pane
                id="strategies"
                ruled
                title="Virtual models (routing strategies)"
                sub={<>Use these as the <C>model</C> parameter for intelligent routing.</>}
              >
                <div className="sd-flow">
                  <div className="sd-tbox">
                    <div className="st-table-wrap">
                      <table className="st-table is-stack sd-t-strat">
                        <thead><tr><th>Model ID</th><th>Strategy</th><th>Description</th></tr></thead>
                        <tbody>
                          {STRATEGIES.map(s => (
                            <tr key={s.id}>
                              <td className="is-head sd-nowrap" data-label="Model ID"><code className="sd-name">{s.id}</code></td>
                              <td className="sd-nowrap" data-label="Strategy"><Tag>{s.cat}</Tag></td>
                              <td className="sd-desc" data-label="Description">{s.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="sd-notes">
                    <p>
                      <strong>Direct pin routing:</strong> Send any real model ID (e.g., <C>claude-opus-5-5</C>, <C>gpt-6-sol</C>, <C>gemini-3.8-flash</C>;{' '}
                      <C>GET /v1/models</C> lists them all) to bypass the strategy router and forward directly to that provider.
                    </p>
                    <p>
                      <strong>Near-top strategies</strong> (<C>auto-value*</C>, <C>auto-consistent</C>, <C>auto-fastest-quality</C>) only choose among models
                      within 5 points of the best model <em>you</em> can use — after your keys, exclusions and limits — so a cheaper, steadier or faster pick
                      is never a much weaker one. Value is measured: the benchmark score divided by what one identical benchmark run actually cost that model,
                      not its list price per token.
                    </p>
                    <p>
                      <strong>Drift-aware routing</strong> (on by default, see Preferences): a model whose drift detector has fired for the skill your strategy
                      relies on, or whose hourly canary is failing, is moved behind every unflagged model. It is never removed — if every candidate is flagged,
                      the best of them is still used — and the routing reason names any model that was passed over and why.
                    </p>
                  </div>
                </div>
              </Pane>

              {/* ── Models ── */}
              <Pane
                id="models"
                ruled
                title={<Endpoint method="GET" path="/v1/models" />}
                sub={<>List available models. Returns virtual <C>auto-*</C> models plus all real models that have been benchmarked. Requires authentication.</>}
              >
                <div className="sd-flow">
                  <CodeBlock samples={one('cURL', 'bash', MODELS_CURL)} />
                  <p className="st-text">Tools like Roo Code, Continue, Open WebUI, and LibreChat call this endpoint to populate their model dropdowns.</p>
                </div>
              </Pane>

              {/* ── Tools, JSON and streaming ── */}
              <Pane id="features" ruled title="Tools, JSON and streaming">
                <div className="sd-flow">
                  <div className="sd-notes">
                    <p>
                      <strong>Tool calling works end to end.</strong> Send OpenAI-format <C>tools</C>; the response carries <C>tool_calls</C> with the
                      provider&apos;s own ids. Send the results back as <C>role: &quot;tool&quot;</C> messages with <C>tool_call_id</C>, exactly as with
                      OpenAI. The router remembers each model&apos;s own turn for 24 hours (Claude&apos;s thinking blocks, OpenAI reasoning items, Gemini
                      thought signatures), so multi-step agent loops keep working, and a tool loop stays on the model that started it.
                    </p>
                    <p>
                      <strong><C>tool_choice</C>:</strong> <C>auto</C> and <C>none</C> work everywhere, and <C>required</C> or a named function works on
                      every model. OpenAI, Gemini, DeepSeek V4 (thinking is switched off for that one request), Kimi K3, and Claude other than Fable 5.1 and
                      Sonnet 5.5 enforce it natively, and routed requests that force a tool go to those first. The rest (Kimi K2.7 Code, GLM-5.3, Claude
                      Fable 5.1 and Sonnet 5.5) cannot be forced by their APIs — GLM-5.3 even accepts the setting and ignores it — so the router asks in words
                      (an instruction for that turn), checks that the answer really is the tool call, retries once, and otherwise falls back or answers{' '}
                      <C>502 tool_choice_not_honoured</C>. It never hands you prose when you forced a tool. Streamed forced calls arrive in one piece
                      (<C>X-AISM-Streaming-Mode: buffered</C>), because the answer is checked before anything is sent.
                    </p>
                    <p>
                      <strong>JSON output:</strong> <C>response_format</C> <C>json_object</C> and <C>json_schema</C> are supported for every provider. The
                      schema is enforced natively by OpenAI, Gemini and the Claude models that support structured output (when every object sets{' '}
                      <C>additionalProperties: false</C>); DeepSeek, Kimi and GLM receive the schema as an instruction in JSON mode.
                    </p>
                    <p>
                      <strong>Streaming</strong> (<C>stream: true</C>) is real: text arrives as the model writes it (<C>X-AISM-Streaming-Mode: native</C>).
                      Tool calls arrive in one chunk each once the model has finished them, then the finish reason, then usage if you set{' '}
                      <C>stream_options.include_usage</C>. If the chosen model fails before sending anything, the next fallback is tried; after the first
                      byte a failure ends the stream with an error event.
                    </p>
                    <p>
                      <strong>Text only, by design.</strong> The router picks a model from our benchmark results for coding, reasoning and tool use; none of
                      those measure image, audio or file understanding, so a request with them gets a 400 <C>unsupported_content</C> rather than a routing
                      decision we cannot back. <C>n</C> must be 1. Requests can be up to 32 MB — about a million tokens of code in context.
                    </p>
                  </div>

                  <h3 className="sd-h3">Rate a response</h3>
                  <p className="st-text">Ratings help routing learn from real use:</p>
                  <CodeBlock samples={one('cURL', 'bash', FEEDBACK_CURL)} />
                  <p className="st-text">
                    Use the <C>id</C> from the completion (also in <C>X-AISM-Request-Id</C>); <C>rating</C> is <C>&quot;up&quot;</C>/<C>1</C> or{' '}
                    <C>&quot;down&quot;</C>/<C>-1</C>. Ratings nudge rankings only slightly, and only once enough have accumulated.
                  </p>
                </div>
              </Pane>

              {/* ── Sandbox and preview ── */}
              <Pane
                id="sandbox"
                ruled
                title="Sandbox and preview"
                sub="Build and test against the router without provider keys, without spending anything, and without using your allowance."
              >
                <div className="sd-flow">
                  <h3 className="sd-h3">Sandbox</h3>
                  <p className="st-text">
                    Send <C>X-ASL-Sandbox: true</C> and the request goes through the real pipeline (authentication, validation, your preferences, the
                    live ranking and fallback chain) but no provider is called. The answer is a deterministic mock in exactly the shape of a real one:
                    the same headers, streaming chunks, tool calls with arguments that fit your schema, JSON that fits your <C>response_format</C>, and
                    usage. It carries <C>X-AISM-Sandbox: true</C>, needs no provider key (routing runs as if you had one for every provider), and counts
                    against no allowance or budget.
                  </p>
                  <CodeBlock samples={SANDBOX_SAMPLES} />
                  <p className="st-text">
                    <C>X-ASL-Sandbox-Simulate</C> makes a sandbox request fail the way a real one can, so your error handling can be tested:{' '}
                    <C>rate_limited</C>, <C>allowance_exhausted</C>, <C>insufficient_quota</C>, <C>provider_key_rejected</C>, <C>model_unavailable</C>,{' '}
                    <C>server_error</C>, or <C>fallback</C> (the first choice fails and the next model answers, as shown in <C>X-AISM-Reasoning</C>).
                  </p>

                  <h3 className="sd-h3"><Endpoint method="POST" path="/v1/route/preview" /></h3>
                  <p className="st-text">
                    Takes the same body as a chat request and returns the routing decision it would get (strategy, model, fallbacks, scores and the
                    reasons) without sending it. Nothing is called or counted. With your real keys it shows what your request will do; with{' '}
                    <C>X-ASL-Sandbox: true</C> it shows what a sandbox request would route to.
                  </p>
                  <CodeBlock samples={one('cURL', 'bash', PREVIEW_CURL)} />
                  <CodeBlock samples={one('JSON', 'json', PREVIEW_RESPONSE)} />

                  <h3 className="sd-h3"><Endpoint method="GET" path="/v1/usage" /></h3>
                  <p className="st-text">
                    This month&apos;s requests used and included in your plan, your prepaid credits, whether a request would be accepted now, and this
                    key&apos;s monthly budget and spend. Free, and not counted.
                  </p>
                  <CodeBlock samples={one('cURL', 'bash', USAGE_CURL)} />
                </div>
              </Pane>

              {/* ── Retries and idempotency ── */}
              <Pane id="reliability" ruled title="Retries and idempotency">
                <div className="sd-flow">
                  <p className="st-text">
                    Send <C>Idempotency-Key</C> (any unique string up to 255 characters) on <C>POST /v1/chat/completions</C> and you can safely retry a
                    request whose response you never received. For 24 hours, the same key from the same account returns the stored response instead
                    of routing again, marked <C>Idempotent-Replayed: true</C>, and is not counted again. The SDKs send one on every non-streaming request.
                  </p>
                  <CodeBlock samples={one('cURL', 'bash', IDEMPOTENCY_CURL)} />
                  <div className="sd-notes">
                    <p>
                      <strong>Only final answers are kept.</strong> A 5xx or a 429 is not stored, so retrying after a failure or a rate limit is a real new
                      attempt. Reusing a key with a different body gets <C>422 idempotency_key_reused</C>; a retry that arrives while the first attempt is
                      still running gets <C>409 idempotency_in_progress</C> with <C>Retry-After</C>. Streams cannot be replayed, so streaming requests
                      ignore the header.
                    </p>
                    <p>
                      <strong><C>x-should-retry</C>.</strong> Error responses that retrying cannot fix (<C>allowance_exhausted</C>,{' '}
                      <C>insufficient_quota</C>, <C>provider_quota_exceeded</C>) carry <C>x-should-retry: false</C>, which the official OpenAI SDKs and ours
                      obey, so a client does not retry them in a loop.
                    </p>
                  </div>
                </div>
              </Pane>

              {/* ── Embeddings ── */}
              <Pane
                id="embeddings"
                ruled
                title={<Endpoint method="POST" path="/v1/embeddings" />}
                sub="Generate embeddings via OpenAI's embedding models. Required by Continue, LibreChat, Open WebUI, and AnythingLLM for RAG features."
              >
                <div className="sd-flow">
                  <CodeBlock samples={one('cURL', 'bash', EMBED_CURL)} />
                  <p className="st-text">
                    Requires an active OpenAI provider key. Supported models: <C>text-embedding-3-small</C> (also <C>auto-embedding</C>),{' '}
                    <C>text-embedding-3-large</C>. Each call counts as one request against your plan, and per-key budgets apply.
                  </p>
                </div>
              </Pane>

              {/* ── Anthropic Messages ── */}
              <Pane
                id="anthropic"
                ruled
                title={<Endpoint method="POST" path="/v1/messages" note="Anthropic" />}
                sub="Native Anthropic Messages API passthrough. Unlocks Claude Code, Cline's Anthropic provider, Roo Code's Anthropic provider, and TypingMind's Anthropic preset."
              >
                <div className="sd-flow">
                  <p className="st-text">
                    Accepts <C>aism_</C> keys via either <C>x-api-key</C> or <C>Authorization: Bearer</C> header. Forwards the <C>anthropic-version</C>{' '}
                    header (defaults to <C>2023-06-01</C>) and any <C>anthropic-beta</C> header as sent. <C>POST /v1/messages/count_tokens</C> is passed
                    through too; it is free at Anthropic, so it is not counted against your plan.
                  </p>

                  <h3 className="sd-h3">Claude Code</h3>
                  <CodeBlock samples={one('Shell', 'bash', CLAUDE_CODE)} />
                  <p className="st-text">
                    There is no routing on this path: the request goes to Anthropic, with your Anthropic key, for the Claude model it names. Your plan
                    allowance, budgets and request logs apply as on the other endpoints.
                  </p>
                  <CodeBlock samples={one('cURL', 'bash', ANTHROPIC_CURL)} />
                  <p className="st-text">Requires an active Anthropic provider key. Returns native Anthropic response format (not OpenAI-translated).</p>
                </div>
              </Pane>

              {/* ── Errors ── */}
              <Pane id="errors" ruled title="Error handling">
                <div className="sd-flow">
                  <div className="sd-tbox">
                    <div className="st-table-wrap">
                      <table className="st-table is-stack sd-t-err sd-errors">
                        <thead>
                          <tr><th>HTTP code</th><th className="sd-th-code">error.type</th><th className="sd-th-code">error.code</th><th>Description</th></tr>
                        </thead>
                        <tbody>
                          {ERRORS.map((er, i) => (
                            <tr key={i}>
                              <td data-label="HTTP code"><Tag tone={er.http >= 500 ? 'bad' : 'warn'}>{er.http}</Tag></td>
                              <td className="is-head" data-label="error.type">
                                {er.type === '—' ? <span className="sd-faint">—</span> : <code className="sd-name">{er.type}</code>}
                              </td>
                              <td className="sd-codes-cell" data-label="error.code">
                                {er.code === '—'
                                  ? <span className="sd-faint">—</span>
                                  : (
                                    <span className="sd-codes">
                                      {er.code.split(' / ').map((c, k) => (
                                        <span key={c}>{k > 0 && <i aria-hidden="true">/ </i>}<code>{c}</code></span>
                                      ))}
                                    </span>
                                  )}
                              </td>
                              <td className="sd-desc" data-label="Description">{er.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <CodeBlock samples={one('JSON', 'json', ERROR_EXAMPLE)} />
                  <p className="st-text">
                    SDKs use <C>error.type</C> and <C>error.code</C> for retry decisions. These match the OpenAI standard.
                  </p>
                </div>
              </Pane>

              {/* ── Integrations ── */}
              <Pane
                id="integrations"
                ruled
                title="Integrations"
                sub={<>The router is an OpenAI-compatible endpoint, so any tool that lets you set a base URL works with it. These are ready-made, or tested settings for the tools people use most.</>}
              >
                <div className="sd-flow">
                  <h3 className="sd-h3">Built in</h3>
                  <dl className="st-kv sd-hdrs">
                    <div><dt><code>n8n-nodes-aistupidlevel</code></dt><dd><strong>n8n.</strong> A node for chat, routing and benchmark data, plus an AI Stupid Level Chat Model for the AI Agent. Install it from Settings → Community Nodes</dd></div>
                    <div><dt><code>@aistupidlevel/mcp</code></dt><dd><strong>MCP server</strong>, listed in the official MCP Registry. Rankings, drift, incidents, route previews and router answers as tools in Claude, Cursor, VS Code and any MCP client</dd></div>
                    <div><dt><code>@aistupidlevel/ai-sdk-provider</code></dt><dd><strong>Vercel AI SDK</strong> provider: <C>generateText</C>, <C>streamText</C> and tools</dd></div>
                    <div><dt>AI Stupid Level</dt><dd><strong>RAGFlow</strong> model provider: pick it under Model providers and paste your router key</dd></div>
                  </dl>
                  <p className="st-text">Use your router key (<C>aism_…</C>) wherever a tool asks for an API key, and a routing mode such as <C>auto-coding</C> as the model (see <a href="#strategies" onClick={e => jump(e, 'strategies')}>Virtual models</a>). The MCP server and the n8n benchmark operations also take a Data API key (<C>asl_live_…</C>), from <Link href="/account/data-keys">Data API keys</Link>.</p>

                  <h3 className="sd-h3">Apps and agents</h3>
                  <CodeBlock samples={APP_INTEGRATIONS} />

                  <h3 className="sd-h3">In code</h3>
                  <CodeBlock samples={INTEGRATIONS} />
                </div>
              </Pane>

              <p className="sd-end">Questions? Check the <Link href="/router/help">Help center</Link></p>
            </div>

            <aside className="sd-rail">
              <nav aria-label="On this page">
                <p className="sd-rail-t">On this page</p>
                <ol>
                  {SECTIONS.map(s => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} aria-current={active === s.id ? 'location' : undefined} onClick={e => jump(e, s.id)}>
                        {s.method && <MethodTag method={s.method} />}
                        <span>{s.label}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
              <div className="sd-rail-foot">
                <Link href="/router/help">Help center</Link>
                <Link href="/router/keys">Create an API key</Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </RouterLayout>
  );
}
