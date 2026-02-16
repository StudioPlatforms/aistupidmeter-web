'use client';

interface ProviderStripProps {
  modelScores: any[];
}

const PROVIDERS = [
  { key: 'openai', label: 'GPT', dot: 'openai' },
  { key: 'anthropic', label: 'CLAUDE', dot: 'anthropic' },
  { key: 'google', label: 'GEMINI', dot: 'google' },
  { key: 'xai', label: 'GROK', dot: 'xai' },
  { key: 'deepseek', label: 'DEEPSEEK', dot: 'deepseek' },
  { key: 'glm', label: 'GLM', dot: 'glm' },
];

export default function ProviderStrip({ modelScores }: ProviderStripProps) {
  const getProviderStatus = (providerKey: string): { label: string; color: string } => {
    const providerModels = modelScores.filter(m => m.provider === providerKey);
    if (providerModels.length === 0) return { label: '—', color: 'var(--phosphor-dim)' };

    const available = providerModels.filter(m => typeof m.currentScore === 'number');
    if (available.length === 0) return { label: 'DOWN', color: 'var(--red-alert)' };

    const degraded = available.filter(m => m.trend === 'down');
    if (degraded.length > available.length / 2) return { label: 'DEGR', color: 'var(--amber-warning)' };
    if (degraded.length > 0) return { label: 'WARN', color: 'var(--amber-warning)' };

    return { label: 'OK', color: 'var(--phosphor-green)' };
  };

  const activeProviders = PROVIDERS.filter(p =>
    modelScores.some(m => m.provider === p.key)
  );

  return (
    <div className="v4-prov-strip">
      {activeProviders.map(p => {
        const status = getProviderStatus(p.key);
        return (
          <div key={p.key} className="v4-prov-chip">
            <div className={`v4-prov-dot ${p.dot}`} style={{ width: '6px', height: '6px' }}></div>
            {p.label}{' '}
            <span className="status" style={{ color: status.color }}>{status.label}</span>
          </div>
        );
      })}
    </div>
  );
}
