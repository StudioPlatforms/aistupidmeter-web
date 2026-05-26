import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Router Setup Guide — Cursor, Windsurf, Aider, Continue.dev & More',
  description: 'Step-by-step setup guide for the AI Smart Router with 12+ tools: Cursor, Windsurf, Aider, Continue.dev, Cline, Open WebUI, BoltAI, TypingMind, LibreChat, LangChain, and more. Learn about routing strategies (auto-best, best-coding, best-reasoning, cheapest), troubleshooting, and FAQ.',
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
    'cheapest AI model router',
    'AI router troubleshooting',
    'how to set up AI router',
  ],
  openGraph: {
    title: 'AI Router Setup Guide — 12+ IDE & Tool Configurations',
    description: 'Set up the AI Smart Router with Cursor, Windsurf, Aider, Continue.dev, Cline, Open WebUI, and more. Step-by-step instructions with routing strategies.',
    url: 'https://aistupidlevel.info/router/help',
  },
  alternates: {
    canonical: '/router/help',
  },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
