'use client';

/**
 * Account settings — the first place on this site where a user can change anything.
 *
 * Before this, `/router/profile` was entirely read-only and `/router/preferences`
 * covered routing strategy only. There was no way to control email at all: the
 * digest and change alerts could be switched off only through the unsubscribe link
 * in an email, which is an all-or-nothing action.
 *
 * Four sections, in the order someone reasons about them: who am I, what do you
 * send me, which models trigger it, and what can I not turn off.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { PLANS, isPlan, type Plan } from '@/lib/entitlements';
import {
  BOARD_LAYOUTS, DEFAULT_LAYOUT, LAYOUT_INFO, isBoardLayout, markLayoutTourPending,
  readLayoutCookie, writeLayoutCookie, type BoardLayout,
} from '@/lib/board-layout';
import { LayoutSketch } from '@/components/boards/LayoutChooser';
import '@/styles/boards.css';

interface Prefs {
  emailAlerts: boolean;
  weeklyDigest: boolean;
  providerAlerts: boolean;
  minDropPoints: number;
  canCustomiseThreshold: boolean;
  plan: string;
}
interface WatchedModel {
  modelId: number; name: string; vendor: string | null;
  score: number | null; alertsEnabled: boolean;
}

const card: React.CSSProperties = {
  border: '1px solid var(--border-subtle, #2a2a2a)', borderRadius: 6,
  padding: '18px 20px',
};
const h2: React.CSSProperties = { fontSize: '1.02em', margin: '0 0 4px', fontWeight: 600 };
const sub: React.CSSProperties = { fontSize: '0.85em', color: 'var(--phosphor-dim)', margin: '0 0 16px', lineHeight: 1.6 };
const row: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  gap: 16, padding: '11px 0', borderTop: '1px solid var(--border-subtle, #2a2a2a)',
};

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch" aria-checked={on} disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        width: 42, height: 24, borderRadius: 999, flexShrink: 0, position: 'relative',
        border: '1px solid var(--border-subtle, #2a2a2a)',
        background: on ? 'var(--phosphor-green, #1a73e8)' : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
        transition: 'background .15s ease',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 20 : 2,
        width: 18, height: 18, borderRadius: '50%',
        background: on ? '#fff' : 'var(--phosphor-dim)', transition: 'left .15s ease',
      }} />
    </button>
  );
}

/**
 * Delete account. Collapsed by default; opening it asks the server what deleting would need
 * (GET /api/account/delete: blockers, whether a password is required) before showing the form.
 */
