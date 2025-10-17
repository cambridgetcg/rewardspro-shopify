/**
 * Customer Account Block Heartbeat API
 *
 * This endpoint receives heartbeat signals from the customer account UI extension
 * to confirm the block is actually installed and rendering (not just dismissed).
 *
 * AUTHENTICATION:
 * - Uses Shopify session tokens (NOT app proxy HMAC)
 * - Token provided by customer account extension via sessionToken API
 * - Validated using authenticate.public.customerAccount()
 *
 * SECURITY:
 * - All queries scoped to authenticated shop
 * - Customer ID verified from token sub claim
 * - POST only (no GET requests)
 * - CORS configured for Shopify domains
 *
 * FUNCTIONALITY:
 * - Updates ShopSettings.customerAccountBlockLastHeartbeat timestamp
 * - Used by dashboard to detect if customer account block is actually installed
 * - Heartbeats should be sent every 2 minutes while block is rendering
 */

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Rate limiting (simple in-memory, consider Redis for production)
const heartbeatCounts = new Map<string, { count: number; resetTime: number }>();

function checkHeartbeatRateLimit(key: string, limit = 30): boolean {
  const now = Date.now();
  const entry = heartbeatCounts.get(key);

  if (!entry || entry.resetTime < now) {
    heartbeatCounts.set(key, { count: 1, resetTime: now + 60000 }); // 1 minute window
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

// Export loader to handle OPTIONS preflight requests
// Remix routes need both loader and action for proper CORS handling
export async function loader({ request }: ActionFunctionArgs) {
  const origin = request.headers.get('origin');

  // Only handle OPTIONS preflight in loader
  if (request.method === 'OPTIONS') {
    console.log('[Heartbeat] OPTIONS preflight in loader - returning 204');
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin)
    });
  }

  // GET requests not allowed - redirect to action
  return json(
    { error: "Method not allowed", message: "Use POST for heartbeat" },
    { status: 405, headers: getCorsHeaders(origin) }
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const startTime = Date.now();
  const requestId = `heartbeat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const origin = request.headers.get('origin');

  console.log(`\n[${requestId}] ========== HEARTBEAT REQUEST ==========`);
  console.log(`[${requestId}] Method: ${request.method}`);
  console.log(`[${requestId}] Origin: ${origin}`);

  try {
    // Step 1: Authenticate request
    console.log(`[${requestId}] Step 1: Authenticating...`);
    let authResult;
    try {
      authResult = await authenticate.public.customerAccount(request);
      console.log(`[${requestId}] Authentication successful`);
    } catch (authError: any) {
      console.error(`[${requestId}] Authentication failed:`, authError.message);
      return json({
        error: "Authentication failed",
        message: authError.message || "Unable to authenticate customer account session"
      }, {
        status: 401,
        headers: getCorsHeaders(origin)
      });
    }

    // Extract session token
    const sessionToken = authResult?.sessionToken;

    if (!sessionToken) {
      console.error(`[${requestId}] No session token in auth result`);
      return json(
        { error: "Unauthorized", message: "Invalid session token" },
        { status: 401, headers: getCorsHeaders(origin) }
      );
    }

    const shop = sessionToken.dest; // e.g., "store.myshopify.com"
    const customerGid = sessionToken.sub; // gid://shopify/Customer/123456789

    console.log(`[${requestId}] Shop: ${shop}`);
    console.log(`[${requestId}] Customer GID: ${customerGid}`);

    if (!shop) {
      console.error(`[${requestId}] Missing shop in session token`);
      return json(
        { error: "Invalid session token", message: "Session token is missing shop identifier" },
        { status: 401, headers: getCorsHeaders(origin) }
      );
    }

    // Step 2: Rate limiting per shop
    const rateLimitKey = `customer-account-heartbeat:${shop}`;
    if (!checkHeartbeatRateLimit(rateLimitKey, 30)) {
      console.warn(`[${requestId}] Rate limit exceeded for ${shop}`);
      return json(
        { error: "Too many requests", message: "Heartbeat rate limit exceeded" },
        {
          status: 429,
          headers: {
            ...getCorsHeaders(origin),
            "Retry-After": "60"
          }
        }
      );
    }

    // Step 3: Update heartbeat timestamp in ShopSettings
    console.log(`[${requestId}] Step 3: Updating heartbeat timestamp...`);

    try {
      const now = new Date();

      // Use upsert to handle case where ShopSettings doesn't exist yet
      await db.shopSettings.upsert({
        where: { shop },
        update: {
          customerAccountBlockLastHeartbeat: now,
          updatedAt: now,
        },
        create: {
          shop,
          storeCurrency: 'USD', // Default
          currencyDisplayType: 'SYMBOL',
          customerAccountBlockLastHeartbeat: now,
          updatedAt: now,
        }
      });

      console.log(`[${requestId}] ✓ Heartbeat timestamp updated for ${shop}`);
      console.log(`[${requestId}] Response time: ${Date.now() - startTime}ms`);
      console.log(`[${requestId}] ========== HEARTBEAT COMPLETE ==========`);

      return json(
        {
          success: true,
          message: "Heartbeat recorded",
          timestamp: now.toISOString(),
        },
        {
          headers: {
            ...getCorsHeaders(origin),
            "X-Response-Time": `${Date.now() - startTime}ms`
          }
        }
      );

    } catch (dbError: any) {
      console.error(`[${requestId}] Database error:`, dbError.message);
      throw dbError;
    }

  } catch (error: any) {
    console.error(`[${requestId}] ========== HEARTBEAT ERROR ==========`);
    console.error(`[${requestId}] Error:`, error?.message || 'Unknown error');
    console.error(`[${requestId}] Stack:`, error?.stack?.split('\n').slice(0, 3).join('\n'));

    return json(
      {
        error: "Internal server error",
        message: error?.message || "Failed to record heartbeat",
      },
      {
        status: 500,
        headers: getCorsHeaders(origin)
      }
    );
  }
}

// CORS headers for customer account extensions
function getCorsHeaders(origin?: string | null) {
  const allowedOrigins = [
    'https://extensions.shopifycdn.com',
    'https://shopify.com',
    'https://admin.shopify.com'
  ];

  // Check if the request origin is allowed
  const isAllowed = origin && allowedOrigins.some(allowed =>
    origin === allowed || origin.endsWith('.shopifycdn.com') || origin.endsWith('.shopify.com')
  );

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin! : allowedOrigins[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
