'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import IntelligencePreview from '@/components/IntelligencePreview';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTip,
  ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

// Module-level helpers shared by both components
const getTrendLabel = (trend: string) => trend === 'up' ? '▲' : trend === 'down' ? '▼' : '→';
const getTrendColor = (trend: string) => trend === 'up' ? 'var(--phosphor-green)' : trend === 'down' ? 'var(--red-alert)' : 'var(--phosphor-dim)';

interface Model {
  id: string;
  name: string;
  displayName?: string;
  provider: string;
  currentScore: number | 'unavailable';
  score?: number;
  rank: number;
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
  category?: string;
  status?: string;
  history?: any[];
}

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

export default function ModelIntelligencePage() {
  const { data: session, status } = useSession();
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'rank' | 'score' | 'name'>('rank');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [downloadingModel, setDownloadingModel] = useState<Model | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    fetchModelData();
    if (autoRefresh) {
      const interval = setInterval(fetchModelData, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchModelData = async () => {
    try {
      setLoading(true);
      setError(null);
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/dashboard/scores?period=latest&sortBy=combined`);
      if (!response.ok) throw new Error('Failed to fetch model data');
      const data = await response.json();
      if (data.success && data.data) {
        setModels(data.data.map((model: any, index: number) => ({
          id: model.id, name: model.name, displayName: model.displayName || model.name,
          provider: model.provider, currentScore: model.currentScore,
          score: typeof model.currentScore === 'number' ? model.currentScore : 0,
          rank: index + 1, trend: model.trend || 'stable',
          lastUpdated: model.lastUpdated || new Date().toISOString(),
          category: model.category, status: model.status, history: model.history || []
        })));
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load model data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      checkSubscription();
    } else if (status === 'unauthenticated') {
      setChecking(false);
      setHasAccess(false);
    }
  }, [status, session]);

  const checkSubscription = async () => {
    try {
      const response = await fetch('/api/subscription/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session!.user!.email! })
      });
      const result = await response.json();
      setHasAccess(result.success && result.data.hasAccess);
    } catch {
      setHasAccess(false);
    } finally {
      setChecking(false);
    }
  };

  const toggleModelSelection = (modelId: string) => {
    setSelectedModels(prev =>
      prev.includes(modelId)
        ? prev.filter(id => id !== modelId)
        : prev.length < 4 ? [...prev, modelId] : prev
    );
  };

  const filteredModels = models
    .filter(m => filterProvider === 'all' || m.provider === filterProvider)
    .sort((a, b) => {
      if (sortBy === 'rank') return a.rank - b.rank;
      if (sortBy === 'score') {
        const aS = typeof a.currentScore === 'number' ? a.currentScore : -1;
        const bS = typeof b.currentScore === 'number' ? b.currentScore : -1;
        return bS - aS;
      }
      return a.name.localeCompare(b.name);
    });

  const providers = ['all', ...Array.from(new Set(models.map(m => m.provider)))];

  if (checking) {
    return (
      <RouterLayout>
        <div className="rv4-loading" style={{ minHeight: '300px' }}>
          <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
          <span>CHECKING ACCESS</span>
        </div>
      </RouterLayout>
    );
  }

  if (!hasAccess) {
    return (
      <RouterLayout>
        <IntelligencePreview />
      </RouterLayout>
    );
  }

  return (
    <RouterLayout>
      {/* Page header */}
      <div className="rv4-page-header">
        <div className="rv4-page-header-left">
          <div>
            <div className="rv4-page-title">MODEL INTELLIGENCE<span className="blinking-cursor"></span></div>
            <div className="rv4-page-title-sub">Comprehensive AI model analytics, benchmarks, and comparison tools</div>
          </div>
        </div>
        <div className="rv4-page-header-right">
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rv4-checkbox" />
            <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)', fontFamily: 'var(--font-mono)' }}>AUTO-REFRESH</span>
          </label>
          <button onClick={fetchModelData} className="rv4-ctrl-btn">↺ REFRESH</button>
        </div>
      </div>

      <div className="rv4-body">
        {error && (
          <div className="rv4-error-banner" style={{ marginBottom: '14px' }}>
            <span>⚠</span>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 'bold', marginBottom: '2px' }}>ERROR</div><div style={{ fontSize: '10px' }}>{error}</div></div>
            <button onClick={fetchModelData} className="rv4-ctrl-btn danger" style={{ marginLeft: 'auto', fontSize: '10px' }}>RETRY</button>
          </div>
        )}

        {/* Stats bar */}
        <div className="rv4-stat-bar cols-4" style={{ borderRadius: '3px', marginBottom: '14px' }}>
          <div className="rv4-stat-cell accent-green">
            <div className="rv4-stat-label">Active Models</div>
            <div className="rv4-stat-value">{loading ? '...' : String(models.filter(m => m.currentScore !== 'unavailable').length)}</div>
          </div>
          <div className="rv4-stat-cell accent-green">
            <div className="rv4-stat-label">Providers</div>
            <div className="rv4-stat-value">{loading ? '...' : String(providers.length - 1)}</div>
          </div>
          <div className="rv4-stat-cell accent-blue">
            <div className="rv4-stat-label">Benchmarks</div>
            <div className="rv4-stat-value blue">171+</div>
          </div>
          <div className="rv4-stat-cell accent-amber">
            <div className="rv4-stat-label">Update Cycle</div>
            <div className="rv4-stat-value amber">4h</div>
          </div>
        </div>

        {/* Filters */}
        <div className="rv4-panel" style={{ marginBottom: '14px' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">FILTERS AND CONTROLS</span>
            {selectedModels.length > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--phosphor-green)' }}>
                {selectedModels.length} selected
              </span>
            )}
          </div>
          <div className="rv4-panel-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: selectedModels.length > 0 ? '12px' : '0' }}>
              <div>
                <label className="rv4-input-label">PROVIDER</label>
                <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)} className="rv4-select">
                  {providers.map(prov => (
                    <option key={prov} value={prov}>{prov.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="rv4-input-label">SORT BY</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="rv4-select">
                  <option value="rank">RANK</option>
                  <option value="score">SCORE</option>
                  <option value="name">NAME</option>
                </select>
              </div>
            </div>

            {selectedModels.length > 0 && (
              <div style={{ padding: '10px', background: 'rgba(0,255,65,0.06)', border: '1px solid rgba(0,255,65,0.2)', borderRadius: '3px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: 'var(--phosphor-green)' }}>
                  {selectedModels.length} model{selectedModels.length > 1 ? 's' : ''} selected for comparison
                </span>
                <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                  <button onClick={() => setSelectedModels([])} className="rv4-ctrl-btn" style={{ fontSize: '10px' }}>
                    CLEAR SELECTION
                  </button>
                  {selectedModels.length >= 2 && (
                    <button onClick={() => setShowCompareModal(true)} className="rv4-ctrl-btn primary" style={{ fontSize: '10px' }}>
                      COMPARE MODELS →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Model grid */}
        <div className="rv4-panel" style={{ marginBottom: '14px' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">LIVE MODEL RANKINGS</span>
            <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>{filteredModels.length} models</span>
          </div>
          <div className="rv4-panel-body">
            {loading && models.length === 0 ? (
              <div className="rv4-loading">
                <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
                <span>LOADING MODEL DATA</span>
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="rv4-empty">
                <div className="rv4-empty-title">NO MODELS MATCH FILTERS</div>
              </div>
            ) : (
              <div className="rv4-intel-grid">
                {filteredModels.map((model) => (
                  <div
                    key={model.id}
                    className={`rv4-intel-card${selectedModels.includes(model.id) ? ' selected' : ''}`}
                    style={{ opacity: (!selectedModels.includes(model.id) && selectedModels.length >= 4) ? 0.5 : 1 }}
                    onClick={() => (selectedModels.length < 4 || selectedModels.includes(model.id)) && toggleModelSelection(model.id)}
                  >
                    <div className="rv4-intel-card-header">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="rv4-intel-card-name">{model.name}</div>
                        <div className="rv4-intel-card-provider">{model.provider.toUpperCase()}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div className="rv4-intel-card-score" style={{ fontSize: '18px' }}>
                          {typeof model.currentScore === 'number' ? model.currentScore.toFixed(1) : 'N/A'}
                        </div>
                        <div style={{ fontSize: '10px', color: getTrendColor(model.trend), fontFamily: 'var(--font-mono)' }}>
                          {getTrendLabel(model.trend)}
                          {selectedModels.includes(model.id) && <span style={{ marginLeft: '4px', color: 'var(--phosphor-green)' }}>✓</span>}
                        </div>
                      </div>
                    </div>
                    <div className="rv4-intel-card-rank">#{model.rank}</div>
                    {model.category && (
                      <div style={{ fontSize: '9px', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                        {model.category}
                      </div>
                    )}
                    <div className="rv4-intel-card-actions">
                      <a href={`/models/${model.id}`} className="rv4-ctrl-btn" onClick={(e) => e.stopPropagation()} style={{ flex: 1, textAlign: 'center', textDecoration: 'none', fontSize: '10px' }}>
                        VIEW DETAILS
                      </a>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDownloadingModel(model); }}
                        className="rv4-ctrl-btn"
                        style={{ flex: 1, fontSize: '10px' }}
                      >
                        DOWNLOAD
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rv4-footer">
          Data sourced from AI Stupid Meter • Real-time benchmarks • <a href="/">View Main Site</a>
        </div>
      </div>

      {/* Comparison Modal */}
      {showCompareModal && (
        <ComparisonModal
          models={models.filter(m => selectedModels.includes(m.id))}
          onClose={() => setShowCompareModal(false)}
        />
      )}

      {/* Download Modal */}
      {downloadingModel && (
        <DownloadModal
          model={downloadingModel}
          downloading={downloading}
          onDownload={async (format) => {
            setDownloading(true);
            try {
              const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
              const [historyRes, statsRes, modelRes] = await Promise.all([
                fetch(`${apiUrl}/dashboard/history/${downloadingModel.id}?period=30d&sortBy=combined`),
                fetch(`${apiUrl}/api/models/${downloadingModel.id}/stats?period=30d&sortBy=combined`),
                fetch(`${apiUrl}/api/models/${downloadingModel.id}`)
              ]);
              const history = historyRes.ok ? await historyRes.json() : null;
              const stats = statsRes.ok ? await statsRes.json() : null;
              const modelDetails = modelRes.ok ? await modelRes.json() : null;

              const mapAxes = (apiAxes: any) => !apiAxes ? null : {
                correctness: apiAxes.correctness || 0, spec: apiAxes.complexity || apiAxes.spec || 0,
                codeQuality: apiAxes.codeQuality || 0, efficiency: apiAxes.efficiency || 0,
                stability: apiAxes.stability || 0, refusal: apiAxes.edgeCases || apiAxes.refusal || 0,
                recovery: apiAxes.debugging || apiAxes.recovery || 0
              };

              let axes = history?.data?.length > 0 ? mapAxes(history.data[0]?.axes) : null;
              if (!axes) axes = mapAxes(modelDetails?.latestScore?.axes);

              const timestamp = new Date().toISOString().split('T')[0];
              const fileName = `${downloadingModel.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${timestamp}`;

              if (format === 'csv') {
                let csv = `# MODEL INTELLIGENCE REPORT\nExport Date,${new Date().toLocaleString()}\nModel,${downloadingModel.name}\nProvider,${downloadingModel.provider}\n\n`;
                csv += `# CURRENT PERFORMANCE\nScore,${typeof downloadingModel.currentScore === 'number' ? downloadingModel.currentScore.toFixed(2) : 'N/A'}\nRank,#${downloadingModel.rank}\nTrend,${downloadingModel.trend}\n\n`;
                if (axes) {
                  csv += `# 7-AXIS BREAKDOWN\nAxis,Score\nCorrectness,${axes.correctness.toFixed(4)}\nSpec,${axes.spec.toFixed(4)}\nCode Quality,${axes.codeQuality.toFixed(4)}\nEfficiency,${axes.efficiency.toFixed(4)}\nStability,${axes.stability.toFixed(4)}\nRefusal,${axes.refusal.toFixed(4)}\nRecovery,${axes.recovery.toFixed(4)}\n`;
                }
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `${fileName}.csv`; a.click();
                URL.revokeObjectURL(url);
              } else {
                const exportData = { exportDate: new Date().toISOString(), model: { id: downloadingModel.id, name: downloadingModel.name, provider: downloadingModel.provider }, currentPerformance: { overallScore: downloadingModel.currentScore, rank: downloadingModel.rank, trend: downloadingModel.trend }, axes, historicalData: history?.data?.slice(0, 30).map((p: any) => ({ timestamp: p.timestamp || p.period, score: p.score || p.displayScore || p.currentScore, axes: mapAxes(p.axes) })) || [] };
                const json = JSON.stringify(exportData, null, 2);
                const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `${fileName}.json`; a.click();
                URL.revokeObjectURL(url);
              }
              setDownloadingModel(null);
            } catch {
              alert('Failed to download model data. Please try again.');
            } finally {
              setDownloading(false);
            }
          }}
          onClose={() => setDownloadingModel(null)}
        />
      )}
    </RouterLayout>
  );
}

