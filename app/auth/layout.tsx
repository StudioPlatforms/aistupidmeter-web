import type { Metadata } from 'next';

// Sign-in, sign-up and password pages: not indexed, links followed. robots.txt no longer blocks
// /auth/, so a crawler can read this directive instead of listing the pages "indexed, blocked".
export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: true },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
