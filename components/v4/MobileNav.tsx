'use client';

/**
 * Mobile navigation.
 *
 * The previous version was six items — HOME, ABOUT, FORUM, PRO, FAQ, theme —
 * sharing one row at `flex:1` and **9px** type. It was full: nothing built this
 * month (pricing, watchlist, account) could be added without shrinking labels
 * past legibility.
 *
 * So it is now three thumb targets plus a sheet. Watchlist earns a permanent
 * slot because it is the return-visit surface the whole retention case rests on;
 * About, Pricing, Forum and Theme are lower-frequency and live behind More.
 *
 * In the landing's look: a frosted bar, sentence case, the current page marked in the accent
 * with a slanted tab; More opens a bottom sheet. Styles: styles/studio-board.css (sb-mnav, sb-drawer).
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import ThemeButton from '../ThemeButton';
import { navClick } from '../AccountMenu';
import { PLANS, isPlan, isUnlimited, type Plan } from '@/lib/entitlements';
import { lpBody, lpDisplay } from '../../lib/fonts';
import '../../styles/landing.css';
import '../../styles/studio-board.css';

interface MobileNavProps {
  selectedView: string;
  onViewChange: (view: 'dashboard' | 'about' | 'faq') => void;
}

const ROOT = `st-tokens ${lpBody.variable} ${lpDisplay.variable}`;

export default function MobileNav({ selectedView, onViewChange }: MobileNavProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [drawer, setDrawer] = useState(false);

  // A drawer that stays open behind a route change is disorienting.
  useEffect(() => { if (drawer) document.body.style.overflow = 'hidden'; else document.body.style.overflow = ''; }, [drawer]);
  useEffect(() => () => { document.body.style.overflow = ''; }, []);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  const go = (href: string) => { setDrawer(false); router.push(href); };

  const authed = status === 'authenticated';
  const user = session?.user as any;
  const plan: Plan = isPlan(user?.plan) ? user.plan : 'free';
  const ent = PLANS[plan];
  const planLabel = plan === 'legacy_pro' ? 'Pro' : ent.label;
  const hasTeam = isUnlimited(ent.projects) || ent.projects >= 1;
  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  /** A sheet entry: a real link that closes the sheet and navigates like before. */
  const item = (label: string, href: string, onGo: () => void = () => go(href)) => (
    <a key={label} className="sb-drawer-item" href={href} onClick={navClick(onGo)}>{label}</a>
  );

  return (
    <>
      <nav className={`sb-mnav ${ROOT}`} aria-label="Primary">
        <a className="sb-mtab" href="/" aria-current={selectedView === 'dashboard' ? 'page' : undefined}
          onClick={navClick(() => onViewChange('dashboard'))}>Leaderboard</a>
        <a className="sb-mtab" href="/watchlist" aria-current={selectedView === 'watchlist' ? 'page' : undefined}
          onClick={navClick(() => go('/watchlist'))}>Watchlist</a>
        <a className="sb-mtab" href="/faq" aria-current={selectedView === 'faq' ? 'page' : undefined}
          onClick={navClick(() => onViewChange('faq'))}>FAQ</a>
        <button type="button" className="sb-mtab" aria-expanded={drawer} aria-controls="sb-more"
          onClick={() => setDrawer(d => !d)}>More</button>
      </nav>

      {drawer && (
        <div className={`sb-drawer-back ${ROOT}`} onClick={() => setDrawer(false)}>
          <div className="sb-drawer" id="sb-more" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="More">
            <span className="sb-drawer-grip" aria-hidden="true" />

            {authed && (
              <div className="sb-drawer-me">
                <span className="sb-av is-lg" aria-hidden="true">{initial}</span>
                <div>
                  <div className="sb-acct-mail">{user?.email}</div>
                  <div className="sb-acct-sub">{planLabel} plan</div>
                </div>
              </div>
            )}

            <div className="sb-drawer-group">
              {item('Pricing', '/pricing')}
              {item('About', '/about', () => { setDrawer(false); onViewChange('about'); })}
              {item('Compare models', '/compare')}
              {item('Methodology', '/methodology')}
              {/* The bottom bar stays at four items — a fifth shrinks every label, which is
                  why it was cut from six. Contact sits with the other header links instead. */}
              {item('Contact', '/contact')}
              {item('Forum', '/router/forum')}
            </div>

            {authed ? (
              <>
                <div className="sb-drawer-group">
                  {item('Account home', '/account')}
                  {item('Plan & billing', '/account/billing')}
                  {item('Settings', '/account/settings')}
                  {hasTeam && item('Team', '/account/team')}
                  {item('Smart Router', '/router')}
                </div>
                <div className="sb-drawer-group is-one">
                  <button type="button" className="sb-drawer-item is-muted" onClick={() => { setDrawer(false); signOut({ redirectTo: '/' }); }}>
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <div className="sb-drawer-group">
                {item('Sign in', '/auth/signin')}
                {item('Create free account', '/auth/signup')}
              </div>
            )}

            <div className="sb-drawer-theme">
              <span>Theme</span>
              <ThemeButton variant="row" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
