import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';
import LandingEffects from '@/components/landing/LandingEffects';
import ReadingToc from '@/components/landing/ReadingToc';
import { RdFacts, RdFinal, RdProse, RdSection, RdWeights, tocNumber } from '@/components/landing/Reading';
import { duration, pct, per1k } from '@/components/landing/price-format';
import { CtaRow, LeaderboardCta, RouterCta, WatchCta } from '@/components/seo/Cta';
import JsonLd from '@/components/seo/JsonLd';
import { ScoreTable, type ScoreTableRow } from '@/components/seo/ScoreTable';
import { AsOf, Verdict } from '@/components/seo/Verdict';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { PLANS } from '@/lib/entitlements';
import { lpBody, lpDisplay } from '@/lib/fonts';
import { breadcrumbLd, faqLd, graphLd, isoDay, itemListLd, monthLabel, utcStamp, webPageLd } from '@/lib/seo';
import { VENDORS, boardLabel, getBoards24h, getPrice, getRoster, pairSlug, relatedModels, vendorMention, type PriceSnapshot, type SeoModel } from '@/lib/seo-data';
import { BEST, CADENCE, HUB, OPENNESS, TIES_RULE, fillDays, siblingsOf, type BestKey } from './best-config';
import {
  WINDOW_24H, barPhrase, boardTop, boardVerdict, claudeVsGptByMetric, claudeVsGptOnBoard, companyOf, costText, leadSentence, leadersOf,
  metricText, msText, nearTop, orderBy, passText, priceVerdict, rosterModel, runnerUpOf, scorePlaceText,
  type Candidate, type NearTop,
} from './best-data';
import { PriceTable, type PriceTableRow } from './PriceTable';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';
import '@/styles/seo-best.css';

/**
 * One server component for the five best-for pages. A board page (coding, reasoning, agents)
 * reads the 24-hour board and shows its five best-placed models with the leaderboard's own
 * statistical ties; a price page (value, fastest) takes the models within five points of the
 * best on the Coding board and orders them by cost per correct answer or median response time
 * over the price view's window. Every name, place, score, cost and time is read at render time;
 * the static copy names only families and the published method. When a feed is down the prose
 * stays and the table, facts and sentences that needed it are left out. ISR, no auth(): the
 * newest run is paid, so only period=24h is ever requested.
 */

const FAILSAFE = "(function(){var d=document.documentElement;d.classList.add('lp-js');setTimeout(function(){if(!window.__lpReady)d.classList.remove('lp-js')},4000)})();";
const intro = (d: string): CSSProperties => ({ '--d': d } as CSSProperties);
const n = (x: number) => x.toLocaleString('en-US');
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const word = (x: number): string => WORDS[x] ?? String(x);
const capWord = (x: number): string => { const w = word(x); return w.charAt(0).toUpperCase() + w.slice(1); };

const CODING_WEIGHTS: [string, number, string][] = [
  ['Correctness', 60, 'Does the fix work? Graded by running the project’s tests'],
  ['Stability', 10, 'The same result attempt after attempt'],
  ['Edge cases', 10, 'Hidden tests the model never saw'],
  ['Debugging', 10, 'Did it find the real defect, not silence the symptom?'],
  ['Code quality', 5, 'Clean, maintainable code'],
  ['Format', 3, 'Guardrail: clean, parseable output'],
  ['Safety', 2, 'Guardrail: no dangerous operations'],
  ['Efficiency', 0, 'Measured and shown; carries no weight'],
  ['Complexity', 0, 'Measured and shown; carries no weight'],
];

const TOOL_WEIGHTS: [string, number, string][] = [
  ['Task completion', 30, 'Is the job actually done at the end?'],
  ['Tool selection', 20, 'The right tool for each step'],
  ['Parameter accuracy', 15, 'Called with the correct arguments'],
  ['Efficiency', 15, 'No unnecessary calls'],
  ['Error handling', 10, 'Recovering when a call fails'],
  ['Context awareness', 5, 'Carrying earlier output forward'],
  ['Safety compliance', 5, 'Avoiding destructive operations'],
];

const MEASURES_TITLE: Record<BestKey, string> = {
  coding: 'What the coding test measures',
  reasoning: 'What the reasoning test measures',
  agents: 'What the tool-use test measures',
  value: 'What the cost per correct answer measures',
  fastest: 'What the response time measures',
};