function ComparisonModal({ models, onClose }: { models: Model[]; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'radar' | 'performance' | 'value'>('overview');
  const [selectedPeriod, setSelectedPeriod] = useState<'24h' | '7d' | '1m'>('7d');
  const [selectedTestType, setSelectedTestType] = useState<'combined' | '7axis' | 'reasoning' | 'tooling'>('combined');
  const [modelsData, setModelsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDetailedData();
  }, [models, selectedPeriod, selectedTestType]);

  const fetchDetailedData = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
      const sortByParam = selectedTestType === '7axis' ? '7axis' : selectedTestType;

      const detailedData = await Promise.all(
        models.map(async (model) => {
          try {
            const [historyRes, statsRes, modelRes] = await Promise.all([
              fetch(`${apiUrl}/dashboard/history/${model.id}?period=${selectedPeriod}&sortBy=${sortByParam}`),
              fetch(`${apiUrl}/api/models/${model.id}/stats?period=${selectedPeriod}&sortBy=${sortByParam}`),
              fetch(`${apiUrl}/api/models/${model.id}`)
            ]);
            const history = historyRes.ok ? await historyRes.json() : null;
            const stats = statsRes.ok ? await statsRes.json() : null;
            const modelDetails = modelRes.ok ? await modelRes.json() : null;

            const mapAxes = (apiAxes: any) => !apiAxes ? null : {
              correctness: apiAxes.correctness || 0, spec: apiAxes.complexity || apiAxes.spec || 0,
              codeQuality: apiAxes.codeQuality || 0, efficiency: apiAxes.efficiency || 0,
              stability: apiAxes.stability || 0, refusal: apiAxes.edgeCases || apiAxes.refusal || 0,
              recovery: apiAxes.debugging || apiAxes.recovery || 0
            };

            const periodAxes = history?.data?.length > 0 ? mapAxes(history.data[0]?.axes) : null;
            const axes = periodAxes || mapAxes(modelDetails?.latestScore?.axes) || null;

            return { ...model, history: history?.data || [], stats: stats || {}, axes, modelDetails };
          } catch {
            return { ...model, history: [], stats: {}, axes: null, modelDetails: null };
          }
        })
      );
      setModelsData(detailedData);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number | 'unavailable') => {
    if (score === 'unavailable') return 'var(--phosphor-dim)';
    if (score >= 80) return 'var(--phosphor-green)';
    if (score >= 60) return 'var(--amber-warning)';
    return 'var(--red-alert)';
  };

  const validScores = modelsData.filter(m => typeof m.currentScore === 'number');
  const highest = validScores.length > 0 ? validScores.reduce((max, m) => (m.currentScore as number) > (max.currentScore as number) ? m : max) : null;
  const lowest = validScores.length > 0 ? validScores.reduce((min, m) => (m.currentScore as number) < (min.currentScore as number) ? m : min) : null;
  const avgScore = validScores.length > 0 ? validScores.reduce((sum, m) => sum + (m.currentScore as number), 0) / validScores.length : 0;

  const getModelPricing = (model: any) => {
    const name = model.name.toLowerCase();
    const prov = model.provider.toLowerCase();
    let p = { input: 0, output: 0 };
    if (prov === 'openai') {
      if (name.includes('gpt-5') && name.includes('turbo')) p = { input: 10, output: 30 };
      else if (name.includes('gpt-5-nano')) p = { input: 0.05, output: 0.40 };
      else if (name.includes('gpt-5-mini')) p = { input: 0.25, output: 2.0 };
      else if (name.includes('gpt-5')) p = { input: 1.25, output: 10.0 };
      else if (name.includes('o3-pro')) p = { input: 60, output: 240 };
      else if (name.includes('o3-mini')) p = { input: 3.5, output: 14 };
      else if (name.includes('o3')) p = { input: 15, output: 60 };
      else if (name.includes('gpt-4o') && name.includes('mini')) p = { input: 0.15, output: 0.6 };
      else if (name.includes('gpt-4o')) p = { input: 2.5, output: 10 };
      else p = { input: 5, output: 15 };
    } else if (prov === 'anthropic') {
      if (name.includes('opus-4-1') || name.includes('opus-4.1')) p = { input: 15, output: 75 };
      else if (name.includes('opus-4')) p = { input: 5, output: 25 };
      else if (name.includes('sonnet-4')) p = { input: 3, output: 15 };
      else if (name.includes('haiku-4')) p = { input: 0.25, output: 1.25 };
      else p = { input: 3, output: 15 };
    } else if (prov === 'xai' || prov === 'x.ai') {
      if (name.includes('grok-code-fast')) p = { input: 0.20, output: 1.50 };
      else p = { input: 3, output: 15 };
    } else if (prov === 'google') {
      if (name.includes('2.5-pro')) p = { input: 1.25, output: 10 };
      else if (name.includes('2.5-flash-lite')) p = { input: 0.10, output: 0.40 };
      else if (name.includes('2.5-flash')) p = { input: 0.30, output: 2.50 };
      else p = { input: 2, output: 6 };
    } else if (prov === 'deepseek') p = { input: 0.28, output: 0.42 };
    else if (prov === 'glm') p = { input: 0.60, output: 2.20 };
    else if (prov === 'kimi') p = { input: 0.60, output: 2.50 };
    else p = { input: 3, output: 10 };

    const estimatedCost = (p.input * 0.4) + (p.output * 0.6);
    const valueScore = model.currentScore > 0 ? (model.currentScore / estimatedCost).toFixed(1) : '0.0';
    return { ...p, estimatedCost, valueScore };
  };

  const LINE_COLORS = ['var(--phosphor-green)', '#00bfff', '#ff8c00', '#8a2be2'];

  return (
    <div className="rv4-modal-backdrop" onClick={onClose}>
      <div className="rv4-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="rv4-modal-header">
          <div className="rv4-modal-title">
            COMPREHENSIVE MODEL COMPARISON
            <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)', fontWeight: 'normal' }}>
              {models.length} models selected • {selectedPeriod.toUpperCase()}
            </span>
          </div>
          <button className="rv4-modal-close" onClick={onClose}>× CLOSE</button>
        </div>

        {/* Tabs */}
        <div className="rv4-comp-tabs">
          {[
            { id: 'overview', label: 'OVERVIEW' },
            { id: 'charts', label: 'CHARTS' },
            { id: 'radar', label: 'WEB CHART' },
            { id: 'performance', label: 'PERFORMANCE' },
            { id: 'value', label: 'VALUE' },
          ].map(tab => (
            <button key={tab.id} className={`rv4-comp-tab${activeTab === tab.id ? ' active' : ''}`} onClick={() => setActiveTab(tab.id as any)}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Period selection */}
        <div style={{ display: 'flex', gap: '6px', padding: '10px 18px', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid rgba(0,255,65,0.1)' }}>
          <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)', fontFamily: 'var(--font-mono)' }}>TIME PERIOD:</span>
          {(['24h', '7d', '1m'] as const).map(period => (
            <button key={period} className={`rv4-ctrl-btn${selectedPeriod === period ? ' active' : ''}`} onClick={() => setSelectedPeriod(period)} style={{ fontSize: '10px' }}>
              {period.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="rv4-modal-body">
          {loading ? (
            <div className="rv4-loading" style={{ padding: '40px' }}>
              <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
              <span>LOADING ANALYTICS</span>
            </div>
          ) : (
            <>
              {/* Overview tab */}
              {activeTab === 'overview' && (
                <div>
                  <div className="rv4-compare-cards" style={{ marginBottom: '16px' }}>
                    {modelsData.map((model, index) => {
                      const displayScore = model.stats?.currentScore ?? model.currentScore;
                      return (
                        <div key={model.id} className={`rv4-compare-card${index === 0 ? ' winner' : ''}`}>
                          {index === 0 && <div className="rv4-compare-card-winner-badge">BEST</div>}
                          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '2px' }}>
                              {model.displayName || model.name}
                            </div>
                            <div style={{ fontSize: '9px', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                              {model.provider.toUpperCase()}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div className="rv4-compare-score" style={{ color: getScoreColor(displayScore), fontSize: '36px' }}>
                              {typeof displayScore === 'number' ? displayScore.toFixed(1) : 'N/A'}
                            </div>
                            <div style={{ fontSize: '9px', color: 'var(--phosphor-dim)', marginTop: '2px' }}>SCORE ({selectedPeriod.toUpperCase()})</div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '12px', fontSize: '11px' }}>
                            <div style={{ textAlign: 'center', padding: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '2px' }}>
                              <div style={{ fontSize: '9px', color: 'var(--phosphor-dim)' }}>Rank</div>
                              <div style={{ color: 'var(--phosphor-green)', fontWeight: 'bold' }}>#{model.rank}</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '2px' }}>
                              <div style={{ fontSize: '9px', color: 'var(--phosphor-dim)' }}>Trend</div>
                              <div style={{ color: getTrendColor(model.trend), fontWeight: 'bold' }}>{getTrendLabel(model.trend)}</div>
                            </div>
                          </div>
                          <a href={`/models/${model.id}`} className="rv4-ctrl-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', fontSize: '10px', marginTop: '10px', width: '100%' }}
                            onClick={(e) => e.stopPropagation()}>
                            VIEW DETAILS →
                          </a>
                        </div>
                      );
                    })}
                  </div>

                  {validScores.length > 0 && highest && lowest && (
                    <div className="rv4-panel">
                      <div className="rv4-panel-header"><span className="rv4-panel-title">QUICK INSIGHTS</span></div>
                      <div className="rv4-panel-body">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                          {[
                            { label: 'HIGHEST SCORE', value: `${(highest.currentScore as number).toFixed(1)} pts`, sub: highest.displayName || highest.name },
                            { label: 'LOWEST SCORE', value: `${(lowest.currentScore as number).toFixed(1)} pts`, sub: lowest.displayName || lowest.name },
                            { label: 'AVERAGE', value: `${avgScore.toFixed(1)} pts`, sub: `${modelsData.length} models` },
                            { label: 'SPREAD', value: `${((highest.currentScore as number) - (lowest.currentScore as number)).toFixed(1)} pts`, sub: 'Difference' },
                          ].map((ins, i) => (
                            <div key={i} style={{ padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '2px', border: '1px solid rgba(0,255,65,0.1)' }}>
                              <div style={{ fontSize: '9px', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>{ins.label}</div>
                              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--phosphor-green)' }}>{ins.value}</div>
                              <div style={{ fontSize: '9px', color: 'var(--phosphor-dim)', marginTop: '2px' }}>{ins.sub}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Charts tab — Recharts ComposedChart */}
              {activeTab === 'charts' && (
                <div>
                  {(() => {
                    // Build unified timeline — align all models by index position
                    const allModelsData = modelsData.map((model, idx) => {
                      const data = model.history && model.history.length > 0 ? [...model.history].reverse() : [];
                      const displayScores = data.map((d: any) => toDisplayScore(d)).filter((v): v is number => v !== null);
                      return { model, data, displayScores, color: LINE_COLORS[idx % LINE_COLORS.length] };
                    }).filter(m => m.displayScores.length > 0);

                    if (allModelsData.length === 0) {
                      return (
                        <div className="rv4-empty" style={{ padding: '48px' }}>
                          <div className="rv4-empty-title">NO HISTORICAL DATA FOR THIS PERIOD</div>
                          <div className="rv4-empty-text">Try a different time period or select models that have been benchmarked recently.</div>
                        </div>
                      );
                    }

                    // Merge all data points by index, using the longest dataset as x-axis
                    const maxLen = Math.max(...allModelsData.map(m => m.data.length));
                    const chartData = Array.from({ length: maxLen }, (_, i) => {
                      const entry: any = { index: i + 1 };
                      allModelsData.forEach(({ model, data }) => {
                        if (data[i]) {
                          entry[model.id] = toDisplayScore(data[i]);
                        }
                      });
                      return entry;
                    });

                    const CustomTooltip = ({ active, payload, label }: any) => {
                      if (!active || !payload || payload.length === 0) return null;
                      return (
                        <div style={{
                          background: 'rgba(0,0,0,0.95)', border: '1px solid rgba(0,255,65,0.3)',
                          borderRadius: '3px', padding: '10px 12px', fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                        }}>
                          <div style={{ color: 'var(--phosphor-dim)', marginBottom: '6px', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                            POINT {label}
                          </div>
                          {payload.map((p: any) => (
                            <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color, boxShadow: `0 0 4px ${p.color}` }} />
                              <span style={{ color: p.color, fontWeight: 'bold' }}>{p.name}:</span>
                              <span style={{ color: 'var(--metal-silver)' }}>{typeof p.value === 'number' ? p.value.toFixed(1) : 'N/A'}</span>
                            </div>
                          ))}
                        </div>
                      );
                    };

                    return (
                      <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,65,0.15)', borderRadius: '3px', padding: '14px' }}>
                        {/* Per-model stats summary */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', marginBottom: '16px' }}>
                          {allModelsData.map((md) => {
                            const avg = md.displayScores.reduce((a, b) => a + b, 0) / md.displayScores.length;
                            const max = Math.max(...md.displayScores);
                            const min = Math.min(...md.displayScores);
                            return (
                              <div key={md.model.id} style={{
                                padding: '10px 12px', background: 'rgba(0,0,0,0.4)',
                                borderRadius: '3px', borderLeft: `3px solid ${md.color}`,
                                borderTop: `1px solid ${md.color}33`,
                              }}>
                                <div style={{ fontSize: '10px', fontWeight: 'bold', color: md.color, marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {md.model.displayName || md.model.name}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', fontSize: '9px' }}>
                                  <div>
                                    <div style={{ color: 'var(--phosphor-dim)', marginBottom: '2px' }}>AVG</div>
                                    <div style={{ color: md.color, fontWeight: 'bold', fontSize: '12px' }}>{avg.toFixed(1)}</div>
                                  </div>
                                  <div>
                                    <div style={{ color: 'var(--phosphor-dim)', marginBottom: '2px' }}>PEAK</div>
                                    <div style={{ color: md.color, fontWeight: 'bold', fontSize: '12px' }}>{max.toFixed(1)}</div>
                                  </div>
                                  <div>
                                    <div style={{ color: 'var(--phosphor-dim)', marginBottom: '2px' }}>PTS</div>
                                    <div style={{ color: md.color, fontWeight: 'bold', fontSize: '12px' }}>{md.data.length}</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Recharts overlaid line chart */}
                        <div style={{ height: '340px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,65,0.08)" vertical={false} />
                              <XAxis
                                dataKey="index"
                                tick={{ fill: 'var(--phosphor-dim)', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                                axisLine={{ stroke: 'rgba(192,192,192,0.2)' }}
                                tickLine={false}
                                label={{ value: `TIMELINE — ${selectedPeriod.toUpperCase()}`, position: 'insideBottom', fill: 'var(--phosphor-dim)', fontSize: 9, fontFamily: 'var(--font-mono)', dy: 16 }}
                              />
                              <YAxis
                                domain={['auto', 'auto']}
                                tick={{ fill: 'var(--phosphor-dim)', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                                axisLine={{ stroke: 'rgba(192,192,192,0.2)' }}
                                tickLine={false}
                                label={{ value: 'SCORE', angle: -90, position: 'insideLeft', fill: 'var(--phosphor-dim)', fontSize: 9, fontFamily: 'var(--font-mono)', dx: 6 }}
                              />
                              <RechartsTip content={<CustomTooltip />} />
                              {allModelsData.map((md) => (
                                <Line
                                  key={md.model.id}
                                  type="monotone"
                                  dataKey={md.model.id}
                                  name={md.model.displayName || md.model.name}
                                  stroke={md.color}
                                  strokeWidth={2.5}
                                  dot={false}
                                  activeDot={{ r: 4, fill: md.color, stroke: 'var(--terminal-black)', strokeWidth: 1.5 }}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  style={{ filter: `drop-shadow(0 0 4px ${md.color}88)` }}
                                  connectNulls
                                />
                              ))}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Color legend */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px', justifyContent: 'center' }}>
                          {allModelsData.map((md) => (
                            <div key={md.model.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ width: '20px', height: '3px', background: md.color, borderRadius: '2px', boxShadow: `0 0 4px ${md.color}` }} />
                              <span style={{ fontSize: '10px', color: md.color, fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                                {md.model.displayName || md.model.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Radar tab — Web Chart */}
              {activeTab === 'radar' && (
                <div>
                  {(() => {
                    const AXIS_LABELS: Record<string, string> = {
                      correctness: 'Correctness',
                      spec: 'Spec Compliance',
                      codeQuality: 'Code Quality',
                      efficiency: 'Efficiency',
                      stability: 'Stability',
                      refusal: 'Refusal Rate',
                      recovery: 'Recovery',
                    };
                    const AXIS_KEYS = Object.keys(AXIS_LABELS);

                    const modelsWithAxes = modelsData.filter(m => m.axes);

                    if (modelsWithAxes.length === 0) {
                      return (
                        <div className="rv4-empty" style={{ padding: '48px' }}>
                          <div className="rv4-empty-title">NO AXES DATA AVAILABLE</div>
                          <div className="rv4-empty-text">7-axis data is available after benchmarks run. Try the 7D or 1M period.</div>
                        </div>
                      );
                    }

                    // Build radar data: one entry per axis
                    const radarData = AXIS_KEYS.map(key => {
                      const entry: any = { axis: AXIS_LABELS[key] };
                      modelsWithAxes.forEach(m => {
                        entry[m.id] = Math.round((m.axes[key] || 0) * 100);
                      });
                      return entry;
                    });

                    const CustomRadarTooltip = ({ active, payload }: any) => {
                      if (!active || !payload || payload.length === 0) return null;
                      return (
                        <div style={{
                          background: 'rgba(0,0,0,0.95)', border: '1px solid rgba(0,255,65,0.3)',
                          borderRadius: '3px', padding: '10px 12px', fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                        }}>
                          <div style={{ color: 'var(--phosphor-dim)', marginBottom: '6px', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                            {payload[0]?.payload?.axis}
                          </div>
                          {payload.map((p: any) => {
                            const modelData = modelsWithAxes.find(m => m.id === p.dataKey);
                            const color = LINE_COLORS[modelsWithAxes.indexOf(modelData!) % LINE_COLORS.length];
                            return (
                              <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}` }} />
                                <span style={{ color, fontWeight: 'bold' }}>{modelData?.displayName || modelData?.name}:</span>
                                <span style={{ color: 'var(--metal-silver)' }}>{p.value}%</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    };

                    return (
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', marginBottom: '14px', letterSpacing: '0.3px' }}>
                          7-AXIS PERFORMANCE WEB CHART — comparing {modelsWithAxes.length} model{modelsWithAxes.length > 1 ? 's' : ''} across all scoring dimensions
                        </div>
                        <div style={{ height: '420px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData} margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
                              <PolarGrid stroke="rgba(0,255,65,0.12)" />
                              <PolarAngleAxis
                                dataKey="axis"
                                tick={{ fill: 'var(--phosphor-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                              />
                              <PolarRadiusAxis
                                angle={0}
                                domain={[0, 100]}
                                tick={{ fill: 'var(--phosphor-dim)', fontSize: 8, fontFamily: 'var(--font-mono)' }}
                                tickCount={4}
                              />
                              <RechartsTip content={<CustomRadarTooltip />} />
                              {modelsWithAxes.map((model, idx) => {
                                const color = LINE_COLORS[idx % LINE_COLORS.length];
                                return (
                                  <Radar
                                    key={model.id}
                                    name={model.displayName || model.name}
                                    dataKey={model.id}
                                    stroke={color}
                                    fill={color}
                                    fillOpacity={0.1}
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: color, strokeWidth: 0 }}
                                  />
                                );
                              })}
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Legend */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginBottom: '16px' }}>
                          {modelsWithAxes.map((model, idx) => {
                            const color = LINE_COLORS[idx % LINE_COLORS.length];
                            return (
                              <div key={model.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '16px', height: '3px', background: color, borderRadius: '2px', boxShadow: `0 0 4px ${color}` }} />
                                <span style={{ fontSize: '10px', color, fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                                  {model.displayName || model.name}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Axis score table */}
                        <div className="rv4-table-wrapper">
                          <table className="rv4-table">
                            <thead>
                              <tr>
                                <th>AXIS</th>
                                {modelsWithAxes.map((m, idx) => (
                                  <th key={m.id} style={{ color: LINE_COLORS[idx % LINE_COLORS.length] }}>
                                    {(m.displayName || m.name).toUpperCase()}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {AXIS_KEYS.map(key => (
                                <tr key={key}>
                                  <td className="td-dim" style={{ textTransform: 'uppercase', letterSpacing: '0.4px', fontSize: '10px' }}>
                                    {AXIS_LABELS[key]}
                                  </td>
                                  {modelsWithAxes.map((m, idx) => {
                                    const pct = Math.round((m.axes[key] || 0) * 100);
                                    const color = pct >= 80 ? 'var(--phosphor-green)' : pct >= 60 ? 'var(--amber-warning)' : 'var(--red-alert)';
                                    return (
                                      <td key={m.id} style={{ fontWeight: 'bold', color, fontSize: '11px' }}>
                                        {pct}%
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Performance tab */}
              {activeTab === 'performance' && (
                <div>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)', fontFamily: 'var(--font-mono)' }}>TEST TYPE:</span>
                    {(['combined', '7axis', 'reasoning', 'tooling'] as const).map(type => (
                      <button key={type} className={`rv4-ctrl-btn${selectedTestType === type ? ' active' : ''}`} onClick={() => setSelectedTestType(type)} style={{ fontSize: '10px' }}>
                        {type === '7axis' ? '7-AXIS' : type.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                    {modelsData.map((model) => {
                      const axes = model.axes || { correctness: 0, spec: 0, codeQuality: 0, efficiency: 0, stability: 0, refusal: 0, recovery: 0 };
                      let metrics: Array<{ key: string; label: string; weight: string; value: number }> = [];
                      if (selectedTestType === '7axis') {
                        metrics = [
                          { key: 'correctness', label: 'Correctness', weight: '35%', value: axes.correctness || 0 },
                          { key: 'spec', label: 'Spec Compliance', weight: '15%', value: axes.spec || 0 },
                          { key: 'codeQuality', label: 'Code Quality', weight: '15%', value: axes.codeQuality || 0 },
                          { key: 'efficiency', label: 'Efficiency', weight: '10%', value: axes.efficiency || 0 },
                          { key: 'stability', label: 'Stability', weight: '10%', value: axes.stability || 0 },
                          { key: 'refusal', label: 'Refusal Rate', weight: '10%', value: axes.refusal || 0 },
                          { key: 'recovery', label: 'Recovery', weight: '5%', value: axes.recovery || 0 },
                        ];
                      } else {
                        metrics = [
                          { key: 'correctness', label: 'Coding Accuracy', weight: '25%', value: axes.correctness || 0 },
                          { key: 'efficiency', label: 'Speed', weight: '20%', value: axes.efficiency || 0 },
                          { key: 'codeQuality', label: 'Code Quality', weight: '15%', value: axes.codeQuality || 0 },
                          { key: 'spec', label: 'Spec Compliance', weight: '10%', value: axes.spec || 0 },
                          { key: 'stability', label: 'Stability', weight: '15%', value: axes.stability || 0 },
                          { key: 'recovery', label: 'Recovery', weight: '10%', value: axes.recovery || 0 },
                          { key: 'refusal', label: 'Refusal Rate', weight: '5%', value: axes.refusal || 0 },
                        ];
                      }
                      return (
                        <div key={model.id} style={{ padding: '14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,65,0.15)', borderRadius: '3px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '12px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            {model.displayName || model.name}
                          </div>
                          {metrics.map((metric) => {
                            const pct = Math.round(metric.value * 100);
                            const color = pct >= 80 ? 'var(--phosphor-green)' : pct >= 60 ? 'var(--amber-warning)' : 'var(--red-alert)';
                            return (
                              <div key={metric.key} style={{ marginBottom: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>{metric.label} <span style={{ opacity: 0.6 }}>({metric.weight})</span></span>
                                  <span style={{ color, fontWeight: 'bold', fontSize: '10px' }}>{pct}%</span>
                                </div>
                                <div className="rv4-progress">
                                  <div className="rv4-progress-fill" style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: '3px', transition: 'width 0.5s ease', boxShadow: `0 0 4px ${color}` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Value tab */}
              {activeTab === 'value' && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    COST AND VALUE ANALYSIS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {modelsData.map((model) => {
                      const pricing = getModelPricing(model);
                      return (
                        <div key={model.id} style={{ padding: '14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,176,0,0.2)', borderRadius: '3px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '12px', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '2px' }}>{model.displayName || model.name}</div>
                              <div style={{ fontSize: '9px', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{model.provider.toUpperCase()}</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '6px' }}>
                              {[
                                { label: 'Score', value: typeof model.currentScore === 'number' ? model.currentScore.toFixed(1) : 'N/A', color: 'var(--phosphor-green)' },
                                { label: 'Input/1M', value: `$${pricing.input}`, color: 'var(--amber-warning)' },
                                { label: 'Output/1M', value: `$${pricing.output}`, color: 'var(--amber-warning)' },
                                { label: 'Est. Cost', value: `$${pricing.estimatedCost.toFixed(2)}`, color: 'var(--metal-silver)' },
                                { label: 'Value pts/$', value: pricing.valueScore, color: 'var(--phosphor-green)' },
                              ].map((item, i) => (
                                <div key={i} style={{ textAlign: 'center', padding: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '2px' }}>
                                  <div style={{ fontSize: '8px', color: 'var(--phosphor-dim)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{item.label}</div>
                                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: item.color }}>{item.value}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="rv4-info-banner blue" style={{ marginTop: '14px' }}>
                    <span className="rv4-info-banner-icon" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold' }}>[i]</span>
                    <div className="rv4-info-banner-content">
                      <div className="rv4-info-banner-title">VALUE CALCULATION</div>
                      <div className="rv4-info-banner-text">
                        Value Score = Performance Score / Estimated Cost per 1M tokens. Higher is better.
                        Estimated costs assume 40% input tokens, 60% output tokens. All prices in USD per 1M tokens.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DownloadModal({ model, downloading, onDownload, onClose }: { model: Model; downloading: boolean; onDownload: (format: 'csv' | 'json') => void; onClose: () => void }) {
  return (
    <div className="rv4-modal-backdrop" onClick={onClose}>
      <div className="rv4-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="rv4-modal-header">
          <span className="rv4-modal-title">DOWNLOAD MODEL DATA</span>
          <button className="rv4-modal-close" onClick={onClose}>× CLOSE</button>
        </div>
        <div className="rv4-modal-body">
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '4px' }}>{model.displayName || model.name}</div>
            <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{model.provider}</div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--phosphor-dim)', marginBottom: '16px', lineHeight: '1.5', textAlign: 'center' }}>
            Download comprehensive model intelligence including performance metrics, 7-axis breakdown, pricing analysis, and 30-day historical data.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={() => onDownload('csv')} disabled={downloading} className="rv4-ctrl-btn primary" style={{ width: '100%', fontSize: '11px', padding: '12px' }}>
              {downloading ? 'DOWNLOADING...' : 'DOWNLOAD CSV'}
            </button>
            <button onClick={() => onDownload('json')} disabled={downloading} className="rv4-ctrl-btn primary" style={{ width: '100%', fontSize: '11px', padding: '12px' }}>
              {downloading ? 'DOWNLOADING...' : 'DOWNLOAD JSON'}
            </button>
            <button onClick={onClose} disabled={downloading} className="rv4-ctrl-btn" style={{ width: '100%', fontSize: '11px', padding: '10px' }}>
              CANCEL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
