import type { Metadata } from 'next';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';

export const metadata: Metadata = {
  title: 'AI Benchmarking Methodology | How We Test AI Models',
  description: 'Comprehensive technical documentation of our 9-axis AI benchmarking methodology using CUSUM drift detection, statistical confidence intervals, and execution-based testing. Learn how we measure AI performance objectively.',
  keywords: [
    'AI benchmarking methodology',
    'How to test AI models',
    'AI performance testing framework',
    'LLM evaluation metrics',
    'AI drift detection algorithm',
    'AI benchmark scoring system',
    'Statistical AI testing',
    'CUSUM algorithm AI',
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
interface EnhancedStatus {
  adversarial: SuiteStat;
  robustness: SuiteStat;
  bias: SuiteStat;
  scoredPromptVariation: boolean;
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
              <div style={{ ...styles.panelTitle, marginBottom: '10px' }}>HOURLY SUITE</div>
              <div style={styles.text}>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Frequency</strong>: Every 4 hours<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Tasks</strong>: 10 Python challenges<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Trials</strong>: 5 per task<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Scoring</strong>: 9-axis evaluation<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Purpose</strong>: Fast performance tracking
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
                <strong style={{ color: 'var(--phosphor-dim)' }}>Tasks</strong>: 10, in real Docker sandboxes<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Scoring</strong>: 7-axis evaluation<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Purpose</strong>: Agent capability tests
              </div>
            </div>

            <div style={styles.suiteCard('rgba(255,0,150,0.3)', 'rgba(200,0,100,0.08)')}>
              <div style={{ ...styles.panelTitle, marginBottom: '10px' }}>CANARY SUITE</div>
              <div style={styles.text}>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Frequency</strong>: Every hour<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Tasks</strong>: 2 fast tests, 1 trial<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Purpose</strong>: Rapid drift detection<br/>
                <strong style={{ color: 'var(--phosphor-dim)' }}>Response Time</strong>: &lt;5 minutes
              </div>
            </div>
          </div>

          <div style={styles.highlightPanel}>
            <div style={{ ...styles.panelTitle, marginBottom: '6px' }}>OUTPUT TO DATE</div>
            <div style={styles.text}>
              Measured, not projected &mdash; counted from our database since the first
              benchmark on 8 August 2025:<br/>
              &rarr; 173,000+ scored benchmark runs<br/>
              &rarr; 60,000+ tool-calling sessions<br/>
              &rarr; 4,200+ deep-reasoning sessions<br/>
              &rarr; 900+ drift incidents and change points recorded
            </div>
          </div>

          <hr style={styles.divider} />

          {/* Section 2: Scoring System */}
          <h2 id="scoring" style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[2]</span> 9-AXIS SCORING METHODOLOGY
          </h2>
          <div style={{ ...styles.text, marginBottom: '14px' }}>
            Each task is evaluated across 9 dimensions. Weights optimized for production relevance:
          </div>

          <div style={styles.codeBlock}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto 1fr', gap: '6px 14px', alignItems: 'center' }}>
              {[
                ['CORRECTNESS', '40%', 'Does code work? All tests pass?'],
                ['COMPLEXITY', '20%', 'Handles algorithm complexity?'],
                ['CODE QUALITY', '15%', 'Clean, maintainable code?'],
                ['STABILITY', '10%', 'Edge cases, no crashes?'],
                ['EFFICIENCY', '5%', 'Optimal complexity?'],
                ['EDGE CASES', '3%', 'Null, empty, boundaries?'],
                ['DEBUGGING', '3%', 'Can fix broken code?'],
                ['FORMAT', '2%', 'Clean output, follows spec?'],
                ['SAFETY', '2%', 'No dangerous operations?'],
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

          <hr style={styles.divider} />

          {/* Section 3: Statistical Analysis */}
          <h2 id="statistical" style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[3]</span> STATISTICAL RIGOR (95% CONFIDENCE INTERVALS)
          </h2>
          <div style={{ ...styles.text, marginBottom: '14px' }}>
            Unlike benchmarks showing single measurements, we provide confidence intervals to quantify uncertainty.
          </div>

          <div style={{ ...styles.panel, background: 'rgba(0,100,200,0.06)', borderColor: 'rgba(0,150,255,0.2)' }}>
            <div style={styles.panelTitle}>WHY 5 TRIALS?</div>
            <div style={styles.text}>
              &rarr; AI models are <strong style={{ color: 'var(--amber-warning)' }}>stochastic</strong> (same prompt, different outputs)<br/>
              &rarr; Single measurements are unreliable<br/>
              &rarr; 5 trials = optimal balance of cost vs statistical power<br/>
              &rarr; Provides 95% confidence intervals using t-distribution
            </div>
          </div>

          <div style={styles.codeBlock}>
            <div style={{ color: 'var(--phosphor-green)', fontWeight: 'bold', marginBottom: '8px', fontSize: '10px' }}>EXAMPLE CALCULATION:</div>
            <div style={{ color: 'var(--phosphor-dim)', fontSize: '10px', lineHeight: '1.8' }}>
              claude-opus-4-5-20251101 on binary_search:<br/>
              Trial 1: 92 | Trial 2: 94 | Trial 3: 90 | Trial 4: 93 | Trial 5: 91<br/>
              <br/>
              Mean = 92.0<br/>
              Std Dev = 1.58<br/>
              Std Error = 1.58 / sqrt(5) = 0.71<br/>
              t-value = 2.776 (df=4, 95% CI)<br/>
              Margin = 2.776 x 0.71 = 1.97<br/>
              <br/>
              <strong style={{ color: 'var(--amber-warning)' }}>
                Final: 92.0 +/- 2.0<br/>
                95% CI: [90.0, 94.0]
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
                &rarr; Tolerance (delta): 0.02<br/>
                &rarr; Threshold (lambda): 0.30<br/>
                &rarr; Cold start: 10 observations before it may fire<br/>
                &rarr; Rolling baseline for alerting: 28 days
              </span>
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
              { title: 'OPEN SOURCE', desc: 'Full code on GitHub. Fully auditable methodology. Run locally to verify.' },
              { title: 'INDEPENDENT', desc: 'Zero vendor funding. No affiliate revenue. 100% unbiased.' },
              { title: 'VERIFIABLE', desc: '"Test Your Keys" feature. Reproduce our results. Compare independently.' },
              { title: 'PUBLICLY AUDITABLE', desc: 'Scoring weights, tasks and drift constants all live in the public repo. Disagree with a weight? You can see it, and open an issue.' },
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
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> CURRENT MODELS TESTED (21 ACTIVE)
          </h2>
          <div style={{ ...styles.panel, marginBottom: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px', fontSize: '10px' }}>
              {[
                'claude-3-7-sonnet-20250219',
                'claude-sonnet-4-5-20250929',
                'claude-opus-4-5-20251101',
                'gpt-5.2',
                'gpt-5.1',
                'gpt-5.1-codex',
                'deepseek-chat',
                'deepseek-reasoner',
                'gemini-2.5-flash',
                'gemini-3-pro-preview',
                'grok-4-0709',
                'grok-4-latest',
                'kimi-latest',
                'kimi-k2-turbo-preview',
                'glm-4.6',
              ].map((model, i) => (
                <div key={i} style={{ color: 'var(--phosphor-green)' }}>{model}</div>
              ))}
              <div style={{ color: 'var(--phosphor-dim)' }}>...and 6 more</div>
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
                &rarr; Vendor-sponsored (biased)<br/>
                &rarr; No safety testing<br/>
                &rarr; No bias evaluation<br/>
                &rarr; Opaque methodology
              </div>
            </div>
            <div style={styles.panel}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                OUR APPROACH:
              </div>
              <div style={styles.text}>
                &rarr; 5 trials per task (statistical power)<br/>
                &rarr; 95% confidence intervals<br/>
                &rarr; 2+ years continuous monitoring<br/>
                &rarr; 100% independent funding<br/>
                &rarr; 120K+ safety tests/year<br/>
                &rarr; 60K+ bias tests/year<br/>
                &rarr; Fully open source
              </div>
            </div>
          </div>

          <div style={styles.highlightPanel}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--phosphor-green)' }}>
              Result: Data you can bet your business on.
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
              <Link href="/router/data-keys" style={styles.link}>create one here</Link>, or read the{' '}
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
              { name: 'vs. HumanEval', them: 'Single-shot, pass/fail', us: '5 trials, nuanced scoring, CI' },
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
              See how the models actually perform, across 173,000+ scored benchmark runs<br/>
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
                  "text": "Run 5 trials of each coding task with different random seeds"
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
                  "text": "Apply CUSUM algorithm to identify sustained performance changes"
                }
              ]
            })
          }}
        />
      </div>
    </SubpageLayout>
  );
}
