import type { Metadata } from 'next';
import { Suspense } from 'react';
import CompleteClient from './CompleteClient';

export const metadata: Metadata = {
  title: 'Signing you in',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function SsoCompletePage() {
  return (
    <Suspense fallback={<div style={{ padding: 80, textAlign: 'center' }}>Loading…</div>}>
      <CompleteClient />
    </Suspense>
  );
}
