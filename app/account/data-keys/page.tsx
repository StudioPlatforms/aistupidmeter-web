'use client';

/**
 * Data API key management.
 *
 * Deliberately NOT wrapped in SubscriptionGuard: the free tier is the whole
 * point of this page. Third parties were reading the open endpoints for months
 * because the site advertised them as free, so the migration path has to be
 * something they can complete in thirty seconds without reaching for a card.
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import { apiClient } from '@/lib/api-client';
import type { DataApiKey, DataApiTier } from '@/lib/api-client';
import EnterpriseContact from '@/components/EnterpriseContact';

export default function DataKeysPage() {
  const { data: session, status } = useSession();
  const [keys, setKeys] = useState<DataApiKey[]>([]);
  const [tiers, setTiers] = useState<Record<string, DataApiTier>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyUrl, setNewKeyUrl] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      apiClient.setUserId(session.user.id);
      fetchKeys();
    } else if (status === 'unauthenticated') {
      setError('Sign in to create a Data API key.');
      setLoading(false);
    }
  }, [status, session]);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getDataKeys();
      setKeys(response.keys || []);
      setTiers(response.tiers || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    try {
      setCreating(true);
      const response = await apiClient.createDataKey(newKeyName.trim(), newKeyUrl.trim() || undefined);
      setCreatedKey(response.key);
      await fetchKeys();
    } catch (err) {
      alert(`Failed to create key: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: number) => {
    if (!confirm('Revoke this key? Anything using it will start getting 401s within a minute.')) return;
    try {
      await apiClient.revokeDataKey(keyId);
      await fetchKeys();
    } catch (err) {
      alert(`Failed to revoke key: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* clipboard unavailable */ }
  };

  const usedToday = keys.reduce((sum, k) => sum + (k.usedToday || 0), 0);
  const dailyLimit = keys.length > 0 ? Math.max(...keys.map(k => k.dailyLimit || 0)) : (tiers.free?.daily ?? 1000);
  const currentTier = keys[0]?.tier || 'free';

  return (
    <RouterLayout>
      <div className="rv4-page-header">
        <div className="rv4-page-header-left">
          <span style={{ fontSize: '18px' }}>📊</span>
          <div>
            <div className="rv4-page-title">DATA API KEYS<span className="blinking-cursor"></span></div>
            <div className="rv4-page-title-sub">Free programmatic access to live benchmark data</div>
          </div>
        </div>
        <div className="rv4-page-header-right">
          <a href="/api-docs" className="rv4-ctrl-btn" style={{ textDecoration: 'none' }}>API DOCS →</a>
          <button onClick={() => setShowCreateModal(true)} className="rv4-ctrl-btn primary">+ CREATE KEY</button>
        </div>
      </div>

      <div className="rv4-body">
        {error && (
          <div className="rv4-error-banner" style={{ marginBottom: '14px' }}>
            <span>⚠</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>ERROR</div>
              <div style={{ fontSize: '10px' }}>{error}</div>
            </div>
            <button onClick={fetchKeys} className="rv4-ctrl-btn danger" style={{ marginLeft: 'auto', fontSize: '10px' }}>RETRY</button>
          </div>
        )}

        <div className="rv4-info-banner green" style={{ marginBottom: '14px' }}>
          <span className="rv4-info-banner-icon">ℹ</span>
          <div className="rv4-info-banner-content">
            <div className="rv4-info-banner-title">WHAT THIS KEY IS FOR</div>
            <div className="rv4-info-banner-text">
              A Data API key (<code style={codeStyle}>asl_live_…</code>) unlocks{' '}
              <code style={codeStyle}>/api/v1/*</code> — model rankings, the global index, degradation
              alerts, drift signatures and provider reliability, as JSON. It is read-only and free.
              It is <strong>not</strong> an{' '}
              <a href="/router/keys" style={{ color: 'var(--phosphor-green)', fontWeight: 'bold' }}>SR key</a>{' '}
              (<code style={codeStyle}>aism_</code>) — those run live inference through your connected
              providers and can spend money. Separate on purpose, so a leaked read key can never touch
              your provider accounts.
            </div>
          </div>
        </div>

        <div className="rv4-stat-bar cols-4" style={{ borderRadius: '3px', marginBottom: '14px' }}>
          <div className="rv4-stat-cell accent-green">
            <div className="rv4-stat-label">Active Keys</div>
            <div className="rv4-stat-value">{loading ? '...' : String(keys.length)}</div>
          </div>
          <div className="rv4-stat-cell accent-blue">
            <div className="rv4-stat-label">Requests Today</div>
            <div className="rv4-stat-value blue">{loading ? '...' : usedToday.toLocaleString()}</div>
          </div>
          <div className="rv4-stat-cell accent-amber">
            <div className="rv4-stat-label">Daily Limit</div>
            <div className="rv4-stat-value amber">{loading ? '...' : dailyLimit.toLocaleString()}</div>
          </div>
          <div className="rv4-stat-cell accent-green">
            <div className="rv4-stat-label">Tier</div>
            <div className="rv4-stat-value" style={{ fontSize: '12px' }}>
              {loading ? '...' : (tiers[currentTier]?.label || 'Free').toUpperCase()}
            </div>
          </div>
        </div>

        {/* Keys list */}
        <div className="rv4-panel" style={{ marginBottom: '14px' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">🔑 YOUR DATA KEYS ({loading ? '...' : `${keys.length} ACTIVE`})</span>
          </div>
          <div className="rv4-panel-body" style={{ padding: 0 }}>
            {loading ? (
              <div className="rv4-loading" style={{ padding: '32px' }}>
                <div className="rv4-loading-dot" /><div className="rv4-loading-dot" /><div className="rv4-loading-dot" />
                <span>LOADING KEYS</span>
              </div>
            ) : keys.length === 0 ? (
              <div className="rv4-empty" style={{ padding: '40px' }}>
                <div className="rv4-empty-icon">📊</div>
                <div className="rv4-empty-title">No Data API Keys</div>
                <div className="rv4-empty-text">
                  Create one to read benchmark data from your own app, dashboard or status bar.
                </div>
                <button onClick={() => setShowCreateModal(true)} className="rv4-ctrl-btn primary" style={{ marginTop: '10px' }}>
                  + CREATE FIRST KEY
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {keys.map((key) => {
                  const pct = key.dailyLimit > 0 ? Math.min(100, (key.usedToday / key.dailyLimit) * 100) : 0;
                  const barColor = pct > 90 ? 'var(--error-red)' : pct > 70 ? 'var(--amber-warning)' : 'var(--phosphor-green)';
                  return (
                    <div key={key.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: '12px', padding: '12px 14px',
                      background: 'rgba(0,0,0,0.2)',
                      borderLeft: '3px solid rgba(26, 115, 232,0.2)',
                      flexWrap: 'wrap',
                    }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--phosphor-green)' }}>{key.name}</span>
                          <span className="rv4-badge green">{(tiers[key.tier]?.label || key.tier).toUpperCase()}</span>
                          {key.appUrl && (
                            <span style={{ fontSize: '9px', color: 'var(--phosphor-dim)' }}>→ {key.appUrl}</span>
                          )}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>
                          <span>{key.keyPrefix}…</span>
                          {key.createdAt && <span style={{ marginLeft: '12px' }}>CREATED: {new Date(key.createdAt).toLocaleDateString()}</span>}
                          <span style={{ marginLeft: '12px' }}>TOTAL: {(key.totalRequests || 0).toLocaleString()}</span>
                        </div>
                        {/* Daily quota bar */}
                        <div style={{ maxWidth: '360px' }}>
                          <div style={{
                            height: '4px', borderRadius: '2px', overflow: 'hidden',
                            background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
                          }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: barColor, transition: 'width .3s ease' }} />
                          </div>
                          <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                            {key.usedToday.toLocaleString()} / {key.dailyLimit.toLocaleString()} requests today · resets 00:00 UTC
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => handleRevoke(key.id)} className="rv4-ctrl-btn danger" style={{ fontSize: '10px' }}>
                          REVOKE
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick start */}
        <div className="rv4-panel" style={{ marginBottom: '14px' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">⚡ QUICK START</span>
          </div>
          <div className="rv4-panel-body" style={{ padding: '14px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.5 }}>
              Send the key as a bearer token. Every endpoint lives under{' '}
              <code style={codeStyle}>https://aistupidlevel.info/api/v1</code>.
            </div>
            <Snippet
              title="curl"
              code={`curl -H "Authorization: Bearer asl_live_your_key_here" \\\n  "https://aistupidlevel.info/api/v1/models?period=latest&sortBy=combined"`}
              copied={copied} onCopy={copy}
            />
            <Snippet
              title="Python"
              code={`import requests\n\nr = requests.get(\n    "https://aistupidlevel.info/api/v1/models",\n    headers={"Authorization": "Bearer asl_live_your_key_here"},\n    params={"period": "latest", "sortBy": "combined"},\n)\nfor m in r.json()["data"][:5]:\n    print(m["name"], m["currentScore"])`}
              copied={copied} onCopy={copy}
            />
            <Snippet
              title="Node.js"
              code={`const res = await fetch(\n  "https://aistupidlevel.info/api/v1/models?period=latest",\n  { headers: { Authorization: "Bearer asl_live_your_key_here" } }\n);\nconst { data } = await res.json();\nconsole.log(data.slice(0, 5));`}
              copied={copied} onCopy={copy}
            />
            <div style={{ marginTop: '10px' }}>
              <a href="/api-docs" className="rv4-ctrl-btn" style={{ textDecoration: 'none', fontSize: '10px' }}>
                FULL ENDPOINT REFERENCE →
              </a>
            </div>
          </div>
        </div>

        {/* Tiers */}
        {Object.keys(tiers).length > 0 && (
          <div className="rv4-panel" style={{ marginBottom: '14px' }}>
            <div className="rv4-panel-header">
              <span className="rv4-panel-title">📈 RATE LIMITS</span>
            </div>
            <div className="rv4-panel-body" style={{ padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              {Object.entries(tiers).map(([id, t]) => (
                <div key={id} style={{
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
                  borderRadius: '3px', padding: '10px 12px',
                  outline: id === currentTier ? '1px solid var(--phosphor-green)' : 'none',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '11px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {t.label.toUpperCase()}
                    {id === currentTier && <span className="rv4-badge green" style={{ marginLeft: '6px' }}>CURRENT</span>}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {t.daily.toLocaleString()} requests / day
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {t.perMinute.toLocaleString()} requests / minute
                  </div>
                  {id === 'enterprise' && (
                    <div style={{ marginTop: '8px' }}>
                      <EnterpriseContact variant="inline" label="Ask about Enterprise" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding: '0 14px 14px', fontSize: '10px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              Free is an evaluation tier — enough to wire a client up and see real data, not enough
              to poll on a schedule. Anything that refreshes by itself needs Pro. Enterprise is
              arranged by hand rather than bought.
            </div>
          </div>
        )}

        <div className="rv4-info-banner amber">
          <span className="rv4-info-banner-icon">⚠</span>
          <div className="rv4-info-banner-content">
            <div className="rv4-info-banner-title">TERMS OF USE</div>
            <div className="rv4-info-banner-text">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {[
                  'Attribution is required — cite aistupidlevel.info wherever the data is shown.',
                  'Do not republish the data as your own leaderboard or resell it.',
                  'One key per application. Do not share a key across products or users.',
                  'Keys can be revoked without notice if usage looks like a mirror rather than a client.',
                ].map((line, i) => (
                  <div key={i} style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ color: 'var(--phosphor-green)', flexShrink: 0 }}>[{i + 1}]</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <div className="rv4-modal-backdrop" onClick={() => { if (!createdKey) setShowCreateModal(false); }}>
          <div className="rv4-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rv4-modal-header">
              <span className="rv4-modal-title">📊 {createdKey ? 'KEY CREATED' : 'CREATE DATA API KEY'}</span>
              <button
                className="rv4-modal-close"
                onClick={() => { setShowCreateModal(false); setCreatedKey(null); setNewKeyName(''); setNewKeyUrl(''); }}
              >✕ CLOSE</button>
            </div>
            <div className="rv4-modal-body">
              {!createdKey ? (
                <>
                  <div className="rv4-form-group">
                    <label className="rv4-input-label">KEY NAME *</label>
                    <input
                      type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g. My status bar widget" className="rv4-input" maxLength={60} autoFocus
                    />
                  </div>
                  <div className="rv4-form-group">
                    <label className="rv4-input-label">WHERE WILL YOU USE IT? (OPTIONAL)</label>
                    <input
                      type="text" value={newKeyUrl} onChange={(e) => setNewKeyUrl(e.target.value)}
                      placeholder="https://your-app.example" className="rv4-input" maxLength={200}
                    />
                    <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                      Helps us reach you before revoking a key rather than after.
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    <button onClick={() => setShowCreateModal(false)} className="rv4-ctrl-btn">CANCEL</button>
                    <button onClick={handleCreate} disabled={!newKeyName.trim() || creating} className="rv4-ctrl-btn primary">
                      {creating ? 'CREATING…' : 'CREATE KEY'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rv4-success-banner" style={{ marginBottom: '14px' }}>
                    <span>✓</span>
                    <div>
                      <strong>KEY CREATED</strong>
                      <div style={{ fontSize: '10px', fontWeight: 'normal', opacity: 0.8, marginTop: '2px' }}>
                        Copy it now — it is stored hashed and cannot be shown again.
                      </div>
                    </div>
                  </div>
                  <div className="rv4-form-group">
                    <label className="rv4-input-label">YOUR DATA API KEY</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input type="text" value={createdKey} readOnly className="rv4-input" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }} />
                      <button onClick={() => copy(createdKey, 'key')} className="rv4-ctrl-btn primary" style={{ flexShrink: 0 }}>
                        {copied === 'key' ? '✓ COPIED' : 'COPY'}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => { setShowCreateModal(false); setCreatedKey(null); setNewKeyName(''); setNewKeyUrl(''); }}
                      className="rv4-ctrl-btn primary"
                    >
                      DONE
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </RouterLayout>
  );
}

const codeStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: '2px',
  fontFamily: 'var(--font-mono)', fontSize: '10px',
};

function Snippet({ title, code, copied, onCopy }: {
  title: string; code: string;
  copied: string | null; onCopy: (text: string, label: string) => void;
}) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</span>
        <button onClick={() => onCopy(code, title)} className="rv4-ctrl-btn" style={{ fontSize: '9px', padding: '2px 8px' }}>
          {copied === title ? '✓ COPIED' : 'COPY'}
        </button>
      </div>
      <pre style={{
        background: 'var(--bg-tertiary)', borderRadius: '3px', padding: '10px 12px',
        fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--phosphor-green)',
        overflowX: 'auto', whiteSpace: 'pre', border: '1px solid var(--border-primary)',
        lineHeight: 1.5, margin: 0,
      }}>{code}</pre>
    </div>
  );
}
