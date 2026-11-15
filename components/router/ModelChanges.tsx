'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Pane from '@/components/studio/Pane';
import { Loader, Note, ProviderMark, Tag } from '@/components/studio/Bits';
import { wsApi } from '@/components/workspace/ws';
import { ActivityRow } from './RecentRequests';
import { apiClient, ApiRequestError } from '@/lib/api-client';
import {
  ALL_KEYS, DISCLOSURE, DISCLOSURE_MOVE, KEY_LABEL, LOADING, PANE_TITLE, RETRY, SHOW_OLDER, UNAVAILABLE,
  afterLabel, beforeLabel, causeLine, changeMeta, changeTitle, keyOption, keyWord, kindTag, modelChangesOf, moveLabel, notesOf, projectHref,
  projectPointer, stateOf, subLine, type ModelChange, type ModelChangeKey, type ModelChanges,
} from '@/lib/model-changes';
import '@/styles/studio-router.css';

/**
 * Model changes (router release AW3, on the API's A1c; design-features 2026-11-13 §3.2): when a key's automatic requests
 * started going to another model, and why. Every plan, no upgrade link. Each change is one summary line built from the
 * studio's list primitives (st-row, ProviderMark, Tag), and under it a native disclosure holding the requests before and
 * after exactly as Recent activity shows them: ActivityRow, each with its own WhyThisModel (the stored reason, folded).
 * No row or "why" component of its own. The words are lib/model-changes.ts's. Layer 2 (AW4, on the API's A1d): a change whose
 * request after recorded why its pick replaced the previous one says so in one line under the title, with the cause's tag.
 * The same pane serves /router (personal keys) and a project's Activity tab (`project`); an API that answers 404 (before
 * A1c) hides it, so the web and the API deploy in either order.
 */

/** One change: the summary line, then the requests before and after. */
export function ModelChangeRow({ c, keys, names, now }: { c: ModelChange; keys: Map<number, ModelChangeKey>; names: Record<string, string>; now?: number }) {
  const nameOf = (m: string) => names[m] ?? m;
  const old = nameOf(c.from); const fresh = nameOf(c.to);
  const move = c.kind === 'conversation';
  const why = causeLine(c, nameOf);
  return (
    <div className="sr-mc-item">
      <div className="st-row">
        <ProviderMark provider={c.toProvider ?? ''} />
        <div className="st-row-main">
          <div className="st-row-t" title={`${c.from} → ${c.to}`}>{changeTitle(c, nameOf)}</div>
          {why && <div className="st-row-s sr-mc-cause">{why}</div>}
          <div className="st-row-s sr-mc-meta">{changeMeta(c, keyWord(keys.get(c.keyId), c.keyId), now)}</div>
        </div>
        <div className="st-row-end"><Tag tone="line">{kindTag(c)}</Tag></div>
      </div>
      {(c.before || c.after) && (
        <details className="sr-mc-why">
          <summary className="st-label">{move ? DISCLOSURE_MOVE : DISCLOSURE}</summary>
          <div className="st-rows sr-act">
            {c.before && <p className="sr-mc-label">{beforeLabel(old)}</p>}
            {c.before && <ActivityRow req={c.before} names={names} />}
            {c.after && <p className="sr-mc-label">{move ? moveLabel(c, fresh) : afterLabel(fresh)}</p>}
            {c.after && <ActivityRow req={c.after} names={names} />}
          </div>
        </details>
      )}
    </div>
  );
}

export interface ModelChangesViewProps {
  data: ModelChanges;
  names: Record<string, string>;
  keyValue: 'all' | number;
  onKey: (key: 'all' | number) => void;
  onMore?: () => void;
  loadingMore?: boolean;
  /** A project's Activity tab (the project route), else /router (personal keys). */
  project?: boolean;
  now?: number;
}

