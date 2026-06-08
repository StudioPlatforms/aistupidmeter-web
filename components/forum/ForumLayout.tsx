'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import RouterLayout from '@/components/RouterLayout';
import '@/styles/forum-v4.css';

interface ForumLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export default function ForumLayout({ children, title = 'FORUM', subtitle }: ForumLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const initCalledRef = useRef(false);

  // If authenticated user has no forum username and isn't on setup page, redirect
  useEffect(() => {
    if (
      status === 'authenticated' &&
      session?.user &&
      !(session.user as any).forumUsername &&
      pathname !== '/router/forum/setup-username'
    ) {
      router.push('/router/forum/setup-username');
    }
  }, [status, session, pathname, router]);

  // Call /api/forum/init once on first load to ensure DB is initialized
  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    fetch('/api/forum/init', { method: 'POST' }).catch(() => {
      // Silently ignore init errors
    });
  }, []);

  if (status === 'loading') {
    return (
      <RouterLayout>
        <div className="rv4-loading" style={{ minHeight: '300px' }}>
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <span>LOADING FORUM</span>
        </div>
      </RouterLayout>
    );
  }

  const isGuest = !session?.user;

  return (
    <RouterLayout>
      {/* Page header */}
      <div className="rv4-page-header">
        <div className="rv4-page-header-left">
          <div>
            <div className="rv4-page-title">
              {title}
              <span className="blinking-cursor"></span>
            </div>
            {subtitle && (
              <div className="rv4-page-title-sub">{subtitle}</div>
            )}
          </div>
        </div>
      </div>

      <div className="rv4-body">
        {children}
      </div>
    </RouterLayout>
  );
}
