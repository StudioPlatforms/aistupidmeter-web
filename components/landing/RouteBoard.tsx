import type { CSSProperties } from 'react';
import Link from 'next/link';
import { slugifyModelName } from '@/lib/model-slug';
import { scoringOf } from '@/lib/router-scoring';
import NextRun from './NextRun';
import { logoFor } from './price-format';
import type { LandingExplain, LandingSnapshot, LandingStrategy } from './types';

/**
 * The hero's explanation of the product, by analogy and by example: "Like GPS, for AI models", then
 * five everyday requests and the model the Smart Router sends each one to right now, with the
 * measured reason. It replaced a two-model cost comparison that first-time visitors could read as
 * a naive duel between a flagship and a small model; this shows what the product does instead.
 *
 * Every row is a real decision from GET /dashboard/landing (the production routing pipeline run
 * for a caller with keys for every provider), so nothing here names a model in code. The reason is
 * built from the pick's own row and the router's structured explanation (primary.explain: the pick's
 * place, the tie for first and the tie-break that settled it). A snapshot without those fields comes
 * from an API that does not send them yet; the reason is then read from the router's explanation
 * text (primary.reasoning), as before.
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

/** 2 → "2nd", 3 → "3rd", 11 → "11th", 21 → "21st". */
function ordinal(n: number): string {
  const tens = n % 100;
  const ones = n % 10;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ones === 1 ? 'st' : ones === 2 ? 'nd' : ones === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

/**
 * A quality pick's place on its board, from the snapshot's structured fields; never from the text.
 * "First" only for a pick in first place, "lowest cost" only for the pick a "cheaper" tie-break chose.
 * A pick is tied for first when the tie for first has other members and the pick's place is within
 * it. A kept pick (a remembered earlier pick; the landing has no caller memory, so never there) was
 * placed by that memory rather than by its score, so its label says only that.
 *
 * `narrow`: the router's tie band is narrow (D26; the snapshot's `scoring`). The tie-break then chooses only
 * among the models within one standard error of the leader, and `tie.size` counts only those. Every one of
 * them is statistically tied with the leader, so "Tied for first" stays true; but a cheaper model tied
 * beyond one standard error can exist, so "lowest cost" is not said. With one member (the leader alone
 * within one standard error) the pick is the leader, first on the board, whose rank the models tied with
 * it share: "First" stays true, the tie it may still have is not shown.
 */
function placeOnBoard(board: string, x: LandingExplain, narrow: boolean): string {
  if (x.kept) return 'Kept from earlier requests';
  const tie = x.tie && x.tie.size > 1 && x.rank <= x.tie.size ? x.tie : null;
  if (tie) return `Tied for first on ${board}${tie.by === 'cheaper' && x.rank === 1 && !narrow ? ' · lowest cost' : ''}`;
  if (x.rank === 1) return `First on ${board} right now`;
  return `Ranked ${ordinal(x.rank)} on ${board} right now`;
}

/**
 * The fields are used only when they are whole (a place from 1 up; no tie, or one with a whole
 * size); otherwise the text is read, as for an API that does not send them.
 */
function usableExplain(x: LandingExplain | undefined): LandingExplain | null {
  if (!x || !Number.isInteger(x.rank) || x.rank < 1) return null;
  if (x.tie !== null && (typeof x.tie !== 'object' || !Number.isInteger(x.tie.size))) return null;
  return x;
}

/**
 * Why the router picked this model, in a few plain words.
 * Quality modes: models whose scores are statistically tied for first share the top tier, and the
 * default tie-break takes the cheapest of them (with the narrow band, of those within one standard
 * error of the leader). The snapshot says so in primary.explain; from an API that does not send it,
 * the router's own explanation text says so instead, and with the narrow band its tie sentence begins
 * "Within one standard error of the leader, together with".
 */
function whyOf(job: Job, s: LandingStrategy, narrow: boolean): string | null {
  const row = s.rows.find(r => r.role === 'primary');
  if (!row) return null;
  if (job.board) {
    const x = usableExplain(s.primary.explain);
    if (x) return placeOnBoard(job.board, x, narrow);
    const said = s.primary.reasoning || '';
    // Only a narrow-band reason has this sentence, so it counts whatever `scoring` said.
    const narrowSaid = /Within one standard error of the leader, together with/.test(said);
    if (!/Statistically tied/i.test(said) && !narrowSaid) return `First on ${job.board} right now`;
    return `Tied for first on ${job.board}${!narrow && !narrowSaid && /chosen as the cheapest/i.test(said) ? ' · lowest cost' : ''}`;
  }
  if (job.key === 'fastest') {
    return row.metric != null ? `≈${(row.metric / 1000).toFixed(1)} s to answer · fastest we measure` : 'Fastest we measure';
  }
  return row.metric != null ? `$${row.metric.toFixed(2)} per 1M tokens · lowest list price` : 'Lowest list price';
}

/** The board's rows from a live snapshot; requests the router could not answer are left out. */
export function routeRows(snapshot: LandingSnapshot | null): RouteRow[] {
  if (!snapshot) return [];
  // The router's tie band from the snapshot (API A1); without it, today's wide band.
  const narrow = scoringOf(snapshot.scoring).tieBand === 'narrow';
  return JOBS.flatMap((job): RouteRow[] => {
    const s = snapshot.strategies[job.key];
    if (!s?.primary?.model) return [];
    const why = whyOf(job, s, narrow);
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
