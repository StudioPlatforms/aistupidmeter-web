'use client';

import { useEffect } from 'react';

/**
 * Scroll reveals and count-ups for the landing page.
 *
 * The `lp-js` class that hides not-yet-revealed blocks is set by an inline script before first
 * paint (see Landing.tsx), and that script removes it again if this component has not mounted
 * within a few seconds — so a failed script bundle can never leave the page blank.
 */
export default function LandingEffects() {
  useEffect(() => {
    (window as any).__lpReady = true;
    const root = document.querySelector('.lp');
    if (!root) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const reveal = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); reveal.unobserve(e.target); }
      }
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
    root.querySelectorAll('.lp-up').forEach(el => reveal.observe(el));

    const counters = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        counters.unobserve(e.target);
        if (reduced) continue;
        const el = e.target as HTMLElement;
        const to = Number(el.dataset.count);
        if (!Number.isFinite(to)) continue;
        const t0 = performance.now();
        const frame = (now: number) => {
          const p = Math.min(1, (now - t0) / 1400);
          el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString('en-US');
          if (p < 1) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }
    }, { threshold: 0.6 });
    root.querySelectorAll('[data-count]').forEach(el => counters.observe(el));

    // The home page leaves the layout of its off-screen sections out of the first paint
    // (styles/landing.css, .lp-home .lp-sec). Now that the page is interactive they are laid out
    // one per frame, while the browser is idle, so nothing blocks for long and the page ends up
    // exactly as it would have been. No-ops on every other page (they have no .lp-home).
    const pending = Array.from(document.querySelectorAll('.lp-home .lp-sec'));
    let laying = pending.length > 0;
    const w = window as any; // requestIdleCallback is missing in some Safari versions
    const idle = (fn: () => void) => (typeof w.requestIdleCallback === 'function'
      ? w.requestIdleCallback(fn, { timeout: 600 })
      : w.setTimeout(fn, 60));
    const layNext = () => {
      if (!laying) return;
      const section = pending.shift();
      if (!section) { document.documentElement.classList.add('lp-all'); laying = false; return; }
      section.classList.add('is-laid');
      idle(() => requestAnimationFrame(layNext));
    };
    if (laying) idle(() => requestAnimationFrame(layNext));

    return () => { laying = false; reveal.disconnect(); counters.disconnect(); };
  }, []);
  return null;
}
