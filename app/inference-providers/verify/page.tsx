import type { Metadata } from 'next';
import { ReadingPage } from '@/components/landing/Reading';
import ConfirmNoticeEmail from './ConfirmNoticeEmail';

/**
 * Where a provider's notice email confirmation link lands (Phase 3 plan §2.10). The page confirms nothing by being
 * opened (mail scanners open links): the reader presses the button, which posts the link's values. Never indexed.
 */
export const metadata: Metadata = { title: 'Confirm your notice address', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function VerifyNoticeEmailPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const one =(k: string) => (typeof searchParams[k] === 'string' ? (searchParams[k] as string) : '');
  return (
    <ReadingPage kicker="For inference providers" title="Confirm your notice address" lead="Legal notices about a provider account on AI Stupid Level go to this address." toc={[]}>
      <ConfirmNoticeEmail p={one('p')} at={one('at')} t={one('t')} />
    </ReadingPage>
  );
}
