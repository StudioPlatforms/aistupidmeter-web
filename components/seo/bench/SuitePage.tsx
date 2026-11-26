import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdFacts, RdWeights, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { CtaRow, RouterCta } from '@/components/seo/Cta';
import { Faq, Rich } from '@/components/seo/pair/Faq';
import { BEST } from '@/components/seo/best/best-config';
import { BOARD_TITLE } from '@/lib/boards-core';
import { PLANS } from '@/lib/entitlements';
import { breadcrumbLd, faqLd, graphLd, webPageLd } from '@/lib/seo';
import { getPrice } from '@/lib/seo-data';
import {
  BENCH, CODING_WEIGHTS, COMBINED_WEIGHTS, HUB, REASONING_MEASURES, REASONING_TASKS, SUITE_KEYS, TOOL_WEIGHTS,
  countsOf, siblingsOf, type SuiteKey,
} from './bench-config';
import { suiteCopy } from './bench-copy';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';

/**
 * One server component for the three suite pages (/ai-coding-benchmark, /llm-reasoning-benchmark,
 * /llm-tool-calling-benchmark): what the suite tests, how an answer is graded, its weights, its
 * schedule, the tie rule, what is out of scope, how it feeds the Combined score and the Smart
 * Router mode that ranks on its board. The wording is bench-copy.ts; the weights are the ones
 * /methodology publishes (bench-config.ts).
 *
 * The page explains the method and names no model. The only figures read at render time are the
 * suites' task and attempt counts, from the price snapshot, and the free plan's numbers from the
 * plan table. ISR, no auth(), cookies() or headers().
 */

const TOC = [
  { id: 'tests', label: 'What it tests' },
  { id: 'grading', label: 'Grading' },
  { id: 'weights', label: 'Weights' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'ties', label: 'Ties' },
  { id: 'limits', label: 'What it does not test' },
  { id: 'combined', label: 'Combined score' },
  { id: 'router', label: 'Routing' },
  { id: 'faq', label: 'FAQ' },
  { id: 'related', label: 'More' },
];
const num = (id: string) => tocNumber(TOC, id);

const paras = (xs: string[]): ReactNode => xs.map((x, i) => <p key={i}><Rich text={x} /></p>);
const rich = (rows: [string, string][]): [ReactNode, ReactNode][] => rows.map(([k, v]): [ReactNode, ReactNode] => [k, <Rich key={k} text={v} />]);

