'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import ProviderLogo from '@/components/ProviderLogo';
import { apiClient } from '@/lib/api-client';
import type { ProviderKey } from '@/lib/api-client';

type Provider = 'openai' | 'anthropic' | 'google' | 'glm' | 'deepseek' | 'kimi';

/**
 * Providers the router can actually route to.
 *
 * `models` must name models that are currently in the benchmark lineup
 * (models.show_in_rankings = 1) — the router can only select from those, so
 * advertising anything else sends users off to buy a key we will never use.
 * Last reconciled against the live lineup 2026-08-08.
 *
 * xAI was removed on 2026-08-08: none of its models are benchmarked any more,
 * so a Grok key could never be selected. Existing xAI keys are still shown
 * below under "retired" so they can be deleted.
 */
const PROVIDERS = [
  { id: 'openai' as Provider, name: 'OpenAI', desc: 'GPT-5.6 Sol / Terra / Luna, GPT-5.5, GPT-5.4, GPT-5.3-Codex', keyFormat: 'sk-proj-...', docsUrl: 'platform.openai.com/api-keys' },
  { id: 'anthropic' as Provider, name: 'Anthropic', desc: 'Claude Opus 5, Sonnet 5, Fable 5, Opus 4.8 / 4.7 / 4.6', keyFormat: 'sk-ant-...', docsUrl: 'console.anthropic.com/settings/keys' },
  { id: 'google' as Provider, name: 'Google', desc: 'Gemini 3.1 Pro, Gemini 3.1 Flash-Lite', keyFormat: 'AIza...', docsUrl: 'aistudio.google.com/apikey' },
  { id: 'deepseek' as Provider, name: 'DeepSeek', desc: 'DeepSeek V4-Pro, V4-Flash — MoE reasoning', keyFormat: 'sk-...', docsUrl: 'platform.deepseek.com/api_keys' },
  { id: 'kimi' as Provider, name: 'Kimi', desc: 'Kimi K3, Kimi K2.7-Code — Moonshot AI', keyFormat: 'sk-...', docsUrl: 'platform.moonshot.ai/console/api-keys' },
  { id: 'glm' as Provider, name: 'GLM', desc: 'GLM-5.2 — Z.ai, 128K context', keyFormat: 'API key varies', docsUrl: 'z.ai/manage-apikey/apikey-list' },
];

/** Providers we used to support. Keys stay visible so users can remove them. */
const RETIRED_PROVIDERS: Record<string, string> = {
  xai: 'No Grok models are in the benchmark lineup, so the router cannot select one. This key is not being used — you can safely remove it.',
};

