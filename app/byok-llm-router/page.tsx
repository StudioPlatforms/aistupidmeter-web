import type { Metadata } from 'next';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdRows, RdCode, RdFinal, tocNumber } from '@/components/landing/Reading';
import { CtaRow, LeaderboardCta, RouterCta } from '@/components/seo/Cta';
import JsonLd from '@/components/seo/JsonLd';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import {
  FREE_ROUTER, KEY_CIPHER, MAX_FALLBACKS, MODE_COUNT, PAID_ROUTER, ROUTER_APP_ID, ROUTER_BASE_URL, listJoin,
} from '@/components/seo/routers/routers-data';
import {
  BYOK_SAMPLE, KEY_REST_BASE_S, KEY_REST_MAX_S, ROUTING_PUBLISHED_ISO, exploreLinks, relatedGuides,
} from '@/components/seo/routing/routing-data';
import { planName } from '@/lib/pricing-display';
import { breadcrumbLd, faqLd, graphLd, pageMeta, webPageLd } from '@/lib/seo';
import { VENDORS, vendorMention } from '@/lib/seo-data';
import '@/styles/seo.css';
import '@/styles/seo-routers.css';

/**
 * /byok-llm-router: the Smart Router as a bring-your-own-key router. What BYOK means, how provider
 * keys and the router key are handled, who bills what, what routing does with the keys a caller
 * holds, their own servers beside them, and the request that shows which provider answered.
 *
 * ISR every fifteen minutes, no auth(). Nothing here is live data: the providers are the vendor
 * list, and plan allowances and prices are read from the plan table. No other product is named.
 */

const PATH = '/byok-llm-router';
const TITLE = 'BYOK LLM router: your keys, no markup';
const DESCRIPTION = 'A BYOK LLM router: bring your own provider keys, stored with AES-256-GCM. Providers bill you at list price, and the Smart Router adds no markup on tokens.';
const H1 = 'BYOK LLM router:';
const H1_ACCENT = 'your provider keys, no markup on tokens';

export const metadata: Metadata = pageMeta({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  type: 'article',
  publishedTime: ROUTING_PUBLISHED_ISO,
  keywords: [
    'BYOK LLM router', 'bring your own key LLM router', 'LLM router no markup', 'AI router with your own keys',
    'bring your own API key AI gateway', 'LLM gateway own provider keys', 'no markup LLM API', 'BYOK AI gateway',
    'LLM router alternative no markup', 'OpenAI compatible router own keys', 'provider keys encrypted AES-256-GCM',
  ],
});

export const revalidate = 900;

