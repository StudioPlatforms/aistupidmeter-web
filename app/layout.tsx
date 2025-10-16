import type { Metadata } from 'next'
import { Providers } from '../components/Providers'
import VisitorTracker from '../components/VisitorTracker'
import '../styles/vintage.css'

export const metadata: Metadata = {
  title: {
    default: 'AI Benchmark Tool - Best AI Models 2025 | AI Performance Tests & Rankings',
    template: '%s | AI Benchmark - Compare AI Models'
  },
  description: 'The ultimate AI benchmarking tool for 2025. Compare AI models, test AI performance, and find the best AI for coding. Real-time AI benchmark results, LLM performance tests, and AI model leaderboard with Claude vs GPT vs Gemini comparison.',
  keywords: [
    // Core Keywords (must-have)
    'AI benchmark',
    'AI benchmarking tool',
    'AI performance tests',
    'AI ranking',
    'AI score',
    'AI model leaderboard',
    'Best AI models 2025',
    'Compare AI models',
    'AI test suite',
    'AI evaluation',
    
    // Long-Tail Keywords
    'Which AI model is best for coding',
    'Claude vs GPT vs Gemini comparison',
    'Best AI for software development',
    'AI quality drift detection',
    'Measure AI performance',
    'AI refusals and stability tests',
    'Real-time AI scoring',
    'Open source AI benchmark tool',
    'AI benchmark results dashboard',
    
    // Technical / Developer Keywords
    'AI coding benchmark',
    'AI code generation test',
    'AI debugging benchmark',
    'AI optimization benchmark',
    'LLM benchmark',
    'LLM performance test',
    'Test AI models with your API key',
    'AI testing framework',
    
    // Legacy keywords for continuity
    'AI model monitoring',
    'AI performance tracking',
    'OpenAI monitoring',
    'Claude performance',
    'Grok tracking',
    'Gemini monitoring',
    'AI intelligence degradation',
    'AI model comparison',
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
    url: 'https://aistupidlevel.info',
    title: 'AI Benchmark Tool - Best AI Models 2025 | Compare Claude vs GPT vs Gemini',
    description: 'Ultimate AI benchmarking tool for 2025. Test AI performance, compare AI models, and find the best AI for coding. Real-time AI benchmark results and LLM performance tests.',
    siteName: 'AI Stupid Level - Benchmark Tool',
    images: [
      {
        url: 'https://aistupidlevel.info/api/og?type=rankings',
        width: 1200,
        height: 630,
        alt: 'AI Model Rankings - Live Performance Scores'
      },
      {
        url: '/stupidmetermeta.png',
        width: 1200,
        height: 630,
        alt: 'AI Benchmark Tool - Compare AI Models Performance Dashboard'
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Benchmark Tool - Best AI Models 2025 Rankings',
    description: 'Compare AI models with our comprehensive benchmarking tool. Test Claude vs GPT vs Gemini performance. Find the best AI for coding and development.',
    creator: '@AIStupidlevel',
    site: '@AIStupidlevel',
    images: ['https://aistupidlevel.info/api/og?type=rankings'],
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
        
        {/* Enhanced Structured Data for AI/Search Engines */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": ["WebApplication", "SoftwareApplication"],
              "name": "AI Benchmark Tool - Stupid Meter",
              "alternateName": ["AI Benchmarking Tool", "AI Performance Test", "AI Model Comparison Tool"],
              "applicationCategory": ["DeveloperApplication", "ProductivityApplication"],
              "operatingSystem": "Web",
              "description": "The ultimate AI benchmarking tool for 2025. Compare AI models, test AI performance, and find the best AI for coding. Features real-time AI benchmark results, LLM performance tests, and comprehensive AI model leaderboard.",
              "url": "https://stupidmeter.ai",
              "sameAs": [
                "https://github.com/StudioPlatforms/aistupidmeter-web",
                "https://www.reddit.com/r/AIStupidLevel/",
                "https://x.com/GOATGameDev"
              ],
              "author": {
                "@type": "Person",
                "name": "The Architect",
                "url": "https://x.com/GOATGameDev"
              },
              "publisher": {
                "@type": "Organization",
                "name": "Studio Platforms",
                "url": "https://stupidmeter.ai",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://stupidmeter.ai/smlogo.png"
                }
              },
              "softwareVersion": "1.0.0",
              "datePublished": "2025-01-06",
              "dateModified": new Date().toISOString().split('T')[0],
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock"
              },
              "featureList": [
                "AI benchmark testing and evaluation",
                "Real-time AI model performance monitoring",
                "AI model leaderboard and rankings",
                "Compare Claude vs GPT vs Gemini performance",
                "AI coding benchmark tests",
                "LLM performance evaluation",
                "AI debugging benchmark",
                "Test AI models with your API key",
                "AI quality drift detection",
                "7-axis AI scoring methodology",
                "Mathematical drift detection with CUSUM algorithms",
                "OpenAI GPT-5 and O3 monitoring",
                "Anthropic Claude Opus 4 tracking",
                "xAI Grok 4 performance metrics",
                "Google Gemini 2.5 monitoring",
                "Historical AI performance analysis",
                "Automated AI regression detection",
                "Open source AI benchmark tool"
              ],
              "keywords": "AI benchmark, AI benchmarking tool, AI performance tests, AI ranking, AI model leaderboard, best AI models 2025, compare AI models, Claude vs GPT vs Gemini, AI coding benchmark, LLM benchmark",
              "screenshot": "https://stupidmeter.ai/screenshot.png",
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "5.0",
                "ratingCount": "1",
                "bestRating": "5",
                "worstRating": "1"
              },
              "mainEntity": {
                "@type": "Dataset",
                "name": "AI Model Performance Benchmark Results",
                "description": "Comprehensive benchmark results for leading AI models including GPT, Claude, Grok, and Gemini",
                "keywords": "AI benchmark results, AI model comparison data, LLM performance metrics",
                "license": "https://creativecommons.org/licenses/by/4.0/",
                "creator": {
                  "@type": "Organization",
                  "name": "Studio Platforms"
                }
              }
            })
          }}
        />
        
        {/* Enhanced SEO meta tags for target keywords */}
        <meta name="ai-content-classification" content="ai-benchmarking-tool" />
        <meta name="model-types" content="OpenAI,Claude,Grok,Gemini,GPT,LLM,GPT-5,O3,Opus-4,Grok-4,Gemini-2.5" />
        <meta name="functionality" content="ai-benchmark,performance-testing,model-comparison,ai-evaluation" />
        <meta name="target-audience" content="developers,ai-researchers,software-engineers,data-scientists" />
        <meta name="use-cases" content="ai-model-selection,performance-comparison,coding-ai-evaluation,llm-benchmarking" />
        <meta name="benchmark-types" content="coding-benchmark,debugging-test,performance-evaluation,quality-assessment" />
        <meta name="supported-models" content="GPT-5,Claude-Opus-4,Grok-4,Gemini-2.5-Pro,O3,O3-Mini" />
        <meta name="comparison-features" content="Claude-vs-GPT,GPT-vs-Gemini,Grok-vs-Claude,AI-model-rankings" />
        
        {/* Additional keyword-rich meta tags */}
        <meta name="subject" content="AI Benchmark Tool, AI Model Comparison, LLM Performance Testing" />
        <meta name="abstract" content="Comprehensive AI benchmarking tool for 2025 featuring real-time performance tests, model comparisons, and coding benchmarks for GPT, Claude, Grok, and Gemini." />
        <meta name="topic" content="AI Benchmarking, Machine Learning Evaluation, LLM Performance Analysis" />
        <meta name="summary" content="Compare AI models with our advanced benchmarking tool. Test Claude vs GPT vs Gemini performance. Find the best AI for coding and software development." />
        <meta name="coverage" content="Worldwide" />
        <meta name="distribution" content="Global" />
        <meta name="rating" content="General" />
        <meta name="revisit-after" content="1 day" />
        
        {/* Favicon and app icons */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="shortcut icon" href="/favicon.png" />
        <meta name="msapplication-TileImage" content="/smlogo.png" />
        <meta name="msapplication-TileColor" content="#00ff41" />
        
        {/* Preload critical resources */}
        <link rel="preload" href="/styles/vintage.css" as="style" />
      </head>
      <body>
        <Providers>
          <VisitorTracker />
          {children}
        </Providers>
      </body>
    </html>
  )
}
