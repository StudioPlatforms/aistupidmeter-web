import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';

// The forum is client-rendered and thin for crawlers, so it is not indexed; its links are followed.
export const metadata: Metadata = pageMeta({
  title: 'Smart Router community forum',
  description: 'The AI Stupid Level community forum: questions and answers about the benchmarks, the Smart Router, provider keys and integrations with coding tools.',
  path: '/router/forum',
  noindex: true,
});

export default function ForumSEOLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
