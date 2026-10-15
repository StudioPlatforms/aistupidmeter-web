'use client';

/**
 * Who is in the project and what they may do: managers run it (people, rules, provider keys,
 * budget); members with an editor seat hold keys and edit the watchlist; viewers read along and
 * get the alerts. The workspace owner manages every project without being listed.
 */
import { Pane, Tag } from '@/components/studio';
import { wsApi, money, day, ROLE_LABEL } from '../ws';
import type { ProjectData } from './types';

export default function PeopleTab({ d, reload, flash }: { d: ProjectData; reload: () => void; flash: (t: string, bad?: boolean) => void }) {
  const leave = async () => {
    if (!window.confirm(`Leave ${d.project.name}? Your keys in it stop working.`)) return;
    const r = await wsApi(`/projects/${d.project.id}/members/${d.me.userId}`, { method: 'DELETE' });
    if (r.ok) window.location.href = '/account/team'; else flash(r.error ?? 'Could not leave', true);
  };
  return (
    <>
      <Pane
        title="People"
        sub={<>
          Managers run the project: its people, routing rules, provider keys, budget and webhooks. Members with an editor seat
          hold their own keys and edit the watchlist. Viewers are free: they read the watchlist and report and get the alerts.
          The workspace owner manages every project.
        </>}
        ruled
        flush
      >
        <div className="st-table-wrap">
          <table className="st-table is-stack">
            <thead>
              <tr>
                <th>Person</th><th>In this project</th><th className="sw-hide-sm">Workspace</th><th className="is-num">This month</th><th className="sw-hide-sm">Alerts</th>
                {d.me.canManage && <th><span className="st-sr">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {d.members.map(m => (
                <tr key={m.userId}>
                  <td className="is-head">
                    <div className="sw-prov">
                      <span className={`sw-avatar${m.wsRole === 'owner' ? ' is-ink' : ''}`} aria-hidden="true">{(m.name || m.email || '?').trim().charAt(0).toUpperCase()}</span>
                      <div>
                        <div className="sw-t">{m.name}{m.userId === d.me.userId && <span className="sw-you"> (you)</span>}</div>
                        {m.email && m.email !== m.name && <div className="sw-s">{m.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="sw-mid" data-label="In this project">
                    {d.me.canManage && m.listed && m.wsRole !== 'owner' ? (
                      <select className="st-select sw-select-sm" value={m.role} aria-label={`Role of ${m.name}`} onChange={async e => {
                        const r = await wsApi(`/projects/${d.project.id}/members/${m.userId}`, { method: 'PATCH', body: { role: e.target.value } });
                        flash(r.ok ? `${m.name} is now a ${e.target.value}.` : (r.error ?? 'Could not change the role'), !r.ok);
                        reload();
                      }}>
                        <option value="member">Member</option>
                        <option value="manager" disabled={m.wsRole === 'viewer'}>Manager{m.wsRole === 'viewer' ? ' (needs an editor seat)' : ''}</option>
                      </select>
                    ) : m.wsRole === 'owner' ? <span className="sw-dim">Manages every project</span> : <Tag tone={m.role === 'manager' ? 'accent' : 'line'}>{ROLE_LABEL[m.role]}</Tag>}
                  </td>
                  <td className="sw-hide-sm is-dim">{ROLE_LABEL[m.wsRole]}{m.addedAt ? ` · added ${day(m.addedAt)}` : ''}</td>
                  <td className="is-num" data-label="This month">{m.monthSpendUsd === null ? '—' : money(m.monthSpendUsd)}</td>
                  <td className="sw-hide-sm"><span className="sw-status">{m.alertsMuted ? 'Muted' : 'On'}</span></td>
                  {d.me.canManage && (
                    <td className="sw-acts-cell">
                      {m.listed && m.wsRole !== 'owner' && m.userId !== d.me.userId && (
                        <div className="sw-acts">
                          <button type="button" className="st-btn is-sm is-quiet sw-bad-text" onClick={async () => {
                            if (!window.confirm(`Remove ${m.name} from ${d.project.name}? Their keys in it stop working.`)) return;
                            const r = await wsApi<any>(`/projects/${d.project.id}/members/${m.userId}`, { method: 'DELETE' });
                            flash(r.ok ? `${m.name} removed${r.data?.keysRevoked ? `; ${r.data.keysRevoked} key${r.data.keysRevoked === 1 ? '' : 's'} revoked` : ''}.` : (r.error ?? 'Could not remove'), !r.ok);
                            reload();
                          }}>Remove</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.me.canManage && (
          d.candidates.length === 0 ? (
            <div className="sw-addbar">
              <p className="st-hint">Everyone in the workspace is in this project. Invite more people on the workspace&rsquo;s People tab.</p>
            </div>
          ) : (
            <form className="sw-addbar" onSubmit={async e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const r = await wsApi(`/projects/${d.project.id}/members`, { method: 'POST', body: { userId: Number(f.get('user')), role: f.get('role') } });
              flash(r.ok ? 'Added to the project.' : (r.error ?? 'Could not add them'), !r.ok);
              if (r.ok) reload();
            }}>
              <div className="sw-form-row">
                <label className="st-field is-wide">
                  <span className="st-field-label">Add someone from the workspace</span>
                  <select name="user" className="st-select" required defaultValue="">
                    <option value="" disabled>Choose a person…</option>
                    {d.candidates.map(c => <option key={c.userId} value={c.userId}>{c.name}{c.email && c.email !== c.name ? ` (${c.email})` : ''} · {ROLE_LABEL[c.wsRole]}</option>)}
                  </select>
                </label>
                <label className="st-field is-narrow">
                  <span className="st-field-label">As</span>
                  <select name="role" className="st-select" defaultValue="member">
                    <option value="member">Member</option>
                    <option value="manager">Manager</option>
                  </select>
                </label>
                <button type="submit" className="st-btn is-primary">Add</button>
              </div>
            </form>
          )
        )}
      </Pane>
      {!d.me.isOwner && d.me.projectRole && (
        <Pane title="Leave this project" sub="Your keys in it stop working." delay={0.06}>
          <button type="button" className="st-btn is-danger" onClick={leave}>Leave this project</button>
        </Pane>
      )}
    </>
  );
}
