import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';
import LandingEffects from '@/components/landing/LandingEffects';
import { RdWeights, RdFinal } from '@/components/landing/Reading';
import { getModelRoster } from '@/components/landing/data';
import type { RosterModel } from '@/components/landing/types';
import { lpBody, lpDisplay } from '@/lib/fonts';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/compare.css';

export const metadata: Metadata = {
  title: 'Claude vs GPT vs Gemini Comparison 2026 | AI Model Performance Test Results',
  description: 'Compare Claude vs GPT vs Gemini AI models with real-time benchmark results. See which AI model is best for coding, debugging, and software development in 2026.',
  keywords: [
    'Claude vs GPT vs Gemini', 'Claude vs GPT comparison', 'GPT vs Gemini comparison',
    'Claude vs Gemini comparison', 'AI model comparison 2026', 'best AI model for coding',
    'Claude Opus 5 vs GPT-5.6', 'Gemini 3.1 vs Claude', 'AI performance comparison',
    'LLM comparison chart', 'AI benchmark comparison', 'which AI is better', 'AI model rankings 2026'
  ],
  openGraph: {
    title: 'Claude vs GPT vs Gemini - AI Model Comparison 2026',
    description: 'Real-time performance comparison of Claude, GPT, and Gemini AI models.',
    url: 'https://aistupidlevel.info/compare',
  },
  alternates: { canonical: '/compare' },
};

// The model lists come from the live roster, so a model that joins or leaves the board shows here
// within the hour. No ranking is printed on this page: the order changes with every run.
export const revalidate = 3600;

const intro = (d: string): CSSProperties => ({ '--d': d } as CSSProperties);
const up = (d?: string, cls = ''): { className: string; style?: CSSProperties } =>
  ({ className: `${cls} lp-up`.trim(), ...(d ? { style: { '--d': d } as CSSProperties } : {}) });

// Reveal-on-scroll hides blocks only once scripts run; the failsafe shows everything if they never do.
const FAILSAFE = "(function(){var d=document.documentElement;d.classList.add('lp-js');setTimeout(function(){if(!window.__lpReady)d.classList.remove('lp-js')},4000)})();";

/** Each category and where its live answer is. Definitions as on the methodology page. */
const LEADERS = [
  { label: 'Best for coding', detail: 'The Coding board: repository debugging tasks graded by running the project’s own tests, including hidden tests the model never sees.', how: '/methodology#coding' },
  { label: 'Best for reasoning', detail: 'The Reasoning board: four long, multi-turn working sessions every day.', how: '/methodology#reasoning' },
  { label: 'Fastest response', detail: 'A Quick answer under the boards: the lowest median response time over the last 48 hours, among the models within five points of the top.', how: '/methodology#quick' },
  { label: 'Best value', detail: 'A Quick answer under the boards: the most points per measured dollar of one identical coding run, every attempt billed.', how: '/methodology#quick' },
  { label: 'Best at tool calling', detail: 'The Tool use board: nine tasks, each in a real sandboxed machine — either the job is done at the end or it is not.', how: '/methodology#tooling' },
];

type Line = { model: string; desc: string } | { label: string; value: string };
const FAMILIES: { vendor: string; name: string; items: Line[] }[] = [
  { vendor: 'anthropic', name: 'Anthropic Claude', items: [
    { model: 'Opus', desc: 'The heavyweight line — strongest on complex reasoning and code architecture' },
    { model: 'Sonnet / Fable', desc: 'Faster, cheaper lines that stay close to Opus on ordinary coding work' },
    { label: 'Typically strong at', value: 'Code quality, debugging, tool calling' },
  ] },
  { vendor: 'openai', name: 'OpenAI GPT', items: [
    { model: 'GPT-5.x and GPT-6.x', desc: 'The flagship lines, several variants tuned differently' },
    { label: 'Typically strong at', value: 'Correctness and reasoning consistency' },
  ] },
  { vendor: 'google', name: 'Google Gemini', items: [
    { model: 'Gemini Pro', desc: 'High-performance line with multimodal capabilities' },
    { model: 'Gemini Flash / Flash-Lite', desc: 'Speed-optimised variants for high-throughput work' },
    { label: 'Typically strong at', value: 'Latency and price-per-token' },
    { label: 'Best for', value: 'High-throughput and cost-sensitive workloads' },
  ] },
  { vendor: 'deepseek', name: 'DeepSeek', items: [
    { model: 'V4 Pro / V4.1 Flash', desc: 'Open-weight-derived line that scores competitively on reasoning' },
    { label: 'Typically strong at', value: 'Reasoning score relative to cost' },
    { label: 'Best for', value: 'Analysis and reasoning work on a budget' },
  ] },
  { vendor: 'kimi', name: 'Moonshot Kimi', items: [
    { model: 'K3 / K2.x Code', desc: 'Long-context line with a coding-specialised variant' },
    { label: 'Typically strong at', value: 'Long-context retention and coding tasks' },
    { label: 'Best for', value: 'Large-codebase and long-document work' },
  ] },
  { vendor: 'glm', name: 'Zhipu GLM', items: [
    { model: 'GLM 5.x', desc: 'Competitively priced general-purpose line' },
    { label: 'Typically strong at', value: 'Cost efficiency' },
    { label: 'Best for', value: 'Volume workloads where price dominates' },
  ] },
];

