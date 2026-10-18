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

import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { PLANS, isPlan, type Plan } from '@/lib/entitlements';
import {
  BOARD_LAYOUTS, DEFAULT_LAYOUT, LAYOUT_INFO, toBoardLayout, markLayoutTourPending,
  readLayoutCookie, writeLayoutCookie, type BoardLayout,
} from '@/lib/board-layout';
import { LayoutSketch } from '@/components/boards/LayoutChooser';
import { PageHead, Pane, Loader, Pill, Tag, ProviderMark, PROVIDER_LABEL } from '@/components/studio';
import { lpBody, lpDisplay } from '@/lib/fonts';
import '@/styles/boards.css';
import '@/styles/landing.css';
import '@/styles/studio-account.css';

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

const vendorName = (v: string) => PROVIDER_LABEL[v.toLowerCase()] ?? (v.charAt(0).toUpperCase() + v.slice(1));

/** The visible part of an on/off switch; the checkbox inside stays the real control. */
function Switch({ on, onChange, disabled, title }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; title?: string }) {
  return (
    <span className="sc-sw">
      <input type="checkbox" role="switch" checked={on} disabled={disabled} title={title}
        onChange={e => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </span>
  );
}

/** One preference: what it does on the left, the switch on the right. The whole row is the label. */
function SwitchRow({ title, desc, on, onChange }: { title: string; desc: ReactNode; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="st-toggle sc-set">
      <span className="sc-set-text"><b>{title}</b><span>{desc}</span></span>
      <Switch on={on} onChange={onChange} />
    </label>
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

  return (
    <Pane id="delete" className="sc-danger sc-anchor" title="Delete account">
      {!open ? (
        <div className="sc-danger-row">
          <div className="st-note is-bad">
            <div>Permanently delete your account and the data linked to it. This cannot be undone.</div>
          </div>
          <button type="button" className="st-btn is-danger" onClick={start}>Delete account…</button>
        </div>
      ) : (
        <div className="sc-del">
          <div className="st-note is-bad">
            <div>Permanently delete your account and the data linked to it. This cannot be undone.</div>
          </div>
          <div>
            <p className="st-text">Deleting your account removes, straight away:</p>
            <ul className="sc-ticks is-bad" style={{ marginTop: 10 }}>
              <li>your watchlist, alerts and settings</li>
              <li>your Smart Router keys, saved provider keys and request logs, and any unused credits</li>
              <li>your Data API keys</li>
              <li>your forum profile; your posts stay, shown as “Deleted user”</li>
            </ul>
          </div>
          <p className="st-hint" style={{ fontSize: 13.5 }}>
            We keep only invoices for past payments (held by Stripe) and any messages you sent us.
            We email you once to confirm the deletion.
          </p>

          {info?.blockers.map((b, i) => (
            <div key={i} className="st-note is-warn" role="alert">
              <div>
                {b.message}{' '}
                {b.href && <Link href={b.href}>Go there</Link>}
              </div>
            </div>
          ))}

          {info && info.blockers.length === 0 && (
            <div className="sc-del-fields">
              <label className="st-field">
                <span className="st-field-label">Type your email, <b>{info.email}</b>, to confirm</span>
                <input type="email" autoComplete="off" value={confirmEmail} onChange={e => setConfirmEmail(e.target.value)} className="st-input" />
              </label>
              {info.needsPassword && (
                <label className="st-field">
                  <span className="st-field-label">Your password</span>
                  <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="st-input" />
                </label>
              )}
            </div>
          )}

          {error && <div className="st-note is-warn" role="alert"><div>{error}</div></div>}

          <div className="st-actions sc-del-act">
            {info && info.blockers.length === 0 && (
              <button type="button" className="st-btn is-danger is-solid" disabled={!ready || busy} onClick={remove}>
                {busy ? 'Deleting…' : 'Permanently delete my account'}
              </button>
            )}
            <button type="button" className="st-btn" disabled={busy}
              onClick={() => { setOpen(false); setConfirmEmail(''); setPassword(''); setError(''); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Pane>
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
      setLayout(toBoardLayout(saved) ?? readLayoutCookie() ?? DEFAULT_LAYOUT);
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

  // Signed out, AccountShell renders this page without the app shell: the landing scope carries the look.
  const guest = `lp ${lpBody.variable} ${lpDisplay.variable} sc-guest`;

  if (status === 'unauthenticated') {
    return (
      <div className={guest}>
        <section className="lp-hero lp-textured sc-guest-hero">
          <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="lp-wrap sc-guest-mini">
            <p className="lp-kicker lp-intro">Account</p>
            <h1 className="sc-guest-t lp-intro" style={{ ['--d' as string]: '.06s' }}>Settings</h1>
            <p className="lp-lead lp-intro" style={{ ['--d' as string]: '.12s' }}>Sign in to manage your account and email.</p>
            <div className="lp-cta lp-intro" style={{ ['--d' as string]: '.18s' }}>
              <Link href="/auth/signin" className="lp-btn lp-btn-primary lp-btn-lg">Sign in <span className="lp-ar" aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>
      </div>
    );
  }
  if (loading) {
    return (
      status === 'authenticated'
        ? <div data-page-loading><Loader label="Loading your settings" minHeight={420} /></div>
        // Session still resolving: the public chrome is up and studio.css may not be, so no shared Loader.
        : <div data-page-loading className={guest}><div className="sc-guest-load" role="status"><span className="sc-bars" aria-hidden="true"><i /><i /><i /></span>Loading…</div></div>
    );
  }

  const user = session?.user as any;
  const plan: Plan = isPlan(prefs?.plan) ? (prefs!.plan as Plan) : 'free';
  const planLabel = plan === 'legacy_pro' ? 'Pro' : PLANS[plan].label;
  const verified = user?.emailVerified !== false;
  const initial = (String(user?.name || user?.email || '?').trim().charAt(0) || '?').toUpperCase();
  const savedOk = !!saved && /^(Saved|Email confirmed|Confirmation email sent|Already confirmed)/.test(saved);

  return (
    <>
      <PageHead
        kicker="Account"
        title="Settings"
        lead="Your account, the email we send you, which models can interrupt you, and how your leaderboard is laid out."
      >
        <nav className="sc-jump" aria-label="On this page">
          <a href="#account" className="st-chip">Account</a>
          <a href="#email" className="st-chip">Email</a>
          <a href="#models" className="st-chip">Model alerts</a>
          <a href="#layout" className="st-chip">Leaderboard layout</a>
          <a href="#delete" className="st-chip">Delete account</a>
        </nav>
      </PageHead>

      <div className="st-body">
        <div className="sc-top">
          {/* 1 — Account */}
          <Pane id="account" className="sc-a-acct sc-anchor" title="Account" sub="Who you are and how you sign in.">
            <div className="sc-me">
              <span className="sc-me-av" aria-hidden="true">{initial}</span>
              <div style={{ minWidth: 0 }}>
                <div className="sc-me-mail">{user?.email}</div>
                <div className="sc-me-state">
                  {verified ? <Pill tone="good">Verified</Pill> : <Pill tone="warn">Not verified</Pill>}
                </div>
              </div>
            </div>
            {!verified && (
              <div className="st-note is-warn sc-verify">
                <div>
                  The weekly digest and change alerts are only sent to verified addresses.
                  <div className="st-actions">
                    <button
                      type="button"
                      className="st-btn is-sm"
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
                      {sendingVerify ? 'Sending…' : 'Send confirmation link'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <dl className="st-kv sc-acct-kv">
              <div>
                <dt>Plan</dt>
                <dd><b>{planLabel}</b><Link href="/account/billing" className="st-more">Manage</Link></dd>
              </div>
            </dl>
          </Pane>

          {/* 2 — Email notifications */}
          <Pane
            id="email"
            className="sc-a-mail sc-anchor"
            title="Email notifications"
            sub="We would rather send you less and have you read it. A quiet week still gets a digest — reporting that nothing changed is a result, not an absence of one."
            ruled
            delay={0.06}
          >
            <div className="sc-sets">
              <SwitchRow
                title="Weekly digest"
                desc="Mondays. What moved across everything you track, and what held steady."
                on={!!prefs?.weeklyDigest}
                onChange={v => savePrefs({ weeklyDigest: v })}
              />
              <SwitchRow
                title="Change alerts"
                desc="Sent the day a confirmed drop or a task-level regression appears."
                on={!!prefs?.emailAlerts}
                onChange={v => savePrefs({ emailAlerts: v })}
              />
              <SwitchRow
                title="Provider outages"
                desc={<>
                  When a provider stops answering for 20 minutes or more, and again when it comes back.
                  Only for providers you track or have connected. <Link href="/status">See live status</Link>.
                </>}
                on={!!prefs?.providerAlerts}
                onChange={v => savePrefs({ providerAlerts: v })}
              />
              <div className="sc-set">
                <span className="sc-set-text">
                  <label htmlFor="sc-threshold"><b>Alert threshold</b></label>
                  <span>
                    {prefs?.canCustomiseThreshold
                      ? 'Points a score must fall before we email you.'
                      : <>Fixed at 5 points on your plan. <Link href="/pricing">Paid plans</Link> can tune this.</>}
                  </span>
                </span>
                <span className="sc-num-wrap">
                  <input
                    id="sc-threshold"
                    className="st-input sc-num"
                    type="number" min={1} max={50}
                    value={prefs?.minDropPoints ?? 5}
                    disabled={!prefs?.canCustomiseThreshold}
                    onChange={e => savePrefs({ minDropPoints: Number(e.target.value) })}
                  />
                  <span aria-hidden="true">points</span>
                </span>
              </div>
            </div>
          </Pane>

          {/* 3 — What we always send */}
          <Pane
            className="sc-a-always"
            title="What we always send"
            sub="These are service messages about your own account, not marketing, so they cannot be switched off while the account is open."
            delay={0.12}
          >
            <ul className="sc-ticks is-plain">
              <li>Password reset, when you ask for one</li>
              <li>Purchase confirmation and receipts</li>
              <li>A notice three days before a trial converts to a charge</li>
            </ul>
          </Pane>
        </div>

        {/* 4 — Which models email you */}
        <Pane
          id="models"
          className="sc-anchor"
          title="Which models email you"
          sub="Tracking and alerting are separate choices. Watch as many as your plan allows, and be interrupted only about the ones you actually run."
          actions={models.length > 0 ? <Link href="/watchlist" className="st-btn is-sm">Open watchlist</Link> : undefined}
          foot={models.length > 0
            ? 'Turning a model off stops alerts about it. It stays on your watchlist and still appears in the weekly digest, so your coverage is never quietly reduced.'
            : undefined}
        >
          {models.length === 0 ? (
            <p className="st-text">
              You are not tracking anything yet. <Link href="/" className="st-more">Pick some models</Link>
            </p>
          ) : (
            <div className="sc-mgrid">
              {models.map(m => (
                <label key={m.modelId} className="st-toggle sc-mcard">
                  <ProviderMark provider={m.vendor || ''} />
                  <span className="sc-set-text">
                    <b>{m.name}</b>
                    <span>{m.vendor ? vendorName(m.vendor) : '—'}{m.score !== null ? ` · score ${m.score.toFixed(1)}` : ''}</span>
                  </span>
                  <Switch on={m.alertsEnabled} onChange={v => toggleModel(m.modelId, v)} />
                </label>
              ))}
            </div>
          )}
        </Pane>

        {/* 5 — Leaderboard layout */}
        <Pane
          id="layout"
          className="sc-anchor"
          title="Leaderboard layout"
          sub="How the four leaderboards are shown on the home page. Saved to your account, so every device you sign in on uses it. The home page explains the new layout the next time you open it."
        >
          <div className="st-cards sc-layouts" role="radiogroup" aria-label="Leaderboard layout">
            {BOARD_LAYOUTS.map((l) => (
              <button key={l} type="button" role="radio" aria-checked={layout === l}
                      className="st-card sc-layout"
                      onClick={() => { if (layout !== l) saveLayout(l); }}>
                <LayoutSketch layout={l} />
                <span className="st-card-t">
                  {LAYOUT_INFO[l].name}
                  {l === DEFAULT_LAYOUT && <Tag tone="accent">Default</Tag>}
                  <span className="st-card-tick" aria-hidden="true" />
                </span>
                <span className="st-card-d">{LAYOUT_INFO[l].description}</span>
              </button>
            ))}
          </div>
        </Pane>

        {/* 6 — Delete account */}
        <DeleteAccount />
      </div>

      <div className="sc-toast-host" role="status" aria-live="polite">
        {saved && <span className={`sc-toast${savedOk ? '' : ' is-warn'}`}>{saved}</span>}
      </div>
    </>
  );
}
