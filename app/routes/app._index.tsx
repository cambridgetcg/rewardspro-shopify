import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState, useCallback, useEffect } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Icon,
  Box,
  Badge,
  Divider,
  EmptyState,
  DataTable,
  Grid,
  ProgressBar,
  Tabs,
  Banner,
  Select,
} from "@shopify/polaris";
import {
  PlusIcon,
  RefreshIcon,
  AlertTriangleIcon,
  PersonIcon,
  CashDollarIcon,
  RewardIcon,
  ChartVerticalIcon,
  CheckCircleIcon,
  InfoIcon,
} from "~/utils/polaris-icons";
import {
  StatsOverview,
  EnhancedDataTable,
  ActionBanner,
} from "../components/DesignSystem";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { formatCurrency } from "../utils/currency";
import { TierBadge } from "../components/TierBadge";
import {
  getTierStyle,
  sortTiersByPriority
} from "../utils/tier-styles";
import { CurrentPlanCard } from "~/components/Billing";
import { MANAGED_PLANS } from "~/constants/billing.constants";
import { countOrdersWithFallback, countOrdersDateExtraction, getOrCreateMonthlyCount } from "~/utils/order-count-strategies";

// ============================================
// CONSTANTS
// ============================================

// Note: MANAGED_PLANS is now imported from ~/constants/billing.constants
// Keeping old version for reference only
const OLD_MANAGED_PLANS = {
  "RewardsPro Free": {
    name: "RewardsPro Free",
    displayName: "Free",
    price: 0,
    interval: "month",
    ordersIncluded: 200,
    overageRate: 0,
    features: [
      "200 orders per month",
      "All core features included",
      "Unlimited loyalty tiers",
      "Customer management",
      "Store credit tracking",
      "Basic analytics",
      "No credit card required",
      "Community support",
    ],
    recommended: false,
    isFree: true,
  },
  "RewardsPro Monthly": {
    name: "RewardsPro Monthly",
    displayName: "Pro",
    price: 49,
    interval: "month",
    ordersIncluded: 1000,
    overageRate: 0.01,
    features: [
      "1,000 orders included",
      "$0.01 per additional order",
      "Unlimited loyalty tiers",
      "Advanced analytics",
      "Custom email templates",
      "Priority support",
      "API access",
      "Webhook integrations",
    ],
    recommended: true,
    isFree: false,
  },
  "RewardsPro Annual": {
    name: "RewardsPro Annual",
    displayName: "Enterprise",
    price: 490,
    interval: "annual",
    ordersIncluded: 12000,
    overageRate: 0.008,
    features: [
      "12,000 orders included",
      "$0.008 per additional order",
      "All Pro features",
      "Annual billing (save $98)",
      "Dedicated support",
      "Custom integrations",
      "Advanced reporting",
      "White-label options",
    ],
    recommended: false,
    isFree: false,
  },
};

