import type { Metadata } from 'next';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdRows, RdCode, RdFinal, tocNumber } from '@/components/landing/Reading';
import { getLandingSnapshot } from '@/components/landing/data';
import { CtaRow, LeaderboardCta, RouterCta } from '@/components/seo/Cta';
import JsonLd from '@/components/seo/JsonLd';
import { AsOf } from '@/components/seo/Verdict';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { ClusterLinks, ClusterTags, LivePicks } from '@/components/seo/routers/RouterBlocks';
import {
  CADENCE, CHECKED_ISO, CIRCUIT_COOLDOWN_S, CIRCUIT_FAILURES, FREE_REQUESTS, FREE_ROUTER, KEY_CIPHER, MAX_FALLBACKS,
  MODE_COUNT, OPENNESS, OPENROUTER, OTHERS, PAID_ROUTER, PYTHON_SAMPLE, ROUTER_APP_ID, ROUTER_BASE_URL, VALUE_FLOOR_POINTS,
  listJoin, word,
} from '@/components/seo/routers/routers-data';
import { breadcrumbLd, faqLd, graphLd, isoDay, pageMeta, utcStamp, webPageLd } from '@/lib/seo';
import { VENDORS, getRoster, modelsOfVendor } from '@/lib/seo-data';
import '@/styles/seo.css';
import '@/styles/seo-routers.css';

/**
 * /ai-router: what an AI router (LLM router, AI model router) is, the signals routers choose by,
 * the live router's pick for each mode, and the Smart Router as the benchmark-driven one. The
 * product page is /router; this page answers the definitional queries and sends people there.
 *
 * ISR every fifteen minutes, no auth(): the live picks come from GET /dashboard/landing (the router's
 * own decisions for an example caller with a key for every provider) and the roster from
 * /api/models. Static copy names no model; every model name on the page is live data.
 */

const PATH = '/ai-router';
const TITLE = 'AI router: the right LLM for every request';
const DESCRIPTION = 'An AI router sends each request to the model best suited to it. The Smart Router decides from public benchmark results, with your own keys and no markup.';
const H1 = 'AI router: one endpoint,';
const H1_ACCENT = 'the right LLM for every request';

export const metadata: Metadata = pageMeta({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  type: 'article',
  publishedTime: CHECKED_ISO,
  keywords: [
    'AI router', 'LLM router', 'AI model router', 'smart router', 'smart AI router', 'what is an AI router',
    'what is an LLM router', 'AI routing', 'LLM routing', 'model routing', 'automatic model selection',
    'route requests to the best LLM', 'AI router with your own keys', 'benchmark-driven router',
  ],
});

export const revalidate = 900;

