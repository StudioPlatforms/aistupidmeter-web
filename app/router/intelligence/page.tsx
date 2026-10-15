'use client';

import {
  useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import IntelligencePreview, { IntelCard, TrendTag, INTEL_LEAD, providerName } from '@/components/IntelligencePreview';
import { PageHead, Pane, Stats, Stat, CountUp, Modal, Loader, Empty, Note, Tag, ProviderMark } from '@/components/studio';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTip,
  ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { getModelPricing as sharedModelPricing } from '../../../lib/model-pricing';
import '@/styles/studio-intel.css';

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

type SortBy = 'rank' | 'score' | 'name';
type Period = '24h' | '7d' | '1m';
type TestType = 'combined' | '7axis' | 'reasoning' | 'tooling';
type Tab = 'overview' | 'charts' | 'radar' | 'performance' | 'value';

const SORTS: Array<{ id: SortBy; label: string }> = [
  { id: 'rank', label: 'Rank' },
  { id: 'score', label: 'Score' },
  { id: 'name', label: 'Name' },
];
const PERIODS: Array<{ id: Period; label: string }> = [
  { id: '24h', label: '24 hours' },
  { id: '7d', label: '7 days' },
  { id: '1m', label: '30 days' },
];
const PERIOD_TEXT: Record<Period, string> = { '24h': 'last 24 hours', '7d': 'last 7 days', '1m': 'last 30 days' };
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'charts', label: 'Charts' },
  { id: 'radar', label: 'Web chart' },
  { id: 'performance', label: 'Performance' },
  { id: 'value', label: 'Value' },
];
const TEST_TYPES: Array<{ id: TestType; label: string }> = [
  { id: 'combined', label: 'Combined' },
  { id: '7axis', label: '7-axis' },
  { id: 'reasoning', label: 'Reasoning' },
  { id: 'tooling', label: 'Tooling' },
];
const AXIS_LABELS: Record<string, string> = {
  correctness: 'Correctness',
  spec: 'Spec compliance',
  codeQuality: 'Code quality',
  efficiency: 'Efficiency',
  stability: 'Stability',
  refusal: 'Refusal rate',
  recovery: 'Recovery',
};

/** Chart series (styles/studio-intel.css), by a model's place in the comparison, so it keeps its colour on every tab. */
const SERIES = ['var(--si-s1)', 'var(--si-s2)', 'var(--si-s3)', 'var(--si-s4)'];

type Tone = 'good' | 'warn' | 'bad';
/** The page's thresholds for a 0–100 value: 80 and up good, 60 and up warn, below that bad. */
const toneOf = (v: number): Tone => (v >= 80 ? 'good' : v >= 60 ? 'warn' : 'bad');
const fmt1 = (n: number) => n.toFixed(1);

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function useMedia(query: string): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setOn(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);
  return on;
}

/**
 * The landing RankList's motion on a grid: when the order changes (sort, provider filter, or a
 * refresh that re-ranks), cards slide from where they were to where they are now; new ones fade in.
 * Call the returned function just before the state change; the slide plays once React has
 * committed the new order. Positions are measured against the grid, so scrolling in between is fine.
 */
function useReorderSlide(grid: RefObject<HTMLElement>) {
  const before = useRef<Map<string, { x: number; y: number }> | null>(null);

  const capture = useCallback(() => {
    const el = grid.current;
    if (!el) return;
    const at = new Map<string, { x: number; y: number }>();
    el.querySelectorAll<HTMLElement>('[data-flip]').forEach(c => at.set(c.dataset.flip!, { x: c.offsetLeft, y: c.offsetTop }));
    before.current = at;
  }, [grid]);

  useIsoLayoutEffect(() => {
    const prev = before.current;
    before.current = null;
    const el = grid.current;
    if (!prev || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.querySelectorAll<HTMLElement>('[data-flip]').forEach(c => {
      const p = prev.get(c.dataset.flip!);
      if (!p) {
        c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: 'ease-out' });
        return;
      }
      const dx = p.x - c.offsetLeft;
      const dy = p.y - c.offsetTop;
      if (dx || dy) c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.2, .7, .2, 1)' });
    });
  });

  return capture;
}

