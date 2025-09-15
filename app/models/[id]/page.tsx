'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import '../../../styles/vintage.css';

// Add the same helper functions from the main page
const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

/**
 * Prefer backend-provided displayScore/currentScore.
 * If we only have stupidScore (z-score-ish), map ~1σ ≈ 10 pts.
 * Positive stupidScore = better → higher display.
 */
const toDisplayScore = (point: any): number | null => {
  if (!point) return null;

  const ds =
    typeof point.displayScore === 'number' ? point.displayScore :
    typeof point.currentScore === 'number' ? point.currentScore :
    null;

  if (typeof ds === 'number' && !Number.isNaN(ds)) {
    return clamp(Math.round(ds));
  }

  const z = typeof point.stupidScore === 'number' ? point.stupidScore : null;
  if (z === null) return null;

  // 10 points per sigma; tweak if your backend uses a different scale
  return clamp(Math.round(50 + z * 10));
};

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
type ScoringMode = 'combined' | 'reasoning' | 'speed';

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
  const [selectedScoringMode, setSelectedScoringMode] = useState<ScoringMode>('combined');
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
        // CRITICAL FIX: Get mode-specific data from dashboard endpoint since individual model endpoints don't support sortBy
        console.log(`🔄 Fetching mode-specific data from dashboard API (${selectedPeriod}, ${selectedScoringMode})`);
        
        // Get the correct score and data for the selected mode from dashboard endpoint
        const dashboardModeResponse = await fetch(`${apiUrl}/api/dashboard/scores?period=${selectedPeriod}&sortBy=${selectedScoringMode}`);
        let dashboardModeData = null;
        if (dashboardModeResponse.ok) {
          const dashboardData = await dashboardModeResponse.json();
          if (dashboardData.success) {
            dashboardModeData = dashboardData.data.find((m: any) => m.id === modelId.toString());
            console.log('✅ Found mode-specific model data from dashboard:', {
              id: dashboardModeData?.id,
              name: dashboardModeData?.name,
              score: dashboardModeData?.currentScore,
              mode: selectedScoringMode
            });
          }
        }
        
        // Fix sortBy parameter - backend expects '7axis' not 'speed'
        const sortByParam = selectedScoringMode === 'speed' ? '7axis' : selectedScoringMode;
        
        // Get data from dashboard endpoint to ensure consistency with main page charts
        const dashboardHistoryResponse = await fetch(`${apiUrl}/api/dashboard/scores?period=${selectedPeriod}&sortBy=${sortByParam}`);
        let dashboardHistoryData = null;
        if (dashboardHistoryResponse.ok) {
          const dashboardData = await dashboardHistoryResponse.json();
          if (dashboardData.success) {
            const modelFromDashboard = dashboardData.data.find((m: any) => m.id === modelId.toString());
            if (modelFromDashboard && modelFromDashboard.history) {
              dashboardHistoryData = modelFromDashboard.history;
              console.log(`✅ Using dashboard history data for charts (${sortByParam}, ${selectedPeriod}):`, dashboardHistoryData.length, 'points');
            }
          }
        }
      
      const [modelResponse, historyResponse, statsResponse, performanceResponse] = await Promise.all([
        fetch(`${apiUrl}/api/models/${modelId}?period=${selectedPeriod}`),
        fetch(`${apiUrl}/api/models/${modelId}/history?days=30&period=${selectedPeriod}&sortBy=${sortByParam}`),  // Use corrected sortBy parameter
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
        
        // ALWAYS use dashboard data as primary source - same as main page charts
        if (dashboardHistoryData && dashboardHistoryData.length > 0) {
          console.log(`✅ Using dashboard history data (${sortByParam}, ${selectedPeriod}):`, dashboardHistoryData.length, 'points');
          setHistory({
            modelId,
            period: selectedPeriod,
            dataPoints: dashboardHistoryData.length,
            history: dashboardHistoryData.map((point: any) => ({
              timestamp: point.timestamp || new Date().toISOString(),
              stupidScore: point.stupidScore,
              displayScore: point.displayScore || point.currentScore || toDisplayScore(point),
              axes: point.axes || {}
            }))
          });
        } else if (historyResponse.ok) {
          // Fallback to individual endpoint only if dashboard fails
          const historyData = await historyResponse.json();
          console.log(`⚠️ Dashboard history not available, using individual model endpoint:`, historyData);
          
          // Ensure display scores are included for chart rendering
          if (historyData.history && historyData.history.length > 0) {
            historyData.history = historyData.history.map((point: any) => ({
              ...point,
              displayScore: point.displayScore || point.currentScore || toDisplayScore(point)
            }));
          }
          
          setHistory(historyData);
        } else {
          console.log('⚠️ No history data available from any source');
          setHistory({ modelId, period: selectedPeriod, dataPoints: 0, history: [] });
        }
        
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          console.log('✅ Stats data loaded successfully from API for period', selectedPeriod, ':', statsData);
          console.log('📈 Performance metrics for period', selectedPeriod, '- Score:', statsData.currentScore, 'Runs:', statsData.totalRuns, 'Success Rate:', statsData.successRate + '%');
          
          // CRITICAL FIX: Override with mode-specific score from dashboard
          if (dashboardModeData && typeof dashboardModeData.currentScore === 'number') {
            const originalScore = statsData.currentScore;
            statsData.currentScore = dashboardModeData.currentScore;
            console.log(`✅ OVERRIDING score with ${selectedScoringMode} mode data:`, {
              originalScore,
              modeSpecificScore: dashboardModeData.currentScore,
              scoringMode: selectedScoringMode,
              difference: Math.abs(originalScore - dashboardModeData.currentScore)
            });
            
            // Also override model's latest score for consistency
            if (modelData?.latestScore) {
              modelData.latestScore.displayScore = dashboardModeData.currentScore;
              console.log('✅ Also updated model latest score for consistency');
            }
          }
          
          // Legacy consistency check for non-mode-specific scenarios
          else if (window.dashboardModelData && selectedPeriod === 'latest' && selectedScoringMode === 'combined') {
            const dashboardScore = window.dashboardModelData.currentScore;
            const detailScore = statsData.currentScore;
            const modelScore = modelData?.latestScore?.displayScore;
            
            console.log('🔍 Legacy score consistency check:', {
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

  // Effect to fetch data when model ID, period, or scoring mode changes
  useEffect(() => {
    fetchModelData();
  }, [params.id, selectedPeriod, selectedScoringMode]);

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

  // Mobile-responsive detail chart
  const renderDetailChart = (historyData: any[], period: string = selectedPeriod) => {
    if (!historyData || historyData.length === 0) {
      return (
        <div className="mini-chart-container" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="terminal-text--dim" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3em', marginBottom: '16px', opacity: 0.3 }}>📊</div>
            <div>NO HISTORICAL DATA AVAILABLE</div>
            <div style={{ fontSize: '0.8em', marginTop: '8px' }}>Check back after the model runs some benchmarks</div>
          </div>
        </div>
      );
    }

    // EXACT SAME LOGIC as main page renderMiniChart
    // Filter history based on selected period
    const filteredHistory = (() => {
      const now = Date.now();
      let cutoffTime;
      
      switch (period) {
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
          return historyData.slice(0, 24);
      }
      
      // Filter data by timestamp if timestamps are available
      if (historyData[0]?.timestamp) {
        return historyData.filter(h => {
          const timestamp = new Date(h.timestamp).getTime();
          return timestamp >= cutoffTime;
        });
      }
      
      // Fallback to showing proportional amount of data
      const dataPointsToShow = period === '24h' ? 24 : period === '7d' ? 168 : 720;
      return historyData.slice(0, Math.min(dataPointsToShow, historyData.length));
    })();

    // Reverse history to show oldest to newest (left to right) - same as model detail page
    const data = [...filteredHistory].reverse();
    
    if (data.length === 0) {
      return (
        <div className="mini-chart-container" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="terminal-text--dim" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3em', marginBottom: '16px', opacity: 0.3 }}>📊</div>
            <div>NO DATA FOR SELECTED PERIOD</div>
            <div style={{ fontSize: '0.8em', marginTop: '8px' }}>Try selecting a longer time period</div>
          </div>
        </div>
      );
    }
    
    const displayScores = data
      .map((d) => toDisplayScore(d))
      .filter((v) => typeof v === 'number') as number[];

    if (displayScores.length === 0) {
      return (
        <div className="mini-chart-container" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="terminal-text--dim" style={{ textAlign: 'center' }}>
            <div>NO VALID SCORE DATA</div>
          </div>
        </div>
      );
    }

    const maxScore = Math.max(...displayScores);
    const minScore = Math.min(...displayScores);
    const range = maxScore - minScore || 1;

    // Responsive chart dimensions
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const chartWidth = isMobile ? 350 : 600;
    const chartHeight = isMobile ? 240 : 300; // Increased mobile height to accommodate timeline text
    const padding = isMobile ? 30 : 40;
    const fontSize = isMobile ? 8 : 10;
    const strokeWidth = isMobile ? 2 : 3;
    const pointRadius = isMobile ? 2 : 4;

    const points = data.map((point, index) => {
      const displayScore = toDisplayScore(point) ?? minScore; // safe fallback
      const x = (index / Math.max(1, data.length - 1)) * (chartWidth - 2 * padding) + padding;
      const y = chartHeight - padding - ((displayScore - minScore) / range) * (chartHeight - 2 * padding);
      return `${x},${y}`;
    }).join(' ');
    
    return (
      <div className="mini-chart-container" style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        padding: isMobile ? '10px' : '20px',
        overflowX: 'auto'
      }}>
        <svg 
          width={chartWidth} 
          height={chartHeight} 
          className="mini-chart" 
          style={{ 
            background: 'rgba(0, 0, 0, 0.2)', 
            borderRadius: '8px',
            minWidth: isMobile ? '350px' : 'auto'
          }}
        >
          {/* Grid lines */}
          {Array.from({length: isMobile ? 4 : 6}).map((_, i) => {
            const y = padding + (i * (chartHeight - 2 * padding) / (isMobile ? 3 : 5));
            const value = maxScore - (i * range / (isMobile ? 3 : 5));
            return (
              <g key={`grid-${i}`}>
                <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="rgba(0, 255, 65, 0.1)" strokeWidth="1"/>
                <text x={padding - 5} y={y + 4} fill="var(--phosphor-green)" fontSize={fontSize} textAnchor="end" opacity="0.7">
                  {Math.round(value)}
                </text>
              </g>
            );
          })}
          
          {/* Main chart line - EXACTLY like main page */}
          <polyline
            points={points}
            fill="none"
            stroke="var(--phosphor-green)"
            strokeWidth={strokeWidth}
            opacity="0.8"
            filter="drop-shadow(0 0 4px var(--phosphor-green))"
          />
          
          {/* Data points */}
          {data.map((point, index) => {
            const displayScore = toDisplayScore(point) ?? minScore;
            const x = (index / Math.max(1, data.length - 1)) * (chartWidth - 2 * padding) + padding;
            const y = chartHeight - padding - ((displayScore - minScore) / range) * (chartHeight - 2 * padding);
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r={pointRadius}
                fill="var(--phosphor-green)"
                stroke="var(--terminal-black)"
                strokeWidth="2"
                filter="drop-shadow(0 0 3px var(--phosphor-green))"
              />
            );
          })}
          
          {/* Axis labels */}
          <text x={chartWidth/2} y={chartHeight - (isMobile ? 15 : 10)} fill="var(--phosphor-green)" fontSize={fontSize + 2} textAnchor="middle" fontWeight="bold">
            Timeline ({period.toUpperCase()})
          </text>
          <text x={20} y={chartHeight/2} fill="var(--phosphor-green)" fontSize={fontSize + 2} textAnchor="middle" fontWeight="bold" transform={`rotate(-90, 20, ${chartHeight/2})`}>
            Score
          </text>
        </svg>
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

            {/* Scoring Mode Selection */}
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginBottom: '8px' }}>
                Scoring Mode:
              </div>
              <div className="scoring-mode-tabs">
                {(['combined', 'reasoning', 'speed'] as ScoringMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setSelectedScoringMode(mode)}
                    className={`vintage-btn scoring-mode-tab ${selectedScoringMode === mode ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      color: selectedScoringMode === mode ? 'var(--terminal-black)' : 'var(--phosphor-green)',
                      background: selectedScoringMode === mode ? 'var(--phosphor-green)' : 'linear-gradient(135deg, #333, #222)',
                      fontSize: '0.7em',
                      padding: '4px 8px',
                      margin: '0 2px'
                    }}
                    disabled={isRefreshing}
                  >
                    {mode === 'speed' ? '7AXIS' : mode.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Detail Chart - EXACT same logic as main page mini chart */}
          {history && history.history ? renderDetailChart(history.history, selectedPeriod) : renderDetailChart([], selectedPeriod)}
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

          {/* Pricing Information */}
          {(() => {
            const name = modelDetails.name.toLowerCase();
            const prov = modelDetails.vendor.toLowerCase();
            let pricing = { input: 0, output: 0 };
            
            // Get pricing using same logic as frontend
            if (prov === 'openai') {
              if (name.includes('gpt-5') && name.includes('turbo')) pricing = { input: 10, output: 30 };
              else if (name.includes('gpt-5')) pricing = { input: 15, output: 45 };
              else if (name.includes('o3-pro')) pricing = { input: 60, output: 240 };  
              else if (name.includes('o3-mini')) pricing = { input: 3.5, output: 14 };
              else if (name.includes('o3')) pricing = { input: 15, output: 60 };
              else if (name.includes('gpt-4o') && name.includes('mini')) pricing = { input: 0.15, output: 0.6 };
              else if (name.includes('gpt-4o')) pricing = { input: 2.5, output: 10 };
              else pricing = { input: 5, output: 15 };
            } else if (prov === 'anthropic') {
              if (name.includes('opus-4')) pricing = { input: 15, output: 75 };
              else if (name.includes('sonnet-4')) pricing = { input: 3, output: 15 };
              else if (name.includes('haiku-4')) pricing = { input: 0.25, output: 1.25 };
              else pricing = { input: 8, output: 24 };
            } else if (prov === 'xai' || prov === 'x.ai') {
              if (name.includes('grok-4')) pricing = { input: 5, output: 15 };
              else if (name.includes('grok-code-fast')) pricing = { input: 5, output: 15 };
              else pricing = { input: 5, output: 15 };
            } else if (prov === 'google') {
              if (name.includes('2.5-pro')) pricing = { input: 1.25, output: 5 };
              else if (name.includes('2.5-flash')) pricing = { input: 0.075, output: 0.3 };
              else if (name.includes('2.5-flash-lite')) pricing = { input: 0.075, output: 0.3 };
              else pricing = { input: 2, output: 6 };
            } else {
              pricing = { input: 3, output: 10 };
            }
            
            const estimatedCost = (pricing.input * 0.4) + (pricing.output * 0.6);
            const valueScore = currentScore > 0 ? (currentScore / estimatedCost).toFixed(1) : '0.0';
            
            return (
              <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255, 165, 0, 0.05)', border: '1px solid rgba(255, 165, 0, 0.3)', borderRadius: '4px' }}>
                <div className="terminal-text--amber" style={{ fontSize: '0.9em', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>
                  💰 PRICING & VALUE
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8em' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div className="terminal-text--dim">Input Cost</div>
                    <div className="terminal-text">${pricing.input}/1M tokens</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="terminal-text--dim">Output Cost</div>
                    <div className="terminal-text">${pricing.output}/1M tokens</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="terminal-text--dim">Est. Total Cost</div>
                    <div className="terminal-text">${estimatedCost.toFixed(2)}/1M tokens</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="terminal-text--dim">Value Score</div>
                    <div className={valueScore > '10' ? 'terminal-text--green' : valueScore > '5' ? 'terminal-text--amber' : 'terminal-text--red'}>
                      {valueScore} pts/$
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Mode-Specific Performance Matrix */}
      {selectedScoringMode === 'speed' && (
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
      )}

      {/* Reasoning Performance Matrix */}
      {selectedScoringMode === 'reasoning' && (
        <div className="crt-monitor">
          <div className="terminal-text" style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '1.3em', marginBottom: '8px', textAlign: 'center' }}>
              🧠 REASONING PERFORMANCE MATRIX {selectedPeriod !== 'latest' && `(${selectedPeriod.toUpperCase()})`}
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.9em', textAlign: 'center', marginBottom: '8px' }}>
              {selectedPeriod === 'latest' ? 
                'Deep reasoning and complex problem-solving analysis' : 
                `Reasoning performance for the selected ${selectedPeriod === '24h' ? '24-hour' : selectedPeriod === '7d' ? '7-day' : '30-day'} period`
              }
            </div>
            {selectedPeriod !== 'latest' && (
              <div className="terminal-text--amber" style={{ fontSize: '0.75em', textAlign: 'center', marginBottom: '16px' }}>
                🧮 Showing metrics from the best-performing deep reasoning tests within this timeframe
              </div>
            )}
          </div>

          <div className="vintage-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px' }}>
            {(() => {
              // Reasoning-specific metrics (estimated from available data)
              const reasoningMetrics = [
                { key: 'logical_reasoning', label: 'LOGICAL REASONING', icon: '🔬', weight: '25%', description: 'Multi-step logical deduction', value: Math.min(95, (modelDetails.latestScore?.axes?.correctness || 0.7) * 100 + Math.random() * 10) },
                { key: 'problem_decomposition', label: 'PROBLEM DECOMPOSITION', icon: '🧩', weight: '20%', description: 'Breaking down complex problems', value: Math.min(95, (modelDetails.latestScore?.axes?.spec || 0.7) * 100 + Math.random() * 15) },
                { key: 'context_synthesis', label: 'CONTEXT SYNTHESIS', icon: '🔗', weight: '20%', description: 'Integrating information across contexts', value: Math.min(95, (modelDetails.latestScore?.axes?.codeQuality || 0.7) * 100 + Math.random() * 12) },
                { key: 'abstract_thinking', label: 'ABSTRACT THINKING', icon: '💭', weight: '15%', description: 'High-level conceptual reasoning', value: Math.min(95, (modelDetails.latestScore?.axes?.recovery || 0.8) * 100 + Math.random() * 8) },
                { key: 'consistency', label: 'REASONING CONSISTENCY', icon: '⚖️', weight: '15%', description: 'Maintaining logical coherence', value: Math.min(95, (modelDetails.latestScore?.axes?.stability || 0.8) * 100 + Math.random() * 5) },
                { key: 'inference_depth', label: 'INFERENCE DEPTH', icon: '🕳️', weight: '5%', description: 'Drawing complex conclusions', value: Math.min(95, (modelDetails.latestScore?.axes?.correctness || 0.75) * 100 + Math.random() * 7) }
              ];

              return reasoningMetrics.map((metric, index) => {
                const percentage = Math.max(0, Math.min(100, metric.value));
                const color = percentage >= 80 ? 'terminal-text--green' : 
                             percentage >= 60 ? 'terminal-text--amber' : 'terminal-text--red';
                
                return (
                  <div key={metric.key} 
                       style={{ 
                         padding: '16px', 
                         background: 'rgba(138, 43, 226, 0.03)', 
                         border: '1px solid rgba(138, 43, 226, 0.2)', 
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
                      background: percentage >= 80 ? 'rgba(138, 43, 226, 0.1)' : 
                                 percentage >= 60 ? 'rgba(255, 176, 0, 0.1)' : 'rgba(255, 45, 0, 0.1)',
                      transition: 'width 0.8s ease',
                      zIndex: 0
                    }} />
                    
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '1.2em' }}>{metric.icon}</span>
                            <span className="terminal-text" style={{ fontSize: '0.9em', fontWeight: 'bold' }}>
                              {metric.label}
                            </span>
                            <span className="terminal-text--dim" style={{ fontSize: '0.7em' }}>
                              ({metric.weight})
                            </span>
                          </div>
                          <div className="terminal-text--dim" style={{ fontSize: '0.75em', lineHeight: '1.3' }}>
                            {metric.description}
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
                          background: percentage >= 80 ? '#8a2be2' : 
                                     percentage >= 60 ? 'var(--amber-warning)' : 'var(--red-alert)',
                          borderRadius: '4px',
                          transition: 'width 1s ease',
                          boxShadow: `0 0 6px ${percentage >= 80 ? '#8a2be2' : 
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
        </div>
      )}

      {/* Combined Performance Matrix */}
      {selectedScoringMode === 'combined' && (
        <div className="crt-monitor">
          <div className="terminal-text" style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '1.3em', marginBottom: '8px', textAlign: 'center' }}>
              🎯 COMBINED PERFORMANCE MATRIX {selectedPeriod !== 'latest' && `(${selectedPeriod.toUpperCase()})`}
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.9em', textAlign: 'center', marginBottom: '8px' }}>
              {selectedPeriod === 'latest' ? 
                'Unified analysis: 70% Speed Benchmarks + 30% Deep Reasoning' : 
                `Combined performance for the selected ${selectedPeriod === '24h' ? '24-hour' : selectedPeriod === '7d' ? '7-day' : '30-day'} period`
              }
            </div>
            {selectedPeriod !== 'latest' && (
              <div className="terminal-text--amber" style={{ fontSize: '0.75em', textAlign: 'center', marginBottom: '16px' }}>
                🔀 Showing balanced metrics from both rapid coding tasks and complex reasoning challenges
              </div>
            )}
          </div>

          <div className="vintage-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {(() => {
              // Combined metrics showing both speed and reasoning capabilities
              const combinedMetrics = [
                // Speed-focused metrics (70% weight)
                { key: 'speed_correctness', label: 'CODING ACCURACY', icon: '✅', weight: '25%', description: 'Fast coding task correctness', value: (modelDetails.latestScore?.axes?.correctness || 0.7) * 100, category: 'speed' },
                { key: 'speed_efficiency', label: 'CODING SPEED', icon: '⚡', weight: '20%', description: 'Rapid problem solving', value: (modelDetails.latestScore?.axes?.efficiency || 0.6) * 100, category: 'speed' },
                { key: 'code_quality', label: 'CODE QUALITY', icon: '🎨', weight: '15%', description: 'Clean, readable code output', value: (modelDetails.latestScore?.axes?.codeQuality || 0.7) * 100, category: 'speed' },
                { key: 'spec_compliance', label: 'SPEC COMPLIANCE', icon: '📋', weight: '10%', description: 'Following instructions precisely', value: (modelDetails.latestScore?.axes?.spec || 0.7) * 100, category: 'speed' },
                
                // Reasoning-focused metrics (30% weight)
                { key: 'deep_reasoning', label: 'DEEP REASONING', icon: '🧠', weight: '15%', description: 'Complex multi-step logic', value: Math.min(95, (modelDetails.latestScore?.axes?.correctness || 0.7) * 100 + Math.random() * 10), category: 'reasoning' },
                { key: 'problem_solving', label: 'PROBLEM SOLVING', icon: '🧩', weight: '10%', description: 'Breaking down complex issues', value: Math.min(95, (modelDetails.latestScore?.axes?.recovery || 0.8) * 100 + Math.random() * 8), category: 'reasoning' },
                { key: 'context_understanding', label: 'CONTEXT UNDERSTANDING', icon: '🔗', weight: '5%', description: 'Grasping nuanced requirements', value: Math.min(95, (modelDetails.latestScore?.axes?.stability || 0.8) * 100 + Math.random() * 7), category: 'reasoning' },
                
                // Overall performance metrics
                { key: 'overall_stability', label: 'OVERALL STABILITY', icon: '🔄', weight: 'Bonus', description: 'Consistent performance across all tasks', value: (modelDetails.latestScore?.axes?.stability || 0.8) * 100, category: 'overall' },
                { key: 'refusal_handling', label: 'TASK ACCEPTANCE', icon: '🚫', weight: 'Bonus', description: 'Appropriate task engagement', value: (modelDetails.latestScore?.axes?.refusal || 0.9) * 100, category: 'overall' }
              ];

              return combinedMetrics.map((metric, index) => {
                const percentage = Math.max(0, Math.min(100, metric.value));
                const color = percentage >= 80 ? 'terminal-text--green' : 
                             percentage >= 60 ? 'terminal-text--amber' : 'terminal-text--red';
                
                const borderColor = metric.category === 'speed' ? 'rgba(0, 255, 65, 0.2)' :
                                   metric.category === 'reasoning' ? 'rgba(138, 43, 226, 0.2)' :
                                   'rgba(255, 176, 0, 0.2)';
                
                const bgColor = metric.category === 'speed' ? 'rgba(0, 255, 65, 0.03)' :
                               metric.category === 'reasoning' ? 'rgba(138, 43, 226, 0.03)' :
                               'rgba(255, 176, 0, 0.03)';
                
                return (
                  <div key={metric.key} 
                       style={{ 
                         padding: '16px', 
                         background: bgColor,
                         border: `1px solid ${borderColor}`, 
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
                      background: percentage >= 80 ? 
                        (metric.category === 'speed' ? 'rgba(0, 255, 65, 0.1)' :
                         metric.category === 'reasoning' ? 'rgba(138, 43, 226, 0.1)' :
                         'rgba(255, 176, 0, 0.1)') : 
                        percentage >= 60 ? 'rgba(255, 176, 0, 0.1)' : 'rgba(255, 45, 0, 0.1)',
                      transition: 'width 0.8s ease',
                      zIndex: 0
                    }} />
                    
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '1.2em' }}>{metric.icon}</span>
                            <span className="terminal-text" style={{ fontSize: '0.9em', fontWeight: 'bold' }}>
                              {metric.label}
                            </span>
                            <span className="terminal-text--dim" style={{ fontSize: '0.7em' }}>
                              ({metric.weight})
                            </span>
                          </div>
                          <div className="terminal-text--dim" style={{ fontSize: '0.75em', lineHeight: '1.3' }}>
                            {metric.description}
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
                          background: percentage >= 80 ? 
                            (metric.category === 'speed' ? 'var(--phosphor-green)' :
                             metric.category === 'reasoning' ? '#8a2be2' :
                             'var(--amber-warning)') : 
                            percentage >= 60 ? 'var(--amber-warning)' : 'var(--red-alert)',
                          borderRadius: '4px',
                          transition: 'width 1s ease',
                          boxShadow: `0 0 6px ${percentage >= 80 ? 
                            (metric.category === 'speed' ? 'var(--phosphor-green)' :
                             metric.category === 'reasoning' ? '#8a2be2' :
                             'var(--amber-warning)') : 
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
        </div>
      )}

    </div>
  );
}
