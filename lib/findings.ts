import type { VendorKey } from './seo-data';

/**
 * Dated findings re-derived from the test record: the only place a model is named in static copy,
 * allowed because every row is a past-tense, dated catch with its before/after values.
 *
 * Sources: /root/ASL_Observability_Research_Paper.md v1.0 (§4.1 build changes confirmed by the
 * provider, §4.2 behavioural steps, §4.3 endpoint withdrawals) and the 2026-10-15 re-derivation
 * on tasks 10–18 (means) recorded in the owner's memory notes (aistupidlevel-value-positioning,
 * aistupidlevel-observability-paper). Nothing here is generalised into a "models get worse"
 * claim and nothing is attached to a current ranking; the rows are rendered by the
 * "What changed in the record" sections of /is-ai-getting-worse, the four family pages and the
 * research article at FINDINGS_SOURCE.
 *
 * Deliberately absent: any pass-rate loss of five points or more for any model (none occurred),
 * the withdrawn LinkedIn-article claims, and anything the hourly change-point scanner "found".
 */
export interface Finding {
  /** ISO day (UTC) the change was first seen. */
  date: string;
  vendor: VendorKey;
  /** The model as it was named at the time. */
  model: string;
  metric: string;
  before: string;
  after: string;
  method: string;
  note: string;
}

/** How the behavioural steps were found (paper §3.3, §3.5). */
export const FINDINGS_METHOD =
  "daily medians of the same nine coding tasks, binary segmentation with Welch's t-test; provider builds and served model names read from the identifier each response carries";

/** How a withdrawal shows in the record (paper §4.3). */
export const WITHDRAWAL_METHOD = 'the per-call record: a last successful call, then HTTP 404 on every later attempt';

/** The research article that sets out the method and every row below. */
export const FINDINGS_SOURCE = '/research/thirteen-months-of-llm-monitoring';

/** The span of the record the rows come from, as the article states it. */
export const FINDINGS_WINDOW = 'September 2025 to September 2026';

