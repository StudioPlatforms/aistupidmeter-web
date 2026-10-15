'use client';

/**
 * The workspace: its projects and what they spend, who works on what, the team watchlist, the
 * people in it, and (for the owner) the provider keys and webhooks the whole workspace shares.
 *
 * The seat rule is stated on the page rather than left to be discovered by hitting the limit:
 * owner and editors consume a seat, viewers never do.
 *
 * Look: the studio shell (styles/studio.css, components/studio) plus styles/studio-team.css.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import '@/styles/studio-team.css';
import Tabs, { useTab } from '@/components/workspace/Tabs';
import SpendChart from '@/components/workspace/SpendChart';
import WatchlistPanel from '@/components/workspace/WatchlistPanel';
import { PageHead, Pane, Stats, Stat, CountUp, CopyButton, Loader, Empty, Tag, ProviderMark, Meter } from '@/components/studio';
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

/** A number that counts up, or a dash when there is none. */
function count(n: number | null | undefined, format?: (n: number) => string): ReactNode {
  return typeof n === 'number' && Number.isFinite(n) ? <CountUp value={n} format={format} /> : '—';
}

const EVENT_WORDS: Record<string, string> = {
  'model.regression': 'A watched model dropped or regressed',
  'budget.threshold': 'A project crossed a budget threshold',
  'budget.exceeded': 'A project reached its budget',
  'member.cap_warning': 'Someone used 80% of their cap',
  'member.cap_reached': 'Someone reached their cap',
};

const PLAN_WORDS: Record<string, string> = { enterprise: 'Enterprise', teams: 'Teams', developer: 'Developer' };
const ROLE_TONE: Record<string, 'ink' | 'accent' | 'line'> = { owner: 'ink', editor: 'accent', viewer: 'line' };