/** The reasoning suite's shares: one row per session, one column per measure, as /methodology#reasoning sets them out. */
function ReasoningShares() {
  return (
    <div className="rd-table-wrap lp-up">
      <table className="rd-table">
        <thead>
          <tr>
            <th scope="col">Session</th>
            {REASONING_MEASURES.map((m) => <th key={m} scope="col" className="num">{m === 'Recovery' ? `${m}*` : m}</th>)}
          </tr>
        </thead>
        <tbody>
          {REASONING_TASKS.map((t) => (
            <tr key={t.task}>
              <th scope="row">{t.task}</th>
              {t.shares.map((w, i) => (w === null
                ? <td key={i} className="num muted">—</td>
                : <td key={i} className="num rd-heat" style={{ '--v': w } as CSSProperties}>{w}%</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function SuitePage({ suite }: { suite: SuiteKey }): Promise<React.JSX.Element> {
  const s = BENCH[suite];
  const best = BEST[s.best];
  const label = BOARD_TITLE[s.board];
  const price = await getPrice();

  const FREE = PLANS.free;
  const freeRequests = FREE.routerRequestsPerMonth.toLocaleString('en-US');
  const copy = suiteCopy(suite, countsOf(price), { historyDays: FREE.historyDays, routerRequests: freeRequests });
  const cta = (x: string) => `bench-${suite}-${x}`;
  const boardHref = `/leaderboard#${s.board}`;
  const alias = suite === 'tooling' ? best.routerAlt : undefined;
  const routerSub = `model: ${best.routerModel} · your own provider keys · ${freeRequests} requests a month free`;

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: HUB.label, path: HUB.path }, { name: s.label, path: s.path }]),
    webPageLd({ path: s.path, name: `${s.h1.title}: ${s.h1.accent}`, description: s.description, type: 'TechArticle' }),
    faqLd(copy.faq),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        kicker={s.kicker}
        title={s.h1.title}
        accent={s.h1.accent}
        lead={copy.lead}
        actions={(
          <CtaRow className="is-stack">
            <RouterCta cta={cta('hero-router')} label="Route on this board →" sub={routerSub} />
            <div className="seo-cta">
              <Link className="lp-btn lp-btn-ghost" href={boardHref} data-cta={cta('hero-board')}>See the {label} board</Link>
            </div>
          </CtaRow>
        )}
        aside={copy.facts.length >= 2 ? (
          <dl className="lp-facts">
            {copy.facts.map((f) => <div key={f.dd}><dt>{f.dt}</dt><dd>{f.dd}</dd></div>)}
          </dl>
        ) : undefined}
        toc={TOC}
        final={(
          <RdFinal
            title={`Route on the ${label} board`}
            lead={`One OpenAI-compatible endpoint, your own provider keys and zero markup on tokens. Free includes ${freeRequests} routed requests a month. No card.`}
            actions={(
              <CtaRow>
                <RouterCta cta={cta('final-router')} sub={`model: ${best.routerModel} · your own provider keys · zero markup on tokens`} />
                <div className="seo-cta">
                  <Link className="lp-btn lp-btn-ghost" href={boardHref} data-cta={cta('final-board')}>See the {label} board</Link>
                </div>
              </CtaRow>
            )}
            explore={(
              <>
                {siblingsOf(suite).map((x) => <Link key={x.key} href={x.path}>{x.label}</Link>)}
                <Link href={HUB.path}>{HUB.label}</Link>
                <Link href="/methodology">Methodology</Link>
              </>
            )}
          />
        )}
      >
        <RdSection id="tests" n={num('tests')} title={copy.tests.title} lead={copy.tests.lead}>
          <RdProse>{paras(copy.tests.paras)}</RdProse>
          {copy.tests.rows.length > 0 && <RdFacts rows={rich(copy.tests.rows)} />}
        </RdSection>

        <RdSection id="grading" n={num('grading')} title={copy.grading.title} lead={copy.grading.lead}>
          <RdFacts rows={rich(copy.grading.rows)} />
        </RdSection>

        <RdSection id="weights" n={num('weights')} title={copy.weights.title} lead={copy.weights.lead}>
          {suite === 'coding' && <RdWeights rows={CODING_WEIGHTS} />}
          {suite === 'tooling' && <RdWeights rows={TOOL_WEIGHTS} />}
          {suite === 'reasoning' && <ReasoningShares />}
          <RdProse>
            {copy.weights.note && <p className="rd-note">{copy.weights.note}</p>}
            {paras(copy.weights.paras)}
            <p>Every weight is on the <Link href={s.methodAnchor}>methodology page</Link>.</p>
          </RdProse>
        </RdSection>

        <RdSection id="schedule" n={num('schedule')} title={copy.schedule.title} lead={copy.schedule.lead}>
          <RdProse>{paras(copy.schedule.paras)}</RdProse>
        </RdSection>

        <RdSection id="ties" n={num('ties')} title={copy.ties.title}>
          <RdProse>
            {paras(copy.ties.paras)}
            <p>The full rule is on the <Link href="/methodology#ranks">methodology page</Link>.</p>
          </RdProse>
        </RdSection>

        <RdSection id="limits" n={num('limits')} title={copy.limits.title} lead={copy.limits.lead}>
          <RdFacts rows={rich(copy.limits.rows)} />
        </RdSection>

        <RdSection id="combined" n={num('combined')} title={copy.combined.title} lead={copy.combined.lead}>
          <RdWeights
            rows={SUITE_KEYS.map((k): [string, number, string] => [BOARD_TITLE[BENCH[k].board], COMBINED_WEIGHTS[k], BENCH[k].schedule])}
            label="Suite"
            share="Share of Combined"
            note="Schedule"
          />
          <RdProse>{paras(copy.combined.paras)}</RdProse>
        </RdSection>

        <RdSection id="router" n={num('router')} title={copy.routerTitle}>
          <RdProse>
            <p>
              Set <code>model</code> to <code>{best.routerModel}</code> on the Smart Router’s OpenAI-compatible endpoint and each request goes to {best.routerDesc}.
              {alias && <> <code>{alias.model}</code> is {alias.desc}.</>}
              {' '}The router reads the same board and re-decides as it moves; routing is drift-aware by default, uses your own provider keys and adds zero markup on tokens. Free includes {freeRequests} routed requests a month.
            </p>
            <p>Every auto-* mode is described in the <Link href="/router/docs#strategies">router documentation</Link>.</p>
          </RdProse>
          <CtaRow className="lp-up">
            <RouterCta cta={cta('router-key')} sub={routerSub} />
          </CtaRow>
        </RdSection>

        <RdSection id="faq" n={num('faq')} title={copy.faqTitle}>
          <Faq items={copy.faq} />
        </RdSection>

        <RdSection id="related" n={num('related')} title="The board, the other suites and the method">
          <ul className="rd-tags lp-up">
            <li><Link href={best.path}>{best.titleBase}</Link></li>
            <li><Link href={boardHref}>{label} board</Link></li>
            {siblingsOf(suite).map((x) => <li key={x.key}><Link href={x.path}>{x.label}</Link></li>)}
            <li><Link href={HUB.path}>{HUB.label}</Link></li>
            <li><Link href={s.methodAnchor}>Methodology</Link></li>
            <li><Link href="/ai-drift-detection">AI drift detection</Link></li>
          </ul>
        </RdSection>
      </ReadingPage>
    </>
  );
}
