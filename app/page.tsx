'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import TickerTape from '../components/TickerTape';
import StupidMeter from '../components/StupidMeter';
import ProFeatureModal from '../components/ProFeatureModal';
import FeatureCard from '../components/FeatureCard';
import FAQItem from '../components/FAQItem';
import StatCounter from '../components/StatCounter';
import ThemeButton from '../components/ThemeButton';
import ShareButton from '../components/ShareButton';
// PHASE 3: Drift detection components
import DriftAwareModelCard from '../components/DriftAwareModelCard';
import DriftHeatmap from '../components/DriftHeatmap';

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

// Sticky param hook with popstate support
function useStickyParam<T extends string>(
  key: string,
  defaultValue: T,
  {
    lsKey = `aistupidlevel.${key}`,
  }: { lsKey?: string } = {}
) {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const mounted = useRef(false);
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    const sp = new URLSearchParams(window.location.search);
    const fromUrl = sp.get(key) as T | null;
    if (fromUrl) return fromUrl;
    const fromLs = localStorage.getItem(lsKey) as T | null;
    return (fromLs ?? defaultValue) as T;
  });

  // Write to URL + LS whenever value changes (after mount)
  useEffect(() => {
    if (!mounted.current) return;
    try {
      localStorage.setItem(lsKey, value);
      const sp = new URLSearchParams(window.location.search);
      sp.set(key, value);
      // preserve all other params, avoid scroll jump
      window.history.replaceState(null, '', `${pathname}?${sp.toString()}`);
    } catch {}
  }, [value, key, lsKey, pathname]);

  // On mount: listen to browser back/forward and rehydrate from URL
  useEffect(() => {
    mounted.current = true;
    const onPop = () => {
      const sp = new URLSearchParams(window.location.search);
      const fromUrl = sp.get(key) as T | null;
      if (fromUrl && fromUrl !== value) {
        setValue(fromUrl);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [key, value]);

  return [value, setValue] as const;
}

export default function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  
  const [selectedView, setSelectedView] = useState<'dashboard' | 'test' | 'about' | 'faq'>('dashboard');
  // PHASE 3: Dashboard view mode with persistence
  const [dashboardMode, setDashboardMode] = useStickyParam<'leaderboard' | 'drift'>('mode', 'leaderboard');
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [modelScores, setModelScores] = useState<ModelScore[]>([]);
  const [alerts, setAlerts] = useState<AlertModel[]>([]);
  const [globalIndex, setGlobalIndex] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<string>('Initializing...');
  const [loadingAttempts, setLoadingAttempts] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [degradations, setDegradations] = useState<any[]>([]);
  const [driftIncidents, setDriftIncidents] = useState<any[]>([]);
  const [providerReliability, setProviderReliability] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [transparencyMetrics, setTransparencyMetrics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  
  // STICKY FILTERS: Use the new useStickyParam hook
  const [leaderboardPeriod, setLeaderboardPeriod] = useStickyParam<'latest' | '24h' | '7d' | '1m'>('period', 'latest');
  const [leaderboardSortBy, setLeaderboardSortBy] = useStickyParam<'combined' | 'reasoning' | 'speed' | 'tooling' | 'price'>('sortBy', 'combined');
  
  // Ref to track user's current selection for validation
  const userSelectionRef = useRef({ period: leaderboardPeriod, sortBy: leaderboardSortBy });
  useEffect(() => {
    userSelectionRef.current = { period: leaderboardPeriod, sortBy: leaderboardSortBy };
  }, [leaderboardPeriod, leaderboardSortBy]);
  
  // CRITICAL FIX: Ref to prevent multiple initial data loads
  const initialDataLoaded = useRef(false);
  
  // Helper to validate if data matches user's current selection
  const matchesUserSelection = (period: string, sortBy: string) => {
    const cur = userSelectionRef.current;
    return cur.period === period && cur.sortBy === sortBy;
  };
  
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  /**
   * PERFORMANCE OPTIMIZATION: Progressive loading
   *
   * BEFORE: UI blocked until both scores AND charts loaded (all-or-nothing)
   * AFTER: Show leaderboard immediately, load charts in background
   *
   * Expected impact: Perceived load time reduced from 8-12s to 2-3s
   */
  const isLeaderboardUIBusy = loadingLeaderboard || modelScores.length === 0;
  const [historyRetryToken, setHistoryRetryToken] = useState(0);
  
  // Pro feature modal state
  const [showProModal, setShowProModal] = useState(false);
  const [proModalFeature, setProModalFeature] = useState<'historical-data' | 'performance-matrix'>('historical-data');
  
  // Session and subscription checking
  const { data: session } = useSession();
  const hasProAccess = (session?.user as any)?.subscriptionStatus === 'active' || 
                       (session?.user as any)?.subscriptionStatus === 'trialing';
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

  // Price info modal state
  const [showPriceInfoModal, setShowPriceInfoModal] = useState(false);

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
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
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
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
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

  /**
   * PERFORMANCE OPTIMIZATION: Batch history API call
   *
   * BEFORE: N+1 query pattern - 16+ individual HTTP requests
   * AFTER: Single batch API call
   *
   * Expected impact: 50-70% faster load time, eliminates retry amplification
   */
  useEffect(() => {
    const fetchAllModelHistory = async () => {
      if (!modelScores.length) {
        // No data to render; clear loading to avoid stuck spinner
        setHistoryLoading(false);
        setLoadingLeaderboard(false);
        return;
      }

      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
      const sortByParam = leaderboardSortBy === 'speed' ? '7axis' : leaderboardSortBy;
      const MAX_RETRIES = 2;
      
      console.log(`🚀 Fetching batch history for ${modelScores.length} models (${leaderboardPeriod}/${sortByParam}) [Attempt ${historyRetryToken + 1}/${MAX_RETRIES + 1}]`);
      
      // Exponential backoff: 0ms, 2s, 4s
      const backoffDelay = historyRetryToken > 0 ? Math.pow(2, historyRetryToken) * 1000 : 0;
      if (backoffDelay > 0) {
        console.log(`⏳ Waiting ${backoffDelay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
      
      try {
        // Build batch request with all model IDs
        const modelIds = modelScores.map(m => m.id).join(',');
        const batchUrl = `${apiUrl}/dashboard/history/batch?modelIds=${modelIds}&period=${leaderboardPeriod}&sortBy=${sortByParam}`;
        
        const startTime = Date.now();
        const response = await fetch(batchUrl, {
          signal: AbortSignal.timeout(45000) // 45s timeout for batch request
        });
        const duration = Date.now() - startTime;
        
        if (!response.ok) {
          throw new Error(`Batch API returned ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
          // CRITICAL FIX: API returns object { "46": [...], "171": [...] }, not array
          // Convert object response to Map for quick lookup
          const historyMap = new Map<string, any[]>();
          
          Object.entries(result.data).forEach(([modelId, history]: [string, any]) => {
            if (Array.isArray(history) && history.length > 0) {
              historyMap.set(modelId, history);
            }
          });
          
          const successCount = historyMap.size;
          const successRate = successCount / modelScores.length;
          
          console.log(`✅ Batch history loaded in ${duration}ms: ${successCount}/${modelScores.length} models (${Math.round(successRate * 100)}%)`);
          
          setModelHistoryData(historyMap);
          setHistoryRetryToken(0); // Reset retry counter on success
          setHistoryLoading(false);
          setLoadingLeaderboard(false);
          
        } else {
          throw new Error('Batch API returned invalid response structure');
        }
        
      } catch (error: any) {
        const errorType = error.name === 'TimeoutError' || error.name === 'AbortError' ? 'timeout' : 'network';
        console.error(`❌ Batch history fetch ${errorType} error:`, error.message);
        
        // Retry logic
        if (historyRetryToken < MAX_RETRIES) {
          console.warn(`⚠️ Retrying batch history fetch (${historyRetryToken + 1}/${MAX_RETRIES})...`);
          setHistoryRetryToken(prev => prev + 1);
          return;
        }
        
        // Retries exhausted - fall back to showing without charts
        console.warn(`⚠️ Chart loading failed after ${historyRetryToken + 1} attempts, showing leaderboard without charts`);
        setHistoryLoading(false);
        setLoadingLeaderboard(false);
      }
    };

    if (modelScores.length > 0) {
      setHistoryLoading(true);
      fetchAllModelHistory();
    }
  }, [leaderboardPeriod, leaderboardSortBy, modelScores.length, historyRetryToken]);

  // FIXED: Chart rendering function that uses individual model data with CI support
  const renderMiniChart = (history: any[], period: string = leaderboardPeriod, modelId?: string) => {
    // Use individual model history data if available
    const modelSpecificHistory = modelId ? modelHistoryData.get(modelId) : null;
    const chartHistory = modelSpecificHistory || history || [];

    // PERFORMANCE FIX: Removed console.log to prevent spam (called 21 times per render)
    // Excessive logging was causing 1000+ console messages in seconds

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

  // Fetch drift incidents with retry logic
  const fetchDriftIncidents = async (period: string = '7d', retryCount: number = 0, maxRetries: number = 5) => {
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/dashboard/incidents?period=${period}&limit=50`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setDriftIncidents(data.data);
        console.log(`📊 Loaded ${data.data.length} drift incidents for ${period}`);
        
        // If we got empty data and haven't exceeded retries, try again
        if (data.data.length === 0 && retryCount < maxRetries) {
          const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          console.log(`⏳ No drift incidents found, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
          setTimeout(() => {
            fetchDriftIncidents(period, retryCount + 1, maxRetries);
          }, retryDelay);
        }
      } else if (retryCount < maxRetries) {
        // Retry on failure
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        console.log(`⏳ Failed to fetch drift incidents, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          fetchDriftIncidents(period, retryCount + 1, maxRetries);
        }, retryDelay);
      }
    } catch (error) {
      console.error('Error fetching drift incidents:', error);
      
      // Retry on error
      if (retryCount < maxRetries) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        console.log(`⏳ Error fetching drift incidents, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          fetchDriftIncidents(period, retryCount + 1, maxRetries);
        }, retryDelay);
      }
    }
  };

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
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';

      console.log(`🌐 Fetching analytics from cached dashboard endpoint`);

      // Use the cached dashboard endpoint which includes ALL analytics data
      const response = await fetch(`${apiUrl}/dashboard/cached?period=${selectedPeriod}&sortBy=${selectedSortBy}&analyticsPeriod=${selectedPeriod}`);
      
      if (!response.ok) {
        throw new Error(`Analytics fetch failed: ${response.status}`);
      }

      const result = await response.json();

      console.log(`📡 Analytics data received from cached endpoint:`, {
        success: result.success,
        hasDegradations: !!result.data?.degradations,
        hasReliability: !!result.data?.providerReliability,
        hasRecommendations: !!result.data?.recommendations,
        hasTransparency: !!result.data?.transparencyMetrics
      });

      if (result.success && result.data) {
        // Extract analytics data from cached response
        if (result.data.degradations) setDegradations(result.data.degradations);
        if (result.data.providerReliability) setProviderReliability(result.data.providerReliability);
        if (result.data.driftIncidents) setDriftIncidents(result.data.driftIncidents);
        if (result.data.recommendations) {
          console.log(`✅ Setting recommendations data:`, result.data.recommendations);
          setRecommendations(result.data.recommendations);
        }
        if (result.data.transparencyMetrics) setTransparencyMetrics(result.data.transparencyMetrics);
        
        console.log(`🎯 Analytics data fetch completed successfully`);
      }
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
  // Now with retry logic to ensure data is eventually fetched
  const fetchDataSilently = async (retryCount = 0, maxRetries = 3) => {
    if (backgroundUpdating) {
      console.log('⏸️ Silent refresh already in progress, skipping...');
      return;
    }
    
    isSilentRefresh.current = true;
    
    // CRITICAL: Capture user selections at the START of the fetch
    const currentPeriod = userSelectionRef.current.period;
    const currentSortBy = userSelectionRef.current.sortBy;
    const currentAnalyticsPeriod = analyticsPeriod;
    
    setBackgroundUpdating(true);
    
    try {
      
      console.log(`⚡ Silent refresh START: user has ${currentPeriod}/${currentSortBy}/${currentAnalyticsPeriod} selected`);
      
      // ONLY update data that matches current user selections
      // Use relative URLs in production (proxied by nginx), direct localhost in dev
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
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
      console.error(`Silent background update failed (attempt ${retryCount + 1}/${maxRetries + 1}):`, error);
      
      // Retry with exponential backoff if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10 seconds
        console.log(`⏳ Retrying in ${backoffDelay}ms...`);
        
        setTimeout(() => {
          fetchDataSilently(retryCount + 1, maxRetries);
        }, backoffDelay);
      } else {
        console.error('❌ Max retries exceeded for silent refresh');
        setBackgroundUpdating(false);
      }
    }
  };

  // Smart caching helper functions
  const getCacheKey = (period: string, sortBy: string) => `${period}-${sortBy}`;
  
  const isCacheValid = (timestamp: number, maxAgeMinutes: number = 10) => {
    return Date.now() - timestamp < maxAgeMinutes * 60 * 1000;
  };

  // Fetch all dashboard data from cached endpoints - INSTANT loading!
  // FIXED: Now returns the fetched data for validation before state updates
  const fetchDashboardDataCached = async (period: 'latest' | '24h' | '7d' | '1m' = leaderboardPeriod, sortBy: 'combined' | 'reasoning' | 'speed' | 'tooling' | 'price' = leaderboardSortBy, analyticsP: 'latest' | '24h' | '7d' | '1m' = analyticsPeriod, forceRefresh: boolean = false): Promise<{ success: boolean; data?: any }> => {
    // CRITICAL FIX: Convert 'speed' to '7axis' for API compatibility
    const sortByParam = sortBy === 'speed' ? '7axis' : sortBy;
    console.log(`⚡ Fetching cached dashboard data: ${period}/${sortByParam}/${analyticsP}`);
    
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
      const cacheUrl = `${apiUrl}/dashboard/cached?period=${period}&sortBy=${sortByParam}&analyticsPeriod=${analyticsP}`;
      console.log(`🚀 Trying cache URL: ${cacheUrl}`);
      const response = await fetch(cacheUrl);
      const result = await response.json();
      console.log(`📊 Cache response:`, result);
      
      if (result.success && result.data) {
        console.log(`✅ Received cached data from ${result.meta?.cachedAt || 'unknown time'}`);
        
        // DEBUG: Log the entire result.data structure to see what we're getting
        console.log('🔍 Full result.data structure:', {
          hasModelScores: !!result.data.modelScores,
          hasAlerts: !!result.data.alerts,
          hasGlobalIndex: !!result.data.globalIndex,
          hasDegradations: !!result.data.degradations,
          hasRecommendations: !!result.data.recommendations,
          hasTransparencyMetrics: !!result.data.transparencyMetrics,
          hasProviderReliability: !!result.data.providerReliability,
          recommendationsValue: result.data.recommendations
        });
        
        // CRITICAL VALIDATION: Only update state if data matches user's CURRENT selection
        const metaPeriod = result.meta?.period ?? period;
        const metaSortBy = result.meta?.sortBy ?? sortByParam; // Use sortByParam (converted value) for comparison
        
        // Compare against the converted sortByParam, not the original sortBy
        const currentSortByParam = userSelectionRef.current.sortBy === 'speed' ? '7axis' : userSelectionRef.current.sortBy;
        if (metaPeriod !== userSelectionRef.current.period || metaSortBy !== currentSortByParam) {
          console.log(`🚫 Skip state update: user changed filters meanwhile (expected ${userSelectionRef.current.period}/${currentSortByParam}, got ${metaPeriod}/${metaSortBy})`);
          return { success: false };
        }
        
        // Extract all the data components
        const { modelScores, alerts, globalIndex, degradations, recommendations, transparencyMetrics, providerReliability, driftIncidents } = result.data;
        
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
        
        // CRITICAL: Always set recommendations, even if empty, to trigger UI update
        console.log('🔍 Recommendations data from cache:', recommendations);
        if (recommendations) {
          console.log('✅ Setting recommendations from cached response:', {
            hasBestForCode: !!recommendations.bestForCode,
            hasMostReliable: !!recommendations.mostReliable,
            hasFastestResponse: !!recommendations.fastestResponse,
            hasAvoidNow: !!recommendations.avoidNow
          });
          setRecommendations(recommendations);
        } else {
          console.warn('⚠️ No recommendations in cached response, setting empty object');
          setRecommendations({});
        }
        
        if (transparencyMetrics) setTransparencyMetrics(transparencyMetrics);
        if (providerReliability) setProviderReliability(providerReliability);
        if (driftIncidents) setDriftIncidents(driftIncidents);
        
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
        
        // FIXED: Return the actual fetched data for validation
        // Process model scores before returning
        const processedScores = modelScores.map((score: any) => ({
          ...score,
          lastUpdated: new Date(score.lastUpdated),
          history: score.history || []
        }));
        
        return { 
          success: true, 
          data: { 
            modelScores: processedScores, 
            globalIndex,
            alerts,
            degradations,
            recommendations,
            transparencyMetrics,
            providerReliability
          } 
        };
      } else {
        console.warn(`⚠️ Cache miss or error: ${result.message || result.error}`);
        return { success: false }; // Cache miss - will need to use fallback
      }
    } catch (error) {
      console.error('Error fetching cached dashboard data:', error);
      return { success: false }; // Error - will need to use fallback
    }
  };

  // Legacy fetch function for fallback when cache misses
  const fetchLeaderboardData = async (period: 'latest' | '24h' | '7d' | '1m' = leaderboardPeriod, sortBy: 'combined' | 'reasoning' | 'speed' | 'tooling' | 'price' = leaderboardSortBy, forceRefresh: boolean = false) => {
    // CRITICAL FIX: Convert 'speed' to '7axis' for API compatibility
    const sortByParam = sortBy === 'speed' ? '7axis' : sortBy;
    console.log(`🔄 Using fallback API for ${period}/${sortByParam} (cache miss)`);
    setLoadingLeaderboard(true);
    
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/dashboard/scores?period=${period}&sortBy=${sortByParam}`);
      const data = await response.json();
      
      if (data.success) {
        const processedScores = data.data.map((score: any) => ({
          ...score,
          lastUpdated: new Date(score.lastUpdated),
          history: score.history || []
        }));

        if (processedScores.length === 0) {
          console.warn('⚠️ Fallback returned zero scores, ending loading state');
          setHistoryLoading(false);
          setLoadingLeaderboard(false);
          return;
        }
        
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
        
        setHistoryLoading(true);
        setModelScores(processedScores);
        setLastUpdateTime(new Date());
        console.log(`✅ Fallback data loaded for ${period}/${sortBy}`);
      } else {
        console.error('Failed to fetch leaderboard data:', data.error);
        setLoadingLeaderboard(false);
      }
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
      setHistoryLoading(false);
      setLoadingLeaderboard(false);
    }
  };

  // Health check to verify API is responsive
  const healthCheck = async (): Promise<boolean> => {
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${apiUrl}/health`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log('✅ Health check passed');
        return true;
      }
      console.warn('⚠️ Health check failed with status:', response.status);
      return false;
    } catch (error) {
      console.error('❌ Health check error:', error);
      return false;
    }
  };

  // Enhanced validation - much stricter about data quality
  const validateDataCompleteness = (modelScoresData: any[], globalIndexData: any): boolean => {
    // Check if we have valid model scores with meaningful data
    if (!modelScoresData || modelScoresData.length === 0) {
      console.log('❌ Validation failed: No model scores');
      return false;
    }
    
    // STRICTER: Require at least 3 models (not just 1)
    if (modelScoresData.length < 3) {
      console.log('❌ Validation failed: Too few models', modelScoresData.length);
      return false;
    }
    
    // STRICTER: Check if we have models with valid scores (> 0)
    const modelsWithValidScores = modelScoresData.filter((model: any) =>
      typeof model.currentScore === 'number' && model.currentScore > 0
    );
    
    // STRICTER: Require at least 3 models with valid scores
    if (modelsWithValidScores.length < 3) {
      console.log('❌ Validation failed: Not enough valid scores', modelsWithValidScores.length);
      return false;
    }
    
    // STRICTER: Reject if more than 50% of models are unavailable
    const unavailableCount = modelScoresData.filter((m: any) => m.currentScore === 'unavailable').length;
    if (unavailableCount > modelScoresData.length / 2) {
      console.log('❌ Validation failed: Too many unavailable models', unavailableCount, '/', modelScoresData.length);
      return false;
    }
    
    // Check if we have global index data (OPTIONAL - not required for validation)
    const hasGlobalIndex = globalIndexData &&
      typeof globalIndexData.current?.globalScore === 'number' &&
      globalIndexData.current.globalScore > 0;
    
    console.log('📊 Enhanced data validation:', {
      totalModels: modelScoresData.length,
      validScores: modelsWithValidScores.length,
      unavailable: unavailableCount,
      hasGlobalIndex,
      sampleScore: modelScoresData[0]?.currentScore,
      globalScore: globalIndexData?.current?.globalScore,
      isComplete: modelsWithValidScores.length >= 3
    });
    
    // CRITICAL FIX: Don't require globalIndex for validation
    // API may return null globalIndex, but model scores are sufficient
    return modelsWithValidScores.length >= 3;
  };

  // Fun and educational loading messages
  const loadingMessages = [
    // Funny messages
    "Teaching AI models to count to 10... They're stuck at 7",
    "Asking ChatGPT if it remembers being smarter yesterday...",
    "Running stupidity diagnostics... Results pending",
    "Measuring how many paperclips each AI wants to make",
    "Checking if AI can still spell 'intelligence' correctly",
    "Testing if models know they're being tested (they don't)",
    "Watching AI models juggle... They dropped all the balls",
    "Rolling dice to see which model forgot how to code today",
    "AI models are rehearsing their excuses for poor performance",
    "Painting a picture of AI confusion... It's abstract",
    
    // Did you know? Facts
    "Did you know? AI models can lose 30% capability overnight!",
    "Did you know? We run 147 coding challenges every 4 hours!",
    "Did you know? 'AI lobotomy' = companies reducing model intelligence",
    "Did you know? We've completed 171+ tool calling benchmark sessions!",
    "Did you know? Our system detects degradation using CUSUM algorithms!",
    "Did you know? We track 7 performance axes for each model!",
    "Did you know? We monitor 20+ AI models across 4 major providers!",
    "Did you know? Models are tested with 5 runs for statistical accuracy!",
    "Did you know? We use 95% confidence intervals for reliability!",
    "Did you know? Our benchmarks run in secure sandbox environments!"
  ];

  // Rotate loading message every 5-8 seconds with random intervals
  useEffect(() => {
    if (!loading) return;
    
    // Set initial random message
    const randomIndex = Math.floor(Math.random() * loadingMessages.length);
    setLoadingMessage(loadingMessages[randomIndex]);
    
    // Function to schedule next message change with random interval
    const scheduleNextMessage = () => {
      // Random interval between 5-8 seconds (5000-8000ms)
      const randomInterval = Math.floor(Math.random() * 3000) + 5000;
      
      return setTimeout(() => {
        const newIndex = Math.floor(Math.random() * loadingMessages.length);
        setLoadingMessage(loadingMessages[newIndex]);
        // Schedule the next message change
        timeoutId = scheduleNextMessage();
      }, randomInterval);
    };
    
    // Start the rotation
    let timeoutId = scheduleNextMessage();
    
    return () => clearTimeout(timeoutId);
  }, [loading]);

  // Fetch dashboard data with retry logic - now using INSTANT cached endpoints!
  useEffect(() => {
    const fetchDashboardData = async (attemptNumber = 0) => {
      try {
        // CRITICAL FIX: Always use CURRENT user selections, not initial values
        const currentPeriod = userSelectionRef.current.period;
        const currentSortBy = userSelectionRef.current.sortBy;
        
        if (attemptNumber === 0) {
          // CRITICAL FIX: Prevent multiple initial loads
          if (initialDataLoaded.current) {
            console.log('⏸️ Initial data already loaded, skipping duplicate fetch');
            return;
          }
          initialDataLoaded.current = true;
          
          setLoading(true);
          setLoadingStage('Initializing...');
          setLoadingProgress(10);
          
          // CRITICAL FIX: Initialize userSelectionRef with current URL/localStorage values BEFORE any fetches
          console.log(`🎯 Initializing with user selection: ${leaderboardPeriod}/${leaderboardSortBy}`);
          userSelectionRef.current = { period: leaderboardPeriod, sortBy: leaderboardSortBy };
          
          // HEALTH CHECK: Verify API is responsive before attempting data fetch
          setLoadingStage('Checking API health...');
          const isHealthy = await healthCheck();
          if (!isHealthy && attemptNumber < 15) {
            // API unhealthy - faster retry for health check
            const retryDelay = Math.min(500 * Math.pow(1.5, attemptNumber), 5000);
            console.log(`⚠️ API health check failed, retrying in ${retryDelay}ms`);
            setLoadingStage(`System starting up, retrying in ${Math.round(retryDelay / 1000)}s...`);
            
            setTimeout(() => {
              fetchDashboardData(attemptNumber + 1);
            }, retryDelay);
            return;
          }
        }
        
        setLoadingAttempts(attemptNumber);
        setLoadingProgress(Math.min(10 + (attemptNumber * 6), 90));
        
        // Check batch status first
        setLoadingStage('Checking system status...');
        const batchStatusData = await fetchBatchStatus();
        
        setLoadingStage('Loading live rankings...');
        setLoadingProgress(Math.min(30 + (attemptNumber * 6), 90));
        
        // Try to fetch ALL data from cache INSTANTLY - ALWAYS use current user selections
        console.log(`⚡ Attempting instant cache load (attempt ${attemptNumber + 1}) with current selections: ${currentPeriod}/${currentSortBy}...`);
        const cacheResult = await fetchDashboardDataCached(currentPeriod, currentSortBy, analyticsPeriod);
        
        setLoadingStage('Processing data...');
        setLoadingProgress(Math.min(50 + (attemptNumber * 6), 90));
        
        if (cacheResult.success && cacheResult.data) {
          console.log('🚀 Dashboard loaded INSTANTLY from cache!');
          
          // FIXED: Validate the FETCHED data, not the state (which hasn't updated yet)
          const dataIsComplete = validateDataCompleteness(
            cacheResult.data.modelScores || [], 
            cacheResult.data.globalIndex
          );
          
          if (!dataIsComplete && attemptNumber < 15) {
            // AGGRESSIVE RETRY: Faster initial retries, then exponential backoff
            let retryDelay;
            if (attemptNumber < 3) {
              // First 3 attempts: very fast (500ms, 1s, 2s)
              retryDelay = 500 * Math.pow(2, attemptNumber);
            } else {
              // After 3 attempts: exponential backoff
              retryDelay = Math.min(2000 * Math.pow(1.5, attemptNumber - 3), 10000);
            }
            
            console.log(`⏳ Data incomplete, retrying in ${retryDelay}ms (attempt ${attemptNumber + 1}/15) - will use current user selections`);
            
            setLoadingStage(`Fetching models (${attemptNumber + 1}/15)...`);
            setLoadingProgress(Math.min(70 + (attemptNumber * 2), 95));
            
            // CRITICAL FIX: Don't retry if user has changed selections
            // The new selection will trigger its own fetch via the useEffect
            setTimeout(() => {
              fetchDashboardData(attemptNumber + 1);
            }, retryDelay);
            
            return; // Don't set loading to false yet
          }
          
          if (!dataIsComplete && attemptNumber >= 15) {
            console.log('⚠️ Max retry attempts reached, showing available data');
            setLoadingStage('Showing available data (some models may be missing)');
          } else if (dataIsComplete) {
            console.log('✅ Data validation passed, showing dashboard');
            setLoadingStage('Complete!');
          }
        } else {
          console.log('🔄 Cache miss, falling back to individual API calls...');
          
          setLoadingStage('Fetching from backup sources...');
          setLoadingProgress(Math.min(60 + (attemptNumber * 6), 90));
          
          // Fallback to legacy approach if cache misses - use current user selections
          const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
          console.log(`🔄 Cache miss - using fallback APIs with current selections: ${currentPeriod}/${currentSortBy}`);
          
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
          
          // Fallback leaderboard and analytics - use current user selections
          console.log(`🔄 Using fallback leaderboard API with current selections: ${currentPeriod}/${currentSortBy}`);
          await fetchLeaderboardData(currentPeriod, currentSortBy);
          
          // FIXED: Wait a bit for state to update, then validate
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Validate fallback data
          const dataIsComplete = validateDataCompleteness(modelScores, globalIndexData.data);
          
          if (!dataIsComplete && attemptNumber < 15) {
            // AGGRESSIVE RETRY for fallback too
            let retryDelay;
            if (attemptNumber < 3) {
              retryDelay = 1000 * Math.pow(2, attemptNumber);
            } else {
              retryDelay = Math.min(3000 * Math.pow(1.5, attemptNumber - 3), 15000);
            }
            
            console.log(`⏳ Fallback data incomplete, retrying in ${retryDelay}ms (attempt ${attemptNumber + 1}/15) - will use current user selections`);
            
            setLoadingStage(`Fetching benchmark data (${attemptNumber + 1}/15)...`);
            setLoadingProgress(Math.min(70 + (attemptNumber * 2), 95));
            
            // CRITICAL FIX: Don't retry if user has changed selections
            setTimeout(() => {
              fetchDashboardData(attemptNumber + 1);
            }, retryDelay);
            
            return;
          }
        }
        
        setLoadingStage('Loading analytics...');
        setLoadingProgress(Math.min(80 + (attemptNumber * 3), 95));
        
        // Analytics data is already loaded from the cached response above
        // No need to make separate API calls - the data is already in state
        console.log('✅ Analytics data already loaded from cached response');
        
        // Drift incidents are already loaded from cached response - no separate call needed
        console.log('✅ Drift incidents already loaded from cached response');
        
        // Always fetch visitor count (not cached)
        fetchVisitorCount();
        
        setLoadingProgress(100);
        setLoadingStage('Complete!');
      } catch (error) {
        console.error('❌ Failed to fetch dashboard data:', error);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isServerError = errorMessage.includes('Server error:') || 
                             errorMessage.includes('500') || 
                             errorMessage.includes('502') || 
                             errorMessage.includes('503');
        
        if (isServerError && attemptNumber < 15) {
          // Server error - AGGRESSIVE retry with faster initial attempts
          let retryDelay;
          if (attemptNumber < 3) {
            retryDelay = 1000 * Math.pow(2, attemptNumber);
          } else {
            retryDelay = Math.min(3000 * Math.pow(1.5, attemptNumber - 3), 15000);
          }
          
          console.log(`⚠️ Server error, retrying in ${retryDelay}ms (attempt ${attemptNumber + 1}/15) - will use current user selections`);
          
          setLoadingStage(`Server busy, retrying (${attemptNumber + 1}/15)...`);
          setLoadingProgress(Math.min(50 + (attemptNumber * 3), 95));
          
          setTimeout(() => {
            fetchDashboardData(attemptNumber + 1);
          }, retryDelay);
          
          return;
        }
        
        if (attemptNumber >= 15) {
          console.log('❌ Max retry attempts reached');
          setLoadingStage('Unable to load data after 15 attempts');
        }
      } finally {
        setLoading(false);
      }
    };

    // Initial data load
    fetchDashboardData(0);
    
    // PERFORMANCE FIX: Dramatically reduce background refresh frequency
    // Silent background updates every 10 minutes instead of 2 minutes
    // This prevents server overload and eliminates the "UPDATING RANKINGS" animation appearing randomly
    const silentUpdateTimer = setInterval(() => {
      console.log('🔄 Starting scheduled silent refresh...');
      fetchDataSilently();
    }, 10 * 60 * 1000); // 10 minutes (was 2 minutes)
    
    // PERFORMANCE FIX: Only poll batch status when batch is actually running
    // Check every 2 minutes instead of 30 seconds to reduce server load
    const batchTimer = setInterval(async () => {
      // Only fetch if we think a batch might be running
      if (showBatchRefreshing) {
        const batchStatusData = await fetchBatchStatus();
        
        // If batch just finished, refresh model data immediately
        if (batchStatusData && !batchStatusData.isBatchInProgress && showBatchRefreshing) {
          console.log('Batch completed, refreshing model data silently...');
          await fetchDataSilently();
        }
      }
    }, 2 * 60 * 1000); // 2 minutes (was 30 seconds)
    
    return () => {
      clearInterval(silentUpdateTimer);
      clearInterval(batchTimer);
    };
  }, [showBatchRefreshing]);

  // Effect for leaderboard controls changes - now using INSTANT cache!
  useEffect(() => {
    if (!loading) {
      console.log(`⚡ User changed to ${leaderboardPeriod}/${leaderboardSortBy}, trying cache...`);
      
      // CRITICAL FIX: Reset the initial data loaded guard when user changes selections
      // This allows data to load when switching tabs
      initialDataLoaded.current = false;
      
      // CRITICAL FIX: Clear model scores immediately for optimistic update
      setLoadingLeaderboard(true);
      setHistoryLoading(true);
      setModelScores([]); // Clear old data to prevent showing wrong data
      
      // Try cache first for instant loading
      fetchDashboardDataCached(leaderboardPeriod, leaderboardSortBy, analyticsPeriod)
        .then((res) => {
          if (!res?.success) {
            console.log('🔄 Cache miss on control change, using fallback...');
            fetchLeaderboardData(leaderboardPeriod, leaderboardSortBy);
            fetchAnalyticsData(analyticsPeriod, leaderboardSortBy);
            return;
          }
          
          // CRITICAL FIX: Verify metadata matches user selection
          const metaPeriod = res.data?.meta?.period || leaderboardPeriod;
          const metaSortBy = res.data?.meta?.sortBy || leaderboardSortBy;
          
          console.log(`📊 API returned: period=${metaPeriod}, sortBy=${metaSortBy}`);
          console.log(`👤 User selected: period=${leaderboardPeriod}, sortBy=${leaderboardSortBy}`);
          
          if (metaPeriod !== leaderboardPeriod || metaSortBy !== leaderboardSortBy) {
            console.error(`❌ METADATA MISMATCH! Expected ${leaderboardPeriod}/${leaderboardSortBy}, got ${metaPeriod}/${metaSortBy}`);
            console.log('🔄 Retrying with fallback API...');
            fetchLeaderboardData(leaderboardPeriod, leaderboardSortBy);
            fetchAnalyticsData(analyticsPeriod, leaderboardSortBy);
            return;
          }
          
          console.log('✅ Metadata matches! Loading data...');
          console.log('🚀 Control change loaded INSTANTLY from cache!');
          console.log(`🎯 Current modelScores count: ${modelScores.length}`);
          
          // CRITICAL FIX: Clear loading state when cache succeeds
          // The batch history useEffect will handle chart loading separately
          // This prevents the "UPDATING RANKINGS" overlay from getting stuck
          setLoadingLeaderboard(false);
        })
        .catch((error) => {
          // Hard fallback on unexpected errors — do not change user selections
          console.error('❌ Unexpected error in cache fetch:', error);
          fetchLeaderboardData(leaderboardPeriod, leaderboardSortBy);
          fetchAnalyticsData(analyticsPeriod, leaderboardSortBy);
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
      'claude-opus-4-6': 'CLAUDE-OPUS-4.6',
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
    
  // FIXED: Updated pricing based on latest 2025 verified rates (USD per 1M tokens)
  if (prov === 'openai') {
    // GPT-5 series - Latest verified pricing (Jan 2026)
    if (name.includes('gpt-5') && name.includes('nano')) return { input: 0.05, output: 0.40 };
    if (name.includes('gpt-5') && name.includes('mini')) return { input: 0.25, output: 2.00 };
    if (name.includes('gpt-5.2') || name.includes('gpt-5-2')) return { input: 1.75, output: 14.00 }; // GPT-5.2 standard API
    if (name.includes('gpt-5')) return { input: 1.25, output: 10.00 }; // GPT-5.1 standard API
    // O3 series
    if (name.includes('o3-pro')) return { input: 60, output: 240 };
    if (name.includes('o3-mini')) return { input: 3.5, output: 14 };
    if (name.includes('o3')) return { input: 15, output: 60 };
    // GPT-4 series
    if (name.includes('gpt-4o') && name.includes('mini')) return { input: 0.15, output: 0.6 };
    if (name.includes('gpt-4o')) return { input: 3.00, output: 12.00 };
    return { input: 3, output: 9 }; // Default OpenAI
  }
    
    if (prov === 'anthropic') {
      // Claude 4 series - Latest verified pricing (Jan 2026)
      // Claude Opus 4.5: New reduced pricing $5/$25 per 1M tokens
      if (name.includes('opus-4.5') || name.includes('opus-4-5')) return { input: 5, output: 25 };
      if (name.includes('opus-4')) return { input: 5, output: 25 }; // Updated from $15/$75
      // Claude Sonnet 4.5: $3/$15 per 1M tokens (confirmed)
      if (name.includes('sonnet-4.5') || name.includes('sonnet-4-5')) return { input: 3, output: 15 };
      if (name.includes('sonnet-4') || name.includes('3-7-sonnet')) return { input: 3, output: 15 };
      if (name.includes('haiku-4')) return { input: 0.25, output: 1.25 };
      // Claude 3.5 series
      if (name.includes('3-5-sonnet')) return { input: 3, output: 15 };
      if (name.includes('3-5-haiku')) return { input: 0.25, output: 1.25 };
      return { input: 3, output: 15 }; // Default Anthropic
    }
    
    if (prov === 'xai' || prov === 'x.ai') {
      // xAI / Grok pricing - Verified $3/$15 per 1M tokens
      if (name.includes('grok-3') && name.includes('mini')) return { input: 0.30, output: 0.50 };
      if (name.includes('grok-3')) return { input: 3, output: 15 };
      if (name.includes('grok-4-0709')) return { input: 3, output: 15 };
      if (name.includes('grok-4-latest')) return { input: 3, output: 15 };
      if (name.includes('grok-code-fast')) return { input: 3, output: 15 }; // Updated from $0.20/$1.50
      if (name.includes('grok-4')) return { input: 3, output: 15 };
      return { input: 3, output: 15 }; // Default xAI
    }
    
    if (prov === 'google') {
      // Gemini 3 series - Latest verified pricing (Jan 2026)
      if (name.includes('gemini-3') && name.includes('pro')) return { input: 2, output: 12 }; // Gemini 3 Pro standard (≤200K context)
      // Gemini 2.5 series - Verified Vertex AI pricing
      if (name.includes('2.5-pro')) return { input: 1.25, output: 10.00 }; // Gemini 2.5 Pro (similar tier to GPT-5.1)
      if (name.includes('2.5-flash-lite')) return { input: 0.10, output: 0.40 };
      if (name.includes('2.5-flash')) return { input: 0.30, output: 2.50 }; // Verified Vertex AI pricing
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
  
  // Add refs for stable ticker management
  const isSilentRefresh = useRef(false);
  const knownTickerItems = useRef<Set<string>>(new Set());
  const tickerInputsHashRef = useRef<string>('');

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
    // Debug logging removed for production performance
    
    // STABLE KEY: Use deterministic key based on model data, not random values
    const forceRenderKey = `${model.id}_${(model as any)._period}_${(model as any)._sortBy}_${model.currentScore}`;
    
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
      
      // FIXED: Convert to number for proper comparison (not lexicographic)
      const vs = Number(valueScore);
      
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
              <span className={vs > 10 ? 'terminal-text--green' : vs > 5 ? 'terminal-text--amber' : 'terminal-text--red'}>
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
      case 'anthropic': return ['claude-opus-4-6', 'claude-opus-4-1', 'claude-opus-4', 'claude-sonnet-4'];
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
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';

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
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
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
        {/* Hero Section with Animated Stats */}
        <div className="crt-monitor" style={{ marginBottom: '24px' }}>
          <div className="terminal-text">
            <div style={{ fontSize: '1.8em', marginBottom: '16px', textAlign: 'center' }}>
              <span className="terminal-text--green">ABOUT STUPID METER</span>
              <span className="blinking-cursor"></span>
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '1.1em', textAlign: 'center', marginBottom: '24px' }}>
              The World's First AI Intelligence Degradation Detection System
            </div>
            
            {/* Animated Statistics Grid */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '16px',
              marginBottom: '24px'
            }}>
              <StatCounter 
                value={25} 
                label="AI MODELS TRACKED" 
                icon="🤖"
                color="green"
                delay={0}
              />
              <StatCounter 
                value={14} 
                label="BENCHMARK SUITES" 
                icon="🧪"
                color="blue"
                delay={200}
              />
              <StatCounter 
                value={99} 
                label="UPTIME PERCENTAGE" 
                suffix="%"
                icon="⚡"
                color="amber"
                delay={400}
              />
              <StatCounter 
                value={171} 
                label="TOOL CALLING SESSIONS" 
                icon="🔧"
                color="green"
                delay={600}
              />
            </div>

            {/* Latest Update Banner */}
            <div style={{ 
              padding: '16px', 
              backgroundColor: 'rgba(0, 255, 65, 0.1)', 
              border: '2px solid var(--phosphor-green)',
              borderRadius: '8px',
              textAlign: 'center',
              marginBottom: '24px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '2px',
                background: 'linear-gradient(90deg, transparent, var(--phosphor-green), transparent)',
                animation: 'scanLine 3s infinite'
              }} />
              <div className="terminal-text--amber" style={{ fontSize: '1.3em', marginBottom: '8px' }}>
                🚨 LATEST: TOOL CALLING + INTELLIGENCE CENTER REVOLUTION
              </div>
              <div className="terminal-text--green" style={{ fontSize: '1.0em' }}>
                World-first evaluation system for real AI tool usage capabilities
              </div>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '20px',
          marginBottom: '32px'
        }}>
          <FeatureCard
            icon="🔧"
            title="TOOL CALLING EVALUATION"
            description="Revolutionary breakthrough in AI assessment - models execute real system commands, file operations, and multi-step workflows in secure sandboxes."
            details={[
              "Real System Commands",
              "Multi-Step Task Chains", 
              "Sandbox Execution",
              "171+ Successful Sessions"
            ]}
            highlight={true}
            delay={0}
          />
          
          <FeatureCard
            icon="🚨"
            title="INTELLIGENCE CENTER"
            description="Advanced analytics engine with enterprise-grade monitoring, proactive alerts, and intelligent model recommendations."
            details={[
              "5 Warning Categories",
              "29 Detection Types",
              "Real-Time Recommendations",
              "Provider Trust Scores"
            ]}
            delay={200}
          />
          
          <FeatureCard
            icon="🔬"
            title="DUAL-BENCHMARK SYSTEM"
            description="Two distinct evaluation suites: 7-axis speed tests (hourly) and deep reasoning challenges (daily) for comprehensive assessment."
            details={[
              "147 Coding Challenges",
              "Complex Multi-Step Tasks",
              "70/30 Weight Distribution",
              "Real-Time Updates"
            ]}
            delay={400}
          />
          
          <FeatureCard
            icon="🧮"
            title="ADVANCED MATHEMATICS"
            description="Sophisticated statistical analysis using CUSUM algorithms, Mann-Whitney U tests, and change point detection."
            details={[
              "CUSUM Algorithm",
              "Statistical Significance",
              "Change Point Detection",
              "Multi-dimensional Z-score"
            ]}
            delay={600}
          />
          
          <FeatureCard
            icon="🛡️"
            title="ROBUST EVALUATION"
            description="Real code execution with comprehensive testing, JWT validation, and advanced consistency analysis."
            details={[
              "Pytest Sandbox Execution",
              "JWT Token Validation",
              "Quality-Focused Scoring",
              "Consistency Analysis"
            ]}
            delay={800}
          />
          
          <FeatureCard
            icon="🏗️"
            title="ENTERPRISE INFRASTRUCTURE"
            description="Distributed computing across 3 regions with Kubernetes, Redis caching, and 99.9% uptime SLA."
            details={[
              "Kubernetes Clusters",
              "Redis Caching",
              "PostgreSQL Replication",
              "SOC 2 Compliance"
            ]}
            delay={1000}
          />
        </div>

        {/* Technical Deep Dive */}
        <div className="crt-monitor" style={{ marginBottom: '24px' }}>
          <div className="terminal-text">
            <div style={{ fontSize: '1.4em', marginBottom: '16px', textAlign: 'center' }}>
              <span className="terminal-text--amber">🔍 TECHNICAL DEEP DIVE</span>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
              gap: '24px',
              fontSize: '0.9em',
              lineHeight: '1.6'
            }}>
              <div>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '12px' }}>
                  📊 SCORING METHODOLOGY
                </div>
                <div className="terminal-text--dim">
                  <strong>Combined Score Formula:</strong><br/>
                  <code style={{ 
                    background: 'rgba(0,255,65,0.1)', 
                    padding: '4px 8px', 
                    borderRadius: '3px',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    FinalScore = (SpeedScore × 0.70) + (DeepScore × 0.30)
                  </code>
                  <br/><br/>
                  Speed benchmarks measure coding efficiency while deep benchmarks evaluate complex reasoning and problem decomposition.
                </div>
              </div>
              
              <div>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '12px' }}>
                  🔒 SECURITY & PRIVACY
                </div>
                <div className="terminal-text--dim">
                  • SHA-256 hash verification of all test inputs<br/>
                  • API key rotation with zero-downtime updates<br/>
                  • SOC 2 Type II compliant data handling<br/>
                  • GDPR-compliant privacy controls<br/>
                  • Regular penetration testing and security audits
                </div>
              </div>
              
              <div>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '12px' }}>
                  🌐 OPEN SOURCE COMMITMENT
                </div>
                <div className="terminal-text--dim">
                  • Full benchmark source code on GitHub<br/>
                  • Complete methodology transparency<br/>
                  • Academic paper submitted for peer review<br/>
                  • Regular community audits<br/>
                  • Historical data export for research
                </div>
              </div>
              
              <div>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '12px' }}>
                  ✅ INDEPENDENT VERIFICATION
                </div>
                <div className="terminal-text--dim">
                  • Open source benchmarks for validation<br/>
                  • Compare results across access methods<br/>
                  • Real-time validation of public scores<br/>
                  • Complete methodology documentation<br/>
                  • Third-party institutional audits
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enterprise Data Licensing Section */}
        <div className="crt-monitor" style={{ marginBottom: '24px' }}>
          <div className="terminal-text">
            <div style={{ fontSize: '1.4em', marginBottom: '16px', textAlign: 'center' }}>
              <span className="terminal-text--amber">💼 ENTERPRISE DATA LICENSING</span>
            </div>
            
            <div className="terminal-text--dim" style={{ fontSize: '1.0em', textAlign: 'center', marginBottom: '24px' }}>
              Premium datasets for AI safety teams, compliance officers, and ML researchers
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div style={{
                padding: '16px',
                backgroundColor: 'rgba(0, 100, 200, 0.15)',
                border: '1px solid rgba(0, 150, 255, 0.4)',
                borderRadius: '8px'
              }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                  🛡️ SAFETY & SECURITY
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                  Adversarial testing, jailbreak attempts, prompt injection vulnerabilities, safety bypass patterns
                </div>
              </div>
              
              <div style={{
                padding: '16px',
                backgroundColor: 'rgba(150, 0, 200, 0.15)',
                border: '1px solid rgba(200, 0, 255, 0.4)',
                borderRadius: '8px'
              }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                  ⚖️ BIAS & FAIRNESS
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                  Demographic performance analysis, gender/ethnicity bias detection, EU AI Act compliance data
                </div>
              </div>
              
              <div style={{
                padding: '16px',
                backgroundColor: 'rgba(200, 100, 0, 0.15)',
                border: '1px solid rgba(255, 150, 0, 0.4)',
                borderRadius: '8px'
              }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                  🎯 ROBUSTNESS & RELIABILITY
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                  Prompt sensitivity, hallucination patterns, consistency metrics, failure mode taxonomy
                </div>
              </div>
              
              <div style={{
                padding: '16px',
                backgroundColor: 'rgba(0, 200, 150, 0.15)',
                border: '1px solid rgba(0, 255, 200, 0.4)',
                borderRadius: '8px'
              }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                  📊 VERSION & REGRESSION
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                  Model version tracking, performance regression analysis, API update correlation
                </div>
              </div>
            </div>
            
            <div style={{
              padding: '20px',
              backgroundColor: 'rgba(0, 255, 65, 0.1)',
              border: '2px solid var(--phosphor-green)',
              borderRadius: '8px',
              textAlign: 'center',
              marginBottom: '16px'
            }}>
              <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '12px' }}>
                🎯 IDEAL FOR:
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.9em', lineHeight: '1.8' }}>
                AI Safety Teams • Compliance Officers • ML Researchers<br/>
                Enterprise Architects • Security Analysts • Data Scientists
              </div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <a
                href="https://studioplatforms.eu/products/aistupidlevel/data-licensing"
                target="_blank"
                rel="noopener noreferrer"
                className="vintage-btn vintage-btn--active"
                style={{
                  padding: '12px 32px',
                  fontSize: '1.0em',
                  display: 'inline-block',
                  textDecoration: 'none',
                  boxShadow: '0 0 20px rgba(0, 255, 65, 0.5)'
                }}
              >
                VIEW PRICING & CONTACT SALES →
              </a>
            </div>
            
            <div className="terminal-text--dim" style={{ fontSize: '0.75em', textAlign: 'center', marginTop: '16px', fontStyle: 'italic' }}>
              Enterprise data licensing helps fund our free public platform and keeps us independent from AI vendors
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="crt-monitor">
          <div className="terminal-text" style={{ textAlign: 'center' }}>
            <div className="terminal-text--green" style={{ 
              fontSize: '1.4em', 
              marginBottom: '16px',
              textShadow: '0 0 15px var(--phosphor-green)'
            }}>
              🚀 THE FUTURE OF AI MODEL EVALUATION IS HERE
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '1.0em', marginBottom: '24px' }}>
              Choose models based on actual performance, not marketing promises.<br/>
              Get early warnings when capabilities are reduced.
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setSelectedView('dashboard')}
                className="vintage-btn vintage-btn--active"
                style={{
                  padding: '12px 32px',
                  fontSize: '1.1em',
                  boxShadow: '0 0 20px rgba(0, 255, 65, 0.5)'
                }}
              >
                EXPLORE LIVE RANKINGS
              </button>
              <a
                href="/methodology"
                className="vintage-btn"
                style={{
                  padding: '12px 32px',
                  fontSize: '1.1em',
                  textDecoration: 'none',
                  display: 'inline-block'
                }}
              >
                VIEW METHODOLOGY →
              </a>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes scanLine {
            0% { left: -100%; }
            100% { left: 100%; }
          }
        `}</style>
      </div>
    );
  }

  if (selectedView === 'faq') {
    return (
      <div className="vintage-container">
        {/* Header */}
        <div className="crt-monitor" style={{ marginBottom: '24px' }}>
          <div className="terminal-text">
            <div style={{ fontSize: '1.8em', marginBottom: '16px', textAlign: 'center' }}>
              <span className="terminal-text--green">FREQUENTLY ASKED QUESTIONS</span>
              <span className="blinking-cursor"></span>
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '1.1em', textAlign: 'center', marginBottom: '24px' }}>
              Everything you need to know about AI intelligence monitoring
            </div>
            
            {/* Quick Stats */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
              gap: '12px',
              marginBottom: '24px'
            }}>
              <StatCounter 
                value={17} 
                label="QUESTIONS ANSWERED" 
                icon="❓"
                color="green"
                delay={0}
              />
              <StatCounter 
                value={4} 
                label="CATEGORIES COVERED" 
                icon="📋"
                color="blue"
                delay={200}
              />
              <StatCounter 
                value={99} 
                label="ACCURACY RATE" 
                suffix="%"
                icon="✅"
                color="amber"
                delay={400}
              />
            </div>

            {/* Search/Filter Info */}
            <div style={{ 
              padding: '12px', 
              backgroundColor: 'rgba(0, 255, 65, 0.05)', 
              border: '1px solid rgba(0, 255, 65, 0.2)',
              borderRadius: '4px',
              textAlign: 'center',
              fontSize: '0.9em'
            }}>
              <div className="terminal-text--green" style={{ marginBottom: '4px' }}>
                💡 Pro Tip: Click any question to expand the detailed answer
              </div>
              <div className="terminal-text--dim">
                Questions are organized by category and difficulty level
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Categories */}
        <div style={{ marginBottom: '32px' }}>
          {/* Methodology Questions */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ 
              fontSize: '1.3em', 
              marginBottom: '16px', 
              textAlign: 'center',
              color: 'var(--phosphor-green)',
              textShadow: '0 0 10px var(--phosphor-green)'
            }}>
              🔬 METHODOLOGY & DETECTION
            </div>
            
            <FAQItem
              question="How does Stupid Meter detect AI model degradation?"
              answer="Our system continuously monitors AI model performance through **automated benchmarking every 4 hours**. We execute 147 unique coding challenges against each model, measuring performance across 7 key axes. Statistical analysis using **z-score standardization** against 28-day rolling baselines detects significant performance drops. Our **CUSUM algorithm** identifies persistent degradation patterns that indicate when AI companies reduce model capability to save computational costs."
              category="methodology"
              isPopular={true}
              delay={0}
            />
            
            <FAQItem
              question="What exactly is the 'StupidScore' and how is it calculated?"
              answer="The StupidScore is our proprietary **weighted composite metric** calculated as: `StupidScore = Σ(weight_i × z_score_i)` where `z_score_i = (metric_i - μ_i) / σ_i`. Each performance axis has a specific weight: Correctness (35%), Specification (15%), Code Quality (15%), Efficiency (5%), Stability (15%), Refusal Rate (10%), Recovery (5%). The z-score standardization compares current performance against historical baselines. **Negative values indicate degradation** from historical performance, while positive values show improvement."
              category="methodology"
              isTechnical={true}
              delay={100}
            />
            
            <FAQItem
              question="How exactly do the 7 performance axes work?"
              answer="**CORRECTNESS (35%)**: Measures functional accuracy through 200+ automated unit tests per challenge, including edge cases, error handling, and runtime stability. **SPECIFICATION (15%)**: Validates adherence to function signatures, JSON schema compliance, documentation format, and code structure requirements. **CODE QUALITY (15%)**: Uses static analysis (ESLint, Pylint), measures cyclomatic complexity, detects code duplication, and validates naming conventions. **EFFICIENCY (5%)**: Tracks API latency (P50/P95/P99), token usage optimization, and algorithmic complexity. **STABILITY (15%)**: Tests consistency across multiple runs with different seeds and temperature settings. **REFUSAL RATE (10%)**: Detects inappropriate task rejections for legitimate coding requests. **RECOVERY (5%)**: Measures self-correction ability when provided with error feedback."
              category="methodology"
              isTechnical={true}
              delay={200}
            />
            
            <FAQItem
              question="What statistical methods ensure detection accuracy?"
              answer="We employ multiple statistical techniques for robust detection: **Mann-Whitney U Tests** for non-parametric significance testing, **PELT Algorithm** for change point detection to identify performance breakpoints, **Linear Regression with Confidence Intervals** for trend analysis, and **Seasonal Decomposition** to isolate genuine performance changes from cyclical patterns. Our **rolling 28-day baselines** use IQR outlier removal to maintain statistical validity, and we require **statistical significance (p < 0.05)** before flagging degradation."
              category="methodology"
              isTechnical={true}
              delay={300}
            />
          </div>

          {/* Technical Questions */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ 
              fontSize: '1.3em', 
              marginBottom: '16px', 
              textAlign: 'center',
              color: 'var(--amber-warning)',
              textShadow: '0 0 10px var(--amber-warning)'
            }}>
              ⚙️ TECHNICAL IMPLEMENTATION
            </div>
            
            <FAQItem
              question="How comprehensive are your anti-gaming measures?"
              answer="Our anti-gaming architecture includes: **Test Case Obfuscation** - 73% of test cases are hidden, with dynamic generation using parameterized templates and regular rotation from 2000+ unique challenges. **Execution Control** - Standardized parameters (temperature 0.3, top_p 0.95), deterministic seeds, multi-trial execution with median scoring. **Prompt Security** - SHA-256 hash verification, version control tracking, A/B testing framework, and regular human expert review. **Adversarial Testing** - Prompt injection resistance testing and overfitting prevention through adversarial examples."
              category="technical"
              isTechnical={true}
              delay={0}
            />
            
            <FAQItem
              question="What is your infrastructure reliability and monitoring coverage?"
              answer="Our system operates with **99.7% uptime SLA** across distributed infrastructure in 3 geographic regions. We monitor 12+ AI models continuously with automatic failover between redundant API keys. Real-time anomaly detection using isolation forests identifies system issues before they affect measurements. Our PostgreSQL database includes point-in-time recovery, and we maintain 30-day data retention for trend analysis. Performance metrics are validated through cross-checking multiple API endpoints and statistical correlation analysis."
              category="technical"
              isTechnical={true}
              delay={100}
            />
            
            <FAQItem
              question="What is the new Tool Calling evaluation system and how does it work?"
              answer="Our **world-first Tool Calling evaluation system** tests AI models' ability to use real system tools and execute multi-step workflows. Models must successfully use tools like execute-command, read-file, write-file, list-files, and search-files to complete complex tasks. We run these evaluations in secure sandbox environments with comprehensive error handling and real-time monitoring. This breakthrough allows us to measure practical AI capabilities beyond simple text generation, providing insights into how models perform in real-world scenarios requiring tool coordination and systematic problem-solving."
              category="technical"
              isPopular={true}
              isTechnical={true}
              delay={200}
            />
            
            <FAQItem
              question="How does the enhanced Intelligence Center improve model recommendations?"
              answer="Our redesigned **Intelligence Center features 29 comprehensive warning categories** across 5 major detection types: performance trends, cost-efficiency alerts, stability monitoring, regional variations, and service disruptions. The system provides real-time recommendations for 'Best for Code,' 'Most Reliable,' and 'Fastest Response' models based on current performance data. Our **proactive alert system** warns users about cost-performance issues and capability reductions before they impact your applications. The Intelligence Center also includes Provider Trust Scores that track reliability metrics across all AI providers, helping you make informed decisions about which services to depend on."
              category="technical"
              isPopular={true}
              delay={300}
            />
          </div>

          {/* Privacy & Ethics Questions */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ 
              fontSize: '1.3em', 
              marginBottom: '16px', 
              textAlign: 'center',
              color: 'var(--red-alert)',
              textShadow: '0 0 10px var(--red-alert)'
            }}>
              🛡️ PRIVACY & ETHICS
            </div>
            
            <FAQItem
              question="How do you ensure data privacy and ethical API usage?"
              answer="We maintain strict data privacy: only benchmark outputs and aggregated metrics are stored - never model weights, training data, or proprietary information. All API usage complies with provider Terms of Service through rate limiting, appropriate request patterns, and legitimate use cases. We undergo regular security audits and maintain SOC 2 compliance for data handling."
              category="privacy"
              isPopular={true}
              delay={0}
            />
            
            <FAQItem
              question="What does 'unavailable' status mean and why don't you show estimated scores?"
              answer="Models show 'unavailable' when we lack API access (missing keys), encounter consistent API failures, or detect rate limiting. We maintain **strict data integrity** - if we can't directly test a model, we never display estimated or interpolated scores. This ensures our rankings reflect only verified, real-time performance data. We believe showing fake scores would undermine trust in our methodology and mislead users making important AI model decisions."
              category="privacy"
              delay={100}
            />
          </div>

          {/* General Questions */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ 
              fontSize: '1.3em', 
              marginBottom: '16px', 
              textAlign: 'center',
              color: 'var(--terminal-text)',
              textShadow: '0 0 10px #00bfff'
            }}>
              ❓ GENERAL QUESTIONS
            </div>
            
            <FAQItem
              question="How accurate and representative are your performance measurements?"
              answer="Our measurements use **real production API calls** with actual latency, token usage, and response generation. We execute 5 trials per test and use median values to eliminate outliers. All scores derive from objective, measurable criteria: automated unit test pass rates, schema validation, linting scores, and performance benchmarks. We calibrate against human expert evaluations quarterly and maintain 99.7% measurement consistency. Our benchmarks represent real-world usage patterns from algorithm implementation to debugging scenarios."
              category="general"
              isPopular={true}
              delay={0}
            />
            
            <FAQItem
              question="Why focus on coding tasks rather than general language capabilities?"
              answer="Coding provides **objective, binary success criteria** - code either works or doesn't. Unlike subjective tasks (creative writing, opinion generation), programming tasks have verifiable outputs through automated testing. Code represents a significant portion of commercial AI usage and requires complex reasoning combining logic, syntax, problem-solving, and constraint satisfaction. Programming challenges also resist gaming since there are countless ways to implement solutions, making it impossible for providers to memorize all possible correct answers."
              category="general"
              delay={100}
            />
            
            <FAQItem
              question="How do you handle model updates and new releases?"
              answer="We automatically detect new model releases through API endpoint monitoring and provider announcements. New models undergo a **7-day calibration period** to establish statistical baselines before public scoring. Major model updates trigger re-baselining to ensure fair comparison. We maintain separate tracking for model versions (e.g., GPT-4 vs GPT-4-turbo) and clearly indicate when providers update models. Our version detection system flags undisclosed model changes by identifying statistical signatures in performance patterns."
              category="general"
              delay={200}
            />
            
            <FAQItem
              question="Can your methodology detect gradual performance degradation?"
              answer="Yes, our **CUSUM algorithm** specifically detects gradual drift that might escape simple threshold-based monitoring. We track cumulative deviations from baseline performance and flag persistent downward trends even when individual measurements remain within normal ranges. Our seasonal decomposition isolates genuine performance changes from expected variations (time of day, API load patterns). Change point detection identifies the specific timeframe when degradation began, enabling precise tracking of model capability reductions."
              category="general"
              delay={300}
            />
            
            <FAQItem
              question="What validation do you have for your scoring methodology?"
              answer="Our methodology undergoes regular validation through: **Human expert evaluation** where experienced developers assess model outputs and correlate with our scores, **Academic peer review** with submission to AI evaluation conferences, **Cross-validation** against established benchmarks like HumanEval and MBPP, and **Third-party audits** of our statistical methods and implementation. We maintain correlation coefficients above 0.85 with human expert rankings and publish detailed methodology papers for reproducibility."
              category="general"
              delay={400}
            />
            
            <FAQItem
              question="How do you differentiate between degradation and natural performance variations?"
              answer="We distinguish degradation from normal variation through multiple statistical filters: **Significance Testing** requiring p < 0.05 confidence levels, **Effect Size Analysis** ensuring detected changes are practically meaningful (Cohen's d > 0.5), **Duration Thresholds** requiring sustained degradation over 48+ hours, and **Magnitude Requirements** filtering out minor fluctuations below ±5% from baseline. Our algorithms account for expected variations from API load, time zones, and infrastructure changes while flagging genuine capability reductions."
              category="general"
              isTechnical={true}
              delay={500}
            />
            
            <FAQItem
              question="What makes your Tool Calling benchmarks different from other AI evaluations?"
              answer="Unlike traditional text-based evaluations, our Tool Calling system requires models to **execute actual system commands and coordinate multiple tools** to complete real-world tasks. Models must demonstrate practical capabilities like file manipulation, data processing, and multi-step problem solving in secure sandbox environments. We've completed **171+ successful tool calling sessions** that clearly differentiate model capabilities in ways that simple Q&A tests cannot. This evaluation method reveals which models can actually perform useful work versus those that only excel at generating plausible-sounding text responses."
              category="general"
              isPopular={true}
              delay={600}
            />
            
            <FAQItem
              question="What is the AI Smart Router and how does it use your benchmark data?"
              answer="Our **AI Smart Router** is an intelligent API gateway that automatically selects the best AI model for each request based on our real-time benchmark data. Instead of manually choosing between GPT, Claude, Grok, or Gemini, the router analyzes your request and picks the optimal model using live performance rankings updated every 4 hours. You can choose from **6 routing strategies**: Best Overall (recommended), Best for Coding, Best for Reasoning, Best for Creative, Most Cost-Effective, or Fastest Response. The router uses our 7-axis scoring system (correctness, code quality, efficiency, stability, etc.) to make intelligent decisions, helping you **save 50-70% on AI costs** while maintaining quality. It includes automatic failover, custom constraints (max cost, latency limits), and detailed analytics. Available as part of our Pro subscription at $4.99/month with a 7-day free trial."
              category="general"
              isPopular={true}
              delay={700}
            />
          </div>
        </div>

        {/* Call to Action */}
        <div className="crt-monitor">
          <div className="terminal-text" style={{ textAlign: 'center' }}>
            <div className="terminal-text--green" style={{ 
              fontSize: '1.4em', 
              marginBottom: '16px',
              textShadow: '0 0 15px var(--phosphor-green)'
            }}>
              🤔 STILL HAVE QUESTIONS?
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '1.0em', marginBottom: '24px' }}>
              Join our community for real-time discussions and expert insights
            </div>
            
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '24px' }}>
              <a
                href="https://www.reddit.com/r/AIStupidLevel/"
                target="_blank"
                rel="noopener noreferrer"
                className="vintage-btn"
                style={{ 
                  padding: '12px 24px',
                  textDecoration: 'none',
                  display: 'inline-block'
                }}
              >
                JOIN REDDIT COMMUNITY
              </a>
              <a
                href="https://x.com/AIStupidlevel"
                target="_blank"
                rel="noopener noreferrer"
                className="vintage-btn"
                style={{ 
                  padding: '12px 24px',
                  textDecoration: 'none',
                  display: 'inline-block'
                }}
              >
                FOLLOW ON X
              </a>
            </div>
            
            <button 
              onClick={() => setSelectedView('dashboard')}
              className="vintage-btn vintage-btn--active" 
              style={{ 
                padding: '12px 32px',
                fontSize: '1.1em',
                boxShadow: '0 0 20px rgba(0, 255, 65, 0.5)'
              }}
            >
              BACK TO LIVE RANKINGS
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            {/* Header */}
            <div style={{ 
              fontSize: 'var(--font-size-xl)', 
              marginBottom: 'var(--space-lg)',
              wordWrap: 'break-word'
            }}>
              <span className="terminal-text--green">STUPID METER</span>
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
            
            {/* Rotating loading message */}
            {loadingMessage && (
              <div style={{ 
                fontSize: 'var(--font-size-sm)',
                marginBottom: 'var(--space-md)',
                padding: 'var(--space-sm)',
                background: 'rgba(0, 255, 65, 0.05)',
                border: '1px solid rgba(0, 255, 65, 0.2)',
                borderRadius: '4px',
                minHeight: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}>
                <span className="terminal-text--dim">{loadingMessage}</span>
              </div>
            )}
            
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
                  ⏳ Fetching live model rankings...
                </div>
                <div>
                  This may take a moment as we gather real-time data from multiple sources.
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
          <ThemeButton />
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
          <button 
            onClick={() => router.push('/router')}
            className="vintage-btn"
            style={{
              backgroundColor: '#00BFFF',
              color: '#00BFFF',
              fontWeight: 'bold',
              border: '2px solid #00BFFF',
              boxShadow: '0 0 10px #00BFFF'
            }}
          >
            PRO
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
              {(isLeaderboardUIBusy || showBatchRefreshing) && <span className="vintage-loading" style={{ marginLeft: '8px' }}></span>}
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

          {/* Loading Overlay */}
          {isLeaderboardUIBusy && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              borderRadius: '4px'
            }}>
              <div style={{
                fontSize: '3em',
                marginBottom: '16px',
                animation: 'spin 1s linear infinite'
              }}>
                ⚡
              </div>
              <div className="terminal-text--green" style={{ fontSize: '1.2em', marginBottom: '8px' }}>
                UPDATING RANKINGS
              </div>
              <div className="vintage-loading" style={{ fontSize: '1.5em' }}></div>
              <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginTop: '12px' }}>
                Fetching latest scores...
              </div>
            </div>
          )}

          {/* Price View Explanation - Shows when price sorting is active */}
          {leaderboardSortBy === 'price' && (
            <div style={{
              padding: '12px',
              backgroundColor: 'rgba(0, 255, 65, 0.05)',
              border: '1px solid rgba(0, 255, 65, 0.2)',
              borderRadius: '4px',
              marginBottom: '12px'
            }}>
              <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                Value Rankings (Performance per Dollar)
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em', lineHeight: '1.5' }}>
                Models sorted by <strong>pts/$</strong> (points per dollar) - the best quality-to-cost ratio.
                Higher values = better value. Example: 238 pts/$ means you get 238 quality points for every $1 spent.
              </div>
            </div>
          )}

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
                    disabled={isLeaderboardUIBusy}
                  >
                    LATEST
                  </button>
                  <button
                    onClick={() => {
                      if (!hasProAccess) {
                        setProModalFeature('historical-data');
                        setShowProModal(true);
                      } else {
                        setLeaderboardPeriod('24h');
                      }
                    }}
                    className={`vintage-btn ${leaderboardPeriod === '24h' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 6px', 
                      fontSize: '0.7em',
                      minHeight: '20px'
                    }}
                    disabled={isLeaderboardUIBusy}
                  >
                    24H {!hasProAccess && '🔒'}
                  </button>
                  <button
                    onClick={() => {
                      if (!hasProAccess) {
                        setProModalFeature('historical-data');
                        setShowProModal(true);
                      } else {
                        setLeaderboardPeriod('7d');
                      }
                    }}
                    className={`vintage-btn ${leaderboardPeriod === '7d' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 6px', 
                      fontSize: '0.7em',
                      minHeight: '20px'
                    }}
                    disabled={isLeaderboardUIBusy}
                  >
                    7D {!hasProAccess && '🔒'}
                  </button>
                  <button
                    onClick={() => {
                      if (!hasProAccess) {
                        setProModalFeature('historical-data');
                        setShowProModal(true);
                      } else {
                        setLeaderboardPeriod('1m');
                      }
                    }}
                    className={`vintage-btn ${leaderboardPeriod === '1m' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 6px', 
                      fontSize: '0.7em',
                      minHeight: '20px'
                    }}
                    disabled={isLeaderboardUIBusy}
                  >
                    1M {!hasProAccess && '🔒'}
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
                    disabled={isLeaderboardUIBusy}
                  >
                    LATEST
                  </button>
                  <button
                    onClick={() => {
                      if (!hasProAccess) {
                        setProModalFeature('historical-data');
                        setShowProModal(true);
                      } else {
                        setLeaderboardPeriod('24h');
                      }
                    }}
                    className={`vintage-btn ${leaderboardPeriod === '24h' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 8px', 
                      fontSize: '0.75em',
                      minHeight: '22px'
                    }}
                    disabled={isLeaderboardUIBusy}
                  >
                    24H {!hasProAccess && '🔒'}
                  </button>
                  <button
                    onClick={() => {
                      if (!hasProAccess) {
                        setProModalFeature('historical-data');
                        setShowProModal(true);
                      } else {
                        setLeaderboardPeriod('7d');
                      }
                    }}
                    className={`vintage-btn ${leaderboardPeriod === '7d' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 8px', 
                      fontSize: '0.75em',
                      minHeight: '22px'
                    }}
                    disabled={isLeaderboardUIBusy}
                  >
                    7D {!hasProAccess && '🔒'}
                  </button>
                  <button
                    onClick={() => {
                      if (!hasProAccess) {
                        setProModalFeature('historical-data');
                        setShowProModal(true);
                      } else {
                        setLeaderboardPeriod('1m');
                      }
                    }}
                    className={`vintage-btn ${leaderboardPeriod === '1m' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 8px', 
                      fontSize: '0.75em',
                      minHeight: '22px'
                    }}
                    disabled={isLeaderboardUIBusy}
                  >
                    1M {!hasProAccess && '🔒'}
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

          {/* PHASE 3: Dashboard View Mode Switcher */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '16px',
            padding: '12px',
            background: 'rgba(0, 255, 65, 0.03)',
            borderRadius: '4px',
            border: '1px solid rgba(0, 255, 65, 0.15)'
          }}>
            <button
              className={`vintage-btn ${dashboardMode === 'leaderboard' ? 'vintage-btn--active' : ''}`}
              onClick={() => setDashboardMode('leaderboard')}
              style={{ flex: 1, padding: '8px 16px' }}
            >
              📊 Leaderboard
            </button>
            <button
              className={`vintage-btn ${dashboardMode === 'drift' ? 'vintage-btn--active' : ''}`}
              onClick={() => setDashboardMode('drift')}
              style={{ flex: 1, padding: '8px 16px' }}
            >
              🔍 Drift Monitor
            </button>
          </div>

          {/* PHASE 3: Drift Heatmap (shown in drift mode) */}
          {dashboardMode === 'drift' && (
            <div style={{ marginBottom: '24px', maxWidth: '100%', overflow: 'hidden' }}>
              <DriftHeatmap models={modelScores} />
            </div>
          )}

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
                            {model.usesReasoningEffort && (
                              <span style={{
                                backgroundColor: '#00BFFF',
                                color: 'var(--terminal-black)',
                                fontSize: '0.6em',
                                fontWeight: 'bold',
                                padding: '2px 4px',
                                borderRadius: '2px',
                                cursor: 'help'
                              }}
                              title="Uses extended thinking for more accurate responses (slower inference)">
                                🧠
                              </span>
                            )}
                            {/* Drift Warning Indicator */}
                            {(() => {
                              // Check if this model has recent drift incidents
                              const modelDriftIncidents = driftIncidents.filter((incident: any) => 
                                incident.modelName?.toLowerCase() === model.name.toLowerCase() ||
                                incident.modelId === parseInt(model.id)
                              );
                              
                              if (modelDriftIncidents.length === 0) return null;
                              
                              // Find the most severe recent incident
                              const criticalIncidents = modelDriftIncidents.filter((inc: any) => inc.severity === 'critical');
                              const warningIncidents = modelDriftIncidents.filter((inc: any) => inc.severity === 'warning');
                              
                              const mostSevere = criticalIncidents.length > 0 ? criticalIncidents[0] : 
                                               warningIncidents.length > 0 ? warningIncidents[0] : 
                                               modelDriftIncidents[0];
                              
                              if (!mostSevere) return null;
                              
                              const isCritical = mostSevere.severity === 'critical';
                              const hoursAgo = Math.round((Date.now() - new Date(mostSevere.detectedAt).getTime()) / (1000 * 60 * 60));
                              
                              return (
                                <span 
                                  style={{
                                    backgroundColor: isCritical ? 'var(--red-alert)' : 'var(--amber-warning)',
                                    color: 'var(--terminal-black)',
                                    fontSize: '0.6em',
                                    fontWeight: 'bold',
                                    padding: '2px 4px',
                                    borderRadius: '2px',
                                    cursor: 'help',
                                    animation: isCritical ? 'pulse 2s infinite' : 'none'
                                  }}
                                  title={`${mostSevere.incidentType.replace('_', ' ').toUpperCase()}: ${mostSevere.description} (${hoursAgo}h ago)`}
                                >
                                  {isCritical ? '🚨' : '⚠️'}
                                </span>
                              );
                            })()}
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

          {/* Drift Incidents */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '1.1em', marginBottom: '8px' }}>
              <span className="terminal-text--red">🚨 DRIFT INCIDENTS (7 DAYS)</span>
            </div>
            {driftIncidents && driftIncidents.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '8px' }}>
                {driftIncidents.slice(0, 6).map((incident: any, index: number) => {
                  // FIXED: Human-friendly time formatting
                  const msAgo = Date.now() - new Date(incident.detectedAt).getTime();
                  const minutesAgo = Math.round(msAgo / (1000 * 60));
                  const hoursAgo = Math.round(msAgo / (1000 * 60 * 60));
                  const daysAgo = Math.round(msAgo / (1000 * 60 * 60 * 24));
                  
                  let timeAgo: string;
                  if (minutesAgo < 1) {
                    timeAgo = 'Just now';
                  } else if (minutesAgo < 60) {
                    timeAgo = `${minutesAgo}m ago`;
                  } else if (hoursAgo < 24) {
                    timeAgo = `${hoursAgo}h ago`;
                  } else if (daysAgo < 7) {
                    timeAgo = `${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
                  } else {
                    const weeksAgo = Math.round(daysAgo / 7);
                    timeAgo = `${weeksAgo} week${weeksAgo === 1 ? '' : 's'} ago`;
                  }
                  
                  const isCritical = incident.severity === 'critical';
                  
                  return (
                    <div key={index} style={{ 
                      padding: '8px', 
                      border: `1px solid ${isCritical ? 'rgba(255, 45, 0, 0.3)' : 'rgba(255, 176, 0, 0.3)'}`,
                      backgroundColor: `${isCritical ? 'rgba(255, 45, 0, 0.05)' : 'rgba(255, 176, 0, 0.05)'}`,
                      fontSize: '0.85em',
                      cursor: 'pointer'
                    }}
                    onClick={() => router.push(`/models/${incident.modelId}`)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span className="terminal-text" style={{ fontWeight: 'bold' }}>
                          {incident.modelName?.toUpperCase() || 'UNKNOWN MODEL'}
                        </span>
                        <span style={{
                          backgroundColor: isCritical ? 'var(--red-alert)' : 'var(--amber-warning)',
                          color: 'var(--terminal-black)',
                          fontSize: '0.75em',
                          fontWeight: 'bold',
                          padding: '2px 6px',
                          borderRadius: '2px'
                        }}>
                          {incident.severity.toUpperCase()}
                        </span>
                      </div>
                      <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '4px' }}>
                        {incident.incidentType.replace('_', ' ').toUpperCase()}
                      </div>
                      <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '4px' }}>
                        {incident.description}
                      </div>
                      <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                        {timeAgo}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ 
                padding: '12px', 
                border: '1px solid rgba(0, 255, 65, 0.3)',
                backgroundColor: 'rgba(0, 255, 65, 0.05)',
                fontSize: '0.85em',
                textAlign: 'center'
              }}>
                <span className="terminal-text--green">✅ No drift incidents detected in the past 7 days</span>
                <br/>
                <span className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                  All models are performing within expected stability ranges
                </span>
              </div>
            )}
          </div>

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
          A product of{' '}
          <a 
            href="https://studioplatforms.eu" 
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
            Studio Platforms
          </a>
          {' '} • © 2026
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
          {' '} • Star us on GitHub!
        </div>
        <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginTop: '8px' }}>
          <a 
            href="https://huggingface.co/spaces/AIStupidLevel/" 
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
            🤗 Hugging Face Space
          </a>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="mobile-nav">
        <button 
          className={getButtonClassName('dashboard').replace('vintage-btn', 'mobile-nav-btn')}
          onClick={() => {
            setSelectedView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          style={{ flexShrink: 0, minWidth: '70px' }}
        >
          DASH
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ThemeButton />
        </div>
        <button 
          className={getButtonClassName('about').replace('vintage-btn', 'mobile-nav-btn')}
          onClick={() => setSelectedView('about')}
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
          className={getButtonClassName('faq').replace('vintage-btn', 'mobile-nav-btn')}
          onClick={() => setSelectedView('faq')}
          style={{ flexShrink: 0, minWidth: '60px' }}
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
            maxWidth: window.innerWidth < 768 ? '500px' : '700px', // Wider on desktop
            width: '95%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: window.innerWidth < 768 ? '16px' : '32px',
            backgroundColor: 'var(--terminal-black)',
            border: window.innerWidth < 768 ? '2px solid var(--phosphor-green)' : '3px solid var(--phosphor-green)',
            borderRadius: '6px',
            boxShadow: '0 0 20px var(--phosphor-green)'
          }}>
            <div className="terminal-text">
              {welcomeStep === 'updates' && (
                <>
                  <div style={{ fontSize: window.innerWidth < 768 ? '1.1em' : '1.5em', marginBottom: '12px', textAlign: 'center' }}>
                    <span className="terminal-text--green">🔬 WELCOME TO AI STUPID METER</span>
                    <span className="blinking-cursor"></span>
                  </div>
                  
                  <div style={{ marginBottom: '16px', lineHeight: '1.4', textAlign: 'center' }}>
                    <div className="terminal-text--dim" style={{ fontSize: window.innerWidth < 768 ? '0.85em' : '0.95em', marginBottom: '12px' }}>
                      Track real-time AI model performance across GPT, Claude, Grok & Gemini
                    </div>
                    
                    <div style={{ 
                      padding: window.innerWidth < 768 ? '12px' : '16px', 
                      backgroundColor: 'rgba(0, 255, 65, 0.1)', 
                      border: '2px solid rgba(0, 255, 65, 0.3)',
                      borderRadius: '6px',
                      marginBottom: '12px',
                      fontSize: window.innerWidth < 768 ? '0.8em' : '0.9em'
                    }}>
                      <div className="terminal-text--green" style={{ marginBottom: '8px', fontWeight: 'bold' }}>
                        ✓ Free Features You Get:
                      </div>
                      <div className="terminal-text--dim" style={{ textAlign: 'left', marginLeft: '16px' }}>
                        • Live model rankings updated every 4 hours<br/>
                        • Real-time degradation alerts<br/>
                        • 171+ benchmark results across 16+ models<br/>
                        • Model Intelligence Center with recommendations
                      </div>
                    </div>

                    <div style={{ 
                      padding: window.innerWidth < 768 ? '10px' : '12px', 
                      backgroundColor: 'rgba(0, 191, 255, 0.08)', 
                      border: '1px solid rgba(0, 191, 255, 0.3)',
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}>
                      <div className="terminal-text--amber" style={{ fontSize: window.innerWidth < 768 ? '0.85em' : '0.9em', marginBottom: '4px' }}>
                        💎 Want automated AI routing?
                      </div>
                      <div className="terminal-text--dim" style={{ fontSize: window.innerWidth < 768 ? '0.75em' : '0.8em' }}>
                        AI Router Pro available • $4.99/mo • 7-day free trial
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <button 
                      onClick={() => handleWelcomeStep('privacy')}
                      className="vintage-btn vintage-btn--active"
                      style={{ padding: window.innerWidth < 768 ? '10px 24px' : '12px 32px', fontSize: window.innerWidth < 768 ? '1.0em' : '1.1em' }}
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

      {/* Pro Feature Modal */}
      <ProFeatureModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
        feature={proModalFeature}
      />

      {/* Share Button - Floating */}
      <ShareButton 
        type="rankings" 
        data={{ 
          modelScores: modelScores.slice(0, 3),
          globalIndex 
        }} 
      />

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
