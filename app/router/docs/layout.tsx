import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Router API Documentation — Endpoints, Parameters & Code Examples',
  description: 'Complete API documentation for the AI Smart Router. OpenAI-compatible /v1/chat/completions, Anthropic /v1/messages passthrough, /v1/embeddings proxy, /v1/models endpoint. 16 parameters, curl/Python/Node.js examples, error handling, and integration guides for LangChain, Vercel AI SDK, and LiteLLM.',
  keywords: [
    'AI router API documentation',
    'OpenAI compatible API docs',
    'AI API reference',
    'chat completions API',
    'AI embeddings API',
    'Anthropic Messages API',
    'AI router endpoints',
    'AI API code examples',
    'LLM API documentation',
    'AI gateway API reference',
  ],
  openGraph: {
    title: 'AI Router API Documentation — Full Reference & Code Examples',
    description: 'Complete API docs: /v1/chat/completions, /v1/messages, /v1/embeddings, /v1/models. 16 parameters, curl/Python/Node.js examples, error codes, and integration guides.',
    url: 'https://aistupidlevel.info/router/docs',
  },
  alternates: {
    canonical: '/router/docs',
  },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
