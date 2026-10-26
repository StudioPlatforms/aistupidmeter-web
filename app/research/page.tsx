import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdRows, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { CtaRow, LeaderboardCta, WatchCta } from '@/components/seo/Cta';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { ArticleList } from '@/components/seo/research/ArticleList';
import {
  CADENCE, HOME_CRUMB, METHODOLOGY_PDF, NO_CALLS, OPENNESS, PRIVATE_BACKEND, RESEARCH_CRUMB, RESEARCH_PATH,
  freeTierSentence, monthsBetween, newestResearchDay, requireEntry,
} from '@/components/seo/research/research-shared';
import { RESEARCH, researchPath } from '@/lib/research-index';
import { breadcrumbLd, dayLabel, faqLd, graphLd, itemListLd, monthLabel, pageMeta, webPageLd } from '@/lib/seo';
import { VENDORS } from '@/lib/seo-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';
import '@/styles/seo-research.css';

/**
 * /research: the hub for the papers and measurement reports written from the test record. The
 * list, the dates and the structured data all come from lib/research-index.ts, so a page added
 * there appears here and in the sitemap without a second edit. Nothing is fetched: the page is
 * static prose plus the registry, and no model is named anywhere on it.
 */

export const revalidate = 900;

const NEWEST = newestResearchDay();
const H1 = { title: 'Research and reports', accent: 'from the test record' };
const H1_TEXT = `${H1.title} ${H1.accent}`;
const DESCRIPTION = 'Papers and reports from the AI Stupid Level test record: thirteen months of monitoring LLM APIs, and the drift detector’s measured false-alarm rate.';

export const metadata: Metadata = pageMeta({
  title: `LLM benchmark research (${monthLabel(NEWEST)})`,
  description: DESCRIPTION,
  path: RESEARCH_PATH,
  keywords: ['AI Stupid Level research', 'LLM benchmark research', 'AI model monitoring research', 'aistupidlevel paper', 'LLM drift study 2026', 'LLM benchmark false positives'],
});

const PAPER = requireEntry('thirteen-months-of-llm-monitoring');
const REPORT = requireEntry('drift-detector-false-alarm-rate');
const MONTHS = monthsBetween(PAPER.window.from, PAPER.window.to);

