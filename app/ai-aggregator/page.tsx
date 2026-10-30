import type { Metadata } from 'next';
import Link from 'next/link';
import { Fragment } from 'react';
import { ReadingPage, RdSection, RdProse, RdRows, RdCode, RdFinal, tocNumber } from '@/components/landing/Reading';
import { CtaRow, LeaderboardCta, RouterCta } from '@/components/seo/Cta';
import JsonLd from '@/components/seo/JsonLd';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { ClusterLinks, ClusterTags } from '@/components/seo/routers/RouterBlocks';
import {
  CADENCE, CHECKED_ISO, CREDITS, CURL_SAMPLE, FREE_ROUTER, KEY_CIPHER, MAX_FALLBACKS, MODE_COUNT, OPENNESS, OPENROUTER,
  OTHERS, PAID_ROUTER, ROUTER_APP_ID, ROUTER_BASE_URL, VALUE_FLOOR_POINTS, listJoin, word,
} from '@/components/seo/routers/routers-data';
import { breadcrumbLd, faqLd, graphLd, pageMeta, webPageLd } from '@/lib/seo';
import { VENDORS, byDisplayName, getRoster, modelsOfVendor } from '@/lib/seo-data';
import '@/styles/seo.css';
import '@/styles/seo-routers.css';

/**
 * /ai-aggregator: what an AI aggregator (LLM aggregator, AI API aggregator) is, the two ways
 * aggregators bill, every model the Smart Router aggregates (read from the roster at render time),
 * and how aggregation and routing fit together. ISR every fifteen minutes, no auth(). Static copy
 * names providers only; every model name is live data from /api/models.
 */

const PATH = '/ai-aggregator';
const TITLE = 'AI aggregator: one API for many LLMs';
const DESCRIPTION = 'An AI aggregator puts many LLMs behind one API. The Smart Router aggregates OpenAI, Anthropic, Google, DeepSeek and more, with your own keys and no markup.';
const H1 = 'AI aggregator:';
const H1_ACCENT = 'every model on the leaderboard, one API';

export const metadata: Metadata = pageMeta({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  type: 'article',
  publishedTime: CHECKED_ISO,
  keywords: [
    'AI aggregator', 'LLM aggregator', 'AI API aggregator', 'AI model aggregator', 'LLM API aggregator',
    'one API for all AI models', 'one API key for every LLM', 'unified LLM API', 'multi-provider LLM API',
    'OpenAI compatible API for Claude and Gemini', 'AI aggregator with your own keys',
  ],
});

export const revalidate = 900;

