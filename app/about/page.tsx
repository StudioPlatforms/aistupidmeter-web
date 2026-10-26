import type { Metadata } from 'next';
import { ORG_ID, breadcrumbLd, graphLd, pageMeta, utcStamp, webPageLd } from '@/lib/seo';
import JsonLd from '@/components/seo/JsonLd';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdFacts, RdRows, RdStats, RdFinal, tocNumber } from '@/components/landing/Reading';

export const metadata: Metadata = pageMeta({
  title: 'About ASL: independent, $0 from providers',
  description: 'An independent LLM benchmark since August 2025: $0 from model providers, no affiliate links, a public methodology and private test tasks. Meet the team.',
  path: '/about',
  keywords: [
    'About AI benchmarking platform', 'Independent AI testing', 'AI model drift dataset',
    'AI performance history data', 'Enterprise AI benchmarking', 'AI model monitoring team',
    'Transparent AI evaluation', 'AI performance monitoring company', 'LLM regression detection',
  ],
});

// The counts below are read from the database, never typed in (they had drifted thousands of
// rows out of date while hand-written). Regenerated hourly.
export const revalidate = 3600;

interface SuiteStat { total: number; enabled: boolean }
interface Corpus { runs: number; toolSessions: number; deepSessions: number; incidents: number }
interface Status { adversarial?: SuiteStat; robustness?: SuiteStat; bias?: SuiteStat; corpus?: Corpus; rankedModels?: { name: string }[]; generatedAt?: string }

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

/** Rounded down to `step`, so a published figure is never higher than the database. */
function floorTo(v: number | undefined, step: number): number | undefined {
  if (typeof v !== 'number' || v <= 0) return undefined;
  return Math.floor(v / step) * step;
}

/** "188,000+", or null when the figure is unavailable (the copy then omits the number). */
function atLeast(v: number | undefined, step: number): string | null {
  const f = floorTo(v, step);
  return f === undefined ? null : `${f.toLocaleString('en-US')}+`;
}

