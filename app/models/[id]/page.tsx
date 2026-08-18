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

/**
 * Live combined score + rank for a model, fetched server-side.
 *
 * Model pages are 22 of the 28 URLs in the sitemap and were rendering ~33 words
 * of indexable text — a hidden <h1> and nothing else, because every number lives
 * in the client component. Pulling the score here lets the page ship real,
 * unique content per model instead of an empty shell.
 */
async function fetchModelStanding(
  modelId: string
): Promise<{ score: number; rank: number; total: number; trend: string; updated: string } | null> {
  try {
    const res = await fetch(`${API_INTERNAL}/dashboard/scores?period=latest&sortBy=combined`, {
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const rows = (body?.data ?? []).filter((r: any) => typeof r.currentScore === 'number');
    if (rows.length === 0) return null;

    const ranked = [...rows].sort((a: any, b: any) => b.currentScore - a.currentScore);
    const idx = ranked.findIndex((r: any) => String(r.id) === String(modelId));
    if (idx === -1) return null;

    return {
      score: ranked[idx].currentScore,
      rank: idx + 1,
      total: ranked.length,
      trend: ranked[idx].trend || 'stable',
      updated: ranked[idx].lastUpdated || '',
    };
  } catch {
    return null;
  }
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
  const standing = await fetchModelStanding(String(model.id));

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
      <ModelSeoContent name={name} vendor={vendor} standing={standing} />
    </>
  );
}

/**
 * Server-rendered prose beneath the interactive dashboard.
 *
 * Everything above this point is client-rendered, so before this existed a
 * crawler saw one hidden heading per model page. This gives each of the ~22
 * model URLs unique indexable text, real headings, and internal links into the
 * methodology and drift-detection pages.
 */
function ModelSeoContent({
  name,
  vendor,
  standing,
}: {
  name: string;
  vendor: string;
  standing: { score: number; rank: number; total: number; trend: string; updated: string } | null;
}) {
  const trendWord =
    standing?.trend === 'up' ? 'improving' : standing?.trend === 'down' ? 'declining' : 'holding steady';

  const s = {
    wrap: {
      maxWidth: '900px',
      margin: '0 auto',
      padding: '8px 20px 64px',
      color: 'var(--phosphor-dim, #5f6368)',
      fontSize: '13px',
      lineHeight: 1.7,
    } as React.CSSProperties,
    h2: {
      fontSize: '13px',
      fontWeight: 700,
      color: 'var(--amber-warning, #ffb000)',
      textTransform: 'uppercase' as const,
      letterSpacing: '1.2px',
      margin: '28px 0 10px',
    } as React.CSSProperties,
    p: { margin: '0 0 12px' } as React.CSSProperties,
    a: { color: 'var(--phosphor-green, #1a73e8)' } as React.CSSProperties,
  };

  return (
    <section style={s.wrap}>
      <h2 style={s.h2}>What is the {name} benchmark score?</h2>
      <p style={s.p}>
        {name} is a large language model from {vendor}. AI Stupid Level benchmarks it continuously and publishes a
        combined score from 0 to 100, where a higher score means stronger measured performance.{' '}
        {standing
          ? `As of the latest run, ${name} scores ${Math.round(standing.score)}/100, ranking #${standing.rank} of ${standing.total} models we track, and its recent trend is ${trendWord}.`
          : `Live scores for ${name} are shown in the dashboard above and refresh as new benchmark runs complete.`}{' '}
        The score is recomputed from fresh benchmark runs rather than self-reported vendor numbers, so it reflects how
        the model behaves in production right now — not how it performed at launch.
      </p>

      <h2 style={s.h2}>How we test {name}</h2>
      <p style={s.p}>
        Every model runs the same three benchmark suites. A 7-axis code suite scores correctness, adherence to spec,
        code quality, efficiency, stability, refusal behaviour and error recovery. A deep reasoning suite measures
        multi-step problem solving, plan coherence, long-context retention and hallucination rate. A tooling suite
        measures tool selection, argument accuracy and recovery from failed calls. The headline score weights the code
        suite at 50% and the reasoning and tooling suites at 25% each. Full details are on our{' '}
        <a href="/methodology" style={s.a}>benchmarking methodology page</a>.
      </p>

      <h2 style={s.h2}>Is {name} getting worse over time?</h2>
      <p style={s.p}>
        This is the question the platform exists to answer. Model quality can shift after a provider updates a model
        behind a stable API name, and without continuous measurement that change is invisible to the people relying on
        it. We track {name} for performance drift using CUSUM change-point detection, which separates a sustained
        decline from ordinary run-to-run noise. When {name} degrades in a statistically meaningful way, it shows up on
        its chart above and in our drift alerts. See{' '}
        <a href="/ai-drift-detection" style={s.a}>how AI drift detection works</a> for the method behind it.
      </p>

      <h2 style={s.h2}>Compare {name} with other models</h2>
      <p style={s.p}>
        Scores are only meaningful next to alternatives. Use the{' '}
        <a href="/compare" style={s.a}>AI model comparison tool</a> to put {name} side by side with other current
        models on coding, reasoning, tool use, price and measured latency, or browse the{' '}
        <a href="/" style={s.a}>live AI model leaderboard</a> for the full ranking.
      </p>
    </section>
  );
}
