import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdFacts, RdRows, RdWeights, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { CtaRow, RouterCta } from '@/components/seo/Cta';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { BEST, CADENCE, OPENNESS, TIES_RULE } from '@/components/seo/best/best-config';
import { BENCH, COMBINED_WEIGHTS, HUB, SUITE_KEYS, capWord, countsOf, word, type SuiteKey } from '@/components/seo/bench/bench-config';
import { COMBINED_RULE } from '@/components/seo/bench/bench-copy';
import { LEADERBOARD_TOP_N } from '@/components/seo/leaderboard/leaderboard-config';
import { BOARD_TITLE } from '@/lib/boards-core';
import { PLANS } from '@/lib/entitlements';
import { breadcrumbLd, faqLd, graphLd, itemListLd, pageMeta, webPageLd } from '@/lib/seo';
import { getPrice } from '@/lib/seo-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';

/**
 * /ai-benchmarks: the hub of the benchmark pages. The three suites in brief with a link to each
 * suite page, the schedule they share, the hourly canary, the Combined score and the tie rule.
 * It explains the method and names no model; the weights are the ones /methodology publishes
 * (components/seo/bench/bench-config.ts). The only figures read at render time are the suites'
 * task and attempt counts, from the price snapshot, and the free plan's numbers. ISR, no auth().
 */

export const revalidate = 900;

export const metadata: Metadata = pageMeta({ title: HUB.title, description: HUB.description, path: HUB.path, keywords: [...HUB.keywords] });

