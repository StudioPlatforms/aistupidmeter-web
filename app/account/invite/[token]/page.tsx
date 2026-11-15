import { cache } from 'react';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import AccountShell from '@/components/AccountShell';
import { isProviderInvitation } from '@/lib/provider-membership';
import InviteClient from './InviteClient';

/**
 * Which kind of invitation this token is, decided here on the server from the token itself, never
 * from the URL: a provider-account invitation only when the visitor is signed in and the API opens
 * that invitation for them (GET /account/provider/invites/:token → 200; it answers 404 to an
 * unknown or used token and to every account provider accounts are not switched on for). Everyone
 * else, signed-out visitors included, gets the workspace invitation page exactly as before; a
 * provider invitee signs in from it and comes back to the same address, which then opens as a
 * provider invitation. Asked once per request (metadata and body).
 */
const invitationKind = cache(async (token: string): Promise<'provider' | 'workspace'> => {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  if (!userId) return 'workspace';
  return (await isProviderInvitation(userId, token)) ? 'provider' : 'workspace';
});

export async function generateMetadata(props: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const params = await props.params;
  return {
    title: (await invitationKind(params.token)) === 'provider' ? 'Provider account invitation' : 'Workspace invitation',
    robots: { index: false, follow: false },
    // The token in this URL is the invitation; it must not travel to other sites in a Referer.
    referrer: 'no-referrer',
  };
}

/** Per-user, per-token page: never prerendered. */
export const dynamic = 'force-dynamic';

export default async function InvitePage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  return (
    <AccountShell>
      <InviteClient token={params.token} kind={await invitationKind(params.token)} />
    </AccountShell>
  );
}
