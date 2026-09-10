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
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PLANS, isPlan, planMeets, type Plan } from '@/lib/entitlements';

interface ScimToken {
  id: number; token_prefix: string; name: string | null;
  revoked: number; created_at: string; last_used_at: string | null;
}
interface Sso {
  id: number; protocol: 'oidc' | 'saml'; domain: string; domainVerified: boolean;
  issuer: string | null; clientId: string | null; hasClientSecret: boolean;
  ssoUrl: string | null; hasCertificate: boolean;
  jitProvisioning: boolean; defaultRole: string; enabled: boolean; lastUsedAt: string | null;
}
interface Endpoints {
  scimBaseUrl: string; oidcRedirectUri: string; samlAcsUrl: string; samlEntityId: string;
}
interface AuditRow {
  id: number; actorLabel: string | null; actorKind: string; action: string;
  targetType: string | null; targetLabel: string | null; ip: string | null; createdAt: string;
}

const card: React.CSSProperties = {
  border: '1px solid var(--border-subtle, #2a2a2a)', borderRadius: 6,
  padding: '18px 20px', marginBottom: 16,
};
const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 4,
  background: 'var(--terminal-black)', border: '1px solid var(--metal-silver)',
  color: 'inherit', fontFamily: 'inherit', fontSize: '0.88em',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.8em', color: 'var(--phosphor-dim)', marginBottom: 5,
};

