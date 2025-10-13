'use client';

import React, { useState } from 'react';
import RouterLayout from '@/components/RouterLayout';
import PixelIcon from '@/components/PixelIcon';

export default function DocsPage() {
  const [openSection, setOpenSection] = useState<string | null>('overview');
  const [activeTab, setActiveTab] = useState<string>('curl');

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <RouterLayout>
      <div className="vintage-container">
        {/* Header */}
        <div className="dashboard-header" style={{ marginBottom: '30px' }}>
          <div>
            <h1 className="dashboard-title">
              <span className="terminal-text--green">API DOCUMENTATION</span>
              <span className="blinking-cursor"></span>
            </h1>
            <p className="dashboard-subtitle terminal-text--dim">
              Complete developer reference for AI Router API
            </p>
          </div>
        </div>

        {/* Quick Reference */}
        <div className="section-card" style={{ marginBottom: '20px' }}>
          <div className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PixelIcon name="lightning" size={20} />
            QUICK REFERENCE
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
            <QuickRefCard
              label="Base URL"
              value="https://aistupidlevel.info"
              icon="globe"
            />
            <QuickRefCard
              label="Authentication"
              value="Bearer aism_your_key"
              icon="key"
            />
            <QuickRefCard
              label="Format"
              value="OpenAI-Compatible JSON"
              icon="code"
            />
            <QuickRefCard
              label="Rate Limit"
              value="Based on provider limits"
              icon="clock"
            />
          </div>
        </div>

        {/* Main Documentation */}
        <div className="docs-content">
          
          {/* API Overview */}
          <DocsSection
            id="overview"
            title="API OVERVIEW"
            icon="book"
            isOpen={openSection === 'overview'}
            onToggle={() => toggleSection('overview')}
          >
            <div className="docs-section-content">
              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px' }}>Introduction</h3>
              <p className="terminal-text--dim" style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                AI Router provides an OpenAI-compatible API that intelligently routes your requests to the best AI model 
                based on real-time benchmarks. Use a single API key to access 20+ models from OpenAI, Anthropic, Google, and xAI.
              </p>

              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px', marginTop: '20px' }}>Base URL</h3>
              <CodeBlock language="bash">
                https://aistupidlevel.info
              </CodeBlock>

              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px', marginTop: '20px' }}>Authentication</h3>
              <p className="terminal-text--dim" style={{ marginBottom: '10px', lineHeight: '1.6' }}>
                All API requests require authentication using your universal API key in the Authorization header:
              </p>
              <CodeBlock language="bash">
                Authorization: Bearer aism_your_api_key_here
              </CodeBlock>

              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px', marginTop: '20px' }}>Response Format</h3>
              <p className="terminal-text--dim" style={{ marginBottom: '10px', lineHeight: '1.6' }}>
                All responses are in JSON format, following OpenAI's API specification. Errors return standard HTTP status codes with descriptive messages.
              </p>
            </div>
          </DocsSection>

          {/* Chat Completions */}
          <DocsSection
            id="chat-completions"
            title="CHAT COMPLETIONS"
            icon="chat"
            isOpen={openSection === 'chat-completions'}
            onToggle={() => toggleSection('chat-completions')}
          >
            <div className="docs-section-content">
              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px' }}>POST /v1/chat/completions</h3>
              <p className="terminal-text--dim" style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                Create a chat completion. The router will automatically select the best model based on your specified routing strategy.
              </p>

              <h4 className="terminal-text--amber" style={{ fontSize: '0.95em', marginBottom: '10px', marginTop: '20px' }}>Request Body</h4>
              <CodeBlock language="json">
{`{
  "model": "best_for_coding",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "Write a Python function to calculate fibonacci"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "stream": false
}`}
              </CodeBlock>

              <h4 className="terminal-text--amber" style={{ fontSize: '0.95em', marginBottom: '10px', marginTop: '20px' }}>Parameters</h4>
              <ParamTable params={[
                { name: 'model', type: 'string', required: true, description: 'Routing strategy (e.g., "best_for_coding") or specific model name' },
                { name: 'messages', type: 'array', required: true, description: 'Array of message objects with role and content' },
                { name: 'temperature', type: 'number', required: false, description: 'Sampling temperature (0-2). Default: 0.7' },
                { name: 'max_tokens', type: 'number', required: false, description: 'Maximum tokens to generate. Default: model-specific' },
                { name: 'stream', type: 'boolean', required: false, description: 'Enable streaming responses. Default: false' },
                { name: 'top_p', type: 'number', required: false, description: 'Nucleus sampling parameter (0-1)' },
                { name: 'frequency_penalty', type: 'number', required: false, description: 'Penalize frequent tokens (-2 to 2)' },
                { name: 'presence_penalty', type: 'number', required: false, description: 'Penalize new tokens (-2 to 2)' },
              ]} />

              <h4 className="terminal-text--amber" style={{ fontSize: '0.95em', marginBottom: '10px', marginTop: '20px' }}>Response</h4>
              <CodeBlock language="json">
{`{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1699999999,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "def fibonacci(n):\\n    if n <= 1:\\n        return n\\n    return fibonacci(n-1) + fibonacci(n-2)"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 50,
    "total_tokens": 75
  }
}`}
              </CodeBlock>

              <h4 className="terminal-text--amber" style={{ fontSize: '0.95em', marginBottom: '10px', marginTop: '20px' }}>Code Examples</h4>
              <CodeTabs activeTab={activeTab} setActiveTab={setActiveTab}>
                <CodeTab id="curl" label="cURL">
{`curl -X POST https://aistupidlevel.info/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer aism_your_key_here" \\
  -d '{
    "model": "best_for_coding",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`}
                </CodeTab>
                <CodeTab id="python" label="Python">
{`from openai import OpenAI

client = OpenAI(
    api_key="aism_your_key_here",
    base_url="https://aistupidlevel.info/v1"
)

response = client.chat.completions.create(
    model="best_for_coding",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)`}
                </CodeTab>
                <CodeTab id="nodejs" label="Node.js">
{`import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: 'aism_your_key_here',
    baseURL: 'https://aistupidlevel.info/v1'
});

const response = await client.chat.completions.create({
    model: 'best_for_coding',
    messages: [
        { role: 'user', content: 'Hello!' }
    ]
});

console.log(response.choices[0].message.content);`}
                </CodeTab>
              </CodeTabs>

              <h4 className="terminal-text--amber" style={{ fontSize: '0.95em', marginBottom: '10px', marginTop: '20px' }}>Streaming</h4>
              <p className="terminal-text--dim" style={{ marginBottom: '10px', lineHeight: '1.6' }}>
                Enable streaming by setting <code className="terminal-text--green">stream: true</code>. The response will be sent as Server-Sent Events (SSE).
              </p>
              <CodeBlock language="python">
{`stream = client.chat.completions.create(
    model="best_for_coding",
    messages=[{"role": "user", "content": "Write a story"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")`}
              </CodeBlock>
            </div>
          </DocsSection>

          {/* List Models */}
          <DocsSection
            id="list-models"
            title="LIST MODELS"
            icon="list"
            isOpen={openSection === 'list-models'}
            onToggle={() => toggleSection('list-models')}
          >
            <div className="docs-section-content">
              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px' }}>GET /v1/models</h3>
              <p className="terminal-text--dim" style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                List all available models and routing strategies.
              </p>

              <h4 className="terminal-text--amber" style={{ fontSize: '0.95em', marginBottom: '10px', marginTop: '20px' }}>Request</h4>
              <CodeBlock language="bash">
{`curl https://aistupidlevel.info/v1/models \\
  -H "Authorization: Bearer aism_your_key_here"`}
              </CodeBlock>

              <h4 className="terminal-text--amber" style={{ fontSize: '0.95em', marginBottom: '10px', marginTop: '20px' }}>Response</h4>
              <CodeBlock language="json">
{`{
  "object": "list",
  "data": [
    {
      "id": "best_overall",
      "object": "model",
      "created": 1699999999,
      "owned_by": "ai-router"
    },
    {
      "id": "best_for_coding",
      "object": "model",
      "created": 1699999999,
      "owned_by": "ai-router"
    },
    {
      "id": "gpt-4o",
      "object": "model",
      "created": 1699999999,
      "owned_by": "openai"
    }
  ]
}`}
              </CodeBlock>
            </div>
          </DocsSection>

          {/* Routing Strategies */}
          <DocsSection
            id="routing-strategies"
            title="ROUTING STRATEGIES"
            icon="target"
            isOpen={openSection === 'routing-strategies'}
            onToggle={() => toggleSection('routing-strategies')}
          >
            <div className="docs-section-content">
              <p className="terminal-text--dim" style={{ marginBottom: '20px', lineHeight: '1.6' }}>
                Use these routing strategies as the <code className="terminal-text--green">model</code> parameter to enable intelligent routing:
              </p>

              <RoutingStrategyTable strategies={[
                { name: 'best_overall', description: 'Best general-purpose model across all categories', category: 'General' },
                { name: 'best_for_coding', description: 'Optimized for code generation and debugging', category: 'Coding' },
                { name: 'best_for_reasoning', description: 'Best for complex problem-solving and logic', category: 'Reasoning' },
                { name: 'best_for_creative', description: 'Optimized for creative writing and ideas', category: 'Creative' },
                { name: 'fastest', description: 'Prioritizes speed over other factors', category: 'Performance' },
                { name: 'cheapest', description: 'Most cost-effective while maintaining quality', category: 'Cost' },
              ]} />

              <p className="terminal-text--dim" style={{ marginTop: '20px', lineHeight: '1.6' }}>
                You can also specify exact model names (e.g., <code className="terminal-text--green">gpt-4o</code>, <code className="terminal-text--green">claude-3-5-sonnet-20241022</code>) 
                to bypass routing and use a specific model.
              </p>
            </div>
          </DocsSection>

          {/* Key Management API */}
          <DocsSection
            id="key-management"
            title="KEY MANAGEMENT API"
            icon="key"
            isOpen={openSection === 'key-management'}
            onToggle={() => toggleSection('key-management')}
          >
            <div className="docs-section-content">
              <p className="terminal-text--dim" style={{ marginBottom: '20px', lineHeight: '1.6' }}>
                Manage your universal API keys and provider keys programmatically. All endpoints require the <code className="terminal-text--green">x-user-id</code> header.
              </p>

              <EndpointCard
                method="GET"
                path="/router/keys"
                description="List all universal API keys"
                example={`curl https://aistupidlevel.info/router/keys \\
  -H "x-user-id: YOUR_USER_ID"`}
              />

              <EndpointCard
                method="POST"
                path="/router/keys"
                description="Create a new universal API key"
                example={`curl -X POST https://aistupidlevel.info/router/keys \\
  -H "x-user-id: YOUR_USER_ID" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My App Key"}'`}
              />

              <EndpointCard
                method="DELETE"
                path="/router/keys/:id"
                description="Revoke a universal API key"
                example={`curl -X DELETE https://aistupidlevel.info/router/keys/123 \\
  -H "x-user-id: YOUR_USER_ID"`}
              />

              <EndpointCard
                method="GET"
                path="/router/provider-keys"
                description="List all provider API keys"
                example={`curl https://aistupidlevel.info/router/provider-keys \\
  -H "x-user-id: YOUR_USER_ID"`}
              />

              <EndpointCard
                method="POST"
                path="/router/provider-keys"
                description="Add a provider API key"
                example={`curl -X POST https://aistupidlevel.info/router/provider-keys \\
  -H "x-user-id: YOUR_USER_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "openai",
    "apiKey": "sk-..."
  }'`}
              />

              <EndpointCard
                method="POST"
                path="/router/provider-keys/:id/validate"
                description="Validate a provider API key"
                example={`curl -X POST https://aistupidlevel.info/router/provider-keys/123/validate \\
  -H "x-user-id: YOUR_USER_ID"`}
              />
            </div>
          </DocsSection>

          {/* Analytics API */}
          <DocsSection
            id="analytics"
            title="ANALYTICS API"
            icon="analytics"
            isOpen={openSection === 'analytics'}
            onToggle={() => toggleSection('analytics')}
          >
            <div className="docs-section-content">
              <p className="terminal-text--dim" style={{ marginBottom: '20px', lineHeight: '1.6' }}>
                Access detailed analytics about your API usage, costs, and performance.
              </p>

              <EndpointCard
                method="GET"
                path="/router/analytics/overview"
                description="Get overview statistics"
                example={`curl https://aistupidlevel.info/router/analytics/overview \\
  -H "x-user-id: YOUR_USER_ID"`}
                response={`{
  "overview": {
    "totalRequests": 1250,
    "successRate": "98.40",
    "totalTokens": 125000,
    "totalCost": "12.50"
  },
  "providers": [...],
  "topModels": [...]
}`}
              />

              <EndpointCard
                method="GET"
                path="/router/analytics/cost-savings"
                description="Calculate cost savings vs worst case"
                example={`curl https://aistupidlevel.info/router/analytics/cost-savings \\
  -H "x-user-id: YOUR_USER_ID"`}
                response={`{
  "actualCost": "12.50",
  "worstCaseCost": "35.20",
  "savings": "22.70",
  "savingsPercentage": "64.49"
}`}
              />

              <EndpointCard
                method="GET"
                path="/router/analytics/recent-requests"
                description="Get recent request history"
                example={`curl https://aistupidlevel.info/router/analytics/recent-requests?limit=10 \\
  -H "x-user-id: YOUR_USER_ID"`}
              />

              <EndpointCard
                method="GET"
                path="/router/analytics/model-performance"
                description="Get performance metrics per model"
                example={`curl https://aistupidlevel.info/router/analytics/model-performance \\
  -H "x-user-id: YOUR_USER_ID"`}
              />
            </div>
          </DocsSection>

          {/* Error Handling */}
          <DocsSection
            id="errors"
            title="ERROR HANDLING"
            icon="warning"
            isOpen={openSection === 'errors'}
            onToggle={() => toggleSection('errors')}
          >
            <div className="docs-section-content">
              <p className="terminal-text--dim" style={{ marginBottom: '20px', lineHeight: '1.6' }}>
                The API uses standard HTTP status codes and returns error details in JSON format.
              </p>

              <ErrorCodeTable errors={[
                { code: 200, status: 'OK', description: 'Request successful' },
                { code: 400, status: 'Bad Request', description: 'Invalid request parameters' },
                { code: 401, status: 'Unauthorized', description: 'Invalid or missing API key' },
                { code: 404, status: 'Not Found', description: 'Resource not found' },
                { code: 429, status: 'Too Many Requests', description: 'Rate limit exceeded' },
                { code: 500, status: 'Internal Server Error', description: 'Server error occurred' },
              ]} />

              <h4 className="terminal-text--amber" style={{ fontSize: '0.95em', marginBottom: '10px', marginTop: '20px' }}>Error Response Format</h4>
              <CodeBlock language="json">
{`{
  "error": {
    "message": "Invalid API key provided",
    "type": "invalid_request_error",
    "code": "invalid_api_key"
  }
}`}
              </CodeBlock>
            </div>
          </DocsSection>

          {/* Integration Examples */}
          <DocsSection
            id="integrations"
            title="INTEGRATION EXAMPLES"
            icon="plug"
            isOpen={openSection === 'integrations'}
            onToggle={() => toggleSection('integrations')}
          >
            <div className="docs-section-content">
              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px' }}>LangChain</h3>
              <CodeBlock language="python">
{`from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="best_for_coding",
    openai_api_key="aism_your_key_here",
    openai_api_base="https://aistupidlevel.info/v1"
)

response = llm.invoke("Write a Python function")
print(response.content)`}
              </CodeBlock>

              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px', marginTop: '20px' }}>LlamaIndex</h3>
              <CodeBlock language="python">
{`from llama_index.llms.openai import OpenAI

llm = OpenAI(
    model="best_for_coding",
    api_key="aism_your_key_here",
    api_base="https://aistupidlevel.info/v1"
)

response = llm.complete("Explain quantum computing")
print(response.text)`}
              </CodeBlock>

              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px', marginTop: '20px' }}>Vercel AI SDK</h3>
              <CodeBlock language="typescript">
{`import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const customProvider = openai.provider({
  baseURL: 'https://aistupidlevel.info/v1',
  apiKey: 'aism_your_key_here'
});

const { text } = await generateText({
  model: customProvider('best_for_coding'),
  prompt: 'Write a React component'
});

console.log(text);`}
              </CodeBlock>
            </div>
          </DocsSection>

        </div>

        {/* Footer */}
        <div className="dashboard-footer" style={{ marginTop: '40px' }}>
          <div className="terminal-text--dim">
            Questions? Check the <a href="/router/help" className="footer-link">Help Center</a> or contact support
          </div>
        </div>
      </div>

      <style jsx>{`
        .docs-content {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .docs-section-content {
          padding: 20px;
          line-height: 1.6;
        }

        code {
          background: rgba(0, 255, 65, 0.1);
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
          font-size: 0.9em;
        }
      `}</style>
    </RouterLayout>
  );
}

