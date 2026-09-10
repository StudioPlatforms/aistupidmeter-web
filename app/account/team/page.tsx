import type { Metadata } from 'next';
import AccountShell from '@/components/AccountShell';
import TeamClient from './TeamClient';

export const metadata: Metadata = {
  title: 'Team | AI Stupid Level',
  description: 'Your shared workspace: members, projects and webhooks.',
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

export default function TeamPage() {
  return (
    <AccountShell>
      <TeamClient />
    </AccountShell>
  );
}
