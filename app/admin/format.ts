import { PLANS, type Plan } from '@/lib/entitlements';
import type { SubscriptionStatus } from '@/lib/admin-types';

export const num = (n: number) => Math.round(n).toLocaleString('en-US');

/** Cents as dollars: $1,234.56, or $1,234 when `whole`. */
export const money = (cents: number, whole = false) =>
  `$${(cents / 100).toLocaleString('en-US', whole
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const usd = (dollars: number) =>
  `$${dollars.toLocaleString('en-US', { maximumFractionDigits: dollars >= 100 ? 0 : 2 })}`;

/** 950 · 1.2K · 76.3M */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${Math.round(n / 1e3)}K`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

export const pct = (part: number, whole: number) => {
  if (!whole) return '—';
  const p = (part / whole) * 100;
  // One decimal at either end, so 548 of 549 reads 99.8%, not a rounded 100%.
  return `${(p > 0 && p < 1) || (p > 99 && p < 100) ? p.toFixed(1) : Math.round(p)}%`;
};

/** One short token: "now", "12m", "3h", "5d", "4mo", "2y". */
export function ago(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  if (s < 86_400 * 60) return `${Math.floor(s / 86_400)}d`;
  if (s < 86_400 * 730) return `${Math.floor(s / (86_400 * 30))}mo`;
  return `${Math.floor(s / (86_400 * 365))}y`;
}

/** "22 Oct", or "22 Oct 2025" outside the current year. */
export function day(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return '—';
  const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC' });
}

export const fullDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

export const clock = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

/** Plan names as the admin needs them: the legacy plan is named for what it is. */
export const planLabel = (plan: Plan | null | undefined) =>
  !plan ? '—' : plan === 'legacy_pro' ? 'Pro · legacy $4.99' : PLANS[plan].label;

export const STATUS: Record<SubscriptionStatus, { label: string; tone?: 'good' | 'warn' | 'bad' | 'accent' }> = {
  active: { label: 'Paying', tone: 'good' },
  trial: { label: 'Trial', tone: 'accent' },
  past_due: { label: 'Past due', tone: 'bad' },
  cancelled: { label: 'Cancelled', tone: 'warn' },
  complimentary: { label: 'Complimentary' },
  free: { label: 'Free' },
};

/** A Stripe subscription status, for the subscriptions table. */
export function stripeStatus(status: string, cancelAt: string | null): { label: string; tone?: 'good' | 'warn' | 'bad' | 'accent' } {
  if (status === 'canceled' || status === 'incomplete_expired') return { label: 'Ended' };
  if (cancelAt && (status === 'active' || status === 'trialing')) return { label: `Cancels ${day(cancelAt)}`, tone: 'warn' };
  switch (status) {
    case 'active': return { label: 'Active', tone: 'good' };
    case 'trialing': return { label: 'Trial', tone: 'accent' };
    case 'past_due': return { label: 'Past due', tone: 'bad' };
    case 'unpaid': return { label: 'Unpaid', tone: 'bad' };
    default: return { label: status.replace(/_/g, ' '), tone: 'warn' };
  }
}

export const METHOD_LABEL: Record<string, string> = { google: 'Google', github: 'GitHub', password: 'Email and password' };

export const PROVIDER_NAME: Record<string, string> = {
  openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', xai: 'xAI', deepseek: 'DeepSeek', kimi: 'Kimi', glm: 'GLM',
};

export const stripeUrl = (kind: 'subscriptions' | 'customers', id: string) => `https://dashboard.stripe.com/${kind}/${id}`;
