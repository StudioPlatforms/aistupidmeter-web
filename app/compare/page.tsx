import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';
import LandingEffects from '@/components/landing/LandingEffects';
import { RdWeights, RdFinal } from '@/components/landing/Reading';
import { CtaRow, LeaderboardCta, RouterCta } from '@/components/seo/Cta';
import JsonLd from '@/components/seo/JsonLd';
import { AsOf } from '@/components/seo/Verdict';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { PLANS } from '@/lib/entitlements';
import { lpBody, lpDisplay } from '@/lib/fonts';
import { breadcrumbLd, faqLd, graphLd, isoDay, pageMeta, utcStamp, webPageLd } from '@/lib/seo';
import { word } from '@/components/seo/pair/pair-data';
import { VENDORS, byDisplayName, curatedPairs, getBoards24h, getPrice, getRoster, modelsOfVendor, pairSlug, vendorMention, type PriceSnapshot, type SeoModel } from '@/lib/seo-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';
import '@/styles/compare.css';
import '@/styles/seo-pair.css';

const TITLE = 'Claude vs GPT vs Gemini on the same tests';
const DESCRIPTION = 'Claude, GPT, Gemini, DeepSeek, Kimi and GLM on the same coding, reasoning and tool-use tests, re-run on a fixed schedule, with a page for every pair.';

export const metadata: Metadata = pageMeta({
  title: TITLE,
  description: DESCRIPTION,
  path: '/compare',
  keywords: [
    'Claude vs GPT vs Gemini', 'Claude vs GPT comparison', 'GPT vs Gemini comparison', 'Claude vs Gemini comparison',
    'Claude vs ChatGPT comparison', 'Gemini vs DeepSeek comparison', 'DeepSeek vs GPT', 'AI model comparison 2026', 'best AI model for coding',
    'AI performance comparison', 'LLM comparison chart', 'AI benchmark comparison', 'which AI is better', 'AI model rankings 2026',
  ],
});

// The model lists and the pair index come from the live roster and the 24-hour boards, so a model
// that joins or leaves the board shows here within the quarter hour. No ranking is printed on this
// page: the order changes with every run.
export const revalidate = 900;

const intro = (d: string): CSSProperties => ({ '--d': d } as CSSProperties);
const up = (d?: string, cls = ''): { className: string; style?: CSSProperties } =>
  ({ className: `${cls} lp-up`.trim(), ...(d ? { style: { '--d': d } as CSSProperties } : {}) });

// Reveal-on-scroll hides blocks only once scripts run; the failsafe shows everything if they never do.
const FAILSAFE = "(function(){var d=document.documentElement;d.classList.add('lp-js');setTimeout(function(){if(!window.__lpReady)d.classList.remove('lp-js')},4000)})();";

const CADENCE = 'coding every four hours, reasoning and tool use daily, with an hourly canary probe';
const OPENNESS = 'The methodology is public — every weight, statistical test and drift constant. The test tasks are private, so no lab can train on them.';

/**
 * Each category, its page built from the live board, and where its definition is. Definitions as
 * on the methodology page and the best-for pages; the suite sizes come from the price snapshot.
 */
function jobsOf(price: PriceSnapshot | null) {
  const sessions = price?.reasoning?.tasks ?? 4;
  const toolTasks = price?.tooling?.tasks ?? 9;
  const days = price?.windowDays ?? 30;
  return [
    { label: 'Best AI model overall', href: '/best-ai-model', detail: 'The Combined board: coding 50%, reasoning 25%, tool use 25%, ranked with statistical ties.', how: '/methodology#ranks' },
    { label: 'Best LLM for coding', href: '/best-llm-for-coding', detail: 'The Coding board: repository debugging tasks graded by running the project’s own tests, including hidden tests the model never sees.', how: '/methodology#coding' },
    { label: 'Best LLM for reasoning', href: '/best-llm-for-reasoning', detail: `The Reasoning board: ${word(sessions)} long, multi-turn working sessions every day.`, how: '/methodology#reasoning' },
    { label: 'Best AI model for agents', href: '/best-ai-model-for-agents', detail: `The Tool use board: ${word(toolTasks)} tasks, each in a real sandboxed machine — either the job is done at the end or it is not.`, how: '/methodology#tooling' },
    { label: 'Best value AI model', href: '/best-value-ai-model', detail: `The lowest cost per correct coding answer over the last ${days} days, every attempt billed, among the models within five points of the best on the Coding board.`, how: '/methodology#quick' },
    { label: 'Fastest AI model', href: '/fastest-ai-model', detail: `The lowest median response time over the last ${days} days, among the same models within five points of the best on the Coding board.`, how: '/methodology#quick' },
  ];
}

