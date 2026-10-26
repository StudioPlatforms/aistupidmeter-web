import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProviderStatusPage from '@/components/seo/status/ProviderStatusPage';
import { DEFAULT_INTERVAL_MIN, isProviderSlug, providerBySlug, statusDescription, statusKeywords, statusTitle } from '@/components/seo/status/status-meta';
import { TITLE_SUFFIX, pageMeta } from '@/lib/seo';
import { VENDOR_KEYS, getProviders } from '@/lib/seo-data';

/**
 * /status/<provider>: one provider's probe record (components/seo/status/ProviderStatusPage).
 * Lives under /status because nginx owns the /providers prefix (it is the API). One page per vendor
 * is built at build time and re-rendered every minute; an unknown segment is a 404.
 */

/** One minute: the check cadence is ten, so anything finer is just load. No auth(), so the page stays ISR. */
export const revalidate = 60;

export function generateStaticParams(): Array<{ provider: string }> {
  return VENDOR_KEYS.map((provider) => ({ provider }));
}

export async function generateMetadata({ params }: { params: { provider: string } }): Promise<Metadata> {
  const vendor = providerBySlug(params.provider);
  if (!vendor) return { title: { absolute: `Not found${TITLE_SUFFIX}` }, robots: { index: false, follow: true } };
  const data = await getProviders();
  const interval = data?.meta.checkIntervalMinutes ?? DEFAULT_INTERVAL_MIN;
  return pageMeta({
    title: statusTitle(vendor, interval),
    description: statusDescription(vendor, interval),
    path: vendor.statusPath,
    keywords: statusKeywords(vendor),
  });
}

export default async function Page({ params }: { params: { provider: string } }) {
  if (!isProviderSlug(params.provider)) notFound();
  const vendor = providerBySlug(params.provider);
  if (!vendor) notFound();
  return <ProviderStatusPage vendor={vendor!} />;
}
