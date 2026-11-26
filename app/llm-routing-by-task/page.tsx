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
  CADENCE, FREE_ROUTER, ROUTER_APP_ID, ROUTER_BASE_URL, VALUE_FLOOR_POINTS, listJoin, word,
} from '@/components/seo/routers/routers-data';
import {
  BOARDS, LONG_SESSION_MESSAGES, MATCH_RULES, MAX_TOOL_NAMES_READ, MIN_CODE_WORDS, MIN_CODING_TOOLS, ROUTING_PUBLISHED_ISO,
  TASK_SAMPLE, TEXT_READ_CHARS, exploreLinks, relatedGuides,
} from '@/components/seo/routing/routing-data';
import { breadcrumbLd, faqLd, graphLd, isoDay, pageMeta, utcStamp, webPageLd } from '@/lib/seo';
import { getRoster } from '@/lib/seo-data';
import '@/styles/seo.css';
import '@/styles/seo-routers.css';

/**
 * /llm-routing-by-task: how the Smart Router routes a request by its task. The two ways to do it
 * (a mode that names the task, or auto-task and Match each request, which read each request), the
 * six rules in the order the router tries them, the board each task ranks on with the live pick,
 * and the response headers that name the rule and the board.
 *
 * ISR every fifteen minutes, no auth(): the live picks come from GET /dashboard/landing (the
 * router's own decisions for an example caller with a key for every provider). Static copy names
 * no model; every model name on the page is live data.
 */

const PATH = '/llm-routing-by-task';
const TITLE = 'LLM routing by task: a model for each job';
const DESCRIPTION = 'Route LLM requests by task: the Smart Router reads each request and ranks it on the coding, reasoning or tool-use board. Six rules, no extra model call.';
const H1 = 'LLM routing by task:';
const H1_ACCENT = 'each request to the model for its job';

export const metadata: Metadata = pageMeta({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  type: 'article',
  publishedTime: ROUTING_PUBLISHED_ISO,
  keywords: [
    'LLM routing by task', 'route LLM requests by task', 'task-based LLM routing', 'task based model routing',
    'automatic LLM router', 'best automatic router', 'prompt routing by task type', 'request-level routing',
    'automatic model selection per request', 'LLM router for coding', 'LLM router for reasoning', 'auto-task routing mode',
  ],
});

export const revalidate = 900;

