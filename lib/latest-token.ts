import { createHmac } from 'crypto';

/**
 * Server-side requests for the newest benchmark run carry the same scoped token the browser gets
 * from /api/session-token: the API refuses `latest` without it (apps/api middleware/latest-gate.ts).
 * Only call this after the session's plan has been checked.
 *
 * The expiry is rounded to the hour, so a cached server fetch keeps one cache key for an hour
 * instead of one per request (Next keys its fetch cache on the headers too). The token never
 * leaves the server.
 */
export function latestTokenHeaders(): Record<string, string> {
  const secret = process.env.ASL_WEB_TOKEN_SECRET;
  if (!secret) return {};
  const HOUR = 3600;
  const exp = (Math.floor(Date.now() / 1000 / HOUR) + 2) * HOUR;
  const mac = createHmac('sha256', secret).update(`${exp}.latest`).digest('hex').slice(0, 32);
  return { 'x-asl-token': `2.${exp}.latest.${mac}` };
}
