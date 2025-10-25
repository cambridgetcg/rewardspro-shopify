// app/routes/api.admin.clear-test-data.tsx
// Admin endpoint to clear test data - accessible via /api/admin/clear-test-data

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

const CONFIG = {
  shopDomain: "teststore12062025.myshopify.com",
};

export async function loader({ request }: LoaderFunctionArgs) {
  const logs: string[] = [];

  try {
    logs.push("🗑️  Clearing test data...");
    logs.push(`📍 Shop: ${CONFIG.shopDomain}`);
    logs.push("");

    // Count existing records
    const customerCount = await prisma.customer.count({
      where: { shopDomain: CONFIG.shopDomain }
    });

    const orderCount = await prisma.order.count({
      where: { shopDomain: CONFIG.shopDomain }
    });

    const tierCount = await prisma.tier.count({
      where: { shopDomain: CONFIG.shopDomain }
    });

    logs.push("Current database state:");
    logs.push(`  Customers: ${customerCount}`);
    logs.push(`  Orders: ${orderCount}`);
    logs.push(`  Tiers: ${tierCount}`);
    logs.push("");

    if (customerCount === 0 && orderCount === 0 && tierCount === 0) {
      logs.push("✅ Database is already empty for this shop.");
      return json({
        success: true,
        logs,
        summary: {
          customersDeleted: 0,
          ordersDeleted: 0,
          tiersDeleted: 0
        }
      });
    }

    logs.push("Deleting records...");
    logs.push("");

    // Delete in correct order (respecting foreign key constraints)

    // 1. Delete orders first
    let deletedOrders = 0;
    if (orderCount > 0) {
      logs.push(`📦 Deleting ${orderCount} orders...`);
      const result = await prisma.order.deleteMany({
        where: { shopDomain: CONFIG.shopDomain }
      });
      deletedOrders = result.count;
      logs.push(`  ✓ Deleted ${deletedOrders} orders`);
    }

    // 2. Delete membership history
    const membershipHistoryCount = await prisma.membershipHistory.count({
      where: { customer: { shopDomain: CONFIG.shopDomain } }
    });

    let deletedHistory = 0;
    if (membershipHistoryCount > 0) {
      logs.push(`🎖️  Deleting ${membershipHistoryCount} membership history records...`);
      const result = await prisma.membershipHistory.deleteMany({
        where: { customer: { shopDomain: CONFIG.shopDomain } }
      });
      deletedHistory = result.count;
      logs.push(`  ✓ Deleted ${deletedHistory} membership history records`);
    }

    // 3. Delete customers
    let deletedCustomers = 0;
    if (customerCount > 0) {
      logs.push(`👥 Deleting ${customerCount} customers...`);
      const result = await prisma.customer.deleteMany({
        where: { shopDomain: CONFIG.shopDomain }
      });
      deletedCustomers = result.count;
      logs.push(`  ✓ Deleted ${deletedCustomers} customers`);
    }

    // 4. Delete tiers
    let deletedTiers = 0;
    if (tierCount > 0) {
      logs.push(`📊 Deleting ${tierCount} tiers...`);
      const result = await prisma.tier.deleteMany({
        where: { shopDomain: CONFIG.shopDomain }
      });
      deletedTiers = result.count;
      logs.push(`  ✓ Deleted ${deletedTiers} tiers`);
    }

    logs.push("");
    logs.push("✅ All test data has been cleared successfully!");

    return json({
      success: true,
      logs,
      summary: {
        customersDeleted: deletedCustomers,
        ordersDeleted: deletedOrders,
        membershipHistoryDeleted: deletedHistory,
        tiersDeleted: deletedTiers
      }
    });

  } catch (error: any) {
    logs.push("");
    logs.push(`❌ Failed to clear test data: ${error.message}`);

    return json({
      success: false,
      error: error.message,
      logs
    }, {
      status: 500
    });
  }
}