const STEPS = [
  { title: 'Check the confidence intervals first', detail: 'The top few models are usually separated by less than their error bars, which means the ranking order between them is not statistically meaningful.' },
  { title: 'Sort by the axis you actually care about', detail: 'The coding, reasoning, speed, price and tool-calling views produce genuinely different orders.' },
  { title: 'Watch the drift alerts, not just the score', detail: 'A model that is quietly degrading is a worse bet than one scoring slightly lower but holding steady.' },
];

const MEASURES: [string, number, string][] = [
  ['Correctness', 60, 'Code is executed against the task’s tests — including, on repo tasks, tests the model never sees'],
  ['Stability', 10, 'Consistency across the 7 trials of each task'],
  ['Edge cases', 10, 'Hidden tests the model never saw'],
  ['Debugging', 10, 'Whether it found the real defect rather than silencing the symptom'],
  ['Code quality', 5, 'Clean, maintainable code'],
  ['Format, safety', 5, 'Guardrails: clean, parseable output and no dangerous operations'],
  ['Complexity, efficiency', 0, 'Measured and shown, but not scored'],
];

const FAIRNESS = [
  'Repo debugging tasks graded on hidden tests, executed not just graded',
  'The same prompts and output budget for every model, and the same sampling settings wherever a provider accepts them',
  'Multiple test runs with median scoring to eliminate outliers',
  'Real production API calls with actual latency and token measurements',
  'Independent verification by running the same suites with your own API keys',
];

/** Display names in a natural order ("GPT-6" before "GPT-6.1"). */
const byName = (a: RosterModel, b: RosterModel) => a.displayName.localeCompare(b.displayName, 'en', { numeric: true });

