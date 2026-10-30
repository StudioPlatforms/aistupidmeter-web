import type { Metadata } from 'next';
import { MONTHS_SHORT, TITLE_MAX, TITLE_SUFFIX, clampDesc, monthLabel, pageMeta, toDate } from '@/lib/seo';
import { VENDORS, getBoards24h, vendorByKey, type Vendor } from '@/lib/seo-data';

/**
 * Names, questions and metadata of the "is X getting worse" pages: the hub /is-ai-getting-worse
 * and the four family pages. Nothing here names a model; the family and the vendor are the only
 * proper nouns, and the month in a title comes from the boards' timestamp.
 *
 * The query phrases are deliberate and kept verbatim: "is ChatGPT getting worse", "is Claude
 * getting worse", "AI model nerfed", "why is my AI model getting dumber".
 */

export type WorseVendorKey = 'openai' | 'anthropic' | 'google' | 'deepseek';
export const WORSE_VENDORS: WorseVendorKey[] = ['openai', 'anthropic', 'google', 'deepseek'];

export const WORSE_HUB_PATH = '/is-ai-getting-worse';
export const HUB_TITLE_BASE = 'Is your AI getting worse?';
export const HUB_H1 = { title: 'Is your AI getting worse?', accent: 'What the same tests show' };
export const HUB_BREADCRUMB = { name: 'Is your AI getting worse?', path: WORSE_HUB_PATH };

export interface WorseCopy {
  /** The name in the question: ChatGPT, Claude, Gemini, DeepSeek. */
  name: string;
  /** The query as typed. */
  query: string;
  nerfQuery: string;
  /** The product people use, for the "tool or model" section. */
  tool: string;
  toolH2: string;
  toolFaqQ: string;
  /** The "is there a … degradation tracker?" question, worded as people search for this family. */
  trackerQ: string;
  /** An optional family-specific line for that answer (a product people name alongside the models). */
  trackerNote?: string;
  /** An extra question in the words the searches use, where Search Console shows them (Gemini). */
  dumberQ?: string;
  keywords: string[];
}

export const WORSE_COPY: Record<WorseVendorKey, WorseCopy> = {
  openai: {
    name: 'ChatGPT', query: 'is ChatGPT getting worse', nerfQuery: 'is ChatGPT nerfed',
    tool: 'ChatGPT', toolH2: 'ChatGPT feels dumber — the app or the model?', toolFaqQ: 'Do you test ChatGPT itself?',
    trackerQ: 'Is there a GPT or Codex degradation tracker?',
    trackerNote: 'Codex, like ChatGPT, runs these models inside its own harness, which we do not measure: a GPT model that holds steady here while Codex feels worse points at that layer.',
    keywords: ['is ChatGPT getting worse', 'is ChatGPT nerfed', 'ChatGPT getting dumber', 'ChatGPT quality dropped', 'GPT getting dumber', 'has ChatGPT been downgraded', 'is the OpenAI API down', 'GPT degradation tracker', 'Codex degradation tracker', 'AI model nerfed', 'why is my AI model getting dumber'],
  },
  anthropic: {
    name: 'Claude', query: 'is Claude getting worse', nerfQuery: 'is Claude nerfed',
    tool: 'Claude Code', toolH2: 'Claude Code feels dumber — the tool or the model?', toolFaqQ: 'Do you test Claude Code itself?',
    trackerQ: 'Is there a Claude or Opus degradation tracker?',
    trackerNote: 'Every Claude model on the board, Opus included, is in the table at the top of this page.',
    keywords: ['is Claude getting worse', 'is Claude nerfed', 'Claude getting dumber', 'Claude Code getting dumber', 'has Claude been downgraded', 'Claude degraded', 'is the Anthropic API down', 'Claude degradation tracker', 'Opus degradation tracker', 'AI model nerfed', 'why is my AI model getting dumber'],
  },
  google: {
    name: 'Gemini', query: 'is Gemini getting worse', nerfQuery: 'is Gemini nerfed',
    tool: 'the Gemini app', toolH2: 'The Gemini app vs the Gemini API', toolFaqQ: 'Do you test the Gemini app itself?',
    trackerQ: 'Is there a Gemini degradation tracker?',
    dumberQ: 'Is Gemini getting dumber?',
    keywords: ['is Gemini getting worse', 'is Gemini nerfed', 'Gemini getting dumber', 'Gemini quality regression', 'has Gemini been downgraded', 'is the Gemini API down', 'is Gemini dumb', 'is Gemini stupid', 'Gemini degradation tracker', 'AI model nerfed', 'why is my AI model getting dumber'],
  },
  deepseek: {
    name: 'DeepSeek', query: 'is DeepSeek getting worse', nerfQuery: 'is DeepSeek nerfed',
    tool: 'the DeepSeek app', toolH2: 'The DeepSeek app vs the DeepSeek API', toolFaqQ: 'Do you test the DeepSeek app itself?',
    trackerQ: 'Is there a DeepSeek degradation tracker?',
    keywords: ['is DeepSeek getting worse', 'is DeepSeek nerfed', 'DeepSeek getting dumber', 'DeepSeek quality dropped', 'has DeepSeek been downgraded', 'is the DeepSeek API down', 'DeepSeek degradation tracker', 'AI model nerfed', 'why is my AI model getting dumber'],
  },
};

