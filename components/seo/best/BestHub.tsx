import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';
import LandingEffects from '@/components/landing/LandingEffects';
import ReadingToc from '@/components/landing/ReadingToc';
import { RdFinal, RdProse, RdRows, RdSection, tocNumber } from '@/components/landing/Reading';
import { duration } from '@/components/landing/price-format';
import { CtaRow, LeaderboardCta, RouterCta, WatchCta } from '@/components/seo/Cta';
import JsonLd from '@/components/seo/JsonLd';
import { ScoreTable, type ScoreTableRow } from '@/components/seo/ScoreTable';
import { AsOf, Verdict } from '@/components/seo/Verdict';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { PLANS } from '@/lib/entitlements';
import { lpBody, lpDisplay } from '@/lib/fonts';
import { breadcrumbLd, faqLd, graphLd, isoDay, itemListLd, monthLabel, utcStamp, webPageLd } from '@/lib/seo';
import { BOARD_KEYS } from '@/lib/boards-core';
import { VENDORS, boardLabel, getBoards24h, getPrice, vendorMention } from '@/lib/seo-data';
import { BEST, BEST_KEYS, CADENCE, HUB, OPENNESS, TIES_RULE } from './best-config';
import { barPhrase, boardTop, boardVerdict, cap, companyOf, leadersOf, metricText, nearTop, orderBy, passText, priceVerdict } from './best-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';
import '@/styles/seo-best.css';

/**
 * /best-ai-model: the hub of the five best-for pages. The Combined board's five best-placed
 * models with the leaderboard's statistical ties, then one paragraph per job with its live
 * leader and a link to the page that decides it. Every name and number is read at render time;
 * the static copy names only families and the published method. ISR, no auth().
 */

const FAILSAFE = "(function(){var d=document.documentElement;d.classList.add('lp-js');setTimeout(function(){if(!window.__lpReady)d.classList.remove('lp-js')},4000)})();";
const intro = (d: string): CSSProperties => ({ '--d': d } as CSSProperties);
const n = (x: number) => x.toLocaleString('en-US');
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (x: number): string => WORDS[x] ?? String(x);

const TOC = [
  { id: 'overall', label: 'Best overall' },
  { id: 'jobs', label: 'Best for each job' },
  { id: 'how', label: 'How it is decided' },
  { id: 'faq', label: 'FAQ' },
  { id: 'related', label: 'More' },
];
const num = (id: string) => tocNumber(TOC, id);

