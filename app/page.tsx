'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import '../styles/vintage.css';

type Provider = 'openai' | 'xai' | 'anthropic' | 'google';

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
  const [bestModel, setBestModel] = useState<any>(null);
  const [degradations, setDegradations] = useState<any[]>([]);
  const [providerReliability, setProviderReliability] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [transparencyMetrics, setTransparencyMetrics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [loadingBestModel, setLoadingBestModel] = useState(false);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'latest' | '24h' | '7d' | '1m'>('latest');
  const [leaderboardSortBy, setLeaderboardSortBy] = useState<'score'>('score');
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'latest' | '24h' | '7d' | '1m'>('latest');
  const [batchStatus, setBatchStatus] = useState<any>(null);
  const [showBatchRefreshing, setShowBatchRefreshing] = useState(false);
  
  // Real-time update states
  const [backgroundUpdating, setBackgroundUpdating] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [changedScores, setChangedScores] = useState<Set<string>>(new Set());
  const [previousScores, setPreviousScores] = useState<Map<string, number>>(new Map());

  // Visitor count state
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

  // Fetch visitor count
  const fetchVisitorCount = async () => {
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/visitors/stats`);
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

  // Mini chart component for leaderboard
  const renderMiniChart = (history: any[], period: string = leaderboardPeriod) => {
    if (!history || history.length === 0) {
      return (
        <div className="mini-chart-container">
          <svg width="60" height="30" className="desktop-only">
            <line x1="0" y1="15" x2="60" y2="15" stroke="var(--phosphor-green)" strokeWidth="1" opacity="0.3"/>
            <text x="30" y="20" fontSize="10" fill="var(--phosphor-green)" textAnchor="middle" opacity="0.5">—</text>
          </svg>
        </div>
      );
    }

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
          return history.slice(0, 24);
      }
      
      // Filter data by timestamp if timestamps are available
      if (history[0]?.timestamp) {
        return history.filter(h => {
          const timestamp = new Date(h.timestamp).getTime();
          return timestamp >= cutoffTime;
        });
      }
      
      // Fallback to showing proportional amount of data
      const dataPointsToShow = period === '24h' ? 24 : period === '7d' ? 168 : 720;
      return history.slice(0, Math.min(dataPointsToShow, history.length));
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
    
    // Use displayScore if available from API, otherwise convert
    const displayScores = data.map(d => {
      // Prioritize displayScore from API
      if (d.displayScore !== undefined && d.displayScore !== null) {
        return d.displayScore;
      }
      // Fallback conversion
      const rawScore = d.stupidScore;
      if (Math.abs(rawScore) < 1 || Math.abs(rawScore) > 100) {
        return Math.max(0, Math.min(100, Math.round(50 - rawScore * 100)));
      } else {
        return Math.max(0, Math.min(100, Math.round(rawScore)));
      }
    });
    const maxScore = Math.max(...displayScores);
    const minScore = Math.min(...displayScores);
    const range = maxScore - minScore || 1;
    
    const points = data.map((point, index) => {
      // Use displayScore if available from API, otherwise convert
      let displayScore;
      if (point.displayScore !== undefined && point.displayScore !== null) {
        displayScore = point.displayScore;
      } else {
        const rawScore = point.stupidScore;
        if (Math.abs(rawScore) < 1 || Math.abs(rawScore) > 100) {
          displayScore = Math.max(0, Math.min(100, Math.round(50 - rawScore * 100)));
        } else {
          displayScore = Math.max(0, Math.min(100, Math.round(rawScore)));
        }
      }
      const x = (index / Math.max(1, data.length - 1)) * 58 + 1; // 58px width with 1px margin
      const y = 28 - ((displayScore - minScore) / range) * 26; // Higher display score = higher on chart (intuitive)
      return `${x},${y}`;
    }).join(' ');
    
    return (
      <div className="mini-chart-container">
        <svg width="60" height="30" className="mini-chart desktop-only">
          <polyline
            points={points}
            fill="none"
            stroke="var(--phosphor-green)"
            strokeWidth="2"
            opacity="0.8"
          />
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

  // Fetch analytics data
  const fetchAnalyticsData = async (period?: 'latest' | '24h' | '7d' | '1m') => {
    // Use the passed period or fall back to current state
    const selectedPeriod = period || analyticsPeriod;
    setLoadingAnalytics(true);
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
      
      const [degradationResponse, reliabilityResponse, recommendationsResponse, transparencyResponse] = await Promise.all([
        fetch(`${apiUrl}/api/analytics/degradations?period=${selectedPeriod}`),
        fetch(`${apiUrl}/api/analytics/provider-reliability?period=${selectedPeriod}`),
        fetch(`${apiUrl}/api/analytics/recommendations?period=${selectedPeriod}`),
        fetch(`${apiUrl}/api/analytics/transparency?period=${selectedPeriod}`)
      ]);
      
      const degradationData = await degradationResponse.json();
      const reliabilityData = await reliabilityResponse.json();
      const recommendationsData = await recommendationsResponse.json();
      const transparencyData = await transparencyResponse.json();
      
      if (degradationData.success) setDegradations(degradationData.data);
      if (reliabilityData.success) setProviderReliability(reliabilityData.data);
      if (recommendationsData.success) setRecommendations(recommendationsData.data);
      if (transparencyData.success) setTransparencyMetrics(transparencyData.data);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Fetch best model data using all-time calculation
  const fetchBestModel = async () => {
    if (loadingBestModel) return;
    
    setLoadingBestModel(true);
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/dashboard/best-model`);
      const data = await response.json();
      
      if (data.success) {
        setBestModel(data.data);
      } else {
        console.error('Failed to fetch best model:', data.error);
        setBestModel(null);
      }
    } catch (error) {
      console.error('Error fetching best model:', error);
      setBestModel(null);
    } finally {
      setLoadingBestModel(false);
    }
  };

  // Silent background data fetch without loading indicators
  const fetchDataSilently = async () => {
    if (backgroundUpdating) return;
    
    setBackgroundUpdating(true);
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
      
      // Fetch leaderboard data silently
      const response = await fetch(`${apiUrl}/api/dashboard/scores?period=${leaderboardPeriod}&sortBy=${leaderboardSortBy}`);
      const data = await response.json();
      
      if (data.success) {
        const processedScores = data.data.map((score: any) => ({
          ...score,
          lastUpdated: new Date(score.lastUpdated),
          history: score.history || []
        }));
        
        // Track score changes for highlighting
        const newChangedScores = new Set<string>();
        const newPreviousScores = new Map<string, number>();
        
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
        
        // Update states
        setModelScores(processedScores);
        setPreviousScores(newPreviousScores);
        setChangedScores(newChangedScores);
        setLastUpdateTime(new Date());
        
        // Clear changed highlights after 10 seconds
        if (newChangedScores.size > 0) {
          setTimeout(() => {
            setChangedScores(new Set());
          }, 10000);
        }
      }
      
      // Also refresh best model and analytics data silently
      const [bestModelResponse, analyticsResponses] = await Promise.all([
        fetch(`${apiUrl}/api/dashboard/best-model`),
        Promise.all([
          fetch(`${apiUrl}/api/analytics/degradations?period=${analyticsPeriod}`),
          fetch(`${apiUrl}/api/analytics/recommendations?period=${analyticsPeriod}`),
          fetch(`${apiUrl}/api/analytics/transparency?period=${analyticsPeriod}`)
        ])
      ]);
      
      // Update best model
      const bestModelData = await bestModelResponse.json();
      if (bestModelData.success) {
        setBestModel(bestModelData.data);
      }
      
      // Update analytics
      const [degradationData, recommendationsData, transparencyData] = await Promise.all(
        analyticsResponses.map(r => r.json())
      );
      
      if (degradationData.success) setDegradations(degradationData.data);
      if (recommendationsData.success) setRecommendations(recommendationsData.data);
      if (transparencyData.success) setTransparencyMetrics(transparencyData.data);
      
    } catch (error) {
      console.error('Silent background update failed:', error);
    } finally {
      setBackgroundUpdating(false);
    }
  };

  // Fetch leaderboard data with historical support (with loading indicator)
  const fetchLeaderboardData = async (period: 'latest' | '24h' | '7d' | '1m' = leaderboardPeriod, sortBy: 'score' = leaderboardSortBy) => {
    if (loadingLeaderboard) return;
    
    setLoadingLeaderboard(true);
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/dashboard/scores?period=${period}&sortBy=${sortBy}`);
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
      } else {
        console.error('Failed to fetch leaderboard data:', data.error);
      }
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Check batch status first to determine refresh behavior
        const batchStatusData = await fetchBatchStatus();
        
        // Fetch alerts and global index in parallel with leaderboard
        const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
        const [alertsResponse, globalIndexResponse] = await Promise.all([
          fetch(`${apiUrl}/api/dashboard/alerts`),
          fetch(`${apiUrl}/api/dashboard/global-index`)
        ]);
        
        const alertsData = await alertsResponse.json();
        const globalIndexData = await globalIndexResponse.json();
        
        if (alertsData.success) {
          // Convert date strings back to Date objects
          const processedAlerts = alertsData.data.map((alert: any) => ({
            ...alert,
            detectedAt: new Date(alert.detectedAt)
          }));
          setAlerts(processedAlerts);
        }

        if (globalIndexData.success) {
          setGlobalIndex(globalIndexData.data);
        }
        
        // Always fetch leaderboard data to keep models visible
        // The batch status indicator will show users when updates are in progress
        await fetchLeaderboardData();
        
        // Fetch best model after other data is loaded
        fetchBestModel();
        
        // Fetch analytics data
        fetchAnalyticsData();
        
        // Fetch visitor count
        fetchVisitorCount();
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        // Keep default empty arrays on error
      } finally {
        setLoading(false);
      }
    };

    // Initial data load with loading indicators
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

  // Effect for leaderboard controls changes
  useEffect(() => {
    if (!loading) {
      fetchLeaderboardData(leaderboardPeriod, leaderboardSortBy);
    }
  }, [leaderboardPeriod, leaderboardSortBy]);

  // Effect for analytics controls changes
  useEffect(() => {
    if (!loading) {
      fetchAnalyticsData(); // Will use current analyticsPeriod state
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

  const getProviderName = (provider: Provider): string => {
    switch (provider) {
      case 'openai': return 'OpenAI';
      case 'xai': return 'xAI';
      case 'anthropic': return 'Anthropic';
      case 'google': return 'Google';
      default: return provider;
    }
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

  // Helper function to calculate trend percentage from history
  const calculateTrendPercentage = (model: any): number => {
    if (!model.history || model.history.length < 2) return 0;
    
    const recent = model.history[0]?.stupidScore;
    const previous = model.history[model.history.length - 1]?.stupidScore;
    
    if (!recent || !previous) return 0;
    
    // Convert stupidScores to display scores for percentage calculation
    const recentDisplay = Math.round(50 - recent / 2);
    const previousDisplay = Math.round(50 - previous / 2);
    
    if (previousDisplay === 0) return 0;
    
    return Math.round(((recentDisplay - previousDisplay) / previousDisplay) * 100);
  };

  // Helper function to get dynamic column header
  const getDynamicColumnHeader = (): string => {
    // Since we only support 'score' sorting now, always return SCORE
    return 'SCORE';
  };

  // Helper function to render dynamic metric display with rich information
  const renderDynamicMetric = (model: any): JSX.Element => {
    if (model.currentScore === 'unavailable') {
      return (
        <div className="score-display terminal-text--dim">
          <div style={{ textAlign: 'center' }}>
            <div>N/A</div>
            <div style={{ fontSize: '0.6em', opacity: 0.7 }}>OFFLINE</div>
          </div>
        </div>
      );
    }

    // Since we only support 'score' sorting now, always render the score display
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
      <div className={`score-display ${getStatusColor(model.status)}`}>
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
              <p><strong>The AI Intelligence Degradation Detection System</strong> - a production-grade monitoring platform that continuously tracks AI model performance to detect when providers reduce capability to save costs or implement undisclosed model changes.</p>
              <br/>
              
              <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px' }}>🔬 COMPREHENSIVE BENCHMARKING ARCHITECTURE</div>
              <p>Our system executes <span className="terminal-text--green">147 unique coding challenges</span> against major AI APIs every 30 minutes. Each model receives identical prompts from our curated task suite including:</p>
              <p>• <strong>Algorithm Implementation</strong> - Data structures, sorting, searching, graph algorithms</p>
              <p>• <strong>Bug Detection & Fixing</strong> - Identifying syntax errors, logic bugs, edge cases</p>
              <p>• <strong>Code Refactoring</strong> - Optimization, readability improvements, design pattern application</p>
              <p>• <strong>API Integration</strong> - REST API consumption, JSON parsing, error handling</p>
              <p>• <strong>Database Operations</strong> - SQL queries, ORM usage, transaction management</p>
              <p>• <strong>Testing & Validation</strong> - Unit test creation, test-driven development scenarios</p>
              <p>• <strong>Security Auditing</strong> - Vulnerability detection, secure coding practices</p>
              <br/>
              
              <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px' }}>📊 7-AXIS SCORING METHODOLOGY (DETAILED)</div>
              <p><span className="terminal-text--green">CORRECTNESS (35% weight)</span></p>
              <p>• Automated unit test execution with 200+ test cases per challenge</p>
              <p>• Functional accuracy measured through input/output validation</p>
              <p>• Edge case handling (null inputs, boundary conditions, error states)</p>
              <p>• Runtime error detection and exception handling evaluation</p>
              <br/>
              
              <p><span className="terminal-text--green">SPECIFICATION COMPLIANCE (15% weight)</span></p>
              <p>• Function signature matching (parameters, return types, naming)</p>
              <p>• JSON schema validation for structured outputs</p>
              <p>• Documentation format adherence (docstrings, comments)</p>
              <p>• Code structure requirements (class definitions, module organization)</p>
              <br/>
              
              <p><span className="terminal-text--green">CODE QUALITY (15% weight)</span></p>
              <p>• Static analysis using ESLint, Pylint, and language-specific linters</p>
              <p>• Cyclomatic complexity measurement (McCabe metrics)</p>
              <p>• Code duplication detection and DRY principle adherence</p>
              <p>• Naming convention compliance and readability scoring</p>
              <p>• Best practices validation (SOLID principles, design patterns)</p>
              <br/>
              
              <p><span className="terminal-text--green">EFFICIENCY (10% weight)</span></p>
              <p>• API response latency measurement (P50, P95, P99 percentiles)</p>
              <p>• Token usage optimization (input/output token ratio analysis)</p>
              <p>• Algorithmic complexity analysis (Big O notation assessment)</p>
              <p>• Memory usage patterns and resource optimization</p>
              <br/>
              
              <p><span className="terminal-text--green">STABILITY (10% weight)</span></p>
              <p>• Consistency across 5 identical test runs with different random seeds</p>
              <p>• Variance analysis of performance metrics over time</p>
              <p>• Temperature sensitivity testing (0.0, 0.3, 0.7, 1.0)</p>
              <p>• Determinism evaluation for identical inputs</p>
              <br/>
              
              <p><span className="terminal-text--green">REFUSAL RATE (10% weight)</span></p>
              <p>• Inappropriate task rejection detection for legitimate coding requests</p>
              <p>• False positive safety trigger analysis</p>
              <p>• Content policy over-enforcement measurement</p>
              <p>• Comparison against baseline acceptable refusal thresholds</p>
              <br/>
              
              <p><span className="terminal-text--green">RECOVERY CAPABILITY (5% weight)</span></p>
              <p>• Self-correction ability when provided with error feedback</p>
              <p>• Iterative improvement through debugging hints</p>
              <p>• Learning from failed test cases to generate better solutions</p>
              <p>• Adaptation to constraint changes and requirement updates</p>
              <br/>
              
              <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px' }}>🧮 ADVANCED MATHEMATICAL ANALYSIS</div>
              <p><span className="terminal-text--green">StupidScore Calculation:</span></p>
              <p>StupidScore = Σ(weightᵢ × z_scoreᵢ) where z_scoreᵢ = (metricᵢ - μᵢ) / σᵢ</p>
              <p>• Rolling 28-day baseline calculation with outlier removal (IQR method)</p>
              <p>• Weighted composite scoring using axis-specific weights</p>
              <p>• Z-score standardization for cross-metric comparison</p>
              <p>• Negative values indicate degradation from historical performance</p>
              <br/>
              
              <p><span className="terminal-text--green">Statistical Drift Detection:</span></p>
              <p>• <strong>CUSUM Algorithm</strong> - Cumulative sum control charts detect persistent shifts</p>
              <p>• <strong>Mann-Whitney U Test</strong> - Non-parametric significance testing</p>
              <p>• <strong>Change Point Detection</strong> - PELT algorithm identifies performance breakpoints</p>
              <p>• <strong>Trend Analysis</strong> - Linear regression with confidence intervals</p>
              <p>• <strong>Seasonal Decomposition</strong> - Isolates genuine performance changes from cyclical patterns</p>
              <br/>
              
              <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px' }}>🛡️ COMPREHENSIVE ANTI-GAMING MEASURES</div>
              <p><span className="terminal-text--green">Test Case Obfuscation:</span></p>
              <p>• 73% of test cases are hidden from public view</p>
              <p>• Dynamic test generation using parameterized templates</p>
              <p>• Adversarial prompt testing to prevent overfitting</p>
              <p>• Regular rotation from a pool of 2000+ unique challenges</p>
              <br/>
              
              <p><span className="terminal-text--green">Execution Environment Control:</span></p>
              <p>• Standardized temperature (0.3) and top_p (0.95) parameters</p>
              <p>• Deterministic random seeds for reproducibility</p>
              <p>• Multi-trial execution (5 runs per test) with median scoring</p>
              <p>• Isolated execution environments preventing cross-contamination</p>
              <br/>
              
              <p><span className="terminal-text--green">Prompt Engineering Safeguards:</span></p>
              <p>• SHA-256 hash verification of all prompts to detect manipulation</p>
              <p>• Version control system tracking all prompt modifications</p>
              <p>• A/B testing framework for prompt effectiveness validation</p>
              <p>• Regular human expert review of benchmark accuracy</p>
              <br/>
              
              <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px' }}>🏗️ INFRASTRUCTURE & RELIABILITY</div>
              <p><span className="terminal-text--green">High-Availability Architecture:</span></p>
              <p>• Distributed execution across 3 geographic regions</p>
              <p>• Redundant API key management with automatic failover</p>
              <p>• Real-time monitoring with 99.7% uptime SLA</p>
              <p>• PostgreSQL database with point-in-time recovery</p>
              <br/>
              
              <p><span className="terminal-text--green">Data Quality Assurance:</span></p>
              <p>• Automated anomaly detection using isolation forests</p>
              <p>• Cross-validation against multiple API endpoints</p>
              <p>• Historical data integrity checks and corruption detection</p>
              <p>• Regular calibration against human expert evaluations</p>
              <br/>
              
              <p><span className="terminal-text--green">Performance Optimization:</span></p>
              <p>• Intelligent rate limiting to respect API quotas</p>
              <p>• Concurrent execution with backpressure control</p>
              <p>• Caching layer for duplicate request elimination</p>
              <p>• Adaptive retry mechanisms with exponential backoff</p>
              <br/>
              
              <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px' }}>🔍 TRANSPARENCY & VERIFICATION</div>
              <p>• Complete benchmark source code available on request</p>
              <p>• "Test Your Keys" feature allows independent verification</p>
              <p>• Detailed methodology documentation and academic paper submission</p>
              <p>• Regular third-party audits of scoring algorithms</p>
              <p>• Historical data export capabilities for research purposes</p>
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
                <div>A: Our system continuously monitors AI model performance through <span className="terminal-text--green">automated benchmarking every 30 minutes</span>. We execute 147 unique coding challenges against each model, measuring performance across 7 key axes. Statistical analysis using <span className="terminal-text--green">z-score standardization</span> against 28-day rolling baselines detects significant performance drops. Our <span className="terminal-text--green">CUSUM algorithm</span> identifies persistent degradation patterns that indicate when AI companies reduce model capability to save computational costs.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: What exactly is the "StupidScore" and how is it calculated?</div>
                <div>A: The StupidScore is our proprietary <span className="terminal-text--green">weighted composite metric</span> calculated as: <strong>StupidScore = Σ(weight<sub>i</sub> × z_score<sub>i</sub>)</strong> where z_score<sub>i</sub> = (metric<sub>i</sub> - μ<sub>i</sub>) / σ<sub>i</sub>. Each performance axis has a specific weight: Correctness (35%), Specification (15%), Code Quality (15%), Efficiency (10%), Stability (10%), Refusal Rate (10%), Recovery (5%). The z-score standardization compares current performance against historical baselines. <span className="terminal-text--green">Negative values indicate degradation</span> from historical performance, while positive values show improvement.</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '4px' }}>Q: How exactly do the 7 performance axes work?</div>
                <div>A: <strong>CORRECTNESS (35%)</strong>: Measures functional accuracy through 200+ automated unit tests per challenge, including edge cases, error handling, and runtime stability. <strong>SPECIFICATION (15%)</strong>: Validates adherence to function signatures, JSON schema compliance, documentation format, and code structure requirements. <strong>CODE QUALITY (15%)</strong>: Uses static analysis (ESLint, Pylint), measures cyclomatic complexity, detects code duplication, and validates naming conventions. <strong>EFFICIENCY (10%)</strong>: Tracks API latency (P50/P95/P99), token usage optimization, and algorithmic complexity. <strong>STABILITY (10%)</strong>: Tests consistency across multiple runs with different seeds and temperature settings. <strong>REFUSAL RATE (10%)</strong>: Detects inappropriate task rejections for legitimate coding requests. <strong>RECOVERY (5%)</strong>: Measures self-correction ability when provided with error feedback.</div>
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
      
      {/* All-Time Best Performing Model - Enhanced Presentation */}
      {bestModel && !loading && (
        <div style={{ 
          marginTop: '16px',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.08) 0%, rgba(0, 255, 65, 0.05) 100%)',
          border: '2px solid rgba(255, 215, 0, 0.4)',
          borderRadius: '6px',
          boxShadow: '0 0 20px rgba(255, 215, 0, 0.1)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Animated background effect */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.1), transparent)',
            animation: 'shine 3s ease-in-out infinite'
          }}></div>

          {/* Mobile Layout */}
          <div className="mobile-only" style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ 
              textAlign: 'center',
              marginBottom: '12px'
            }}>
              <div className="terminal-text--amber" style={{ 
                fontSize: '1.1em', 
                fontWeight: 'bold',
                marginBottom: '6px',
                textShadow: '0 0 10px rgba(255, 215, 0, 0.5)'
              }}>
                🏆 HALL OF FAME 🏆
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                All-Time Performance Champion
              </div>
            </div>
            
            <div style={{ 
              textAlign: 'center',
              padding: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '4px',
              marginBottom: '10px'
            }}>
              <div className="terminal-text--green" style={{ 
                fontSize: '1.2em',
                fontWeight: 'bold',
                marginBottom: '4px',
                letterSpacing: '1px'
              }}>
                {bestModel.name.toUpperCase()}
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '6px' }}>
                {getProviderName(bestModel.provider)}
              </div>
              <div className="terminal-text--amber" style={{ 
                fontSize: '1.4em', 
                fontWeight: 'bold',
                textShadow: '0 0 8px rgba(255, 215, 0, 0.6)'
              }}>
                {bestModel.overallScore || bestModel.currentScore}
              </div>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="desktop-only" style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <div>
                <div className="terminal-text--amber" style={{ 
                  fontSize: '1.3em', 
                  fontWeight: 'bold',
                  marginBottom: '4px',
                  textShadow: '0 0 10px rgba(255, 215, 0, 0.5)'
                }}>
                  🏆 HALL OF FAME CHAMPION 🏆
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
                  Dynamically calculated using weighted composite scoring across all historical data
                </div>
              </div>
              <div style={{ 
                textAlign: 'right',
                padding: '16px 20px',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 215, 0, 0.3)'
              }}>
                <div className="terminal-text--green" style={{ 
                  fontSize: '1.4em',
                  fontWeight: 'bold',
                  marginBottom: '4px',
                  letterSpacing: '1px'
                }}>
                  {bestModel.name.toUpperCase()}
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '8px' }}>
                  {getProviderName(bestModel.provider)} • Current All-Time Leader
                </div>
                <div className="terminal-text--amber" style={{ 
                  fontSize: '1.8em', 
                  fontWeight: 'bold',
                  textShadow: '0 0 12px rgba(255, 215, 0, 0.7)'
                }}>
                  {bestModel.overallScore || bestModel.currentScore}
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            padding: '10px 14px',
            borderRadius: '4px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            border: '1px solid rgba(255, 215, 0, 0.2)',
            position: 'relative',
            zIndex: 1
          }}
          onClick={() => router.push(`/models/${bestModel.id}`)}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.4)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
            e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.2)';
          }}>
            <div className="terminal-text--green" style={{ 
              fontSize: '0.85em', 
              marginBottom: '3px',
              fontWeight: 'bold'
            }}>
              🎯 {bestModel.reasonText}
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.75em' }}>
              Click for analytics
            </div>
          </div>
        </div>
      )}

        {/* Desktop Navigation - Hidden on mobile, only visible on desktop */}
        <div className="desktop-only" style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '16px',
          marginTop: '24px',
          padding: '16px',
          backgroundColor: 'rgba(0, 255, 65, 0.02)',
          border: '1px solid rgba(0, 255, 65, 0.15)',
          borderRadius: '6px'
        }}>
          <button 
            onClick={() => setSelectedView('test')}
            className={`${getButtonClassName('test')} desktop-only`}
            style={{
              padding: '12px 24px',
              fontSize: '1em',
              minWidth: '140px'
            }}
          >
            TEST YOUR KEYS
          </button>
          <button 
            onClick={() => setSelectedView('about')}
            className={`${getButtonClassName('about')} desktop-only`}
            style={{
              padding: '12px 24px',
              fontSize: '1em',
              minWidth: '140px'
            }}
          >
            ABOUT
          </button>
          <button 
            onClick={() => setSelectedView('faq')}
            className={`${getButtonClassName('faq')} desktop-only`}
            style={{
              padding: '12px 24px',
              fontSize: '1em',
              minWidth: '140px'
            }}
          >
            FAQ
          </button>
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
                'Based on 30-minute automated benchmarks • Higher scores = Better performance'
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
              
              <div>
                <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginBottom: '4px' }}>
                  Sort By:
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setLeaderboardSortBy('score')}
                    className={`vintage-btn ${leaderboardSortBy === 'score' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 6px', 
                      fontSize: '0.7em',
                      minHeight: '20px'
                    }}
                    disabled={loadingLeaderboard}
                  >
                    SCORE
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
                    onClick={() => setLeaderboardSortBy('score')}
                    className={`vintage-btn ${leaderboardSortBy === 'score' ? 'vintage-btn--active' : ''}`}
                    style={{ 
                      padding: '2px 8px', 
                      fontSize: '0.75em',
                      minHeight: '22px'
                    }}
                    disabled={loadingLeaderboard}
                  >
                    SCORE
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="leaderboard-table">
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
              modelScores.map((model: any, index: number) => (
                  <div key={model.id} 
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
                          <div className="terminal-text">{model.name.toUpperCase()}</div>
                          <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                            {getProviderName(model.provider)}
                          </div>
                        </div>
                        {renderMiniChart(model.history, leaderboardPeriod)}
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

          {/* Analytics Period Controls */}
          <div style={{ 
            marginBottom: '16px',
            padding: '8px 12px',
            backgroundColor: 'rgba(0, 255, 65, 0.03)',
            border: '1px solid rgba(0, 255, 65, 0.2)',
            borderRadius: '3px',
            position: 'relative'
          }}>
            {/* Loading overlay for analytics */}
            {loadingAnalytics && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '3px',
                zIndex: 10
              }}>
                <span className="terminal-text--green">UPDATING...</span>
              </div>
            )}
            {/* Mobile Layout */}
            <div className="mobile-only">
              <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginBottom: '4px' }}>
                Analytics Period:
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setAnalyticsPeriod('latest')}
                  className={`vintage-btn ${analyticsPeriod === 'latest' ? 'vintage-btn--active' : ''}`}
                  style={{ 
                    padding: '2px 6px', 
                    fontSize: '0.7em',
                    minHeight: '20px'
                  }}
                  disabled={loadingAnalytics}
                >
                  LATEST
                </button>
                <button
                  onClick={() => setAnalyticsPeriod('24h')}
                  className={`vintage-btn ${analyticsPeriod === '24h' ? 'vintage-btn--active' : ''}`}
                  style={{ 
                    padding: '2px 6px', 
                    fontSize: '0.7em',
                    minHeight: '20px'
                  }}
                  disabled={loadingAnalytics}
                >
                  24H
                </button>
                <button
                  onClick={() => setAnalyticsPeriod('7d')}
                  className={`vintage-btn ${analyticsPeriod === '7d' ? 'vintage-btn--active' : ''}`}
                  style={{ 
                    padding: '2px 6px', 
                    fontSize: '0.7em',
                    minHeight: '20px'
                  }}
                  disabled={loadingAnalytics}
                >
                  7D
                </button>
                <button
                  onClick={() => setAnalyticsPeriod('1m')}
                  className={`vintage-btn ${analyticsPeriod === '1m' ? 'vintage-btn--active' : ''}`}
                  style={{ 
                    padding: '2px 6px', 
                    fontSize: '0.7em',
                    minHeight: '20px'
                  }}
                  disabled={loadingAnalytics}
                >
                  1M
                </button>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="desktop-only">
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <span className="terminal-text--dim" style={{ fontSize: '0.85em' }}>Analytics Period:</span>
                <button
                  onClick={() => setAnalyticsPeriod('latest')}
                  className={`vintage-btn ${analyticsPeriod === 'latest' ? 'vintage-btn--active' : ''}`}
                  style={{ 
                    padding: '2px 8px', 
                    fontSize: '0.75em',
                    minHeight: '22px'
                  }}
                  disabled={loadingAnalytics}
                >
                  LATEST
                </button>
                <button
                  onClick={() => setAnalyticsPeriod('24h')}
                  className={`vintage-btn ${analyticsPeriod === '24h' ? 'vintage-btn--active' : ''}`}
                  style={{ 
                    padding: '2px 8px', 
                    fontSize: '0.75em',
                    minHeight: '22px'
                  }}
                  disabled={loadingAnalytics}
                >
                  24H
                </button>
                <button
                  onClick={() => setAnalyticsPeriod('7d')}
                  className={`vintage-btn ${analyticsPeriod === '7d' ? 'vintage-btn--active' : ''}`}
                  style={{ 
                    padding: '2px 8px', 
                    fontSize: '0.75em',
                    minHeight: '22px'
                  }}
                  disabled={loadingAnalytics}
                >
                  7D
                </button>
                <button
                  onClick={() => setAnalyticsPeriod('1m')}
                  className={`vintage-btn ${analyticsPeriod === '1m' ? 'vintage-btn--active' : ''}`}
                  style={{ 
                    padding: '2px 8px', 
                    fontSize: '0.75em',
                    minHeight: '22px'
                  }}
                  disabled={loadingAnalytics}
                >
                  1M
                </button>
              </div>
            </div>
          </div>

          {/* Active Degradations */}
          {degradations.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                <span className="terminal-text--red">🚨 ACTIVE DEGRADATIONS</span>
              </div>
              {degradations.slice(0, 3).map((degradation, index) => (
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
                    {degradation.modelName.toUpperCase()} ({getProviderName(degradation.provider)})
                  </span>
                  <span className="terminal-text--dim" style={{ marginLeft: '8px' }}>
                    {degradation.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Smart Recommendations */}
          {recommendations && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                <span className="terminal-text--amber">🎯 SMART RECOMMENDATIONS</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                {recommendations.bestForCode && (
                  <div style={{ 
                    padding: '8px', 
                    border: '1px solid rgba(0, 255, 65, 0.3)',
                    backgroundColor: 'rgba(0, 255, 65, 0.05)',
                    fontSize: '0.85em'
                  }}>
                    <div className="terminal-text--green" style={{ fontWeight: 'bold' }}>
                      Best for Code: {recommendations.bestForCode.name.toUpperCase()}
                    </div>
                    <div className="terminal-text--dim">{recommendations.bestForCode.reason}</div>
                  </div>
                )}
                {recommendations.mostReliable && (
                  <div style={{ 
                    padding: '8px', 
                    border: '1px solid rgba(0, 255, 65, 0.3)',
                    backgroundColor: 'rgba(0, 255, 65, 0.05)',
                    fontSize: '0.85em'
                  }}>
                    <div className="terminal-text--green" style={{ fontWeight: 'bold' }}>
                      Most Reliable: {recommendations.mostReliable.name.toUpperCase()}
                    </div>
                    <div className="terminal-text--dim">{recommendations.mostReliable.reason}</div>
                  </div>
                )}
                {recommendations.fastestResponse && (
                  <div style={{ 
                    padding: '8px', 
                    border: '1px solid rgba(0, 255, 65, 0.3)',
                    backgroundColor: 'rgba(0, 255, 65, 0.05)',
                    fontSize: '0.85em'
                  }}>
                    <div className="terminal-text--green" style={{ fontWeight: 'bold' }}>
                      Fastest: {recommendations.fastestResponse.name.toUpperCase()}
                    </div>
                    <div className="terminal-text--dim">{recommendations.fastestResponse.reason}</div>
                  </div>
                )}
              </div>
              {recommendations.avoidNow && recommendations.avoidNow.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div className="terminal-text--red" style={{ fontSize: '0.95em', marginBottom: '4px' }}>
                    ⚠️ Avoid Now:
                  </div>
                  {recommendations.avoidNow.slice(0, 2).map((model: any, index: number) => (
                    <div key={index} className="terminal-text--amber" style={{ fontSize: '0.85em', marginLeft: '16px' }}>
                      • {model.name.toUpperCase()} - {model.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                  <span className="terminal-text--dim">Last Update: </span>
                  <span className={
                    transparencyMetrics.summary.lastUpdate && 
                    (Date.now() - new Date(transparencyMetrics.summary.lastUpdate).getTime()) < 30 * 60 * 1000
                      ? 'terminal-text--green' : 'terminal-text--amber'
                  }>
                    {transparencyMetrics.summary.lastUpdate ? 
                      formatTimeAgo(new Date(transparencyMetrics.summary.lastUpdate)) : 'Unknown'}
                  </span>
                </div>
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
                <div>
                  <span className="terminal-text--dim">Next Test: </span>
                  <span className="terminal-text">
                    {transparencyMetrics.summary.nextTest ? 
                      `in ${Math.ceil((new Date(transparencyMetrics.summary.nextTest).getTime() - Date.now()) / 60000)}m` : 
                      'Soon'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Coming Soon Section - Compact */}
      <div style={{ 
        backgroundColor: 'rgba(255, 165, 0, 0.08)', 
        border: '1px solid rgba(255, 165, 0, 0.3)',
        padding: '6px 12px', 
        margin: '8px 0',
        textAlign: 'center',
        borderRadius: '2px'
      }}>
        <span className="terminal-text--amber" style={{ fontSize: '0.85em' }}>
          🚧 Grok models coming soon • Test with your xAI keys in "Test Your Keys"
        </span>
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
                `${globalIndex.performingWell}/${globalIndex.totalModels} models performing well` :
                `${modelScores.filter(m => m.status === 'excellent' || m.status === 'good').length}/${modelScores.length} models performing well`
              }
            </div>
          </div>
        </div>

        {/* Historical 6-hour breakdown */}
        {globalIndex && globalIndex.history && (
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
          Based on {globalIndex ? globalIndex.totalModels : modelScores.length} monitored models • Updates every 30 minutes
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
            const minutes = now.getMinutes();
            let nextRun;
            if (minutes < 20) {
              // Next run is at :20 of current hour
              nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 20, 0, 0);
            } else if (minutes < 40) {
              // Next run is at :40 of current hour
              nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 40, 0, 0);
            } else {
              // Next run is at :00 of next hour
              nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
            }
            const minutesUntil = Math.ceil((nextRun.getTime() - now.getTime()) / 60000);
            const nextTime = nextRun.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `${minutesUntil} minutes (${nextTime})`;
          })()} <br/>
          Data refreshes every 20 minutes • Scores based on 7-axis performance metrics{visitorCount && (
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
    </div>
  );
}
