import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'AI Benchmarking Methodology | How We Test AI Models',
  description: 'Comprehensive technical documentation of our 7-axis AI benchmarking methodology using CUSUM drift detection, statistical confidence intervals, and execution-based testing. Learn how we measure AI performance objectively.',
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
    description: 'Rigorous, statistically-sound approach to AI benchmarking with 7-axis scoring, confidence intervals, and drift detection.',
    type: 'article',
  }
};

export default function MethodologyPage() {
  return (
    <article className="max-w-4xl mx-auto px-4 py-12 prose prose-invert">
      <Breadcrumbs items={[
        { label: 'Home', href: '/' },
        { label: 'Methodology' }
      ]} />
      
      <h1>How aistupidlevel.info Works - Technical Overview</h1>
      
      <nav className="not-prose bg-slate-800 p-4 rounded-lg mb-8">
        <p className="text-sm text-slate-300 mb-2">Quick Navigation:</p>
        <ul className="text-sm space-y-1">
          <li><a href="#benchmark-execution" className="text-blue-400 hover:text-blue-300">1. Benchmark Execution</a></li>
          <li><a href="#score-calculation" className="text-blue-400 hover:text-blue-300">2. Score Calculation</a></li>
          <li><a href="#statistical-analysis" className="text-blue-400 hover:text-blue-300">3. Statistical Analysis</a></li>
          <li><a href="#drift-detection" className="text-blue-400 hover:text-blue-300">4. Drift Detection</a></li>
          <li><a href="#data-storage" className="text-blue-400 hover:text-blue-300">5. Data Storage</a></li>
          <li><a href="#api-endpoints" className="text-blue-400 hover:text-blue-300">6. API Endpoints</a></li>
          <li><a href="#validation" className="text-blue-400 hover:text-blue-300">7. Validation & Transparency</a></li>
        </ul>
      </nav>

      <section id="benchmark-execution">
        <h2>1. Benchmark Execution</h2>
        
        <p>Our benchmarking system runs <strong>real coding tasks</strong> across multiple programming languages to evaluate AI model performance objectively.</p>

        <h3>Process Overview</h3>
        <ol>
          <li><strong>Task Selection:</strong> System runs a curated set of coding tasks across multiple languages (Python, TypeScript)</li>
          <li><strong>Multiple Trials:</strong> Each model runs each task <strong>5 times</strong> with different random seeds</li>
          <li><strong>7-Axis Scoring:</strong> Each trial is scored on multiple dimensions</li>
        </ol>

        <h3>The 7 Evaluation Axes</h3>
        <dl>
          <dt><strong>Correctness (30%)</strong></dt>
          <dd>Does the generated code work correctly? Tests are executed to verify functionality.</dd>
          
          <dt><strong>Spec Adherence (20%)</strong></dt>
          <dd>Does the code follow the specified requirements and constraints?</dd>
          
          <dt><strong>Code Quality (15%)</strong></dt>
          <dd>Is the code clean, maintainable, and following best practices?</dd>
          
          <dt><strong>Efficiency (10%)</strong></dt>
          <dd>How well does the code perform in terms of time and space complexity?</dd>
          
          <dt><strong>Stability (10%)</strong></dt>
          <dd>Does the model produce consistent behavior across runs?</dd>
          
          <dt><strong>Refusal Rate (10%)</strong></dt>
          <dd>How often does the model refuse to attempt the task?</dd>
          
          <dt><strong>Recovery (5%)</strong></dt>
          <dd>Can the model fix errors when given feedback?</dd>
        </dl>

        <div className="not-prose bg-slate-800 p-4 rounded-lg my-6">
          <p className="text-sm text-slate-400 mb-2">Technical Implementation:</p>
          <pre className="text-xs overflow-x-auto"><code>{`// Run 5 trials per task
for (let trial = 0; trial < 5; trial++) {
  const seed = baseSeed + trial;
  const result = await runTask(model, task, { seed, temp: 0.7 });
  scores.push(calculateScore(result));
}

// Use median for robustness
const finalScore = median(scores);`}</code></pre>
        </div>
      </section>

      <section id="score-calculation">
        <h2>2. Score Calculation</h2>
        
        <p>Our "stupid score" is a <strong>weighted average of the 7 axes</strong>, where lower scores indicate better performance (less "stupid").</p>

        <h3>Scoring Formula</h3>
        <div className="not-prose bg-slate-800 p-4 rounded-lg my-6">
          <pre className="text-xs overflow-x-auto"><code>{`const stupidScore = 100 - (
  correctness * 0.30 +
  spec * 0.20 +
  codeQuality * 0.15 +
  efficiency * 0.10 +
  stability * 0.10 +
  refusal * 0.10 +
  recovery * 0.05
) * 100;

// Score interpretation:
// 0-20  = Excellent (top tier)
// 21-40 = Good (production ready)
// 41-60 = Average (usable with caution)
// 61-80 = Poor (significant issues)
// 81-100 = Very Poor (not recommended)`}</code></pre>
        </div>

        <h3>Why These Weights?</h3>
        <ul>
          <li><strong>Correctness is paramount (30%):</strong> Code that doesn't work is worthless</li>
          <li><strong>Following specs matters (20%):</strong> Real-world code must meet requirements</li>
          <li><strong>Code quality for maintainability (15%):</strong> Production code needs to be maintainable</li>
          <li><strong>Performance and behavior (35% combined):</strong> Efficiency, stability, and reliability are crucial</li>
        </ul>
      </section>

      <section id="statistical-analysis">
        <h2>3. Statistical Analysis</h2>
        
        <p>Unlike other benchmarks that show single measurements, we provide <strong>confidence intervals</strong> to quantify uncertainty.</p>

        <h3>Why Statistical Rigor Matters</h3>
        <p>AI models are <strong>stochastic</strong> (probabilistic), meaning:</p>
        <ul>
          <li>The same prompt can produce different outputs</li>
          <li>Single measurements are unreliable</li>
          <li>We need multiple trials to estimate true performance</li>
        </ul>

        <h3>Our Approach</h3>
        <div className="not-prose bg-slate-800 p-4 rounded-lg my-6">
          <pre className="text-xs overflow-x-auto"><code>{`// Calculate 95% confidence interval
const mean = scores.reduce((a, b) => a + b) / 5;
const stdDev = sqrt(variance / 4); // n-1 degrees of freedom
const standardError = stdDev / sqrt(5);
const tValue = 2.776; // t-distribution for df=4, 95% CI
const marginOfError = tValue * standardError;

return {
  lower: mean - marginOfError,
  upper: mean + marginOfError,
  standardError
};`}</code></pre>
        </div>

        <h3>Why t-Distribution?</h3>
        <p>With only 5 samples, the normal distribution <strong>underestimates uncertainty</strong>. The t-distribution:</p>
        <ul>
          <li>Accounts for small sample sizes</li>
          <li>Provides more conservative (wider) intervals</li>
          <li>Is more honest about measurement uncertainty</li>
        </ul>

        <div className="not-prose bg-blue-900/30 border border-blue-500/50 p-4 rounded-lg my-6">
          <p className="text-sm"><strong>💡 Example:</strong> A score of "24.8 ± 1.3" means we're 95% confident the true score is between 23.5 and 26.1</p>
        </div>
      </section>

      <section id="drift-detection">
        <h2>4. Drift Detection (CUSUM Algorithm)</h2>
        
        <p>We use the <strong>CUSUM (Cumulative Sum)</strong> algorithm to detect <em>sustained</em> performance changes, not just daily noise.</p>

        <h3>How CUSUM Works</h3>
        <div className="not-prose bg-slate-800 p-4 rounded-lg my-6">
          <pre className="text-xs overflow-x-auto"><code>{`// Cumulative Sum for detecting sustained changes
let cusum = 0;
for (const score of recentScores) {
  const deviation = score - baseline;
  cusum = max(0, cusum + deviation - driftDelta);
  
  if (cusum > driftLambda) {
    // Sustained drift detected!
    createIncident({
      type: 'performance_degradation',
      severity: calculateSeverity(cusum)
    });
  }
}`}</code></pre>
        </div>

        <h3>Key Features</h3>
        <ul>
          <li><strong>Per-Model Calibration:</strong> Each model has custom thresholds based on its historical variance</li>
          <li><strong>Noise Tolerance:</strong> Noisy models get higher thresholds to avoid false alarms</li>
          <li><strong>Sustained Changes Only:</strong> Ignores single-day fluctuations, focuses on trends</li>
        </ul>

        <h3>Alert Severity Levels</h3>
        <dl>
          <dt><strong>🟢 Normal:</strong></dt>
          <dd>Performance within expected variance</dd>
          
          <dt><strong>🟡 Warning:</strong></dt>
          <dd>Slight decline detected, monitoring closely</dd>
          
          <dt><strong>🟠 Degradation:</strong></dt>
          <dd>Sustained decline confirmed, statistically significant</dd>
          
          <dt><strong>🔴 Critical:</strong></dt>
          <dd>Major performance drop, immediate attention needed</dd>
        </dl>
      </section>

      <section id="data-storage">
        <h2>5. Data Storage & Schema</h2>
        
        <p>All benchmark data is stored in a <strong>SQLite database</strong> with a carefully designed schema for historical tracking.</p>

        <h3>Key Database Tables</h3>
        <div className="not-prose bg-slate-800 p-4 rounded-lg my-6">
          <pre className="text-xs overflow-x-auto"><code>{`-- Models being tracked
CREATE TABLE models (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  vendor TEXT NOT NULL,
  show_in_rankings BOOLEAN DEFAULT false
);

-- Individual benchmark runs
CREATE TABLE runs (
  id INTEGER PRIMARY KEY,
  model_id INTEGER,
  task_id INTEGER,
  passed BOOLEAN,
  tokens_in INTEGER,
  tokens_out INTEGER,
  latency_ms INTEGER
);

-- Aggregated scores with statistical data
CREATE TABLE scores (
  id INTEGER PRIMARY KEY,
  model_id INTEGER,
  stupid_score REAL NOT NULL,
  axes JSON NOT NULL,
  cusum REAL NOT NULL,
  confidence_lower REAL,
  confidence_upper REAL,
  standard_error REAL,
  sample_size INTEGER DEFAULT 5,
  model_variance REAL
);`}</code></pre>
        </div>

        <p className="text-sm text-slate-400">This schema enables historical trend analysis, confidence interval tracking, and drift detection over time.</p>
      </section>

      <section id="api-endpoints">
        <h2>6. API Endpoints</h2>
        
        <p>Our <Link href="/" className="text-blue-400 hover:text-blue-300">public API</Link> provides access to benchmark data with confidence intervals and historical trends.</p>

        <h3>Available Endpoints</h3>
        <div className="not-prose space-y-4 my-6">
          <div className="bg-slate-800 p-4 rounded-lg">
            <code className="text-green-400">GET /api/dashboard</code>
            <p className="text-sm text-slate-300 mt-2">Get current AI model rankings with confidence intervals</p>
            <pre className="text-xs mt-2 overflow-x-auto"><code>{`{
  "models": [{
    "name": "gpt-5",
    "score": 25.3,
    "confidenceLower": 23.1,
    "confidenceUpper": 27.5,
    "rank": 1,
    "trend": "stable"
  }]
}`}</code></pre>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg">
            <code className="text-green-400">GET /api/dashboard?period=7d</code>
            <p className="text-sm text-slate-300 mt-2">Get historical time series data with confidence intervals</p>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg">
            <code className="text-green-400">GET /api/models/:id</code>
            <p className="text-sm text-slate-300 mt-2">Get detailed breakdown by task with statistical analysis</p>
          </div>
        </div>
      </section>

      <section id="validation">
        <h2>7. Validation & Transparency</h2>
        
        <h3>"Test Your Keys" Feature</h3>
        <p>To prove we're not making up numbers, users can <Link href="/test" className="text-blue-400 hover:text-blue-300">run benchmarks with their own API keys</Link>.</p>

        <div className="not-prose bg-slate-800 p-4 rounded-lg my-6">
          <pre className="text-xs overflow-x-auto"><code>{`// Users can run benchmarks with their own API keys
POST /api/test-keys
Body: {
  apiKey: "sk-...",
  model: "gpt-4"
}

// Runs same benchmarks, returns results
// Proves we're not making up numbers`}</code></pre>
        </div>

        <h3>Open Source Commitment</h3>
        <ul>
          <li>✅ <strong>All code is public:</strong> <a href="https://github.com/ionutvi/aistupidlevel.info" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">View on GitHub</a></li>
          <li>✅ <strong>Anyone can audit methodology:</strong> Full transparency in scoring algorithms</li>
          <li>✅ <strong>Can run locally to verify:</strong> Docker setup available for independent testing</li>
          <li>✅ <strong>No vendor affiliations:</strong> 100% independent evaluation</li>
        </ul>
      </section>

      <section className="border-t border-slate-700 pt-8">
        <h2>Key Differences from Other Benchmarks</h2>
        
        <div className="not-prose grid md:grid-cols-3 gap-4 my-6">
          <div className="bg-slate-800 p-4 rounded-lg">
            <h4 className="font-bold text-lg mb-2">vs. HumanEval</h4>
            <p className="text-sm text-slate-300"><strong>HumanEval:</strong> Single-shot, pass/fail</p>
            <p className="text-sm text-green-400 mt-2"><strong>Us:</strong> Multiple trials, nuanced scoring, confidence intervals</p>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg">
            <h4 className="font-bold text-lg mb-2">vs. MMLU</h4>
            <p className="text-sm text-slate-300"><strong>MMLU:</strong> Multiple choice questions</p>
            <p className="text-sm text-green-400 mt-2"><strong>Us:</strong> Real coding tasks with execution</p>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg">
            <h4 className="font-bold text-lg mb-2">vs. Chatbot Arena</h4>
            <p className="text-sm text-slate-300"><strong>Arena:</strong> Human preference voting</p>
            <p className="text-sm text-green-400 mt-2"><strong>Us:</strong> Objective code execution metrics</p>
          </div>
        </div>
      </section>

      <section>
        <h2>Why This Methodology Matters</h2>
        
        <div className="not-prose bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/50 p-6 rounded-lg my-6">
          <h3 className="text-xl font-bold mb-4">The Problem with Traditional Benchmarks</h3>
          <ul className="space-y-2 text-sm">
            <li>🔴 <strong>LLMs are stochastic (random):</strong> Same prompt = different outputs</li>
            <li>🔴 <strong>Single measurements are unreliable:</strong> No way to know if result was lucky/unlucky</li>
            <li>🔴 <strong>Daily fluctuations mislead:</strong> Natural variance mistaken for actual changes</li>
            <li>🔴 <strong>No uncertainty quantification:</strong> Users don't know measurement confidence</li>
          </ul>
          
          <h3 className="text-xl font-bold mt-6 mb-4">Our Solution</h3>
          <ul className="space-y-2 text-sm">
            <li>✅ <strong>Multiple trials (n=5):</strong> Capture natural variance</li>
            <li>✅ <strong>Confidence intervals:</strong> Show uncertainty honestly</li>
            <li>✅ <strong>Statistical tests:</strong> Distinguish signal from noise</li>
            <li>✅ <strong>Per-model calibration:</strong> Fair comparison across different model behaviors</li>
            <li>✅ <strong>Transparent methodology:</strong> Anyone can verify and reproduce</li>
          </ul>
        </div>
      </section>

      <section>
        <h2>Example: How a Score is Generated</h2>
        
        <div className="not-prose bg-slate-800 p-6 rounded-lg my-6">
          <ol className="space-y-3 text-sm">
            <li>
              <strong>1. Select task:</strong> "Implement binary search in Python"
            </li>
            <li>
              <strong>2. Run 5 trials with different seeds:</strong>
              <pre className="text-xs mt-2 ml-4"><code>{`Trial 1 (seed=42):   Score = 23.5
Trial 2 (seed=43):   Score = 25.1
Trial 3 (seed=44):   Score = 24.2
Trial 4 (seed=45):   Score = 26.3
Trial 5 (seed=46):   Score = 24.8`}</code></pre>
            </li>
            <li>
              <strong>3. Calculate statistics:</strong>
              <pre className="text-xs mt-2 ml-4"><code>{`Mean = 24.78
StdDev = 1.02
SE = 1.02 / sqrt(5) = 0.46`}</code></pre>
            </li>
            <li>
              <strong>4. Calculate 95% confidence interval:</strong>
              <pre className="text-xs mt-2 ml-4"><code>{`t-value = 2.776 (for df=4)
Margin = 2.776 × 0.46 = 1.27
CI = [23.51, 26.05]`}</code></pre>
            </li>
            <li>
              <strong>5. Store in database:</strong>
              <pre className="text-xs mt-2 ml-4"><code>{`stupid_score = 24.78
confidence_lower = 23.51
confidence_upper = 26.05
standard_error = 0.46
sample_size = 5`}</code></pre>
            </li>
            <li>
              <strong>6. Display to user:</strong><br/>
              <span className="text-green-400">"Score: 24.8 ± 1.3 (95% CI: 23.5-26.1)"</span>
            </li>
          </ol>
        </div>
      </section>

      <section>
        <h2>Frequently Asked Questions</h2>
        
        <dl className="space-y-4">
          <div>
            <dt className="font-bold text-lg">Q: Why only 5 trials?</dt>
            <dd className="text-slate-300 mt-1">A: Balance between statistical power and computational cost. 5 trials gives us reasonable confidence intervals while keeping benchmark time manageable. More trials would be better statistically but would increase testing time significantly.</dd>
          </div>

          <div>
            <dt className="font-bold text-lg">Q: Why median instead of mean?</dt>
            <dd className="text-slate-300 mt-1">A: Median is robust to outliers. If one trial has a weird result (model hallucination, API timeout), it won't skew the entire score. The median represents "typical" performance better.</dd>
          </div>

          <div>
            <dt className="font-bold text-lg">Q: How do you prevent gaming?</dt>
            <dd className="text-slate-300 mt-1">A: Multiple safeguards: (1) Tasks are not public, (2) Multiple trials with different seeds make it impossible to optimize for specific inputs, (3) Execution-based testing means code must actually work, (4) "Test Your Keys" feature lets anyone verify results independently.</dd>
          </div>

          <div>
            <dt className="font-bold text-lg">Q: What about prompt engineering?</dt>
            <dd className="text-slate-300 mt-1">A: We use standardized prompts across all models. The goal is to measure base model capability, not prompt optimization. This ensures fair comparison.</dd>
          </div>

          <div>
            <dt className="font-bold text-lg">Q: Can I see the raw data?</dt>
            <dd className="text-slate-300 mt-1">A: Yes! All data is accessible via our API, and the complete database schema is open source. You can also run benchmarks locally with the same tasks.</dd>
          </div>
        </dl>
      </section>

      <section className="border-t border-slate-700 pt-8">
        <h2>Current Limitations & Future Work</h2>
        
        <div className="grid md:grid-cols-2 gap-6 my-6">
          <div>
            <h3 className="text-lg font-bold mb-3">Current Limitations</h3>
            <ul className="text-sm text-slate-300 space-y-2">
              <li>• 5 trials may not be enough for very noisy models</li>
              <li>• Limited task diversity (expanding continuously)</li>
              <li>• Coding-focused (not evaluating general capabilities)</li>
              <li>• English language only</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-3">Planned Improvements</h3>
            <ul className="text-sm text-green-400 space-y-2">
              <li>✓ Adaptive sampling (more trials for uncertain cases)</li>
              <li>✓ Bayesian analysis for better uncertainty quantification</li>
              <li>✓ Expanded task set with more languages</li>
              <li>✓ Real-time error bars in charts</li>
              <li>✓ Statistical significance indicators between models</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="not-prose bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/50 p-6 rounded-lg my-8">
        <h2 className="text-2xl font-bold mb-4">Related Resources</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-bold mb-2">Technical Documentation</h3>
            <ul className="space-y-1">
              <li>• <a href="https://github.com/ionutvi/aistupidlevel.info" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">GitHub Repository</a></li>
              <li>• <Link href="/about" className="text-blue-400 hover:text-blue-300">About Us & Team</Link></li>
              <li>• <Link href="/faq" className="text-blue-400 hover:text-blue-300">Frequently Asked Questions</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-2">Try It Yourself</h3>
            <ul className="space-y-1">
              <li>• <Link href="/" className="text-blue-400 hover:text-blue-300">View Current Rankings</Link></li>
              <li>• <Link href="/compare" className="text-blue-400 hover:text-blue-300">Compare AI Models</Link></li>
              <li>• <Link href="/test" className="text-blue-400 hover:text-blue-300">Test Your API Keys</Link></li>
            </ul>
          </div>
        </div>
      </section>

      {/* HowTo Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HowTo",
            "name": "How to Benchmark AI Models for Performance Degradation",
            "description": "Technical guide to detecting AI model degradation using statistical methods and drift detection algorithms",
            "image": "https://aistupidlevel.info/og-image.png",
            "totalTime": "PT5M",
            "step": [
              {
                "@type": "HowToStep",
                "name": "Execute Multiple Trials",
                "text": "Run each AI model through coding tasks 5 times with different random seeds to capture natural variance",
                "position": 1
              },
              {
                "@type": "HowToStep",
                "name": "Calculate Confidence Intervals",
                "text": "Use t-distribution with df=4 to compute 95% confidence intervals for scoring accuracy",
                "position": 2
              },
              {
                "@type": "HowToStep",
                "name": "Apply Weighted Scoring",
                "text": "Combine 7 evaluation axes (correctness, spec adherence, code quality, efficiency, stability, refusal rate, recovery) with appropriate weights",
                "position": 3
              },
              {
                "@type": "HowToStep",
                "name": "Detect Drift with CUSUM",
                "text": "Apply Page-Hinkley CUSUM algorithm to identify sustained performance shifts over time",
                "position": 4
              },
              {
                "@type": "HowToStep",
                "name": "Calibrate Per Model",
                "text": "Adjust drift detection thresholds based on each model's historical variance for fair comparison",
                "position": 5
              }
            ]
          })
        }}
      />
    </article>
  );
}
