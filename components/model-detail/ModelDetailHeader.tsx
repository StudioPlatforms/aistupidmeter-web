'use client';

import { useRouter } from 'next/navigation';

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
}

const getProviderName = (vendor: string): string => {
  switch (vendor.toLowerCase()) {
    case 'openai': return 'OpenAI';
    case 'xai': return 'xAI';
    case 'anthropic': return 'Anthropic';
    case 'google': return 'Google';
    case 'deepseek': return 'DeepSeek';
    case 'glm': return 'Zhipu AI';
    case 'kimi': return 'Moonshot AI';
    default: return vendor.charAt(0).toUpperCase() + vendor.slice(1);
  }
};

const providerDotClass = (provider: string): string => {
  const map: Record<string, string> = {
    openai: 'openai', anthropic: 'anthropic', google: 'google',
    xai: 'xai', deepseek: 'deepseek', glm: 'glm', kimi: 'kimi',
  };
  return map[provider?.toLowerCase()] || 'openai';
};

const statusColor = (status: string): string => {
  switch (status) {
    case 'excellent': return 'var(--phosphor-green)';
    case 'good': return 'var(--phosphor-green)';
    case 'warning': return 'var(--amber-warning)';
    case 'critical': return 'var(--red-alert)';
    default: return 'var(--phosphor-dim)';
  }
};

const trendIcon = (trend: string): string => {
  switch (trend) {
    case 'up': return '↗';
    case 'down': return '↘';
    case 'stable': return '→';
    default: return '—';
  }
};

const trendColor = (trend: string): string => {
  switch (trend) {
    case 'up': return 'var(--phosphor-green)';
    case 'down': return 'var(--red-alert)';
    default: return 'var(--phosphor-dim)';
  }
};

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
}: ModelDetailHeaderProps) {
  const router = useRouter();

  return (
    <div className="md-header">
      <div className="md-header-left">
        <button className="md-back-btn" onClick={() => router.push('/')}>
          ← DASH
        </button>
        <div className="md-model-info">
          <div className="md-model-name">
            {(displayName || modelName).toUpperCase()}
            <span className="blinking-cursor" style={{ marginLeft: '4px' }}></span>
          </div>
          <div className="md-model-sub">
            <span className={`v4-prov-dot ${providerDotClass(provider)}`} style={{ width: '5px', height: '5px' }}></span>
            {getProviderName(provider)}
            <span style={{ color: statusColor(status) }}>● {status.toUpperCase()}</span>
            <span style={{ color: trendColor(trend) }}>{trendIcon(trend)} {trend.toUpperCase()}</span>
            <span>{lastUpdated}</span>
          </div>
        </div>
      </div>
      <div className="md-header-right">
        <button
          className={`md-header-btn ${autoRefresh ? 'active' : ''}`}
          onClick={onToggleAutoRefresh}
        >
          {autoRefresh ? '🔄 AUTO ON' : '🔄 AUTO'}
        </button>
        <button
          className="md-header-btn"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? '⟳...' : '⟳ REFRESH'}
        </button>
      </div>
    </div>
  );
}
