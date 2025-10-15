'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import PreferencesPreview from '@/components/PreferencesPreview';
import PixelIcon from '@/components/PixelIcon';
import { apiClient } from '@/lib/api-client';
import type { UserPreferences } from '@/lib/api-client';

type RoutingStrategy = 'best_overall' | 'best_coding' | 'best_reasoning' | 'best_creative' | 'cheapest' | 'fastest';

const ROUTING_STRATEGIES = [
  {
    id: 'best_overall' as RoutingStrategy,
    name: 'Best Overall',
    iconName: 'target',
    description: 'Automatically selects the model with the lowest stupid score across all categories',
    recommended: true,
  },
  {
    id: 'best_coding' as RoutingStrategy,
    name: 'Best for Coding',
    iconName: 'code',
    description: 'Optimized for code generation, debugging, and programming tasks',
    recommended: false,
  },
  {
    id: 'best_reasoning' as RoutingStrategy,
    name: 'Best for Reasoning',
    iconName: 'brain',
    description: 'Optimized for complex reasoning, problem-solving, and analysis',
    recommended: false,
  },
  {
    id: 'best_creative' as RoutingStrategy,
    name: 'Best for Creative',
    iconName: 'palette',
    description: 'Optimized for creative writing, content generation, and storytelling',
    recommended: false,
  },
  {
    id: 'cheapest' as RoutingStrategy,
    name: 'Most Cost-Effective',
    iconName: 'money',
    description: 'Always selects the cheapest available model',
    recommended: false,
  },
  {
    id: 'fastest' as RoutingStrategy,
    name: 'Fastest Response',
    iconName: 'lightning',
    description: 'Prioritizes models with the lowest latency',
    recommended: false,
  },
];

const PROVIDERS = ['openai', 'anthropic', 'xai', 'google', 'glm', 'deepseek', 'kimi'];

