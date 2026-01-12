'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import RouterLayout from '@/components/RouterLayout';
import PixelIcon from '@/components/PixelIcon';
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

interface Model {
  id: number;
  name: string;
  displayName?: string;
  provider: string;
}

interface HourBucket {
  hour?: number;        // For hour-of-day mode (7d/30d)
  ts?: string;          // For timeline mode (24h) - ISO timestamp
  label?: string;       // For timeline mode (24h) - display label
  avg: number | null;
  min: number | null;
  max: number | null;
  count: number;
}

interface HourAnalysisData {
  mode?: 'timeline' | 'hourOfDay';  // Backend indicates which mode
  modelId: number;
  period: string;
  suite: string;
  hours: HourBucket[];
  insights: {
    bestHour: number | string | null;  // Can be number (hour 0-23) or string (label like "14:00")
    bestScore: number | null;
    worstHour: number | string | null;
    worstScore: number | null;
    avgScore: number | null;
    coverage: number;
    dataPoints: number;
    variance: number;
    recommendation: string;
  };
}

export default function PerformanceTimingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('7d');
  const [suite, setSuite] = useState<'hourly' | 'deep' | 'tooling'>('hourly');
  const [analysisData, setAnalysisData] = useState<HourAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      checkSubscription();
    } else if (status === 'unauthenticated') {
      setChecking(false);
      setHasAccess(false);
    }
  }, [status, session]);

  useEffect(() => {
    if (hasAccess) {
      fetchModels();
    }
  }, [hasAccess]);

  useEffect(() => {
    if (selectedModelId && hasAccess) {
      fetchHourAnalysis();
    }
  }, [selectedModelId, period, suite]);

  const checkSubscription = async () => {
    try {
      const response = await fetch('/api/subscription/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: session!.user!.email!
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.data.hasAccess) {
        setHasAccess(true);
      } else {
        setHasAccess(false);
      }
    } catch (err) {
      console.error('Failed to check subscription:', err);
      setHasAccess(false);
    } finally {
      setChecking(false);
    }
  };

  const fetchModels = async () => {
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/models`);
      
      if (response.ok) {
        const modelsData = await response.json();
        setModels(modelsData);
        
        // Auto-select first model
        if (modelsData.length > 0 && !selectedModelId) {
          setSelectedModelId(modelsData[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    }
  };

  const fetchHourAnalysis = async () => {
    if (!selectedModelId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
      const response = await fetch(
        `${apiUrl}/api/models/${selectedModelId}/hour-analysis?period=${period}&suite=${suite}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch hour analysis');
      }
      
      const data = await response.json();
      setAnalysisData(data);
    } catch (err) {
      console.error('Failed to fetch hour analysis:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analysis');
    } finally {
      setLoading(false);
    }
  };

  const formatHour = (hourOrLabel: number | string | null): string => {
    if (hourOrLabel === null) return 'N/A';
    if (typeof hourOrLabel === 'string') return hourOrLabel;
    return `${hourOrLabel.toString().padStart(2, '0')}:00`;
  };

  const getSuiteLabel = (s: string): string => {
    if (s === 'hourly') return 'Speed Tests (Hourly)';
    if (s === 'deep') return 'Reasoning Tests (Daily)';
    if (s === 'tooling') return 'Tool Calling Tests';
    return s;
  };

  if (checking) {
    return (
      <RouterLayout>
        <div className="vintage-container">
          <div className="crt-monitor">
            <div className="terminal-text terminal-text--green" style={{ fontSize: '1.5em', textAlign: 'center', padding: 'var(--space-xl)' }}>
              CHECKING ACCESS<span className="vintage-loading"></span>
            </div>
          </div>
        </div>
      </RouterLayout>
    );
  }

  if (!hasAccess) {
    return (
      <RouterLayout>
        <PerformanceTimingPreview />
      </RouterLayout>
    );
  }

  const selectedModel = models.find(m => m.id === selectedModelId);

  return (
    <RouterLayout>
      <div className="vintage-container">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">
              <span className="terminal-text--green">⏰ PERFORMANCE TIMING ANALYSIS</span>
              <span className="blinking-cursor"></span>
            </h1>
            <p className="dashboard-subtitle terminal-text--dim">
              Discover which hours of the day yield optimal AI model performance
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="section-card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="section-header">
            <span className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
              🎛️ ANALYSIS CONTROLS
            </span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
            <div>
              <label className="terminal-text--dim" style={{ fontSize: '0.85em', display: 'block', marginBottom: '8px' }}>
                MODEL
              </label>
              <select
                value={selectedModelId || ''}
                onChange={(e) => setSelectedModelId(parseInt(e.target.value))}
                className="mobile-form-select"
                style={{ width: '100%' }}
              >
                {models.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.displayName || model.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="terminal-text--dim" style={{ fontSize: '0.85em', display: 'block', marginBottom: '8px' }}>
                TIME PERIOD
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as any)}
                className="mobile-form-select"
                style={{ width: '100%' }}
              >
                <option value="24h">LAST 24 HOURS</option>
                <option value="7d">LAST 7 DAYS</option>
                <option value="30d">LAST 30 DAYS</option>
              </select>
            </div>

            <div>
              <label className="terminal-text--dim" style={{ fontSize: '0.85em', display: 'block', marginBottom: '8px' }}>
                BENCHMARK SUITE
              </label>
              <select
                value={suite}
                onChange={(e) => setSuite(e.target.value as any)}
                className="mobile-form-select"
                style={{ width: '100%' }}
              >
                <option value="hourly">SPEED TESTS</option>
                <option value="deep">REASONING TESTS</option>
                <option value="tooling">TOOL CALLING TESTS</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-banner" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="terminal-text">
              <div className="terminal-text--red" style={{ fontSize: '1em', marginBottom: '8px' }}>
                ⚠️ ERROR
              </div>
              <div className="terminal-text--dim" style={{ marginBottom: '8px' }}>
                {error}
              </div>
              <button onClick={fetchHourAnalysis} className="vintage-btn vintage-btn--danger">
                RETRY
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="section-card" style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
            <div className="terminal-text--dim">
              ANALYZING PERFORMANCE DATA<span className="vintage-loading"></span>
            </div>
          </div>
        ) : analysisData ? (
          <>
            {/* Chart */}
            <div className="section-card" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="section-header">
                <span className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
                  📊 HOURLY PERFORMANCE DISTRIBUTION
                </span>
                <span className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                  {selectedModel?.displayName || selectedModel?.name} • {getSuiteLabel(suite)} • {period.toUpperCase()}
                </span>
              </div>
              
              {/* Period-specific explanation */}
              <div style={{ padding: '0 var(--space-md)', marginBottom: 'var(--space-sm)' }}>
                <div className="terminal-text--amber" style={{ fontSize: '0.85em', fontStyle: 'italic' }}>
                  {period === '24h' && '⏱️ Showing performance for each hour over the past 24 hours (UTC timezone)'}
                  {period === '7d' && '📅 Each hour shows AVERAGE performance across the past 7 days (aggregated by hour-of-day)'}
                  {period === '30d' && '📆 Each hour shows AVERAGE performance across the past 30 days (aggregated by hour-of-day)'}
                </div>
                {period === '24h' && analysisData.insights.coverage < 50 && (
                  <div className="terminal-text--dim" style={{ fontSize: '0.8em', fontStyle: 'italic', marginTop: '4px' }}>
                    ℹ️ Only {analysisData.insights.dataPoints} test{analysisData.insights.dataPoints !== 1 ? 's' : ''} ran in the last 24 hours — empty hours are shown as gaps.
                  </div>
                )}
              </div>

              <HourOfDayChart data={analysisData} period={period} />
            </div>

            {/* Insights */}
            <div className="section-card">
              <div className="section-header">
                <span className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
                  💡 INSIGHTS & RECOMMENDATIONS
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                <div style={{ padding: 'var(--space-md)', background: 'rgba(0, 255, 65, 0.1)', borderRadius: '6px', border: '1px solid rgba(0, 255, 65, 0.3)' }}>
                  <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '4px' }}>
                    BEST HOUR (UTC)
                  </div>
                  <div className="terminal-text--green" style={{ fontSize: '1.8em', fontWeight: 'bold' }}>
                    {analysisData.insights.bestHour !== null ? formatHour(analysisData.insights.bestHour) : 'N/A'}
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginTop: '4px' }}>
                    Score: {analysisData.insights.bestScore !== null && analysisData.insights.bestScore !== undefined ? analysisData.insights.bestScore.toFixed(1) : 'N/A'}
                  </div>
                </div>

                <div style={{ padding: 'var(--space-md)', background: 'rgba(255, 0, 0, 0.1)', borderRadius: '6px', border: '1px solid rgba(255, 0, 0, 0.3)' }}>
                  <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '4px' }}>
                    WORST HOUR (UTC)
                  </div>
                  <div className="terminal-text--red" style={{ fontSize: '1.8em', fontWeight: 'bold' }}>
                    {analysisData.insights.worstHour !== null ? formatHour(analysisData.insights.worstHour) : 'N/A'}
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginTop: '4px' }}>
                    Score: {analysisData.insights.worstScore !== null && analysisData.insights.worstScore !== undefined ? analysisData.insights.worstScore.toFixed(1) : 'N/A'}
                  </div>
                </div>

                <div style={{ padding: 'var(--space-md)', background: 'rgba(0, 255, 65, 0.05)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                  <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '4px' }}>
                    AVERAGE SCORE
                  </div>
                  <div className="terminal-text--green" style={{ fontSize: '1.8em', fontWeight: 'bold' }}>
                    {analysisData.insights.avgScore !== null && analysisData.insights.avgScore !== undefined ? analysisData.insights.avgScore.toFixed(1) : 'N/A'}
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginTop: '4px' }}>
                    Variance: {analysisData.insights.variance !== null && analysisData.insights.variance !== undefined ? analysisData.insights.variance.toFixed(1) : 'N/A'}
                  </div>
                </div>

                <div style={{ padding: 'var(--space-md)', background: 'rgba(0, 255, 65, 0.05)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                  <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '4px' }}>
                    DATA COVERAGE
                  </div>
                  <div className="terminal-text--amber" style={{ fontSize: '1.8em', fontWeight: 'bold' }}>
                    {analysisData.insights.coverage}%
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginTop: '4px' }}>
                    {analysisData.insights.dataPoints} data points
                  </div>
                </div>
              </div>

              <div style={{ padding: 'var(--space-md)', background: 'rgba(138, 43, 226, 0.1)', borderRadius: '6px', border: '2px solid rgba(138, 43, 226, 0.5)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ fontSize: '1.5em' }}>💡</div>
                  <div>
                    <div className="terminal-text--amber" style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '8px' }}>
                      RECOMMENDATION
                    </div>
                    <div className="terminal-text" style={{ fontSize: '0.9em', lineHeight: '1.6' }}>
                      {analysisData.insights.recommendation}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="section-card" style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
            <div className="terminal-text--dim">
              Select a model to view hour-of-day performance analysis
            </div>
          </div>
        )}
      </div>
    </RouterLayout>
  );
}

