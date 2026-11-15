/**
 * Activation events, web side. Mirrors apps/api/src/lib/activation.ts.
 *
 * Same rules: server-side only, append-only, never throws. Instrumentation must
 * not be able to break the flow it measures.
 */
import { openIdentityDb } from '@/lib/identity-db';

export type ActivationEvent =
  | 'account_created'
  | 'watchlist_first_save'
  | 'watchlist_save'
  | 'premium_blocked'
  | 'checkout_started'
  | 'subscription_started'
  | 'subscription_cancelled'
  // Cancel and refund within the 7-day window (lib/paid-start.ts), from 2026-11-13.
  | 'subscription_refunded'
  | 'digest_sent'
  | 'api_key_created'
  | 'first_routed_request';

export function recordActivation(
  userId: number | null,
  event: ActivationEvent,
  plan?: string | null,
  detail?: Record<string, unknown>,
): void {
  try {
    openIdentityDb().prepare(
      'INSERT INTO activation_events (user_id, event, plan, detail) VALUES (?, ?, ?, ?)'
    ).run(userId, event, plan ?? null, detail ? JSON.stringify(detail).slice(0, 2000) : null);
  } catch (err) {
    console.error(`[activation] failed to record ${event}:`, err);
  }
}