// Collapsible Section Component
function DocsSection({ 
  id, 
  title, 
  icon, 
  isOpen, 
  onToggle, 
  children 
}: { 
  id: string; 
  title: string; 
  icon: string; 
  isOpen: boolean; 
  onToggle: () => void; 
  children: React.ReactNode;
}) {
  return (
    <div className="section-card">
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '15px 20px',
          cursor: 'pointer',
          borderBottom: isOpen ? '1px solid rgba(0, 255, 65, 0.3)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <PixelIcon name={icon} size={24} />
          <span className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
            {title}
          </span>
        </div>
        <span className="terminal-text--green" style={{ fontSize: '1.2em' }}>
          {isOpen ? '−' : '+'}
        </span>
      </div>
      {isOpen && children}
    </div>
  );
}

// Quick Reference Card
function QuickRefCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div style={{
      padding: '15px',
      background: 'rgba(0, 255, 65, 0.05)',
      border: '1px solid rgba(0, 255, 65, 0.3)',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      <PixelIcon name={icon} size={24} />
      <div>
        <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginBottom: '4px' }}>{label}</div>
        <div className="terminal-text--green" style={{ fontSize: '0.9em', fontFamily: 'monospace' }}>{value}</div>
      </div>
    </div>
  );
}

// Code Block Component
function CodeBlock({ language, children }: { language: string; children: string }) {
  return (
    <div style={{ marginBottom: '15px' }}>
      <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginBottom: '5px' }}>{language}</div>
      <pre style={{
        background: 'rgba(0, 255, 65, 0.05)',
        border: '1px solid rgba(0, 255, 65, 0.3)',
        borderRadius: '4px',
        padding: '15px',
        overflow: 'auto',
        fontFamily: 'Courier New, monospace',
        fontSize: '0.85em',
        lineHeight: '1.5',
        color: 'var(--phosphor-green)',
      }}>
        {children}
      </pre>
    </div>
  );
}

