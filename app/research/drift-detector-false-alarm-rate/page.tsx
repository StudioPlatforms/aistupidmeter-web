import type { Metadata } from 'next';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdFacts, RdRows, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { CtaRow, WatchCta } from '@/components/seo/Cta';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { Byline } from '@/components/seo/research/Byline';
import { CiteThis } from '@/components/seo/research/CiteThis';
import { ResearchTable } from '@/components/seo/research/ResearchTable';
import { PRIVATE_BACKEND, RESEARCH_CRUMB, articleCrumbs, requireEntry, siblingsOf } from '@/components/seo/research/research-shared';
import { researchPath } from '@/lib/research-index';
import { breadcrumbLd, faqLd, graphLd, pageMeta, webPageLd } from '@/lib/seo';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';
import '@/styles/seo-research.css';

/**
 * /research/drift-detector-false-alarm-rate: the drift-detection methodology paper (v1.2,
 * 23 Sep 2026) condensed to its validation: the Page-Hinkley operating characteristics, where
 * the fleet's own noise sits, the block-bootstrap on real histories, the canary replay, the
 * retraction record and the blind spots. Every number is from that document; stale statements
 * are date-stamped rather than refreshed. Nothing is fetched.
 */

const ENTRY = requireEntry('drift-detector-false-alarm-rate');
const PAPER = siblingsOf(ENTRY).find((e) => e.slug === 'thirteen-months-of-llm-monitoring');
const PAPER_PATH = PAPER ? researchPath(PAPER) : '/research';
const PAPER_TITLE = PAPER?.title ?? 'What 13 months of monitoring LLM APIs caught';
const PATH = researchPath(ENTRY);
/** The H1 is the registry title split for the accent line; the two halves read back as ENTRY.title. */
const H1 = { title: 'How often our drift detector', accent: 'is wrong, measured' };

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
  { id: 'how', label: 'How it works' },
  { id: 'grid', label: 'Operating characteristics' },
  { id: 'fleet', label: 'Where the fleet sits' },
  { id: 'bootstrap', label: 'Real histories' },
  { id: 'canary', label: 'The canary' },
  { id: 'retractions', label: 'Retraction record' },
  { id: 'blind', label: 'What it does not catch' },
  { id: 'faq', label: 'FAQ' },
  { id: 'cite', label: 'Cite this' },
];
const num = (id: string) => tocNumber(TOC, id);

const NUM = { num: true } as const;

/** The same strings feed the visible rows and the FAQPage structured data. */
const FAQ: FaqItem[] = [
  {
    q: 'How often does the drift detector raise a false alarm?',
    a: 'In simulation with the production code at the fleet’s typical noise, a standard deviation of 1.5 points: 0 false alarms in 44,000 model-days. At sd 3, about one per 4,400 model-days; at sd 5, about one per 180. On block-bootstrapped real histories the fleet mean was 1.16 per 100 model-days, almost all of it from two models with noise above 7.',
  },
  {
    q: 'How big a drop does it catch, and how quickly?',
    a: 'At sd 1.5 a sustained 5-point drop is caught 100% of the time within 30 days, in a median of 8 days, and a 3-point drop 91% of the time in a median of 18 days. On tool use, once a day with noise of 3.9 points and a stricter rule of its own, a 5-point drop is caught 96% of the time in a median of 15 days and a 3-point drop 46% of the time.',
  },
  {
    q: 'Is it a CUSUM test or Page-Hinkley?',
    a: 'Page-Hinkley, a CUSUM-family test for a decrease in the mean, with a tolerance of 0.01 per observation and a threshold of 0.30 (0.50 held for three consecutive daily runs on tool use). It needs ten days of history before it may fire and resets fully on every firing and on every change of benchmark configuration. The constants are on the [methodology page](/methodology#drift).',
  },
  {
    q: 'What does the detector not catch?',
    a: 'An ordinary one-day dip (under the shared rule the smallest single-day dip that fires is 33 points), sustained drops smaller than about three points, changes in output length, latency or cost at unchanged correctness, and anything in a capability the suites do not measure. A detection says the score moved; it does not say why.',
  },
  {
    q: 'Were earlier incidents retracted?',
    a: 'Yes. In September 2026, 446 canary incidents raised since 11 October 2025 by a threshold rule with no significance test were retracted, as were 46 provider-wide incidents built on a series that interleaved three suites, and 1,031 change points were flagged unreliable. Every retracted row is kept in the database and flagged, never deleted.',
  },
];

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
  faqLd(FAQ),
]);

