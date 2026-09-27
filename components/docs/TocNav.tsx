'use client';

import { useEffect, useRef, useState } from 'react';
import type { TocItem } from './Doc';

/** "On this page": sticky on the left on a wide screen, a row of links above the content below that. */
export default function TocNav({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);
  const listRef = useRef<HTMLOListElement | null>(null);

  // Below 1100px the list is a sideways row of chips: keep the active one in view. Scrolls the
  // row only (scrollIntoView would also move the page).
  useEffect(() => {
    const ol = listRef.current;
    if (!ol || ol.scrollWidth <= ol.clientWidth) return;
    const a = ol.querySelector<HTMLElement>('a.is-active');
    if (!a) return;
    const left = a.offsetLeft - ol.offsetLeft;
    if (left < ol.scrollLeft || left + a.offsetWidth > ol.scrollLeft + ol.clientWidth) {
      ol.scrollTo({ left: Math.max(0, left - 16), behavior: 'smooth' });
    }
  }, [active]);

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    // The section whose top has most recently passed a line a quarter of the way down the screen.
    const pick = () => {
      const line = window.innerHeight * 0.25;
      let current = els[0].id;
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id;
      setActive(current);
    };
    pick();
    window.addEventListener('scroll', pick, { passive: true });
    window.addEventListener('resize', pick);
    return () => { window.removeEventListener('scroll', pick); window.removeEventListener('resize', pick); };
  }, [items]);

  return (
    <nav className="doc-toc" aria-label="On this page">
      <div className="doc-toc-title">On this page</div>
      <ol ref={listRef}>
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`} className={active === i.id ? 'is-active' : ''} aria-current={active === i.id ? 'location' : undefined}>
              {i.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
