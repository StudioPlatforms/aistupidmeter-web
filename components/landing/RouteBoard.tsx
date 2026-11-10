import type { CSSProperties } from 'react';
import Link from 'next/link';
import { slugifyModelName } from '@/lib/model-slug';
import NextRun from './NextRun';
import { logoFor } from './price-format';
import type { LandingSnapshot, LandingStrategy } from './types';

/**
 * The hero's explanation of the product, by analogy and by example: "Like GPS, for AI models", then
 * five everyday requests and the model the Smart Router sends each one to right now, with the
 * measured reason. It replaced a two-model cost comparison that first-time visitors could read as
 * a naive duel between a flagship and a small model; this shows what the product does instead.
 *
 * Every row is a real decision from GET /dashboard/landing (the production routing pipeline run
 * for a caller with keys for every provider), so nothing here names a model in code. The reason is
 * built from the pick's own row and the router's own explanation (primary.reasoning).
 */

interface Job {
  /** The snapshot strategy that answers this request. */
  key: string;
  /** The request, as a person would put it. */
  job: string;
  /** The leaderboard a quality strategy ranks on, in words; absent for speed and cost. */
  board?: string;
}

const JOBS: Job[] = [
  { key: 'best_coding', job: 'Fix a bug', board: 'coding' },
  { key: 'best_reasoning', job: 'Solve a hard problem', board: 'reasoning' },
  { key: 'best_tooling', job: 'Run an agent task', board: 'tool use' },
  { key: 'fastest', job: 'Answer fast' },
  { key: 'cheapest', job: 'Keep cost low' },
];

export interface RouteRow {
  key: string;
  job: string;
  model: string;
  displayName: string;
  provider: string;
  why: string;
}

/**
 * Why the router picked this model, in a few plain words.
 * Quality modes: models whose scores are statistically tied for first share the top tier, and the
 * default tie-break takes the cheapest of them — the router says so in its own explanation.
 */
function whyOf(job: Job, s: LandingStrategy): string | null {
  const row = s.rows.find(r => r.role === 'primary');
  if (!row) return null;
  if (job.board) {
    const said = s.primary.reasoning || '';
    if (!/Statistically tied/i.test(said)) return `First on ${job.board} right now`;
    return `Tied for first on ${job.board}${/chosen as the cheapest/i.test(said) ? ' · lowest cost' : ''}`;
  }
  if (job.key === 'fastest') {
    return row.metric != null ? `≈${(row.metric / 1000).toFixed(1)} s to answer · fastest we measure` : 'Fastest we measure';
  }
  return row.metric != null ? `$${row.metric.toFixed(2)} per 1M tokens · lowest list price` : 'Lowest list price';
}

/** The board's rows from a live snapshot; requests the router could not answer are left out. */
export function routeRows(snapshot: LandingSnapshot | null): RouteRow[] {
  if (!snapshot) return [];
  return JOBS.flatMap((job): RouteRow[] => {
    const s = snapshot.strategies[job.key];
    if (!s?.primary?.model) return [];
    const why = whyOf(job, s);
    if (!why) return [];
    return [{ key: job.key, job: job.job, model: s.primary.model, displayName: s.primary.displayName, provider: s.primary.provider, why }];
  });
}

/**
 * `reveal`: the board sits below the first screen (phones), so its routes are drawn when it
 * scrolls into view (the page's .lp-up reveal) instead of on load.
 */
export default function RouteBoard({ rows, modelCount, reveal = false }: { rows: RouteRow[]; modelCount: number; reveal?: boolean }) {
  // "No model wins every job" is said only while the rows below show it: more than one model named.
  const several = new Set(rows.map(r => r.model)).size > 1;
  return (
    <figure className={`lp-rb${reveal ? ' lp-up' : ''}`} aria-label="Where the Smart Router sends each kind of request right now">
      <figcaption className="lp-rb-head">
        <span className="lp-rb-live"><i />Smart Router <em>· live picks</em></span>
        <NextRun />
      </figcaption>
      <div className="lp-rb-body">
        <p className="lp-rb-title">Like GPS, for AI models.</p>
        <p className="lp-rb-sub">
          {several
            ? <>No model wins every job. We re-test all {modelCount} around the clock and send each request to the one that tests best for it.</>
            : <>We re-test all {modelCount} models around the clock and send each request to the one that tests best for it.</>}
        </p>
        <div className="lp-rb-cols" aria-hidden="true"><span>Your request</span><span>Routed to</span></div>
        <ul className="lp-rb-rows">
          {rows.map((r, i) => (
            <li key={r.key} className="lp-rb-row" style={{ '--i': i } as CSSProperties}>
              <span className="lp-rb-job">{r.job}</span>
              <span className="lp-rb-wire" aria-hidden="true"><i /></span>
              <span className="lp-rb-to">
                <span className="lp-lgc"><img src={logoFor(r.provider)} alt="" width={18} height={18} /></span>
                <span className="lp-rb-nm">
                  <Link href={`/models/${slugifyModelName(r.model)}`}>{r.displayName}</Link>
                  <small>{r.why}</small>
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="lp-rb-foot">
          If a model slips or goes down, the next takes over. <b>One endpoint, your own keys, 0% markup.</b>
        </p>
      </div>
    </figure>
  );
}
