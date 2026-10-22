import type { Metadata } from 'next';
import AccountShell from '@/components/AccountShell';
import AdminDashboard from './AdminDashboard';

export const metadata: Metadata = {
  title: 'Admin dashboard',
  robots: { index: false, follow: false },
};

/** Per-user page — never statically prerendered. */
export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return (
    <AccountShell>
      <AdminDashboard />
    </AccountShell>
  );
}
