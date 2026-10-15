'use client';

/**
 * A shared watchlist (the team's or a project's): each model's latest real score, its change over
 * seven days and anything open on it, from the same snapshot the alert emails use. People with an
 * editor seat add, annotate and remove models; everyone else reads it.
 *
 * Renders into a flush pane (<Pane flush>): the table runs to the pane's edges, the add form sits
 * in a strip under it. Styles: styles/studio-team.css.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Tag } from '@/components/studio';
import { pts, ago, type ModelOption, type WatchModel } from './ws';

interface Props {
  models: WatchModel[];
  catalog: ModelOption[];
  canEdit: boolean;
  limit: number | null;
  onAdd: (modelId: number, note: string) => Promise<string | null>;
  onRemove: (modelId: number) => Promise<void>;
  onNote: (modelId: number, note: string) => Promise<void>;
  empty: string;
}

export default function WatchlistPanel({ models, catalog, canEdit, limit, onAdd, onRemove, onNote, empty }: Props) {
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const watched = useMemo(() => new Set(models.map(m => m.modelId)), [models]);
  const byVendor = useMemo(() => {
    const g = new Map<string, ModelOption[]>();
    for (const m of catalog) if (!watched.has(m.id)) (g.get(m.vendor) ?? g.set(m.vendor, []).get(m.vendor)!).push(m);
    return Array.from(g.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [catalog, watched]);
  const full = limit !== null && models.length >= limit;

  return (
    <div>
      {models.length === 0 ? (
        <div className="sw-none">
          <span className="st-empty-mark" aria-hidden="true"><i /><i /><i /></span>
          <p>{empty}</p>
        </div>
      ) : (
        <div className="st-table-wrap">
          <table className="st-table is-stack">
            <thead>
              <tr>
                <th>Model</th>
                <th className="is-num">Score</th>
                <th className="is-num">7 days</th>
                <th>Status</th>
                <th className="sw-hide-sm">Added</th>
                {canEdit && <th><span className="st-sr">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {models.map(m => (
                <tr key={m.modelId}>
                  <td className="is-head" style={{ minWidth: 180 }}>
                    <Link href={`/models/${m.modelId}`} className="sw-t">{m.label}</Link>
                    {editing === m.modelId ? (
                      <form onSubmit={async e => {
                        e.preventDefault();
                        await onNote(m.modelId, String(new FormData(e.currentTarget).get('note') ?? ''));
                        setEditing(null);
                      }} className="sw-inline-form">
                        <input name="note" className="st-input" defaultValue={m.note ?? ''} maxLength={200} placeholder="Why the team watches it" aria-label={`Note on ${m.label}`} autoFocus />
                        <button type="submit" className="st-btn is-sm is-primary">Save</button>
                        <button type="button" className="st-btn is-sm is-quiet" onClick={() => setEditing(null)}>Cancel</button>
                      </form>
                    ) : m.note ? <div className="sw-s">{m.note}</div> : null}
                  </td>
                  <td className="is-num" data-label="Score"><span className="sw-score">{m.score === null ? '—' : m.score.toFixed(1)}</span></td>
                  <td className={`is-num${m.delta7d === null || m.delta7d === 0 ? '' : m.delta7d < 0 ? ' sw-tone-bad' : ' sw-tone-good'}`} data-label="7 days">
                    {m.delta7d === null ? '—' : pts(m.delta7d)}
                  </td>
                  <td data-label="Status">
                    <span className="sw-tags">
                      {m.drift && <Tag tone="warn" title={m.drift}>Drift alert</Tag>}
                      {m.taskRegressions > 0 && <Tag tone="bad">{m.taskRegressions} task regression{m.taskRegressions === 1 ? '' : 's'}</Tag>}
                      {!m.drift && m.taskRegressions === 0 && (
                        m.hasFreshData
                          ? <span className="sw-dim sw-small">Nothing open</span>
                          : <Tag tone="line" title={m.measuredAt ? `Last measured ${new Date(m.measuredAt).toLocaleDateString()}` : 'Never measured'}>Not measured this week</Tag>
                      )}
                    </span>
                  </td>
                  <td className="sw-hide-sm is-dim sw-small" style={{ whiteSpace: 'nowrap' }}>{m.addedBy ? `${m.addedBy} · ` : ''}{ago(m.addedAt)}</td>
                  {canEdit && (
                    <td className="sw-acts-cell">
                      <div className="sw-acts">
                        <button type="button" className="st-btn is-sm is-quiet" onClick={() => setEditing(m.modelId)}>Note</button>
                        <button type="button" className="st-btn is-sm is-quiet sw-bad-text" onClick={() => onRemove(m.modelId)}>Remove</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && (
        full ? (
          <div className="sw-addbar">
            <p className="st-hint">This list holds {limit} models on your plan.</p>
            {err && <p className="st-error" style={{ marginTop: 10 }}>{err}</p>}
          </div>
        ) : (
          <form className="sw-addbar" onSubmit={async e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const id = Number(f.get('model'));
            if (!id) return;
            setAdding(true);
            setErr(await onAdd(id, String(f.get('note') ?? '').trim()));
            setAdding(false);
            (e.target as HTMLFormElement).reset();
          }}>
            <div className="sw-form-row">
              <label className="st-field">
                <span className="st-field-label">Add a model</span>
                <select name="model" className="st-select" defaultValue="" required>
                  <option value="" disabled>Choose a model…</option>
                  {byVendor.map(([vendor, list]) => (
                    <optgroup key={vendor} label={vendor}>
                      {list.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="st-field is-wide">
                <span className="st-field-label">Note <small>optional</small></span>
                <input name="note" className="st-input" maxLength={200} placeholder="e.g. Production chatbot" />
              </label>
              <button type="submit" className="st-btn is-primary" disabled={adding}>Add model</button>
            </div>
            {err && <p className="st-error" style={{ marginTop: 10 }}>{err}</p>}
          </form>
        )
      )}
    </div>
  );
}
