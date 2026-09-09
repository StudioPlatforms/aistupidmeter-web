import type { Metadata } from 'next';
import SubpageLayout from '@/components/SubpageLayout';
import TeamClient from './TeamClient';

export const metadata: Metadata = {
  title: 'Team | AI Stupid Level',
  description: 'Your shared workspace: members, projects and webhooks.',
  robots: { index: false, follow: false },
};

export default function TeamPage() {
  return (
    <SubpageLayout>
      <TeamClient />
    </SubpageLayout>
  );
}
