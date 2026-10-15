'use client';

/**
 * What happened in the project: who changed what (from the workspace audit trail), and every
 * Smart Router request its keys made — never the prompt text. Both filter by person.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pane, Loader, Tag } from '@/components/studio';
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

  const csv = `/api/account/org/projects/${d.project.id}/requests?format=csv${person ? `&member=${person}` : ''}${outcome ? `&status=${outcome}` : ''}`;

  return (
    <>
      <div className="sw-toolbar is-fields">
        <div className="st-seg" role="group" aria-label="Show">
          <button type="button" aria-pressed={view === 'changes'} onClick={() => setView('changes')}>Changes</button>
          <button type="button" aria-pressed={view === 'requests'} onClick={() => setView('requests')}>Requests</button>
        </div>
        <div className="sw-filters">
          <label className="st-field">
            <span className="st-field-label">Person</span>
            <select className="st-select" value={person} onChange={e => setPerson(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Everyone</option>
              {d.members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
            </select>
          </label>
          {view === 'requests' && (
            <label className="st-field">
              <span className="st-field-label">Outcome</span>
              <select className="st-select" value={outcome} onChange={e => setOutcome(e.target.value as any)}>
                <option value="">All</option><option value="ok">Answered</option><option value="failed">Failed</option>
              </select>
            </label>
          )}
        </div>
      </div>

      {view === 'changes' && (
        <Pane
          title="Changes"
          sub="Who changed what in this project, newest first. System entries are budget notices and change alerts."
          ruled
          flush
          foot={cursor && changes ? <button type="button" className="st-btn is-sm" onClick={() => loadChanges(cursor)}>Show older</button> : undefined}
        >
          {!changes ? <Loader label="Loading changes" /> : changes.length === 0 ? (
            <div className="sw-none">
              <span className="st-empty-mark" aria-hidden="true"><i /><i /><i /></span>
              <p>Nothing yet.</p>
            </div>
          ) : (
            <div className="st-table-wrap">
              <table className="st-table is-stack sw-log">
                <tbody>
                  {changes.map(c => (
                    <tr key={c.id}>
                      <td className="is-head is-dim sw-when">{dateTime(c.at)}</td>
                      <td className="sw-log-text"><span className="sw-strong">{c.actor}</span> {describe(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Pane>
      )}

      {view === 'requests' && (
        <Pane
          title="Requests"
          sub={<>
            Every request made with this project&rsquo;s keys{ownOnly ? ' — yours only, as this project shows each person’s spending to managers only' : ''}.
            The prompt text is never shown here.
          </>}
          actions={<a className="st-btn is-sm" href={csv}>Download as CSV</a>}
          ruled
          flush
          foot={cursor && reqs ? <button type="button" className="st-btn is-sm" onClick={() => loadReqs(cursor)}>Show older</button> : undefined}
        >
          {!reqs ? <Loader label="Loading requests" /> : reqs.length === 0 ? (
            <div className="sw-none">
              <span className="st-empty-mark" aria-hidden="true"><i /><i /><i /></span>
              <p>No requests match.</p>
            </div>
          ) : (
            <div className="st-table-wrap">
              <table className="st-table is-stack">
                <thead><tr><th>Time</th><th>Person</th><th>Model</th><th className="is-num">Tokens</th><th className="is-num">Cost</th><th className="is-num sw-hide-sm">Time taken</th><th>Result</th></tr></thead>
                <tbody>
                  {reqs.map(r => (
                    <tr key={r.id}>
                      <td className="is-head is-dim sw-when">{dateTime(r.at)}</td>
                      <td data-label="Person">
                        <div className="sw-cellbox"><div>{r.person}</div>{r.key ? <div className="sw-s">{r.key}</div> : null}</div>
                      </td>
                      <td data-label="Model">
                        <div className="sw-cellbox">
                          <div className="sw-model">{r.model}</div>
                          <div className="sw-s">
                            {r.requested && r.requested !== r.model ? `asked for ${r.requested} · ` : r.requested === r.model ? 'named · ' : ''}
                            {providerLabel(r.provider)}{r.keySource ? ` · ${r.keySource === 'project' ? 'project key' : r.keySource === 'workspace' ? 'workspace key' : 'own key'}` : ''}
                          </div>
                        </div>
                      </td>
                      <td className="is-num" data-label="Tokens">{(r.tokensIn + r.tokensOut).toLocaleString()}</td>
                      <td className="is-num" data-label="Cost">{money(r.costUsd)}</td>
                      <td className="is-num is-dim sw-hide-sm">{ms(r.latencyMs)}</td>
                      <td data-label="Result">
                        {r.success
                          ? (r.rescued ? <Tag tone="warn" title={`${r.fallbackFrom ?? 'The first model'} failed first`}>Answered by fallback</Tag> : <Tag tone="good">Answered</Tag>)
                          : <Tag tone="bad" title={r.error ?? undefined}>Failed</Tag>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Pane>
      )}
    </>
  );
}
