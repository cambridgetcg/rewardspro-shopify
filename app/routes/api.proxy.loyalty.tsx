import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * App Proxy Handler for Storefront Loyalty Widget
 *
 * Path: /api/proxy/loyalty
 * Storefront URL: /apps/rewardspro/loyalty (configured in Partner Dashboard)
 *
 * NOTE: This is a compatibility route. The main route is at apps.proxy.loyalty.tsx
 * This route exists to handle cases where the Partner Dashboard is configured
 * with url: https://rewardspro-production.vercel.app/api/proxy instead of /apps/proxy
 *
 * Benefits:
 * - Built-in Shopify authentication via app proxy
 * - HMAC signature verification automatic
 * - Shop context provided by Shopify session
 * - No CORS needed (same-origin request)
 * - Compliant with Shopify App Store requirements
 *
 * Configuration (if using this route):
 * - prefix: apps
 * - subpath: rewardspro
 * - url: https://rewardspro-production.vercel.app/api/proxy
 */

interface LoyaltyData {
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
  const requestId = `proxy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`\n[${requestId}] ========== APP PROXY REQUEST ==========`);
  console.log(`[${requestId}] URL: ${request.url}`);
  console.log(`[${requestId}] Method: ${request.method}`);
  console.log(`[${requestId}] Headers:`, {
    host: request.headers.get('host'),
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
    userAgent: request.headers.get('user-agent')?.substring(0, 50) + '...',
    shopifyShop: request.headers.get('x-shopify-shop-domain'),
  });

  // Authenticate via app proxy
  // Returns session if shop has app installed, undefined otherwise
  // Shopify automatically validates HMAC signature
  console.log(`[${requestId}] Authenticating via app proxy...`);

  let session;
  try {
    const authResult = await authenticate.public.appProxy(request);
    session = authResult.session;
    console.log(`[${requestId}] Authentication result:`, {
      hasSession: !!session,
      sessionId: session?.id,
      shop: session?.shop,
      isOnline: session?.isOnline
    });
  } catch (authError: any) {
    console.error(`[${requestId}] ❌ Authentication error:`, authError.message);
    return json(
      {
        error: "Authentication failed",
        message: authError.message || "Unable to verify app installation"
      },
      { status: 403 }
    );
  }

  // If no session, shop hasn't installed the app
  if (!session) {
    console.warn(`[${requestId}] ⚠️ No session - shop hasn't installed the app`);
    return json(
      {
        error: "App not installed",
        message: "Please install RewardsPro from the Shopify App Store"
      },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const shopifyCustomerId = url.searchParams.get("shopifyCustomerId");
  const legacyCustomerId = url.searchParams.get("customerId"); // Backward compatibility

  console.log(`[${requestId}] Query Parameters:`, {
    shopifyCustomerId,
    legacyCustomerId,
    allParams: Object.fromEntries(url.searchParams.entries())
  });

  // Support both shopifyCustomerId (new) and customerId (legacy metafield-based)
  const customerId = shopifyCustomerId || legacyCustomerId;

  // Validate required parameters
  if (!customerId) {
    console.error(`[${requestId}] ❌ Missing required parameter`);
    return json(
      { error: "Missing required parameter: shopifyCustomerId or customerId" },
      { status: 400 }
    );
  }

  // Shop domain is automatically available from session
  // This is secure - validated by Shopify's HMAC signature
  const shop = session.shop;

  console.log(`[${requestId}] ✅ Request validated:`, {
    shop,
    customerId,
    parameterUsed: shopifyCustomerId ? 'shopifyCustomerId' : 'customerId'
  });

  try {
    console.log(`[${requestId}] 🔍 Querying database for customer...`);
    // Find customer by Shopify customer ID (preferred) or internal ID (legacy)
    // Shop-scoped query prevents cross-store access
    const customer = await db.customer.findFirst({
      where: shopifyCustomerId ? {
        shopifyCustomerId: customerId,
        shop: shop
      } : {
        id: customerId,
        shop: shop
      },
      select: {
        id: true,
        email: true,
        pointsBalance: true,
        lifetimePoints: true,
        currentTierId: true,
        currentTier: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
            minSpend: true,
            threshold: true
          }
        }
      }
    });

    console.log(`[${requestId}] Database query result:`, {
      found: !!customer,
      customerId: customer?.id,
      email: customer?.email,
      hasTier: !!customer?.currentTierId
    });

