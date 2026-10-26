import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import DriftChart from '@/components/landing/DriftChart';
import { ReadingPage, RdSection, RdProse, RdRows, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { Verdict } from '@/components/seo/Verdict';
import { CtaRow, WatchCta } from '@/components/seo/Cta';
import { DriftMonitorNow } from '@/components/seo/worse/DriftMonitorNow';
import { WorseFaq, type WorseFaqItem } from '@/components/seo/worse/WorseFaq';
import { ALERT_RULE, CADENCE, FREE_TIER } from '@/components/seo/worse/WorsePage';
import { DRIFT_SUITES, fleetCounts, getWorseData, listJoin, numWord, verdictSentence } from '@/components/seo/worse/worse-data';
import { HUB_H1, WORSE_HUB_PATH, WORSE_VENDORS, worseH1, worsePath, worseVendor } from '@/components/seo/worse/worse-meta';
import { PLANS } from '@/lib/entitlements';
import { breadcrumbLd, faqLd, graphLd, isoDay, pageMeta, utcStamp, webPageLd } from '@/lib/seo';
import { VENDORS, vendorMention } from '@/lib/seo-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';
import '@/styles/seo-worse.css';

/**
 * Topic page for AI drift detection / model degradation: what drift is, what causes it, how
 * the Page-Hinkley detector confirms it, what is measured, and — read at render time — the
 * state of every model's per-suite detector ("Drift monitor now") with links to the
 * "is your AI getting worse" hub and its family pages. Reading components throughout; the one
 * figure is the landing's Page-Hinkley illustration, drawn once when it scrolls into view.
 * ISR every fifteen minutes; no auth(), no cookies(). Static copy names vendors and families
 * only; every count, verdict and detector state comes from the 24-hour boards and the drift
 * signatures (components/seo/worse/worse-data.ts).
 */

const PATH = '/ai-drift-detection';
const TITLE = 'AI drift detection: is your model worse?';
const DESCRIPTION = 'AI drift detection: how to tell when a model degrades behind a stable API name. Page-Hinkley (CUSUM-family) detection per suite, with the detectors’ state.';
const HEADLINE = 'AI drift detection: is your model getting worse?';

export const metadata: Metadata = pageMeta({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  type: 'article',
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
    'Page-Hinkley (CUSUM-family) drift detection',
    'change point detection LLM',
    'silent model updates',
    'AI model nerfed',
    'LLM performance tracking over time',
    'AI model consistency monitoring',
  ],
});

export const revalidate = 900;

