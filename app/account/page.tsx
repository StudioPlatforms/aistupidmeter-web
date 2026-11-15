import type { Metadata } from 'next';
import AccountShell from '@/components/AccountShell';
import { providerSignupOpenCached } from '@/lib/provider-public';
import AccountOverview from './AccountOverview';

export const metadata: Metadata = {
  title: 'Your account',
  description: 'Your plan, tracked models and usage in one place.',
  robots: { index: false, follow: false },
};

/** Per-user page — never statically prerendered. */
export const dynamic = 'force-dynamic';

/**
 * The way into provider accounts (§2.0, "Account home") is offered once they are open to everyone
 * (M10). That is one answer for the whole server, read from memory and refreshed in the
 * background (lib/provider-public.ts): this page asks the API nothing per account and never waits
 * on it, so an API stall cannot slow it. Members are left out by the session (AccountOverview).
 * While provider accounts are staff-only, staff open /account/provider/new directly.
 */
export default function AccountPage() {
  return (
    <AccountShell>
      <AccountOverview providerEntry={providerSignupOpenCached()} />
    </AccountShell>
  );
}
