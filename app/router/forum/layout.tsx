import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Forum — AI Stupid Level Community',
  description:
    'Join the AI Stupid Level community forum. Discuss AI models, share tips, and connect with other users.',
};

export default function ForumSEOLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
