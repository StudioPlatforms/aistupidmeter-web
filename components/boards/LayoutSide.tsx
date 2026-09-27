'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { BOARD_KEYS, BOARD_CADENCE, useElementWidth, type Board, type Boards } from '../../lib/use-boards';
import { CommunityIcon, Logo, Note, Rank, Score, communityBlurb, modelHref } from './BoardBits';

/**
 * Layout "Side by side": the four boards as four full lists next to each other. Below
 * ~900px of width they become swipeable cards with a tab per board, since four columns of
 * model names do not fit a phone.
 */

export function BoardCard({ board, communityModels }: { board: Board; communityModels: number }) {
  const k = board.key;
  return (
    <section className="lbx-card" aria-label={`${board.title} leaderboard`}>
      <header className="lbx-card-head">
        <h3>{board.title}</h3>
        <p>{BOARD_CADENCE[k]} · {board.ranked.length} ranked</p>
      </header>
      <div className="lbx-colhead" aria-hidden="true"><span>#</span><span>Model</span><span>Score</span></div>
      <ol className="lbx-list">
        {board.ranked.map((row) => (
          <li key={row.id}>
            <Link href={modelHref(row)} className="lbx-row">
              <Rank row={row} />
              <span className="lbx-model"><Logo provider={row.provider} /><span className="lbx-name">{row.label}</span><Note row={row} /></span>
              <Score row={row} />
            </Link>
          </li>
        ))}
      </ol>

      {k === 'coding' && communityModels > 0 && (
        <p className="lbx-foot">The {communityModels} community-funded models are still tested by us on coding, so they rank here as normal.</p>
      )}

      {board.community.length > 0 && (
        <div className="lbx-comm">
          <div className="lbx-comm-head">
            <CommunityIcon />
            <span>Community-funded</span>
            <span className="lbx-comm-count">{board.community.length} models</span>
          </div>
          <p className="lbx-comm-text">{communityBlurb(k)}</p>
          <ul className="lbx-comm-list">
            {board.community.map((row) => (
              <li key={row.id}>
                <Link href={modelHref(row, true)} className="lbx-crow" title={`Open ${row.label} to fund its next run`}>
                  <Logo provider={row.provider} size={14} box={22} />
                  <span className="lbx-name">{row.label}</span>
                  {row.when && <span className="lbx-chip">{row.when}</span>}
                  <Score row={row} muted />
                </Link>
              </li>
            ))}
          </ul>
          <p className="lbx-comm-cta">Pick a model to fund its next run.</p>
        </div>
      )}

      {board.other.length > 0 && (
        <div className="lbx-comm lbx-comm--other">
          <div className="lbx-comm-head"><span>Not ranked right now</span></div>
          <ul className="lbx-comm-list">
            {board.other.map((row) => (
              <li key={row.id}>
                <Link href={modelHref(row)} className="lbx-crow" title={row.staleReason || undefined}>
                  <Logo provider={row.provider} size={14} box={22} />
                  <span className="lbx-name">{row.label}</span>
                  {row.when && <span className="lbx-chip">{row.when}</span>}
                  <Score row={row} muted />
                </Link>
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
  return (
    <div ref={ref} className="lbx-side">
      {width === 0 ? null : width >= 900 ? (
        <div className="lbx-side-grid">
          {BOARD_KEYS.map((k) => <BoardCard key={k} board={boards[k]} communityModels={communityModels} />)}
        </div>
      ) : (
        <Swipe boards={boards} communityModels={communityModels} />
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
    <div className="lbx-swipe">
      <div className="lbx-chips" role="tablist" aria-label="Boards">
        {BOARD_KEYS.map((k, i) => (
          <button key={k} type="button" role="tab" aria-selected={active === i}
                  className={`lbx-chipbtn${active === i ? ' is-active' : ''}`} onClick={() => go(i)}>
            {boards[k].title}
          </button>
        ))}
      </div>
      <div className="lbx-swipe-track" ref={scroller} onScroll={onScroll}>
        {BOARD_KEYS.map((k, i) => (
          <div key={k} className="lbx-swipe-item" ref={(el) => { cards.current[i] = el; }}>
            <BoardCard board={boards[k]} communityModels={communityModels} />
          </div>
        ))}
      </div>
      <div className="lbx-dots" aria-hidden="true">
        {BOARD_KEYS.map((k, i) => <span key={k} className={active === i ? 'is-active' : ''} />)}
      </div>
    </div>
  );
}
