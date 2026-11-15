'use client';

/**
 * The provider account's team (§2.15 "Team"): members with their roles, pending invitations, an
 * invitation form, what each role may do, transferring ownership, and leaving.
 *
 * It does the same job as the workspace's People tab (/account/team), so it is built from the
 * same pieces: the person row (components/workspace/PersonRow), the invitation form's fields and
 * buttons, and the same sentences ("Invite by email", "Send invitation", "Invited · until …",
 * "Emailed with a link that works for 14 days, for the invited address only."). What differs is
 * the roles (M2 API contract §3): one owner, who alone invites or removes admins, changes roles,
 * transfers ownership and closes the account; admins, who invite and remove viewers; viewers, who read.
 * At most ten people, invitations included.
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { Pane, Loader, Note, CopyButton } from '@/components/studio';
import PersonRow from '@/components/workspace/PersonRow';
import { ProviderHead, useProviderSummary } from '@/components/marketplace/ProviderBits';
import { chooseProvider, mpApi, ROLE_LABEL, type ProviderRole, type ProviderSummary } from '@/lib/provider-account';

interface Member {
  id: number; userId: number | null; role: ProviderRole; email: string | null; name: string | null;
  pending: boolean; invitedAt?: string | null; expiresAt?: string | null; expired?: boolean; self?: boolean;
}
interface Transfer { memberId: number; email?: string | null; requestedAt?: string | null; expiresAt?: string | null }
interface TeamData {
  members: Member[];
  canManage?: boolean;
  limit?: number;
  inviteTtlDays?: number;
  /** Absent when the API does not offer handing over; null when nothing is pending. */
  transfer?: Transfer | null;
}

const ROLE_TONE: Record<string, 'ink' | 'accent' | 'line'> = { owner: 'ink', admin: 'accent', viewer: 'line' };

