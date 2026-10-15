'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface TabDef { id: string; label: string }

/**
 * The selected tab, kept in ?tab= so a reload, a shared link or the browser's back button
 * lands on the same tab. Unknown values fall back to the first tab.
 */
export function useTab(tabs: TabDef[]): [string, (id: string) => void] {
  const ids = tabs.map(t => t.id);
  const read = () => {
    if (typeof window === 'undefined') return ids[0];
    const t = new URLSearchParams(window.location.search).get('tab');
    return t && ids.includes(t) ? t : ids[0];
  };
  const [tab, setTab] = useState<string>(ids[0]);
  useEffect(() => {
    setTab(read());
    const onPop = () => setTab(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);
  const choose = useCallback((id: string) => {
    setTab(id);
    const url = new URL(window.location.href);
    if (id === ids[0]) url.searchParams.delete('tab'); else url.searchParams.set('tab', id);
    window.history.pushState(null, '', url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);
  return [ids.includes(tab) ? tab : ids[0], choose];
}

/**
 * Underlined tabs (styles/studio.css `.st-tabs`). On a narrow screen the bar scrolls sideways:
 * the edge that has more tabs behind it fades out, and the chosen tab is scrolled into view, so
 * no section hides off the edge unannounced. Arrow keys move between tabs.
 */
export default function Tabs({ tabs, value, onChange }: { tabs: TabDef[]; value: string; onChange: (id: string) => void }) {
  const bar = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState('');

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => {
      const start = el.scrollLeft > 2;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setFade([start && 'start', end && 'end'].filter(Boolean).join(' '));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => { el.removeEventListener('scroll', update); ro?.disconnect(); };
  }, [tabs.length]);

  // Keep the chosen tab inside the bar. Only the bar scrolls — never the page.
  useEffect(() => {
    const el = bar.current;
    const on = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !on) return;
    const left = on.offsetParent === el ? on.offsetLeft : on.offsetLeft - el.offsetLeft;
    if (left < el.scrollLeft + 8) el.scrollLeft = Math.max(0, left - 24);
    else if (left + on.offsetWidth > el.scrollLeft + el.clientWidth - 8) el.scrollLeft = left + on.offsetWidth - el.clientWidth + 24;
  }, [value, tabs.length]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = tabs.findIndex(t => t.id === value);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    if (!next) return;
    e.preventDefault();
    onChange(next.id);
    requestAnimationFrame(() => bar.current?.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus());
  };

  return (
    <div ref={bar} className="st-tabs sw-tabs" role="tablist" data-fade={fade || undefined} onKeyDown={onKey}>
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          role="tab"
          data-tab={t.id}
          className="st-tab"
          aria-selected={value === t.id}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
