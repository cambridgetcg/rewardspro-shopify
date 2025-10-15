/**
 * App Proxy Widget Endpoint
 *
 * Endpoint: https://yourstore.com/apps/rewardspro/widget
 *
 * This endpoint returns loyalty data for the floating widget on the storefront.
 * It uses Shopify's liquid variables to identify the customer from the session.
 *
 * Returns minimal data needed for the widget:
 * - enrolled: boolean
 * - tier: { name, level, cashbackRate }
 * - balance: { storeCreditFormatted }
 */

import { json } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';

/**
 * Helper to add CORS headers to a response
 */
function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  // Allow all origins for app proxy requests (Shopify's domain will be making the request)
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Get Shopify customer ID from proxy headers
    // Shopify adds these headers to app proxy requests
    const customerId = request.headers.get('HTTP_X_SHOPIFY_CUSTOMER_ID');
    const shop = request.headers.get('HTTP_X_SHOPIFY_SHOP_DOMAIN');

    console.log('[Proxy Widget] Request received:', {
      customerId,
      shop,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries())
    });

    // Customer not logged in
    if (!customerId) {
      const response = json({ enrolled: false }, { status: 401 });
      return addCorsHeaders(response);
    }

    // TODO: Fetch loyalty data from database
    // For now, return mock data to test the widget

    const loyaltyData = {
      enrolled: true,
      tier: {
        name: 'Gold',
        level: 2,
        cashbackRate: 5,
      },
      balance: {
        storeCreditFormatted: '$45.50',
      },
    };

    const response = json(loyaltyData);
    return addCorsHeaders(response);

  } catch (error) {
    console.error('[Proxy Widget] Error:', error);
    const response = json(
      { error: 'Failed to fetch loyalty data', enrolled: false },
      { status: 500 }
    );
    return addCorsHeaders(response);
  }
};
