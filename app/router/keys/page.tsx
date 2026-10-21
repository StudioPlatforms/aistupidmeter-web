'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import { apiClient } from '@/lib/api-client';
import type { UniversalKey } from '@/lib/api-client';
import { PageHead, Pane, Stats, Stat, CountUp, CodeBlock, CopyButton, Modal, Loader, Empty, Note, Tag, Pill, ProviderMark } from '@/components/studio';
import '@/styles/studio-keys.css';

const SNIPPETS = [
  {
    label: 'Python',
    lang: 'python' as const,
    code: `from openai import OpenAI\nclient = OpenAI(\n    api_key="aism_your_key_here",\n    base_url="https://aistupidlevel.info/v1"\n)\nresponse = client.chat.completions.create(\n    model="auto-coding",\n    messages=[{"role": "user", "content": "Hello!"}]\n)`,
  },
  {
    label: 'Node.js',
    lang: 'js' as const,
    code: `import OpenAI from 'openai';\nconst client = new OpenAI({\n    apiKey: "aism_your_key_here",\n    baseURL: "https://aistupidlevel.info/v1"\n});\nconst response = await client.chat.completions.create({\n    model: "auto-coding",\n    messages: [{ role: "user", content: "Hello!" }]\n});`,
  },
  {
    label: 'cURL',
    lang: 'bash' as const,
    code: `curl https://aistupidlevel.info/v1/chat/completions \\\n  -H "Authorization: Bearer aism_your_key_here" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "auto", "messages": [{"role": "user", "content": "Hello!"}]}'`,
  },
];

const IDE_TOOLS: ToolGuide[] = [
  {
    name: 'Roo Code',
    subtitle: 'VS Code extension',
    steps: [
      'Open Settings → Extensions → Roo Code',
      'Select provider: "OpenAI Compatible"',
      'Base URL: https://aistupidlevel.info/v1',
      'Paste your aism_ key',
      'Model dropdown auto-populates',
    ],
  },
  {
    name: 'Cline',
    subtitle: 'VS Code extension',
    steps: [
      'Open Cline settings → API Configuration',
      'Select: "OpenAI Compatible"',
      'Base URL: https://aistupidlevel.info/v1',
      'Paste your aism_ key',
      'Type model: auto-coding',
    ],
  },
  {
    name: 'Kilo Code',
    subtitle: 'VS Code / JetBrains',
    steps: [
      'Open Kilo Code settings → Providers',
      'API Provider: "OpenAI Compatible"',
      'Base URL: https://aistupidlevel.info/v1',
      'Paste your aism_ key',
      'Model: auto-coding',
    ],
  },
  {
    name: 'Continue',
    subtitle: 'VS Code / JetBrains',
    steps: [
      'Edit ~/.continue/config.yaml',
      'provider: openai',
      'apiBase: https://aistupidlevel.info/v1',
      'apiKey: aism_your_key_here',
      'model: auto-coding',
    ],
  },
  {
    name: 'Cursor IDE',
    subtitle: 'Chat/Plan mode only',
    steps: [
      'Settings → Models',
      'Toggle "Override OpenAI Base URL"',
      'URL: https://aistupidlevel.info/v1',
      'Paste key in OpenAI API Key field',
      '+ Add Model → auto-coding',
    ],
  },
  {
    name: 'Claude Code',
    subtitle: 'Anthropic CLI (uses /v1/messages)',
    steps: [
      'export ANTHROPIC_BASE_URL="https://aistupidlevel.info"',
      'export ANTHROPIC_API_KEY="aism_your_key_here"',
      'Run claude as usual',
      'Goes to Anthropic with your Anthropic key (no routing between providers); allowance, budgets and logs still apply',
    ],
  },
];

