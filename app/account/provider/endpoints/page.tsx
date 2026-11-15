import AccountShell from '@/components/AccountShell';
import { providerPageGate, providerPageMetadata } from '@/lib/provider-gate';
import EndpointsClient from './EndpointsClient';

export const generateMetadata = providerPageMetadata('/account/provider/endpoints', 'Provider endpoints');

export const dynamic = 'force-dynamic';

export default async function ProviderEndpointsPage() {
  const summary = await providerPageGate('/account/provider/endpoints');
  return (
    <AccountShell>
      <EndpointsClient initial={summary} />
    </AccountShell>
  );
}
