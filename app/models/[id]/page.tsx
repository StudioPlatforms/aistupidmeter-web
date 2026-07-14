import type { Metadata } from 'next';
import { permanentRedirect, notFound } from 'next/navigation';
import { resolveModelParam, isNumericId, type SlugModel } from '../../../lib/model-slug';
import ModelDetailClient from './ModelDetailClient';

// Server-rendered so search engines get a unique title, description, canonical
// URL and JSON-LD for every model — the interactive dashboard hydrates on top.
export const dynamic = 'force-dynamic';

const SITE = 'https://aistupidlevel.info';
// Server-side calls must hit the backend directly (browser uses the nginx proxy).
const API_INTERNAL = process.env.API_INTERNAL_URL || 'http://localhost:4000';
const YEAR = 2026;

const VENDOR_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  xai: 'xAI',
  deepseek: 'DeepSeek',
  kimi: 'Moonshot AI',
  glm: 'Zhipu AI',
  moonshot: 'Moonshot AI',
  zhipu: 'Zhipu AI',
};

function vendorLabel(vendor?: string): string {
  if (!vendor) return 'AI';
  return VENDOR_LABELS[vendor.toLowerCase()] || vendor.charAt(0).toUpperCase() + vendor.slice(1);
}

async function fetchModels(): Promise<SlugModel[]> {
  try {
    const res = await fetch(`${API_INTERNAL}/api/models`, {
      // Revalidate hourly — model roster changes rarely; keeps metadata fast.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ─── Metadata ──────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const models = await fetchModels();
  const resolved = resolveModelParam(params.id, models);

  if (!resolved) {
    return {
      title: 'Model Not Found',
      robots: { index: false, follow: true },
    };
  }

  const { model, slug } = resolved;
  const name = model.displayName || model.name;
  const vendor = vendorLabel(model.vendor);
  const canonical = `${SITE}/models/${slug}`;

  // Absolute title bypasses the root layout's brand template so the tag stays a
  // clean, search-optimal length instead of doubling up separators.
  const title = `${name} Benchmark & Performance Score ${YEAR} | AI Stupid Level`;
  const ogTitle = `${name} Benchmark & Live Performance Score (${YEAR}) — ${vendor}`;
  const description =
    `Independent, real-time benchmark results for ${name} by ${vendor}. See live coding, ` +
    `reasoning, tool-calling and speed scores, a 7-axis quality breakdown, price per 1M tokens, ` +
    `and historical performance drift — updated hourly by AI Stupid Level.`;

  return {
    title: { absolute: title },
    description,
    keywords: [
      `${name} benchmark`,
      `${name} performance`,
      `${name} review`,
      `${name} vs`,
      `${vendor} ${name}`,
      `is ${name} good for coding`,
      `${name} score`,
      `${name} price`,
    ],
    alternates: { canonical },
    openGraph: {
      type: 'article',
      url: canonical,
      title: ogTitle,
      description,
      siteName: 'AI Stupid Level',
      images: [
        {
          url: `${SITE}/api/og?type=rankings`,
          width: 1200,
          height: 630,
          alt: `${name} benchmark score and rankings`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE}/api/og?type=rankings`],
    },
    robots: { index: true, follow: true },
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function ModelDetailPage(
  { params }: { params: { id: string } }
) {
  const models = await fetchModels();

  // Graceful degradation: if the API is unreachable we can't build the slug map.
  // For a legacy numeric URL, still render the interactive client (it retries on
  // its own); otherwise there is nothing to resolve.
  if (models.length === 0) {
    if (isNumericId(params.id)) {
      return (
        <ModelDetailClient
          modelId={parseInt(params.id, 10)}
          slug={params.id}
          initialName={params.id}
          initialVendor="AI"
        />
      );
    }
    notFound();
  }

  const resolved = resolveModelParam(params.id, models);
  if (!resolved) notFound();

  const { model, slug } = resolved;

  // 301 (308 permanent) any non-canonical form — legacy numeric ids and stale
  // slugs — to the canonical slug URL so link equity consolidates on one URL.
  if (params.id !== slug) {
    permanentRedirect(`/models/${slug}`);
  }

  const name = model.displayName || model.name;
  const vendor = vendorLabel(model.vendor);
  const canonical = `${SITE}/models/${slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'AI Model Rankings', item: SITE },
          { '@type': 'ListItem', position: 2, name: `${name} Benchmark`, item: canonical },
        ],
      },
      {
        '@type': 'WebPage',
        '@id': canonical,
        url: canonical,
        name: `${name} Benchmark & Live Performance Score`,
        isPartOf: { '@type': 'WebSite', name: 'AI Stupid Level', url: SITE },
        about: {
          '@type': 'SoftwareApplication',
          name,
          applicationCategory: 'AI Language Model',
          operatingSystem: 'Cloud / API',
          author: { '@type': 'Organization', name: vendor },
        },
        description:
          `Independent, hourly-updated benchmark results for ${name} by ${vendor}: coding, ` +
          `reasoning, tool-calling and speed scores with historical performance drift.`,
        publisher: { '@type': 'Organization', name: 'AI Stupid Level', url: SITE },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* SEO fallback: a real heading + intro so crawlers (and no-JS clients)
          get meaningful content before the interactive dashboard hydrates. */}
      <h1 style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
        {name} Benchmark & Live Performance Score ({YEAR}) — {vendor}
      </h1>
      <ModelDetailClient
        modelId={Number(model.id)}
        slug={slug}
        initialName={model.name}
        initialDisplayName={model.displayName}
        initialVendor={model.vendor || 'AI'}
      />
    </>
  );
}
