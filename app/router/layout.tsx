import type { Metadata } from 'next';
import { PLANS } from '@/lib/entitlements';
import { OG_IMAGE, SITE, SITE_NAME, TWITTER_SITE } from '@/lib/seo';

const n = (x: number) => x.toLocaleString('en-US');

/**
 * Defaults for /router/*. The canonical names the /router index; /router/docs, /router/help and
 * /router/forum set their own through pageMeta() in their layouts, which replaces it. Model names
 * never appear here: families only, the roster changes with every release.
 */
export const metadata: Metadata = {
  title: {
    default: `Smart Router: benchmark-driven AI gateway | ${SITE_NAME}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: `One OpenAI-compatible endpoint, your own provider keys, zero token markup, 14 auto-* routing modes driven by our benchmarks. Free: ${n(PLANS.free.routerRequestsPerMonth)} requests a month.`,
  keywords: [
    'AI smart router',
    'AI API gateway',
    'AI router',
    'intelligent AI routing',
    'OpenAI compatible API',
    'one API key all AI models',
    'AI model auto-selection',
    'AI prompt auditing',
    'AI API monitoring',
    'AI budget control',
    'AI cost analytics',
    'AI failover routing',
    'Cursor AI router',
    'Windsurf AI router',
    'Aider AI router',
    'Continue.dev AI router',
    'multi-model AI API',
    'AI request logging',
    'AI token usage tracking',
    'benchmark-driven AI router',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: `${SITE}/router`,
    title: 'Smart Router: benchmark-driven AI gateway',
    description: `One OpenAI-compatible endpoint for GPT, Claude, Gemini, DeepSeek, Kimi and GLM on your own provider keys, zero token markup, 14 auto-* routing modes driven by our benchmarks. Free: ${n(PLANS.free.routerRequestsPerMonth)} requests a month.`,
    siteName: SITE_NAME,
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    site: TWITTER_SITE,
    creator: TWITTER_SITE,
    title: 'Smart Router: benchmark-driven AI gateway',
    description: 'One API key for GPT, Claude, Gemini, DeepSeek, Kimi and GLM. Routing modes driven by our benchmarks, prompt auditing, budget controls and per-request decision logs. Free tier included.',
    images: [OG_IMAGE.url],
  },
  alternates: {
    canonical: '/router',
  },
};

export default function RouterSEOLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
