'use client';

import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { PLANS, isPlan, isUnlimited, planMeets, type Plan } from '@/lib/entitlements';
import { REQUIRED_PLAN } from '@/lib/capabilities';
import { planName } from '@/lib/pricing-display';
import { THEMES, chooseTheme } from '@/lib/theme-config';

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  /** Pushes Support to the bottom of the rail. */
  grow?: boolean;
}

/** Flip to the other theme from the one on screen, and remember the choice (as the landing's Theme button). */
function toggleTheme() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = THEMES.findIndex(t => t.isLight === dark);
  if (next >= 0) chooseTheme(next);
}

/**
 * The kicker over each page's title: which part of the app this is. Matches the nav groups below;
 * pages without a nav entry of their own (a project, a forum thread, an invite) take their parent's.
 */
const SECTIONS: Array<[RegExp, string]> = [
  [/^\/account\/(team|security)(\/|$)/, 'Team'],
  [/^\/account\/data-keys(\/|$)/, 'Data API'],
  [/^\/account\/invite(\/|$)/, 'Team'],
  [/^\/account(\/|$)/, 'Account'],
  [/^\/(watchlist|router\/intelligence)(\/|$)/, 'Monitoring'],
  [/^\/router\/forum(\/|$)/, 'Community'],
  [/^\/router\/(help|docs)(\/|$)/, 'Support'],
  [/^\/router(\/|$)/, 'Smart Router'],
];

export function sectionFor(pathname: string | null): string | null {
  if (!pathname) return null;
  return SECTIONS.find(([re]) => re.test(pathname))?.[1] ?? null;
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  // Pages under a nav entry (a project, a forum thread) keep that entry lit.
  return (href === '/account/team' || href === '/router/forum') && pathname.startsWith(`${href}/`);
}

