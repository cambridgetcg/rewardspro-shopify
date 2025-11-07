// app/routes/api.proxy.$.tsx
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { getAuroraClient } from "../utils/aurora-data-api";
import type { SqlParameter } from "@aws-sdk/client-rds-data";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const proxyPath = params["*"] || "";
  const url = new URL(request.url);

  console.log('[Proxy API] 🔵 Request received');
  console.log('[Proxy API] 📍 Path:', proxyPath);
  console.log('[Proxy API] 📍 Full URL:', request.url);

  // SECURITY: Authenticate the app proxy request with HMAC validation
  // This ensures the request is coming from Shopify and not a direct attack
  let session, liquid;
  try {
    console.log('[Proxy API] 🔐 Starting proxy authentication...');
    const authResult = await authenticate.public.appProxy(request);
    session = authResult.session;
    liquid = authResult.liquid;
    console.log('[Proxy API] ✅ Proxy authentication successful');
  } catch (authError) {
    console.error('[Proxy API] ❌ Proxy authentication failed:', authError);
    const errorResponse = {
      success: false,
      error: "Authentication failed",
      message: "Unable to authenticate proxy request: " + (authError.message || "Unknown error")
    };
    console.log('[Proxy API] 📤 Returning auth error:', JSON.stringify(errorResponse));
    return json(errorResponse, { status: 401 });
  }

  // CORS headers for all responses
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate"
  };
  
  // Test endpoint
  if (proxyPath === "test") {
    return json({
      success: true,
      message: "API endpoint is working",
      timestamp: new Date().toISOString()
    }, { headers });
  }
  
  // Membership endpoint
  if (proxyPath === "membership") {
    console.log('[Proxy API] 🔵 Membership endpoint called');
    console.log('[Proxy API] 📍 Full URL:', request.url);
    console.log('[Proxy API] 🔍 All Query Params:', Object.fromEntries(url.searchParams));

    // Extract customer ID from various possible parameters
    const customerId = url.searchParams.get("logged_in_customer_id") ||
                      url.searchParams.get("customer_id") ||
                      url.searchParams.get("customerId") ||
                      url.searchParams.get("cid");

    // SECURITY: Use authenticated shop from session ONLY
    // We completely ignore the shop parameter in URL to prevent spoofing
    const shop = session?.shop;

    // If no authenticated session, reject the request
    if (!shop || !session) {
      console.error('[Proxy API] ❌ No authenticated session - rejecting request');
      const shopFromQuery = url.searchParams.get("shop");
      if (shopFromQuery) {
        console.error('[Proxy API] ⚠️ Attempted direct access with shop parameter:', shopFromQuery);
      }
      return json({
        success: false,
        error: "Authentication required",
        message: "This request must come through Shopify app proxy",
        requiresLogin: false
      }, { status: 401, headers });
    }

    console.log('[Proxy API] 🏪 Shop (authenticated):', shop);
    console.log('[Proxy API] 🔐 Session exists:', !!session);
    console.log('[Proxy API] 👤 Customer ID:', customerId);
    
    // Handle non-logged-in users
    if (!customerId || customerId === "" || customerId === "null" || customerId === "undefined") {
      console.log('[Proxy API] 🔐 No customer ID - guest user');
      return json({
        success: false,
        requiresLogin: true,
        message: "Please log in to view your rewards",
        query: {
          shopDomain: shop || 'unknown',
          shopifyCustomerId: 'guest',
          endpoint: '/apps/rewardspro/api/customer',
          foundInDatabase: false,
          method: 'No Query - Guest User',
          executionTime: 'N/A'
        },
        customer: null,
        balance: {
          storeCredit: 0,
          totalEarned: 0,
          lastSynced: null
        },
        membership: {
          tier: {
            id: "guest",
            name: "Guest",
            cashbackPercent: 1
          }
        }
      }, {
        status: 200,
        headers
      });
    }

    try {
      console.log('[Proxy API] 🔍 Querying database for customer...');
      console.log('[Proxy API] 📊 Query params:', {
        shopDomain: shop,
        shopifyCustomerId: customerId
      });

      // Use direct Data API for customer lookup (replaces Prisma for better visibility)
      const dataApi = getAuroraClient();

      console.log('[Proxy API] 🔍 Using DIRECT Data API query');
      console.log('[Proxy API] 📋 Query parameters:', {
        shopDomain: shop,
        shopifyCustomerId: customerId
      });

      // Build the exact SQL query with proper joins
      // Note: Using currentTierId instead of MembershipHistory table
      const sql = `
        SELECT
          c.id,
          c.shop,
          c."shopifyCustomerId",
          c.email,
          c."firstName",
          c."lastName",
          c."storeCredit",
          c."totalEarned",
          c."totalCashbackEarned",
          c."totalSpent",
          c."orderCount",
          c."createdAt",
          c."updatedAt",
          c."lastSyncedAt",
          c."currentTierId",

          t.id as "tier_id",
          t.shop as "tier_shop",
          t.name as "tier_name",
          t."minSpend" as "tier_minSpend",
          t."cashbackPercent" as "tier_cashbackPercent"

        FROM "Customer" c

        LEFT JOIN "Tier" t
          ON t.id = c."currentTierId"

        WHERE
          c.shop = :shopDomain
          AND c."shopifyCustomerId" = :shopifyCustomerId

        LIMIT 1
      `;

      const parameters: SqlParameter[] = [
        { name: 'shopDomain', value: { stringValue: shop } },
        { name: 'shopifyCustomerId', value: { stringValue: customerId } }
      ];

      console.log('[Proxy API] 📋 SQL (formatted):', sql.replace(/\s+/g, ' ').trim());
      console.log('[Proxy API] 📋 Parameters:', JSON.stringify(parameters));

      const startTime = Date.now();
      const result = await dataApi.executeStatement(sql, parameters);
      const executionTime = Date.now() - startTime;

      console.log('[Proxy API] ⏱️ Query execution time:', executionTime + 'ms');
      console.log('[Proxy API] 📊 Data API Result:', {
        recordCount: result.records?.length || 0,
        hasData: !!(result.records && result.records.length > 0)
      });

      // Transform Data API result to match Prisma format
      let customer = null;
      if (result.records && result.records.length > 0) {
        const row = result.records[0];

        customer = {
          id: row.id,
          shopDomain: row.shop,
          shopifyCustomerId: row.shopifyCustomerId,
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          storeCredit: row.storeCredit,
          totalEarned: row.totalEarned,
          totalCashbackEarned: row.totalCashbackEarned,
          totalSpent: row.totalSpent,
          orderCount: row.orderCount,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
          lastSyncedAt: row.lastSyncedAt ? new Date(row.lastSyncedAt) : null,
          currentTierId: row.currentTierId,

          // Transform currentTier relationship
          currentTier: row.tier_id ? {
            id: row.tier_id,
            shopDomain: row.tier_shop,
            name: row.tier_name,
            minSpend: row.tier_minSpend,
            cashbackPercent: row.tier_cashbackPercent
          } : null
        };

        console.log('[Proxy API] ✅ Customer transformed:', {
          id: customer.id,
          email: customer.email,
          shopifyCustomerId: customer.shopifyCustomerId,
          storeCredit: customer.storeCredit,
          totalEarned: customer.totalEarned,
          totalCashbackEarned: customer.totalCashbackEarned,
          currentTierId: customer.currentTierId,
          hasTier: !!customer.currentTier,
          tierName: customer.currentTier?.name || 'NO_TIER'
        });
      }

      console.log('[Proxy API] 📥 Customer found in database:', customer ? 'YES' : 'NO');
      
      // Return "not found" response if customer doesn't exist (don't show fake data)
      if (!customer) {
        console.log('[Proxy API] ⚠️ Customer not found in database');
        console.log('[Proxy API] ℹ️ Returning customer_not_found status');
        console.log('[Proxy API] 💡 Customer will be created when:');
        console.log('[Proxy API]    1. Shopify fires customer/create webhook, or');
        console.log('[Proxy API]    2. Merchant runs customer sync from admin');
        console.log('[Proxy API] 📋 Query used:', {
          shopDomain: shop,
          shopifyCustomerId: customerId
        });

        return json({
          success: false,
          status: 'customer_not_found',
          message: 'Customer not found in database. Data will be available after merchant runs customer sync.',
          query: {
            shopDomain: shop,
            shopifyCustomerId: customerId,
            endpoint: '/apps/rewardspro/api/customer',
            foundInDatabase: false,
            method: 'AWS Aurora Data API (Direct SQL)',
            executionTime: executionTime + 'ms'
          },
          customer: null,
          balance: null,
          membership: null
        });
      }

      // Get current tier from customer
      let currentTier = customer.currentTier;

      console.log('[Proxy API] 🎖️ Current tier from customer:', {
        hasTier: !!currentTier,
        tierName: currentTier?.name,
        tierCashback: currentTier?.cashbackPercent
      });

      // FALLBACK: If no tier found, try to find/assign one
      if (!currentTier) {
        console.log('[Proxy API] ⚠️ No tier assigned to customer, starting fallback logic...');
        console.log('[Proxy API] 🔍 Customer data for tier lookup:', {
          customerId: customer.id,
          totalSpent: customer.totalSpent,
          storeCredit: customer.storeCredit,
          totalCashbackEarned: customer.totalCashbackEarned
        });

        // Try to find the appropriate tier based on customer spending from database
        const customerSpending = Number(customer.totalSpent || 0);

        console.log('[Proxy API] 💰 Customer spending for tier evaluation:', {
          fromDatabase: customer.totalSpent,
          usingValue: customerSpending
        });

        console.log('[Proxy API] 🔎 Searching for tier with criteria:', {
          shop: shop,
          minSpend_lte: customerSpending
        });

        let assignedTier = await prisma.tier.findFirst({
          where: {
            shop: shop,
            minSpend: { lte: customerSpending }
          },
          orderBy: {
            minSpend: 'desc'
          }
        });

        console.log('[Proxy API] 🔍 Tier lookup result:', {
          customerSpending,
          foundTier: assignedTier?.name || 'NONE',
          tierDetails: assignedTier ? {
            id: assignedTier.id,
            name: assignedTier.name,
            minSpend: assignedTier.minSpend,
            cashbackPercent: assignedTier.cashbackPercent
          } : null
        });

        // If still no tier, get the default (lowest minSpend) tier
        if (!assignedTier) {
          console.log('[Proxy API] 🔍 No tier found by spending, getting default tier...');

          // First, let's check ALL tiers for this shop for debugging
          const allTiers = await prisma.tier.findMany({
            where: { shop: shop }
          });

          console.log('[Proxy API] 📦 ALL TIERS IN DATABASE for shop:', {
            shop,
            count: allTiers.length,
            tiers: allTiers.map(t => ({
              id: t.id,
              name: t.name,
              minSpend: t.minSpend,
              cashbackPercent: t.cashbackPercent
            }))
          });

          assignedTier = await prisma.tier.findFirst({
            where: {
              shop: shop
            },
            orderBy: {
              minSpend: 'asc'
            }
          });

          if (assignedTier) {
            console.log('[Proxy API] ✅ Default tier found:', {
              id: assignedTier.id,
              name: assignedTier.name,
              minSpend: assignedTier.minSpend,
              cashbackPercent: assignedTier.cashbackPercent
            });
          }
        }

        // If still no tier, create Bronze tier
        if (!assignedTier) {
          console.log('[Proxy API] ➕ No tier exists, creating Bronze tier...');
          assignedTier = await prisma.tier.create({
            data: {
              id: `${shop}-bronze-${Date.now()}`,
              shop: shop,
              name: "Bronze",
              minSpend: 0,
              cashbackPercent: 1,
              evaluationPeriod: "ANNUAL"
            }
          });
          console.log('[Proxy API] ✅ Bronze tier created:', assignedTier.id);
        }

        // Update customer's currentTierId
        if (assignedTier) {
          console.log('[Proxy API] ➕ Updating customer currentTierId:', {
            customerId: customer.id,
            tierId: assignedTier.id,
            tierName: assignedTier.name
          });

          try {
            await prisma.customer.update({
              where: { id: customer.id },
              data: { currentTierId: assignedTier.id }
            });

            console.log('[Proxy API] ✅ Customer tier updated successfully');

            // Also create a tier change log entry
            await prisma.tierChangeLog.create({
              data: {
                customerId: customer.id,
                shop: shop,
                fromTierId: null,
                fromTierName: null,
                toTierId: assignedTier.id,
                toTierName: assignedTier.name,
                changeType: "INITIAL_ASSIGNMENT",
                triggerType: "ACCOUNT_CREATED",
                totalSpending: customerSpending,
                note: "Tier auto-assigned on first proxy API call"
              }
            });

            currentTier = assignedTier;
          } catch (error) {
            console.error('[Proxy API] ❌ Failed to update customer tier:', error);
            console.error('[Proxy API] ❌ Error details:', {
              message: error.message,
              code: error.code,
              meta: error.meta
            });
          }
        } else {
          console.log('[Proxy API] ⚠️ No tier available to assign - this should not happen!');
        }
      }

      // Final data validation before response
      console.log('[Proxy API] 📊 Final data check before response:', {
        hasCustomer: !!customer,
        customerId: customer?.id,
        storeCredit: customer?.storeCredit,
        storeCreditType: typeof customer?.storeCredit,
        totalEarned: customer?.totalEarned,
        totalEarnedType: typeof customer?.totalEarned,
        totalCashbackEarned: customer?.totalCashbackEarned,
        totalCashbackEarnedType: typeof customer?.totalCashbackEarned,
        totalSpent: customer?.totalSpent,
        currentTierName: currentTier?.name || 'NO_TIER',
        currentTierCashback: currentTier?.cashbackPercent || 'NO_CASHBACK',
        currentTierCashbackType: typeof currentTier?.cashbackPercent,
        currentTierId: currentTier?.id || 'NO_ID',
        tierObjectExists: !!currentTier
      });

      const responseData = {
        success: true,
        customer: {
          id: customer.id,
          shopifyId: customer.shopifyCustomerId,
          email: customer.email,
          memberSince: customer.createdAt.toISOString()
        },
        balance: {
          storeCredit: Number(customer.storeCredit || 0),
          totalEarned: Number(customer.totalCashbackEarned || customer.totalEarned || 0),
          lastSynced: customer.lastSyncedAt?.toISOString() || null
        },
        membership: {
          tier: currentTier ? {
            id: currentTier.id,
            name: currentTier.name,
            cashbackPercent: Number(currentTier.cashbackPercent)
          } : {
            id: "default",
            name: "Bronze",
            cashbackPercent: 1
          }
        },
        query: {
          shopDomain: shop,
          shopifyCustomerId: customerId,
          endpoint: '/apps/rewardspro/api/customer',
          foundInDatabase: true,
          method: 'AWS Aurora Data API (Direct SQL)',
          executionTime: executionTime + 'ms'
        }
      };

      console.log('[Proxy API] 📤 Preparing success response...');
      console.log('[Proxy API] 🎯 Response data keys:', Object.keys(responseData));

      // DEBUG: Extra validation before returning
      console.log('[Proxy API] 🎯 FINAL RESPONSE VALUES:', {
        'tier.name': responseData.membership.tier.name,
        'tier.cashbackPercent': responseData.membership.tier.cashbackPercent,
        'balance.storeCredit': responseData.balance.storeCredit,
        'balance.totalEarned': responseData.balance.totalEarned,
        'customerEmail': responseData.customer.email
      });

      console.log('[Proxy API] ✅ Full response object:', JSON.stringify(responseData, null, 2));
      console.log('[Proxy API] 📋 Response headers:', JSON.stringify(headers));
      console.log('[Proxy API] 📤 Calling json() to return response...');

      const jsonResponse = json(responseData, { headers });
      console.log('[Proxy API] ✅ json() completed, returning response');
      return jsonResponse;

    } catch (error: any) {
      console.error('[Proxy API] ❌ Caught error in membership endpoint');
      console.error('[Proxy API] ❌ Error message:', error.message);
      console.error('[Proxy API] ❌ Error stack:', error.stack);
      console.error('[Proxy API] ❌ Error details:', {
        name: error.name,
        code: error.code,
        cause: error.cause
      });

      // Return error with fallback data
      const errorResponse = {
        success: false,
        error: "Database error",
        message: "Unable to load rewards data. Please try again later.",
        requiresLogin: false,
        query: {
          shopDomain: shop,
          shopifyCustomerId: customerId,
          endpoint: '/apps/rewardspro/api/customer',
          foundInDatabase: false,
          method: 'Error - Query Failed',
          executionTime: 'N/A'
        },
        customer: {
          id: "error",
          shopifyId: customerId,
          email: ""
        },
        balance: {
          storeCredit: 0,
          totalEarned: 0,
          lastSynced: null
        },
        membership: {
          tier: {
            id: "error",
            name: "Bronze",
            cashbackPercent: 1
          }
        }
      };

      console.log('[Proxy API] 📤 Returning error response:', JSON.stringify(errorResponse, null, 2));
      return json(errorResponse, { status: 500, headers });
    }
  }
  
  // 404 for unknown paths
  console.log('[Proxy API] ⚠️ Unknown path requested:', proxyPath);
  const notFoundResponse = {
    success: false,
    error: "Not found",
    message: `Endpoint '${proxyPath}' not found`,
    availablePaths: ["test", "membership"]
  };
  console.log('[Proxy API] 📤 Returning 404 response:', JSON.stringify(notFoundResponse));
  return json(notFoundResponse, { status: 404, headers });
}

// Handle OPTIONS requests for CORS
export async function action({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  
  return json({ error: "Method not allowed" }, { status: 405 });
}