const FREE = PLANS.free;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const TOC = [
  { id: 'drift', label: 'What is AI drift?' },
  { id: 'causes', label: 'What causes it' },
  { id: 'detection', label: 'How we detect it' },
  { id: 'monitor', label: 'Drift monitor now' },
  { id: 'coverage', label: 'What we measure' },
  { id: 'families', label: 'By family' },
  { id: 'why', label: 'Why it matters' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

/** The vendors and the product families, as the registry writes them: nothing typed by hand. */
const VENDOR_LIST = listJoin(VENDORS.map(vendorMention));
const FAMILY_LIST = listJoin(VENDORS.map((v) => v.family));

export default async function AiDriftDetectionPage(): Promise<JSX.Element> {
  const data = await getWorseData();
  const counts = fleetCounts(data.models);
  const verdict = verdictSentence(data.models, null);
  const stamp = data.asOf ? utcStamp(data.asOf) : null;
  const coldDays = numWord(data.models.flatMap((m) => m.detectors).find((d) => d.kind !== 'none')?.coldStart ?? 10);
  const families = WORSE_VENDORS.map((k) => {
    const v = worseVendor(k);
    const mine = data.models.filter((m) => m.model.vendor === k);
    return { key: k, path: worsePath(k), question: worseH1(k), family: v.family, verdict: verdictSentence(mine, v.family) };
  });
  const familyLinks = families.map((f) => `[${f.question}](${f.path})`).join(', ');
  const fallbackLead = 'Every model on the board has a Page-Hinkley detector per suite, read from the same signature the leaderboard shows.';

  /* ── FAQ: the same strings feed the page and the FAQPage structured data ── */
  const faq: WorseFaqItem[] = [
    {
      q: 'What is AI drift detection?',
      a: 'AI drift detection is the practice of continuously measuring a model\'s output quality so you can tell when it changes. Because providers serve updated models behind stable API names, the version you call today may not behave like the one you tested against months ago. Drift detection replaces the anecdotal "it feels worse lately" with a measurement you can point at.',
    },
    {
      q: 'What causes AI model degradation?',
      a: 'Several things: a provider silently swapping in a new checkpoint, changes to safety filters that increase refusals, quantisation or serving-stack changes made to cut inference cost, altered default sampling parameters, and capacity pressure during peak demand. From outside, intent is invisible; what you can observe is that the same prompt now returns different output. Each cause leaves its own trace on fixed tasks — a new build identifier, longer answers, a refusal rate, higher run-to-run variance — which is why the suites record more than correctness.',
    },
    {
      q: 'How can I tell if ChatGPT or Claude is actually getting worse?',
      a: `You need a fixed test set, repeated runs, and a statistical baseline. A single bad response proves nothing — model output is stochastic, so quality varies run to run even with no change at the provider. The signal you want is a sustained shift in the average across many runs, which is exactly what change-point detection is designed to isolate. The answer from our own tests, model by model, is on the family pages: ${familyLinks}.`,
    },
    {
      q: 'What is the Page-Hinkley test and why use it for drift detection?',
      a: 'The Page-Hinkley test is a cumulative-sum (CUSUM-family) change-point detector. It keeps a running total of how far each new observation falls below the running mean, less a small tolerance, and compares that total with its own lowest point so far. Random fluctuations have no consistent sign and cancel out; a genuine sustained decline accumulates until the statistic crosses a decision threshold and a drift event fires. That makes it far better suited to catching gradual decline than a simple threshold alarm, which either fires constantly on noise or misses slow degradation entirely. We run it on each model\'s daily median score, suite by suite, and the constants are published on the [methodology page](/methodology#drift).',
    },
    {
      q: 'How often do you check for model drift?',
      a: `The coding suite runs every four hours, the reasoning suite (all four sessions) and the tool-use suite (nine tasks) once a day, and a two-probe canary every hour. The Page-Hinkley statistic is computed per suite on daily medians, so it confirms a sustained shift over days rather than reacting to one bad hour. The canary's Welch test is the fast instrument for a collapse: in a replay over the record, an injected fall from 100 to 50 was caught 22 times out of 22, with a median delay of four hours. A suite that could not run — a provider outage, or a prompt the provider declined — drops out of the composite, which is labelled with how many suites contributed.`,
    },
    {
      q: 'Which models do you monitor for degradation?',
      a: `Current models across ${VENDOR_LIST} — the ${FAMILY_LIST} lines${counts.onBoard > 0 ? `; ${counts.onBoard} models are on the 24-hour boards` : ''}. Every model on the leaderboard has its own page with its score history and its per-suite detector state, and the whole board is answered at once on [Is your AI getting worse?](${WORSE_HUB_PATH}).`,
    },
    {
      q: 'Is ChatGPT getting worse? Is Claude getting worse?',
      a: `Each family has a page that answers from the 24-hour boards and the per-suite detectors, model by model. ${families.filter((f) => f.verdict).map((f) => `${f.family}: ${f.verdict}`).join(' ')}${families.some((f) => f.verdict) ? ' ' : ''}The pages are ${familyLinks}.`,
    },
  ];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'AI drift detection', path: PATH }]),
    webPageLd({
      path: PATH,
      name: HEADLINE,
      description: DESCRIPTION,
      type: 'Article',
      about: ['AI drift detection', 'AI model degradation', 'LLM monitoring'],
      ...(data.asOf ? { dateModified: isoDay(data.asOf) } : {}),
    }),
    faqLd(faq),
  ]);

  const familyRows = families.map((f): [ReactNode, ReactNode] => [
    <Link key={f.key} href={f.path}>{f.question}</Link>,
    f.verdict ?? `Every ${f.family} model on the board, on the same tests, with a detector per suite.`,
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        className="rd-worse rd-drift"
        kicker="AI drift detection"
        title="AI drift detection"
        accent="& model degradation monitoring"
        lead={`How to tell when a model quietly gets worse behind a stable API name, and how AI Stupid Level checks for it, model by model, across ${VENDOR_LIST}.`}
        note={stamp ? `As of ${stamp} · 24-hour boards · per-suite Page-Hinkley detectors` : undefined}
        actions={(
          <CtaRow>
            <WatchCta cta="drift-hero-watch" label="Watch the models you use →" />
            <div className="seo-cta">
              <a className="lp-btn lp-btn-ghost" href="#detection" data-cta="drift-hero-how">How we detect drift</a>
            </div>
          </CtaRow>
        )}
        aside={(
          <dl className="lp-facts">
            <div><dt>4 h</dt><dd>between coding-suite runs on every model</dd></div>
            <div><dt>1 h</dt><dd>between canary probes, for sharp drops</dd></div>
            <div><dt>{DRIFT_SUITES.length}</dt><dd>suites, each with its own Page-Hinkley detector, never blended</dd></div>
          </dl>
        )}
        toc={TOC}
        final={(
          <RdFinal
            title="Know the next time it changes"
            lead={FREE_TIER}
            actions={(
              <CtaRow>
                <WatchCta cta="drift-final-watch" label="Watch the models you use →" sub={`${cap(numWord(FREE.watchedModels))} models free · ${ALERT_RULE}`} />
                <div className="seo-cta">
                  <Link className="lp-btn lp-btn-ghost" href="/methodology" data-cta="drift-final-methodology">Read the methodology</Link>
                </div>
              </CtaRow>
            )}
          />
        )}
      >
        <RdSection id="drift" n={num('drift')} title="What is AI drift?">
          <RdProse>
            <p>
              AI models change without changing their name. A provider can update the checkpoint behind a stable id such as{' '}
              <code>gpt-&lt;version&gt;</code> or <code>claude-&lt;version&gt;</code> at any time, and your code keeps calling the same string. If
              output quality drops, nothing in the API tells you. AI Stupid Level re-tests every model on its board on a fixed schedule — {CADENCE} —
              and applies change-point detection to the results, so a sustained decline becomes a measurement instead of a hunch.
            </p>
          </RdProse>
          <RdRows rows={[
            ['The model itself moved', 'AI drift is a change in a model’s output quality over time while its public identifier stays the same. It is distinct from prompt drift (your inputs changing) and from data drift in classical machine learning (the input distribution moving). Here the model itself is the thing that moved.'],
            ['Neither direction is announced', 'Drift is not always downward; models sometimes improve after an update. Neither direction is announced, so a team building on a model has no way to know its evaluation results are still valid. That uncertainty is the cost: you cannot tell whether a regression in your product came from your last deploy or from your provider.'],
          ]} />
        </RdSection>

        <RdSection id="causes" n={num('causes')} title="What causes AI model degradation?"
          lead="Four causes, each leaving a different trace on fixed tasks.">
          <RdRows rows={[
            [<>Silent version swaps</>, <>A provider routes a stable alias to a new checkpoint or build. Behaviour changes; the model name does not. Where a provider returns a build identifier, it is recorded with every call, which is how two new builds were dated to the minute in the record on <Link href={WORSE_HUB_PATH}>Is your AI getting worse?</Link>.</>],
            ['Cost-driven serving changes', 'Quantisation, distillation and serving-stack changes cut inference cost and can change the output with it. They tend to show first as answer length and response time rather than correctness, so both are tracked on the same tasks beside the score.'],
            ['Safety and refusal tuning', 'Tightened filters raise refusal rates on legitimate requests: the model is not less capable, but it is less useful for the task you had. A prompt the provider declines outright is recorded as a refusal with the provider’s stated category and that session’s score is withheld, so a tightened filter shows up as a refusal rate rather than as invented incapability.'],
            ['Capacity pressure', 'Under heavy load a provider can shift defaults such as sampling parameters or a reasoning budget. That would show as higher run-to-run variance rather than a clean step, which is why every score carries a standard error from its own repeatability and the leaderboard ties models whose lead is inside it.'],
          ]} />
        </RdSection>

        <RdSection id="detection" n={num('detection')} title="How we detect drift: the Page-Hinkley test"
          lead="A single weak response is not evidence. Model output is stochastic, so scores vary run to run even when nothing has changed upstream. A naive threshold alarm on raw scores either fires constantly on that noise or is set so loose it misses real decline.">
          <figure className="lp-chart lp-up">
            <div className="lp-chart-head">
              <span><b>Illustration</b> · a made-up 30-day series and the detector run on it with the published constants; the flag lands days after the change, as it does on daily medians</span>
              <span className="lp-legend"><span><i />score</span><span className="lp-lb"><i />own baseline</span><span className="lp-lph"><i />Page-Hinkley</span></span>
            </div>
            <DriftChart />
          </figure>
          <RdProse>
            <p>
              We use the Page-Hinkley test, a cumulative-sum change detector from statistical process control. Instead of judging each run in
              isolation, it accumulates how far each day&apos;s median score falls below the running mean, less a small tolerance, and tracks the
              distance between that running total and its lowest point so far. Random noise has no consistent sign, so it cancels out and the
              statistic stays near zero. A genuine sustained decline pushes the deviations consistently in one direction, so the statistic grows until
              it crosses a decision threshold and a drift event fires.
            </p>
            <p>
              The threshold is what trades false alarms against detection lag. The tolerance and threshold were chosen by sweeping them against the
              score history, so ordinary day-to-day fluctuation stays quiet while a real shift is confirmed over days rather than hours: δ 0.01; λ 0.30
              for coding and reasoning, λ 0.50 held for three consecutive daily runs for tool use; a detector is armed after {coldDays} days of daily
              medians on the current test version. The statistic runs on each suite&apos;s own daily series — coding, tool use and reasoning are never
              blended, because they sit on different scales — and restarts whenever a suite&apos;s configuration changes.
            </p>
            <p>
              For sharp drops there is a second, faster instrument: an hourly canary of two fixed probes, tested over the last 6 and 24 hours against the
              prior week with Welch&apos;s t-test, which raises an incident at a 12-point fall with p &lt; 0.01 and closes it when the fall closes. Every
              score is also published with a standard error from its own run-to-run repeatability, the leaderboard ties models whose lead is inside that
              noise, and a composite score is labelled with how many suites contributed to it. The constants and the measured false-alarm rates are on
              the <Link href="/methodology#drift">methodology page</Link> and in{' '}
              <Link href="/research/drift-detector-false-alarm-rate">How often our drift detector is wrong, measured</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="monitor" n={num('monitor')} title="Drift monitor now">
          <Verdict>{verdict ?? fallbackLead}</Verdict>
          <DriftMonitorNow data={data} />
          <RdProse>
            <p>
              A detector is armed once it has {coldDays} days of daily medians on the current test version, and fires only on a sustained fall. Model by
              model, with the four 24-hour scores and each detector&apos;s state, the answer is on{' '}
              <Link href={WORSE_HUB_PATH} data-cta="drift-monitor-hub">{HUB_H1.title}</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="coverage" n={num('coverage')} title="What we measure for drift"
          lead="Drift is tracked per benchmark suite, because a model can decline in one dimension while holding steady in another.">
          <RdRows rows={[
            ['Coding, every four hours', 'Seven tasks each sweep — six repository repairs described by a user complaint and one hard single-function task — seven attempts each, graded by running the project’s own tests. Nine measures are recorded; correctness carries most of the weight, with stability, hidden edge cases, debugging, code quality and two guardrails (format and safety) beside it.'],
            ['Reasoning, daily', 'Four long working sessions of five or six turns, each building on its own earlier turns. Five measures, weighted per task: correctness, recovery after a failed step, and three continuity measures — memory retention, plan coherence and context use — checked by running code, not by matching words.'],
            ['Tool use, daily', 'Nine agentic tasks in a sandboxed machine with file, shell and HTTP tools: task completion, tool selection, parameter accuracy, efficiency, error handling, context awareness and safety compliance. A small drop in parameter accuracy compounds across a long chain of calls, which is what makes this suite matter for agents.'],
            ['Canary, hourly', 'Two fixed probes, two attempts each, every hour, tested with Welch’s t over the last 6 and 24 hours against the prior 7 days on the same test version. It fires at a fall of 12 points or more at p < 0.01 and closes itself when the fall does: it is there to catch a model collapsing this afternoon, not a slow decline.'],
          ]} />
          <RdProse>
            <p>Every weight, and what each measure can and cannot tell apart, is on the <Link href="/methodology">methodology page</Link>.</p>
          </RdProse>
        </RdSection>

        <RdSection id="families" n={num('families')} title="Is your AI getting worse? The answer by family"
          lead="The hub answers the question for every model on the board, and each family page answers it for its own models: the four 24-hour scores and places, the detector state per suite, the API's availability, the tool-or-model question and the dated record.">
          <RdRows rows={familyRows} />
          <RdProse>
            <p>
              Every model, every family and the whole dated record: <Link href={WORSE_HUB_PATH} data-cta="drift-families-hub">{HUB_H1.title} {HUB_H1.accent}</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="why" n={num('why')} title="Why independent monitoring matters">
          <RdProse>
            <p>
              Providers publish benchmark numbers at launch, and a change behind a stable model name is not announced in either direction.
              Independent, ongoing measurement is how you know whether the model you evaluated is the model you are running — which matters for
              anyone with a model choice baked into production, a vendor contract to justify, or an AI feature whose quality they are accountable for.
            </p>
            <p>
              Every model on the board has its own page with its score history, per-suite breakdown and drift status. Start from the{' '}
              <Link href="/">AI model leaderboard</Link>, or read the <Link href="/faq">benchmarking FAQ</Link> for shorter answers to common questions.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="Frequently asked questions about AI drift">
          <WorseFaq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