const ar = <span className="st-ar" aria-hidden="true">→</span>;

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

  // Signed out, AccountShell renders the public chrome (no studio shell), so this stays plain.
  if (status === 'unauthenticated') {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.3em', marginBottom: 12 }}>Team</h1>
        <p style={{ color: 'var(--phosphor-dim)', marginBottom: 22 }}>Sign in to manage your workspace.</p>
        <Link href="/auth/signin" className="vintage-btn" style={{ padding: '11px 22px', textDecoration: 'none' }}>Sign in</Link>
      </div>
    );
  }
  if (loading) return <div data-page-loading><Loader label="Loading your workspace" minHeight={420} /></div>;

  if (!d?.org && d?.canCreate === false) {
    return (
      <>
        <PageHead
          kicker="Team"
          title="Workspace"
          lead="Where a team watches models together and runs projects with their own Smart Router keys, budgets and reports."
        />
        <div className="st-body sw-body">
          <section className="st-pane is-accent st-lock st-up">
            <div className="st-lock-main">
              <p className="st-kicker">Developer and Teams</p>
              <h2 className="st-lock-t">Workspaces start on Developer</h2>
              <p className="st-lead">
                A workspace gives a team a shared watchlist with alerts, and projects with their own Smart
                Router keys, budgets and spend reports.
              </p>
              <div className="st-actions sw-lock-act">
                <Link href="/pricing" className="st-btn is-primary is-lg">Compare plans {ar}</Link>
              </div>
            </div>
            <div className="st-lock-side">
              <p className="st-label">What each plan includes</p>
              <dl className="st-kv sw-kv">
                <div><dt>Developer</dt><dd>One project.</dd></div>
                <div><dt>Teams</dt><dd>Five editors, each with the full Teams plan, three projects, webhooks, single sign-on and an audit trail.</dd></div>
                <div><dt>Viewers</dt><dd>Free on both.</dd></div>
              </dl>
            </div>
          </section>
        </div>
      </>
    );
  }
  if (!d) {
    return (
      <>
        <PageHead kicker="Team" title="Workspace" />
        <div className="st-body sw-body"><Empty title="Could not load your workspace." /></div>
      </>
    );
  }
  if (!d.org) {
    return (
      <>
        <PageHead
          kicker="Team"
          title="Create your workspace"
          lead={d.seatLimit === 1
            ? <>A workspace is where a team watches models together and runs projects with their own Smart Router keys,
                budgets and reports. Your plan includes one editor seat — yours — and {plural(d.projectLimit, 'project')}.
                Viewers do not use a seat: invite clients or colleagues to read along.</>
            : <>A workspace is where your team watches models together and runs projects with their own Smart Router keys,
                budgets and reports. You get {plural(d.seatLimit, 'editor seat')} — every editor gets your plan&rsquo;s
                features — plus unlimited read-only viewers.</>}
        />
        <div className="st-body sw-body sw-narrow">
          <Pane title="Name your workspace">
            <form className="sw-form-row" onSubmit={async e => {
              e.preventDefault();
              await act('', 'POST', { name: new FormData(e.currentTarget).get('name') }, 'Workspace created');
            }}>
              <label className="st-field is-wide">
                <span className="st-field-label">Workspace name</span>
                <input name="name" required placeholder="Acme AI" className="st-input" />
              </label>
              <button type="submit" className="st-btn is-primary">Create workspace</button>
            </form>
            {msg && <p role="status" className={`sw-flash sw-msg${msg.bad ? ' is-bad' : ''}`}>{msg.text}</p>}
          </Pane>
        </div>
      </>
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
    <>
      <PageHead
        kicker="Team"
        title={d.org!.name}
        lead="Your workspace's projects and what they spend, the team watchlist, and the people in it."
        actions={<Link href="/docs/teams" className="st-btn">How workspaces work {ar}</Link>}
      >
        <div className="sw-meta">
          <Tag tone="accent">{PLAN_WORDS[d.org!.plan] ?? d.org!.plan}</Tag>
          <Tag tone="line">You: {ROLE_LABEL[d.role ?? 'viewer']}</Tag>
        </div>
      </PageHead>

      <div className="st-body sw-body">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        {msg && (
          <div role="status" className={`st-note sw-flash${msg.bad ? ' is-bad' : ''}`}><div>{msg.text}</div></div>
        )}
        {secret && (
          <Pane
            tone="accent"
            title="Signing secret — shown once"
            sub={<>
              Verify each delivery by recomputing <code className="st-ic">HMAC-SHA256(timestamp + &quot;.&quot; + body)</code> and comparing it
              with the <code className="st-ic">X-ASL-Signature</code> header. Reject anything whose <code className="st-ic">X-ASL-Timestamp</code> is more than a few minutes old.
            </>}
          >
            <div className="st-secret"><code>{secret}</code><CopyButton text={secret} /></div>
            <div className="st-actions sw-gap-top"><button type="button" className="st-btn is-sm" onClick={clearSecret}>Done</button></div>
          </Pane>
        )}

        {tab === 'overview' && <Overview d={d} seat={seat} act={act} />}
        {tab === 'watchlist' && <TeamWatchlist isOwner={isOwner} flash={flash} />}
        {tab === 'people' && <People d={d} isOwner={isOwner} act={act} flash={flash} />}
        {tab === 'settings' && isOwner && <Settings d={d} act={act} flash={flash} load={load} />}
      </div>
    </>
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
        <Stats columns={4}>
          <Stat
            value={count(t.spendUsd, money)}
            label="Spend this month"
            sub={t.spendChange === null ? 'across your projects' : <>
              <span className={t.spendChange > 0 ? 'sw-tone-bad' : 'sw-tone-good'}>{t.spendChange > 0 ? '+' : ''}{pct(t.spendChange)}</span> on the same days last month</>}
          />
          <Stat value={count(t.requests)} label="Requests" sub={t.requests ? `${pct(t.successRate, 1)} answered` : 'none yet'} />
          <Stat value={count(t.activePeople)} label="People sending requests" sub={`of ${num((d.members ?? []).filter(m => !m.pending).length)} in the workspace`} />
          <Stat value={count(projects.length)} label="Projects" sub={d.projectLimit === -1 ? 'no limit on your plan' : `of ${d.projectLimit} on your plan`} />
        </Stats>
      )}

      <Pane
        title="Projects"
        sub={<>
          A project is a client or product: the people working on it, the models it depends on (with alerts when one
          slips), and its own Smart Router keys, routing rules, provider keys and budget — with a report of what it
          spent and who spent it. {seat ? usage(d.projectCount ?? projects.length, d.projectLimit, 'project') + '.' : 'You see the projects you were added to.'}
        </>}
        ruled
        flush
      >
        {projects.length === 0 ? (
          <div className="sw-none">
            <span className="st-empty-mark" aria-hidden="true"><i /><i /><i /></span>
            <p>{seat ? 'No projects yet.' : 'No projects have been shared with you yet.'}</p>
          </div>
        ) : (
          <div className="st-table-wrap">
            <table className="st-table is-stack">
              <thead>
                <tr>
                  <th>Project</th>
                  <th className="sw-hide-sm">Your role</th>
                  <th className="is-num">People</th>
                  <th className="is-num sw-hide-sm">Watching</th>
                  <th style={{ minWidth: 170 }}>This month</th>
                  <th className="is-num sw-hide-sm">Last request</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => {
                  const used = p.budgetUsd && p.monthSpendUsd !== null ? p.monthSpendUsd / p.budgetUsd : null;
                  return (
                    <tr key={p.id}>
                      <td className="is-head">
                        <Link href={`/account/team/projects/${p.id}`} className="sw-t">{p.name}</Link>
                        <div className="sw-s">{p.description || (p.managers.length ? `Managed by ${p.managers.join(', ')}` : '')}</div>
                      </td>
                      <td className="sw-hide-sm">{p.myRole ? <Tag tone="line">{ROLE_LABEL[p.myRole]}</Tag> : <span className="sw-dim">—</span>}</td>
                      <td className="is-num" data-label="People">{p.people}</td>
                      <td className="is-num sw-hide-sm">{p.watching} model{p.watching === 1 ? '' : 's'}</td>
                      <td data-label="This month">
                        <div className="sw-cellbox">
                          <div className="st-num">{money(p.monthSpendUsd)}{p.budgetUsd ? <span className="sw-dim"> of {money(p.budgetUsd)}</span> : ''}</div>
                          {used !== null && (
                            <div className={`st-meter sw-meter${used >= 1 ? ' is-bad' : used >= 0.8 ? ' is-warn' : ''}`} title={`${pct(used)} of the monthly budget`}>
                              <i style={{ width: `${Math.min(100, used * 100)}%` }} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="is-num is-dim sw-hide-sm">{p.lastRequestAt ? ago(p.lastRequestAt) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {d.canCreateProject && (limitReached ? (
          <div className="sw-addbar">
            <p className="st-hint">Your plan includes {plural(d.projectLimit, 'project')}. Delete one or <Link href="/pricing" className="st-link-inline">upgrade</Link> for more.</p>
          </div>
        ) : (
          <form className="sw-addbar" onSubmit={async e => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            const r = await act('/projects', 'POST', { name: f.get('name'), description: f.get('description') }, 'Project created');
            if (r.ok) { form.reset(); window.location.href = `/account/team/projects/${r.data.id}`; }
          }}>
            <p className="st-label">New project</p>
            <div className="sw-form-row">
              <label className="st-field">
                <span className="st-field-label">Name</span>
                <input name="name" required maxLength={80} className="st-input" placeholder="Client A" />
              </label>
              <label className="st-field is-wide">
                <span className="st-field-label">Description <small>optional</small></span>
                <input name="description" maxLength={300} className="st-input" placeholder="What it is, who it is for" />
              </label>
              <button type="submit" className="st-btn is-primary">Create project</button>
            </div>
          </form>
        ))}
      </Pane>

      {seat && ov && t && t.requests > 0 && (
        <Pane title="Spend by day, this month" sub="All projects together, at each provider’s list price for the tokens used.">
          <SpendChart days={ov.daily} nameOf={id => names.get(id) ?? 'Former member'} />
          {ov.insights.length > 0 && <ul className="sw-insights">{ov.insights.map(i => <li key={i}>{i}</li>)}</ul>}
        </Pane>
      )}

      {seat && ov && ov.matrix.length > 0 && ov.projects.length > 0 && (
        <Pane title="Who works on what" sub="Each person’s role in each project, and what they spent there this month." ruled flush>
          <div className="st-table-wrap">
            <table className="st-table sw-matrix">
              <thead>
                <tr>
                  <th>Person</th>
                  {ov.projects.map(p => <th key={p.id} className="is-proj"><Link href={`/account/team/projects/${p.id}`}>{p.name}</Link></th>)}
                  <th className="is-num">Total</th>
                </tr>
              </thead>
              <tbody>
                {ov.matrix.map(m => (
                  <tr key={m.userId}>
                    <td><div className="sw-t">{m.name}</div><div className="sw-s">{ROLE_LABEL[m.wsRole]}</div></td>
                    {m.cells.map(c => (
                      <td key={c.projectId} className={`sw-cell${c.role ? '' : ' is-none'}`}>
                        {c.role ? <>
                          <div className="st-num">{c.spendUsd > 0 ? money(c.spendUsd) : '—'}</div>
                          <div className="sw-s">{ROLE_LABEL[c.role]}{c.requests ? ` · ${num(c.requests)} req` : ''}</div>
                        </> : c.spendUsd > 0 ? <div className="st-num" title="Spent here before leaving the project">{money(c.spendUsd)}</div> : '·'}
                      </td>
                    ))}
                    <td className="is-num sw-strong">{money(m.totalSpendUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Pane>
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
  if (!w) return <Loader label="Loading the team watchlist" />;

  return (
    <>
      <Pane
        title="Team watchlist"
        sub={<>
          Models the whole workspace depends on. Everyone in the workspace sees this list, and when one of these models
          drops by {w.alerts.minDropPoints} points or more over a week, or a benchmark task starts failing, everyone is
          emailed{w.alerts.recipients === 'managers' ? ' (the owner and editors, as set below)' : w.alerts.recipients === 'none' ? ' — except that team emails are switched off below' : ''}.
          Projects keep their own lists.
        </>}
        actions={w.limit !== null ? <Tag tone="line">{w.models.length} of {w.limit}</Tag> : undefined}
        ruled
        flush
      >
        <WatchlistPanel
          models={w.models} catalog={catalog} canEdit={w.canEdit} limit={w.limit}
          empty={w.canEdit ? 'Nothing on the team watchlist yet. Add the models your products run on.' : 'Nothing on the team watchlist yet.'}
          onAdd={async (modelId, note) => { const r = await wsApi('/watchlist', { method: 'POST', body: { modelId, note } }); if (r.ok) load(); return r.ok ? null : r.error; }}
          onRemove={async id => { await wsApi(`/watchlist/${id}`, { method: 'DELETE' }); load(); }}
          onNote={async (id, note) => { await wsApi(`/watchlist/${id}`, { method: 'PATCH', body: { note } }); load(); }}
        />
      </Pane>

      <Pane
        title="Alerts"
        delay={0.06}
        foot={<>
          Changes are judged on real measurements only; a model we could not measure this week is shown as such, never as a change.
          A workspace webhook also receives each alert as <code className="st-ic">model.regression</code>.
        </>}
      >
        <label className="st-toggle">
          <input type="checkbox" className="st-check" checked={!w.alerts.mutedForMe} onChange={async e => {
            const r = await wsApi('/alerts/mute', { method: 'PUT', body: { muted: !e.target.checked } });
            if (r.ok) { flash(e.target.checked ? 'You will get team alerts again.' : 'Team alerts muted for you.'); load(); }
          }} />
          <span className="sw-toggle-text"><b>Email me about the team watchlist</b><span>Only affects you. Your own watchlist and project alerts are separate.</span></span>
        </label>
        {isOwner && w.canConfigure && (
          <form className="sw-form-row sw-rule-top" onSubmit={async e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const r = await wsApi('/alerts', { method: 'PUT', body: { minDropPoints: Number(f.get('drop')), recipients: f.get('recipients') } });
            flash(r.ok ? 'Team alert settings saved.' : (r.error ?? 'Could not save'), !r.ok);
            if (r.ok) load();
          }}>
            <label className="st-field is-narrow">
              <span className="st-field-label">Alert on a drop of at least</span>
              <span className="sw-suffix">
                <input name="drop" type="number" min={1} max={50} step={0.5} defaultValue={w.alerts.minDropPoints} className="st-input" />
                <span aria-hidden="true">points</span>
              </span>
            </label>
            <label className="st-field is-wide">
              <span className="st-field-label">Who is emailed</span>
              <select name="recipients" defaultValue={w.alerts.recipients} className="st-select">
                <option value="members">Everyone in the workspace, viewers included</option>
                <option value="managers">The owner and editors</option>
                <option value="none">Nobody (webhooks only)</option>
              </select>
            </label>
            <button type="submit" className="st-btn">Save</button>
          </form>
        )}
      </Pane>
    </>
  );
}

// ── People ─────────────────────────────────────────────────────────────────

function People({ d, isOwner, act, flash }: { d: Data; isOwner: boolean; act: Act; flash: (t: string, bad?: boolean) => void }) {
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); flash('Invitation link copied'); }
    catch { window.prompt('Copy the invitation link:', text); }
  };
  const all = d.members ?? [];
  const joined = all.filter(m => !m.pending);
  const pending = all.filter(m => m.pending);
  const used = d.seatsUsed ?? 0;

  const person = (m: Member) => (
    <div key={m.id} className="sw-person">
      <span className={`sw-avatar${m.pending ? ' is-pending' : m.role === 'owner' ? ' is-ink' : ''}`} aria-hidden="true">
        {(m.name || m.email || '?').trim().charAt(0).toUpperCase()}
      </span>
      <div className="sw-person-main">
        <div className="sw-person-line">
          <span className="sw-t">{m.name || m.email || '—'}{m.self && <span className="sw-you"> (you)</span>}</span>
          <Tag tone={ROLE_TONE[m.role] ?? 'line'}>{ROLE_LABEL[m.role] ?? m.role}</Tag>
          {m.pending && !m.expired && <Tag tone="warn">Invited · until {day(m.expiresAt)}</Tag>}
          {m.pending && m.expired && <Tag tone="bad">Invitation expired</Tag>}
          {m.deactivated && <Tag tone="bad">Deactivated</Tag>}
        </div>
        {(m.name || (!m.pending && !m.deactivated)) && (
          <div className="sw-s">
            {m.name && m.email}
            {m.name && !m.pending && !m.deactivated && ' · '}
            {!m.pending && !m.deactivated && (m.provisionedBy === 'scim' ? 'Managed by your directory' : m.provisionedBy === 'sso' ? 'Joined through single sign-on' : 'Member')}
          </div>
        )}
      </div>
      {isOwner && (
        <div className="sw-person-acts">
          {m.pending && <button type="button" className="st-btn is-sm" onClick={() => act(`/members/${m.id}/resend`, 'POST', {}, 'Invitation sent again')}>Resend</button>}
          {m.pending && m.inviteUrl && !m.expired && <button type="button" className="st-btn is-sm" onClick={() => copy(m.inviteUrl!)}>Copy link</button>}
          {m.role !== 'owner' && (
            <button type="button" className="st-btn is-sm is-quiet sw-bad-text" onClick={() => {
              if (!m.pending && !window.confirm(`Remove ${m.email} from the workspace? Their project keys stop working.`)) return;
              act(`/members/${m.id}`, 'DELETE', undefined, m.pending ? 'Invitation withdrawn' : 'Removed from the workspace');
            }}>{m.pending ? 'Withdraw' : 'Remove'}</button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="st-split">
      <div className="sw-col">
        <Pane title="Members" sub={`${joined.length} ${joined.length === 1 ? 'person' : 'people'} in ${d.org!.name}`} ruled flush>
          <div className="sw-people">{joined.map(person)}</div>
        </Pane>
        {pending.length > 0 && (
          <Pane
            title="Pending invitations"
            sub={`${pending.length} not accepted yet`}
            ruled
            flush
            delay={0.05}
          >
            <div className="sw-people">{pending.map(person)}</div>
          </Pane>
        )}
      </div>

      <div className="sw-col">
        {isOwner && (
          <Pane title="Invite someone" delay={0.08}>
            <form className="sw-stack" onSubmit={async e => {
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
              <label className="st-field">
                <span className="st-field-label">Role</span>
                <select name="role" defaultValue="viewer" className="st-select" aria-label="Role">
                  <option value="viewer">Viewer (free, read-only)</option>
                  <option value="editor">Editor (uses a seat)</option>
                </select>
              </label>
              <button type="submit" className="st-btn is-primary is-block">Send invitation</button>
            </form>
          </Pane>
        )}

        <Pane title="Seats and roles" delay={0.12}>
          <div className="sw-figure">
            <b>{count(used)}</b>
            <small>{d.seatLimit === -1
              ? `editor seat${used === 1 ? '' : 's'} used — no limit on your plan`
              : `of ${d.seatLimit ?? 0} editor seat${d.seatLimit === 1 ? '' : 's'} used`}</small>
          </div>
          {d.seatLimit !== -1 && <Meter used={used} limit={d.seatLimit ?? 0} />}
          <dl className="st-kv sw-kv sw-gap-top">
            <div><dt>Owners and editors</dt><dd>Take a seat, get the workspace&rsquo;s plan, can hold Smart Router keys and change watchlists.</dd></div>
            <div><dt>Viewers</dt><dd>Free and read-only: they see the team watchlist and the projects they are added to, and get their alerts — useful for clients and stakeholders.</dd></div>
            <div><dt>Invitations</dt><dd>Emailed with a link that works for {d.inviteTtlDays ?? 14} days, for the invited address only.</dd></div>
          </dl>
        </Pane>

        {!isOwner && (
          <Pane title="Leave the workspace" sub="You lose access to its projects, and your project keys stop working." delay={0.16}>
            <button type="button" className="st-btn is-danger" onClick={async () => {
              if (!window.confirm(`Leave ${d.org!.name}? You lose access to its projects, and your project keys stop working.`)) return;
              const r = await wsApi('/leave', { method: 'POST' });
              if (r.ok) window.location.reload(); else flash(r.error ?? 'Could not leave', true);
            }}>Leave workspace</button>
          </Pane>
        )}
      </div>
    </div>
  );
}

// ── Keys & webhooks (owner) ────────────────────────────────────────────────

interface SharedKey { id: number; provider: string; alias: string | null; hint: string | null; active: boolean; addedBy: string | null; createdAt: string; lastValidatedAt: string | null; validationError: string | null }

function Settings({ d, act, flash, load }: { d: Data; act: Act; flash: (t: string, bad?: boolean) => void; load: () => void }) {
  const [keys, setKeys] = useState<SharedKey[] | null>(null);
  const loadKeys = useCallback(() => wsApi<{ keys: SharedKey[] }>('/provider-keys').then(r => setKeys(r.data?.keys ?? [])), []);
  useEffect(() => { loadKeys(); }, [loadKeys]);
  const events = d.webhookEvents ?? Object.keys(EVENT_WORDS);
  const hooks = d.webhooks ?? [];

  return (
    <>
      <Pane
        title="Provider keys for every project"
        sub={<>
          A key added here pays for that provider&rsquo;s requests in every project, unless a project has its own key for it
          (a client&rsquo;s own account, say). Projects can also let people fall back to their own keys. Keys are stored
          encrypted and never shown again; you see the last four characters.
        </>}
        ruled
        flush
      >
        {keys && keys.length > 0 && (
          <div className="st-table-wrap">
            <table className="st-table is-stack">
              <thead><tr><th>Provider</th><th>Key</th><th className="sw-hide-sm">Added</th><th>Last check</th><th><span className="st-sr">Actions</span></th></tr></thead>
              <tbody>
                {keys.map(k => (
                  <tr key={k.id}>
                    <td className="is-head">
                      <div className="sw-prov">
                        <ProviderMark provider={k.provider} size="sm" />
                        <div><div className="sw-t">{providerLabel(k.provider)}</div>{k.alias && <div className="sw-s">{k.alias}</div>}</div>
                      </div>
                    </td>
                    <td data-label="Key"><code className="st-ic">…{k.hint}</code></td>
                    <td className="sw-hide-sm is-dim">{k.addedBy ?? '—'} · {day(k.createdAt)}</td>
                    <td data-label="Last check">
                      {k.validationError ? <Tag tone="bad" title={k.validationError}>Refused</Tag>
                        : k.lastValidatedAt ? <Tag tone="good">Works</Tag> : <span className="sw-status">Not checked</span>}
                    </td>
                    <td className="sw-acts-cell">
                      <div className="sw-acts">
                        <button type="button" className="st-btn is-sm" onClick={async () => {
                          const r = await wsApi<any>(`/provider-keys/${k.id}/test`, { method: 'POST' });
                          flash(r.data?.valid ? `${providerLabel(k.provider)} accepted the key.` : `${providerLabel(k.provider)} refused the key: ${r.data?.error ?? r.error}`, !r.data?.valid);
                          loadKeys();
                        }}>Check</button>
                        <button type="button" className="st-btn is-sm is-quiet sw-bad-text" onClick={async () => {
                          if (!window.confirm(`Remove the shared ${providerLabel(k.provider)} key? Projects without their own key fall back to people's own keys, where allowed.`)) return;
                          await wsApi(`/provider-keys/${k.id}`, { method: 'DELETE' }); loadKeys();
                        }}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form className="sw-addbar" autoComplete="off" onSubmit={async e => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          const r = await wsApi<any>('/provider-keys', { method: 'POST', body: { provider: f.get('provider'), apiKey: f.get('apiKey'), alias: f.get('alias') } });
          flash(r.ok ? (r.message ?? 'Key added') : (r.error ?? 'Could not add the key'), !r.ok);
          if (r.ok) { form.reset(); loadKeys(); }
        }}>
          <p className="st-label">Add a key</p>
          <div className="sw-form-row">
            <label className="st-field is-narrow">
              <span className="st-field-label">Provider</span>
              <select name="provider" className="st-select" defaultValue="openai">{PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
            </label>
            <label className="st-field is-wide">
              <span className="st-field-label">API key</span>
              <input name="apiKey" type="password" required className="st-input is-code" placeholder="Paste the key" autoComplete="new-password" />
            </label>
            <label className="st-field">
              <span className="st-field-label">Label <small>optional</small></span>
              <input name="alias" maxLength={60} className="st-input" placeholder="Agency account" />
            </label>
            <button type="submit" className="st-btn is-primary">Add key</button>
          </div>
          <p className="st-hint">Adding a key for a provider that already has one replaces it.</p>
        </form>
      </Pane>

      <Pane
        title="Webhooks"
        sub={<>
          Signed JSON POSTs to your own endpoint for the events you choose. A workspace-wide webhook hears about every list
          and project; one for a single project hears only about that project. One attempt, five-second timeout, outcome
          recorded below. {d.webhooksAllowed ? '' : 'Webhooks are part of Teams.'}
        </>}
        ruled={hooks.length > 0 || !!d.webhooksAllowed}
        flush
        delay={0.06}
        foot={<>
          HTTPS only, never to private or loopback addresses. Single sign-on, directory sync and the audit trail are under{' '}
          <Link href="/account/security" className="st-link-inline">Security</Link>.
        </>}
      >
        {hooks.length > 0 && (
          <div className="st-table-wrap">
            <table className="st-table is-stack">
              <thead><tr><th>Endpoint</th><th>Events</th><th>Last delivery</th><th><span className="st-sr">Actions</span></th></tr></thead>
              <tbody>
                {hooks.map(w => (
                  <tr key={w.id}>
                    <td className="is-head" style={{ minWidth: 200 }}>
                      <div className="sw-url">{w.url}</div>
                      <div className="sw-s">
                        {w.projectName ? `Project: ${w.projectName}` : 'Whole workspace'}
                        {w.active ? '' : <> · <Tag tone="warn">Paused</Tag></>}
                      </div>
                    </td>
                    <td className="is-dim sw-small" data-label="Events">{w.events ? w.events.split(',').join(', ') : 'All events'}</td>
                    <td className="is-dim sw-small" data-label="Last delivery">{w.last_sent_at ? `${w.last_status === 0 ? 'Failed' : `HTTP ${w.last_status}`} · ${ago(w.last_sent_at)}` : 'Never'}</td>
                    <td className="sw-acts-cell">
                      <div className="sw-acts">
                        <button type="button" className="st-btn is-sm" onClick={async () => { await wsApi(`/webhooks/${w.id}`, { method: 'PATCH', body: { active: !w.active } }); load(); }}>{w.active ? 'Pause' : 'Resume'}</button>
                        <button type="button" className="st-btn is-sm is-quiet sw-bad-text" onClick={() => act(`/webhooks/${w.id}`, 'DELETE', undefined, 'Webhook removed')}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {d.webhooksAllowed && (
          <form className="sw-addbar" onSubmit={async e => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            const chosen = events.filter(ev => f.get(`ev:${ev}`));
            const r = await act('/webhooks', 'POST', { url: f.get('url'), projectId: f.get('scope') || null, events: chosen }, 'Webhook added');
            if (r.ok) form.reset();
          }}>
            <p className="st-label">Add a webhook</p>
            <div className="sw-form-row">
              <label className="st-field is-wide">
                <span className="st-field-label">Endpoint URL <small>https</small></span>
                <input name="url" type="url" required className="st-input" placeholder="https://your-app.example.com/asl" />
              </label>
              <label className="st-field">
                <span className="st-field-label">For</span>
                <select name="scope" className="st-select" defaultValue="">
                  <option value="">The whole workspace</option>
                  {(d.projects ?? []).map(p => <option key={p.id} value={p.id}>Project: {p.name}</option>)}
                </select>
              </label>
            </div>
            <fieldset className="sw-fieldset sw-gap-top">
              <legend>Events <small>none ticked = all</small></legend>
              <div className="sw-checks">
                {events.map(ev => (
                  <label key={ev} className="st-toggle">
                    <input type="checkbox" className="st-check" name={`ev:${ev}`} />
                    <span className="sw-toggle-text"><b>{EVENT_WORDS[ev] ?? ev}</b><span><code className="st-ic">{ev}</code></span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="st-actions sw-gap-top"><button type="submit" className="st-btn is-primary">Add webhook</button></div>
          </form>
        )}
      </Pane>
    </>
  );
}
