import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { formatCurrency } from "../utils/currency";

/**
 * Shopify App Proxy Handler for RewardsPro Widget
 *
 * This endpoint handles requests from the storefront widget via Shopify App Proxy.
 * Requests come through: https://store.myshopify.com/apps/rewardspromembership
 * And are proxied to: https://rewardspro-production.vercel.app/api/proxy
 *
 * SECURITY:
 * - Automatic HMAC signature verification via authenticate.public.appProxy()
 * - Shop domain validation through session
 * - Customer ID provided by Shopify (trusted)
 * - All queries scoped to authenticated shop
 * - Rate limiting implemented
 *
 * BACKWARD COMPATIBILITY:
 * - Accepts both shopifyCustomerId (legacy manual) and logged_in_customer_id (new Shopify automatic)
 * - Returns both old format (balance, tier) and new format (memberData) during transition
 *
 * Configuration (TOML):
 * - prefix: apps
 * - subpath: rewardspromembership
 * - url: /api/proxy (splat route handles /api/proxy/* paths)
 *
 * Remix Routing:
 * - File: api.proxy.$.tsx (splat route)
 * - Matches: /api/proxy/* (any path after /api/proxy)
 */

// Simple in-memory rate limiter (consider Redis for production)
// See docs/redis-rate-limiting.md for Redis implementation guide
const requestCounts = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(shop: string, limit = 60): boolean {
  const now = Date.now();
  const key = `proxy:${shop}`;
  const entry = requestCounts.get(key);

  // Reset if time window expired (1 minute)
  if (!entry || entry.resetTime < now) {
    requestCounts.set(key, { count: 1, resetTime: now + 60000 });
    return true;
  }

  // Check if under limit
  if (entry.count >= limit) {
    return false;
  }

  // Increment counter
  entry.count++;
  return true;
}

function getTransactionDescription(type: string, metadata: any): string {
  switch (type) {
    case 'CASHBACK_EARNED':
      return metadata?.orderName
        ? `Cashback earned on order ${metadata.orderName}`
        : metadata?.orderId
        ? `Cashback earned on order ${metadata.orderId}`
        : 'Cashback earned';
    case 'ORDER_PAYMENT':
      return metadata?.orderName
        ? `Store credit used for order ${metadata.orderName}`
        : 'Store credit used';
    case 'REFUND_CREDIT':
      return metadata?.orderName
        ? `Refund for order ${metadata.orderName}`
        : 'Store credit refund';
    case 'MANUAL_ADJUSTMENT':
      return metadata?.reason || metadata?.note || metadata?.description || 'Manual credit adjustment';
    case 'SHOPIFY_SYNC':
      return 'Balance sync';
    default:
      return type.replace(/_/g, ' ').toLowerCase();
  }
}

