import UnsubscribeClient from './UnsubscribeClient';

export const metadata = { robots: { index: false, follow: false } };

export default function UnsubscribePage({ searchParams }: { searchParams: { t?: string } }) {
  return <UnsubscribeClient token={searchParams.t ?? ''} />;
}
