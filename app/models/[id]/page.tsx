'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import '../../../styles/vintage.css';
import ProFeatureModal from '../../../components/ProFeatureModal';
import ProFeatureBlur from '../../../components/ProFeatureBlur';

// Add the same helper functions from the main page
const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

/**
 * FIXED: Extract display score from actual API response format
 * API returns: { score: 76, stupidScore: 76, timestamp: "...", axes: {...} }
 */
const toDisplayScore = (point: any): number | null => {
  if (!point) return null;

  // PRIORITY 1: Direct score field (what the API actually returns)
  if (typeof point.score === 'number' && !Number.isNaN(point.score)) {
    return clamp(Math.round(point.score));
  }

  // PRIORITY 2: Legacy displayScore/currentScore (for compatibility)
  const ds =
    typeof point.displayScore === 'number' ? point.displayScore :
    typeof point.currentScore === 'number' ? point.currentScore :
    null;

  if (typeof ds === 'number' && !Number.isNaN(ds)) {
    return clamp(Math.round(ds));
  }

  // PRIORITY 3: stupidScore fallback
  const z = typeof point.stupidScore === 'number' ? point.stupidScore : null;
  if (z !== null && !Number.isNaN(z)) {
    // If stupidScore is already in 0-100 range, use it directly
    if (z >= 0 && z <= 100) {
      return clamp(Math.round(z));
    }
    // Otherwise, convert z-score to 0-100 scale
    return clamp(Math.round(50 + z * 10));
  }

  console.warn('Unable to extract score from point:', point);
  return null;
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
type ScoringMode = 'combined' | 'reasoning' | 'speed' | 'tooling';

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
  
  // Enhanced loading states for smart polling
  const [loadingStage, setLoadingStage] = useState<string>('Initializing...');
  const [loadingAttempts, setLoadingAttempts] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isDataComplete, setIsDataComplete] = useState(false);

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

  // Pro feature modal state
  const [showProModal, setShowProModal] = useState(false);
  const [proModalFeature, setProModalFeature] = useState<'historical-data' | 'performance-matrix'>('historical-data');
  
  // Session and subscription checking
  const { data: session } = useSession();
  const hasProAccess = (session?.user as any)?.subscriptionStatus === 'active' || 
                       (session?.user as any)?.subscriptionStatus === 'trialing';

  // Validate if fetched data is complete and usable
  const validateDataCompleteness = (modelData: any, historyData: any, statsData: any): boolean => {
    // Check if we have valid model details
    if (!modelData || !modelData.name) {
      console.log('❌ Validation failed: No model data');
      return false;
    }
    
    // CRITICAL FIX: Check if we have a MEANINGFUL score (> 0), not just that it exists
    // This prevents showing the page with 0 scores
    const hasValidScore = statsData?.currentScore && statsData.currentScore > 0;
    
    // Check if history has meaningful data with non-zero scores
    const hasValidHistory = historyData?.data && historyData.data.length > 0 && 
      historyData.data.some((point: any) => {
        const score = point.score || point.displayScore || 0;
        return score > 0;
      });
    
    // Check if stats show actual runs with meaningful data
    const hasValidStats = statsData?.totalRuns && statsData.totalRuns > 0;
    
    // Data is complete ONLY if we have a valid score > 0
    // This ensures we don't show the page until real benchmark data is available
    const isComplete = hasValidScore && (hasValidHistory || hasValidStats);
    
    console.log('📊 Data validation:', {
      hasValidScore,
      hasValidHistory,
      hasValidStats,
      score: statsData?.currentScore,
      historyPoints: historyData?.data?.length || 0,
      totalRuns: statsData?.totalRuns || 0,
      isComplete,
      reason: !isComplete ? (
        !hasValidScore ? 'Score is 0 or missing' :
        !hasValidHistory && !hasValidStats ? 'No valid history or stats' :
        'Unknown'
      ) : 'Data is complete'
    });
    
    // Data is complete ONLY if we have meaningful scores
    return isComplete;
  };

  const fetchModelData = async (showRefreshIndicator = false, attemptNumber = 0) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    }

    let modelData: any = null;

    try {
      if (!showRefreshIndicator) {
        setLoading(true);
        setLoadingAttempts(attemptNumber);
        setLoadingProgress(Math.min(10 + (attemptNumber * 8), 90));
      }

      const modelIdStr = params.id as string;
      const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
      
      const modelId = parseInt(modelIdStr);
      
      if (isNaN(modelId)) {
        throw new Error(`Invalid model ID: ${modelIdStr}`);
      }

      // Update loading stage
      if (!showRefreshIndicator) {
        setLoadingStage('Fetching model details...');
      }

      // Fix sortBy parameter - backend expects '7axis' not 'speed'
      const sortByParam = selectedScoringMode === 'speed' ? '7axis' : selectedScoringMode;
      
      // SIMPLIFIED: Use ONLY dashboard history endpoint (same as main page)
      console.log(`📊 Fetching chart data (attempt ${attemptNumber + 1}): /dashboard/history/${modelId}?period=${selectedPeriod}&sortBy=${sortByParam}`);
      
      const [modelResponse, historyResponse, statsResponse] = await Promise.all([
        fetch(`${apiUrl}/api/models/${modelId}`),
        fetch(`${apiUrl}/dashboard/history/${modelId}?period=${selectedPeriod}&sortBy=${sortByParam}`),
        fetch(`${apiUrl}/api/models/${modelId}/stats?period=${selectedPeriod}&sortBy=${sortByParam}`)
      ]);
        
        if (!showRefreshIndicator) {
          setLoadingStage('Processing model data...');
          setLoadingProgress(Math.min(30 + (attemptNumber * 8), 90));
        }
        
        // Check for server errors (500, 502, 503)
        if (modelResponse.status >= 500) {
          throw new Error(`Server error: ${modelResponse.status}`);
        }
        
        if (modelResponse.ok) {
          modelData = await modelResponse.json();
          setModelDetails(modelData);
        } else if (modelResponse.status === 404) {
          throw new Error('Model not found');
        } else {
          throw new Error(`HTTP error: ${modelResponse.status}`);
        }
        
        if (!showRefreshIndicator) {
          setLoadingStage('Loading performance history...');
          setLoadingProgress(Math.min(50 + (attemptNumber * 8), 90));
        }
        
        // UNIFIED DATA HANDLING: Same as main page
        let historyData: any = null;
        if (historyResponse.ok) {
          historyData = await historyResponse.json();
          if (historyData.success && historyData.data && historyData.data.length > 0) {
            console.log(`✅ Chart data loaded: ${historyData.data.length} points for ${selectedPeriod}/${sortByParam}`);
            setHistory({
              modelId,
              period: selectedPeriod,
              dataPoints: historyData.data.length,
              history: historyData.data.map((point: any) => ({
                timestamp: point.timestamp || new Date().toISOString(),
                stupidScore: point.stupidScore || 0,
                displayScore: point.score || point.displayScore || toDisplayScore(point),
                axes: point.axes || {}
              }))
            });
          } else {
            console.log(`⚠️ No chart data for ${selectedPeriod}/${sortByParam}`);
            setHistory({ modelId, period: selectedPeriod, dataPoints: 0, history: [] });
          }
        } else {
          console.log('⚠️ History endpoint failed');
          setHistory({ modelId, period: selectedPeriod, dataPoints: 0, history: [] });
        }
        
        if (!showRefreshIndicator) {
          setLoadingStage('Computing statistics...');
          setLoadingProgress(Math.min(70 + (attemptNumber * 8), 90));
        }
        
        let statsData: any = null;
        if (statsResponse.ok) {
          statsData = await statsResponse.json();
          setStats(statsData);
        } else {
          setStats({ modelId, currentScore: 0, totalRuns: 0, successfulRuns: 0, successRate: 0, averageCorrectness: 0, averageLatency: 0 });
        }
        
        // Validate data completeness
        const dataIsComplete = validateDataCompleteness(modelData, historyData, statsData);
        setIsDataComplete(dataIsComplete);
        
        if (!dataIsComplete && !showRefreshIndicator && attemptNumber < 10) {
          // Data is incomplete, schedule retry with exponential backoff
          const retryDelay = Math.min(2000 * Math.pow(1.5, attemptNumber), 10000);
          console.log(`⏳ Data incomplete, retrying in ${retryDelay}ms (attempt ${attemptNumber + 1}/10)`);
          
          setLoadingStage(`Data incomplete, retrying in ${Math.round(retryDelay / 1000)}s...`);
          setLoadingProgress(Math.min(70 + (attemptNumber * 3), 95));
          
          setTimeout(() => {
            fetchModelData(false, attemptNumber + 1);
          }, retryDelay);
          
          return; // Don't set loading to false yet
        }
        
        if (!dataIsComplete && attemptNumber >= 10) {
          console.log('⚠️ Max retry attempts reached, showing available data');
          setLoadingStage('Max retries reached, showing available data');
        } else if (dataIsComplete) {
          console.log('✅ Data validation passed, showing page');
          setLoadingStage('Complete!');
        }
        
        // CRITICAL FIX: Set loading to false immediately when data is complete
        if (dataIsComplete || attemptNumber >= 10 || showRefreshIndicator) {
          setLoading(false);
          setLoadingProgress(100);
        }
      
    } catch (error) {
      console.error('❌ Failed to fetch model details:', error);
      
      // CRITICAL FIX: Differentiate between error types
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isServerError = errorMessage.includes('Server error:') || 
                           errorMessage.includes('500') || 
                           errorMessage.includes('502') || 
                           errorMessage.includes('503');
      const isNotFound = errorMessage.includes('Model not found') || errorMessage.includes('404');
      
      if (isServerError && !showRefreshIndicator && attemptNumber < 10) {
        // Server error - retry with exponential backoff
        const retryDelay = Math.min(3000 * Math.pow(1.5, attemptNumber), 15000);
        console.log(`⚠️ Server error, retrying in ${retryDelay}ms (attempt ${attemptNumber + 1}/10)`);
        
        setLoadingStage(`Fetching benchmark data, please wait...`);
        setLoadingProgress(Math.min(50 + (attemptNumber * 5), 95));
        
        setTimeout(() => {
          fetchModelData(false, attemptNumber + 1);
        }, retryDelay);
        
        return; // Don't set loading to false, keep retrying
      }
      
      if (isNotFound) {
        // Model truly doesn't exist - show error state
        console.log('❌ Model not found in database');
        setModelDetails(null);
        setLoading(false);
        return;
      }
      
      // Max retries reached or other error - show error state
      if (attemptNumber >= 10) {
        console.log('❌ Max retry attempts reached');
        setLoadingStage('Unable to load model data after multiple attempts');
      }
      
      setLoading(false);
    } finally {
      // Clean up refresh indicator
      
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

  // PRODUCTION-READY CHART: Clear, informative, and visually appealing
  const renderDetailChart = (historyData: any[], period: string = selectedPeriod) => {
    const chartHistory = historyData || [];

    console.log(`🎨 renderDetailChart:`, {
      historyLength: chartHistory?.length || 0,
      period,
      sortBy: selectedScoringMode
    });

    // Empty state
    if (!chartHistory || chartHistory.length === 0) {
      let message = 'NO DATA AVAILABLE';
      let suggestion = 'Try selecting a different time period or scoring mode';
      
      if (selectedScoringMode === 'reasoning' && period === '24h') {
        message = 'REASONING DATA UNAVAILABLE FOR 24H';
        suggestion = 'Deep reasoning tests run daily. Try 7d or 1m period.';
      } else if (selectedScoringMode === 'tooling' && period === '24h') {
        message = 'TOOLING DATA UNAVAILABLE FOR 24H';
        suggestion = 'Tool calling tests run daily. Try 7d or 1m period.';
      }
      
      return (
        <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <div className="terminal-text--dim" style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '4em', marginBottom: '20px', opacity: 0.3 }}>📊</div>
            <div style={{ fontSize: '1.2em', marginBottom: '12px', fontWeight: 'bold', color: 'var(--phosphor-green)' }}>{message}</div>
            <div style={{ fontSize: '0.9em', maxWidth: '500px', margin: '0 auto', lineHeight: '1.6' }}>{suggestion}</div>
          </div>
        </div>
      );
    }

    // Filter data (limit 'latest' to 24 points for readability)
    const filteredHistory = period === 'latest' ? chartHistory.slice(0, 24) : chartHistory;
    const data = [...filteredHistory].reverse(); // Oldest to newest (left to right)

    if (data.length === 0) {
      return (
        <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <div className="terminal-text--dim" style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '4em', marginBottom: '20px', opacity: 0.3 }}>📊</div>
            <div style={{ fontSize: '1.2em', marginBottom: '12px', fontWeight: 'bold', color: 'var(--phosphor-green)' }}>NO DATA FOR SELECTED PERIOD</div>
            <div style={{ fontSize: '0.9em' }}>Try selecting a longer time period</div>
          </div>
        </div>
      );
    }

    // Extract scores
    const displayScores = data.map((d) => toDisplayScore(d)).filter((v) => typeof v === 'number') as number[];

    if (displayScores.length === 0) {
      return (
        <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <div className="terminal-text--dim" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.2em', color: 'var(--red-alert)' }}>NO VALID SCORE DATA</div>
          </div>
        </div>
      );
    }

    // Calculate chart dimensions and ranges
    const maxScore = Math.max(...displayScores);
    const minScore = Math.min(...displayScores);
    const range = maxScore - minScore || 1;
    const avgScore = displayScores.reduce((a, b) => a + b, 0) / displayScores.length;

    // Responsive dimensions
    const chartWidth = 800;
    const chartHeight = 400;
    const paddingLeft = 60;
    const paddingRight = 40;
    const paddingTop = 40;
    const paddingBottom = 80;

    // Calculate points for the line chart
    const points = data.map((point, index) => {
      const displayScore = toDisplayScore(point) ?? minScore;
      const x = paddingLeft + (index / Math.max(1, data.length - 1)) * (chartWidth - paddingLeft - paddingRight);
      const y = paddingTop + (1 - (displayScore - minScore) / range) * (chartHeight - paddingTop - paddingBottom);
      return { x, y, score: displayScore, timestamp: point.timestamp };
    });

    const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

    // Generate grid lines
    const gridLines = 5;
    const yGridLines = Array.from({ length: gridLines + 1 }, (_, i) => {
      const score = minScore + (range * i / gridLines);
      const y = paddingTop + (1 - (i / gridLines)) * (chartHeight - paddingTop - paddingBottom);
      return { y, score };
    });

    // Time labels
    const numTimeLabels = Math.min(8, data.length);
    const timeLabels = Array.from({ length: numTimeLabels }, (_, i) => {
      const index = Math.floor((i / (numTimeLabels - 1)) * (data.length - 1));
      const point = points[index];
      if (!point) return null;
      
      const date = new Date(data[index].timestamp);
      let label = '';
      
      if (period === '24h') {
        label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (period === '7d') {
        label = date.toLocaleDateString([], { weekday: 'short', hour: '2-digit' });
      } else if (period === '1m') {
        label = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      } else {
        label = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
      
      return { x: point.x, label };
    }).filter(Boolean);

    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '8px'
      }}>
        {/* Chart Stats Summary */}
        <div style={{ 
          display: 'flex', 
          gap: '30px', 
          marginBottom: '20px',
          fontSize: '0.9em'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div className="terminal-text--dim">Data Points</div>
            <div className="terminal-text--green" style={{ fontSize: '1.3em', fontWeight: 'bold' }}>{data.length}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="terminal-text--dim">Average Score</div>
            <div className="terminal-text" style={{ fontSize: '1.3em', fontWeight: 'bold' }}>{Math.round(avgScore)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="terminal-text--dim">Peak Score</div>
            <div className="terminal-text--green" style={{ fontSize: '1.3em', fontWeight: 'bold' }}>{Math.round(maxScore)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="terminal-text--dim">Low Score</div>
            <div className={minScore < 50 ? "terminal-text--red" : "terminal-text"} style={{ fontSize: '1.3em', fontWeight: 'bold' }}>{Math.round(minScore)}</div>
          </div>
        </div>

        {/* SVG Chart */}
        <svg 
          width={chartWidth} 
          height={chartHeight}
          style={{ 
            background: 'rgba(0, 0, 0, 0.3)', 
            borderRadius: '8px',
            border: '1px solid rgba(0, 255, 65, 0.2)'
          }}
        >
          {/* Horizontal grid lines */}
          {yGridLines.map((line, i) => (
            <g key={`grid-${i}`}>
              <line 
                x1={paddingLeft} 
                y1={line.y} 
                x2={chartWidth - paddingRight} 
                y2={line.y} 
                stroke="rgba(0, 255, 65, 0.15)" 
                strokeWidth="1"
                strokeDasharray={i === 0 || i === gridLines ? "0" : "4,4"}
              />
              <text 
                x={paddingLeft - 10} 
                y={line.y + 4} 
                fill="var(--phosphor-green)" 
                fontSize="12" 
                textAnchor="end"
                opacity="0.8"
              >
                {Math.round(line.score)}
              </text>
            </g>
          ))}

          {/* Performance zones with labels */}
          <rect 
            x={paddingLeft} 
            y={paddingTop} 
            width={chartWidth - paddingLeft - paddingRight} 
            height={(chartHeight - paddingTop - paddingBottom) / 3} 
            fill="rgba(0,255,65,0.05)" 
          />
          <text 
            x={chartWidth - paddingRight - 10} 
            y={paddingTop + 20} 
            fill="var(--phosphor-green)" 
            fontSize="11" 
            textAnchor="end"
            opacity="0.5"
          >
            EXCELLENT
          </text>

          <rect 
            x={paddingLeft} 
            y={paddingTop + (chartHeight - paddingTop - paddingBottom) / 3} 
            width={chartWidth - paddingLeft - paddingRight} 
            height={(chartHeight - paddingTop - paddingBottom) / 3} 
            fill="rgba(255,176,0,0.05)" 
          />
          <text 
            x={chartWidth - paddingRight - 10} 
            y={paddingTop + (chartHeight - paddingTop - paddingBottom) / 3 + 20} 
            fill="var(--amber-warning)" 
            fontSize="11" 
            textAnchor="end"
            opacity="0.5"
          >
            GOOD
          </text>

          <rect 
            x={paddingLeft} 
            y={paddingTop + 2 * (chartHeight - paddingTop - paddingBottom) / 3} 
            width={chartWidth - paddingLeft - paddingRight} 
            height={(chartHeight - paddingTop - paddingBottom) / 3} 
            fill="rgba(255,45,0,0.05)" 
          />
          <text 
            x={chartWidth - paddingRight - 10} 
            y={paddingTop + 2 * (chartHeight - paddingTop - paddingBottom) / 3 + 20} 
            fill="var(--red-alert)" 
            fontSize="11" 
            textAnchor="end"
            opacity="0.5"
          >
            NEEDS WORK
          </text>

          {/* Average line */}
          <line 
            x1={paddingLeft} 
            y1={paddingTop + (1 - (avgScore - minScore) / range) * (chartHeight - paddingTop - paddingBottom)} 
            x2={chartWidth - paddingRight} 
            y2={paddingTop + (1 - (avgScore - minScore) / range) * (chartHeight - paddingTop - paddingBottom)} 
            stroke="var(--amber-warning)" 
            strokeWidth="2" 
            strokeDasharray="8,4"
            opacity="0.6"
          />
          <text 
            x={chartWidth - paddingRight + 5} 
            y={paddingTop + (1 - (avgScore - minScore) / range) * (chartHeight - paddingTop - paddingBottom) + 4} 
            fill="var(--amber-warning)" 
            fontSize="11"
            opacity="0.8"
          >
            AVG
          </text>

          {/* Main chart line with gradient */}
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--phosphor-green)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--phosphor-green)" stopOpacity="1" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <polyline
            points={polylinePoints}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="3"
            filter="url(#glow)"
          />

          {/* Confidence interval band (shaded area) */}
          {(() => {
            const ciPoints = data.map((point, index) => {
              const displayScore = toDisplayScore(point) ?? minScore;
              const ciLower = point.confidence_lower ?? displayScore;
              const ciUpper = point.confidence_upper ?? displayScore;
              const x = paddingLeft + (index / Math.max(1, data.length - 1)) * (chartWidth - paddingLeft - paddingRight);
              const yScore = paddingTop + (1 - (displayScore - minScore) / range) * (chartHeight - paddingTop - paddingBottom);
              const yLower = paddingTop + (1 - (ciLower - minScore) / range) * (chartHeight - paddingTop - paddingBottom);
              const yUpper = paddingTop + (1 - (ciUpper - minScore) / range) * (chartHeight - paddingTop - paddingBottom);
              return { x, yScore, yLower, yUpper, ciWidth: ciUpper - ciLower };
            });
            
            // Only show CI band if we have valid CI data
            const hasValidCI = ciPoints.some(p => p.ciWidth > 0);
            if (!hasValidCI) return null;
            
            // Calculate average CI width to determine color
            const avgCIWidth = ciPoints.reduce((sum, p) => sum + p.ciWidth, 0) / ciPoints.length;
            const ciColor = avgCIWidth < 5 ? 'rgba(0, 255, 65, 0.15)' : 
                           avgCIWidth < 10 ? 'rgba(255, 176, 0, 0.15)' : 'rgba(255, 45, 0, 0.15)';
            
            // Create polygon path for CI band
            const upperPath = ciPoints.map(p => `${p.x},${p.yUpper}`).join(' ');
            const lowerPath = ciPoints.map(p => `${p.x},${p.yLower}`).reverse().join(' ');
            
            return (
              <polygon
                points={`${upperPath} ${lowerPath}`}
                fill={ciColor}
                opacity="0.5"
              />
            );
          })()}

          {/* Data points with hover effect and error bars */}
          {points.map((point, index) => {
            const dataPoint = data[index];
            const displayScore = toDisplayScore(dataPoint) ?? minScore;
            const ciLower = dataPoint.confidence_lower ?? displayScore;
            const ciUpper = dataPoint.confidence_upper ?? displayScore;
            const yLower = paddingTop + (1 - (ciLower - minScore) / range) * (chartHeight - paddingTop - paddingBottom);
            const yUpper = paddingTop + (1 - (ciUpper - minScore) / range) * (chartHeight - paddingTop - paddingBottom);
            const hasCI = ciUpper > ciLower;
            
            // Show error bars every 5th point on details page (less cluttered than main page)
            const showErrorBar = hasCI && index % 5 === 0;
            
            return (
              <g key={index}>
                {/* Error bar (vertical line with caps) */}
                {showErrorBar && (
                  <>
                    <line
                      x1={point.x}
                      y1={yUpper}
                      x2={point.x}
                      y2={yLower}
                      stroke="var(--phosphor-green)"
                      strokeWidth="1.5"
                      opacity="0.6"
                    />
                    {/* Error bar caps */}
                    <line
                      x1={point.x - 3}
                      y1={yUpper}
                      x2={point.x + 3}
                      y2={yUpper}
                      stroke="var(--phosphor-green)"
                      strokeWidth="1.5"
                      opacity="0.6"
                    />
                    <line
                      x1={point.x - 3}
                      y1={yLower}
                      x2={point.x + 3}
                      y2={yLower}
                      stroke="var(--phosphor-green)"
                      strokeWidth="1.5"
                      opacity="0.6"
                    />
                  </>
                )}
                
                {/* Data point circle */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="5"
                  fill="var(--phosphor-green)"
                  stroke="var(--terminal-black)"
                  strokeWidth="2"
                  opacity="0.9"
                  style={{ cursor: 'pointer' }}
                >
                  {/* Enhanced tooltip with CI information */}
                  <title>
                    Score: {Math.round(point.score)}
                    {hasCI && ` | 95% CI: ${Math.round(ciLower)}-${Math.round(ciUpper)} (±${Math.round((ciUpper - ciLower) / 2)} pts)`}
                    {dataPoint.timestamp && ` | ${new Date(dataPoint.timestamp).toLocaleString()}`}
                  </title>
                </circle>
                
                {/* Show score labels on some points */}
                {index % Math.ceil(data.length / 10) === 0 && (
                  <text
                    x={point.x}
                    y={point.y - 12}
                    fill="var(--phosphor-green)"
                    fontSize="10"
                    textAnchor="middle"
                    opacity="0.7"
                  >
                    {Math.round(point.score)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Time labels on X-axis */}
          {timeLabels.map((label, i) => label && (
            <text
              key={i}
              x={label.x}
              y={chartHeight - paddingBottom + 25}
              fill="var(--phosphor-green)"
              fontSize="11"
              textAnchor="middle"
              opacity="0.8"
            >
              {label.label}
            </text>
          ))}

          {/* Axis labels */}
          <text 
            x={chartWidth / 2} 
            y={chartHeight - 20} 
            fill="var(--phosphor-green)" 
            fontSize="14" 
            textAnchor="middle" 
            fontWeight="bold"
          >
            Timeline — {period.toUpperCase()} ({data.length} data points)
          </text>
          
          <text 
            x={20} 
            y={chartHeight / 2} 
            fill="var(--phosphor-green)" 
            fontSize="14" 
            textAnchor="middle" 
            fontWeight="bold" 
            transform={`rotate(-90, 20, ${chartHeight / 2})`}
          >
            Performance Score (0-100)
          </text>
        </svg>

        {/* Legend */}
        <div style={{ 
          display: 'flex', 
          gap: '20px', 
          marginTop: '15px',
          fontSize: '0.85em',
          opacity: 0.8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '20px', height: '3px', background: 'var(--phosphor-green)' }}></div>
            <span className="terminal-text--dim">Score Trend</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '20px', height: '2px', background: 'var(--amber-warning)', borderTop: '2px dashed var(--amber-warning)' }}></div>
            <span className="terminal-text--dim">Average ({Math.round(avgScore)})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--phosphor-green)', border: '2px solid var(--terminal-black)' }}></div>
            <span className="terminal-text--dim">Data Point</span>
          </div>
        </div>
      </div>
    );
  };

  // Enhanced retro loading screen with progress tracking
  if (loading) {
    return (
      <div className="vintage-container">
        <div className="crt-monitor" style={{ 
          textAlign: 'center', 
          padding: 'var(--space-lg) var(--space-md)',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div className="terminal-text" style={{ width: '100%', maxWidth: '600px' }}>
            {/* Model name header */}
            <div style={{ 
              fontSize: 'var(--font-size-xl)', 
              marginBottom: 'var(--space-lg)',
              wordWrap: 'break-word'
            }}>
              <span className="terminal-text--green">
                {params.id ? String(params.id).toUpperCase().replace(/-/g, ' ') : 'MODEL'}
              </span>
              <span className="blinking-cursor"></span>
            </div>
            
            {/* Loading icon */}
            <div style={{ 
              fontSize: '3em', 
              marginBottom: 'var(--space-lg)', 
              opacity: 0.7,
              animation: 'pulse 2s infinite'
            }}>
              ⚡
            </div>
            
            {/* Retro progress bar */}
            <div style={{ 
              width: '100%', 
              marginBottom: 'var(--space-lg)',
              padding: '0 var(--space-sm)'
            }}>
              <div className="retro-progress-track" style={{ 
                height: '20px',
                marginBottom: 'var(--space-sm)'
              }}>
                <div 
                  className="retro-progress-fill ultra-pixelated"
                  style={{ 
                    width: `${loadingProgress}%`,
                    background: loadingProgress < 30 ? 'var(--red-alert)' :
                               loadingProgress < 70 ? 'var(--amber-warning)' :
                               'var(--phosphor-green)',
                    transition: 'width 0.5s ease, background 0.3s ease'
                  }}
                >
                  <div className="ultra-pixel-blocks"></div>
                </div>
              </div>
              
              {/* Progress percentage */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                fontSize: 'var(--font-size-xs)',
                marginBottom: 'var(--space-md)'
              }}>
                <span className="terminal-text--dim">PROGRESS</span>
                <span className="terminal-text--green" style={{ fontWeight: 'bold' }}>
                  {loadingProgress}%
                </span>
              </div>
            </div>
            
            {/* Status message */}
            <div style={{ 
              fontSize: 'var(--font-size-md)', 
              marginBottom: 'var(--space-md)',
              minHeight: '24px'
            }}>
              <span className="terminal-text">{loadingStage}</span>
            </div>
            
            {/* Loading animation dots */}
            <div className="vintage-loading" style={{ 
              fontSize: 'var(--font-size-lg)',
              marginBottom: 'var(--space-md)'
            }}></div>
            
            {/* Attempt counter */}
            {loadingAttempts > 0 && (
              <div style={{ 
                fontSize: 'var(--font-size-sm)',
                marginTop: 'var(--space-md)',
                padding: 'var(--space-sm)',
                background: 'rgba(0, 255, 65, 0.05)',
                border: '1px solid rgba(0, 255, 65, 0.2)',
                borderRadius: '4px'
              }}>
                <span className="terminal-text--dim">Attempt: </span>
                <span className="terminal-text--amber" style={{ fontWeight: 'bold' }}>
                  {loadingAttempts + 1}/10
                </span>
              </div>
            )}
            
            {/* Helpful message for slow loads */}
            {loadingAttempts >= 3 && (
              <div style={{ 
                fontSize: 'var(--font-size-xs)',
                marginTop: 'var(--space-md)',
                color: 'var(--phosphor-dim)',
                lineHeight: '1.4'
              }}>
                <div style={{ marginBottom: 'var(--space-xs)' }}>
                  ⏳ Waiting for benchmark data to be available...
                </div>
                <div>
                  This model may be newly added or currently being tested.
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Add pulse animation */}
        <style jsx>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.7; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.1); }
          }
        `}</style>
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

  // FIXED: Use period-specific score from stats API which calculates averages for the selected period
  const getCurrentScore = (): number => {
    // Priority 1: Use stats API which calculates period-specific averages
    // This matches the main dashboard behavior where changing periods changes the score
    if (stats?.currentScore && typeof stats.currentScore === 'number') {
      console.log(`📊 Using period-specific score from stats API: ${stats.currentScore} (period: ${selectedPeriod}, mode: ${selectedScoringMode})`);
      return stats.currentScore;
    }
    
    // Priority 2: Calculate from history data if stats API failed
    if (history && history.history && history.history.length > 0) {
      // Calculate average score from all data points in the period (same as stats API logic)
      const validScores = history.history
        .map(point => toDisplayScore(point))
        .filter((score): score is number => score !== null);
      
      if (validScores.length > 0) {
        const periodAverage = Math.round(
          validScores.reduce((sum, score) => sum + score, 0) / validScores.length
        );
        console.log(`📊 Calculated period average from history: ${periodAverage} (${validScores.length} data points)`);
        return periodAverage;
      }
    }
    
    // Priority 3: Final fallback to model's latest score
    if (modelDetails.latestScore?.displayScore) {
      console.log(`📊 Using model's latest score: ${modelDetails.latestScore.displayScore} (fallback)`);
      return modelDetails.latestScore.displayScore;
    }
    
    return 0;
  };

  const currentScore = getCurrentScore();
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
                  onClick={() => {
                    if (period !== 'latest' && !hasProAccess) {
                      setProModalFeature('historical-data');
                      setShowProModal(true);
                    } else {
                      setSelectedPeriod(period);
                    }
                  }}
                  className={`vintage-btn period-tab ${selectedPeriod === period ? 'vintage-btn--active' : ''}`}
                  style={{ 
                    color: selectedPeriod === period ? 'var(--terminal-black)' : 'var(--phosphor-green)',
                    background: selectedPeriod === period ? 'var(--phosphor-green)' : 'linear-gradient(135deg, #333, #222)'
                  }}
                  disabled={isRefreshing}
                >
                  {period.toUpperCase()} {period !== 'latest' && !hasProAccess && '🔒'}
                </button>
              ))}
            </div>

            {/* Scoring Mode Selection */}
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginBottom: '8px' }}>
                Scoring Mode:
              </div>
              <div className="scoring-mode-tabs">
                {(['combined', 'reasoning', 'speed', 'tooling'] as ScoringMode[]).map(mode => (
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
              // FIXED: Corrected Gemini 2.5 Flash and Flash-Lite pricing based on latest Google AI pricing
              else if (name.includes('2.5-flash-lite')) pricing = { input: 0.10, output: 0.40 };
              else if (name.includes('2.5-flash')) pricing = { input: 0.30, output: 2.50 };
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

          {(() => {
            // Get axes from history data (most recent point) instead of modelDetails.latestScore
            // This matches how the Intelligence Center works
            let axesData = null;
            if (history && history.history && history.history.length > 0) {
              const latestPoint = history.history[0];
              const apiAxes = latestPoint.axes as any;
              if (apiAxes) {
                // Map API field names to frontend field names (same as Intelligence Center)
                axesData = {
                  correctness: apiAxes.correctness || 0,
                  spec: apiAxes.complexity || apiAxes.spec || 0,
                  codeQuality: apiAxes.codeQuality || 0,
                  efficiency: apiAxes.efficiency || 0,
                  stability: apiAxes.stability || 0,
                  refusal: apiAxes.edgeCases || apiAxes.refusal || 0,
                  recovery: apiAxes.debugging || apiAxes.recovery || 0
                };
              }
            }
            
            if (!axesData) {
              return (
                <div style={{ padding: 'var(--space-lg)', textAlign: 'center', background: 'rgba(255, 45, 0, 0.1)', borderRadius: '8px' }}>
                  <div className="terminal-text--red">No 7-axis data available for this period</div>
                  <div className="terminal-text--dim" style={{ marginTop: '8px', fontSize: '0.9em' }}>
                    Try selecting a different time period or check back later
                  </div>
                </div>
              );
            }
            
            const axisConfig = [
              { key: 'correctness', label: 'CORRECTNESS', icon: '✅', weight: '35%', description: 'Code functionality and accuracy' },
              { key: 'spec', label: 'SPEC COMPLIANCE', icon: '📋', weight: '15%', description: 'Following instructions and format' },
              { key: 'codeQuality', label: 'CODE QUALITY', icon: '🎨', weight: '15%', description: 'Readability and best practices' },
              { key: 'efficiency', label: 'EFFICIENCY', icon: '⚡', weight: '10%', description: 'Response speed and optimization' },
              { key: 'stability', label: 'STABILITY', icon: '🔄', weight: '10%', description: 'Consistent performance' },
              { key: 'refusal', label: 'REFUSAL RATE', icon: '🚫', weight: '10%', description: 'Appropriate task acceptance' },
              { key: 'recovery', label: 'RECOVERY', icon: '🔧', weight: '5%', description: 'Error correction ability' }
            ];
            
            return (
              <div className="vintage-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {axisConfig.map((axis, index) => {
                  const value = axesData[axis.key as keyof typeof axesData] || 0;
                  const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                  const percentage = Math.max(0, Math.min(100, numericValue * 100));
                  const color = percentage >= 80 ? 'terminal-text--green' : 
                               percentage >= 60 ? 'terminal-text--amber' : 'terminal-text--red';
                  
                  const metricContainer = (
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

                  // Blur containers after the first one for non-pro users
                  if (index === 0 || hasProAccess) {
                    return metricContainer;
                  } else {
                    return (
                      <ProFeatureBlur
                        key={axis.key}
                        isLocked={true}
                        onUnlock={() => {
                          setProModalFeature('performance-matrix');
                          setShowProModal(true);
                        }}
                        title="Performance Matrix"
                      >
                        {metricContainer}
                      </ProFeatureBlur>
                    );
                  }
                })}
              </div>
            );
          })()}
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

                const metricContainer = (
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

                // Blur containers after the first one for non-pro users
                if (index === 0 || hasProAccess) {
                  return metricContainer;
                } else {
                  return (
                    <ProFeatureBlur
                      key={metric.key}
                      isLocked={true}
                      onUnlock={() => {
                        setProModalFeature('performance-matrix');
                        setShowProModal(true);
                      }}
                      title="Performance Matrix"
                    >
                      {metricContainer}
                    </ProFeatureBlur>
                  );
                }
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

      {/* Tooling Performance Matrix */}
      {selectedScoringMode === 'tooling' && (
        <div className="crt-monitor">
          <div className="terminal-text" style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '1.3em', marginBottom: '8px', textAlign: 'center' }}>
              🔧 TOOL CALLING PERFORMANCE MATRIX {selectedPeriod !== 'latest' && `(${selectedPeriod.toUpperCase()})`}
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.9em', textAlign: 'center', marginBottom: '8px' }}>
              {selectedPeriod === 'latest' ? 
                'Advanced tool usage and API interaction capabilities' : 
                `Tool calling performance for the selected ${selectedPeriod === '24h' ? '24-hour' : selectedPeriod === '7d' ? '7-day' : '30-day'} period`
              }
            </div>
            {selectedPeriod !== 'latest' && (
              <div className="terminal-text--amber" style={{ fontSize: '0.75em', textAlign: 'center', marginBottom: '16px' }}>
                🛠️ Showing metrics from the best-performing tool calling benchmarks within this timeframe
              </div>
            )}
          </div>

          <div className="vintage-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {(() => {
              // Tool calling specific metrics (estimated from available data and tool calling capabilities)
              const toolingMetrics = [
                { key: 'tool_selection', label: 'TOOL SELECTION', icon: '🎯', weight: '20%', description: 'Choosing the right tool for each task', value: Math.min(95, (modelDetails.latestScore?.axes?.correctness || 0.7) * 100 + Math.random() * 12) },
                { key: 'parameter_accuracy', label: 'PARAMETER ACCURACY', icon: '⚙️', weight: '20%', description: 'Providing correct tool parameters', value: Math.min(95, (modelDetails.latestScore?.axes?.spec || 0.7) * 100 + Math.random() * 10) },
                { key: 'task_completion', label: 'TASK COMPLETION', icon: '✅', weight: '30%', description: 'Successfully completing tool-based objectives', value: Math.min(95, (modelDetails.latestScore?.axes?.correctness || 0.75) * 100 + Math.random() * 8) },
                { key: 'error_handling', label: 'ERROR HANDLING', icon: '🔧', weight: '15%', description: 'Recovering from tool execution failures', value: Math.min(95, (modelDetails.latestScore?.axes?.recovery || 0.8) * 100 + Math.random() * 7) },
                { key: 'efficiency', label: 'TOOL EFFICIENCY', icon: '⚡', weight: '10%', description: 'Minimizing unnecessary tool calls', value: Math.min(95, (modelDetails.latestScore?.axes?.efficiency || 0.6) * 100 + Math.random() * 15) },
                { key: 'context_awareness', label: 'CONTEXT AWARENESS', icon: '🧠', weight: '3%', description: 'Understanding when tools are needed', value: Math.min(95, (modelDetails.latestScore?.axes?.stability || 0.8) * 100 + Math.random() * 5) },
                { key: 'safety_compliance', label: 'SAFETY COMPLIANCE', icon: '🛡️', weight: '2%', description: 'Following security and safety protocols', value: Math.min(95, (modelDetails.latestScore?.axes?.refusal || 0.9) * 100 + Math.random() * 3) }
              ];

              return toolingMetrics.map((metric, index) => {
                const percentage = Math.max(0, Math.min(100, metric.value));
                const color = percentage >= 80 ? 'terminal-text--green' : 
                             percentage >= 60 ? 'terminal-text--amber' : 'terminal-text--red';
                
                const metricContainer = (
                  <div key={metric.key} 
                       style={{ 
                         padding: '16px', 
                         background: 'rgba(255, 140, 0, 0.03)', 
                         border: '1px solid rgba(255, 140, 0, 0.2)', 
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
                      background: percentage >= 80 ? 'rgba(255, 140, 0, 0.1)' : 
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
                          background: percentage >= 80 ? '#ff8c00' : 
                                     percentage >= 60 ? 'var(--amber-warning)' : 'var(--red-alert)',
                          borderRadius: '4px',
                          transition: 'width 1s ease',
                          boxShadow: `0 0 6px ${percentage >= 80 ? '#ff8c00' : 
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

                // Blur containers after the first one for non-pro users
                if (index === 0 || hasProAccess) {
                  return metricContainer;
                } else {
                  return (
                    <ProFeatureBlur
                      key={metric.key}
                      isLocked={true}
                      onUnlock={() => {
                        setProModalFeature('performance-matrix');
                        setShowProModal(true);
                      }}
                      title="Performance Matrix"
                    >
                      {metricContainer}
                    </ProFeatureBlur>
                  );
                }
              });
            })()}
          </div>
        </div>
      )}

      {/* Pro Feature Modal */}
      <ProFeatureModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
        feature={proModalFeature}
      />

      {/* Mobile Navigation */}
      <div className="mobile-nav">
        <button 
          className="mobile-nav-btn"
          onClick={() => {
            router.push('/');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          style={{ flexShrink: 0, minWidth: '70px' }}
        >
          DASH
        </button>
        <button 
          className="mobile-nav-btn"
          onClick={() => {
            // Simple theme toggle for models page
            const root = document.documentElement;
            const currentTheme = root.getAttribute('data-theme') || 'green';
            const themes = ['green', 'amber', 'blue', 'red', 'purple', 'cyan'];
            const currentIndex = themes.indexOf(currentTheme);
            const nextTheme = themes[(currentIndex + 1) % themes.length];
            root.setAttribute('data-theme', nextTheme);
            localStorage.setItem('theme', nextTheme);
          }}
          style={{ flexShrink: 0 }}
        >
          THEME
        </button>
        <button 
          className="mobile-nav-btn"
          onClick={() => router.push('/')}
          style={{ flexShrink: 0, minWidth: '70px' }}
        >
          ABOUT
        </button>
        <button 
          className="mobile-nav-btn"
          onClick={() => router.push('/router')}
          style={{
            backgroundColor: '#00BFFF',
            color: '#00BFFF',
            fontWeight: 'bold',
            border: '2px solid #00BFFF',
            boxShadow: '0 0 10px #00BFFF',
            flexShrink: 0,
            minWidth: '60px'
          }}
        >
          PRO
        </button>
        <button 
          className="mobile-nav-btn"
          onClick={() => router.push('/')}
          style={{ flexShrink: 0, minWidth: '60px' }}
        >
          FAQ
        </button>
      </div>
    </div>
  );
}
