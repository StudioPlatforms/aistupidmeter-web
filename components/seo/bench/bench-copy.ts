import type { FaqItem } from '@/components/seo/pair/Faq';
import { BEST, OPENNESS, TIES_RULE } from '@/components/seo/best/best-config';
import { LEADERBOARD_TOP_N } from '@/components/seo/leaderboard/leaderboard-config';
import { BOARD_TITLE } from '@/lib/boards-core';
import {
  BENCH, CODING_WEIGHTS, COMBINED_WEIGHTS, HUB, REASONING_MEASURES, REASONING_TASKS, TOOL_WEIGHTS,
  capWord, weightOf, word, type SuiteCounts, type SuiteKey,
} from './bench-config';

/**
 * The wording of the suite pages, as plain strings with [label](/path) links (rendered by Rich in
 * components/seo/pair/Faq.tsx), so one string can serve a paragraph, a fact row and the FAQPage data.
 *
 * Every sentence restates something /methodology, /faq, /leaderboard or the best-for pages already
 * publish; nothing about a test task goes beyond the methodology page's own description of it.
 * Task and attempt counts arrive in `c` from the price snapshot, and a sentence drops its number
 * when the snapshot does not answer. Percentages are read from the weight tables in bench-config.ts.
 */

export interface PlanFacts {
  /** The free plan's longest history view, in days; null when it has no limit. */
  historyDays: number | null;
  /** The free plan's routed requests a month, formatted. */
  routerRequests: string;
}

export interface SuiteCopy {
  /** Under the H1. */
  lead: string;
  /** The hero's facts; the page shows them when there are at least two. */
  facts: { dt: string; dd: string }[];
  tests: { title: string; lead: string; paras: string[]; rows: [string, string][] };
  grading: { title: string; lead: string; rows: [string, string][] };
  weights: { title: string; lead: string; paras: string[]; note?: string };
  schedule: { title: string; lead: string; paras: string[] };
  ties: { title: string; paras: string[] };
  limits: { title: string; lead: string; rows: [string, string][] };
  combined: { title: string; lead: string; paras: string[] };
  routerTitle: string;
  faqTitle: string;
  faq: FaqItem[];
}

/* ───────────────────────── sentences the pages share ───────────────────────── */

/** How the standard error behind a tie is taken, and how the board writes a tie (/methodology#ranks, /faq). */
export const SE_RULE = 'The standard error is the spread of the suite’s last five runs on the current tests, and the interval shown on the board is ±1.96 standard errors. On the board “=” marks a shared place, and a rank without it stands on its own.';

/** What sits on top of the weights, and what happens to a suite that is missing (/methodology#score). */
export const COMBINED_RULE = 'There is no curve, gate or penalty on top. A suite that is missing, or older than two of its own runs, drops out and the remaining suites are reweighted by their base weights; the row then carries a note such as “2 of 3 suites”.';

/** The FAQ's router answer: the mode that ranks on this suite's board, as the best-for pages describe it. */
function routerAnswer(key: SuiteKey, plan: PlanFacts): string {
  const best = BEST[BENCH[key].best];
  const alias = key === 'tooling' && best.routerAlt ? ` ${best.routerAlt.model} is ${best.routerAlt.desc}.` : '';
  return `Yes. Set model to ${best.routerModel} on the Smart Router’s OpenAI-compatible endpoint and each request goes to ${best.routerDesc}.${alias} Routing is drift-aware by default, uses your own provider keys and adds zero markup on tokens; Free includes ${plan.routerRequests} routed requests a month.`;
}

const boardOf = (key: SuiteKey): string => BOARD_TITLE[BENCH[key].board];
const link = (key: SuiteKey): string => `[${BENCH[key].label}](${BENCH[key].path})`;

