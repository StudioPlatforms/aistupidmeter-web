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
  openGraph: {
    title: 'Frequently Asked Questions | AI Benchmarking',
    description: 'Common questions about AI model benchmarking, performance testing, and drift detection answered.',
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
    answer: "Yes! All benchmark data, historical trends, and analysis are completely free. We also provide a public API for developers who want to integrate our data into their own tools. The platform is supported by community donations and grants, not by AI vendors."
  },
  {
    category: "Methodology",
    question: "How do you score AI models?",
    answer: "We use a 7-axis scoring system: Correctness (35%), Spec Adherence (15%), Code Quality (15%), Efficiency (10%), Stability (10%), Refusal Rate (10%), and Recovery (5%). Each model runs coding tasks 5 times with different random seeds. We calculate the median score and provide 95% confidence intervals using t-distribution."
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
    answer: "We use real-world coding tasks in Python and TypeScript, covering algorithm implementation, debugging, code refactoring, optimization, and error recovery. Tasks are not publicly disclosed to prevent gaming. They represent practical problems developers face daily, not academic puzzles. You can verify tasks by running benchmarks with your own API keys."
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
    answer: "Yes! Our API provides access to current rankings, historical data, confidence intervals, and drift alerts. Endpoints include: GET /api/dashboard (current scores), GET /api/dashboard?period=7d (historical trends), and GET /api/models/:id (detailed model data). All data is free to access."
  },
  {
    category: "Technical",
    question: "What are confidence intervals and why do they matter?",
    answer: "Confidence intervals show the range where we're 95% confident the true score lies. For example, \"24.8 +/- 1.3\" means [23.5, 26.1]. This matters because: (1) AI is probabilistic, (2) single measurements are unreliable, (3) you need to know measurement uncertainty to make decisions, and (4) overlapping intervals mean differences might not be statistically significant."
  },
  {
    category: "Technical",
    question: "How often do you update benchmarks?",
    answer: "We run benchmarks continuously, with most models tested multiple times per week. High-priority models (GPT-5, Claude Opus 4, Gemini 2.5 Pro) are tested daily. Historical data is preserved so you can track performance over weeks, months, or years. Drift detection runs automatically on each new benchmark."
  },
  {
    category: "Comparisons",
    question: "Which AI model is best for coding?",
    answer: "It depends on your specific needs, but currently top performers include OpenAI's GPT-5 and o3, Anthropic's Claude Opus 4, and Google's Gemini 2.5 Pro. Check our live rankings for current scores with confidence intervals. Remember: \"best\" varies by task type — some models excel at algorithms while others are better at refactoring."
  },
  {
    category: "Comparisons",
    question: "How does GPT compare to Claude?",
    answer: "Both GPT-5 and Claude Opus 4 are top-tier models with different strengths. GPT-5 typically scores higher on correctness and algorithmic tasks, while Claude Opus 4 excels at code quality and following specifications. Check our /compare page for detailed head-to-head analysis with statistical significance tests."
  },
  {
    category: "Comparisons",
    question: "Are smaller/cheaper models worth using?",
    answer: "Depends on your use case. Models like GPT-4o-mini or Claude Sonnet 4 offer 80-90% of flagship performance at 1/10th the cost. For production applications with high volume, they're often the better economic choice. Our benchmarks show which capabilities you sacrifice for the cost savings."
  },
  {
    category: "Trust & Independence",
    question: "Do AI companies pay you to rank them higher?",
    answer: "No. We have zero financial relationships with OpenAI, Anthropic, Google, xAI, or any AI model provider. We don't accept sponsorships from vendors, we don't earn affiliate commissions, and all benchmarks run on our own infrastructure with our own API keys. Our rankings are purely merit-based."
  },
  {
    category: "Trust & Independence",
    question: "How do you fund this platform?",
    answer: "Through community donations, sponsorships from non-vendor companies, and research grants for AI evaluation projects. We explicitly refuse funding from AI model providers to maintain independence. All financial relationships are disclosed publicly."
  },
  {
    category: "Trust & Independence",
    question: "How can I trust your methodology?",
    answer: "Trust through verification, not claims: (1) All code is open source on GitHub, (2) Complete methodology documentation is public, (3) \"Test Your Keys\" lets you reproduce results, (4) Statistical methods are peer-reviewed, (5) Community can audit everything. We want you to verify, not just trust."
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
    answer: "Main limitations: (1) 5 trials may not capture extreme variance, (2) Coding-focused (not general capabilities), (3) English language only, (4) Limited task diversity (expanding), (5) Confidence intervals not yet shown in all UI elements. We're actively working on all of these."
  },
  {
    category: "Limitations & Future",
    question: "What features are coming next?",
    answer: "Roadmap includes: (1) Adaptive sampling — more trials for uncertain cases, (2) Expanded task set with more languages, (3) Real-time error bars in charts, (4) Email/webhook drift alerts, (5) Statistical significance indicators between models, (6) Bayesian analysis for better uncertainty quantification, (7) Provider hub pages with vendor analysis."
  }
];

