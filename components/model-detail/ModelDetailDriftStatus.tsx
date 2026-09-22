'use client';

/**
 * Where each suite's drift detector stands, in words a visitor can act on.
 *
 * The Page-Hinkley statistic runs on each suite's own daily series (coding, tool use,
 * reasoning) and restarts whenever that suite's configuration changes, with a ten-day cold
 * start. A quiet detector and a detector that cannot fire yet look identical in a status word,
 * so this strip says which one it is: "armed" with the statistic against its threshold, or
 * "warming up, N of 10 days". Free for every visitor; the curve behind it is the Pro chart below.
 */

import { useEffect, useState } from 'react';

type SuiteKey = 'hourly' | 'tooling' | 'deep';
interface SuiteState {
  cusum: number; days: number; armed: boolean; threshold: number; coldStart: number;
  /** consecutive daily readings above the threshold needed before the detector fires (tool use: 3) */
  confirm?: number;
  /** consecutive armed readings above the threshold, ending at the newest one */
  above?: number;
  /** the detector fired on the newest reading */
  fired?: boolean;
}
interface Signature {
  driftStatus?: 'NORMAL' | 'WARNING' | 'ALERT';
  dataSource?: 'measured' | 'synthetic';
  pageHinkleyBySuite?: Record<SuiteKey, SuiteState>;
}

const LABEL: Record<SuiteKey, string> = { hourly: 'Coding', tooling: 'Tool use', deep: 'Reasoning' };
const ORDER: SuiteKey[] = ['hourly', 'tooling', 'deep'];

// A reading above the threshold is an alert only once the detector has fired on it. Tool use
// needs three consecutive daily readings above its threshold, so its first two are a warning.
// `fired` is absent from older API responses; those fall back to the threshold comparison.
function chipState(s: SuiteState): 'cold' | 'ok' | 'warn' | 'alert' {
  if (!s.armed) return 'cold';
  if (s.fired ?? s.cusum >= s.threshold) return 'alert';
  if (s.cusum >= s.threshold / 2) return 'warn';
  return 'ok';
}

export default function ModelDetailDriftStatus({ modelId, focus = null }: { modelId: string | number; focus?: SuiteKey | null }) {
  const [sig, setSig] = useState<Signature | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    // Same-origin in production so the site's origin-token fetch wrapper attaches the header
    // (lib/asl-token.ts guards every /api/drift/ path).
    const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
    fetch(`${apiUrl}/api/drift/signature/${modelId}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(j => { if (alive) setSig(j?.data ?? null); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [modelId]);

  // Older API or no signature: render nothing rather than an empty shell.
  if (failed || !sig?.pageHinkleyBySuite) return null;
  if (sig.dataSource === 'synthetic') return null;

  const by = sig.pageHinkleyBySuite;
  const status = sig.driftStatus ?? 'NORMAL';
  const anyArmed = ORDER.some(k => by[k]?.armed);

  return (
    <div className="md-chart-section">
      <div className="md-chart-title">
        DRIFT STATUS BY SUITE
        <span className={`md-ds-status md-ds-status-${status.toLowerCase()}`}>{status}</span>
      </div>

      <div className="md-ds-chips">
        {ORDER.map(k => {
          const s = by[k];
          if (!s) return null;
          const state = chipState(s);
          const days = Math.min(s.days, s.coldStart);

          // The statistic is shown whether or not the detector has armed.
          //
          // While warming up this used to read only "warming up - 5 of 10 days", which
          // is a progress bar for us and tells the reader nothing about their model. The
          // statistic is a real measurement from the first day; what the cold start
          // withholds is the right to ACT on it, not its existence. So the number and its
          // distance from the firing threshold are always on screen, and the warm-up line
          // sits underneath as the caveat it actually is.
          const pctOfThreshold = s.threshold > 0
            ? Math.max(0, Math.min(100, (s.cusum / s.threshold) * 100))
            : 0;
          const confirm = s.confirm ?? 1;
          const pending = s.armed && !s.fired && confirm > 1 && (s.above ?? 0) > 0;
          const firesAt = confirm > 1
            ? `fires when it stays above ${s.threshold.toFixed(2)} for ${confirm} consecutive daily runs`
            : `fires at ${s.threshold.toFixed(2)}`;
          const title = s.armed
            ? `${LABEL[k]}: Page-Hinkley statistic ${s.cusum.toFixed(3)}; ${firesAt}. ${s.days} measured days on the current configuration.`
            : `${LABEL[k]}: Page-Hinkley statistic ${s.cusum.toFixed(3)} against a firing threshold of ${s.threshold.toFixed(2)}. ${s.days} of ${s.coldStart} measured days since this suite's configuration last changed — the detector cannot fire until it has ${s.coldStart}, so this figure is an early reading, not a verdict.`;
          return (
            <span key={k} className={`md-ds-chip md-ds-${state}${focus === k ? ' md-ds-focus' : ''}${focus && focus !== k ? ' md-ds-dim' : ''}`} title={title}>
              <span className="md-ds-name">{LABEL[k]}</span>
              <span className="md-ds-stat">
                <span className="md-ds-stat-v">{s.cusum.toFixed(3)}</span>
                <span className="md-ds-stat-of">/ {s.threshold.toFixed(2)}</span>
              </span>
              <span className="md-ds-meter" aria-hidden="true">
                <span className={`md-ds-meter-fill md-ds-meter-${state}`} style={{ width: `${Math.max(pctOfThreshold, 1.5)}%` }} />
              </span>
              <span className="md-ds-detail">
                {pending
                  ? `above threshold · day ${s.above} of the ${confirm} in a row needed to fire`
                  : s.armed
                  ? `${Math.round(pctOfThreshold)}% of the way to firing`
                  : `${Math.round(pctOfThreshold)}% of threshold · baseline ${days}/${s.coldStart} days`}
              </span>
            </span>
          );
        })}
      </div>

      <div className="md-ds-foot">
        One Page-Hinkley statistic per suite on its own daily series, never blended. Coding and reasoning
        fire at {by.hourly?.threshold.toFixed(2) ?? '0.30'}; tool use, which is noisier, fires only when its
        statistic stays above {by.tooling?.threshold.toFixed(2) ?? '0.50'} for {by.tooling?.confirm ?? 3} consecutive
        daily runs. The statistic is measured from day one, but a
        suite needs ten measured days since its configuration last changed before a reading is allowed
        to fire{anyArmed ? '' : ' — so the figures above are early readings, not verdicts'}.
      </div>
    </div>
  );
}
