/**
 * PHASE 3: Drift Heatmap Component
 * Visualizes drift status across multiple models and dimensions
 */

'use client';

import { useState, useEffect } from 'react';
import '../styles/drift-cards.css';

interface DriftStatus {
  modelId: number;
  modelName: string;
  provider: string;
  regime: 'STABLE' | 'VOLATILE' | 'DEGRADED' | 'RECOVERING';
  driftStatus: 'NORMAL' | 'WARNING' | 'ALERT';
  axes: {
    [key: string]: {
      status: 'STABLE' | 'VOLATILE' | 'DEGRADED';
      value: number;
      // 0 means the API had no observation for this axis. `value` is then a
      // neutral placeholder and must not be rendered as a measured percentage.
      sampleSize?: number;
    };
  };
  // 'synthetic' = modelled series shown while live benchmarking is paused.
  dataSource?: 'measured' | 'synthetic' | 'unknown';
  // Provenance of the axis breakdown, which can be modelled even when the score
  // series is measured (only the hourly suite scores these axes).
  axesSource?: 'measured' | 'synthetic' | 'none';
}

interface HeatmapProps {
  models: {
    id: string;
    name: string;
    provider: string;
  }[];
}

export default function DriftHeatmap({ models }: HeatmapProps) {
  const [driftData, setDriftData] = useState<DriftStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDimension, setSelectedDimension] = useState<string | null>(null);

  const dimensions = ['correctness', 'refusal', 'stability', 'efficiency'];

  useEffect(() => {
    // Use single batch endpoint instead of N individual requests
    const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
    const modelIds = new Set(models.map(m => m.id));
    
    fetch(`${apiUrl}/api/drift/batch`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const validResults: DriftStatus[] = [];
          for (const item of data.data) {
            // Only include models that were requested (top 12)
            if (modelIds.has(String(item.modelId)) && item.data) {
              const model = models.find(m => m.id === String(item.modelId));
              validResults.push({
                modelId: item.modelId,
                modelName: item.modelName || model?.name || `Model ${item.modelId}`,
                provider: model?.provider || '',
                regime: item.data.regime || 'STABLE',
                driftStatus: item.data.driftStatus || 'NORMAL',
                axes: item.data.axes || {},
                dataSource: item.data.dataSource,
                axesSource: item.data.axesSource
              });
            }
          }
          setDriftData(validResults);
        }
        setLoading(false);
      })
      .catch(error => {
        console.error('Failed to load heatmap data:', error);
        setLoading(false);
      });
  }, [models]);

  if (loading) {
    return (
      <div className="drift-heatmap">
        <div style={{
          textAlign: 'center',
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(26, 115, 232, 0.1)',
            borderTop: '3px solid var(--phosphor-green)',
            borderRadius: '50%',
            animation: 'drift-spinner-spin 1s linear infinite'
          }} />
          <div style={{ opacity: 0.7, fontSize: '0.9em' }}>
            Loading drift signatures...
          </div>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes drift-spinner-spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}} />
        </div>
      </div>
    );
  }

  if (driftData.length === 0) {
    return (
      <div className="drift-heatmap">
        <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
          No drift data available
        </div>
      </div>
    );
  }

  return (
    <div className="drift-heatmap">
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1em' }}>
          Multi-Dimensional Drift Overview
        </h3>
        <p style={{ margin: 0, fontSize: '0.85em', opacity: 0.7 }}>
          Click cells for detailed breakdown
        </p>
      </div>

      <div style={{ overflowX: 'auto', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
        <table className="heatmap-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Status</th>
              {dimensions.map(dim => (
                <th key={dim} style={{ textAlign: 'center' }}>
                  {formatDimensionName(dim)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {driftData.map(modelData => (
              <tr key={modelData.modelId}>
                <td className="model-name">
                  {modelData.modelName}
                  {modelData.dataSource === 'synthetic' && (
                    <span
                      title="Live benchmarking is paused for this model — drift is derived from modelled scores and does not raise alerts."
                      style={{
                        marginLeft: '6px',
                        fontSize: '0.65em',
                        fontWeight: 'normal',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        border: '1px solid var(--border, rgba(128,128,128,0.35))',
                        opacity: 0.7,
                        verticalAlign: 'middle'
                      }}
                    >
                      modelled
                    </span>
                  )}
                  <div style={{ fontSize: '0.75em', opacity: 0.6, fontWeight: 'normal' }}>
                    {modelData.provider}
                  </div>
                </td>
                <td>
                  <div className={`status-badge regime-${modelData.regime.toLowerCase()}`} style={{ fontSize: '0.65em', padding: '2px 6px' }}>
                    {getStatusEmoji(modelData.regime)}
                  </div>
                </td>
                {dimensions.map(dim => {
                  const axis = modelData.axes[dim];
                  const measured = hasReading(axis);
                  const status = measured ? axis.status : 'UNKNOWN';

                  return (
                    <td 
                      key={dim}
                      className={`heat-cell status-${status.toLowerCase()}`}
                      title={measured
                        ? `${formatDimensionName(dim)}: ${formatAxisValue(axis)} (${status})`
                        : `${formatDimensionName(dim)}: no measurement`}
                      onClick={() => setSelectedDimension(dim === selectedDimension ? null : dim)}
                      style={{ cursor: 'pointer' }}
                    >
                      {getStatusEmoji(status)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="heatmap-legend">
        <span>🟢 STABLE</span>
        <span>🟡 VOLATILE</span>
        <span>🔴 DEGRADED</span>
        <span>🔄 RECOVERING</span>
        <span>⚪ NO DATA</span>
      </div>

      {selectedDimension && (
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          background: 'rgba(26, 115, 232, 0.05)', 
          borderRadius: '4px',
          border: '1px solid rgba(26, 115, 232, 0.2)'
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9em' }}>
            {formatDimensionName(selectedDimension)} Breakdown
          </h4>
          <div style={{ fontSize: '0.85em' }}>
            {[...driftData]
              // Worst first — a breakdown is read to find the outliers, and
              // unmeasured models sort last so they never look like a low score.
              .sort((a, b) => {
                const av = hasReading(a.axes[selectedDimension]) ? a.axes[selectedDimension].value : Infinity;
                const bv = hasReading(b.axes[selectedDimension]) ? b.axes[selectedDimension].value : Infinity;
                return av - bv;
              })
              .map(model => {
              const axis = model.axes[selectedDimension];
              const measured = hasReading(axis);
              return (
                <div key={model.modelId} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: '4px 0',
                  borderBottom: '1px solid rgba(26, 115, 232, 0.05)'
                }}>
                  <span>
                    {model.modelName}
                    {model.axesSource === 'synthetic' && (
                      <span
                        title="Derived from modelled scores — no live benchmark runs for this dimension."
                        style={{ marginLeft: '6px', fontSize: '0.8em', opacity: 0.55 }}
                      >
                        (modelled)
                      </span>
                    )}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {measured ? formatAxisValue(axis) : 'no data'}
                    <span style={{ 
                      marginLeft: '8px',
                      color: !measured ? 'var(--phosphor-dim)' :
                             axis.status === 'DEGRADED' ? 'var(--red-alert)' : 
                             axis.status === 'VOLATILE' ? 'var(--amber-warning)' : 
                             'var(--phosphor-green)'
                    }}>
                      {getStatusEmoji(measured ? axis.status : 'UNKNOWN')}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDimensionName(dim: string): string {
  return dim
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function getStatusEmoji(status: string): string {
  const emojis: Record<string, string> = {
    'STABLE': '🟢',
    'VOLATILE': '🟡',
    'DEGRADED': '🔴',
    'RECOVERING': '🔄'
  };
  return emojis[status] || '⚪';
}

/**
 * True only when the API actually measured this axis. An axis the backend could
 * not populate arrives either missing entirely or with sampleSize 0 and a neutral
 * 0.5 placeholder — rendering either as a percentage claims a reading nobody took,
 * which is what made the breakdown read as a wall of confident 0% / 🟢.
 */
function hasReading(axis?: { value: number; sampleSize?: number }): axis is { value: number; sampleSize?: number; status: any } {
  if (!axis || typeof axis.value !== 'number') return false;
  // sampleSize is absent on responses from an older API build; treat those as measured.
  return axis.sampleSize === undefined || axis.sampleSize > 0;
}

function formatAxisValue(axis: { value: number; sampleSize?: number }): string {
  return `${Math.round(axis.value * 100)}%`;
}
