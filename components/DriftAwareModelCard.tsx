/**
 * PHASE 3: Drift-Aware Model Card Component
 * Displays model scores with drift status, regime classification, and alert indicators
 */

'use client';

import { useState, useEffect } from 'react';
import '../styles/drift-cards.css';

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
    };
  };
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
  
  return (
    <div 
      className={`model-card ${regimeClass}`}
      onClick={() => setExpanded(!expanded)}
      style={{ cursor: 'pointer' }}
    >
      {/* Header Row */}
      <div className="card-header">
        <div className="model-info">
          <span className="model-name">{model.name}</span>
          <span className="model-provider terminal-text--dim">{model.provider}</span>
        </div>
        <div className={`status-badge regime-${drift.regime.toLowerCase()}`}>
          {getStatusIcon(drift.regime)} {drift.regime}
        </div>
      </div>

      {/* Score Row */}
      <div className="score-row">
        <div className="main-score">
          <span className="score-value">{drift.currentScore}</span>
          <span className="score-context terminal-text--dim">
            ±{Math.round((drift.confidenceInterval[1] - drift.confidenceInterval[0]) / 2)}
          </span>
        </div>
        {drift.driftStatus !== 'NORMAL' && (
          <div className={`alert-indicator alert-${drift.driftStatus.toLowerCase()}`}>
            {drift.driftStatus}
          </div>
        )}
      </div>

      {/* Since-launch drift badge (golden baseline) */}
      {renderSinceLaunch(drift)}

      {/* Staleness warning */}
      {model.isStale && model.staleDuration && (
        <div className="issue-warning">
          ⏰ Data {model.staleDuration}h old (API credits may be exhausted)
        </div>
      )}

      {!expanded && (
        <>
          {/* Mini Metrics (Collapsed View - Top 3 axes) */}
          <div className="mini-metrics">
            {Object.entries(drift.axes).slice(0, 3).map(([key, axis]: [string, any]) => (
              <div key={key} className="mini-metric">
                <span className="metric-name">{formatAxisName(key)}</span>
                <div className="metric-bar">
                  <div 
                    className={`bar-fill status-${axis.status.toLowerCase()}`}
                    style={{ width: `${axis.value * 100}%` }}
                  />
                </div>
                {axis.trend !== 'stable' && (
                  <span className={`trend-arrow trend-${axis.trend}`}>
                    {axis.trend === 'up' ? '▲' : '▼'}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Last Change Indicator */}
          {drift.hoursSinceChange !== undefined && (
            <div className="last-change terminal-text--dim">
              Last changed: {formatTimeSince(drift.hoursSinceChange)}
            </div>
          )}

          {/* Issue Warning */}
          {drift.primaryIssue && (
            <div className="issue-warning">
              ⚠️ {drift.primaryIssue}
            </div>
          )}
          
          <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.75em', opacity: 0.5 }}>
            Click to expand
          </div>
        </>
      )}

      {expanded && (
        <>
          {/* Drift Summary Panel */}
          <div className="drift-summary">
            <div className="summary-grid">
              <div className="summary-item">
                <span className="label">Baseline</span>
                <span className="value">{drift.baselineScore}</span>
              </div>
              <div className="summary-item">
                <span className="label">Current</span>
                <span className="value">{drift.currentScore}</span>
              </div>
              <div className="summary-item">
                <span className="label">Variance (24h)</span>
                <span className="value">±{drift.variance24h.toFixed(1)}</span>
              </div>
              <div className="summary-item">
                <span className="label">Status</span>
                <span className={`value status-${drift.driftStatus.toLowerCase()}`}>
                  {drift.driftStatus}
                </span>
              </div>
              {typeof drift.goldenBaselineScore === 'number' && (
                <div className="summary-item">
                  <span className="label">At Launch</span>
                  <span className="value">{Math.round(drift.goldenBaselineScore)}</span>
                </div>
              )}
              {typeof drift.driftVsGolden === 'number' && (
                <div className="summary-item">
                  <span className="label">Since Launch</span>
                  <span className={`value ${sinceLaunchClass(drift.driftVsGolden)}`}>
                    {formatSinceLaunch(drift.driftVsGolden)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Dimensional Breakdown */}
          <div className="axes-breakdown">
            <h4>Performance Dimensions</h4>
            {Object.entries(drift.axes).map(([key, axis]: [string, any]) => (
              <div key={key} className={`axis-row status-${axis.status.toLowerCase()}`}>
                <div className="axis-label">
                  {formatAxisName(key)}
                  {axis.status === 'DEGRADED' && <span className="degraded-indicator">⚠️</span>}
                </div>
                <div className="axis-bar-container">
                  <div className="axis-bar">
                    <div 
                      className={`bar-fill status-${axis.status.toLowerCase()}`}
                      style={{ width: `${axis.value * 100}%` }}
                    />
                  </div>
                  <span className="axis-value">{Math.round(axis.value * 100)}</span>
                  {axis.trend !== 'stable' && (
                    <span className={`trend-indicator trend-${axis.trend}`}>
                      {axis.trend === 'up' ? '▲' : '▼'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Alert Panel (if issues exist) */}
          {drift.primaryIssue && (
            <div className={`alert-panel alert-${drift.driftStatus.toLowerCase()}`}>
              <div className="alert-header">
                <span className="alert-icon">🔔</span>
                <span className="alert-title">{drift.primaryIssue}</span>
              </div>
              {drift.recommendation && (
                <div className="alert-recommendation">
                  <strong>Recommendation:</strong> {drift.recommendation}
                </div>
              )}
              {drift.lastSignificantChange && (
                <div className="alert-context">
                  Detected: {new Date(drift.lastSignificantChange).toLocaleString()} 
                  ({formatTimeSince(drift.hoursSinceChange!)} ago)
                </div>
              )}
            </div>
          )}
          
          <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.75em', opacity: 0.5 }}>
            Click to collapse
          </div>
        </>
      )}
    </div>
  );
}

// Helper functions
function getStatusIcon(regime: string): string {
  const icons: Record<string, string> = {
    'STABLE': '✅',
    'VOLATILE': '⚠️',
    'DEGRADED': '🔴',
    'RECOVERING': '🔄'
  };
  return icons[regime] || '•';
}

function formatAxisName(key: string): string {
  // Convert camelCase to Title Case
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
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
  const icon = d > 0 ? '📉' : '📈';
  return (
    <div className={`since-launch-badge ${cls}`}>
      {icon} {formatSinceLaunch(d)} since launch
    </div>
  );
}
