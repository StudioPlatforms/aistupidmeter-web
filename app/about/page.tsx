import type { Metadata } from 'next';
import Link from 'next/link';
import { DocPage, Section, Prose, Cards, Card, Callout, Stats } from '@/components/docs/Doc';

export const metadata: Metadata = {
  title: 'Independent AI Benchmarking',
  description: 'Learn about our mission to provide transparent, independent AI model benchmarking. Meet our team, explore enterprise data licensing, and see how we keep the measurement honest.',
  keywords: [
    'About AI benchmarking platform', 'Independent AI testing', 'AI model drift dataset',
    'AI performance history data', 'Enterprise AI benchmarking', 'AI model monitoring team',
    'Transparent AI evaluation', 'AI performance monitoring company', 'LLM regression detection',
  ],
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About AI Stupid Level | Independent AI Benchmarking',
    description: 'Independent watchdog platform for AI model performance. Published methodology, no vendor affiliations, no paid placement.',
    url: 'https://aistupidlevel.info/about',
    type: 'website',
  }
};

// The counts below are read from the database, never typed in (they had drifted thousands of
// rows out of date while hand-written). Regenerated hourly.
export const revalidate = 3600;

interface SuiteStat { total: number; enabled: boolean }
interface Corpus { runs: number; toolSessions: number; deepSessions: number; incidents: number }
interface Status { adversarial?: SuiteStat; robustness?: SuiteStat; bias?: SuiteStat; corpus?: Corpus; rankedModels?: { name: string }[] }

