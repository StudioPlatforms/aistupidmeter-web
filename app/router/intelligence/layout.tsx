import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Model Intelligence — Live Benchmark Data, Charts & Model Comparison',
  description: 'Real-time AI model intelligence from continuous benchmarking. Performance charts, radar comparisons, and 9-axis scoring (correctness, complexity, code quality, stability, efficiency, edge cases, debugging, format, safety). Compare up to 4 models side by side.',
  keywords: [
    'AI model intelligence',
    'AI model comparison tool',
    'AI benchmark charts',
    'AI performance radar',
    'AI model scoring',
    'AI 9-axis benchmark',
    'AI model side-by-side comparison',
    'live AI benchmark data',
    'AI model performance history',
  ],
  openGraph: {
    title: 'AI Model Intelligence — Live Benchmark Charts & Comparisons',
    description: 'Real-time AI model performance data across 24 tracked models. Charts, radar comparisons, 9-axis scoring. Compare GPT-5, Claude, Gemini, DeepSeek and more side by side.',
    url: 'https://aistupidlevel.info/router/intelligence',
  },
  alternates: {
    canonical: '/router/intelligence',
  },
};

export default function IntelligenceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
