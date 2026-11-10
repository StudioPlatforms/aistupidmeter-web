'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import RouterLayout from '@/components/RouterLayout';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import { apiClient } from '@/lib/api-client';
import type { ProviderKey, KeyVerdict } from '@/lib/api-client';
import { ROUTER_PROVIDERS, isRoutableProvider, providerList, type RoutableProvider } from '@/lib/router-providers';
import ProviderKeyForm, { savedKeyNote, type SavedProviderKey } from '@/components/router/ProviderKeyForm';
import { PageHead, Pane, Modal, Loader, Note, Tag, Pill, ProviderMark } from '@/components/studio';
import '@/styles/studio-keys.css';

/**
 * Provider keys: the first step of the Smart Router. The router never sells tokens; it calls each
 * model with the account's own provider key, so nothing routes until one is here.
 *
 * Every key is checked with its provider before it is saved (the API's key check, 2026-11-10;
 * before that a mistyped key still showed "Key validated"), and each card says what is known about
 * the key: connected, refused by the provider, or out of credit — the last two from real requests.
 *
 * Each card lists the provider's models that are in the benchmark lineup right now, from
 * /api/models (models.show_in_rankings = 1): the router can only select from those.
 *
 * xAI was removed on 2026-08-08: none of its models are benchmarked any more, so a Grok key could
 * never be selected. Existing xAI keys are still shown below under "retired" so they can be deleted.
 */

/** Providers we used to support. Keys stay visible so users can remove them. */
const RETIRED_PROVIDERS: Record<string, string> = {
  xai: 'No Grok models are in the benchmark lineup, so the router cannot select one. This key is not being used — you can safely remove it.',
};
/** How a retired provider's name is written. */
const RETIRED_NAMES: Record<string, string> = { xai: 'xAI' };

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

type CheckResult = { verdict: KeyVerdict | 'error'; message: string };

