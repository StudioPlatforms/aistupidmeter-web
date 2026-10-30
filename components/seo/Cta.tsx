'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { PLANS } from '@/lib/entitlements';

/**
 * The SEO pages' calls to action. Each knows where a signed-in and a signed-out visitor should go,
 * and every anchor carries data-cta="<page>-<section>-<label>", which components/VisitorTracker.tsx
 * turns into a cta_click analytics event. Styles are the landing's buttons (.lp-btn) plus the
 * small rules in styles/seo.css. Numbers come from the plan table, never typed.
 */

const n = (x: number) => x.toLocaleString('en-US');
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (x: number) => WORDS[x] ?? n(x);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const FREE = PLANS.free;
const signup = (next: string) => `/auth/signup?callbackUrl=${encodeURIComponent(next)}`;
const signin = (next: string) => `/auth/signin?callbackUrl=${encodeURIComponent(next)}`;

function useSignedIn(): boolean {
  const { status } = useSession();
  return status === 'authenticated';
}

/** A label's trailing arrow becomes the landing's animated arrow span. */
function Label({ text }: { text: string }) {
  const t = text.replace(/\s*→\s*$/, '');
  return <>{t} <span className="lp-ar" aria-hidden="true">→</span></>;
}

/** loginText: the sign-in prompt in the page's language, e.g. ['已有账户？', '登录'] on /zh. */
function Block({ href, label, sub, cta, ghost, login, loginText = ['Already have an account?', 'Log in'] }: { href: string; label: string; sub?: string; cta: string; ghost?: boolean; login?: string; loginText?: [string, string] }) {
  return (
    <div className="seo-cta">
      <Link href={href} className={`lp-btn ${ghost ? 'lp-btn-ghost' : 'lp-btn-primary'}`} data-cta={cta}>
        <Label text={label} />
      </Link>
      {sub && <p className="seo-cta-sub">{sub}</p>}
      {login && (
        <p className="seo-cta-sub">
          {loginText[0]} <Link href={login} data-cta={`${cta}-login`}>{loginText[1]}</Link>
        </p>
      )}
    </div>
  );
}

/** Choosing between models: the boards. */
export function LeaderboardCta({ label, sub, cta, ghost, loginText }: { label?: string; sub?: string; cta: string; ghost?: boolean; loginText?: [string, string] }) {
  const signedIn = useSignedIn();
  // Captions are sign-up pitches (free account, no card): never shown to a signed-in visitor.
  if (signedIn) return <Block href="/" label={label ?? 'Open the leaderboard →'} cta={cta} ghost={ghost} />;
  return (
    <Block
      href={signup('/')}
      label={label ?? 'See every model on every board →'}
      sub={sub ?? `Free account · 24 hours, 7 days and ${FREE.historyDays} days · no card`}
      cta={cta}
      ghost={ghost}
      login={signin('/')}
      loginText={loginText}
    />
  );
}

/** Worried about a model: watch it. With a slug, the model is the one to star. */
export function WatchCta({ slug, label, sub, cta, ghost }: { slug?: string; label?: string; sub?: string; cta: string; ghost?: boolean }) {
  const signedIn = useSignedIn();
  const next = slug ? `/models/${slug}?track=1` : '/watchlist';
  return (
    <Block
      href={signedIn ? next : signup(next)}
      label={label ?? 'Get an email when it changes →'}
      sub={signedIn ? undefined : sub ?? `${cap(word(FREE.watchedModels))} models free · email when a watched model's coding score falls five points in a week`}
      cta={cta}
      ghost={ghost}
    />
  );
}

/** Choosing between models, or routing around an outage: a router key. */
export function RouterCta({ label, sub, cta, ghost }: { label?: string; sub?: string; cta: string; ghost?: boolean }) {
  const signedIn = useSignedIn();
  if (signedIn) return <Block href="/router/keys" label={label ?? 'Get a router key →'} cta={cta} ghost={ghost} />;
  return (
    <Block
      href={signup('/router/keys')}
      label={label ?? 'Get a free router key →'}
      sub={sub ?? `${n(FREE.routerRequestsPerMonth)} routed requests a month free · your own provider keys · no card`}
      cta={cta}
      ghost={ghost}
    />
  );
}

/** A sign-up that lands on `next` (signed-in visitors go straight there). */
export function SignupCta({ next, label, sub, cta, ghost }: { next: string; label: string; sub?: string; cta: string; ghost?: boolean }) {
  const signedIn = useSignedIn();
  return <Block href={signedIn ? next : signup(next)} label={label} sub={signedIn ? undefined : sub} cta={cta} ghost={ghost} />;
}

/** Lays CTA blocks side by side (stacked on phones). A plain div, safe to use from server components. */
export function CtaRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`seo-cta-row ${className}`.trim()}>{children}</div>;
}
