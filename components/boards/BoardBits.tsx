'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';
import ProviderLogo from '../ProviderLogo';
import { HostMark } from '../marketplace/HostLogo';
import WatchStar from '../WatchStar';
import type { BoardRow } from '../../lib/use-boards';

/** Small shared pieces for the four leaderboard layouts. Styles: styles/studio-boards.css (sl-*). */

/** A row's page: a hosted row's entry page (M9, §7.1: /models/<slug> is never right for one), else the model page. */
export const modelHref = (row: BoardRow, fund = false) => (row.href ? row.href : `/models/${row.slug}${fund ? '?fund=1' : ''}`);

type LogoSize = 'xs' | 'sm' | 'md' | 'lg';
const LOGO_PX: Record<LogoSize | 'base', number> = { xs: 12, sm: 13, base: 15, md: 16, lg: 20 };

/**
 * A provider's mark on a white chip, as on the landing — the marks are drawn for a light ground.
 * A hosted row (an inference provider's listing, Phase 3 plan §7.1) passes its `host`: the chip
 * then shows the host's approved mark, or its initials until one is approved, and the row's
 * `provider` (the host's slug) never reaches ProviderLogo, which would show the OpenAI mark.
 */
export function Logo({ provider, size, host }: {
  provider: string | null;
  size?: LogoSize;
  host?: { name: string; logoUrl?: string | null } | null;
}) {
  return (
    <span className={`sl-logo${size ? ` is-${size}` : ''}`} aria-hidden="true">
      {host
        ? <HostMark name={host.name} logoUrl={host.logoUrl} px={LOGO_PX[size ?? 'base']} />
        : <ProviderLogo provider={provider || ''} size={LOGO_PX[size ?? 'base']} />}
    </span>
  );
}

/**
 * The watchlist star. Rows are one link stretched over the whole row (.sl-stretch), so the
 * star sits above that link rather than inside it — a button inside an <a> is invalid.
 */
export function Star({ row, size = 14 }: { row: BoardRow; size?: number }) {
  // M9: no star on a hosted row in v1: the watchlist is keyed by fleet model id (§7.1).
  if (row.host) return null;
  return <span className="sl-star"><WatchStar modelId={row.id} modelName={row.label} size={size} /></span>;
}

// ── M9: the hosted group (Phase 3 plan §7.1, §7.2) ─────────────────────────────────────────────

export const HOSTED_TITLE = 'Hosted by independent providers';
export const HOSTED_SUB = 'Measured with our tests through each host\'s own API. A hosted model joins the ranking above once it meets the published criteria.';
export const ORDER_HREF = '/inference-providers/ranking-criteria#order';
export const JOIN_HREF = '/inference-providers/ranking-criteria#join';

/** The group's two links: the consumer-facing ranking disclosure (UCPD Art. 7(4a); rev: S17). */
export function HostedLinks({ className = 'sl-hosted-links' }: { className?: string }) {
  return (
    <p className={className}>
      <Link href={ORDER_HREF}>How hosts are ordered</Link>
      <span aria-hidden="true"> · </span>
      <Link href={JOIN_HREF}>How hosted models join</Link>
    </p>
  );
}

export function HostIcon({ size = 15 }: { size?: number }) {
  return (
    <svg className="sl-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="6" rx="1.5" />
      <rect x="3" y="14" width="18" height="6" rx="1.5" />
      <path d="M7 7h.01M7 17h.01" />
    </svg>
  );
}

/**
 * A hosted row's name in one line (§7.2): "DeepSeek V4 Pro (FP8) — hosted by Together AI". In a narrow cell "hosted
 * by " drops first ("DeepSeek V4 Pro (FP8) — Together AI"), then the text ends in an ellipsis; the full text is the
 * title and the accessible name, and there is never a second line under it.
 */
export function HostedName({ row, className = '' }: { row: BoardRow; className?: string }) {
  const full = row.label;
  const short = full.replace(' — hosted by ', ' — ');
  const ref = useRef<HTMLSpanElement | null>(null);
  const probe = useRef<HTMLSpanElement | null>(null);
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current; const pr = probe.current;
    if (!el || !pr || short === full) return;
    const fit = () => setNarrow(pr.getBoundingClientRect().width > el.getBoundingClientRect().width + 0.5);
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [full, short]);
  return (
    <span ref={ref} className={`sl-hname${className ? ` ${className}` : ''}`} title={full}>
      <span className="sl-hname-t">{narrow ? short : full}</span>
      <span ref={probe} className="sl-hname-probe" aria-hidden="true">{full}</span>
    </span>
  );
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
