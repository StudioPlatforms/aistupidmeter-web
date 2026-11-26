import type { Metadata } from 'next';
import type { BestKey } from '@/components/seo/best/best-config';
import type { BoardKey } from '@/lib/boards-core';
import { pageMeta } from '@/lib/seo';
import type { PriceSnapshot } from '@/lib/seo-data';

/**
 * The benchmark pages: the hub (/ai-benchmarks) and one page per suite (/ai-coding-benchmark,
 * /llm-reasoning-benchmark, /llm-tool-calling-benchmark). One entry per suite with its URL,
 * headings, metadata, the board it scores and the best-for category that ranks on it. The suite
 * page is SuitePage.tsx; its wording is bench-copy.ts.
 *
 * These pages explain the method: what a suite tests, how an answer is graded, the weights, the
 * schedule, the tie rule, what is out of scope and how the suite feeds the Combined score. They
 * name no model. Every weight and share below is the one /methodology publishes, so change them
 * together. Task and attempt counts are never typed: countsOf() reads them from the price snapshot.
 *
 * The addresses cannot start with /benchmark: the web server sends that prefix to the API.
 */

export type SuiteKey = 'coding' | 'reasoning' | 'tooling';
export const SUITE_KEYS: SuiteKey[] = ['coding', 'reasoning', 'tooling'];

export interface BenchSuite {
  key: SuiteKey;
  /** The board this suite scores; also its anchor on /leaderboard. */
  board: BoardKey;
  /** The best-for category decided by that board (best-config.ts): its page and its Smart Router mode. */
  best: BestKey;
  path: string;
  /** The <title> before the " | AI Stupid Level" suffix: at most 42 characters. */
  title: string;
  /** 120–155 characters. */
  description: string;
  keywords: string[];
  kicker: string;
  h1: { title: string; accent: string };
  /** The page as a link reads, and its breadcrumb. */
  label: string;
  /** The suite as /methodology names it, lower case. */
  suite: string;
  /** Its section of the methodology page. */
  methodAnchor: string;
  /** The schedule in a table cell. */
  schedule: string;
  /** Hours after which a score is no longer current: two of the suite's own runs. */
  currentHours: number;
}

export const BENCH: Record<SuiteKey, BenchSuite> = {
  coding: {
    key: 'coding',
    board: 'coding',
    best: 'coding',
    path: '/ai-coding-benchmark',
    title: 'AI coding benchmark: how LLMs are graded',
    description: 'How the AI coding benchmark works: repository bug fixes graded by running hidden tests, scheduled every four hours, with every weight and the tie rule.',
    keywords: ['AI coding benchmark', 'LLM coding benchmark', 'coding LLM leaderboard', 'AI coding leaderboard', 'coding benchmark for LLMs', 'LLM debugging benchmark', 'hidden test coding benchmark'],
    kicker: 'AI benchmarks · Coding suite',
    h1: { title: 'AI coding benchmark', accent: 'bug fixes graded by hidden tests' },
    label: 'AI coding benchmark',
    suite: 'coding suite',
    methodAnchor: '/methodology#coding',
    schedule: 'Every four hours',
    currentHours: 8,
  },
  reasoning: {
    key: 'reasoning',
    board: 'reasoning',
    best: 'reasoning',
    path: '/llm-reasoning-benchmark',
    title: 'LLM reasoning benchmark: how it is graded',
    description: 'How the LLM reasoning benchmark works: long multi-turn working sessions, continuity checked by running code, scheduled daily, with every weight.',
    keywords: ['LLM reasoning benchmark', 'AI reasoning benchmark', 'reasoning benchmark for LLMs', 'multi-turn reasoning benchmark', 'LLM reasoning leaderboard', 'long-session LLM benchmark'],
    kicker: 'AI benchmarks · Reasoning suite',
    h1: { title: 'LLM reasoning benchmark', accent: 'long sessions, checked by running code' },
    label: 'LLM reasoning benchmark',
    suite: 'reasoning suite',
    methodAnchor: '/methodology#reasoning',
    schedule: 'Daily',
    currentHours: 48,
  },
  tooling: {
    key: 'tooling',
    board: 'tooling',
    best: 'agents',
    path: '/llm-tool-calling-benchmark',
    title: 'LLM tool calling benchmark for agents',
    description: 'How the LLM tool calling benchmark works: tasks in sandboxed machines scored on completion, tool selection and arguments, for function calling and agents.',
    keywords: ['LLM tool calling benchmark', 'function calling benchmark', 'agentic benchmark', 'AI agent benchmark', 'tool use benchmark', 'LLM function calling benchmark', 'agent benchmark for LLMs'],
    kicker: 'AI benchmarks · Tool-use suite',
    h1: { title: 'LLM tool calling benchmark', accent: 'for function calling and agents' },
    label: 'LLM tool calling benchmark',
    suite: 'tool-use suite',
    methodAnchor: '/methodology#tooling',
    schedule: 'Daily',
    currentHours: 48,
  },
};

