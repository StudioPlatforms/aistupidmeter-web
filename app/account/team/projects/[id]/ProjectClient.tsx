'use client';

/**
 * One project: the report (what it spent, who spent it, how efficiently), its watchlist and
 * alerts, its Smart Router keys and routing rules, its budget, what happened in it, and who is
 * in it. Everything is permission-checked by the API; the page only hides what you cannot use.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import '@/styles/workspace.css';
import Tabs, { useTab } from '@/components/workspace/Tabs';
import WatchlistPanel from '@/components/workspace/WatchlistPanel';
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

  if (status === 'unauthenticated') {
    return (
      <div className="ws-page narrow" style={{ textAlign: 'center', paddingTop: 60 }}>
        <p className="ws-sub" style={{ marginBottom: 20 }}>Sign in to open this project.</p>
        <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(`/account/team/projects/${id}`)}`} className="ws-btn primary">Sign in</Link>
      </div>
    );
  }
  if (error) {
    return (
      <div className="ws-page narrow" style={{ paddingTop: 40 }}>
        <div className="ws-crumbs"><Link href="/account/team">Workspace</Link></div>
        <h1 className="ws-title">Project not available</h1>
        <p className="ws-sub">{error}</p>
      </div>
    );
  }
  if (!d) return <div data-page-loading className="ws-page" style={{ textAlign: 'center', color: 'var(--phosphor-dim)' }}>Loading…</div>;

  const b = d.budget;
  const used = b.month.budgetUsed;

  return (
    <div className="ws-page">
      <div className="ws-crumbs"><Link href="/account/team">{d.workspace.name}</Link> › Projects</div>
      <div className="ws-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="ws-title">{d.project.name}</h1>
          {d.project.description && <p className="ws-sub">{d.project.description}</p>}
          <p className="ws-sub" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <span className="ws-chip">You: {d.me.isOwner ? 'Workspace owner' : ROLE_LABEL[d.me.projectRole ?? 'member']}{d.me.wsRole === 'viewer' ? ' (viewer)' : ''}</span>
            {b.monthlyUsd ? (
              <span className={`ws-chip ${used !== null && used >= 1 ? 'bad' : used !== null && used >= 0.8 ? 'warn' : ''}`} title={`Budget mode: ${b.mode}`}>
                {money(b.month.spendUsd)} of {money(b.monthlyUsd)} this month ({pct(used)})
              </span>
            ) : <span className="ws-chip">{money(b.month.spendUsd)} this month · no budget</span>}
            <span className="ws-chip">{d.members.length} {d.members.length === 1 ? 'person' : 'people'}</span>
          </p>
        </div>
        <div className="ws-head-actions">
          <Link href="/docs/teams#projects" className="ws-link">How projects work →</Link>
        </div>
      </div>
      {!d.workspace.planActive && (
        <div className="ws-flash bad" style={{ marginTop: 14 }}>
          The workspace&rsquo;s plan no longer includes projects, so this project is read-only and its keys are paused.
          The owner can renew it under Plan &amp; billing.
        </div>
      )}
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {msg && <div role="status" className={`ws-flash${msg.bad ? ' bad' : ''}`}>{msg.text}</div>}

      {tab === 'overview' && <OverviewTab d={d} />}
      {tab === 'watchlist' && (
        <>
          <section className="ws-section">
            <h2>Watchlist</h2>
            <p className="ws-lead">
              The models this project depends on. When one drops by {d.watchlist.alerts.minDropPoints} points or more over a week,
              or a benchmark task starts failing, {d.watchlist.alerts.recipients === 'none' ? 'no one is emailed (webhooks only)'
                : d.watchlist.alerts.recipients === 'managers' ? 'the project’s managers and the workspace owner are emailed'
                : 'everyone in the project is emailed'}, and the project&rsquo;s webhooks are told.
            </p>
            <WatchlistPanel
              models={d.watchlist.models} catalog={catalog} canEdit={d.me.canContribute} limit={d.watchlist.limit}
              empty={d.me.canContribute ? 'Nothing watched yet. Add the models this project runs on.' : 'Nothing watched yet.'}
              onAdd={async (modelId, note) => { const r = await wsApi(`/projects/${d.project.id}/watchlist`, { method: 'POST', body: { modelId, note } }); if (r.ok) load(); return r.ok ? null : r.error; }}
              onRemove={async mid => { await wsApi(`/projects/${d.project.id}/watchlist/${mid}`, { method: 'DELETE' }); load(); }}
              onNote={async (mid, note) => { await wsApi(`/projects/${d.project.id}/watchlist/${mid}`, { method: 'PATCH', body: { note } }); load(); }}
            />
          </section>
          <section className="ws-section">
            <h2>Alerts</h2>
            <label className="ws-check" style={{ marginBottom: 14 }}>
              <input type="checkbox" checked={!d.me.alertsMuted} onChange={async e => {
                const r = await wsApi(`/projects/${d.project.id}/mute`, { method: 'PUT', body: { muted: !e.target.checked } });
                if (r.ok) { flash(e.target.checked ? 'You will get this project’s alerts again.' : 'This project’s alerts are muted for you.'); load(); }
              }} />
              <span>Email me about this project&rsquo;s watchlist<small>Only affects you.</small></span>
            </label>
            {d.me.canManage && (
              <form className="ws-form" onSubmit={async e => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const r = await wsApi(`/projects/${d.project.id}/alerts`, { method: 'PUT', body: { minDropPoints: Number(f.get('drop')), recipients: f.get('recipients') } });
                flash(r.ok ? 'Alert settings saved.' : (r.error ?? 'Could not save'), !r.ok);
                if (r.ok) load();
              }}>
                <label className="ws-field" style={{ width: 170 }}>
                  <span>Alert on a drop of at least</span>
                  <input name="drop" type="number" min={1} max={50} step={0.5} defaultValue={d.watchlist.alerts.minDropPoints} className="ws-input" />
                </label>
                <label className="ws-field" style={{ flex: '1 1 220px' }}>
                  <span>Who is emailed</span>
                  <select name="recipients" defaultValue={d.watchlist.alerts.recipients} className="ws-select">
                    <option value="members">Everyone in the project, viewers included</option>
                    <option value="managers">Managers and the workspace owner</option>
                    <option value="none">Nobody (webhooks only)</option>
                  </select>
                </label>
                <button className="ws-btn">Save</button>
              </form>
            )}
          </section>
        </>
      )}
      {tab === 'router' && <RouterTab d={d} catalog={catalog} reload={load} flash={flash} />}
      {tab === 'budget' && <BudgetTab d={d} reload={load} flash={flash} />}
      {tab === 'activity' && <ActivityTab d={d} />}
      {tab === 'people' && <PeopleTab d={d} reload={load} flash={flash} />}
      {tab === 'settings' && d.me.canManage && <SettingsTab d={d} reload={load} flash={flash} />}
    </div>
  );
}
