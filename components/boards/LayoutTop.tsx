'use client';

import Link from 'next/link';
import { useRef } from 'react';
import {
  BOARD_KEYS, BOARD_TITLE, BOARD_TO_SORT, SORT_TO_BOARD, useElementWidth,
  type Board, type BoardKey, type BoardRow, type Boards, type SortKey,
} from '../../lib/use-boards';
import { CommunityIcon, Logo, Note, Rank, Score, ScoreBar, Star, modelHref, trendGlyph, useFlip } from './BoardBits';

/**
 * Layout "Top 5": the first five of every board at a glance, the community-funded models in
 * a strip of their own (with the way to fund them), and one full board underneath with a tab
 * per board. The full board's tab is the dashboard sort, shared with the rest of the page.
 * Rows slide to their new places when the period or the full board's tab changes.
 */

export default function LayoutTop({ boards, sortKey, onSortChange }: {
  boards: Boards; sortKey: SortKey; onSortChange: (k: SortKey) => void;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const fullRef = useRef<HTMLElement | null>(null);
  const grid = width >= 900;
  const full: BoardKey = sortKey === 'price' ? 'combined' : SORT_TO_BOARD[sortKey];
  const flip = useFlip<HTMLDivElement>([boards, full, width > 0, grid], grid ? 'grid' : 'narrow');

  const seeAll = (k: BoardKey) => {
    onSortChange(BOARD_TO_SORT[k]);
    fullRef.current?.scrollIntoView({ block: 'start' });
  };

  const community = boards.combined.community;
  const find = (k: BoardKey, id: string): { row: BoardRow; ranked: boolean } | null => {
    const r = boards[k].ranked.find((x) => x.id === id);
    if (r) return { row: r, ranked: true };
    const c = [...boards[k].community, ...boards[k].other].find((x) => x.id === id);
    return c ? { row: c, ranked: false } : null;
  };

  return (
    <div ref={ref} className={`sl-topwrap${grid ? '' : ' is-narrow'}`}>
      {width === 0 ? null : (
        <div ref={flip} className="sl-top">
          <div className={grid ? 'sl-top-grid' : 'sl-hscroll'}>
            {BOARD_KEYS.map((k) => <TopCard key={k} board={boards[k]} onSeeAll={() => seeAll(k)} />)}
          </div>

          {community.length > 0 && (
            <section className="sl-strip" aria-label="Community-funded models">
              <div className="sl-strip-head">
                <div className="sl-comm-head"><CommunityIcon size={16} /><h3>Community-funded models</h3></div>
                <p className="sl-comm-text">We still test these on coding every 4 hours. Reasoning and tool use are funded by the community, so those scores are from the last funded run.</p>
              </div>
              <div className={grid ? 'sl-strip-grid' : 'sl-hscroll'}>
                {community.map((m) => {
                  const cd = find('coding', m.id), rs = find('reasoning', m.id), tl = find('tooling', m.id);
                  return (
                    <div key={m.id} className="sl-scard">
                      <div className="sl-scard-name">
                        <Star row={m} />
                        <Logo provider={m.provider} />
                        <Link href={modelHref(m)} className="sl-name">{m.label}</Link>
                      </div>
                      <dl className="sl-kv">
                        <div><dt>Coding</dt><dd>{cd ? <><b>{cd.row.score}</b> <small>{cd.ranked ? `rank ${cd.row.rankText}` : cd.row.when}</small></> : '—'}</dd></div>
                        <div><dt>Reasoning</dt><dd className="is-muted">{rs ? <><b>{rs.row.score ?? '—'}</b> <small>{rs.ranked ? `rank ${rs.row.rankText}` : rs.row.when}</small></> : '—'}</dd></div>
                        <div><dt>Tool use</dt><dd className="is-muted">{tl ? <><b>{tl.row.score ?? '—'}</b> <small>{tl.ranked ? `rank ${tl.row.rankText}` : tl.row.when}</small></> : '—'}</dd></div>
                      </dl>
                      <Link href={modelHref(m, true)} className="st-btn is-sm is-block">Fund a run</Link>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="sl-board is-full" ref={fullRef} aria-label="Full leaderboard">
            <div className="sl-board-head">
              <div><h3>Full leaderboard</h3></div>
              <div className="st-seg sl-seg-tabs" role="tablist" aria-label="Board">
                {BOARD_KEYS.map((k) => (
                  <button key={k} type="button" role="tab" aria-selected={full === k} onClick={() => onSortChange(BOARD_TO_SORT[k])}>
                    {BOARD_TITLE[k]}
                  </button>
                ))}
              </div>
            </div>
            <ol className="sl-rows">
              {boards[full].ranked.map((row) => (
                <li key={row.id} data-flip={`full:${row.id}`} className="sl-row">
                  <Rank row={row} />
                  <span className="sl-model">
                    <Star row={row} />
                    <Logo provider={row.provider} size="md" />
                    <span className="sl-model-t"><Link href={modelHref(row)} className="sl-name sl-stretch">{row.label}</Link><span className="sl-vendor">{row.vendor}</span></span>
                    <Note row={row} />
                  </span>
                  <ScoreBar row={row} />
                  <Score row={row} />
                  <span className={`sl-trend is-${row.trend}`} aria-label={`trend ${row.trend}`}>{trendGlyph(row.trend)}</span>
                </li>
              ))}
              {boards[full].other.map((row) => (
                <li key={row.id} data-flip={`full:${row.id}`} className="sl-row is-muted">
                  <span className="sl-rank is-none">–</span>
                  <span className="sl-model">
                    <Star row={row} />
                    <Logo provider={row.provider} size="md" />
                    <span className="sl-model-t"><Link href={modelHref(row)} className="sl-name sl-stretch" title={row.staleReason || undefined}>{row.label}</Link><span className="sl-vendor">not ranked right now</span></span>
                  </span>
                  <span className="sl-sbar" aria-hidden="true" />
                  <Score row={row} muted />
                  <span />
                </li>
              ))}
            </ol>
            {boards[full].community.length > 0 && (
              <p className="sl-foot">The {boards[full].community.length} community-funded models are in their own section above.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function TopCard({ board, onSeeAll }: { board: Board; onSeeAll: () => void }) {
  const n = board.ranked.length;
  const lead = board.tiedForFirst > 1 ? `${board.tiedForFirst} tied for first` : 'one clear leader';
  return (
    <section className="sl-board" aria-label={`${board.title}: top five`}>
      <header className="sl-board-head">
        <div>
          <h3>{board.title}</h3>
          <p>{n} ranked · {lead}</p>
        </div>
      </header>
      <ol className="sl-rows">
        {board.ranked.slice(0, 5).map((row) => (
          <li key={row.id} data-flip={`${board.key}:${row.id}`} className="sl-row is-tall">
            <Rank row={row} />
            <span className="sl-model">
              <Star row={row} />
              <Logo provider={row.provider} />
              <span className="sl-model-t"><Link href={modelHref(row)} className="sl-name sl-stretch">{row.label}</Link><span className="sl-vendor">{row.vendor}</span></span>
            </span>
            <ScoreBar row={row} />
            <Score row={row} />
          </li>
        ))}
      </ol>
      <div className="sl-board-foot">
        <button type="button" className="sl-link" onClick={onSeeAll}>See all {n}</button>
      </div>
    </section>
  );
}
