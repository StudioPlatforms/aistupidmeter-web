'use client';

/**
 * What happened in the project: who changed what (from the workspace audit trail), and every
 * Smart Router request its keys made — never the prompt text. Both filter by person.
 */
import { useCallback, useEffect, useState } from 'react';
import { wsApi, money, ms, dateTime, ACTION_WORDS, providerLabel } from '../ws';
import type { ProjectData } from './types';

interface Change { id: number; at: string; action: string; actorKind: string; actorUserId: number | null; actor: string; targetType: string | null; target: string | null; detail: any }
interface Req {
  id: number; at: string; userId: number; person: string; key: string | null; requested: string | null; model: string; provider: string;
  tokensIn: number; tokensOut: number; costUsd: number; latencyMs: number | null; success: boolean; failureClass: string | null;
  rescued: boolean; fallbackFrom: string | null; category: string | null; keySource: string | null; error: string | null;
}

function describe(c: Change): string {
  const verb = ACTION_WORDS[c.action] ?? c.action.replace(/[._]/g, ' ');
  const target = c.target ? ` ${c.target}` : '';
  if (c.action === 'routing.updated' && c.detail && typeof c.detail === 'object') {
    const keys = Object.keys(c.detail);
    return `${verb}${keys.length ? `: ${keys.join(', ')}` : ''}`;
  }
  if (c.action === 'project.member_added' && c.detail?.role) return `${verb}${target} as ${c.detail.role}`;
  if (c.action === 'alert.model_regression' && c.detail?.finding) return `${verb}${target}: ${c.detail.finding}`;
  return `${verb}${target}`;
}

export default function ActivityTab({ d }: { d: ProjectData }) {
  const [view, setView] = useState<'changes' | 'requests'>('changes');
  const [person, setPerson] = useState<number | ''>('');
  const [outcome, setOutcome] = useState<'' | 'ok' | 'failed'>('');
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [reqs, setReqs] = useState<Req[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [ownOnly, setOwnOnly] = useState(false);

  const loadChanges = useCallback(async (before?: string) => {
    const q = new URLSearchParams({ limit: '50', ...(person ? { member: String(person) } : {}), ...(before ? { before } : {}) });
    const r = await wsApi<{ rows: Change[]; nextCursor: string | null }>(`/projects/${d.project.id}/activity?${q}`);
    if (r.ok && r.data) { setChanges(prev => before && prev ? [...prev, ...r.data!.rows] : r.data!.rows); setCursor(r.data.nextCursor); }
  }, [d.project.id, person]);
  const loadReqs = useCallback(async (before?: string) => {
    const q = new URLSearchParams({ limit: '50', ...(person ? { member: String(person) } : {}), ...(outcome ? { status: outcome } : {}), ...(before ? { before } : {}) });
    const r = await wsApi<{ rows: Req[]; nextCursor: string | null; ownOnly: boolean }>(`/projects/${d.project.id}/requests?${q}`);
    if (r.ok && r.data) { setReqs(prev => before && prev ? [...prev, ...r.data!.rows] : r.data!.rows); setCursor(r.data.nextCursor); setOwnOnly(r.data.ownOnly); }
  }, [d.project.id, person, outcome]);

  useEffect(() => { setCursor(null); if (view === 'changes') loadChanges(); else loadReqs(); }, [view, loadChanges, loadReqs]);

  return (
    <section className="ws-section">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="ws-seg" role="group" aria-label="Show">
          <button type="button" aria-pressed={view === 'changes'} onClick={() => setView('changes')}>Changes</button>
          <button type="button" aria-pressed={view === 'requests'} onClick={() => setView('requests')}>Requests</button>
        </div>
        <div className="ws-form">
          <label className="ws-field">
            <span>Person</span>
            <select className="ws-select" value={person} onChange={e => setPerson(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Everyone</option>
              {d.members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
            </select>
          </label>
          {view === 'requests' && (
            <label className="ws-field">
              <span>Outcome</span>
              <select className="ws-select" value={outcome} onChange={e => setOutcome(e.target.value as any)}>
                <option value="">All</option><option value="ok">Answered</option><option value="failed">Failed</option>
              </select>
            </label>
          )}
        </div>
      </div>

      {view === 'changes' && (
        <>
          <p className="ws-lead">Who changed what in this project, newest first. System entries are budget notices and change alerts.</p>
          {!changes ? <p className="ws-empty">Loading…</p> : changes.length === 0 ? <p className="ws-empty">Nothing yet.</p> : (
            <div className="ws-table-wrap"><table className="ws-table ws-stack">
              <tbody>
                {changes.map(c => (
                  <tr key={c.id}>
                    <td className="nowrap dim" style={{ width: 130, fontSize: 12.5 }}>{dateTime(c.at)}</td>
                    <td style={{ overflowWrap: 'anywhere' }}><strong style={{ fontWeight: 500 }}>{c.actor}</strong> {describe(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
          {cursor && changes && <button className="ws-btn small" style={{ marginTop: 10 }} onClick={() => loadChanges(cursor)}>Show older</button>}
        </>
      )}

      {view === 'requests' && (
        <>
          <p className="ws-lead">
            Every request made with this project&rsquo;s keys{ownOnly ? ' — yours only, as this project shows each person’s spending to managers only' : ''}.
            The prompt text is never shown here. <a className="ws-link" href={`/api/account/org/projects/${d.project.id}/requests?format=csv${person ? `&member=${person}` : ''}${outcome ? `&status=${outcome}` : ''}`}>Download as CSV</a>
          </p>
          {!reqs ? <p className="ws-empty">Loading…</p> : reqs.length === 0 ? <p className="ws-empty">No requests match.</p> : (
            <div className="ws-table-wrap">
              <table className="ws-table ws-stack">
                <thead><tr><th>Time</th><th>Person</th><th>Model</th><th className="num">Tokens</th><th className="num">Cost</th><th className="num ws-hide-sm">Time taken</th><th>Result</th></tr></thead>
                <tbody>
                  {reqs.map(r => (
                    <tr key={r.id}>
                      <td className="nowrap dim">{dateTime(r.at)}</td>
                      <td data-label="Person"><span>{r.person}</span>{r.key ? <span className="ws-meta"> · {r.key}</span> : null}</td>
                      <td data-label="Model">
                        <span>{r.model}</span>
                        <div className="ws-meta">
                          {r.requested && r.requested !== r.model ? `asked for ${r.requested} · ` : r.requested === r.model ? 'named · ' : ''}
                          {providerLabel(r.provider)}{r.keySource ? ` · ${r.keySource === 'project' ? 'project key' : r.keySource === 'workspace' ? 'workspace key' : 'own key'}` : ''}
                        </div>
                      </td>
                      <td className="num" data-label="Tokens">{(r.tokensIn + r.tokensOut).toLocaleString()}</td>
                      <td className="num" data-label="Cost">{money(r.costUsd)}</td>
                      <td className="num ws-hide-sm">{ms(r.latencyMs)}</td>
                      <td>
                        {r.success
                          ? (r.rescued ? <span className="ws-chip warn" title={`${r.fallbackFrom ?? 'The first model'} failed first`}>Answered by fallback</span> : <span className="ws-chip good">Answered</span>)
                          : <span className="ws-chip bad" title={r.error ?? undefined}>Failed</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {cursor && reqs && <button className="ws-btn small" style={{ marginTop: 10 }} onClick={() => loadReqs(cursor)}>Show older</button>}
        </>
      )}
    </section>
  );
}
