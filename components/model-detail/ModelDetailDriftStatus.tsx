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
interface SuiteState { cusum: number; days: number; armed: boolean; threshold: number; coldStart: number }
interface Signature {
  driftStatus?: 'NORMAL' | 'WARNING' | 'ALERT';
  dataSource?: 'measured' | 'synthetic';
  pageHinkleyBySuite?: Record<SuiteKey, SuiteState>;
}

const LABEL: Record<SuiteKey, string> = { hourly: 'Coding', tooling: 'Tool use', deep: 'Reasoning' };
const ORDER: SuiteKey[] = ['hourly', 'tooling', 'deep'];

function chipState(s: SuiteState): 'cold' | 'ok' | 'warn' | 'alert' {
  if (!s.armed) return 'cold';
  if (s.cusum >= s.threshold) return 'alert';
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
          const detail = s.armed
            ? `statistic ${s.cusum.toFixed(2)} of ${s.threshold.toFixed(2)} needed to fire`
            : `warming up · ${Math.min(s.days, s.coldStart)} of ${s.coldStart} days`;
          const title = s.armed
            ? `${LABEL[k]}: Page-Hinkley statistic ${s.cusum.toFixed(3)}; fires at ${s.threshold.toFixed(2)}. ${s.days} measured days on the current configuration.`
            : `${LABEL[k]}: ${s.days} of ${s.coldStart} measured days since this suite's configuration last changed. The detector cannot fire until it has ten.`;
          return (
            <span key={k} className={`md-ds-chip md-ds-${state}${focus === k ? ' md-ds-focus' : ''}${focus && focus !== k ? ' md-ds-dim' : ''}`} title={title}>
              <span className="md-ds-name">{LABEL[k]}</span>
              <span className="md-ds-detail">{detail}</span>
            </span>
          );
        })}
      </div>

      <div className="md-ds-foot">
        One Page-Hinkley statistic per suite on its own daily series, never blended; a suite fires at
        {' '}{by.hourly?.threshold.toFixed(2) ?? '0.30'}. &ldquo;Warming up&rdquo; means fewer than ten measured
        days since that suite&rsquo;s configuration last changed, so it cannot fire yet
        {anyArmed ? '' : ' — nothing here is a verdict on the model'}.
      </div>
    </div>
  );
}
