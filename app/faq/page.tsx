import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'FAQ | AI Benchmarking Questions Answered',
  description: 'Frequently asked questions about AI model benchmarking, performance testing, drift detection, and our methodology. Learn how we measure AI stupid levels objectively.',
  keywords: [
    'AI benchmarking FAQ',
    'How to measure AI performance',
    'Are AI models getting worse',
    'AI drift detection explained',
    'LLM benchmarking questions',
    'AI performance testing FAQ',
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
  // General Questions
  {
    category: "General",
    question: "What is AI Stupid Level?",
    answer: "AI Stupid Level is an independent benchmarking platform that monitors AI model performance over time. We run real coding tasks across multiple models to measure their capabilities objectively, detecting performance changes (\"drift\") that might otherwise go unnoticed. Think of us as a watchdog for AI quality."
  },
  {
    category: "General",
    question: "Are AI models really getting worse over time?",
    answer: "Sometimes, yes. Our drift detection system has identified multiple instances where AI models showed sustained performance degradation over 28-day periods. This can happen due to fine-tuning, safety updates, or infrastructure changes. However, not all models degrade—some remain stable or even improve. Our platform tracks these changes with statistical rigor so you can make informed decisions."
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

  // Methodology Questions
  {
    category: "Methodology",
    question: "How do you score AI models?",
    answer: "We use a 7-axis scoring system: Correctness (30%), Spec Adherence (20%), Code Quality (15%), Efficiency (10%), Stability (10%), Refusal Rate (10%), and Recovery (5%). Each model runs coding tasks 5 times with different random seeds. We calculate the median score and provide 95% confidence intervals using t-distribution. Lower scores = better performance (less \"stupid\")."
  },
  {
    category: "Methodology",
    question: "Why do you run 5 trials instead of just 1?",
    answer: "AI models are stochastic (probabilistic), meaning the same prompt can produce different outputs. A single measurement could be a lucky or unlucky result. Running 5 trials lets us: (1) capture natural variance, (2) calculate confidence intervals, (3) use the median to avoid outlier bias, and (4) estimate true performance more accurately. It's a balance between statistical rigor and computational cost."
  },
  {
    category: "Methodology",
    question: "What is drift detection and how does it work?",
    answer: "Drift detection identifies sustained performance changes over time. We use the CUSUM (Cumulative Sum) algorithm, which tracks cumulative deviations from a model's baseline. Unlike simple comparisons, CUSUM distinguishes between daily noise and actual trends. Each model has calibrated thresholds based on its historical variance—noisy models get higher thresholds to avoid false alarms."
  },
  {
    category: "Methodology",
    question: "What tasks do you use for benchmarking?",
    answer: "We use real-world coding tasks in Python and TypeScript, covering algorithm implementation, debugging, code refactoring, optimization, and error recovery. Tasks are not publicly disclosed to prevent gaming. They represent practical problems developers face daily, not academic puzzles. You can verify tasks by running benchmarks with your own API keys."
  },
  {
    category: "Methodology",
    question: "How accurate are your benchmarks?",
    answer: "We use 5-trial median scoring with 95% confidence intervals calculated using t-distribution (df=4). Our standard error is typically ±1-3 points on a 100-point scale. For example, a score of \"24.8 ± 1.3\" means we're 95% confident the true score is between 23.5 and 26.1. This is far more rigorous than single-shot benchmarks that show no uncertainty."
  },
  {
    category: "Methodology",
    question: "Why use median instead of mean?",
    answer: "Median is robust to outliers. If one trial produces an anomalous result (model hallucination, API timeout, random brilliance), it won't skew the entire score. The median represents \"typical\" performance better than the mean when dealing with small sample sizes and potential outliers."
  },

  // Technical Questions
  {
    category: "Technical",
    question: "Can I verify your results myself?",
    answer: "Absolutely! Use our \"Test Your Keys\" feature to run the same benchmarks with your own API keys. You'll get the same tasks, same scoring, same methodology—proving we're not making up numbers. Additionally, all our code is open source on GitHub, so you can audit every algorithm and even run the full platform locally."
  },
  {
    category: "Technical",
    question: "Do you have an API?",
    answer: "Yes! Our API provides access to current rankings, historical data, confidence intervals, and drift alerts. Endpoints include: GET /api/dashboard (current scores), GET /api/dashboard?period=7d (historical trends), and GET /api/models/:id (detailed model data). All data is free to access."
  },
  {
    category: "Technical",
    question: "What are confidence intervals and why do they matter?",
    answer: "Confidence intervals show the range where we're 95% confident the true score lies. For example, \"24.8 ± 1.3\" means [23.5, 26.1]. This matters because: (1) AI is probabilistic, (2) single measurements are unreliable, (3) you need to know measurement uncertainty to make decisions, and (4) overlapping intervals mean differences might not be statistically significant."
  },
  {
    category: "Technical",
    question: "How often do you update benchmarks?",
    answer: "We run benchmarks continuously, with most models tested multiple times per week. High-priority models (GPT-5, Claude Opus 4, Gemini 2.5 Pro) are tested daily. Historical data is preserved so you can track performance over weeks, months, or years. Drift detection runs automatically on each new benchmark."
  },
  {
    category: "Technical",
    question: "What programming languages do you test?",
    answer: "Currently Python and TypeScript, as these are the most common languages for AI-assisted development. We're expanding to include JavaScript, Java, C++, Go, and Rust in future updates. The core methodology remains the same across languages."
  },

  // Comparison Questions
  {
    category: "Comparisons",
    question: "Which AI model is best for coding?",
    answer: "It depends on your specific needs, but currently top performers include OpenAI's GPT-5 and o3, Anthropic's Claude Opus 4, and Google's Gemini 2.5 Pro. Check our live rankings for current scores with confidence intervals. Remember: \"best\" varies by task type—some models excel at algorithms while others are better at refactoring."
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

  // Trust & Independence
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

  // Using the Platform
  {
    category: "Using the Platform",
    question: "How do I choose the right AI model for my project?",
    answer: "Consider: (1) Task complexity (simple tasks = smaller models OK), (2) Budget (cost per token varies 10x between models), (3) Latency requirements (some models are faster), (4) Stability needs (check our drift alerts), (5) Specific strengths (see axis breakdowns). Use our comparison tool to evaluate trade-offs."
  },
  {
    category: "Using the Platform",
    question: "What do the different colors/alerts mean?",
    answer: "🟢 Normal = Performance within expected variance. 🟡 Warning = Slight decline detected, monitoring closely. 🟠 Degradation = Sustained decline confirmed, statistically significant. 🔴 Critical = Major performance drop, immediate attention needed. Alerts are based on CUSUM drift detection calibrated per model."
  },
  {
    category: "Using the Platform",
    question: "Can I get notifications when a model degrades?",
    answer: "Not yet, but it's on our roadmap! We're planning email/webhook notifications for drift alerts, customizable per model. For now, check the dashboard regularly or follow our Twitter/Reddit for major announcements. You can also use our API to build your own monitoring system."
  },

  // Limitations & Future
  {
    category: "Limitations & Future",
    question: "What are the current limitations?",
    answer: "Main limitations: (1) 5 trials may not capture extreme variance, (2) Coding-focused (not general capabilities), (3) English language only, (4) Limited task diversity (expanding), (5) Confidence intervals not yet shown in all UI elements. We're actively working on all of these."
  },
  {
    category: "Limitations & Future",
    question: "What features are coming next?",
    answer: "Roadmap includes: (1) Adaptive sampling (more trials for uncertain cases), (2) Expanded task set with more languages, (3) Real-time error bars in charts, (4) Email/webhook drift alerts, (5) Statistical significance indicators between models, (6) Bayesian analysis for better uncertainty quantification, (7) Provider hub pages with vendor analysis."
  }
];

// Group FAQs by category
const categories = Array.from(new Set(faqs.map(f => f.category)));

export default function FAQPage() {
  return (
    <article className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
      <p className="text-xl text-slate-300 mb-8">
        Everything you need to know about AI model benchmarking, performance testing, and our methodology.
      </p>

      {/* Quick Navigation */}
      <nav className="bg-slate-800 p-4 rounded-lg mb-8">
        <p className="text-sm text-slate-300 mb-2 font-bold">Jump to Category:</p>
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <a
              key={category}
              href={`#${category.toLowerCase().replace(/\s+/g, '-')}`}
              className="text-sm px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-blue-400 transition-colors"
            >
              {category}
            </a>
          ))}
        </div>
      </nav>

      {/* FAQ by Category */}
      {categories.map(category => {
        const categoryFaqs = faqs.filter(f => f.category === category);
        return (
          <section key={category} id={category.toLowerCase().replace(/\s+/g, '-')} className="mb-12">
            <h2 className="text-2xl font-bold mb-6 border-b border-slate-700 pb-2">
              {category}
            </h2>
            <dl className="space-y-6">
              {categoryFaqs.map((faq, index) => (
                <div key={index} className="bg-slate-800 p-6 rounded-lg">
                  <dt className="text-lg font-bold text-blue-400 mb-3 flex items-start gap-2">
                    <span className="text-slate-500 flex-shrink-0">Q:</span>
                    <span>{faq.question}</span>
                  </dt>
                  <dd className="text-slate-300 leading-relaxed ml-6">
                    <span className="text-green-400 font-bold">A:</span> {faq.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}

      {/* Still Have Questions? */}
      <section className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/50 p-8 rounded-lg mt-12">
        <h2 className="text-2xl font-bold mb-4">Still Have Questions?</h2>
        <p className="text-slate-300 mb-6">
          Can't find what you're looking for? We're here to help.
        </p>
        
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-slate-800 p-4 rounded-lg">
            <h3 className="font-bold mb-2">📖 Read Documentation</h3>
            <p className="text-sm text-slate-300 mb-2">
              Detailed technical documentation of our methodology
            </p>
            <Link href="/methodology" className="text-blue-400 hover:text-blue-300 text-sm">
              View Methodology →
            </Link>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg">
            <h3 className="font-bold mb-2">💬 Join Discussion</h3>
            <p className="text-sm text-slate-300 mb-2">
              Ask questions and discuss with the community
            </p>
            <a 
              href="https://github.com/ionutvi/aistupidlevel.info/discussions" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              GitHub Discussions →
            </a>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg">
            <h3 className="font-bold mb-2">🐦 Follow Updates</h3>
            <p className="text-sm text-slate-300 mb-2">
              Get the latest news and announcements
            </p>
            <a 
              href="https://twitter.com/AIStupidlevel" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              Twitter/X →
            </a>
          </div>
        </div>
      </section>

      {/* Related Pages */}
      <section className="mt-12 bg-slate-800 p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4">Explore More</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            📊 View Current Rankings
          </Link>
          <Link href="/compare" className="text-blue-400 hover:text-blue-300">
            ⚖️ Compare AI Models
          </Link>
          <Link href="/test" className="text-blue-400 hover:text-blue-300">
            🔑 Test Your API Keys
          </Link>
          <Link href="/methodology" className="text-blue-400 hover:text-blue-300">
            🔬 Read Methodology
          </Link>
          <Link href="/about" className="text-blue-400 hover:text-blue-300">
            👥 About Our Team
          </Link>
          <a 
            href="https://github.com/ionutvi/aistupidlevel.info" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            💻 View Source Code
          </a>
        </div>
      </section>

      {/* FAQ Schema.org Structured Data for Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faqs.map(faq => ({
              "@type": "Question",
              "name": faq.question,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer
              }
            }))
          })
        }}
      />
    </article>
  );
}
