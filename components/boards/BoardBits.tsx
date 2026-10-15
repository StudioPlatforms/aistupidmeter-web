'use client';

import { useLayoutEffect, useRef } from 'react';
import ProviderLogo from '../ProviderLogo';
import WatchStar from '../WatchStar';
import type { BoardRow } from '../../lib/use-boards';

/** Small shared pieces for the four leaderboard layouts. Styles: styles/studio-boards.css (sl-*). */

export const modelHref = (row: BoardRow, fund = false) => `/models/${row.slug}${fund ? '?fund=1' : ''}`;

type LogoSize = 'xs' | 'sm' | 'md' | 'lg';
const LOGO_PX: Record<LogoSize | 'base', number> = { xs: 12, sm: 13, base: 15, md: 16, lg: 20 };

/** A provider's mark on a white chip, as on the landing — the marks are drawn for a light ground. */
export function Logo({ provider, size }: { provider: string | null; size?: LogoSize }) {
  return (
    <span className={`sl-logo${size ? ` is-${size}` : ''}`} aria-hidden="true">
      <ProviderLogo provider={provider || ''} size={LOGO_PX[size ?? 'base']} />
    </span>
  );
}

/**
 * The watchlist star. Rows are one link stretched over the whole row (.sl-stretch), so the
 * star sits above that link rather than inside it — a button inside an <a> is invalid.
 */
export function Star({ row, size = 14 }: { row: BoardRow; size?: number }) {
  return <span className="sl-star"><WatchStar modelId={row.id} modelName={row.label} size={size} /></span>;
}

export function Rank({ row }: { row: BoardRow }) {
  if (row.rank === null) return <span className="sl-rank is-none" aria-label="not ranked">–</span>;
  const tied = row.rankText.startsWith('=');
  return (
    <span
      className={`sl-rank${row.top ? ' is-top' : ''}`}
      title={tied ? 'Statistical tie: the gap to the models sharing this rank is smaller than the measurement can resolve.' : undefined}
    >
      {row.rankText}
    </span>
  );
}

export function Note({ row }: { row: BoardRow }) {
  if (!row.note) return null;
  return <span className="sl-flag" title={row.coverage || undefined}>{row.note}</span>;
}

export function Score({ row, muted = false }: { row: BoardRow; muted?: boolean }) {
  return <span className={`sl-score${muted ? ' is-muted' : ''}`}>{row.score ?? '—'}</span>;
}

/** The landing's slim bar: the score out of 100, from a zero baseline. Accent for a board leader. */
export function ScoreBar({ row }: { row: BoardRow }) {
  if (row.score === null) return <span className="sl-sbar" aria-hidden="true" />;
  return (
    <span className={`sl-sbar${row.rank === 1 ? ' is-lead' : ''}`} aria-hidden="true">
      <i style={{ width: `${Math.max(0, Math.min(100, row.score))}%` }} />
    </span>
  );
}

export function CommunityIcon({ size = 15 }: { size?: number }) {
  return (
    <svg className="sl-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/** One sentence for the community-funded group, per board. */
export function communityBlurb(board: 'combined' | 'coding' | 'reasoning' | 'tooling'): string {
  return board === 'combined'
    ? 'We still test these on coding every 4 hours. Their reasoning and tool-use runs are funded by the community, so they have no combined rank.'
    : 'Shown with their last funded run, not ranked. They rejoin the board when someone funds a new run.';
}

export const trendGlyph = (t: string) => (t === 'up' ? '▲' : t === 'down' ? '▼' : '→');

/**
 * Rows that slide to their new places when the order changes (a new period, another sort), as
 * the landing's ranked rows do. Every element under the returned ref with a `data-flip` key is
 * measured after each change of `deps`; one that moved is animated from where it was, and one
 * that is new fades in. Positions are taken relative to the container, so scrolling the page
 * or a panel growing above it moves nothing; a change of the container's width or of `mode`
 * (a resize, another form of the layout — not a reorder) is not animated either. Nothing runs
 * under reduced motion.
 */
export function useFlip<T extends HTMLElement>(deps: unknown[], mode = '') {
  const ref = useRef<T | null>(null);
  const last = useRef<{ w: number; mode: string; pos: Map<string, number> } | null>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) { last.current = null; return; }
    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-flip]'));
    // A slide still running would put its row mid-way; measure where the rows really are.
    for (const el of els) el.getAnimations?.().forEach((a) => a.cancel());
    const box = root.getBoundingClientRect();
    const pos = new Map<string, number>();
    for (const el of els) pos.set(el.dataset.flip as string, el.getBoundingClientRect().top - box.top);
    const prev = last.current;
    last.current = { w: Math.round(box.width), mode, pos };
    if (!prev || prev.w !== Math.round(box.width) || prev.mode !== mode || typeof root.animate !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const el of els) {
      const key = el.dataset.flip as string;
      const before = prev.pos.get(key);
      if (before === undefined) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease', fill: 'backwards' });
        continue;
      }
      const dy = before - (pos.get(key) as number);
      if (Math.abs(dy) < 1) continue;
      el.animate([{ transform: `translateY(${dy.toFixed(1)}px)` }, { transform: 'translateY(0)' }],
        { duration: 700, easing: 'cubic-bezier(.2, .7, .2, 1)' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
