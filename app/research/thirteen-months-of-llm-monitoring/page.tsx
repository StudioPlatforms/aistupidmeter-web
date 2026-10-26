import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdFacts, RdRows, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { CtaRow, WatchCta } from '@/components/seo/Cta';
import { Byline } from '@/components/seo/research/Byline';
import { CiteThis } from '@/components/seo/research/CiteThis';
import { ResearchTable } from '@/components/seo/research/ResearchTable';
import { StepChart, type StepItem } from '@/components/seo/research/StepChart';
import { NO_CALLS, RESEARCH_CRUMB, articleCrumbs, requireEntry, siblingsOf } from '@/components/seo/research/research-shared';
import { researchPath } from '@/lib/research-index';
import { breadcrumbLd, graphLd, pageMeta, webPageLd } from '@/lib/seo';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';
import '@/styles/seo-research.css';

/**
 * /research/thirteen-months-of-llm-monitoring: the paper "Watching the Models, Watching
 * Ourselves" (preprint v1.0, 23 Sep 2026) condensed to its findings. Every number on this page
 * is from that document; the section it comes from is noted beside each block. Models are named
 * only inside dated, past-tense findings. Nothing is fetched: the page is the paper.
 */

const ENTRY = requireEntry('thirteen-months-of-llm-monitoring');
const PATH = researchPath(ENTRY);
/** The H1 is the registry title split for the accent line; the two halves read back as ENTRY.title. */
const H1 = { title: 'What 13 months of monitoring', accent: 'LLM APIs caught' };

export const revalidate = 900;

export const metadata: Metadata = pageMeta({
  title: ENTRY.metaTitle,
  description: ENTRY.description,
  path: PATH,
  type: 'article',
  publishedTime: ENTRY.published,
  modifiedTime: ENTRY.updated,
  keywords: ENTRY.keywords,
});

const TOC = [
  { id: 'summary', label: 'Summary' },
  { id: 'method', label: 'Method' },
  { id: 'findings', label: 'Findings' },
  { id: 'absent', label: 'What did not happen' },
  { id: 'teams', label: 'For teams' },
  { id: 'corrections', label: 'Corrections' },
  { id: 'cite', label: 'Cite this' },
];
const num = (id: string) => tocNumber(TOC, id);

/** Paper §4.2, Table 3: the five isolated serving-speed steps (median latency on the nine year-long tasks, 21-day windows). */
const LATENCY_STEPS: (StepItem & { pass: string })[] = [
  { label: 'Gemini 2.5 Pro (preview 03-25)', sub: '26 Sep 2025', before: 5.3, after: 3.8, change: '−28%', pass: '100% → 99.3%' },
  { label: 'GPT-5 nano', sub: '6 Oct 2025', before: 8.5, after: 12.8, change: '+51%', pass: '99.9% → 100%' },
  { label: 'Gemini 2.5 Flash', sub: '5 Nov 2025', before: 1.4, after: 1.0, change: '−28%', pass: '99.1% → 98.4%' },
  { label: 'Kimi K2 (0711 preview)', sub: '27 Nov 2025', before: 7.4, after: 4.1, change: '−45%', pass: '87.8% → 89.1%' },
  { label: 'DeepSeek V4 Pro', sub: '24 May 2026', before: 20.4, after: 10.5, change: '−49%', pass: '97.6% → 98.3%' },
];

const sec = (v: number) => `${v.toFixed(1)} s`;

const ld = graphLd([
  breadcrumbLd(articleCrumbs(ENTRY)),
  webPageLd({
    path: PATH,
    name: ENTRY.title,
    description: ENTRY.description,
    type: 'ScholarlyArticle',
    datePublished: ENTRY.published,
    dateModified: ENTRY.updated,
  }),
]);

const REPORT_SLUG = 'drift-detector-false-alarm-rate';

