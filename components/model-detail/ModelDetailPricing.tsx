'use client';

/**
 * What this model costs — to use, and to benchmark.
 *
 * The top half is list price, from lib/model-pricing.ts, shared with the leaderboard
 * price column so the two can never quote different numbers for the same model.
 *
 * The bottom half is what OUR benchmark actually spends on this model. Every suite
 * records the billed tokens and the USD each run cost, priced when the run happened,
 * so this is measured rather than modelled. It replaces an "estimated total" that
 * blended input and output 40/60 — a weighting nobody measured, which for a model
 * whose answers are mostly thinking tokens was badly wrong in the cheap direction.
 *
 * Cost capture began on 15 September 2026. A suite with no priced run yet says so
 * rather than showing a zero, because a model we have not priced and a model that
 * costs nothing are very different claims.
 */

import { useEffect, useState } from 'react';
import { getModelPricing } from '../../lib/model-pricing';

interface SuiteCost {
  suite: string;
  label: string;
  runsPerDay: number;
  measured: boolean;
  costPerRunUsd: number | null;
  costPerDayUsd: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  pricedRunsLast7d: number;
}

interface CostData {
  perSuite: SuiteCost[];
  dailyTotalUsd: number | null;
  monthlyTotalUsd: number | null;
  partialDailyUsd: number | null;
  suitesMeasured: number;
  suitesTotal: number;
  suitesMissing: string[];
  complete: boolean;
  anyMeasured: boolean;
}

interface ModelDetailPricingProps {
  modelName: string;
  provider: string;
  currentScore: number;
  modelId?: number | string;
}

/** Sub-cent runs need more places than dollars do. */
function usd(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

export default function ModelDetailPricing({ modelName, provider, currentScore, modelId }: ModelDetailPricingProps) {
  const pricing = getModelPricing(modelName, provider);
  const [cost, setCost] = useState<CostData | null>(null);

  useEffect(() => {
    if (modelId === undefined || modelId === null) return;
    let cancelled = false;
    const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
    fetch(`${apiUrl}/dashboard/model-cost/${modelId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (!cancelled && j?.success) setCost(j.data); })
      .catch(() => { /* cost is supplementary; the list price above still stands */ });
    return () => { cancelled = true; };
  }, [modelId]);

  // Value per dollar is anchored to what a benchmark run of this model really costs —
  // but ONLY once every suite has been priced. Dividing by a partial sum inflates the
  // score by exactly the factor the cost is short by, which on the first day was 25x.
  const perDay = cost?.complete ? cost.dailyTotalUsd : null;
  const blended = (pricing.input * 0.4) + (pricing.output * 0.6);
  const valueBasis = perDay && perDay > 0 ? perDay : blended;
  const valueScore = currentScore > 0 && valueBasis > 0 ? (currentScore / valueBasis) : 0;
  const valueColor = valueScore > 10 ? 'var(--phosphor-green)' : valueScore > 5 ? 'var(--amber-warning)' : 'var(--red-alert)';

  const measuredSuites = (cost?.perSuite ?? []).filter(s => s.measured);

  return (
    <div className="md-info-col">
      <div className="md-info-title">PRICING &amp; COST TO BENCHMARK</div>

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

      <div style={{ margin: '10px 0 6px', fontSize: '9px', letterSpacing: '0.06em', color: 'var(--phosphor-dim)' }}>
        WHAT ONE RUN OF EACH SUITE COSTS US
      </div>

      {measuredSuites.length > 0 ? (
        <>
          {measuredSuites.map(s => (
            <div className="md-info-row" key={s.suite}>
              <span className="md-info-label">
                {s.label}
                <span style={{ opacity: 0.55, marginLeft: 4 }}>
                  ×{s.runsPerDay}/day
                </span>
              </span>
              <span className="md-info-value" style={{ color: 'var(--phosphor-green)' }}>
                {usd(s.costPerRunUsd as number)}
                <span style={{ opacity: 0.55, marginLeft: 5 }}>
                  → {usd(s.costPerDayUsd as number)}/day
                </span>
              </span>
            </div>
          ))}
          <div className="md-info-row">
            <span className="md-info-label">
              {cost?.complete ? 'Total to benchmark' : `Priced so far (${cost?.suitesMeasured}/${cost?.suitesTotal} suites)`}
            </span>
            <span className="md-info-value" style={{ color: 'var(--amber-warning)' }}>
              {usd((cost?.complete ? cost.dailyTotalUsd : cost?.partialDailyUsd) as number)}/day
              {cost?.complete && cost?.monthlyTotalUsd ? (
                <span style={{ opacity: 0.55, marginLeft: 5 }}>
                  ≈ ${cost.monthlyTotalUsd.toFixed(0)}/mo
                </span>
              ) : null}
            </span>
          </div>
          {cost && !cost.complete && (
            <div style={{ marginTop: 6, fontSize: '9px', color: 'var(--phosphor-dim)', lineHeight: 1.4 }}>
              Not the full cost: {cost.suitesMissing.join(', ')}{' '}
              {cost.suitesMissing.length === 1 ? 'has' : 'have'} not run since cost capture
              began, so {cost.suitesMissing.length === 1 ? 'it is' : 'they are'} not counted
              here. Coding runs every four hours; reasoning and tooling once a day.
            </div>
          )}
        </>
      ) : (
        <div className="md-info-row">
          <span className="md-info-label" style={{ opacity: 0.7 }}>
            {cost ? 'No priced run yet' : 'Loading…'}
          </span>
          <span className="md-info-value" style={{ opacity: 0.7 }}>
            {cost ? 'capture began 15 Sep 2026' : ''}
          </span>
        </div>
      )}

      <div className="md-info-row">
        <span className="md-info-label">Value Score</span>
        <span className="md-info-value" style={{ color: valueColor }}>
          {valueScore.toFixed(1)} pts/$
          {!cost?.complete && (
            <span style={{ opacity: 0.55, marginLeft: 5 }}>vs list price</span>
          )}
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
        List price is USD per 1M tokens, cache-miss input, on the provider&apos;s own API.
        Run costs are measured: every suite records the tokens it was billed for and prices
        them when the run happens. Value score is score per dollar of a full day of
        benchmarking{measuredSuites.length === 0 ? ', falling back to list price until a run is priced' : ''}.
      </div>
    </div>
  );
}
