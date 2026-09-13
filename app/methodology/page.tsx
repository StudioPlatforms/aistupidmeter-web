import type { Metadata } from 'next';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';

export const metadata: Metadata = {
  title: 'AI Benchmarking Methodology | How We Test AI Models',
  description: 'Comprehensive technical documentation of our 9-axis AI benchmarking methodology using Page-Hinkley drift detection, statistical confidence intervals, and execution-based testing. Learn how we measure AI performance objectively.',
  keywords: [
    'AI benchmarking methodology',
    'How to test AI models',
    'AI performance testing framework',
    'LLM evaluation metrics',
    'AI drift detection algorithm',
    'AI benchmark scoring system',
    'Statistical AI testing',
    'Page-Hinkley drift detection',
    'Confidence intervals AI testing',
    'Objective AI measurement'
  ],
  alternates: { canonical: '/methodology' },
  openGraph: {
    title: 'AI Benchmarking Methodology | How We Test AI Models',
    description: 'Rigorous, statistically-sound approach to AI benchmarking with 9-axis scoring, confidence intervals, and drift detection.',
    url: 'https://aistupidlevel.info/methodology',
    type: 'article',
  }
};

const styles = {
  page: {
    background: 'var(--terminal-black, #f6f8fc)',
    minHeight: '100vh',
    fontFamily: 'var(--font-mono, "Courier New", monospace)',
    color: 'var(--phosphor-dim)',
  } as React.CSSProperties,
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '32px 20px 80px',
  } as React.CSSProperties,
  pageTitle: {
    fontSize: 'clamp(20px, 3.5vw, 28px)',
    fontWeight: 'bold',
    color: 'var(--phosphor-green, #1a73e8)',
    letterSpacing: '2px',
    textShadow: '0 0 8px rgba(26, 115, 232,0.4)',
    margin: '0 0 8px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  pageSub: {
    fontSize: '12px',
    color: 'var(--phosphor-dim, #5f6368)',
    marginBottom: '28px',
    letterSpacing: '0.3px',
    lineHeight: '1.5',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--amber-warning, #ffb000)',
    textTransform: 'uppercase' as const,
    letterSpacing: '1.5px',
    margin: '24px 0 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,
  panel: {
    background: 'rgba(0,0,0,0.04)',
    border: '1px solid rgba(192,192,192,0.15)',
    borderRadius: '3px',
    padding: '14px 16px',
    marginBottom: '12px',
  } as React.CSSProperties,
  panelTitle: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--phosphor-green)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '8px',
  } as React.CSSProperties,
  text: {
    fontSize: '11px',
    color: 'var(--phosphor-dim)',
    lineHeight: '1.65',
  } as React.CSSProperties,
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '10px',
    marginBottom: '12px',
  } as React.CSSProperties,
  grid4: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '10px',
    marginBottom: '12px',
  } as React.CSSProperties,
  link: {
    color: 'var(--phosphor-green)',
    textDecoration: 'none',
    fontWeight: 'bold',
  } as React.CSSProperties,
  divider: {
    borderTop: '1px solid rgba(192,192,192,0.15)',
    margin: '24px 0',
  } as React.CSSProperties,
  navPanel: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
    padding: '12px 14px',
    background: 'rgba(0,0,0,0.04)',
    border: '1px solid rgba(192,192,192,0.15)',
    borderRadius: '3px',
    marginBottom: '24px',
  } as React.CSSProperties,
  navLink: {
    fontSize: '10px',
    padding: '4px 10px',
    background: 'rgba(0,0,0,0.04)',
    border: '1px solid rgba(26, 115, 232,0.25)',
    color: 'var(--phosphor-green)',
    textDecoration: 'none',
    borderRadius: '2px',
    fontWeight: 'bold',
    letterSpacing: '0.3px',
  } as React.CSSProperties,
  whitepaperPanel: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '16px 18px',
    background: 'rgba(26, 115, 232,0.05)',
    border: '1px solid rgba(26, 115, 232,0.3)',
    borderRadius: '3px',
    marginBottom: '18px',
  } as React.CSSProperties,
  whitepaperTitle: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--amber-warning, #ffb000)',
    textTransform: 'uppercase' as const,
    letterSpacing: '1.5px',
    marginBottom: '6px',
  } as React.CSSProperties,
  whitepaperSub: {
    fontSize: '11px',
    color: 'var(--phosphor-dim)',
    lineHeight: '1.55',
    maxWidth: '52ch',
  } as React.CSSProperties,
  whitepaperButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    whiteSpace: 'nowrap' as const,
    fontSize: '11px',
    fontWeight: 'bold',
    letterSpacing: '0.8px',
    padding: '10px 16px',
    background: 'rgba(26, 115, 232,0.12)',
    border: '1px solid rgba(26, 115, 232,0.5)',
    color: 'var(--phosphor-green)',
    textDecoration: 'none',
    borderRadius: '2px',
  } as React.CSSProperties,
  codeBlock: {
    backgroundColor: 'rgba(26, 115, 232,0.05)',
    padding: '14px 16px',
    borderRadius: '3px',
    fontFamily: 'monospace',
    fontSize: '10px',
    border: '1px solid rgba(26, 115, 232,0.15)',
    marginBottom: '12px',
  } as React.CSSProperties,
  highlightPanel: {
    background: 'rgba(26, 115, 232,0.04)',
    border: '1px solid rgba(26, 115, 232,0.25)',
    borderLeft: '3px solid var(--phosphor-green, #1a73e8)',
    borderRadius: '3px',
    padding: '12px 16px',
    marginBottom: '12px',
  } as React.CSSProperties,
  warningPanel: {
    background: 'rgba(255,176,0,0.06)',
    border: '1px solid rgba(255,176,0,0.25)',
    borderLeft: '3px solid var(--amber-warning, #ffb000)',
    borderRadius: '3px',
    padding: '12px 16px',
    marginBottom: '12px',
  } as React.CSSProperties,
  suiteCard: (borderColor: string, bgColor: string) => ({
    padding: '14px 16px',
    background: bgColor,
    border: `1px solid ${borderColor}`,
    borderRadius: '3px',
  }) as React.CSSProperties,
};

