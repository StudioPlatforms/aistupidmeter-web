'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import ProviderLogo from '@/components/ProviderLogo';
import { apiClient } from '@/lib/api-client';
import type { ProviderKey } from '@/lib/api-client';

type Provider = 'openai' | 'anthropic' | 'xai' | 'google' | 'glm' | 'deepseek' | 'kimi';

const PROVIDERS = [
  { id: 'openai' as Provider, name: 'OpenAI', desc: 'GPT-4o, GPT-5, o1, o3 models', keyFormat: 'sk-proj-...', docsUrl: 'platform.openai.com/api-keys', dot: '#10a37f' },
  { id: 'anthropic' as Provider, name: 'Anthropic', desc: 'Claude Sonnet 4, Opus 4, Haiku 4', keyFormat: 'sk-ant-...', docsUrl: 'console.anthropic.com/settings/keys', dot: '#d97706' },
  { id: 'xai' as Provider, name: 'xAI', desc: 'Grok 4, Grok 2, Grok Code Fast', keyFormat: 'xai-...', docsUrl: 'console.x.ai/api-keys', dot: '#000000' },
  { id: 'google' as Provider, name: 'Google', desc: 'Gemini 2.5 Pro/Flash/Flash-Lite', keyFormat: 'AIza...', docsUrl: 'console.cloud.google.com/apis/credentials', dot: '#4285f4' },
  { id: 'glm' as Provider, name: 'GLM', desc: 'GLM-4.6 — 128K context Chinese model', keyFormat: 'API key varies', docsUrl: 'open.bigmodel.cn/pricing', dot: '#6366f1' },
  { id: 'deepseek' as Provider, name: 'DeepSeek', desc: 'DeepSeek R1, V3 — Reasoning & MoE', keyFormat: 'API key varies', docsUrl: 'api-docs.deepseek.com', dot: '#0ea5e9' },
  { id: 'kimi' as Provider, name: 'Kimi', desc: 'Moonshot K2 — 1T parameter MoE', keyFormat: 'API key varies', docsUrl: 'platform.moonshot.ai/docs', dot: '#8b5cf6' },
];

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
  const connectedCount = providerKeys.length;

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
                Add your API keys from different providers. The router will automatically select the best-performing
                model from your available providers for each request. Your keys are encrypted with AES-256-GCM.
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
                        <div style={{ width: '40px', height: '40px', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', border: `1px solid ${connected ? 'rgba(0,255,65,0.3)' : 'rgba(192,192,192,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                          <ProviderLogo provider={prov.id} size={24} className="terminal-text--green" />
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
