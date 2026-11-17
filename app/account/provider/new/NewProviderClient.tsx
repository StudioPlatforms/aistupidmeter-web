'use client';

/**
 * Creating a provider account (§2.2): what kind of provider, then the details for that kind, with
 * a preview of the page address proposed from the website (together.ai → together) that the
 * person can change. The API checks every rule again (names, protected brands, reserved and taken
 * addresses, countries, limits) and its sentence is shown next to the field it is about.
 *
 * Only accounts with a confirmed email can create one; the page says so first and offers the link
 * again, through the same route the settings page uses.
 */

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Pane, Empty, Loader, Note } from '@/components/studio';
import { FieldError, ProviderHead, useProviderOptions } from '@/components/marketplace/ProviderBits';
import {
  chooseProvider, mpApi, slugFromWebsite, slugify, PAGE_BASE, SLUG_RE,
  type ProviderDTO, type ProviderKind, type ProviderSummary,
} from '@/lib/provider-account';

const ar = <span className="st-ar" aria-hidden="true">→</span>;

/** §4.1: 2–40 characters from ASCII letters, digits, space and . - & ' */
const NAME_RE = /^[A-Za-z0-9 .&'-]{2,40}$/;

interface Form {
  displayName: string; legalName: string; website: string; country: string; companyNumber: string;
  slug: string; charges: '' | 'yes' | 'no'; tradingName: string;
}
const EMPTY: Form = { displayName: '', legalName: '', website: '', country: '', companyNumber: '', slug: '', charges: '', tradingName: '' };

/** The checks the API repeats, run here first so a typo is named before a round trip. */
function check(kind: ProviderKind, f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  if (!NAME_RE.test(f.displayName.trim())) {
    e.displayName = kind === 'company'
      ? 'Use 2–40 characters: letters, digits, spaces and . - & \''
      : 'Use 2–40 characters for your handle: letters, digits, spaces and . - & \'';
  }
  if (kind === 'company') {
    const legal = f.legalName.trim();
    if (legal.length < 2 || legal.length > 120) e.legalName = 'Enter your company’s legal name (2–120 characters).';
    if (!/^https:\/\/[^\s/]+\.[^\s]+$/i.test(f.website.trim())) e.website = 'Enter your website’s address, starting with https://';
  } else if (f.website.trim() && !/^https:\/\/[^\s/]+\.[^\s]+$/i.test(f.website.trim())) {
    e.website = 'Enter an address starting with https://, or leave this empty.';
  }
  if (!f.country) e.country = kind === 'company' ? 'Choose the country your company is registered in.' : 'Choose your country.';
  if (!f.slug) e.slug = 'Choose your page address.';
  else if (!SLUG_RE.test(f.slug)) e.slug = 'Use lowercase letters, digits and hyphens (1–32 characters, no hyphen at either end).';
  if (kind === 'individual') {
    if (!f.charges) e.charges = 'Choose one.';
    if (f.charges === 'yes' && f.tradingName.trim().length < 2) e.tradingName = 'Enter the name you trade under.';
  }
  return e;
}

export default function NewProviderClient({ initial }: { initial: ProviderSummary }) {
  const { data: session, status } = useSession();
  // M12: at the opening only companies create provider accounts (the API refuses an individual one); the individual
  // branches below stay for Phase 4, when individual listing opens.
  const [kind] = useState<ProviderKind>('company');
  const [f, setF] = useState<Form>(EMPTY);
  const [slugEdited, setSlugEdited] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Created, but without the website's domain (see submit): said once before moving on.
  const [domainHeld, setDomainHeld] = useState(false);
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const { countries } = useProviderOptions();
  // Whether the address is free, asked once typing pauses (GET /account/provider/slug).
  const [slugCheck, setSlugCheck] = useState<{ slug: string; available: boolean; message: string | null } | null>(null);
  useEffect(() => {
    const slug = f.slug;
    if (!SLUG_RE.test(slug)) { setSlugCheck(null); return; }
    let live = true;
    const t = window.setTimeout(async () => {
      const r = await mpApi<{ available: boolean; error?: string; message?: string }>(`/slug?value=${encodeURIComponent(slug)}`, { provider: null });
      if (live && r.ok && r.data) setSlugCheck({ slug, available: r.data.available, message: r.data.message ?? null });
    }, 450);
    return () => { live = false; window.clearTimeout(t); };
  }, [f.slug]);

  if (status === 'loading') return <div data-page-loading><Loader label="Loading" minHeight={420} /></div>;

  // An unconfirmed email is one of the API's form-independent blocks (createBlocked); it gets its
  // own note with the link again, not the "cannot create another" page.
  const emailConfirmed = initial.createBlocked?.error === 'email_unconfirmed'
    ? false
    : initial.emailConfirmed ?? (session?.user as any)?.emailVerified !== false;

  const set = (patch: Partial<Form>) => {
    setF(prev => {
      const next = { ...prev, ...patch };
      // The address follows the website (or, for an individual without one, the handle) until
      // the person edits it themselves.
      if (!slugEdited && ('website' in patch || 'displayName' in patch)) {
        const fromSite = next.website ? slugFromWebsite(next.website) : '';
        next.slug = kind === 'company' ? fromSite : (fromSite || slugify(next.displayName));
      }
      return next;
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    const found = check(kind, f);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    const body = kind === 'company'
      ? {
          kind, displayName: f.displayName.trim(), legalName: f.legalName.trim(), website: f.website.trim(),
          country: f.country, companyNumber: f.companyNumber.trim() || undefined, slug: f.slug,
        }
      : {
          kind, handle: f.displayName.trim(), country: f.country, website: f.website.trim() || undefined,
          chargesForAccess: f.charges === 'yes', tradingName: f.charges === 'yes' ? f.tradingName.trim() : undefined, slug: f.slug,
        };
    const r = await mpApi<{ provider?: ProviderDTO } & Partial<ProviderDTO>>('', { method: 'POST', body, provider: null });
    if (!r.ok) {
      setBusy(false);
      const fieldFor: Record<string, string> = { name_protected: 'displayName', slug_taken: 'slug', slug_reserved: 'slug', country_refused: 'country' };
      const field = r.code ? fieldFor[r.code] : undefined;
      // The API names fields as the form does, except an individual's name (`handle`) and the
      // trader question (`chargesForAccess`).
      const fields = { ...(r.fields ?? {}) };
      if (fields.handle && !fields.displayName) fields.displayName = fields.handle;
      if (fields.chargesForAccess && !fields.charges) fields.charges = fields.chargesForAccess;
      setErrors({ ...fields, ...(field && r.error && !fields[field] ? { [field]: r.error } : {}) });
      if (!field) setProblem(r.error);
      return;
    }
    const created = r.data?.provider ?? (r.data as ProviderDTO | null);
    if (created?.publicId) chooseProvider(created.publicId);
    // A company's website domain becomes its first domain, unless another provider account released
    // it less than 30 days ago: the API then creates the account without it (contract v3.2). Nothing
    // later on the way says so, so this page does, once.
    if (kind === 'company' && created?.counts && created.counts.pendingDomains === 0 && created.counts.verifiedDomains === 0) {
      setBusy(false);
      setDomainHeld(true);
      return;
    }
    // A full page load, so the session (and with it the sidebar's Provider group) is read again.
    window.location.assign('/account/provider');
  };

  const resend = async () => {
    setSendState('sending');
    try {
      const res = await fetch('/api/auth/send-verification', { method: 'POST' });
      const j = await res.json().catch(() => null);
      setSendState(j?.success ? 'sent' : 'failed');
    } catch {
      setSendState('failed');
    }
  };

  const head = (
    <ProviderHead
      summary={{ ...initial, provider: null }}
      title={domainHeld ? 'Provider account created' : 'Create your provider account'}
      lead={domainHeld
        ? 'Where an inference provider sets up its account: company details, domains and data handling.'
        : 'Free, with no card. Add your company’s details; you can change them later.'}
    />
  );

  if (initial.canCreate === false && emailConfirmed) {
    const limit = initial.createBlocked?.error === 'limit_reached';
    return (
      <>
        {head}
        <div className="st-body sw-body">
          <Empty
            title={limit ? 'You cannot create another provider account' : 'You cannot create a provider account just now'}
            actions={initial.provider ? <Link href="/account/provider" className="st-btn is-primary">Open your provider account {ar}</Link> : undefined}
          >
            {initial.createBlocked?.message ?? 'Each person can own one provider account.'}
          </Empty>
        </div>
      </>
    );
  }

  if (domainHeld) {
    return (
      <>
        {head}
        <div className="st-body sw-body">
          <Empty
            title="Your website’s domain was not added"
            // A full page load, as after any creation: the session is read again.
            actions={<a href="/account/provider" className="st-btn is-primary">Open your provider account {ar}</a>}
          >
            Another provider account released it less than 30 days ago, so it cannot be added yet. Add it on Domains once the 30 days are over.
          </Empty>
        </div>
      </>
    );
  }

  const field = (name: keyof Form | 'charges') => errors[name];

  return (
    <>
      {head}
      <div className="st-body sw-body sw-narrow">
        {!emailConfirmed && (
          <Note tone="warn" title="Confirm your email first">
            Provider accounts need a confirmed email address. Open the link in our confirmation email, or send it again.
            <div className="st-actions sw-gap-top">
              {sendState === 'sent'
                ? <span role="status">A new link is on its way. It can take a minute; check your spam folder too.</span>
                : <button type="button" className="st-btn is-sm" onClick={resend} disabled={sendState === 'sending'}>{sendState === 'sending' ? 'Sending…' : 'Send the link again'}</button>}
              {sendState === 'failed' && <span className="st-error" role="alert">That did not work. Please wait a minute and try again.</span>}
            </div>
          </Note>
        )}

        <form onSubmit={submit} className="mp-form" noValidate>
          <Pane title="What kind of provider are you?">
            <div className="st-cards mp-kinds">
              <div className="st-card mp-kind">
                <span className="mp-kind-text">
                  <span className="st-card-t">A company</span>
                  <span className="st-card-d">You sell inference under a company name. You verify your domain.</span>
                </span>
              </div>
            </div>
            <p className="st-hint mp-kind-later">Individual hosts can&apos;t open a provider account yet. Listing opens to companies first.</p>
          </Pane>

          <Pane title={kind === 'company' ? 'Your company' : 'About you'} delay={0.06}>
            <fieldset className="sw-fieldset" disabled={!emailConfirmed || busy}>
              <div className="sw-stack">
                <div className="sw-grid2">
                  <label className="st-field">
                    <span className="st-field-label">{kind === 'company' ? 'Display name' : 'Handle'} <small>public</small></span>
                    <input className="st-input" value={f.displayName} maxLength={40} autoComplete="organization"
                      onChange={e => set({ displayName: e.target.value })} placeholder={kind === 'company' ? 'Acme Cloud' : 'Your public name'} aria-invalid={!!field('displayName')} />
                    <FieldError text={field('displayName')} />
                  </label>
                  {kind === 'company' && (
                    <label className="st-field">
                      <span className="st-field-label">Legal name <small>public, as “Operated by …”</small></span>
                      <input className="st-input" value={f.legalName} maxLength={120}
                        onChange={e => set({ legalName: e.target.value })} placeholder="Acme Cloud Ltd" aria-invalid={!!field('legalName')} />
                      <FieldError text={field('legalName')} />
                    </label>
                  )}
                </div>

                <div className="sw-grid2">
                  <label className="st-field">
                    <span className="st-field-label">{kind === 'company' ? 'Website' : 'Website or GitHub'} <small>{kind === 'individual' ? 'optional · public' : 'public'}</small></span>
                    <input className="st-input" type="url" inputMode="url" value={f.website} maxLength={300}
                      onChange={e => set({ website: e.target.value })} placeholder={kind === 'company' ? 'https://acme.ai' : 'https://github.com/you'} aria-invalid={!!field('website')} />
                    {kind === 'company' && <span className="st-hint">Its domain is the first one you verify.</span>}
                    <FieldError text={field('website')} />
                  </label>
                  <label className="st-field">
                    <span className="st-field-label">{kind === 'company' ? 'Country of registration' : 'Country'} <small>public</small></span>
                    <select className="st-select" value={f.country} onChange={e => set({ country: e.target.value })} aria-invalid={!!field('country')}>
                      <option value="">Choose a country</option>
                      {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                    <FieldError text={field('country')} />
                  </label>
                </div>

                {kind === 'company' ? (
                  <label className="st-field">
                    <span className="st-field-label">Company number <small>optional · not public</small></span>
                    <input className="st-input" value={f.companyNumber} maxLength={60} onChange={e => set({ companyNumber: e.target.value })} aria-invalid={!!field('companyNumber')} />
                    <FieldError text={field('companyNumber')} />
                  </label>
                ) : (
                  <fieldset className="sw-fieldset">
                    <legend>Do you charge for access?</legend>
                    <div className="mp-radios">
                      <label className="st-toggle"><input type="radio" className="st-check" name="charges" checked={f.charges === 'no'} onChange={() => set({ charges: 'no' })} /><b>No</b></label>
                      <label className="st-toggle"><input type="radio" className="st-check" name="charges" checked={f.charges === 'yes'} onChange={() => set({ charges: 'yes' })} /><b>Yes</b></label>
                    </div>
                    <FieldError text={field('charges')} />
                    {f.charges === 'yes' && (
                      <label className="st-field sw-gap-top">
                        <span className="st-field-label">Trading name <small>public</small></span>
                        <input className="st-input" value={f.tradingName} maxLength={120} onChange={e => set({ tradingName: e.target.value })} aria-invalid={!!field('tradingName')} />
                        <span className="st-hint">Charging for access makes you a trader, so we need the name you trade under.</span>
                        <FieldError text={field('tradingName')} />
                      </label>
                    )}
                  </fieldset>
                )}

                <label className="st-field">
                  <span className="st-field-label">Page address</span>
                  <input className="st-input" value={f.slug} maxLength={32} autoCapitalize="none" spellCheck={false}
                    onChange={e => { setSlugEdited(true); set({ slug: e.target.value.toLowerCase() }); }} placeholder="acme" aria-invalid={!!field('slug')} />
                  <span className="mp-url">{PAGE_BASE}<b>{f.slug || '…'}</b></span>
                  {slugCheck && slugCheck.slug === f.slug && !field('slug') && (
                    slugCheck.available
                      ? <span className="st-hint">This address is free.</span>
                      : <span className="st-error" role="status">{slugCheck.message ?? 'This address is not available.'}</span>
                  )}
                  <span className="st-hint">You can change it until your page is first published.</span>
                  <FieldError text={field('slug')} />
                </label>
              </div>
            </fieldset>

            {problem && <p className="sw-msg is-bad" role="alert">{problem}</p>}
            {/* M12: the provider-account privacy information, linked where its collection starts. */}
            <p className="st-hint mp-privacy-line">How we handle your company&apos;s and your team&apos;s information: <Link href="/privacy#providers">our privacy policy, provider accounts</Link>. The terms that apply: <Link href="/terms#providers">our terms of service, provider accounts</Link>.</p>
            <div className="st-actions sw-gap-top">
              <button type="submit" className="st-btn is-primary" disabled={!emailConfirmed || busy}>
                {busy ? 'Creating…' : 'Create provider account'}
              </button>
            </div>
          </Pane>
        </form>
      </div>
    </>
  );
}