/** Where the board itself is, and which views of it exist. */
function boardViews(key: SuiteKey, plan: PlanFacts): string {
  const s = BENCH[key];
  const best = BEST[s.best];
  const longer = plan.historyDays === null ? 'the longer views' : `the 7-day and ${plan.historyDays}-day views`;
  return `The ${boardOf(key)} board is the 24-hour view: the average of each model’s scores over the last day, so one odd attempt cannot move a place. Its first ${word(LEADERBOARD_TOP_N)} places are on the [leaderboard](/leaderboard#${s.board}) and its best-placed models on [${best.titleBase.charAt(0).toLowerCase()}${best.titleBase.slice(1)}](${best.path}); every model, and ${longer}, are on the full leaderboard with a free account.`;
}

/** The FAQ's shorter version of the same. */
const boardWhere = (key: SuiteKey): string =>
  `The ${boardOf(key)} board is the 24-hour view, the average of each model’s scores over the last day; its first ${word(LEADERBOARD_TOP_N)} places are on the [leaderboard](/leaderboard#${BENCH[key].board}).`;

/** A score's shelf life (two of its suite's own runs) and the two detectors that watch between and across runs. */
const watch = (key: SuiteKey): string =>
  `A ${BENCH[key].suite.replace(' suite', '')} score is current until it is older than two of the suite’s runs, which is ${BENCH[key].currentHours} hours. An hourly canary probe watches for sudden drops, and each suite has its own change-point detector, run on daily results, for a sustained decline: [AI drift detection](/ai-drift-detection).`;

const combinedParas = (): string[] => [
  COMBINED_RULE,
  `The three suites, the hourly canary and the Combined score are set out together on [${HUB.label}](${HUB.path}).`,
];
const combinedLead = (key: SuiteKey, name: string): string =>
  `${name} carries ${COMBINED_WEIGHTS[key]}% of the Combined score, a plain weighted mean of the three suites.`;

const APPS: [string, string] = ['Chat apps', 'The tests call each provider’s API, which is what applications and the Smart Router call. ChatGPT and the Claude app run their own system prompts, tools and routing on top of the same models.'];
const OTHER_SUITES: [string, string] = ['Safety, bias and robustness', 'Adversarial safety, prompt robustness and bias detection are separate suites. None of them feeds a leaderboard score.'];

/* ───────────────────────── coding ───────────────────────── */