const CLI_TOOLS: ToolGuide[] = [
  {
    name: 'Aider',
    subtitle: 'CLI agent',
    steps: [
      'export OPENAI_API_BASE="https://aistupidlevel.info/v1"',
      'export OPENAI_API_KEY="aism_your_key_here"',
      'aider --model openai/auto-coding',
      '(openai/ prefix is required)',
    ],
  },
  {
    name: 'Open WebUI',
    subtitle: 'Self-hosted UI',
    steps: [
      'Admin → Settings → Connections → OpenAI',
      'Click "+ Add Connection"',
      'URL: https://aistupidlevel.info/v1',
      'Paste your aism_ key',
      'Models auto-populate',
    ],
  },
  {
    name: 'Chatbox',
    subtitle: 'Desktop app',
    steps: [
      'Settings → API Provider → OpenAI API',
      'API Host: https://aistupidlevel.info',
      '(No /v1 — Chatbox adds it)',
      'Paste your aism_ key',
    ],
  },
  {
    name: 'TypingMind',
    subtitle: 'Web app',
    steps: [
      'Settings → Add Custom Model',
      'Full URL: https://aistupidlevel.info/v1/chat/completions',
      'Header: Bearer aism_your_key_here',
      'Model ID: auto-coding',
    ],
  },
];

const VIRTUAL_MODELS = [
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
];

const ENDPOINTS: Array<[string, string]> = [
  ['POST /v1/chat/completions', 'OpenAI-compatible chat: routed (auto, auto-*) or a named model; streaming, tools, JSON'],
  ['GET /v1/models', 'The auto-* strategies and every model you can name'],
  ['POST /v1/messages', 'Anthropic Messages API, sent straight to Anthropic with your Anthropic key (Claude Code)'],
  ['POST /v1/messages/count_tokens', 'Anthropic’s token counter (free; not counted against your plan)'],
  ['POST /v1/embeddings', 'OpenAI embeddings: text-embedding-3-small (or auto-embedding) and -large'],
  ['POST /v1/router/feedback', 'Rate an answer up or down by its completion id; ratings nudge routing'],
  ['POST /v1/explain', 'Which model “auto” would pick for a prompt, without sending it'],
  ['POST /v1/compare', 'What every strategy would pick for a prompt'],
  ['POST /v1/analyze', 'How the router classifies a prompt (task, language, complexity)'],
];

const SECURITY_TIPS = [
  'Never share your API keys publicly or commit them to version control',
  'Store keys securely using environment variables or secret management tools',
  'Revoke keys immediately if you suspect they have been compromised',
  'Use different keys for different applications or environments',
];

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const delay = (d: number) => ({ '--d': `${d}s` } as CSSProperties);

