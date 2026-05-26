'use client';

import React, { useState } from 'react';
import RouterLayout from '@/components/RouterLayout';

export default function DocsPage() {
  const [openSection, setOpenSection] = useState<string | null>('overview');
  const [activeTab, setActiveTab] = useState<string>('curl');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const toggle = (s: string) => setOpenSection(openSection === s ? null : s);

  const copyCode = async (code: string, id: string) => {
    try { await navigator.clipboard.writeText(code); setCopiedCode(id); setTimeout(() => setCopiedCode(null), 2000); } catch {}
  };

  return (
    <RouterLayout>
      {/* Header */}
      <div className="rv4-page-header">
        <div className="rv4-page-header-left">
          <span style={{ fontSize: '18px' }}>📖</span>
          <div>
            <div className="rv4-page-title">API DOCUMENTATION<span className="blinking-cursor"></span></div>
            <div className="rv4-page-title-sub">Complete developer reference for the AI Smart Router</div>
          </div>
        </div>
      </div>

      <div className="rv4-body">
        {/* Quick Reference Bar */}
        <div className="rv4-stat-bar cols-4" style={{ borderRadius: '3px', marginBottom: '14px' }}>
          <div className="rv4-stat-cell accent-green">
            <div className="rv4-stat-label">Base URL</div>
            <div className="rv4-stat-value" style={{ fontSize: '10px' }}>https://aistupidlevel.info/v1</div>
          </div>
          <div className="rv4-stat-cell accent-blue">
            <div className="rv4-stat-label">Auth</div>
            <div className="rv4-stat-value blue" style={{ fontSize: '10px' }}>Bearer aism_key</div>
          </div>
          <div className="rv4-stat-cell accent-amber">
            <div className="rv4-stat-label">Format</div>
            <div className="rv4-stat-value amber" style={{ fontSize: '10px' }}>OpenAI-Compatible</div>
          </div>
          <div className="rv4-stat-cell accent-green">
            <div className="rv4-stat-label">Providers</div>
            <div className="rv4-stat-value" style={{ fontSize: '10px' }}>7 (OpenAI, Anthropic, …)</div>
          </div>
        </div>

        {/* Overview */}
        <DocPanel title="📋 API OVERVIEW" isOpen={openSection === 'overview'} onToggle={() => toggle('overview')}>
          <Heading>Introduction</Heading>
          <P>
            The AI Smart Router provides an OpenAI-compatible API that intelligently routes your requests to the best AI model
            based on real-time benchmarks. Use a single <code className="doc-code">aism_</code> key to access models from 7 providers:
            OpenAI, Anthropic, xAI (Grok), Google (Gemini), DeepSeek, Kimi (Moonshot), and GLM (Z.AI).
          </P>
          <Heading>Base URL</Heading>
          <CodeBlock id="base-url" code="https://aistupidlevel.info/v1" lang="text" onCopy={copyCode} copied={copiedCode} />
          <Heading>Authentication</Heading>
          <P>All requests require a Bearer token in the Authorization header:</P>
          <CodeBlock id="auth" code="Authorization: Bearer aism_your_api_key_here" lang="http" onCopy={copyCode} copied={copiedCode} />
          <P>
            Some tools enforce an <code className="doc-code">sk-</code> prefix for API keys. The router accepts <code className="doc-code">sk-aism_...</code> — the prefix is stripped automatically.
          </P>
          <Heading>Endpoints</Heading>
          <div className="rv4-table-wrapper">
            <table className="rv4-table">
              <thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td style={{ color: 'var(--phosphor-green)', fontWeight: 700 }}>POST</td><td className="td-mono">/v1/chat/completions</td><td className="td-dim">Chat completions (auto-routing or direct pin)</td></tr>
                <tr><td style={{ color: 'var(--phosphor-green)', fontWeight: 700 }}>GET</td><td className="td-mono">/v1/models</td><td className="td-dim">List available models (requires auth)</td></tr>
                <tr><td style={{ color: 'var(--phosphor-green)', fontWeight: 700 }}>POST</td><td className="td-mono">/v1/embeddings</td><td className="td-dim">Embeddings (proxied to OpenAI)</td></tr>
                <tr><td style={{ color: 'var(--phosphor-green)', fontWeight: 700 }}>POST</td><td className="td-mono">/v1/messages</td><td className="td-dim">Native Anthropic Messages API passthrough</td></tr>
              </tbody>
            </table>
          </div>
        </DocPanel>

        {/* Chat Completions */}
        <DocPanel title="💬 POST /v1/chat/completions" isOpen={openSection === 'chat'} onToggle={() => toggle('chat')}>
          <P>Create a chat completion. Use an <code className="doc-code">auto-*</code> virtual model for intelligent routing, or a real model ID for direct pin routing.</P>
          
          <Heading>Request Body</Heading>
          <CodeBlock id="chat-body" lang="json" onCopy={copyCode} copied={copiedCode} code={`{
  "model": "auto-coding",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Write a Python fibonacci function"}
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "stream": false
}`} />

          <Heading>Parameters</Heading>
          <div className="rv4-table-wrapper" style={{ marginBottom: '12px' }}>
            <table className="rv4-table">
              <thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
              <tbody>
                {[
                  { n: 'model', t: 'string', r: true, d: '"auto-coding", "auto-reasoning", or a real model ID like "claude-opus-4-7"' },
                  { n: 'messages', t: 'array', r: true, d: 'Array of {role, content} message objects' },
                  { n: 'temperature', t: 'number', r: false, d: 'Sampling temperature (0-2). Default varies by provider.' },
                  { n: 'max_tokens', t: 'number', r: false, d: 'Max tokens to generate. For reasoning models use max_completion_tokens.' },
                  { n: 'max_completion_tokens', t: 'number', r: false, d: 'Max output tokens including reasoning tokens (GPT-5.x, o-series).' },
                  { n: 'stream', t: 'boolean', r: false, d: 'Enable SSE streaming. Default: false.' },
                  { n: 'stream_options', t: 'object', r: false, d: '{ include_usage: true } — emit final usage chunk in SSE.' },
                  { n: 'tools', t: 'array', r: false, d: 'Function tool definitions for tool calling.' },
                  { n: 'tool_choice', t: 'string|object', r: false, d: '"auto", "none", "required", or {type:"function", function:{name}}.' },
                  { n: 'response_format', t: 'object', r: false, d: '{ type: "json_object" } or { type: "json_schema", json_schema: {...} }.' },
                  { n: 'reasoning_effort', t: 'string', r: false, d: '"none"|"minimal"|"low"|"medium"|"high"|"xhigh" — for reasoning models.' },
                  { n: 'top_p', t: 'number', r: false, d: 'Nucleus sampling. Default: 1.' },
                  { n: 'frequency_penalty', t: 'number', r: false, d: 'Frequency penalty (-2 to 2). Not supported by all providers.' },
                  { n: 'presence_penalty', t: 'number', r: false, d: 'Presence penalty (-2 to 2). Not supported by all providers.' },
                  { n: 'stop', t: 'string|array', r: false, d: 'Stop sequences. Not supported by all providers.' },
                  { n: 'seed', t: 'number', r: false, d: 'Random seed for reproducibility.' },
                ].map((p, i) => (
                  <tr key={i}>
                    <td className="td-mono" style={{ color: 'var(--phosphor-green)' }}>{p.n}</td>
                    <td style={{ color: 'var(--amber-warning)' }}>{p.t}</td>
                    <td className="td-dim">{p.r ? 'Yes' : 'No'}</td>
                    <td className="td-dim">{p.d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Heading>Code Examples</Heading>
          <div className="rv4-tabs" style={{ marginBottom: '6px' }}>
            {['curl', 'python', 'node.js'].map(t => (
              <button key={t} className={`rv4-tab${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>{t}</button>
            ))}
          </div>
          {activeTab === 'curl' && <CodeBlock id="ex-curl" lang="bash" onCopy={copyCode} copied={copiedCode} code={`curl -X POST https://aistupidlevel.info/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer aism_your_key_here" \\
  -d '{
    "model": "auto-coding",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`} />}
          {activeTab === 'python' && <CodeBlock id="ex-py" lang="python" onCopy={copyCode} copied={copiedCode} code={`from openai import OpenAI

client = OpenAI(
    api_key="aism_your_key_here",
    base_url="https://aistupidlevel.info/v1"
)

response = client.chat.completions.create(
    model="auto-coding",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`} />}
          {activeTab === 'node.js' && <CodeBlock id="ex-node" lang="typescript" onCopy={copyCode} copied={copiedCode} code={`import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: 'aism_your_key_here',
    baseURL: 'https://aistupidlevel.info/v1'
});

const response = await client.chat.completions.create({
    model: 'auto-coding',
    messages: [{ role: 'user', content: 'Hello!' }]
});
console.log(response.choices[0].message.content);`} />}

          <Heading>Response</Heading>
          <CodeBlock id="chat-resp" lang="json" onCopy={copyCode} copied={copiedCode} code={`{
  "id": "chatcmpl-1748250000000",
  "object": "chat.completion",
  "created": 1748250000,
  "model": "claude-opus-4-7",
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
}`} />
          <P>Response headers include <code className="doc-code">X-AISM-Provider</code>, <code className="doc-code">X-AISM-Model</code>, and <code className="doc-code">X-AISM-Latency</code> for transparency.</P>
        </DocPanel>

        {/* Virtual Models */}
        <DocPanel title="🤖 VIRTUAL MODELS (ROUTING STRATEGIES)" isOpen={openSection === 'strategies'} onToggle={() => toggle('strategies')}>
          <P>Use these as the <code className="doc-code">model</code> parameter for intelligent routing:</P>
          <div className="rv4-table-wrapper">
            <table className="rv4-table">
              <thead><tr><th>Model ID</th><th>Strategy</th><th>Description</th></tr></thead>
              <tbody>
                {[
                  { id: 'auto', cat: 'Default', desc: 'Uses your saved routing strategy from Preferences' },
                  { id: 'auto-coding', cat: 'Coding', desc: 'Best for code generation, debugging, refactoring' },
                  { id: 'auto-reasoning', cat: 'Reasoning', desc: 'Best for complex analysis, math, logic' },
                  { id: 'auto-creative', cat: 'Creative', desc: 'Best for creative writing, brainstorming' },
                  { id: 'auto-cheapest', cat: 'Cost', desc: 'Lowest cost per token while maintaining quality' },
                  { id: 'auto-fastest', cat: 'Speed', desc: 'Lowest latency response time' },
                ].map((s, i) => (
                  <tr key={i}>
                    <td className="td-mono" style={{ color: 'var(--phosphor-green)', fontWeight: 600 }}>{s.id}</td>
                    <td style={{ color: 'var(--amber-warning)' }}>{s.cat}</td>
                    <td className="td-dim">{s.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P style={{ marginTop: '8px' }}>
            <strong>Direct pin routing:</strong> Send any real model ID (e.g., <code className="doc-code">claude-opus-4-7</code>, <code className="doc-code">gpt-5.5</code>, <code className="doc-code">gemini-3.5-flash</code>) to bypass the strategy router and forward directly to that provider.
          </P>
        </DocPanel>

        {/* Models Endpoint */}
        <DocPanel title="📋 GET /v1/models" isOpen={openSection === 'models'} onToggle={() => toggle('models')}>
          <P>List available models. Returns virtual auto-* models plus all real models that have been benchmarked. Requires authentication.</P>
          <CodeBlock id="models-ex" lang="bash" onCopy={copyCode} copied={copiedCode} code={`curl https://aistupidlevel.info/v1/models \\
  -H "Authorization: Bearer aism_your_key_here"`} />
          <P>Tools like Roo Code, Continue, Open WebUI, and LibreChat call this endpoint to populate their model dropdowns.</P>
        </DocPanel>

        {/* Embeddings */}
        <DocPanel title="📐 POST /v1/embeddings" isOpen={openSection === 'embeddings'} onToggle={() => toggle('embeddings')}>
          <P>Generate embeddings via OpenAI's embedding models. Required by Continue, LibreChat, Open WebUI, and AnythingLLM for RAG features.</P>
          <CodeBlock id="embed-ex" lang="bash" onCopy={copyCode} copied={copiedCode} code={`curl -X POST https://aistupidlevel.info/v1/embeddings \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer aism_your_key_here" \\
  -d '{"model": "text-embedding-3-small", "input": "Hello world"}'`} />
          <P>Requires an active OpenAI provider key. Supported models: <code className="doc-code">text-embedding-3-small</code>, <code className="doc-code">text-embedding-3-large</code>.</P>
        </DocPanel>

        {/* Anthropic Messages */}
        <DocPanel title="🔮 POST /v1/messages (Anthropic)" isOpen={openSection === 'anthropic'} onToggle={() => toggle('anthropic')}>
          <P>
            Native Anthropic Messages API passthrough. Unlocks Claude Code, Cline's Anthropic provider, Roo Code's Anthropic provider, and TypingMind's Anthropic preset.
          </P>
          <P>Accepts <code className="doc-code">aism_</code> keys via either <code className="doc-code">x-api-key</code> or <code className="doc-code">Authorization: Bearer</code> header. Forwards <code className="doc-code">anthropic-version</code> header (defaults to <code className="doc-code">2023-06-01</code>).</P>
          <CodeBlock id="anthro-ex" lang="bash" onCopy={copyCode} copied={copiedCode} code={`curl -X POST https://aistupidlevel.info/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: aism_your_key_here" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{
    "model": "claude-opus-4-7",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`} />
          <P>Requires an active Anthropic provider key. Returns native Anthropic response format (not OpenAI-translated).</P>
        </DocPanel>

        {/* Error Handling */}
        <DocPanel title="⚠️ ERROR HANDLING" isOpen={openSection === 'errors'} onToggle={() => toggle('errors')}>
          <div className="rv4-table-wrapper" style={{ marginBottom: '12px' }}>
            <table className="rv4-table">
              <thead><tr><th>HTTP Code</th><th>error.type</th><th>error.code</th><th>Description</th></tr></thead>
              <tbody>
                {[
                  { http: 400, type: 'invalid_request_error', code: 'various', desc: 'Bad request (missing params, unknown model)' },
                  { http: 401, type: 'authentication_error', code: 'invalid_api_key', desc: 'Missing or invalid API key' },
                  { http: 429, type: 'rate_limit_error', code: 'insufficient_quota', desc: 'Budget exceeded or rate limited' },
                  { http: 502, type: 'server_error', code: 'model_unavailable', desc: 'All models failed (check provider keys)' },
                  { http: 500, type: 'server_error', code: 'internal_error', desc: 'Internal server error' },
                ].map((e, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--amber-warning)', fontWeight: 700 }}>{e.http}</td>
                    <td className="td-mono" style={{ color: 'var(--phosphor-green)' }}>{e.type}</td>
                    <td className="td-mono td-dim">{e.code}</td>
                    <td className="td-dim">{e.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CodeBlock id="err-ex" lang="json" onCopy={copyCode} copied={copiedCode} code={`{
  "error": {
    "message": "Invalid API key. Generate a new key at https://aistupidlevel.info/router/keys",
    "type": "authentication_error",
    "code": "invalid_api_key"
  }
}`} />
          <P>SDKs use <code className="doc-code">error.type</code> and <code className="doc-code">error.code</code> for retry decisions. These match the OpenAI standard.</P>
        </DocPanel>

        {/* Integration Examples */}
        <DocPanel title="🔗 INTEGRATION EXAMPLES" isOpen={openSection === 'integrations'} onToggle={() => toggle('integrations')}>
          <Heading>LangChain</Heading>
          <CodeBlock id="int-langchain" lang="python" onCopy={copyCode} copied={copiedCode} code={`from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="auto-coding",
    openai_api_key="aism_your_key_here",
    openai_api_base="https://aistupidlevel.info/v1"
)
response = llm.invoke("Write a Python function")
print(response.content)`} />
          <Heading>Vercel AI SDK</Heading>
          <CodeBlock id="int-vercel" lang="typescript" onCopy={copyCode} copied={copiedCode} code={`import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

const aism = createOpenAI({
  baseURL: 'https://aistupidlevel.info/v1',
  apiKey: 'aism_your_key_here'
});

const { text } = await generateText({
  model: aism('auto-coding'),
  prompt: 'Write a React component'
});`} />
          <Heading>LiteLLM</Heading>
          <CodeBlock id="int-litellm" lang="yaml" onCopy={copyCode} copied={copiedCode} code={`model_list:
  - model_name: aism-auto
    litellm_params:
      model: openai/auto-coding
      api_key: aism_your_key_here
      api_base: https://aistupidlevel.info/v1`} />
        </DocPanel>

        <div className="rv4-footer" style={{ marginTop: '14px' }}>
          Questions? Check the <a href="/router/help" style={{ color: 'var(--phosphor-green)' }}>Help Center</a>
        </div>
      </div>
    </RouterLayout>
  );
}

function DocPanel({ title, isOpen, onToggle, children }: { title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rv4-panel" style={{ marginBottom: '10px' }}>
      <div className="rv4-panel-header" style={{ cursor: 'pointer' }} onClick={onToggle}>
        <span className="rv4-panel-title">{title}</span>
        <span style={{ fontSize: '10px', opacity: 0.6 }}>{isOpen ? '▼' : '▶'}</span>
      </div>
      {isOpen && <div className="rv4-panel-body" style={{ padding: '14px' }}>{children}</div>}
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--phosphor-green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', marginTop: '12px' }}>{children}</div>;
}

function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '10px', ...style }}>{children}</p>;
}

function CodeBlock({ id, code, lang, onCopy, copied }: { id: string; code: string; lang: string; onCopy: (code: string, id: string) => void; copied: string | null }) {
  return (
    <div style={{ marginBottom: '10px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
        <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>{lang}</span>
        <button onClick={() => onCopy(code, id)} style={{
          background: 'none', border: '1px solid var(--border-primary)', borderRadius: '2px',
          color: copied === id ? 'var(--phosphor-green)' : 'var(--text-tertiary)', fontSize: '9px', padding: '2px 8px', cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
        }}>{copied === id ? '✓ COPIED' : 'COPY'}</button>
      </div>
      <pre style={{
        background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '3px',
        padding: '10px 12px', overflow: 'auto', fontFamily: 'var(--font-mono)',
        fontSize: '10.5px', lineHeight: 1.6, color: 'var(--phosphor-green)', margin: 0, whiteSpace: 'pre',
      }}>{code}</pre>
    </div>
  );
}
