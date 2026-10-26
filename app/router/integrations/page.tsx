import type { Metadata } from 'next';
import IntegrationsHub from '@/components/seo/integrations/IntegrationsHub';
import { HUB_DESCRIPTION, HUB_KEYWORDS, HUB_TITLE } from '@/components/seo/integrations/integrations-meta';
import { INTEGRATIONS_PATH } from '@/lib/integrations';
import { pageMeta } from '@/lib/seo';

/**
 * /router/integrations: the hub of the per-tool Smart Router guides
 * (components/seo/integrations/IntegrationsHub.tsx). Public: middleware.ts exempts the path for
 * anonymous visitors. Re-rendered hourly; never calls auth(), so it stays ISR.
 */
export const revalidate = 3600;

export const metadata: Metadata = pageMeta({
  title: HUB_TITLE,
  description: HUB_DESCRIPTION,
  path: INTEGRATIONS_PATH,
  keywords: HUB_KEYWORDS,
});

export default function Page() {
  return <IntegrationsHub />;
}