export default async function BestHub(): Promise<JSX.Element> {
  const [boards, price] = await Promise.all([getBoards24h(), getPrice()]);

  const FREE = PLANS.free;
  const freeRequests = n(FREE.routerRequestsPerMonth);
  const FREE_TIER = `Free account: every ranking over 24 hours, 7 days and ${FREE.historyDays} days, a ${FREE.watchedModels}-model watchlist with email alerts, ${freeRequests} routed requests a month and a Data API key. No card.`;

  /* ── the Combined board ── */
  const top = boards ? boardTop(boards, 'combined', 5) : [];
  const leaders = boards ? leadersOf(boards, 'combined') : [];
  const overall = boards ? boardVerdict(boards, 'combined') : null;
  const stamp = boards?.generatedAt ?? null;
  const asOf = stamp ? `As of ${utcStamp(stamp)} · Combined board, last 24 hours` : null;
  const month = monthLabel(stamp);
  const fallback = 'The Combined board ranks every model with statistical ties and re-ranks after every run; the current places are on the leaderboard.';

  const rows: ScoreTableRow[] = top.map(({ row, placement }) => ({
    name: row.label,
    slug: row.slug,
    vendor: companyOf(row.provider, row.vendor),
    score: placement.score,
    se: placement.se,
    place: placement.kind === 'ranked' ? placement.place : null,
    joint: placement.kind === 'ranked' && placement.joint,
    trend: placement.trend,
    ...(row.note ? { extra: { Coverage: row.note } } : {}),
  }));

  /* ── one live sentence per job ── */
  const nt = nearTop(boards, price);
  const valueLead = orderBy(nt.candidates, 'costPerSuccess')[0] ?? null;
  const fastLead = orderBy(nt.candidates, 'medianMs')[0] ?? null;
  const jobVerdict: Record<string, string | null> = {
    coding: boards ? boardVerdict(boards, 'coding') : null,
    reasoning: boards ? boardVerdict(boards, 'reasoning') : null,
    agents: boards ? boardVerdict(boards, 'tooling') : null,
    value: priceVerdict(orderBy(nt.candidates, 'costPerSuccess'), nt, 'costPerSuccess'),
    fastest: priceVerdict(orderBy(nt.candidates, 'medianMs'), nt, 'medianMs'),
  };
  const boardLead = (k: 'coding' | 'reasoning' | 'tooling'): { name: string; slug: string } | null => {
    const e = boards ? boardTop(boards, k, 1)[0] : undefined;
    return e ? { name: e.row.label, slug: e.row.slug } : null;
  };
  const jobLeader: Record<string, { name: string; slug: string } | null> = {
    coding: boardLead('coding'),
    reasoning: boardLead('reasoning'),
    agents: boardLead('tooling'),
    value: valueLead ? { name: valueLead.name, slug: valueLead.slug } : null,
    fastest: fastLead ? { name: fastLead.name, slug: fastLead.slug } : null,
  };
  const jobRows: [ReactNode, ReactNode][] = BEST_KEYS.map((k) => {
    const c = BEST[k];
    const v = jobVerdict[k];
    const l = jobLeader[k];
    return [
      <Link key={k} href={c.path}>{c.h1}</Link>,
      <>
        {v ? <>{v} </> : null}
        {c.kind === 'board' ? c.definition : `${cap(c.rule)}.`} <Link href={c.path}>See the {c.kind === 'board' ? `${boardLabel(c.board)} board` : `${c.x} ranking`}</Link>
        {l && <> · <Link href={`/models/${l.slug}`}>{l.name}</Link></>}
      </>,
    ];
  });

  /* ── FAQ ── */
  const faq: FaqItem[] = [
    {
      q: `Which AI model is best overall in ${month}?`,
      a: `${overall ?? fallback}${stamp ? ` As of ${utcStamp(stamp)}.` : ''} ${HUB.definition} The board re-ranks after every run, so the answer on this page follows the leaderboard.`,
    },
    {
      q: 'Which AI model is best for coding, reasoning and agents?',
      a: [
        jobVerdict.coding ? `Coding: ${jobVerdict.coding}` : 'Coding: the Coding board, re-tested every four hours, on [best LLM for coding](/best-llm-for-coding).',
        jobVerdict.reasoning ? `Reasoning: ${jobVerdict.reasoning}` : 'Reasoning: the Reasoning board, re-tested daily, on [best LLM for reasoning](/best-llm-for-reasoning).',
        jobVerdict.agents ? `Agents and tool calling: ${jobVerdict.agents}` : 'Agents and tool calling: the Tool use board, re-tested daily, on [best AI model for agents](/best-ai-model-for-agents).',
        'Each page shows the five best-placed models with statistical ties and the full board behind a free sign-in.',
      ].join(' '),
    },
    {
      q: 'Which AI model is the best value, and which is the fastest?',
      a: `${jobVerdict.value ?? `The best value is the lowest cost per correct answer over the last ${nt.days} days among the models within five points of the best on the Coding board, on [best value AI model](/best-value-ai-model).`} ${jobVerdict.fastest ?? `The fastest is the lowest median response time over the same window among the same group, on [fastest AI model](/fastest-ai-model).`} Both count the same ${price?.coding?.tasks ? `${price.coding.tasks} ` : ''}coding tasks, every attempt billed.`,
    },
    {
      q: 'How is the best AI model decided?',
      a: `${HUB.definition} Every model gets the same tasks on the same schedule — ${CADENCE} — and is graded by executing what it produces. ${TIES_RULE} The rule is on the [methodology page](/methodology#ranks).`,
    },
    {
      q: 'Can I route each request to the best model automatically?',
      a: `Yes. The Smart Router is one OpenAI-compatible endpoint with auto-* routing modes: auto-best follows the Combined board, auto-coding, auto-reasoning and auto-tooling follow their boards, the value modes take the most points per measured dollar of one run among models within five points of the best, and auto-fastest-quality the fastest within the same bar. Routing is drift-aware by default, uses your own provider keys and adds zero markup on tokens; Free includes ${freeRequests} routed requests a month. The modes are described in the [router documentation](/router/docs#strategies).`,
    },
  ];

  /* ── structured data ── */
  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Best AI model', path: HUB.path }]),
    webPageLd({ path: HUB.path, name: HUB.h1, description: HUB.description, type: 'CollectionPage', ...(stamp ? { dateModified: isoDay(stamp) } : {}) }),
    itemListLd({ name: 'Best AI model for each job', items: BEST_KEYS.map((k) => ({ name: BEST[k].h1, url: BEST[k].path })) }),
    faqLd(faq),
  ]);

  /* ── hero facts ── */
  const facts: { dt: ReactNode; dd: ReactNode }[] = [];
  if (boards && top[0]) {
    const p = top[0].placement;
    facts.push({ dt: String(p.rankedCount), dd: <>models ranked on the <b>Combined</b> board in the last 24 hours</> });
    if (leaders.length > 1) facts.push({ dt: String(leaders.length), dd: <>models share first place: <b>joint 1st</b>, none measurably behind the leader</> });
    else if (p.score !== null) facts.push({ dt: String(Number.isInteger(p.score) ? p.score : p.score.toFixed(1)), dd: <>the leader’s score out of 100, <b>{top[0].row.label}</b>{p.se !== null ? `, ± ${p.se.toFixed(1)}` : ''}</> });
    facts.push({ dt: String(BOARD_KEYS.length), dd: <>boards from one set of tests: <b>Combined</b>, Coding, Reasoning and Tool use</> });
  }

  const leaderName = top[0]?.row.label ?? null;
  const leaderSlug = top[0]?.row.slug ?? null;

  return (
    <SubpageLayout>
      <div className={`lp lp-sub rd-page bp-page ${lpBody.variable} ${lpDisplay.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: FAILSAFE }} />
        <LandingEffects />
        <JsonLd data={ld} />

        <header className="lp-hero lp-textured rd-hero bp-hero">
          <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="lp-wrap">
            <nav className="bp-crumbs lp-intro" style={intro('.04s')} aria-label="Breadcrumb">
              <Link href="/">Home</Link><i aria-hidden="true">›</i>
              <span>Best AI model</span>
            </nav>
            <h1 className="lp-h1 lp-intro" style={intro('.1s')}>
              Best AI model for each job, <span className="lp-b">decided by the same tests</span>
            </h1>
            <div className="lp-hero-row">
              <div>
                <Verdict className="lp-intro">{overall ?? fallback}</Verdict>
                <CtaRow className="lp-intro">
                  <LeaderboardCta cta="best-hub-hero-leaderboard" />
                  <RouterCta ghost cta="best-hub-hero-router" label="Let the router pick for you →" />
                </CtaRow>
                {asOf && <AsOf className="lp-intro">{asOf}</AsOf>}
              </div>
              {facts.length >= 2 && (
                <div className="rd-aside lp-intro" style={intro('.34s')}>
                  <dl className="lp-facts">
                    {facts.map((f, i) => <div key={i}><dt>{f.dt}</dt><dd>{f.dd}</dd></div>)}
                  </dl>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="rd">
          <ReadingToc items={TOC} />

          <RdSection id="overall" n={num('overall')} title="Which AI model is best overall?">
            <RdProse>
              <p>{overall ?? fallback}</p>
              <p>
                {HUB.definition} It is the 24-hour view: the average of each model’s runs over the last day, so one odd attempt cannot move a place.
                The table shows the five best-placed models; the full board, with every model and the 7-day and 30-day views, is on the leaderboard.
              </p>
            </RdProse>
            {rows.length > 0 && (
              <ScoreTable rows={rows} caption={`${leaders.length > rows.length ? `The first ${word(rows.length)} of the ${leaders.length} models sharing first place on the Combined board over the last 24 hours, in board order` : `The ${word(rows.length)} best-placed models on the Combined board over the last 24 hours`} (coding 50%, reasoning 25%, tool use 25%). Score is out of 100 with its standard error; “=” marks a statistical tie.`} />
            )}
            <LeaderboardCta cta="best-hub-overall-leaderboard" label="Sign in for the full leaderboard →" sub={FREE_TIER} />
          </RdSection>

          <RdSection id="jobs" n={num('jobs')} title="Which AI model is best for each job?"
            lead="One definition per job, published on the methodology page, and a page for each that shows its five best-placed models with statistical ties.">
            <div className="bp-jobs">
              <RdRows rows={jobRows} />
            </div>
            <RdProse>
              <p>
                {valueLead && fastLead && valueLead.id === fastLead.id
                  ? <>{valueLead.name} is both the best value and the fastest of the models {barPhrase(nt)} over the last {nt.days} days: about {metricText(valueLead, 'costPerSuccess')} and a median of {duration(valueLead.price.medianMs)} per attempt, with a pass rate of {passText(valueLead)}. </>
                  : null}
                The boards rank ability; the value and speed pages take the models within five points of the best and order them by what a correct answer costs and how long it takes.
              </p>
            </RdProse>
          </RdSection>

          <RdSection id="how" n={num('how')} title="How the best AI model is decided"
            lead={`Every model on the board gets the same tasks on the same schedule: ${CADENCE}.`}>
            <RdProse>
              <p>
                Scores come from our own runs through each provider’s public API, with our own keys, not from vendor-reported numbers. Every model is given the same tasks on the same schedule and is graded by running what it produces:
                repository bug fixes run against the project’s own tests, including hidden ones; multi-turn reasoning sessions whose continuity is checked by running code; and tool-use tasks in sandboxed machines where the job is either done or not.
              </p>
              <p>{TIES_RULE}</p>
              <p>{OPENNESS} Read the <Link href="/methodology">methodology</Link> and <Link href="/ai-drift-detection">how drift detection works</Link>.</p>
            </RdProse>
            <WatchCta cta="best-hub-how-watch" {...(leaderSlug ? { slug: leaderSlug } : {})} label={leaderName ? `Get an email when ${leaderName} changes →` : undefined} />
          </RdSection>

          <RdSection id="faq" n={num('faq')} title="Questions about the best AI model">
            <Faq items={faq} />
          </RdSection>

          <RdSection id="related" n={num('related')} title="Models by vendor, head-to-head pages and status"
            lead="Every page is built from the same tests on the same schedule.">
            <div className="bp-links lp-up">
              <div>
                <h3>By vendor</h3>
                <ul className="rd-tags">
                  {VENDORS.map((v) => <li key={v.key}><Link href={v.modelsPath}>{vendorMention(v)} models</Link></li>)}
                </ul>
              </div>
              <div>
                <h3>Elsewhere</h3>
                <ul className="rd-tags">
                  <li><Link href="/compare">Head-to-head comparisons</Link></li>
                  <li><Link href="/is-ai-getting-worse">Is AI getting worse?</Link></li>
                  <li><Link href="/status">Provider status</Link></li>
                  <li><Link href="/methodology">Methodology</Link></li>
                  <li><Link href="/router">Smart Router</Link></li>
                </ul>
              </div>
            </div>
          </RdSection>
        </div>

        <RdFinal
          id="final"
          title="Stop choosing by hand"
          lead={FREE_TIER}
          actions={(
            <CtaRow>
              <RouterCta cta="best-hub-final-router" label="Get a free router key →" />
              <LeaderboardCta ghost cta="best-hub-final-leaderboard" />
            </CtaRow>
          )}
          explore={(
            <>
              {BEST_KEYS.slice(0, 3).map((k) => <Link key={k} href={BEST[k].path}>{BEST[k].h1}</Link>)}
              <Link href="/compare">All comparisons</Link>
            </>
          )}
        />
      </div>
    </SubpageLayout>
  );
}
