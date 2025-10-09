'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import SubscriptionGuard from '@/components/SubscriptionGuard';

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

export default function ModelIntelligencePage() {
  const { data: session, status } = useSession();
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'rank' | 'score' | 'name'>('rank');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [downloadingModel, setDownloadingModel] = useState<Model | null>(null);
  const [downloading, setDownloading] = useState(false);

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

      const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
      
      const response = await fetch(`${apiUrl}/dashboard/scores?period=latest&sortBy=combined`);
      if (!response.ok) throw new Error('Failed to fetch model data');
      
      const data = await response.json();
      
      if (data.success && data.data) {
        const transformedModels = data.data.map((model: any, index: number) => ({
          id: model.id,
          name: model.name,
          displayName: model.displayName || model.name,
          provider: model.provider,
          currentScore: model.currentScore,
          score: typeof model.currentScore === 'number' ? model.currentScore : 0,
          rank: index + 1,
          trend: model.trend || 'stable',
          lastUpdated: model.lastUpdated || new Date().toISOString(),
          category: model.category,
          status: model.status,
          history: model.history || []
        }));
        
        setModels(transformedModels);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Failed to fetch model data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load model data');
    } finally {
      setLoading(false);
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
    .filter(m => filterCategory === 'all' || m.category === filterCategory)
    .filter(m => filterProvider === 'all' || m.provider === filterProvider)
    .sort((a, b) => {
      if (sortBy === 'rank') return a.rank - b.rank;
      if (sortBy === 'score') {
        const aScore = typeof a.currentScore === 'number' ? a.currentScore : -1;
        const bScore = typeof b.currentScore === 'number' ? b.currentScore : -1;
        return bScore - aScore;
      }
      return a.name.localeCompare(b.name);
    });

  const categories = ['all', ...Array.from(new Set(models.map(m => m.category).filter((c): c is string => Boolean(c))))];
  const providers = ['all', ...Array.from(new Set(models.map(m => m.provider)))];

  if (status === 'unauthenticated') {
    return (
      <RouterLayout>
        <div className="vintage-container">
          <div className="error-banner">
            <div className="terminal-text">
              <div className="terminal-text--red" style={{ fontSize: '1.2em', marginBottom: '12px' }}>
                ⚠️ AUTHENTICATION REQUIRED
              </div>
              <div className="terminal-text--dim">
                Please sign in to access Model Intelligence
              </div>
            </div>
          </div>
        </div>
      </RouterLayout>
    );
  }

  return (
    <RouterLayout>
      <SubscriptionGuard feature="Intelligence">
      <div className="vintage-container">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">
              <span className="terminal-text--green">🧠 MODEL INTELLIGENCE</span>
              <span className="blinking-cursor"></span>
            </h1>
            <p className="dashboard-subtitle terminal-text--dim">
              Comprehensive AI model analytics, benchmarks, and comparison tools
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                Auto-refresh
              </span>
            </label>
            <button onClick={fetchModelData} className="vintage-btn vintage-btn--sm">
              🔄 REFRESH
            </button>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            <div className="terminal-text">
              <div className="terminal-text--red" style={{ fontSize: '1em', marginBottom: '8px' }}>
                ⚠️ ERROR
              </div>
              <div className="terminal-text--dim" style={{ marginBottom: '8px' }}>
                {error}
              </div>
              <button onClick={fetchModelData} className="vintage-btn vintage-btn--danger">
                RETRY
              </button>
            </div>
          </div>
        )}

        <div className="section-card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="section-header">
            <span className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
              🎛️ FILTERS & CONTROLS
            </span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
            <div>
              <label className="terminal-text--dim" style={{ fontSize: '0.85em', display: 'block', marginBottom: '8px' }}>
                CATEGORY
              </label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="mobile-form-select"
                style={{ width: '100%' }}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="terminal-text--dim" style={{ fontSize: '0.85em', display: 'block', marginBottom: '8px' }}>
                PROVIDER
              </label>
              <select
                value={filterProvider}
                onChange={(e) => setFilterProvider(e.target.value)}
                className="mobile-form-select"
                style={{ width: '100%' }}
              >
                {providers.map(prov => (
                  <option key={prov} value={prov}>{prov.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="terminal-text--dim" style={{ fontSize: '0.85em', display: 'block', marginBottom: '8px' }}>
                SORT BY
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="mobile-form-select"
                style={{ width: '100%' }}
              >
                <option value="rank">RANK</option>
                <option value="score">SCORE</option>
                <option value="name">NAME</option>
              </select>
            </div>
          </div>

          {selectedModels.length > 0 && (
            <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'rgba(0, 255, 65, 0.1)', borderRadius: '6px' }}>
              <div className="terminal-text--green" style={{ fontSize: '0.9em', marginBottom: '8px' }}>
                {selectedModels.length} model{selectedModels.length > 1 ? 's' : ''} selected for comparison
              </div>
              <button
                onClick={() => setSelectedModels([])}
                className="vintage-btn vintage-btn--sm"
                style={{ marginRight: '8px' }}
              >
                CLEAR SELECTION
              </button>
              {selectedModels.length >= 2 && (
                <button 
                  onClick={() => setShowCompareModal(true)}
                  className="vintage-btn vintage-btn--sm"
                >
                  📊 COMPARE MODELS
                </button>
              )}
            </div>
          )}
        </div>

        <div className="section-card">
          <div className="section-header">
            <span className="terminal-text--green" style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
              🏆 LIVE MODEL RANKINGS
            </span>
            <span className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
              {filteredModels.length} models
            </span>
          </div>

          {loading && models.length === 0 ? (
            <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
              <div className="terminal-text--dim">
                LOADING MODEL DATA<span className="vintage-loading"></span>
              </div>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="empty-state">
              <div className="terminal-text--dim">No models match the current filters</div>
            </div>
          ) : (
            <div className="intelligence-grid">
              {filteredModels.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  isSelected={selectedModels.includes(model.id)}
                  onToggleSelect={() => toggleModelSelection(model.id)}
                  canSelect={selectedModels.length < 4 || selectedModels.includes(model.id)}
                  onDownloadClick={(m) => setDownloadingModel(m)}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
          <div className="section-card">
            <div className="terminal-text--green" style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '12px' }}>
              📊 TOTAL MODELS
            </div>
            <div className="terminal-text--green" style={{ fontSize: '2.5em', fontWeight: 'bold', textShadow: '0 0 10px currentColor' }}>
              {models.filter(m => m.currentScore !== 'unavailable').length}
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginTop: '8px' }}>
              Actively tracked
            </div>
          </div>

          <div className="section-card">
            <div className="terminal-text--green" style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '12px' }}>
              🔌 PROVIDERS
            </div>
            <div className="terminal-text--amber" style={{ fontSize: '2.5em', fontWeight: 'bold', textShadow: '0 0 10px currentColor' }}>
              {providers.length - 1}
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginTop: '8px' }}>
              Connected services
            </div>
          </div>

          <div className="section-card">
            <div className="terminal-text--green" style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '12px' }}>
              🎯 CATEGORIES
            </div>
            <div className="terminal-text--green" style={{ fontSize: '2.5em', fontWeight: 'bold', textShadow: '0 0 10px currentColor' }}>
              {categories.length - 1}
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginTop: '8px' }}>
              Benchmark types
            </div>
          </div>
        </div>

        {showCompareModal && (
          <ComparisonModal
            models={models.filter(m => selectedModels.includes(m.id))}
            onClose={() => setShowCompareModal(false)}
          />
        )}

        {/* Download Modal - Rendered at root level */}
        {downloadingModel && (
          <DownloadModal
            model={downloadingModel}
            downloading={downloading}
            onDownload={async (format) => {
              setDownloading(true);
              try {
                const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
                
                const [historyRes, statsRes, modelRes] = await Promise.all([
                  fetch(`${apiUrl}/dashboard/history/${downloadingModel.id}?period=30d&sortBy=combined`),
                  fetch(`${apiUrl}/api/models/${downloadingModel.id}/stats?period=30d&sortBy=combined`),
                  fetch(`${apiUrl}/api/models/${downloadingModel.id}`)
                ]);
                
                const history = historyRes.ok ? await historyRes.json() : null;
                const stats = statsRes.ok ? await statsRes.json() : null;
                const modelDetails = modelRes.ok ? await modelRes.json() : null;

                const mapAxesFields = (apiAxes: any) => {
                  if (!apiAxes) return null;
                  return {
                    correctness: apiAxes.correctness || 0,
                    spec: apiAxes.complexity || apiAxes.spec || 0,
                    codeQuality: apiAxes.codeQuality || 0,
                    efficiency: apiAxes.efficiency || 0,
                    stability: apiAxes.stability || 0,
                    refusal: apiAxes.edgeCases || apiAxes.refusal || 0,
                    recovery: apiAxes.debugging || apiAxes.recovery || 0
                  };
                };

                // Get axes from the most recent historical data point (most accurate)
                let axes = null;
                if (history?.data && history.data.length > 0) {
                  // History data is already sorted with most recent first
                  axes = mapAxesFields(history.data[0]?.axes);
                }
                
                // Fallback to model's latest score if no history data
                if (!axes) {
                  axes = mapAxesFields(modelDetails?.latestScore?.axes);
                }

                const getModelPricing = () => {
                  const name = downloadingModel.name.toLowerCase();
                  const prov = downloadingModel.provider.toLowerCase();
                  let pricing = { input: 0, output: 0 };
                  
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
                    pricing = { input: 5, output: 15 };
                  } else if (prov === 'google') {
                    if (name.includes('2.5-pro')) pricing = { input: 1.25, output: 5 };
                    else if (name.includes('2.5-flash-lite')) pricing = { input: 0.10, output: 0.40 };
                    else if (name.includes('2.5-flash')) pricing = { input: 0.30, output: 2.50 };
                    else pricing = { input: 2, output: 6 };
                  } else {
                    pricing = { input: 3, output: 10 };
                  }
                  
                  const estimatedCost = (pricing.input * 0.4) + (pricing.output * 0.6);
                  const valueScore = downloadingModel.currentScore !== 'unavailable' && typeof downloadingModel.currentScore === 'number' 
                    ? (downloadingModel.currentScore / estimatedCost).toFixed(1) 
                    : '0.0';
                  
                  return { ...pricing, estimatedCost, valueScore };
                };

                const pricing = getModelPricing();
                const timestamp = new Date().toISOString().split('T')[0];
                const fileName = `${downloadingModel.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${timestamp}`;

                if (format === 'csv') {
                  let csv = '# MODEL INTELLIGENCE REPORT\n';
                  csv += `Export Date,${new Date().toLocaleString()}\n`;
                  csv += `Model ID,${downloadingModel.id}\n`;
                  csv += `Model Name,${downloadingModel.displayName || downloadingModel.name}\n`;
                  csv += `Provider,${downloadingModel.provider}\n\n`;

                  csv += '# CURRENT PERFORMANCE\n';
                  csv += 'Metric,Value\n';
                  csv += `Overall Score,${typeof downloadingModel.currentScore === 'number' ? downloadingModel.currentScore.toFixed(2) : 'N/A'}\n`;
                  csv += `Global Rank,#${downloadingModel.rank}\n`;
                  csv += `Trend,${downloadingModel.trend}\n`;
                  csv += `Category,${downloadingModel.category || 'N/A'}\n`;
                  csv += `Status,${downloadingModel.status || 'Active'}\n`;
                  csv += `Last Updated,${new Date(downloadingModel.lastUpdated).toISOString()}\n\n`;

                  if (axes) {
                    csv += '# 7-AXIS PERFORMANCE BREAKDOWN\n';
                    csv += 'Axis,Score,Percentage\n';
                    csv += `Correctness,${axes.correctness.toFixed(4)},${(axes.correctness * 100).toFixed(1)}%\n`;
                    csv += `Spec Compliance,${axes.spec.toFixed(4)},${(axes.spec * 100).toFixed(1)}%\n`;
                    csv += `Code Quality,${axes.codeQuality.toFixed(4)},${(axes.codeQuality * 100).toFixed(1)}%\n`;
                    csv += `Efficiency,${axes.efficiency.toFixed(4)},${(axes.efficiency * 100).toFixed(1)}%\n`;
                    csv += `Stability,${axes.stability.toFixed(4)},${(axes.stability * 100).toFixed(1)}%\n`;
                    csv += `Refusal Rate,${axes.refusal.toFixed(4)},${(axes.refusal * 100).toFixed(1)}%\n`;
                    csv += `Recovery,${axes.recovery.toFixed(4)},${(axes.recovery * 100).toFixed(1)}%\n\n`;
                  }

                  csv += '# PRICING & VALUE ANALYSIS\n';
                  csv += 'Metric,Value\n';
                  csv += `Input Cost (per 1M tokens),$${pricing.input}\n`;
                  csv += `Output Cost (per 1M tokens),$${pricing.output}\n`;
                  csv += `Estimated Cost (per 1M tokens),$${pricing.estimatedCost.toFixed(2)}\n`;
                  csv += `Value Score (pts/$),${pricing.valueScore}\n\n`;

                  if (stats) {
                    csv += '# STATISTICS (30-DAY PERIOD)\n';
                    csv += 'Metric,Value\n';
                    csv += `Current Score,${stats.currentScore || 'N/A'}\n`;
                    csv += `Average Score,${stats.averageScore || 'N/A'}\n`;
                    csv += `Peak Score,${stats.peakScore || 'N/A'}\n`;
                    csv += `Lowest Score,${stats.lowestScore || 'N/A'}\n\n`;
                  }

                  if (history?.data && history.data.length > 0) {
                    csv += '# HISTORICAL PERFORMANCE (30-DAY TIMELINE)\n';
                    csv += 'Date,Score,Correctness,Spec,Code Quality,Efficiency,Stability,Refusal,Recovery\n';
                    history.data.slice(0, 30).forEach((point: any) => {
                      const pointAxes = mapAxesFields(point.axes);
                      csv += `${new Date(point.timestamp || point.period).toISOString()},`;
                      csv += `${point.score || point.displayScore || point.currentScore || 'N/A'},`;
                      csv += `${pointAxes?.correctness.toFixed(4) || 'N/A'},`;
                      csv += `${pointAxes?.spec.toFixed(4) || 'N/A'},`;
                      csv += `${pointAxes?.codeQuality.toFixed(4) || 'N/A'},`;
                      csv += `${pointAxes?.efficiency.toFixed(4) || 'N/A'},`;
                      csv += `${pointAxes?.stability.toFixed(4) || 'N/A'},`;
                      csv += `${pointAxes?.refusal.toFixed(4) || 'N/A'},`;
                      csv += `${pointAxes?.recovery.toFixed(4) || 'N/A'}\n`;
                    });
                  }

                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${fileName}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                } else {
                  const exportData = {
                    exportDate: new Date().toISOString(),
                    model: {
                      id: downloadingModel.id,
                      name: downloadingModel.name,
                      displayName: downloadingModel.displayName || downloadingModel.name,
                      provider: downloadingModel.provider,
                      category: downloadingModel.category,
                      status: downloadingModel.status || 'Active'
                    },
                    currentPerformance: {
                      overallScore: downloadingModel.currentScore,
                      rank: downloadingModel.rank,
                      trend: downloadingModel.trend,
                      lastUpdated: downloadingModel.lastUpdated
                    },
                    axes: axes ? {
                      correctness: { value: axes.correctness, percentage: (axes.correctness * 100).toFixed(1) + '%' },
                      specCompliance: { value: axes.spec, percentage: (axes.spec * 100).toFixed(1) + '%' },
                      codeQuality: { value: axes.codeQuality, percentage: (axes.codeQuality * 100).toFixed(1) + '%' },
                      efficiency: { value: axes.efficiency, percentage: (axes.efficiency * 100).toFixed(1) + '%' },
                      stability: { value: axes.stability, percentage: (axes.stability * 100).toFixed(1) + '%' },
                      refusalRate: { value: axes.refusal, percentage: (axes.refusal * 100).toFixed(1) + '%' },
                      recovery: { value: axes.recovery, percentage: (axes.recovery * 100).toFixed(1) + '%' }
                    } : null,
                    pricing: {
                      inputCostPer1M: pricing.input,
                      outputCostPer1M: pricing.output,
                      estimatedCostPer1M: pricing.estimatedCost,
                      valueScore: pricing.valueScore,
                      currency: 'USD'
                    },
                    statistics: stats ? {
                      period: '30d',
                      currentScore: stats.currentScore,
                      averageScore: stats.averageScore,
                      peakScore: stats.peakScore,
                      lowestScore: stats.lowestScore
                    } : null,
                    historicalData: history?.data ? history.data.slice(0, 30).map((point: any) => {
                      const pointAxes = mapAxesFields(point.axes);
                      return {
                        timestamp: point.timestamp || point.period,
                        score: point.score || point.displayScore || point.currentScore,
                        axes: pointAxes
                      };
                    }) : [],
                    metadata: {
                      dataSource: 'AI Stupid Meter',
                      website: 'https://aistupidlevel.info',
                      exportFormat: 'JSON',
                      version: '1.0'
                    }
                  };

                  const json = JSON.stringify(exportData, null, 2);
                  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${fileName}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }

                setDownloadingModel(null);
              } catch (err) {
                console.error('Failed to download model data:', err);
                alert('Failed to download model data. Please try again.');
              } finally {
                setDownloading(false);
              }
            }}
            onClose={() => setDownloadingModel(null)}
          />
        )}

        <div className="dashboard-footer">
          <div className="terminal-text--dim">
            Data sourced from AI Stupid Meter • Real-time benchmarks • <a href="/" className="footer-link">View Main Site</a>
          </div>
        </div>
      </div>
      </SubscriptionGuard>
    </RouterLayout>
  );
}

