'use client';

import { LAYOUT_INFO, type BoardLayout } from '../../lib/board-layout';
import { useBoards, type SortKey } from '../../lib/use-boards';
import { LayoutSketch } from './LayoutChooser';
import LayoutConnected from './LayoutConnected';
import LayoutSide from './LayoutSide';
import LayoutTable from './LayoutTable';
import LayoutTop from './LayoutTop';
import '../../styles/boards.css';

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

  return (
    <section className={`lbx lbx--${layout}${loading && boards ? ' is-refreshing' : ''}`} aria-label="Leaderboards">
      <div className="lbx-bar">
        <button type="button" className="lbx-bar-layout" onClick={onChangeLayout} aria-haspopup="dialog">
          <LayoutSketch layout={layout} />
          <span>Layout: <b>{LAYOUT_INFO[layout].name}</b></span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <button type="button" className="lbx-bar-help" onClick={onHelp}>How to read this</button>
      </div>

      {loading && boards && <div className="v4-lb-loading-bar" role="progressbar" aria-label="Updating leaderboards" />}

      {!boards ? (
        <div className="lbx-empty">{error ? 'The leaderboards could not be loaded. Retrying shortly…' : 'Loading the leaderboards…'}</div>
      ) : layout === 'connected' ? (
        <LayoutConnected boards={boards} />
      ) : layout === 'side' ? (
        <LayoutSide boards={boards} />
      ) : layout === 'table' ? (
        <LayoutTable boards={boards} sortKey={sortKey} onSortChange={onSortChange} />
      ) : (
        <LayoutTop boards={boards} sortKey={sortKey} onSortChange={onSortChange} />
      )}
    </section>
  );
}
