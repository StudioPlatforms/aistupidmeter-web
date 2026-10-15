'use client';

/**
 * Runs people made against this model with their OWN API keys.
 *
 * WHY THIS PANEL IS SEPARATE FROM EVERY OTHER NUMBER ON THE PAGE
 * -------------------------------------------------------------
 * These results used to be written straight into the `scores` table, and the
 * consent modal on the test page sold it as a feature: "your score becomes the
 * latest reference for this model", "results will appear in live rankings". One
 * person with an API key could move a published number with a single run.
 *
 * They now live in their own table and are shown here, clearly labelled, because
 * they are genuinely interesting — a model can behave differently on a different
 * account tier, region or rate limit than it does on ours — but they are NOT
 * measurement. Each is one sample, on one key, at one moment, unscheduled. The
 * published score above is a median over repeated runs on a fixed cadence.
 *
 * The panel hides itself when nobody has tested the model, rather than showing an
 * empty shell: an absent panel reads as "no data", an empty one reads as "zero".
 */

import { useEffect, useState } from 'react';
import { Pane, Note } from '@/components/studio';
import '@/styles/studio-model-panels.css';

interface SuiteAggregate {
  n: number;
  testers: number;
  median: number | null;
  min: number | null;
  max: number | null;
  latest: string | null;
}

interface CommunityResponse {
  model: string;
  bySuite: Record<string, SuiteAggregate>;
  explainer: string;
}

const SUITE_LABEL: Record<string, string> = {
  coding: 'Coding',
  reasoning: 'Reasoning',
  tooling: 'Tool calling',
};

export default function ModelDetailCommunityTests({
  modelName,
  publishedScore,
}: {
  modelName: string;
  /** Our own current score, so the two can be put side by side honestly. */
  publishedScore?: number | null;
}) {
  const [data, setData] = useState<CommunityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!modelName) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/test-adapters/community/${encodeURIComponent(modelName)}`);
        if (r.ok && !cancelled) setData(await r.json());
      } catch {
        /* community data is supplementary — never block the page on it */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [modelName]);

  if (loading || !data) return null;

  const suites = Object.entries(data.bySuite).filter(([, v]) => v.n > 0);
  // Nothing tested yet: show nothing rather than an empty panel.
  if (suites.length === 0) return null;

  const totalRuns = suites.reduce((a, [, v]) => a + v.n, 0);
  const totalTesters = Math.max(...suites.map(([, v]) => v.testers));

  return (
    <Pane
      title="Tested by others with their own keys"
      sub={`${totalRuns} run${totalRuns === 1 ? '' : 's'} · ${totalTesters} tester${totalTesters === 1 ? '' : 's'}`}
      ruled
      flush
    >
      {/* The honesty label comes first: these are individual samples, not measurement. */}
      <div className="sq-pad is-ruled">
        <Note>{data.explainer}</Note>
      </div>
      <div className="sq-cols is-narrow">
        {suites.map(([suite, v]) => {
          const delta = v.median != null && publishedScore != null ? v.median - publishedScore : null;
          return (
            <div key={suite} className="sq-col">
              <p className="st-label">{SUITE_LABEL[suite] ?? suite}</p>
              <div className="sq-big">
                <b>{v.median != null ? Math.round(v.median) : '—'}</b>
                <span>median of {v.n}</span>
              </div>
              <p className="sq-ct-range">
                range {v.min != null ? Math.round(v.min) : '—'}–{v.max != null ? Math.round(v.max) : '—'}
                {delta != null && (
                  <> · <span className={Math.abs(delta) < 5 ? '' : delta > 0 ? 'is-up' : 'is-dn'}>
                    {delta > 0 ? '+' : ''}{Math.round(delta)} vs our score
                  </span></>
                )}
              </p>
              {v.latest && (
                <p className="sq-ct-latest">
                  latest {new Date(v.latest).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Pane>
  );
}
