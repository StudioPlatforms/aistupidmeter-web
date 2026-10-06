'use client';

/**
 * Who is in the project and what they may do: managers run it (people, rules, provider keys,
 * budget); members with an editor seat hold keys and edit the watchlist; viewers read along and
 * get the alerts. The workspace owner manages every project without being listed.
 */
import { wsApi, money, day, ROLE_LABEL } from '../ws';
import type { ProjectData } from './types';

export default function PeopleTab({ d, reload, flash }: { d: ProjectData; reload: () => void; flash: (t: string, bad?: boolean) => void }) {
  const leave = async () => {
    if (!window.confirm(`Leave ${d.project.name}? Your keys in it stop working.`)) return;
    const r = await wsApi(`/projects/${d.project.id}/members/${d.me.userId}`, { method: 'DELETE' });
    if (r.ok) window.location.href = '/account/team'; else flash(r.error ?? 'Could not leave', true);
  };
  return (
    <section className="ws-section">
      <h2>People</h2>
      <p className="ws-lead">
        Managers run the project: its people, routing rules, provider keys, budget and webhooks. Members with an editor seat
        hold their own keys and edit the watchlist. Viewers are free: they read the watchlist and report and get the alerts.
        The workspace owner manages every project.
      </p>
      <div className="ws-table-wrap">
        <table className="ws-table ws-stack">
          <thead><tr><th>Person</th><th>In this project</th><th className="ws-hide-sm">Workspace</th><th className="num">This month</th><th className="ws-hide-sm">Alerts</th>{d.me.canManage && <th />}</tr></thead>
          <tbody>
            {d.members.map(m => (
              <tr key={m.userId}>
                <td>
                  <div className="ws-name">{m.name}{m.userId === d.me.userId && <span className="dim" style={{ fontWeight: 400 }}> (you)</span>}</div>
                  {m.email && m.email !== m.name && <div className="ws-meta">{m.email}</div>}
                </td>
                <td data-label="In this project">
                  {d.me.canManage && m.listed && m.wsRole !== 'owner' ? (
                    <select className="ws-select" value={m.role} aria-label={`Role of ${m.name}`} onChange={async e => {
                      const r = await wsApi(`/projects/${d.project.id}/members/${m.userId}`, { method: 'PATCH', body: { role: e.target.value } });
                      flash(r.ok ? `${m.name} is now a ${e.target.value}.` : (r.error ?? 'Could not change the role'), !r.ok);
                      reload();
                    }}>
                      <option value="member">Member</option>
                      <option value="manager" disabled={m.wsRole === 'viewer'}>Manager{m.wsRole === 'viewer' ? ' (needs an editor seat)' : ''}</option>
                    </select>
                  ) : m.wsRole === 'owner' ? 'Manages every project' : ROLE_LABEL[m.role]}
                </td>
                <td className="ws-hide-sm dim">{ROLE_LABEL[m.wsRole]}{m.addedAt ? ` · added ${day(m.addedAt)}` : ''}</td>
                <td className="num" data-label="This month">{m.monthSpendUsd === null ? '—' : money(m.monthSpendUsd)}</td>
                <td className="ws-hide-sm dim" style={{ fontSize: 12.5 }}>{m.alertsMuted ? 'Muted' : 'On'}</td>
                {d.me.canManage && (
                  <td className="actions">
                    {m.listed && m.wsRole !== 'owner' && m.userId !== d.me.userId && (
                      <button className="ws-btn small danger" onClick={async () => {
                        if (!window.confirm(`Remove ${m.name} from ${d.project.name}? Their keys in it stop working.`)) return;
                        const r = await wsApi<any>(`/projects/${d.project.id}/members/${m.userId}`, { method: 'DELETE' });
                        flash(r.ok ? `${m.name} removed${r.data?.keysRevoked ? `; ${r.data.keysRevoked} key${r.data.keysRevoked === 1 ? '' : 's'} revoked` : ''}.` : (r.error ?? 'Could not remove'), !r.ok);
                        reload();
                      }}>Remove</button>
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
          <p className="ws-note" style={{ marginTop: 12 }}>Everyone in the workspace is in this project. Invite more people on the workspace&rsquo;s People tab.</p>
        ) : (
          <form className="ws-form" style={{ marginTop: 14 }} onSubmit={async e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const r = await wsApi(`/projects/${d.project.id}/members`, { method: 'POST', body: { userId: Number(f.get('user')), role: f.get('role') } });
            flash(r.ok ? 'Added to the project.' : (r.error ?? 'Could not add them'), !r.ok);
            if (r.ok) reload();
          }}>
            <label className="ws-field" style={{ flex: '2 1 220px' }}>
              <span>Add someone from the workspace</span>
              <select name="user" className="ws-select" required defaultValue="">
                <option value="" disabled>Choose a person…</option>
                {d.candidates.map(c => <option key={c.userId} value={c.userId}>{c.name}{c.email && c.email !== c.name ? ` (${c.email})` : ''} · {ROLE_LABEL[c.wsRole]}</option>)}
              </select>
            </label>
            <label className="ws-field">
              <span>As</span>
              <select name="role" className="ws-select" defaultValue="member">
                <option value="member">Member</option>
                <option value="manager">Manager</option>
              </select>
            </label>
            <button className="ws-btn primary">Add</button>
          </form>
        )
      )}
      {!d.me.isOwner && d.me.projectRole && (
        <div style={{ marginTop: 18 }}>
          <button className="ws-btn small danger" onClick={leave}>Leave this project</button>
        </div>
      )}
    </section>
  );
}