// Code Tabs Component
function CodeTabs({ activeTab, setActiveTab, children }: { activeTab: string; setActiveTab: (tab: string) => void; children: React.ReactNode }) {
  const tabs = React.Children.toArray(children) as React.ReactElement[];
  
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', borderBottom: '1px solid rgba(0, 255, 65, 0.3)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.props.id}
            onClick={() => setActiveTab(tab.props.id)}
            style={{
              background: activeTab === tab.props.id ? 'rgba(0, 255, 65, 0.1)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.props.id ? '2px solid var(--phosphor-green)' : '2px solid transparent',
              color: activeTab === tab.props.id ? 'var(--phosphor-green)' : 'var(--metal-silver)',
              padding: '10px 15px',
              cursor: 'pointer',
              fontSize: '0.9em',
              fontWeight: activeTab === tab.props.id ? 'bold' : 'normal',
            }}
          >
            {tab.props.label}
          </button>
        ))}
      </div>
      {tabs.find(tab => tab.props.id === activeTab)}
    </div>
  );
}

function CodeTab({ id, label, children }: { id: string; label: string; children: string }) {
  return (
    <CodeBlock language={label.toLowerCase()}>
      {children}
    </CodeBlock>
  );
}

// Parameter Table
function ParamTable({ params }: { params: Array<{ name: string; type: string; required: boolean; description: string }> }) {
  return (
    <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(0, 255, 65, 0.3)' }}>
            <th className="terminal-text--green" style={{ textAlign: 'left', padding: '10px' }}>Parameter</th>
            <th className="terminal-text--green" style={{ textAlign: 'left', padding: '10px' }}>Type</th>
            <th className="terminal-text--green" style={{ textAlign: 'left', padding: '10px' }}>Required</th>
            <th className="terminal-text--green" style={{ textAlign: 'left', padding: '10px' }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((param, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(0, 255, 65, 0.1)' }}>
              <td className="terminal-text--green" style={{ padding: '10px', fontFamily: 'monospace' }}>{param.name}</td>
              <td className="terminal-text--amber" style={{ padding: '10px' }}>{param.type}</td>
              <td className="terminal-text--dim" style={{ padding: '10px' }}>{param.required ? 'Yes' : 'No'}</td>
              <td className="terminal-text--dim" style={{ padding: '10px' }}>{param.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Routing Strategy Table
function RoutingStrategyTable({ strategies }: { strategies: Array<{ name: string; description: string; category: string }> }) {
  return (
    <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(0, 255, 65, 0.3)' }}>
            <th className="terminal-text--green" style={{ textAlign: 'left', padding: '10px' }}>Strategy</th>
            <th className="terminal-text--green" style={{ textAlign: 'left', padding: '10px' }}>Category</th>
            <th className="terminal-text--green" style={{ textAlign: 'left', padding: '10px' }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {strategies.map((strategy, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(0, 255, 65, 0.1)' }}>
              <td className="terminal-text--green" style={{ padding: '10px', fontFamily: 'monospace' }}>{strategy.name}</td>
              <td className="terminal-text--amber" style={{ padding: '10px' }}>{strategy.category}</td>
              <td className="terminal-text--dim" style={{ padding: '10px' }}>{strategy.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Endpoint Card
function EndpointCard({ method, path, description, example, response }: { method: string; path: string; description: string; example: string; response?: string }) {
  const methodColor = method === 'GET' ? 'var(--phosphor-green)' : method === 'POST' ? 'var(--terminal-amber)' : 'var(--terminal-red)';
  
  return (
    <div style={{
      marginBottom: '20px',
      padding: '15px',
      background: 'rgba(0, 255, 65, 0.05)',
      border: '1px solid rgba(0, 255, 65, 0.3)',
      borderRadius: '4px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <span style={{ 
          color: methodColor, 
          fontWeight: 'bold', 
          fontSize: '0.9em',
          padding: '4px 8px',
          background: 'rgba(0, 255, 65, 0.1)',
          borderRadius: '3px',
        }}>
          {method}
        </span>
        <span className="terminal-text--green" style={{ fontFamily: 'monospace', fontSize: '0.95em' }}>{path}</span>
      </div>
      <p className="terminal-text--dim" style={{ marginBottom: '10px', fontSize: '0.9em' }}>{description}</p>
      <CodeBlock language="bash">{example}</CodeBlock>
      {response && (
        <>
          <div className="terminal-text--amber" style={{ fontSize: '0.9em', marginTop: '10px', marginBottom: '5px' }}>Response:</div>
          <CodeBlock language="json">{response}</CodeBlock>
        </>
      )}
    </div>
  );
}

// Error Code Table
function ErrorCodeTable({ errors }: { errors: Array<{ code: number; status: string; description: string }> }) {
  return (
    <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(0, 255, 65, 0.3)' }}>
            <th className="terminal-text--green" style={{ textAlign: 'left', padding: '10px' }}>Code</th>
            <th className="terminal-text--green" style={{ textAlign: 'left', padding: '10px' }}>Status</th>
            <th className="terminal-text--green" style={{ textAlign: 'left', padding: '10px' }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((error, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(0, 255, 65, 0.1)' }}>
              <td className="terminal-text--amber" style={{ padding: '10px', fontWeight: 'bold' }}>{error.code}</td>
              <td className="terminal-text--green" style={{ padding: '10px' }}>{error.status}</td>
              <td className="terminal-text--dim" style={{ padding: '10px' }}>{error.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
