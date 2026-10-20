import Link from 'next/link';
import type { CSSProperties } from 'react';
import '@/styles/landing.css';
import { lpBody, lpDisplay } from '@/lib/fonts';
import { darkDefaultScript } from '@/lib/theme-config';
import DarkDefault from '@/components/DarkDefault';
import { priceIdFor, type SellablePlan } from '@/lib/stripe-plans';
import { ASSESSMENT_PRICE_LABEL } from '@/lib/assessment-price';
import { getCorpus, getLandingSnapshot, getModelRoster, getPriceSnapshot, getProviderHealth, getVisitTotal } from './data';
import { PROVIDER_LABEL, compactHealth, type PriceSnapshot } from './types';
import { dayRange, duration, logoFor, pct, per1k, times } from './price-format';
import LandingNav from './LandingNav';
import RouterDemo, { type DemoScenario } from './RouterDemo';
import RouterExplorer from './RouterExplorer';
import ScheduleDial from './ScheduleDial';
import DriftPanel from './DriftPanel';
import StatusBoard from './StatusBoard';
import PricingPlans from './PricingPlans';
import ConsentBar from './ConsentBar';
import LandingEffects from './LandingEffects';
import PriceFinding from './PriceFinding';
import RealPrice from './RealPrice';

const SITE = 'https://aistupidlevel.info';
const SIGN_IN = '/auth/signin?callbackUrl=%2F';
const SIGN_UP = '/auth/signup?callbackUrl=%2F';
const SIGN_UP_ROUTER = '/auth/signup?callbackUrl=%2Frouter';
const PROVIDERS = ['openai', 'anthropic', 'google', 'deepseek', 'kimi', 'glm'];
/**
 * Tools the Smart Router works with, shown as a moving tape under the provider row. Every one is
 * either a published ASL integration (n8n node, MCP server, AI SDK provider, RAGFlow provider) or
 * an integration contributed upstream; all of them already work through the OpenAI-compatible
 * endpoint, and /router/docs#integrations shows how to connect each.
 */
const INTEGRATIONS: Array<{ name: string; logo: string }> = [
  { name: 'n8n', logo: 'n8n.svg' },
  { name: 'MCP', logo: 'mcp.svg' },
  { name: 'LiteLLM', logo: 'litellm.svg?v=2' },
  { name: 'Vercel AI SDK', logo: 'vercel.svg' },
  { name: 'CrewAI', logo: 'crewai.svg' },
  { name: 'Dify', logo: 'dify.svg' },
  { name: 'RAGFlow', logo: 'ragflow.svg' },
  { name: 'Cherry Studio', logo: 'cherrystudio.svg' },
  { name: 'LibreChat', logo: 'librechat.svg' },
  { name: 'promptfoo', logo: 'promptfoo.svg' },
  { name: 'Crush', logo: 'crush.png' },
];
/** The first benchmark run, 8 August 2025. */
const FIRST_RUN = Date.UTC(2025, 7, 8);

/** The demo's requests are examples; each one's ranking and pick come from the live router. */
const DEMO: Array<{ id: string; q: string; meta: string; key: string }> = [
  { id: 'auto-coding', q: 'Fix the race condition in checkout.ts', meta: 'stream', key: 'best_coding' },
  { id: 'auto-cheapest', q: 'Tag 2,000 support tickets by intent', meta: 'batch', key: 'cheapest' },
  { id: 'auto-task', q: 'Design the event schema for multi-tenant billing', meta: 'match_task', key: 'match_task_design' },
  { id: 'auto-tooling', q: 'Move Tuesday’s design review and email the team', meta: '3 tools', key: 'best_tooling' },
  { id: 'auto-fastest', q: 'Suggest a subject line for this email', meta: 'short', key: 'fastest' },
  { id: 'auto-value-coding', q: 'Write unit tests for parseDate()', meta: 'code', key: 'best_value_coding' },
];

/**
 * Changes the test record shows, newest first. Re-derived from the runs on 2026-10-15: the same
 * tasks before and after each date, means per run (api: the 12-month observability analysis).
 */
const CHANGES: Array<{ when: string; model: string; big: string; cap: string; text: string }> = [
  { when: '12 Aug 2026', model: 'DeepSeek V4 Pro', big: '2×', cap: 'longer answers',
    text: 'A new build overnight. Answers twice as long (728 → 1,478 tokens) and 72% slower, under the same model name.' },
  { when: '31 Jul 2026', model: 'DeepSeek V4 Flash', big: '2×', cap: 'cost per correct answer',
    text: 'A new build overnight. Answers twice as long (510 → 1,045 tokens), 64% slower, and each correct answer cost almost twice as much at the same price per token.' },
  { when: 'March 2026', model: 'GLM-4.6', big: '−6 pts', cap: 'pass rate',
    text: 'Answers about a quarter longer (907 → 1,149 tokens), and its pass rate on the same tasks fell from 94% to 87%.' },
];

