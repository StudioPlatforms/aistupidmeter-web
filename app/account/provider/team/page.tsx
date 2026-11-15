import AccountShell from '@/components/AccountShell';
import { providerPageGate, providerPageMetadata } from '@/lib/provider-gate';
import ProviderTeamClient from './ProviderTeamClient';

export const generateMetadata = providerPageMetadata('/account/provider/team', 'Provider team');

export const dynamic = 'force-dynamic';

export default async function ProviderTeamPage() {
  const summary = await providerPageGate('/account/provider/team');
  return (
    <AccountShell>
      <ProviderTeamClient initial={summary} />
    </AccountShell>
  );
}
