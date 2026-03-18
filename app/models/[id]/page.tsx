'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

// Styles
import '../../../styles/vintage.css';
import '../../../styles/v4-layout.css';
import '../../../styles/model-detail-v4.css';

// V4 components (shared with main page)
import { TopBar, V4Footer } from '../../../components/v4';

// Model-detail specific components
import ModelDetailHeader from '../../../components/model-detail/ModelDetailHeader';
import ModelDetailStatBar from '../../../components/model-detail/ModelDetailStatBar';
import ModelDetailControls from '../../../components/model-detail/ModelDetailControls';
import ModelDetailMeter from '../../../components/model-detail/ModelDetailMeter';
import ModelDetailChart from '../../../components/model-detail/ModelDetailChart';
import ModelDetailQuickStats from '../../../components/model-detail/ModelDetailQuickStats';
import ModelDetailPricing from '../../../components/model-detail/ModelDetailPricing';
import ModelDetailMatrix from '../../../components/model-detail/ModelDetailMatrix';

// Shared components
import ProFeatureModal from '../../../components/ProFeatureModal';

// ─── Types ───────────────────────────────────────────────────────────────────

type HistoricalPeriod = 'latest' | '24h' | '7d' | '1m';
type ScoringMode = 'combined' | 'reasoning' | 'speed' | 'tooling';

interface ModelDetails {
  id: number;
  name: string;
  vendor: string;
  displayName?: string;
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
  };
}

interface HistoryPoint {
  timestamp: string;
  stupidScore: number;
  displayScore?: number;
  score?: number;
  axes: Record<string, number>;
}

interface ModelHistory {
  modelId: number;
  period: string;
  dataPoints: number;
  canonicalScore?: number;
  history: HistoryPoint[];
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

const toDisplayScore = (point: any): number | null => {
  if (!point) return null;
  if (typeof point.score === 'number' && !Number.isNaN(point.score)) return clamp(Math.round(point.score));
  const ds = typeof point.displayScore === 'number' ? point.displayScore : typeof point.currentScore === 'number' ? point.currentScore : null;
  if (typeof ds === 'number' && !Number.isNaN(ds)) return clamp(Math.round(ds));
  const z = typeof point.stupidScore === 'number' ? point.stupidScore : null;
  if (z !== null && !Number.isNaN(z)) {
    if (z >= 0 && z <= 100) return clamp(Math.round(z));
    return clamp(Math.round(50 + z * 10));
  }
  return null;
};

const getStatusFromScore = (score: number): string => {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 40) return 'warning';
  return 'critical';
};

const getTrendFromHistory = (history: HistoryPoint[]): string => {
  if (!history || history.length < 2) return 'stable';
  const recent = history.slice(0, 3);
  const older = history.slice(3, 6);
  if (older.length === 0) return 'stable';
  const recentAvg = recent.reduce((s, h) => s + h.stupidScore, 0) / recent.length;
  const olderAvg = older.reduce((s, h) => s + h.stupidScore, 0) / older.length;
  if (recentAvg < olderAvg - 5) return 'up';
  if (recentAvg > olderAvg + 5) return 'down';
  return 'stable';
};