const categories = Array.from(new Set(faqs.map(f => f.category)));

const CATEGORY_COLORS: Record<string, string> = {
  'General': 'var(--phosphor-green, #00ff41)',
  'Methodology': '#00bfff',
  'Technical': '#8a2be2',
  'Comparisons': 'var(--amber-warning, #ffb000)',
  'Trust & Independence': 'var(--phosphor-green, #00ff41)',
  'Using the Platform': '#00bfff',
  'Limitations & Future': 'var(--amber-warning, #ffb000)',
};

export default function FAQPage() {
  const pageStyle: React.CSSProperties = {
    background: 'var(--terminal-black, #0a0a0a)',
    minHeight: '100vh',
    fontFamily: 'var(--font-mono, "Courier New", monospace)',
    color: 'var(--metal-silver, #c0c0c0)',
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
          <div style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 'bold', color: 'var(--phosphor-green, #00ff41)', letterSpacing: '2px', textShadow: '0 0 8px rgba(0,255,65,0.4)', marginBottom: '8px' }}>
            FREQUENTLY ASKED QUESTIONS<span className="blinking-cursor"></span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--phosphor-dim, #4a7a4a)', marginBottom: '24px', letterSpacing: '0.3px' }}>
            Everything you need to know about AI model benchmarking, performance testing, and our methodology.
          </div>

          {/* Category navigation */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '12px 14px',
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(192,192,192,0.15)',
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
                  background: 'rgba(0,0,0,0.4)',
                  border: `1px solid ${CATEGORY_COLORS[cat] || 'rgba(0,255,65,0.25)'}44`,
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
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  paddingBottom: '10px', marginBottom: '12px',
                  borderBottom: `2px solid ${color}33`,
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color }}>
                    [&rarr;]
                  </span>
                  <span style={{
                    fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
                    letterSpacing: '1.5px', color,
                  }}>
                    {category}
                  </span>
                </div>

                {/* FAQ items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {categoryFaqs.map((faq, index) => (
                    <div key={index} style={{
                      background: 'rgba(0,0,0,0.3)',
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
                        <span style={{
                          fontSize: '11px', fontWeight: 'bold', color: 'var(--metal-silver, #c0c0c0)',
                          lineHeight: '1.4',
                        }}>
                          {faq.question}
                        </span>
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
            background: 'rgba(0,255,65,0.04)',
            border: '2px solid rgba(0,255,65,0.3)',
            borderRadius: '3px',
            padding: '20px',
            marginTop: '12px',
            marginBottom: '20px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--phosphor-green)', letterSpacing: '1.5px', marginBottom: '10px', textShadow: '0 0 6px rgba(0,255,65,0.4)' }}>
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
                      background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,65,0.15)', borderRadius: '2px',
                      padding: '12px', display: 'block', textDecoration: 'none',
                    }}>
                      <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>{item.title} &rarr;</div>
                      <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.4' }}>{item.desc}</div>
                    </Link>
                  : <a key={i} href={item.href} target="_blank" rel="noopener noreferrer" style={{
                      background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,65,0.15)', borderRadius: '2px',
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
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(192,192,192,0.12)',
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
                      border: '1px solid rgba(0,255,65,0.2)',
                      borderRadius: '2px',
                      background: 'rgba(0,0,0,0.3)',
                      letterSpacing: '0.4px',
                    }}>
                      {item.label} &rarr;
                    </Link>
                  : <a key={i} href={item.href} target="_blank" rel="noopener noreferrer" style={{
                      fontSize: '10px', fontWeight: 'bold',
                      color: 'var(--phosphor-green)', textDecoration: 'none',
                      padding: '5px 10px',
                      border: '1px solid rgba(0,255,65,0.2)',
                      borderRadius: '2px',
                      background: 'rgba(0,0,0,0.3)',
                      letterSpacing: '0.4px',
                    }}>
                      {item.label} &rarr;
                    </a>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', textAlign: 'center', paddingTop: '16px', borderTop: '1px solid rgba(192,192,192,0.12)' }}>
            AI Stupid Level &bull; Independent benchmarking since 2024 &bull; <Link href="/" style={{ color: 'var(--phosphor-green)', textDecoration: 'none', fontWeight: 'bold' }}>View Rankings</Link>
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