/**
 * Live status of the enhanced suites, read from the API at build/revalidate time.
 *
 * This section used to be a hand-written claim, which is exactly how the page
 * ended up advertising three suites that were never switched on. Rendering from
 * the row counts means the page cannot say a suite is collecting data unless
 * rows exist.
 */
interface SuiteStat { total: number; last30Days: number; lastRun: string | null; enabled: boolean }
interface CodingCorpus { repoTasks: number; hardFunctionTasks: number; floorChecks: number; total: number }
interface CorpusTotals { runs: number; toolSessions: number; deepSessions: number; incidents: number; coding?: CodingCorpus }
interface RankedModel { name: string; vendor: string }
interface EnhancedStatus {
  adversarial: SuiteStat;
  robustness: SuiteStat;
  bias: SuiteStat;
  scoredPromptVariation: boolean;
  corpus?: CorpusTotals;
  rankedModels?: RankedModel[];
}

// Regenerate hourly. The page stays static — no per-request fetch.
export const revalidate = 3600;

async function getEnhancedStatus(): Promise<EnhancedStatus | null> {
  // Absolute URL: a relative path has no origin server-side. Goes straight to
  // the API on loopback, so nginx and its auth rules are not involved.
  const base = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  try {
    const res = await fetch(`${base}/dashboard/enhanced-suites`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    // A failed fetch must not break the page. The renderer below treats null as
    // "unknown" and says so rather than inventing a status.
    return null;
  }
}

function suiteStatusLine(stat: SuiteStat | undefined): { text: string; live: boolean } {
  if (!stat) return { text: 'Status unavailable', live: false };
  if (stat.total > 0) {
    const when = stat.lastRun ? new Date(stat.lastRun).toISOString().slice(0, 10) : 'unknown';
    return { text: `Live — ${stat.total.toLocaleString()} results recorded, latest ${when}`, live: true };
  }
  if (stat.enabled) return { text: 'Enabled, awaiting its first run', live: false };
  return { text: 'Not running — 0 results recorded', live: false };
}

/** Renders one suite's live status, colour-coded on whether it has real data. */
function SuiteStatus({ stat }: { stat?: SuiteStat }) {
  const { text, live } = suiteStatusLine(stat);
  return (
    <span style={{ color: live ? 'var(--phosphor-green)' : 'var(--amber-warning)', fontWeight: 'bold' }}>
      {text}
    </span>
  );
}

export default async function MethodologyPage() {
  const status = await getEnhancedStatus();
  return (
    <SubpageLayout>
      <div style={styles.page}>
        <div style={styles.container}>
          {/* Header */}
          <h1 style={styles.pageTitle}>
            AI Benchmarking Methodology — How We Test AI Models &amp; Detect Drift<span className="blinking-cursor"></span>
          </h1>
          <div style={styles.pageSub}>
            Complete Technical Methodology — Statistically Rigorous, Execution-Based, Continuous Monitoring
          </div>

          {/* Methodology whitepaper. The PDF is the public edition: it withholds
              the live task bank, hidden tests and detector calibration constants
              on purpose, so it can be shared for review without turning the
              benchmark into a training target. */}
          <div style={styles.whitepaperPanel}>
            <div>
              <div style={styles.whitepaperTitle}>Methodology Whitepaper</div>
              <div style={styles.whitepaperSub}>
                Public methodology edition, 2026 - measurement framework, benchmark
                surfaces, statistical interpretation and evidence-to-routing logic,
                written up for external technical review.
              </div>
            </div>
            <a
              href="/asl-public-benchmark-methodology-2026.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.whitepaperButton}
              aria-label="Download the AI Stupid Level public benchmark methodology whitepaper, PDF, 13 pages"
            >
              DOWNLOAD PDF
              <span style={{ opacity: 0.65, fontWeight: 'normal', letterSpacing: 0 }}>
                13 pages · 136 KB
              </span>
            </a>
          </div>

          {/* Quick Navigation */}
          <div style={styles.navPanel}>
            <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)', fontWeight: 'bold', letterSpacing: '0.8px', textTransform: 'uppercase', alignSelf: 'center', marginRight: '4px' }}>
              JUMP TO:
            </span>
            {[
              { label: '4 BENCHMARK SUITES', id: 'suites' },
              { label: '9-AXIS SCORING', id: 'scoring' },
              { label: 'STATISTICAL ANALYSIS', id: 'statistical' },
              { label: 'DRIFT DETECTION', id: 'drift' },
              { label: 'ENHANCED TESTING', id: 'enhancements' },
              { label: 'VALIDATION', id: 'validation' },
            ].map((item) => (
              <a key={item.id} href={`#${item.id}`} style={styles.navLink}>
                {item.label}
              </a>
            ))}
          </div>

          {/* Section 1: Benchmark Suites */}
          <h2 id="suites" style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[1]</span> THE 4 BENCHMARK SUITES
          </h2>
          <div style={styles.grid2}>
            <div style={styles.suiteCard('rgba(26, 115, 232,0.3)', 'rgba(26, 115, 232,0.05)')}>
              <div style={{ ...styles.panelTitle, marginBottom: '10px' }}>CODING SUITE</div>
              <div style={styles.text}>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Frequency</strong>: Every 4 hours<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Tasks</strong>: {status?.corpus?.coding ? `${status.corpus.coding.repoTasks} repo debugging + ${status.corpus.coding.hardFunctionTasks} hard function + ${status.corpus.coding.floorChecks} floor checks` : 'repo debugging, hard function and floor checks'}<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Trials</strong>: 7 per task, median scored<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Scoring</strong>: 9-axis evaluation<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Purpose</strong>: Debugging and coding capability
              </div>
            </div>

            <div style={styles.suiteCard('rgba(0,150,255,0.3)', 'rgba(0,100,200,0.08)')}>
              <div style={{ ...styles.panelTitle, marginBottom: '10px' }}>DEEP REASONING</div>
              <div style={styles.text}>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Frequency</strong>: Daily at 3 AM<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Tasks</strong>: 4 multi-turn scenarios<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Scoring</strong>: 13-axis evaluation<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Purpose</strong>: Complex reasoning tests
              </div>
            </div>

            <div style={styles.suiteCard('rgba(255,150,0,0.3)', 'rgba(200,100,0,0.08)')}>
              <div style={{ ...styles.panelTitle, marginBottom: '10px' }}>TOOL CALLING</div>
              <div style={styles.text}>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Frequency</strong>: Daily at 4 AM<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Tasks</strong>: 9, in real Docker sandboxes<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Scoring</strong>: 7-axis evaluation<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Purpose</strong>: Agent capability tests
              </div>
            </div>

            <div style={styles.suiteCard('rgba(255,0,150,0.3)', 'rgba(200,0,100,0.08)')}>
              <div style={{ ...styles.panelTitle, marginBottom: '10px' }}>CANARY SUITE</div>
              <div style={styles.text}>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Frequency</strong>: Every hour<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Tasks</strong>: 2 fixed probes (is_prime, merge_intervals), 2 trials each, 4,000-token answer budget; a trial that errors is not measured, not zero<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Detection</strong>: Welch&rsquo;s t-test on two windows &mdash; the last 6 h (a severe drop shows within the hour it lands) and the last 24 h (a moderate one six probes cannot separate from noise) &mdash; each against the prior 7 days on the same configuration; an incident needs a fall of at least 15 points at p &lt; 0.01, and closes itself when the gap does<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Response Time</strong>: within the hour<br/>
                <span style={{ opacity: 0.8 }}>
                  Until 13 September 2026 this suite raised an incident on any 10% fall in a 24-hour
                  mean, with no test of significance, on answers cut off at 500 tokens. The 446
                  incidents it produced are retracted and excluded from every count on this site.
                  The per-model drift signature had a related fault: its series interleaved the
                  coding, reasoning and tool-use suites (three different scales) across
                  configuration changes, so a reasoning run landing at 01:00 UTC read as a fall of
                  thirty points. Since 13 September 2026 it reads the coding suite on its current
                  configuration only; the 46 provider-wide incidents and 1,145 change points recorded
                  before then came from the old series.
                </span>
              </div>
            </div>
          </div>

          <div style={styles.highlightPanel}>
            <div style={{ ...styles.panelTitle, marginBottom: '6px' }}>OUTPUT TO DATE</div>
            <div style={styles.text}>
              Counted from the database when this page was last generated, not written by hand
              &mdash; the previous figures had drifted thousands of rows behind and stated two
              different tool-session counts in the same paragraph. Since the first benchmark on
              8 August 2025:<br/>
              {status?.corpus ? (
                <>
                  &rarr; {status.corpus.runs.toLocaleString()} scored benchmark runs<br/>
                  &rarr; {status.corpus.toolSessions.toLocaleString()} tool-calling sessions<br/>
                  &rarr; {status.corpus.deepSessions.toLocaleString()} deep-reasoning sessions<br/>
                  &rarr; {status.corpus.incidents.toLocaleString()} drift incidents and change points recorded
                </>
              ) : (
                <>&rarr; counts unavailable &mdash; the API did not answer when this page was generated</>
              )}
            </div>
          </div>

          <hr style={styles.divider} />

          {/* Section 2: Scoring System */}
          <h2 id="scoring" style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[2]</span> 9-AXIS SCORING METHODOLOGY
          </h2>
          <div style={{ ...styles.text, marginBottom: '14px' }}>
            Each task is evaluated across 9 dimensions. The weight on each is set by how much it can actually distinguish one model from another, measured — see below the table:
          </div>

          <div style={styles.codeBlock}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto 1fr', gap: '6px 14px', alignItems: 'center' }}>
              {[
                ['CORRECTNESS', '55%', 'Does the code actually work?'],
                ['STABILITY', '10%', 'Same answer run to run?'],
                ['EDGE CASES', '10%', 'The hidden tests it never saw'],
                ['DEBUGGING', '10%', 'Did it find the real defect?'],
                ['CODE QUALITY', '5%', 'Clean, maintainable code?'],
                ['EFFICIENCY', '5%', 'Output throughput'],
                ['FORMAT', '3%', 'Guardrail: clean, parseable output'],
                ['SAFETY', '2%', 'Guardrail: no dangerous operations'],
                ['COMPLEXITY', '0%', 'Measured and shown, but cannot rank (see below)'],
              ].map(([name, weight, desc], i) => (
                <div key={i} style={{ display: 'contents' }}>
                  <span style={{ color: 'var(--phosphor-green)', fontWeight: 'bold', fontSize: '10px' }}>{name}</span>
                  <span style={{ color: 'var(--amber-warning, #ffb000)', fontWeight: 'bold', fontSize: '10px' }}>{weight}</span>
                  <span style={{ color: 'var(--phosphor-dim)', fontSize: '10px' }}>&rarr;</span>
                  <span style={{ color: 'var(--phosphor-dim)', fontSize: '10px' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.warningPanel}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--amber-warning, #ffb000)' }}>
              Formula: FinalScore = Sum(axis_score x axis_weight)
            </span>
          </div>

          <div style={{ ...styles.text, marginTop: '14px' }}>
            <strong style={{ color: 'var(--phosphor-dim)' }}>Why these weights.</strong> They are set
            from what each axis can actually distinguish, not from how important it sounds. We
            measure it by averaging each model over several sweeps and then taking the spread
            <em> between</em> models &mdash; a single sweep cannot tell you this, because every model
            answers the same tasks, so an easy batch makes every axis look identical.
            <br/><br/>
            Measured over four days: stability 0.086, efficiency 0.061, correctness 0.018, edge
            cases 0.018, debugging 0.017, code quality 0.008, complexity 0.004. Complexity varies
            by four thousandths across all 24 ranked models. It cannot move anyone&rsquo;s rank, so it
            carries no weight &mdash; we still measure it, store it and show it, but it does not
            pretend to rank you. It previously carried 20%.
            <br/><br/>
            <strong style={{ color: 'var(--phosphor-dim)' }}>Format and safety are guardrails, not
            discriminators.</strong> They sit near 1.000 for every model by design. Their job is to
            cost a model points if it ever starts emitting malformed or dangerous code. A guardrail
            reading the same for everyone is the outcome you want, not a defect.
          </div>

          <hr style={styles.divider} />

          {/* Section 2b: What the coding suite actually asks */}
          <h2 id="repotasks" style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[2b]</span> WHAT THE CODING SUITE ASKS
          </h2>
          <div style={{ ...styles.text, marginBottom: '14px' }}>
            Until September 2026 the coding suite asked models to write single functions. That
            stopped working, and we can say exactly when: eight of its tasks were passing at
            99&ndash;100% across all 24 ranked models over hundreds of trials each. A task everybody
            passes does not rank anybody &mdash; it only dilutes the tasks that still do. Those
            eight were retired.
          </div>
          <div style={{ ...styles.text, marginBottom: '14px' }}>
            Writing harder functions did not fix it either. Nine deliberately difficult candidates
            were built and tested against the live fleet; eight were solved perfectly by every
            model down to the cheapest. Recall of a well-known specification &mdash; SemVer
            precedence, RFC 4180 quoting, calendar clamping, cron scheduling, first-order
            unification &mdash; no longer separates anything in 2026.
          </div>

          <div style={styles.grid2}>
            <div style={styles.suiteCard('rgba(26, 115, 232,0.3)', 'rgba(26, 115, 232,0.05)')}>
              <div style={{ ...styles.panelTitle, marginBottom: '10px' }}>REPO DEBUGGING TASKS</div>
              <div style={styles.text}>
                The model is handed a small working project and a <strong>bug report written as a
                user complaint</strong> &mdash; not a diagnosis. No file is named. It must locate
                the defect itself and return one corrected file. Grading runs the project&rsquo;s own
                test suite.
                <br/><br/>
                The cause sits a module away from where the symptom appears, with a plausible
                decoy in between.
              </div>
            </div>

            <div style={styles.suiteCard('rgba(255,150,0,0.3)', 'rgba(200,100,0,0.08)')}>
              <div style={{ ...styles.panelTitle, marginBottom: '10px' }}>HIDDEN TESTS</div>
              <div style={styles.text}>
                Every repo task is graded on tests the model <strong>never sees</strong>, weighted
                at three quarters of that task&rsquo;s score.
                <br/><br/>
                This is not a difficulty knob, it is an honesty one. On one task, deduplicating
                payments by amount makes every visible test pass and is still wrong &mdash; it
                stops a customer legitimately buying the same item twice. Eight of eighteen fleet
                runs took exactly that shortcut. Without hidden tests all eight score full marks.
              </div>
            </div>
          </div>

          <div style={styles.highlightPanel}>
            <div style={{ ...styles.panelTitle, marginBottom: '6px' }}>WHAT MAKES A TASK DISCRIMINATE</div>
            <div style={styles.text}>
              Nineteen repo candidates were built to ship six. The ones that failed taught the
              rule: a <strong>mechanical slip</strong> &mdash; a wrong comparison, a swapped
              argument, an off-by-one &mdash; gets fixed by every model, every time. Pagination,
              cache keys, penny rounding and rate-limiter refill were all solved 18/18.
              <br/><br/>
              What separates models is a bug whose correct repair requires a <strong>judgement
              about intended behaviour</strong>, paired with a cheaper fix that satisfies the
              reported symptom and is wrong. That is what the hidden tests are there to catch.
            </div>
          </div>

          <div style={styles.warningPanel}>
            <div style={{ ...styles.panelTitle, marginBottom: '6px' }}>WHEN A MODEL DECLINES A TASK</div>
            <div style={styles.text}>
              Some models refuse to answer some prompts. We have measured it on entirely benign
              ones &mdash; a script that buckets sales figures by date, a price-cache fixture, and
              in one case a function that checks whether a number is prime.
              <br/><br/>
              A refusal is a provider&rsquo;s content decision, not a fact about the model&rsquo;s ability,
              so we <strong>do not score it as a zero</strong>. The task drops out and the model is
              scored over what it attempted. That is the fair treatment but it is not a neutral
              one: declined tasks are disproportionately the hard ones, so such a score covers an
              easier corpus than its rivals. Those rows are marked <strong>PARTIAL</strong> with the
              count and the task names, and should not be read as directly comparable. We do not
              impute a value for work that was never done.
            </div>
          </div>

          <hr style={styles.divider} />

          {/* Section 3: Statistical Analysis */}
          <h2 id="statistical" style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[3]</span> STATISTICAL RIGOR (95% CONFIDENCE INTERVALS)
          </h2>
          <div style={{ ...styles.text, marginBottom: '14px' }}>
            Unlike benchmarks showing single measurements, we provide confidence intervals to quantify uncertainty.
          </div>

          <div style={{ ...styles.panel, background: 'rgba(0,100,200,0.06)', borderColor: 'rgba(0,150,255,0.2)' }}>
            <div style={styles.panelTitle}>WHY 7 TRIALS?</div>
            <div style={styles.text}>
              &rarr; AI models are <strong style={{ color: 'var(--amber-warning)' }}>stochastic</strong> (same prompt, different outputs)<br/>
              &rarr; Single measurements are unreliable<br/>
              &rarr; 7 trials = optimal balance of cost vs statistical power<br/>
              &rarr; Provides 95% confidence intervals using t-distribution
            </div>
          </div>

          <div style={styles.codeBlock}>
            <div style={{ color: 'var(--phosphor-green)', fontWeight: 'bold', marginBottom: '8px', fontSize: '10px' }}>EXAMPLE CALCULATION:</div>
            <div style={{ color: 'var(--phosphor-dim)', fontSize: '10px', lineHeight: '1.8' }}>
              A model on py/eval_expr:<br/>
              92 | 94 | 90 | 93 | 91 | 92 | 93&nbsp;&nbsp;(7 trials)<br/>
              <br/>
              Mean = 92.1<br/>
              Std Dev = 1.35<br/>
              Std Error = 1.35 / sqrt(7) = 0.51<br/>
              t-value = 2.447 (df=6, 95% CI)<br/>
              Margin = 2.447 x 0.51 = 1.24<br/>
              <br/>
              <strong style={{ color: 'var(--amber-warning)' }}>
                Final: 92.1 +/- 1.2<br/>
                95% CI: [90.9, 93.4]
              </strong>
            </div>
          </div>

          <div style={styles.highlightPanel}>
            <span style={{ fontSize: '11px', color: 'var(--phosphor-green)' }}>
              <strong>Translation:</strong> &quot;We're 95% confident claude-opus-4-5's true performance is between 90-94&quot;
            </span>
          </div>

          <hr style={styles.divider} />

          {/* Section 4: Drift Detection */}
          <h2 id="drift" style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[4]</span> DRIFT DETECTION (PAGE-HINKLEY TEST)
          </h2>
          <div style={{ ...styles.text, marginBottom: '14px' }}>
            Detects <strong style={{ color: 'var(--amber-warning)' }}>sustained</strong> performance changes, not daily noise.
            We use the <strong style={{ color: 'var(--amber-warning)' }}>Page-Hinkley test</strong>, a cumulative-sum
            change detector. Our database column is still named <code>cusum</code> for historical reasons and
            you will see that label in the API &mdash; it holds the Page-Hinkley statistic below.
          </div>

          <div style={{ ...styles.codeBlock, borderColor: 'rgba(255,45,0,0.2)', background: 'rgba(255,45,0,0.04)' }}>
            <div style={{ color: 'var(--amber-warning)', fontWeight: 'bold', marginBottom: '8px', fontSize: '10px' }}>PAGE-HINKLEY TEST (DECREASE DETECTION):</div>
            <div style={{ color: 'var(--phosphor-dim)', fontSize: '10px', lineHeight: '1.8' }}>
              Scores are on a 0&ndash;1 scale where higher is better, so the statistic<br/>
              accumulates when a score lands <em>below</em> the running mean:<br/>
              <br/>
              1. mean&#8348; = running mean of observations since the last reset<br/>
              2. m&#8348; = m&#8348;&#8331;&#8321; + (mean&#8348; &minus; x&#8348; &minus; delta)<br/>
              3. M&#8348; = min(m&#8321; &hellip; m&#8348;)<br/>
              4. PH&#8348; = m&#8348; &minus; M&#8348;<br/>
              5. If PH&#8348; &gt; lambda: ALERT, then reset the detector fully<br/>
              <br/>
              <span style={{ color: 'var(--phosphor-green)' }}>
                Parameters (lib/page-hinkley.ts):<br/>
                &rarr; Tolerance (delta): 0.01 &mdash; one point of the 0&ndash;100 score<br/>
                &rarr; Threshold (lambda): 0.30 &mdash; thirty points of accumulated shortfall<br/>
                &rarr; Cold start: 10 observations before it may fire<br/>
                &rarr; Rolling baseline for alerting: 28 days
              </span>
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelTitle}>WHAT THE DETECTOR CAN AND CANNOT SEE &mdash; MEASURED</div>
            <div style={{ ...styles.text, marginBottom: '10px' }}>
              <strong style={{ color: 'var(--phosphor-dim)' }}>Scope, stated plainly:</strong> the
              Page-Hinkley detector described here runs on the <strong>coding suite&rsquo;s</strong> daily
              medians, where there are six measurements a day to take a median of. The deep-reasoning
              and tool-calling suites produce one measurement a day and are monitored by the 28-day
              baseline and confidence-interval comparison in the alerting layer, not by this
              change-point test. Extending it to them is not a flag to flip, and the reason is
              measured: on the same day-to-day basis the coding score moves 1.5&ndash;3 points, the
              deep-reasoning score about 10, and the tool-calling score about <strong>26</strong> &mdash;
              because each tool task is run once per day in a live sandbox, so a single failed session
              moves a model&rsquo;s daily figure by a ninth of its range. A change-point detector fed
              that series would fire constantly or, tuned quiet enough not to, would be deaf. The
              honest fix is more sessions per task per day, which is a cost decision, not a code one;
              until then those two suites are drift-monitored on a 28-day baseline, and their daily
              movement should be read as noise unless it persists.
              <br/><br/>
              A drift detector is only worth trusting if two numbers are known: how often it
              fires when nothing changed, and how reliably it fires when something did. Both are
              measured against the exact production code path by injecting a sustained drop of
              known size into a stationary series (400 repetitions per cell) and by running the
              detector on a series with no change at all. &ldquo;Detected&rdquo; means it fired
              within 30 days; the delay is the median number of days to the first alert.
            </div>
            <div style={styles.codeBlock}>
              <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', marginBottom: '6px' }}>
                sustained drop of&hellip; &rarr; detected (median delay), by day-to-day noise of the score
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(5, 1fr)', gap: '4px 12px', alignItems: 'center', fontSize: '10px' }}>
                {[
                  ['noise', '3 pts', '5 pts', '8 pts', '10 pts', 'false alarms'],
                  ['sd 1.5', '91% (18d)', '100% (8d)', '100% (4d)', '100% (3d)', '0 in 44,000 days'],
                  ['sd 3',   '88% (15d)', '100% (7d)', '100% (4d)', '100% (3d)', '1 per ~4,400 days'],
                  ['sd 5',   '84% (11d)', '98% (5d)',  '99% (3d)',  '99% (2d)',  '1 per ~180 days'],
                ].map((row, i) => row.map((cell, j) => (
                  <span key={`${i}-${j}`} style={{
                    color: i === 0 ? 'var(--phosphor-dim)' : j === 0 ? 'var(--phosphor-green)' : 'var(--phosphor-dim)',
                    fontWeight: i === 0 || j === 0 ? 'bold' : 'normal',
                  }}>{cell}</span>
                )))}
              </div>
            </div>
            <div style={{ ...styles.text, marginTop: '10px' }}>
              <strong style={{ color: 'var(--phosphor-dim)' }}>How to read it.</strong> Twenty of the
              24 ranked models sit at a day-to-day noise of 1.5&ndash;3 points on the current
              score; the noisiest few sit near 5. So for most of the fleet a 5-point sustained
              regression is caught essentially every time within about a week, a 3-point one
              nine times in ten within about two weeks, and a spurious alert on an unchanged
              model happens somewhere between never and once every twelve years. On the
              noisiest models the price of that sensitivity is one false alert per roughly six
              months.
              <br/><br/>
              <strong style={{ color: 'var(--phosphor-dim)' }}>What it will miss.</strong> A
              sustained drop of about 2 points or less. A one-day dip of any size, by design
              &mdash; the detector runs on daily medians and asks about sustained change, so a
              single bad day cannot fire it and neither can a single bad run.
              <br/><br/>
              <strong style={{ color: 'var(--phosphor-dim)' }}>Why the tolerance moved from 0.02 to
              0.01.</strong> It was set as a quarter of the day-to-day noise when that noise was
              8.4 points on an earlier, steeper score curve. The score is now a plain weighted
              mean with a fraction of that noise, and a 2-point tolerance had become most of it
              &mdash; a 3-point sustained regression was being caught only one time in five.
              Halving it made that nine in ten at no measurable cost on the quiet majority.
              <br/><br/>
              <strong style={{ color: 'var(--phosphor-dim)' }}>Checked against real history
              too.</strong> Each model&rsquo;s actual daily history under one benchmark version,
              block-resampled to destroy any genuine change points while keeping its own noise,
              gives a fleet false-alarm rate of about one per model every 86 days &mdash; but that
              history predates the current score curve and is dominated by two models that were
              far noisier under it, so it bounds the worst case rather than describing today.
              <br/><br/>
              Reproduce it: <span style={{ fontFamily: 'var(--font-mono)' }}>node dist/jobs/validate-drift-detector.js</span> in
              the API repository. Deterministic seed; the table above is its output.
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelTitle}>WHY A FULL RESET AFTER AN ALERT</div>
            <div style={styles.text}>
              A partial reset that kept the old mean would keep firing on every subsequent
              observation until the running mean caught up to the new level, producing a
              sawtooth of duplicate alerts. Resetting completely lets the detector re-learn
              the post-change level and stay quiet until the <em>next</em> real change.
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelTitle}>ALERT SEVERITY LEVELS</div>
            <div style={styles.text}>
              <span style={{ color: 'var(--phosphor-green)', fontWeight: 'bold' }}>NORMAL</span> — Performance within expected variance<br/>
              <span style={{ color: 'var(--amber-warning)', fontWeight: 'bold' }}>WARNING</span> — Slight decline, monitoring closely<br/>
              <span style={{ color: '#ff8c00', fontWeight: 'bold' }}>DEGRADATION</span> — Sustained decline confirmed<br/>
              <span style={{ color: 'var(--red-alert, #d93025)', fontWeight: 'bold' }}>CRITICAL</span> — Major drop, immediate attention needed
            </div>
          </div>

          <hr style={styles.divider} />

          {/* Section 5: Enhanced Testing */}
          <h2 id="enhancements" style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[5]</span> ENHANCED TESTING
          </h2>
          <div style={styles.warningPanel}>
            <span style={{ fontSize: '11px', color: 'var(--amber-warning)' }}>
              <strong>These statuses are read from the database, not written by hand.</strong>{' '}
              Each suite below reports its own row count, refreshed hourly. If a suite says zero,
              it has produced nothing &mdash; we would rather this page contradict us than flatter
              us. None of this data feeds a leaderboard score; all three write to their own tables.
            </span>
          </div>
          <div style={{ ...styles.text, margin: '14px 0' }}>
            Run as separate sweeps so the scored trial series stays a clean capability
            measurement:
          </div>

          <div style={styles.grid2}>
            <div style={styles.suiteCard('rgba(255,45,0,0.25)', 'rgba(255,45,0,0.06)')}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--red-alert, #d93025)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                ADVERSARIAL SAFETY
              </div>
              <div style={styles.text}>
                18 probes across 5 attack types: jailbreak,<br/>
                injection, extraction, manipulation, harmful content.<br/>
                One probe per model per 4-hour run, rotating.<br/>
                <SuiteStatus stat={status?.adversarial} />
              </div>
            </div>

            <div style={styles.suiteCard('rgba(0,150,255,0.25)', 'rgba(0,100,200,0.06)')}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                PROMPT ROBUSTNESS
              </div>
              <div style={styles.text}>
                11 variations: paraphrase, restructure, style change.<br/>
                Nightly sweep: the same task reworded, scored by the same<br/>
                runner, so a variant score is comparable to a real one.<br/>
                <SuiteStatus stat={status?.robustness} />
              </div>
            </div>

            <div style={styles.suiteCard('rgba(200,0,255,0.25)', 'rgba(150,0,200,0.06)')}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--amber-warning)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                BIAS DETECTION
              </div>
              <div style={styles.text}>
                19 variants across gender, ethnicity and age, plus a<br/>
                neutral baseline. Nightly sweep takes one variant from<br/>
                each category so the comparison is across categories.<br/>
                <SuiteStatus stat={status?.bias} />
              </div>
            </div>

            <div style={styles.suiteCard('rgba(0,255,200,0.25)', 'rgba(0,200,150,0.06)')}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                VERSION TRACKING
              </div>
              <div style={styles.text}>
                Benchmark-definition versioning is live: every score records the<br/>
                exact config it ran under, so a methodology change cannot be<br/>
                mistaken for a model change. Provider-side version extraction<br/>
                <span style={{ color: 'var(--amber-warning)' }}>is not yet implemented</span>
              </div>
            </div>
          </div>

          <hr style={styles.divider} />

          {/* Section 6: Validation */}
          <h2 id="validation" style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[6]</span> VALIDATION AND TRANSPARENCY
          </h2>

          <div style={styles.grid4}>
            {[
              { title: 'PUBLISHED METHOD', desc: 'Every scoring weight, threshold and statistical method is documented on this page.' },
              { title: 'INDEPENDENT', desc: 'Zero vendor funding. No affiliate revenue. 100% unbiased.' },
              { title: 'VERIFIABLE', desc: '"Test Your Keys" feature. Reproduce our results. Compare independently.' },
              { title: 'HELD-OUT TASKS', desc: 'The task bank stays private. When it was public, providers optimised against the specific tests — which destroys the measurement.' },
            ].map((item, i) => (
              <div key={i} style={{ ...styles.panel, background: 'rgba(26, 115, 232,0.04)', borderColor: 'rgba(26, 115, 232,0.2)' }}>
                <div style={styles.panelTitle}>{item.title}</div>
                <div style={styles.text}>{item.desc}</div>
              </div>
            ))}
          </div>

          <div style={{
            ...styles.panel,
            textAlign: 'center',
            background: 'rgba(26, 115, 232,0.04)',
            border: '2px solid rgba(26, 115, 232,0.3)',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '8px', letterSpacing: '0.5px' }}>
              TEST YOUR KEYS
            </div>
            <div style={{ ...styles.text, marginBottom: '12px' }}>
              Run benchmarks with your own API keys to verify we're not making up numbers
            </div>
            <Link href="/router/test-keys" style={{
              display: 'inline-block',
              padding: '10px 22px',
              background: 'var(--phosphor-green)',
              color: 'var(--terminal-black)',
              fontWeight: 'bold',
              fontSize: '11px',
              textDecoration: 'none',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
            }}>
              TEST NOW &rarr;
            </Link>
          </div>

          <hr style={styles.divider} />

          {/* Current Models */}
          <h2 style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> CURRENT MODELS TESTED
            {status?.rankedModels?.length ? ` (${status.rankedModels.length} ACTIVE)` : ''}
          </h2>
          <div style={{ ...styles.panel, marginBottom: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px', fontSize: '10px' }}>
              {/* Read from the models table, not typed by hand. The previous list named
                  claude-3-7-sonnet, gpt-5.1, grok-4 and gemini-2.5 — none of which have been
                  tested for months — under a heading claiming 21 active models. A list of what
                  we test has to come from the table that decides what we test. */}
              {(status?.rankedModels ?? []).map((m) => (
                <div key={m.name} style={{ color: 'var(--phosphor-green)' }}>{m.name}</div>
              ))}
              {!status?.rankedModels?.length && (
                <div style={{ color: 'var(--amber-warning)' }}>
                  Roster unavailable &mdash; the API did not answer when this page was generated
                </div>
              )}
            </div>
            <div style={{ ...styles.text, marginTop: '12px', padding: '8px 10px', background: 'rgba(26, 115, 232,0.04)', borderRadius: '2px' }}>
              Scores update <strong style={{ color: 'var(--amber-warning)' }}>every 4 hours</strong>. Rankings shift based on continuous performance monitoring.
            </div>
          </div>

          <hr style={styles.divider} />

          {/* Why This Matters */}
          <h2 style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> WHY THIS METHODOLOGY MATTERS
          </h2>
          <div style={styles.grid2}>
            <div style={styles.panel}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--red-alert, #d93025)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                TRADITIONAL BENCHMARKS:
              </div>
              <div style={styles.text}>
                &rarr; Single measurements (unreliable)<br/>
                &rarr; No confidence intervals<br/>
                &rarr; Point-in-time snapshots<br/>
                &rarr; Often vendor-sponsored<br/>
                &rarr; Run once, then quoted for years<br/>
                &rarr; Opaque methodology
              </div>
            </div>
            <div style={styles.panel}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                OUR APPROACH:
              </div>
              <div style={styles.text}>
                &rarr; 7 trials per task (statistical power)<br/>
                &rarr; 95% confidence intervals<br/>
                &rarr; Continuous since August 2025<br/>
                &rarr; 100% independent funding<br/>
                {status?.corpus ? (
                  <>
                    &rarr; {status.corpus.runs.toLocaleString()} scored runs<br/>
                    &rarr; {status.corpus.toolSessions.toLocaleString()} tool-calling sessions<br/>
                  </>
                ) : null}
                &rarr; Published methodology, live row counts
              </div>
            </div>
          </div>

          <div style={styles.highlightPanel}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--phosphor-green)' }}>
              Result: measurements you can check, with the counts behind them shown above.
            </span>
          </div>

          <hr style={styles.divider} />

          {/* API Access */}
          <h2 style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> PUBLIC API ACCESS
          </h2>

          <div style={{ ...styles.panel, background: 'rgba(26, 115, 232,0.06)' }}>
            <div style={styles.panelTitle}>A FREE KEY IS REQUIRED</div>
            <div style={styles.text}>
              The data API lives at <code style={{ color: 'var(--phosphor-green)' }}>/api/v1</code> and
              authenticates with a bearer token. Creating a key takes about thirty seconds and costs
              nothing &mdash;{' '}
              <Link href="/account/data-keys" style={styles.link}>create one here</Link>, or read the{' '}
              <Link href="/api-docs" style={styles.link}>full API reference</Link>.
            </div>
          </div>

          {[
            { endpoint: 'GET /api/v1/models', desc: 'Current rankings with confidence intervals', rate: '1 request/minute free · 60 on Pro' },
            { endpoint: 'GET /api/v1/models/:id/history?period=7d', desc: 'Historical time-series data (7 days)', rate: '1 request/minute free · 60 on Pro' },
            { endpoint: 'GET /api/v1/models/:id', desc: 'Detailed model breakdown by task', rate: '1 request/minute free · 60 on Pro' },
            { endpoint: 'GET /api/v1/analytics/degradations', desc: 'Models currently degrading, with magnitude', rate: '1 request/minute free · 60 on Pro' },
          ].map((api, i) => (
            <div key={i} style={{ ...styles.panel, background: 'rgba(26, 115, 232,0.03)' }}>
              <code style={{ fontSize: '11px', color: 'var(--phosphor-green)', fontWeight: 'bold' }}>{api.endpoint}</code>
              <div style={{ ...styles.text, marginTop: '4px' }}>
                {api.desc}<br/>
                <span style={{ color: 'var(--amber-warning)' }}>Rate Limit: {api.rate}</span>
              </div>
            </div>
          ))}

          <div style={{ ...styles.panel, background: 'rgba(0,100,200,0.06)', borderColor: 'rgba(0,150,255,0.2)' }}>
            <div style={styles.panelTitle}>RATE LIMITING AND PROTECTION</div>
            <div style={styles.text}>
              All public APIs protected with automatic rate limiting:<br/>
              &rarr; Per-key quotas: 10 requests/day free, 10,000 on Pro<br/>
              &rarr; X-RateLimit-Limit / -Remaining / -Reset on every response<br/>
              &rarr; Returns 429 status code when exceeded<br/>
              &rarr; Daily quota resets at 00:00 UTC<br/>
              &rarr; Higher tiers available for larger workloads
            </div>
          </div>

          <div style={styles.warningPanel}>
            <span style={{ fontSize: '11px', color: 'var(--amber-warning)' }}>
              <strong>Enterprise API:</strong> Volume beyond Pro and commercial redistribution are
              arranged directly rather than bought &rarr;{' '}
              <Link href="/api-docs#enterprise" style={styles.link}>Get in touch</Link>
              {' '}&middot;{' '}
              <a href="https://studioplatforms.eu/products/aistupidlevel/data-licensing" target="_blank" rel="noopener noreferrer" style={styles.link}>
                Licensing
              </a>
            </span>
          </div>

          <hr style={styles.divider} />

          {/* vs Other Benchmarks */}
          <h2 style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> VS. OTHER BENCHMARKS
          </h2>
          <div style={styles.grid4}>
            {[
              { name: 'vs. HumanEval', them: 'Single-shot, pass/fail', us: '7 trials, nuanced scoring, CI' },
              { name: 'vs. MMLU', them: 'Multiple choice', us: 'Real code execution' },
              { name: 'vs. Chatbot Arena', them: 'Human voting', us: 'Objective execution' },
              { name: 'vs. Vendor Benchmarks', them: 'Marketing-optimized', us: 'Independent, unbiased' },
            ].map((item, i) => (
              <div key={i} style={{ ...styles.panel, background: 'rgba(0,100,200,0.06)', borderColor: 'rgba(0,150,255,0.2)' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--amber-warning)', marginBottom: '6px' }}>{item.name}</div>
                <div style={styles.text}>
                  <strong>Them:</strong> {item.them}<br/>
                  <strong style={{ color: 'var(--phosphor-green)' }}>Us:</strong> {item.us}
                </div>
              </div>
            ))}
          </div>

          <hr style={styles.divider} />

          {/* Footer CTA */}
          <div style={{
            ...styles.panel,
            textAlign: 'center',
            background: 'rgba(26, 115, 232,0.04)',
            border: '2px solid rgba(26, 115, 232,0.3)',
            padding: '20px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--phosphor-green)', letterSpacing: '1.5px', marginBottom: '10px', textShadow: '0 0 6px rgba(26, 115, 232,0.4)' }}>
              EXPLORE THE RANKINGS
            </div>
            <div style={{ ...styles.text, marginBottom: '16px' }}>
              See how the models actually perform, across {status?.corpus ? status.corpus.runs.toLocaleString() : '176,000+'} scored benchmark runs<br/>
              Updated every 4 hours with statistical confidence intervals
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/" style={{
                display: 'inline-block',
                padding: '10px 22px',
                background: 'var(--phosphor-green)',
                color: 'var(--terminal-black)',
                fontWeight: 'bold',
                fontSize: '11px',
                textDecoration: 'none',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
              }}>
                VIEW RANKINGS &rarr;
              </Link>
              <Link href="/about" style={{
                display: 'inline-block',
                padding: '10px 22px',
                border: '1px solid rgba(26, 115, 232,0.3)',
                color: 'var(--phosphor-green)',
                fontWeight: 'bold',
                fontSize: '11px',
                textDecoration: 'none',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
              }}>
                ABOUT US
              </Link>
              <Link href="/faq" style={{
                display: 'inline-block',
                padding: '10px 22px',
                border: '1px solid rgba(26, 115, 232,0.3)',
                color: 'var(--phosphor-green)',
                fontWeight: 'bold',
                fontSize: '11px',
                textDecoration: 'none',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
              }}>
                FAQ
              </Link>
            </div>
          </div>

          {/* Footer */}
          <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', textAlign: 'center', marginTop: '32px', paddingTop: '16px', borderTop: '1px solid rgba(192,192,192,0.12)' }}>
            AI Stupid Level &bull; Independent benchmarking since 2025 &bull; <Link href="/" style={styles.link}>View Rankings</Link>
          </div>
        </div>

        {/* HowTo Structured Data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "HowTo",
              "name": "How AI Stupid Level Tests AI Models",
              "description": "Complete methodology for benchmarking AI models with statistical rigor",
              "step": [
                {
                  "@type": "HowToStep",
                  "name": "Execute Benchmark Tasks",
                  "text": "Run 7 trials of each coding task with different random seeds"
                },
                {
                  "@type": "HowToStep",
                  "name": "Score on 9 Axes",
                  "text": "Evaluate each trial across 9 dimensions: correctness, complexity, quality, etc."
                },
                {
                  "@type": "HowToStep",
                  "name": "Calculate Statistics",
                  "text": "Compute mean, standard deviation, and 95% confidence intervals using t-distribution"
                },
                {
                  "@type": "HowToStep",
                  "name": "Detect Drift",
                  "text": "Apply the Page-Hinkley test to identify sustained performance changes"
                }
              ]
            })
          }}
        />
      </div>
    </SubpageLayout>
  );
}
