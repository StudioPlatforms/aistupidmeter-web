import type { Metadata } from 'next';

type Props = {
  params: { type: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type } = params;
  const baseUrl = 'https://aistupidlevel.info';
  // Add timestamp to bust Twitter cache
  const ogImageUrl = `${baseUrl}/api/og?type=${encodeURIComponent(type)}&v=${Date.now()}`;
  
  // Fetch live data for description
  let description = 'Real-time AI model performance monitoring';
  try {
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? 'https://aistupidlevel.info' 
      : 'http://localhost:4000';
    
    const response = await fetch(`${apiUrl}/dashboard/cached?period=latest&sortBy=combined&analyticsPeriod=latest`, {
      cache: 'no-store' // Don't cache this request
    });
    const data = await response.json();
    
    if (data.success && data.data) {
      const { modelScores } = data.data;
      const criticalModels = modelScores.filter((m: any) => m.currentScore < 50);
      
      if (criticalModels.length > 0) {
        description = `🚨 ALERT: ${criticalModels.length} AI models below 50 points! ${criticalModels.slice(0, 3).map((m: any) => `${m.name}: ${m.currentScore} pts`).join(' • ')}`;
      } else {
        const top3 = modelScores.slice(0, 3);
        description = `🏆 Top AI Models: ${top3.map((m: any, i: number) => `#${i + 1} ${m.name} (${m.currentScore} pts)`).join(' • ')}`;
      }
    }
  } catch (error) {
    console.error('Failed to fetch data for meta:', error);
  }
  
  return {
    metadataBase: new URL(baseUrl),
    title: 'AI Model Rankings - Live Performance Scores | AI Stupid Level',
    description,
    openGraph: {
      type: 'website',
      url: `${baseUrl}/share/${encodeURIComponent(type)}`,
      title: 'AI Model Rankings - Live Performance Scores',
      description,
      siteName: 'AI Stupid Level',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: 'AI Model Rankings - Live Performance Scores'
        }
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'AI Model Rankings - Live Performance Scores',
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
