import AccountShell from '@/components/AccountShell';
import { providerPageGate, providerPageMetadata } from '@/lib/provider-gate';
import NoticesClient from './NoticesClient';

export const generateMetadata = providerPageMetadata('/account/provider/notices', 'Provider notices');

export const dynamic = 'force-dynamic';

export default async function ProviderNoticesPage() {
  const summary = await providerPageGate('/account/provider/notices');
  return (
    <AccountShell>
      <NoticesClient initial={summary} />
    </AccountShell>
  );
}
