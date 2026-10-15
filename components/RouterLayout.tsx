'use client';

import { useEffect, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import RouterSidebar, { sectionFor } from './RouterSidebar';
import StudioEffects from './studio/StudioEffects';
import { initializeTheme } from '../lib/theme-config';
import { lpBody, lpDisplay } from '../lib/fonts';
import '../styles/router-v4.css';
import '../styles/landing.css';
import '../styles/studio.css';

interface RouterLayoutProps {
  children: React.ReactNode;
}

/**
 * The signed-in app shell (router, account, watchlist, forum): sidebar rail on desktop, a top bar
 * and menu sheet on phones, in the landing page's look (`.st`, styles/studio.css). The landing's
 * typefaces apply here too, and `--st-kicker` names the section for page headers that do not
 * render their own kicker.
 */
export default function RouterLayout({ children }: RouterLayoutProps) {
  // Initialize theme on mount to ensure it persists across router pages
  useEffect(() => {
    initializeTheme();
  }, []);

  const section = sectionFor(usePathname());
  const style = section ? ({ '--st-kicker': JSON.stringify(section) } as CSSProperties) : undefined;

  return (
    <div className={`rv4-shell st ${lpBody.variable} ${lpDisplay.variable}`} style={style}>
      <StudioEffects />
      <RouterSidebar />
      <div className="rv4-content st-main">
        {children}
      </div>
    </div>
  );
}
