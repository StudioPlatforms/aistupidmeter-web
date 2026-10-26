import type { Metadata } from 'next';
import BestHub from '@/components/seo/best/BestHub';
import { hubMetadata } from '@/components/seo/best/best-meta';

/**
 * /best-ai-model: the hub of the best-for pages (components/seo/best/BestHub.tsx). ISR every
 * fifteen minutes, no auth(): it reads the free 24-hour boards and the price view only.
 */
export const revalidate = 900;

export async function generateMetadata(): Promise<Metadata> {
  return hubMetadata();
}

export default function Page() {
  return <BestHub />;
}
