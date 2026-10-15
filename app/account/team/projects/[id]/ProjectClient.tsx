'use client';

/**
 * One project: the report (what it spent, who spent it, how efficiently), its watchlist and
 * alerts, its Smart Router keys and routing rules, its budget, what happened in it, and who is
 * in it. Everything is permission-checked by the API; the page only hides what you cannot use.
 *
 * Look: the studio shell (styles/studio.css, components/studio) plus styles/studio-team.css.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import '@/styles/studio-team.css';
import Tabs, { useTab } from '@/components/workspace/Tabs';
import WatchlistPanel from '@/components/workspace/WatchlistPanel';
import { PageHead, Pane, Loader, Tag } from '@/components/studio';
import { wsApi, money, pct, ROLE_LABEL, type ModelOption } from '@/components/workspace/ws';
import type { ProjectData } from '@/components/workspace/project/types';
import OverviewTab from '@/components/workspace/project/OverviewTab';
import RouterTab from '@/components/workspace/project/RouterTab';
import BudgetTab from '@/components/workspace/project/BudgetTab';
import ActivityTab from '@/components/workspace/project/ActivityTab';
import PeopleTab from '@/components/workspace/project/PeopleTab';
import SettingsTab from '@/components/workspace/project/SettingsTab';

export default function ProjectClient({ id }: { id: string }) {
  const { status } = useSession();
  const [d, setD] = useState<ProjectData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ModelOption[]>([]);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const flash = useCallback((text: string, bad = false) => { setMsg({ text, bad }); window.setTimeout(() => setMsg(null), 7000); }, []);
  const load = useCallback(async () => {
    const r = await wsApi<ProjectData>(`/projects/${encodeURIComponent(id)}`);
    if (r.ok) { setD(r.data); setError(null); } else setError(r.error);
  }, [id]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    load();
    wsApi<{ models: ModelOption[] }>('/models').then(r => setCatalog(r.data?.models ?? []));
  }, [status, load]);

  const tabs = useMemo(() => [
    { id: 'overview', label: 'Overview' },
    { id: 'watchlist', label: 'Watchlist' },
    { id: 'router', label: 'Smart Router' },
    { id: 'budget', label: 'Budget' },
    { id: 'activity', label: 'Activity' },
    { id: 'people', label: 'People' },
    ...(d?.me.canManage ? [{ id: 'settings', label: 'Settings' }] : []),
  ], [d?.me.canManage]);
  const [tab, setTab] = useTab(tabs);

  // Signed out, AccountShell renders the public chrome (no studio shell), so this stays plain.
  if (status === 'unauthenticated') {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--phosphor-dim)', marginBottom: 20 }}>Sign in to open this project.</p>
        <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(`/account/team/projects/${id}`)}`} className="vintage-btn" style={{ padding: '11px 22px', textDecoration: 'none' }}>Sign in</Link>
      </div>
    );
  }
  if (error) {
    return (
      <PageHead kicker="Team" title="Project not available" lead={error}>
        <Link href="/account/team" className="sw-crumb">Workspace</Link>
      </PageHead>
    );
  }
  if (!d) return <div data-page-loading><Loader label="Loading the project" minHeight={420} /></div>;

  const b = d.budget;
  const used = b.month.budgetUsed;

  return (
    <>
      <PageHead
        kicker="Team"
        title={d.project.name}
        lead={d.project.description ?? undefined}
        actions={<Link href="/docs/teams#projects" className="st-btn">How projects work <span className="st-ar" aria-hidden="true">→</span></Link>}
      >
        <Link href="/account/team" className="sw-crumb">{d.workspace.name} · Projects</Link>
        <div className="sw-meta">
          <Tag tone="line">You: {d.me.isOwner ? 'Workspace owner' : ROLE_LABEL[d.me.projectRole ?? 'member']}{d.me.wsRole === 'viewer' ? ' (viewer)' : ''}</Tag>
          {b.monthlyUsd ? (
            <Tag tone={used !== null && used >= 1 ? 'bad' : used !== null && used >= 0.8 ? 'warn' : 'accent'} title={`Budget mode: ${b.mode}`}>
              {money(b.month.spendUsd)} of {money(b.monthlyUsd)} this month ({pct(used)})
            </Tag>
          ) : <Tag tone="line">{money(b.month.spendUsd)} this month · no budget</Tag>}
          <Tag tone="line">{d.members.length} {d.members.length === 1 ? 'person' : 'people'}</Tag>
        </div>
      </PageHead>

      <div className="st-body sw-body">
        {!d.workspace.planActive && (
          <div className="st-note is-bad" role="alert">
            <div>
              The workspace&rsquo;s plan no longer includes projects, so this project is read-only and its keys are paused.
              The owner can renew it under Plan &amp; billing.
            </div>
          </div>
        )}
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        {msg && <div role="status" className={`st-note sw-flash${msg.bad ? ' is-bad' : ''}`}><div>{msg.text}</div></div>}

        {tab === 'overview' && <OverviewTab d={d} />}
        {tab === 'watchlist' && (
          <>
            <Pane
              title="Watchlist"
              sub={<>
                The models this project depends on. When one drops by {d.watchlist.alerts.minDropPoints} points or more over a week,
                or a benchmark task starts failing, {d.watchlist.alerts.recipients === 'none' ? 'no one is emailed (webhooks only)'
                  : d.watchlist.alerts.recipients === 'managers' ? 'the project’s managers and the workspace owner are emailed'
                  : 'everyone in the project is emailed'}, and the project&rsquo;s webhooks are told.
              </>}
              ruled
              flush
            >
              <WatchlistPanel
                models={d.watchlist.models} catalog={catalog} canEdit={d.me.canContribute} limit={d.watchlist.limit}
                empty={d.me.canContribute ? 'Nothing watched yet. Add the models this project runs on.' : 'Nothing watched yet.'}
                onAdd={async (modelId, note) => { const r = await wsApi(`/projects/${d.project.id}/watchlist`, { method: 'POST', body: { modelId, note } }); if (r.ok) load(); return r.ok ? null : r.error; }}
                onRemove={async mid => { await wsApi(`/projects/${d.project.id}/watchlist/${mid}`, { method: 'DELETE' }); load(); }}
                onNote={async (mid, note) => { await wsApi(`/projects/${d.project.id}/watchlist/${mid}`, { method: 'PATCH', body: { note } }); load(); }}
              />
            </Pane>
            <Pane title="Alerts" delay={0.06}>
              <label className="st-toggle">
                <input type="checkbox" className="st-check" checked={!d.me.alertsMuted} onChange={async e => {
                  const r = await wsApi(`/projects/${d.project.id}/mute`, { method: 'PUT', body: { muted: !e.target.checked } });
                  if (r.ok) { flash(e.target.checked ? 'You will get this project’s alerts again.' : 'This project’s alerts are muted for you.'); load(); }
                }} />
                <span className="sw-toggle-text"><b>Email me about this project&rsquo;s watchlist</b><span>Only affects you.</span></span>
              </label>
              {d.me.canManage && (
                <form className="sw-form-row sw-rule-top" onSubmit={async e => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const r = await wsApi(`/projects/${d.project.id}/alerts`, { method: 'PUT', body: { minDropPoints: Number(f.get('drop')), recipients: f.get('recipients') } });
                  flash(r.ok ? 'Alert settings saved.' : (r.error ?? 'Could not save'), !r.ok);
                  if (r.ok) load();
                }}>
                  <label className="st-field is-narrow">
                    <span className="st-field-label">Alert on a drop of at least</span>
                    <span className="sw-suffix">
                      <input name="drop" type="number" min={1} max={50} step={0.5} defaultValue={d.watchlist.alerts.minDropPoints} className="st-input" />
                      <span aria-hidden="true">points</span>
                    </span>
                  </label>
                  <label className="st-field is-wide">
                    <span className="st-field-label">Who is emailed</span>
                    <select name="recipients" defaultValue={d.watchlist.alerts.recipients} className="st-select">
                      <option value="members">Everyone in the project, viewers included</option>
                      <option value="managers">Managers and the workspace owner</option>
                      <option value="none">Nobody (webhooks only)</option>
                    </select>
                  </label>
                  <button type="submit" className="st-btn">Save</button>
                </form>
              )}
            </Pane>
          </>
        )}
        {tab === 'router' && <RouterTab d={d} catalog={catalog} reload={load} flash={flash} />}
        {tab === 'budget' && <BudgetTab d={d} reload={load} flash={flash} />}
        {tab === 'activity' && <ActivityTab d={d} />}
        {tab === 'people' && <PeopleTab d={d} reload={load} flash={flash} />}
        {tab === 'settings' && d.me.canManage && <SettingsTab d={d} reload={load} flash={flash} />}
      </div>
    </>
  );
}
