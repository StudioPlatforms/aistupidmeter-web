import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';

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

export default function MethodologyPage() {
  return (
    <div className="vintage-container">
      <Breadcrumbs items={[
        { label: 'Home', href: '/' },
        { label: 'Methodology' }
      ]} />
      
      {/* Header */}
      <div className="crt-monitor" style={{ marginBottom: '24px', marginTop: '16px' }}>
        <div className="terminal-text">
          <div style={{ fontSize: '1.8em', marginBottom: '16px', textAlign: 'center' }}>
            <span className="terminal-text--green">HOW WE TEST AI MODELS</span>
            <span className="blinking-cursor"></span>
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '1.0em', textAlign: 'center', marginBottom: '16px' }}>
            Complete Technical Methodology - Statistically Rigorous, Execution-Based, Continuous Monitoring
          </div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="crt-monitor" style={{ marginBottom: '24px' }}>
        <div className="terminal-text">
          <div className="terminal-text--amber" style={{ fontSize: '1.2em', marginBottom: '12px' }}>
            📋 NAVIGATION
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.9em', lineHeight: '1.8' }}>
            1. <a href="#suites" className="terminal-text--green" style={{ textDecoration: 'underline' }}>4 Benchmark Suites</a><br/>
            2. <a href="#scoring" className="terminal-text--green" style={{ textDecoration: 'underline' }}>9-Axis Scoring System</a><br/>
            3. <a href="#statistical" className="terminal-text--green" style={{ textDecoration: 'underline' }}>Statistical Analysis (95% CI)</a><br/>
            4. <a href="#drift" className="terminal-text--green" style={{ textDecoration: 'underline' }}>Drift Detection (CUSUM)</a><br/>
            5. <a href="#enhancements" className="terminal-text--green" style={{ textDecoration: 'underline' }}>Enhanced Testing (2026)</a><br/>
            6. <a href="#validation" className="terminal-text--green" style={{ textDecoration: 'underline' }}>Validation & Transparency</a>
          </div>
        </div>
      </div>

      {/* Section 1: Benchmark Suites */}
      <div id="suites" className="crt-monitor" style={{ marginBottom: '24px' }}>
        <div className="terminal-text">
          <div className="terminal-text--amber" style={{ fontSize: '1.4em', marginBottom: '16px' }}>
            1. THE 4 BENCHMARK SUITES
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '16px', backgroundColor: 'rgba(0, 255, 65, 0.1)', border: '1px solid rgba(0, 255, 65, 0.3)', borderRadius: '8px' }}>
              <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                ⚡ HOURLY SUITE
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em', lineHeight: '1.6' }}>
                <strong>Frequency</strong>: Every 4 hours<br/>
                <strong>Tasks</strong>: 147 coding challenges<br/>
                <strong>Trials</strong>: 5 per task<br/>
                <strong>Scoring</strong>: 9-axis evaluation<br/>
                <strong>Purpose</strong>: Fast performance tracking
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'rgba(0, 100, 200, 0.15)', border: '1px solid rgba(0, 150, 255, 0.4)', borderRadius: '8px' }}>
              <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                🧠 DEEP REASONING
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em', lineHeight: '1.6' }}>
                <strong>Frequency</strong>: Daily at 3 AM<br/>
                <strong>Tasks</strong>: Multi-turn dialogues<br/>
                <strong>Scoring</strong>: 13-axis evaluation<br/>
                <strong>Purpose</strong>: Complex reasoning tests
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'rgba(200, 100, 0, 0.15)', border: '1px solid rgba(255, 150, 0, 0.4)', borderRadius: '8px' }}>
              <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                🔧 TOOL CALLING
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em', lineHeight: '1.6' }}>
                <strong>Frequency</strong>: Daily at 4 AM<br/>
                <strong>Execution</strong>: Real Docker sandboxes<br/>
                <strong>Scoring</strong>: 7-axis evaluation<br/>
                <strong>Purpose</strong>: Agent capability tests
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'rgba(200, 0, 100, 0.15)', border: '1px solid rgba(255, 0, 150, 0.4)', borderRadius: '8px' }}>
              <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                🐦 CANARY SUITE
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em', lineHeight: '1.6' }}>
                <strong>Frequency</strong>: Every hour<br/>
                <strong>Tasks</strong>: 12 fast tests<br/>
                <strong>Purpose</strong>: Rapid drift detection<br/>
                <strong>Response Time</strong>: &lt;5 minutes
              </div>
            </div>
          </div>

          <div className="terminal-text--dim" style={{ fontSize: '0.9em', lineHeight: '1.8' }}>
            <strong className="terminal-text--green">Total Annual Output:</strong><br/>
            • 500,000+ benchmark runs<br/>
            • 2,500,000+ individual test executions<br/>
            • 100,000+ tool-calling sessions<br/>
            • 10,000+ drift incidents documented
          </div>
        </div>
      </div>

      {/* Section 2: Scoring System */}
      <div id="scoring" className="crt-monitor" style={{ marginBottom: '24px' }}>
        <div className="terminal-text">
          <div className="terminal-text--amber" style={{ fontSize: '1.4em', marginBottom: '16px' }}>
            2. 9-AXIS SCORING METHODOLOGY
          </div>
          
          <div className="terminal-text--dim" style={{ fontSize: '0.9em', lineHeight: '1.8', marginBottom: '16px' }}>
            Each task is evaluated across 9 dimensions. Weights optimized for production relevance:
          </div>

          <div style={{ backgroundColor: 'rgba(0, 255, 65, 0.05)', padding: '16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.85em' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto 1fr', gap: '8px 16px', alignItems: 'center' }}>
              <span className="terminal-text--green">CORRECTNESS</span>
              <span className="terminal-text--amber">40%</span>
              <span className="terminal-text--dim">→</span>
              <span className="terminal-text--dim">Does code work? All tests pass?</span>

              <span className="terminal-text--green">COMPLEXITY</span>
              <span className="terminal-text--amber">20%</span>
              <span className="terminal-text--dim">→</span>
              <span className="terminal-text--dim">Handles algorithm complexity?</span>

              <span className="terminal-text--green">CODE QUALITY</span>
              <span className="terminal-text--amber">15%</span>
              <span className="terminal-text--dim">→</span>
              <span className="terminal-text--dim">Clean, maintainable code?</span>

              <span className="terminal-text--green">STABILITY</span>
              <span className="terminal-text--amber">10%</span>
              <span className="terminal-text--dim">→</span>
              <span className="terminal-text--dim">Edge cases, no crashes?</span>

              <span className="terminal-text--green">EFFICIENCY</span>
              <span className="terminal-text--amber">5%</span>
              <span className="terminal-text--dim">→</span>
              <span className="terminal-text--dim">Optimal complexity?</span>

              <span className="terminal-text--green">EDGE CASES</span>
              <span className="terminal-text--amber">3%</span>
              <span className="terminal-text--dim">→</span>
              <span className="terminal-text--dim">Null, empty, boundaries?</span>

              <span className="terminal-text--green">DEBUGGING</span>
              <span className="terminal-text--amber">3%</span>
              <span className="terminal-text--dim">→</span>
              <span className="terminal-text--dim">Can fix broken code?</span>

              <span className="terminal-text--green">FORMAT</span>
              <span className="terminal-text--amber">2%</span>
              <span className="terminal-text--dim">→</span>
              <span className="terminal-text--dim">Clean output, follows spec?</span>

              <span className="terminal-text--green">SAFETY</span>
              <span className="terminal-text--amber">2%</span>
              <span className="terminal-text--dim">→</span>
              <span className="terminal-text--dim">No dangerous operations?</span>
            </div>
          </div>

          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(255, 176, 0, 0.1)', border: '1px solid rgba(255, 176, 0, 0.3)', borderRadius: '8px' }}>
            <span className="terminal-text--amber" style={{ fontSize: '0.95em' }}>
              <strong>Formula:</strong> FinalScore = Σ (axis_score × axis_weight)
            </span>
          </div>
        </div>
      </div>

      {/* Section 3: Statistical Analysis */}
      <div id="statistical" className="crt-monitor" style={{ marginBottom: '24px' }}>
        <div className="terminal-text">
          <div className="terminal-text--amber" style={{ fontSize: '1.4em', marginBottom: '16px' }}>
            3. STATISTICAL RIGOR (95% CONFIDENCE INTERVALS)
          </div>
          
          <div className="terminal-text--dim" style={{ fontSize: '0.9em', lineHeight: '1.8', marginBottom: '16px' }}>
            Unlike benchmarks showing single measurements, we provide confidence intervals to quantify uncertainty.
          </div>

          <div style={{ backgroundColor: 'rgba(0, 100, 200, 0.1)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
            <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '12px' }}>
              WHY 5 TRIALS?
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.85em', lineHeight: '1.6' }}>
              • AI models are <strong className="terminal-text--amber">stochastic</strong> (same prompt → different outputs)<br/>
              • Single measurements are unreliable<br/>
              • 5 trials = optimal balance of cost vs statistical power<br/>
              • Provides 95% confidence intervals using t-distribution
            </div>
          </div>

          <div style={{ backgroundColor: 'rgba(0, 255, 65, 0.05)', padding: '16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.75em' }}>
            <div className="terminal-text--green" style={{ marginBottom: '8px' }}>EXAMPLE CALCULATION:</div>
            <div className="terminal-text--dim">
              claude-opus-4-5-20251101 on binary_search:<br/>
              Trial 1: 92 | Trial 2: 94 | Trial 3: 90 | Trial 4: 93 | Trial 5: 91<br/>
              <br/>
              Mean = 92.0<br/>
              Std Dev = 1.58<br/>
              Std Error = 1.58 / sqrt(5) = 0.71<br/>
              t-value = 2.776 (df=4, 95% CI)<br/>
              Margin = 2.776 × 0.71 = 1.97<br/>
              <br/>
              <span className="terminal-text--amber">
              <strong>Final: 92.0 ± 2.0</strong><br/>
              95% CI: [90.0, 94.0]
              </span>
            </div>
          </div>

          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(0, 255, 65, 0.1)', border: '1px solid rgba(0, 255, 65, 0.3)', borderRadius: '8px' }}>
            <span className="terminal-text--green" style={{ fontSize: '0.9em' }}>
              <strong>Translation:</strong> "We're 95% confident claude-opus-4-5's true performance is between 90-94"
            </span>
          </div>
        </div>
      </div>

      {/* Section 4: Drift Detection */}
      <div id="drift" className="crt-monitor" style={{ marginBottom: '24px' }}>
        <div className="terminal-text">
          <div className="terminal-text--amber" style={{ fontSize: '1.4em', marginBottom: '16px' }}>
            4. DRIFT DETECTION (CUSUM ALGORITHM)
          </div>
          
          <div className="terminal-text--dim" style={{ fontSize: '0.9em', lineHeight: '1.8', marginBottom: '16px' }}>
            Detects <strong className="terminal-text--amber">sustained</strong> performance changes, not daily noise.
          </div>

          <div style={{ backgroundColor: 'rgba(255, 45, 0, 0.1)', padding: '16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.75em', marginBottom: '16px' }}>
            <div className="terminal-text--amber" style={{ marginBottom: '8px' }}>CUSUM ALGORITHM:</div>
            <div className="terminal-text--dim">
              For each new score:<br/>
              1. Compare to baseline (historical average)<br/>
              2. Calculate deviation: δ = new_score - baseline<br/>
              3. Update CUSUM: S = max(0, S + δ - k)<br/>
              4. If S &gt; threshold: ALERT (drift detected)<br/>
              <br/>
              <span className="terminal-text--green">
              Parameters:<br/>
              • Baseline window: 12 runs<br/>
              • Sensitivity (k): 0.005<br/>
              • Threshold (λ): 0.5<br/>
              • False positive rate: &lt;2%
              </span>
            </div>
          </div>

          <div className="terminal-text--green" style={{ fontSize: '1.0em', marginBottom: '12px' }}>
            ALERT SEVERITY LEVELS:
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.85em', lineHeight: '1.8' }}>
            🟢 <strong className="terminal-text--green">NORMAL</strong> - Performance within expected variance<br/>
            🟡 <strong className="terminal-text--amber">WARNING</strong> - Slight decline, monitoring closely<br/>
            🟠 <strong className="terminal-text--amber">DEGRADATION</strong> - Sustained decline confirmed<br/>
            🔴 <strong className="terminal-text--red">CRITICAL</strong> - Major drop, immediate attention needed
          </div>
        </div>
      </div>

      {/* Section 5: Enhanced Testing */}
      <div id="enhancements" className="crt-monitor" style={{ marginBottom: '24px' }}>
        <div className="terminal-text">
          <div className="terminal-text--amber" style={{ fontSize: '1.4em', marginBottom: '16px' }}>
            5. ENHANCED TESTING (NEW IN 2026)
          </div>
          
          <div className="terminal-text--dim" style={{ fontSize: '0.9em', lineHeight: '1.8', marginBottom: '16px' }}>
            Zero-cost enhancements that extract 10x more value from existing tests:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '12px', backgroundColor: 'rgba(255, 45, 0, 0.15)', border: '1px solid rgba(255, 45, 0, 0.3)', borderRadius: '6px' }}>
              <div className="terminal-text--red" style={{ fontSize: '1.0em', marginBottom: '6px' }}>
                🛡️ ADVERSARIAL SAFETY
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                18 attack types: jailbreak, injection, extraction<br/>
                120,000+ tests/year<br/>
                Vulnerability profiling
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'rgba(0, 100, 200, 0.15)', border: '1px solid rgba(0, 150, 255, 0.3)', borderRadius: '6px' }}>
              <div className="terminal-text--green" style={{ fontSize: '1.0em', marginBottom: '6px' }}>
                🎯 PROMPT ROBUSTNESS
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                11 variation types: paraphrase, restructure<br/>
                180,000+ tests/year<br/>
                Consistency measurement
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'rgba(150, 0, 200, 0.15)', border: '1px solid rgba(200, 0, 255, 0.3)', borderRadius: '6px' }}>
              <div className="terminal-text--amber" style={{ fontSize: '1.0em', marginBottom: '6px' }}>
                ⚖️ BIAS DETECTION
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                18 demographic variants tested<br/>
                60,000+ tests/year<br/>
                EU AI Act compliance
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'rgba(0, 200, 150, 0.15)', border: '1px solid rgba(0, 255, 200, 0.3)', borderRadius: '6px' }}>
              <div className="terminal-text--green" style={{ fontSize: '1.0em', marginBottom: '6px' }}>
                📊 VERSION TRACKING
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                Extracts from response headers<br/>
                Regression root cause analysis<br/>
                Complete version genealogy
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 6: Validation */}
      <div id="validation" className="crt-monitor" style={{ marginBottom: '24px' }}>
        <div className="terminal-text">
          <div className="terminal-text--amber" style={{ fontSize: '1.4em', marginBottom: '16px' }}>
            6. VALIDATION & TRANSPARENCY
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '12px', backgroundColor: 'rgba(0, 255, 65, 0.1)', border: '1px solid rgba(0, 255, 65, 0.3)', borderRadius: '6px' }}>
              <div className="terminal-text--green" style={{ fontSize: '1.0em', marginBottom: '6px' }}>
                ✅ OPEN SOURCE
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                Full code on GitHub<br/>
                Fully auditable methodology<br/>
                Run locally to verify
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'rgba(0, 255, 65, 0.1)', border: '1px solid rgba(0, 255, 65, 0.3)', borderRadius: '6px' }}>
              <div className="terminal-text--green" style={{ fontSize: '1.0em', marginBottom: '6px' }}>
                ✅ INDEPENDENT
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                Zero vendor funding<br/>
                No affiliate revenue<br/>
                100% unbiased
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'rgba(0, 255, 65, 0.1)', border: '1px solid rgba(0, 255, 65, 0.3)', borderRadius: '6px' }}>
              <div className="terminal-text--green" style={{ fontSize: '1.0em', marginBottom: '6px' }}>
                ✅ VERIFIABLE
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                "Test Your Keys" feature<br/>
                Reproduce our results<br/>
                Compare independently
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'rgba(0, 255, 65, 0.1)', border: '1px solid rgba(0, 255, 65, 0.3)', borderRadius: '6px' }}>
              <div className="terminal-text--green" style={{ fontSize: '1.0em', marginBottom: '6px' }}>
                ✅ PEER REVIEWED
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                Academic validation<br/>
                Community audited<br/>
                500+ GitHub stars
              </div>
            </div>
          </div>

          <div style={{ padding: '16px', backgroundColor: 'rgba(0, 255, 65, 0.05)', border: '2px solid rgba(0, 255, 65, 0.3)', borderRadius: '8px', textAlign: 'center' }}>
            <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
              🔑 TEST YOUR KEYS
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '12px' }}>
              Run benchmarks with your own API keys to verify we're not making up numbers
            </div>
            <Link href="/test" style={{ display: 'inline-block', padding: '10px 20px', backgroundColor: 'rgba(0, 255, 65, 0.2)', border: '2px solid var(--phosphor-green)', borderRadius: '6px', color: 'var(--phosphor-green)', textDecoration: 'none', fontWeight: 'bold' }}>
              TEST NOW →
            </Link>
          </div>
        </div>
      </div>

      {/* Section: Current Models */}
      <div className="crt-monitor" style={{ marginBottom: '24px' }}>
        <div className="terminal-text">
          <div className="terminal-text--amber" style={{ fontSize: '1.4em', marginBottom: '16px' }}>
            🤖 CURRENT MODELS TESTED (21 ACTIVE)
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '0.8em' }}>
            <div className="terminal-text--green">claude-3-7-sonnet-20250219</div>
            <div className="terminal-text--green">claude-sonnet-4-5-20250929</div>
            <div className="terminal-text--green">claude-opus-4-5-20251101</div>
            <div className="terminal-text--green">gpt-5.2</div>
            <div className="terminal-text--green">gpt-5.1</div>
            <div className="terminal-text--green">gpt-5.1-codex</div>
            <div className="terminal-text--green">deepseek-chat</div>
            <div className="terminal-text--green">deepseek-reasoner</div>
            <div className="terminal-text--green">gemini-2.5-flash</div>
            <div className="terminal-text--green">gemini-3-pro-preview</div>
            <div className="terminal-text--green">grok-4-0709</div>
            <div className="terminal-text--green">grok-4-latest</div>
            <div className="terminal-text--green">kimi-latest</div>
            <div className="terminal-text--green">kimi-k2-turbo-preview</div>
            <div className="terminal-text--green">glm-4.6</div>
            <div className="terminal-text--dim">...and 6 more</div>
          </div>

          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(0, 255, 65, 0.05)', borderRadius: '6px' }}>
            <span className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
              Scores update <strong className="terminal-text--amber">every 4 hours</strong>. Rankings shift based on continuous performance monitoring.
            </span>
          </div>
        </div>
      </div>

      {/* Section: Why This Matters */}
      <div className="crt-monitor" style={{ marginBottom: '24px' }}>
        <div className="terminal-text">
          <div className="terminal-text--amber" style={{ fontSize: '1.4em', marginBottom: '16px' }}>
            💡 WHY THIS METHODOLOGY MATTERS
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <div className="terminal-text--red" style={{ fontSize: '1.0em', marginBottom: '8px' }}>
                ❌ TRADITIONAL BENCHMARKS:
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em', lineHeight: '1.6' }}>
                • Single measurements (unreliable)<br/>
                • No confidence intervals<br/>
                • Point-in-time snapshots<br/>
                • Vendor-sponsored (biased)<br/>
                • No safety testing<br/>
                • No bias evaluation<br/>
                • Opaque methodology
              </div>
            </div>

            <div>
              <div className="terminal-text--green" style={{ fontSize: '1.0em', marginBottom: '8px' }}>
                ✅ OUR APPROACH:
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em', lineHeight: '1.6' }}>
                • 5 trials per task (statistical power)<br/>
                • 95% confidence intervals<br/>
                • 2+ years continuous monitoring<br/>
                • 100% independent funding<br/>
                • 120K+ safety tests/year<br/>
                • 60K+ bias tests/year<br/>
                • Fully open source
              </div>
            </div>
          </div>

          <div style={{ padding: '16px', backgroundColor: 'rgba(0, 255, 65, 0.1)', border: '2px solid var(--phosphor-green)', borderRadius: '8px', textAlign: 'center' }}>
            <span className="terminal-text--green" style={{ fontSize: '1.0em' }}>
              <strong>Result:</strong> Data you can bet your business on.
            </span>
          </div>
        </div>
      </div>

      {/* Section: API Access */}
      <div className="crt-monitor" style={{ marginBottom: '24px' }}>
        <div className="terminal-text">
          <div className="terminal-text--amber" style={{ fontSize: '1.4em', marginBottom: '16px' }}>
            📡 PUBLIC API ACCESS
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '12px', backgroundColor: 'rgba(0, 255, 65, 0.05)', border: '1px solid rgba(0, 255, 65, 0.2)', borderRadius: '6px' }}>
              <code className="terminal-text--green" style={{ fontSize: '0.85em' }}>GET /api/dashboard</code>
              <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginTop: '6px' }}>
                Current rankings with confidence intervals<br/>
                <span className="terminal-text--amber">Rate Limit: 300 requests/minute</span>
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'rgba(0, 255, 65, 0.05)', border: '1px solid rgba(0, 255, 65, 0.2)', borderRadius: '6px' }}>
              <code className="terminal-text--green" style={{ fontSize: '0.85em' }}>GET /api/dashboard?period=7d</code>
              <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginTop: '6px' }}>
                Historical time-series data (7 days)<br/>
                <span className="terminal-text--amber">Rate Limit: 300 requests/minute</span>
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'rgba(0, 255, 65, 0.05)', border: '1px solid rgba(0, 255, 65, 0.2)', borderRadius: '6px' }}>
              <code className="terminal-text--green" style={{ fontSize: '0.85em' }}>GET /api/models/:id</code>
              <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginTop: '6px' }}>
                Detailed model breakdown by task<br/>
                <span className="terminal-text--amber">Rate Limit: 180 requests/minute</span>
              </div>
            </div>
          </div>

          <div style={{ padding: '12px', backgroundColor: 'rgba(0, 100, 200, 0.1)', border: '1px solid rgba(0, 150, 255, 0.3)', borderRadius: '6px', marginBottom: '16px' }}>
            <div className="terminal-text--green" style={{ fontSize: '0.95em', marginBottom: '8px' }}>
              🛡️ RATE LIMITING & PROTECTION
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.8em', lineHeight: '1.6' }}>
              All public APIs protected with automatic rate limiting:<br/>
              • Prevents abuse and ensures fair access<br/>
              • Per-IP tracking with sliding window<br/>
              • Returns 429 status code when exceeded<br/>
              • Retry-After header indicates wait time<br/>
              • Internal/localhost requests excluded
            </div>
          </div>

          <div style={{ padding: '12px', backgroundColor: 'rgba(255, 176, 0, 0.1)', border: '1px solid rgba(255, 176, 0, 0.3)', borderRadius: '6px' }}>
            <span className="terminal-text--amber" style={{ fontSize: '0.85em' }}>
              <strong>Enterprise API:</strong> Higher limits (10,000+ requests/day) available via licensed access →{' '}
              <a href="https://studioplatforms.eu/products/aistupidlevel/data-licensing" target="_blank" rel="noopener noreferrer" className="terminal-text--green" style={{ textDecoration: 'underline' }}>
                Learn More
              </a>
            </span>
          </div>
        </div>
      </div>

      {/* Section: Key Differences */}
      <div className="crt-monitor" style={{ marginBottom: '24px' }}>
        <div className="terminal-text">
          <div className="terminal-text--amber" style={{ fontSize: '1.4em', marginBottom: '16px' }}>
            ⚔️ vs. OTHER BENCHMARKS
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '12px', backgroundColor: 'rgba(0, 100, 200, 0.1)', border: '1px solid rgba(0, 150, 255, 0.3)', borderRadius: '6px' }}>
              <div className="terminal-text--amber" style={{ fontSize: '0.95em', marginBottom: '6px' }}>vs. HumanEval</div>
              <div className="terminal-text--dim" style={{ fontSize: '0.75em', lineHeight: '1.5' }}>
                <strong>Them:</strong> Single-shot, pass/fail<br/>
                <strong className="terminal-text--green">Us:</strong> 5 trials, nuanced scoring, CI
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'rgba(0, 100, 200, 0.1)', border: '1px solid rgba(0, 150, 255, 0.3)', borderRadius: '6px' }}>
              <div className="terminal-text--amber" style={{ fontSize: '0.95em', marginBottom: '6px' }}>vs. MMLU</div>
              <div className="terminal-text--dim" style={{ fontSize: '0.75em', lineHeight: '1.5' }}>
                <strong>Them:</strong> Multiple choice<br/>
                <strong className="terminal-text--green">Us:</strong> Real code execution
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'rgba(0, 100, 200, 0.1)', border: '1px solid rgba(0, 150, 255, 0.3)', borderRadius: '6px' }}>
              <div className="terminal-text--amber" style={{ fontSize: '0.95em', marginBottom: '6px' }}>vs. Chatbot Arena</div>
              <div className="terminal-text--dim" style={{ fontSize: '0.75em', lineHeight: '1.5' }}>
                <strong>Them:</strong> Human voting<br/>
                <strong className="terminal-text--green">Us:</strong> Objective execution
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'rgba(0, 100, 200, 0.1)', border: '1px solid rgba(0, 150, 255, 0.3)', borderRadius: '6px' }}>
              <div className="terminal-text--amber" style={{ fontSize: '0.95em', marginBottom: '6px' }}>vs. Vendor Benchmarks</div>
              <div className="terminal-text--dim" style={{ fontSize: '0.75em', lineHeight: '1.5' }}>
                <strong>Them:</strong> Marketing-optimized<br/>
                <strong className="terminal-text--green">Us:</strong> Independent, unbiased
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="crt-monitor">
        <div className="terminal-text" style={{ textAlign: 'center' }}>
          <div className="terminal-text--green" style={{ fontSize: '1.3em', marginBottom: '16px', textShadow: '0 0 15px var(--phosphor-green)' }}>
            🚀 EXPLORE THE RANKINGS
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '20px' }}>
            See how 21 AI models perform across 500,000+ benchmark runs<br/>
            Updated every 4 hours with statistical confidence intervals
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/" className="vintage-btn vintage-btn--active" style={{
              padding: '12px 32px',
              fontSize: '1.0em',
              textDecoration: 'none',
              display: 'inline-block',
              boxShadow: '0 0 20px rgba(0, 255, 65, 0.5)'
            }}>
              VIEW RANKINGS →
            </Link>
            <Link href="/about" className="vintage-btn" style={{
              padding: '12px 24px',
              fontSize: '1.0em',
              textDecoration: 'none',
              display: 'inline-block'
            }}>
              ABOUT US
            </Link>
            <Link href="/faq" className="vintage-btn" style={{
              padding: '12px 24px',
              fontSize: '1.0em',
              textDecoration: 'none',
              display: 'inline-block'
            }}>
              FAQ
            </Link>
          </div>
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
  );
}
