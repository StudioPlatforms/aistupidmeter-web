'use client';

/**
 * Data handling (§2.7, §9.9): what the provider declares about prompts, training, logs, regions,
 * sub-processors and certifications, with links to its own policies. Every save is a new
 * version; earlier ones are kept. Wherever the declaration is shown it reads "Declared by
 * <provider> on <date>. Not audited by AI Stupid Level.", and certifications are marked
 * self-declared, so the summary beside the form uses the same words.
 */

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { Pane, Loader, Note } from '@/components/studio';
import { FieldError, ProviderHead, SectionNav, canEdit, useProviderOptions, useProviderSummary } from '@/components/marketplace/ProviderBits';
import { mpApi, type ProviderSummary } from '@/lib/provider-account';

type Retention = 'none' | 'days' | 'not_stated';
type Training = 'never' | 'opt_in' | 'opt_out' | 'yes' | 'not_stated';

interface Declaration {
  version?: number;
  promptsRetention: Retention;
  retentionDays?: number | null;
  trainingUse: Training;
  logContents?: string | string[] | null;
  processingRegions?: string[] | null;
  subprocessors?: string[] | null;
  certifications?: string[] | null;
  privacyUrl?: string | null;
  termsUrl?: string | null;
  dpaUrl?: string | null;
  declaredAt?: string | null;
}
interface DataResponse { current: Declaration | null; versions?: Array<{ version: number; declaredAt: string }> }

interface Form {
  promptsRetention: Retention | ''; retentionDays: string; trainingUse: Training | ''; logContents: string;
  processingRegions: string[]; subprocessors: string; certifications: string; privacyUrl: string; termsUrl: string; dpaUrl: string;
}

const RETENTION: Array<{ id: Retention; label: string }> = [
  { id: 'none', label: 'Not kept' },
  { id: 'days', label: 'Kept for a number of days' },
  { id: 'not_stated', label: 'Not stated' },
];
const TRAINING: Array<{ id: Training; label: string; shown: string }> = [
  { id: 'never', label: 'Never', shown: 'Never' },
  { id: 'opt_in', label: 'Only if the customer opts in', shown: 'Only if you opt in' },
  { id: 'opt_out', label: 'Unless the customer opts out', shown: 'Unless you opt out' },
  { id: 'yes', label: 'Yes', shown: 'Yes' },
  { id: 'not_stated', label: 'Not stated', shown: 'Not stated' },
];

const lines = (t: string) => t.split('\n').map(x => x.trim()).filter(Boolean);
const HTTPS_RE = /^https:\/\/[^\s/]+\.[^\s]+$/i;

function toForm(d: Declaration | null): Form {
  return {
    promptsRetention: d?.promptsRetention ?? '',
    retentionDays: d?.retentionDays ? String(d.retentionDays) : '',
    trainingUse: d?.trainingUse ?? '',
    logContents: Array.isArray(d?.logContents) ? d!.logContents.join('\n') : (d?.logContents ?? ''),
    processingRegions: d?.processingRegions ?? [],
    subprocessors: (d?.subprocessors ?? []).join('\n'),
    certifications: (d?.certifications ?? []).join('\n'),
    privacyUrl: d?.privacyUrl ?? '',
    termsUrl: d?.termsUrl ?? '',
    dpaUrl: d?.dpaUrl ?? '',
  };
}

function check(f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.promptsRetention) e.promptsRetention = 'Choose one.';
  if (f.promptsRetention === 'days' && !(Number(f.retentionDays) >= 1 && Number(f.retentionDays) <= 3650 && Number.isInteger(Number(f.retentionDays)))) {
    e.retentionDays = 'Enter a whole number of days, 1 to 3,650.';
  }
  if (!f.trainingUse) e.trainingUse = 'Choose one.';
  for (const k of ['privacyUrl', 'termsUrl', 'dpaUrl'] as const) {
    if (f[k].trim() && !HTTPS_RE.test(f[k].trim())) e[k] = 'Enter a full address starting with https://';
  }
  return e;
}

const day = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function Q({ title, sub, children, error }: { title: string; sub?: ReactNode; children: ReactNode; error?: string }) {
  return (
    <fieldset className="sw-fieldset mp-q">
      <legend>{title}</legend>
      <div className="mp-q-body">
        {sub && <p className="mp-part-s">{sub}</p>}
        {children}
        <FieldError text={error} />
      </div>
    </fieldset>
  );
}

