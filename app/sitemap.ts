import { MetadataRoute } from 'next';
import { slugifyModelName } from '../lib/model-slug';

// Server-side calls hit the backend directly; browser traffic uses the nginx proxy.
const API_INTERNAL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://aistupidlevel.info';
  const currentDate = new Date();

  // Only genuinely public, index-able URLs belong here. Auth-gated /router/*
  // dashboard pages 307-redirect crawlers to /auth/signin, so listing them
  // wastes crawl budget and produces soft-404 signals — they are intentionally
  // excluded. /router/forum is the one public router route (returns 200).
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: currentDate, changeFrequency: 'hourly', priority: 1.0 },
    { url: `${baseUrl}/compare`, lastModified: currentDate, changeFrequency: 'daily', priority: 0.9 },
    // Topic landing page for the drift-detection / model-degradation queries.
    { url: `${baseUrl}/ai-drift-detection`, lastModified: currentDate, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/methodology`, lastModified: currentDate, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/about`, lastModified: currentDate, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/faq`, lastModified: currentDate, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/router/forum`, lastModified: currentDate, changeFrequency: 'daily', priority: 0.6 },
  ];

  // Dynamic per-model pages — the core long-tail SEO surface.
  let modelPages: MetadataRoute.Sitemap = [];
  try {
    const response = await fetch(`${API_INTERNAL}/api/models`, { next: { revalidate: 3600 } });
    if (response.ok) {
      const models = await response.json();
      if (Array.isArray(models)) {
        const seen = new Set<string>();
        modelPages = models
          // API returns camelCase `showInRankings` (the previous `show_in_rankings`
          // check silently dropped every model from the sitemap).
          .filter((m: any) => m && m.showInRankings && m.name)
          .map((m: any) => {
            const slug = slugifyModelName(m.name) || String(m.id);
            return {
              url: `${baseUrl}/models/${slug}`,
              lastModified: m.last_benchmark ? new Date(m.last_benchmark) : currentDate,
              changeFrequency: 'daily' as const,
              priority: 0.7,
            };
          })
          // Guard against any two names slugifying to the same URL.
          .filter((entry) => {
            if (seen.has(entry.url)) return false;
            seen.add(entry.url);
            return true;
          });
      }
    }
  } catch (error) {
    console.error('Failed to fetch models for sitemap:', error);
  }

  return [...staticPages, ...modelPages];
}
