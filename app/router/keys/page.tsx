'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import { apiClient } from '@/lib/api-client';
import type { UniversalKey } from '@/lib/api-client';

export default function RouterKeysPage() {
  const { data: session, status } = useSession();
  const [keys, setKeys] = useState<UniversalKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // The models a request can name right now, best first (the router's own ranking table).
  const [lineup, setLineup] = useState<Array<{ name: string; provider: string }>>([]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      apiClient.setUserId(session.user.id);
      fetchKeys();
      apiClient.getAvailableModels().then(r => setLineup((r.models || []).map(m => ({ name: m.name, provider: m.provider })))).catch(() => setLineup([]));
    } else if (status === 'unauthenticated') {
      setError('User authentication required');
      setLoading(false);
    }
  }, [status, session]);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getUniversalKeys();
      setKeys(response.keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      setCreating(true);
      const response = await apiClient.createUniversalKey(newKeyName.trim());
      setCreatedKey(response.key);
      await fetchKeys();
    } catch (err) {
      alert(`Failed to create key: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: number) => {
    if (!confirm('Are you sure you want to revoke this key? This action cannot be undone.')) return;
    try {
      await apiClient.revokeUniversalKey(keyId);
      await fetchKeys();
    } catch (err) {
      alert(`Failed to revoke key: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
    } catch { /* fallback */ }
  };

  const activeKeysCount = keys.filter(k => !k.revoked).length;

  return (
    <RouterLayout>
      <SubscriptionGuard feature="Router API keys" requires="routing">
        {/* Page header */}
        <div className="rv4-page-header">
          <div className="rv4-page-header-left">
            <span style={{ fontSize: '18px' }}>🔑</span>
            <div>
              <div className="rv4-page-title">SMART ROUTER API KEYS<span className="blinking-cursor"></span></div>
              <div className="rv4-page-title-sub">One key that routes your prompts to whichever model is performing best right now</div>
            </div>
          </div>
          <div className="rv4-page-header-right">
            <button onClick={() => setShowCreateModal(true)} className="rv4-ctrl-btn primary">
              + CREATE KEY
            </button>
          </div>
        </div>

        <div className="rv4-body">
          {error && (
            <div className="rv4-error-banner" style={{ marginBottom: '14px' }}>
              <span>⚠</span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 'bold', marginBottom: '2px' }}>ERROR</div><div style={{ fontSize: '10px' }}>{error}</div></div>
              <button onClick={fetchKeys} className="rv4-ctrl-btn danger" style={{ marginLeft: 'auto', fontSize: '10px' }}>RETRY</button>
            </div>
          )}

          {/* About */}
          <div className="rv4-info-banner green" style={{ marginBottom: '14px' }}>
            <span className="rv4-info-banner-icon">ℹ</span>
            <div className="rv4-info-banner-content">
              <div className="rv4-info-banner-title">THIS IS WHERE YOU GET YOUR SMART ROUTER KEY</div>
              <div className="rv4-info-banner-text">
                An <strong>SR key</strong> (<code style={{ fontFamily: 'var(--font-mono)' }}>aism_…</code>) is
                what you put in Cursor, Cline, Aider or your own code in place of an OpenAI or
                Anthropic key. Every request you send through it gets routed to whichever model is
                scoring best on live benchmarks right now, billed through the provider keys you
                connect under <a href="/router/providers" style={{ color: 'var(--phosphor-green)', fontWeight: 'bold' }}>PROVIDERS</a>.
              </div>
            </div>
          </div>

          {/* The two key types get confused constantly — say which is which here,
              on the page people land on first, rather than in a doc nobody opens. */}
          <div className="rv4-info-banner blue" style={{ marginBottom: '14px' }}>
            <span className="rv4-info-banner-icon">↔</span>
            <div className="rv4-info-banner-content">
              <div className="rv4-info-banner-title">LOOKING FOR THE OTHER KIND OF KEY?</div>
              <div className="rv4-info-banner-text">
                SR keys <strong>run inference</strong> and can spend money. If you just want to{' '}
                <strong>read benchmark data</strong> — rankings, drift, degradation alerts — that is a
                separate, free, read-only{' '}
                <a href="/account/data-keys" style={{ color: 'var(--phosphor-green)', fontWeight: 'bold' }}>Data API key</a>{' '}
                (<code style={{ fontFamily: 'var(--font-mono)' }}>asl_live_…</code>). Deliberately
                separate, so a leaked read key can never touch your provider accounts.
              </div>
            </div>
          </div>

          {/* Project keys live on the project page: they follow the project's rules and budget,
              and the project report attributes their spend. Personal keys stay here. */}
          {(session?.user as any)?.workspace && (
            <div className="rv4-info-banner blue" style={{ marginBottom: '14px' }}>
              <span className="rv4-info-banner-icon">⇢</span>
              <div className="rv4-info-banner-content">
                <div className="rv4-info-banner-title">WORKING ON A TEAM PROJECT?</div>
                <div className="rv4-info-banner-text">
                  The keys on this page are yours alone and follow your own Routing Preferences. For work in one of
                  your workspace&rsquo;s projects, make the key on the project&rsquo;s page (<a href="/account/team" style={{ color: 'var(--phosphor-green)', fontWeight: 'bold' }}>Workspace</a> → the
                  project → Smart Router): it follows the project&rsquo;s routing rules, pays with its provider keys,
                  counts against its budget, and shows up in its report.
                </div>
              </div>
            </div>
          )}

          {/* Stat bar */}
          <div className="rv4-stat-bar cols-4" style={{ borderRadius: '3px', marginBottom: '14px' }}>
            <div className="rv4-stat-cell accent-green">
              <div className="rv4-stat-label">Active Keys</div>
              <div className="rv4-stat-value">{loading ? '...' : String(activeKeysCount)}</div>
            </div>
            <div className="rv4-stat-cell accent-amber">
              <div className="rv4-stat-label">Total Keys</div>
              <div className="rv4-stat-value amber">{loading ? '...' : String(keys.length)}</div>
            </div>
            <div className="rv4-stat-cell accent-red">
              <div className="rv4-stat-label">Revoked</div>
              <div className="rv4-stat-value red">{loading ? '...' : String(keys.filter(k => k.revoked).length)}</div>
            </div>
            <div className="rv4-stat-cell accent-blue">
              <div className="rv4-stat-label">Endpoint</div>
              <div className="rv4-stat-value blue" style={{ fontSize: '10px' }}>aistupidlevel.info</div>
            </div>
          </div>

          {/* Keys list */}
          <div className="rv4-panel" style={{ marginBottom: '14px' }}>
            <div className="rv4-panel-header">
              <span className="rv4-panel-title">🔑 YOUR SR API KEYS ({loading ? '...' : `${activeKeysCount} ACTIVE`})</span>
            </div>
            <div className="rv4-panel-body" style={{ padding: 0 }}>
              {loading ? (
                <div className="rv4-loading" style={{ padding: '32px' }}>
                  <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
                  <span>LOADING KEYS</span>
                </div>
              ) : keys.length === 0 ? (
                <div className="rv4-empty" style={{ padding: '40px' }}>
                  <div className="rv4-empty-icon">🔑</div>
                  <div className="rv4-empty-title">No Smart Router Keys</div>
                  <div className="rv4-empty-text">Create your first SR key to start routing prompts to the best-performing model.</div>
                  <button onClick={() => setShowCreateModal(true)} className="rv4-ctrl-btn primary" style={{ marginTop: '10px' }}>
                    + CREATE FIRST KEY
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  {keys.map((key) => (
                    <div key={key.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: '12px', padding: '12px 14px',
                      background: key.revoked ? 'rgba(255,45,0,0.03)' : 'rgba(0,0,0,0.2)',
                      borderLeft: key.revoked ? '3px solid rgba(255,45,0,0.3)' : '3px solid rgba(26, 115, 232,0.2)',
                      flexWrap: 'wrap',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--phosphor-green)' }}>{key.name}</span>
                          {key.revoked
                            ? <span className="rv4-badge red">REVOKED</span>
                            : <span className="rv4-badge green">ACTIVE</span>}
                          {(key as any).department && (
                            <span className="rv4-badge" style={{ fontSize: '8px', background: 'rgba(74,158,255,0.12)', color: '#4a9eff', border: '1px solid rgba(74,158,255,0.3)' }}>
                              {(key as any).department}
                            </span>
                          )}
                          {(key as any).assignedTo && (
                            <span style={{ fontSize: '9px', color: 'var(--phosphor-dim)' }}>→ {(key as any).assignedTo}</span>
                          )}
                          {(key as any).tags?.length > 0 && (key as any).tags.map((tag: string) => (
                            <span key={tag} className="rv4-badge" style={{ fontSize: '8px', background: 'rgba(255,176,0,0.1)', color: 'var(--amber-warning)', border: '1px solid rgba(255,176,0,0.25)' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', fontFamily: 'var(--font-mono)' }}>
                          <span>KEY: {key.keyPrefix}...</span>
                          <span style={{ marginLeft: '12px' }}>CREATED: {new Date(key.createdAt).toLocaleDateString()}</span>
                          {key.lastUsedAt && <span style={{ marginLeft: '12px' }}>LAST USED: {new Date(key.lastUsedAt).toLocaleDateString()}</span>}
                          {(key as any).budgetLimitMonthly && (
                            <span style={{ marginLeft: '12px', color: 'var(--amber-warning)' }}>
                              BUDGET: ${(key as any).currentMonthSpend?.toFixed(4) || '0'} / ${(key as any).budgetLimitMonthly}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        {!key.revoked && (
                          <a
                            href={`/router/monitoring?key=${key.id}&tab=activity`}
                            className="rv4-ctrl-btn"
                            style={{ fontSize: '10px', textDecoration: 'none' }}
                          >
                            VIEW ACTIVITY →
                          </a>
                        )}
                        {!key.revoked && (
                          <button
                            onClick={() => handleRevokeKey(key.id)}
                            className="rv4-ctrl-btn danger"
                            style={{ fontSize: '10px' }}
                          >
                            REVOKE
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Security best practices */}
          <div className="rv4-info-banner amber">
            <span className="rv4-info-banner-icon">⚠</span>
            <div className="rv4-info-banner-content">
              <div className="rv4-info-banner-title">SECURITY BEST PRACTICES</div>
              <div className="rv4-info-banner-text">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {[
                    '[1] Never share your API keys publicly or commit them to version control',
                    '[2] Store keys securely using environment variables or secret management tools',
                    '[3] Revoke keys immediately if you suspect they have been compromised',
                    '[4] Use different keys for different applications or environments',
                  ].map((tip, i) => (
                    <div key={i} style={{ display: 'flex', gap: '6px' }}>
                      <span style={{ color: 'var(--phosphor-green)', flexShrink: 0 }}>{tip.substring(0, 3)}</span>
                      <span>{tip.substring(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* How to Use Your API Key — Setup Guide */}
          <div className="rv4-panel" style={{ marginBottom: '14px' }}>
            <div className="rv4-panel-header" style={{ cursor: 'pointer' }} onClick={() => setShowSetupGuide(!showSetupGuide)}>
              <span className="rv4-panel-title">📖 HOW TO USE YOUR API KEY</span>
              <span style={{ fontSize: '10px', opacity: 0.6 }}>{showSetupGuide ? '▼ COLLAPSE' : '▶ EXPAND'}</span>
            </div>
            {showSetupGuide && (
              <div className="rv4-panel-body" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Quick Start */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--phosphor-green)', marginBottom: '8px', letterSpacing: '0.5px' }}>
                    ⚡ QUICK START
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.5 }}>
                    Use your <code style={{ background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: '2px', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>aism_</code> key anywhere you'd normally put an OpenAI key. Set the base URL to <code style={{ background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: '2px', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>https://aistupidlevel.info/v1</code>
                  </div>
                  <SetupSnippet
                    title="Python (OpenAI SDK)"
                    code={`from openai import OpenAI\nclient = OpenAI(\n    api_key="aism_your_key_here",\n    base_url="https://aistupidlevel.info/v1"\n)\nresponse = client.chat.completions.create(\n    model="auto-coding",\n    messages=[{"role": "user", "content": "Hello!"}]\n)`}
                    copiedSnippet={copiedSnippet}
                    setCopiedSnippet={setCopiedSnippet}
                  />
                  <SetupSnippet
                    title="Node.js / TypeScript"
                    code={`import OpenAI from 'openai';\nconst client = new OpenAI({\n    apiKey: "aism_your_key_here",\n    baseURL: "https://aistupidlevel.info/v1"\n});\nconst response = await client.chat.completions.create({\n    model: "auto-coding",\n    messages: [{ role: "user", content: "Hello!" }]\n});`}
                    copiedSnippet={copiedSnippet}
                    setCopiedSnippet={setCopiedSnippet}
                  />
                  <SetupSnippet
                    title="curl"
                    code={`curl https://aistupidlevel.info/v1/chat/completions \\\n  -H "Authorization: Bearer aism_your_key_here" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "auto", "messages": [{"role": "user", "content": "Hello!"}]}'`}
                    copiedSnippet={copiedSnippet}
                    setCopiedSnippet={setCopiedSnippet}
                  />
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                    <code style={{ fontFamily: 'var(--font-mono)' }}>"auto"</code> follows your{' '}
                    <a href="/router/preferences" style={{ color: 'var(--phosphor-green)', fontWeight: 'bold' }}>Routing Preferences</a>; an{' '}
                    <code style={{ fontFamily: 'var(--font-mono)' }}>auto-*</code> name picks a strategy per request. Streaming
                    (<code style={{ fontFamily: 'var(--font-mono)' }}>stream: true</code>), tool calls (including a forced{' '}
                    <code style={{ fontFamily: 'var(--font-mono)' }}>tool_choice</code>), JSON mode and structured outputs work as in the
                    OpenAI API. Every response says which model answered and why, in the headers{' '}
                    <code style={{ fontFamily: 'var(--font-mono)' }}>X-AISM-Model</code>, <code style={{ fontFamily: 'var(--font-mono)' }}>X-AISM-Provider</code>,{' '}
                    <code style={{ fontFamily: 'var(--font-mono)' }}>X-AISM-Reasoning</code> and <code style={{ fontFamily: 'var(--font-mono)' }}>X-AISM-Request-Id</code>.
                    Text only: requests with images or audio are refused, because nothing we benchmark measures them.
                  </div>
                </div>

                {/* IDE Extensions */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--phosphor-green)', marginBottom: '8px', letterSpacing: '0.5px' }}>
                    🖥️ IDE EXTENSIONS
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.5 }}>
                    For agentic tools that drive a lot of tool calls (Cline, Roo Code, Aider), <code style={{ fontFamily: 'var(--font-mono)' }}>auto-tooling</code> routes
                    on the tool-use benchmark and is usually the better choice than <code style={{ fontFamily: 'var(--font-mono)' }}>auto-coding</code>.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                    <ToolCard
                      name="Roo Code"
                      subtitle="VS Code Extension"
                      steps={[
                        'Open Settings → Extensions → Roo Code',
                        'Select provider: "OpenAI Compatible"',
                        'Base URL: https://aistupidlevel.info/v1',
                        'Paste your aism_ key',
                        'Model dropdown auto-populates'
                      ]}
                    />
                    <ToolCard
                      name="Cline"
                      subtitle="VS Code Extension"
                      steps={[
                        'Open Cline settings → API Configuration',
                        'Select: "OpenAI Compatible"',
                        'Base URL: https://aistupidlevel.info/v1',
                        'Paste your aism_ key',
                        'Type model: auto-coding'
                      ]}
                    />
                    <ToolCard
                      name="Continue"
                      subtitle="VS Code / JetBrains"
                      steps={[
                        'Edit ~/.continue/config.yaml',
                        'provider: openai',
                        'apiBase: https://aistupidlevel.info/v1',
                        'apiKey: aism_your_key_here',
                        'model: auto-coding'
                      ]}
                    />
                    <ToolCard
                      name="Cursor IDE"
                      subtitle="Chat/Plan mode only"
                      steps={[
                        'Settings → Models',
                        'Toggle "Override OpenAI Base URL"',
                        'URL: https://aistupidlevel.info/v1',
                        'Paste key in OpenAI API Key field',
                        '+ Add Model → auto-coding'
                      ]}
                    />
                    <ToolCard
                      name="Claude Code"
                      subtitle="Anthropic CLI (uses /v1/messages)"
                      steps={[
                        'export ANTHROPIC_BASE_URL="https://aistupidlevel.info"',
                        'export ANTHROPIC_API_KEY="aism_your_key_here"',
                        'Run claude as usual',
                        'Goes to Anthropic with your Anthropic key (no routing between providers); allowance, budgets and logs still apply'
                      ]}
                    />
                  </div>
                </div>

                {/* CLI & Desktop Apps */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--phosphor-green)', marginBottom: '8px', letterSpacing: '0.5px' }}>
                    💻 CLI TOOLS & DESKTOP APPS
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                    <ToolCard
                      name="Aider"
                      subtitle="CLI Agent"
                      steps={[
                        'export OPENAI_API_BASE="https://aistupidlevel.info/v1"',
                        'export OPENAI_API_KEY="aism_your_key_here"',
                        'aider --model openai/auto-coding',
                        '(openai/ prefix is required)'
                      ]}
                    />
                    <ToolCard
                      name="Open WebUI"
                      subtitle="Self-hosted UI"
                      steps={[
                        'Admin → Settings → Connections → OpenAI',
                        'Click "+ Add Connection"',
                        'URL: https://aistupidlevel.info/v1',
                        'Paste your aism_ key',
                        'Models auto-populate'
                      ]}
                    />
                    <ToolCard
                      name="Chatbox"
                      subtitle="Desktop App"
                      steps={[
                        'Settings → API Provider → OpenAI API',
                        'API Host: https://aistupidlevel.info',
                        '(No /v1 — Chatbox adds it)',
                        'Paste your aism_ key'
                      ]}
                    />
                    <ToolCard
                      name="TypingMind"
                      subtitle="Web App"
                      steps={[
                        'Settings → Add Custom Model',
                        'Full URL: https://aistupidlevel.info/v1/chat/completions',
                        'Header: Bearer aism_your_key_here',
                        'Model ID: auto-coding'
                      ]}
                    />
                  </div>
                </div>

                {/* Available Models */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--phosphor-green)', marginBottom: '8px', letterSpacing: '0.5px' }}>
                    🤖 AVAILABLE VIRTUAL MODELS
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px' }}>
                    {[
                      { id: 'auto', desc: 'Your saved Routing Preferences' },
                      { id: 'auto-best', desc: 'Best overall (coding, reasoning and tool use)' },
                      { id: 'auto-coding', desc: 'Best on the coding benchmark' },
                      { id: 'auto-reasoning', desc: 'Best on the reasoning benchmark' },
                      { id: 'auto-tooling', desc: 'Best on the tool-use benchmark (alias: auto-agentic)' },
                      { id: 'auto-value', desc: 'Most points per dollar among near-top models' },
                      { id: 'auto-value-coding', desc: 'Best value on the coding benchmark' },
                      { id: 'auto-value-reasoning', desc: 'Best value on the reasoning benchmark' },
                      { id: 'auto-value-tooling', desc: 'Best value on the tool-use benchmark' },
                      { id: 'auto-consistent', desc: 'Steadiest near-top model' },
                      { id: 'auto-fastest-quality', desc: 'Fastest model near the top' },
                      { id: 'auto-task', desc: 'Coding, reasoning or tool use, judged from each request' },
                      { id: 'auto-split', desc: 'Your own weighted traffic split (Preferences)' },
                      { id: 'auto-cheapest', desc: 'Lowest list price, no quality bar' },
                      { id: 'auto-fastest', desc: 'Lowest measured latency, no quality bar' },
                    ].map(m => (
                      <div key={m.id} style={{
                        background: 'var(--bg-tertiary)', borderRadius: '3px', padding: '8px 10px',
                        border: '1px solid var(--border-primary)'
                      }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--phosphor-green)' }}>{m.id}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{m.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '10px', lineHeight: 1.6 }}>
                    Or name a model to skip routing: the request goes to that model only, with no fallback. The models you
                    can name right now{lineup.length ? ', best first:' : ' are listed by GET /v1/models.'}
                  </div>
                  {lineup.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: '6px' }}>
                      {lineup.map(m => (
                        <code key={m.name} title={m.provider} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--phosphor-green)' }}>{m.name}</code>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                    <code style={{ fontFamily: 'var(--font-mono)' }}>GET /v1/models</code> returns the same list, and is what most tools use to fill their model dropdown.
                  </div>
                </div>

                {/* Endpoints */}
                <div className="rv4-info-banner green">
                  <span className="rv4-info-banner-icon">🔗</span>
                  <div className="rv4-info-banner-content">
                    <div className="rv4-info-banner-title">API ENDPOINTS</div>
                    <div className="rv4-info-banner-text" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {[
                        ['POST /v1/chat/completions', 'OpenAI-compatible chat: routed (auto, auto-*) or a named model; streaming, tools, JSON'],
                        ['GET /v1/models', 'The auto-* strategies and every model you can name'],
                        ['POST /v1/messages', 'Anthropic Messages API, sent straight to Anthropic with your Anthropic key (Claude Code)'],
                        ['POST /v1/messages/count_tokens', 'Anthropic\u2019s token counter (free; not counted against your plan)'],
                        ['POST /v1/embeddings', 'OpenAI embeddings: text-embedding-3-small (or auto-embedding) and -large'],
                        ['POST /v1/router/feedback', 'Rate an answer up or down by its completion id; ratings nudge routing'],
                        ['POST /v1/explain', 'Which model “auto” would pick for a prompt, without sending it'],
                        ['POST /v1/compare', 'What every strategy would pick for a prompt'],
                        ['POST /v1/analyze', 'How the router classifies a prompt (task, language, complexity)'],
                      ].map(([ep, what]) => (
                        <div key={ep}><code style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{ep}</code> — {what}</div>
                      ))}
                      <div style={{ marginTop: '4px' }}>
                        Everything accepts the key as <code style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>Authorization: Bearer aism_…</code>
                        {' '}(<code style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>x-api-key</code> too, on the Anthropic routes).{' '}
                        <a href="/router/docs" style={{ color: 'var(--phosphor-green)', fontWeight: 'bold' }}>Full API reference →</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create Key Modal */}
        {showCreateModal && (
          <div className="rv4-modal-backdrop" onClick={() => { if (!creating) { setShowCreateModal(false); setNewKeyName(''); setCreatedKey(null); } }}>
            <div className="rv4-modal" onClick={(e) => e.stopPropagation()}>
              <div className="rv4-modal-header">
                <span className="rv4-modal-title">🔑 CREATE NEW SR API KEY</span>
                <button className="rv4-modal-close" onClick={() => { if (!creating) { setShowCreateModal(false); setNewKeyName(''); setCreatedKey(null); } }}>✕ CLOSE</button>
              </div>
              <div className="rv4-modal-body">
                {!createdKey ? (
                  <>
                    <div className="rv4-form-group">
                      <label className="rv4-input-label">KEY NAME</label>
                      <input
                        type="text"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && newKeyName.trim() && !creating) handleCreateKey(); }}
                        placeholder="e.g., My MacBook, Production Server"
                        className="rv4-input"
                        disabled={creating}
                        autoFocus
                      />
                      <div className="rv4-input-hint">Give your key a descriptive name to identify it later</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                      <button onClick={() => { setShowCreateModal(false); setNewKeyName(''); }} disabled={creating} className="rv4-ctrl-btn">
                        CANCEL
                      </button>
                      <button onClick={handleCreateKey} disabled={!newKeyName.trim() || creating} className="rv4-ctrl-btn primary">
                        {creating ? 'CREATING...' : 'CREATE KEY'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rv4-success-banner" style={{ marginBottom: '14px' }}>
                      <span>✓</span>
                      <div>
                        <strong>KEY CREATED SUCCESSFULLY!</strong>
                        <div style={{ fontSize: '10px', fontWeight: 'normal', opacity: 0.8, marginTop: '2px' }}>Copy your key now — you won't be able to see it again!</div>
                      </div>
                    </div>
                    <div className="rv4-form-group">
                      <label className="rv4-input-label">YOUR API KEY</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input type="text" value={createdKey} readOnly className="rv4-input" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }} />
                        <button onClick={() => handleCopyKey(createdKey)} className="rv4-ctrl-btn primary" style={{ flexShrink: 0 }}>COPY</button>
                      </div>
                    </div>
                    <div className="rv4-info-banner amber" style={{ marginBottom: '14px' }}>
                      <span className="rv4-info-banner-icon">⚠</span>
                      <div className="rv4-info-banner-content">
                        <div className="rv4-info-banner-title">IMPORTANT</div>
                        <div className="rv4-info-banner-text">Store this key securely. We cannot show it again after you close this dialog.</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => { setShowCreateModal(false); setCreatedKey(null); setNewKeyName(''); }} className="rv4-ctrl-btn primary">
                        DONE
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </SubscriptionGuard>
    </RouterLayout>
  );
}

/** Code snippet with copy button for the setup guide */
function SetupSnippet({ title, code, copiedSnippet, setCopiedSnippet }: {
  title: string; code: string;
  copiedSnippet: string | null; setCopiedSnippet: (v: string | null) => void;
}) {
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(code); setCopiedSnippet(title); setTimeout(() => setCopiedSnippet(null), 2000); } catch {}
  };
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</span>
        <button onClick={handleCopy} className="rv4-ctrl-btn" style={{ fontSize: '9px', padding: '2px 8px' }}>
          {copiedSnippet === title ? '✓ COPIED' : 'COPY'}
        </button>
      </div>
      <pre style={{
        background: 'var(--bg-tertiary)', borderRadius: '3px', padding: '10px 12px',
        fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--phosphor-green)',
        overflowX: 'auto', whiteSpace: 'pre', border: '1px solid var(--border-primary)',
        lineHeight: 1.5, margin: 0,
      }}>{code}</pre>
    </div>
  );
}

/** Tool setup card for the setup guide */
function ToolCard({ name, subtitle, steps }: { name: string; subtitle: string; steps: string[] }) {
  return (
    <div style={{
      background: 'var(--bg-tertiary)', borderRadius: '3px', padding: '10px 12px',
      border: '1px solid var(--border-primary)',
    }}>
      <div style={{ fontWeight: 700, fontSize: '11px', color: 'var(--text-primary)' }}>{name}</div>
      <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>{subtitle}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {steps.map((step, i) => (
          <div key={i} style={{ fontSize: '9.5px', color: 'var(--text-secondary)', display: 'flex', gap: '5px' }}>
            <span style={{ color: 'var(--phosphor-green)', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
            <span style={{ fontFamily: step.startsWith('export ') || step.startsWith('aider') || step.startsWith('(') ? 'var(--font-mono)' : 'inherit' }}>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