function Copyable({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginBottom: 10 }}>
      <span style={lbl}>{label}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <code style={{
          flex: 1, minWidth: 0, padding: '7px 9px', borderRadius: 4, fontSize: '0.8em',
          background: 'var(--terminal-black)', border: '1px solid var(--metal-silver)',
          overflowX: 'auto', whiteSpace: 'nowrap',
        }}>{value}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }).catch(() => {});
          }}
          className="vintage-btn" style={{ padding: '6px 12px', fontSize: '0.78em', whiteSpace: 'nowrap' }}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
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
        setGateMsg(sec.message || 'You do not have access to security settings.');
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

  if (status === 'unauthenticated') {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.3em', marginBottom: 12 }}>Security</h1>
        <p style={{ color: 'var(--phosphor-dim)', marginBottom: 22 }}>Sign in to manage security settings.</p>
        <Link href="/auth/signin" className="vintage-btn" style={{ padding: '11px 22px', textDecoration: 'none' }}>Sign in</Link>
      </div>
    );
  }
  if (loading) return <div style={{ padding: 50, textAlign: 'center', color: 'var(--phosphor-dim)' }}>Loading…</div>;

  if (gateMsg || !planMeets(plan, 'teams')) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '50px 20px' }}>
        <h1 style={{ fontSize: '1.4em', margin: '0 0 10px' }}>Security &amp; governance</h1>
        <p style={{ color: 'var(--phosphor-dim)', lineHeight: 1.65, marginBottom: 20 }}>
          {gateMsg ?? `Single sign-on, SCIM provisioning and the audit trail are part of ${PLANS.teams.label}. You are on ${PLANS[plan].label}.`}
        </p>
        <ul style={{ color: 'var(--phosphor-dim)', fontSize: '0.9em', lineHeight: 1.9, marginBottom: 24 }}>
          <li>Sign in through your own identity provider, over OIDC or SAML</li>
          <li>Joiners and leavers handled by your directory through SCIM 2.0</li>
          <li>An exportable record of who changed what, and when</li>
        </ul>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/pricing" className="vintage-btn vintage-btn--primary" style={{ padding: '10px 20px', textDecoration: 'none' }}>
            See plans
          </Link>
          <Link href="/contact?topic=enterprise" className="vintage-btn" style={{ padding: '10px 20px', textDecoration: 'none' }}>
            Talk to us
          </Link>
        </div>
      </div>
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
    if (!payload?.success) { setMsg(payload?.message || payload?.error || 'Could not save.'); return; }
    setClientSecret(''); setCertificate('');
    setMsg('Saved. We will verify you control the domain before sign-ins are routed to it — that usually takes one business day.');
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

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '26px 20px 70px' }}>
      <h1 style={{ fontSize: '1.4em', margin: '0 0 6px' }}>Security &amp; governance</h1>
      <p style={{ color: 'var(--phosphor-dim)', margin: '0 0 22px', fontSize: '0.92em', lineHeight: 1.6 }}>
        Single sign-on, directory provisioning and the audit trail for your workspace.
      </p>

      {msg && (
        <div style={{
          marginBottom: 16, padding: '11px 13px', borderRadius: 4, fontSize: '0.86em', lineHeight: 1.6,
          border: '1px solid rgba(26,115,232,0.35)', background: 'rgba(26,115,232,0.07)',
        }}>{msg}</div>
      )}

      {/* ── SSO ─────────────────────────────────────────────────────────── */}
      <section style={card}>
        <h2 style={{ fontSize: '1.02em', margin: '0 0 4px', fontWeight: 600 }}>Single sign-on</h2>
        <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', margin: '0 0 16px', lineHeight: 1.6 }}>
          People whose email ends in your domain are sent to your identity provider instead of using a
          password here.
        </p>

        {sso && (
          <div style={{
            marginBottom: 16, padding: '10px 12px', borderRadius: 4, fontSize: '0.83em', lineHeight: 1.6,
            border: `1px solid ${sso.domainVerified ? 'rgba(26,115,232,0.3)' : 'var(--amber-warning, #f9ab00)'}`,
            background: sso.domainVerified ? 'rgba(26,115,232,0.06)' : 'rgba(249,171,0,0.07)',
          }}>
            {sso.domainVerified
              ? <><strong>{sso.domain}</strong> is verified and {sso.enabled ? 'live' : 'configured but switched off'}.</>
              : <><strong>{sso.domain}</strong> is saved but not yet verified. We confirm domain ownership by hand before routing sign-ins — it stops anyone claiming a domain they do not own.</>}
          </div>
        )}

        <form onSubmit={saveSso}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 12 }}>
            <div>
              <label style={lbl} htmlFor="sso-protocol">Protocol</label>
              <select id="sso-protocol" style={input} value={protocol}
                onChange={e => setProtocol(e.target.value as 'oidc' | 'saml')}>
                <option value="oidc">OIDC (Okta, Entra ID, Google)</option>
                <option value="saml">SAML 2.0</option>
              </select>
            </div>
            <div>
              <label style={lbl} htmlFor="sso-domain">Email domain</label>
              <input id="sso-domain" style={input} value={domain} required
                onChange={e => setDomain(e.target.value)} placeholder="acme.com" />
            </div>
          </div>

          {protocol === 'oidc' ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl} htmlFor="sso-issuer">Issuer URL</label>
                <input id="sso-issuer" style={input} value={issuer} onChange={e => setIssuer(e.target.value)}
                  placeholder="https://acme.okta.com/oauth2/default" />
              </div>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 12 }}>
                <div>
                  <label style={lbl} htmlFor="sso-clientid">Client ID</label>
                  <input id="sso-clientid" style={input} value={clientId} onChange={e => setClientId(e.target.value)} />
                </div>
                <div>
                  <label style={lbl} htmlFor="sso-secret">
                    Client secret {sso?.hasClientSecret && <span style={{ opacity: 0.7 }}>(leave blank to keep)</span>}
                  </label>
                  <input id="sso-secret" style={input} type="password" value={clientSecret}
                    onChange={e => setClientSecret(e.target.value)} autoComplete="new-password" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl} htmlFor="sso-url">Sign-on URL</label>
                <input id="sso-url" style={input} value={ssoUrl} onChange={e => setSsoUrl(e.target.value)}
                  placeholder="https://acme.okta.com/app/…/sso/saml" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl} htmlFor="sso-cert">
                  Signing certificate {sso?.hasCertificate && <span style={{ opacity: 0.7 }}>(leave blank to keep)</span>}
                </label>
                <textarea id="sso-cert" rows={4} style={{ ...input, resize: 'vertical', fontSize: '0.78em' }}
                  value={certificate} onChange={e => setCertificate(e.target.value)}
                  placeholder="-----BEGIN CERTIFICATE-----" />
              </div>
            </>
          )}

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
            <div>
              <label style={lbl} htmlFor="sso-role">Role for new people</label>
              <select id="sso-role" style={input} value={defaultRole} onChange={e => setDefaultRole(e.target.value)}>
                <option value="viewer">Viewer (does not use a seat)</option>
                <option value="editor">Editor (uses a seat)</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 8 }}>
              <label style={{ fontSize: '0.85em', display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={jit} onChange={e => setJit(e.target.checked)} />
                Create accounts on first sign-in
              </label>
              <label style={{ fontSize: '0.85em', display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
                Connection enabled
              </label>
            </div>
          </div>

          <button type="submit" disabled={saving} className="vintage-btn vintage-btn--primary"
            style={{ padding: '9px 20px', fontSize: '0.88em' }}>
            {saving ? 'Saving…' : sso ? 'Save connection' : 'Create connection'}
          </button>
        </form>

        {endpoints && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle, #2a2a2a)' }}>
            <div style={{ fontSize: '0.85em', marginBottom: 10, fontWeight: 600 }}>Paste these into your identity provider</div>
            {protocol === 'oidc'
              ? <Copyable label="Redirect / callback URI" value={endpoints.oidcRedirectUri} />
              : (<>
                  <Copyable label="ACS (reply) URL" value={endpoints.samlAcsUrl} />
                  <Copyable label="Entity ID / Audience" value={endpoints.samlEntityId} />
                </>)}
          </div>
        )}
      </section>

      {/* ── SCIM ────────────────────────────────────────────────────────── */}
      <section style={card}>
        <h2 style={{ fontSize: '1.02em', margin: '0 0 4px', fontWeight: 600 }}>Directory provisioning (SCIM 2.0)</h2>
        <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', margin: '0 0 16px', lineHeight: 1.6 }}>
          Let your directory add and remove people here. Deactivating someone in your directory blocks
          their sign-in immediately; we never delete the record, so a returning colleague keeps their
          history.
        </p>

        {endpoints && <Copyable label="SCIM base URL" value={endpoints.scimBaseUrl} />}

        {freshToken && (
          <div style={{
            margin: '12px 0', padding: '12px 13px', borderRadius: 4,
            border: '1px solid var(--phosphor-green)', background: 'rgba(0,200,83,0.06)',
          }}>
            <div style={{ fontSize: '0.83em', marginBottom: 8, lineHeight: 1.6 }}>
              <strong>Copy this now.</strong> We store only a hash, so it cannot be shown again.
            </div>
            <code style={{
              display: 'block', padding: '8px 9px', borderRadius: 4, fontSize: '0.76em',
              background: 'var(--terminal-black)', overflowX: 'auto', whiteSpace: 'nowrap',
            }}>{freshToken}</code>
          </div>
        )}

        {tokens.filter(t => !t.revoked).length === 0 ? (
          <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', margin: '12px 0' }}>No active tokens.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83em', margin: '12px 0' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--phosphor-dim)' }}>
                <th style={{ padding: '6px 8px 6px 0' }}>Token</th>
                <th style={{ padding: '6px 8px' }}>Last used</th>
                <th style={{ padding: '6px 8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {tokens.filter(t => !t.revoked).map(t => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--border-subtle, #2a2a2a)' }}>
                  <td style={{ padding: '8px 8px 8px 0' }}><code>{t.token_prefix}…</code></td>
                  <td style={{ padding: '8px', color: 'var(--phosphor-dim)' }}>
                    {t.last_used_at ? new Date(t.last_used_at).toLocaleDateString() : 'never'}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    <button onClick={() => revokeToken(t.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        color: 'var(--red-alert, #d93025)', fontSize: '0.95em', fontFamily: 'inherit',
                      }}>
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button onClick={issueToken} className="vintage-btn" style={{ padding: '8px 16px', fontSize: '0.85em' }}>
          Issue a token
        </button>
      </section>

      {/* ── Audit ───────────────────────────────────────────────────────── */}
      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.02em', margin: '0 0 4px', fontWeight: 600 }}>Audit trail</h2>
          <a href="/api/account/org/audit?format=csv&limit=200" style={{ fontSize: '0.83em', color: 'var(--accent, #1a73e8)' }}>
            Export CSV →
          </a>
        </div>
        <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', margin: '0 0 14px', lineHeight: 1.6 }}>
          Who changed what in this workspace. Entries are never edited or removed.
        </p>

        {audit.length === 0 ? (
          <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', margin: 0 }}>
            Nothing recorded yet. Changes to members, projects, webhooks and these settings appear here.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82em', minWidth: 520 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--phosphor-dim)' }}>
                  <th style={{ padding: '6px 8px 6px 0' }}>When</th>
                  <th style={{ padding: '6px 8px' }}>Who</th>
                  <th style={{ padding: '6px 8px' }}>Action</th>
                  <th style={{ padding: '6px 8px' }}>Target</th>
                </tr>
              </thead>
              <tbody>
                {audit.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border-subtle, #2a2a2a)' }}>
                    <td style={{ padding: '7px 8px 7px 0', color: 'var(--phosphor-dim)', whiteSpace: 'nowrap' }}>
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '7px 8px' }}>{r.actorLabel ?? r.actorKind}</td>
                    <td style={{ padding: '7px 8px' }}><code style={{ fontSize: '0.95em' }}>{r.action}</code></td>
                    <td style={{ padding: '7px 8px', color: 'var(--phosphor-dim)' }}>{r.targetLabel ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
