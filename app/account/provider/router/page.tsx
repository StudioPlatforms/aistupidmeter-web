import AccountShell from '@/components/AccountShell';
import { providerPageGate, providerPageMetadata } from '@/lib/provider-gate';
import RouterClient from './RouterClient';

export const generateMetadata = providerPageMetadata('/account/provider/router', 'Router & offers');

export const dynamic = 'force-dynamic';

export default async function ProviderRouterPage() {
  const summary = await providerPageGate('/account/provider/router');
  return (
    <AccountShell>
      <RouterClient initial={summary} />
    </AccountShell>
  );
}