const CURRENCY_OPTIONS = [
  { label: "🇺🇸 US Dollar (USD)", value: "USD" },
  { label: "🇪🇺 Euro (EUR)", value: "EUR" },
  { label: "🇬🇧 British Pound (GBP)", value: "GBP" },
  { label: "🇨🇦 Canadian Dollar (CAD)", value: "CAD" },
  { label: "🇦🇺 Australian Dollar (AUD)", value: "AUD" },
  { label: "🇯🇵 Japanese Yen (JPY)", value: "JPY" },
  { label: "🇨🇭 Swiss Franc (CHF)", value: "CHF" },
  { label: "🇨🇳 Chinese Yuan (CNY)", value: "CNY" },
  { label: "🇸🇪 Swedish Krona (SEK)", value: "SEK" },
  { label: "🇳🇿 New Zealand Dollar (NZD)", value: "NZD" },
  { label: "🇳🇴 Norwegian Krone (NOK)", value: "NOK" },
  { label: "🇲🇽 Mexican Peso (MXN)", value: "MXN" },
  { label: "🇸🇬 Singapore Dollar (SGD)", value: "SGD" },
  { label: "🇭🇰 Hong Kong Dollar (HKD)", value: "HKD" },
  { label: "🇰🇷 South Korean Won (KRW)", value: "KRW" },
  { label: "🇹🇷 Turkish Lira (TRY)", value: "TRY" },
  { label: "🇮🇳 Indian Rupee (INR)", value: "INR" },
  { label: "🇷🇺 Russian Ruble (RUB)", value: "RUB" },
  { label: "🇧🇷 Brazilian Real (BRL)", value: "BRL" },
  { label: "🇿🇦 South African Rand (ZAR)", value: "ZAR" },
  { label: "🇦🇪 UAE Dirham (AED)", value: "AED" },
  { label: "🇵🇱 Polish Zloty (PLN)", value: "PLN" },
  { label: "🇩🇰 Danish Krone (DKK)", value: "DKK" },
  { label: "🇹🇭 Thai Baht (THB)", value: "THB" },
  { label: "🇮🇩 Indonesian Rupiah (IDR)", value: "IDR" },
  { label: "🇭🇺 Hungarian Forint (HUF)", value: "HUF" },
  { label: "🇨🇿 Czech Koruna (CZK)", value: "CZK" },
  { label: "🇮🇱 Israeli Shekel (ILS)", value: "ILS" },
  { label: "🇨🇱 Chilean Peso (CLP)", value: "CLP" },
  { label: "🇵🇭 Philippine Peso (PHP)", value: "PHP" },
  { label: "🇷🇴 Romanian Leu (RON)", value: "RON" },
  { label: "🇲🇾 Malaysian Ringgit (MYR)", value: "MYR" },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatTransactionType = (type: string): string => {
  const typeMap: Record<string, string> = {
    'CASHBACK_EARNED': 'Cashback Earned',
    'ORDER_PAYMENT': 'Order Payment',
    'REFUND_CREDIT': 'Refund Credit',
    'MANUAL_ADJUSTMENT': 'Manual Adjustment',
    'SHOPIFY_SYNC': 'Shopify Sync',
    'ADMIN_ADJUSTMENT': 'Admin Adjustment',
    'TIER_BONUS': 'Tier Bonus',
  };

  return typeMap[type] || type.replace(/_/g, ' ').toLowerCase();
};

const getCurrentMonthName = (): string => {
  return new Date().toLocaleDateString('en-US', { month: 'long' });
};

const calculateDaysRemaining = (): number => {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

const calculateProjectedOrders = (currentOrders: number, daysRemaining: number): number => {
  const now = new Date();
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = totalDaysInMonth - daysRemaining;

  if (daysPassed === 0) return currentOrders;

  const dailyRate = currentOrders / daysPassed;
  return Math.ceil(dailyRate * totalDaysInMonth);
};

// ============================================
// TYPE DEFINITIONS
// ============================================

interface DashboardData {
  shop: string;
  metrics: {
    totalCustomers: number;
    totalStoreCredit: number;
    activeTiers: number;
    averageCredit: number;
    customersWithCredit: number;
    customersWithTiers: number;
  };
  tierDistribution: Array<{
    id: string;
    name: string;
    count: number;
    percentage: number;
    cashbackPercent: number;
    totalCredit: number;
    minSpend: number;
  }>;
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    balance: number;
    customerEmail: string;
    createdAt: string;
    metadata: any;
  }>;
  topCustomers: Array<{
    id: string;
    email: string;
    storeCredit: number;
    tierName: string | null;
  }>;
  setupComplete: boolean;
  shopSettings: {
    storeCurrency: string;
    currencyDisplayType: string;
    customersInitialSynced?: boolean;
    customersSyncInProgress?: boolean;
    currencySelected?: boolean;
  } | null;
  // Billing data
  currentPlan: any | null;
  activeSubscription: any;
  monthlyOrderUsage: {
    orderCount: number;
    planLimit: number;
    planName: string;
    projectedOrders: number;
  } | null;
  currentMonth: string;
  daysRemaining: number;
  // Widget detection
  hasWidget: boolean;
  widgetDetectionMethod: string;
  widgetDismissed: boolean;
  hasCustomerAccountBlock: boolean;
  customerAccountBlockDismissed: boolean;
}

// ============================================
// LOADER - Fetch dashboard data
// ============================================

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session, billing, admin } = await authenticate.admin(request);

    if (!session?.shop) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const shop = session.shop;
    console.log(`[Dashboard] Loading data for shop: ${shop}`);

    // Check if this is a redirect back from completed onboarding
    const url = new URL(request.url);
    const onboardingParam = url.searchParams.get("onboarding");

    // Check active subscription with Shopify
    let activeSubscription = null;
    const { FREE_PLAN, PRO_PLAN, MAX_PLAN, ULTRA_PLAN } = await import("../shopify.server");

    if (billing) {
      try {
        const { hasActivePayment, appSubscriptions } = await billing.check({
          plans: [FREE_PLAN, PRO_PLAN, MAX_PLAN, ULTRA_PLAN],
          isTest: process.env.NODE_ENV === 'development',
        });

        if (hasActivePayment && appSubscriptions?.length > 0) {
          activeSubscription = appSubscriptions[0];
        }
      } catch (error) {
        console.error("[Dashboard] Error checking subscription:", error);
      }
    }

    // STEP 1: Fetch shop settings ONCE (reused everywhere)
    // This avoids duplicate queries and ensures consistent data
    const shopSettings = await db.shopSettings.findUnique({
      where: { shop },
      select: {
        storeCurrency: true,
        currencyDisplayType: true,
        customersInitialSynced: true,
        customersSyncInProgress: true,
        currencySelected: true,
        widgetLastHeartbeat: true,
        widgetIsActive: true,
        widgetSetupDismissed: true,
        customerAccountBlockDismissed: true,
        customerAccountBlockLastHeartbeat: true,
        customerAccountBlockIsActive: true,
      }
    });

    // Extract flags (dismissal is SEPARATE from detection)
    const widgetDismissed = shopSettings?.widgetSetupDismissed || false;
    const customerAccountBlockDismissed = shopSettings?.customerAccountBlockDismissed || false;

    // Widget detection - PROPER SEPARATION OF CONCERNS:
    // 1. Dismissal flag is ONLY for UI (suppress banner)
    // 2. Detection runs regardless of dismissal state
    // 3. Cache last known status for fallback
    // 4. Check both theme settings AND heartbeat
    // 5. hasWidget = true ONLY if actually detected (not just dismissed)
    let hasWidget = false;
    let widgetDetectionMethod = "none";

    try {
      console.log("[Dashboard] Starting widget detection...");

      // Run GraphQL theme detection
      // Check both current.blocks AND current.enabled_app_embeds
      let detectedInTheme = false;
      const cachedStatus = shopSettings?.widgetIsActive || false;

      try {
        // Step 1: Get the main (published) theme
        const themeQuery = `#graphql
          query {
            themes(first: 1, roles: MAIN) {
              nodes {
                id
                name
                role
              }
            }
          }
        `;

        const themeResponse = await admin.graphql(themeQuery);
        const themeData = await themeResponse.json();
        const mainTheme = themeData?.data?.themes?.nodes?.[0];

        if (mainTheme?.id) {
          console.log(`[Dashboard] Main theme: ${mainTheme.name} (${mainTheme.id})`);

          // Step 2: Fetch config/settings_data.json using GraphQL
          const settingsQuery = `#graphql
            query getSettings($themeId: ID!) {
              theme(id: $themeId) {
                files(filenames: ["config/settings_data.json"], first: 1) {
                  nodes {
                    body {
                      ... on OnlineStoreThemeFileBodyText {
                        content
                      }
                    }
                  }
                }
              }
            }
          `;

          const settingsResponse = await admin.graphql(settingsQuery, {
            variables: { themeId: mainTheme.id }
          });
          const settingsData = await settingsResponse.json();
          let settingsContent = settingsData?.data?.theme?.files?.nodes?.[0]?.body?.content;

          if (settingsContent) {
            // Step 3: Parse JSON after removing Shopify's comment blocks
            // Wrap in try/catch to handle malformed JSON gracefully
            try {
              // Remove comment blocks
              settingsContent = settingsContent.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove /* */ blocks
              settingsContent = settingsContent.replace(/\/\/[^\n]*\n/g, ''); // Remove // comments

              // Additional cleanup for common JSON issues
              // Remove trailing commas before closing braces/brackets
              settingsContent = settingsContent.replace(/,(\s*[}\]])/g, '$1');

              const themeSettings = JSON.parse(settingsContent);

              // CANONICAL CHECK: current.enabled_app_embeds (Shopify's official flag)
              const enabledAppEmbeds = themeSettings.current?.enabled_app_embeds || [];
              const appHandle = 'RewardsproMembership';
              const blockHandle = 'membership_widget';
              const extensionUid = 'a58b9b10-e482-42f9-90d4-885a20081116e17dfcf9';
              const expectedType = `shopify://apps/${appHandle}/blocks/${blockHandle}/${extensionUid}`;

              // Check if our app embed is in the enabled list
              const isInEnabledList = enabledAppEmbeds.some((embed: string) =>
                embed === expectedType || embed.includes(`/apps/${appHandle}/blocks/${blockHandle}/`)
              );

              if (isInEnabledList) {
                detectedInTheme = true;
                console.log(`[Dashboard] ✓ App embed found in enabled_app_embeds`);
              }

              // FALLBACK CHECK: current.blocks (legacy detection)
              if (!detectedInTheme) {
                const blocks = themeSettings.current?.blocks || {};
                for (const [blockId, blockInfo] of Object.entries(blocks)) {
                  const block = blockInfo as any;
                  if (typeof block.type === 'string') {
                    if (block.type === expectedType ||
                        block.type.includes(`/apps/${appHandle}/blocks/${blockHandle}/`)) {
                      detectedInTheme = block.disabled !== true;
                      console.log(`[Dashboard] App embed block found in blocks: ${block.type} (enabled: ${detectedInTheme})`);
                      break;
                    }
                  }
                }
              }
            } catch (parseError) {
              console.error("[Dashboard] Failed to parse theme settings JSON:", parseError);
              console.error("[Dashboard] JSON parse failed - falling back to cached/heartbeat detection");
              // Continue to fallback detection methods
            }
          }
        }
      } catch (error: any) {
        console.error("[Dashboard] GraphQL theme detection failed:", error);

        // Check if it's a scope/authorization issue
        if (error?.message?.includes('403') ||
            error?.message?.includes('Unauthorized') ||
            error?.message?.includes('read_themes')) {
          widgetDetectionMethod = "missing-scope";
          console.warn("[Dashboard] Missing read_themes scope - merchant needs to re-authorize");
        }

        // Continue to check cache for fallback
      }

      // Determine final status with fallback logic
      let newCacheValue: boolean | null = null; // Track if cache needs update

      if (detectedInTheme) {
        hasWidget = true;
        widgetDetectionMethod = "theme";

        // Mark cache for update only if it changed
        if (!cachedStatus) {
          newCacheValue = true;
        }
      } else if (cachedStatus) {
        // Fall back to cached status if detection fails but cache says it was active
        hasWidget = true;
        widgetDetectionMethod = "cached";
        console.log(`[Dashboard] Using cached status (detection unavailable)`);
        // No cache update needed (already correct)
      } else {
        hasWidget = false;
        widgetDetectionMethod = "not-detected";

        // Mark cache for update only if it was previously true
        if (cachedStatus) {
          newCacheValue = false;
        }
      }

      // Batch cache write at the end (only if changed)
      if (newCacheValue !== null) {
        try {
          await db.shopSettings.update({
            where: { shop },
            data: { widgetIsActive: newCacheValue, updatedAt: new Date() }
          });
          console.log(`[Dashboard] Updated widget cache: ${newCacheValue}`);
        } catch (e) {
          console.error("[Dashboard] Failed to update widget cache:", e);
        }
      }

      console.log(`[Dashboard] Final widget status: ${hasWidget} (method: ${widgetDetectionMethod}, dismissed: ${widgetDismissed})`);

    } catch (error) {
      console.error("[Dashboard] Critical error in widget detection:", error);
      // Leave hasWidget = false, widgetDetectionMethod = "none"
    }

    // Check customer account block status with GraphQL detection
    // IMPORTANT: Dismissal is SEPARATE from detection
    // We track if banner was dismissed, but still need to detect if block is actually installed
    // Detection strategy: GraphQL (primary) → Cache (secondary) → Heartbeat (tertiary fallback)
    const CUSTOMER_ACCOUNT_APP_KEY = "RewardsproMembership"; // your app's key
    const CUSTOMER_ACCOUNT_TARGET = "customer-account.profile.block.render";

    let hasCustomerAccountBlock = false;
    let customerAccountDetectionReason: "graphql" | "cached" | "heartbeat" | "none" = "none";

    try {
      console.log("[Dashboard] Starting customer account block detection...");

      // PRIMARY: Try GraphQL detection first
      try {
        const query = `#graphql
          query CustomerAccountBlocks($appKey: String!) {
            customerAccountAppExtensionRegistrations(appKeys: [$appKey]) {
              nodes {
                appKey
                registration {
                  ... on CustomerAccountProfileComponentRegistration {
                    id
                    target
                    handle
                    active
                  }
                  ... on CustomerAccountProfileBlockRegistration {
                    id
                    target
                    handle
                    active
                  }
                  ... on CustomerAccountOrderStatusRegistration {
                    id
                    target
                    handle
                    active
                  }
                }
              }
            }
          }
        `;

        const result = await admin.graphql(query, {
          variables: {
            appKey: CUSTOMER_ACCOUNT_APP_KEY,
          },
        });

        const jsonResult = await result.json();
        const nodes = jsonResult?.data?.customerAccountAppExtensionRegistrations?.nodes ?? [];

        const match = nodes
          .flatMap((node: any) => node.registration ? [node.registration] : [])
          .find((registration: any) => {
            return (
              registration?.target === CUSTOMER_ACCOUNT_TARGET &&
              registration?.active === true
            );
          });

        if (match) {
          hasCustomerAccountBlock = true;
          customerAccountDetectionReason = "graphql";
          console.log(`[Dashboard] ✓ Customer account block detected via GraphQL: ${match.handle}`);

          // Update cache with positive detection (only if changed)
          if (!shopSettings?.customerAccountBlockIsActive) {
            try {
              await db.shopSettings.update({
                where: { shop },
                data: {
                  customerAccountBlockIsActive: true,
                  updatedAt: new Date(),
                },
              });
              console.log("[Dashboard] Updated customer account block cache: true");
            } catch (e) {
              console.error("[Dashboard] Failed to update customer account block cache:", e);
            }
          }
        } else {
          console.log("[Dashboard] Customer account block not found via GraphQL");
        }
      } catch (error: any) {
        console.error("[Dashboard] GraphQL customer account block detection failed:", error);

        // Check if it's a scope/authorization issue
        if (error?.message?.includes('403') ||
            error?.message?.includes('Unauthorized') ||
            error?.message?.includes('read_customer_accounts')) {
          console.warn("[Dashboard] Missing read_customer_accounts scope - merchant needs to re-authorize");
        }
      }

      // SECONDARY: Fall back to cached status if GraphQL detection failed
      if (!hasCustomerAccountBlock && shopSettings?.customerAccountBlockIsActive) {
        hasCustomerAccountBlock = true;
        customerAccountDetectionReason = "cached";
        console.log(`[Dashboard] Using cached customer account block status (GraphQL unavailable)`);
      }

      // TERTIARY: Fall back to heartbeat as last resort
      if (!hasCustomerAccountBlock && shopSettings?.customerAccountBlockLastHeartbeat) {
        const lastHeartbeat = new Date(shopSettings.customerAccountBlockLastHeartbeat);
        const now = new Date();
        const minutesSinceHeartbeat = (now.getTime() - lastHeartbeat.getTime()) / (1000 * 60);

        // Block is active if heartbeat within last 5 minutes
        if (minutesSinceHeartbeat < 5) {
          hasCustomerAccountBlock = true;
          customerAccountDetectionReason = "heartbeat";
          console.log(`[Dashboard] Customer account block detected via heartbeat fallback (${minutesSinceHeartbeat.toFixed(1)} min ago)`);
        }
      }

      console.log(`[Dashboard] Final customer account block status: ${hasCustomerAccountBlock} (method: ${customerAccountDetectionReason}, dismissed: ${customerAccountBlockDismissed})`);

    } catch (error) {
      console.error("[Dashboard] Critical error in customer account block detection:", error);
      // Leave hasCustomerAccountBlock = false, customerAccountDetectionReason = "none"
    }

    // Fetch all data in parallel for performance
    // Note: shopSettings already fetched above, so we fetch only remaining data here
    const [
      customers,
      tiers,
      recentTransactions,
      billingSubscription,
    ] = await Promise.all([
      // All customers with tier info
      db.customer.findMany({
        where: { shop },
        include: {
          currentTier: true,
        },
        orderBy: { storeCredit: 'desc' },
      }),

      // All tiers
      db.tier.findMany({
        where: { shop },
        orderBy: { minSpend: 'asc' },
      }),

      // Recent transactions (last 20)
      db.storeCreditLedger.findMany({
        where: { shop },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          customer: {
            select: {
              email: true,
              shopifyCustomerId: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),

      // Billing subscription from database (new GraphQL billing)
      db.billingSubscription.findUnique({
        where: { shop },
      }).catch(() => null), // Gracefully handle if table doesn't exist yet
    ]);

    console.log(`[Dashboard] Fetched data - Customers: ${customers.length}, Tiers: ${tiers.length}, Transactions: ${recentTransactions.length}`);

    // Calculate metrics
    const totalCustomers = customers.length;
    const totalStoreCredit = customers.reduce((sum, c) => 
      sum + parseFloat(c.storeCredit.toString()), 0
    );
    const activeTiers = tiers.length;
    const averageCredit = totalCustomers > 0 ? totalStoreCredit / totalCustomers : 0;
    const customersWithCredit = customers.filter(c => parseFloat(c.storeCredit.toString()) > 0).length;
    const customersWithTiers = customers.filter(c => c.currentTierId).length;

    // Calculate tier distribution
    const tierDistribution = tiers.map(tier => {
      const customersInTier = customers.filter(c => c.currentTierId === tier.id);
      const totalCreditInTier = customersInTier.reduce((sum, c) => 
        sum + parseFloat(c.storeCredit.toString()), 0
      );
      
      return {
        id: tier.id,
        name: tier.name,
        count: customersInTier.length,
        percentage: totalCustomers > 0 ? (customersInTier.length / totalCustomers) * 100 : 0,
        cashbackPercent: tier.cashbackPercent,
        totalCredit: totalCreditInTier,
        minSpend: tier.minSpend,
      };
    });

    // Add "No Tier" category if there are customers without tiers
    const noTierCustomers = customers.filter(c => !c.currentTierId);
    if (noTierCustomers.length > 0) {
      const totalCreditNoTier = noTierCustomers.reduce((sum, c) => 
        sum + parseFloat(c.storeCredit.toString()), 0
      );
      
      tierDistribution.push({
        id: 'no-tier',
        name: "No Tier",
        count: noTierCustomers.length,
        percentage: totalCustomers > 0 ? (noTierCustomers.length / totalCustomers) * 100 : 0,
        cashbackPercent: 0,
        totalCredit: totalCreditNoTier,
        minSpend: 0,
      });
    }

    // Sort tier distribution by customer count
    tierDistribution.sort((a, b) => b.count - a.count);

    // Get top customers with store credit
    const topCustomers = customers
      .slice(0, 5)
      .map(c => ({
        id: c.id,
        email: c.email,
        storeCredit: parseFloat(c.storeCredit.toString()),
        tierName: c.currentTier?.name || null,
      }));

    // Format recent transactions for display
    const formattedTransactions = recentTransactions.map(tx => {
      // Build customer display name
      let customerDisplay = "Unknown Customer";
      
      if (tx.customer) {
        // Check if we have a name
        if (tx.customer.firstName || tx.customer.lastName) {
          const name = [tx.customer.firstName, tx.customer.lastName]
            .filter(Boolean)
            .join(' ');
          customerDisplay = name || tx.customer.email;
        } else if (tx.customer.email) {
          customerDisplay = tx.customer.email;
        }
      } else {
        // Log orphaned transactions for debugging
        console.warn(`[Dashboard] Transaction ${tx.id} has no associated customer`);
        
        // Try to extract info from metadata if available
        if (tx.metadata && typeof tx.metadata === 'object') {
          const meta = tx.metadata as any;
          if (meta.customerEmail) {
            customerDisplay = meta.customerEmail;
          } else if (meta.customerId) {
            customerDisplay = `Customer #${meta.customerId}`;
          }
        }
      }
      
      return {
        id: tx.id,
        type: tx.type,
        amount: parseFloat(tx.amount.toString()),
        balance: parseFloat(tx.balance.toString()),
        customerEmail: customerDisplay,
        createdAt: new Date(tx.createdAt).toLocaleDateString(),
        metadata: tx.metadata,
      };
    });

    // Check if setup is complete
    const setupComplete = tiers.length > 0;

    // Process billing data
    const currentMonth = getCurrentMonthName();
    const daysRemaining = calculateDaysRemaining();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-indexed for database

    // Count orders using multiple strategies (like billing-v2 does)
    let orderCount = 0;
    let orderCountStrategy = "unknown";

    try {
      console.log(`[Dashboard] Attempting to count orders for ${shop} - ${currentMonth} ${year}`);

      // Use optimized fallback chain (DirectDataAPI first)
      const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

      const result = await countOrdersWithFallback(shop, startOfMonth, endOfMonth);
      orderCount = result.count;
      orderCountStrategy = result.strategy;

      // Fallback: If count is 0, try pre-aggregated count
      if (orderCount === 0) {
        console.log("[Dashboard] Count is 0, trying pre-aggregated count");
        orderCount = await getOrCreateMonthlyCount(shop, year, month);
        orderCountStrategy = "PreAggregated";
      }
    } catch (error) {
      console.error("[Dashboard] Error counting orders:", error);
      // Fallback to simple total count
      orderCount = await db.order.count({ where: { shop } });
      orderCountStrategy = "TotalFallback";
    }

    // Determine plan based on active subscription
    let planLimit = 100; // Default for free plan
    let planName = 'RewardsPro Free';

    if (activeSubscription?.name === 'RewardsPro Pro') {
      planLimit = 500;
      planName = 'RewardsPro Pro';
    } else if (activeSubscription?.name === 'RewardsPro Max') {
      planLimit = 2000;
      planName = 'RewardsPro Max';
    } else if (activeSubscription?.name === 'RewardsPro Ultra') {
      planLimit = 999999; // Effectively unlimited
      planName = 'RewardsPro Ultra';
    }

    const projectedOrders = calculateProjectedOrders(orderCount, daysRemaining);

    const monthlyOrderUsage = {
      orderCount,
      planLimit,
      planName,
      projectedOrders,
      countStrategy: orderCountStrategy // Include which strategy worked
    };

    console.log(`[Dashboard] Final count: ${orderCount} using strategy: ${orderCountStrategy}`);

    // Serialize billing subscription data (new GraphQL billing)
    const serializedPlan = billingSubscription ? {
      ...billingSubscription,
      planName: billingSubscription.planName || planName,
      cappedAmount: billingSubscription.cappedAmount ? Number(billingSubscription.cappedAmount) : null,
      balanceUsed: billingSubscription.balanceUsed ? Number(billingSubscription.balanceUsed) : 0,
      balanceRemaining: billingSubscription.balanceRemaining ? Number(billingSubscription.balanceRemaining) : null,
      currentPeriodEnd: billingSubscription.currentPeriodEnd instanceof Date
        ? billingSubscription.currentPeriodEnd.toISOString()
        : billingSubscription.currentPeriodEnd,
      createdAt: billingSubscription.createdAt instanceof Date
        ? billingSubscription.createdAt.toISOString()
        : billingSubscription.createdAt,
      updatedAt: billingSubscription.updatedAt instanceof Date
        ? billingSubscription.updatedAt.toISOString()
        : billingSubscription.updatedAt,
    } : null;

    const dashboardData: DashboardData = {
      shop,
      metrics: {
        totalCustomers,
        totalStoreCredit,
        activeTiers,
        averageCredit,
        customersWithCredit,
        customersWithTiers,
      },
      tierDistribution,
      recentTransactions: formattedTransactions,
      topCustomers,
      setupComplete,
      shopSettings: shopSettings ? {
        storeCurrency: shopSettings.storeCurrency,
        currencyDisplayType: shopSettings.currencyDisplayType,
        customersInitialSynced: shopSettings.customersInitialSynced,
        customersSyncInProgress: shopSettings.customersSyncInProgress,
        currencySelected: shopSettings.currencySelected,
      } : null,
      // Billing data
      currentPlan: serializedPlan,
      activeSubscription,
      monthlyOrderUsage,
      currentMonth,
      daysRemaining,
      // Widget detection
      hasWidget,
      widgetDetectionMethod,
      widgetDismissed,
      hasCustomerAccountBlock,
      customerAccountBlockDismissed,
    };

    console.log(`[Dashboard] Returning data for ${shop}`);
    return json(dashboardData);
  } catch (error) {
    console.error("[Dashboard] Loader error:", error);
    throw new Response("Failed to load dashboard data", { status: 500 });
  }
};


// ============================================
// DASHBOARD COMPONENT
// ============================================

export default function Dashboard() {
  const data = useLoaderData<typeof loader>() as DashboardData;
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Currency selection state
  const [selectedCurrency, setSelectedCurrency] = useState(data.shopSettings?.storeCurrency || "USD");
  const [isSavingCurrency, setIsSavingCurrency] = useState(false);

  // Plan details calculations are now handled by CurrentPlanCard component
  // These variables are kept for reference but no longer needed
  // const activePlanName = data.activeSubscription?.name || data.currentPlan?.planName || "RewardsPro Free";
  // const planDetails = MANAGED_PLANS[activePlanName as keyof typeof MANAGED_PLANS] || MANAGED_PLANS["RewardsPro Free"];
  // const currentUsage = data.monthlyOrderUsage?.orderCount || 0;
  // const planLimit = data.monthlyOrderUsage?.planLimit || 200;
  // const projectedUsage = data.monthlyOrderUsage?.projectedOrders || 0;
  // const usagePercentage = Math.min((currentUsage / planLimit) * 100, 100);
  // const projectedPercentage = Math.min((projectedUsage / planLimit) * 100, 100);
  // const progressTone = usagePercentage >= 90 ? "critical" : usagePercentage >= 75 ? "warning" : "success";
  // const protectionApplied = currentUsage > planLimit;
  // const ordersNotCounted = protectionApplied ? currentUsage - planLimit : 0;

  // Format currency helper
  const formatAmount = useCallback((amount: number) => {
    return formatCurrency(amount, data.shopSettings as any);
  }, [data.shopSettings]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    window.location.reload();
  }, []);

  // Handle currency selection and save
  const handleSaveCurrency = useCallback(async () => {
    setIsSavingCurrency(true);
    try {
      const response = await fetch('/api/set-currency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency: selectedCurrency,
          displayType: 'SYMBOL', // Default to symbol
        }),
      });

      if (response.ok) {
        // Reload to update dashboard with new currency
        window.location.reload();
      } else {
        console.error('Failed to save currency');
        setIsSavingCurrency(false);
      }
    } catch (error) {
      console.error('Error saving currency:', error);
      setIsSavingCurrency(false);
    }
  }, [selectedCurrency]);

  // Auto-refresh when window regains focus (user returns from theme editor)
  // This implements the recommended UX flow from Shopify's developer guide
  // Guard: Only reload if page has been open for at least 5 seconds to avoid annoyance
  useEffect(() => {
    const pageOpenTime = Date.now();
    const MIN_TIME_BEFORE_RELOAD = 5000; // 5 seconds

    const handleWindowFocus = () => {
      // Only reload if widget is not detected (to check if user enabled it)
      if (!data.hasWidget) {
        const timeElapsed = Date.now() - pageOpenTime;

        // Guard: Only reload if page has been open long enough
        if (timeElapsed >= MIN_TIME_BEFORE_RELOAD) {
          console.log('[Dashboard] Window focused - checking if widget was enabled...');
          // Small delay to ensure theme settings are saved
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          console.log('[Dashboard] Window focused but page recently opened - skipping reload');
        }
      }
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [data.hasWidget]);

  // Tab configuration
  const tabs = [
    { id: 'overview', content: 'Overview', panelID: 'overview-panel' },
    { id: 'insights', content: 'Insights', panelID: 'insights-panel' },
  ];

  // If setup is not complete, show onboarding
  if (!data.setupComplete) {
    return (
      <Page title="Welcome to RewardsPro">
        <Layout>
          <Layout.Section>
            <EmptyState
              heading="Get started with RewardsPro"
              action={{
                content: "Manage customers & tiers",
                url: "/app/customers",
              }}
              secondaryAction={{
                content: "Configure settings",
                url: "/app/settings",
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Set up loyalty tiers and start rewarding your customers with cashback.</p>
            </EmptyState>
          </Layout.Section>
        </Layout>
        
        {/* Bottom spacer to prevent content from touching the bottom */}
        <div style={{ height: '80px', width: '100%' }} aria-hidden="true" />
      </Page>
    );
  }

  return (
    <Page 
      title="Dashboard"
      primaryAction={{
        content: "Add customer",
        icon: PlusIcon,
        url: "/app/customers",
      }}
      secondaryActions={[
        {
          content: "Refresh",
          icon: RefreshIcon,
          onAction: handleRefresh,
          loading: isRefreshing,
        },
      ]}
    >
      <Layout>
        {/* Customer Sync Status Banner */}
        {data.shopSettings?.customersSyncInProgress && (
          <Layout.Section>
            <Banner tone="info">
              <BlockStack gap="200">
                <Text variant="bodyMd" as="p">
                  🔄 Syncing your customers from Shopify...
                </Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  This may take a few minutes. You can continue using the app while this completes in the background.
                </Text>
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

        {!data.shopSettings?.customersInitialSynced && !data.shopSettings?.customersSyncInProgress && (
          <Layout.Section>
            <Banner
              title="Customer sync needed"
              tone="warning"
              action={{ content: "Sync customers", url: "/app/customers" }}
            >
              <Text variant="bodyMd" as="p">
                Your customers haven't been synced yet. Sync them to start tracking rewards and tiers.
              </Text>
            </Banner>
          </Layout.Section>
        )}

        {/* Widget Setup Nudge - Always show until detected */}
        {!data.hasWidget && (
          <Layout.Section>
            <Banner
              title="Important: Add RewardsPro widget to your store theme"
              tone="warning"
            >
              <BlockStack gap="300">
                <Text variant="bodyMd" as="p">
                  To make sure RewardsPro works properly, you'll need to add it as an app embed in your Shopify theme.
                  Without this step, customers may not see the rewards widget on your storefront.
                </Text>

                <Box paddingBlock="200">
                  <Banner tone="info">
                    <BlockStack gap="200">
                      <Text variant="bodySm" as="p" fontWeight="semibold">
                        We couldn't detect the RewardsPro widget on your store. Follow the steps below:
                      </Text>
                    </BlockStack>
                  </Banner>
                </Box>

                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p" fontWeight="semibold">
                    Quick setup (takes 30 seconds):
                  </Text>
                  <ol style={{ paddingLeft: '20px', margin: '8px 0' }}>
                    <li style={{ marginBottom: '8px' }}>
                      <Text variant="bodySm" as="span">
                        Go to <strong>Online Store → Themes → Customize</strong>
                      </Text>
                    </li>
                    <li style={{ marginBottom: '8px' }}>
                      <Text variant="bodySm" as="span">
                        Click the <strong>App embeds</strong> icon in the left sidebar (puzzle piece icon)
                      </Text>
                    </li>
                    <li style={{ marginBottom: '8px' }}>
                      <Text variant="bodySm" as="span">
                        Find <strong>"Membership Widget"</strong> and toggle it <strong>ON</strong>
                      </Text>
                    </li>
                    <li style={{ marginBottom: '8px' }}>
                      <Text variant="bodySm" as="span">
                        Click <strong>Save</strong> in the top-right corner
                      </Text>
                    </li>
                  </ol>
                </BlockStack>

                <Box paddingBlock="300">
                  <Card>
                    <Box padding="400">
                      <BlockStack gap="300">
                        <Text variant="bodySm" as="p" fontWeight="semibold">
                          Visual Guide:
                        </Text>
                        <video
                          autoPlay
                          loop
                          muted
                          playsInline
                          src="/widget-toggle-guide.mp4"
                          style={{
                            width: '100%',
                            maxWidth: '400px',
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}
                        >
                          Your browser does not support the video tag.
                        </video>
                        <Text variant="bodySm" tone="subdued" as="p">
                          Toggle the "Membership Widget" switch to ON to enable it on your storefront.
                        </Text>
                      </BlockStack>
                    </Box>
                  </Card>
                </Box>

                <Box paddingBlock="200">
                  <Banner tone="info">
                    <Text variant="bodySm" as="p">
                      Note: The widget will only show as enabled once we detect it's actually installed (via theme detection).
                      This onboarding guide will persist until the widget is detected as active.
                    </Text>
                  </Banner>
                </Box>

                <Button
                  onClick={() => {
                    window.open(
                      `https://${data.shop}/admin/themes/current/editor?context=apps&activateAppId=026ce3bf073bed0e44ae8eab09d1ae3a/membership_widget`,
                      '_blank'
                    );
                  }}
                  variant="primary"
                >
                  Enable widget in theme editor
                </Button>
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

        {/* Customer Account Block Setup - Always show until detected */}
        {!data.hasCustomerAccountBlock && (
          <Layout.Section data-banner="customer-account-block">
            <Banner
              title="Enable customer account membership block"
              tone="info"
            >
              <BlockStack gap="300">
                <Text variant="bodyMd" as="p">
                  Show your customers their loyalty tier and rewards directly on their account page.
                  This creates a personalized experience and encourages engagement with your rewards program.
                </Text>

                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p" fontWeight="semibold">
                    Quick setup (takes 30 seconds):
                  </Text>
                  <ol style={{ paddingLeft: '20px', margin: '8px 0' }}>
                    <li style={{ marginBottom: '8px' }}>
                      <Text variant="bodySm" as="span">
                        Click the button below to open the customer account editor
                      </Text>
                    </li>
                    <li style={{ marginBottom: '8px' }}>
                      <Text variant="bodySm" as="span">
                        Find <strong>"RewardsPro Membership"</strong> in the app blocks list
                      </Text>
                    </li>
                    <li style={{ marginBottom: '8px' }}>
                      <Text variant="bodySm" as="span">
                        Drag it to your desired location on the profile page
                      </Text>
                    </li>
                    <li style={{ marginBottom: '8px' }}>
                      <Text variant="bodySm" as="span">
                        Click <strong>Save</strong> in the top-right corner
                      </Text>
                    </li>
                  </ol>
                </BlockStack>

                <Box paddingBlock="200">
                  <Banner tone="info">
                    <Text variant="bodySm" as="p">
                      Note: The block will only show as enabled once we detect it's actually installed (via GraphQL detection).
                      This onboarding guide will persist until the block is detected as active.
                    </Text>
                  </Banner>
                </Box>

                <Button
                  onClick={() => {
                    // Open customer account profile editor with app blocks context
                    // Extract shop name from shop domain (e.g., "store.myshopify.com" -> "store")
                    const shopName = data.shop.split('.')[0];
                    window.open(
                      `https://admin.shopify.com/store/${shopName}/settings/checkout/editor/profiles/6001787264?page=profile&context=apps`,
                      '_blank'
                    );
                  }}
                  variant="primary"
                >
                  Enable customer account block
                </Button>
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

        {/* Currency Selection Banner - Only show if not selected */}
        {!data.shopSettings?.currencySelected && (
          <Layout.Section>
            <Banner
              title="Select your cashback currency"
              tone="info"
            >
              <BlockStack gap="300">
                <Text variant="bodyMd" as="p">
                  Choose the currency you want to use for cashback rewards. This will affect how rewards are displayed throughout your loyalty program.
                </Text>

                <Box maxWidth="300px">
                  <Select
                    label="Store Currency"
                    options={CURRENCY_OPTIONS}
                    value={selectedCurrency}
                    onChange={setSelectedCurrency}
                  />
                </Box>

                <Button
                  onClick={handleSaveCurrency}
                  loading={isSavingCurrency}
                  variant="primary"
                >
                  Save Currency
                </Button>
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

        {/* Key Metrics Overview */}
        <Layout.Section>
          <StatsOverview
            stats={[
              {
                label: "Total Customers",
                value: data.metrics.totalCustomers.toString(),
                icon: PersonIcon,
              },
              {
                label: "Total Store Credit",
                value: formatAmount(data.metrics.totalStoreCredit),
                icon: CashDollarIcon,
              },
              {
                label: "Active Tiers",
                value: data.metrics.activeTiers.toString(),
                icon: RewardIcon,
              },
              {
                label: "Average Credit",
                value: formatAmount(data.metrics.averageCredit),
                icon: ChartVerticalIcon,
              },
            ]}
            loading={isRefreshing}
          />
        </Layout.Section>

        {/* Plan Details Card - Using shared component */}
        <Layout.Section>
          <CurrentPlanCard
            activeSubscription={data.activeSubscription}
            currentPlan={data.currentPlan}
            monthlyOrderUsage={{
              orderCount: data.monthlyOrderUsage?.orderCount || 0,
              planLimit: data.monthlyOrderUsage?.planLimit || 200,
              projectedOrders: data.monthlyOrderUsage?.projectedOrders || 0,
              currentMonth: data.currentMonth
            }}
            showUpgradeButton={true}
            showOverageBanner={false}
            showCountStrategy={false}
            showProjectedUsage={true}
            compact={false}
            onUpgrade={() => navigate("/app/billing")}
          />
        </Layout.Section>
        
        <Layout.Section>
          <BlockStack gap="500">

            {/* Tabbed Content Area */}
            <Card>
              <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
                {/* Overview Tab */}
                {selectedTab === 0 && (
                  <Box padding="400">
                    <BlockStack gap="500">
                      {/* Tier Distribution */}
                      <BlockStack gap="400">
                        <Text variant="headingMd" as="h2">
                          Tier Distribution
                        </Text>
                        {data.tierDistribution.length > 0 ? (
                          <BlockStack gap="300">
                            {sortTiersByPriority(data.tierDistribution).map((tier) => (
                              <BlockStack key={tier.id} gap="200">
                                <InlineStack align="space-between">
                                  <InlineStack gap="300" align="start">
                                    {tier.name === "No Tier" ? (
                                      <Icon source={AlertTriangleIcon} tone="caution" />
                                    ) : (
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        background: getTierStyle(tier.name).backgroundColor,
                                        border: `2px solid ${getTierStyle(tier.name).borderColor}`,
                                      }}>
                                        <Icon 
                                          source={getTierStyle(tier.name).icon} 
                                          tone="base"
                                        />
                                      </div>
                                    )}
                                    <BlockStack gap="100">
                                      <InlineStack gap="200" align="start">
                                        {tier.name === "No Tier" ? (
                                          <Text variant="bodyMd" fontWeight="semibold" as="p">
                                            {tier.name}
                                          </Text>
                                        ) : (
                                          <TierBadge
                                            tierName={tier.name}
                                            size="small"
                                            showIcon={false}
                                            cashbackPercent={tier.cashbackPercent}
                                          />
                                        )}
                                      </InlineStack>
                                      <Text variant="bodySm" tone="subdued" as="p">
                                        {tier.count} customers • {formatAmount(tier.totalCredit)} total credit
                                      </Text>
                                    </BlockStack>
                                  </InlineStack>
                                  <Text variant="bodyLg" fontWeight="semibold" as="p">
                                    {tier.percentage.toFixed(1)}%
                                  </Text>
                                </InlineStack>
                                <ProgressBar
                                  progress={tier.percentage}
                                  size="small"
                                  tone={tier.name === "No Tier" ? "critical" : "success"}
                                />
                              </BlockStack>
                            ))}
                          </BlockStack>
                        ) : (
                          <EmptyState
                            heading="No tier data yet"
                            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                          >
                            <p>Tier distribution will appear here once you have customers.</p>
                          </EmptyState>
                        )}
                      </BlockStack>
                    </BlockStack>
                  </Box>
                )}

                {/* Insights Tab */}
                {selectedTab === 1 && (
                  <Box padding="400">
                    <BlockStack gap="500">
                      <BlockStack gap="400">
                        <Text variant="headingMd" as="h2">
                          Key Insights
                        </Text>
                        
                        {/* Insights Cards */}
                        <BlockStack gap="300">
                          {data.metrics.customersWithTiers < data.metrics.totalCustomers * 0.5 && (
                            <ActionBanner
                              title="Opportunity: Increase tier participation"
                              content={`Only ${Math.round((data.metrics.customersWithTiers / data.metrics.totalCustomers) * 100)}% of your customers are in a tier. Consider reviewing tier thresholds or running a campaign.`}
                              tone="info"
                              action={{ content: "View customers", onAction: () => window.location.href = "/app/customers" }}
                            />
                          )}

                          {data.metrics.averageCredit > 50 && (
                            <ActionBanner
                              title="High average credit balance"
                              content={`Your customers have an average of ${formatAmount(data.metrics.averageCredit)} in store credit. This indicates strong engagement with your rewards program.`}
                              tone="success"
                            />
                          )}

                          {data.tierDistribution.find(t => t.name === "No Tier" && t.percentage > 30) && (
                            <ActionBanner
                              title="Many customers without tiers"
                              content={`${data.tierDistribution.find(t => t.name === "No Tier")?.percentage.toFixed(0)}% of customers aren't in a tier. Consider adjusting your tier requirements.`}
                              tone="warning"
                              action={{ content: "Manage customers & tiers", onAction: () => window.location.href = "/app/customers" }}
                            />
                          )}
                        </BlockStack>
                      </BlockStack>

                      <Divider />

                      {/* Program Statistics */}
                      <BlockStack gap="400">
                        <Text variant="headingMd" as="h2">
                          Program Statistics
                        </Text>
                        <Grid>
                          <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }}>
                            <Card>
                              <Box padding="300">
                                <BlockStack gap="200">
                                  <Text variant="bodySm" tone="subdued" as="p">
                                    Tier Participation Rate
                                  </Text>
                                  <Text variant="headingLg" as="h3">
                                    {Math.round((data.metrics.customersWithTiers / data.metrics.totalCustomers) * 100)}%
                                  </Text>
                                  <ProgressBar 
                                    progress={(data.metrics.customersWithTiers / data.metrics.totalCustomers) * 100}
                                    size="small"
                                  />
                                </BlockStack>
                              </Box>
                            </Card>
                          </Grid.Cell>
                          <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }}>
                            <Card>
                              <Box padding="300">
                                <BlockStack gap="200">
                                  <Text variant="bodySm" tone="subdued" as="p">
                                    Credit Utilization Rate
                                  </Text>
                                  <Text variant="headingLg" as="h3">
                                    {Math.round((data.metrics.customersWithCredit / data.metrics.totalCustomers) * 100)}%
                                  </Text>
                                  <ProgressBar 
                                    progress={(data.metrics.customersWithCredit / data.metrics.totalCustomers) * 100}
                                    size="small"
                                  />
                                </BlockStack>
                              </Box>
                            </Card>
                          </Grid.Cell>
                        </Grid>
                      </BlockStack>
                    </BlockStack>
                  </Box>
                )}
              </Tabs>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}