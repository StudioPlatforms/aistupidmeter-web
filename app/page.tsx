import type { Metadata } from 'next';
import { slugifyModelName } from '../lib/model-slug';
import HomeClient from './HomeClient';

// Thin server wrapper around the interactive dashboard. The dashboard itself is
// a large client component that fetches live data, so its leaderboard content is
// invisible to non-JS crawlers on first paint. This wrapper injects the pieces
// that make the page rank: a real <h1>, an intro, an ItemList / Organization /
// WebSite JSON-LD graph built from server-fetched benchmark data, and a
// crawlable index of every model page — all without altering the visual design.
export const dynamic = 'force-dynamic';

const SITE = 'https://aistupidlevel.info';
const API_INTERNAL = process.env.API_INTERNAL_URL || 'http://localhost:4000';
const YEAR = 2026;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

interface RankedModel {
  id: number | string;
  name: string;
  displayName?: string | null;
  provider?: string;
  vendor?: string;
  currentScore?: number | null;
}

async function fetchRankedModels(): Promise<RankedModel[]> {
  try {
    const res = await fetch(
      `${API_INTERNAL}/dashboard/cached?period=latest&sortBy=combined`,
      { next: { revalidate: 900 } } // 15 min — leaderboard is hourly
    );
    if (res.ok) {
      const data = await res.json();
      const scores = data?.data?.modelScores;
      if (Array.isArray(scores) && scores.length) return scores;
    }
  } catch {
    /* fall through to roster */
  }
  // Fallback: bare roster (no scores) so the crawlable index still renders.
  try {
    const res = await fetch(`${API_INTERNAL}/api/models`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch {
    /* ignore */
  }
  return [];
}

const srOnly: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export default async function HomePage() {
  const models = await fetchRankedModels();

  const ranked = models
    .filter((m) => m && m.name)
    .map((m) => ({
      ...m,
      slug: slugifyModelName(m.name),
      label: m.displayName || m.name,
      vendorLabel: (m.provider || m.vendor || '').toString(),
    }));

  const scored = ranked.filter((m) => typeof m.currentScore === 'number');
  const top = scored.length ? scored : ranked;

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `AI Model Benchmark Rankings ${YEAR}`,
    description:
      'Live independent leaderboard of large language models ranked by an aggregate benchmark of coding, reasoning, tool-calling and speed performance.',
    numberOfItems: top.length,
    itemListElement: top.slice(0, 25).map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE}/models/${m.slug || m.id}`,
      name: m.label,
    })),
  };

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AI Stupid Level',
    url: SITE,
    logo: `${SITE}/stupidmetermeta.png`,
    description:
      'Independent AI model benchmarking platform tracking large language model performance and quality drift in real time.',
    sameAs: ['https://x.com/GOATGameDev', 'https://github.com/aistupidlevel'],
  };

  // Note: the root layout already emits a WebSite node (with SearchAction).
  // Here we add the Organization and the live ItemList, which the layout lacks.

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />

      {/* Server-rendered SEO scaffold: gives crawlers a real heading, an intro,
          and a followable link to every model page before the client dashboard
          hydrates. Visually hidden so the live dashboard design is unchanged;
          the same content is presented visibly by the interactive leaderboard. */}
      <div style={srOnly}>
        <h1>AI Model Benchmarks {YEAR} — Live Rankings for GPT, Claude, Gemini, Grok &amp; More</h1>
        <p>
          AI Stupid Level is an independent, real-time benchmarking platform that scores large
          language models on coding, reasoning, tool-calling and speed, and detects performance
          drift over time. Below is the live model index.
        </p>
        <nav aria-label="All benchmarked AI models">
          <ul>
            {ranked.map((m) => (
              <li key={String(m.id)}>
                <a href={`/models/${m.slug || m.id}`}>
                  {m.label}
                  {m.vendorLabel ? ` — ${m.vendorLabel}` : ''}
                  {typeof m.currentScore === 'number' ? ` benchmark score ${m.currentScore}` : ''}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <HomeClient />
    </>
  );
}