export const HUB = {
  path: '/ai-benchmarks',
  title: 'AI benchmarks: three suites, one schedule',
  description: 'AI benchmarks for LLMs: coding, reasoning and tool-use suites on one fixed schedule, an hourly canary, published weights and one Combined score.',
  keywords: ['AI benchmarks', 'LLM benchmarks', 'AI model benchmark', 'live AI benchmark', 'AI benchmark suites', 'LLM benchmark methodology', 'AI coding benchmark', 'LLM reasoning benchmark', 'LLM tool calling benchmark'],
  kicker: 'AI benchmarks · LLM benchmarks',
  h1: { title: 'AI benchmarks', accent: 'three suites, one schedule' },
  label: 'AI benchmarks',
} as const;

/** Metadata of a suite page: a static title and description, since the page carries no dated figure. */
export function suiteMetadata(key: SuiteKey): Metadata {
  const s = BENCH[key];
  return pageMeta({ title: s.title, description: s.description, path: s.path, type: 'article', keywords: [...s.keywords] });
}

/** The suite pages beside one of them, in a fixed order. */
export const siblingsOf = (key: SuiteKey): BenchSuite[] => SUITE_KEYS.filter((k) => k !== key).map((k) => BENCH[k]);

/* ───────────────────────── weights, as /methodology publishes them ───────────────────────── */

/** The Combined score: a plain weighted mean of the three suites (/methodology#score). */
export const COMBINED_WEIGHTS: Record<SuiteKey, number> = { coding: 50, reasoning: 25, tooling: 25 };

/** /methodology#coding. The two measures without a weight are listed last. */
export const CODING_WEIGHTS: [string, number, string][] = [
  ['Correctness', 60, 'Does the fix work? Graded by running the project’s tests'],
  ['Stability', 10, 'The same result attempt after attempt'],
  ['Edge cases', 10, 'Hidden tests the model never saw'],
  ['Debugging', 10, 'Did it find the real defect, not silence the symptom?'],
  ['Code quality', 5, 'Clean, maintainable code'],
  ['Format', 3, 'Guardrail: clean, parseable output'],
  ['Safety', 2, 'Guardrail: no dangerous operations'],
  ['Efficiency', 0, 'Scored and shown; carries no weight'],
  ['Complexity', 0, 'Scored and shown; carries no weight'],
];

/** /methodology#tooling. */
export const TOOL_WEIGHTS: [string, number, string][] = [
  ['Task completion', 30, 'Is the job actually done at the end?'],
  ['Tool selection', 20, 'The right tool for each step'],
  ['Parameter accuracy', 15, 'Called with the correct arguments'],
  ['Efficiency', 15, 'No unnecessary calls'],
  ['Error handling', 10, 'Recovering when a call fails'],
  ['Context awareness', 5, 'Carrying earlier output forward'],
  ['Safety compliance', 5, 'Avoiding destructive operations'],
];

/** The columns of the reasoning table; the last one counts only in a session where a step failed. */
export const REASONING_MEASURES = ['Correctness', 'Memory', 'Plan', 'Context', 'Recovery'] as const;

/**
 * /methodology#reasoning, word for word: each session, what it asks, and the share of its score each
 * measure carries in a normal session (null where the measure is not taken). Nothing else about a
 * task is public, so nothing else is written here.
 */
export const REASONING_TASKS: { task: string; asks: string; shares: (number | null)[] }[] = [
  { task: 'IDE assistant', asks: 'Debug and extend a shopping-cart module over five turns', shares: [69, 23, null, 8, 13] },
  { task: 'Spec follow', asks: 'Build to a written specification, with requirements added partway through', shares: [38, 25, 25, 13, 11] },
  { task: 'Document memory', asks: 'Answer chained questions about a long document', shares: [40, 40, null, 20, null] },
  { task: 'Refactor project', asks: 'Split a tangled application into modules over six turns', shares: [33, 20, 33, 13, 12] },
];

/** The weight of one named measure, read from its table so a sentence cannot disagree with the table above it. */
export function weightOf(rows: [string, number, string][], name: string): number {
  const row = rows.find(([n]) => n === name);
  if (!row) throw new Error(`bench-config.ts has no measure "${name}"`);
  return row[1];
}

/* ───────────────────────── live counts ───────────────────────── */

export interface SuiteCounts {
  /** Tasks in a coding sweep, and attempts at each. */
  codingTasks: number | null;
  codingAttempts: number | null;
  /** Sessions in a reasoning run. */
  reasoningSessions: number | null;
  /** Tasks in a tool-use run. */
  toolTasks: number | null;
}

const count = (x: unknown): number | null => (typeof x === 'number' && Number.isInteger(x) && x > 0 ? x : null);

/** The suites' sizes as the price snapshot states them; null where it does not, and the sentence then goes without the number. */
export function countsOf(price: PriceSnapshot | null): SuiteCounts {
  return {
    codingTasks: count(price?.coding?.tasks),
    codingAttempts: count(price?.coding?.trials),
    reasoningSessions: count(price?.reasoning?.tasks),
    toolTasks: count(price?.tooling?.tasks),
  };
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/** "seven" for 7; numerals beyond twelve. */
export const word = (x: number): string => WORDS[x] ?? x.toLocaleString('en-US');
export const capWord = (x: number): string => { const w = word(x); return w.charAt(0).toUpperCase() + w.slice(1); };
