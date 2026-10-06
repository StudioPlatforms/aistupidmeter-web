'use client';

/** Name, description, who sees per-person spend, the project's own webhooks, and deletion. */
import { useState } from 'react';
import { wsApi, ago } from '../ws';
import type { ProjectData } from './types';

const EVENTS: Array<[string, string]> = [
  ['model.regression', 'A model on this project’s watchlist dropped or regressed'],
  ['budget.threshold', 'The project crossed a budget threshold'],
  ['budget.exceeded', 'The project reached its budget'],
  ['member.cap_warning', 'Someone used 80% of their cap'],
  ['member.cap_reached', 'Someone reached their cap'],
];

export default function SettingsTab({ d, reload, flash }: { d: ProjectData; reload: () => void; flash: (t: string, bad?: boolean) => void }) {
  const [secret, setSecret] = useState<string | null>(null);
  return (
    <>
      <section className="ws-section">
        <h2>Details</h2>
        <form onSubmit={async e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const r = await wsApi(`/projects/${d.project.id}`, { method: 'PATCH', body: { name: f.get('name'), description: f.get('description'), spendVisibility: f.get('visibility') } });
          flash(r.ok ? 'Project saved.' : (r.error ?? 'Could not save'), !r.ok);
          if (r.ok) reload();
        }}>
          <div className="ws-grid-2">
            <label className="ws-field"><span>Name</span><input name="name" required maxLength={80} defaultValue={d.project.name} className="ws-input" /></label>
            <label className="ws-field"><span>Description</span><input name="description" maxLength={300} defaultValue={d.project.description ?? ''} className="ws-input" placeholder="What it is, who it is for" /></label>
          </div>
          <fieldset style={{ border: 'none', padding: 0, margin: '16px 0 0' }}>
            <legend className="ws-note" style={{ marginBottom: 8 }}>Who sees what each person spent</legend>
            <label className="ws-check" style={{ marginBottom: 8 }}><input type="radio" name="visibility" value="members" defaultChecked={d.project.spendVisibility === 'members'} />
              <span>Everyone in the project<small>The full report, the request log and every key.</small></span></label>
            <label className="ws-check"><input type="radio" name="visibility" value="managers" defaultChecked={d.project.spendVisibility === 'managers'} />
              <span>Managers only<small>Others see the project&rsquo;s totals and their own requests — useful when clients are viewers.</small></span></label>
          </fieldset>
          <button className="ws-btn primary" style={{ marginTop: 14 }}>Save</button>
        </form>
      </section>

      <section className="ws-section">
        <h2>Webhooks for this project</h2>
        <p className="ws-lead">
          Signed JSON POSTs about this project only. Workspace-wide webhooks hear about it too; they are on the workspace page.
          {d.workspace.webhooks ? '' : ' Webhooks are part of Teams.'}
        </p>
        {secret && (
          <div className="ws-secret">
            <strong style={{ fontSize: 14 }}>Signing secret — shown once</strong>
            <p className="ws-note" style={{ margin: '6px 0 0' }}>Verify each delivery: HMAC-SHA256 of <code>timestamp + &quot;.&quot; + body</code> must equal <code>X-ASL-Signature</code>.</p>
            <code>{secret}</code>
            <button className="ws-btn small" onClick={() => setSecret(null)}>Done</button>
          </div>
        )}
        {d.webhooks.length > 0 && (
          <div className="ws-table-wrap"><table className="ws-table ws-stack">
            <tbody>
              {d.webhooks.map(w => (
                <tr key={w.id}>
                  <td style={{ minWidth: 180 }}>
                    <div style={{ overflowWrap: 'anywhere' }}>{w.url}</div>
                    <div className="ws-meta">{w.events ? w.events.split(',').join(', ') : 'All events'}{w.active ? '' : ' · paused'}</div>
                  </td>
                  <td className="dim" style={{ fontSize: 12.5 }} data-label="Last delivery">{w.last_sent_at ? `${w.last_status === 0 ? 'Failed' : `HTTP ${w.last_status}`} · ${ago(w.last_sent_at)}` : 'Never sent'}</td>
                  <td className="actions">
                    <button className="ws-btn small" onClick={async () => { await wsApi(`/webhooks/${w.id}`, { method: 'PATCH', body: { active: !w.active } }); reload(); }}>{w.active ? 'Pause' : 'Resume'}</button>{' '}
                    <button className="ws-btn small danger" onClick={async () => { await wsApi(`/webhooks/${w.id}`, { method: 'DELETE' }); reload(); }}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        {d.workspace.webhooks && (
          <form style={{ marginTop: 12 }} onSubmit={async e => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            const r = await wsApi<any>('/webhooks', { method: 'POST', body: { url: f.get('url'), projectId: d.project.id, events: EVENTS.map(x => x[0]).filter(x => f.get(`ev:${x}`)) } });
            if (r.ok) { setSecret(r.data?.secret ?? null); form.reset(); reload(); flash('Webhook added.'); }
            else flash(r.error ?? 'Could not add the webhook', true);
          }}>
            <label className="ws-field"><span>Endpoint URL (https)</span><input name="url" type="url" required className="ws-input" placeholder="https://client-dashboard.example.com/asl" /></label>
            <fieldset style={{ border: 'none', padding: 0, margin: '12px 0' }}>
              <legend className="ws-note" style={{ marginBottom: 6 }}>Events (none ticked = all)</legend>
              <div className="ws-grid-2">
                {EVENTS.map(([id, words]) => <label key={id} className="ws-check"><input type="checkbox" name={`ev:${id}`} /><span>{words}<small><code>{id}</code></small></span></label>)}
              </div>
            </fieldset>
            <button className="ws-btn primary">Add webhook</button>
          </form>
        )}
      </section>

      <section className="ws-section">
        <h2>Delete the project</h2>
        <p className="ws-lead">
          Its keys stop working, its provider keys and budget are removed, and its watchlist and webhooks go with it.
          Its request history stays in the workspace&rsquo;s records; the deletion is written to the audit trail.
        </p>
        <button className="ws-btn danger" onClick={async () => {
          const typed = window.prompt(`Type the project name to delete it: ${d.project.name}`);
          if (typed !== d.project.name) { if (typed !== null) flash('The name did not match; nothing was deleted.', true); return; }
          const r = await wsApi(`/projects/${d.project.id}`, { method: 'DELETE' });
          if (r.ok) window.location.href = '/account/team'; else flash(r.error ?? 'Could not delete the project', true);
        }}>Delete {d.project.name}</button>
      </section>
    </>
  );
}
