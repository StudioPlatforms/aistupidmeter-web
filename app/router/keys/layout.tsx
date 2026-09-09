import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Smart Router API Keys — One Key for All AI Providers',
  description: 'Create Smart Router (SR) API keys that work across every routable provider: OpenAI, Anthropic, Google, DeepSeek, GLM and Kimi. One key for GPT-5, Claude Opus 5, Gemini 3 and more. Setup guides for Cursor, Windsurf, Aider, Continue.dev, Cline, and Open WebUI.',
  keywords: [
    'AI API key',
    'universal AI API key',
    'one API key all AI models',
    'AI router API key',
    'OpenAI API key alternative',
    'multi-provider AI key',
    'AI key management',
    'Cursor API key',
    'Windsurf API key',
    'Aider API key setup',
    'AI API key creation',
  ],
  openGraph: {
    title: 'Smart Router API Keys — One Key for All AI Providers',
    description: 'Create one Smart Router key that works with GPT-5, Claude, Gemini and more. Setup guides for Cursor, Windsurf, Aider, and 8+ tools.',
    url: 'https://aistupidlevel.info/router/keys',
  },
  alternates: {
    canonical: '/router/keys',
  },
};

export default function KeysLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
