import type { BoardKey } from '@/lib/boards-core';
import { TITLE_MAX, TITLE_SUFFIX } from '@/lib/seo';

/**
 * The best-for pages (/best-llm-for-coding, /best-llm-for-reasoning, /best-ai-model-for-agents,
 * /best-value-ai-model, /fastest-ai-model) and their hub (/best-ai-model): one entry per category
 * with its URL, headings, metadata, the board or metric that decides it, its definition and the
 * Smart Router mode that applies the same rule. The page itself is BestPage.tsx; the live
 * leader, the table and every number are read from the API at render time.
 *
 * Nothing here names a model or a rank. The definitions are the ones /compare and
 * /methodology#quick publish, word for word, so the three surfaces cannot disagree. Titles are
 * at most 42 characters with the month ("(October 2026)") appended by withMonth() from the
 * data's own timestamp, never typed; the longest month name is tried first and the month is
 * dropped if the whole title would pass 60 characters with the " | AI Stupid Level" suffix.
 */

export type BestKey = 'coding' | 'reasoning' | 'agents' | 'value' | 'fastest';
export const BEST_KEYS: BestKey[] = ['coding', 'reasoning', 'agents', 'value', 'fastest'];

export interface BestCategory {
  key: BestKey;
  path: string;
  /** The H1, exactly. */
  h1: string;
  /** The <title> part before the month and the suffix. */
  titleBase: string;
  /** 120–155 characters; "{days}" is the price window's length in days, filled in by fillDays() from the snapshot. */
  description: string;
  keywords: string[];
  /** The board that decides a board page; for a price page, the board whose five-point bar picks the candidates. */
  board: BoardKey;
  kind: 'board' | 'price';
  /** Price pages: what the near-top candidates are ordered by. */
  metric?: 'costPerSuccess' | 'medianMs';
  /** The category as it reads inside a question: "best for coding", "best for agents and tool calling". */
  x: string;
  /** The category as an adjective before "model": "the best coding model", "the best value model". */
  adj: string;
  /** The breadcrumb and link label. */
  label: string;
  /** The definition as /compare writes it (its "Best for" list) and, for the price pages, as /methodology#quick does. */
  definition: string;
  /** The page's own rule in one clause, lower case, for "applies the same bar — <rule> —" and the hub's rows. */
  rule: string;
  /** Price pages: the leaderboard's Quick answers card, verbatim from /methodology#quick. */
  quickCard?: { name: string; text: string };
  methodAnchor: string;
  /** The Smart Router mode that applies this page's rule, and how /router/docs describes it. */
  routerModel: string;
  routerDesc: string;
  /** A second mode worth naming beside it. */
  routerAlt?: { model: string; desc: string };
  /** The category's own FAQ question (the sixth is shared). */
  ownFaq: 'debugging' | 'judge' | 'function-calling' | 'retries' | 'quality-bar';
}

