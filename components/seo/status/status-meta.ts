import { TITLE_MAX, TITLE_SUFFIX, clampDesc } from '@/lib/seo';
import { VENDORS, VENDOR_KEYS, vendorByKey, type Vendor, type VendorKey } from '@/lib/seo-data';

/**
 * The per-provider status pages' names, copy and metadata (/status/openai … /status/glm).
 * Nothing here names a model or a number from the feed: the verdict, the uptime, the outages and
 * the timestamps are rendered by the page from GET /providers/status. The cadence in the title
 * comes from the feed's meta.checkIntervalMinutes (10 at the time of writing).
 */

/** The name people put in front of "API": OpenAI (the company, since nobody says "the GPT API"), then the families. */
export const apiNameOf = (v: Vendor): string => (v.family === 'GPT' ? v.label : v.family);

/** True for the six provider segments of /status/<slug> (exact, lower-case keys only). */
export function isProviderSlug(s: string): boolean {
  return (VENDOR_KEYS as string[]).includes(String(s ?? '').toLowerCase());
}

export const providerBySlug = (s: string): Vendor | undefined => (isProviderSlug(s) ? vendorByKey(s) : undefined);

export const DEFAULT_INTERVAL_MIN = 10;

export interface StatusCopy {
  /** Surfaces people ask about that the probe never touches, as a list for a sentence. */
  notProbed: string[];
  /** What the probed host is, after its name, for "The endpoint" row. */
  endpointNote: string;
  /** A note on error codes where developer forums show a recurring confusion; null otherwise. */
  codesNote: string | null;
}

export const STATUS_COPY: Record<VendorKey, StatusCopy> = {
  openai: {
    notProbed: ['ChatGPT'],
    endpointNote: 'the OpenAI API, which is what applications and the Smart Router call. ChatGPT is a separate product on separate infrastructure and can be down while the API answers, or the reverse.',
    codesNote: null,
  },
  anthropic: {
    notProbed: ['claude.ai', 'Claude Code', 'the Anthropic Console'],
    endpointNote: 'the Claude API, which is what applications and the Smart Router call. claude.ai, Claude Code and the Anthropic Console are separate surfaces and can be down while the API answers, or the reverse.',
    codesNote: 'The Claude API also answers 529 (overloaded_error) when it is temporarily overloaded; treat it like a 503 and retry with backoff.',
  },
  google: {
    notProbed: ['the Gemini app', 'Vertex AI', 'the Gemini exchange'],
    endpointNote: 'the Gemini API via Google AI Studio (generativelanguage.googleapis.com), not the Gemini app, not Vertex AI, and not the Gemini exchange, which has nothing to do with Google.',
    codesNote: 'On the Gemini API a 503 that says the model is overloaded or in high demand is capacity on Google’s side, while a 429 is quota on your own project: one is the provider, the other is your account.',
  },
  deepseek: {
    notProbed: ['the DeepSeek app'],
    endpointNote: 'the DeepSeek API, which is what applications and the Smart Router call. The DeepSeek chat app is a separate surface.',
    codesNote: 'A DeepSeek 402 “Insufficient Balance” is the account, not the service: it means the key’s balance has run out.',
  },
  kimi: {
    notProbed: ['the Kimi app'],
    endpointNote: 'the Moonshot AI API that serves the Kimi models to applications and the Smart Router. The Kimi chat app is a separate surface.',
    codesNote: null,
  },
  glm: {
    notProbed: ['the GLM chat app'],
    endpointNote: 'the Z.ai API that serves the GLM models to applications and the Smart Router. The GLM chat app is a separate surface.',
    codesNote: null,
  },
};

/** The generic error-code reference: what the codes mean, in every provider's documentation; never a measurement. */
export const ERROR_CODES: Array<[string, string, string]> = [
  ['401', 'Authentication failed', 'The API key is missing, wrong or revoked. The service is up; the request is not allowed in. Check the key and the account it belongs to.'],
  ['403', 'Not permitted', 'The key is valid but may not use this model, endpoint, region or organisation. An account setting, not an outage.'],
  ['404', 'Unknown model or endpoint', 'The model name is misspelt or has been retired, or the path is wrong. Check the provider’s current model list.'],
  ['429', 'Rate limit or quota', 'Too many requests or tokens in the window, or a spending limit reached. A rate limit passes in seconds: back off and retry. A quota or billing message means the account, not the provider.'],
  ['500', 'Provider error', 'Something failed inside the provider while handling the request. Retry with exponential backoff; if it persists across requests, the provider has a problem.'],
  ['502 · 503 · 504', 'Unavailable, overloaded or timed out', 'The provider or its edge is overloaded, restarting or too slow to answer. “High demand” and “overloaded” messages are capacity signals: retry with backoff, or route the request to another provider.'],
];

const PART_MAX = TITLE_MAX - TITLE_SUFFIX.length; // 42

/**
 * "Is OpenAI API down? Checked every 10 min": the question as people type it, then the cadence.
 * Falls back to shorter forms so the part before the suffix never passes 42 characters.
 */
export function statusTitle(v: Vendor, interval: number): string {
  const q = `Is ${apiNameOf(v)} API down?`;
  for (const t of [`${q} Checked every ${interval} min`, `${q} ${interval}-minute checks`, q]) if (t.length <= PART_MAX) return t;
  return q.slice(0, PART_MAX);
}

/**
 * 120–155 characters, naming the host probed and the cadence. The template fits every vendor
 * natively (123 for api.z.ai, 151 for generativelanguage.googleapis.com); clampDesc only guards
 * a future host longer than Google's.
 */
export function statusDescription(v: Vendor, interval: number): string {
  return clampDesc(
    `${apiNameOf(v)} API status: one real completion to ${v.apiHost} every ${interval} minutes, ` +
    'uptime over 24 hours and 7 days, outages and free alerts.',
  );
}

export function statusKeywords(v: Vendor): string[] {
  const name = apiNameOf(v);
  const lower = name.toLowerCase();
  return [
    `${lower} api status`, `is ${lower} api down`, `is ${lower} down`, `${lower} api down`, `${lower} outage`,
    `${v.label.toLowerCase()} status`, `${v.apiHost} status`, 'ai provider status',
  ];
}

export const H1_OF = (v: Vendor): string => `Is the ${apiNameOf(v)} API down right now?`;

/** The hub's title: 40 characters before the suffix. */
export const hubTitle = (interval: number): string => `AI provider status, checked every ${interval} min`;

export const hubDescription = (interval: number): string => clampDesc(
  `Is your AI provider down? One real completion to OpenAI, Anthropic, Google, DeepSeek, Kimi and GLM every ${interval} minutes: ` +
  'uptime, outages and free alerts.',
);

export const HUB_KEYWORDS = [
  'ai provider status', 'is openai down', 'is anthropic down', 'is claude down', 'is gemini down', 'is deepseek down',
  'openai api status', 'claude api status', 'gemini api status', 'deepseek api status', 'kimi api status', 'glm api status', 'llm api status page',
];

/** Every provider page, in board order, for the hub's item list and the cross-links. */
export const PROVIDER_PAGES = VENDORS.map((v) => ({ key: v.key, name: `${apiNameOf(v)} API status`, path: v.statusPath }));
