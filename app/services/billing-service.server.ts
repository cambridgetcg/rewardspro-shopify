/**
 * Billing Service
 * Handles billing plan checks, feature gating, and usage limits
 */

import db from "../db.server";
import {
  getCurrentPlan,
  hasFeature,
  getLimit,
  isWithinLimit,
  getUpgradeMessage,
  isPlanAtLeast,
  type PlanName,
  type FeatureName,
} from "../utils/plan-limits";
import { FREE_PLAN } from "../shopify.server";

export interface BillingStatus {
  currentPlan: PlanName;
  isActive: boolean;
  features: Record<FeatureName, boolean>;
  limits: {
    tiers: { current: number; max: number; remaining: number };
    customers: { current: number; max: number; remaining: number };
    orders: { current: number; max: number; remaining: number };
  };
}

/**
 * Get billing status for a shop
 */
export async function getBillingStatus(shop: string): Promise<BillingStatus> {
  // Fetch billing data
  const [billingPlan, billingSubscription, tierCount, customerCount, orderCount] =
    await Promise.all([
      db.billingPlan.findUnique({ where: { shop } }),
      db.billingSubscription.findUnique({ where: { shop } }),
      db.tier.count({ where: { shop } }),
      db.customer.count({ where: { shop } }),
      db.order.count({ where: { shop } }),
    ]);

  // Determine current plan
  const currentPlan = getCurrentPlan(billingPlan, billingSubscription);

  // Check if plan is active
  const isActive =
    billingSubscription?.subscriptionStatus === "ACTIVE" ||
    billingPlan?.status === "active" ||
    currentPlan === FREE_PLAN;

  // Get all feature flags
  const features = {
    maxTiers: getLimit(currentPlan, "maxTiers") as number,
    maxCustomers: getLimit(currentPlan, "maxCustomers") as number,
    maxOrders: getLimit(currentPlan, "maxOrders") as number,
    customEmail: hasFeature(currentPlan, "customEmail"),
    apiAccess: hasFeature(currentPlan, "apiAccess"),
    advancedReporting: hasFeature(currentPlan, "advancedReporting"),
    exportData: hasFeature(currentPlan, "exportData"),
    customBranding: hasFeature(currentPlan, "customBranding"),
    prioritySupport: hasFeature(currentPlan, "prioritySupport"),
    dedicatedManager: hasFeature(currentPlan, "dedicatedManager"),
    subscriptionTiers: hasFeature(currentPlan, "subscriptionTiers"),
    purchasableTiers: hasFeature(currentPlan, "purchasableTiers"),
    lifetimeTiers: hasFeature(currentPlan, "lifetimeTiers"),
    emailNotifications: hasFeature(currentPlan, "emailNotifications"),
    customEmailTemplates: hasFeature(currentPlan, "customEmailTemplates"),
    whiteLabel: hasFeature(currentPlan, "whiteLabel"),
    webhookIntegrations: hasFeature(currentPlan, "webhookIntegrations"),
    customRewards: hasFeature(currentPlan, "customRewards"),
    bulkOperations: hasFeature(currentPlan, "bulkOperations"),
  } as Record<FeatureName, boolean>;

  // Calculate limits
  const maxTiers = getLimit(currentPlan, "maxTiers") as number;
  const maxCustomers = getLimit(currentPlan, "maxCustomers") as number;
  const maxOrders = getLimit(currentPlan, "maxOrders") as number;

  return {
    currentPlan,
    isActive,
    features,
    limits: {
      tiers: {
        current: tierCount,
        max: maxTiers,
        remaining: maxTiers === Infinity ? Infinity : Math.max(0, maxTiers - tierCount),
      },
      customers: {
        current: customerCount,
        max: maxCustomers,
        remaining:
          maxCustomers === Infinity ? Infinity : Math.max(0, maxCustomers - customerCount),
      },
      orders: {
        current: orderCount,
        max: maxOrders,
        remaining: maxOrders === Infinity ? Infinity : Math.max(0, maxOrders - orderCount),
      },
    },
  };
}

/**
 * Check if a feature is available for a shop
 */
export async function canUseFeature(shop: string, feature: FeatureName): Promise<boolean> {
  const status = await getBillingStatus(shop);
  return status.features[feature] === true;
}

/**
 * Check if shop can create more items (tiers/customers/orders)
 */
export async function canCreateMore(
  shop: string,
  type: "tiers" | "customers" | "orders"
): Promise<{ allowed: boolean; message?: string }> {
  const status = await getBillingStatus(shop);
  const limit = status.limits[type];

  if (limit.remaining === Infinity || limit.remaining > 0) {
    return { allowed: true };
  }

  const upgradeMsg = getUpgradeMessage(
    type === "tiers" ? "maxTiers" : type === "customers" ? "maxCustomers" : "maxOrders"
  );

  return {
    allowed: false,
    message: `You've reached your plan limit of ${limit.max} ${type}. ${upgradeMsg}`,
  };
}

/**
 * Require a feature or throw error
 */
export async function requireFeature(shop: string, feature: FeatureName): Promise<void> {
  const hasAccess = await canUseFeature(shop, feature);
  if (!hasAccess) {
    const message = getUpgradeMessage(feature);
    throw new Error(message);
  }
}

/**
 * Require minimum plan or throw error
 */
export async function requirePlan(shop: string, minimumPlan: PlanName): Promise<void> {
  const status = await getBillingStatus(shop);

  if (!isPlanAtLeast(status.currentPlan, minimumPlan)) {
    throw new Error(`This feature requires ${minimumPlan} or higher plan`);
  }
}

/**
 * Get feature gate component data (for UI)
 */
export async function getFeatureGateData(shop: string, feature: FeatureName) {
  const status = await getBillingStatus(shop);
  const hasAccess = status.features[feature] === true;

  return {
    hasAccess,
    currentPlan: status.currentPlan,
    upgradeMessage: hasAccess ? null : getUpgradeMessage(feature),
    isActive: status.isActive,
  };
}

/**
 * Check if shop has active subscription
 */
export async function hasActiveSubscription(shop: string): Promise<boolean> {
  const status = await getBillingStatus(shop);
  return status.isActive && status.currentPlan !== FREE_PLAN;
}

/**
 * Get usage percentage for a limit
 */
export async function getUsagePercentage(
  shop: string,
  type: "tiers" | "customers" | "orders"
): Promise<number> {
  const status = await getBillingStatus(shop);
  const limit = status.limits[type];

  if (limit.max === Infinity) return 0;
  if (limit.max === 0) return 100;

  return Math.round((limit.current / limit.max) * 100);
}