export default function ThirteenMonthsPage(): JSX.Element {
  const siblings = siblingsOf(ENTRY);
  const report = siblings.find((e) => e.slug === REPORT_SLUG);
  const reportPath = report ? researchPath(report) : `/research/${REPORT_SLUG}`;
  const reportTitle = report?.title ?? 'How often our drift detector is wrong, measured';
  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        className="rs-page"
        kicker="Research · Paper"
        title={H1.title}
        accent={H1.accent}
        lead="Between 8 August 2025 and 23 September 2026 we ran the same coding tasks against commercial language-model APIs on a fixed schedule. This paper re-reads that record with signals no scoring formula produces — pass rate on nine tasks that ran all year, output length, latency and, from June 2026, the providers’ own build identifiers — and reports what changed on the provider side, what did not, and what we got wrong."
        note={<Byline published={ENTRY.published} window={ENTRY.window} />}
        actions={(
          <CtaRow>
            <div className="seo-cta">
              <a className="lp-btn lp-btn-primary" href="#findings" data-cta="research-paper-hero-findings">Read the findings <span className="lp-ar" aria-hidden="true">→</span></a>
            </div>
            <div className="seo-cta">
              <a className="lp-btn lp-btn-ghost" href="#cite" data-cta="research-paper-hero-cite">Cite this paper</a>
            </div>
          </CtaRow>
        )}
        aside={(
          <dl className="lp-facts">
            <div><dt>184,654</dt><dd>task-level coding runs in the record, each aggregating five to seven executed trials</dd></div>
            <div><dt>94</dt><dd>models measured over the thirteen months, 64 of them with at least 100 runs</dd></div>
            <div><dt>9</dt><dd>coding tasks that ran all year: the formula-independent yardstick of this paper</dd></div>
          </dl>
        )}
        toc={TOC}
        final={(
          <RdFinal
            title="Know when a model you depend on changes"
            lead="This paper was written from stored runs read back months after the fact. A watchlist reads the same record as it grows: one drift detector per suite, compared with the model’s own baseline, with an error rate that is published rather than assumed."
            actions={(
              <CtaRow>
                <WatchCta cta="research-paper-final-watch" label="Watch the models you use →" />
                <div className="seo-cta">
                  <Link className="lp-btn lp-btn-ghost" href="/ai-drift-detection" data-cta="research-paper-final-drift">How drift detection works</Link>
                </div>
              </CtaRow>
            )}
          />
        )}
      >
        <RdSection id="summary" n={num('summary')} title="What did 13 months of monitoring LLM APIs catch?"
          lead="Five findings, in five sentences. Every number is re-derived from the per-call record, not from the published score.">
          <RdProse>
            <ol>
              <li><b>Provider-side changes are real and observable.</b> The record holds two build changes confirmed by a provider’s own identifiers, a requested model name silently redirected to a different served model, five isolated serving-speed steps of 28–51% with no change on our side, and four endpoint withdrawals.</li>
              <li><b>None of them was a loss of correctness.</b> On the nine tasks that ran all year, no model showed a sustained, model-specific fall in pass rate of five points or more, a result bounded by how close to ceiling those tasks sit.</li>
              <li><b>The costliest changes were invisible to a correctness-dominated score.</b> Two new builds doubled mean output length and raised latency by about 1.7× at unchanged pass rates, so the same work cost about twice as much and took 70% longer under an unchanged model name.</li>
              <li><b>A fixed output budget turns verbosity into failure.</b> When one model began answering 26% longer in March 2026, the share of its answers cut off at our 1,500-token cap rose from 23.7% to 39.5% and its pass rate fell from 93.1% to 87.2%.</li>
              <li><b>Most apparent degradation was the instrument.</b> Against roughly a dozen documented provider-side events, our earlier alerting layers raised 937 incidents, 492 of them since retracted, and a change-point scanner whose firings near the real events matched what chance predicts.</li>
            </ol>
          </RdProse>
        </RdSection>

        <RdSection id="method" n={num('method')} title="How was the record analysed?"
          lead="The composite score is the wrong substrate for a year-long analysis: its curve, weights, task mix, trial count and output budgets all changed during the year, and benchmark configurations were only fingerprinted from August 2026. The analysis therefore uses only records traceable to an executed API call, and only signals no scoring code produces.">
          <RdFacts rows={[
            ['The record', <>184,654 task-level coding runs between 8 August 2025 and 23 September 2026, from 94 models. Each run aggregates five to seven executed trials and stores whether the code passed, the median trial’s billed output tokens and the latency. {NO_CALLS}</>],
            ['Three signals', 'The pass rate on nine single-function Python tasks that ran from 9 September 2025 until mid-September 2026, each attempted by 81–89 models with 15,600–22,300 runs per task; output length, in billed tokens; and latency per call. The verdict on a task comes from executing the returned code against its tests.'],
            ['Step detection', 'Daily medians per model over the nine tasks, on days with at least 15 runs; binary segmentation on the log of output length and of latency, each candidate split tested with Welch’s t. A step had to hold for at least seven days on each side, move the geometric mean by a factor of at least 1.35 and reach |t| ≥ 6; for pass rate, an absolute change of at least 5 points with |t| ≥ 5, repeated at 3 points and |t| ≥ 3.5 as a sensitivity check. Step sizes compare 21-day windows either side of the split.'],
            ['The synchrony control', 'A change on our side leaves a signature: a prompt or harness change moves unrelated vendors on the same day, and an adapter change moves every model of one vendor. Each step was therefore classified by what else moved within ±3 days — synchronised, vendor-wide or isolated — and for every isolated step we read our own change history for that vendor’s request path.'],
            ['Provider identifiers, from 16 June 2026', 'Each run stores the identifier the vendor returns with its response: the served model name for every vendor, OpenAI’s as a dated snapshot, and for DeepSeek a system fingerprint that encodes a build. It is the one kind of evidence in the record that does not originate with us. A change of served name under a fixed requested name is informative for every vendor; a change of build under a fixed name is visible only for DeepSeek.'],
            ['What counts as a catch', 'A provider-side change is an identifier that changed under a fixed requested name, or an isolated behavioural step with no change to that vendor’s request path on our side. It is a degradation only when the outcome got worse for a user at equal requested work: lower correctness, higher latency or more output billed for the same result. Improvements are reported too, because a monitor that can only see falls cannot tell a fall from a return to normal.'],
          ]} />
        </RdSection>

        <RdSection id="findings" n={num('findings')} title="What changed on the provider side?"
          lead="Every provider-side change the record can document was a step: a stable plateau, an abrupt transition and a new plateau. Most were changes in how a model answered rather than in whether it answered correctly.">
          <RdProse>
            <h3>Two new builds, confirmed by the provider’s identifier</h3>
            <p>Between 16 June and 23 September 2026, the period with identifiers, only DeepSeek’s changed under a fixed requested name; it is the one vendor whose identifier encodes a build, and the one we measured continuously through July and August.</p>
          </RdProse>
          <ResearchTable
            caption="Table 1. Build changes confirmed by the provider’s identifier, with behaviour measured over two weeks before and after on the nine year-long tasks (paper §4.1)."
            columns={[{ label: 'Model' }, { label: 'New build first seen (UTC)' }, { label: 'Mean output tokens', num: true }, { label: 'Latency', num: true }, { label: 'Pass rate', num: true }]}
            rows={[
              ['DeepSeek V4 Flash', '02:10, 31 Jul 2026', '510 → 1,054', '5.6 s → 9.3 s', '96.4% → 98.9%'],
              ['DeepSeek V4 Pro', '18:09, 12 Aug 2026', '727 → 1,477', '11.8 s → 20.3 s', '97.7% → 99.0%'],
            ]}
          />
          <RdProse>
            <p>Our step detector found both changes independently, and no other isolated step in output length appears after March 2026. In each case output doubled and latency rose by 1.7× while correctness held or improved slightly: for a user paying per output token, the same work cost about twice as much and took 70% longer, under an unchanged model name. We checked our own side for the July event. The new build first appears at 02:10 UTC on 31 July; our two commits that day landed eight and eleven hours later and did not touch the DeepSeek request path.</p>
            <p>The alerting layer of the time saw neither event for what it was. The composite score registered only the July event, and in the opposite direction, because the new build stopped failing the one task that had been collapsing a sweep’s score; the second left the composite flat. The change-point scanner fired on 40 of 86 days for one model and 47 of 86 for the other, and near the events about as often as chance predicted. The per-call record had captured both events precisely; the score built on it could not read them.</p>

            <h3>A model name redirected, 10 September 2026</h3>
            <p>From 10 September 2026, requests for deepseek-v4-flash were answered by a model identifying itself as deepseek-flash. The name we were paying to measure had been redirected to a different served model. Our coding corpus changed three days later, so the behavioural effect cannot be measured cleanly.</p>

            <h3>Verbosity that became failure: GLM-4.6, March 2026</h3>
            <p>Our coverage of GLM-4.6 has a gap from 17 February to 10 March 2026. When measurement resumed, its answers on the same tasks were 26% longer, 915 → 1,149 tokens. The share of answers reaching our 1,500-token output cap rose from 23.7% to 39.5%, and its pass rate fell from 93.1% to 87.2%; 97% of its failed answers after the change sat at the cap, against 86% before it. A user with no output cap would probably have seen a wordier model. Anyone running it under a fixed budget, as most production systems do, saw a model that failed one task in eight instead of one in fifteen. We count it as a provider-side change and as a degradation under a fixed budget: the budget is part of the model’s environment.</p>

            <h3>Five serving-speed steps with no change on our side</h3>
            <p>Before June 2026 no identifiers were recorded, so a provider-side change can only be inferred from an isolated behavioural step. Five such steps in latency survive the synchrony control and a reading of our own change history.</p>
          </RdProse>
          <StepChart
            title="Median response time before and after each step"
            caption="On the nine year-long tasks; geometric means of daily medians over 21-day windows either side of the step (paper §4.2, Table 3)."
            items={LATENCY_STEPS}
            max={24}
            unit="s"
            ticks={[0, 6, 12, 18, 24]}
          />
          <ResearchTable
            caption="Table 2. The five isolated serving-speed steps, with the pass rate on the same tasks over the same windows (paper §4.2)."
            columns={[{ label: 'Model' }, { label: 'Date' }, { label: 'Median latency', num: true }, { label: 'Change', num: true }, { label: 'Pass rate', num: true }]}
            rows={LATENCY_STEPS.map((s): ReactNode[] => [s.label, s.sub, `${sec(s.before)} → ${sec(s.after)}`, s.change, s.pass])}
          />
          <RdProse>
            <p>Serving latency moved by 28–51% in either direction, without announcement, five times with no change on our side. Two further latency changes, one in October 2025 on the day we changed every vendor’s output cap and one in April 2026 shared by two vendors within two days, cannot be separated from our own side or our network path and are not attributed. Our own change of 2 October 2025, a uniform 1,500-token cap and temperature for every vendor, moved models from three vendors by 31–51% on the same day; the synchrony control classified every one of those steps as ours.</p>

            <h3>Four endpoint withdrawals</h3>
            <p>The per-call record documents four withdrawals, each visible as a transition from successful calls to HTTP 404 under an unchanged request.</p>
          </RdProse>
          <RdFacts rows={[
            ['Gemini 2.5 Pro (preview 03-25)', 'Last successful run 9 November 2025; HTTP 404 from 2 December 2025. We kept requesting it for eight weeks, 331 failed attempts.'],
            ['Kimi Thinking (preview)', 'Last successful run 7 January 2026; 404 from 9 February to 7 May 2026, 210 attempts.'],
            ['Claude 3.7 Sonnet (2025-02-19)', 'Its last successful run and its first 404 fell on the same day, 19 February 2026.'],
            ['gpt-5.2-codex', '404 on all 83 attempts between 21 December 2025 and 6 January 2026: listed to our account, never served to it.'],
          ]} />
          <RdProse>
            <p>To an application that hard-codes a model identifier, a withdrawal is indistinguishable from an outage. The monitor’s own failure here was persistence: it retried dead endpoints for weeks and recorded each attempt as a failure of the model.</p>
          </RdProse>
        </RdSection>

        <RdSection id="absent" n={num('absent')} title="Did any model get worse at the tasks?"
          lead="Not on the tasks that ran all year. The record’s finding is a bounded one, and the bound is stated.">
          <RdProse>
            <p>Across the 64 models with at least 100 runs, no model showed a sustained, model-specific step down in pass rate of five points or more (|t| ≥ 5) on the nine year-long tasks. At the relaxed threshold of three points, three steps appear: two on 2 October 2025, the day we imposed a uniform output cap and temperature on every vendor, which makes them ours; and one of about three points for GLM-4.6 around 27 December 2025.</p>
            <p>This is a statement about sensitivity as much as about the models. Most models passed these tasks 98–100% of the time; GPT-4o passed 99.5% and Claude Opus 4.8 100%, so single-function tasks with well-known specifications could not tell a 2024 model from a 2026 one, let alone erosion within one model’s lifetime. A degradation that leaves easy tasks intact is invisible on them, and erosion at the top is what users of frontier models complain about. From September 2026 the scored coding corpus moved to defect repairs in small repositories graded by hidden tests. Of seventeen candidate tasks tried on the full 2026 fleet before any entered the corpus, sixteen sat at ceiling. On the corpus that resulted, the three tasks that discriminate, where the codebase supports an inference the complaint withholds, had fleet-wide pass rates of 12.7%, 63.6% and 67.9% from 13 September 2026, against 96–99% on the other four.</p>
            <p>What the same tasks did show was change between generations. The 2025 generation of reasoning models spent a median of 1,490–1,584 output tokens and up to 22.5 seconds on tasks that 2024 models answered in 130–200 tokens and two to three seconds, without passing more often; for several of them 68–98% of failed runs were answers cut off at the 1,500-token cap. The adaptive-effort models of 2026 returned to 116–184 tokens and 1.6–3.4 seconds on the same tasks.</p>
            <p>One widely discussed event sits just outside the record. A vendor-confirmed degradation of August–September 2025 peaked on 31 August; our measurement of that vendor’s models began on 8 September, after the peak, so the record can neither confirm nor refute it. Between 9 and 25 September 2025, Claude Sonnet 4 passed 99.5–100% of the year-long tasks on 15 of the 16 days with data; the exception, 13 September, was fleet-wide and therefore ours. As of 23 September 2026, every Page-Hinkley detector had just restarted on a new benchmark configuration and none had fired under its current design; its measured operating characteristics are in <Link href={reportPath}>{reportTitle}</Link>.</p>
          </RdProse>
        </RdSection>

        <RdSection id="teams" n={num('teams')} title="What this means for teams running LLMs in production"
          lead="Each lesson below is tied to an event in the record rather than to an argument.">
          <RdRows rows={[
            ['Pin dated snapshots', 'The record holds two new builds behind an unchanged name, a requested name redirected to a different served model, and four withdrawals. Where a provider offers a dated snapshot, request it by date; where it offers a build identifier, log it with every response, because a change in it is independent evidence that the model changed.'],
            ['Monitor 404s explicitly', 'To an application that hard-codes a model name, a withdrawal looks exactly like an outage. One endpoint in the record was listed but never served; another answered 404 for eight weeks while our monitor kept retrying it. Treat a model identifier as infrastructure that can disappear, and alert on the status code.'],
            ['Measure cost per correct answer, not the score alone', <>Two builds doubled output and slowed the same work by 70% without moving a correctness-dominated score; output tokens and latency per correct result carried the signal. The cost per correct answer for every model on the board over the last 30 days is on <Link href="/best-value-ai-model">best value AI model</Link>.</>],
            ['Watch verbosity, and treat the output budget as part of the environment', 'A provider that makes a model more talkative can make it fail more under a fixed cap, as GLM-4.6 did in March 2026. Share one budget across models, version it, and record truncation as truncation.'],
            ['Expect steps, not slopes', 'Every provider-side change the record could document was a step: a stable plateau, an abrupt transition, a new plateau. Detection against a model’s own plateau needs few observations once the noise is measured; a slow erosion was never observed.'],
            ['Use unrelated vendors as controls for one another', 'Independent laboratories do not degrade in unison. In the week of 10 November 2025 the composite scores of six models from six vendors fell together; in the per-call record none of their pass rates moved, and two of the six had no calls that week. A change that moves every vendor on the same day is yours.'],
          ]} />
        </RdSection>

        <RdSection id="corrections" n={num('corrections')} title="Corrections to earlier statements">
          <RdProse>
            <p>In September 2026 we published an article drawn from the composite-score record. Re-reading it against the per-call record, we withdrew three of its claims. In each case the figure had been a product of the instrument rather than of a model: score entries with no underlying calls, failures that were our own account, configuration or probe, or a count the per-call record could not reproduce. The article’s broader conclusion, that steps synchronised across vendors are instrument artefacts, stands and is confirmed in the raw record. Retracted detector incidents are kept in the database and flagged, never deleted; the detectors’ own correction record is in <Link href={reportPath}>{reportTitle}</Link>.</p>
          </RdProse>
        </RdSection>

        <RdSection id="cite" n={num('cite')} title="How to cite this paper">
          <CiteThis
            entry={ENTRY}
            note="This page condenses preprint version 1.0 of the paper, prepared on 23 September 2026. The analysis scripts are available on request."
          />
          <RdProse>
            <p>
              Also from the test record: {siblings.map((s, i) => <span key={s.slug}>{i > 0 && ', '}<Link href={researchPath(s)}>{s.title}</Link></span>)}.
              {' '}The constants behind the detectors are on the <Link href="/methodology#drift">methodology page</Link>; the live verdict for each family, from the 24-hour boards, is on <Link href="/is-ai-getting-worse">Is your AI getting worse?</Link>; every research page is listed on <Link href={RESEARCH_CRUMB.path}>Research</Link>.
            </p>
          </RdProse>
        </RdSection>
      </ReadingPage>
    </>
  );
}