export function isWorseVendor(k: string): k is WorseVendorKey {
  return (WORSE_VENDORS as string[]).includes(k);
}

/** The vendor registry entry; the four keys are all in lib/seo-data VENDORS. */
export function worseVendor(k: WorseVendorKey): Vendor {
  return vendorByKey(k) ?? VENDORS[0];
}

/** The page's path, from the vendor registry (the single source the vendor and status pages link to). */
export function worsePath(k: WorseVendorKey): string {
  return worseVendor(k).worsePath ?? `/is-${WORSE_COPY[k].name.toLowerCase()}-getting-worse`;
}

/** The H1, exactly the query in question form. */
export const worseH1 = (k: WorseVendorKey): string => `Is ${WORSE_COPY[k].name} getting worse?`;

const TITLE_PART_MAX = TITLE_MAX - TITLE_SUFFIX.length; // 42

/**
 * "<base> (October 2026)": the month comes from the boards' timestamp. Falls back to the short
 * month, then to no month, so the part before the suffix never passes 42 characters.
 */
export function titleWithMonth(base: string, generatedAt: string | null | undefined): string {
  const d = toDate(generatedAt);
  const long = `${base} (${monthLabel(d)})`;
  if (long.length <= TITLE_PART_MAX) return long;
  const short = `${base} (${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()})`;
  return short.length <= TITLE_PART_MAX ? short : base;
}

export const worseTitle = (k: WorseVendorKey, generatedAt: string | null | undefined): string => titleWithMonth(worseH1(k), generatedAt);

/** 120–155 characters, the question first. */
export function worseDescription(k: WorseVendorKey): string {
  const v = worseVendor(k);
  return clampDesc(
    `${worseH1(k)} Every ${v.family} model we track, re-tested on the same coding, reasoning and tool-use tasks, and a verdict from the last 24 hours.`,
  );
}

/** 155 characters exactly; written to fit rather than clamped, so it never ends mid-phrase. */
export const HUB_DESCRIPTION = clampDesc(
  'Is your AI getting worse? GPT, Claude, Gemini, DeepSeek, Kimi and GLM on the same tests since August 2025, with a detector per suite and a 24-hour verdict.',
);

export const HUB_KEYWORDS = [
  'is AI getting worse', 'AI model nerfed', 'why is my AI model getting dumber', 'are AI models getting worse over time',
  'AI getting dumber', 'AI model degradation', 'is ChatGPT getting worse', 'is Claude getting worse', 'is Gemini getting worse',
  'is DeepSeek getting worse', 'LLM degradation tracker', 'AI model nerf check',
];

export async function worseMetadata(k: WorseVendorKey): Promise<Metadata> {
  const boards = await getBoards24h();
  return pageMeta({
    title: worseTitle(k, boards?.generatedAt),
    description: worseDescription(k),
    path: worsePath(k),
    keywords: WORSE_COPY[k].keywords,
  });
}

export async function hubMetadata(): Promise<Metadata> {
  const boards = await getBoards24h();
  return pageMeta({
    title: titleWithMonth(HUB_TITLE_BASE, boards?.generatedAt),
    description: HUB_DESCRIPTION,
    path: WORSE_HUB_PATH,
    keywords: HUB_KEYWORDS,
  });
}
