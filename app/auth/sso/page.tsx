import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SsoForm } from './SsoForm';

export const metadata: Metadata = {
  title: 'Single sign-on',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function SsoPage() {
  return (
    <Suspense fallback={<div style={{ padding: 60, textAlign: 'center' }}>Loading…</div>}>
      <SsoForm />
    </Suspense>
  );
}
