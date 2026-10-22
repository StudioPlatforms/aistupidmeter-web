/**
 * What /api/admin/overview and /api/admin/accounts return, shared by the routes and the admin
 * page. Types only, so the client bundle imports nothing from the server-side modules.
 *
 * Money is in cents. "Monthly" amounts normalise annual prices to a twelfth.
 */
import type { Plan } from '@/lib/entitlements';
import type { SubscriptionStatus } from '@/lib/db-client';

export type { Plan, SubscriptionStatus };

export interface AdminAccount {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
  /** 'google' | 'github' | 'password', or another OAuth provider's name. */
  method: string;
  verified: boolean;
  /** Signed up with a password since 2026-10-04 and has not confirmed the address yet. */
  pendingVerification: boolean;
  /** The account's own plan right now (lib/entitlements ownPlanFor). */
  plan: Plan;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  canceledAt: string | null;
  endsAt: string | null;
  lastPaymentAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  role: string;
  /** One of our own accounts (admins, the system user, the demo account): left out of totals. */
  internal: boolean;
  watchedModels: number;
}

export interface AdminSubscription {
  id: string;
  customerId: string;
  /** The account it belongs to, from its metadata, our customer id, or the customer's email. */
  userId: number | null;
  email: string | null;
  status: string;
  plan: Plan | null;
  /** List price per billing interval, in cents. */
  amount: number;
  interval: string;
  monthly: number;
  startedAt: string;
  periodEnd: string | null;
  trialEnd: string | null;
  cancelAt: string | null;
  endedAt: string | null;
  /** Carries a discount, so the list price overstates what it collects. */
  discounted: boolean;
  /** The account's own record points at this subscription (others on the customer are leftovers). */
  linked: boolean;
  invoice?: { attempts: number; nextAttemptAt: string | null; amountDue: number };
}

export type AttentionKind =
  | 'past_due' | 'duplicate' | 'unpaid_access' | 'unlinked' | 'trial_ending' | 'legacy_anniversary';

export interface AttentionItem {
  kind: AttentionKind;
  tone: 'bad' | 'warn' | 'accent';
  title: string;
  detail: string;
  userId?: number;
  email?: string;
  links?: Array<{ label: string; href: string }>;
}

export interface PlanRow {
  plan: Plan;
  label: string;
  accounts: number;
  byStatus: Record<SubscriptionStatus, number>;
  /** Monthly list-price revenue from this plan's active Stripe subscriptions, in cents. */
  mrr: number;
}

export interface RouterUser {
  userId: number;
  email: string;
  internal: boolean;
  /** The plan the allowance comes from, a workspace's included (as the API enforces it). */
  plan: Plan;
  status: SubscriptionStatus;
  /** Successful requests this calendar month: what the allowance counts. */
  used: number;
  failedThisMonth: number;
  /** Monthly allowance; -1 is unlimited. */
  limit: number;
  credits: number;
  /** Allowance left plus prepaid credits; null when unlimited. */
  remaining: number | null;
  today: number;
  last7: number;
  last30: number;
  last30Success: number;
  total: number;
  firstAt: string | null;
  lastAt: string | null;
  keysActive: number;
  keysTotal: number;
  keyLastUsedAt: string | null;
  providers: string[];
  providerKeysFailing: number;
  /** Requests refused because no provider key was saved, ever. */
  noProviderKey: number;
  topModel: { provider: string; model: string; requests: number } | null;
  topMode: string | null;
  tokens30: number;
  /** Estimated provider cost of the last 30 days' successful requests, in dollars (paid to the providers). */
  cost30: number;
  latency30: number | null;
}

export interface DataApiAccount {
  userId: number;
  email: string;
  internal: boolean;
  plan: Plan;
  activeKeys: number;
  today: number;
  totalRequests: number;
  lastUsedAt: string | null;
}

export interface AdminOverview {
  generatedAt: string;
  internalAccounts: number;
  accounts: {
    total: number;
    today: number;
    week: number;
    month: number;
    verified: number;
    pendingVerification: number;
    methods: Array<{ method: string; count: number }>;
    signupsDaily: Array<{ date: string; count: number }>;
    recent: AdminAccount[];
  };
  plans: PlanRow[];
  billing: {
    /** Null when Stripe could not be read; every figure below is then zero. */
    error: string | null;
    fetchedAt: string | null;
    mrr: number;
    /** Active subscriptions that will not renew (cancellation scheduled). */
    ending: number;
    /** Past-due subscriptions: billed, not collected. */
    atRisk: number;
    /** Trials not cancelled: what they add if they convert. */
    trialPipeline: number;
    payingCustomers: number;
    trialing: number;
    pastDue: number;
    collected30: number;
    invoicesPaid30: number;
    discounted: number;
    subscriptions: AdminSubscription[];
    legacy: {
      live: number;
      /** Each legacy subscriber's 12-month mark, from their first $4.99 subscription. */
      anniversaries: Array<{ userId: number; email: string; firstStart: string; anniversary: string }>;
    };
  };
  attention: AttentionItem[];
  router: {
    error: string | null;
    month: string;
    totals: {
      today: number; last7: number; last30: number; last30Success: number;
      monthSuccess: number; monthFailed: number;
      active7: number; active30: number; activeMonth: number;
      tokens30: number; cost30: number; latency30: number | null; fallback30: number;
    };
    funnel: Array<{ step: string; count: number }>;
    daily: Array<{ date: string; ok: number; failed: number }>;
    models: Array<{ provider: string; model: string; requests: number }>;
    modes: Array<{ mode: string; requests: number }>;
    failures: Array<{ cause: string; requests: number }>;
    users: RouterUser[];
  };
  dataApi: {
    keys: number;
    activeKeys: number;
    accounts: number;
    today: number;
    totalRequests: number;
    top: DataApiAccount[];
  };
  engagement: {
    watchlistAccounts: number;
    watchedModels: number;
    driftAlertsOn: number;
    digestOn: number;
    emailOptedOut: number;
    workspaces: number;
    workspaceMembers: number;
    forumTopics: number;
    forumPosts: number;
    forumPosts7: number;
    contact30: number;
    checkouts30: number;
    subscriptionsStarted30: number;
    cancellations30: number;
    paywallHits30: number;
  };
}
