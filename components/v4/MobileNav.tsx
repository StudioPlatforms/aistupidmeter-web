'use client';

/**
 * Mobile navigation.
 *
 * The previous version was six items — HOME, ABOUT, FORUM, PRO, FAQ, theme —
 * sharing one row at `flex:1` and **9px** type. It was full: nothing built this
 * month (pricing, watchlist, account) could be added without shrinking labels
 * past legibility.
 *
 * So it is now three thumb targets plus a drawer. Watchlist earns a permanent
 * slot because it is the return-visit surface the whole retention case rests on;
 * About, Pricing, Forum and Theme are lower-frequency and live behind MORE.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import ThemeButton from '../ThemeButton';
import { PLANS, isPlan, isUnlimited, type Plan } from '@/lib/entitlements';

interface MobileNavProps {
  selectedView: string;
  onViewChange: (view: 'dashboard' | 'about' | 'faq') => void;
}

export default function MobileNav({ selectedView, onViewChange }: MobileNavProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [drawer, setDrawer] = useState(false);

  // A drawer that stays open behind a route change is disorienting.
  useEffect(() => { if (drawer) document.body.style.overflow = 'hidden'; else document.body.style.overflow = ''; }, [drawer]);
  useEffect(() => () => { document.body.style.overflow = ''; }, []);

  const go = (href: string) => { setDrawer(false); router.push(href); };

  const authed = status === 'authenticated';
  const user = session?.user as any;
  const plan: Plan = isPlan(user?.plan) ? user.plan : 'free';
  const ent = PLANS[plan];
  const planLabel = plan === 'legacy_pro' ? 'Pro' : ent.label;
  const hasTeam = isUnlimited(ent.projects) || ent.projects >= 1;

  const btn = (label: string, active: boolean, onClick: () => void, accent?: string) => (
    <button
      onClick={onClick}
      className="vintage-btn"
      style={{
        flex: 1, minHeight: '42px', fontSize: '10px', padding: '8px 4px', borderRadius: '4px',
        ...(accent ? { borderColor: accent, color: accent } : {}),
        ...(active ? { background: 'var(--phosphor-green)', color: 'var(--terminal-black)' } : {}),
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="v4-mobile-nav">
        {btn('HOME', selectedView === 'dashboard', () => onViewChange('dashboard'))}
        {btn('★ WATCH', selectedView === 'watchlist', () => go('/watchlist'))}
        {btn('FAQ', selectedView === 'faq', () => onViewChange('faq'))}
        {btn('☰ MORE', drawer, () => setDrawer(d => !d))}
      </div>

      {drawer && (
        <div className="v4-drawer-scrim" onClick={() => setDrawer(false)}>
          <div className="v4-drawer" onClick={e => e.stopPropagation()} role="dialog" aria-label="More">
            <div className="v4-drawer-grip" />

            {authed && (
              <div className="v4-drawer-head">
                <div className="v4-drawer-email">{user?.email}</div>
                <div className="v4-drawer-plan">{planLabel} plan</div>
              </div>
            )}

            <button className="v4-drawer-item" onClick={() => go('/pricing')}>Pricing</button>
            <button className="v4-drawer-item" onClick={() => { setDrawer(false); onViewChange('about'); }}>About</button>
            <button className="v4-drawer-item" onClick={() => go('/compare')}>Compare models</button>
            <button className="v4-drawer-item" onClick={() => go('/methodology')}>Methodology</button>
            <button className="v4-drawer-item" onClick={() => go('/router/forum')} style={{ color: 'var(--amber-warning)' }}>Forum</button>

            {authed ? (
              <>
                <div className="v4-drawer-sep" />
                <button className="v4-drawer-item" onClick={() => go('/account')}>Account home</button>
                <button className="v4-drawer-item" onClick={() => go('/account/billing')}>Plan &amp; billing</button>
                <button className="v4-drawer-item" onClick={() => go('/account/settings')}>Settings</button>
                {hasTeam && <button className="v4-drawer-item" onClick={() => go('/account/team')}>Team</button>}
                <button className="v4-drawer-item" onClick={() => go('/router')}>Smart Router</button>
                <div className="v4-drawer-sep" />
                <button className="v4-drawer-item muted" onClick={() => { setDrawer(false); signOut({ redirectTo: '/' }); }}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <div className="v4-drawer-sep" />
                <button className="v4-drawer-item" onClick={() => go('/auth/signin')}>Sign in</button>
                <button className="v4-drawer-item" onClick={() => go('/auth/signup')}>Create free account</button>
              </>
            )}

            <div className="v4-drawer-sep" />
            <div className="v4-drawer-theme">
              <span>Theme</span>
              <ThemeButton />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
