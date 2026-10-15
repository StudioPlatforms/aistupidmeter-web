'use client';

import { Suspense, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import { SignInForm, safeReturnPath } from './SignInForm';

export const dynamic = 'force-dynamic'; // critical - prevent static caching

function Busy({ text }: { text: string }) {
  return (
    <AuthShell mode="signin">
      <p className="au-busy" role="status">{text}</p>
    </AuthShell>
  );
}

function SignInContent() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const callbackUrl = safeReturnPath(searchParams.get('callbackUrl'));

  useEffect(() => {
    // Already signed in: go where they were heading (a hard redirect, so the session is loaded).
    if (status === 'authenticated') window.location.href = callbackUrl;
  }, [status, callbackUrl]);

  if (status === 'loading') return <Busy text="Checking your session…" />;
  if (status === 'authenticated') return <Busy text="Signed in — taking you there…" />;
  return <SignInForm />;
}

export default function SignInPage() {
  return (
    <Suspense fallback={<Busy text="Loading…" />}>
      <SignInContent />
    </Suspense>
  );
}