const TOC = [
  { id: 'what', label: 'What is an AI router?' },
  { id: 'signals', label: 'How routers choose' },
  { id: 'live', label: 'Live picks' },
  { id: 'smart', label: 'The Smart Router' },
  { id: 'start', label: 'Start in three steps' },
  { id: 'compare', label: 'Compare routers' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

export default async function AiRouterPage(): Promise<JSX.Element> {
  const [snapshot, roster] = await Promise.all([getLandingSnapshot(), getRoster()]);
  const slugs = new Map(roster.map((m) => [m.name, m.slug]));
  const perVendor = VENDORS.map((v) => ({ v, count: modelsOfVendor(roster, v.key).length })).filter((x) => x.count > 0);
  const modelCount = snapshot?.modelCount || roster.length;
  const providerCount = snapshot?.providerCount || perVendor.length;
  const others = listJoin([OPENROUTER, ...OTHERS].map((e) => e.name));
  const vendorLinks = listJoin(VENDORS.map((v) => `[${v.label}](${v.modelsPath})`));

  /* ── FAQ: the same strings feed the page and the FAQPage structured data ── */
  const faq: FaqItem[] = [
    {
      q: 'What is an AI router?',
      a: `An AI router, also called an LLM router or AI model router, is a service between your application and several model providers that chooses which model answers each request, behind one API and one key. Your code names a job, such as coding or a quick reply, and the router picks the model, translates the request for that provider and falls back to another model if the first one fails. The AI Stupid Level [Smart Router](/router) makes that choice from public benchmark results: every model on the [leaderboard](/) runs the same coding, reasoning and tool-use tasks, ${CADENCE}.`,
    },
    {
      q: 'What is a smart router in AI?',
      a: `A smart router chooses the model for each request automatically instead of sending everything to one hard-coded model name. What makes it smart is the signal behind the choice: rules you write, price, a prompt classifier, or test results. The Smart Router uses benchmark results, with ${MODE_COUNT} auto-* modes such as auto-coding, auto-reasoning and auto-value, and it moves a model whose drift detector has fired behind the healthy ones.`,
    },
    {
      q: 'Is an AI router the same as an AI gateway?',
      a: 'They overlap. A gateway is the plumbing: one endpoint, keys, logs, budgets and retries in front of the providers. A router is the decision: which model gets this request. Most products are some of both. The Smart Router is both: a gateway with your own provider keys and a log per request, and a router whose modes rank on the public boards. A gateway that gathers many providers behind one API is also called an [AI aggregator](/ai-aggregator).',
    },
    {
      q: 'Does an AI router add a cost to every token?',
      a: `The Smart Router adds nothing per token: requests go out with your own provider keys and each provider bills you at its own list price. Plans count routed requests instead. Free includes ${FREE_ROUTER}. ${PAID_ROUTER}. [Plans and prices](/pricing).`,
    },
    {
      q: 'Which AI router is best?',
      a: 'The one whose routing signal matches what you care about. Compare what decides the model, whose keys pay for the tokens and at what markup, where it runs, how it fails over, and whether it tells you why it chose a model. [Best AI routers in 2026](/best-ai-router) compares the main options on those points, each from its vendor’s own pages.',
    },
    {
      q: 'How do I switch my code to an AI router?',
      a: `Change two settings in any OpenAI SDK: the base URL to ${ROUTER_BASE_URL} and the API key to your router key, then send a mode such as auto-coding as the model name. Claude Code works through the native Anthropic endpoint. Step-by-step guides: [Claude Code](/router/integrations/claude-code), [Cursor](/router/integrations/cursor) and the rest of the [integrations hub](/router/integrations).`,
    },
    {
      q: 'Which models can the Smart Router route to?',
      a: modelCount > 0
        ? `Every model on the [leaderboard](/): ${modelCount} models from ${providerCount} providers as this page was rendered, each with its own page under its vendor: ${vendorLinks}. The modes rank only the models you hold a provider key for, and any model can also be pinned by its id from GET /v1/models.`
        : `Every model on the [leaderboard](/), from ${vendorLinks}. The modes rank only the models you hold a provider key for, and any model can also be pinned by its id from GET /v1/models.`,
    },
  ];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Smart Router', path: '/router' }, { name: 'AI router', path: PATH }]),
    webPageLd({
      path: PATH,
      name: `${H1} ${H1_ACCENT}`,
      description: DESCRIPTION,
      type: 'TechArticle',
      datePublished: CHECKED_ISO,
      dateModified: snapshot ? isoDay(snapshot.generatedAt) : CHECKED_ISO,
      about: { '@id': ROUTER_APP_ID },
    }),
    faqLd(faq),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        className="rd-routers"
        kicker="AI router"
        title={H1}
        accent={H1_ACCENT}
        lead={<>
          An AI router sits between your code and the model providers and decides which model answers each request. The
          AI Stupid Level Smart Router decides from public benchmark results. Every model runs the same coding, reasoning
          and tool-use tasks on a fixed schedule: {CADENCE}. Your own provider keys, no markup on tokens.
        </>}
        actions={(
          <CtaRow className="is-stack">
            <RouterCta cta="ai-router-hero-key" />
            <div className="seo-cta">
              <a className="lp-btn lp-btn-ghost" href="#live" data-cta="ai-router-hero-live">See where each mode routes now</a>
            </div>
          </CtaRow>
        )}
        aside={(
          <dl className="lp-facts">
            {modelCount > 0 && <div><dt>{modelCount}</dt><dd>models from {word(providerCount)} providers, every one on the same benchmark tasks.</dd></div>}
            <div><dt>{MODE_COUNT}</dt><dd>auto-* routing modes, from <code>auto-coding</code> to <code>auto-cheapest</code>.</dd></div>
            <div><dt>0%</dt><dd>markup on tokens. Providers bill you directly, at their own list price.</dd></div>
          </dl>
        )}
        toc={TOC}
        final={(
          <RdFinal
            title="Let the boards pick the model"
            lead={`Free includes ${FREE_ROUTER}.`}
            actions={(
              <CtaRow>
                <RouterCta cta="ai-router-final-key" />
                <LeaderboardCta ghost cta="ai-router-final-leaderboard" label="See the boards it routes on →" sub="Coding, Reasoning, Tool use and Combined, over 24 hours, 7 days and 30 days." />
              </CtaRow>
            )}
            explore={<ClusterLinks current={PATH} />}
          />
        )}
      >
        <RdSection
          id="what"
          n={num('what')}
          title="What is an AI router?"
          lead="An AI router, also called an LLM router or AI model router, is a service between your application and several model providers. It speaks one API, holds the provider connections and chooses the model that answers each request, so your code names a job instead of a model."
        >
          <RdRows rows={[
            ['One API in front of many models', 'Your code calls one endpoint with one key. The router translates the request for whichever provider it picks and returns the answer in the same shape, so changing models is a setting, not a rewrite.'],
            ['A decision per request', 'The router picks the model for this request: a strong coder for a bug fix, an inexpensive model for bulk tagging, a fast one for a one-line reply. A smart router makes that choice automatically, where a hard-coded model name never changes.'],
            ['Fallbacks when a provider fails', 'If the chosen model errors or times out, the router tries the next one, at another provider where it can, so an outage at one provider need not become an outage in your product.'],
            ['One place for logs and spend', 'Every request passes one point, so the model, latency, tokens and cost of each one land in one log, with budgets and limits on top.'],
          ]} />
        </RdSection>

        <RdSection
          id="signals"
          n={num('signals')}
          title="How does an AI router choose a model?"
          lead="Routers differ most in the signal behind the choice. Four are common, and many routers mix them."
        >
          <RdRows rows={[
            ['Rules you write', 'Requests that match a pattern go to a model you named: code to one, long documents to another. Predictable, and as current as the last time someone revisited the rules.'],
            ['Price and speed', 'The least expensive or the fastest model or provider that can serve the request. Clear on cost and latency, and quality is left to you.'],
            ['A prompt classifier', 'A small model labels each prompt with a task type and maps the type to a model, from the router’s own training data or from what other users choose for that type.'],
            ['Benchmark results', <>
              Every model runs the same tasks on a schedule, and the request goes to the model placing highest on the board for
              that job. The basis is public and checkable, and it moves when a model changes. This is how the{' '}
              <Link href="/router">Smart Router</Link> decides, with response time, price and your own traffic split available
              as modes of their own.
            </>],
          ]} />
        </RdSection>

        <RdSection
          id="live"
          n={num('live')}
          title="Where does each mode send a request right now?"
          lead={`The live router’s own picks for an example caller who holds a key for every provider. They move as the boards re-run: ${CADENCE}.`}
        >
          {snapshot ? (
            <>
              <LivePicks
                snapshot={snapshot}
                slugs={slugs}
                caption={<>A selection of the {MODE_COUNT} modes. Each pick links to the model’s page, with its scores and history.</>}
              />
              <AsOf>
                As of {utcStamp(snapshot.generatedAt)} · the router’s own picks for an example caller with keys for all {providerCount} providers
              </AsOf>
              <RdProse>
                <p>
                  Every mode, the rule it ranks on and an explorer with the request to send are on the{' '}
                  <Link href="/router#how">Smart Router page</Link>. The boards themselves are public:{' '}
                  <Link href="/best-llm-for-coding">best LLM for coding</Link>, <Link href="/best-llm-for-reasoning">best LLM for reasoning</Link>{' '}
                  and <Link href="/best-ai-model-for-agents">best AI model for agents</Link>.
                </p>
              </RdProse>
            </>
          ) : (
            <RdProse>
              <p>
                <Link href="/router#how">Read how each mode decides</Link> on the Smart Router page, or see the boards it ranks on:{' '}
                <Link href="/best-llm-for-coding">coding</Link>, <Link href="/best-llm-for-reasoning">reasoning</Link> and{' '}
                <Link href="/best-ai-model-for-agents">agents</Link>.
              </p>
            </RdProse>
          )}
        </RdSection>

        <RdSection
          id="smart"
          n={num('smart')}
          title="The Smart Router: an AI router that routes on benchmarks"
          lead="One OpenAI-compatible endpoint in front of every model on the leaderboard, with the model for each request chosen from the public boards."
        >
          <RdRows rows={[
            ['Modes that name a job', <>
              <code>auto-coding</code>, <code>auto-reasoning</code>, <code>auto-tooling</code> and <code>auto-best</code> rank on the
              boards. <code>auto-value</code> and <code>auto-fastest-quality</code> choose among the models within{' '}
              {VALUE_FLOOR_POINTS} points of the best, then by cost or speed. <code>auto-task</code> reads each request and picks the
              board itself. A statistical tie goes to your tie-break, cheapest per task by default.
            </>],
            ['Drift-aware', 'A model whose drift detector has fired on the suite your mode relies on, or that has an open canary incident, moves behind the healthy ones. The routing reason names any model passed over.'],
            ['Fallbacks and a circuit breaker', `Up to ${MAX_FALLBACKS} fallbacks on every request, your own order first. A model that fails ${CIRCUIT_FAILURES} times in a row is skipped for ${CIRCUIT_COOLDOWN_S} seconds and probed before it returns.`],
            ['Your keys, no markup', `Requests go out with your own provider keys, stored with ${KEY_CIPHER}, and each provider bills you at its own list price. Plans count routed requests: ${FREE_REQUESTS} a month on Free.`],
            ['Two APIs', <>
              An OpenAI-compatible <code>/v1/chat/completions</code> with streaming, tool calls and JSON output, and a native
              Anthropic <code>/v1/messages</code> for <Link href="/router/integrations/claude-code">Claude Code</Link>.
            </>],
            ['Explained on every response', <>The <code>X-AISM-Reasoning</code> header names the model, the provider and why it won.</>],
          ]} />
          <RdProse>
            <p>
              {OPENNESS} How each board is scored is on the <Link href="/methodology">methodology page</Link>, and every rule the
              router applies is on the <Link href="/router">Smart Router page</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection
          id="start"
          n={num('start')}
          title="Start routing in three steps"
          lead="Anything that takes an OpenAI-compatible base URL works, from the OpenAI SDKs to LangChain, Cursor and n8n."
        >
          <RdRows rows={[
            ['1. Add your provider keys', `Create a free account and add a key for each provider you use. Keys are stored encrypted with ${KEY_CIPHER}, and the modes rank only the models you hold keys for.`],
            ['2. Create a router key', 'One aism_ key reaches every provider you connected and every mode. It goes wherever your code expects an OpenAI key.'],
            ['3. Change the base URL', <>Point the client at <code>{ROUTER_BASE_URL}</code> and send a mode such as <code>auto-coding</code> as the model.</>],
          ]} />
          <RdCode title="Python · OpenAI SDK" label="auto-coding" code={PYTHON_SAMPLE} />
          <RdProse>
            <p>
              To try it before adding a provider key, send the <code>X-ASL-Sandbox: true</code> header: the request runs through the
              real routing and returns a mock answer in the real shape, with nothing called or counted. Every endpoint and
              parameter is in the <Link href="/router/docs">router documentation</Link>, and the{' '}
              <Link href="/router/integrations">integrations hub</Link> has the settings for each tool.
            </p>
          </RdProse>
        </RdSection>

        <RdSection
          id="compare"
          n={num('compare')}
          title="How does the Smart Router compare with other AI routers?"
          lead={`Side by side with ${others}, each described from its vendor’s own pages.`}
        >
          <ClusterTags current={PATH} label="Compare AI routers" />
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="AI router questions">
          <Faq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
