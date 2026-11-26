import type { Metadata } from 'next';
import SuitePage from '@/components/seo/bench/SuitePage';
import { suiteMetadata } from '@/components/seo/bench/bench-config';

/**
 * /llm-tool-calling-benchmark: the tool-use suite explained, for function calling and agents
 * (components/seo/bench/SuitePage.tsx; config in bench-config.ts, wording in bench-copy.ts). ISR
 * every fifteen minutes, no auth(): the only figure read at render time is the suite's task count.
 */
export const revalidate = 900;

export const metadata: Metadata = suiteMetadata('tooling');

export default function Page() {
  return <SuitePage suite="tooling" />;
}
