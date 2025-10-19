'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import PixelIcon from './PixelIcon';

interface SidebarItemProps {
  iconName: string;
  label: string;
  href: string;
  active: boolean;
  isCollapsed?: boolean;
}

function SidebarItem({ iconName, label, href, active, isCollapsed = false }: SidebarItemProps) {
  return (
    <a
      href={href}
      className={`sidebar-item ${active ? 'active' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 20px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        textDecoration: 'none',
        color: active ? 'var(--phosphor-green)' : 'var(--metal-silver)',
        backgroundColor: active ? 'rgba(0, 255, 65, 0.15)' : 'transparent',
        borderLeft: active ? '3px solid var(--phosphor-green)' : '3px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'rgba(0, 255, 65, 0.1)';
          e.currentTarget.style.borderLeft = '3px solid var(--phosphor-green)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.borderLeft = '3px solid transparent';
        }
      }}
    >
      <PixelIcon name={iconName} size={20} />
      {!isCollapsed && <span style={{ fontSize: '0.9em', fontWeight: active ? 'bold' : 'normal' }}>{label}</span>}
    </a>
  );
}

export default function RouterSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const navigationItems = [
    { iconName: 'arrow-left', label: '← Back to Rankings', href: '/', isExternal: true },
    { iconName: 'home', label: 'Dashboard', href: '/router' },
    { iconName: 'key', label: 'API Keys', href: '/router/keys' },
    { iconName: 'plug', label: 'Providers', href: '/router/providers' },
    { iconName: 'settings', label: 'Preferences', href: '/router/preferences' },
    { iconName: 'analytics', label: 'Analytics', href: '/router/analytics' },
    { iconName: 'brain', label: 'Model Intelligence', href: '/router/intelligence' },
    { iconName: 'test', label: 'Test Your Keys', href: '/router/test-keys' },
  ];

  const userItems = [
    { iconName: 'profile', label: 'Profile', href: '/router/profile' },
    { iconName: 'credit-card', label: 'Subscription', href: '/router/subscription' },
  ];

  const supportItems = [
    { iconName: 'help', label: 'Help', href: '/router/help' },
    { iconName: 'book', label: 'Docs', href: '/router/docs' },
  ];

  // Close drawer on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileDrawerOpen) {
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isMobileDrawerOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isMobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileDrawerOpen]);

  // Get display name with proper priority
  const getDisplayName = () => {
    if (session?.user?.name) return session.user.name;
    if (session?.user?.email) return session.user.email;
    return 'User';
  };

  // Only show email separately if we have both name and email
  const shouldShowEmail = () => {
    return session?.user?.name && session?.user?.email && session.user.name !== session.user.email;
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className="desktop-only"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: isCollapsed ? '60px' : '240px',
          backgroundColor: 'var(--terminal-black)',
          borderRight: '2px solid var(--metal-silver)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.3s ease',
          zIndex: 100,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* Logo/Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid var(--metal-silver)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
          }}
        >
          {!isCollapsed && (
            <div className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
              AI ROUTER
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--phosphor-green)',
              cursor: 'pointer',
              fontSize: '1.2em',
              padding: '4px',
            }}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? '→' : '←'}
          </button>
        </div>

        {/* Navigation Section */}
        <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          {!isCollapsed && (
            <div
              className="terminal-text--dim"
              style={{ padding: '0 20px 8px', fontSize: '0.75em', textTransform: 'uppercase', letterSpacing: '1px' }}
            >
              Navigation
            </div>
          )}
          {navigationItems.map((item) => (
            <SidebarItem
              key={item.href}
              iconName={item.iconName}
              label={item.label}
              href={item.href}
              active={pathname === item.href}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>

        {/* User Section */}
        <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          {!isCollapsed && (
            <div
              className="terminal-text--dim"
              style={{ padding: '0 20px 8px', fontSize: '0.75em', textTransform: 'uppercase', letterSpacing: '1px' }}
            >
              Account
            </div>
          )}
          {userItems.map((item) => (
            <SidebarItem
              key={item.href}
              iconName={item.iconName}
              label={item.label}
              href={item.href}
              active={pathname === item.href}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>

        {/* Support Section */}
        <div style={{ padding: '16px 0', flex: 1 }}>
          {!isCollapsed && (
            <div
              className="terminal-text--dim"
              style={{ padding: '0 20px 8px', fontSize: '0.75em', textTransform: 'uppercase', letterSpacing: '1px' }}
            >
              Support
            </div>
          )}
          {supportItems.map((item) => (
            <SidebarItem
              key={item.href}
              iconName={item.iconName}
              label={item.label}
              href={item.href}
              active={pathname === item.href}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>

        {/* User Info & Sign Out */}
        {session?.user && (
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--metal-silver)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {!isCollapsed && (
              <>
                <div 
                  className="terminal-text--green" 
                  style={{ 
                    fontSize: '0.85em', 
                    fontWeight: 'bold',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={getDisplayName()}
                >
                  {getDisplayName()}
                </div>
                {shouldShowEmail() && (
                  <div 
                    className="terminal-text--dim" 
                    style={{ 
                      fontSize: '0.75em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={session.user.email || undefined}
                  >
                    {session.user.email}
                  </div>
                )}
              </>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="vintage-btn vintage-btn--danger"
              style={{
                fontSize: '0.75em',
                padding: '6px 12px',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
              title={isCollapsed ? 'Sign Out' : undefined}
            >
              <PixelIcon name="logout" size={14} />
              {!isCollapsed && 'SIGN OUT'}
            </button>
          </div>
        )}
      </div>

      {/* Mobile: Hamburger Button */}
      <button
        className="mobile-only"
        onClick={() => setIsMobileDrawerOpen(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'var(--phosphor-green)',
          border: 'none',
          color: 'var(--terminal-black)',
          fontSize: '1.5em',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0, 255, 65, 0.4)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s ease',
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'scale(0.95)';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <PixelIcon name="menu" size={24} />
      </button>

      {/* Mobile: Drawer Overlay */}
      {isMobileDrawerOpen && (
        <div
          className="mobile-only"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 1000,
          }}
          onClick={() => setIsMobileDrawerOpen(false)}
        />
      )}

      {/* Mobile: Slide-out Drawer */}
      <div
        className="mobile-only"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '280px',
          maxWidth: '80vw',
          backgroundColor: 'var(--terminal-black)',
          borderRight: '2px solid var(--phosphor-green)',
          transform: isMobileDrawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* Drawer Header with User Info */}
        {session?.user && (
          <div
            style={{
              padding: '20px',
              borderBottom: '2px solid var(--phosphor-green)',
              backgroundColor: 'rgba(0, 255, 65, 0.1)',
            }}
          >
            <div 
              className="terminal-text--green" 
              style={{ 
                fontSize: '1em', 
                fontWeight: 'bold', 
                marginBottom: '4px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={getDisplayName()}
            >
              {getDisplayName()}
            </div>
            {shouldShowEmail() && (
              <div 
                className="terminal-text--dim" 
                style={{ 
                  fontSize: '0.8em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={session.user.email || undefined}
              >
                {session.user.email}
              </div>
            )}
          </div>
        )}

        {/* Navigation Section */}
        <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div
            className="terminal-text--dim"
            style={{ padding: '0 20px 8px', fontSize: '0.75em', textTransform: 'uppercase', letterSpacing: '1px' }}
          >
            Navigation
          </div>
          {navigationItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileDrawerOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 20px',
                cursor: 'pointer',
                textDecoration: 'none',
                color: pathname === item.href ? 'var(--phosphor-green)' : 'var(--metal-silver)',
                backgroundColor: pathname === item.href ? 'rgba(0, 255, 65, 0.15)' : 'transparent',
                borderLeft: pathname === item.href ? '3px solid var(--phosphor-green)' : '3px solid transparent',
                minHeight: '48px',
              }}
            >
              <PixelIcon name={item.iconName} size={22} />
              <span style={{ fontSize: '0.95em', fontWeight: pathname === item.href ? 'bold' : 'normal' }}>{item.label}</span>
            </a>
          ))}
        </div>

        {/* User Section */}
        <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div
            className="terminal-text--dim"
            style={{ padding: '0 20px 8px', fontSize: '0.75em', textTransform: 'uppercase', letterSpacing: '1px' }}
          >
            Account
          </div>
          {userItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileDrawerOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 20px',
                cursor: 'pointer',
                textDecoration: 'none',
                color: pathname === item.href ? 'var(--phosphor-green)' : 'var(--metal-silver)',
                backgroundColor: pathname === item.href ? 'rgba(0, 255, 65, 0.15)' : 'transparent',
                borderLeft: pathname === item.href ? '3px solid var(--phosphor-green)' : '3px solid transparent',
                minHeight: '48px',
              }}
            >
              <PixelIcon name={item.iconName} size={22} />
              <span style={{ fontSize: '0.95em', fontWeight: pathname === item.href ? 'bold' : 'normal' }}>{item.label}</span>
            </a>
          ))}
        </div>

        {/* Support Section */}
        <div style={{ padding: '16px 0', flex: 1 }}>
          <div
            className="terminal-text--dim"
            style={{ padding: '0 20px 8px', fontSize: '0.75em', textTransform: 'uppercase', letterSpacing: '1px' }}
          >
            Support
          </div>
          {supportItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileDrawerOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 20px',
                cursor: 'pointer',
                textDecoration: 'none',
                color: pathname === item.href ? 'var(--phosphor-green)' : 'var(--metal-silver)',
                backgroundColor: pathname === item.href ? 'rgba(0, 255, 65, 0.15)' : 'transparent',
                borderLeft: pathname === item.href ? '3px solid var(--phosphor-green)' : '3px solid transparent',
                minHeight: '48px',
              }}
            >
              <PixelIcon name={item.iconName} size={22} />
              <span style={{ fontSize: '0.95em', fontWeight: pathname === item.href ? 'bold' : 'normal' }}>{item.label}</span>
            </a>
          ))}
        </div>

        {/* Sign Out Button */}
        {session?.user && (
          <div style={{ padding: '16px 20px', borderTop: '2px solid var(--phosphor-green)' }}>
            <button
              onClick={() => {
                setIsMobileDrawerOpen(false);
                signOut({ callbackUrl: '/' });
              }}
              className="vintage-btn vintage-btn--danger"
              style={{
                fontSize: '0.9em',
                padding: '12px',
                width: '100%',
                minHeight: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <PixelIcon name="logout" size={18} />
              SIGN OUT
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @media (min-width: 768px) {
          .mobile-only {
            display: none !important;
          }
        }
        @media (max-width: 767px) {
          .desktop-only {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
