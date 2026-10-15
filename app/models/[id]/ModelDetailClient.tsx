'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

// Styles
import '../../../styles/vintage.css';
import '../../../styles/v4-layout.css';
import '../../../styles/model-detail-v4.css';
import '../../../styles/studio-model.css';

// The studio look (landing tokens, type, panes) for a public page under the site's own top bar
import StudioPage from '../../../components/studio/StudioPage';
import { Loader, Empty } from '../../../components/studio';

// V4 components (shared with main page)
import { TopBar } from '../../../components/v4';
import MobileNav from '../../../components/v4/MobileNav';

// Model-detail specific components
import ModelDetailHeader, { ModelHero } from '../../../components/model-detail/ModelDetailHeader';
import ModelDetailStatBar from '../../../components/model-detail/ModelDetailStatBar';
import ModelDetailSuiteTasks from '../../../components/model-detail/ModelDetailSuiteTasks';
import { isPlan, type Plan } from '../../../lib/entitlements';
import ModelDetailControls from '../../../components/model-detail/ModelDetailControls';
import TrackModelButton from '../../../components/TrackModelButton';
import ModelDetailChart from '../../../components/model-detail/ModelDetailChart';
import ModelDetailQuickStats from '../../../components/model-detail/ModelDetailQuickStats';
import ModelDetailPricing from '../../../components/model-detail/ModelDetailPricing';
import ModelDetailMatrix from '../../../components/model-detail/ModelDetailMatrix';
import ModelDetailCusum from '../../../components/model-detail/ModelDetailCusum';
import ModelDetailDriftStatus from '../../../components/model-detail/ModelDetailDriftStatus';
import ModelDetailSliceRegressions from '../../../components/model-detail/ModelDetailSliceRegressions';
import ModelDetailCalibration from '../../../components/model-detail/ModelDetailCalibration';
import ModelDetailVerbosity from '../../../components/model-detail/ModelDetailVerbosity';
import ModelDetailSubstitutes from '../../../components/model-detail/ModelDetailSubstitutes';
import ModelDetailContextRot from '../../../components/model-detail/ModelDetailContextRot';
import ModelDetailCommunityTests from '../../../components/model-detail/ModelDetailCommunityTests';
import ModelDetailCommunityFunding from '../../../components/model-detail/ModelDetailCommunityFunding';

// Shared components
import ProFeatureModal from '../../../components/ProFeatureModal';
import NewModelNotice from '../../../components/NewModelNotice';

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
  /** Whole days of score history behind this model; null when the age is unknown. */
  daysTracked?: number | null;
  /** True while that history is too short for a stable median / drift baseline. */
  isCalibrating?: boolean;
  /** Days of history the baseline needs (server-owned, currently 10). */
  calibrationDays?: number;
  /**
   * Suites we no longer run for this model because the community funds them (JSON array as
   * stored, e.g. '["deep","tooling"]'); null when we run everything.
   */
  communitySuites?: string | null;
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
  // Coverage of the headline number (same fields as the leaderboard row). A composite
  // built from two suites says so instead of passing as a complete one.
  suites?: string[] | null;
  coverage?: string | null;
  rankable?: boolean;
  staleReason?: string | null;
  oldestComponentAt?: string | null;
  lastUpdated?: string | null;
  suiteUpdatedAt?: Record<string, string> | null;
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
  // History arrives newest first, so `recent` is the latest runs: a lower average is a decline.
  // (These two returns were swapped, so a model that dropped 5+ points read "Trend: up".)
  if (recentAvg < olderAvg - 5) return 'down';
  if (recentAvg > olderAvg + 5) return 'up';
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

interface ModelDetailClientProps {
  /** Resolved numeric DB id (used for all id-keyed API calls). */
  modelId: number;
  /** Canonical slug for this model (used for share links / navigation). */
  slug: string;
  /** Server-resolved model identity, so the UI can render instantly. */
  initialName: string;
  initialDisplayName?: string | null;
  initialVendor: string;
  /** Whether this visitor may see the newest run (the "Latest" period). Decided on the server. */
  latestAllowed?: boolean;
}

