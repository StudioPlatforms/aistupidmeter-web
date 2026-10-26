/**
 * The research pages (/research and /research/<slug>): one registry read by the index page, each
 * article's metadata and JSON-LD, the byline and the sitemap, so a title or date is never typed
 * twice.
 *
 * `title` is the article's headline (H1, JSON-LD headline, index listing). `metaTitle` is the
 * <title> part, at most 42 characters so "<metaTitle> | AI Stupid Level" stays within 60.
 * Descriptions are 120–155 characters. Nothing here names a model: the articles are dated
 * findings re-derived from the test record, and the models they concern are named inside them.
 */

export interface ResearchWindow {
  /** What the dates bound: "data" or "figures computed". */
  label: string;
  /** ISO days. */
  from: string;
  to: string;
}

export interface ResearchEntry {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  /** One sentence for the hub listing; may be longer than the description. */
  summary: string;
  /** ISO day, e.g. "2026-10-23". */
  published: string;
  updated: string;
  kind: 'paper' | 'report';
  /** The byline's data window or computation dates. */
  window: ResearchWindow;
  /** Query phrases for the page's metadata; families and methods only, never a model. */
  keywords: string[];
}

export const RESEARCH: ResearchEntry[] = [
  {
    slug: 'thirteen-months-of-llm-monitoring',
    title: 'What 13 months of monitoring LLM APIs caught',
    metaTitle: 'What 13 months of LLM monitoring caught',
    description:
      'Thirteen months of scheduled runs against commercial LLM APIs: the provider-side changes the record caught, when each began, and what it did not find.',
    summary:
      'Thirteen months of scheduled coding runs, re-read with signals no scoring formula produces: two build changes confirmed by a provider’s own identifiers, a model name silently redirected, five serving-speed steps, a verbosity change that became failure under a fixed budget, four withdrawn endpoints, and no loss of correctness on the tasks that ran all year.',
    published: '2026-10-23',
    updated: '2026-10-23',
    kind: 'paper',
    window: { label: 'data', from: '2025-08-08', to: '2026-09-23' },
    keywords: [
      'LLM monitoring', 'LLM drift study 2026', 'silent model updates API', 'do AI models get worse over time',
      'AI model degradation research paper', 'continuous LLM benchmark false positives', 'DeepSeek model changed without notice',
      'is ChatGPT getting worse', 'is Claude getting worse', 'AI model nerfed evidence', 'why is my AI model getting dumber',
    ],
  },
  {
    slug: 'drift-detector-false-alarm-rate',
    title: 'How often our drift detector is wrong, measured',
    metaTitle: 'How often our drift detector is wrong',
    description:
      'The Page-Hinkley drift detector’s measured false-alarm rate and the drop size it needs, from simulation, bootstrapped real histories and canary replay.',
    summary:
      'The operating characteristics of the per-suite Page-Hinkley detector at four noise levels, where the fleet’s own noise sits, the false-alarm rate on bootstrapped real histories, the hourly canary replayed against real probes with injected drops, the September 2026 retraction record, and what the detector does not catch.',
    published: '2026-10-23',
    updated: '2026-10-23',
    kind: 'report',
    window: { label: 'figures computed', from: '2026-09-14', to: '2026-09-22' },
    keywords: [
      'Page-Hinkley test LLM monitoring', 'change point detection false alarm rate', 'how to detect LLM degradation statistically',
      'is Page-Hinkley a CUSUM-family test', 'model drift detection validation', 'AI drift detection', 'benchmark retraction record',
      'LLM monitoring alert fatigue',
    ],
  },
];

export const researchPath = (e: Pick<ResearchEntry, 'slug'>): string => `/research/${e.slug}`;

export function researchBySlug(slug: string): ResearchEntry | undefined {
  return RESEARCH.find((e) => e.slug === slug);
}
