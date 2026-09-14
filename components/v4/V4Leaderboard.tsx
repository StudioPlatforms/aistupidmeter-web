'use client';

import { isVolatile, VOLATILE_STANDARD_ERROR } from '../../lib/fleet-buckets';

import { useRouter } from 'next/navigation';
import WatchStar from '../WatchStar';
import ProviderLogo from '../ProviderLogo';
import { slugifyModelName } from '../../lib/model-slug';
import { getModelPricing } from '../../lib/model-pricing';

const PROVIDER_KEYS = ['openai', 'anthropic', 'xai', 'google', 'glm', 'deepseek', 'kimi'] as const;
type ProviderKey = typeof PROVIDER_KEYS[number];

const normalizeProvider = (provider: string): ProviderKey => {
  const p = (provider || '').toLowerCase().replace('x.ai', 'xai');
  return (PROVIDER_KEYS.includes(p as ProviderKey) ? p : 'openai') as ProviderKey;
};

const providerColor: Record<ProviderKey, string> = {
  openai: '#10a37f', anthropic: '#d97757', xai: '#111111',
  google: '#4285f4', glm: '#e91e63', deepseek: '#4d6bfe', kimi: '#ff6b35',
};

interface V4LeaderboardProps {
  modelScores: any[];
  modelHistoryData: Map<string, any[]>;
  isLoading: boolean;
  showBatchRefreshing: boolean;
  leaderboardSortBy: string;
  leaderboardPeriod: string;
  driftIncidents: any[];
}

const scoreColor = (score: number) =>
  score >= 70 ? 'var(--good)' : score >= 50 ? 'var(--warn)' : 'var(--bad)';

const trendIcon = (trend: string) =>
  trend === 'up' ? '▲' : trend === 'down' ? '▼' : '→';

const trendColor = (trend: string) =>
  trend === 'up' ? 'var(--good)' : trend === 'down' ? 'var(--bad)' : 'var(--phosphor-dim)';

/**
 * This is a SCORE BAND, not a drift regime, and the column header says so now.
 *
 * It reads `model.status`, a pure threshold on the score (getStatus in
 * lib/model-scoring: <40 critical, <65 warning, <80 good, else excellent). It was
 * labelled STBL/VOLA/DEGR under a "REGIME" heading, so claude-opus-5 showed as "VOLA"
 * — a claim about variance — purely because it scored 64. That also contradicted the
 * panel directly above it, which read "VOLATILE 0, all clear" from a different ad-hoc
 * rule (trend === 'down' && score >= 50).
 *
 * The real classification (STABLE / VOLATILE / DEGRADED / RECOVERING) comes from
 * lib/drift-detection and is served by /api/drift/batch, which this component does not
 * fetch. Showing that here would be better than a score band; until it does, the column
 * must not claim to be something it is not.
 */
const bandMap: Record<string, { label: string; cls: string }> = {
  excellent: { label: 'HIGH', cls: 'regime-st' },
  good: { label: 'GOOD', cls: 'regime-st' },
  warning: { label: 'FAIR', cls: 'regime-vo' },
  critical: { label: 'LOW', cls: 'regime-de' },
  unavailable: { label: '—', cls: '' },
};

const providerDotClass = (provider: string): string => {
  const map: Record<string, string> = {
    openai: 'openai', anthropic: 'anthropic', google: 'google',
    xai: 'xai', deepseek: 'deepseek', glm: 'glm', kimi: 'kimi',
  };
  return map[provider?.toLowerCase()] || 'openai';
};

// Formats the shared pricing table (lib/model-pricing.ts) for the $/1M column.
// This used to be a sixth independent copy of the price list and was the one
// actually rendered on ?sortBy=price, so it is what users saw: Fable 5 fell
// through to $3/$15, every GPT-5.x to $1.25/$10, and Gemini 3.1 Flash Lite
// matched the 2.5-era 'flash-lite' rule at $0.1/$0.4.
const fmt = (n: number): string => `$${Number(n.toFixed(4))}`;
const getModelPricingLabel = (name: string, provider: string): string => {
  const p = getModelPricing(name, provider);
  return `${fmt(p.input)}/${fmt(p.output)}`;
};

function formatTimeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Guard against invalid/epoch dates (e.g. null timestamps producing 1970 dates)
  const MIN_VALID_DATE = new Date('2024-01-01').getTime();
  if (isNaN(d.getTime()) || d.getTime() < MIN_VALID_DATE) {
    return '—'; // Show dash instead of "20581d" for invalid dates
  }
  
  const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutes < 0) return 'now'; // Future dates (clock skew)
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days > 365) return '—'; // Clearly invalid if > 1 year ago
  return `${days}d`;
}

// Tooltip for the Updated cell: the age of every contributing suite, the reasoning task
// and any staleness note. The cell itself shows only when the score last changed.
const SUITE_LABEL: Record<string, string> = { hourly: 'coding', deep: 'reasoning', tooling: 'tools' };
function updatedTitle(model: any): string | undefined {
  const at: Record<string, string> | undefined = model.suiteUpdatedAt;
  const parts = at
    ? ['hourly', 'deep', 'tooling'].filter(s => at[s]).map(s =>
        `${SUITE_LABEL[s]} ${formatTimeAgo(at[s])}${s === 'deep' && model.taskSlug ? ` (${model.taskSlug})` : ''}`)
    : [];
  if (model.staleReason) parts.push(model.staleReason);
  return parts.length ? parts.join(' · ') : undefined;
}

/**
 * "2 of 3 suites (no deep); deep ran doc_memory, ..." -> "2/3", with the full sentence left
 * to the tooltip. The previous `.replace(/ suites.*$/, '/3')` produced "2 of 3/3".
 */
function shortCoverage(note: string): string {
  // Two different kinds of partial live in this string and they must not read the same.
  // "2 of 3 suites" means a whole suite is missing; "5 of 7 coding tasks" means the model's
  // provider declined some tasks, so it was scored on a narrower corpus than its rivals.
  // Rendering both as a bare "5/7" would let the second pass for the first.
  const suites = /^(\d+) of (\d+) suites/.exec(note);
  if (suites) {
    const tasks = /(\d+) of (\d+) coding tasks/.exec(note);
    return tasks ? `${suites[1]}/${suites[2]} · ${tasks[1]}/${tasks[2]} tasks` : `${suites[1]}/${suites[2]}`;
  }
  const tasks = /^(\d+) of (\d+) coding tasks/.exec(note);
  if (tasks) return `${tasks[1]}/${tasks[2]} tasks`;
  const m = /^(\d+) of (\d+)/.exec(note);
  return m ? `${m[1]}/${m[2]}` : note;
}

