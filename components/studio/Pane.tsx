import type { CSSProperties, ReactNode } from 'react';

interface PaneProps {
  title?: ReactNode;
  /** One line under the title. */
  sub?: ReactNode;
  /** Buttons or a segmented control on the right of the title. */
  actions?: ReactNode;
  /** Draw a rule under the head (use with flush bodies: tables, row lists). */
  ruled?: boolean;
  /** No body padding — the content (a table, a row list) runs to the pane's edges. */
  flush?: boolean;
  /** Muted strip at the bottom. */
  foot?: ReactNode;
  /** Fade up when scrolled into view. */
  reveal?: boolean;
  /** Reveal delay in seconds, to stagger panes in one row. */
  delay?: number;
  tone?: 'accent';
  className?: string;
  id?: string;
  children?: ReactNode;
}

/** A card section: the landing's pane (18px radius, hairline border) with an optional head. */
export default function Pane({ title, sub, actions, ruled, flush, foot, reveal = true, delay, tone, className, id, children }: PaneProps) {
  // A flush body runs to the edges, so the pane clips it to its rounded corners.
  const cls = ['st-pane', flush && 'is-clip', tone === 'accent' && 'is-accent', reveal && 'st-up', className].filter(Boolean).join(' ');
  const style = delay ? ({ '--d': `${delay}s` } as CSSProperties) : undefined;
  return (
    <section className={cls} id={id} style={style}>
      {(title || actions) && (
        <div className={`st-pane-head${ruled ? ' is-ruled' : ''}`}>
          <div>
            {title && <h2 className="st-pane-title">{title}</h2>}
            {sub && <p className="st-pane-sub">{sub}</p>}
          </div>
          {actions && <div className="st-pane-act">{actions}</div>}
        </div>
      )}
      <div className={`st-pane-body${flush ? ' is-flush' : ''}`}>{children}</div>
      {foot && <div className="st-pane-foot">{foot}</div>}
    </section>
  );
}
