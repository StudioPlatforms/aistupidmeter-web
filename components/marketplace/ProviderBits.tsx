'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHead, Pill, Tag } from '@/components/studio';
import {
  chooseProvider, chosenProvider, mpApi, KIND_LABEL, REGIONS, ROLE_LABEL, stateText, stateTone,
  type ProviderOptions, type ProviderSummary,
} from '@/lib/provider-account';
import { countryOptions } from '@/lib/countries';
import '@/styles/studio-team.css';
import '@/styles/studio-provider.css';

/**
 * The provider account's summary (GET /account/provider). The page's server gate already read it
 * for the account's default provider; a person in more than one provider account who chose
 * another on this browser gets that one instead, read once on mount.
 */
export function useProviderSummary(initial: ProviderSummary): [ProviderSummary, () => Promise<void>] {
  const [summary, setSummary] = useState(initial);
  const reload = useCallback(async () => {
    const r = await mpApi<ProviderSummary>('');
    if (r.ok && r.data) setSummary(r.data);
  }, []);
  useEffect(() => {
    const pick = chosenProvider();
    if (pick && pick !== initial.provider?.publicId) {
      // A choice for an account this person is no longer in is dropped, not followed.
      if (initial.memberships && !initial.memberships.some(m => m.publicId === pick)) chooseProvider(null);
      else void reload();
    }
  }, [initial, reload]);
  return [summary, reload];
}

/**
 * The forms' countries and regions, from the API (GET /account/provider/options), which also says
 * which countries it refuses: those are left out of the select. Until it answers, or if it does
 * not, the browser's own country names and the plan's region list stand in.
 */
export function useProviderOptions(): ProviderOptions {
  const [options, setOptions] = useState<ProviderOptions | null>(null);
  useEffect(() => {
    let live = true;
    mpApi<ProviderOptions>('/options').then(r => { if (live && r.ok && r.data) setOptions(r.data); });
    return () => { live = false; };
  }, []);
  return useMemo(() => {
    const refused = new Set(options?.sanctionedCountries ?? []);
    const countries = (options?.countries?.length ? options.countries : countryOptions()).filter(c => !refused.has(c.code));
    return { countries, regions: options?.regions?.length ? options.regions : REGIONS, sanctionedCountries: Array.from(refused) };
  }, [options]);
}

/** The chosen provider account, for people in more than one (at most three). */
export function ProviderSwitch({ summary, onChange }: { summary: ProviderSummary; onChange: () => void }) {
  const list = summary.memberships ?? [];
  if (list.length < 2 || !summary.provider) return null;
  return (
    <label className="st-field mp-switch">
      <span className="st-sr">Provider account</span>
      <select
        className="st-select"
        value={summary.provider.publicId}
        onChange={e => { chooseProvider(e.target.value); onChange(); }}
        aria-label="Provider account"
      >
        {list.map(m => <option key={m.publicId} value={m.publicId}>{m.displayName} ({ROLE_LABEL[m.role] ?? m.role})</option>)}
      </select>
    </label>
  );
}

/** State, kind, our own test accounts and the viewer's role, under the page title. */
export function ProviderMeta({ summary }: { summary: ProviderSummary }) {
  const p = summary.provider;
  if (!p) return null;
  return (
    <div className="sw-meta">
      <Pill tone={stateTone(p.state)}>{stateText(p)}</Pill>
      <Tag tone="line">{KIND_LABEL[p.kind] ?? p.kind}</Tag>
      {p.internal && <Tag tone="accent" title="One of AI Stupid Level's own test accounts">Internal test account</Tag>}
      {summary.role && <Tag tone="line">You: {ROLE_LABEL[summary.role]}</Tag>}
    </div>
  );
}

const SECTIONS = [
  { href: '/account/provider/profile', label: 'Profile' },
  { href: '/account/provider/domains', label: 'Domains', companiesOnly: true },
  { href: '/account/provider/logo', label: 'Logo' },
  { href: '/account/provider/data', label: 'Data handling' },
];

/**
 * The Profile section's pages (§2.15: "Profile, Domains, Data handling | as in §2.4–§2.7", which
 * takes in §2.6, the logo; individuals have no domain step, §2.16). The sidebar has one entry for
 * the section; this bar moves between its pages. Phones get a select instead of a tab bar, so no
 * page hides off the edge.
 */
export function SectionNav({ current, kind }: { current: string; kind?: string }) {
  const router = useRouter();
  const sections = SECTIONS.filter(x => !(x.companiesOnly && kind === 'individual') || x.href === current);
  return (
    <nav className="mp-secnav" aria-label="Profile section">
      <div className="st-tabs sw-tabs mp-secnav-tabs">
        {sections.map(s => (
          <Link key={s.href} href={s.href} className={`st-tab${s.href === current ? ' is-on' : ''}`} aria-current={s.href === current ? 'page' : undefined}>
            {s.label}
          </Link>
        ))}
      </div>
      <label className="st-field mp-secnav-select">
        <span className="st-field-label">Section</span>
        <select className="st-select" value={current} onChange={e => router.push(e.target.value)}>
          {sections.map(s => <option key={s.href} value={s.href}>{s.label}</option>)}
        </select>
      </label>
    </nav>
  );
}

/** Every provider page's header: "Provider" over the title, the account's state and kind under it. */
export function ProviderHead({ summary, title, lead, actions }: {
  summary: ProviderSummary; title: ReactNode; lead?: ReactNode; actions?: ReactNode;
}) {
  return (
    <PageHead kicker="Provider" title={title} lead={lead} actions={actions}>
      <ProviderMeta summary={summary} />
    </PageHead>
  );
}

/** Owners and admins change things; viewers read. */
export function canEdit(summary: ProviderSummary): boolean {
  return summary.role === 'owner' || summary.role === 'admin';
}

/** One field's message from the API (`fields`), under the field. */
export function FieldError({ text }: { text?: string | null }) {
  return text ? <span className="st-error" role="alert">{text}</span> : null;
}
