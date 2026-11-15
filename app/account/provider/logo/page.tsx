import AccountShell from '@/components/AccountShell';
import { providerPageGate, providerPageMetadata } from '@/lib/provider-gate';
import LogoClient from './LogoClient';

export const generateMetadata = providerPageMetadata('/account/provider/logo', 'Provider logo');

export const dynamic = 'force-dynamic';

export default async function ProviderLogoPage() {
  const summary = await providerPageGate('/account/provider/logo');
  return (
    <AccountShell>
      <LogoClient initial={summary} />
    </AccountShell>
  );
}
