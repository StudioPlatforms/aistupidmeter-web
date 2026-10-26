import type { ReactNode } from 'react';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdFacts, RdCode, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { AsOf } from '@/components/seo/Verdict';
import { CtaRow, RouterCta } from '@/components/seo/Cta';
import { breadcrumbLd, faqLd, graphLd, isoDay, itemListLd, utcStamp, webPageLd } from '@/lib/seo';
import { ROUTER_INTEGRATIONS } from '@/lib/seo-routes';
import { getBoards24h } from '@/lib/seo-data';
import {
  CATEGORY_BLURB, CATEGORY_LABEL, CATEGORY_ORDER, COST_FAQ, DOCS_INTEGRATIONS_PATH, DOCS_STRATEGIES_PATH, INTEGRATIONS, INTEGRATIONS_PATH,
  INTEGRATION_SLUGS, KEY_PLACEHOLDER, ROUTER_BASE_URL, TOOL_SETTINGS, integrationLabel, integrationPath, integrationsOf, type FaqEntry,
} from '@/lib/integrations';
import { IntegrationFaq } from './IntegrationBlocks';
import { RichText, plainText } from './RichText';
import { HUB_DESCRIPTION, HUB_LEAD, HUB_TITLE } from './integrations-meta';
import '@/styles/seo.css';
import '@/styles/seo-integrations.css';

/**
 * /router/integrations: the hub of the per-tool guides, grouped by category, with the three
 * settings every tool needs (the help centre's TOOL_SETTINGS), the ready-made integrations the
 * docs list, and a FAQ. Rendered by app/router/integrations/page.tsx; ISR, no auth().
 */

