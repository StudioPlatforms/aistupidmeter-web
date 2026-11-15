'use client';

import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ApiRequestError } from '@/lib/api-client';
import type { EndpointHealthBucket, EndpointHealthFailure, EndpointHealthHistory, EndpointView } from '@/lib/api-client';
import { Loader, Note, Stats, Stat } from '@/components/studio';
import '@/styles/studio-endpoint-health.css';

/**
 * An endpoint's health over time (R6; plan "Private endpoints" R6 "Web"): the last 24 hours as a
 * strip of bars (48 of 30 minutes from R6, 24 hourly before it), the 7-day uptime and the newest 20
 * failures. Opened from the endpoint's row ("Health"). Requests, tests and the health job's checks
 * all count; the API sums them per bucket.
 *
 * The strip encodes each bucket twice, so it never depends on colour alone (green and red are close
 * for red-green colour blindness): height steps up with severity (no requests: a tick; no failures:
 * short; under 10% failed: taller; 10% or more: taller still; all failed: full height) and the colour
 * follows. Hover, tap (anywhere on the strip: the bar under the finger) or the arrow keys read one
 * bucket in the line under it; a visually hidden table carries every bucket.
 *
 * The parent passes the two loaders, so the same view serves every scope's API (the Providers
 * page's endpoints, and R5's workspace and project servers).
 */