const FAQ: Array<[string, string]> = [
  ['Are AI models really getting worse over time?',
    'Sometimes — and usually without notice. Providers change weights, safety layers and serving infrastructure behind the same model name. AI Stupid Level re-runs the same tasks on every model on a fixed schedule and compares each one with its own history, so a drop shows up as data instead of a hunch.'],
  ['Is ChatGPT getting worse? Is Claude getting worse?',
    'Check the live scores. Every OpenAI and Anthropic model we track is re-tested on coding every 4 hours and on reasoning and tool use every day, and a model is flagged only when a change holds up statistically — not after one bad run.'],
  ['What does “cost per correct fix” mean?',
    'What we paid the provider, at its list price, for every attempt at a task, divided by the attempts that passed the hidden tests. A model that is cheap per token but fails often can cost more per correct result than a pricier one that gets it right, so this is the number that tells you what the work really costs.'],
  ['Which AI model is best for coding right now?',
    'It changes, which is the point. The leaderboard ranks every model we track on real repository bug fixes every 4 hours, and the router’s auto-coding mode sends your request to the current leader among the models you have keys for.'],
  ['How is the Smart Router different from other LLM routers?',
    'It routes on measured quality, not just price and uptime. Rankings come from our own continuous benchmarks, drift-flagged models drop behind healthy ones, and every response explains its pick in an X-AISM-Reasoning header. You keep your own provider keys and pay providers directly.'],
  ['Can you test the models on our own tasks?',
    'Yes. A workload assessment runs up to 20 of your real tasks on three models in our harness, with a report in 7 days. Our team can also build a custom benchmark around your workflow, run it continuously alongside our public suites, and connect it to your Smart Router, so your requests keep going to the model that is best on your work.'],
  ['Do you mark up tokens or resell inference?',
    'No. Requests are sent with your own provider keys and billed to you by the provider at their list price. Plans include a monthly number of routed requests; past that you can top up credits or move up a plan.'],
  ['Which providers and models do you cover?',
    'OpenAI, Anthropic, Google, DeepSeek, Moonshot AI (Kimi) and Z.ai (GLM). The router handles text, code and tool calls. It does not route images or audio, because we do not measure them and will not route what we do not measure.'],
  ['Why do I need an account to see the leaderboard?',
    'A free account costs nothing and includes every category ranking over the last 24 hours, 7 days and 30 days, a three-model watchlist with email alerts, 1,000 routed requests a month and a Data API key. The newest run, as it lands, is part of the paid plans. Model pages, the methodology and the status page stay open to everyone.'],
];

/** Reveal-on-scroll props: the given classes plus lp-up, with an optional stagger delay. */
const up = (d?: string, cls = ''): { className: string; style?: CSSProperties } =>
  ({ className: `${cls} lp-up`.trim(), ...(d ? { style: { '--d': d } as CSSProperties } : {}) });

/** The router's selling points: in the hero when there is no measured finding to show, else in the router section. */
function RouterFacts({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <dl className={`lp-facts ${className}`.trim()} style={style}>
      <div><dt>0%</dt><dd>markup on tokens. Providers bill you directly, at their own list price.</dd></div>
      <div><dt>15</dt><dd>auto routing modes, from <code>auto-coding</code> to <code>auto-cheapest</code>.</dd></div>
      <div><dt>10&nbsp;min</dt><dd>between health checks on every provider the router can pick.</dd></div>
    </dl>
  );
}

/**
 * What an assessment report shows, built from our own public coding results (labelled as a sample,
 * never a customer's): the most accurate model, the hero's two, and what the numbers say.
 */
