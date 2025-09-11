interface GaugeProps {
  value: number; // 0-100
  model: string;
  stupidScore: number;
  driftDetected?: boolean;
}

export default function Gauge({ value, model, stupidScore, driftDetected }: GaugeProps) {
  const percentage = Math.round(value);
  const angle = (percentage / 100) * 180 - 90; // -90 to +90 degrees

  const getColor = () => {
    if (driftDetected) return '#ff6b6b'; // Red for drift
    if (percentage < 35) return '#51cf66'; // Green (smart)
    if (percentage < 65) return '#ffd43b'; // Yellow (baseline)
    return '#ff8787'; // Light red (needs improvement)
  };

  const getLabel = () => {
    if (driftDetected) return 'DRIFT DETECTED!';
    if (percentage < 35) return 'GENIUS';
    if (percentage < 50) return 'SMART';
    if (percentage < 65) return 'OKAY';
    return 'NEEDS HELP';
  };

  return (
    <div style={{ textAlign: 'center', margin: '20px 0' }}>
      <h3>🧠 Stupid Meter for {model}</h3>

      <div style={{ position: 'relative', width: '200px', height: '120px', margin: '0 auto' }}>
        {/* Semi-circle gauge */}
        <svg width="200" height="120" viewBox="0 0 200 120">
          {/* Background arc */}
          <path
            d="M20,100 A80,80 0 0,1 180,100"
            stroke="#e9ecef"
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
          />

          {/* Value arc */}
          <path
            d={`M20,100 A80,80 0 0,1 ${100 + 80 * Math.cos(angle * Math.PI / 180)},${100 + 80 * Math.sin(angle * Math.PI / 180)}`}
            stroke={getColor()}
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
          />

          {/* Indicator dot */}
          <circle
            cx={100 + 70 * Math.cos(angle * Math.PI / 180)}
            cy={100 + 70 * Math.sin(angle * Math.PI / 180)}
            r="6"
            fill={getColor()}
            stroke="#333"
            strokeWidth="2"
          />

          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map(tick => {
            const tickAngle = ((tick / 100) * 180 - 90) * Math.PI / 180;
            return (
              <g key={tick}>
                <line
                  x1={100 + 55 * Math.cos(tickAngle)}
                  y1={100 + 55 * Math.sin(tickAngle)}
                  x2={100 + 70 * Math.cos(tickAngle)}
                  y2={100 + 70 * Math.sin(tickAngle)}
                  stroke="#666"
                  strokeWidth="1"
                />
                <text
                  x={100 + 45 * Math.cos(tickAngle)}
                  y={100 + 45 * Math.sin(tickAngle) + 5}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#666"
                >
                  {tick}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Labels below */}
        <div style={{ textAlign: 'center', marginTop: '-20px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: getColor() }}>
            {percentage}/100
          </div>
          <div style={{ fontSize: '14px', color: getColor(), fontWeight: 'bold' }}>
            {getLabel()}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
            StupidScore: {stupidScore.toFixed(3)}
          </div>
          {driftDetected && (
            <div style={{ fontSize: '12px', color: '#ff6b6b', fontWeight: 'bold', marginTop: '4px' }}>
              ⚠️ Performance Drift Detected!
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '16px',
        marginTop: '20px',
        fontSize: '12px'
      }}>
        <span style={{ color: '#51cf66' }}>◄ Smart</span>
        <span style={{ color: '#ffd43b' }}>Baseline (50)</span>
        <span style={{ color: '#ff8787' }}>Needs Improvement ►</span>
      </div>
    </div>
  );
}
