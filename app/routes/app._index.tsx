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
  EmptyState,
  DataTable,
  Banner,
  Select,
} from "@shopify/polaris";
import {
  PlusIcon,
  RefreshIcon,
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
} from "../components/DesignSystem";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { formatCurrency } from "../utils/currency";
import { CurrentPlanCard } from "~/components/Billing";
import { MANAGED_PLANS } from "~/constants/billing.constants";
import { countOrdersWithFallback, countOrdersDateExtraction, getOrCreateMonthlyCount, countOrdersDirectDataAPI, countOrdersEpochComparison } from "~/utils/order-count-strategies";
import { getMonthlyOrderCount, getDashboardMetrics, withAuroraFallback, type DashboardMetrics } from "~/services/shopifyql.service";
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
    // Fetch ShopifyQL metrics (Shopify native data) - independent of Aurora queries
    let shopifyMetrics: DashboardData['shopifyMetrics'] = null;
    try {
      console.log('[Dashboard] Fetching ShopifyQL metrics...');
      const metrics = await getDashboardMetrics(admin, '-1m', true, 10);
      shopifyMetrics = {
        totalRevenue: metrics.totalRevenue,
        totalOrders: metrics.totalOrders,
        averageOrderValue: metrics.averageOrderValue,
        shopifyCustomers: metrics.totalCustomers,
        conversionRate: metrics.conversionRate,
        source: metrics.source,
      };
      console.log(`[Dashboard] ⚡ ShopifyQL metrics loaded (${metrics.source})`);
    } catch (error) {
      console.warn('[Dashboard] ShopifyQL metrics unavailable, continuing without them:', error);
      shopifyMetrics = {
        totalRevenue: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        shopifyCustomers: 0,
        conversionRate: 0,
        source: 'unavailable',
      };
    }

    // Note: shopSettings already fetched above, so we fetch only remaining data here
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

    // Count orders using ShopifyQL-first strategy with fallback
    let orderCount = 0;
    let orderCountStrategy = "unknown";

    try {
      const perfOrderStart = Date.now();
      console.log(`[Dashboard] Attempting to count orders for ${shop} - ${currentMonth} ${year}`);

      // Try ShopifyQL first (fastest, leverages Shopify's infrastructure)
      try {
        console.log(`[Dashboard] Trying ShopifyQL for order count`);
        const shopifyqlResult = await getMonthlyOrderCount(admin, true, 10);
        orderCount = shopifyqlResult.count;
        orderCountStrategy = shopifyqlResult.source === 'cache' ? 'ShopifyQL-Cached' : 'ShopifyQL';
        console.log(`[Dashboard] ⚡ ShopifyQL succeeded with count: ${orderCount} (${shopifyqlResult.source})`);
      } catch (shopifyqlError) {
        console.warn(`[Dashboard] ShopifyQL failed, falling back to Aurora:`, shopifyqlError);

        // Fallback to Aurora cache-first strategy
        const cachedUsage = await db.monthlyOrderUsage.findUnique({
          where: {
            shop_year_month: {
              shop,
              year,
              month,
            },
          },
        });

        const now = new Date();
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
  const { navigate: shopifyNavigate } = useShopifyNavigation();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Currency selection state
  const [selectedCurrency, setSelectedCurrency] = useState(data.shopSettings?.storeCurrency || "USD");
  const [isSavingCurrency, setIsSavingCurrency] = useState(false);

  // Widget setup guide expansion state
  const [widgetGuideExpanded, setWidgetGuideExpanded] = useState(false);

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
            {!widgetGuideExpanded ? (
              /* Simplified View - Show by default */
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="start">
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h2">
                        Add RewardsPro widget to your store theme
                      </Text>
                      <Text variant="bodyMd" tone="subdued" as="p">
                        Enable the widget in your theme to display rewards on your storefront
                      </Text>
                    </BlockStack>
                    <Badge tone="warning">Action Required</Badge>
                  </InlineStack>

                  <InlineStack gap="200" align="start">
                    <Button
                      onClick={() => setWidgetGuideExpanded(true)}
                      variant="primary"
                    >
                      Follow setup guide
                    </Button>
                    <Button
                      onClick={() => {
                        window.open(
                          `https://${data.shop}/admin/themes/current/editor?context=apps&activateAppId=026ce3bf073bed0e44ae8eab09d1ae3a/membership_widget`,
                          '_blank'
                        );
                      }}
                    >
                      Open theme editor
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            ) : (
              /* Expanded View - Show detailed guide */
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

                  <InlineStack gap="200" align="start">
                    <Button
                      onClick={() => {
                        window.open(
                          `https://${data.shop}/admin/themes/current/editor?context=apps&activateAppId=026ce3bf073bed0e44ae8eab09d1ae3a/membership_widget`,
                          '_blank'
                        );
                      }}
                      variant="primary"
                    >
                      Open theme editor
                    </Button>
                    <Button
                      onClick={() => setWidgetGuideExpanded(false)}
                    >
                      Hide guide
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Banner>
            )}
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

              {/* Core Systems */}
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3" fontWeight="semibold">
                  Core Systems
                </Text>

                {/* Widget Status */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  backgroundColor: data.hasWidget ? '#f0fdf4' : '#fef3c7',
                  border: `1px solid ${data.hasWidget ? '#86efac' : '#fbbf24'}`,
                  borderRadius: '8px',
                  cursor: data.hasWidget ? 'default' : 'pointer',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: data.hasWidget ? '#22c55e' : '#eab308',
                    boxShadow: data.hasWidget ? '0 0 8px rgba(34, 197, 94, 0.4)' : '0 0 8px rgba(234, 179, 8, 0.4)'
                  }} />
                  <Text variant="bodyMd" as="span" fontWeight="medium">
                    Storefront Widget
                  </Text>
                  <div style={{ marginLeft: 'auto' }}>
                    <Badge tone={data.hasWidget ? 'success' : 'warning'}>
                      {data.hasWidget ? 'ACTIVE' : 'NOT DETECTED'}
                    </Badge>
                  </div>
                </div>

                {/* Database Connection */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: '8px'
                }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#22c55e',
                    boxShadow: '0 0 8px rgba(34, 197, 94, 0.4)'
                  }} />
                  <Text variant="bodyMd" as="span" fontWeight="medium">
                    Database Connection
                  </Text>
                  <div style={{ marginLeft: 'auto' }}>
                    <Badge tone="success">CONNECTED</Badge>
                  </div>
                </div>

                {/* Shopify API */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  backgroundColor: data.shopifyMetrics && data.shopifyMetrics.source !== 'unavailable' ? '#f0fdf4' : '#fef3c7',
                  border: `1px solid ${data.shopifyMetrics && data.shopifyMetrics.source !== 'unavailable' ? '#86efac' : '#fbbf24'}`,
                  borderRadius: '8px'
                }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: data.shopifyMetrics && data.shopifyMetrics.source !== 'unavailable' ? '#22c55e' : '#eab308',
                    boxShadow: `0 0 8px ${data.shopifyMetrics && data.shopifyMetrics.source !== 'unavailable' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(234, 179, 8, 0.4)'}`
                  }} />
                  <Text variant="bodyMd" as="span" fontWeight="medium">
                    Shopify API (ShopifyQL)
                  </Text>
                  <div style={{ marginLeft: 'auto' }}>
                    <Badge tone={data.shopifyMetrics && data.shopifyMetrics.source !== 'unavailable' ? 'success' : 'warning'}>
                      {data.shopifyMetrics && data.shopifyMetrics.source !== 'unavailable' ? 'OPERATIONAL' : 'LIMITED'}
                    </Badge>
                  </div>
                </div>
              </BlockStack>

              {/* Configuration */}
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3" fontWeight="semibold">
                  Configuration
                </Text>

                {/* Tiers Setup */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  backgroundColor: data.setupComplete ? '#f0fdf4' : '#fee2e2',
                  border: `1px solid ${data.setupComplete ? '#86efac' : '#fca5a5'}`,
                  borderRadius: '8px'
                }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: data.setupComplete ? '#22c55e' : '#ef4444',
                    boxShadow: `0 0 8px ${data.setupComplete ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
                  }} />
                  <Text variant="bodyMd" as="span" fontWeight="medium">
                    Loyalty Tiers
                  </Text>
                  <div style={{ marginLeft: 'auto' }}>
                    <Badge tone={data.setupComplete ? 'success' : 'critical'}>
                      {data.setupComplete ? 'CONFIGURED' : 'REQUIRED'}
                    </Badge>
                  </div>
                </div>

                {/* Currency Selection */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  backgroundColor: data.shopSettings?.currencySelected ? '#f0fdf4' : '#fef3c7',
                  border: `1px solid ${data.shopSettings?.currencySelected ? '#86efac' : '#fbbf24'}`,
                  borderRadius: '8px'
                }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: data.shopSettings?.currencySelected ? '#22c55e' : '#eab308',
                    boxShadow: `0 0 8px ${data.shopSettings?.currencySelected ? 'rgba(34, 197, 94, 0.4)' : 'rgba(234, 179, 8, 0.4)'}`
                  }} />
                  <Text variant="bodyMd" as="span" fontWeight="medium">
                    Store Currency
                  </Text>
                  <div style={{ marginLeft: 'auto' }}>
                    <Badge tone={data.shopSettings?.currencySelected ? 'success' : 'warning'}>
                      {data.shopSettings?.currencySelected ? `${data.shopSettings.storeCurrency} SET` : 'USING DEFAULT'}
                    </Badge>
                  </div>
                </div>

                {/* Billing Status */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  backgroundColor: data.activeSubscription ? '#f0fdf4' : '#fef3c7',
                  border: `1px solid ${data.activeSubscription ? '#86efac' : '#fbbf24'}`,
                  borderRadius: '8px'
                }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: data.activeSubscription ? '#22c55e' : '#eab308',
                    boxShadow: `0 0 8px ${data.activeSubscription ? 'rgba(34, 197, 94, 0.4)' : 'rgba(234, 179, 8, 0.4)'}`
                  }} />
                  <Text variant="bodyMd" as="span" fontWeight="medium">
                    Billing Plan
                  </Text>
                  <div style={{ marginLeft: 'auto' }}>
                    <Badge tone={data.activeSubscription ? 'success' : 'warning'}>
                      {data.activeSubscription ? data.activeSubscription.name.toUpperCase() : 'FREE PLAN'}
                    </Badge>
                  </div>
                </div>

                {/* Tier Automation */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  backgroundColor: data.shopSettings?.tierRecalculationEnabled ? '#f0fdf4' : '#fef3c7',
                  border: `1px solid ${data.shopSettings?.tierRecalculationEnabled ? '#86efac' : '#fbbf24'}`,
                  borderRadius: '8px'
                }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: data.shopSettings?.tierRecalculationEnabled ? '#22c55e' : '#eab308',
                    boxShadow: `0 0 8px ${data.shopSettings?.tierRecalculationEnabled ? 'rgba(34, 197, 94, 0.4)' : 'rgba(234, 179, 8, 0.4)'}`
                  }} />
                  <Text variant="bodyMd" as="span" fontWeight="medium">
                    Tier Automation
                  </Text>
                  <div style={{ marginLeft: 'auto' }}>
                    <Badge tone={data.shopSettings?.tierRecalculationEnabled ? 'success' : 'warning'}>
                      {data.shopSettings?.tierRecalculationEnabled ? 'ENABLED' : 'DISABLED'}
                    </Badge>
                  </div>
                </div>
              </BlockStack>

              {/* Data Sync */}
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3" fontWeight="semibold">
                  Data Synchronization
                </Text>

                {/* Customer Sync */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  backgroundColor: data.shopSettings?.customersInitialSynced ? '#f0fdf4' :
                                   data.shopSettings?.customersSyncInProgress ? '#fef3c7' : '#fee2e2',
                  border: `1px solid ${data.shopSettings?.customersInitialSynced ? '#86efac' :
                                        data.shopSettings?.customersSyncInProgress ? '#fbbf24' : '#fca5a5'}`,
                  borderRadius: '8px'
                }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: data.shopSettings?.customersInitialSynced ? '#22c55e' :
                                     data.shopSettings?.customersSyncInProgress ? '#eab308' : '#ef4444',
                    boxShadow: `0 0 8px ${data.shopSettings?.customersInitialSynced ? 'rgba(34, 197, 94, 0.4)' :
                                          data.shopSettings?.customersSyncInProgress ? 'rgba(234, 179, 8, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
                  }} />
                  <Text variant="bodyMd" as="span" fontWeight="medium">
                    Customer Database
                  </Text>
                  <div style={{ marginLeft: 'auto' }}>
                    <Badge tone={data.shopSettings?.customersInitialSynced ? 'success' :
                                 data.shopSettings?.customersSyncInProgress ? 'attention' : 'critical'}>
                      {data.shopSettings?.customersInitialSynced ? `${data.metrics.totalCustomers} SYNCED` :
                       data.shopSettings?.customersSyncInProgress ? 'SYNCING...' : 'NOT SYNCED'}
                    </Badge>
                  </div>
                </div>
              </BlockStack>

              {/* Overall System Status */}
              <Box paddingBlockStart="400" paddingBlockEnd="200">
                <InlineStack align="center" blockAlign="center" gap="200">
                  <div style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: (data.hasWidget && data.setupComplete && data.shopSettings?.customersInitialSynced) ? '#22c55e' : '#eab308',
                    boxShadow: `0 0 10px ${(data.hasWidget && data.setupComplete && data.shopSettings?.customersInitialSynced) ? 'rgba(34, 197, 94, 0.5)' : 'rgba(234, 179, 8, 0.5)'}`
                  }} />
                  <Text variant="headingSm" as="h3" fontWeight="bold">
                    {(data.hasWidget && data.setupComplete && data.shopSettings?.customersInitialSynced)
                      ? '✓ All Systems Operational'
                      : '⚠ Action Required'}
                  </Text>
                </InlineStack>
              </Box>
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
                loading={isRefreshing}
              />
            </BlockStack>
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
      </Layout>
    </Page>
  );
}