// Hour-of-Day Chart Component using Recharts
function HourOfDayChart({ data, period }: { data: HourAnalysisData; period: '24h' | '7d' | '30d' }) {
  const { hours, mode } = data;
  
  // Detect mode: timeline for 24h, hour-of-day for 7d/30d
  const isTimeline = mode === 'timeline' || period === '24h';
  
  // Transform data for Recharts
  const chartData = hours.map((h, i) => {
    let xLabel = '';
    if (isTimeline) {
      xLabel = h.label || '';
    } else {
      xLabel = h.hour !== undefined ? `${h.hour.toString().padStart(2, '0')}:00` : '';
    }
    
    return {
      name: xLabel,
      avg: h.avg,
      min: h.min,
      max: h.max,
      count: h.count,
      // For area chart showing min-max range
      range: h.min !== null && h.max !== null ? [h.min, h.max] : null
    };
  });

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
        {data.avg !== null && data.avg !== undefined ? (
          <>
            <div className="terminal-text" style={{ fontSize: '0.85em', marginBottom: '4px' }}>
              Avg: <span style={{ color: '#00ff41' }}>{data.avg.toFixed(1)}</span>
            </div>
            {data.min !== null && data.max !== null && (
              <div className="terminal-text--dim" style={{ fontSize: '0.75em' }}>
                Range: {data.min.toFixed(1)} - {data.max.toFixed(1)}
              </div>
            )}
            <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginTop: '4px' }}>
              Tests: {data.count}
            </div>
          </>
        ) : (
          <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
            No data
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: 'var(--space-md)', width: '100%', height: '400px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 255, 65, 0.1)" />
          <XAxis
            dataKey="name"
            stroke="#00ff41"
            tick={{ fill: '#00ff41', fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={80}
            interval={period === '24h' ? 3 : 2}
          />
          <YAxis
            stroke="#00ff41"
            tick={{ fill: '#00ff41', fontSize: 11 }}
            label={{
              value: 'SCORE',
              angle: -90,
              position: 'insideLeft',
              style: { fill: '#00ff41', fontWeight: 'bold', fontSize: 12 }
            }}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{
              paddingTop: '20px',
              fontSize: '12px'
            }}
            iconType="line"
          />
          
          {/* Min-Max Area */}
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
          
          {/* Average Line */}
          <Line
            type="monotone"
            dataKey="avg"
            stroke="#00ff41"
            strokeWidth={2}
            dot={{ fill: '#00ff41', r: 4 }}
            activeDot={{ r: 6, stroke: '#00ff41', strokeWidth: 2, fill: '#000' }}
            name="Average Score"
            connectNulls={true}
          />
        </ComposedChart>
      </ResponsiveContainer>
      
      <div style={{ marginTop: 'var(--space-sm)', textAlign: 'center' }}>
        <div className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold' }}>
          {isTimeline ? 'LAST 24 HOURS (UTC TIMELINE)' : `HOUR OF DAY (UTC) - ${period === '7d' ? '7-DAY' : '30-DAY'} AVERAGE`}
        </div>
      </div>
    </div>
  );
}