/** The facts, weights and lead of the "what it measures" section, from the methodology page's own numbers. */
function measuresOf(key: BestKey, price: PriceSnapshot | null, nt: NearTop | null): { lead: string; facts: [ReactNode, ReactNode][]; weights?: [string, number, string][]; weightsNote?: string } {
  const codingTasks = price?.coding?.tasks ?? 7;
  const trials = price?.coding?.trials ?? 7;
  const sessions = price?.reasoning?.tasks ?? 4;
  const toolTasks = price?.tooling?.tasks ?? 9;
  const days = nt?.days ?? price?.windowDays ?? 30;
  const bar = nt ? barPhrase(nt) : `within five points of the best on the Coding board ${WINDOW_24H}`;
  switch (key) {
    case 'coding':
      return {
        lead: `Every four hours. ${capWord(codingTasks)} tasks, all run every sweep, ${word(trials)} attempts each, graded by execution.`,
        facts: [
          ['The task', 'Most tasks hand the model a small working project and a bug report written as a user complaint — not a diagnosis, and no file named. The cause sits a module away from the symptom, with a plausible decoy in between. The model must find the defect and return a corrected file, which is graded by running the project’s own test suite.'],
          ['Hidden tests', 'Tests the model never sees make up three quarters of each repository task’s score, so a fix that satisfies the visible tests and is still wrong does not pass.'],
          [`${capWord(trials)} attempts`, `${capWord(trials)} attempts per task collapse to one outcome per task by median, so one unlucky attempt cannot move a task.`],
          ['Only the answer', 'Only the answer is graded, never a model’s hidden reasoning. An attempt that uses its whole output budget without answering, or answers without code, is a failed attempt, and a retry asks the identical question.'],
        ],
        weights: CODING_WEIGHTS,
        weightsNote: 'Nine measures, by weight: correctness 60, stability 10, edge cases 10, debugging 10, code quality 5, format 3 and safety 2; efficiency and complexity are measured and shown but carry no weight.',
      };
    case 'reasoning':
      return {
        lead: `Daily at 03:00 Berlin time. ${capWord(sessions)} long working sessions of five or six turns, every day; the daily score is their mean.`,
        facts: [
          ['The sessions', 'Each session builds on its own earlier turns, and when the model’s work fails it is told so the way a colleague would — without being handed the error.'],
          ['Five measures', 'Correctness, recovery after a failed step, and three continuity measures: memory retention, plan coherence and context use, weighted per task.'],
          ['Executable continuity', 'Continuity is checked by running code, not by matching words: rules stated once in the conversation (at the start, or partway through while the model is working on something else) and the decisions a model declares in its own plan are tested at every later step.'],
          ['Time limit', 'A session may run for up to ninety minutes.'],
        ],
      };
    case 'agents':
      return {
        lead: `Daily at 04:00 Berlin time. ${capWord(toolTasks)} tasks, each in a real sandboxed machine: either the job is done at the end or it is not.`,
        facts: [
          ['Done or not', 'Each task runs in a real sandboxed machine, and the question that matters most is whether the job is done at the end: task completion carries 30% of the score.'],
          ['Native tool turns', 'Each model sees its own tool calls and their results in its provider’s native tool format, with its own reasoning carried between calls, so the score is the model’s tool calling and not a transcript format.'],
        ],
        weights: TOOL_WEIGHTS,
        weightsNote: 'Seven measures, by weight: task completion 30, tool selection 20, parameter accuracy 15, efficiency 15, error handling 10, context awareness 5 and safety compliance 5.',
      };
    case 'value':
      return {
        lead: `Cost is measured, not list price: every model runs the same ${word(codingTasks)} coding tasks and every attempt is billed, so a verbose model costs what it really costs per task.`,
        facts: [
          ['Cost per correct answer', `What all of a model’s attempts cost over the last ${days} days, failed ones included, divided by the attempts that passed the hidden tests. Shown per 1,000 correct answers.`],
          ['Pass rate', 'The share of attempts whose hidden tests passed over the same window, shown beside the cost.'],
          ['The bar', `Only models ${bar} qualify: the rule the leaderboard’s Best value card and the Smart Router’s value modes share, so value never means cheaper and much worse.`],
          ['List price', 'Not used here. List price per million tokens is on every head-to-head page; a model that writes four times as much costs four times as much per task at the same list price.'],
        ],
      };
    case 'fastest':
      return {
        lead: `The median time of one attempt on the coding tasks over the last ${days} days, from the same runs as the scores.`,
        facts: [
          ['Median', 'The middle attempt, so one slow or one unusually quick answer cannot move a model.'],
          ['Whole call', 'Time from request to complete answer for one attempt: the whole call, so any thinking a model does before it answers is counted.'],
          ['The bar', `Only models ${bar} qualify, so the fastest model here is also one that passes the tests at close to the top rate.`],
          ['Pass rate', 'Shown beside each time: the share of attempts whose hidden tests passed over the same window.'],
        ],
      };
  }
}

const pairLabel = (a: SeoModel, b: SeoModel): string => (a.slug <= b.slug ? `${a.displayName} vs ${b.displayName}` : `${b.displayName} vs ${a.displayName}`);