interface LoyaltyData {
  // Legacy format (for backward compatibility)
  balance: number;
  tier: {
    id: string;
    name: string;
    icon: string;
    color: string;
  } | null;
  progress: {
    current: number;
    next: number;
    percentage: number;
  } | null;
  expiringPoints: {
    amount: number;
    date: string;
  } | null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();
  const requestId = `proxy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Step 1: Authenticate the app proxy request using Shopify's helper
    // This automatically verifies the HMAC signature and provides session context
    const { session } = await authenticate.public.appProxy(request);

    // Step 2: Check if app is installed for this shop
    if (!session) {
      console.log(`[${requestId}] App proxy: No session found (app not installed or invalid signature)`);
      return json(
        {
          success: false,
          error: "App not installed",
          requiresInstall: true,
          message: "Please ask your store admin to install RewardsPro"
        },
        {
          status: 401,
          headers: {
            "X-Response-Time": `${Date.now() - startTime}ms`
          }
        }
      );
    }

    const shop = session.shop;
    console.log(`[${requestId}] App proxy request from shop: ${shop}`);

    // Step 3: Rate limiting check
    if (!checkRateLimit(shop)) {
      console.warn(`[${requestId}] Rate limit exceeded for shop: ${shop}`);
      return json(
        {
          success: false,
          error: "Too many requests. Please try again later."
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-RateLimit-Limit": "60",
            "X-RateLimit-Remaining": "0",
            "X-Response-Time": `${Date.now() - startTime}ms`
          }
        }
      );
    }

    // Step 4: Extract customer ID from Shopify-provided params
    // BACKWARD COMPATIBILITY: Support both manual (shopifyCustomerId) and automatic (logged_in_customer_id)
    const url = new URL(request.url);
    const loggedInCustomerId = url.searchParams.get("logged_in_customer_id"); // New: Shopify automatic
    const manualCustomerId = url.searchParams.get("shopifyCustomerId");       // Legacy: Manual widget
    const timestamp = url.searchParams.get("timestamp");

    console.log(`[${requestId}] Customer ID sources:`, {
      logged_in_customer_id: loggedInCustomerId,
      shopifyCustomerId: manualCustomerId,
      timestamp
    });

    // Optional: Check timestamp freshness to prevent replay attacks
    if (timestamp) {
      const requestTime = parseInt(timestamp, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime - requestTime > 300) { // 5 minute window
        console.warn(`[${requestId}] Stale request from shop ${shop}: ${currentTime - requestTime}s old`);
        return json(
          {
            success: false,
            error: "Request expired"
          },
          {
            status: 400,
            headers: {
              "X-Response-Time": `${Date.now() - startTime}ms`
            }
          }
        );
      }
    }

    // Prefer Shopify's logged_in_customer_id (more secure), fallback to manual
    const customerId = loggedInCustomerId || manualCustomerId;

    // Step 5: Handle guest users (not logged in)
    if (!customerId) {
      console.log(`[${requestId}] Guest user accessing widget for shop: ${shop}`);
      return json({
        success: true,
        requiresLogin: true,
        enrolled: false,
        message: "Please log in to view your rewards",
        shopInfo: {
          name: session.shop.replace('.myshopify.com', ''),
          hasRewardsProgram: true
        }
      }, {
        headers: {
          "Cache-Control": "public, max-age=60",
          "X-Response-Time": `${Date.now() - startTime}ms`
        }
      });
    }

    console.log(`[${requestId}] Fetching data for customer ${customerId} from shop ${shop}`);

    // Step 6: Fetch customer data scoped to shop (CRITICAL for security)
    // Note: Data API adapter doesn't support select, must fetch full record
    const customer = await db.customer.findFirst({
      where: {
        shopifyCustomerId: customerId,
        shop: shop // CRITICAL: Always scope to authenticated shop
      }
    });

    // Fetch tier separately if customer has one
    let currentTier = null;
    if (customer && customer.currentTierId) {
      currentTier = await db.tier.findFirst({
        where: {
          id: customer.currentTierId,
          shop: shop
        }
      });
    }

    // Step 7: Get shop settings for formatting
    // Note: Data API adapter doesn't support select, fetch full record
    const shopSettings = await db.shopSettings.findUnique({
      where: { shop }
    });

    // Step 8: Handle non-enrolled customers
    if (!customer) {
      console.log(`[${requestId}] Customer ${customerId} not enrolled in rewards for shop ${shop}`);
      return json({
        success: true,
        enrolled: false,
        message: "Join our rewards program to start earning cashback!",
        benefits: [
          "Earn cashback on every purchase",
          "Unlock exclusive member tiers",
          "Get personalized rewards"
        ],
        // Legacy format for old widgets
        balance: 0,
        tier: null
      }, {
        headers: {
          "Cache-Control": "private, max-age=60",
          "X-Response-Time": `${Date.now() - startTime}ms`
        }
      });
    }

    console.log(`[${requestId}] ✅ Customer found, processing data...`);

    // Step 9: Convert storeCredit (Prisma Decimal) to number
    const storeCreditValue = typeof customer.storeCredit === 'object' && customer.storeCredit?.toNumber
      ? customer.storeCredit.toNumber()
      : Number(customer.storeCredit || 0);

    // Step 10: Calculate lifetime earned (sum of all positive credit entries)
    const allCreditEntries = await db.storeCreditLedger.findMany({
      where: {
        customerId: customer.id,
        shop: shop,
        type: {
          in: ["CASHBACK_EARNED", "REFUND_CREDIT", "MANUAL_ADJUSTMENT"]
        }
      },
      select: {
        amount: true,
        type: true
      }
    });

    let totalEarned = 0;
    for (const entry of allCreditEntries) {
      const amountValue = typeof entry.amount === 'object' && entry.amount?.toNumber
        ? entry.amount.toNumber()
        : Number(entry.amount);

      // Only include positive amounts (credits)
      if (amountValue > 0) {
        totalEarned += amountValue;
      }
    }

    // Step 11: Calculate store credit used (spent)
    const storeCreditUsed = await db.storeCreditLedger.aggregate({
      where: {
        customerId: customer.id,
        shop: shop,
        type: "ORDER_PAYMENT"
      },
      _sum: {
        amount: true
      }
    });

    // Step 12: Calculate lifetime spent from order metadata
    const cashbackEntries = await db.storeCreditLedger.findMany({
      where: {
        customerId: customer.id,
        shop: shop,
        type: "CASHBACK_EARNED"
      },
      select: {
        metadata: true
      }
    });

    // Sum up actual order amounts from metadata
    let totalSpent = 0;
    for (const entry of cashbackEntries) {
      const metadata = entry.metadata as any;
      if (metadata) {
        const amount = metadata.orderTotal || metadata.orderAmount;
        if (amount) {
          totalSpent += parseFloat(amount) || 0;
        }
      }
    }

    // Fallback: If no order amounts in metadata, estimate from cashback
    if (totalSpent === 0 && totalEarned > 0) {
      const cashbackOnlyTotal = allCreditEntries
        .filter(e => e.type === 'CASHBACK_EARNED')
        .reduce((sum, entry) => {
          const amountValue = typeof entry.amount === 'object' && entry.amount?.toNumber
            ? entry.amount.toNumber()
            : Number(entry.amount);
          return sum + Math.max(0, amountValue);
        }, 0);

      if (cashbackOnlyTotal > 0 && currentTier?.cashbackPercent) {
        totalSpent = (cashbackOnlyTotal / currentTier.cashbackPercent) * 100;
      } else if (cashbackOnlyTotal > 0) {
        totalSpent = cashbackOnlyTotal * 10; // Assume 10% if no tier
      }
    }

    // Step 13: Calculate next tier progress
    let nextTierInfo = null;
    if (currentTier) {
      const nextTier = await db.tier.findFirst({
        where: {
          shop,
          minSpend: { gt: currentTier.minSpend }
        },
        orderBy: { minSpend: 'asc' }
      });

      if (nextTier) {
        const progress = Math.min(100,
          (totalSpent / nextTier.minSpend) * 100
        );

        nextTierInfo = {
          name: nextTier.name,
          progress: Math.round(progress),
          remaining: formatCurrency(
            Math.max(0, nextTier.minSpend - totalSpent),
            shopSettings
          ),
          threshold: formatCurrency(nextTier.minSpend, shopSettings),
          cashbackRate: nextTier.cashbackPercent
        };
      }
    } else {
      // No tier yet, show first available tier
      const firstTier = await db.tier.findFirst({
        where: { shop },
        orderBy: { minSpend: 'asc' }
      });

      if (firstTier) {
        nextTierInfo = {
          name: firstTier.name,
          progress: 0,
          remaining: formatCurrency(firstTier.minSpend, shopSettings),
          threshold: formatCurrency(firstTier.minSpend, shopSettings),
          cashbackRate: firstTier.cashbackPercent
        };
      }
    }

    // Step 14: Build comprehensive response with BACKWARD COMPATIBILITY
    // Include both old format (balance, tier) and new format (memberData)
    const memberResponse = {
      success: true,
      enrolled: true,

      // NEW FORMAT: Rich member data
      memberData: {
        // Balance information
        storeCredit: formatCurrency(storeCreditValue, shopSettings),
        storeCreditRaw: storeCreditValue,

        // Tier information
        tierName: currentTier?.name || "No Tier",
        cashbackRate: currentTier?.cashbackPercent || 0,

        // Progress information
        nextTier: nextTierInfo?.name,
        progressToNextTier: nextTierInfo?.progress,
        remainingToNextTier: nextTierInfo?.remaining,
        nextTierThreshold: nextTierInfo?.threshold,
        nextTierCashbackRate: nextTierInfo?.cashbackRate,

        // Lifetime statistics
        lifetimeEarned: formatCurrency(totalEarned, shopSettings),
        lifetimeSpent: formatCurrency(totalSpent, shopSettings),
        storeCreditRedeemed: storeCreditUsed._sum.amount
          ? formatCurrency(
              Math.abs(typeof storeCreditUsed._sum.amount === 'object' && storeCreditUsed._sum.amount?.toNumber
                ? storeCreditUsed._sum.amount.toNumber()
                : Number(storeCreditUsed._sum.amount)),
              shopSettings
            )
          : formatCurrency(0, shopSettings),

        // Metadata
        memberSince: customer.createdAt.toISOString(),
        lastUpdated: customer.updatedAt.toISOString()
      },

      // LEGACY FORMAT: For old widgets (backward compatibility)
      balance: storeCreditValue,
      tier: currentTier ? {
        id: currentTier.id,
        name: currentTier.name,
        icon: currentTier.icon || "⭐",
        color: currentTier.color || "#FFD700"
      } : null,
      progress: nextTierInfo ? {
        current: totalSpent,
        next: nextTierInfo.cashbackRate || 0,
        percentage: nextTierInfo.progress || 0
      } : null,

      // Shop info
      shopInfo: {
        name: shopSettings?.storeName || shop.replace('.myshopify.com', ''),
        currency: shopSettings?.storeCurrency || 'USD'
      }
    };

    console.log(`[${requestId}] ✅ Successfully fetched data for customer ${customerId} from shop ${shop}`);

    // Return with appropriate cache headers
    return json(memberResponse, {
      headers: {
        "Cache-Control": "private, max-age=30", // Cache for 30 seconds
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "X-Response-Time": `${Date.now() - startTime}ms`,
        "Vary": "Authorization"
      }
    });

  } catch (error: any) {
    console.error(`[${requestId}] App proxy error:`, error);

    // Log detailed error for debugging
    if (error instanceof Error) {
      console.error(`[${requestId}] Error details:`, {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }

    // Don't expose internal errors to client
    return json(
      {
        success: false,
        error: "Service temporarily unavailable",
        message: "We're having trouble loading your rewards. Please try again later."
      },
      {
        status: 503,
        headers: {
          "Retry-After": "60",
          "X-Response-Time": `${Date.now() - startTime}ms`
        }
      }
    );
  }
}

// Reject non-GET requests (app proxy should only use GET)
export async function action() {
  return json(
    {
      success: false,
      error: "Method not allowed"
    },
    {
      status: 405,
      headers: {
        "Allow": "GET"
      }
    }
  );
}