export default function ModelDetailClient({
  modelId,
  slug,
  initialName,
  initialDisplayName,
  initialVendor,
  latestAllowed = true,
}: ModelDetailClientProps) {
  const router = useRouter();

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
  // Visitors and free accounts open on 24 hours: the newest run is a paid view (lib/capabilities).
  const [selectedPeriod, setSelectedPeriod] = useState<HistoricalPeriod>(latestAllowed ? 'latest' : '24h');
  const [selectedScoringMode, setSelectedScoringMode] = useState<ScoringMode>('combined');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Pro modal
  const [showProModal, setShowProModal] = useState(false);
  const [proModalFeature, setProModalFeature] = useState<'historical-data' | 'performance-matrix' | 'drift-cusum' | 'calibration' | 'substitutes' | 'context-rot' | 'latest-scores'>('historical-data');

  // Visitor counts (same as main page TopBar)
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [todayVisits, setTodayVisits] = useState<number | null>(null);

  // Session
  const { data: session } = useSession();
  const hasProAccess = (session?.user as any)?.subscriptionStatus === 'active'
    || (session?.user as any)?.subscriptionStatus === 'trialing';
  // The plan ladder (free / pro / developer / teams / enterprise) decides what the suite panels
  // unlock beyond the Pro boolean — exports, for one.
  const plan: Plan = isPlan((session?.user as any)?.plan) ? (session!.user as any).plan : (hasProAccess ? 'pro' : 'free');

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

      if (isNaN(modelId) || modelId <= 0) throw new Error(`Invalid model ID: ${modelId}`);

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
  }, [modelId, selectedPeriod, selectedScoringMode]);

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
    // The model record's latest score is the paid "Latest" view; never a fallback for anyone else.
    if (latestAllowed && modelDetails?.latestScore?.displayScore) return modelDetails.latestScore.displayScore;
    return 0;
  };

  const calculatePeriodAxes = () => {
    if (!history || history.history.length === 0) return null;
    const totals = { correctness: 0, spec: 0, codeQuality: 0, efficiency: 0, stability: 0, refusal: 0, recovery: 0 };
    // Every axis the suite actually reported, averaged over the period and kept under its real
    // name. The seven legacy fields below are a lossy remap kept for older callers; the matrix
    // uses these instead, so it can show what was measured rather than deriving stand-ins.
    const measuredTotals: Record<string, number> = {};
    const measuredCounts: Record<string, number> = {};
    let validPoints = 0;
    history.history.forEach(point => {
      if (point.axes) {
        const a = point.axes as any;
        for (const [k, v] of Object.entries(a)) {
          if (typeof v === 'number' && Number.isFinite(v)) {
            measuredTotals[k] = (measuredTotals[k] ?? 0) + v;
            measuredCounts[k] = (measuredCounts[k] ?? 0) + 1;
          }
        }
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
    const measured: Record<string, number> = {};
    for (const k of Object.keys(measuredTotals)) {
      if (measuredCounts[k] > 0) measured[k] = measuredTotals[k] / measuredCounts[k];
    }
    return {
      measured,
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
  // The model's name and provider are known from the server, so the hero stands while the data
  // loads and only the body below it waits.

  const renderLoading = () => (
    <>
      <ModelHero
        provider={initialVendor}
        title={initialDisplayName || (initialName || slug).replace(/-/g, ' ')}
        meta={<span className="st-skel sm-meta-skel" aria-hidden="true" />}
      />
      <div className="st-body">
        <div className="st-pane sm-loading" data-page-loading aria-busy="true">
          <Loader label={loadingStage} />
          <div className="sm-progress">
            <div
              className="sm-progress-bar"
              role="progressbar"
              aria-label="Loading progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={loadingProgress}
            >
              <i style={{ width: `${loadingProgress}%` }} />
            </div>
            <div className="sm-progress-l"><span>Progress</span><b>{loadingProgress}%</b></div>
            {loadingAttempts > 0 && (
              <p>Attempt <b>{loadingAttempts + 1}/10</b></p>
            )}
            {loadingAttempts >= 3 && (
              <p>Waiting for benchmark data to be available...</p>
            )}
          </div>
        </div>
      </div>
    </>
  );

  // ─── Error Screen ────────────────────────────────────────────────────────────

  const renderNotFound = () => (
    <div className="st-body">
      <div className="st-pane sm-missing">
        <Empty
          title="Model not found"
          actions={
            <Link href="/" className="st-btn is-primary">
              <span aria-hidden="true">←</span> Return to the dashboard
            </Link>
          }
        >
          The requested model could not be located in our database.
        </Empty>
      </div>
    </div>
  );

  // ─── Main Render ─────────────────────────────────────────────────────────────

  // "Last update" is when the headline score last changed. The age of every contributing
  // suite goes in the cell's tooltip, so a fresh coding run does not hide an older
  // reasoning component from anyone who looks.
  const lastUpdatedStr = stats?.lastUpdated
    ? formatTimeAgo(stats.lastUpdated)
    : modelDetails?.latestScore?.ts ? formatTimeAgo(modelDetails.latestScore.ts) : 'Unknown';
  const SUITE_LABEL: Record<string, string> = { hourly: 'coding', deep: 'reasoning', tooling: 'tools' };
  const suiteAges = stats?.suiteUpdatedAt
    ? ['hourly', 'deep', 'tooling'].filter(s => stats.suiteUpdatedAt![s]).map(s => `${SUITE_LABEL[s]} ${formatTimeAgo(stats.suiteUpdatedAt![s])}`)
    : [];
  const lastUpdatedTitle = suiteAges.length ? suiteAges.join(' · ') : undefined;

  const renderPage = (modelDetails: ModelDetails) => (
    <>
      {/* Model hero. Track this model — the activation event the whole retention plan
          hangs on — is its primary action. Works signed-out: it routes to sign-up with the
          intent preserved rather than doing nothing. */}
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
        primaryAction={<TrackModelButton modelId={modelId} modelName={modelDetails.name} />}
      />

      <div className="st-body">
        {/* Reasoning / tool-use tests the community funds for this model: says so, explains it once,
            and lets a signed-in visitor fund today's run. Renders nothing for other models. */}
        {modelDetails.communitySuites && (
          <ModelDetailCommunityFunding
            modelId={modelDetails.id}
            modelName={modelDetails.displayName || modelDetails.name}
            vendor={modelDetails.vendor}
            signedIn={Boolean(session?.user)}
          />
        )}

        {/* KPI stat bar */}
        <ModelDetailStatBar
          currentScore={currentScore}
          status={status}
          totalRuns={stats?.totalRuns || 0}
          successRate={stats?.successRate || 0}
          averageLatency={stats?.averageLatency || 0}
          averageCorrectness={stats?.averageCorrectness || 0}
          lastUpdated={lastUpdatedStr}
          lastUpdatedNote={suiteAges.length > 1 ? 'latest suite run' : 'benchmark time'}
          lastUpdatedTitle={lastUpdatedTitle}
          coverage={stats?.coverage ?? null}
          staleReason={stats?.staleReason ?? null}
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
          latestAllowed={latestAllowed}
        />

        {/* Performance chart */}
        <ModelDetailChart
          history={history?.history || []}
          selectedPeriod={selectedPeriod}
          selectedScoringMode={selectedScoringMode}
          onSwitchPeriod={setSelectedPeriod}
        />

        {/* Where each suite's detector stands — armed with its statistic, or still warming up (free) */}
        <ModelDetailDriftStatus modelId={modelId} focus={selectedScoringMode === 'reasoning' ? 'deep' : selectedScoringMode === 'tooling' ? 'tooling' : selectedScoringMode === 'speed' ? 'hourly' : null} />

        {/* Page-Hinkley CUSUM drift curve (Pro) */}
        <ModelDetailCusum
          modelId={modelId}
          initialSuite={selectedScoringMode === 'reasoning' ? 'deep' : selectedScoringMode === 'tooling' ? 'tooling' : 'hourly'}
          hasProAccess={hasProAccess}
          onShowProModal={(feature) => { setProModalFeature(feature); setShowProModal(true); }}
        />

        {/* Per-task regressions (coding suite). Sits directly under the CUSUM curve because it
            answers the question that curve raises but cannot resolve: the composite
            moved (or did not) — which task actually changed? */}
        {(selectedScoringMode === 'combined' || selectedScoringMode === 'speed') && (
          <ModelDetailSliceRegressions modelId={modelId} includeResolved />
        )}

        {/* What the model was asked in each suite's last run, and what happened — per task,
            following the scoring mode (COMBINED shows all three suites). For repo debugging
            tasks it is the only place on the site where "fixed the defect" and "silenced the
            symptom it was shown" are told apart. */}
        <ModelDetailSuiteTasks
          modelId={modelId}
          mode={selectedScoringMode}
          plan={plan}
          hasProAccess={hasProAccess}
          onShowProModal={() => { setProModalFeature('performance-matrix'); setShowProModal(true); }}
          latestAllowed={latestAllowed}
          onShowLatestModal={() => { setProModalFeature('latest-scores'); setShowProModal(true); }}
        />

        {/* How much the model writes per suite, against the fleet on the same tasks. After the
            suite tables because those show the tokens each task was billed for; this separates
            the words a reader actually gets back from the reasoning inside that bill. Free. */}
        <ModelDetailVerbosity
          modelId={modelId}
          focus={selectedScoringMode === 'reasoning' ? 'deep' : selectedScoringMode === 'tooling' ? 'tooling' : selectedScoringMode === 'speed' ? 'hourly' : null}
        />

        {/* Calibration and known-unknowns. Sits after the suite tables because it answers
            the question they cannot: the model did or did not solve the task — but when it
            has no way of knowing, does it say so, or invent something and sound sure? */}
        <ModelDetailCalibration
          modelId={modelId}
          plan={plan}
          hasProAccess={hasProAccess}
          onShowProModal={(feature) => { setProModalFeature(feature); setShowProModal(true); }}
        />

        {/* Context rot (pilot): how far the context window really goes. A measurement panel, so it
            sits with calibration, before the decision panels. On a model outside the pilot it says
            so in one line instead of offering an upgrade that would unlock nothing. */}
        <ModelDetailContextRot
          modelName={modelDetails.name}
          onShowProModal={(feature) => { setProModalFeature(feature); setShowProModal(true); }}
        />

        {/* Cheaper models that can do this one's work, and what switching costs in failed
            requests. Placed directly after calibration because both are decision panels
            rather than measurement panels: everything above says how this model behaves,
            these two say what to do about it. */}
        <ModelDetailSubstitutes
          modelId={modelId}
          plan={plan}
          hasProAccess={hasProAccess}
          onShowProModal={(feature) => { setProModalFeature(feature); setShowProModal(true); }}
        />

        {/* Runs other people made with their own API keys. Deliberately placed AFTER every
            measured panel and clearly labelled: these are individual samples on individual
            keys, not ranking data, and they used to be written into `scores` where they
            could displace the published number. Renders nothing when nobody has tested. */}
        <ModelDetailCommunityTests
          modelName={modelDetails.name}
          publishedScore={currentScore}
        />

        {/* Two-column: Quick Stats + Pricing */}
        <div className="st-grid is-stretch sm-info">
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
            modelId={modelDetails.id}
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
      </div>
    </>
  );

  return (
    <div>
      {/* Shared top bar (same as main dashboard). It stands through loading too, so the page
          never jumps when the data arrives. */}
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

      {/* Everything under the site's top bar is in the studio look. */}
      <StudioPage className="sm-page">
        {loading ? renderLoading() : !modelDetails ? renderNotFound() : renderPage(modelDetails)}
      </StudioPage>

      {/* One navigation for the whole site.
          This page used to carry its own six-button bar with a second,
          incompatible theme switcher — two nav systems and two theme systems
          to keep in step. Compare moved into the shared drawer so nothing is
          lost. */}
      <MobileNav selectedView="model" onViewChange={(v) => {
        if (v === 'dashboard') router.push('/');
        else if (v === 'about') router.push('/about');
        else router.push('/faq');
      }} />

      {/* Warn that a freshly-added model has no settled baseline yet. Rendered only
          once the page has data, so it never covers the loading skeleton. */}
      {!loading && modelDetails && (
        <NewModelNotice
          modelName={modelDetails.displayName || modelDetails.name}
          daysTracked={modelDetails.daysTracked}
          calibrationDays={modelDetails.calibrationDays}
        />
      )}

      {/* Pro feature modal */}
      <ProFeatureModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
        feature={proModalFeature}
      />
    </div>
  );
}
