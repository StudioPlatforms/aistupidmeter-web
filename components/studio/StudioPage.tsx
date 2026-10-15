import type { ReactNode } from 'react';
import StudioEffects from './StudioEffects';
import { lpBody, lpDisplay } from '@/lib/fonts';
import '@/styles/landing.css';
import '@/styles/studio.css';

/**
 * The signed-in app's look (`.st`, styles/studio.css) for a PUBLIC page that keeps the site's own
 * top bar and phone bottom bar — a model page, for instance. Carries the landing typefaces, the
 * shared tokens and the reveal-on-view effect; everything inside can use components/studio.
 */
export default function StudioPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`st st-page ${lpBody.variable} ${lpDisplay.variable}${className ? ` ${className}` : ''}`}>
      <StudioEffects />
      {children}
    </div>
  );
}