const TOC = [
  { id: 'what', label: 'What BYOK means' },
  { id: 'keys', label: 'How keys are handled' },
  { id: 'billing', label: 'Who bills what' },
  { id: 'routing', label: 'Routing with your keys' },
  { id: 'servers', label: 'Your own servers' },
  { id: 'start', label: 'Start' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

const VENDOR_NAMES = listJoin(VENDORS.map((v) => vendorMention(v)));
const VENDOR_LINKS = listJoin(VENDORS.map((v) => `[${vendorMention(v)}](${v.modelsPath})`));

export default function ByokLlmRouterPage(): React.JSX.Element {
  /* ── FAQ: the same strings feed the page and the FAQPage structured data ── */
  const faq: FaqItem[] = [
    {
      q: 'What is a BYOK LLM router?',
      a: `BYOK stands for bring your own key. A BYOK LLM router sits between your code and the model providers and sends each request with your own provider key, so each provider bills you directly and nothing is resold. The AI Stupid Level [Smart Router](/router) works this way on every plan: you add your provider keys, your code holds one router key, and the model for each request is chosen from the public boards.`,
    },
    {
      q: 'Does the router mark up tokens or charge a fee on my own keys?',
      a: `No. Requests go out with your own keys and each provider bills you at its own list price. The router adds nothing per token and takes no percentage of your spend, at any volume. Plans count routed requests instead. Free includes ${FREE_ROUTER}. ${PAID_ROUTER}. [Plans and prices](/pricing).`,
    },
    {
      q: 'Which providers can I bring a key for?',
      a: `${VENDOR_LINKS}. One key is enough to start, and the modes then rank that provider’s models. Each key you add widens the field and gives fallbacks another provider to go to.`,
    },
    {
      q: 'How is this different from a router that sells credits?',
      a: 'A credit-based router calls the providers on its own accounts and deducts usage from a balance you bought from it. A BYOK router sends each request with your key, so the provider’s bill is the whole token bill and your own rate limits and data terms apply. [AI aggregator](/ai-aggregator) explains the two billing models, and [Best AI routers in 2026](/best-ai-router) compares the options.',
    },
  ];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Smart Router', path: '/router' }, { name: 'BYOK LLM router', path: PATH }]),
    webPageLd({
      path: PATH,
      name: `${H1} ${H1_ACCENT}`,
      description: DESCRIPTION,
      type: 'TechArticle',
      datePublished: ROUTING_PUBLISHED_ISO,
      dateModified: ROUTING_PUBLISHED_ISO,
      about: { '@id': ROUTER_APP_ID },
    }),
    faqLd(faq),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        className="rd-routers"
        kicker="BYOK LLM router"
        title={H1}
        accent={H1_ACCENT}
        lead={<>
          A BYOK (bring your own key) LLM router sends each request with your own provider key, so the provider bills you
          directly. The AI Stupid Level Smart Router works this way on every plan: your keys for {VENDOR_NAMES}, stored with{' '}
          {KEY_CIPHER}, one router key in your code, and no markup on tokens.
        </>}
        actions={(
          <CtaRow className="is-stack">
            <RouterCta cta="byok-llm-router-hero-key" />
            <div className="seo-cta">
              <a className="lp-btn lp-btn-ghost" href="#keys" data-cta="byok-llm-router-hero-keys">See how keys are handled</a>
            </div>
          </CtaRow>
        )}
        aside={(
          <dl className="lp-facts">
            <div><dt>0%</dt><dd>markup on tokens. Providers bill you directly, at their own list price.</dd></div>
            <div><dt>{VENDORS.length}</dt><dd>providers you can connect a key for, and your own OpenAI-compatible servers.</dd></div>
            <div><dt>1</dt><dd>router key in your code. The provider keys stay in the router, encrypted.</dd></div>
          </dl>
        )}
        toc={TOC}
        final={(
          <RdFinal
            title="Your keys, your bill, one endpoint"
            lead={`Free includes ${FREE_ROUTER}.`}
            actions={(
              <CtaRow>
                <RouterCta cta="byok-llm-router-final-key" />
                <LeaderboardCta ghost cta="byok-llm-router-final-leaderboard" label="See the boards it routes on →" sub="Coding, Reasoning, Tool use and Combined, over 24 hours, 7 days and 30 days." />
              </CtaRow>
            )}
            explore={exploreLinks(PATH).map((l) => <Link key={l.path} href={l.path}>{l.label}</Link>)}
          />
        )}
      >
        <RdSection
          id="what"
          n={num('what')}
          title="What is a BYOK LLM router?"
          lead="Bring your own key means the router does not resell inference. You hold the accounts with the model providers. The router holds a key for each, sends every request with yours and returns the answer."
        >
          <RdRows rows={[
            ['Your accounts', 'Each provider bills you directly at its own list price, under your own agreement, rate limits and data terms with it.'],
            ['One key in your code', <>
              An <code>aism_</code> router key reaches every provider you connected, on one OpenAI-compatible endpoint. Your
              provider keys stay out of your application’s config.
            </>],
            ['Nothing resold', 'The router never answers a prompt itself and never buys tokens for you, so there is no inference balance to pre-pay.'],
          ]} />
        </RdSection>

        <RdSection
          id="keys"
          n={num('keys')}
          title="How does the Smart Router handle your keys?"
        >
          <RdRows rows={[
            ['Checked before it is saved', 'When you add a key, the router asks the provider whether it accepts it, with a request that costs nothing: a model list or a balance read. A key the provider refuses is not saved.'],
            ['Encrypted at rest', `Provider keys are stored with ${KEY_CIPHER} and are not shown again after you save them.`],
            ['Replaceable at any time', 'There is one key per provider. A replacement is checked first, and if the provider refuses it your current key stays in place. Remove a key and that provider’s models leave your routing. Check key asks the provider again whenever you want.'],
            ['The router key', <>
              Shown once, when you create it. The router keeps a SHA-256 hash of it and its first characters, to tell your keys
              apart, and you can revoke it. A tool that insists on an <code>sk-</code> prefix can send <code>sk-aism_…</code>.
            </>],
            ['Your prompts', 'Prompt logging is off unless you turn it on. Logged prompts are scrubbed of secrets before they are encrypted.'],
          ]} />
        </RdSection>

        <RdSection
          id="billing"
          n={num('billing')}
          title="Who bills what?"
          lead="Two bills, and they do not overlap: your providers bill tokens, and your plan covers routing."
        >
          <RdRows rows={[
            ['Tokens: your provider', 'Every token is billed by the provider that answered, on your account, at its list price. The router adds nothing per token and takes no share of your spend.'],
            ['Routing: your plan', `Plans count routed requests. Free includes ${FREE_ROUTER}. ${PAID_ROUTER}.`],
            ['What counts as a request', 'A request counts when it succeeds. One that fails on every model is not counted, a request a model refuses is not counted, and neither are sandbox requests or token counting on the Anthropic endpoint.'],
          ]} />
        </RdSection>

        <RdSection
          id="routing"
          n={num('routing')}
          title="What does routing do with the keys you bring?"
        >
          <RdRows rows={[
            ['Ranks what your keys reach', `Each of the ${MODE_COUNT} auto-* modes ranks the models of the providers you hold a key for. A caller with keys for two providers is ranked among those two providers’ models, and a third key widens the field.`],
            ['Fails over between your providers', <>
              Up to {MAX_FALLBACKS} fallbacks on every routed request, and the automatic ones prefer a provider that is not in the
              chain yet. <Link href="/llm-fallback-routing">LLM fallback routing</Link>.
            </>],
            ['Treats your limits as yours', `A 429 from your provider account rests that key on that model for ${KEY_REST_BASE_S} seconds, up to ${KEY_REST_MAX_S} seconds when it repeats, while other models take the request.`],
            ['Says which provider answered', <>
              <code>X-AISM-Provider</code> and <code>X-AISM-Model</code> on every response name the provider whose account will
              show the usage. When a key is missing or refused, the error code says which case it is: <code>no_provider_key</code>,{' '}
              <code>provider_key_rejected</code> or <code>provider_quota_exceeded</code>.
            </>],
          ]} />
        </RdSection>

        <RdSection
          id="servers"
          n={num('servers')}
          title="Can I bring my own servers as well?"
        >
          <RdProse>
            <p>
              Yes. From {planName('pro')} up, any OpenAI-compatible server you run or rent (vLLM, SGLang, llama.cpp, Ollama, LM
              Studio, TGI or a hosting company) can be added on the Providers page and named{' '}
              <code>ep/&lt;prefix&gt;/&lt;model&gt;</code>. Its API key, when it has one, is stored with {KEY_CIPHER} as well.{' '}
              <Link href="/router/docs#own-endpoints">Your own endpoints in the docs</Link>.
            </p>
            <p>
              In a workspace project, a request uses the project’s own key for that provider, then the workspace’s shared key,
              then, if the project allows it, the requester’s own. <Link href="/docs/teams#keys">Project keys and routing rules</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection
          id="start"
          n={num('start')}
          title="Start with your own keys"
        >
          <RdRows rows={[
            ['1. Add your provider keys', 'Create a free account and add a key for each provider you use.'],
            ['2. Create a router key', 'One aism_ key reaches every provider you connected and every mode. It goes wherever your code expects an OpenAI key.'],
            ['3. Change the base URL', <>Point the client at <code>{ROUTER_BASE_URL}</code> and send a mode such as <code>auto-best</code>, or a model id, as the model.</>],
          ]} />
          <RdCode title="cURL" label="your keys · auto-best" code={BYOK_SAMPLE} />
          <RdProse>
            <p>
              <code>X-AISM-Provider</code> names the provider whose key was used. <code>GET /v1/usage</code> then returns what the
              router itself counts: the month’s requests used and included. To try it before adding a provider key, send{' '}
              <code>X-ASL-Sandbox: true</code>: the routing is real, the answer is a mock, and nothing is called or counted.
            </p>
            <p>
              Every endpoint is in the <Link href="/router/docs">router documentation</Link>, and{' '}
              <Link href="/ai-router">what an AI router is</Link> covers the terms. Settings for each tool are in its guide:{' '}
              <Link href="/router/integrations/claude-code">Claude Code</Link>, which runs on your own Anthropic key,{' '}
              <Link href="/router/integrations/cursor">Cursor</Link>, <Link href="/router/integrations/langchain">LangChain</Link>{' '}
              and <Link href="/router/integrations/n8n">n8n</Link>, with the rest on the{' '}
              <Link href="/router/integrations">integrations hub</Link>. Related guides:
            </p>
          </RdProse>
          <ul className="rd-tags lp-up" aria-label="Routing guides">
            {relatedGuides(PATH).map((g) => <li key={g.path}><Link href={g.path}>{g.label}</Link></li>)}
          </ul>
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="Questions about bringing your own keys">
          <Faq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
