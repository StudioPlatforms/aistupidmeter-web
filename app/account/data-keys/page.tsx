'use client';

/**
 * Data API key management.
 *
 * Deliberately NOT wrapped in SubscriptionGuard: the free tier is the whole
 * point of this page. Third parties were reading the open endpoints for months
 * because the site advertised them as free, so the migration path has to be
 * something they can complete in thirty seconds without reaching for a card.
 *
 * Signed out, the page is a guest view: what the key is for, the free tier's limits from the
 * plan table, the quick start, and sign-up / sign-in that come back here. It used to show an
 * "Error … Retry" note, which read as an outage.
 *
 * Look: the studio shell (styles/studio.css, components/studio) plus styles/studio-team.css.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import { apiClient } from '@/lib/api-client';
import type { DataApiKey, DataApiTier } from '@/lib/api-client';
import { DATA_API_LIMITS } from '@/lib/entitlements';
import EnterpriseContact from '@/components/EnterpriseContact';
import { PageHead, Pane, Stats, Stat, CountUp, CodeBlock, CopyButton, Loader, Empty, Note, Tag } from '@/components/studio';
import '@/styles/studio-team.css';

const ar = <span className="st-ar" aria-hidden="true">→</span>;

const HERE = '/account/data-keys';
const SIGNUP = `/auth/signup?callbackUrl=${encodeURIComponent(HERE)}`;
const SIGNIN = `/auth/signin?callbackUrl=${encodeURIComponent(HERE)}`;

const SAMPLES = [
  {
    label: 'cURL', lang: 'bash' as const,
    code: `curl -H "Authorization: Bearer asl_live_your_key_here" \\\n  "https://aistupidlevel.info/api/v1/models?period=24h&sortBy=combined"`,
  },
  {
    label: 'Python', lang: 'python' as const,
    code: `import requests\n\nr = requests.get(\n    "https://aistupidlevel.info/api/v1/models",\n    headers={"Authorization": "Bearer asl_live_your_key_here"},\n    params={"period": "24h", "sortBy": "combined"},\n)\nfor m in r.json()["data"][:5]:\n    print(m["name"], m["currentScore"])`,
  },
  {
    label: 'Node.js', lang: 'js' as const,
    code: `const res = await fetch(\n  "https://aistupidlevel.info/api/v1/models?period=24h",\n  { headers: { Authorization: "Bearer asl_live_your_key_here" } }\n);\nconst { data } = await res.json();\nconsole.log(data.slice(0, 5));`,
  },
];

const TERMS = [
  'Attribution is required — cite aistupidlevel.info wherever the data is shown.',
  'Do not republish the data as your own leaderboard or resell it.',
  'One key per application. Do not share a key across products or users.',
  'Keys can be revoked without notice if usage looks like a mirror rather than a client.',
];

export default function DataKeysPage() {
  const { data: session, status } = useSession();
  const guest = status === 'unauthenticated';
  const [keys, setKeys] = useState<DataApiKey[]>([]);
  const [tiers, setTiers] = useState<Record<string, DataApiTier>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyUrl, setNewKeyUrl] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      apiClient.setUserId(session.user.id);
      fetchKeys();
    } else if (status === 'unauthenticated') {
      // Signed out: the tiers come from the plan table (the API's copy needs a session).
      setTiers(DATA_API_LIMITS);
      setError(null);
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

  const closeModal = () => { setShowCreateModal(false); setCreatedKey(null); setNewKeyName(''); setNewKeyUrl(''); };

  const usedToday = keys.reduce((sum, k) => sum + (k.usedToday || 0), 0);
  const dailyLimit = keys.length > 0 ? Math.max(...keys.map(k => k.dailyLimit || 0)) : (tiers.free?.daily ?? DATA_API_LIMITS.free.daily);
  const currentTier = keys[0]?.tier || 'free';
  const free = DATA_API_LIMITS.free;

  return (
    <RouterLayout>
      <PageHead
        kicker="Data API"
        title="Data API keys"
        lead="Free programmatic access to live benchmark data."
        actions={guest ? (
          <>
            <a href="/api-docs" className="st-btn">API docs {ar}</a>
            <Link href={SIGNUP} className="st-btn is-primary" data-cta="data-keys-head-signup">Create a free account</Link>
          </>
        ) : (
          <>
            <a href="/api-docs" className="st-btn">API docs {ar}</a>
            <button type="button" onClick={() => setShowCreateModal(true)} className="st-btn is-primary">Create key</button>
          </>
        )}
      />

      <div className="st-body sw-body">
        {error && (
          <div className="st-note is-bad" role="alert">
            <div className="sw-note-row">
              <div><b className="st-note-t">Error</b>{error}</div>
              <button type="button" onClick={fetchKeys} className="st-btn is-sm is-danger">Retry</button>
            </div>
          </div>
        )}

        <Note title="What this key is for">
          A Data API key (<code className="st-ic">asl_live_…</code>) unlocks{' '}
          <code className="st-ic">/api/v1/*</code> — model rankings, the global index, degradation
          alerts, drift signatures and provider reliability, as JSON. It is read-only and free.
          It is <strong>not</strong> an <a href="/router/keys">SR key</a>{' '}
          (<code className="st-ic">aism_</code>) — those run live inference through your connected
          providers and can spend money. Separate on purpose, so a leaked read key can never touch
          your provider accounts.
        </Note>

        {guest ? (
          /* Signed out: the way in, with the free tier's limits from the plan table. */
          <Pane title="Get a key" sub="Free account, no card" ruled flush>
            <div className="sw-pad">
              <Empty
                title="Sign in to create a Data API key"
                actions={<>
                  <Link href={SIGNUP} className="st-btn is-primary" data-cta="data-keys-guest-signup">Create a free account {ar}</Link>
                  <Link href={SIGNIN} className="st-btn" data-cta="data-keys-guest-signin">Sign in</Link>
                </>}
              >
                A free account comes with a read-only key: {free.daily.toLocaleString('en-US')} requests a day
                ({free.perMinute.toLocaleString('en-US')} a minute). Sign-up brings you straight back here.
              </Empty>
            </div>
          </Pane>
        ) : (
          <>
            <Stats columns={4}>
              <Stat value={loading ? '…' : <CountUp value={keys.length} />} label="Active keys" />
              <Stat value={loading ? '…' : <CountUp value={usedToday} />} label="Requests today" sub="Resets 00:00 UTC" />
              <Stat value={loading ? '…' : <CountUp value={dailyLimit} />} label="Daily limit" />
              <Stat value={loading ? '…' : (tiers[currentTier]?.label || 'Free')} label="Tier" tone="accent" />
            </Stats>

            {/* Keys list */}
            <Pane
              title="Your data keys"
              sub={loading ? 'Loading…' : `${keys.length} active`}
              ruled
              flush
            >
              {/* flush stays fixed: a Pane whose class changes after it has faded in loses its reveal. */}
              {loading ? (
                <Loader label="Loading keys" />
              ) : keys.length === 0 ? (
                <div className="sw-pad">
                  <Empty
                    title="No Data API keys yet"
                    actions={<button type="button" onClick={() => setShowCreateModal(true)} className="st-btn is-primary">Create your first key {ar}</button>}
                  >
                    Create one to read benchmark data from your own app, dashboard or status bar.
                  </Empty>
                </div>
              ) : (
                <div className="sw-keys">
                  {keys.map((key) => {
                    const pct = key.dailyLimit > 0 ? Math.min(100, (key.usedToday / key.dailyLimit) * 100) : 0;
                    return (
                      <div key={key.id} className="sw-key">
                        <div className="sw-key-main">
                          <div className="sw-key-line">
                            <span className="sw-t">{key.name}</span>
                            <Tag tone="accent">{tiers[key.tier]?.label || key.tier}</Tag>
                            {key.appUrl && <span className="sw-s sw-key-app">→ {key.appUrl}</span>}
                          </div>
                          <div className="sw-key-meta">
                            <code className="st-ic">{key.keyPrefix}…</code>
                            {key.createdAt && <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>}
                            <span>{(key.totalRequests || 0).toLocaleString()} requests in total</span>
                          </div>
                          {/* Daily quota */}
                          <div className="sw-key-quota">
                            <div className={`st-meter${pct > 90 ? ' is-bad' : pct > 70 ? ' is-warn' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={key.dailyLimit} aria-valuenow={key.usedToday} aria-label="Requests today">
                              <i style={{ width: `${pct}%` }} />
                            </div>
                            <span className="sw-s">
                              <b className="sw-key-used">{key.usedToday.toLocaleString()}</b> / {key.dailyLimit.toLocaleString()} requests today · resets 00:00 UTC
                            </span>
                          </div>
                        </div>
                        <div className="sw-key-end">
                          <button type="button" onClick={() => handleRevoke(key.id)} className="st-btn is-sm is-quiet sw-bad-text">Revoke</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Pane>
          </>
        )}

        {/* Quick start */}
        <Pane
          title="Quick start"
          sub={<>Send the key as a bearer token. Every endpoint lives under <code className="st-ic">https://aistupidlevel.info/api/v1</code>.</>}
          foot={<a href="/api-docs" className="st-more">Full endpoint reference</a>}
          delay={0.04}
        >
          <CodeBlock samples={SAMPLES} />
        </Pane>

        {/* Tiers */}
        {Object.keys(tiers).length > 0 && (
          <Pane
            title="Rate limits"
            delay={0.06}
            foot={<>
              Free is an evaluation tier — enough to wire a client up and see real data, not enough
              to poll on a schedule. Anything that refreshes by itself needs Pro. Enterprise is
              arranged by hand rather than bought.
            </>}
          >
            <div className="st-cards sw-tiers">
              {Object.entries(tiers).map(([id, t]) => (
                <div key={id} className={`st-card sw-tier${!guest && id === currentTier ? ' is-on' : ''}`}>
                  <span className="st-card-t">
                    {t.label}
                    {!guest && id === currentTier && <Tag tone="solid">Current</Tag>}
                  </span>
                  <span className="sw-tier-n"><b>{t.daily.toLocaleString()}</b> requests / day</span>
                  <span className="st-card-d">{t.perMinute.toLocaleString()} requests / minute</span>
                  {id === 'enterprise' && (
                    <span className="sw-ent">
                      <EnterpriseContact variant="inline" label="Contact us" />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Pane>
        )}

        <Note tone="warn" title="Terms of use">
          <ol className="sw-terms">
            {TERMS.map(line => <li key={line}>{line}</li>)}
          </ol>
        </Note>
      </div>

      {/* Create dialog. Own markup rather than <Modal>: once a key is shown, only Done or × may
          close it — a stray click on the backdrop must not throw the key away. */}
      {showCreateModal && !guest && (
        <div className="st-modal-back" onClick={() => { if (!createdKey) setShowCreateModal(false); }}>
          <div className="st-modal is-narrow" role="dialog" aria-modal="true" aria-labelledby="dk-dialog-title" onClick={(e) => e.stopPropagation()}>
            <div className="st-modal-head">
              <div>
                <h2 className="st-modal-title" id="dk-dialog-title">{createdKey ? 'Key created' : 'Create a Data API key'}</h2>
                {!createdKey && <p className="st-modal-sub">Read-only access to /api/v1, free.</p>}
              </div>
              <button type="button" className="st-x" aria-label="Close" onClick={closeModal}>×</button>
            </div>
            <div className="st-modal-body">
              {!createdKey ? (
                <div className="sw-stack">
                  <label className="st-field">
                    <span className="st-field-label">Key name <small>required</small></span>
                    <input
                      type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g. My status bar widget" className="st-input" maxLength={60} autoFocus
                    />
                  </label>
                  <label className="st-field">
                    <span className="st-field-label">Where will you use it? <small>optional</small></span>
                    <input
                      type="text" value={newKeyUrl} onChange={(e) => setNewKeyUrl(e.target.value)}
                      placeholder="https://your-app.example" className="st-input" maxLength={200}
                    />
                    <span className="st-hint">Helps us reach you before revoking a key rather than after.</span>
                  </label>
                </div>
              ) : (
                <div className="sw-stack">
                  <div className="st-note is-good">
                    <div><b className="st-note-t">Copy it now</b>It is stored hashed and cannot be shown again.</div>
                  </div>
                  <div className="st-field">
                    <span className="st-field-label">Your Data API key</span>
                    <div className="st-secret"><code>{createdKey}</code><CopyButton text={createdKey} /></div>
                  </div>
                </div>
              )}
            </div>
            <div className="st-modal-foot">
              {!createdKey ? (
                <>
                  <button type="button" onClick={() => setShowCreateModal(false)} className="st-btn">Cancel</button>
                  <button type="button" onClick={handleCreate} disabled={!newKeyName.trim() || creating} className="st-btn is-primary">
                    {creating ? 'Creating…' : 'Create key'}
                  </button>
                </>
              ) : (
                <button type="button" onClick={closeModal} className="st-btn is-primary">Done</button>
              )}
            </div>
          </div>
        </div>
      )}
    </RouterLayout>
  );
}