export const FINDINGS: Finding[] = [
  {
    date: '2025-09-26',
    vendor: 'google',
    model: 'Gemini 2.5 Pro (preview 03-25)',
    metric: 'Response time on the same tasks',
    before: '5.3 s',
    after: '3.8 s (−28%)',
    method: FINDINGS_METHOD,
    note: 'An isolated serving-speed step with no change on our side; the pass rate on the same tasks did not step with it.',
  },
  {
    date: '2025-10-06',
    vendor: 'openai',
    model: 'GPT-5 nano',
    metric: 'Response time on the same tasks',
    before: '8.5 s',
    after: '12.8 s (+51%)',
    method: FINDINGS_METHOD,
    note: 'An isolated serving-speed step with no change on our side; the pass rate on the same tasks did not step with it.',
  },
  {
    date: '2025-11-05',
    vendor: 'google',
    model: 'Gemini 2.5 Flash',
    metric: 'Response time on the same tasks',
    before: '1.4 s',
    after: '1.0 s (−28%)',
    method: FINDINGS_METHOD,
    note: 'An isolated serving-speed step with no change on our side; the pass rate on the same tasks did not step with it.',
  },
  {
    date: '2025-11-27',
    vendor: 'kimi',
    model: 'Kimi K2 (0711 preview)',
    metric: 'Response time on the same tasks',
    before: '7.4 s',
    after: '4.1 s (−45%)',
    method: FINDINGS_METHOD,
    note: 'An isolated serving-speed step with no change on our side; the pass rate on the same tasks did not step with it.',
  },
  {
    date: '2025-12-02',
    vendor: 'google',
    model: 'Gemini 2.5 Pro (preview 03-25)',
    metric: 'Endpoint withdrawn',
    before: 'answering (last successful run 9 Nov 2025)',
    after: 'HTTP 404 from 2 Dec 2025',
    method: WITHDRAWAL_METHOD,
    note: 'For an application that hard-codes a model name, a withdrawal looks exactly like an outage.',
  },
  {
    date: '2025-12-21',
    vendor: 'openai',
    model: 'GPT-5.2-codex',
    metric: 'Listed but never served',
    before: 'listed to our account',
    after: 'HTTP 404 on all 83 attempts, 21 Dec 2025 – 6 Jan 2026',
    method: WITHDRAWAL_METHOD,
    note: 'The model was listed to us but never answered a single call on our account.',
  },
  {
    date: '2026-02-09',
    vendor: 'kimi',
    model: 'Kimi Thinking (preview)',
    metric: 'Endpoint withdrawn',
    before: 'answering (last successful run 7 Jan 2026)',
    after: 'HTTP 404 from 9 Feb 2026',
    method: WITHDRAWAL_METHOD,
    note: 'For an application that hard-codes a model name, a withdrawal looks exactly like an outage.',
  },
  {
    date: '2026-02-19',
    vendor: 'anthropic',
    model: 'Claude 3.7 Sonnet',
    metric: 'Endpoint withdrawn',
    before: 'answering',
    after: 'HTTP 404 from 19 Feb 2026',
    method: WITHDRAWAL_METHOD,
    note: 'Its last successful run and its first 404 fell on the same day.',
  },
  {
    date: '2026-03-10',
    vendor: 'glm',
    model: 'GLM-4.6',
    metric: 'Answer length and pass rate on the same tasks, before and after 10 Mar 2026',
    before: '915 tokens, 93.1% pass',
    after: '1,149 tokens, 87.2% pass',
    method: FINDINGS_METHOD,
    note: 'Answers came back 26% longer on the same tasks. The extra failures were almost all answers cut off at the output cap: a wordier model that, under a fixed budget, failed where it used to pass.',
  },
  {
    date: '2026-05-24',
    vendor: 'deepseek',
    model: 'DeepSeek V4 Pro',
    metric: 'Response time on the same tasks',
    before: '20.4 s',
    after: '10.5 s (−49%)',
    method: FINDINGS_METHOD,
    note: 'An isolated serving-speed step with no change on our side; the pass rate on the same tasks did not step with it.',
  },
  {
    date: '2026-07-31',
    vendor: 'deepseek',
    model: 'DeepSeek V4 Flash',
    metric: 'Mean answer length and response time on the same tasks (new build, first seen 02:10 UTC)',
    before: '510 tokens, 5.6 s',
    after: '1,054 tokens, 9.3 s',
    method: FINDINGS_METHOD,
    note: 'A new build behind the same model name, identified by the response fingerprint. Correctness held or improved slightly; at the same list price per token, the same work cost about twice as much.',
  },
  {
    date: '2026-08-12',
    vendor: 'deepseek',
    model: 'DeepSeek V4 Pro',
    metric: 'Mean answer length and response time on the same tasks (build fp_v4pro_20260812, first seen 18:09 UTC)',
    before: '727 tokens, 11.8 s',
    after: '1,477 tokens, 20.3 s',
    method: FINDINGS_METHOD,
    note: 'A new build behind the same model name, identified by the response fingerprint. Correctness held or improved slightly; the same work cost about twice as much and took 70% longer.',
  },
  {
    date: '2026-09-10',
    vendor: 'deepseek',
    model: 'DeepSeek V4 Flash',
    metric: 'Served model name',
    before: 'deepseek-v4-flash',
    after: 'deepseek-flash',
    method: FINDINGS_METHOD,
    note: 'From 10 Sep 2026 requests for deepseek-v4-flash were answered by a model identifying itself as deepseek-flash: the name we were paying to measure was redirected to a different served model.',
  },
];

const byDateDesc = (a: Finding, b: Finding): number => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

/** Every finding, newest first. */
export const findingsNewestFirst = (): Finding[] => [...FINDINGS].sort(byDateDesc);

/** One vendor's findings, newest first. */
export const findingsOf = (vendor: VendorKey): Finding[] => FINDINGS.filter((f) => f.vendor === vendor).sort(byDateDesc);

/** True for the rows found by the step detector rather than by a 404 run. */
export const isBehaviourFinding = (f: Finding): boolean => f.method === FINDINGS_METHOD;
