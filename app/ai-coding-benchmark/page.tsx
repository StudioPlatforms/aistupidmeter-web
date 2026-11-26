import type { Metadata } from 'next';
import SuitePage from '@/components/seo/bench/SuitePage';
import { suiteMetadata } from '@/components/seo/bench/bench-config';

/**
 * /ai-coding-benchmark: the coding suite explained (components/seo/bench/SuitePage.tsx; config in
 * bench-config.ts, wording in bench-copy.ts). ISR every fifteen minutes, no auth(): the only
 * figures read at render time are the suite's task and attempt counts.
 */
export const revalidate = 900;

export const metadata: Metadata = suiteMetadata('coding');

export default function Page() {
  return <SuitePage suite="coding" />;
}
