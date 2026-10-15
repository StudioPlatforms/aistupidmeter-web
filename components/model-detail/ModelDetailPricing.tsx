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
import { Pane } from '@/components/studio';

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

  const measuredSuites = (cost?.perSuite ?? []).filter(s => s.measured);
  const valueTone = valueScore > 10 ? 'sm-kv-good' : valueScore > 5 ? 'sm-kv-warn' : 'sm-kv-bad';

  return (
    <Pane
      title="Pricing & cost to benchmark"
      sub="What this model costs to use, and what our benchmark spends on it"
      foot={
        <>
          List price is USD per 1M tokens, cache-miss input, on the provider&apos;s own API.
          Run costs are measured: every suite records the tokens it was billed for and prices
          them when the run happens. Value score is score per dollar of a full day of
          benchmarking{measuredSuites.length === 0 ? ', falling back to list price until a run is priced' : ''}.
        </>
      }
    >
      <dl className="st-kv sm-kv">
        <div><dt>Input cost</dt><dd>${pricing.input}<small>/1M tokens</small></dd></div>
        <div><dt>Output cost</dt><dd>${pricing.output}<small>/1M tokens</small></dd></div>
      </dl>

      <p className="st-label">What one run of each suite costs us</p>

      {measuredSuites.length > 0 ? (
        <>
          <dl className="st-kv sm-kv">
            {measuredSuites.map(s => (
              <div key={s.suite}>
                <dt>{s.label}<small>×{s.runsPerDay}/day</small></dt>
                <dd>
                  {usd(s.costPerRunUsd as number)}
                  <small>→ {usd(s.costPerDayUsd as number)}/day</small>
                </dd>
              </div>
            ))}
            <div>
              <dt>{cost?.complete ? 'Total to benchmark' : `Priced so far (${cost?.suitesMeasured}/${cost?.suitesTotal} suites)`}</dt>
              <dd>
                {usd((cost?.complete ? cost.dailyTotalUsd : cost?.partialDailyUsd) as number)}/day
                {cost?.complete && cost?.monthlyTotalUsd ? (
                  <small>≈ ${cost.monthlyTotalUsd.toFixed(0)}/mo</small>
                ) : null}
              </dd>
            </div>
          </dl>
          {cost && !cost.complete && (
            <p className="sm-cost-note">
              Not the full cost: {cost.suitesMissing.join(', ')}{' '}
              {cost.suitesMissing.length === 1 ? 'has' : 'have'} not run since cost capture
              began, so {cost.suitesMissing.length === 1 ? 'it is' : 'they are'} not counted
              here. Coding runs every four hours; reasoning and tooling once a day.
            </p>
          )}
        </>
      ) : (
        <dl className="st-kv sm-kv">
          <div>
            <dt>{cost ? 'No priced run yet' : 'Loading…'}</dt>
            <dd className="st-faint">{cost ? 'capture began 15 Sep 2026' : ''}</dd>
          </div>
        </dl>
      )}

      <dl className="st-kv sm-kv sm-value">
        <div>
          <dt>Value score</dt>
          <dd>
            <span className={valueTone}>{valueScore.toFixed(1)} pts/$</span>
            {!cost?.complete && <small>vs list price</small>}
          </dd>
        </div>
      </dl>
    </Pane>
  );
}
