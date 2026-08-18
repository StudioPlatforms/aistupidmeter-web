import type { Metadata } from 'next';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';

/**
 * Topic landing page for AI drift detection / model degradation.
 *
 * Before this page existed the site had no URL targeting these terms — the
 * strongest signal anywhere was a handful of mentions inside the FAQ — so there
 * was nothing for a search engine to rank for "AI drift detection", "AI model
 * degradation", "is ChatGPT getting worse" and related queries, even though
 * detecting exactly that is what the platform does.
 */

const SITE = 'https://aistupidlevel.info';
const CANONICAL = `${SITE}/ai-drift-detection`;

export const metadata: Metadata = {
  title: 'AI Drift Detection — Track AI Model Degradation & Performance Decline',
  description:
    'AI drift detection explained: how to tell when an AI model degrades behind a stable API name. We monitor GPT, Claude, Gemini, Grok, DeepSeek and Kimi for performance decline using CUSUM change-point detection, with live drift alerts and historical charts.',
  keywords: [
    'AI drift detection',
    'AI model drift',
    'LLM drift detection',
    'AI degradation',
    'AI model degradation',
    'AI performance degradation',
    'AI performance decline',
    'model drift monitoring',
    'is ChatGPT getting worse',
    'is Claude getting worse',
    'why is my AI model getting dumber',
    'AI model quality drop',
    'detect LLM regression',
    'LLM regression testing',
    'AI model monitoring',
    'AI quality monitoring',
    'CUSUM drift detection',
    'change point detection LLM',
    'silent model updates',
    'AI model nerfed',
    'LLM performance tracking over time',
    'AI model consistency monitoring',
  ],
  alternates: { canonical: CANONICAL },
  openGraph: {
    type: 'article',
    url: CANONICAL,
    title: 'AI Drift Detection — Track AI Model Degradation Over Time',
    description:
      'How to detect when an AI model silently degrades. CUSUM change-point detection applied to continuous LLM benchmarks, with live drift alerts.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Drift Detection — Track AI Model Degradation Over Time',
    description:
      'How to detect when an AI model silently degrades, using CUSUM change-point detection over continuous benchmarks.',
  },
};

const FAQ = [
  {
    q: 'What is AI drift detection?',
    a: 'AI drift detection is the practice of continuously measuring a model\'s output quality so you can tell when it changes. Because providers serve updated models behind stable API names, the version you call today may not behave like the one you tested against months ago. Drift detection replaces the anecdotal "it feels worse lately" with a measurement you can point at.',
  },
  {
    q: 'What causes AI model degradation?',
    a: 'Several things: a provider silently swapping in a new checkpoint, changes to safety filters that increase refusals, quantisation or serving-stack changes made to cut inference cost, altered default sampling parameters, and capacity pressure during peak demand. From the outside these are indistinguishable — all you observe is that the same prompt now returns weaker output.',
  },
  {
    q: 'How can I tell if ChatGPT or Claude is actually getting worse?',
    a: 'You need a fixed test set, repeated runs, and a statistical baseline. A single bad response proves nothing — model output is stochastic, so quality varies run to run even with no change at the provider. The signal you want is a sustained shift in the average across many runs, which is exactly what change-point detection is designed to isolate.',
  },
  {
    q: 'What is CUSUM and why use it for drift detection?',
    a: 'CUSUM (cumulative sum) is a change-point detection algorithm that accumulates deviations from a baseline mean. Small random fluctuations cancel out over time, but a genuine sustained shift accumulates until it crosses a decision threshold. This makes it far better suited to catching gradual decline than a simple threshold alarm, which either fires constantly on noise or misses slow degradation entirely.',
  },
  {
    q: 'How often do you check for model drift?',
    a: 'Benchmarks run continuously, with the code suite refreshing multiple times a day and deeper reasoning and tool-use suites on their own cadence. Every completed run feeds the drift calculation, so a sustained change surfaces within hours rather than whenever someone happens to notice.',
  },
  {
    q: 'Which models do you monitor for degradation?',
    a: 'Current models across OpenAI, Anthropic, Google, DeepSeek, Moonshot AI and Zhipu AI — including the GPT-5 series, Claude Opus and Sonnet, Gemini, DeepSeek V4, Kimi and GLM. Every model in the leaderboard has its own page with a historical performance chart.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'AI Stupid Level', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'AI Drift Detection', item: CANONICAL },
      ],
    },
    {
      '@type': 'Article',
      '@id': CANONICAL,
      headline: 'AI Drift Detection — Track AI Model Degradation Over Time',
      description:
        'How to detect when an AI model silently degrades behind a stable API name, using CUSUM change-point detection over continuous benchmarks.',
      author: { '@type': 'Organization', name: 'AI Stupid Level' },
      publisher: { '@type': 'Organization', name: 'AI Stupid Level', url: SITE },
      mainEntityOfPage: CANONICAL,
      about: ['AI drift detection', 'AI model degradation', 'LLM monitoring'],
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
};

