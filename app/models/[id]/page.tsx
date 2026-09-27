import type { Metadata } from 'next';
import { permanentRedirect, notFound } from 'next/navigation';
import { resolveModelParam, isNumericId, type SlugModel } from '../../../lib/model-slug';
import { BOARD_KEYS, buildBoards, standingOnBoard, type BoardKey, type Standing } from '../../../lib/boards-core';
import ModelDetailClient from './ModelDetailClient';

// Server-rendered so search engines get a unique title, description, canonical
// URL and JSON-LD for every model — the interactive dashboard hydrates on top.
export const dynamic = 'force-dynamic';

const SITE = 'https://aistupidlevel.info';
// Server-side calls must hit the backend directly (browser uses the nginx proxy).
const API_INTERNAL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
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
 * The model's standing on all four boards, fetched server-side for the indexable text.
 *
 * Model pages are 22 of the 28 URLs in the sitemap and were rendering ~33 words of indexable
 * text, because every number lives in the client component. This ships real, unique text per
 * model — and it must say what the leaderboards say: the same boards (/dashboard/boards), the
 * same statistical ties and the same "not ranked" rules, via lib/boards-core. The first version
 * sorted by score and called the position a rank, so a community-funded model whose combined
 * score is coding-only read as "#3 of 22" when the board does not rank it at all.
 */
