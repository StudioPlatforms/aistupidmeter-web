import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdRows, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { CtaRow, LeaderboardCta, WatchCta } from '@/components/seo/Cta';
import { ScoreTable, type ScoreTableRow } from '@/components/seo/ScoreTable';
import { AsOf } from '@/components/seo/Verdict';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { and, companyOf, placeShort, scoreText } from '@/components/seo/best/best-data';
import { CADENCE, OPENNESS, TIES_RULE } from '@/components/seo/best/best-config';
import { getWorseData, numWord, verdictSentence } from '@/components/seo/worse/worse-data';
import { WORSE_VENDORS, worseH1, worsePath } from '@/components/seo/worse/worse-meta';
import { ALERT_RULE } from '@/components/seo/worse/WorsePage';
import { PLANS } from '@/lib/entitlements';
import type { BoardKey } from '@/lib/boards-core';
import { breadcrumbLd, faqLd, graphLd, isoDay, itemListLd, pageMeta, utcStamp, webPageLd } from '@/lib/seo';
import { boardLabel, placementOn, type Placement, type SeoBoards } from '@/lib/seo-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';

/**
 * /dumbest-ai-model: the question people type ("dumbest AI model", "is AI stupid", "dumb AI"),
 * answered from the 24-hour Combined board: the lowest-placed models, with the leaderboard's places
 * and statistical ties. The brand is playful in its name only; the page says "lowest-scoring on the
 * same tests" and gives the numbers. Every name and figure is read at render time. ISR, no auth().
 */

export const revalidate = 900;

const PATH = '/dumbest-ai-model';
const H1 = 'Which AI model is the dumbest right now?';
const DESCRIPTION = 'The lowest-scoring AI models on the same coding, reasoning and tool-use tests over the last 24 hours, from AI Stupid Level’s continuous benchmark.';
const BOTTOM_N = 5;

export const metadata: Metadata = pageMeta({
  title: H1,
  description: DESCRIPTION,
  path: PATH,
  keywords: ['dumbest AI model', 'dumb AI', 'is AI stupid', 'AI is stupid', 'stupidest AI', 'what is the dumbest AI', 'dumbest AI model 2026', 'worst AI model', 'lowest scoring AI model', 'AI stupid level'],
});

