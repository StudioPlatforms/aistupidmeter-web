import type { WatchModel } from '../ws';

export interface Policy {
  strategy: string; lockStrategy: boolean; allowPinning: boolean; allowedModels: string[]; excludedProviders: string[];
  maxCostPer1k: number | null; maxLatencyMs: number | null; requireToolCalling: boolean; fallbackEnabled: boolean;
  fallbackOrder: string[]; avoidDrifting: boolean; trafficSplit: Array<{ model: string; weight: number }>;
  maxOutputTokens: number | null; rpmLimit: number | null; promptLogging: 'key' | 'off' | 'on'; allowPersonalProviderKeys: boolean;
}

export interface Budget {
  monthlyUsd: number | null; mode: 'alert' | 'block' | 'downgrade'; thresholds: number[]; memberCapUsd: number | null;
  month: { month: string; spendUsd: number; requests: number; forecastUsd: number | null; daysElapsed: number; daysInMonth: number; budgetUsd: number | null; budgetUsed: number | null };
}

export interface ProjectMember {
  userId: number; name: string; email: string | null; wsRole: string; role: 'manager' | 'member'; listed: boolean;
  addedAt: string | null; alertsMuted: boolean; capUsd: number | null; effectiveCapUsd: number | null; monthSpendUsd: number | null;
}

export interface ProjectKey {
  id: number; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; expiresAt: string | null;
  revoked: boolean; mine: boolean; holder: string; expired: boolean;
}

export interface SharedKey {
  id: number; provider: string; alias: string | null; hint: string | null; active: boolean; scope: 'project' | 'workspace';
  addedBy: string | null; createdAt: string; lastValidatedAt: string | null; validationError: string | null;
}

export interface ProjectData {
  project: { id: number; name: string; description: string | null; createdAt: string; createdBy: string | null; spendVisibility: 'members' | 'managers' };
  workspace: { id: number; name: string; plan: string; planActive: boolean; webhooks: boolean };
  me: {
    userId: number; wsRole: string; projectRole: 'manager' | 'member' | null; isOwner: boolean;
    canContribute: boolean; canManage: boolean; canSeeSpendDetail: boolean; alertsMuted: boolean;
    monthlyCapUsd: number | null; monthSpendUsd: number;
  };
  members: ProjectMember[];
  candidates: Array<{ userId: number; name: string; email: string | null; wsRole: string }>;
  watchlist: { models: WatchModel[]; limit: number | null; alerts: { minDropPoints: number; recipients: string } };
  policy: Policy;
  budget: Budget;
  budgetEvents: Array<{ kind: string; threshold: number; spendUsd: number; limitUsd: number; month: string; at: string; person: string | null }>;
  keys: ProjectKey[];
  providerKeys: SharedKey[];
  providerSources: Record<string, 'project' | 'workspace' | 'members'>;
  webhooks: Array<{ id: number; url: string; events: string; active: number; last_sent_at: string | null; last_status: number | null }>;
  minSample: number;
}

export interface MemberStat {
  userId: number; name: string; email: string | null; requests: number; successful: number; failed: number; successRate: number | null;
  spendUsd: number; share: number; tokensIn: number; tokensOut: number; avgLatencyMs: number | null; costPerRequest: number | null;
  costPer1kTokens: number | null; pinnedShare: number | null; rescued: number; topModel: string | null; lastActive: string | null; costIndex: number | null;
}

export interface Report {
  window: { from: string; to: string; label: string; days: number };
  totals: {
    requests: number; successful: number; failed: number; successRate: number | null; spendUsd: number; tokensIn: number; tokensOut: number;
    avgLatencyMs: number | null; p50LatencyMs: number | null; p95LatencyMs: number | null; costPerRequest: number | null;
    costPer1kTokens: number | null; rescued: number; activePeople: number; previousSpendUsd: number; previousRequests: number; spendChange: number | null;
  };
  daily: Array<{ date: string; spendUsd: number; requests: number; successful: number; top: Array<{ userId: number; spendUsd: number }> }>;
  members: MemberStat[];
  models: Array<{ model: string; provider: string; requests: number; successful: number; successRate: number | null; spendUsd: number; share: number; avgLatencyMs: number | null; costPer1kTokens: number | null; people: number }>;
  keys: Array<{ keyId: number; userId: number; requests: number; spendUsd: number; lastAt: string | null }>;
  categories: Array<{ category: string; requests: number; share: number }>;
  keySources: Array<{ source: string; requests: number; spendUsd: number; share: number }>;
  failures: Array<{ failureClass: string; requests: number }>;
  hours: number[];
  highlights: {
    topSpender: { userId: number; spendUsd: number; share: number } | null;
    mostActive: { userId: number; requests: number } | null;
    mostEfficient: { userId: number; costIndex: number } | null;
    mostReliable: { userId: number; successRate: number; requests: number } | null;
    busiestHourUtc: number | null;
    pinnedVsRouted: { pinnedPer1k: number; routedPer1k: number; ratio: number } | null;
  };
  insights: string[];
  memberDetail: boolean;
  minSample: number;
}
