import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * App Proxy Handler for Storefront Loyalty Widget
 *
 * Path: /apps/proxy/loyalty
 * Storefront URL: /apps/rewardspro/loyalty (configured in Partner Dashboard)
 *
 * This replaces the direct API endpoint /api/storefront/loyalty
 *
 * Benefits:
 * - Built-in Shopify authentication via app proxy
 * - HMAC signature verification automatic
 * - Shop context provided by Shopify session
 * - No CORS needed (same-origin request)
 * - Compliant with Shopify App Store requirements
 *
 * Configuration Required:
 * - Partner Dashboard → App setup → App proxy
 * - Subpath: rewardspro
 * - Proxy URL: https://rewardspro-production.vercel.app/apps/proxy
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
  // Authenticate via app proxy
  // Returns session if shop has app installed, undefined otherwise
  // Shopify automatically validates HMAC signature
  const { session } = await authenticate.public.appProxy(request);

  // If no session, shop hasn't installed the app
  if (!session) {
    console.warn('[App Proxy] Request from shop without app installed');
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

  // Support both shopifyCustomerId (new) and customerId (legacy metafield-based)
  const customerId = shopifyCustomerId || legacyCustomerId;

  // Validate required parameters
  if (!customerId) {
    console.error('[App Proxy] Missing customerId or shopifyCustomerId parameter');
    return json(
      { error: "Missing required parameter: shopifyCustomerId or customerId" },
      { status: 400 }
    );
  }

  // Shop domain is automatically available from session
  // This is secure - validated by Shopify's HMAC signature
  const shop = session.shop;

  console.log('[App Proxy] Request:', {
    shop,
    shopDomain: shop,
    shopifyCustomerId,
    legacyCustomerId,
    usedParameter: shopifyCustomerId ? 'shopifyCustomerId' : 'customerId',
    url: request.url,
    sessionDetails: {
      id: session.id,
      shop: session.shop,
      state: session.state,
      isOnline: session.isOnline
    }
  });

  try {
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

    if (!customer) {
      console.log('[App Proxy] Customer not enrolled:', {
        shop,
        shopifyCustomerId,
        legacyCustomerId,
        usedParameter: shopifyCustomerId ? 'shopifyCustomerId' : 'customerId',
        queryUsed: shopifyCustomerId ? {
          shopifyCustomerId: customerId,
          shop: shop
        } : {
          id: customerId,
          shop: shop
        }
      });

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
        console.error('[App Proxy] ⚠️ FOUND CUSTOMER BUT WRONG SHOP FORMAT!', {
          providedShop: shop,
          actualShopInDB: customerAnyShop.shop,
          customerId: customerAnyShop.id,
          shopifyCustomerId: customerAnyShop.shopifyCustomerId,
          email: customerAnyShop.email,
          shopMatch: shop === customerAnyShop.shop
        });
      } else {
        console.log('[App Proxy] Customer does not exist in database at all for shopifyCustomerId:', customerId);
      }

      // Return success with enrolled: false (same as customer account extension)
      // This allows widget to show "Not enrolled" message instead of error
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

    console.log('[App Proxy] Success:', {
      shop,
      customerId: customer.id,
      balance: pointsBalance,
      tier: customer.currentTier?.name
    });

    // Return JSON response
    // No CORS headers needed - same-origin via proxy
    return json(loyaltyData, {
      headers: {
        "Cache-Control": "private, max-age=30", // 30 second cache
      }
    });

  } catch (error) {
    console.error("[App Proxy] Error fetching loyalty data:", error);
    return json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
