'use client';

/**
 * /router/help — the Smart Router help center.
 *
 * Quick links, the five-minute start, then the help topics and the FAQ as the landing page's
 * question lists (display-face questions, a chevron that turns, ruled rows), and the ways to
 * reach us. Topics open and close as before — they used to be an accordion of panels — and
 * every answer, limit and caveat is unchanged.
 */

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import RouterLayout from '@/components/RouterLayout';
import { PageHead, Pane, CodeBlock, Note, Tag } from '@/components/studio';
import '@/styles/studio-docs.css';

/** Inline code in running text. */
function C({ children }: { children: ReactNode }) {
  return <code className="st-ic">{children}</code>;
}

const delay = (s: number) => ({ '--d': `${s}s` } as CSSProperties);

const QUICK_LINKS: Array<{ href: string; title: string; desc: ReactNode }> = [
  { href: '/router/keys', title: 'Create API key', desc: <>Your <C>aism_</C> key, for every tool you connect</> },
  { href: '/router/providers', title: 'Add providers', desc: 'Keys for OpenAI, Anthropic, Google, DeepSeek, Kimi or GLM' },
  { href: '/router/docs', title: 'API docs', desc: 'Endpoints, parameters, errors and examples' },
  { href: '/router/monitoring', title: 'Monitoring', desc: 'Per-key activity, costs, prompt audit and budgets' },
  { href: '/router/analytics', title: 'Analytics', desc: 'Cost patterns across your requests' },
  { href: '/router/preferences', title: 'Preferences', desc: 'Default strategy, fallbacks and latency limits' },
];

const TOOL_SETTINGS = `Base URL: https://aistupidlevel.info/v1
API Key: aism_your_key_here
Model: auto-coding (or auto, auto-reasoning, etc.)`;

