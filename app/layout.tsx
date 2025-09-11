import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Stupid Meter - AI Model Performance Monitoring | Real-Time Intelligence Tracking',
    template: '%s | Stupid Meter - AI Performance Monitor'
  },
  description: 'The first AI intelligence degradation detection system. Monitor OpenAI GPT, Claude, Grok, and Gemini models in real-time. Track performance drops, coding ability, and model quality changes with mathematical precision.',
  keywords: [
    'AI model monitoring',
    'AI performance tracking', 
    'OpenAI monitoring',
    'Claude performance',
    'Grok tracking',
    'Gemini monitoring',
    'AI intelligence degradation',
    'AI model benchmarking',
    'machine learning monitoring',
    'AI quality tracking',
    'model performance metrics',
    'AI regression detection',
    'coding AI evaluation',
    'LLM performance tracking',
    'AI model comparison',
    'artificial intelligence monitoring',
    'model degradation detection',
    'AI capability tracking',
    'GPT performance monitor',
    'Claude benchmark',
    'AI model analytics'
  ],
  authors: [{ name: 'The Architect', url: 'https://x.com/GOATGameDev' }],
  creator: 'Studio Platforms',
  publisher: 'Studio Platforms',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://stupidmeter.ai'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://stupidmeter.ai',
    title: 'Stupid Meter - AI Model Performance Monitoring',
    description: 'The first real-time AI intelligence degradation detection system. Track OpenAI, Anthropic, xAI, and Google AI models with mathematical precision.',
    siteName: 'Stupid Meter',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Stupid Meter - AI Model Performance Dashboard'
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stupid Meter - AI Model Performance Monitoring',
    description: 'The first real-time AI intelligence degradation detection system. Monitor AI model performance with mathematical precision.',
    creator: '@GOATGameDev',
    images: ['/twitter-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
  category: 'technology',
  classification: 'AI Tools',
  referrer: 'origin-when-cross-origin',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#00ff41" />
        <meta name="color-scheme" content="dark" />
        
        {/* Structured Data for AI/Search Engines */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Stupid Meter",
              "applicationCategory": "DeveloperApplication",
              "operatingSystem": "Web",
              "description": "The first AI intelligence degradation detection system for monitoring OpenAI, Anthropic, xAI, and Google AI models in real-time.",
              "url": "https://stupidmeter.ai",
              "author": {
                "@type": "Person",
                "name": "The Architect",
                "url": "https://x.com/GOATGameDev"
              },
              "publisher": {
                "@type": "Organization",
                "name": "Studio Platforms",
                "url": "https://stupidmeter.ai"
              },
              "softwareVersion": "1.0.0",
              "datePublished": "2025-01-06",
              "dateModified": new Date().toISOString().split('T')[0],
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "featureList": [
                "Real-time AI model performance monitoring",
                "7-axis scoring methodology", 
                "Mathematical drift detection with CUSUM algorithms",
                "OpenAI GPT monitoring",
                "Anthropic Claude tracking",
                "xAI Grok performance metrics",
                "Google Gemini monitoring",
                "API key testing functionality",
                "Historical performance analysis",
                "Automated regression detection"
              ],
              "screenshot": "https://stupidmeter.ai/screenshot.png",
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "5.0",
                "ratingCount": "1",
                "bestRating": "5",
                "worstRating": "1"
              }
            })
          }}
        />
        
        {/* Additional meta tags for AI discovery */}
        <meta name="ai-content-classification" content="ai-monitoring-tool" />
        <meta name="model-types" content="OpenAI,Claude,Grok,Gemini,GPT,LLM" />
        <meta name="functionality" content="performance-monitoring,benchmarking,regression-detection" />
        
        {/* Favicon and app icons */}
        <link rel="icon" href="/smlogo.png" />
        <link rel="apple-touch-icon" href="/smlogo.png" />
        <link rel="shortcut icon" href="/smlogo.png" />
        
        {/* Preload critical resources */}
        <link rel="preload" href="/styles/vintage.css" as="style" />
      </head>
      <body>{children}</body>
    </html>
  )
}
