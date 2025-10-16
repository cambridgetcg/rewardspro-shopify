import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState, useCallback } from "react";
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

    // Check widget status using TWO methods:
    // 1. REST API - checks if widget is saved in theme settings
    // 2. Heartbeat - checks if widget is actually rendering on storefront
    let hasWidget = false;
    let widgetDetectionMethod = "none";

    try {
      console.log("[Dashboard] Checking widget status in theme...");

      // METHOD 1: Check REST API for saved theme settings
      let savedInTheme = false;
      try {
        const themesResponse = await admin.rest.get({
          path: 'themes',
          query: { role: 'main' },
        });
        const themesData = await themesResponse.json();
        const mainTheme = themesData?.themes?.[0];

        if (mainTheme?.id) {
          const themeId = mainTheme.id;
          console.log(`[Dashboard] Main theme ID: ${themeId} (${mainTheme.name})`);

          const assetResponse = await admin.rest.get({
            path: `themes/${themeId}/assets`,
            query: { 'asset[key]': 'config/settings_data.json' },
          });
          const assetData = await assetResponse.json();
          const assetValue = assetData?.asset?.value;

          if (assetValue) {
            const settings = JSON.parse(assetValue);
            const enabledEmbeds = settings.current?.enabled_app_embeds || [];

            console.log(`[Dashboard] enabled_app_embeds:`, enabledEmbeds);

            const possibleHandles = [
              'rewardspro-theme-extension',
              'theme-app-extension-rewardspro',
              'RewardsPro Theme Extension',
              'Membership Widget'
            ];

            savedInTheme = possibleHandles.some(handle => enabledEmbeds.includes(handle));
            console.log(`[Dashboard] Widget saved in theme: ${savedInTheme}`);
          }
        }
      } catch (error) {
        console.error("[Dashboard] Error checking theme settings:", error);
      }

      // METHOD 2: Check heartbeat from storefront widget
      let activeOnStorefront = false;
      try {
        const shopSettings = await db.shopSettings.findUnique({
          where: { shop },
          select: {
            widgetLastHeartbeat: true,
            widgetIsActive: true,
          }
        });

        if (shopSettings?.widgetLastHeartbeat) {
          const lastHeartbeat = new Date(shopSettings.widgetLastHeartbeat);
          const now = new Date();
          const minutesSinceHeartbeat = (now.getTime() - lastHeartbeat.getTime()) / (1000 * 60);

          // Consider active if heartbeat within last 5 minutes
          activeOnStorefront = minutesSinceHeartbeat < 5;

          console.log(`[Dashboard] Widget heartbeat: ${lastHeartbeat.toISOString()}`);
          console.log(`[Dashboard] Minutes since heartbeat: ${minutesSinceHeartbeat.toFixed(2)}`);
          console.log(`[Dashboard] Widget active on storefront: ${activeOnStorefront}`);
        } else {
          console.log(`[Dashboard] No widget heartbeat recorded yet`);
        }
      } catch (error) {
        console.error("[Dashboard] Error checking widget heartbeat:", error);
      }

      // Widget is considered "enabled" if EITHER method detects it
      // This handles both preview state and actual live rendering
      hasWidget = savedInTheme || activeOnStorefront;

      if (activeOnStorefront && savedInTheme) {
        widgetDetectionMethod = "both";
      } else if (activeOnStorefront) {
        widgetDetectionMethod = "heartbeat";
      } else if (savedInTheme) {
        widgetDetectionMethod = "theme-settings";
      }

      console.log(`[Dashboard] Widget detection result: ${hasWidget} (method: ${widgetDetectionMethod})`);

    } catch (error) {
      console.error("[Dashboard] Error checking widget status:", error);
      // Don't throw - just log and continue with hasWidget = false
    }

    // Fetch all data in parallel for performance
    const [
      shopSettings,
      customers,
      tiers,
      recentTransactions,
      billingSubscription,
    ] = await Promise.all([
      // Shop settings
      db.shopSettings.findUnique({
        where: { shop }
      }),

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
      } : null,
      // Billing data
      currentPlan: serializedPlan,
      activeSubscription,
      monthlyOrderUsage,
      currentMonth,
      daysRemaining,
      // Widget detection
      hasWidget,
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

        {/* Widget Setup Nudge - Only show if widget is not enabled */}
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
                        <img
                          src="/widget-toggle-guide.png"
                          alt="How to toggle the Membership Widget in Shopify theme editor"
                          style={{
                            width: '100%',
                            maxWidth: '400px',
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}
                        />
                        <Text variant="bodySm" tone="subdued" as="p">
                          Toggle the "Membership Widget" switch to ON to enable it on your storefront.
                        </Text>
                      </BlockStack>
                    </Box>
                  </Card>
                </Box>

                <Button
                  url={`https://${data.shop}/admin/themes/current/editor?context=apps`}
                  target="_blank"
                  variant="primary"
                >
                  Open theme editor
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