/**
 * Widget Heartbeat Endpoint
 *
 * Endpoint: /apps/rewardspro/widget-heartbeat (via Shopify App Proxy)
 *
 * This endpoint receives heartbeat signals from the membership widget on the storefront.
 * It tracks when the widget is actively rendering to help detect if it's enabled.
 *
 * Method: POST
 * Body: { timestamp, shopifyCustomerId, tier }
 */

import { json } from '@remix-run/node';
import type { ActionFunctionArgs } from '@remix-run/node';
import db from '~/db.server';

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

/**
 * Handle OPTIONS preflight requests
 */
export const loader = async () => {
  const response = new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
  return response;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Only allow POST requests
    if (request.method !== 'POST') {
      const response = json(
        { error: 'Method not allowed' },
        { status: 405 }
      );
      return addCorsHeaders(response);
    }

    // Get shop domain from Shopify app proxy headers
    const shop = request.headers.get('HTTP_X_SHOPIFY_SHOP_DOMAIN');

    console.log('[Widget Heartbeat] Received heartbeat from shop:', shop);

    if (!shop) {
      const response = json(
        { error: 'Missing shop domain' },
        { status: 400 }
      );
      return addCorsHeaders(response);
    }

    // Parse the heartbeat data (optional - we mainly just need to know widget is alive)
    let heartbeatData;
    try {
      heartbeatData = await request.json();
      console.log('[Widget Heartbeat] Heartbeat data:', heartbeatData);
    } catch (e) {
      // If parsing fails, it's okay - we just record that heartbeat was received
      console.log('[Widget Heartbeat] Could not parse heartbeat data, but that\'s okay');
    }

    // Update the shop settings with the latest heartbeat timestamp
    await db.shopSettings.upsert({
      where: { shop },
      update: {
        widgetLastHeartbeat: new Date(),
        widgetIsActive: true,
      },
      create: {
        shop,
        storeName: shop,
        storeUrl: `https://${shop}`,
        widgetLastHeartbeat: new Date(),
        widgetIsActive: true,
      },
    });

    console.log('[Widget Heartbeat] ✅ Heartbeat recorded successfully for', shop);

    const response = json({
      success: true,
      message: 'Heartbeat recorded',
      timestamp: new Date().toISOString(),
    });

    return addCorsHeaders(response);

  } catch (error) {
    console.error('[Widget Heartbeat] ❌ Error processing heartbeat:', error);

    const response = json(
      {
        success: false,
        error: 'Failed to process heartbeat',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );

    return addCorsHeaders(response);
  }
};
