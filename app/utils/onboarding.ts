import db from "~/db.server";

/**
 * Update onboarding progress for a shop
 */
export async function updateOnboardingProgress(
  shop: string,
  updates: {
    syncedOrders?: boolean;
    createdTiers?: boolean;
    syncedCustomers?: boolean;
    configuredSettings?: boolean;
  }
) {
  try {
    // Get current onboarding state
    const shopSettings = await db.shopSettings.findUnique({
      where: { shop },
      select: {
        onboardingSyncedOrders: true,
        onboardingCreatedTiers: true,
        onboardingSyncedCustomers: true,
        onboardingConfiguredSettings: true,
        onboardingCompleted: true,
      },
    });

    if (!shopSettings) {
      console.warn(`[Onboarding] Shop settings not found for ${shop}`);
      return;
    }

    // Merge updates with current state
    const updatedState = {
      onboardingSyncedOrders: updates.syncedOrders ?? shopSettings.onboardingSyncedOrders,
      onboardingCreatedTiers: updates.createdTiers ?? shopSettings.onboardingCreatedTiers,
      onboardingSyncedCustomers: updates.syncedCustomers ?? shopSettings.onboardingSyncedCustomers,
      onboardingConfiguredSettings: updates.configuredSettings ?? shopSettings.onboardingConfiguredSettings,
    };

    // Check if all steps are complete
    const allComplete =
      updatedState.onboardingSyncedOrders &&
      updatedState.onboardingCreatedTiers &&
      updatedState.onboardingSyncedCustomers &&
      updatedState.onboardingConfiguredSettings;

    // Update database
    await db.shopSettings.update({
      where: { shop },
      data: {
        ...updatedState,
        onboardingCompleted: allComplete,
      },
    });

    console.log(`[Onboarding] Updated progress for ${shop}:`, {
      ...updatedState,
      completed: allComplete,
    });
  } catch (error) {
    console.error(`[Onboarding] Error updating progress for ${shop}:`, error);
  }
}

/**
 * Check and mark orders as synced if orders exist
 */
export async function checkOrdersSynced(shop: string) {
  try {
    const orderCount = await db.order.count({
      where: { shop },
    });

    if (orderCount > 0) {
      await updateOnboardingProgress(shop, { syncedOrders: true });
    }
  } catch (error) {
    console.error(`[Onboarding] Error checking orders for ${shop}:`, error);
  }
}

/**
 * Check and mark tiers as created if tiers exist
 */
export async function checkTiersCreated(shop: string) {
  try {
    const tierCount = await db.tier.count({
      where: { shop },
    });

    if (tierCount > 0) {
      await updateOnboardingProgress(shop, { createdTiers: true });
    }
  } catch (error) {
    console.error(`[Onboarding] Error checking tiers for ${shop}:`, error);
  }
}

/**
 * Check and mark customers as synced if customers exist
 */
export async function checkCustomersSynced(shop: string) {
  try {
    const customerCount = await db.customer.count({
      where: { shop },
    });

    if (customerCount > 0) {
      await updateOnboardingProgress(shop, { syncedCustomers: true });
    }
  } catch (error) {
    console.error(`[Onboarding] Error checking customers for ${shop}:`, error);
  }
}

/**
 * Check and mark settings as configured
 * Settings are considered configured if currency is set
 */
export async function checkSettingsConfigured(shop: string) {
  try {
    const shopSettings = await db.shopSettings.findUnique({
      where: { shop },
      select: {
        storeCurrency: true,
        storeName: true,
      },
    });

    // Consider settings configured if we have both currency and store name
    if (shopSettings?.storeCurrency && shopSettings?.storeName) {
      await updateOnboardingProgress(shop, { configuredSettings: true });
    }
  } catch (error) {
    console.error(`[Onboarding] Error checking settings for ${shop}:`, error);
  }
}

/**
 * Check all onboarding steps and update progress
 * Call this periodically or after major operations
 */
export async function checkAllOnboardingSteps(shop: string) {
  await Promise.all([
    checkOrdersSynced(shop),
    checkTiersCreated(shop),
    checkCustomersSynced(shop),
    checkSettingsConfigured(shop),
  ]);
}