const formatTimeAgo = (dateStr: string): string => {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ModelDetailPage() {
  const router = useRouter();
  const params = useParams();

  // Core data
  const [modelDetails, setModelDetails] = useState<ModelDetails | null>(null);
  const [history, setHistory] = useState<ModelHistory | null>(null);
  const [stats, setStats] = useState<ModelStats | null>(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState('Initializing...');
  const [loadingAttempts, setLoadingAttempts] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // UI states
  const [selectedPeriod, setSelectedPeriod] = useState<HistoricalPeriod>('latest');
  const [selectedScoringMode, setSelectedScoringMode] = useState<ScoringMode>('combined');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Pro modal
  const [showProModal, setShowProModal] = useState(false);
  const [proModalFeature, setProModalFeature] = useState<'historical-data' | 'performance-matrix'>('historical-data');

  // Visitor counts (same as main page TopBar)
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [todayVisits, setTodayVisits] = useState<number | null>(null);

  // Session
  const { data: session } = useSession();
  const hasProAccess = (session?.user as any)?.subscriptionStatus === 'active'
    || (session?.user as any)?.subscriptionStatus === 'trialing';

  // Fetch visitor count on mount
  useEffect(() => {
    const fetchVisitorCount = async () => {
      try {
        const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
        const response = await fetch(`${apiUrl}/visitors/stats`);
        const data = await response.json();
        if (data?.totals?.visits) setVisitorCount(data.totals.visits);
        if (data?.today?.visits) setTodayVisits(data.today.visits);
      } catch {}
    };
    fetchVisitorCount();
  }, []);

  // ─── Data Validation ────────────────────────────────────────────────────────

  const validateDataCompleteness = (modelData: any, historyData: any, statsData: any): boolean => {
    if (!modelData || !modelData.name) return false;
    const hasLatestScore = modelData.latestScore?.axes && Object.keys(modelData.latestScore.axes).length > 0;
    const hasValidScore = statsData?.currentScore && statsData.currentScore > 0;
    return hasValidScore || hasLatestScore;
  };

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchModelData = async (showRefreshIndicator = false, attemptNumber = 0) => {
    if (showRefreshIndicator) setIsRefreshing(true);

    let modelData: any = null;

    try {
      if (!showRefreshIndicator) {
        setLoading(true);
        setLoadingAttempts(attemptNumber);
        setLoadingProgress(Math.min(10 + attemptNumber * 8, 90));
      }

      const modelIdStr = params.id as string;
      const modelId = parseInt(modelIdStr);
      if (isNaN(modelId)) throw new Error(`Invalid model ID: ${modelIdStr}`);

      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
      const sortByParam = selectedScoringMode === 'speed' ? '7axis' : selectedScoringMode;

      if (!showRefreshIndicator) setLoadingStage('Fetching model details...');

      const [modelResponse, historyResponse, statsResponse] = await Promise.all([
        fetch(`${apiUrl}/api/models/${modelId}`),
        fetch(`${apiUrl}/dashboard/history/${modelId}?period=${selectedPeriod}&sortBy=${sortByParam}`),
        fetch(`${apiUrl}/api/models/${modelId}/stats?period=${selectedPeriod}&sortBy=${sortByParam}`),
      ]);

      if (modelResponse.status >= 500) throw new Error(`Server error: ${modelResponse.status}`);
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
        setLoadingProgress(Math.min(50 + attemptNumber * 8, 90));
      }

      let historyData: any = null;
      if (historyResponse.ok) {
        historyData = await historyResponse.json();
        if (historyData.success && historyData.data && historyData.data.length > 0) {
          setHistory({
            modelId,
            period: selectedPeriod,
            dataPoints: historyData.data.length,
            canonicalScore: historyData.canonicalScore,
            history: historyData.data.map((point: any) => ({
              timestamp: point.timestamp || new Date().toISOString(),
              stupidScore: point.stupidScore || 0,
              displayScore: point.score || point.displayScore || toDisplayScore(point) || 0,
              score: point.score,
              axes: point.axes || {},
            })),
          });
        } else {
          setHistory({ modelId, period: selectedPeriod, dataPoints: 0, history: [] });
        }
      } else {
        setHistory({ modelId, period: selectedPeriod, dataPoints: 0, history: [] });
      }

      if (!showRefreshIndicator) {
        setLoadingStage('Computing statistics...');
        setLoadingProgress(Math.min(70 + attemptNumber * 8, 90));
      }

      let statsData: any = null;
      if (statsResponse.ok) {
        statsData = await statsResponse.json();
        setStats(statsData);
      } else {
        setStats({ modelId, currentScore: 0, totalRuns: 0, successfulRuns: 0, successRate: 0, averageCorrectness: 0, averageLatency: 0 });
      }

      const dataIsComplete = validateDataCompleteness(modelData, historyData, statsData);

      if (!dataIsComplete && !showRefreshIndicator && attemptNumber < 10) {
        const retryDelay = Math.min(2000 * Math.pow(1.5, attemptNumber), 10000);
        setLoadingStage(`Data incomplete, retrying in ${Math.round(retryDelay / 1000)}s...`);
        setLoadingProgress(Math.min(70 + attemptNumber * 3, 95));
        setTimeout(() => fetchModelData(false, attemptNumber + 1), retryDelay);
        return;
      }

      if (dataIsComplete || attemptNumber >= 10 || showRefreshIndicator) {
        setLoading(false);
        setLoadingProgress(100);
        if (dataIsComplete) setLoadingStage('Complete!');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isServerError = errorMessage.includes('Server error:') || errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503');
      const isNotFound = errorMessage.includes('Model not found') || errorMessage.includes('404');

      if (isServerError && !showRefreshIndicator && attemptNumber < 10) {
        const retryDelay = Math.min(3000 * Math.pow(1.5, attemptNumber), 15000);
        setLoadingStage(`Fetching benchmark data, please wait...`);
        setLoadingProgress(Math.min(50 + attemptNumber * 5, 95));
        setTimeout(() => fetchModelData(false, attemptNumber + 1), retryDelay);
        return;
      }

      if (isNotFound) {
        setModelDetails(null);
        setLoading(false);
        return;
      }

      if (attemptNumber >= 10) setLoadingStage('Unable to load model data after multiple attempts');
      setLoading(false);
    } finally {
      if (showRefreshIndicator) setIsRefreshing(false);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => {
    fetchModelData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, selectedPeriod, selectedScoringMode]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(() => fetchModelData(true), 120000);
    }
    return () => { if (interval) clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, selectedPeriod, selectedScoringMode]);

  // ─── Derived values ─────────────────────────────────────────────────────────

  const getCurrentScore = (): number => {
    if (history?.canonicalScore !== undefined && history.canonicalScore !== null) return history.canonicalScore as number;
    if (history?.history && history.history.length > 0) {
      const latest = toDisplayScore(history.history[0]);
      if (latest !== null) return latest;
    }
    if (stats?.currentScore && typeof stats.currentScore === 'number') return stats.currentScore;
    if (modelDetails?.latestScore?.displayScore) return modelDetails.latestScore.displayScore;
    return 0;
  };

  const calculatePeriodAxes = () => {
    if (!history || history.history.length === 0) return null;
    const totals = { correctness: 0, spec: 0, codeQuality: 0, efficiency: 0, stability: 0, refusal: 0, recovery: 0 };
    let validPoints = 0;
    history.history.forEach(point => {
      if (point.axes) {
        const a = point.axes as any;
        totals.correctness += a.correctness || 0;
        totals.spec += a.complexity || a.spec || 0;
        totals.codeQuality += a.codeQuality || 0;
        totals.efficiency += a.efficiency || 0;
        totals.stability += a.stability || 0;
        totals.refusal += a.edgeCases || a.refusal || 0;
        totals.recovery += a.debugging || a.recovery || 0;
        validPoints++;
      }
    });
    if (validPoints === 0) return null;
    return {
      correctness: totals.correctness / validPoints,
      spec: totals.spec / validPoints,
      codeQuality: totals.codeQuality / validPoints,
      efficiency: totals.efficiency / validPoints,
      stability: totals.stability / validPoints,
      refusal: totals.refusal / validPoints,
      recovery: totals.recovery / validPoints,
    };
  };

  const currentScore = getCurrentScore();
  const status = getStatusFromScore(currentScore);
  const trend = getTrendFromHistory(history?.history || []);
  const axesData = calculatePeriodAxes() || modelDetails?.latestScore?.axes || null;

  // ─── Loading Screen ─────────────────────────────────────────────────────────

  if (loading) {
    const progressBg = loadingProgress < 30 ? 'var(--red-alert)' : loadingProgress < 70 ? 'var(--amber-warning)' : 'var(--phosphor-green)';
    return (
      <div className="md-loading">
        <div className="md-loading-inner">
          <div className="md-loading-title">
            {params.id ? String(params.id).toUpperCase().replace(/-/g, ' ') : 'MODEL'}
          </div>
          <div className="md-loading-icon">⚡</div>
          <div className="md-progress-track">
            <div className="md-progress-fill" style={{ width: `${loadingProgress}%`, background: progressBg }} />
          </div>
          <div className="md-progress-info">
            <span style={{ color: 'var(--phosphor-dim)', fontSize: '10px' }}>PROGRESS</span>
            <span style={{ color: 'var(--phosphor-green)', fontWeight: 'bold', fontSize: '10px' }}>{loadingProgress}%</span>
          </div>
          <div className="md-loading-stage">{loadingStage}</div>
          <div className="vintage-loading" style={{ fontSize: '14px' }}></div>
          {loadingAttempts > 0 && (
            <div className="md-loading-attempt">
              <span style={{ color: 'var(--phosphor-dim)' }}>Attempt: </span>
              <span style={{ color: 'var(--amber-warning)', fontWeight: 'bold' }}>{loadingAttempts + 1}/10</span>
            </div>
          )}
          {loadingAttempts >= 3 && (
            <div style={{ marginTop: '12px', fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.5' }}>
              ⏳ Waiting for benchmark data to be available...
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Error Screen ────────────────────────────────────────────────────────────

  if (!modelDetails) {
    return (
      <div className="md-error">
        <div className="md-error-inner">
          <div className="md-error-title">MODEL NOT FOUND</div>
          <div className="md-error-icon">⚠️</div>
          <div className="md-error-text">The requested model could not be located in our database.</div>
          <button onClick={() => router.push('/')} className="vintage-btn" style={{ padding: '10px 24px' }}>
            ← RETURN TO DASHBOARD
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Render ─────────────────────────────────────────────────────────────

  const lastUpdatedStr = modelDetails.latestScore?.ts ? formatTimeAgo(modelDetails.latestScore.ts) : 'Unknown';

  return (
    <div>
      {/* Shared top bar (same as main dashboard) */}
      <TopBar
        selectedView="dashboard"
        onViewChange={(view) => {
          if (view === 'about') router.push('/about');
          else if (view === 'faq') router.push('/faq');
          else router.push('/');
        }}
        visitorCount={visitorCount}
        todayVisits={todayVisits}
      />

      {/* Model-specific header */}
      <ModelDetailHeader
        modelName={modelDetails.name}
        displayName={modelDetails.displayName}
        provider={modelDetails.vendor}
        status={status}
        trend={trend}
        lastUpdated={lastUpdatedStr}
        autoRefresh={autoRefresh}
        isRefreshing={isRefreshing}
        onToggleAutoRefresh={() => setAutoRefresh(prev => !prev)}
        onRefresh={() => fetchModelData(true)}
      />

      {/* KPI stat bar */}
      <ModelDetailStatBar
        currentScore={currentScore}
        status={status}
        totalRuns={stats?.totalRuns || 0}
        successRate={stats?.successRate || 0}
        averageLatency={stats?.averageLatency || 0}
        averageCorrectness={stats?.averageCorrectness || 0}
        lastUpdated={lastUpdatedStr}
      />

      {/* Period + Scoring mode controls */}
      <ModelDetailControls
        selectedPeriod={selectedPeriod}
        selectedScoringMode={selectedScoringMode}
        hasProAccess={hasProAccess}
        isRefreshing={isRefreshing}
        onPeriodChange={setSelectedPeriod}
        onScoringModeChange={setSelectedScoringMode}
        onShowProModal={(feature) => { setProModalFeature(feature); setShowProModal(true); }}
      />

      {/* Stupid meter bar */}
      <ModelDetailMeter
        currentScore={currentScore}
        trend={trend}
        status={status}
      />

      {/* Performance chart */}
      <ModelDetailChart
        history={history?.history || []}
        selectedPeriod={selectedPeriod}
        selectedScoringMode={selectedScoringMode}
        onSwitchPeriod={setSelectedPeriod}
      />

      {/* Two-column: Quick Stats + Pricing */}
      <div className="md-info-grid">
        <ModelDetailQuickStats
          currentScore={currentScore}
          status={status}
          totalRuns={stats?.totalRuns || 0}
          successRate={stats?.successRate || 0}
          averageLatency={stats?.averageLatency || 0}
          averageCorrectness={stats?.averageCorrectness || 0}
          selectedPeriod={selectedPeriod}
        />
        <ModelDetailPricing
          modelName={modelDetails.name}
          provider={modelDetails.vendor}
          currentScore={currentScore}
        />
      </div>

      {/* Performance matrix (adapts to scoring mode + period) */}
      <ModelDetailMatrix
        scoringMode={selectedScoringMode}
        selectedPeriod={selectedPeriod}
        axesData={axesData}
        hasProAccess={hasProAccess}
        onShowProModal={(feature) => { setProModalFeature(feature); setShowProModal(true); }}
      />

      {/* Footer */}
      <V4Footer visitorCount={null} />

      {/* Mobile nav */}
      <div className="md-mobile-nav">
        <button className="md-mobile-nav-btn" onClick={() => router.push('/')}>
          ← DASH
        </button>
        <button className="md-mobile-nav-btn" onClick={() => {
          const root = document.documentElement;
          const themes = ['green', 'amber', 'blue', 'red', 'purple', 'cyan'];
          const cur = root.getAttribute('data-theme') || 'green';
          const next = themes[(themes.indexOf(cur) + 1) % themes.length];
          root.setAttribute('data-theme', next);
          localStorage.setItem('theme', next);
        }}>
          THEME
        </button>
        <button className="md-mobile-nav-btn" onClick={() => router.push('/compare')}>
          COMPARE
        </button>
        <button className="md-mobile-nav-btn pro" onClick={() => router.push('/router')}>
          ⚡ PRO
        </button>
        <button className="md-mobile-nav-btn" onClick={() => router.push('/methodology')}>
          DOCS
        </button>
      </div>

      {/* Pro feature modal */}
      <ProFeatureModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
        feature={proModalFeature}
      />
    </div>
  );
}
