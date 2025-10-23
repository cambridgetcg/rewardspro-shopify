/**
 * RewardsPro App Proxy Handler
 *
 * Handles widget requests from storefront via Shopify App Proxy
 *
 * Request Flow:
 * 1. Widget calls: /apps/rewardspromembership?shopifyCustomerId=123
 * 2. Shopify proxy forwards to: /api/proxy?shopifyCustomerId=123&shop=...
 * 3. This handler authenticates, fetches data, returns JSON
 *
 * Configuration:
 * - TOML: url="/api/proxy", subpath="rewardspromembership", prefix="apps"
 * - Remix route: api.proxy.$.tsx → /api/proxy/* (splat)
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Simple in-memory rate limiter (60 req/min per shop)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(shop: string, limit = 60): boolean {
  const now = Date.now();
  const key = `proxy:${shop}`;
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

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();

  try {
    // Step 1: Authenticate via Shopify App Proxy (verifies HMAC signature)
    const { session } = await authenticate.public.appProxy(request);

    // Step 2: Check if app is installed
    if (!session) {
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

    // Step 3: Rate limiting
    if (!checkRateLimit(shop)) {
      return json(
        {
          success: false,
          error: "Too many requests. Please try again later."
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-Response-Time": `${Date.now() - startTime}ms`
          }
        }
      );
    }

    // Step 4: Extract customer ID from request
    const url = new URL(request.url);
    const loggedInCustomerId = url.searchParams.get("logged_in_customer_id"); // Shopify automatic
    const manualCustomerId = url.searchParams.get("shopifyCustomerId");       // Manual (legacy)
    const customerId = loggedInCustomerId || manualCustomerId;

    // Step 5: Handle guest users (not logged in)
    if (!customerId) {
      return json(
        {
          success: true,
          requiresLogin: true,
          enrolled: false,
          message: "Please log in to view your rewards"
        },
        {
          headers: {
            "Cache-Control": "public, max-age=60",
            "X-Response-Time": `${Date.now() - startTime}ms`
          }
        }
      );
    }

    // Step 6: Fetch customer from database (scoped to shop)
    const customer = await db.customer.findFirst({
      where: {
        shopifyCustomerId: customerId,
        shop: shop // CRITICAL: Always scope to authenticated shop
      }
    });

    // Step 7: Handle non-enrolled customers
    if (!customer) {
      return json(
        {
          success: true,
          enrolled: false,
          message: "Join our rewards program to start earning cashback!",
          balance: 0,
          tier: null
        },
        {
          headers: {
            "Cache-Control": "private, max-age=60",
            "X-Response-Time": `${Date.now() - startTime}ms`
          }
        }
      );
    }

    // Step 8: Fetch current tier
    let currentTier = null;
    if (customer.currentTierId) {
      currentTier = await db.tier.findFirst({
        where: {
          id: customer.currentTierId,
          shop: shop
        }
      });
    }

    // Step 9: Convert store credit (Prisma Decimal) to number
    const storeCreditValue = typeof customer.storeCredit === 'object' && customer.storeCredit?.toNumber
      ? customer.storeCredit.toNumber()
      : Number(customer.storeCredit || 0);

    // Step 10: Calculate lifetime earned
    const earnedEntries = await db.storeCreditLedger.findMany({
      where: {
        customerId: customer.id,
        shop: shop,
        type: {
          in: ["CASHBACK_EARNED", "REFUND_CREDIT", "MANUAL_ADJUSTMENT"]
        }
      },
      select: {
        amount: true
      }
    });

    let totalEarned = 0;
    for (const entry of earnedEntries) {
      const amountValue = typeof entry.amount === 'object' && entry.amount?.toNumber
        ? entry.amount.toNumber()
        : Number(entry.amount);

      if (amountValue > 0) {
        totalEarned += amountValue;
      }
    }

    // Step 11: Get shop settings for currency formatting
    const shopSettings = await db.shopSettings.findUnique({
      where: { shop }
    });

    const formatAmount = (amount: number) => {
      const currency = shopSettings?.storeCurrency || 'USD';
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency
        }).format(amount);
      } catch {
        return `${currency} ${amount.toFixed(2)}`;
      }
    };

    // Step 12: Build response with backward compatibility
    const response = {
      success: true,
      enrolled: true,

      // NEW FORMAT: Rich member data
      memberData: {
        storeCredit: formatAmount(storeCreditValue),
        storeCreditRaw: storeCreditValue,
        tierName: currentTier?.name || "Member",
        cashbackRate: currentTier?.cashbackPercent || 0,
        lifetimeEarned: formatAmount(totalEarned),
        memberSince: customer.createdAt.toISOString()
      },

      // LEGACY FORMAT: For backward compatibility
      balance: storeCreditValue,
      tier: currentTier ? {
        id: currentTier.id,
        name: currentTier.name,
        cashbackPercent: currentTier.cashbackPercent
      } : null,

      // Shop info
      shopInfo: {
        name: shopSettings?.storeName || shop.replace('.myshopify.com', ''),
        currency: shopSettings?.storeCurrency || 'USD'
      }
    };

    return json(response, {
      headers: {
        "Cache-Control": "private, max-age=30",
        "X-Content-Type-Options": "nosniff",
        "X-Response-Time": `${Date.now() - startTime}ms`
      }
    });

  } catch (error: any) {
    console.error('[AppProxy] Error:', error);

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

// Reject non-GET requests
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
