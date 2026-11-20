'use client';

/**
 * The Providers tab's main view (M20; owner, 2026-11-18: providers add any model themselves, so staff want to see which
 * provider listed which model and how it scored, and every provider's private practice runs with what they tuned between
 * them). Two panes:
 *   Listings       every listing, our internal test accounts' marked, published first, then newest: provider, model,
 *                  precision, states, each suite's published score (whole points over the runs counted, as the public
 *                  pages show it), whether the router counts it measured, its runs by kind and status, the users connected
 *                  to its host, its Smart Router requests over 7 and 30 days, whether it is in the Smart Router, its dates
 *   Practice runs  every account's newest practice runs (private: never published, never counted): each suite's result and
 *                  its change against the listing's previous practice run ("Coding 64 → 71 (+7)"), the money, and what the
 *                  provider changed in between, field by field as the API words it (a key or access headers by name only)
 * A row opens its provider's detail (onOpen). Data: /api/admin/marketplace/listings and practice-runs → the API's
 * /internal/admin/marketplace/*. The tables scroll inside their own box on a narrow screen.
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader, Note, Pane, Pill, Tag } from '@/components/studio';
import { EmptyRow } from './bits';
import { ago, day, fullDate, num } from './format';

interface StaffProvider { publicId: string; name: string; kind: string; state: string; standing: string; internal: boolean }
type Suite = 'coding' | 'reasoning' | 'tooling' | 'canary';
interface StaffScore { score: number; runs: number; lastDay: string | null }

interface AdminListing {
  publicId: string; entrySlug: string; internal: boolean; provider: StaffProvider | null;
  model: { name: string; maker: string | null; slug: string | null }; upstreamModel: string; host: string | null;
  precision: string; precisionNote: string | null; state: string; pauseReason: string | null; benchState: string;
  measured: boolean; scores: Record<Suite, StaffScore | null>; runs: Record<string, Record<string, number>>;
  connections: number; routed: { requests7d: number; requests30d: number }; router: { enabled: boolean; enabledAt: string | null };
  createdAt: string; publishedAt: string | null; delistedAt: string | null;
}

interface PracticeResult { score: number | null; passed: number | null; total: number | null }
type PracticeSuite = 'coding' | 'reasoning' | 'tooling';
interface PracticeChanges {
  previous: { id: string; requestedAt: string; status: string } | null;
  /** Per suite: the previous run's score, this run's, and the difference (one decimal). */
  scores: Record<PracticeSuite, { before: number | null; after: number | null; delta: number | null }>;
  /** What the provider changed between the runs, as staff read it ("price input $0.50 → $0.40", "API key replaced"). */
  lines: string[];
  changed: boolean;
}
interface AdminPracticeRun {
  id: string; status: string; requestedAt: string; quoteUsd: number; capUsd: number; costUsd: number;
  results: Partial<Record<PracticeSuite, PracticeResult>>;
  error: string | null; errorText: string | null; provider: StaffProvider | null; internal: boolean;
  listing: { publicId: string; entrySlug: string | null; model: string | null; precision: string | null } | null;
  requestedBy: number | null; startedAt: string | null; finishedAt: string | null; changes: PracticeChanges;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function load(path: string): Promise<{ ok: boolean; data: any; error: string | null }> {
  try {
    const r = await fetch(`/api/admin/marketplace/${path}`, { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    return { ok: r.ok && !!j?.success, data: j?.data ?? null, error: j?.message ?? j?.error ?? (r.ok ? null : `The API answered ${r.status}.`) };
  } catch {
    return { ok: false, data: null, error: 'Could not reach the server.' };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const SUITES: Array<[Suite, string]> = [['coding', 'Coding'], ['reasoning', 'Reasoning'], ['tooling', 'Tool use'], ['canary', 'Canary']];
const PRACTICE_SUITES = SUITES.filter(([s]) => s !== 'canary') as Array<[PracticeSuite, string]>;

const precisionLabel = (p: string | null, note?: string | null) => (!p ? '—' : p === 'other' ? (note ? `other (${note})` : 'other') : p.toUpperCase());
const words = (s: string) => s.replace(/_/g, ' ');
const listingTone = (s: string): 'good' | 'warn' | 'accent' | undefined => (s === 'published' ? 'good' : s === 'paused' ? 'warn' : s === 'in_review' ? 'accent' : undefined);
const runTone = (s: string): 'good' | 'bad' | 'accent' | undefined => (s === 'done' ? 'good' : s === 'failed' ? 'bad' : s === 'queued' || s === 'running' ? 'accent' : undefined);
const usd = (n: number) => `$${n > 0 && n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`;
const KIND: Record<string, string> = { scheduled: 'Scheduled', readiness: 'Readiness', confirmation: 'Confirmation', spot_check: 'Spot check', user_test: 'User test' };

/** The provider's name (a button that opens its detail, when the row has no other), with our internal test accounts tagged. */
function ProviderCell({ p, internal, onOpen }: { p: StaffProvider | null; internal: boolean; onOpen?: (publicId: string) => void }) {
  if (!p) return <span className="st-faint">—</span>;
  return (
    <div className="ad-acct">
      {onOpen
        ? <button type="button" className="ad-acct-e mp-admin-open" title={`Open ${p.name}`} onClick={() => onOpen(p.publicId)}>{p.name}</button>
        : <span className="ad-acct-e">{p.name}</span>}
      <span className="ad-acct-s">
        {internal && <Tag tone="line" title="One of our own test accounts, left out of every total">Internal</Tag>}
        {words(p.state)}{p.standing !== 'good' ? ` · standing: ${words(p.standing)}` : ''}
      </span>
    </div>
  );
}

/** A suite's published score: whole points, and the runs it rests on. */
function ScoreCell({ s }: { s: StaffScore | null }) {
  if (!s) return <td className="is-num"><span className="st-faint">—</span></td>;
  return <td className="is-num" title={`${s.score} over the newest ${s.runs} counted runs${s.lastDay ? `, newest day ${day(s.lastDay)}` : ''}`}>{s.score} <span className="st-faint">({s.runs})</span></td>;
}

/** Runs by kind, then status: "Scheduled: 12 published, 1 abandoned". */
function RunsCell({ runs }: { runs: Record<string, Record<string, number>> }) {
  const kinds = Object.keys(runs).sort();
  if (!kinds.length) return <span className="st-faint">none</span>;
  return (
    <div className="ad-mp-runs">
      {kinds.map(k => (
        <span key={k}>{KIND[k] ?? words(k)}: {Object.entries(runs[k]).sort((a, b) => b[1] - a[1]).map(([status, n]) => `${num(n)} ${words(status)}`).join(', ')}</span>
      ))}
    </div>
  );
}

export default function Listings({ onOpen }: { onOpen: (providerPublicId: string) => void }) {
  const [rows, setRows] = useState<AdminListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await load('listings');
    if (r.ok) { setRows(Array.isArray(r.data?.listings) ? r.data.listings : []); setError(null); } else setError(r.error);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  // Our own test accounts are listed, tagged, and never counted.
  const counted = (rows ?? []).filter(l => !l.internal);
  const sub = rows
    ? `${num(counted.length)} listing${counted.length === 1 ? '' : 's'}, ${num(counted.filter(l => l.state === 'published').length)} published (our test accounts left out). Published first, then newest. Scores are the published ones: whole points over the runs counted. Open one for its provider's record.`
    : 'Every model providers list: who lists it, how it scored, its runs, connections and Smart Router traffic.';

  return (
    <Pane title="Listings" sub={sub} ruled flush>
      {!rows && !error && <Loader label="Loading the listings" />}
      {error && <div className="ad-pad"><Note tone="bad" title="The listings did not load">{error}</Note></div>}
      {rows && (
        <div className="st-table-wrap ad-scroll is-tall">
          <table className="st-table ad-mp-table">
            <thead>
              <tr>
                <th>Listing</th><th>Provider</th><th>State</th>
                {SUITES.map(([s, label]) => <th key={s} className="is-num">{label}</th>)}
                <th>Measured</th><th>Runs</th><th className="is-num">Connections</th>
                <th className="is-num">Routed 7 d</th><th className="is-num">Routed 30 d</th><th>Smart Router</th><th>Created</th><th>Published</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow cols={15}>No listings yet.</EmptyRow>}
              {rows.map(l => (
                <tr key={l.publicId}>
                  <td>
                    <div className="ad-acct">
                      {l.provider
                        ? <button type="button" className="ad-acct-e mp-admin-open" title={`Open ${l.provider.name}`} onClick={() => onOpen(l.provider!.publicId)}>{l.model.name}</button>
                        : <span className="ad-acct-e">{l.model.name}</span>}
                      <span className="ad-acct-s">{l.model.maker ? `${l.model.maker} · ` : ''}{precisionLabel(l.precision, l.precisionNote)} · {l.entrySlug}</span>
                    </div>
                  </td>
                  <td><ProviderCell p={l.provider} internal={l.internal} /></td>
                  <td>
                    <div className="ad-acct">
                      <span><Pill tone={listingTone(l.state)}>{words(l.state)}</Pill></span>
                      <span className="ad-acct-s">
                        {l.pauseReason ? `paused: ${words(l.pauseReason)} · ` : ''}benchmarks: {words(l.benchState)}
                      </span>
                    </div>
                  </td>
                  {SUITES.map(([s]) => <ScoreCell key={s} s={l.scores?.[s] ?? null} />)}
                  <td>{l.measured ? 'Yes' : <span className="st-faint">No</span>}</td>
                  <td><RunsCell runs={l.runs ?? {}} /></td>
                  <td className="is-num" title={l.host ? `Users connected to ${l.host}` : 'No endpoint'}>{num(l.connections)}</td>
                  <td className="is-num">{num(l.routed.requests7d)}</td>
                  <td className="is-num">{num(l.routed.requests30d)}</td>
                  <td className="ad-nowrap">{l.router.enabled ? <>On <span className="st-faint" title={fullDate(l.router.enabledAt)}>since {day(l.router.enabledAt)}</span></> : <span className="st-faint">Off</span>}</td>
                  <td className="ad-nowrap" title={fullDate(l.createdAt)}>{day(l.createdAt)}</td>
                  <td className="ad-nowrap" title={fullDate(l.delistedAt ?? l.publishedAt)}>
                    {l.publishedAt ? day(l.publishedAt) : <span className="st-faint">—</span>}
                    {l.delistedAt && <span className="st-faint"> · delisted {day(l.delistedAt)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Pane>
  );
}

/** "Changed between runs: …", the sentence for no change on our side, or the listing's first practice run. */
function changeWords(c: PracticeChanges): string {
  if (!c.previous) return 'First practice run of this listing';
  if (!c.changed || !c.lines.length) return 'No changes on our side since the previous run (results can still move with changes on the provider\'s own servers)';
  return `Changed between runs: ${c.lines.join('; ')}`;
}

/** A suite's result against the previous practice run: "Coding 64 → 71 (+7)", "Coding 71", "Tool use: no score (was 70)". */
function suiteWords(label: string, x: PracticeResult | undefined, s: PracticeChanges['scores'][PracticeSuite] | undefined): string | null {
  if (!x) return null;
  const before = s?.before ?? null;
  if (x.score === null) return `${label}: no score${before !== null ? ` (was ${before})` : ''}`;
  if (before === null) return `${label} ${x.score}`;
  const d = s?.delta ?? Math.round((x.score - before) * 10) / 10;
  return `${label} ${before} → ${x.score} (${d > 0 ? `+${d}` : d < 0 ? `−${Math.abs(d)}` : '±0'})`;
}

export function PracticeRuns({ onOpen }: { onOpen: (providerPublicId: string) => void }) {
  const [rows, setRows] = useState<AdminPracticeRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await load('practice-runs?limit=100');
    if (r.ok) { setRows(Array.isArray(r.data?.runs) ? r.data.runs : []); setError(null); } else setError(r.error);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <Pane title="Practice runs" sub="Providers' private practice runs, newest first, from every account: never published, never counted. Each shows what the provider changed since the listing's previous practice run." ruled flush>
      {!rows && !error && <Loader label="Loading the practice runs" />}
      {error && <div className="ad-pad"><Note tone="bad" title="The practice runs did not load">{error}</Note></div>}
      {rows && (
        <div className="st-table-wrap ad-scroll">
          <table className="st-table ad-mp-table">
            <thead>
              <tr>
                <th>Requested</th><th>Listing</th><th>Provider</th><th>Status</th>
                <th>Results (against the previous run)</th><th className="is-num">Cost</th><th>Changes since the previous run</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow cols={7}>No practice runs yet.</EmptyRow>}
              {rows.map(r => {
                const text = changeWords(r.changes);
                return (
                  <tr key={r.id}>
                    <td className="ad-nowrap" title={`${fullDate(r.requestedAt)}${r.requestedBy ? ` by user #${r.requestedBy}` : ''}`}>{ago(r.requestedAt)}</td>
                    <td>
                      <div className="ad-acct">
                        <span className="ad-acct-e">{r.listing?.model ?? r.listing?.publicId ?? '—'}</span>
                        <span className="ad-acct-s">{r.listing ? `${precisionLabel(r.listing.precision)} · ${r.listing.entrySlug ?? r.listing.publicId}` : 'listing removed'}</span>
                      </div>
                    </td>
                    <td><ProviderCell p={r.provider} internal={r.internal} onOpen={onOpen} /></td>
                    <td>
                      <div className="ad-acct">
                        <span><Pill tone={runTone(r.status)}>{r.status}</Pill></span>
                        {r.error && <span className="ad-acct-s" title={r.error}>{r.errorText ?? words(r.error)}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="ad-mp-results">
                        {PRACTICE_SUITES.map(([s, label]) => {
                          const x = r.results?.[s];
                          const line = suiteWords(label, x, r.changes?.scores?.[s]);
                          return line && x ? <span key={s}>{line}{x.passed !== null && x.total !== null ? <span className="st-faint"> · {x.passed}/{x.total} tasks</span> : null}</span> : null;
                        })}
                        {!PRACTICE_SUITES.some(([s]) => r.results?.[s]) && <span className="st-faint">no result yet</span>}
                      </div>
                    </td>
                    <td className="is-num">
                      <div>{usd(r.costUsd)} <span className="st-faint">of {usd(r.capUsd)}</span></div>
                      <div className="st-faint">quote {usd(r.quoteUsd)}</div>
                    </td>
                    <td>
                      <p className={`ad-mp-changes${r.changes.changed ? '' : ' is-none'}`}
                        title={r.changes.previous ? `Previous run ${fullDate(r.changes.previous.requestedAt)} (${r.changes.previous.status})` : undefined}>{text}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Pane>
  );
}
