import type { MetadataRoute } from 'next';
import pageDates from './page-dates.json';
import { RESEARCH, researchPath } from './research-index';
import { SITE } from './seo';
import { curatedPairs, lastUpdatedOf, pairSlug, type SeoBoards, type SeoModel } from './seo-data';

/**
 * The route registry: every indexable static URL with the file that renders it, plus the
 * generators for the data-driven families (model, pair, research). app/sitemap.ts composes these;
 * scripts/page-dates.js reads STATIC_ROUTES (path/file pairs) to write lib/page-dates.json, the
 * last commit date per page, which pageDate() serves as the sitemap's lastmod. A page whose date
 * is unknown gets no lastmod rather than a fake one: a wrong lastmod on every URL is what trains a
 * crawler to ignore the field.
 *
 * Not listed on purpose: /router/forum (user content), /welcome, /share, /watchlist, /drift-test,
 * /account/*, /admin, /auth/*, and the signed-in /router/* tools.
 */

export type ChangeFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RouteFamily = 'core' | 'router' | 'best' | 'worse' | 'status' | 'vendor' | 'research';

export interface StaticRoute {
  path: string;
  /** Repo-relative file that renders the path (for the commit-date script). Keep `path` and `file` adjacent. */
  file: string;
  changeFrequency: ChangeFrequency;
  priority: number;
  family: RouteFamily;
}

export type SitemapEntry = MetadataRoute.Sitemap[number];

