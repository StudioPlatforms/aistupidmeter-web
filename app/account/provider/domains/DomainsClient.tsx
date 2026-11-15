'use client';

/**
 * Domains (§2.4): the provider proves it controls each domain its website, links and endpoints
 * use, with a DNS TXT record. The record and the "Verify domain" step are the ones the workspace
 * single sign-on page uses (components/workspace/DnsRecord, the same sentences), because they do
 * the same job; the two proofs stay separate all the same: the value is derived for this provider
 * account and cannot prove a workspace's domain, nor the reverse, and the page says so.
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Pane, Loader, Tag, Empty, Note } from '@/components/studio';
import { DnsBlock, type DnsRecordValue } from '@/components/workspace/DnsRecord';
import { ProviderHead, SectionNav, canEdit, useProviderSummary } from '@/components/marketplace/ProviderBits';
import { mpApi, type ProviderSummary } from '@/lib/provider-account';

interface Domain {
  id: number;
  domain: string;
  state?: 'pending' | 'verified' | 'failing' | 'lapsed';
  verifiedAt?: string | null;
  lastCheckedAt?: string | null;
  lastOkAt?: string | null;
  consecutiveFailures?: number;
  record?: DnsRecordValue | null;
}
interface DomainList { domains: Domain[]; checksLeft?: number | null; limit?: number }

const day = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function ago(iso?: string | null): string {
  if (!iso) return '';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (!Number.isFinite(s)) return '';
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} days ago`;
}

const stateOf = (d: Domain) => d.state ?? (d.verifiedAt ? 'verified' : 'pending');

export default function DomainsClient({ initial }: { initial: ProviderSummary }) {
  const { status } = useSession();
  const [s] = useProviderSummary(initial);
  const [list, setList] = useState<DomainList | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [rowMsg, setRowMsg] = useState<Record<number, { text: string; bad?: boolean }>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [companiesOnly, setCompaniesOnly] = useState(initial.provider?.kind === 'individual');
  const editable = canEdit(s);

  const load = useCallback(async () => {
    const r = await mpApi<DomainList>('/domains');
    if (r.ok && r.data) { setList({ domains: r.data.domains ?? [], checksLeft: r.data.checksLeft, limit: r.data.limit }); setLoadError(null); }
    else if (r.code === 'companies_only') setCompaniesOnly(true);
    else setLoadError(r.error);
  }, []);
  useEffect(() => { if (status === 'authenticated' && !companiesOnly) void load(); }, [status, load, companiesOnly]);

  const flash = (text: string, bad = false) => { setMsg({ text, bad }); window.setTimeout(() => setMsg(null), 8000); };

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const domain = String(new FormData(form).get('domain') ?? '').trim().toLowerCase()
      .replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!domain) return;
    setAdding(true);
    const r = await mpApi<{ domain?: Domain }>('/domains', { method: 'POST', body: { domain } });
    setAdding(false);
    if (r.ok) {
      form.reset();
      flash(`${domain} added. Publish the DNS record shown under it, then click Verify domain.`);
      void load();
    } else {
      flash(r.error ?? 'Could not add the domain.', true);
    }
  };

  const verify = async (d: Domain) => {
    setBusyId(d.id);
    setRowMsg(m => { const n = { ...m }; delete n[d.id]; return n; });
    const r = await mpApi<{ verified?: boolean }>(`/domains/${d.id}/check`, { method: 'POST' });
    setBusyId(null);
    if (r.ok && r.data?.verified !== false) {
      setRowMsg(m => ({ ...m, [d.id]: { text: `${d.domain} is verified.` } }));
    } else {
      setRowMsg(m => ({ ...m, [d.id]: { text: r.error ?? 'Could not check DNS right now.', bad: true } }));
    }
    void load();
  };

  const remove = async (d: Domain) => {
    if (!window.confirm(`Remove ${d.domain} from your provider account? Another provider account can verify it 30 days after it is removed.`)) return;
    setBusyId(d.id);
    const r = await mpApi(`/domains/${d.id}`, { method: 'DELETE' });
    setBusyId(null);
    flash(r.ok ? `${d.domain} removed.` : (r.error ?? 'Could not remove the domain.'), !r.ok);
    void load();
  };

  if (status === 'loading') return <div data-page-loading><Loader label="Loading your domains" minHeight={420} /></div>;

  const domains = list?.domains ?? [];
  const checksLeft = typeof list?.checksLeft === 'number' ? list.checksLeft : null;

  return (
    <>
      <ProviderHead
        summary={s}
        title="Domains"
        lead="Prove you control the domains your website and links use. Verifying a domain covers its subdomains."
      />

      <div className="st-body sw-body">
        <SectionNav current="/account/provider/domains" kind={s.provider?.kind} />
        {msg && <div role="status" className={`st-note sw-flash${msg.bad ? ' is-bad' : ''}`}><div>{msg.text}</div></div>}

        {companiesOnly ? (
          <Empty title="Individual accounts have no domain step">
            Companies prove their domains here. As an individual host you go straight on to your profile and your data-handling answers.
          </Empty>
        ) : (
        <div className="st-split">
          <Pane
            title="Your domains"
            sub="Each domain needs its own TXT record. Verifying example.com covers api.example.com and every other subdomain."
            ruled
            flush
          >
            {!list && !loadError && <Loader label="Loading your domains" />}
            {loadError && !list && <p className="sw-pad sw-msg is-bad">{loadError}</p>}
            {list && domains.length === 0 && (
              <div className="sw-none">
                <span className="st-empty-mark" aria-hidden="true"><i /><i /><i /></span>
                <p>{editable ? 'No domains yet. Start with the domain of your website.' : 'No domains yet.'}</p>
              </div>
            )}
            {domains.length > 0 && (
              <div className="mp-domains">
                {domains.map(d => {
                  const st = stateOf(d);
                  const verified = st === 'verified';
                  const note = rowMsg[d.id];
                  return (
                    <div key={d.id} className="mp-domain">
                      <div className="mp-domain-line">
                        <div className="mp-domain-name">
                          <span className="sw-t">{d.domain}</span>
                          {st === 'verified' && <Tag tone="good">Verified</Tag>}
                          {st === 'pending' && <Tag tone="warn">Not verified</Tag>}
                          {st === 'failing' && <Tag tone="warn">Last check failed</Tag>}
                          {st === 'lapsed' && <Tag tone="bad">Not verified since {day(d.lastOkAt)}</Tag>}
                        </div>
                        {editable && (
                          <div className="sw-acts">
                            {st !== 'pending' && (
                              <button type="button" className="st-btn is-sm" disabled={busyId === d.id} onClick={() => verify(d)}>
                                {busyId === d.id ? 'Checking DNS…' : 'Check again'}
                              </button>
                            )}
                            <button type="button" className="st-btn is-sm is-quiet sw-bad-text" disabled={busyId === d.id} onClick={() => remove(d)}>Remove</button>
                          </div>
                        )}
                      </div>
                      <div className="sw-s">
                        {verified
                          ? <>Verified {day(d.verifiedAt)}{d.lastCheckedAt ? ` · last checked ${ago(d.lastCheckedAt)}` : ''}</>
                          : d.lastCheckedAt ? <>Last checked {ago(d.lastCheckedAt)}</> : <>Not checked yet</>}
                      </div>
                      {!verified && (
                        <div className="sw-stack">
                          <p className="st-text">
                            Prove you control the domain by adding this TXT record at your DNS host, then click Verify domain.
                          </p>
                          {d.record && <DnsBlock record={d.record} />}
                          {editable && st === 'pending' && (
                            <div className="sw-verify">
                              <button type="button" onClick={() => verify(d)} disabled={busyId === d.id} className="st-btn is-primary">
                                {busyId === d.id ? 'Checking DNS…' : 'Verify domain'}
                              </button>
                              <span className="st-hint">
                                New records can take a few minutes to an hour to appear. If your DNS host adds the
                                domain for you, enter just <code className="st-ic">_asl-verification</code> as the name.
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {note && <p role="status" className={`sw-msg${note.bad ? ' is-bad' : ''}`}>{note.text}</p>}
                    </div>
                  );
                })}
              </div>
            )}
            {editable && list && (
              <form className="sw-addbar" onSubmit={add}>
                <p className="st-label">Add a domain</p>
                <div className="sw-form-row">
                  <label className="st-field is-wide">
                    <span className="st-field-label">Domain</span>
                    <input name="domain" required className="st-input" placeholder="example.com" autoCapitalize="none" spellCheck={false} maxLength={253} />
                  </label>
                  <button type="submit" className="st-btn is-primary" disabled={adding}>{adding ? 'Adding…' : 'Add domain'}</button>
                </div>
                <p className="st-hint">The domain you registered, without https:// or a path. Mailbox domains such as gmail.com cannot be added.</p>
              </form>
            )}
          </Pane>

          <div className="sw-col">
            <Pane title="How the proof works" delay={0.06}>
              <dl className="st-kv sw-kv mp-kv">
                <div><dt>The record</dt><dd>A TXT record whose value is made for this provider account alone, so no other account’s record can prove your domain.</dd></div>
                <div><dt>Subdomains</dt><dd>Covered: verifying example.com covers api.example.com.</dd></div>
                <div><dt>Single sign-on</dt><dd>A workspace’s single sign-on proof under <Link href="/account/security" className="st-link-inline">Security</Link> uses the same record name with a different value. If you use both, keep both records: neither replaces the other.</dd></div>
                {checksLeft !== null && <div><dt>Checks</dt><dd>Up to 30 an hour for this provider account; {checksLeft} left now.</dd></div>}
                {typeof list?.limit === 'number' && <div><dt>Limit</dt><dd>Up to {list.limit} domains.</dd></div>}
              </dl>
            </Pane>
            {!editable && (
              <Note title="You can read this page">Owners and admins of the provider account add and verify domains.</Note>
            )}
          </div>
        </div>
        )}
      </div>
    </>
  );
}
