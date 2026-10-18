'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  BOARD_KEYS, BOARD_TO_SORT, SORT_TO_BOARD,
  type BoardKey, type BoardRow, type Boards, type SortKey,
} from '../../lib/use-boards';
import { Logo, Star, modelHref } from './BoardBits';

/**
 * Layout "Simple" (replaced "Top 5" on 2026-10-18): one board at a time, in plain words, for
 * readers who found the four-column boards hard to follow ("I don't understand how to read the
 * new version", contact message #10). One row per model: its place, its score out of 100 with a
 * bar, a word for how good that is and a word for which way it is moving. The tab is the
 * dashboard sort, shared with the rest of the page.
 */

const TAB: Record<BoardKey, { label: string; about: string }> = {
  combined: { label: 'Overall', about: 'Coding counts for half, reasoning and tool use for a quarter each.' },
  coding: { label: 'Coding', about: 'Fixing real bugs in real code. Re-tested every 4 hours.' },
  reasoning: { label: 'Reasoning', about: 'Long, multi-step problem solving. Tested daily.' },
  tooling: { label: 'Using tools', about: 'Agent tasks with real tools in a sandbox. Tested daily.' },
};

const FIRST = 10;

function verdict(score: number): { word: string; tone: 'top' | 'good' | 'fair' | 'weak' } {
  if (score >= 90) return { word: 'Excellent', tone: 'top' };
  if (score >= 80) return { word: 'Good', tone: 'good' };
  if (score >= 65) return { word: 'Fair', tone: 'fair' };
  return { word: 'Weak', tone: 'weak' };
}

const TREND: Record<string, string> = { up: 'Getting better', down: 'Getting worse' };

export default function LayoutSimple({ boards, sortKey, onSortChange }: {
  boards: Boards; sortKey: SortKey; onSortChange: (k: SortKey) => void;
}) {
  const key: BoardKey = sortKey === 'price' ? 'combined' : SORT_TO_BOARD[sortKey];
  const [all, setAll] = useState(false);
  const board = boards[key];
  const rows = all ? board.ranked : board.ranked.slice(0, FIRST);
  const unranked = [...board.community, ...board.other];

  return (
    <div className="sl-simple">
      <div className="sl-simple-head">
        <p className="sl-simple-lead">
          Every model takes the same tests. Scores are out of 100, and higher is better.
        </p>
        <div className="st-seg is-scroll sl-seg-tabs" role="tablist" aria-label="Board">
          {BOARD_KEYS.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={key === k} onClick={() => onSortChange(BOARD_TO_SORT[k])}>
              {TAB[k].label}
            </button>
          ))}
        </div>
      </div>
      <p className="sl-simple-about">{TAB[key].about}</p>

      <ol className="sl-simple-list">
        {rows.map((row) => <SimpleRow key={row.id} row={row} />)}
      </ol>

      {board.ranked.length > FIRST && (
        <button type="button" className="st-btn sl-simple-more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? `Show the top ${FIRST}` : `Show all ${board.ranked.length} models`}
        </button>
      )}

      {all && unranked.length > 0 && (
        <section className="sl-simple-unranked" aria-label="Not ranked on this board">
          <h3>Not ranked on this board</h3>
          <p>We have fewer results for these right now, so they are shown without a place.</p>
          <ul>
            {unranked.map((row) => (
              <li key={row.id}>
                <Logo provider={row.provider} />
                <Link href={modelHref(row)} className="sl-name">{row.label}</Link>
                <span className="sl-simple-when">{row.score ?? '—'}{row.when ? ` · ${row.when}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SimpleRow({ row }: { row: BoardRow }) {
  const score = row.score ?? 0;
  const v = verdict(score);
  const trend = TREND[row.trend] ?? 'Steady';
  const tied = row.rankText.startsWith('=');
  return (
    <li className={`sl-simple-row${row.rank === 1 ? ' is-first' : ''}`}>
      <span className="sl-simple-rank" title={tied ? 'Joint place: too close to call apart' : undefined}>{row.rank}</span>
      <span className="sl-simple-model">
        <Star row={row} size={15} />
        <Logo provider={row.provider} size="md" />
        <span className="sl-simple-name">
          <Link href={modelHref(row)} className="sl-name sl-stretch">{row.label}</Link>
          <span className="sl-vendor">{row.vendor}{row.note ? ` · ${row.note}` : ''}</span>
        </span>
      </span>
      <span className="sl-simple-score" aria-label={`score ${row.score ?? 'none'} out of 100`}>
        <b>{row.score ?? '—'}</b><small>/100</small>
      </span>
      <span className="sl-simple-bar" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /></span>
      <span className="sl-simple-tags">
        <span className={`sl-simple-verdict is-${v.tone}`}>{v.word}</span>
        <span className={`sl-simple-trend is-${row.trend === 'up' ? 'up' : row.trend === 'down' ? 'down' : 'flat'}`}>{trend}</span>
      </span>
    </li>
  );
}
