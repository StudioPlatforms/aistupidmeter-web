'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import PreferencesPreview from '@/components/PreferencesPreview';
import { apiClient } from '@/lib/api-client';
import type { UserPreferences } from '@/lib/api-client';

type RoutingStrategy = 'best_overall' | 'best_coding' | 'best_reasoning' | 'best_tooling' | 'best_creative' | 'cheapest' | 'fastest';

/**
 * Each strategy ranks on a different benchmark suite. `basis` says which one,
 * because the difference between them is the whole point of choosing.
 */
const ROUTING_STRATEGIES = [
  { id: 'best_overall' as RoutingStrategy, name: 'BEST OVERALL', desc: 'Highest combined score across all three benchmark suites', basis: 'Combined score — code 50%, reasoning 25%, tool use 25%', recommended: true },
  { id: 'best_coding' as RoutingStrategy, name: 'BEST FOR CODING', desc: 'Best at writing correct, well-structured code to spec', basis: 'Hourly 7-axis code benchmark', recommended: false },
  { id: 'best_reasoning' as RoutingStrategy, name: 'BEST FOR REASONING', desc: 'Best at multi-step problems, planning and long-context analysis', basis: 'Deep reasoning benchmark', recommended: false },
  { id: 'best_tooling' as RoutingStrategy, name: 'BEST FOR TOOL USE', desc: 'Best at picking the right tool with the right arguments and recovering from errors — use this for agents and coding assistants', basis: 'Tooling benchmark', recommended: false },
  { id: 'best_creative' as RoutingStrategy, name: 'BEST FOR CREATIVE', desc: 'General-purpose quality for open-ended writing. There is no creative-writing benchmark on this site, so this ranks on the same combined score as Best Overall', basis: 'Combined score (no dedicated creative benchmark)', recommended: false },
  { id: 'cheapest' as RoutingStrategy, name: 'MOST COST-EFFECTIVE', desc: 'Lowest list price per token among your connected providers', basis: 'Published provider pricing', recommended: false },
  { id: 'fastest' as RoutingStrategy, name: 'FASTEST RESPONSE', desc: 'Lowest average response time, measured over the last 7 days of benchmark runs', basis: 'Benchmark latency', recommended: false },
];

const PROVIDERS = ['openai', 'anthropic', 'google', 'deepseek', 'kimi', 'glm'];

/** A model currently in the routing pool, as returned by /router/analytics/available-models. */
interface RoutableModel {
  name: string;
  provider: string;
  rank: number;
  score: number;
}

