'use client';

import { Suspense, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SignInForm } from './SignInForm';

export const dynamic = 'force-dynamic'; // critical - prevent static caching

function SignInContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/router';

  useEffect(() => {
    // If user is authenticated, redirect to callback URL
    if (status === 'authenticated') {
      router.push(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  // Show loading while checking session
  if (status === 'loading') {
    return (
      <div className="vintage-container" style={{ maxWidth: '500px', margin: '0 auto', paddingTop: '60px' }}>
        <div className="crt-monitor">
          <div className="terminal-text" style={{ textAlign: 'center' }}>
            <div className="terminal-text--green">
              CHECKING AUTHENTICATION<span className="vintage-loading"></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated, show redirecting message
  if (status === 'authenticated') {
    return (
      <div className="vintage-container" style={{ maxWidth: '500px', margin: '0 auto', paddingTop: '60px' }}>
        <div className="crt-monitor">
          <div className="terminal-text" style={{ textAlign: 'center' }}>
            <div className="terminal-text--green">
              REDIRECTING<span className="vintage-loading"></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <SignInForm />;
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="vintage-container" style={{ maxWidth: '500px', margin: '0 auto', paddingTop: '60px' }}>
        <div className="crt-monitor">
          <div className="terminal-text" style={{ textAlign: 'center' }}>
            <div className="terminal-text--green">
              LOADING<span className="vintage-loading"></span>
            </div>
          </div>
        </div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
