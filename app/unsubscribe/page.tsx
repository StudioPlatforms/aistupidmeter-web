import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import UnsubscribeClient from './UnsubscribeClient';

export const metadata: Metadata = {
  ...pageMeta({
    title: 'Unsubscribe from emails',
    description: 'Unsubscribe from AI Stupid Level emails. This turns off the weekly digest and change alerts; your watchlist and account stay as they are.',
    path: '/unsubscribe',
    noindex: true,
  }),
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage(props: { searchParams: Promise<{ t?: string }> }) {
  const searchParams = await props.searchParams;
  return <UnsubscribeClient token={searchParams.t ?? ''} />;
}
