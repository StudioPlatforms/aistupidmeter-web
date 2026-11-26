import type { Metadata } from 'next';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdRows, RdCode, RdFinal, tocNumber } from '@/components/landing/Reading';
import { getLandingSnapshot } from '@/components/landing/data';
import { CtaRow, LeaderboardCta, RouterCta } from '@/components/seo/Cta';
import JsonLd from '@/components/seo/JsonLd';
import { AsOf } from '@/components/seo/Verdict';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { LivePicks } from '@/components/seo/routers/RouterBlocks';
import {
  CADENCE, CIRCUIT_COOLDOWN_S, CIRCUIT_FAILURES, FREE_ROUTER, MAX_FALLBACKS, ROUTER_APP_ID, ROUTER_BASE_URL,
  VALUE_FLOOR_POINTS, word,
} from '@/components/seo/routers/routers-data';
import {
  AGENT_SAMPLE, AGENT_TOOLS, BODY_LIMIT_MB, FIRST_BYTE_DEADLINE_S, MIN_CODING_TOOLS, MOVE_LIMIT_REQUESTS, ROUTING_PUBLISHED_ISO,
  SWITCH_COST_DEFAULT_USD, SWITCH_STANDARD_ERRORS, TURN_MEMORY_HOURS, exploreLinks, relatedGuides,
} from '@/components/seo/routing/routing-data';
import { integrationPath } from '@/lib/integrations';
import { breadcrumbLd, faqLd, graphLd, isoDay, pageMeta, utcStamp, webPageLd } from '@/lib/seo';
import { getRoster } from '@/lib/seo-data';
import '@/styles/seo.css';
import '@/styles/seo-routers.css';

/**
 * /llm-routing-for-coding-agents: model routing for coding agents. How the router reads an agent's
 * request (its file and terminal tools rank it on the Coding board), the modes an agent sends, what
 * keeps a loop on one model, what the endpoint gives an agent, how each tool connects, and the
 * headers that name the rule, the board and the model.
 *
 * ISR every fifteen minutes, no auth(): the live picks come from GET /dashboard/landing. The tool
 * rows follow the integration guides (lib/integrations.ts), where each tool's full settings are.
 * Static copy names no model.
 */

const PATH = '/llm-routing-for-coding-agents';
const TITLE = 'Model routing for coding agents';
const DESCRIPTION = 'Model routing for coding agents: the Smart Router ranks agent requests on its coding and tool-use boards, for Cline, Aider, OpenCode, Continue and Cursor.';
const H1 = 'Model routing for coding agents:';
const H1_ACCENT = 'ranked on coding and tool-use benchmarks';

export const metadata: Metadata = pageMeta({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  type: 'article',
  publishedTime: ROUTING_PUBLISHED_ISO,
  keywords: [
    'model routing for coding agents', 'LLM routing for coding agents', 'LLM router for coding agents', 'coding agent model router',
    'Claude Code model routing', 'Cursor model routing', 'Cline model routing', 'Aider model routing', 'Continue model routing',
    'OpenCode model routing', 'best model for coding agents', 'agentic coding LLM router',
  ],
});

export const revalidate = 900;

