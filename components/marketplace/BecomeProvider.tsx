'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useSession } from 'next-auth/react';

/** Where a provider account starts: signed out, sign up with the provider switch preset; signed in, the set-up page. */
export const PROVIDER_SIGNUP = '/auth/signup?as=provider&callbackUrl=%2Faccount%2Fprovider%2Fnew';
export const PROVIDER_START = '/account/provider/new';

/**
 * The opening page's "Become a provider" (M12, the web and legal review MINOR-9): a visitor who is signed in goes
 * straight to the create step instead of the sign-up form. The page is rendered on the server for everyone, so the link
 * starts as the sign-up one and changes once the session is known in the browser.
 */
export default function BecomeProvider({ className, cta, children }: { className: string; cta: string; children: ReactNode }) {
  const { status } = useSession();
  return <Link className={className} href={status === 'authenticated' ? PROVIDER_START : PROVIDER_SIGNUP} data-cta={cta}>{children}</Link>;
}
