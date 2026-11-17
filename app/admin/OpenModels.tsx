'use client';

/**
 * The open-model registry (phase3-plan §2.9, §5.4 `marketplace_open_models`; M4), for staff: the open-weights
 * models providers can list, with the fleet model serving the same weights (it decides the `fleet:` protocol
 * profile at approval). Add, edit, retire. Providers' "Request a model we don't have" arrives in the review
 * queue above. Data: /api/admin/marketplace/open-models (GET, POST) and open-models/:id (PATCH).
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Loader, Note, Pane, Pill } from '@/components/studio';
import { EmptyRow } from './bits';

interface OpenModel {
  id: number; slug: string; name: string; maker: string; licence: string | null; weightsUrl: string | null;
  paramsB: number | null; activeParamsB: number | null; contextTokens: number | null; fleetModelId: number | null; fleetModelName: string | null;
  state: 'active' | 'retired'; listings: number;
}

async function call(path: string, method = 'GET', body?: unknown): Promise<{ ok: boolean; data: any; error: string | null; fields: Record<string, string> }> {
  try {
    const r = await fetch(`/api/admin/marketplace/${path}`, {
      method, cache: 'no-store',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => null);
    return { ok: r.ok && !!j?.success, data: j?.data ?? null, error: j?.message ?? j?.error ?? (r.ok ? null : `HTTP ${r.status}`), fields: j?.fields ?? {} };
  } catch {
    return { ok: false, data: null, error: 'The API did not answer', fields: {} };
  }
}

const num = (v: FormDataEntryValue | null) => { const s = String(v ?? '').trim(); return s === '' ? null : Number(s); };

export default function OpenModels() {
  const [rows, setRows] = useState<OpenModel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await call('open-models');
    if (r.ok) { setRows(r.data?.openModels ?? []); setError(null); } else setError(r.error);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true); setMsg(null);
    const r = await call('open-models', 'POST', {
      slug: String(f.get('slug') ?? '').trim(), name: String(f.get('name') ?? '').trim(), maker: String(f.get('maker') ?? '').trim(),
      licence: String(f.get('licence') ?? '').trim() || null, weightsUrl: String(f.get('weightsUrl') ?? '').trim() || null,
      paramsB: num(f.get('paramsB')), activeParamsB: num(f.get('activeParamsB')), contextTokens: num(f.get('contextTokens')), fleetModelId: num(f.get('fleetModelId')),
    });
    setBusy(false);
    if (r.ok) { form.reset(); setFields({}); setMsg('Added'); void load(); } else { setFields(r.fields); setMsg(r.error); }
  };
  const setState = async (m: OpenModel, state: 'active' | 'retired') => {
    const r = await call(`open-models/${m.id}`, 'PATCH', { state });
    setMsg(r.ok ? `${m.name}: ${state}` : r.error);
    void load();
  };

  return (
    <Pane title="Model registry" sub="The models providers can list, open-source or closed. Add one when a provider requests it." ruled flush>
      {msg && <div className="sw-pad"><Note>{msg}</Note></div>}
      {!rows && !error && <Loader label="Loading the registry" />}
      {error && <div className="sw-pad"><Note tone="bad" title="Not loaded">{error}</Note></div>}
      {rows && (
        <div className="st-table-wrap">
          <table className="st-table">
            <thead><tr><th>Model</th><th className="ad-hide-sm">Fleet model</th><th className="is-num ad-hide-md">Listings</th><th>State</th></tr></thead>
            <tbody>
              {rows.length === 0 && <EmptyRow cols={4}>The registry is empty.</EmptyRow>}
              {rows.map(m => (
                <tr key={m.id}>
                  <td>
                    <div className="ad-acct">
                      <span className="ad-acct-e">{m.maker} · {m.name}</span>
                      <span className="ad-acct-s">{m.slug}{m.contextTokens ? ` · ${m.contextTokens.toLocaleString('en-US')} context` : ''}{m.paramsB ? ` · ${m.paramsB}B` : ''}{m.licence ? ` · ${m.licence}` : ''}</span>
                    </div>
                  </td>
                  <td className="ad-hide-sm">{m.fleetModelName ?? <span className="st-faint">—</span>}</td>
                  <td className="is-num ad-hide-md">{m.listings}</td>
                  <td>
                    <Pill tone={m.state === 'active' ? 'good' : undefined}>{m.state}</Pill>{' '}
                    <button type="button" className="st-more ad-linkbtn" onClick={() => void setState(m, m.state === 'active' ? 'retired' : 'active')}>{m.state === 'active' ? 'Retire' : 'Restore'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form className="sw-pad mp-admin-om" onSubmit={add}>
        <p className="st-label">Add an open model</p>
        <div className="mp-admin-om-grid">
          <label className="st-field"><span className="st-field-label">Slug</span><input name="slug" required className="st-input" placeholder="deepseek-v4-pro" />{fields.slug && <span className="st-error">{fields.slug}</span>}</label>
          <label className="st-field"><span className="st-field-label">Name</span><input name="name" required className="st-input" placeholder="DeepSeek V4 Pro" />{fields.name && <span className="st-error">{fields.name}</span>}</label>
          <label className="st-field"><span className="st-field-label">Maker</span><input name="maker" required className="st-input" placeholder="DeepSeek" />{fields.maker && <span className="st-error">{fields.maker}</span>}</label>
          <label className="st-field"><span className="st-field-label">Licence</span><input name="licence" className="st-input" placeholder="MIT" /></label>
          <label className="st-field"><span className="st-field-label">Weights URL</span><input name="weightsUrl" type="url" className="st-input" />{fields.weightsUrl && <span className="st-error">{fields.weightsUrl}</span>}</label>
          <label className="st-field"><span className="st-field-label">Context</span><input name="contextTokens" inputMode="numeric" className="st-input" />{fields.contextTokens && <span className="st-error">{fields.contextTokens}</span>}</label>
          <label className="st-field"><span className="st-field-label">Params (B)</span><input name="paramsB" inputMode="decimal" className="st-input" /></label>
          <label className="st-field"><span className="st-field-label">Active params (B)</span><input name="activeParamsB" inputMode="decimal" className="st-input" /></label>
          <label className="st-field"><span className="st-field-label">Fleet model id</span><input name="fleetModelId" inputMode="numeric" className="st-input" placeholder="same weights, if any" />{fields.fleetModelId && <span className="st-error">{fields.fleetModelId}</span>}</label>
        </div>
        <div className="st-actions"><button type="submit" className="st-btn is-primary is-sm" disabled={busy}>{busy ? 'Adding…' : 'Add'}</button></div>
      </form>
    </Pane>
  );
}
