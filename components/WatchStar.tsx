'use client';

/**
 * Inline star toggle for a model row.
 *
 * The track control used to exist only on a model's own detail page, so adding a
 * model meant finding it, clicking through, then tracking — two clicks too deep
 * for the single action the whole retention case rests on. This puts it where
 * people actually are: the leaderboard.
 *
 * Sits inside a clickable row, so every handler stops propagation. Clicking the
 * star must never navigate.
 */

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useWatchlist } from './WatchlistProvider';

export default function WatchStar({
  modelId,
  modelName,
  size = 15,
}: { modelId: string | number; modelName?: string; size?: number }) {
  const { status } = useSession();
  const router = useRouter();
  const { isTracked, toggle, ready } = useWatchlist();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const on = isTracked(modelId);

  const click = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (status !== 'authenticated') {
      router.push(`/auth/signup?next=${encodeURIComponent('/watchlist')}`);
      return;
    }
    setBusy(true);
    const problem = await toggle(modelId);
    setBusy(false);
    if (problem) { setErr(problem); setTimeout(() => setErr(null), 4000); }
  };

  // Avoid a flash of "untracked" before the list arrives.
  if (status === 'authenticated' && !ready) {
    return <span style={{ display: 'inline-block', width: size + 6 }} aria-hidden="true" />;
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={click}
        disabled={busy}
        aria-pressed={on}
        title={
          status !== 'authenticated'
            ? `Sign up to track ${modelName ?? 'this model'}`
            : on ? `Stop tracking ${modelName ?? 'this model'}` : `Track ${modelName ?? 'this model'}`
        }
        style={{
          background: 'none', border: 'none', padding: '0 4px', cursor: busy ? 'wait' : 'pointer',
          fontSize: size, lineHeight: 1, color: on ? 'var(--amber-warning, #ffb000)' : 'var(--phosphor-dim)',
          opacity: on ? 1 : 0.55, transition: 'opacity .12s ease, color .12s ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = on ? '1' : '0.55'; }}
      >
        {on ? '★' : '☆'}
      </button>
      {err && (
        <span style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 20, marginTop: 4,
          whiteSpace: 'normal', width: 210, padding: '7px 9px', borderRadius: 4,
          background: 'var(--terminal-black, #fff)', border: '1px solid var(--amber-warning)',
          color: 'var(--amber-warning)', fontSize: 11, lineHeight: 1.4,
        }}>{err}</span>
      )}
    </span>
  );
}
