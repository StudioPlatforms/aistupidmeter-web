import type { Metadata } from 'next';
import AccountShell from '@/components/AccountShell';
import ProjectClient from './ProjectClient';

export const metadata: Metadata = {
  title: 'Project',
  description: 'A workspace project: its people, watchlist, Smart Router keys, budget and spending.',
  robots: { index: false, follow: false },
};

/** Per-user page — never statically prerendered. */
export const dynamic = 'force-dynamic';

export default function ProjectPage({ params }: { params: { id: string } }) {
  return (
    <AccountShell>
      <ProjectClient id={params.id} />
    </AccountShell>
  );
}
