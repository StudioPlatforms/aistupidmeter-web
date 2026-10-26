'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { Pill, ProviderMark } from '@/components/studio';

interface ModelDetailHeaderProps {
  modelName: string;
  displayName?: string;
  provider: string;
  status: string;
  trend: string;
  lastUpdated: string;
  autoRefresh: boolean;
  isRefreshing: boolean;
  onToggleAutoRefresh: () => void;
  onRefresh: () => void;
  /** The page's call to action (the Track button), shown first among the hero actions. */
  primaryAction?: ReactNode;
}

export const getProviderName = (vendor: string): string => {
  switch ((vendor || '').toLowerCase()) {
    case 'openai': return 'OpenAI';
    case 'xai': return 'xAI';
    case 'anthropic': return 'Anthropic';
    case 'google': return 'Google';
    case 'deepseek': return 'DeepSeek';
    case 'glm': return 'Zhipu AI';
    case 'kimi': return 'Moonshot AI';
    default: return vendor ? vendor.charAt(0).toUpperCase() + vendor.slice(1) : 'AI';
  }
};

const STATUS_TONE: Record<string, 'good' | 'warn' | 'bad' | undefined> = {
  excellent: 'good', good: 'good', warning: 'warn', critical: 'bad',
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const delay = (d: string) => ({ '--d': d } as CSSProperties);

/**
 * The model page's hero, in the studio header's look (tinted band, dot grid, slanted streaks):
 * a way back, the provider as the kicker, the model's name in the display face, a meta line and
 * the actions. The visible name is the page's one <h1> (it used to be a <p> beside a visually
 * hidden h1 in page.tsx); `.st .st-title` out-ranks the global h1 font rule in clean-theme.css,
 * so the look is unchanged.
 */
export function ModelHero({ provider, title, meta, actions }: {
  provider: string; title: ReactNode; meta?: ReactNode; actions?: ReactNode;
}) {
  return (
    <header className="st-head sm-hero">
      <div className="st-streaks" aria-hidden="true"><i /><i /><i /></div>
      <div className="st-head-in">
        <div>
          <Link href="/" className="sm-back st-intro"><span aria-hidden="true">←</span> Leaderboard</Link>
          <p className="st-kicker sm-kicker st-intro">
            <ProviderMark provider={provider} size="sm" />
            {getProviderName(provider)}
          </p>
          <h1 className="st-title sm-title st-intro" style={delay('.05s')}>{title}</h1>
          {meta && <div className="sm-meta st-intro" style={delay('.1s')}>{meta}</div>}
        </div>
        {actions && <div className="st-head-act sm-hero-act st-intro" style={delay('.15s')}>{actions}</div>}
      </div>
    </header>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={`sm-ico${spinning ? ' is-spin' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
      <path d="M13.6 2.2v3h-3" />
    </svg>
  );
}

export default function ModelDetailHeader({
  modelName,
  displayName,
  provider,
  status,
  trend,
  lastUpdated,
  autoRefresh,
  isRefreshing,
  onToggleAutoRefresh,
  onRefresh,
  primaryAction,
}: ModelDetailHeaderProps) {
  const updated = !lastUpdated || lastUpdated === 'Unknown' ? 'Last update unknown' : `Updated ${lastUpdated}`;

  return (
    <ModelHero
      provider={provider}
      title={displayName || modelName}
      meta={<>
        <Pill tone={STATUS_TONE[status]}>{cap(status)}</Pill>
        <span className="sm-meta-sep" aria-hidden="true" />
        <span>Trend: <b>{trend}</b></span>
        <span className="sm-meta-sep" aria-hidden="true" />
        <span>{updated}</span>
      </>}
      actions={<>
        <button
          type="button"
          className="st-btn is-quiet"
          aria-pressed={autoRefresh}
          onClick={onToggleAutoRefresh}
          title={autoRefresh ? 'Auto-refresh is on: the data reloads every 2 minutes' : 'Reload the data every 2 minutes'}
        >
          <span className="sm-switch" aria-hidden="true" />
          Auto-refresh
        </button>
        <button type="button" className="st-btn" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshIcon spinning={isRefreshing} />
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </button>
        {primaryAction}
      </>}
    />
  );
}
