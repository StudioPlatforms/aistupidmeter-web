import type { Metadata } from 'next';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdRows, RdCode, RdFinal, tocNumber } from '@/components/landing/Reading';
import { getLandingSnapshot } from '@/components/landing/data';
import { aiRouterTieSentence, scoringOf } from '@/lib/router-scoring';
import { CtaRow, LeaderboardCta, RouterCta } from '@/components/seo/Cta';
import JsonLd from '@/components/seo/JsonLd';
import { AsOf } from '@/components/seo/Verdict';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { LivePicks } from '@/components/seo/routers/RouterBlocks';
import {
  CADENCE, FREE_ROUTER, PAID_ROUTER, ROUTER_APP_ID, VALUE_FLOOR_POINTS,
} from '@/components/seo/routers/routers-data';
import {
  COST_MODES, COST_SAMPLE, ROUTING_PUBLISHED_ISO, SWITCH_COST_DEFAULT_USD, exploreLinks, relatedGuides,
} from '@/components/seo/routing/routing-data';
import { PLANS } from '@/lib/entitlements';
import { planName } from '@/lib/pricing-display';
import { breadcrumbLd, faqLd, graphLd, isoDay, pageMeta, utcStamp, webPageLd } from '@/lib/seo';
import { getRoster } from '@/lib/seo-data';
import '@/styles/seo.css';
import '@/styles/seo-routers.css';

/**
 * /llm-cost-routing: how the Smart Router routes on cost. The value modes and their rule (a quality
 * bar, then points per dollar of one benchmark run), auto-cheapest, the Cheaper tie-break, the
 * price cap and the budgets a caller sets, what a conversation costs, and the headers and usage
 * fields that show what a request was ranked on.
 *
 * ISR every fifteen minutes, no auth(): the live picks come from GET /dashboard/landing. Plan
 * allowances and prices are read from the plan table. Static copy names no model and estimates
 * no saving.
 */

const PATH = '/llm-cost-routing';
const TITLE = 'LLM cost routing: pay less per result';
const DESCRIPTION = 'LLM cost routing with the Smart Router: value modes pick near-top models by cost per benchmark run, with price caps, budgets and no markup on tokens.';
const H1 = 'LLM cost routing:';
const H1_ACCENT = 'near-top models, the most points per dollar';

export const metadata: Metadata = pageMeta({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  type: 'article',
  publishedTime: ROUTING_PUBLISHED_ISO,
  keywords: [
    'LLM cost routing', 'LLM cost optimization routing', 'cheapest prompt routing', 'prompt routing cost',
    'best AI prompt routing by price', 'route LLM requests by cost', 'LLM router cost per task', 'cheapest LLM router',
    'LLM budget limits', 'price-aware model routing', 'best value AI model routing', 'LLM router no markup',
  ],
});

export const revalidate = 900;

