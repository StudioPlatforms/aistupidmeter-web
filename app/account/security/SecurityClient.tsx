'use client';

/**
 * Security and governance: SSO, SCIM and the audit trail.
 *
 * These three were sold on the Enterprise card and existed nowhere in the
 * product. This is where a workspace owner configures them.
 *
 * The page shows the callback URLs the customer has to paste into their identity
 * provider, because that is the step people get wrong and it is not something
 * they can guess.
 *
 * Look: the studio shell (styles/studio.css, components/studio) plus styles/studio-team.css.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PLANS, isPlan, planMeets, type Plan } from '@/lib/entitlements';
import { REQUIRED_PLAN } from '@/lib/capabilities';
import { PageHead, Pane, CopyButton, Loader, Empty, Pill, Tag } from '@/components/studio';
import '@/styles/studio-team.css';

interface ScimToken {
  id: number; token_prefix: string; name: string | null;
  revoked: number; created_at: string; last_used_at: string | null;
}
interface Sso {
  id: number; protocol: 'oidc' | 'saml'; domain: string; domainVerified: boolean;
  issuer: string | null; clientId: string | null; hasClientSecret: boolean;
  ssoUrl: string | null; hasCertificate: boolean;
  jitProvisioning: boolean; defaultRole: string; enabled: boolean; lastUsedAt: string | null;
  verification?: DnsRecord;
}
interface DnsRecord { type: string; name: string; value: string }
interface Endpoints {
  scimBaseUrl: string; oidcRedirectUri: string; samlAcsUrl: string; samlEntityId: string;
}
interface AuditRow {
  id: number; actorLabel: string | null; actorKind: string; action: string;
  targetType: string | null; targetLabel: string | null; ip: string | null; createdAt: string;
}

const LEAD = 'Single sign-on, directory provisioning and the audit trail for your workspace.';
const ar = <span className="st-ar" aria-hidden="true">→</span>;

/** A value to paste somewhere else, with its label and a copy button. */
function Copyable({ label, value }: { label: string; value: string }) {
  return (
    <div className="sw-copy">
      <span className="sw-copy-l">{label}</span>
      <div className="sw-copy-v"><code>{value}</code><CopyButton text={value} /></div>
    </div>
  );
}

/** The TXT record that proves the workspace controls a domain. */
function DnsBlock({ record }: { record: DnsRecord }) {
  return (
    <div className="sw-dns">
      <div className="sw-dns-head"><span className="st-label">DNS record</span><Tag tone="line">{record.type || 'TXT'}</Tag></div>
      <Copyable label="Record name (host)" value={record.name} />
      <Copyable label="Record value (TXT)" value={record.value} />
    </div>
  );
}

