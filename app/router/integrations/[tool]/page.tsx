import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import IntegrationPage from '@/components/seo/integrations/IntegrationPage';
import { INTEGRATION_SLUGS, integrationBySlug, integrationPath } from '@/lib/integrations';
import { TITLE_SUFFIX, pageMeta } from '@/lib/seo';

/**
 * /router/integrations/<tool>: one tool's guide (components/seo/integrations/IntegrationPage.tsx)
 * from the registry in lib/integrations.ts. The known slugs are built at build time and
 * re-rendered hourly; an unknown segment is a 404, and a differently cased one redirects to the
 * canonical slug. Public: middleware.ts exempts the path for anonymous visitors.
 */
export const revalidate = 3600;

export function generateStaticParams(): Array<{ tool: string }> {
  return INTEGRATION_SLUGS.map((tool) => ({ tool }));
}

export async function generateMetadata({ params }: { params: { tool: string } }): Promise<Metadata> {
  const i = integrationBySlug(params.tool);
  if (!i) return { title: { absolute: `Not found${TITLE_SUFFIX}` }, robots: { index: false, follow: true } };
  return pageMeta({
    title: i.title,
    description: i.description,
    path: integrationPath(i.slug),
    type: 'article',
    keywords: i.keywords,
  });
}

export default async function Page({ params }: { params: { tool: string } }) {
  const i = integrationBySlug(params.tool);
  if (!i) notFound();
  if (params.tool !== i!.slug) permanentRedirect(integrationPath(i!.slug));
  return <IntegrationPage integration={i!} />;
}
