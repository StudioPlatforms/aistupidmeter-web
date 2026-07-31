'use client';

// Pricing comes from lib/model-pricing.ts, shared with the leaderboard price
// view so the two can never quote different numbers for the same model.
import { getModelPricing } from '../../lib/model-pricing';

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
        background: 'rgba(26, 115, 232, 0.03)',
        border: '1px solid rgba(26, 115, 232, 0.15)',
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
