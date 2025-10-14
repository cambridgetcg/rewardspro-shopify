/**
 * Hook to fetch and manage loyalty data from backend API
 *
 * Features:
 * - Session token refresh on every request
 * - Configurable timeout with AbortController
 * - Exponential backoff retry logic
 * - Network status detection
 * - Debug logging gated behind config flag
 */

import { useState, useEffect } from 'react';
import { useApi } from '@shopify/ui-extensions-react/customer-account';
import type { LoyaltyData } from '../types/loyalty';
import { getApiUrl, getApiTimeout, isDebugEnabled } from '../config';

// Get configuration from environment variables
const API_URL = getApiUrl();
const API_TIMEOUT = getApiTimeout();
const DEBUG_LOGS = isDebugEnabled();
const MAX_RETRIES = 3;

interface RetryOptions {
  attempt: number;
  maxRetries: number;
  delayMs: number;
}

/**
 * Calculate exponential backoff delay
 * Attempt 1: 1s, Attempt 2: 2s, Attempt 3: 4s
 */
function calculateBackoff(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10s
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: Error | Response): boolean {
  // Network errors are always retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // 5xx server errors are retryable
  if ('status' in error && error.status >= 500 && error.status < 600) {
    return true;
  }

  // 429 Too Many Requests is retryable
  if ('status' in error && error.status === 429) {
    return true;
  }

  // 408 Request Timeout is retryable
  if ('status' in error && error.status === 408) {
    return true;
  }

  return false;
}

/**
 * Check if browser is online
 */
