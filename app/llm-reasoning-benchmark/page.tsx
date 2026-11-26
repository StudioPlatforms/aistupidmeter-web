import type { Metadata } from 'next';
import SuitePage from '@/components/seo/bench/SuitePage';
import { suiteMetadata } from '@/components/seo/bench/bench-config';

/**
 * /llm-reasoning-benchmark: the reasoning suite explained (components/seo/bench/SuitePage.tsx;
 * config in bench-config.ts, wording in bench-copy.ts). ISR every fifteen minutes, no auth(): the
 * only figure read at render time is the suite's session count.
 */
export const revalidate = 900;

export const metadata: Metadata = suiteMetadata('reasoning');

export default function Page() {
  return <SuitePage suite="reasoning" />;
}
