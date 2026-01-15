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
      'openai-o3',
      'openai-o3-mini',
      'openai-gpt-4o',
      'anthropic-claude-opus-4',
      'anthropic-claude-sonnet-4',
      'google-gemini-2-5-pro',
      'google-gemini-2-5-flash',
      'xai-grok-4',
    ];

    modelPages = fallbackModels.map(slug => ({
      url: `${baseUrl}/models/${slug}`,
      lastModified: currentDate,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));
  }

  // Combine all pages
  return [...staticPages, ...modelPages];
}