function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<{ email: string; needsPassword: boolean; blockers: Array<{ message: string; href?: string }> } | null>(null);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    setOpen(true);
    setError('');
    try {
      const r = await fetch('/api/account/delete', { cache: 'no-store' });
      const j = await r.json();
      if (j?.success) setInfo({ email: j.email, needsPassword: j.needsPassword, blockers: j.blockers ?? [] });
      else setError(j?.error ?? 'Could not load this. Please try again.');
    } catch {
      setError('Could not load this. Please try again.');
    }
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail, password }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) {
        await signOut({ callbackUrl: '/auth/signin?deleted=1' });
        return;
      }
      setError(j?.error ?? 'Your account was not deleted. Please try again.');
    } catch {
      setError('Your account was not deleted. Please try again.');
    }
    setBusy(false);
  };

  const emailMatches = !!info && confirmEmail.trim().toLowerCase() === info.email.trim().toLowerCase();
  const ready = !!info && info.blockers.length === 0 && emailMatches && (!info.needsPassword || password.length > 0);
  const input: React.CSSProperties = {
    width: '100%', padding: '8px 10px', marginTop: 6, borderRadius: 4, fontSize: '0.9em',
    border: '1px solid var(--metal-silver)', background: 'var(--terminal-black)', color: 'var(--phosphor-green)',
  };

  return (
    <section className="acct-wide" style={card}>
      <h2 style={h2}>Delete account</h2>
      <p style={sub}>Permanently delete your account and the data linked to it. This cannot be undone.</p>

      {!open ? (
        <button type="button" className="acct-btn acct-danger-btn" onClick={start}>Delete account…</button>
      ) : (
        <div style={{ fontSize: '0.88em', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 8px' }}>Deleting your account removes, straight away:</p>
          <ul style={{ margin: '0 0 10px', paddingLeft: 20 }}>
            <li>your watchlist, alerts and settings</li>
            <li>your Smart Router keys, saved provider keys and request logs, and any unused credits</li>
            <li>your Data API keys</li>
            <li>your forum profile; your posts stay, shown as “Deleted user”</li>
          </ul>
          <p style={{ margin: '0 0 14px', color: 'var(--phosphor-dim)' }}>
            We keep only invoices for past payments (held by Stripe) and any messages you sent us.
            We email you once to confirm the deletion.
          </p>

          {info?.blockers.map((b, i) => (
            <div key={i} className="auth-note auth-note--warn" role="alert">
              {b.message}{' '}
              {b.href && <Link href={b.href} style={{ color: 'inherit', textDecoration: 'underline' }}>Go there</Link>}
            </div>
          ))}

          {info && info.blockers.length === 0 && (
            <>
              <label style={{ display: 'block', marginBottom: 10 }}>
                Type your email, <b>{info.email}</b>, to confirm
                <input type="email" autoComplete="off" value={confirmEmail} onChange={e => setConfirmEmail(e.target.value)} style={input} />
              </label>
              {info.needsPassword && (
                <label style={{ display: 'block', marginBottom: 12 }}>
                  Your password
                  <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} style={input} />
                </label>
              )}
            </>
          )}

          {error && <div className="auth-note auth-note--warn" role="alert">{error}</div>}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
            {info && info.blockers.length === 0 && (
              <button type="button" className="acct-danger-solid" disabled={!ready || busy} onClick={remove}>
                {busy ? 'Deleting…' : 'Permanently delete my account'}
              </button>
            )}
            <button type="button" className="acct-btn" disabled={busy}
              onClick={() => { setOpen(false); setConfirmEmail(''); setPassword(''); setError(''); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function SettingsClient() {
  const { data: session, status } = useSession();
  const params = useSearchParams();
  const [sendingVerify, setSendingVerify] = useState(false);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [models, setModels] = useState<WatchedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const [layout, setLayout] = useState<BoardLayout | null>(null);

  const flash = (m: string) => { setSaved(m); setTimeout(() => setSaved(null), 2200); };

  useEffect(() => {
    const v = params?.get('verified');
    if (v === '1') flash('Email confirmed — your digest and alerts are on');
    else if (v === '0') flash('That confirmation link has expired. Send a new one below.');
  }, [params]);

  useEffect(() => {
    if (status !== 'authenticated') { if (status === 'unauthenticated') setLoading(false); return; }
    Promise.all([
      fetch('/api/account/alert-preferences', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/account/watchlist', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/account/ui-preferences', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
    ]).then(([p, w, u]) => {
      if (p?.success) setPrefs(p.data);
      if (w?.success) setModels(w.data.models ?? []);
      const saved = u?.data?.leaderboardLayout;
      setLayout(isBoardLayout(saved) ? saved : (readLayoutCookie() ?? DEFAULT_LAYOUT));
    }).finally(() => setLoading(false));
  }, [status]);

  const savePrefs = async (patch: Partial<Prefs>) => {
    setPrefs(p => (p ? { ...p, ...patch } as Prefs : p));
    const r = await fetch('/api/account/alert-preferences', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
    const d = await r.json();
    flash(d?.success ? 'Saved' : (d?.message ?? 'Could not save'));
  };

  /** Same save as the home page's chooser: account, cookie, and that layout's explainer next visit. */
  const saveLayout = async (next: BoardLayout) => {
    setLayout(next);
    writeLayoutCookie(next);
    markLayoutTourPending(next);
    const r = await fetch('/api/account/ui-preferences', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leaderboardLayout: next }),
    });
    flash((await r.json().catch(() => null))?.success ? 'Saved' : 'Could not save');
  };

  const toggleModel = async (modelId: number, alertsEnabled: boolean) => {
    setModels(ms => ms.map(m => (m.modelId === modelId ? { ...m, alertsEnabled } : m)));
    const r = await fetch(`/api/account/watchlist/${modelId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alertsEnabled }),
    });
    flash((await r.json())?.success ? 'Saved' : 'Could not save');
  };

  if (status === 'unauthenticated') {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.3em', marginBottom: 12 }}>Settings</h1>
        <p style={{ color: 'var(--phosphor-dim)', marginBottom: 22 }}>Sign in to manage your account and email.</p>
        <Link href="/auth/signin" className="vintage-btn" style={{ padding: '11px 22px', textDecoration: 'none' }}>Sign in</Link>
      </div>
    );
  }
  if (loading) return <div data-page-loading style={{ padding: 50, textAlign: 'center', color: 'var(--phosphor-dim)' }}>Loading…</div>;

  const user = session?.user as any;
  const plan: Plan = isPlan(prefs?.plan) ? (prefs!.plan as Plan) : 'free';
  const planLabel = plan === 'legacy_pro' ? 'Pro' : PLANS[plan].label;
  const verified = user?.emailVerified !== false;

  return (
    <div className="acct-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20, gap: 12 }}>
        <h1 style={{ fontSize: '1.4em', margin: 0 }}>Settings</h1>
        {saved && <span style={{ fontSize: '0.82em', color: 'var(--phosphor-green)' }}>{saved}</span>}
      </div>

      <div className="acct-grid">
      {/* 1 — Account */}
      <section style={card}>
        <h2 style={h2}>Account</h2>
        <p style={sub}>Who you are and how you sign in.</p>
        <div style={{ ...row, borderTop: 'none', paddingTop: 0 }}>
          <div>
            <div style={{ fontSize: '0.88em' }}>{user?.email}</div>
            <div style={{ fontSize: '0.78em', color: verified ? 'var(--phosphor-dim)' : 'var(--amber-warning)', marginTop: 3 }}>
              {verified
                ? 'Verified'
                : 'Not verified — the weekly digest and change alerts are only sent to verified addresses.'}
            </div>
          </div>
          {!verified && (
            <button
              className="acct-btn"
              disabled={sendingVerify}
              onClick={async () => {
                setSendingVerify(true);
                try {
                  const r = await fetch('/api/auth/send-verification', { method: 'POST' });
                  const j = await r.json();
                  flash(j?.success
                    ? (j.alreadyVerified ? 'Already confirmed' : 'Confirmation email sent')
                    : (j?.message ?? 'Could not send it'));
                } catch { flash('Could not send it'); }
                finally { setSendingVerify(false); }
              }}
            >
              {sendingVerify ? 'Sending…' : 'Send link'}
            </button>
          )}
        </div>
        <div style={row}>
          <span style={{ fontSize: '0.88em' }}>Plan</span>
          <span style={{ fontSize: '0.88em' }}>
            {planLabel} · <Link href="/account/billing" style={{ color: 'var(--phosphor-green)' }}>manage</Link>
          </span>
        </div>
      </section>

      {/* 2 — Email notifications */}
      <section style={card}>
        <h2 style={h2}>Email notifications</h2>
        <p style={sub}>
          We would rather send you less and have you read it. A quiet week still gets a
          digest — reporting that nothing changed is a result, not an absence of one.
        </p>

        <div style={{ ...row, borderTop: 'none' }}>
          <div>
            <div style={{ fontSize: '0.9em', fontWeight: 600 }}>Weekly digest</div>
            <div style={{ fontSize: '0.8em', color: 'var(--phosphor-dim)', marginTop: 2 }}>
              Mondays. What moved across everything you track, and what held steady.
            </div>
          </div>
          <Toggle on={!!prefs?.weeklyDigest} onChange={v => savePrefs({ weeklyDigest: v })} />
        </div>

        <div style={row}>
          <div>
            <div style={{ fontSize: '0.9em', fontWeight: 600 }}>Change alerts</div>
            <div style={{ fontSize: '0.8em', color: 'var(--phosphor-dim)', marginTop: 2 }}>
              Sent the day a confirmed drop or a task-level regression appears.
            </div>
          </div>
          <Toggle on={!!prefs?.emailAlerts} onChange={v => savePrefs({ emailAlerts: v })} />
        </div>

        <div style={row}>
          <div>
            <div style={{ fontSize: '0.9em', fontWeight: 600 }}>Provider outages</div>
            <div style={{ fontSize: '0.8em', color: 'var(--phosphor-dim)', marginTop: 2 }}>
              When a provider stops answering for 20 minutes or more, and again when it comes back.
              Only for providers you track or have connected. <Link href="/status" style={{ color: 'var(--phosphor-green)' }}>See live status</Link>.
            </div>
          </div>
          <Toggle on={!!prefs?.providerAlerts} onChange={v => savePrefs({ providerAlerts: v })} />
        </div>

        <div style={row}>
          <div>
            <div style={{ fontSize: '0.9em', fontWeight: 600 }}>Alert threshold</div>
            <div style={{ fontSize: '0.8em', color: 'var(--phosphor-dim)', marginTop: 2 }}>
              {prefs?.canCustomiseThreshold
                ? 'Points a score must fall before we email you.'
                : <>Fixed at 5 points on your plan. <Link href="/pricing" style={{ color: 'var(--phosphor-green)' }}>Paid plans</Link> can tune this.</>}
            </div>
          </div>
          <input
            type="number" min={1} max={50}
            value={prefs?.minDropPoints ?? 5}
            disabled={!prefs?.canCustomiseThreshold}
            onChange={e => savePrefs({ minDropPoints: Number(e.target.value) })}
            style={{
              width: 68, padding: '7px 9px', textAlign: 'center', font: 'inherit', fontSize: '0.88em',
              background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border-subtle, #2a2a2a)',
              borderRadius: 3, color: 'inherit', opacity: prefs?.canCustomiseThreshold ? 1 : 0.45,
            }}
          />
        </div>
      </section>

      {/* 3 — What we always send */}
      <section style={card}>
        <h2 style={h2}>What we always send</h2>
        <p style={{ ...sub, marginBottom: 10 }}>
          These are service messages about your own account, not marketing, so they cannot
          be switched off while the account is open.
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.85 }}>
          <li>Password reset, when you ask for one</li>
          <li>Purchase confirmation and receipts</li>
          <li>A notice three days before a trial converts to a charge</li>
        </ul>
      </section>

      {/* 4 — Which models email you */}
      {/* spans: reads badly squeezed into half a row */}
      <section className="acct-wide" style={card}>
        <h2 style={h2}>Which models email you</h2>
        <p style={sub}>
          Tracking and alerting are separate choices. Watch as many as your plan allows,
          and be interrupted only about the ones you actually run.
        </p>
        {models.length === 0 ? (
          <div style={{ fontSize: '0.87em', color: 'var(--phosphor-dim)', paddingTop: 6 }}>
            You are not tracking anything yet. <Link href="/" style={{ color: 'var(--phosphor-green)' }}>Pick some models →</Link>
          </div>
        ) : models.map((m, i) => (
          <div key={m.modelId} style={{ ...row, ...(i === 0 ? { borderTop: 'none' } : {}) }}>
            <div>
              <div style={{ fontSize: '0.9em', fontWeight: 600 }}>{m.name}</div>
              <div style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)', marginTop: 2 }}>
                {m.vendor ?? '—'}{m.score !== null ? ` · score ${m.score.toFixed(1)}` : ''}
              </div>
            </div>
            <Toggle on={m.alertsEnabled} onChange={v => toggleModel(m.modelId, v)} />
          </div>
        ))}
        {models.length > 0 && (
          <p style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)', marginTop: 14, marginBottom: 0, lineHeight: 1.55 }}>
            Turning a model off stops alerts about it. It stays on your watchlist and still
            appears in the weekly digest, so your coverage is never quietly reduced.
          </p>
        )}
      </section>

      {/* 5 — Leaderboard layout */}
      <section className="acct-wide" style={card}>
        <h2 style={h2}>Leaderboard layout</h2>
        <p style={sub}>
          How the four leaderboards are shown on the home page. Saved to your account, so every
          device you sign in on uses it. The home page explains the new layout the next time you open it.
        </p>
        <div className="lbx-options lbx-options--settings" role="radiogroup" aria-label="Leaderboard layout">
          {BOARD_LAYOUTS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={layout === l}
                    className={`lbx-option${layout === l ? ' is-picked' : ''}`}
                    onClick={() => { if (layout !== l) saveLayout(l); }}>
              <LayoutSketch layout={l} />
              <span className="lbx-option-text">
                <span className="lbx-option-name">
                  {LAYOUT_INFO[l].name}
                  {l === DEFAULT_LAYOUT && <span className="lbx-option-badge">Default</span>}
                </span>
                <span className="lbx-option-desc">{LAYOUT_INFO[l].description}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 6 — Delete account */}
      <DeleteAccount />
      </div>
    </div>
  );
}