export default function RouterKeysPage() {
  const { data: session, status } = useSession();
  const [keys, setKeys] = useState<UniversalKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // A router key answers nothing until the account has a provider key: most new keys were created
  // and never used because that second step was only on the router overview. null = not known yet.
  const [providerCount, setProviderCount] = useState<number | null>(null);
  // The models a request can name right now, best first (the router's own ranking table).
  const [lineup, setLineup] = useState<Array<{ name: string; provider: string }>>([]);
  const nameField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      apiClient.setUserId(session.user.id);
      fetchKeys();
      apiClient.getProviderKeys().then(r => setProviderCount((r.keys || []).length)).catch(() => setProviderCount(null));
      apiClient.getAvailableModels().then(r => setLineup((r.models || []).map(m => ({ name: m.name, provider: m.provider })))).catch(() => setLineup([]));
    } else if (status === 'unauthenticated') {
      setError('User authentication required');
      setLoading(false);
    }
  }, [status, session]);

  // The dialog focuses itself when it opens; put the caret in the name field after it, as the
  // old dialog's autoFocus did. (Child effects run first, so this frame comes after the dialog's.)
  useEffect(() => {
    if (!showCreateModal || createdKey) return;
    const raf = requestAnimationFrame(() => nameField.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [showCreateModal, createdKey]);

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

  // Closing never interrupts a key being created; it always forgets the name and the shown key.
  const closeCreate = () => {
    if (creating) return;
    setShowCreateModal(false);
    setNewKeyName('');
    setCreatedKey(null);
  };

  const activeKeysCount = keys.filter(k => !k.revoked).length;
  const revokedCount = keys.filter(k => k.revoked).length;
  const workspace = (session?.user as any)?.workspace;

  return (
    <RouterLayout>
      <SubscriptionGuard feature="Router API keys" requires="routing">
        <PageHead
          kicker="Smart Router"
          title="Router API keys"
          lead="One key that routes your prompts to whichever model is performing best right now."
          actions={
            <button type="button" className="st-btn is-primary" onClick={() => setShowCreateModal(true)}>
              Create key <span className="st-ar" aria-hidden="true">→</span>
            </button>
          }
        />

        <div className="st-body">
          {error && (
            <Note tone="bad" title="Could not load your keys">
              {error}
              <div className="sk-note-act">
                <button type="button" className="st-btn is-sm" onClick={fetchKeys}>Retry</button>
              </div>
            </Note>
          )}

          {providerCount === 0 && (
            <Note tone="warn" title="Add a provider key before you use your router key">
              The router calls models with your own OpenAI, Anthropic, Google, DeepSeek, Moonshot AI or Z.ai key, so a router
              key can&rsquo;t answer anything until you add at least one. Providers bill you directly, at their own list price.
              Want to try it first? Requests with the <code className="st-ic">X-ASL-Sandbox: true</code> header route for real
              and return a mock answer, no provider key needed.
              <div className="sk-note-act">
                <Link href="/router/providers" className="st-btn is-primary is-sm">Add a provider key <span className="st-ar" aria-hidden="true">→</span></Link>
              </div>
            </Note>
          )}

          <Stats columns={4}>
            <Stat value={loading ? '…' : <CountUp value={activeKeysCount} />} label="Active keys" sub="Can route requests now" tone={activeKeysCount > 0 ? 'accent' : undefined} />
            <Stat value={loading ? '…' : <CountUp value={keys.length} />} label="Total keys" sub="Including revoked" />
            <Stat value={loading ? '…' : <CountUp value={revokedCount} />} label="Revoked" sub="Can no longer be used" />
            <Stat value={<span className="sk-endpoint">aistupidlevel.info</span>} label="Endpoint" sub="OpenAI-compatible, at /v1" />
          </Stats>

          {/* Always flush, so the pane's class never changes once it has faded in (a changed
              className would drop the reveal's is-in and hide the pane again). */}
          <Pane
            title="Your SR API keys"
            sub={loading ? 'Loading…' : `${activeKeysCount} active`}
            ruled={!loading && keys.length > 0}
            flush
            delay={0.04}
          >
            {loading ? (
              <div className="sk-pad"><Loader label="Loading keys" minHeight={220} /></div>
            ) : keys.length === 0 ? (
              <div className="sk-pad">
                <Empty
                  title="No Smart Router keys"
                  actions={
                    <button type="button" className="st-btn is-primary" onClick={() => setShowCreateModal(true)}>
                      Create first key <span className="st-ar" aria-hidden="true">→</span>
                    </button>
                  }
                >
                  Create your first SR key to start routing prompts to the best-performing model.
                </Empty>
              </div>
            ) : (
              <div className="st-table-wrap">
                <table className="st-table is-stack sk-keys">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Key</th>
                      <th>Created</th>
                      <th>Last used</th>
                      <th>Status</th>
                      <th><span className="st-sr">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map(key => {
                      const extra = key as any;
                      const hasMeta = extra.department || extra.assignedTo || extra.tags?.length > 0 || extra.budgetLimitMonthly;
                      return (
                        <tr key={key.id} className={key.revoked ? 'is-revoked' : undefined}>
                          <td className="is-head">
                            <div className="sk-key-name">{key.name}</div>
                            {hasMeta && (
                              <div className="sk-key-meta">
                                {extra.department && <Tag tone="accent">{extra.department}</Tag>}
                                {extra.assignedTo && <span>→ {extra.assignedTo}</span>}
                                {extra.tags?.length > 0 && extra.tags.map((tag: string) => <Tag key={tag} tone="warn">{tag}</Tag>)}
                                {extra.budgetLimitMonthly && (
                                  <span className="sk-budget">
                                    Budget ${extra.currentMonthSpend?.toFixed(4) || '0'} / ${extra.budgetLimitMonthly}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td data-label="Key" className="is-code"><code className="sk-prefix">{key.keyPrefix}…</code></td>
                          <td data-label="Created" className="is-dim">{day(key.createdAt)}</td>
                          <td data-label="Last used" className="is-dim">{key.lastUsedAt ? day(key.lastUsedAt) : '—'}</td>
                          <td data-label="Status">{key.revoked ? <Pill>Revoked</Pill> : <Pill tone="good">Active</Pill>}</td>
                          <td className="sk-key-act">
                            {!key.revoked && (
                              <>
                                <Link href={`/router/monitoring?key=${key.id}&tab=activity`} className="st-btn is-sm">
                                  View activity <span className="st-ar" aria-hidden="true">→</span>
                                </Link>
                                <button type="button" className="st-btn is-sm is-danger sk-quiet" onClick={() => handleRevokeKey(key.id)}>
                                  Revoke
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Pane>

          <div className="st-grid is-stretch">
            <Pane title="This is where you get your Smart Router key" delay={0.04}>
              <div className="sk-about">
                <p className="st-text">
                  An <strong>SR key</strong> (<code className="st-ic">aism_…</code>) is what you put in Cursor, Cline, Aider or your
                  own code in place of an OpenAI or Anthropic key. Every request you send through it gets routed to whichever
                  model is scoring best on live benchmarks right now, billed through the provider keys you connect
                  under <Link href="/router/providers">Provider keys</Link>.
                </p>
                {/* The two key types get confused constantly — say which is which here,
                    on the page people land on first, rather than in a doc nobody opens. */}
                <Note title="Looking for the other kind of key?">
                  SR keys <strong>run inference</strong> and can spend money. If you just want to{' '}
                  <strong>read benchmark data</strong> — rankings, drift, degradation alerts — that is a separate, free,
                  read-only <Link href="/account/data-keys">Data API key</Link> (<code className="st-ic">asl_live_…</code>).
                  Deliberately separate, so a leaked read key can never touch your provider accounts.
                </Note>
                {/* Project keys live on the project page: they follow the project's rules and budget,
                    and the project report attributes their spend. Personal keys stay here. */}
                {workspace && (
                  <Note title="Working on a team project?">
                    The keys on this page are yours alone and follow your own Routing Preferences. For work in one of your
                    workspace&rsquo;s projects, make the key on the project&rsquo;s page (<Link href="/account/team">Workspace</Link> → the
                    project → Smart Router): it follows the project&rsquo;s routing rules, pays with its provider keys, counts
                    against its budget, and shows up in its report.
                  </Note>
                )}
              </div>
            </Pane>

            <Pane title="Security best practices" delay={0.1}>
              <ol className="sk-steps">
                {SECURITY_TIPS.map(tip => <li key={tip}><span>{tip}</span></li>)}
              </ol>
            </Pane>
          </div>

          {/* How to use your API key — setup guide, collapsed until asked for. */}
          <section className="st-pane st-up" style={delay(0.04)}>
            <div className={`st-pane-head sk-disclose${showSetupGuide ? ' is-open' : ''}`}>
              <div>
                <h2 className="st-pane-title">
                  <button
                    type="button"
                    className="sk-disclose-btn"
                    aria-expanded={showSetupGuide}
                    aria-controls="sk-guide"
                    onClick={() => setShowSetupGuide(!showSetupGuide)}
                  >
                    How to use your API key
                  </button>
                </h2>
                <p className="st-pane-sub">Quick start, IDE extensions, CLI tools and desktop apps, the virtual models and every endpoint.</p>
              </div>
              <span className="sk-disclose-state" aria-hidden="true"><span>{showSetupGuide ? 'Collapse' : 'Expand'}</span><i /></span>
            </div>

            {showSetupGuide && (
              <div className="st-pane-body sk-guide-body" id="sk-guide">
                <section className="sk-sec">
                  <p className="st-label">Quick start</p>
                  <p className="st-text">
                    Use your <code className="st-ic">aism_</code> key anywhere you&rsquo;d normally put an OpenAI key, and set the base
                    URL to <code className="st-ic">https://aistupidlevel.info/v1</code>. The snippets use the OpenAI SDK for Python and
                    for Node.js / TypeScript, and curl.
                  </p>
                  <CodeBlock samples={SNIPPETS} />
                  <p className="st-text">
                    <code className="st-ic">&quot;auto&quot;</code> follows your <Link href="/router/preferences">Routing Preferences</Link>; an{' '}
                    <code className="st-ic">auto-*</code> name picks a strategy per request. Streaming
                    (<code className="st-ic">stream: true</code>), tool calls (including a forced <code className="st-ic">tool_choice</code>),
                    JSON mode and structured outputs work as in the OpenAI API. Every response says which model answered and why,
                    in the headers <code className="st-ic">X-AISM-Model</code>, <code className="st-ic">X-AISM-Provider</code>,{' '}
                    <code className="st-ic">X-AISM-Reasoning</code> and <code className="st-ic">X-AISM-Request-Id</code>. Text only:
                    requests with images or audio are refused, because nothing we benchmark measures them.
                  </p>
                </section>

                <section className="sk-sec">
                  <p className="st-label">IDE extensions</p>
                  <p className="st-text">
                    For agentic tools that drive a lot of tool calls (Cline, Roo Code, Aider), <code className="st-ic">auto-tooling</code> routes
                    on the tool-use benchmark and is usually the better choice than <code className="st-ic">auto-coding</code>.
                  </p>
                  <div className="st-cards" style={{ ['--min' as string]: '270px' }}>
                    {IDE_TOOLS.map(t => <ToolCard key={t.name} {...t} />)}
                  </div>
                </section>

                <section className="sk-sec">
                  <p className="st-label">CLI tools &amp; desktop apps</p>
                  <div className="st-cards" style={{ ['--min' as string]: '270px' }}>
                    {CLI_TOOLS.map(t => <ToolCard key={t.name} {...t} />)}
                  </div>
                </section>

                <section className="sk-sec">
                  <p className="st-label">Available virtual models</p>
                  <dl className="sk-models">
                    {VIRTUAL_MODELS.map(m => (
                      <div key={m.id}>
                        <dt><code>{m.id}</code></dt>
                        <dd>{m.desc}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="st-text">
                    Or name a model to skip routing: the request goes to that model only, with no fallback. The models you
                    can name right now{lineup.length ? ', best first:' : ' are listed by GET /v1/models.'}
                  </p>
                  {lineup.length > 0 && (
                    <ul className="sk-lineup">
                      {lineup.map(m => (
                        <li key={m.name} title={m.provider}>
                          <ProviderMark provider={m.provider} size="sm" />
                          <code>{m.name}</code>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="st-hint">
                    <code className="st-ic">GET /v1/models</code> returns the same list, and is what most tools use to fill their model dropdown.
                  </p>
                </section>

                <section className="sk-sec">
                  <p className="st-label">API endpoints</p>
                  <dl className="sk-endpoints">
                    {ENDPOINTS.map(([ep, what]) => {
                      const [method, path] = ep.split(' ');
                      return (
                        <div key={ep}>
                          <dt><span className={`sk-method${method === 'GET' ? ' is-get' : ''}`}>{method}</span><code>{path}</code></dt>
                          <dd>{what}</dd>
                        </div>
                      );
                    })}
                  </dl>
                  <p className="st-text">
                    Everything accepts the key as <code className="st-ic">Authorization: Bearer aism_…</code>{' '}
                    (<code className="st-ic">x-api-key</code> too, on the Anthropic routes).
                  </p>
                  <p><Link href="/router/docs" className="st-more">Full API reference</Link></p>
                </section>
              </div>
            )}
          </section>
        </div>

        {/* Create key: a name first, then the key — shown once. */}
        <Modal
          open={showCreateModal}
          onClose={closeCreate}
          size="narrow"
          title="Create new SR API key"
          sub={createdKey ? undefined : 'A key that routes through the provider keys you have connected.'}
          footer={
            createdKey ? (
              providerCount === 0 ? (
                <>
                  <button type="button" className="st-btn" onClick={closeCreate}>Later</button>
                  <Link href="/router/providers" className="st-btn is-primary">Add a provider key <span className="st-ar" aria-hidden="true">→</span></Link>
                </>
              ) : (
                <button type="button" className="st-btn is-primary" onClick={closeCreate}>Done</button>
              )
            ) : (
              <>
                <button type="button" className="st-btn" onClick={closeCreate} disabled={creating}>Cancel</button>
                <button type="button" className="st-btn is-primary" onClick={handleCreateKey} disabled={!newKeyName.trim() || creating}>
                  {creating ? 'Creating…' : 'Create key'}
                </button>
              </>
            )
          }
        >
          {!createdKey ? (
            <div className="st-field">
              <label className="st-field-label" htmlFor="sk-key-name">Key name</label>
              <input
                ref={nameField}
                id="sk-key-name"
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newKeyName.trim() && !creating) handleCreateKey(); }}
                placeholder="e.g., My MacBook, Production Server"
                className="st-input"
                disabled={creating}
                autoComplete="off"
              />
              <p className="st-hint">Give your key a descriptive name to identify it later</p>
            </div>
          ) : (
            <div className="sk-about">
              <Note tone="good" title="Key created">Copy your key now — you won&rsquo;t be able to see it again.</Note>
              <div className="sk-secret-field">
                <span className="st-field-label" id="sk-new-key-label">Your API key</span>
                <div className="st-secret" aria-labelledby="sk-new-key-label">
                  <code>{createdKey}</code>
                  <CopyButton text={createdKey} />
                </div>
              </div>
              <Note tone="warn" title="Important">Store this key securely. We cannot show it again after you close this dialog.</Note>
              {providerCount === 0 && (
                <Note title="Next: add a provider key">
                  This key routes through your own provider keys, and you haven&rsquo;t added one yet. Add an OpenAI,
                  Anthropic, Google, DeepSeek, Moonshot AI or Z.ai key and your requests start routing; until then they are refused.
                </Note>
              )}
            </div>
          )}
        </Modal>
      </SubscriptionGuard>
    </RouterLayout>
  );
}

interface ToolGuide { name: string; subtitle: string; steps: string[] }

/** URLs, aism_ keys, the auto-coding model name and config paths, set in the code face inside a step. */
const CODE_BITS = /(https?:\/\/[^\s"]+|aism_[a-z_]*|\bauto-coding\b|~\/\.continue\/config\.yaml)/;

function StepText({ step }: { step: string }) {
  if (step.startsWith('export ') || step.startsWith('aider')) return <code className="sk-step-code">{step}</code>;
  if (step.startsWith('(')) return <span className="sk-step-aside">{step}</span>;
  const parts = step.split(CODE_BITS);
  return <span>{parts.map((p, i) => (i % 2 ? <code key={i} className="st-ic">{p}</code> : p))}</span>;
}

/** One tool's setup, as numbered steps. */
function ToolCard({ name, subtitle, steps }: ToolGuide) {
  return (
    <div className="st-card sk-tool">
      <div className="sk-tool-head">
        <span className="st-card-t">{name}</span>
        <span className="sk-tool-sub">{subtitle}</span>
      </div>
      <ol className="sk-steps is-tight">
        {steps.map((step, i) => <li key={i}><StepText step={step} /></li>)}
      </ol>
    </div>
  );
}
