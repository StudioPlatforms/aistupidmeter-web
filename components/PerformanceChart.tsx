'use client';

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface ChartDataPoint {
  name: string;
  avg?: number | null;
  min?: number | null;
  max?: number | null;
  count?: number;
  score?: number | null;  // For historical data
  timestamp?: string;
}

interface PerformanceChartProps {
  data: ChartDataPoint[];
  title?: string;
  height?: number;
  showLegend?: boolean;
  showMinMax?: boolean;
  xAxisAngle?: number;
  xAxisInterval?: number | 'preserveStartEnd';
  yAxisLabel?: string;
  lineColor?: string;
  chartType?: 'hour-analysis' | 'historical';
}

export default function PerformanceChart({
  data,
  title,
  height = 400,
  showLegend = true,
  showMinMax = true,
  xAxisAngle = -45,
  xAxisInterval = 'preserveStartEnd',
  yAxisLabel = 'SCORE',
  lineColor = '#00ff41',
  chartType = 'historical'
}: PerformanceChartProps) {
  
  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    
    return (
      <div style={{
        background: 'rgba(0, 0, 0, 0.95)',
        border: '2px solid #00ff41',
        borderRadius: '4px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0, 255, 65, 0.3)'
      }}>
        <div className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold', marginBottom: '8px' }}>
          {label}
        </div>
        
        {chartType === 'hour-analysis' ? (
          // Hour analysis tooltip
          <>
            {data.avg !== null && data.avg !== undefined ? (
              <>
                <div className="terminal-text" style={{ fontSize: '0.85em', marginBottom: '4px' }}>
                  Avg: <span style={{ color: lineColor }}>{data.avg.toFixed(1)}</span>
                </div>
                {showMinMax && data.min !== null && data.max !== null && (
                  <div className="terminal-text--dim" style={{ fontSize: '0.75em' }}>
                    Range: {data.min.toFixed(1)} - {data.max.toFixed(1)}
                  </div>
                )}
                {data.count !== undefined && (
                  <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginTop: '4px' }}>
                    Tests: {data.count}
                  </div>
                )}
              </>
            ) : (
              <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                No data
              </div>
            )}
          </>
        ) : (
          // Historical chart tooltip
          <>
            {data.score !== null && data.score !== undefined ? (
              <>
                <div className="terminal-text" style={{ fontSize: '0.85em', marginBottom: '4px' }}>
                  Score: <span style={{ color: lineColor }}>{Math.round(data.score)}</span>
                </div>
                {data.timestamp && (
                  <div className="terminal-text--dim" style={{ fontSize: '0.75em' }}>
                    {new Date(data.timestamp).toLocaleString()}
                  </div>
                )}
              </>
            ) : (
              <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                No data
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ width: '100%', height: `${height}px` }}>
      {title && (
        <div style={{ marginBottom: '12px', textAlign: 'center' }}>
          <div className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold' }}>
            {title}
          </div>
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 255, 65, 0.1)" />
          <XAxis
            dataKey="name"
            stroke={lineColor}
            tick={{ fill: lineColor, fontSize: 11 }}
            angle={xAxisAngle}
            textAnchor="end"
            height={80}
            interval={xAxisInterval}
          />
          <YAxis
            stroke={lineColor}
            tick={{ fill: lineColor, fontSize: 11 }}
            label={{
              value: yAxisLabel,
              angle: -90,
              position: 'insideLeft',
              style: { fill: lineColor, fontWeight: 'bold', fontSize: 12 }
            }}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && (
            <Legend
              wrapperStyle={{
                paddingTop: '20px',
                fontSize: '12px'
              }}
              iconType="line"
            />
          )}
          
          {/* Min-Max Area (only for hour-analysis type) */}
          {chartType === 'hour-analysis' && showMinMax && (
            <>
              <Area
                type="monotone"
                dataKey="max"
                stroke="none"
                fill="rgba(0, 255, 65, 0.15)"
                name="Max Score"
                connectNulls={true}
              />
              <Area
                type="monotone"
                dataKey="min"
                stroke="none"
                fill="rgba(0, 0, 0, 0.3)"
                name="Min Score"
                connectNulls={true}
              />
            </>
          )}
          
          {/* Main Line */}
          <Line
            type="monotone"
            dataKey={chartType === 'hour-analysis' ? 'avg' : 'score'}
            stroke={lineColor}
            strokeWidth={2}
            dot={{ fill: lineColor, r: 4 }}
            activeDot={{ r: 6, stroke: lineColor, strokeWidth: 2, fill: '#000' }}
            name={chartType === 'hour-analysis' ? 'Average Score' : 'Score'}
            connectNulls={true}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