export const BEST: Record<BestKey, BestCategory> = {
  coding: {
    key: 'coding',
    path: '/best-llm-for-coding',
    h1: 'Best LLM for coding',
    titleBase: 'Best LLM for coding',
    description: 'Which LLM is best for coding? The Coding board over the last 24 hours: repository bug fixes graded by hidden tests, re-run every four hours, with ties.',
    keywords: ['best LLM for coding', 'best AI model for coding', 'best coding LLM 2026', 'which AI is best for coding', 'best LLM for debugging', 'coding benchmark leaderboard', 'LLM coding comparison'],
    board: 'coding',
    kind: 'board',
    x: 'coding',
    adj: 'coding',
    label: 'Coding',
    definition: 'The Coding board: repository debugging tasks graded by running the project’s own tests, including hidden tests the model never sees.',
    rule: 'the highest score on the Coding board, with statistical ties',
    methodAnchor: '/methodology#coding',
    routerModel: 'auto-coding',
    routerDesc: 'the model placing highest on the Coding board',
    routerAlt: { model: 'auto-value-coding', desc: 'the most coding points per measured dollar among models within five points of the coding leader' },
    ownFaq: 'debugging',
  },
  reasoning: {
    key: 'reasoning',
    path: '/best-llm-for-reasoning',
    h1: 'Best LLM for reasoning',
    titleBase: 'Best LLM for reasoning',
    description: 'Which LLM is best for reasoning? The Reasoning board over the last 24 hours: four multi-turn sessions a day, continuity checked by running code, with ties.',
    keywords: ['best LLM for reasoning', 'best AI model for reasoning', 'best reasoning model 2026', 'which AI is best for reasoning', 'multi-turn reasoning benchmark', 'LLM reasoning comparison'],
    board: 'reasoning',
    kind: 'board',
    x: 'reasoning',
    adj: 'reasoning',
    label: 'Reasoning',
    definition: 'The Reasoning board: four long, multi-turn working sessions every day.',
    rule: 'the highest score on the Reasoning board, with statistical ties',
    methodAnchor: '/methodology#reasoning',
    routerModel: 'auto-reasoning',
    routerDesc: 'the model placing highest on the Reasoning board',
    routerAlt: { model: 'auto-value-reasoning', desc: 'the most reasoning points per measured dollar among models within five points of the reasoning leader' },
    ownFaq: 'judge',
  },
  agents: {
    key: 'agents',
    path: '/best-ai-model-for-agents',
    h1: 'Best AI model for agents and tool calling',
    titleBase: 'Best AI model for agents',
    description: 'Which AI model is best for agents and tool calling? The Tool use board over the last 24 hours: nine sandboxed tasks a day, scored on completion and tools.',
    keywords: ['best AI model for agents', 'best LLM for tool calling', 'best model for function calling', 'most reliable function calling model', 'best LLM for agents 2026', 'agentic AI model benchmark', 'tool use benchmark'],
    board: 'tooling',
    kind: 'board',
    x: 'agents and tool calling',
    adj: 'agent',
    label: 'Agents',
    definition: 'The Tool use board: nine tasks, each in a real sandboxed machine — either the job is done at the end or it is not.',
    rule: 'the highest score on the Tool use board, with statistical ties',
    methodAnchor: '/methodology#tooling',
    routerModel: 'auto-tooling',
    routerDesc: 'the model placing highest on the Tool use board',
    routerAlt: { model: 'auto-agentic', desc: 'the same mode under the name most agent frameworks use' },
    ownFaq: 'function-calling',
  },
  value: {
    key: 'value',
    path: '/best-value-ai-model',
    h1: 'Best value AI model',
    titleBase: 'Best value AI model',
    description: 'Which AI model is the best value? The lowest cost per correct answer over the last {days} days among models within five points of the best on the Coding board.',
    keywords: ['best value AI model', 'best price-performance LLM API', 'cheapest AI model that passes tests', 'cost per correct answer', 'cheapest LLM API 2026', 'AI model cost comparison', 'LLM price performance'],
    board: 'coding',
    kind: 'price',
    metric: 'costPerSuccess',
    x: 'value',
    adj: 'value',
    label: 'Value',
    definition: 'The most points per measured dollar of one identical coding run, every attempt billed.',
    rule: 'within five points of the best, then the lowest cost per correct answer',
    quickCard: { name: 'Best value', text: 'The most points per measured dollar of one identical coding run — every attempt billed — among the models within five points of the top.' },
    methodAnchor: '/methodology#quick',
    routerModel: 'auto-value',
    routerDesc: 'the most combined-score points per measured dollar among models within five points of the best one you can use',
    routerAlt: { model: 'auto-value-coding', desc: 'the same rule on the Coding board alone, for coding traffic' },
    ownFaq: 'retries',
  },
  fastest: {
    key: 'fastest',
    path: '/fastest-ai-model',
    h1: 'Fastest AI model by response time',
    titleBase: 'Fastest AI model',
    description: 'Which AI model answers fastest? Median response time over the last {days} days among models within five points of the best on the Coding board, same runs.',
    keywords: ['fastest AI model', 'fastest AI model API response time', 'lowest latency frontier model', 'LLM response time comparison', 'fastest LLM 2026', 'AI model latency benchmark'],
    board: 'coding',
    kind: 'price',
    metric: 'medianMs',
    x: 'speed',
    adj: 'fastest',
    label: 'Fastest',
    definition: 'The lowest median response time, among the models within five points of the top.',
    rule: 'within five points of the best, then the lowest median response time',
    quickCard: { name: 'Fastest response', text: 'The lowest median response time over the last 48 hours (at least five runs), among the models within five points of the top.' },
    methodAnchor: '/methodology#quick',
    routerModel: 'auto-fastest-quality',
    routerDesc: 'the fastest model, by measured latency, among those within five points of the best one you can use',
    routerAlt: { model: 'auto-fastest', desc: 'the lowest latency with no quality bar' },
    ownFaq: 'quality-bar',
  },
};

export const HUB = {
  path: '/best-ai-model',
  h1: 'Best AI model for each job, decided by the same tests',
  titleBase: 'Best AI model for each job',
  description: 'The best AI model for coding, reasoning, agents, value and speed, decided by the same tests on a fixed schedule and ranked with statistical ties.',
  keywords: ['best AI model', 'best AI model 2026', 'best LLM 2026', 'which AI model is best', 'best AI model for coding', 'best AI model for agents', 'best value AI model', 'fastest AI model', 'AI model rankings'],
  definition: 'The Combined board: coding 50%, reasoning 25%, tool use 25%, ranked with statistical ties.',
} as const;

/** A description with its "{days}" placeholder filled from the price snapshot's window (the same figure every "last N days" on the page uses). */
export const fillDays = (s: string, days: number): string => s.replace('{days}', String(days));

/** "<base> (October 2026)" while the whole title stays within 60 characters with the suffix; the bare base otherwise. */
export function withMonth(base: string, month: string): string {
  const full = `${base} (${month})`;
  return full.length + TITLE_SUFFIX.length <= TITLE_MAX ? full : base;
}

/** The pages beside a category: the hub and the other four, in a fixed order. */
export function siblingsOf(key: BestKey | 'hub'): Array<{ path: string; label: string }> {
  const out: Array<{ path: string; label: string }> = [];
  if (key !== 'hub') out.push({ path: HUB.path, label: 'Best AI model overall' });
  for (const k of BEST_KEYS) if (k !== key) out.push({ path: BEST[k].path, label: BEST[k].h1 });
  return out;
}

/** The sentences every best-for page reuses, as the owner writes them. */
export const CADENCE = 'coding every four hours, reasoning and tool use daily, with an hourly canary probe';
export const OPENNESS = 'The methodology is public — every weight, statistical test and drift constant. The test tasks are private, so no lab can train on them.';
export const TIES_RULE = 'Every score carries a standard error from its own run-to-run repeatability. Walking down a board, a model joins the group above it unless that group’s leader is ahead by more than 1.96 times their combined standard error, so places such as 1, 1, 1, 4 are normal and a shared place is written joint. A model graded on fewer tasks than the rest keeps its position and is never called tied.';