export default function RouterProvidersPage() {
  const { data: session, status } = useSession();
  const [providerKeys, setProviderKeys] = useState<ProviderKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The add/replace dialog: which provider, and whether it replaces a saved key.
  const [dialog, setDialog] = useState<{ provider: RoutableProvider; replace: boolean } | null>(null);
  // What the last save said (shown at the top with the next step).
  const [saved, setSaved] = useState<SavedProviderKey | null>(null);
  const [checking, setChecking] = useState<number | null>(null);
  const [checks, setChecks] = useState<Record<number, CheckResult>>({});
  // Active router keys: decides whether the next step is "create your router key".
  const [routerKeys, setRouterKeys] = useState<number | null>(null);
  // Benchmarked models per provider (null until loaded), newest first.
  const [lineup, setLineup] = useState<Record<string, string[]> | null>(null);

  useEffect(() => {
    fetch('/api/models')
      // A failed fetch leaves the lineup unknown (cards show the maker), never "no models".
      .then(r => { if (!r.ok) throw new Error(`models ${r.status}`); return r.json(); })
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
      apiClient.getUniversalKeys().then(r => setRouterKeys(r.keys.filter(k => !k.revoked).length)).catch(() => setRouterKeys(null));
    } else if (status === 'unauthenticated') {
      setError('User authentication required');
      setLoading(false);
    }
  }, [status, session]);

  // ?add=<provider> (from an error message, an email, Preferences or the router key dialog) opens
  // the dialog for that provider once the keys are known.
  useEffect(() => {
    if (loading) return;
    const p = new URLSearchParams(window.location.search).get('add');
    if (!isRoutableProvider(p)) return;
    setDialog({ provider: p, replace: providerKeys.some(k => k.provider === p) });
    const url = new URL(window.location.href);
    url.searchParams.delete('add');
    window.history.replaceState({}, '', url.pathname + url.search);
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const onSaved = async (s: SavedProviderKey) => {
    setSaved(s);
    setDialog(null);
    setChecks({});
    await fetchProviderKeys();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCheck = async (key: ProviderKey) => {
    setChecking(key.id);
    try {
      const r = await apiClient.validateProviderKey(key.id);
      setChecks(c => ({ ...c, [key.id]: { verdict: r.verdict ?? (r.valid ? 'valid' : 'invalid'), message: r.message } }));
      await fetchProviderKeys();
    } catch (err) {
      setChecks(c => ({ ...c, [key.id]: { verdict: 'error', message: err instanceof Error ? err.message : 'The check did not finish. Try again.' } }));
    } finally {
      setChecking(null);
    }
  };

  const handleDeleteKey = async (key: ProviderKey) => {
    const name = ROUTER_PROVIDERS.find(p => p.id === key.provider)?.name ?? RETIRED_NAMES[key.provider] ?? key.provider;
    const others = providerKeys.filter(k => k.isActive && k.id !== key.id && isRoutableProvider(k.provider));
    const consequence = !isRoutableProvider(key.provider)
      ? ''
      : others.length === 0
        ? `\n\nThis is your only provider key: your router keys stop answering until you add another.`
        : `\n\nRequests that name a ${name} model will fail; routing modes such as auto-coding keep using ${providerList(others.map(k => k.provider))}.`;
    if (!confirm(`Remove your ${name} key?${consequence}`)) return;
    try {
      await apiClient.deleteProviderKey(key.id);
      setSaved(null);
      await fetchProviderKeys();
    } catch (err) {
      setError(`Could not remove the key: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const supportedIds = new Set<string>(ROUTER_PROVIDERS.map(p => p.id));
  const keyFor = (id: RoutableProvider) => providerKeys.find(k => k.provider === id);
  const retiredKeys = providerKeys.filter(k => !supportedIds.has(k.provider));
  const working = providerKeys.filter(k => k.isActive && supportedIds.has(k.provider));
  const connectedIds = providerKeys.filter(k => supportedIds.has(k.provider)).map(k => k.provider);
  const dialogInfo = dialog ? ROUTER_PROVIDERS.find(p => p.id === dialog.provider) : undefined;
  const savedTone = saved ? savedKeyNote(saved) : null;

  return (
    <RouterLayout>
      <SubscriptionGuard feature="Provider keys" requires="routing">
        <PageHead
          kicker="Smart Router"
          title="Provider keys"
          lead="The Smart Router calls each model with your own provider key, and the provider bills you directly at its own list price. We never resell tokens. Add at least one key; the router then picks among the models your keys can reach."
          actions={
            <Pill tone={!loading && working.length > 0 ? 'good' : !loading ? 'warn' : undefined}>
              {loading ? '…' : `${working.length} of ${ROUTER_PROVIDERS.length}`} connected
            </Pill>
          }
        />

        <div className="st-body">
          {error && (
            <Note tone="bad" title="Something went wrong">
              {error}
              <div className="sk-note-act">
                <button type="button" className="st-btn is-sm" onClick={fetchProviderKeys}>Retry</button>
              </div>
            </Note>
          )}

          {saved && savedTone && (
            <Note tone={savedTone.tone} title={savedTone.title}>
              {saved.message}
              {working.length > 0 && routerKeys === 0 && (
                <> Next, create your router key: it is the one key you put in your apps, and it now routes through {providerList(working.map(k => k.provider))}.</>
              )}
              {working.length > 0 && !!routerKeys && (
                <> Your router {routerKeys === 1 ? 'key routes' : 'keys route'} through {providerList(working.map(k => k.provider))} now, with no change in your apps.</>
              )}
              <div className="sk-note-act">
                {working.length > 0 && routerKeys === 0 && (
                  <Link href="/router/keys?create=1" className="st-btn is-primary is-sm">Create your router key <span className="st-ar" aria-hidden="true">→</span></Link>
                )}
                {working.length > 0 && !!routerKeys && (
                  <Link href="/router/preferences" className="st-btn is-sm">Choose how it routes</Link>
                )}
                <button type="button" className="st-btn is-sm is-quiet" onClick={() => setSaved(null)}>Dismiss</button>
              </div>
            </Note>
          )}

          {!loading && !error && working.length === 0 && !saved && (
            <Note tone="warn" title="Step 1 of 2: add a provider key">
              Nothing can be routed until there is one: the router calls models with your own key. Pick a provider you have
              an account with below; you can add more later, and the router chooses among all of them.
              {routerKeys ? <> Your {routerKeys === 1 ? 'router key is' : `${routerKeys} router keys are`} waiting for it: requests sent with {routerKeys === 1 ? 'it' : 'them'} are refused until then, and start working as soon as you add one.</> : <> Then create your router key, the one key your apps use.</>}
            </Note>
          )}

          <Pane title="Available providers" sub={`${ROUTER_PROVIDERS.length} providers the router can route to`} delay={0.04}>
            {loading ? (
              <Loader label="Loading providers" minHeight={260} />
            ) : (
              <div className="st-cards sk-provs">
                {ROUTER_PROVIDERS.map((prov) => {
                  const key = keyFor(prov.id);
                  const models = lineup?.[prov.id] ?? [];
                  const check = key ? checks[key.id] : undefined;
                  const broken = !!key && !key.isActive;
                  const problem = key?.isActive ? key.problem : null;
                  return (
                    <div key={prov.id} className={`st-card sk-prov${key && !broken ? ' is-connected' : ''}${problem ? ' is-problem' : ''}${broken ? ' is-broken' : ''}`}>
                      <div className="sk-prov-head">
                        <ProviderMark provider={prov.id} size="lg" />
                        <div className="sk-prov-name">
                          <span className="st-card-t">{prov.name}</span>
                          {prov.maker !== prov.name && <span className="sk-prov-maker">{prov.maker}</span>}
                        </div>
                        {broken ? <Pill tone="bad">Not working</Pill>
                          : problem ? <Pill tone="warn">Needs attention</Pill>
                          : key ? <Pill tone="good">Connected</Pill> : null}
                      </div>

                      <div className="sk-prov-models">
                        {lineup === null ? null : models.length ? (
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
                        {broken && (
                          <p className="sk-prov-msg is-bad">
                            <b>{prov.name} refused this key</b>{key?.lastValidated ? ` when it was checked on ${day(key.lastValidated)}` : ''}, so the router
                            does not use it. Replace it with a working key.
                          </p>
                        )}
                        {problem && (
                          <p className="sk-prov-msg is-warn">
                            <b>{problem.kind === 'no_credit' ? `${prov.name} refused requests for credit` : `${prov.name} refused this key`}</b> on {day(problem.at)}
                            {problem.message ? `: ${problem.message}` : '.'}{' '}
                            {problem.kind === 'no_credit' ? `Add credit in your ${prov.name} account, then press Check key.` : 'Replace it with a new key.'}
                          </p>
                        )}
                        {check && (
                          <p className={`sk-prov-msg ${check.verdict === 'valid' ? 'is-good' : check.verdict === 'invalid' || check.verdict === 'error' ? 'is-bad' : 'is-warn'}`} role="status">
                            {check.message}
                          </p>
                        )}
                        {key ? (
                          <>
                            <dl className="st-kv is-tight">
                              <div><dt>Added</dt><dd>{day(key.createdAt)}</dd></div>
                              {key.lastValidated && <div><dt>Checked</dt><dd>{day(key.lastValidated)}</dd></div>}
                            </dl>
                            <div className="sk-prov-act">
                              <button type="button" className="st-btn is-sm" disabled={checking === key.id} onClick={() => handleCheck(key)}>
                                {checking === key.id ? 'Checking…' : 'Check key'}
                              </button>
                              <button type="button" className={`st-btn is-sm${broken || problem?.kind === 'rejected' ? ' is-primary' : ''}`} onClick={() => setDialog({ provider: prov.id, replace: true })}>Replace</button>
                              <button type="button" className="st-btn is-sm is-danger" onClick={() => handleDeleteKey(key)}>Remove</button>
                            </div>
                          </>
                        ) : (
                          <button
                            type="button"
                            className={`st-btn is-block${working.length === 0 ? ' is-primary' : ''}`}
                            onClick={() => setDialog({ provider: prov.id, replace: false })}
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
                      <button type="button" className="st-btn is-sm is-danger" onClick={() => handleDeleteKey(key)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </Pane>
          )}

          <Note title="How provider keys work">
            For each request the router picks the model that tests best for the job among the providers you have connected,
            using the live benchmark scores on this site, so more providers give it more to choose from. A request that names
            one model (for example <code className="st-ic">claude-sonnet-5-5</code>) needs that model&rsquo;s provider key. If a
            provider refuses your key or your account runs out of credit, the card above says so and we email you, at most once
            a week per provider.
          </Note>

          <Note tone="good" title="Your keys are secure">
            All provider API keys are encrypted using AES-256-GCM before being stored. We never log or expose your keys.
            You can remove them at any time.
          </Note>
        </div>

        {/* Add or replace a provider key: checked with the provider before anything is saved. */}
        <Modal
          open={!!dialog && !!dialogInfo}
          onClose={() => setDialog(null)}
          size="narrow"
          title={dialogInfo ? (
            <span className="sk-mtitle"><ProviderMark provider={dialogInfo.id} />{dialog?.replace ? `Replace your ${dialogInfo.name} key` : `Add ${dialogInfo.name} key`}</span>
          ) : ''}
          sub={dialog?.replace ? 'The new key is checked first; if the provider refuses it, your current key stays in place.' : undefined}
        >
          {dialog && (
            <ProviderKeyForm
              key={`${dialog.provider}-${dialog.replace}`}
              provider={dialog.provider}
              replace={dialog.replace}
              connected={connectedIds}
              onSaved={onSaved}
              onCancel={() => setDialog(null)}
            />
          )}
        </Modal>
      </SubscriptionGuard>
    </RouterLayout>
  );
}