export default function RouterProvidersPage() {
  const { data: session, status } = useSession();
  const [providerKeys, setProviderKeys] = useState<ProviderKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ success: boolean; message: string; models?: string[] } | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      apiClient.setUserId(session.user.id);
      fetchProviderKeys();
    } else if (status === 'unauthenticated') {
      setError('User authentication required');
      setLoading(false);
    }
  }, [status, session]);

  const fetchProviderKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getProviderKeys();
      setProviderKeys(response.keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load provider keys');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = async () => {
    if (!selectedProvider || !apiKey.trim()) return;
    try {
      setIsValidating(true);
      setValidationResult(null);
      const response = await apiClient.addProviderKey(selectedProvider, apiKey.trim());
      const validation = await apiClient.validateProviderKey(response.keyId);
      setValidationResult({ success: validation.valid, message: validation.message, models: validation.models });
      if (validation.valid) {
        await fetchProviderKeys();
        setTimeout(() => { setShowAddModal(false); setSelectedProvider(null); setApiKey(''); setValidationResult(null); }, 2000);
      }
    } catch (err) {
      setValidationResult({ success: false, message: err instanceof Error ? err.message : 'Failed to add key' });
    } finally {
      setIsValidating(false);
    }
  };

  const handleValidateKey = async (keyId: number) => {
    try {
      const validation = await apiClient.validateProviderKey(keyId);
      if (validation.valid) {
        alert(`✓ Key is valid!\n\n${validation.modelsAvailable} models available`);
        await fetchProviderKeys();
      } else {
        alert(`✗ Key validation failed:\n\n${validation.message}`);
      }
    } catch (err) {
      alert(`Failed to validate key: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDeleteKey = async (keyId: number) => {
    if (!confirm('Are you sure you want to delete this provider key? This action cannot be undone.')) return;
    try {
      await apiClient.deleteProviderKey(keyId);
      await fetchProviderKeys();
    } catch (err) {
      alert(`Failed to delete key: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const hasProvider = (id: Provider) => providerKeys.some(k => k.provider === id);
  const getProviderKey = (id: Provider) => providerKeys.find(k => k.provider === id);
  const selectedProviderInfo = PROVIDERS.find(p => p.id === selectedProvider);
  const supportedIds = new Set<string>(PROVIDERS.map(p => p.id));
  const retiredKeys = providerKeys.filter(k => !supportedIds.has(k.provider));
  const connectedCount = providerKeys.filter(k => supportedIds.has(k.provider)).length;

  return (
    <RouterLayout>
      <SubscriptionGuard feature="Providers">
        {/* Page header */}
        <div className="rv4-page-header">
          <div className="rv4-page-header-left">
            <span style={{ fontSize: '18px' }}>🔌</span>
            <div>
              <div className="rv4-page-title">PROVIDER API KEYS<span className="blinking-cursor"></span></div>
              <div className="rv4-page-title-sub">Connect your AI provider accounts to enable intelligent routing</div>
            </div>
          </div>
          <div className="rv4-page-header-right">
            <span className="rv4-badge green">{loading ? '...' : `${connectedCount}/${PROVIDERS.length}`} CONNECTED</span>
          </div>
        </div>

        <div className="rv4-body">
          {error && (
            <div className="rv4-error-banner" style={{ marginBottom: '14px' }}>
              <span>⚠</span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 'bold', marginBottom: '2px' }}>ERROR</div><div style={{ fontSize: '10px' }}>{error}</div></div>
              <button onClick={fetchProviderKeys} className="rv4-ctrl-btn danger" style={{ marginLeft: 'auto', fontSize: '10px' }}>RETRY</button>
            </div>
          )}

          {/* How it works */}
          <div className="rv4-info-banner green" style={{ marginBottom: '14px' }}>
            <span className="rv4-info-banner-icon">ℹ</span>
            <div className="rv4-info-banner-content">
              <div className="rv4-info-banner-title">HOW PROVIDER KEYS WORK</div>
              <div className="rv4-info-banner-text">
                Add your API keys from different providers. For each request the router picks the best model from the
                providers you have connected, using the live benchmark scores on this site — so it can only route to
                models that are currently being benchmarked. Connect more providers to give it more to choose from.
                Your keys are encrypted with AES-256-GCM and are used only to call the provider on your behalf.
              </div>
            </div>
          </div>

          {/* Providers grid */}
          <div className="rv4-panel" style={{ marginBottom: '14px' }}>
            <div className="rv4-panel-header">
              <span className="rv4-panel-title">🔌 AVAILABLE PROVIDERS</span>
            </div>
            <div className="rv4-panel-body">
              {loading ? (
                <div className="rv4-loading">
                  <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
                  <span>LOADING PROVIDERS</span>
                </div>
              ) : (
                <div className="rv4-provider-grid">
                  {PROVIDERS.map((prov) => {
                    const connected = hasProvider(prov.id);
                    const key = getProviderKey(prov.id);
                    return (
                      <div key={prov.id} className={`rv4-provider-card${connected ? ' connected' : ''}`}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#ffffff', border: `1px solid ${connected ? 'var(--accent)' : 'var(--metal-silver)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                          <ProviderLogo provider={prov.id} size={22} />
                        </div>
                        <div className="rv4-provider-card-name">{prov.name}</div>
                        {connected && <span className="rv4-badge green" style={{ fontSize: '8px' }}>✓ CONNECTED</span>}
                        <div className="rv4-provider-card-desc">{prov.desc}</div>
                        {connected && key ? (
                          <>
                            <div style={{ fontSize: '9px', color: 'var(--phosphor-dim)', marginTop: '4px' }}>
                              Added: {new Date(key.createdAt).toLocaleDateString()}
                              {key.lastValidated && <><br />Validated: {new Date(key.lastValidated).toLocaleDateString()}</>}
                            </div>
                            <div style={{ display: 'flex', gap: '4px', marginTop: '8px', width: '100%' }}>
                              <button onClick={() => handleValidateKey(key.id)} className="rv4-ctrl-btn" style={{ flex: 1, fontSize: '9px' }}>VALIDATE</button>
                              <button onClick={() => handleDeleteKey(key.id)} className="rv4-ctrl-btn danger" style={{ flex: 1, fontSize: '9px' }}>REMOVE</button>
                            </div>
                          </>
                        ) : (
                          <button
                            onClick={() => { setSelectedProvider(prov.id); setShowAddModal(true); setValidationResult(null); }}
                            className="rv4-ctrl-btn primary"
                            style={{ width: '100%', marginTop: '8px', fontSize: '10px' }}
                          >
                            + ADD {prov.name.toUpperCase()}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Keys for providers we no longer route to */}
          {retiredKeys.length > 0 && (
            <div className="rv4-panel" style={{ marginBottom: '14px' }}>
              <div className="rv4-panel-header">
                <span className="rv4-panel-title">RETIRED PROVIDERS</span>
              </div>
              <div className="rv4-panel-body">
                {retiredKeys.map((key) => (
                  <div key={key.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase', marginBottom: '2px' }}>
                        {key.provider}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: 1.5 }}>
                        {RETIRED_PROVIDERS[key.provider] ?? 'This provider is no longer part of the routing pool.'}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteKey(key.id)} className="rv4-ctrl-btn danger" style={{ fontSize: '10px' }}>
                      REMOVE
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Benefits */}
          <div className="rv4-cols-3">
            {[
              { icon: '💰', title: 'SAVE MONEY', desc: 'Automatically use the most cost-effective model for each request' },
              { icon: '🎯', title: 'BEST PERFORMANCE', desc: 'Route to the best-performing model based on real-time benchmarks' },
              { icon: '🔄', title: 'AUTO FAILOVER', desc: 'Zero downtime with automatic failover when models are unavailable' },
            ].map((b, i) => (
              <div key={i} className="rv4-panel">
                <div className="rv4-panel-body" style={{ textAlign: 'center', padding: '16px' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>{b.icon}</div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)', letterSpacing: '0.5px', marginBottom: '6px' }}>{b.title}</div>
                  <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.4' }}>{b.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Security notice */}
          <div className="rv4-info-banner amber" style={{ marginTop: '4px' }}>
            <span className="rv4-info-banner-icon">🔒</span>
            <div className="rv4-info-banner-content">
              <div className="rv4-info-banner-title">YOUR KEYS ARE SECURE</div>
              <div className="rv4-info-banner-text">
                All provider API keys are encrypted using AES-256-GCM before being stored.
                We never log or expose your keys. You can remove them at any time.
              </div>
            </div>
          </div>
        </div>

        {/* Add Provider Modal */}
        {showAddModal && selectedProvider && selectedProviderInfo && (
          <div className="rv4-modal-backdrop" onClick={() => { if (!isValidating) { setShowAddModal(false); setSelectedProvider(null); setApiKey(''); setValidationResult(null); } }}>
            <div className="rv4-modal" onClick={(e) => e.stopPropagation()}>
              <div className="rv4-modal-header">
                <span className="rv4-modal-title">🔌 ADD {selectedProviderInfo.name.toUpperCase()} KEY</span>
                <button className="rv4-modal-close" onClick={() => { if (!isValidating) { setShowAddModal(false); setSelectedProvider(null); setApiKey(''); setValidationResult(null); } }}>✕ CLOSE</button>
              </div>
              <div className="rv4-modal-body">
                {validationResult && (
                  <div className={`rv4-${validationResult.success ? 'success' : 'error'}-banner`} style={{ marginBottom: '14px' }}>
                    <span>{validationResult.success ? '✓' : '⚠'}</span>
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{validationResult.success ? 'KEY VALIDATED!' : 'VALIDATION FAILED'}</div>
                      <div style={{ fontSize: '10px' }}>{validationResult.message}</div>
                      {validationResult.models && validationResult.models.length > 0 && (
                        <div style={{ fontSize: '10px', marginTop: '2px', opacity: 0.7 }}>{validationResult.models.length} models available</div>
                      )}
                    </div>
                  </div>
                )}
                <div className="rv4-form-group">
                  <label className="rv4-input-label">API KEY</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={selectedProviderInfo.keyFormat}
                    className="rv4-input"
                    disabled={isValidating || (validationResult?.success ?? false)}
                    autoFocus
                  />
                  <div className="rv4-input-hint">Your API key will be encrypted and stored securely</div>
                </div>
                <div className="rv4-info-banner green" style={{ marginBottom: '14px' }}>
                  <span className="rv4-info-banner-icon">🔑</span>
                  <div className="rv4-info-banner-content">
                    <div className="rv4-info-banner-title">WHERE TO FIND YOUR KEY</div>
                    <div className="rv4-info-banner-text">{selectedProviderInfo.docsUrl}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setShowAddModal(false); setSelectedProvider(null); setApiKey(''); setValidationResult(null); }}
                    disabled={isValidating}
                    className="rv4-ctrl-btn"
                  >
                    {validationResult?.success ? 'DONE' : 'CANCEL'}
                  </button>
                  {!validationResult?.success && (
                    <button
                      onClick={handleSaveKey}
                      disabled={!apiKey.trim() || isValidating}
                      className="rv4-ctrl-btn primary"
                    >
                      {isValidating ? 'VALIDATING...' : 'ADD & VALIDATE KEY'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </SubscriptionGuard>
    </RouterLayout>
  );
}