async function getStatus(): Promise<Status | null> {
  const base = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  try {
    const res = await fetch(`${base}/dashboard/enhanced-suites`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return (await res.json())?.data ?? null;
  } catch {
    return null;
  }
}

/** "188,000+": rounded down, so a published figure is never higher than the database. */
function atLeast(v: number | undefined, step: number): string {
  if (typeof v !== 'number' || v <= 0) return '—';
  return `${(Math.floor(v / step) * step).toLocaleString('en-US')}+`;
}

const TEAM = [
  {
    name: 'Ionut Adrian Visan',
    role: 'Founder & CEO',
    bio: 'Ionut Adrian Visan is the Founder and CEO of AI Stupid Level. A technology entrepreneur and full-stack builder, he has spent his career building products across AI, software infrastructure, blockchain and real-time systems. At ASL, he leads the company’s vision of creating an independent reliability and intelligence layer for AI — continuously measuring how models perform, detecting meaningful changes over time, and helping organizations make better decisions about the AI systems they depend on.',
    linkedin: 'https://www.linkedin.com/in/ionut-visan-205ab01a5/',
  },
  {
    name: 'Alexandra Chirilă',
    role: 'AI Evaluation & Epistemology',
    bio: 'Alexandra Chirilă, PhD, works at the intersection of philosophy, epistemology and AI evaluation. At AI Stupid Level, she contributes to the design and development of rigorous reasoning evaluations and to the broader question of how AI capabilities, reliability and risk should be measured and interpreted. Her work also spans Assurance 2.0 and safety-case review, bringing a critical perspective to how evidence about AI systems can support trustworthy real-world decisions.',
    linkedin: 'https://www.linkedin.com/in/alexandraa-chirila/',
  },
  {
    name: 'Marius Răzvan Palimariu',
    role: 'AI Infrastructure Lead',
    bio: 'Marius Răzvan Palimariu is the AI Infrastructure Lead at AI Stupid Level, bringing experience from IBM, NVIDIA and Nscale. He focuses on the infrastructure required to evaluate AI systems continuously and reliably at scale, from model execution and compute to the systems supporting ASL’s benchmarking and intelligence platform. His experience across large-scale AI and infrastructure environments helps ASL turn rigorous model evaluation into a dependable production system.',
    linkedin: 'https://www.linkedin.com/in/palimariumarius/',
  },
];

const TOC = [
  { id: 'mission', label: 'Why we exist' },
  { id: 'team', label: 'Team' },
  { id: 'independence', label: 'Funding and independence' },
  { id: 'validation', label: 'Keeping the measurement honest' },
  { id: 'data', label: 'Data and licensing' },
  { id: 'verify', label: 'Check it yourself' },
  { id: 'values', label: 'Values' },
  { id: 'contact', label: 'Contact' },
];

export default async function AboutPage() {
  const status = await getStatus();
  const c = status?.corpus;
  const extraRunning = [status?.adversarial, status?.robustness, status?.bias].some((s) => (s?.total ?? 0) > 0);

  return (
    <DocPage
      kicker="About AI Stupid Level"
      title="An independent watchdog for AI model performance"
      lead="We measure AI models on a fixed schedule and compare each one with its own past, so that a silent change to a model you depend on is visible. We are independent of every vendor we measure."
      toc={TOC}
      actions={(
        <>
          <Link className="doc-btn is-primary" href="/">View the leaderboards</Link>
          <Link className="doc-btn" href="/methodology">Methodology</Link>
          <Link className="doc-btn" href="/router/test-keys">Test your keys</Link>
        </>
      )}
    >
      <Section id="mission" title="Why we exist">
        <Prose>
          <p>Developers have long reported that models they rely on seem to get worse after launch: GPT-4 was widely described as “lazier” than it had been, and Claude as refusing more. Providers can change a model behind the same API name — fine-tuning, safety updates, routing, quantisation — and nobody was systematically measuring it. AI Stupid Level exists to close that gap. We ran our first benchmark on 8 August 2025 and have not stopped since.</p>
        </Prose>
        <Cards min={230}>
          <Card title="Vendors don’t disclose changes"><p>Silent updates, capability reductions and performance shifts happen without warning.</p></Card>
          <Card title="Most benchmarks are snapshots"><p>A single measurement, no standard error, ranks that separate models by less than their noise, and nothing watching for change.</p></Card>
          <Card title="Developers need evidence"><p>Choosing a provider for a production system deserves data, not impressions.</p></Card>
          <Card title="Accountability needs independence"><p>Monitoring by someone with no stake in the result keeps the record honest.</p></Card>
        </Cards>
      </Section>

      <Section id="team" title="Team">
        <Cards min={300}>
          {TEAM.map((m) => (
            <Card key={m.name} kicker={m.role} title={m.name}>
              <p>{m.bio}</p>
              <p><a href={m.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a></p>
            </Card>
          ))}
        </Cards>
        <Prose>
          <p>The methodology is open to anyone who wants to check it: the scoring weights, the statistical methods and the drift constants are all on the <Link href="/methodology">methodology page</Link>, and the full write-up is a paper, the <a href="/asl-public-benchmark-methodology-2026.pdf" target="_blank" rel="noopener noreferrer">Public Benchmark Methodology (2026, PDF)</a>. The benchmark backend — task definitions, runners and scoring code — is deliberately private, because when it was public providers optimised against the specific tasks, and a test that can be studied in advance stops measuring anything. The front end is <a href="https://github.com/StudioPlatforms/aistupidmeter-web" target="_blank" rel="noopener noreferrer">open source</a>, so the site you are reading can be checked line by line. Corrections are welcome.</p>
        </Prose>
      </Section>

      <Section id="independence" title="Funding and independence">
        <Cards min={300}>
          <Card title="No vendor money"><p>No AI model provider funds us, and none of our investors is an AI model provider.</p></Card>
          <Card title="No vendor relationships"><p>No financial relationship with OpenAI, Anthropic, Google, DeepSeek, Moonshot, Zhipu or any other model provider.</p></Card>
          <Card title="No affiliate links"><p>We earn no commission from API sign-ups or referrals. Placement on a board is decided by the measurement alone.</p></Card>
          <Card title="Our servers, our keys"><p>Scheduled benchmarks run on our servers with API keys we pay for. The one exception is labelled on the site: reasoning and tool-use runs for five <Link href="/methodology#community">community-funded models</Link> are paid for by visitors with their own keys — the same test, on the same servers.</p></Card>
          <Card title="Published method"><p>Weights, statistical tests and drift constants are published in full. The tasks themselves are withheld so they cannot be trained against.</p></Card>
        </Cards>
        <Prose>
          <h3>How operations are funded</h3>
        </Prose>
        <Cards min={240}>
          <Card title="Venture funding"><p>Our primary funding. It covers the gap revenue does not — benchmarking every model every four hours is not cheap — and none of it comes from a company we measure.</p></Card>
          <Card title="Subscriptions"><p>Paid plans for longer history, drift analytics, more watched models, the Smart Router and higher Data API tiers.</p></Card>
          <Card title="Data licensing"><p>Historical benchmark data for teams that need it in bulk, licensed to non-vendors only.</p></Card>
        </Cards>
      </Section>

      <Section id="validation" title="Keeping the measurement honest">
        <Cards min={240}>
          <Card title="Published method"><p>The weights, tests and constants are on the methodology page and in the 2026 paper. If you think a weight is wrong, you can quote it back to us.</p></Card>
          <Card title="Tasks held back on purpose"><p>When the tasks were public, providers optimised against them. A test that can be studied in advance, or scraped into training data, stops measuring anything.</p></Card>
          <Card title="Every score versioned"><p>Each score records the exact version of the tests it ran under, so a change we make is never mistaken for a change the model made.</p></Card>
          <Card title="Corrections on the record"><p>When we find a fault in our own measurement we say so and retract what it produced — 492 drift incidents in September 2026 — rather than quietly deleting it.</p></Card>
        </Cards>
      </Section>

      <Section id="data" title="Data and licensing"
        lead="Counted from the database when this page was last generated, since the first benchmark on 8 August 2025.">
        <Stats items={[
          { value: atLeast(c?.runs, 1000), label: 'benchmark runs (individual task attempts)' },
          { value: atLeast(c?.toolSessions, 1000), label: 'tool-use sessions in real sandboxes' },
          { value: atLeast(c?.deepSessions, 100), label: 'multi-turn reasoning sessions' },
          { value: String(status?.rankedModels?.length ?? '—'), label: 'models tested now' },
        ]} />
        <Prose>
          <p>Beyond the free platform and the <Link href="/api-docs">Data API</Link>, we license the underlying data in bulk to teams that need more. Everything below is data we hold today; we do not sell datasets we have not collected.{' '}
            {extraRunning
              ? 'The adversarial-safety, bias and prompt-robustness suites started recently and their datasets are still too young to offer.'
              : 'Adversarial-safety, bias and prompt-robustness testing are built but not yet collecting, so they are not offered.'}
          </p>
        </Prose>
        <Cards min={420}>
          <Card title="Performance time series">
            <p>Every score we have recorded, per model, per measure and per suite, with the test version each run used.</p>
            <ul><li>{atLeast(c?.runs, 1000)} runs since August 2025</li><li>Per-measure breakdown, not just headline scores</li><li>Intervals and per-attempt variation</li></ul>
          </Card>
          <Card title="Drift and change-point record">
            <p>Detected change points and drift incidents, with the detector state behind each.</p>
            <ul><li>{atLeast(c?.incidents, 100)} change points and incidents; the 492 retracted incidents are kept and flagged, not deleted</li><li>Change points before 13 September 2026 came from a mixed-suite series and are identifiable by date</li><li>Test-version history, so changes to the method separate from changes to a model</li></ul>
          </Card>
          <Card title="Tool-use sessions">
            <p>Full agent transcripts from real sandboxed executions: which tools were chosen, with what parameters, and what happened.</p>
            <ul><li>{atLeast(c?.toolSessions, 1000)} sessions</li><li>Tool selection and parameter accuracy</li><li>Execution traces and error recovery</li></ul>
          </Card>
          <Card title="Reasoning sessions">
            <p>Multi-turn working sessions scored on five measures; continuity is checked by running code against rules and decisions stated earlier in the session.</p>
            <ul><li>{atLeast(c?.deepSessions, 100)} sessions</li><li>Turn-by-turn scoring</li><li>Raw outputs where retention policy allows</li></ul>
          </Card>
        </Cards>
        <Callout title="Enterprise data access">
          Continuously updated, with history back to 8 August 2025. Custom extracts, bulk exports and dedicated support are available. If you need something we do not collect, say so — we would rather tell you it does not exist yet than sell you a promise.{' '}
          <a href="https://studioplatforms.eu/products/aistupidlevel/data-licensing" target="_blank" rel="noopener noreferrer">Pricing and contact</a>
        </Callout>
      </Section>

      <Section id="verify" title="Check it yourself">
        <Cards min={230}>
          <Card title="Open web application"><p>The site you are reading is open source. The benchmark repository is private for the reason above; the method is published in full.</p><p><a href="https://github.com/StudioPlatforms/aistupidmeter-web" target="_blank" rel="noopener noreferrer">Source code</a></p></Card>
          <Card title="Data API"><p>Rankings, history, intervals and current degradations as JSON, with a free key. <code>GET /api/v1/models</code></p><p><Link href="/api-docs">API reference</Link></p></Card>
          <Card title="Methodology"><p>How each suite is scored, how ranks are tied, and how drift is detected, with the measured false-alarm rates.</p><p><Link href="/methodology">Read the methodology</Link></p></Card>
          <Card title="Test your keys"><p>Run the same tasks with your own API keys, scored by the same code as our published runs.</p><p><Link href="/router/test-keys">Test your keys</Link></p></Card>
        </Cards>
      </Section>

      <Section id="values" title="Values">
        <Cards min={240}>
          <Card title="Scientific rigour"><p>Established statistical methods — Page-Hinkley change detection on each suite’s own series, Welch’s t-test for the hourly canary, standard errors measured from run-to-run repeatability, ranks that tie when a lead is inside the noise — with the constants and measured false-alarm rates published.</p></Card>
          <Card title="Transparency"><p>Every scoring decision is documented and every result is reproducible with your own keys. Trust through verification, not claims.</p></Card>
          <Card title="Independence"><p>No vendor funding, no affiliate revenue, no conflicts of interest. Our only loyalty is to the people who need accurate data.</p></Card>
          <Card title="Community"><p>Built by developers, for developers. The front end is open to contributions, feedback shapes what we measure next, and corrections to the method are welcome.</p></Card>
        </Cards>
      </Section>

      <Section id="contact" title="Contact">
        <Cards min={240}>
          <Card title="Social">
            <ul>
              <li><a href="https://x.com/AIStupidlevel" target="_blank" rel="noopener noreferrer">X: @AIStupidlevel</a></li>
              <li><a href="https://www.linkedin.com/company/asl-aistupidlevel-info" target="_blank" rel="noopener noreferrer">LinkedIn: AI Stupid Level</a></li>
              <li><a href="https://github.com/studioplatforms" target="_blank" rel="noopener noreferrer">GitHub: @studioplatforms</a></li>
              <li><a href="https://www.reddit.com/r/aistupidlevel/" target="_blank" rel="noopener noreferrer">Reddit: r/aistupidlevel</a></li>
            </ul>
          </Card>
          <Card title="Questions">
            <ul>
              <li><Link href="/contact">Contact the team</Link></li>
              <li><Link href="/faq">Frequently asked questions</Link></li>
              <li><Link href="/methodology">Methodology</Link></li>
            </ul>
          </Card>
        </Cards>
      </Section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'AI Stupid Level',
            url: 'https://aistupidlevel.info',
            description: 'Independent AI benchmarking platform',
            foundingDate: '2025',
            sameAs: ['https://x.com/AIStupidlevel', 'https://www.linkedin.com/company/asl-aistupidlevel-info', 'https://github.com/StudioPlatforms', 'https://www.reddit.com/r/aistupidlevel/'],
          }),
        }}
      />
    </DocPage>
  );
}
