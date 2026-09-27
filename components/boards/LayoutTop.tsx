'use client';

import Link from 'next/link';
import { useRef } from 'react';
import {
  BOARD_KEYS, BOARD_TITLE, BOARD_TO_SORT, SORT_TO_BOARD, useElementWidth,
  type Board, type BoardKey, type BoardRow, type Boards, type SortKey,
} from '../../lib/use-boards';
import { CommunityIcon, Logo, Note, Rank, Score, modelHref, trendGlyph } from './BoardBits';

/**
 * Layout "Top 5": the first five of every board at a glance, the community-funded models in
 * a strip of their own (with the way to fund them), and one full board underneath with a tab
 * per board. The full board's tab is the dashboard sort, shared with the rest of the page.
 */

export default function LayoutTop({ boards, sortKey, onSortChange }: {
  boards: Boards; sortKey: SortKey; onSortChange: (k: SortKey) => void;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const fullRef = useRef<HTMLElement | null>(null);
  const grid = width >= 900;
  const full: BoardKey = sortKey === 'price' ? 'combined' : SORT_TO_BOARD[sortKey];

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
    <div ref={ref} className={`lbx-top${grid ? '' : ' is-narrow'}`}>
      {width === 0 ? null : (
        <>
          <div className={grid ? 'lbx-top-grid' : 'lbx-hscroll'}>
            {BOARD_KEYS.map((k) => <TopCard key={k} board={boards[k]} onSeeAll={() => seeAll(k)} />)}
          </div>

          {community.length > 0 && (
            <section className="lbx-strip" aria-label="Community-funded models">
              <div className="lbx-strip-head">
                <div className="lbx-comm-head lbx-strip-title"><CommunityIcon size={16} /><h3>Community-funded models</h3></div>
                <p className="lbx-comm-text">We still test these on coding every 4 hours. Reasoning and tool use are funded by the community, so those scores are from the last funded run.</p>
              </div>
              <div className={grid ? 'lbx-strip-grid' : 'lbx-hscroll'}>
                {community.map((m) => {
                  const cd = find('coding', m.id), rs = find('reasoning', m.id), tl = find('tooling', m.id);
                  return (
                    <div key={m.id} className="lbx-scard">
                      <Link href={modelHref(m)} className="lbx-scard-name">
                        <Logo provider={m.provider} />
                        <span className="lbx-name">{m.label}</span>
                      </Link>
                      <dl className="lbx-scard-stats">
                        <div><dt>Coding</dt><dd>{cd ? <><b>{cd.row.score}</b> <small>{cd.ranked ? `rank ${cd.row.rankText}` : cd.row.when}</small></> : '—'}</dd></div>
                        <div><dt>Reasoning</dt><dd className="is-muted">{rs ? <><b>{rs.row.score ?? '—'}</b> <small>{rs.ranked ? `rank ${rs.row.rankText}` : rs.row.when}</small></> : '—'}</dd></div>
                        <div><dt>Tool use</dt><dd className="is-muted">{tl ? <><b>{tl.row.score ?? '—'}</b> <small>{tl.ranked ? `rank ${tl.row.rankText}` : tl.row.when}</small></> : '—'}</dd></div>
                      </dl>
                      <Link href={modelHref(m, true)} className="lbx-btn">Fund a run</Link>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="lbx-card lbx-full" ref={fullRef} aria-label="Full leaderboard">
            <div className="lbx-full-head">
              <h3>Full leaderboard</h3>
              <div className="lbx-seg" role="tablist" aria-label="Board">
                {BOARD_KEYS.map((k) => (
                  <button key={k} type="button" role="tab" aria-selected={full === k}
                          className={full === k ? 'is-active' : ''} onClick={() => onSortChange(BOARD_TO_SORT[k])}>
                    {BOARD_TITLE[k]}
                  </button>
                ))}
              </div>
            </div>
            <ol className="lbx-list lbx-full-list">
              {boards[full].ranked.map((row) => (
                <li key={row.id}>
                  <Link href={modelHref(row)} className="lbx-frow">
                    <Rank row={row} />
                    <span className="lbx-model">
                      <Logo provider={row.provider} size={18} box={30} />
                      <span className="lbx-model-text"><span className="lbx-name">{row.label}</span><span className="lbx-prov">{row.vendor}</span></span>
                      <Note row={row} />
                    </span>
                    <Score row={row} />
                    <span className={`lbx-trend lbx-trend--${row.trend}`} aria-label={`trend ${row.trend}`}>{trendGlyph(row.trend)}</span>
                  </Link>
                </li>
              ))}
              {boards[full].other.map((row) => (
                <li key={row.id}>
                  <Link href={modelHref(row)} className="lbx-frow is-muted" title={row.staleReason || undefined}>
                    <span className="lbx-rank lbx-rank--none">–</span>
                    <span className="lbx-model">
                      <Logo provider={row.provider} size={18} box={30} />
                      <span className="lbx-model-text"><span className="lbx-name">{row.label}</span><span className="lbx-prov">not ranked right now</span></span>
                    </span>
                    <Score row={row} muted />
                    <span />
                  </Link>
                </li>
              ))}
            </ol>
            {boards[full].community.length > 0 && (
              <p className="lbx-foot">The {boards[full].community.length} community-funded models are in their own section above.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function TopCard({ board, onSeeAll }: { board: Board; onSeeAll: () => void }) {
  const n = board.ranked.length;
  const lead = board.tiedForFirst > 1 ? `${board.tiedForFirst} tied for first` : 'one clear leader';
  return (
    <section className="lbx-card lbx-topcard" aria-label={`${board.title}: top five`}>
      <header className="lbx-card-head">
        <h3>{board.title}</h3>
        <p>{n} ranked · {lead}</p>
      </header>
      <ol className="lbx-list">
        {board.ranked.slice(0, 5).map((row) => (
          <li key={row.id}>
            <Link href={modelHref(row)} className="lbx-row lbx-row--tall">
              <Rank row={row} />
              <span className="lbx-model">
                <Logo provider={row.provider} />
                <span className="lbx-model-text"><span className="lbx-name">{row.label}</span><span className="lbx-prov">{row.vendor}</span></span>
              </span>
              <Score row={row} />
            </Link>
          </li>
        ))}
      </ol>
      <div className="lbx-card-foot">
        <button type="button" className="lbx-link" onClick={onSeeAll}>See all {n}</button>
      </div>
    </section>
  );
}
