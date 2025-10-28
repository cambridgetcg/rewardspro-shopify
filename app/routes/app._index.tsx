import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
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
  EmptyState,
  DataTable,
  Banner,
  Select,
  Modal,
  Divider,
  Collapsible,
} from "@shopify/polaris";
import {
  PlusIcon,
  PersonIcon,
  CashDollarIcon,
  RewardIcon,
  ChartVerticalIcon,
  CheckCircleIcon,
  InfoIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "~/utils/polaris-icons";
import {
  StatsOverview,
  EnhancedDataTable,
} from "../components/DesignSystem";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { formatCurrency } from "../utils/currency";
import { CurrentPlanCard } from "~/components/Billing";
import { MANAGED_PLANS } from "~/constants/billing.constants";
import { countOrdersWithFallback, countOrdersDateExtraction, getOrCreateMonthlyCount, countOrdersDirectDataAPI, countOrdersEpochComparison } from "~/utils/order-count-strategies";
import { parse as parseJsonC } from "jsonc-parser";
import { useShopifyNavigation } from "~/utils/shopify-navigation";

// ============================================
// CONSTANTS
// ============================================

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
    customersWithCredit: number;
    customersWithTiers: number;
  };
  // ShopifyQL-powered metrics (Shopify native data)
  shopifyMetrics: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    shopifyCustomers: number;
    conversionRate: number;
    source: 'shopifyql' | 'cache' | 'unavailable';
  } | null;
  setupComplete: boolean;
  shopSettings: {
    storeCurrency: string;
    currencyDisplayType: string;
    customersInitialSynced?: boolean;
    customersSyncInProgress?: boolean;
    currencySelected?: boolean;
    tierRecalculationEnabled?: boolean;
    advancedAnalyticsEnabled?: boolean;
    autoCashbackProcessingEnabled?: boolean;
    emailMarketingEnabled?: boolean;
    tierProductsEnabled?: boolean;
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
    const loaderStart = Date.now();
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
        widgetIsActive: true,
        widgetSetupDismissed: true,
        customerAccountBlockDismissed: true,
        customerAccountBlockIsActive: true,
        tierRecalculationEnabled: true,
        advancedAnalyticsEnabled: true,
        autoCashbackProcessingEnabled: true,
        emailMarketingEnabled: true,
        tierProductsEnabled: true,
      }
    });

    // Extract flags (dismissal is SEPARATE from detection)
    const widgetDismissed = shopSettings?.widgetSetupDismissed || false;
    const customerAccountBlockDismissed = shopSettings?.customerAccountBlockDismissed || false;

    // Widget detection - PROPER SEPARATION OF CONCERNS:
    // 1. Dismissal flag is ONLY for UI (suppress banner)
    // 2. Detection runs regardless of dismissal state
    // 3. Cache last known status for fallback
    // 4. Check theme settings for actual detection
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
            // Step 3: Parse JSON using tolerant parser
            // Real Shopify themes often have Liquid tags, trailing commas, or non-JSON content
            // Use jsonc-parser for tolerant parsing and add sanitation
            try {
              // Sanitize Liquid tags before parsing
              // Remove Liquid output tags {{ ... }}
              settingsContent = settingsContent.replace(/\{\{[^}]*\}\}/g, '');
              // Remove Liquid logic tags {% ... %}
              settingsContent = settingsContent.replace(/\{%[^%]*%\}/g, '');

              // Remove comment blocks
              settingsContent = settingsContent.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove /* */ blocks
              settingsContent = settingsContent.replace(/\/\/[^\n]*\n/g, ''); // Remove // comments

              // Parse with jsonc-parser (handles trailing commas, comments)
              const themeSettings = parseJsonC(settingsContent);

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
              console.warn("[Dashboard] JSON parse failed - treating as 'unknown', using cached status as fallback");
              // Don't set detectedInTheme to false - let it remain undefined
              // This will trigger fallback to cached status below rather than forcing false
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

    // Check customer account block status
    // IMPORTANT: Dismissal is SEPARATE from detection
    // We track if banner was dismissed, but still need to detect if block is actually installed
    // Detection strategy: Cache only
    //
    // NOTE: GraphQL detection disabled because customerAccountAppExtensionRegistrations
    // field doesn't exist in Admin API 2025-01 (never shipped).
    // Relying on cache until proper API is available.

    let hasCustomerAccountBlock = false;
    let customerAccountDetectionReason: "cached" | "none" = "none";

    try {
      console.log("[Dashboard] Starting customer account block detection (cache only)...");

      // Check cached status
      if (shopSettings?.customerAccountBlockIsActive) {
        hasCustomerAccountBlock = true;
        customerAccountDetectionReason = "cached";
        console.log(`[Dashboard] Customer account block detected via cache`);
      }

      console.log(`[Dashboard] Final customer account block status: ${hasCustomerAccountBlock} (method: ${customerAccountDetectionReason}, dismissed: ${customerAccountBlockDismissed})`);

    } catch (error) {
      console.error("[Dashboard] Critical error in customer account block detection:", error);
      // Leave hasCustomerAccountBlock = false, customerAccountDetectionReason = "none"
    }

    // Fetch all data in parallel for performance
    // Note: shopSettings already fetched above, so we fetch only remaining data here

    // Disable ShopifyQL for now - will be implemented later with proper data fetching strategy
    const shopifyMetrics: DashboardData['shopifyMetrics'] = {
      totalRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      shopifyCustomers: 0,
      conversionRate: 0,
      source: 'unavailable',
    };
    const perfStart = Date.now();

    const [
      customerAggregates,
      customersWithCreditCount,
      customersWithTiersCount,
      tiers,
      billingSubscription,
    ] = await Promise.all([
      // Aggregate customer totals (much faster than loading all customers)
      db.customer.aggregate({
        where: { shop },
        _count: { id: true },
      }),

      // Count customers with store credit > 0
      db.customer.count({
        where: {
          shop,
          storeCredit: { gt: 0 },
        },
      }),

      // Count customers with tiers assigned
      db.customer.count({
        where: {
          shop,
          currentTierId: { not: null },
        },
      }),

      // All tiers (still needed for setup check)
      db.tier.findMany({
        where: { shop },
        orderBy: { minSpend: 'asc' },
      }),

      // Billing subscription from database (new GraphQL billing)
      db.billingSubscription.findUnique({
        where: { shop },
      }).catch(() => null), // Gracefully handle if table doesn't exist yet
    ]);

    const perfData = Date.now();
    console.log(`[Dashboard] ⚡ Data fetch completed in ${perfData - perfStart}ms`);

    // Calculate metrics from aggregates (no in-memory loops)
    const totalCustomers = customerAggregates._count.id || 0;
    const customersWithCredit = customersWithCreditCount;
    const customersWithTiers = customersWithTiersCount;

    // Check if setup is complete
    const setupComplete = tiers.length > 0;

    // Process billing data
    const currentMonth = getCurrentMonthName();
    const daysRemaining = calculateDaysRemaining();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-indexed for database

    // Count orders using Aurora database (ShopifyQL disabled for now)
    let orderCount = 0;
    let orderCountStrategy = "unknown";

    try {
      const perfOrderStart = Date.now();
      console.log(`[Dashboard] Attempting to count orders for ${shop} - ${currentMonth} ${year}`);

      // Aurora cache-first strategy
      const cachedUsage = await db.monthlyOrderUsage.findUnique({
        where: {
          shop_year_month: {
            shop,
            year,
            month,
          },
        },
      });

      const CACHE_FRESH_MINUTES = 15;
      const cacheIsFresh = cachedUsage &&
        (now.getTime() - cachedUsage.updatedAt.getTime()) < (CACHE_FRESH_MINUTES * 60 * 1000);

      if (cacheIsFresh && cachedUsage) {
        // Use cached value from Aurora
        orderCount = cachedUsage.orderCount;
        orderCountStrategy = "Aurora-CachedValue";
        console.log(`[Dashboard] ⚡ Using Aurora cached order count: ${orderCount} (age: ${Math.round((now.getTime() - cachedUsage.updatedAt.getTime()) / 1000)}s)`);
      } else {
        // Cache is stale - run Aurora counting strategies
        console.log(`[Dashboard] Aurora cache is ${!cachedUsage ? 'missing' : 'stale'}, running live count`);
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

        try {
          // Try DirectDataAPI first (most reliable)
          orderCount = await countOrdersDirectDataAPI(shop, startOfMonth, endOfMonth);
          orderCountStrategy = "Aurora-DirectDataAPI";
          console.log(`[Dashboard] Aurora DirectDataAPI succeeded with count: ${orderCount}`);
        } catch (error) {
          console.error("[Dashboard] Aurora DirectDataAPI failed, trying EpochComparison:", error);

          try {
            // Fallback to EpochComparison
            orderCount = await countOrdersEpochComparison(shop, startOfMonth, endOfMonth);
            orderCountStrategy = "Aurora-EpochComparison";
            console.log(`[Dashboard] Aurora EpochComparison succeeded with count: ${orderCount}`);
          } catch (error2) {
            console.error("[Dashboard] Aurora EpochComparison failed, using pre-aggregated:", error2);

            // Final fallback to pre-aggregated count
            orderCount = await getOrCreateMonthlyCount(shop, year, month);
            orderCountStrategy = "Aurora-PreAggregated";
          }
        }
      }

      const perfOrderEnd = Date.now();
      console.log(`[Dashboard] ⚡ Order counting completed in ${perfOrderEnd - perfOrderStart}ms using strategy: ${orderCountStrategy}`);
    } catch (error) {
      console.error("[Dashboard] Error counting orders:", error);
      // Final fallback to simple total count
      orderCount = await db.order.count({ where: { shop } });
      orderCountStrategy = "TotalFallback";
    }

    // Determine plan based on active subscription using shared plan constants
    let planLimit = MANAGED_PLANS["RewardsPro Free"].ordersIncluded; // 100
    let planName = 'RewardsPro Free';

    // Map subscription names to plan constants
    if (activeSubscription?.name) {
      const planConfig = MANAGED_PLANS[activeSubscription.name];
      if (planConfig) {
        planLimit = planConfig.ordersIncluded;
        planName = activeSubscription.name;
      }
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
        customersWithCredit,
        customersWithTiers,
      },
      shopifyMetrics,
      setupComplete,
      shopSettings: shopSettings ? {
        storeCurrency: shopSettings.storeCurrency,
        currencyDisplayType: shopSettings.currencyDisplayType,
        customersInitialSynced: shopSettings.customersInitialSynced,
        customersSyncInProgress: shopSettings.customersSyncInProgress,
        currencySelected: shopSettings.currencySelected,
        tierRecalculationEnabled: shopSettings.tierRecalculationEnabled,
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

    const loaderEnd = Date.now();
    const totalTime = loaderEnd - loaderStart;
    console.log(`[Dashboard] ⚡ Total loader execution time: ${totalTime}ms`);
    console.log(`[Dashboard] Returning data for ${shop}`);
    return json(dashboardData);
  } catch (error) {
    // If authenticate.admin threw a redirect Response (e.g., to refresh session token),
    // let Remix handle it instead of treating it as an error
    if (error instanceof Response) {
      throw error; // Re-throw the 302 redirect to /auth/session-token
    }

    // Only log and return 500 for actual unexpected errors
    console.error("[Dashboard] Loader error:", error);
    throw new Response("Failed to load dashboard data", { status: 500 });
  }
};

