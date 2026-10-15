'use client';

/**
 * The project's Smart Router: its keys, the rules every key in it follows, and whose provider
 * keys pay for each provider. Managers change the rules; everyone in the project can read them,
 * because they decide what happens to their requests.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Pane, Tag, Note, CodeBlock, ProviderMark } from '@/components/studio';
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
    <>
      {created && (
        <Pane tone="accent" title={`${created.name}: copy this key now — it is not shown again`}>
          <div className="sw-stack">
            <div className="st-secret">
              <code>{created.key}</code>
              <button type="button" className={`st-copy${copied ? ' is-done' : ''}`} onClick={async () => { try { await navigator.clipboard.writeText(created.key); setCopied(true); } catch { window.prompt('Copy the key:', created.key); } }}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <p className="sw-quiet">Use it with base URL <code className="st-ic">{API_BASE}</code> and model <code className="st-ic">auto</code>:</p>
            <CodeBlock samples={[{ label: 'cURL', lang: 'bash', code: `curl ${API_BASE}/chat/completions \\\n  -H "Authorization: Bearer ${created.key.slice(0, 12)}…" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'` }]} />
            <div className="st-actions"><button type="button" className="st-btn is-sm" onClick={() => { setCreated(null); setCopied(false); }}>Done</button></div>
          </div>
        </Pane>
      )}
      <Pane
        title="Keys"
        sub={<>
          A project key works like any Smart Router key (<code className="st-ic">aism_…</code>, in place of an OpenAI or Anthropic key) but routes by
          this project&rsquo;s rules below, pays with the project&rsquo;s provider keys, and counts against its budget and your cap
          in it. Each person makes their own key, so the report can say who spent what.
          {!d.me.canContribute && d.me.wsRole === 'viewer' && ' Viewers do not hold keys.'}
        </>}
        ruled
        flush
      >
        {live.length === 0 ? (
          <div className="sw-none">
            <span className="st-empty-mark" aria-hidden="true"><i /><i /><i /></span>
            <p>No active keys in this project yet.</p>
          </div>
        ) : (
          <div className="st-table-wrap">
            <table className="st-table is-stack">
              <thead><tr><th>Key</th><th>Holder</th><th className="sw-hide-sm">Created</th><th>Last used</th><th>Expires</th><th><span className="st-sr">Actions</span></th></tr></thead>
              <tbody>
                {live.map(k => (
                  <tr key={k.id}>
                    <td className="is-head"><div className="sw-t">{k.name}</div><div className="sw-s"><code className="st-ic">{k.prefix}…</code></div></td>
                    <td data-label="Holder">{k.mine ? 'You' : k.holder}</td>
                    <td className="sw-hide-sm is-dim">{day(k.createdAt)}</td>
                    <td className="is-dim" data-label="Last used">{k.lastUsedAt ? ago(k.lastUsedAt) : 'Never'}</td>
                    <td className="is-dim" data-label="Expires">{k.expiresAt ? day(k.expiresAt) : 'Never'}</td>
                    <td className="sw-acts-cell">
                      {(k.mine || d.me.canManage) && (
                        <div className="sw-acts">
                          <button type="button" className="st-btn is-sm is-quiet sw-bad-text" onClick={async () => {
                            if (!window.confirm(`Revoke "${k.name}"? Anything using it stops working immediately.`)) return;
                            const r = await wsApi(`/projects/${d.project.id}/keys/${k.id}`, { method: 'DELETE' });
                            flash(r.ok ? 'Key revoked.' : (r.error ?? 'Could not revoke'), !r.ok);
                            reload();
                          }}>Revoke</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {old.length > 0 && (
          <div className="sw-old">
            <details className="sw-details">
              <summary>{old.length} revoked or expired key{old.length === 1 ? '' : 's'}</summary>
              <div className="st-table-wrap">
                <table className="st-table"><tbody>
                  {old.map(k => <tr key={k.id}><td>{k.name} <span className="sw-dim">({k.mine ? 'you' : k.holder})</span></td><td className="is-dim">{k.revoked ? 'Revoked' : `Expired ${day(k.expiresAt)}`}</td></tr>)}
                </tbody></table>
              </div>
            </details>
          </div>
        )}
        {d.me.canContribute && (
          <form className="sw-addbar" onSubmit={async e => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            const days = String(f.get('expires') || '');
            const r = await wsApi<any>(`/projects/${d.project.id}/keys`, { method: 'POST', body: { name: f.get('name'), expiresInDays: days ? Number(days) : null } });
            if (r.ok) { setCreated({ key: r.data.key, name: r.data.name }); form.reset(); reload(); }
            else flash(r.error ?? 'Could not create the key', true);
          }}>
            <p className="st-label">New key</p>
            <div className="sw-form-row">
              <label className="st-field is-wide">
                <span className="st-field-label">Name</span>
                <input name="name" required maxLength={60} className="st-input" placeholder="e.g. My laptop, CI pipeline" />
              </label>
              <label className="st-field is-narrow">
                <span className="st-field-label">Expires</span>
                <select name="expires" className="st-select" defaultValue="">
                  <option value="">Never</option><option value="7">In 7 days</option><option value="30">In 30 days</option>
                  <option value="90">In 90 days</option><option value="180">In 6 months</option><option value="365">In a year</option>
                </select>
              </label>
              <button type="submit" className="st-btn is-primary">Create key</button>
            </div>
          </form>
        )}
      </Pane>
    </>
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
      <Pane title="Routing rules" sub="Every key in this project follows these rules. A manager can change them." delay={0.06}>
        <dl className="st-kv sw-kv sw-rules">{summary(d.policy).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </Pane>
    );
  }

  const runPreview = async () => {
    const r = await wsApi<any>(`/projects/${d.project.id}/routing/preview`, { method: 'POST', body: p });
    setPreview(r.ok ? r.data : { ok: false, message: r.error });
  };

  return (
    <Pane title="Routing rules" sub="Every key in this project follows these rules, whoever holds it and whatever tool it is used in." ruled delay={0.06}>
      <form className="sw-stack" onSubmit={async e => {
        e.preventDefault();
        setSaving(true);
        const r = await wsApi<any>(`/projects/${d.project.id}/routing`, { method: 'PUT', body: p });
        setSaving(false);
        flash(r.ok ? (r.data?.changed?.length ? 'Routing rules saved. They apply to the next request.' : 'Nothing changed.') : (r.error ?? 'Could not save'), !r.ok);
        if (r.ok) reload();
      }}>
        <div className="sw-grid2">
          <label className="st-field">
            <span className="st-field-label">Strategy for requests that say &ldquo;auto&rdquo;</span>
            <select className="st-select" value={p.strategy} onChange={e => set('strategy', e.target.value)}>
              {STRATEGIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <small className="st-hint">{STRATEGIES.find(s => s.id === p.strategy)?.help}</small>
          </label>
          <div className="sw-toggles sw-toggles-top">
            <label className="st-toggle"><input type="checkbox" className="st-check" checked={p.lockStrategy} onChange={e => set('lockStrategy', e.target.checked)} />
              <span className="sw-toggle-text"><b>Use it for every routed request</b><span>Requests asking for auto-coding, auto-cheapest and so on get this strategy too.</span></span></label>
            <label className="st-toggle"><input type="checkbox" className="st-check" checked={p.allowPinning} onChange={e => set('allowPinning', e.target.checked)} />
              <span className="sw-toggle-text"><b>Allow naming a model</b><span>Off: requests for a specific model (and /v1/messages) are refused; everything is routed.</span></span></label>
          </div>
        </div>

        {p.strategy === 'custom_split' && (
          <fieldset className="sw-fieldset sw-split">
            <legend>Traffic split <small>weights 1–100</small></legend>
            <div className="sw-split-rows">
              {p.trafficSplit.map((x, i) => (
                <div key={i} className="sw-split-row">
                  <select className="st-select" aria-label={`Model ${i + 1}`} value={x.model} onChange={e => set('trafficSplit', p.trafficSplit.map((y, j) => j === i ? { ...y, model: e.target.value } : y))}>
                    {pool.map(m => <option key={m.id} value={m.name}>{m.label}</option>)}
                  </select>
                  <input type="number" min={1} max={100} className="st-input" aria-label={`Weight of model ${i + 1}`} value={x.weight} onChange={e => set('trafficSplit', p.trafficSplit.map((y, j) => j === i ? { ...y, weight: Number(e.target.value) } : y))} />
                  <button type="button" className="st-btn is-sm is-quiet" onClick={() => set('trafficSplit', p.trafficSplit.filter((_, j) => j !== i))}>Remove</button>
                </div>
              ))}
            </div>
            {p.trafficSplit.length < 10 && pool[0] && (
              <div className="st-actions sw-gap-top"><button type="button" className="st-btn is-sm" onClick={() => set('trafficSplit', [...p.trafficSplit, { model: pool[0].name, weight: 50 }])}>Add a model</button></div>
            )}
          </fieldset>
        )}

        <details className="sw-details sw-section" open={p.allowedModels.length > 0}>
          <summary>
            <span>Models this project may use: <strong>{p.allowedModels.length ? `${p.allowedModels.length} chosen` : 'any model we measure'}</strong></span>
          </summary>
          <div className="sw-section-body">
            <p className="st-hint">Tick models to allow only those, routed or named. None ticked means any model we benchmark.</p>
            <div className="sw-vendors">
              {byVendor.map(([vendor, list]) => (
                <div key={vendor} className="sw-vendor">
                  <div className="sw-vendor-h"><ProviderMark provider={vendor} size="sm" /><span>{providerLabel(vendor)}</span></div>
                  {list.map(m => (
                    <label key={m.id} className="st-toggle sw-pick">
                      <input type="checkbox" className="st-check" checked={p.allowedModels.includes(m.name)} onChange={e => set('allowedModels', e.target.checked ? [...p.allowedModels, m.name] : p.allowedModels.filter(x => x !== m.name))} />
                      <b>{m.label}</b>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </details>

        <details className="sw-details sw-section">
          <summary><span>Limits, fallback and logging</span></summary>
          <div className="sw-section-body sw-policy">
            <fieldset className="sw-fieldset">
              <legend>Providers this project does not use</legend>
              <div className="sw-toggles">
                {PROVIDERS.map(pr => (
                  <label key={pr.id} className="st-toggle sw-pick">
                    <input type="checkbox" className="st-check" checked={p.excludedProviders.includes(pr.id)} onChange={e => set('excludedProviders', e.target.checked ? [...p.excludedProviders, pr.id] : p.excludedProviders.filter(x => x !== pr.id))} />
                    <b>{pr.label}</b>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="sw-stack">
              <label className="st-field"><span className="st-field-label">Most a model may cost, per 1,000 tokens <small>$</small></span>
                <input type="number" min={0} step="0.0001" className="st-input" value={p.maxCostPer1k ?? ''} placeholder="No limit" onChange={e => set('maxCostPer1k', e.target.value === '' ? null : Number(e.target.value))} /></label>
              <label className="st-field"><span className="st-field-label">Slowest a model may be <small>ms</small></span>
                <input type="number" min={100} step={100} className="st-input" value={p.maxLatencyMs ?? ''} placeholder="No limit" onChange={e => set('maxLatencyMs', e.target.value === '' ? null : Number(e.target.value))} /></label>
              <label className="st-field"><span className="st-field-label">Most output tokens per request</span>
                <input type="number" min={16} step={1} className="st-input" value={p.maxOutputTokens ?? ''} placeholder="No limit" onChange={e => set('maxOutputTokens', e.target.value === '' ? null : Number(e.target.value))} />
                <small className="st-hint">Reasoning models count their thinking in this, so a low cap can leave them no room to answer.</small></label>
              <label className="st-field"><span className="st-field-label">Requests per minute, per key</span>
                <input type="number" min={1} step={1} className="st-input" value={p.rpmLimit ?? ''} placeholder="No limit" onChange={e => set('rpmLimit', e.target.value === '' ? null : Number(e.target.value))} /></label>
            </div>
            <div className="sw-stack">
              <label className="st-toggle"><input type="checkbox" className="st-check" checked={p.fallbackEnabled} onChange={e => set('fallbackEnabled', e.target.checked)} />
                <span className="sw-toggle-text"><b>Fall back to another model when one fails</b><span>Up to five more, other providers first.</span></span></label>
              {p.fallbackEnabled && [0, 1, 2].map(i => (
                <label key={i} className="st-field"><span className="st-field-label">{['First', 'Second', 'Third'][i]} fallback <small>optional</small></span>
                  <select className="st-select" value={p.fallbackOrder[i] ?? ''} onChange={e => {
                    const next = [...p.fallbackOrder]; next[i] = e.target.value;
                    set('fallbackOrder', next.filter((x, j) => x && next.indexOf(x) === j).slice(0, 3));
                  }}>
                    <option value="">Automatic</option>
                    {pool.map(m => <option key={m.id} value={m.name}>{m.label}</option>)}
                  </select></label>
              ))}
            </div>
            <div className="sw-stack">
              <label className="st-toggle"><input type="checkbox" className="st-check" checked={p.avoidDrifting} onChange={e => set('avoidDrifting', e.target.checked)} />
                <span className="sw-toggle-text"><b>Pass over models with an open drift alert</b><span>They are tried after the others, never removed.</span></span></label>
              <label className="st-toggle"><input type="checkbox" className="st-check" checked={p.requireToolCalling} onChange={e => set('requireToolCalling', e.target.checked)} />
                <span className="sw-toggle-text"><b>Only models that call tools</b><span>For agents.</span></span></label>
              <label className="st-toggle"><input type="checkbox" className="st-check" checked={p.allowPersonalProviderKeys} onChange={e => set('allowPersonalProviderKeys', e.target.checked)} />
                <span className="sw-toggle-text"><b>Use people&rsquo;s own provider keys as a last resort</b><span>When neither the project nor the workspace has a key for a provider.</span></span></label>
              <label className="st-field"><span className="st-field-label">Prompt logging</span>
                <select className="st-select" value={p.promptLogging} onChange={e => set('promptLogging', e.target.value as Policy['promptLogging'])}>
                  <option value="key">Each key&rsquo;s own setting</option>
                  <option value="off">Off for every key</option>
                  <option value="on">On for every key (encrypted, secrets scrubbed)</option>
                </select></label>
            </div>
          </div>
        </details>

        <div className="st-actions sw-policy-acts">
          <button type="submit" className="st-btn is-primary" disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save rules'}</button>
          <button type="button" className="st-btn" onClick={runPreview}>Preview what &ldquo;auto&rdquo; picks</button>
          {dirty && <button type="button" className="st-btn is-quiet" onClick={() => { setP(d.policy); setPreview(null); }}>Discard changes</button>}
        </div>
      </form>
      {preview && (
        <div className="sw-gap-top" role="status">
          {preview.ok ? (
            <Note tone="good">
              Right now <strong>auto</strong> would go to <strong>{preview.primary.model}</strong> ({providerLabel(preview.primary.provider)})
              {preview.fallbacks?.length ? <>, then {preview.fallbacks.map((f: any) => f.model).join(', ')}</> : ''}.
              <span className="sw-note-sub">{preview.primary.reasoning}</span>
            </Note>
          ) : <Note tone="bad">Nothing could be routed with these rules: {preview.message}</Note>}
        </div>
      )}
    </Pane>
  );
}

// ── Provider keys ──────────────────────────────────────────────────────────

function ProviderKeys({ d, reload, flash }: { d: ProjectData; reload: () => void; flash: (t: string, bad?: boolean) => void }) {
  const own = d.providerKeys.filter(k => k.scope === 'project');
  return (
    <Pane
      title="Who pays the providers"
      sub={<>
        Requests are billed by the provider to whoever&rsquo;s key is used: the project&rsquo;s own key for that provider first
        (a client&rsquo;s account, say), then the workspace&rsquo;s shared key
        {d.policy.allowPersonalProviderKeys ? ', then the requester’s own key from their Providers page' : ''}.
        {d.me.isOwner && <> Workspace keys are on the <Link href="/account/team?tab=settings" className="st-link-inline">workspace page</Link>.</>}
      </>}
      ruled
      flush
      delay={0.06}
    >
      <div className="st-table-wrap">
        <table className="st-table is-stack">
          <thead><tr><th>Provider</th><th>Paid by</th><th className="sw-hide-sm">Key</th>{d.me.canManage && <th><span className="st-sr">Actions</span></th>}</tr></thead>
          <tbody>
            {PROVIDERS.map(pr => {
              const src = d.providerSources[pr.id];
              const mine = own.find(x => x.provider === pr.id);
              const k = mine ?? d.providerKeys.find(x => x.provider === pr.id && x.scope === 'workspace');
              return (
                <tr key={pr.id}>
                  <td className="is-head">
                    <div className="sw-prov"><ProviderMark provider={pr.id} size="sm" /><div className="sw-t">{pr.label}</div></div>
                  </td>
                  <td data-label="Paid by">
                    <div className="sw-cellbox sw-paid">
                      {src === 'project' ? <span>This project&rsquo;s key</span> : src === 'workspace' ? <span>The workspace&rsquo;s key</span> : src === 'members' ? <span className="sw-dim">Each person&rsquo;s own key, if they have one</span> : <span className="sw-dim">No key: requests to {pr.label} fail</span>}
                      {k?.validationError && <Tag tone="bad" title={k.validationError}>Refused at last check</Tag>}
                    </div>
                  </td>
                  <td className="sw-hide-sm is-dim">{k ? <><code className="st-ic">…{k.hint}</code>{k.alias ? ` · ${k.alias}` : ''}</> : '—'}</td>
                  {d.me.canManage && (
                    <td className="sw-acts-cell">
                      {mine && (
                        <div className="sw-acts">
                          <button type="button" className="st-btn is-sm" onClick={async () => {
                            const r = await wsApi<any>(`/projects/${d.project.id}/provider-keys/${own.find(x => x.provider === pr.id)!.id}/test`, { method: 'POST' });
                            flash(r.data?.valid ? `${pr.label} accepted the key.` : `${pr.label} refused the key: ${r.data?.error ?? r.error}`, !r.data?.valid);
                            reload();
                          }}>Check</button>
                          <button type="button" className="st-btn is-sm is-quiet sw-bad-text" onClick={async () => {
                            if (!window.confirm(`Remove this project's ${pr.label} key?`)) return;
                            await wsApi(`/projects/${d.project.id}/provider-keys/${own.find(x => x.provider === pr.id)!.id}`, { method: 'DELETE' });
                            reload();
                          }}>Remove</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {d.me.canManage && (
        <form className="sw-addbar" autoComplete="off" onSubmit={async e => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          const r = await wsApi<any>(`/projects/${d.project.id}/provider-keys`, { method: 'POST', body: { provider: f.get('provider'), apiKey: f.get('apiKey'), alias: f.get('alias') } });
          flash(r.ok ? (r.message ?? 'Key added') : (r.error ?? 'Could not add the key'), !r.ok);
          if (r.ok) { form.reset(); reload(); }
        }}>
          <p className="st-label">Add a key</p>
          <div className="sw-form-row">
            <label className="st-field is-narrow">
              <span className="st-field-label">Provider</span>
              <select name="provider" className="st-select" defaultValue="openai">{PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
            </label>
            <label className="st-field is-wide">
              <span className="st-field-label">This project&rsquo;s own API key</span>
              <input name="apiKey" type="password" required className="st-input is-code" placeholder="Paste the key" autoComplete="new-password" />
            </label>
            <label className="st-field">
              <span className="st-field-label">Label <small>optional</small></span>
              <input name="alias" maxLength={60} className="st-input" placeholder="Client's account" />
            </label>
            <button type="submit" className="st-btn is-primary">Add key</button>
          </div>
        </form>
      )}
    </Pane>
  );
}
