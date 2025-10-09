import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { CustomerSyncServiceV2 } from "./customer-sync-v2.service";
import db from "../db.server";

/**
 * Background customer sync function for afterAuth hook
 * Syncs all customers from Shopify to the database in the background
 */
export async function syncCustomersInBackground(
  shop: string,
  admin: AdminApiContext
): Promise<void> {
  console.log(`[Background Sync] Starting customer sync for shop: ${shop}`);

  try {
    // Mark sync as in progress
    await db.shopSettings.upsert({
      where: { shop },
      create: {
        shop,
        storeName: shop,
        storeUrl: `https://${shop}`,
        customersSyncInProgress: true,
        customersInitialSynced: false,
      },
      update: {
        customersSyncInProgress: true,
        updatedAt: new Date(),
      },
    });

    // Create sync service
    const syncService = new CustomerSyncServiceV2(admin, {
      shop,
      batchSize: 50,
      onProgress: (progress) => {
        console.log(
          `[Background Sync] Progress: ${progress.processed} customers processed ` +
          `(${progress.successful} successful, ${progress.failed} failed)`
        );
      },
    });

    // Run the sync
    const result = await syncService.syncAllCustomers();

    if (result.success) {
      console.log(
        `[Background Sync] ✅ Customer sync completed for ${shop}: ` +
        `${result.successful} customers synced`
      );

      // Mark sync as completed
      await db.shopSettings.update({
        where: { shop },
        data: {
          customersInitialSynced: true,
          customersSyncInProgress: false,
          updatedAt: new Date(),
        },
      });
    } else {
      console.error(
        `[Background Sync] ❌ Customer sync failed for ${shop}: ${result.message}`
      );

      // Mark sync as failed but not in progress
      await db.shopSettings.update({
        where: { shop },
        data: {
          customersSyncInProgress: false,
          updatedAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error(`[Background Sync] ❌ Error during customer sync for ${shop}:`, error);

    // Mark sync as failed
    try {
      await db.shopSettings.update({
        where: { shop },
        data: {
          customersSyncInProgress: false,
          updatedAt: new Date(),
        },
      });
    } catch (dbError) {
      console.error(`[Background Sync] Failed to update sync status:`, dbError);
    }
  }
}
