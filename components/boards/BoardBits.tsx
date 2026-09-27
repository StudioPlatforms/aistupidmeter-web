'use client';

import ProviderLogo from '../ProviderLogo';
import type { BoardRow } from '../../lib/use-boards';

/** Small shared pieces for the four leaderboard layouts. Styles: styles/boards.css (lbx-*). */

export const modelHref = (row: BoardRow, fund = false) => `/models/${row.slug}${fund ? '?fund=1' : ''}`;

export function Logo({ provider, size = 16, box = 26 }: { provider: string | null; size?: number; box?: number }) {
  return (
    <span className="lbx-logo" style={{ width: box, height: box }} aria-hidden="true">
      <ProviderLogo provider={provider || ''} size={size} />
    </span>
  );
}

export function Rank({ row }: { row: BoardRow }) {
  if (row.rank === null) return <span className="lbx-rank lbx-rank--none" aria-label="not ranked">–</span>;
  const tied = row.rankText.startsWith('=');
  return (
    <span
      className={`lbx-rank${row.top ? ' lbx-rank--top' : ''}`}
      title={tied ? 'Statistical tie: the gap to the models sharing this rank is smaller than the measurement can resolve.' : undefined}
    >
      {row.rankText}
    </span>
  );
}

export function Note({ row }: { row: BoardRow }) {
  if (!row.note) return null;
  return <span className="lbx-note" title={row.coverage || undefined}>{row.note}</span>;
}

export function Score({ row, muted = false }: { row: BoardRow; muted?: boolean }) {
  return <span className={`lbx-score${muted ? ' lbx-score--muted' : ''}`}>{row.score ?? '—'}</span>;
}

export function CommunityIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
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
