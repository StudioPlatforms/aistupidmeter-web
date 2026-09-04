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
    answer: "Sometimes, yes. Our drift detection system has identified multiple instances where AI models showed sustained performance degradation over 28-day periods. This can happen due to fine-tuning, safety updates, or infrastructure changes. However, not all models degrade — some remain stable or even improve. Our platform tracks these changes with statistical rigor so you can make informed decisions."
  },
  {
    category: "General",
    question: "How is this different from other AI benchmarks?",
    answer: "Most benchmarks (HumanEval, MMLU) show single measurements without uncertainty quantification. We run multiple trials (n=5) per model, calculate confidence intervals, and use statistical tests to distinguish real changes from noise. We also provide continuous monitoring with drift detection, not just one-time snapshots. Plus, everything is open source and independently verifiable."
  },
  {
    category: "General",
    question: "Is AI Stupid Level free to use?",
    answer: "The website is free and always will be — every ranking, chart and drift alert on aistupidlevel.info costs nothing and needs no account. The Data API also has a free tier, though it now requires a key (see /api-docs) after the open version was being used to republish our rankings elsewhere. Paid API tiers and the optional Smart Router subscription help fund the benchmark bill; no AI vendor pays us anything."
  },
  {
    category: "Methodology",
    question: "How do you score AI models?",
    answer: "The main coding suite uses a 9-axis scoring system: Correctness (40%), Complexity (20%), Code Quality (15%), Stability (10%), Efficiency (5%), Edge Cases (3%), Debugging (3%), Format (2%), and Safety (2%). Each model runs every task 5 times. We take the median and provide 95% confidence intervals using the t-distribution. Other suites score differently: the deep-reasoning suite adds four axes on top of those nine (memory retention, hallucination rate, plan coherence, context window) for 13 total, and the tool-calling suite uses its own 7 axes (task completion, tool selection, parameter accuracy, efficiency, error handling, context awareness, safety compliance)."
  },
  {
    category: "Methodology",
    question: "Why do you run 5 trials instead of just 1?",
    answer: "AI models are stochastic (probabilistic), meaning the same prompt can produce different outputs. A single measurement could be a lucky or unlucky result. Running 5 trials lets us: (1) capture natural variance, (2) calculate confidence intervals, (3) use the median to avoid outlier bias, and (4) estimate true performance more accurately. It's a balance between statistical rigor and computational cost."
  },
  {
    category: "Methodology",
    question: "What is drift detection and how does it work?",
    answer: "Drift detection identifies sustained performance changes over time. We use the CUSUM (Cumulative Sum) algorithm, which tracks cumulative deviations from a model's baseline. Unlike simple comparisons, CUSUM distinguishes between daily noise and actual trends. Each model has calibrated thresholds based on its historical variance — noisy models get higher thresholds to avoid false alarms."
  },
  {
    category: "Methodology",
    question: "What tasks do you use for benchmarking?",
    answer: "The main suite is 10 Python tasks covering algorithms (palindrome check, primality, binary search, merge intervals, Dijkstra, word break, regex matching), data structures (LRU cache), debugging a broken sort, and optimising a naive Fibonacci. Every submission is executed, not pattern-matched \u2014 it either passes the tests or it does not. The tool-calling suite runs 10 further tasks in real Docker sandboxes, and the deep-reasoning suite runs 4 multi-turn scenarios. The tasks are in our public GitHub repo, so you can read exactly what we ask and reproduce it with your own keys via Test Your Keys. We rotate prompt envelopes between runs so a model cannot benefit from having memorised one exact phrasing."
  },
  {
    category: "Methodology",
    question: "How accurate are your benchmarks?",
    answer: "We use 5-trial median scoring with 95% confidence intervals calculated using t-distribution (df=4). Our standard error is typically +/-1-3 points on a 100-point scale. For example, a score of \"24.8 +/- 1.3\" means we're 95% confident the true score is between 23.5 and 26.1. This is far more rigorous than single-shot benchmarks that show no uncertainty."
  },
  {
    category: "Methodology",
    question: "Why use median instead of mean?",
    answer: "Median is robust to outliers. If one trial produces an anomalous result (model hallucination, API timeout, random brilliance), it won't skew the entire score. The median represents typical performance better than the mean when dealing with small sample sizes and potential outliers."
  },
  {
    category: "Technical",
    question: "Can I verify your results myself?",
    answer: "Absolutely! Use our \"Test Your Keys\" feature to run the same benchmarks with your own API keys. You'll get the same tasks, same scoring, same methodology — proving we're not making up numbers. Additionally, all our code is open source on GitHub, so you can audit every algorithm and even run the full platform locally."
  },
  {
    category: "Technical",
    question: "Do you have an API?",
    answer: "Yes. The Public Data API at /api/v1 gives you current rankings, historical time-series, confidence intervals, degradation alerts and drift signatures. Endpoints include GET /api/v1/models (current scores), GET /api/v1/models/:id/history?period=7d (historical trends), and GET /api/v1/analytics/degradations (models currently degrading). It is free \u2014 create a key at /router/data-keys and send it as an Authorization header. Keys let us keep the API fast for everyone and stop the data being republished as someone else's leaderboard. Full reference at /api-docs."
  },
  {
    category: "Technical",
    question: "What are confidence intervals and why do they matter?",
    answer: "Confidence intervals show the range where we're 95% confident the true score lies. For example, \"24.8 +/- 1.3\" means [23.5, 26.1]. This matters because: (1) AI is probabilistic, (2) single measurements are unreliable, (3) you need to know measurement uncertainty to make decisions, and (4) overlapping intervals mean differences might not be statistically significant."
  },
  {
    category: "Technical",
    question: "How often do you update benchmarks?",
    answer: "Continuously, and every tracked model gets the same treatment \u2014 there is no priority list. The main coding suite runs every 4 hours, a fast 2-task canary suite runs every hour for rapid drift detection, the deep-reasoning suite runs daily at 03:00 UTC and the tool-calling suite daily at 04:00 UTC. Drift detection runs on every new score. All history is preserved, going back to our first benchmark in August 2025."
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
    answer: "Mostly out of pocket, offset by Pro subscriptions to the Smart Router, paid tiers of the Data API, and data licensing to non-vendor organisations. Community donations and sponsorships help. We explicitly refuse funding from AI model providers — that is the one line we will not cross, because the whole point of the site is that nobody scoring well has paid us."
  },
  {
    category: "Trust & Independence",
    question: "How can I trust your methodology?",
    answer: "Trust through verification, not claims: (1) All code is open source on GitHub, (2) Complete methodology documentation is public, (3) \"Test Your Keys\" lets you reproduce results, (4) The algorithms we use (Page-Hinkley change detection, t-distribution confidence intervals) are standard published methods, not something we invented, (5) every scoring weight and constant is a line you can read in the repo. To be clear about what this does not mean: the platform itself has not been through academic peer review. We would welcome it. Verify rather than trust us."
  },
  {
    category: "Using the Platform",
    question: "How do I choose the right AI model for my project?",
    answer: "Consider: (1) Task complexity — simple tasks = smaller models OK, (2) Budget — cost per token varies 10x between models, (3) Latency requirements — some models are faster, (4) Stability needs — check our drift alerts, (5) Specific strengths — see axis breakdowns. Use our comparison tool to evaluate trade-offs."
  },
  {
    category: "Using the Platform",
    question: "What do the different status alerts mean?",
    answer: "NORMAL = Performance within expected variance. WARNING = Slight decline detected, monitoring closely. DEGRADED = Sustained decline confirmed, statistically significant. CRITICAL = Major performance drop, immediate attention needed. Alerts are based on CUSUM drift detection calibrated per model."
  },
  {
    category: "Limitations & Future",
    question: "What are the current limitations?",
    answer: "Being straight about these: (1) the main suite is 10 Python tasks, so it measures coding ability, not general capability, and not other languages; (2) 5 trials catches ordinary variance but not rare tail behaviour; (3) everything is English-only; (4) scores measure the model as served through its public API, so a provider-side routing or quantisation change looks the same to us as a weights change — we can tell you performance moved, not always why; (5) the adversarial-safety, bias and prompt-robustness suites are running but their datasets are still young, so we do not draw conclusions from them yet — one day's result on any of the three is noise, and the methodology page shows their live row counts rather than our word for it."
  },
  {
    category: "Limitations & Future",
    question: "What features are coming next?",
    answer: "In rough order: (1) expanding the task set beyond Python, (2) adaptive sampling — more trials when a result is uncertain, (3) email and webhook drift alerts, (4) error bars drawn directly on the charts, (5) statistical significance markers between adjacent models, (6) publishing the adversarial-safety, bias and robustness data once each dataset is large enough to mean something, (7) provider hub pages. No dates promised — this is a small operation and the benchmark bill is real."
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
