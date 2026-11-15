import AccountShell from '@/components/AccountShell';
import { providerPageGate, providerPageMetadata } from '@/lib/provider-gate';
import DomainsClient from './DomainsClient';

export const generateMetadata = providerPageMetadata('/account/provider/domains', 'Provider domains');

export const dynamic = 'force-dynamic';

export default async function ProviderDomainsPage() {
  const summary = await providerPageGate('/account/provider/domains');
  return (
    <AccountShell>
      <DomainsClient initial={summary} />
    </AccountShell>
  );
}
