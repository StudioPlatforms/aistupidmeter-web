import type { Metadata } from 'next';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { CtaRow, LeaderboardCta, RouterCta } from '@/components/seo/Cta';
import { ScoreTable, type ScoreTableRow } from '@/components/seo/ScoreTable';
import { AsOf } from '@/components/seo/Verdict';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { boardVerdict, companyOf } from '@/components/seo/best/best-data';
import { LEADERBOARD_TOP_N } from '@/components/seo/leaderboard/leaderboard-config';
import { CADENCE, OPENNESS, TIES_RULE } from '@/components/seo/best/best-config';
import { PLANS } from '@/lib/entitlements';
import type { BoardKey } from '@/lib/boards-core';
import { MONTHS_SHORT, TITLE_MAX, TITLE_SUFFIX, breadcrumbLd, faqLd, graphLd, isoDay, itemListLd, monthLabel, pageMeta, toDate, utcStamp, webPageLd } from '@/lib/seo';
import { boardLabel, getBoards24h, getRoster, topOfBoard, type SeoBoards } from '@/lib/seo-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';

/**
 * /leaderboard: the public AI leaderboard. The full board (every model, the 7-day and 30-day views,
 * the newest run) is behind a sign-in by the owner's choice, so this page shows the first
 * LEADERBOARD_TOP_N places of each 24-hour board, with the leaderboard's own places and statistical
 * ties (lib/boards-core), and links every model to its page. Nothing is typed: every name, place,
 * score and count is read from /dashboard/boards?period=24h at render time. ISR, no auth().
 */

export const revalidate = 900;

const PATH = '/leaderboard';
const H1 = { title: 'AI leaderboard', accent: 'LLM rankings from the last 24 hours' };
const DESCRIPTION = 'The AI leaderboard for the last 24 hours: the top LLMs on the Combined, Coding, Reasoning and Tool use boards, with scores and statistical ties.';
const KEYWORDS = [
  'AI leaderboard', 'LLM leaderboard', 'AI ranking', 'AI model ranking', 'AI model rankings', 'AI benchmark ranking',
  'AI benchmarks ranking', 'LLM rankings', 'AI model leaderboard', 'AI ranking today', 'best AI model right now',
];

const BOARDS: Array<{ key: BoardKey; id: string; title: string; lead: string }> = [
  { key: 'combined', id: 'combined', title: 'Overall AI ranking: the Combined board', lead: 'Half coding, a quarter reasoning and a quarter tool use, from the same tasks for every model.' },
  { key: 'coding', id: 'coding', title: 'Coding leaderboard', lead: 'Real debugging jobs and a hard function task, graded by running the code, including tests the model never sees. Re-tested every four hours.' },
  { key: 'reasoning', id: 'reasoning', title: 'Reasoning leaderboard', lead: 'Long multi-turn working sessions, run daily; rules stated early in a session are checked by running code at later turns.' },
  { key: 'tooling', id: 'tooling', title: 'Tool use leaderboard', lead: 'Tasks in sandboxed machines, run daily: either the job is done at the end or it is not.' },
];

