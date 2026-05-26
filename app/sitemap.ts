import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://aistupidlevel.info';
  const currentDate = new Date();

  // Static pages with priorities and update frequencies
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'hourly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/methodology`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/compare`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/test`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  // AI Router & Monitoring pages (public-facing, SEO-valuable)
  const routerPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/router`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${baseUrl}/router/docs`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/router/help`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/router/keys`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/router/monitoring`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/router/analytics`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/router/intelligence`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/router/providers`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.75,
    },
    {
      url: `${baseUrl}/router/preferences`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/router/profile`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/router/subscription`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/router/test-keys`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  // Fetch model data for dynamic model pages
  let modelPages: MetadataRoute.Sitemap = [];
  
  try {
    // Fetch models from the API
    const response = await fetch('http://localhost:4000/api/models', {
      next: { revalidate: 3600 } // Revalidate every hour
    });
    
    if (response.ok) {
      const models = await response.json();
      
      modelPages = models
        .filter((model: any) => model.show_in_rankings) // Only include ranked models
        .map((model: any) => ({
          url: `${baseUrl}/models/${model.slug || model.id}`,
          lastModified: model.last_benchmark ? new Date(model.last_benchmark) : currentDate,
          changeFrequency: 'daily' as const,
          priority: 0.7,
        }));
    }
  } catch (error) {
    console.error('Failed to fetch models for sitemap:', error);
    // Fallback: include known top models manually
    const fallbackModels = [
      'openai-gpt-5',
      'openai-gpt-5-turbo',
      'openai-o3',
      'openai-o3-mini',
      'openai-gpt-4o',
      'openai-gpt-4o-mini',
      'anthropic-claude-opus-4',
      'anthropic-claude-sonnet-4',
      'google-gemini-2-5-pro',
      'google-gemini-2-5-flash',
      'google-gemini-2-5-flash-lite',
      'xai-grok-4',
      'xai-grok-code-fast-1',
      'deepseek-deepseek-v4',
      'kimi-kimi-k2',
    ];

    modelPages = fallbackModels.map(slug => ({
      url: `${baseUrl}/models/${slug}`,
      lastModified: currentDate,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));
  }

  // Combine all pages
  return [...staticPages, ...routerPages, ...modelPages];
}
