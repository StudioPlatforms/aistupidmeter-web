import { createHmac, timingSafeEqual } from 'crypto';

/**
 * The cancel link in the $4.99 → $12 notice (lib/billing-watch.ts). It is signed for one account
 * and one subscription, so it works without signing in and can only ever cancel that subscription,
 * at the end of the period already paid for. Opening it changes nothing: app/billing/cancel asks
 * first, because mail scanners open every link in a message.
 */
const SITE = 'https://aistupidlevel.info';

/** A subscription that does not exist, for showing the page to ourselves (demo account only). */
export const PREVIEW_SUBSCRIPTION = 'sub_preview';

function sign(userId: number, subscriptionId: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET is not set');
  return createHmac('sha256', secret).update(`cancel.${userId}.${subscriptionId}`).digest('base64url').slice(0, 32);
}

export function cancelLink(userId: number, subscriptionId: string): string {
  return `${SITE}/billing/cancel?u=${userId}&s=${encodeURIComponent(subscriptionId)}&t=${sign(userId, subscriptionId)}`;
}

/** The account and subscription a link was signed for, or null when it was not signed by us. */
export function readCancelLink(p: { u?: string; s?: string; t?: string }): { userId: number; subscriptionId: string } | null {
  const userId = Number(p.u);
  if (!Number.isInteger(userId) || userId <= 0 || !p.s || !/^sub_[A-Za-z0-9]+$/.test(p.s) || !p.t) return null;
  const want = Buffer.from(sign(userId, p.s));
  const given = Buffer.from(p.t);
  return want.length === given.length && timingSafeEqual(want, given) ? { userId, subscriptionId: p.s } : null;
}
