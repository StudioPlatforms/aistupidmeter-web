import type { Metadata } from 'next'
import Script from 'next/script'
import { Providers } from '../components/Providers'
import VisitorTracker from '../components/VisitorTracker'
import HalloweenAnimations from '../components/HalloweenAnimations'
import ChristmasAnimations from '../components/ChristmasAnimations'
import '../styles/vintage.css'
import '../styles/drift-cards.css'
import '../styles/v4-layout.css'

export const metadata: Metadata = {
  title: {
    default: 'AI Benchmark & Smart Router 2026 | AI Performance Tests, Model Rankings & API Monitoring',
    template: '%s | AI Stupid Meter — Benchmarks & Smart Router'
  },
  description: 'The #1 AI benchmarking platform and intelligent API router for 2026. Compare 20+ AI models (GPT-5, Claude Opus 4, Grok 4, Gemini 3), run real-time benchmarks, route requests through the smartest model automatically, and monitor API usage with prompt auditing, budget controls, and cost analytics. One API key for every provider.',
  keywords: [
    // Core Benchmark Keywords
    'AI benchmark',
    'AI benchmarking tool',
    'AI performance tests',
    'AI ranking',
    'AI score',
    'AI model leaderboard',
    'Best AI models 2026',
    'Compare AI models',
    'AI test suite',
    'AI evaluation',
    
    // AI Smart Router Keywords
    'AI router',
    'AI smart router',
    'AI API router',
    'intelligent AI routing',
    'AI model router',
    'OpenAI compatible router',
    'AI gateway',
    'LLM router',
    'AI load balancer',
    'multi-model AI router',
    'one API key all AI models',
    'AI proxy server',
    'OpenAI API alternative',
    'unified AI API',
    'AI failover routing',
    'cheapest AI router',
    'best AI API gateway 2026',

    // API Monitoring & Prompt Auditing Keywords
    'AI API monitoring',
    'AI prompt auditing',
    'AI prompt logging',
    'AI API cost tracking',
    'AI usage analytics',
    'AI budget control',
    'API key management AI',
    'AI spend monitoring',
    'prompt audit tool',
    'AI request logging',
    'API cost optimization AI',
    'AI token usage tracking',
    
    // Long-Tail Keywords
    'Which AI model is best for coding',
    'Claude vs GPT vs Gemini comparison 2026',
    'Best AI for software development',
    'AI quality drift detection',
    'Measure AI performance',
    'AI refusals and stability tests',
    'Real-time AI scoring',
    'Open source AI benchmark tool',
    'AI benchmark results dashboard',
    'how to route AI requests automatically',
    'AI model auto-selection',
    'save money on AI API calls',
    'AI cost comparison tool',
    'monitor AI prompt safety',
    'track AI API spending per key',
    
    // Technical / Developer Keywords
    'AI coding benchmark',
    'AI code generation test',
    'AI debugging benchmark',
    'AI optimization benchmark',
    'LLM benchmark',
    'LLM performance test',
    'Test AI models with your API key',
    'AI testing framework',
    'OpenAI SDK compatible',
    'Anthropic Messages API',
    'AI embeddings API',
    'Cursor AI router',
    'Windsurf AI router',
    'Aider AI router',
    'Continue.dev AI router',
    'AI Cline router',
    
    // Model-Specific Keywords
    'GPT-5 benchmark',
    'Claude Opus 4 benchmark',
    'Grok 4 benchmark',
    'Gemini 3 benchmark',
    'DeepSeek V4 benchmark',
    'GPT-5 vs Claude Opus 4',
    'Grok 4 vs Gemini 3',
    'O3 benchmark results',
    
    // Provider & Monitoring Keywords
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
    'AI model analytics',
    'AI API key budget limits',
    'AI prompt encryption',
    'AI secret scrubbing'
  ],
  authors: [{ name: 'The Architect', url: 'https://x.com/GOATGameDev' }],
  creator: 'Studio Platforms',
  publisher: 'Studio Platforms',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://aistupidlevel.info'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://aistupidlevel.info',
    title: 'AI Benchmark & Smart Router 2026 | Compare GPT-5, Claude Opus 4, Grok 4, Gemini 3',
    description: 'The #1 AI benchmarking platform and intelligent API router for 2026. Compare 20+ AI models, route requests through the smartest model, monitor API usage, audit prompts, and control budgets. One API key for all providers.',
    siteName: 'AI Stupid Meter — Benchmarks, Smart Router & API Monitoring',
    images: [
      {
        url: 'https://aistupidlevel.info/api/og?type=rankings',
        width: 1200,
        height: 630,
        alt: 'AI Model Rankings - Live Performance Scores & Smart Router'
      },
      {
        url: '/stupidmetermeta.png',
        width: 1200,
        height: 630,
        alt: 'AI Benchmark Tool - Compare AI Models, Smart Router & API Monitoring Dashboard'
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Benchmark & Smart Router 2026 — GPT-5 vs Claude vs Grok vs Gemini',
    description: 'Compare 20+ AI models with live benchmarks. Smart AI Router routes to the best model automatically. Monitor API usage, audit prompts, control budgets. One API key for all providers.',
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
        
        
        {/* Optimized Google Analytics with afterInteractive strategy */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <Script
              id="gtag-base"
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
            />
            <Script
              id="gtag-init"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  
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
              "@graph": [
                {
                  "@type": ["WebApplication", "SoftwareApplication"],
                  "name": "AI Stupid Meter — Benchmarks, Smart Router & API Monitoring",
                  "alternateName": ["AI Benchmarking Tool", "AI Smart Router", "AI API Gateway", "AI Performance Test", "AI Model Comparison Tool", "AI Prompt Monitor"],
                  "applicationCategory": ["DeveloperApplication", "ProductivityApplication", "BusinessApplication"],
                  "operatingSystem": "Web",
                  "description": "The #1 AI benchmarking platform and intelligent API router for 2026. Compare 20+ AI models (GPT-5, Claude Opus 4, Grok 4, Gemini 3), route requests through the smartest model automatically, monitor API usage with prompt auditing, budget controls, and cost analytics. One API key for every provider.",
                  "url": "https://aistupidlevel.info",
                  "sameAs": [
                    "https://github.com/StudioPlatforms/aistupidmeter-web",
                    "https://github.com/StudioPlatforms/aistupidmeter-api",
                    "https://www.reddit.com/r/aistupidlevel/",
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
                    "url": "https://aistupidlevel.info",
                    "logo": {
                      "@type": "ImageObject",
                      "url": "https://aistupidlevel.info/smlogo.png"
                    }
                  },
                  "softwareVersion": "4.0.0",
                  "datePublished": "2025-01-06",
                  "dateModified": new Date().toISOString().split('T')[0],
                  "offers": {
                    "@type": "Offer",
                    "name": "AI Router PRO",
                    "price": "4.99",
                    "priceCurrency": "USD",
                    "priceValidUntil": "2027-12-31",
                    "availability": "https://schema.org/InStock",
                    "description": "AI Router PRO subscription: intelligent API routing, smart model selection based on live benchmarks, API monitoring with prompt auditing, budget controls, cost analytics, and one universal API key for all AI providers. 7-day free trial included."
                  },
                  "featureList": [
                    "AI benchmark testing and evaluation across 20+ models",
                    "Real-time AI model performance monitoring and degradation detection",
                    "AI model leaderboard and rankings with 7-axis scoring",
                    "Compare GPT-5 vs Claude Opus 4 vs Grok 4 vs Gemini 3 performance",
                    "AI coding benchmark tests with Python sandbox execution",
                    "LLM performance evaluation with statistical confidence intervals",
                    "AI Smart Router — automatic model selection based on live benchmarks",
                    "One universal API key for OpenAI, Anthropic, xAI, Google, DeepSeek, GLM, Kimi",
                    "OpenAI-compatible /v1/chat/completions endpoint",
                    "Native Anthropic Messages API passthrough (/v1/messages)",
                    "Embeddings API proxy (/v1/embeddings)",
                    "Direct model pinning — route to specific models by name",
                    "5 virtual routing strategies: auto-best, best-coding, best-reasoning, best-creative, cheapest",
                    "API Monitoring dashboard — per-key request logging",
                    "Prompt auditing with automatic secret scrubbing and AES-256 encryption",
                    "Budget controls with hard/soft limits and threshold alerts",
                    "Cost analytics with daily trends and model spend breakdown",
                    "Key efficiency metrics and error rate tracking",
                    "AI quality drift detection using CUSUM + Page-Hinkley algorithms",
                    "Tool calling and function calling benchmark tests",
                    "Historical AI performance analysis with 24h/7d/30d time periods",
                    "Works with Cursor, Windsurf, Aider, Continue.dev, Cline, Open WebUI, and more",
                    "OpenAI 2026 API spec compliant (system_fingerprint, service_tier, stream_options)",
                    "Automatic failover when models degrade or fail"
                  ],
                  "keywords": "AI benchmark, AI smart router, AI API gateway, AI benchmarking tool, AI performance tests, AI ranking, AI model leaderboard, best AI models 2026, compare AI models, Claude vs GPT vs Gemini 2026, AI coding benchmark, LLM benchmark, AI prompt auditing, AI API monitoring, AI budget control, one API key all AI models, AI cost optimization, AI failover routing",
                  "screenshot": "https://aistupidlevel.info/screenshot.png",
                  "aggregateRating": {
                    "@type": "AggregateRating",
                    "ratingValue": "5.0",
                    "ratingCount": "1",
                    "bestRating": "5",
                    "worstRating": "1"
                  }
                },
                {
                  "@type": "WebSite",
                  "name": "AI Stupid Meter",
                  "url": "https://aistupidlevel.info",
                  "potentialAction": {
                    "@type": "SearchAction",
                    "target": "https://aistupidlevel.info/models/{search_term_string}",
                    "query-input": "required name=search_term_string"
                  }
                },
                {
                  "@type": "Dataset",
                  "name": "AI Model Performance Benchmark Results 2026",
                  "description": "Comprehensive real-time benchmark results for 20+ leading AI models including GPT-5, Claude Opus 4, Grok 4, Gemini 3, DeepSeek V4, and more. Updated every 4 hours with 7-axis scoring and statistical confidence intervals.",
                  "keywords": "AI benchmark results, AI model comparison data, LLM performance metrics, AI coding test results, AI smart router data",
                  "license": "https://creativecommons.org/licenses/by/4.0/",
                  "creator": {
                    "@type": "Organization",
                    "name": "Studio Platforms"
                  },
                  "temporalCoverage": "2025-01-06/..",
                  "measurementTechnique": "Automated code generation benchmarks with Python sandbox execution, tool calling tests, deep reasoning evaluation"
                },
                {
                  "@type": "FAQPage",
                  "mainEntity": [
                    {
                      "@type": "Question",
                      "name": "What is AI Stupid Meter?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "AI Stupid Meter is the world's first AI intelligence degradation detection system. We continuously benchmark 20+ AI models across 7 providers using automated coding challenges, deep reasoning tasks, and tool-calling evaluations. Our CUSUM + Page-Hinkley algorithms detect performance regressions within hours."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "What is the AI Smart Router?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "The AI Smart Router is an intelligent API gateway that automatically routes your AI requests to the best-performing model based on live benchmark data. It provides one universal API key for all providers (OpenAI, Anthropic, xAI, Google, DeepSeek, GLM, Kimi), with 5 routing strategies including auto-best, best-coding, best-reasoning, best-creative, and cheapest."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "What is AI API Monitoring?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "AI API Monitoring tracks every request made through your API keys with per-key usage logging, cost breakdowns by model, prompt auditing with automatic secret scrubbing, budget controls with hard and soft limits, and efficiency metrics. All prompts are automatically scrubbed for secrets and encrypted at rest with AES-256."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "Which AI models does the platform support?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "We benchmark and route through 20+ models including GPT-5, GPT-4o, O3, O3-Mini from OpenAI; Claude Opus 4, Claude Sonnet 4 from Anthropic; Grok 4 from xAI; Gemini 2.5 Pro, Gemini 2.5 Flash from Google; DeepSeek V4; Kimi K2; and GLM models from Zhipu AI."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "How much does it cost?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "The AI benchmarks, rankings, and degradation alerts are completely free. The AI Router PRO plan with smart routing, API monitoring, prompt auditing, and budget controls costs $4.99/month with a 7-day free trial. You bring your own provider API keys — we don't mark up token costs."
                      }
                    }
                  ]
                }
              ]
            })
          }}
        />
        
        {/* Enhanced SEO meta tags for target keywords */}
        <meta name="ai-content-classification" content="ai-benchmarking-tool,ai-smart-router,ai-api-monitoring" />
        <meta name="model-types" content="OpenAI,Anthropic,xAI,Google,DeepSeek,GLM,Kimi,GPT-5,O3,Claude-Opus-4,Grok-4,Gemini-3,DeepSeek-V4,Kimi-K2,GLM-5" />
        <meta name="functionality" content="ai-benchmark,performance-testing,model-comparison,ai-evaluation,smart-routing,api-gateway,prompt-auditing,api-monitoring,budget-control,cost-analytics" />
        <meta name="target-audience" content="developers,ai-researchers,software-engineers,data-scientists,devops,platform-engineers,ai-startups,enterprise-ai-teams" />
        <meta name="use-cases" content="ai-model-selection,performance-comparison,coding-ai-evaluation,llm-benchmarking,api-cost-optimization,prompt-safety-auditing,multi-provider-routing,ai-failover" />
        <meta name="benchmark-types" content="coding-benchmark,debugging-test,performance-evaluation,quality-assessment,tool-calling-test,reasoning-benchmark,deep-reasoning" />
        <meta name="supported-models" content="GPT-5,GPT-4o,O3,O3-Mini,Claude-Opus-4,Claude-Sonnet-4,Claude-Haiku-4.5,Grok-4,Gemini-2.5-Pro,Gemini-2.5-Flash,Gemini-3.5-Flash,DeepSeek-V4,Kimi-K2,GLM-5" />
        <meta name="comparison-features" content="Claude-vs-GPT,GPT-vs-Gemini,Grok-vs-Claude,AI-model-rankings,smart-routing-strategies,cost-per-token-comparison" />
        <meta name="router-features" content="auto-best,best-coding,best-reasoning,best-creative,cheapest,direct-pin,openai-compatible,anthropic-passthrough,embeddings-proxy" />
        <meta name="monitoring-features" content="per-key-tracking,prompt-auditing,secret-scrubbing,budget-alerts,cost-trends,efficiency-metrics,request-logging,aes256-encryption" />
        <meta name="compatible-tools" content="Cursor,Windsurf,Aider,Continue.dev,Cline,Open-WebUI,LangChain,Vercel-AI-SDK,LiteLLM,LibreChat,BoltAI,TypingMind" />
        
        {/* Additional keyword-rich meta tags */}
        <meta name="subject" content="AI Benchmark Tool, AI Smart Router, AI API Monitoring, LLM Performance Testing, Prompt Auditing" />
        <meta name="abstract" content="The #1 AI benchmarking platform and intelligent API router for 2026. Compare 20+ AI models, route requests through the smartest model, monitor API usage with prompt auditing, budget controls, and cost analytics. One API key for every provider." />
        <meta name="topic" content="AI Benchmarking, AI Smart Routing, AI API Monitoring, Machine Learning Evaluation, LLM Performance Analysis, Prompt Safety Auditing" />
        <meta name="summary" content="Compare 20+ AI models with live benchmarks. Smart AI Router routes to the best model automatically. Monitor API usage, audit prompts, control budgets. One API key for all providers including OpenAI, Anthropic, xAI, Google, DeepSeek, and more." />
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
          <HalloweenAnimations />
          <ChristmasAnimations />
          {children}
        </Providers>
      </body>
    </html>
  )
}
