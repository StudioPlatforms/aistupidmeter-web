import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // '/api/og' and '/share/' are explicitly allowed BEFORE the disallows.
        // Twitterbot and facebookexternalhit honour robots.txt, and a blanket
        // 'Disallow: /api/' meant they were not permitted to fetch the Open
        // Graph card at all — the share preview could only ever work on
        // Telegram, which ignores robots.txt. '/share/' is the landing page
        // ShareButton links to, so it has to be crawlable for the same reason.
        // Longer, more specific paths win over shorter ones, so these two
        // survive the broader rules below.
        allow: ['/', '/api/og', '/share/'],
        disallow: [
          '/api/',
          '/auth/',
          '/admin/',
          '/internal/',
          '/drift-test/',
        ],
      },
      {
        userAgent: 'GPTBot',
        allow: '/',
      },
      {
        userAgent: 'ChatGPT-User',
        allow: '/',
      },
      {
        userAgent: 'Claude-Web',
        allow: '/',
      },
      {
        userAgent: 'Google-Extended',
        allow: '/',
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
      },
    ],
    sitemap: 'https://aistupidlevel.info/sitemap.xml',
    host: 'https://aistupidlevel.info',
  };
}