export default function SecurityClient() {
  const { data: session, status } = useSession();
  const [sso, setSso] = useState<Sso | null>(null);
  const [tokens, setTokens] = useState<ScimToken[]>([]);
  const [endpoints, setEndpoints] = useState<Endpoints | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [gateMsg, setGateMsg] = useState<string | null>(null);
  const [needsWorkspace, setNeedsWorkspace] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [freshToken, setFreshToken] = useState<string | null>(null);

  // SSO form
  const [protocol, setProtocol] = useState<'oidc' | 'saml'>('oidc');
  const [domain, setDomain] = useState('');
  const [issuer, setIssuer] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [ssoUrl, setSsoUrl] = useState('');
  const [certificate, setCertificate] = useState('');
  const [defaultRole, setDefaultRole] = useState('viewer');
  const [jit, setJit] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  // A record to publish before a domain another workspace saved (unverified) can be claimed.
  const [claimRecord, setClaimRecord] = useState<DnsRecord | null>(null);
  const [verifying, setVerifying] = useState(false);

  const load = () => {
    Promise.all([
      fetch('/api/account/org/security', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      fetch('/api/account/org/audit?limit=25', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
    ]).then(([sec, aud]) => {
      if (sec?.success) {
        setSso(sec.data.sso);
        setTokens(sec.data.scimTokens ?? []);
        setEndpoints(sec.data.endpoints);
        if (sec.data.sso) {
          const s: Sso = sec.data.sso;
          setProtocol(s.protocol); setDomain(s.domain);
          setIssuer(s.issuer ?? ''); setClientId(s.clientId ?? '');
          setSsoUrl(s.ssoUrl ?? ''); setDefaultRole(s.defaultRole);
          setJit(s.jitProvisioning); setEnabled(s.enabled);
        }
      } else if (sec?.error) {
        // Two different 403s arrive here and they need opposite answers: an
        // upgrade prompt, or "make a workspace first".
        setNeedsWorkspace(sec.error !== 'upgrade_required');
        setGateMsg(sec.message ?? null);
      }
      if (aud?.success) setAudit(aud.data.rows ?? []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (status !== 'authenticated') { if (status === 'unauthenticated') setLoading(false); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const plan: Plan = isPlan((session?.user as any)?.plan) ? (session!.user as any).plan : 'free';

  // Signed out, AccountShell renders the public chrome (no studio shell), so this stays plain.
  if (status === 'unauthenticated') {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.3em', marginBottom: 12 }}>Security</h1>
        <p style={{ color: 'var(--phosphor-dim)', marginBottom: 22 }}>Sign in to manage security settings.</p>
        <Link href="/auth/signin" className="vintage-btn" style={{ padding: '11px 22px', textDecoration: 'none' }}>Sign in</Link>
      </div>
    );
  }
  if (loading) return <div data-page-loading><Loader label="Loading security settings" minHeight={420} /></div>;

  // Entitled, but with nowhere to put the settings yet.
  if (needsWorkspace && planMeets(plan, REQUIRED_PLAN.governance)) {
    return (
      <>
        <PageHead kicker="Team" title="Security & governance" lead={LEAD} />
        <div className="st-body sw-body">
          <Empty
            title="Create your workspace first"
            actions={<Link href="/account/team" className="st-btn is-primary">Create a workspace {ar}</Link>}
          >
            Single sign-on, SCIM provisioning and the audit trail all belong to a workspace — they
            decide who may act inside one. Your {PLANS[plan].label} plan includes them; create the
            workspace and these settings become available immediately.
          </Empty>
        </div>
      </>
    );
  }

  if (needsWorkspace || gateMsg || !planMeets(plan, REQUIRED_PLAN.governance)) {
    return (
      <>
        <PageHead kicker="Team" title="Security & governance" lead={LEAD} />
        <div className="st-body sw-body">
          <section className="st-pane is-accent st-lock st-up">
            <div className="st-lock-main">
              <p className="st-kicker">Part of {PLANS.teams.label}</p>
              <h2 className="st-lock-t">Single sign-on, SCIM and the audit trail</h2>
              <p className="st-lead">
                {gateMsg ?? `Single sign-on, SCIM provisioning and the audit trail are part of ${PLANS.teams.label}. You are on ${PLANS[plan].label}.`}
              </p>
              <div className="st-actions sw-lock-act">
                <Link href="/pricing" className="st-btn is-primary is-lg">See plans {ar}</Link>
                <Link href="/contact?topic=enterprise" className="st-btn is-lg">Talk to us</Link>
              </div>
            </div>
            <div className="st-lock-side">
              <p className="st-label">What it covers</p>
              <ul className="st-lock-list">
                {[
                  ['Single sign-on', 'Sign in through your own identity provider, over OIDC or SAML'],
                  ['Directory provisioning', 'Joiners and leavers handled by your directory through SCIM 2.0'],
                  ['Audit trail', 'An exportable record of who changed what, and when'],
                ].map(([t, d]) => (
                  <li key={t}>
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div><b>{t}</b><span>{d}</span></div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </>
    );
  }

  const saveSso = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    const res = await fetch('/api/account/org/sso', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        protocol, domain, issuer, clientId, clientSecret,
        ssoUrl, certificate, defaultRole, jitProvisioning: jit, enabled,
      }),
    });
    const payload = await res.json().catch(() => null);
    setSaving(false);
    if (!payload?.success) {
      setClaimRecord(payload?.data?.verification ?? null);
      setMsg(payload?.message || payload?.error || 'Could not save.');
      return;
    }
    setClaimRecord(null);
    setClientSecret(''); setCertificate('');
    setMsg(payload.data?.verified
      ? `Saved. ${payload.data.domain} is verified${enabled ? ', and sign-ins for it now go to your identity provider' : ' — switch the connection on when you are ready'}.`
      : `Saved. To verify ${payload.data?.domain ?? 'the domain'}, publish the DNS record shown below, then click Verify domain.`);
    load();
  };

  const verifyDomain = async () => {
    setVerifying(true); setMsg(null);
    const res = await fetch('/api/account/org/sso/verify-domain', { method: 'POST' });
    const payload = await res.json().catch(() => null);
    setVerifying(false);
    setMsg(payload?.success
      ? `${sso?.domain ?? 'The domain'} is verified.${sso?.enabled ? '' : ' Switch the connection on to start routing sign-ins.'}`
      : (payload?.message || payload?.error || 'Could not check DNS right now.'));
    load();
  };

  const issueToken = async () => {
    setMsg(null);
    const res = await fetch('/api/account/org/scim-tokens', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Directory sync' }),
    });
    const payload = await res.json().catch(() => null);
    if (!payload?.success) { setMsg(payload?.error || 'Could not issue a token.'); return; }
    setFreshToken(payload.data.token);
    load();
  };

  const revokeToken = async (id: number) => {
    await fetch(`/api/account/org/scim-tokens/${id}`, { method: 'DELETE' });
    load();
  };

  const active = tokens.filter(t => !t.revoked);
  const ssoPill = !sso ? <Pill>Not set up</Pill>
    : !sso.domainVerified ? <Pill tone="warn">Domain not verified</Pill>
    : sso.enabled ? <Pill tone="good" live>Live</Pill>
    : <Pill>Switched off</Pill>;

  return (
    <>
      <PageHead
        kicker="Team"
        title="Security & governance"
        lead={LEAD}
        actions={<Link href="/docs/teams#sso" className="st-btn">How to set these up {ar}</Link>}
      />

      <div className="st-body sw-body">
        {msg && <div role="status" className="st-note sw-flash"><div>{msg}</div></div>}

        <div className="st-split">
          {/* ── SSO ─────────────────────────────────────────────────────────── */}
          <Pane
            title="Single sign-on"
            sub={<>
              Once your domain is verified and the connection is on, people whose email ends in that domain
              sign in through your identity provider — a password or Google/GitHub sign-in is refused. As the
              owner you keep your own password, so a broken provider can never lock you out of fixing it.
            </>}
            actions={ssoPill}
          >
            {sso && (
              sso.domainVerified ? (
                <div className="st-note is-good sw-gap-bottom">
                  <div><strong>{sso.domain}</strong> is verified and {sso.enabled ? 'live' : 'configured but switched off'}.</div>
                </div>
              ) : (
                <div className="st-note is-warn sw-gap-bottom">
                  <div>
                    <strong>{sso.domain}</strong> is saved but not verified yet, so sign-ins are not routed to your
                    identity provider. Prove you control the domain by adding this TXT record at your DNS host,
                    then click Verify domain. It stops anyone claiming a domain they do not own.
                    {sso.verification && <DnsBlock record={sso.verification} />}
                    <div className="sw-verify">
                      <button type="button" onClick={verifyDomain} disabled={verifying} className="st-btn is-primary">
                        {verifying ? 'Checking DNS…' : 'Verify domain'}
                      </button>
                      <span className="st-hint">
                        New records can take a few minutes to an hour to appear. If your DNS host adds the
                        domain for you, enter just <code className="st-ic">_asl-verification</code> as the name.
                      </span>
                    </div>
                  </div>
                </div>
              )
            )}
            {claimRecord && (
              <div className="st-note is-warn sw-gap-bottom">
                <div>
                  Publish this TXT record to prove the domain is yours, then save again:
                  <DnsBlock record={claimRecord} />
                </div>
              </div>
            )}

            <form onSubmit={saveSso} className="sw-stack">
              <div className="sw-grid2">
                <div className="st-field">
                  <label className="st-field-label" htmlFor="sso-protocol">Protocol</label>
                  <select id="sso-protocol" className="st-select" value={protocol}
                    onChange={e => setProtocol(e.target.value as 'oidc' | 'saml')}>
                    <option value="oidc">OIDC (Okta, Entra ID, Google)</option>
                    <option value="saml">SAML 2.0</option>
                  </select>
                </div>
                <div className="st-field">
                  <label className="st-field-label" htmlFor="sso-domain">Email domain</label>
                  <input id="sso-domain" className="st-input" value={domain} required
                    onChange={e => setDomain(e.target.value)} placeholder="acme.com" />
                </div>
              </div>

              {protocol === 'oidc' ? (
                <>
                  <div className="st-field">
                    <label className="st-field-label" htmlFor="sso-issuer">Issuer URL</label>
                    <input id="sso-issuer" className="st-input" value={issuer} onChange={e => setIssuer(e.target.value)}
                      placeholder="https://acme.okta.com/oauth2/default" />
                  </div>
                  <div className="sw-grid2">
                    <div className="st-field">
                      <label className="st-field-label" htmlFor="sso-clientid">Client ID</label>
                      <input id="sso-clientid" className="st-input is-code" value={clientId} onChange={e => setClientId(e.target.value)} />
                    </div>
                    <div className="st-field">
                      <label className="st-field-label" htmlFor="sso-secret">
                        Client secret {sso?.hasClientSecret && <small>leave blank to keep</small>}
                      </label>
                      <input id="sso-secret" className="st-input is-code" type="password" value={clientSecret}
                        onChange={e => setClientSecret(e.target.value)} autoComplete="new-password" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="st-field">
                    <label className="st-field-label" htmlFor="sso-url">Sign-on URL</label>
                    <input id="sso-url" className="st-input" value={ssoUrl} onChange={e => setSsoUrl(e.target.value)}
                      placeholder="https://acme.okta.com/app/…/sso/saml" />
                  </div>
                  <div className="st-field">
                    <label className="st-field-label" htmlFor="sso-cert">
                      Signing certificate {sso?.hasCertificate && <small>leave blank to keep</small>}
                    </label>
                    <textarea id="sso-cert" rows={4} className="st-textarea is-code"
                      value={certificate} onChange={e => setCertificate(e.target.value)}
                      placeholder="-----BEGIN CERTIFICATE-----" />
                  </div>
                </>
              )}

              <div className="sw-grid2 sw-align-end">
                <div className="st-field">
                  <label className="st-field-label" htmlFor="sso-role">Role for new people</label>
                  <select id="sso-role" className="st-select" value={defaultRole} onChange={e => setDefaultRole(e.target.value)}>
                    <option value="viewer">Viewer (does not use a seat)</option>
                    <option value="editor">Editor (uses a seat)</option>
                  </select>
                </div>
                <div className="sw-toggles">
                  <label className="st-toggle">
                    <input type="checkbox" className="st-check" checked={jit} onChange={e => setJit(e.target.checked)} />
                    <b>Create accounts on first sign-in</b>
                  </label>
                  <label className="st-toggle">
                    <input type="checkbox" className="st-check" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
                    <b>Connection enabled</b>
                  </label>
                </div>
              </div>

              <div className="st-actions sw-form-foot">
                <button type="submit" disabled={saving} className="st-btn is-primary">
                  {saving ? 'Saving…' : sso ? 'Save connection' : 'Create connection'}
                </button>
              </div>
            </form>
          </Pane>

          <div className="sw-col">
            {endpoints && (
              <Pane title="Paste these into your identity provider" sub={protocol === 'oidc' ? 'For an OIDC application.' : 'For a SAML 2.0 application.'} delay={0.06}>
                <div className="sw-stack">
                  {protocol === 'oidc'
                    ? <Copyable label="Redirect / callback URI" value={endpoints.oidcRedirectUri} />
                    : (<>
                        <Copyable label="ACS (reply) URL" value={endpoints.samlAcsUrl} />
                        <Copyable label="Entity ID / Audience" value={endpoints.samlEntityId} />
                      </>)}
                </div>
              </Pane>
            )}

            {/* ── SCIM ────────────────────────────────────────────────────────── */}
            <Pane
              title="Directory provisioning (SCIM 2.0)"
              sub={<>
                Let your directory add and remove people here. Deactivating someone in your directory blocks
                their sign-in immediately; we never delete the record, so a returning colleague keeps their
                history.
              </>}
              actions={active.length > 0 ? <Pill tone="good">{active.length} active token{active.length === 1 ? '' : 's'}</Pill> : undefined}
              delay={0.1}
            >
              <div className="sw-stack">
                {endpoints && <Copyable label="SCIM base URL" value={endpoints.scimBaseUrl} />}

                {freshToken && (
                  <div className="sw-fresh">
                    <p><strong>Copy this now.</strong> We store only a hash, so it cannot be shown again.</p>
                    <div className="st-secret"><code>{freshToken}</code><CopyButton text={freshToken} /></div>
                  </div>
                )}

                <div>
                  <p className="st-label">Tokens</p>
                  {active.length === 0 ? (
                    <p className="sw-quiet">No active tokens.</p>
                  ) : (
                    <div className="sw-tokens">
                      {active.map(t => (
                        <div key={t.id} className="sw-token">
                          <code className="st-ic">{t.token_prefix}…</code>
                          <span className="sw-s">{t.last_used_at ? `Last used ${new Date(t.last_used_at).toLocaleDateString()}` : 'Never used'}</span>
                          <button type="button" onClick={() => revokeToken(t.id)} className="st-btn is-sm is-quiet sw-bad-text">Revoke</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="st-actions">
                  <button type="button" onClick={issueToken} className="st-btn">Issue a token</button>
                </div>
              </div>
            </Pane>
          </div>
        </div>

        {/* ── Audit ───────────────────────────────────────────────────────── */}
        <Pane
          title="Audit trail"
          sub="Who changed what in this workspace. Entries are never edited or removed."
          actions={<a href="/api/account/org/audit?format=csv&limit=200" className="st-btn is-sm">Export CSV</a>}
          ruled
          flush
        >
          {/* flush stays fixed: a Pane whose class changes after it has faded in loses its reveal. */}
          {audit.length === 0 ? (
            <p className="sw-quiet sw-pad">
              Nothing recorded yet. Changes to members, projects, webhooks and these settings appear here.
            </p>
          ) : (
            <div className="st-table-wrap">
              {/* On a phone each entry stacks into a card: when, then who, what and to what. */}
              <table className="st-table is-stack sw-audit">
                <thead>
                  <tr><th>When</th><th>Who</th><th>Action</th><th>Target</th></tr>
                </thead>
                <tbody>
                  {audit.map(r => (
                    <tr key={r.id}>
                      <td className="is-head is-dim sw-when">{new Date(r.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td data-label="Who" className="sw-wrap">{r.actorLabel ?? r.actorKind}</td>
                      <td data-label="Action"><code className="st-ic">{r.action}</code></td>
                      <td className="is-dim sw-wrap" data-label="Target">{r.targetLabel ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Pane>
      </div>
    </>
  );
}