const TOC = [
  { id: 'settings', label: 'The three settings' },
  { id: 'tools', label: 'Tools' },
  { id: 'builtin', label: 'Ready-made' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

/** The docs' "Built in" list (Integrations pane), package name → what it is. */
const BUILT_IN: [string, string][] = [
  ['n8n-nodes-aistupidlevel', 'n8n. A node for chat, routing and benchmark data, plus an AI Stupid Level Chat Model for the AI Agent. Install it from Settings → Community Nodes.'],
  ['@aistupidlevel/mcp', 'MCP server, listed in the official MCP Registry. Rankings, drift, incidents, route previews and router answers as tools in Claude, Cursor, VS Code and any MCP client.'],
  ['langchain-aistupidlevel', 'LangChain chat model ChatAISL: tools, structured output and streaming, plus the model that answered and why.'],
  ['@aistupidlevel/ai-sdk-provider', 'Vercel AI SDK provider: generateText, streamText and tools.'],
  ['@aistupidlevel/dsh-provider', 'DeepSeek Harness plugin bundle: adds AI Stupid Level as a provider route with the routing modes as models.'],
  ['@aistupidlevel/openclaw-provider', 'OpenClaw provider plugin on ClawHub: the routing modes as OpenClaw models, with a live model list.'],
  ['aistupidlevel (Hermes)', 'Hermes Agent provider plugin in the official Hermes plugin catalog: hermes plugins install aistupidlevel.'],
  ['AI Stupid Level (Dify)', 'Dify model provider plugin on the Dify Marketplace, with the routing modes as models.'],
  ['AI Stupid Level (RAGFlow)', 'RAGFlow model provider: pick it under Model providers and paste your router key.'],
  ['@aistupidlevel/pi-provider', 'Pi provider extension: the routing modes as Pi models, with the model that answered in the footer.'],
  ['lfx-aistupidlevel', 'Langflow model provider and component: AI Stupid Level in the Language Model and Agent pickers.'],
  ['AI Stupid Level (Open WebUI)', 'Open WebUI Function on openwebui.com: every routing mode as a model, with the model that answered and why above each reply.'],
];

const FAQ: FaqEntry[] = [
  {
    q: 'Which tools work with the Smart Router?',
    a: `Any tool that lets you set an OpenAI base URL: the router is an OpenAI-compatible endpoint at \`${ROUTER_BASE_URL}\`. This page has a guide for Claude Code (through the native Anthropic Messages passthrough), Cursor, Cline with Kilo Code and Roo Code, Continue, Aider, OpenCode, n8n, LangChain, Zed, Open WebUI and LibreChat. The [router documentation](${DOCS_INTEGRATIONS_PATH}) adds samples for the OpenAI SDK, LlamaIndex, the Vercel AI SDK, LiteLLM, CrewAI, browser-use, Instructor, promptfoo, OpenClaw, Hermes Agent, DeepSeek Harness, Open Interpreter, Dify, RAGFlow, Cherry Studio, AnythingLLM, Crush, Pi, Langflow, OpenHands and Activepieces.`,
  },
  {
    q: 'What do I enter as the model?',
    a: `A routing mode: \`auto-coding\` for code, \`auto-tooling\` for agents that call tools, \`auto-reasoning\` for analysis, \`auto-best\` for the best combined score, and the \`auto-value*\` modes for the most points per measured dollar among near-top models. Any real model id from \`GET /v1/models\` pins that model and bypasses routing. Every mode is defined in the [Virtual models](${DOCS_STRATEGIES_PATH}) section of the docs.`,
  },
  COST_FAQ,
  {
    q: 'Does Cursor work with the Smart Router?',
    a: 'In chat/plan mode, yes: Settings → Override OpenAI Base URL with `https://aistupidlevel.info/v1` and your `aism_` key. Composer, inline edit and autocomplete are locked to Cursor’s backend. The [Cursor guide](/router/integrations/cursor) has the steps, and the MCP server adds rankings and route previews to the editor.',
  },
  {
    q: 'Does Claude Code route between models?',
    a: 'No. Claude Code speaks the Anthropic Messages API, and the router passes it through natively: the request goes to Anthropic, with your Anthropic key, for the Claude model Claude Code names, with the same allowance, budgets and request logs as every other endpoint. The [Claude Code guide](/router/integrations/claude-code) covers the two environment variables.',
  },
  {
    q: 'Do streaming and tool calling work?',
    a: 'Yes. Streaming is real: text arrives as the model writes it (`X-AISM-Streaming-Mode: native`), tool calls arrive in one chunk each once complete, then usage if you set `stream_options.include_usage`. Tool calling works end to end with OpenAI-format tools; the router remembers each model’s own turn for 24 hours, so multi-step agent loops keep working, and a conversation stays on the model that started it. The router is text only: images, audio and files get a `400 unsupported_content`.',
  },
];

export default async function IntegrationsHub() {
  const boards = await getBoards24h();
  const combined = boards?.boards.combined.ranked.length ?? 0;

  if (process.env.NODE_ENV !== 'production') {
    const a = [...INTEGRATION_SLUGS].sort().join(',');
    const b = [...ROUTER_INTEGRATIONS].sort().join(',');
    if (a !== b) console.warn(`[integrations] lib/seo-routes.ts ROUTER_INTEGRATIONS (${b}) differs from lib/integrations.ts (${a})`);
  }

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Smart Router', path: '/router' }, { name: 'Integrations', path: INTEGRATIONS_PATH }]),
    webPageLd({ path: INTEGRATIONS_PATH, name: HUB_TITLE, description: HUB_DESCRIPTION, type: 'CollectionPage', ...(boards ? { dateModified: isoDay(boards.generatedAt) } : {}) }),
    itemListLd({ name: 'Smart Router integrations', items: INTEGRATIONS.map((i) => ({ name: integrationLabel(i), url: integrationPath(i.slug) })) }),
    faqLd(FAQ.map((f) => ({ q: f.q, a: plainText(f.a) }))),
  ]);

  return (
    <ReadingPage
      className="rd-in"
      kicker="Smart Router · Integrations"
      title="Use the Smart Router"
      accent="with your tools"
      lead={HUB_LEAD}
      actions={(
        <CtaRow className="is-stack">
          <RouterCta cta="integrations-hero-key" />
          <div className="seo-cta">
            <Link className="lp-btn lp-btn-ghost" href={DOCS_INTEGRATIONS_PATH} data-cta="integrations-hero-docs">Every integration in the docs</Link>
          </div>
        </CtaRow>
      )}
      note={<><Link href="/router">About the Smart Router</Link> · <Link href="/router/help">Help centre</Link></>}
      aside={<RdCode title={TOOL_SETTINGS.title ?? 'Tool settings'} label="Any OpenAI-compatible tool" code={TOOL_SETTINGS.src} />}
      toc={TOC}
      final={(
        <RdFinal
          title="One key, every tool"
          lead="A free account gives you a router key, the Providers page for your own keys, and the request allowance. No card."
          actions={(
            <CtaRow className="is-stack">
              <RouterCta cta="integrations-final-key" />
              <div className="seo-cta">
                <Link className="lp-btn lp-btn-ghost" href="/router/docs" data-cta="integrations-final-docs">The router documentation</Link>
              </div>
            </CtaRow>
          )}
        />
      )}
    >
      <JsonLd data={ld} />

      <RdSection
        id="settings"
        n={num('settings')}
        title="What every tool needs: a base URL, a key and a model"
        lead="The same three values go wherever a tool asks for an OpenAI-compatible API. The quality modes read the same scores the leaderboard shows."
      >
        <RdFacts rows={[
          ['Base URL', <code key="u">{ROUTER_BASE_URL}</code>],
          ['API key', <><code>{KEY_PLACEHOLDER}</code>: your router key from <Link href="/router/keys">API keys</Link>, sent as <code>Authorization: Bearer</code>. If a tool insists on an <code>sk-</code> prefix, <code>sk-aism_…</code> is accepted.</>],
          ['Model', <>A routing mode such as <code>auto-coding</code>, <code>auto-tooling</code> or <code>auto-best</code>, or any real model id from <code>GET /v1/models</code> to pin one model.</>],
        ]} />
        {boards && combined > 0 && (
          <AsOf className="lp-up">
            {combined} models are ranked on the Combined board in the last 24 hours · as of {utcStamp(boards.generatedAt)} · <Link href="/">the leaderboard</Link>
          </AsOf>
        )}
        <RdProse>
          <p>
            Claude Code is the one exception: it speaks the Anthropic Messages API, and the router passes it through natively at{' '}
            <code>POST /v1/messages</code> with <code>ANTHROPIC_BASE_URL</code> set to the site root. The{' '}
            <Link href="/router/integrations/claude-code">Claude Code guide</Link> has the two variables.
          </p>
        </RdProse>
      </RdSection>

      <RdSection
        id="tools"
        n={num('tools')}
        title="Which tools work with the Smart Router?"
        lead="One guide per tool: the exact settings, the routing modes that fit, what the tool supports behind the router, the errors it can show, and a FAQ."
      >
        {CATEGORY_ORDER.map((c) => {
          const list = integrationsOf(c);
          if (!list.length) return null;
          return (
            <div key={c} className="in-hub-group lp-up">
              <h3 className="in-hub-h3">{CATEGORY_LABEL[c]}</h3>
              <p className="in-hub-blurb">{CATEGORY_BLURB[c]}</p>
              <dl className="rd-facts">
                {list.map((i) => (
                  <div key={i.slug}>
                    <dt><Link href={integrationPath(i.slug)}>{integrationLabel(i)}</Link></dt>
                    <dd><RichText text={i.summary} /></dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </RdSection>

      <RdSection
        id="builtin"
        n={num('builtin')}
        title="Ready-made integrations: packages and plugins"
        lead={<>Published packages that add AI Stupid Level as a provider, from the <Link href={DOCS_INTEGRATIONS_PATH}>Integrations section of the docs</Link>. Use your router key wherever a tool asks for an API key, and a routing mode as the model.</>}
      >
        <RdFacts rows={BUILT_IN.map(([k, v]): [ReactNode, ReactNode] => [<code key={k}>{k}</code>, v])} />
      </RdSection>

      <RdSection id="faq" n={num('faq')} title="Questions about connecting tools to the Smart Router">
        <IntegrationFaq items={FAQ} />
      </RdSection>
    </ReadingPage>
  );
}