async function fetchModelStanding(modelId: string): Promise<ModelStanding | null> {
  try {
    const res = await fetch(`${API_INTERNAL}/dashboard/boards?period=latest`, { next: { revalidate: 900 } });
    if (!res.ok) return null;
    const body = await res.json();
    if (!body?.data) return null;
    const boards = buildBoards(body.data);
    const out = {} as ModelStanding;
    for (const k of BOARD_KEYS) out[k] = standingOnBoard(boards[k], String(modelId));
    return out.combined.kind === 'absent' && out.coding.kind === 'absent' ? null : out;
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
    `reasoning, tool-calling and speed scores, a 9-axis quality breakdown, price per 1M tokens, ` +
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
type ModelStanding = Record<BoardKey, Standing>;

const ORDINAL = (n: number) => {
  const v = n % 100;
  return n + (v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th');
};

/** "joint 4th of 17", "1st of 22", or why there is no rank. */
function placeOn(st: Standing): string | null {
  if (st.kind !== 'ranked') return null;
  const r = st.row.rank as number;
  return `${st.tied ? 'joint ' : ''}${ORDINAL(r)} of ${st.rankedCount}`;
}

function ModelSeoContent({
  name,
  vendor,
  standing,
}: {
  name: string;
  vendor: string;
  standing: ModelStanding | null;
}) {
  const combined = standing?.combined;
  const community = combined?.kind === 'community';
  const trend = combined && combined.kind !== 'absent' ? combined.row.trend : 'stable';
  const trendWord = trend === 'up' ? 'improving' : trend === 'down' ? 'declining' : 'holding steady';
  const place = (k: BoardKey) => (standing ? placeOn(standing[k]) : null);
  const fundedResult = (k: BoardKey) => {
    const st = standing?.[k];
    return st && st.kind === 'community' ? `${st.row.score} (last funded run, ${st.row.when})` : null;
  };

  const s = {
    wrap: {
      maxWidth: '980px',
      margin: '0 auto',
      padding: '8px 20px 56px',
      color: 'var(--phosphor-green, #202124)',
      fontSize: '14.5px',
      lineHeight: 1.7,
    } as React.CSSProperties,
    h2: {
      fontSize: '17px',
      fontWeight: 600,
      color: 'var(--phosphor-green, #202124)',
      margin: '32px 0 8px',
    } as React.CSSProperties,
    p: { margin: '0 0 12px', color: 'var(--phosphor-dim, #5f6368)' } as React.CSSProperties,
    a: { color: 'var(--accent, #1a73e8)' } as React.CSSProperties,
  };

  let standingText: string;
  if (!standing || !combined || combined.kind === 'absent') {
    standingText = `Its live scores are in the dashboard above and refresh as new benchmark runs complete.`;
  } else if (community) {
    const cd = place('coding');
    const rs = fundedResult('reasoning');
    const ts = fundedResult('tooling');
    standingText =
      `${name}'s reasoning and tool-use tests are funded by the community rather than by us, so its combined score ` +
      `(${combined.row.score}) is its coding score alone and is not ranked against models measured on all three suites. ` +
      (cd ? `On coding, which we still test every four hours, it is ${cd}. ` : '') +
      (rs || ts ? `Its most recent funded results are ${[rs && `reasoning ${rs}`, ts && `tool use ${ts}`].filter(Boolean).join(' and ')}. ` : '') +
      `Anyone can fund its next reasoning or tool-use run from this page, with their own API key.`;
  } else if (combined.kind === 'ranked') {
    const parts = (['coding', 'reasoning', 'tooling'] as BoardKey[])
      .map((k) => {
        const p = place(k);
        return p ? `${p} on ${k === 'tooling' ? 'tool use' : k}` : null;
      })
      .filter(Boolean);
    standingText =
      `In the latest results ${name} scores ${combined.row.score}/100 on the combined board, ${placeOn(combined)} ranked there, ` +
      `and its recent trend is ${trendWord}. ` +
      (parts.length ? `On the individual boards it is ${parts.join(', ').replace(/, ([^,]*)$/, ' and $1')}. ` : '') +
      `"Joint" means its lead over, or gap to, the models around it is smaller than the measurement can resolve, so they share the place.`;
  } else {
    standingText =
      `It is not ranked on the combined board right now` +
      (combined.row.staleReason ? ` (${combined.row.staleReason})` : '') +
      `; its latest scores are shown above.`;
  }

  return (
    <section style={s.wrap}>
      <h2 style={s.h2}>What is the {name} benchmark score?</h2>
      <p style={s.p}>
        {name} is a large language model from {vendor}. AI Stupid Level re-tests it on a fixed schedule and publishes a
        combined score from 0 to 100 — half coding, a quarter reasoning and a quarter tool use — where higher means
        stronger measured performance. {standingText} The scores come from our own runs through the provider&apos;s public
        API, not from vendor-reported numbers, so they show how the model behaves as it is served today.
      </p>

      <h2 style={s.h2}>How we test {name}</h2>
      <p style={s.p}>
        The coding suite runs every four hours: seven tasks, seven attempts each, most of them real debugging jobs in
        which the model gets a small working project and a bug report and has to find and fix the fault. It is graded by
        running the project&apos;s own tests, including tests the model never sees, and scored on nine measures led by
        correctness (55%) and stability, edge cases and debugging (10% each); complexity is measured but carries no
        weight. The reasoning suite runs daily: four long working sessions of five or six turns, scored on correctness,
        recovery after a failed step, and three continuity measures — memory retention, plan coherence and context use —
        checked by running code against rules stated earlier in the conversation. The tool-use suite runs daily: nine
        tasks in real sandboxed machines, scored on task completion (30%), tool selection (20%), parameter accuracy,
        efficiency, error handling, context awareness and safety. A suite that is missing or out of date drops out of
        the combined score and the others are reweighted; the page says when that happens.
        {community && ` For ${name}, the reasoning and tool-use suites run only when a member of the community funds a run; the coding suite runs on our schedule, as for every model.`}{' '}
        Full details, including every weight, are on our{' '}
        <a href="/methodology" style={s.a}>benchmarking methodology page</a>.
      </p>

      <h2 style={s.h2}>Is {name} getting worse over time?</h2>
      <p style={s.p}>
        This is the question the platform exists to answer. A provider can change a model behind the same API name, and
        without continuous measurement that change is invisible to the people relying on it. Each of {name}&apos;s suites has
        its own Page-Hinkley change-point detector, run on daily results, which separates a sustained decline from
        ordinary run-to-run noise; it needs ten days of history on the current version of the tests before it can fire.
        An hourly canary — two fixed probes — watches for a sudden collapse and tests it against the previous week with
        Welch&apos;s t-test, and records an incident when the fall is large and significant. A Page-Hinkley detection is
        marked on the chart above and changes {name}&apos;s status on the drift monitor. See{' '}
        <a href="/ai-drift-detection" style={s.a}>how AI drift detection works</a> for the method.
      </p>

      <h2 style={s.h2}>Compare {name} with other models</h2>
      <p style={s.p}>
        Scores mean most next to the alternatives. The <a href="/" style={s.a}>live leaderboard</a> shows every model on
        all four boards — the Table layout puts each model&apos;s combined, coding, reasoning and tool-use scores and ranks in
        one row, with prices — and the heatmap under the boards compares the nine coding measures across every model. Sign
        in and star {name} to add it to your watchlist: it then appears at the top of the leaderboards with its place on
        each board, and we email you if its measured coding score falls five points or more in a week, plus a weekly
        summary of what changed.
      </p>
    </section>
  );
}
