import AccountShell from '@/components/AccountShell';
import { providerPageGate, providerPageMetadata } from '@/lib/provider-gate';
import ModelsClient from './ModelsClient';

export const generateMetadata = providerPageMetadata('/account/provider/models', 'Provider models');

export const dynamic = 'force-dynamic';

export default async function ProviderModelsPage() {
  const summary = await providerPageGate('/account/provider/models');
  return (
    <AccountShell>
      <ModelsClient initial={summary} />
    </AccountShell>
  );
}
