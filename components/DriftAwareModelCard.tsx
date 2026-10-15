/**
 * PHASE 3: Drift-Aware Model Card Component
 * Displays model scores with drift status, regime classification, and alert indicators
 */

'use client';

import { useState, useEffect } from 'react';
import '../styles/drift-cards.css';
import '../styles/studio-boards.css';

interface DriftSignature {
  modelId: number;
  modelName: string;
  timestamp: string;
  baselineScore: number;
  currentScore: number;
  confidenceInterval: [number, number];
  // Frozen "golden" baseline (A1): the model's earliest stable window.
  // driftVsGolden = goldenBaseline - current (positive = degraded since launch).
  goldenBaselineScore?: number;
  driftVsGolden?: number;
  regime: 'STABLE' | 'VOLATILE' | 'DEGRADED' | 'RECOVERING';
  variance24h: number;
  driftStatus: 'NORMAL' | 'WARNING' | 'ALERT';
  pageHinkleyCUSUM: number;
  lastSignificantChange?: string;
  hoursSinceChange?: number;
  axes: {
    [key: string]: {
      value: number;
      trend: 'up' | 'down' | 'stable';
      changeMagnitude: number;
      status: 'STABLE' | 'VOLATILE' | 'DEGRADED';
      // 0 = the API had no observation; `value` is then a neutral placeholder.
      sampleSize?: number;
    };
  };
  // 'synthetic' = modelled series shown while live benchmarking is paused.
  dataSource?: 'measured' | 'synthetic';
  // Provenance of the axis breakdown, which can be modelled even when the score
  // series is measured (only the hourly suite scores these axes).
  axesSource?: 'measured' | 'synthetic' | 'none';
  primaryIssue?: string;
  recommendation?: string;
}

interface ModelCardProps {
  model: {
    id: string;
    name: string;
    provider: string;
    currentScore: number | 'unavailable';
    trend: string;
    history?: any[];
    isStale?: boolean;
    staleDuration?: number;
  };
  compact?: boolean;
  showDriftInfo?: boolean;
}

