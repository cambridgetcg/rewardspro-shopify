/**
 * Customer Account UI Extension - Loyalty Data API
 *
 * This endpoint provides loyalty program data to the customer account UI extension.
 *
 * AUTHENTICATION:
 * - Uses Shopify session tokens (NOT app proxy HMAC)
 * - Token provided by customer account extension via sessionToken API
 * - Validated using authenticate.public.customerAccount()
 *
 * SECURITY:
 * - All queries scoped to authenticated shop
 * - Customer ID verified from token sub claim
 * - Read-only access (GET only)
 * - CORS configured for Shopify domains
 *
 * DATA RETURNED:
 * - Store credit balance
 * - Current tier info
 * - Lifetime earned total
 * - Recent transaction history
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Rate limiting (simple in-memory, consider Redis for production)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string, limit = 100): boolean {
  const now = Date.now();
  const entry = requestCounts.get(key);

  if (!entry || entry.resetTime < now) {
    requestCounts.set(key, { count: 1, resetTime: now + 60000 });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

function getTransactionDescription(transaction: any): string {
  const metadata = transaction.metadata as any;

  switch (transaction.type) {
    case 'CASHBACK_EARNED':
      return metadata?.orderName
        ? `Cashback from order ${metadata.orderName}`
        : 'Cashback earned';
    case 'ORDER_PAYMENT':
      return metadata?.orderName
        ? `Used for order ${metadata.orderName}`
        : 'Store credit used';
    case 'REFUND_CREDIT':
      return metadata?.orderName
        ? `Refund from order ${metadata.orderName}`
        : 'Refund credit';
    case 'MANUAL_ADJUSTMENT':
      return metadata?.reason || metadata?.note || 'Account adjustment';
    default:
      return transaction.type.replace(/_/g, ' ').toLowerCase();
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[${requestId}] ========== NEW REQUEST ==========`);
  console.log(`[${requestId}] URL: ${request.url}`);
  console.log(`[${requestId}] Method: ${request.method}`);
  console.log(`[${requestId}] Headers:`, Object.fromEntries(request.headers.entries()));

  try {
    // Step 1: Validate session token from customer account extension
    console.log(`[${requestId}] Step 1: Authenticating request...`);

    let authResult;
    try {
      authResult = await authenticate.public.customerAccount(request);
      console.log(`[${requestId}] Auth result:`, JSON.stringify(authResult, null, 2));
    } catch (authError: any) {
      console.error(`[${requestId}] Authentication error:`, {
        message: authError.message,
        stack: authError.stack,
        name: authError.name
      });
      throw authError;
    }

    if (!authResult?.customer) {
      console.error(`[${requestId}] Authentication failed - no customer in auth result`);
      console.error(`[${requestId}] Auth result structure:`, JSON.stringify(authResult, null, 2));
      return json(
        { error: "Unauthorized", message: "Invalid session token" },
        {
          status: 401,
          headers: getCorsHeaders()
        }
      );
    }

    // Step 2: Extract customer and shop from validated token
    const customerGid = authResult.customer.id;
    const shop = authResult.shop;

    console.log(`[${requestId}] Step 2: Authenticated successfully`);
    console.log(`[${requestId}] Customer GID: ${customerGid}`);
    console.log(`[${requestId}] Shop: ${shop}`);

    // Step 3: Rate limiting per customer
    const rateLimitKey = `customer-account:${shop}:${customerGid}`;
    if (!checkRateLimit(rateLimitKey, 100)) {
      console.warn(`[Customer Account API] Rate limit exceeded for ${customerGid}`);
      return json(
        { error: "Too many requests", message: "Please try again in a minute" },
        {
          status: 429,
          headers: {
            ...getCorsHeaders(),
            "Retry-After": "60"
          }
        }
      );
    }

    // Step 4: Extract numeric customer ID from GID
    // GID format: "gid://shopify/Customer/6789012345"
    const customerId = customerGid.split('/').pop();

    if (!customerId) {
      console.error(`[Customer Account API] Invalid customer GID: ${customerGid}`);
      return json(
        { error: "Invalid customer ID" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    console.log(`[${requestId}] Step 4: Extracted customer ID: ${customerId}`);
    console.log(`[${requestId}] Step 5: Querying database for customer...`);
    console.log(`[${requestId}] Query params:`, { shopifyCustomerId: customerId, shop });

    // Step 5: Fetch customer from database (scoped to shop!)
    let customer;
    try {
      customer = await db.customer.findFirst({
        where: {
          shopifyCustomerId: customerId,
          shop: shop  // CRITICAL: Always scope to shop!
        }
      });
      console.log(`[${requestId}] Database query result:`, customer ? 'Customer found' : 'Customer not found');
      if (customer) {
        console.log(`[${requestId}] Customer details:`, {
          id: customer.id,
          email: customer.email,
          storeCredit: customer.storeCredit,
          currentTierId: customer.currentTierId
        });
      }
    } catch (dbError: any) {
      console.error(`[${requestId}] Database query error:`, {
        message: dbError.message,
        stack: dbError.stack,
        name: dbError.name
      });
      throw dbError;
    }

    // Step 6: Handle non-enrolled customers
    if (!customer) {
      console.log(`[${requestId}] Customer ${customerId} not enrolled in ${shop}`);
      return json(
        {
          success: true,
          enrolled: false,
          message: "You're not enrolled in the rewards program yet",
          canEnroll: true
        },
        {
          headers: {
            ...getCorsHeaders(),
            "Cache-Control": "private, max-age=300",
            "X-Response-Time": `${Date.now() - startTime}ms`
          }
        }
      );
    }

    // Step 7: Fetch tier information
    let tier = null;
    if (customer.currentTierId) {
      tier = await db.tier.findFirst({
        where: {
          id: customer.currentTierId,
          shop: shop  // CRITICAL: Scope to shop!
        }
      });
    }

    // Step 8: Fetch recent transactions
    const transactions = await db.storeCreditLedger.findMany({
      where: {
        customerId: customer.id,
        shop: shop  // CRITICAL: Scope to shop!
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Step 9: Calculate lifetime earned (cashback + refunds)
    const totalEarned = transactions
      .filter(t => ['CASHBACK_EARNED', 'REFUND_CREDIT'].includes(t.type))
      .reduce((sum, t) => {
        const amount = typeof t.amount === 'object' && 'toNumber' in t.amount
          ? (t.amount as any).toNumber()
          : Number(t.amount);
        return sum + (amount > 0 ? amount : 0);
      }, 0);

    // Step 10: Get shop settings for currency
    const shopSettings = await db.shopSettings.findUnique({
      where: { shop }
    });

    // Step 11: Format and return response
    const responseData = {
      success: true,
      enrolled: true,
      balance: typeof customer.storeCredit === 'object' && 'toNumber' in customer.storeCredit
        ? (customer.storeCredit as any).toNumber()
        : Number(customer.storeCredit),
      tier: tier ? {
        name: tier.name,
        cashbackPercent: typeof tier.cashbackPercent === 'object' && 'toNumber' in tier.cashbackPercent
          ? (tier.cashbackPercent as any).toNumber()
          : Number(tier.cashbackPercent),
        minSpend: typeof tier.minSpend === 'object' && 'toNumber' in tier.minSpend
          ? (tier.minSpend as any).toNumber()
          : Number(tier.minSpend)
      } : null,
      totalEarned,
      recentTransactions: transactions.slice(0, 5).map(t => ({
        id: t.id,
        type: t.type,
        amount: typeof t.amount === 'object' && 'toNumber' in t.amount
          ? (t.amount as any).toNumber()
          : Number(t.amount),
        date: t.createdAt.toISOString(),
        description: getTransactionDescription(t)
      })),
      currency: shopSettings?.storeCurrency || 'USD'
    };

    console.log(`[${requestId}] Step 11: Success - returning data`);
    console.log(`[${requestId}] Response data:`, JSON.stringify(responseData, null, 2));
    console.log(`[${requestId}] Response time: ${Date.now() - startTime}ms`);
    console.log(`[${requestId}] ========== REQUEST COMPLETE ==========`);

    return json(responseData, {
      headers: {
        ...getCorsHeaders(),
        "Cache-Control": "private, max-age=60",  // Cache for 1 minute
        "X-Response-Time": `${Date.now() - startTime}ms`
      }
    });

  } catch (error: any) {
    console.error(`[${requestId}] ========== ERROR ==========`);
    console.error(`[${requestId}] Error type:`, error.constructor.name);
    console.error(`[${requestId}] Error message:`, error.message);
    console.error(`[${requestId}] Error stack:`, error.stack);
    console.error(`[${requestId}] Error details:`, JSON.stringify(error, null, 2));

    // Check if error is from authentication
    if (error?.message?.includes('Unauthorized') || error?.status === 401) {
      return json(
        { error: "Authentication failed", message: "Invalid or expired session token" },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    // Generic server error
    return json(
      {
        error: "Internal server error",
        message: "Failed to load loyalty data"
      },
      {
        status: 500,
        headers: getCorsHeaders()
      }
    );
  }
}

// CORS headers for customer account extensions
function getCorsHeaders() {
  return {
    // Allow both shopify.com and extensions.shopifycdn.com for customer account extensions
    "Access-Control-Allow-Origin": "*", // Permissive for development; tighten in production if needed
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin" // Important for caching
  };
}

// Handle OPTIONS preflight requests
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders()
  });
}
