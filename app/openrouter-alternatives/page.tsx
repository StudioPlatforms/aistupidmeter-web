import type { Metadata } from 'next';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdRows, RdCode, RdFinal, tocNumber } from '@/components/landing/Reading';
import { CtaRow, RouterCta } from '@/components/seo/Cta';
import JsonLd from '@/components/seo/JsonLd';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { ClusterLinks, RouterList, RouterTable, VendorSources, VsTable } from '@/components/seo/routers/RouterBlocks';
import {
  CADENCE, CHECKED, CHECKED_ISO, CREDITS, FREE_ROUTER, KEY_CIPHER, MIGRATE_SAMPLE, MODE_COUNT, OPENNESS, OPENROUTER, OTHERS,
  PAID_ROUTER, ROUTER_APP_ID, ROUTER_BASE_URL, aslEntry, cap, listJoin, word,
} from '@/components/seo/routers/routers-data';
import { breadcrumbLd, faqLd, graphLd, itemListLd, pageMeta, webPageLd } from '@/lib/seo';
import { VENDORS, getRoster, modelsOfVendor } from '@/lib/seo-data';
import '@/styles/seo.css';
import '@/styles/seo-routers.css';

/**
 * /openrouter-alternatives: what OpenRouter is, in its own terms; why teams look for an
 * alternative, framed as needs rather than faults; the alternatives side by side, the Smart Router
 * first; OpenRouter and the Smart Router point by point; and the three steps to move a project.
 * Every OpenRouter sentence restates OpenRouter's own pages as checked on CHECKED
 * (components/seo/routers/routers-data.ts). Neutral on purpose: nothing here says what OpenRouter
 * lacks. ISR every fifteen minutes, no auth().
 */

const PATH = '/openrouter-alternatives';
const TITLE = 'OpenRouter alternatives in 2026, compared';
const DESCRIPTION = 'OpenRouter alternatives compared: AI routers and gateways with your own keys, no token markup or a free tier, and how to switch from OpenRouter in 3 steps.';
const H1 = 'OpenRouter alternatives';
const H1_ACCENT = 'in 2026: AI routers and gateways compared';

export const metadata: Metadata = pageMeta({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  type: 'article',
  publishedTime: CHECKED_ISO,
  modifiedTime: CHECKED_ISO,
  keywords: [
    'OpenRouter alternative', 'OpenRouter alternatives', 'sites like OpenRouter', 'OpenRouter competitors',
    'OpenRouter vs', 'OpenRouter alternative BYOK', 'OpenRouter alternative no markup', 'free OpenRouter alternative',
    'OpenRouter alternative bring your own key', 'switch from OpenRouter', 'migrate from OpenRouter', 'OpenRouter vs Smart Router',
  ],
});

export const revalidate = 900;

