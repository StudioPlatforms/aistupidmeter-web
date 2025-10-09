'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import PixelIcon from '@/components/PixelIcon';
import { apiClient } from '@/lib/api-client';
import type { UniversalKey } from '@/lib/api-client';

export default function RouterKeysPage() {
  const { data: session, status } = useSession();
  const [keys, setKeys] = useState<UniversalKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      apiClient.setUserId(session.user.id);
      fetchKeys();
    } else if (status === 'unauthenticated') {
      setError('User authentication required');
      setLoading(false);
    }
  }, [status, session]);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getUniversalKeys();
      setKeys(response.keys);
    } catch (err) {
      console.error('Failed to fetch keys:', err);
      setError(err instanceof Error ? err.message : 'Failed to load keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;

    try {
      setCreating(true);
      const response = await apiClient.createUniversalKey(newKeyName.trim());
      setCreatedKey(response.key);
      
      await fetchKeys();
    } catch (err) {
      console.error('Failed to create key:', err);
      alert(`Failed to create key: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: number) => {
    if (!confirm('Are you sure you want to revoke this key? This action cannot be undone.')) {
      return;
    }

    try {
      await apiClient.revokeUniversalKey(keyId);
      await fetchKeys();
      alert('Key revoked successfully');
    } catch (err) {
      console.error('Failed to revoke key:', err);
      alert(`Failed to revoke key: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    const button = document.activeElement as HTMLButtonElement;
    const originalText = button.textContent;
    button.textContent = 'COPIED!';
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);
  };

  const activeKeysCount = keys.filter(k => !k.revoked).length;

  return (
    <RouterLayout>
      <SubscriptionGuard feature="API Keys">
      <div className="vintage-container">
        {/* Header */}
      <div className="crt-monitor">
        <div className="terminal-text">
          <div style={{ fontSize: '1.5em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <PixelIcon name="key" size={28} className="terminal-text--green" />
            <span className="terminal-text--green">UNIVERSAL API KEYS</span>
            <span className="blinking-cursor"></span>
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '16px' }}>
            Manage your universal API keys for accessing the AI Router
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="vintage-btn vintage-btn--active"
          >
            + CREATE NEW KEY
          </button>
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
            <button onClick={fetchKeys} className="vintage-btn vintage-btn--danger">
              RETRY
            </button>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="crt-monitor" style={{ borderColor: 'var(--amber-warning)', backgroundColor: 'rgba(255, 176, 0, 0.05)' }}>
        <div className="terminal-text">
          <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PixelIcon name="info" size={20} />
            ABOUT UNIVERSAL API KEYS
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.85em', lineHeight: '1.6' }}>
            Universal API keys allow you to access the AI Router from any application. 
            Use these keys in place of your provider-specific keys to automatically route 
            requests to the best-performing model based on real-time benchmarks.
          </div>
        </div>
      </div>

      {/* Keys List */}
      <div className="crt-monitor">
        <div className="terminal-text" style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '1.2em', marginBottom: '12px' }}>
            <span className="terminal-text--green">
              {loading ? 'LOADING...' : `YOUR API KEYS (${activeKeysCount} ACTIVE)`}
            </span>
          </div>
        </div>
        
        {loading ? (
          <div className="terminal-text" style={{ textAlign: 'center', padding: '24px' }}>
            <div className="terminal-text--amber">
              LOADING KEYS<span className="vintage-loading"></span>
            </div>
          </div>
        ) : keys.length === 0 ? (
          <div className="printer-paper" style={{ textAlign: 'center', padding: '24px' }}>
            <div className="dot-matrix-text">
              ═══ NO API KEYS ═══<br/>
              <br/>
              CREATE YOUR FIRST KEY<br/>
              TO GET STARTED
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {keys.map((key) => (
              <div key={key.id} className="control-panel">
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
                      {key.name}
                    </span>
                    {key.revoked ? (
                      <span style={{
                        backgroundColor: 'var(--red-alert)',
                        color: 'var(--terminal-black)',
                        fontSize: '0.7em',
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        borderRadius: '2px'
                      }}>
                        REVOKED
                      </span>
                    ) : (
                      <span style={{
                        backgroundColor: 'var(--phosphor-green)',
                        color: 'var(--terminal-black)',
                        fontSize: '0.7em',
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        borderRadius: '2px'
                      }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.8em', fontFamily: 'var(--font-mono)' }}>
                    KEY: {key.keyPrefix}...<br/>
                    CREATED: {new Date(key.createdAt).toLocaleDateString()}<br/>
                    {key.lastUsedAt && `LAST USED: ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                  </div>
                </div>
                {!key.revoked && (
                  <button
                    onClick={() => handleRevokeKey(key.id)}
                    className="vintage-btn vintage-btn--danger"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    REVOKE
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Best Practices */}
      <div className="crt-monitor" style={{ borderColor: 'var(--amber-warning)', backgroundColor: 'rgba(255, 176, 0, 0.05)' }}>
        <div className="terminal-text">
          <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PixelIcon name="warning" size={20} />
            SECURITY BEST PRACTICES
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.85em', lineHeight: '1.6' }}>
            <div style={{ marginBottom: '6px' }}>
              <span className="terminal-text--green">[1]</span> Never share your API keys publicly or commit them to version control
            </div>
            <div style={{ marginBottom: '6px' }}>
              <span className="terminal-text--green">[2]</span> Store keys securely using environment variables or secret management tools
            </div>
            <div style={{ marginBottom: '6px' }}>
              <span className="terminal-text--green">[3]</span> Revoke keys immediately if you suspect they have been compromised
            </div>
            <div>
              <span className="terminal-text--green">[4]</span> Use different keys for different applications or environments
            </div>
          </div>
        </div>
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
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
          <div className="crt-monitor" style={{ maxWidth: '800px', width: '100%' }}>
            <div className="terminal-text">
              <div style={{ fontSize: '1.3em', marginBottom: '16px' }}>
                <span className="terminal-text--green">CREATE NEW API KEY</span>
                <span className="blinking-cursor"></span>
              </div>
              
              {!createdKey ? (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '8px' }}>
                      KEY NAME:
                    </div>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., My MacBook, Production Server"
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
                      disabled={creating}
                    />
                    <div className="terminal-text--dim" style={{ fontSize: '0.75em', marginTop: '4px' }}>
                      Give your key a descriptive name to help you identify it later
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        setNewKeyName('');
                      }}
                      disabled={creating}
                      className="vintage-btn"
                    >
                      CANCEL
                    </button>
                    <button
                      onClick={handleCreateKey}
                      disabled={!newKeyName.trim() || creating}
                      className="vintage-btn vintage-btn--active"
                    >
                      {creating ? 'CREATING...' : 'CREATE KEY'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="crt-monitor" style={{ 
                    borderColor: 'var(--phosphor-green)', 
                    backgroundColor: 'rgba(0, 255, 65, 0.05)',
                    marginBottom: '16px'
                  }}>
                    <div className="terminal-text">
                      <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PixelIcon name="check" size={20} />
                        KEY CREATED SUCCESSFULLY!
                      </div>
                      <div className="terminal-text--dim" style={{ fontSize: '0.8em' }}>
                        Make sure to copy your key now. You won't be able to see it again!
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '8px' }}>
                      YOUR API KEY:
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={createdKey}
                        readOnly
                        style={{
                          flex: 1,
                          padding: '8px',
                          background: 'var(--terminal-black)',
                          border: '2px solid var(--phosphor-green)',
                          borderRadius: '4px',
                          color: 'var(--phosphor-green)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px'
                        }}
                      />
                      <button
                        onClick={() => handleCopyKey(createdKey)}
                        className="vintage-btn"
                      >
                        COPY
                      </button>
                    </div>
                  </div>
                  
                  <div className="crt-monitor" style={{ 
                    borderColor: 'var(--amber-warning)', 
                    backgroundColor: 'rgba(255, 176, 0, 0.05)',
                    marginBottom: '16px'
                  }}>
                    <div className="terminal-text">
                      <div className="terminal-text--amber" style={{ fontSize: '0.85em', lineHeight: '1.5' }}>
                        <strong>IMPORTANT:</strong> Store this key securely. For security reasons, 
                        we cannot show it to you again. If you lose this key, you'll need to create a new one.
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        setCreatedKey(null);
                        setNewKeyName('');
                      }}
                      className="vintage-btn vintage-btn--active"
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
      </div>
      </SubscriptionGuard>
    </RouterLayout>
  );
}