const TOOLS: Array<{ name: string; how: ReactNode }> = [
  { name: 'Roo Code', how: 'Settings → "OpenAI Compatible" → paste Base URL + Key' },
  { name: 'Cline', how: 'Settings → "OpenAI Compatible" → paste Base URL + Key' },
  { name: 'Continue', how: <>Edit <C>config.yaml</C> → <C>provider: openai</C> + <C>apiBase</C> + <C>apiKey</C></> },
  { name: 'Cursor IDE', how: 'Settings → Override OpenAI Base URL (chat/plan mode only)' },
  { name: 'Aider', how: <>Set <C>OPENAI_API_BASE</C> + <C>OPENAI_API_KEY</C> env vars</> },
  { name: 'Open WebUI', how: 'Admin → Connections → OpenAI → Add Connection' },
  { name: 'Chatbox', how: <>API Host: <C>https://aistupidlevel.info</C> (no <C>/v1</C>)</> },
  { name: 'TypingMind', how: 'Full endpoint URL per model + Bearer header' },
  { name: 'Jan.ai', how: 'OpenAI extension → paste URL + Key' },
  { name: 'LibreChat', how: <><C>librechat.yaml</C> custom endpoint with <C>fetch: true</C></> },
  { name: 'AnythingLLM', how: 'Generic OpenAI provider → Base URL + Key' },
  { name: 'LiteLLM', how: <><C>litellm-config.yaml</C> → <C>openai/auto-coding</C></> },
];

const STRATEGIES: Array<{ id: string; strategy: string; use: string }> = [
  { id: 'auto', strategy: 'Saved preference', use: 'Uses your configured default strategy' },
  { id: 'auto-coding', strategy: 'Best coding', use: 'Code generation, debugging, refactoring' },
  { id: 'auto-reasoning', strategy: 'Best reasoning', use: 'Complex analysis, math, logic puzzles' },
  { id: 'auto-tooling', strategy: 'Best tool use', use: 'Agents and coding assistants that call tools' },
  { id: 'auto-value', strategy: 'Best value', use: 'Near-top quality for the fewest dollars (combined score)' },
  { id: 'auto-value-coding', strategy: 'Best value: coding', use: 'Most coding points per dollar among near-top models' },
  { id: 'auto-value-reasoning', strategy: 'Best value: reasoning', use: 'Most reasoning points per dollar among near-top models' },
  { id: 'auto-value-tooling', strategy: 'Best value: tool use', use: 'Most tool-use points per dollar among near-top models' },
  { id: 'auto-consistent', strategy: 'Most consistent', use: 'Steadiest near-top model, answers vary least day to day' },
  { id: 'auto-fastest-quality', strategy: 'Fastest good model', use: 'Fastest model within 5 points of the best' },
  { id: 'auto-cheapest', strategy: 'Lowest price', use: 'Lowest list price per token, no quality bar' },
  { id: 'auto-fastest', strategy: 'Lowest latency', use: 'Real-time apps, chatbots, quick queries' },
];

const MONITORING: Array<{ label: string; desc: string }> = [
  { label: 'Key activity', desc: 'Per-request log with provider, model, cost, latency, and category' },
  { label: 'Cost dashboard', desc: 'Daily/weekly/monthly spend breakdown by model and provider' },
  { label: 'Prompt audit', desc: 'Encrypted prompt logging with PII scrubbing (opt-in)' },
  { label: 'Budgets & alerts', desc: 'Monthly spend limits (soft warnings + hard enforcement) per key' },
  { label: 'Efficiency report', desc: 'Success rates, category distribution, avg cost per request' },
];

const FAQ: Array<{ q: string; a: ReactNode }> = [
  { q: 'How much does it cost?', a: 'You pay the providers directly for tokens, with your own keys; we add nothing to token prices. Your plan includes routed requests each month (Free 1,000, Pro Intelligence 10,000, Developer 100,000, Teams 1,000,000), and prepaid credits cover any beyond that at $5 per 10,000. Only successful requests count.' },
  { q: 'Is my data secure?', a: 'Provider keys are encrypted at rest (AES-256-GCM) and never shown again. Prompt logging is off unless you turn it on; when it is on, API keys, tokens, email addresses and phone numbers are removed before the prompt is encrypted and stored.' },
  { q: 'What happens if a model fails?', a: 'Automatic fallback: if the chosen model fails before answering, the router tries the rest of your traffic split (if you use one), then your own fallback order (if you set one), then up to 2 automatic fallbacks from different providers. A model that is failing right now is skipped without waiting for a timeout. Configure it in Preferences.' },
  { q: 'Does streaming work?', a: <>Yes — set <C>stream: true</C>. Text arrives as the model writes it, for every provider; tool calls arrive once each is complete, then usage if you ask for it with <C>stream_options.include_usage</C>.</> },
  { q: 'How often are benchmarks updated?', a: 'Coding runs every 4 hours, reasoning and tool use daily, and a small canary every hour. Rankings refresh after each run, and the router reads the same scores the leaderboard shows.' },
  { q: 'Can I use a specific model directly?', a: <>Yes — send any real model ID (e.g. <C>claude-opus-5-5</C>, <C>gpt-6-sol</C>) instead of an <C>auto-*</C> strategy. The router forwards directly to that provider; your plan allowance and key budgets still apply.</> },
  { q: 'Does tool calling work with agents?', a: <>Yes. Send OpenAI-format tools and return results as role &quot;tool&quot; messages with <C>tool_call_id</C>. The router keeps each model&apos;s own turn (such as Claude&apos;s thinking) between requests, so multi-step agent loops work, and a loop stays on the model that started it. Forcing a call with <C>tool_choice</C> works on every model: where a provider cannot enforce it, the router asks the model in words and checks that the answer really is the tool call.</> },
  { q: 'Can I send images, audio or files?', a: 'No — the router routes text only, on purpose. It picks a model from our benchmark results for coding, reasoning and tool use, and none of those measure image, audio or file understanding, so we would be guessing. Such a request gets a clear 400. Call the provider directly for multimodal work.' },
  { q: 'Which providers are supported?', a: 'OpenAI, Anthropic, Google (Gemini), DeepSeek, Kimi (Moonshot) and GLM (Z.AI). Add as many as you like. xAI/Grok is not currently routable — none of its models are in the benchmark lineup.' },
  { q: 'Does it work with embeddings?', a: <>Yes — <Link href="/router/docs#embeddings"><C>POST /v1/embeddings</C></Link> proxies to OpenAI embedding models. Required by Continue, LibreChat, and Open WebUI for RAG.</> },
];

const FIXES: Array<{ problem: string; fix: ReactNode }> = [
  { problem: '401 Unauthorized', fix: <>Check your <C>aism_</C> key is correct and not revoked. Include it as <C>Authorization: Bearer aism_...</C> header. Some tools also accept <C>sk-aism_</C> prefix.</> },
  { problem: 'No models in dropdown', fix: <>Your tool calls <C>GET /v1/models</C> — this requires a valid <C>aism_</C> key. Check that auth is configured correctly.</> },
  { problem: 'Model not found', fix: 'If using a specific model ID, check spelling. Direct pin routing infers the provider from the model name prefix.' },
  { problem: 'High costs', fix: <>Set budget limits in Monitoring → Budgets. Use <C>auto-cheapest</C> strategy. Check Analytics for cost patterns.</> },
  { problem: 'Slow responses', fix: <>Use <C>auto-fastest</C> strategy. Set latency limits in Preferences. Enable streaming for better perceived speed.</> },
  { problem: 'Provider key validation failed', fix: 'Re-check the key on the provider\'s dashboard. Ensure it has active credits and correct permissions.' },
  { problem: 'CORS errors in browser', fix: <>The <C>/v1/*</C> endpoints allow all origins. If you see CORS errors, check that your tool is using the correct base URL.</> },
];

const CONTACT: Array<{ href: string; title: string; desc: string }> = [
  { href: '/contact?topic=support', title: 'Contact support', desc: 'Something is not working the way it should.' },
  { href: '/contact?topic=sales', title: 'Sales & pricing', desc: 'Which plan fits, volume pricing, annual terms.' },
  { href: '/contact?topic=security', title: 'Security', desc: 'Vulnerability reports and security questions.' },
  { href: '/status', title: 'Provider status', desc: 'Every provider, checked every 10 minutes.' },
];

/** A row of link cards with the landing's arrow. */
function LinkCards({ items, min }: { items: Array<{ href: string; title: string; desc: ReactNode }>; min: string }) {
  return (
    <div className="st-cards" style={{ ['--min' as string]: min }}>
      {items.map((l, i) => (
        <Link key={l.href} href={l.href} className="st-card st-up" style={delay(i * 0.04)}>
          <span className="st-card-t">{l.title}<span className="st-ar sd-quick-arrow" aria-hidden="true">→</span></span>
          <span className="st-card-d">{l.desc}</span>
        </Link>
      ))}
    </div>
  );
}

/** One question (or topic) in the landing's FAQ style. */
function Question({ q, open, children }: { q: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open}>
      <summary>{q}</summary>
      <div className="sd-ans">{children}</div>
    </details>
  );
}

export default function HelpPage() {
  return (
    <RouterLayout>
      <div className="sd-page sd-help">
        <PageHead
          kicker="Support"
          title="Help center"
          lead="Everything you need to know about the AI Smart Router."
          actions={<>
            <Link href="/contact?topic=support" className="st-btn">Contact support</Link>
            <Link href="/router/docs" className="st-btn is-primary">API documentation <span className="st-ar" aria-hidden="true">→</span></Link>
          </>}
        />

        <div className="st-body">
          {/* ── Quick links ── */}
          <section aria-labelledby="sd-quick-h">
            <p className="st-label" id="sd-quick-h">Quick links</p>
            <LinkCards items={QUICK_LINKS} min="290px" />
          </section>

          {/* ── Getting started ── */}
          <Pane title="Getting started" ruled>
            <div className="sd-flow">
              <h3 className="sd-h3">What is the AI Smart Router?</h3>
              <p className="st-text">
                The AI Smart Router is an intelligent API gateway that automatically selects the best AI model for your requests.
                Instead of manually choosing between Claude, GPT, Gemini, DeepSeek, Kimi or GLM, our system continuously benchmarks
                all models and routes your requests to the optimal one based on performance, cost, and your preferences.
              </p>

              <h3 className="sd-h3">Quick start (5 minutes)</h3>
              <ol className="sd-steps">
                <li className="st-up">
                  <p className="sd-step-n" aria-hidden="true">01</p>
                  <h4 className="sd-step-t">Create a universal API key</h4>
                  <p>
                    Go to <Link href="/router/keys">API keys</Link> → Click &quot;Create key&quot; → Copy and save it securely. Your key starts
                    with <C>aism_</C>
                  </p>
                </li>
                <li className="st-up" style={delay(0.08)}>
                  <p className="sd-step-n" aria-hidden="true">02</p>
                  <h4 className="sd-step-t">Add provider API keys</h4>
                  <p>
                    Go to <Link href="/router/providers">Providers</Link> → Add keys for OpenAI, Anthropic, Google, DeepSeek, Kimi or GLM. The
                    more providers you add, the better the routing!
                  </p>
                </li>
                <li className="st-up" style={delay(0.16)}>
                  <p className="sd-step-n" aria-hidden="true">03</p>
                  <h4 className="sd-step-t">Configure your tool</h4>
                  <p>Use your <C>aism_</C> key with any OpenAI-compatible tool:</p>
                  <CodeBlock title="Tool settings" samples={[{ label: 'Tool settings', lang: 'text', code: TOOL_SETTINGS }]} />
                </li>
              </ol>
            </div>
          </Pane>

          {/* ── Help topics ── */}
          <Pane className="sd-qa">
            <div className="sd-qa-grid">
              <div className="sd-qa-head">
                <h2 id="sd-topics-h">Help topics</h2>
                <p>Set up your tool, choose a routing strategy, keep an eye on spend, and fix common problems.</p>
              </div>
              <div className="sd-faq" role="group" aria-labelledby="sd-topics-h">
                <Question q="Setting up your IDE / tool">
                  <div className="sd-flow">
                    <p className="st-text">
                      Your <C>aism_</C> key works with any tool that supports custom OpenAI base URLs. For detailed setup instructions with
                      copy-paste configs, visit the <Link href="/router/keys">API keys page</Link> and expand &quot;How to use your API key&quot;.
                    </p>
                    <ul className="sd-tools">
                      {TOOLS.map(t => (
                        <li key={t.name}><b>{t.name}</b><span>{t.how}</span></li>
                      ))}
                    </ul>
                    <Note title="Known limitations" tone="warn">
                      <p className="sd-note-p"><b>Cursor:</b> Only chat/plan mode uses your base URL — Composer, inline edit, and autocomplete are locked to Cursor&apos;s backend.</p>
                      <p className="sd-note-p"><b>Windsurf:</b> Cascade is locked to Codeium&apos;s backend. Install Roo Code or Cline inside Windsurf instead.</p>
                    </Note>
                  </div>
                </Question>

                <Question q="Routing strategies (virtual models)">
                  <div className="sd-flow">
                    <p className="st-text">
                      Use these as the <C>model</C> parameter. The router picks the best real model based on live benchmarks.
                    </p>
                    <div className="sd-tbox">
                      <div className="st-table-wrap">
                        <table className="st-table is-stack sd-t-strat">
                          <thead><tr><th>Model ID</th><th>Strategy</th><th>Best for</th></tr></thead>
                          <tbody>
                            {STRATEGIES.map(s => (
                              <tr key={s.id}>
                                <td className="is-head" data-label="Model ID"><code className="sd-name">{s.id}</code></td>
                                <td className="sd-nowrap" data-label="Strategy"><Tag>{s.strategy}</Tag></td>
                                <td className="sd-desc" data-label="Best for">{s.use}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <p className="st-text">
                      You can also pin specific models (e.g., <C>claude-opus-5-5</C>, <C>gpt-6-sol</C>, <C>gemini-3.8-flash</C>) to bypass routing entirely.
                    </p>
                    <p><Link className="st-more" href="/router/docs#strategies">Every strategy in the API documentation</Link></p>
                  </div>
                </Question>

                <Question q="Monitoring & budgets">
                  <div className="sd-flow">
                    <p className="st-text">
                      The <Link href="/router/monitoring">Monitoring page</Link> provides per-key activity tracking, cost dashboards, prompt auditing,
                      and budget management.
                    </p>
                    <dl className="st-kv">
                      {MONITORING.map(f => (
                        <div key={f.label}><dt>{f.label}</dt><dd>{f.desc}</dd></div>
                      ))}
                    </dl>
                  </div>
                </Question>

                <Question q="Troubleshooting">
                  <dl className="sd-fixes">
                    {FIXES.map(t => (
                      <div key={t.problem}><dt>{t.problem}</dt><dd>{t.fix}</dd></div>
                    ))}
                  </dl>
                </Question>
              </div>
            </div>
          </Pane>

          {/* ── FAQ ── */}
          <Pane className="sd-qa" delay={0.04}>
            <div className="sd-qa-grid">
              <div className="sd-qa-head">
                <h2 id="sd-faq-h">Frequently asked questions</h2>
                <p>
                  Still unsure? The <Link href="/router/docs">API documentation</Link> covers every endpoint, or{' '}
                  <Link href="/contact?topic=support">contact support</Link>.
                </p>
              </div>
              <div className="sd-faq" role="group" aria-labelledby="sd-faq-h">
                {FAQ.map((f, i) => (
                  <Question key={f.q} q={f.q} open={i === 0}><p>{f.a}</p></Question>
                ))}
              </div>
            </div>
          </Pane>

          {/* ── Contact ── */}
          <section aria-labelledby="sd-contact-h">
            <p className="st-label" id="sd-contact-h">Still need help?</p>
            <LinkCards items={CONTACT} min="240px" />
          </section>

          <p className="sd-end">Need more detail? Check the <Link href="/router/docs">API documentation</Link></p>
        </div>
      </div>
    </RouterLayout>
  );
}