export default function DriftAwareModelCard({ model, compact = true, showDriftInfo = true }: ModelCardProps) {
  const [driftSignature, setDriftSignature] = useState<DriftSignature | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!showDriftInfo) {
      setLoading(false);
      return;
    }

    // Fetch drift signature from API
    const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
    fetch(`${apiUrl}/api/drift/signature/${model.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setDriftSignature(data.data);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error(`Failed to fetch drift signature for ${model.name}:`, error);
        setLoading(false);
      });
  }, [model.id, model.name, showDriftInfo]);

  // If not showing drift info or still loading, return classic card
  if (!showDriftInfo || loading) {
    return null; // Let parent component render classic card
  }

  const drift = driftSignature;
  if (!drift) {
    return null; // No drift data available
  }

  const regimeClass = `drift-${drift.regime.toLowerCase()}`;
  const toggle = () => setExpanded(!expanded);

  return (
    <div
      className={`model-card ${regimeClass}`}
      onClick={toggle}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      style={{ cursor: 'pointer' }}
    >
      {/* Header Row */}
      <div className="sl-dc-head">
        <div className="sl-dc-id">
          <span className="sl-dc-name">{model.name}</span>
          <span className="sl-dc-prov">{model.provider}</span>
        </div>
        <span className={`st-tag ${REGIME_TONE[drift.regime] || ''}`}>{sentence(drift.regime)}</span>
      </div>

      {/* Score Row */}
      <div className="sl-dc-score">
        <b>{drift.currentScore}</b>
        <span>±{Math.round((drift.confidenceInterval[1] - drift.confidenceInterval[0]) / 2)}</span>
        {drift.driftStatus !== 'NORMAL' && (
          <span className={`st-tag ${drift.driftStatus === 'ALERT' ? 'is-bad' : 'is-warn'}`}>{sentence(drift.driftStatus)}</span>
        )}
      </div>

      {/* Since-launch drift badge (golden baseline) */}
      {renderSinceLaunch(drift)}

      {/* Staleness warning */}
      {model.isStale && model.staleDuration && (
        <div className="st-note is-warn sl-dc-alert"><div>Data {model.staleDuration}h old (API credits may be exhausted)</div></div>
      )}

      {!expanded && (
        <>
          {/* Mini Metrics (Collapsed View - Top 3 axes) */}
          <div className="sl-dc-axes">
            {Object.entries(drift.axes)
              .filter(([, axis]: [string, any]) => axis?.sampleSize === undefined || axis.sampleSize > 0)
              .slice(0, 3)
              .map(([key, axis]: [string, any]) => (
              <div key={key} className="sl-dc-axis">
                <span>{formatAxisName(key)}</span>
                <span className={`sl-sbar ${STATUS_BAR[axis.status] || ''}`} aria-hidden="true">
                  <i style={{ width: `${axis.value * 100}%` }} />
                </span>
                <span className="sl-dc-axis-v">{Math.round(axis.value * 100)}</span>
                <span className={`sl-dc-trend${axis.trend !== 'stable' ? ` is-${axis.trend}` : ''}`} aria-label={`trend ${axis.trend}`}>
                  {axis.trend === 'up' ? '▲' : axis.trend === 'down' ? '▼' : ''}
                </span>
              </div>
            ))}
          </div>

          {/* Provenance: modelled series must never read as a measurement. */}
          {drift.dataSource === 'synthetic' && (
            <div className="sl-dc-meta" title="No live benchmark runs in the last 28 days — this signature is derived from modelled scores and never raises an alert.">
              Modelled data — live benchmarking paused
            </div>
          )}

          {/* Last Change Indicator */}
          {drift.hoursSinceChange !== undefined && (
            <div className="sl-dc-meta">
              Last changed: {formatTimeSince(drift.hoursSinceChange)}
            </div>
          )}

          {/* Issue Warning */}
          {drift.primaryIssue && (
            <div className="st-note is-warn sl-dc-alert"><div>{drift.primaryIssue}</div></div>
          )}

          <span className="sl-dc-more">Click to expand</span>
        </>
      )}

      {expanded && (
        <>
          {/* Drift Summary Panel */}
          <dl className="st-kv is-tight sl-dc-sum">
            <div><dt>Baseline</dt><dd>{drift.baselineScore}</dd></div>
            <div><dt>Current</dt><dd>{drift.currentScore}</dd></div>
            <div><dt>Variance (24h)</dt><dd>±{drift.variance24h.toFixed(1)}</dd></div>
            <div>
              <dt>Status</dt>
              <dd className={drift.driftStatus === 'ALERT' ? 'is-bad' : drift.driftStatus === 'WARNING' ? 'is-warn' : ''}>{sentence(drift.driftStatus)}</dd>
            </div>
            {typeof drift.goldenBaselineScore === 'number' && (
              <div><dt>At launch</dt><dd>{Math.round(drift.goldenBaselineScore)}</dd></div>
            )}
            {typeof drift.driftVsGolden === 'number' && (
              <div>
                <dt>Since launch</dt>
                <dd className={SINCE_TONE[sinceLaunchClass(drift.driftVsGolden)] || ''}>{formatSinceLaunch(drift.driftVsGolden)}</dd>
              </div>
            )}
          </dl>

          {/* Dimensional Breakdown */}
          <h4 className="sl-dc-h4">Performance dimensions</h4>
          {drift.axesSource === 'synthetic' && (
            <div className="sl-dc-meta">
              Modelled — no live benchmark runs scored these dimensions in the last 28 days.
            </div>
          )}
          <div className="sl-dc-axes">
            {Object.entries(drift.axes).map(([key, axis]: [string, any]) => {
              // sampleSize 0 means nothing was measured — `value` is a neutral
              // placeholder, so draw no bar and say so instead of a fake reading.
              const measured = axis?.sampleSize === undefined || axis.sampleSize > 0;
              return (
                <div key={key} className="sl-dc-axis">
                  <span>
                    {formatAxisName(key)}
                    {measured && axis.status === 'DEGRADED' && <> <span className="st-tag is-bad">degraded</span></>}
                  </span>
                  <span className={`sl-sbar ${measured ? STATUS_BAR[axis.status] || '' : ''}`} aria-hidden="true">
                    {measured && <i style={{ width: `${axis.value * 100}%` }} />}
                  </span>
                  <span className="sl-dc-axis-v">{measured ? Math.round(axis.value * 100) : '—'}</span>
                  <span className={`sl-dc-trend${measured && axis.trend !== 'stable' ? ` is-${axis.trend}` : ''}`}>
                    {measured && axis.trend !== 'stable' ? (axis.trend === 'up' ? '▲' : '▼') : ''}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Alert Panel (if issues exist) */}
          {drift.primaryIssue && (
            <div className={`st-note sl-dc-alert ${drift.driftStatus === 'ALERT' ? 'is-bad' : 'is-warn'}`}>
              <div>
                <b className="st-note-t">{drift.primaryIssue}</b>
                {drift.recommendation && (
                  <div><strong>Recommendation:</strong> {drift.recommendation}</div>
                )}
                {drift.lastSignificantChange && (
                  <div>
                    Detected: {new Date(drift.lastSignificantChange).toLocaleString()}{' '}
                    ({formatTimeSince(drift.hoursSinceChange!)} ago)
                  </div>
                )}
              </div>
            </div>
          )}

          <span className="sl-dc-more">Click to collapse</span>
        </>
      )}
    </div>
  );
}

const REGIME_TONE: Record<string, string> = { STABLE: 'is-good', VOLATILE: 'is-warn', DEGRADED: 'is-bad', RECOVERING: 'is-accent' };
const STATUS_BAR: Record<string, string> = { STABLE: 'is-good', VOLATILE: 'is-warn', DEGRADED: 'is-bad' };
const SINCE_TONE: Record<string, string> = { 'since-launch--up': 'is-good', 'since-launch--down': 'is-warn', 'since-launch--severe': 'is-bad' };
const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

// Helper functions
function formatAxisName(key: string): string {
  // camelCase to sentence case: codeQuality → "Code quality"
  const words = key.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatTimeSince(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

// ---- Golden-baseline "since launch" helpers (A1) ----
// driftVsGolden = goldenBaseline - current; positive means degraded since launch.
// We only surface the badge once the gap is meaningful (>= 8 points).
const SINCE_LAUNCH_MIN = 8;   // floor matching backend goldenWarn
const SINCE_LAUNCH_SEVERE = 12; // floor matching backend goldenAlert

function sinceLaunchClass(driftVsGolden: number): string {
  if (driftVsGolden <= -SINCE_LAUNCH_MIN) return 'since-launch--up';
  if (driftVsGolden >= SINCE_LAUNCH_SEVERE) return 'since-launch--severe';
  if (driftVsGolden >= SINCE_LAUNCH_MIN) return 'since-launch--down';
  return 'since-launch--flat';
}

function formatSinceLaunch(driftVsGolden: number): string {
  // Change since launch = current - goldenBaseline = -driftVsGolden
  const delta = Math.round(-driftVsGolden);
  if (delta > 0) return `+${delta}`;
  return `${delta}`; // already carries the minus sign, or "0"
}

// Collapsed-view badge: only render when the gap is meaningful.
function renderSinceLaunch(drift: DriftSignature) {
  const d = drift.driftVsGolden;
  if (typeof d !== 'number' || Math.abs(d) < SINCE_LAUNCH_MIN) return null;
  const cls = sinceLaunchClass(d);
  return (
    <span className={`st-tag ${SINCE_TONE[cls] || ''}`} style={{ alignSelf: 'flex-start' }}>
      {formatSinceLaunch(d)} since launch
    </span>
  );
}
