import type { MetadataRoute } from 'next';

/**
 * /manifest.webmanifest. Next links it from every page; crawlers were requesting
 * /manifest.json and friends and getting 404s. The icons are the files the favicon links use.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AI Stupid Level',
    short_name: 'ASL',
    description: 'Independent LLM benchmarks with drift detection and a benchmark-driven Smart Router.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/favicon.png', sizes: '128x128', type: 'image/png' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