export default async function ComparePage() {
  const roster = await getModelRoster();
  const of = (vendor: string) => roster.filter((m) => m.vendor === vendor).sort(byName);

  return (
    <SubpageLayout>
      <div className={`lp lp-sub cp-page ${lpBody.variable} ${lpDisplay.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: FAILSAFE }} />
        <LandingEffects />

        <header className="lp-hero lp-textured">
          <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="lp-wrap">
            <p className="lp-kicker lp-intro cp-kicker" style={intro('.04s')}>Compare</p>
            <h1 className="lp-h1 lp-intro" style={intro('.1s')}>
              Claude vs GPT vs Gemini <span className="lp-b">on the same tests, every day</span>
            </h1>
            <div className="lp-hero-row">
              <div>
                <p className="lp-lead lp-intro" style={intro('.18s')}>
                  Real-time AI model comparison with comprehensive benchmark results. Every model gets the same
                  coding, reasoning and tool-use tasks on the same schedule, graded by running what it produces.
                </p>
                <div className="lp-cta lp-intro" style={intro('.26s')}>
                  <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/">View live results <span className="lp-ar" aria-hidden="true">→</span></Link>
                  <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/methodology">How we test</Link>
                </div>
              </div>
              <ul className="cp-provs lp-intro" style={intro('.34s')} aria-label="Families we track">
                {FAMILIES.map((f) => {
                  const count = of(f.vendor).length;
                  return (
                    <li key={f.vendor}>
                      <span className="lp-lgc"><img src={`/logos/${f.vendor}.svg`} alt="" width={22} height={22} /></span>
                      <span><b>{f.name}</b>{count > 0 && <small>{count} {count === 1 ? 'model' : 'models'} tracked</small>}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </header>

        <section className="lp-sec lp-A" aria-labelledby="cp-leaders">
          <div className="lp-wrap">
            <div className="lp-head lp-head-split lp-up">
              <p className="lp-kicker">Leaders</p>
              <h2 className="lp-h2" id="cp-leaders">Current performance leaders</h2>
              <p className="lp-lead">
                Benchmarks re-run every 4 hours and the order genuinely changes, so we do not freeze a winner into
                this page — a hardcoded list here would be wrong within weeks. Each category below links to the live
                board, which is the authoritative answer.
              </p>
            </div>
            <ol className="cp-leaders">
              {LEADERS.map((l, i) => (
                <li key={l.label} {...up(`${i * 0.05}s`)}>
                  <span className="cp-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{l.label}</h3>
                    <p>{l.detail}</p>
                  </div>
                  <span className="cp-go">
                    <Link className="lp-more" href="/">See it live</Link>
                    <Link className="cp-how" href={l.how}>How it is measured</Link>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-sec lp-B" aria-labelledby="cp-matrix">
          <div className="lp-wrap">
            <div className="lp-head lp-head-split lp-up">
              <p className="lp-kicker">Families</p>
              <h2 className="lp-h2" id="cp-matrix">Detailed comparison matrix</h2>
              <p className="lp-lead">
                Our 9-axis scoring methodology provides comprehensive insights into each model&apos;s strengths. The
                models listed under each family are the ones on the board today, each with its own page.
              </p>
            </div>
            <div className="cp-fams">
              {FAMILIES.map((f, i) => {
                const models = of(f.vendor);
                return (
                  <article key={f.vendor} {...up(`${(i % 3) * 0.06}s`, 'cp-fam')}>
                    <header>
                      <span className="lp-lgc"><img src={`/logos/${f.vendor}.svg`} alt="" width={22} height={22} loading="lazy" /></span>
                      <h3>{f.name}</h3>
                    </header>
                    <dl>
                      {f.items.map((it, j) => 'model' in it
                        ? <div key={j}><dt>{it.model}</dt><dd>{it.desc}</dd></div>
                        : <div key={j} className="is-note"><dt>{it.label}</dt><dd>{it.value}</dd></div>)}
                    </dl>
                    {models.length > 0 && (
                      <div className="cp-tracked">
                        <p>Models tracked ({models.length})</p>
                        <ul className="rd-tags">
                          {models.map((m) => <li key={m.slug}><Link href={`/models/${m.slug}`}>{m.displayName}</Link></li>)}
                        </ul>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="lp-sec lp-A" aria-labelledby="cp-coding">
          <div className="lp-wrap">
            <div className="lp-head lp-head-split lp-up">
              <p className="lp-kicker">Choosing</p>
              <h2 className="lp-h2" id="cp-coding">Which AI model is best for coding?</h2>
              <p className="lp-lead">
                The honest answer is &ldquo;it depends, and it changed since you asked&rdquo;. What we can tell you is
                how to read the data rather than which name to trust this month:
              </p>
            </div>
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li key={s.title} {...up(`${i * 0.08}s`, 'lp-step')}>
                  <p className="lp-step-n">{String(i + 1).padStart(2, '0')}</p>
                  <h3 className="lp-h3">{s.title}</h3>
                  <p>{s.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-sec lp-B" aria-labelledby="cp-results">
          <div className="lp-wrap">
            <div className="lp-head lp-head-split lp-up">
              <p className="lp-kicker">Scoring</p>
              <h2 className="lp-h2" id="cp-results">Real-time benchmark results</h2>
              <p className="lp-lead">
                Every model runs on the same schedule: coding every four hours, reasoning and tool use daily, and an
                hourly canary. Key metrics of the coding score, by weight:
              </p>
            </div>
            <RdWeights rows={MEASURES} label="Metric" />
          </div>
        </section>

        <section className="lp-sec lp-C" aria-labelledby="cp-method">
          <div className="lp-wrap lp-two">
            <div className="lp-up">
              <p className="lp-kicker">Transparency</p>
              <h2 className="lp-h3 cp-h" id="cp-method">Methodology and transparency</h2>
              <p className="lp-lead">Our AI model comparison uses identical test conditions for fair evaluation.</p>
              <p className="cp-read">
                Read our <Link href="/methodology">detailed methodology</Link> to understand how we measure AI
                performance, or check our <Link href="/faq">FAQ</Link> for common questions about our benchmarking
                approach.
              </p>
            </div>
            <ul className="rd-ticks lp-up">
              {FAIRNESS.map((f) => <li key={f}>{f}</li>)}
            </ul>
          </div>
        </section>

        <RdFinal
          title="See live results"
          lead="View real-time Claude vs GPT vs Gemini performance data with our interactive AI benchmark dashboard."
          actions={(
            <>
              <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/">View live results <span className="lp-ar" aria-hidden="true">→</span></Link>
              <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/about">About us</Link>
            </>
          )}
        />
      </div>
    </SubpageLayout>
  );
}
