'use client';

/**
 * The header's account control.
 *
 * Replaces the old `PRO` button, which said nothing about who you were or whether
 * you were signed in — the header looked identical logged in or out, and the only
 * way to reach an account page was to guess that "PRO" meant one.
 *
 * Signed out it is a plain Sign in button. Signed in it is a menu, and the menu is
 * where everything built this month becomes reachable: watchlist, plan, settings,
 * team.
 */

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PLANS, isPlan, isUnlimited, type Plan } from '@/lib/entitlements';

interface Item { label: string; href?: string; onClick?: () => void; muted?: boolean }

export default function AccountMenu() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  // Render nothing rather than flashing "Sign in" at a user who is signed in.
  if (status === 'loading') return <span className="v4-account-placeholder" aria-hidden="true" />;

  if (status !== 'authenticated') {
    return (
      <button className="v4-nav-btn v4-signin-btn" onClick={() => router.push('/auth/signin')}>
        SIGN IN
      </button>
    );
  }

  const user = session!.user as any;
  const plan: Plan = isPlan(user?.plan) ? user.plan : 'free';
  const ent = PLANS[plan];
  // "Pro (legacy)" is never shown to the customer — see uiplan.md §5.1. They hold
  // more than the current Pro plan, and a legacy label reads as a demotion.
  const planLabel = plan === 'legacy_pro' ? 'Pro' : ent.label;
  const hasTeam = isUnlimited(ent.projects) || ent.projects >= 1;

  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  const items: Item[] = [
    { label: 'Account home', href: '/account' },
    { label: 'Watchlist', href: '/watchlist' },
    { label: 'Plan & billing', href: '/account/billing' },
    { label: 'Settings', href: '/account/settings' },
    ...(hasTeam ? [{ label: 'Team', href: '/account/team' }] : []),
    { label: 'Smart Router', href: '/router' },
    { label: 'Sign out', onClick: () => signOut({ redirectTo: '/' }), muted: true },
  ];

  return (
    <div className="v4-account" ref={ref}>
      <button
        className="v4-account-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user?.email ?? 'Account'}
      >
        <span className="v4-account-avatar">{initial}</span>
        <span className="v4-account-plan">{planLabel}</span>
      </button>

      {open && (
        <div className="v4-account-menu" role="menu">
          <div className="v4-account-menu-head">
            <div className="v4-account-menu-email">{user?.email}</div>
            <div className="v4-account-menu-sub">{planLabel} plan</div>
          </div>
          {items.map(it => (
            <button
              key={it.label}
              role="menuitem"
              className={`v4-account-menu-item${it.muted ? ' muted' : ''}`}
              onClick={() => {
                setOpen(false);
                if (it.onClick) it.onClick();
                else if (it.href) router.push(it.href);
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
