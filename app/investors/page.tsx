import type { CSSProperties, ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { breadcrumbLd, graphLd, pageMeta, webPageLd } from '@/lib/seo';
import JsonLd from '@/components/seo/JsonLd';
import { ReadingPage, RdSection, RdProse, RdFacts, RdRows, RdStats, RdFinal, tocNumber } from '@/components/landing/Reading';

/**
 * The investor page: the pre-seed round, linked from the landing header, the phone drawer and the footer.
 *
 * It is public, so it carries none of our own figures: accounts, revenue, growth and the amount being raised go to
 * investors privately, through the contact form's Investment topic. The round is stated by its stage and its
 * valuation only. What the page shows instead is the market: how many models companies run, what they spend, and
 * what the companies in this layer were funded and bought at.
 *
 * MARKET FIGURES. Every figure about the market or about another company restates a public source, linked on the
 * page, as it read on CHECKED. A price that was reported and not announced is worded as reported. Re-read each
 * source before changing CHECKED; if a source no longer says something, delete the sentence. No figure here is a
 * forecast of our own results, and the page says so.
 */

const TITLE = 'Investors: pre-seed at a $15M valuation';
const DESCRIPTION = 'AI Stupid Level builds the benchmark and the router that decide which AI model answers each request. Pre-seed round at a $15 million valuation.';

export const metadata: Metadata = pageMeta({
  title: TITLE,
  description: DESCRIPTION,
  path: '/investors',
});

const LD = graphLd([
  breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Investors', path: '/investors' }]),
  webPageLd({ path: '/investors', name: TITLE, description: DESCRIPTION }),
]);

const CONTACT = '/contact?topic=investment';

/** The day every market figure below was re-read at its source. */
const CHECKED = '20 November 2026';

const SRC = {
  datadog: 'https://www.datadoghq.com/state-of-ai-engineering/',
  gartnerSpend: 'https://thejournal.com/articles/2026/09/21/gartner-worldwide-ai-spending-to-reach-2-67-trillion-in-2026.aspx',
  gartnerGrowth: 'https://www.cio.com/article/4225785/ai-spend-will-jump-49-5-in-2026-says-gartner.html',
  gartnerCost: 'https://www.gartner.com/en/newsroom/press-releases/2026-08-17-gartner-predicts-ai-inference-costs-per-agentic-workflow-will-increase-more-than-fivefold-through-2028',
  gartnerQuote: 'https://www.techradar.com/pro/there-is-no-reliable-economical-one-size-fits-all-model-on-the-horizon-experts-claim-ai-costs-will-grow-fivefold-by-2028-as-demand-continues-to-soar',
  gartnerAdvice: 'https://istart.com.au/news-items/ais-new-paradox-cheaper-models-bigger-bills/',
  stripe: 'https://stripe.com/newsroom/news/stripe-agrees-to-acquire-openrouter',
  stripeCnbc: 'https://www.cnbc.com/2026/08/19/stripe-openrouter-fintech-ai-model-marketplace-.html',
  stripePrice: 'https://techcrunch.com/2026/08/16/stripe-will-reportedly-acquire-ai-gateway-startup-openrouter-for-7b/',
  arena: 'https://techcrunch.com/2026/01/06/lmarena-lands-1-7b-valuation-four-months-after-launching-its-product/',
  arize: 'https://www.dynatrace.com/news/press-release/dynatrace-to-acquire-arize/',
  braintrust: 'https://siliconangle.com/2026/02/17/braintrust-breaks-80m-series-b-funding-round-become-observability-layer-ai/',
};

/** A link to a source on another site. */
function Ext({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} rel="nofollow noopener noreferrer" target="_blank">{children}</a>;
}

/**
 * What companies in this layer were funded and bought at, largest first, with this round last. `usdM` is the figure in
 * millions of US dollars and draws the bar to scale against the largest; OpenRouter's is the lower bound of the
 * reported price.
 */
const OUTCOMES: Array<{ name: string; shown: string; usdM: number; what: string }> = [
  {
    name: 'OpenRouter',
    shown: '$7B+',
    usdM: 7000,
    what: 'A router for AI models. Stripe agreed to acquire it in August 2026. The price was not disclosed; it is reported at more than $7 billion, less than three months after a funding round at a reported $1.3 billion valuation.',
  },
  {
    name: 'Arena',
    shown: '$1.7B',
    usdM: 1700,
    what: 'A public leaderboard of AI models, formerly LMArena. Its valuation at a funding round in January 2026, four months after it launched a paid evaluation product, which the company said was running at an annualised $30 million by December.',
  },
  {
    name: 'Arize',
    shown: '$915M',
    usdM: 915,
    what: 'Evaluation and observability for AI applications. Bought by Dynatrace in a deal announced in August 2026.',
  },
  {
    name: 'Braintrust',
    shown: '$800M',
    usdM: 800,
    what: 'Evaluation and observability for AI applications. Its valuation at a funding round in February 2026.',
  },
  {
    name: 'AI Stupid Level',
    shown: '$15M',
    usdM: 15,
    what: 'The benchmark and the router in one company. The valuation of this pre-seed round.',
  },
];
const TOP_USD_M = Math.max(...OUTCOMES.map((o) => o.usdM));

const TOC = [
  { id: 'now', label: 'Why now' },
  { id: 'worth', label: 'What this layer is worth' },
  { id: 'built', label: 'What we have built' },
  { id: 'edge', label: 'Why it is hard to copy' },
  { id: 'revenue', label: 'How we make money' },
  { id: 'round', label: 'The round' },
  { id: 'team', label: 'Team' },
  { id: 'invest', label: 'Get in touch' },
];
const n = (id: string) => tocNumber(TOC, id);

export default function InvestorsPage() {
  return (
    <ReadingPage
      className="rd-investors"
      kicker="Investors · pre-seed round"
      title="Invest in the layer that decides"
      accent="which AI model answers"
      lead="Companies now run several AI models at once, and which one is best for a job keeps changing as new models ship. AI Stupid Level benchmarks the models on a fixed schedule and routes each request to the one that fits it, with no money from any model provider. Our pre-seed round is open at a $15 million valuation."
      actions={(
        <>
          <Link className="lp-btn lp-btn-primary lp-btn-lg" href={CONTACT} data-cta="investors-hero-contact">Talk to us about investing <span className="lp-ar" aria-hidden="true">→</span></Link>
          <a className="lp-btn lp-btn-ghost lp-btn-lg" href="#worth" data-cta="investors-hero-worth">What this layer is worth</a>
        </>
      )}
      note="Our own figures, the deck and the terms are shared with investors privately, on request."
      aside={(
        <dl className="lp-facts">
          <div><dt>$7B+</dt><dd>reported price of Stripe’s agreed acquisition of OpenRouter, a router for AI models</dd></div>
          <div><dt>$1.7B</dt><dd>valuation of Arena, a leaderboard for AI models, in January 2026</dd></div>
          <div><dt>$15M</dt><dd>valuation of this round, for the benchmark and the router in one company</dd></div>
        </dl>
      )}
      toc={TOC}
      final={(
        <RdFinal
          id="invest"
          title="Ask us for the numbers"
          lead="Tell us who you are. We reply ourselves with the deck, our figures and the terms, and set up a call with the founder."
          actions={<Link className="lp-btn lp-btn-primary lp-btn-lg" href={CONTACT} data-cta="investors-final-contact">Talk to us about investing <span className="lp-ar" aria-hidden="true">→</span></Link>}
        />
      )}
    >
      <JsonLd data={LD} />

      <RdSection id="now" n={n('now')} title="Why now: no single model is enough any more"
        lead="Companies run more models, spend more on them every year, and are told to expect no single model that does everything well.">
        <RdStats items={[
          { value: '70%+', label: 'of organisations use three or more AI models' },
          { value: '$28.3B', label: 'forecast spending on generative AI models in 2026, up 117% in a year' },
          { value: '5×', label: 'or more: the predicted rise in inference cost per agentic workflow through 2028' },
          { value: '2–5%', label: 'of calls to AI models returned an error in early 2026' },
        ]} />
        <RdProse>
          <p>
            “There is no reliable, economical one-size-fits-all model on the horizon,” Gartner’s Will Sommer said in
            August 2026. The same research advises companies to “hold agents to high-value tasks and delegate the rest
            down a tier”. In practice that means routing: each request to the least expensive model that can do it well.
          </p>
          <p>
            So every request now carries a decision: which model, at what price, and is it still as good as it was last
            month? A provider can change a model behind the same name without saying so. The decision needs test
            results from someone with no stake in the answer, and a router that acts on them request by request.
          </p>
          <p className="lp-fine">
            Sources: <Ext href={SRC.datadog}>Datadog, State of AI Engineering 2026</Ext>, from the telemetry of more
            than a thousand of its customers, where the share of organisations using more than six models also nearly
            doubled; Gartner’s forecast of 16 September 2026, as reported by <Ext href={SRC.gartnerSpend}>THE Journal</Ext>{' '}
            and <Ext href={SRC.gartnerGrowth}>CIO</Ext>; <Ext href={SRC.gartnerCost}>Gartner’s prediction of 17 August 2026</Ext>,
            quoted as reported by <Ext href={SRC.gartnerQuote}>TechRadar</Ext> and <Ext href={SRC.gartnerAdvice}>iStart</Ext>.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="worth" n={n('worth')} title="What this layer is worth"
        lead="Companies that route between AI models, rank them, or evaluate what they produce were funded and bought at these prices in 2026.">
        <div className="rd-table-wrap lp-up">
          <table className="rd-table rd-outcomes">
            <thead><tr><th>Company</th><th className="rd-wt">Valuation or price</th><th>What happened</th></tr></thead>
            <tbody>
              {OUTCOMES.map((o, i) => (
                <tr key={o.name}>
                  <th scope="row">{o.name}</th>
                  <td className="rd-wt">
                    <b>{o.shown}</b>
                    <span className="rd-w" aria-hidden="true"><i style={{ '--w': o.usdM / TOP_USD_M, '--i': i } as CSSProperties} /></span>
                  </td>
                  <td className="muted">{o.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <RdProse>
          <p className="lp-fine">
            Valuation at a funding round, or acquisition price, in US dollars. The bars are drawn to scale, which
            leaves this round’s barely visible.
          </p>
          <p>
            Stripe’s chief executive, Patrick Collison, said that “together with OpenRouter we’ll help businesses
            maximize profitability by routing their requests intelligently and spending their tokens efficiently”.
            Routing each request intelligently is the job of our <Link href="/router">Smart Router</Link>, and it
            does that job on rankings from our own benchmark.
          </p>
          <p>
            Neither buyer in the table makes AI models. Stripe is a payments company and Dynatrace an observability
            company: this layer is being bought by companies that sit between the model providers and their customers.
          </p>
          <p>
            This round values AI Stupid Level at $15 million, less than 2% of the smallest figure above it in the
            table. Those figures are other companies’ results, and none of them is a forecast of ours. They show what
            the market pays for this layer.
          </p>
          <p className="lp-fine">
            Sources: <Ext href={SRC.stripe}>Stripe</Ext> and <Ext href={SRC.stripeCnbc}>CNBC</Ext>, 19 August 2026, and{' '}
            <Ext href={SRC.stripePrice}>TechCrunch</Ext>, 16 August 2026 (OpenRouter); <Ext href={SRC.arena}>TechCrunch</Ext>,
            6 January 2026 (Arena); <Ext href={SRC.arize}>Dynatrace</Ext>, 13 August 2026 (Arize);{' '}
            <Ext href={SRC.braintrust}>SiliconANGLE</Ext>, 17 February 2026 (Braintrust). Read on {CHECKED}.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="built" n={n('built')} title="What we have built"
        lead="Both halves are live and open to try today: the benchmark that ranks the models, and the router that acts on it.">
        <RdRows rows={[
          ['A benchmark.', <>Coding, reasoning and tool-use suites, re-run on a fixed schedule across models from OpenAI, Anthropic, Google, DeepSeek, Moonshot and Z.ai, with an hourly canary on top. The <Link key="m" href="/methodology">method is public</Link>; the tasks stay private, so no lab can train on them.</>],
          ['A record of change.', <>Each model is compared with its own past. When one gets worse behind the same API name, the <Link key="d" href="/ai-degradation-tracker">drift monitor</Link> shows it.</>],
          ['A router.', <>The <Link key="r" href="/router">Smart Router</Link> is one OpenAI-compatible endpoint on the customer’s own provider keys, at zero markup. With request-level routing it reads each request, ranks the models on the benchmark for that kind of work, and sends the request to the leader.</>],
          ['A marketplace.', <>Inference providers can now <Link key="i" href="/inference-providers">list the models they host</Link>. Each listing is tested on our benchmark, gets a public page, and can be reached through the router.</>],
          ['A product for teams.', 'Workspaces with projects, budgets and spend reports, single sign-on, SCIM provisioning and an audit trail.'],
        ]} />
        <RdFacts rows={[
          ['Customers', 'Paying subscribers on monthly and annual plans, from independent developers to companies. We do not name customers without their permission.'],
          ['Distribution', 'Built into RAGFlow, Fabric, DeepChat and opencodex; plugins in the Dify Marketplace and the Hermes Agent catalog; listed in models.dev; a verified n8n node on n8n Cloud; packages for LangChain, Langflow and the Vercel AI SDK; an MCP server in the official MCP Registry.'],
          ['Partners', <>Official partner of <Link key="p" href="/about#partners">World Summit AI</Link>.</>],
          ['Open', <>A public <Link key="a" href="/api-docs">Data API</Link>, listed in public-apis, and an open-source web application.</>],
        ]} />
      </RdSection>

      <RdSection id="edge" n={n('edge')} title="Why it is hard to copy">
        <p className="rd-statement lp-up">We do not take investment from AI model providers.</p>
        <RdRows rows={[
          ['Independence.', 'We test their models and route our customers’ traffic between them. A provider that owned part of us would have a stake in every score we publish and every request we route, so this round is closed to them. The same rule covers revenue: no model provider pays us, and we carry no affiliate links.'],
          ['Public method, private tasks.', 'Anyone can check how a score is made. No lab can train on the tasks, because they are never published.'],
          ['Each half feeds the other.', 'The benchmark gives the router its rankings. What the router sees in production, which models fail and how customers rate the answers, goes back into the router’s rankings.'],
          ['Already inside the tools.', 'The routing decision is available where developers already work: in the frameworks, agent tools and automation platforms named above.'],
        ]} />
      </RdSection>

      <RdSection id="revenue" n={n('revenue')} title="How we make money">
        <RdFacts rows={[
          ['Subscriptions', <>Pro, Developer and Teams, billed monthly or annually (<Link key="p" href="/pricing">plans</Link>).</>],
          ['Enterprise', 'Contracted scope, with single sign-on, SCIM provisioning, an audit trail and invoicing.'],
          ['Assessments', <>The <Link key="a" href="/assessment">workload assessment</Link>: a customer’s own tasks run against three candidate models, with a written recommendation.</>],
          ['Custom benchmarking', 'Continuous benchmarking of a customer’s own workload, built and run by us.'],
          ['Data licensing', 'The underlying performance data, licensed only to organisations that are not model vendors.'],
        ]} />
        <RdProse>
          <p>The Smart Router runs on customers’ own provider keys at zero markup: we sell the decision, never the inference.</p>
        </RdProse>
      </RdSection>

      <RdSection id="round" n={n('round')} title="The round">
        <RdFacts rows={[
          ['Stage', 'Pre-seed'],
          ['Valuation', '$15 million, post-money'],
          ['Use of funds', 'Go-to-market first: reaching the developers and companies who choose and pay for AI models. The rest expands the benchmark and the router.'],
          ['What we send you', 'The deck and our figures: who pays today, what the whole benchmark programme costs to run, and how many subscriptions cover it. The instrument and the remaining terms come with them.'],
          ['Not open to', <>AI labs and model providers (<a key="w" href="#edge">why</a>).</>],
        ]} />
        <RdProse>
          <p className="lp-fine">
            This page is for information only. It is not an offer to sell, or a solicitation of an offer to buy, any
            security. Any investment is made only on the terms of signed investment documents. Figures about the
            market and about other companies come from the sources linked beside them, as read on {CHECKED}; they
            are not a forecast of our results.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="team" n={n('team')} title="Team">
        <RdFacts rows={[
          ['Ionut Adrian Visan', 'Founder & CEO'],
          ['Alexandra Chirilă, PhD', 'AI Evaluation & Epistemology: the design of our reasoning evaluations'],
          ['Marius Răzvan Palimariu', 'AI Infrastructure Lead, with experience from IBM, NVIDIA and Nscale'],
        ]} />
        <RdProse>
          <p><Link href="/about#team">Full bios on the About page</Link>.</p>
        </RdProse>
      </RdSection>
    </ReadingPage>
  );
}
