import type { Metadata } from 'next';
import { buildBoard } from '@/lib/boards-core';
import { DESC_MAX, SITE, SITE_NAME, TWITTER_SITE, clampDesc } from '@/lib/seo';

type Props = {
  params: { type: string }
}

// Server-side code needs an ABSOLUTE url. This file used to build
// `${'' }/dashboard/cached?...` in production, which throws "URL is malformed",
// so the catch below swallowed it and every share page shipped the hardcoded
// fallback description — the live-data branch had never once run in production.
// Same class of bug as app/api/og/route.tsx; see the long note in that file.
// 127.0.0.1 rather than localhost: the API binds IPv4 only.
const API_INTERNAL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

// Used only when the API cannot answer; the cadence is the scheduler's, not "every hour".
const FALLBACK = 'Independent AI model benchmarks, re-tested on a fixed schedule: coding every four hours, reasoning and tool use daily, with an hourly canary probe.';

// Titles match the card the OG route draws for each type; the root template adds the brand.
// Visitor-facing figures are the 24-hour board (the newest run is a paid view).
const TITLES: Record<string, string> = {
  rankings: 'AI model leaderboard, last 24 hours',
  index: 'Global AI performance index',
  alert: 'AI model performance drop detected',
  winner: 'The top-scoring AI model, last 24 hours',
};

// Search engines cut a description at about 155 characters, so the first wording that fits is used;
// if none fits (long model names), the last one is clamped at a word boundary.
const fit = (candidates: string[]): string =>
  candidates.find((c) => c.length <= DESC_MAX) ?? clampDesc(candidates[candidates.length - 1]);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type } = params;
  const safeType = encodeURIComponent(type);
  // No &v=Date.now() cache-buster: it made every crawl a unique URL, so the card
  // could never be cached and Next re-rendered the PNG for every single hit. The
  // route now sends its own 5-minute Cache-Control instead.
  const ogImageUrl = `${SITE}/api/og?type=${safeType}`;

  let description = FALLBACK;
  try {
    // The 24-hour combined board, built with lib/boards-core so the places and statistical ties
    // are the leaderboard's own ("=2" when two models share second); never index + 1.
    // 6s, not 2.5s: the dashboard routes take 4.3-4.8s on a cold SQLite cache
    // (first hit after a restart), and a shorter budget silently fell back to the
    // generic description — which is the exact failure this fix was for.
    const response = await fetch(`${API_INTERNAL}/dashboard/boards?period=24h`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 60 },
    });
    const json = response.ok ? await response.json() : null;
    const rows = Array.isArray(json?.data?.combined) ? json.data.combined : [];

    if (rows.length > 0) {
      const board = buildBoard('combined', rows);
      const everyRow = [...board.ranked, ...board.community, ...board.other];
      const critical = everyRow.filter((r) => r.score !== null && r.score < 50);

      if (critical.length > 0) {
        const named = (n: number) => critical.slice(0, n).map((r) => `${r.label}: ${r.score}`).join(' · ');
        description = fit([3, 2, 1].map((n) => `Alert: ${critical.length} AI models scoring below 50 on the combined board over the last 24 hours. ${named(n)}.`));
      } else if (board.ranked.length > 0) {
        const top = (n: number) => board.ranked.slice(0, n).map((r) => `${r.rankText} ${r.label} (${r.score})`).join(' · ');
        description = fit([
          `Top of the combined board over the last 24 hours: ${top(3)}. Models whose lead is inside the noise share a place.`,
          `Top of the combined board over the last 24 hours: ${top(3)}. Tied places share a rank.`,
          `Top of the combined board over the last 24 hours: ${top(2)}. Tied places share a rank.`,
        ]);
      }
    }
  } catch (error) {
    console.error('Failed to fetch data for meta:', error);
  }

  const title = TITLES[type] || TITLES.rankings;

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: `${SITE}/share/${safeType}`,
      title,
      description,
      siteName: SITE_NAME,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title
        }
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
      creator: TWITTER_SITE,
      site: TWITTER_SITE,
    },
    // An interstitial that forwards to the home page: not a page to index. Twitterbot and
    // facebookexternalhit still read the og:* tags on a noindex page.
    robots: {
      index: false,
      follow: true,
    },
  };
}

// The root layout already renders <html>, <head> and <body>, and loads Google Analytics with
// consent denied by default. This used to render a second document around the page, with its own
// gtag snippet that granted analytics storage without consent.
export default function ShareLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>;
}
