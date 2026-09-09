'use client';

/**
 * The watchlist view.
 *
 * Shows coverage, not just scores. A model that has not been measured for eight
 * weeks is displayed as exactly that, rather than quietly presenting a stale
 * number as current — the same correction the digest job needed.
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface WatchedModel {
  modelId: number;
  name: string;
  vendor: string | null;
  score: number | null;
  scoredAt: string | null;
  addedAt: string;
}

interface Payload {
  plan: string;
  limit: number | null;
  used: number;
  models: WatchedModel[];
}

const daysAgo = (iso: string | null): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86_400_000);
};

export default function WatchlistClient() {
  const { status } = useSession();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch('/api/account/watchlist', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d?.success) { setData(d.data); setError(null); }
        else setError(d?.message || d?.error || 'Could not load your watchlist');
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (status === 'authenticated') load();
    else if (status === 'unauthenticated') setLoading(false);
  }, [status]);

  const remove = async (modelId: number) => {
    await fetch(`/api/account/watchlist/${modelId}`, { method: 'DELETE' });
    load();
  };

  if (status === 'unauthenticated') {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.4em', marginBottom: 12 }}>Track the models you depend on</h1>
        <p style={{ color: 'var(--phosphor-dim)', lineHeight: 1.6, marginBottom: 24 }}>
          Pick the models your product actually uses and we will tell you when their
          measured performance changes — and, just as usefully, when it does not.
          Three models on the free plan.
        </p>
        <Link href="/auth/signup" className="vintage-btn" style={{ padding: '12px 24px', textDecoration: 'none' }}>
          Create a free account →
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--phosphor-dim)' }}>Loading…</div>;
  }
  if (error) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--amber-warning)' }}>{error}</div>;
  }

  const models = data?.models ?? [];
  const hasStale = models.some(m => { const a = daysAgo(m.scoredAt); return a !== null && a > 7; });

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: '1.4em', margin: 0 }}>Your watchlist</h1>
        <div style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)' }}>
          {data?.used ?? 0}{data?.limit ? ` of ${data.limit}` : ''} tracked
          {data?.limit && (data.used ?? 0) >= data.limit ? (
            <> · <Link href="/pricing" style={{ color: 'var(--phosphor-green)' }}>track more →</Link></>
          ) : null}
        </div>
      </div>

      {models.length === 0 ? (
        <div style={{ marginTop: 28, padding: 24, textAlign: 'center', color: 'var(--phosphor-dim)', lineHeight: 1.6 }}>
          <p>You are not tracking anything yet.</p>
          <p style={{ fontSize: '0.9em' }}>
            Open any model and choose <strong>Track this model</strong>, or start from the{' '}
            <Link href="/" style={{ color: 'var(--phosphor-green)' }}>leaderboard</Link>.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--phosphor-dim)' }}>
                <th style={{ padding: '8px 10px 8px 0' }}>Model</th>
                <th style={{ padding: '8px 10px' }}>Score</th>
                <th style={{ padding: '8px 10px' }}>Last measured</th>
                <th style={{ padding: '8px 0 8px 10px' }}></th>
              </tr>
            </thead>
            <tbody>
              {models.map(m => {
                const age = daysAgo(m.scoredAt);
                const stale = age !== null && age > 7;
                return (
                  <tr key={m.modelId} style={{ borderTop: '1px solid var(--border-subtle, #2a2a2a)' }}>
                    <td style={{ padding: '10px 10px 10px 0', fontWeight: 600 }}>
                      <Link href={`/models/${m.modelId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {m.name}
                      </Link>
                      {m.vendor && (
                        <span style={{ color: 'var(--phosphor-dim)', fontWeight: 400 }}> · {m.vendor}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px' }}>{m.score === null ? '—' : m.score.toFixed(1)}</td>
                    <td style={{ padding: '10px', color: stale ? 'var(--amber-warning)' : 'var(--phosphor-dim)' }}>
                      {age === null ? 'never' : age === 0 ? 'today' : `${age}d ago`}
                    </td>
                    <td style={{ padding: '10px 0 10px 10px', textAlign: 'right' }}>
                      <button onClick={() => remove(m.modelId)} className="md-ctrl-btn"
                        style={{ fontSize: '0.85em', padding: '4px 10px' }}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {hasStale && (
            <p style={{ fontSize: '0.8em', color: 'var(--phosphor-dim)', marginTop: 14, lineHeight: 1.55 }}>
              Scores in amber were last measured more than a week ago. We show the
              measurement date rather than presenting an old number as current.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