const TOC = [
  { id: 'papers', label: 'Papers and reports' },
  { id: 'public', label: 'Public and private' },
  { id: 'live', label: 'The record, live' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

/** The same strings feed the visible rows and the FAQPage structured data. Every figure is from the two source documents. */
const FAQ: FaqItem[] = [
  {
    q: 'What is in the AI Stupid Level test record?',
    a: `Every scheduled run since the coding suite began on 8 August 2025, with reasoning, tool use and the canary following in the autumn of 2025, on a fixed schedule: ${CADENCE}. Each run stores what the model was asked, whether it passed, how long it took and how many output tokens it billed; since 16 June 2026 it also keeps the raw text the model returned and the provider’s own response identifier. To 23 September 2026 the record held 184,654 task-level coding runs, 64,268 tool-use sessions, 5,237 reasoning sessions and 63,650 canary probes. ${NO_CALLS}`,
  },
  {
    q: 'Are the test tasks public?',
    a: `No, by design: a public task can be trained on, and a record built on it would stop measuring the model. A research page describes a task by what it asks and how it is graded, never by its content, and names one only once it has left the scored corpus. The method is another matter: the [methodology page](/methodology) and the public methodology PDF carry every weight, statistical test and drift constant the reports rely on. ${PRIVATE_BACKEND}`,
  },
  {
    q: 'Did thirteen months of monitoring catch models getting worse?',
    a: `It caught changes in how models answered more often than changes in whether they answered correctly: two new builds behind an unchanged model name that doubled output length and raised latency by about 1.7×, a requested model name redirected to a different served model, five serving-speed steps of 28–51%, four withdrawn endpoints, and one verbosity change that a fixed output budget turned into a six-point fall in pass rate. On the nine tasks that ran all year, no model lost five points or more of pass rate. The dates and values are in [${PAPER.title}](${researchPath(PAPER)}). The live answer for each family — is ChatGPT getting worse, is Claude getting worse — is on [Is your AI getting worse?](/is-ai-getting-worse), from the 24-hour boards.`,
  },
  {
    q: 'How often is the drift detector wrong?',
    a: `Measured three ways. In simulation with the production code at the fleet’s typical noise, a standard deviation of 1.5 points, the Page-Hinkley detector (a CUSUM-family test) raised 0 false alarms in 44,000 model-days while catching a sustained 5-point drop every time, in a median of 8 days. On bootstrapped real histories the fleet mean was 1.16 false alarms per 100 model-days, almost all of it from two models with noise above 7. The hourly canary, replayed over 1,753 real probe-times, raised 0 false alarms and caught an injected collapse from 100 to 50 in 22 of 22 series, in a median of 4 hours. The full grid is in [${REPORT.title}](${researchPath(REPORT)}).`,
  },
  {
    q: 'Were any published findings withdrawn?',
    a: 'Yes, and they stay on record. In September 2026, 446 canary incidents and 46 provider-wide incidents were retracted and 1,031 change points were flagged unreliable; the rows are kept in the database and flagged, never deleted. Three claims from an article of September 2026 were withdrawn when re-read against the per-call record. Each research page carries its own corrections, dated.',
  },
  {
    q: 'How do I cite a research page?',
    a: 'Each page ends with a plain-text citation — AI Stupid Level, the title, the kind of report, the publication date and the canonical link — and states its data window in the byline. Papers are dated and versioned; a correction is added to the page that made the claim, with its date, rather than silently rewriting it.',
  },
];

const ld = graphLd([
  breadcrumbLd([HOME_CRUMB, RESEARCH_CRUMB]),
  webPageLd({ path: RESEARCH_PATH, name: H1_TEXT, description: DESCRIPTION, type: 'CollectionPage', dateModified: NEWEST }),
  itemListLd({ name: 'Research pages', items: RESEARCH.map((e) => ({ name: e.title, url: researchPath(e) })) }),
  faqLd(FAQ),
]);

const LIVE: [ReactNode, ReactNode][] = [
  [<Link key="m" href="/methodology">Methodology</Link>, 'Every suite, weight, statistical test and drift constant the reports rely on, with the live corpus counts.'],
  [<Link key="d" href="/ai-drift-detection">AI drift detection</Link>, 'How the per-suite detectors and the hourly canary work, for a general reader, with the alert rules the watchlist uses.'],
  [<Link key="w" href="/is-ai-getting-worse">Is your AI getting worse?</Link>, 'The live verdict from the 24-hour boards and every detector’s state, family by family, with the dated record of what changed.'],
  [<Link key="c" href="/compare">Compare models</Link>, 'Every pair of models on the same tests, with statistical ties, list price, response time and cost per correct answer over the last 30 days.'],
  [<Link key="s" href="/status">Provider status</Link>, 'Whether each provider’s API is answering, checked every 10 minutes from our own account, with only provider-caused downtime counted.'],
];

export default function ResearchHubPage(): JSX.Element {
  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        className="rs-page"
        kicker="Research"
        title={H1.title}
        accent={H1.accent}
        lead="Papers and measurement reports written from the record of our own benchmark runs: what thirteen months of monitoring commercial LLM APIs caught, and how often the drift detector that watches the boards is wrong. Each page states its data window, its method and its corrections, and can be cited."
        note={<>As of {dayLabel(NEWEST)} · {RESEARCH.length} pages · every figure re-derived from stored runs</>}
        actions={(
          <CtaRow>
            <div className="seo-cta">
              <a className="lp-btn lp-btn-primary" href="#papers" data-cta="research-hub-hero-papers">Read the papers <span className="lp-ar" aria-hidden="true">→</span></a>
            </div>
            <div className="seo-cta">
              <Link className="lp-btn lp-btn-ghost" href="/methodology" data-cta="research-hub-hero-methodology">Methodology</Link>
            </div>
          </CtaRow>
        )}
        aside={(
          <dl className="lp-facts">
            <div><dt>{RESEARCH.length}</dt><dd>research pages, each with its data window, its method, its corrections and a citation</dd></div>
            {MONTHS > 0 && <div><dt>{MONTHS}</dt><dd>months of scheduled runs in the longest record, {dayLabel(PAPER.window.from)} to {dayLabel(PAPER.window.to)}</dd></div>}
            <div><dt>{VENDORS.length}</dt><dd>providers tested on the same schedule: {CADENCE}</dd></div>
          </dl>
        )}
        toc={TOC}
        final={(
          <RdFinal
            title="See the record for yourself"
            lead={freeTierSentence()}
            actions={(
              <CtaRow>
                <LeaderboardCta cta="research-hub-final-leaderboard" />
                <WatchCta ghost cta="research-hub-final-watch" label="Watch the models you use →" />
              </CtaRow>
            )}
          />
        )}
      >
        <RdSection id="papers" n={num('papers')} title="Papers and reports"
          lead="Dated findings re-derived from stored runs, with the method beside the result. A paper reads the record over a long window; a report measures one instrument.">
          <ArticleList entries={RESEARCH} />
        </RdSection>

        <RdSection id="public" n={num('public')} title="What is public, and what is private"
          lead={OPENNESS}>
          <RdRows rows={[
            ['Public: the methodology', <>Every weight, statistical test and drift constant is on the <Link href="/methodology">methodology page</Link> and in the <a href={METHODOLOGY_PDF}>public methodology PDF</a>. {PRIVATE_BACKEND} The figures in these reports can therefore be checked against the stated rules rather than taken on trust.</>],
            ['Private: the test tasks', 'The tasks, their fixtures and their hidden tests are private, so no lab can train on them. A research page describes a task by what it asks and how it is graded, never by its content, and names a task only once it has been retired from the scored corpus.'],
            ['The record itself', <>Every page here is derived from stored runs: the per-call record of what each model was asked, whether it passed, how long it took and how many output tokens it billed, with the raw text of each answer and the provider’s own response identifiers kept since 16 June 2026. {NO_CALLS}</>],
            ['Corrections', 'Where a published figure does not survive re-examination it is withdrawn on the page that made it, with the date. Retracted detector incidents are kept in the database and flagged, never deleted, so the error record can be audited.'],
          ]} />
        </RdSection>

        <RdSection id="live" n={num('live')} title="The record, live"
          lead="The papers are dated. The same record is read continuously on these pages.">
          <RdRows rows={LIVE} />
          <RdProse>
            <p>Every model on the board is re-tested on the same tasks on the same schedule — {CADENCE} — and watched by a drift detector per suite whose false-alarm rate is published in <Link href={researchPath(REPORT)}>{REPORT.title}</Link>.</p>
          </RdProse>
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="Questions about the research">
          <Faq items={FAQ} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
