import AccountShell from '@/components/AccountShell';
import { providerPageGate, providerPageMetadata } from '@/lib/provider-gate';
import DataClient from './DataClient';

export const generateMetadata = providerPageMetadata('/account/provider/data', 'Provider data handling');

export const dynamic = 'force-dynamic';

export default async function ProviderDataPage() {
  const summary = await providerPageGate('/account/provider/data');
  return (
    <AccountShell>
      <DataClient initial={summary} />
    </AccountShell>
  );
}
