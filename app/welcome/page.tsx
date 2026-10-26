import type { Metadata } from 'next';
import Landing from '@/components/landing/Landing';
import { pageMeta } from '@/lib/seo';

// The landing page at a fixed address, so it can be opened while signed in (where / shows the
// leaderboard). Not indexed: / is the canonical copy.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMeta({
  title: 'Independent LLM benchmarks & drift alerts',
  description: 'Independent LLM benchmarks since August 2025: GPT, Claude, Gemini, DeepSeek, Kimi and GLM re-tested on a fixed schedule, with drift alerts and a router.',
  path: '/',
  noindex: true,
});

export default function WelcomePage() {
  return <Landing />;
}
