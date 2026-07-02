'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SharePage() {
  const router = useRouter();

  useEffect(() => {
    // Delay redirect to allow crawlers to read meta tags
    const timer = setTimeout(() => {
      router.replace('/');
    }, 1000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'monospace',
      background: '#f6f8fc',
      color: '#1a73e8'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '16px' }}>
          Preparing your share preview…
        </div>
        <div style={{ fontSize: '14px', opacity: 0.7 }}>
          Redirecting to homepage...
        </div>
      </div>
      <noscript>
        <meta httpEquiv="refresh" content="1; url=/" />
      </noscript>
    </main>
  );
}
