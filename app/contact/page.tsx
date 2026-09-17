import type { Metadata } from 'next';
import { Suspense } from 'react';
import SubpageLayout from '@/components/SubpageLayout';
import ContactClient from './ContactClient';

export const metadata: Metadata = {
  title: 'Contact us',
  description:
    'Talk to us about plans, enterprise terms, support or security. A small team that answers its own email.',
  alternates: { canonical: '/contact' },
};

/** useSearchParams needs either a Suspense boundary or a dynamic page; it has both. */
export const dynamic = 'force-dynamic';

export default function ContactPage() {
  return (
    <SubpageLayout>
      <Suspense fallback={<div style={{ padding: 50, textAlign: 'center', color: 'var(--phosphor-dim)' }}>Loading…</div>}>
        <ContactClient />
      </Suspense>
    </SubpageLayout>
  );
}
