'use client';

interface ModelDetailQuickStatsProps {
  currentScore: number;
  status: string;
  totalRuns: number;
  successRate: number;
  averageLatency: number;
  averageCorrectness: number;
  selectedPeriod: string;
}

const scoreColor = (score: number): string =>
  score >= 80 ? 'var(--phosphor-green)' : score >= 60 ? 'var(--amber-warning)' : 'var(--red-alert)';

const statusColor = (status: string): string => {
  switch (status) {
    case 'excellent': return 'var(--phosphor-green)';
    case 'good': return 'var(--phosphor-green)';
    case 'warning': return 'var(--amber-warning)';
    case 'critical': return 'var(--red-alert)';
    default: return 'var(--phosphor-dim)';
  }
};

export default function ModelDetailQuickStats({
  currentScore,
  status,
  totalRuns,
  successRate,
  averageLatency,
  averageCorrectness,
  selectedPeriod,
}: ModelDetailQuickStatsProps) {
  const periodLabel = selectedPeriod === 'latest'
    ? 'CURRENT PERFORMANCE'
    : `PERFORMANCE (${selectedPeriod.toUpperCase()})`;

  const periodDesc = selectedPeriod === 'latest'
    ? 'Latest benchmark results'
    : `Metrics within the last ${selectedPeriod === '24h' ? '24 hours' : selectedPeriod === '7d' ? '7 days' : '30 days'}`;

  return (
    <div className="md-info-col">
      <div className="md-info-title">🎯 {periodLabel}</div>

      {/* Big Score Display */}
      <div style={{
        textAlign: 'center',
        padding: '16px 0',
        borderBottom: '1px solid rgba(192, 192, 192, 0.06)',
        marginBottom: '10px',
      }}>
        <div style={{
          fontSize: '52px',
          fontWeight: 'bold',
          color: scoreColor(currentScore),
          textShadow: `0 0 12px ${scoreColor(currentScore)}`,
          lineHeight: 1,
          marginBottom: '4px',
        }}>
          {currentScore || 0}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', marginBottom: '4px' }}>
          LATEST SCORE
        </div>
        <div style={{
          display: 'inline-block',
          fontSize: '9px',
          padding: '2px 8px',
          border: `1px solid ${statusColor(status)}`,
          color: statusColor(status),
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {status}
        </div>
      </div>

      <div className="md-info-row">
        <span className="md-info-label">Total Runs</span>
        <span className="md-info-value" style={{ color: 'var(--phosphor-green)' }}>
          {totalRuns || 0}
        </span>
      </div>
      <div className="md-info-row">
        <span className="md-info-label">Success Rate</span>
        <span className="md-info-value" style={{ color: successRate >= 80 ? 'var(--phosphor-green)' : successRate >= 60 ? 'var(--amber-warning)' : 'var(--red-alert)' }}>
          {successRate || 0}%
        </span>
      </div>
      <div className="md-info-row">
        <span className="md-info-label">Avg Latency</span>
        <span className="md-info-value" style={{ color: '#00BFFF' }}>
          {Math.round(averageLatency || 0)}ms
        </span>
      </div>
      <div className="md-info-row">
        <span className="md-info-label">Correctness</span>
        <span className="md-info-value" style={{ color: averageCorrectness >= 0.8 ? 'var(--phosphor-green)' : averageCorrectness >= 0.6 ? 'var(--amber-warning)' : 'var(--red-alert)' }}>
          {Math.round((averageCorrectness || 0) * 100)}%
        </span>
      </div>

      <div style={{
        marginTop: '10px',
        padding: '8px',
        background: 'rgba(0, 255, 65, 0.03)',
        border: '1px solid rgba(0, 255, 65, 0.12)',
        borderRadius: '3px',
        fontSize: '9px',
        color: 'var(--phosphor-dim)',
        lineHeight: '1.5',
      }}>
        {periodDesc}. Scores represent weighted composite across 7 axes.
      </div>
    </div>
  );
}
