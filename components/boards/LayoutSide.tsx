'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { BOARD_KEYS, BOARD_CADENCE, useElementWidth, type Board, type Boards } from '../../lib/use-boards';
import { CommunityIcon, Logo, Note, Rank, Score, ScoreBar, Star, communityBlurb, modelHref, useFlip } from './BoardBits';

/**
 * Layout "Side by side": the four boards as four full lists next to each other. Below
 * ~900px of width they become swipeable cards with a tab per board, since four columns of
 * model names do not fit a phone. Rows slide to their new places when the period changes.
 */

export function BoardCard({ board, communityModels }: { board: Board; communityModels: number }) {
  const k = board.key;
  return (
    <section className="sl-board" aria-label={`${board.title} leaderboard`}>
      <header className="sl-board-head">
        <div>
          <h3>{board.title}</h3>
          <p>{BOARD_CADENCE[k]} · {board.ranked.length} ranked</p>
        </div>
      </header>
      <div className="sl-colhead" aria-hidden="true"><span>#</span><span>Model</span><span className="sl-colhead-bar" /><span>Score</span></div>
      <ol className="sl-rows">
        {board.ranked.map((row) => (
          <li key={row.id} data-flip={`${k}:${row.id}`} className="sl-row">
            <Rank row={row} />
            <span className="sl-model">
              <Star row={row} />
              <Logo provider={row.provider} />
              <Link href={modelHref(row)} className="sl-name sl-stretch">{row.label}</Link>
              <Note row={row} />
            </span>
            <ScoreBar row={row} />
            <Score row={row} />
          </li>
        ))}
      </ol>

      {k === 'coding' && communityModels > 0 && (
        <p className="sl-foot">The {communityModels} community-funded models are still tested by us on coding, so they rank here as normal.</p>
      )}

      {board.community.length > 0 && (
        <div className="sl-comm">
          <div className="sl-comm-head">
            <CommunityIcon />
            <span>Community-funded</span>
            <span className="sl-comm-count">{board.community.length} models</span>
          </div>
          <p className="sl-comm-text">{communityBlurb(k)}</p>
          <ul className="sl-crows">
            {board.community.map((row) => (
              <li key={row.id} data-flip={`${k}:c:${row.id}`} className="sl-crow">
                <Star row={row} size={13} />
                <Logo provider={row.provider} size="xs" />
                <Link href={modelHref(row, true)} className="sl-name sl-stretch" title={`Open ${row.label} to fund its next run`}>{row.label}</Link>
                {row.when && <span className="sl-date">{row.when}</span>}
                <Score row={row} muted />
              </li>
            ))}
          </ul>
          <p className="sl-comm-cta">Pick a model to fund its next run.</p>
        </div>
      )}

      {board.other.length > 0 && (
        <div className="sl-comm">
          <div className="sl-comm-head"><span>Not ranked right now</span></div>
          <ul className="sl-crows">
            {board.other.map((row) => (
              <li key={row.id} data-flip={`${k}:o:${row.id}`} className="sl-crow">
                <Star row={row} size={13} />
                <Logo provider={row.provider} size="xs" />
                <Link href={modelHref(row)} className="sl-name sl-stretch" title={row.staleReason || undefined}>{row.label}</Link>
                {row.when && <span className="sl-date">{row.when}</span>}
                <Score row={row} muted />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function LayoutSide({ boards }: { boards: Boards }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const communityModels = boards.combined.community.length;
  const grid = width >= 900;
  const flip = useFlip<HTMLDivElement>([boards, width > 0, grid], grid ? 'grid' : 'swipe');
  return (
    <div ref={ref} className="sl-side">
      {width === 0 ? null : grid ? (
        <div ref={flip} className="sl-side-grid">
          {BOARD_KEYS.map((k) => <BoardCard key={k} board={boards[k]} communityModels={communityModels} />)}
        </div>
      ) : (
        <div ref={flip}>
          <Swipe boards={boards} communityModels={communityModels} />
        </div>
      )}
    </div>
  );
}

function Swipe({ boards, communityModels }: { boards: Boards; communityModels: number }) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);

  const go = (i: number) => {
    const el = scroller.current, card = cards.current[i];
    if (!el || !card) return;
    // The track is position:relative, so offsetLeft is measured from its padding edge.
    el.scrollTo({ left: card.offsetLeft - 16 });
    setActive(i);
  };
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    let best = 0, bestDist = Infinity;
    cards.current.forEach((c, i) => {
      if (!c) return;
      const d = Math.abs(c.offsetLeft - 16 - el.scrollLeft);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    if (best !== active) setActive(best);
  };

  return (
    <div className="sl-swipe">
      <div className="sl-tabs" role="tablist" aria-label="Boards">
        {BOARD_KEYS.map((k, i) => (
          <button key={k} type="button" role="tab" aria-selected={active === i} onClick={() => go(i)}>
            {boards[k].title}
          </button>
        ))}
      </div>
      <div className="sl-swipe-track" ref={scroller} onScroll={onScroll}>
        {BOARD_KEYS.map((k, i) => (
          <div key={k} className="sl-swipe-item" ref={(el) => { cards.current[i] = el; }}>
            <BoardCard board={boards[k]} communityModels={communityModels} />
          </div>
        ))}
      </div>
      <div className="sl-dots" aria-hidden="true">
        {BOARD_KEYS.map((k, i) => <span key={k} className={active === i ? 'is-on' : ''} />)}
      </div>
    </div>
  );
}
