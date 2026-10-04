import type { NextRequest } from 'next/server';

/**
 * In-process sliding-window limiter for public endpoints that send email.
 *
 * Every confirmation or reset email we send costs sending reputation, and a form
 * that mails any address on request can be used to flood someone's inbox from our
 * server. One process serves the site, so a Map is enough; a restart only resets
 * the windows.
 */
const hits = new Map<string, number[]>();

/** True when `key` has already made `max` requests in the last `windowMs`; records this one otherwise. */
export function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    hits.forEach((times, k) => { if (!times.some(t => now - t < windowMs)) hits.delete(k); });
  }
  return false;
}

/** The visitor's IP: nginx sets X-Forwarded-For, and its first entry is the original client. */
export function clientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/** Seconds since a stored timestamp ("2026-10-04 17:50:23" UTC or ISO), or null if unusable. */
export function secondsSince(stored: string | null | undefined): number | null {
  if (!stored) return null;
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(stored) ? `${stored.replace(' ', 'T')}Z` : stored;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 1000);
}
