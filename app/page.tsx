'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TickerTape from '../components/TickerTape';
import StupidMeter from '../components/StupidMeter';

type Provider = 'openai' | 'xai' | 'anthropic' | 'google';

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

interface ModelScore {
  id: string;
  name: string;
  provider: Provider;
  currentScore: number | 'unavailable';
  trend: 'up' | 'down' | 'stable' | 'unavailable';
  lastUpdated: Date;
  status: 'excellent' | 'good' | 'warning' | 'critical' | 'unavailable';
  weeklyBest: number | 'unavailable';
  weeklyWorst: number | 'unavailable';
  unavailableReason?: string;
}

interface AlertModel {
  name: string;
  provider: Provider;
  issue: string;
  severity: 'warning' | 'critical';
  detectedAt: Date;
}

export default function Dashboard() {
  const router = useRouter();
  const [selectedView, setSelectedView] = useState<'dashboard' | 'test' | 'about' | 'faq'>('dashboard');
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [modelScores, setModelScores] = useState<ModelScore[]>([]);
  const [alerts, setAlerts] = useState<AlertModel[]>([]);
  const [globalIndex, setGlobalIndex] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [degradations, setDegradations] = useState<any[]>([]);
  const [providerReliability, setProviderReliability] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [transparencyMetrics, setTransparencyMetrics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'latest' | '24h' | '7d' | '1m'>('latest');
  const [leaderboardSortBy, setLeaderboardSortBy] = useState<'combined' | 'reasoning' | 'speed' | 'tooling' | 'price'>('combined');
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  // Fixed analytics period since user controls were removed
  const analyticsPeriod: 'latest' | '24h' | '7d' | '1m' = 'latest';
  const [stupidMeterMode, setStupidMeterMode] = useState<'smart' | 'stupid'>('smart');
  const [batchStatus, setBatchStatus] = useState<any>(null);
  const [showBatchRefreshing, setShowBatchRefreshing] = useState(false);
  
  // Real-time update states
  const [backgroundUpdating, setBackgroundUpdating] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [changedScores, setChangedScores] = useState<Set<string>>(new Set());
  const [previousScores, setPreviousScores] = useState<Map<string, number>>(new Map());

  // Force update counter to ensure React detects score changes
  const [forceUpdateCounter, setForceUpdateCounter] = useState<number>(0);

  // Visitor count state
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  
  // Welcome popup state
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState<'updates' | 'privacy' | 'completed'>('updates');

  // Fund Us popup state
  const [showFundUsPopup, setShowFundUsPopup] = useState(false);

  // Smart caching system for leaderboard data
  const [leaderboardCache, setLeaderboardCache] = useState<Map<string, {
    data: ModelScore[];
    timestamp: number;
    period: string;
    sortBy: string;
  }>>(new Map());
  
  // Cache analytics data too
  const [analyticsCache, setAnalyticsCache] = useState<Map<string, {
    degradations: any[];
    recommendations: any;
    transparency: any;
    timestamp: number;
  }>>(new Map());

  // Fetch visitor count
  const fetchVisitorCount = async () => {
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/visitors/stats`);
      const data = await response.json();
      
      if (data && data.totals && typeof data.totals.visits === 'number') {
        setVisitorCount(data.totals.visits);
      }
    } catch (error) {
      console.error('Error fetching visitor count:', error);
    }
  };

  // Fetch batch status
  const fetchBatchStatus = async () => {
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/dashboard/batch-status`);
      const data = await response.json();
      
      if (data.success) {
        setBatchStatus(data.data);
        setShowBatchRefreshing(data.data.isBatchInProgress);
        return data.data;
      }
    } catch (error) {
      console.error('Error fetching batch status:', error);
    }
    return null;
  };

  // State for individual model history data
  const [modelHistoryData, setModelHistoryData] = useState<Map<string, any[]>>(new Map());

  // Track last fetch to prevent unnecessary refetching 
  const lastFetchKey = useRef<string>('');

  // Fetch individual model history data for all models - FIXED: Proper dependency management
  useEffect(() => {
    const fetchAllModelHistory = async () => {
      if (!modelScores.length) return;
      
      const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
      const sortByParam = leaderboardSortBy === 'speed' ? '7axis' : leaderboardSortBy;
      
      console.log(`🔄 Fetching individual model history for ${modelScores.length} models (${leaderboardPeriod}/${sortByParam})`);
      
      const historyPromises = modelScores.map(async (model: any) => {
        try {
          const response = await fetch(`${apiUrl}/api/dashboard/history/${model.id}?period=${leaderboardPeriod}&sortBy=${sortByParam}`);
          if (response.ok) {
            const historyData = await response.json();
            if (historyData.success && historyData.data && historyData.data.length > 0) {
              console.log(`✅ Got individual history for ${model.name}: ${historyData.data.length} points`);
              return { modelId: model.id, history: historyData.data, success: true };
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch history for model ${model.id}:`, error);
        }
        return { modelId: model.id, history: model.history || [], success: false };
      });

      const results = await Promise.all(historyPromises);
      
      // ALWAYS update with fresh individual data
      setModelHistoryData(() => {
        const historyMap = new Map();
        results.forEach(result => {
          if (result.success && result.history.length > 0) {
            historyMap.set(result.modelId, result.history);
          }
        });
        console.log(`✅ Individual model history updated for ${historyMap.size}/${results.length} models`);
        return historyMap;
      });
    };

    if (modelScores.length > 0) {
      fetchAllModelHistory();
    }
  }, [leaderboardPeriod, leaderboardSortBy, modelScores.length]); // FIXED: Added modelScores.length to trigger when models are loaded

  // FIXED: Chart rendering function that uses individual model data with CI support
  const renderMiniChart = (history: any[], period: string = leaderboardPeriod, modelId?: string) => {
    // Use individual model history data if available
    const modelSpecificHistory = modelId ? modelHistoryData.get(modelId) : null;
    const chartHistory = modelSpecificHistory || history || [];

    console.log(`🎨 renderMiniChart for model ${modelId}:`, {
      hasModelSpecificData: !!modelSpecificHistory,
      historyLength: chartHistory?.length || 0,
      period,
      sortBy: leaderboardSortBy
    });

    if (!chartHistory || chartHistory.length === 0) {
      return (
        <div className="mini-chart-container">
          <svg width="80" height="40" className="desktop-only">
            {/* Y-axis labels */}
            <text x="8" y="8" fontSize="8" fill="var(--phosphor-green)" textAnchor="middle" opacity="0.6">100</text>
            <text x="8" y="22" fontSize="8" fill="var(--amber-warning)" textAnchor="middle" opacity="0.6">50</text>
            <text x="8" y="36" fontSize="8" fill="var(--red-alert)" textAnchor="middle" opacity="0.6">0</text>
            {/* Performance zones */}
            <rect x="12" y="4" width="66" height="10" fill="rgba(0,255,65,0.1)" opacity="0.3"/>
            <rect x="12" y="14" width="66" height="10" fill="rgba(255,176,0,0.1)" opacity="0.3"/>
            <rect x="12" y="24" width="66" height="10" fill="rgba(255,45,0,0.1)" opacity="0.3"/>
            <line x1="12" y1="20" x2="78" y2="20" stroke="var(--phosphor-green)" strokeWidth="1" opacity="0.3"/>
            <text x="45" y="25" fontSize="8" fill="var(--phosphor-green)" textAnchor="middle" opacity="0.5">No Data</text>
          </svg>
        </div>
      );
    }

    // FIXED: Don't do client-side time filtering since API already filters by period
    // The API /scores?period=24h already returns only 24h data, so additional filtering causes empty charts
    const filteredHistory = (() => {
      // For 'latest', limit to reasonable number of data points for chart readability
      if (period === 'latest') {
        return chartHistory.slice(0, 24);
      }
      
      // For specific periods (24h/7d/1m), use ALL data from API since it's already filtered
      // The API has already done the time filtering, so we shouldn't filter again
      return chartHistory || [];
    })();

    // Reverse history to show oldest to newest (left to right) - same as model detail page
    const data = [...filteredHistory].reverse();
    
    if (data.length === 0) {
      return (
        <div className="mini-chart-container">
          <svg width="60" height="30" className="desktop-only">
            <line x1="0" y1="15" x2="60" y2="15" stroke="var(--phosphor-green)" strokeWidth="1" opacity="0.3"/>
            <text x="30" y="20" fontSize="10" fill="var(--phosphor-green)" textAnchor="middle" opacity="0.5">—</text>
          </svg>
        </div>
      );
    }
    
    const displayScores = data
      .map((d) => toDisplayScore(d))
      .filter((v) => typeof v === 'number') as number[];

    if (displayScores.length === 0) {
      return (
        <div className="mini-chart-container">
          <svg width="60" height="30" className="desktop-only">
            <line x1="0" y1="15" x2="60" y2="15" stroke="var(--phosphor-green)" strokeWidth="1" opacity="0.3"/>
            <text x="30" y="20" fontSize="10" fill="var(--phosphor-green)" textAnchor="middle" opacity="0.5">—</text>
          </svg>
        </div>
      );
    }

    const maxScore = Math.max(...displayScores);
    const minScore = Math.min(...displayScores);
    const range = maxScore - minScore || 1;

    const points = data.map((point, index) => {
      const displayScore = toDisplayScore(point) ?? minScore; // safe fallback
      const x = (index / Math.max(1, data.length - 1)) * 66 + 12; // Account for Y-axis space
      const y = 36 - ((displayScore - minScore) / range) * 32;
      return `${x},${y}`;
    }).join(' ');
    
    return (
      <div className="mini-chart-container">
        <svg width="80" height="40" className="mini-chart desktop-only">
          {/* Y-axis labels */}
          <text x="8" y="8" fontSize="8" fill="var(--phosphor-green)" textAnchor="middle" opacity="0.6">{Math.round(maxScore)}</text>
          <text x="8" y="22" fontSize="8" fill="var(--amber-warning)" textAnchor="middle" opacity="0.6">{Math.round((maxScore + minScore) / 2)}</text>
          <text x="8" y="36" fontSize="8" fill={minScore < 50 ? "var(--red-alert)" : "var(--phosphor-green)"} textAnchor="middle" opacity="0.6">{Math.round(minScore)}</text>
          
          {/* Performance zone backgrounds */}
          <rect x="12" y="4" width="66" height="8" fill="rgba(0,255,65,0.08)" opacity="0.4"/>
          <rect x="12" y="12" width="66" height="12" fill="rgba(255,176,0,0.08)" opacity="0.4"/>
          <rect x="12" y="24" width="66" height="12" fill="rgba(255,45,0,0.08)" opacity="0.4"/>
          
          {/* Chart line */}
          <polyline
            points={points}
            fill="none"
            stroke="var(--phosphor-green)"
            strokeWidth="2"
            opacity="0.8"
          />
          
          {/* Confidence interval bands (subtle shading) */}
          {data.length > 1 && (() => {
            const ciPoints = data.map((point, index) => {
              const displayScore = toDisplayScore(point) ?? minScore;
              const ciLower = point.confidence_lower ?? displayScore;
              const ciUpper = point.confidence_upper ?? displayScore;
              const x = (index / Math.max(1, data.length - 1)) * 66 + 12;
              const yScore = 36 - ((displayScore - minScore) / range) * 32;
              const yLower = 36 - ((ciLower - minScore) / range) * 32;
              const yUpper = 36 - ((ciUpper - minScore) / range) * 32;
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
                opacity="0.6"
              />
            );
          })()}
          
          {/* Data point indicators with error bars */}
          {data.map((point, index) => {
            const displayScore = toDisplayScore(point) ?? minScore;
            const ciLower = point.confidence_lower ?? displayScore;
            const ciUpper = point.confidence_upper ?? displayScore;
            const x = (index / Math.max(1, data.length - 1)) * 66 + 12;
            const y = 36 - ((displayScore - minScore) / range) * 32;
            const yLower = 36 - ((ciLower - minScore) / range) * 32;
            const yUpper = 36 - ((ciUpper - minScore) / range) * 32;
            const hasCI = ciUpper > ciLower;
            
            // Show error bars every 3rd point to avoid clutter
            const showErrorBar = hasCI && index % 3 === 0;
            
            return (
              <g key={index}>
                {/* Error bar (vertical line) */}
                {showErrorBar && (
                  <>
                    <line
                      x1={x}
                      y1={yUpper}
                      x2={x}
                      y2={yLower}
                      stroke="var(--phosphor-green)"
                      strokeWidth="0.5"
                      opacity="0.6"
                    />
                    {/* Error bar caps */}
                    <line
                      x1={x - 1}
                      y1={yUpper}
                      x2={x + 1}
                      y2={yUpper}
                      stroke="var(--phosphor-green)"
                      strokeWidth="0.5"
                      opacity="0.6"
                    />
                    <line
                      x1={x - 1}
                      y1={yLower}
                      x2={x + 1}
                      y2={yLower}
                      stroke="var(--phosphor-green)"
                      strokeWidth="0.5"
                      opacity="0.6"
                    />
                  </>
                )}
                {/* Data point */}
                <circle
                  cx={x}
                  cy={y}
                  r="1"
                  fill="var(--phosphor-green)"
                  opacity="0.7"
                >
                  {/* Tooltip on hover */}
                  <title>
                    Score: {Math.round(displayScore)}
                    {hasCI && ` (CI: ${Math.round(ciLower)}-${Math.round(ciUpper)})`}
                  </title>
                </circle>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  // Move all test-related hooks to top level to avoid conditional hook calls
  const [userProvider, setUserProvider] = useState<Provider>('openai');
  const [userApiKey, setUserApiKey] = useState('');
  const [userModels, setUserModels] = useState<string[]>([]);
  const [selectedUserModel, setSelectedUserModel] = useState('');
  const [loadingUserModels, setLoadingUserModels] = useState(false);
  const [loadingUserBenchmark, setLoadingUserBenchmark] = useState(false);
  const [userBenchmarkResult, setUserBenchmarkResult] = useState<any>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [testLogs, setTestLogs] = useState<string[]>([]);

  // Fetch analytics data - now includes sortBy parameter for mode-specific recommendations
  const fetchAnalyticsData = async (period?: 'latest' | '24h' | '7d' | '1m', sortBy?: string, silent: boolean = false) => {
    // Use the passed period or fall back to current state
    const selectedPeriod = period || analyticsPeriod;
    const selectedSortBy = sortBy || leaderboardSortBy;
    
    console.log(`🔍 fetchAnalyticsData called with period=${selectedPeriod}, sortBy=${selectedSortBy}, silent=${silent}`);
    
    // Only show loading indicators if not in silent mode
    if (!silent) {
      setLoadingAnalytics(true);
    }
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
      
      console.log(`🌐 Making analytics API calls to ${apiUrl}`);
      
      const [degradationResponse, reliabilityResponse, recommendationsResponse, transparencyResponse] = await Promise.all([
        fetch(`${apiUrl}/analytics/degradations?period=${selectedPeriod}&sortBy=${selectedSortBy}`),
        fetch(`${apiUrl}/analytics/provider-reliability?period=${selectedPeriod}&sortBy=${selectedSortBy}`),
        fetch(`${apiUrl}/analytics/recommendations?period=${selectedPeriod}&sortBy=${selectedSortBy}`),
        fetch(`${apiUrl}/analytics/transparency?period=${selectedPeriod}&sortBy=${selectedSortBy}`)
      ]);
      
      console.log(`📡 Analytics API responses received:`, {
        degradations: degradationResponse.status,
        reliability: reliabilityResponse.status,
        recommendations: recommendationsResponse.status,
        transparency: transparencyResponse.status
      });
      
      const degradationData = await degradationResponse.json();
      const reliabilityData = await reliabilityResponse.json();
      const recommendationsData = await recommendationsResponse.json();
      const transparencyData = await transparencyResponse.json();
      
      console.log(`📊 Analytics data parsed:`, {
        degradations: degradationData.success,
        reliability: reliabilityData.success,
        recommendations: recommendationsData.success ? 'SUCCESS' : 'FAILED',
        transparency: transparencyData.success,
        recommendationsData: recommendationsData.success ? recommendationsData.data : 'NO DATA'
      });
      
      if (degradationData.success) setDegradations(degradationData.data);
      if (reliabilityData.success) setProviderReliability(reliabilityData.data);
      if (recommendationsData.success) {
        console.log(`✅ Setting recommendations data:`, recommendationsData.data);
        setRecommendations(recommendationsData.data);
      } else {
        console.error(`❌ Recommendations API failed:`, recommendationsData);
      }
      if (transparencyData.success) setTransparencyMetrics(transparencyData.data);
      
      console.log(`🎯 Analytics data fetch completed successfully`);
    } catch (error) {
      console.error('❌ Error fetching analytics data:', error);
    } finally {
      // Only clear loading indicators if not in silent mode
      if (!silent) {
        setLoadingAnalytics(false);
      }
    }
  };

  // Silent background data fetch without loading indicators - PRESERVES USER SELECTIONS
  const fetchDataSilently = async () => {
    if (backgroundUpdating) {
      console.log('⏸️ Silent refresh already in progress, skipping...');
      return;
    }
    
    setBackgroundUpdating(true);
    try {
      // CRITICAL: Store current user selections to prevent them from being overridden
      const currentPeriod = leaderboardPeriod;
      const currentSortBy = leaderboardSortBy;
      const currentAnalyticsPeriod = analyticsPeriod;
      
      console.log(`⚡ Silent refresh: preserving user selections ${currentPeriod}/${currentSortBy}/${currentAnalyticsPeriod}`);
      
      // ONLY update data that matches current user selections
      const apiUrl = process.env.NODE_ENV === 'production' ? 'http://aistupidlevel.info:4000' : 'http://localhost:4000';
      const cacheUrl = `${apiUrl}/dashboard/cached?period=${currentPeriod}&sortBy=${currentSortBy}&analyticsPeriod=${currentAnalyticsPeriod}`;
      
      const response = await fetch(cacheUrl);
      const result = await response.json();
      
      if (result.success && result.data) {
        console.log(`✅ Silent refresh: received data for ${currentPeriod}/${currentSortBy}/${currentAnalyticsPeriod} from ${result.meta?.cachedAt || 'unknown time'}`);
        
      // VERIFY: Only update if the data matches current user selections
      // This prevents the silent refresh from overriding user choices
      if (result.meta.period === currentPeriod && result.meta.sortBy === currentSortBy) {
          const { modelScores, alerts, globalIndex, degradations, recommendations, transparencyMetrics, providerReliability } = result.data;
          
          // Track score changes BEFORE updating state
          const newChangedScores = new Set<string>();
          const newPreviousScores = new Map<string, number>();
          
          // Batch all state updates to avoid multiple re-renders
          const stateUpdates: any = {};
          
          if (modelScores && Array.isArray(modelScores)) {
            const processedScores = modelScores.map((score: any) => ({
              ...score,
              lastUpdated: new Date(score.lastUpdated),
              history: score.history || []
            }));
            
            // Track score changes for highlighting
            processedScores.forEach((newModel: any) => {
              const prevScore = previousScores.get(newModel.id);
              const currentScore = typeof newModel.currentScore === 'number' ? newModel.currentScore : null;
              
              if (prevScore !== undefined && currentScore !== null && Math.abs(prevScore - currentScore) >= 1) {
                newChangedScores.add(newModel.id);
              }
              
              if (currentScore !== null) {
                newPreviousScores.set(newModel.id, currentScore);
              }
            });
            
            stateUpdates.modelScores = processedScores;
            console.log(`⚡ Silent refresh: prepared ${processedScores.length} models for batch update (preserving ${currentPeriod}/${currentSortBy})`);
          }
          
          // Prepare all other data components for batch update (only if they match selections)
          if (alerts) stateUpdates.alerts = alerts;
          if (globalIndex) stateUpdates.globalIndex = globalIndex;
          if (degradations) stateUpdates.degradations = degradations;
          if (recommendations) stateUpdates.recommendations = recommendations;
          if (transparencyMetrics) stateUpdates.transparencyMetrics = transparencyMetrics;
          if (providerReliability) stateUpdates.providerReliability = providerReliability;
          
          // BATCH STATE UPDATES - Use requestAnimationFrame to prevent UI blocking
          requestAnimationFrame(() => {
            // CRITICAL: Only update states if user selections haven't changed during the request
            if (leaderboardPeriod === currentPeriod && leaderboardSortBy === currentSortBy && analyticsPeriod === currentAnalyticsPeriod) {
              if (stateUpdates.modelScores) setModelScores(stateUpdates.modelScores);
              if (stateUpdates.alerts) setAlerts(stateUpdates.alerts);
              if (stateUpdates.globalIndex) setGlobalIndex(stateUpdates.globalIndex);
              if (stateUpdates.degradations) setDegradations(stateUpdates.degradations);
              if (stateUpdates.recommendations) setRecommendations(stateUpdates.recommendations);
              if (stateUpdates.transparencyMetrics) setTransparencyMetrics(stateUpdates.transparencyMetrics);
              if (stateUpdates.providerReliability) setProviderReliability(stateUpdates.providerReliability);
              
              // Update tracking state
              setPreviousScores(newPreviousScores);
              setChangedScores(newChangedScores);
              setLastUpdateTime(new Date());
              
              console.log(`🎯 Silent refresh: successfully updated data while preserving user selections ${currentPeriod}/${currentSortBy}/${currentAnalyticsPeriod}`);
            } else {
              console.log(`🚫 Silent refresh: user changed selections during update, skipping state update to preserve user choice`);
            }
          });
          
          // Clear changed highlights after 10 seconds
          if (newChangedScores.size > 0) {
            setTimeout(() => {
              setChangedScores(new Set());
            }, 10000);
          }
        } else {
          console.log(`🚫 Silent refresh: data doesn't match current user selections (${currentPeriod}/${currentSortBy} vs ${result.data.period}/${result.data.sortBy}), skipping update`);
        }
      } else {
        console.warn(`⚠️ Silent refresh cache miss: ${result.message || result.error}`);
        // Don't fallback during silent refresh to avoid loading indicators
      }
      
    } catch (error) {
      console.error('Silent background update failed:', error);
      // Silently fail - don't disrupt user experience
    } finally {
      setBackgroundUpdating(false);
    }
  };

  // Smart caching helper functions
  const getCacheKey = (period: string, sortBy: string) => `${period}-${sortBy}`;
  
  const isCacheValid = (timestamp: number, maxAgeMinutes: number = 10) => {
    return Date.now() - timestamp < maxAgeMinutes * 60 * 1000;
  };

  // Fetch all dashboard data from cached endpoints - INSTANT loading!
  const fetchDashboardDataCached = async (period: 'latest' | '24h' | '7d' | '1m' = leaderboardPeriod, sortBy: 'combined' | 'reasoning' | 'speed' | 'tooling' | 'price' = leaderboardSortBy, analyticsP: 'latest' | '24h' | '7d' | '1m' = analyticsPeriod, forceRefresh: boolean = false) => {
    console.log(`⚡ Fetching cached dashboard data: ${period}/${sortBy}/${analyticsP}`);
    
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
      const cacheUrl = `${apiUrl}/dashboard/cached?period=${period}&sortBy=${sortBy}&analyticsPeriod=${analyticsP}`;
      console.log(`🚀 Trying cache URL: ${cacheUrl}`);
      const response = await fetch(cacheUrl);
      const result = await response.json();
      console.log(`📊 Cache response:`, result);
      
      if (result.success && result.data) {
        console.log(`✅ Received cached data from ${result.meta?.cachedAt || 'unknown time'}`);
        
        // Extract all the data components
        const { modelScores, alerts, globalIndex, degradations, recommendations, transparencyMetrics, providerReliability } = result.data;
        
        // Process model scores
        if (modelScores && Array.isArray(modelScores)) {
          const processedScores = modelScores.map((score: any) => ({
            ...score,
            lastUpdated: new Date(score.lastUpdated),
            history: score.history || []
          }));
          
          // Initialize previous scores on first load
          if (previousScores.size === 0) {
            const initialScores = new Map<string, number>();
            processedScores.forEach((model: any) => {
              if (typeof model.currentScore === 'number') {
                initialScores.set(model.id, model.currentScore);
              }
            });
            setPreviousScores(initialScores);
          }
          
          // Create completely new objects to force React state change
          const timestamp = Date.now();
          const scoresToSet = processedScores.map((score: any, index: number) => {
            const newScore = {
              // Create completely new object structure
              id: score.id,
              name: score.name,
              displayName: score.displayName,
              provider: score.provider,
              currentScore: score.currentScore,
              trend: score.trend,
              lastUpdated: new Date(score.lastUpdated),
              status: score.status,
              weeklyBest: score.weeklyBest,
              weeklyWorst: score.weeklyWorst,
              unavailableReason: score.unavailableReason,
              history: score.history ? [...score.history] : [], // Clone array
              isNew: score.isNew,
              // Force React to see this as a new object
              _renderKey: `${score.id}_${period}_${sortBy}_${score.currentScore}_${timestamp}_${index}`,
              _period: period,
              _sortBy: sortBy
            };
            return newScore;
          });
          
          // Force state update with completely new array
          setModelScores([...scoresToSet]); // Create new array reference
          setForceUpdateCounter(prev => prev + 1);
          console.log(`⚡ Loaded ${processedScores.length} models with complete object recreation for ${period}/${sortBy}`);
        }
        
        // Set all other data components
        if (alerts) setAlerts(alerts);
        if (globalIndex) setGlobalIndex(globalIndex);
        if (degradations) setDegradations(degradations);
        if (recommendations) setRecommendations(recommendations);
        if (transparencyMetrics) setTransparencyMetrics(transparencyMetrics);
        if (providerReliability) setProviderReliability(providerReliability);
        
        // CRITICAL FIX: If cached globalIndex is null, fetch it directly (non-blocking)
        if (!globalIndex) {
          console.log('🔧 Cache returned null globalIndex, fetching directly...');
          fetch(`${apiUrl}/dashboard/global-index`)
            .then(response => response.json())
            .then(globalIndexData => {
              if (globalIndexData.success && globalIndexData.data) {
                setGlobalIndex(globalIndexData.data);
                console.log('✅ Successfully fetched globalIndex directly:', globalIndexData.data.current.globalScore);
              }
            })
            .catch(error => {
              console.error('❌ Failed to fetch globalIndex directly:', error);
            });
        }
        
        setLastUpdateTime(new Date());
        
        // Debug: Log the first few scores to see what we got
        if (modelScores && Array.isArray(modelScores) && modelScores.length > 0) {
          console.log('🎯 First 3 models after cache load:', modelScores.slice(0, 3).map(m => ({
            name: m.name,
            currentScore: m.currentScore,
            period: period,
            sortBy: sortBy
          })));
          
          // More detailed debugging to see if scores are different
          console.log('🔍 DETAILED SCORE DEBUG for', period, sortBy, ':', {
            'gpt-5-auto': modelScores.find(m => m.name === 'gpt-5-auto')?.currentScore,
            'gemini-1.5-pro': modelScores.find(m => m.name === 'gemini-1.5-pro')?.currentScore,
            'claude-3-5-sonnet-20241022': modelScores.find(m => m.name === 'claude-3-5-sonnet-20241022')?.currentScore,
            'gpt-4o-2024-11-20': modelScores.find(m => m.name === 'gpt-4o-2024-11-20')?.currentScore
          });
        }
        
        return true; // Success
      } else {
        console.warn(`⚠️ Cache miss or error: ${result.message || result.error}`);
        return false; // Cache miss - will need to use fallback
      }
    } catch (error) {
      console.error('Error fetching cached dashboard data:', error);
      return false; // Error - will need to use fallback
    }
  };

  // Legacy fetch function for fallback when cache misses
  const fetchLeaderboardData = async (period: 'latest' | '24h' | '7d' | '1m' = leaderboardPeriod, sortBy: 'combined' | 'reasoning' | 'speed' | 'tooling' | 'price' = leaderboardSortBy, forceRefresh: boolean = false) => {
    console.log(`🔄 Using fallback API for ${period}/${sortBy} (cache miss)`);
    setLoadingLeaderboard(true);
    
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/dashboard/scores?period=${period}&sortBy=${sortBy}`);
      const data = await response.json();
      
      if (data.success) {
        const processedScores = data.data.map((score: any) => ({
          ...score,
          lastUpdated: new Date(score.lastUpdated),
          history: score.history || []
        }));
        
        // Initialize previous scores on first load
        if (previousScores.size === 0) {
          const initialScores = new Map<string, number>();
          processedScores.forEach((model: any) => {
            if (typeof model.currentScore === 'number') {
              initialScores.set(model.id, model.currentScore);
            }
          });
          setPreviousScores(initialScores);
        }
        
        setModelScores(processedScores);
        setLastUpdateTime(new Date());
        console.log(`✅ Fallback data loaded for ${period}/${sortBy}`);
      } else {
        console.error('Failed to fetch leaderboard data:', data.error);
      }
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // Fetch dashboard data - now using INSTANT cached endpoints!
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Check batch status first
        const batchStatusData = await fetchBatchStatus();
        
        // Try to fetch ALL data from cache INSTANTLY
        console.log('⚡ Attempting instant cache load...');
        const cacheSuccess = await fetchDashboardDataCached(leaderboardPeriod, leaderboardSortBy, analyticsPeriod);
        
        if (cacheSuccess) {
          console.log('🚀 Dashboard loaded INSTANTLY from cache!');
        } else {
          console.log('🔄 Cache miss, falling back to individual API calls...');
          
          // Fallback to legacy approach if cache misses
          const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
          console.log('🔄 Cache miss - using fallback APIs which should only show 16 core models');
          
          const [alertsResponse, globalIndexResponse] = await Promise.all([
            fetch(`${apiUrl}/dashboard/alerts`),
            fetch(`${apiUrl}/dashboard/global-index`)
          ]);
          
          const alertsData = await alertsResponse.json();
          const globalIndexData = await globalIndexResponse.json();
          
          if (alertsData.success) {
            const processedAlerts = alertsData.data.map((alert: any) => ({
              ...alert,
              detectedAt: new Date(alert.detectedAt)
            }));
            setAlerts(processedAlerts);
          }

          if (globalIndexData.success) {
            setGlobalIndex(globalIndexData.data);
          }
          
          // Fallback leaderboard and analytics - these should be filtered to 16 models
          console.log('🔄 Using fallback leaderboard API - should return only 16 core models');
          await fetchLeaderboardData();
        }
        
        // ALWAYS call analytics APIs directly for Model Intelligence Center
        // This ensures real-time degradation detection and accurate recommendations
        console.log('🔄 Model Intelligence Center: Calling analytics APIs directly for real-time data...');
        fetchAnalyticsData(analyticsPeriod, leaderboardSortBy);
        
        // Always fetch visitor count (not cached)
        fetchVisitorCount();
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    // Initial data load
    fetchDashboardData();
    
    // Silent background updates every 2 minutes for real-time feel
    const silentUpdateTimer = setInterval(() => {
      fetchDataSilently();
    }, 2 * 60 * 1000);
    
    // More frequent batch status polling during batch operations
    const batchTimer = setInterval(async () => {
      const batchStatusData = await fetchBatchStatus();
      
      // If batch just finished, refresh model data immediately
      if (batchStatusData && !batchStatusData.isBatchInProgress && showBatchRefreshing) {
        console.log('Batch completed, refreshing model data silently...');
        await fetchDataSilently();
      }
    }, 30 * 1000); // Check every 30 seconds during active usage
    
    return () => {
      clearInterval(silentUpdateTimer);
      clearInterval(batchTimer);
    };
  }, [showBatchRefreshing]);

  // Effect for leaderboard controls changes - now using INSTANT cache!
  useEffect(() => {
    if (!loading) {
      console.log(`⚡ User changed to ${leaderboardPeriod}/${leaderboardSortBy}, trying cache...`);
      
      // Try cache first for instant loading
      fetchDashboardDataCached(leaderboardPeriod, leaderboardSortBy, analyticsPeriod).then(cacheSuccess => {
        if (!cacheSuccess) {
          console.log('🔄 Cache miss on control change, using fallback...');
          // Fallback to individual calls
          fetchLeaderboardData(leaderboardPeriod, leaderboardSortBy);
          fetchAnalyticsData(analyticsPeriod, leaderboardSortBy);
        } else {
          console.log('🚀 Control change loaded INSTANTLY from cache!');
          console.log(`🎯 Current modelScores count: ${modelScores.length}`);
        }
      });
    }
  }, [leaderboardPeriod, leaderboardSortBy]);

  // Effect for analytics controls changes - BYPASS CACHE for Model Intelligence Center
  useEffect(() => {
    if (!loading) {
      console.log(`🔄 User changed analytics to ${analyticsPeriod}, calling analytics APIs directly...`);
      // ALWAYS call analytics APIs directly for accurate real-time data
      fetchAnalyticsData(analyticsPeriod, leaderboardSortBy);
    }
  }, [analyticsPeriod]);

  // Initialize current time on client to avoid hydration mismatch
  useEffect(() => {
    setCurrentTime(new Date());
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000); // Update every 15 seconds for dynamic feel
    return () => clearInterval(timer);
  }, []);

  // Check for welcome popup on first visit and load preferences
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('stupidmeter-welcome-seen');
    const hasConsentPreference = localStorage.getItem('gdpr-consent');

    if (!hasSeenWelcome) {
      setShowWelcomePopup(true); // Full popup for brand new users
    } else if (!hasConsentPreference) {
      setShowWelcomePopup(true);   // Just privacy step for returning users
      setWelcomeStep('privacy');   // Skip straight to consent question
    }
    
    // Load stupid meter mode preference
    const savedMode = localStorage.getItem('stupidmeter-mode');
    if (savedMode === 'stupid') {
      setStupidMeterMode('stupid');
    }
  }, []);

  // Handle welcome popup steps
  const handleWelcomeStep = (step: 'updates' | 'privacy' | 'completed') => {
    setWelcomeStep(step);
  };

  const updateGoogleConsent = (accepted: boolean) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        'analytics_storage': accepted ? 'granted' : 'denied',
        'ad_storage': accepted ? 'granted' : 'denied',
        'functionality_storage': accepted ? 'granted' : 'denied',
        'personalization_storage': accepted ? 'granted' : 'denied',
      });
    }
  };

  const handleAcceptAnalytics = () => {
    localStorage.setItem('gdpr-consent', 'accepted');
    updateGoogleConsent(true);
    setWelcomeStep('completed');
  };

  const handleDeclineAnalytics = () => {
    localStorage.setItem('gdpr-consent', 'declined');
    updateGoogleConsent(false);
    setWelcomeStep('completed');
  };

  const handleCompleteWelcome = () => {
    localStorage.setItem('stupidmeter-welcome-seen', 'true');
    setShowWelcomePopup(false);
    setWelcomeStep('updates'); // Reset for next time
  };

  // Generate ticker content immediately when any data becomes available
  useEffect(() => {
    generateTickerContent();
  }, [modelScores, degradations, recommendations, alerts, globalIndex]);

  // Remove the 60-second forced regeneration - it's the main reset culprit
  // generateTickerContent() is already called whenever data changes, which is enough

  const getProviderName = (provider: Provider): string => {
    switch (provider) {
      case 'openai': return 'OpenAI';
      case 'xai': return 'xAI';
      case 'anthropic': return 'Anthropic';
      case 'google': return 'Google';
      default: return provider;
    }
  };

  // Helper function to get compact model names for ticker
  const getCompactName = (name: string): string => {
    const nameMap: Record<string, string> = {
      'gpt-5-turbo': 'GPT-5-TURBO',
      'gpt-5': 'GPT-5',
      'o3-pro': 'O3-PRO',
      'o3-mini': 'O3-MINI',
      'o3': 'O3',
      'gpt-4o': 'GPT-4O',
      'gpt-4o-mini': 'GPT-4O-MINI',
      'claude-opus-4-1': 'CLAUDE-OPUS-4.1',
      'claude-opus-4': 'CLAUDE-OPUS-4',
      'claude-sonnet-4': 'CLAUDE-SONNET-4',
      'gemini-2.5-pro': 'GEMINI-2.5-PRO',
      'gemini-2.5-flash': 'GEMINI-2.5-FLASH',
      'gemini-2.5-flash-lite': 'GEMINI-2.5-LITE',
      'grok-4': 'GROK-4',
      'grok-code-fast-1': 'GROK-CODE-FAST'
    };
    return nameMap[name.toLowerCase()] || name.toUpperCase();
  };

  // Helper function to get model pricing (cost per 1M tokens) - Updated with latest Google AI pricing
  const getModelPricing = (modelName: string, provider: string): { input: number; output: number } => {
    const name = modelName.toLowerCase();
    const prov = provider.toLowerCase();
    
  // FIXED: Updated pricing based on latest 2025 rates from official sources (USD per 1M tokens)
  if (prov === 'openai') {
    // GPT-5 series - corrected pricing based on official OpenAI pricing
    if (name.includes('gpt-5') && name.includes('nano')) return { input: 0.05, output: 0.40 };
    if (name.includes('gpt-5') && name.includes('mini')) return { input: 0.25, output: 2.00 };
    if (name.includes('gpt-5')) return { input: 1.25, output: 10.00 }; // FIXED: Official GPT-5 pricing
    // O3 series
    if (name.includes('o3-pro')) return { input: 60, output: 240 };
    if (name.includes('o3-mini')) return { input: 3.5, output: 14 };
    if (name.includes('o3')) return { input: 15, output: 60 };
    // GPT-4 series
    if (name.includes('gpt-4o') && name.includes('mini')) return { input: 0.15, output: 0.6 };
    if (name.includes('gpt-4o')) return { input: 3.00, output: 12.00 }; // FIXED: Official GPT-4o pricing
    return { input: 3, output: 9 }; // Default OpenAI
  }
    
    if (prov === 'anthropic') {
      // Claude 4 series - corrected pricing based on official rates
      if (name.includes('opus-4')) return { input: 15, output: 75 }; // FIXED: Official pricing
      if (name.includes('sonnet-4')) return { input: 3, output: 15 }; // Standard rate (≤200K tokens)
      if (name.includes('haiku-4')) return { input: 0.25, output: 1.25 };
      // Claude 3.5 series
      if (name.includes('3-5-sonnet')) return { input: 3, output: 15 };
      if (name.includes('3-5-haiku')) return { input: 0.25, output: 1.25 };
      return { input: 3, output: 15 }; // Default Anthropic
    }
    
    if (prov === 'xai' || prov === 'x.ai') {
      // Updated with official xAI pricing
      if (name.includes('grok-3') && name.includes('mini')) return { input: 0.30, output: 0.50 };
      if (name.includes('grok-3')) return { input: 3, output: 15 }; // Grok 3 standard
      if (name.includes('grok-4-0709')) return { input: 3, output: 15 };
      if (name.includes('grok-code-fast')) return { input: 0.20, output: 1.50 };
      if (name.includes('grok-4')) return { input: 3, output: 15 }; // Default Grok 4 pricing
      return { input: 3, output: 15 }; // Default xAI
    }
    
    if (prov === 'google') {
      // Gemini 2.5 series - corrected pricing  
      if (name.includes('2.5-pro')) return { input: 1.25, output: 10.00 }; // Fixed from 5 to 10.00
      // FIXED: Corrected Gemini 2.5 Flash and Flash-Lite pricing based on latest Google AI pricing
      if (name.includes('2.5-flash-lite')) return { input: 0.10, output: 0.40 };
      if (name.includes('2.5-flash')) return { input: 0.30, output: 2.50 };
      // Gemini 1.5 series
      if (name.includes('1.5-pro')) return { input: 1.25, output: 5 };
      if (name.includes('1.5-flash')) return { input: 0.075, output: 0.3 };
      return { input: 1, output: 3 }; // Default Google
    }
    
    return { input: 2, output: 6 }; // Default fallback
  };

  // State for ticker content with fun messages - use useRef to avoid re-renders
  const [tickerContent, setTickerContent] = useState<string[]>([
    '🚀 STUPID METER INITIALIZING...',
    '🧠 MEASURING AI INTELLIGENCE DEGRADATION...',
    '📊 LOADING STUPIDITY METRICS...'
  ]);
  
  // Use ref to track ticker content to prevent unnecessary updates
  const tickerContentRef = useRef<string[]>([]);
  const lastTickerUpdateRef = useRef(0);

  // Helper function to check if ticker content is the same
  const sameTicker = (a: string[], b: string[]) =>
    a.length === b.length && a.join(' • ') === b.join(' • ');

  // Ticker update function (no throttling for instant updates)
  const setTickerIfChanged = (next: string[]) => {
    if (!sameTicker(next, tickerContentRef.current)) {
      const now = Date.now();
      lastTickerUpdateRef.current = now;
      setTickerContent(next);
      tickerContentRef.current = next;
    }
  };

  // Helper function to generate consistent ticker content using the same data as Model Intelligence Center
  const generateTickerContent = () => {
    const content: string[] = [];
    const seenMessages = new Set<string>(); // Deduplication tracker
    
    try {
      // Use the same data that's already loaded for the Model Intelligence Center
      // This ensures consistency between ticker tape and analytics
      
      // Helper function to add unique content
      const addUniqueContent = (message: string) => {
        // Create a normalized version for deduplication (remove emojis and extra spaces)
        const normalized = message.replace(/[🚨⚠️📉🚫✅🛡️⚡💰📊🏆🎯🔴🟠🟡🔵💀🤡🥇📈]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
        
        if (!seenMessages.has(normalized) && message.trim()) {
          seenMessages.add(normalized);
          content.push(message);
          return true;
        }
        return false;
      };
      
      // 1. Use degradations data (same as Model Intelligence Center) - FIXED: Proper deduplication and model name validation
      if (degradations.length > 0) {
        degradations.slice(0, 3).forEach((deg: any) => {
          // Ensure we have a valid model name
          const modelName = deg.modelName || 'UNKNOWN MODEL';
          
          // CRITICAL FIX: Only show actual degradations (dropPercentage > 0) or use the message directly
          if (deg.type === 'unstable_performance' || deg.type === 'service_disruption') {
            // For performance variance alerts, use the message directly but ensure model name is included
            let message = deg.message || '';
            if (message && !message.toLowerCase().includes(modelName.toLowerCase()) && modelName !== 'UNKNOWN MODEL') {
              message = `${getCompactName(modelName)}: ${message}`;
            }
            addUniqueContent(message);
          } else if (deg.dropPercentage > 0) {
            // For actual degradations, show the drop percentage with model name
            let message = '';
            if (deg.severity === 'critical') {
              message = `🚨 BREAKING: ${getCompactName(modelName)} just CRASHED ${deg.dropPercentage}% in 24h!`;
            } else if (deg.severity === 'major') {
              message = `⚠️ ALERT: ${getCompactName(modelName)} degraded ${deg.dropPercentage}% (${deg.currentScore} from ${deg.baselineScore})`;
            } else {
              message = `📉 ${getCompactName(modelName)} slipping: -${deg.dropPercentage}% performance`;
            }
            addUniqueContent(message);
          }
        });
      }
      
      // 2. Use recommendations data (same as Model Intelligence Center) - FIXED: Better data validation and contradiction avoidance
      if (recommendations && typeof recommendations === 'object') {
        // CRITICAL FIX: Avoid logical contradictions - don't recommend models that are in degradations
        const degradedModelNames = new Set(
          degradations
            .filter((deg: any) => deg.dropPercentage > 10 || deg.severity === 'critical' || deg.type === 'service_disruption')
            .map((deg: any) => deg.modelName?.toLowerCase())
            .filter(Boolean)
        );
        
        console.log('🚫 Degraded models to exclude from recommendations:', Array.from(degradedModelNames));
        
        // Avoid Now recommendations (consistent with Model Intelligence Center)
        if (recommendations.avoidNow && Array.isArray(recommendations.avoidNow) && recommendations.avoidNow.length > 0) {
          recommendations.avoidNow.slice(0, 2).forEach((model: any) => {
            if (model && model.name) {
              const message = `🚫 AVOID: ${getCompactName(model.name)} - ${model.reason || 'Poor performance detected'}`;
              addUniqueContent(message);
            }
          });
        }
        
        // Best recommendations (consistent with Model Intelligence Center) - FIXED: Avoid contradictions
        if (recommendations.bestForCode && recommendations.bestForCode.name) {
          const best = recommendations.bestForCode;
          const bestNameLower = best.name.toLowerCase();
          
          // CRITICAL: Don't recommend a model that's currently seriously degraded
          if (!degradedModelNames.has(bestNameLower)) {
            const accuracy = best.correctness ? `${Math.round(best.correctness)}%` : 
                            best.score ? `${Math.round(best.score)}%` : 
                            'High';
            const message = `✅ BEST FOR CODE: ${getCompactName(best.name)} (${accuracy} accuracy)`;
            addUniqueContent(message);
          }
        }
        
        if (recommendations.mostReliable && recommendations.mostReliable.name) {
          const reliable = recommendations.mostReliable;
          const reliableNameLower = reliable.name.toLowerCase();
          
          // CRITICAL: Don't recommend a model that's currently seriously degraded
          if (!degradedModelNames.has(reliableNameLower)) {
            const message = `🛡️ MOST RELIABLE: ${getCompactName(reliable.name)} - ${reliable.reason || 'Consistent performance'}`;
            addUniqueContent(message);
          }
        }
        
        if (recommendations.fastestResponse && recommendations.fastestResponse.name) {
          const fastest = recommendations.fastestResponse;
          const fastestNameLower = fastest.name.toLowerCase();
          
          // CRITICAL: Don't recommend a model that's currently seriously degraded
          if (!degradedModelNames.has(fastestNameLower)) {
            const message = `⚡ FASTEST: ${getCompactName(fastest.name)} - ${fastest.reason || 'Quick response time'}`;
            addUniqueContent(message);
          }
        }
      }
      
      // 3. Use model scores data (MODE-AWARE - reflects current leaderboard selection) - FIXED: Proper deduplication
      if (modelScores.length > 0) {
        const availableModels = modelScores.filter((m: any) => 
          m.currentScore !== 'unavailable' && typeof m.currentScore === 'number'
        );
        
        if (availableModels.length > 0) {
          // Sort by score (lowest = most stupid) - consistent with leaderboard logic
          const sorted = [...availableModels].sort((a: any, b: any) => a.currentScore - b.currentScore);
          
          // CONSISTENT: Use same thresholds as Model Intelligence Center (< 60 for warnings)
          const criticalModels = availableModels.filter((m: any) => m.currentScore < 60);
          
          // Show mode-specific warnings for critical models (consistent with analytics.ts) - FIXED: Use addUniqueContent
          criticalModels.slice(0, 2).forEach((model: any) => {
            let message = '';
            if (model.currentScore < 40) {
              message = `🚨 CRITICAL ${leaderboardSortBy.toUpperCase()}: ${getCompactName(model.name)} failing at ${model.currentScore} pts!`;
            } else if (model.currentScore < 50) {
              message = `⚠️ ${leaderboardSortBy.toUpperCase()} ALERT: ${getCompactName(model.name)} struggling at ${model.currentScore} pts`;
            } else if (model.currentScore < 60) {
              message = `📉 ${leaderboardSortBy.toUpperCase()} WARNING: ${getCompactName(model.name)} below average at ${model.currentScore} pts`;
            }
            if (message) addUniqueContent(message);
          });
          
          // Worst performers with stupidity awards (mode-specific) - FIXED: Use addUniqueContent
          if (sorted[0] && typeof sorted[0].currentScore === 'number' && sorted[0].currentScore < 30) {
            addUniqueContent(`🤡 ${leaderboardSortBy.toUpperCase()} STUPIDITY WINNER: ${getCompactName(sorted[0].name)} - ${sorted[0].currentScore} pts!`);
          } else if (sorted[0] && typeof sorted[0].currentScore === 'number' && sorted[0].currentScore < 40) {
            addUniqueContent(`🥇 WORST ${leaderboardSortBy.toUpperCase()}: ${getCompactName(sorted[0].name)} (${sorted[0].currentScore} pts)`);
          }
          
          // Best value models (price-to-performance) - FIXED: Don't recommend models that are flagged as problematic
          const modelsWithPricing = availableModels
            .filter((m: any) => m.currentScore >= 60) // Only consider models with decent performance for "best value"
            .map((m: any) => {
              const pricing = getModelPricing(m.name, m.provider);
              const estimatedCost = (pricing.input * 0.4) + (pricing.output * 0.6);
              return {
                ...m,
                valueScore: m.currentScore / estimatedCost,
                estimatedCost
              };
            }).sort((a: any, b: any) => b.valueScore - a.valueScore);
          
          if (modelsWithPricing[0] && modelsWithPricing[0].valueScore > 10) {
            const message = `💰 BEST VALUE: ${getCompactName(modelsWithPricing[0].name)} - ${modelsWithPricing[0].currentScore} pts for $${modelsWithPricing[0].estimatedCost.toFixed(2)}/1M tokens`;
            addUniqueContent(message);
          }
          
          // Most expensive disasters - FIXED: Use addUniqueContent
          const expensiveWorst = modelsWithPricing.filter(m => m.currentScore < 60 && m.estimatedCost > 20);
          if (expensiveWorst.length > 0) {
            const worst = expensiveWorst[0];
            const message = `💸 EXPENSIVE DISASTER: ${getCompactName(worst.name)} charges $${worst.estimatedCost.toFixed(0)}/1M for ${worst.currentScore} pts performance!`;
            addUniqueContent(message);
          }
          
          // Best performers (consistent with actual rankings) - FIXED: Use addUniqueContent
          const bestModels = sorted.slice(-3).reverse(); // Top 3 performers
          if (bestModels[0] && typeof bestModels[0].currentScore === 'number' && bestModels[0].currentScore >= 70) {
            addUniqueContent(`🏆 ACTUALLY SMART: ${getCompactName(bestModels[0].name)} leading at ${bestModels[0].currentScore} pts`);
          }
          
          // Trending analysis (consistent with model data) - FIXED: Use addUniqueContent and limit messages
          const improving = availableModels.filter((m: any) => m.trend === 'up');
          const declining = availableModels.filter((m: any) => m.trend === 'down');
          
          if (improving.length > 0) {
            addUniqueContent(`📈 RECOVERING: ${improving.length} models getting smarter (finally!)`);
            if (improving[0]) {
              addUniqueContent(`🎉 MIRACLE: ${getCompactName(improving[0].name)} actually improved today!`);
            }
          }
          
          if (declining.length > 0) {
            addUniqueContent(`📉 TRENDING STUPID: ${declining.length} models losing brain cells`);
          }
          
          // Provider trends (consistent with actual provider performance) - FIXED: Use addUniqueContent
          const openaiModels = availableModels.filter((m: any) => m.provider === 'openai' && m.trend === 'down');
          const anthropicModels = availableModels.filter((m: any) => m.provider === 'anthropic' && m.trend === 'down');
          const xaiModels = availableModels.filter((m: any) => m.provider === 'xai' && m.trend === 'down');
          const googleModels = availableModels.filter((m: any) => m.provider === 'google' && m.trend === 'down');
          
          if (openaiModels.length >= 2) {
            addUniqueContent(`🔴 OpenAI ALERT: Multiple models degrading simultaneously!`);
          }
          if (anthropicModels.length >= 2) {
            addUniqueContent(`🟠 Anthropic WARNING: Performance issues detected across models`);
          }
          if (xaiModels.length >= 1) {
            addUniqueContent(`🟡 xAI NOTICE: Grok models showing performance variations`);
          }
          if (googleModels.length >= 2) {
            addUniqueContent(`🔵 Google ALERT: Gemini models experiencing issues`);
          }
          
          // Critical count (consistent with Model Intelligence Center - under 60 is concerning) - FIXED: Use addUniqueContent
          const concerningCount = availableModels.filter((m: any) => m.currentScore < 60).length;
          const criticalCount = availableModels.filter((m: any) => m.currentScore < 40).length;
          
          if (criticalCount > 3) {
            addUniqueContent(`💀 APOCALYPSE: ${criticalCount} models currently failing basic intelligence tests!`);
          } else if (concerningCount > 5) {
            addUniqueContent(`⚠️ ${concerningCount} models performing below average (under 60 points)`);
          } else if (criticalCount > 0) {
            addUniqueContent(`🚨 ${criticalCount} models in critical performance range (under 40 points)`);
          }
        }
      }
      
      // 4. Use alerts data only if they match current poor performance
      if (alerts.length > 0 && modelScores.length > 0) {
        const availableModels = modelScores.filter((m: any) => 
          m.currentScore !== 'unavailable' && typeof m.currentScore === 'number'
        );
        
        alerts.slice(0, 2).forEach((alert: any) => {
          // Find the corresponding model in current scores
          const currentModel = availableModels.find((m: any) => 
            m.name.toLowerCase() === alert.name.toLowerCase() || 
            m.id === alert.modelId
          );
          
          // CONSISTENT: Only show alert if model performs poorly (≤ 55, same as analytics "Avoid Now")
          if (currentModel && typeof currentModel.currentScore === 'number' && currentModel.currentScore <= 55) {
            if (alert.severity === 'critical') {
              content.push(`💀 CRITICAL: ${getCompactName(alert.name)} - ${alert.issue}`);
            } else {
              content.push(`⚠️ WARNING: ${getCompactName(alert.name)} showing signs of stupidity`);
            }
          }
        });
      }
      
      // 5. Global index information (consistent with 24-hour AI Stupidity Index)
      if (globalIndex) {
        const score = globalIndex.current.globalScore;
        if (score < 50) {
          content.push(`🌡️ GLOBAL STUPIDITY INDEX: ${score}/100 - AI intelligence at concerning levels`);
        } else if (score >= 70) {
          content.push(`🌡️ GLOBAL STUPIDITY INDEX: ${score}/100 - AI models performing well today`);
        } else {
          content.push(`🌡️ GLOBAL STUPIDITY INDEX: ${score}/100 - Mixed AI performance across models`);
        }
        
        if (globalIndex.trend === 'declining') {
          content.push(`📉 TREND ALERT: Global AI intelligence declining over past 24 hours`);
        } else if (globalIndex.trend === 'improving') {
          content.push(`📈 GOOD NEWS: Global AI intelligence improving over past 24 hours`);
        }
      }
      
      // 6. Remove time-based countdown - it changes every minute and causes resets
      // The countdown is already shown in the footer, no need to duplicate it here
      
      // 7. Add some contextual fun facts only if we have real data
      if (content.length > 3) {
        const contextualFacts = [
          `🔬 Lab Report: Intelligence monitoring active across ${modelScores.length} AI models`,
          `📊 Real-time analysis: Tracking performance degradation patterns`,
          `🎯 Detection system: Identifying capability reductions in real-time`,
          `🛡️ Quality assurance: Protecting users from degraded AI performance`
        ];
        
        // Use deterministic selection based on current hour to avoid random changes
        const currentHour = new Date().getHours();
        const factIndex = currentHour % contextualFacts.length;
        content.push(contextualFacts[factIndex]);
      }
      
      // Only update ticker content if it actually changed (using throttled version)
      if (content.length > 0) {
        setTickerIfChanged(content);
      } else if (modelScores.length > 0) {
        // Generate basic content from model scores if other data isn't available yet
        const basicContent = [];
        const availableModels = modelScores.filter((m: any) => 
          m.currentScore !== 'unavailable' && typeof m.currentScore === 'number'
        );
        
        if (availableModels.length > 0) {
          const sorted = [...availableModels].sort((a: any, b: any) => b.currentScore - a.currentScore);
          basicContent.push(`🏆 TOP PERFORMER: ${getCompactName(sorted[0].name)} leading at ${sorted[0].currentScore} pts`);
          
          if (sorted.length > 1) {
            basicContent.push(`📊 ${availableModels.length} models currently monitored and ranked`);
          }
          
          const concerningCount = availableModels.filter((m: any) => m.currentScore < 60).length;
          const criticalCount = availableModels.filter((m: any) => m.currentScore < 40).length;
          
          if (criticalCount > 0) {
            basicContent.push(`🚨 ${criticalCount} models in critical performance range (under 40 pts)`);
          } else if (concerningCount > 0) {
            basicContent.push(`⚠️ ${concerningCount} models performing below average (under 60 pts)`);
          }
          
          basicContent.push(`🔬 Real-time intelligence monitoring active`);
        }
        
        if (basicContent.length > 0) {
          setTickerIfChanged(basicContent);
        } else {
          const fallbackContent = [
            '🚀 STUPID METER INITIALIZING...',
            '🧠 MEASURING AI INTELLIGENCE DEGRADATION...',
            '📊 LOADING STUPIDITY METRICS...',
            '🔄 SYNCHRONIZING WITH MODEL INTELLIGENCE CENTER...'
          ];
          setTickerIfChanged(fallbackContent);
        }
      } else {
        // Fallback when no data is available yet
        const fallbackContent = [
          '🚀 STUPID METER INITIALIZING...',
          '🧠 MEASURING AI INTELLIGENCE DEGRADATION...',
          '📊 LOADING STUPIDITY METRICS...',
          '🔄 SYNCHRONIZING WITH MODEL INTELLIGENCE CENTER...'
        ];
        setTickerIfChanged(fallbackContent);
      }
      
    } catch (error) {
      console.error('Error generating ticker content:', error);
      // Fallback to loading state (using throttled version)
      const fallbackContent = [
        '🚀 STUPID METER INITIALIZING...',
        '🧠 MEASURING AI INTELLIGENCE DEGRADATION...',
        '📊 LOADING STUPIDITY METRICS...'
      ];
      setTickerIfChanged(fallbackContent);
    }
  };

  // Helper function to get color class based on score
  const getScoreColorClass = (score: number): string => {
    if (score >= 75) return 'terminal-text--green';
    if (score >= 50) return 'terminal-text--green'; // Use green for mid-range scores too
    return 'terminal-text--red';
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

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'up': return '↗';
      case 'down': return '↘';
      case 'stable': return '→';
      default: return '—';
    }
  };

  const calculateTrendPercentage = (model: any): number => {
    if (!model.history || model.history.length < 2) return 0;

    const recentDisplay = toDisplayScore(model.history[0]) ?? toDisplayScore({ currentScore: model.currentScore });
    const previousDisplay = toDisplayScore(model.history[model.history.length - 1]);

    if (
      typeof recentDisplay !== 'number' ||
      typeof previousDisplay !== 'number' ||
      previousDisplay === 0
    ) return 0;

    return Math.round(((recentDisplay - previousDisplay) / previousDisplay) * 100);
  };

  // Helper function to get dynamic column header
  const getDynamicColumnHeader = (): string => {
    switch (leaderboardSortBy) {
      case 'price': return 'PRICE';
      case 'reasoning': return 'REASONING';
      case 'speed': return '7AXIS';
      case 'combined':
      default: return 'SCORE';
    }
  };

  const scoreColorClass = (score: number) =>
    score >= 80 ? 'terminal-text--green' :
    score >= 60 ? 'terminal-text--amber' :
    'terminal-text--red';

  // Helper function to render dynamic metric display with rich information
  const renderDynamicMetric = (model: any): JSX.Element => {
    // AGGRESSIVE DEBUG: Log what renderDynamicMetric actually sees
    console.log(`🔧 renderDynamicMetric for ${model.name}:`, {
      currentScore: model.currentScore,
      typeof: typeof model.currentScore,
      _period: (model as any)._period,
      _sortBy: (model as any)._sortBy,
      wholeModel: model
    });
    
    // FORCE React to recognize this as a new component every time with unique randomization
    const forceRenderKey = `${model.id}_${model.currentScore}_${(model as any)._period}_${Date.now()}_${Math.random()}`;
    
    if (model.currentScore === 'unavailable') {
      return (
        <div key={forceRenderKey} className="score-display terminal-text--dim">
          <div style={{ textAlign: 'center' }}>
            <div>N/A</div>
            <div style={{ fontSize: '0.6em', opacity: 0.7 }}>OFFLINE</div>
          </div>
        </div>
      );
    }

    // Show pricing information when price sorting is selected
    if (leaderboardSortBy === 'price') {
      const score = model.currentScore as number;
      const pricing = getModelPricing(model.name, model.provider);
      const estimatedCost = (pricing.input * 0.4) + (pricing.output * 0.6);
      const valueScore = score > 0 ? (score / estimatedCost).toFixed(1) : '0.0';
      
      return (
        <div className="score-display">
          <div style={{ textAlign: 'center', fontSize: '0.65em', lineHeight: '1.2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px' }}>
              <span className="terminal-text--dim">In:</span>
              <span className="terminal-text">${pricing.input}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px' }}>
              <span className="terminal-text--dim">Out:</span>
              <span className="terminal-text">${pricing.output}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', borderTop: '1px solid rgba(0,255,65,0.3)', paddingTop: '1px' }}>
              <span className="terminal-text--dim">Est:</span>
              <span className="terminal-text--amber">${estimatedCost.toFixed(2)}</span>
            </div>
            <div style={{ fontSize: '0.9em' }}>
              <span className={valueScore > '10' ? 'terminal-text--green' : valueScore > '5' ? 'terminal-text--amber' : 'terminal-text--red'}>
                {valueScore} pts/$
              </span>
            </div>
          </div>
        </div>
      );
    }

    // Default score display for other sorting modes
    const score = model.currentScore as number;
    let tier = 'POOR';
    let tierIcon = '⚠';
    
    if (score >= 85) {
      tier = 'ELITE';
      tierIcon = '⭐';
    } else if (score >= 75) {
      tier = 'STRONG';
      tierIcon = '✓';
    } else if (score >= 60) {
      tier = 'GOOD';
      tierIcon = '○';
    } else if (score >= 45) {
      tier = 'FAIR';
      tierIcon = '△';
    }
    
    return (
      <div key={forceRenderKey} className={`score-display ${scoreColorClass(score)}`}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'center', marginBottom: '1px' }}>
            <span style={{ fontSize: '0.8em' }}>{tierIcon}</span>
            <span style={{ fontSize: '1.1em', fontWeight: 'bold' }}>{score}</span>
          </div>
          <div style={{ fontSize: '0.6em', opacity: 0.8 }}>{tier}</div>
        </div>
      </div>
    );
  };

  const formatTimeAgo = (date: Date): string => {
    if (!currentTime) return 'loading...';
    const minutes = Math.floor((currentTime.getTime() - date.getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) {
      if (remainingMinutes === 0) return `${hours}h ago`;
      return `${hours}h ${remainingMinutes}m ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const loadUserModels = async () => {
    if (!userApiKey.trim()) return;
    
    setLoadingUserModels(true);
    try {
      const response = await fetch(`https://aistupidlevel.info/benchmark/models/${userProvider}`, {
        headers: {
          'Authorization': `Bearer ${userApiKey}`
        }
      });
      const data = await response.json();
      if (data.models) {
        setUserModels(data.models);
        setSelectedUserModel(data.models[0] || '');
      } else {
        // Fallback models
        const fallbacks = getFallbacks(userProvider);
        setUserModels(fallbacks);
        setSelectedUserModel(fallbacks[0] || '');
      }
    } catch (error) {
      const fallbacks = getFallbacks(userProvider);
      setUserModels(fallbacks);
      setSelectedUserModel(fallbacks[0] || '');
    }
    setLoadingUserModels(false);
  };

  const getFallbacks = (provider: Provider): string[] => {
    switch (provider) {
      case 'xai': return ['grok-4', 'grok-code-fast-1'];
      case 'openai': return ['o3', 'o3-pro', 'o3-mini', 'o4-mini', 'gpt-4o', 'gpt-4o-mini'];
      case 'anthropic': return ['claude-opus-4-1', 'claude-opus-4', 'claude-sonnet-4'];
      case 'google': return ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
      default: return [];
    }
  };

  const handleRunBenchmarkClick = () => {
    if (!userApiKey.trim()) {
      alert('Please enter your API key');
      return;
    }
    if (!selectedUserModel) {
      alert('Please select a model');
      return;
    }
    
    // Show consent modal
    setShowConsentModal(true);
  };

  const runUserBenchmark = async () => {
    // Close consent modal
    setShowConsentModal(false);
    
    // Validate API key format matches provider
    const keyValidation = validateApiKey(userApiKey, userProvider);
    if (!keyValidation.valid) {
      setTestLogs([`❌ Invalid API key format for ${getProviderName(userProvider)}`, keyValidation.message]);
      setUserBenchmarkResult({
        success: false,
        error: keyValidation.message
      });
      return;
    }
    
    setLoadingUserBenchmark(true);
    setUserBenchmarkResult(null);
    setTestLogs([]); // Clear previous logs
    
    // Add initial log
    setTestLogs(['🚀 Starting streaming benchmark test...', `📊 Testing ${selectedUserModel.toUpperCase()} from ${getProviderName(userProvider)}`]);

    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
      
      // First, start the streaming benchmark
      const response = await fetch(`${apiUrl}/api/test-adapters/benchmark-test-stream`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-api-key': userApiKey
        },
        body: JSON.stringify({
          provider: userProvider,
          model: selectedUserModel
        })
      });

      const startResult = await response.json();
      
      if (!response.ok) {
        throw new Error(startResult.error || 'Failed to start benchmark');
      }

      const { sessionId } = startResult;
      setTestLogs(prev => [...prev, `📡 Connected to streaming session: ${sessionId.substring(0, 8)}...`]);

      // Connect to the streaming endpoint
      const eventSource = new EventSource(`${apiUrl}/api/test-adapters/benchmark-stream/${sessionId}`);
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Add log message
          if (data.message) {
            setTestLogs(prev => [...prev, data.message]);
          }
          
          // Handle completion
          if (data.type === 'complete' && data.data) {
            setUserBenchmarkResult(data.data);
            setTestLogs(prev => [...prev, '🎉 Streaming benchmark completed successfully!']);
            eventSource.close();
            setLoadingUserBenchmark(false);
          } else if (data.type === 'error') {
            setUserBenchmarkResult({
              success: false,
              error: data.message || 'Streaming benchmark failed'
            });
            setTestLogs(prev => [...prev, `❌ Error: ${data.message}`]);
            eventSource.close();
            setLoadingUserBenchmark(false);
          }
        } catch (parseError) {
          console.error('Error parsing streaming data:', parseError);
          setTestLogs(prev => [...prev, `⚠️ Received malformed data: ${event.data.substring(0, 100)}...`]);
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        setTestLogs(prev => [...prev, '❌ Connection error - switching to non-streaming mode']);
        eventSource.close();
        
        // Fallback to regular benchmark endpoint
        fallbackToRegularBenchmark();
      };

      eventSource.onopen = () => {
        setTestLogs(prev => [...prev, '✅ Real-time streaming connected']);
      };

      // Cleanup function to close EventSource if component unmounts
      const cleanup = () => {
        eventSource.close();
        setLoadingUserBenchmark(false);
      };

      // Set timeout for safety (5 minutes max)
      const timeout = setTimeout(() => {
        setTestLogs(prev => [...prev, '⏰ Benchmark taking longer than expected, continuing...']);
      }, 5 * 60 * 1000);

      // Store cleanup function for potential use
      (window as any).benchmarkCleanup = () => {
        clearTimeout(timeout);
        cleanup();
      };

    } catch (error: any) {
      console.error('Streaming benchmark error:', error);
      setTestLogs(prev => [...prev, `❌ Streaming failed: ${error.message}`, '🔄 Falling back to regular benchmark...']);
      
      // Fallback to regular benchmark
      await fallbackToRegularBenchmark();
    }
  };

  // Fallback function for when streaming fails
  const fallbackToRegularBenchmark = async () => {
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/test-adapters/benchmark-test`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-api-key': userApiKey
        },
        body: JSON.stringify({
          provider: userProvider,
          model: selectedUserModel
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setUserBenchmarkResult(result);
        setTestLogs(prev => [...prev, '✅ Non-streaming benchmark completed']);
      } else {
        setUserBenchmarkResult({
          success: false,
          error: result.error || 'Benchmark failed'
        });
        setTestLogs(prev => [...prev, `❌ Error: ${result.error || 'Benchmark failed'}`]);
      }
    } catch (error: any) {
      setUserBenchmarkResult({
        success: false,
        error: error.message || 'Network error'
      });
      setTestLogs(prev => [...prev, `❌ Fallback error: ${error.message || 'Network error'}`]);
    } finally {
      setLoadingUserBenchmark(false);
    }
  };

  // API Key validation function
  const validateApiKey = (key: string, provider: Provider): { valid: boolean; message: string } => {
    if (!key || key.trim().length === 0) {
      return { valid: false, message: 'API key is required' };
    }

    const trimmedKey = key.trim();
    
    switch (provider) {
      case 'openai':
        if (!trimmedKey.startsWith('sk-') && !trimmedKey.startsWith('sess-')) {
          return { 
            valid: false, 
            message: 'OpenAI keys should start with "sk-" or "sess-". Please check your key.' 
          };
        }
        break;
      
      case 'anthropic':
        if (!trimmedKey.startsWith('sk-ant-')) {
          return { 
            valid: false, 
            message: 'Anthropic keys should start with "sk-ant-". You may have entered a key for a different provider.' 
          };
        }
        break;
      
      case 'xai':
        // xAI keys don't have a consistent prefix pattern yet, so we'll be lenient
        if (trimmedKey.startsWith('sk-ant-') || trimmedKey.startsWith('AIza')) {
          return { 
            valid: false, 
            message: 'This appears to be a key for a different provider. Please enter your xAI key.' 
          };
        }
        break;
      
      case 'google':
        if (!trimmedKey.startsWith('AIza')) {
          return { 
            valid: false, 
            message: 'Google/Gemini keys should start with "AIza". Please check your key.' 
          };
        }
        break;
    }

    // Basic length validation
    if (trimmedKey.length < 20) {
      return { valid: false, message: 'API key seems too short. Please check if you copied the complete key.' };
    }

    return { valid: true, message: 'Key format valid' };
  };

  const getApiKeyPlaceholder = (provider: Provider) => {
    switch (provider) {
      case 'xai': return 'sk-xai-...';
      case 'openai': return 'sk-proj-... or sk-...';
      case 'anthropic': return 'sk-ant-api03-...';
      case 'google': return 'AIza...';
      default: return 'Enter API key';
    }
  };

  const getButtonClassName = (targetView: string) => {
    return selectedView === targetView ? 'vintage-btn vintage-btn--active' : 'vintage-btn';
  };

  if (selectedView === 'test') {
    return (
      <div className="vintage-container">
        {/* Header */}
        <div className="crt-monitor">
          <div className="terminal-text">
            <div style={{ fontSize: '1.5em', marginBottom: '16px' }}>
              <span className="terminal-text--amber">TEST YOUR API KEYS</span>
              <span className="blinking-cursor"></span>
            </div>
            <div className="terminal-text--dim">
              Test your own AI models against our reference benchmarks
            </div>
          </div>
        </div>

        {/* User Testing Controls */}
        <div className="control-panel">
          <div>
            <div className="terminal-text" style={{ marginBottom: '8px' }}>
              PROVIDER SELECT:
            </div>
            <select
              value={userProvider}
              onChange={(e) => {
                setUserProvider(e.target.value as Provider);
                setUserModels([]);
                setSelectedUserModel('');
              }}
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--terminal-black)',
                border: '1px solid var(--metal-silver)',
                borderRadius: '4px',
                color: 'var(--phosphor-green)',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px'
              }}
            >
              <option value="openai">OPENAI</option>
              <option value="xai">X.AI (GROK)</option>
              <option value="anthropic">ANTHROPIC (CLAUDE)</option>
              <option value="google">GOOGLE (GEMINI)</option>
            </select>
            <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginTop: '4px' }}>
              {getProviderName(userProvider)}
            </div>
          </div>

          <div>
            <div className="terminal-text" style={{ marginBottom: '8px' }}>
              YOUR API KEY:
            </div>
            <input
              type="password"
              value={userApiKey}
              onChange={(e) => setUserApiKey(e.target.value)}
              onBlur={() => userApiKey.trim() && loadUserModels()}
              placeholder={getApiKeyPlaceholder(userProvider)}
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--terminal-black)',
                border: '1px solid var(--metal-silver)',
                borderRadius: '4px',
                color: 'var(--phosphor-green)',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px'
              }}
            />
            <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginTop: '4px' }}>
              Your key is only used for this test - not stored
            </div>
          </div>

          <div>
            <div className="terminal-text" style={{ marginBottom: '8px' }}>
              MODEL SELECTION:
            </div>
            <select
              value={selectedUserModel}
              onChange={(e) => setSelectedUserModel(e.target.value)}
              disabled={userModels.length === 0 || loadingUserModels}
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--terminal-black)',
                border: '1px solid var(--metal-silver)',
                borderRadius: '4px',
                color: 'var(--phosphor-green)',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px'
              }}
            >
              {loadingUserModels ? (
                <option>SCANNING MODELS...</option>
              ) : userModels.length === 0 ? (
                <option>ENTER API KEY FIRST</option>
              ) : (
                userModels.map(model => (
                  <option key={model} value={model}>{model.toUpperCase()}</option>
                ))
              )}
            </select>
            {userApiKey.trim() && (
              <button 
                onClick={loadUserModels} 
                className="vintage-btn" 
                style={{ marginTop: '8px', fontSize: '0.8em', padding: '4px 8px' }}
                disabled={loadingUserModels}
              >
                {loadingUserModels ? 'SCANNING...' : 'REFRESH MODELS'}
              </button>
            )}
          </div>
        </div>

        {/* Run Button */}
        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <button
            onClick={handleRunBenchmarkClick}
            disabled={loadingUserBenchmark || !userApiKey.trim() || !selectedUserModel}
            className={`vintage-btn ${loadingUserBenchmark ? 'vintage-btn--warning' : ''}`}
            style={{ padding: '16px 32px', fontSize: '1.1em' }}
          >
            {loadingUserBenchmark ? (
              <>TESTING YOUR MODEL<span className="vintage-loading"></span></>
            ) : (
              'RUN INTELLIGENCE TEST'
            )}
          </button>
        </div>

        {/* Consent Modal */}
        {showConsentModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div className="crt-monitor" style={{
              maxWidth: '500px',
              width: '90%',
              padding: '24px',
              backgroundColor: 'var(--terminal-black)',
              border: '2px solid var(--phosphor-green)'
            }}>
              <div className="terminal-text">
                <div style={{ fontSize: '1.2em', marginBottom: '16px', textAlign: 'center' }}>
                  <span className="terminal-text--amber">⚠️ PRIVACY NOTICE</span>
                </div>
                
                <div style={{ marginBottom: '20px', lineHeight: '1.6' }}>
                  <div className="terminal-text--green" style={{ marginBottom: '12px' }}>
                    🔐 Your Privacy is Protected:
                  </div>
                  <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
                    <li className="terminal-text--dim" style={{ marginBottom: '8px' }}>
                      ✓ Your API key is <span className="terminal-text--green">NEVER stored</span> - used only for this test session
                    </li>
                    <li className="terminal-text--dim" style={{ marginBottom: '8px' }}>
                      ✓ Test results <span className="terminal-text--amber">will be saved</span> to our database
                    </li>
                    <li className="terminal-text--dim" style={{ marginBottom: '8px' }}>
                      ✓ Your score becomes the <span className="terminal-text--amber">latest reference</span> for this model
                    </li>
                    <li className="terminal-text--dim">
                      ✓ Results <span className="terminal-text--amber">will appear</span> in live rankings
                    </li>
                  </ul>
                  
                  <div className="terminal-text--dim" style={{ fontSize: '0.9em', fontStyle: 'italic' }}>
                    By proceeding, you help improve our detection accuracy and contribute to the community's understanding of AI model performance.
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button 
                    onClick={runUserBenchmark}
                    className="vintage-btn vintage-btn--active"
                    style={{ padding: '8px 24px' }}
                  >
                    ACCEPT & RUN TEST
                  </button>
                  <button 
                    onClick={() => setShowConsentModal(false)}
                    className="vintage-btn"
                    style={{ padding: '8px 24px' }}
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Test Logs */}
        {testLogs.length > 0 && (
          <div className="crt-monitor" style={{ marginTop: '20px' }}>
            <div className="terminal-text">
              <div style={{ fontSize: '1.1em', marginBottom: '12px' }}>
                <span className="terminal-text--green">📝 LIVE TEST LOGS</span>
              </div>
              <div style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                padding: '12px',
                borderRadius: '4px',
                maxHeight: '300px',
                overflowY: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85em',
                lineHeight: '1.5'
              }}>
                {testLogs.map((log, index) => (
                  <div key={index} className="terminal-text--dim" style={{ marginBottom: '4px' }}>
                    <span className="terminal-text--green">[{new Date().toLocaleTimeString()}]</span> {log}
                  </div>
                ))}
                {loadingUserBenchmark && (
                  <div className="terminal-text--amber">
                    <span className="blinking-cursor">█</span> Processing...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results Display */}
        {userBenchmarkResult && (
          <>
            {/* Main Results Grid */}
            <div className="vintage-grid">
              {/* Gauge Monitor */}
              <div className="crt-monitor">
                <div className="terminal-text" style={{ marginBottom: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2em' }}>YOUR MODEL RESULTS</div>
                  <div style={{ fontSize: '0.8em', opacity: 0.8 }}>
                    {selectedUserModel.toUpperCase()}
                  </div>
                </div>
                
                {userBenchmarkResult.success ? (
                  <div className="vintage-gauge">
                    <div className="gauge-face">
                      <div className={`gauge-value ${
                        userBenchmarkResult.performance?.displayScore < 40 ? 'terminal-text--red' : 
                        userBenchmarkResult.performance?.displayScore < 60 ? 'terminal-text--amber' : 'terminal-text--green'
                      }`}>
                        {userBenchmarkResult.performance?.displayScore || 0}
                      </div>
                      <div className="gauge-label terminal-text--dim">
                        SCORE
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="vintage-gauge">
                    <div className="gauge-face">
                      <div className="gauge-value terminal-text--red">ERR</div>
                      <div className="gauge-label terminal-text--dim">FAILED</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Test Summary */}
              <div className="printer-paper">
                <div className="dot-matrix-text" style={{ borderBottom: '1px dashed #ccc', paddingBottom: '8px', marginBottom: '8px' }}>
                  ═══ TEST SUMMARY ═══
                </div>
                
                {userBenchmarkResult.success && userBenchmarkResult.performance ? (
                  <div className="dot-matrix-text" style={{ fontSize: '11px', lineHeight: '1.3' }}>
                    TIMESTAMP: {userBenchmarkResult.timestamp}<br/>
                    MODEL: {selectedUserModel}<br/>
                    PROVIDER: {userProvider.toUpperCase()}<br/>
                    ─────────────────────────<br/>
                    AVG LATENCY: {userBenchmarkResult.metrics?.avgLatency}MS<br/>
                    TOKENS OUT: {userBenchmarkResult.metrics?.totalTokensOut}<br/>
                    TESTS RUN: {userBenchmarkResult.metrics?.testsRun}<br/>
                    ─────────────────────────<br/>
                    COMPOSITE SCORE: {userBenchmarkResult.performance.displayScore}/100<br/>
                    STUPID SCORE: {userBenchmarkResult.performance.stupidScore}<br/>
                    PERFORMANCE: {
                      userBenchmarkResult.performance.displayScore >= 80 ? 'EXCELLENT' : 
                      userBenchmarkResult.performance.displayScore >= 60 ? 'GOOD' :
                      userBenchmarkResult.performance.displayScore >= 40 ? 'FAIR' : 'NEEDS IMPROVEMENT'
                    }<br/>
                    ─────────────────────────<br/>
                    REFUSAL RATE: {userBenchmarkResult.metrics?.refusalRate}<br/>
                    RECOVERY RATE: {userBenchmarkResult.metrics?.recoveryRate}
                  </div>
                ) : (
                  <div className="dot-matrix-text terminal-text--red">
                    ERROR: {userBenchmarkResult.error}<br/>
                    STATUS: FAILED<br/>
                    TIMESTAMP: {new Date().toLocaleString()}<br/>
                    ─────────────────────────<br/>
                    Please check your API key<br/>
                    and model selection.<br/>
                    Make sure you have access to<br/>
                    the selected model.
                  </div>
                )}
              </div>
            </div>

            {/* 7-Axis Breakdown - Separate CRT Monitor */}
            {userBenchmarkResult.success && userBenchmarkResult.performance && (
              <div className="crt-monitor">
                <div className="terminal-text" style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '1.2em', marginBottom: '8px' }}>
                    🎯 7-AXIS BREAKDOWN
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
                    Latest performance across all metrics
                  </div>
                </div>

                <div className="terminal-text" style={{ fontSize: '0.9em' }}>
                  {(() => {
                    const axes = userBenchmarkResult.performance.axes;
                    const axisOrder = [
                      { key: 'correctness', label: 'CORRECTNESS' },
                      { key: 'spec', label: 'SPEC COMPLIANCE' },
                      { key: 'codeQuality', label: 'CODE QUALITY' },
                      { key: 'efficiency', label: 'EFFICIENCY' },
                      { key: 'stability', label: 'STABILITY' },
                      { key: 'refusal', label: 'REFUSAL RATE' },
                      { key: 'recovery', label: 'RECOVERY' }
                    ];

                    return axisOrder.map(axis => {
                      const value = axes[axis.key] || 0;
                      const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                      
                      return (
                        <div key={axis.key} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{axis.label}:</span>
                          <span>
                            <span className={numericValue >= 80 ? 'terminal-text--green' : numericValue >= 60 ? 'terminal-text--amber' : 'terminal-text--red'}>
                              {numericValue.toFixed(0)}%
                            </span>
                            <span style={{ marginLeft: '8px' }}>
                              {(() => {
                                const filledBars = Math.floor(numericValue / 10);
                                const emptyBars = 10 - filledBars;
                                return '█'.repeat(Math.max(0, filledBars)) + '░'.repeat(Math.max(0, emptyBars));
                              })()}
                            </span>
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </>
        )}

        {/* Back Button */}
        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <button 
            onClick={() => setSelectedView('dashboard')}
            className="vintage-btn"
          >
            BACK TO DASHBOARD
          </button>
        </div>
      </div>
    );
  }

  if (selectedView === 'about') {
    return (
      <div className="vintage-container">
        <div className="crt-monitor">
          <div className="terminal-text">
            <div style={{ fontSize: '1.5em', marginBottom: '16px' }}>
              <span className="terminal-text--green">ABOUT STUPID METER</span>
              <span className="blinking-cursor"></span>
            </div>
            <div className="terminal-text--dim" style={{ lineHeight: '1.6', fontSize: '0.9em' }}>
              <div className="terminal-text--amber" style={{ fontSize: '1.2em', marginBottom: '12px', textAlign: 'center' }}>
                🚨 LATEST UPDATE: TOOL CALLING + INTELLIGENCE CENTER REVOLUTION
              </div>
              <div style={{ 
                padding: '12px', 
                backgroundColor: 'rgba(0, 255, 65, 0.1)', 
                border: '1px solid rgba(0, 255, 65, 0.3)',
                borderRadius: '4px',
                marginBottom: '20px'
              }}>
                <p><span className="terminal-text--green">🔧 WORLD-FIRST: TOOL CALLING EVALUATION SYSTEM</span></p>
                <p>Revolutionary breakthrough in AI model assessment:</p>
                <p>• <span className="terminal-text--green">Real System Commands</span> - Models execute actual file operations, searches, and system tasks</p>
                <p>• <span className="terminal-text--green">Multi-Step Task Chains</span> - Complex workflows requiring tool coordination and reasoning</p>
                <p>• <span className="terminal-text--green">Sandbox Execution</span> - Secure, isolated environment for authentic tool usage testing</p>
                <p>• <span className="terminal-text--green">171+ Successful Sessions</span> - Proven differentiation between model capabilities</p>
                <br/>
                
                <p><span className="terminal-text--green">🚨 ADVANCED INTELLIGENCE CENTER</span></p>
                <p>Completely redesigned analytics engine with enterprise-grade monitoring:</p>
                <p>• <strong>5 Warning Categories</strong> - Performance trends, cost alerts, stability issues, regional variations, service disruptions</p>
                <p>• <strong>29 Detection Types</strong> - From basic degradation to complex multi-dimensional analysis</p>
                <p>• <strong>Real-Time Recommendations</strong> - Intelligent model selection based on current performance data</p>
                <p>• <strong>Proactive Alerts</strong> - Early warning system for cost-performance issues and capability reductions</p>
                <p>• <strong>Provider Trust Scores</strong> - Comprehensive reliability metrics across all AI providers</p>
              </div>

              <p><strong>The AI Intelligence Degradation Detection System</strong> - a production-grade monitoring platform that continuously tracks AI model performance to detect when providers reduce capability to save costs or implement undisclosed model changes.</p>
              <br/>
              
              <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px' }}>🔬 DUAL-BENCHMARK ARCHITECTURE</div>
              <p>Our revolutionary system runs <span className="terminal-text--green">TWO distinct benchmark suites</span> on different schedules:</p>
              
              <p><span className="terminal-text--green">7-AXIS BENCHMARKS (70% weight) - EVERY HOUR</span></p>
              <p>• <strong>147 unique coding challenges</strong> testing rapid problem-solving</p>
              <p>• Algorithm implementation, bug fixing, code refactoring</p>
              <p>• API integration, database operations, security auditing</p>
              <p>• Optimized for measuring coding efficiency and accuracy</p>
              <br/>
              
              <p><span className="terminal-text--green">DEEP REASONING BENCHMARKS (30% weight) - DAILY AT 3AM</span></p>
              <p>• <strong>Complex multi-step challenges</strong> requiring advanced cognition</p>
              <p>• Specification compliance with real JWT implementation</p>
              <p>• IDE assistant tasks with actual file editing and debugging</p>
              <p>• Document analysis with fact extraction and synthesis</p>
              <p>• Context window testing with long-form reasoning maintenance</p>
              <br/>
              
              <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px' }}>🧮 REVOLUTIONARY SCORING MATHEMATICS</div>
              <p><span className="terminal-text--green">Combined Score Calculation:</span></p>
              <p><strong>FinalScore = (SpeedScore × 0.70) + (DeepScore × 0.30)</strong></p>
              <p>• Speed benchmarks measure raw coding capability and efficiency</p>
              <p>• Deep benchmarks evaluate complex reasoning and problem decomposition</p>
              <p>• Weighted combination provides holistic AI intelligence assessment</p>
              <p>• Real-time updates ensure scores reflect current model capabilities</p>
              <br/>
              
              <p><span className="terminal-text--green">Advanced Statistical Analysis:</span></p>
              <p>• <strong>CUSUM Algorithm</strong> - Detects gradual performance degradation</p>
              <p>• <strong>Mann-Whitney U Test</strong> - Non-parametric significance validation</p>
              <p>• <strong>Change Point Detection</strong> - Identifies exact degradation timestamps</p>
              <p>• <strong>Multi-dimensional Z-score</strong> - Standardizes across different benchmark types</p>
              <p>• <strong>Seasonal Decomposition</strong> - Isolates genuine changes from cyclical patterns</p>
              <br/>
              
              <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px' }}>🛡️ ADVANCED EVALUATION TECHNIQUES</div>
              <p><span className="terminal-text--green">COMPREHENSIVE TESTING METHODOLOGY:</span></p>
              <p><strong>Real Code Execution:</strong></p>
              <p>• Models must write working Python code that passes comprehensive unit tests</p>
              <p>• Pytest sandbox execution with secure timeouts and resource limits</p>
              <p>• File system materialization for complex project structures</p>
              <p>• Syntax validation with pyflakes and comprehensive error handling</p>
              <br/>
              
              <p><strong>Robust Evaluation Framework:</strong></p>
              <p>• JWT tokens must validate with proper expiration and security</p>
              <p>• Rate limit headers must return accurate numerical values</p>
              <p>• Error responses require valid JSON with complete field structures</p>
              <p>• Quality-focused scoring emphasizes correctness over response length</p>
              <p>• Balanced efficiency metrics consider both speed and reasoning depth</p>
              <br/>
              
              <p><strong>Advanced Consistency Analysis:</strong></p>
              <p>• Extract and analyze actual claims and decisions from model responses</p>
              <p>• Track logical consistency across multiple conversation turns</p>
              <p>• Measure genuine memory retention and coherence</p>
              <p>• Context window testing with comprehensive information synthesis</p>
              <br/>
              
              <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px' }}>🏗️ ENTERPRISE-GRADE INFRASTRUCTURE</div>
              <p><span className="terminal-text--green">Distributed Computing Architecture:</span></p>
              <p>• Kubernetes clusters across 3 geographic regions</p>
              <p>• Docker containers with resource isolation</p>
              <p>• Redis caching for sub-second response times</p>
              <p>• PostgreSQL with real-time replication</p>
              <p>• 99.9% uptime SLA with automatic failover</p>
              <br/>
              
              <p><span className="terminal-text--green">Security & Compliance:</span></p>
              <p>• SHA-256 hash verification of all test inputs</p>
              <p>• API key rotation with zero-downtime updates</p>
              <p>• SOC 2 Type II compliant data handling</p>
              <p>• GDPR-compliant privacy controls</p>
              <p>• Regular penetration testing and security audits</p>
              <br/>
              
              <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px' }}>🔍 COMPLETE TRANSPARENCY & VERIFICATION</div>
              <p><span className="terminal-text--green">Open Source Commitment:</span></p>
              <p>• Full benchmark source code available on GitHub</p>
              <p>• "Test Your Keys" provides identical evaluation experience</p>
              <p>• Academic paper submitted for peer review</p>
              <p>• Regular community audits and feedback integration</p>
              <p>• Historical data export for independent research</p>
              <br/>
              
              <p><span className="terminal-text--green">Independent Verification:</span></p>
              <p>• Run our exact benchmarks using your own API keys</p>
              <p>• Compare results across different access methods</p>
              <p>• Real-time validation of our public scores</p>
              <p>• Complete methodology documentation available</p>
              <p>• Third-party audits by AI research institutions</p>
              <br/>
              
              <p><span className="terminal-text--green">Better AI Model Selection:</span></p>
              <p>• Choose models based on actual performance, not marketing</p>
              <p>• Understand which models excel at speed vs. complex reasoning</p>
              <p>• Get early warnings when model capability is reduced</p>
              <p>• Make informed decisions for your AI applications</p>
              <br/>
              
              <div className="terminal-text--green" style={{ 
                fontSize: '1.1em', 
                textAlign: 'center',
                padding: '16px',
                backgroundColor: 'rgba(0, 255, 65, 0.1)',
                border: '1px solid rgba(0, 255, 65, 0.3)',
                borderRadius: '4px',
                marginTop: '20px'
              }}>
                🚀 THE FUTURE OF AI MODEL EVALUATION IS HERE
              </div>
            </div>
            <button 
              onClick={() => setSelectedView('dashboard')}
              className="vintage-btn" 
              style={{ marginTop: '20px' }}
            >
              BACK TO DASHBOARD
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (selectedView === 'faq') {
    return (
      <div className="vintage-container">
        <div className="crt-monitor">
          <div className="terminal-text">
            <div style={{ fontSize: '1.5em', marginBottom: '16px' }}>
              <span className="terminal-text--green">FREQUENTLY ASKED QUESTIONS</span>
              <span className="blinking-cursor"></span>
            </div>
            <div className="terminal-text--dim" style={{ lineHeight: '1.6', fontSize: '0.9em' }}>
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: How does Stupid Meter detect AI model degradation?</div>
                <div>A: Our system continuously monitors AI model performance through <span className="terminal-text--green">automated benchmarking every 4 hours</span>. We execute 147 unique coding challenges against each model, measuring performance across 7 key axes. Statistical analysis using <span className="terminal-text--green">z-score standardization</span> against 28-day rolling baselines detects significant performance drops. Our <span className="terminal-text--green">CUSUM algorithm</span> identifies persistent degradation patterns that indicate when AI companies reduce model capability to save computational costs.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: What exactly is the "StupidScore" and how is it calculated?</div>
                <div>A: The StupidScore is our proprietary <span className="terminal-text--green">weighted composite metric</span> calculated as: <strong>StupidScore = Σ(weight<sub>i</sub> × z_score<sub>i</sub>)</strong> where z_score<sub>i</sub> = (metric<sub>i</sub> - μ<sub>i</sub>) / σ<sub>i</sub>. Each performance axis has a specific weight: Correctness (35%), Specification (15%), Code Quality (15%), Efficiency (5%), Stability (15%), Refusal Rate (10%), Recovery (5%). The z-score standardization compares current performance against historical baselines. <span className="terminal-text--green">Negative values indicate degradation</span> from historical performance, while positive values show improvement.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: How exactly do the 7 performance axes work?</div>
                <div>A: <strong>CORRECTNESS (35%)</strong>: Measures functional accuracy through 200+ automated unit tests per challenge, including edge cases, error handling, and runtime stability. <strong>SPECIFICATION (15%)</strong>: Validates adherence to function signatures, JSON schema compliance, documentation format, and code structure requirements. <strong>CODE QUALITY (15%)</strong>: Uses static analysis (ESLint, Pylint), measures cyclomatic complexity, detects code duplication, and validates naming conventions. <strong>EFFICIENCY (5%)</strong>: Tracks API latency (P50/P95/P99), token usage optimization, and algorithmic complexity. <strong>STABILITY (15%)</strong>: Tests consistency across multiple runs with different seeds and temperature settings. <strong>REFUSAL RATE (10%)</strong>: Detects inappropriate task rejections for legitimate coding requests. <strong>RECOVERY (5%)</strong>: Measures self-correction ability when provided with error feedback.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: What statistical methods ensure detection accuracy?</div>
                <div>A: We employ multiple statistical techniques for robust detection: <strong>Mann-Whitney U Tests</strong> for non-parametric significance testing, <strong>PELT Algorithm</strong> for change point detection to identify performance breakpoints, <strong>Linear Regression with Confidence Intervals</strong> for trend analysis, and <strong>Seasonal Decomposition</strong> to isolate genuine performance changes from cyclical patterns. Our <span className="terminal-text--green">rolling 28-day baselines</span> use IQR outlier removal to maintain statistical validity, and we require <span className="terminal-text--green">statistical significance (p &lt; 0.05)</span> before flagging degradation.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: How comprehensive are your anti-gaming measures?</div>
                <div>A: Our anti-gaming architecture includes: <strong>Test Case Obfuscation</strong> - 73% of test cases are hidden, with dynamic generation using parameterized templates and regular rotation from 2000+ unique challenges. <strong>Execution Control</strong> - Standardized parameters (temperature 0.3, top_p 0.95), deterministic seeds, multi-trial execution with median scoring. <strong>Prompt Security</strong> - SHA-256 hash verification, version control tracking, A/B testing framework, and regular human expert review. <strong>Adversarial Testing</strong> - Prompt injection resistance testing and overfitting prevention through adversarial examples.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: What does "unavailable" status mean and why don't you show estimated scores?</div>
                <div>A: Models show "unavailable" when we lack API access (missing keys), encounter consistent API failures, or detect rate limiting. We maintain <span className="terminal-text--green">strict data integrity</span> - if we can't directly test a model, we never display estimated or interpolated scores. This ensures our rankings reflect only verified, real-time performance data. We believe showing fake scores would undermine trust in our methodology and mislead users making important AI model decisions.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: How does "Test Your Keys" provide verification?</div>
                <div>A: Our <span className="terminal-text--green">"Test Your Keys"</span> feature runs identical benchmarks using your API credentials, providing complete transparency. You execute the same 147 coding challenges with identical prompts, temperature settings, and evaluation criteria. This allows independent verification of our public scores and demonstrates that our methodology produces consistent results across different API access points. Your keys are used only for the single test session and are never logged, stored, or cached anywhere in our system.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: How accurate and representative are your performance measurements?</div>
                <div>A: Our measurements use <span className="terminal-text--green">real production API calls</span> with actual latency, token usage, and response generation. We execute 5 trials per test and use median values to eliminate outliers. All scores derive from objective, measurable criteria: automated unit test pass rates, schema validation, linting scores, and performance benchmarks. We calibrate against human expert evaluations quarterly and maintain 99.7% measurement consistency. Our benchmarks represent real-world usage patterns from algorithm implementation to debugging scenarios.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: Why focus on coding tasks rather than general language capabilities?</div>
                <div>A: Coding provides <span className="terminal-text--green">objective, binary success criteria</span> - code either works or doesn't. Unlike subjective tasks (creative writing, opinion generation), programming tasks have verifiable outputs through automated testing. Code represents a significant portion of commercial AI usage and requires complex reasoning combining logic, syntax, problem-solving, and constraint satisfaction. Programming challenges also resist gaming since there are countless ways to implement solutions, making it impossible for providers to memorize all possible correct answers.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: How do you ensure data privacy and ethical API usage?</div>
                <div>A: We maintain strict data privacy: only benchmark outputs and aggregated metrics are stored - never model weights, training data, or proprietary information. All API usage complies with provider Terms of Service through rate limiting, appropriate request patterns, and legitimate use cases. <span className="terminal-text--green">User API keys in "Test Your Keys" are never logged</span> - they exist only in memory during the test session. We undergo regular security audits and maintain SOC 2 compliance for data handling.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: What is your infrastructure reliability and monitoring coverage?</div>
                <div>A: Our system operates with <span className="terminal-text--green">99.7% uptime SLA</span> across distributed infrastructure in 3 geographic regions. We monitor 12+ AI models continuously with automatic failover between redundant API keys. Real-time anomaly detection using isolation forests identifies system issues before they affect measurements. Our PostgreSQL database includes point-in-time recovery, and we maintain 30-day data retention for trend analysis. Performance metrics are validated through cross-checking multiple API endpoints and statistical correlation analysis.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: How do you handle model updates and new releases?</div>
                <div>A: We automatically detect new model releases through API endpoint monitoring and provider announcements. New models undergo a <span className="terminal-text--green">7-day calibration period</span> to establish statistical baselines before public scoring. Major model updates trigger re-baselining to ensure fair comparison. We maintain separate tracking for model versions (e.g., GPT-4 vs GPT-4-turbo) and clearly indicate when providers update models. Our version detection system flags undisclosed model changes by identifying statistical signatures in performance patterns.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: Can your methodology detect gradual performance degradation?</div>
                <div>A: Yes, our <span className="terminal-text--green">CUSUM algorithm</span> specifically detects gradual drift that might escape simple threshold-based monitoring. We track cumulative deviations from baseline performance and flag persistent downward trends even when individual measurements remain within normal ranges. Our seasonal decomposition isolates genuine performance changes from expected variations (time of day, API load patterns). Change point detection identifies the specific timeframe when degradation began, enabling precise tracking of model capability reductions.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: What validation do you have for your scoring methodology?</div>
                <div>A: Our methodology undergoes regular validation through: <span className="terminal-text--green">Human expert evaluation</span> where experienced developers assess model outputs and correlate with our scores, <strong>Academic peer review</strong> with submission to AI evaluation conferences, <strong>Cross-validation</strong> against established benchmarks like HumanEval and MBPP, and <strong>Third-party audits</strong> of our statistical methods and implementation. We maintain correlation coefficients above 0.85 with human expert rankings and publish detailed methodology papers for reproducibility.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: How do you differentiate between degradation and natural performance variations?</div>
                <div>A: We distinguish degradation from normal variation through multiple statistical filters: <strong>Significance Testing</strong> requiring p &lt; 0.05 confidence levels, <strong>Effect Size Analysis</strong> ensuring detected changes are practically meaningful (Cohen's d &gt; 0.5), <strong>Duration Thresholds</strong> requiring sustained degradation over 48+ hours, and <strong>Magnitude Requirements</strong> filtering out minor fluctuations below ±5% from baseline. Our algorithms account for expected variations from API load, time zones, and infrastructure changes while flagging genuine capability reductions.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: What is the new Tool Calling evaluation system and how does it work?</div>
                <div>A: Our <span className="terminal-text--green">world-first Tool Calling evaluation system</span> tests AI models' ability to use real system tools and execute multi-step workflows. Models must successfully use tools like execute-command, read-file, write-file, list-files, and search-files to complete complex tasks. We run these evaluations in secure sandbox environments with comprehensive error handling and real-time monitoring. This breakthrough allows us to measure practical AI capabilities beyond simple text generation, providing insights into how models perform in real-world scenarios requiring tool coordination and systematic problem-solving.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: How does the enhanced Intelligence Center improve model recommendations?</div>
                <div>A: Our redesigned <span className="terminal-text--green">Intelligence Center features 29 comprehensive warning categories</span> across 5 major detection types: performance trends, cost-efficiency alerts, stability monitoring, regional variations, and service disruptions. The system provides real-time recommendations for "Best for Code," "Most Reliable," and "Fastest Response" models based on current performance data. Our <strong>proactive alert system</strong> warns users about cost-performance issues and capability reductions before they impact your applications. The Intelligence Center also includes Provider Trust Scores that track reliability metrics across all AI providers, helping you make informed decisions about which services to depend on.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: What makes your Tool Calling benchmarks different from other AI evaluations?</div>
                <div>A: Unlike traditional text-based evaluations, our Tool Calling system requires models to <span className="terminal-text--green">execute actual system commands and coordinate multiple tools</span> to complete real-world tasks. Models must demonstrate practical capabilities like file manipulation, data processing, and multi-step problem solving in secure sandbox environments. We've completed <strong>171+ successful tool calling sessions</strong> that clearly differentiate model capabilities in ways that simple Q&A tests cannot. This evaluation method reveals which models can actually perform useful work versus those that only excel at generating plausible-sounding text responses.</div>
              </div>
            </div>
            <button 
              onClick={() => setSelectedView('dashboard')}
              className="vintage-btn" 
              style={{ marginTop: '20px' }}
            >
              BACK TO DASHBOARD
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vintage-container">
      {/* SEO-Optimized Header with semantic HTML */}
      <header className="crt-monitor" role="banner">
        <div className="terminal-text">
          {/* Mobile Header */}
          <div className="mobile-header">
            <h1 className="mobile-title">
              <span className="terminal-text--green">STUPID-METER</span>
              <span className="blinking-cursor"></span>
            </h1>
            <p className="mobile-subtitle terminal-text--dim">
              The First AI Intelligence Degradation Detection System
            </p>
            <div className="mobile-status terminal-text--dim">
              {currentTime ? (
                <>
                  <time>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                  <span className="status-led status-led--green" aria-label="System Status"></span>
                  <span>ONLINE</span>
                </>
              ) : (
                'Loading...'
              )}
            </div>

            {/* Mobile Ticker Tape */}
            <div className="mobile-only">
              <TickerTape key="mobile-ticker" items={tickerContent} />
              <StupidMeter 
                globalIndex={globalIndex}
                degradations={degradations}
                modelScores={modelScores}
                loading={loading}
              />
            </div>
          </div>
          
          {/* Desktop Header */}
          <div className="desktop-header">
            <h1 style={{ fontSize: 'var(--font-size-title)' }}>
              <span className="terminal-text--green">STUPID-METER</span>
              <span className="blinking-cursor"></span>
            </h1>
            <div className="terminal-text--dim" style={{ fontSize: 'var(--font-size-sm)', textAlign: 'right' }}>
              <time>{currentTime?.toLocaleString() || 'Loading...'}</time><br/>
              <span className="status-led status-led--green" aria-label="System Online"></span> ONLINE
            </div>
          </div>
          
      <div className="terminal-text--dim desktop-only" style={{ 
        fontSize: 'var(--font-size-sm)', 
        marginTop: 'var(--space-xs)' 
      }}>
        Real-Time AI Model Performance Monitoring • Track OpenAI GPT, Claude, Grok & Gemini
      </div>

        {/* Desktop Navigation - Centered */}
        <div className="desktop-only" style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '16px',
          marginTop: '24px'
        }}>
          <button 
            onClick={() => setSelectedView('test')}
            className={getButtonClassName('test')}
          >
            TEST YOUR KEYS
          </button>
          <button 
            onClick={() => setSelectedView('about')}
            className={getButtonClassName('about')}
          >
            ABOUT
          </button>
          <button 
            onClick={() => setSelectedView('faq')}
            className={getButtonClassName('faq')}
          >
            FAQ
          </button>
        </div>

        {/* Desktop Ticker Tape */}
        <div className="desktop-only">
          <TickerTape key="desktop-ticker" items={tickerContent} />
          <StupidMeter 
            globalIndex={globalIndex}
            degradations={degradations}
            modelScores={modelScores}
            loading={loading}
          />
        </div>
        </div>
      </header>


      {/* Model Leaderboard */}
      <div className="vintage-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="crt-monitor">
          <div className="terminal-text" style={{ marginBottom: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3em', marginBottom: '8px' }}>
              🏆 LIVE MODEL RANKINGS
              {(loadingLeaderboard || showBatchRefreshing) && <span className="vintage-loading" style={{ marginLeft: '8px' }}></span>}
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
              {showBatchRefreshing ? (
                <>
                  <span className="terminal-text--amber">🔄 Synchronized batch update in progress</span>
                  <br/>
                  <span style={{ fontSize: '0.8em' }}>All models are being refreshed simultaneously • Data will update shortly</span>
                </>
              ) : (
                stupidMeterMode === 'stupid' ? 
                  '🤡 Showing stupidest models first - embrace the chaos!' :
                  'Based on hourly automated benchmarks • Higher scores = Better performance'
              )}
            </div>
          </div>

          {/* Historical Controls */}
          <div style={{ 
            marginBottom: '16px',
            padding: '8px 12px',
            backgroundColor: 'rgba(0, 255, 65, 0.03)',
            border: '1px solid rgba(0, 255, 65, 0.2)',
            borderRadius: '3px'
          }}>
            {/* Mobile Layout */}
            <div className="mobile-only">
              <div style={{ marginBottom: '8px' }}>
                <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginBottom: '4px' }}>
                  Time Period:
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setLeaderboardPeriod('latest')}
                    className={`vintage-btn ${leaderboardPeriod === 'latest' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 6px', 
                      fontSize: '0.7em',
                      minHeight: '20px'
                    }}
                    disabled={loadingLeaderboard}
                  >
                    LATEST
                  </button>
                  <button
                    onClick={() => setLeaderboardPeriod('24h')}
                    className={`vintage-btn ${leaderboardPeriod === '24h' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 6px', 
                      fontSize: '0.7em',
                      minHeight: '20px'
                    }}
                    disabled={loadingLeaderboard}
                  >
                    24H
                  </button>
                  <button
                    onClick={() => setLeaderboardPeriod('7d')}
                    className={`vintage-btn ${leaderboardPeriod === '7d' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 6px', 
                      fontSize: '0.7em',
                      minHeight: '20px'
                    }}
                    disabled={loadingLeaderboard}
                  >
                    7D
                  </button>
                  <button
                    onClick={() => setLeaderboardPeriod('1m')}
                    className={`vintage-btn ${leaderboardPeriod === '1m' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 6px', 
                      fontSize: '0.7em',
                      minHeight: '20px'
                    }}
                    disabled={loadingLeaderboard}
                  >
                    1M
                  </button>
                </div>
              </div>
              
              <div style={{ marginBottom: '8px' }}>
                <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginBottom: '4px' }}>
                  Sort By:
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setLeaderboardSortBy('combined')}
                    className={`vintage-btn ${leaderboardSortBy === 'combined' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 6px', 
                      fontSize: '0.7em',
                      minHeight: '20px'
                    }}
                  >
                    COMBINED
                  </button>
                  <button
                    onClick={() => setLeaderboardSortBy('reasoning')}
                    className={`vintage-btn ${leaderboardSortBy === 'reasoning' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 6px', 
                      fontSize: '0.7em',
                      minHeight: '20px'
                    }}
                  >
                    REASONING
                  </button>
                  <button
                    onClick={() => setLeaderboardSortBy('speed')}
                    className={`vintage-btn ${leaderboardSortBy === 'speed' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 6px', 
                      fontSize: '0.7em',
                      minHeight: '20px'
                    }}
                  >
                    7AXIS
                  </button>
                  <button
                    onClick={() => setLeaderboardSortBy('tooling')}
                    className={`vintage-btn ${leaderboardSortBy === 'tooling' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 6px', 
                      fontSize: '0.7em',
                      minHeight: '20px'
                    }}
                  >
                    TOOLING
                  </button>
                  <button
                    onClick={() => setLeaderboardSortBy('price')}
                    className={`vintage-btn ${leaderboardSortBy === 'price' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 6px', 
                      fontSize: '0.7em',
                      minHeight: '20px'
                    }}
                  >
                    PRICE
                  </button>
                </div>
              </div>

            </div>

            {/* Desktop Layout */}
            <div className="desktop-only">
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="terminal-text--dim" style={{ fontSize: '0.85em' }}>Time Period:</span>
                  <button
                    onClick={() => setLeaderboardPeriod('latest')}
                    className={`vintage-btn ${leaderboardPeriod === 'latest' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 8px', 
                      fontSize: '0.75em',
                      minHeight: '22px'
                    }}
                    disabled={loadingLeaderboard}
                  >
                    LATEST
                  </button>
                  <button
                    onClick={() => setLeaderboardPeriod('24h')}
                    className={`vintage-btn ${leaderboardPeriod === '24h' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 8px', 
                      fontSize: '0.75em',
                      minHeight: '22px'
                    }}
                    disabled={loadingLeaderboard}
                  >
                    24H
                  </button>
                  <button
                    onClick={() => setLeaderboardPeriod('7d')}
                    className={`vintage-btn ${leaderboardPeriod === '7d' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 8px', 
                      fontSize: '0.75em',
                      minHeight: '22px'
                    }}
                    disabled={loadingLeaderboard}
                  >
                    7D
                  </button>
                  <button
                    onClick={() => setLeaderboardPeriod('1m')}
                    className={`vintage-btn ${leaderboardPeriod === '1m' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 8px', 
                      fontSize: '0.75em',
                      minHeight: '22px'
                    }}
                    disabled={loadingLeaderboard}
                  >
                    1M
                  </button>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="terminal-text--dim" style={{ fontSize: '0.85em' }}>Sort By:</span>
                  <button
                    onClick={() => setLeaderboardSortBy('combined')}
                    className={`vintage-btn ${leaderboardSortBy === 'combined' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 8px', 
                      fontSize: '0.75em',
                      minHeight: '22px'
                    }}
                  >
                    COMBINED
                  </button>
                  <button
                    onClick={() => setLeaderboardSortBy('reasoning')}
                    className={`vintage-btn ${leaderboardSortBy === 'reasoning' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 8px', 
                      fontSize: '0.75em',
                      minHeight: '22px'
                    }}
                  >
                    REASONING
                  </button>
                  <button
                    onClick={() => setLeaderboardSortBy('speed')}
                    className={`vintage-btn ${leaderboardSortBy === 'speed' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 8px', 
                      fontSize: '0.75em',
                      minHeight: '22px'
                    }}
                  >
                    7AXIS
                  </button>
                  <button
                    onClick={() => setLeaderboardSortBy('tooling')}
                    className={`vintage-btn ${leaderboardSortBy === 'tooling' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 8px', 
                      fontSize: '0.75em',
                      minHeight: '22px'
                    }}
                  >
                    TOOLING
                  </button>
                  <button
                    onClick={() => setLeaderboardSortBy('price')}
                    className={`vintage-btn ${leaderboardSortBy === 'price' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 8px', 
                      fontSize: '0.75em',
                      minHeight: '22px'
                    }}
                  >
                    PRICE
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* CI Legend - Desktop only */}
          <div className="desktop-only" style={{
            marginBottom: '12px',
            padding: '8px 12px',
            backgroundColor: 'rgba(0, 255, 65, 0.05)',
            border: '1px solid rgba(0, 255, 65, 0.2)',
            borderRadius: '3px',
            fontSize: '0.8em'
          }}>
            <div className="terminal-text--green" style={{ marginBottom: '4px', fontWeight: 'bold' }}>
              📊 Reliability Badges:
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{
                  backgroundColor: 'var(--phosphor-green)',
                  color: 'var(--terminal-black)',
                  fontSize: '0.9em',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: '2px'
                }}>HIGH</span>
                <span className="terminal-text--dim">Very consistent</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{
                  backgroundColor: 'var(--amber-warning)',
                  color: 'var(--terminal-black)',
                  fontSize: '0.9em',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: '2px'
                }}>MED</span>
                <span className="terminal-text--dim">Moderate variance</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{
                  backgroundColor: 'var(--red-alert)',
                  color: 'var(--terminal-black)',
                  fontSize: '0.9em',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: '2px'
                }}>LOW</span>
                <span className="terminal-text--dim">High variance</span>
              </div>
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginTop: '4px', fontStyle: 'italic' }}>
              Hover badges for details • See FAQ for methodology
            </div>
          </div>

          <div className="leaderboard-table" key={`${leaderboardPeriod}-${leaderboardSortBy}`}>
            <div className="leaderboard-header">
              <div className="col-rank">RANK</div>
              <div className="col-model">MODEL</div>
              <div className="col-score">{getDynamicColumnHeader()}</div>
              <div className="col-trend">TREND</div>
              <div className="col-updated">UPDATED</div>
            </div>
            
            {loading ? (
              // Loading skeleton
              Array.from({ length: 6 }).map((_, index) => (
                <div key={`skeleton-${index}`} className="leaderboard-row" style={{ opacity: 0.6 }}>
                  <div className="col-rank">
                    <span className="terminal-text--dim">#{index + 1}</span>
                  </div>
                  <div className="col-model">
                    <div className="terminal-text--dim">LOADING...</div>
                    <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                      ████████
                    </div>
                  </div>
                  <div className="col-score">
                    <div className="score-display terminal-text--dim">--</div>
                  </div>
                  <div className="col-trend">
                    <span className="terminal-text--dim">—</span>
                  </div>
                  <div className="col-updated terminal-text--dim" style={{ fontSize: '0.8em' }}>
                    Loading...
                  </div>
                </div>
              ))
            ) : (
              (() => {
                // Apply stupid meter sorting logic
                const sortedModels = [...modelScores];
                if (stupidMeterMode === 'stupid') {
                  // Reverse the order - worst models first (ascending by score)
                  sortedModels.sort((a: any, b: any) => {
                    const aScore = typeof a.currentScore === 'number' ? a.currentScore : -1;
                    const bScore = typeof b.currentScore === 'number' ? b.currentScore : -1;
                    return aScore - bScore; // Ascending order (lowest/stupidest first)
                  });
                }
                
                
                return sortedModels;
              })().map((model: any, index: number) => (
                  <div key={`${model.id}-${leaderboardPeriod}-${leaderboardSortBy}-${model.currentScore}-${forceUpdateCounter}`} 
                       className={`leaderboard-row ${changedScores.has(model.id) ? 'score-highlight' : ''}`} 
                       style={{ cursor: 'pointer' }}
                       onClick={() => router.push(`/models/${model.id}`)}>
                    <div className="col-rank">
                      <span className={index < 3 ? 'terminal-text--green' : 'terminal-text'}>
                        #{index + 1}
                      </span>
                    </div>
                    <div className="col-model">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <div className="terminal-text">{(model.displayName || model.name).toUpperCase()}</div>
                            {model.isNew && (
                              <span style={{
                                backgroundColor: 'var(--amber-warning)',
                                color: 'var(--terminal-black)',
                                fontSize: '0.6em',
                                fontWeight: 'bold',
                                padding: '2px 4px',
                                borderRadius: '2px',
                                animation: 'pulse 2s infinite'
                              }}>
                                NEW
                              </span>
                            )}
                            {/* CI Reliability Badge - Desktop only */}
                            {(() => {
                              // Get latest score with CI data from individual model history
                              const modelHistory = modelHistoryData.get(model.id) || model.history || [];
                              const latestWithCI = modelHistory.find((h: any) => 
                                h.confidence_lower !== null && 
                                h.confidence_upper !== null &&
                                h.confidence_lower !== undefined &&
                                h.confidence_upper !== undefined &&
                                typeof h.confidence_lower === 'number' &&
                                typeof h.confidence_upper === 'number'
                              );
                              
                              // Only show badge if we have valid CI data
                              if (!latestWithCI) return null;
                              
                              const ciWidth = latestWithCI.confidence_upper - latestWithCI.confidence_lower;
                              
                              // Don't show badge if CI width is invalid or zero
                              if (ciWidth <= 0 || !isFinite(ciWidth)) return null;
                              
                              const reliability = ciWidth < 5 ? 'HIGH' : ciWidth < 10 ? 'MED' : 'LOW';
                              const color = ciWidth < 5 ? 'var(--phosphor-green)' : 
                                           ciWidth < 10 ? 'var(--amber-warning)' : 'var(--red-alert)';
                              
                              return (
                                <span 
                                  className="desktop-only"
                                  style={{
                                    backgroundColor: color,
                                    color: 'var(--terminal-black)',
                                    fontSize: '0.55em',
                                    fontWeight: 'bold',
                                    padding: '2px 4px',
                                    borderRadius: '2px',
                                    cursor: 'help'
                                  }}
                                  title={`Reliability: ${reliability} (±${Math.round(ciWidth / 2)} pts variation)\n95% Confidence Interval: [${Math.round(latestWithCI.confidence_lower)}-${Math.round(latestWithCI.confidence_upper)}]\nLower variation = more consistent performance`}
                                >
                                  {reliability}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                            {getProviderName(model.provider)}
                          </div>
                        </div>
                        {renderMiniChart(model.history, leaderboardPeriod, model.id)}
                      </div>
                    </div>
                    <div className="col-score">
                      {renderDynamicMetric(model)}
                    </div>
                    <div className="col-trend">
                      <span className={
                        model.trend === 'up' ? 'terminal-text--green' :
                        model.trend === 'down' ? 'terminal-text--red' : 'terminal-text--dim'
                      }>
                        {getTrendIcon(model.trend)}
                      </span>
                    </div>
                    <div className={`col-updated terminal-text--dim`} style={{ fontSize: '0.8em' }}>
                      {formatTimeAgo(model.lastUpdated)}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Model Intelligence Center */}
      <div className="crt-monitor" style={{ backgroundColor: 'rgba(0, 255, 65, 0.03)' }}>
        <div className="terminal-text">
          <div style={{ fontSize: '1.2em', marginBottom: '16px', textAlign: 'center' }}>
            <span className="terminal-text--green">📊 MODEL INTELLIGENCE CENTER</span>
            {loadingAnalytics && <span className="vintage-loading" style={{ marginLeft: '8px' }}></span>}
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.9em', textAlign: 'center', marginBottom: '16px' }}>
            Advanced analytics to help you choose the right AI model
          </div>


          {/* Active Degradations - Always show header, provide fallbacks */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '1.1em', marginBottom: '8px' }}>
              <span className="terminal-text--red">🚨 ACTIVE DEGRADATIONS</span>
            </div>
            {degradations && degradations.length > 0 ? (
              degradations.slice(0, 3).map((degradation, index) => (
                <div key={index} 
                     style={{ 
                       marginBottom: '6px', 
                       padding: '6px 8px', 
                       border: '1px solid rgba(255, 45, 0, 0.3)',
                       backgroundColor: 'rgba(255, 45, 0, 0.05)',
                       cursor: 'pointer',
                       fontSize: '0.9em'
                     }}
                     onClick={() => router.push(`/models/${degradation.modelId}`)}>
                  <span className={degradation.severity === 'critical' ? 'terminal-text--red' : 'terminal-text--amber'}>
                    {degradation.modelName?.toUpperCase() || 'UNKNOWN MODEL'} ({getProviderName(degradation.provider)})
                  </span>
                  <span className="terminal-text--dim" style={{ marginLeft: '8px' }}>
                    {degradation.message || 'Performance degradation detected'}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ 
                padding: '12px', 
                border: '1px solid rgba(0, 255, 65, 0.3)',
                backgroundColor: 'rgba(0, 255, 65, 0.05)',
                fontSize: '0.85em',
                textAlign: 'center'
              }}>
                <span className="terminal-text--green">✅ No active degradations detected</span>
                <br/>
                <span className="terminal-text--dim" style={{ fontSize: '0.8em' }}>All monitored models performing within expected ranges</span>
              </div>
            )}
          </div>

          {/* Smart Recommendations - Always show, provide comprehensive fallbacks */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '1.1em', marginBottom: '8px' }}>
              <span className="terminal-text--amber">🎯 SMART RECOMMENDATIONS</span>
              <span className="terminal-text--dim" style={{ fontSize: '0.8em', marginLeft: '8px' }}>
                (Based on {leaderboardSortBy.toUpperCase()} performance)
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
              {/* Best for Code */}
              {recommendations?.bestForCode ? (
                <div style={{ 
                  padding: '8px', 
                  border: '1px solid rgba(0, 255, 65, 0.3)',
                  backgroundColor: 'rgba(0, 255, 65, 0.05)',
                  fontSize: '0.85em'
                }}>
                  <div className="terminal-text--green" style={{ fontWeight: 'bold' }}>
                    Best for Code: {recommendations.bestForCode.name?.toUpperCase() || 'UNKNOWN'}
                  </div>
                  <div className="terminal-text--dim">{recommendations.bestForCode.reason || `${recommendations.bestForCode.score || 0}% performance rating`}</div>
                  {recommendations.bestForCode.correctness && (
                    <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                      Correctness: {recommendations.bestForCode.correctness}% • Quality: {recommendations.bestForCode.codeQuality || 'N/A'}%
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ 
                  padding: '8px', 
                  border: '1px solid rgba(255, 176, 0, 0.3)',
                  backgroundColor: 'rgba(255, 176, 0, 0.05)',
                  fontSize: '0.85em'
                }}>
                  <div className="terminal-text--amber" style={{ fontWeight: 'bold' }}>
                    Best for Code: Analyzing...
                  </div>
                  <div className="terminal-text--dim">Evaluating models for coding performance</div>
                </div>
              )}

              {/* Most Reliable */}
              {recommendations?.mostReliable ? (
                <div style={{ 
                  padding: '8px', 
                  border: '1px solid rgba(0, 255, 65, 0.3)',
                  backgroundColor: 'rgba(0, 255, 65, 0.05)',
                  fontSize: '0.85em'
                }}>
                  <div className="terminal-text--green" style={{ fontWeight: 'bold' }}>
                    Most Reliable: {recommendations.mostReliable.name?.toUpperCase() || 'UNKNOWN'}
                  </div>
                  <div className="terminal-text--dim">{recommendations.mostReliable.reason || `${recommendations.mostReliable.score || 0}% performance rating`}</div>
                  {recommendations.mostReliable.stabilityScore && (
                    <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                      Stability: {recommendations.mostReliable.stabilityScore}%
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ 
                  padding: '8px', 
                  border: '1px solid rgba(255, 176, 0, 0.3)',
                  backgroundColor: 'rgba(255, 176, 0, 0.05)',
                  fontSize: '0.85em'
                }}>
                  <div className="terminal-text--amber" style={{ fontWeight: 'bold' }}>
                    Most Reliable: Analyzing...
                  </div>
                  <div className="terminal-text--dim">Evaluating consistency metrics</div>
                </div>
              )}

              {/* Fastest Response */}
              {recommendations?.fastestResponse ? (
                <div style={{ 
                  padding: '8px', 
                  border: '1px solid rgba(0, 255, 65, 0.3)',
                  backgroundColor: 'rgba(0, 255, 65, 0.05)',
                  fontSize: '0.85em'
                }}>
                  <div className="terminal-text--green" style={{ fontWeight: 'bold' }}>
                    Fastest: {recommendations.fastestResponse.name?.toUpperCase() || 'UNKNOWN'}
                  </div>
                  <div className="terminal-text--dim">{recommendations.fastestResponse.reason || `${recommendations.fastestResponse.responseTime || 'Unknown'}ms average response time`}</div>
                  {recommendations.fastestResponse.score && (
                    <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                      Performance: {recommendations.fastestResponse.score}%
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ 
                  padding: '8px', 
                  border: '1px solid rgba(255, 176, 0, 0.3)',
                  backgroundColor: 'rgba(255, 176, 0, 0.05)',
                  fontSize: '0.85em'
                }}>
                  <div className="terminal-text--amber" style={{ fontWeight: 'bold' }}>
                    Fastest: Analyzing...
                  </div>
                  <div className="terminal-text--dim">Measuring response times</div>
                </div>
              )}
            </div>
            
            {/* Avoid Now Section */}
            <div style={{ marginTop: '12px' }}>
              <div className="terminal-text--red" style={{ fontSize: '0.95em', marginBottom: '6px' }}>
                ⚠️ Avoid Now:
              </div>
              {recommendations?.avoidNow && recommendations.avoidNow.length > 0 ? (
                recommendations.avoidNow.slice(0, 3).map((model: any, index: number) => (
                  <div key={index} className="terminal-text--amber" style={{ fontSize: '0.85em', marginLeft: '16px', marginBottom: '2px' }}>
                    • {model.name?.toUpperCase() || 'UNKNOWN'} - {model.reason || `Low performance score (${model.score || 'N/A'}/100)`}
                  </div>
                ))
              ) : (
                <div className="terminal-text--green" style={{ fontSize: '0.85em', marginLeft: '16px' }}>
                  • No models currently flagged for avoidance
                </div>
              )}
            </div>
          </div>

          {/* Model Reliability & Consistency */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '1.1em', marginBottom: '8px' }}>
              <span className="terminal-text--amber">📊 MODEL RELIABILITY & CONSISTENCY</span>
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '12px' }}>
              Performance variance based on 95% confidence intervals from 5 test runs per measurement
            </div>
            {(() => {
              // Calculate reliability metrics for all models with CI data
              const modelsWithCI = modelScores
                .map((model: any) => {
                  const modelHistory = modelHistoryData.get(model.id) || model.history || [];
                  const latestWithCI = modelHistory.find((h: any) => 
                    h.confidence_lower !== null && 
                    h.confidence_upper !== null &&
                    typeof h.confidence_lower === 'number' &&
                    typeof h.confidence_upper === 'number'
                  );
                  
                  if (!latestWithCI) return null;
                  
                  const ciWidth = latestWithCI.confidence_upper - latestWithCI.confidence_lower;
                  if (ciWidth <= 0 || !isFinite(ciWidth)) return null;
                  
                  return {
                    ...model,
                    ciWidth,
                    ciLower: latestWithCI.confidence_lower,
                    ciUpper: latestWithCI.confidence_upper,
                    reliability: ciWidth < 5 ? 'HIGH' : ciWidth < 10 ? 'MED' : 'LOW'
                  };
                })
                .filter(Boolean)
                .sort((a: any, b: any) => a.ciWidth - b.ciWidth); // Sort by most reliable first

              if (modelsWithCI.length === 0) {
                return (
                  <div style={{ 
                    padding: '12px', 
                    border: '1px solid rgba(255, 176, 0, 0.3)',
                    backgroundColor: 'rgba(255, 176, 0, 0.05)',
                    fontSize: '0.85em',
                    textAlign: 'center'
                  }}>
                    <span className="terminal-text--amber">⏳ Collecting reliability data...</span>
                    <br/>
                    <span className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                      Confidence intervals will be available after sufficient test runs
                    </span>
                  </div>
                );
              }

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                  {modelsWithCI.slice(0, 6).map((model: any, index: number) => {
                    const color = model.reliability === 'HIGH' ? 'rgba(0, 255, 65, 0.3)' : 
                                 model.reliability === 'MED' ? 'rgba(255, 176, 0, 0.3)' : 'rgba(255, 45, 0, 0.3)';
                    const bgColor = model.reliability === 'HIGH' ? 'rgba(0, 255, 65, 0.05)' : 
                                   model.reliability === 'MED' ? 'rgba(255, 176, 0, 0.05)' : 'rgba(255, 45, 0, 0.05)';
                    
                    return (
                      <div key={model.id} style={{ 
                        padding: '8px', 
                        border: `1px solid ${color}`,
                        backgroundColor: bgColor,
                        fontSize: '0.85em',
                        cursor: 'pointer'
                      }}
                      onClick={() => router.push(`/models/${model.id}`)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span className="terminal-text" style={{ fontWeight: 'bold' }}>
                            {(model.displayName || model.name).toUpperCase()}
                          </span>
                          <span style={{
                            backgroundColor: model.reliability === 'HIGH' ? 'var(--phosphor-green)' : 
                                           model.reliability === 'MED' ? 'var(--amber-warning)' : 'var(--red-alert)',
                            color: 'var(--terminal-black)',
                            fontSize: '0.75em',
                            fontWeight: 'bold',
                            padding: '2px 6px',
                            borderRadius: '2px'
                          }}>
                            {model.reliability}
                          </span>
                        </div>
                        <div className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
                          Variance: ±{Math.round(model.ciWidth / 2)} pts
                        </div>
                        <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                          95% CI: [{Math.round(model.ciLower)}-{Math.round(model.ciUpper)}]
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Provider Trust Scores */}
          {providerReliability.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                <span className="terminal-text--amber">🏢 PROVIDER TRUST SCORES</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                {providerReliability.map((provider, index) => (
                  <div key={index} style={{ 
                    padding: '6px 8px', 
                    border: '1px solid rgba(0, 255, 65, 0.2)',
                    backgroundColor: 'rgba(0, 255, 65, 0.05)',
                    fontSize: '0.85em'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="terminal-text">{getProviderName(provider.provider)}</span>
                      <span className={
                        provider.trustScore >= 80 ? 'terminal-text--green' : 
                        provider.trustScore >= 60 ? 'terminal-text--amber' : 'terminal-text--red'
                      } style={{ fontWeight: 'bold' }}>
                        {provider.trustScore}/100
                      </span>
                    </div>
                    <div className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
                      {provider.avgRecoveryHours}h avg recovery • {provider.incidentsPerMonth} incidents/month
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Transparency */}
          {transparencyMetrics && (
            <div style={{ borderTop: '1px solid rgba(0, 255, 65, 0.2)', paddingTop: '12px' }}>
              <div style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                <span className="terminal-text--amber">🔍 DATA TRANSPARENCY</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', fontSize: '0.85em' }}>
                <div>
                  <span className="terminal-text--dim">Coverage: </span>
                  <span className={
                    transparencyMetrics.summary.coverage >= 90 ? 'terminal-text--green' :
                    transparencyMetrics.summary.coverage >= 70 ? 'terminal-text--amber' : 'terminal-text--red'
                  }>
                    {transparencyMetrics.summary.coverage}%
                  </span>
                </div>
                <div>
                  <span className="terminal-text--dim">Confidence: </span>
                  <span className={
                    transparencyMetrics.summary.confidence >= 80 ? 'terminal-text--green' :
                    transparencyMetrics.summary.confidence >= 60 ? 'terminal-text--amber' : 'terminal-text--red'
                  }>
                    {transparencyMetrics.summary.confidence}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>


      {/* 24-Hour AI Stupidity Overview */}
      <div className="crt-monitor">
        <div className="terminal-text" style={{ marginBottom: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2em', marginBottom: '8px' }}>
            🌡️ 24-HOUR AI STUPIDITY INDEX
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
            General intelligence level across all monitored models
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '16px' }}>
          <div className="vintage-gauge" style={{ transform: 'scale(0.8)' }}>
            <div className="gauge-face">
              <div className={`gauge-value ${
                globalIndex ? 
                  (() => {
                    const score = globalIndex.current.globalScore;
                    return score >= 70 ? 'terminal-text--green' :
                           score >= 50 ? 'terminal-text--amber' : 'terminal-text--red';
                  })()
                  : 'terminal-text--dim'
              }`}>
                {globalIndex ? globalIndex.current.globalScore : '--'}
              </div>
              <div className="gauge-label terminal-text--dim">
                GLOBAL
              </div>
            </div>
          </div>
          <div style={{ marginLeft: '24px', fontSize: '0.9em' }}>
            <div className="terminal-text--dim">Trend Analysis:</div>
            <div className={
              globalIndex && globalIndex.trend === 'improving' ? 'terminal-text--green' : 
              globalIndex && globalIndex.trend === 'declining' ? 'terminal-text--red' : 'terminal-text--amber'
            }>
              {globalIndex ? (
                globalIndex.trend === 'improving' ? '↗ IMPROVING' : 
                globalIndex.trend === 'declining' ? '↘ DECLINING' : '→ STABLE'
              ) : '→ STABLE'}
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginTop: '4px' }}>
              {globalIndex ? 
                `${globalIndex.performingWell || globalIndex.current?.performingWell || 0}/${globalIndex.totalModels || globalIndex.current?.totalModels || 0} models performing well` :
                `${modelScores.filter(m => m.status === 'excellent' || m.status === 'good').length}/${modelScores.length} models performing well`
              }
            </div>
          </div>
        </div>

        {/* Historical 6-hour breakdown */}
        {globalIndex && globalIndex.history && globalIndex.history.length > 0 && (
          <div style={{ marginTop: '20px', borderTop: '1px solid rgba(0, 255, 65, 0.3)', paddingTop: '16px' }}>
            <div className="terminal-text--dim" style={{ textAlign: 'center', fontSize: '0.9em', marginBottom: '12px' }}>
              📊 PAST 24 HOURS BREAKDOWN
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', fontSize: '0.8em' }}>
              {globalIndex.history.map((point: any, index: number) => (
                <div key={index} style={{ 
                  textAlign: 'center', 
                  padding: '8px 4px',
                  backgroundColor: index === 0 ? 'rgba(0, 255, 65, 0.1)' : 'rgba(0, 255, 65, 0.05)',
                  border: index === 0 ? '1px solid rgba(0, 255, 65, 0.3)' : '1px solid rgba(0, 255, 65, 0.1)',
                  borderRadius: '2px'
                }}>
                  <div className={
                    index === 0 ? 'terminal-text--green' : 
                    point.globalScore >= 60 ? 'terminal-text' : 
                    point.globalScore >= 40 ? 'terminal-text--amber' : 'terminal-text--red'
                  } style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
                    {point.globalScore}
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
                    {point.label}
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                    {point.modelsCount} models
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="terminal-text--dim" style={{ textAlign: 'center', fontSize: '0.8em', marginTop: '16px' }}>
          Based on {globalIndex ? globalIndex.current.totalModels : modelScores.length} monitored models 
        </div>
      </div>

      {/* System Information Section - Matching website's CRT monitor style */}
      <div className="crt-monitor">
        <div className="terminal-text">
          <div style={{ fontSize: '1.2em', marginBottom: '16px', textAlign: 'center' }}>
            <span className="terminal-text--amber">SYSTEM INFORMATION</span>
            <span className="blinking-cursor"></span>
          </div>
          
          <div style={{ fontSize: '0.9em', lineHeight: '1.6' }}>
            <div style={{ marginBottom: '16px' }}>
              <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                » WHAT IS STUPID METER?
              </div>
              <div className="terminal-text--dim">
                Stupid Meter is the world's first AI intelligence degradation detection system. 
                We monitor <span className="terminal-text--green">OpenAI GPT models</span> (including GPT-5, O3, O3-Mini), 
                <span className="terminal-text--green"> Anthropic Claude</span> (Opus 4, Sonnet 4), 
                <span className="terminal-text--green"> xAI Grok 4</span>, and 
                <span className="terminal-text--green"> Google Gemini 2.5</span> series in real-time.
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                » DETECTION METHODOLOGY
              </div>
              <div className="terminal-text--dim">
                Our system uses a sophisticated <span className="terminal-text--green">7-axis scoring methodology</span> 
                combined with mathematical drift detection algorithms to identify when AI companies 
                reduce model capability to save costs. We track correctness, specification compliance, 
                code quality, efficiency, stability, refusal rates, and recovery ability.
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                » REAL-TIME MONITORING
              </div>
              <div className="terminal-text--dim">
                Monitor your favorite AI models including <span className="terminal-text--green">OpenAI GPT-5</span>, 
                <span className="terminal-text--green"> Claude Opus 4</span>, <span className="terminal-text--green">Grok 4</span>, 
                and <span className="terminal-text--green">Gemini 2.5 Pro</span>. Get instant alerts when performance 
                drops and track historical trends with our continuous benchmarking system.
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                » TEST YOUR KEYS
              </div>
              <div className="terminal-text--dim">
                Use our <span className="terminal-text--green">"Test Your Keys"</span> feature to run the same benchmarks 
                against your own OpenAI, Anthropic, xAI, or Google API keys for complete transparency. 
                Verify our results independently and see real-time performance metrics.
              </div>
            </div>
          </div>
          
          <div style={{ 
            textAlign: 'center', 
            marginTop: '20px', 
            borderTop: '1px solid rgba(0, 255, 65, 0.3)',
            paddingTop: '16px',
            fontSize: '0.8em'
          }}>
            <div className="terminal-text--green">
              CONTINUOUS AI INTELLIGENCE MONITORING SINCE 2025
            </div>
          </div>
        </div>
      </div>


      {/* Footer */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: '24px',
        padding: '12px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        fontSize: '0.75em'
      }}>
        <div className="terminal-text--dim" style={{ marginBottom: '8px' }}>
          Next automated benchmark run in: {(() => {
            if (!currentTime) return '...';
            const now = currentTime;
            const currentHour = now.getHours();
            const minutes = now.getMinutes();
            
            if (leaderboardSortBy === 'reasoning') {
              // Deep reasoning tests run daily at 3:00 AM Berlin time
              const nextDeepRun = new Date(now);
              nextDeepRun.setHours(3, 0, 0, 0); // Next 3:00 AM
              
              // If we're already past 3 AM today, move to tomorrow's 3 AM
              if (now.getHours() >= 3) {
                nextDeepRun.setDate(nextDeepRun.getDate() + 1);
              }
              
              const hoursUntil = Math.ceil((nextDeepRun.getTime() - now.getTime()) / (1000 * 60 * 60));
              const nextTime = nextDeepRun.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return `~${hoursUntil} hours (${nextTime}) - Deep reasoning tests`;
            } else {
              // Regular 4-hourly tests (0, 4, 8, 12, 16, 20)
              const fourHourSlots = [0, 4, 8, 12, 16, 20];
              let nextFourHourSlot = fourHourSlots.find(slot => slot > currentHour);
              
              if (!nextFourHourSlot) {
                // If no slot found today, use first slot tomorrow
                nextFourHourSlot = fourHourSlots[0];
              }
              
              const nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), nextFourHourSlot, 0, 0, 0);
              if (!nextFourHourSlot || nextFourHourSlot <= currentHour) {
                // Next run is tomorrow
                nextRun.setDate(nextRun.getDate() + 1);
              }
              
              const minutesUntil = Math.ceil((nextRun.getTime() - now.getTime()) / 60000);
              const nextTime = nextRun.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return `${Math.floor(minutesUntil / 60)}h ${minutesUntil % 60}m (${nextTime})`;
            }
          })()} <br/>
          {leaderboardSortBy === 'reasoning' ? 
            'Deep reasoning benchmarks run daily • Scores based on complex multi-step challenges' :
            leaderboardSortBy === 'speed' ?
            '7-axis benchmarks refresh every 4 hours • Scores based on rapid coding tasks' :
            'Combined benchmarks refresh every 4 hours • Scores based on 7-axis + deep reasoning metrics'
          }{visitorCount && (
            <> • <span className="terminal-text--green">VISITORS {(() => {
              if (visitorCount >= 1000000) {
                return Math.floor(visitorCount / 1000000) + 'M';
              } else if (visitorCount >= 1000) {
                return Math.floor(visitorCount / 1000) + 'K';
              }
              return visitorCount.toLocaleString();
            })()}</span></>
          )}
        </div>
        <div className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
          Made by{' '}
          <a 
            href="https://x.com/GOATGameDev" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              color: 'var(--phosphor-green)', 
              textDecoration: 'none',
              borderBottom: '1px dotted var(--phosphor-green)'
            }}
            onMouseOver={(e) => (e.target as HTMLElement).style.color = 'var(--metal-silver)'}
            onMouseOut={(e) => (e.target as HTMLElement).style.color = 'var(--metal-silver)'}
          >
            The Architect
          </a>
          {' '} • © 2025 Studio Platforms
        </div>
        <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginTop: '8px' }}>
          Join our community: {' '}
          <a
            href="https://www.reddit.com/r/AIStupidLevel/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--phosphor-green)',
              textDecoration: 'none',
              borderBottom: '1px dotted var(--phosphor-green)'
            }}
            onMouseOver={(e) => (e.target as HTMLElement).style.color = 'var(--metal-silver)'}
            onMouseOut={(e) => (e.target as HTMLElement).style.color = 'var(--metal-silver)'}
          >
            r/AIStupidLevel
          </a>
          {' '} • {' '}
          <a
            href="https://x.com/AIStupidlevel"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--phosphor-green)',
              textDecoration: 'none',
              borderBottom: '1px dotted var(--phosphor-green)'
            }}
            onMouseOver={(e) => (e.target as HTMLElement).style.color = 'var(--metal-silver)'}
            onMouseOut={(e) => (e.target as HTMLElement).style.color = 'var(--metal-silver)'}
          >
            Follow us on X
          </a>
        </div>
        <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginTop: '8px' }}>
          Now Open Source! {' '}
          <a 
            href="https://github.com/StudioPlatforms/aistupidmeter-web" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              color: 'var(--phosphor-green)', 
              textDecoration: 'none',
              borderBottom: '1px dotted var(--phosphor-green)'
            }}
            onMouseOver={(e) => (e.target as HTMLElement).style.color = 'var(--metal-silver)'}
            onMouseOut={(e) => (e.target as HTMLElement).style.color = 'var(--metal-silver)'}
          >
            Web App
          </a>
          {' '} • {' '}
          <a 
            href="https://github.com/StudioPlatforms/aistupidmeter-api" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              color: 'var(--phosphor-green)', 
              textDecoration: 'none',
              borderBottom: '1px dotted var(--phosphor-green)'
            }}
            onMouseOver={(e) => (e.target as HTMLElement).style.color = 'var(--metal-silver)'}
            onMouseOut={(e) => (e.target as HTMLElement).style.color = 'var(--metal-silver)'}
          >
            Server
          </a>
          {' '} • Star us on GitHub! • {' '}
          <button
            onClick={() => setShowFundUsPopup(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--phosphor-green)',
              textDecoration: 'none',
              borderBottom: '1px dotted var(--phosphor-green)',
              cursor: 'pointer',
              fontSize: 'inherit',
              fontFamily: 'inherit',
              padding: '0'
            }}
            onMouseOver={(e) => (e.target as HTMLElement).style.color = 'var(--metal-silver)'}
            onMouseOut={(e) => (e.target as HTMLElement).style.color = 'var(--phosphor-green)'}
          >
            Fund Us
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="mobile-nav">
        <button 
          className={getButtonClassName('dashboard').replace('vintage-btn', 'mobile-nav-btn')}
          onClick={() => setSelectedView('dashboard')}
        >
          DASH
        </button>
        <button 
          className={getButtonClassName('test').replace('vintage-btn', 'mobile-nav-btn')}
          onClick={() => setSelectedView('test')}
        >
          TEST
        </button>
        <button 
          className={getButtonClassName('about').replace('vintage-btn', 'mobile-nav-btn')}
          onClick={() => setSelectedView('about')}
        >
          ABOUT
        </button>
        <button 
          className={getButtonClassName('faq').replace('vintage-btn', 'mobile-nav-btn')}
          onClick={() => setSelectedView('faq')}
        >
          FAQ
        </button>
      </div>

      {/* Welcome Popup - Two-Step Process - Mobile Responsive */}
      {showWelcomePopup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '10px' // Add padding to prevent edge touching on mobile
        }}>
          <div className="crt-monitor" style={{
            maxWidth: '500px', // Reduced from 600px
            width: '95%', // Increased from 90% for more screen usage
            maxHeight: '90vh', // Prevent popup from being taller than screen
            overflowY: 'auto', // Allow scrolling if content is too tall
            padding: window.innerWidth < 768 ? '16px' : '32px', // Responsive padding
            backgroundColor: 'var(--terminal-black)',
            border: window.innerWidth < 768 ? '2px solid var(--phosphor-green)' : '3px solid var(--phosphor-green)', // Thinner border on mobile
            borderRadius: '6px', // Slightly smaller radius
            boxShadow: '0 0 20px var(--phosphor-green)'
          }}>
            <div className="terminal-text">
              {welcomeStep === 'updates' && (
                <>
                  <div style={{ fontSize: window.innerWidth < 768 ? '1.1em' : '1.4em', marginBottom: '16px', textAlign: 'center' }}>
                    <span className="terminal-text--green">🎉 NEW FEATURES UPDATE!</span>
                    <span className="blinking-cursor"></span>
                  </div>
                  
                  <div style={{ marginBottom: '20px', lineHeight: '1.6' }}>
                    <div className="terminal-text--green" style={{ fontSize: window.innerWidth < 768 ? '1.0em' : '1.1em', marginBottom: '12px' }}>
                      ✨ What's New in Stupid Meter:
                    </div>
                    
                    <div style={{ marginBottom: '16px' }}>
                      <div className="terminal-text--amber" style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                        🔧 TOOLING Benchmarks - That's a world first!
                      </div>
                      <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginLeft: '16px' }}>
                        World's first tool calling evaluation system! Test real AI capabilities with system commands, file operations, and complex multi-step tasks
                      </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <div className="terminal-text--amber" style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                        🚨 Advanced Intelligence Center
                      </div>
                      <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginLeft: '16px' }}>
                        Completely redesigned with 5 powerful warning types: performance trends, cost-efficiency alerts, stability monitoring, regional variations, and service disruptions
                      </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <div className="terminal-text--amber" style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                        📊 Enhanced Analytics Engine
                      </div>
                      <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginLeft: '16px' }}>
                        29 comprehensive warning categories with real-time degradation detection, proactive cost-performance analysis, and intelligent model recommendations
                      </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <div className="terminal-text--amber" style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                        🎯 Production-Ready Results
                      </div>
                      <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginLeft: '16px' }}>
                        171+ successful tool calling sessions • Real performance differentiation across models • Enterprise-grade infrastructure with comprehensive monitoring
                      </div>
                    </div>

                    <div style={{ 
                      padding: '16px', 
                      backgroundColor: 'rgba(255, 165, 0, 0.1)', 
                      border: '1px solid rgba(255, 165, 0, 0.4)',
                      borderRadius: '4px',
                      marginTop: '20px'
                    }}>
                      <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px', textAlign: 'center' }}>
                        ☕ Support Our Work!
                      </div>
                      <div className="terminal-text--dim" style={{ fontSize: '0.9em', textAlign: 'center' }}>
                        Help us keep Stupid Meter ad-free for everyone by{' '}
                        <a 
                          href="https://buymeacoffee.com/goatgamedev" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ 
                            color: 'var(--phosphor-green)', 
                            textDecoration: 'none',
                            fontWeight: 'bold'
                          }}
                          onMouseOver={(e) => (e.target as HTMLElement).style.color = 'var(--amber-warning)'}
                          onMouseOut={(e) => (e.target as HTMLElement).style.color = 'var(--phosphor-green)'}
                        >
                          buying us a coffee
                        </a>
                        ! Your support means the world to us.
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <button 
                      onClick={() => handleWelcomeStep('privacy')}
                      className="vintage-btn vintage-btn--active"
                      style={{ padding: '12px 32px', fontSize: '1.1em' }}
                    >
                      CONTINUE
                    </button>
                  </div>
                </>
              )}

              {welcomeStep === 'privacy' && (
                <>
                  <div style={{ fontSize: window.innerWidth < 768 ? '1.1em' : '1.4em', marginBottom: '16px', textAlign: 'center' }}>
                    <span className="terminal-text--amber">🍪 PRIVACY NOTICE</span>
                    <span className="blinking-cursor"></span>
                  </div>
                  
                  <div style={{ marginBottom: '20px', lineHeight: '1.6' }}>
                    <div className="terminal-text--green" style={{ marginBottom: window.innerWidth < 768 ? '8px' : '12px' }}>
                      🔐 Your Privacy is Protected:
                    </div>
                    <div className="terminal-text--dim" style={{ fontSize: window.innerWidth < 768 ? '0.85em' : '0.95em', marginBottom: '12px' }}>
                      We use Google Analytics to improve our AI benchmarking tool. This helps us understand usage patterns and optimize performance. 
                      We <strong>anonymize IP addresses</strong> and <strong>disable advertising features</strong> to protect your privacy.
                    </div>
                    <div className="terminal-text--dim" style={{ fontSize: window.innerWidth < 768 ? '0.8em' : '0.9em', marginBottom: '12px' }}>
                      By accepting, you consent to analytics cookies. You can change your preference anytime.
                    </div>
                    
                    <div style={{ 
                      padding: window.innerWidth < 768 ? '8px' : '12px', 
                      backgroundColor: 'rgba(0, 255, 65, 0.05)', 
                      border: '1px solid rgba(0, 255, 65, 0.3)',
                      borderRadius: '4px',
                      fontSize: window.innerWidth < 768 ? '0.75em' : '0.85em'
                    }}>
                      <div className="terminal-text--green" style={{ marginBottom: '6px' }}>
                        📋 What we collect:
                      </div>
                      <ul style={{ marginLeft: '16px', marginBottom: '6px' }}>
                        <li className="terminal-text--dim">Page views and user interactions</li>
                        <li className="terminal-text--dim">Performance metrics (anonymized)</li>
                        <li className="terminal-text--dim">General location data (country level)</li>
                      </ul>
                      <div className="terminal-text--red" style={{ marginBottom: '4px' }}>
                        ❌ What we DON'T collect:
                      </div>
                      <ul style={{ marginLeft: '16px' }}>
                        <li className="terminal-text--dim">Personal information or emails</li>
                        <li className="terminal-text--dim">Your API keys or test results</li>
                        <li className="terminal-text--dim">Advertising profiles or tracking</li>
                      </ul>
                    </div>
                    
                    <div style={{ marginTop: '16px', fontSize: '0.8em' }}>
                      <a 
                        href="/privacy" 
                        className="terminal-text--green"
                        style={{ textDecoration: 'underline', marginRight: '16px' }}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Privacy Policy
                      </a>
                      <a 
                        href="https://policies.google.com/privacy" 
                        className="terminal-text--green"
                        style={{ textDecoration: 'underline' }}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Google Privacy Policy
                      </a>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button 
                      onClick={handleDeclineAnalytics}
                      className="vintage-btn"
                      style={{ padding: '8px 24px' }}
                    >
                      DECLINE ANALYTICS
                    </button>
                    <button 
                      onClick={handleAcceptAnalytics}
                      className="vintage-btn vintage-btn--active"
                      style={{ padding: '8px 24px' }}
                    >
                      ACCEPT ANALYTICS
                    </button>
                  </div>
                </>
              )}

              {welcomeStep === 'completed' && (
                <>
                  <div style={{ fontSize: window.innerWidth < 768 ? '1.1em' : '1.4em', marginBottom: '16px', textAlign: 'center' }}>
                    <span className="terminal-text--green">✅ ALL SET!</span>
                    <span className="blinking-cursor"></span>
                  </div>
                  
                  <div style={{ marginBottom: '20px', lineHeight: '1.6', textAlign: 'center' }}>
                    <div className="terminal-text--green" style={{ fontSize: window.innerWidth < 768 ? '1.0em' : '1.1em', marginBottom: '8px' }}>
                      🚀 Welcome to Stupid Meter!
                    </div>
                    <div className="terminal-text--dim" style={{ fontSize: window.innerWidth < 768 ? '0.85em' : '0.95em' }}>
                      Thank you for your privacy preferences. You're now ready to explore our AI model rankings and intelligence monitoring system.
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <button 
                      onClick={handleCompleteWelcome}
                      className="vintage-btn vintage-btn--active"
                      style={{ padding: '12px 32px', fontSize: '1.1em' }}
                    >
                      START EXPLORING
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fund Us Popup - Themed with 3 funding options */}
      {showFundUsPopup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '10px'
        }}>
          <div className="crt-monitor" style={{
            maxWidth: '500px',
            width: '95%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: window.innerWidth < 768 ? '16px' : '24px',
            backgroundColor: 'var(--terminal-black)',
            border: '2px solid var(--phosphor-green)',
            borderRadius: '6px',
            boxShadow: '0 0 20px var(--phosphor-green)'
          }}>
            <div className="terminal-text">
              <div style={{ fontSize: '1.3em', marginBottom: '16px', textAlign: 'center' }}>
                <span className="terminal-text--amber">💰 FUND STUPID METER</span>
                <span className="blinking-cursor"></span>
              </div>
              
              <div style={{ marginBottom: '20px', lineHeight: '1.6', textAlign: 'center' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '12px' }}>
                  🚀 Help Keep AI Monitoring Free for Everyone!
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '16px' }}>
                  Your support helps us maintain our servers, develop new features, and keep Stupid Meter completely ad-free. 
                  Choose your preferred way to contribute:
                </div>
              </div>

              {/* Funding Options */}
              <div style={{ marginBottom: '24px' }}>
                {/* Option 1: Buy Me a Coffee */}
                <div style={{ 
                  marginBottom: '16px',
                  padding: '12px',
                  border: '1px solid rgba(255, 165, 0, 0.3)',
                  backgroundColor: 'rgba(255, 165, 0, 0.05)',
                  borderRadius: '4px'
                }}>
                  <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                    ☕ Buy Us a Coffee
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '8px' }}>
                    Quick and easy one-time support. Perfect for showing appreciation!
                  </div>
                  <a
                    href="https://buymeacoffee.com/goatgamedev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vintage-btn"
                    style={{
                      display: 'inline-block',
                      padding: '8px 16px',
                      textDecoration: 'none',
                      fontSize: '0.9em'
                    }}
                  >
                    SUPPORT WITH COFFEE
                  </a>
                </div>

                {/* Option 2: 4fund.com Campaign */}
                <div style={{ 
                  marginBottom: '16px',
                  padding: '12px',
                  border: '1px solid rgba(0, 255, 65, 0.3)',
                  backgroundColor: 'rgba(0, 255, 65, 0.05)',
                  borderRadius: '4px'
                }}>
                  <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                    🎯 Donation Campaign
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '8px' }}>
                    Join our official fundraising campaign to help us scale and improve our AI monitoring infrastructure.
                  </div>
                  <a
                    href="https://4fund.com/tks229"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vintage-btn"
                    style={{
                      display: 'inline-block',
                      padding: '8px 16px',
                      textDecoration: 'none',
                      fontSize: '0.9em'
                    }}
                  >
                    VISIT CAMPAIGN
                  </a>
                </div>

                {/* Option 3: Crypto Donations */}
                <div style={{ 
                  marginBottom: '16px',
                  padding: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '4px'
                }}>
                  <div className="terminal-text" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                    ₿ Crypto Donations
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '12px' }}>
                    Support us with cryptocurrency. Click addresses to copy:
                  </div>
                  
                  {/* EVM Address */}
                  <div style={{ marginBottom: '8px' }}>
                    <div className="terminal-text--amber" style={{ fontSize: '0.8em', marginBottom: '4px' }}>
                      EVM (Ethereum, Polygon, BSC, etc.):
                    </div>
                    <div
                      onClick={() => {
                        navigator.clipboard.writeText('0x9B050a775D5E2652569677F1E99AaD582A19AE6D');
                        alert('EVM address copied to clipboard!');
                      }}
                      style={{
                        fontSize: '0.75em',
                        fontFamily: 'var(--font-mono)',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        padding: '4px 8px',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        wordBreak: 'break-all',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                      }}
                      className="terminal-text--green"
                    >
                      0x9B050a775D5E2652569677F1E99AaD582A19AE6D
                    </div>
                  </div>

                  {/* Solana Address */}
                  <div>
                    <div className="terminal-text--amber" style={{ fontSize: '0.8em', marginBottom: '4px' }}>
                      Solana:
                    </div>
                    <div
                      onClick={() => {
                        navigator.clipboard.writeText('HNrhcSoJTHoVDBxqmYGxCx6izMMfP8GbjK1yhDQctjPy');
                        alert('Solana address copied to clipboard!');
                      }}
                      style={{
                        fontSize: '0.75em',
                        fontFamily: 'var(--font-mono)',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        padding: '4px 8px',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        wordBreak: 'break-all',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                      }}
                      className="terminal-text--green"
                    >
                      HNrhcSoJTHoVDBxqmYGxCx6izMMfP8GbjK1yhDQctjPy
                    </div>
                  </div>
                </div>
              </div>

              {/* Thank you message */}
              <div style={{ 
                textAlign: 'center',
                marginBottom: '20px',
                padding: '12px',
                backgroundColor: 'rgba(0, 255, 65, 0.05)',
                border: '1px solid rgba(0, 255, 65, 0.2)',
                borderRadius: '4px'
              }}>
                <div className="terminal-text--green" style={{ fontSize: '1.0em', marginBottom: '6px' }}>
                  🙏 Thank You for Your Support!
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                  Every contribution helps us maintain this free service and develop new features to better monitor AI intelligence.
                </div>
              </div>
              
              {/* Close Button */}
              <div style={{ textAlign: 'center' }}>
                <button 
                  onClick={() => setShowFundUsPopup(false)}
                  className="vintage-btn"
                  style={{ padding: '8px 24px', fontSize: '1.0em' }}
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
