'use client';

/**
 * Shared workspace: members, projects, webhooks.
 *
 * The seat rule is stated on the page rather than left to be discovered by
 * hitting the limit: owner and editors consume a seat, viewers never do. "Five
 * editors, unlimited viewers" is not guessable from a number alone, and someone
 * who invites five viewers and then cannot add an engineer will reasonably think
 * it is broken.
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface Member {
  id: number; role: string; email: string | null; name: string | null; pending: boolean;
  invitedAt?: string; expired?: boolean; expiresAt?: string | null; deactivated?: boolean;
  provisionedBy?: string; self?: boolean; inviteUrl?: string | null;
}
interface Project { id: number; name: string; created_at: string }
interface Hook { id: number; url: string; events: string; active: number; last_sent_at: string | null; last_status: number | null }
interface Org { id: number; name: string; plan: string; createdAt: string }
interface Data {
  org: Org | null; role?: string; plan: string;
  seatLimit: number; seatsUsed?: number; projectLimit: number;
  canCreate?: boolean;
  members?: Member[]; projects?: Project[]; webhooks?: Hook[];
  inviteTtlDays?: number;
}

const card: React.CSSProperties = {
  border: '1px solid var(--border-subtle, #2a2a2a)', borderRadius: 6,
  padding: '18px 20px', marginBottom: 16,
};
const h2: React.CSSProperties = { fontSize: '1.02em', margin: '0 0 4px', fontWeight: 600 };
const sub: React.CSSProperties = { fontSize: '0.85em', color: 'var(--phosphor-dim)', margin: '0 0 16px', lineHeight: 1.6 };
const rowS: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14,
  padding: '11px 0', borderTop: '1px solid var(--border-subtle, #2a2a2a)',
};
/** "1 project" / "3 projects" / "Unlimited projects" — never "1 projects". */
function plural(n: number | undefined, noun: string): string {
  if (n === undefined) return noun;
  if (n === -1) return `unlimited ${noun}s`;
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** "2 of 5 editor seats used", or "2 editor seats used — no limit on your plan" (-1 = unlimited). */
function usage(used: number, limit: number | undefined, noun: string): string {
  if (limit === -1) return `${plural(used, noun)} used — no limit on your plan`;
  return `${used} of ${limit ?? 0} ${noun}${limit === 1 ? '' : 's'} used`;
}

const day = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';

const field: React.CSSProperties = {
  padding: '8px 10px', background: 'rgba(0,0,0,0.04)',
  border: '1px solid var(--border-subtle, #2a2a2a)', borderRadius: 3,
  color: 'inherit', font: 'inherit', fontSize: '0.86em',
};

export default function TeamClient() {
  const { status } = useSession();
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 7000); };
  const load = () => fetch('/api/account/org', { cache: 'no-store' })
    .then(r => r.json()).then(j => { if (j?.success) setD(j.data); }).finally(() => setLoading(false));

  useEffect(() => {
    if (status === 'authenticated') load();
    else if (status === 'unauthenticated') setLoading(false);
  }, [status]);

  const post = async (path: string, body: any, ok: string) => {
    const r = await fetch(`/api/account/org${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j?.success) { flash(j?.message ?? ok); if (j.data?.secret) setSecret(j.data.secret); load(); }
    else flash(j?.message ?? j?.error ?? 'Something went wrong');
    return j;
  };
  const del = async (path: string, ok: string) => {
    const r = await fetch(`/api/account/org${path}`, { method: 'DELETE' });
    const j = await r.json();
    flash(j?.success ? ok : (j?.message ?? j?.error ?? 'Failed'));
    load();
  };
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); flash('Invitation link copied'); }
    catch { window.prompt('Copy the invitation link:', text); }
  };

  if (status === 'unauthenticated') {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.3em', marginBottom: 12 }}>Team</h1>
        <p style={{ color: 'var(--phosphor-dim)', marginBottom: 22 }}>Sign in to manage your workspace.</p>
        <Link href="/auth/signin" className="vintage-btn" style={{ padding: '11px 22px', textDecoration: 'none' }}>Sign in</Link>
      </div>
    );
  }
  if (loading) return <div data-page-loading style={{ padding: 50, textAlign: 'center', color: 'var(--phosphor-dim)' }}>Loading…</div>;

  // Plan does not include a shared workspace.
  if (!d?.org && d?.canCreate === false) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '50px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.35em', marginBottom: 10 }}>Workspaces start on Developer</h1>
        <p style={{ color: 'var(--phosphor-dim)', lineHeight: 1.65, marginBottom: 24 }}>
          Developer gives you a workspace of your own. Teams opens it up: five editors, each with the
          full Teams plan, plus unlimited read-only viewers, webhooks, single sign-on and an audit trail.
        </p>
        <Link href="/pricing" className="vintage-btn" style={{ padding: '11px 22px', textDecoration: 'none' }}>
          Compare plans
        </Link>
      </div>
    );
  }

  // Eligible, but no workspace created yet. `d` is non-null here: the loading and
  // unauthenticated branches have returned, and a successful load always sets it.
  if (!d) return <div style={{ padding: 50, textAlign: 'center', color: 'var(--phosphor-dim)' }}>Could not load your workspace.</div>;
  if (!d.org) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '50px 20px' }}>
        <h1 style={{ fontSize: '1.35em', marginBottom: 8 }}>Create your workspace</h1>
        <p style={{ color: 'var(--phosphor-dim)', lineHeight: 1.65, marginBottom: 20 }}>
          {d.seatLimit === 1
            ? <>A workspace is where you manage who has access. Your plan includes one editor seat —
                yours. You can invite people as read-only viewers, which do not use a seat; Teams adds
                four more editors, each with the full Teams plan.</>
            : <>A workspace is where you manage your team. You get{' '}
                {plural(d.seatLimit, 'editor seat')} — every editor gets your plan&rsquo;s features and
                limits — plus unlimited read-only viewers.</>}
        </p>
        <form onSubmit={async e => {
          e.preventDefault();
          const name = new FormData(e.currentTarget).get('name');
          await post('', { name }, 'Workspace created');
        }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input name="name" required placeholder="Acme AI" style={{ ...field, flex: 1, minWidth: 200 }} />
          <button className="vintage-btn" style={{ padding: '9px 18px' }}>Create</button>
        </form>
        {msg && <p style={{ fontSize: '0.85em', color: 'var(--amber-warning)', marginTop: 12 }}>{msg}</p>}
      </div>
    );
  }

  const isOwner = d.role === 'owner';
  // Projects need a seat (owner or editor); the API refuses viewers.
  const canEdit = d.role === 'owner' || d.role === 'editor';
  const seatsUsed = d.seatsUsed ?? 0;

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '26px 20px 70px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20, gap: 12 }}>
        <h1 style={{ fontSize: '1.4em', margin: 0 }}>{d.org.name}</h1>
        <Link href="/docs/teams" style={{ fontSize: '0.85em', color: 'var(--accent, #1a73e8)', whiteSpace: 'nowrap' }}>
          How workspaces work →
        </Link>
      </div>
      {msg && (
        <div role="status" style={{ ...card, padding: '10px 14px', fontSize: '0.86em', borderColor: 'rgba(26,115,232,0.35)', background: 'rgba(26,115,232,0.06)' }}>
          {msg}
        </div>
      )}

      {secret && (
        <div style={{ ...card, borderColor: 'var(--amber-warning)' }}>
          <strong style={{ fontSize: '0.9em' }}>Signing secret — shown once</strong>
          <p style={{ fontSize: '0.82em', color: 'var(--phosphor-dim)', margin: '6px 0 8px', lineHeight: 1.55 }}>
            Verify each delivery by recomputing <code>HMAC-SHA256(timestamp + &quot;.&quot; + body)</code> and
            comparing with the <code>X-ASL-Signature</code> header. Reject anything whose
            <code> X-ASL-Timestamp</code> is more than a few minutes old.
          </p>
          <code style={{ fontSize: '0.8em', wordBreak: 'break-all' }}>{secret}</code>
          <div><button className="md-ctrl-btn" style={{ marginTop: 10, fontSize: '0.8em' }} onClick={() => setSecret(null)}>Done</button></div>
        </div>
      )}

      {/* Members */}
      <section style={card}>
        <h2 style={h2}>Members</h2>
        <p style={sub}>
          {usage(seatsUsed, d.seatLimit, 'editor seat')}. <strong>Owners and editors take a seat and
          get the workspace&rsquo;s plan; viewers do not use a seat.</strong> A pending invitation holds
          its seat until it is accepted or removed. Invitations are emailed with a link that works for{' '}
          {d.inviteTtlDays ?? 14} days, for the invited address only.
        </p>
        {(d.members ?? []).map((m, i) => (
          <div key={m.id} style={{ ...rowS, ...(i === 0 ? { borderTop: 'none' } : {}), flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.88em', wordBreak: 'break-all' }}>
                {m.email ?? '—'}
                {m.self && <span style={{ color: 'var(--phosphor-dim)', marginLeft: 6 }}>(you)</span>}
                {m.pending && !m.expired && <span style={{ color: 'var(--amber-warning)', marginLeft: 8, fontSize: '0.85em' }}>invited</span>}
                {m.pending && m.expired && <span style={{ color: 'var(--red-alert)', marginLeft: 8, fontSize: '0.85em' }}>invitation expired</span>}
                {m.deactivated && <span style={{ color: 'var(--red-alert)', marginLeft: 8, fontSize: '0.85em' }}>deactivated</span>}
              </div>
              <div style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)', marginTop: 2 }}>
                <span style={{ textTransform: 'capitalize' }}>{m.role}</span>
                {m.pending && !m.expired && m.expiresAt && <> · link works until {day(m.expiresAt)}</>}
                {m.provisionedBy === 'scim' && <> · managed by your directory</>}
                {m.provisionedBy === 'sso' && <> · joined through single sign-on</>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {isOwner && m.pending && (
                <button className="md-ctrl-btn" style={{ fontSize: '0.8em' }}
                  onClick={() => post(`/members/${m.id}/resend`, {}, 'Invitation sent again')}>Resend</button>
              )}
              {isOwner && m.pending && m.inviteUrl && !m.expired && (
                <button className="md-ctrl-btn" style={{ fontSize: '0.8em' }} onClick={() => copy(m.inviteUrl!)}>Copy link</button>
              )}
              {isOwner && m.role !== 'owner' && (
                <button className="md-ctrl-btn" style={{ fontSize: '0.8em' }}
                  onClick={() => del(`/members/${m.id}`, m.pending ? 'Invitation withdrawn' : 'Member removed')}>
                  {m.pending ? 'Withdraw' : 'Remove'}
                </button>
              )}
            </div>
          </div>
        ))}
        {isOwner && (
          <form onSubmit={async e => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            const j = await post('/members', { email: f.get('email'), role: f.get('role') }, 'Invitation sent');
            if (j?.success) form.reset();
          }} style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <input name="email" type="email" required placeholder="colleague@company.com" style={{ ...field, flex: 1, minWidth: 190 }} />
            <select name="role" style={field} defaultValue="viewer" aria-label="Role">
              <option value="viewer">Viewer (free)</option>
              <option value="editor">Editor (uses a seat)</option>
            </select>
            <button className="md-ctrl-btn" style={{ padding: '8px 14px' }}>Send invitation</button>
          </form>
        )}
        {!isOwner && (
          <div style={{ marginTop: 14 }}>
            <button className="md-ctrl-btn" style={{ fontSize: '0.8em' }}
              onClick={async () => {
                if (!window.confirm(`Leave ${d.org!.name}? You will lose access to it and to any plan it gives you.`)) return;
                const r = await fetch('/api/account/org/leave', { method: 'POST' });
                const j = await r.json().catch(() => ({}));
                if (j?.success) { window.location.reload(); } else { flash(j?.message ?? j?.error ?? 'Could not leave'); }
              }}>Leave workspace</button>
          </div>
        )}
      </section>

      {/* Projects */}
      <section style={card}>
        <h2 style={h2}>Projects</h2>
        <p style={sub}>
          {usage((d.projects ?? []).length, d.projectLimit, 'project')}. Projects are names for organising
          your team&rsquo;s work; watchlists, keys and reports are not yet scoped to a project.
        </p>
        {(d.projects ?? []).map((p, i) => (
          <div key={p.id} style={{ ...rowS, ...(i === 0 ? { borderTop: 'none' } : {}) }}>
            <span style={{ fontSize: '0.88em' }}>{p.name}</span>
            {canEdit && <button className="md-ctrl-btn" style={{ fontSize: '0.8em' }} onClick={() => del(`/projects/${p.id}`, 'Project deleted')}>Delete</button>}
          </div>
        ))}
        {canEdit && (
          <form onSubmit={async e => {
            e.preventDefault();
            const name = new FormData(e.currentTarget).get('name');
            await post('/projects', { name }, 'Project created');
            (e.target as HTMLFormElement).reset();
          }} style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <input name="name" required placeholder="Client A" style={{ ...field, flex: 1, minWidth: 190 }} />
            <button className="md-ctrl-btn" style={{ padding: '8px 14px' }}>Add project</button>
          </form>
        )}
      </section>

      {/* Webhooks */}
      <section style={{ ...card, marginBottom: 0 }}>
        <h2 style={h2}>Webhooks</h2>
        <p style={sub}>
          Confirmed changes are POSTed to your endpoint as signed JSON, so findings can reach your
          own tooling without anyone reading an email. Delivery is one attempt with a five-second
          timeout — we record the outcome rather than retrying.
        </p>
        {(d.webhooks ?? []).map((w, i) => (
          <div key={w.id} style={{ ...rowS, ...(i === 0 ? { borderTop: 'none' } : {}) }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.85em', wordBreak: 'break-all' }}>{w.url}</div>
              <div style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)', marginTop: 2 }}>
                {w.active ? 'Active' : 'Paused'}
                {w.last_sent_at ? ` · last delivery ${w.last_status === 0 ? 'failed' : `HTTP ${w.last_status}`}` : ' · never delivered'}
              </div>
            </div>
            {isOwner && (
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="md-ctrl-btn" style={{ fontSize: '0.8em' }}
                  onClick={async () => {
                    await fetch(`/api/account/org/webhooks/${w.id}`, {
                      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ active: !w.active }),
                    });
                    load();
                  }}>{w.active ? 'Pause' : 'Resume'}</button>
                <button className="md-ctrl-btn" style={{ fontSize: '0.8em' }} onClick={() => del(`/webhooks/${w.id}`, 'Webhook removed')}>Remove</button>
              </div>
            )}
          </div>
        ))}
        {isOwner && (
          <form onSubmit={async e => {
            e.preventDefault();
            const url = new FormData(e.currentTarget).get('url');
            await post('/webhooks', { url }, 'Webhook added');
            (e.target as HTMLFormElement).reset();
          }} style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <input name="url" type="url" required placeholder="https://your-app.example.com/asl" style={{ ...field, flex: 1, minWidth: 220 }} />
            <button className="md-ctrl-btn" style={{ padding: '8px 14px' }}>Add webhook</button>
          </form>
        )}
        <p style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)', marginTop: 14, marginBottom: 0 }}>
          HTTPS only, and we will not deliver to private or loopback addresses.
        </p>
      </section>
    </div>
  );
}
