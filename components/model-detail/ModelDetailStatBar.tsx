'use client';

interface ModelDetailStatBarProps {
  currentScore: number;
  status: string;
  totalRuns: number;
  successRate: number;
  averageLatency: number;
  averageCorrectness: number;
  lastUpdated: string;
}

const scoreColor = (score: number): string =>
  score >= 80 ? 'var(--phosphor-green)' : score >= 60 ? 'var(--amber-warning)' : 'var(--red-alert)';

export default function ModelDetailStatBar({
  currentScore,
  status,
  totalRuns,
  successRate,
  averageLatency,
  averageCorrectness,
  lastUpdated,
}: ModelDetailStatBarProps) {
  const scoreCol = currentScore >= 80 ? 'color-green' : currentScore >= 60 ? 'color-amber' : 'color-red';
  const rateCol = successRate >= 80 ? 'color-green' : successRate >= 60 ? 'color-amber' : 'color-red';
  const corrCol = averageCorrectness >= 0.8 ? 'color-green' : averageCorrectness >= 0.6 ? 'color-amber' : 'color-red';

  return (
    <div className="md-stat-bar">
      <div className={`md-stat-cell ${scoreCol}`}>
        <div className="md-stat-label">SCORE</div>
        <div className="md-stat-value" style={{ color: scoreColor(currentScore) }}>
          {currentScore || '—'}
        </div>
        <div className="md-stat-detail">{status.toUpperCase()}</div>
      </div>

      <div className={`md-stat-cell ${rateCol}`}>
        <div className="md-stat-label">SUCCESS RATE</div>
        <div className="md-stat-value" style={{ color: successRate >= 80 ? 'var(--phosphor-green)' : successRate >= 60 ? 'var(--amber-warning)' : 'var(--red-alert)' }}>
          {successRate || 0}%
        </div>
        <div className="md-stat-detail">{totalRuns} total runs</div>
      </div>

      <div className="md-stat-cell color-green">
        <div className="md-stat-label">TOTAL RUNS</div>
        <div className="md-stat-value" style={{ color: 'var(--phosphor-green)' }}>
          {totalRuns || 0}
        </div>
        <div className="md-stat-detail">benchmark tasks</div>
      </div>

      <div className="md-stat-cell color-blue">
        <div className="md-stat-label">LATENCY</div>
        <div className="md-stat-value" style={{ color: '#00BFFF' }}>
          {averageLatency ? `${Math.round(averageLatency)}` : '—'}
        </div>
        <div className="md-stat-detail">avg ms</div>
      </div>

      <div className={`md-stat-cell ${corrCol}`}>
        <div className="md-stat-label">CORRECTNESS</div>
        <div className="md-stat-value" style={{ color: averageCorrectness >= 0.8 ? 'var(--phosphor-green)' : averageCorrectness >= 0.6 ? 'var(--amber-warning)' : 'var(--red-alert)' }}>
          {Math.round((averageCorrectness || 0) * 100)}%
        </div>
        <div className="md-stat-detail">avg accuracy</div>
      </div>

      <div className="md-stat-cell color-green">
        <div className="md-stat-label">LAST UPDATE</div>
        <div className="md-stat-value" style={{ color: 'var(--phosphor-green)', fontSize: '14px' }}>
          {lastUpdated || '—'}
        </div>
        <div className="md-stat-detail">benchmark time</div>
      </div>
    </div>
  );
}