function codingCopy(c: SuiteCounts, plan: PlanFacts): SuiteCopy {
  const T = c.codingTasks;
  const A = c.codingAttempts;
  const attempts = A ? `${capWord(A)} attempts per task` : 'The attempts at a task';
  return {
    lead: `Real debugging jobs, graded by running the project’s own tests, including hidden tests the model never sees. Scheduled every four hours${T ? `: ${word(T)} tasks in every sweep${A ? `, ${word(A)} attempts each` : ''}` : ''}.`,
    facts: [
      ...(T ? [{ dt: String(T), dd: 'tasks in every sweep: real debugging jobs and a hard function task' }] : []),
      ...(A ? [{ dt: String(A), dd: 'attempts at every task, reduced to one result per task by the median' }] : []),
      { dt: '4 h', dd: 'between scheduled runs of the coding suite' },
    ],
    tests: {
      title: 'What the AI coding benchmark tests',
      lead: `${T ? `${capWord(T)} tasks` : 'The tasks'}, all run every sweep${A ? `, ${word(A)} attempts each` : ''}, graded by execution.`,
      paras: [
        'The coding suite is a debugging test. Most tasks hand the model a small working project and a bug report written as a user complaint: not a diagnosis, and no file named. The cause sits a module away from the symptom, with a plausible decoy in between. The model must find the defect and return a corrected file.',
        'Alongside these debugging jobs the suite carries a hard function task.',
        'A task everybody passes ranks nobody, so tasks that stop separating models are retired. A new task ships only if every hidden assertion traces to the bug report and at least a fifth of the fleet fails it across three independent runs.',
      ],
      rows: [],
    },
    grading: {
      title: 'How a coding answer is graded',
      lead: 'By execution: the corrected file is run against the project’s own test suite.',
      rows: [
        ['Hidden tests', 'Tests the model never sees make up three quarters of each repository task’s score. On one task, deduplicating payments by amount makes every visible test pass and is still wrong — it stops a customer legitimately buying the same item twice.'],
        [A ? `${capWord(A)} attempts, one result` : 'Many attempts, one result', `${attempts} collapse to one outcome per task by median, so one unlucky attempt cannot move a task.`],
        ['Only the answer', 'Only the answer is graded, never a model’s hidden reasoning. An attempt that uses its whole output budget without answering, or answers without code, is a failed attempt, and a retry asks the identical question.'],
        ['A declined task', 'A refusal is a content decision, not a measure of ability, so it is not scored as zero: the task drops out and the model is scored on what it attempted. The row shows its coverage, and the model is never called tied with one graded on every task.'],
      ],
    },
    weights: {
      title: 'The weights of the coding score',
      lead: `${capWord(CODING_WEIGHTS.length)} measures with published weights, and no curve, gate or penalty on top.`,
      paras: [
        'The weights follow what each measure can actually tell apart, not how important it sounds. Complexity is too similar across models to separate them. Efficiency is output tokens per second, and providers count a model’s hidden reasoning as output, so it rewarded answering at length rather than quickly. Neither carries weight, and both are still scored and shown. Format and safety are guardrails: their job is to cost a model points if it ever emits malformed or dangerous code.',
      ],
    },
    schedule: {
      title: 'How often the coding benchmark runs',
      lead: 'Every four hours, on the same schedule for every model, with no priority list.',
      paras: [
        `${T ? `All ${word(T)} tasks` : 'All the tasks'} run in every sweep. ${watch('coding')}`,
        boardViews('coding', plan),
      ],
    },
    ties: {
      title: 'How ties are decided on the Coding board',
      paras: [TIES_RULE, SE_RULE],
    },
    limits: {
      title: 'What the coding benchmark does not test',
      lead: 'It tests debugging and coding, not general ability.',
      rows: [
        ['Other languages', 'The tasks are in Python and everything is in English: the suite does not test other programming languages.'],
        ['Speed and price', 'Efficiency carries no weight, and the Coding board ranks ability, not price.'],
        ['Reasoning and tool calling', `Long multi-turn working sessions are the ${link('reasoning')}; tasks in sandboxed machines are the ${link('tooling')}.`],
        APPS,
        OTHER_SUITES,
      ],
    },
    combined: {
      title: 'How the coding suite feeds the Combined score',
      lead: combinedLead('coding', 'Coding'),
      paras: combinedParas(),
    },
    routerTitle: 'Routing on the Coding board',
    faqTitle: 'Questions about the AI coding benchmark',
    faq: [
      {
        q: 'What is the AI coding benchmark?',
        a: `It is the test behind the Coding board: repository debugging tasks graded by running the project’s own tests, including hidden tests the model never sees. ${T ? `${capWord(T)} tasks run in every sweep` : 'Every task runs in every sweep'}${A ? `, ${word(A)} attempts each` : ''}, on a four-hour schedule, and every model is given the same tasks.`,
      },
      {
        q: 'How does an LLM coding benchmark grade an answer?',
        a: `By execution. The model returns a corrected file, which is graded by running the project’s own test suite, and hidden tests make up three quarters of each repository task’s score. ${attempts} collapse to one outcome per task by median. Only the answer is graded, never a model’s hidden reasoning.`,
      },
      {
        q: 'How often is the coding LLM leaderboard updated?',
        a: `The coding suite is scheduled every four hours, with an hourly canary probe between runs. ${boardWhere('coding')}`,
      },
      {
        q: 'Which programming languages does the coding benchmark cover?',
        a: 'Python. The suite tests debugging and coding, not general ability and not other programming languages, and everything is in English.',
      },
      {
        q: 'Can an AI lab train on the coding benchmark tasks?',
        a: `${OPENNESS} To check a result yourself, [Test your keys](/router/test-keys) runs the same tasks with your own API keys and scores them with the same code${A ? `; it makes one attempt per task where the scheduled suite makes ${word(A)}` : ''}.`,
      },
      { q: 'Can I route coding requests to the top model automatically?', a: routerAnswer('coding', plan) },
    ],
  };
}

