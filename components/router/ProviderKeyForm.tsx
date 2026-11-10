'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiClient } from '@/lib/api-client';
import type { KeyVerdict } from '@/lib/api-client';
import { ROUTER_PROVIDERS, routerProvider, type RoutableProvider } from '@/lib/router-providers';
import { Note, ProviderMark } from '@/components/studio';

export interface SavedProviderKey {
  provider: RoutableProvider;
  verdict: KeyVerdict;
  /** What the provider said, in a sentence (the API's key check). */
  message: string;
  /** Providers the account now has a working key for. */
  providers?: string[];
  replaced?: boolean;
}

/**
 * Add a provider key, or replace one: the provider is asked before anything is saved
 * (POST /router/provider-keys runs the API's key check), so a key that comes back "saved" is one
 * the router can use, and a refused key never reaches the account. Used on the provider keys page
 * and as the first step of creating a router key.
 */
export default function ProviderKeyForm({
  provider, replace = false, connected = [], onSaved, onCancel, autoFocus = true,
}: {
  /** A fixed provider; leave out to let the person choose. */
  provider?: RoutableProvider | null;
  /** Replace the key already saved for this provider. */
  replace?: boolean;
  /** Providers that already have a key (marked in the picker; choosing one replaces its key). */
  connected?: string[];
  onSaved: (saved: SavedProviderKey) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [picked, setPicked] = useState<RoutableProvider | null>(provider ?? null);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const info = picked ? routerProvider(picked) : undefined;
  const replacing = replace || (!!picked && connected.includes(picked));

  useEffect(() => { setPicked(provider ?? null); }, [provider]);
  // A dialog focuses itself as it opens; the caret goes to the key field after it.
  useEffect(() => {
    if (!autoFocus || !info) return;
    const raf = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [autoFocus, info]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!picked || !apiKey.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiClient.addProviderKey(picked, apiKey.trim(), replacing);
      setApiKey('');
      onSaved({ provider: picked, verdict: r.verdict ?? 'valid', message: r.message, providers: r.providers, replaced: r.replaced });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The key could not be saved. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="pk-form" onSubmit={submit} autoComplete="off">
      {!provider && (
        <fieldset className="pk-pick">
          <legend className="st-field-label">Which provider is the key for?</legend>
          <div className="pk-pick-list">
            {ROUTER_PROVIDERS.map(p => (
              <button
                type="button"
                key={p.id}
                className={`pk-pick-item${picked === p.id ? ' is-on' : ''}`}
                aria-pressed={picked === p.id}
                onClick={() => { setPicked(p.id); setError(null); }}
                disabled={busy}
              >
                <ProviderMark provider={p.id} size="sm" />
                <span className="pk-pick-name">{p.name}{p.maker !== p.name && <small>{p.maker}</small>}</span>
                {connected.includes(p.id) && <span className="pk-pick-have">Has a key</span>}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {info ? (
        <>
          <div className="st-field">
            <label className="st-field-label" htmlFor="pk-key">{replacing ? `New ${info.name} API key` : `${info.name} API key`}</label>
            <input
              ref={field}
              id="pk-key"
              type="password"
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); if (error) setError(null); }}
              placeholder={info.keyFormat}
              className="st-input is-code sk-field-16"
              autoComplete="new-password"
              spellCheck={false}
              disabled={busy}
            />
            <p className="st-hint">
              Create one at{' '}
              <a href={`https://${info.keyUrl}`} target="_blank" rel="noopener noreferrer">{info.keyUrl}</a>.
              {' '}We check it with {info.name} before saving it, encrypt it, and use it only to call {info.name} for you.
              {' '}{info.name} bills you directly, at its own list price.
              {replacing && ' The key saved now replaces the old one straight away.'}
            </p>
          </div>
          {error && <Note tone="bad" title="Not saved">{error}</Note>}
        </>
      ) : (
        <p className="st-hint">Pick the provider you have an account with. You can add more later; the router chooses among all of them.</p>
      )}

      <div className="pk-actions">
        {onCancel && <button type="button" className="st-btn" onClick={onCancel} disabled={busy}>Cancel</button>}
        <button type="submit" className="st-btn is-primary" disabled={!info || !apiKey.trim() || busy}>
          {busy && info ? `Checking with ${info.name}…` : replacing ? 'Check and replace key' : 'Check and save key'}
        </button>
      </div>
    </form>
  );
}

/** The sentence and tone for a saved key, by what the provider said about it. */
export function savedKeyNote(s: SavedProviderKey): { tone: 'good' | 'warn'; title: string } {
  const name = routerProvider(s.provider)?.name ?? s.provider;
  if (s.verdict === 'no_credit') return { tone: 'warn', title: `${name} key saved, but the account has no credit` };
  if (s.verdict === 'unverified') return { tone: 'warn', title: `${name} key saved, not yet confirmed` };
  return { tone: 'good', title: s.replaced ? `${name} key replaced` : `${name} key saved` };
}
