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
    };
  };
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
    // Fetch drift signatures for all models
    const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
    
    Promise.all(
      models.slice(0, 12).map(async (model) => { // Limit to top 12 for heatmap
        try {
          const res = await fetch(`${apiUrl}/api/drift/signature/${model.id}`);
          const data = await res.json();
          if (data.success) {
            return {
              modelId: parseInt(model.id),
              modelName: model.name,
              provider: model.provider,
              regime: data.data.regime,
              driftStatus: data.data.driftStatus,
              axes: data.data.axes
            };
          }
        } catch (error) {
          console.error(`Failed to fetch drift for ${model.name}:`, error);
        }
        return null;
      })
    )
    .then(results => {
      const validResults = results.filter((r): r is DriftStatus => r !== null);
      setDriftData(validResults);
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
            border: '3px solid rgba(0, 255, 65, 0.1)',
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

      <div style={{ overflowX: 'auto' }}>
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
                  const status = axis?.status || 'STABLE';
                  const value = axis?.value || 0;
                  
                  return (
                    <td 
                      key={dim}
                      className={`heat-cell status-${status.toLowerCase()}`}
                      title={`${formatDimensionName(dim)}: ${Math.round(value * 100)}% (${status})`}
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
      </div>

      {selectedDimension && (
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          background: 'rgba(0, 255, 65, 0.05)', 
          borderRadius: '4px',
          border: '1px solid rgba(0, 255, 65, 0.2)'
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9em' }}>
            {formatDimensionName(selectedDimension)} Breakdown
          </h4>
          <div style={{ fontSize: '0.85em' }}>
            {driftData.map(model => {
              const axis = model.axes[selectedDimension];
              return (
                <div key={model.modelId} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: '4px 0',
                  borderBottom: '1px solid rgba(0, 255, 65, 0.05)'
                }}>
                  <span>{model.modelName}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {Math.round((axis?.value || 0) * 100)}% 
                    <span style={{ 
                      marginLeft: '8px',
                      color: axis?.status === 'DEGRADED' ? 'var(--red-alert)' : 
                             axis?.status === 'VOLATILE' ? 'var(--amber-warning)' : 
                             'var(--phosphor-green)'
                    }}>
                      {getStatusEmoji(axis?.status || 'STABLE')}
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