export const STATIC_ROUTES: StaticRoute[] = [
  // core
  { path: '/', file: 'app/page.tsx', changeFrequency: 'hourly', priority: 1.0, family: 'core' },
  { path: '/compare', file: 'app/compare/page.tsx', changeFrequency: 'daily', priority: 0.9, family: 'core' },
  { path: '/models', file: 'app/models/page.tsx', changeFrequency: 'daily', priority: 0.8, family: 'core' },
  { path: '/leaderboard', file: 'app/leaderboard/page.tsx', changeFrequency: 'hourly', priority: 0.9, family: 'core' },
  { path: '/zh', file: 'app/zh/page.tsx', changeFrequency: 'daily', priority: 0.6, family: 'core' },
  { path: '/ai-drift-detection', file: 'app/ai-drift-detection/page.tsx', changeFrequency: 'daily', priority: 0.9, family: 'worse' },
  { path: '/ai-degradation-tracker', file: 'app/ai-degradation-tracker/page.tsx', changeFrequency: 'hourly', priority: 0.9, family: 'worse' },
  { path: '/methodology', file: 'app/methodology/page.tsx', changeFrequency: 'monthly', priority: 0.8, family: 'core' },
  { path: '/faq', file: 'app/faq/page.tsx', changeFrequency: 'monthly', priority: 0.8, family: 'core' },
  { path: '/about', file: 'app/about/page.tsx', changeFrequency: 'monthly', priority: 0.7, family: 'core' },
  { path: '/pricing', file: 'app/pricing/page.tsx', changeFrequency: 'monthly', priority: 0.8, family: 'core' },
  { path: '/api-docs', file: 'app/api-docs/page.tsx', changeFrequency: 'monthly', priority: 0.8, family: 'core' },
  { path: '/context-rot', file: 'app/context-rot/page.tsx', changeFrequency: 'monthly', priority: 0.7, family: 'core' },
  { path: '/docs/teams', file: 'app/docs/teams/page.tsx', changeFrequency: 'monthly', priority: 0.6, family: 'core' },
  { path: '/assessment', file: 'app/assessment/page.tsx', changeFrequency: 'monthly', priority: 0.6, family: 'core' },
  { path: '/contact', file: 'app/contact/page.tsx', changeFrequency: 'yearly', priority: 0.4, family: 'core' },
  { path: '/privacy', file: 'app/privacy/page.tsx', changeFrequency: 'yearly', priority: 0.3, family: 'core' },
  { path: '/terms', file: 'app/terms/page.tsx', changeFrequency: 'yearly', priority: 0.3, family: 'core' },
  // Smart Router (public surfaces only)
  { path: '/router', file: 'app/router/page.tsx', changeFrequency: 'weekly', priority: 0.8, family: 'router' },
  { path: '/router/docs', file: 'app/router/docs/page.tsx', changeFrequency: 'weekly', priority: 0.7, family: 'router' },
  { path: '/router/help', file: 'app/router/help/page.tsx', changeFrequency: 'monthly', priority: 0.6, family: 'router' },
  { path: '/router/integrations', file: 'app/router/integrations/page.tsx', changeFrequency: 'weekly', priority: 0.7, family: 'router' },
  { path: '/ai-router', file: 'app/ai-router/page.tsx', changeFrequency: 'weekly', priority: 0.8, family: 'router' },
  { path: '/ai-aggregator', file: 'app/ai-aggregator/page.tsx', changeFrequency: 'weekly', priority: 0.8, family: 'router' },
  { path: '/best-ai-router', file: 'app/best-ai-router/page.tsx', changeFrequency: 'weekly', priority: 0.8, family: 'router' },
  { path: '/openrouter-alternatives', file: 'app/openrouter-alternatives/page.tsx', changeFrequency: 'weekly', priority: 0.8, family: 'router' },
  // best-for pages (hub first)
  { path: '/best-ai-model', file: 'app/best-ai-model/page.tsx', changeFrequency: 'daily', priority: 0.9, family: 'best' },
  { path: '/best-llm-for-coding', file: 'app/best-llm-for-coding/page.tsx', changeFrequency: 'daily', priority: 0.8, family: 'best' },
  { path: '/best-llm-for-reasoning', file: 'app/best-llm-for-reasoning/page.tsx', changeFrequency: 'daily', priority: 0.8, family: 'best' },
  { path: '/best-ai-model-for-agents', file: 'app/best-ai-model-for-agents/page.tsx', changeFrequency: 'daily', priority: 0.8, family: 'best' },
  { path: '/best-value-ai-model', file: 'app/best-value-ai-model/page.tsx', changeFrequency: 'daily', priority: 0.8, family: 'best' },
  { path: '/fastest-ai-model', file: 'app/fastest-ai-model/page.tsx', changeFrequency: 'daily', priority: 0.8, family: 'best' },
  // "is X getting worse" pages (hub first)
  { path: '/is-ai-getting-worse', file: 'app/is-ai-getting-worse/page.tsx', changeFrequency: 'daily', priority: 0.9, family: 'worse' },
  { path: '/is-chatgpt-getting-worse', file: 'app/is-chatgpt-getting-worse/page.tsx', changeFrequency: 'daily', priority: 0.8, family: 'worse' },
  { path: '/is-claude-getting-worse', file: 'app/is-claude-getting-worse/page.tsx', changeFrequency: 'daily', priority: 0.8, family: 'worse' },
  { path: '/is-gemini-getting-worse', file: 'app/is-gemini-getting-worse/page.tsx', changeFrequency: 'daily', priority: 0.8, family: 'worse' },
  { path: '/is-deepseek-getting-worse', file: 'app/is-deepseek-getting-worse/page.tsx', changeFrequency: 'daily', priority: 0.8, family: 'worse' },
  // provider status (hub first); per-provider pages live under /status, never /providers (nginx owns that prefix)
  { path: '/status', file: 'app/status/page.tsx', changeFrequency: 'hourly', priority: 0.8, family: 'status' },
  { path: '/status/openai', file: 'app/status/[provider]/page.tsx', changeFrequency: 'hourly', priority: 0.7, family: 'status' },
  { path: '/status/anthropic', file: 'app/status/[provider]/page.tsx', changeFrequency: 'hourly', priority: 0.7, family: 'status' },
  { path: '/status/google', file: 'app/status/[provider]/page.tsx', changeFrequency: 'hourly', priority: 0.7, family: 'status' },
  { path: '/status/deepseek', file: 'app/status/[provider]/page.tsx', changeFrequency: 'hourly', priority: 0.7, family: 'status' },
  { path: '/status/kimi', file: 'app/status/[provider]/page.tsx', changeFrequency: 'hourly', priority: 0.7, family: 'status' },
  { path: '/status/glm', file: 'app/status/[provider]/page.tsx', changeFrequency: 'hourly', priority: 0.7, family: 'status' },
  // vendor pages (rendered by app/models/[id]/page.tsx through components/seo/vendor/VendorPage.tsx; dated by that file)
  { path: '/models/openai', file: 'components/seo/vendor/VendorPage.tsx', changeFrequency: 'daily', priority: 0.8, family: 'vendor' },
  { path: '/models/anthropic', file: 'components/seo/vendor/VendorPage.tsx', changeFrequency: 'daily', priority: 0.8, family: 'vendor' },
  { path: '/models/google', file: 'components/seo/vendor/VendorPage.tsx', changeFrequency: 'daily', priority: 0.8, family: 'vendor' },
  { path: '/models/deepseek', file: 'components/seo/vendor/VendorPage.tsx', changeFrequency: 'daily', priority: 0.8, family: 'vendor' },
  { path: '/models/kimi', file: 'components/seo/vendor/VendorPage.tsx', changeFrequency: 'daily', priority: 0.8, family: 'vendor' },
  { path: '/models/glm', file: 'components/seo/vendor/VendorPage.tsx', changeFrequency: 'daily', priority: 0.8, family: 'vendor' },
  // research hub; the articles come from lib/research-index.ts
  { path: '/research', file: 'app/research/page.tsx', changeFrequency: 'weekly', priority: 0.7, family: 'research' },
];

