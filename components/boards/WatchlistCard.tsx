'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useWatchlist } from '../WatchlistProvider';
import { BOARD_KEYS, BOARD_TITLE, standingOn, type BoardKey, type BoardRow, type Boards } from '../../lib/use-boards';
import { Logo, Star, modelHref } from './BoardBits';

/**
 * One board in a card cell, short enough for a quarter of a card: rank and score when ranked; a
 * community-funded board shows the last funded score and its date instead, greyed; a model
 * with no combined rank shows a dash. The long form is the cell's tooltip.
 */
function cell(boards: Boards, k: BoardKey, id: string): { big: string; small: string; muted: boolean; title: string } {
  const s = standingOn(boards, k, id);
  if (s.ranked) return { big: s.v, small: String(boards[k].ranked.find((x) => x.id === id)?.score ?? ''), muted: false, title: `${BOARD_TITLE[k]}: rank ${s.v}, ${s.sub}` };
  const c = boards[k].community.find((x) => x.id === id);
  if (c && k !== 'combined') return { big: String(c.score ?? '—'), small: c.when ?? '', muted: true, title: `${BOARD_TITLE[k]}: ${c.score} on the last funded run (${c.when}); not ranked` };
  if (c) return { big: '—', small: '', muted: true, title: 'Combined: not ranked. Their reasoning and tool-use runs are funded by the community, so there is no complete combined score to rank. We test their coding every 4 hours.' };
  return { big: '—', small: '', muted: true, title: `${BOARD_TITLE[k]}: not ranked right now` };
}

/**
 * "Your watchlist": every model the signed-in visitor has starred, with its place on all four
 * boards, above whichever layout they use. The stars on the rows add to it; the star here takes
 * a model off. In the Connected layout a card also follows the model in the columns (`onPick`);
 * everywhere else it opens the model's page.
 *
 * Signed out there is nothing to show — the stars send a visitor to sign up.
 */
export default function WatchlistCard({ boards, onPick, picked }: {
  boards: Boards;
  onPick?: (id: string) => void;
  picked?: string | null;
}) {
  const { status } = useSession();
  const { ready, tracked, limit } = useWatchlist();
  if (status !== 'authenticated' || !ready) return null;

  const everyone: BoardRow[] = [...boards.combined.ranked, ...boards.combined.community, ...boards.combined.other];
  const mine = everyone.filter((r) => tracked.has(r.id));

  if (mine.length === 0) {
    return (
      <div className="sl-wl-empty">
        <i aria-hidden="true">☆</i>
        <span>Star any model on the boards to pin it here, with its rank on all four boards.</span>
      </div>
    );
  }

  return (
    <section className="sl-wl st-up" aria-label="Your watchlist">
      <header className="sl-wl-head">
        <h3 className="sl-wl-title">Your watchlist</h3>
        <span className="sl-wl-count">{mine.length}{limit ? ` of ${limit}` : ''} models</span>
        <Link href="/watchlist" className="st-more">Manage alerts</Link>
      </header>
      <div className="sl-wl-grid">
        {mine.map((row) => (
          <div key={row.id} className={`sl-wl-item${picked === row.id ? ' is-on' : ''}`}>
            <div className="sl-wl-name">
              <Star row={row} />
              <Logo provider={row.provider} />
              {onPick ? (
                <button type="button" className="sl-name sl-stretch sl-wl-pick" onClick={() => onPick(row.id)}
                        aria-pressed={picked === row.id} title={`Follow ${row.label} across the boards below`}>
                  {row.label}
                </button>
              ) : (
                <Link href={modelHref(row)} className="sl-name sl-stretch">{row.label}</Link>
              )}
            </div>
            <dl className="sl-wl-stats">
              {BOARD_KEYS.map((k) => {
                const c = cell(boards, k, row.id);
                return (
                  <div key={k} title={c.title}>
                    <dt>{BOARD_TITLE[k]}</dt>
                    <dd className={c.muted ? 'is-muted' : ''}><b>{c.big}</b> <small>{c.small}</small></dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