const TOC = [
  { id: 'modes', label: 'Modes that route on cost' },
  { id: 'why', label: 'Cost per result' },
  { id: 'live', label: 'Live picks' },
  { id: 'limits', label: 'Caps and budgets' },
  { id: 'conversation', label: 'Inside a conversation' },
  { id: 'verify', label: 'Check it' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

const usd = (x: number) => `$${x.toFixed(2)}`;

export default async function LlmCostRoutingPage(): Promise<React.JSX.Element> {
  const [snapshot, roster] = await Promise.all([getLandingSnapshot(), getRoster()]);
  // How the router scores right now (the landing snapshot's `scoring`): the tie sentence follows its band.
  const scoring = scoringOf(snapshot?.scoring);
  const slugs = new Map(roster.map((m) => [m.name, m.slug]));
  const providerCount = snapshot?.providerCount ?? 0;

  /* ── FAQ: the same strings feed the page and the FAQPage structured data ── */
  const faq: FaqItem[] = [
    {
      q: 'How does LLM cost optimization routing work?',
      a: `A router lowers cost by choosing a less expensive model where one will do the job. The AI Stupid Level [Smart Router](/router) decides that from its public boards: its value modes look at the models within ${VALUE_FLOOR_POINTS} points of the top score you can use, then take the most points per dollar of one run of that suite. The suites behind the boards are the same tasks for every model, on a fixed schedule: ${CADENCE}.`,
    },
    {
      q: 'What is the cheapest way to route prompts?',
      a: `auto-cheapest sends each request to the model with the lowest list price per token among your providers, and has no quality bar. auto-value keeps one: it stays within ${VALUE_FLOOR_POINTS} points of the top Combined score and takes the most points per dollar.`,
    },
    {
      q: 'Does the router add a cost per token?',
      a: `No. Requests go out with your own provider keys and each provider bills you at its own list price. Plans count routed requests instead. Free includes ${FREE_ROUTER}. ${PAID_ROUTER}. [BYOK LLM router](/byok-llm-router) covers the keys, and [plans and prices](/pricing) the rest.`,
    },
    {
      q: 'Which prompt router is best on price?',
      a: 'Compare three prices, not one: the provider’s price per token, any markup or fee the router adds, and the cost of a finished task, which depends on the model the router picks. The Smart Router adds nothing per token and names the pick and its reason on every response. [Best AI routers in 2026](/best-ai-router) sets the main options side by side, each described from its vendor’s own pages.',
    },
  ];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Smart Router', path: '/router' }, { name: 'LLM cost routing', path: PATH }]),
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
        kicker="LLM cost routing"
        title={H1}
        accent={H1_ACCENT}
        lead={<>
          The AI Stupid Level Smart Router routes on cost in three ways: value modes that choose among near-top models by what a
          benchmark run cost each one, a price cap and budgets you set, and a tie-break that takes the less expensive of models
          too close to call. Requests go out with your own provider keys, so the price per token is your provider’s list price.
        </>}
        actions={(
          <CtaRow className="is-stack">
            <RouterCta cta="llm-cost-routing-hero-key" />
            <div className="seo-cta">
              <a className="lp-btn lp-btn-ghost" href="#live" data-cta="llm-cost-routing-hero-live">See what the value modes pick now</a>
            </div>
          </CtaRow>
        )}
        aside={(
          <dl className="lp-facts">
            <div><dt>{VALUE_FLOOR_POINTS}</dt><dd>points: how close to the top score a model must be for a value mode to consider it.</dd></div>
            <div><dt>{COST_MODES.length}</dt><dd>modes rank on cost, from <code>auto-value</code> to <code>auto-cheapest</code>.</dd></div>
            <div><dt>0%</dt><dd>markup on tokens. Providers bill you directly, at their own list price.</dd></div>
          </dl>
        )}
        toc={TOC}
        final={(
          <RdFinal
            title="Route on what a result costs"
            lead={`Free includes ${FREE_ROUTER}.`}
            actions={(
              <CtaRow>
                <RouterCta cta="llm-cost-routing-final-key" />
                <LeaderboardCta ghost cta="llm-cost-routing-final-leaderboard" label="See the boards it routes on →" sub="Coding, Reasoning, Tool use and Combined, over 24 hours, 7 days and 30 days." />
              </CtaRow>
            )}
            explore={exploreLinks(PATH).map((l) => <Link key={l.path} href={l.path}>{l.label}</Link>)}
          />
        )}
      >
        <RdSection
          id="modes"
          n={num('modes')}
          title="Which modes route on cost?"
          lead="Send any of these as the model name. The value modes keep a quality bar and then rank on cost; auto-cheapest ranks on list price alone."
        >
          <div className="rd-table-wrap seo-table-wrap rt-table-wrap lp-up">
            <table className="rd-table seo-table rt-table rt-live">
              <caption>The modes that rank on cost. <code>X-AISM-Strategy</code> names the one a request was ranked on.</caption>
              <thead>
                <tr><th scope="col">Mode</th><th scope="col">Ranks on</th></tr>
              </thead>
              <tbody>
                {COST_MODES.map((m) => (
                  <tr key={m.id}>
                    <th scope="row"><code>{m.id}</code></th>
                    <td>{m.ranks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RdRows rows={[
            ['How a value mode decides', `It looks at the models within ${VALUE_FLOOR_POINTS} points of the top score among the ones you can use, after your keys, exclusions and limits. Among those, the most benchmark points per dollar wins. The dollar figure is what one run of that suite cost the model on its most recent priced runs.`],
            ['Ties go to the less expensive model', <>
              On the quality modes (<code>auto-best</code>, <code>auto-coding</code>, <code>auto-reasoning</code>,{' '}
              <code>auto-tooling</code>): {aiRouterTieSentence(scoring)} Cheaper compares what one benchmark run cost each tied
              model when all of them have that on record, and their list prices otherwise. The routing reason says which.
            </>],
            ['Per request, when you want it', <>
              With Match each request on, a request sent as <code>auto-value</code> is ranked on the value version of its own
              board: coding work by <code>auto-value-coding</code>’s rule, tool use by <code>auto-value-tooling</code>’s.{' '}
              <Link href="/llm-routing-by-task">LLM routing by task</Link>.
            </>],
          ]} />
        </RdSection>

        <RdSection
          id="why"
          n={num('why')}
          title="Why cost per result, and not price per token?"
        >
          <RdProse>
            <p>
              A price list gives a price per token, and models spend different numbers of tokens on the same task. A model that
              writes four times as much costs four times as much per task at the same list price. So the value modes divide each
              model’s score by what one benchmark run of that suite cost it. The tasks are the same for every model, which makes the
              cost of a run a like-for-like figure. What a correct answer costs each model is public on{' '}
              <Link href="/best-value-ai-model">best value AI model</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection
          id="live"
          n={num('live')}
          title="What do the cost modes pick right now?"
          lead="The live router’s own picks for an example caller who holds a key for every provider. They follow the boards."
        >
          {snapshot ? (
            <>
              <LivePicks
                snapshot={snapshot}
                slugs={slugs}
                caption={<><code>auto-value</code> and <code>auto-cheapest</code> are the cost rows. The quality modes show the default Cheaper tie-break at work.</>}
              />
              <AsOf>
                As of {utcStamp(snapshot.generatedAt)} · the router’s own picks for an example caller with keys for all {providerCount} providers
              </AsOf>
            </>
          ) : (
            <RdProse>
              <p>
                What a correct answer costs each model is public on <Link href="/best-value-ai-model">best value AI model</Link>.
              </p>
            </RdProse>
          )}
        </RdSection>

        <RdSection
          id="limits"
          n={num('limits')}
          title="Which limits can I set on cost?"
          lead="Limits apply before a mode ranks anything, and budgets before a request is sent."
        >
          <RdRows rows={[
            ['Maximum price', 'A cap in dollars per 1M tokens, on the average of a model’s input and output list price. Models above it are left out before anything is ranked.'],
            ['A budget per key', <>
              From {planName('developer')} up, a router key can carry a monthly budget. With a hard limit, a request that could
              take the key past it is refused with <code>429 insufficient_quota</code> before any provider is called. The request
              reserves its highest possible cost first and settles to the actual cost after the answer.
            </>],
            ['A budget per project', <>
              A workspace project has a monthly budget with three behaviours past it: alert only, stop at the budget, or switch
              to the cheapest models. <code>X-AISM-Strategy-Source: budget-downgrade</code> marks those answers.{' '}
              <Link href="/docs/teams#budgets">Budgets and caps</Link>.
            </>],
            ['What was spent', <>
              <code>GET /v1/usage</code> returns the month’s requests used and included, and the key’s budget and spend. The
              dashboard keeps the model, tokens and cost of each request, for {PLANS.free.routerDiagnosticDays} days on Free and{' '}
              {PLANS.developer.routerDiagnosticDays} on {planName('developer')}.
            </>],
          ]} />
        </RdSection>

        <RdSection
          id="conversation"
          n={num('conversation')}
          title="What does routing cost inside a conversation?"
        >
          <RdRows rows={[
            ['One model per conversation', 'By default a conversation stays on the model that answered it. Your provider keeps the conversation in its prompt cache and can serve the part it has already seen at its cache price.'],
            ['Caching is requested where it has to be', <>
              Most providers cache automatically. Claude caches when asked, so the router asks for every conversation that
              continues. Cached tokens come back in <code>usage.prompt_tokens_details.cached_tokens</code>.
            </>],
            ['A move has a price', <>
              With Model switching set to rank each new message again, a conversation moves when another model is clearly ahead
              and re-sending it stays within your limit, {usd(SWITCH_COST_DEFAULT_USD)} by default.{' '}
              <code>X-AISM-Switch-Cost-Est</code> gives the estimate when a move is made.
            </>],
          ]} />
        </RdSection>

        <RdSection
          id="verify"
          n={num('verify')}
          title="How do I check what a request was ranked on?"
          lead="The routing headers name the strategy, the model and the reason, and the body carries the usage your provider reported. The strategy in the comment is that of an account on default settings."
        >
          <RdCode title="Python · OpenAI SDK" label="auto-value-coding" code={COST_SAMPLE} />
          <RdRows rows={[
            [<code key="s">X-AISM-Strategy</code>, <>The strategy the request was ranked on: <code>best_value</code>, <code>best_value_coding</code>, <code>best_value_reasoning</code>, <code>best_value_tooling</code> or <code>cheapest</code>.</>],
            [<code key="r">X-AISM-Reasoning</code>, 'For a value pick with a run cost on record: its score, what one benchmark run cost it and its points per dollar. For a tie settled by Cheaper: the tied models and the figure that decided.'],
            [<code key="m">X-AISM-Model</code>, <>The model that answered. <code>X-AISM-Provider</code> names the provider, which is the account that bills the tokens.</>],
          ]} />
          <RdProse>
            <p>
              <code>POST /v1/route/preview</code> returns the pick and its reason for any mode without sending the request. Every
              endpoint is in the <Link href="/router/docs">router documentation</Link>, and{' '}
              <Link href="/ai-router">what an AI router is</Link> covers the other signals routers choose by. The coding tools’
              guides name <code>auto-value-coding</code> as the mode that spends less per run:{' '}
              <Link href="/router/integrations/aider">Aider</Link>, <Link href="/router/integrations/cline">Cline</Link>,{' '}
              <Link href="/router/integrations/continue">Continue</Link> and <Link href="/router/integrations/opencode">OpenCode</Link>.
              Related guides:
            </p>
          </RdProse>
          <ul className="rd-tags lp-up" aria-label="Routing guides">
            {relatedGuides(PATH).map((g) => <li key={g.path}><Link href={g.path}>{g.label}</Link></li>)}
          </ul>
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="Questions about cost routing">
          <Faq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
