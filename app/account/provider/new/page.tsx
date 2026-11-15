import AccountShell from '@/components/AccountShell';
import { providerPageGate, providerPageMetadata } from '@/lib/provider-gate';
import NewProviderClient from './NewProviderClient';

export const generateMetadata = providerPageMetadata('/account/provider/new', 'Create a provider account');

export const dynamic = 'force-dynamic';

export default async function NewProviderPage() {
  const summary = await providerPageGate('/account/provider/new');
  return (
    <AccountShell>
      <NewProviderClient initial={summary} />
    </AccountShell>
  );
}
