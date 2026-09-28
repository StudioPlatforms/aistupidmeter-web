import type { Metadata } from 'next';
import Link from 'next/link';
import { DocPage, Section, Prose, Stats, Facts } from '@/components/docs/Doc';

export const metadata: Metadata = {
  title: 'AI Benchmarking Methodology | How We Test AI Models',
  description: 'How AI Stupid Level tests AI models: execution-based coding, reasoning and tool-use suites, the weights behind every score, statistical ties, Page-Hinkley drift detection and an hourly canary — every constant published.',
  keywords: [
    'AI benchmarking methodology',
    'How to test AI models',
    'AI performance testing framework',
    'LLM evaluation metrics',
    'AI drift detection algorithm',
    'AI benchmark scoring system',
    'Statistical AI testing',
    'Page-Hinkley drift detection',
    'Confidence intervals AI testing',
    'Objective AI measurement'
  ],
  alternates: { canonical: '/methodology' },
  openGraph: {
    title: 'AI Benchmarking Methodology | How We Test AI Models',
    description: 'Execution-based coding, reasoning and tool-use suites, published weights, statistical ties and drift detection with measured false-alarm rates.',
    url: 'https://aistupidlevel.info/methodology',
    type: 'article',
  }
};

/**
 * Live figures, read from the API at build/revalidate time.
 *
 * Every count on this page comes from here, never typed in: the enhanced-suite statuses were
 * once a hand-written claim, which is how the page came to advertise three suites that were
 * never switched on, and the corpus totals were hand-written and had drifted thousands of rows.
 */
interface SuiteStat { total: number; last30Days: number; lastRun: string | null; enabled: boolean }
interface CodingCorpus { repoTasks: number; hardFunctionTasks: number; floorChecks: number; total: number }
interface CorpusTotals { runs: number; toolSessions: number; deepSessions: number; incidents: number; coding?: CodingCorpus }
interface RankedModel { name: string; vendor: string }
interface EnhancedStatus {
  adversarial: SuiteStat;
  robustness: SuiteStat;
  bias: SuiteStat;
  scoredPromptVariation: boolean;
  corpus?: CorpusTotals;
  rankedModels?: RankedModel[];
}

// Regenerate hourly. The page stays static — no per-request fetch.
export const revalidate = 3600;