    if (!customer) {
      console.log(`[${requestId}] ⚠️ Customer not found in database`);

      // Debug: Check if customer exists with different shop format
      const customerAnyShop = await db.customer.findFirst({
        where: shopifyCustomerId ? {
          shopifyCustomerId: customerId
        } : {
          id: customerId
        },
        select: {
          id: true,
          shop: true,
          shopifyCustomerId: true,
          email: true
        }
      });

      if (customerAnyShop) {
        console.error(`[${requestId}] ⚠️ SHOP MISMATCH!`, {
          providedShop: shop,
          actualShopInDB: customerAnyShop.shop,
          customerId: customerAnyShop.id,
          shopifyCustomerId: customerAnyShop.shopifyCustomerId,
          email: customerAnyShop.email,
          shopMatch: shop === customerAnyShop.shop
        });
      } else {
        console.log(`[${requestId}] Customer does not exist in database at all`);
      }

      // Return success with enrolled: false (same as customer account extension)
      // This allows widget to show "Not enrolled" message instead of error
      console.log(`[${requestId}] 📤 Returning: Customer not enrolled`);
      return json(
        {
          success: true,
          enrolled: false,
          balance: 0,
          tier: null,
          progress: null,
          expiringPoints: null,
          message: "You're not enrolled in the rewards program yet",
          canEnroll: true
        },
        { status: 200 }
      );
    }

    console.log(`[${requestId}] ✅ Customer found, processing data...`);

    // Convert Decimal to number (Prisma Decimal type)
    const pointsBalance = typeof customer.pointsBalance === 'object' && 'toNumber' in customer.pointsBalance
      ? (customer.pointsBalance as any).toNumber()
      : Number(customer.pointsBalance || 0);

    const lifetimePoints = typeof customer.lifetimePoints === 'object' && 'toNumber' in customer.lifetimePoints
      ? (customer.lifetimePoints as any).toNumber()
      : Number(customer.lifetimePoints || 0);

    // Get next tier for progress calculation
    const currentTierThreshold = customer.currentTier
      ? (customer.currentTier.threshold || customer.currentTier.minSpend)
      : 0;

    const nextTier = await db.tier.findFirst({
      where: {
        shop: shop,
        minSpend: {
          gt: currentTierThreshold
        }
      },
      orderBy: {
        minSpend: "asc"
      },
      select: {
        id: true,
        name: true,
        minSpend: true,
        threshold: true
      }
    });

    // Calculate expiring points (points expiring in next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringPointsData = await db.storeCreditLedger.aggregate({
      where: {
        customerId: customer.id,
        shop: shop,
        amount: {
          gt: 0
        },
        expiresAt: {
          lte: thirtyDaysFromNow,
          gt: new Date()
        }
      },
      _sum: {
        amount: true
      }
    });

    // Get earliest expiration date
    const earliestExpiration = await db.storeCreditLedger.findFirst({
      where: {
        customerId: customer.id,
        shop: shop,
        amount: {
          gt: 0
        },
        expiresAt: {
          lte: thirtyDaysFromNow,
          gt: new Date()
        }
      },
      orderBy: {
        expiresAt: "asc"
      },
      select: {
        expiresAt: true
      }
    });

    // Convert expiring points sum
    const expiringSum = expiringPointsData._sum.amount
      ? (typeof expiringPointsData._sum.amount === 'object' && 'toNumber' in expiringPointsData._sum.amount
          ? (expiringPointsData._sum.amount as any).toNumber()
          : Number(expiringPointsData._sum.amount))
      : 0;

    // Build response
    const loyaltyData: LoyaltyData = {
      balance: pointsBalance,
      tier: customer.currentTier ? {
        id: customer.currentTier.id,
        name: customer.currentTier.name,
        icon: customer.currentTier.icon || "⭐",
        color: customer.currentTier.color || "#FFD700"
      } : null,
      progress: nextTier ? {
        current: lifetimePoints,
        next: nextTier.threshold || nextTier.minSpend,
        percentage: Math.min(100, Math.round((lifetimePoints / (nextTier.threshold || nextTier.minSpend)) * 100))
      } : null,
      expiringPoints: expiringSum > 0 && earliestExpiration ? {
        amount: expiringSum,
        date: earliestExpiration.expiresAt!.toISOString()
      } : null
    };

    console.log(`[${requestId}] ✅ SUCCESS - Returning loyalty data:`, {
      shop,
      customerId: customer.id,
      email: customer.email,
      balance: pointsBalance,
      tierName: customer.currentTier?.name,
      hasNextTier: !!nextTier,
      expiringPoints: expiringSum
    });

    console.log(`[${requestId}] 📤 Response data:`, {
      balance: loyaltyData.balance,
      tier: loyaltyData.tier?.name,
      progress: loyaltyData.progress,
      expiringPoints: loyaltyData.expiringPoints
    });

    console.log(`[${requestId}] ========== APP PROXY COMPLETE ==========\n`);

    // Return JSON response
    // No CORS headers needed - same-origin via proxy
    return json(loyaltyData, {
      headers: {
        "Cache-Control": "private, max-age=30", // 30 second cache
      }
    });

  } catch (error: any) {
    console.error(`[${requestId}] ❌ FATAL ERROR:`, {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3),
      name: error.name
    });
    console.error(`[${requestId}] ========== APP PROXY FAILED ==========\n`);

    return json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