const STEPS = [
  { title: 'Check the confidence intervals first', detail: 'The top few models are usually separated by less than their error bars, which means the ranking order between them is not statistically meaningful.' },
  { title: 'Sort by the axis you actually care about', detail: 'The coding, reasoning, speed, price and tool-calling views produce genuinely different orders.' },
  { title: 'Watch the drift alerts, not just the score', detail: 'A model that is quietly degrading is a worse bet than one scoring slightly lower but holding steady.' },
];

const measuresOf = (trials: number): [string, number, string][] => [
  ['Correctness', 60, 'Code is executed against the task’s tests — including, on repo tasks, tests the model never sees'],
  ['Stability', 10, `Consistency across the ${trials} trials of each task`],
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

const freeRequests = PLANS.free.routerRequestsPerMonth.toLocaleString('en-US');

/** The hub's questions; the same strings feed the visible rows and the FAQPage structured data. */
const FAQ: FaqItem[] = [
  {
    q: 'Which AI model is best for coding?',
    a: 'The model at the top of the Coding board over the window you choose — 24 hours, 7 days or 30 days. The board changes with every run, so this page never names one. It ranks with statistical ties: two models closer together than their standard errors share a place. The current board is on [best LLM for coding](/best-llm-for-coding).',
  },
  {
    q: 'Is Claude better than GPT for coding?',
    a: 'Open any Claude-vs-GPT head-to-head page below. It shows both models’ Coding scores with their standard errors and claims a lead only when the gap is beyond the measurement noise. Every such page is built from the same tasks: repository debugging graded by running the project’s own tests, including hidden tests the model never sees.',
  },
  {
    q: 'How often are the comparisons updated?',
    a: `Every model on the board runs the same tasks on the same schedule: ${CADENCE}. The comparison pages read the 24-hour board and refresh every fifteen minutes.`,
  },
  {
    q: 'Are the scores vendor-reported?',
    a: `No. Scores come from our own runs through each provider’s public API. Every model gets the same prompts and output budget, and the same sampling settings wherever a provider accepts them, and is graded by executing what it produces. ${OPENNESS}`,
  },
  {
    q: 'What does a statistical tie mean?',
    a: 'Every score carries a standard error from its own run-to-run repeatability. Walking down a board, a model joins the group above it unless that group’s leader is ahead by more than 1.96 times their combined standard error, so places such as 1, 1, 1, 4 are normal and a shared place is written joint. The rule is on the [methodology page](/methodology#ranks).',
  },
  {
    q: 'Can I route between models automatically?',
    a: `Yes. The Smart Router is one OpenAI-compatible endpoint with 14 auto-* routing modes: quality modes send each request to the model placing highest on the relevant board, value modes pick within 5 points of the best and then the cheapest measured cost per run, and routing is drift-aware by default. Your own provider keys, zero markup on tokens, and Free includes ${freeRequests} routed requests a month. The modes are described in the [router documentation](/router/docs#strategies).`,
  },
];

type Pair = [SeoModel, SeoModel];
const pairLabel = ([a, b]: Pair): string => `${a.displayName} vs ${b.displayName}`;
const byLabel = (x: Pair, y: Pair): number => pairLabel(x).localeCompare(pairLabel(y), 'en', { numeric: true });

function PairList({ pairs }: { pairs: Pair[] }) {
  return (
    <ul className="rd-tags">
      {pairs.map((p) => <li key={pairSlug(p[0], p[1])}><Link href={`/compare/${pairSlug(p[0], p[1])}`}>{pairLabel(p)}</Link></li>)}
    </ul>
  );
}

export default async function ComparePage() {
  const [roster, boards, price] = await Promise.all([getRoster(), getBoards24h(), getPrice()]);
  const of = (vendor: string) => modelsOfVendor(roster, vendor).sort(byDisplayName);
  const jobs = jobsOf(price);
  const measures = measuresOf(price?.coding?.trials ?? 7);

  const pairs = curatedPairs(roster, boards);
  const sameGroups = VENDORS
    .map((v) => ({ key: v.key, title: vendorMention(v), pairs: pairs.filter(([a, b]) => a.vendor === v.key && b.vendor === v.key).sort(byLabel) }))
    .filter((g) => g.pairs.length > 0);
  const crossGroups: { key: string; title: string; pairs: Pair[] }[] = [];
  for (let i = 0; i < VENDORS.length; i++) {
    for (let j = i + 1; j < VENDORS.length; j++) {
      const vi = VENDORS[i];
      const vj = VENDORS[j];
      const ps = pairs.filter(([a, b]) => (a.vendor === vi.key && b.vendor === vj.key) || (a.vendor === vj.key && b.vendor === vi.key)).sort(byLabel);
      if (ps.length) crossGroups.push({ key: `${vi.key}-${vj.key}`, title: `${vi.family} vs ${vj.family}`, pairs: ps });
    }
  }

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Compare', path: '/compare' }]),
    webPageLd({ path: '/compare', name: TITLE, description: DESCRIPTION, type: 'CollectionPage', ...(boards ? { dateModified: isoDay(boards.generatedAt) } : {}) }),
    faqLd(FAQ),
  ]);

  return (
    <SubpageLayout>
      <div className={`lp lp-sub cp-page ${lpBody.variable} ${lpDisplay.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: FAILSAFE }} />
        <LandingEffects />
        <JsonLd data={ld} />

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
                  Every model gets the same coding, reasoning and tool-use tasks on the same schedule, graded by running
                  what it produces. Pick a category below, or any two models for a head-to-head page.
                </p>
                <CtaRow className="lp-intro">
                  <LeaderboardCta cta="compare-hero-leaderboard" />
                  <RouterCta ghost cta="compare-hero-router" label="Let the router pick for you →" />
                </CtaRow>
              </div>
              <ul className="cp-provs lp-intro" style={intro('.34s')} aria-label="Families we track">
                {VENDORS.map((v) => {
                  const count = of(v.key).length;
                  return (
                    <li key={v.key}>
                      <span className="lp-lgc"><img src={`/logos/${v.key}.svg`} alt="" width={22} height={22} /></span>
                      <span><b>{vendorMention(v)}</b>{count > 0 && <small>{count} {count === 1 ? 'model' : 'models'} tracked</small>}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </header>

        <section className="lp-sec lp-A" aria-labelledby="cp-jobs">
          <div className="lp-wrap">
            <div className="lp-head lp-head-split lp-up">
              <p className="lp-kicker">Best for</p>
              <h2 className="lp-h2" id="cp-jobs">Best for each job</h2>
              <p className="lp-lead">
                The coding benchmark re-runs every four hours and the others daily, and the order genuinely changes,
                so we do not freeze a winner into this page — a hardcoded list here would be wrong within weeks. Each category has its own page built
                from the live board, ranked with statistical ties, which is the authoritative answer.
              </p>
            </div>
            <ol className="cp-leaders">
              {jobs.map((l, i) => (
                <li key={l.label} {...up(`${i * 0.05}s`)}>
                  <span className="cp-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{l.label}</h3>
                    <p>{l.detail}</p>
                  </div>
                  <span className="cp-go">
                    <Link className="lp-more" href={l.href}>See the board</Link>
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
              <h2 className="lp-h2" id="cp-matrix">The families we track</h2>
              <p className="lp-lead">
                The models listed under each family are the ones on the board today, each with its own page. The
                family page shows where all of them place on Coding, Reasoning and Tool use.
              </p>
            </div>
            <div className="cp-fams">
              {VENDORS.map((v, i) => {
                const models = of(v.key);
                return (
                  <article key={v.key} {...up(`${(i % 3) * 0.06}s`, 'cp-fam')}>
                    <header>
                      <span className="lp-lgc"><img src={`/logos/${v.key}.svg`} alt="" width={22} height={22} loading="lazy" /></span>
                      <h3>{vendorMention(v)}</h3>
                    </header>
                    <dl>
                      <div className="is-note">
                        <dt>Where they place</dt>
                        <dd><Link href={v.modelsPath}>See where its models place on Coding, Reasoning and Tool use</Link></dd>
                      </div>
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

        <section className="lp-sec lp-A" aria-labelledby="cp-pairs">
          <div className="lp-wrap">
            <div className="lp-head lp-head-split lp-up">
              <p className="lp-kicker">Head-to-head</p>
              <h2 className="lp-h2" id="cp-pairs">Head-to-head comparisons</h2>
              <p className="lp-lead">
                Two models side by side on the same boards: scores with statistical ties, list price per 1M tokens,
                response time, cost per correct answer and drift status, with a verdict computed from the data.
              </p>
            </div>
            {boards && <AsOf className="lp-up sp-index-asof">Pairs chosen from the roster and the 24-hour boards · as of {utcStamp(boards.generatedAt)}</AsOf>}
            {pairs.length > 0 ? (
              <div className="sp-index lp-up">
                {sameGroups.length > 0 && <h3>Same family, different versions</h3>}
                {sameGroups.map((g) => (
                  <div key={g.key} className="sp-index-group">
                    <h4>{g.title}</h4>
                    <PairList pairs={g.pairs} />
                  </div>
                ))}
                {crossGroups.length > 0 && <h3>Across vendors</h3>}
                {crossGroups.map((g) => (
                  <div key={g.key} className="sp-index-group">
                    <h4>{g.title}</h4>
                    <PairList pairs={g.pairs} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="lp-lead lp-up">Open any model page for its head-to-head links.</p>
            )}
          </div>
        </section>

        <section className="lp-sec lp-B" aria-labelledby="cp-coding">
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

        <section className="lp-sec lp-A" aria-labelledby="cp-results">
          <div className="lp-wrap">
            <div className="lp-head lp-head-split lp-up">
              <p className="lp-kicker">Scoring</p>
              <h2 className="lp-h2" id="cp-results">Benchmark results on a fixed schedule</h2>
              <p className="lp-lead">
                Every model runs on the same schedule: {CADENCE}. Key metrics of the coding score, by weight:
              </p>
            </div>
            <RdWeights rows={measures} label="Metric" />
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

        <section className="lp-sec lp-B" aria-labelledby="cp-faq">
          <div className="lp-wrap lp-faq">
            <div className="lp-head lp-up">
              <p className="lp-kicker">FAQ</p>
              <h2 className="lp-h2" id="cp-faq">Questions about comparing AI models</h2>
            </div>
            <Faq items={FAQ} />
          </div>
        </section>

        <RdFinal
          title="Stop choosing by hand"
          lead="A free account shows all four boards over 24 hours, 7 days and 30 days; the Smart Router sends each request to the model the boards favour for it, with your own provider keys."
          actions={(
            <CtaRow className="is-stack">
              <LeaderboardCta cta="compare-final-leaderboard" />
              <div className="seo-cta">
                <Link className="lp-btn lp-btn-ghost" href="/router/docs#strategies" data-cta="compare-final-router-docs">How the router decides</Link>
              </div>
            </CtaRow>
          )}
        />
      </div>
    </SubpageLayout>
  );
}
