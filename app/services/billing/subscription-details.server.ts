/**
 * Subscription Details Service
 *
 * Fetches detailed subscription information using GraphQL Admin API
 * including line items, pricing details, usage balance, and trial information.
 */

import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

export interface SubscriptionLineItem {
  id: string;
  plan: {
    pricingDetails: AppRecurringPricing | AppUsagePricing;
  };
}

export interface AppRecurringPricing {
  __typename: "AppRecurringPricing";
  interval: "EVERY_30_DAYS" | "ANNUAL";
  price: {
    amount: string;
    currencyCode: string;
  };
  discount: {
    durationLimitInIntervals: number;
    priceAfterDiscount: {
      amount: string;
      currencyCode: string;
    };
    remainingDurationInIntervals: number;
    value: AppSubscriptionDiscountValue;
  } | null;
}

export interface AppUsagePricing {
  __typename: "AppUsagePricing";
  balanceUsed: {
    amount: string;
    currencyCode: string;
  };
  cappedAmount: {
    amount: string;
    currencyCode: string;
  };
  interval: "EVERY_30_DAYS" | "ANNUAL";
  terms: string;
}

export type AppSubscriptionDiscountValue =
  | {
      __typename: "AppSubscriptionDiscountAmount";
      amount: {
        amount: string;
        currencyCode: string;
      };
    }
  | {
      __typename: "AppSubscriptionDiscountPercentage";
      percentage: number;
    };

export interface DetailedSubscription {
  id: string;
  name: string;
  status: "ACTIVE" | "DECLINED" | "EXPIRED" | "FROZEN" | "PENDING" | "CANCELLED";
  test: boolean;
  trialDays: number;
  createdAt: string;
  currentPeriodEnd: string | null;
  returnUrl: string;
  lineItems: SubscriptionLineItem[];
}

export interface SubscriptionDetailsResponse {
  currentAppInstallation: {
    id: string;
    activeSubscriptions: DetailedSubscription[];
    allSubscriptions: {
      edges: Array<{
        node: {
          id: string;
          name: string;
          status: string;
          createdAt: string;
          currentPeriodEnd: string | null;
          test: boolean;
        };
      }>;
    };
  };
}

/**
 * Fetch detailed subscription information for the current app installation
 */
export async function getSubscriptionDetails(
  admin: AdminApiContext
): Promise<SubscriptionDetailsResponse | null> {
  const query = `
    query GetSubscriptionDetails {
      currentAppInstallation {
        id
        activeSubscriptions {
          id
          name
          status
          test
          trialDays
          createdAt
          currentPeriodEnd
          returnUrl
          lineItems {
            id
            plan {
              pricingDetails {
                __typename
                ... on AppRecurringPricing {
                  interval
                  price {
                    amount
                    currencyCode
                  }
                  discount {
                    durationLimitInIntervals
                    priceAfterDiscount {
                      amount
                      currencyCode
                    }
                    remainingDurationInIntervals
                    value {
                      ... on AppSubscriptionDiscountAmount {
                        amount {
                          amount
                          currencyCode
                        }
                      }
                      ... on AppSubscriptionDiscountPercentage {
                        percentage
                      }
                    }
                  }
                }
                ... on AppUsagePricing {
                  balanceUsed {
                    amount
                    currencyCode
                  }
                  cappedAmount {
                    amount
                    currencyCode
                  }
                  interval
                  terms
                }
              }
            }
          }
        }
        allSubscriptions(first: 10) {
          edges {
            node {
              id
              name
              status
              createdAt
              currentPeriodEnd
              test
            }
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(query);
    const data = await response.json();

    if (data.errors) {
      console.error("[Subscription Details] GraphQL errors:", data.errors);
      return null;
    }

    return data.data as SubscriptionDetailsResponse;
  } catch (error) {
    console.error("[Subscription Details] Error fetching subscription details:", error);
    return null;
  }
}

/**
 * Extract usage line item from subscription
 */
export function getUsageLineItem(subscription: DetailedSubscription): SubscriptionLineItem | null {
  return subscription.lineItems.find(
    (item) => item.plan.pricingDetails.__typename === "AppUsagePricing"
  ) || null;
}

/**
 * Extract recurring line item from subscription
 */
export function getRecurringLineItem(subscription: DetailedSubscription): SubscriptionLineItem | null {
  return subscription.lineItems.find(
    (item) => item.plan.pricingDetails.__typename === "AppRecurringPricing"
  ) || null;
}

/**
 * Calculate usage percentage
 */
export function calculateUsagePercentage(usageLineItem: SubscriptionLineItem | null): number {
  if (!usageLineItem) return 0;

  const pricingDetails = usageLineItem.plan.pricingDetails;
  if (pricingDetails.__typename !== "AppUsagePricing") return 0;

  const used = parseFloat(pricingDetails.balanceUsed.amount);
  const cap = parseFloat(pricingDetails.cappedAmount.amount);

  if (cap === 0) return 0;

  return Math.round((used / cap) * 100);
}

/**
 * Check if subscription is in trial period
 */
export function isInTrialPeriod(subscription: DetailedSubscription): boolean {
  if (subscription.trialDays === 0) return false;

  const createdAt = new Date(subscription.createdAt);
  const trialEndDate = new Date(createdAt.getTime() + subscription.trialDays * 24 * 60 * 60 * 1000);

  return new Date() < trialEndDate;
}

/**
 * Get remaining trial days
 */
export function getRemainingTrialDays(subscription: DetailedSubscription): number {
  if (!isInTrialPeriod(subscription)) return 0;

  const createdAt = new Date(subscription.createdAt);
  const trialEndDate = new Date(createdAt.getTime() + subscription.trialDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  const remainingMs = trialEndDate.getTime() - now.getTime();
  const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

  return Math.max(0, remainingDays);
}
