import type { Metadata } from 'next';

/**
 * Metadata and JSON-LD helpers for the server-rendered SEO pages (model, vendor, pair, best,
 * getting-worse, status and research pages). Server-safe: no React, no hooks, no fetch.
 *
 * Rules these helpers enforce so the pages cannot drift from each other:
 *   - one title shape: "<page title> | AI Stupid Level", set as an absolute title so the root
 *     layout's long template never applies;
 *   - every page ships a complete openGraph and twitter object, image included (Next merges
 *     metadata shallowly per key, so a page that sets openGraph without images loses og:image);
 *   - the organisation is only ever referenced by id ({ "@id": ORG_ID }); the node itself is
 *     declared once, in app/layout.tsx;
 *   - dates are written from fixed month arrays in UTC, never toLocaleDateString, so the server
 *     and the browser render the same text.
 */

export const SITE = 'https://aistupidlevel.info';
export const SITE_NAME = 'AI Stupid Level';
export const ORG_ID = `${SITE}/#org`;
export const WEBSITE_ID = `${SITE}/#website`;
export const TWITTER_SITE = '@AIStupidlevel';
export const TITLE_SUFFIX = ' | AI Stupid Level';
/** Google shows about 60 characters of a title; the suffix is 17 of them. */
export const TITLE_MAX = 60;
export const DESC_MIN = 120;
export const DESC_MAX = 155;

export const OG_IMAGE = {
  url: `${SITE}/api/og?type=rankings`,
  width: 1200,
  height: 630,
  alt: 'AI Stupid Level: the continuous LLM benchmark leaderboard',
};

export interface PageMetaInput {
  /** Without the " | AI Stupid Level" suffix; at most 42 characters so the whole title fits in 60. */
  title: string;
  /** 120–155 characters. */
  description: string;
  /** Canonical path, e.g. "/models/openai". */
  path: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  keywords?: string[];
  /** ISO dates; only used when type is "article". */
  publishedTime?: string;
  modifiedTime?: string;
}

const dev = process.env.NODE_ENV !== 'production';

/** The page's Metadata object: absolute title, canonical, full openGraph and twitter, robots. */
export function pageMeta(input: PageMetaInput): Metadata {
  const title = input.title.trim();
  // The brand suffix is dropped only when it alone would push the title past the limit: a pair
  // of long live model names ("DeepSeek V4.1 Flash vs Gemini 3.5 Flash Lite") cannot be shortened.
  const withBrand = `${title}${TITLE_SUFFIX}`;
  const full = withBrand.length > TITLE_MAX && title.length <= TITLE_MAX ? title : withBrand;
  const description = input.description.trim();
  const url = `${SITE}${input.path}`;
  if (dev) {
    if (full.length > TITLE_MAX) console.warn(`[seo] title is ${full.length} chars (max ${TITLE_MAX}): "${full}"`);
    if (description.length < DESC_MIN || description.length > DESC_MAX) {
      console.warn(`[seo] description is ${description.length} chars (want ${DESC_MIN}–${DESC_MAX}) for ${input.path}`);
    }
  }
  const og = { url, title, description, siteName: SITE_NAME, locale: 'en_US', images: [OG_IMAGE] };
  return {
    title: { absolute: full },
    description,
    ...(input.keywords?.length ? { keywords: input.keywords } : {}),
    alternates: { canonical: input.path },
    openGraph: input.type === 'article'
      ? { ...og, type: 'article', ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}), ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}) }
      : { ...og, type: 'website' },
    twitter: { card: 'summary_large_image', site: TWITTER_SITE, title, description, images: [OG_IMAGE.url] },
    robots: input.noindex ? { index: false, follow: true } : { index: true, follow: true },
  };
}

/* ───────────────────────── JSON-LD ───────────────────────── */

/** Markdown links ("[label](/path)") to their label, whitespace collapsed: JSON-LD text is plain. */
export function ldText(s: string): string {
  return s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
}