type BucketState = 'none' | 'ok' | 'few' | 'some' | 'all';
/** A bucket where fewer than this share of the requests failed reads as "a few failed". */
const FEW_FAILED = 0.1;

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const fmtMs = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`);

function clockOf(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "14:02" today, "Nov 10, 14:02" before. */
function fmtClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toDateString() === new Date().toDateString() ? clockOf(d) : `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${clockOf(d)}`;
}

/** "14:00–14:30", with the day in front when it is not today. */
function fmtRange(startMs: number, bucketMs: number): string {
  const s = new Date(startMs);
  const e = new Date(startMs + bucketMs);
  const day = s.toDateString() === new Date().toDateString() ? '' : `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, `;
  return `${day}${clockOf(s)}–${clockOf(e)}`;
}

/** One decimal, rounded down: 99.96% with failures never reads as 100%. */
function fmtUptime(u: number): string {
  if (u >= 1) return '100%';
  return `${(Math.floor(Math.max(0, u) * 1000) / 10).toFixed(1)}%`;
}

function stateOf(b: EndpointHealthBucket): BucketState {
  if (!(b.requests > 0)) return b.failures > 0 ? 'all' : 'none';
  if (!(b.failures > 0)) return 'ok';
  if (b.failures >= b.requests) return 'all';
  return b.failures / b.requests < FEW_FAILED ? 'few' : 'some';
}

const LEGEND: Array<[BucketState, string]> = [
  ['ok', 'No failures'],
  ['few', 'Under 10% failed'],
  ['some', '10% or more failed'],
  ['all', 'All failed'],
  ['none', 'No requests'],
];

const SOURCE: Record<string, string> = { ping: 'Health check', probe: 'Test', live: 'Requests' };

const CAUSE: Record<string, string> = {
  unreachable: 'Could not connect',
  timeout: 'Timed out',
  tls: 'TLS failed',
  server: 'Server error',
  auth: 'Key refused',
  busy: 'Busy (rate limited)',
  rejected: 'Request refused',
  redirect: 'Redirected',
  bad_response: 'Malformed answer',
  blocked: 'Address not allowed',
  tunnel_offline: 'Tunnel offline',
};

const causeText = (c: unknown) => (typeof c === 'string' && c ? CAUSE[c] ?? c.replace(/_/g, ' ') : 'Failed');
/** What went wrong, with the HTTP status when the server answered one: "Server error · HTTP 503". */
const whatHappened = (f: EndpointHealthFailure) => `${causeText(f.cause)}${typeof f.status === 'number' ? ` · HTTP\u00a0${f.status}` : ''}`;

/** The answer, read defensively: whatever an older or a broken API sends, nothing here throws. */
function readHistory(h: EndpointHealthHistory | null): { buckets: EndpointHealthBucket[]; bucketMs: number; uptime7d: number | null | undefined; failures: EndpointHealthFailure[]; r6: boolean } {
  const raw = h && Array.isArray(h.buckets) ? h.buckets : [];
  const buckets = raw
    .filter(b => b && typeof b.start === 'string' && Number.isFinite(Date.parse(b.start)))
    .map(b => ({
      start: b.start,
      requests: Number.isFinite(b.requests) && b.requests > 0 ? Math.floor(b.requests) : 0,
      failures: Number.isFinite(b.failures) && b.failures > 0 ? Math.floor(b.failures) : 0,
      p50Ms: typeof b.p50Ms === 'number' && Number.isFinite(b.p50Ms) ? b.p50Ms : null,
    }));
  const r6 = !!h && typeof h.bucketMs === 'number' && h.bucketMs > 0;
  // Before R6 the answer has no bucketMs: the spacing of the buckets, else 24 h over their count.
  const spaced = buckets.length > 1 ? Date.parse(buckets[1].start) - Date.parse(buckets[0].start) : 0;
  const bucketMs = r6 ? (h as EndpointHealthHistory).bucketMs as number : spaced > 0 ? spaced : buckets.length ? Math.round(86_400_000 / buckets.length) : 1_800_000;
  const failures = (h && Array.isArray(h.failures) ? h.failures : [])
    .filter(f => f && typeof f.ts === 'string' && Number.isFinite(Date.parse(f.ts)))
    // Only the fields' own types reach the page: whatever a broken API sends, nothing here throws.
    .map(f => ({
      ts: f.ts,
      source: typeof f.source === 'string' ? f.source : '',
      cause: typeof f.cause === 'string' ? f.cause : null,
      status: typeof f.status === 'number' && Number.isFinite(f.status) ? f.status : null,
      modelId: typeof f.modelId === 'number' && Number.isFinite(f.modelId) ? f.modelId : null,
    }) as EndpointHealthFailure)
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
    .slice(0, 20);
  const u = h ? h.uptime7d : undefined;
  return { buckets, bucketMs, uptime7d: typeof u === 'number' && Number.isFinite(u) ? u : u === null ? null : undefined, failures, r6 };
}

function loadError(err: unknown, noun: 'endpoint' | 'server'): string {
  if (err instanceof ApiRequestError) {
    if (err.status === 404) return `This ${noun} no longer exists, or its health history is not available yet.`;
    if (err.message && !/^Request failed with status \d+$/.test(err.message)) return err.message;
  }
  return 'The health history could not be loaded. Try again.';
}

/**
 * The bars, their axis, the line that reads one bar, the legend, and the same buckets as a table for
 * screen readers. `p50Ms24h`: the endpoint's median over 24 h, for the summary line.
 */
function HealthStrip({ buckets, bucketMs, p50Ms24h }: { buckets: EndpointHealthBucket[]; bucketMs: number; p50Ms24h: number | null }) {
  const [sel, setSel] = useState<number | null>(null);
  const readoutId = useId();
  const n = buckets.length;
  const minutes = Math.round(bucketMs / 60_000);
  const per = minutes >= 60 && minutes % 60 === 0 ? (minutes === 60 ? 'hour' : `${minutes / 60} hours`) : `${minutes} minutes`;
  const total = buckets.reduce((s, b) => s + b.requests, 0);
  const failed = buckets.reduce((s, b) => s + b.failures, 0);

  let readout: ReactNode;
  if (sel != null && buckets[sel]) {
    const b = buckets[sel];
    const parts = [fmtRange(Date.parse(b.start), bucketMs)];
    if (b.requests > 0) {
      parts.push(plural(b.requests, 'request'), b.failures > 0 ? `${b.failures.toLocaleString('en-US')} failed` : 'none failed');
      if (b.p50Ms != null) parts.push(`p50 ${fmtMs(b.p50Ms)}`);
    } else {
      parts.push(b.failures > 0 ? `${b.failures.toLocaleString('en-US')} failed` : 'no requests');
    }
    readout = parts.join(' · ');
  } else if (total > 0) {
    readout = ['Last 24 hours', plural(total, 'request'), failed > 0 ? `${failed.toLocaleString('en-US')} failed` : 'none failed', p50Ms24h != null ? `p50 ${fmtMs(p50Ms24h)}` : null]
      .filter(Boolean).join(' · ');
  } else {
    readout = 'No requests, tests or health checks in the last 24 hours.';
  }

  /** The bar under a pointer: by position across the whole strip, gaps included. */
  const barAt = (ev: PointerEvent<HTMLDivElement>): number | null => {
    if (!n) return null;
    const r = ev.currentTarget.getBoundingClientRect();
    if (!(r.width > 0)) return null;
    return Math.max(0, Math.min(n - 1, Math.floor(((ev.clientX - r.left) / r.width) * n)));
  };

  const onKey = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (!n) return;
    let next: number | null | undefined;
    if (ev.key === 'ArrowLeft') next = Math.max(0, (sel ?? n) - 1);
    else if (ev.key === 'ArrowRight') next = Math.min(n - 1, (sel ?? -1) + 1);
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = n - 1;
    else if (ev.key === 'Escape' && sel != null) next = null;
    if (next === undefined) return;
    ev.preventDefault();
    ev.stopPropagation();
    setSel(next);
  };

  return (
    <div className="eh-chart">
      <div
        className={`eh-bars${sel != null ? ' has-sel' : ''}`}
        style={{ '--n': Math.max(1, n) } as CSSProperties}
        role="group"
        tabIndex={0}
        aria-label={`Requests per ${per} over the last 24 hours. Use the left and right arrow keys to read each bar.`}
        aria-describedby={readoutId}
        onKeyDown={onKey}
        onFocus={() => setSel(s => (s ?? (n ? n - 1 : null)))}
        onBlur={() => setSel(null)}
        onPointerDown={ev => { const i = barAt(ev); if (i !== null) setSel(i); }}
        onPointerMove={ev => { if (ev.pointerType !== 'mouse') return; const i = barAt(ev); if (i !== null) setSel(i); }}
        // Only a mouse leaving clears the reading: a finger lifting fires pointerleave too, before the focus
        // that would then read the newest bar instead of the one tapped.
        onPointerLeave={ev => { if (ev.pointerType === 'mouse' && document.activeElement !== ev.currentTarget) setSel(null); }}
      >
        {buckets.map((b, i) => (
          <span key={i} className={`eh-bar is-${stateOf(b)}${i === sel ? ' is-sel' : ''}`} aria-hidden="true">
            <i />
          </span>
        ))}
      </div>
      <div className="eh-axis" aria-hidden="true"><span>24 h ago</span><span>Now</span></div>
      <p className="eh-readout" id={readoutId} aria-live="polite">{readout}</p>
      <ul className="eh-legend" aria-label="Legend">
        {LEGEND.map(([s, text]) => <li key={s}><i className={`eh-key is-${s}`} aria-hidden="true" />{text}</li>)}
      </ul>
      <div className="st-sr">
        <table>
          <caption>Requests per {per}, last 24 hours</caption>
          <thead><tr><th scope="col">Time</th><th scope="col">Requests</th><th scope="col">Failed</th><th scope="col">p50</th></tr></thead>
          <tbody>
            {buckets.map((b, i) => (
              <tr key={i}>
                <th scope="row">{fmtRange(Date.parse(b.start), bucketMs)}</th>
                <td>{b.requests}</td>
                <td>{b.failures}</td>
                <td>{b.p50Ms != null ? fmtMs(b.p50Ms) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The health view: summary tiles, the 24-hour strip and the newest failures. `loadHealth` and
 * `loadView` fetch the scope's GET …/:id/health?window=24h and GET …/:id (the Providers page's
 * /router/endpoints, a workspace's or a project's /account/org/… from R5); `foot` is the dialog's
 * footer strip, where its buttons go (EndpointsPane's dialog).
 */
export default function HealthView({ loadHealth, loadView, foot, onClose, noun = 'endpoint' }: {
  loadHealth: () => Promise<EndpointHealthHistory>;
  loadView: () => Promise<EndpointView>;
  foot: HTMLElement | null;
  onClose: () => void;
  /** What one is called: "endpoint" on the Providers page, "server" on the workspace pages (R5). */
  noun?: 'endpoint' | 'server';
}) {
  const [history, setHistory] = useState<EndpointHealthHistory | null>(null);
  const [view, setView] = useState<EndpointView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  // The detail call failed (its tiles then say so rather than "nothing measured").
  const [viewFailed, setViewFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The detail is optional here (the 7-day uptime before R6, p50, the model names): its failure
      // must not hide the history.
      const [h, v] = await Promise.all([loadHealth(), loadView().catch(() => null)]);
      setHistory(h);
      if (v) setView(v);
      setViewFailed(!v);
      setLoaded(true);
    } catch (err) {
      setError(loadError(err, noun));
    } finally {
      setLoading(false);
    }
  }, [loadHealth, loadView, noun]);

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(() => readHistory(history), [history]);
  const models = useMemo(() => new Map((view?.models ?? []).map(m => [m.id, m.model])), [view]);
  const p50 = view?.health && typeof view.health.p50Ms24h === 'number' ? view.health.p50Ms24h : null;
  // R6's history carries the 7-day uptime; before it, the detail does.
  const uptime = data.uptime7d !== undefined ? data.uptime7d : (view?.health && typeof view.health.uptime7d === 'number' ? view.health.uptime7d : null);
  const total = data.buckets.reduce((s, b) => s + b.requests, 0);
  const failed = data.buckets.reduce((s, b) => s + b.failures, 0);
  const checkedAt = view?.health?.checkedAt ?? null;
  const minutes = Math.round(data.bucketMs / 60_000);

  const buttons = (
    <>
      <button type="button" className="st-btn" onClick={() => void load()} disabled={loading}>{loading && loaded ? 'Refreshing…' : 'Refresh'}</button>
      <button type="button" className="st-btn is-primary" onClick={onClose}>Done</button>
    </>
  );

  if (!loaded) {
    return (
      <>
        {error
          ? <Note tone="bad" title="Could not load the health history">{error}</Note>
          : <Loader label="Loading the health history" minHeight={240} />}
        {foot && createPortal(buttons, foot)}
      </>
    );
  }

  const modelOf = (id: number | null) => (id == null ? '—' : !view ? '—' : models.get(id) ?? 'A removed model');
  // What a tile says when it has no number: unknown because the detail did not load, or nothing to measure.
  const noDetail = !view && viewFailed ? 'The details did not load' : null;

  return (
    <div className={`ep-step-body eh-body${loading ? ' is-stale' : ''}`} aria-busy={loading}>
      {error && <Note tone="bad" title="Could not refresh">{error}</Note>}

      <Stats columns={3} reveal={false}>
        <Stat label="Uptime, last 7 days" value={uptime != null ? fmtUptime(uptime) : '—'}
          sub={uptime == null ? (data.uptime7d === undefined && noDetail ? noDetail : 'Nothing measured yet') : undefined} />
        <Stat label="Failed, last 24 hours" value={total > 0 ? failed.toLocaleString('en-US') : '—'} unit={total > 0 ? `of ${total.toLocaleString('en-US')}` : undefined}
          sub={total > 0 ? undefined : 'No requests'} />
        <Stat label="p50, last 24 hours" value={p50 != null ? fmtMs(p50) : '—'} sub={p50 == null ? (noDetail ?? 'No successful requests') : undefined} />
      </Stats>

      <section className="eh-sec" aria-label="The last 24 hours">
        <p className="st-label">Last 24 hours</p>
        {data.buckets.length > 0
          ? <HealthStrip buckets={data.buckets} bucketMs={data.bucketMs} p50Ms24h={p50} />
          : <p className="st-text eh-none">No requests, tests or health checks in the last 24 hours.</p>}
        <p className="st-hint eh-note">
          Each bar is {minutes >= 60 && minutes % 60 === 0 ? (minutes === 60 ? 'an hour' : `${minutes / 60} hours`) : `${minutes} minutes`} of requests,
          tests and health checks.{checkedAt ? ` Last check ${fmtClock(checkedAt)}.` : ''}
        </p>
      </section>

      <section className="eh-sec" aria-label="Recent failures">
        <p className="st-label">Recent failures{data.failures.length > 0 && <span>{data.failures.length === 20 ? 'the newest 20' : plural(data.failures.length, 'failure')}</span>}</p>
        {data.failures.length === 0 ? (
          <p className="st-text eh-none">{data.r6 ? 'No failures recorded in the last 14 days.' : 'No failures in the last 24 hours.'}</p>
        ) : (
          <div className="st-table-wrap eh-table-wrap">
            <table className="st-table is-stack eh-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Source</th>
                  <th scope="col">What happened</th>
                  <th scope="col">Model</th>
                </tr>
              </thead>
              <tbody>
                {data.failures.map((f, i) => (
                  <tr key={`${f.ts}-${i}`}>
                    <td data-label="When" className="is-head eh-when">{fmtClock(f.ts)}</td>
                    <td data-label="Source" className="eh-src">{SOURCE[f.source] ?? (f.source || '—')}</td>
                    <td data-label="What happened">{whatHappened(f)}</td>
                    {/* A server-level check names no model: the line is left out of a phone's card. */}
                    <td data-label="Model" className={`eh-model${f.modelId == null ? ' is-empty' : ''}`}>{modelOf(f.modelId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {foot && createPortal(buttons, foot)}
    </div>
  );
}
