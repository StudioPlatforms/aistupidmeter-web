'use client';

/**
 * The admin dashboard: accounts and plans, Stripe revenue and billing problems, who uses the
 * Smart Router and how much of their allowance is left, site traffic, and the admin tools.
 *
 * Who may see it is decided by the server: /api/admin/overview answers 401 to visitors who are
 * not signed in and 403 to accounts without the admin role (lib/admin-auth). Until 2026-10-05
 * this page compared a password typed here against one written into its own JavaScript.
 *
 * The tab lives in the URL hash (#billing, #router…), so a section can be bookmarked and a
 * reload keeps it.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PageHead, Loader, Empty, Note } from '@/components/studio';
import { lpBody, lpDisplay } from '@/lib/fonts';
import type { AdminOverview } from '@/lib/admin-types';
import type { TabKey } from './bits';
import OverviewTab from './OverviewTab';
import BillingTab from './BillingTab';
import RouterTab from './RouterTab';
import AccountsTab from './AccountsTab';
import TrafficTab, { type RecentVisitor, type VisitorStats } from './TrafficTab';
import ToolsTab from './ToolsTab';
import { clock } from './format';
import '@/styles/landing.css';
import '@/styles/studio-account.css';
import '@/styles/studio-admin.css';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'billing', label: 'Billing' },
  { key: 'router', label: 'Smart Router' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'traffic', label: 'Traffic' },
  { key: 'tools', label: 'Tools' },
];

const isTab = (v: string): v is TabKey => TABS.some(t => t.key === v);

type Access = 'checking' | 'ok' | 'signin' | 'forbidden' | 'error';

export default function AdminDashboard() {
  const { status } = useSession();
  const [access, setAccess] = useState<Access>('checking');
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [visitors, setVisitors] = useState<VisitorStats | null>(null);
  const [recent, setRecent] = useState<RecentVisitor[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabKey>('overview');
  const [updating, setUpdating] = useState(false);
  const [updateNote, setUpdateNote] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1); if (isTab(h)) setTab(h); };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  const select = (key: TabKey) => {
    setTab(key);
    window.history.replaceState(null, '', `#${key}`);
  };
  // From a link inside a tab: switch, then bring the tab bar back into view.
  const go = (key: TabKey) => {
    select(key);
    requestAnimationFrame(() => document.getElementById('ad-tabs')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };

  const loadOverview = useCallback(async (fresh: boolean) => {
    try {
      const r = await fetch(`/api/admin/overview${fresh ? '?fresh=1' : ''}`, { cache: 'no-store' });
      if (r.status === 401) { setAccess('signin'); return; }
      if (r.status === 403) { setAccess('forbidden'); return; }
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.success) {
        setLoadError(j?.error || `The overview did not load (${r.status}).`);
        setAccess(a => (a === 'checking' ? 'error' : a));
        return;
      }
      setData(j.data);
      setLoadError('');
      setAccess('ok');
    } catch {
      setLoadError('Could not reach the server.');
      setAccess(a => (a === 'checking' ? 'error' : a));
    }
  }, []);

  const loadTraffic = useCallback(async () => {
    const [stats, rec] = await Promise.all([
      fetch('/visitors/stats', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/admin/visitors/recent', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    if (stats?.today) setVisitors(stats);
    if (rec) setRecent(rec.visitors || []);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') { setAccess('signin'); return; }
    if (status !== 'authenticated') return;
    // In parallel: the visitor figures are public, and the recent-visits list answers 403 to
    // anyone the overview turns away.
    loadOverview(false);
    loadTraffic();
  }, [status, loadOverview, loadTraffic]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([loadOverview(true), loadTraffic()]);
    setRefreshing(false);
  };

  const updateDailyStats = async () => {
    setUpdating(true);
    setUpdateNote(null);
    try {
      const r = await fetch('/api/admin/update-daily-stats', { method: 'POST' });
      setUpdateNote(r.ok ? { tone: 'good', text: 'Daily stats updated.' } : { tone: 'bad', text: `Could not update daily stats (${r.status}).` });
      if (r.ok) await loadTraffic();
    } catch {
      setUpdateNote({ tone: 'bad', text: 'Could not reach the server.' });
    } finally {
      setUpdating(false);
    }
  };

  // Signed out: the public chrome is up (AccountShell), so this uses the landing's classes.
  if (status === 'unauthenticated' || (access === 'signin' && status !== 'authenticated')) {
    return (
      <div className={`lp ${lpBody.variable} ${lpDisplay.variable} sc-guest`}>
        <section className="lp-hero lp-textured sc-guest-hero">
          <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="lp-wrap sc-guest-mini">
            <p className="lp-kicker lp-intro">Admin</p>
            <h1 className="sc-guest-t lp-intro" style={{ ['--d' as string]: '.06s' }}>Admin dashboard</h1>
            <p className="lp-lead lp-intro" style={{ ['--d' as string]: '.12s' }}>Sign in with an administrator account to see it.</p>
            <div className="lp-cta lp-intro" style={{ ['--d' as string]: '.18s' }}>
              <Link href="/auth/signin?callbackUrl=%2Fadmin" className="lp-btn lp-btn-primary lp-btn-lg">Sign in <span className="lp-ar" aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (access === 'checking' || status === 'loading') {
    return <div data-page-loading><Loader label="Loading the admin dashboard" minHeight={420} /></div>;
  }

  if (access !== 'ok' || !data) {
    return (
      <>
        <PageHead kicker="Admin" title="Admin dashboard" />
        <div className="st-body">
          {access === 'forbidden' && <Empty title="This page is for administrators only">Your account does not have the admin role.</Empty>}
          {access === 'signin' && (
            <Empty title="Your session has ended" actions={<Link href="/auth/signin?callbackUrl=%2Fadmin" className="st-btn is-primary">Sign in again</Link>} />
          )}
          {access === 'error' && (
            <Note tone="bad" title="The dashboard did not load">
              {loadError} <button type="button" className="st-more ad-linkbtn" onClick={() => { setAccess('checking'); loadOverview(false); loadTraffic(); }}>Try again</button>
            </Note>
          )}
        </div>
      </>
    );
  }

  const stripeAt = data.billing.fetchedAt ? ` · Stripe ${clock(data.billing.fetchedAt)}` : '';

  return (
    <>
      <PageHead
        kicker="Admin"
        title="Admin dashboard"
        lead="Accounts, plans and revenue, who uses the Smart Router and how much they have left, and site traffic. Live from the databases and Stripe; our own accounts are left out of every total."
        actions={<>
          <button type="button" className="st-btn" onClick={refresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
          <Link href="/" className="st-btn is-quiet">Leave admin</Link>
        </>}
      >
        <p className="ad-meta">Updated {clock(data.generatedAt)}{stripeAt}</p>
      </PageHead>

      <div className="st-body">
        {loadError && <Note tone="bad" title="The last refresh failed">{loadError} The figures below are from {clock(data.generatedAt)}.</Note>}

        <nav className="st-tabs ad-tabs" id="ad-tabs" role="tablist" aria-label="Admin sections">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`ad-tab-${t.key}`}
              className="st-tab"
              aria-selected={tab === t.key}
              aria-controls="ad-panel"
              onClick={() => select(t.key)}
            >
              {t.label}
              {t.key === 'billing' && data.attention.some(a => a.tone === 'bad') && (
                <span className="ad-count" title="Billing problems">{data.attention.filter(a => a.tone === 'bad').length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="ad-panel" id="ad-panel" role="tabpanel" aria-labelledby={`ad-tab-${tab}`}>
          {tab === 'overview' && <OverviewTab data={data} visitors={visitors} go={go} />}
          {tab === 'billing' && <BillingTab data={data} />}
          {tab === 'router' && <RouterTab data={data} />}
          {tab === 'accounts' && <AccountsTab data={data} />}
          {tab === 'traffic' && (
            <TrafficTab visitors={visitors} recent={recent} onUpdateDaily={updateDailyStats} updating={updating} updateNote={updateNote} />
          )}
          {tab === 'tools' && (
            <ToolsTab onUpdateDaily={updateDailyStats} updating={updating} updateNote={updateNote} onRefresh={refresh} refreshing={refreshing} />
          )}
        </div>
      </div>
    </>
  );
}
