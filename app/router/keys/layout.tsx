import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI API Keys — Universal Key for All AI Providers',
  description: 'Create universal API keys that work with every AI provider: OpenAI, Anthropic, xAI, Google, DeepSeek, GLM, and Kimi. One key for GPT-5, Claude Opus 4, Grok 4, Gemini 3 and more. Setup guides for Cursor, Windsurf, Aider, Continue.dev, Cline, and Open WebUI.',
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
    title: 'AI API Keys — One Universal Key for All AI Providers',
    description: 'Create one API key that works with GPT-5, Claude, Grok, Gemini & more. Setup guides for Cursor, Windsurf, Aider, and 8+ tools.',
    url: 'https://aistupidlevel.info/router/keys',
  },
  alternates: {
    canonical: '/router/keys',
  },
};

export default function KeysLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
