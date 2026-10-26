import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Smart Router API documentation',
  description: 'Smart Router API reference: OpenAI-compatible /v1/chat/completions, Anthropic /v1/messages passthrough, /v1/embeddings, 14 auto-* routing modes and SDKs.',
  path: '/router/docs',
  keywords: [
    'AI router API documentation',
    'OpenAI compatible API docs',
    'AI API reference',
    'chat completions API',
    'AI embeddings API',
    'Anthropic Messages API',
    'AI router endpoints',
    'AI router SDK',
    'LLM router Python SDK',
    'LLM router TypeScript SDK',
    'AI API code examples',
    'LLM API documentation',
    'AI gateway API reference',
  ],
});

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
