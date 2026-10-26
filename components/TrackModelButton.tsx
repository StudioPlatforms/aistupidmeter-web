'use client';

/**
 * "Track this model" — the activation event.
 *
 * The strategy measures retail activation as "a watchlist saved and a relevant
 * return visit within seven days", so this button is the single most important
 * conversion control on the site. It has to work for a signed-out visitor too:
 * clicking it sends them to sign-up with the intent preserved, rather than
 * silently doing nothing.
 *
 * The plan limit is enforced by the API, not here. This component only decides
 * what to *show*; POST /account/watchlist re-checks and returns
 * `watchlist_limit_reached` regardless of what the browser believes.
 *
 * Styled for the studio look (`.st` — the model page's hero): the primary button until the
 * model is tracked, then a quiet "Tracking" state that untracks on click.
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { withReturn } from '../lib/return-path';

interface Props {
  modelId: number | string;
  modelName?: string;
  /**
   * The model page's canonical slug. A signed-out click goes to sign-up with
   * callbackUrl=/models/<slug>?track=1, and ModelDetailClient completes the intent on return;
   * without it the numeric id is used (it 308s to the slug).
   */
  slug?: string;
  /** Set by the page once it has added the model itself (the ?track=1 round trip), so the button shows "Tracking" at once. */
  knownTracked?: boolean;
  /** Compact form for dense layouts. */
  small?: boolean;
}

type State = 'loading' | 'untracked' | 'tracked' | 'signed-out';

export default function TrackModelButton({ modelId, modelName, slug, knownTracked = false, small = false }: Props) {
  const { status } = useSession();
  const router = useRouter();
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') { setState('signed-out'); return; }
    if (status !== 'authenticated') return;

    let cancelled = false;
    fetch('/api/account/watchlist', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const tracked = d?.success &&
          Array.isArray(d.data?.models) &&
          d.data.models.some((m: any) => String(m.modelId) === String(modelId));
        setState(tracked ? 'tracked' : 'untracked');
      })
      .catch(() => { if (!cancelled) setState('untracked'); });
    return () => { cancelled = true; };
  }, [status, modelId]);

  // The page completed a ?track=1 intent on the visitor's behalf: reflect it without waiting for
  // the next reconcile (the watchlist GET above may have answered before that POST landed).
  useEffect(() => {
    if (knownTracked) setState('tracked');
  }, [knownTracked]);

  const toggle = async () => {
    if (state === 'signed-out') {
      // Preserve the intent through sign-up: the visitor lands back on this page with ?track=1
      // and ModelDetailClient adds the model, so the click is not lost in the round trip.
      router.push(withReturn('/auth/signup', `/models/${slug ?? modelId}?track=1`));
      return;
    }
    setBusy(true);
    setLimitMsg(null);
    try {
      if (state === 'tracked') {
        const r = await fetch(`/api/account/watchlist/${modelId}`, { method: 'DELETE' });
        if (r.ok) setState('untracked');
      } else {
        const r = await fetch('/api/account/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelId: Number(modelId) }),
        });
        const d = await r.json();
        if (d?.success) setState('tracked');
        else if (d?.error === 'watchlist_limit_reached') setLimitMsg(d.message);
      }
    } catch {
      /* leave state unchanged; the next load reconciles */
    } finally {
      setBusy(false);
    }
  };

  // Hold the button's place while the watchlist loads, so the actions around it do not jump.
  if (state === 'loading') {
    return (
      <span className="sm-track">
        <span className={`st-skel sm-track-skel${small ? ' is-sm' : ''}`} aria-hidden="true" />
      </span>
    );
  }

  const tracked = state === 'tracked';

  return (
    <span className="sm-track">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-busy={busy || undefined}
        aria-pressed={state === 'signed-out' ? undefined : tracked}
        title={
          tracked
            ? `Stop tracking ${modelName ?? 'this model'}`
            : `Get notified when ${modelName ?? 'this model'} changes`
        }
        className={`st-btn${tracked ? '' : ' is-primary'}${small ? ' is-sm' : ''}`}
        data-cta={state === 'signed-out' ? 'model-hero-track-signup' : tracked ? 'model-hero-untrack' : 'model-hero-track'}
      >
        {tracked && <span className="sm-track-dot" aria-hidden="true" />}
        {busy ? (tracked ? 'Updating…' : 'Adding…') : tracked ? 'Tracking' : 'Track this model'}
      </button>

      {limitMsg && (
        <p className="sm-track-msg" role="alert">
          {limitMsg}{' '}
          <a href="/pricing">See plans →</a>
        </p>
      )}
    </span>
  );
}