function MiniSparkline({ history, modelId, modelHistoryData }: { history: any[]; modelId: string; modelHistoryData: Map<string, any[]> }) {
  const data = modelHistoryData.get(modelId) || history || [];
  if (!data || data.length === 0) return <span style={{ color: 'var(--phosphor-dim)', fontSize: '9px' }}>—</span>;

  const scores = data.slice(0, 7).reverse().map((d: any) => {
    if (typeof d.score === 'number') return d.score;
    if (typeof d.stupidScore === 'number' && d.stupidScore >= 0 && d.stupidScore <= 100) return d.stupidScore;
    return null;
  }).filter((v: any): v is number => v !== null);

  if (scores.length < 2) return <span style={{ color: 'var(--phosphor-dim)', fontSize: '11px' }}>—</span>;

  const w = 76, h = 24, pad = 3;
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const range = max - min || 1;
  const pts = scores.map((v, i) => {
    const x = pad + (i / (scores.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((v - min) / range) * (h - 2 * pad);
    return [x, y] as const;
  });
  const line = pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${pad},${h - pad} ${line} ${(w - pad)},${h - pad}`;
  const delta = scores[scores.length - 1] - scores[0];
  const color = delta > 1 ? 'var(--good)' : delta < -1 ? 'var(--bad)' : 'var(--accent)';
  const last = pts[pts.length - 1];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      <polygon points={area} fill={color} opacity={0.10} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2} fill={color} />
    </svg>
  );
}

export default function V4Leaderboard({
  modelScores,
  modelHistoryData,
  isLoading,
  showBatchRefreshing,
  leaderboardSortBy,
  leaderboardPeriod,
  driftIncidents,
}: V4LeaderboardProps) {
  const router = useRouter();

  const available = modelScores.filter(m => m.currentScore !== 'unavailable');
  const unavailable = modelScores.filter(m => m.currentScore === 'unavailable');
  const sorted = [...available, ...unavailable];

  // RANK FOLLOWS THE BOARD. Walk the rows in displayed order and give standard competition
  // numbering (1, 1, 1, 4, 4, 6 …): a row joins the group above it when it is not measurably
  // worse than that group's LEADER — the highest-scoring member — and otherwise opens a new
  // group at its own position.
  //
  // The first version computed each row's rank independently as "1 + models measurably better
  // than me". That is defensible in isolation and unreadable on a board, because the threshold
  // depends on BOTH models' standard errors: a noisy model has fewer models that beat it
  // decisively, so it earned a smaller rank number while sitting lower down. Users saw rank 14
  // printed above rank 10, and three models on 82 ranked 2, =4 and =4. Comparing against the
  // group leader rather than pairwise also stops a chain of individually-indistinguishable
  // rows from merging into one group whose ends are far apart.
  //
  // Only score-ordered views get statistical ties. Sorting by price orders the board by price,
  // so there the rank is simply the position.
  const SCORE_ORDERED = new Set(['combined', 'reasoning', 'tooling', 'speed', '7axis', 'coding']);
  const statisticalTies = SCORE_ORDERED.has(leaderboardSortBy);
  const hasSE = (m: any) => m.rankable !== false && typeof m.standardError === 'number' && typeof m.currentScore === 'number';
  const measurablyBetter = (o: any, m: any) =>
    o.currentScore - m.currentScore > 1.96 * Math.sqrt(o.standardError * o.standardError + m.standardError * m.standardError);
  // A row graded on fewer tasks than the rest (a provider declined some) is not the same
  // measurement as its neighbours, so it neither joins a tie group nor anchors one. It keeps
  // its position on the board and shows the coverage badge under its score, which is the
  // honest statement: here is where it sorts, and here is why it is not called "tied". Same
  // condition the badge itself uses, so the two can never disagree.
  const partialRow = (m: any) => !!m.coverage && leaderboardSortBy !== 'reasoning';
  const statRank = new Map<string, number>();
  {
    let leader: any = null;
    let leaderRank = 1;
    let position = 0;
    for (const m of sorted) {
      if (!hasSE(m)) continue;
      position++;
      if (!statisticalTies) { statRank.set(String(m.id), position); continue; }
      if (partialRow(m)) { statRank.set(String(m.id), position); continue; }
      if (leader === null || measurablyBetter(leader, m)) { leader = m; leaderRank = position; }
      statRank.set(String(m.id), leaderRank);
    }
  }
  // How many statistical groups the board resolves into. When it is very few, the reason is
  // that the standard errors are wide — worth saying, rather than leaving it to look coarse.
  const rankGroups = new Set(Array.from(statRank.values())).size;
  const rankedCount = statRank.size;

  const tiedCount = (rank: number) => Array.from(statRank.values()).filter(r => r === rank).length - 1;

  // One legend, rendered in two places and shown in exactly one: above the rows on a wide
  // screen, below them on a phone. On a phone the board is the reason you came — pushing the
  // first row down by four lines of explanation is the wrong trade — but the explanation still
  // has to be somewhere you will meet it, so it sits at the end of the list instead of behind
  // a hover you cannot perform. The hidden copy is `display: none`, so it is not announced twice.
  const rankLegend = statisticalTies && rankedCount > 0 ? (
    <>
      <strong>=</strong> marks a statistical tie: those models are not separated by more than their
      measurement noise, so they share a rank. A rank without <strong>=</strong> is a model on its own.
      Ranks count position on the board, so the group after fourteen tied models starts at 15.
      A model whose provider declined some tasks shows its coverage under the score and is never
      called tied: a score over seven tasks and one over nine are not the same measurement.
      {rankGroups <= 3 && rankedCount >= 8 && (
        <> Only {rankGroups} groups resolve today because every suite is early in a new benchmark
        configuration and the error bars are still at their default width; they narrow as runs accumulate.</>
      )}
    </>
  ) : null;

  return (
    <div style={{ position: 'relative' }}>
      {/*
        Loading treatment.

        This was an absolutely-positioned rgba(0,0,0,.85) panel with a spinning
        ⚡, "UPDATING RANKINGS" in caps, and a .vintage-loading bar — all
        terminal-theme leftovers sitting on a light UI. Worse, it sized itself
        to a container that collapsed to just the header row while the rows
        were cleared, so it rendered as a black stripe with its own text
        overflowing above it.

        Now: the rows stay mounted and simply dim, and a thin indeterminate bar
        rides the top edge of the table. Nothing is covered, nothing collapses,
        and there is no dark panel on a light page.
      */}
      {isLoading && <div className="v4-lb-loading-bar" role="progressbar" aria-label="Updating rankings" />}

      {/* Table Header */}
      <div className={`v4-lb-header${isLoading ? ' v4-lb-dimmed' : ''}`}>
        <div style={{ textAlign: 'center' }} title={statisticalTies
          ? 'Rank follows the board. A model shares the rank above it when its score is not measurably lower — a gap smaller than 1.96 × the combined standard error of the pair (95%). Equal ranks marked = are statistical ties, and the next rank resumes at the row number, so 1,1,1,4 is expected. Wide tie groups mean the measurement is not yet precise enough to separate those models.'
          : 'Position in the current sort.'}>RK</div>
        <div style={{ textAlign: 'left', paddingLeft: '10px' }}>MODEL</div>
        {/* A period view is the measured average over the window, and the header says so. */}
        <div style={{ textAlign: 'center' }}>{leaderboardPeriod === 'latest' ? 'SCORE' : `AVG ${({ '24h': '24H', '7d': '7D', '1m': '30D' } as Record<string, string>)[leaderboardPeriod] || leaderboardPeriod.toUpperCase()}`}</div>
        <div style={{ textAlign: 'center' }}>TRND</div>
        <div style={{ textAlign: 'center' }} className="v4-col-regime">BAND</div>
        <div className="v4-col-upd">UPDATED</div>
        <div style={{ textAlign: 'center' }} className="v4-col-price">$/1M</div>
        <div style={{ textAlign: 'center' }} className="v4-col-tools">TOOLS</div>
        <div style={{ textAlign: 'center' }} className="v4-col-spark">7-DAY</div>
      </div>

      {rankLegend && <div className="v4-lb-rank-legend v4-lb-rank-legend--top">{rankLegend}</div>}

      {/* Table Rows */}
      {sorted.map((model, index) => {
        const rank = statRank.get(String(model.id)) ?? index + 1;
        const tied = statRank.has(String(model.id)) ? tiedCount(rank) : 0;
        const score = typeof model.currentScore === 'number' ? model.currentScore : null;
        const isUnavailable = score === null;
        const isHighlight = model.status === 'critical' || model.trend === 'down';
        const band = bandMap[model.status] || bandMap.good;

        // SEO-friendly slug for crawlable model links (falls back to id).
        const modelHref = `/models/${slugifyModelName(model.name) || model.id}`;

        // Check for reasoning badge
        const usesReasoning = model.usesReasoningEffort;

        // Check for incidents
        const hasIncident = driftIncidents.some((inc: any) =>
          inc.modelName?.toLowerCase() === model.name.toLowerCase() ||
          inc.modelId === parseInt(model.id)
        );

        // HONEST ABSENCE. A row can now carry a score that is real but incomplete (a suite
        // was skipped and the rest were reweighted), stale, or too old to rank. Each of
        // those states is shown in words next to the number rather than hidden inside it.
        const held = model.rankable === false;
        const coverageNote: string | null = model.coverage ?? null;
        const isReasoningView = leaderboardSortBy === 'reasoning';

        return (
          <div
            key={model.id}
            className={`v4-lb-row ${isHighlight ? 'highlight' : ''}${isLoading ? ' v4-lb-dimmed' : ''}${held ? ' v4-lb-held' : ''}`}
            onClick={() => router.push(modelHref)}
            title={model.staleReason || undefined}
          >
            {/* Rank — an expired score is shown but does not take a rank */}
            <div style={{ textAlign: 'center' }}>
              {held
                ? <span className="v4-lb-rank" style={{ color: 'var(--phosphor-dim)' }}>–</span>
                : <span className={`v4-lb-rank ${rank <= 3 ? 'top' : ''}${tied > 0 ? ' v4-lb-rank-tied' : ''}`}
                        title={tied > 0 ? `Statistical tie with ${tied} other model${tied === 1 ? '' : 's'} — the score differences inside this group are smaller than the measurement can resolve at 95% confidence. The scores themselves are still shown.` : undefined}>
                    {tied > 0 ? '=' : ''}{rank}
                  </span>}
            </div>

            {/* Model Name + Provider */}
            <div className="v4-lb-model">
              <WatchStar modelId={model.id} modelName={model.displayName || model.name} />
              <span className="v4-lb-logo">
                <ProviderLogo provider={normalizeProvider(model.provider)} size={18} />
              </span>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div className="v4-lb-model-name">
                  <a
                    href={modelHref}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(modelHref); }}
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: 'inherit', textDecoration: 'none' }}
                  >
                    {model.displayName || model.name}
                  </a>
                  <span className="v4-lb-model-badges">
                    {usesReasoning && <span className="v4-tag v4-tag-blue">RSN</span>}
                    {hasIncident && <span className="v4-tag v4-tag-red">ALERT</span>}
                    {model.isNew && <span className="v4-tag v4-tag-green">NEW</span>}
                  </span>
                </div>
                <div className="v4-lb-model-prov">{model.provider}</div>
              </div>
            </div>

            {/* Score, with what it is made of when that is less than everything */}
            <div style={{ textAlign: 'center' }}>
              {isUnavailable ? (
                <span style={{ color: 'var(--phosphor-dim)', fontSize: '12px' }}>N/A</span>
              ) : (
                <>
                  <span className="v4-lb-score" style={{ color: held ? 'var(--phosphor-dim)' : scoreColor(score!) }}>{score}</span>
                  {held && <div className="v4-cov v4-cov-held">not ranked</div>}
                  {!held && coverageNote && !isReasoningView && (
                    <div className="v4-cov v4-cov-partial" title={coverageNote}>{shortCoverage(coverageNote)}</div>
                  )}
                </>
              )}
            </div>

            {/* Trend, and whether that trend is worth believing.
                The summary bar above counts VOLATILE models; without a mark here a reader is
                told "3 are volatile" and has no way to find which three. A wide standard error
                also means the arrow beside it is mostly noise, which is worth knowing before
                acting on it. */}
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '14px', color: trendColor(model.trend) }}>
                {trendIcon(model.trend)}
              </span>
              {isVolatile(model) && (
                <span
                  className="v4-volatile-mark"
                  title={`High run-to-run variance: standard error ${Number(model.standardError).toFixed(1)} points, against a fleet median near 3. Counted under VOLATILE above; the trend arrow on this row is mostly noise.`}
                >
                  &plusmn;
                </span>
              )}
            </div>

            {/* Regime */}
            <div style={{ textAlign: 'center' }} className="v4-col-regime">
              {band.cls && (
                <span className={`regime-badge ${band.cls}`} title="Score band, not the drift regime \u2014 the regime classification is on the drift monitor.">{band.label}</span>
              )}
            </div>

            {/* Updated — when the score last changed, on one line. The age of every
                component, the reasoning task and any staleness note are in the tooltip,
                so a fresh coding run cannot hide a days-old deep component from anyone
                who looks, and the coverage badge under the score still says "2/3". */}
            <div className="v4-col-upd" style={{ fontSize: '10px', color: model.isStale ? 'var(--warn)' : 'var(--phosphor-dim)' }} title={updatedTitle(model)}>
              {formatTimeAgo(model.lastUpdated)}
            </div>

            {/* Price */}
            <div style={{ textAlign: 'center', fontSize: '10px' }} className="v4-col-price">
              <span style={{ color: 'var(--phosphor-dim)' }}>
                {getModelPricingLabel(model.name, model.provider)}
              </span>
            </div>

            {/* Tools */}
            <div style={{ textAlign: 'center', fontSize: '11px' }} className="v4-col-tools">
              <span style={{ color: 'var(--phosphor-dim)' }}>—</span>
            </div>

            {/* 7-Day Sparkline */}
            <div style={{ textAlign: 'center' }} className="v4-col-spark">
              <MiniSparkline
                history={model.history || []}
                modelId={model.id}
                modelHistoryData={modelHistoryData}
              />
            </div>
          </div>
        );
      })}

      {rankLegend && <div className="v4-lb-rank-legend v4-lb-rank-legend--bottom">{rankLegend}</div>}
    </div>
  );
}