export function breadcrumbLd(items: { name: string; path: string }[]): object {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${SITE}${it.path}`,
    })),
  };
}

/** FAQPage from the same strings the page shows. Only use it where the Q&As are visible. */
export function faqLd(qas: { q: string; a: string }[]): object {
  return {
    '@type': 'FAQPage',
    mainEntity: qas.map((qa) => ({
      '@type': 'Question',
      name: ldText(qa.q),
      acceptedAnswer: { '@type': 'Answer', text: ldText(qa.a) },
    })),
  };
}

export type WebPageType = 'WebPage' | 'CollectionPage' | 'FAQPage' | 'TechArticle' | 'Article' | 'ScholarlyArticle';
const ARTICLE_TYPES: WebPageType[] = ['TechArticle', 'Article', 'ScholarlyArticle'];

export function webPageLd(p: {
  path: string;
  name: string;
  description: string;
  datePublished?: string;
  dateModified?: string;
  type?: WebPageType;
  about?: object;
}): object {
  const url = `${SITE}${p.path}`;
  const type = p.type ?? 'WebPage';
  const article = ARTICLE_TYPES.includes(type);
  return {
    '@type': type,
    '@id': url,
    url,
    name: p.name,
    ...(article ? { headline: p.name, author: { '@id': ORG_ID }, mainEntityOfPage: url, image: OG_IMAGE.url } : {}),
    description: p.description,
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', '@id': WEBSITE_ID },
    publisher: { '@id': ORG_ID },
    ...(p.datePublished ? { datePublished: p.datePublished } : {}),
    ...(p.dateModified ? { dateModified: p.dateModified } : {}),
    ...(p.about ? { about: p.about } : {}),
  };
}

/**
 * An ItemList of pages. `position` is the item's place in this list as rendered, which is
 * board order; it is not a rank claim (ranks carry statistical ties and live in the page text).
 */
export function itemListLd(p: { name: string; items: { name: string; url: string }[] }): object {
  return {
    '@type': 'ItemList',
    name: p.name,
    numberOfItems: p.items.length,
    itemListElement: p.items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: it.url.startsWith('http') ? it.url : `${SITE}${it.url}`,
    })),
  };
}

export function graphLd(nodes: object[]): object {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

/* ───────────────────────── dates ───────────────────────── */

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A usable Date from a Date, an ISO string or the API's "YYYY-MM-DD HH:MM:SS" (UTC, no zone); now when unparseable. */
export function toDate(d: Date | string | number | null | undefined): Date {
  if (d instanceof Date) return isNaN(d.getTime()) ? new Date() : d;
  if (typeof d === 'number') return isNaN(new Date(d).getTime()) ? new Date() : new Date(d);
  if (typeof d === 'string' && d) {
    const s = d.trim();
    const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s) ? s.replace(' ', 'T') + 'Z' : s;
    const t = new Date(iso);
    if (!isNaN(t.getTime())) return t;
  }
  return new Date();
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "October 2026", in UTC. */
export function monthLabel(d: Date | string | number | null | undefined): string {
  const t = toDate(d);
  return `${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
}

/** "23 Oct 2026", in UTC. */
export function dayLabel(d: Date | string | number | null | undefined): string {
  const t = toDate(d);
  return `${t.getUTCDate()} ${MONTHS_SHORT[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
}

/** "23 Oct 2026, 16:20 UTC". */
export function utcStamp(d: Date | string | number | null | undefined): string {
  const t = toDate(d);
  return `${dayLabel(t)}, ${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())} UTC`;
}

/** "2026-10-23", for dateModified and the sitemap. */
export function isoDay(d: Date | string | number | null | undefined): string {
  return toDate(d).toISOString().slice(0, 10);
}

/**
 * A description cut at a word boundary to `max` characters. The cut never leaves a dangling
 * comma, dash or opening bracket, and ends the text with a full stop.
 */
export function clampDesc(s: string, max = DESC_MAX): string {
  const text = s.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  let cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  if (space > max * 0.6) cut = cut.slice(0, space);
  cut = cut.replace(/[\s,;:–—\-(\[{"'`]+$/g, '');
  return /[.!?]$/.test(cut) ? cut : `${cut}.`;
}
