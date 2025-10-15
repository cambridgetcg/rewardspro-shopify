/**
 * Extension Configuration
 *
 * Configuration for the customer account UI extension.
 *
 * Note: Shopify customer account extensions don't support import.meta.env
 * at build time, so we use hardcoded production values.
 */

interface Config {
  apiUrl: string;
  apiTimeout: number;
  enableDebugLogs: boolean;
}

// Production configuration
// To enable debug logs, change enableDebugLogs to true and redeploy
export const CONFIG: Config = {
  apiUrl: 'https://rewardspro-production.vercel.app/api/customer-account/loyalty',
  apiTimeout: 10000, // 10 seconds
  enableDebugLogs: false // Set to true to enable verbose console logging
};

// Type-safe getters
export const getApiUrl = (): string => CONFIG.apiUrl;
export const getApiTimeout = (): number => CONFIG.apiTimeout;
export const isDebugEnabled = (): boolean => CONFIG.enableDebugLogs;