const TOC = [
  { id: 'two-ways', label: 'Two ways to route by task' },
  { id: 'rules', label: 'The six request rules' },
  { id: 'modes', label: 'A mode for each task' },
  { id: 'live', label: 'Live picks' },
  { id: 'verify', label: 'Check it in the headers' },
  { id: 'conversation', label: 'Inside a conversation' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

export default async function LlmRoutingByTaskPage(): Promise<React.JSX.Element> {
  const [snapshot, roster] = await Promise.all([getLandingSnapshot(), getRoster()]);
  const slugs = new Map(roster.map((m) => [m.name, m.slug]));
  const providerCount = snapshot?.providerCount ?? 0;

  /* ── FAQ: the same strings feed the page and the FAQPage structured data ── */
  const faq: FaqItem[] = [
    {
      q: 'How do I route LLM requests by task?',
      a: `Point an OpenAI-compatible client at ${ROUTER_BASE_URL} and send the task as the model name. With the AI Stupid Level [Smart Router](/router), auto-coding ranks the request on the Coding board, auto-reasoning on Reasoning and auto-tooling on Tool use, and auto-task reads each request and picks the board itself. The suites behind the boards are the same tasks for every model, on a fixed schedule: ${CADENCE}.`,
    },
    {
      q: 'What is task-based LLM routing?',
      a: 'Task-based routing sends each request to a model chosen for its kind of work, instead of sending everything to one model name. The Smart Router recognises the task from six fixed rules over the request’s tools, its latest message and the length of the conversation, and ranks the request on a benchmark board for that task. [What an AI router is](/ai-router) covers the other signals routers choose by.',
    },
    {
      q: 'Does a coding agent need its own mode?',
      a: 'A coding agent’s requests offer tools for files, code and a terminal, so auto-task ranks them on Coding with no extra setting. [Model routing for coding agents](/llm-routing-for-coding-agents) has the modes and the settings for each tool.',
    },
    {
      q: 'Which automatic LLM router is best?',
      a: 'The one whose routing signal you can check. Ask what decides the model for each request, whether the response says which rule and which model were used, whose keys pay for the tokens, and what happens when a provider fails. The Smart Router names the rule, the model and any fallback in its response headers, and sends every request with your own keys. [Best AI routers in 2026](/best-ai-router) sets the main options side by side, each described from its vendor’s own pages.',
    },
  ];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Smart Router', path: '/router' }, { name: 'LLM routing by task', path: PATH }]),
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
        kicker="LLM routing by task"
        title={H1}
        accent={H1_ACCENT}
        lead={<>
          The AI Stupid Level Smart Router routes LLM requests by task in two ways. Name the task with a mode such as{' '}
          <code>auto-coding</code>, or send <code>auto-task</code> and each request is read on its own and ranked on the
          benchmark board for its kind of work. The suites behind the boards are the same coding, reasoning and tool-use tasks
          for every model, on a fixed schedule: {CADENCE}.
        </>}
        actions={(
          <CtaRow className="is-stack">
            <RouterCta cta="llm-routing-by-task-hero-key" />
            <div className="seo-cta">
              <a className="lp-btn lp-btn-ghost" href="#rules" data-cta="llm-routing-by-task-hero-rules">See the six rules</a>
            </div>
          </CtaRow>
        )}
        aside={(
          <dl className="lp-facts">
            <div><dt>{MATCH_RULES.length}</dt><dd>rules read each request, tried in order.</dd></div>
            <div><dt>{BOARDS.length}</dt><dd>boards a request can rank on: {listJoin(BOARDS)}.</dd></div>
            <div><dt>0</dt><dd>extra model calls. The rules run inside the request.</dd></div>
          </dl>
        )}
        toc={TOC}
        final={(
          <RdFinal
            title="Send each task to the model for it"
            lead={`Free includes ${FREE_ROUTER}.`}
            actions={(
              <CtaRow>
                <RouterCta cta="llm-routing-by-task-final-key" />
                <LeaderboardCta ghost cta="llm-routing-by-task-final-leaderboard" label="See the boards it routes on →" sub="Coding, Reasoning, Tool use and Combined, over 24 hours, 7 days and 30 days." />
              </CtaRow>
            )}
            explore={exploreLinks(PATH).map((l) => <Link key={l.path} href={l.path}>{l.label}</Link>)}
          />
        )}
      >
        <RdSection
          id="two-ways"
          n={num('two-ways')}
          title="How does the Smart Router route a request by task?"
          lead="Either your code names the task, or the router reads it from the request. Both ways, the request is ranked on the board for that kind of work, among the models your provider keys reach."
        >
          <RdRows rows={[
            ['Name the task yourself', <>
              Send a mode as the model name: <code>auto-coding</code> for code, <code>auto-reasoning</code> for analysis and
              planning, <code>auto-tooling</code> for agents that call tools. A mode that names a board is used as sent, whatever
              the request contains.
            </>],
            ['Let the router read each request', <>
              Send <code>auto-task</code> and the router picks the board per request, from the six rules below. Match each request
              in Preferences turns the same matching on for Best overall and Best value, so for <code>auto-best</code>,{' '}
              <code>auto-value</code>, and <code>auto</code> when either is your saved strategy. It is off until you turn it on.
            </>],
          ]} />
        </RdSection>

        <RdSection
          id="rules"
          n={num('rules')}
          title="Which rules decide the task?"
          lead="Six rules, tried in order. They read what the request already carries: its tools, its latest message and the length of the conversation."
        >
          <div className="rd-table-wrap seo-table-wrap rt-table-wrap lp-up">
            <table className="rd-table seo-table rt-table">
              <caption>The rules in the order the router tries them. The first that fits decides, and <code>X-AISM-Request-Kind</code> names it on the response.</caption>
              <thead>
                <tr><th scope="col">Rule</th><th scope="col">What it looks for</th><th scope="col">Ranked on</th></tr>
              </thead>
              <tbody>
                {MATCH_RULES.map((r) => (
                  <tr key={r.kind}>
                    <th scope="row">{r.rule} <code>{r.kind}</code></th>
                    <td>{r.reads}</td>
                    <td>{r.board}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RdRows rows={[
            ['Three things are read', <>
              The names of the tools the request offers (the first {MAX_TOOL_NAMES_READ}), its latest user message (of a long one,
              the first and the last {TEXT_READ_CHARS.toLocaleString('en-US')} characters) and the number of messages in the
              conversation, system messages aside.
            </>],
            ['Tools decide before text', <>
              When a request offers tools, the tool names alone decide. At least {word(MIN_CODING_TOOLS)} tools for files, code or
              a terminal, such as <code>read_file</code>, <code>apply_diff</code>, <code>execute_command</code>, <code>bash</code>{' '}
              or <code>grep</code>, rank it on Coding, and any other tool set on Tool use. The text is read when no tools are
              offered.
            </>],
            ['Code needs more than one hint', `Text counts as code with a code block, code syntax such as an import or a stack trace, or ${word(MIN_CODE_WORDS)} different programming terms. One stray word such as “method” does not.`],
            ['No extra model call', 'The rules are fixed patterns that run inside the request, so matching adds no tokens and no round trip.'],
          ]} />
        </RdSection>

        <RdSection
          id="modes"
          n={num('modes')}
          title="Which mode names which task?"
          lead="Each of these modes names a task and ranks on the board that tests it."
        >
          <RdRows rows={[
            [<code key="c">auto-coding</code>, <>
              Code generation, debugging and refactoring. The Coding board: repository bug fixes graded by running the project’s
              own tests, every four hours. <Link href="/best-llm-for-coding">Best LLM for coding</Link>.
            </>],
            [<code key="r">auto-reasoning</code>, <>
              Analysis, planning and long multi-step work. The Reasoning board: long, multi-turn working sessions, daily.{' '}
              <Link href="/best-llm-for-reasoning">Best LLM for reasoning</Link>.
            </>],
            [<code key="t">auto-tooling</code>, <>
              Agents and assistants that call tools. The Tool use board: sandboxed agent tasks with real tools, daily.{' '}
              <Link href="/best-ai-model-for-agents">Best AI model for agents</Link>.
            </>],
            [<code key="b">auto-best</code>, 'Work with no single board. The Combined score: coding 50%, reasoning 25%, tool use 25%.'],
            [<code key="v">auto-value-coding</code>, <>
              With <code>auto-value-reasoning</code> and <code>auto-value-tooling</code>, the value version of each board: within{' '}
              {VALUE_FLOOR_POINTS} points of the top score, the most points per dollar of one run of that suite.{' '}
              <Link href="/llm-cost-routing">LLM cost routing</Link>.
            </>],
          ]} />
          <RdProse>
            <p>
              Your exclusions, maximum price and maximum response time are applied before a mode ranks anything. Every mode and
              its rule is on the <Link href="/router#how">Smart Router page</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection
          id="live"
          n={num('live')}
          title="Where does each task go right now?"
          lead="The live router’s own picks for an example caller who holds a key for every provider. They follow the boards."
        >
          {snapshot ? (
            <>
              <LivePicks
                snapshot={snapshot}
                slugs={slugs}
                caption={<><code>auto-coding</code>, <code>auto-reasoning</code>, <code>auto-tooling</code> and <code>auto-best</code> are the task modes. Each pick links to the model’s page, with its scores and history.</>}
              />
              <AsOf>
                As of {utcStamp(snapshot.generatedAt)} · the router’s own picks for an example caller with keys for all {providerCount} providers
              </AsOf>
            </>
          ) : (
            <RdProse>
              <p>
                The boards each task ranks on are public: <Link href="/best-llm-for-coding">coding</Link>,{' '}
                <Link href="/best-llm-for-reasoning">reasoning</Link> and <Link href="/best-ai-model-for-agents">agents</Link>.
              </p>
            </RdProse>
          )}
        </RdSection>

        <RdSection
          id="verify"
          n={num('verify')}
          title="How do I check which rule and board a request used?"
          lead="Every answer says how it was routed. The request below asks for a migration plan, so it matches the planning rule and ranks on Reasoning. The headers shown are those of an account on default settings."
        >
          <RdCode title="cURL" label="auto-task" code={TASK_SAMPLE} />
          <RdRows rows={[
            [<code key="k">X-AISM-Request-Kind</code>, <>The rule that matched: <code>tools_code</code>, <code>tools</code>, <code>long_session</code>, <code>planning</code>, <code>code</code> or <code>general</code>.</>],
            [<code key="b">X-AISM-Benchmark</code>, <>The board it was ranked on: <code>overall</code>, <code>coding</code>, <code>reasoning</code> or <code>tool_use</code>.</>],
            [<code key="s">X-AISM-Strategy</code>, <>
              The strategy, such as <code>best_reasoning</code>. <code>X-AISM-Strategy-Source</code> says where it came from:{' '}
              <code>request</code> for the mode the request named, <code>preferences</code> for your saved strategy.
            </>],
            [<code key="w">X-AISM-Reasoning</code>, <>
              The decision in words: the rule, the board, the model’s score and why it won. <code>X-AISM-Model</code> and{' '}
              <code>X-AISM-Provider</code> name what answered.
            </>],
          ]} />
          <RdProse>
            <p>
              <code>POST /v1/route/preview</code> takes the same body and returns the decision with nothing called or counted. The{' '}
              <code>X-ASL-Sandbox: true</code> header returns a mock answer through the real routing, before you add a provider
              key. Every header is in the <Link href="/router/docs#chat">router documentation</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection
          id="conversation"
          n={num('conversation')}
          title="What happens to the task inside a conversation?"
        >
          <RdRows rows={[
            ['A conversation keeps its board', 'The board is set at a conversation’s first request. A later request changes it when its own content calls for another: tools, code, design or planning.'],
            ['A long conversation, once', `The long-session rule, ${word(LONG_SESSION_MESSAGES)} or more messages, applies when a conversation first reaches the router and not again.`],
            ['And its model', <>
              By default a conversation also stays on the model that answered it. Model switching in Preferences can rank each new
              message again, and <code>X-AISM-Conversation</code> says what happened.{' '}
              <Link href="/router/docs#switching">Model switching in the docs</Link>.
            </>],
          ]} />
          <RdProse>
            <p>
              Each tool’s guide says which mode fits it: <Link href="/router/integrations/cline">Cline</Link>,{' '}
              <Link href="/router/integrations/cursor">Cursor</Link>, <Link href="/router/integrations/langchain">LangChain</Link>{' '}
              and <Link href="/router/integrations/n8n">n8n</Link>, with the rest on the{' '}
              <Link href="/router/integrations">integrations hub</Link>. Related guides:
            </p>
          </RdProse>
          <ul className="rd-tags lp-up" aria-label="Routing guides">
            {relatedGuides(PATH).map((g) => <li key={g.path}><Link href={g.path}>{g.label}</Link></li>)}
          </ul>
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="Questions about routing by task">
          <Faq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
