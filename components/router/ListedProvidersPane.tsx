'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { apiClient, ApiRequestError } from '@/lib/api-client';
import type { DataDeclaration, ListedHost, ListedKeyResult, ListedOffer } from '@/lib/api-client';
import HostLogo from '@/components/marketplace/HostLogo';
import { Pane, Modal, Note, Tag, Pill } from '@/components/studio';
import '@/styles/studio-keys.css';

/**
 * "Listed providers" on the Providers page (Phase 3 plan §2.17; M8): independent hosts listed on AI Stupid Level whose
 * models the Smart Router can reach with the account's own key at that host. The page renders this only when
 * GET /router/marketplace answered 200 with at least one host (the API sends none while the switches keep listed
 * hosts out), so it is never a "coming soon" shell.
 *
 * Each row: the host's mark on a white tile, "Company · regions", its models, "N of M measured", an Offer tag with
 * one line, a health chip, and [Add key], or "Connected" with [Check key] [Remove]. Alphabetical (the API's order),
 * with a search box above 8 rows. The Add-key dialog checks the key with the host before anything is saved (the
 * API's rule: an invalid key is never saved); on a host whose model list answers any key the check is a 1-token chat
 * at the user's cost, and the dialog says so before it runs. `openSlug` (the page's `?host=`) scrolls to that host's
 * row and opens its dialog once, then `onOpened` lets the page drop the parameter.
 *
 * Offers are the host's own, display only: a tag and one line here, the full box with its disclosure line in the
 * dialog; they never change an order or a score. Provider links carry rel="nofollow ugc noopener noreferrer".
 *
 * Where a key goes (the API decides, the texts say it): Add key sends a new key to the host's `hosts`, the addresses
 * the dialog names, which it sends along so the API refuses a list that changed since the page loaded (hosts_changed);
 * Check key sends the stored key only to `connection.checkHosts`, the addresses the user confirmed. A host stopped for
 * a security reason reaches the pane only for a connected user, as paused, with no Check key and no offers.
 */

const PROVIDER_REL = 'nofollow ugc noopener noreferrer';
const SEARCH_ABOVE = 8;
const MODELS_SHOWN = 3;
const KEY_MAX = 512;
/** Printable ASCII, no space: what the API accepts as a key. */
const PRINTABLE = /^[\x21-\x7E]+$/;

const HEALTH: Record<ListedHost['health'], { label: string; tone: 'good' | 'warn' | 'bad' | 'line' }> = {
  up: { label: 'Up', tone: 'good' }, degraded: { label: 'Degraded', tone: 'warn' }, down: { label: 'Down', tone: 'bad' }, unknown: { label: 'Not checked yet', tone: 'line' },
};

const TRAINING: Record<DataDeclaration['trainingUse'], string> = {
  never: 'Never', opt_in: 'Only if you opt in', opt_out: 'Unless you opt out', yes: 'Yes', not_stated: 'Not stated',
};

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

/** A safety hold on the host's endpoint (the API's hold reasons), in words. */
const HOLD_WORDS: Record<string, string> = { domain_lapse: ' (its domain proof lapsed)', tls_issuer_change: ' (its TLS certificate changed issuer)', hold: '' };

/** The host view an error answer carries (hosts_changed, host_not_confirmed), so the row and the dialog show the current addresses. */
function hostOf(err: unknown): ListedHost | null {
  const h = err instanceof ApiRequestError ? err.body.host : null;
  return h && typeof h === 'object' && typeof (h as ListedHost).slug === 'string' ? h as ListedHost : null;
}

