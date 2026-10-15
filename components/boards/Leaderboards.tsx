'use client';

import { useState } from 'react';
import { Loader } from '../studio/Bits';
import { LAYOUT_INFO, type BoardLayout } from '../../lib/board-layout';
import { useBoards, type SortKey } from '../../lib/use-boards';
import { LayoutSketch } from './LayoutChooser';
import LayoutConnected from './LayoutConnected';
import LayoutSide from './LayoutSide';
import LayoutTable from './LayoutTable';
import LayoutTop from './LayoutTop';
import WatchlistCard from './WatchlistCard';
import '../../styles/boards.css';
import '../../styles/studio-boards.css';

/**
 * The leaderboards in the visitor's chosen layout, with the two controls every layout needs:
 * which layout (opens the chooser) and how to read it (opens that layout's explainer).
 */
export default function Leaderboards({ layout, period, sortKey, onSortChange, onChangeLayout, onHelp }: {
  layout: BoardLayout;
  period: string;
  sortKey: SortKey;
  onSortChange: (k: SortKey) => void;
  onChangeLayout: () => void;
  onHelp: () => void;
}) {
  const { boards, loading, error } = useBoards(period);
  // The model followed in the Connected layout. Kept here so a watchlist card can set it too.
  const [followed, setFollowed] = useState<string | null>(null);

  return (
    <section className={`sl-boards sl-boards--${layout}${loading && boards ? ' is-refreshing' : ''}`} aria-label="Leaderboards">
      <div className="sl-tools">
        <div className="sl-tools-l">
          <h2 className="sl-boards-title">Leaderboards</h2>
          <button type="button" className="sl-layout-btn" onClick={onChangeLayout} aria-haspopup="dialog">
            <LayoutSketch layout={layout} />
            <span>Layout: <b>{LAYOUT_INFO[layout].name}</b></span>
            <svg className="sl-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>
        <button type="button" className="sl-help" onClick={onHelp}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9.5" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6" /><path d="M12 17h.01" />
          </svg>
          How to read this
        </button>
        {loading && boards && <div className="sl-progress" role="progressbar" aria-label="Updating leaderboards" />}
      </div>

      {boards && (
        <WatchlistCard
          boards={boards}
          onPick={layout === 'connected' ? setFollowed : undefined}
          picked={layout === 'connected' ? followed : null}
        />
      )}

      {!boards ? (
        <div className="sl-wait">
          {error
            ? <p role="status">The leaderboards could not be loaded. Retrying shortly…</p>
            : <Loader label="Loading the leaderboards…" />}
        </div>
      ) : (
        <div className="sl-layout st-up">
          {layout === 'connected' ? (
            <LayoutConnected boards={boards} selected={followed} onSelect={setFollowed} />
          ) : layout === 'side' ? (
            <LayoutSide boards={boards} />
          ) : layout === 'table' ? (
            <LayoutTable boards={boards} sortKey={sortKey} onSortChange={onSortChange} />
          ) : (
            <LayoutTop boards={boards} sortKey={sortKey} onSortChange={onSortChange} />
          )}
        </div>
      )}
    </section>
  );
}
