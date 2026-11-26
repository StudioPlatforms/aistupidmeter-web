import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import AgreementView from '@/components/marketplace/AgreementView';
import { marketplaceRead, type AgreementDTO } from '@/lib/marketplace-public';
import { pageMeta } from '@/lib/seo';

/**
 * The Provider Terms and Listing Agreement (Phase 3 plan §9.1, P2B Art. 3(1)(b): readable before anyone signs). Published at
 * the opening (M10) with version 1.0; until then a staff preview of the v0.9 draft, which nobody outside signs
 * (owner decision OD-13). The site's 404 for everyone else; never indexed before the opening.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const r = await marketplaceRead<AgreementDTO>('/marketplace/public/agreement', ['mp:agreement']);
  if (r.kind !== 'ok') return { title: 'Page not found', robots: { index: false, follow: true } };
  const title = `Provider Terms and Listing Agreement v${r.data.version}`;
  if (r.preview || r.data.legalReview !== 'reviewed') return { title, robots: { index: false, follow: false } };
  // The published agreement is a public document: its own canonical, description and share card
  // (with the title alone it went out with the home page's description and og:url, and no canonical).
  return pageMeta({
    title,
    description: `The terms an inference provider accepts to list its models on AI Stupid Level: the Provider Terms and Listing Agreement, version ${r.data.version}, in full.`,
    path: '/inference-providers/agreement',
  });
}

export default async function AgreementPage() {
  const r = await marketplaceRead<AgreementDTO>('/marketplace/public/agreement', ['mp:agreement']);
  if (r.kind !== 'ok') notFound();
  return <AgreementView a={r.data} preview={r.preview} />;
}
