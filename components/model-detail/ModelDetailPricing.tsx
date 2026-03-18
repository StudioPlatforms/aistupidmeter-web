'use client';

// OFFICIAL VERIFIED pricing (Feb 17, 2026) - USD per 1M tokens
const getModelPricing = (name: string, provider: string): { input: number; output: number } => {
  const n = name.toLowerCase();
  const p = provider.toLowerCase();
  if (p === 'openai') {
    if (n.includes('gpt-5') && n.includes('turbo')) return { input: 10, output: 30 };
    if (n.includes('gpt-5') && n.includes('nano')) return { input: 0.05, output: 0.40 };
    if (n.includes('gpt-5') && n.includes('mini')) return { input: 0.25, output: 2.0 };
    if (n.includes('gpt-5.2') || n.includes('gpt-5-2')) return { input: 1.75, output: 14.0 };
    if (n.includes('gpt-5') && n.includes('codex')) return { input: 1.25, output: 10.0 };
    if (n.includes('gpt-5')) return { input: 1.25, output: 10.0 };
    if (n.includes('o3-pro')) return { input: 60, output: 240 };
    if (n.includes('o3-mini')) return { input: 3.5, output: 14 };
    if (n.includes('o3')) return { input: 15, output: 60 };
    if (n.includes('gpt-4o') && n.includes('mini')) return { input: 0.15, output: 0.6 };
    if (n.includes('gpt-4o')) return { input: 2.5, output: 10 };
    return { input: 3, output: 9 };
  }
  if (p === 'anthropic') {
    if (n.includes('opus-4-1') || n.includes('opus-4.1')) return { input: 15, output: 75 };
    if (n.includes('opus-4.5') || n.includes('opus-4-5')) return { input: 5, output: 25 };
    if (n.includes('opus-4.6') || n.includes('opus-4-6')) return { input: 5, output: 25 };
    if (n.includes('opus-4')) return { input: 5, output: 25 };
    if (n.includes('sonnet-4.5') || n.includes('sonnet-4-5')) return { input: 3, output: 15 };
    if (n.includes('sonnet-4') || n.includes('3-7-sonnet')) return { input: 3, output: 15 };
    if (n.includes('haiku-4')) return { input: 0.25, output: 1.25 };
    if (n.includes('3-5-sonnet')) return { input: 3, output: 15 };
    if (n.includes('3-5-haiku')) return { input: 0.25, output: 1.25 };
    return { input: 3, output: 15 };
  }
  if (p === 'xai' || p === 'x.ai') {
    if (n.includes('grok-code-fast')) return { input: 0.20, output: 1.50 };
    if (n.includes('grok-4')) return { input: 3, output: 15 };
    if (n.includes('grok-3') && n.includes('mini')) return { input: 0.30, output: 0.50 };
    if (n.includes('grok-3')) return { input: 3, output: 15 };
    return { input: 3, output: 15 };
  }
  if (p === 'google') {
    if (n.includes('gemini-3') && n.includes('pro')) return { input: 2, output: 12 };
    if (n.includes('2.5-pro')) return { input: 1.25, output: 10 };
    if (n.includes('2.5-flash-lite')) return { input: 0.10, output: 0.40 };
    if (n.includes('2.5-flash')) return { input: 0.30, output: 2.50 };
    if (n.includes('1.5-pro')) return { input: 1.25, output: 5 };
    if (n.includes('1.5-flash')) return { input: 0.075, output: 0.3 };
    return { input: 1, output: 3 };
  }
  if (p === 'deepseek') return { input: 0.28, output: 0.42 };
  if (p === 'glm') return { input: 0.60, output: 2.20 };
  if (p === 'kimi') return { input: 0.60, output: 2.50 };
  return { input: 2, output: 6 };
};

interface ModelDetailPricingProps {
  modelName: string;
  provider: string;
  currentScore: number;
}

export default function ModelDetailPricing({ modelName, provider, currentScore }: ModelDetailPricingProps) {
  const pricing = getModelPricing(modelName, provider);
  const estimatedCost = (pricing.input * 0.4) + (pricing.output * 0.6);
  const valueScore = currentScore > 0 ? (currentScore / estimatedCost).toFixed(1) : '0.0';
  const vs = Number(valueScore);

  const valueColor = vs > 10 ? 'var(--phosphor-green)' : vs > 5 ? 'var(--amber-warning)' : 'var(--red-alert)';

  return (
    <div className="md-info-col">
      <div className="md-info-title">💰 PRICING & VALUE</div>
      <div className="md-info-row">
        <span className="md-info-label">Input Cost</span>
        <span className="md-info-value" style={{ color: 'var(--phosphor-green)' }}>
          ${pricing.input}/1M tokens
        </span>
      </div>
      <div className="md-info-row">
        <span className="md-info-label">Output Cost</span>
        <span className="md-info-value" style={{ color: 'var(--phosphor-green)' }}>
          ${pricing.output}/1M tokens
        </span>
      </div>
      <div className="md-info-row">
        <span className="md-info-label">Estimated Total</span>
        <span className="md-info-value" style={{ color: 'var(--amber-warning)' }}>
          ${estimatedCost.toFixed(2)}/1M tokens
        </span>
      </div>
      <div className="md-info-row">
        <span className="md-info-label">Value Score</span>
        <span className="md-info-value" style={{ color: valueColor }}>
          {valueScore} pts/$
        </span>
      </div>
      <div style={{
        marginTop: '10px',
        padding: '8px',
        background: 'rgba(0, 255, 65, 0.03)',
        border: '1px solid rgba(0, 255, 65, 0.15)',
        borderRadius: '3px',
        fontSize: '9px',
        color: 'var(--phosphor-dim)',
        lineHeight: '1.4'
      }}>
        Pricing: USD per 1M tokens (input×0.4 + output×0.6 blend). Value score = performance per dollar spent.
      </div>
    </div>
  );
}
