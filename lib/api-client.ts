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
