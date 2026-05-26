import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'AI Smart Router — Intelligent API Gateway for All AI Models',
    template: '%s | AI Smart Router — AI Stupid Meter',
  },
  description: 'AI Smart Router: one universal API key for OpenAI, Anthropic, xAI, Google, DeepSeek & more. Automatic model selection based on live benchmarks, prompt auditing, budget controls, cost analytics. Works with Cursor, Windsurf, Aider, Continue.dev, Cline, and more.',
  keywords: [
    'AI smart router',
    'AI API gateway',
    'AI router',
    'intelligent AI routing',
    'OpenAI compatible API',
    'one API key all AI models',
    'AI model auto-selection',
    'AI prompt auditing',
    'AI API monitoring',
    'AI budget control',
    'AI cost analytics',
    'AI failover routing',
    'Cursor AI router',
    'Windsurf AI router',
    'Aider AI router',
    'Continue.dev AI router',
    'multi-model AI API',
    'AI request logging',
    'AI token usage tracking',
    'cheapest AI router',
  ],
  openGraph: {
    type: 'website',
    title: 'AI Smart Router — One API Key for All AI Models',
    description: 'Intelligent AI API gateway with automatic model selection, prompt auditing, budget controls, and cost analytics. Works with Cursor, Windsurf, Aider, and 10+ tools.',
    url: 'https://aistupidlevel.info/router',
    siteName: 'AI Stupid Meter — Smart Router',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Smart Router — Route to the Best AI Model Automatically',
    description: 'One API key for GPT-5, Claude, Grok, Gemini & more. Smart routing, prompt auditing, budget controls. $4.99/mo with 7-day free trial.',
  },
  alternates: {
    canonical: '/router',
  },
};

export default function RouterSEOLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