export default function ModelIntelligencePage() {
  const { data: session, status } = useSession();
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('rank');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [downloadingModel, setDownloadingModel] = useState<Model | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const slide = useReorderSlide(gridRef);

  // Only for an account that sees the page: the newest run is a paid view, and the API refuses
  // it to anyone else (apps/api middleware/latest-gate.ts). Everyone else gets the preview.
  useEffect(() => {
    if (!hasAccess) return;
    fetchModelData();
    if (autoRefresh) {
      const interval = setInterval(fetchModelData, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, hasAccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchModelData = async () => {
    try {
      setLoading(true);
      setError(null);
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/dashboard/scores?period=latest&sortBy=combined`);
      if (!response.ok) throw new Error('Failed to fetch model data');
      const data = await response.json();
      if (data.success && data.data) {
        slide(); // a refresh that re-ranks slides the cards rather than jumping them
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

  const changeSort = (next: SortBy) => {
    if (next === sortBy) return;
    slide();
    setSortBy(next);
  };
  const changeProvider = (next: string) => {
    if (next === filterProvider) return;
    slide();
    setFilterProvider(next);
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

  // The comparison's models change only when the data or the selection does, so the dialog
  // refetches on those rather than on every re-render of this page.
  const compared = useMemo(() => models.filter(m => selectedModels.includes(m.id)), [models, selectedModels]);

  if (checking) {
    return (
      <RouterLayout>
        <PageHead kicker="Monitoring" title="Model intelligence" lead={INTEL_LEAD} />
        <div className="st-body">
          <Loader label="Checking access" minHeight={300} />
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

  const firstLoad = loading && models.length === 0;
  const skel = <span className="st-skel si-skel" aria-hidden="true" />;
  const picked = selectedModels.length;

  return (
    <RouterLayout>
      <PageHead
        kicker="Monitoring"
        title="Model intelligence"
        lead={INTEL_LEAD}
        actions={
          <>
            <label className="si-switch" title="Reloads the scores every 30 seconds">
              <input type="checkbox" role="switch" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              <span className="si-switch-ui" aria-hidden="true" />
              Auto-refresh
            </label>
            <button type="button" onClick={fetchModelData} className="st-btn">Refresh</button>
          </>
        }
      />

      <div className="st-body">
        {error && (
          <Note tone="bad" title="Could not load model data">
            <div className="si-note-row">
              <span>{error}</span>
              <button type="button" onClick={fetchModelData} className="st-btn is-sm is-danger">Retry</button>
            </div>
          </Note>
        )}

        <Stats columns={4}>
          <Stat value={firstLoad ? skel : <CountUp value={models.filter(m => m.currentScore !== 'unavailable').length} />} label="Active models" />
          <Stat value={firstLoad ? skel : <CountUp value={providers.length - 1} />} label="Providers" />
          <Stat value="175K+" label="Scores recorded" tone="accent" />
          <Stat value="4h" label="Update cycle" />
        </Stats>

        <Pane
          title="Live model rankings"
          sub={`${filteredModels.length} model${filteredModels.length === 1 ? '' : 's'} · select up to 4 to compare`}
        >
          <div className="si-tools">
            <div className="si-chips" role="group" aria-label="Provider">
              {providers.map(prov => (
                <button
                  key={prov}
                  type="button"
                  className={`st-chip${prov === 'all' ? ' is-all' : ''}`}
                  aria-pressed={filterProvider === prov}
                  onClick={() => changeProvider(prov)}
                >
                  {prov !== 'all' && <ProviderMark provider={prov} size="sm" />}
                  {prov === 'all' ? 'All providers' : providerName(prov)}
                </button>
              ))}
            </div>
            <div className="si-ctl">
              <span className="si-ctl-l" id="si-sort-l">Sort by</span>
              <div className="st-seg" role="group" aria-labelledby="si-sort-l">
                {SORTS.map(s => (
                  <button key={s.id} type="button" aria-pressed={sortBy === s.id} onClick={() => changeSort(s.id)}>{s.label}</button>
                ))}
              </div>
            </div>
          </div>

          {firstLoad ? (
            <Loader label="Loading model data" />
          ) : filteredModels.length === 0 ? (
            <Empty title={models.length === 0 ? 'No model data loaded' : 'No models match these filters'} />
          ) : (
            <div className="si-grid" ref={gridRef}>
              {filteredModels.map((model) => {
                const on = selectedModels.includes(model.id);
                return (
                  <IntelCard
                    key={model.id}
                    flipKey={model.id}
                    name={model.displayName || model.name}
                    provider={model.provider}
                    score={typeof model.currentScore === 'number' ? model.currentScore : null}
                    rank={model.rank}
                    trend={model.trend}
                    category={model.category}
                    href={`/models/${model.id}`}
                    selected={on}
                    capped={!on && selectedModels.length >= 4}
                    onToggle={() => toggleModelSelection(model.id)}
                    onDownload={() => setDownloadingModel(model)}
                  />
                );
              })}
            </div>
          )}
        </Pane>

        {picked > 0 && (
          <div className="si-tray" role="region" aria-label="Comparison">
            <p className="si-tray-n" aria-live="polite">
              <b>{picked} model{picked > 1 ? 's' : ''}</b> selected for comparison{picked < 2 ? ' · select one more to compare' : ''}
            </p>
            <ul className="si-tray-list">
              {compared.map(m => (
                <li key={m.id}>
                  <ProviderMark provider={m.provider} size="sm" />
                  <span>{m.displayName || m.name}</span>
                  <button type="button" aria-label={`Remove ${m.displayName || m.name}`} onClick={() => toggleModelSelection(m.id)}>×</button>
                </li>
              ))}
            </ul>
            <div className="si-tray-act">
              <button type="button" onClick={() => setSelectedModels([])} className="st-btn is-quiet">Clear selection</button>
              <button type="button" onClick={() => setShowCompareModal(true)} className="st-btn is-primary" disabled={picked < 2}>
                Compare models <span className="st-ar" aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        )}

        <p className="si-foot">Data sourced from AI Stupid Level · Real-time benchmarks · <a href="/">View main site</a></p>
      </div>

      {/* Comparison Modal */}
      {showCompareModal && (
        <ComparisonModal
          models={compared}
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

/* ── comparison dialog ─────────────────────────────────────────────── */

/**
 * The comparison dialog, in the studio modal's classes (a bottom sheet on phones). Built here
 * rather than with <Modal> so the tabs and the period sit in a fixed bar between the head and
 * the scrolling body. It mirrors <Modal>'s behaviour: rendered into the shell root, Escape and
 * the backdrop close it, focus moves in and back, and the page behind stops scrolling.
 */
function ComparisonModal({ models, onClose }: { models: Model[]; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('7d');
  const [selectedTestType, setSelectedTestType] = useState<TestType>('combined');
  const [modelsData, setModelsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState<Element | null>(null);
  const narrow = useMedia('(max-width: 760px)');
  const still = useMedia('(prefers-reduced-motion: reduce)');
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Only the latest request may write: a quick period change must not be overwritten by a slower, older answer.
  const request = useRef(0);

  useEffect(() => { setHost(document.querySelector('.st') ?? document.body); }, []);

  useEffect(() => {
    if (!host) return;
    const before = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => box.current?.focus());
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [host]);

  useEffect(() => {
    fetchDetailedData();
  }, [models, selectedPeriod, selectedTestType]);

  const fetchDetailedData = async () => {
    const req = ++request.current;
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
      if (req === request.current) setModelsData(detailedData);
    } catch {
      /* silent */
    } finally {
      if (req === request.current) setLoading(false);
    }
  };

  const validScores = modelsData.filter(m => typeof m.currentScore === 'number');
  const highest = validScores.length > 0 ? validScores.reduce((max, m) => (m.currentScore as number) > (max.currentScore as number) ? m : max) : null;
  const lowest = validScores.length > 0 ? validScores.reduce((min, m) => (m.currentScore as number) < (min.currentScore as number) ? m : min) : null;
  const avgScore = validScores.length > 0 ? validScores.reduce((sum, m) => sum + (m.currentScore as number), 0) / validScores.length : 0;

  // Rates come from the shared table in lib/model-pricing.ts; the blended cost
  // and value score are derived here, same formula as the leaderboard.
  const getModelPricing = (model: any) => {
    const p = sharedModelPricing(model.name, model.provider);
    const estimatedCost = (p.input * 0.4) + (p.output * 0.6);
    const valueScore = model.currentScore > 0 ? (model.currentScore / estimatedCost).toFixed(1) : '0.0';
    return { ...p, estimatedCost, valueScore };
  };

  const colorOf = (id: string) => SERIES[Math.max(0, models.findIndex(m => m.id === id)) % SERIES.length];

  // Arrow keys move between tabs (roving tab stop), as a tab list should.
  const onTabsKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex(t => t.id === activeTab);
    const to = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    const next = TABS[(to + TABS.length) % TABS.length].id;
    setActiveTab(next);
    document.getElementById(`si-tab-${next}`)?.focus();
  };

  if (!host) return null;
  const firstLoad = loading && modelsData.length === 0;

  return createPortal(
    <div className="st-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} className="st-modal is-wide si-cmp" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="st-modal-head">
          <div>
            <h2 className="st-modal-title" id={titleId}>Model comparison</h2>
            <p className="st-modal-sub">{models.length} models selected · {PERIOD_TEXT[selectedPeriod]}</p>
          </div>
          <button type="button" className="st-x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="si-cmp-bar">
          <div className="st-tabs" role="tablist" aria-label="Comparison views" onKeyDown={onTabsKey}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`si-tab-${tab.id}`}
                aria-controls="si-cmp-panel"
                aria-selected={activeTab === tab.id}
                tabIndex={activeTab === tab.id ? 0 : -1}
                className="st-tab"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="st-seg si-period" role="group" aria-label="Time period">
            {PERIODS.map(p => (
              <button key={p.id} type="button" aria-pressed={selectedPeriod === p.id} onClick={() => setSelectedPeriod(p.id)}>{p.label}</button>
            ))}
          </div>
        </div>

        <div className="st-modal-body" id="si-cmp-panel" role="tabpanel" aria-labelledby={`si-tab-${activeTab}`} aria-busy={loading}>
          {firstLoad ? (
            <Loader label="Loading analytics" />
          ) : (
            <div className={`si-cmp-in${loading ? ' is-busy' : ''}`}>
              {activeTab === 'overview' && (
                <OverviewTab
                  modelsData={modelsData}
                  period={selectedPeriod}
                  colorOf={colorOf}
                  highest={validScores.length > 0 ? highest : null}
                  lowest={lowest}
                  avgScore={avgScore}
                />
              )}
              {activeTab === 'charts' && <ChartsTab modelsData={modelsData} period={selectedPeriod} colorOf={colorOf} narrow={narrow} still={still} />}
              {activeTab === 'radar' && <RadarTab modelsData={modelsData} colorOf={colorOf} narrow={narrow} still={still} />}
              {activeTab === 'performance' && (
                <PerformanceTab modelsData={modelsData} testType={selectedTestType} onTestType={setSelectedTestType} colorOf={colorOf} />
              )}
              {activeTab === 'value' && <ValueTab modelsData={modelsData} pricingOf={getModelPricing} />}
            </div>
          )}
        </div>
      </div>
    </div>,
    host,
  );
}

function OverviewTab({ modelsData, period, colorOf, highest, lowest, avgScore }: {
  modelsData: any[]; period: Period; colorOf: (id: string) => string;
  highest: any | null; lowest: any | null; avgScore: number;
}) {
  return (
    <>
      <div className="si-wins">
        {modelsData.map((model, index) => {
          const displayScore = model.stats?.currentScore ?? model.currentScore;
          // The selection is in leaderboard order, so the first card is the best-ranked model compared.
          const top = index === 0;
          return (
            <article key={model.id} className={`si-win${top ? ' is-top' : ''}`}>
              {top && <span className="si-win-badge"><Tag tone="solid">Top ranked</Tag></span>}
              <div className="si-win-id">
                <ProviderMark provider={model.provider} />
                <div>
                  <h3 className="si-win-name">{model.displayName || model.name}</h3>
                  <p className="si-win-prov"><i className="st-key" style={{ background: colorOf(model.id) }} />{providerName(model.provider)}</p>
                </div>
              </div>
              <div className={`si-win-score${typeof displayScore === 'number' ? ` is-${toneOf(displayScore)}` : ''}`}>
                {typeof displayScore === 'number' ? displayScore.toFixed(1) : 'N/A'}
              </div>
              <p className="si-win-l">Score, {PERIOD_TEXT[period]}</p>
              <dl className="si-win-kv">
                <div><dt>Rank</dt><dd>#{model.rank}</dd></div>
                <div><dt>Trend</dt><dd><TrendTag trend={model.trend} /></dd></div>
              </dl>
              <a href={`/models/${model.id}`} className="st-more" onClick={(e) => e.stopPropagation()}>View details</a>
            </article>
          );
        })}
      </div>

      {highest && lowest && (
        <section>
          <p className="st-label">Quick insights</p>
          <Stats columns={4} reveal={false}>
            <Stat value={<CountUp value={highest.currentScore as number} format={fmt1} />} unit="pts" label="Highest score" sub={highest.displayName || highest.name} />
            <Stat value={<CountUp value={lowest.currentScore as number} format={fmt1} />} unit="pts" label="Lowest score" sub={lowest.displayName || lowest.name} />
            <Stat value={<CountUp value={avgScore} format={fmt1} />} unit="pts" label="Average" sub={`${modelsData.length} models`} />
            <Stat value={<CountUp value={(highest.currentScore as number) - (lowest.currentScore as number)} format={fmt1} />} unit="pts" label="Spread" sub="Difference" />
          </Stats>
        </section>
      )}
    </>
  );
}

/** Tooltip for the timeline: one row per model at the hovered point, value first. */
function LineTip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="si-tip">
      <p className="si-tip-h">Point {label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="si-tip-row">
          <i className="st-key" style={{ background: p.color }} />
          <b>{typeof p.value === 'number' ? p.value.toFixed(1) : 'N/A'}</b>
          <span>{p.name}</span>
        </div>
      ))}
    </div>
  );
}

function ChartsTab({ modelsData, period, colorOf, narrow, still }: {
  modelsData: any[]; period: Period; colorOf: (id: string) => string; narrow: boolean; still: boolean;
}) {
  // Build unified timeline — align all models by index position
  const allModelsData = modelsData.map((model) => {
    const data = model.history && model.history.length > 0 ? [...model.history].reverse() : [];
    const displayScores = data.map((d: any) => toDisplayScore(d)).filter((v: number | null): v is number => v !== null);
    return { model, data, displayScores, color: colorOf(model.id) };
  }).filter(m => m.displayScores.length > 0);

  if (allModelsData.length === 0) {
    return (
      <Empty title="No historical data for this period">
        Try a different time period or select models that have been benchmarked recently.
      </Empty>
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

  return (
    <>
      {/* Per-model stats summary */}
      <div className="si-sum">
        {allModelsData.map((md) => {
          const avg = md.displayScores.reduce((a: number, b: number) => a + b, 0) / md.displayScores.length;
          const max = Math.max(...md.displayScores);
          return (
            <div key={md.model.id} className="si-sum-card">
              <p className="si-sum-name"><i className="st-key" style={{ background: md.color }} /><span>{md.model.displayName || md.model.name}</span></p>
              <dl className="si-figs">
                <div><dt>Average</dt><dd>{avg.toFixed(1)}</dd></div>
                <div><dt>Peak</dt><dd>{max.toFixed(1)}</dd></div>
                <div><dt>Points</dt><dd>{md.data.length}</dd></div>
              </dl>
            </div>
          );
        })}
      </div>

      {/* Overlaid timeline */}
      <figure className="si-plot">
        <figcaption className="st-sr">Score at each benchmark point, {PERIOD_TEXT[period]}, one line per model.</figcaption>
        <div className="si-chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: narrow ? 12 : 22, left: narrow ? -6 : 4, bottom: 22 }}>
              <CartesianGrid stroke="var(--lp-line)" vertical={false} />
              <XAxis
                dataKey="index"
                tick={{ fill: 'var(--lp-fg3)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--lp-line2)' }}
                tickLine={false}
                minTickGap={14}
                label={{ value: `Timeline, ${PERIOD_TEXT[period]}`, position: 'insideBottom', fill: 'var(--lp-fg3)', fontSize: 11, dy: 18 }}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: 'var(--lp-fg3)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={narrow ? 38 : 48}
                label={{ value: 'Score', angle: -90, position: 'insideLeft', fill: 'var(--lp-fg3)', fontSize: 11, dx: narrow ? 6 : 10 }}
              />
              <RechartsTip content={<LineTip />} cursor={{ stroke: 'var(--lp-line2)', strokeWidth: 1 }} />
              {allModelsData.map((md) => (
                <Line
                  key={md.model.id}
                  type="monotone"
                  dataKey={md.model.id}
                  name={md.model.displayName || md.model.name}
                  stroke={md.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  // An end dot on each line's latest point, ringed in the card colour.
                  dot={(p: any) => (p.index === md.data.length - 1 && p.value != null
                    ? <circle key={`${md.model.id}-end`} cx={p.cx} cy={p.cy} r={4} fill={md.color} stroke="var(--lp-card)" strokeWidth={2} />
                    : <g key={`${md.model.id}-${p.index}`} />)}
                  activeDot={{ r: 5, fill: md.color, stroke: 'var(--lp-card)', strokeWidth: 2 }}
                  connectNulls
                  isAnimationActive={!still}
                  animationDuration={900}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <ul className="si-legend">
          {allModelsData.map((md) => (
            <li key={md.model.id}><i className="st-key" style={{ background: md.color }} />{md.model.displayName || md.model.name}</li>
          ))}
        </ul>
      </figure>
    </>
  );
}

/** Axis label on the web chart; on phones a two-word label breaks onto two lines so it stays inside the sheet. */
function AxisTick({ x, y, cy, payload, textAnchor, narrow }: any) {
  const words = String(payload?.value ?? '').split(' ');
  const lines = narrow && words.length > 1 ? [words.slice(0, -1).join(' '), words[words.length - 1]] : [words.join(' ')];
  // Labels above the centre grow upwards, below it downwards, at the sides they are centred.
  const side = typeof cy === 'number' ? (y < cy - 4 ? -1 : y > cy + 4 ? 1 : 0) : 0;
  const first = side < 0 ? `${-(lines.length - 1) * 1.1}em` : side > 0 ? '0.8em' : `${0.35 - (lines.length - 1) * 0.55}em`;
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill="var(--lp-fg2)" fontSize={narrow ? 11 : 12}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? first : '1.1em'}>{line}</tspan>
      ))}
    </text>
  );
}

function RadarTip({ active, payload, colorOf, nameOf }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="si-tip">
      <p className="si-tip-h">{payload[0]?.payload?.axis}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="si-tip-row">
          <i className="st-key" style={{ background: colorOf(p.dataKey) }} />
          <b>{p.value}%</b>
          <span>{nameOf(p.dataKey)}</span>
        </div>
      ))}
    </div>
  );
}

function RadarTab({ modelsData, colorOf, narrow, still }: {
  modelsData: any[]; colorOf: (id: string) => string; narrow: boolean; still: boolean;
}) {
  const AXIS_KEYS = Object.keys(AXIS_LABELS);
  const modelsWithAxes = modelsData.filter(m => m.axes);

  if (modelsWithAxes.length === 0) {
    return (
      <Empty title="No axes data available">
        9-axis data is available after benchmarks run. Try the 7-day or 30-day period.
      </Empty>
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
  const nameOf = (id: string) => {
    const m = modelsWithAxes.find(x => x.id === id);
    return m?.displayName || m?.name;
  };

  return (
    <>
      <p className="st-text">
        7-axis performance web chart, comparing {modelsWithAxes.length} model{modelsWithAxes.length > 1 ? 's' : ''} across all scoring dimensions.
        The centre is 0 and the outer ring 100; the table below lists every value.
      </p>
      <figure className="si-plot">
        <figcaption className="st-sr">Each model&apos;s score on the seven axes, one outline per model.</figcaption>
        <div className="si-radar">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius={narrow ? '62%' : '76%'} margin={{ top: 18, right: narrow ? 10 : 40, bottom: 18, left: narrow ? 10 : 40 }}>
              <PolarGrid stroke="var(--lp-line)" />
              <PolarAngleAxis dataKey="axis" stroke="var(--lp-line2)" tickLine={false} tick={(props: any) => <AxisTick {...props} narrow={narrow} />} />
              {/* The scale is stated in the caption above: tick labels on a seven-spoke web collide with the axis names. */}
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} tickCount={4} axisLine={false} />
              <RechartsTip content={<RadarTip colorOf={colorOf} nameOf={nameOf} />} />
              {modelsWithAxes.map((model) => {
                const color = colorOf(model.id);
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
                    isAnimationActive={!still}
                    animationDuration={900}
                  />
                );
              })}
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <ul className="si-legend">
          {modelsWithAxes.map((model) => (
            <li key={model.id}><i className="st-key" style={{ background: colorOf(model.id) }} />{model.displayName || model.name}</li>
          ))}
        </ul>
      </figure>

      {/* Axis score table */}
      <div className="si-tablebox">
        <div className="st-table-wrap">
          <table className="st-table">
            <thead>
              <tr>
                <th>Axis</th>
                {modelsWithAxes.map((m) => (
                  <th key={m.id} className="is-num">
                    <span className="si-th"><i className="st-key" style={{ background: colorOf(m.id) }} />{m.displayName || m.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AXIS_KEYS.map(key => (
                <tr key={key}>
                  <td className="is-dim">{AXIS_LABELS[key]}</td>
                  {modelsWithAxes.map((m) => {
                    const pct = Math.round((m.axes[key] || 0) * 100);
                    return (
                      <td key={m.id} className="is-num"><span className={`si-pct is-${toneOf(pct)}`}>{pct}%</span></td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function PerformanceTab({ modelsData, testType, onTestType, colorOf }: {
  modelsData: any[]; testType: TestType; onTestType: (t: TestType) => void; colorOf: (id: string) => string;
}) {
  return (
    <>
      <div className="si-ctl">
        <span className="si-ctl-l" id="si-test-l">Test type</span>
        <div className="st-seg is-scroll" role="group" aria-labelledby="si-test-l">
          {TEST_TYPES.map(t => (
            <button key={t.id} type="button" aria-pressed={testType === t.id} onClick={() => onTestType(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>
      <div className="si-perf">
        {modelsData.map((model) => {
          const axes = model.axes || { correctness: 0, spec: 0, codeQuality: 0, efficiency: 0, stability: 0, refusal: 0, recovery: 0 };
          let metrics: Array<{ key: string; label: string; weight: string; value: number }> = [];
          if (testType === '7axis') {
            metrics = [
              { key: 'correctness', label: 'Correctness', weight: '35%', value: axes.correctness || 0 },
              { key: 'spec', label: 'Spec compliance', weight: '15%', value: axes.spec || 0 },
              { key: 'codeQuality', label: 'Code quality', weight: '15%', value: axes.codeQuality || 0 },
              { key: 'efficiency', label: 'Efficiency', weight: '10%', value: axes.efficiency || 0 },
              { key: 'stability', label: 'Stability', weight: '10%', value: axes.stability || 0 },
              { key: 'refusal', label: 'Refusal rate', weight: '10%', value: axes.refusal || 0 },
              { key: 'recovery', label: 'Recovery', weight: '5%', value: axes.recovery || 0 },
            ];
          } else {
            metrics = [
              { key: 'correctness', label: 'Coding accuracy', weight: '25%', value: axes.correctness || 0 },
              { key: 'efficiency', label: 'Speed', weight: '20%', value: axes.efficiency || 0 },
              { key: 'codeQuality', label: 'Code quality', weight: '15%', value: axes.codeQuality || 0 },
              { key: 'spec', label: 'Spec compliance', weight: '10%', value: axes.spec || 0 },
              { key: 'stability', label: 'Stability', weight: '15%', value: axes.stability || 0 },
              { key: 'recovery', label: 'Recovery', weight: '10%', value: axes.recovery || 0 },
              { key: 'refusal', label: 'Refusal rate', weight: '5%', value: axes.refusal || 0 },
            ];
          }
          return (
            <article key={model.id} className="si-perf-card">
              <h3 className="si-perf-name"><i className="st-key" style={{ background: colorOf(model.id) }} />{model.displayName || model.name}</h3>
              {metrics.map((metric) => {
                const pct = Math.round(metric.value * 100);
                const tone = toneOf(pct);
                return (
                  <div key={metric.key} className="si-metric">
                    <div className="si-metric-h">
                      <span>{metric.label} <small>({metric.weight})</small></span>
                      <span className={`si-pct is-${tone}`}>{pct}%</span>
                    </div>
                    <div className={`si-bar is-${tone}`}><i style={{ width: `${clamp(pct)}%` }} /></div>
                  </div>
                );
              })}
            </article>
          );
        })}
      </div>
    </>
  );
}

function ValueTab({ modelsData, pricingOf }: {
  modelsData: any[];
  pricingOf: (model: any) => { input: number; output: number; estimatedCost: number; valueScore: string };
}) {
  return (
    <>
      <h3 className="si-h">Cost and value analysis</h3>
      <div className="si-tablebox">
        <div className="st-table-wrap">
          <table className="st-table is-stack">
            <thead>
              <tr>
                <th>Model</th>
                <th className="is-num">Score</th>
                <th className="is-num">Input / 1M</th>
                <th className="is-num">Output / 1M</th>
                <th className="is-num">Est. cost</th>
                <th className="is-num">Value pts/$</th>
              </tr>
            </thead>
            <tbody>
              {modelsData.map((model) => {
                const pricing = pricingOf(model);
                return (
                  <tr key={model.id}>
                    <td className="is-head">
                      <div className="si-model-cell">
                        <ProviderMark provider={model.provider} size="sm" />
                        <div><b>{model.displayName || model.name}</b><small>{providerName(model.provider)}</small></div>
                      </div>
                    </td>
                    <td className="is-num" data-label="Score">{typeof model.currentScore === 'number' ? model.currentScore.toFixed(1) : 'N/A'}</td>
                    <td className="is-num" data-label="Input / 1M">${pricing.input}</td>
                    <td className="is-num" data-label="Output / 1M">${pricing.output}</td>
                    <td className="is-num" data-label="Est. cost">${pricing.estimatedCost.toFixed(2)}</td>
                    <td className="is-num" data-label="Value pts/$"><b>{pricing.valueScore}</b></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Note title="Value calculation">
        Value score = performance score / estimated cost per 1M tokens. Higher is better.
        Estimated costs assume 40% input tokens, 60% output tokens. All prices in USD per 1M tokens.
      </Note>
    </>
  );
}

/* ── download dialog ───────────────────────────────────────────────── */

function DownloadModal({ model, downloading, onDownload, onClose }: { model: Model; downloading: boolean; onDownload: (format: 'csv' | 'json') => void; onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      size="narrow"
      title="Download model data"
      footer={<button type="button" onClick={onClose} disabled={downloading} className="st-btn is-quiet">Cancel</button>}
    >
      <div className="si-dl-id">
        <ProviderMark provider={model.provider} size="lg" />
        <div>
          <b>{model.displayName || model.name}</b>
          <span>{providerName(model.provider)}</span>
        </div>
      </div>
      <p className="st-text">
        Download comprehensive model intelligence including performance metrics, 9-axis breakdown, pricing analysis, and 30-day historical data.
      </p>
      <div className="si-dl-opts">
        <button type="button" className="st-card" onClick={() => onDownload('csv')} disabled={downloading}>
          <span className="st-card-t">{downloading ? 'Downloading…' : 'Download CSV'}<span className="st-ar" aria-hidden="true">→</span></span>
          <span className="st-card-d">Current score, rank and trend, with the 7-axis breakdown.</span>
        </button>
        <button type="button" className="st-card" onClick={() => onDownload('json')} disabled={downloading}>
          <span className="st-card-t">{downloading ? 'Downloading…' : 'Download JSON'}<span className="st-ar" aria-hidden="true">→</span></span>
          <span className="st-card-d">The same, plus up to 30 points of score history.</span>
        </button>
      </div>
    </Modal>
  );
}
