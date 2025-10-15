import type { SessionToken } from '@shopify/ui-extensions/customer-account';
import type { ApiResponse } from '../types/session';

/**
 * Configuration for API client
 */
export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  enableDebugLogs?: boolean;
}

/**
 * API client with automatic session token management
 */
export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private enableDebugLogs: boolean;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout || 10000;
    this.enableDebugLogs = config.enableDebugLogs || false;
  }

  /**
   * Makes an authenticated API request with session token
   */
  async request<T = unknown>(
    sessionToken: SessionToken,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      // Get a fresh session token
      const token = await sessionToken.get();

      if (this.enableDebugLogs) {
        console.log('[ApiClient] Making request to:', `${this.baseUrl}${endpoint}`);
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        if (this.enableDebugLogs) {
          console.error('[ApiClient] Request failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          });
        }

        return {
          success: false,
          error: `Request failed: ${response.status} ${response.statusText}`,
          message: errorText || 'An error occurred',
        };
      }

      const data = await response.json();

      if (this.enableDebugLogs) {
        console.log('[ApiClient] Request successful:', data);
      }

      return {
        success: true,
        data: data as T,
      };
    } catch (error) {
      if (this.enableDebugLogs) {
        console.error('[ApiClient] Request error:', error);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error: errorMessage,
        message: errorMessage.includes('aborted') ? 'Request timeout' : errorMessage,
      };
    }
  }

  /**
   * GET request
   */
  async get<T = unknown>(
    sessionToken: SessionToken,
    endpoint: string
  ): Promise<ApiResponse<T>> {
    return this.request<T>(sessionToken, endpoint, {
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post<T = unknown>(
    sessionToken: SessionToken,
    endpoint: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    return this.request<T>(sessionToken, endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T = unknown>(
    sessionToken: SessionToken,
    endpoint: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    return this.request<T>(sessionToken, endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(
    sessionToken: SessionToken,
    endpoint: string
  ): Promise<ApiResponse<T>> {
    return this.request<T>(sessionToken, endpoint, {
      method: 'DELETE',
    });
  }
}

/**
 * Creates a configured API client instance
 */
export function createApiClient(config?: Partial<ApiClientConfig>): ApiClient {
  // Default configuration - can be overridden
  const defaultConfig: ApiClientConfig = {
    baseUrl: 'https://rewardspro-production.vercel.app/api/customer-account/loyalty',
    timeout: 10000,
    enableDebugLogs: false,
  };

  return new ApiClient({
    ...defaultConfig,
    ...config,
  });
}
