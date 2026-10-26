import type { Metadata } from 'next';
import BestPage from '@/components/seo/best/BestPage';
import { bestMetadata } from '@/components/seo/best/best-meta';

/**
 * /best-ai-model-for-agents: the shared best-for page for the "agents" category
 * (components/seo/best/BestPage.tsx; config in best-config.ts). ISR every fifteen minutes,
 * no auth(): the page reads the free 24-hour boards and the price view, never the paid newest run.
 */
export const revalidate = 900;

export async function generateMetadata(): Promise<Metadata> {
  return bestMetadata('agents');
}

export default function Page() {
  return <BestPage category="agents" />;
}
