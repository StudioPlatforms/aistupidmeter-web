'use client';

import { useEffect } from 'react';

/**
 * Reveal-on-view for the signed-in app shell (the landing page's `.lp-up`, as `.st-up`).
 *
 * App pages render their content after a fetch, so a one-time scan would miss nearly everything:
 * a MutationObserver picks up `.st-up` elements as they mount. The `st-js` class that hides
 * not-yet-revealed elements is only added here, once this has run, so a page whose script never
 * loads still shows everything.
 */
export default function StudioEffects() {
  useEffect(() => {
    const root = document.querySelector('.st');
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      }
    }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });

    const seen = new WeakSet<Element>();
    const scan = (node: ParentNode) => {
      node.querySelectorAll('.st-up:not(.is-in)').forEach(el => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
    };

    scan(root);
    root.classList.add('st-js');

    let queued = false;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; scan(root); });
    });
    mo.observe(root, { childList: true, subtree: true });

    return () => { io.disconnect(); mo.disconnect(); root.classList.remove('st-js'); };
  }, []);
  return null;
}