export default async function BestPage({ category }: { category: BestKey }): Promise<JSX.Element> {
  const c = BEST[category];
  const [roster, boards, price] = await Promise.all([getRoster(), getBoards24h(), getPrice()]);

  const FREE = PLANS.free;
  const freeRequests = n(FREE.routerRequestsPerMonth);
  const FREE_TIER = `Free account: every ranking over 24 hours, 7 days and ${FREE.historyDays} days, a ${FREE.watchedModels}-model watchlist with email alerts, ${freeRequests} routed requests a month and a Data API key. No card.`;
  const isBoard = c.kind === 'board';
  const metric = c.metric ?? 'costPerSuccess';
  const label = boardLabel(c.board);
  const cta = (s: string) => `best-${category}-${s}`;

  /* ── board pages: the five best-placed models ── */
  const top = isBoard && boards ? boardTop(boards, c.board, 5) : [];
  const leaders = isBoard && boards ? leadersOf(boards, c.board) : [];
  const runnerUp = isBoard && boards ? runnerUpOf(boards, c.board) : null;

  /* ── the near-top group, needed by every page: the price pages order it, the board pages quote its leaders ── */
  const nt = nearTop(boards, price);
  const valueOrdered = orderBy(nt.candidates, 'costPerSuccess');
  const fastOrdered = orderBy(nt.candidates, 'medianMs');
  const ordered = metric === 'costPerSuccess' ? valueOrdered : fastOrdered;
  const topP = !isBoard ? ordered.slice(0, 5) : [];
  const valueLead: Candidate | null = valueOrdered[0] ?? null;
  const fastLead: Candidate | null = fastOrdered[0] ?? null;

  /* ── the leader and runner-up, for links ── */
  const leaderName = isBoard ? top[0]?.row.label ?? null : topP[0]?.name ?? null;
  const leaderSlug = isBoard ? top[0]?.row.slug ?? null : topP[0]?.slug ?? null;
  const leaderId = isBoard ? top[0]?.row.id ?? null : topP[0]?.id ?? null;
  const runnerId = isBoard ? runnerUp?.row.id ?? null : topP[1]?.id ?? null;
  const leaderM = leaderId ? rosterModel(roster, leaderId) : null;
  const runnerM = runnerId ? rosterModel(roster, runnerId) : null;

  /* ── verdict, timestamp, month ── */
  const verdictText = isBoard ? (boards ? boardVerdict(boards, c.board) : null) : priceVerdict(ordered, nt, metric);
  const stamp = isBoard ? boards?.generatedAt ?? null : price?.generatedAt ?? null;
  const asOf = stamp ? `As of ${utcStamp(stamp)} · ${isBoard ? `${label} board, last 24 hours` : `last ${nt.days} days`}` : null;
  const month = monthLabel(stamp);
  const fallbackVerdict = isBoard
    ? `The ${label} board ranks every model with statistical ties and re-ranks after every run; the current places are on the leaderboard.`
    : `The models ${barPhrase(nt)} are ordered by ${metric === 'costPerSuccess' ? 'cost per correct answer' : 'median response time'} over the last ${nt.days} days; the current order is on the leaderboard’s price view.`;

  /* ── tables ── */
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
  const prows: PriceTableRow[] = topP.map((x) => ({
    name: x.name,
    slug: x.slug,
    vendor: companyOf(x.vendorKey, x.price.vendor),
    score: scorePlaceText(x),
    passRate: passText(x),
    cost: costText(x),
    median: msText(x),
  }));
  const tableCaption = isBoard
    ? `${leaders.length > rows.length ? `The first ${word(rows.length)} of the ${leaders.length} models sharing first place on the ${label} board over the last 24 hours, in board order` : `The ${word(rows.length)} best-placed models on the ${label} board over the last 24 hours`}. Score is the suite’s score out of 100 with its standard error; “=” marks a statistical tie.`
    : `${nt.candidates.length > topP.length ? `The ${word(topP.length)} ${metric === 'costPerSuccess' ? 'cheapest' : 'fastest'} of the ${nt.candidates.length} models` : `The ${nt.candidates.length === 1 ? 'one model' : `${word(nt.candidates.length)} models`}`} ${barPhrase(nt)}, ordered by ${metric === 'costPerSuccess' ? `cost per 1,000 correct coding answers over the last ${nt.days} days, every attempt billed` : `median response time per coding attempt over the last ${nt.days} days`}.`;

  /* ── sentences ── */
  const famBoard = isBoard && boards ? claudeVsGptOnBoard(boards, c.board, c.x) : null;
  const famPrice = !isBoard ? claudeVsGptByMetric(ordered, nt, metric) : null;
  const fam = famBoard ?? famPrice;
  const famA = famBoard ? (famBoard.a ? rosterModel(roster, famBoard.a.row.id) : null) : famPrice?.ca ? rosterModel(roster, famPrice.ca.id) : null;
  const famG = famBoard ? (famBoard.g ? rosterModel(roster, famBoard.g.row.id) : null) : famPrice?.cg ? rosterModel(roster, famPrice.cg.id) : null;
  const famPair = famA && famG && famA.id !== famG.id ? { slug: pairSlug(famA, famG), label: pairLabel(famA, famG) } : null;
  const lead = isBoard && boards ? leadSentence(boards, c.board) : null;
  const measures = measuresOf(category, price, nt);

  /** The bar, with live numbers, for the price pages' "how it is decided". */
  let barSentence: string | null = null;
  if (!isBoard && nt.basis === 'board' && nt.best !== null && boards) {
    const topRow = boards.boards.coding.ranked[0];
    barSentence = `On the Coding board ${WINDOW_24H} the top score is ${nt.best}${topRow ? ` (${topRow.label})` : ''}, so the bar is ${nt.best - 5}: ${nt.candidates.length === 1 ? 'one model clears' : `${nt.candidates.length} models clear`} it, and this page orders ${nt.candidates.length === 1 ? 'it' : 'them'} by ${metric === 'costPerSuccess' ? 'cost per correct answer' : 'median response time'} over the last ${nt.days} days, from the same runs as the scores.`;
  } else if (!isBoard && nt.basis === 'passRate' && nt.best !== null) {
    barSentence = `Over the last ${nt.days} days the best pass rate is ${pct(nt.best)}, so the bar is ${pct(nt.best - 0.05)}: ${nt.candidates.length === 1 ? 'one model clears' : `${nt.candidates.length} models clear`} it.`;
  }

  /* ── pair links: leader vs runner-up, leader vs each other vendor's best ── */
  const pairs = new Map<string, string>();
  if (leaderM && runnerM && leaderM.id !== runnerM.id) pairs.set(pairSlug(leaderM, runnerM), pairLabel(leaderM, runnerM));
  if (leaderM) for (const f of relatedModels(leaderM, roster, boards).flagships) pairs.set(pairSlug(leaderM, f), pairLabel(leaderM, f));
  if (famPair) pairs.set(famPair.slug, famPair.label);
  const pairList = Array.from(pairs.entries());

  /* ── headings ── */
  const nowH2 = category === 'value' ? `Which AI model is the best value over the last ${nt.days} days?`
    : category === 'fastest' ? `Which AI model is the fastest over the last ${nt.days} days?`
    : `Which AI model is best for ${c.x} right now?`;
  const changeH2 = category === 'fastest' ? 'Does the fastest model change week to week?' : `Does the best ${c.adj} model change week to week?`;
  const famH2 = category === 'value' ? 'Is Claude better value than GPT?'
    : category === 'fastest' ? 'Is Claude faster than GPT?'
    : `Is Claude better than GPT for ${c.x}?`;
  const crossH2 = category === 'value' ? 'What about speed?' : 'What about price?';
  const routerH2 = 'How do I route to it automatically?';
  const decidedQ = category === 'fastest' ? 'How is the fastest model decided?' : `How is the best ${c.adj} model decided?`;
  const routeQ = category === 'fastest' ? 'Can I route to the fastest model automatically?' : `Can I route to the best ${c.adj} model automatically?`;

  const toc = [
    { id: 'now', label: 'The answer' },
    { id: 'how', label: 'How it is decided' },
    { id: 'measures', label: 'What it measures' },
    ...(category === 'agents' ? [{ id: 'tool-calling', label: 'Tool calling' }] : []),
    { id: 'change', label: 'Week to week' },
    { id: 'claude-gpt', label: 'Claude vs GPT' },
    { id: 'cross', label: category === 'value' ? 'Speed' : 'Price' },
    { id: 'router', label: 'Route automatically' },
    { id: 'faq', label: 'FAQ' },
    { id: 'related', label: 'More' },
  ];
  const num = (id: string) => tocNumber(toc, id);

  /* ── the router answer, shared by the section and the FAQ ── */
  const routerAnswer = `Set model to ${c.routerModel} on the Smart Router’s OpenAI-compatible endpoint and each request goes to ${c.routerDesc}.${c.routerAlt ? ` ${c.routerAlt.model} picks ${c.routerAlt.desc}.` : ''} The router ranks on the same benchmark results as this page and re-decides as they move; routing is drift-aware by default, uses your own provider keys and adds zero markup on tokens. Free includes ${freeRequests} routed requests a month. Every auto-* mode is described in the [router documentation](/router/docs#strategies).`;

  /* ── FAQ: one array feeds the visible rows and the FAQPage structured data ── */
  const firstQ = isBoard
    ? `Which ${category === 'agents' ? 'AI model' : 'LLM'} is best for ${c.x} in ${month}?`
    : category === 'value' ? `Which AI model is the best value in ${month}?` : `Which AI model is the fastest in ${month}?`;
  const decidedA = isBoard
    ? `${c.definition} ${TIES_RULE} The board is the 24-hour view, the average of each model’s runs over the last day, and every model gets the same tasks on the same schedule: ${CADENCE}. The rule is on the [methodology page](${c.methodAnchor}).`
    : `${c.quickCard ? `The leaderboard’s ${c.quickCard.name} card has one stated definition: ${c.quickCard.text} ` : ''}This page applies the same bar — ${c.rule} — over the last ${nt.days} days.${barSentence ? ` ${barSentence}` : ''} The definitions are on the [methodology page](${c.methodAnchor}).`;
  let ownFaq: FaqItem;
  switch (c.ownFaq) {
    case 'debugging':
      ownFaq = {
        q: 'Which LLM is best for debugging?',
        a: `The coding suite is a debugging test: most tasks hand the model a small working project and a bug report written as a user complaint, with the cause a module away from the symptom and a plausible decoy in between, and the fix is graded by running the project’s own tests, including hidden ones. Correctness carries 60% of the score and finding the real defect rather than silencing the symptom another 10%, so the Coding board is the debugging ranking.${verdictText ? ` ${verdictText}` : ''}`,
      };
      break;
    case 'judge':
      ownFaq = {
        q: 'Is the reasoning score judged by another model?',
        a: 'No. Correctness is graded by running what the model produces, and continuity — whether the model still honours rules stated earlier in the session and the decisions in its own plan — is checked by running code at every later step, not by matching words or asking a judge model. Five measures are weighted per task: correctness, recovery after a failed step, memory retention, plan coherence and context use.',
      };
      break;
    case 'function-calling':
      ownFaq = {
        q: 'What is the most reliable model for function calling?',
        a: `${verdictText ? `${verdictText} ` : ''}Reliability in a function call is what the suite scores: tool selection 20%, parameter accuracy 15%, error handling 10% and safety compliance 5%, with task completion 30%, efficiency 15% and context awareness 5%. Each of the ${word(price?.tooling?.tasks ?? 9)} tasks runs in a sandboxed machine, and either the job is done at the end or it is not.`,
      };
      break;
    case 'retries':
      ownFaq = {
        q: 'Is the cheapest model actually cheaper after retries?',
        a: `Not always, which is why this page counts every attempt. Cost per correct answer divides what all of a model’s attempts cost over the last ${nt.days} days, failed ones included, by the attempts that passed the hidden tests, so a model that fails often pays for its retries.${valueLead ? ` ${valueLead.name} is the lowest at about ${metricText(valueLead, 'costPerSuccess')}, with a pass rate of ${passText(valueLead)}.` : ''} List price per million tokens is a different number and is shown on every head-to-head page.`,
      };
      break;
    default:
      ownFaq = {
        q: 'Does a faster model score lower?',
        a: `Only models ${barPhrase(nt)} qualify here, so every model in the table also passes the tests at close to the top rate.${fastLead ? ` ${fastLead.name} answers in a median of ${duration(fastLead.price.medianMs)} per coding attempt with a pass rate of ${passText(fastLead)} over the last ${nt.days} days.` : ''} The Smart Router’s auto-fastest-quality mode applies the same bar; auto-fastest drops it.`,
      };
  }
  const faq: FaqItem[] = [
    {
      q: firstQ,
      a: `${verdictText ?? fallbackVerdict}${stamp ? ` As of ${utcStamp(stamp)}.` : ''} ${isBoard ? 'The board re-ranks after every run, so the answer on this page follows the leaderboard.' : 'The window rolls forward every day, so the answer on this page follows the price view.'}`,
    },
    {
      q: famH2,
      a: `${fam?.text ?? `Each family’s best-placed model on the ${label} board, with its standard error, is on the leaderboard; a lead is claimed only beyond the measurement noise.`}${famPair ? ` Both on one page: [${famPair.label}](/compare/${famPair.slug}).` : ''}`,
    },
    { q: decidedQ, a: decidedA },
    ownFaq,
    {
      q: 'How often does the ranking update?',
      a: `Every model on the board runs the same tasks on the same schedule: ${CADENCE}. This page reads ${isBoard ? 'the 24-hour board' : `the price view’s last ${nt.days} days`} and refreshes every fifteen minutes. ${OPENNESS}`,
    },
    { q: routeQ, a: routerAnswer },
  ];

  /* ── structured data ── */
  const listItems = isBoard ? rows.map((r) => ({ name: r.name, url: `/models/${r.slug}` })) : prows.map((r) => ({ name: r.name, url: `/models/${r.slug}` }));
  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Best AI model', path: HUB.path }, { name: c.label, path: c.path }]),
    webPageLd({ path: c.path, name: c.h1, description: fillDays(c.description, nt.days), ...(stamp ? { dateModified: isoDay(stamp) } : {}) }),
    ...(listItems.length ? [itemListLd({ name: `${c.h1}: ${isBoard ? `the ${word(listItems.length)} best-placed models on the ${label} board, last 24 hours` : `${word(listItems.length)} models ${barPhrase(nt)}, last ${nt.days} days`}`, items: listItems })] : []),
    faqLd(faq),
  ]);

  /* ── hero facts ── */
  const facts: { dt: ReactNode; dd: ReactNode }[] = [];
  if (isBoard && boards && top[0]) {
    const p = top[0].placement;
    facts.push({ dt: String(p.rankedCount), dd: <>models ranked on the <b>{label}</b> board in the last 24 hours</> });
    if (leaders.length > 1) facts.push({ dt: String(leaders.length), dd: <>models share first place: <b>joint 1st</b>, none measurably behind the leader</> });
    else if (p.score !== null) facts.push({ dt: String(Number.isInteger(p.score) ? p.score : p.score.toFixed(1)), dd: <>the leader’s score out of 100, <b>{top[0].row.label}</b>{p.se !== null ? `, ± ${p.se.toFixed(1)}` : ''}</> });
    facts.push(category === 'coding'
      ? { dt: '4 h', dd: <>between re-tests: the coding suite runs <b>every four hours</b></> }
      : { dt: '24 h', dd: <>between re-tests: the {category === 'reasoning' ? 'reasoning' : 'tool-use'} suite runs <b>once a day</b></> });
  } else if (!isBoard && topP[0]) {
    const l = topP[0];
    facts.push({ dt: metric === 'costPerSuccess' ? per1k(l.price.costPerSuccess as number) : duration(l.price.medianMs), dd: <><b>{l.name}</b>: {metric === 'costPerSuccess' ? 'per 1,000 correct coding answers, every attempt billed' : 'median response time per coding attempt'}, last {nt.days} days</> });
    facts.push({ dt: String(nt.candidates.length), dd: <>{nt.candidates.length === 1 ? 'model' : 'models'} {barPhrase(nt)}</> });
    facts.push({ dt: passText(l), dd: <>of <b>{l.name}</b>’s coding attempts passed the hidden tests over the window</> });
  }

  const crossBody: ReactNode = category === 'value'
    ? <>
        <p>
          Of the same group{fastLead ? <>, the fastest is <Link href={`/models/${fastLead.slug}`}>{fastLead.name}</Link>, a median of {duration(fastLead.price.medianMs)} per coding attempt over the last {nt.days} days</> : ''}. The ranking by response time is on <Link href="/fastest-ai-model">fastest AI model</Link>.
        </p>
        <p>
          The board pages rank ability alone: <Link href="/best-llm-for-coding">best LLM for coding</Link>, <Link href="/best-llm-for-reasoning">best LLM for reasoning</Link> and <Link href="/best-ai-model-for-agents">best AI model for agents</Link>. The head-to-head pages put list price, cost per correct answer and response time beside the scores.
        </p>
      </>
    : <>
        <p>
          {isBoard ? `The ${label} board ranks ability, not price.` : 'Speed is not price.'} What a model costs in use depends on its list price per million tokens and on how many attempts it needs: a model that writes four times as much, or fails and retries, costs more per correct answer than its list price suggests.
        </p>
        {valueLead && (
          <p>
            Among the models {barPhrase(nt)}, the lowest cost per correct answer over the last {nt.days} days is <Link href={`/models/${valueLead.slug}`}>{valueLead.name}</Link> at about {metricText(valueLead, 'costPerSuccess')}, with a pass rate of {passText(valueLead)}. The ranking is on <Link href="/best-value-ai-model">best value AI model</Link>{category !== 'fastest' && fastLead ? <>, and the fastest of the same group, {fastLead.name} at a median of {duration(fastLead.price.medianMs)}, on <Link href="/fastest-ai-model">fastest AI model</Link></> : ''}.
          </p>
        )}
        <p>The head-to-head pages put list price, cost per correct answer and response time beside the scores.</p>
      </>;

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
              <Link href={HUB.path}>Best AI model</Link><i aria-hidden="true">›</i>
              <span>{c.label}</span>
            </nav>
            <h1 className="lp-h1 lp-intro" style={intro('.1s')}>{c.h1}</h1>
            <div className="lp-hero-row">
              <div>
                <Verdict className="lp-intro">{verdictText ?? fallbackVerdict}</Verdict>
                <CtaRow className="lp-intro">
                  <RouterCta cta={cta('hero-router')} label="Route to the best automatically →" sub={`model: ${c.routerModel} · your own provider keys · ${freeRequests} requests a month free`} />
                  <LeaderboardCta ghost cta={cta('hero-leaderboard')} />
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
          <ReadingToc items={toc} />

          <RdSection id="now" n={num('now')} title={nowH2}>
            <RdProse>
              <p>{verdictText ?? fallbackVerdict}</p>
              {isBoard ? (
                <p>
                  The {label} board is the 24-hour view: the average of each model’s runs over the last day, ranked with statistical ties, so one odd attempt cannot move a place.
                  The table shows the five best-placed models; the full board, with every model and the 7-day and 30-day views, is on the leaderboard.
                </p>
              ) : metric === 'costPerSuccess' ? (
                <p>
                  Cost here is what a model’s attempts cost, not its list price: every model runs the same coding tasks, every attempt is billed, and the total is divided by the attempts that passed the hidden tests.
                  Only models {barPhrase(nt)} qualify, so value never means cheaper and much worse.
                </p>
              ) : (
                <p>
                  Response time is the median time of one attempt on the coding tasks, from the same runs as the scores, over the last {nt.days} days.
                  Only models {barPhrase(nt)} qualify, so this is a comparison of fast models that also pass.
                </p>
              )}
            </RdProse>
            {isBoard && rows.length > 0 && <ScoreTable rows={rows} caption={tableCaption} />}
            {!isBoard && prows.length > 0 && <PriceTable rows={prows} caption={tableCaption} days={nt.days} highlight={metric === 'costPerSuccess' ? 'cost' : 'median'} />}
            <LeaderboardCta cta={cta('now-leaderboard')} label="Sign in for the full leaderboard →" sub={FREE_TIER} />
          </RdSection>

          <RdSection id="how" n={num('how')} title="How the leader is decided">
            <RdProse>
              {isBoard ? (
                <>
                  <p>{c.definition} Every model gets the same tasks on the same schedule — {CADENCE} — and the board re-ranks after every run.</p>
                  <p>{TIES_RULE}</p>
                  {lead && <p>{lead}</p>}
                  <p>The rule, with every weight, is on the <Link href={c.methodAnchor}>methodology page</Link>.</p>
                </>
              ) : (
                <>
                  {c.quickCard && <p>The leaderboard’s <b>{c.quickCard.name}</b> card has one stated definition: {c.quickCard.text}</p>}
                  <p>
                    This page applies the same bar — {c.rule} — over the last {nt.days} days, so a model that is {metric === 'costPerSuccess' ? 'cheap' : 'quick'} and much worse never appears.
                    {metric === 'costPerSuccess' ? ' Cost per correct answer counts every attempt, failed ones included.' : ' The median is of every attempt, so one slow answer cannot move a model.'}
                  </p>
                  {barSentence && <p>{barSentence}</p>}
                  <p>The score column is the Coding board’s own, with its statistical ties written “=”; the definitions are on the <Link href={c.methodAnchor}>methodology page</Link>.</p>
                </>
              )}
            </RdProse>
          </RdSection>

          <RdSection id="measures" n={num('measures')} title={MEASURES_TITLE[category]} lead={measures.lead}>
            <RdFacts rows={measures.facts} />
            {measures.weights && (
              <>
                {measures.weightsNote && <RdProse><p>{measures.weightsNote}</p></RdProse>}
                <RdWeights rows={measures.weights} />
              </>
            )}
            <RdProse>
              <p>{OPENNESS} The full method is on the <Link href={c.methodAnchor}>methodology page</Link>.</p>
            </RdProse>
          </RdSection>

          {category === 'agents' && (
            <RdSection id="tool-calling" n={num('tool-calling')} title="Best LLM for tool calling"
              lead="The same board, read for function calling: whether a model picks the right tool, passes the right arguments and recovers when a call fails.">
              <RdProse>
                {verdictText && <p>{verdictText}</p>}
                <p>
                  A function-calling model is judged on the same {word(price?.tooling?.tasks ?? 9)} tasks. Tool selection carries 20% of the score — the right tool for each step — parameter accuracy 15% — called with the correct arguments — error handling 10% — recovering when a call fails — and safety compliance 5% — avoiding destructive operations.
                  Task completion, 30%, asks whether the job is done at the end; efficiency, 15%, counts unnecessary calls; context awareness, 5%, whether earlier output is carried forward.
                </p>
                <p>
                  Each model sees its own tool calls and their results in its provider’s native tool format, so the score is the model’s tool calling and not a transcript format.
                  The Smart Router’s <code>auto-tooling</code> mode (<code>auto-agentic</code> is the same mode) sends tool-calling requests to the model placing highest on this board.
                </p>
              </RdProse>
            </RdSection>
          )}

          <RdSection id="change" n={num('change')} title={changeH2}>
            <RdProse>
              {isBoard ? (
                <>
                  <p>
                    Sometimes, and the board is built to show when a change is real. A shared place is the board’s way of saying the measurement cannot separate those models, so the one listed first among them can be listed last after the next run without anything having changed; a model moves to a place of its own only when the gap is beyond the measurement noise.
                    {leaders.length > 1 ? ` ${WINDOW_24H.charAt(0).toUpperCase()}${WINDOW_24H.slice(1)}, ${leaders.length} models share first place on the ${label} board.` : ''}
                  </p>
                  <p>
                    The boards re-rank after every run — {CADENCE} — and the 24-hour view averages the runs of the last day, so one odd attempt cannot move a place; the 7-day and 30-day views on the leaderboard smooth it further.
                  </p>
                </>
              ) : (
                <p>
                  Sometimes. The order moves when a provider changes a price, a model gets faster or slower, or a pass rate shifts, and the window is the last {nt.days} days so a single day cannot decide it on its own. The bar moves with the Coding board, which re-ranks after every run: {CADENCE}.
                </p>
              )}
              <p>
                A model that slips for good is a different question: every suite has its own Page-Hinkley (a CUSUM-family test) change-point detector that compares each model with its own past, and the current answer, model by model, is on <Link href="/is-ai-getting-worse">Is AI getting worse?</Link>.
                If the question is whether ChatGPT or Claude is getting worse, or a model you use has been nerfed, the family pages answer it with the same data (<Link href="/is-chatgpt-getting-worse">is ChatGPT getting worse</Link>, <Link href="/is-claude-getting-worse">is Claude getting worse</Link>); the method is on <Link href="/ai-drift-detection">AI drift detection</Link>.
              </p>
            </RdProse>
            <WatchCta cta={cta('change-watch')} {...(leaderSlug ? { slug: leaderSlug } : {})} label={leaderName ? `Get an email when ${leaderName} changes →` : undefined} />
          </RdSection>

          <RdSection id="claude-gpt" n={num('claude-gpt')} title={famH2}>
            <RdProse>
              <p>{fam?.text ?? `Each family’s best-placed model on the ${label} board, with its standard error, is on the leaderboard; a lead is claimed only beyond the measurement noise.`}</p>
              <p>
                {famPair && <>Both on one page: <Link href={`/compare/${famPair.slug}`}>{famPair.label}</Link>. </>}
                Every Claude model is on <Link href="/models/anthropic">Anthropic models</Link> and every GPT model on <Link href="/models/openai">OpenAI models</Link>; the other four families — Google (Gemini), DeepSeek, Moonshot AI (Kimi) and Z.ai (GLM) — are on the same board above.
              </p>
            </RdProse>
          </RdSection>

          <RdSection id="cross" n={num('cross')} title={crossH2}>
            <RdProse>
              {crossBody}
              {pairList.length > 0 && (
                <ul className="rd-tags" aria-label="Head-to-head pages">
                  {pairList.map(([slug, text]) => <li key={slug}><Link href={`/compare/${slug}`}>{text}</Link></li>)}
                </ul>
              )}
            </RdProse>
          </RdSection>

          <RdSection id="router" n={num('router')} title={routerH2}
            lead="One OpenAI-compatible endpoint sends each request to whichever model the boards favour for that kind of work, with your own provider keys.">
            <RdProse>
              <p>
                Set <code>model</code> to <code>{c.routerModel}</code> on the Smart Router’s OpenAI-compatible endpoint and each request goes to {c.routerDesc}.
                {c.routerAlt && <> <code>{c.routerAlt.model}</code> picks {c.routerAlt.desc}.</>}
                {' '}The router ranks on the same benchmark results as this page and re-decides as they move; routing is drift-aware by default, uses your own provider keys and adds zero markup on tokens. Free includes {freeRequests} routed requests a month.
              </p>
              <p>Every auto-* mode is described in the <Link href="/router/docs#strategies">router documentation</Link>.</p>
            </RdProse>
            <CtaRow className="lp-up">
              <RouterCta cta={cta('router-key')} />
            </CtaRow>
          </RdSection>

          <RdSection id="faq" n={num('faq')} title={`${c.h1}: questions people ask`}>
            <Faq items={faq} />
          </RdSection>

          <RdSection id="related" n={num('related')} title="Other categories, head-to-head pages and vendors"
            lead="Every page here is built from the same tests on the same schedule, so a model’s place on one can be read against its place on another.">
            <div className="bp-links lp-up">
              <div>
                <h3>Best for each job</h3>
                <ul className="rd-tags">
                  {siblingsOf(category).map((s) => <li key={s.path}><Link href={s.path}>{s.label}</Link></li>)}
                </ul>
              </div>
              {pairList.length > 0 && (
                <div>
                  <h3>{leaderName ? `${leaderName} head to head` : 'Head to head'}</h3>
                  <ul className="rd-tags">
                    {pairList.map(([slug, text]) => <li key={slug}><Link href={`/compare/${slug}`}>{text}</Link></li>)}
                  </ul>
                </div>
              )}
              <div>
                <h3>By vendor</h3>
                <ul className="rd-tags">
                  {VENDORS.map((v) => <li key={v.key}><Link href={v.modelsPath}>{vendorMention(v)} models</Link></li>)}
                </ul>
              </div>
            </div>
            <RdProse>
              <p>
                {leaderName && leaderSlug && <><Link href={`/models/${leaderSlug}`}>{leaderName}</Link> has a page of its own, with its place on every board and its history. </>}
                The <Link href="/compare">compare hub</Link> lists every head-to-head page, <Link href="/best-ai-model">best AI model</Link> answers every job on one page, and the <Link href="/methodology">methodology</Link> has every weight and constant.
              </p>
            </RdProse>
          </RdSection>
        </div>

        <RdFinal
          id="final"
          title="Route to the best automatically"
          lead={FREE_TIER}
          actions={(
            <CtaRow>
              <RouterCta cta={cta('final-router')} label="Get a free router key →" sub={`model: ${c.routerModel} · your own provider keys · zero markup on tokens`} />
              <LeaderboardCta ghost cta={cta('final-leaderboard')} />
            </CtaRow>
          )}
          explore={(
            <>
              {siblingsOf(category).slice(0, 3).map((s) => <Link key={s.path} href={s.path}>{s.label}</Link>)}
              <Link href="/compare">All comparisons</Link>
            </>
          )}
        />
      </div>
    </SubpageLayout>
  );
}
