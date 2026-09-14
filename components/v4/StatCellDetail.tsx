'use client';

/**
 * The names behind a headline number.
 *
 * The stat bar says "DEGRADED 1" and every reader's next question is "which one?". The
 * answer is already on the client — the leaderboard rows are right there — so making the
 * reader scan the board for it is a gap we can just close.
 *
 * Opens on hover for a mouse and on tap for touch, and the two are kept apart deliberately:
 * a tap on a touch device fires a synthetic mouseenter immediately before the click, so a
 * single `hovered` flag would open and then instantly close the panel. `pointerType` tells
 * them apart. A tapped panel stays pinned until it is tapped again, Escape, or a tap
 * outside — hover alone never pins.
 */

import { useEffect, useRef, useState } from 'react';

export interface DetailEntry {
  label: string;
  /** Right-hand value: a score, a count, whatever the cell is about. */
  value?: string | number | null;
  /** Muted third column, e.g. the provider. */
  note?: string | null;
}

interface Props {
  id: string;
  className: string;
  label: string;
  value: React.ReactNode;
  detail: React.ReactNode;
  /** Native tooltip text — kept, because it explains what the number MEANS. */
  title?: string;
  /** The rows revealed on hover/tap. Empty or undefined leaves the cell inert. */
  entries?: DetailEntry[];
  /** Shown instead of rows when there are none — e.g. "none in the last 24 hours". */
  emptyText?: string;
  /** One line above the rows, explaining what the list is. */
  caption?: string;
  open: boolean;
  onHover: (open: boolean) => void;
  onToggle: () => void;
  onClose: () => void;
}

const MAX_ROWS = 12;

export default function StatCellDetail({
  id, className, label, value, detail, title,
  entries, emptyText, caption, open, onHover, onToggle, onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);
  const interactive = !!entries || !!emptyText;

  // Keep the panel on screen: if it would overflow the right edge, anchor it to the right.
  useEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setFlip(r.left + 280 > window.innerWidth - 8);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onOutside = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onOutside);
    };
  }, [open, onClose]);

  const shown = entries?.slice(0, MAX_ROWS) ?? [];
  const more = (entries?.length ?? 0) - shown.length;

  return (
    <div
      ref={ref}
      className={`${className}${interactive ? ' v4-stat-has-detail' : ''}${open ? ' is-open' : ''}`}
      title={title}
      onPointerEnter={e => { if (interactive && e.pointerType === 'mouse') onHover(true); }}
      onPointerLeave={e => { if (interactive && e.pointerType === 'mouse') onHover(false); }}
      onClick={() => { if (interactive) onToggle(); }}
      onKeyDown={e => {
        if (!interactive) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
      }}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      aria-expanded={interactive ? open : undefined}
      aria-controls={interactive ? `${id}-detail` : undefined}
    >
      <div className="v4-stat-label">
        {label}
        {interactive && <span className="v4-stat-more" aria-hidden="true">·</span>}
      </div>
      <div className="v4-stat-value">{value}</div>
      <div className="v4-stat-detail">{detail}</div>

      {interactive && open && (
        <div
          id={`${id}-detail`}
          className={`v4-stat-pop${flip ? ' is-flipped' : ''}`}
          role="dialog"
          aria-label={`${label} detail`}
          onClick={e => e.stopPropagation()}
        >
          {caption && <div className="v4-stat-pop-caption">{caption}</div>}
          {shown.length > 0 ? (
            <ul className="v4-stat-pop-list">
              {shown.map((e, i) => (
                <li key={`${e.label}-${i}`}>
                  <span className="v4-stat-pop-name">{e.label}</span>
                  {e.note && <span className="v4-stat-pop-note">{e.note}</span>}
                  {e.value != null && e.value !== '' && <span className="v4-stat-pop-val">{e.value}</span>}
                </li>
              ))}
              {more > 0 && <li className="v4-stat-pop-more">+{more} more</li>}
            </ul>
          ) : (
            <div className="v4-stat-pop-empty">{emptyText}</div>
          )}
        </div>
      )}
    </div>
  );
}
