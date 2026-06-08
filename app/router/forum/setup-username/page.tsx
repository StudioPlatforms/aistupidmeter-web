'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import RouterLayout from '@/components/RouterLayout';
import UsernameSetup from '@/components/forum/UsernameSetup';
import '@/styles/forum-v4.css';

export default function SetupUsernamePage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // If user already has a forum username, redirect to forum
  useEffect(() => {
    if (status === 'authenticated' && session?.user && (session.user as any).forumUsername) {
      router.push('/router/forum');
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return (
      <RouterLayout>
        <div className="rv4-loading" style={{ minHeight: '300px' }}>
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <div className="rv4-loading-dot" />
          <span>LOADING</span>
        </div>
      </RouterLayout>
    );
  }

  if (!session?.user) return null;

  const handleComplete = async (username: string) => {
    // Trigger session refresh so forumUsername is picked up
    await update();
    router.push('/router/forum');
  };

  return (
    <RouterLayout>
      {/* Page header */}
      <div className="rv4-page-header">
        <div className="rv4-page-header-left">
          <div>
            <div className="rv4-page-title">
              FORUM SETUP<span className="blinking-cursor"></span>
            </div>
            <div className="rv4-page-title-sub">Create your forum identity</div>
          </div>
        </div>
      </div>

      <div className="rv4-body">
        <UsernameSetup onComplete={handleComplete} />
      </div>
    </RouterLayout>
  );
}