export default function DataClient({ initial }: { initial: ProviderSummary }) {
  const { status } = useSession();
  const [s] = useProviderSummary(initial);
  const [data, setData] = useState<DataResponse | null>(null);
  const [f, setF] = useState<Form>(toForm(null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editable = canEdit(s);
  const { regions } = useProviderOptions();

  const load = useCallback(async () => {
    const r = await mpApi<DataResponse>('/data');
    if (r.ok && r.data) { setData(r.data); setF(toForm(r.data.current)); setLoadError(null); }
    else setLoadError(r.error);
  }, []);
  useEffect(() => { if (status === 'authenticated') void load(); }, [status, load]);

  if (status === 'loading') return <div data-page-loading><Loader label="Loading" minHeight={420} /></div>;

  const set = (patch: Partial<Form>) => setF(prev => ({ ...prev, ...patch }));
  const regionsList = regions;
  const current = data?.current ?? null;
  const name = s.provider?.displayName ?? 'the provider';

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const found = check(f);
    setErrors(found);
    if (Object.keys(found).length) { setMsg({ text: 'Some answers need attention.', bad: true }); return; }
    setBusy(true);
    const r = await mpApi<{ current?: Declaration }>('/data', {
      method: 'POST',
      body: {
        promptsRetention: f.promptsRetention,
        retentionDays: f.promptsRetention === 'days' ? Number(f.retentionDays) : null,
        trainingUse: f.trainingUse,
        logContents: f.logContents.trim() || null,
        processingRegions: f.processingRegions,
        subprocessors: lines(f.subprocessors),
        certifications: lines(f.certifications),
        privacyUrl: f.privacyUrl.trim() || null,
        termsUrl: f.termsUrl.trim() || null,
        dpaUrl: f.dpaUrl.trim() || null,
      },
    });
    setBusy(false);
    if (r.ok) {
      setErrors({});
      setMsg({ text: 'Saved as a new version.' });
      void load();
    } else {
      setErrors(r.fields ?? {});
      setMsg({ text: r.error ?? 'Could not save.', bad: true });
    }
  };

  const retentionShown = (d: Declaration) =>
    d.promptsRetention === 'none' ? 'Not kept' : d.promptsRetention === 'days' ? `${d.retentionDays} day${d.retentionDays === 1 ? '' : 's'}` : 'Not stated';
  const list = (v?: string[] | string | null) => (Array.isArray(v) ? v.join(', ') : v) || '—';

  return (
    <>
      <ProviderHead
        summary={s}
        title="Data handling"
        lead="What happens to the prompts and answers that reach your service. Answer each question, and link your own policies."
      />

      <div className="st-body sw-body">
        <SectionNav current="/account/provider/data" kind={s.provider?.kind} />
        {msg && <div role="status" className={`st-note sw-flash${msg.bad ? ' is-bad' : ''}`}><div>{msg.text}</div></div>}
        {loadError && !data && <Note tone="bad" title="This page did not load">{loadError}</Note>}
        {!data && !loadError && <Loader label="Loading your answers" minHeight={320} />}

        {data && (
          <div className="st-split">
            <form onSubmit={save} noValidate>
              <fieldset className="sw-fieldset" disabled={!editable || busy}>
                <Pane title={current ? `Your declaration (version ${current.version ?? 1})` : 'Your declaration'}>
                  <div className="mp-form">
                    <Q title="Are prompts and outputs kept?" error={errors.promptsRetention}>
                      <div className="sw-toggles">
                        {RETENTION.map(o => (
                          <label key={o.id} className="st-toggle">
                            <input type="radio" name="retention" className="st-check" checked={f.promptsRetention === o.id} onChange={() => set({ promptsRetention: o.id })} />
                            <b>{o.label}</b>
                          </label>
                        ))}
                      </div>
                      {f.promptsRetention === 'days' && (
                        <label className="st-field">
                          <span className="st-field-label">For how many days?</span>
                          <span className="mp-inline">
                            <input className="st-input" inputMode="numeric" value={f.retentionDays} maxLength={4} onChange={e => set({ retentionDays: e.target.value.replace(/[^0-9]/g, '') })} aria-label="Days" />
                            <span className="st-muted">days</span>
                          </span>
                          <FieldError text={errors.retentionDays} />
                        </label>
                      )}
                    </Q>

                    <Q title="Are prompts and outputs used for training?" error={errors.trainingUse}>
                      <div className="sw-toggles">
                        {TRAINING.map(o => (
                          <label key={o.id} className="st-toggle">
                            <input type="radio" name="training" className="st-check" checked={f.trainingUse === o.id} onChange={() => set({ trainingUse: o.id })} />
                            <b>{o.label}</b>
                          </label>
                        ))}
                      </div>
                    </Q>

                    <Q title="What do your logs contain?" sub="For example: request time, model and token counts, no prompt text." error={errors.logContents}>
                      <textarea className="st-textarea" rows={3} maxLength={500} value={f.logContents} onChange={e => set({ logContents: e.target.value })} aria-label="What your logs contain" />
                    </Q>

                    <Q title="Where are requests processed?" error={errors.processingRegions}>
                      <div className="sw-marks" role="group" aria-label="Where requests are processed">
                        {regionsList.map(r => (
                          <label key={r} className="sw-mark">
                            <input type="checkbox" className="st-check" checked={f.processingRegions.includes(r)}
                              onChange={e => set({ processingRegions: e.target.checked ? [...f.processingRegions, r] : f.processingRegions.filter(x => x !== r) })} />
                            {r}
                          </label>
                        ))}
                      </div>
                    </Q>

                    <Q title="Sub-processors" sub="One per line: the companies that process requests for you." error={errors.subprocessors}>
                      <textarea className="st-textarea" rows={3} maxLength={2000} value={f.subprocessors} onChange={e => set({ subprocessors: e.target.value })} aria-label="Sub-processors" />
                    </Q>

                    <Q title="Certifications" sub="One per line. They are shown as self-declared." error={errors.certifications}>
                      <textarea className="st-textarea" rows={3} maxLength={1000} value={f.certifications} onChange={e => set({ certifications: e.target.value })} aria-label="Certifications" />
                    </Q>

                    <div className="mp-part">
                      <div className="mp-part-h"><h3 className="mp-part-t">Your policies</h3></div>
                      <div className="sw-grid2">
                        {([['privacyUrl', 'Privacy policy'], ['termsUrl', 'Terms'], ['dpaUrl', 'Data processing agreement']] as const).map(([k, label]) => (
                          <label key={k} className="st-field">
                            <span className="st-field-label">{label}<small>optional</small></span>
                            <input className="st-input" type="url" inputMode="url" maxLength={300} value={f[k]} onChange={e => set({ [k]: e.target.value } as Partial<Form>)} placeholder="https://" />
                            <FieldError text={errors[k]} />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  {editable && (
                    <div className="st-actions sw-gap-top">
                      <button type="submit" className="st-btn is-primary" disabled={busy}>{busy ? 'Saving…' : 'Save declaration'}</button>
                      <span className="st-hint">Each save is kept as a new version.</span>
                    </div>
                  )}
                </Pane>
              </fieldset>
            </form>

            <div className="sw-col">
              {current ? (
                <Pane title="Summary" sub={`Declared by ${name} on ${day(current.declaredAt)}. Not audited by AI Stupid Level.`} delay={0.06}>
                  <dl className="st-kv is-tight">
                    <div><dt>Prompts and outputs kept</dt><dd>{retentionShown(current)}</dd></div>
                    <div><dt>Used for training</dt><dd>{TRAINING.find(t => t.id === current.trainingUse)?.shown ?? 'Not stated'}</dd></div>
                    <div><dt>Logs contain</dt><dd>{list(current.logContents)}</dd></div>
                    <div><dt>Processed in</dt><dd>{list(current.processingRegions)}</dd></div>
                    <div><dt>Sub-processors</dt><dd>{list(current.subprocessors)}</dd></div>
                    <div><dt>Certifications</dt><dd>{current.certifications?.length ? current.certifications.map(c => `${c} (self-declared)`).join(', ') : '—'}</dd></div>
                  </dl>
                </Pane>
              ) : (
                <Pane title="Summary" delay={0.06}>
                  <p className="sw-quiet">Nothing declared yet. Your first save becomes version 1.</p>
                </Pane>
              )}
              {data.versions && data.versions.length > 1 && (
                <Pane title="Versions" ruled flush delay={0.1}>
                  <div className="st-rows">
                    {data.versions.map(v => (
                      <div key={v.version} className="st-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                        <div className="st-row-main"><div className="st-row-t">Version {v.version}</div></div>
                        <div className="st-row-end st-muted">{day(v.declaredAt)}</div>
                      </div>
                    ))}
                  </div>
                </Pane>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
