import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data API Keys — Free Access to AI Benchmark Data',
  description:
    'Create a free API key for the AIStupidLevel Data API. Programmatic access to live model rankings, degradation alerts, drift signatures and provider reliability for GPT, Claude, Gemini and more.',
  keywords: [
    'AI benchmark API',
    'LLM leaderboard API',
    'model performance API',
    'free AI data API key',
    'AI model degradation API',
    'LLM drift detection API',
  ],
  openGraph: {
    title: 'Data API Keys — Free Access to AI Benchmark Data',
    description:
      'Free API key for live model rankings, degradation alerts and drift data from AIStupidLevel.',
    url: 'https://aistupidlevel.info/router/data-keys',
  },
  alternates: {
    canonical: '/router/data-keys',
  },
};

export default function DataKeysLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
