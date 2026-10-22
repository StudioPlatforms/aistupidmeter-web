/**
 * Everything on the admin dashboard (/admin), in one read.
 *
 * Three sources, joined here because only this side may know who anyone is:
 *   - the identity database: accounts, plans, the Stripe-synced status label, engagement;
 *   - Stripe (lib/admin-stripe): subscriptions and money, the source of truth for billing;
 *   - the API's /internal/admin/router-usage: Smart Router and Data API counts per user id,
 *     from the benchmark database this app never opens (see lib/identity-db.ts).
 *
 * Our own accounts (admins, the system user, the demo account) appear in tables tagged
 * "internal" but are left out of every total, so the numbers describe customers.
 *
 * A source that fails reports its error and zeros; the rest of the page still renders.
 */
import { openIdentityDb } from '@/lib/identity-db';
import { PLANS, ownPlanFor, planFor, isUnlimited, type Plan } from '@/lib/entitlements';
import { withWorkspace } from '@/lib/workspace-plan';
import type { SubscriptionStatus } from '@/lib/db-client';
import { stripeSnapshot, type StripeSnapshot, type StripeSubscriptionRecord } from '@/lib/admin-stripe';
import type {
  AdminAccount, AdminOverview, AdminSubscription, AttentionItem, DataApiAccount, PlanRow, RouterUser,
} from '@/lib/admin-types';

const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

/** The shared demo account the test harnesses sign in as. */
const DEMO_ACCOUNT_ID = 1360;
const INTERNAL_ROLES = new Set(['admin', 'superadmin', 'system']);

const STATUSES: SubscriptionStatus[] = ['free', 'trial', 'active', 'past_due', 'cancelled', 'complimentary'];
const PLAN_ORDER: Plan[] = ['free', 'pro', 'developer', 'teams', 'enterprise', 'legacy_pro'];
/** Stripe states in which a subscription still bills or will bill. */
const LIVE = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete']);
const DAY = 86_400_000;

