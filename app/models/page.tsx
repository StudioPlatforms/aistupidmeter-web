import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { ScoreTable, type ScoreTableRow } from '@/components/seo/ScoreTable';
import { AsOf, Verdict } from '@/components/seo/Verdict';
import { CtaRow, LeaderboardCta, RouterCta } from '@/components/seo/Cta';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { PLANS } from '@/lib/entitlements';
import type { BoardKey } from '@/lib/boards-core';
import { MONTHS_SHORT, TITLE_MAX, TITLE_SUFFIX, breadcrumbLd, dayLabel, faqLd, graphLd, isoDay, itemListLd, monthLabel, pageMeta, toDate, utcStamp, webPageLd } from '@/lib/seo';
import {
  VENDORS, boardLabel, byDisplayName, getBoards24h, getRoster, modelsOfVendor, placementOn, placementSentence, vendorMention,
  type Placement, type SeoBoards, type SeoModel, type Vendor,
} from '@/lib/seo-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';

/**
 * /models: the hub of the model pages. Every model on the roster, grouped by vendor, with its
 * 24-hour Combined score and place (the leaderboard's own statistical ties, through
 * lib/boards-core) and each suite's score, linking every model page and every vendor page.
 * ISR every fifteen minutes; no auth(), cookies() or headers(): it reads the free 24-hour boards
 * only. Static copy names vendors and families; every model name, count, score and place is
 * read at render time, and a feed that does not answer leaves its table out.
 */
export const revalidate = 900;

const PATH = '/models';
const H1 = 'Every AI model we benchmark';
const DESCRIPTION = 'Every model on the AI Stupid Level leaderboard, by vendor, with 24-hour Combined score and place: coding every four hours, reasoning and tool use daily.';
const CADENCE = 'coding every four hours, reasoning and tool use daily, with an hourly canary probe';
const OPENNESS = 'The methodology is public — every weight, statistical test and drift constant. The test tasks are private, so no lab can train on them.';
const FREE = PLANS.free;
const n = (x: number) => x.toLocaleString('en-US');
const FREE_TIER = `Free account: every ranking over 24 hours, 7 days and ${FREE.historyDays} days, a ${FREE.watchedModels}-model watchlist with email alerts, ${n(FREE.routerRequestsPerMonth)} routed requests a month and a Data API key. No card.`;
const SUITES: BoardKey[] = ['coding', 'reasoning', 'tooling'];
const TITLE_PART_MAX = TITLE_MAX - TITLE_SUFFIX.length; // 42

const fmtScore = (s: number): string => (Number.isInteger(s) ? String(s) : s.toFixed(1));
const scoreText = (p: Placement): string => (p.score === null ? '' : p.se !== null && Number.isFinite(p.se) ? `${fmtScore(p.score)} ± ${p.se.toFixed(1)}` : fmtScore(p.score));
const placeMark = (p: Placement): string => (p.kind === 'ranked' && p.place !== null ? `${p.joint ? '=' : ''}${p.place}` : 'not ranked');
const listJoin = (items: string[]): string => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/**
 * "AI models benchmarked: full roster (October 2026)" when it fits the 60-character title with
 * the site suffix, else the shorter forms, the month always from the boards' own timestamp.
 */
