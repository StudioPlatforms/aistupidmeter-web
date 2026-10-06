'use client';

/**
 * The project's Smart Router: its keys, the rules every key in it follows, and whose provider
 * keys pay for each provider. Managers change the rules; everyone in the project can read them,
 * because they decide what happens to their requests.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  wsApi, money, day, ago, STRATEGIES, strategyLabel, PROVIDERS, providerLabel, type ModelOption,
} from '../ws';
import type { ProjectData, Policy } from './types';

const API_BASE = 'https://aistupidlevel.info/v1';

export default function RouterTab({ d, catalog, reload, flash }: {
  d: ProjectData; catalog: ModelOption[]; reload: () => void; flash: (t: string, bad?: boolean) => void;
}) {
  return (
    <>
      <Keys d={d} reload={reload} flash={flash} />
      <PolicyEditor d={d} catalog={catalog} reload={reload} flash={flash} />
      <ProviderKeys d={d} reload={reload} flash={flash} />
    </>
  );
}

// ── Keys ───────────────────────────────────────────────────────────────────

function Keys({ d, reload, flash }: { d: ProjectData; reload: () => void; flash: (t: string, bad?: boolean) => void }) {
  const [created, setCreated] = useState<{ key: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const live = d.keys.filter(k => !k.revoked && !k.expired);
  const old = d.keys.filter(k => k.revoked || k.expired);

  return (
    <section className="ws-section">
      <h2>Keys</h2>
      <p className="ws-lead">
        A project key works like any Smart Router key (<code>aism_…</code>, in place of an OpenAI or Anthropic key) but routes by
        this project&rsquo;s rules below, pays with the project&rsquo;s provider keys, and counts against its budget and your cap
        in it. Each person makes their own key, so the report can say who spent what.
        {!d.me.canContribute && d.me.wsRole === 'viewer' && ' Viewers do not hold keys.'}
      </p>
      {created && (
        <div className="ws-secret">
          <strong style={{ fontSize: 14 }}>{created.name}: copy this key now — it is not shown again</strong>
          <div className="ws-keybox" style={{ marginTop: 8 }}>
            <code>{created.key}</code>
            <button className="ws-btn" onClick={async () => { try { await navigator.clipboard.writeText(created.key); setCopied(true); } catch { window.prompt('Copy the key:', created.key); } }}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <p className="ws-note" style={{ margin: '10px 0 6px' }}>Use it with base URL <code>{API_BASE}</code> and model <code>auto</code>:</p>
          <code style={{ whiteSpace: 'pre-wrap' }}>{`curl ${API_BASE}/chat/completions \\\n  -H "Authorization: Bearer ${created.key.slice(0, 12)}…" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'`}</code>
          <button className="ws-btn small" onClick={() => { setCreated(null); setCopied(false); }}>Done</button>
        </div>
      )}
      {live.length === 0 ? <p className="ws-empty">No active keys in this project yet.</p> : (
        <div className="ws-table-wrap">
          <table className="ws-table ws-stack">
            <thead><tr><th>Key</th><th>Holder</th><th className="ws-hide-sm">Created</th><th>Last used</th><th>Expires</th><th /></tr></thead>
            <tbody>
              {live.map(k => (
                <tr key={k.id}>
                  <td><div className="ws-name">{k.name}</div><div className="ws-meta"><code>{k.prefix}…</code></div></td>
                  <td data-label="Holder">{k.mine ? 'You' : k.holder}</td>
                  <td className="ws-hide-sm dim">{day(k.createdAt)}</td>
                  <td className="dim" data-label="Last used">{k.lastUsedAt ? ago(k.lastUsedAt) : 'Never'}</td>
                  <td className="dim" data-label="Expires">{k.expiresAt ? day(k.expiresAt) : 'Never'}</td>
                  <td className="actions">
                    {(k.mine || d.me.canManage) && (
                      <button className="ws-btn small danger" onClick={async () => {
                        if (!window.confirm(`Revoke "${k.name}"? Anything using it stops working immediately.`)) return;
                        const r = await wsApi(`/projects/${d.project.id}/keys/${k.id}`, { method: 'DELETE' });
                        flash(r.ok ? 'Key revoked.' : (r.error ?? 'Could not revoke'), !r.ok);
                        reload();
                      }}>Revoke</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {d.me.canContribute && (
        <form className="ws-form" style={{ marginTop: 14 }} onSubmit={async e => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          const days = String(f.get('expires') || '');
          const r = await wsApi<any>(`/projects/${d.project.id}/keys`, { method: 'POST', body: { name: f.get('name'), expiresInDays: days ? Number(days) : null } });
          if (r.ok) { setCreated({ key: r.data.key, name: r.data.name }); form.reset(); reload(); }
          else flash(r.error ?? 'Could not create the key', true);
        }}>
          <label className="ws-field" style={{ flex: '2 1 200px' }}>
            <span>New key</span>
            <input name="name" required maxLength={60} className="ws-input" placeholder="e.g. My laptop, CI pipeline" />
          </label>
          <label className="ws-field">
            <span>Expires</span>
            <select name="expires" className="ws-select" defaultValue="">
              <option value="">Never</option><option value="7">In 7 days</option><option value="30">In 30 days</option>
              <option value="90">In 90 days</option><option value="180">In 6 months</option><option value="365">In a year</option>
            </select>
          </label>
          <button className="ws-btn primary">Create key</button>
        </form>
      )}
      {old.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary className="ws-note" style={{ cursor: 'pointer' }}>{old.length} revoked or expired key{old.length === 1 ? '' : 's'}</summary>
          <table className="ws-table" style={{ marginTop: 6 }}><tbody>
            {old.map(k => <tr key={k.id}><td>{k.name} <span className="dim">({k.mine ? 'you' : k.holder})</span></td><td className="dim">{k.revoked ? 'Revoked' : `Expired ${day(k.expiresAt)}`}</td></tr>)}
          </tbody></table>
        </details>
      )}
    </section>
  );
}

// ── Routing policy ─────────────────────────────────────────────────────────

function summary(p: Policy): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ['Strategy for “auto”', `${strategyLabel(p.strategy)}${p.lockStrategy ? ' — used for every routed request' : ''}`],
    ['Naming a model', p.allowPinning ? 'Allowed' : 'Not allowed: every request is routed'],
    ['Models', p.allowedModels.length ? `Only ${p.allowedModels.join(', ')}` : 'Any model we measure'],
  ];
  if (p.excludedProviders.length) rows.push(['Providers not used', p.excludedProviders.map(providerLabel).join(', ')]);
  if (p.maxCostPer1k) rows.push(['Price limit', `Models up to ${money(p.maxCostPer1k)} per 1,000 tokens`]);
  if (p.maxLatencyMs) rows.push(['Speed limit', `Models answering within ${p.maxLatencyMs.toLocaleString()} ms`]);
  if (p.requireToolCalling) rows.push(['Tool calling', 'Only models that support it']);
  rows.push(['Fallback', p.fallbackEnabled ? (p.fallbackOrder.length ? `On, trying ${p.fallbackOrder.join(', ')} first` : 'On') : 'Off']);
  rows.push(['Drifting models', p.avoidDrifting ? 'Passed over while a drift alert is open' : 'Treated like any other']);
  if (p.strategy === 'custom_split') rows.push(['Traffic split', p.trafficSplit.map(x => `${x.model} ${x.weight}`).join(', ') || '—']);
  rows.push(['Output per request', p.maxOutputTokens ? `At most ${p.maxOutputTokens.toLocaleString()} tokens` : 'No project limit']);
  rows.push(['Rate limit', p.rpmLimit ? `${p.rpmLimit} requests per minute per key` : 'None']);
  rows.push(['Prompt logging', p.promptLogging === 'on' ? 'On for every key (encrypted)' : p.promptLogging === 'off' ? 'Off for every key' : 'Each key’s own setting']);
  rows.push(['People’s own provider keys', p.allowPersonalProviderKeys ? 'Used when the project and workspace have none' : 'Never used']);
  return rows;
}

function PolicyEditor({ d, catalog, reload, flash }: { d: ProjectData; catalog: ModelOption[]; reload: () => void; flash: (t: string, bad?: boolean) => void }) {
  const [p, setP] = useState<Policy>(d.policy);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const dirty = JSON.stringify(p) !== JSON.stringify(d.policy);
  const set = <K extends keyof Policy>(k: K, v: Policy[K]) => { setP(prev => ({ ...prev, [k]: v })); setPreview(null); };
  const byVendor = useMemo(() => {
    const g = new Map<string, ModelOption[]>();
    for (const m of catalog) (g.get(m.vendor) ?? g.set(m.vendor, []).get(m.vendor)!).push(m);
    return Array.from(g.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [catalog]);
  const pool = p.allowedModels.length ? catalog.filter(m => p.allowedModels.includes(m.name)) : catalog;

  if (!d.me.canManage) {
    return (
      <section className="ws-section">
        <h2>Routing rules</h2>
        <p className="ws-lead">Every key in this project follows these rules. A manager can change them.</p>
        <div className="ws-facts">{summary(d.policy).map(([k, v]) => [<div key={`k${k}`}>{k}</div>, <div key={`v${k}`}>{v}</div>])}</div>
      </section>
    );
  }

  const runPreview = async () => {
    const r = await wsApi<any>(`/projects/${d.project.id}/routing/preview`, { method: 'POST', body: p });
    setPreview(r.ok ? r.data : { ok: false, message: r.error });
  };

  return (
    <section className="ws-section">
      <h2>Routing rules</h2>
      <p className="ws-lead">Every key in this project follows these rules, whoever holds it and whatever tool it is used in.</p>
      <form onSubmit={async e => {
        e.preventDefault();
        setSaving(true);
        const r = await wsApi<any>(`/projects/${d.project.id}/routing`, { method: 'PUT', body: p });
        setSaving(false);
        flash(r.ok ? (r.data?.changed?.length ? 'Routing rules saved. They apply to the next request.' : 'Nothing changed.') : (r.error ?? 'Could not save'), !r.ok);
        if (r.ok) reload();
      }}>
        <div className="ws-grid-2">
          <label className="ws-field">
            <span>Strategy for requests that say &ldquo;auto&rdquo;</span>
            <select className="ws-select" value={p.strategy} onChange={e => set('strategy', e.target.value)}>
              {STRATEGIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <small className="ws-note">{STRATEGIES.find(s => s.id === p.strategy)?.help}</small>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
            <label className="ws-check"><input type="checkbox" checked={p.lockStrategy} onChange={e => set('lockStrategy', e.target.checked)} />
              <span>Use it for every routed request<small>Requests asking for auto-coding, auto-cheapest and so on get this strategy too.</small></span></label>
            <label className="ws-check"><input type="checkbox" checked={p.allowPinning} onChange={e => set('allowPinning', e.target.checked)} />
              <span>Allow naming a model<small>Off: requests for a specific model (and /v1/messages) are refused; everything is routed.</small></span></label>
          </div>
        </div>

        {p.strategy === 'custom_split' && (
          <div style={{ marginTop: 14 }}>
            <span className="ws-note">Traffic split (weights 1–100)</span>
            {p.trafficSplit.map((x, i) => (
              <div key={i} className="ws-form" style={{ marginTop: 6 }}>
                <select className="ws-select" value={x.model} style={{ flex: '1 1 200px' }} onChange={e => set('trafficSplit', p.trafficSplit.map((y, j) => j === i ? { ...y, model: e.target.value } : y))}>
                  {pool.map(m => <option key={m.id} value={m.name}>{m.label}</option>)}
                </select>
                <input type="number" min={1} max={100} className="ws-input" style={{ width: 90 }} value={x.weight} onChange={e => set('trafficSplit', p.trafficSplit.map((y, j) => j === i ? { ...y, weight: Number(e.target.value) } : y))} />
                <button type="button" className="ws-btn small" onClick={() => set('trafficSplit', p.trafficSplit.filter((_, j) => j !== i))}>Remove</button>
              </div>
            ))}
            {p.trafficSplit.length < 10 && pool[0] && <button type="button" className="ws-btn small" style={{ marginTop: 6 }} onClick={() => set('trafficSplit', [...p.trafficSplit, { model: pool[0].name, weight: 50 }])}>Add a model</button>}
          </div>
        )}

        <details style={{ marginTop: 16 }} open={p.allowedModels.length > 0}>
          <summary style={{ cursor: 'pointer', fontSize: 13.5 }}>
            Models this project may use: <strong>{p.allowedModels.length ? `${p.allowedModels.length} chosen` : 'any model we measure'}</strong>
          </summary>
          <p className="ws-note" style={{ margin: '8px 0' }}>Tick models to allow only those, routed or named. None ticked means any model we benchmark.</p>
          <div className="ws-grid-2">
            {byVendor.map(([vendor, list]) => (
              <div key={vendor}>
                <div className="ws-note" style={{ marginBottom: 4 }}>{providerLabel(vendor)}</div>
                {list.map(m => (
                  <label key={m.id} className="ws-check" style={{ marginBottom: 4 }}>
                    <input type="checkbox" checked={p.allowedModels.includes(m.name)} onChange={e => set('allowedModels', e.target.checked ? [...p.allowedModels, m.name] : p.allowedModels.filter(x => x !== m.name))} />
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </details>

        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13.5 }}>Limits, fallback and logging</summary>
          <div className="ws-grid-2" style={{ marginTop: 10 }}>
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="ws-note" style={{ marginBottom: 6 }}>Providers this project does not use</legend>
              {PROVIDERS.map(pr => (
                <label key={pr.id} className="ws-check" style={{ marginBottom: 4 }}>
                  <input type="checkbox" checked={p.excludedProviders.includes(pr.id)} onChange={e => set('excludedProviders', e.target.checked ? [...p.excludedProviders, pr.id] : p.excludedProviders.filter(x => x !== pr.id))} />
                  <span>{pr.label}</span>
                </label>
              ))}
            </fieldset>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="ws-field"><span>Most a model may cost, per 1,000 tokens ($)</span>
                <input type="number" min={0} step="0.0001" className="ws-input" value={p.maxCostPer1k ?? ''} placeholder="No limit" onChange={e => set('maxCostPer1k', e.target.value === '' ? null : Number(e.target.value))} /></label>
              <label className="ws-field"><span>Slowest a model may be (ms)</span>
                <input type="number" min={100} step={100} className="ws-input" value={p.maxLatencyMs ?? ''} placeholder="No limit" onChange={e => set('maxLatencyMs', e.target.value === '' ? null : Number(e.target.value))} /></label>
              <label className="ws-field"><span>Most output tokens per request</span>
                <input type="number" min={16} step={1} className="ws-input" value={p.maxOutputTokens ?? ''} placeholder="No limit" onChange={e => set('maxOutputTokens', e.target.value === '' ? null : Number(e.target.value))} />
                <small className="ws-note">Reasoning models count their thinking in this, so a low cap can leave them no room to answer.</small></label>
              <label className="ws-field"><span>Requests per minute, per key</span>
                <input type="number" min={1} step={1} className="ws-input" value={p.rpmLimit ?? ''} placeholder="No limit" onChange={e => set('rpmLimit', e.target.value === '' ? null : Number(e.target.value))} /></label>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="ws-check"><input type="checkbox" checked={p.fallbackEnabled} onChange={e => set('fallbackEnabled', e.target.checked)} />
                <span>Fall back to another model when one fails<small>Up to five more, other providers first.</small></span></label>
              {p.fallbackEnabled && [0, 1, 2].map(i => (
                <label key={i} className="ws-field"><span>{['First', 'Second', 'Third'][i]} fallback (optional)</span>
                  <select className="ws-select" value={p.fallbackOrder[i] ?? ''} onChange={e => {
                    const next = [...p.fallbackOrder]; next[i] = e.target.value;
                    set('fallbackOrder', next.filter((x, j) => x && next.indexOf(x) === j).slice(0, 3));
                  }}>
                    <option value="">Automatic</option>
                    {pool.map(m => <option key={m.id} value={m.name}>{m.label}</option>)}
                  </select></label>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="ws-check"><input type="checkbox" checked={p.avoidDrifting} onChange={e => set('avoidDrifting', e.target.checked)} />
                <span>Pass over models with an open drift alert<small>They are tried after the others, never removed.</small></span></label>
              <label className="ws-check"><input type="checkbox" checked={p.requireToolCalling} onChange={e => set('requireToolCalling', e.target.checked)} />
                <span>Only models that call tools<small>For agents.</small></span></label>
              <label className="ws-check"><input type="checkbox" checked={p.allowPersonalProviderKeys} onChange={e => set('allowPersonalProviderKeys', e.target.checked)} />
                <span>Use people&rsquo;s own provider keys as a last resort<small>When neither the project nor the workspace has a key for a provider.</small></span></label>
              <label className="ws-field"><span>Prompt logging</span>
                <select className="ws-select" value={p.promptLogging} onChange={e => set('promptLogging', e.target.value as Policy['promptLogging'])}>
                  <option value="key">Each key&rsquo;s own setting</option>
                  <option value="off">Off for every key</option>
                  <option value="on">On for every key (encrypted, secrets scrubbed)</option>
                </select></label>
            </div>
          </div>
        </details>

        <div className="ws-form" style={{ marginTop: 16 }}>
          <button className="ws-btn primary" disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save rules'}</button>
          <button type="button" className="ws-btn" onClick={runPreview}>Preview what &ldquo;auto&rdquo; picks</button>
          {dirty && <button type="button" className="ws-btn link" onClick={() => { setP(d.policy); setPreview(null); }}>Discard changes</button>}
        </div>
      </form>
      {preview && (
        <div className="ws-flash" style={{ marginTop: 12, background: 'var(--terminal-dark)', border: '1px solid var(--metal-silver)' }}>
          {preview.ok ? (
            <>
              Right now <strong>auto</strong> would go to <strong>{preview.primary.model}</strong> ({providerLabel(preview.primary.provider)})
              {preview.fallbacks?.length ? <>, then {preview.fallbacks.map((f: any) => f.model).join(', ')}</> : ''}.
              <div className="ws-note" style={{ marginTop: 4 }}>{preview.primary.reasoning}</div>
            </>
          ) : <>Nothing could be routed with these rules: {preview.message}</>}
        </div>
      )}
    </section>
  );
}

// ── Provider keys ──────────────────────────────────────────────────────────

function ProviderKeys({ d, reload, flash }: { d: ProjectData; reload: () => void; flash: (t: string, bad?: boolean) => void }) {
  const own = d.providerKeys.filter(k => k.scope === 'project');
  return (
    <section className="ws-section">
      <h2>Who pays the providers</h2>
      <p className="ws-lead">
        Requests are billed by the provider to whoever&rsquo;s key is used: the project&rsquo;s own key for that provider first
        (a client&rsquo;s account, say), then the workspace&rsquo;s shared key
        {d.policy.allowPersonalProviderKeys ? ', then the requester’s own key from their Providers page' : ''}.
        {d.me.isOwner && <> Workspace keys are on the <Link href="/account/team?tab=settings" className="ws-link">workspace page</Link>.</>}
      </p>
      <div className="ws-table-wrap">
        <table className="ws-table ws-stack">
          <thead><tr><th>Provider</th><th>Paid by</th><th className="ws-hide-sm">Key</th>{d.me.canManage && <th />}</tr></thead>
          <tbody>
            {PROVIDERS.map(pr => {
              const src = d.providerSources[pr.id];
              const k = own.find(x => x.provider === pr.id) ?? d.providerKeys.find(x => x.provider === pr.id && x.scope === 'workspace');
              return (
                <tr key={pr.id}>
                  <td className="ws-name">{pr.label}</td>
                  <td>{src === 'project' ? 'This project’s key' : src === 'workspace' ? 'The workspace’s key' : src === 'members' ? <span className="dim">Each person&rsquo;s own key, if they have one</span> : <span className="dim">No key: requests to {pr.label} fail</span>}
                    {k?.validationError && <span className="ws-chip bad" style={{ marginLeft: 6 }} title={k.validationError}>Refused at last check</span>}</td>
                  <td className="ws-hide-sm dim">{k ? <><code>…{k.hint}</code>{k.alias ? ` · ${k.alias}` : ''}</> : '—'}</td>
                  {d.me.canManage && (
                    <td className="actions">
                      {own.find(x => x.provider === pr.id) && <>
                        <button className="ws-btn small" onClick={async () => {
                          const r = await wsApi<any>(`/projects/${d.project.id}/provider-keys/${own.find(x => x.provider === pr.id)!.id}/test`, { method: 'POST' });
                          flash(r.data?.valid ? `${pr.label} accepted the key.` : `${pr.label} refused the key: ${r.data?.error ?? r.error}`, !r.data?.valid);
                          reload();
                        }}>Check</button>{' '}
                        <button className="ws-btn small danger" onClick={async () => {
                          if (!window.confirm(`Remove this project's ${pr.label} key?`)) return;
                          await wsApi(`/projects/${d.project.id}/provider-keys/${own.find(x => x.provider === pr.id)!.id}`, { method: 'DELETE' });
                          reload();
                        }}>Remove</button>
                      </>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {d.me.canManage && (
        <form className="ws-form" style={{ marginTop: 14 }} autoComplete="off" onSubmit={async e => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          const r = await wsApi<any>(`/projects/${d.project.id}/provider-keys`, { method: 'POST', body: { provider: f.get('provider'), apiKey: f.get('apiKey'), alias: f.get('alias') } });
          flash(r.ok ? (r.message ?? 'Key added') : (r.error ?? 'Could not add the key'), !r.ok);
          if (r.ok) { form.reset(); reload(); }
        }}>
          <label className="ws-field">
            <span>Provider</span>
            <select name="provider" className="ws-select" defaultValue="openai">{PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
          </label>
          <label className="ws-field" style={{ flex: '2 1 240px' }}>
            <span>This project&rsquo;s own API key</span>
            <input name="apiKey" type="password" required className="ws-input" placeholder="Paste the key" autoComplete="new-password" />
          </label>
          <label className="ws-field" style={{ flex: '1 1 160px' }}>
            <span>Label (optional)</span>
            <input name="alias" maxLength={60} className="ws-input" placeholder="Client's account" />
          </label>
          <button className="ws-btn primary">Add key</button>
        </form>
      )}
    </section>
  );
}
