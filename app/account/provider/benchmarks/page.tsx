import AccountShell from '@/components/AccountShell';
import { providerPageGate, providerPageMetadata } from '@/lib/provider-gate';
import BenchmarksClient from './BenchmarksClient';

export const generateMetadata = providerPageMetadata('/account/provider/benchmarks', 'Provider benchmarks');

export const dynamic = 'force-dynamic';

export default async function ProviderBenchmarksPage() {
  const summary = await providerPageGate('/account/provider/benchmarks');
  return (
    <AccountShell>
      <BenchmarksClient initial={summary} />
    </AccountShell>
  );
}
