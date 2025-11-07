import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getAuroraClient } from "../utils/aurora-data-api";
import type { SqlParameter } from "@aws-sdk/client-rds-data";

/**
 * Admin-only endpoint to test Data API queries directly
 * This bypasses the proxy authentication and allows testing the query logic
 */
export async function loader({ request }: LoaderFunctionArgs) {
  console.log('[Test Data API] 🔵 Request received');
  console.log('[Test Data API] 📍 URL:', request.url);

  try {
    // Authenticate as admin (not proxy)
    console.log('[Test Data API] 🔐 Starting authentication...');
    await authenticate.admin(request);
    console.log('[Test Data API] ✅ Authentication successful');
  } catch (authError) {
    console.error('[Test Data API] ❌ Authentication failed:', authError);
    const errorResponse = {
      success: false,
      error: "Authentication failed",
      message: authError.message || "Unable to authenticate request",
    };
    console.log('[Test Data API] 📤 Returning auth error response:', JSON.stringify(errorResponse));
    return json(errorResponse, { status: 401 });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const customerId = url.searchParams.get("customerId");

  console.log('[Test Data API] 📋 Query parameters:', { shop, customerId });

  if (!shop || !customerId) {
    const errorResponse = {
      success: false,
      error: "Missing required parameters",
      message: "Both 'shop' and 'customerId' parameters are required",
    };
    console.log('[Test Data API] ❌ Missing parameters, returning error:', JSON.stringify(errorResponse));
    return json(errorResponse, { status: 400 });
  }

  try {
    console.log('[Test Data API] 🔍 Getting Aurora client...');
    const dataApi = getAuroraClient();
    console.log('[Test Data API] ✅ Aurora client ready');

    // Build the exact SQL query used in the proxy
    const sql = `
      SELECT
        c.id,
        c."shopDomain",
        c."shopifyCustomerId",
        c.email,
        c."firstName",
        c."lastName",
        c."storeCredit",
        c."totalEarned",
        c."totalCashbackEarned",
        c."totalSpent",
        c."ordersCount",
        c."createdAt",
        c."updatedAt",
        c."lastSyncedAt",

        mh.id as "membershipHistory_id",
        mh."customerId" as "membershipHistory_customerId",
        mh."tierId" as "membershipHistory_tierId",
        mh."isActive" as "membershipHistory_isActive",
        mh."assignmentType" as "membershipHistory_assignmentType",
        mh."createdAt" as "membershipHistory_createdAt",

        t.id as "tier_id",
        t."shopDomain" as "tier_shopDomain",
        t.name as "tier_name",
        t."minSpend" as "tier_minSpend",
        t."cashbackPercent" as "tier_cashbackPercent",
        t."isActive" as "tier_isActive"

      FROM "Customer" c

      LEFT JOIN "MembershipHistory" mh
        ON mh."customerId" = c.id
        AND mh."isActive" = true

      LEFT JOIN "Tier" t
        ON t.id = mh."tierId"

      WHERE
        c."shopDomain" = :shopDomain
        AND c."shopifyCustomerId" = :shopifyCustomerId

      ORDER BY mh."createdAt" DESC

      LIMIT 1
    `;

    const parameters: SqlParameter[] = [
      { name: 'shopDomain', value: { stringValue: shop } },
      { name: 'shopifyCustomerId', value: { stringValue: customerId } }
    ];

    // Execute query and measure time
    console.log('[Test Data API] ⏱️ Executing SQL query...');
    const startTime = Date.now();
    const result = await dataApi.executeStatement(sql, parameters);
    const executionTime = Date.now() - startTime;
    console.log('[Test Data API] ✅ Query executed in', executionTime + 'ms');
    console.log('[Test Data API] 📊 Result:', {
      hasRecords: !!(result.records && result.records.length > 0),
      recordCount: result.records?.length || 0
    });

    // Format the SQL for display (pretty print)
    const formattedSql = sql
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    // Check if customer was found
    const customerFound = result.records && result.records.length > 0;
    console.log('[Test Data API] 🔍 Customer found:', customerFound);
    let customer = null;

    if (customerFound) {
      const row = result.records[0];
      customer = {
        id: row.id,
        shopDomain: row.shopDomain,
        shopifyCustomerId: row.shopifyCustomerId,
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        storeCredit: row.storeCredit,
        totalEarned: row.totalEarned,
        totalCashbackEarned: row.totalCashbackEarned,
        totalSpent: row.totalSpent,
        ordersCount: row.ordersCount,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        lastSyncedAt: row.lastSyncedAt,
        membershipHistory: row.membershipHistory_id ? [{
          id: row.membershipHistory_id,
          customerId: row.membershipHistory_customerId,
          tierId: row.membershipHistory_tierId,
          isActive: row.membershipHistory_isActive,
          assignmentType: row.membershipHistory_assignmentType,
          createdAt: row.membershipHistory_createdAt,
          tier: row.tier_id ? {
            id: row.tier_id,
            shopDomain: row.tier_shopDomain,
            name: row.tier_name,
            minSpend: row.tier_minSpend,
            cashbackPercent: row.tier_cashbackPercent,
            isActive: row.tier_isActive
          } : null
        }] : []
      };
    }

    const responseData = {
      success: true,
      query: {
        sql: formattedSql,
        parameters: parameters.map(p => ({
          name: p.name,
          value: p.value?.stringValue || p.value?.longValue || p.value?.doubleValue || p.value?.booleanValue || null
        })),
        executionTime: `${executionTime}ms`,
        method: 'AWS Aurora Data API (Direct SQL)',
        recordCount: result.records?.length || 0,
        foundInDatabase: customerFound
      },
      customer: customerFound ? {
        id: customer.id,
        shopifyId: customer.shopifyCustomerId,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        storeCredit: Number(customer.storeCredit || 0),
        totalEarned: Number(customer.totalCashbackEarned || customer.totalEarned || 0),
        totalSpent: Number(customer.totalSpent || 0),
        ordersCount: customer.ordersCount || 0,
        memberSince: customer.createdAt,
        lastSynced: customer.lastSyncedAt,
        membership: customer.membershipHistory[0] ? {
          tier: customer.membershipHistory[0].tier ? {
            id: customer.membershipHistory[0].tier.id,
            name: customer.membershipHistory[0].tier.name,
            minSpend: Number(customer.membershipHistory[0].tier.minSpend || 0),
            cashbackPercent: Number(customer.membershipHistory[0].tier.cashbackPercent || 0)
          } : null
        } : null
      } : null,
      rawResult: customerFound ? result.records[0] : null
    };

    console.log('[Test Data API] 📤 Preparing response...');
    console.log('[Test Data API] 🎯 Response data keys:', Object.keys(responseData));
    console.log('[Test Data API] 📦 Full response:', JSON.stringify(responseData, null, 2));

    return json(responseData);

  } catch (error: any) {
    console.error('[Test Data API] ❌ Caught error in main try-catch');
    console.error('[Test Data API] ❌ Error message:', error.message);
    console.error('[Test Data API] ❌ Error stack:', error.stack);
    console.error('[Test Data API] ❌ Error details:', {
      name: error.name,
      code: error.code,
      cause: error.cause
    });

    const errorResponse = {
      success: false,
      error: error.message || 'Database query failed',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      query: {
        method: 'AWS Aurora Data API (Direct SQL)',
        executionTime: 'N/A',
        foundInDatabase: false
      }
    };

    console.log('[Test Data API] 📤 Returning error response:', JSON.stringify(errorResponse, null, 2));
    return json(errorResponse, { status: 500 });
  }
}
