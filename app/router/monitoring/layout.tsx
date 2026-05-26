import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI API Monitoring — Track Usage, Audit Prompts, Control Budgets',
  description: 'Monitor every AI API request with per-key tracking, cost dashboards, prompt auditing with automatic secret scrubbing, budget controls with hard/soft limits, threshold alerts, and key efficiency metrics. All prompts encrypted at rest with AES-256.',
  keywords: [
    'AI API monitoring',
    'AI prompt auditing',
    'AI API cost tracking',
    'AI usage analytics',
    'AI budget control',
    'AI API key monitoring',
    'AI prompt logging',
    'AI spend tracking',
    'AI request logging',
    'AI token usage analytics',
    'AI secret scrubbing',
    'AI cost optimization',
    'AI API budget alerts',
    'AI efficiency metrics',
  ],
  openGraph: {
    title: 'AI API Monitoring — Per-Key Tracking, Prompt Auditing & Budget Controls',
    description: 'Track every AI API request. Audit prompts with automatic secret scrubbing. Set budget limits with alerts. Analyze costs by model and key. AES-256 encryption at rest.',
    url: 'https://aistupidlevel.info/router/monitoring',
  },
  alternates: {
    canonical: '/router/monitoring',
  },
};

export default function MonitoringLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
