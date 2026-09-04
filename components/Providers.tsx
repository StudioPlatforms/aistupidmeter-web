'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

// Imported for its side effect: installs the fetch wrapper that attaches the
// site's short-lived origin token to its own data requests. It self-installs at
// module scope, which is the only point early enough to catch the first data
// request of the first paint — a useEffect here runs too late, because React
// runs child effects before parent ones.
import '@/lib/asl-token';

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
