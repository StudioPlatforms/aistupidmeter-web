import type { Metadata } from 'next';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdRows, RdCode, RdFinal, tocNumber } from '@/components/landing/Reading';
import { CtaRow, LeaderboardCta, RouterCta } from '@/components/seo/Cta';
import JsonLd from '@/components/seo/JsonLd';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import {
  CIRCUIT_COOLDOWN_S, CIRCUIT_FAILURES, FREE_ROUTER, MAX_FALLBACKS, ROUTER_APP_ID, cap, word,
} from '@/components/seo/routers/routers-data';
import {
  CIRCUIT_PROBE_SUCCESSES, FALLBACK_SAMPLE, FIRST_BYTE_DEADLINE_S, KEY_REST_BASE_S, KEY_REST_MAX_S, MAX_AUTO_FALLBACKS,
  MAX_OWN_LIST, ROUTING_PUBLISHED_ISO, exploreLinks, relatedGuides,
} from '@/components/seo/routing/routing-data';
import { breadcrumbLd, faqLd, graphLd, pageMeta, webPageLd } from '@/lib/seo';
import { getProviders } from '@/lib/seo-data';
import '@/styles/seo.css';
import '@/styles/seo-routers.css';

/**
 * /llm-fallback-routing: what the Smart Router does when a model fails. How the fallback chain is
 * built and in what order, which failures move a request to the next model, the per-model circuit
 * breaker, what streaming changes, the sandbox request that shows a fallback in the headers, and
 * the status a client gets when every model failed.
 *
 * ISR every fifteen minutes, no auth(). The one live number is the interval between provider
 * health checks, from GET /providers/status. Static copy names no model.
 */

const PATH = '/llm-fallback-routing';
const TITLE = 'LLM fallback routing and failover';
const DESCRIPTION = 'LLM fallback routing in the Smart Router: up to 5 fallback models per request, a per-model circuit breaker, and failover before the first streamed byte.';
const H1 = 'LLM fallback routing:';
const H1_ACCENT = 'failover across models and providers';

export const metadata: Metadata = pageMeta({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  type: 'article',
  publishedTime: ROUTING_PUBLISHED_ISO,
  keywords: [
    'LLM fallback routing', 'LLM failover', 'fallback models', 'LLM fallback', 'model fallback chain', 'AI failover routing',
    'LLM circuit breaker', 'provider outage failover', 'LLM gateway fallback', 'multi-provider LLM failover',
    'streaming fallback LLM', 'automatic model fallback',
  ],
});

export const revalidate = 900;

