/**
 * Subscription Persistence Service
 *
 * Handles database operations for Shopify app subscriptions (Pro, Max, Ultra plans).
 * Provides CRUD operations and webhook-based updates for subscription status tracking.
 */

import { db } from "~/db.server";
import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

/**
 * Shopify AppSubscription type (from GraphQL)
 */
export interface ShopifyAppSubscription {
  id: string; // gid://shopify/AppSubscription/123
  name: string; // "RewardsPro Pro"
  status: string; // ACTIVE, CANCELLED, EXPIRED, PENDING
  test: boolean;
  trialDays: number | null;
  createdAt: string;
  currentPeriodEnd: string | null;
  lineItems: Array<{
    id: string;
    plan: {
      pricingDetails: {
        __typename: string;
        interval?: string;
        price?: {
          amount: string;
          currencyCode: string;
        };
        balanceUsed?: {
          amount: string;
          currencyCode: string;
        };
        cappedAmount?: {
          amount: string;
          currencyCode: string;
        };
        terms?: string;
      };
    };
  }>;
}

/**
 * Save or update subscription in database
 *
 * @param shop - Shop domain
 * @param subscription - Shopify subscription data from GraphQL
 * @returns Saved subscription record
 */
export async function saveSubscription(
  shop: string,
  subscription: ShopifyAppSubscription
) {
  console.log('[Subscription Persistence] Saving subscription:', {
    shop,
    subscriptionId: subscription.id,
    name: subscription.name,
    status: subscription.status,
  });

  // Extract charge ID from GID
  const chargeId = subscription.id.split('/').pop() || null;

  // Find recurring line item
  const recurringLineItem = subscription.lineItems.find(
    item => item.plan.pricingDetails.__typename === 'AppRecurringPricing'
  );

  // Find usage line item
  const usageLineItem = subscription.lineItems.find(
    item => item.plan.pricingDetails.__typename === 'AppUsagePricing'
  );

  // Extract recurring pricing details
  const recurringPricing = recurringLineItem?.plan.pricingDetails.__typename === 'AppRecurringPricing'
    ? recurringLineItem.plan.pricingDetails
    : null;

  // Extract usage pricing details
  const usagePricing = usageLineItem?.plan.pricingDetails.__typename === 'AppUsagePricing'
    ? usageLineItem.plan.pricingDetails
    : null;

  // Calculate trial end date
  let trialEndsAt = null;
  if (subscription.trialDays && subscription.createdAt) {
    const created = new Date(subscription.createdAt);
    trialEndsAt = new Date(created.getTime() + subscription.trialDays * 24 * 60 * 60 * 1000);
  }

  // Prepare subscription data for upsert
  const subscriptionData = {
    shop,
    shopifySubscriptionId: subscription.id,
    chargeId: chargeId,
    planName: subscription.name,
    status: subscription.status,
    test: subscription.test || false,
    trialDays: subscription.trialDays || null,
    trialEndsAt,
    recurringAmount: recurringPricing?.price?.amount ? parseFloat(recurringPricing.price.amount) : null,
    recurringCurrency: recurringPricing?.price?.currencyCode || null,
    recurringInterval: recurringPricing?.interval || null,
    usageCap: usagePricing?.cappedAmount?.amount ? parseFloat(usagePricing.cappedAmount.amount) : null,
    usageCurrency: usagePricing?.cappedAmount?.currencyCode || null,
    usageTerms: usagePricing?.terms || null,
    usageBalanceUsed: usagePricing?.balanceUsed?.amount ? parseFloat(usagePricing.balanceUsed.amount) : null,
    currentPeriodEnd: subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null,
    updatedAt: new Date(),
  };

  // Upsert subscription (create if doesn't exist, update if exists)
  const saved = await db.appSubscription.upsert({
    where: {
      shop,
    },
    create: {
      ...subscriptionData,
      activatedAt: subscription.status === 'ACTIVE' ? new Date() : null,
      returnUrlProcessed: true,
      returnUrlProcessedAt: new Date(),
    },
    update: subscriptionData,
  });

  console.log('[Subscription Persistence] ✅ Subscription saved:', {
    id: saved.id,
    shop: saved.shop,
    planName: saved.planName,
    status: saved.status,
    trialDays: saved.trialDays,
    recurringAmount: saved.recurringAmount,
    usageCap: saved.usageCap,
  });

  // Update shop settings with current plan
  await db.shopSettings.upsert({
    where: { shop },
    create: {
      shop,
      storeName: shop, // Default to shop domain
      storeUrl: `https://${shop}`,
      currentPlanName: subscription.name,
      subscriptionStatus: subscription.status,
      subscriptionUpdatedAt: new Date(),
    },
    update: {
      currentPlanName: subscription.name,
      subscriptionStatus: subscription.status,
      subscriptionUpdatedAt: new Date(),
    },
  });

  console.log('[Subscription Persistence] ✅ Shop settings updated');

  return saved;
}

/**
 * Get active subscription for a shop
 *
 * @param shop - Shop domain
 * @returns Active subscription or null
 */
