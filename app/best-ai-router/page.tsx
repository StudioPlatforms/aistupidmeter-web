import type { Metadata } from 'next';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdRows, RdFinal, tocNumber } from '@/components/landing/Reading';
import { CtaRow, LeaderboardCta, RouterCta } from '@/components/seo/Cta';
import JsonLd from '@/components/seo/JsonLd';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { ClusterLinks, RouterList, RouterTable, VendorSources } from '@/components/seo/routers/RouterBlocks';
import {
  CADENCE, CHECKED, CHECKED_ISO, FREE_ROUTER, KEY_CIPHER, MODE_COUNT, OPENNESS, OPENROUTER, OTHERS, ROUTER_APP_ID,
  aslEntry, cap, sourcesOf, word,
} from '@/components/seo/routers/routers-data';
import { breadcrumbLd, faqLd, graphLd, itemListLd, pageMeta, webPageLd } from '@/lib/seo';
import { VENDORS, getRoster, modelsOfVendor } from '@/lib/seo-data';
import '@/styles/seo.css';
import '@/styles/seo-routers.css';

/**
 * /best-ai-router: the AI routers and LLM routers of 2026 side by side. The Smart Router is ours and
 * listed first, and the page says so; every other entry restates its vendor's own pages as checked
 * on CHECKED (components/seo/routers/routers-data.ts), with the pages linked under Sources. The
 * "world's best AI router" question is answered with criteria, never with a claim.
 *
 * ISR every fifteen minutes, no auth(): the only live input is the roster count in the Smart
 * Router's entry.
 */

const PATH = '/best-ai-router';
const TITLE = 'Best AI routers and LLM routers in 2026';
const DESCRIPTION = 'The best AI routers and LLM routers of 2026 compared: how each picks the model, where it runs, your own keys and pricing, from each vendor’s own pages.';
const H1 = 'The best AI routers';
const H1_ACCENT = 'and LLM routers in 2026, compared';

export const metadata: Metadata = pageMeta({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  type: 'article',
  publishedTime: CHECKED_ISO,
  modifiedTime: CHECKED_ISO,
  keywords: [
    'best AI router', 'best LLM router', 'world’s best AI router', 'best AI model router', 'best smart router for AI',
    'AI router comparison', 'LLM router comparison', 'best AI gateway', 'best LLM gateway', 'AI routers 2026',
    'best free AI router', 'best LLM router for coding',
  ],
});

export const revalidate = 900;