// ============================================
// ACTION - Handle feature toggles
// ============================================

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "toggle-feature") {
    const feature = formData.get("feature") as string;
    const enabled = formData.get("enabled") === "true";

    const updateData: any = {};
    updateData[feature] = enabled;

    await db.shopSettings.update({
      where: { shop },
      data: updateData,
    });

    return json({ success: true });
  }

  return json({ success: false });
};

// ============================================
// DASHBOARD COMPONENT
// ============================================

// ============================================
// STATUS ITEM COMPONENT
// ============================================

interface StatusItemProps {
  id: string;
  label: string;
  status: 'success' | 'warning' | 'critical';
  statusText: string;
  description: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function StatusItem({ id, label, status, statusText, description, isExpanded, onToggle }: StatusItemProps) {
  const getBackgroundColor = () => {
    switch (status) {
      case 'success': return '#f0fdf4';
      case 'warning': return '#fef3c7';
      case 'critical': return '#fee2e2';
      default: return '#f9fafb';
    }
  };

  const getBorderColor = () => {
    switch (status) {
      case 'success': return '#86efac';
      case 'warning': return '#fbbf24';
      case 'critical': return '#fca5a5';
      default: return '#e5e7eb';
    }
  };

  const getLightColor = () => {
    switch (status) {
      case 'success': return { bg: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', shadow: 'rgba(34, 197, 94, 0.6)' };
      case 'warning': return { bg: 'rgba(234, 179, 8, 0.2)', color: '#eab308', shadow: 'rgba(234, 179, 8, 0.6)' };
      case 'critical': return { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', shadow: 'rgba(239, 68, 68, 0.6)' };
      default: return { bg: 'rgba(156, 163, 175, 0.2)', color: '#9ca3af', shadow: 'rgba(156, 163, 175, 0.6)' };
    }
  };

  const getBadgeTone = (): 'success' | 'warning' | 'critical' => {
    return status === 'success' ? 'success' : status === 'warning' ? 'warning' : 'critical';
  };

  const lightColors = getLightColor();

  return (
    <div>
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          backgroundColor: getBackgroundColor(),
          border: `1px solid ${getBorderColor()}`,
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Status light indicator */}
        <div style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          backgroundColor: lightColors.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: lightColors.color,
            boxShadow: `0 0 6px ${lightColors.shadow}`
          }} />
        </div>

        {/* Label */}
        <Text variant="bodyMd" as="span" fontWeight="medium">
          {label}
        </Text>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Status badge */}
        <Badge tone={getBadgeTone()}>
          {statusText}
        </Badge>