/* ───────────────────────── reasoning ───────────────────────── */

function reasoningCopy(c: SuiteCounts, plan: PlanFacts): SuiteCopy {
  const S = c.reasoningSessions;
  const sessions = S ? `${capWord(S)} long working sessions` : 'Long working sessions';
  const measures = REASONING_MEASURES.length;
  return {
    lead: `${sessions} of five or six turns, scheduled every day. Rules stated early in a session are checked by running code at later turns.`,
    facts: [
      ...(S ? [{ dt: String(S), dd: 'long working sessions of five or six turns; the daily score is their mean' }] : []),
      { dt: String(measures), dd: 'measures, weighted per task: correctness, recovery and three continuity measures' },
      { dt: '24 h', dd: 'between scheduled runs: daily at 03:00 Berlin time' },
    ],
    tests: {
      title: 'What the LLM reasoning benchmark tests',
      lead: `${sessions} of five or six turns; the daily score is their mean.`,
      paras: [
        'Each session builds on its own earlier turns, and when the model’s work fails it is told so the way a colleague would, without being handed the error.',
        `${capWord(measures)} measures are taken, weighted per task: correctness, recovery after a failed step, and three continuity measures, which are memory retention, plan coherence and context use.`,
        'The sessions, as the [methodology page](/methodology#reasoning) describes them:',
      ],
      rows: REASONING_TASKS.map((t): [string, string] => [t.task, t.asks]),
    },
    grading: {
      title: 'How a reasoning session is graded',
      lead: 'By running code, not by matching words and not by asking another model.',
      rows: [
        ['Correctness', 'Graded by running what the model produces.'],
        ['Continuity', 'Rules stated once in the conversation, at the start or partway through while the model is working on something else, and the decisions a model declares in its own plan are tested at every later step.'],
        ['Recovery', 'Counts only in a session where a step failed and the model was asked again. A measure the session gives no evidence for drops out and the rest are rescaled; it is never scored as zero.'],
        ['Time limit', 'A session may run for up to ninety minutes. A task a model declines or does not finish in that time drops out, and the row says so.'],
        ['Only the answer', 'Only what a model shows as its answer is graded, never its hidden reasoning.'],
      ],
    },
    weights: {
      title: 'The weights of the reasoning score',
      lead: 'The share of a task’s score that each measure carries in a normal session.',
      note: 'Plan coherence is not taken on tasks that ask for no plan. *Recovery counts only in a session where a step failed and the model was asked again, taking the share shown and scaling the others down. A document answer is never re-asked, so Document memory has none. Shares are rounded.',
      paras: ['The daily score is the mean of the sessions, and there is no curve, gate or penalty on top.'],
    },
    schedule: {
      title: 'How often the reasoning benchmark runs',
      lead: 'Daily at 03:00 Berlin time, which is 01:00 UTC in summer.',
      paras: [
        `${S ? `All ${word(S)} sessions` : 'All the sessions'} run every day. ${watch('reasoning')}`,
        boardViews('reasoning', plan),
      ],
    },
    ties: {
      title: 'How ties are decided on the Reasoning board',
      paras: [TIES_RULE, SE_RULE],
    },
    limits: {
      title: 'What the reasoning benchmark does not test',
      lead: 'It scores correctness, recovery and continuity inside long working sessions.',
      rows: [
        ['Questions in isolation', 'Every session runs for five or six turns and builds on its own earlier turns: the suite has no single-prompt questions.'],
        ['Very long contexts', 'Whether a model gets worse as its context gets longer is a separate weekly suite, a pilot that does not feed the leaderboard.'],
        ['Other languages and price', 'Everything is in English, and the Reasoning board ranks ability, not price.'],
        ['Coding and tool calling', `Repository bug fixes are the ${link('coding')}; tasks in sandboxed machines are the ${link('tooling')}.`],
        APPS,
        OTHER_SUITES,
      ],
    },
    combined: {
      title: 'How the reasoning suite feeds the Combined score',
      lead: combinedLead('reasoning', 'Reasoning'),
      paras: combinedParas(),
    },
    routerTitle: 'Routing on the Reasoning board',
    faqTitle: 'Questions about the LLM reasoning benchmark',
    faq: [
      {
        q: 'What is the LLM reasoning benchmark?',
        a: `It is the test behind the Reasoning board: ${S ? `${word(S)} long, multi-turn working sessions` : 'long, multi-turn working sessions'} every day, each of five or six turns. ${capWord(measures)} measures are weighted per task: correctness, recovery after a failed step, memory retention, plan coherence and context use. The daily score is the mean of the sessions.`,
      },
      {
        q: 'Is the reasoning score judged by another model?',
        a: 'No. Correctness is graded by running what the model produces, and continuity, which is whether the model still honours rules stated earlier in the session and the decisions in its own plan, is checked by running code at every later step, not by matching words or asking a judge model.',
      },
      {
        q: 'What do the reasoning sessions ask a model to do?',
        a: `${REASONING_TASKS.map((t) => `${t.task}: ${t.asks}.`).join(' ')} When the model’s work fails it is told so the way a colleague would, without being handed the error.`,
      },
      {
        q: 'How often is the AI reasoning benchmark updated?',
        a: `The reasoning suite is scheduled daily at 03:00 Berlin time. ${boardWhere('reasoning')}`,
      },
      {
        q: 'Are the reasoning benchmark tasks public?',
        a: `${OPENNESS} What each session asks, and the share every measure carries, are on the [methodology page](/methodology#reasoning).`,
      },
      { q: 'Can I route reasoning requests to the top model automatically?', a: routerAnswer('reasoning', plan) },
    ],
  };
}

