'use client';

import React, { useState } from 'react';
import RouterLayout from '@/components/RouterLayout';

export default function DocsPage() {
  const [openSection, setOpenSection] = useState<string | null>('overview');
  const [activeTab, setActiveTab] = useState<string>('curl');

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <RouterLayout>
      {/* Page header */}
      <div className="rv4-page-header">
        <div className="rv4-page-header-left">
          <div>
            <div className="rv4-page-title">API DOCUMENTATION<span className="blinking-cursor"></span></div>
            <div className="rv4-page-title-sub">Complete developer reference for AI Router API</div>
          </div>
        </div>
      </div>

      <div className="rv4-body">
        {/* Quick Reference */}
        <div className="rv4-stat-bar cols-4" style={{ borderRadius: '3px', marginBottom: '14px' }}>
          <div className="rv4-stat-cell accent-green">
            <div className="rv4-stat-label">Base URL</div>
            <div className="rv4-stat-value" style={{ fontSize: '10px', letterSpacing: '0.3px' }}>aistupidlevel.info</div>
          </div>
          <div className="rv4-stat-cell accent-blue">
            <div className="rv4-stat-label">Authentication</div>
            <div className="rv4-stat-value blue" style={{ fontSize: '10px' }}>Bearer aism_key</div>
          </div>
          <div className="rv4-stat-cell accent-amber">
            <div className="rv4-stat-label">Format</div>
            <div className="rv4-stat-value amber" style={{ fontSize: '10px' }}>OpenAI-Compatible</div>
          </div>
          <div className="rv4-stat-cell accent-green">
            <div className="rv4-stat-label">Rate Limit</div>
            <div className="rv4-stat-value" style={{ fontSize: '10px' }}>Provider limits</div>
          </div>
        </div>

        {/* API Overview */}
        <DocsSection id="overview" title="API OVERVIEW" isOpen={openSection === 'overview'} onToggle={() => toggleSection('overview')}>
          <div className="rv4-panel-body">
            <SectionHeading>Introduction</SectionHeading>
            <p style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.6', marginBottom: '14px' }}>
              AI Router provides an OpenAI-compatible API that intelligently routes your requests to the best AI model
              based on real-time benchmarks. Use a single API key to access 20+ models from OpenAI, Anthropic, Google, and xAI.
            </p>
            <SectionHeading>Base URL</SectionHeading>
            <CodeBlock language="bash">https://aistupidlevel.info</CodeBlock>
            <SectionHeading>Authentication</SectionHeading>
            <p style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.6', marginBottom: '8px' }}>
              All API requests require authentication using your universal API key in the Authorization header:
            </p>
            <CodeBlock language="bash">Authorization: Bearer aism_your_api_key_here</CodeBlock>
          </div>
        </DocsSection>

        {/* Chat Completions */}
        <DocsSection id="chat-completions" title="CHAT COMPLETIONS" isOpen={openSection === 'chat-completions'} onToggle={() => toggleSection('chat-completions')}>
          <div className="rv4-panel-body">
            <SectionHeading>POST /v1/chat/completions</SectionHeading>
            <p style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.6', marginBottom: '14px' }}>
              Create a chat completion. The router will automatically select the best model based on your routing strategy.
            </p>
            <SubHeading>Request Body</SubHeading>
            <CodeBlock language="json">{`{
  "model": "best_for_coding",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Write a Python function to calculate fibonacci"}
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "stream": false
}`}</CodeBlock>
            <SubHeading>Parameters</SubHeading>
            <ParamTable params={[
              { name: 'model', type: 'string', required: true, description: 'Routing strategy (e.g., "best_for_coding") or specific model name' },
              { name: 'messages', type: 'array', required: true, description: 'Array of message objects with role and content' },
              { name: 'temperature', type: 'number', required: false, description: 'Sampling temperature (0-2). Default: 0.7' },
              { name: 'max_tokens', type: 'number', required: false, description: 'Maximum tokens to generate. Default: model-specific' },
              { name: 'stream', type: 'boolean', required: false, description: 'Enable streaming responses. Default: false' },
            ]} />
            <SubHeading>Code Examples</SubHeading>
            <CodeTabs activeTab={activeTab} setActiveTab={setActiveTab}>
              <CodeTab id="curl" label="curl">{`curl -X POST https://aistupidlevel.info/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer aism_your_key_here" \\
  -d '{"model": "best_for_coding", "messages": [{"role": "user", "content": "Hello!"}]}'`}</CodeTab>
              <CodeTab id="python" label="python">{`from openai import OpenAI

client = OpenAI(
    api_key="aism_your_key_here",
    base_url="https://aistupidlevel.info/v1"
)

response = client.chat.completions.create(
    model="best_for_coding",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`}</CodeTab>
              <CodeTab id="nodejs" label="node.js">{`import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: 'aism_your_key_here',
    baseURL: 'https://aistupidlevel.info/v1'
});

const response = await client.chat.completions.create({
    model: 'best_for_coding',
    messages: [{ role: 'user', content: 'Hello!' }]
});
console.log(response.choices[0].message.content);`}</CodeTab>
            </CodeTabs>
          </div>
        </DocsSection>

        {/* Routing Strategies */}
        <DocsSection id="routing-strategies" title="ROUTING STRATEGIES" isOpen={openSection === 'routing-strategies'} onToggle={() => toggleSection('routing-strategies')}>
          <div className="rv4-panel-body">
            <p style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.6', marginBottom: '14px' }}>
              Use these routing strategies as the <code style={{ background: 'rgba(0,255,65,0.1)', padding: '1px 5px', borderRadius: '2px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--phosphor-green)' }}>model</code> parameter to enable intelligent routing:
            </p>
            <div className="rv4-table-wrapper">
              <table className="rv4-table">
                <thead>
                  <tr>
                    <th>Strategy</th>
                    <th>Category</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'best_overall', category: 'General', desc: 'Best general-purpose model across all categories' },
                    { name: 'best_for_coding', category: 'Coding', desc: 'Optimized for code generation and debugging' },
                    { name: 'best_for_reasoning', category: 'Reasoning', desc: 'Best for complex problem-solving and logic' },
                    { name: 'best_for_creative', category: 'Creative', desc: 'Optimized for creative writing and ideas' },
                    { name: 'fastest', category: 'Performance', desc: 'Prioritizes speed over other factors' },
                    { name: 'cheapest', category: 'Cost', desc: 'Most cost-effective while maintaining quality' },
                  ].map((s, i) => (
                    <tr key={i}>
                      <td className="td-green td-mono">{s.name}</td>
                      <td className="td-amber">{s.category}</td>
                      <td className="td-dim">{s.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DocsSection>

        {/* Key Management API */}
        <DocsSection id="key-management" title="KEY MANAGEMENT API" isOpen={openSection === 'key-management'} onToggle={() => toggleSection('key-management')}>
          <div className="rv4-panel-body">
            <p style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.6', marginBottom: '14px' }}>
              Manage your universal API keys and provider keys programmatically. All endpoints require the <code style={{ background: 'rgba(0,255,65,0.1)', padding: '1px 5px', borderRadius: '2px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--phosphor-green)' }}>x-user-id</code> header.
            </p>
            {[
              { method: 'GET', path: '/router/keys', desc: 'List all universal API keys', example: 'curl https://aistupidlevel.info/router/keys \\\n  -H "x-user-id: YOUR_USER_ID"' },
              { method: 'POST', path: '/router/keys', desc: 'Create a new universal API key', example: 'curl -X POST https://aistupidlevel.info/router/keys \\\n  -H "x-user-id: YOUR_USER_ID" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"name": "My App Key"}\'' },
              { method: 'DELETE', path: '/router/keys/:id', desc: 'Revoke a universal API key', example: 'curl -X DELETE https://aistupidlevel.info/router/keys/123 \\\n  -H "x-user-id: YOUR_USER_ID"' },
            ].map((ep, i) => (
              <EndpointCard key={i} {...ep} />
            ))}
          </div>
        </DocsSection>

        {/* Analytics API */}
        <DocsSection id="analytics" title="ANALYTICS API" isOpen={openSection === 'analytics'} onToggle={() => toggleSection('analytics')}>
          <div className="rv4-panel-body">
            <p style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.6', marginBottom: '14px' }}>
              Access detailed analytics about your API usage, costs, and performance.
            </p>
            {[
              { method: 'GET', path: '/router/analytics/overview', desc: 'Get overview statistics', example: 'curl https://aistupidlevel.info/router/analytics/overview \\\n  -H "x-user-id: YOUR_USER_ID"' },
              { method: 'GET', path: '/router/analytics/cost-savings', desc: 'Calculate cost savings vs worst case', example: 'curl https://aistupidlevel.info/router/analytics/cost-savings \\\n  -H "x-user-id: YOUR_USER_ID"' },
              { method: 'GET', path: '/router/analytics/recent-requests', desc: 'Get recent request history', example: 'curl https://aistupidlevel.info/router/analytics/recent-requests?limit=10 \\\n  -H "x-user-id: YOUR_USER_ID"' },
            ].map((ep, i) => (
              <EndpointCard key={i} {...ep} />
            ))}
          </div>
        </DocsSection>

        {/* Error Handling */}
        <DocsSection id="errors" title="ERROR HANDLING" isOpen={openSection === 'errors'} onToggle={() => toggleSection('errors')}>
          <div className="rv4-panel-body">
            <div className="rv4-table-wrapper" style={{ marginBottom: '14px' }}>
              <table className="rv4-table">
                <thead>
                  <tr><th>Code</th><th>Status</th><th>Description</th></tr>
                </thead>
                <tbody>
                  {[
                    { code: 200, status: 'OK', desc: 'Request successful' },
                    { code: 400, status: 'Bad Request', desc: 'Invalid request parameters' },
                    { code: 401, status: 'Unauthorized', desc: 'Invalid or missing API key' },
                    { code: 429, status: 'Too Many Requests', desc: 'Rate limit exceeded' },
                    { code: 500, status: 'Internal Server Error', desc: 'Server error occurred' },
                  ].map((e, i) => (
                    <tr key={i}>
                      <td className="td-amber" style={{ fontWeight: 'bold' }}>{e.code}</td>
                      <td className="td-green">{e.status}</td>
                      <td className="td-dim">{e.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CodeBlock language="json">{`{
  "error": {
    "message": "Invalid API key provided",
    "type": "invalid_request_error",
    "code": "invalid_api_key"
  }
}`}</CodeBlock>
          </div>
        </DocsSection>

        {/* Integration Examples */}
        <DocsSection id="integrations" title="INTEGRATION EXAMPLES" isOpen={openSection === 'integrations'} onToggle={() => toggleSection('integrations')}>
          <div className="rv4-panel-body">
            <SectionHeading>LangChain</SectionHeading>
            <CodeBlock language="python">{`from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="best_for_coding",
    openai_api_key="aism_your_key_here",
    openai_api_base="https://aistupidlevel.info/v1"
)

response = llm.invoke("Write a Python function")
print(response.content)`}</CodeBlock>
            <SectionHeading>Vercel AI SDK</SectionHeading>
            <CodeBlock language="typescript">{`import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const customProvider = openai.provider({
  baseURL: 'https://aistupidlevel.info/v1',
  apiKey: 'aism_your_key_here'
});

const { text } = await generateText({
  model: customProvider('best_for_coding'),
  prompt: 'Write a React component'
});`}</CodeBlock>
          </div>
        </DocsSection>

        <div className="rv4-footer">
          Questions? Check the <a href="/router/help">Help Center</a> or contact support
        </div>
      </div>
    </RouterLayout>
  );
}

function DocsSection({ id, title, isOpen, onToggle, children }: { id: string; title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rv4-panel" style={{ marginBottom: '10px' }}>
      <div
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', cursor: 'pointer' }}
      >
        <span className="rv4-panel-title">{title}</span>
        <span style={{ color: 'var(--phosphor-green)', fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 'bold' }}>
          {isOpen ? '−' : '+'}
        </span>
      </div>
      {isOpen && children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', marginTop: '12px' }}>{children}</div>;
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--amber-warning)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', marginTop: '12px' }}>{children}</div>;
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '9px', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>{language}</div>
      <pre style={{
        background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,255,65,0.15)', borderRadius: '3px',
        padding: '12px 14px', overflow: 'auto', fontFamily: 'var(--font-mono)',
        fontSize: '11px', lineHeight: '1.6', color: 'var(--phosphor-green)', margin: 0,
      }}>
        {children}
      </pre>
    </div>
  );
}

function CodeTabs({ activeTab, setActiveTab, children }: { activeTab: string; setActiveTab: (tab: string) => void; children: React.ReactNode }) {
  const tabs = React.Children.toArray(children) as React.ReactElement[];
  return (
    <div style={{ marginBottom: '14px' }}>
      <div className="rv4-tabs" style={{ marginBottom: '0' }}>
        {tabs.map((tab) => (
          <button key={tab.props.id} onClick={() => setActiveTab(tab.props.id)}
            className={`rv4-tab${activeTab === tab.props.id ? ' active' : ''}`}>
            {tab.props.label}
          </button>
        ))}
      </div>
      {tabs.find(tab => tab.props.id === activeTab)}
    </div>
  );
}

function CodeTab({ id, label, children }: { id: string; label: string; children: string }) {
  return <CodeBlock language={label}>{children}</CodeBlock>;
}

function ParamTable({ params }: { params: Array<{ name: string; type: string; required: boolean; description: string }> }) {
  return (
    <div className="rv4-table-wrapper" style={{ marginBottom: '12px' }}>
      <table className="rv4-table">
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Type</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={i}>
              <td className="td-green td-mono">{p.name}</td>
              <td className="td-amber">{p.type}</td>
              <td className="td-dim">{p.required ? 'Yes' : 'No'}</td>
              <td className="td-dim">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EndpointCard({ method, path, desc, example }: { method: string; path: string; desc: string; example: string }) {
  const methodColor = method === 'GET' ? 'var(--phosphor-green)' : method === 'POST' ? 'var(--amber-warning)' : 'var(--red-alert)';
  return (
    <div style={{ marginBottom: '14px', padding: '12px 14px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(0,255,65,0.12)', borderRadius: '3px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <span style={{ color: methodColor, fontWeight: 'bold', fontSize: '10px', padding: '3px 8px', background: 'rgba(0,255,65,0.08)', borderRadius: '2px', fontFamily: 'var(--font-mono)' }}>{method}</span>
        <span style={{ color: 'var(--phosphor-green)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{path}</span>
      </div>
      <p style={{ fontSize: '10px', color: 'var(--phosphor-dim)', marginBottom: '8px' }}>{desc}</p>
      <CodeBlock language="bash">{example}</CodeBlock>
    </div>
  );
}
