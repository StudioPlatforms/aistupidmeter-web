import AccountShell from '@/components/AccountShell';
import { providerPageGate, providerPageMetadata } from '@/lib/provider-gate';
import ProfileClient from './ProfileClient';

export const generateMetadata = providerPageMetadata('/account/provider/profile', 'Provider profile');

export const dynamic = 'force-dynamic';

export default async function ProviderProfilePage() {
  const summary = await providerPageGate('/account/provider/profile');
  return (
    <AccountShell>
      <ProfileClient initial={summary} />
    </AccountShell>
  );
}
