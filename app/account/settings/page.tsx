import type { Metadata } from 'next';
import AccountShell from '@/components/AccountShell';
import SettingsClient from './SettingsClient';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your account, email notifications and which models email you.',
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

export default function SettingsPage() {
  return (
    <AccountShell>
      <SettingsClient />
    </AccountShell>
  );
}
