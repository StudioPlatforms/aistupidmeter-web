'use client';

/** Name, description, who sees per-person spend, the project's own webhooks, and deletion. */
import { useState } from 'react';
import { Pane, Tag, CopyButton } from '@/components/studio';
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
      <Pane title="Details" ruled>
        <form className="sw-stack" onSubmit={async e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const r = await wsApi(`/projects/${d.project.id}`, { method: 'PATCH', body: { name: f.get('name'), description: f.get('description'), spendVisibility: f.get('visibility') } });
          flash(r.ok ? 'Project saved.' : (r.error ?? 'Could not save'), !r.ok);
          if (r.ok) reload();
        }}>
          <div className="sw-grid2">
            <label className="st-field"><span className="st-field-label">Name</span><input name="name" required maxLength={80} defaultValue={d.project.name} className="st-input" /></label>
            <label className="st-field"><span className="st-field-label">Description</span><input name="description" maxLength={300} defaultValue={d.project.description ?? ''} className="st-input" placeholder="What it is, who it is for" /></label>
          </div>
          <fieldset className="sw-fieldset sw-gap-top">
            <legend>Who sees what each person spent</legend>
            <div className="sw-toggles">
              <label className="st-toggle"><input type="radio" className="st-check" name="visibility" value="members" defaultChecked={d.project.spendVisibility === 'members'} />
                <span className="sw-toggle-text"><b>Everyone in the project</b><span>The full report, the request log and every key.</span></span></label>
              <label className="st-toggle"><input type="radio" className="st-check" name="visibility" value="managers" defaultChecked={d.project.spendVisibility === 'managers'} />
                <span className="sw-toggle-text"><b>Managers only</b><span>Others see the project&rsquo;s totals and their own requests — useful when clients are viewers.</span></span></label>
            </div>
          </fieldset>
          <div className="st-actions sw-rule-top"><button type="submit" className="st-btn is-primary">Save</button></div>
        </form>
      </Pane>

      {secret && (
        <Pane
          tone="accent"
          title="Signing secret — shown once"
          sub={<>Verify each delivery: HMAC-SHA256 of <code className="st-ic">timestamp + &quot;.&quot; + body</code> must equal <code className="st-ic">X-ASL-Signature</code>.</>}
        >
          <div className="st-secret"><code>{secret}</code><CopyButton text={secret} /></div>
          <div className="st-actions sw-gap-top"><button type="button" className="st-btn is-sm" onClick={() => setSecret(null)}>Done</button></div>
        </Pane>
      )}

      <Pane
        title="Webhooks for this project"
        sub={<>
          Signed JSON POSTs about this project only. Workspace-wide webhooks hear about it too; they are on the workspace page.
          {d.workspace.webhooks ? '' : ' Webhooks are part of Teams.'}
        </>}
        ruled={d.webhooks.length > 0 || d.workspace.webhooks}
        flush
        delay={0.06}
      >
        {d.webhooks.length > 0 && (
          <div className="st-table-wrap">
            <table className="st-table is-stack">
              <thead><tr><th>Endpoint</th><th>Last delivery</th><th><span className="st-sr">Actions</span></th></tr></thead>
              <tbody>
                {d.webhooks.map(w => (
                  <tr key={w.id}>
                    <td className="is-head sw-hook">
                      <div className="sw-url">{w.url}</div>
                      <div className="sw-s">
                        {w.events ? w.events.split(',').join(', ') : 'All events'}
                        {w.active ? '' : <> · <Tag tone="warn">Paused</Tag></>}
                      </div>
                    </td>
                    <td className="is-dim sw-small" data-label="Last delivery">{w.last_sent_at ? `${w.last_status === 0 ? 'Failed' : `HTTP ${w.last_status}`} · ${ago(w.last_sent_at)}` : 'Never sent'}</td>
                    <td className="sw-acts-cell">
                      <div className="sw-acts">
                        <button type="button" className="st-btn is-sm" onClick={async () => { await wsApi(`/webhooks/${w.id}`, { method: 'PATCH', body: { active: !w.active } }); reload(); }}>{w.active ? 'Pause' : 'Resume'}</button>
                        <button type="button" className="st-btn is-sm is-quiet sw-bad-text" onClick={async () => { await wsApi(`/webhooks/${w.id}`, { method: 'DELETE' }); reload(); }}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {d.workspace.webhooks && (
          <form className="sw-addbar" onSubmit={async e => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            const r = await wsApi<any>('/webhooks', { method: 'POST', body: { url: f.get('url'), projectId: d.project.id, events: EVENTS.map(x => x[0]).filter(x => f.get(`ev:${x}`)) } });
            if (r.ok) { setSecret(r.data?.secret ?? null); form.reset(); reload(); flash('Webhook added.'); }
            else flash(r.error ?? 'Could not add the webhook', true);
          }}>
            <p className="st-label">Add a webhook</p>
            <label className="st-field">
              <span className="st-field-label">Endpoint URL <small>https</small></span>
              <input name="url" type="url" required className="st-input" placeholder="https://client-dashboard.example.com/asl" />
            </label>
            <fieldset className="sw-fieldset sw-gap-top">
              <legend>Events <small>none ticked = all</small></legend>
              <div className="sw-checks">
                {EVENTS.map(([id, words]) => (
                  <label key={id} className="st-toggle">
                    <input type="checkbox" className="st-check" name={`ev:${id}`} />
                    <span className="sw-toggle-text"><b>{words}</b><span><code className="st-ic">{id}</code></span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="st-actions sw-gap-top"><button type="submit" className="st-btn is-primary">Add webhook</button></div>
          </form>
        )}
      </Pane>

      <Pane
        title="Delete the project"
        sub={<>
          Its keys stop working, its provider keys and budget are removed, and its watchlist and webhooks go with it.
          Its request history stays in the workspace&rsquo;s records; the deletion is written to the audit trail.
        </>}
        delay={0.06}
      >
        <button type="button" className="st-btn is-danger" onClick={async () => {
          const typed = window.prompt(`Type the project name to delete it: ${d.project.name}`);
          if (typed !== d.project.name) { if (typed !== null) flash('The name did not match; nothing was deleted.', true); return; }
          const r = await wsApi(`/projects/${d.project.id}`, { method: 'DELETE' });
          if (r.ok) window.location.href = '/account/team'; else flash(r.error ?? 'Could not delete the project', true);
        }}>Delete {d.project.name}</button>
      </Pane>
    </>
  );
}
