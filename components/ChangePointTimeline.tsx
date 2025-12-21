/**
 * PHASE 3: Change-Point Timeline Component (PRO FEATURE)
 * Displays historical change-points with temporal context
 */

'use client';

import { useState, useEffect } from 'react';
import '../styles/drift-cards.css';

interface ChangePoint {
  id: number;
  modelId: number;
  timestamp: string;
  fromScore: number;
  toScore: number;
  delta: number;
  significance: number;
  changeType: 'improvement' | 'degradation' | 'shift';
  affectedAxes?: string[];
  suspectedCause?: string;
}

interface TimelineProps {
  modelId: string;
  limit?: number;
}

export default function ChangePointTimeline({ modelId, limit = 10 }: TimelineProps) {
  const [changePoints, setChangePoints] = useState<ChangePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
    
    fetch(`${apiUrl}/api/drift/change-points/${modelId}?limit=${limit}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setChangePoints(data.data);
        } else {
          setError(data.error || 'Failed to load change-points');
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch change-points:', err);
        setError('Network error');
        setLoading(false);
      });
  }, [modelId, limit]);

  if (loading) {
    return (
      <div className="change-point-timeline">
        <h4>Change History (Loading...)</h4>
        <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>
          Loading timeline data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="change-point-timeline">
        <h4>Change History</h4>
        <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5, color: 'var(--red-alert)' }}>
          Error: {error}
        </div>
      </div>
    );
  }

  if (changePoints.length === 0) {
    return (
      <div className="change-point-timeline">
        <h4>Change History (Last 30 days)</h4>
        <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>
          ✅ No significant changes detected - model behavior has been stable
        </div>
      </div>
    );
  }

  return (
    <div className="change-point-timeline">
      <h4>Change History (Last {changePoints.length === limit ? `${limit}+` : changePoints.length} events)</h4>
      <div className="timeline">
        {changePoints.map((cp, index) => (
          <div 
            key={cp.id || index}
            className={`timeline-event event-${cp.changeType}`}
          >
            <div className="event-marker">
              {cp.changeType === 'improvement' ? '▲' : 
               cp.changeType === 'degradation' ? '▼' : '•'}
            </div>
            <div className="event-content">
              <div className="event-header">
                <span className="event-date">
                  {new Date(cp.timestamp).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
                <span className={`event-type type-${cp.changeType}`}>
                  {cp.changeType.toUpperCase()}
                </span>
              </div>
              <div className="event-details">
                Score changed: {cp.fromScore.toFixed(1)} → {cp.toScore.toFixed(1)}
                <span className={`delta ${cp.delta > 0 ? 'positive' : 'negative'}`}>
                  ({cp.delta > 0 ? '+' : ''}{cp.delta.toFixed(1)} pts, {cp.significance.toFixed(1)}σ)
                </span>
              </div>
              {cp.affectedAxes && cp.affectedAxes.length > 0 && (
                <div className="event-cause">
                  Affected: {cp.affectedAxes.map(formatAxisName).join(', ')}
                </div>
              )}
              {cp.suspectedCause && (
                <div className="event-cause">
                  Likely cause: {formatCause(cp.suspectedCause)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {changePoints.length === limit && (
        <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.85em', opacity: 0.6 }}>
          Showing last {limit} changes. More may exist in history.
        </div>
      )}
    </div>
  );
}

function formatAxisName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function formatCause(cause: string): string {
  return cause
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