const TOC = [
  ...BOARDS.map((b) => ({ id: b.id, label: b.key === 'combined' ? 'Combined' : boardLabel(b.key) })),
  { id: 'how', label: 'How it is ranked' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

/** "AI leaderboard: LLM rankings (Oct 2026)": the longest form that keeps the brand, else the longest that fits. */
function leaderboardTitle(generatedAt: string | null | undefined): string {
  const d = toDate(generatedAt);
  const forms = [
    `AI leaderboard: LLM rankings (${monthLabel(d)})`,
    `AI leaderboard: LLM rankings (${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()})`,
    'AI leaderboard: LLM rankings',
  ];
  return forms.find((f) => f.length + TITLE_SUFFIX.length <= TITLE_MAX) ?? forms.find((f) => f.length <= TITLE_MAX) ?? forms[forms.length - 1];
}

export async function generateMetadata(): Promise<Metadata> {
  const boards = await getBoards24h();
  return pageMeta({ title: leaderboardTitle(boards?.generatedAt), description: DESCRIPTION, path: PATH, keywords: KEYWORDS });
}

function rowsOf(boards: SeoBoards, key: BoardKey): ScoreTableRow[] {
  return topOfBoard(boards, key, LEADERBOARD_TOP_N).map(({ row, placement }) => ({
    name: row.label,
    slug: row.slug,
    vendor: companyOf(row.provider, row.vendor),
    score: placement.score,
    se: placement.se,
    place: placement.kind === 'ranked' ? placement.place : null,
    joint: placement.kind === 'ranked' && placement.joint,
    ...(row.note ? { extra: { Coverage: row.note } } : {}),
  }));
}

export default async function LeaderboardPage() {
  const [boards, roster] = await Promise.all([getBoards24h(), getRoster()]);
  const FREE = PLANS.free;
  const modelCount = roster.length;
  const allLabel = modelCount > LEADERBOARD_TOP_N ? `See all ${modelCount} models →` : 'See every model on every board →';
  const stamp = boards?.generatedAt ?? null;
  const asOf = stamp ? `As of ${utcStamp(stamp)} · 24-hour boards` : null;
  const overall = boards ? boardVerdict(boards, 'combined') : null;
  const coding = boards ? boardVerdict(boards, 'coding') : null;
  const rankedCombined = boards?.boards.combined.ranked.length ?? 0;
  const fallback = 'Every model on the board is re-tested on the same tasks and ranked with statistical ties; the current places are on the full leaderboard.';
  const FREE_TIER = `Free account: every ranking over 24 hours, 7 days and ${FREE.historyDays} days, a ${FREE.watchedModels}-model watchlist with email alerts, ${FREE.routerRequestsPerMonth.toLocaleString('en-US')} routed requests a month and a Data API key. No card.`;

  const faq: FaqItem[] = [
    {
      q: 'Which AI model is best right now?',
      a: `${overall ?? fallback}${stamp ? ` As of ${utcStamp(stamp)}.` : ''} The board is the 24-hour view: every model's runs over the last day, ranked with statistical ties. The best model for one job (coding, reasoning, agents, value or speed) is on [best AI model](/best-ai-model).`,
    },
    {
      q: 'How are AI models ranked on this leaderboard?',
      a: `Every model gets the same tasks on the same schedule (${CADENCE}) and is graded by running what it produces, not by votes or vendor-reported numbers. The Combined score is half coding, a quarter reasoning and a quarter tool use; a suite that is missing drops out and the others are reweighted. ${OPENNESS} Every weight is on the [methodology page](/methodology).`,
    },
    {
      q: 'How often is the AI leaderboard updated?',
      a: `Coding is re-tested every four hours, reasoning and tool use daily, and an hourly canary probe watches for sudden drops between runs. The 24-hour view averages each model's runs over the last day, so one odd attempt cannot move a place.`,
    },
    {
      q: 'Why do several models share a place?',
      a: TIES_RULE,
    },
    {
      q: 'Where are the 7-day and 30-day rankings?',
      a: `On the full leaderboard, with a free account: every model on every board over 24 hours, 7 days and ${FREE.historyDays} days, and a ${FREE.watchedModels}-model watchlist with email alerts. No card. Pro and up adds the newest run as it lands.`,
    },
    {
      q: 'Which AI model is best for coding?',
      a: `${coding ?? 'The Coding board answers it, re-tested every four hours.'} The Coding board is real debugging work graded by running each project's own tests; the method and the five best-placed models are on [best LLM for coding](/best-llm-for-coding).`,
    },
  ];

  const top = boards ? topOfBoard(boards, 'combined', LEADERBOARD_TOP_N) : [];
  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'AI leaderboard', path: PATH }]),
    webPageLd({ path: PATH, name: `${H1.title}: ${H1.accent}`, description: DESCRIPTION, type: 'CollectionPage', ...(stamp ? { dateModified: isoDay(stamp) } : {}) }),
    ...(top.length
      ? [itemListLd({ name: `AI leaderboard: the first ${top.length} places on the Combined board, last 24 hours`, items: top.map(({ row }) => ({ name: row.label, url: `/models/${row.slug}` })) })]
      : []),
    faqLd(faq),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        kicker="AI leaderboard · last 24 hours"
        title={H1.title}
        accent={H1.accent}
        lead={overall ?? fallback}
        actions={(
          <CtaRow className="is-stack">
            <LeaderboardCta cta="leaderboard-hero-all" label={allLabel} />
            <RouterCta cta="leaderboard-hero-router" ghost label="Send each request to the model scoring best for it →" />
          </CtaRow>
        )}
        note={asOf ? `${asOf} · the first ${LEADERBOARD_TOP_N} places of each board here; every model, and the 7-day and 30-day views, on the full leaderboard` : undefined}
        aside={rankedCombined > 0 ? (
          <dl className="lp-facts">
            <div><dt>{rankedCombined}</dt><dd>models ranked on the Combined board in the last 24 hours</dd></div>
            <div><dt>4</dt><dd>boards: Combined, Coding, Reasoning and Tool use, every model on the same tasks</dd></div>
            <div><dt>4 h</dt><dd>between coding re-tests; reasoning and tool use run daily</dd></div>
          </dl>
        ) : undefined}
        toc={TOC}
        final={(
          <RdFinal
            title="See every model on every board"
            lead={FREE_TIER}
            actions={(
              <CtaRow>
                <LeaderboardCta cta="leaderboard-final-all" label={allLabel} />
                <RouterCta cta="leaderboard-final-router" ghost />
              </CtaRow>
            )}
          />
        )}
      >
        {BOARDS.map((b) => {
          const rows = boards ? rowsOf(boards, b.key) : [];
          return (
            <RdSection key={b.id} id={b.id} n={num(b.id)} title={b.title} lead={b.lead}>
              {rows.length ? (
                <>
                  <ScoreTable rows={rows} caption={`The first ${rows.length} places on the ${boardLabel(b.key)} board, last 24 hours`} />
                  {asOf && <AsOf>{asOf} · places with statistical ties; “=” marks a shared place</AsOf>}
                </>
              ) : (
                <RdProse><p>The board is not answering at the moment; the places are on the <Link href="/">full leaderboard</Link>.</p></RdProse>
              )}
            </RdSection>
          );
        })}

        <RdSection id="how" n={num('how')} title="How the AI ranking works"
          lead="Not votes. Real tests through each provider's API, on a fixed schedule, since August 2025.">
          <RdProse>
            <p>
              Every model gets the same tasks on the same schedule — {CADENCE} — and is graded by running what it produces. The Combined score
              is half coding, a quarter reasoning and a quarter tool use. {TIES_RULE}
            </p>
            <p>
              {OPENNESS} Every weight and constant is on the <Link href="/methodology">methodology page</Link>. For one job at a time, see{' '}
              <Link href="/best-llm-for-coding">best LLM for coding</Link>, <Link href="/best-llm-for-reasoning">best LLM for reasoning</Link>,{' '}
              <Link href="/best-ai-model-for-agents">best AI model for agents</Link> and <Link href="/compare">head-to-head comparisons</Link>;
              whether a model is slipping is on <Link href="/is-ai-getting-worse">is your AI getting worse?</Link>
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="Questions about the AI leaderboard">
          <Faq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
