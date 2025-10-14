/**
 * Extension Configuration
 *
 * Uses build-time environment variables to configure the extension
 * for different environments (development, staging, production)
 *
 * Environment Variables:
 * - VITE_API_URL: Backend API endpoint URL
 * - VITE_API_TIMEOUT: Request timeout in milliseconds
 * - VITE_ENABLE_DEBUG_LOGS: Enable verbose console logging
 *
 * Usage:
 *   Development: Set in .env.local or shopify app dev command
 *   Production: Set in build script or CI/CD pipeline
 */

interface Config {
  apiUrl: string;
  apiTimeout: number;
  enableDebugLogs: boolean;
}

// Production defaults
const DEFAULT_CONFIG: Config = {
  apiUrl: 'https://rewardspro-production.vercel.app/api/customer-account/loyalty',
  apiTimeout: 10000, // 10 seconds
  enableDebugLogs: false
};

// Override with environment variables if available
// Vite exposes env vars as import.meta.env.VITE_*
export const CONFIG: Config = {
  apiUrl: (import.meta.env.VITE_API_URL as string) || DEFAULT_CONFIG.apiUrl,
  apiTimeout: parseInt(import.meta.env.VITE_API_TIMEOUT as string) || DEFAULT_CONFIG.apiTimeout,
  enableDebugLogs: (import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true') || DEFAULT_CONFIG.enableDebugLogs
};

// Type-safe getters
export const getApiUrl = (): string => CONFIG.apiUrl;
export const getApiTimeout = (): number => CONFIG.apiTimeout;
export const isDebugEnabled = (): boolean => CONFIG.enableDebugLogs;

// Log config on load (only in development)
if (import.meta.env.DEV) {
  console.log('[Config] Extension configuration loaded:', {
    apiUrl: CONFIG.apiUrl,
    apiTimeout: CONFIG.apiTimeout,
    enableDebugLogs: CONFIG.enableDebugLogs,
    environment: import.meta.env.MODE
  });
}