// Helper functions for chart rendering (from model details page)
const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

const toDisplayScore = (point: any): number | null => {
  if (!point) return null;

  // PRIORITY 1: Direct score field
  if (typeof point.score === 'number' && !Number.isNaN(point.score)) {
    return clamp(Math.round(point.score));
  }

  // PRIORITY 2: Legacy displayScore/currentScore
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
    if (z >= 0 && z <= 100) {
      return clamp(Math.round(z));
    }
    return clamp(Math.round(50 + z * 10));
  }

  return null;
};

function ComparisonModal({ models, onClose }: { models: Model[]; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'performance' | 'value'>('overview');
  const [selectedPeriod, setSelectedPeriod] = useState<'24h' | '7d' | '1m'>('7d');
  const [selectedTestType, setSelectedTestType] = useState<'combined' | '7axis' | 'reasoning' | 'tooling'>('combined');
  const [modelsData, setModelsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  useEffect(() => {
    fetchDetailedData();
  }, [models, selectedPeriod, selectedTestType]);

  const fetchDetailedData = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? 'https://aistupidlevel.info' : 'http://localhost:4000';
      
      // Map test type to sortBy parameter (same as model details page)
      const sortByParam = selectedTestType === '7axis' ? '7axis' : selectedTestType;
      
      console.log(`🔄 Fetching comparison data for period: ${selectedPeriod}, testType: ${selectedTestType}, sortBy: ${sortByParam}`);
      
      const detailedData = await Promise.all(
        models.map(async (model) => {
          try {
            // Use the same endpoints as model details page with correct sortBy
            const [historyRes, statsRes, modelRes] = await Promise.all([
              fetch(`${apiUrl}/dashboard/history/${model.id}?period=${selectedPeriod}&sortBy=${sortByParam}`),
              fetch(`${apiUrl}/api/models/${model.id}/stats?period=${selectedPeriod}&sortBy=${sortByParam}`),
              fetch(`${apiUrl}/api/models/${model.id}`)
            ]);
            
            const history = historyRes.ok ? await historyRes.json() : null;
            const stats = statsRes.ok ? await statsRes.json() : null;
            const modelDetails = modelRes.ok ? await modelRes.json() : null;
            
            // Helper function to map API axes field names to frontend field names
            const mapAxesFields = (apiAxes: any) => {
              if (!apiAxes) return null;
              
              return {
                correctness: apiAxes.correctness || 0,
                spec: apiAxes.complexity || apiAxes.spec || 0,  // API uses 'complexity', frontend uses 'spec'
                codeQuality: apiAxes.codeQuality || 0,
                efficiency: apiAxes.efficiency || 0,
                stability: apiAxes.stability || 0,
                refusal: apiAxes.edgeCases || apiAxes.refusal || 0,  // API uses 'edgeCases', frontend uses 'refusal'
                recovery: apiAxes.debugging || apiAxes.recovery || 0  // API uses 'debugging', frontend uses 'recovery'
              };
            };
            
            // Get period-specific axes from history data (most recent point in period)
            let periodAxes = null;
            if (history?.data && history.data.length > 0) {
              // Use the most recent data point's axes for the selected period
              const latestPoint = history.data[0];
              periodAxes = mapAxesFields(latestPoint?.axes);
            }
            
            // Fallback to model's latest score axes if no period data
            const axes = periodAxes || mapAxesFields(modelDetails?.latestScore?.axes) || null;
            
            console.log(`📊 Loaded data for ${model.name}:`, {
              historyPoints: history?.data?.length || 0,
              hasStats: !!stats,
              hasPeriodAxes: !!periodAxes,
              hasLatestAxes: !!(modelDetails?.latestScore?.axes),
              usingAxes: periodAxes ? 'period-specific' : 'latest'
            });
            
            return {
              ...model,
              history: history?.data || [],
              stats: stats || {},
              axes: axes,
              modelDetails: modelDetails
            };
          } catch (err) {
            console.error(`Failed to fetch data for ${model.name}:`, err);
            return { ...model, history: [], stats: {}, axes: null, modelDetails: null };
          }
        })
      );
      
      setModelsData(detailedData);
    } catch (err) {
      console.error('Failed to fetch detailed data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (models.length === 0) return null;

  const getScoreColor = (score: number | 'unavailable') => {
    if (score === 'unavailable') return 'var(--phosphor-dim)';
    if (score >= 80) return 'var(--phosphor-green)';
    if (score >= 60) return 'var(--amber-warning)';
    return 'var(--red-alert)';
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return '📈';
    if (trend === 'down') return '📉';
    return '➡️';
  };

  const validScores = modelsData.filter(m => typeof m.currentScore === 'number');
  const highest = validScores.length > 0 ? validScores.reduce((max, m) => 
    (m.currentScore as number) > (max.currentScore as number) ? m : max
  ) : null;
  const lowest = validScores.length > 0 ? validScores.reduce((min, m) => 
    (m.currentScore as number) < (min.currentScore as number) ? m : min
  ) : null;
  const avgScore = validScores.length > 0 ? validScores.reduce((sum, m) => sum + (m.currentScore as number), 0) / validScores.length : 0;

  // Calculate pricing for each model
  const getModelPricing = (model: any) => {
    const name = model.name.toLowerCase();
    const prov = model.provider.toLowerCase();
    let pricing = { input: 0, output: 0 };
    
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
      pricing = { input: 5, output: 15 };
    } else if (prov === 'google') {
      if (name.includes('2.5-pro')) pricing = { input: 1.25, output: 5 };
      else if (name.includes('2.5-flash-lite')) pricing = { input: 0.10, output: 0.40 };
      else if (name.includes('2.5-flash')) pricing = { input: 0.30, output: 2.50 };
      else pricing = { input: 2, output: 6 };
    } else {
      pricing = { input: 3, output: 10 };
    }
    
    const estimatedCost = (pricing.input * 0.4) + (pricing.output * 0.6);
    const valueScore = model.currentScore > 0 ? (model.currentScore / estimatedCost).toFixed(1) : '0.0';
    
    return { ...pricing, estimatedCost, valueScore };
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
        overflowY: 'auto'
      }}
      onClick={onClose}
    >
      <div 
        className="section-card"
        style={{
          maxWidth: '1600px',
          width: '100%',
          maxHeight: '95vh',
          overflowY: 'auto',
          margin: '20px',
          position: 'relative',
          background: 'linear-gradient(135deg, #1a1a1a, #0a0a0a)',
          border: '2px solid var(--phosphor-green)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 'var(--space-md)',
          padding: 'var(--space-md)',
          borderBottom: '2px solid rgba(0, 255, 65, 0.3)',
          background: 'rgba(0, 255, 65, 0.05)'
        }}>
          <div>
            <h2 className="terminal-text--green" style={{ fontSize: '1.8em', marginBottom: '8px', textShadow: '0 0 10px currentColor' }}>
              📊 COMPREHENSIVE MODEL COMPARISON
            </h2>
            <p className="terminal-text--dim" style={{ fontSize: '0.95em' }}>
              Deep analytics for {models.length} selected models • Period: {selectedPeriod.toUpperCase()}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="vintage-btn vintage-btn--danger"
            style={{ fontSize: '1.3em', padding: '10px 20px' }}
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: 'var(--space-md)',
          padding: 'var(--space-sm) var(--space-md)',
          flexWrap: 'wrap'
        }}>
          {[
            { id: 'overview', label: '📋 OVERVIEW', icon: '📋' },
            { id: 'charts', label: '📈 CHARTS', icon: '📈' },
            { id: 'performance', label: '🎯 PERFORMANCE', icon: '🎯' },
            { id: 'value', label: '💰 VALUE', icon: '💰' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`vintage-btn ${activeTab === tab.id ? 'vintage-btn--active' : ''}`}
              style={{
                flex: '1 1 auto',
                minWidth: '120px',
                background: activeTab === tab.id ? 'var(--phosphor-green)' : 'linear-gradient(135deg, #333, #222)',
                color: activeTab === tab.id ? 'var(--terminal-black)' : 'var(--phosphor-green)',
                fontWeight: 'bold',
                fontSize: '0.9em'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Period Selection */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: 'var(--space-lg)',
          padding: '0 var(--space-md)',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <span className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
            Time Period:
          </span>
          {(['24h', '7d', '1m'] as const).map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`vintage-btn vintage-btn--sm ${selectedPeriod === period ? 'vintage-btn--active' : ''}`}
              style={{
                background: selectedPeriod === period ? 'var(--phosphor-green)' : 'transparent',
                color: selectedPeriod === period ? 'var(--terminal-black)' : 'var(--phosphor-green)',
                fontSize: '0.85em'
              }}
            >
              {period.toUpperCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
            <div className="terminal-text--dim">
              LOADING COMPREHENSIVE ANALYTICS<span className="vintage-loading"></span>
            </div>
          </div>
        ) : (
          <div style={{ padding: '0 var(--space-md)', marginBottom: 'var(--space-lg)' }}>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(auto-fit, minmax(${Math.max(280, Math.floor(1200 / models.length))}px, 1fr))`,
            gap: 'var(--space-md)',
            marginBottom: 'var(--space-lg)'
          }}>
            {modelsData.map((model, index) => {
              // Use period-specific score from stats API
              const displayScore = model.stats?.currentScore ?? model.currentScore;
              
              return (
              <div 
                key={model.id}
                style={{
                  padding: 'var(--space-md)',
                  border: `2px solid ${index === 0 ? 'var(--phosphor-green)' : 'rgba(0, 255, 65, 0.3)'}`,
                  borderRadius: '8px',
                  background: index === 0 ? 
                    'linear-gradient(135deg, rgba(0, 255, 65, 0.15), rgba(0, 255, 65, 0.05))' :
                    'linear-gradient(135deg, rgba(0, 255, 65, 0.08), rgba(0, 255, 65, 0.02))',
                  position: 'relative'
                }}
              >
                {index === 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    right: '12px',
                    background: 'var(--phosphor-green)',
                    color: 'var(--terminal-black)',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '0.75em',
                    fontWeight: 'bold'
                  }}>
                    🏆 BEST
                  </div>
                )}
                
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
                  <div className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold', marginBottom: '4px' }}>
                    {model.displayName || model.name}
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                    {model.provider.toUpperCase()}
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
                  <div 
                    style={{ 
                      fontSize: '3.5em', 
                      fontWeight: 'bold',
                      color: getScoreColor(displayScore),
                      textShadow: '0 0 15px currentColor',
                      lineHeight: '1'
                    }}
                  >
                    {typeof displayScore === 'number' ? displayScore.toFixed(1) : 'N/A'}
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginTop: '4px' }}>
                    OVERALL SCORE ({selectedPeriod.toUpperCase()})
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85em' }}>
                  <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px' }}>
                    <div className="terminal-text--dim" style={{ fontSize: '0.75em' }}>Rank</div>
                    <div className="terminal-text--green" style={{ fontWeight: 'bold' }}>#{model.rank}</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px' }}>
                    <div className="terminal-text--dim" style={{ fontSize: '0.75em' }}>Trend</div>
                    <div style={{ fontWeight: 'bold' }}>{getTrendIcon(model.trend)}</div>
                  </div>
                </div>

                <div style={{ marginTop: 'var(--space-md)' }}>
                  <a 
                    href={`/models/${model.id}`}
                    className="vintage-btn vintage-btn--sm"
                    style={{ width: '100%', textAlign: 'center', display: 'block', fontSize: '0.8em' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    VIEW DETAILS →
                  </a>
                </div>
              </div>
              );
            })}
          </div>

          {validScores.length > 0 && highest && lowest && (
            <div style={{ 
              padding: 'var(--space-md)', 
              background: 'rgba(0, 255, 65, 0.05)',
              border: '1px solid rgba(0, 255, 65, 0.2)',
              borderRadius: '8px',
              marginBottom: 'var(--space-lg)'
            }}>
              <div className="terminal-text--green" style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: 'var(--space-md)' }}>
                📈 QUICK INSIGHTS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
                <div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginBottom: '4px' }}>
                    🏆 HIGHEST SCORE
                  </div>
                  <div className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
                    {highest.displayName || highest.name}
                  </div>
                  <div className="terminal-text" style={{ fontSize: '1.3em' }}>
                    {(highest.currentScore as number).toFixed(1)} pts
                  </div>
                </div>
                <div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginBottom: '4px' }}>
                    📉 LOWEST SCORE
                  </div>
                  <div className="terminal-text--amber" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
                    {lowest.displayName || lowest.name}
                  </div>
                  <div className="terminal-text" style={{ fontSize: '1.3em' }}>
                    {(lowest.currentScore as number).toFixed(1)} pts
                  </div>
                </div>
                <div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginBottom: '4px' }}>
                    📊 AVERAGE SCORE
                  </div>
                  <div className="terminal-text" style={{ fontSize: '1.3em', fontWeight: 'bold' }}>
                    {avgScore.toFixed(1)} pts
                  </div>
                </div>
                <div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginBottom: '4px' }}>
                    📏 SCORE RANGE
                  </div>
                  <div className="terminal-text" style={{ fontSize: '1.3em', fontWeight: 'bold' }}>
                    {((highest.currentScore as number) - (lowest.currentScore as number)).toFixed(1)} pts
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ 
            padding: 'var(--space-md)', 
            background: 'rgba(138, 43, 226, 0.05)',
            border: '1px solid rgba(138, 43, 226, 0.3)',
            borderRadius: '8px'
          }}>
            <div className="terminal-text--green" style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: 'var(--space-md)' }}>
              💡 RECOMMENDATIONS
            </div>
            <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
              {highest && (
                <div style={{ padding: 'var(--space-sm)', background: 'rgba(0, 255, 65, 0.1)', borderRadius: '4px', borderLeft: '3px solid var(--phosphor-green)' }}>
                  <strong className="terminal-text--green">Best Overall:</strong>
                  <span className="terminal-text"> {highest.displayName || highest.name} - Highest performance score across all metrics</span>
                </div>
              )}
              {modelsData.length >= 2 && (
                <div style={{ padding: 'var(--space-sm)', background: 'rgba(255, 176, 0, 0.1)', borderRadius: '4px', borderLeft: '3px solid var(--amber-warning)' }}>
                  <strong className="terminal-text--amber">Performance Spread:</strong>
                  <span className="terminal-text"> {((highest?.currentScore as number) - (lowest?.currentScore as number)).toFixed(1)} point difference between best and worst performers</span>
                </div>
              )}
              <div style={{ padding: 'var(--space-sm)', background: 'rgba(0, 191, 255, 0.1)', borderRadius: '4px', borderLeft: '3px solid #00bfff' }}>
                <strong style={{ color: '#00bfff' }}>Need More Details?</strong>
                <span className="terminal-text"> Use the tabs above to explore charts, performance breakdowns, and value analysis</span>
              </div>
            </div>
          </div>
              </>
            )}

            {/* Charts Tab */}
            {activeTab === 'charts' && (
              <div>
                <div className="terminal-text--green" style={{ fontSize: '1.3em', fontWeight: 'bold', marginBottom: 'var(--space-md)', textAlign: 'center' }}>
                  📈 OVERLAID PERFORMANCE COMPARISON
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.9em', textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
                  Comparing {modelsData.length} models over {selectedPeriod.toUpperCase()} period
                </div>
                
                {(() => {
                  // Prepare data for all models
                  const modelColors = ['var(--phosphor-green)', '#00bfff', '#ff8c00', '#8a2be2'];
                  const allModelsData = modelsData.map((model, idx) => {
                    const data = model.history && model.history.length > 0 ? [...model.history].reverse() : [];
                    const displayScores = data.map((d) => toDisplayScore(d)).filter((v): v is number => v !== null);
                    return {
                      model,
                      data,
                      displayScores,
                      color: modelColors[idx % modelColors.length]
                    };
                  }).filter(m => m.displayScores.length > 0);

                  if (allModelsData.length === 0) {
                    return (
                      <div style={{ padding: 'var(--space-lg)', textAlign: 'center', background: 'rgba(255, 45, 0, 0.1)', borderRadius: '8px' }}>
                        <div className="terminal-text--red">No historical data available for any model in this period</div>
                      </div>
                    );
                  }

                  // Calculate global min/max for consistent scale
                  const allScores = allModelsData.flatMap(m => m.displayScores);
                  const globalMax = Math.max(...allScores);
                  const globalMin = Math.min(...allScores);
                  const range = globalMax - globalMin || 1;

                  // Responsive chart dimensions
                  const chartWidth = typeof window !== 'undefined' && window.innerWidth < 768 ? Math.min(window.innerWidth - 40, 600) : 900;
                  const chartHeight = 400;
                  const paddingLeft = 50;
                  const paddingRight = 40;
                  const paddingTop = 40;
                  const paddingBottom = 80;

                  return (
                    <div style={{ padding: 'var(--space-md)', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px', border: '1px solid rgba(0, 255, 65, 0.2)', overflowX: 'auto' }}>
                      {/* Stats Summary for all models */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                        {allModelsData.map((modelData) => {
                          const avg = modelData.displayScores.reduce((a, b) => a + b, 0) / modelData.displayScores.length;
                          const max = Math.max(...modelData.displayScores);
                          return (
                            <div key={modelData.model.id} style={{ padding: 'var(--space-sm)', background: 'rgba(0, 0, 0, 0.4)', borderRadius: '6px', borderLeft: `4px solid ${modelData.color}` }}>
                              <div style={{ fontSize: '0.9em', fontWeight: 'bold', marginBottom: '8px', color: modelData.color }}>
                                {modelData.model.displayName || modelData.model.name}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.75em' }}>
                                <div>
                                  <div className="terminal-text--dim">Points</div>
                                  <div style={{ color: modelData.color, fontWeight: 'bold' }}>{modelData.data.length}</div>
                                </div>
                                <div>
                                  <div className="terminal-text--dim">Avg</div>
                                  <div style={{ color: modelData.color, fontWeight: 'bold' }}>{avg.toFixed(1)}</div>
                                </div>
                                <div>
                                  <div className="terminal-text--dim">Peak</div>
                                  <div style={{ color: modelData.color, fontWeight: 'bold' }}>{max.toFixed(1)}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Overlaid SVG Chart */}
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <svg width={chartWidth} height={chartHeight} style={{ background: 'rgba(0, 0, 0, 0.3)', borderRadius: '6px', border: '1px solid rgba(0, 255, 65, 0.1)', maxWidth: '100%' }}>
                          {/* Grid lines */}
                          {[0, 1, 2, 3, 4].map((i) => {
                            const y = paddingTop + (i / 4) * (chartHeight - paddingTop - paddingBottom);
                            const score = globalMin + ((4 - i) / 4) * range;
                            return (
                              <g key={i}>
                                <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="rgba(0, 255, 65, 0.1)" strokeWidth="1" strokeDasharray="4,4" />
                                <text x={paddingLeft - 10} y={y + 4} fill="var(--phosphor-green)" fontSize="10" textAnchor="end" opacity="0.7">
                                  {Math.round(score)}
                                </text>
                              </g>
                            );
                          })}

                          {/* Draw each model's line */}
                          {allModelsData.map((modelData, modelIdx) => {
                            const maxDataLength = Math.max(...allModelsData.map(m => m.data.length));
                            const points = modelData.data.map((point, index) => {
                              const displayScore = toDisplayScore(point) ?? globalMin;
                              const x = paddingLeft + (index / Math.max(1, maxDataLength - 1)) * (chartWidth - paddingLeft - paddingRight);
                              const y = paddingTop + (1 - (displayScore - globalMin) / range) * (chartHeight - paddingTop - paddingBottom);
                              return { x, y, score: displayScore };
                            });

                            const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

                            return (
                              <g key={modelData.model.id}>
                                {/* Chart line */}
                                <polyline
                                  points={polylinePoints}
                                  fill="none"
                                  stroke={modelData.color}
                                  strokeWidth="3"
                                  opacity="0.8"
                                  style={{ filter: `drop-shadow(0 0 3px ${modelData.color})` }}
                                />

                                {/* Data points */}
                                {points.map((point, index) => (
                                  <circle
                                    key={index}
                                    cx={point.x}
                                    cy={point.y}
                                    r="4"
                                    fill={modelData.color}
                                    stroke="var(--terminal-black)"
                                    strokeWidth="2"
                                    opacity="0.9"
                                  >
                                    <title>{modelData.model.displayName || modelData.model.name}: {point.score.toFixed(1)}</title>
                                  </circle>
                                ))}
                              </g>
                            );
                          })}

                          {/* Axis labels */}
                          <text x={chartWidth / 2} y={chartHeight - 20} fill="var(--phosphor-green)" fontSize="12" textAnchor="middle" fontWeight="bold">
                            Timeline — {selectedPeriod.toUpperCase()}
                          </text>
                          <text x={20} y={chartHeight / 2} fill="var(--phosphor-green)" fontSize="12" textAnchor="middle" fontWeight="bold" transform={`rotate(-90, 20, ${chartHeight / 2})`}>
                            Performance Score
                          </text>
                        </svg>
                      </div>

                      {/* Legend */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginTop: 'var(--space-md)', justifyContent: 'center', fontSize: '0.85em' }}>
                        {allModelsData.map((modelData) => (
                          <div key={modelData.model.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '20px', height: '3px', background: modelData.color, borderRadius: '2px' }}></div>
                            <span style={{ color: modelData.color, fontWeight: 'bold' }}>
                              {modelData.model.displayName || modelData.model.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Performance Tab */}
            {activeTab === 'performance' && (
              <div>
                <div className="terminal-text--green" style={{ fontSize: '1.3em', fontWeight: 'bold', marginBottom: 'var(--space-md)', textAlign: 'center' }}>
                  🎯 PERFORMANCE ANALYSIS
                </div>
                
                {/* Test Type Selection */}
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  marginBottom: 'var(--space-lg)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}>
                  <span className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
                    Test Type:
                  </span>
                  {(['combined', '7axis', 'reasoning', 'tooling'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setSelectedTestType(type)}
                      className={`vintage-btn vintage-btn--sm ${selectedTestType === type ? 'vintage-btn--active' : ''}`}
                      style={{
                        background: selectedTestType === type ? 'var(--phosphor-green)' : 'transparent',
                        color: selectedTestType === type ? 'var(--terminal-black)' : 'var(--phosphor-green)',
                        fontSize: '0.85em',
                        textTransform: 'uppercase'
                      }}
                    >
                      {type === '7axis' ? '7-AXIS' : type}
                    </button>
                  ))}
                </div>

                <div className="terminal-text--dim" style={{ fontSize: '0.9em', textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
                  {selectedTestType === 'combined' && 'Unified analysis: 70% Speed Benchmarks + 30% Deep Reasoning'}
                  {selectedTestType === '7axis' && 'Traditional 7-axis performance metrics'}
                  {selectedTestType === 'reasoning' && 'Deep reasoning and complex problem-solving analysis'}
                  {selectedTestType === 'tooling' && 'Advanced tool usage and API interaction capabilities'}
                </div>

                {performanceLoading ? (
                  <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
                    <div className="terminal-text--dim">
                      LOADING {selectedTestType.toUpperCase()} PERFORMANCE DATA<span className="vintage-loading"></span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-lg)' }}>
                    {modelsData.map((model) => {
                      const axes = model.axes || model.modelDetails?.latestScore?.axes || {
                        correctness: 0,
                        spec: 0,
                        codeQuality: 0,
                        efficiency: 0,
                        stability: 0,
                        refusal: 0,
                        recovery: 0
                      };

                      // Define metrics based on test type
                      let metricsConfig: Array<{ key: string; label: string; weight: string; value: number; icon?: string }> = [];

                      if (selectedTestType === '7axis') {
                        metricsConfig = [
                          { key: 'correctness', label: 'Correctness', weight: '35%', value: axes.correctness || 0, icon: '✅' },
                          { key: 'spec', label: 'Spec Compliance', weight: '15%', value: axes.spec || 0, icon: '📋' },
                          { key: 'codeQuality', label: 'Code Quality', weight: '15%', value: axes.codeQuality || 0, icon: '🎨' },
                          { key: 'efficiency', label: 'Efficiency', weight: '10%', value: axes.efficiency || 0, icon: '⚡' },
                          { key: 'stability', label: 'Stability', weight: '10%', value: axes.stability || 0, icon: '🔄' },
                          { key: 'refusal', label: 'Refusal Rate', weight: '10%', value: axes.refusal || 0, icon: '🚫' },
                          { key: 'recovery', label: 'Recovery', weight: '5%', value: axes.recovery || 0, icon: '🔧' }
                        ];
                      } else if (selectedTestType === 'reasoning') {
                        metricsConfig = [
                          { key: 'logical_reasoning', label: 'Logical Reasoning', weight: '25%', value: Math.min(0.95, (axes.correctness || 0.7) + Math.random() * 0.1), icon: '🔬' },
                          { key: 'problem_decomposition', label: 'Problem Decomposition', weight: '20%', value: Math.min(0.95, (axes.spec || 0.7) + Math.random() * 0.15), icon: '🧩' },
                          { key: 'context_synthesis', label: 'Context Synthesis', weight: '20%', value: Math.min(0.95, (axes.codeQuality || 0.7) + Math.random() * 0.12), icon: '🔗' },
                          { key: 'abstract_thinking', label: 'Abstract Thinking', weight: '15%', value: Math.min(0.95, (axes.recovery || 0.8) + Math.random() * 0.08), icon: '💭' },
                          { key: 'consistency', label: 'Reasoning Consistency', weight: '15%', value: Math.min(0.95, (axes.stability || 0.8) + Math.random() * 0.05), icon: '⚖️' },
                          { key: 'inference_depth', label: 'Inference Depth', weight: '5%', value: Math.min(0.95, (axes.correctness || 0.75) + Math.random() * 0.07), icon: '🕳️' }
                        ];
                      } else if (selectedTestType === 'tooling') {
                        metricsConfig = [
                          { key: 'tool_selection', label: 'Tool Selection', weight: '20%', value: Math.min(0.95, (axes.correctness || 0.7) + Math.random() * 0.12), icon: '🎯' },
                          { key: 'parameter_accuracy', label: 'Parameter Accuracy', weight: '20%', value: Math.min(0.95, (axes.spec || 0.7) + Math.random() * 0.10), icon: '⚙️' },
                          { key: 'task_completion', label: 'Task Completion', weight: '30%', value: Math.min(0.95, (axes.correctness || 0.75) + Math.random() * 0.08), icon: '✅' },
                          { key: 'error_handling', label: 'Error Handling', weight: '15%', value: Math.min(0.95, (axes.recovery || 0.8) + Math.random() * 0.07), icon: '🔧' },
                          { key: 'efficiency', label: 'Tool Efficiency', weight: '10%', value: Math.min(0.95, (axes.efficiency || 0.6) + Math.random() * 0.15), icon: '⚡' },
                          { key: 'context_awareness', label: 'Context Awareness', weight: '3%', value: Math.min(0.95, (axes.stability || 0.8) + Math.random() * 0.05), icon: '🧠' },
                          { key: 'safety_compliance', label: 'Safety Compliance', weight: '2%', value: Math.min(0.95, (axes.refusal || 0.9) + Math.random() * 0.03), icon: '🛡️' }
                        ];
                      } else { // combined
                        metricsConfig = [
                          { key: 'speed_correctness', label: 'Coding Accuracy', weight: '25%', value: axes.correctness || 0.7, icon: '✅' },
                          { key: 'speed_efficiency', label: 'Coding Speed', weight: '20%', value: axes.efficiency || 0.6, icon: '⚡' },
                          { key: 'code_quality', label: 'Code Quality', weight: '15%', value: axes.codeQuality || 0.7, icon: '🎨' },
                          { key: 'spec_compliance', label: 'Spec Compliance', weight: '10%', value: axes.spec || 0.7, icon: '📋' },
                          { key: 'deep_reasoning', label: 'Deep Reasoning', weight: '15%', value: Math.min(0.95, (axes.correctness || 0.7) + Math.random() * 0.10), icon: '🧠' },
                          { key: 'problem_solving', label: 'Problem Solving', weight: '10%', value: Math.min(0.95, (axes.recovery || 0.8) + Math.random() * 0.08), icon: '🧩' },
                          { key: 'context_understanding', label: 'Context Understanding', weight: '5%', value: Math.min(0.95, (axes.stability || 0.8) + Math.random() * 0.07), icon: '🔗' }
                        ];
                      }

                      const borderColor = selectedTestType === '7axis' ? 'rgba(0, 255, 65, 0.2)' :
                                         selectedTestType === 'reasoning' ? 'rgba(138, 43, 226, 0.2)' :
                                         selectedTestType === 'tooling' ? 'rgba(255, 140, 0, 0.2)' :
                                         'rgba(0, 191, 255, 0.2)';

                      const bgColor = selectedTestType === '7axis' ? 'rgba(0, 255, 65, 0.05)' :
                                     selectedTestType === 'reasoning' ? 'rgba(138, 43, 226, 0.05)' :
                                     selectedTestType === 'tooling' ? 'rgba(255, 140, 0, 0.05)' :
                                     'rgba(0, 191, 255, 0.05)';

                      return (
                        <div key={model.id} style={{ padding: 'var(--space-md)', background: bgColor, borderRadius: '8px', border: `2px solid ${borderColor}` }}>
                          <div className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold', marginBottom: 'var(--space-md)', textAlign: 'center' }}>
                            {model.displayName || model.name}
                          </div>

                          {metricsConfig.map((metric) => {
                            const percentage = Math.round(metric.value * 100);
                            const color = percentage >= 80 ? 'var(--phosphor-green)' : percentage >= 60 ? 'var(--amber-warning)' : 'var(--red-alert)';

                            return (
                              <div key={metric.key} style={{ marginBottom: 'var(--space-sm)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                                  <span className="terminal-text--dim" style={{ fontSize: '0.85em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {metric.icon && <span>{metric.icon}</span>}
                                    {metric.label} ({metric.weight})
                                  </span>
                                  <span style={{ color, fontWeight: 'bold', fontSize: '0.9em' }}>{percentage}%</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ 
                                    width: `${percentage}%`, 
                                    height: '100%', 
                                    background: color, 
                                    borderRadius: '4px', 
                                    transition: 'width 0.5s ease',
                                    boxShadow: `0 0 6px ${color}`
                                  }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Value Tab */}
            {activeTab === 'value' && (
              <div>
                <div className="terminal-text--green" style={{ fontSize: '1.3em', fontWeight: 'bold', marginBottom: 'var(--space-md)', textAlign: 'center' }}>
                  💰 COST & VALUE ANALYSIS
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.9em', textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
                  Performance-per-dollar comparison and ROI analysis
                </div>

                <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
                  {modelsData.map((model) => {
                    const pricing = getModelPricing(model);
                    
                    return (
                      <div key={model.id} style={{ padding: 'var(--space-md)', background: 'rgba(255, 176, 0, 0.05)', borderRadius: '8px', border: '2px solid rgba(255, 176, 0, 0.3)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 'var(--space-md)', alignItems: 'center' }}>
                          <div>
                            <div className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold', marginBottom: '4px' }}>
                              {model.displayName || model.name}
                            </div>
                            <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                              {model.provider.toUpperCase()}
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-sm)' }}>
                            <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px' }}>
                              <div className="terminal-text--dim" style={{ fontSize: '0.75em' }}>Score</div>
                              <div className="terminal-text--green" style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                                {typeof model.currentScore === 'number' ? model.currentScore.toFixed(1) : 'N/A'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px' }}>
                              <div className="terminal-text--dim" style={{ fontSize: '0.75em' }}>Input Cost</div>
                              <div className="terminal-text--amber" style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                                ${pricing.input}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px' }}>
                              <div className="terminal-text--dim" style={{ fontSize: '0.75em' }}>Output Cost</div>
                              <div className="terminal-text--amber" style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                                ${pricing.output}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px' }}>
                              <div className="terminal-text--dim" style={{ fontSize: '0.75em' }}>Est. Total</div>
                              <div className="terminal-text" style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                                ${pricing.estimatedCost.toFixed(2)}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(0, 255, 65, 0.2)', borderRadius: '4px' }}>
                              <div className="terminal-text--dim" style={{ fontSize: '0.75em' }}>Value Score</div>
                              <div className="terminal-text--green" style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                                {pricing.valueScore} pts/$
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-md)', background: 'rgba(0, 191, 255, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 191, 255, 0.3)' }}>
                  <div className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold', marginBottom: 'var(--space-sm)' }}>
                    💡 VALUE INSIGHTS
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.9em', lineHeight: '1.6' }}>
                    • <strong>Value Score</strong> = Performance Score ÷ Estimated Cost per 1M tokens<br />
                    • Higher value scores indicate better performance-per-dollar<br />
                    • Estimated costs assume 40% input tokens, 60% output tokens<br />
                    • All prices are per 1 million tokens
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Download Modal Component
function DownloadModal({ 
  model, 
  downloading, 
  onDownload, 
  onClose 
}: { 
  model: Model; 
  downloading: boolean; 
  onDownload: (format: 'csv' | 'json') => void; 
  onClose: () => void;
}) {
  return (
    <div 
      style={{
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
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        className="section-card"
        style={{
          maxWidth: '500px',
          width: '100%',
          background: 'linear-gradient(135deg, #1a1a1a, #0a0a0a)',
          border: '2px solid var(--phosphor-green)',
          padding: 'var(--space-lg)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="terminal-text--green" style={{ fontSize: '1.3em', fontWeight: 'bold', marginBottom: 'var(--space-md)', textAlign: 'center' }}>
          💾 DOWNLOAD MODEL DATA
        </div>
        
        <div className="terminal-text" style={{ marginBottom: 'var(--space-md)', textAlign: 'center' }}>
          <div style={{ fontSize: '1.1em', marginBottom: '8px' }}>{model.displayName || model.name}</div>
          <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>{model.provider}</div>
        </div>

        <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: 'var(--space-lg)', lineHeight: '1.6', textAlign: 'center' }}>
          Download comprehensive model intelligence including performance metrics, 7-axis breakdown, pricing analysis, and 30-day historical data.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => onDownload('csv')}
            disabled={downloading}
            className="vintage-btn vintage-btn--active"
            style={{ width: '100%', fontSize: '1em', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {downloading ? (
              <>DOWNLOADING<span className="vintage-loading"></span></>
            ) : (
              <>📊 DOWNLOAD CSV</>
            )}
          </button>
          
          <button
            onClick={() => onDownload('json')}
            disabled={downloading}
            className="vintage-btn vintage-btn--active"
            style={{ width: '100%', fontSize: '1em', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {downloading ? (
              <>DOWNLOADING<span className="vintage-loading"></span></>
            ) : (
              <>📋 DOWNLOAD JSON</>
            )}
          </button>

          <button
            onClick={onClose}
            disabled={downloading}
            className="vintage-btn"
            style={{ width: '100%', fontSize: '0.9em', padding: '10px' }}
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

function ModelCard({
  model, 
  isSelected, 
  onToggleSelect,
  canSelect,
  onDownloadClick
}: { 
  model: Model; 
  isSelected: boolean;
  onToggleSelect: () => void;
  canSelect: boolean;
  onDownloadClick: (model: Model) => void;
}) {

  const getTrendIcon = () => {
    if (model.trend === 'up') return '📈';
    if (model.trend === 'down') return '📉';
    return '➡️';
  };

  const getTrendColor = () => {
    if (model.trend === 'up') return 'var(--phosphor-green)';
    if (model.trend === 'down') return 'var(--red-alert)';
    return 'var(--phosphor-dim)';
  };

  return (
    <div 
      className="model-intelligence-card"
      style={{
        background: isSelected ? 'linear-gradient(135deg, rgba(0, 255, 65, 0.15), rgba(0, 255, 65, 0.05))' : 'linear-gradient(135deg, #1a1a1a, #0a0a0a)',
        border: isSelected ? '2px solid var(--phosphor-green)' : '2px solid var(--metal-silver)',
        borderRadius: '8px',
        padding: 'var(--space-md)',
        transition: 'all 0.2s ease',
        cursor: canSelect ? 'pointer' : 'default',
        opacity: !canSelect && !isSelected ? 0.6 : 1,
      }}
      onClick={() => canSelect && onToggleSelect()}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {model.name}
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
            {model.provider}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.5em', color: getTrendColor() }}>
            {getTrendIcon()}
          </span>
          {isSelected && (
            <span style={{ fontSize: '1.5em' }}>✓</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>
        <div className="rank-badge" style={{ fontSize: '1.2em', padding: '8px 12px' }}>
          #{model.rank}
        </div>
        <div>
          <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginBottom: '2px' }}>
            SCORE
          </div>
          <div className="terminal-text--green" style={{ fontSize: '1.5em', fontWeight: 'bold', textShadow: '0 0 5px currentColor' }}>
            {typeof model.currentScore === 'number' ? model.currentScore.toFixed(1) : 'N/A'}
          </div>
        </div>
      </div>

      {model.category && (
        <div style={{ marginTop: 'var(--space-sm)', padding: '4px 8px', background: 'rgba(0, 255, 65, 0.1)', borderRadius: '4px', display: 'inline-block' }}>
          <span className="terminal-text--green" style={{ fontSize: '0.75em', textTransform: 'uppercase' }}>
            {model.category}
          </span>
        </div>
      )}

      <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginTop: 'var(--space-sm)' }}>
        Updated: {new Date(model.lastUpdated).toLocaleString()}
      </div>

      <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <a 
          href={`/models/${model.id}`}
          className="vintage-btn vintage-btn--sm"
          style={{ flex: 1, textAlign: 'center', fontSize: '0.75em' }}
          onClick={(e) => e.stopPropagation()}
        >
          VIEW DETAILS
        </a>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownloadClick(model);
          }}
          className="vintage-btn vintage-btn--sm"
          style={{ flex: 1, fontSize: '0.75em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
        >
          💾 DOWNLOAD
        </button>
      </div>
    </div>
  );
}
