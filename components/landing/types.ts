/** Shapes of GET /dashboard/landing (api: routes/dashboard-landing.ts) and GET /providers/status. */

export type LandingTag = 'drift' | 'outage' | 'out' | 'excluded' | 'over_cost' | 'not_in_split'
  // Only a signed-in caller's own preview produces these (components/studio/route-snap.ts).
  | 'no_key' | 'over_latency' | 'no_tools';

export interface LandingRow {
  model: string;
  displayName: string;
  provider: string;
  score: number;
  metric: number | null;
  estimated?: boolean;
  tag: LandingTag | null;
  note?: string;
  role: 'primary' | 'fallback' | null;
}

export interface LandingStrategy {
  strategy: string;
  effectiveStrategy: string;
  taskRule?: string;
  primary: { model: string; displayName: string; provider: string; latencyMs: number | null; reasoning: string };
  fallbacks: string[];
  rows: LandingRow[];
}

export interface LandingSnapshot {
  generatedAt: string;
  modelCount: number;
  providerCount: number;
  samples: { code: string; design: string; tools: string };
  examplePreference: { strategy: string; excludeProviders: string[]; maxCostPer1M: number };
  strategies: Record<string, LandingStrategy | null>;
}

export interface HourBucket { t: string; total: number; down: number; degraded: number; unmeasured: number }

export interface ProviderHealth {
  provider: string;
  status: 'operational' | 'degraded' | 'down' | 'unmeasured';
  cause: 'provider' | 'our-account' | 'probe' | 'our-server' | null;
  responseTime: number | null;
  lastChecked: string;
  uptime7d: number | null;
  medianLatencyMs: number | null;
  hours: HourBucket[];
}

/**
 * A provider's health, shrunk for the page: `cells` holds one character per hour, oldest first —
 * '.' operational, 'w' degraded, 'b' provider outage, 'o' our side (not counted), 'e' no checks.
 */
export interface HealthRow {
  provider: string;
  status: ProviderHealth['status'];
  uptime7d: number | null;
  latencyMs: number | null;
  lastChecked: string;
  lastHour: string | null;
  cells: string;
}

export function compactHealth(p: ProviderHealth): HealthRow {
  const code = (h: HourBucket) => (!h.total ? 'e' : h.down > 0 ? 'b' : h.degraded > 0 ? 'w' : h.unmeasured >= h.total ? 'o' : '.');
  const hours = p.hours.slice(-168);
  return {
    provider: p.provider,
    status: p.status,
    uptime7d: p.uptime7d,
    latencyMs: p.medianLatencyMs ?? p.responseTime,
    lastChecked: p.lastChecked,
    lastHour: hours.length ? hours[hours.length - 1].t : null,
    cells: hours.map(code).join(''),
  };
}

export interface RosterModel { name: string; displayName: string; vendor: string; slug: string }

/** What a strategy orders by, for formatting and bar scaling. */
export type MetricKind = 'score' | 'price' | 'latency' | 'value' | 'spread' | 'weight';

export function metricKind(effectiveStrategy: string): MetricKind {
  if (effectiveStrategy.startsWith('best_value')) return 'value';
  if (effectiveStrategy === 'cheapest') return 'price';
  if (effectiveStrategy === 'fastest' || effectiveStrategy === 'fastest_quality') return 'latency';
  if (effectiveStrategy === 'best_consistent') return 'spread';
  if (effectiveStrategy === 'custom_split') return 'weight';
  return 'score';
}

export const METRIC_LABEL: Record<MetricKind, string> = {
  score: 'Score',
  price: '$ per 1M tokens',
  latency: 'Measured latency',
  value: 'Points per $',
  spread: 'Run-to-run spread',
  weight: 'Traffic weight',
};

/** What each strategy ranks on, in words. */
export const RANKS_ON: Record<string, string> = {
  best_overall: 'Combined score: coding 50%, reasoning 25%, tool use 25%',
  best_coding: 'Coding suite: real repository bug fixes, every 4 hours',
  best_reasoning: 'Reasoning suite: multi-turn sessions, daily',
  best_tooling: 'Tool-use suite: sandboxed agent tasks, daily',
  best_agentic_coding: 'Coding and tool-use suites, 50/50: a coding agent at work',
  best_value: 'Combined score ÷ measured cost of a benchmark run',
  best_value_coding: 'Coding score ÷ measured cost of a coding run',
  best_value_reasoning: 'Reasoning score ÷ measured cost of a session',
  best_value_tooling: 'Tool-use score ÷ measured cost of a session',
  fastest_quality: 'Measured latency, among models within 5 points of the best',
  fastest: 'Latency: production blended with benchmark runs',
  cheapest: 'Blended list price, (input + output) ÷ 2',
  best_consistent: 'Coding-score spread over recent runs, among contenders',
  custom_split: 'Your own weights',
};

export const PROVIDER_LABEL: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  deepseek: 'DeepSeek',
  kimi: 'Moonshot AI',
  glm: 'Z.ai',
};

/** GET /dashboard/price (api: routes/dashboard-price.ts) — what a correct result costs, per model. */
export interface PriceModel { id: number; name: string; displayName: string; vendor: string }

export interface PriceCodingRow extends PriceModel {
  attempts: number;
  passed: number;
  /** Share of attempts whose hidden tests passed, 0–1. */
  passRate: number;
  costPerAttempt: number;
  costPerSuccess: number | null;
  medianMs: number | null;
}

export interface PriceTaskRow extends PriceModel {
  sessions: number;
  /** The suite's measured score, 0–100. */
  score: number;
  costPerTask: number;
  medianMs: number | null;
}

interface PriceSuite<R> { from: string; to: string; tasks: number; models: R[]; declined: PriceModel[] }

export interface PriceSnapshot {
  generatedAt: string;
  /** True when the window is a rolling last-N-days view (synthetic mode), not a frozen measured window. */
  rolling?: boolean;
  windowDays?: number;
  coding: (PriceSuite<PriceCodingRow> & { trials: number }) | null;
  reasoning: PriceSuite<PriceTaskRow> | null;
  tooling: PriceSuite<PriceTaskRow> | null;
  finding: { a: PriceCodingRow; b: PriceCodingRow; ratio: number } | null;
}

/** /dashboard/enhanced-suites → data.corpus: everything measured since the first run. */
export interface Corpus { runs: number; toolSessions: number; deepSessions: number }
