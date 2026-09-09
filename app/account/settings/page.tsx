import type { Metadata } from 'next';
import SubpageLayout from '@/components/SubpageLayout';
import SettingsClient from './SettingsClient';

export const metadata: Metadata = {
  title: 'Settings | AI Stupid Level',
  description: 'Manage your account, email notifications and which models email you.',
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return (
    <SubpageLayout>
      <SettingsClient />
    </SubpageLayout>
  );
}
