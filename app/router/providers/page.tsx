'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import { apiClient } from '@/lib/api-client';
import type { ProviderKey } from '@/lib/api-client';
import { PageHead, Pane, Modal, Loader, Note, Tag, Pill, ProviderMark } from '@/components/studio';
import '@/styles/studio-keys.css';

type Provider = 'openai' | 'anthropic' | 'google' | 'glm' | 'deepseek' | 'kimi';

/**
 * Providers the router can actually route to.
 *
 * Each card lists the provider's models that are in the benchmark lineup right now, read from
 * /api/models (models.show_in_rankings = 1) — the router can only select from those. The lists
 * used to be written here by hand; last reconciled 2026-08-08, they still advertised GPT-5.4,
 * GPT-5.3-Codex and Gemini 3.1 two months later and missed GPT-6, Opus 5.5 and Sonnet 5.5.
 *
 * xAI was removed on 2026-08-08: none of its models are benchmarked any more,
 * so a Grok key could never be selected. Existing xAI keys are still shown
 * below under "retired" so they can be deleted.
 */
const PROVIDERS = [
  { id: 'openai' as Provider, name: 'OpenAI', maker: 'OpenAI', keyFormat: 'sk-proj-...', docsUrl: 'platform.openai.com/api-keys' },
  { id: 'anthropic' as Provider, name: 'Anthropic', maker: 'Anthropic', keyFormat: 'sk-ant-...', docsUrl: 'console.anthropic.com/settings/keys' },
  { id: 'google' as Provider, name: 'Google', maker: 'Google', keyFormat: 'AIza...', docsUrl: 'aistudio.google.com/apikey' },
  { id: 'deepseek' as Provider, name: 'DeepSeek', maker: 'DeepSeek', keyFormat: 'sk-...', docsUrl: 'platform.deepseek.com/api_keys' },
  { id: 'kimi' as Provider, name: 'Kimi', maker: 'Moonshot AI', keyFormat: 'sk-...', docsUrl: 'platform.moonshot.ai/console/api-keys' },
  { id: 'glm' as Provider, name: 'GLM', maker: 'Z.ai', keyFormat: 'API key varies', docsUrl: 'z.ai/manage-apikey/apikey-list' },
];

