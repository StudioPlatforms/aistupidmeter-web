import type { Metadata } from 'next';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';

export const metadata: Metadata = {
  title: 'FAQ | AI Benchmarking Questions Answered',
  description: 'Frequently asked questions about AI model benchmarking, performance testing, drift detection, and our methodology. Learn how we measure AI stupid levels objectively.',
  keywords: [
    'AI benchmarking FAQ', 'How to measure AI performance', 'Are AI models getting worse',
    'AI drift detection explained', 'LLM benchmarking questions', 'AI performance testing FAQ',
    'How AI benchmarks work'
  ],
  alternates: { canonical: '/faq' },
  openGraph: {
    title: 'Frequently Asked Questions | AI Benchmarking',
    description: 'Common questions about AI model benchmarking, performance testing, and drift detection answered.',
    url: 'https://aistupidlevel.info/faq',
    type: 'website',
  }
};

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqs: FAQItem[] = [
  {
    category: "General",
    question: "What is AI Stupid Level?",
    answer: "AI Stupid Level is an independent benchmarking platform that monitors AI model performance over time. We run real coding tasks across multiple models to measure their capabilities objectively, detecting performance changes (\"drift\") that might otherwise go unnoticed. Think of us as a watchdog for AI quality."
  },
  {
    category: "General",
    question: "Are AI models really getting worse over time?",
    answer: "Sometimes, and we are careful about what we claim to have seen. Providers do change served models without announcement — fine-tuning, safety updates, routing and quantisation changes — and scores on this site do move. But in September 2026 we audited our own alarm history and withdrew 492 incidents raised by an earlier rule that had no test of significance; the detectors that replaced it need ten days of stable history before they can fire, and as of mid-September no detection has yet been confirmed under the current design. So the honest answer is: the platform now measures carefully enough to catch a sustained decline of a few points, and has not yet had the chance to catch one. When it does, the drift page will say so with the statistic behind it."
  },
  {
    category: "General",
    question: "How is this different from other AI benchmarks?",
    answer: "Most benchmarks (HumanEval, MMLU) show single measurements without uncertainty quantification. We run seven trials per coding task, publish a standard error for every number on the board, and rank by a two-sample test so that two models inside each other's noise share a rank instead of being separated by a place the measurement cannot support. We also provide continuous monitoring with change-point drift detection on each suite's own daily series, not just one-time snapshots. Every scoring weight, threshold and statistical method is published, and you can reproduce our scoring with your own API keys."
  },
  {
    category: "General",
    question: "Is AI Stupid Level free to use?",
    answer: "The evidence is free. Current scores, every category ranking (coding, reasoning, tool-calling, price), seven days of history, the methodology and the freshness of each measurement all cost nothing and need no account. With a free account you can also track three models and get a weekly summary of what changed. Paid plans buy depth and workflow rather than access: longer history, the drift curve and axis breakdown behind an alert, more tracked models, exports, custom thresholds and team features. The Data API has a free tier too, though it now requires a key (see /api-docs) after the open version was being used to republish our rankings elsewhere. Subscriptions and paid API tiers fund the benchmark bill; no AI vendor pays us anything."
  },
  {
    category: "Methodology",
    question: "How do you score AI models?",
    answer: "The coding suite scores nine axes and combines them as a plain weighted mean: Correctness (55%), Stability (10%), Edge Cases (10%), Debugging (10%), Code Quality (5%), Efficiency (5%), Format (3%), Safety (2%) and Complexity (0% — measured and shown, but it moved nobody's rank, so it no longer pretends to). Correctness on the repo-debugging tasks is graded by running the project's own test suite, including tests the model never sees. Each model runs every task 7 times. There is no exponent, gate or penalty curve anywhere in the formula — every one that used to be there was removed in September 2026 after two identical sweeps showed the curve, not the models, was producing 47-point swings. Other suites score differently: the deep-reasoning suite scores five axes of its own — correctness, recovery after a failed coding step, and three continuity axes (memory retention, plan coherence, context window). Since 23 September 2026 the continuity axes are checked by running code, not by matching words: requirements stated once in the conversation, some of them partway through, and the design decisions a model declares in its own plan are tested at every later step. Six earlier reasoning axes were retracted in September 2026 because they measured response length, a keyword, or nothing at all, and debugging was folded into correctness. The tool-calling suite uses its own 7 axes (task completion, tool selection, parameter accuracy, efficiency, error handling, context awareness, safety compliance)."
  },
  {
    category: "Methodology",
    question: "Why do you run 7 trials instead of just 1?",
    answer: "AI models are stochastic (probabilistic), meaning the same prompt can produce different outputs. A single measurement could be a lucky or unlucky result. Running 7 trials lets us: (1) capture natural variance, (2) calculate confidence intervals, (3) use the median to avoid outlier bias, and (4) estimate true performance more accurately. It's a balance between statistical rigor and computational cost."
  },
  {
    category: "Methodology",
    question: "What is drift detection and how does it work?",
    answer: "Two detectors, and we are explicit about what each can see. For sustained change we use the Page-Hinkley test, a cumulative-sum (CUSUM-family) change detector, on each suite's own daily series — coding, tool use and reasoning each carry their own statistic, never a blend of them, and a model's status takes the largest. It accumulates how far each day falls below the running mean, less a small tolerance, so daily noise cancels out while a real sustained decline builds up until it crosses the alarm threshold; it restarts whenever a suite's configuration changes and needs ten days of history before it can fire. For fast change we run an hourly canary — two fixed probes, two trials each — and test the last 6 hours and the last 24 hours against the prior week on the same configuration with Welch's t-test; an incident needs a fall of at least 12 points at p < 0.01, and closes itself when the gap does. Every constant, and the measured false-alarm and detection rates behind each, is on the methodology page."
  },
  {
    category: "Methodology",
    question: "What tasks do you use for benchmarking?",
    answer: "The coding suite hands a model a small working project and a bug report written as a user complaint — no file is named, so it has to find the defect itself — and grades the fix by running the project's own test suite, including tests the model never sees. All seven coding tasks run every sweep: six repo debugging tasks and one hard single-function task. Everything is executed, not pattern-matched. We retire what stops measuring: eight single-function tasks went in early September 2026 after hitting 99-100% pass rates across all 24 models, and on 14 September two trivial floor checks and one repo task went the same way, while one new repo task was added after it failed 79% of the fleet in three validation rounds. A task everybody passes ranks nobody. New tasks now have to clear a stated bar before they count: every hidden assertion must trace to the bug report, and at least a fifth of the fleet must fail across three independent runs. The tool-calling suite runs nine further tasks in real Docker sandboxes, nine sessions per model per day, and the deep-reasoning suite runs four multi-turn scenarios — all four every day since 13 September 2026, so consecutive days compare the same work. The hidden tests are the one thing we keep back — without them, a fix that silences the reported symptom and leaves the defect in place scores full marks."
  },
  {
    category: "Methodology",
    question: "How accurate are your benchmarks?",
    answer: "Every number on the board carries a standard error measured from its own run-to-run repeatability: each suite's last five measured runs on its current configuration, combined with the composite's weights. On the coding suite alone, two identical sweeps of the whole fleet differ by about 2 points on average, and the median model does not move at all; the composite's standard error is typically 2–3 points on a 100-point scale, and the interval shown is ±1.96 standard errors. So \"86 ± 4.5\" means the same model re-measured tomorrow would land in that range 95% of the time. The day after any configuration change there are not yet five runs to measure, and the suite's typical spread is used instead — the methodology page says which. This is far more rigorous than single-shot benchmarks that show no uncertainty, and it is why adjacent places on the leaderboard are often ties."
  },
  {
    category: "Methodology",
    question: "Why use median instead of mean?",
    answer: "Median is robust to outliers. If one trial produces an anomalous result (model hallucination, API timeout, random brilliance), it won't skew the entire score. The median represents typical performance better than the mean when dealing with small sample sizes and potential outliers."
  },
  {
    category: "Technical",
    question: "Can I verify your results myself?",
    answer: "Absolutely! Use our \"Test Your Keys\" feature to run the same benchmarks with your own API keys: the same tasks, scored by the same code as our published runs, and compared with our figure only when ours came from the same version of the test. One difference is stated with every result: our coding figure makes seven attempts per task, where your run makes one. The web application is also open source. The benchmark repository is not: when it was public, providers optimised against the specific tasks, and a test that can be studied in advance stops measuring anything. The method is published in full regardless."
  },
  {
    category: "Technical",
    question: "Do you have an API?",
    answer: "Yes. The Public Data API at /api/v1 gives you current rankings, historical time-series, confidence intervals, degradation alerts and drift signatures. Endpoints include GET /api/v1/models (current scores), GET /api/v1/models/:id/history?period=7d (historical trends), and GET /api/v1/analytics/degradations (models currently degrading). It is free \u2014 create a key at /account/data-keys and send it as an Authorization header. Keys let us keep the API fast for everyone and stop the data being republished as someone else's leaderboard. Full reference at /api-docs."
  },
  {
    category: "Technical",
    question: "What are confidence intervals and why do they matter?",
    answer: "Confidence intervals show the range where we're 95% confident the true score lies. For example, \"86 ± 4.5\" means [81.5, 90.5]. This matters because: (1) AI is probabilistic, (2) single measurements are unreliable, (3) you need to know measurement uncertainty to make decisions, and (4) a difference smaller than the noise is not a difference. The leaderboard applies that last point to the ranks themselves: a model's rank is 1 + the number of models that lead it by more than 1.96 × the combined standard error of the pair, so models inside each other's noise share a rank, shown as \"=N\"."
  },
  {
    category: "Technical",
    question: "How often do you update benchmarks?",
    answer: "Continuously, and every tracked model gets the same treatment — there is no priority list. The main coding suite runs every 4 hours; a canary (two fixed probes, two trials each) runs every hour; the deep-reasoning suite runs daily at 03:00 and the tool-calling suite daily at 04:00 Berlin time (01:00 and 02:00 UTC). Drift detection runs on every new score. All history is preserved, going back to our first benchmark in August 2025."
  },
  {
    category: "Comparisons",
    question: "Which AI model is best for coding?",
    answer: "It changes often, which is rather the point of the site — so check the live rankings rather than trusting a number written into an FAQ. We track roughly two dozen models across 6 providers (OpenAI, Anthropic, Google, DeepSeek, Kimi and GLM), and the top few are usually separated by a handful of points — often less than the confidence interval. Sort by Coding, Reasoning, Speed, Price or Tool-calling to see how the order changes by task type — \"best\" genuinely depends on which you mean."
  },
  {
    category: "Comparisons",
    question: "How does GPT compare to Claude?",
    answer: "Both families sit at the top and trade places regularly. Rather than quote a snapshot that will be out of date within weeks, use the /compare page — it puts any two models head to head with their confidence intervals, so you can see whether a gap is real or just noise. Overlapping intervals mean the difference is not statistically significant, however convincing the ranking order looks."
  },
  {
    category: "Comparisons",
    question: "Are smaller/cheaper models worth using?",
    answer: "Often, yes. Smaller models routinely land within a few points of flagship models on straightforward coding work, at a fraction of the cost per token. The Price sort on the leaderboard ranks score against list price so you can see the trade-off directly, and the per-axis breakdown on each model page shows exactly which capability you give up — usually complexity handling and edge cases before raw correctness."
  },
  {
    category: "Trust & Independence",
    question: "Do AI companies pay you to rank them higher?",
    answer: "No. We have zero financial relationships with OpenAI, Anthropic, Google, DeepSeek, Moonshot, Zhipu or any other model provider. We don't accept vendor sponsorships, we don't earn affiliate commissions, and every benchmark runs on our own infrastructure using API keys we pay for. Rankings are purely merit-based."
  },
  {
    category: "Trust & Independence",
    question: "How do you fund this platform?",
    answer: "Venture funding, plus revenue from Pro subscriptions to the Smart Router, paid tiers of the Data API, and data licensing to non-vendor organisations. No AI model provider funds us and none of our investors is one — that is the one line we will not cross, because the whole point of the site is that nobody scoring well has paid us."
  },
  {
    category: "Trust & Independence",
    question: "How can I trust your methodology?",
    answer: "Trust through verification, not claims: (1) Complete methodology documentation is public, including every scoring weight and drift constant, (2) \"Test Your Keys\" lets you reproduce our scoring with your own API keys, (3) the algorithms we use (Page-Hinkley change detection, t-distribution confidence intervals) are standard published methods, not something we invented, (4) the web application is open source. What we deliberately do not publish is the benchmark task bank — when it was public, providers optimised against the specific tasks, which destroys the measurement. Our methodology paper is currently under peer review, and a SOC 2 Type II audit is in progress. Verify rather than trust us."
  },
  {
    category: "Using the Platform",
    question: "How do I choose the right AI model for my project?",
    answer: "Consider: (1) Task complexity — simple tasks = smaller models OK, (2) Budget — cost per token varies 10x between models, (3) Latency requirements — some models are faster, (4) Stability needs — check our drift alerts, (5) Specific strengths — see axis breakdowns. Use our comparison tool to evaluate trade-offs."
  },
  {
    category: "Using the Platform",
    question: "What do the different status alerts mean?",
    answer: "NORMAL = every suite's drift statistic is below its warning line. WARNING = a suite's Page-Hinkley statistic is more than halfway to its alarm threshold, or the model's recent scores are unusually spread. ALERT = a suite's statistic crossed the alarm threshold, or the model is measurably below its own baseline on its current configuration. Those come from the per-suite Page-Hinkley test; separately, the hourly canary raises an incident when a model's probe mean falls by at least 12 points against the prior week at p < 0.01, and resolves it when the gap closes. Incidents raised before 13 September 2026 by an earlier detector with no significance test were retracted and are excluded from every count on the site; the methodology page says how many and why."
  },
  {
    category: "Limitations & Future",
    question: "What are the current limitations?",
    answer: "Being straight about these: (1) the coding suite is seven Python tasks a cycle, so it measures debugging and coding ability, not general capability, and not other languages; (2) 7 trials catches ordinary variance but not rare tail behaviour, and a model that solves a task about half the time will still move a few points between runs; (3) everything is English-only; (4) scores measure the model as served through its public API, so a provider-side routing or quantisation change looks the same to us as a weights change \u2014 we can tell you performance moved, not always why; (5) some providers decline some prompts, including entirely benign ones; we drop the declined task rather than scoring it zero, but that means such a model was measured on a narrower and on average easier corpus, so those rows show their coverage under the score (5/7 tasks, say) and are never called tied with a model measured on all of them; (6) the adversarial-safety, bias and prompt-robustness suites are running but their datasets are still young, so we do not draw conclusions from them yet."
  },
  {
    category: "Limitations & Future",
    question: "What features are coming next?",
    answer: "In rough order: (1) expanding the task set beyond Python, (2) adaptive sampling — more trials when a result is uncertain, (3) email and webhook drift alerts, (4) error bars drawn directly on the charts, (5) publishing the adversarial-safety, bias and robustness data once each dataset is large enough to mean something, (6) provider hub pages. Statistical ties between adjacent models, which used to be on this list, shipped in September 2026. No dates promised — this is a small operation and the benchmark bill is real."
  }
];

