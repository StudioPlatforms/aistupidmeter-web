import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Smart Router setup: Cursor, Cline, Aider',
  description: 'Set up the Smart Router in Cursor, Cline, Aider, Continue, Open WebUI, LibreChat, LiteLLM and more: base URL, key, routing modes and troubleshooting.',
  path: '/router/help',
  keywords: [
    'AI router setup guide',
    'Cursor AI router setup',
    'Windsurf AI router configuration',
    'Aider AI router',
    'Continue.dev AI router',
    'Cline AI router setup',
    'Open WebUI AI router',
    'AI routing strategies',
    'best coding AI model',
    'AI router troubleshooting',
    'how to set up AI router',
  ],
});

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