/* ───────────────────────── tool calling ───────────────────────── */

function toolingCopy(c: SuiteCounts, plan: PlanFacts): SuiteCopy {
  const K = c.toolTasks;
  const tasks = K ? `${capWord(K)} tasks` : 'Tasks';
  const w = (name: string) => weightOf(TOOL_WEIGHTS, name);
  const calling = w('Tool selection') + w('Parameter accuracy') + w('Error handling') + w('Safety compliance');
  return {
    lead: `${tasks}, each in a real sandboxed machine: either the job is done at the end or it is not. The score also counts the right tool for each step, the correct arguments and recovery when a call fails.`,
    facts: [
      ...(K ? [{ dt: String(K), dd: 'tasks, each in a real sandboxed machine' }] : []),
      { dt: `${w('Task completion')}%`, dd: 'of the score is task completion: is the job actually done at the end?' },
      { dt: '24 h', dd: 'between scheduled runs: daily at 04:00 Berlin time' },
    ],
    tests: {
      title: 'What the LLM tool calling benchmark tests',
      lead: `${tasks}, each in a real sandboxed machine, scheduled daily.`,
      paras: [
        'The question that matters most is whether the job is done at the end.',
        'Read as a function calling benchmark, the same tasks score whether a model picks the right tool, passes the right arguments and recovers when a call fails. Read as an agentic benchmark, they score whether the job is finished without unnecessary calls, with earlier output carried forward and destructive operations avoided.',
        'It is the board to start from for agents that call tools.',
      ],
      rows: [],
    },
    grading: {
      title: 'How a tool-calling task is graded',
      lead: 'Is the job actually done at the end, and were the calls that got there the right ones?',
      rows: [
        ['Done or not', `Either the job is done at the end or it is not. Task completion carries ${w('Task completion')}% of the score.`],
        ['The calls', 'The right tool for each step, called with the correct arguments, with no unnecessary calls, and recovering when a call fails.'],
        ['Native tool turns', 'Each model sees its own tool calls and their results in its provider’s native tool format, with its own reasoning carried between calls, so the score is the model’s tool calling and not a transcript format.'],
      ],
    },
    weights: {
      title: 'The weights of the tool-use score',
      lead: `${capWord(TOOL_WEIGHTS.length)} measures with published weights, and no curve, gate or penalty on top.`,
      paras: [
        `Read for function calling, tool selection, parameter accuracy, error handling and safety compliance carry ${calling}% of the score between them; task completion, efficiency and context awareness carry the rest.`,
      ],
    },
    schedule: {
      title: 'How often the tool calling benchmark runs',
      lead: 'Daily at 04:00 Berlin time, which is 02:00 UTC in summer.',
      paras: [
        `${K ? `All ${word(K)} tasks` : 'All the tasks'} run every day. ${watch('tooling')}`,
        boardViews('tooling', plan),
      ],
    },
    ties: {
      title: 'How ties are decided on the Tool use board',
      paras: [TIES_RULE, SE_RULE],
    },
    limits: {
      title: 'What the tool calling benchmark does not test',
      lead: 'It scores how a model uses tools to finish a job in a sandboxed machine.',
      rows: [
        ['Adversarial safety', 'Safety compliance here means avoiding destructive operations. Jailbreak, injection, extraction, manipulation and harmful-content probes are a separate suite that feeds no leaderboard score.'],
        ['Response time and price', 'Efficiency here means no unnecessary calls, and the Tool use board ranks ability, not price.'],
        ['Coding and long sessions', `Repository bug fixes are the ${link('coding')}; long multi-turn working sessions are the ${link('reasoning')}.`],
        ['Other languages', 'Everything is in English.'],
        APPS,
      ],
    },
    combined: {
      title: 'How the tool-use suite feeds the Combined score',
      lead: combinedLead('tooling', 'Tool use'),
      paras: combinedParas(),
    },
    routerTitle: 'Routing on the Tool use board',
    faqTitle: 'Questions about the LLM tool calling benchmark',
    faq: [
      {
        q: 'What is the LLM tool calling benchmark?',
        a: `It is the test behind the Tool use board: ${K ? `${word(K)} tasks` : 'tasks'}, each in a real sandboxed machine, where either the job is done at the end or it is not. ${capWord(TOOL_WEIGHTS.length)} measures are combined by published weights, and the suite is scheduled daily.`,
      },
      {
        q: 'Is it a function calling benchmark?',
        a: `Yes: the same board, read for function calling, scores whether a model picks the right tool, passes the right arguments and recovers when a call fails. Tool selection carries ${w('Tool selection')}% of the score, parameter accuracy ${w('Parameter accuracy')}%, error handling ${w('Error handling')}% and safety compliance ${w('Safety compliance')}%.`,
      },
      {
        q: 'Is it an agentic benchmark for AI agents?',
        a: `It is the board for agents that call tools. Task completion, ${w('Task completion')}% of the score, asks whether the job is done at the end; efficiency, ${w('Efficiency')}%, counts unnecessary calls; context awareness, ${w('Context awareness')}%, whether earlier output is carried forward. Each model sees its own tool calls and their results in its provider’s native tool format, with its own reasoning carried between calls.`,
      },
      {
        q: 'How often is the tool calling leaderboard updated?',
        a: `The tool-use suite is scheduled daily at 04:00 Berlin time. ${boardWhere('tooling')}`,
      },
      {
        q: 'Are the tool calling benchmark tasks public?',
        a: `${OPENNESS} Every weight is on the [methodology page](/methodology#tooling).`,
      },
      { q: 'Can I route agent requests to the top tool-calling model automatically?', a: routerAnswer('tooling', plan) },
    ],
  };
}

export function suiteCopy(key: SuiteKey, c: SuiteCounts, plan: PlanFacts): SuiteCopy {
  return key === 'coding' ? codingCopy(c, plan) : key === 'reasoning' ? reasoningCopy(c, plan) : toolingCopy(c, plan);
}
