'use client';

/**
 * Accepting a workspace invitation — where the link in the invitation email lands.
 *
 * The invitation is bound to the address it was sent to: the API accepts it only for an account
 * with that email, so a forwarded link cannot put someone else into the workspace. This page's
 * job is to get the visitor into the right account first (sign in, create one, or switch) and to
 * say plainly why when it cannot be accepted.
 */

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

interface Invite {
  workspace: string;
  invitedBy: string | null;
  role: 'editor' | 'viewer' | string;
  invitedEmail: string;
  signedInAs: string | null;
  emailMatches: boolean;
  expired: boolean;
  expiresAt: string;
  plan: string;
}

const wrap: React.CSSProperties = { maxWidth: 560, margin: '0 auto', padding: '48px 20px 70px' };
const card: React.CSSProperties = {
  border: '1px solid var(--border-subtle, #2a2a2a)', borderRadius: 6, padding: '24px 24px 22px',
  background: 'var(--terminal-dark)',
};
const muted: React.CSSProperties = { color: 'var(--phosphor-dim)', lineHeight: 1.65, fontSize: '0.92em', margin: '0 0 14px' };
const btn: React.CSSProperties = { padding: '10px 20px', textDecoration: 'none', display: 'inline-block' };

const PLAN_LABEL: Record<string, string> = {
  free: 'Free', pro: 'Pro', developer: 'Developer', teams: 'Teams', enterprise: 'Enterprise', legacy_pro: 'Pro',
};

export default function InviteClient({ token }: { token: string }) {
  const { status } = useSession();
  const here = `/account/invite/${encodeURIComponent(token)}`;
  const [invite, setInvite] = useState<Invite | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [joined, setJoined] = useState<{ workspace: string; role: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch(`/api/account/org/invites/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j?.success) setInvite(j.data); else setProblem(j?.message ?? 'This invitation could not be read.'); })
      .catch(() => setProblem('This invitation could not be read right now. Try again in a moment.'));
  }, [status, token]);

  const accept = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/account/org/invites/${encodeURIComponent(token)}/accept`, { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (j?.success) setJoined({ workspace: j.data.workspace, role: j.data.role });
      else setProblem(j?.message ?? j?.error ?? 'The invitation could not be accepted.');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') {
    return <div data-page-loading style={{ padding: 60, textAlign: 'center', color: 'var(--phosphor-dim)' }}>Loading…</div>;
  }

  if (status === 'unauthenticated') {
    const cb = encodeURIComponent(here);
    return (
      <div style={wrap}>
        <div style={card}>
          <h1 style={{ fontSize: '1.3em', margin: '0 0 10px' }}>You have been invited to a workspace</h1>
          <p style={muted}>
            Sign in with the email address the invitation was sent to, or create an account with that
            address. You will come straight back here to accept.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href={`/auth/signin?callbackUrl=${cb}`} className="vintage-btn vintage-btn--primary" style={btn}>Sign in</Link>
            <Link href={`/auth/signup?callbackUrl=${cb}`} className="vintage-btn" style={btn}>Create an account</Link>
          </div>
        </div>
      </div>
    );
  }

  if (joined) {
    return (
      <div style={wrap}>
        <div style={card}>
          <h1 style={{ fontSize: '1.3em', margin: '0 0 10px' }}>You joined {joined.workspace}</h1>
          <p style={muted}>
            You are {joined.role === 'editor' ? 'an editor' : 'a viewer'} in this workspace.
            {joined.role === 'editor' && ' Its plan now applies to your account.'}
          </p>
          <Link href="/account/team" className="vintage-btn vintage-btn--primary" style={btn}>Open the workspace</Link>
        </div>
      </div>
    );
  }

  if (problem && !invite) {
    return (
      <div style={wrap}>
        <div style={card}>
          <h1 style={{ fontSize: '1.3em', margin: '0 0 10px' }}>This invitation cannot be used</h1>
          <p style={muted}>{problem}</p>
          <Link href="/account/team" className="vintage-btn" style={btn}>Go to your workspace page</Link>
        </div>
      </div>
    );
  }

  if (!invite) {
    return <div data-page-loading style={{ padding: 60, textAlign: 'center', color: 'var(--phosphor-dim)' }}>Loading…</div>;
  }

  const roleText = invite.role === 'editor'
    ? `as an editor. Editors use one of the workspace's seats and get its ${PLAN_LABEL[invite.plan] ?? invite.plan} plan.`
    : 'as a viewer. Viewers do not use a seat.';

  return (
    <div style={wrap}>
      <div style={card}>
        <h1 style={{ fontSize: '1.3em', margin: '0 0 10px' }}>Join {invite.workspace}</h1>
        <p style={muted}>
          {invite.invitedBy ? <>{invite.invitedBy} invited </> : <>You were invited </>}
          <strong style={{ color: 'var(--phosphor-green)' }}>{invite.invitedEmail}</strong> to
          the {invite.workspace} workspace {roleText}
        </p>

        {invite.expired ? (
          <p style={{ ...muted, color: 'var(--red-alert)', marginBottom: 0 }}>
            This invitation expired on {new Date(invite.expiresAt).toLocaleDateString()}.
            Ask {invite.invitedBy ?? 'the workspace owner'} to send it again from the workspace page.
          </p>
        ) : !invite.emailMatches ? (
          <>
            <p style={{ ...muted, color: 'var(--amber-warning)' }}>
              You are signed in as <strong>{invite.signedInAs ?? 'another account'}</strong>. This invitation
              can only be accepted by {invite.invitedEmail}.
            </p>
            <button type="button" className="vintage-btn vintage-btn--primary" style={btn}
              onClick={() => signOut({ callbackUrl: `/auth/signin?callbackUrl=${encodeURIComponent(here)}` })}>
              Sign out and switch account
            </button>
          </>
        ) : (
          <>
            {problem && <p style={{ ...muted, color: 'var(--red-alert)' }}>{problem}</p>}
            <button type="button" className="vintage-btn vintage-btn--primary" style={btn} disabled={busy} onClick={accept}>
              {busy ? 'Joining…' : 'Accept invitation'}
            </button>
            <p style={{ ...muted, fontSize: '0.82em', margin: '14px 0 0' }}>
              The link works until {new Date(invite.expiresAt).toLocaleDateString()}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