const TOC = [
  { id: 'choose', label: 'How to choose' },
  { id: 'glance', label: 'At a glance' },
  { id: 'list', label: 'The routers' },
  { id: 'smart', label: 'The Smart Router' },
  { id: 'sources', label: 'Sources' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

export default async function BestAiRouterPage(): Promise<JSX.Element> {
  const roster = await getRoster();
  const providerCount = VENDORS.filter((v) => modelsOfVendor(roster, v.key).length > 0).length;
  const entries = [aslEntry(providerCount, roster.length), OPENROUTER, ...OTHERS];
  const sourceCount = sourcesOf(entries).length;

  /* ── FAQ: the same strings feed the page and the FAQPage structured data ── */
  const faq: FaqItem[] = [
    {
      q: 'What is the world’s best AI router?',
      a: 'No router is best for every team, so the useful answer is a set of criteria: what decides the model, whose keys pay for the tokens and at what markup, where it runs, how it fails over, and whether it explains each choice. The [Smart Router](/router) is built for teams who want the model chosen from public benchmark results, their own provider keys at every volume, no markup on tokens, and the reason for every pick in the response. This page sets the main options side by side, each from its vendor’s own pages.',
    },
    {
      q: 'What is the best LLM router for coding?',
      a: 'One that ranks models on coding results. The Smart Router’s auto-coding mode ranks on the Coding board: repository bug fixes graded by running the project’s own tests, re-run every four hours. It works in [Claude Code](/router/integrations/claude-code) through the native Anthropic endpoint and in [Cursor](/router/integrations/cursor), [Cline](/router/integrations/cline) and [Aider](/router/integrations/aider) through an OpenAI base URL. The board itself is on [best LLM for coding](/best-llm-for-coding).',
    },
    {
      q: 'What is the best free AI router?',
      a: `The Smart Router’s Free plan includes ${FREE_ROUTER}. Routing itself is not paywalled, and tokens are billed by each provider to your own account at its own list price. The free plans of the other routers on this page are listed with each one.`,
    },
    {
      q: 'What is the difference between an AI router and an AI gateway?',
      a: 'A gateway is the plumbing in front of the providers: one endpoint, keys, logs, budgets and retries. A router is the decision: which model answers each request. Most products here are some of both. [What an AI router is](/ai-router) explains the signals routers choose by, and [AI aggregator](/ai-aggregator) covers the access side.',
    },
    {
      q: 'Is OpenRouter an AI router?',
      a: 'Yes. OpenRouter puts hundreds of models behind one OpenAI-compatible API, and its Auto Router picks a model for each prompt from its task type and what the OpenRouter community spends on for that task. [OpenRouter alternatives](/openrouter-alternatives) compares it with the other options and shows how to switch.',
    },
    {
      q: 'How was this comparison put together?',
      a: `Each entry restates what its vendor’s own pages said on ${CHECKED}, and those pages are linked under Sources. Nothing is taken from review sites or from other vendors’ comparisons, and no entry says what a product lacks. If something has changed, tell us through the [contact page](/contact).`,
    },
  ];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Smart Router', path: '/router' }, { name: 'Best AI routers', path: PATH }]),
    webPageLd({
      path: PATH,
      name: `${H1} ${H1_ACCENT}`,
      description: DESCRIPTION,
      type: 'Article',
      datePublished: CHECKED_ISO,
      dateModified: CHECKED_ISO,
      about: { '@id': ROUTER_APP_ID },
    }),
    itemListLd({ name: 'AI routers and LLM routers compared', items: entries.map((e) => ({ name: e.name, url: e.url })) }),
    faqLd(faq),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        className="rd-routers"
        kicker="AI routers compared"
        title={H1}
        accent={H1_ACCENT}
        lead={<>
          {cap(word(entries.length))} AI routers and gateways, compared on what each vendor publishes about itself: what it is, how it
          picks the model, where it runs, your own provider keys and pricing. The Smart Router is ours and is listed first; every
          other entry is described from its vendor’s own pages, checked {CHECKED}.
        </>}
        actions={(
          <CtaRow className="is-stack">
            <RouterCta cta="best-router-hero-key" />
            <div className="seo-cta">
              <a className="lp-btn lp-btn-ghost" href="#glance" data-cta="best-router-hero-table">Jump to the comparison</a>
            </div>
          </CtaRow>
        )}
        aside={(
          <dl className="lp-facts">
            <div><dt>{entries.length}</dt><dd>AI routers and gateways, each described in its vendor’s own terms.</dd></div>
            <div><dt>{sourceCount}</dt><dd>vendor pages cited, every one linked under Sources.</dd></div>
            <div><dt>{MODE_COUNT}</dt><dd>auto-* modes in the Smart Router, ranked on public benchmark results.</dd></div>
          </dl>
        )}
        toc={TOC}
        final={(
          <RdFinal
            title="Route on benchmark results"
            lead={`Free includes ${FREE_ROUTER}.`}
            actions={(
              <CtaRow>
                <RouterCta cta="best-router-final-key" />
                <LeaderboardCta ghost cta="best-router-final-leaderboard" label="See the boards it routes on →" sub="Coding, Reasoning, Tool use and Combined, over 24 hours, 7 days and 30 days." />
              </CtaRow>
            )}
            explore={<ClusterLinks current={PATH} />}
          />
        )}
      >
        <RdSection
          id="choose"
          n={num('choose')}
          title="How to choose an AI router"
          lead="Six questions separate the options more than any feature list does."
        >
          <RdRows rows={[
            ['What decides the model?', 'Rules you write, price, a prompt classifier, what other users pick, or test results. It is the part of a router you cannot see from its API, and it decides what each request costs and how well it is answered.'],
            ['Whose keys pay for the tokens?', 'Credits bought from the router, your own provider keys, or both. With your own keys, each provider bills you directly, under your own terms and limits.'],
            ['Is there a markup?', 'A percentage on tokens, a fee on credits or above an allowance, a platform fee, or a flat plan. Read the pricing page together with the page on your own keys.'],
            ['Where does it run?', 'Hosted, so there is nothing to operate, or self-hosted, so the proxy runs on your own servers.'],
            ['What happens when a provider fails?', 'Fallbacks to another model or provider, retries, and whether a failing model is taken out of rotation for a while.'],
            ['Does it tell you why?', 'Whether each response names the model that answered and the reason it was chosen, so a routing decision can be checked after the fact.'],
          ]} />
        </RdSection>

        <RdSection
          id="glance"
          n={num('glance')}
          title="AI routers at a glance"
          lead="What each router is and how it picks the model, in its vendor’s own terms."
        >
          <RouterTable
            entries={entries}
            caption={<>{entries.length} AI routers and gateways. The Smart Router from its own code and plan table; the others as checked {CHECKED} on each vendor’s own pages, linked under Sources.</>}
          />
        </RdSection>

        <RdSection
          id="list"
          n={num('list')}
          title="The best AI routers, one by one"
          lead="Where each one runs, how it handles your own provider keys and what it costs, wherever the vendor publishes it."
        >
          <RouterList entries={entries} />
        </RdSection>

        <RdSection
          id="smart"
          n={num('smart')}
          title="What sets the Smart Router apart?"
          lead="It chooses the model from public benchmark results that anyone can check, and it adds nothing to token prices."
        >
          <RdRows rows={[
            ['Routes on test results', `Every model on the leaderboard runs the same coding, reasoning and tool-use tasks, ${CADENCE}. Each auto-* mode sends the request to the model placing highest on the board for that job, among the providers you hold keys for.`],
            ['Notices when a model changes', 'A drift detector per suite and an hourly canary watch every model. A model whose detector has fired, or that has an open canary incident, moves behind the healthy ones.'],
            ['Your keys at every volume', `Requests always go out with your own provider keys, stored with ${KEY_CIPHER}. Nothing is resold and nothing is added per token.`],
            ['Free to start', `Free includes ${FREE_ROUTER}.`],
            ['Explains every pick', <>The <code>X-AISM-Reasoning</code> header names the model, the provider and the reason, including any model passed over for drift or an outage.</>],
          ]} />
          <RdProse>
            <p>
              {OPENNESS} Every rule is on the <Link href="/router">Smart Router page</Link>, every endpoint in the{' '}
              <Link href="/router/docs">router documentation</Link>, and how the boards are scored on the{' '}
              <Link href="/methodology">methodology page</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="sources" n={num('sources')} title="Sources">
          <VendorSources entries={entries} />
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="Questions about choosing an AI router">
          <Faq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
