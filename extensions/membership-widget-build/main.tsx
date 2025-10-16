import React from 'react';
import { createRoot } from 'react-dom/client';
import { MembershipWidget } from './MembershipWidget';
import type { MembershipData } from './types';
import './styles.css';

/**
 * Main entry point for the Membership Widget
 *
 * This script:
 * 1. Finds the container element injected by Liquid
 * 2. Reads membership data from data attributes
 * 3. Mounts the React component
 */

// Wait for DOM to be ready
function initWidget() {
  console.log('[MembershipWidget] Initializing...');

  // Find the container element
  const rootElement = document.getElementById('membership-widget-root');

  if (!rootElement) {
    console.warn('[MembershipWidget] Root element not found. Widget will not render.');
    return;
  }

  // Read data from data attributes
  const tier = rootElement.getAttribute('data-tier');
  const balanceStr = rootElement.getAttribute('data-balance');
  const currency = rootElement.getAttribute('data-currency');
  const customerId = rootElement.getAttribute('data-customer-id');
  const customerEmail = rootElement.getAttribute('data-customer-email');

  // Validate required data
  if (!tier) {
    console.warn('[MembershipWidget] No membership tier found. Widget will not render.');
    return;
  }

  // Parse balance (default to 0 if invalid)
  const balance = parseFloat(balanceStr || '0') || 0;

  // Prepare membership data
  const membershipData: MembershipData = {
    tier,
    balance,
    currency: currency || 'USD',
    customerId: customerId || undefined,
    customerEmail: customerEmail || undefined,
  };

  console.log('[MembershipWidget] Membership data:', membershipData);

  // Read settings from data attributes (optional, set by merchant in theme editor)
  // For now, we'll use defaults, but you can extend this later
  const settings = {
    position: 'bottom-right' as const,
    showOnMobile: true,
    collapsible: true,
  };

  try {
    // Create React root and render the widget
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <MembershipWidget data={membershipData} settings={settings} />
      </React.StrictMode>
    );

    console.log('[MembershipWidget] Widget rendered successfully!');
  } catch (error) {
    console.error('[MembershipWidget] Error rendering widget:', error);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWidget);
} else {
  // DOM already loaded
  initWidget();
}

// Also export for potential manual initialization
export { initWidget };