/** A stat tile for a figure, or nothing when it is unavailable: never a placeholder. */
function stat(v: number | undefined, step: number, label: string): { value: string; count?: number; suffix?: string; label: string }[] {
  const f = floorTo(v, step);
  return f === undefined ? [] : [{ value: `${f.toLocaleString('en-US')}+`, count: f, suffix: '+', label }];
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

/** First and last initials: "Ionut Adrian Visan" → "IV". */
const initials = (name: string) => {
  const w = name.split(/\s+/).filter(Boolean);
  return (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
};

const TOC = [
  { id: 'mission', label: 'Why we exist' },
  { id: 'team', label: 'Team' },
  { id: 'independence', label: 'Funding and independence' },
  { id: 'honest', label: 'How we keep it honest' },
  { id: 'data', label: 'Data and licensing' },
  { id: 'partners', label: 'Partners' },
  { id: 'contact', label: 'Contact' },
];
const n = (id: string) => tocNumber(TOC, id);

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

// World Summit AI's partner page has no anchor on our entry, so the link carries a text fragment:
// the browser scrolls to the first "AI Stupid Level (ASL)" on the page, which is our card's
// heading, and highlights it. The parentheses are percent-encoded as the fragment syntax requires.
const WSAI_PARTNER_URL = 'https://worldsummit.ai/commercial-partners/#:~:text=AI%20Stupid%20Level%20%28ASL%29';

export default async function AboutPage() {
  const status = await getStatus();
  const c = status?.corpus;
  const extraRunning = [status?.adversarial, status?.robustness, status?.bias].some((s) => (s?.total ?? 0) > 0);
  const runs = floorTo(c?.runs, 1000);
  const modelsNow = status?.rankedModels?.length;
  const runsAtLeast = atLeast(c?.runs, 1000);
  const incidentsAtLeast = atLeast(c?.incidents, 100);
  const toolAtLeast = atLeast(c?.toolSessions, 1000);
  const deepAtLeast = atLeast(c?.deepSessions, 100);
  // The counts were read from the database at this moment (the page is regenerated hourly).
  const countedAt = status?.generatedAt ? new Date(status.generatedAt) : new Date();

  return (
    <ReadingPage
      className="rd-about"
      kicker="About AI Stupid Level"
      title="An independent watchdog"
      accent="for AI model performance"
      lead="We measure AI models on a fixed schedule and compare each one with its own past, so that a silent change to a model you depend on is visible. We are independent of every vendor we measure."
      actions={(
        <>
          <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/" data-cta="about-hero-leaderboard">View the leaderboards <span className="lp-ar" aria-hidden="true">→</span></Link>
          <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/methodology" data-cta="about-hero-methodology">Methodology</Link>
          <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/router/test-keys" data-cta="about-hero-test-keys">Test your keys</Link>
        </>
      )}
      aside={(
        <dl className="lp-facts">
          {runs
            ? <div><dt><span data-count={runs}>{runs.toLocaleString('en-US')}</span>+</dt><dd>benchmark runs since our first, on 8 August 2025</dd></div>
            : <div><dt>2025</dt><dd>our first benchmark ran on 8 August, and we have not stopped since</dd></div>}
          {modelsNow ? <div><dt><span data-count={modelsNow}>{modelsNow}</span></dt><dd>models tested now, every one on the same schedule</dd></div> : null}
          <div><dt>0</dt><dd>money from AI model providers, and no affiliate links</dd></div>
        </dl>
      )}
      toc={TOC}
      final={(
        <RdFinal
          id="contact"
          title="Questions? Talk to the team"
          lead="We are a small team and we answer our own email."
          actions={(
            <>
              <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/contact" data-cta="about-final-contact">Contact the team <span className="lp-ar" aria-hidden="true">→</span></Link>
              <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/faq" data-cta="about-final-faq">Read the FAQ</Link>
            </>
          )}
          explore={(
            <>
              <span className="rd-follow">Follow us</span>
              <a href="https://x.com/AIStupidlevel" {...ext}>X</a>
              <a href="https://www.linkedin.com/company/asl-aistupidlevel-info" {...ext}>LinkedIn</a>
              <a href="https://www.reddit.com/r/aistupidlevel/" {...ext}>Reddit</a>
              <a href="https://github.com/studioplatforms" {...ext}>GitHub</a>
            </>
          )}
        />
      )}
    >
      <RdSection id="mission" n={n('mission')} title="Why we exist">
        <RdProse>
          <p>Developers have long reported that models they rely on seem to get worse after launch: GPT-4 was widely described as “lazier” than it had been, and Claude as refusing more. Providers can change a model behind the same API name — fine-tuning, safety updates, routing, quantisation — without saying so, and nobody was systematically measuring it.</p>
          <p>AI Stupid Level exists to close that gap. We ran our first benchmark on 8 August 2025 and have not stopped since. The reasons have not changed:</p>
        </RdProse>
        <ul className="rd-ticks lp-up">
          <li><b>Vendors don’t disclose changes.</b> Updates and capability reductions happen without warning.</li>
          <li><b>Most benchmarks are snapshots.</b> One measurement at launch, no error bars, and nothing watching for change afterwards.</li>
          <li><b>Choosing a model for production deserves evidence,</b> not impressions.</li>
          <li><b>Accountability needs independence.</b> Only someone with no stake in the result can keep an honest record.</li>
        </ul>
      </RdSection>

      <RdSection id="team" n={n('team')} title="Team">
        <div className="rd-people">
          {TEAM.map((m, i) => (
            <article key={m.name} className="rd-person lp-up" style={{ '--d': `${i * 0.08}s` } as React.CSSProperties}>
              <span className="rd-mono" aria-hidden="true">{initials(m.name)}</span>
              <div>
                <h3>{m.name}</h3>
                <span className="rd-role">{m.role}</span>
              </div>
              <p>{m.bio}</p>
              <a className="lp-more" href={m.linkedin} {...ext}>LinkedIn</a>
            </article>
          ))}
        </div>
      </RdSection>

      <RdSection id="independence" n={n('independence')} title="Funding and independence">
        <p className="rd-statement lp-up">Nobody who scores well on this site has paid us. That is the one line we will not cross.</p>
        <RdFacts rows={[
          ['Vendor money', 'None. No AI model provider funds us, and none of our investors is an AI model provider.'],
          ['Vendor relationships', 'No financial relationship with OpenAI, Anthropic, Google, DeepSeek, Moonshot, Zhipu or any other model provider.'],
          ['Affiliate links', 'None. We earn nothing from API sign-ups or referrals; a model’s place on a board is decided by the measurement alone.'],
          ['Who pays for the runs', <>We do: scheduled benchmarks run on our servers with API keys we pay for. The one exception is labelled on the site — reasoning and tool-use runs for five <Link key="c" href="/methodology#community">community-funded models</Link> are paid for by visitors with their own keys, running the same test on the same servers.</>],
          ['How we are funded', 'Venture funding, which covers what revenue does not — benchmarking every model every four hours is not cheap; paid plans; and data licensing to organisations that are not model vendors.'],
        ]} />
      </RdSection>

      <RdSection id="honest" n={n('honest')} title="How we keep it honest">
        <RdRows rows={[
          ['The method is published.', <>Every weight, statistical test and drift constant is on the <Link key="m" href="/methodology">methodology page</Link> and in the <a key="p" href="/asl-public-benchmark-methodology-2026.pdf" {...ext}>Public Benchmark Methodology (2026, PDF)</a>. If you think a weight is wrong, you can quote it back to us.</>],
          ['The tasks are not.', <>When the task bank was public, providers optimised against it, and a test that can be studied in advance — or scraped into training data — stops measuring anything. The backend that holds the tasks, runners and scoring code stays private; the <a key="g" href="https://github.com/StudioPlatforms/aistupidmeter-web" {...ext}>web application is open source</a>, so the site you are reading can be checked line by line.</>],
          ['Every score is versioned.', 'Each one records the exact version of the tests it ran under, so a change we make is never mistaken for a change the model made.'],
          ['Corrections stay on the record.', <>When we find a fault in our own measurement we say so and retract what it produced — 492 drift incidents in September 2026 — rather than quietly deleting it. What the record has caught, and what it has not, is written up under <Link key="r" href="/research">Research</Link>.</>],
          ['You can check it yourself.', <><Link key="t" href="/router/test-keys">Test your keys</Link> runs the same tasks with your own API keys, scored by the same code as our published runs, and the <Link key="a" href="/api-docs">Data API</Link> serves the same data as JSON with a free key.</>],
        ]} />
      </RdSection>

      <RdSection id="data" n={n('data')} title="Data and licensing"
        lead={c
          ? `As of ${utcStamp(countedAt)}: counted from the database, since our first run on 8 August 2025.`
          : 'Counted from the database when this page is generated, since our first run on 8 August 2025.'}>
        <RdStats items={[
          ...stat(c?.runs, 1000, 'benchmark runs (individual task attempts)'),
          ...stat(c?.toolSessions, 1000, 'tool-use sessions in real sandboxes'),
          ...stat(c?.deepSessions, 100, 'multi-turn reasoning sessions'),
          ...(modelsNow ? [{ value: String(modelsNow), count: modelsNow, label: 'models tested now' }] : []),
        ]} />
        <RdProse>
          <p>Beyond the free site and the Data API, we license the underlying data in bulk to teams that need more, and only to organisations that are not model vendors. Everything listed is data we hold today; we do not sell datasets we have not collected.</p>
        </RdProse>
        <RdFacts rows={[
          ['Performance time series', `Every score, per model, per measure and per suite, with the test version each run used${runsAtLeast ? ` — ${runsAtLeast} runs` : ''}, with intervals and per-attempt variation.`],
          ['Drift and change points', `${incidentsAtLeast ? `${incidentsAtLeast} change points and incidents` : 'Every change point and incident'} with the detector state behind each. The 492 retracted incidents are kept and flagged, and change points before 13 September 2026, which came from a mixed-suite series, are identifiable by date.`],
          ['Tool-use sessions', `${toolAtLeast ? `${toolAtLeast} full agent transcripts` : 'Full agent transcripts'} from sandboxed runs: which tools were called, with what parameters, and what happened.`],
          ['Reasoning sessions', `${deepAtLeast ? `${deepAtLeast} multi-turn sessions` : 'Multi-turn sessions'}, scored turn by turn, with raw outputs where retention policy allows.`],
          ['Not yet offered', extraRunning
            ? 'Adversarial safety, bias and prompt robustness: the suites started recently and their datasets are still too young.'
            : 'Adversarial safety, bias and prompt robustness: built, not yet collecting.'],
        ]} />
        <RdProse>
          <p>Custom extracts, bulk exports and support are available, with history back to 8 August 2025. If you need something we do not collect, say so — we would rather tell you it does not exist yet than sell you a promise. <a href="https://studioplatforms.eu/products/aistupidlevel/data-licensing" {...ext}>Licensing, pricing and contact</a>.</p>
        </RdProse>
      </RdSection>

      <RdSection id="partners" n={n('partners')} title="Partners">
        <div className="rd-partner lp-up">
          <p className="rd-partner-label">Official partner</p>
          <div className="rd-partner-t">
            <b>World Summit AI</b>
            <p>AI Stupid Level is an official partner of World Summit AI.</p>
          </div>
          <a className="lp-btn lp-btn-ghost" href={WSAI_PARTNER_URL} {...ext}>See our entry on their partner page <span className="lp-ar" aria-hidden="true">↗</span></a>
        </div>
      </RdSection>

      {/* The organisation node (name, logo, sameAs) is declared once, in app/layout.tsx; this page refers to it by id. */}
      <JsonLd data={graphLd([
        breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'About', path: '/about' }]),
        webPageLd({
          path: '/about',
          name: 'About AI Stupid Level',
          description: 'Who runs AI Stupid Level, how it is funded, how the measurement is kept honest, and how the underlying data is licensed.',
          about: { '@id': ORG_ID },
        }),
      ])} />
    </ReadingPage>
  );
}