/** An https link from the host's own data, or null (never a javascript: or http: one). */
function safeHttps(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

const linkText = (u: string) => { try { return new URL(u).host; } catch { return u; } };

/** "Company · US, EU" */
function metaLine(h: ListedHost): string {
  const kind = h.kind === 'individual' ? 'Individual' : 'Company';
  return h.regions.length ? `${kind} · ${h.regions.slice(0, 4).join(', ')}` : kind;
}

/** An example mp/ id for the after-connect note: a model the key reaches, else the host's first. */
function exampleId(h: ListedHost, reaches: string[]): string {
  return reaches[0] ?? h.models[0]?.id ?? `mp/${h.slug}/<model>`;
}

/** The host's data statement in brief (plan §9.9): declared by the host, not audited by us. */
export function DataSummary({ d, name }: { d: DataDeclaration | null; name: string }) {
  if (!d) return <p className="st-hint">{name} has not declared how it handles requests yet.</p>;
  const kept = d.promptsRetention === 'none' ? 'Not kept' : d.promptsRetention === 'days' ? `${d.retentionDays ?? '?'} days` : 'Not stated';
  const privacy = safeHttps(d.privacyUrl);
  const terms = safeHttps(d.termsUrl);
  return (
    <div className="lh-data">
      <p className="st-label">How {name} handles requests</p>
      <ul>
        <li>Prompts and outputs kept: {kept}</li>
        <li>Used for training: {TRAINING[d.trainingUse] ?? 'Not stated'}</li>
        {d.processingRegions.length > 0 && <li>Where requests are processed: {d.processingRegions.join(', ')}</li>}
      </ul>
      <p className="st-hint">
        Declared by {name} on {day(d.declaredAt)}. Not audited by AI Stupid Level.
        {privacy && <> <a href={privacy} rel={PROVIDER_REL} target="_blank">Privacy policy ↗</a></>}
        {terms && <> <a href={terms} rel={PROVIDER_REL} target="_blank">Terms ↗</a></>}
      </p>
    </div>
  );
}

/** One offer in full: what it is, its code, its end, its terms and the disclosure line (plan §8.7). */
export function OfferBox({ o }: { o: ListedOffer }) {
  const terms = safeHttps(o.termsUrl);
  return (
    <div className="lh-offer">
      <p className="lh-offer-t"><Tag tone="accent">Offer</Tag> <b>{o.title}</b></p>
      <p className="st-hint">
        {o.kindLabel}{o.percent != null ? `: ${o.percent}%` : ''}{o.details ? `. ${o.details}` : ''}
        {o.code && <> Code <code className="st-ic">{o.code}</code> (enter it at the host; it is never applied automatically).</>}
        {o.endsAt && <> Ends {day(o.endsAt)}.</>}
        {terms && <> <a href={terms} rel={PROVIDER_REL} target="_blank">Terms ↗</a></>}
      </p>
      <p className="lh-offer-d">{o.disclosure}</p>
    </div>
  );
}

type DialogState = { slug: string; replace: boolean };

export default function ListedProvidersPane({ hosts, onChange, onRemoved, openSlug, onOpened }: {
  hosts: ListedHost[];
  /** A host's new state after a key was saved, checked or changed. */
  onChange: (h: ListedHost) => void;
  onRemoved: (slug: string) => void;
  /** `?host=<slug>`: scroll to that host and open its dialog once. */
  openSlug?: string | null;
  onOpened?: () => void;
}) {
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rowMsg, setRowMsg] = useState<Record<string, { tone: 'good' | 'warn' | 'bad'; text: string }>>({});
  const handled = useRef(false);

  // ?host=: once, after the hosts are known. A connected host is only scrolled to; one whose key was refused opens
  // the dialog to replace it; any other opens Add key.
  useEffect(() => {
    if (handled.current || !openSlug) return;
    handled.current = true;
    const h = hosts.find(x => x.slug === openSlug);
    if (h) {
      requestAnimationFrame(() => document.getElementById(`listed-${h.slug}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      if (!h.connection) setDialog({ slug: h.slug, replace: false });
      else if (h.connection.state === 'key_refused') setDialog({ slug: h.slug, replace: true });
    }
    onOpened?.();
  }, [openSlug, hosts, onOpened]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return hosts;
    return hosts.filter(h => h.displayName.toLowerCase().includes(t) || h.models.some(m => m.name.toLowerCase().includes(t) || m.id.includes(t)));
  }, [hosts, q]);

  const say = (slug: string, tone: 'good' | 'warn' | 'bad', text: string) => setRowMsg(m => ({ ...m, [slug]: { tone, text } }));

  // Check key reaches only the addresses this connection confirmed (connection.checkHosts), and says so first.
  const check = async (h: ListedHost) => {
    const c = h.connection;
    if (!c || !c.checkHosts.length) return;
    const chat = c.checkBy === 'chat';
    if (chat && !confirm(`${h.displayName}'s model list answers any key, so checking yours is a 1-token chat request to ${c.checkHosts.join(', ')}. ${h.displayName} bills you for it, a fraction of a cent. Check now?`)) return;
    setBusy(h.slug);
    try {
      const r = await apiClient.checkListedHost(h.slug, chat);
      say(h.slug, r.verdict === 'valid' ? 'good' : r.verdict === 'invalid' ? 'bad' : 'warn', r.message);
      if (r.host) onChange(r.host);
    } catch (err) {
      const now = hostOf(err);
      if (now) onChange(now);
      say(h.slug, 'bad', err instanceof Error ? err.message : 'The check did not finish. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (h: ListedHost) => {
    if (!confirm(`Remove your ${h.displayName} key? The key is deleted. Requests that name its models (mp/${h.slug}/…) are refused until you add a key again, and automatic routing stops using ${h.displayName}.`)) return;
    setBusy(h.slug);
    try {
      await apiClient.removeListedHost(h.slug);
      onRemoved(h.slug);
    } catch (err) {
      say(h.slug, 'bad', err instanceof Error ? err.message : 'The key could not be removed. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const confirmHost = async (h: ListedHost, host: string) => {
    setBusy(h.slug);
    try {
      const r = await apiClient.updateListedHost(h.slug, { confirmHost: host });
      if (r.host) onChange(r.host);
      say(h.slug, 'good', `Your key now goes to ${host} too.`);
    } catch (err) {
      say(h.slug, 'bad', err instanceof Error ? err.message : 'That did not work. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const open = dialog ? hosts.find(h => h.slug === dialog.slug) ?? null : null;

  return (
    <>
      <Pane
        id="listed-providers"
        title="Listed providers"
        sub="Independent hosts. Get a key on their site; they bill you, we don't."
        ruled
        flush
        className="lh-pane"
      >
        {hosts.length > SEARCH_ABOVE && (
          <div className="lh-search">
            <label className="st-sr" htmlFor="lh-search">Search listed providers</label>
            <input id="lh-search" type="search" className="st-input sk-field-16" placeholder="Search hosts or models" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        )}
        <div className="st-rows">
          {shown.length === 0 && <p className="lh-none">No listed provider matches “{q}”.</p>}
          {shown.map(h => {
            const c = h.connection;
            const health = HEALTH[h.health] ?? HEALTH.unknown;
            const more = h.models.length - MODELS_SHOWN;
            const msg = rowMsg[h.slug];
            return (
              <div key={h.slug} id={`listed-${h.slug}`} className={`st-row lh-row${c ? ' is-connected' : ''}`}>
                <HostLogo name={h.displayName} logoUrl={h.logoUrl} size={40} />
                <div className="st-row-main">
                  <div className="lh-name"><b>{h.displayName}</b><span className="lh-meta">{metaLine(h)}</span></div>
                  <div className="lh-models">
                    {h.models.slice(0, MODELS_SHOWN).map(m => <span key={m.id} className="lh-model" title={m.id}>{m.name}</span>)}
                    {more > 0 && <span className="lh-more">+{more}</span>}
                  </div>
                  <div className="lh-facts">
                    <span>{h.measured} of {h.total} measured</span>
                    <Tag tone={health.tone}>{health.label}</Tag>
                    {h.offers[0] && <span className="lh-offer-line"><Tag tone="accent">Offer</Tag> {h.offers[0].title}</span>}
                  </div>
                  {c?.state === 'key_refused' && (
                    <p className="sk-prov-msg is-bad"><b>{h.displayName} refused this key</b>{c.lastValidatedAt ? ` when it was checked on ${day(c.lastValidatedAt)}` : ''}, so the router does not use it. Replace it with a working key.</p>
                  )}
                  {c?.state === 'no_credit' && (
                    <p className="sk-prov-msg is-warn"><b>{h.displayName} says the account cannot pay.</b> Add credit in your {h.displayName} account, then press Check key.</p>
                  )}
                  {c?.state === 'paused' && (
                    <p className="sk-prov-msg is-bad">
                      {c.pausedReason === 'security'
                        ? <><b>{h.displayName} was paused for a security reason,</b> so nothing is sent to it. Rotate this key at {h.displayName}, then remove it here.</>
                        : c.pausedReason && Object.prototype.hasOwnProperty.call(HOLD_WORDS, c.pausedReason)
                          ? <><b>{h.displayName}&rsquo;s endpoint is paused for a security check</b>{HOLD_WORDS[c.pausedReason]}, so nothing is sent to it until the check is resolved.</>
                          : <><b>{h.displayName} is not listed right now,</b> so the router does not use it.</>}
                    </p>
                  )}
                  {c?.state === 'confirm_host' && (
                    <div className="sk-prov-msg is-warn">
                      <p><b>{h.displayName} moved an endpoint to a new address.</b> Your key is not sent there until you confirm it; its other endpoints keep working.</p>
                      <div className="lh-confirm">
                        {c.unconfirmedHosts.map(x => (
                          <button key={x} type="button" className="st-btn is-sm" disabled={busy === h.slug} onClick={() => void confirmHost(h, x)}>Send my key to {x}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {msg && <p className={`sk-prov-msg is-${msg.tone}`} role="status">{msg.text}</p>}
                </div>
                <div className="st-row-end">
                  {c ? (
                    <>
                      {c.state === 'connected' && <Pill tone="good">Connected</Pill>}
                      {c.state === 'key_refused'
                        ? <button type="button" className="st-btn is-sm is-primary" onClick={() => setDialog({ slug: h.slug, replace: true })}>Replace key</button>
                        : c.state !== 'paused' && c.checkHosts.length > 0 && <button type="button" className="st-btn is-sm" disabled={busy === h.slug} onClick={() => void check(h)}>{busy === h.slug ? 'Checking…' : 'Check key'}</button>}
                      <button type="button" className="st-btn is-sm is-danger" disabled={busy === h.slug} onClick={() => void remove(h)}>Remove</button>
                    </>
                  ) : (
                    <button type="button" className="st-btn is-sm is-primary" onClick={() => setDialog({ slug: h.slug, replace: false })}>Add key</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Pane>

      <Modal
        open={!!open}
        onClose={() => setDialog(null)}
        size="narrow"
        title={open ? (
          <span className="sk-mtitle"><HostLogo name={open.displayName} logoUrl={open.logoUrl} size={28} />{dialog?.replace ? `Replace your ${open.displayName} key` : `Add ${open.displayName} key`}</span>
        ) : ''}
        sub={dialog?.replace ? 'The new key is checked first; if the host refuses it, nothing changes.' : undefined}
      >
        {open && dialog && (
          <AddKeyForm key={`${open.slug}-${dialog.replace}`} h={open} onDone={() => setDialog(null)} onSaved={r => { if (r.host) onChange(r.host); }} onHost={onChange} />
        )}
      </Modal>
    </>
  );
}

/** The dialog's body: the steps, the key, what happens to it, the data statement and any offer, then the result. */
function AddKeyForm({ h, onDone, onSaved, onHost }: { h: ListedHost; onDone: () => void; onSaved: (r: ListedKeyResult) => void; onHost: (h: ListedHost) => void }) {
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The API asked for a 1-token check this dialog had not announced (the host's state changed since the page loaded).
  const [chatAsked, setChatAsked] = useState<string | null>(null);
  const [done, setDone] = useState<ListedKeyResult | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const keyUrl = safeHttps(h.getKeyUrl);
  const chat = h.checkBy === 'chat' || chatAsked !== null;

  useEffect(() => {
    const raf = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const k = apiKey.trim();
    if (!k || busy) return;
    if (k.length > KEY_MAX || !PRINTABLE.test(k)) { setError('A key is one line of letters, digits and symbols, with no spaces.'); return; }
    setBusy(true);
    setError(null);
    try {
      // The addresses named below go along: the API sends the key nowhere if the host has another one now.
      const r = await apiClient.connectListedHost(h.slug, k, chat, h.hosts);
      setApiKey('');
      setDone(r);
      onSaved(r);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409 && err.error === 'chat_check_needed') {
        setChatAsked(err.message);
      } else {
        // hosts_changed: the answer carries the host's current addresses, which the note below then names.
        const now = hostOf(err);
        if (now) onHost(now);
        setError(err instanceof Error ? err.message : 'The key could not be checked. Try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const reached = done.reaches.length ? done.reaches : [];
    return (
      <div className="pk-form">
        <Note tone={done.verdict === 'valid' ? 'good' : 'warn'} title={done.verdict === 'valid' ? `${h.displayName} connected` : `${h.displayName} saved`}>
          {done.message}
          {reached.length > 0 && <> Your key reaches {reached.map((id, i) => <span key={id}>{i ? ', ' : ''}<code className="st-ic">{id}</code></span>)}.</>}
        </Note>
        <Note>
          Measured {h.displayName} models now take part in your automatic routing on their scores when Model source prefers listed hosts
          (<Link href="/router/preferences">Preferences</Link>). Any of its models can be named, for example <code className="st-ic">{exampleId(h, reached)}</code>.
        </Note>
        <div className="pk-actions"><button type="button" className="st-btn is-primary" onClick={onDone}>Done</button></div>
      </div>
    );
  }

  return (
    <form className="pk-form" onSubmit={submit} autoComplete="off">
      <ol className="lh-steps">
        <li>Create a key at {keyUrl ? <a href={keyUrl} rel={PROVIDER_REL} target="_blank">{linkText(keyUrl)} ↗</a> : `${h.displayName}'s site`}</li>
        <li>Paste it here</li>
      </ol>
      <div className="st-field">
        <label className="st-field-label" htmlFor="lh-key">{h.displayName} API key</label>
        <input
          ref={field}
          id="lh-key"
          type="password"
          value={apiKey}
          onChange={e => { setApiKey(e.target.value); if (error) setError(null); }}
          placeholder={`Your ${h.displayName} API key`}
          className="st-input is-code sk-field-16"
          autoComplete="new-password"
          spellCheck={false}
          maxLength={KEY_MAX}
          disabled={busy}
        />
      </div>
      <Note>
        Your key is sent only to {h.displayName} ({h.hosts.join(', ')}). When the router uses {h.displayName}, your prompts and answers go to them under
        their terms and privacy policy, and they bill you on your account with them. AI Stupid Level adds no fee and is not paid by {h.displayName} for routing your requests.
      </Note>
      <DataSummary d={h.declaration} name={h.displayName} />
      {h.offers.map(o => <OfferBox key={o.id} o={o} />)}
      {chat ? (
        <Note tone="warn" title="The check is a 1-token chat request">
          {chatAsked ?? `${h.displayName}'s model list answers any key, so we check yours with a 1-token chat request to ${h.hosts.join(', ')} instead. ${h.displayName} bills you for it, a fraction of a cent.`}
        </Note>
      ) : (
        <p className="st-hint">We check the key by asking {h.displayName} for its model list, which spends no tokens. A key {h.displayName} refuses is never saved.</p>
      )}
      {error && <Note tone="bad" title="Not saved">{error}</Note>}
      <div className="pk-actions">
        <button type="button" className="st-btn" onClick={onDone} disabled={busy}>Cancel</button>
        <button type="submit" className="st-btn is-primary" disabled={busy || !apiKey.trim()}>{busy ? 'Checking…' : 'Add & check key'}</button>
      </div>
    </form>
  );
}
