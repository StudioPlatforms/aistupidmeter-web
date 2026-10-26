import { PLANS } from '@/lib/entitlements';
import { RESEARCH, researchBySlug, researchPath, type ResearchEntry } from '@/lib/research-index';

/**
 * Strings and small helpers shared by the research pages (/research and its articles): the
 * breadcrumbs, the sentences the owner fixed, the free-tier sentence built from the plan table,
 * and the registry lookups. Nothing here names a model.
 */

export const RESEARCH_PATH = '/research';
export const HOME_CRUMB = { name: 'Home', path: '/' };
export const RESEARCH_CRUMB = { name: 'Research', path: RESEARCH_PATH };
/** The public methodology PDF in /public. */
export const METHODOLOGY_PDF = '/asl-public-benchmark-methodology-2026.pdf';

export const CADENCE = 'coding every four hours, reasoning and tool use daily, with an hourly canary probe';
export const OPENNESS = 'The methodology is public — every weight, statistical test and drift constant. The test tasks are private, so no lab can train on them.';
export const PRIVATE_BACKEND = 'The validation harnesses run in our private backend; every constant is published.';
/** The paper’s own sentence (§2.3) on provenance: used verbatim, never elaborated. */
export const NO_CALLS = 'Score records that have no underlying calls are excluded.';

const n = (x: number) => x.toLocaleString('en-US');

/** The free tier in one sentence, with every number read from the plan table. */
export function freeTierSentence(): string {
  const f = PLANS.free;
  const windows = f.historyDays === null ? 'every window' : `24 hours, 7 days and ${f.historyDays} days`;
  return `Free account: every ranking over ${windows}, a ${f.watchedModels}-model watchlist with email alerts, ${n(f.routerRequestsPerMonth)} routed requests a month and a Data API key. No card.`;
}

/** The registry entry for a research page; a missing slug is a build error, not a 404. */
export function requireEntry(slug: string): ResearchEntry {
  const e = researchBySlug(slug);
  if (!e) throw new Error(`lib/research-index.ts has no entry "${slug}"`);
  return e;
}

/** Home › Research › the article. */
export const articleCrumbs = (e: ResearchEntry): { name: string; path: string }[] =>
  [HOME_CRUMB, RESEARCH_CRUMB, { name: e.title, path: researchPath(e) }];

/** The newest `updated` day in the registry: the hub’s "updated" line and its dateModified. */
export const newestResearchDay = (): string => RESEARCH.map((e) => e.updated).sort().pop() ?? '';

/** The other research pages, for the links at the foot of an article. */
export const siblingsOf = (e: ResearchEntry): ResearchEntry[] => RESEARCH.filter((x) => x.slug !== e.slug);

/** Whole months between two ISO days, in UTC ("8 Aug 2025 – 23 Sep 2026" is 13). */
export function monthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`);
  const b = new Date(`${toIso}T00:00:00Z`);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m -= 1;
  return Math.max(0, m);
}
