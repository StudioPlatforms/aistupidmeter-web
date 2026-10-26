import type { Metadata } from 'next';
import { slugifyModelName } from '../lib/model-slug';
import { cookies } from 'next/headers';
import HomeClient from './HomeClient';
import { LAYOUT_COOKIE, toBoardLayout, type BoardLayout } from '../lib/board-layout';
import { openIdentityDb } from '@/lib/identity-db';
import { auth } from '@/auth';
import Landing from '@/components/landing/Landing';
import { isPlan, planMeets, type Plan } from '@/lib/entitlements';
import { REQUIRED_PLAN } from '@/lib/capabilities';
import { latestTokenHeaders } from '@/lib/latest-token';

// Thin server wrapper around the interactive dashboard. The dashboard itself is
// a large client component that fetches live data, so its leaderboard content is
// invisible to non-JS crawlers on first paint. This wrapper injects the pieces
// that make the page rank: a real <h1>, an intro, an ItemList / Organization /
// WebSite JSON-LD graph built from server-fetched benchmark data, and a
// crawlable index of every model page — all without altering the visual design.
export const dynamic = 'force-dynamic';

const SITE = 'https://aistupidlevel.info';
const API_INTERNAL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
const YEAR = new Date().getUTCFullYear();

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

async function fetchRankedModels(latestAllowed: boolean): Promise<RankedModel[]> {
  try {
    // The Combined board in the visitor's default period: the newest run for paid plans (with the
    // token the API asks for), 24 hours for everyone else. /dashboard/boards is ~20KB; the
    // /dashboard/cached payload this used to read is ~855KB, nearly all of it history.
    const res = await fetch(
      `${API_INTERNAL}/dashboard/boards?period=${latestAllowed ? 'latest' : '24h'}`,
      { next: { revalidate: 900 }, headers: latestAllowed ? latestTokenHeaders() : {} } // 15 min
    );
    if (res.ok) {
      const data = await res.json();
      const scores = data?.data?.combined;
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

/** The layout saved to this account (ui_preferences, written through the API), or null. */
function savedLayout(userId: number): BoardLayout | null {
  if (!Number.isFinite(userId)) return null;
  let db: ReturnType<typeof openIdentityDb> | null = null;
  try {
    db = openIdentityDb();
    const row = db.prepare('SELECT leaderboard_layout FROM ui_preferences WHERE user_id = ?')
      .get(userId) as { leaderboard_layout: string | null } | undefined;
    return toBoardLayout(row?.leaderboard_layout);
  } catch {
    return null; // table missing or DB busy: the client asks the API as before
  } finally {
    db?.close();
  }
}

export default async function HomePage() {
  // The leaderboard is for signed-in accounts; everyone else, crawlers included, gets the landing
  // page (components/landing). A session check that fails counts as signed out.
  const session = await auth().catch(() => null);
  if (!session?.user) return <Landing />;

  // The newest run is a paid view (lib/capabilities 'latest-scores'): a free account's board opens on
  // 24 hours, and its HTML must not carry the latest numbers either.
  const plan: Plan = isPlan((session.user as any).plan) ? (session.user as any).plan : 'free';
  const latestAllowed = planMeets(plan, REQUIRED_PLAN['latest-scores']);
  // The analysis around the boards (drift monitor, quick answers, heatmap, radar, price-performance)
  // is Pro too ('board-insights'); decided here so a paying account never sees a lock flash first.
  const insightsAllowed = planMeets(plan, REQUIRED_PLAN['board-insights']);
  // Any paid plan (legacy $4.99 included): the board stops advertising plans to someone who
  // already pays. Decided here, like the two flags above, so a subscriber never sees the ad flash.
  const subscribed = planMeets(plan, 'pro');

  const models = await fetchRankedModels(latestAllowed);
  // The visitor's leaderboard layout, so the first paint is already the one they chose
  // (lib/board-layout.ts). This page is rendered per request anyway (force-dynamic).
  // Only a layout saved to the ACCOUNT counts as chosen: an account without one gets the layout
  // chooser on its first visit, whatever this browser's cookie says (owner, 2026-10-18; before,
  // a cookie from an earlier visit silently became a new account's choice and it never saw the
  // chooser). The cookie still decides which layout the chooser starts on.
  const initialLayout = savedLayout(Number((session.user as any).id));
  const suggestedLayout = toBoardLayout(cookies().get(LAYOUT_COOKIE)?.value);

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

  // The Organization node lives once in app/layout.tsx (with its @id); this page only adds
  // the live ItemList. A second Organization here used to carry a personal X handle, a GitHub
  // URL that 404s and a 2.3 MB logo.

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />

      {/* Server-rendered SEO scaffold: gives crawlers a real heading, an intro,
          and a followable link to every model page before the client dashboard
          hydrates. Visually hidden so the live dashboard design is unchanged;
          the same content is presented visibly by the interactive leaderboard. */}
      <div style={srOnly}>
        <h1>AI Model Benchmarks {YEAR} — Live Rankings for GPT, Claude, Gemini, Kimi &amp; More</h1>
        <p>
          AI Stupid Level is an independent benchmarking platform that re-tests large language
          models on the same coding, reasoning and tool-use tasks on a fixed schedule, scores them,
          and detects performance drift over time. Below is the live model index.
        </p>

        <h2>Live AI model leaderboard</h2>
        <nav aria-label="All benchmarked AI models">
          <ul>
            {ranked.map((m) => (
              <li key={String(m.id)}>
                <a href={`/models/${m.slug || m.id}`}>
                  {m.label}
                  {m.vendorLabel ? ` — ${m.vendorLabel}` : ''}
                  {latestAllowed && typeof m.currentScore === 'number' ? ` benchmark score ${m.currentScore}` : ''}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* The homepage shipped ~200 words and no <h2> at all. These sections
            give crawlers the site's actual topic structure and a followable
            path into the drift-detection and methodology pages. */}
        <h2>AI drift detection: is your model getting worse?</h2>
        <p>
          AI providers update the model behind a stable API name without notice, so a model that
          scored well at launch may behave differently today. We benchmark continuously and apply
          Page-Hinkley change-point detection to separate a genuine sustained decline from ordinary
          run-to-run noise. Read{' '}
          <a href="/ai-drift-detection">how AI drift detection and model degradation tracking works</a>.
        </p>

        <h2>How we benchmark AI models</h2>
        <p>
          Every model runs the same suites: a 9-axis code benchmark scored by executing the
          generated code, a 13-axis deep reasoning benchmark covering multi-step problem solving and
          long-context retention, and a 7-axis tool-calling benchmark measuring tool selection and
          argument accuracy. Scores are published with confidence intervals. See the{' '}
          <a href="/methodology">full benchmarking methodology</a>.
        </p>

        <h2>Compare AI models</h2>
        <p>
          Put current models from OpenAI, Anthropic, Google, DeepSeek, Moonshot AI and Zhipu AI side
          by side on coding, reasoning, tool use, price and measured latency with the{' '}
          <a href="/compare">AI model comparison tool</a>, or read the{' '}
          <a href="/faq">AI benchmarking FAQ</a>.
        </p>
      </div>

      <HomeClient initialLayout={initialLayout} suggestedLayout={suggestedLayout} latestAllowed={latestAllowed} insightsAllowed={insightsAllowed} subscribed={subscribed} />
    </>
  );
}