// Preview/Paywall Component for Non-Pro Users
function PerformanceTimingPreview() {
  const router = useRouter();

  const handleStartTrial = () => {
    router.push('/api/stripe/checkout');
  };

  return (
    <div className="vintage-container">
      {/* Sticky Upgrade Banner */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'rgba(138, 43, 226, 0.15)',
        border: '2px solid rgba(138, 43, 226, 0.5)',
        borderRadius: '6px',
        padding: '12px 16px',
        marginBottom: '20px',
        boxShadow: '0 4px 12px rgba(138, 43, 226, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.5em' }}>⏰</span>
            <div>
              <div className="terminal-text" style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '2px' }}>
                PREVIEW MODE - Performance Timing Locked
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                Unlock hour-of-day performance analysis for optimal scheduling
              </div>
            </div>
          </div>
          <button
            onClick={handleStartTrial}
            className="vintage-btn vintage-btn--active"
            style={{
              padding: '8px 20px',
              fontSize: '0.9em',
              whiteSpace: 'nowrap'
            }}
          >
            START FREE TRIAL →
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="crt-monitor" style={{ marginBottom: '20px' }}>
        <div className="terminal-text">
          <h1 style={{ fontSize: '1.5em', marginBottom: '8px' }}>
            <span className="terminal-text--green">⏰ PERFORMANCE TIMING ANALYSIS</span>
            <span className="blinking-cursor"></span>
          </h1>
          <p className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
            Discover which hours of the day yield optimal AI model performance
          </p>
        </div>
      </div>

      {/* Blurred Feature Preview */}
      <div className="crt-monitor" style={{ position: 'relative', marginBottom: '20px' }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: 'blur(6px)',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          borderRadius: '6px'
        }}>
          <div style={{ fontSize: '2.5em', marginBottom: '12px' }}>⏰</div>
          <div className="terminal-text--green" style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>
            UNLOCK HOUR-OF-DAY ANALYSIS
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '16px', textAlign: 'center', maxWidth: '400px' }}>
            Identify optimal scheduling windows and avoid known degradation periods
          </div>
          <button
            onClick={handleStartTrial}
            className="vintage-btn vintage-btn--active"
            style={{ padding: '10px 24px' }}
          >
            START FREE TRIAL
          </button>
        </div>

        <div className="terminal-text" style={{ padding: '20px', filter: 'blur(4px)' }}>
          <div style={{ fontSize: '1.1em', marginBottom: '16px', color: 'var(--phosphor-green)', fontWeight: 'bold' }}>
            📊 HOURLY PERFORMANCE CHART
          </div>
          <div style={{ height: '250px', background: 'rgba(0, 255, 65, 0.05)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="terminal-text--dim">Performance Chart</div>
          </div>
        </div>
      </div>

      {/* Feature Benefits */}
      <div className="crt-monitor">
        <div className="terminal-text">
          <div style={{ fontSize: '1.2em', marginBottom: '16px', textAlign: 'center' }}>
            <span className="terminal-text--amber">💎 WHAT YOU'LL UNLOCK</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            {[
              { icon: '⏰', title: 'Hour-of-Day Analysis', desc: 'See which hours yield the best performance for any model' },
              { icon: '📊', title: 'Visual Charts', desc: 'Interactive charts showing avg, min, and max scores by hour' },
              { icon: '💡', title: 'Smart Insights', desc: 'Automated recommendations for optimal scheduling windows' },
              { icon: '🎯', title: 'Suite Comparison', desc: 'Compare speed, reasoning, and tool calling performance patterns' }
            ].map((benefit, index) => (
              <div key={index} style={{ 
                padding: '16px',
                border: '1px solid rgba(138, 43, 226, 0.3)',
                borderRadius: '4px',
                backgroundColor: 'rgba(138, 43, 226, 0.05)'
              }}>
                <div style={{ fontSize: '2em', marginBottom: '8px' }}>{benefit.icon}</div>
                <div className="terminal-text--green" style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '6px' }}>
                  {benefit.title}
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.85em', lineHeight: '1.4' }}>
                  {benefit.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Final CTA */}
          <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'rgba(138, 43, 226, 0.1)', borderRadius: '6px', border: '2px solid rgba(138, 43, 226, 0.5)' }}>
            <div className="terminal-text--amber" style={{ fontSize: '1.3em', fontWeight: 'bold', marginBottom: '8px' }}>
              $4.99/mo • 7-Day Free Trial
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '16px' }}>
              No credit card required • Cancel anytime
            </div>
            <button
              onClick={handleStartTrial}
              className="vintage-btn vintage-btn--active"
              style={{
                padding: '14px 32px',
                fontSize: '1.1em',
                fontWeight: 'bold'
              }}
            >
              UNLOCK NOW →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