        {/* Expand/collapse icon */}
        <Icon source={isExpanded ? ChevronUpIcon : ChevronDownIcon} />
      </div>

      {/* Collapsible description */}
      <Collapsible
        open={isExpanded}
        id={`collapsible-${id}`}
        transition={{ duration: '200ms', timingFunction: 'ease-in-out' }}
      >
        <div style={{
          padding: '16px',
          backgroundColor: '#fafafa',
          borderLeft: `1px solid ${getBorderColor()}`,
          borderRight: `1px solid ${getBorderColor()}`,
          borderBottom: `1px solid ${getBorderColor()}`,
          borderRadius: '0 0 8px 8px',
          marginTop: '-8px'
        }}>
          <Text variant="bodySm" as="p" tone="subdued">
            {description}
          </Text>
        </div>
      </Collapsible>
    </div>
  );
}

export default function Dashboard() {
  const data = useLoaderData<typeof loader>() as DashboardData;
  const navigate = useNavigate();
  const { navigate: shopifyNavigate } = useShopifyNavigation();
  const fetcher = useFetcher();

  // Currency selection state
  const [selectedCurrency, setSelectedCurrency] = useState(data.shopSettings?.storeCurrency || "USD");
  const [isSavingCurrency, setIsSavingCurrency] = useState(false);

  // System status expanded items state
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItem = useCallback((itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
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

  // Handle feature toggle
  const handleToggleFeature = useCallback((feature: string, currentValue: boolean) => {
    const formData = new FormData();
    formData.append("action", "toggle-feature");
    formData.append("feature", feature);
    formData.append("enabled", (!currentValue).toString());

    fetcher.submit(formData, { method: "post" });
  }, [fetcher]);

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

        {/* Customer Account Block Setup - TEMPORARILY DISABLED */}
        {false && !data.hasCustomerAccountBlock && (
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
                      Note: The block will only show as enabled once we detect it's actually installed.
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

        {/* Plan Details Card - Using shared component */}
        <Layout.Section>
          <CurrentPlanCard
            activeSubscription={data.activeSubscription}
            currentPlan={data.currentPlan}
            monthlyOrderUsage={{
              orderCount: data.monthlyOrderUsage?.orderCount || 0,
              planLimit: data.monthlyOrderUsage?.planLimit || MANAGED_PLANS["RewardsPro Free"].ordersIncluded,
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

        {/* System Status Dashboard - Pre-Flight Checklist */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">System Status</Text>
                <Text variant="bodySm" tone="subdued" as="span">
                  Pre-Flight Checklist
                </Text>
              </InlineStack>

              <Text variant="bodyMd" tone="subdued" as="p">
                Real-time status of all app systems and integrations
              </Text>

              {/* Status Legend */}
              <Box
                padding="300"
                background="bg-surface-secondary"
                borderRadius="200"
              >
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3" fontWeight="semibold">
                    Status Indicators
                  </Text>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                  }}>
                    {/* Operating Normally */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(34, 197, 94, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#22c55e',
                          boxShadow: '0 0 6px rgba(34, 197, 94, 0.6)'
                        }} />
                      </div>
                      <Text variant="bodySm" as="span" fontWeight="medium">
                        Operating normally
                      </Text>
                    </div>

                    {/* Configuration Recommended */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(234, 179, 8, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#eab308',
                          boxShadow: '0 0 6px rgba(234, 179, 8, 0.6)'
                        }} />
                      </div>
                      <Text variant="bodySm" as="span" fontWeight="medium">
                        Configuration recommended
                      </Text>
                    </div>

                    {/* Needs Attention */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#ef4444',
                          boxShadow: '0 0 6px rgba(239, 68, 68, 0.6)'
                        }} />
                      </div>
                      <Text variant="bodySm" as="span" fontWeight="medium">
                        Needs attention
                      </Text>
                    </div>
                  </div>
                </BlockStack>
              </Box>

              {/* Core Systems */}
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3" fontWeight="semibold">
                  Core Systems
                </Text>

                <StatusItem
                  id="storefront-widget"
                  label="Storefront Widget"
                  status={data.hasWidget ? 'success' : 'warning'}
                  statusText={data.hasWidget ? 'ACTIVE' : 'NOT DETECTED'}
                  description="The RewardsPro widget displays customer tier badges, reward balances, and cashback information on your storefront. It embeds on product pages and the customer account to show real-time loyalty status. Enable it in your theme editor under App embeds to activate this feature."
                  isExpanded={expandedItems.has('storefront-widget')}
                  onToggle={() => toggleItem('storefront-widget')}
                />

                <StatusItem
                  id="database-connection"
                  label="Database Connection"
                  status="success"
                  statusText="CONNECTED"
                  description="Your app is connected to the AWS Aurora PostgreSQL database where all customer data, tier assignments, transaction history, and loyalty rewards are securely stored. This connection is monitored 24/7 for optimal performance and reliability."
                  isExpanded={expandedItems.has('database-connection')}
                  onToggle={() => toggleItem('database-connection')}
                />

                <StatusItem
                  id="shopify-api"
                  label="Shopify API (ShopifyQL)"
                  status={data.shopifyMetrics && data.shopifyMetrics.source !== 'unavailable' ? 'success' : 'warning'}
                  statusText={data.shopifyMetrics && data.shopifyMetrics.source !== 'unavailable' ? 'OPERATIONAL' : 'LIMITED'}
                  description="ShopifyQL provides advanced analytics and order data from Shopify Plus stores. When available, it enables real-time order counting and enhanced dashboard metrics. If unavailable, the app automatically falls back to GraphQL API for data fetching with slightly delayed metrics."
                  isExpanded={expandedItems.has('shopify-api')}
                  onToggle={() => toggleItem('shopify-api')}
                />

                <StatusItem
                  id="customer-account-block"
                  label="Customer Account Block"
                  status={data.hasCustomerAccountBlock ? 'success' : 'warning'}
                  statusText={data.hasCustomerAccountBlock ? 'ACTIVE' : 'NOT DETECTED'}
                  description="The Customer Account Block is a UI extension that displays loyalty information directly in customer accounts. It shows tier status, rewards balance, transaction history, and redemption options. Customers can view and manage their loyalty benefits without leaving their account page."
                  isExpanded={expandedItems.has('customer-account-block')}
                  onToggle={() => toggleItem('customer-account-block')}
                />
              </BlockStack>

              {/* Configuration */}
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3" fontWeight="semibold">
                  Configuration
                </Text>

                <StatusItem
                  id="loyalty-tiers"
                  label="Loyalty Tiers"
                  status={data.setupComplete ? 'success' : 'critical'}
                  statusText={data.setupComplete ? 'CONFIGURED' : 'REQUIRED'}
                  description="Loyalty tiers define the membership levels in your rewards program. Each tier has a spending threshold and cashback percentage. Customers automatically move between tiers based on their purchase history. Configure tiers in Settings to set up your program structure and reward levels."
                  isExpanded={expandedItems.has('loyalty-tiers')}
                  onToggle={() => toggleItem('loyalty-tiers')}
                />

                <StatusItem
                  id="store-currency"
                  label="Store Currency"
                  status={data.shopSettings?.currencySelected ? 'success' : 'warning'}
                  statusText={data.shopSettings?.currencySelected ? `${data.shopSettings.storeCurrency} SET` : 'USING DEFAULT'}
                  description="Store currency determines how rewards, cashback, and credit are displayed throughout the app. Select your primary store currency to ensure consistent formatting in customer communications, dashboard displays, and transaction records. You can change this in Settings."
                  isExpanded={expandedItems.has('store-currency')}
                  onToggle={() => toggleItem('store-currency')}
                />

                <StatusItem
                  id="billing-plan"
                  label="Billing Plan"
                  status={data.activeSubscription ? 'success' : 'warning'}
                  statusText={data.activeSubscription ? data.activeSubscription.name.toUpperCase() : 'FREE PLAN'}
                  description="Your billing plan determines feature access and usage limits. The Free plan includes basic loyalty features with limited monthly orders. Paid plans unlock advanced analytics, automation, email campaigns, and higher order limits. Upgrade in the Billing section to access premium features."
                  isExpanded={expandedItems.has('billing-plan')}
                  onToggle={() => toggleItem('billing-plan')}
                />

                <StatusItem
                  id="tier-automation"
                  label="Tier Automation"
                  status={data.shopSettings?.tierRecalculationEnabled ? 'success' : 'warning'}
                  statusText={data.shopSettings?.tierRecalculationEnabled ? 'ENABLED' : 'DISABLED'}
                  description={`Tier automation automatically recalculates customer tier assignments based on their spending history at a set frequency (${data.shopSettings?.tierRecalculationFrequency || 'WEEKLY'}). When enabled, customers are automatically promoted or demoted between tiers as they reach spending thresholds. Last run: ${data.shopSettings?.tierRecalculationLastRun ? new Date(data.shopSettings.tierRecalculationLastRun).toLocaleDateString() : 'Never'}. Configure frequency in Settings.`}
                  isExpanded={expandedItems.has('tier-automation')}
                  onToggle={() => toggleItem('tier-automation')}
                />
              </BlockStack>

              {/* Data Sync */}
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3" fontWeight="semibold">
                  Data Synchronization
                </Text>

                <StatusItem
                  id="data-sync-database"
                  label="Database Connection"
                  status="success"
                  statusText="ACTIVE"
                  description="Real-time synchronization between your Shopify store and the RewardsPro database. All customer orders, tier assignments, and reward transactions are automatically synced to ensure accurate loyalty tracking. Connection is monitored continuously for data integrity."
                  isExpanded={expandedItems.has('data-sync-database')}
                  onToggle={() => toggleItem('data-sync-database')}
                />

                <StatusItem
                  id="customer-sync"
                  label="Customer Database"
                  status={data.shopSettings?.customersInitialSynced ? 'success' : data.shopSettings?.customersSyncInProgress ? 'warning' : 'critical'}
                  statusText={data.shopSettings?.customersInitialSynced ? `${data.metrics.totalCustomers} SYNCED` : data.shopSettings?.customersSyncInProgress ? 'SYNCING...' : 'NOT SYNCED'}
                  description="Customer data synchronization imports your Shopify customers into the RewardsPro system. This includes customer profiles, order history, and contact information needed for loyalty tracking. The initial sync runs when you install the app, then webhooks keep data updated in real-time as customers place orders."
                  isExpanded={expandedItems.has('customer-sync')}
                  onToggle={() => toggleItem('customer-sync')}
                />
              </BlockStack>

              {/* Overall System Status */}
              <Box paddingBlockStart="400" paddingBlockEnd="200">
                <InlineStack align="center" blockAlign="center" gap="200">
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: (data.hasWidget && data.setupComplete && data.shopSettings?.customersInitialSynced) ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: (data.hasWidget && data.setupComplete && data.shopSettings?.customersInitialSynced) ? '#22c55e' : '#eab308',
                      boxShadow: `0 0 8px ${(data.hasWidget && data.setupComplete && data.shopSettings?.customersInitialSynced) ? 'rgba(34, 197, 94, 0.6)' : 'rgba(234, 179, 8, 0.6)'}`
                    }} />
                  </div>
                  <Text variant="headingSm" as="h3" fontWeight="bold">
                    {(data.hasWidget && data.setupComplete && data.shopSettings?.customersInitialSynced)
                      ? '✓ All Systems Operational'
                      : 'Setup in Progress'}
                  </Text>
                </InlineStack>
              </Box>

              {/* Status Legend */}
              <Divider />
              <Box paddingBlockStart="300" paddingBlockEnd="200">
                <InlineStack gap="600" align="center" blockAlign="center">
                  {/* Green - Operating Normally */}
                  <InlineStack gap="200" blockAlign="center">
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(34, 197, 94, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <div style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: '#22c55e',
                        boxShadow: '0 0 5px rgba(34, 197, 94, 0.6)'
                      }} />
                    </div>
                    <Text variant="bodySm" tone="subdued" as="span">Operating normally</Text>
                  </InlineStack>

                  {/* Yellow - Recommended */}
                  <InlineStack gap="200" blockAlign="center">
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(234, 179, 8, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <div style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: '#eab308',
                        boxShadow: '0 0 5px rgba(234, 179, 8, 0.6)'
                      }} />
                    </div>
                    <Text variant="bodySm" tone="subdued" as="span">Configuration recommended</Text>
                  </InlineStack>

                  {/* Red - Needs Attention */}
                  <InlineStack gap="200" blockAlign="center">
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <div style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: '#ef4444',
                        boxShadow: '0 0 5px rgba(239, 68, 68, 0.6)'
                      }} />
                    </div>
                    <Text variant="bodySm" tone="subdued" as="span">Needs attention</Text>
                  </InlineStack>
                </InlineStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Feature Toggles */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">Feature Toggles</Text>
                <Text variant="bodySm" tone="subdued" as="span">
                  Control which features are active
                </Text>
              </InlineStack>

              <Text variant="bodyMd" tone="subdued" as="p">
                Enable or disable specific features for your store. Changes take effect immediately.
              </Text>

              <BlockStack gap="300">
                {/* Advanced Analytics */}
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" as="span" fontWeight="medium">
                      Advanced Analytics
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="span">
                      Detailed analytics charts and ROI calculations
                    </Text>
                  </BlockStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="bodySm" tone="subdued" as="span">
                      {data.shopSettings?.advancedAnalyticsEnabled ? 'Enabled' : 'Disabled'}
                    </Text>
                    <div
                      onClick={() => handleToggleFeature('advancedAnalyticsEnabled', data.shopSettings?.advancedAnalyticsEnabled ?? true)}
                      style={{
                        width: '44px',
                        height: '24px',
                        borderRadius: '12px',
                        backgroundColor: data.shopSettings?.advancedAnalyticsEnabled ? '#22c55e' : '#e5e7eb',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease',
                      }}
                    >
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        position: 'absolute',
                        top: '2px',
                        left: data.shopSettings?.advancedAnalyticsEnabled ? '22px' : '2px',
                        transition: 'left 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                      }} />
                    </div>
                  </InlineStack>
                </InlineStack>

                <Divider />

                {/* Automatic Cashback Processing */}
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" as="span" fontWeight="medium">
                      Automatic Cashback Processing
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="span">
                      Automatically credit cashback for completed orders
                    </Text>
                  </BlockStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="bodySm" tone="subdued" as="span">
                      {data.shopSettings?.autoCashbackProcessingEnabled ? 'Enabled' : 'Disabled'}
                    </Text>
                    <div
                      onClick={() => handleToggleFeature('autoCashbackProcessingEnabled', data.shopSettings?.autoCashbackProcessingEnabled ?? true)}
                      style={{
                        width: '44px',
                        height: '24px',
                        borderRadius: '12px',
                        backgroundColor: data.shopSettings?.autoCashbackProcessingEnabled ? '#22c55e' : '#e5e7eb',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease',
                      }}
                    >
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        position: 'absolute',
                        top: '2px',
                        left: data.shopSettings?.autoCashbackProcessingEnabled ? '22px' : '2px',
                        transition: 'left 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                      }} />
                    </div>
                  </InlineStack>
                </InlineStack>

                <Divider />

                {/* Email Marketing Campaign */}
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" as="span" fontWeight="medium">
                      Email Marketing Campaigns
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="span">
                      Automated email campaigns and communications
                    </Text>
                  </BlockStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="bodySm" tone="subdued" as="span">
                      {data.shopSettings?.emailMarketingEnabled ? 'Enabled' : 'Disabled'}
                    </Text>
                    <div
                      onClick={() => handleToggleFeature('emailMarketingEnabled', data.shopSettings?.emailMarketingEnabled ?? false)}
                      style={{
                        width: '44px',
                        height: '24px',
                        borderRadius: '12px',
                        backgroundColor: data.shopSettings?.emailMarketingEnabled ? '#22c55e' : '#e5e7eb',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease',
                      }}
                    >
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        position: 'absolute',
                        top: '2px',
                        left: data.shopSettings?.emailMarketingEnabled ? '22px' : '2px',
                        transition: 'left 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                      }} />
                    </div>
                  </InlineStack>
                </InlineStack>

                <Divider />

                {/* Tier Products Module */}
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" as="span" fontWeight="medium">
                      Tier Products Module
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="span">
                      Allow customers to purchase tier access
                    </Text>
                  </BlockStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="bodySm" tone="subdued" as="span">
                      {data.shopSettings?.tierProductsEnabled ? 'Enabled' : 'Disabled'}
                    </Text>
                    <div
                      onClick={() => handleToggleFeature('tierProductsEnabled', data.shopSettings?.tierProductsEnabled ?? true)}
                      style={{
                        width: '44px',
                        height: '24px',
                        borderRadius: '12px',
                        backgroundColor: data.shopSettings?.tierProductsEnabled ? '#22c55e' : '#e5e7eb',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease',
                      }}
                    >
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        position: 'absolute',
                        top: '2px',
                        left: data.shopSettings?.tierProductsEnabled ? '22px' : '2px',
                        transition: 'left 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                      }} />
                    </div>
                  </InlineStack>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Shopify Analytics - Native Data powered by ShopifyQL */}
        {data.shopifyMetrics && data.shopifyMetrics.source !== 'unavailable' && (
          <Layout.Section>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">Shopify Analytics (Last Month)</Text>
                <Text variant="bodySm" tone="subdued">
                  Powered by ShopifyQL {data.shopifyMetrics.source === 'cache' && '(cached)'}
                </Text>
              </InlineStack>
              <StatsOverview
                stats={[
                  {
                    label: "Total Revenue Impact",
                    value: formatAmount(data.shopifyMetrics.totalRevenue),
                    icon: CashDollarIcon,
                  },
                  {
                    label: "Active Shopify Customers",
                    value: data.shopifyMetrics.shopifyCustomers.toString(),
                    icon: PersonIcon,
                  },
                  {
                    label: "Avg Order Value",
                    value: formatAmount(data.shopifyMetrics.averageOrderValue),
                    icon: ChartVerticalIcon,
                  },
                  {
                    label: "Conversion Rate",
                    value: `${data.shopifyMetrics.conversionRate.toFixed(1)}%`,
                    icon: RewardIcon,
                  },
                ]}
              />
            </BlockStack>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}