export default function RouterPreferencesPage() {
  const { data: session, status } = useSession();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      apiClient.setUserId(session.user.id);
      checkSubscription();
      fetchPreferences();
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: session!.user!.email!
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.data.hasAccess) {
        setHasAccess(true);
      } else {
        setHasAccess(false);
      }
    } catch (err) {
      console.error('Failed to check subscription:', err);
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
      console.error('Failed to fetch preferences:', err);
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
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
      console.error('Failed to save preferences:', err);
      alert(`Failed to save preferences: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all preferences to defaults?')) {
      return;
    }

    const defaultPreferences: UserPreferences = {
      routingStrategy: 'best_overall',
      fallbackEnabled: true,
      maxCostPer1kTokens: null,
      maxLatencyMs: null,
      requireToolCalling: false,
      requireStreaming: false,
      excludedProviders: [],
      excludedModels: [],
    };

    setPreferences(defaultPreferences);
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

  if (checking) {
    return (
      <RouterLayout>
        <div className="vintage-container">
          <div className="crt-monitor">
            <div className="terminal-text terminal-text--green" style={{ fontSize: '1.5em', textAlign: 'center', padding: 'var(--space-xl)' }}>
              CHECKING ACCESS<span className="vintage-loading"></span>
            </div>
          </div>
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
        <div className="vintage-container">
        <div className="crt-monitor" style={{ textAlign: 'center', padding: '48px' }}>
          <div className="terminal-text">
            <div className="terminal-text--amber" style={{ fontSize: '1.5em' }}>
              LOADING PREFERENCES<span className="vintage-loading"></span>
            </div>
          </div>
        </div>
        </div>
      </RouterLayout>
    );
  }

  if (error || !preferences) {
    return (
      <RouterLayout>
        <div className="vintage-container">
        <div className="crt-monitor" style={{ borderColor: 'var(--red-alert)', backgroundColor: 'rgba(255, 45, 0, 0.05)' }}>
          <div className="terminal-text">
            <div className="terminal-text--red" style={{ fontSize: '1.5em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <PixelIcon name="warning" size={28} />
              SYSTEM ERROR
            </div>
            <div className="terminal-text--dim" style={{ marginBottom: '16px' }}>
              {error || 'Unknown error'}
            </div>
            <button onClick={fetchPreferences} className="vintage-btn vintage-btn--danger">
              TRY AGAIN
            </button>
          </div>
        </div>
        </div>
      </RouterLayout>
    );
  }

  return (
    <RouterLayout>
      <div className="vintage-container">
        {/* Header */}
      <div className="crt-monitor">
        <div className="terminal-text">
          <div style={{ fontSize: '1.5em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <PixelIcon name="settings" size={28} className="terminal-text--green" />
            <span className="terminal-text--green">ROUTING PREFERENCES</span>
            <span className="blinking-cursor"></span>
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '16px' }}>
            Configure how the router selects models for your requests
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={handleReset} className="vintage-btn">
              RESET TO DEFAULTS
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="vintage-btn vintage-btn--active"
            >
              {isSaving ? (
                <>SAVING<span className="vintage-loading"></span></>
              ) : (
                'SAVE CHANGES'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="crt-monitor" style={{ borderColor: 'var(--phosphor-green)', backgroundColor: 'rgba(0, 255, 65, 0.05)' }}>
          <div className="terminal-text">
            <div className="terminal-text--green" style={{ fontSize: '1.2em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PixelIcon name="check" size={22} />
              PREFERENCES SAVED SUCCESSFULLY!
            </div>
          </div>
        </div>
      )}

      {/* Routing Strategy */}
      <div className="crt-monitor">
        <div className="terminal-text" style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '1.2em', marginBottom: '8px' }}>
            <span className="terminal-text--green">ROUTING STRATEGY</span>
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
            Choose how the router selects models for your requests
          </div>
        </div>
        
        <div className="vintage-grid">
          {ROUTING_STRATEGIES.map((strategy) => (
            <button
              key={strategy.id}
              onClick={() => setPreferences({ ...preferences, routingStrategy: strategy.id })}
              className="control-panel"
              style={{
                borderColor: preferences.routingStrategy === strategy.id ? 'var(--phosphor-green)' : 'var(--metal-silver)',
                backgroundColor: preferences.routingStrategy === strategy.id ? 'rgba(0, 255, 65, 0.05)' : 'rgba(0, 0, 0, 0.2)',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PixelIcon name={strategy.iconName} size={24} />
                  <span className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold' }}>
                    {strategy.name}
                  </span>
                </div>
                {strategy.recommended && (
                  <span style={{
                    backgroundColor: 'var(--phosphor-green)',
                    color: 'var(--terminal-black)',
                    fontSize: '0.6em',
                    fontWeight: 'bold',
                    padding: '2px 6px',
                    borderRadius: '2px'
                  }}>
                    RECOMMENDED
                  </span>
                )}
                {preferences.routingStrategy === strategy.id && (
                  <PixelIcon name="check" size={20} className="terminal-text--green" />
                )}
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.75em' }}>
                {strategy.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Constraints */}
      <div className="crt-monitor">
        <div className="terminal-text" style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '1.2em', marginBottom: '8px' }}>
            <span className="terminal-text--green">CONSTRAINTS</span>
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
            Set limits on cost, latency, and required features
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Max Cost */}
          <div className="control-panel">
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', cursor: 'pointer' }}>
              <span className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold' }}>
                MAXIMUM COST PER 1K TOKENS
              </span>
              <input
                type="checkbox"
                checked={preferences.maxCostPer1kTokens !== null}
                onChange={(e) => setPreferences({
                  ...preferences,
                  maxCostPer1kTokens: e.target.checked ? 0.01 : null,
                })}
                style={{ width: '20px', height: '20px' }}
              />
            </label>
            {preferences.maxCostPer1kTokens !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="terminal-text--dim">$</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={preferences.maxCostPer1kTokens}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    maxCostPer1kTokens: parseFloat(e.target.value) || 0,
                  })}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: 'var(--terminal-black)',
                    border: '2px solid var(--metal-silver)',
                    borderRadius: '4px',
                    color: 'var(--phosphor-green)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px'
                  }}
                />
                <span className="terminal-text--dim" style={{ fontSize: '0.85em' }}>per 1K tokens</span>
              </div>
            )}
            <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginTop: '4px' }}>
              Only use models that cost less than this amount
            </div>
          </div>

          {/* Max Latency */}
          <div className="control-panel">
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', cursor: 'pointer' }}>
              <span className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold' }}>
                MAXIMUM LATENCY
              </span>
              <input
                type="checkbox"
                checked={preferences.maxLatencyMs !== null}
                onChange={(e) => setPreferences({
                  ...preferences,
                  maxLatencyMs: e.target.checked ? 2000 : null,
                })}
                style={{ width: '20px', height: '20px' }}
              />
            </label>
            {preferences.maxLatencyMs !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  step="100"
                  min="0"
                  value={preferences.maxLatencyMs}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    maxLatencyMs: parseInt(e.target.value) || 0,
                  })}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: 'var(--terminal-black)',
                    border: '2px solid var(--metal-silver)',
                    borderRadius: '4px',
                    color: 'var(--phosphor-green)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px'
                  }}
                />
                <span className="terminal-text--dim" style={{ fontSize: '0.85em' }}>milliseconds</span>
              </div>
            )}
            <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginTop: '4px' }}>
              Only use models with response times below this threshold
            </div>
          </div>

          {/* Feature Requirements */}
          <div className="control-panel">
            <div className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold', marginBottom: '12px' }}>
              FEATURE REQUIREMENTS
            </div>
            
            <label style={{ display: 'flex', alignItems: 'start', gap: '12px', marginBottom: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={preferences.requireToolCalling}
                onChange={(e) => setPreferences({
                  ...preferences,
                  requireToolCalling: e.target.checked,
                })}
                style={{ width: '20px', height: '20px', marginTop: '2px' }}
              />
              <div>
                <div className="terminal-text--green" style={{ fontSize: '0.85em', marginBottom: '4px' }}>
                  REQUIRE TOOL CALLING SUPPORT
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.75em' }}>
                  Only use models that support function/tool calling
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'start', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={preferences.requireStreaming}
                onChange={(e) => setPreferences({
                  ...preferences,
                  requireStreaming: e.target.checked,
                })}
                style={{ width: '20px', height: '20px', marginTop: '2px' }}
              />
              <div>
                <div className="terminal-text--green" style={{ fontSize: '0.85em', marginBottom: '4px' }}>
                  REQUIRE STREAMING SUPPORT
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.75em' }}>
                  Only use models that support streaming responses
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Exclusions */}
      <div className="crt-monitor">
        <div className="terminal-text" style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '1.2em', marginBottom: '8px' }}>
            <span className="terminal-text--green">EXCLUSIONS</span>
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
            Exclude specific providers from routing
          </div>
        </div>
        
        <div className="control-panel">
          <div className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold', marginBottom: '12px' }}>
            EXCLUDED PROVIDERS
          </div>
          <div className="vintage-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            {PROVIDERS.map((provider) => (
              <button
                key={provider}
                onClick={() => toggleProvider(provider)}
                className="vintage-btn"
                style={{
                  borderColor: preferences.excludedProviders.includes(provider) ? 'var(--red-alert)' : 'var(--metal-silver)',
                  backgroundColor: preferences.excludedProviders.includes(provider) ? 'rgba(255, 45, 0, 0.1)' : 'rgba(0, 0, 0, 0.2)',
                  color: preferences.excludedProviders.includes(provider) ? 'var(--red-alert)' : 'var(--phosphor-green)'
                }}
              >
                {preferences.excludedProviders.includes(provider) && '✗ '}
                {provider.charAt(0).toUpperCase() + provider.slice(1)}
              </button>
            ))}
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginTop: '8px' }}>
            Click to exclude/include providers from routing
          </div>
        </div>
      </div>

      {/* Fallback */}
      <div className="crt-monitor">
        <div className="terminal-text" style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '1.2em', marginBottom: '8px' }}>
            <span className="terminal-text--green">FALLBACK BEHAVIOR</span>
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
            Configure what happens when the primary model is unavailable
          </div>
        </div>
        
        <div className="control-panel">
          <label style={{ display: 'flex', alignItems: 'start', gap: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={preferences.fallbackEnabled}
              onChange={(e) => setPreferences({
                ...preferences,
                fallbackEnabled: e.target.checked,
              })}
              style={{ width: '20px', height: '20px', marginTop: '2px' }}
            />
            <div>
              <div className="terminal-text--green" style={{ fontSize: '0.9em', marginBottom: '4px', fontWeight: 'bold' }}>
                ENABLE AUTOMATIC FALLBACK
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.75em', lineHeight: '1.5' }}>
                Automatically try alternative models if the primary model fails or is unavailable. 
                This ensures zero downtime and maximum reliability.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Info Banner */}
      <div className="crt-monitor" style={{ borderColor: 'var(--phosphor-green)', backgroundColor: 'rgba(0, 255, 65, 0.05)' }}>
        <div className="terminal-text">
          <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PixelIcon name="lightbulb" size={20} />
            HOW PREFERENCES WORK
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.85em', lineHeight: '1.6' }}>
            Your preferences are applied to every request. The router will only select models 
            that meet all your constraints. If no models match, the request will fail with a 
            clear error message explaining why.
          </div>
        </div>
      </div>
      </div>
    </RouterLayout>
  );
}
