import AccountShell from '@/components/AccountShell';
import { providerPageGate, providerPageMetadata } from '@/lib/provider-gate';
import OverviewClient from './OverviewClient';

export const generateMetadata = providerPageMetadata('/account/provider', 'Provider account');

/** Per-account, and the API decides whether it exists at all for this account: never prerendered. */
export const dynamic = 'force-dynamic';

export default async function ProviderOverviewPage() {
  const summary = await providerPageGate('/account/provider');
  return (
    <AccountShell>
      <OverviewClient initial={summary} />
    </AccountShell>
  );
}