async function getEnhancedStatus(): Promise<EnhancedStatus | null> {
  // Absolute URL: a relative path has no origin server-side. Straight to the API on loopback.
  const base = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  try {
    const res = await fetch(`${base}/dashboard/enhanced-suites`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    // A failed fetch must not break the page: null renders as "unavailable", never a guess.
    return null;
  }
}

/** The tested models with their display names ("GPT-6 Astra", not "gpt-6-astra"), for links. */
async function getModelNames(): Promise<{ name: string; displayName: string }[]> {
  const base = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  try {
    const res = await fetch(`${base}/api/models`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const json = await res.json();
    const list = Array.isArray(json) ? json : json?.data;
    return Array.isArray(list)
      ? list.map((m: any) => ({ name: String(m.name), displayName: String(m.displayName || m.name) }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName, 'en', { numeric: true }))
      : [];
  } catch {
    return [];
  }
}

function suiteStatusLine(stat: SuiteStat | undefined): string {
  if (!stat) return 'Status unavailable';
  if (stat.total > 0) {
    const when = stat.lastRun ? new Date(stat.lastRun).toISOString().slice(0, 10) : 'unknown';
    return `Running — ${stat.total.toLocaleString('en-US')} results recorded, latest ${when}`;
  }
  if (stat.enabled) return 'Enabled, awaiting its first run';
  return 'Not running — 0 results recorded';
}

const n = (v?: number) => (typeof v === 'number' ? v.toLocaleString('en-US') : '—');

const CODING_WEIGHTS: [string, number, string][] = [
  ['Correctness', 55, 'Does the fix work? Graded by running the project’s tests'],
  ['Stability', 10, 'The same result attempt after attempt'],
  ['Edge cases', 10, 'Hidden tests the model never saw'],
  ['Debugging', 10, 'Did it find the real defect, not silence the symptom?'],
  ['Code quality', 5, 'Clean, maintainable code'],
  ['Efficiency', 5, 'Output throughput'],
  ['Format', 3, 'Guardrail: clean, parseable output'],
  ['Safety', 2, 'Guardrail: no dangerous operations'],
  ['Complexity', 0, 'Measured and shown, but cannot separate models (below)'],
];

const TOOL_WEIGHTS: [string, number, string][] = [
  ['Task completion', 30, 'Is the job actually done at the end?'],
  ['Tool selection', 20, 'The right tool for each step'],
  ['Parameter accuracy', 15, 'Called with the correct arguments'],
  ['Efficiency', 15, 'No unnecessary calls'],
  ['Error handling', 10, 'Recovering when a call fails'],
  ['Context awareness', 5, 'Carrying earlier output forward'],
  ['Safety compliance', 5, 'Avoiding destructive operations'],
];

// Effective shares, not the raw weights in deepbench/tasks.ts: the scorer divides by the weights
// of the measures a session actually yields. Measured 2026-09-27 by re-scoring every session
// since 23 Sep with the production scorer: plan coherence is never taken on IDE assistant or
// Document memory (no plan is asked for), and recovery only in sessions where a step failed
// (~15%; never on Document memory). Columns: correctness, memory, plan, context — in a session
// with no failed step — then recovery's share in a session where one failed. null = not measured.
const DEEP_TASKS: { task: string; what: string; w: (number | null)[] }[] = [
  { task: 'IDE assistant', what: 'Debug and extend a shopping-cart module over five turns', w: [69, 23, null, 8, 13] },
  { task: 'Spec follow', what: 'Build to a written specification, with requirements added partway through', w: [38, 25, 25, 13, 11] },
  { task: 'Document memory', what: 'Answer chained questions about a long document', w: [40, 40, null, 20, null] },
  { task: 'Refactor project', what: 'Split a tangled application into modules over six turns', w: [33, 20, 33, 13, 12] },
];

const TOC = [
  { id: 'reading', label: 'Reading the leaderboards' },
  { id: 'score', label: 'The combined score' },
  { id: 'coding', label: 'Coding suite' },
  { id: 'reasoning', label: 'Reasoning suite' },
  { id: 'tooling', label: 'Tool-use suite' },
  { id: 'canary', label: 'Hourly canary' },
  { id: 'ranks', label: 'Uncertainty and ranks' },
  { id: 'drift', label: 'Drift detection' },
  { id: 'community', label: 'Community-funded models' },
  { id: 'quick', label: 'Quick answers' },
  { id: 'extra', label: 'Other test suites' },
  { id: 'context-rot', label: 'Context rot (pilot)' },
  { id: 'data', label: 'Data to date' },
  { id: 'api', label: 'Data API' },
  { id: 'compare', label: 'Compared with other benchmarks' },
];

export default async function MethodologyPage() {
  const [status, named] = await Promise.all([getEnhancedStatus(), getModelNames()]);
  const corpus = status?.corpus;
  const coding = corpus?.coding;
  const models = named.length ? named : (status?.rankedModels ?? []).map((m) => ({ name: m.name, displayName: m.name }));

  return (
    <DocPage
      kicker="Methodology"
      title="How we test AI models and detect drift"
      lead="Every model is given the same tasks on a fixed schedule, graded by running what it produces, and compared with its own past. Every weight, threshold and statistical rule behind the numbers on this site is on this page."
      toc={TOC}
      actions={(
        <>
          <a className="doc-btn is-primary" href="/asl-public-benchmark-methodology-2026.pdf" target="_blank" rel="noopener noreferrer"
             aria-label="Download the AI Stupid Level public benchmark methodology paper, PDF, 14 pages">
            Methodology paper (PDF, 14 pages)
          </a>
          <Link className="doc-btn" href="/">View the leaderboards</Link>
          <Link className="doc-btn" href="/faq">FAQ</Link>
        </>
      )}
    >
      <Section id="reading" title="Reading the leaderboards"
        lead="The home page shows four leaderboards of the same models. Visitors choose how they are laid out; the numbers are identical in every layout.">
        <Prose>
          <p>The four boards are <b>Combined</b>, <b>Coding</b>, <b>Reasoning</b> and <b>Tool use</b>, each with the best model at the top. Combined weights coding 50% and reasoning and tool use 25% each. Coding is re-measured every four hours, reasoning and tool use once a day.</p>
        </Prose>
        <Facts rows={[
          ['“=4”', <>A statistical tie: the models sharing the rank are closer than the measurement can separate. A rank without “=” stands on its own. <a key="r" href="#ranks">How ties are decided</a>.</>],
          ['Amber “5/7 tasks”', 'The provider declined some tasks, and the model was graded on the rest.'],
          ['Grey group at the foot', <>Models with no current rank on that board. <a key="c" href="#community">Community-funded</a> models show the date of their last funded run.</>],
          ['Latest, 24H, 7D, 1M', 'Latest is the newest score; the others average the real measurements in the window. Seven days of history are free; the month view is on paid plans.'],
        ]} />
        <Prose>
          <h3>The four layouts</h3>
          <p>A first-time visitor picks one. The choice is kept in the browser, and in the account when signed in (Settings → Leaderboard layout). The Layout button above the boards changes it at any time, and “How to read this” explains the layout on screen.</p>
        </Prose>
        <Facts rows={[
          ['Connected (default)', 'Each board is a column and a line joins the same model across them, so where it is strong and where it slips reads at a glance. Click a model to follow it; the bar above shows its place on all four.'],
          ['Side by side', 'The four boards as four full lists. On a phone, swipe between them.'],
          ['Table', 'One row per model: all four scores, each with its rank on that board, plus price. Click a heading to rank by it.'],
          ['Top 5', 'The first five of each board, the community-funded models in a strip of their own, and one full board underneath with a tab per board.'],
        ]} />
        <Prose>
          <h3>Around the boards</h3>
          <ul>
            <li><b>Your watchlist</b>, above the boards when signed in: every model you have starred, with its place on each board. Starring a model also switches on email for it — a weekly summary, and an alert when its measured coding score is five or more points below a week earlier (adjustable on paid plans) or a task-level regression is open.</li>
            <li><b>Needs attention</b>, only when a measured problem exists, and <b>Quick answers</b> — <a href="#quick">how they are picked</a>.</li>
            <li><b>Compare models</b>: a heatmap of every model&apos;s measures, a radar of the top and bottom three, and a price-performance table (score per dollar of list price), switched between boards by the tabs above them.</li>
            <li><b>Providers and method</b>: each provider&apos;s live status from a check every ten minutes, a trust score from its incident history, and the test schedule.</li>
            <li>The <b>Drift monitor</b> view, next to Leaderboard at the top, compares every model with its own past rather than with the other models.</li>
          </ul>
        </Prose>
      </Section>

      <Section id="score" title="The combined score"
        lead="A plain weighted mean of the three suites: coding 50%, reasoning 25%, tool use 25%. There is no curve, gate or penalty on top.">
        <Prose>
          <p>A suite that is missing, or older than two of its own runs (8 hours for coding, 48 for reasoning and tool use), drops out and the remaining suites are reweighted by their base weights. It is never filled in with a placeholder value. The board says so: a partial row carries a note such as “2 of 3 suites”, and a row with nothing fresh enough is not ranked.</p>
          <p>Every score records the exact version of the tests it ran under — a fingerprint of every prompt, test and check — so a change we make is never mistaken for a change the model made. Scores are the model as served through its provider&apos;s public API, run with our own keys (the one exception is <a href="#community">community-funded runs</a>).</p>
        </Prose>
      </Section>

      <Section id="coding" title="Coding suite"
        lead={`Every four hours. ${coding ? `${coding.total} tasks — ${coding.repoTasks} repository debugging tasks${coding.hardFunctionTasks ? ` and ${coding.hardFunctionTasks} hard single-function task${coding.hardFunctionTasks > 1 ? 's' : ''}` : ''}` : 'Seven tasks'}, all run every sweep, seven attempts each, graded by execution.`}>
        <div className="doc-table-wrap is-narrow">
          <table className="doc-table">
            <thead><tr><th>Measure</th><th className="num">Weight</th><th>What it measures</th></tr></thead>
            <tbody>
              {CODING_WEIGHTS.map(([name, w, note]) => (
                <tr key={name}><td>{name}</td><td className="num">{w}%</td><td className="doc-muted">{note}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <Prose>
          <p><b>Why these weights.</b> They follow what each measure can actually tell apart, not how important it sounds, measured by averaging each model over several sweeps and taking the spread between models. Complexity varies by four thousandths across the fleet, so it cannot move anyone&apos;s rank and carries no weight (it used to carry 20%); it is still measured and shown. Format and safety are guardrails that sit near 100% for everyone by design — their job is to cost a model points if it ever emits malformed or dangerous code.</p>
          <h3>What the suite asks</h3>
          <p>Most tasks hand the model a small working project and a bug report written as a user complaint — not a diagnosis, and no file named. The cause sits a module away from the symptom, with a plausible decoy in between. The model must find the defect and return a corrected file, which is graded by running the project&apos;s own test suite.</p>
          <p><b>Hidden tests</b> the model never sees make up three quarters of each repository task&apos;s score. On one task, deduplicating payments by amount makes every visible test pass and is still wrong — it stops a customer legitimately buying the same item twice. Eight of eighteen fleet runs took exactly that shortcut; without hidden tests all eight would score full marks.</p>
          <p><b>What gets retired.</b> A task everybody passes ranks nobody. Single-function tasks stopped separating models in 2026 — eight were passing at 99–100% across the fleet and were retired in September 2026, and nine deliberately hard replacements were mostly solved perfectly by every model. A new task ships only if every hidden assertion traces to the bug report and at least a fifth of the fleet fails it across three independent runs.</p>
          <p><b>Only the answer is graded</b>, never a model&apos;s hidden reasoning. An attempt that uses its whole output budget without answering, or answers without code, is a failed attempt, and a retry asks the identical question.</p>
          <h3>When a model declines a task</h3>
          <p>Some providers refuse entirely benign prompts. A refusal is a content decision, not a measure of ability, so it is not scored as zero: the task drops out and the model is scored on what it attempted. Declined tasks tend to be the hard ones, so such a row shows its coverage (“5/7 tasks”), the model page names the declined tasks, and the model is never called tied with one measured on all of them.</p>
        </Prose>
      </Section>

      <Section id="reasoning" title="Reasoning suite"
        lead="Daily at 03:00 Berlin time. Four long working sessions of five or six turns, every day; the daily score is their mean.">
        <Prose>
          <p>Each session builds on its own earlier turns, and when the model&apos;s work fails it is told so the way a colleague would — without being handed the error. Five measures, weighted per task: <b>correctness</b>, <b>recovery</b> after a failed step, and three continuity measures — <b>memory retention</b>, <b>plan coherence</b> and <b>context use</b>. Continuity is checked by running code, not by matching words: rules stated once in the conversation (at the start, or partway through while the model is working on something else) and the decisions a model declares in its own plan are tested at every later step. A session may run for up to ninety minutes; a task a model declines or does not finish in that time drops out, and the row says so.</p>
        </Prose>
        <div className="doc-table-wrap">
          <table className="doc-table">
            <thead>
              <tr><th>Task</th><th className="doc-hide-sm">What it asks</th><th className="num">Correctness</th><th className="num">Memory</th><th className="num">Plan</th><th className="num">Context</th><th className="num">Recovery*</th></tr>
            </thead>
            <tbody>
              {DEEP_TASKS.map((t) => (
                <tr key={t.task}><td>{t.task}</td><td className="doc-muted doc-hide-sm">{t.what}</td>{t.w.map((w, i) => <td key={i} className="num">{w === null ? '—' : `${w}%`}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <Prose>
          <p className="doc-muted doc-note">Share of the task&apos;s score each measure carries in a normal session. A measure the session gives no evidence for drops out and the rest are rescaled; it is never scored as zero. Plan coherence is not taken on tasks that ask for no plan. *Recovery counts only in a session where a step failed and the model was asked again — since 23 September about one Spec follow or Refactor project session in seven, and no IDE assistant session — taking the share shown and scaling the others down. A document answer is never re-asked, so Document memory has none. Rounded.</p>
        </Prose>
      </Section>

      <Section id="tooling" title="Tool-use suite"
        lead="Daily at 04:00 Berlin time. Nine tasks, each in a real sandboxed machine: either the job is done at the end or it is not.">
        <div className="doc-table-wrap is-narrow">
          <table className="doc-table">
            <thead><tr><th>Measure</th><th className="num">Weight</th><th>What it measures</th></tr></thead>
            <tbody>
              {TOOL_WEIGHTS.map(([name, w, note]) => (
                <tr key={name}><td>{name}</td><td className="num">{w}%</td><td className="doc-muted">{note}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <Prose>
          <p>Each model sees its own tool calls and their results in its provider&apos;s native tool format, with its own reasoning carried between calls. Until 23 September 2026 results came back as plain chat text, and some models read that as the call never having run and repeated it — part of what the suite measured was our transcript format.</p>
        </Prose>
      </Section>

      <Section id="canary" title="Hourly canary"
        lead="Two fixed probes, two attempts each, every hour — there to catch a model collapsing this afternoon, not a slow decline.">
        <Facts rows={[
          ['Probes', 'prime_check and merge_intervals, 4,000-token answer budget; an attempt that errors is not measured, not zero'],
          ['Test', 'Welch’s t-test on two windows — the last 6 hours and the last 24 hours — each against the prior 7 days on the same test version'],
          ['Fires when', 'the fall is at least 12 points at p < 0.01; it closes itself when the gap does'],
          ['Cold start', 'about four days after a test-version change before it can fire'],
        ]} />
        <Prose>
          <p><b>Corrected in September 2026.</b> Until 13 September 2026 this suite raised an incident on any 10% fall in a 24-hour mean, with no significance test, on answers cut off at 500 tokens. The 446 incidents it produced are retracted and excluded from every count on this site. The drift signature had a related fault — it mixed the three suites&apos; different scales — and the 46 provider-wide incidents and 1,145 change points recorded before that date came from it.</p>
        </Prose>
      </Section>

      <Section id="ranks" title="Uncertainty and ranks"
        lead="Every number on the board carries a standard error measured from its own repeatability, and a rank is only given where the measurement can support it.">
        <Prose>
          <p><b>The standard error</b> of a score is its run-to-run repeatability: each suite&apos;s last five measured runs on its current test version, combined with the composite&apos;s weights (SE² = Σ (wᵢ/W)² SEᵢ²). The interval shown is ±1.96 SE. The day after a test-version change there are not yet five runs, and the suite&apos;s typical spread is used instead (coding 2, tool use 1.5, reasoning 8 points).</p>
          <p><b>Seven attempts per coding task</b> collapse to one outcome per task by median, so one unlucky attempt cannot move a task. The interval on the board comes from repeatability across runs, not from the attempts.</p>
          <p><b>How a rank is assigned.</b> Ranks follow the board. Walking down it in score order, a model shares the rank of the group above it when it is not measurably worse than that group&apos;s leader — its highest-scoring member — meaning the leader is ahead by no more than 1.96 × √(SE<sub>leader</sub>² + SE<sub>model</sub>²), a two-sample test at 95%. Otherwise it opens a new group at its own position, so 1, 1, 1, 4 is expected. Comparing with the group&apos;s leader rather than the model directly above stops a chain of individually unresolvable gaps from merging models whose ends are far apart. A model graded on fewer tasks than the rest keeps its position and is never called tied.</p>
        </Prose>
      </Section>

      <Section id="drift" title="Drift detection"
        lead="Each suite has its own Page-Hinkley change-point detector, run on daily results and never on a blend of suites. A model's drift status is the most severe of its suites.">
        <Prose>
          <p>Page-Hinkley is a cumulative-sum detector. Scores are on a 0–1 scale; with mean<sub>t</sub> the running mean since the last reset, it accumulates m<sub>t</sub> = m<sub>t−1</sub> + (mean<sub>t</sub> − x<sub>t</sub> − δ) and alerts when m<sub>t</sub> − min(m) exceeds λ, then resets fully so it can re-learn the new level. Daily noise cancels out; a real sustained decline builds up. (The database column is still called <code>cusum</code> for historical reasons.)</p>
        </Prose>
        <Facts rows={[
          ['Tolerance δ', '0.01 — one point of the 0–100 score'],
          ['Threshold λ', '0.30 for coding and reasoning; 0.50 for tool use, which must also stay above it for three consecutive daily runs'],
          ['Cold start', 'ten daily results on the current test version before it can fire'],
          ['Alert levels', 'NORMAL; WARNING when a statistic is more than halfway to its threshold or recent scores are unusually spread; ALERT when a statistic crosses its threshold or the model is measurably below its own 28-day baseline'],
        ]} />
        <Prose>
          <h3>What it can and cannot see — measured</h3>
          <p>A detector is only worth trusting if two numbers are known: how often it fires when nothing changed, and how reliably it fires when something did. Both are measured on the production code path by injecting a sustained drop of known size into a stationary series (400 repetitions per cell) and by running it on series with no change at all. “Detected” means within 30 days; the delay is the median days to the first alert.</p>
        </Prose>
        <div className="doc-table-wrap">
          <table className="doc-table">
            <thead><tr><th>Day-to-day noise</th><th className="num">3-pt drop</th><th className="num">5 pts</th><th className="num">8 pts</th><th className="num">10 pts</th><th className="num">False alarms</th></tr></thead>
            <tbody>
              <tr><td>sd 1.5</td><td className="num">91% (18d)</td><td className="num">100% (8d)</td><td className="num">100% (4d)</td><td className="num">100% (3d)</td><td className="num">0 in 44,000 days</td></tr>
              <tr><td>sd 3</td><td className="num">88% (15d)</td><td className="num">100% (7d)</td><td className="num">100% (4d)</td><td className="num">100% (3d)</td><td className="num">1 per ~4,400 days</td></tr>
              <tr><td>sd 5</td><td className="num">84% (11d)</td><td className="num">98% (5d)</td><td className="num">99% (3d)</td><td className="num">99% (2d)</td><td className="num">1 per ~180 days</td></tr>
            </tbody>
          </table>
        </div>
        <Prose>
          <p>Measured on the current tests, the median model&apos;s day-to-day spread is 2.0 points on reasoning (16–22 September 2026) and 3.9 on tool use (14–22 September; 2.1 to 7.2 across models). That is why tool use has its own, stricter rule: at its noise the shared rule would raise about two false alarms a month across the fleet, while the stricter one is simulated at about one every three to four months. The price is small drops — a sustained 3-point decline in tool use is caught within 30 days less than half the time; a 5-point one is still caught 96% of the time, in a median of 15 days.</p>
          <p><b>What it will miss:</b> a sustained drop of about 2 points or less, and — by design — a one-day dip of any size. That is the canary&apos;s job.</p>
          <p><b>Reproduce it:</b> <code>node dist/jobs/validate-drift-detector.js</code> in the API repository; deterministic seed, and the table above is its output.</p>
          <h3>Change points</h3>
          <p>Separately, every hour the coding series on its current test version is checked for a step: the last 3, 5 and 10 runs against the same number before them (Mann-Whitney U at p &lt; 0.05 with a move of more than 5 points, or non-overlapping intervals and more than 8). A step found at two of the three window sizes, or any step of 15 points or more, is recorded as a change point. Change points are a record for our own investigation; they do not set a model&apos;s status and are not the alerts sent to watchers. A model that alternates between passing and failing one task produces them, which is why they are not published as findings.</p>
        </Prose>
      </Section>

      <Section id="community" title="Community-funded models"
        lead="For five models we stopped paying for the reasoning and tool-use suites. Anyone can fund those runs; the coding suite, the canary and drift monitoring continue on our account.">
        <Prose>
          <p>From 24 September 2026, the reasoning and tool-use runs for Claude Sonnet 4.6, Claude Opus 4.6, 4.7 and 4.8 and GPT-5.5 are funded by the community. A signed-in visitor can fund one run per test per model per day from the model&apos;s page, paying with their own API key. The run is exactly our scheduled test, on our servers, and its result is published like any other; the key is used for that run only and never stored.</p>
          <p>On the boards these models stay ranked on <b>Coding</b>. On <b>Reasoning</b> and <b>Tool use</b> they sit in a community-funded group at the foot of the board, with the date of their last funded run, and are not ranked until a new run is funded. On <b>Combined</b> their score is coding only, so they are listed but not ranked against models measured on all three suites.</p>
        </Prose>
      </Section>

      <Section id="quick" title="Quick answers"
        lead="Each card under the boards has one stated definition. Only models measured on every suite and task qualify.">
        <Facts rows={[
          ['Best for code', 'The highest score on the coding board.'],
          ['Most reliable', 'The smallest spread of its coding score over its recent runs on one test version (at least five runs), among the models within five points of the top.'],
          ['Fastest response', 'The lowest median response time over the last 48 hours (at least five runs), among the models within five points of the top.'],
          ['Best value', 'The most points per measured dollar of one identical coding run — every attempt billed — among the models within five points of the top.'],
          ['Poor value', 'Another ranked model scores at least as high for a third of the cost per coding run, or less. A price judgement, not a fault.'],
          ['Needs attention', 'Genuine problems only: a serious measured degradation, a score of 55 or below, or unusually high run-to-run variance.'],
        ]} />
        <Prose>
          <p>For these cards cost is measured, not list price: every model runs the same seven coding tasks and every attempt is billed, so a verbose model costs what it really costs per task. The price-performance table beside them uses list price.</p>
        </Prose>
      </Section>

      <Section id="extra" title="Other test suites"
        lead="Run as separate sweeps so the scored series stays a clean capability measurement. None of these feeds a leaderboard score. Statuses are read from the database hourly.">
        <Facts rows={[
          ['Adversarial safety', <>18 probes across five attack types — jailbreak, injection, extraction, manipulation and harmful content. One probe per model per four-hour run, rotating.<span key="s" className="doc-fact-sub">{suiteStatusLine(status?.adversarial)}</span></>],
          ['Prompt robustness', <>11 variations — paraphrase, restructure, style change. The same task reworded and scored by the same runner, so a variant score compares with a real one.<span key="s" className="doc-fact-sub">{suiteStatusLine(status?.robustness)}</span></>],
          ['Bias detection', <>19 variants across gender, ethnicity and age, plus a neutral baseline. The nightly sweep takes one variant from each category.<span key="s" className="doc-fact-sub">{suiteStatusLine(status?.bias)}</span></>],
          ['Version tracking', 'Every score records the test version it ran under. Detecting a provider’s own model-version change is not yet implemented.'],
        ]} />
      </Section>

      <Section id="context-rot" title="Context rot (pilot)"
        lead="Does a model get worse as its context gets longer? A weekly suite, separate from the leaderboard, measures it from 8K to 1M tokens.">
        <Prose>
          <p>Each week every pilot model reads the same kind of document — an archive of company records — at 8K, 32K, 128K, 256K, 512K and 1M tokens (as far as its context window allows), three times at each length, and answers sixteen questions graded exactly: finding a fact placed 10% to 90% of the way through, linking facts across the document, tracking a value that changes and is sometimes withdrawn, and counting across the whole archive. Every fact is written in the same record format as thousands of look-alikes, because a fact that stands out by its format can be found at any length. The pilot covers DeepSeek, Kimi and GLM; OpenAI, Anthropic, Google and more providers will follow. The results are on the <Link href="/context-rot">context rot page</Link> for Pro Intelligence and above.</p>
        </Prose>
      </Section>

      <Section id="data" title="Data to date"
        lead="Counted from the database when this page was last generated, since the first benchmark on 8 August 2025.">
        <Stats items={[
          { value: n(corpus?.runs), label: 'benchmark runs (individual task attempts)' },
          { value: n(corpus?.toolSessions), label: 'tool-use sessions' },
          { value: n(corpus?.deepSessions), label: 'reasoning sessions' },
          { value: n(corpus?.incidents), label: 'change points and incidents on record' },
        ]} />
        <Prose>
          <p className="doc-muted doc-note">Runs are individual task attempts, all real executions. Retracted incidents are excluded from the last figure; 1,145 of the change points in it predate 13 September 2026 and came from the mixed-suite series described under <a href="#canary">Hourly canary</a>.</p>
          <h3>Models tested ({models.length || '—'})</h3>
          <p>
            {models.length
              ? models.map((m, i) => <span key={m.name}>{i > 0 && ' · '}<Link href={`/models/${m.name}`}>{m.displayName}</Link></span>)
              : 'Unavailable right now.'}
          </p>
        </Prose>
      </Section>

      <Section id="api" title="Data API"
        lead="The same data, as JSON, at /api/v1. A free key is required and takes about thirty seconds to create.">
        <Facts rows={[
          [<code key="a">GET /api/v1/models</code>, 'Current rankings with confidence intervals'],
          [<code key="b">GET /api/v1/models/:id/history?period=7d</code>, 'Historical series'],
          [<code key="c">GET /api/v1/models/:id</code>, 'One model in detail'],
          [<code key="d">GET /api/v1/analytics/degradations</code>, 'Models currently degrading, with magnitude'],
          ['Limits', 'Free 10 requests a day (1 a minute) · Pro 10,000 a day (60 a minute) · Developer 25,000 a day (120 a minute) · Teams 100,000 a day (300 a minute); X-RateLimit headers on every response, 429 when exceeded, daily quotas reset at 00:00 UTC'],
        ]} />
        <Prose>
          <p><Link href="/account/data-keys">Create a key</Link> · <Link href="/api-docs">Full API reference</Link>. Volume beyond these tiers and commercial redistribution are arranged directly — <Link href="/contact">get in touch</Link>.</p>
        </Prose>
      </Section>

      <Section id="compare" title="Compared with other benchmarks">
        <Facts rows={[
          ['HumanEval', 'Single-shot pass/fail on well-known functions. Here: repository debugging with hidden tests, seven attempts, an interval on every score.'],
          ['MMLU', 'Multiple choice. Here: the model’s code is executed and its tool use happens in a real machine.'],
          ['Chatbot Arena', 'Human preference votes. Here: objective execution against tests.'],
          ['Vendor benchmarks', 'Run once at launch by the company selling the model. Here: re-run on a schedule, independently, for as long as the model is served.'],
        ]} />
        <Prose>
          <p><b>Check it yourself.</b> <Link href="/router/test-keys">Test your keys</Link> runs the same tasks with your own API keys and scores them with the same code as our published runs. The <a href="https://github.com/StudioPlatforms/aistupidmeter-web" target="_blank" rel="noopener noreferrer">web application is open source</a>; the task bank is kept private, because when it was public providers optimised against it.</p>
        </Prose>
      </Section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: 'How AI Stupid Level Tests AI Models',
            description: 'Methodology for benchmarking AI models with published weights, measured uncertainty and drift detection',
            step: [
              { '@type': 'HowToStep', name: 'Execute benchmark tasks', text: 'Run every coding task seven times every four hours, and the reasoning and tool-use suites daily; grade by executing what the model produces, including hidden tests' },
              { '@type': 'HowToStep', name: 'Score with published weights', text: 'Combine the nine coding measures, five reasoning measures and seven tool-use measures by published weights; the combined score is coding 50%, reasoning 25%, tool use 25%' },
              { '@type': 'HowToStep', name: 'Measure uncertainty', text: 'Measure each score\u2019s standard error from its run-to-run repeatability, publish a 95% interval, and give models a shared rank when the leader of their group is not measurably ahead' },
              { '@type': 'HowToStep', name: 'Detect drift', text: 'Run a Page-Hinkley change-point detector on each suite\u2019s daily series and an hourly canary tested with Welch\u2019s t-test' },
            ],
          }),
        }}
      />
    </DocPage>
  );
}