const TOC = [
  { id: 'what', label: 'What is an AI aggregator?' },
  { id: 'billing', label: 'Credits or your keys' },
  { id: 'models', label: 'Models aggregated' },
  { id: 'routing', label: 'Aggregator and router' },
  { id: 'start', label: 'Start' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

const VENDOR_NAMES = listJoin(VENDORS.map((v) => v.label));

export default async function AiAggregatorPage(): Promise<JSX.Element> {
  const roster = await getRoster();
  const groups = VENDORS
    .map((v) => ({ v, models: [...modelsOfVendor(roster, v.key)].sort(byDisplayName) }))
    .filter((g) => g.models.length > 0);
  const modelCount = groups.reduce((s, g) => s + g.models.length, 0);
  const providerCount = groups.length;
  const names = listJoin([OPENROUTER, ...OTHERS].map((e) => e.name));

  /* ── FAQ: the same strings feed the page and the FAQPage structured data ── */
  const faq: FaqItem[] = [
    {
      q: 'What is an AI aggregator?',
      a: `An AI aggregator is a service that puts models from several AI providers behind one API, one key and one log, so an application is written once and can call any of them. The AI Stupid Level [Smart Router](/router) aggregates ${VENDOR_NAMES} behind one OpenAI-compatible endpoint, with your own provider keys and no markup on tokens, and also chooses the model for each request from public benchmark results.`,
    },
    {
      q: 'What is an LLM aggregator or an AI API aggregator?',
      a: 'The same thing under other names. An LLM aggregator puts large language models from several providers behind one API; an AI API aggregator stresses that the providers’ APIs are what is being combined. Either way, your code speaks one request format and the aggregator speaks each provider’s.',
    },
    {
      q: 'Is an AI aggregator the same as an AI router?',
      a: 'An aggregator gives you access: many models behind one API. A router adds the decision: which of those models answers each request. The Smart Router is both. Its auto-* modes rank on the public boards, so a request sent as auto-coding goes to the model placing highest on the Coding board among the providers you hold keys for. More on [what an AI router is](/ai-router).',
    },
    {
      q: 'Do I need an account with every provider?',
      a: `You add a key for each provider you want in play, and the modes rank only the models those keys reach. Two keys give you a router across those two providers’ models, and more keys widen it. Each provider bills you directly, under your own terms and limits with it, and the keys are stored encrypted with ${KEY_CIPHER}.`,
    },
    {
      q: 'Does an AI aggregator cost more than calling providers directly?',
      a: `Not on tokens with the Smart Router: requests go out with your own keys and each provider bills you at its own list price. Plans count routed requests instead. Free includes ${FREE_ROUTER}. ${PAID_ROUTER}. Past an allowance, ${CREDITS}. [Plans and prices](/pricing).`,
    },
    {
      q: 'Which AI aggregators and routers are there?',
      a: `Besides the Smart Router, the AI routers and gateways in the same space include ${names}. [Best AI routers in 2026](/best-ai-router) compares them from each vendor’s own pages, and [OpenRouter alternatives](/openrouter-alternatives) adds the steps to switch.`,
    },
  ];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Smart Router', path: '/router' }, { name: 'AI aggregator', path: PATH }]),
    webPageLd({
      path: PATH,
      name: `${H1} ${H1_ACCENT}`,
      description: DESCRIPTION,
      type: 'TechArticle',
      datePublished: CHECKED_ISO,
      dateModified: CHECKED_ISO,
      about: { '@id': ROUTER_APP_ID },
    }),
    faqLd(faq),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        className="rd-routers"
        kicker="AI aggregator"
        title={H1}
        accent={H1_ACCENT}
        lead={<>
          An AI aggregator, or LLM aggregator, gathers models from several providers behind one API. The Smart Router puts{' '}
          {VENDOR_NAMES} behind one OpenAI-compatible endpoint, with your own provider keys and no markup on tokens, and goes
          one step further: it picks the model for each request from public benchmark results.
        </>}
        actions={(
          <CtaRow className="is-stack">
            <RouterCta cta="ai-aggregator-hero-key" />
            <div className="seo-cta">
              <a className="lp-btn lp-btn-ghost" href="#models" data-cta="ai-aggregator-hero-models">See every model it reaches</a>
            </div>
          </CtaRow>
        )}
        aside={(
          <dl className="lp-facts">
            {providerCount > 0 && <div><dt>{providerCount}</dt><dd>providers behind one OpenAI-compatible endpoint.</dd></div>}
            {modelCount > 0 && <div><dt>{modelCount}</dt><dd>models, every one tested on the same benchmark tasks.</dd></div>}
            <div><dt>0%</dt><dd>markup on tokens. Providers bill you directly, at their own list price.</dd></div>
          </dl>
        )}
        toc={TOC}
        final={(
          <RdFinal
            title="Every model on the leaderboard, one key"
            lead={`Free includes ${FREE_ROUTER}.`}
            actions={(
              <CtaRow>
                <RouterCta cta="ai-aggregator-final-key" />
                <LeaderboardCta ghost cta="ai-aggregator-final-leaderboard" label="Compare the models first →" sub="Coding, Reasoning, Tool use and Combined, over 24 hours, 7 days and 30 days." />
              </CtaRow>
            )}
            explore={<ClusterLinks current={PATH} />}
          />
        )}
      >
        <RdSection
          id="what"
          n={num('what')}
          title="What is an AI aggregator?"
          lead="An AI aggregator, also called an LLM aggregator or AI API aggregator, puts models from several providers behind one API, one key and one log. Your code is written once against that API, and changing model or provider is a change of model name."
        >
          <RdRows rows={[
            ['One integration', 'One SDK, one request format and one error format, whichever provider answers. The Smart Router speaks the OpenAI API, and Anthropic’s Messages API for Claude Code.'],
            ['One key in your code', `An aism_ router key reaches every provider you connected. The provider keys stay in the router, encrypted with ${KEY_CIPHER}, instead of in your application’s config.`],
            ['One log', 'The model, provider, latency, tokens and cost of every request in one place, with exports and budget limits on the paid plans.'],
            ['Fallbacks across providers', `When a model fails, the next one answers, at another provider where you hold a key: up to ${MAX_FALLBACKS} fallbacks on every request.`],
          ]} />
        </RdSection>

        <RdSection
          id="billing"
          n={num('billing')}
          title="Credits or your own keys?"
          lead="Aggregators bill in one of two ways, and the difference decides whose account the tokens run on."
        >
          <RdRows rows={[
            ['Credits', 'You buy credits from the aggregator, it calls the providers on its own accounts, and usage is deducted from your balance: one bill, on the aggregator’s terms.'],
            ['Your own keys', 'You connect your own provider accounts and the aggregator sends each request with your key. Each provider bills you directly at its own list price, under your own agreement, limits and data terms with it.'],
          ]} />
          <RdProse>
            <p>
              The Smart Router always works with your own keys, at every volume. Nothing is resold and nothing is added per token;
              plans count routed requests. Free includes {FREE_ROUTER}, and the <Link href="/pricing">paid plans</Link> add volume,
              longer decision logs, API monitoring and team features.
            </p>
          </RdProse>
        </RdSection>

        <RdSection
          id="models"
          n={num('models')}
          title="Which models does the Smart Router aggregate?"
          lead="Every model on the leaderboard, read from the roster as this page was rendered. Each one has its own page with its scores, its history and its drift detectors."
        >
          {groups.length > 0 ? (
            <div className="rd-table-wrap seo-table-wrap rt-table-wrap lp-up">
              <table className="rd-table seo-table rt-table rt-roster">
                <caption>
                  {modelCount} models from {word(providerCount)} providers. The router reaches the ones you hold a provider key for, and any of them can
                  also be pinned by its id from <code>GET /v1/models</code>.
                </caption>
                <thead>
                  <tr><th scope="col">Provider</th><th scope="col">Models on the leaderboard</th><th scope="col">API status</th></tr>
                </thead>
                <tbody>
                  {groups.map(({ v, models }) => (
                    <tr key={v.key}>
                      <th scope="row"><Link href={v.modelsPath}>{v.label}</Link></th>
                      <td className="rt-models">
                        {models.map((m, i) => (
                          <Fragment key={m.id}>
                            {i > 0 && ', '}
                            <Link href={`/models/${m.slug}`}>{m.displayName}</Link>
                          </Fragment>
                        ))}
                      </td>
                      <td><Link href={v.statusPath}>{v.label} status</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <RdProse>
              <p>
                Every model on the <Link href="/">leaderboard</Link>, from {VENDOR_NAMES}. Each provider’s models are on its own
                page: {VENDORS.map((v, i) => (
                  <Fragment key={v.key}>{i > 0 && (i === VENDORS.length - 1 ? ' and ' : ', ')}<Link href={v.modelsPath}>{v.label}</Link></Fragment>
                ))}.
              </p>
            </RdProse>
          )}
        </RdSection>

        <RdSection
          id="routing"
          n={num('routing')}
          title="An AI aggregator that also picks the model"
          lead={`Aggregation puts every model behind one API; the Smart Router also decides which one answers. Its ${MODE_COUNT} auto-* modes rank on the public boards, re-run on a fixed schedule: ${CADENCE}.`}
        >
          <RdRows rows={[
            [<code key="c">auto-coding</code>, 'The Coding board: repository bug fixes graded by running the project’s own tests.'],
            [<code key="r">auto-reasoning</code>, 'The Reasoning board: long, multi-turn working sessions.'],
            [<code key="t">auto-tooling</code>, 'The Tool use board: sandboxed agent tasks with real tools.'],
            [<code key="v">auto-value</code>, `Among the models within ${VALUE_FLOOR_POINTS} points of the best Combined score, the most points per dollar of a scored run.`],
            [<code key="k">auto-task</code>, 'Decided per request from what it contains: code, tools, design and planning, or long text.'],
          ]} />
          <RdProse>
            <p>
              {OPENNESS} The router’s live pick for each mode is on <Link href="/ai-router#live">AI router</Link>, and every
              mode with its rule on the <Link href="/router#how">Smart Router page</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection
          id="start"
          n={num('start')}
          title="Start in three steps"
          lead="Add your provider keys, create a router key, change the base URL."
        >
          <RdRows rows={[
            ['1. Add your provider keys', 'Create a free account and add a key for each provider you use. Each one widens the set of models the modes can rank.'],
            ['2. Create a router key', 'One aism_ key for every provider and every mode, used wherever your code expects an OpenAI key.'],
            ['3. Change the base URL', <>Point any OpenAI-compatible client at <code>{ROUTER_BASE_URL}</code>, and send a mode or a model id as the model.</>],
          ]} />
          <RdCode title="cURL" label="auto-best" code={CURL_SAMPLE} />
          <RdProse>
            <p>
              Guides for <Link href="/router/integrations/claude-code">Claude Code</Link>, <Link href="/router/integrations/cursor">Cursor</Link>,{' '}
              <Link href="/router/integrations/langchain">LangChain</Link>, <Link href="/router/integrations/n8n">n8n</Link> and more are on
              the <Link href="/router/integrations">integrations hub</Link>; every endpoint is in the{' '}
              <Link href="/router/docs">router documentation</Link>.
            </p>
          </RdProse>
          <ClusterTags current={PATH} label="AI router guides" />
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="AI aggregator questions">
          <Faq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
