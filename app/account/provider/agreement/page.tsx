import AccountShell from '@/components/AccountShell';
import { providerPageGate, providerPageMetadata } from '@/lib/provider-gate';
import AgreementClient from './AgreementClient';

export const generateMetadata = providerPageMetadata('/account/provider/agreement', 'Provider agreement');

export const dynamic = 'force-dynamic';

export default async function ProviderAgreementPage() {
  const summary = await providerPageGate('/account/provider/agreement');
  return (
    <AccountShell>
      <AgreementClient initial={summary} />
    </AccountShell>
  );
}
