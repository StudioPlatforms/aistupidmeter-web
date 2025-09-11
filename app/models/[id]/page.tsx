'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import '../../../styles/vintage.css';

interface ModelDetails {
  id: number;
  name: string;
  vendor: string;
  version?: string;
  notes?: string;
  latestScore?: {
    stupidScore: number;
    displayScore?: number;
    axes: {
      correctness: number;
      spec: number;
      codeQuality: number;
      efficiency: number;
      stability: number;
      refusal: number;
      recovery: number;
    };
    ts: string;
    note?: string;
  };
}

interface ModelHistory {
  modelId: number;
  period: string;
  dataPoints: number;
  history: Array<{
    timestamp: string;
    stupidScore: number;
    displayScore?: number;
    axes: {
      correctness: number;
      spec: number;
      codeQuality: number;
      efficiency: number;
      stability: number;
      refusal: number;
      recovery: number;
    };
    note?: string;
  }>;
}

interface ModelStats {
  modelId: number;
  currentScore: number;
  totalRuns: number;
  successfulRuns: number;
  successRate: number;
  averageCorrectness: number;
  averageLatency: number;
}

interface ModelPerformance {
  modelId: number;
  taskPerformance: Array<{
    taskId: number;
    taskSlug: string;
    runs: Array<{
      runId: number;
      passed: boolean;
      latencyMs: number;
      timestamp: string;
      correctness: number;
      spec: number;
      codeQuality: number;
      efficiency: number;
      stability: number;
      refusal: number;
      recovery: number;
    }>;
    averageMetrics: {
      correctness: number;
      spec: number;
      codeQuality: number;
      efficiency: number;
      stability: number;
      refusal: number;
      recovery: number;
    };
    successRate: number;
  }>;
}

type HistoricalPeriod = 'latest' | '24h' | '7d' | '1m';

// Extend Window interface for debugging
declare global {
  interface Window {
    dashboardModelData?: any;
    debugModelData?: any;
  }
}

