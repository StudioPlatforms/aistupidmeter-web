'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { PLANS, isPlan, isUnlimited, type Plan } from '@/lib/entitlements';

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

function NavLink({ item, active, collapsed, onClick }: { item: NavItem; active: boolean; collapsed: boolean; onClick?: () => void }) {
  return (
    <a
      href={item.href}
      onClick={onClick}
      className={`rv4-nav-item${active ? ' active' : ''}`}
      title={collapsed ? item.label : undefined}
    >
      {!collapsed && (
        <span className="rv4-nav-item-label">{item.label}</span>
      )}
      {collapsed && (
        <span className="rv4-nav-item-label" style={{ fontSize: '10px', letterSpacing: '0.3px' }}>
          {item.label.substring(0, 2).toUpperCase()}
        </span>
      )}
    </a>
  );
}

export default function RouterSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isGuest = !session?.user;
  const isForumPage = pathname?.startsWith('/router/forum');

  // Guest on forum page — show minimal sidebar
  const guestForumMode = isGuest && isForumPage;

  const userRole = (session?.user as any)?.role;
  const isForumAdmin = userRole === 'admin' || userRole === 'superadmin';

  const plan: Plan = isPlan((session?.user as any)?.plan) ? (session!.user as any).plan : 'free';
  const seats = PLANS[plan].seats;
  const hasTeam = isUnlimited(seats) || seats > 1;

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
        { label: '← BACK TO RANKINGS', href: '/' },
        { label: 'FORUM', href: '/router/forum' },
      ] }]
    : [
        { label: 'Overview', items: [
          { label: '← BACK TO RANKINGS', href: '/' },
          { label: 'ACCOUNT HOME', href: '/account' },
        ] },
        { label: 'Monitoring', items: [
          { label: '★ WATCHLIST', href: '/watchlist' },
          { label: 'MODEL INTELLIGENCE', href: '/router/intelligence' },
        ] },
        { label: 'Routing', items: [
          { label: 'DASHBOARD', href: '/router' },
          { label: 'SR API KEY', href: '/router/keys' },
          { label: 'PROVIDERS', href: '/router/providers' },
          { label: 'ROUTING PREFERENCES', href: '/router/preferences' },
          { label: 'ANALYTICS', href: '/router/analytics' },
          { label: 'API MONITORING', href: '/router/monitoring' },
          { label: 'PERFORMANCE TIMING', href: '/router/performance-timing' },
          { label: 'TEST KEYS', href: '/router/test-keys' },
        ] },
        { label: 'Data API', items: [
          { label: 'DATA API KEYS', href: '/account/data-keys' },
        ] },
        ...(hasTeam ? [{ label: 'Team', items: [
          { label: 'WORKSPACE', href: '/account/team' },
        ] }] : []),
        { label: 'Account', items: [
          { label: 'SETTINGS', href: '/account/settings' },
          { label: 'PLAN & BILLING', href: '/account/billing' },
        ] },
        { label: 'Community', items: [
          { label: 'FORUM', href: '/router/forum' },
          ...(isForumAdmin ? [{ label: 'FORUM ADMIN', href: '/router/forum/admin' }] : []),
        ] },
        { label: 'Support', grow: true, items: [
          { label: 'HELP', href: '/router/help' },
          { label: 'API DOCS', href: '/router/docs' },
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

  const displayName = session?.user?.name || session?.user?.email || 'User';
  const showEmail = session?.user?.name && session?.user?.email && session.user.name !== session.user.email;
  const nameInitial = displayName.charAt(0).toUpperCase();

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {/* Logo header */}
      <div className="rv4-sidebar-logo">
        {(!collapsed || isMobile) && (
          <span className="rv4-sidebar-brand">ASL <em>ACCOUNT</em></span>
        )}
        {!isMobile && (
          <button
            className="rv4-sidebar-collapse"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '→' : '←'}
          </button>
        )}
        {isMobile && (
          <button className="rv4-sidebar-collapse" onClick={() => setMobileOpen(false)}>
            ×
          </button>
        )}
      </div>

      {/* One render for every group — five near-identical blocks were how the
          flat list survived so long. */}
      {groups.map(group => (
        <div
          key={group.label}
          className="rv4-sidebar-section"
          style={group.grow ? { flex: 1 } : undefined}
        >
          {(!collapsed || isMobile) && (
            <div className="rv4-sidebar-section-label">{group.label}</div>
          )}
          {group.items.map(item => (
            <NavLink
              key={item.href}
              item={item}
              active={pathname === item.href}
              collapsed={collapsed && !isMobile}
              onClick={isMobile ? () => setMobileOpen(false) : undefined}
            />
          ))}
        </div>
      ))}
      {!groups.some(g => g.grow) && <div style={{ flex: 1 }} />}

      {/* User footer */}
      {session?.user ? (
        <div className="rv4-sidebar-footer">
          {(!collapsed || isMobile) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'var(--phosphor-green)', color: 'var(--terminal-black)',
                fontSize: '13px', fontWeight: 'bold',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {nameInitial}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="rv4-sidebar-user-name" title={displayName}>{displayName}</div>
                {showEmail && (
                  <div className="rv4-sidebar-user-email" title={session.user.email || undefined}>
                    {session.user.email}
                  </div>
                )}
              </div>
            </div>
          )}
          <button
            className="rv4-sidebar-signout"
            onClick={() => signOut({ callbackUrl: '/' })}
            title={collapsed && !isMobile ? 'Sign Out' : undefined}
          >
            {(!collapsed || isMobile) ? '← SIGN OUT' : '←'}
          </button>
        </div>
      ) : guestForumMode ? (
        <div className="rv4-sidebar-footer" style={{ gap: '6px' }}>
          {(!collapsed || isMobile) && (
            <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', marginBottom: '4px' }}>
              Sign in to join discussions
            </div>
          )}
          <a
            href="/auth/signin?callbackUrl=/router/forum"
            className="rv4-sidebar-signout"
            style={{ textDecoration: 'none', textAlign: 'center', background: 'var(--phosphor-green)', color: 'var(--terminal-black)', fontWeight: 'bold' }}
          >
            {(!collapsed || isMobile) ? 'SIGN IN' : '→'}
          </a>
          <a
            href="/auth/signup?callbackUrl=/router/forum"
            className="rv4-sidebar-signout"
            style={{ textDecoration: 'none', textAlign: 'center' }}
          >
            {(!collapsed || isMobile) ? 'CREATE ACCOUNT' : '+'}
          </a>
        </div>
      ) : null}
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={`rv4-sidebar${collapsed ? ' collapsed' : ''}`}
        style={{ display: 'none' }}
        id="rv4-desktop-sidebar"
      >
        <SidebarContent />
      </div>

      {/* Mobile FAB */}
      <button
        className="rv4-mobile-menu-btn"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.1em' }}
      >
        ≡
      </button>

      {/* Mobile backdrop */}
      <div
        className={`rv4-mobile-drawer-backdrop${mobileOpen ? ' open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile drawer */}
      <div className={`rv4-mobile-drawer${mobileOpen ? ' open' : ''}`}>
        <SidebarContent isMobile />
      </div>

      <style jsx global>{`
        @media (min-width: 768px) {
          #rv4-desktop-sidebar {
            display: flex !important;
          }
          .rv4-mobile-menu-btn {
            display: none !important;
          }
          .rv4-mobile-drawer,
          .rv4-mobile-drawer-backdrop {
            display: none !important;
          }
          .rv4-content {
            margin-left: 240px;
          }
        }
        @media (max-width: 767px) {
          #rv4-desktop-sidebar {
            display: none !important;
          }
          .rv4-mobile-drawer {
            display: flex !important;
          }
          .rv4-content {
            margin-left: 0 !important;
          }
        }
      `}</style>
    </>
  );
}
