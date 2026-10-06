import type { Metadata } from 'next';
import AccountShell from '@/components/AccountShell';
import InviteClient from './InviteClient';

export const metadata: Metadata = {
  title: 'Workspace invitation',
  robots: { index: false, follow: false },
  // The token in this URL is the invitation; it must not travel to other sites in a Referer.
  referrer: 'no-referrer',
};

/** Per-user, per-token page: never prerendered. */
export const dynamic = 'force-dynamic';

export default function InvitePage({ params }: { params: { token: string } }) {
  return (
    <AccountShell>
      <InviteClient token={params.token} />
    </AccountShell>
  );
}