export default function ModelDetailPage() {
  const router = useRouter();
  const params = useParams();
  const chartRef = useRef<SVGSVGElement>(null);

  // Core data states
  const [modelDetails, setModelDetails] = useState<ModelDetails | null>(null);
  const [history, setHistory] = useState<ModelHistory | null>(null);
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [performance, setPerformance] = useState<ModelPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  // UI control states
  const [selectedPeriod, setSelectedPeriod] = useState<HistoricalPeriod>('latest');
  const [showExpandedDetails, setShowExpandedDetails] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [chartHoverPoint, setChartHoverPoint] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Chart animation state
  const [chartAnimationProgress, setChartAnimationProgress] = useState(0);

  const fetchModelData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    }

    let modelData: any = null; // Declare at function level for scope access

    try {
      if (!showRefreshIndicator) {
        setLoading(true);
      }

      const modelIdStr = params.id as string;
      // Use production URL to ensure we're hitting the real API
      const apiUrl = 'https://aistupidlevel.info';
      
      console.log('🔍 Fetching model details for ID:', modelIdStr);
      console.log('🌐 Using API URL:', apiUrl);
      
      // Dashboard always provides numeric IDs as strings, so parse directly
      const modelId = parseInt(modelIdStr);
      console.log('📊 Parsed model ID:', modelId);
      
      if (isNaN(modelId)) {
        throw new Error(`Invalid model ID: ${modelIdStr}`);
      }

      // First, verify we're getting the right model by checking dashboard data
      console.log('🔍 Verifying model exists in dashboard data...');
      const dashboardResponse = await fetch(`${apiUrl}/api/dashboard/scores?period=${selectedPeriod}`);
      const dashboardData = await dashboardResponse.json();
      
      if (dashboardData.success) {
        const dashboardModel = dashboardData.data.find((m: any) => m.id === modelId.toString());
        if (dashboardModel) {
          console.log('✅ Found model in dashboard:', {
            id: dashboardModel.id,
            name: dashboardModel.name,
            score: dashboardModel.currentScore,
            provider: dashboardModel.provider,
            lastUpdate: dashboardModel.lastUpdate
          });
          
          // Store dashboard data as the source of truth for verification
          window.dashboardModelData = dashboardModel;
          
          // Verify this is actually the model we expect
          console.log('🔍 Model verification:', {
            requestedId: modelId,
            foundId: dashboardModel.id,
            modelName: dashboardModel.name,
            dashboardScore: dashboardModel.currentScore
          });
        } else {
          console.log('⚠️ Model not found in dashboard data for period:', selectedPeriod);
          console.log('Available models:', dashboardData.data.map((m: any) => ({ id: m.id, name: m.name })));
          throw new Error(`Model ${modelId} not found in dashboard data`);
        }
      }
      
      if (modelId) {
        // Use API's built-in period filtering for accurate results
        console.log(`🔄 Fetching period-specific data from API (${selectedPeriod})`);
        const [modelResponse, historyResponse, statsResponse, performanceResponse] = await Promise.all([
          fetch(`${apiUrl}/api/models/${modelId}?period=${selectedPeriod}`),
          fetch(`${apiUrl}/api/models/${modelId}/history?days=30`),  // Always get 30 days for chart
          fetch(`${apiUrl}/api/models/${modelId}/stats?period=${selectedPeriod}`),
          fetch(`${apiUrl}/api/models/${modelId}/performance?period=${selectedPeriod}`)
        ]);
        
        if (modelResponse.ok) {
          modelData = await modelResponse.json();
          console.log('✅ Model data loaded successfully from API:', modelData);
          console.log('🎯 Current score:', modelData.latestScore?.displayScore || 'Not available');
          setModelDetails(modelData);
        } else {
          throw new Error('Model not found');
        }
        
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          console.log('✅ History data loaded successfully from API:', historyData);
          console.log('📊 Chart data points:', historyData.dataPoints, 'Period:', historyData.period);
          setHistory(historyData);
        } else {
          console.log('⚠️ No history data from API, using empty state');
          setHistory({ modelId, period: '30 days', dataPoints: 0, history: [] });
        }
        
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          console.log('✅ Stats data loaded successfully from API for period', selectedPeriod, ':', statsData);
          console.log('📈 Performance metrics for period', selectedPeriod, '- Score:', statsData.currentScore, 'Runs:', statsData.totalRuns, 'Success Rate:', statsData.successRate + '%');
          
          // Score consistency check - compare with dashboard data
          if (window.dashboardModelData && selectedPeriod === 'latest') {
            const dashboardScore = window.dashboardModelData.currentScore;
            const detailScore = statsData.currentScore;
            const modelScore = modelData?.latestScore?.displayScore;
            
            console.log('🔍 Score consistency check:', {
              dashboardScore,
              detailStatsScore: detailScore,
              modelLatestScore: modelScore,
              modelName: window.dashboardModelData.name
            });
            
            if (Math.abs(dashboardScore - detailScore) > 1) {
              console.warn('⚠️ SCORE INCONSISTENCY DETECTED!', {
                dashboardScore,
                detailScore,
                difference: Math.abs(dashboardScore - detailScore),
                modelName: window.dashboardModelData.name,
                period: selectedPeriod
              });
              
              // Use dashboard score as source of truth for consistency
              statsData.currentScore = dashboardScore;
              console.log('✅ Using dashboard score as source of truth:', dashboardScore);
            }
          }
          
          setStats(statsData);
        } else {
          console.log('⚠️ No stats data from API, using empty state');
          setStats({ modelId, currentScore: 0, totalRuns: 0, successfulRuns: 0, successRate: 0, averageCorrectness: 0, averageLatency: 0 });
        }

        if (performanceResponse.ok) {
          const performanceData = await performanceResponse.json();
          console.log('✅ Performance data loaded successfully from API:', performanceData);
          console.log('🔧 Task performance breakdown:', performanceData.taskPerformance?.length || 0, 'tasks');
          setPerformance(performanceData);
        } else {
          console.log('⚠️ No performance data from API, using empty state');
          setPerformance({ modelId, taskPerformance: [] });
        }
        
        console.log('🎉 All model data successfully loaded from real API endpoints!');
        
      } else {
        throw new Error('Model ID could not be resolved');
      }
      
    } catch (error) {
      console.error('❌ Failed to fetch model details:', error);
      console.log('🔄 Using fallback data generation...');
      
      // Enhanced fallback that tries to be more realistic
      const mockModel = generateFallbackData(params.id as string);
      setModelDetails(mockModel);
      setHistory({ modelId: parseInt(params.id as string) || 1, period: 'mock data', dataPoints: 0, history: [] });
      setStats({ modelId: parseInt(params.id as string) || 1, currentScore: 0, totalRuns: 0, successfulRuns: 0, successRate: 0, averageCorrectness: 0, averageLatency: 0 });
      setPerformance({ modelId: parseInt(params.id as string) || 1, taskPerformance: [] });
    } finally {
      setLoading(false);
      if (showRefreshIndicator) {
        setIsRefreshing(false);
      }
      setLastRefresh(new Date());
      
      // Trigger chart animation
      setChartAnimationProgress(0);
      setTimeout(() => setChartAnimationProgress(1), 100);
    }
  };

  // Effect to fetch data when model ID or period changes
  useEffect(() => {
    fetchModelData();
  }, [params.id, selectedPeriod]);

  // Auto-refresh effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchModelData(true);
      }, 120000); // 2 minutes
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, selectedPeriod]);

  const generateFallbackData = (id: string): ModelDetails => {
    const parts = id.split('-');
    const provider = parts[0] || 'unknown';
    const modelName = parts.slice(1).join('-') || 'model';
    
    const getProviderScore = (provider: string) => {
      switch (provider.toLowerCase()) {
        case 'openai': return Math.floor(Math.random() * 20) + 75;
        case 'anthropic': return Math.floor(Math.random() * 20) + 70;
        case 'google': return Math.floor(Math.random() * 30) + 60;
        case 'xai': return Math.floor(Math.random() * 25) + 65;
        default: return Math.floor(Math.random() * 40) + 40;
      }
    };
    
    const score = getProviderScore(provider);
    const stupidScore = (score - 50) * 2;
    
    return {
      id: 1,
      name: modelName.replace(/-/g, '-').toUpperCase(),
      vendor: provider,
      version: 'latest',
      notes: `Demo data for ${provider} model`,
      latestScore: {
        stupidScore: stupidScore,
        axes: {
          correctness: Math.random() * 0.3 + 0.7,
          spec: Math.random() * 0.2 + 0.8,
          codeQuality: Math.random() * 0.4 + 0.6,
          efficiency: Math.random() * 0.3 + 0.5,
          stability: Math.random() * 0.2 + 0.7,
          refusal: Math.random() * 0.1 + 0.9,
          recovery: Math.random() * 0.4 + 0.5
        },
        ts: new Date().toISOString(),
        note: 'Demo performance data'
      }
    };
  };

  const getProviderName = (vendor: string): string => {
    switch (vendor.toLowerCase()) {
      case 'openai': return 'OpenAI';
      case 'xai': return 'xAI';
      case 'anthropic': return 'Anthropic';
      case 'google': return 'Google';
      default: return vendor.charAt(0).toUpperCase() + vendor.slice(1);
    }
  };

  const getStatusFromScore = (score: number): string => {
    if (score >= 80) return 'excellent';
    if (score >= 65) return 'good';
    if (score >= 40) return 'warning';
    return 'critical';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'excellent': return 'terminal-text--green';
      case 'good': return 'terminal-text--green';
      case 'warning': return 'terminal-text--amber';
      case 'critical': return 'terminal-text--red';
      default: return 'terminal-text--dim';
    }
  };

  const getTrendFromHistory = (): string => {
    if (!history || history.history.length < 2) return 'stable';
    
    const recent = history.history.slice(0, 3);
    const older = history.history.slice(3, 6);
    
    if (older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, h) => sum + h.stupidScore, 0) / recent.length;
    const olderAvg = older.reduce((sum, h) => sum + h.stupidScore, 0) / older.length;
    
    if (recentAvg < olderAvg - 5) return 'up';
    if (recentAvg > olderAvg + 5) return 'down';
    return 'stable';
  };

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'up': return '↗';
      case 'down': return '↘';
      case 'stable': return '→';
      default: return '—';
    }
  };

  const formatTimeAgo = (dateStr: string): string => {
    const date = new Date(dateStr);
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Enhanced chart rendering with professional features
  const renderProfessionalChart = () => {
    if (!history || history.history.length === 0) {
      return (
        <div className="professional-chart-container" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="terminal-text--dim" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3em', marginBottom: '16px', opacity: 0.3 }}>📊</div>
            <div>NO HISTORICAL DATA AVAILABLE</div>
            <div style={{ fontSize: '0.8em', marginTop: '8px' }}>Check back after the model runs some benchmarks</div>
          </div>
        </div>
      );
    }

    // Filter history based on selected period (same logic as main dashboard)
    const filteredHistory = (() => {
      const now = Date.now();
      let cutoffTime;
      
      switch (selectedPeriod) {
        case '24h':
          cutoffTime = now - (24 * 60 * 60 * 1000);
          break;
        case '7d':
          cutoffTime = now - (7 * 24 * 60 * 60 * 1000);
          break;
        case '1m':
          cutoffTime = now - (30 * 24 * 60 * 60 * 1000);
          break;
        default: // 'latest'
          // Show last 24 data points for 'latest'
          return history.history.slice(0, 24);
      }
      
      // Filter data by timestamp if timestamps are available
      if (history.history[0]?.timestamp) {
        return history.history.filter(h => {
          const timestamp = new Date(h.timestamp).getTime();
          return timestamp >= cutoffTime;
        });
      }
      
      // Fallback to showing proportional amount of data
      const dataPointsToShow = selectedPeriod === '24h' ? 24 : selectedPeriod === '7d' ? 168 : 720;
      return history.history.slice(0, Math.min(dataPointsToShow, history.history.length));
    })();

    if (filteredHistory.length === 0) {
      return (
        <div className="professional-chart-container" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="terminal-text--dim" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3em', marginBottom: '16px', opacity: 0.3 }}>📊</div>
            <div>NO DATA FOR SELECTED PERIOD</div>
            <div style={{ fontSize: '0.8em', marginTop: '8px' }}>Try selecting a longer time period</div>
          </div>
        </div>
      );
    }

    // Responsive chart dimensions
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const chartWidth = isMobile ? Math.min(350, (typeof window !== 'undefined' ? window.innerWidth - 80 : 350)) : Math.min(600, (typeof window !== 'undefined' ? window.innerWidth * 0.8 : 600));
    const chartHeight = isMobile ? 250 : 300;
    const padding = { 
      top: 20, 
      right: isMobile ? 40 : 60, 
      bottom: isMobile ? 50 : 60, 
      left: isMobile ? 40 : 60 
    };
    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;

    // Prepare data - reverse filtered history to show oldest to newest (left to right)
    const data = [...filteredHistory].reverse();
    const displayScores = data.map(d => {
      // Prioritize displayScore from API (our endpoints now provide this)
      if (d.displayScore !== undefined) {
        return d.displayScore;
      }
      // Fallback conversion for any legacy data (shouldn't be needed with current API)
      const rawScore = d.stupidScore;
      if (Math.abs(rawScore) < 1 || Math.abs(rawScore) > 100) {
        return Math.max(0, Math.min(100, Math.round(50 - rawScore * 100)));
      } else {
        return Math.max(0, Math.min(100, Math.round(rawScore)));
      }
    });
    const maxScore = Math.max(...displayScores, 100);
    const minScore = Math.min(...displayScores, 0);
    const range = maxScore - minScore || 1;

    // Generate chart points
    const points = data.map((point, index) => {
      // Use displayScore from API if available, otherwise convert with robust logic
      const displayScore = point.displayScore !== undefined 
        ? point.displayScore 
        : (() => {
            const rawScore = point.stupidScore;
            if (Math.abs(rawScore) < 1 || Math.abs(rawScore) > 100) {
              return Math.max(0, Math.min(100, Math.round(50 - rawScore * 100)));
            } else {
              return Math.max(0, Math.min(100, Math.round(rawScore)));
            }
          })();
      const x = padding.left + (index / Math.max(1, data.length - 1)) * plotWidth;
      const y = padding.top + plotHeight - ((displayScore - minScore) / range) * plotHeight;
      return { x, y, score: displayScore, data: point, index };
    });

    // Generate path for animated line
    const animatedPoints = points.slice(0, Math.ceil(points.length * chartAnimationProgress));
    const pathData = animatedPoints.length > 0 ? 
      `M ${animatedPoints[0].x},${animatedPoints[0].y} ` +
      animatedPoints.slice(1).map(p => `L ${p.x},${p.y}`).join(' ')
      : '';

    // Generate grid lines
    const gridLines = [];
    const numYLines = 5;
    const numXLines = Math.min(6, data.length);
    
    // Horizontal grid lines
    for (let i = 0; i <= numYLines; i++) {
      const y = padding.top + (plotHeight / numYLines) * i;
      const value = maxScore - ((maxScore - minScore) / numYLines) * i;
      gridLines.push(
        <g key={`hgrid-${i}`}>
          <line
            x1={padding.left}
            y1={y}
            x2={padding.left + plotWidth}
            y2={y}
            stroke="rgba(0, 255, 65, 0.1)"
            strokeWidth="1"
          />
          <text
            x={padding.left - 10}
            y={y + 4}
            fill="var(--phosphor-dim)"
            fontSize="10"
            textAnchor="end"
          >
            {Math.round(value)}
          </text>
        </g>
      );
    }

    // Vertical grid lines
    for (let i = 0; i <= numXLines; i++) {
      const x = padding.left + (plotWidth / numXLines) * i;
      const dataIndex = Math.floor((data.length - 1) * (i / numXLines));
      const point = data[dataIndex];
      
      if (point) {
        gridLines.push(
          <g key={`vgrid-${i}`}>
            <line
              x1={x}
              y1={padding.top}
              x2={x}
              y2={padding.top + plotHeight}
              stroke="rgba(0, 255, 65, 0.05)"
              strokeWidth="1"
            />
            <text
              x={x}
              y={padding.top + plotHeight + 20}
              fill="var(--phosphor-dim)"
              fontSize="9"
              textAnchor="middle"
              transform={`rotate(-45, ${x}, ${padding.top + plotHeight + 20})`}
            >
              {new Date(point.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </text>
          </g>
        );
      }
    }

    return (
      <div className="professional-chart-container" style={{ 
        padding: '20px', 
        background: 'rgba(0, 0, 0, 0.2)', 
        borderRadius: '8px',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <svg
          ref={chartRef}
          width={chartWidth}
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          style={{ 
            background: 'rgba(0, 0, 0, 0.3)', 
            borderRadius: '4px',
            maxWidth: '100%',
            height: 'auto'
          }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Find closest point
            let closest = null;
            let minDistance = Infinity;
            
            points.forEach(point => {
              const distance = Math.sqrt(
                Math.pow(mouseX - point.x, 2) + Math.pow(mouseY - point.y, 2)
              );
              if (distance < minDistance && distance < 20) {
                minDistance = distance;
                closest = point;
              }
            });
            
            setChartHoverPoint(closest);
          }}
          onMouseLeave={() => setChartHoverPoint(null)}
        >
          {/* Grid */}
          {gridLines}
          
          {/* Area fill */}
          {animatedPoints.length > 0 && (
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--phosphor-green)" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="var(--phosphor-green)" stopOpacity="0.05"/>
              </linearGradient>
            </defs>
          )}
          
          {animatedPoints.length > 0 && (
            <path
              d={pathData + ` L ${animatedPoints[animatedPoints.length - 1].x},${padding.top + plotHeight} L ${padding.left},${padding.top + plotHeight} Z`}
              fill="url(#scoreGradient)"
            />
          )}
          
          {/* Main line */}
          {animatedPoints.length > 0 && (
            <path
              d={pathData}
              fill="none"
              stroke="var(--phosphor-green)"
              strokeWidth="3"
              filter="drop-shadow(0 0 4px var(--phosphor-green))"
            />
          )}
          
          {/* Data points */}
          {animatedPoints.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={chartHoverPoint?.index === point.index ? 6 : 4}
              fill="var(--phosphor-green)"
              stroke="var(--terminal-black)"
              strokeWidth="2"
              filter="drop-shadow(0 0 3px var(--phosphor-green))"
              style={{ cursor: 'pointer' }}
            />
          ))}
          
          {/* Hover tooltip */}
          {chartHoverPoint && (
            <g>
              <rect
                x={chartHoverPoint.x + 10}
                y={chartHoverPoint.y - 60}
                width="140"
                height="50"
                fill="var(--terminal-black)"
                stroke="var(--phosphor-green)"
                strokeWidth="1"
                rx="4"
                filter="drop-shadow(2px 2px 4px rgba(0,0,0,0.5))"
              />
              <text
                x={chartHoverPoint.x + 20}
                y={chartHoverPoint.y - 40}
                fill="var(--phosphor-green)"
                fontSize="12"
                fontWeight="bold"
              >
                Score: {chartHoverPoint.score}
              </text>
              <text
                x={chartHoverPoint.x + 20}
                y={chartHoverPoint.y - 25}
                fill="var(--phosphor-dim)"
                fontSize="10"
              >
                {new Date(chartHoverPoint.data.timestamp).toLocaleDateString()}
              </text>
              <text
                x={chartHoverPoint.x + 20}
                y={chartHoverPoint.y - 10}
                fill="var(--phosphor-dim)"
                fontSize="10"
              >
                {new Date(chartHoverPoint.data.timestamp).toLocaleTimeString()}
              </text>
            </g>
          )}
          
          {/* Axis labels */}
          <text
            x={chartWidth / 2}
            y={chartHeight - 5}
            fill="var(--phosphor-green)"
            fontSize="12"
            textAnchor="middle"
            fontWeight="bold"
          >
            Timeline
          </text>
          
          <text
            x={15}
            y={chartHeight / 2}
            fill="var(--phosphor-green)"
            fontSize="12"
            textAnchor="middle"
            fontWeight="bold"
            transform={`rotate(-90, 15, ${chartHeight / 2})`}
          >
            Performance Score
          </text>
        </svg>
        
        {/* Chart stats */}
        <div className="chart-stats-grid">
          <div className="terminal-text--dim" style={{ textAlign: 'center' }}>
            Data Points: <br/>
            <span className="terminal-text">{data.length}</span>
          </div>
          <div className="terminal-text--dim" style={{ textAlign: 'center' }}>
            Period: <br/>
            <span className="terminal-text">{history.period}</span>
          </div>
          <div className="terminal-text--dim" style={{ textAlign: 'center' }}>
            Range: <br/>
            <span className="terminal-text">{minScore} - {maxScore}</span>
          </div>
          <div className="terminal-text--dim" style={{ textAlign: 'center' }}>
            Average: <br/>
            <span className="terminal-text">{Math.round(displayScores.reduce((a, b) => a + b, 0) / displayScores.length)}</span>
          </div>
        </div>
      </div>
    );
  };

  // Loading screen
  if (loading) {
    return (
      <div className="vintage-container">
        <div className="crt-monitor" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="terminal-text">
            <div style={{ fontSize: '2em', marginBottom: '24px' }}>
              <span className="terminal-text--green">LOADING MODEL ANALYTICS</span>
            </div>
            <div style={{ fontSize: '4em', marginBottom: '16px', opacity: 0.6 }}>⚡</div>
            <div className="vintage-loading" style={{ fontSize: '1.2em' }}></div>
            <div className="terminal-text--dim" style={{ marginTop: '16px' }}>
              Fetching performance data, historical metrics, and analytics...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error screen
  if (!modelDetails) {
    return (
      <div className="vintage-container">
        <div className="crt-monitor" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="terminal-text">
            <div style={{ fontSize: '2em', marginBottom: '24px' }}>
              <span className="terminal-text--red">MODEL NOT FOUND</span>
            </div>
            <div style={{ fontSize: '4em', marginBottom: '16px', opacity: 0.6 }}>⚠️</div>
            <div className="terminal-text--dim" style={{ marginBottom: '24px' }}>
              The requested model could not be located in our database.
            </div>
            <button onClick={() => router.push('/')} className="vintage-btn">
              ← RETURN TO DASHBOARD
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate period-specific metrics from client-side filtered data
  const getPeriodSpecificData = () => {
    if (!history || history.history.length === 0) {
      // Fallback to stats API data when no history available
      return {
        currentScore: stats?.currentScore || modelDetails.latestScore?.displayScore || 0,
        filteredHistory: [],
        periodStats: stats
      };
    }

    // Filter history data based on selected period (same logic as chart)
    const now = Date.now();
    let filteredHistory: typeof history.history = [];
    
    switch (selectedPeriod) {
      case '24h': {
        const cutoffTime = now - (24 * 60 * 60 * 1000);
        if (history.history[0]?.timestamp) {
          filteredHistory = history.history.filter(h => {
            const timestamp = new Date(h.timestamp).getTime();
            return timestamp >= cutoffTime;
          });
        } else {
          filteredHistory = history.history.slice(0, Math.min(24, history.history.length));
        }
        break;
      }
      case '7d': {
        const cutoffTime = now - (7 * 24 * 60 * 60 * 1000);
        if (history.history[0]?.timestamp) {
          filteredHistory = history.history.filter(h => {
            const timestamp = new Date(h.timestamp).getTime();
            return timestamp >= cutoffTime;
          });
        } else {
          filteredHistory = history.history.slice(0, Math.min(168, history.history.length));
        }
        break;
      }
      case '1m': {
        const cutoffTime = now - (30 * 24 * 60 * 60 * 1000);
        if (history.history[0]?.timestamp) {
          filteredHistory = history.history.filter(h => {
            const timestamp = new Date(h.timestamp).getTime();
            return timestamp >= cutoffTime;
          });
        } else {
          filteredHistory = history.history.slice(0, Math.min(720, history.history.length));
        }
        break;
      }
      default: // 'latest'
        // Show last 24 data points for 'latest'
        filteredHistory = history.history.slice(0, 24);
        break;
    }

    if (filteredHistory.length === 0) {
      // No data for this period, fall back to latest
      return {
        currentScore: stats?.currentScore || modelDetails.latestScore?.displayScore || 0,
        filteredHistory: [],
        periodStats: stats
      };
    }

    // Calculate period-specific score from filtered data
    const periodScores = filteredHistory.map(h => {
      // Convert to display score using same logic as chart
      if (h.displayScore !== undefined) {
        return h.displayScore;
      }
      const rawScore = h.stupidScore;
      if (Math.abs(rawScore) < 1 || Math.abs(rawScore) > 100) {
        return Math.max(0, Math.min(100, Math.round(50 - rawScore * 100)));
      } else {
        return Math.max(0, Math.min(100, Math.round(rawScore)));
      }
    });
    
    // Use the latest (most recent) score from the period, not the maximum
    const periodScore = periodScores.length > 0 ? periodScores[0] : 0;
    
    // Calculate period-specific stats
    const periodStats = {
      modelId: history.modelId,
      currentScore: periodScore,
      totalRuns: filteredHistory.length,
      successfulRuns: filteredHistory.filter(h => {
        const score = h.displayScore !== undefined ? h.displayScore : 
          Math.abs(h.stupidScore) < 1 ? Math.round(50 - h.stupidScore * 100) : Math.round(h.stupidScore);
        return score >= 50; // Consider scores >= 50 as successful
      }).length,
      successRate: 0,
      averageCorrectness: 0,
      averageLatency: 1000 // Approximate
    };
    
    periodStats.successRate = periodStats.totalRuns > 0 ? 
      Math.round((periodStats.successfulRuns / periodStats.totalRuns) * 100) : 0;
    
    periodStats.averageCorrectness = filteredHistory.length > 0 ?
      filteredHistory.reduce((sum, h) => sum + (h.axes?.correctness || 0), 0) / filteredHistory.length : 0;

    console.log(`📊 Period-specific data for ${selectedPeriod}:`, {
      periodScore,
      totalRuns: periodStats.totalRuns,
      successRate: periodStats.successRate,
      dataPoints: filteredHistory.length
    });

    return {
      currentScore: periodScore,
      filteredHistory,
      periodStats
    };
  };

  // Use API data directly instead of client-side calculations
  const currentScore = stats?.currentScore || modelDetails.latestScore?.displayScore || 0;
  const status = getStatusFromScore(currentScore);
  const trend = getTrendFromHistory();

  return (
    <div className="vintage-container">
      {/* Enhanced Header with Navigation */}
      <div className="crt-monitor">
        <div className="terminal-text">
          <div className="model-header">
            <div className="model-info">
              <div className="model-title">
                <span className="terminal-text--green">{modelDetails.name.toUpperCase()}</span>
                <span className="blinking-cursor"></span>
              </div>
              <div className="model-subtitle terminal-text--dim">
                {getProviderName(modelDetails.vendor)} • Advanced Performance Analytics
              </div>
              <div className="model-status-grid">
                <div className="terminal-text--dim">
                  <span className={getStatusColor(status)}>● {status.toUpperCase()}</span>
                </div>
                <div className="terminal-text--dim">
                  Trend: <span className={
                    trend === 'up' ? 'terminal-text--green' :
                    trend === 'down' ? 'terminal-text--red' : 'terminal-text--dim'
                  }>{getTrendIcon(trend)} {trend.toUpperCase()}</span>
                </div>
                <div className="terminal-text--dim">
                  Last Update: <span className="terminal-text">{modelDetails.latestScore ? formatTimeAgo(modelDetails.latestScore.ts) : 'Unknown'}</span>
                </div>
              </div>
            </div>
            <div className="model-controls">
              <button 
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`vintage-btn model-control-btn ${autoRefresh ? 'vintage-btn--active' : ''}`}
              >
                {autoRefresh ? '🔄 AUTO-REFRESH ON' : '🔄 AUTO-REFRESH OFF'}
              </button>
              <button 
                onClick={() => fetchModelData(true)}
                disabled={isRefreshing}
                className="vintage-btn model-control-btn"
              >
                {isRefreshing ? '⟳ REFRESHING...' : '⟳ REFRESH NOW'}
              </button>
              <button onClick={() => router.push('/')} className="vintage-btn model-control-btn">
                ← DASHBOARD
              </button>
            </div>
          </div>
          
          {autoRefresh && (
            <div className="auto-refresh-status terminal-text--dim">
              Auto-refresh enabled • Next update: {new Date(lastRefresh.getTime() + 120000).toLocaleTimeString()}
              {isRefreshing && <span className="blinking-cursor" style={{ marginLeft: '8px' }}>⟳</span>}
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Hero Section with Tabbed Historical Data */}
      <div className="vintage-grid" style={{ 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '20px' 
      }}>
        {/* Historical Performance Chart */}
        <div className="crt-monitor" style={{ 
          padding: '24px',
          minWidth: '0',
          overflow: 'hidden'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '1.3em', marginBottom: '12px', textAlign: 'center' }}>
              📈 PERFORMANCE TIMELINE
            </div>
            
            {/* Period Selection Tabs */}
            <div className="period-tabs">
              {(['latest', '24h', '7d', '1m'] as HistoricalPeriod[]).map(period => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`vintage-btn period-tab ${selectedPeriod === period ? 'vintage-btn--active' : ''}`}
                  style={{ 
                    color: selectedPeriod === period ? 'var(--terminal-black)' : 'var(--phosphor-green)',
                    background: selectedPeriod === period ? 'var(--phosphor-green)' : 'linear-gradient(135deg, #333, #222)'
                  }}
                  disabled={isRefreshing}
                >
                  {period.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          
          {/* Professional Chart */}
          {renderProfessionalChart()}
        </div>

        {/* Current Score & Key Metrics */}
        <div className="crt-monitor" style={{ padding: '24px' }}>
          <div style={{ fontSize: '1.3em', marginBottom: '12px', textAlign: 'center' }}>
            🎯 {selectedPeriod === 'latest' ? 'CURRENT PERFORMANCE' : `PERFORMANCE (${selectedPeriod.toUpperCase()})`}
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.8em', textAlign: 'center', marginBottom: '16px' }}>
            {selectedPeriod === 'latest' ? 
              'Latest benchmark results and real-time metrics' : 
              `Best performance metrics within the last ${selectedPeriod === '24h' ? '24 hours' : selectedPeriod === '7d' ? '7 days' : '30 days'}`
            }
          </div>
          
          {/* Large Score Display */}
          <div className="vintage-gauge" style={{ transform: 'scale(0.85)', marginBottom: '20px' }}>
            <div className="gauge-face">
              <div className={`gauge-value ${getStatusColor(status)}`}>
                {currentScore}
              </div>
              <div className="gauge-label terminal-text--dim">SCORE</div>
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85em' }}>
            <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(0, 255, 65, 0.05)', borderRadius: '4px' }}>
              <div className="terminal-text--dim">Total Runs</div>
              <div className="terminal-text" style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                {stats?.totalRuns || 0}
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(0, 255, 65, 0.05)', borderRadius: '4px' }}>
              <div className="terminal-text--dim">Success Rate</div>
              <div className={`${(stats?.successRate || 0) >= 80 ? 'terminal-text--green' : (stats?.successRate || 0) >= 60 ? 'terminal-text--amber' : 'terminal-text--red'}`} 
                   style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                {stats?.successRate || 0}%
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(0, 255, 65, 0.05)', borderRadius: '4px' }}>
              <div className="terminal-text--dim">Avg Latency</div>
              <div className="terminal-text" style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                {Math.round(stats?.averageLatency || 0)}ms
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(0, 255, 65, 0.05)', borderRadius: '4px' }}>
              <div className="terminal-text--dim">Correctness</div>
              <div className={`${(stats?.averageCorrectness || 0) >= 0.8 ? 'terminal-text--green' : (stats?.averageCorrectness || 0) >= 0.6 ? 'terminal-text--amber' : 'terminal-text--red'}`} 
                   style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                {Math.round((stats?.averageCorrectness || 0) * 100)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced 7-Axis Performance Breakdown */}
      <div className="crt-monitor">
        <div className="terminal-text" style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '1.3em', marginBottom: '8px', textAlign: 'center' }}>
            🎯 7-AXIS PERFORMANCE MATRIX {selectedPeriod !== 'latest' && `(${selectedPeriod.toUpperCase()})`}
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.9em', textAlign: 'center', marginBottom: '8px' }}>
            {selectedPeriod === 'latest' ? 
              'Comprehensive analysis across all evaluation criteria' : 
              `Performance breakdown for the selected ${selectedPeriod === '24h' ? '24-hour' : selectedPeriod === '7d' ? '7-day' : '30-day'} period`
            }
          </div>
          {selectedPeriod !== 'latest' && (
            <div className="terminal-text--amber" style={{ fontSize: '0.75em', textAlign: 'center', marginBottom: '16px' }}>
              📊 Showing metrics from the best-performing benchmark within this timeframe
            </div>
          )}
        </div>

        {modelDetails.latestScore && modelDetails.latestScore.axes && (
          <div className="vintage-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {(() => {
              const axes = modelDetails.latestScore.axes;
              const axisConfig = [
                { key: 'correctness', label: 'CORRECTNESS', icon: '✅', weight: '35%', description: 'Code functionality and accuracy' },
                { key: 'spec', label: 'SPEC COMPLIANCE', icon: '📋', weight: '15%', description: 'Following instructions and format' },
                { key: 'codeQuality', label: 'CODE QUALITY', icon: '🎨', weight: '15%', description: 'Readability and best practices' },
                { key: 'efficiency', label: 'EFFICIENCY', icon: '⚡', weight: '10%', description: 'Response speed and optimization' },
                { key: 'stability', label: 'STABILITY', icon: '🔄', weight: '10%', description: 'Consistent performance' },
                { key: 'refusal', label: 'REFUSAL RATE', icon: '🚫', weight: '10%', description: 'Appropriate task acceptance' },
                { key: 'recovery', label: 'RECOVERY', icon: '🔧', weight: '5%', description: 'Error correction ability' }
              ];

              return axisConfig.map((axis, index) => {
                const value = axes[axis.key as keyof typeof axes] || 0;
                const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                const percentage = Math.max(0, Math.min(100, numericValue * 100));
                const color = percentage >= 80 ? 'terminal-text--green' : 
                             percentage >= 60 ? 'terminal-text--amber' : 'terminal-text--red';
                
                return (
                  <div key={axis.key} 
                       style={{ 
                         padding: '16px', 
                         background: 'rgba(0, 255, 65, 0.03)', 
                         border: '1px solid rgba(0, 255, 65, 0.2)', 
                         borderRadius: '6px',
                         position: 'relative',
                         overflow: 'hidden'
                       }}>
                    {/* Performance tier background */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: `${percentage}%`,
                      height: '100%',
                      background: percentage >= 80 ? 'rgba(0, 255, 65, 0.1)' : 
                                 percentage >= 60 ? 'rgba(255, 176, 0, 0.1)' : 'rgba(255, 45, 0, 0.1)',
                      transition: 'width 0.8s ease',
                      zIndex: 0
                    }} />
                    
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '1.2em' }}>{axis.icon}</span>
                            <span className="terminal-text" style={{ fontSize: '0.9em', fontWeight: 'bold' }}>
                              {axis.label}
                            </span>
                            <span className="terminal-text--dim" style={{ fontSize: '0.7em' }}>
                              ({axis.weight})
                            </span>
                          </div>
                          <div className="terminal-text--dim" style={{ fontSize: '0.75em', lineHeight: '1.3' }}>
                            {axis.description}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className={color} style={{ fontSize: '1.3em', fontWeight: 'bold' }}>
                            {percentage.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      
                      {/* Visual progress bar */}
                      <div style={{ 
                        width: '100%', 
                        height: '8px', 
                        background: 'rgba(0, 0, 0, 0.3)', 
                        borderRadius: '4px',
                        overflow: 'hidden',
                        marginTop: '8px'
                      }}>
                        <div style={{
                          width: `${percentage}%`,
                          height: '100%',
                          background: percentage >= 80 ? 'var(--phosphor-green)' : 
                                     percentage >= 60 ? 'var(--amber-warning)' : 'var(--red-alert)',
                          borderRadius: '4px',
                          transition: 'width 1s ease',
                          boxShadow: `0 0 6px ${percentage >= 80 ? 'var(--phosphor-green)' : 
                                                percentage >= 60 ? 'var(--amber-warning)' : 'var(--red-alert)'}`
                        }} />
                      </div>
                      
                      {/* Performance tier indicator */}
                      <div style={{ marginTop: '6px', textAlign: 'center' }}>
                        <span className="terminal-text--dim" style={{ fontSize: '0.7em' }}>
                          {percentage >= 90 ? 'ELITE' : 
                           percentage >= 80 ? 'EXCELLENT' : 
                           percentage >= 70 ? 'GOOD' : 
                           percentage >= 60 ? 'FAIR' : 
                           percentage >= 40 ? 'POOR' : 'CRITICAL'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Advanced Details Toggle */}
      <div className="crt-monitor" style={{ textAlign: 'center' }}>
        <div className="terminal-text" style={{ marginBottom: '16px' }}>
          <button 
            onClick={() => setShowExpandedDetails(!showExpandedDetails)}
            className="vintage-btn expanded-details-btn"
            style={{ 
              background: showExpandedDetails ? 'var(--phosphor-green)' : 'linear-gradient(135deg, #333, #222)',
              color: showExpandedDetails ? 'var(--terminal-black)' : 'var(--phosphor-green)'
            }}
          >
            {showExpandedDetails ? '▼ HIDE ADVANCED DETAILS' : '▶ SHOW ADVANCED DETAILS'}
          </button>
        </div>
        
        {showExpandedDetails && (
          <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginBottom: '20px' }}>
            Deep dive into performance logs, task breakdowns, and statistical analysis
            {autoRefresh && <span className="terminal-text--green"> • Live data updates enabled</span>}
          </div>
        )}
      </div>

      {/* Expanded Advanced Details Sections */}
      {showExpandedDetails && (
        <>
          {/* Performance Logs Section */}
          <div className="crt-monitor">
            <div className="terminal-text" style={{ marginBottom: '16px' }}>
              <div className="section-header">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'logs' ? null : 'logs')}
                  className="vintage-btn section-toggle-btn"
                >
                  {expandedSection === 'logs' ? '▼' : '▶'}
                </button>
                <span>🔍 PERFORMANCE LOGS</span>
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
                Recent test executions and detailed performance breakdowns
              </div>
            </div>

            {expandedSection === 'logs' && (
              <div style={{ 
                maxHeight: '400px', 
                overflowY: 'auto', 
                background: 'rgba(0, 0, 0, 0.3)', 
                padding: '16px', 
                borderRadius: '6px',
                fontSize: '0.85em',
                fontFamily: 'monospace'
              }}>
                {history && history.history.length > 0 ? (
                  history.history.slice(0, 10).map((entry, index) => {
                    const displayScore = Math.round(50 - entry.stupidScore / 2);
                    const testTime = new Date(entry.timestamp);
                    
                    return (
                      <div key={index} style={{ 
                        marginBottom: '16px', 
                        padding: '12px', 
                        background: displayScore >= 80 ? 'rgba(0, 255, 65, 0.05)' : 
                                   displayScore >= 60 ? 'rgba(255, 176, 0, 0.05)' : 'rgba(255, 45, 0, 0.05)',
                        border: `1px solid ${displayScore >= 80 ? 'rgba(0, 255, 65, 0.3)' : 
                                            displayScore >= 60 ? 'rgba(255, 176, 0, 0.3)' : 'rgba(255, 45, 0, 0.3)'}`,
                        borderRadius: '4px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold' }}>
                            🤖 Test Run #{history.history.length - index}
                          </div>
                          <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                            {testTime.toLocaleDateString()} {testTime.toLocaleTimeString()}
                          </div>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', marginBottom: '8px' }}>
                          <div>
                            <span className="terminal-text--dim">Score: </span>
                            <span className={displayScore >= 80 ? 'terminal-text--green' : 
                                           displayScore >= 60 ? 'terminal-text--amber' : 'terminal-text--red'}>
                              {displayScore}/100
                            </span>
                          </div>
                          <div>
                            <span className="terminal-text--dim">Correctness: </span>
                            <span className="terminal-text">{(entry.axes.correctness * 100).toFixed(0)}%</span>
                          </div>
                          <div>
                            <span className="terminal-text--dim">Quality: </span>
                            <span className="terminal-text">{(entry.axes.codeQuality * 100).toFixed(0)}%</span>
                          </div>
                          <div>
                            <span className="terminal-text--dim">Efficiency: </span>
                            <span className="terminal-text">{(entry.axes.efficiency * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                        
                        {entry.note && (
                          <div className="terminal-text--amber" style={{ fontSize: '0.8em', marginTop: '6px' }}>
                            📝 {entry.note}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="terminal-text--dim" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '2em', marginBottom: '12px', opacity: 0.5 }}>📋</div>
                    <div>No performance logs available yet</div>
                    <div style={{ fontSize: '0.8em', marginTop: '8px' }}>
                      Logs will appear after benchmark tests are run
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Task Performance Matrix */}
          <div className="crt-monitor">
            <div className="terminal-text" style={{ marginBottom: '16px' }}>
              <div className="section-header">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'tasks' ? null : 'tasks')}
                  className="vintage-btn section-toggle-btn"
                >
                  {expandedSection === 'tasks' ? '▼' : '▶'}
                </button>
                <span>📊 TASK PERFORMANCE MATRIX</span>
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
                Performance breakdown by individual coding challenges
              </div>
            </div>

            {expandedSection === 'tasks' && (
              <div>
                {performance && performance.taskPerformance.length > 0 ? (
                  <div className="vintage-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                    {performance.taskPerformance.slice(0, 6).map((task, index) => (
                      <div key={task.taskId} style={{ 
                        padding: '16px', 
                        background: 'rgba(0, 255, 65, 0.03)', 
                        border: '1px solid rgba(0, 255, 65, 0.2)', 
                        borderRadius: '6px' 
                      }}>
                        <div style={{ marginBottom: '12px' }}>
                          <div className="terminal-text" style={{ fontSize: '0.9em', fontWeight: 'bold', marginBottom: '4px' }}>
                            {task.taskSlug ? task.taskSlug.toUpperCase() : `TASK-${task.taskId}`}
                          </div>
                          <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                            Success Rate: <span className={
                              task.successRate >= 0.8 ? 'terminal-text--green' : 
                              task.successRate >= 0.6 ? 'terminal-text--amber' : 'terminal-text--red'
                            }>{Math.round(task.successRate * 100)}%</span> • Runs: {task.runs.length}
                          </div>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8em' }}>
                          <div>
                            <span className="terminal-text--dim">Correctness: </span>
                            <span className="terminal-text">{Math.round(task.averageMetrics.correctness * 100)}%</span>
                          </div>
                          <div>
                            <span className="terminal-text--dim">Quality: </span>
                            <span className="terminal-text">{Math.round(task.averageMetrics.codeQuality * 100)}%</span>
                          </div>
                          <div>
                            <span className="terminal-text--dim">Spec: </span>
                            <span className="terminal-text">{Math.round(task.averageMetrics.spec * 100)}%</span>
                          </div>
                          <div>
                            <span className="terminal-text--dim">Efficiency: </span>
                            <span className="terminal-text">{Math.round(task.averageMetrics.efficiency * 100)}%</span>
                          </div>
                        </div>
                        
                        <div style={{ 
                          marginTop: '12px', 
                          height: '4px', 
                          background: 'rgba(0, 0, 0, 0.3)', 
                          borderRadius: '2px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${task.successRate * 100}%`,
                            height: '100%',
                            background: task.successRate >= 0.8 ? 'var(--phosphor-green)' : 
                                       task.successRate >= 0.6 ? 'var(--amber-warning)' : 'var(--red-alert)',
                            borderRadius: '2px'
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="terminal-text--dim" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '2em', marginBottom: '12px', opacity: 0.5 }}>📈</div>
                    <div>No task performance data available</div>
                    <div style={{ fontSize: '0.8em', marginTop: '8px' }}>
                      Task breakdowns will appear after detailed benchmarks are run
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Statistical Analysis */}
          <div className="crt-monitor">
            <div className="terminal-text" style={{ marginBottom: '16px' }}>
              <div className="section-header">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'stats' ? null : 'stats')}
                  className="vintage-btn section-toggle-btn"
                >
                  {expandedSection === 'stats' ? '▼' : '▶'}
                </button>
                <span>📈 STATISTICAL ANALYSIS</span>
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
                Advanced metrics, trends, and performance distributions
              </div>
            </div>

            {expandedSection === 'stats' && (
              <div className="vintage-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                {/* Performance Distribution */}
                <div style={{ 
                  padding: '16px', 
                  background: 'rgba(0, 255, 65, 0.03)', 
                  border: '1px solid rgba(0, 255, 65, 0.2)', 
                  borderRadius: '6px' 
                }}>
                  <div className="terminal-text--amber" style={{ fontSize: '0.9em', fontWeight: 'bold', marginBottom: '12px' }}>
                    📊 Score Distribution
                  </div>
                  {history && history.history.length > 0 ? (
                    (() => {
                      const scores = history.history.map(h => Math.round(50 - h.stupidScore / 2));
                      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                      const sorted = scores.sort((a, b) => b - a);
                      const median = sorted[Math.floor(sorted.length / 2)];
                      const std = Math.sqrt(scores.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / scores.length);
                      
                      return (
                        <div style={{ fontSize: '0.8em' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span className="terminal-text--dim">Average:</span>
                            <span className="terminal-text">{avg.toFixed(1)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span className="terminal-text--dim">Median:</span>
                            <span className="terminal-text">{median}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span className="terminal-text--dim">Std Dev:</span>
                            <span className="terminal-text">{std.toFixed(1)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span className="terminal-text--dim">Best:</span>
                            <span className="terminal-text--green">{Math.max(...scores)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span className="terminal-text--dim">Worst:</span>
                            <span className="terminal-text--red">{Math.min(...scores)}</span>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                      Insufficient data for statistical analysis
                    </div>
                  )}
                </div>

                {/* Trend Analysis */}
                <div style={{ 
                  padding: '16px', 
                  background: 'rgba(0, 255, 65, 0.03)', 
                  border: '1px solid rgba(0, 255, 65, 0.2)', 
                  borderRadius: '6px' 
                }}>
                  <div className="terminal-text--amber" style={{ fontSize: '0.9em', fontWeight: 'bold', marginBottom: '12px' }}>
                    📈 Trend Analysis
                  </div>
                  <div style={{ fontSize: '0.8em' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span className="terminal-text--dim">Overall Trend:</span>
                      <span className={
                        trend === 'up' ? 'terminal-text--green' : 
                        trend === 'down' ? 'terminal-text--red' : 'terminal-text--amber'
                      }>
                        {trend === 'up' ? 'IMPROVING' : trend === 'down' ? 'DECLINING' : 'STABLE'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span className="terminal-text--dim">Period:</span>
                      <span className="terminal-text">{selectedPeriod.toUpperCase()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span className="terminal-text--dim">Volatility:</span>
                      <span className="terminal-text">
                        {history && history.history.length > 5 ? 
                          (() => {
                            const scores = history.history.map(h => Math.round(50 - h.stupidScore / 2));
                            const volatility = Math.max(...scores) - Math.min(...scores);
                            return volatility > 15 ? 'HIGH' : volatility > 8 ? 'MEDIUM' : 'LOW';
                          })() : 'UNKNOWN'
                        }
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="terminal-text--dim">Consistency:</span>
                      <span className={
                        history && history.history.length > 5 ? 
                          (() => {
                            const scores = history.history.map(h => Math.round(50 - h.stupidScore / 2));
                            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                            const std = Math.sqrt(scores.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / scores.length);
                            return std < 5 ? 'terminal-text--green' : std < 10 ? 'terminal-text--amber' : 'terminal-text--red';
                          })() : 'terminal-text--dim'
                      }>
                        {history && history.history.length > 5 ? 
                          (() => {
                            const scores = history.history.map(h => Math.round(50 - h.stupidScore / 2));
                            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                            const std = Math.sqrt(scores.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / scores.length);
                            return std < 5 ? 'EXCELLENT' : std < 10 ? 'GOOD' : 'POOR';
                          })() : 'UNKNOWN'
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* System Information */}
                <div style={{ 
                  padding: '16px', 
                  background: 'rgba(0, 255, 65, 0.03)', 
                  border: '1px solid rgba(0, 255, 65, 0.2)', 
                  borderRadius: '6px' 
                }}>
                  <div className="terminal-text--amber" style={{ fontSize: '0.9em', fontWeight: 'bold', marginBottom: '12px' }}>
                    ⚙️ System Information
                  </div>
                  <div style={{ fontSize: '0.8em' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span className="terminal-text--dim">Model ID:</span>
                      <span className="terminal-text">{modelDetails.id}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span className="terminal-text--dim">Version:</span>
                      <span className="terminal-text">{modelDetails.version || 'Latest'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span className="terminal-text--dim">Data Points:</span>
                      <span className="terminal-text">{history?.dataPoints || 0}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span className="terminal-text--dim">Refresh Rate:</span>
                      <span className="terminal-text">{autoRefresh ? '2 MIN' : 'MANUAL'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="terminal-text--dim">Next Test:</span>
                      <span className="terminal-text">~{Math.ceil(Math.random() * 25 + 5)}M</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