export async function getActiveSubscription(shop: string) {
  console.log('[Subscription Persistence] Fetching active subscription for:', shop);

  const subscription = await db.appSubscription.findFirst({
    where: {
      shop,
      status: 'ACTIVE',
    },
  });

  if (subscription) {
    console.log('[Subscription Persistence] ✅ Found active subscription:', {
      id: subscription.id,
      planName: subscription.planName,
      status: subscription.status,
    });
  } else {
    console.log('[Subscription Persistence] ℹ️  No active subscription found');
  }

  return subscription;
}

/**
 * Get subscription by shop (any status)
 *
 * @param shop - Shop domain
 * @returns Subscription or null
 */
export async function getSubscriptionByShop(shop: string) {
  console.log('[Subscription Persistence] Fetching subscription for:', shop);

  return await db.appSubscription.findUnique({
    where: { shop },
  });
}

/**
 * Get subscription by Shopify subscription ID
 *
 * @param shopifySubscriptionId - Full Shopify GID
 * @returns Subscription or null
 */
export async function getSubscriptionById(shopifySubscriptionId: string) {
  console.log('[Subscription Persistence] Fetching subscription by ID:', shopifySubscriptionId);

  return await db.appSubscription.findUnique({
    where: { shopifySubscriptionId },
  });
}

/**
 * Cancel subscription
 *
 * @param shop - Shop domain
 * @param reason - Cancellation reason (optional)
 * @returns Updated subscription
 */
export async function cancelSubscription(
  shop: string,
  reason?: string
) {
  console.log('[Subscription Persistence] Cancelling subscription for:', shop);

  const updated = await db.appSubscription.update({
    where: { shop },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: reason || null,
      updatedAt: new Date(),
    },
  });

  console.log('[Subscription Persistence] ✅ Subscription cancelled');

  // Update shop settings
  await db.shopSettings.update({
    where: { shop },
    data: {
      subscriptionStatus: 'CANCELLED',
      subscriptionUpdatedAt: new Date(),
    },
  });

  return updated;
}

/**
 * Update subscription from webhook
 *
 * @param shop - Shop domain
 * @param webhookData - Webhook payload data
 * @returns Updated subscription
 */
export async function updateSubscriptionFromWebhook(
  shop: string,
  webhookData: {
    status?: string;
    currentPeriodEnd?: string;
    usageBalanceUsed?: number;
    metadata?: any;
  }
) {
  console.log('[Subscription Persistence] Updating subscription from webhook:', {
    shop,
    status: webhookData.status,
  });

  const updateData: any = {
    lastWebhookUpdate: new Date(),
    webhookUpdateCount: {
      increment: 1,
    },
    updatedAt: new Date(),
  };

  if (webhookData.status) {
    updateData.status = webhookData.status;

    // If status changed to CANCELLED, record cancellation timestamp
    if (webhookData.status === 'CANCELLED') {
      updateData.cancelledAt = new Date();
    }
  }

  if (webhookData.currentPeriodEnd) {
    updateData.currentPeriodEnd = new Date(webhookData.currentPeriodEnd);
  }

  if (webhookData.usageBalanceUsed !== undefined) {
    updateData.usageBalanceUsed = webhookData.usageBalanceUsed;
  }

  if (webhookData.metadata) {
    updateData.metadata = webhookData.metadata;
  }

  const updated = await db.appSubscription.update({
    where: { shop },
    data: updateData,
  });

  console.log('[Subscription Persistence] ✅ Subscription updated from webhook');

  // Update shop settings
  await db.shopSettings.update({
    where: { shop },
    data: {
      subscriptionStatus: webhookData.status || updated.status,
      subscriptionUpdatedAt: new Date(),
    },
  });

  return updated;
}

/**
 * Check if shop has active subscription
 *
 * @param shop - Shop domain
 * @returns True if shop has active subscription
 */
export async function hasActiveSubscription(shop: string): Promise<boolean> {
  const count = await db.appSubscription.count({
    where: {
      shop,
      status: 'ACTIVE',
    },
  });

  return count > 0;
}

/**
 * Check if shop is in trial period
 *
 * @param shop - Shop domain
 * @returns True if shop is in trial period
 */
export async function isInTrialPeriod(shop: string): Promise<boolean> {
  const subscription = await db.appSubscription.findFirst({
    where: {
      shop,
      status: 'ACTIVE',
    },
  });

  if (!subscription || !subscription.trialEndsAt) {
    return false;
  }

  return new Date() < subscription.trialEndsAt;
}

/**
 * Get days remaining in trial
 *
 * @param shop - Shop domain
 * @returns Days remaining or 0 if not in trial
 */
export async function getTrialDaysRemaining(shop: string): Promise<number> {
  const subscription = await db.appSubscription.findFirst({
    where: {
      shop,
      status: 'ACTIVE',
    },
  });

  if (!subscription || !subscription.trialEndsAt) {
    return 0;
  }

  const now = new Date();
  const trialEnd = subscription.trialEndsAt;

  if (now >= trialEnd) {
    return 0;
  }

  const diffMs = trialEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}
