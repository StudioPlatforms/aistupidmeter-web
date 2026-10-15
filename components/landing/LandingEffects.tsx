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

    return () => { reveal.disconnect(); counters.disconnect(); };
  }, []);
  return null;
}
