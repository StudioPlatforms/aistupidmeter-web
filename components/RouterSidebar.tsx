'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';

interface NavItem {
  label: string;
  href: string;
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

  const navItems: NavItem[] = [
    { label: '← BACK TO RANKINGS', href: '/' },
    { label: 'DASHBOARD', href: '/router' },
    { label: 'API KEYS', href: '/router/keys' },
    { label: 'PROVIDERS', href: '/router/providers' },
    { label: 'PREFERENCES', href: '/router/preferences' },
    { label: 'ANALYTICS', href: '/router/analytics' },
    { label: 'MODEL INTELLIGENCE', href: '/router/intelligence' },
    { label: 'PERFORMANCE TIMING', href: '/router/performance-timing' },
    { label: 'TEST KEYS', href: '/router/test-keys' },
  ];

  const userItems: NavItem[] = [
    { label: 'PROFILE', href: '/router/profile' },
    { label: 'SUBSCRIPTION', href: '/router/subscription' },
  ];

  const supportItems: NavItem[] = [
    { label: 'HELP', href: '/router/help' },
    { label: 'API DOCS', href: '/router/docs' },
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
          <span className="rv4-sidebar-brand">AI <em>ROUTER</em></span>
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

      {/* Navigation */}
      <div className="rv4-sidebar-section">
        {(!collapsed || isMobile) && (
          <div className="rv4-sidebar-section-label">Navigation</div>
        )}
        {navItems.map(item => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href}
            collapsed={collapsed && !isMobile}
            onClick={isMobile ? () => setMobileOpen(false) : undefined}
          />
        ))}
      </div>

      {/* Account */}
      <div className="rv4-sidebar-section">
        {(!collapsed || isMobile) && (
          <div className="rv4-sidebar-section-label">Account</div>
        )}
        {userItems.map(item => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href}
            collapsed={collapsed && !isMobile}
            onClick={isMobile ? () => setMobileOpen(false) : undefined}
          />
        ))}
      </div>

      {/* Support */}
      <div className="rv4-sidebar-section" style={{ flex: 1 }}>
        {(!collapsed || isMobile) && (
          <div className="rv4-sidebar-section-label">Support</div>
        )}
        {supportItems.map(item => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href}
            collapsed={collapsed && !isMobile}
            onClick={isMobile ? () => setMobileOpen(false) : undefined}
          />
        ))}
      </div>

      {/* User footer */}
      {session?.user && (
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
      )}
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