const TOC = [
  { id: 'what', label: 'What OpenRouter is' },
  { id: 'why', label: 'Why look elsewhere' },
  { id: 'glance', label: 'At a glance' },
  { id: 'vs', label: 'OpenRouter vs Smart Router' },
  { id: 'list', label: 'The alternatives' },
  { id: 'switch', label: 'Switch in three steps' },
  { id: 'sources', label: 'Sources' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

export default async function OpenRouterAlternativesPage(): Promise<JSX.Element> {
  const roster = await getRoster();
  const providerCount = VENDORS.filter((v) => modelsOfVendor(roster, v.key).length > 0).length;
  const asl = aslEntry(providerCount, roster.length);
  const alternatives = [asl, ...OTHERS];
  const everyone = [asl, OPENROUTER, ...OTHERS];
  const otherNames = listJoin(OTHERS.map((e) => e.name));
  const allNames = listJoin(alternatives.map((e) => (e.key === 'asl' ? 'the AI Stupid Level Smart Router' : e.name)));

  /* ── FAQ: the same strings feed the page and the FAQPage structured data ── */
  const faq: FaqItem[] = [
    {
      q: 'What is the best OpenRouter alternative?',
      a: `It depends on what you want to change. If you want the model chosen from public benchmark results, your own provider keys at every volume and no markup on tokens, the [Smart Router](/router) is built for exactly that. This page also compares ${otherNames}, each from its vendor’s own pages.`,
    },
    {
      q: 'Is there an OpenRouter alternative with bring your own key (BYOK)?',
      a: `Yes. The Smart Router always sends requests with your own provider keys, at every volume, stored encrypted with ${KEY_CIPHER}. Each provider bills you directly at its own list price, and nothing is added per token. Several of the other gateways here take your own keys too; the list on this page says how each one handles them.`,
    },
    {
      q: 'Is there a free OpenRouter alternative?',
      a: `The Smart Router’s Free plan includes ${FREE_ROUTER}. Tokens are billed by each provider to your own account at its own list price. [Plans and prices](/pricing).`,
    },
    {
      q: 'Is there an OpenRouter alternative with no markup?',
      a: `Yes. The Smart Router takes nothing per token: requests go out with your own keys and each provider bills you at its list price. Plans count routed requests instead: ${PAID_ROUTER}. Past an allowance, ${CREDITS}.`,
    },
    {
      q: 'What are some sites like OpenRouter?',
      a: `Sites like OpenRouter put models from many providers behind one API: AI routers, AI gateways and AI aggregators. This page compares ${allNames}, each from its vendor’s own pages. [What an AI aggregator is](/ai-aggregator) explains the category.`,
    },
    {
      q: 'Who are OpenRouter’s competitors?',
      a: `Other AI routers and gateways, among them the Smart Router, ${otherNames}. [Best AI routers in 2026](/best-ai-router) sets them side by side on how each picks the model, where it runs, your own keys and pricing.`,
    },
    {
      q: 'OpenRouter vs Smart Router: what is the difference?',
      a: `They choose the model differently. OpenRouter’s Auto Router gives each prompt a task type and ranks models by what the OpenRouter community spends on for that task over a trailing 7-day window. The Smart Router ranks on public benchmark results: every model on the same coding, reasoning and tool-use tasks, ${CADENCE}, and a model whose drift detector has fired moves behind the healthy ones. The Smart Router always uses your own provider keys, with no markup on tokens.`,
    },
    {
      q: 'How do I migrate from OpenRouter to the Smart Router?',
      a: `In three steps. Create a free account and add a key for each provider you use. Create a router key. Then point your OpenAI client at ${ROUTER_BASE_URL} instead of OpenRouter’s base URL, and send an auto-* mode such as auto-coding as the model, or a model id exactly as GET /v1/models lists it. The [router documentation](/router/docs) has every parameter.`,
    },
  ];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Smart Router', path: '/router' }, { name: 'OpenRouter alternatives', path: PATH }]),
    webPageLd({
      path: PATH,
      name: `${H1} ${H1_ACCENT}`,
      description: DESCRIPTION,
      type: 'Article',
      datePublished: CHECKED_ISO,
      dateModified: CHECKED_ISO,
      about: { '@id': ROUTER_APP_ID },
    }),
    itemListLd({ name: 'OpenRouter alternatives', items: alternatives.map((e) => ({ name: e.name, url: e.url })) }),
    faqLd(faq),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        className="rd-routers"
        kicker="OpenRouter alternatives"
        title={H1}
        accent={H1_ACCENT}
        lead={<>
          OpenRouter puts hundreds of models from many providers behind one API. Teams look elsewhere when they want something
          specific: the model chosen from benchmark results, their own provider keys at every volume, or a different way to pay.
          Here are {word(alternatives.length)} alternatives, each described from its vendor’s own pages as checked {CHECKED}, and
          the three steps to switch.
        </>}
        actions={(
          <CtaRow className="is-stack">
            <RouterCta cta="openrouter-alt-hero-key" />
            <div className="seo-cta">
              <a className="lp-btn lp-btn-ghost" href="#switch" data-cta="openrouter-alt-hero-switch">How to switch in three steps</a>
            </div>
          </CtaRow>
        )}
        aside={(
          <dl className="lp-facts">
            <div><dt>{alternatives.length}</dt><dd>alternatives compared, each from its vendor’s own pages.</dd></div>
            <div><dt>3</dt><dd>steps to move a project: provider keys, a router key, the base URL.</dd></div>
            <div><dt>0%</dt><dd>markup on tokens with the Smart Router. Providers bill you directly.</dd></div>
          </dl>
        )}
        toc={TOC}
        final={(
          <RdFinal
            title="Move a project in three steps"
            lead={`Free includes ${FREE_ROUTER}.`}
            actions={(
              <CtaRow className="is-stack">
                <RouterCta cta="openrouter-alt-final-key" />
                <div className="seo-cta">
                  <Link className="lp-btn lp-btn-ghost" href="/router/docs" data-cta="openrouter-alt-final-docs">Read the router documentation</Link>
                </div>
              </CtaRow>
            )}
            explore={<ClusterLinks current={PATH} />}
          />
        )}
      >
        <RdSection
          id="what"
          n={num('what')}
          title="What is OpenRouter?"
          lead={`OpenRouter is ${OPENROUTER.what.charAt(0).toLowerCase()}${OPENROUTER.what.slice(1)}`}
        >
          <RdRows rows={[
            ['How it picks the model', OPENROUTER.picks],
            ['Pricing', OPENROUTER.pricing],
            ['Your own provider keys', OPENROUTER.keys],
          ]} />
          <RdProse>
            <p>As described on OpenRouter’s own pages, checked {CHECKED}; the pages are linked under Sources.</p>
          </RdProse>
        </RdSection>

        <RdSection
          id="why"
          n={num('why')}
          title="Why do teams look for an OpenRouter alternative?"
          lead="Usually for one of four reasons. Each is a different trade-off rather than a verdict on OpenRouter."
        >
          <RdRows rows={[
            ['The model chosen from test results', 'OpenRouter’s Auto Router ranks models by what its community spends on for each task type. Some teams would rather the choice came from fixed tasks that every model runs on the same schedule, with the results public.'],
            ['Their own keys at any volume', 'Some teams want every request on their own provider accounts, under their own terms, limits and data agreements, at every volume.'],
            ['To know when a model changes', 'A model can change behind a stable name. Some teams want a router that watches each model for drift and routes around one that has slipped.'],
            ['A different way to pay', 'Paying each provider directly for tokens, and a flat plan for the routing, instead of buying credits.'],
          ]} />
        </RdSection>

        <RdSection
          id="glance"
          n={num('glance')}
          title="OpenRouter alternatives at a glance"
          lead="OpenRouter and the alternatives: what each is and how it picks the model, in its vendor’s own terms."
        >
          <RouterTable
            entries={everyone}
            caption={<>OpenRouter and {alternatives.length} alternatives. The Smart Router from its own code and plan table; the others as checked {CHECKED} on each vendor’s own pages, linked under Sources.</>}
          />
        </RdSection>

        <RdSection
          id="vs"
          n={num('vs')}
          title="OpenRouter vs Smart Router"
          lead="The two side by side, on the points where they differ most."
        >
          <VsTable
            other="OpenRouter"
            caption={<>The Smart Router from its code and plan table; OpenRouter from its own pages, checked {CHECKED}.</>}
            rows={[
              [
                'How it picks the model',
                `Each of ${MODE_COUNT} auto-* modes ranks on a public board (Coding, Reasoning, Tool use or Combined) or on response time, price or your own split, among the providers you hold keys for. A model whose drift detector has fired moves behind the healthy ones.`,
                'The Auto Router gives each prompt one of about 30 task types with a lightweight classifier, then ranks models by what the OpenRouter community spends on for that task over a trailing 7-day window.',
              ],
              [
                'Your own provider keys',
                `Always, at every volume, stored encrypted with ${KEY_CIPHER}.`,
                'Supported. Pay-as-you-go includes $25,000 a month of list-price usage with no fee on your own keys; above that, the fee is 5% of what the same model and provider would cost on OpenRouter.',
              ],
              [
                'Token pricing',
                'No markup: each provider bills you directly at its own list price.',
                'Provider prices passed through with no markup on inference; a fee applies when you buy credits.',
              ],
              [
                'Free use',
                `${cap(FREE_ROUTER)}.`,
                'Free models carry low rate limits: 50 requests a day, or 1,000 a day after buying at least 10 credits.',
              ],
            ]}
          />
          <RdProse>
            <p>
              The boards the Smart Router ranks on are public: <Link href="/best-llm-for-coding">best LLM for coding</Link>,{' '}
              <Link href="/best-llm-for-reasoning">best LLM for reasoning</Link> and{' '}
              <Link href="/best-ai-model-for-agents">best AI model for agents</Link>. {OPENNESS}
            </p>
          </RdProse>
        </RdSection>

        <RdSection
          id="list"
          n={num('list')}
          title="The OpenRouter alternatives, one by one"
          lead="Where each one runs, how it handles your own provider keys and what it costs, wherever the vendor publishes it."
        >
          <RouterList entries={alternatives} />
        </RdSection>

        <RdSection
          id="switch"
          n={num('switch')}
          title="How to switch from OpenRouter to the Smart Router"
          lead="Three steps, and three lines of code: the base URL, the key and the model."
        >
          <RdRows rows={[
            ['1. Connect your provider keys', `Create a free account and add a key for each provider you use. The keys are stored encrypted with ${KEY_CIPHER}, and each provider bills you directly at its own list price.`],
            ['2. Create a router key', 'One aism_ key takes the place of your OpenRouter key in your code and reaches every provider you connected.'],
            ['3. Change the base URL and the model', <>
              Point the client at <code>{ROUTER_BASE_URL}</code> and send an auto-* mode such as <code>auto-coding</code> as the
              model, or a model id exactly as <code>GET /v1/models</code> lists it. Your fallback order, exclusions and cost and
              latency caps live in Preferences.
            </>],
          ]} />
          <RdCode title="Node · OpenAI SDK" label="three lines change" code={MIGRATE_SAMPLE} />
          <RdProse>
            <p>
              To try the switch before adding any provider key, send the <code>X-ASL-Sandbox: true</code> header: the request runs
              through the real routing and returns a mock answer in the real shape, and nothing is called or counted. Claude Code
              connects through the native Anthropic endpoint instead: <Link href="/router/integrations/claude-code">Claude Code with
              the Smart Router</Link>. Settings for Cursor, Cline, LangChain, n8n and more are on the{' '}
              <Link href="/router/integrations">integrations hub</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="sources" n={num('sources')} title="Sources">
          <VendorSources entries={everyone} />
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="OpenRouter alternative questions">
          <Faq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
