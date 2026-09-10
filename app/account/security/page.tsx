import type { Metadata } from 'next';
import AccountShell from '@/components/AccountShell';
import SecurityClient from './SecurityClient';

export const metadata: Metadata = {
  title: 'Security & governance | AI Stupid Level',
  description: 'Single sign-on, SCIM provisioning and the audit trail for your workspace.',
  robots: { index: false, follow: false },
};

/** Per-user page — never statically prerendered. */
export const dynamic = 'force-dynamic';

export default function SecurityPage() {
  return (
    <AccountShell>
      <SecurityClient />
    </AccountShell>
  );
}
