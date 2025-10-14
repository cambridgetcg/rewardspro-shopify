/**
 * Centralized logging utility for debugging customer account extension
 * Helps diagnose why extension may not be showing
 */

import { CONFIG } from '../config';

export const Logger = {
  /**
   * Extension initialization log - ALWAYS shown
   */
  init: () => {
    console.log('='.repeat(80));
    console.log('🚀 REWARDSPRO CUSTOMER ACCOUNT EXTENSION - INITIALIZATION');
    console.log('='.repeat(80));
    console.log('Timestamp:', new Date().toISOString());
    console.log('User Agent:', navigator.userAgent);
    console.log('Location:', window.location.href);
    console.log('');
    console.log('Configuration:');
    console.log('  API URL:', CONFIG.apiUrl);
    console.log('  API Timeout:', `${CONFIG.apiTimeout}ms`);
    console.log('  Debug Logs:', CONFIG.enableDebugLogs ? 'ENABLED' : 'DISABLED');
    console.log('');
    console.log('Extension Capabilities:');
    console.log('  API Access: Enabled');
    console.log('  Network Access: Enabled');
    console.log('');
    console.log('Target Blocks:');
    console.log('  ✓ customer-account.profile.block.render');
    console.log('  ✓ customer-account.order-status.block.render');
    console.log('='.repeat(80));
    console.log('');
  },

  /**
   * Component mount log
   */
  mount: (componentName: string) => {
    console.log(`📦 [${componentName}] Component mounted`);
  },

  /**
   * Component unmount log
   */
  unmount: (componentName: string) => {
    console.log(`📦 [${componentName}] Component unmounted`);
  },

  /**
   * Debug logs - only shown when debug is enabled
   */
  debug: (message: string, ...args: any[]) => {
    if (CONFIG.enableDebugLogs) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Info logs - always shown
   */
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${message}`, ...args);
  },

  /**
   * Warning logs - always shown
   */
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },

  /**
   * Error logs - always shown
   */
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },

  /**
   * Success logs - always shown
   */
  success: (message: string, ...args: any[]) => {
    console.log(`✅ [SUCCESS] ${message}`, ...args);
  },

  /**
   * API request log
   */
  apiRequest: (method: string, url: string, requestId?: string) => {
    const prefix = requestId ? `[${requestId}]` : '[API]';
    console.log(`${prefix} 🌐 ${method} ${url}`);
  },

  /**
   * API response log
   */
  apiResponse: (status: number, statusText: string, requestId?: string) => {
    const prefix = requestId ? `[${requestId}]` : '[API]';
    const emoji = status >= 200 && status < 300 ? '✅' : '❌';
    console.log(`${prefix} ${emoji} Response ${status} ${statusText}`);
  },

  /**
   * State change log
   */
  stateChange: (componentName: string, state: any) => {
    if (CONFIG.enableDebugLogs) {
      console.log(`[${componentName}] State changed:`, state);
    }
  },

  /**
   * Render log
   */
  render: (componentName: string, renderType: string) => {
    console.log(`[${componentName}] 🎨 Rendering: ${renderType}`);
  },

  /**
   * Extension visibility check - helps diagnose why extension isn't showing
   */
  visibilityCheck: () => {
    console.log('');
    console.log('🔍 EXTENSION VISIBILITY DIAGNOSTIC');
    console.log('-'.repeat(80));

    // Check if we're on the right page
    const url = window.location.href;
    const isProfilePage = url.includes('/account') && !url.includes('/orders/');
    const isOrderPage = url.includes('/orders/');

    console.log('Current Page:');
    console.log('  URL:', url);
    console.log('  Is Profile Page:', isProfilePage ? '✅ YES' : '❌ NO');
    console.log('  Is Order Page:', isOrderPage ? '✅ YES' : '❌ NO');
    console.log('');

    // Check for extension container
    const extensionContainer = document.querySelector('[data-ui-extension]');
    console.log('Extension Container:');
    console.log('  Found:', extensionContainer ? '✅ YES' : '❌ NO');

    if (extensionContainer) {
      console.log('  Element:', extensionContainer);
      console.log('  Visible:', extensionContainer.offsetParent !== null ? '✅ YES' : '❌ NO (hidden)');
    }
    console.log('');

    // Check Shopify customer account context
    console.log('Shopify Context:');
    console.log('  Window object exists:', typeof window !== 'undefined' ? '✅' : '❌');
    console.log('  Navigator:', navigator ? '✅' : '❌');
    console.log('-'.repeat(80));
    console.log('');
  }
};

// Auto-initialize on load
Logger.init();

// Run visibility check after a delay to let page load
setTimeout(() => {
  Logger.visibilityCheck();
}, 2000);
