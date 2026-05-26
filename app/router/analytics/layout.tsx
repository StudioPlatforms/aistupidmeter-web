import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Router Analytics — Usage Tracking, Cost Savings & Performance Metrics',
  description: 'Comprehensive analytics for your AI API usage. Track total requests, cost savings, provider distribution, top models, success rates, and strategy performance. Export data in CSV or JSON. See exactly how much you save with intelligent routing.',
  keywords: [
    'AI API analytics',
    'AI usage tracking',
    'AI cost savings',
    'AI API performance metrics',
    'AI router analytics dashboard',
    'AI model usage stats',
    'AI API cost analysis',
    'AI provider distribution',
  ],
  openGraph: {
    title: 'AI Router Analytics — Track Usage, Costs & Performance',
    description: 'See total requests, cost savings, provider distribution, and strategy performance across your AI API usage.',
    url: 'https://aistupidlevel.info/router/analytics',
  },
  alternates: {
    canonical: '/router/analytics',
  },
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