export const STATIC_PATHS = new Set(STATIC_ROUTES.map((r) => r.path));

/** Research articles, re-exported so the sitemap and the index read one registry. */
export const RESEARCH_ARTICLES = RESEARCH;

/**
 * Tool slugs of /router/integrations/<tool>: the same list as INTEGRATIONS in lib/integrations.ts
 * (the hub warns in development when the two differ).
 */
export const ROUTER_INTEGRATIONS: string[] = [
  'claude-code', 'cursor', 'cline', 'continue', 'aider', 'opencode', 'n8n', 'langchain', 'zed', 'open-webui', 'librechat',
];

/** The last commit date of the page at `path` (lib/page-dates.json), or undefined when unknown. */
export function pageDate(path: string): Date | undefined {
  const iso = (pageDates as Record<string, string>)[path];
  if (!iso) return undefined;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? undefined : d;
}

const entryOf = (r: StaticRoute): SitemapEntry => {
  const lastModified = pageDate(r.path);
  return {
    url: `${SITE}${r.path}`,
    ...(lastModified ? { lastModified } : {}),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  };
};

export const routesOf = (family: RouteFamily): SitemapEntry[] =>
  STATIC_ROUTES.filter((r) => r.family === family).map(entryOf);

/** The hand-written pages: core and the public Smart Router pages. */
export const staticRoutes = (): SitemapEntry[] => [...routesOf('core'), ...routesOf('router')];
export const bestRoutes = (): SitemapEntry[] => routesOf('best');
export const worseRoutes = (): SitemapEntry[] => routesOf('worse');
export const statusRoutes = (): SitemapEntry[] => routesOf('status');
export const vendorRoutes = (): SitemapEntry[] => routesOf('vendor');

export function researchRoutes(): SitemapEntry[] {
  return [
    ...routesOf('research'),
    ...RESEARCH.map((e): SitemapEntry => ({
      url: `${SITE}${researchPath(e)}`,
      lastModified: new Date(`${e.updated}T00:00:00Z`),
      changeFrequency: 'monthly',
      priority: 0.7,
    })),
  ];
}

const dateOf = (iso: string | null): Date | undefined => {
  if (!iso) return undefined;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? undefined : d;
};

/** One entry per model page; lastmod is the model's newest score on the 24-hour boards. */
export function modelRoutes(roster: SeoModel[], boards: SeoBoards | null): SitemapEntry[] {
  const seen = new Set<string>();
  const out: SitemapEntry[] = [];
  for (const m of roster) {
    if (!m.slug || seen.has(m.slug)) continue;
    seen.add(m.slug);
    const lastModified = dateOf(boards?.byId[m.id]?.combined?.lastUpdated ?? lastUpdatedOf(boards, m.id));
    out.push({ url: `${SITE}/models/${m.slug}`, ...(lastModified ? { lastModified } : {}), changeFrequency: 'daily', priority: 0.7 });
  }
  return out;
}

/** The curated pair pages; lastmod is the newer of the two models' newest scores. */
export function pairRoutes(roster: SeoModel[], boards: SeoBoards | null): SitemapEntry[] {
  return curatedPairs(roster, boards).map(([a, b]): SitemapEntry => {
    const ts = [lastUpdatedOf(boards, a.id), lastUpdatedOf(boards, b.id)].filter((t): t is string => !!t).sort().pop() ?? null;
    const lastModified = dateOf(ts);
    return { url: `${SITE}/compare/${pairSlug(a, b)}`, ...(lastModified ? { lastModified } : {}), changeFrequency: 'daily', priority: 0.6 };
  });
}

export const integrationRoutes = (tools: string[] = ROUTER_INTEGRATIONS): SitemapEntry[] =>
  tools.map((t): SitemapEntry => ({ url: `${SITE}/router/integrations/${t}`, changeFrequency: 'monthly', priority: 0.6 }));

/** Every sitemap entry, in family order, each URL once. Works with an empty roster and null boards. */
export function allRoutes(roster: SeoModel[], boards: SeoBoards | null): SitemapEntry[] {
  const all = [
    ...staticRoutes(),
    ...bestRoutes(),
    ...worseRoutes(),
    ...vendorRoutes(),
    ...statusRoutes(),
    ...researchRoutes(),
    ...integrationRoutes(),
    ...modelRoutes(roster, boards),
    ...pairRoutes(roster, boards),
  ];
  const seen = new Set<string>();
  return all.filter((e) => (seen.has(e.url) ? false : (seen.add(e.url), true)));
}
