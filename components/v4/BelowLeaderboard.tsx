'use client';

import type React from 'react';
import '../../styles/studio-boards.css';

interface BelowLeaderboardProps {
  transparencyMetrics: any;
  modelScores: any[];
}

export default function BelowLeaderboard({ transparencyMetrics, modelScores }: BelowLeaderboardProps) {
  const totalModels = modelScores.length;
  const availableModels = modelScores.filter(m => m.currentScore !== 'unavailable').length;
  const providers = new Set(modelScores.map(m => m.provider)).size;
  // transparencyMetrics from API has shape: { summary: { coverage, confidence, ... }, modelFreshness: [...] }
  const summary = transparencyMetrics?.summary || transparencyMetrics || {};
  const coverage = summary?.coverage != null
    ? `${Math.round(summary.coverage)}%`
    : totalModels > 0 ? `${Math.round((availableModels / totalModels) * 100)}%` : '—';
  const confidence = summary?.confidence != null
    ? `${Math.round(summary.confidence)}%`
    : '—';
  const ciWidth = summary?.avgCIWidth != null
    ? Number(summary.avgCIWidth).toFixed(1)
    : '—';

  // Before any scores have loaded these are 0, and printing a literal 0 reads
  // as "this site tracks nothing" rather than "not loaded yet". Match the
  // em-dash the other metrics above already use, and keep the prose honest by
  // dropping the counts entirely instead of claiming "0+ AI models across 0
  // providers".
  const hasCounts = totalModels > 0 && providers > 0;
  const modelsLabel = totalModels > 0 ? String(totalModels) : '—';
  const providersLabel = providers > 0 ? String(providers) : '—';

  return (
    <div className="v4-below-lb sl-info-wrap">
      <div className="sl-info">
        {/* Data Transparency */}
        <section className="sl-pane st-up" aria-label="Data transparency">
          <h3 className="sl-pane-t">Data transparency</h3>
          <dl className="st-kv is-tight" style={{ marginTop: 12 }}>
            <div><dt>Test coverage</dt><dd>{coverage}</dd></div>
            <div>
              <dt title="Share of ranked models on schedule, suite slots filled, and recent data volume. The statistical figure is the CI width below.">Data completeness</dt>
              <dd>{confidence}</dd>
            </div>
            <div><dt>Avg CI width</dt><dd>{ciWidth}</dd></div>
            <div><dt>Models tracked</dt><dd>{modelsLabel}</dd></div>
            <div><dt>Providers monitored</dt><dd>{providersLabel}</dd></div>
            <div><dt>Detection method</dt><dd>Page-Hinkley (CUSUM-family)</dd></div>
          </dl>
        </section>

        {/* Benchmark Schedule */}
        <section className="sl-pane st-up" aria-label="Benchmark schedule" style={{ '--d': '.06s' } as React.CSSProperties}>
          <h3 className="sl-pane-t">Benchmark schedule</h3>
          <dl className="st-kv is-tight" style={{ marginTop: 12 }}>
            <div><dt>Canary (drift detect)</dt><dd>Every hour</dd></div>
            <div><dt>Full 9-axis (code)</dt><dd>Every 4 hours</dd></div>
            <div><dt>Deep reasoning</dt><dd>Daily 03:00 Europe/Berlin</dd></div>
            <div><dt>Tool calling</dt><dd>Daily 04:00 Europe/Berlin</dd></div>
            <div><dt>Health monitoring</dt><dd>Every 10 minutes</dd></div>
            <div><dt>Scoring</dt><dd>9-axis w/ 95% CI</dd></div>
          </dl>
        </section>
      </div>

      {/* System description */}
      <section className="sl-pane sl-about st-up" aria-label="About the measurements">
        <div>
          <h3>What is continuous evaluation?</h3>
          <p>
            Continuous, independent measurement of whether AI models degrade behind a stable API name. We benchmark{hasCounts ? ` ${totalModels}+ AI models across ${providers} providers` : ' AI models across every major provider'} using automated coding challenges, deep reasoning tasks, and tool-calling evaluations.
            Page-Hinkley change-point detection separates a sustained regression from run-to-run noise, and every composite score says how many suites actually contributed to it.
          </p>
        </div>
        <div>
          <h3>Test your own keys</h3>
          <p>
            Run the exact same benchmarks with your own API keys. Verify our results independently.
            Compare your provider&apos;s performance against our public rankings.
          </p>
        </div>
      </section>
    </div>
  );
}
