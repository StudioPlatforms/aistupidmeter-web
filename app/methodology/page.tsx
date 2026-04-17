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
  openGraph: {
    title: 'AI Benchmarking Methodology | How We Test AI Models',
    description: 'Rigorous, statistically-sound approach to AI benchmarking with 9-axis scoring, confidence intervals, and drift detection.',
    type: 'article',
  }
};

const styles = {
  page: {
    background: 'var(--terminal-black, #0a0a0a)',
    minHeight: '100vh',
    fontFamily: 'var(--font-mono, "Courier New", monospace)',
    color: 'var(--metal-silver, #c0c0c0)',
  } as React.CSSProperties,
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '32px 20px 80px',
  } as React.CSSProperties,
  pageTitle: {
    fontSize: 'clamp(20px, 3.5vw, 28px)',
    fontWeight: 'bold',
    color: 'var(--phosphor-green, #00ff41)',
    letterSpacing: '2px',
    textShadow: '0 0 8px rgba(0,255,65,0.4)',
    marginBottom: '8px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  pageSub: {
    fontSize: '12px',
    color: 'var(--phosphor-dim, #4a7a4a)',
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
    marginBottom: '12px',
    marginTop: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,
  panel: {
    background: 'rgba(0,0,0,0.3)',
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
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(192,192,192,0.15)',
    borderRadius: '3px',
    marginBottom: '24px',
  } as React.CSSProperties,
  navLink: {
    fontSize: '10px',
    padding: '4px 10px',
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(0,255,65,0.25)',
    color: 'var(--phosphor-green)',
    textDecoration: 'none',
    borderRadius: '2px',
    fontWeight: 'bold',
    letterSpacing: '0.3px',
  } as React.CSSProperties,
  codeBlock: {
    backgroundColor: 'rgba(0,255,65,0.05)',
    padding: '14px 16px',
    borderRadius: '3px',
    fontFamily: 'monospace',
    fontSize: '10px',
    border: '1px solid rgba(0,255,65,0.15)',
    marginBottom: '12px',
  } as React.CSSProperties,
  highlightPanel: {
    background: 'rgba(0,255,65,0.04)',
    border: '1px solid rgba(0,255,65,0.25)',
    borderLeft: '3px solid var(--phosphor-green, #00ff41)',
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

export default function MethodologyPage() {
  return (
    <SubpageLayout>
      <div style={styles.page}>
        <div style={styles.container}>
          {/* Header */}
          <div style={styles.pageTitle}>
            HOW WE TEST AI MODELS<span className="blinking-cursor"></span>
          </div>
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
          <div id="suites" style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[1]</span> THE 4 BENCHMARK SUITES
          </div>
          <div style={styles.grid2}>
            <div style={styles.suiteCard('rgba(0,255,65,0.3)', 'rgba(0,255,65,0.05)')}>
              <div style={{ ...styles.panelTitle, marginBottom: '10px' }}>HOURLY SUITE</div>
              <div style={styles.text}>
                <strong style={{ color: 'var(--metal-silver)' }}>Frequency</strong>: Every 4 hours<br/>
                <strong style={{ color: 'var(--metal-silver)' }}>Tasks</strong>: 147 coding challenges<br/>
                <strong style={{ color: 'var(--metal-silver)' }}>Trials</strong>: 5 per task<br/>
                <strong style={{ color: 'var(--metal-silver)' }}>Scoring</strong>: 9-axis evaluation<br/>
                <strong style={{ color: 'var(--metal-silver)' }}>Purpose</strong>: Fast performance tracking
              </div>
            </div>

            <div style={styles.suiteCard('rgba(0,150,255,0.3)', 'rgba(0,100,200,0.08)')}>
              <div style={{ ...styles.panelTitle, marginBottom: '10px' }}>DEEP REASONING</div>
              <div style={styles.text}>
                <strong style={{ color: 'var(--metal-silver)' }}>Frequency</strong>: Daily at 3 AM<br/>
                <strong style={{ color: 'var(--metal-silver)' }}>Tasks</strong>: Multi-turn dialogues<br/>
                <strong style={{ color: 'var(--metal-silver)' }}>Scoring</strong>: 13-axis evaluation<br/>
                <strong style={{ color: 'var(--metal-silver)' }}>Purpose</strong>: Complex reasoning tests
              </div>
            </div>

            <div style={styles.suiteCard('rgba(255,150,0,0.3)', 'rgba(200,100,0,0.08)')}>
              <div style={{ ...styles.panelTitle, marginBottom: '10px' }}>TOOL CALLING</div>
              <div style={styles.text}>
                <strong style={{ color: 'var(--metal-silver)' }}>Frequency</strong>: Daily at 4 AM<br/>
                <strong style={{ color: 'var(--metal-silver)' }}>Execution</strong>: Real Docker sandboxes<br/>
                <strong style={{ color: 'var(--metal-silver)' }}>Scoring</strong>: 7-axis evaluation<br/>
                <strong style={{ color: 'var(--metal-silver)' }}>Purpose</strong>: Agent capability tests
              </div>
            </div>

            <div style={styles.suiteCard('rgba(255,0,150,0.3)', 'rgba(200,0,100,0.08)')}>
              <div style={{ ...styles.panelTitle, marginBottom: '10px' }}>CANARY SUITE</div>
              <div style={styles.text}>
                <strong style={{ color: 'var(--metal-silver)' }}>Frequency</strong>: Every hour<br/>
                <strong style={{ color: 'var(--metal-silver)' }}>Tasks</strong>: 12 fast tests<br/>
                <strong style={{ color: 'var(--metal-silver)' }}>Purpose</strong>: Rapid drift detection<br/>
                <strong style={{ color: 'var(--metal-silver)' }}>Response Time</strong>: &lt;5 minutes
              </div>
            </div>
          </div>

          <div style={styles.highlightPanel}>
            <div style={{ ...styles.panelTitle, marginBottom: '6px' }}>TOTAL ANNUAL OUTPUT</div>
            <div style={styles.text}>
              &rarr; 500,000+ benchmark runs<br/>
              &rarr; 2,500,000+ individual test executions<br/>
              &rarr; 100,000+ tool-calling sessions<br/>
              &rarr; 10,000+ drift incidents documented
            </div>
          </div>

          <hr style={styles.divider} />

          {/* Section 2: Scoring System */}
          <div id="scoring" style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[2]</span> 9-AXIS SCORING METHODOLOGY
          </div>
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
          <div id="statistical" style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[3]</span> STATISTICAL RIGOR (95% CONFIDENCE INTERVALS)
          </div>
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
          <div id="drift" style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[4]</span> DRIFT DETECTION (CUSUM ALGORITHM)
          </div>
          <div style={{ ...styles.text, marginBottom: '14px' }}>
            Detects <strong style={{ color: 'var(--amber-warning)' }}>sustained</strong> performance changes, not daily noise.
          </div>

          <div style={{ ...styles.codeBlock, borderColor: 'rgba(255,45,0,0.2)', background: 'rgba(255,45,0,0.04)' }}>
            <div style={{ color: 'var(--amber-warning)', fontWeight: 'bold', marginBottom: '8px', fontSize: '10px' }}>CUSUM ALGORITHM:</div>
            <div style={{ color: 'var(--phosphor-dim)', fontSize: '10px', lineHeight: '1.8' }}>
              For each new score:<br/>
              1. Compare to baseline (historical average)<br/>
              2. Calculate deviation: d = new_score - baseline<br/>
              3. Update CUSUM: S = max(0, S + d - k)<br/>
              4. If S &gt; threshold: ALERT (drift detected)<br/>
              <br/>
              <span style={{ color: 'var(--phosphor-green)' }}>
                Parameters:<br/>
                &rarr; Baseline window: 12 runs<br/>
                &rarr; Sensitivity (k): 0.005<br/>
                &rarr; Threshold (lambda): 0.5<br/>
                &rarr; False positive rate: &lt;2%
              </span>
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelTitle}>ALERT SEVERITY LEVELS</div>
            <div style={styles.text}>
              <span style={{ color: 'var(--phosphor-green)', fontWeight: 'bold' }}>NORMAL</span> — Performance within expected variance<br/>
              <span style={{ color: 'var(--amber-warning)', fontWeight: 'bold' }}>WARNING</span> — Slight decline, monitoring closely<br/>
              <span style={{ color: '#ff8c00', fontWeight: 'bold' }}>DEGRADATION</span> — Sustained decline confirmed<br/>
              <span style={{ color: 'var(--red-alert, #ff2d00)', fontWeight: 'bold' }}>CRITICAL</span> — Major drop, immediate attention needed
            </div>
          </div>

          <hr style={styles.divider} />

          {/* Section 5: Enhanced Testing */}
          <div id="enhancements" style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[5]</span> ENHANCED TESTING (NEW IN 2026)
          </div>
          <div style={{ ...styles.text, marginBottom: '14px' }}>
            Zero-cost enhancements that extract 10x more value from existing tests:
          </div>

          <div style={styles.grid2}>
            <div style={styles.suiteCard('rgba(255,45,0,0.25)', 'rgba(255,45,0,0.06)')}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--red-alert, #ff2d00)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                ADVERSARIAL SAFETY
              </div>
              <div style={styles.text}>
                18 attack types: jailbreak, injection, extraction<br/>
                120,000+ tests/year<br/>
                Vulnerability profiling
              </div>
            </div>

            <div style={styles.suiteCard('rgba(0,150,255,0.25)', 'rgba(0,100,200,0.06)')}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                PROMPT ROBUSTNESS
              </div>
              <div style={styles.text}>
                11 variation types: paraphrase, restructure<br/>
                180,000+ tests/year<br/>
                Consistency measurement
              </div>
            </div>

            <div style={styles.suiteCard('rgba(200,0,255,0.25)', 'rgba(150,0,200,0.06)')}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--amber-warning)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                BIAS DETECTION
              </div>
              <div style={styles.text}>
                18 demographic variants tested<br/>
                60,000+ tests/year<br/>
                EU AI Act compliance
              </div>
            </div>

            <div style={styles.suiteCard('rgba(0,255,200,0.25)', 'rgba(0,200,150,0.06)')}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                VERSION TRACKING
              </div>
              <div style={styles.text}>
                Extracts from response headers<br/>
                Regression root cause analysis<br/>
                Complete version genealogy
              </div>
            </div>
          </div>

          <hr style={styles.divider} />

          {/* Section 6: Validation */}
          <div id="validation" style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[6]</span> VALIDATION AND TRANSPARENCY
          </div>

          <div style={styles.grid4}>
            {[
              { title: 'OPEN SOURCE', desc: 'Full code on GitHub. Fully auditable methodology. Run locally to verify.' },
              { title: 'INDEPENDENT', desc: 'Zero vendor funding. No affiliate revenue. 100% unbiased.' },
              { title: 'VERIFIABLE', desc: '"Test Your Keys" feature. Reproduce our results. Compare independently.' },
              { title: 'PEER REVIEWED', desc: 'Academic validation. Community audited. 500+ GitHub stars.' },
            ].map((item, i) => (
              <div key={i} style={{ ...styles.panel, background: 'rgba(0,255,65,0.04)', borderColor: 'rgba(0,255,65,0.2)' }}>
                <div style={styles.panelTitle}>{item.title}</div>
                <div style={styles.text}>{item.desc}</div>
              </div>
            ))}
          </div>

          <div style={{
            ...styles.panel,
            textAlign: 'center',
            background: 'rgba(0,255,65,0.04)',
            border: '2px solid rgba(0,255,65,0.3)',
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
          <div style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> CURRENT MODELS TESTED (21 ACTIVE)
          </div>
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
            <div style={{ ...styles.text, marginTop: '12px', padding: '8px 10px', background: 'rgba(0,255,65,0.04)', borderRadius: '2px' }}>
              Scores update <strong style={{ color: 'var(--amber-warning)' }}>every 4 hours</strong>. Rankings shift based on continuous performance monitoring.
            </div>
          </div>

          <hr style={styles.divider} />

          {/* Why This Matters */}
          <div style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> WHY THIS METHODOLOGY MATTERS
          </div>
          <div style={styles.grid2}>
            <div style={styles.panel}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--red-alert, #ff2d00)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
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
          <div style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> PUBLIC API ACCESS
          </div>

          {[
            { endpoint: 'GET /api/dashboard', desc: 'Current rankings with confidence intervals', rate: '300 requests/minute' },
            { endpoint: 'GET /api/dashboard?period=7d', desc: 'Historical time-series data (7 days)', rate: '300 requests/minute' },
            { endpoint: 'GET /api/models/:id', desc: 'Detailed model breakdown by task', rate: '180 requests/minute' },
          ].map((api, i) => (
            <div key={i} style={{ ...styles.panel, background: 'rgba(0,255,65,0.03)' }}>
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
              &rarr; Prevents abuse and ensures fair access<br/>
              &rarr; Per-IP tracking with sliding window<br/>
              &rarr; Returns 429 status code when exceeded<br/>
              &rarr; Retry-After header indicates wait time<br/>
              &rarr; Internal/localhost requests excluded
            </div>
          </div>

          <div style={styles.warningPanel}>
            <span style={{ fontSize: '11px', color: 'var(--amber-warning)' }}>
              <strong>Enterprise API:</strong> Higher limits (10,000+ requests/day) available via licensed access &rarr;{' '}
              <a href="https://studioplatforms.eu/products/aistupidlevel/data-licensing" target="_blank" rel="noopener noreferrer" style={styles.link}>
                Learn More
              </a>
            </span>
          </div>

          <hr style={styles.divider} />

          {/* vs Other Benchmarks */}
          <div style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> VS. OTHER BENCHMARKS
          </div>
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
            background: 'rgba(0,255,65,0.04)',
            border: '2px solid rgba(0,255,65,0.3)',
            padding: '20px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--phosphor-green)', letterSpacing: '1.5px', marginBottom: '10px', textShadow: '0 0 6px rgba(0,255,65,0.4)' }}>
              EXPLORE THE RANKINGS
            </div>
            <div style={{ ...styles.text, marginBottom: '16px' }}>
              See how 21 AI models perform across 500,000+ benchmark runs<br/>
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
                border: '1px solid rgba(0,255,65,0.3)',
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
                border: '1px solid rgba(0,255,65,0.3)',
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
            AI Stupid Level &bull; Independent benchmarking since 2024 &bull; <Link href="/" style={styles.link}>View Rankings</Link>
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
