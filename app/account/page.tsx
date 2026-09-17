import type { Metadata } from 'next';
import AccountShell from '@/components/AccountShell';
import AccountOverview from './AccountOverview';

export const metadata: Metadata = {
  title: 'Your account',
  description: 'Your plan, tracked models and usage in one place.',
  robots: { index: false, follow: false },
};

/** Per-user page — never statically prerendered. */
export const dynamic = 'force-dynamic';

export default function AccountPage() {
  return (
    <AccountShell>
      <AccountOverview />
    </AccountShell>
  );
}
