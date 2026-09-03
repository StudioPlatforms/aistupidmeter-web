import type { Metadata } from 'next';

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type } = params;
  const baseUrl = 'https://aistupidlevel.info';
  // No &v=Date.now() cache-buster: it made every crawl a unique URL, so the card
  // could never be cached and Next re-rendered the PNG for every single hit. The
  // route now sends its own 5-minute Cache-Control instead.
  const ogImageUrl = `${baseUrl}/api/og?type=${encodeURIComponent(type)}`;

  // Fetch live data for description
  let description = 'Real-time AI model performance monitoring';
  try {
    // /dashboard/scores is ~7KB; /dashboard/cached is ~855KB and 99% of it is
    // historyMap, which nothing here reads.
    // 6s, not 2.5s: the dashboard routes take 4.3-4.8s on a cold SQLite cache
    // (first hit after a restart), and a 2.5s budget silently fell back to the
    // generic description — which is the exact failure this fix was for.
    const response = await fetch(`${API_INTERNAL}/dashboard/scores?period=latest&sortBy=combined`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 60 },
    });
    const data = await response.json();

    const modelScores = Array.isArray(data?.data) ? data.data : [];
    if (modelScores.length > 0) {
      const criticalModels = modelScores.filter((m: any) => typeof m.currentScore === 'number' && m.currentScore < 50);

      if (criticalModels.length > 0) {
        description = `Alert: ${criticalModels.length} AI models scoring below 50. ${criticalModels.slice(0, 3).map((m: any) => `${m.name}: ${m.currentScore}`).join(' • ')}`;
      } else {
        const top3 = modelScores.slice(0, 3);
        description = `Top AI models right now: ${top3.map((m: any, i: number) => `#${i + 1} ${m.name} (${m.currentScore})`).join(' • ')}`;
      }
    }
  } catch (error) {
    console.error('Failed to fetch data for meta:', error);
  }

  // The title used to say "AI Model Rankings" for every type, so an /share/alert
  // link promised a degradation and titled itself a leaderboard. Match the card.
  const TITLES: Record<string, string> = {
    rankings: 'Live AI model leaderboard — independently scored',
    index: 'Global AI performance index — live benchmark scores',
    alert: 'AI model performance degradation detected',
    winner: 'The top-scoring AI model right now',
  };
  const title = TITLES[type] || TITLES.rankings;

  return {
    metadataBase: new URL(baseUrl),
    title: `${title} | AI Stupid Level`,
    description,
    openGraph: {
      type: 'website',
      url: `${baseUrl}/share/${encodeURIComponent(type)}`,
      title,
      description,
      siteName: 'AI Stupid Level',
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
      creator: '@AIStupidlevel',
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Google Analytics */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  
                  // Set default consent mode BEFORE gtag initialization
                  gtag('consent', 'default', {
                    'analytics_storage': 'granted',
                    'ad_storage': 'denied',
                    'ad_user_data': 'denied',
                    'ad_personalization': 'denied',
                    'wait_for_update': 500
                  });
                  
                  gtag('js', new Date());
                  
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
                    anonymize_ip: true,
                    allow_google_signals: false,
                    allow_ad_personalization_signals: false,
                    cookie_flags: 'SameSite=None;Secure'
                  });
                `,
              }}
            />
          </>
        )}
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
