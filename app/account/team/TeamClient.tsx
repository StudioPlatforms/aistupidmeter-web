'use client';

/**
 * The workspace: its projects and what they spend, who works on what, the team watchlist, the
 * people in it, and (for the owner) the provider keys and webhooks the whole workspace shares.
 *
 * The seat rule is stated on the page rather than left to be discovered by hitting the limit:
 * owner and editors consume a seat, viewers never do.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import '@/styles/workspace.css';
import Tabs, { useTab } from '@/components/workspace/Tabs';
import SpendChart from '@/components/workspace/SpendChart';
import WatchlistPanel from '@/components/workspace/WatchlistPanel';
import {
  wsApi, money, pct, num, ago, day, ROLE_LABEL, PROVIDERS, providerLabel,
  type ModelOption, type WatchModel,
} from '@/components/workspace/ws';

interface Member {
  id: number; userId: number | null; role: string; email: string | null; name: string | null; pending: boolean;
  invitedAt?: string; expired?: boolean; expiresAt?: string | null; deactivated?: boolean;
  provisionedBy?: string; self?: boolean; inviteUrl?: string | null;
}
interface ProjectSummary {
  id: number; name: string; description: string | null; created_at: string; people: number; myRole: string | null;
  managers: string[]; watching: number; monthSpendUsd: number | null; monthRequests: number; lastRequestAt: string | null;
  budgetUsd: number | null; budgetMode: string;
}
interface Hook { id: number; url: string; events: string; active: number; last_sent_at: string | null; last_status: number | null; project_id: number | null; projectName: string | null }
interface Org { id: number; name: string; plan: string; createdAt: string }
interface Data {
  org: Org | null; role?: string; plan: string;
  seatLimit: number; seatsUsed?: number; projectLimit: number; projectCount?: number;
  canCreate?: boolean; canCreateProject?: boolean; webhooksAllowed?: boolean;
  members?: Member[]; projects?: ProjectSummary[]; webhooks?: Hook[]; webhookEvents?: string[];
  inviteTtlDays?: number;
  teamAlerts?: { minDropPoints: number; recipients: string; mutedForMe: boolean };
}

/** "1 project" / "3 projects" / "unlimited projects" — never "1 projects" or "-1". */
function plural(n: number | undefined, noun: string): string {
  if (n === undefined) return noun;
  if (n === -1) return `unlimited ${noun}s`;
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
function usage(used: number, limit: number | undefined, noun: string): string {
  if (limit === -1) return `${plural(used, noun)} used — no limit on your plan`;
  return `${used} of ${limit ?? 0} ${noun}${limit === 1 ? '' : 's'} used`;
}

const EVENT_WORDS: Record<string, string> = {
  'model.regression': 'A watched model dropped or regressed',
  'budget.threshold': 'A project crossed a budget threshold',
  'budget.exceeded': 'A project reached its budget',
  'member.cap_warning': 'Someone used 80% of their cap',
  'member.cap_reached': 'Someone reached their cap',
};

export default function TeamClient() {
  const { status } = useSession();
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const flash = useCallback((text: string, bad = false) => { setMsg({ text, bad }); window.setTimeout(() => setMsg(null), 7000); }, []);
  const load = useCallback(() => fetch('/api/account/org', { cache: 'no-store' })
    .then(r => r.json()).then(j => { if (j?.success) setD(j.data); }).catch(() => null).finally(() => setLoading(false)), []);

  useEffect(() => {
    if (status === 'authenticated') load();
    else if (status === 'unauthenticated') setLoading(false);
  }, [status, load]);

  const act = useCallback(async (path: string, method: string, body: unknown, ok: string) => {
    const r = await wsApi<any>(path, { method, body });
    if (r.ok) { flash(r.message ?? ok); if (r.data?.secret) setSecret(r.data.secret); load(); }
    else flash(r.error ?? 'Something went wrong', true);
    return r;
  }, [flash, load]);

  if (status === 'unauthenticated') {
    return (
      <div className="ws-page narrow" style={{ textAlign: 'center', paddingTop: 60 }}>
        <h1 className="ws-title">Team</h1>
        <p className="ws-sub" style={{ marginBottom: 22 }}>Sign in to manage your workspace.</p>
        <Link href="/auth/signin" className="ws-btn primary">Sign in</Link>
      </div>
    );
  }
  if (loading) return <div data-page-loading className="ws-page" style={{ textAlign: 'center', color: 'var(--phosphor-dim)' }}>Loading…</div>;

  if (!d?.org && d?.canCreate === false) {
    return (
      <div className="ws-page narrow" style={{ textAlign: 'center', paddingTop: 50 }}>
        <h1 className="ws-title">Workspaces start on Developer</h1>
        <p className="ws-sub" style={{ margin: '10px auto 24px', maxWidth: 560 }}>
          A workspace gives a team a shared watchlist with alerts, and projects with their own Smart
          Router keys, budgets and spend reports. Developer includes one project; Teams adds five editors,
          each with the full Teams plan, three projects, webhooks, single sign-on and an audit trail.
          Viewers are free on both.
        </p>
        <Link href="/pricing" className="ws-btn primary">Compare plans</Link>
      </div>
    );
  }
  if (!d) return <div className="ws-page" style={{ textAlign: 'center', color: 'var(--phosphor-dim)' }}>Could not load your workspace.</div>;
  if (!d.org) {
    return (
      <div className="ws-page narrow" style={{ paddingTop: 40 }}>
        <h1 className="ws-title">Create your workspace</h1>
        <p className="ws-sub" style={{ margin: '8px 0 20px' }}>
          {d.seatLimit === 1
            ? <>A workspace is where a team watches models together and runs projects with their own Smart Router keys,
                budgets and reports. Your plan includes one editor seat — yours — and {plural(d.projectLimit, 'project')}.
                Viewers do not use a seat: invite clients or colleagues to read along.</>
            : <>A workspace is where your team watches models together and runs projects with their own Smart Router keys,
                budgets and reports. You get {plural(d.seatLimit, 'editor seat')} — every editor gets your plan&rsquo;s
                features — plus unlimited read-only viewers.</>}
        </p>
        <form className="ws-form" onSubmit={async e => {
          e.preventDefault();
          await act('', 'POST', { name: new FormData(e.currentTarget).get('name') }, 'Workspace created');
        }}>
          <input name="name" required placeholder="Acme AI" className="ws-input" style={{ flex: 1, minWidth: 200 }} />
          <button className="ws-btn primary">Create</button>
        </form>
        {msg && <p className="ws-note" style={{ marginTop: 12, color: msg.bad ? 'var(--bad)' : undefined }}>{msg.text}</p>}
      </div>
    );
  }
  return <Workspace d={d} load={load} act={act} msg={msg} secret={secret} clearSecret={() => setSecret(null)} flash={flash} />;
}

type Act = (path: string, method: string, body: unknown, ok: string) => Promise<{ ok: boolean; data: any }>;

function Workspace({ d, load, act, msg, secret, clearSecret, flash }: {
  d: Data; load: () => void; act: Act; msg: { text: string; bad?: boolean } | null; secret: string | null; clearSecret: () => void;
  flash: (t: string, bad?: boolean) => void;
}) {
  const isOwner = d.role === 'owner';
  const seat = d.role === 'owner' || d.role === 'editor';
  const tabs = useMemo(() => [
    { id: 'overview', label: 'Overview' },
    { id: 'watchlist', label: 'Team watchlist' },
    { id: 'people', label: 'People' },
    ...(isOwner ? [{ id: 'settings', label: 'Keys & webhooks' }] : []),
  ], [isOwner]);
  const [tab, setTab] = useTab(tabs);

  return (
    <div className="ws-page">
      <div className="ws-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="ws-title">{d.org!.name}</h1>
          <p className="ws-sub">
            <span className="ws-chip accent">{d.org!.plan === 'enterprise' ? 'Enterprise' : d.org!.plan === 'teams' ? 'Teams' : d.org!.plan === 'developer' ? 'Developer' : d.org!.plan}</span>{' '}
            <span className="ws-chip">You: {ROLE_LABEL[d.role ?? 'viewer']}</span>
          </p>
        </div>
        <div className="ws-head-actions">
          <Link href="/docs/teams" className="ws-link">How workspaces work →</Link>
        </div>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {msg && <div role="status" className={`ws-flash${msg.bad ? ' bad' : ''}`}>{msg.text}</div>}
      {secret && (
        <div className="ws-secret">
          <strong style={{ fontSize: 14 }}>Signing secret — shown once</strong>
          <p className="ws-note" style={{ margin: '6px 0 0' }}>
            Verify each delivery by recomputing <code>HMAC-SHA256(timestamp + &quot;.&quot; + body)</code> and comparing it
            with the <code>X-ASL-Signature</code> header. Reject anything whose <code>X-ASL-Timestamp</code> is more than a few minutes old.
          </p>
          <code>{secret}</code>
          <button className="ws-btn small" onClick={clearSecret}>Done</button>
        </div>
      )}

      {tab === 'overview' && <Overview d={d} seat={seat} act={act} />}
      {tab === 'watchlist' && <TeamWatchlist isOwner={isOwner} flash={flash} />}
      {tab === 'people' && <People d={d} isOwner={isOwner} act={act} flash={flash} />}
      {tab === 'settings' && isOwner && <Settings d={d} act={act} flash={flash} load={load} />}
    </div>
  );
}

// ── Overview ───────────────────────────────────────────────────────────────

interface OverviewData {
  totals: any | null; daily: any[]; highlights: any | null; insights: string[];
  projects: Array<{ id: number; name: string }>;
  matrix: Array<{ userId: number; name: string; email: string; wsRole: string; totalSpendUsd: number; cells: Array<{ projectId: number; role: string | null; requests: number; spendUsd: number }> }>;
  members: Array<{ userId: number; name: string; costIndex: number | null; spendUsd: number }>;
}

function Overview({ d, seat, act }: { d: Data; seat: boolean; act: Act }) {
  const [ov, setOv] = useState<OverviewData | null>(null);
  useEffect(() => {
    if (!d.projects?.length) return;
    wsApi<OverviewData>('/overview?period=month').then(r => { if (r.ok) setOv(r.data); });
  }, [d.projects?.length]);
  const names = useMemo(() => new Map((ov?.matrix ?? []).map(m => [m.userId, m.name])), [ov]);
  const projects = d.projects ?? [];
  const t = ov?.totals;
  const limitReached = d.projectLimit !== -1 && (d.projectCount ?? projects.length) >= d.projectLimit;

  return (
    <>
      {seat && t && (
        <div className="ws-tiles">
          <div className="ws-tile">
            <div className="ws-tile-label">Spend this month</div>
            <div className="ws-tile-value">{money(t.spendUsd)}</div>
            <div className="ws-tile-sub">{t.spendChange === null ? 'across your projects' : <>
              <span className={t.spendChange > 0 ? 'ws-up' : 'ws-down'}>{t.spendChange > 0 ? '+' : ''}{pct(t.spendChange)}</span> on the same days last month</>}</div>
          </div>
          <div className="ws-tile">
            <div className="ws-tile-label">Requests</div>
            <div className="ws-tile-value">{num(t.requests)}</div>
            <div className="ws-tile-sub">{t.requests ? `${pct(t.successRate, 1)} answered` : 'none yet'}</div>
          </div>
          <div className="ws-tile">
            <div className="ws-tile-label">People sending requests</div>
            <div className="ws-tile-value">{num(t.activePeople)}</div>
            <div className="ws-tile-sub">of {num((d.members ?? []).filter(m => !m.pending).length)} in the workspace</div>
          </div>
          <div className="ws-tile">
            <div className="ws-tile-label">Projects</div>
            <div className="ws-tile-value">{num(projects.length)}</div>
            <div className="ws-tile-sub">{d.projectLimit === -1 ? 'no limit on your plan' : `of ${d.projectLimit} on your plan`}</div>
          </div>
        </div>
      )}

      <section className="ws-section">
        <h2>Projects</h2>
        <p className="ws-lead">
          A project is a client or product: the people working on it, the models it depends on (with alerts when one
          slips), and its own Smart Router keys, routing rules, provider keys and budget — with a report of what it
          spent and who spent it. {seat ? usage(d.projectCount ?? projects.length, d.projectLimit, 'project') + '.' : 'You see the projects you were added to.'}
        </p>
        {projects.length === 0 ? <p className="ws-empty">{seat ? 'No projects yet.' : 'No projects have been shared with you yet.'}</p> : (
          <div className="ws-table-wrap">
            <table className="ws-table ws-stack">
              <thead>
                <tr>
                  <th>Project</th>
                  <th className="ws-hide-sm">Your role</th>
                  <th className="num">People</th>
                  <th className="num ws-hide-sm">Watching</th>
                  <th style={{ minWidth: 150 }}>This month</th>
                  <th className="num ws-hide-sm">Last request</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => {
                  const used = p.budgetUsd && p.monthSpendUsd !== null ? p.monthSpendUsd / p.budgetUsd : null;
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/account/team/projects/${p.id}`} className="ws-name">{p.name}</Link>
                        <div className="ws-meta">{p.description || (p.managers.length ? `Managed by ${p.managers.join(', ')}` : '')}</div>
                      </td>
                      <td className="ws-hide-sm">{p.myRole ? ROLE_LABEL[p.myRole] : '—'}</td>
                      <td className="num" data-label="People">{p.people}</td>
                      <td className="num ws-hide-sm">{p.watching} model{p.watching === 1 ? '' : 's'}</td>
                      <td data-label="This month">
                        <div>{money(p.monthSpendUsd)}{p.budgetUsd ? <span className="dim"> of {money(p.budgetUsd)}</span> : ''}</div>
                        {used !== null && (
                          <div className={`ws-bar${used >= 1 ? ' bad' : used >= 0.8 ? ' warn' : ''}`} style={{ marginTop: 5 }} title={`${pct(used)} of the monthly budget`}>
                            <i style={{ width: `${Math.min(100, used * 100)}%` }} />
                          </div>
                        )}
                      </td>
                      <td className="num ws-hide-sm dim">{p.lastRequestAt ? ago(p.lastRequestAt) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {d.canCreateProject && (limitReached ? (
          <p className="ws-note" style={{ marginTop: 12 }}>Your plan includes {plural(d.projectLimit, 'project')}. Delete one or <Link href="/pricing" className="ws-link">upgrade</Link> for more.</p>
        ) : (
          <form className="ws-form" style={{ marginTop: 14 }} onSubmit={async e => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            const r = await act('/projects', 'POST', { name: f.get('name'), description: f.get('description') }, 'Project created');
            if (r.ok) { form.reset(); window.location.href = `/account/team/projects/${r.data.id}`; }
          }}>
            <label className="ws-field" style={{ flex: '1 1 200px' }}>
              <span>New project</span>
              <input name="name" required maxLength={80} className="ws-input" placeholder="Client A" />
            </label>
            <label className="ws-field" style={{ flex: '2 1 260px' }}>
              <span>Description (optional)</span>
              <input name="description" maxLength={300} className="ws-input" placeholder="What it is, who it is for" />
            </label>
            <button className="ws-btn primary">Create project</button>
          </form>
        ))}
      </section>

      {seat && ov && t && t.requests > 0 && (
        <section className="ws-section">
          <h2>Spend by day, this month</h2>
          <p className="ws-lead">All projects together, at each provider&rsquo;s list price for the tokens used.</p>
          <SpendChart days={ov.daily} nameOf={id => names.get(id) ?? 'Former member'} />
          {ov.insights.length > 0 && <ul className="ws-insights">{ov.insights.map(i => <li key={i}>{i}</li>)}</ul>}
        </section>
      )}

      {seat && ov && ov.matrix.length > 0 && ov.projects.length > 0 && (
        <section className="ws-section">
          <h2>Who works on what</h2>
          <p className="ws-lead">Each person&rsquo;s role in each project, and what they spent there this month.</p>
          <div className="ws-table-wrap">
            <table className="ws-table ws-matrix">
              <thead>
                <tr>
                  <th>Person</th>
                  {ov.projects.map(p => <th key={p.id} style={{ textAlign: 'center' }}><Link href={`/account/team/projects/${p.id}`}>{p.name}</Link></th>)}
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {ov.matrix.map(m => (
                  <tr key={m.userId}>
                    <td><div className="ws-name">{m.name}</div><div className="ws-meta">{ROLE_LABEL[m.wsRole]}</div></td>
                    {m.cells.map(c => (
                      <td key={c.projectId} className={`cell${c.role ? '' : ' none'}`}>
                        {c.role ? <>
                          <div>{c.spendUsd > 0 ? money(c.spendUsd) : '—'}</div>
                          <div className="r">{ROLE_LABEL[c.role]}{c.requests ? ` · ${num(c.requests)} req` : ''}</div>
                        </> : c.spendUsd > 0 ? <div title="Spent here before leaving the project">{money(c.spendUsd)}</div> : '·'}
                      </td>
                    ))}
                    <td className="num">{money(m.totalSpendUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

// ── Team watchlist ─────────────────────────────────────────────────────────

function TeamWatchlist({ isOwner, flash }: { isOwner: boolean; flash: (t: string, bad?: boolean) => void }) {
  const [w, setW] = useState<{ models: WatchModel[]; canEdit: boolean; canConfigure: boolean; limit: number | null; alerts: { minDropPoints: number; recipients: string; mutedForMe: boolean } } | null>(null);
  const [catalog, setCatalog] = useState<ModelOption[]>([]);
  const load = useCallback(() => wsApi<any>('/watchlist').then(r => { if (r.ok) setW(r.data); }), []);
  useEffect(() => { load(); wsApi<{ models: ModelOption[] }>('/models').then(r => setCatalog(r.data?.models ?? [])); }, [load]);
  if (!w) return <p className="ws-empty">Loading…</p>;

  return (
    <>
      <section className="ws-section">
        <h2>Team watchlist</h2>
        <p className="ws-lead">
          Models the whole workspace depends on. Everyone in the workspace sees this list, and when one of these models
          drops by {w.alerts.minDropPoints} points or more over a week, or a benchmark task starts failing, everyone is
          emailed{w.alerts.recipients === 'managers' ? ' (the owner and editors, as set below)' : w.alerts.recipients === 'none' ? ' — except that team emails are switched off below' : ''}.
          Projects keep their own lists.
        </p>
        <WatchlistPanel
          models={w.models} catalog={catalog} canEdit={w.canEdit} limit={w.limit}
          empty={w.canEdit ? 'Nothing on the team watchlist yet. Add the models your products run on.' : 'Nothing on the team watchlist yet.'}
          onAdd={async (modelId, note) => { const r = await wsApi('/watchlist', { method: 'POST', body: { modelId, note } }); if (r.ok) load(); return r.ok ? null : r.error; }}
          onRemove={async id => { await wsApi(`/watchlist/${id}`, { method: 'DELETE' }); load(); }}
          onNote={async (id, note) => { await wsApi(`/watchlist/${id}`, { method: 'PATCH', body: { note } }); load(); }}
        />
      </section>
      <section className="ws-section">
        <h2>Alerts</h2>
        <label className="ws-check" style={{ marginBottom: 14 }}>
          <input type="checkbox" checked={!w.alerts.mutedForMe} onChange={async e => {
            const r = await wsApi('/alerts/mute', { method: 'PUT', body: { muted: !e.target.checked } });
            if (r.ok) { flash(e.target.checked ? 'You will get team alerts again.' : 'Team alerts muted for you.'); load(); }
          }} />
          <span>Email me about the team watchlist<small>Only affects you. Your own watchlist and project alerts are separate.</small></span>
        </label>
        {isOwner && w.canConfigure && (
          <form className="ws-form" onSubmit={async e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const r = await wsApi('/alerts', { method: 'PUT', body: { minDropPoints: Number(f.get('drop')), recipients: f.get('recipients') } });
            flash(r.ok ? 'Team alert settings saved.' : (r.error ?? 'Could not save'), !r.ok);
            if (r.ok) load();
          }}>
            <label className="ws-field" style={{ width: 170 }}>
              <span>Alert on a drop of at least</span>
              <input name="drop" type="number" min={1} max={50} step={0.5} defaultValue={w.alerts.minDropPoints} className="ws-input" />
            </label>
            <label className="ws-field" style={{ flex: '1 1 220px' }}>
              <span>Who is emailed</span>
              <select name="recipients" defaultValue={w.alerts.recipients} className="ws-select">
                <option value="members">Everyone in the workspace, viewers included</option>
                <option value="managers">The owner and editors</option>
                <option value="none">Nobody (webhooks only)</option>
              </select>
            </label>
            <button className="ws-btn">Save</button>
          </form>
        )}
        <p className="ws-note" style={{ marginTop: 12 }}>
          Changes are judged on real measurements only; a model we could not measure this week is shown as such, never as a change.
          A workspace webhook also receives each alert as <code>model.regression</code>.
        </p>
      </section>
    </>
  );
}

// ── People ─────────────────────────────────────────────────────────────────

function People({ d, isOwner, act, flash }: { d: Data; isOwner: boolean; act: Act; flash: (t: string, bad?: boolean) => void }) {
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); flash('Invitation link copied'); }
    catch { window.prompt('Copy the invitation link:', text); }
  };
  return (
    <section className="ws-section">
      <h2>People</h2>
      <p className="ws-lead">
        {usage(d.seatsUsed ?? 0, d.seatLimit, 'editor seat')}. <strong>Owners and editors take a seat, get the workspace&rsquo;s
        plan, can hold Smart Router keys and change watchlists. Viewers are free and read-only</strong>: they see the team
        watchlist and the projects they are added to, and get their alerts — useful for clients and stakeholders.
        Invitations are emailed with a link that works for {d.inviteTtlDays ?? 14} days, for the invited address only.
      </p>
      <div className="ws-table-wrap">
        <table className="ws-table ws-stack">
          <thead><tr><th>Person</th><th>Role</th><th>Status</th>{(isOwner) && <th />}</tr></thead>
          <tbody>
            {(d.members ?? []).map(m => (
              <tr key={m.id}>
                <td>
                  <div className="ws-name">{m.name || m.email || '—'}{m.self && <span className="dim" style={{ fontWeight: 400 }}> (you)</span>}</div>
                  {m.name && <div className="ws-meta">{m.email}</div>}
                </td>
                <td data-label="Role">{ROLE_LABEL[m.role] ?? m.role}</td>
                <td style={{ fontSize: 12.5 }}>
                  {m.pending && !m.expired && <span className="ws-chip warn">Invited · until {day(m.expiresAt)}</span>}
                  {m.pending && m.expired && <span className="ws-chip bad">Invitation expired</span>}
                  {m.deactivated && <span className="ws-chip bad">Deactivated</span>}
                  {!m.pending && !m.deactivated && <span className="dim">{m.provisionedBy === 'scim' ? 'Managed by your directory' : m.provisionedBy === 'sso' ? 'Joined through single sign-on' : 'Member'}</span>}
                </td>
                {isOwner && (
                  <td className="actions">
                    {m.pending && <button className="ws-btn small" onClick={() => act(`/members/${m.id}/resend`, 'POST', {}, 'Invitation sent again')}>Resend</button>}{' '}
                    {m.pending && m.inviteUrl && !m.expired && <button className="ws-btn small" onClick={() => copy(m.inviteUrl!)}>Copy link</button>}{' '}
                    {m.role !== 'owner' && (
                      <button className="ws-btn small danger" onClick={() => {
                        if (!m.pending && !window.confirm(`Remove ${m.email} from the workspace? Their project keys stop working.`)) return;
                        act(`/members/${m.id}`, 'DELETE', undefined, m.pending ? 'Invitation withdrawn' : 'Removed from the workspace');
                      }}>{m.pending ? 'Withdraw' : 'Remove'}</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isOwner && (
        <form className="ws-form" style={{ marginTop: 16 }} onSubmit={async e => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          const r = await act('/members', 'POST', { email: f.get('email'), role: f.get('role') }, 'Invitation sent');
          if (r.ok) form.reset();
        }}>
          <label className="ws-field" style={{ flex: '1 1 220px' }}>
            <span>Invite by email</span>
            <input name="email" type="email" required placeholder="colleague@company.com" className="ws-input" />
          </label>
          <label className="ws-field">
            <span>Role</span>
            <select name="role" defaultValue="viewer" className="ws-select" aria-label="Role">
              <option value="viewer">Viewer (free, read-only)</option>
              <option value="editor">Editor (uses a seat)</option>
            </select>
          </label>
          <button className="ws-btn primary">Send invitation</button>
        </form>
      )}
      {!isOwner && (
        <div style={{ marginTop: 16 }}>
          <button className="ws-btn small danger" onClick={async () => {
            if (!window.confirm(`Leave ${d.org!.name}? You lose access to its projects, and your project keys stop working.`)) return;
            const r = await wsApi('/leave', { method: 'POST' });
            if (r.ok) window.location.reload(); else flash(r.error ?? 'Could not leave', true);
          }}>Leave workspace</button>
        </div>
      )}
    </section>
  );
}

// ── Keys & webhooks (owner) ────────────────────────────────────────────────

interface SharedKey { id: number; provider: string; alias: string | null; hint: string | null; active: boolean; addedBy: string | null; createdAt: string; lastValidatedAt: string | null; validationError: string | null }

function Settings({ d, act, flash, load }: { d: Data; act: Act; flash: (t: string, bad?: boolean) => void; load: () => void }) {
  const [keys, setKeys] = useState<SharedKey[] | null>(null);
  const loadKeys = useCallback(() => wsApi<{ keys: SharedKey[] }>('/provider-keys').then(r => setKeys(r.data?.keys ?? [])), []);
  useEffect(() => { loadKeys(); }, [loadKeys]);
  const events = d.webhookEvents ?? Object.keys(EVENT_WORDS);

  return (
    <>
      <section className="ws-section">
        <h2>Provider keys for every project</h2>
        <p className="ws-lead">
          A key added here pays for that provider&rsquo;s requests in every project, unless a project has its own key for it
          (a client&rsquo;s own account, say). Projects can also let people fall back to their own keys. Keys are stored
          encrypted and never shown again; you see the last four characters.
        </p>
        {keys && keys.length > 0 && (
          <div className="ws-table-wrap">
            <table className="ws-table ws-stack">
              <thead><tr><th>Provider</th><th>Key</th><th className="ws-hide-sm">Added</th><th>Check</th><th /></tr></thead>
              <tbody>
                {keys.map(k => (
                  <tr key={k.id}>
                    <td className="ws-name">{providerLabel(k.provider)}{k.alias && <div className="ws-meta">{k.alias}</div>}</td>
                    <td className="nowrap" data-label="Key"><code>…{k.hint}</code></td>
                    <td className="ws-hide-sm dim">{k.addedBy ?? '—'} · {day(k.createdAt)}</td>
                    <td style={{ fontSize: 12.5 }} data-label="Last check">
                      {k.validationError ? <span className="ws-chip bad" title={k.validationError}>Refused</span>
                        : k.lastValidatedAt ? <span className="ws-chip good">Works</span> : <span className="dim">Not checked</span>}
                    </td>
                    <td className="actions">
                      <button className="ws-btn small" onClick={async () => {
                        const r = await wsApi<any>(`/provider-keys/${k.id}/test`, { method: 'POST' });
                        flash(r.data?.valid ? `${providerLabel(k.provider)} accepted the key.` : `${providerLabel(k.provider)} refused the key: ${r.data?.error ?? r.error}`, !r.data?.valid);
                        loadKeys();
                      }}>Check</button>{' '}
                      <button className="ws-btn small danger" onClick={async () => {
                        if (!window.confirm(`Remove the shared ${providerLabel(k.provider)} key? Projects without their own key fall back to people's own keys, where allowed.`)) return;
                        await wsApi(`/provider-keys/${k.id}`, { method: 'DELETE' }); loadKeys();
                      }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form className="ws-form" style={{ marginTop: 14 }} autoComplete="off" onSubmit={async e => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          const r = await wsApi<any>('/provider-keys', { method: 'POST', body: { provider: f.get('provider'), apiKey: f.get('apiKey'), alias: f.get('alias') } });
          flash(r.ok ? (r.message ?? 'Key added') : (r.error ?? 'Could not add the key'), !r.ok);
          if (r.ok) { form.reset(); loadKeys(); }
        }}>
          <label className="ws-field">
            <span>Provider</span>
            <select name="provider" className="ws-select" defaultValue="openai">{PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
          </label>
          <label className="ws-field" style={{ flex: '2 1 240px' }}>
            <span>API key</span>
            <input name="apiKey" type="password" required className="ws-input" placeholder="Paste the key" autoComplete="new-password" />
          </label>
          <label className="ws-field" style={{ flex: '1 1 160px' }}>
            <span>Label (optional)</span>
            <input name="alias" maxLength={60} className="ws-input" placeholder="Agency account" />
          </label>
          <button className="ws-btn primary">Add key</button>
        </form>
        <p className="ws-note" style={{ marginTop: 8 }}>Adding a key for a provider that already has one replaces it.</p>
      </section>

      <section className="ws-section">
        <h2>Webhooks</h2>
        <p className="ws-lead">
          Signed JSON POSTs to your own endpoint for the events you choose. A workspace-wide webhook hears about every list
          and project; one for a single project hears only about that project. One attempt, five-second timeout, outcome
          recorded below. {d.webhooksAllowed ? '' : 'Webhooks are part of Teams.'}
        </p>
        {(d.webhooks ?? []).length > 0 && (
          <div className="ws-table-wrap">
            <table className="ws-table ws-stack">
              <thead><tr><th>Endpoint</th><th>Events</th><th>Last delivery</th><th /></tr></thead>
              <tbody>
                {(d.webhooks ?? []).map(w => (
                  <tr key={w.id}>
                    <td style={{ minWidth: 180 }}>
                      <div className="ws-name" style={{ fontWeight: 400, overflowWrap: 'anywhere' }}>{w.url}</div>
                      <div className="ws-meta">{w.projectName ? `Project: ${w.projectName}` : 'Whole workspace'}{w.active ? '' : ' · paused'}</div>
                    </td>
                    <td className="dim" style={{ fontSize: 12.5 }} data-label="Events">{w.events ? w.events.split(',').join(', ') : 'All events'}</td>
                    <td className="dim" style={{ fontSize: 12.5 }} data-label="Last delivery">{w.last_sent_at ? `${w.last_status === 0 ? 'Failed' : `HTTP ${w.last_status}`} · ${ago(w.last_sent_at)}` : 'Never'}</td>
                    <td className="actions">
                      <button className="ws-btn small" onClick={async () => { await wsApi(`/webhooks/${w.id}`, { method: 'PATCH', body: { active: !w.active } }); load(); }}>{w.active ? 'Pause' : 'Resume'}</button>{' '}
                      <button className="ws-btn small danger" onClick={() => act(`/webhooks/${w.id}`, 'DELETE', undefined, 'Webhook removed')}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {d.webhooksAllowed && (
          <form style={{ marginTop: 14 }} onSubmit={async e => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            const chosen = events.filter(ev => f.get(`ev:${ev}`));
            const r = await act('/webhooks', 'POST', { url: f.get('url'), projectId: f.get('scope') || null, events: chosen }, 'Webhook added');
            if (r.ok) form.reset();
          }}>
            <div className="ws-form">
              <label className="ws-field" style={{ flex: '2 1 260px' }}>
                <span>Endpoint URL (https)</span>
                <input name="url" type="url" required className="ws-input" placeholder="https://your-app.example.com/asl" />
              </label>
              <label className="ws-field" style={{ flex: '1 1 180px' }}>
                <span>For</span>
                <select name="scope" className="ws-select" defaultValue="">
                  <option value="">The whole workspace</option>
                  {(d.projects ?? []).map(p => <option key={p.id} value={p.id}>Project: {p.name}</option>)}
                </select>
              </label>
            </div>
            <fieldset style={{ border: 'none', padding: 0, margin: '12px 0' }}>
              <legend className="ws-note" style={{ marginBottom: 6 }}>Events (none ticked = all)</legend>
              <div className="ws-grid-2">
                {events.map(ev => (
                  <label key={ev} className="ws-check"><input type="checkbox" name={`ev:${ev}`} /><span>{EVENT_WORDS[ev] ?? ev}<small><code>{ev}</code></small></span></label>
                ))}
              </div>
            </fieldset>
            <button className="ws-btn primary">Add webhook</button>
          </form>
        )}
        <p className="ws-note" style={{ marginTop: 12 }}>
          HTTPS only, never to private or loopback addresses. Single sign-on, directory sync and the audit trail are under <Link href="/account/security" className="ws-link">Security</Link>.
        </p>
      </section>
    </>
  );
}
