import type { Metadata } from 'next';
import Landing from '@/components/landing/Landing';

// The landing page at a fixed address, so it can be opened while signed in (where / shows the
// leaderboard). Not indexed: / is the canonical copy.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  robots: { index: false, follow: true },
};

export default function WelcomePage() {
  return <Landing />;
}
