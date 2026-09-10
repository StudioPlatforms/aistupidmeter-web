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

interface Member { id: number; role: string; email: string | null; name: string | null; pending: boolean }
interface Project { id: number; name: string; created_at: string }
interface Hook { id: number; url: string; events: string; active: number; last_sent_at: string | null; last_status: number | null }
interface Org { id: number; name: string; plan: string; createdAt: string }
interface Data {
  org: Org | null; role?: string; plan: string;
  seatLimit: number; seatsUsed?: number; projectLimit: number;
  canCreate?: boolean;
  members?: Member[]; projects?: Project[]; webhooks?: Hook[];
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

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3500); };
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
    if (j?.success) { flash(ok); if (j.data?.secret) setSecret(j.data.secret); load(); }
    else flash(j?.message ?? j?.error ?? 'Something went wrong');
    return j;
  };
  const del = async (path: string, ok: string) => {
    const r = await fetch(`/api/account/org${path}`, { method: 'DELETE' });
    const j = await r.json();
    flash(j?.success ? ok : (j?.error ?? 'Failed'));
    load();
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
  if (loading) return <div style={{ padding: 50, textAlign: 'center', color: 'var(--phosphor-dim)' }}>Loading…</div>;

  // Plan does not include a shared workspace.
  if (!d?.org && d?.canCreate === false) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '50px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.35em', marginBottom: 10 }}>Workspaces start on Developer</h1>
        <p style={{ color: 'var(--phosphor-dim)', lineHeight: 1.65, marginBottom: 24 }}>
          Developer gives you a workspace of your own with one project, to keep a piece of work and
          its watchlist separate. Teams opens it up: five editor seats, unlimited viewers, three
          projects, webhooks, single sign-on and the audit trail.
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
            ? <>A workspace keeps a piece of work and its watchlist separate from the rest of your
                account. Your plan includes {plural(d.projectLimit, 'project')} and one editor seat.
                You can still invite people as viewers — those do not use a seat — and Teams adds
                more editors.</>
            : <>A workspace is where your team shares monitoring. You get{' '}
                {plural(d.seatLimit, 'editor seat')}, unlimited viewers and{' '}
                {plural(d.projectLimit, 'project')}.</>}
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
  const seatsUsed = d.seatsUsed ?? 0;

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '26px 20px 70px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20, gap: 12 }}>
        <h1 style={{ fontSize: '1.4em', margin: 0 }}>{d.org.name}</h1>
        {msg && <span style={{ fontSize: '0.82em', color: 'var(--phosphor-green)' }}>{msg}</span>}
      </div>

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
          {seatsUsed} of {d.seatLimit} editor seats used. <strong>Owners and editors take a seat;
          viewers are unlimited</strong>, and a pending invite holds its seat until it is accepted
          or removed.
        </p>
        {(d.members ?? []).map((m, i) => (
          <div key={m.id} style={{ ...rowS, ...(i === 0 ? { borderTop: 'none' } : {}) }}>
            <div>
              <div style={{ fontSize: '0.88em' }}>{m.email ?? '—'}{m.pending && <span style={{ color: 'var(--amber-warning)', marginLeft: 8, fontSize: '0.85em' }}>pending</span>}</div>
              <div style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)', marginTop: 2, textTransform: 'capitalize' }}>{m.role}</div>
            </div>
            {isOwner && m.role !== 'owner' && (
              <button className="md-ctrl-btn" style={{ fontSize: '0.8em' }} onClick={() => del(`/members/${m.id}`, 'Member removed')}>Remove</button>
            )}
          </div>
        ))}
        {isOwner && (
          <form onSubmit={async e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await post('/members', { email: f.get('email'), role: f.get('role') }, 'Invitation recorded');
            (e.target as HTMLFormElement).reset();
          }} style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <input name="email" type="email" required placeholder="colleague@company.com" style={{ ...field, flex: 1, minWidth: 190 }} />
            <select name="role" style={field} defaultValue="viewer">
              <option value="viewer">Viewer (free)</option>
              <option value="editor">Editor (uses a seat)</option>
            </select>
            <button className="md-ctrl-btn" style={{ padding: '8px 14px' }}>Invite</button>
          </form>
        )}
      </section>

      {/* Projects */}
      <section style={card}>
        <h2 style={h2}>Projects</h2>
        <p style={sub}>
          {(d.projects ?? []).length} of {d.projectLimit} used. Projects keep separate workloads —
          or separate clients — from sharing one watchlist.
        </p>
        {(d.projects ?? []).map((p, i) => (
          <div key={p.id} style={{ ...rowS, ...(i === 0 ? { borderTop: 'none' } : {}) }}>
            <span style={{ fontSize: '0.88em' }}>{p.name}</span>
            <button className="md-ctrl-btn" style={{ fontSize: '0.8em' }} onClick={() => del(`/projects/${p.id}`, 'Project deleted')}>Delete</button>
          </div>
        ))}
        <form onSubmit={async e => {
          e.preventDefault();
          const name = new FormData(e.currentTarget).get('name');
          await post('/projects', { name }, 'Project created');
          (e.target as HTMLFormElement).reset();
        }} style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <input name="name" required placeholder="Client A" style={{ ...field, flex: 1, minWidth: 190 }} />
          <button className="md-ctrl-btn" style={{ padding: '8px 14px' }}>Add project</button>
        </form>
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