function hubTitle(generatedAt: string | null | undefined): string {
  const d = toDate(generatedAt);
  const long = monthLabel(d);
  const short = `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const candidates = [
    `AI models benchmarked: full roster (${long})`,
    `AI models benchmarked: full roster (${short})`,
    `All AI models benchmarked (${long})`,
    `All AI models benchmarked (${short})`,
    'AI models benchmarked: full roster',
  ];
  return candidates.find((c) => c.length <= TITLE_PART_MAX) ?? candidates[candidates.length - 1];
}

export async function generateMetadata(): Promise<Metadata> {
  const boards = await getBoards24h();
  return pageMeta({
    title: hubTitle(boards?.generatedAt),
    description: DESCRIPTION,
    path: PATH,
    keywords: [
      'AI models benchmarked', 'LLM benchmark list', 'all AI models compared', 'GPT benchmark', 'Claude benchmark', 'Gemini benchmark',
      'DeepSeek benchmark', 'Kimi benchmark', 'GLM benchmark', 'AI model rankings', 'LLM leaderboard models',
    ],
  });
}

/** The vendor's models in Combined board order (ranked, then community, then other), then any on no board by name. */
function orderedOf(roster: SeoModel[], boards: SeoBoards | null, vendor: Vendor): SeoModel[] {
  const mine = modelsOfVendor(roster, vendor.key);
  const byId = new Map(mine.map((m) => [m.id, m] as const));
  const out: SeoModel[] = [];
  if (boards) {
    const b = boards.boards.combined;
    for (const row of [...b.ranked, ...b.community, ...b.other]) {
      const m = byId.get(row.id);
      if (m && !out.includes(m)) out.push(m);
    }
  }
  for (const m of [...mine].sort(byDisplayName)) if (!out.includes(m)) out.push(m);
  return out;
}

function rowsOf(models: SeoModel[], boards: SeoBoards | null, vendorLabel: string): ScoreTableRow[] {
  return models.map((m) => {
    const c = boards ? placementOn(boards, 'combined', m.id) : null;
    const extra: Record<string, string> = {};
    if (boards) {
      for (const k of SUITES) {
        const p = placementOn(boards, k, m.id);
        if (p.kind === 'absent' || p.score === null) continue;
        extra[boardLabel(k)] = `${fmtScore(p.score)} (${placeMark(p)})`;
      }
    }
    return {
      name: m.displayName,
      slug: m.slug,
      vendor: vendorLabel,
      score: c?.score ?? null,
      se: c?.se ?? null,
      place: c && c.kind === 'ranked' ? c.place : null,
      joint: !!c && c.kind === 'ranked' && c.joint,
      trend: c?.trend ?? null,
      extra,
    };
  });
}

export default async function ModelsIndexPage() {
  const [roster, boards] = await Promise.all([getRoster(), getBoards24h()]);

  /* ── per-vendor groups, in the registry's order; a vendor with no model on the roster is left out ── */
  const groups = VENDORS
    .map((v) => ({ vendor: v, models: orderedOf(roster, boards, v) }))
    .filter((g) => g.models.length > 0);
  const onBoard = boards ? roster.filter((m) => !!boards.byId[m.id]) : [];
  const vendorsOnBoard = groups.filter((g) => g.models.some((m) => !!boards?.byId[m.id])).length;
  const ranked = boards ? boards.boards.combined.ranked : [];
  const rankedCount = ranked.length;
  const best = boards && ranked[0] ? roster.find((m) => m.id === ranked[0].id) ?? null : null;
  const bestPlace = best && boards ? placementOn(boards, 'combined', best.id) : null;
  const tiedForFirst = boards ? boards.boards.combined.tiedForFirst : 0;

  /** The earliest "tracked since" among the models on the roster. */
  const since = roster.map((m) => m.createdAt).filter((d): d is string => !!d).sort()[0] ?? null;
  const asOf = boards ? utcStamp(boards.generatedAt) : null;

  const verdict = boards && onBoard.length
    ? `${onBoard.length} models from ${vendorsOnBoard} vendors are on the 24-hour boards; ${rankedCount} are ranked on the Combined board.` +
      (best && bestPlace ? ` ${tiedForFirst > 1 ? `${tiedForFirst} models share first place; the board lists ${best.displayName} first` : `The best placed is ${best.displayName}`}, ${placementSentence(bestPlace, boardLabel('combined'))}${bestPlace.score !== null ? `, scoring ${scoreText(bestPlace)}` : ''}.` : '')
    : null;

  /** The whole roster in Combined board order, for the ItemList and the FAQ. */
  const ordered: SeoModel[] = [];
  for (const g of groups) for (const m of g.models) ordered.push(m);
  const inBoardOrder = boards
    ? [...ordered].sort((a, b) => {
      const pa = placementOn(boards, 'combined', a.id);
      const pb = placementOn(boards, 'combined', b.id);
      return (pa.place ?? Number.POSITIVE_INFINITY) - (pb.place ?? Number.POSITIVE_INFINITY) || byDisplayName(a, b);
    })
    : ordered;

  const vendorCounts = groups.map((g) => `${vendorMention(g.vendor)} (${g.models.length})`);

  /* ── FAQ: one array feeds the visible questions and the FAQPage structured data ── */
  const faq: FaqItem[] = [
    {
      q: 'How many AI models does AI Stupid Level benchmark?',
      a: (roster.length
        ? `${roster.length} models from ${groups.length} vendors are on the roster: ${listJoin(vendorCounts)}.${boards ? ` ${onBoard.length} of them have a score on the 24-hour boards.` : ''} `
        : 'Every model on the leaderboard is on this page, grouped by vendor. ') +
        `Each has a page of its own with its place on every board, its drift state and its head-to-head comparisons. The list grows as models are released and shrinks when a provider retires one.`,
    },
    {
      q: 'Which AI model has the highest Combined score?',
      a: best && bestPlace
        ? `${best.displayName}: ${placementSentence(bestPlace, boardLabel('combined'))}${bestPlace.score !== null ? `, scoring ${scoreText(bestPlace)}` : ''}.${tiedForFirst > 1 ? ` ${tiedForFirst} models share first place: their scores are closer together than the measurement can separate.` : ''} The Combined score weights coding 50%, reasoning 25% and tool use 25%. The leaders of every board are on [the best AI model](/best-ai-model).`
        : 'The Combined score weights coding 50%, reasoning 25% and tool use 25%, and the boards rank every model with statistical ties. The current leaders are on [the best AI model](/best-ai-model).',
    },
    {
      q: 'How often is each model re-tested?',
      a: `Every model on the board gets the same tasks on the same schedule: ${CADENCE}. ${OPENNESS} Every weight is on the [methodology page](/methodology).`,
    },
    {
      q: 'How are the places decided?',
      a: 'Every score carries a standard error from its own run-to-run repeatability. Walking down a board, a model joins the group above it unless that group’s leader is ahead by more than 1.96 times their combined standard error, so places such as 1, 1, 1, 4 are normal and a shared place is written "joint" (an "=" in the tables). A model whose reasoning or tool-use runs are funded by the community is shown but not ranked on the Combined board. The rule is on the [methodology page](/methodology#ranks).',
    },
  ];

  /* ── structured data ── */
  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Models', path: PATH }]),
    webPageLd({ path: PATH, name: H1, description: DESCRIPTION, type: 'CollectionPage', ...(boards ? { dateModified: isoDay(boards.generatedAt) } : {}) }),
    ...(inBoardOrder.length ? [itemListLd({ name: 'AI models benchmarked by AI Stupid Level', items: inBoardOrder.map((m) => ({ name: m.displayName, url: `/models/${m.slug}` })) })] : []),
    faqLd(faq),
  ]);

  const toc = [
    { id: 'roster', label: 'The roster' },
    ...groups.map((g) => ({ id: g.vendor.key, label: g.vendor.family })),
    { id: 'compare', label: 'Compare' },
    { id: 'how', label: 'How we test' },
    { id: 'faq', label: 'FAQ' },
  ];
  const num = (id: string) => tocNumber(toc, id);

  const facts: ReactNode = (roster.length > 0 || since) ? (
    <dl className="lp-facts">
      {boards && onBoard.length > 0 && <div><dt>{onBoard.length}</dt><dd>models on the 24-hour boards, from {vendorsOnBoard} vendors</dd></div>}
      {!boards && roster.length > 0 && <div><dt>{roster.length}</dt><dd>models on the roster, from {groups.length} vendors</dd></div>}
      {rankedCount > 0 && <div><dt>{rankedCount}</dt><dd>ranked on the Combined board, with statistical ties</dd></div>}
      {since && <div><dt>{dayLabel(since)}</dt><dd>tracked since, for the longest-tracked model on the roster</dd></div>}
    </dl>
  ) : undefined;

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        className="rd-models"
        kicker="Models"
        title={H1}
        accent="on the same tests, on a fixed schedule"
        lead={<>
          AI Stupid Level gives every model on the board the same coding, reasoning and tool-use tasks: {CADENCE}. {OPENNESS}
        </>}
        actions={<>
          <a className="lp-btn lp-btn-primary lp-btn-lg" href="#roster" data-cta="models-hero-roster">See the roster <span className="lp-ar" aria-hidden="true">→</span></a>
          <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/compare" data-cta="models-hero-compare">Compare models</Link>
        </>}
        note={<>Scores are ASL&apos;s own, from the 24-hour boards; places carry the leaderboard&apos;s statistical ties.</>}
        aside={facts}
        toc={toc}
        final={(
          <RdFinal
            title="See every board, or let the router choose"
            lead={FREE_TIER}
            actions={(
              <CtaRow>
                <LeaderboardCta cta="models-final-leaderboard" />
                <RouterCta cta="models-final-router" label="Let the router pick the best-placed model →" sub={`Routes across every vendor on the board, on your own provider keys · ${n(FREE.routerRequestsPerMonth)} requests a month free`} />
              </CtaRow>
            )}
          />
        )}
      >
        <RdSection id="roster" n={num('roster')} title="Which AI models are on the board?">
          {verdict && <Verdict>{verdict}</Verdict>}
          {asOf && <AsOf>As of {asOf} · 24-hour boards · score, then place in brackets; &ldquo;=&rdquo; marks a statistical tie</AsOf>}
          <RdProse>
            <p>
              The tables below list every model by vendor, in Combined board order: the Combined score (coding 50%, reasoning 25%,
              tool use 25%) with its standard error and place, then each suite&apos;s score and place. A model whose reasoning or
              tool-use runs are funded by the community is shown but not ranked on the Combined board. Each name opens the
              model&apos;s own page; each vendor heading has a page of its own.
            </p>
          </RdProse>
          <LeaderboardCta cta="models-roster-leaderboard" sub={FREE_TIER} />
        </RdSection>

        {groups.map((g) => {
          const v = g.vendor;
          const rows = rowsOf(g.models, boards, v.label);
          const count = g.models.length;
          return (
            <RdSection
              key={v.key}
              id={v.key}
              n={num(v.key)}
              title={`Which ${v.family === v.label ? v.label : v.family} models are benchmarked?`}
              lead={`${count} ${vendorMention(v)} ${count === 1 ? 'model is' : 'models are'} on the roster, called through ${v.apiHost} on our own account, as an application would call ${count === 1 ? 'it' : 'them'}.`}
            >
              {rows.length > 0 && (
                <ScoreTable
                  rows={rows}
                  showVendor={false}
                  caption={`${vendorMention(v)} models on the four boards over the last 24 hours. Score is the Combined board; Coding, Reasoning and Tool use give each suite's score and place.`}
                />
              )}
              <RdProse>
                <p>
                  <Link href={v.modelsPath}>Every {v.label} model on the same tests</Link>, with its place on Coding, Reasoning and Tool use
                  and the family&apos;s drift state; <Link href={v.statusPath}>{v.label} API status</Link>, checked every 10 minutes
                  {v.worsePath ? <>; and <Link href={v.worsePath}>{v.key === 'openai' ? 'is ChatGPT getting worse' : `is ${v.family} getting worse`}</Link></> : null}.
                </p>
              </RdProse>
            </RdSection>
          );
        })}

        <RdSection id="compare" n={num('compare')} title="How do I compare two models?"
          lead="Every pair has a head-to-head page: both models on the four boards with the leaderboard's statistical ties, list price per 1M tokens, cost per correct result over the last 30 days and drift state.">
          <RdProse>
            <p>
              The <Link href="/compare">compare hub</Link> lists every family and the curated pairs; each model page links its closest rivals and
              each vendor&apos;s best. For a decision by job, <Link href="/best-ai-model">the best AI model</Link> ranks the leaders of every board,
              with pages for <Link href="/best-llm-for-coding">coding</Link>, <Link href="/best-llm-for-reasoning">reasoning</Link>,{' '}
              <Link href="/best-ai-model-for-agents">agents and tool calling</Link>, <Link href="/best-value-ai-model">value</Link> and{' '}
              <Link href="/fastest-ai-model">speed</Link>. Whether a model is slipping is answered on <Link href="/is-ai-getting-worse">is AI getting worse</Link>.
            </p>
          </RdProse>
          <RouterCta cta="models-compare-router" label="Let the router pick the best-placed model →" sub={`One OpenAI-compatible endpoint, your own provider keys, ${n(FREE.routerRequestsPerMonth)} requests a month free · no card`} />
        </RdSection>

        <RdSection id="how" n={num('how')} title="How are the models tested and ranked?">
          <RdProse>
            <p>
              Every model on the board gets the same tasks on the same schedule: {CADENCE}. The coding suite grades a bug fix by running the
              project&apos;s own tests, including hidden tests the model never sees; the reasoning suite scores long multi-turn working sessions
              on correctness, recovery and continuity; the tool-use suite runs in sandboxed machines, where the job is either done or not.
              The Combined score weights coding 50%, reasoning 25% and tool use 25%; a suite that is missing or out of date drops out and
              the rest are reweighted.
            </p>
            <p>
              Places are the leaderboard&apos;s own: walking down a board, a model joins the group above it unless that group&apos;s leader is ahead
              by more than the measurement can resolve, so &ldquo;joint&rdquo; places are normal. {OPENNESS} Read the{' '}
              <Link href="/methodology">methodology</Link> and <Link href="/ai-drift-detection">how drift detection works</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="Questions people ask about the models we benchmark">
          <Faq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