/** Providers we used to support. Keys stay visible so users can remove them. */
const RETIRED_PROVIDERS: Record<string, string> = {
  xai: 'No Grok models are in the benchmark lineup, so the router cannot select one. This key is not being used — you can safely remove it.',
};
/** How a retired provider's name is written. */
const RETIRED_NAMES: Record<string, string> = { xai: 'xAI' };

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

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
  // Benchmarked models per provider (null until loaded), for the card descriptions — newest
  // first (/api/models lists them in the order they were added).
  const [lineup, setLineup] = useState<Record<string, string[]> | null>(null);
  const keyField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/models')
      .then(r => (r.ok ? r.json() : []))
      .then((models: Array<{ vendor?: string; name?: string; displayName?: string }>) => {
        const byVendor: Record<string, string[]> = {};
        for (const m of Array.isArray(models) ? models : []) {
          if (!m.vendor) continue;
          (byVendor[m.vendor] ??= []).push(m.displayName || m.name || '');
        }
        setLineup(byVendor);
      })
      .catch(() => setLineup(null));
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      apiClient.setUserId(session.user.id);
      fetchProviderKeys();
    } else if (status === 'unauthenticated') {
      setError('User authentication required');
      setLoading(false);
    }
  }, [status, session]);

  // The dialog focuses itself when it opens; put the caret in the key field after it, as the
  // old dialog's autoFocus did. (Child effects run first, so this frame comes after the dialog's.)
  useEffect(() => {
    if (!showAddModal) return;
    const raf = requestAnimationFrame(() => keyField.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [showAddModal]);

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

  const resetAdd = () => { setShowAddModal(false); setSelectedProvider(null); setApiKey(''); setValidationResult(null); };
  // Escape, the backdrop and the close button never interrupt a key being checked.
  const closeAdd = () => { if (!isValidating) resetAdd(); };

  const hasProvider = (id: Provider) => providerKeys.some(k => k.provider === id);
  const getProviderKey = (id: Provider) => providerKeys.find(k => k.provider === id);
  const selectedProviderInfo = PROVIDERS.find(p => p.id === selectedProvider);
  const supportedIds = new Set<string>(PROVIDERS.map(p => p.id));
  const retiredKeys = providerKeys.filter(k => !supportedIds.has(k.provider));
  const connectedCount = providerKeys.filter(k => supportedIds.has(k.provider)).length;

  return (
    <RouterLayout>
      <SubscriptionGuard feature="Provider keys" requires="routing">
        <PageHead
          kicker="Smart Router"
          title="Provider keys"
          lead="Connect your AI provider accounts to enable intelligent routing."
          actions={
            <Pill tone={!loading && connectedCount > 0 ? 'good' : undefined}>
              {loading ? '…' : `${connectedCount} of ${PROVIDERS.length}`} connected
            </Pill>
          }
        />

        <div className="st-body">
          {error && (
            <Note tone="bad" title="Could not load your provider keys">
              {error}
              <div className="sk-note-act">
                <button type="button" className="st-btn is-sm" onClick={fetchProviderKeys}>Retry</button>
              </div>
            </Note>
          )}

          <Note title="How provider keys work">
            Add your API keys from different providers. For each request the router picks the best model from the
            providers you have connected, using the live benchmark scores on this site — so it can only route to
            models that are currently being benchmarked. Connect more providers to give it more to choose from.
            Your keys are encrypted with AES-256-GCM and are used only to call the provider on your behalf.
          </Note>

          <Pane title="Available providers" sub={`${PROVIDERS.length} providers the router can route to`} delay={0.04}>
            {loading ? (
              <Loader label="Loading providers" minHeight={260} />
            ) : (
              <div className="st-cards sk-provs">
                {PROVIDERS.map((prov) => {
                  const connected = hasProvider(prov.id);
                  const key = getProviderKey(prov.id);
                  const models = lineup?.[prov.id] ?? [];
                  return (
                    <div key={prov.id} className={`st-card sk-prov${connected ? ' is-connected' : ''}`}>
                      <div className="sk-prov-head">
                        <ProviderMark provider={prov.id} size="lg" />
                        <div className="sk-prov-name">
                          <span className="st-card-t">{prov.name}</span>
                          {prov.maker !== prov.name && <span className="sk-prov-maker">{prov.maker}</span>}
                        </div>
                        {connected && <Pill tone="good">Connected</Pill>}
                      </div>

                      <div className="sk-prov-models">
                        {lineup === null ? (
                          <p className="st-card-d">{prov.maker}</p>
                        ) : models.length ? (
                          <>
                            <p className="st-label">Benchmarked models</p>
                            <div className="sk-tags">
                              {[...models].reverse().map((name, i) => <Tag key={`${name}-${i}`}>{name}</Tag>)}
                            </div>
                          </>
                        ) : (
                          <p className="st-card-d">No models from this provider are benchmarked right now</p>
                        )}
                      </div>

                      {/* The action area sits at the bottom of the card (margin-top: auto), so buttons line
                          up across a row whatever the length of each card's model list. */}
                      <div className="sk-prov-foot">
                        {connected && key ? (
                          <>
                            <dl className="st-kv is-tight">
                              <div><dt>Added</dt><dd>{day(key.createdAt)}</dd></div>
                              {key.lastValidated && <div><dt>Validated</dt><dd>{day(key.lastValidated)}</dd></div>}
                            </dl>
                            <div className="sk-prov-act">
                              <button type="button" className="st-btn is-sm" onClick={() => handleValidateKey(key.id)}>Validate</button>
                              <button type="button" className="st-btn is-sm is-danger" onClick={() => handleDeleteKey(key.id)}>Remove</button>
                            </div>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="st-btn is-block"
                            onClick={() => { setSelectedProvider(prov.id); setShowAddModal(true); setValidationResult(null); }}
                          >
                            Add {prov.name} key
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Pane>

          {/* Keys for providers we no longer route to */}
          {retiredKeys.length > 0 && (
            <Pane title="Retired providers" ruled flush className="sk-retired">
              <div className="st-rows">
                {retiredKeys.map((key) => (
                  <div key={key.id} className="st-row">
                    <ProviderMark provider={key.provider} />
                    <div className="st-row-main">
                      <div className="st-row-t">{RETIRED_NAMES[key.provider] ?? key.provider}</div>
                      <p className="sk-row-text">
                        {RETIRED_PROVIDERS[key.provider] ?? 'This provider is no longer part of the routing pool.'}
                      </p>
                    </div>
                    <div className="st-row-end">
                      <button type="button" className="st-btn is-sm is-danger" onClick={() => handleDeleteKey(key.id)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </Pane>
          )}

          <Note tone="good" title="Your keys are secure">
            All provider API keys are encrypted using AES-256-GCM before being stored. We never log or expose your keys.
            You can remove them at any time.
          </Note>
        </div>

        {/* Add a provider key, then check it with the provider before routing uses it. */}
        <Modal
          open={showAddModal && !!selectedProvider && !!selectedProviderInfo}
          onClose={closeAdd}
          size="narrow"
          title={selectedProviderInfo ? (
            <span className="sk-mtitle"><ProviderMark provider={selectedProviderInfo.id} />Add {selectedProviderInfo.name} key</span>
          ) : ''}
          footer={
            <>
              <button type="button" className="st-btn" onClick={resetAdd} disabled={isValidating}>
                {validationResult?.success ? 'Done' : 'Cancel'}
              </button>
              {!validationResult?.success && (
                <button type="button" className="st-btn is-primary" onClick={handleSaveKey} disabled={!apiKey.trim() || isValidating}>
                  {isValidating ? 'Validating…' : 'Add & validate key'}
                </button>
              )}
            </>
          }
        >
          {selectedProviderInfo && (
            <div className="sk-about">
              {validationResult && (
                <Note tone={validationResult.success ? 'good' : 'bad'} title={validationResult.success ? 'Key validated' : 'Validation failed'}>
                  {validationResult.message}
                  {validationResult.models && validationResult.models.length > 0 && (
                    <div className="st-faint">{validationResult.models.length} models available</div>
                  )}
                </Note>
              )}
              <div className="st-field">
                <label className="st-field-label" htmlFor="sk-provider-key">API key</label>
                <input
                  ref={keyField}
                  id="sk-provider-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={selectedProviderInfo.keyFormat}
                  className="st-input is-code sk-field-16"
                  disabled={isValidating || (validationResult?.success ?? false)}
                />
                <p className="st-hint">Your API key will be encrypted and stored securely</p>
              </div>
              <Note title="Where to find your key">
                <span className="sk-where">
                  <a href={`https://${selectedProviderInfo.docsUrl}`} target="_blank" rel="noopener noreferrer">{selectedProviderInfo.docsUrl}</a>
                </span>
              </Note>
            </div>
          )}
        </Modal>
      </SubscriptionGuard>
    </RouterLayout>
  );
}