export default function RouterSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isGuest = !session?.user;
  const isForumPage = pathname?.startsWith('/router/forum');

  // Guest on forum page — show minimal sidebar
  const guestForumMode = isGuest && isForumPage;

  const userRole = (session?.user as any)?.role;
  const isForumAdmin = userRole === 'admin' || userRole === 'superadmin';

  const plan: Plan = isPlan((session?.user as any)?.plan) ? (session!.user as any).plan : 'free';
  const projects = PLANS[plan].projects;
  // In a workspace (any role, viewers included), or on a plan that can make one.
  const workspace = (session?.user as any)?.workspace as { role: string; name: string } | null | undefined;
  const hasTeam = isUnlimited(projects) || projects >= 1 || !!workspace;
  const hasGovernance = planMeets(plan, REQUIRED_PLAN.governance) && (!workspace || workspace.role === 'owner');

  /**
   * Grouped rather than one flat list of twelve.
   *
   * Monitoring comes first deliberately: a subscriber who never routes a request
   * still needs somewhere to land, and under the new pricing most of them will
   * be here for the watchlist rather than the proxy. Routing is a section, not
   * the whole product.
   */
  const groups: NavGroup[] = guestForumMode
    ? [{ label: 'Navigation', items: [
        { label: 'Leaderboard', href: '/' },
        { label: 'Forum', href: '/router/forum' },
      ] }]
    : [
        { label: 'Overview', items: [
          { label: 'Leaderboard', href: '/' },
          { label: 'Account home', href: '/account' },
        ] },
        { label: 'Monitoring', items: [
          { label: 'Watchlist', href: '/watchlist' },
          { label: 'Model intelligence', href: '/router/intelligence' },
        ] },
        { label: 'Smart Router', items: [
          { label: 'Dashboard', href: '/router' },
          { label: 'Router API keys', href: '/router/keys' },
          { label: 'Provider keys', href: '/router/providers' },
          { label: 'Routing preferences', href: '/router/preferences' },
          { label: 'Analytics', href: '/router/analytics' },
          { label: 'API monitoring', href: '/router/monitoring' },
          { label: 'Performance timing', href: '/router/performance-timing' },
          { label: 'Test your keys', href: '/router/test-keys' },
        ] },
        { label: 'Data API', items: [
          { label: 'Data API keys', href: '/account/data-keys' },
        ] },
        ...(hasTeam ? [{ label: 'Team', items: [
          { label: 'Workspace', href: '/account/team' },
          ...(hasGovernance ? [{ label: 'Security', href: '/account/security' }] : []),
        ] }] : []),
        { label: 'Account', items: [
          { label: 'Settings', href: '/account/settings' },
          { label: 'Plan & billing', href: '/account/billing' },
        ] },
        { label: 'Community', items: [
          { label: 'Forum', href: '/router/forum' },
          ...(isForumAdmin ? [{ label: 'Forum admin', href: '/router/forum/admin' }] : []),
        ] },
        { label: 'Support', grow: true, items: [
          { label: 'Help', href: '/router/help' },
          { label: 'API docs', href: '/router/docs' },
        ] },
      ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Pages low in the menu (Settings, Billing, Help) would otherwise open with their own entry
  // hidden under the rail's bottom fade.
  useEffect(() => {
    const nav = document.querySelector('.st-side .st-nav') as HTMLElement | null;
    const on = nav?.querySelector('.st-link.is-on') as HTMLElement | null;
    if (!nav || !on) return;
    const top = on.offsetTop - nav.offsetTop;
    if (top + on.offsetHeight > nav.scrollTop + nav.clientHeight - 32 || top < nav.scrollTop) {
      nav.scrollTop = Math.max(0, top - nav.clientHeight / 2 + on.offsetHeight / 2);
    }
  }, [pathname, session?.user]);

  // The sheet covers the page; a navigation (or growing past the breakpoint) must not leave it open.
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => { if (mq.matches) setMobileOpen(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const displayName = session?.user?.name || session?.user?.email || 'User';
  const showEmail = session?.user?.name && session?.user?.email && session.user.name !== session.user.email;
  const nameInitial = displayName.charAt(0).toUpperCase();
  const here = groups.flatMap(g => g.items).find(i => isActive(pathname, i.href))?.label ?? sectionFor(pathname) ?? 'Account';

  const brand = (
    <a className="st-brand" href="/" aria-label="AI Stupid Level — leaderboard">
      <img className="st-mk-l" src="/asl-mark.png" alt="AI Stupid Level" width={754} height={160} />
      <img className="st-mk-d" src="/asl-mark-dark.png" alt="" width={754} height={160} />
    </a>
  );

  const nav = (isMobile: boolean) => (
    <nav className="st-nav" aria-label="Account">
      {groups.map(group => (
        <div key={group.label} className={`st-group${group.grow ? ' is-grow' : ''}`}>
          <div className="st-group-label">{group.label}</div>
          {group.items.map(item => {
            const active = isActive(pathname, item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                className={`st-link${active ? ' is-on' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={isMobile ? () => setMobileOpen(false) : undefined}
              >
                {item.label}
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const me = session?.user ? (
    <div className="st-me">
      <div className="st-me-id">
        <span className="st-avatar" aria-hidden="true">{nameInitial}</span>
        <div style={{ minWidth: 0 }}>
          <div className="st-me-name" title={displayName}>{displayName}</div>
          {showEmail && <div className="st-me-mail" title={session.user.email || undefined}>{session.user.email}</div>}
        </div>
      </div>
      <div className="st-me-plan">
        <span>{planName(plan)} plan</span>
        {plan === 'free' ? <a href="/pricing">Upgrade</a> : <a href="/account/billing">Manage</a>}
      </div>
      <div className="st-me-act">
        <button type="button" onClick={toggleTheme}>Theme</button>
        <button type="button" onClick={() => signOut({ callbackUrl: '/' })}>Sign out</button>
      </div>
    </div>
  ) : guestForumMode ? (
    <div className="st-me st-me-guest">
      <p>Sign in to join discussions</p>
      <a className="st-btn is-primary is-block" href="/auth/signin?callbackUrl=/router/forum">Sign in</a>
      <a className="st-btn is-block" href="/auth/signup?callbackUrl=/router/forum">Create account</a>
    </div>
  ) : null;

  return (
    <>
      {/* Desktop rail */}
      <aside className="st-side">
        <div className="st-side-top">{brand}</div>
        {nav(false)}
        {me}
      </aside>

      {/* Phones and tablets: frosted top bar + full-height menu sheet, as on the landing page */}
      <header className="st-top">
        {brand}
        <div className="st-top-here"><span>{here}</span></div>
        <button
          type="button"
          className="st-burger"
          aria-expanded={mobileOpen}
          aria-controls="st-sheet"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileOpen(o => !o)}
        >
          <i />
        </button>
      </header>
      {mobileOpen && (
        <div className="st-sheet" id="st-sheet">
          {nav(true)}
          {me}
        </div>
      )}
    </>
  );
}
