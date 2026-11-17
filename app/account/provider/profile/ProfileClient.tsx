'use client';

/**
 * The provider profile (§2.5, fields §4.1), in five parts: basics, links, regions, about and
 * social, plus the notice email. Each field says who sees it. Drafts save incomplete (M2 API
 * contract, difference 2): minimums and missing fields are the overview checklist's business, and
 * a link on a domain that is not verified yet is saved and marked here, in the API's words
 * (`unverifiedHosts`). The API applies every rule (protected names, stripped links in the about
 * text, claims refused); the page checks formats first so a typo is named before a round trip.
 */

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { Pane, Loader, Note, Pill } from '@/components/studio';
import { FieldError, ProviderHead, SectionNav, canEdit, useProviderOptions, useProviderSummary } from '@/components/marketplace/ProviderBits';
import { mpApi, PAGE_BASE, SLUG_RE, type ProviderSummary } from '@/lib/provider-account';

interface Profile {
  displayName: string; legalName: string; tradingName: string; country: string; companyNumber: string; vatNumber: string;
  /** M13: required with the company number before the agreement can be accepted (v1.0's acceptance block). */
  registeredOffice: string;
  noticeEmail: string; website: string; pricingUrl: string; getKeyUrl: string; docsUrl: string; statusUrl: string; support: string;
  about: string; foundedYear: string; hqCity: string; regions: string[]; x: string; linkedin: string; github: string;
}
interface ProfileData {
  profile: Partial<Record<keyof Profile, unknown>> & { noticeEmailConfirmedAt?: string | null; regions?: string[] };
  published?: unknown;
  reviewState?: string;
  regionsList?: string[];
  /** Per field, the host of a saved link that is not on a verified domain yet. */
  unverifiedHosts?: Record<string, string>;
  complete?: boolean;
}

const TEXT_FIELDS: Array<Exclude<keyof Profile, 'regions'>> = [
  'displayName', 'legalName', 'tradingName', 'country', 'companyNumber', 'vatNumber', 'registeredOffice', 'noticeEmail', 'website', 'pricingUrl',
  'getKeyUrl', 'docsUrl', 'statusUrl', 'support', 'about', 'foundedYear', 'hqCity', 'x', 'linkedin', 'github',
];

function fromApi(p: ProfileData['profile']): Profile {
  const out = { regions: Array.isArray(p.regions) ? p.regions.map(String) : [] } as Profile;
  for (const k of TEXT_FIELDS) {
    const v = p[k];
    (out as any)[k] = v === null || v === undefined ? '' : String(v);
  }
  return out;
}

const NAME_RE = /^[A-Za-z0-9 .&'-]{2,40}$/;
const HTTPS_RE = /^https:\/\/[^\s/]+\.[^\s]+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Format checks the API repeats. Empty fields and short texts pass: drafts save incomplete. */
function check(f: Profile, company: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (!NAME_RE.test(f.displayName.trim())) e.displayName = 'Use 2–40 characters: letters, digits, spaces and . - & \'';
  if (company && f.legalName.trim() && (f.legalName.trim().length < 2 || f.legalName.trim().length > 120)) e.legalName = 'Use 2–120 characters.';
  for (const k of ['website', 'pricingUrl', 'getKeyUrl', 'docsUrl', 'statusUrl'] as const) {
    if (f[k].trim() && !HTTPS_RE.test(f[k].trim())) e[k] = 'Enter a full address starting with https://';
  }
  if (f.support.trim() && !HTTPS_RE.test(f.support.trim()) && !EMAIL_RE.test(f.support.trim())) e.support = 'Enter an email address or an address starting with https://';
  if (f.noticeEmail.trim() && !EMAIL_RE.test(f.noticeEmail.trim())) e.noticeEmail = 'Enter an email address.';
  const about = f.about.trim();
  if (about.length > 1200) e.about = `Use at most 1,200 characters (now ${about.length.toLocaleString('en-US')}).`;
  if (about && about.split(/\n\s*\n/).filter(Boolean).length > 4) e.about = 'Use at most 4 paragraphs.';
  if (f.foundedYear.trim() && !/^(1[89]\d\d|20\d\d)$/.test(f.foundedYear.trim())) e.foundedYear = 'Enter a year, such as 2021.';
  if (f.x.trim() && !/^[A-Za-z0-9_]{1,15}$/.test(f.x.trim().replace(/^@/, ''))) e.x = 'An X handle has 1–15 letters, digits or underscores.';
  if (f.linkedin.trim() && !/^[a-z0-9][a-z0-9-]{1,99}$/.test(f.linkedin.trim())) e.linkedin = 'Use the part after linkedin.com/company/, in lowercase.';
  if (f.github.trim() && !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(f.github.trim())) e.github = 'Use the organisation name as it appears after github.com/.';
  return e;
}

/** One labelled field: who sees it, the input, a hint, and the API's or our message. */
function Field({ label, who, hint, error, warn, children, wide }: { label: string; who?: string; hint?: ReactNode; error?: string; warn?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`st-field${wide ? ' is-wide' : ''}`}>
      <span className="st-field-label">{label}{who && <small>{who}</small>}</span>
      {children}
      {hint && <span className="st-hint">{hint}</span>}
      {warn && !error && <span className="mp-warn">{warn} <a href="/account/provider/domains">Verify it</a></span>}
      <FieldError text={error} />
    </label>
  );
}

