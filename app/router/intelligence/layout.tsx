import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Model Intelligence — Live Benchmark Data, Charts & Model Comparison',
  description: 'Real-time AI model intelligence from 171+ continuous benchmarks. Performance charts, radar comparisons, detailed scoring across 7 axes (correctness, speed, tool calling, edge handling, output quality, instruction following, error recovery). Compare up to 4 models side by side.',
  keywords: [
    'AI model intelligence',
    'AI model comparison tool',
    'AI benchmark charts',
    'AI performance radar',
    'AI model scoring',
    'AI 7-axis benchmark',
    'AI model side-by-side comparison',
    'live AI benchmark data',
    'AI model performance history',
  ],
  openGraph: {
    title: 'AI Model Intelligence — Live Benchmark Charts & Comparisons',
    description: 'Real-time AI model performance data from 171+ benchmarks. Charts, radar comparisons, 7-axis scoring. Compare GPT-5, Claude, Grok, Gemini side by side.',
    url: 'https://aistupidlevel.info/router/intelligence',
  },
  alternates: {
    canonical: '/router/intelligence',
  },
};

export default function IntelligenceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
