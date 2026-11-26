import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReadingPage, RdSection, RdProse, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { CtaRow, LeaderboardCta, RouterCta } from '@/components/seo/Cta';
import { ScoreTable } from '@/components/seo/ScoreTable';
import { AsOf } from '@/components/seo/Verdict';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { CADENCE, TIES_RULE } from '@/components/seo/best/best-config';
import { LEADERBOARD_TOP_N } from '@/components/seo/leaderboard/leaderboard-config';
import { leadSentence, tableRows, windowText } from '@/components/seo/rankings/rankings-data';
import type { BoardKey } from '@/lib/boards-core';
import { listSnapshots, monthFromSlug, monthPath, monthSlug, monthTitle, readMonth, type RankingsSnapshot } from '@/lib/rankings-archive';
import { TITLE_SUFFIX, breadcrumbLd, clampDesc, dayLabel, faqLd, graphLd, isoDay, itemListLd, pageMeta, utcStamp, webPageLd } from '@/lib/seo';
import { boardLabel } from '@/lib/seo-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';

/**
 * /rankings/<month-year> (e.g. /rankings/december-2026): one month of the rankings archive. Everything
 * on the page is read from that month's record (lib/rankings-archive.ts), written once when the month
 * ended; the page never reads today's boards, so it says the same thing next year. A month with no
 * record is a 404. ISR: the freeze route revalidates the path when it writes a record.
 */
export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams(): Array<{ month: string }> {
  return listSnapshots().map((s) => ({ month: monthSlug(s.month) }));
}

const BOARDS: Array<{ key: BoardKey; id: string; lead: string }> = [
  { key: 'combined', id: 'combined', lead: 'Half coding, a quarter reasoning and a quarter tool use, from the same tasks for every model.' },
  { key: 'coding', id: 'coding', lead: 'Real debugging jobs and a hard function task, graded by running the code, including tests the model never sees.' },
  { key: 'reasoning', id: 'reasoning', lead: 'Long multi-turn working sessions; rules stated early in a session are checked by running code at later turns.' },
  { key: 'tooling', id: 'tooling', lead: 'Tasks in sandboxed machines: either the job is done at the end or it is not.' },
];

const record = (slug: string): RankingsSnapshot | null => {
  const month = monthFromSlug(slug);
  return month ? readMonth(month) : null;
};

const titleOf = (s: RankingsSnapshot): string => `AI model & LLM rankings: ${monthTitle(s.month)}`;
const descriptionOf = (s: RankingsSnapshot): string => clampDesc(
  `The AI model rankings for ${monthTitle(s.month)}: the top LLMs on the Combined, Coding, Reasoning and Tool use boards over 30 days, frozen on ${dayLabel(s.frozenAt)}.`,
);

export async function generateMetadata(props: { params: Promise<{ month: string }> }): Promise<Metadata> {
  const { month } = await props.params;
  const s = record(month);
  if (!s) return { title: { absolute: `Rankings not found${TITLE_SUFFIX}` }, robots: { index: false, follow: true } };
  const modified = s.notes?.length ? `${s.notes[s.notes.length - 1].date}T00:00:00.000Z` : s.frozenAt;
  return pageMeta({
    title: titleOf(s),
    description: descriptionOf(s),
    path: monthPath(s.month),
    type: 'article',
    publishedTime: s.frozenAt,
    modifiedTime: modified,
    keywords: [`AI model rankings ${monthTitle(s.month)}`, `LLM rankings ${monthTitle(s.month)}`, `best AI model ${monthTitle(s.month)}`, `LLM leaderboard ${monthTitle(s.month)}`],
  });
}

