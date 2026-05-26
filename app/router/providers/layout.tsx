import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Provider Keys — Connect OpenAI, Anthropic, xAI, Google, DeepSeek & More',
  description: 'Connect your AI provider API keys securely. Supports OpenAI, Anthropic, xAI, Google, DeepSeek, Kimi (Moonshot AI), and GLM (Zhipu AI). Auto-validation tests connectivity and lists available models. AES-256 encryption at rest.',
  keywords: [
    'AI provider API keys',
    'connect OpenAI API key',
    'connect Anthropic API key',
    'connect xAI API key',
    'connect Google AI key',
    'connect DeepSeek API key',
    'AI key validation',
    'secure AI key storage',
    'multi-provider AI setup',
  ],
  openGraph: {
    title: 'AI Provider Keys — Connect All Your AI Provider API Keys',
    description: 'Securely connect OpenAI, Anthropic, xAI, Google, DeepSeek, Kimi, and GLM API keys. Auto-validation and AES-256 encryption.',
    url: 'https://aistupidlevel.info/router/providers',
  },
  alternates: {
    canonical: '/router/providers',
  },
};

export default function ProvidersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
