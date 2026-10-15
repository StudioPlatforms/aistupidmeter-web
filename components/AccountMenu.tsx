'use client';

/**
 * The header's account control.
 *
 * Replaces the old `PRO` button, which said nothing about who you were or whether
 * you were signed in — the header looked identical logged in or out, and the only
 * way to reach an account page was to guess that "PRO" meant one.
 *
 * Signed out it is Sign in plus the landing's Sign up free. Signed in it is a menu, and the
 * menu is where everything built this month becomes reachable: watchlist, plan, settings,
 * team. Styles: styles/studio-board.css (sb-acct-*), loaded by the top bar.
 */

import { Fragment, useState, useRef, useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PLANS, isPlan, isUnlimited, type Plan } from '@/lib/entitlements';

/**
 * Real links for the site chrome (open in a new tab, copy the address) that still navigate the
 * way the old buttons did: a plain click runs the page's own handler instead of a full page load.
 * Shared by the top bar and the phone bottom bar.
 */
export function navClick(handler: () => void) {
  return (e: ReactMouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    handler();
  };
}

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
  if (status === 'loading') return <span className="sb-acct-ph" aria-hidden="true" />;

  if (status !== 'authenticated') {
    return (
      <span className="sb-auth">
        <a className="sb-quiet" href="/auth/signin" onClick={navClick(() => router.push('/auth/signin'))}>Sign in</a>
        <a className="sb-cta" href="/auth/signup" onClick={navClick(() => router.push('/auth/signup'))}>Sign up free</a>
      </span>
    );
  }

  const user = session!.user as any;
  const plan: Plan = isPlan(user?.plan) ? user.plan : 'free';
  const ent = PLANS[plan];
  // "Pro (legacy)" is never shown to the customer — see uiplan.md §5.1. They hold
  // more than the current Pro plan, and a legacy label reads as a demotion.
  const planLabel = plan === 'legacy_pro' ? 'Pro' : ent.label;
  const hasTeam = isUnlimited(ent.projects) || ent.projects >= 1 || !!user?.workspace;

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
    <div className="sb-acct" ref={ref}>
      <button
        type="button"
        className="sb-acct-btn"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user?.email ?? 'Account'}
      >
        <span className="sb-av" aria-hidden="true">{initial}</span>
        <span className="sb-acct-plan">{planLabel}</span>
        <span className="sb-chev" aria-hidden="true" />
      </button>

      {open && (
        <div className="sb-acct-menu" role="menu" aria-label="Account">
          <div className="sb-acct-head">
            <span className="sb-av is-lg" aria-hidden="true">{initial}</span>
            <div>
              <div className="sb-acct-mail">{user?.email}</div>
              <div className="sb-acct-sub">{planLabel} plan</div>
            </div>
          </div>
          {items.map(it => (
            <Fragment key={it.label}>
              {it.muted && <div className="sb-acct-sep" role="separator" />}
              <button
                type="button"
                role="menuitem"
                className={`sb-acct-item${it.muted ? ' is-muted' : ''}`}
                onClick={() => {
                  setOpen(false);
                  if (it.onClick) it.onClick();
                  else if (it.href) router.push(it.href);
                }}
              >
                {it.label}
              </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
