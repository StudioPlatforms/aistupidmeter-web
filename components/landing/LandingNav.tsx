'use client';

import { useEffect, useState } from 'react';
import { THEMES, chooseTheme } from '@/lib/theme-config';

/** Flip to the other theme from the one on screen (the page may be showing its Dark default). */
function toggleTheme() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = THEMES.findIndex(t => t.isLight === dark);
  if (next >= 0) chooseTheme(next);
}

const LINKS = [
  ['#price', 'Compare models'],
  ['#drift', 'Drift'],
  ['#router', 'Smart Router'],
  ['#assessment', 'For business'],
  ['#pricing', 'Pricing'],
  ['/methodology', 'Methodology'],
] as const;

/** The landing page's header: transparent over the hero, frosted once the page scrolls. */
export default function LandingNav({ signInHref, signUpHref }: { signInHref: string; signUpHref: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`lp-nav${scrolled || open ? ' is-scrolled' : ''}`} aria-label="Main">
      <div className="lp-wrap lp-nav-in">
        <a className="lp-brand" href="/" aria-label="AI Stupid Level home">
          <img className="lp-mk-l" src="/asl-mark.png" alt="AI Stupid Level" width={754} height={160} />
          <img className="lp-mk-d" src="/asl-mark-dark.png" alt="" width={754} height={160} />
        </a>
        <div className="lp-links">
          {LINKS.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        </div>
        <div className="lp-nav-cta">
          <button type="button" className="lp-quiet lp-hide-sm" onClick={toggleTheme}>Theme</button>
          <a className="lp-quiet lp-hide-sm" href={signInHref}>Log in</a>
          <a className="lp-btn lp-btn-primary" href={signUpHref}>Sign up free</a>
          <button type="button" className="lp-menu" aria-expanded={open} aria-controls="lp-sheet" aria-label="Menu"
            onClick={() => setOpen(o => !o)}><i /></button>
        </div>
      </div>
      {open && (
        <div className="lp-sheet" id="lp-sheet">
          {LINKS.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
          <a href={signInHref}>Log in</a>
          <button type="button" onClick={toggleTheme}>Switch theme</button>
        </div>
      )}
    </nav>
  );
}
