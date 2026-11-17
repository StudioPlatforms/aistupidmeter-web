import AccountShell from '@/components/AccountShell';
import { providerPageGate, providerPageMetadata } from '@/lib/provider-gate';
import ExportClient from './ExportClient';

export const generateMetadata = providerPageMetadata('/account/provider/export', 'Export your data');

/** Per-account (M13: Provider Terms and Listing Agreement v1.0 §14.1, §24.4): never prerendered. */
export const dynamic = 'force-dynamic';

export default async function ProviderExportPage() {
  const summary = await providerPageGate('/account/provider/export');
  return (
    <AccountShell>
      <ExportClient initial={summary} />
    </AccountShell>
  );
}