interface UserRow {
  id: number;
  email: string;
  name: string | null;
  created_at: string;
  oauth_provider: string | null;
  email_verified: number;
  verification_required: number | null;
  role: string | null;
  subscription_status: string | null;
  subscription_tier: string | null;
  trial_ends_at: string | null;
  subscription_canceled_at: string | null;
  subscription_ends_at: string | null;
  last_payment_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

/** The API's per-user router and Data API counts (apps/api/src/routes/admin-stats.ts). */
interface RouterUsageResponse {
  month: string;
  from30: string;
  users: Array<{
    userId: number; total: number; totalSuccess: number; monthSuccess: number; monthFailed: number;
    today: number; last7: number; last30: number; last30Success: number; tokens30: number; cost30: number;
    latency30: number | null; fallback30: number; noProviderKey: number; firstAt: string | null; lastAt: string | null;
  }>;
  models30: Array<{ userId: number; provider: string | null; model: string | null; requests: number }>;
  modes30: Array<{ userId: number; mode: string; requests: number }>;
  failures30: Array<{ userId: number; cause: string; requests: number }>;
  daily: Array<{ userId: number; date: string; ok: number; failed: number }>;
  keys: Array<{ userId: number; total: number; active: number; firstCreatedAt: string | null; lastUsedAt: string | null }>;
  providerKeys: Array<{ userId: number; total: number; active: number; providers: string | null; failing: number }>;
  dataApiKeys: Array<{ userId: number; total: number; active: number; today: number; totalRequests: number; lastUsedAt: string | null }>;
}

/** 'YYYY-MM-DD HH:MM:SS' (UTC, from SQLite) or ISO, as ISO. */
function toIso(s: string | null | undefined): string | null {
  if (!s) return null;
  return /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(s) ? `${s.replace(' ', 'T')}.000Z` : s;
}

const time = (s: string | null | undefined) => {
  const t = Date.parse(toIso(s) ?? '');
  return Number.isNaN(t) ? null : t;
};

const shortId = (id: string) => `…${id.slice(-8)}`;
const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (iso: string | null) => iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  : 'unknown';
const planName = (plan: Plan | null) => (plan === 'legacy_pro' ? 'Pro ($4.99 legacy)' : plan ? PLANS[plan].label : 'unknown plan');
const stripeLink = (kind: 'subscriptions' | 'customers', id: string) => `https://dashboard.stripe.com/${kind}/${id}`;

/** The last 30 calendar days (UTC), oldest first, ending today. */
function last30Days(): string[] {
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  return Array.from({ length: 30 }, (_, i) => new Date(today - (29 - i) * DAY).toISOString().slice(0, 10));
}

function statusOf(row: UserRow, plan: Plan): SubscriptionStatus {
  // The label never outranks access: an account whose plan has lapsed reads free.
  if (plan === 'free') return 'free';
  const s = row.subscription_status as SubscriptionStatus;
  return STATUSES.includes(s) && s !== 'free' ? s : 'active';
}

const isInternal = (r: UserRow) => INTERNAL_ROLES.has(r.role ?? '') || r.id === DEMO_ACCOUNT_ID;

const USER_COLUMNS = `id, email, name, created_at, oauth_provider, email_verified, verification_required, role,
  subscription_status, subscription_tier, trial_ends_at, subscription_canceled_at,
  subscription_ends_at, last_payment_at, stripe_customer_id, stripe_subscription_id`;

function toAccount(r: UserRow, watchedModels: number): AdminAccount {
  const plan = ownPlanFor(r);
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    createdAt: toIso(r.created_at) ?? r.created_at,
    method: r.oauth_provider || 'password',
    verified: r.email_verified === 1,
    pendingVerification: r.verification_required === 1 && r.email_verified !== 1,
    plan,
    status: statusOf(r, plan),
    trialEndsAt: r.trial_ends_at,
    canceledAt: r.subscription_canceled_at,
    endsAt: r.subscription_ends_at,
    lastPaymentAt: toIso(r.last_payment_at),
    stripeCustomerId: r.stripe_customer_id,
    stripeSubscriptionId: r.stripe_subscription_id,
    role: r.role || 'user',
    internal: isInternal(r),
    watchedModels,
  };
}

