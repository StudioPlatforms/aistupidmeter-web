import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReadingPage, RdSection, RdProse, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { CtaRow, LeaderboardCta, RouterCta } from '@/components/seo/Cta';
import { CADENCE } from '@/components/seo/best/best-config';
import { LEADERBOARD_TOP_N } from '@/components/seo/leaderboard/leaderboard-config';
import { leaderShort, leadSentence } from '@/components/seo/rankings/rankings-data';
import { BOARD_KEYS } from '@/lib/boards-core';
import { listSnapshots, monthPath, monthTitle } from '@/lib/rankings-archive';
import { breadcrumbLd, dayLabel, graphLd, isoDay, itemListLd, pageMeta, webPageLd } from '@/lib/seo';
import { boardLabel } from '@/lib/seo-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';

/**
 * /rankings: the index of the monthly rankings archive (lib/rankings-archive.ts), newest month first.
 * Read from the records on disk; with no record yet the page is a 404 and nothing links to it.
 * ISR: the freeze route revalidates the path when it writes a month.
 */
export const revalidate = 3600;

const PATH = '/rankings';
const TITLE = 'Monthly AI model & LLM rankings archive';
const DESCRIPTION = 'Monthly AI model rankings: a frozen record of the top LLMs on the Combined, Coding, Reasoning and Tool use boards for each month, kept unedited.';

const TOC = [
  { id: 'months', label: 'Month by month' },
  { id: 'record', label: 'How a month is recorded' },
];
const num = (id: string) => tocNumber(TOC, id);

export function generateMetadata(): Metadata {
  if (!listSnapshots().length) return { title: { absolute: 'Rankings not found | AI Stupid Level' }, robots: { index: false, follow: true } };
  return pageMeta({ title: TITLE, description: DESCRIPTION, path: PATH, keywords: ['AI model rankings by month', 'monthly LLM rankings', 'LLM leaderboard history', 'AI leaderboard archive'] });
}

export default function RankingsIndexPage() {
  const months = listSnapshots();
  if (!months.length) notFound();
  const newest = months[0];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'AI leaderboard', path: '/leaderboard' }, { name: 'Monthly rankings', path: PATH }]),
    webPageLd({ path: PATH, name: TITLE, description: DESCRIPTION, type: 'CollectionPage', dateModified: isoDay(newest.frozenAt) }),
    itemListLd({ name: 'AI model rankings by month', items: months.map((s) => ({ name: `AI model rankings: ${monthTitle(s.month)}`, url: monthPath(s.month) })) }),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        kicker="Monthly AI rankings · archive"
        title="AI model rankings by month"
        accent="A frozen record of the leaderboard, month by month"
        lead={leadSentence(newest, 'combined')}
        actions={(
          <CtaRow className="is-stack">
            <LeaderboardCta cta="rankings-index-hero-board" label="See where every model stands today →" />
            <RouterCta cta="rankings-index-hero-router" ghost label="Send each request to the model scoring best for it →" />
          </CtaRow>
        )}
        note={`Newest record: ${monthTitle(newest.month)}, frozen ${dayLabel(newest.frozenAt)} · the first ${LEADERBOARD_TOP_N} places of each board`}
        toc={TOC}
        final={(
          <RdFinal
            title="See where every model stands today"
            lead="The live leaderboard re-tests every model on a schedule: coding every four hours, reasoning and tool use daily."
            actions={(
              <CtaRow>
                <LeaderboardCta cta="rankings-index-final-board" label="Open the leaderboard →" />
                <RouterCta cta="rankings-index-final-router" ghost />
              </CtaRow>
            )}
          />
        )}
      >
        <RdSection id="months" n={num('months')} title="AI model rankings, month by month"
          lead="Who led each board when the month ended. Each month opens its full record.">
          <div className="rd-table-wrap seo-table-wrap lp-up">
            <table className="rd-table seo-table">
              <caption className="seo-table-cap">The leader of each board in every recorded month, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  {BOARD_KEYS.map((k) => <th key={k} scope="col">{boardLabel(k)}</th>)}
                </tr>
              </thead>
              <tbody>
                {months.map((s) => (
                  <tr key={s.month}>
                    <th scope="row"><Link href={monthPath(s.month)}>{monthTitle(s.month)}</Link></th>
                    {BOARD_KEYS.map((k) => <td key={k}>{leaderShort(s, k)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RdSection>

        <RdSection id="record" n={num('record')} title="How a month is recorded"
          lead="Copied from the leaderboard's 30-day boards when the month ends, then left alone.">
          <RdProse>
            <p>
              On the first day of each month the 30-day boards are copied as they stand: the first {LEADERBOARD_TOP_N} places of the Combined,
              Coding, Reasoning and Tool use boards, with their statistical ties. The places are not edited afterwards; a correction is added
              as a dated note on the month&rsquo;s page.
            </p>
            <p>
              Every model gets the same tasks on the same schedule: {CADENCE}. Every weight and constant is on the{' '}
              <Link href="/methodology">methodology page</Link>; today&rsquo;s places are on the <Link href="/leaderboard">AI leaderboard</Link>,
              and the best model for one job is on <Link href="/best-ai-model">best AI model</Link>.
            </p>
          </RdProse>
        </RdSection>
      </ReadingPage>
    </>
  );
}