/** The pane for one answer, in each of its states (lib/model-changes.ts stateOf). */
export function ModelChangesView({ data, names, keyValue, onKey, onMore, loadingMore, project = false, now }: ModelChangesViewProps) {
  const nameOf = (m: string) => names[m] ?? m;
  // Whose requests were read: the project tab (yours only without spend detail) or /router, and the key chosen.
  const scope = { project, ownOnly: project && data.ownOnly === true, key: keyValue };
  const state = stateOf(data, nameOf, scope);
  if (state.kind === 'hidden') return null;
  const keys = new Map(data.keys.map(k => [k.id, k]));
  const notes = notesOf(data, state, scope);
  const list = state.kind === 'list';
  const select = data.keys.length > 0 ? (
    <label className="st-field sr-mc-key">
      <span className="st-field-label">{KEY_LABEL}</span>
      <select className="st-select" value={String(keyValue)} onChange={e => onKey(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
        <option value="all">{ALL_KEYS}</option>
        {data.keys.map(k => <option key={k.id} value={k.id}>{keyOption(k)}</option>)}
      </select>
    </label>
  ) : undefined;
  const foot = notes.length || (list && data.more && onMore) ? (
    <div className="sr-mc-foot">
      {notes.map(n => <p key={n} className="sr-note-line">{n}</p>)}
      {list && data.more && onMore && (
        <button type="button" className="st-btn is-sm" onClick={onMore} disabled={!!loadingMore}>{SHOW_OLDER}</button>
      )}
    </div>
  ) : undefined;
  return (
    <Pane id={project ? 'project-model-changes' : 'model-changes'} title={PANE_TITLE} sub={subLine(data.window.days, project, scope.ownOnly)} actions={select}
      ruled={list} flush={list} foot={foot} className="sr-mc">
      {list && (
        <div className="sr-mc-list">
          {data.changes.map(c => <ModelChangeRow key={`${c.keyId}-${c.after?.id ?? c.at}-${c.kind}`} c={c} keys={keys} names={names} now={now} />)}
        </div>
      )}
      {state.kind === 'projects' && (
        <ul className="sr-mc-lines">
          {state.projects.map(p => {
            const w = projectPointer(p.name);
            return <li key={p.projectId}>{w.before}<Link href={projectHref(p.projectId)}>{w.project}</Link>{w.after}</li>;
          })}
        </ul>
      )}
      {state.kind === 'nochange' && <ul className="sr-mc-lines">{state.lines.map(l => <li key={l}>{l}</li>)}</ul>}
      {(state.kind === 'labels' || state.kind === 'noauto') && <p className="sr-mc-line">{state.line}</p>}
    </Pane>
  );
}

/** The key a link preselects (`?key=<id>`), else every key. */
export function keyParamOf(raw: string | null | undefined): 'all' | number {
  return raw && /^[1-9]\d{0,15}$/.test(raw) ? Number(raw) : 'all';
}

type Status = 'loading' | 'ready' | 'gone' | 'error';

/**
 * The pane with its data: personal keys (GET /api/router/analytics/model-changes), or a project's (`project`: GET
 * /api/account/org/projects/:id/model-changes). Nothing shows while the first answer is on its way on /router; a 404
 * hides the pane for good. `onUnavailable`: told when the API has no model changes (the project tab hides its choice).
 */
export default function ModelChangesPane({ names, initialKey, project, onUnavailable }: {
  names: Record<string, string>;
  initialKey?: string | null;
  project?: number;
  onUnavailable?: () => void;
}) {
  const [key, setKey] = useState<'all' | number>(() => keyParamOf(initialKey));
  const [data, setData] = useState<ModelChanges | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const unavailable = useRef(onUnavailable);
  unavailable.current = onUnavailable;
  // The key on show: a page of older changes that comes back after the key changed belongs to the old key, and is dropped.
  const shown = useRef(key);
  shown.current = key;

  /** One page: the raw answer read by modelChangesOf, or 'gone' (404), or null (any other failure). */
  const fetchPage = useCallback(async (k: 'all' | number, before?: string): Promise<ModelChanges | 'gone' | null> => {
    const q = new URLSearchParams({ key: String(k), limit: '20', ...(before ? { before } : {}) });
    if (project !== undefined) {
      const r = await wsApi<unknown>(`/projects/${project}/model-changes?${q}`);
      if (r.status === 404) return 'gone';
      return r.ok ? modelChangesOf(r.data) : null;
    }
    try {
      return modelChangesOf(await apiClient.getModelChanges({ key: k, limit: 20, ...(before ? { before } : {}) }));
    } catch (e) {
      return e instanceof ApiRequestError && e.status === 404 ? 'gone' : null;
    }
  }, [project]);

  useEffect(() => {
    let alive = true;
    setStatus(s => (s === 'gone' ? s : 'loading'));
    fetchPage(key).then(d => {
      if (!alive) return;
      if (d === 'gone') { setStatus('gone'); unavailable.current?.(); return; }
      if (!d) { setStatus('error'); return; }
      // A link that names a key this account does not hold lists every key.
      if (key !== 'all' && !d.keys.some(k2 => k2.id === key)) { setKey('all'); return; }
      setData(d); setStatus('ready');
    });
    return () => { alive = false; };
  }, [key, fetchPage, attempt]);

  // /router?key=<id>#model-changes (the keys page's link): the pane comes after the dashboard's first paint.
  useEffect(() => {
    if (status !== 'ready' || project !== undefined || typeof window === 'undefined' || window.location.hash !== '#model-changes') return;
    document.getElementById('model-changes')?.scrollIntoView({ block: 'start' });
  }, [status, project]);

  // "Show older": the answer's own cursor (`next`: the last change's time and request after), so a page never repeats or
  // skips a change, ties in time included.
  const more = useCallback(async () => {
    if (!data || !data.changes.length) return;
    const k = key;
    const before = data.next ?? data.changes[data.changes.length - 1].at;
    setLoadingMore(true);
    const d = await fetchPage(k, before);
    setLoadingMore(false);
    if (shown.current !== k) return;
    if (d && d !== 'gone') setData(prev => (prev ? { ...prev, changes: [...prev.changes, ...d.changes], more: d.more, next: d.next, capped: d.capped, keysCapped: d.keysCapped } : d));
  }, [data, key, fetchPage]);

  if (status === 'gone') return null;
  if (status === 'error') {
    return (
      <Pane id={project !== undefined ? 'project-model-changes' : 'model-changes'} title={PANE_TITLE}>
        <Note tone="warn">{UNAVAILABLE}</Note>
        <div className="sr-mc-foot"><button type="button" className="st-btn is-sm" onClick={() => setAttempt(n => n + 1)}>{RETRY}</button></div>
      </Pane>
    );
  }
  if (!data) return project !== undefined ? <Loader label={LOADING} /> : null;
  return (
    <ModelChangesView data={data} names={names} keyValue={key} onKey={setKey} onMore={more} loadingMore={loadingMore} project={project !== undefined} />
  );
}
