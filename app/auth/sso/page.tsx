import type { Metadata } from 'next';
import { SsoForm } from './SsoForm';

export const metadata: Metadata = {
  title: 'Single sign-on',
  robots: { index: false, follow: false },
};

/**
 * Dynamic, so SsoForm's useSearchParams needs no Suspense boundary, and it deliberately has none:
 * React 19 streams a finished boundary after the page shell once enough HTML has gone out, so a slow
 * connection painted its "Loading…" fallback before the form. Without one the form is in the first
 * paint, as it was on Next 14.
 */
export const dynamic = 'force-dynamic';

export default function SsoPage() {
  return <SsoForm />;
}
