import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { marketplaceRead, type AgreementDTO } from '@/lib/marketplace-public';
import AgreementView from '@/components/marketplace/AgreementView';

/** One version of the Provider Listing Agreement (Phase 3 plan §4.3): the same page as the current one, for that version. */
export const dynamic = 'force-dynamic';

const VERSION = /^[0-9]{1,3}\.[0-9]{1,3}$/;

async function read(version: string) {
  if (!VERSION.test(version)) return null;
  return marketplaceRead<AgreementDTO>(`/marketplace/public/agreement/${version}`, ['mp:agreement']);
}

export async function generateMetadata(props: { params: Promise<{ version: string }> }): Promise<Metadata> {
  const params = await props.params;
  const r = await read(params.version);
  if (!r || r.kind !== 'ok') return { title: 'Page not found', robots: { index: false, follow: true } };
  return { title: `Provider Listing Agreement v${r.data.version}`, robots: { index: false, follow: false } };
}

export default async function AgreementVersionPage(props: { params: Promise<{ version: string }> }) {
  const params = await props.params;
  const r = await read(params.version);
  if (!r || r.kind !== 'ok') notFound();
  return <AgreementView a={r.data} preview={r.preview} />;
}
