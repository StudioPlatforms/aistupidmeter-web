import type { Metadata } from 'next';

// An account screen: not indexed, like every other /account page. The public description of the
// Data API lives on /api-docs, which is the page that ranks for it.
export const metadata: Metadata = {
  title: 'Data API keys',
  description: 'Create and manage keys for the AI Stupid Level Data API: free, read-only access to rankings, degradation alerts and drift data as JSON.',
  robots: { index: false, follow: true },
};

export default function DataKeysLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
