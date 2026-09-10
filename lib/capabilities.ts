/**
 * Which plan a given surface actually requires.
 *
 * WHY THIS EXISTS
 * ---------------
 * `SubscriptionGuard` used to ask one question — "has this account paid
 * anything?" — and every guarded page shared the answer. That made the whole
 * ladder decorative above Pro: $9 opened API monitoring, provider analytics and
 * performance timing exactly as $99 did, while the modal advertising API
 * monitoring quoted $19 for something $9 already unlocked.
 *
 * Naming the requirement per surface is what lets the ladder mean something,
 * and it lets a locked page quote the plan that would actually unlock it rather
 * than a fixed price that may be wrong in either direction.
 *
 * TWO OF THESE ARE DELIBERATELY FREE
 * ----------------------------------
 * `routing` and `data-api` require nothing. Both are real free allowances —
 * 1,000 routed requests a month and 10 Data API calls a day — that the UI made
 * unreachable by paywalling the pages where you create the key. The pricing
 * table sold both, `/api-docs` told free users to "sign up and create a key",
 * and the page to do it was locked. Charging for the door to a room we say is
 * free is worse than not offering the room.
 */
import type { Plan } from '@/lib/entitlements';

export type Capability =
  /** Create a router key, attach provider keys, see the routing dashboard. */
  | 'routing'
  /** Issue and manage public Data API keys. */
  | 'data-api'
  /** Historical analysis, the full matrix, exports. */
  | 'analysis'
  /** Routed-traffic analytics and timing breakdowns. */
  | 'routing-analytics'
  /** Per-key request logs, prompt auditing, budget controls. */
  | 'api-monitoring'
  /** Shared workspace, seats, projects, webhooks. */
  | 'team'
  /** SSO, SCIM and the audit trail. */
  | 'governance';

/** The lowest plan on the ladder that unlocks each capability. */
export const REQUIRED_PLAN: Record<Capability, Plan> = {
  routing: 'free',
  'data-api': 'free',
  analysis: 'pro',
  'routing-analytics': 'pro',
  // Prompt auditing and budget enforcement are production concerns, and the
  // decision-log retention that makes them useful starts at Developer.
  'api-monitoring': 'developer',
  team: 'teams',
  governance: 'teams',
};

/** Human-readable name for a locked surface, used in upgrade copy. */
export const CAPABILITY_LABEL: Record<Capability, string> = {
  routing: 'Routing',
  'data-api': 'Data API keys',
  analysis: 'Deeper analysis',
  'routing-analytics': 'Routing analytics',
  'api-monitoring': 'API monitoring',
  team: 'Shared workspace',
  governance: 'Security and governance',
};
