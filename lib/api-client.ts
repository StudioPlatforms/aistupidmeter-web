/**
 * AI Router API Client
 * Type-safe API client for communicating with the backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ============================================================================
// Types
// ============================================================================

export interface UniversalKey {
  id: number;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

export interface ProviderKey {
  id: number;
  provider: 'openai' | 'anthropic' | 'xai' | 'google' | 'glm' | 'deepseek' | 'kimi';
  isActive: boolean;
  createdAt: string;
  lastValidated: string | null;
}

export interface UserPreferences {
  routingStrategy: 'best_overall' | 'best_coding' | 'best_reasoning' | 'best_creative' | 'cheapest' | 'fastest';
  fallbackEnabled: boolean;
  maxCostPer1kTokens: number | null;
  maxLatencyMs: number | null;
  requireToolCalling: boolean;
  requireStreaming: boolean;
  excludedProviders: string[];
  excludedModels: string[];
}

export interface AnalyticsOverview {
  overview: {
    totalRequests: number;
    successfulRequests: number;
    successRate: string;
    totalTokensIn: number;
    totalTokensOut: number;
    totalTokens: number;
    totalCost: string;
  };
  providers: Array<{
    provider: string;
    requests: number;
    totalCost: string;
    percentage: string;
  }>;
  topModels: Array<{
    model: string;
    requests: number;
    totalCost: string;
    percentage: string;
  }>;
}

export interface TimelineData {
  period: string;
  days: number;
  timeline: Array<{
    period: string;
    requests: number;
    successfulRequests: number;
    successRate: string;
    tokensIn: number;
    tokensOut: number;
    totalTokens: number;
    cost: string;
  }>;
}

export interface CostSavings {
  actualCost: string;
  worstCaseCost: string;
  savings: string;
  savingsPercentage: string;
  totalRequests: number;
  averageCostPerRequest: string;
}

export interface RecentRequest {
  id: number;
  provider: string;
  model: string;
  reason: string;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  cost: string;
  latency: number;
  success: boolean;
  timestamp: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// ============================================================================
// API Monitoring Types
// ============================================================================

export interface KeyActivity {
  id: number;
  model: string;
  provider: string;
  category: string | null;
  language: string | null;
  complexity: string | null;
  promptPreview: string | null;
  tokensIn: number;
  tokensOut: number;
  cost: string;
  latency: number;
  success: boolean;
  timestamp: string;
}

export interface KeyCostBreakdown {
  keyId: number;
  keyName: string;
  department: string | null;
  assignedTo: string | null;
  period: string;
  totalCost: string;
  totalRequests: number;
  totalTokens: number;
  dailyCosts: Array<{ date: string; cost: number; requests: number }>;
  modelBreakdown: Array<{ model: string; cost: string; requests: number; percentage: string }>;
  forecast: { daysUntilBudget: number | null; projectedMonthEnd: number };
}

export interface KeySummary {
  id: number;
  name: string;
  keyPrefix: string;
  department: string | null;
  assignedTo: string | null;
  tags: string[];
  budgetLimit: number | null;
  budgetHardLimit: boolean;
  currentSpend: number;
  budgetUtilization: number | null;
  requestCount: number;
  lastUsed: string | null;
  topCategory: string | null;
}

export interface BudgetAlert {
  id: number;
  keyId: number;
  keyName: string;
  alertType: 'threshold_warning' | 'budget_exceeded';
  thresholdPct: number;
  amountSpent: number;
  budgetLimit: number;
  acknowledged: boolean;
  createdAt: string;
}

export interface PromptAuditEntry {
  id: number;
  keyId: number;
  keyName: string;
  department: string | null;
  promptPreview: string;
  category: string;
  language: string;
  complexity: string;
  model: string;
  provider: string;
  cost: string;
  timestamp: string;
}

export interface EfficiencyMetrics {
  keyId: number;
  keyName: string;
  department: string | null;
  avgTokensPerRequest: number;
  avgCostPerRequest: number;
  errorRate: string;
  avgLatency: number;
  requestCount: number;
  topCategories: Array<{ category: string; percentage: string }>;
}

// ============================================================================
// API Client Class
// ============================================================================

class ApiClient {
  private baseUrl: string;
  private userId: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Set the user ID for authenticated requests
   */
  setUserId(userId: string) {
    this.userId = userId;
  }

  /**
   * Make a fetch request with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {};

    // Only add Content-Type if there's a body
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    // Add existing headers from options
    if (options.headers) {
      const existingHeaders = new Headers(options.headers);
      existingHeaders.forEach((value, key) => {
        headers[key] = value;
      });
    }

    // Add user ID header if available (temporary until auth is implemented)
    if (this.userId) {
      headers['x-user-id'] = this.userId;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error: ApiError = await response.json().catch(() => ({
          error: 'Unknown Error',
          message: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        }));
        throw new Error(error.message || `Request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unknown error occurred');
    }
  }

  // ==========================================================================
  // Universal Keys API
  // ==========================================================================

  /**
   * Get all universal API keys for the current user
   */
  async getUniversalKeys(): Promise<{ keys: UniversalKey[] }> {
    return this.request('/api/router/keys');
  }

  /**
   * Create a new universal API key
   */
  async createUniversalKey(name: string): Promise<{
    key: string;
    keyId: number;
    name: string;
    keyPrefix: string;
    message: string;
  }> {
    return this.request('/api/router/keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  /**
   * Revoke a universal API key
   */
  async revokeUniversalKey(keyId: number): Promise<{
    success: boolean;
    message: string;
    keyId: number;
  }> {
    return this.request(`/api/router/keys/${keyId}`, {
      method: 'DELETE',
    });
  }

  // ==========================================================================
  // Provider Keys API
  // ==========================================================================

  /**
   * Get all provider API keys for the current user
   */
  async getProviderKeys(): Promise<{ keys: ProviderKey[] }> {
    return this.request('/api/router/provider-keys');
  }

  /**
   * Add a new provider API key
   */
  async addProviderKey(
    provider: string,
    apiKey: string
  ): Promise<{
    success: boolean;
    message: string;
    keyId: number;
    provider: string;
  }> {
    return this.request('/api/router/provider-keys', {
      method: 'POST',
      body: JSON.stringify({ provider, apiKey }),
    });
  }

  /**
   * Validate a provider API key
   */
  async validateProviderKey(keyId: number): Promise<{
    success: boolean;
    valid: boolean;
    message: string;
    modelsAvailable?: number;
    models?: string[];
  }> {
    return this.request(`/api/router/provider-keys/${keyId}/validate`, {
      method: 'POST',
    });
  }

  /**
   * Delete a provider API key
   */
  async deleteProviderKey(keyId: number): Promise<{
    success: boolean;
    message: string;
    keyId: number;
  }> {
    return this.request(`/api/router/provider-keys/${keyId}`, {
      method: 'DELETE',
    });
  }

  // ==========================================================================
  // Preferences API
  // ==========================================================================

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<UserPreferences> {
    return this.request('/api/router/preferences');
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    preferences: Partial<UserPreferences>
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request('/api/router/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }

  // ==========================================================================
  // Analytics API
  // ==========================================================================

  /**
   * Get analytics overview
   */
  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    return this.request('/api/router/analytics/overview');
  }

  /**
   * Get timeline data
   */
  async getTimeline(
    period: 'hourly' | 'daily' = 'daily',
    days: number = 7
  ): Promise<TimelineData> {
    return this.request(`/api/router/analytics/timeline?period=${period}&days=${days}`);
  }

  /**
   * Get cost savings data
   */
  async getCostSavings(): Promise<CostSavings> {
    return this.request('/api/router/analytics/cost-savings');
  }

  /**
   * Get recent requests
   */
  async getRecentRequests(
    limit: number = 10,
    offset: number = 0
  ): Promise<{
    requests: RecentRequest[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    return this.request(`/api/router/analytics/recent-requests?limit=${limit}&offset=${offset}`);
  }

  /**
   * Get monthly usage summary
   */
  async getMonthlyUsage(): Promise<{
    month: string;
    totalRequests: number;
    successfulRequests: number;
    totalCost: string;
    totalTokens: number;
    averageCostPerRequest: string;
  }> {
    return this.request('/api/router/analytics/monthly-usage');
  }

  /**
   * Get model performance data
   */
  async getModelPerformance(): Promise<{
    models: Array<{
      model: string;
      provider: string;
      requests: number;
      successRate: string;
      averageLatency: number;
      totalCost: string;
    }>;
  }> {
    return this.request('/api/router/analytics/model-performance');
  }

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<{
    models: Array<{
      model: string;
      provider: string;
      rank: number;
      category: string;
    }>;
  }> {
    return this.request('/api/router/analytics/available-models');
  }

  // ==========================================================================
  // API Monitoring
  // ==========================================================================

  async getPromptLoggingState(): Promise<{ enabled: boolean; retentionDays: number }> {
    return this.request('/api/router/monitoring/prompt-logging');
  }

  async togglePromptLogging(enabled: boolean, retentionDays?: number): Promise<{ success: boolean }> {
    return this.request('/api/router/monitoring/prompt-logging', {
      method: 'PUT',
      body: JSON.stringify({ enabled, retentionDays }),
    });
  }

  async getKeyActivity(keyId: number, opts?: { before?: string; limit?: number; category?: string }): Promise<{
    activity: KeyActivity[];
    nextCursor: string | null;
  }> {
    const params = new URLSearchParams();
    if (opts?.before) params.set('before', opts.before);
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.category) params.set('category', opts.category);
    return this.request(`/api/router/monitoring/keys/${keyId}/activity?${params}`);
  }

  async getKeyCosts(keyId: number, period?: '7d' | '30d' | '90d'): Promise<{ costs: KeyCostBreakdown | null }> {
    return this.request(`/api/router/monitoring/keys/${keyId}/costs?period=${period || '30d'}`);
  }

  async getKeysSummary(): Promise<{ keys: KeySummary[] }> {
    return this.request('/api/router/monitoring/keys/summary');
  }

  async getPromptAudit(opts?: { before?: string; limit?: number; keyId?: number; category?: string }): Promise<{
    prompts: PromptAuditEntry[];
    nextCursor: string | null;
  }> {
    const params = new URLSearchParams();
    if (opts?.before) params.set('before', opts.before);
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.keyId) params.set('keyId', String(opts.keyId));
    if (opts?.category) params.set('category', opts.category);
    return this.request(`/api/router/monitoring/prompts?${params}`);
  }

  async getPromptCategories(): Promise<{
    categories: Array<{ category: string; count: number; percentage: string }>;
  }> {
    return this.request('/api/router/monitoring/prompt-categories');
  }

  async getBudgetStatus(): Promise<{ keys: Array<{
    id: number; name: string; department: string | null;
    budgetLimit: number | null; budgetHardLimit: boolean; budgetAlertThreshold: number;
    currentSpend: number; utilization: number | null;
  }> }> {
    return this.request('/api/router/monitoring/budget-status');
  }

  async getBudgetAlerts(acknowledged?: boolean): Promise<{ alerts: BudgetAlert[] }> {
    return this.request(`/api/router/monitoring/budget-alerts?acknowledged=${acknowledged || false}`);
  }

  async acknowledgeBudgetAlert(alertId: number): Promise<{ success: boolean }> {
    return this.request(`/api/router/monitoring/budget-alerts/${alertId}/acknowledge`, { method: 'POST' });
  }

  async getEfficiencyMetrics(): Promise<{ keys: EfficiencyMetrics[] }> {
    return this.request('/api/router/monitoring/efficiency');
  }

  async deletePrompt(requestId: number): Promise<{ success: boolean }> {
    return this.request(`/api/router/monitoring/prompts/${requestId}`, { method: 'DELETE' });
  }

  async purgePrompts(opts?: { keyId?: number; before?: string }): Promise<{ success: boolean; purged: number }> {
    const params = new URLSearchParams();
    params.set('confirm', 'true'); // Fix #10: explicit confirm required by backend
    if (opts?.keyId) params.set('keyId', String(opts.keyId));
    if (opts?.before) params.set('before', opts.before);
    return this.request(`/api/router/monitoring/prompts/purge?${params}`, { method: 'DELETE' });
  }

  async updateKey(keyId: number, data: {
    department?: string | null;
    assignedTo?: string | null;
    tags?: string[];
    budgetLimitMonthly?: number | null;
    budgetHardLimit?: boolean;
    budgetAlertThreshold?: number;
    promptLoggingOverride?: number | null;
  }): Promise<{ success: boolean }> {
    return this.request(`/api/router/keys/${keyId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const apiClient = new ApiClient();

// ============================================================================
// React Hooks (optional, for easier usage in components)
// ============================================================================

export function useApiClient() {
  return apiClient;
}