const styles = {
  page: { minHeight: '100vh' } as React.CSSProperties,
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '32px 20px 80px',
  } as React.CSSProperties,
  h1: {
    fontSize: 'clamp(20px, 3.5vw, 28px)',
    fontWeight: 'bold',
    color: 'var(--phosphor-green, #1a73e8)',
    letterSpacing: '2px',
    textShadow: '0 0 8px rgba(26, 115, 232,0.4)',
    margin: '0 0 8px',
  } as React.CSSProperties,
  sub: {
    fontSize: '12px',
    color: 'var(--phosphor-dim, #5f6368)',
    margin: '0 0 28px',
    letterSpacing: '0.3px',
    lineHeight: 1.5,
  } as React.CSSProperties,
  hero: {
    background: 'rgba(26, 115, 232,0.05)',
    border: '1px solid rgba(26, 115, 232,0.25)',
    borderLeft: '3px solid var(--phosphor-green, #1a73e8)',
    borderRadius: '3px',
    padding: '16px 20px',
    marginBottom: '24px',
    fontSize: '13px',
    lineHeight: 1.7,
    color: 'var(--phosphor-dim)',
  } as React.CSSProperties,
  h2: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--amber-warning, #ffb000)',
    textTransform: 'uppercase' as const,
    letterSpacing: '1.5px',
    margin: '28px 0 12px',
  } as React.CSSProperties,
  h3: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--phosphor-green, #1a73e8)',
    margin: '0 0 6px',
  } as React.CSSProperties,
  panel: {
    background: 'rgba(0,0,0,0.04)',
    border: '1px solid rgba(192,192,192,0.15)',
    borderRadius: '3px',
    padding: '16px 18px',
    marginBottom: '12px',
  } as React.CSSProperties,
  text: {
    fontSize: '13px',
    lineHeight: 1.7,
    color: 'var(--phosphor-dim)',
    margin: '0 0 12px',
  } as React.CSSProperties,
  link: { color: 'var(--phosphor-green, #1a73e8)' } as React.CSSProperties,
  cta: {
    display: 'inline-block',
    marginTop: '8px',
    padding: '10px 18px',
    border: '1px solid var(--phosphor-green, #1a73e8)',
    borderRadius: '3px',
    color: 'var(--phosphor-green, #1a73e8)',
    fontSize: '12px',
    fontWeight: 700,
    textDecoration: 'none',
    letterSpacing: '0.5px',
  } as React.CSSProperties,
};