export default async function RankingsMonthPage(props: { params: Promise<{ month: string }> }) {
  const { month } = await props.params;
  const s = record(month);
  if (!s) notFound();

  const name = monthTitle(s.month);
  const path = monthPath(s.month);
  const others = listSnapshots().filter((o) => o.month !== s.month).slice(0, 12);
  const window = windowText(s);
  const frozen = `Frozen ${utcStamp(s.frozenAt)}`;

  const TOC = [
    ...BOARDS.map((b) => ({ id: b.id, label: b.key === 'combined' ? 'Combined' : boardLabel(b.key) })),
    { id: 'record', label: 'How the record is made' },
    ...(others.length ? [{ id: 'months', label: 'Other months' }] : []),
    { id: 'faq', label: 'FAQ' },
  ];
  const num = (id: string) => tocNumber(TOC, id);

  const faq: FaqItem[] = [
    {
      q: `Which AI model was best in ${name}?`,
      a: `${leadSentence(s, 'combined')} ${leadSentence(s, 'coding')} ${leadSentence(s, 'reasoning')} ${leadSentence(s, 'tooling')} The boards cover ${window}.`,
    },
    {
      q: 'How are the monthly AI rankings made?',
      a: `On the first day of each month the leaderboard's 30-day boards are copied as they stand and stored: the first ${LEADERBOARD_TOP_N} places of the Combined, Coding, Reasoning and Tool use boards, with their statistical ties. Every model gets the same tasks on the same schedule (${CADENCE}), and the Combined score is half coding, a quarter reasoning and a quarter tool use. Every weight is on the [methodology page](/methodology).`,
    },
    {
      q: 'Does this page change after the month ends?',
      a: `No. The record is written once and its places are not edited afterwards; if something needs correcting, a dated note is added under the tables. Today's places are on the [AI leaderboard](/leaderboard).`,
    },
  ];

  const top = s.boards.combined.rows;
  const modified = s.notes?.length ? s.notes[s.notes.length - 1].date : isoDay(s.frozenAt);
  const ld = graphLd([
    breadcrumbLd([
      { name: 'Home', path: '/' },
      { name: 'AI leaderboard', path: '/leaderboard' },
      { name: 'Monthly rankings', path: '/rankings' },
      { name, path },
    ]),
    webPageLd({ path, name: `AI model rankings: ${name}`, description: descriptionOf(s), type: 'CollectionPage', datePublished: isoDay(s.frozenAt), dateModified: modified }),
    itemListLd({ name: `AI model rankings, ${name}: the first ${top.length} places on the Combined board`, items: top.map((r) => ({ name: r.name, url: `/models/${r.slug}` })) }),
    faqLd(faq),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        kicker="Monthly AI rankings · frozen record"
        title={`AI model rankings: ${name}`}
        accent="The top LLMs on every board, as the month ended"
        lead={leadSentence(s, 'combined')}
        actions={(
          <CtaRow className="is-stack">
            <LeaderboardCta cta="rankings-month-hero-board" label="See where every model stands today →" />
            <RouterCta cta="rankings-month-hero-router" ghost label="Send each request to the model scoring best for it →" />
          </CtaRow>
        )}
        note={`${frozen} · ${window} · the first ${LEADERBOARD_TOP_N} places of each board`}
        aside={(
          <dl className="lp-facts">
            <div><dt>{s.boards.combined.ranked}</dt><dd>models ranked on the Combined board when {name} ended</dd></div>
            <div><dt>4</dt><dd>boards: Combined, Coding, Reasoning and Tool use, every model on the same tasks</dd></div>
            <div><dt>30</dt><dd>days of runs behind every place on this page</dd></div>
          </dl>
        )}
        toc={TOC}
        final={(
          <RdFinal
            title="See where every model stands today"
            lead="The live leaderboard re-tests every model on a schedule: coding every four hours, reasoning and tool use daily."
            actions={(
              <CtaRow>
                <LeaderboardCta cta="rankings-month-final-board" label="Open the leaderboard →" />
                <RouterCta cta="rankings-month-final-router" ghost />
              </CtaRow>
            )}
          />
        )}
      >
        {BOARDS.map((b) => (
          <RdSection key={b.id} id={b.id} n={num(b.id)}
            title={b.key === 'combined' ? `Overall AI ranking, ${name}: the Combined board` : `${boardLabel(b.key)} leaderboard, ${name}`}
            lead={b.lead}>
            <RdProse><p>{leadSentence(s, b.key)}</p></RdProse>
            <ScoreTable rows={tableRows(s, b.key)} caption={`The first ${s.boards[b.key].rows.length} places on the ${boardLabel(b.key)} board, ${name}`} />
            <AsOf>{frozen} · {window} · places with statistical ties; “=” marks a shared place</AsOf>
          </RdSection>
        ))}

        <RdSection id="record" n={num('record')} title="How this record is made"
          lead="Copied from the leaderboard's 30-day boards when the month ended, then left alone.">
          <RdProse>
            <p>
              On the first day of each month the 30-day boards are copied as they stand: the first {LEADERBOARD_TOP_N} places of each board,
              with the places and ties the leaderboard showed. {TIES_RULE}
            </p>
            <p>
              Every model gets the same tasks on the same schedule: {CADENCE}. The Combined score is half coding, a quarter reasoning and a
              quarter tool use; every weight and constant is on the <Link href="/methodology">methodology page</Link>. The places are not
              edited after the freeze. Today&rsquo;s places are on the <Link href="/leaderboard">AI leaderboard</Link>, and whether a model
              has slipped since is on the <Link href="/ai-degradation-tracker">AI degradation tracker</Link>.
            </p>
            {s.notes?.length ? (
              <>
                <p><strong>Notes added since the freeze</strong></p>
                <ul>
                  {s.notes.map((n, i) => <li key={i}>{dayLabel(`${n.date}T00:00:00Z`)}: {n.text}</li>)}
                </ul>
              </>
            ) : null}
          </RdProse>
        </RdSection>

        {others.length > 0 && (
          <RdSection id="months" n={num('months')} title="Other months" lead="Each month is its own frozen record.">
            <RdProse>
              <ul>
                {others.map((o) => (
                  <li key={o.month}><Link href={monthPath(o.month)}>AI model rankings: {monthTitle(o.month)}</Link></li>
                ))}
              </ul>
              <p><Link href="/rankings">Every month in the archive →</Link></p>
            </RdProse>
          </RdSection>
        )}

        <RdSection id="faq" n={num('faq')} title={`Questions about the ${name} rankings`}>
          <Faq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
