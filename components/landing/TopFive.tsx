'use client';

import { useState, type CSSProperties } from 'react';
import type { TopFive as TopFiveData } from './data';
import { dayRange, logoFor, pct } from './price-format';

const BOARDS = { coding: 'Coding', reasoning: 'Reasoning', tooling: 'Tool use' } as const;

/**
 * The top five on each board, bars on one 0–100 scale. Live mode is the 24-hour leaderboard; measured
 * mode is the newest window of real test runs, dated (see getTopFive). The full board stays behind a
 * free account, and the newest-run view behind a paid plan, and the strip says so.
 */
export default function TopFive({ data, signInHref }: { data: TopFiveData; signInHref: string }) {
  const [key, setKey] = useState(data.boards[0]?.key ?? 'coding');
  const board = data.boards.find(b => b.key === key) ?? data.boards[0];
  if (!board) return null;
  // Pass rates are 0–1, composite scores are 0–100 — tell them apart by value so the leaderboard
  // boards (scores, matching the dashboard) and the price-snapshot fallback (coding as a pass rate)
  // both render correctly without a separate flag.
  const isRate = board.rows.length > 0 && board.rows.every(r => r.value <= 1);
  const codingBoard = data.boards.find(b => b.key === 'coding');
  const codingIsRate = !!codingBoard && codingBoard.rows.length > 0 && codingBoard.rows.every(r => r.value <= 1);
  const shown = (v: number) => (isRate ? pct(v) : String(Math.round(v)));
  const width = (v: number) => Math.max(isRate ? v : v / 100, 0.004);
  const days = data.windowDays ?? 30;
  const when = data.mode === 'live24h'
    ? 'Last 24 hours'
    : data.rolling
      ? `Last ${days} days`
      : `Last measured ${data.from && data.to ? dayRange(data.from, data.to) : ''}`.trim();
  const unit = isRate ? 'Passed' : 'Score';

  return (
    <div className="lp-top5">
      <div className="lp-top5-head">
        <p className="lp-top5-when"><b>Top 5</b> · {when}</p>
        <div className="lp-pr-tabs lp-top5-tabs" role="tablist" aria-label="Leaderboard">
          {data.boards.map(b => (
            <button key={b.key} type="button" role="tab" aria-selected={b.key === board.key} aria-controls="lp-top5-panel" onClick={() => setKey(b.key)}>
              {BOARDS[b.key]}
            </button>
          ))}
        </div>
      </div>
      <ol className="lp-top5-rows" id="lp-top5-panel" role="tabpanel" aria-label={`${BOARDS[board.key]} top 5`}>
        {board.rows.map((r, i) => (
          <li key={r.name} className="lp-top5-row" style={{ '--w': width(r.value), '--i': i } as CSSProperties}>
            <span className="lp-top5-n">{i + 1}</span>
            <span className="lp-lgc"><img src={logoFor(r.vendor)} alt="" width={18} height={18} loading="lazy" /></span>
            <span className="lp-top5-nm">{r.displayName}</span>
            <span className="lp-pr-bar" aria-hidden="true"><i /></span>
            <span className="lp-top5-v"><small>{unit}</small> {shown(r.value)}</span>
          </li>
        ))}
      </ol>
      <p className="lp-top5-note">
        {data.mode === 'live24h'
          ? 'Scores from the last 24 hours of tests, the same tasks for every model.'
          : codingIsRate
            ? `From the last ${days} days of test runs, the same tasks for every model. Coding counts fixes whose hidden tests passed; reasoning and tool use are scored out of 100.`
            : `Scores over the last ${days} days, the same tasks for every model, each out of 100.`}
      </p>
      <div className="lp-top5-go">
        <a className="lp-btn lp-btn-primary" href={signInHref}>Sign in for the full leaderboard <span className="lp-ar">→</span></a>
        <a className="lp-btn lp-btn-ghost" href="/pricing">Subscribe for the newest run’s scores</a>
      </div>
    </div>
  );
}
