'use client';

/**
 * PHASE 3: Drift Detection Test Page
 * Standalone page to test drift components before main integration
 */

import { useState, useEffect } from 'react';
import DriftAwareModelCard from '../../components/DriftAwareModelCard';
import DriftHeatmap from '../../components/DriftHeatmap';
import '../../styles/drift-cards.css';

export default function DriftTestPage() {
  const [modelScores, setModelScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [driftStatus, setDriftStatus] = useState<any>(null);

  useEffect(() => {
    // Fetch model scores
    const apiUrl = process.env.NODE_ENV === 'production'
      ? ''
      : 'http://localhost:4000';
      
    Promise.all([
      fetch(`${apiUrl}/api/dashboard/scores?period=latest&sortBy=combined`).then(r => r.json()),
      fetch(`${apiUrl}/api/drift/status`).then(r => r.json())
    ]).then(([scoresData, statusData]) => {
      if (scoresData.success) {
        setModelScores(scoresData.data.modelScores || []);
      }
      if (statusData.success) {
        setDriftStatus(statusData.data);
      }
      setLoading(false);
    }).catch(error => {
      console.error('Failed to load data:', error);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="vintage-container">
        <h1>🔍 Drift Detection Test Page</h1>
        <div style={{ textAlign: 'center', padding: '60px', opacity: 0.5 }}>
          Loading drift data...
        </div>
      </div>
    );
  }

  return (
    <div className="vintage-container">
      <div style={{ marginBottom: '32px' }}>
        <h1>🔍 Drift Detection System Test</h1>
        <p style={{ opacity: 0.7, marginBottom: '24px' }}>
          Testing Phase 3 drift-aware UI components
        </p>

        {/* Drift Status Summary */}
        {driftStatus && (
          <div style={{
            padding: '16px',
            background: 'rgba(0, 255, 65, 0.05)',
            border: '1px solid rgba(0, 255, 65, 0.2)',
            borderRadius: '4px',
            marginBottom: '24px'
          }}>
            <h3 style={{ margin: '0 0 12px 0' }}>System-Wide Drift Status</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '0.75em', opacity: 0.6 }}>Total Models</div>
                <div style={{ fontSize: '1.5em', fontWeight: 'bold' }}>{driftStatus.total || 0}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75em', opacity: 0.6 }}>Stable</div>
                <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: 'var(--phosphor-green)' }}>
                  {driftStatus.stable || 0}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75em', opacity: 0.6 }}>Volatile</div>
                <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: 'var(--amber-warning)' }}>
                  {driftStatus.volatile || 0}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75em', opacity: 0.6 }}>Degraded</div>
                <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: 'var(--red-alert)' }}>
                  {driftStatus.degraded || 0}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75em', opacity: 0.6 }}>Recovering</div>
                <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#00BFFF' }}>
                  {driftStatus.recovering || 0}
                </div>
              </div>
            </div>

            {/* Active Alerts */}
            {driftStatus.alerts && driftStatus.alerts.length > 0 && (
              <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255, 45, 0, 0.1)', borderRadius: '4px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px', color: 'var(--red-alert)' }}>
                  🚨 {driftStatus.alerts.length} Active Alert{driftStatus.alerts.length > 1 ? 's' : ''}
                </div>
                {driftStatus.alerts.slice(0, 3).map((alert: any, i: number) => (
                  <div key={i} style={{ fontSize: '0.9em', marginBottom: '4px' }}>
                    • {alert.modelName}: {alert.issue}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drift Heatmap */}
      <div style={{ marginBottom: '48px' }}>
        <h2 style={{ marginBottom: '16px' }}>Multi-Dimensional Drift Heatmap</h2>
        <DriftHeatmap models={modelScores.slice(0, 12)} />
      </div>

      {/* Drift-Aware Model Cards */}
      <div>
        <h2 style={{ marginBottom: '16px' }}>
          Drift-Aware Model Cards ({modelScores.length} models)
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: '16px'
        }}>
          {modelScores.slice(0, 6).map((model: any) => (
            <DriftAwareModelCard
              key={model.id}
              model={model}
              compact={true}
              showDriftInfo={true}
            />
          ))}
        </div>
        
        {modelScores.length > 6 && (
          <div style={{ 
            textAlign: 'center', 
            marginTop: '24px', 
            padding: '16px',
            opacity: 0.6,
            fontSize: '0.9em'
          }}>
            Showing 6 of {modelScores.length} models. Full integration in main dashboard.
          </div>
        )}
      </div>

      {/* Integration Instructions */}
      <div style={{
        marginTop: '48px',
        padding: '20px',
        background: 'rgba(0, 255, 65, 0.03)',
        border: '1px solid rgba(0, 255, 65, 0.15)',
        borderRadius: '4px'
      }}>
        <h3 style={{ margin: '0 0 12px 0' }}>✅ Test Results</h3>
        <div style={{ fontSize: '0.9em', lineHeight: '1.6' }}>
          <p>If you can see drift cards above:</p>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>✅ API endpoints working</li>
            <li>✅ Drift computation running</li>
            <li>✅ Components rendering correctly</li>
            <li>✅ Styling loaded properly</li>
          </ul>
          <p style={{ marginTop: '12px' }}>
            <strong>Next step:</strong> Integrate into main dashboard at <code>/apps/web/app/page.tsx</code>
          </p>
          <p style={{ fontSize: '0.85em', opacity: 0.7, marginTop: '8px' }}>
            See <code>/plans/COMPLETION_STATUS.md</code> for integration instructions.
          </p>
        </div>
      </div>
    </div>
  );
}
