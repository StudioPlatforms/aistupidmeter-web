import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SsoForm } from './SsoForm';
import AuthShell from '@/components/auth/AuthShell';

export const metadata: Metadata = {
  title: 'Single sign-on',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function SsoPage() {
  return (
    <Suspense fallback={<AuthShell mode="signin"><p className="au-busy" role="status">Loading…</p></AuthShell>}>
      <SsoForm />
    </Suspense>
  );
}