const categories = Array.from(new Set(faqs.map(f => f.category)));

const CATEGORY_COLORS: Record<string, string> = {
  'General': 'var(--phosphor-green, #1a73e8)',
  'Methodology': '#1a73e8',
  'Technical': '#8a2be2',
  'Comparisons': 'var(--amber-warning, #ffb000)',
  'Trust & Independence': 'var(--phosphor-green, #1a73e8)',
  'Using the Platform': '#1a73e8',
  'Limitations & Future': 'var(--amber-warning, #ffb000)',
};

export default function FAQPage() {
  const pageStyle: React.CSSProperties = {
    background: 'var(--terminal-black, #f6f8fc)',
    minHeight: '100vh',
    fontFamily: 'var(--font-mono, "Courier New", monospace)',
    color: 'var(--phosphor-dim)',
  };
  const containerStyle: React.CSSProperties = {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '32px 20px 80px',
  };

  return (
    <SubpageLayout>
      <div style={pageStyle}>
        <div style={containerStyle}>
          {/* Semantic <h1>: this was a styled <div>, so the page shipped with no
              heading at all for crawlers. margin:0 keeps the original look. */}
          <h1 style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 'bold', color: 'var(--phosphor-green, #1a73e8)', letterSpacing: '2px', textShadow: '0 0 8px rgba(26, 115, 232,0.4)', margin: '0 0 8px' }}>
            AI Benchmarking FAQ — Drift Detection, Model Degradation &amp; Scoring<span className="blinking-cursor"></span>
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--phosphor-dim, #5f6368)', marginBottom: '24px', letterSpacing: '0.3px' }}>
            Everything you need to know about AI model benchmarking, performance testing, and our methodology.
          </div>

          {/* Category navigation */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '12px 14px',
            background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(192,192,192,0.15)',
            borderRadius: '3px', marginBottom: '24px',
          }}>
            <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)', fontWeight: 'bold', letterSpacing: '0.8px', textTransform: 'uppercase', alignSelf: 'center', marginRight: '4px' }}>
              JUMP TO:
            </span>
            {categories.map(cat => (
              <a
                key={cat}
                href={`#${cat.toLowerCase().replace(/\s+/g, '-').replace(/&/g, '')}`}
                style={{
                  fontSize: '10px',
                  padding: '4px 10px',
                  background: 'rgba(0,0,0,0.04)',
                  border: `1px solid ${CATEGORY_COLORS[cat] || 'rgba(26, 115, 232,0.25)'}44`,
                  color: CATEGORY_COLORS[cat] || 'var(--phosphor-green)',
                  textDecoration: 'none',
                  borderRadius: '2px',
                  fontWeight: 'bold',
                  letterSpacing: '0.3px',
                  transition: 'all 0.15s',
                  textTransform: 'uppercase',
                }}
              >
                {cat}
              </a>
            ))}
          </div>

          {/* FAQ by category */}
          {categories.map(category => {
            const categoryFaqs = faqs.filter(f => f.category === category);
            const color = CATEGORY_COLORS[category] || 'var(--phosphor-green)';
            return (
              <section
                key={category}
                id={category.toLowerCase().replace(/\s+/g, '-').replace(/&/g, '')}
                style={{ marginBottom: '28px' }}
              >
                {/* Category header */}
                {/* Category heading as a real <h2> so crawlers can see the
                    page's topic structure. */}
                <h2 style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  paddingBottom: '10px', margin: '0 0 12px',
                  borderBottom: `2px solid ${color}33`,
                  fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
                  letterSpacing: '1.5px', color,
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    [&rarr;]
                  </span>
                  {category}
                </h2>

                {/* FAQ items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {categoryFaqs.map((faq, index) => (
                    <div key={index} style={{
                      background: 'rgba(0,0,0,0.04)',
                      border: '1px solid rgba(192,192,192,0.12)',
                      borderLeft: `3px solid ${color}66`,
                      borderRadius: '3px',
                      padding: '14px 16px',
                    }}>
                      <div style={{
                        display: 'flex', gap: '8px', alignItems: 'flex-start',
                        marginBottom: '8px',
                      }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 'bold', color,
                          fontFamily: 'var(--font-mono)', flexShrink: 0, marginTop: '1px',
                        }}>Q:</span>
                        {/* Each question is an <h3>. Google reads FAQ headings
                            directly and they back the FAQPage structured data. */}
                        <h3 style={{
                          fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-dim)',
                          lineHeight: '1.4', margin: 0,
                        }}>
                          {faq.question}
                        </h3>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)',
                          fontFamily: 'var(--font-mono)', flexShrink: 0, marginTop: '1px',
                        }}>A:</span>
                        <span style={{
                          fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.65',
                        }}>
                          {faq.answer}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          {/* Still have questions */}
          <div style={{
            background: 'rgba(26, 115, 232,0.04)',
            border: '2px solid rgba(26, 115, 232,0.3)',
            borderRadius: '3px',
            padding: '20px',
            marginTop: '12px',
            marginBottom: '20px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--phosphor-green)', letterSpacing: '1.5px', marginBottom: '10px', textShadow: '0 0 6px rgba(26, 115, 232,0.4)' }}>
              STILL HAVE QUESTIONS?
            </div>
            <div style={{ fontSize: '11px', color: 'var(--phosphor-dim)', marginBottom: '14px' }}>
              Can't find what you're looking for? We're here to help.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              {[
                { title: 'READ DOCUMENTATION', desc: 'Detailed technical docs of our methodology', href: '/router/docs', internal: true },
                { title: 'JOIN DISCUSSION', desc: 'Ask questions and discuss with the community', href: 'https://www.reddit.com/r/AIStupidLevel/', internal: false },
                { title: 'FOLLOW UPDATES', desc: 'Get the latest news and announcements', href: 'https://twitter.com/AIStupidlevel', internal: false },
              ].map((item, i) => (
                item.internal
                  ? <Link key={i} href={item.href} style={{
                      background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(26, 115, 232,0.15)', borderRadius: '2px',
                      padding: '12px', display: 'block', textDecoration: 'none',
                    }}>
                      <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>{item.title} &rarr;</div>
                      <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.4' }}>{item.desc}</div>
                    </Link>
                  : <a key={i} href={item.href} target="_blank" rel="noopener noreferrer" style={{
                      background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(26, 115, 232,0.15)', borderRadius: '2px',
                      padding: '12px', display: 'block', textDecoration: 'none',
                    }}>
                      <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>{item.title} &rarr;</div>
                      <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.4' }}>{item.desc}</div>
                    </a>
              ))}
            </div>
          </div>

          {/* Explore more */}
          <div style={{
            background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(192,192,192,0.12)',
            borderRadius: '3px', padding: '14px 16px', marginBottom: '20px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--amber-warning)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
              EXPLORE MORE
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                { label: 'VIEW CURRENT RANKINGS', href: '/', internal: true },
                { label: 'COMPARE AI MODELS', href: '/compare', internal: true },
                { label: 'READ METHODOLOGY', href: '/methodology', internal: true },
                { label: 'ABOUT OUR TEAM', href: '/about', internal: true },
                { label: 'TEST YOUR KEYS', href: '/router/test-keys', internal: true },
                { label: 'VIEW SOURCE CODE', href: 'https://github.com/StudioPlatforms/aistupidmeter-web', internal: false },
              ].map((item, i) => (
                item.internal
                  ? <Link key={i} href={item.href} style={{
                      fontSize: '10px', fontWeight: 'bold',
                      color: 'var(--phosphor-green)', textDecoration: 'none',
                      padding: '5px 10px',
                      border: '1px solid rgba(26, 115, 232,0.2)',
                      borderRadius: '2px',
                      background: 'rgba(0,0,0,0.04)',
                      letterSpacing: '0.4px',
                    }}>
                      {item.label} &rarr;
                    </Link>
                  : <a key={i} href={item.href} target="_blank" rel="noopener noreferrer" style={{
                      fontSize: '10px', fontWeight: 'bold',
                      color: 'var(--phosphor-green)', textDecoration: 'none',
                      padding: '5px 10px',
                      border: '1px solid rgba(26, 115, 232,0.2)',
                      borderRadius: '2px',
                      background: 'rgba(0,0,0,0.04)',
                      letterSpacing: '0.4px',
                    }}>
                      {item.label} &rarr;
                    </a>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', textAlign: 'center', paddingTop: '16px', borderTop: '1px solid rgba(192,192,192,0.12)' }}>
            AI Stupid Level &bull; Independent benchmarking since 2025 &bull; <Link href="/" style={{ color: 'var(--phosphor-green)', textDecoration: 'none', fontWeight: 'bold' }}>View Rankings</Link>
          </div>
        </div>

        {/* FAQ Schema.org */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": faqs.map(faq => ({
                "@type": "Question",
                "name": faq.question,
                "acceptedAnswer": { "@type": "Answer", "text": faq.answer }
              }))
            })
          }}
        />
      </div>
    </SubpageLayout>
  );
}