function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function useLoyaltyData() {
  const { sessionToken } = useApi();
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let abortController: AbortController | null = null;

    async function fetchWithRetry(attempt: number = 1): Promise<void> {
      // Generate request ID for debugging
      const requestId = DEBUG_LOGS
        ? `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        : '';

      if (DEBUG_LOGS) {
        console.log(`[${requestId}] ========== REQUEST START (Attempt ${attempt}/${MAX_RETRIES}) ==========`);
        console.log(`[${requestId}] API URL: ${API_URL}`);
        console.log(`[${requestId}] Timeout: ${API_TIMEOUT}ms`);
        console.log(`[${requestId}] Network status: ${isOnline() ? 'Online' : 'Offline'}`);
      }

      // Check network status before making request
      if (!isOnline()) {
        if (DEBUG_LOGS) {
          console.warn(`[${requestId}] Network offline - skipping request`);
        }
        throw new Error('Network is offline. Please check your internet connection.');
      }

      // Create abort controller for timeout
      abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController?.abort();
      }, API_TIMEOUT);

      try {
        setLoading(true);
        setRetryCount(attempt - 1);

        // Step 1: Get fresh session token
        if (DEBUG_LOGS) {
          console.log(`[${requestId}] Step 1: Getting session token...`);
        }

        let token: string;
        try {
          token = await sessionToken.get();

          if (DEBUG_LOGS) {
            console.log(`[${requestId}] Session token received: ${token.substring(0, 20)}...`);
          }
        } catch (tokenError) {
          if (DEBUG_LOGS) {
            console.error(`[${requestId}] Session token error:`, tokenError);
          }
          throw new Error(`Failed to get session token: ${tokenError instanceof Error ? tokenError.message : 'Unknown error'}`);
        }

        // Step 2: Make API request with timeout
        if (DEBUG_LOGS) {
          console.log(`[${requestId}] Step 2: Calling backend API...`);
          console.log(`[${requestId}] Request config:`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token.substring(0, 20)}...`,
              'Content-Type': 'application/json'
            },
            timeout: `${API_TIMEOUT}ms`
          });
        }

        let response: Response;
        try {
          response = await fetch(API_URL, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'X-Request-ID': requestId,
            },
            signal: abortController.signal,
          });

          if (DEBUG_LOGS) {
            console.log(`[${requestId}] Response received:`, {
              status: response.status,
              statusText: response.statusText,
              ok: response.ok,
              headers: Object.fromEntries(response.headers.entries())
            });
          }
        } catch (fetchError) {
          // Handle abort/timeout
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            if (DEBUG_LOGS) {
              console.warn(`[${requestId}] Request timeout after ${API_TIMEOUT}ms`);
            }
            throw new Error(`Request timeout after ${API_TIMEOUT}ms`);
          }

          if (DEBUG_LOGS) {
            console.error(`[${requestId}] Fetch error:`, fetchError);
          }
          throw new Error(`Network request failed: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
        } finally {
          clearTimeout(timeoutId);
        }

        // Step 3: Handle HTTP errors
        if (!response.ok) {
          // Check if error is retryable
          if (isRetryableError(response) && attempt < MAX_RETRIES) {
            const delay = calculateBackoff(attempt);

            if (DEBUG_LOGS) {
              console.warn(`[${requestId}] Retryable error (${response.status}). Retrying after ${delay}ms...`);
            }

            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, delay));

            // Retry
            if (isMounted) {
              return fetchWithRetry(attempt + 1);
            }
            return;
          }

          // Non-retryable error or max retries reached
          const errorText = await response.text();

          if (DEBUG_LOGS) {
            console.error(`[${requestId}] API error response (${response.status}):`, errorText);
          }

          // Special handling for 401 (session expired)
          if (response.status === 401) {
            throw new Error('Your session has expired. Please refresh the page to continue.');
          }

          throw new Error(`API error ${response.status}: ${errorText}`);
        }

        // Step 4: Parse JSON response
        if (DEBUG_LOGS) {
          console.log(`[${requestId}] Step 3: Parsing response...`);
        }

        let json: any;
        try {
          json = await response.json();

          if (DEBUG_LOGS) {
            console.log(`[${requestId}] Parsed JSON:`, json);
          }
        } catch (parseError) {
          if (DEBUG_LOGS) {
            console.error(`[${requestId}] JSON parse error:`, parseError);
          }
          throw new Error(`Failed to parse response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`);
        }

        // Step 5: Check for application-level errors
        if (json.error) {
          if (DEBUG_LOGS) {
            console.error(`[${requestId}] API returned error:`, json);
          }
          throw new Error(json.message || json.error);
        }

        // Step 6: Update state with successful data
        if (isMounted) {
          if (DEBUG_LOGS) {
            console.log(`[${requestId}] Step 4: Updating state with data`);
            console.log(`[${requestId}] ========== REQUEST SUCCESS ==========`);
          }

          setData(json);
          setError(null);
          setRetryCount(0);
        }

      } catch (err) {
        if (DEBUG_LOGS) {
          console.error(`[${requestId}] ========== REQUEST ERROR ==========`);
          console.error(`[${requestId}] Error type:`, err?.constructor?.name);
          console.error(`[${requestId}] Error message:`, err instanceof Error ? err.message : String(err));
          console.error(`[${requestId}] Error stack:`, err instanceof Error ? err.stack : 'N/A');
        }

        // Check if error is retryable and we haven't exceeded max retries
        if (err instanceof Error && isRetryableError(err) && attempt < MAX_RETRIES) {
          const delay = calculateBackoff(attempt);

          if (DEBUG_LOGS) {
            console.warn(`[${requestId}] Retryable error. Retrying after ${delay}ms...`);
          }

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, delay));

          // Retry
          if (isMounted) {
            return fetchWithRetry(attempt + 1);
          }
          return;
        }

        // Non-retryable error or max retries exceeded
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load rewards data';
          setError(errorMessage);
          setData(null);

          if (DEBUG_LOGS) {
            console.error(`[${requestId}] Max retries reached or non-retryable error. Giving up.`);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
        clearTimeout(timeoutId);
      }
    }

    // Start the fetch process
    fetchWithRetry();

    // Cleanup function
    return () => {
      isMounted = false;
      if (abortController) {
        abortController.abort();
      }
    };
  }, [sessionToken]);

  return {
    data,
    loading,
    error,
    retryCount // Expose retry count for UI feedback
  };
}