export default function DriftDetectorFalseAlarmPage(): JSX.Element {
  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        className="rs-page"
        kicker="Research · Measurement report"
        title={H1.title}
        accent={H1.accent}
        lead="A drift detector is worth attaching to a benchmark only if two numbers are known: how often it misses a real change, and how often it invents one. This report gives both for the per-suite Page-Hinkley detector (a CUSUM-family test) behind the leaderboard’s drift status and for the hourly canary, from simulation, from bootstrapped real histories and from replay with injected drops. It claims a stated detection delay at a stated false-alarm rate, both measured; it does not claim to identify a cause, and no detection has yet been validated against a vendor-confirmed change."
        note={<Byline published={ENTRY.published} window={ENTRY.window} />}
        actions={(
          <CtaRow>
            <div className="seo-cta">
              <a className="lp-btn lp-btn-primary" href="#grid" data-cta="research-report-hero-grid">See the operating characteristics <span className="lp-ar" aria-hidden="true">→</span></a>
            </div>
            <div className="seo-cta">
              <a className="lp-btn lp-btn-ghost" href="#retractions" data-cta="research-report-hero-retractions">The retraction record</a>
            </div>
          </CtaRow>
        )}
        aside={(
          <dl className="lp-facts">
            <div><dt>0</dt><dd>false alarms in 44,000 simulated model-days at the fleet’s typical noise, a standard deviation of 1.5 points</dd></div>
            <div><dt>1.16</dt><dd>false alarms per 100 model-days on bootstrapped real histories, the fleet mean, almost all from two noisy models</dd></div>
            <div><dt>492</dt><dd>published incidents retracted in September 2026, kept in the database and flagged rather than deleted</dd></div>
          </dl>
        )}
        toc={TOC}
        final={(
          <RdFinal
            title="Watch a model with a detector whose error rate is published"
            lead="The tables above describe the detector that watches every model on the board: one Page-Hinkley statistic per suite, compared each day with the model’s own baseline, with its false-alarm rate measured before it was allowed to publish."
            actions={(
              <CtaRow>
                <WatchCta cta="research-report-final-watch" label="Watch the models you use →" />
                <div className="seo-cta">
                  <Link className="lp-btn lp-btn-ghost" href="/methodology#drift" data-cta="research-report-final-methodology">The constants, on the methodology page</Link>
                </div>
              </CtaRow>
            )}
          />
        )}
      >
        <RdSection id="how" n={num('how')} title="How does Page-Hinkley detect LLM degradation?"
          lead="The observation is a model’s daily median score on one suite, within one benchmark configuration. The detector tracks decrease: a running mean since the last reset, a cumulative shortfall of each day’s score below that mean less a tolerance, and a statistic that is the shortfall’s distance above its own minimum. It fires above a threshold and then fully resets.">
          <RdFacts rows={[
            ['δ = 0.01, λ = 0.30, cold start 10 days, re-arm 3 days', 'One score point of tolerance per observation; thirty accumulated points to fire; ten days of history before the detector may fire and three after a detection. δ was halved from 0.02 in September 2026: at the linear score’s noise of 1.5–3 points the old tolerance caught only 3–21% of sustained 3-point drops, against 88–93% at 0.01.'],
            ['Tool use: λ = 0.50, held for three daily runs', 'Tool use runs once a day with noise of 3.9 points at the median model and up to 7.2, where the shared rule expected about two false alarms a month across the fleet; its own rule brings that to about one a season. A crossing that falls back before its third day is dropped with no reset.'],
            ['One median per UTC day, one series per suite', 'Six coding sweeps a day carry about 2.8 points of within-day noise, and a median means one failed run cannot move the day’s point. Suites are never blended, and every detector resets when the benchmark configuration hash changes, so a scoring change cannot read as a fleet-wide degradation.'],
          ]} />
          <RdProse>
            <p>The constants are on the <Link href="/methodology#drift">methodology page</Link>; the instruments are explained on <Link href="/ai-drift-detection">AI drift detection</Link>. {PRIVATE_BACKEND} The harnesses drive the production detector code, so the numbers below describe what production does.</p>
          </RdProse>
        </RdSection>

        <RdSection id="grid" n={num('grid')} title="How often is the drift detector wrong?"
          lead="Stationary series with Gaussian noise at several standard deviations, a sustained step decrease injected at a random day, 400 repetitions per cell, a 30-day horizon. “Detected” means fired within 30 days; the delay is the median days to first detection.">
          <ResearchTable
            caption="Table 1. Page-Hinkley operating characteristics (δ = 0.01, λ = 0.30, daily medians), by noise level and size of the sustained drop (report §11, experiment A)."
            narrow={false}
            columns={[{ label: 'Noise (sd)' }, { label: 'False alarms', ...NUM }, { label: '3-point drop', ...NUM }, { label: '5-point', ...NUM }, { label: '8-point', ...NUM }, { label: '10-point', ...NUM }]}
            rows={[
              ['1.5', '0 in 44,000 days', '91% · 18 d', '100% · 8 d', '100% · 4 d', '100% · 3 d'],
              ['3', '0.02 per 100 d (one per ≈ 4,400 d)', '88% · 15 d', '100% · 7 d', '100% · 4 d', '100% · 3 d'],
              ['5', '0.55 per 100 d (one per ≈ 183 d)', '84% · 11 d', '98% · 5 d', '99% · 3 d', '99% · 2 d'],
              ['8.4', '2.47 per 100 d (one per ≈ 40 d)', '86% · 7 d', '96% · 5 d', '97% · 3 d', '98% · 3 d'],
            ]}
          />
          <RdProse>
            <p>Noise of 8.4 points is where the previous score curve put the fleet and where these constants were first calibrated; it is also the regime of the two noisiest models today. A detector’s behaviour is entirely a function of the noise it must see through, so any change to the score curve or the corpus obliges a re-run of this table.</p>
          </RdProse>
        </RdSection>

        <RdSection id="fleet" n={num('fleet')} title="Where does the fleet’s own noise sit?"
          lead="Measured within a single benchmark configuration on the linear score, in September 2026. Every sensitivity figure comes from steps injected into simulated or real series: vendors do not generally confirm a change, so no real one has been available to measure against.">
          <RdProse>
            <p>The median model’s run-to-run standard deviation was 0.25 on one coding configuration and 0.95 on the next, with 16 of 24 and 14 of 24 models below 1.5; four models on the earlier configuration and three on the later exceeded sd 3, the noisiest near 8.3–8.7. A run-to-run sd near zero partly reflects how coarse the coding score is, since many models return the identical score sweep after sweep. Each suite’s day-to-day noise was then measured as the median across the 19 ranked models, and the harness re-run with each model simulated at its own noise.</p>
          </RdProse>
          <ResearchTable
            caption="Table 2. The detector at each suite’s measured noise (report §15.1); tool use under the shared rule and under its own rule."
            narrow={false}
            columns={[{ label: 'Suite (days measured)' }, { label: 'Noise, median (range)', ...NUM }, { label: 'False alarms', ...NUM }, { label: '3-point drop', ...NUM }, { label: '5-point', ...NUM }, { label: '8-point', ...NUM }]}
            rows={[
              ['Coding (9)', '1.1 (0.0–6.3)', 'none in the simulation', '95% · 18 d', '100% · 8 d', '100% · 4 d'],
              ['Reasoning (7)', '2.0 (1.1–4.9)', 'none', '89% · 17 d', '100% · 7 d', '100% · 4 d'],
              ['Tool use (9), shared rule', '3.9 (2.1–7.2)', '≈ 1 per 690 model-days', '83% · 12 d', '99% · 6 d', '100% · 3 d'],
              ['Tool use, its own rule', '3.9', '≈ 1 per 22,000 model-days', '46% · 21 d', '96% · 15 d', '100% · 9 d'],
              ['Tool use, noisiest model, its own rule', '7.2', '≈ 1 per 250 model-days', '58% · 14 d', '86% · 12 d', '98% · 8 d'],
            ]}
          />
          <RdProse>
            <p>The coding and reasoning detectors sit where the validation says they are quiet. Under the shared rule the tool-use detector did not: about two false alarms per 30 days across the fleet, mostly from the six models with noise above 5, against 0.3 under its own rule. That was found and fixed the day before the detector armed, not after a false alert; the cost is in the 3-point column.</p>
          </RdProse>
        </RdSection>

        <RdSection id="bootstrap" n={num('bootstrap')} title="What is the false-alarm rate on real histories?"
          lead="Simulation assumes textbook noise. The second experiment block-bootstraps each model’s real daily-median history, its longest single-configuration run resampled in week-long blocks, which destroys any genuine change point while preserving the model’s own noise and autocorrelation.">
          <ResearchTable
            caption="Table 3. Block-bootstrap of real daily-median histories, computed in September 2026 (report §11, experiment B)."
            columns={[{ label: 'Model' }, { label: 'Days', ...NUM }, { label: 'Noise sd', ...NUM }, { label: 'Detections on real history', ...NUM }, { label: 'False alarms per 100 days', ...NUM }, { label: 'Days between false alarms', ...NUM }]}
            rows={[
              ['claude-sonnet-4-5-20250929', '225', '3.23', '1', '0.36', '279'],
              ['claude-opus-4-5-20251101', '166', '1.17', '0', '0.00', 'none'],
              ['claude-opus-4-6', '100', '4.15', '0', '0.40', '250'],
              ['deepseek-v4-pro', '97', '7.20', '3', '3.03', '33'],
              ['deepseek-v4-flash', '96', '8.41', '2', '3.17', '32'],
              ['claude-sonnet-4-6', '88', '0.97', '0', '0.00', 'none'],
            ]}
          />
          <RdProse>
            <p>Fleet mean false-alarm rate on bootstrapped noise: 1.16 per 100 model-days, one spurious alert per model roughly every 86 days. The two noisy DeepSeek models carry most of it, and the rate tracks a model’s own noise, not its quality; a reader should discount detections on models whose noise sd exceeds about 7. The figure comes from resampled real noise, not from operation; the realised rate under the current design is to be published beside it once each detector has 30 or more days on one configuration, and if the two disagree the bootstrap is the one to be replaced.</p>
          </RdProse>
        </RdSection>

        <RdSection id="canary" n={num('canary')} title="Does the canary catch a collapse within the hour?"
          lead="The hourly canary is the fast, narrow instrument: every model answers two fixed coding probes twice each, every hour, in a sandbox, graded by execution, with a 4,000-token answer budget. Welch’s one-sided t-test compares the last 6 hours (at least 5 of 6 probes) and the last 24 hours (at least 16 of 24) against the prior seven days; an incident needs a drop of at least 12 points with p < 0.01 and resolves itself when the 24-hour mean is back within 10 points of baseline.">
          <ResearchTable
            caption="Table 4. Canary detector checks and replay against real probe history, computed in September 2026 (report §12)."
            columns={[{ label: 'Check' }, { label: 'Result', ...NUM }]}
            rows={[
              ['Hand-written t upper tail against 23 tabulated critical values, df 1 to ∞', 'worst relative error 0.093%'],
              ['Detector evaluations on untouched real history (26 series, last 30 days)', '1,753'],
              ['False alarms on that history', '0'],
              ['Injected step 100 → 50', 'fired 22 of 22 · median 4 h · max 157 h'],
              ['Injected step of −25 points', 'fired 25 of 26 · median 4 h'],
              ['Injected step of −15 points, threshold 15', 'fired 3 of 26'],
              ['Injected step of −15 points, threshold 12', 'fired 24 of 26 · median 4 h · still 0 false alarms'],
            ]}
          />
          <RdProse>
            <p>The last two rows are why the minimum drop is 12 and not 15: the sweep tested 10, 12 and 15; 10 and 12 behaved identically, and 12 was chosen as the more conservative. An improvement can never fire the test. The probe owns its two tasks, its answer budget is 4,000 tokens rather than 500, and it runs two trials per task rather than one, which halves the per-probe variance.</p>
          </RdProse>
        </RdSection>

        <RdSection id="retractions" n={num('retractions')} title="The retraction record"
          lead="Everything here was published as a finding by this platform and has been withdrawn. The rows are kept in the database and flagged, never deleted, so the record can be audited.">
          <RdProse>
            <p><b>September 2026.</b> Between 11 October 2025 and 13 September 2026, the canary’s original rule — a 24-hour mean more than 10% below the previous 24 hours, with no significance test, no minimum sample and no account of the probe’s variance — opened 446 performance-drift incidents, every one this platform had published. The score was quantised to 0, 50 or 100, so for a model failing one of its two probes a third of the time, two consecutive 24-hour means differed by more than 10% about one check in eight, and the probe’s 500-token answer cap was truncating two models on every run. All 446 were retracted. In the same month, 46 provider-wide incidents raised between February and September 2026 were retracted: they aggregated per-model statuses computed on a series that interleaved three suites on different scales. Those incidents had held two vendors at the floor of the provider trust score of the time for months. A further 1,145 change points computed on the same interleaved series, 1,031 of them not previously flagged, are treated as unreliable: a researcher should treat every change point recorded before 13 September 2026 as unreliable.</p>
          </RdProse>
        </RdSection>

        <RdSection id="blind" n={num('blind')} title="What does the detector not catch?"
          lead="A detection is a statement about our corpus, not about a vendor’s model in general.">
          <RdRows rows={[
            ['Sustained drops smaller than about three points, and a single bad day', 'The operating characteristics were measured from three points up; the tolerance absorbs one score point per observation by design. The substrate is one median per UTC day and the statistic accumulates, so an ordinary one-day dip does not fire: under the shared rule the smallest single-day dip that fires is 33 points, and under tool use’s rule 62. Anything faster is the canary’s job.'],
            ['Changes in output length, latency or cost', <>The detector watches the score. Every provider-side change in thirteen months of record that a provider’s own identifier confirmed changed output length and latency at unchanged correctness, which the detectors do not watch. They are documented, with dates, in <Link href={PAPER_PATH}>{PAPER_TITLE}</Link>.</>],
            ['Capabilities the suites do not measure, and the cause', 'The detector inherits every weakness of its suite: as of September 2026 the coding detector watched a score 97.5% explained by one axis, on a corpus where three of nine tasks discriminated. A crossing says the score moved, not why: it does not distinguish a new checkpoint from a quantisation change, a routing change, a new safety classifier or a change in our own infrastructure.'],
            ['Its own state, as of 23 September 2026', 'Every Page-Hinkley detector had restarted on a new benchmark configuration on 23–24 September 2026 and none had fired under its current design; the earliest possible alerts were 2 October for coding, 3 October for reasoning and 5 October for tool use. The canary was armed and deliberately not reset. The realised false-alarm rate is to be measured once each detector has 30 or more days on one configuration.'],
          ]} />
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="Questions about drift-detection accuracy">
          <Faq items={FAQ} />
        </RdSection>

        <RdSection id="cite" n={num('cite')} title="How to cite this report">
          <CiteThis
            entry={ENTRY}
            note="This page condenses version 1.2 of the drift-detection methodology paper, dated 23 September 2026; its figures were computed on 14 and 22 September 2026."
          />
          <RdProse>
            <p>
              Also from the test record: <Link href={PAPER_PATH}>{PAPER_TITLE}</Link>. The constants are on the <Link href="/methodology#drift">methodology page</Link>, the instruments on <Link href="/ai-drift-detection">AI drift detection</Link>, and every research page on <Link href={RESEARCH_CRUMB.path}>Research</Link>.
            </p>
          </RdProse>
        </RdSection>
      </ReadingPage>
    </>
  );
}
