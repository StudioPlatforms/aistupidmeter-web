'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface RdTocItem { id: string; label: string }

const num = (i: number) => String(i + 1).padStart(2, '0');

/**
 * "On this page" for the reading pages (Reading.tsx). On a wide screen, a panel that floats beside
 * the text and follows the reader; below that, a row of chips held under the top bar. Both mark the
 * section in view and fill a line as the reader gets through the page.
 *
 * The panel lives in an overlay the size of the sections' area, so it travels exactly as far as
 * the sections do and stops before the closing band. Scrolling updates the line through a CSS
 * variable rather than React state, so it costs one style write per frame.
 */
export default function ReadingToc({ items, label = 'On this page' }: { items: RdTocItem[]; label?: string }) {
  const [active, setActive] = useState(items[0]?.id ?? '');
  const panel = useRef<HTMLElement>(null);
  const panelList = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  const chips = useRef<HTMLElement>(null);
  const chipList = useRef<HTMLOListElement>(null);

  // The section whose top has most recently passed a line under the top bar, and how far through
  // the sections the reader is.
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
    const area = (panel.current?.closest('.rd') ?? null) as HTMLElement | null;
    if (!els.length) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = Math.min(window.innerHeight * 0.3, 260);
      let cur = els[0].id;
      for (const el of els) if (el.getBoundingClientRect().top <= line) cur = el.id;
      // At the very bottom the last entries may never reach the line: the last one wins there.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = els[els.length - 1].id;
      setActive(cur);
      if (area) {
        const r = area.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
        panel.current?.style.setProperty('--p', p.toFixed(4));
        chips.current?.style.setProperty('--p', p.toFixed(4));
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items]);

  // Slide the marker to the active entry, and keep that entry in view inside the panel and the
  // chip row (scrolling those lists only — scrollIntoView would also move the page).
  const place = useCallback(() => {
    const list = panelList.current, m = mark.current;
    const a = list?.querySelector<HTMLElement>('a.is-active');
    if (list && m && a) {
      m.style.setProperty('--y', `${a.offsetTop}px`);
      m.style.setProperty('--h', `${a.offsetHeight}px`);
      m.style.opacity = '1';
      const box = panel.current;
      if (box && box.scrollHeight > box.clientHeight) {
        const top = a.offsetTop + list.offsetTop;
        if (top < box.scrollTop + 40 || top + a.offsetHeight > box.scrollTop + box.clientHeight - 40) {
          box.scrollTo({ top: Math.max(0, top - box.clientHeight / 2), behavior: 'smooth' });
        }
      }
    }
    const row = chipList.current;
    const c = row?.querySelector<HTMLElement>('a.is-active');
    if (row && c && row.scrollWidth > row.clientWidth) {
      const left = c.offsetLeft - row.offsetLeft;
      if (left < row.scrollLeft + 16 || left + c.offsetWidth > row.scrollLeft + row.clientWidth - 16) {
        row.scrollTo({ left: Math.max(0, left - 24), behavior: 'smooth' });
      }
    }
  }, []);

  useEffect(() => { place(); }, [active, place]);
  useEffect(() => {
    // Heights settle once the web fonts arrive and whenever the panel changes size.
    document.fonts?.ready.then(place).catch(() => {});
    const ro = typeof ResizeObserver !== 'undefined' && panelList.current ? new ResizeObserver(() => place()) : null;
    if (ro && panelList.current) ro.observe(panelList.current);
    return () => ro?.disconnect();
  }, [place]);

  const link = (it: RdTocItem, i: number) => (
    <a href={`#${it.id}`} className={active === it.id ? 'is-active' : undefined} aria-current={active === it.id ? 'location' : undefined}>
      <span className="rd-n" aria-hidden="true">{num(i)}</span>
      <span>{it.label}</span>
    </a>
  );

  return (
    <>
      <div className="rd-rail">
        <div className="lp-wrap rd-rail-in">
          <nav ref={panel} className="rd-toc" aria-label={label}>
            <p className="rd-toc-h">{label}</p>
            <div ref={panelList} className="rd-toc-list">
              <span ref={mark} className="rd-mark" aria-hidden="true" />
              <ol>{items.map((it, i) => <li key={it.id}>{link(it, i)}</li>)}</ol>
            </div>
            <span className="rd-prog" aria-hidden="true"><i /></span>
          </nav>
        </div>
      </div>
      <nav ref={chips} className="rd-chips" aria-label={label}>
        <ol ref={chipList}>
          {items.map((it, i) => <li key={it.id}>{link(it, i)}</li>)}
        </ol>
        <span className="rd-prog" aria-hidden="true"><i /></span>
      </nav>
    </>
  );
}
