import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMeta } from '@/lib/seo';
import { ReadingPage, RdSection, RdProse, RdFacts, RdRows, RdFinal, highlightCode, tocNumber } from '@/components/landing/Reading';

/**
 * Partnership proposal to OpenRouter (owner, 2026-10-30): offer ASL's routing decisions on OpenRouter as a
 * router model, the way Auto Router (NotDiamond) and Jev Router (TypeSafe) are offered there. It is sent to
 * their partnerships team, so it stays out of search (noindex, not in lib/seo-routes.ts) and is not linked
 * from the site. Every claim here is checkable; change it together with the product.
 */

export const metadata: Metadata = pageMeta({
  title: 'AI Stupid Level Router on OpenRouter',
  description: 'A partnership proposal: AI Stupid Level’s measurement-driven routing decisions, offered on OpenRouter as a router model.',
  path: '/openrouterpartnership',
  noindex: true,
});

const EMAIL = 'hello@aistupidlevel.info';

const TOC = [
  { id: 'proposal', label: 'The proposal' },
  { id: 'basis', label: 'What the decisions are based on' },
  { id: 'how', label: 'How it would work' },
  { id: 'variants', label: 'Router variants' },
  { id: 'production', label: 'Already in production' },
  { id: 'next', label: 'Proposed next steps' },
];
const n = (id: string) => tocNumber(TOC, id);

export default function OpenRouterPartnershipPage() {
  return (
    <ReadingPage
      kicker="Partnership proposal for OpenRouter"
      title="AI Stupid Level Router"
      accent="on OpenRouter"
      lead={<>Our engine picks the model and the reasoning effort for each request from live benchmark measurements. OpenRouter serves the chosen model and bills it at that model’s normal rate. The router itself is free to use.</>}
      actions={(
        <>
          <a className="lp-btn lp-btn-primary lp-btn-lg" href={`mailto:${EMAIL}`}>Email us <span className="lp-ar" aria-hidden="true">→</span></a>
          <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/router/docs">Smart Router docs</Link>
        </>
      )}
      note={<>October 2026 · Ionut Visan, CEO, AI Stupid Level</>}
      aside={(
        <div className="lp-codecard">
          <div className="lp-cc-head"><b>Decision response</b><span>illustrative</span></div>
          <pre className="lp-code">{highlightCode(`{
  "model": "anthropic/claude-sonnet-4.6",
  "reasoning_effort": "medium",
  "reason": "coding: tied for first, and the cheapest"
}`)}</pre>
        </div>
      )}
      toc={TOC}
      final={(
        <RdFinal
          id="contact-openrouter"
          title="Let’s talk"
          lead={<>Ionut Visan, CEO, AI Stupid Level. Write to <a href={`mailto:${EMAIL}`}>{EMAIL}</a> and we will set up a call.</>}
          actions={<a className="lp-btn lp-btn-primary lp-btn-lg" href={`mailto:${EMAIL}`}>Email us <span className="lp-ar" aria-hidden="true">→</span></a>}
        />
      )}
    >
      <RdSection id="proposal" n={n('proposal')} title="The proposal">
        <RdProse>
          <p>
            We propose offering AI Stupid Level’s routing decisions on OpenRouter as a router model, the way Auto Router and
            Jev Router are offered today. For each request, our engine picks the model and the reasoning effort from live
            benchmark measurements. OpenRouter serves the chosen model and bills it at that model’s normal rate. The router
            itself is free to use.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="basis" n={n('basis')} title="What the decisions are based on">
        <RdFacts rows={[
          ['Continuous measurement', 'Coding, reasoning and tool-use benchmarks re-run on a fixed schedule across 24 models from OpenAI, Anthropic, Google, DeepSeek, Moonshot and Z.ai, with an hourly canary on top.'],
          ['Drift awareness', 'Each model is compared with its own history. When a model gets worse behind the same name, it loses rank and traffic moves away from it.'],
          ['Cost awareness', 'When the leading models are statistically tied, the cheapest one wins by default. Quality holds and cost falls.'],
          ['Explainable picks', 'Every decision comes with a one-line reason that names the measurement behind it.'],
        ]} />
      </RdSection>

      <RdSection id="how" n={n('how')} title="How it would work">
        <RdRows rows={[
          ['1. OpenRouter asks', 'It sends the request to our decision endpoint: the messages, any tools, and optionally the candidate pool and a cost or quality preference.'],
          ['2. We decide', 'We return the model as an OpenRouter slug, the reasoning effort and the reason. No model runs on our side; the decision is a lookup over current measurements.'],
          ['3. OpenRouter serves', 'The chosen model answers as usual. Within a session the model stays fixed through tool-calling turns, so prompt caches survive.'],
        ]} />
        <RdFacts rows={[
          ['Zero retention', 'No prompt content is stored, only aggregate counts.'],
          ['Latency', 'We share measured p50 and p95 for the decision call before launch.'],
          ['Pool', 'The models you choose, out of the 24 we measure.'],
          ['Format', 'The response above is illustrative. We build the endpoint to the format you specify.'],
        ]} />
      </RdSection>

      <RdSection id="variants" n={n('variants')} title="Router variants we can offer">
        <RdFacts rows={[
          ['Coding', 'Best measured on coding tasks.'],
          ['Reasoning', 'Best on multi-step reasoning.'],
          ['Agents', 'Best on tool use.'],
          ['Value', 'Cheapest among the statistically tied leaders.'],
        ]} />
      </RdSection>

      <RdSection id="production" n={n('production')} title="Already in production">
        <RdFacts rows={[
          ['Rankings', <>Live model rankings and a drift monitor at <Link key="s" href="/">aistupidlevel.info</Link>, and a public Data API listed in public-apis.</>],
          ['Smart Router', 'An OpenAI-compatible API with 15 routing modes, used with customers’ own provider keys at zero markup.'],
          ['Integrations', 'Built into RAGFlow, Fabric, DeepChat and opencodex; a verified n8n node on n8n Cloud; packages for LangChain, Langflow and Dify; an MCP server in the official MCP Registry.'],
          ['Partners', 'Official partner of World Summit AI.'],
        ]} />
      </RdSection>

      <RdSection id="next" n={n('next')} title="Proposed next steps">
        <RdProse>
          <ol>
            <li>A 30-minute call to agree the shape of the integration.</li>
            <li>An evaluation on your agent-task set, the way Jev Router was compared with Auto Router.</li>
            <li>We build the decision endpoint to your format, in about one to two weeks once the format is agreed.</li>
            <li>Launch as a free router listing, credited “Routing by AI Stupid Level” with a link to the live rankings. Commercial terms are open for discussion.</li>
          </ol>
        </RdProse>
      </RdSection>
    </ReadingPage>
  );
}
