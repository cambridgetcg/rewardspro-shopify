import { json, type LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";

/**
 * Storefront API endpoint for loyalty widget
 *
 * Authentication: Customer metafield ID + shop domain verification
 * No session tokens (not available on storefront)
 *
 * Security: Shop-scoped queries prevent cross-shop access
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

// Handle CORS preflight requests
export async function options({ request }: LoaderFunctionArgs) {
  const requestOrigin = request.headers.get("origin");
  let allowOrigin = "*";

  if (requestOrigin) {
    try {
      const originUrl = new URL(requestOrigin);
      const originHost = originUrl.hostname;

      if (originHost.endsWith(".myshopify.com")) {
        allowOrigin = requestOrigin;
      }
    } catch (error) {
      // Invalid origin, keep default
    }
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Access-Control-Max-Age": "86400" // 24 hours
    }
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const customerMetafieldId = url.searchParams.get("customerId");
  const shopDomain = url.searchParams.get("shop");

  // Validate required parameters
  if (!customerMetafieldId || !shopDomain) {
    return json(
      { error: "Missing required parameters: customerId and shop" },
      { status: 400 }
    );
  }

  // Normalize shop domain (remove protocol, trailing slash)
  const normalizedShop = shopDomain
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(".myshopify.com", "") + ".myshopify.com";

  try {
    // Verify shop exists in our system
    const shop = await db.shop.findUnique({
      where: { shop: normalizedShop },
      select: { id: true, shop: true }
    });

    if (!shop) {
      return json(
        { error: "Shop not found" },
        { status: 404 }
      );
    }

    // Find customer by metafield ID and shop (shop-scoped for security)
    const customer = await db.customer.findFirst({
      where: {
        shopifyCustomerMetafieldId: customerMetafieldId,
        shop: normalizedShop
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        pointsBalance: true,
        currentTierId: true,
        lifetimePoints: true,
        tier: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
            threshold: true
          }
        }
      }
    });

    if (!customer) {
      return json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Get next tier for progress calculation
    const nextTier = await db.tier.findFirst({
      where: {
        shop: normalizedShop,
        threshold: {
          gt: customer.lifetimePoints
        }
      },
      orderBy: {
        threshold: "asc"
      },
      select: {
        id: true,
        name: true,
        threshold: true
      }
    });

    // Calculate expiring points (points expiring in next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringPointsData = await db.pointTransaction.aggregate({
      where: {
        customerId: customer.id,
        shop: normalizedShop,
        points: {
          gt: 0
        },
        expiresAt: {
          lte: thirtyDaysFromNow,
          gt: new Date()
        }
      },
      _sum: {
        points: true
      }
    });

    // Get earliest expiration date
    const earliestExpiration = await db.pointTransaction.findFirst({
      where: {
        customerId: customer.id,
        shop: normalizedShop,
        points: {
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

    // Build response
    const loyaltyData: LoyaltyData = {
      balance: customer.pointsBalance,
      tier: customer.tier ? {
        id: customer.tier.id,
        name: customer.tier.name,
        icon: customer.tier.icon || "⭐",
        color: customer.tier.color || "#FFD700"
      } : null,
      progress: nextTier ? {
        current: customer.lifetimePoints,
        next: nextTier.threshold,
        percentage: Math.round((customer.lifetimePoints / nextTier.threshold) * 100)
      } : null,
      expiringPoints: expiringPointsData._sum.points && earliestExpiration ? {
        amount: expiringPointsData._sum.points,
        date: earliestExpiration.expiresAt!.toISOString()
      } : null
    };

    // Determine CORS origin
    const requestOrigin = request.headers.get("origin");
    let allowOrigin = "*"; // Default to all origins

    if (requestOrigin) {
      try {
        const originUrl = new URL(requestOrigin);
        const originHost = originUrl.hostname;

        // Allow shop's myshopify.com domain or any *.myshopify.com domain
        if (originHost === normalizedShop || originHost.endsWith(".myshopify.com")) {
          allowOrigin = requestOrigin;
        }
      } catch (error) {
        // Invalid origin URL, keep default
      }
    }

    // Return with CORS headers for storefront access
    return json(loyaltyData, {
      headers: {
        "Cache-Control": "private, max-age=30", // 30 second cache
        "Vary": "Origin",
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept"
      }
    });

  } catch (error) {
    console.error("Error fetching loyalty data:", error);
    return json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
