import type { Metadata } from 'next';
import SubpageLayout from '@/components/SubpageLayout';
import WatchlistClient from './WatchlistClient';

export const metadata: Metadata = {
  title: 'Your watchlist | AI Stupid Level',
  description:
    'Track the AI models your product depends on. Get a weekly summary of what changed, what stayed stable, and how much evidence sits behind each number.',
  alternates: { canonical: '/watchlist' },
  robots: { index: false, follow: false },
};

/**
 * Per-user page — never statically prerendered.
 *
 * Also what makes useSearchParams safe here: Next requires a Suspense boundary
 * around it during static generation, and a page that is always dynamic has no
 * static generation to bail out of.
 */
export const dynamic = 'force-dynamic';

export default function WatchlistPage() {
  return (
    <SubpageLayout>
      <WatchlistClient />
    </SubpageLayout>
  );
}