const TOC = [
  { id: 'suites', label: 'Three suites' },
  { id: 'schedule', label: 'One schedule' },
  { id: 'canary', label: 'Hourly canary' },
  { id: 'combined', label: 'Combined score' },
  { id: 'ties', label: 'Places and ties' },
  { id: 'open', label: 'Public and private' },
  { id: 'router', label: 'Routing' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

export default async function AiBenchmarksPage(): Promise<React.JSX.Element> {
  const c = countsOf(await getPrice());
  const freeRequests = PLANS.free.routerRequestsPerMonth.toLocaleString('en-US');
  const suiteLinks = SUITE_KEYS.map((k) => `[${BENCH[k].label}](${BENCH[k].path})`);
  const modes = { coding: BEST.coding.routerModel, reasoning: BEST.reasoning.routerModel, tooling: BEST.agents.routerModel };
  const w = COMBINED_WEIGHTS;

  /* ── one paragraph per suite, with its live counts ── */
  const about: Record<SuiteKey, string> = {
    coding: `Repository debugging tasks graded by running the project’s own tests, including hidden tests the model never sees. ${c.codingTasks ? `${capWord(c.codingTasks)} tasks in every sweep` : 'Every task in every sweep'}${c.codingAttempts ? `, ${word(c.codingAttempts)} attempts each` : ''}, scheduled every four hours.`,
    reasoning: `${c.reasoningSessions ? `${capWord(c.reasoningSessions)} long, multi-turn working sessions` : 'Long, multi-turn working sessions'}, scheduled daily. Rules stated early in a session are checked by running code at later turns.`,
    tooling: `${c.toolTasks ? `${capWord(c.toolTasks)} tasks` : 'Tasks'}, each in a real sandboxed machine, scheduled daily: either the job is done at the end or it is not.`,
  };
  const suiteRows: [ReactNode, ReactNode][] = SUITE_KEYS.map((k) => {
    const s = BENCH[k];
    return [
      <Link key={k} href={s.path}>{s.label}</Link>,
      <>{about[k]} <Link href={s.path} data-cta={`bench-hub-suites-${k}`}>How it is graded</Link> · <Link href={`/leaderboard#${s.board}`}>{BOARD_TITLE[s.board]} board</Link></>,
    ];
  });

  /* ── FAQ: one array feeds the visible rows and the FAQPage structured data ── */
  const faq: FaqItem[] = [
    {
      q: 'Which LLM benchmarks are on AI Stupid Level?',
      a: 'Three suites and a canary. The coding suite is repository debugging tasks graded by running the project’s own tests, including hidden tests the model never sees. The reasoning suite is long, multi-turn working sessions whose continuity is checked by running code. The tool-use suite is tasks in sandboxed machines where the job is either done or not. An hourly canary of two fixed probes watches for sudden drops.',
    },
    {
      q: 'What makes an AI model benchmark live?',
      a: `Its schedule. A benchmark run once at a model’s launch describes that day. The suites here are scheduled to run again at fixed intervals for as long as a model is served: ${CADENCE}.`,
    },
    {
      q: 'How are the LLM benchmarks scored?',
      a: `Every model is given the same tasks and graded by running what it produces. Each suite combines its measures by published weights, and the Combined score is a plain weighted mean of the three: coding ${w.coding}%, reasoning ${w.reasoning}%, tool use ${w.tooling}%, with no curve, gate or penalty on top.`,
    },
    {
      q: 'Which AI benchmark should I read for my work?',
      a: `Start with the board that matches the work: Coding for code changes, Tool use for agents that call tools, Reasoning for long multi-step sessions. Each suite has a page of its own: ${suiteLinks[0]}, ${suiteLinks[1]} and ${suiteLinks[2]}.`,
    },
    {
      q: 'Where are the AI benchmark rankings?',
      a: `The first ${word(LEADERBOARD_TOP_N)} places of each board are on the [AI leaderboard](/leaderboard).`,
    },
    {
      q: 'Can I route requests on these benchmarks automatically?',
      a: `Yes. The Smart Router is one OpenAI-compatible endpoint with auto-* routing modes: auto-best follows the Combined board, and ${modes.coding}, ${modes.reasoning} and ${modes.tooling} follow their boards. Routing is drift-aware by default, uses your own provider keys and adds zero markup on tokens; Free includes ${freeRequests} routed requests a month.`,
    },
  ];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: HUB.label, path: HUB.path }]),
    webPageLd({ path: HUB.path, name: `${HUB.h1.title}: ${HUB.h1.accent}`, description: HUB.description, type: 'CollectionPage' }),
    itemListLd({ name: 'AI benchmark suites', items: SUITE_KEYS.map((k) => ({ name: BENCH[k].label, url: BENCH[k].path })) }),
    faqLd(faq),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        kicker={HUB.kicker}
        title={HUB.h1.title}
        accent={HUB.h1.accent}
        lead="Three suites give every model the same tasks on a fixed schedule and grade it by running what it produces: coding, reasoning and tool use. An hourly canary watches between runs, and the three suites form the Combined score."
        actions={(
          <CtaRow className="is-stack">
            <RouterCta cta="bench-hub-hero-router" label="Route on these boards →" />
            <div className="seo-cta">
              <Link className="lp-btn lp-btn-ghost" href="/leaderboard" data-cta="bench-hub-hero-leaderboard">See the four boards</Link>
            </div>
          </CtaRow>
        )}
        aside={(
          <dl className="lp-facts">
            <div><dt>{SUITE_KEYS.length}</dt><dd>suites, every model on the same tasks: coding, reasoning and tool use</dd></div>
            <div><dt>4 h</dt><dd>between scheduled coding runs; reasoning and tool use are scheduled daily</dd></div>
            <div><dt>1 h</dt><dd>between canary probes, there to catch a sudden drop</dd></div>
          </dl>
        )}
        toc={TOC}
        final={(
          <RdFinal
            title="Route each request on the boards"
            lead={`One OpenAI-compatible endpoint, your own provider keys and zero markup on tokens. Free includes ${freeRequests} routed requests a month. No card.`}
            actions={(
              <CtaRow>
                <RouterCta cta="bench-hub-final-router" />
                <div className="seo-cta">
                  <Link className="lp-btn lp-btn-ghost" href="/methodology" data-cta="bench-hub-final-methodology">Read the methodology</Link>
                </div>
              </CtaRow>
            )}
            explore={(
              <>
                {SUITE_KEYS.map((k) => <Link key={k} href={BENCH[k].path}>{BENCH[k].label}</Link>)}
                <Link href="/leaderboard">AI leaderboard</Link>
              </>
            )}
          />
        )}
      >
        <RdSection id="suites" n={num('suites')} title="The three LLM benchmark suites"
          lead="Each suite has a page of its own: what it tests, how an answer is graded, every weight and what is out of scope.">
          <RdRows rows={suiteRows} />
          <RdProse>
            <p>
              Which one to read depends on the work: the Coding board for code changes, the Tool use board for agents that call tools, the
              Reasoning board for long multi-step sessions.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="schedule" n={num('schedule')} title="One schedule for every model"
          lead={`The same tasks on the same schedule: ${CADENCE}.`}>
          <RdFacts rows={[
            ['Coding', 'Every four hours'],
            ['Reasoning', 'Daily at 03:00 Berlin time'],
            ['Tool use', 'Daily at 04:00 Berlin time'],
            ['Canary', 'Every hour'],
          ]} />
          <RdProse>
            <p>
              Every model is on the same schedule, with no priority list. A live AI benchmark is one with a schedule: the suites are set to
              run again at fixed intervals for as long as a model is served, not once at its launch.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="canary" n={num('canary')} title="The hourly canary"
          lead="Two fixed probes, two attempts each, every hour: there to catch a model collapsing this afternoon, not a slow decline.">
          <RdFacts rows={[
            ['Test', 'Welch’s t-test on two windows, the last 6 hours and the last 24 hours, each against the prior 7 days on the same test version'],
            ['Fires when', 'the fall is at least 12 points at p < 0.01; it closes itself when the gap does'],
          ]} />
          <RdProse>
            <p>
              A slow decline is the other detector’s job: each suite has its own Page-Hinkley change-point detector, run on daily results and
              never on a blend of suites. Both are explained on <Link href="/ai-drift-detection">AI drift detection</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="combined" n={num('combined')} title="The Combined score"
          lead="A plain weighted mean of the three suites, by published weights.">
          <RdWeights
            rows={SUITE_KEYS.map((k): [string, number, string] => [BOARD_TITLE[BENCH[k].board], w[k], BENCH[k].schedule])}
            label="Suite"
            share="Share of Combined"
            note="Schedule"
          />
          <RdProse><p>{COMBINED_RULE}</p></RdProse>
        </RdSection>

        <RdSection id="ties" n={num('ties')} title="How places and ties are decided">
          <RdProse>
            <p>{TIES_RULE}</p>
            <p>The full rule is on the <Link href="/methodology#ranks">methodology page</Link>.</p>
          </RdProse>
        </RdSection>

        <RdSection id="open" n={num('open')} title="What is public and what is private">
          <RdProse>
            <p>{OPENNESS}</p>
            <p>
              Every weight, threshold and statistical rule is on the <Link href="/methodology">methodology page</Link>, and{' '}
              <Link href="/router/test-keys">Test your keys</Link> runs the same tasks with your own API keys.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="router" n={num('router')} title="Routing on the boards">
          <RdProse>
            <p>
              The Smart Router is one OpenAI-compatible endpoint. Its <code>{modes.coding}</code>, <code>{modes.reasoning}</code> and{' '}
              <code>{modes.tooling}</code> modes follow their boards, and <code>auto-best</code> follows the Combined board. Routing is
              drift-aware by default, uses your own provider keys and adds zero markup on tokens; Free includes {freeRequests} routed
              requests a month.
            </p>
            <p>The modes are described in the <Link href="/router/docs#strategies">router documentation</Link>.</p>
          </RdProse>
          <CtaRow className="lp-up">
            <RouterCta cta="bench-hub-router-key" />
          </CtaRow>
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="Questions about the AI benchmarks">
          <Faq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