export default function ProviderTeamClient({ initial }: { initial: ProviderSummary }) {
  const { status } = useSession();
  const [s, reloadSummary] = useProviderSummary(initial);
  const [d, setD] = useState<TeamData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [link, setLink] = useState<{ url: string; emailed: boolean } | null>(null);

  const flash = useCallback((text: string, bad = false) => { setMsg({ text, bad }); window.setTimeout(() => setMsg(null), 7000); }, []);
  const load = useCallback(async () => {
    const r = await mpApi<TeamData>('/members');
    if (r.ok && r.data) { setD(r.data); setLoadError(null); } else setLoadError(r.error);
  }, []);
  useEffect(() => { if (status === 'authenticated') void load(); }, [status, load]);

  const act = useCallback(async (path: string, method: string, body: unknown, ok: string) => {
    const r = await mpApi<{ inviteUrl?: string | null; emailed?: boolean }>(path, { method, body });
    if (r.ok) {
      flash(r.message ?? ok);
      if (r.data?.inviteUrl) setLink({ url: r.data.inviteUrl, emailed: r.data.emailed !== false });
      void load();
    }
    else flash(r.error ?? 'Something went wrong', true);
    return r;
  }, [flash, load]);

  if (status === 'loading') return <div data-page-loading><Loader label="Loading your team" minHeight={420} /></div>;

  const name = s.provider?.displayName ?? 'this provider account';
  const isOwner = s.role === 'owner';
  const canManage = d?.canManage ?? (s.role === 'owner' || s.role === 'admin');
  const all = d?.members ?? [];
  const joined = all.filter(m => !m.pending);
  const pending = all.filter(m => m.pending);
  const limit = d?.limit ?? 10;
  const ttl = d?.inviteTtlDays ?? 14;
  const transferOffered = d ? 'transfer' in d : false;
  const transfer = d?.transfer ?? null;
  const me = all.find(m => m.self);
  const offeredToMe = !!transfer && !!me && transfer.memberId === me.id;
  const target = transfer ? all.find(m => m.id === transfer.memberId) : undefined;
  /** Owners manage everyone but themselves; admins manage viewers (contract §3). */
  const manages = (m: Member) => canManage && !m.self && m.role !== 'owner' && (isOwner || m.role === 'viewer');

  const person = (m: Member) => (
    <PersonRow
      key={m.id}
      name={m.name}
      email={m.email}
      role={m.role}
      roleLabel={ROLE_LABEL[m.role] ?? m.role}
      roleTone={ROLE_TONE[m.role] ?? 'line'}
      pending={m.pending}
      expired={m.expired}
      expiresAt={m.expiresAt}
      self={m.self}
      detail={m.name && m.email ? <div className="sw-s">{m.email}</div> : undefined}
      actions={canManage ? (
        <>
          {isOwner && !m.pending && m.role !== 'owner' && (
            <select className="st-select sw-select-sm" value={m.role} aria-label={`Role of ${m.name || m.email}`}
              onChange={e => act(`/members/${m.id}`, 'PATCH', { role: e.target.value }, `${m.name || m.email} is now ${e.target.value === 'admin' ? 'an admin' : 'a viewer'}`)}>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          )}
          {m.pending && manages(m) && <button type="button" className="st-btn is-sm" onClick={() => act(`/members/${m.id}/resend`, 'POST', {}, 'Invitation sent again')}>Resend</button>}
          {manages(m) && (
            <button type="button" className="st-btn is-sm is-quiet sw-bad-text" onClick={() => {
              if (!m.pending && !window.confirm(`Remove ${m.email} from ${name}?`)) return;
              act(`/members/${m.id}`, 'DELETE', undefined, m.pending ? 'Invitation withdrawn' : 'Removed from the provider account');
            }}>{m.pending ? 'Withdraw' : 'Remove'}</button>
          )}
        </>
      ) : undefined}
    />
  );

  const leave = async () => {
    if (!window.confirm(`Leave ${name}? You lose access to it.`)) return;
    const r = await mpApi('/leave', { method: 'POST' });
    if (!r.ok) { flash(r.error ?? 'Could not leave', true); return; }
    chooseProvider(null);
    // A full page load: the sidebar's Provider group goes with the next session read.
    window.location.assign('/account');
  };

  return (
    <>
      <ProviderHead
        summary={s}
        title="Team"
        lead={`The people who run ${name}, and what each of them may do.`}
      />

      <div className="st-body sw-body">
        {msg && <div role="status" className={`st-note sw-flash${msg.bad ? ' is-bad' : ''}`}><div>{msg.text}</div></div>}
        {link && (
          <Pane
            tone="accent"
            title="Invitation link — shown once"
            sub={link.emailed
              ? 'The invitation is on its way by email. You can also pass this link on yourself; it works only for the invited address.'
              : 'The invitation was not emailed. Pass this link on yourself; it works only for the invited address.'}
          >
            <div className="st-secret"><code>{link.url}</code><CopyButton text={link.url} /></div>
            <div className="st-actions sw-gap-top">
              <button type="button" className="st-btn is-sm" onClick={() => setLink(null)}>Done</button>
            </div>
          </Pane>
        )}
        {offeredToMe && (
          <Note title={`You are asked to become the owner of ${name}`}>
            Accept to take over as owner; the current owner stays on as an admin.
            {transfer?.expiresAt && <> The offer ends on {new Date(transfer.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.</>}
            <div className="st-actions sw-gap-top">
              <button type="button" className="st-btn is-primary is-sm" onClick={async () => {
                const r = await act('/transfer/accept', 'POST', {}, `You are now the owner of ${name}`);
                if (r.ok) void reloadSummary();
              }}>Accept</button>
            </div>
          </Note>
        )}

        {!d ? (
          loadError ? <Note tone="bad" title="The team did not load">{loadError}</Note> : <Loader label="Loading your team" minHeight={320} />
        ) : (
          <div className="st-split">
            <div className="sw-col">
              <Pane title="Members" sub={`${joined.length} ${joined.length === 1 ? 'person' : 'people'} in ${name}`} ruled flush>
                <div className="sw-people">{joined.map(person)}</div>
              </Pane>
              {pending.length > 0 && (
                <Pane title="Pending invitations" sub={`${pending.length} not accepted yet`} ruled flush delay={0.05}>
                  <div className="sw-people">{pending.map(person)}</div>
                </Pane>
              )}
            </div>

            <div className="sw-col">
              {canManage && (
                <Pane title="Invite someone" delay={0.08}>
                  {all.length >= limit ? (
                    <p className="sw-quiet">{name} has {limit} people, invitations included, which is the most it can have. Remove someone to invite another.</p>
                  ) : (
                    <form className="sw-stack" onSubmit={async (e: FormEvent<HTMLFormElement>) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const f = new FormData(form);
                      const r = await act('/members', 'POST', { email: f.get('email'), role: f.get('role') }, 'Invitation sent');
                      if (r.ok) form.reset();
                    }}>
                      <label className="st-field">
                        <span className="st-field-label">Invite by email</span>
                        <input name="email" type="email" required placeholder="colleague@company.com" className="st-input" />
                      </label>
                      {isOwner ? (
                        <label className="st-field">
                          <span className="st-field-label">Role</span>
                          <select name="role" defaultValue="viewer" className="st-select" aria-label="Role">
                            <option value="viewer">Viewer (read-only)</option>
                            <option value="admin">Admin (edits the account)</option>
                          </select>
                        </label>
                      ) : (
                        <input type="hidden" name="role" value="viewer" />
                      )}
                      <button type="submit" className="st-btn is-primary is-block">Send invitation</button>
                    </form>
                  )}
                </Pane>
              )}

              <Pane title="Roles" delay={0.12}>
                <dl className="st-kv sw-kv">
                  <div><dt>Owner</dt><dd>Exactly one. The only one who invites or removes admins, changes roles, transfers ownership or closes the account.</dd></div>
                  <div><dt>Admins</dt><dd>Edit the profile, domains and data handling, and invite or remove viewers.</dd></div>
                  <div><dt>Viewers</dt><dd>See everything and change nothing.</dd></div>
                  <div><dt>Invitations</dt><dd>Emailed with a link that works for {ttl} days, for the invited address only.</dd></div>
                  <div><dt>Size</dt><dd>Up to {limit} people, invitations included.</dd></div>
                </dl>
              </Pane>

              {isOwner && transferOffered && (
                <Pane title="Transfer ownership" sub="The member you choose becomes the owner once they accept, and you stay on as an admin." delay={0.16}>
                  {transfer && !offeredToMe ? (
                    <div className="sw-stack">
                      <p className="sw-quiet">
                        Waiting for {target?.name || transfer.email || target?.email || 'them'} to accept
                        {transfer.expiresAt ? ` until ${new Date(transfer.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}.
                      </p>
                      <div className="st-actions"><button type="button" className="st-btn is-sm" onClick={() => act('/transfer', 'DELETE', undefined, 'Transfer cancelled')}>Cancel the transfer</button></div>
                    </div>
                  ) : joined.filter(m => m.role !== 'owner').length === 0 ? (
                    <p className="sw-quiet">Invite the new owner first: ownership goes only to a member who has joined.</p>
                  ) : (
                    <form className="sw-stack" onSubmit={async (e: FormEvent<HTMLFormElement>) => {
                      e.preventDefault();
                      const id = Number(new FormData(e.currentTarget).get('member'));
                      const m = joined.find(x => x.id === id);
                      if (!m || !window.confirm(`Ask ${m.name || m.email} to become the owner of ${name}?`)) return;
                      await act('/transfer', 'POST', { memberId: id }, `Ownership offered to ${m.name || m.email}`);
                    }}>
                      <label className="st-field">
                        <span className="st-field-label">New owner</span>
                        <select name="member" className="st-select" defaultValue="">
                          <option value="" disabled>Choose a member</option>
                          {joined.filter(m => m.role !== 'owner').map(m => <option key={m.id} value={m.id}>{m.name || m.email} ({ROLE_LABEL[m.role]})</option>)}
                        </select>
                      </label>
                      <button type="submit" className="st-btn is-block">Transfer ownership</button>
                    </form>
                  )}
                </Pane>
              )}

              {!isOwner && (
                <Pane title="Leave the provider account" sub="You lose access to it." delay={0.16}>
                  <button type="button" className="st-btn is-danger" onClick={leave}>Leave provider account</button>
                </Pane>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
