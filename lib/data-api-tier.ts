/**
 * Keep a customer's Data API keys on the quota tier their plan grants.
 *
 * WHY THIS IS AN HTTP CALL AND NOT A QUERY
 * ----------------------------------------
 * `data_api_keys` lives in the benchmark database, which this app deliberately
 * never opens — see lib/identity-db.ts for why pointing web-side code at that
 * file is the worst kind of bug, because it succeeds and returns plausible
 * nonsense. So the tier is reconciled by asking the API, which owns that file.
 *
 * WHY IT MATTERS
 * --------------
 * The tier is a column on the key, written when the key is issued. Nothing was
 * re-reading it on a plan change: `reconcileKeyTiers` ran only when the owner
 * happened to open /account/data-keys. A customer who cancelled Teams therefore
 * kept a 100,000-requests-a-day key indefinitely, and one who upgraded did not
 * get the quota they had just paid for until they wandered onto the right page.
 *
 * Fire-and-forget by design. A failure here must never fail a Stripe webhook —
 * Stripe would retry the whole event, and the subscription state that the same
 * handler already wrote is the part that actually matters.
 */

const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

export function syncDataApiTier(userId: number): void {
  const internalToken = process.env.ROUTER_INTERNAL_TOKEN;
  if (!internalToken) {
    console.error('[data-api-tier] ROUTER_INTERNAL_TOKEN is not set; skipping reconcile');
    return;
  }

  void fetch(`${API_URL}/router/data-keys/reconcile`, {
    method: 'POST',
    headers: {
      'x-user-id': String(userId),
      'x-internal-token': internalToken,
    },
    cache: 'no-store',
  })
    .then(async res => {
      const payload = await res.json().catch(() => null);
      const changed = payload?.data?.changed;
      console.log(`[data-api-tier] user ${userId}: ${res.status}${typeof changed === 'number' ? `, ${changed} key(s) retiered` : ''}`);
    })
    .catch(err => {
      console.error(`[data-api-tier] reconcile failed for user ${userId}:`, err?.message ?? err);
    });
}