export default function AiDriftDetectionPage() {
  return (
    <SubpageLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={styles.page}>
        <div style={styles.container}>
          <h1 style={styles.h1}>
            AI Drift Detection &amp; Model Degradation Monitoring
          </h1>
          <p style={styles.sub}>
            How to tell when an AI model quietly gets worse — and how we measure it across every major provider.
          </p>

          <div style={styles.hero}>
            AI models change without changing their name. A provider can update the checkpoint behind{' '}
            <code>gpt-5.5</code> or <code>claude-opus-5</code> at any time, and your code keeps calling the same
            string. If output quality drops, nothing in the API tells you. AI Stupid Level benchmarks every major
            model continuously and applies change-point detection to the results, so a sustained decline becomes a
            measurement instead of a hunch.
          </div>

          <h2 style={styles.h2}>What is AI drift?</h2>
          <p style={styles.text}>
            AI drift is a measurable change in a model&apos;s output quality over time while its public identifier
            stays the same. It is distinct from prompt drift (your inputs changing) and from data drift in classical
            ML (the input distribution moving). Here the model itself is the thing that moved.
          </p>
          <p style={styles.text}>
            Drift is not always downward — models sometimes improve after an update. The problem is that neither
            direction is announced, so teams building on a model have no way to know their evaluation results are
            still valid. That uncertainty is the actual cost: you cannot tell whether a regression in your product
            came from your last deploy or from your provider.
          </p>

          <h2 style={styles.h2}>What causes AI model degradation?</h2>
          <div style={styles.panel}>
            <h3 style={styles.h3}>Silent version swaps</h3>
            <p style={{ ...styles.text, margin: 0 }}>
              A provider routes a stable alias to a new checkpoint. Behaviour changes; the model name does not.
            </p>
          </div>
          <div style={styles.panel}>
            <h3 style={styles.h3}>Cost-driven serving changes</h3>
            <p style={{ ...styles.text, margin: 0 }}>
              Quantisation, distillation and serving-stack changes cut inference cost, and can cut output quality with
              it — particularly on long-context and multi-step reasoning work.
            </p>
          </div>
          <div style={styles.panel}>
            <h3 style={styles.h3}>Safety and refusal tuning</h3>
            <p style={{ ...styles.text, margin: 0 }}>
              Tightened filters raise refusal rates on legitimate requests. The model is not less capable, but it is
              measurably less useful for the task you had.
            </p>
          </div>
          <div style={styles.panel}>
            <h3 style={styles.h3}>Capacity pressure</h3>
            <p style={{ ...styles.text, margin: 0 }}>
              Under heavy load, providers may shift defaults such as sampling parameters or reasoning budget, which
              shows up as higher variance rather than a clean step down.
            </p>
          </div>

          <h2 style={styles.h2}>How we detect drift: CUSUM change-point detection</h2>
          <p style={styles.text}>
            A single weak response is not evidence. Model output is stochastic, so scores vary run to run even when
            nothing has changed upstream. A naive threshold alarm on raw scores either fires constantly on that noise
            or is set so loose it misses real decline.
          </p>
          <p style={styles.text}>
            We use CUSUM — a cumulative sum control technique from statistical process control. Instead of testing each
            run in isolation, CUSUM accumulates each run&apos;s deviation from an established baseline. Random noise
            has no consistent sign, so it cancels out and the running total stays near zero. A genuine sustained
            decline pushes deviations consistently in one direction, so the total climbs until it crosses a decision
            threshold and a drift event fires.
          </p>
          <p style={styles.text}>
            The threshold is what trades false alarms against detection lag. We tune it against historical benchmark
            variance so that ordinary fluctuation stays quiet while a real shift is caught within hours. Every score is
            also published with a confidence interval, so you can see how much of a gap between two models is
            meaningful and how much is noise. The full statistical approach is documented on our{' '}
            <Link href="/methodology" style={styles.link}>benchmarking methodology page</Link>.
          </p>

          <h2 style={styles.h2}>What we measure for drift</h2>
          <p style={styles.text}>
            Drift is tracked per benchmark suite, because a model can decline in one dimension while holding steady in
            another — a common pattern after a cost-optimisation update.
          </p>
          <div style={styles.panel}>
            <h3 style={styles.h3}>Code generation (7 axes)</h3>
            <p style={{ ...styles.text, margin: 0 }}>
              Correctness, adherence to spec, code quality, efficiency, stability, refusal rate and error recovery,
              scored by executing the generated code rather than grading it by similarity.
            </p>
          </div>
          <div style={styles.panel}>
            <h3 style={styles.h3}>Deep reasoning</h3>
            <p style={{ ...styles.text, margin: 0 }}>
              Multi-step problem solving, plan coherence, long-context retention and hallucination rate — usually the
              first place a quantised model shows decline.
            </p>
          </div>
          <div style={styles.panel}>
            <h3 style={styles.h3}>Tool calling</h3>
            <p style={{ ...styles.text, margin: 0 }}>
              Tool selection, argument accuracy, error handling and recovery. Critical for agents, where a small drop
              in argument accuracy compounds across a long chain of calls.
            </p>
          </div>

          <h2 style={styles.h2}>Why independent monitoring matters</h2>
          <p style={styles.text}>
            Providers publish benchmark numbers at launch. Nobody publishes them continuously afterwards, and no
            provider announces that a model got worse. Independent, ongoing measurement is the only way to know
            whether the model you evaluated is the model you are running — which matters for anyone with a model
            choice baked into production, a vendor contract to justify, or an AI feature whose quality they are
            accountable for.
          </p>
          <p style={styles.text}>
            Every model we track has its own page with a historical score chart, per-suite breakdown and drift status.
            Start from the{' '}
            <Link href="/" style={styles.link}>live AI model leaderboard</Link>, or read the{' '}
            <Link href="/faq" style={styles.link}>benchmarking FAQ</Link> for shorter answers to common questions.
          </p>

          <h2 style={styles.h2}>Frequently asked questions about AI drift</h2>
          {FAQ.map((f) => (
            <div key={f.q} style={styles.panel}>
              <h3 style={styles.h3}>{f.q}</h3>
              <p style={{ ...styles.text, margin: 0 }}>{f.a}</p>
            </div>
          ))}

          <h2 style={styles.h2}>Track model drift yourself</h2>
          <p style={styles.text}>
            All benchmark data is free to browse — no account needed. Compare current models side by side, or open any
            model to see its full performance history and drift status.
          </p>
          <Link href="/" style={styles.cta}>
            VIEW LIVE MODEL RANKINGS &rarr;
          </Link>
        </div>
      </div>
    </SubpageLayout>
  );
}
