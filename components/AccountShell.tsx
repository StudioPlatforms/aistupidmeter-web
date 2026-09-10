'use client';

/**
 * Chrome for signed-in account pages.
 *
 * WHY THIS EXISTS
 * ---------------
 * The account area grew two different layouts. /router/* and /account/data-keys
 * used RouterLayout, which carries the sidebar; the newer /account/settings,
 * /account/billing, /account/team and /watchlist used SubpageLayout, which does
 * not. So clicking "Settings" from inside the router area made the entire
 * sidebar vanish — the navigation disappeared exactly when someone was
 * navigating.
 *
 * Signed in, every account surface now gets the sidebar. Signed out, these pages
 * still need to render (they show a sign-in prompt, and /watchlist shows a real
 * pitch), so a guest gets the public header instead — showing a logged-out
 * visitor a workspace sidebar full of links they cannot use would be worse than
 * either option.
 */

import { useSession } from 'next-auth/react';
import RouterLayout from './RouterLayout';
import SubpageLayout from './SubpageLayout';

export default function AccountShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  // While the session resolves, render the public chrome rather than flashing a
  // sidebar at someone who turns out to be logged out.
  if (status === 'authenticated') {
    return <RouterLayout>{children}</RouterLayout>;
  }
  return <SubpageLayout>{children}</SubpageLayout>;
}
