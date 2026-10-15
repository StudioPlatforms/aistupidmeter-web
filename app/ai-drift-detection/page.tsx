import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';
import DriftPanel from '@/components/landing/DriftPanel';
import ScheduleDial from '@/components/landing/ScheduleDial';
import LandingEffects from '@/components/landing/LandingEffects';
import { lpBody, lpDisplay } from '@/lib/fonts';
import '@/styles/landing.css';

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
    'AI drift detection explained: how to tell when an AI model degrades behind a stable API name. We monitor GPT, Claude, Gemini, DeepSeek, Kimi and GLM for performance decline using Page-Hinkley change-point detection, with live drift alerts and historical charts.',
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
    'Page-Hinkley drift detection',
    'CUSUM change detection',
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
      'How to detect when an AI model silently degrades. Page-Hinkley change-point detection applied to continuous LLM benchmarks, with live drift alerts.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Drift Detection — Track AI Model Degradation Over Time',
    description:
      'How to detect when an AI model silently degrades, using Page-Hinkley change-point detection over continuous benchmarks.',
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
    q: 'What is the Page-Hinkley test and why use it for drift detection?',
    a: 'The Page-Hinkley test is a cumulative-sum (CUSUM-family) change-point detector. It keeps a running total of how far each new observation falls below the running mean, less a small tolerance, and compares that total with its own lowest point so far. Random fluctuations have no consistent sign and cancel out; a genuine sustained decline accumulates until the gap crosses a decision threshold and a drift event fires. That makes it far better suited to catching gradual decline than a simple threshold alarm, which either fires constantly on noise or misses slow degradation entirely. We run it on each model\'s daily median score, and the constants are published on the methodology page.',
  },
  {
    q: 'How often do you check for model drift?',
    a: 'The code suite runs every four hours, the reasoning suite (all four tasks) and the tool-use suite (nine sessions) once a day, and a two-probe canary every hour. The Page-Hinkley statistic is computed per suite on daily medians, so it confirms a sustained shift over days rather than reacting to one bad hour; the canary\'s Welch test catches a sharp drop within the hour it lands. If a suite could not run — a provider outage, or a prompt the provider declined — that suite is left out of the score and the gap is shown next to it rather than filled in.',
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
        'How to detect when an AI model silently degrades behind a stable API name, using Page-Hinkley change-point detection over continuous benchmarks.',
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

const up = (d?: string, cls = ''): { className: string; style?: CSSProperties } =>
  ({ className: `${cls} lp-up`.trim(), ...(d ? { style: { '--d': d } as CSSProperties } : {}) });
const intro = (d: string): CSSProperties => ({ '--d': d } as CSSProperties);

/**
 * Laid out in the landing page's look (styles/landing.css): a topic page rather than a plain article,
 * with the landing's Page-Hinkley illustration and benchmark clock as its figures. Every sentence of
 * the article is unchanged — this page exists to rank for these terms.
 */
export default function AiDriftDetectionPage() {
  return (
    <SubpageLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className={`lp lp-sub ${lpBody.variable} ${lpDisplay.variable}`}>
        {/* Reveal-on-scroll hides blocks only once scripts run; the failsafe shows everything if they never do. */}
        <script dangerouslySetInnerHTML={{ __html: "(function(){var d=document.documentElement;d.classList.add('lp-js');setTimeout(function(){if(!window.__lpReady)d.classList.remove('lp-js')},4000)})();" }} />
        <LandingEffects />

        <header className="lp-hero lp-textured">
          <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="lp-wrap">
            <div className="lp-hero-row">
              <div>
                <p className="lp-kicker lp-intro" style={intro('.04s')}>AI drift detection</p>
                <h1 className="lp-h1 lp-intro" style={intro('.1s')}>
                  AI drift detection <span className="lp-b">&amp; model degradation monitoring</span>
                </h1>
                <p className="lp-lead lp-intro" style={intro('.18s')}>
                  How to tell when an AI model quietly gets worse — and how we measure it across every major provider.
                </p>
                <div className="lp-cta lp-intro" style={intro('.26s')}>
                  <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/">View live model rankings <span className="lp-ar" aria-hidden="true">→</span></Link>
                  <a className="lp-btn lp-btn-ghost lp-btn-lg" href="#detection">How we detect drift</a>
                </div>
              </div>
              <dl className="lp-facts lp-intro" style={intro('.34s')}>
                <div><dt>4 h</dt><dd>between coding-suite runs on every model</dd></div>
                <div><dt>1 h</dt><dd>between canary probes, for sharp drops</dd></div>
                <div><dt>3</dt><dd>suites, each with its own Page-Hinkley detector — never blended</dd></div>
              </dl>
            </div>
          </div>
        </header>

        <section className="lp-sec lp-A">
          <div className="lp-wrap">
            <div className="lp-head lp-head-split lp-up">
              <p className="lp-kicker">The problem</p>
              <h2 className="lp-h2">What is AI drift?</h2>
              <p className="lp-lead">
                AI models change without changing their name. A provider can update the checkpoint behind{' '}
                <code>gpt-5.5</code> or <code>claude-opus-5</code> at any time, and your code keeps calling the same
                string. If output quality drops, nothing in the API tells you. AI Stupid Level benchmarks every major
                model continuously and applies change-point detection to the results, so a sustained decline becomes a
                measurement instead of a hunch.
              </p>
            </div>
            <div className="lp-trio lp-dd-two">
              <div {...up()}>
                <b>The model itself moved</b>
                <p>
                  AI drift is a measurable change in a model&apos;s output quality over time while its public identifier
                  stays the same. It is distinct from prompt drift (your inputs changing) and from data drift in classical
                  ML (the input distribution moving). Here the model itself is the thing that moved.
                </p>
              </div>
              <div {...up('.08s')}>
                <b>Neither direction is announced</b>
                <p>
                  Drift is not always downward — models sometimes improve after an update. The problem is that neither
                  direction is announced, so teams building on a model have no way to know their evaluation results are
                  still valid. That uncertainty is the actual cost: you cannot tell whether a regression in your product
                  came from your last deploy or from your provider.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-sec lp-B">
          <div className="lp-wrap">
            <div className="lp-head lp-up">
              <p className="lp-kicker">Causes</p>
              <h2 className="lp-h2">What causes AI model degradation?</h2>
            </div>
            <div className="lp-causes lp-dd-causes">
              <div {...up()}>
                <span className="lp-spec">01</span>
                <b>Silent version swaps</b>
                <p>A provider routes a stable alias to a new checkpoint. Behaviour changes; the model name does not.</p>
              </div>
              <div {...up('.06s')}>
                <span className="lp-spec">02</span>
                <b>Cost-driven serving changes</b>
                <p>
                  Quantisation, distillation and serving-stack changes cut inference cost, and can cut output quality with
                  it — particularly on long-context and multi-step reasoning work.
                </p>
              </div>
              <div {...up('.12s')}>
                <span className="lp-spec">03</span>
                <b>Safety and refusal tuning</b>
                <p>
                  Tightened filters raise refusal rates on legitimate requests. The model is not less capable, but it is
                  measurably less useful for the task you had. In our multi-turn reasoning suite, a prompt the provider
                  declines outright is recorded as a refusal with the provider&apos;s stated category and that
                  session&apos;s score is withheld, so a tightened filter shows up as a refusal rate rather than as
                  invented incapability.
                </p>
              </div>
              <div {...up('.18s')}>
                <span className="lp-spec">04</span>
                <b>Capacity pressure</b>
                <p>
                  Under heavy load, providers may shift defaults such as sampling parameters or reasoning budget, which
                  shows up as higher variance rather than a clean step down.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-sec lp-C" id="detection">
          <div className="lp-wrap">
            <div className="lp-head lp-head-split lp-up">
              <p className="lp-kicker">Detection</p>
              <h2 className="lp-h2">How we detect drift: the Page-Hinkley test</h2>
              <p className="lp-lead">
                A single weak response is not evidence. Model output is stochastic, so scores vary run to run even when
                nothing has changed upstream. A naive threshold alarm on raw scores either fires constantly on that noise
                or is set so loose it misses real decline.
              </p>
            </div>
            <DriftPanel />
            <div className="lp-two lp-dd-text">
              <p {...up()}>
                We use the Page-Hinkley test — a cumulative-sum change detector from statistical process control. Instead
                of judging each run in isolation, it accumulates how far each day&apos;s median score falls below the
                running mean, less a small tolerance, and tracks the gap between that running total and its lowest point
                so far. Random noise has no consistent sign, so it cancels out and the gap stays near zero. A genuine
                sustained decline pushes the deviations consistently in one direction, so the gap grows until it crosses
                a decision threshold and a drift event fires.
              </p>
              <p {...up('.08s')}>
                The threshold is what trades false alarms against detection lag. The tolerance and threshold were chosen
                by sweeping them against the full history of real benchmark scores, so ordinary day-to-day fluctuation
                stays quiet while a real shift is confirmed over days rather than hours. The statistic runs on each
                suite&apos;s own daily series &mdash; coding, tool use and reasoning are never blended, because they sit on
                different scales &mdash; and restarts whenever a suite&apos;s configuration changes. For sharp drops there is
                a second, faster instrument: an hourly canary of two fixed probes, tested over the last 6 and 24 hours
                against the prior week with Welch&apos;s t-test, which raises an incident at a 12-point fall with p &lt; 0.01
                and closes it when the gap closes. Every score is also published with a standard error measured from its
                own run-to-run repeatability, the leaderboard ties models whose lead is inside that noise, and a composite
                score is labelled with how many suites actually contributed to it. The full statistical approach,
                including the constants and the measured false-alarm rates, is documented on our{' '}
                <Link href="/methodology">benchmarking methodology page</Link>.
              </p>
            </div>
          </div>
        </section>

        <section className="lp-sec lp-A">
          <div className="lp-wrap">
            <div className="lp-head lp-head-split lp-up">
              <p className="lp-kicker">Coverage</p>
              <h2 className="lp-h2">What we measure for drift</h2>
              <p className="lp-lead">
                Drift is tracked per benchmark suite, because a model can decline in one dimension while holding steady in
                another — a common pattern after a cost-optimisation update.
              </p>
            </div>
            <div className="lp-bench">
              <div {...up()}><ScheduleDial /></div>
              <div {...up('.1s', 'lp-sched')}>
                <div className="lp-sch">
                  <i className="lp-key cd" />
                  <div>
                    <b>Code generation (9 axes)</b>
                    <span>
                      Correctness, task complexity handling, code quality, stability, efficiency, edge cases, debugging,
                      output format and safety, scored by executing the generated code rather than grading it by similarity.
                    </span>
                  </div>
                </div>
                <div className="lp-sch">
                  <i className="lp-key d" />
                  <div>
                    <b>Deep reasoning</b>
                    <span>
                      Multi-step problem solving over a multi-turn session, scored on the code axes plus memory retention,
                      hallucination rate, plan coherence and context-window use — usually the first place a quantised model
                      shows decline.
                    </span>
                  </div>
                </div>
                <div className="lp-sch">
                  <i className="lp-key d" />
                  <div>
                    <b>Tool calling</b>
                    <span>
                      Task completion, tool selection, parameter accuracy, efficiency, error handling, context awareness and
                      safety compliance. Critical for agents, where a small drop in parameter accuracy compounds across a
                      long chain of calls.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-sec lp-B">
          <div className="lp-wrap">
            <div className="lp-head lp-head-split lp-up">
              <p className="lp-kicker">Why it matters</p>
              <h2 className="lp-h2">Why independent monitoring matters</h2>
              <p className="lp-lead">
                Providers publish benchmark numbers at launch. Nobody publishes them continuously afterwards, and no
                provider announces that a model got worse. Independent, ongoing measurement is the only way to know
                whether the model you evaluated is the model you are running — which matters for anyone with a model
                choice baked into production, a vendor contract to justify, or an AI feature whose quality they are
                accountable for.
              </p>
            </div>
            <p className="lp-lead lp-dd-after lp-up">
              Every model we track has its own page with a historical score chart, per-suite breakdown and drift status.
              Start from the <Link href="/">live AI model leaderboard</Link>, or read the{' '}
              <Link href="/faq">benchmarking FAQ</Link> for shorter answers to common questions.
            </p>
          </div>
        </section>

        <section className="lp-sec lp-C" aria-labelledby="dd-faq">
          <div className="lp-wrap lp-faq">
            <div className="lp-head lp-up">
              <p className="lp-kicker">FAQ</p>
              <h2 className="lp-h2" id="dd-faq">Frequently asked questions about AI drift</h2>
            </div>
            <div className="lp-up">
              {FAQ.map((f, i) => (
                <details key={f.q} open={i === 0}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-sec lp-final lp-textured">
          <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="lp-wrap">
            <h2 className="lp-h2 lp-up">Track model drift yourself</h2>
            <p className="lp-lead lp-up">
              Every model page is open to everyone, and a free account adds the full leaderboard over the last 24 hours,
              7 days and 30 days. Compare current models side by side, or open any model to see its performance history
              and drift status.
            </p>
            <div className="lp-cta lp-up">
              <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/">View live model rankings <span className="lp-ar" aria-hidden="true">→</span></Link>
              <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/methodology">Read the methodology</Link>
            </div>
          </div>
        </section>
      </div>
    </SubpageLayout>
  );
}
