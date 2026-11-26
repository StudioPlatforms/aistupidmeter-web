import { MetadataRoute } from 'next';

/**
 * ONE rule set, shared by every crawler.
 *
 * Until 2026-10-30 this file gave Googlebot, Bingbot and the AI crawlers groups of their own
 * that said only "Allow: /". A crawler obeys the single group that names it most specifically
 * and ignores the rest, so none of the disallows below ever applied to them: Googlebot spent
 * ~1,300 requests in two weeks on /api/ (401s from paid and keyed endpoints showed up in Search
 * Console as "Blocked due to unauthorized request") and ~1,100 on the visit tracker. Listing the
 * agents in the same group keeps them explicitly welcome AND bound by the same rules.
 *
 * Allowed on purpose:
 * - '/api/og' and '/share/': Twitterbot and facebookexternalhit honour robots.txt and must reach
 *   the Open Graph card and the share pages, or link previews break.
 * - '/api/models/' and '/api/drift/': the public JSON the model pages load in the browser. Google
 *   renders pages with their scripts; blocking data a page needs to render is what Google asks
 *   sites not to do. ('/dashboard/' is outside /api/ and stays allowed for the same reason.)
 * - '/auth/' is NOT disallowed: the sign-in pages carry a noindex (app/auth/layout.tsx), which a
 *   crawler can only read if it may fetch them.
 * Longer, more specific paths win over shorter ones, so each allow survives '/api/', and the two
 * paid paths under the allowed prefixes are disallowed again by their longer rules.
 *
 * '_rsc' (2026-11-26): the address the app's own router asks for when it prefetches a link
 * (/models/x?_rsc=abc12). Google's renderer runs that script and then crawls those addresses as if
 * they were pages; each answers with the page again, a duplicate that spends crawl requests. The
 * page itself never needs them to render.
 *
 * No `host` line: it was a Yandex extension that Yandex dropped in 2018, and no crawler reads it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ['*', 'Googlebot', 'Bingbot', 'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'Claude-Web', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'],
        allow: ['/', '/api/og', '/api/models/', '/api/drift/', '/share/'],
        disallow: [
          '/api/',
          '/api/drift/cusum',
          '/api/models/*/calibration',
          '/api/models/*/substitutes',
          '/admin/',
          '/internal/',
          '/track-visit',
          '/v1/',
          '/*?_rsc=',
          '/*&_rsc=',
        ],
      },
    ],
    sitemap: 'https://aistupidlevel.info/sitemap.xml',
  };
}