function Part({ title, sub, children, id }: { title: string; sub?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <div className="mp-part" id={id}>
      <div className="mp-part-h">
        <h3 className="mp-part-t">{title}</h3>
        {sub && <p className="mp-part-s">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export default function ProfileClient({ initial }: { initial: ProviderSummary }) {
  const { status } = useSession();
  const [s, reload] = useProviderSummary(initial);
  const [data, setData] = useState<ProfileData | null>(null);
  const [f, setF] = useState<Profile | null>(null);
  const [saved, setSaved] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The page address is held for the account until its page is first published (§2.2), and can
  // change until then; it is not part of the profile read, so it comes from the summary.
  const heldSlug = s.provider?.slug ? null : (s.provider?.proposedSlug ?? null);
  const [slug, setSlug] = useState<string>(heldSlug ?? '');
  useEffect(() => { setSlug(heldSlug ?? ''); }, [heldSlug]);
  const { countries, regions } = useProviderOptions();
  const editable = canEdit(s);
  const company = s.provider?.kind !== 'individual';

  const load = useCallback(async () => {
    const r = await mpApi<ProfileData>('/profile');
    if (r.ok && r.data?.profile) {
      const p = fromApi(r.data.profile);
      setData(r.data); setF(p); setSaved(JSON.stringify(p)); setLoadError(null);
    } else {
      setLoadError(r.error);
    }
  }, []);
  useEffect(() => { if (status === 'authenticated') void load(); }, [status, load]);

  // A link to #notice from the overview lands on the notice email once the form is there.
  useEffect(() => {
    if (f && window.location.hash === '#notice') document.getElementById('notice')?.scrollIntoView({ block: 'start' });
  }, [f]);

  if (status === 'loading') return <div data-page-loading><Loader label="Loading your profile" minHeight={420} /></div>;

  const set = (patch: Partial<Profile>) => setF(prev => (prev ? { ...prev, ...patch } : prev));
  const slugChanged = !!heldSlug && slug !== heldSlug;
  const dirty = (!!f && JSON.stringify(f) !== saved) || slugChanged;
  const regionsList = data?.regionsList?.length ? data.regionsList : regions;
  const unverified = data?.unverifiedHosts ?? {};
  /** The API's note for a saved link whose host is not on a verified domain yet. */
  const hostNote = (k: string) => (unverified[k] && f && f[k as keyof Profile] === JSON.parse(saved || '{}')[k]
    ? `${unverified[k]} is not on a verified domain yet.` : undefined);
  const confirmedAt = data?.profile?.noticeEmailConfirmedAt ?? null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!f) return;
    const found = check(f, company);
    if (slugChanged && !SLUG_RE.test(slug)) found.slug = 'Use lowercase letters, digits and hyphens (1–32 characters, no hyphen at either end).';
    setErrors(found);
    if (Object.keys(found).length) { setMsg({ text: 'Some fields need attention.', bad: true }); return; }
    setBusy(true);
    // Only what changed: a PUT takes any subset (M2 contract §4), and an untouched field is never
    // sent back to be checked again.
    const before = JSON.parse(saved || '{}') as Partial<Profile>;
    const body: Record<string, unknown> = {};
    if (JSON.stringify(f.regions) !== JSON.stringify(before.regions ?? [])) body.regions = f.regions;
    for (const k of TEXT_FIELDS) {
      if (f[k] === (before[k] ?? '')) continue;
      const v = f[k].trim();
      body[k] = v === '' ? null : k === 'x' ? v.replace(/^@/, '') : k === 'foundedYear' ? Number(v) : v;
    }
    if (!company) { delete body.legalName; delete body.companyNumber; delete body.vatNumber; delete body.registeredOffice; }
    if (slugChanged) body.slug = slug;
    const r = await mpApi<ProfileData>('/profile', { method: 'PUT', body });
    setBusy(false);
    if (r.ok) {
      if (r.data?.profile) {
        const p = fromApi(r.data.profile);
        setData(d => ({ ...(d ?? {}), ...r.data!, regionsList: r.data!.regionsList ?? d?.regionsList }));
        setF(p); setSaved(JSON.stringify(p));
      } else {
        setSaved(JSON.stringify(f));
      }
      setErrors({});
      setMsg({ text: 'Profile saved.' });
      void reload();
    } else {
      setErrors(r.fields ?? {});
      setMsg({ text: r.error ?? 'Could not save the profile.', bad: true });
    }
  };

  const approved = s.provider?.state === 'approved';

  return (
    <>
      <ProviderHead
        summary={s}
        title="Profile"
        lead="What your page will say about you, and where we reach you. Each field says who sees it."
      />

      <div className="st-body sw-body">
        <SectionNav current="/account/provider/profile" kind={s.provider?.kind} />
        {msg && <div role="status" className={`st-note sw-flash${msg.bad ? ' is-bad' : ''}`}><div>{msg.text}</div></div>}
        {approved && (
          <Note title="Your page is published">
            A new name, page address, domain or logo is reviewed first; until then your page keeps the published value.
            Other changes go live after our automatic checks.
          </Note>
        )}

        {!f ? (
          loadError ? <Note tone="bad" title="The profile did not load">{loadError}</Note> : <Loader label="Loading your profile" minHeight={320} />
        ) : (
          <form onSubmit={save} noValidate>
            <fieldset className="sw-fieldset" disabled={!editable || busy}>
              <Pane>
                <div className="mp-form">
                  <Part title="Basics">
                    <div className="sw-grid2">
                      <Field label={company ? 'Display name' : 'Handle'} who="public" error={errors.displayName}>
                        <input className="st-input" value={f.displayName} maxLength={40} onChange={e => set({ displayName: e.target.value })} />
                      </Field>
                      {company && (
                        <Field label="Legal name" who="public, as “Operated by …”" error={errors.legalName}>
                          <input className="st-input" value={f.legalName} maxLength={120} onChange={e => set({ legalName: e.target.value })} />
                        </Field>
                      )}
                      <Field label="Trading name" who="optional · public" error={errors.tradingName}>
                        <input className="st-input" value={f.tradingName} maxLength={120} onChange={e => set({ tradingName: e.target.value })} />
                      </Field>
                      <Field label={company ? 'Country of registration' : 'Country'} who="public" error={errors.country}>
                        <select className="st-select" value={f.country} onChange={e => set({ country: e.target.value })}>
                          <option value="">Choose a country</option>
                          {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                      </Field>
                      {company && (
                        <>
                          <Field label="Company registration number" who="required to accept the agreement · not public" error={errors.companyNumber}>
                            <input className="st-input" value={f.companyNumber} maxLength={60} onChange={e => set({ companyNumber: e.target.value })} />
                          </Field>
                          <Field label="Registered office" who="required to accept the agreement · not public" error={errors.registeredOffice}>
                            <input className="st-input" value={f.registeredOffice} maxLength={300} autoComplete="street-address" onChange={e => set({ registeredOffice: e.target.value })} />
                          </Field>
                          <Field label="VAT number" who="optional · not public" error={errors.vatNumber}>
                            <input className="st-input" value={f.vatNumber} maxLength={40} onChange={e => set({ vatNumber: e.target.value })} />
                          </Field>
                        </>
                      )}
                    </div>
                    {heldSlug !== null && (
                      <Field label="Page address" error={errors.slug} hint="You can change it until your page is first published.">
                        <input className="st-input" value={slug} maxLength={32} autoCapitalize="none" spellCheck={false} onChange={e => setSlug(e.target.value.toLowerCase())} />
                        <span className="mp-url">{PAGE_BASE}<b>{slug || '…'}</b></span>
                      </Field>
                    )}
                  </Part>

                  <Part title="Notice email" id="notice" sub="Where we send formal notices about your provider account. Nobody else sees it.">
                    <div className="sw-grid2 sw-align-end">
                      <Field label="Notice email" who="not public" error={errors.noticeEmail}>
                        <input className="st-input" type="email" value={f.noticeEmail} maxLength={254} onChange={e => set({ noticeEmail: e.target.value })} placeholder="legal@example.com" />
                      </Field>
                      <div className="mp-inline">
                        {confirmedAt && f.noticeEmail && f.noticeEmail === JSON.parse(saved || '{}').noticeEmail && (
                          <Pill tone="good">Confirmed {new Date(confirmedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Pill>
                        )}
                      </div>
                    </div>
                  </Part>

                  <Part title="Links" sub="Each address must be on one of your verified domains, except where a field says otherwise. A link on a domain you have not verified yet is saved and marked until you verify it.">
                    <div className="sw-grid2">
                      <Field label="Website" who="public" error={errors.website} warn={hostNote('website')}>
                        <input className="st-input" type="url" inputMode="url" value={f.website} maxLength={300} onChange={e => set({ website: e.target.value })} placeholder="https://example.com" />
                      </Field>
                      <Field label="Pricing page" who="public" hint="Needed before you submit." error={errors.pricingUrl} warn={hostNote('pricingUrl')}>
                        <input className="st-input" type="url" inputMode="url" value={f.pricingUrl} maxLength={300} onChange={e => set({ pricingUrl: e.target.value })} placeholder="https://example.com/pricing" />
                      </Field>
                      <Field label="Get-a-key page" who="public" hint="Needed before you submit. The main button on your page." error={errors.getKeyUrl} warn={hostNote('getKeyUrl')}>
                        <input className="st-input" type="url" inputMode="url" value={f.getKeyUrl} maxLength={300} onChange={e => set({ getKeyUrl: e.target.value })} placeholder="https://example.com/keys" />
                      </Field>
                      <Field label="Docs" who="optional · public" hint="Also allowed: github.com/<org> or huggingface.co/<org>." error={errors.docsUrl} warn={hostNote('docsUrl')}>
                        <input className="st-input" type="url" inputMode="url" value={f.docsUrl} maxLength={300} onChange={e => set({ docsUrl: e.target.value })} placeholder="https://docs.example.com" />
                      </Field>
                      <Field label="Status page" who="optional · public" error={errors.statusUrl} warn={hostNote('statusUrl')}>
                        <input className="st-input" type="url" inputMode="url" value={f.statusUrl} maxLength={300} onChange={e => set({ statusUrl: e.target.value })} placeholder="https://status.example.com" />
                      </Field>
                      <Field label="Support" who="public" hint="An email address, or an address starting with https://." error={errors.support} warn={hostNote('support')}>
                        <input className="st-input" value={f.support} maxLength={300} onChange={e => set({ support: e.target.value })} placeholder="support@example.com" />
                      </Field>
                    </div>
                  </Part>

                  <Part title="Regions served" sub="Where your service runs. At least one.">
                    <div className="sw-marks" role="group" aria-label="Regions served">
                      {regionsList.map(r => (
                        <label key={r} className="sw-mark">
                          <input type="checkbox" className="st-check" checked={f.regions.includes(r)}
                            onChange={e => set({ regions: e.target.checked ? [...f.regions, r] : f.regions.filter(x => x !== r) })} />
                          {r}
                        </label>
                      ))}
                    </div>
                    <FieldError text={errors.regions} />
                  </Part>

                  <Part title="About" sub="Plain text, 80 to 1,200 characters, at most four paragraphs. Links, email addresses and phone numbers are removed, and the text may not claim scores or rankings.">
                    <Field label="About your company" who="public" error={errors.about}>
                      <textarea className="st-textarea" rows={6} value={f.about} maxLength={1400} onChange={e => set({ about: e.target.value })} />
                      <span className={`mp-count${f.about.trim().length > 1200 ? ' is-bad' : ''}`}>{f.about.trim().length.toLocaleString('en-US')} of 1,200</span>
                    </Field>
                    <div className="sw-grid2">
                      <Field label="Founded" who="optional · public" error={errors.foundedYear}>
                        <input className="st-input" inputMode="numeric" value={f.foundedYear} maxLength={4} onChange={e => set({ foundedYear: e.target.value })} placeholder="2021" />
                      </Field>
                      <Field label="Headquarters city" who="optional · public" error={errors.hqCity}>
                        <input className="st-input" value={f.hqCity} maxLength={80} onChange={e => set({ hqCity: e.target.value })} />
                      </Field>
                    </div>
                  </Part>

                  <Part title="Social" sub="Handles only: we build the links ourselves.">
                    <div className="sw-grid2">
                      <Field label="X" who="optional · public" hint="The handle, without @." error={errors.x}>
                        <input className="st-input" value={f.x} maxLength={16} autoCapitalize="none" spellCheck={false} onChange={e => set({ x: e.target.value })} placeholder="example" />
                      </Field>
                      <Field label="LinkedIn" who="optional · public" hint="The part after linkedin.com/company/." error={errors.linkedin}>
                        <input className="st-input" value={f.linkedin} maxLength={100} autoCapitalize="none" spellCheck={false} onChange={e => set({ linkedin: e.target.value })} placeholder="example" />
                      </Field>
                      <Field label="GitHub" who="optional · public" hint="The organisation after github.com/." error={errors.github}>
                        <input className="st-input" value={f.github} maxLength={39} autoCapitalize="none" spellCheck={false} onChange={e => set({ github: e.target.value })} placeholder="example" />
                      </Field>
                    </div>
                  </Part>
                </div>
              </Pane>
            </fieldset>

            {editable && (
              <div className="st-savebar">
                <span>{busy ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved'}</span>
                <button type="submit" className="st-btn is-primary" disabled={busy || !dirty}>Save profile</button>
              </div>
            )}
          </form>
        )}
      </div>
    </>
  );
}
