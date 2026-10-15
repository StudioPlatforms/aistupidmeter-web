/**
 * The signed-in app's building blocks, in the landing page's look. Styles: styles/studio.css
 * (loaded by RouterLayout). The landing's router visuals are re-exported for app pages.
 */
export { default as PageHead } from './PageHead';
export { default as Pane } from './Pane';
export { default as Stats, Stat, type Tone } from './Stats';
export { default as CountUp } from './CountUp';
export { default as CodeBlock, CopyButton, highlight, type CodeSample, type CodeLang } from './CodeBlock';
export { default as Modal } from './Modal';
export { Loader, Empty, Note, Tag, Pill, ProviderMark, Meter, Locked } from './Bits';
export { previewToSnap, useModelNames } from './route-snap';
export { default as RankList, formatMetric } from '@/components/landing/RankList';
export { default as RouterDemo, type DemoScenario } from '@/components/landing/RouterDemo';
export { metricKind, RANKS_ON, METRIC_LABEL, PROVIDER_LABEL, type LandingRow, type LandingStrategy, type MetricKind } from '@/components/landing/types';