export default function RouterPreferencesPage() {
  const { data: session, status } = useSession();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [routableModels, setRoutableModels] = useState<RoutableModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      apiClient.setUserId(session.user.id);
      checkSubscription();
      fetchPreferences();
      fetchRoutableModels();
    } else if (status === 'unauthenticated') {
      setError('User authentication required');
      setLoading(false);
      setChecking(false);
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

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      setError(null);
      const prefs = await apiClient.getPreferences();
      setPreferences(prefs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoutableModels = async () => {
    try {
      setModelsLoading(true);
      const response = await apiClient.getAvailableModels();
      // Best model first, and only entries that carry a usable model name.
      setRoutableModels(
        (response.models || [])
          .filter((m: RoutableModel) => Boolean(m.name))
          .sort((a: RoutableModel, b: RoutableModel) => a.rank - b.rank)
      );
    } catch {
      // Non-fatal: the rest of the page still works without the exclusion list.
      setRoutableModels([]);
    } finally {
      setModelsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preferences) return;
    try {
      setIsSaving(true);
      await apiClient.updatePreferences(preferences);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      alert(`Failed to save preferences: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all preferences to defaults?')) return;
    setPreferences({
      routingStrategy: 'best_overall',
      fallbackEnabled: true,
      maxCostPer1kTokens: null,
      maxLatencyMs: null,
      requireToolCalling: false,
      requireStreaming: false,
      excludedProviders: [],
      excludedModels: [],
    });
  };

  const toggleProvider = (provider: string) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      excludedProviders: preferences.excludedProviders.includes(provider)
        ? preferences.excludedProviders.filter(p => p !== provider)
        : [...preferences.excludedProviders, provider],
    });
  };

  const toggleModel = (model: string) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      excludedModels: preferences.excludedModels.includes(model)
        ? preferences.excludedModels.filter(m => m !== model)
        : [...preferences.excludedModels, model],
    });
  };

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
        <PreferencesPreview />
      </RouterLayout>
    );
  }

  if (loading) {
    return (
      <RouterLayout>
        <div className="rv4-loading" style={{ minHeight: '300px' }}>
          <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
          <span>LOADING PREFERENCES</span>
        </div>
      </RouterLayout>
    );
  }

  if (error || !preferences) {
    return (
      <RouterLayout>
        <div className="rv4-page-header">
          <div className="rv4-page-header-left">
            <div className="rv4-page-title">PREFERENCES</div>
          </div>
        </div>
        <div className="rv4-body">
          <div className="rv4-error-banner">
            <span>⚠</span>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 'bold', marginBottom: '2px' }}>ERROR</div><div style={{ fontSize: '10px' }}>{error || 'Unknown error'}</div></div>
            <button onClick={fetchPreferences} className="rv4-ctrl-btn danger" style={{ marginLeft: 'auto', fontSize: '10px' }}>RETRY</button>
          </div>
        </div>
      </RouterLayout>
    );
  }

  return (
    <RouterLayout>
      {/* Page header */}
      <div className="rv4-page-header">
        <div className="rv4-page-header-left">
          <div>
            <div className="rv4-page-title">SMART ROUTER PREFERENCES<span className="blinking-cursor"></span></div>
            <div className="rv4-page-title-sub">Configure intelligent model selection powered by real-time benchmarks from AI Stupid Meter</div>
          </div>
        </div>
        <div className="rv4-page-header-right">
          <button onClick={handleReset} className="rv4-ctrl-btn">RESET DEFAULTS</button>
          <button onClick={handleSave} disabled={isSaving} className="rv4-ctrl-btn primary">
            {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>

      <div className="rv4-body">
        {showSuccess && (
          <div className="rv4-success-banner" style={{ marginBottom: '14px' }}>
            <span>✓</span>
            <span>PREFERENCES SAVED SUCCESSFULLY</span>
          </div>
        )}

        <div className="rv4-info-banner green" style={{ marginBottom: '14px' }}>
          <span className="rv4-info-banner-icon" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold' }}>[i]</span>
          <div className="rv4-info-banner-content">
            <div className="rv4-info-banner-title">HOW SMART ROUTING WORKS</div>
            <div className="rv4-info-banner-text">
              Your router uses live benchmark data from AI Stupid Meter to make intelligent decisions.
              Choose a strategy below, and the router will pick models matching your priorities within your constraints.
            </div>
          </div>
        </div>

        {/* Routing Strategy */}
        <div className="rv4-panel" style={{ marginBottom: '14px' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">ROUTING STRATEGY</span>
            <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>Select one</span>
          </div>
          <div className="rv4-panel-body">
            <div className="rv4-strategy-grid">
              {ROUTING_STRATEGIES.map((strategy) => (
                <div
                  key={strategy.id}
                  className={`rv4-strategy-card${preferences.routingStrategy === strategy.id ? ' active' : ''}`}
                  onClick={() => setPreferences({ ...preferences, routingStrategy: strategy.id })}
                >
                  <div className="rv4-strategy-card-header">
                    <span className="rv4-strategy-card-name">{strategy.name}</span>
                    {strategy.recommended && <span className="rv4-strategy-card-recommended">RECOMMENDED</span>}
                    {preferences.routingStrategy === strategy.id && (
                      <span style={{ color: 'var(--phosphor-green)', fontFamily: 'var(--font-mono)', fontSize: '12px', marginLeft: 'auto' }}>✓</span>
                    )}
                  </div>
                  <div className="rv4-strategy-card-desc">{strategy.desc}</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '6px', fontStyle: 'italic' }}>
                    Ranks on: {strategy.basis}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Constraints */}
        <div className="rv4-panel" style={{ marginBottom: '14px' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">CONSTRAINTS</span>
          </div>
          <div className="rv4-panel-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Max Cost */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    MAXIMUM COST PER 1K TOKENS
                  </label>
                  <input
                    type="checkbox"
                    className="rv4-checkbox"
                    checked={preferences.maxCostPer1kTokens !== null}
                    onChange={(e) => setPreferences({ ...preferences, maxCostPer1kTokens: e.target.checked ? 0.01 : null })}
                  />
                </div>
                {preferences.maxCostPer1kTokens !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--phosphor-dim)' }}>$</span>
                    <input
                      type="number" step="0.001" min="0"
                      value={preferences.maxCostPer1kTokens}
                      onChange={(e) => setPreferences({ ...preferences, maxCostPer1kTokens: parseFloat(e.target.value) || 0 })}
                      className="rv4-input"
                    />
                    <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)', whiteSpace: 'nowrap' }}>per 1K tokens</span>
                  </div>
                )}
                <div className="rv4-input-hint">Only use models that cost less than this amount</div>
              </div>

              {/* Max Latency */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    MAXIMUM LATENCY
                  </label>
                  <input
                    type="checkbox"
                    className="rv4-checkbox"
                    checked={preferences.maxLatencyMs !== null}
                    onChange={(e) => setPreferences({ ...preferences, maxLatencyMs: e.target.checked ? 2000 : null })}
                  />
                </div>
                {preferences.maxLatencyMs !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number" step="100" min="0"
                      value={preferences.maxLatencyMs}
                      onChange={(e) => setPreferences({ ...preferences, maxLatencyMs: parseInt(e.target.value) || 0 })}
                      className="rv4-input"
                    />
                    <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)', whiteSpace: 'nowrap' }}>milliseconds</span>
                  </div>
                )}
                <div className="rv4-input-hint">Only use models with response times below this threshold</div>
              </div>

              {/* Feature requirements */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px' }}>
                  FEATURE REQUIREMENTS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      className="rv4-checkbox"
                      checked={preferences.requireToolCalling}
                      onChange={(e) => setPreferences({ ...preferences, requireToolCalling: e.target.checked })}
                      style={{ marginTop: '1px' }}
                    />
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--phosphor-green)', fontWeight: 'bold', marginBottom: '2px' }}>REQUIRE TOOL CALLING SUPPORT</div>
                      <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>Only use models that support function/tool calling</div>
                    </div>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      className="rv4-checkbox"
                      checked={preferences.requireStreaming}
                      onChange={(e) => setPreferences({ ...preferences, requireStreaming: e.target.checked })}
                      style={{ marginTop: '1px' }}
                    />
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--phosphor-green)', fontWeight: 'bold', marginBottom: '2px' }}>REQUIRE STREAMING SUPPORT</div>
                      <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>Only use models that support streaming responses</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Exclusions */}
        <div className="rv4-panel" style={{ marginBottom: '14px' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">EXCLUDED PROVIDERS</span>
          </div>
          <div className="rv4-panel-body">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {PROVIDERS.map((provider) => {
                const excluded = preferences.excludedProviders.includes(provider);
                return (
                  <button
                    key={provider}
                    onClick={() => toggleProvider(provider)}
                    className="rv4-ctrl-btn"
                    style={{
                      borderColor: excluded ? 'var(--red-alert)' : 'rgba(192,192,192,0.25)',
                      color: excluded ? 'var(--red-alert)' : 'var(--phosphor-dim)',
                      background: excluded ? 'rgba(255,45,0,0.08)' : 'transparent',
                      textTransform: 'uppercase',
                    }}
                  >
                    {excluded ? '✗ ' : ''}{provider}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>Click to exclude/include providers from routing</div>
          </div>
        </div>

        {/* Excluded models — the backend has always honoured excludedModels,
            but there was no way to set it from this page. */}
        <div className="rv4-panel" style={{ marginBottom: '14px' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">EXCLUDED MODELS</span>
            <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>
              {preferences.excludedModels.length} excluded
            </span>
          </div>
          <div className="rv4-panel-body">
            {modelsLoading ? (
              <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>LOADING MODELS…</div>
            ) : routableModels.length === 0 ? (
              <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>
                No ranked models available yet. Once benchmarks have run you can exclude individual models here.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {routableModels.map((model) => {
                    const excluded = preferences.excludedModels.includes(model.name);
                    const providerExcluded = preferences.excludedProviders.includes(model.provider);
                    return (
                      <button
                        key={model.name}
                        onClick={() => toggleModel(model.name)}
                        className="rv4-ctrl-btn"
                        title={`${model.provider} · score ${Math.round(model.score)}`}
                        style={{
                          borderColor: excluded ? 'var(--red-alert)' : 'rgba(192,192,192,0.25)',
                          color: excluded ? 'var(--red-alert)' : 'var(--phosphor-dim)',
                          background: excluded ? 'rgba(255,45,0,0.08)' : 'transparent',
                          opacity: providerExcluded && !excluded ? 0.4 : 1,
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {excluded ? '✗ ' : ''}{model.name}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)' }}>
                  Click a model to remove it from routing. Models greyed out are already covered by an excluded provider.
                </div>
              </>
            )}
          </div>
        </div>

        {/* Fallback */}
        <div className="rv4-panel" style={{ marginBottom: '14px' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">FALLBACK BEHAVIOR</span>
          </div>
          <div className="rv4-panel-body">
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                className="rv4-checkbox"
                checked={preferences.fallbackEnabled}
                onChange={(e) => setPreferences({ ...preferences, fallbackEnabled: e.target.checked })}
                style={{ marginTop: '1px' }}
              />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--phosphor-green)', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  ENABLE AUTOMATIC FALLBACK
                </div>
                <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.5' }}>
                  Automatically try alternative models if the primary model fails or is unavailable.
                  This ensures zero downtime and maximum reliability.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Info */}
        <div className="rv4-info-banner green" style={{ marginBottom: '14px' }}>
          <span className="rv4-info-banner-icon" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold' }}>[i]</span>
          <div className="rv4-info-banner-content">
            <div className="rv4-info-banner-title">REAL-TIME INTELLIGENCE</div>
            <div className="rv4-info-banner-text">
              Your router ranks models on the same live benchmark scores shown on the leaderboard, refreshed at
              least every 4 hours across three suites: a 7-axis code benchmark, a deep reasoning benchmark, and a
              tool-use benchmark. Each strategy above ranks on a different one. Rankings are cached for 5 minutes,
              so a preference change takes effect on your next request.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={handleReset} className="rv4-ctrl-btn">RESET DEFAULTS</button>
          <button onClick={handleSave} disabled={isSaving} className="rv4-ctrl-btn primary">
            {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>
    </RouterLayout>
  );
}
