'use client';

import { useCallback, useEffect, useState } from 'react';

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
 * Underlined tabs on wide screens; on a phone (styles/workspace.css) a full-width dropdown instead,
 * because a scrolling tab bar hides the later sections off the edge of the screen.
 */
export default function Tabs({ tabs, value, onChange }: { tabs: TabDef[]; value: string; onChange: (id: string) => void }) {
  return (
    <>
      <div className="ws-tabs" role="tablist">
        {tabs.map(t => (
          <button key={t.id} type="button" role="tab" className="ws-tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <select className="ws-tabs-select" aria-label="Section" value={value} onChange={e => onChange(e.target.value)}>
        {tabs.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
    </>
  );
}
