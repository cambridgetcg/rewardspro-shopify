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

// Import standardized spending calculation used by tier recalculation
interface CustomerSpending {
  customerId: string;
  shopifyCustomerId: string;
  totalSpending: number;
  orderCount: number;
  lastOrderDate: Date | null;
}

/**
 * Get customer spending from LOCAL DATABASE
 * This is the SAME calculation used by tier recalculation for consistency
 */
async function getCustomerSpendingFromDB(
  shop: string,
  customerId: string,
  evaluationPeriod: 'ANNUAL' | 'LIFETIME'
): Promise<CustomerSpending> {
  try {
    console.log(`[CustomerAccount] Getting spending from local DB for customer ${customerId}, period: ${evaluationPeriod}`);

    // Get customer to ensure we have the right one
    const customer = await db.customer.findFirst({
      where: {
        id: customerId,
        shop
      }
    });

    if (!customer) {
      console.log(`[CustomerAccount] Customer ${customerId} not found in local DB`);
      return {
        customerId,
        shopifyCustomerId: '',
        totalSpending: 0,
        orderCount: 0,
        lastOrderDate: null
      };
    }

    let whereClause: any = {
      shop,
      customerId,
      financialStatus: { in: ['PAID', 'PARTIALLY_REFUNDED'] },
      cashbackEligible: true // Exclude tier product orders
    };

    // Add date filter for annual evaluation
    if (evaluationPeriod === 'ANNUAL') {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      whereClause.shopifyCreatedAt = { gte: oneYearAgo };
      console.log(`[CustomerAccount] ANNUAL filter: orders after ${oneYearAgo.toISOString()}`);
    }

    // Fetch all orders for manual calculation (Aurora Data API aggregates are unreliable)
    const allOrders = await db.order.findMany({
      where: { shop, customerId },
      select: {
        id: true,
        shopifyOrderName: true,
        totalPrice: true,
        totalRefunded: true,
        financialStatus: true,
        cashbackEligible: true,
        shopifyCreatedAt: true,
        createdAt: true
      }
    });

    console.log(`[CustomerAccount] Found ${allOrders.length} total orders for customer`);

    // Manual calculation of spending (more reliable than Aurora aggregates)
    let totalSpent = 0;
    let totalRefunded = 0;
    let eligibleOrderCount = 0;
    let lastOrderDate: Date | null = null;

    // Filter based on evaluation period
    const oneYearAgo = evaluationPeriod === 'ANNUAL' ? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) : null;

    for (const order of allOrders) {
      // Skip if not eligible
      if (!order.cashbackEligible) {
        continue;
      }

      // Skip if wrong financial status
      if (order.financialStatus !== 'PAID' && order.financialStatus !== 'PARTIALLY_REFUNDED') {
        continue;
      }

      // Skip if outside evaluation period
      if (evaluationPeriod === 'ANNUAL' && oneYearAgo && order.shopifyCreatedAt) {
        const orderDate = new Date(order.shopifyCreatedAt);
        if (orderDate < oneYearAgo) {
          continue;
        }
      }

      // Add to totals
      const price = order.totalPrice ? parseFloat(order.totalPrice.toString()) : 0;
      const refunded = order.totalRefunded ? parseFloat(order.totalRefunded.toString()) : 0;

      totalSpent += price;
      totalRefunded += refunded;
      eligibleOrderCount++;

      // Track last order date
      if (order.shopifyCreatedAt) {
        const orderDate = new Date(order.shopifyCreatedAt);
        if (!lastOrderDate || orderDate > lastOrderDate) {
          lastOrderDate = orderDate;
        }
      }
    }

    const netSpending = totalSpent - totalRefunded;

    console.log(`[CustomerAccount] Manual calculation results:`);
    console.log(`[CustomerAccount]   - Total orders: ${allOrders.length}`);
    console.log(`[CustomerAccount]   - Eligible orders: ${eligibleOrderCount}`);
    console.log(`[CustomerAccount]   - Total spent: $${totalSpent.toFixed(2)}`);
    console.log(`[CustomerAccount]   - Total refunded: $${totalRefunded.toFixed(2)}`);
    console.log(`[CustomerAccount]   - Net spending: $${netSpending.toFixed(2)}`);

    return {
      customerId,
      shopifyCustomerId: customer.shopifyCustomerId,
      totalSpending: Math.max(0, netSpending),
      orderCount: eligibleOrderCount,
      lastOrderDate: lastOrderDate
    };
  } catch (error) {
    console.error(`[CustomerAccount] Error fetching spending from DB for customer ${customerId}:`, error);

    // Return zero spending on error
    return {
      customerId,
      shopifyCustomerId: '',
      totalSpending: 0,
      orderCount: 0,
      lastOrderDate: null
    };
  }
}

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
  const origin = request.headers.get('origin');

  console.log(`\n[${requestId}] ========== NEW REQUEST ==========`);
  console.log(`[${requestId}] URL: ${request.url}`);
  console.log(`[${requestId}] Method: ${request.method}`);
  console.log(`[${requestId}] Origin: ${origin}`);

  // Handle OPTIONS preflight immediately
  if (request.method === 'OPTIONS') {
    console.log(`[${requestId}] OPTIONS preflight request - returning 204 with CORS headers`);
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin)
    });
  }

  // Log all headers for debugging
  const headers = Object.fromEntries(request.headers.entries());
  console.log(`[${requestId}] Headers:`, JSON.stringify(headers, null, 2));

  // Check Authorization header specifically
  const authHeader = request.headers.get('authorization');
  console.log(`[${requestId}] Authorization header:`, authHeader ? `Bearer ${authHeader.substring(7, 27)}...` : 'MISSING');

  // Error boundary for entire function
  try {
    // Check if required modules are loaded
    console.log(`[${requestId}] Checking dependencies...`);

    if (!authenticate) {
      console.error(`[${requestId}] FATAL: authenticate is not defined`);
      return json({ error: "Server configuration error", message: "Authentication module not loaded" }, { status: 500, headers: getCorsHeaders(origin) });
    }

    if (!db) {
      console.error(`[${requestId}] FATAL: db is not defined`);
      return json({ error: "Server configuration error", message: "Database module not loaded" }, { status: 500, headers: getCorsHeaders(origin) });
    }

    console.log(`[${requestId}] - authenticate type:`, typeof authenticate);
    console.log(`[${requestId}] - authenticate.public type:`, typeof authenticate?.public);
    console.log(`[${requestId}] - authenticate.public.customerAccount type:`, typeof authenticate?.public?.customerAccount);
    console.log(`[${requestId}] - db type:`, typeof db);

  try {
    // Step 1: Validate session token from customer account extension
    console.log(`[${requestId}] Step 1: Authenticating request...`);

    let authResult;
    try {
      // Check if authenticate.public exists
      if (!authenticate.public) {
        console.error(`[${requestId}] FATAL: authenticate.public is undefined`);
        console.error(`[${requestId}] authenticate object keys:`, Object.keys(authenticate || {}));
        return json({ error: "Configuration error", message: "Public authentication not available" }, { status: 500, headers: getCorsHeaders(origin) });
      }

      // Check if authenticate.public.customerAccount exists
      if (!authenticate.public.customerAccount) {
        console.error(`[${requestId}] FATAL: authenticate.public.customerAccount is undefined`);
        console.error(`[${requestId}] authenticate.public keys:`, Object.keys(authenticate.public || {}));
        return json({ error: "Configuration error", message: "Customer account authentication not available" }, { status: 500, headers: getCorsHeaders(origin) });
      }

      console.log(`[${requestId}] Calling authenticate.public.customerAccount...`);
      authResult = await authenticate.public.customerAccount(request);
      console.log(`[${requestId}] Auth result received`);
      console.log(`[${requestId}] Auth result type:`, typeof authResult);
      console.log(`[${requestId}] Auth result keys:`, authResult ? Object.keys(authResult) : 'null');
      console.log(`[${requestId}] Auth result.customer:`, authResult?.customer ? 'Present' : 'Missing');
      console.log(`[${requestId}] Auth result.shop:`, authResult?.shop || 'Missing');
    } catch (authError: any) {
      console.error(`[${requestId}] ========== AUTHENTICATION ERROR ==========`);
      console.error(`[${requestId}] Error name:`, authError.name);
      console.error(`[${requestId}] Error message:`, authError.message);
      console.error(`[${requestId}] Error stack:`, authError.stack);
      console.error(`[${requestId}] Full error object:`, JSON.stringify(authError, null, 2));

      // Return specific error for authentication failures
      return json({
        error: "Authentication failed",
        message: authError.message || "Unable to authenticate customer account session",
        details: process.env.NODE_ENV === 'development' ? authError.stack : undefined
      }, {
        status: 401,
        headers: getCorsHeaders(origin)
      });
    }

    // Extract customer and shop from session token
    const sessionToken = authResult?.sessionToken;

    if (!sessionToken) {
      console.error(`[${requestId}] Authentication failed - no session token in auth result`);
      console.error(`[${requestId}] Auth result structure:`, JSON.stringify(authResult, null, 2));
      return json(
        { error: "Unauthorized", message: "Invalid session token" },
        {
          status: 401,
          headers: getCorsHeaders(origin)
        }
      );
    }

    // Step 2: Extract customer and shop from validated session token
    const customerGid = sessionToken.sub; // gid://shopify/Customer/23893043347801
    const shop = sessionToken.dest; // rewardspro-dev.myshopify.com

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
            ...getCorsHeaders(origin),
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
        { status: 400, headers: getCorsHeaders(origin) }
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
            ...getCorsHeaders(origin),
            "Cache-Control": "private, max-age=300",
            "X-Response-Time": `${Date.now() - startTime}ms`
          }
        }
      );
    }

    // Step 7: Fetch tier information and all available tiers
    let tier = null;
    if (customer.currentTierId) {
      tier = await db.tier.findFirst({
        where: {
          id: customer.currentTierId,
          shop: shop  // CRITICAL: Scope to shop!
        }
      });
    }

    // Fetch all tiers sorted by minSpend to calculate next tier
    const allTiers = await db.tier.findMany({
      where: { shop },
      orderBy: { minSpend: 'asc' }
    });

    // Find next tier
    const currentSpending = typeof customer.totalSpent === 'object' && 'toNumber' in customer.totalSpent
      ? (customer.totalSpent as any).toNumber()
      : Number(customer.totalSpent);

    const currentTierMinSpend = tier ? (typeof tier.minSpend === 'object' && 'toNumber' in tier.minSpend
      ? (tier.minSpend as any).toNumber()
      : Number(tier.minSpend)) : 0;

    const nextTier = allTiers.find(t => {
      const minSpend = typeof t.minSpend === 'object' && 'toNumber' in t.minSpend
        ? (t.minSpend as any).toNumber()
        : Number(t.minSpend);
      return minSpend > currentTierMinSpend;
    });

    // Calculate progress to next tier
    let progressToNextTier = 100;
    let amountToNextTier = 0;
    if (nextTier) {
      const nextTierMinSpend = typeof nextTier.minSpend === 'object' && 'toNumber' in nextTier.minSpend
        ? (nextTier.minSpend as any).toNumber()
        : Number(nextTier.minSpend);

      amountToNextTier = Math.max(0, nextTierMinSpend - currentSpending);

      const progressInTier = currentSpending - currentTierMinSpend;
      const tierRange = nextTierMinSpend - currentTierMinSpend;
      progressToNextTier = Math.min(100, Math.max(0, (progressInTier / tierRange) * 100));
    }

    // Step 8: Fetch recent transactions (last 50 for pagination in frontend)
    const transactions = await db.storeCreditLedger.findMany({
      where: {
        customerId: customer.id,
        shop: shop  // CRITICAL: Scope to shop!
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    // Step 9: Calculate lifetime earned (cashback + refunds) from ledger entries
    const totalEarned = transactions
      .filter(t => ['CASHBACK_EARNED', 'REFUND_CREDIT'].includes(t.type))
      .reduce((sum, t) => {
        const amount = typeof t.amount === 'object' && 'toNumber' in t.amount
          ? (t.amount as any).toNumber()
          : Number(t.amount);
        return sum + (amount > 0 ? amount : 0);
      }, 0);

    // Step 9.5: Get customer spending stats using standardized calculation
    // This uses the SAME method as tier recalculation for consistency
    // We use the current tier's evaluation period, or LIFETIME if no tier
    const evaluationPeriod = tier?.evaluationPeriod || 'LIFETIME';
    console.log(`[${requestId}] Calculating stats with evaluation period: ${evaluationPeriod}`);

    const spendingStats = await getCustomerSpendingFromDB(
      shop,
      customer.id,
      evaluationPeriod
    );

    console.log(`[${requestId}] Spending stats:`, {
      totalSpending: spendingStats.totalSpending,
      orderCount: spendingStats.orderCount,
      lastOrderDate: spendingStats.lastOrderDate
    });

    // Step 10: Get shop settings for currency
    const shopSettings = await db.shopSettings.findUnique({
      where: { shop }
    });

    // Step 10.5: Get actual balance from most recent ledger entry (source of truth)
    const latestLedgerEntry = await db.storeCreditLedger.findFirst({
      where: {
        customerId: customer.id,
        shop: shop
      },
      orderBy: { createdAt: 'desc' }
    });

    // Use ledger balance as source of truth, fallback to customer.storeCredit
    const actualBalance = latestLedgerEntry
      ? (typeof latestLedgerEntry.balance === 'object' && 'toNumber' in latestLedgerEntry.balance
          ? (latestLedgerEntry.balance as any).toNumber()
          : Number(latestLedgerEntry.balance))
      : (typeof customer.storeCredit === 'object' && 'toNumber' in customer.storeCredit
          ? (customer.storeCredit as any).toNumber()
          : Number(customer.storeCredit));

    console.log(`[${requestId}] Balance check:`, {
      customerStoreCredit: customer.storeCredit,
      ledgerBalance: latestLedgerEntry?.balance,
      actualBalance
    });

    // Step 11: Format and return response
    const responseData = {
      success: true,
      enrolled: true,
      balance: actualBalance,
      tier: tier ? {
        name: tier.name,
        cashbackPercent: typeof tier.cashbackPercent === 'object' && 'toNumber' in tier.cashbackPercent
          ? (tier.cashbackPercent as any).toNumber()
          : Number(tier.cashbackPercent),
        minSpend: typeof tier.minSpend === 'object' && 'toNumber' in tier.minSpend
          ? (tier.minSpend as any).toNumber()
          : Number(tier.minSpend)
      } : null,
      nextTier: nextTier ? {
        name: nextTier.name,
        cashbackPercent: typeof nextTier.cashbackPercent === 'object' && 'toNumber' in nextTier.cashbackPercent
          ? (nextTier.cashbackPercent as any).toNumber()
          : Number(nextTier.cashbackPercent),
        minSpend: typeof nextTier.minSpend === 'object' && 'toNumber' in nextTier.minSpend
          ? (nextTier.minSpend as any).toNumber()
          : Number(nextTier.minSpend)
      } : null,
      progressToNextTier,
      amountToNextTier,
      totalEarned,
      stats: {
        orderCount: spendingStats.orderCount, // From standardized calculation
        totalSpent: spendingStats.totalSpending, // From standardized calculation
        netSpent: spendingStats.totalSpending, // Same as totalSpent (already net of refunds)
        averageCashbackPerOrder: spendingStats.orderCount > 0 ? totalEarned / spendingStats.orderCount : 0,
        lastOrderDate: spendingStats.lastOrderDate?.toISOString() || null
      },
      allTiers: allTiers.map(t => ({
        name: t.name,
        cashbackPercent: typeof t.cashbackPercent === 'object' && 'toNumber' in t.cashbackPercent
          ? (t.cashbackPercent as any).toNumber()
          : Number(t.cashbackPercent),
        minSpend: typeof t.minSpend === 'object' && 'toNumber' in t.minSpend
          ? (t.minSpend as any).toNumber()
          : Number(t.minSpend)
      })),
      recentTransactions: transactions.map(t => ({
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
        ...getCorsHeaders(origin),
        "Cache-Control": "private, max-age=60",  // Cache for 1 minute
        "X-Response-Time": `${Date.now() - startTime}ms`
      }
    });

  } catch (error: any) {
    console.error(`[${requestId}] ========== UNHANDLED ERROR ==========`);
    console.error(`[${requestId}] Error type:`, error?.constructor?.name || 'Unknown');
    console.error(`[${requestId}] Error message:`, error?.message || 'No message');
    console.error(`[${requestId}] Error stack:`, error?.stack || 'No stack trace');

    // Try to stringify the error object
    try {
      console.error(`[${requestId}] Error details:`, JSON.stringify(error, null, 2));
    } catch (e) {
      console.error(`[${requestId}] Error details: [Unable to stringify]`);
    }

    // Check if error is from authentication
    if (error?.message?.includes('Unauthorized') || error?.status === 401) {
      return json(
        { error: "Authentication failed", message: "Invalid or expired session token" },
        { status: 401, headers: getCorsHeaders(origin) }
      );
    }

    // Generic server error with more details in development
    return json(
      {
        error: "Internal server error",
        message: error?.message || "Failed to load loyalty data",
        details: process.env.NODE_ENV === 'development' ? {
          type: error?.constructor?.name,
          message: error?.message,
          stack: error?.stack?.split('\n').slice(0, 5)
        } : undefined
      },
      {
        status: 500,
        headers: getCorsHeaders(origin)
      }
    );
  }
  } catch (outerError: any) {
    // Absolute failsafe - if even error handling fails
    console.error(`[FATAL] Complete failure in loader:`, outerError);
    const origin = request.headers.get('origin');
    return json(
      { error: "Critical server error", message: "Request handler failed completely" },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}

// CORS headers for customer account extensions
function getCorsHeaders(origin?: string | null) {
  // Customer account extensions are served from extensions.shopifycdn.com
  // We need to allow credentials (for session tokens in Authorization header)
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
    // Must specify exact origin (not *) when using credentials
    "Access-Control-Allow-Origin": isAllowed ? origin! : allowedOrigins[0],
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true", // Required for session tokens
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

// OPTIONS requests are handled in the loader function above