function SampleReport({ price }: { price: PriceSnapshot }) {
  const c = price.coding;
  const f = price.finding;
  if (!c || !f || f.b.costPerSuccess == null) return null;
  const top = c.models.reduce((x, y) => (y.passRate > x.passRate ? y : x));
  const picks = [top, f.b, f.a].filter((m, i, all) => all.findIndex(x => x.name === m.name) === i);
  const asOften = f.b.passRate - f.a.passRate >= 0.02 ? 'more often than' : 'about as often as';
  return (
    <figure className="lp-report lp-up">
      <figcaption className="lp-report-head"><b>Sample report</b><span>Built from our public coding tasks, {dayRange(c.from, c.to)}</span></figcaption>
      <div className="lp-report-scroll">
        <table>
          <thead><tr><th scope="col">Model</th><th scope="col">Passed</th><th scope="col">Per 1,000 correct</th><th scope="col">Typical attempt</th></tr></thead>
          <tbody>
            {picks.map(m => (
              <tr key={m.name} className={m.name === f.b.name ? 'is-pick' : undefined}>
                <th scope="row"><span className="lp-lgc"><img src={logoFor(m.vendor)} alt="" width={16} height={16} loading="lazy" /></span>{m.displayName}</th>
                <td>{pct(m.passRate)}</td>
                <td>{m.costPerSuccess != null ? per1k(m.costPerSuccess) : '—'}</td>
                <td>{duration(m.medianMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="lp-report-rec">
        <b>What the numbers say</b>
        {f.b.displayName} passed {asOften} {f.a.displayName}, and each correct fix cost {times(f.ratio)} less.
        {top.name !== f.b.name && top.costPerSuccess != null && <> {top.displayName} passed the most attempts, at {times(top.costPerSuccess / f.b.costPerSuccess)} the cost of {f.b.displayName} per correct fix.</>}
        {' '}On your own tasks the answer can be different, and that is what an assessment measures.
      </p>
    </figure>
  );
}

export default async function Landing() {
  const [snapshot, health, roster, price, corpus, visits] = await Promise.all([
    getLandingSnapshot(), getProviderHealth(), getModelRoster(), getPriceSnapshot(), getCorpus(), getVisitTotal(),
  ]);
  const buyable = (['pro', 'developer', 'teams'] as SellablePlan[]).filter(p => priceIdFor(p, 'monthly') || priceIdFor(p, 'annual'));

  const modelCount = snapshot?.modelCount || roster.length || 24;
  const providerCount = snapshot?.providerCount || 6;
  const scenarios: DemoScenario[] = DEMO.flatMap(d => {
    const snap = snapshot?.strategies[d.key];
    return snap && snap.rows.length ? [{ id: d.id, q: d.q, meta: d.meta, snap }] : [];
  });
  const models = [...roster].sort((a, b) =>
    (PROVIDERS.indexOf(a.vendor) - PROVIDERS.indexOf(b.vendor)) || a.displayName.localeCompare(b.displayName));

  const finding = price?.finding && price.coding ? price : null;
  const coded = (price?.coding?.models ?? []).filter(m => m.costPerSuccess != null).map(m => m.costPerSuccess as number);
  const spread = coded.length > 1 ? { lo: Math.min(...coded), hi: Math.max(...coded) } : null;

  const months = Math.max(1, Math.floor((Date.now() - FIRST_RUN) / (30.44 * 86_400_000)));
  const tests = corpus ? Math.floor((corpus.runs + corpus.toolSessions + corpus.deepSessions) / 1000) * 1000 : 0;
  const visitsText = visits == null ? null
    : visits >= 1_000_000 ? `${(Math.floor(visits / 100_000) / 10).toFixed(1)}M+` : `${Math.floor(visits / 1000)}K+`;
  const stats: Array<{ count?: number; text?: string; suffix?: string; label: string }> = [
    { count: months, label: 'months of real API tests, since August 2025' },
    ...(tests ? [{ count: tests, suffix: '+', label: 'tests run: code fixes, reasoning sessions and agent tasks' }] : []),
    { count: modelCount, label: `models from ${providerCount} providers, on the same tests and schedule` },
    ...(visitsText ? [{ text: visitsText, label: 'visits since launch' }] : []),
    { text: '$0', label: 'from AI model providers, and no affiliate links' },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'Organization', name: 'AI Stupid Level', alternateName: ['ASL', 'asl.info'],
      url: SITE, logo: `${SITE}/asl-mark.png`,
      description: 'Independent, continuous benchmarks of large language models, drift detection, and a Smart Router that sends every request to the model measured best for it.',
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
    ...(models.length ? [{
      '@context': 'https://schema.org', '@type': 'ItemList', name: 'AI models benchmarked by AI Stupid Level',
      numberOfItems: models.length,
      itemListElement: models.map((m, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/models/${m.slug}`, name: m.displayName })),
    }] : []),
  ];

  return (
    <div className={`lp ${lpBody.variable} ${lpDisplay.variable}`}>
      {/* Dark unless the visitor chose a theme — before the first paint of anything below. */}
      <script dangerouslySetInnerHTML={{ __html: darkDefaultScript() }} />
      <script dangerouslySetInnerHTML={{ __html: "(function(){var d=document.documentElement;d.classList.add('lp-js');setTimeout(function(){if(!window.__lpReady)d.classList.remove('lp-js')},4000)})();" }} />
      {jsonLd.map((j, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />)}
      <DarkDefault />
      <LandingEffects />
      <LandingNav signInHref={SIGN_IN} signUpHref={SIGN_UP} />

      {/* ── hero ── Two versions of the same first screen, one shown per width (styles/landing.css),
          both server-rendered so every visitor and crawler gets the same page. Phones keep the original
          router-first hero; wider screens ask the value question beside a measured finding. */}
      <header className="lp-hero lp-textured" id="top">
        <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="lp-wrap lp-hero-m">
          <div className="lp-hero-top">
            <p className="lp-live lp-intro" style={{ '--d': '.05s' } as CSSProperties}><i /><span><b>Live</b> · {modelCount} models re-ranked after every run</span></p>
            <h1 className="lp-h1 lp-intro" style={{ '--d': '.12s' } as CSSProperties}>Models change overnight. <span className="lp-b">Your router should know.</span></h1>
            <div className="lp-hero-row">
              <div>
                <p className="lp-lead lp-intro" style={{ '--d': '.22s' } as CSSProperties}>
                  AI Stupid Level benchmarks {modelCount} frontier models around the clock and routes every request to whichever one
                  is <strong>measurably best right now</strong> — for code, reasoning, tool use, speed or cost. One OpenAI-compatible
                  endpoint. Your own provider keys. Zero markup on tokens.
                </p>
                <div className="lp-cta lp-intro" style={{ '--d': '.3s' } as CSSProperties}>
                  <Link className="lp-btn lp-btn-primary lp-btn-lg" href={SIGN_UP_ROUTER}>Get your router key <span className="lp-ar">→</span></Link>
                  <Link className="lp-btn lp-btn-ghost lp-btn-lg" href={SIGN_UP}>See today’s leaderboard</Link>
                </div>
                <p className="lp-fine lp-intro" style={{ '--d': '.36s' } as CSSProperties}>Free account: every ranking, a 3-model watchlist and 1,000 routed requests a month. No card.</p>
              </div>
              <RouterFacts className="lp-intro" style={{ '--d': '.42s' } as CSSProperties} />
            </div>
          </div>
          <div className="lp-intro" style={{ '--d': '.5s' } as CSSProperties}>
            {scenarios.length
              ? <RouterDemo scenarios={scenarios} modelCount={modelCount} />
              : <div className="lp-rv"><p className="lp-rv-fallback">Live routing decisions are refreshing. <Link className="lp-more" href="/router/docs">Read how the Smart Router decides</Link></p></div>}
          </div>
        </div>
        <div className="lp-wrap lp-hero-d">
          <p className="lp-live lp-intro" style={{ '--d': '.05s' } as CSSProperties}><i /><span><b>Live</b> · {modelCount} models · real API tests since August 2025</span></p>
          <h1 className="lp-h1 is-q lp-intro" style={{ '--d': '.12s' } as CSSProperties}>Is your AI worth what you’re paying? <span className="lp-b">And is it still as good as last month?</span></h1>
          <div className="lp-hero-row">
            <div>
              <p className="lp-lead lp-intro" style={{ '--d': '.22s' } as CSSProperties}>
                AI Stupid Level has tested AI models on a fixed schedule since August 2025: every model on the same tasks, through
                each provider’s own API. Not votes, measurements. See which models <strong>get the job done</strong>, what a
                correct result really costs, and when a model changes. Our Smart Router puts it to work, sending every request to
                the model that is measurably best right now.
              </p>
              <div className="lp-cta lp-intro" style={{ '--d': '.3s' } as CSSProperties}>
                <a className="lp-btn lp-btn-primary lp-btn-lg" href="#price">Check your AI <span className="lp-ar">→</span></a>
                <a className="lp-btn lp-btn-ghost lp-btn-lg" href="#router">Explore the Smart Router</a>
              </div>
              <p className="lp-fine lp-intro" style={{ '--d': '.36s' } as CSSProperties}>
                Building on AI? <a className="lp-fine-a" href="#assessment">We benchmark the models on your own work</a>, and keep it running.
                Free account: every ranking, a 3-model watchlist and 1,000 routed requests a month. No card.
              </p>
            </div>
            {finding
              ? <div className="lp-intro" style={{ '--d': '.42s' } as CSSProperties}><PriceFinding price={finding} /></div>
              : <RouterFacts className="lp-intro" style={{ '--d': '.42s' } as CSSProperties} />}
          </div>
        </div>
      </header>

      {/* ── providers and scale ── */}
      <section className="lp-sec lp-proof lp-A" aria-label="Providers and scale">
        <div className="lp-wrap">
          <div className="lp-proof-row lp-up">
            <p className="lp-proof-label">Measured and routed across {providerCount} providers</p>
            <ul className="lp-logos">
              {PROVIDERS.map(p => (
                <li key={p} className="lp-logo-it"><span className="lp-lgc"><img src={`/logos/${p}.svg`} alt="" width={24} height={24} /></span>{PROVIDER_LABEL[p]}</li>
              ))}
            </ul>
          </div>
          <div className="lp-tape-row lp-up">
            <p className="lp-proof-label">Works with the tools you build on</p>
            <div className="lp-tape" role="region" aria-label="Tools the Smart Router works with">
              <ul className="lp-tape-track">
                {[...INTEGRATIONS, ...INTEGRATIONS].map((it, i) => (
                  <li key={i} className="lp-logo-it" aria-hidden={i >= INTEGRATIONS.length || undefined}>
                    <span className="lp-lgc"><img src={`/integrations/${it.logo}`} alt="" width={24} height={24} loading="lazy" /></span>{it.name}
                  </li>
                ))}
              </ul>
            </div>
            <Link className="lp-more lp-tape-more" href="/router/docs#integrations">How to connect each one</Link>
          </div>
          <div {...up('.1s')}>
            <div className="lp-stats">
              {stats.map(s => (
                <div key={s.label} className="lp-stat">
                  <b>{s.count != null ? <><span data-count={s.count}>{s.count.toLocaleString('en-US')}</span>{s.suffix}</> : s.text}</b>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── the real price of AI ── */}
      <section className="lp-sec lp-C" id="price" aria-labelledby="lp-price-h">
        <div className="lp-wrap">
          <div className="lp-head lp-head-split lp-up">
            <p className="lp-kicker">The real price of AI</p>
            <h2 className="lp-h2" id="lp-price-h">Price per token isn’t price per result.</h2>
            <p className="lp-lead">
              Every model gets the same tasks, and every attempt is priced at the provider’s list price. Divide what the attempts
              cost by the ones that succeeded and you get what a correct result really costs
              {spread ? <>: on our coding tasks, from <strong>{per1k(spread.lo)}</strong> to <strong>{per1k(spread.hi)}</strong> per 1,000 correct fixes</> : null}.
              Pick the model you use and see what does as well for less.
            </p>
          </div>
          {price
            ? <div className="lp-up"><RealPrice price={price} /></div>
            : <p className="lp-lead">The cost comparison is refreshing. <Link className="lp-more" href="/compare">Compare the models</Link></p>}
        </div>
      </section>

      {/* ── drift ── */}
      <section className="lp-sec lp-B lp-textured" id="drift">
        <div className="lp-wrap">
          <div className="lp-head lp-head-split lp-up">
            <p className="lp-kicker">AI drift detection</p>
            <h2 className="lp-h2">When a model quietly changes, you see it — and the router moves on.</h2>
            <p className="lp-lead">Providers change models without changing the name. We have tested every model on a fixed schedule since August 2025, so a change leaves its mark in the record: in quality, in speed and in what each answer costs. A few of them:</p>
          </div>
          <ol className="lp-log lp-up" aria-label="Changes in the record">
            {CHANGES.map(c => (
              <li key={c.when}>
                <p className="lp-log-when">{c.when}</p>
                <p className="lp-log-big"><b>{c.big}</b><span>{c.cap}</span></p>
                <h3 className="lp-log-m">{c.model}</h3>
                <p className="lp-log-t">{c.text}</p>
              </li>
            ))}
          </ol>
          <DriftPanel />
          <div className="lp-trio lp-up">
            <div><b>Per suite, per model</b><p>Coding, reasoning and tool use each run their own Page-Hinkley detector against the model’s own baseline, tuned on real run-to-run noise.</p></div>
            <div><b>An hourly canary</b><p>Fixed probes run every hour; a sustained shift has to pass Welch’s t-test before it opens an incident.</p></div>
            <div><b>Evidence, not vibes</b><p>Every flag points to the runs behind it. Full history and the diagnosis behind each change come with Pro.</p></div>
          </div>
          <p {...up()}><Link className="lp-more" href="/ai-drift-detection" style={{ marginTop: 32 }}>AI drift detection: is your model getting worse?</Link></p>
        </div>
      </section>

      {/* ── workload assessment and custom benchmarks ── */}
      <section className="lp-sec lp-A" id="assessment">
        <div className="lp-wrap">
          <div className="lp-head lp-head-split lp-up">
            <p className="lp-kicker">For teams building on AI</p>
            <h2 className="lp-h2">Benchmark the models on your own work.</h2>
            <p className="lp-lead">Public scores tell you which model is best on our tasks. An assessment tells you which one is best on yours — measured by the same harness, the same scoring rules and the same statistics.</p>
          </div>
          <ol className="lp-steps">
            <li {...up('', 'lp-step')}><p className="lp-step-n">01</p><h3 className="lp-h3">Send up to 20 real tasks</h3><p>Prompts, files and the answers you would accept. We confirm the scope within 2 business days.</p></li>
            <li {...up('.08s', 'lp-step')}><p className="lp-step-n">02</p><h3 className="lp-h3">We run 3 models of your choice</h3><p>In the same sandbox as the public leaderboard, with repeated trials so a lucky run can’t decide the result.</p></li>
            <li {...up('.16s', 'lp-step')}><p className="lp-step-n">03</p><h3 className="lp-h3">Report in 7 days</h3><p>Per-task results, cost and latency for each model, and our recommendation.</p></li>
          </ol>
          <div className="lp-asm">
            {price && <SampleReport price={price} />}
            <div {...up('.08s', 'lp-keep')}>
              <p className="lp-kicker">Then keep it running</p>
              <h3 className="lp-h3">Your own benchmark, wired into your router.</h3>
              <p>Our team builds a custom benchmark around your workflow — your tasks, your acceptance rules, your formats — and runs it continuously alongside our public suites. It connects to your Smart Router, so your requests keep going to whichever model is best on your work, and you hear about it when that changes.</p>
              <ul className="lp-ticks">
                <li><b>Built by our team</b> for your use case, from your real tasks.</li>
                <li><b>Runs on our schedule</b>, with drift alerts on your own suite.</li>
                <li><b>Drives your router</b>: the model that wins on your work gets your traffic.</li>
              </ul>
            </div>
          </div>
          <div className="lp-offer lp-up">
            <div className="lp-offer-price"><b>{ASSESSMENT_PRICE_LABEL}</b><span>One-off, paid at booking. Full refund if your tasks can’t be measured. Credited against an annual plan within 30 days.</span></div>
            <div className="lp-offer-go">
              <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/assessment">Book an assessment <span className="lp-ar">→</span></Link>
              <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/contact">Discuss your workload</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── smart router ── */}
      <section className="lp-sec lp-B lp-textured" id="router">
        <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="lp-wrap">
          <div className="lp-head lp-head-split lp-up">
            <p className="lp-kicker">Smart Router</p>
            {/* Phones show the hero's own "Models change overnight" headline, so this one differs there. */}
            <h2 className="lp-h2"><span className="lp-wide-only">Models change overnight. Your router should know.</span><span className="lp-phone-only">One endpoint. Fifteen ways to decide.</span></h2>
            <p className="lp-lead">Point any OpenAI-compatible client at ASL and every request goes to the model that is measurably best right now — for code, reasoning, tool use, speed or cost — ranked on the same results as this page. One endpoint, your own provider keys, zero markup on tokens.</p>
          </div>
          {/* On phones the hero already shows these two (.lp-hero-m), so they are hidden there. */}
          {finding && <RouterFacts {...up('', 'is-row lp-wide-only')} />}
          <div {...up('.06s', 'lp-router-demo lp-wide-only')}>
            {scenarios.length
              ? <RouterDemo scenarios={scenarios} modelCount={modelCount} />
              : <div className="lp-rv"><p className="lp-rv-fallback">Live routing decisions are refreshing. <Link className="lp-more" href="/router/docs">Read how the Smart Router decides</Link></p></div>}
          </div>
          {snapshot
            ? <RouterExplorer snapshot={snapshot} />
            : <p className="lp-lead">Live routing data is refreshing — <Link className="lp-more" href="/router/docs">read the router documentation</Link></p>}
          <p className="lp-compat lp-up">Also speaks Anthropic: native <code>/v1/messages</code> passthrough, plus <code>/v1/embeddings</code>. Works with any client that lets you set a base URL. <Link className="lp-more" href="/router/docs">Router documentation</Link></p>
          <p {...up('', 'lp-router-go')}><Link className="lp-btn lp-btn-primary lp-btn-lg" href={SIGN_UP_ROUTER}>Get your router key <span className="lp-ar">→</span></Link></p>
        </div>
      </section>

      {/* ── router internals ── */}
      <section className="lp-sec lp-A" aria-labelledby="lp-internals">
        <div className="lp-wrap">
          <div className="lp-head lp-head-split lp-up">
            <p className="lp-kicker">Router internals</p>
            <h2 className="lp-h2" id="lp-internals">Built for agents in production.</h2>
            <p className="lp-lead">A benchmark-driven pick is only half of a router. These are the details that decide whether it survives real traffic.</p>
          </div>
          <div className="lp-fgrid">
            <div {...up('', 'lp-fi')}><span className="lp-spec">0% markup</span><h3 className="lp-h3">Your keys, your bill</h3><p>Requests go out with your own OpenAI, Anthropic, Google, DeepSeek, Moonshot and Z.ai keys, so providers bill you directly. We add nothing to token prices — plans include a number of routed requests.</p></div>
            <div {...up('.06s', 'lp-fi')}><span className="lp-spec">Per suite</span><h3 className="lp-h3">Drift-aware by default</h3><p>When a model’s detector fires on the suite your strategy depends on — or it has an open canary incident — it drops behind healthy models. The routing reason names who was passed over.</p></div>
            <div {...up('.12s', 'lp-fi')}><span className="lp-spec">5 fallbacks per request</span><h3 className="lp-h3">Outages route around you</h3><p>Each request carries up to 5 fallbacks: first from your own fallback order (a list of up to 10 models, skipping any that are unavailable), then the best models at other providers. A circuit opens after 5 straight failures and probes again after 60 seconds.</p></div>
            <div {...up('', 'lp-fi')}><span className="lp-spec">All six providers</span><h3 className="lp-h3">Tool loops that don’t derail</h3><p>Native tool calls with the provider’s own call ids, each model’s reasoning carried between turns, and a loop that stays on the model that started it. Forced <code>tool_choice</code> and <code>json_schema</code> work everywhere — natively, or emulated and checked.</p></div>
            <div {...up('.06s', 'lp-fi')}><span className="lp-spec">32 MB · 15 min</span><h3 className="lp-h3">Long context, long thinking</h3><p>Native streaming on every provider, request bodies up to 32 MB for 1M-token contexts, and a 15-minute timeout for models that think before they answer.</p></div>
            <div {...up('.12s', 'lp-fi')}><span className="lp-spec">Per key · per project</span><h3 className="lp-h3">Budgets that hold</h3><p>Hard and soft monthly budgets on every key and project, a maximum price per 1M tokens, a maximum latency, and provider or model exclusions — all checked before a request is sent.</p></div>
            <div {...up('', 'lp-fi')}><span className="lp-spec"><code>X-AISM-Reasoning</code></span><h3 className="lp-h3">Every pick explained</h3><p>Each response names the model, the provider, the latency and why it won. Preview any routing setting against the real pipeline without spending a request.</p></div>
            <div {...up('.06s', 'lp-fi')}><span className="lp-spec">AES-256-GCM</span><h3 className="lp-h3">Private by default</h3><p>Prompt logging is off unless you turn it on. Logged prompts are scrubbed of secrets before they are encrypted, and so are your provider keys.</p></div>
            <div {...up('.12s', 'lp-fi')}><span className="lp-spec">14-day window</span><h3 className="lp-h3">Learns from production</h3><p>Real failures and your ratings through <code>/v1/router/feedback</code> adjust each model’s effective score, so a model that benchmarks well but fails in practice loses ground.</p></div>
          </div>
        </div>
      </section>

      {/* ── benchmarks ── */}
      <section className="lp-sec lp-C" id="benchmarks">
        <div className="lp-wrap">
          <div className="lp-head lp-head-split lp-up">
            <p className="lp-kicker">Benchmarks</p>
            <h2 className="lp-h2">Measured around the clock, not once a quarter.</h2>
            <p className="lp-lead">The router is only as good as its data. Every model gets the same tasks, the same harness and the same scoring, on a fixed schedule — shown here in your time zone.</p>
          </div>
          <div className="lp-bench">
            <div {...up()}><ScheduleDial /></div>
            <div {...up('.1s')}>
              <div className="lp-sched">
                <div className="lp-sch"><i className="lp-key" /><div><b>Provider health</b><span>A short completion to every provider with our own key. Failures are re-checked after 15 seconds.</span></div><em>Every 10 min<small>144 a day</small></em></div>
                <div className="lp-sch"><i className="lp-key c" /><div><b>Canary drift probe</b><span>Fixed coding probes on every model, compared with its own history using Welch’s t-test.</span></div><em>Hourly<small>24 a day</small></em></div>
                <div className="lp-sch"><i className="lp-key cd" /><div><b>Coding</b><span>Real repository bug fixes plus one hard function — 7 tasks, 7 attempts each.</span></div><em>Every 4 hours<small>6 a day</small></em></div>
                <div className="lp-sch"><i className="lp-key cal" /><div><b>Calibration</b><span>Known unknowns: does a model say so when it can’t know the answer?</span></div><em>Every 6 hours<small>4 a day</small></em></div>
                <div className="lp-sch"><i className="lp-key d" /><div><b>Reasoning · tool use</b><span>Multi-turn engineering sessions checked by code, and sandboxed agent tasks with real tools.</span></div><em>Daily<small>night run</small></em></div>
                <div className="lp-sch"><i className="lp-key d" /><div><b>Robustness · bias</b><span>Prompt-variation and demographic sweeps, run outside the score.</span></div><em>Daily<small>night run</small></em></div>
                <div className="lp-sch"><i className="lp-key p" /><div><b>Context rot</b><span>Long-context accuracy from 8K to 1M tokens, by length and position. Pilot.</span></div><em>Weekly<small>Pro and up</small></em></div>
              </div>
              <div className="lp-bench-foot"><Link className="lp-more" href="/methodology">How every score is computed</Link><p>Methodology public. Test tasks private, so no lab can train on them.</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── model index ── */}
      {models.length > 0 && (
        <section className="lp-sec lp-A" id="models" aria-labelledby="lp-models-h">
          <div className="lp-wrap">
            <div className="lp-head lp-head-split lp-up">
              <p className="lp-kicker">On the board</p>
              <h2 className="lp-h2" id="lp-models-h">Every model we measure.</h2>
              <p className="lp-lead">{models.length} models from {providerCount} providers. Each has its own page with its score history, drift record and cost — open to everyone.</p>
            </div>
            <ul className="lp-models lp-up">
              {models.map(m => (
                <li key={m.slug}>
                  <Link className="lp-model" href={`/models/${m.slug}`}>
                    <span className="lp-lgc"><img src={`/logos/${PROVIDERS.includes(m.vendor) ? m.vendor : 'openai'}.svg`} alt="" width={18} height={18} loading="lazy" /></span>
                    <span><b>{m.displayName}</b><small>{PROVIDER_LABEL[m.vendor] ?? m.vendor}</small></span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── provider status ── */}
      <section className="lp-sec lp-C" id="status">
        <div className="lp-wrap">
          <div className="lp-head lp-head-split lp-up">
            <p className="lp-kicker">Provider status</p>
            <h2 className="lp-h2">Every provider, checked every 10 minutes.</h2>
            <p className="lp-lead">A short completion goes to each provider with our own key, day and night. Failures are re-checked 15 seconds later and attributed, so the router only avoids real outages — and the status page never blames a vendor for our problem.</p>
          </div>
          {health && health.length
            ? <StatusBoard providers={health.filter(p => PROVIDERS.includes(p.provider)).map(compactHealth)} />
            : <div className="lp-sb"><p className="lp-sb-empty">Live provider health is refreshing. <Link className="lp-more" href="/status">Open the status page</Link></p></div>}
          <div className="lp-causes lp-up">
            <div><b>Provider</b><p>Unreachable twice while our side is healthy. Opens an incident; the router stops sending traffic.</p></div>
            <div><b>Our account</b><p>A billing or quota answer for our own key. Logged, never shown as the provider’s outage.</p></div>
            <div><b>Probe</b><p>A malformed or timed-out check of our own making. Re-run, not reported.</p></div>
            <div><b>Our server</b><p>Several providers failing together, or our own network down. The router keeps routing.</p></div>
          </div>
          <p {...up()}><Link className="lp-more" href="/status" style={{ marginTop: 32 }}>Open the live status page</Link></p>
        </div>
      </section>

      {/* ── data api + alerts ── */}
      <section className="lp-sec lp-A" id="api">
        <div className="lp-wrap lp-two">
          <div {...up()}>
            <p className="lp-kicker">Data API</p>
            <h2 className="lp-h3">Every score, as JSON.</h2>
            <p className="lp-lead">Keyed access to scores, history, drift and incidents — for dashboards, CI gates and model reviews. Build against the free key at 10 requests a day; production tiers go up to 250,000 a day.</p>
            <div className="lp-codecard">
              <div className="lp-cc-head"><b>GET /api/v1/models/:id/history</b><span>asl_ key</span></div>
              <pre className="lp-code"><span className="f">curl</span> https://aistupidlevel.info/api/v1/models/292/history?period=7d \{'\n'}  -H <span className="s">&quot;X-API-Key: $ASL_DATA_KEY&quot;</span></pre>
              <pre className="lp-code">{'{\n  '}<span className="k">&quot;success&quot;</span>: <span className="n">true</span>,{'\n  '}<span className="k">&quot;period&quot;</span>: <span className="s">&quot;7d&quot;</span>,{'\n  '}<span className="k">&quot;data&quot;</span>: {'{\n    '}<span className="k">&quot;dataPoints&quot;</span>: <span className="n">41</span>,{'\n    '}<span className="k">&quot;data&quot;</span>: [{'\n      { '}<span className="k">&quot;timestamp&quot;</span>: <span className="s">&quot;2026-10-14T10:00:00Z&quot;</span>, <span className="k">&quot;score&quot;</span>: <span className="n">86</span>,{'\n        '}<span className="k">&quot;suite&quot;</span>: <span className="s">&quot;combined&quot;</span>, <span className="k">&quot;axes&quot;</span>: {'{ … } },\n      …'}</pre>
            </div>
            <p style={{ marginTop: 18 }}><Link className="lp-more" href="/api-docs">Data API documentation</Link></p>
          </div>
          <div {...up('.1s')}>
            <p className="lp-kicker">Watchlist &amp; alerts</p>
            <h2 className="lp-h3">Know before your users do.</h2>
            <p className="lp-lead">Pick the models you depend on. We tell you when one of them slips — by email, in a weekly summary, or by webhook into your own tools.</p>
            <ul className="lp-ticks">
              <li><b>3 models free</b>, 20 on Pro and Developer, unlimited on Teams.</li>
              <li><b>Email when a watched model falls 5 points</b> below where it was a week ago. Set your own thresholds on paid plans.</li>
              <li><b>A weekly summary</b> every Monday of what moved and what held.</li>
              <li><b>Signed webhooks</b> for regressions and budget thresholds, and a team watchlist that alerts everyone in the workspace.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── pricing ── */}
      <section className="lp-sec lp-C" id="pricing">
        <div className="lp-wrap">
          <PricingPlans buyable={buyable} signUpHref={SIGN_UP} />
        </div>
      </section>

      {/* ── faq ── */}
      <section className="lp-sec lp-A" id="faq">
        <div className="lp-wrap lp-faq">
          <div className="lp-head lp-up">
            <p className="lp-kicker">FAQ</p>
            <h2 className="lp-h2">Questions people actually ask.</h2>
            <p className="lp-lead">Still unsure? The <Link href="/methodology">methodology</Link> explains every number on the site, and the <Link href="/faq">full FAQ</Link> covers the rest.</p>
          </div>
          <div {...up('.08s')}>
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </div>
      </section>

      {/* ── final ── */}
      <section className="lp-sec lp-final lp-textured">
        <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="lp-wrap">
          <h2 className="lp-h2 lp-up">Stop guessing which model is best today.</h2>
          <p {...up('.08s', 'lp-lead')}>Create a free account to see every ranking, watch three models and route your first 1,000 requests — with your own keys.</p>
          <div className="lp-cta lp-up" style={{ '--d': '.14s' } as CSSProperties}>
            <Link className="lp-btn lp-btn-primary lp-btn-lg" href={SIGN_UP}>Create free account <span className="lp-ar">→</span></Link>
            <Link className="lp-btn lp-btn-ghost lp-btn-lg" href={SIGN_IN}>Log in</Link>
          </div>
          <nav className="lp-explore lp-up" aria-label="Explore">
            <Link href="/methodology">Methodology</Link><Link href="/ai-drift-detection">AI drift detection</Link><Link href="/router/docs">Smart Router docs</Link>
            <Link href="/api-docs">Data API</Link><Link href="/status">Provider status</Link><Link href="/compare">Compare models</Link>
            <Link href="/pricing">Pricing</Link><Link href="/faq">FAQ</Link><Link href="/about">About</Link>
          </nav>
        </div>
      </section>

      <ConsentBar />
    </div>
  );
}
