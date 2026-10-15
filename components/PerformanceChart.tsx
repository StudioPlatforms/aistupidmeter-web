'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from 'react';
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
  /**
   * 'classic' (default) is the original chart, unchanged — /router/performance-timing styles it
   * through its own overrides. 'studio' is the landing's chart style for pages inside `.st`:
   * token colours, a soft accent area, hairline grid, flat readable ticks, a studio-card tooltip
   * and a draw-in when the chart first scrolls into view. Its classes (sm-chart, sm-tip) live in
   * styles/studio-model.css, which the page using it must load. It draws the main series only
   * (showMinMax, showLegend, xAxisAngle and yAxisLabel apply to 'classic').
   */
  variant?: 'classic' | 'studio';
  /** studio: the data key for the x axis (default "name"); the tooltip still reads `name`. */
  xKey?: string;
  /** studio: short tick labels, e.g. a date from a timestamp key. */
  xTickFormatter?: (value: any, index: number) => string;
  /** studio: which x values get a tick (e.g. the first point of each day); default: let the axis pick. */
  xTicks?: Array<string | number>;
  /** studio: chart height on phones (≤ 760px). */
  mobileHeight?: number;
  /** studio: what the chart shows, for screen readers. */
  ariaLabel?: string;
}

/**
 * `inView` turns true once the element has been on screen (straight away without
 * IntersectionObserver) and stays true; `reduced` follows the visitor's reduced-motion setting.
 * Charts mount on view so their draw-in is seen, and skip it for reduced motion. Pass
 * `active = false` while the element is not rendered yet (data still loading).
 */
export function useChartReveal(ref: RefObject<Element>, active = true): { inView: boolean; reduced: boolean } {
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);
  useEffect(() => {
    if (!active || inView) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) { setInView(true); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, active, inView]);
  return { inView, reduced };
}

function StudioTooltip({ active, payload, chartType }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload as ChartDataPoint;
  const v = chartType === 'hour-analysis' ? d.avg : d.score;
  return (
    <div className="sm-tip">
      <span className="sm-tip-h">{d.name}</span>
      {v !== null && v !== undefined ? (
        <>
          <span className="sm-tip-v">
            <i className="sm-tip-k" aria-hidden="true" />
            {chartType === 'hour-analysis' ? 'Average' : 'Score'} <strong>{chartType === 'hour-analysis' ? v.toFixed(1) : Math.round(v)}</strong>
          </span>
          {chartType === 'hour-analysis' && d.count !== undefined && <span className="sm-tip-s">Tests: {d.count}</span>}
          {d.timestamp && <span className="sm-tip-s">{new Date(d.timestamp).toLocaleString()}</span>}
        </>
      ) : (
        <span className="sm-tip-s">No data</span>
      )}
    </div>
  );
}

function StudioPerformanceChart({
  data, height, mobileHeight, lineColor, chartType, xKey, xTickFormatter, xTicks, xAxisInterval, ariaLabel,
}: {
  data: ChartDataPoint[]; height: number; mobileHeight: number; lineColor: string; chartType: 'hour-analysis' | 'historical';
  xKey: string; xTickFormatter?: (value: any, index: number) => string; xTicks?: Array<string | number>;
  xAxisInterval: number | 'preserveStartEnd'; ariaLabel?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const { inView, reduced } = useChartReveal(host);
  const gid = `sm-area-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const valueKey = chartType === 'hour-analysis' ? 'avg' : 'score';
  // Dots help on a short series; on a long one they turn the line into beads.
  const dots = data.length <= 36;
  const style = { '--sm-h': `${height}px`, '--sm-hm': `${mobileHeight}px` } as CSSProperties;

  return (
    <div className="sm-chart" ref={host} style={style} role="img" aria-label={ariaLabel}>
      {inView ? (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 14, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--lp-line)" />
            <XAxis
              dataKey={xKey}
              ticks={xTicks}
              tickFormatter={xTickFormatter}
              interval={xAxisInterval}
              minTickGap={28}
              tickLine={false}
              axisLine={{ stroke: 'var(--lp-line2)' }}
              tickMargin={10}
              height={34}
            />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} width={38} tickMargin={6} />
            <Tooltip
              content={<StudioTooltip chartType={chartType} />}
              cursor={{ stroke: 'var(--lp-line2)', strokeWidth: 1 }}
              wrapperStyle={{ outline: 'none' }}
            />
            <Area
              type="monotone"
              dataKey={valueKey}
              stroke="none"
              fill={`url(#${gid})`}
              connectNulls
              isAnimationActive={!reduced}
              animationDuration={1200}
              animationEasing="ease-out"
              activeDot={false}
            />
            <Line
              type="monotone"
              dataKey={valueKey}
              stroke={lineColor}
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
              dot={dots ? { r: 2.75, fill: lineColor, stroke: 'var(--lp-card)', strokeWidth: 1.5 } : false}
              activeDot={{ r: 5, fill: 'var(--lp-card)', stroke: lineColor, strokeWidth: 2.5 }}
              name={chartType === 'hour-analysis' ? 'Average Score' : 'Score'}
              connectNulls
              isAnimationActive={!reduced}
              animationDuration={1200}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="sm-chart-wait" aria-hidden="true" />
      )}
    </div>
  );
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
  lineColor = '#1a73e8',
  chartType = 'historical',
  variant = 'classic',
  xKey = 'name',
  xTickFormatter,
  xTicks,
  mobileHeight = 260,
  ariaLabel,
}: PerformanceChartProps) {
  if (variant === 'studio') {
    return (
      <StudioPerformanceChart
        data={data}
        height={height}
        mobileHeight={mobileHeight}
        lineColor={lineColor}
        chartType={chartType}
        xKey={xKey}
        xTickFormatter={xTickFormatter}
        xTicks={xTicks}
        xAxisInterval={xAxisInterval}
        ariaLabel={ariaLabel}
      />
    );
  }


  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    
    return (
      <div style={{
        background: 'var(--terminal-dark)',
        border: '1px solid var(--metal-silver)',
        borderRadius: '10px',
        padding: '10px 12px',
        boxShadow: '0 4px 14px rgba(60, 64, 67, 0.18)'
      }}>
        <div style={{ fontSize: '0.9em', fontWeight: 700, marginBottom: '8px', color: 'var(--phosphor-green)' }}>
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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(26, 115, 232, 0.1)" />
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
                fill="rgba(26, 115, 232, 0.15)"
                name="Max Score"
                connectNulls={true}
              />
              <Area
                type="monotone"
                dataKey="min"
                stroke="none"
                fill="rgba(148, 163, 184, 0.14)"
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
            activeDot={{ r: 6, stroke: lineColor, strokeWidth: 2, fill: '#fff' }}
            name={chartType === 'hour-analysis' ? 'Average Score' : 'Score'}
            connectNulls={true}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