const TOC = [
  { id: 'requests', label: 'How agent requests are read' },
  { id: 'modes', label: 'Modes for agents' },
  { id: 'live', label: 'Live picks' },
  { id: 'loop', label: 'One model per loop' },
  { id: 'needs', label: 'Tools, streaming, long context' },
  { id: 'tools', label: 'Each agent' },
  { id: 'verify', label: 'Check it' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

const usd = (x: number) => `$${x.toFixed(2)}`;

export default async function CodingAgentRoutingPage(): Promise<React.JSX.Element> {
  const [snapshot, roster] = await Promise.all([getLandingSnapshot(), getRoster()]);
  const slugs = new Map(roster.map((m) => [m.name, m.slug]));
  const providerCount = snapshot?.providerCount ?? 0;

  /* ── FAQ: the same strings feed the page and the FAQPage structured data ── */
  const faq: FaqItem[] = [
    {
      q: 'What is model routing for coding agents?',
      a: `It is choosing, per request, which model a coding agent’s call goes to, instead of fixing one model name in the agent’s settings. The AI Stupid Level [Smart Router](/router) does it from its public boards. Send auto-coding, or auto-task and let the agent’s file and terminal tools say what it is, and the request is ranked on the Coding board, whose suite is the same repository bug fixes for every model, scheduled every four hours and graded by running the project’s own tests.`,
    },
    {
      q: 'Does the model change in the middle of an agent loop?',
      a: 'Not by default. One model per conversation keeps the loop on the model that started it, so its reasoning and your provider’s prompt cache carry over. It moves when that model can no longer serve the request, for example when its provider is failing. Model switching in Preferences can allow moves on scores, within a cost limit you set.',
    },
    {
      q: 'Does Claude Code get a routed model?',
      a: 'Claude Code speaks Anthropic’s Messages API, and the router passes it through natively: the request goes to Anthropic, with your own Anthropic key, for the Claude model you chose in Claude Code. It gains one key for every tool, with the plan allowance, budgets and request log of every other endpoint. The routing modes live on the OpenAI-compatible endpoint, which Cline, Kilo Code, Roo Code, Aider, OpenCode, Continue and Cursor’s chat use. [Claude Code with the Smart Router](/router/integrations/claude-code).',
    },
    {
      q: 'Which Cursor features use the router?',
      a: 'Chat and plan mode use the base URL you set under Override OpenAI Base URL. Composer, inline edit and autocomplete stay on Cursor’s own backend. [Cursor with the Smart Router](/router/integrations/cursor).',
    },
  ];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Smart Router', path: '/router' }, { name: 'Routing for coding agents', path: PATH }]),
    webPageLd({
      path: PATH,
      name: `${H1} ${H1_ACCENT}`,
      description: DESCRIPTION,
      type: 'TechArticle',
      datePublished: ROUTING_PUBLISHED_ISO,
      dateModified: snapshot ? isoDay(snapshot.generatedAt) : ROUTING_PUBLISHED_ISO,
      about: { '@id': ROUTER_APP_ID },
    }),
    faqLd(faq),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        className="rd-routers"
        kicker="Coding agents"
        title={H1}
        accent={H1_ACCENT}
        lead={<>
          A coding agent’s requests look alike: a long conversation, tools for files and a terminal, one more step to take. The
          AI Stupid Level Smart Router ranks those requests on its coding and tool-use boards, keeps an agent loop on the model
          that started it, and falls back when a provider fails. The suites behind the boards are the same tasks for every model, on a fixed schedule: {CADENCE}.
        </>}
        actions={(
          <CtaRow className="is-stack">
            <RouterCta cta="llm-routing-for-coding-agents-hero-key" />
            <div className="seo-cta">
              <a className="lp-btn lp-btn-ghost" href="#tools" data-cta="llm-routing-for-coding-agents-hero-tools">See how each agent connects</a>
            </div>
          </CtaRow>
        )}
        aside={(
          <dl className="lp-facts">
            <div><dt>2</dt><dd>boards behind agent work: Coding, every four hours, and Tool use, daily.</dd></div>
            <div><dt>{TURN_MEMORY_HOURS}<small>h</small></dt><dd>each model’s own turn is kept for its agent loop.</dd></div>
            <div><dt>{BODY_LIMIT_MB}<small>MB</small></dt><dd>request bodies, for whole conversations of code.</dd></div>
          </dl>
        )}
        toc={TOC}
        final={(
          <RdFinal
            title="Put your coding agent on the Coding board"
            lead={`Free includes ${FREE_ROUTER}.`}
            actions={(
              <CtaRow>
                <RouterCta cta="llm-routing-for-coding-agents-final-key" />
                <LeaderboardCta ghost cta="llm-routing-for-coding-agents-final-leaderboard" label="See the boards it routes on →" sub="Coding, Reasoning, Tool use and Combined, over 24 hours, 7 days and 30 days." />
              </CtaRow>
            )}
            explore={exploreLinks(PATH).map((l) => <Link key={l.path} href={l.path}>{l.label}</Link>)}
          />
        )}
      >
        <RdSection
          id="requests"
          n={num('requests')}
          title="How does the router read a coding agent’s request?"
          lead="By its tools. The rules run inside the request, with no extra model call."
        >
          <RdRows rows={[
            ['The tools say it is a coding agent', <>
              With <code>auto-task</code>, or Match each request on, a request that offers at least {word(MIN_CODING_TOOLS)} tools
              for files, code or a terminal is ranked on the Coding board. Tool names such as <code>read_file</code>,{' '}
              <code>apply_diff</code>, <code>execute_command</code>, <code>bash</code>, <code>edit</code> and <code>grep</code>{' '}
              count. A weather or email tool does not.
            </>],
            ['One board for the whole loop', 'When a request offers tools, the tool names alone decide the board, not the text of the message. An agent that sends the same tools on every step stays on one board.'],
            ['Other tools rank on Tool use', <>
              A request whose tools are not for code, such as a calendar or a CRM, is ranked on the Tool use board.{' '}
              <code>X-AISM-Request-Kind</code> names the rule that matched. <Link href="/llm-routing-by-task">All six rules</Link>.
            </>],
          ]} />
        </RdSection>

        <RdSection
          id="modes"
          n={num('modes')}
          title="Which routing mode should a coding agent send?"
          lead="The mode goes where the agent asks for a model name."
        >
          <RdRows rows={[
            [<code key="c">auto-coding</code>, <>
              The Coding board: repository bug fixes graded by running the project’s own tests, every four hours. It is the mode
              the integration guides use. <Link href="/best-llm-for-coding">Best LLM for coding</Link>.
            </>],
            [<code key="t">auto-tooling</code>, <>
              The Tool use board: sandboxed agent tasks with real tools, daily. The guides suggest it for long agent sessions.{' '}
              <Link href="/best-ai-model-for-agents">Best AI model for agents</Link>.
            </>],
            [<code key="v">auto-value-coding</code>, <>
              Among the models within {VALUE_FLOOR_POINTS} points of the top coding score you can use, the most points per dollar
              of one coding run. <Link href="/llm-cost-routing">LLM cost routing</Link>.
            </>],
            [<code key="k">auto-task</code>, 'Decided per request: an agent’s file and terminal tools rank it on Coding, any other tools on Tool use.'],
          ]} />
        </RdSection>

        <RdSection
          id="live"
          n={num('live')}
          title="Which models do the agent modes pick right now?"
          lead="The live router’s own picks for an example caller who holds a key for every provider. They follow the boards."
        >
          {snapshot ? (
            <>
              <LivePicks
                snapshot={snapshot}
                slugs={slugs}
                caption={<><code>auto-coding</code> and <code>auto-tooling</code> are the rows a coding agent uses. Each pick links to the model’s page, with its scores and history.</>}
              />
              <AsOf>
                As of {utcStamp(snapshot.generatedAt)} · the router’s own picks for an example caller with keys for all {providerCount} providers
              </AsOf>
            </>
          ) : (
            <RdProse>
              <p>
                The boards the agent modes rank on are public: <Link href="/best-llm-for-coding">coding</Link> and{' '}
                <Link href="/best-ai-model-for-agents">agents</Link>.
              </p>
            </RdProse>
          )}
        </RdSection>

        <RdSection
          id="loop"
          n={num('loop')}
          title="What keeps an agent loop on one model?"
          lead="An agent resends the whole conversation at every step. The router keeps what the provider needs to see again."
        >
          <RdRows rows={[
            ['One model per conversation', 'By default the model that answered keeps the conversation while you can still use it. Tool calls and their results stay on the model that made them.'],
            ['Its own turns are replayed', `The router keeps each model’s own turn for ${TURN_MEMORY_HOURS} hours: Claude’s thinking blocks, OpenAI reasoning items, Gemini thought signatures. Your agent sends the conversation back in OpenAI’s shape, with the provider’s own tool call ids, and the provider sees its own turn again.`],
            ['The prompt cache carries over', 'Staying on one model lets your provider serve the part of the conversation it has seen from its prompt cache. Claude caches when asked, so the router asks.'],
            ['Moving is your choice', <>
              Model switching in Preferences can rank again at each new message, or at every request. On the quality modes a
              conversation then moves when another model leads by more than {SWITCH_STANDARD_ERRORS} standard errors and
              re-sending stays within your limit, {usd(SWITCH_COST_DEFAULT_USD)} by default, and on scores at most once in{' '}
              {MOVE_LIMIT_REQUESTS} requests. <Link href="/router/docs#switching">Model switching in the docs</Link>.
            </>],
          ]} />
        </RdSection>

        <RdSection
          id="needs"
          n={num('needs')}
          title="What else does an agent need from the endpoint?"
        >
          <RdRows rows={[
            ['Streaming', `Text arrives as the model writes it, and tool calls in one chunk each once the model has finished them. A provider that sends nothing for ${FIRST_BYTE_DEADLINE_S} seconds gives way to the next model.`],
            ['Forced tool calls', <>
              <code>tool_choice</code> <code>required</code>, or a named function, works on every model: natively where the
              provider enforces it, otherwise asked for and checked. The answer is a tool call or a{' '}
              <code>502 tool_choice_not_honoured</code>, not prose.
            </>],
            ['Reasoning effort', <>
              <code>reasoning_effort</code> takes <code>none</code> to <code>max</code> with any model. The router maps it to the
              nearest level the chosen model supports.
            </>],
            ['Fallbacks', <>
              Up to {MAX_FALLBACKS} on every routed request, and a model that fails {CIRCUIT_FAILURES} times in a row is skipped
              for {CIRCUIT_COOLDOWN_S} seconds. <Link href="/llm-fallback-routing">LLM fallback routing</Link>.
            </>],
          ]} />
        </RdSection>

        <RdSection
          id="tools"
          n={num('tools')}
          title="How does each coding agent connect?"
          lead="Each guide has the exact settings to paste."
        >
          <div className="rd-table-wrap seo-table-wrap rt-table-wrap lp-up">
            <table className="rd-table seo-table rt-table">
              <caption>The OpenAI-compatible tools take the base URL <code>{ROUTER_BASE_URL}</code>, and the key is your <code>aism_</code> router key.</caption>
              <thead>
                <tr><th scope="col">Tool</th><th scope="col">Connects through</th><th scope="col">Model to send</th></tr>
              </thead>
              <tbody>
                {AGENT_TOOLS.map((t) => (
                  <tr key={t.slug}>
                    <th scope="row"><Link href={integrationPath(t.slug)}>{t.name}</Link></th>
                    <td>{t.connects}</td>
                    <td>{t.model}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RdProse>
            <p>
              The routing modes belong to the OpenAI-compatible endpoint. Zed and more are on the{' '}
              <Link href="/router/integrations">integrations hub</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection
          id="verify"
          n={num('verify')}
          title="How do I check how an agent’s request was routed?"
          lead="The request below offers two tools for files and code, so auto-task matches the tools_code rule and ranks it on Coding. The headers shown are those of an account on default settings."
        >
          <RdCode title="cURL" label="auto-task · a coding agent’s tools" code={AGENT_SAMPLE} />
          <RdRows rows={[
            [<code key="k">X-AISM-Request-Kind</code>, <><code>tools_code</code>: the request works on code through tools. <code>X-AISM-Benchmark</code> is then <code>coding</code>.</>],
            [<code key="c">X-AISM-Conversation</code>, <><code>new</code> on the first request of a loop and <code>stayed</code> on the steps after it, under the default setting.</>],
            [<code key="m">X-AISM-Model</code>, <>The model that answered: the same one through the loop, for as long as it can serve the request. <code>X-AISM-Reasoning</code> says why.</>],
          ]} />
          <RdProse>
            <p>
              Every header and parameter is in the <Link href="/router/docs">router documentation</Link>, and{' '}
              <Link href="/ai-router">what an AI router is</Link> covers the terms. Related guides:
            </p>
          </RdProse>
          <ul className="rd-tags lp-up" aria-label="Routing guides">
            {relatedGuides(PATH).map((g) => <li key={g.path}><Link href={g.path}>{g.label}</Link></li>)}
          </ul>
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="Questions about routing for coding agents">
          <Faq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
