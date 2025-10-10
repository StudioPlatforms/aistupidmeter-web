'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import PixelIcon from '@/components/PixelIcon';
import ProviderLogo from '@/components/ProviderLogo';
import { apiClient } from '@/lib/api-client';
import type { ProviderKey } from '@/lib/api-client';

type Provider = 'openai' | 'anthropic' | 'xai' | 'google' | 'glm' | 'deepseek' | 'kimi';

const PROVIDERS = [
  {
    id: 'openai' as Provider,
    name: 'OpenAI',
    iconName: 'computer',
    description: 'GPT-4o, GPT-4o-mini, GPT-5 Codex, o1, o1-mini',
    keyFormat: 'sk-proj-...',
    docsUrl: 'platform.openai.com/api-keys',
  },
  {
    id: 'anthropic' as Provider,
    name: 'Anthropic',
    iconName: 'brain',
    description: 'Claude Sonnet 4, Claude Opus 4, Claude 3.5',
    keyFormat: 'sk-ant-...',
    docsUrl: 'console.anthropic.com/settings/keys',
  },
  {
    id: 'xai' as Provider,
    name: 'XAI',
    iconName: 'lightning',
    description: 'Grok 4 Latest, Grok 2 Latest, Grok Code Fast 1',
    keyFormat: 'xai-...',
    docsUrl: 'console.x.ai/api-keys',
  },
  {
    id: 'google' as Provider,
    name: 'Google',
    iconName: 'star',
    description: 'Gemini 2.5 Pro/Flash, Gemini 1.5 Pro/Flash',
    keyFormat: 'AIza...',
    docsUrl: 'console.cloud.google.com/apis/credentials',
  },
  {
    id: 'glm' as Provider,
    name: 'GLM',
    iconName: 'chip',
    description: 'GLM-4.6 - Advanced Chinese language model with 128K context',
    keyFormat: 'API key format varies',
    docsUrl: 'open.bigmodel.cn/pricing',
  },
  {
    id: 'deepseek' as Provider,
    name: 'DeepSeek',
    iconName: 'search',
    description: 'DeepSeek R1, V3 - Reasoning and MoE models with off-peak pricing',
    keyFormat: 'API key format varies',
    docsUrl: 'api-docs.deepseek.com',
  },
  {
    id: 'kimi' as Provider,
    name: 'Kimi',
    iconName: 'moon',
    description: 'Moonshot K2 - 1T parameter MoE model with vision support',
    keyFormat: 'API key format varies',
    docsUrl: 'platform.moonshot.ai/docs/guide/start-using-kimi-api',
  },
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
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    message: string;
    models?: string[];
  } | null>(null);

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
      console.error('Failed to fetch provider keys:', err);
      setError(err instanceof Error ? err.message : 'Failed to load provider keys');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setShowAddModal(true);
    setValidationResult(null);
  };

  const handleSaveKey = async () => {
    if (!selectedProvider || !apiKey.trim()) return;

    try {
      setIsValidating(true);
      setValidationResult(null);

      const response = await apiClient.addProviderKey(selectedProvider, apiKey.trim());
      const validation = await apiClient.validateProviderKey(response.keyId);
      
      setValidationResult({
        success: validation.valid,
        message: validation.message,
        models: validation.models,
      });

      if (validation.valid) {
        await fetchProviderKeys();
        setTimeout(() => {
          setShowAddModal(false);
          setSelectedProvider(null);
          setApiKey('');
          setValidationResult(null);
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to add provider key:', err);
      setValidationResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to add key',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleValidateKey = async (keyId: number) => {
    try {
      const validation = await apiClient.validateProviderKey(keyId);
      
      if (validation.valid) {
        alert(`✅ Key is valid!\n\n${validation.modelsAvailable} models available`);
        await fetchProviderKeys();
      } else {
        alert(`❌ Key validation failed:\n\n${validation.message}`);
      }
    } catch (err) {
      console.error('Failed to validate key:', err);
      alert(`Failed to validate key: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDeleteKey = async (keyId: number) => {
    if (!confirm('Are you sure you want to delete this provider key? This action cannot be undone.')) {
      return;
    }

    try {
      await apiClient.deleteProviderKey(keyId);
      await fetchProviderKeys();
      alert('Provider key deleted successfully');
    } catch (err) {
      console.error('Failed to delete key:', err);
      alert(`Failed to delete key: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const getProviderInfo = (providerId: Provider) => {
    return PROVIDERS.find(p => p.id === providerId);
  };

  const hasProvider = (providerId: Provider) => {
    return providerKeys.some(k => k.provider === providerId);
  };

  const connectedCount = providerKeys.length;

  return (
    <RouterLayout>
      <SubscriptionGuard feature="Providers">
      <div className="vintage-container">
        {/* Header */}
      <div className="crt-monitor">
        <div className="terminal-text">
          <div style={{ fontSize: '1.5em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <PixelIcon name="plug" size={28} className="terminal-text--green" />
            <span className="terminal-text--green">PROVIDER API KEYS</span>
            <span className="blinking-cursor"></span>
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
            Connect your AI provider accounts to enable intelligent routing
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="crt-monitor" style={{ borderColor: 'var(--red-alert)', backgroundColor: 'rgba(255, 45, 0, 0.05)' }}>
          <div className="terminal-text">
            <div className="terminal-text--red" style={{ fontSize: '1.2em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PixelIcon name="warning" size={20} />
              SYSTEM ERROR
            </div>
            <div className="terminal-text--dim" style={{ marginBottom: '12px' }}>
              {error}
            </div>
            <button onClick={fetchProviderKeys} className="vintage-btn vintage-btn--danger">
              RETRY
            </button>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="crt-monitor" style={{ borderColor: 'var(--phosphor-green)', backgroundColor: 'rgba(0, 255, 65, 0.05)' }}>
        <div className="terminal-text">
          <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PixelIcon name="info" size={20} />
            HOW PROVIDER KEYS WORK
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.85em', lineHeight: '1.6' }}>
            Add your API keys from different providers. The router will automatically select 
            the best-performing model from your available providers for each request. Your keys 
            are encrypted and stored securely.
          </div>
        </div>
      </div>

      {/* Available Providers */}
      <div className="crt-monitor">
        <div className="terminal-text" style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '1.2em', marginBottom: '12px' }}>
            <span className="terminal-text--green">
              {loading ? 'LOADING...' : `AVAILABLE PROVIDERS (${connectedCount}/${PROVIDERS.length} CONNECTED)`}
            </span>
          </div>
        </div>
        
        {loading ? (
          <div className="terminal-text" style={{ textAlign: 'center', padding: '24px' }}>
            <div className="terminal-text--amber">
              LOADING PROVIDERS<span className="vintage-loading"></span>
            </div>
          </div>
        ) : (
          <div className="vintage-grid">
            {PROVIDERS.map((provider) => {
              const isConnected = hasProvider(provider.id);
              const providerKey = providerKeys.find(k => k.provider === provider.id);
              
              return (
                <div key={provider.id} className="control-panel" style={{
                  borderColor: isConnected ? 'var(--phosphor-green)' : 'var(--metal-silver)',
                  backgroundColor: isConnected ? 'rgba(0, 255, 65, 0.05)' : 'rgba(0, 0, 0, 0.2)'
                }}>
                  <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                    <div style={{ marginBottom: '8px', color: 'var(--phosphor-green)' }}>
                      <ProviderLogo provider={provider.id} size={48} className="terminal-text--green" />
                    </div>
                    <div className="terminal-text--green" style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '4px' }}>
                      {provider.name}
                    </div>
                    {isConnected && (
                      <span style={{
                        backgroundColor: 'var(--phosphor-green)',
                        color: 'var(--terminal-black)',
                        fontSize: '0.7em',
                        fontWeight: 'bold',
                        padding: '2px 8px',
                        borderRadius: '2px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <PixelIcon name="check" size={12} />
                        CONNECTED
                      </span>
                    )}
                  </div>
                  
                  <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginBottom: '12px', textAlign: 'center' }}>
                    {provider.description}
                  </div>
                  
                  {isConnected && providerKey ? (
                    <>
                      <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginBottom: '8px', textAlign: 'center' }}>
                        ADDED: {new Date(providerKey.createdAt).toLocaleDateString()}<br/>
                        {providerKey.lastValidated && `VALIDATED: ${new Date(providerKey.lastValidated).toLocaleDateString()}`}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleValidateKey(providerKey.id)}
                          className="vintage-btn"
                          style={{ fontSize: '0.8em', padding: '4px 12px' }}
                        >
                          VALIDATE
                        </button>
                        <button
                          onClick={() => handleDeleteKey(providerKey.id)}
                          className="vintage-btn vintage-btn--danger"
                          style={{ fontSize: '0.8em', padding: '4px 12px' }}
                        >
                          REMOVE
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => handleAddProvider(provider.id)}
                      className="vintage-btn vintage-btn--active"
                      style={{ width: '100%' }}
                    >
                      + ADD {provider.name.toUpperCase()} KEY
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Benefits */}
      <div className="vintage-grid">
        <div className="crt-monitor">
          <div className="terminal-text" style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '12px' }}>
              <PixelIcon name="money" size={40} />
            </div>
            <div className="terminal-text--green" style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '8px' }}>
              SAVE MONEY
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
              Automatically use the most cost-effective model for each request
            </div>
          </div>
        </div>
        
        <div className="crt-monitor">
          <div className="terminal-text" style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '12px' }}>
              <PixelIcon name="target" size={40} />
            </div>
            <div className="terminal-text--green" style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '8px' }}>
              BEST PERFORMANCE
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
              Route to the best-performing model based on real-time benchmarks
            </div>
          </div>
        </div>
        
        <div className="crt-monitor">
          <div className="terminal-text" style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '12px' }}>
              <PixelIcon name="refresh" size={40} />
            </div>
            <div className="terminal-text--green" style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '8px' }}>
              AUTOMATIC FAILOVER
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
              Zero downtime with automatic failover when models are unavailable
            </div>
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <div className="crt-monitor" style={{ borderColor: 'var(--amber-warning)', backgroundColor: 'rgba(255, 176, 0, 0.05)' }}>
        <div className="terminal-text">
          <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PixelIcon name="lock" size={20} />
            YOUR KEYS ARE SECURE
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.85em', lineHeight: '1.6' }}>
            All provider API keys are encrypted using AES-256-GCM encryption before being stored. 
            We never log or expose your keys. You can remove them at any time.
          </div>
        </div>
      </div>

      {/* Add Provider Modal */}
      {showAddModal && selectedProvider && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="crt-monitor" style={{ maxWidth: '700px', width: '100%' }}>
            <div className="terminal-text">
              <div style={{ fontSize: '1.3em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ProviderLogo provider={selectedProvider} size={24} className="terminal-text--green" />
                <span className="terminal-text--green">
                  ADD {getProviderInfo(selectedProvider)?.name.toUpperCase()} KEY
                </span>
                <span className="blinking-cursor"></span>
              </div>
              
              {validationResult && (
                <div className="crt-monitor" style={{ 
                  borderColor: validationResult.success ? 'var(--phosphor-green)' : 'var(--red-alert)',
                  backgroundColor: validationResult.success ? 'rgba(0, 255, 65, 0.05)' : 'rgba(255, 45, 0, 0.05)',
                  marginBottom: '16px'
                }}>
                  <div className="terminal-text">
                    <div className={validationResult.success ? 'terminal-text--green' : 'terminal-text--red'} style={{ fontSize: '1.1em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <PixelIcon name={validationResult.success ? 'check' : 'close'} size={20} />
                      {validationResult.success ? 'KEY VALIDATED!' : 'VALIDATION FAILED'}
                    </div>
                    <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                      {validationResult.message}
                    </div>
                    {validationResult.models && validationResult.models.length > 0 && (
                      <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginTop: '4px' }}>
                        {validationResult.models.length} models available
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '8px' }}>
                  API KEY:
                </div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={getProviderInfo(selectedProvider)?.keyFormat}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'var(--terminal-black)',
                    border: '2px solid var(--metal-silver)',
                    borderRadius: '4px',
                    color: 'var(--phosphor-green)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px'
                  }}
                  disabled={isValidating || (validationResult?.success ?? false)}
                />
                <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginTop: '4px' }}>
                  Your API key will be encrypted and stored securely
                </div>
              </div>
              
              <div className="crt-monitor" style={{ 
                borderColor: 'var(--phosphor-green)', 
                backgroundColor: 'rgba(0, 255, 65, 0.05)',
                marginBottom: '16px'
              }}>
                <div className="terminal-text">
                  <div className="terminal-text--green" style={{ fontSize: '0.85em', marginBottom: '4px' }}>
                    WHERE TO FIND YOUR KEY:
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.75em' }}>
                    {getProviderInfo(selectedProvider)?.docsUrl}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedProvider(null);
                    setApiKey('');
                    setValidationResult(null);
                  }}
                  disabled={isValidating}
                  className="vintage-btn"
                >
                  {validationResult?.success ? 'DONE' : 'CANCEL'}
                </button>
                {!validationResult?.success && (
                  <button
                    onClick={handleSaveKey}
                    disabled={!apiKey.trim() || isValidating}
                    className="vintage-btn vintage-btn--active"
                  >
                    {isValidating ? (
                      <>VALIDATING<span className="vintage-loading"></span></>
                    ) : (
                      'ADD & VALIDATE KEY'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
      </SubscriptionGuard>
    </RouterLayout>
  );
}
