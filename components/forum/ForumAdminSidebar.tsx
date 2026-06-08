'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface ForumAdminSidebarProps {
  currentPath: string;
}

export default function ForumAdminSidebar({ currentPath }: ForumAdminSidebarProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || 'user';
  const isAdmin = role === 'admin' || role === 'superadmin';

  const tabs = [
    { label: 'Dashboard', path: '/router/forum/admin' },
    { label: 'Categories', path: '/router/forum/admin/categories' },
    { label: 'Reports', path: '/router/forum/admin/reports' },
    ...(isAdmin ? [{ label: 'Users', path: '/router/forum/admin/users' }] : []),
  ];

  const isActive = (tabPath: string) => {
    if (tabPath === '/router/forum/admin') {
      return currentPath === '/router/forum/admin';
    }
    return currentPath.startsWith(tabPath);
  };

  return (
    <div className="rv4-tabs" style={{ marginBottom: '16px' }}>
      {tabs.map((tab) => (
        <button
          key={tab.path}
          className={`rv4-tab${isActive(tab.path) ? ' active' : ''}`}
          onClick={() => router.push(tab.path)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
