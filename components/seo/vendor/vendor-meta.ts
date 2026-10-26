import type { Metadata } from 'next';
import { MONTHS_SHORT, TITLE_MAX, TITLE_SUFFIX, clampDesc, monthLabel, pageMeta, toDate } from '@/lib/seo';
import { VENDOR_KEYS, getBoards24h, vendorByKey, type Vendor, type VendorKey } from '@/lib/seo-data';

/**
 * The vendor pages' names, questions and metadata (/models/openai … /models/glm). The page
 * itself is components/seo/vendor/VendorPage.tsx; app/models/[id]/page.tsx hands a vendor
 * slug to these two exports before it tries to resolve the segment as a model.
 *
 * Nothing here names a model: titles and descriptions are built from the vendor registry in
 * lib/seo-data.ts and the month of the boards' timestamp. The model names, counts and places
 * are rendered by the page from live data.
 */

export interface VendorCopy {
  /** The word people put in front of "models" in a query: "OpenAI models", "Claude models". */
  name: string;
  /** The family's "getting worse" question, as a heading. */
  worseQuestion: string;
  /** The same question as typed into a search box (kept verbatim where it is one of the known phrases). */
  worseQuery: string;
}

export const VENDOR_COPY: Record<VendorKey, VendorCopy> = {
  openai: { name: 'OpenAI', worseQuestion: 'Is ChatGPT getting worse?', worseQuery: 'is ChatGPT getting worse' },
  anthropic: { name: 'Claude', worseQuestion: 'Is Claude getting worse?', worseQuery: 'is Claude getting worse' },
  google: { name: 'Gemini', worseQuestion: 'Is Gemini getting worse?', worseQuery: 'is Gemini getting worse' },
  deepseek: { name: 'DeepSeek', worseQuestion: 'Is DeepSeek getting worse?', worseQuery: 'is DeepSeek getting worse' },
  kimi: { name: 'Kimi', worseQuestion: 'Is Kimi getting worse?', worseQuery: 'is Kimi getting worse' },
  glm: { name: 'GLM', worseQuestion: 'Is GLM getting worse?', worseQuery: 'is GLM getting worse' },
};

/** The hub for the two families without a page of their own. */
export const WORSE_HUB = '/is-ai-getting-worse';

/** The "is X getting worse" page a vendor page links to. */
export const worsePathOf = (v: Vendor): string => v.worsePath ?? WORSE_HUB;

/** True for the six vendor segments of /models/<slug> (exact, lower-case keys only). */
export function isVendorSlug(s: string): boolean {
  return (VENDOR_KEYS as string[]).includes(String(s ?? '').toLowerCase());
}

/** "OpenAI's GPT models", "DeepSeek models" where the family name is the company's. */
export function vendorPossessive(v: Vendor): string {
  return v.label === v.family ? `${v.family} models` : `${v.label}’s ${v.family} models`;
}

/** The H1, in two parts: "OpenAI models on the same tests," + the accent line. */
export function vendorH1(v: Vendor): { title: string; accent: string } {
  return { title: `${VENDOR_COPY[v.key].name} models on the same tests,`, accent: 're-tested on a fixed schedule' };
}

const TITLE_PART_MAX = TITLE_MAX - TITLE_SUFFIX.length; // 42

/**
 * "OpenAI models benchmarked (October 2026)": the month comes from the boards' timestamp. Falls
 * back to the short month, then to no month, so the part before the suffix never passes 42
 * characters whatever the vendor or the month ("DeepSeek … (September 2026)" would be 44).
 */
export function vendorTitle(v: Vendor, generatedAt: string | null | undefined): string {
  const base = `${VENDOR_COPY[v.key].name} models benchmarked`;
  const d = toDate(generatedAt);
  const long = `${base} (${monthLabel(d)})`;
  if (long.length <= TITLE_PART_MAX) return long;
  const short = `${base} (${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()})`;
  return short.length <= TITLE_PART_MAX ? short : base;
}

/**
 * 120–155 characters, naming the family and the three suites. The template fits every vendor
 * natively (144–154 with the longest possessive, "Moonshot AI’s Kimi models"); clampDesc only
 * guards a future vendor with a longer name.
 */
export function vendorDescription(v: Vendor): string {
  return clampDesc(
    `${vendorPossessive(v)} on the same coding, reasoning and tool-use tests as every vendor, ` +
    're-tested on a fixed schedule, with 24-hour scores and places.',
  );
}

export function vendorKeywords(v: Vendor): string[] {
  const { name, worseQuery } = VENDOR_COPY[v.key];
  return [
    `${name} models`,
    `${name} models benchmark`,
    `${name} models compared`,
    `best ${name} model for coding`,
    `best ${name} model for reasoning`,
    `${v.family} benchmark`,
    `${v.label} API status`,
    worseQuery,
  ];
}

/** Metadata for /models/<vendor>; a non-vendor slug gets a noindex stub (the page 404s). */
export async function vendorMetadata(slug: string): Promise<Metadata> {
  const v = isVendorSlug(slug) ? vendorByKey(slug) : undefined;
  if (!v) return { title: { absolute: `Not found${TITLE_SUFFIX}` }, robots: { index: false, follow: true } };
  const boards = await getBoards24h();
  return pageMeta({
    title: vendorTitle(v, boards?.generatedAt),
    description: vendorDescription(v),
    path: v.modelsPath,
    keywords: vendorKeywords(v),
  });
}
