import type { CSSProperties, ReactNode } from 'react';

interface PageHeadProps {
  /** Small uppercase line above the title, e.g. the nav group: "Routing". */
  kicker?: ReactNode;
  title: ReactNode;
  /** One or two sentences under the title. */
  lead?: ReactNode;
  /** Buttons on the right (under the title on phones). */
  actions?: ReactNode;
  /** A full-width row under the title: stats, meta chips, a period picker. */
  children?: ReactNode;
}

const delay = (d: string) => ({ '--d': d } as CSSProperties);

/**
 * The page header of every signed-in app page: the landing hero in miniature — tinted band,
 * dot grid, the ASL mark's slant as streaks, a kicker, a display-face title and a lead.
 */
export default function PageHead({ kicker, title, lead, actions, children }: PageHeadProps) {
  return (
    <header className="st-head">
      <div className="st-streaks" aria-hidden="true"><i /><i /><i /></div>
      <div className="st-head-in">
        <div>
          {kicker && <p className="st-kicker st-intro">{kicker}</p>}
          <h1 className="st-title st-intro" style={delay('.05s')}>{title}</h1>
          {lead && <p className="st-lead st-intro" style={delay('.1s')}>{lead}</p>}
        </div>
        {actions && <div className="st-head-act st-intro" style={delay('.15s')}>{actions}</div>}
        {children && <div className="st-head-extra st-intro" style={delay('.2s')}>{children}</div>}
      </div>
    </header>
  );
}