const TOC = [
  { id: 'lowest', label: 'Lowest-placed now' },
  { id: 'stupid', label: 'Is AI stupid?' },
  { id: 'dumber', label: 'Did my AI get dumber?' },
  { id: 'how', label: 'How it is measured' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

const fmt = (x: number): string => (Number.isInteger(x) ? String(x) : x.toFixed(1));
const pts = (x: number): string => (fmt(x) === '1' ? '1 point' : `${fmt(x)} points`);

interface Entry { label: string; slug: string; provider: string | null; vendor: string; note: string | null; placement: Placement }

/** The ranked rows of a board, in board order, with their placements and coverage notes. */
function rankedOf(boards: SeoBoards, key: BoardKey): Entry[] {
  return boards.boards[key].ranked.map((row) => ({
    label: row.label, slug: row.slug, provider: row.provider, vendor: row.vendor, note: row.note, placement: placementOn(boards, key, row.id),
  }));
}

/** The models sharing the board's lowest place (one entry when the last model stands alone). */
function lowestGroup(entries: Entry[]): Entry[] {
  const last = entries[entries.length - 1];
  if (!last || last.placement.place === null) return [];
  return entries.filter((e) => e.placement.place === last.placement.place);
}

/** "X is the lowest-placed model on the Coding board over the last 24 hours: 24th of 24, scoring 61 ± 2.0." */
function lowestSentence(entries: Entry[], key: BoardKey): string | null {
  const group = lowestGroup(entries);
  if (!group.length) return null;
  const label = boardLabel(key);
  const where = `on the ${label} board over the last 24 hours`;
  const place = placeShort(group[0].placement);
  if (group.length === entries.length && entries.length > 1) {
    return `All ${entries.length} ranked models share one place ${where}: too close for the measurement to separate.`;
  }
  if (group.length === 1) {
    const e = group[0];
    return `${e.label} is the lowest-placed model ${where}: ${place}${e.placement.score !== null ? `, scoring ${scoreText(e.placement)}` : ''}.`;
  }
  if (group.length <= 3) {
    return `${and(group.map((e) => e.label))} share the lowest place ${where}, ${place}: ${group.map((e) => `${e.label} ${scoreText(e.placement)}`).join(', ')}, too close for the measurement to separate.`;
  }
  const a = group[0];
  const b = group[group.length - 1];
  return `${group.length} models share the lowest place ${where}, ${place}, from ${a.label} (${scoreText(a.placement)}) to ${b.label} (${scoreText(b.placement)}), too close for the measurement to separate.`;
}

interface Spread { count: number; median: number; min: number; max: number }
function spreadOf(entries: Entry[]): Spread | null {
  const xs = entries.map((e) => e.placement.score).filter((x): x is number => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  const median = xs.length % 2 ? xs[mid] : Math.round(((xs[mid - 1] + xs[mid]) / 2) * 10) / 10;
  return { count: xs.length, median, min: xs[0], max: xs[xs.length - 1] };
}

export default async function DumbestAiModelPage() {
  const data = await getWorseData();
  const boards = data.boards;
  const stamp = boards?.generatedAt ?? null;
  const asOf = stamp ? `As of ${utcStamp(stamp)} · Combined board, last 24 hours` : null;

  const combined = boards ? rankedOf(boards, 'combined') : [];
  const coding = boards ? rankedOf(boards, 'coding') : [];
  const reasoning = boards ? rankedOf(boards, 'reasoning') : [];
  const tooling = boards ? rankedOf(boards, 'tooling') : [];

  const lowest = lowestSentence(combined, 'combined');
  const lowestCoding = lowestSentence(coding, 'coding');
  const first = combined[0]?.placement.score ?? null;
  const last = combined[combined.length - 1]?.placement.score ?? null;
  const gapLine = first !== null && last !== null && first > last
    ? `First place on the same board scores ${fmt(first)}, ${pts(first - last)} higher.`
    : null;
  const fallback = 'The lowest places on the 24-hour boards are on the full leaderboard; the board is not answering at the moment.';
  const fleet = verdictSentence(data.models, null);

  const spreads: Array<{ key: BoardKey; s: Spread | null }> = [
    { key: 'coding', s: spreadOf(coding) },
    { key: 'reasoning', s: spreadOf(reasoning) },
    { key: 'tooling', s: spreadOf(tooling) },
  ];
  const spreadRows: [ReactNode, ReactNode][] = spreads.filter((x) => x.s).map(({ key, s }) => [
    `${boardLabel(key)} board`,
    `median ${fmt(s!.median)} out of 100 across the ${s!.count} ranked models; lowest ${fmt(s!.min)}, highest ${fmt(s!.max)}`,
  ]);
  const codingSpread = spreads[0].s;
  const stupidAnswer = codingSpread
    ? `It depends on the task. On the fixed coding tasks we run — real debugging jobs graded by running the project's own tests — the median model on the Coding board scored ${fmt(codingSpread.median)} out of 100 over the last 24 hours, and the lowest-placed ${fmt(codingSpread.min)}. The same tasks run on every model, so a low score is a test result, not an impression.`
    : 'It depends on the task. Every model gets the same fixed tasks, graded by running what it produces, so a low score is a test result, not an impression.';

  const bottom = combined.slice(-BOTTOM_N);
  const rows: ScoreTableRow[] = bottom.map((e) => ({
    name: e.label,
    slug: e.slug,
    vendor: companyOf(e.provider, e.vendor),
    score: e.placement.score,
    se: e.placement.se,
    place: e.placement.kind === 'ranked' ? e.placement.place : null,
    joint: e.placement.kind === 'ranked' && e.placement.joint,
    trend: e.placement.trend,
    // As on the leaderboard: a model graded on fewer tasks than the rest says so in its row.
    ...(e.note ? { extra: { Coverage: e.note } } : {}),
  }));

  const familyLinks = WORSE_VENDORS.map((k) => `[${worseH1(k).replace(/\?$/, '')}](${worsePath(k)})`);

  const faq: FaqItem[] = [
    {
      q: H1,
      a: `${lowest ?? fallback}${gapLine ? ` ${gapLine}` : ''} Lowest here means lowest-scoring on the same tests over the last 24 hours; the full order is on the [AI leaderboard](/leaderboard).`,
    },
    {
      q: 'Is AI stupid?',
      a: stupidAnswer,
    },
    {
      q: 'What is the dumbest AI model for coding?',
      a: `${lowestCoding ?? 'The Coding board answers it; it is not answering at the moment.'} The top of the same board is on [best LLM for coding](/best-llm-for-coding).`,
    },
    {
      q: 'Did my AI get dumber?',
      a: `${fleet ? `${fleet} ` : ''}A provider can change a model behind the same name, so every model is compared with its own past by a drift detector per suite. The answer for every model is on [is your AI getting worse?](/is-ai-getting-worse), and family by family: ${familyLinks.join(', ')}.`,
    },
    {
      q: 'How is the stupid level measured?',
      a: `Every model gets the same tasks on the same schedule (${CADENCE}) and is graded by running what it produces: code against the project's own tests, and tool-use tasks in sandboxed machines, where either the job is done at the end or it is not. ${OPENNESS} The weights are on the [methodology page](/methodology).`,
    },
    {
      q: 'Why does a model place low?',
      a: `Because it scored lower than the models placed above it on the same tasks over the last 24 hours. ${TIES_RULE} Every model is re-tested on the same schedule, so its place can move as soon as the model changes.`,
    },
  ];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Dumbest AI model', path: PATH }]),
    webPageLd({ path: PATH, name: H1, description: DESCRIPTION, ...(stamp ? { dateModified: isoDay(stamp) } : {}) }),
    ...(bottom.length
      ? [itemListLd({ name: 'The lowest-placed models on the Combined board, last 24 hours', items: bottom.map((e) => ({ name: e.label, url: `/models/${e.slug}` })) })]
      : []),
    faqLd(faq),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        kicker="Lowest-scoring AI models · last 24 hours"
        title={H1}
        lead={lowest ?? fallback}
        actions={(
          <CtaRow className="is-stack">
            <WatchCta cta="dumbest-hero-watch" label="Watch the models you use →" />
            <LeaderboardCta cta="dumbest-hero-leaderboard" ghost />
          </CtaRow>
        )}
        note={asOf ?? undefined}
        aside={combined.length ? (
          <dl className="lp-facts">
            <div><dt>{combined.length}</dt><dd>models ranked on the Combined board in the last 24 hours, every one on the same tasks</dd></div>
            {first !== null && last !== null && first > last && <div><dt>{fmt(first - last)}</dt><dd>points between first and last place on that board</dd></div>}
            {codingSpread && <div><dt>{fmt(codingSpread.median)}</dt><dd>the median Coding score out of 100, graded by running the code</dd></div>}
          </dl>
        ) : undefined}
        toc={TOC}
        final={(
          <RdFinal
            title="Know when a model you use slips"
            lead={`Every model is re-tested on a fixed schedule. Watch the ones you depend on, ${numWord(PLANS.free.watchedModels)} free: ${ALERT_RULE}.`}
            actions={(
              <CtaRow>
                <WatchCta cta="dumbest-final-watch" label="Watch the models you use →" />
                <LeaderboardCta cta="dumbest-final-leaderboard" ghost />
              </CtaRow>
            )}
          />
        )}
      >
        <RdSection id="lowest" n={num('lowest')} title="The lowest-placed models right now"
          lead="The bottom of the 24-hour Combined board, with the leaderboard's places and statistical ties: the lowest-scoring models on the same tests.">
          {rows.length ? (
            <>
              <ScoreTable rows={rows} caption={`The ${rows.length} lowest-placed models on the Combined board, last 24 hours, in board order`} />
              {asOf && <AsOf>{asOf} · “=” marks a shared place</AsOf>}
            </>
          ) : (
            <RdProse><p>{fallback}</p></RdProse>
          )}
          {gapLine && <RdProse><p>{gapLine} The full order is on the <Link href="/leaderboard">AI leaderboard</Link>.</p></RdProse>}
        </RdSection>

        <RdSection id="stupid" n={num('stupid')} title="Is AI stupid?" lead={stupidAnswer}>
          {spreadRows.length > 0 && <RdRows rows={spreadRows} />}
        </RdSection>

        <RdSection id="dumber" n={num('dumber')} title="Did my AI get dumber?"
          lead="A model can change behind the same name. Every model is compared with its own past by a drift detector per suite, so a decline shows as a dated change.">
          <RdProse>
            {fleet && <p>{fleet}</p>}
            <p>
              The model-by-model answer is on <Link href="/is-ai-getting-worse">is your AI getting worse?</Link>, and by family:{' '}
              {WORSE_VENDORS.map((k, i) => (
                <span key={k}>{i > 0 && (i === WORSE_VENDORS.length - 1 ? ' and ' : ', ')}<Link href={worsePath(k)}>{worseH1(k).replace(/\?$/, '')}</Link></span>
              ))}.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="how" n={num('how')} title="How the stupid level is measured"
          lead="Not votes. Real tests through each provider's API, on a fixed schedule, since August 2025.">
          <RdProse>
            <p>
              Every model gets the same tasks on the same schedule — {CADENCE} — and is graded by running what it produces: code against the
              project&apos;s own tests, including tests the model never sees, and tool-use tasks in sandboxed machines, where either the job is done at the end
              or it is not. {TIES_RULE}
            </p>
            <p>{OPENNESS} Every weight is on the <Link href="/methodology">methodology page</Link>.</p>
          </RdProse>
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="Questions people ask">
          <Faq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
