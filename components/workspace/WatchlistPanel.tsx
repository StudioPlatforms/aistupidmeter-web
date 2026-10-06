'use client';

/**
 * A shared watchlist (the team's or a project's): each model's latest real score, its change over
 * seven days and anything open on it, from the same snapshot the alert emails use. People with an
 * editor seat add, annotate and remove models; everyone else reads it.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
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
      {models.length === 0 ? <p className="ws-empty">{empty}</p> : (
        <div className="ws-table-wrap">
          <table className="ws-table ws-stack">
            <thead>
              <tr>
                <th>Model</th>
                <th className="num">Score</th>
                <th className="num">7 days</th>
                <th>Status</th>
                <th className="ws-hide-sm">Added</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {models.map(m => (
                <tr key={m.modelId}>
                  <td style={{ minWidth: 160 }}>
                    <Link href={`/models/${m.modelId}`} className="ws-name">{m.label}</Link>
                    {editing === m.modelId ? (
                      <form onSubmit={async e => {
                        e.preventDefault();
                        await onNote(m.modelId, String(new FormData(e.currentTarget).get('note') ?? ''));
                        setEditing(null);
                      }} className="ws-form" style={{ marginTop: 6 }}>
                        <input name="note" className="ws-input" defaultValue={m.note ?? ''} maxLength={200} placeholder="Why the team watches it" style={{ flex: 1, minWidth: 140 }} autoFocus />
                        <button className="ws-btn small">Save</button>
                        <button type="button" className="ws-btn small" onClick={() => setEditing(null)}>Cancel</button>
                      </form>
                    ) : m.note ? <div className="ws-meta">{m.note}</div> : null}
                  </td>
                  <td className="num" data-label="Score">{m.score === null ? '—' : m.score.toFixed(1)}</td>
                  <td className="num" data-label="7 days" style={{ color: m.delta7d === null ? undefined : m.delta7d < 0 ? 'var(--bad)' : m.delta7d > 0 ? 'var(--good)' : undefined }}>
                    {m.delta7d === null ? '—' : pts(m.delta7d)}
                  </td>
                  <td data-label="Status">
                    {m.drift && <span className="ws-chip warn" title={m.drift}>Drift alert</span>}
                    {m.taskRegressions > 0 && <span className="ws-chip bad" style={{ marginLeft: m.drift ? 4 : 0 }}>{m.taskRegressions} task regression{m.taskRegressions === 1 ? '' : 's'}</span>}
                    {!m.drift && m.taskRegressions === 0 && (
                      m.hasFreshData
                        ? <span className="dim" style={{ fontSize: 12.5 }}>Nothing open</span>
                        : <span className="ws-chip" title={m.measuredAt ? `Last measured ${new Date(m.measuredAt).toLocaleDateString()}` : 'Never measured'}>Not measured this week</span>
                    )}
                  </td>
                  <td className="ws-hide-sm dim nowrap" style={{ fontSize: 12.5 }}>{m.addedBy ? `${m.addedBy} · ` : ''}{ago(m.addedAt)}</td>
                  {canEdit && (
                    <td className="actions">
                      <button className="ws-btn small link" onClick={() => setEditing(m.modelId)}>Note</button>{' '}
                      <button className="ws-btn small link" style={{ color: 'var(--bad)', marginLeft: 10 }} onClick={() => onRemove(m.modelId)}>Remove</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && (
        full ? <p className="ws-note" style={{ marginTop: 12 }}>This list holds {limit} models on your plan.</p> : (
          <form className="ws-form" style={{ marginTop: 14 }} onSubmit={async e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const id = Number(f.get('model'));
            if (!id) return;
            setAdding(true);
            setErr(await onAdd(id, String(f.get('note') ?? '').trim()));
            setAdding(false);
            (e.target as HTMLFormElement).reset();
          }}>
            <label className="ws-field" style={{ flex: '1 1 220px' }}>
              <span>Add a model</span>
              <select name="model" className="ws-select" defaultValue="" required>
                <option value="" disabled>Choose a model…</option>
                {byVendor.map(([vendor, list]) => (
                  <optgroup key={vendor} label={vendor}>
                    {list.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="ws-field" style={{ flex: '2 1 240px' }}>
              <span>Note (optional)</span>
              <input name="note" className="ws-input" maxLength={200} placeholder="e.g. Production chatbot" />
            </label>
            <button className="ws-btn primary" disabled={adding}>Add</button>
          </form>
        )
      )}
      {err && <p className="ws-note" style={{ color: 'var(--bad)', marginTop: 8 }}>{err}</p>}
    </div>
  );
}