async function routerUsage(): Promise<RouterUsageResponse> {
  const token = process.env.ROUTER_INTERNAL_TOKEN;
  if (!token) throw new Error('ROUTER_INTERNAL_TOKEN is not set');
  const r = await fetch(`${API_URL}/internal/admin/router-usage`, {
    headers: { 'x-internal-token': token },
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!r.ok) throw new Error(`The API answered ${r.status}`);
  return r.json();
}

const sumBy = <T>(items: T[], f: (t: T) => number) => items.reduce((n, t) => n + (f(t) || 0), 0);

export async function buildOverview({ freshStripe = false } = {}): Promise<AdminOverview> {
  const [stripeResult, routerResult] = await Promise.allSettled([stripeSnapshot(freshStripe), routerUsage()]);
  const stripe: StripeSnapshot | null = stripeResult.status === 'fulfilled' ? stripeResult.value : null;
  const usage: RouterUsageResponse | null = routerResult.status === 'fulfilled' ? routerResult.value : null;
  const errorText = (r: PromiseSettledResult<unknown>) =>
    r.status === 'rejected' ? (r.reason instanceof Error ? r.reason.message : String(r.reason)) : null;

  const db = openIdentityDb();
  try {
    const rows = db.prepare(`SELECT ${USER_COLUMNS} FROM router_users`).all() as UserRow[];

    const internalIds = new Set(rows.filter(isInternal).map(r => r.id));
    const customers = rows.filter(r => !internalIds.has(r.id));
    const byId = new Map(rows.map(r => [r.id, r]));
    const now = Date.now();

    const watched = new Map<number, number>();
    for (const w of db.prepare('SELECT user_id AS userId, COUNT(*) AS n FROM watchlists GROUP BY user_id').all() as Array<{ userId: number; n: number }>) {
      watched.set(w.userId, w.n);
    }

    // ── Accounts ────────────────────────────────────────────────────────
    const days = last30Days();
    const todayKey = days[days.length - 1];
    const signups = new Map(days.map(d => [d, 0]));
    const methods = new Map<string, number>();
    let today = 0, week = 0, month = 0, verified = 0, pendingVerification = 0;
    for (const r of customers) {
      const created = time(r.created_at);
      const key = toIso(r.created_at)?.slice(0, 10) ?? '';
      if (signups.has(key)) signups.set(key, signups.get(key)! + 1);
      if (key === todayKey) today++;
      if (created !== null && created >= now - 7 * DAY) week++;
      if (created !== null && created >= now - 30 * DAY) month++;
      if (r.email_verified === 1) verified++;
      if (r.verification_required === 1 && r.email_verified !== 1) pendingVerification++;
      const m = r.oauth_provider || 'password';
      methods.set(m, (methods.get(m) ?? 0) + 1);
    }
    const recent = [...customers].sort((a, b) => b.id - a.id).slice(0, 15).map(r => toAccount(r, watched.get(r.id) ?? 0));

    // ── Plans (own subscription) ───────────────────────────────────────
    const planRows = new Map<Plan, PlanRow>(PLAN_ORDER.map(p => [p, {
      plan: p,
      label: planName(p),
      accounts: 0,
      byStatus: Object.fromEntries(STATUSES.map(s => [s, 0])) as Record<SubscriptionStatus, number>,
      mrr: 0,
    }]));
    for (const r of customers) {
      const plan = ownPlanFor(r);
      const row = planRows.get(plan)!;
      row.accounts++;
      row.byStatus[statusOf(r, plan)]++;
    }

    // ── Stripe ─────────────────────────────────────────────────────────
    const byCustomer = new Map(rows.filter(r => r.stripe_customer_id).map(r => [r.stripe_customer_id!, r]));
    const byEmail = new Map(rows.map(r => [r.email.toLowerCase(), r]));
    const ownerOf = (s: StripeSubscriptionRecord): UserRow | null =>
      (s.metaUserId ? byId.get(s.metaUserId) : undefined)
      ?? byCustomer.get(s.customerId)
      ?? (s.customerEmail ? byEmail.get(s.customerEmail.toLowerCase()) : undefined)
      ?? null;

    const subs: Array<AdminSubscription & { _owner: UserRow | null }> = (stripe?.subscriptions ?? []).map(s => {
      const owner = ownerOf(s);
      return {
        id: s.id, customerId: s.customerId, userId: owner?.id ?? null, email: owner?.email ?? s.customerEmail,
        status: s.status, plan: s.plan ?? (owner ? ownPlanFor(owner) : null), amount: s.amount, interval: s.interval,
        monthly: s.monthly, startedAt: s.startedAt, periodEnd: s.periodEnd, trialEnd: s.trialEnd, cancelAt: s.cancelAt,
        endedAt: s.endedAt, discounted: s.discounted, linked: !!owner && owner.stripe_subscription_id === s.id,
        invoice: s.invoice, _owner: owner,
      };
    });
    const ours = (s: { _owner: UserRow | null }) => !s._owner || !internalIds.has(s._owner.id);
    const live = subs.filter(s => LIVE.has(s.status) && ours(s));
    const active = live.filter(s => s.status === 'active');

    for (const s of active) {
      const p = s.plan && planRows.get(s.plan);
      if (p) p.mrr += s.monthly;
    }
    const mrr = sumBy(active, s => s.monthly);
    const payingCustomers = new Set(active.map(s => s._owner?.id ?? s.customerId)).size;

    // ── Needs attention ────────────────────────────────────────────────
    const attention: AttentionItem[] = [];
    const who = (s: { email: string | null; userId: number | null }) => s.email ?? `customer without an account`;

    for (const s of live.filter(x => x.status === 'past_due' || x.status === 'unpaid')) {
      const inv = s.invoice;
      attention.push({
        kind: 'past_due', tone: 'bad', userId: s.userId ?? undefined, email: s.email ?? undefined,
        title: `${who(s)}: ${planName(s.plan)} renewal not paid`,
        detail: [
          `${money(inv?.amountDue ?? s.amount)} due`,
          inv ? `${inv.attempts} failed attempt${inv.attempts === 1 ? '' : 's'}` : null,
          inv?.nextAttemptAt ? `Stripe retries ${dateLabel(inv.nextAttemptAt)}` : 'no retry scheduled',
          'access continues until Stripe gives up and cancels',
        ].filter(Boolean).join(' · '),
        links: [{ label: 'Subscription in Stripe', href: stripeLink('subscriptions', s.id) }],
      });
    }

    const liveByUser = new Map<number, typeof live>();
    for (const s of live) if (s.userId) liveByUser.set(s.userId, [...(liveByUser.get(s.userId) ?? []), s]);
    liveByUser.forEach((list, userId) => {
      if (list.length < 2) return;
      const linked = list.find(s => s.linked);
      const extra = sumBy(list, s => s.monthly) - (linked?.monthly ?? Math.max(...list.map(s => s.monthly)));
      attention.push({
        kind: 'duplicate', tone: 'bad', userId, email: list[0].email ?? undefined,
        title: `${who(list[0])} has ${list.length} live subscriptions`,
        detail: `About ${money(extra)}/month charged twice. ` + (linked
          ? `The account uses ${shortId(linked.id)}; cancel the other${list.length > 2 ? 's' : ''} and refund the duplicate charges. Cancelling ${shortId(linked.id)} instead would move the account to Free.`
          : 'None of them is the one the account record points at; check the account before cancelling.'),
        links: list.map(s => ({ label: `${shortId(s.id)}${s.linked ? ' (in use)' : ''}`, href: stripeLink('subscriptions', s.id) })),
      });
    });

    if (stripe) {
      const subById = new Map(subs.map(s => [s.id, s]));
      for (const r of customers) {
        if (!r.stripe_subscription_id || ownPlanFor(r) === 'free') continue;
        const s = subById.get(r.stripe_subscription_id);
        if (s && LIVE.has(s.status)) continue;
        attention.push({
          kind: 'unpaid_access', tone: 'warn', userId: r.id, email: r.email,
          title: `${r.email} still has ${planName(ownPlanFor(r))}, unpaid`,
          detail: s
            ? `Stripe ended the subscription on ${dateLabel(s.endedAt)}, but the cancellation never reached the site, so the plan has continued without payment. Moving the account to Free is your call.`
            : 'The subscription this account points at is not in Stripe. Check it before changing anything.',
          links: [
            ...(s ? [{ label: 'Subscription in Stripe', href: stripeLink('subscriptions', s.id) }] : []),
            ...(r.stripe_customer_id ? [{ label: 'Customer in Stripe', href: stripeLink('customers', r.stripe_customer_id) }] : []),
          ],
        });
      }
    }

    for (const s of live.filter(x => !x._owner)) {
      attention.push({
        kind: 'unlinked', tone: 'warn',
        title: `A ${planName(s.plan)} subscription has no account here`,
        detail: `${s.email ?? 'No email on the Stripe customer'} · ${money(s.amount)}/${s.interval} · ${s.status}. Someone is paying, or will pay, for an account the site cannot find.`,
        links: [{ label: 'Subscription in Stripe', href: stripeLink('subscriptions', s.id) }],
      });
    }

    for (const s of live.filter(x => x.status === 'trialing' && x.trialEnd)) {
      const ends = time(s.trialEnd)!;
      if (ends > now + 7 * DAY) continue;
      attention.push({
        kind: 'trial_ending', tone: 'accent', userId: s.userId ?? undefined, email: s.email ?? undefined,
        title: `${who(s)}: ${planName(s.plan)} trial ends ${dateLabel(s.trialEnd)}`,
        detail: s.cancelAt
          ? 'Cancelled during the trial, so it will not convert.'
          : `Converts to ${money(s.amount)}/${s.interval} unless they cancel.`,
        links: [{ label: 'Subscription in Stripe', href: stripeLink('subscriptions', s.id) }],
      });
    }

    // Legacy $4.99: the agreement runs 12 months from each subscriber's first subscription.
    const legacyFirst = new Map<number, string>();
    for (const s of subs) {
      if (s.plan !== 'legacy_pro' || !s.userId || internalIds.has(s.userId)) continue;
      const prev = legacyFirst.get(s.userId);
      if (!prev || s.startedAt < prev) legacyFirst.set(s.userId, s.startedAt);
    }
    const anniversaries = Array.from(legacyFirst.entries())
      .filter(([userId]) => { const r = byId.get(userId); return !!r && ownPlanFor(r) === 'legacy_pro'; })
      .map(([userId, firstStart]) => {
        const d = new Date(firstStart);
        d.setUTCFullYear(d.getUTCFullYear() + 1);
        return { userId, email: byId.get(userId)!.email, firstStart, anniversary: d.toISOString() };
      })
      .sort((a, b) => a.anniversary.localeCompare(b.anniversary));
    for (const a of anniversaries) {
      const t = Date.parse(a.anniversary);
      if (t > now + 30 * DAY) continue;
      const passed = t <= now;
      attention.push({
        kind: 'legacy_anniversary', tone: passed ? 'warn' : 'accent', userId: a.userId, email: a.email,
        title: `${a.email}: 12 months at $4.99 ${passed ? 'reached' : 'reached on'} ${dateLabel(a.anniversary)}`,
        detail: `First subscribed ${dateLabel(a.firstStart)}. The $4.99 price carries on until you decide what happens next; nothing changes on its own.`,
      });
    }
    const toneRank = { bad: 0, warn: 1, accent: 2 } as const;
    attention.sort((a, b) => toneRank[a.tone] - toneRank[b.tone]);

    // ── Smart Router ───────────────────────────────────────────────────
    const credits = new Map<number, number>();
    for (const c of db.prepare('SELECT user_id AS userId, requests_remaining AS n FROM router_credits').all() as Array<{ userId: number; n: number }>) {
      credits.set(c.userId, Math.max(0, c.n));
    }
    const routerUsers: RouterUser[] = [];
    let routerTotals: AdminOverview['router']['totals'] = {
      today: 0, last7: 0, last30: 0, last30Success: 0, monthSuccess: 0, monthFailed: 0,
      active7: 0, active30: 0, activeMonth: 0, tokens30: 0, cost30: 0, latency30: null, fallback30: 0,
    };
    let funnel: AdminOverview['router']['funnel'] = [];
    const daily = days.map(date => ({ date, ok: 0, failed: 0 }));
    let models: AdminOverview['router']['models'] = [];
    let modes: AdminOverview['router']['modes'] = [];
    let failures: AdminOverview['router']['failures'] = [];
    let dataApi: AdminOverview['dataApi'] = { keys: 0, activeKeys: 0, accounts: 0, today: 0, totalRequests: 0, top: [] };

    if (usage) {
      const req = new Map(usage.users.map(u => [u.userId, u]));
      const keys = new Map(usage.keys.map(k => [k.userId, k]));
      const prov = new Map(usage.providerKeys.map(p => [p.userId, p]));
      const top = <T extends { userId: number; requests: number }>(list: T[]) => {
        const best = new Map<number, T>();
        for (const x of list) { const b = best.get(x.userId); if (!b || x.requests > b.requests) best.set(x.userId, x); }
        return best;
      };
      const topModel = top(usage.models30);
      const topMode = top(usage.modes30);

      const ids = new Set<number>(Array.from(req.keys()).concat(Array.from(keys.keys()), Array.from(prov.keys())));
      for (const id of Array.from(ids)) {
        const r = byId.get(id);
        const u = req.get(id);
        const k = keys.get(id);
        const p = prov.get(id);
        const plan = r ? planFor(withWorkspace(id, r)) : 'free';
        const limit = PLANS[plan].routerRequestsPerMonth;
        const used = u?.monthSuccess ?? 0;
        const credit = credits.get(id) ?? 0;
        const m = topModel.get(id);
        routerUsers.push({
          userId: id,
          email: r?.email ?? `account ${id} (deleted)`,
          internal: internalIds.has(id),
          plan,
          status: r ? statusOf(r, ownPlanFor(r)) : 'free',
          used,
          failedThisMonth: u?.monthFailed ?? 0,
          limit,
          credits: credit,
          remaining: isUnlimited(limit) ? null : Math.max(0, limit - used) + credit,
          today: u?.today ?? 0,
          last7: u?.last7 ?? 0,
          last30: u?.last30 ?? 0,
          last30Success: u?.last30Success ?? 0,
          total: u?.total ?? 0,
          firstAt: u?.firstAt ?? null,
          lastAt: u?.lastAt ?? null,
          keysActive: k?.active ?? 0,
          keysTotal: k?.total ?? 0,
          keyLastUsedAt: k?.lastUsedAt ?? null,
          providers: (p?.providers ?? '').split(',').filter(Boolean).sort(),
          providerKeysFailing: p?.failing ?? 0,
          noProviderKey: u?.noProviderKey ?? 0,
          topModel: m ? { provider: m.provider ?? '', model: m.model ?? 'unknown', requests: m.requests } : null,
          topMode: topMode.get(id)?.mode ?? null,
          tokens30: u?.tokens30 ?? 0,
          cost30: u?.cost30 ?? 0,
          latency30: u?.latency30 ?? null,
        });
      }
      routerUsers.sort((a, b) => b.used - a.used || (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));

      const real = routerUsers.filter(u => !u.internal);
      const realReq = usage.users.filter(u => !internalIds.has(u.userId));
      const weighted = sumBy(realReq, u => (u.latency30 ?? 0) * u.last30Success);
      const successes = sumBy(realReq, u => u.last30Success);
      routerTotals = {
        today: sumBy(real, u => u.today),
        last7: sumBy(real, u => u.last7),
        last30: sumBy(real, u => u.last30),
        last30Success: successes,
        monthSuccess: sumBy(real, u => u.used),
        monthFailed: sumBy(real, u => u.failedThisMonth),
        active7: real.filter(u => u.last7 > 0).length,
        active30: real.filter(u => u.last30Success > 0).length,
        activeMonth: real.filter(u => u.used > 0).length,
        tokens30: sumBy(real, u => u.tokens30),
        cost30: sumBy(real, u => u.cost30),
        latency30: successes > 0 ? weighted / successes : null,
        fallback30: sumBy(realReq, u => u.fallback30),
      };

      funnel = [
        { step: 'Accounts', count: customers.length },
        { step: 'Created a router key', count: real.filter(u => u.keysTotal > 0).length },
        { step: 'Saved a provider key', count: real.filter(u => (prov.get(u.userId)?.total ?? 0) > 0).length },
        { step: 'Routed a request', count: realReq.filter(u => u.totalSuccess > 0).length },
        { step: 'Routed in the last 30 days', count: routerTotals.active30 },
        { step: 'Routed in the last 7 days', count: routerTotals.active7 },
      ];

      const dayIndex = new Map(daily.map((d, i) => [d.date, i]));
      for (const d of usage.daily) {
        if (internalIds.has(d.userId)) continue;
        const i = dayIndex.get(d.date);
        if (i === undefined) continue;
        daily[i].ok += d.ok;
        daily[i].failed += d.failed;
      }

      const fold = <T extends { userId: number; requests: number }>(list: T[], key: (t: T) => string) => {
        const out = new Map<string, number>();
        for (const x of list) if (!internalIds.has(x.userId)) out.set(key(x), (out.get(key(x)) ?? 0) + x.requests);
        return Array.from(out.entries()).sort((a, b) => b[1] - a[1]);
      };
      models = fold(usage.models30, m => `${m.provider ?? ''}\u0000${m.model ?? 'unknown'}`)
        .slice(0, 10)
        .map(([k, requests]) => { const [provider, model] = k.split('\u0000'); return { provider, model, requests }; });
      modes = fold(usage.modes30, m => m.mode).map(([mode, requests]) => ({ mode, requests }));
      failures = fold(usage.failures30, f => f.cause).map(([cause, requests]) => ({ cause, requests }));

      const dataRows = usage.dataApiKeys;
      const realData = dataRows.filter(d => !internalIds.has(d.userId));
      dataApi = {
        keys: sumBy(realData, d => d.total),
        activeKeys: sumBy(realData, d => d.active),
        accounts: realData.filter(d => d.active > 0).length,
        today: sumBy(realData, d => d.today),
        totalRequests: sumBy(realData, d => d.totalRequests),
        top: [...dataRows]
          .sort((a, b) => b.totalRequests - a.totalRequests || b.today - a.today)
          .slice(0, 12)
          .map((d): DataApiAccount => {
            const r = byId.get(d.userId);
            return {
              userId: d.userId,
              email: r?.email ?? `account ${d.userId} (deleted)`,
              internal: internalIds.has(d.userId),
              plan: r ? planFor(withWorkspace(d.userId, r)) : 'free',
              activeKeys: d.active,
              today: d.today,
              totalRequests: d.totalRequests,
              lastUsedAt: d.lastUsedAt,
            };
          }),
      };
    }

    // ── Engagement ─────────────────────────────────────────────────────
    const internalArgs = Array.from(internalIds);
    const notInternal = internalArgs.length ? `user_id NOT IN (${internalArgs.map(() => '?').join(',')})` : '1=1';
    const one = (sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args) as { n: number | null } | undefined)?.n ?? 0;
    const events30 = (event: string) => one(
      `SELECT COUNT(DISTINCT user_id) AS n FROM activation_events
        WHERE event = ? AND datetime(created_at) >= datetime('now', '-30 days') AND ${notInternal}`,
      event, ...internalArgs,
    );
    const engagement: AdminOverview['engagement'] = {
      watchlistAccounts: one(`SELECT COUNT(DISTINCT user_id) AS n FROM watchlists WHERE ${notInternal}`, ...internalArgs),
      watchedModels: one(`SELECT COUNT(*) AS n FROM watchlists WHERE ${notInternal}`, ...internalArgs),
      driftAlertsOn: one(`SELECT COUNT(*) AS n FROM watchlists WHERE alerts_enabled = 1 AND ${notInternal}`, ...internalArgs),
      digestOn: one(`SELECT COUNT(*) AS n FROM alert_preferences WHERE weekly_digest = 1 AND ${notInternal}`, ...internalArgs),
      emailOptedOut: one(`SELECT COUNT(*) AS n FROM alert_preferences WHERE weekly_digest = 0 AND email_alerts = 0 AND ${notInternal}`, ...internalArgs),
      workspaces: one('SELECT COUNT(*) AS n FROM organizations'),
      workspaceMembers: one('SELECT COUNT(*) AS n FROM organization_members WHERE active = 1 AND joined_at IS NOT NULL'),
      forumTopics: one('SELECT COUNT(*) AS n FROM forum_topics WHERE is_deleted = 0'),
      forumPosts: one('SELECT COUNT(*) AS n FROM forum_posts WHERE is_deleted = 0'),
      forumPosts7: one(`SELECT COUNT(*) AS n FROM forum_posts WHERE is_deleted = 0 AND datetime(created_at) >= datetime('now', '-7 days')`),
      contact30: one(`SELECT COUNT(*) AS n FROM contact_messages WHERE datetime(created_at) >= datetime('now', '-30 days')`),
      checkouts30: events30('checkout_started'),
      subscriptionsStarted30: events30('subscription_started'),
      cancellations30: events30('subscription_cancelled'),
      paywallHits30: events30('premium_blocked'),
    };

    const recentlyEnded = subs.filter(s => !LIVE.has(s.status) && s.endedAt && time(s.endedAt)! >= now - 60 * DAY && ours(s));
    const strip = ({ _owner, ...s }: AdminSubscription & { _owner: UserRow | null }): AdminSubscription => s;

    return {
      generatedAt: new Date().toISOString(),
      internalAccounts: internalIds.size,
      accounts: {
        total: customers.length, today, week, month, verified, pendingVerification,
        methods: Array.from(methods.entries()).sort((a, b) => b[1] - a[1]).map(([method, count]) => ({ method, count })),
        signupsDaily: days.map(date => ({ date, count: signups.get(date) ?? 0 })),
        recent,
      },
      plans: PLAN_ORDER.map(p => planRows.get(p)!),
      billing: {
        error: errorText(stripeResult),
        fetchedAt: stripe?.fetchedAt ?? null,
        mrr,
        ending: sumBy(active.filter(s => s.cancelAt), s => s.monthly),
        atRisk: sumBy(live.filter(s => s.status === 'past_due' || s.status === 'unpaid'), s => s.monthly),
        trialPipeline: sumBy(live.filter(s => s.status === 'trialing' && !s.cancelAt), s => s.monthly),
        payingCustomers,
        trialing: live.filter(s => s.status === 'trialing').length,
        pastDue: live.filter(s => s.status === 'past_due' || s.status === 'unpaid').length,
        collected30: stripe?.collected30 ?? 0,
        invoicesPaid30: stripe?.invoicesPaid30 ?? 0,
        discounted: live.filter(s => s.discounted).length,
        subscriptions: [...live, ...recentlyEnded].map(strip),
        legacy: {
          live: live.filter(s => s.plan === 'legacy_pro').length,
          anniversaries,
        },
      },
      attention,
      router: {
        error: errorText(routerResult),
        month: usage?.month ?? new Date().toISOString().slice(0, 7),
        totals: routerTotals, funnel, daily, models, modes, failures,
        users: routerUsers,
      },
      dataApi,
      engagement,
    };
  } finally {
    db.close();
  }
}

/** Accounts matching an email fragment or an id, newest first, for the lookup box. */
export function searchAccounts(q: string, limit = 25): AdminAccount[] {
  const query = q.trim();
  if (!query) return [];
  const db = openIdentityDb();
  try {
    const id = /^\d+$/.test(query) ? Number(query) : -1;
    const rows = db.prepare(`
      SELECT ${USER_COLUMNS} FROM router_users
       WHERE id = ? OR instr(lower(email), lower(?)) > 0 OR instr(lower(COALESCE(name, '')), lower(?)) > 0
       ORDER BY id DESC
       LIMIT ?
    `).all(id, query, query, limit) as UserRow[];
    const watched = new Map<number, number>();
    if (rows.length) {
      const list = rows.map(r => r.id);
      for (const w of db.prepare(`SELECT user_id AS userId, COUNT(*) AS n FROM watchlists WHERE user_id IN (${list.map(() => '?').join(',')}) GROUP BY user_id`).all(...list) as Array<{ userId: number; n: number }>) {
        watched.set(w.userId, w.n);
      }
    }
    return rows.map(r => toAccount(r, watched.get(r.id) ?? 0));
  } finally {
    db.close();
  }
}