const TOC = [
  { id: 'chain', label: 'How the chain is built' },
  { id: 'triggers', label: 'What triggers a fallback' },
  { id: 'breaker', label: 'The circuit breaker' },
  { id: 'streaming', label: 'Streaming' },
  { id: 'verify', label: 'See a fallback' },
  { id: 'errors', label: 'When every model fails' },
  { id: 'setup', label: 'Set it up' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

export default async function LlmFallbackRoutingPage(): Promise<React.JSX.Element> {
  const providers = await getProviders();
  // Minutes between provider health checks, from /providers/status; worded without a number when the feed did not answer.
  const interval = providers?.meta.checkIntervalMinutes ?? null;
  const probe = interval ? `every ${interval} minutes` : 'on a fixed schedule';

  /* ── FAQ: the same strings feed the page and the FAQPage structured data ── */
  const faq: FaqItem[] = [
    {
      q: 'What is LLM fallback routing?',
      a: `Fallback routing sends a request to a second model when the first one fails, so an error at one model or provider need not become an error in your application. The AI Stupid Level [Smart Router](/router) builds the chain before the first attempt: up to ${MAX_FALLBACKS} fallbacks on every routed request, your own fallback order first, then up to ${MAX_AUTO_FALLBACKS} automatic picks that prefer another provider. The response headers name the model that answered.`,
    },
    {
      q: 'What is the difference between fallback and failover?',
      a: `They describe the same move at two scales. Fallback is the rule for one request: this model failed, try the next. Failover is what that adds up to when a provider is down: traffic moves to another provider and comes back when the first one answers again. In the Smart Router the chain does the first and the circuit breaker the second.`,
    },
    {
      q: 'How many fallback models does a request get?',
      a: `At most ${MAX_FALLBACKS}. With no fallback order of your own, a request has its primary model and up to ${MAX_AUTO_FALLBACKS} automatic fallbacks. Your own order can hold up to ${MAX_OWN_LIST} models, and the chain takes them first.`,
    },
    {
      q: 'Do fallbacks apply when I name a model?',
      a: 'Fallbacks belong to routed requests: auto and the auto-* modes. A request that names a model id is sent to that model and no other, which is what naming a model is for. To get a chain, send a mode.',
    },
    {
      q: 'Does a failed attempt count against my plan?',
      a: 'No. Plans count successful requests. A request that fails on every model is not counted, and one that a fallback answers is counted once. [Plans and prices](/pricing).',
    },
  ];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Smart Router', path: '/router' }, { name: 'LLM fallback routing', path: PATH }]),
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
        kicker="LLM fallback routing"
        title={H1}
        accent={H1_ACCENT}
        lead={<>
          When a model errors, times out or stops answering, the AI Stupid Level Smart Router sends the same request to the next
          model in a chain it built before the first attempt: up to {MAX_FALLBACKS} fallbacks, your own order first, then
          automatic picks that prefer another provider. A model that keeps failing is skipped for {CIRCUIT_COOLDOWN_S} seconds,
          and the response says which model answered.
        </>}
        actions={(
          <CtaRow className="is-stack">
            <RouterCta cta="llm-fallback-routing-hero-key" />
            <div className="seo-cta">
              <a className="lp-btn lp-btn-ghost" href="#verify" data-cta="llm-fallback-routing-hero-verify">See a fallback in the headers</a>
            </div>
          </CtaRow>
        )}
        aside={(
          <dl className="lp-facts">
            <div><dt>{MAX_FALLBACKS}</dt><dd>fallback models at most on every routed request.</dd></div>
            <div><dt>{CIRCUIT_COOLDOWN_S}<small>s</small></dt><dd>skip for a model after {CIRCUIT_FAILURES} provider-side failures in a row.</dd></div>
            <div><dt>{FIRST_BYTE_DEADLINE_S}<small>s</small></dt><dd>without a first byte, and a stream moves to the next model.</dd></div>
          </dl>
        )}
        toc={TOC}
        final={(
          <RdFinal
            title="Keep answering when a provider does not"
            lead={`Free includes ${FREE_ROUTER}.`}
            actions={(
              <CtaRow>
                <RouterCta cta="llm-fallback-routing-final-key" />
                <LeaderboardCta ghost cta="llm-fallback-routing-final-leaderboard" label="See the boards it routes on →" sub="Coding, Reasoning, Tool use and Combined, over 24 hours, 7 days and 30 days." />
              </CtaRow>
            )}
            explore={exploreLinks(PATH).map((l) => <Link key={l.path} href={l.path}>{l.label}</Link>)}
          />
        )}
      >
        <RdSection
          id="chain"
          n={num('chain')}
          title="How does the Smart Router build the fallback chain?"
          lead={`Every routed request carries its fallbacks from the start: up to ${MAX_FALLBACKS}, taken in this order from the models your keys, exclusions and limits allow.`}
        >
          <RdRows rows={[
            ['1. The rest of your traffic split', <>
              With <code>auto-split</code>, each request draws its primary model by weight, and the other models of the split
              follow, heaviest first.
            </>],
            ['2. Your own fallback order', `Up to ${MAX_OWN_LIST} models you list in Preferences, tried in your order. A model with no key, an excluded one, or one that is failing right now is left out.`],
            ['3. Automatic picks', `Up to ${MAX_AUTO_FALLBACKS} more: the next models in your mode’s own ranking, preferring providers that are not in the chain yet.`],
            ['Models passed over', <>
              By default, a model with an active drift alert on the suite your mode relies on goes behind the unflagged ones. It
              is not removed: if every candidate is flagged, the highest-ranked of them is still used.{' '}
              <Link href="/ai-drift-detection">How drift is detected</Link>.
            </>],
          ]} />
        </RdSection>

        <RdSection
          id="triggers"
          n={num('triggers')}
          title="What makes a request fall back?"
          lead="An attempt that ends without an answer moves the request to the next model in the chain. Attempts run one after another, and the first answer is returned."
        >
          <RdRows rows={[
            ['Provider-side failures', 'A 5xx, an overloaded or at-capacity answer, a timeout or an empty response. These also count toward that model’s circuit breaker.'],
            ['A rate limit on your key', `A 429 from your provider account. The next model takes the request, and that key rests on that model for ${KEY_REST_BASE_S} seconds, doubling with each 429 in a row up to ${KEY_REST_MAX_S} seconds. A success ends the rest.`],
            ['A key or credit problem', 'A provider that refuses your saved key, or an account out of credit there.'],
            ['A model already known to be failing', 'A model whose circuit is open, or whose provider our health checks report as down, is skipped without being called.'],
            ['A refusal is not a failure', <>
              When a model declines a request, the reply comes back with <code>message.refusal</code>. It is not sent to other
              providers and not counted against your plan.
            </>],
          ]} />
        </RdSection>

        <RdSection
          id="breaker"
          n={num('breaker')}
          title="How does the circuit breaker work?"
          lead="Fallbacks protect one request. The circuit breaker protects the ones after it, so they do not each pay a failed attempt on a failing model."
        >
          <RdRows rows={[
            [`Opens after ${word(CIRCUIT_FAILURES)} failures`, `${cap(word(CIRCUIT_FAILURES))} provider-side failures in a row on one model open its circuit. For the next ${CIRCUIT_COOLDOWN_S} seconds requests skip that model and go to the next one in their chain.`],
            ['Probes before it returns', `After the ${CIRCUIT_COOLDOWN_S} seconds one request at a time is let through as a probe. ${cap(word(CIRCUIT_PROBE_SUCCESSES))} successes in a row close the circuit, and a failed probe opens it for another ${CIRCUIT_COOLDOWN_S} seconds.`],
            ['Counts what the provider did', 'A circuit counts 5xx answers, overload, timeouts and empty responses. A request the provider rejected as malformed, a refused key, an account out of credit and a rate limit on your own key do not open it.'],
            ['A provider-wide check beside it', <>
              Independently, a short completion goes to every provider {probe} from our own account, and a provider that check
              reports as down is passed over until it answers again. Each provider’s history is on the{' '}
              <Link href="/status">status page</Link>.
            </>],
          ]} />
        </RdSection>

        <RdSection
          id="streaming"
          n={num('streaming')}
          title="Does a streamed response fall back?"
        >
          <RdRows rows={[
            ['Until the first byte', `A streamed attempt that fails before sending anything is skipped like any other, and the next model streams instead. A provider that has sent nothing after ${FIRST_BYTE_DEADLINE_S} seconds is treated the same way.`],
            ['After the first byte', <>
              Text that has been sent cannot be taken back. A failure after that ends the stream with an error event, code{' '}
              <code>stream_interrupted</code>.
            </>],
          ]} />
        </RdSection>

        <RdSection
          id="verify"
          n={num('verify')}
          title="How do I see a fallback happen?"
          lead="The sandbox can simulate one. The request below runs through the real routing, treats the first model as failed and answers from the second with a mock reply. No provider is called."
        >
          <RdCode title="cURL" label="sandbox · simulated fallback" code={FALLBACK_SAMPLE} />
          <RdRows rows={[
            [<code key="m">X-AISM-Model</code>, <>The model that answered: the fallback, when one did. Its provider is in <code>X-AISM-Provider</code>.</>],
            [<code key="r">X-AISM-Reasoning</code>, 'On a fallback it reads “Fallback activated” and names the model that failed and the one the request was routed to. The sandbox puts “Sandbox:” in front.'],
          ]} />
          <RdProse>
            <p>
              <code>POST /v1/route/preview</code> returns the chain before anything is sent: the primary model, the fallbacks in
              order and <code>fallback_enabled</code>. Both are in the <Link href="/router/docs#sandbox">router documentation</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection
          id="errors"
          n={num('errors')}
          title="What does the router return when every model fails?"
          lead="What went wrong decides the status, so a client can tell an outage from a setting it has to fix. Each of these lists the models tried in tried_models."
        >
          <RdRows rows={[
            [<code key="a">502 model_unavailable</code>, 'Every model tried failed on the provider side. The message gives the last provider’s error.'],
            [<code key="b">429 provider_rate_limited</code>, <>Your provider key is rate-limited on every model tried. <code>Retry-After</code> says when to try again.</>],
            [<code key="c">429 provider_quota_exceeded</code>, <>Your provider account refused for credit or quota. It carries <code>x-should-retry: false</code>, so an OpenAI SDK does not retry it in a loop.</>],
            [<code key="d">400 provider_key_rejected</code>, 'The provider refused your saved key. Replace it under Provider keys.'],
            [<code key="e">400 provider_rejected_request</code>, 'The provider rejected the request itself. Its own words are in the message.'],
          ]} />
        </RdSection>

        <RdSection
          id="setup"
          n={num('setup')}
          title="How do I set up fallbacks?"
        >
          <RdRows rows={[
            ['On by default', 'Try other models automatically is on for a new account. Turn it off under When a model fails in Preferences, and a request fails with that model’s own error.'],
            ['Your fallback order', `Add up to ${MAX_OWN_LIST} models and move them into order. They are tried before the automatic picks.`],
            ['A second provider key', <>
              With keys for two or more providers, a fallback can answer from a different provider than the primary.{' '}
              <Link href="/byok-llm-router">BYOK LLM router</Link>.
            </>],
          ]} />
          <RdProse>
            <p>
              Fallbacks work behind any tool that sends a routing mode: <Link href="/router/integrations/cline">Cline</Link>,{' '}
              <Link href="/router/integrations/opencode">OpenCode</Link>, <Link href="/router/integrations/langchain">LangChain</Link>{' '}
              and <Link href="/router/integrations/n8n">n8n</Link>, with the rest on the{' '}
              <Link href="/router/integrations">integrations hub</Link>. <Link href="/ai-router">What an AI router is</Link> sets
              fallbacks beside the other things a router does. Related guides:
            </p>
          </RdProse>
          <ul className="rd-tags lp-up" aria-label="Routing guides">
            {relatedGuides(PATH).map((g) => <li key={g.path}><Link href={g.path}>{g.label}</Link></li>)}
          </ul>
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="Questions about fallback routing">
          <Faq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
