import type { Metadata } from 'next';
import Link from 'next/link';
import { breadcrumbLd, graphLd, pageMeta, webPageLd } from '@/lib/seo';
import JsonLd from '@/components/seo/JsonLd';
import { ReadingPage, RdSection, RdProse, RdFacts, RdRows, RdWeights, RdFinal, tocNumber } from '@/components/landing/Reading';

/**
 * The investor page (owner, 2026-11-02): the pre-seed round, linked from the landing header, the phone
 * drawer and the footer. It is public, so it carries no internal figures (subscriber counts, revenue,
 * growth): those, the equity on offer and the valuation go to investors privately, through the contact
 * form's Investment topic. Every claim here is checkable; change it together with the product.
 */

const TITLE = 'Investors: our pre-seed round';
const DESCRIPTION = 'AI Stupid Level is raising a $750,000 pre-seed round to take independent AI model measurement and the Smart Router to market. Not open to AI model providers.';

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

const TOC = [
  { id: 'what', label: 'What we do' },
  { id: 'why', label: 'Why it matters' },
  { id: 'traction', label: 'Traction' },
  { id: 'revenue', label: 'How we make money' },
  { id: 'independence', label: 'Independence' },
  { id: 'round', label: 'The round' },
  { id: 'team', label: 'Team' },
  { id: 'invest', label: 'Get in touch' },
];
const n = (id: string) => tocNumber(TOC, id);

export default function InvestorsPage() {
  return (
    <ReadingPage
      className="rd-investors"
      kicker="Investors"
      title="We are raising"
      accent="a $750,000 pre-seed round"
      lead="AI Stupid Level measures AI models on a fixed schedule, shows when one gets worse behind the same name, and routes each request to the model that measures best for it. This round takes it to market. AI model providers cannot invest."
      actions={(
        <>
          <Link className="lp-btn lp-btn-primary lp-btn-lg" href={CONTACT} data-cta="investors-hero-contact">Talk to us about investing <span className="lp-ar" aria-hidden="true">→</span></Link>
          <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/about#team" data-cta="investors-hero-team">Meet the team</Link>
        </>
      )}
      note="Our figures and the terms are shared with investors privately, on request."
      aside={(
        <dl className="lp-facts">
          <div><dt>$750k</dt><dd>pre-seed round, with a minimum ticket of $25,000</dd></div>
          <div><dt>80%</dt><dd>of the round goes to go-to-market, 20% to the benchmark and the router</dd></div>
          <div><dt>$0</dt><dd>from AI model providers, as revenue or as investment</dd></div>
        </dl>
      )}
      toc={TOC}
      final={(
        <RdFinal
          id="invest"
          title="Talk to us about investing"
          lead="Tell us who you are and the ticket you have in mind. We reply ourselves, share the figures and the terms, and set up a call."
          actions={<Link className="lp-btn lp-btn-primary lp-btn-lg" href={CONTACT} data-cta="investors-final-contact">Contact us about investing <span className="lp-ar" aria-hidden="true">→</span></Link>}
        />
      )}
    >
      <JsonLd data={LD} />

      <RdSection id="what" n={n('what')} title="What we do">
        <RdRows rows={[
          ['We measure.', 'Coding, reasoning and tool-use benchmarks run on a fixed schedule across models from OpenAI, Anthropic, Google, DeepSeek, Moonshot and Z.ai, with an hourly canary on top. The method is public; the tasks stay private, so no one can train on them.'],
          ['We catch change.', <>Each model is compared with its own past. When one gets worse behind the same API name, the <Link key="d" href="/ai-degradation-tracker">drift monitor</Link> shows it.</>],
          ['We route.', <>The <Link key="r" href="/router">Smart Router</Link> is one OpenAI-compatible endpoint that sends each request to the model measuring best for it, with 15 routing modes. It runs on the customer’s own provider keys, at zero markup.</>],
        ]} />
      </RdSection>

      <RdSection id="why" n={n('why')} title="Why it matters">
        <RdProse>
          <p>
            Companies building on AI models choose them from launch-day benchmarks and pay for them by the token,
            while a provider can change a model behind the same name without saying so. Which model is best for a
            task, and at what price, keeps changing as new models ship.
          </p>
          <p>
            An independent, continuous record of how models perform, and a router that acts on it, answers both
            questions. It has to come from someone with no stake in the result, which no model provider can be.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="traction" n={n('traction')} title="Traction"
        lead="Account, growth and revenue figures are shared with investors privately.">
        <RdFacts rows={[
          ['Paying customers', 'Subscribers on monthly and annual plans, from independent developers to companies. We do not name customers without their permission.'],
          ['Distribution', 'Built into RAGFlow, Fabric, DeepChat and opencodex; a verified n8n node on n8n Cloud; packages for LangChain, Langflow and Dify; an MCP server in the official MCP Registry.'],
          ['Partners', <>Official partner of <Link key="p" href="/about#partners">World Summit AI</Link>.</>],
          ['Open', <>A public <Link key="a" href="/api-docs">Data API</Link>, listed in public-apis, and an open-source web application.</>],
          ['Record', 'Our first benchmark ran on 8 August 2025.'],
        ]} />
      </RdSection>

      <RdSection id="revenue" n={n('revenue')} title="How we make money">
        <RdFacts rows={[
          ['Subscriptions', <>Pro, Developer and Teams, billed monthly or annually (<Link key="p" href="/pricing">plans</Link>).</>],
          ['Enterprise', 'Contracted scope, with single sign-on, SCIM provisioning, an audit trail and invoicing.'],
          ['Assessments', <>The <Link key="a" href="/assessment">workload assessment</Link>: a customer’s own tasks run against three candidate models, with a written recommendation.</>],
          ['Custom benchmarking', 'Continuous measurement of a customer’s own workload, built and run by us.'],
          ['Data licensing', 'The underlying performance data, licensed only to organisations that are not model vendors.'],
        ]} />
        <RdProse>
          <p>The Smart Router runs on customers’ own provider keys at zero markup: we sell the decision, never the inference.</p>
        </RdProse>
      </RdSection>

      <RdSection id="independence" n={n('independence')} title="Independence">
        <p className="rd-statement lp-up">We do not take investment from AI model providers.</p>
        <RdProse>
          <p>
            We measure their models and route our customers’ traffic between them. A provider that owned part of us
            would have a stake in every score we publish and every request we route, so this round is closed to
            them. The same rule covers revenue: no model provider pays us, and we have no affiliate links.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="round" n={n('round')} title="The round">
        <RdFacts rows={[
          ['Stage', 'Pre-seed'],
          ['Raising', '$750,000'],
          ['Minimum ticket', '$25,000'],
          ['Terms', 'The equity on offer, the valuation and the instrument are shared with investors privately, together with our figures.'],
          ['Not open to', <>AI labs and model providers (<a key="w" href="#independence">why</a>).</>],
        ]} />
        <RdWeights
          label="Use of funds"
          share="Share"
          note="What it pays for"
          rows={[
            ['Go-to-market', 80, 'Taking the product to the developers and companies who choose and pay for AI models.'],
            ['Benchmark and router', 20, 'Expanding and developing the benchmark and the Smart Router.'],
          ]}
        />
        <RdProse>
          <p className="lp-fine">
            This page is for information only. It is not an offer to sell, or a solicitation of an offer to buy, any
            security. Any investment is made only on the terms of signed investment documents.
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
