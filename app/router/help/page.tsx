'use client';

import { useState } from 'react';
import RouterLayout from '@/components/RouterLayout';

export default function HelpPage() {
  const [openSection, setOpenSection] = useState<string | null>('getting-started');
  const toggle = (s: string) => setOpenSection(openSection === s ? null : s);

  return (
    <RouterLayout>
      {/* Header */}
      <div className="rv4-page-header">
        <div className="rv4-page-header-left">
          <span style={{ fontSize: '18px' }}>❓</span>
          <div>
            <div className="rv4-page-title">HELP CENTER<span className="blinking-cursor"></span></div>
            <div className="rv4-page-title-sub">Everything you need to know about the AI Smart Router</div>
          </div>
        </div>
      </div>

      <div className="rv4-body">
        {/* Quick Links */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', marginBottom: '14px' }}>
          {[
            { href: '/router/keys', icon: '🔑', label: 'Create API Key' },
            { href: '/router/providers', icon: '🔌', label: 'Add Providers' },
            { href: '/router/docs', icon: '📖', label: 'API Docs' },
            { href: '/router/monitoring', icon: '📊', label: 'Monitoring' },
            { href: '/router/analytics', icon: '📈', label: 'Analytics' },
            { href: '/router/preferences', icon: '⚙️', label: 'Preferences' },
          ].map(link => (
            <a key={link.href} href={link.href} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', textDecoration: 'none',
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: '3px',
              color: 'var(--phosphor-green)', fontSize: '11px', fontWeight: 600, transition: 'border-color 0.2s',
            }}>
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </a>
          ))}
        </div>

        {/* Getting Started */}
        <HelpPanel title="🚀 GETTING STARTED" isOpen={openSection === 'getting-started'} onToggle={() => toggle('getting-started')}>
          <h4 style={{ color: 'var(--phosphor-green)', fontSize: '11px', margin: '0 0 8px 0' }}>What is the AI Smart Router?</h4>
          <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '14px' }}>
            The AI Smart Router is an intelligent API gateway that automatically selects the best AI model for your requests.
            Instead of manually choosing between Claude, GPT, Gemini, Grok, DeepSeek, Kimi, or GLM, our system continuously benchmarks
            all models and routes your requests to the optimal one based on performance, cost, and your preferences.
          </p>

          <h4 style={{ color: 'var(--phosphor-green)', fontSize: '11px', margin: '0 0 8px 0' }}>Quick Start (5 Minutes)</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
            <StepCard step={1} title="Create a Universal API Key">
              Go to <a href="/router/keys" style={{ color: 'var(--phosphor-green)' }}>API Keys</a> → Click "Create Key" → Copy and save it securely. Your key starts with <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--phosphor-green)' }}>aism_</code>
            </StepCard>
            <StepCard step={2} title="Add Provider API Keys">
              Go to <a href="/router/providers" style={{ color: 'var(--phosphor-green)' }}>Providers</a> → Add keys for OpenAI, Anthropic, Google, xAI, DeepSeek, Kimi, or GLM. The more providers you add, the better the routing!
            </StepCard>
            <StepCard step={3} title="Configure Your Tool">
              Use your <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--phosphor-green)' }}>aism_</code> key with any OpenAI-compatible tool:
              <div style={{ marginTop: '6px' }}>
                <code style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--phosphor-green)', background: 'var(--bg-primary)', padding: '6px 8px', borderRadius: '2px', lineHeight: 1.6 }}>
                  Base URL: https://aistupidlevel.info/v1<br/>
                  API Key: aism_your_key_here<br/>
                  Model: auto-coding (or auto, auto-reasoning, etc.)
                </code>
              </div>
            </StepCard>
          </div>
        </HelpPanel>

        {/* Using with Tools */}
        <HelpPanel title="🖥️ SETTING UP YOUR IDE / TOOL" isOpen={openSection === 'tools'} onToggle={() => toggle('tools')}>
          <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
            Your <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--phosphor-green)' }}>aism_</code> key works with any tool that supports custom OpenAI base URLs. For detailed setup instructions with copy-paste configs, visit the <a href="/router/keys" style={{ color: 'var(--phosphor-green)' }}>API Keys page</a> and expand "How to Use Your API Key".
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {[
              { name: 'Roo Code', how: 'Settings → "OpenAI Compatible" → paste Base URL + Key' },
              { name: 'Cline', how: 'Settings → "OpenAI Compatible" → paste Base URL + Key' },
              { name: 'Continue', how: 'Edit config.yaml → provider: openai + apiBase + apiKey' },
              { name: 'Cursor IDE', how: 'Settings → Override OpenAI Base URL (chat/plan mode only)' },
              { name: 'Aider', how: 'Set OPENAI_API_BASE + OPENAI_API_KEY env vars' },
              { name: 'Open WebUI', how: 'Admin → Connections → OpenAI → Add Connection' },
              { name: 'Chatbox', how: 'API Host: https://aistupidlevel.info (no /v1)' },
              { name: 'TypingMind', how: 'Full endpoint URL per model + Bearer header' },
              { name: 'Jan.ai', how: 'OpenAI extension → paste URL + Key' },
              { name: 'LibreChat', how: 'librechat.yaml custom endpoint with fetch: true' },
              { name: 'AnythingLLM', how: 'Generic OpenAI provider → Base URL + Key' },
              { name: 'LiteLLM', how: 'litellm-config.yaml → openai/auto-coding' },
            ].map(t => (
              <div key={t.name} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: '3px', padding: '8px 10px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>{t.name}</div>
                <div style={{ fontSize: '9.5px', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{t.how}</div>
              </div>
            ))}
          </div>
          <div className="rv4-info-banner amber" style={{ marginTop: '12px' }}>
            <span className="rv4-info-banner-icon">⚠</span>
            <div className="rv4-info-banner-content">
              <div className="rv4-info-banner-title">KNOWN LIMITATIONS</div>
              <div className="rv4-info-banner-text">
                <strong>Cursor:</strong> Only chat/plan mode uses your base URL — Composer, inline edit, and autocomplete are locked to Cursor's backend.<br/>
                <strong>Windsurf:</strong> Cascade is locked to Codeium's backend. Install Roo Code or Cline inside Windsurf instead.
              </div>
            </div>
          </div>
        </HelpPanel>

        {/* Virtual Models */}
        <HelpPanel title="🤖 ROUTING STRATEGIES (VIRTUAL MODELS)" isOpen={openSection === 'strategies'} onToggle={() => toggle('strategies')}>
          <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
            Use these as the <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--phosphor-green)' }}>model</code> parameter. The router picks the best real model based on live benchmarks.
          </p>
          <div className="rv4-table-wrapper">
            <table className="rv4-table">
              <thead><tr><th>Model ID</th><th>Strategy</th><th>Best For</th></tr></thead>
              <tbody>
                {[
                  { id: 'auto', strategy: 'Saved Preference', use: 'Uses your configured default strategy' },
                  { id: 'auto-coding', strategy: 'Best Coding', use: 'Code generation, debugging, refactoring' },
                  { id: 'auto-reasoning', strategy: 'Best Reasoning', use: 'Complex analysis, math, logic puzzles' },
                  { id: 'auto-creative', strategy: 'Best Creative', use: 'Creative writing, brainstorming, content' },
                  { id: 'auto-cheapest', strategy: 'Lowest Cost', use: 'High-volume tasks, budget-conscious usage' },
                  { id: 'auto-fastest', strategy: 'Lowest Latency', use: 'Real-time apps, chatbots, quick queries' },
                ].map(s => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--phosphor-green)', fontWeight: 600 }}>{s.id}</td>
                    <td style={{ color: 'var(--amber-warning)' }}>{s.strategy}</td>
                    <td style={{ color: 'var(--text-tertiary)' }}>{s.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '9.5px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
            You can also pin specific models (e.g., <code style={{ fontFamily: 'var(--font-mono)' }}>claude-opus-4-7</code>, <code style={{ fontFamily: 'var(--font-mono)' }}>gpt-5.5</code>, <code style={{ fontFamily: 'var(--font-mono)' }}>gemini-3.5-flash</code>) to bypass routing entirely.
          </p>
        </HelpPanel>

        {/* Monitoring */}
        <HelpPanel title="📊 MONITORING & BUDGETS" isOpen={openSection === 'monitoring'} onToggle={() => toggle('monitoring')}>
          <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
            The <a href="/router/monitoring" style={{ color: 'var(--phosphor-green)' }}>Monitoring page</a> provides per-key activity tracking, cost dashboards, prompt auditing, and budget management.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { label: 'Key Activity', desc: 'Per-request log with provider, model, cost, latency, and category' },
              { label: 'Cost Dashboard', desc: 'Daily/weekly/monthly spend breakdown by model and provider' },
              { label: 'Prompt Audit', desc: 'Encrypted prompt logging with PII scrubbing (opt-in)' },
              { label: 'Budgets & Alerts', desc: 'Monthly spend limits (soft warnings + hard enforcement) per key' },
              { label: 'Efficiency Report', desc: 'Success rates, category distribution, avg cost per request' },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', gap: '8px', fontSize: '10.5px' }}>
                <span style={{ color: 'var(--phosphor-green)', fontWeight: 700, flexShrink: 0, width: '120px' }}>{f.label}:</span>
                <span style={{ color: 'var(--text-tertiary)' }}>{f.desc}</span>
              </div>
            ))}
          </div>
        </HelpPanel>

        {/* FAQ */}
        <HelpPanel title="💬 FREQUENTLY ASKED QUESTIONS" isOpen={openSection === 'faq'} onToggle={() => toggle('faq')}>
          {[
            { q: 'How much does it cost?', a: 'The router itself is free. You pay only for actual API usage via your provider keys. Intelligent routing typically saves 30-60% compared to always using the most expensive model.' },
            { q: 'Is my data secure?', a: 'Provider keys are encrypted at rest with HKDF-derived subkeys. Prompt logging (opt-in) uses separate encryption domains. PII is automatically scrubbed before storage.' },
            { q: 'What happens if a model fails?', a: 'Automatic failover: if the primary model fails, the router tries up to 2 fallbacks from different providers. Configure fallback behavior in Preferences.' },
            { q: 'Does streaming work?', a: 'Yes — set stream: true. Streaming is currently simulated (sentence-level chunking). True token-level streaming is a future enhancement.' },
            { q: 'How often are benchmarks updated?', a: 'Continuous 24/7 benchmarking. Model rankings update in real-time as new results arrive.' },
            { q: 'Can I use a specific model directly?', a: 'Yes — send any real model ID (e.g., "claude-opus-4-7", "gpt-5.5") instead of an auto-* strategy. The router forwards directly to that provider.' },
            { q: 'Which providers are supported?', a: 'OpenAI, Anthropic, xAI (Grok), Google (Gemini), DeepSeek, Kimi (Moonshot), and GLM (Z.AI). Add as many as you like.' },
            { q: 'Does it work with embeddings?', a: 'Yes — POST /v1/embeddings proxies to OpenAI embedding models. Required by Continue, LibreChat, and Open WebUI for RAG.' },
          ].map((faq, i) => (
            <div key={i} style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--amber-warning)', marginBottom: '4px' }}>Q: {faq.q}</div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)', lineHeight: 1.5, paddingLeft: '14px' }}>A: {faq.a}</div>
            </div>
          ))}
        </HelpPanel>

        {/* Troubleshooting */}
        <HelpPanel title="🔧 TROUBLESHOOTING" isOpen={openSection === 'troubleshooting'} onToggle={() => toggle('troubleshooting')}>
          {[
            { problem: '401 Unauthorized', fix: 'Check your aism_ key is correct and not revoked. Include it as "Authorization: Bearer aism_..." header. Some tools also accept sk-aism_ prefix.' },
            { problem: 'No models in dropdown', fix: 'Your tool calls GET /v1/models — this requires a valid aism_ key. Check that auth is configured correctly.' },
            { problem: 'Model not found', fix: 'If using a specific model ID, check spelling. Direct pin routing infers the provider from the model name prefix.' },
            { problem: 'High costs', fix: 'Set budget limits in Monitoring → Budgets. Use auto-cheapest strategy. Check Analytics for cost patterns.' },
            { problem: 'Slow responses', fix: 'Use auto-fastest strategy. Set latency limits in Preferences. Enable streaming for better perceived speed.' },
            { problem: 'Provider key validation failed', fix: 'Re-check the key on the provider\'s dashboard. Ensure it has active credits and correct permissions.' },
            { problem: 'CORS errors in browser', fix: 'The /v1/* endpoints allow all origins. If you see CORS errors, check that your tool is using the correct base URL.' },
          ].map((t, i) => (
            <div key={i} style={{ marginBottom: '10px', padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: '3px', border: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--red-alert)', marginBottom: '3px' }}>⚠ {t.problem}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{t.fix}</div>
            </div>
          ))}
        </HelpPanel>

        <div className="rv4-footer" style={{ marginTop: '14px' }}>
          Need more detail? Check the <a href="/router/docs" style={{ color: 'var(--phosphor-green)' }}>API Documentation</a>
        </div>
      </div>
    </RouterLayout>
  );
}

function HelpPanel({ title, isOpen, onToggle, children }: { title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode }) {
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

function StepCard({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '10px', padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: '3px', border: '1px solid var(--border-primary)' }}>
      <span style={{ color: 'var(--phosphor-green)', fontWeight: 700, fontSize: '14px', flexShrink: 0, width: '22px', textAlign: 'center' }}>{step}</span>
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>{title}</div>
        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{children}</div>
      </div>
    </div>
  );
}
