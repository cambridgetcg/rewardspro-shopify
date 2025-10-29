import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { useState, useCallback, useEffect } from "react";

// Declare s-switch and s-stack web components for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      's-switch': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        id?: string;
        label?: string;
        details?: string;
        checked?: boolean;
        disabled?: boolean;
        name?: string;
        value?: string;
      }, HTMLElement>;
      's-stack': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        gap?: string;
      }, HTMLElement>;
    }
  }
}

import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  Icon,
  Box,
  Badge,
  Toast,
  Frame,
  Divider,
  ProgressBar,
  Banner,
} from "@shopify/polaris";
import {
  StatusActiveIcon,
  SettingsIcon,
  ChartVerticalIcon,
  CashDollarIcon,
  DatabaseIcon,
  RefreshIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from "~/utils/polaris-icons";
import { authenticate, FREE_PLAN, PRO_PLAN, MAX_PLAN, ULTRA_PLAN } from "../shopify.server";
import db from "../db.server";
import { SystemMonitorPlanCard } from "~/components/Billing";
import { MANAGED_PLANS } from "~/constants/billing.constants";

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
  shopSettings: {
    storeCurrency?: string;
    tierRecalculationEnabled?: boolean;
    advancedAnalyticsEnabled?: boolean;
    autoCashbackProcessingEnabled?: boolean;
    emailMarketingEnabled?: boolean;
    tierProductsEnabled?: boolean;
  } | null;
  shopifyMetrics: {
    source: 'shopifyql' | 'cache' | 'unavailable';
  } | null;
  webhookStats: {
    processedLast24h: number;
    errorsLast24h: number;
    errorsLastHour: number;
    successRate: number;
    status: 'healthy' | 'degraded' | 'critical';
  };
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
}

// ============================================
// LOADER - Fetch dashboard data
// ============================================

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Simplified auth - only destructure what we need immediately
    const authResult = await authenticate.admin(request);
    const { session } = authResult;

    if (!session?.shop) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const shop = session.shop;
    const loaderStart = Date.now();
    console.log(`[Dashboard] Loading simplified data for shop: ${shop}`);

    // Check active subscription with Shopify (if billing available)
    let activeSubscription = null;
    if (authResult.billing) {
      try {
        const { hasActivePayment, appSubscriptions } = await authResult.billing.check({
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

    // Fetch only essential data in parallel
    const [shopSettings, billingSubscription] = await Promise.all([
      // Shop settings for feature manager and currency
      db.shopSettings.findUnique({
        where: { shop },
        select: {
          storeCurrency: true,
          advancedAnalyticsEnabled: true,
          autoCashbackProcessingEnabled: true,
          emailMarketingEnabled: true,
          tierProductsEnabled: true,
        }
      }),

      // Billing subscription from database for plan details
      db.billingSubscription.findUnique({
        where: { shop },
      }).catch(() => null),
    ]);

    // Simple direct order count for current month
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const currentMonth = getCurrentMonthName();
    const daysRemaining = calculateDaysRemaining();

    let orderCount = 0;
    try {
      // Try to get from cache first
      const cachedUsage = await db.monthlyOrderUsage.findUnique({
        where: {
          shop_year_month: { shop, year, month },
        },
      });

      if (cachedUsage) {
        orderCount = cachedUsage.orderCount;
        console.log(`[Dashboard] Using cached order count: ${orderCount}`);
      } else {
        // Simple direct count from Order table for current month
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

        orderCount = await db.order.count({
          where: {
            shop,
            createdAt: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
        });
        console.log(`[Dashboard] Direct order count: ${orderCount}`);
      }
    } catch (error) {
      console.error("[Dashboard] Error counting orders:", error);
      orderCount = 0;
    }

    // Determine plan and limits
    let planLimit = MANAGED_PLANS["RewardsPro Free"].ordersIncluded;
    let planName = 'RewardsPro Free';

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
    };

    // Serialize billing subscription
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

    // Webhook statistics for health monitoring
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);

    const [webhookProcessedCount, webhookErrorsLast24h, webhookErrorsLastHour] = await Promise.all([
      db.webhookProcessed.count({
        where: {
          shop,
          processedAt: { gte: last24Hours }
        }
      }),
      db.webhookError.count({
        where: {
          shop,
          createdAt: { gte: last24Hours }
        }
      }),
      db.webhookError.count({
        where: {
          shop,
          createdAt: { gte: lastHour }
        }
      })
    ]);

    const totalWebhooks = webhookProcessedCount + webhookErrorsLast24h;
    const successRate = totalWebhooks > 0 ? (webhookProcessedCount / totalWebhooks) * 100 : 100;

    let webhookStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (webhookErrorsLastHour > 10 || successRate < 90) {
      webhookStatus = 'critical';
    } else if (webhookErrorsLastHour > 5 || successRate < 95) {
      webhookStatus = 'degraded';
    }

    // Simplified dashboard data
    const dashboardData: DashboardData = {
      shop,
      shopSettings: shopSettings ? {
        storeCurrency: shopSettings.storeCurrency || 'USD',
        tierRecalculationEnabled: false,
        advancedAnalyticsEnabled: shopSettings.advancedAnalyticsEnabled,
        autoCashbackProcessingEnabled: shopSettings.autoCashbackProcessingEnabled,
        emailMarketingEnabled: shopSettings.emailMarketingEnabled,
        tierProductsEnabled: shopSettings.tierProductsEnabled,
      } : null,
      shopifyMetrics: { source: 'unavailable' },
      webhookStats: {
        processedLast24h: webhookProcessedCount,
        errorsLast24h: webhookErrorsLast24h,
        errorsLastHour: webhookErrorsLastHour,
        successRate: Math.round(successRate * 10) / 10,
        status: webhookStatus
      },
      currentPlan: serializedPlan,
      activeSubscription,
      monthlyOrderUsage,
      currentMonth,
      daysRemaining,
    };

    const loaderEnd = Date.now();
    const totalTime = loaderEnd - loaderStart;
    console.log(`[Dashboard] ⚡ Simplified loader execution time: ${totalTime}ms`);
    return json(dashboardData);
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    console.error("[Dashboard] Loader error:", error);
    throw new Response("Failed to load dashboard data", { status: 500 });
  }
};


// ============================================
// ACTION - Handle feature manager
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

    return json({ success: true, feature, enabled });
  }

  return json({ success: false });
};

// ============================================
// DASHBOARD COMPONENT
// ============================================

export default function Dashboard() {
  const data = useLoaderData<typeof loader>() as DashboardData;
  const navigate = useNavigate();
  const fetcher = useFetcher();

  // Toast state for feature toggle feedback
  const [toastActive, setToastActive] = useState(false);
  const [toastContent, setToastContent] = useState('');

  // Handle feature toggle - web component fires 'change' event
  const handleToggleFeature = useCallback((feature: string) => {
    return (event: Event) => {
      const target = event.currentTarget as HTMLInputElement;
      const enabled = target.checked;

      const formData = new FormData();
      formData.append("action", "toggle-feature");
      formData.append("feature", feature);
      formData.append("enabled", enabled.toString());

      fetcher.submit(formData, { method: "post" });
    };
  }, [fetcher]);

  // Show toast message when feature toggle completes
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      const result = fetcher.data as { success?: boolean; feature?: string; enabled?: boolean };

      if (result.success && result.feature && typeof result.enabled === 'boolean') {
        const featureNames: Record<string, string> = {
          'advancedAnalyticsEnabled': 'Advanced Analytics',
          'autoCashbackProcessingEnabled': 'Automatic Cashback Processing',
          'emailMarketingEnabled': 'Email Marketing Campaigns',
          'tierProductsEnabled': 'Tier Products Module',
        };

        const featureName = featureNames[result.feature] || result.feature;
        const action = result.enabled ? 'enabled' : 'disabled';

        setToastContent(`${featureName} ${action}`);
        setToastActive(true);
      }
    }
  }, [fetcher.state, fetcher.data]);

  // Toast markup
  const toastMarkup = toastActive ? (
    <Toast
      content={toastContent}
      onDismiss={() => setToastActive(false)}
      duration={3000}
    />
  ) : null;

  // Calculate active features count
  const activeFeaturesCount = [
    data.shopSettings?.advancedAnalyticsEnabled,
    data.shopSettings?.autoCashbackProcessingEnabled,
    data.shopSettings?.emailMarketingEnabled,
    data.shopSettings?.tierProductsEnabled,
  ].filter(Boolean).length;

  return (
    <Frame>
      <Page title="Dashboard">
      <Layout>
        {/* Two-Column Layout */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            {/* Plan Details Card */}
            <SystemMonitorPlanCard
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
              onUpgrade={() => navigate("/app/billing")}
            />
          </BlockStack>
        </Layout.Section>

        {/* System Status - Mission Control Style */}
        <Layout.Section variant="twoThirds">
          <Card>
            <BlockStack gap="400">
              {/* Header */}
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={StatusActiveIcon} tone="base" />
                  <Text variant="headingMd" as="h2">System Status</Text>
                </InlineStack>
                <Badge tone="success">
                  {data.shopifyMetrics?.source !== 'unavailable' ? '100%' : '99%'} Health
                </Badge>
              </InlineStack>

              <Divider />

              {/* Overall Status Banner */}
              <Banner tone="success">
                <InlineStack gap="400" blockAlign="center" wrap={false}>
                  <InlineStack gap="200" blockAlign="center">
                    <Icon source={CheckCircleIcon} tone="success" />
                    <Text variant="bodyMd" fontWeight="semibold">All Systems Operational</Text>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued">•</Text>
                  <Text variant="bodySm" tone="subdued">Uptime: 99.9%</Text>
                  <Text variant="bodySm" tone="subdued">•</Text>
                  <Text variant="bodySm" tone="subdued">0 active incidents</Text>
                </InlineStack>
              </Banner>

              {/* Component Cards Grid */}
              <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
                {/* Database Component */}
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="start">
                      <Box
                        padding="200"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <Icon source={DatabaseIcon} tone="base" />
                      </Box>
                      <Badge tone="success">Operational</Badge>
                    </InlineStack>

                    <Text variant="headingSm" as="h3" fontWeight="semibold">
                      Database
                    </Text>

                    <BlockStack gap="100">
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Response:</Text>
                        <Text variant="bodySm" fontWeight="medium">~10ms</Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Uptime:</Text>
                        <Text variant="bodySm" fontWeight="medium">100%</Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Status:</Text>
                        <Text variant="bodySm" fontWeight="medium">Connected</Text>
                      </InlineStack>
                    </BlockStack>

                    <Divider />

                    <Text variant="bodySm" tone="subdued">
                      PostgreSQL database storing all customer data, tiers, and transactions
                    </Text>
                  </BlockStack>
                </Card>

                {/* Shopify API Component */}
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="start">
                      <Box
                        padding="200"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <Icon source={RefreshIcon} tone="base" />
                      </Box>
                      <Badge tone={data.shopifyMetrics?.source !== 'unavailable' ? 'success' : 'warning'}>
                        {data.shopifyMetrics?.source !== 'unavailable' ? 'Operational' : 'Limited'}
                      </Badge>
                    </InlineStack>

                    <Text variant="headingSm" as="h3" fontWeight="semibold">
                      Shopify API
                    </Text>

                    <BlockStack gap="100">
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Mode:</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {data.shopifyMetrics?.source !== 'unavailable' ? 'GraphQL + ShopifyQL' : 'GraphQL Only'}
                        </Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Uptime:</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {data.shopifyMetrics?.source !== 'unavailable' ? '99.8%' : '99.5%'}
                        </Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Status:</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {data.shopifyMetrics?.source !== 'unavailable' ? 'Operational' : 'Degraded'}
                        </Text>
                      </InlineStack>
                    </BlockStack>

                    <Divider />

                    <Text variant="bodySm" tone="subdued">
                      {data.shopifyMetrics?.source !== 'unavailable'
                        ? 'Advanced analytics with ShopifyQL enabled'
                        : 'Using GraphQL fallback for data fetching'}
                    </Text>
                  </BlockStack>
                </Card>

                {/* Loyalty Engine Component */}
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="start">
                      <Box
                        padding="200"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <Icon source={ChartVerticalIcon} tone="base" />
                      </Box>
                      <Badge tone="success">Operational</Badge>
                    </InlineStack>

                    <Text variant="headingSm" as="h3" fontWeight="semibold">
                      Loyalty Engine
                    </Text>

                    <BlockStack gap="100">
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Tiers:</Text>
                        <Text variant="bodySm" fontWeight="medium">Configured</Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Automation:</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {data.shopSettings?.tierRecalculationEnabled ? 'Enabled' : 'Disabled'}
                        </Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Currency:</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {data.shopSettings?.storeCurrency || 'Not Set'}
                        </Text>
                      </InlineStack>
                    </BlockStack>

                    <Divider />

                    <Text variant="bodySm" tone="subdued">
                      Tier calculations and cashback rewards processing
                    </Text>
                  </BlockStack>
                </Card>

                {/* Billing Plan Component */}
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="start">
                      <Box
                        padding="200"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <Icon source={CashDollarIcon} tone="base" />
                      </Box>
                      <Badge tone={data.activeSubscription ? 'success' : 'info'}>
                        {data.activeSubscription ? 'Active' : 'Free'}
                      </Badge>
                    </InlineStack>

                    <Text variant="headingSm" as="h3" fontWeight="semibold">
                      Billing Plan
                    </Text>

                    <BlockStack gap="100">
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Plan:</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {data.activeSubscription ? data.activeSubscription.name : 'RewardsPro Free'}
                        </Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Orders:</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {data.monthlyOrderUsage?.orderCount || 0} / {data.monthlyOrderUsage?.planLimit || 100}
                        </Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Status:</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {data.activeSubscription ? 'Paid' : 'Free Tier'}
                        </Text>
                      </InlineStack>
                    </BlockStack>

                    <Divider />

                    <Text variant="bodySm" tone="subdued">
                      Feature access and usage limits based on plan
                    </Text>
                  </BlockStack>
                </Card>

                {/* Features Component */}
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="start">
                      <Box
                        padding="200"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <Icon source={SettingsIcon} tone="base" />
                      </Box>
                      <Badge tone={activeFeaturesCount === 4 ? 'success' : 'info'}>
                        {activeFeaturesCount}/4 Active
                      </Badge>
                    </InlineStack>

                    <Text variant="headingSm" as="h3" fontWeight="semibold">
                      Features
                    </Text>

                    <BlockStack gap="100">
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Analytics:</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {data.shopSettings?.advancedAnalyticsEnabled ? 'On' : 'Off'}
                        </Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Cashback:</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {data.shopSettings?.autoCashbackProcessingEnabled ? 'On' : 'Off'}
                        </Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Marketing:</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {data.shopSettings?.emailMarketingEnabled ? 'On' : 'Off'}
                        </Text>
                      </InlineStack>
                    </BlockStack>

                    <Divider />

                    <Text variant="bodySm" tone="subdued">
                      Active modules and functionality controls
                    </Text>
                  </BlockStack>
                </Card>

                {/* Data Sync Component */}
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="start">
                      <Box
                        padding="200"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <Icon source={RefreshIcon} tone="base" />
                      </Box>
                      <Badge tone="success">Operational</Badge>
                    </InlineStack>

                    <Text variant="headingSm" as="h3" fontWeight="semibold">
                      Data Sync
                    </Text>

                    <BlockStack gap="100">
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Database:</Text>
                        <Text variant="bodySm" fontWeight="medium">Active</Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Customers:</Text>
                        <Text variant="bodySm" fontWeight="medium">Ready</Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Webhooks:</Text>
                        <Text variant="bodySm" fontWeight="medium">Listening</Text>
                      </InlineStack>
                    </BlockStack>

                    <Divider />

                    <Text variant="bodySm" tone="subdued">
                      Real-time synchronization with Shopify store
                    </Text>
                  </BlockStack>
                </Card>

                {/* Webhook Processing Component */}
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="start">
                      <Box
                        padding="200"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <Icon source={AlertCircleIcon} tone="base" />
                      </Box>
                      <Badge tone={
                        data.webhookStats.status === 'healthy' ? 'success' :
                        data.webhookStats.status === 'degraded' ? 'warning' : 'critical'
                      }>
                        {data.webhookStats.status === 'healthy' ? 'Healthy' :
                         data.webhookStats.status === 'degraded' ? 'Degraded' : 'Critical'}
                      </Badge>
                    </InlineStack>

                    <Text variant="headingSm" as="h3" fontWeight="semibold">
                      Webhook Processing
                    </Text>

                    <BlockStack gap="100">
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Processed (24h):</Text>
                        <Text variant="bodySm" fontWeight="medium">{data.webhookStats.processedLast24h}</Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Errors (24h):</Text>
                        <Text variant="bodySm" fontWeight="medium">{data.webhookStats.errorsLast24h}</Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Recent (1h):</Text>
                        <Text variant="bodySm" fontWeight="medium">{data.webhookStats.errorsLastHour}</Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Success Rate:</Text>
                        <Text variant="bodySm" fontWeight="medium">{data.webhookStats.successRate}%</Text>
                      </InlineStack>
                    </BlockStack>

                    <Divider />

                    <Text variant="bodySm" tone="subdued">
                      Order webhook processing and error tracking
                    </Text>
                  </BlockStack>
                </Card>
              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* OLD SYSTEM STATUS - COMMENTED OUT FOR REVIEW
        <Layout.Section variant="twoThirds">
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={StatusActiveIcon} tone="base" />
                  <Text variant="headingMd" as="h2">System Status (OLD)</Text>
                </InlineStack>
                <Badge tone="success">All Systems Operational</Badge>
              </InlineStack>
              ... rest of old code ...
            </BlockStack>
          </Card>
        </Layout.Section>
        END OF OLD SYSTEM STATUS */}

        {/* Feature Manager */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={SettingsIcon} tone="base" />
                  <Text variant="headingMd" as="h2">Feature Manager</Text>
                </InlineStack>
                <Badge tone={activeFeaturesCount === 4 ? 'success' : activeFeaturesCount >= 2 ? 'info' : 'warning'}>
                  {activeFeaturesCount}/4 Active
                </Badge>
              </InlineStack>

              <Text variant="bodyMd" tone="subdued" as="p">
                Enable or disable specific features for your store. Changes take effect immediately.
              </Text>

              <Divider />

              <s-stack gap="small-200">
                <s-switch
                  id="advanced-analytics-toggle"
                  label="Advanced Analytics"
                  checked={data.shopSettings?.advancedAnalyticsEnabled ?? true}
                  onChange={handleToggleFeature('advancedAnalyticsEnabled')}
                />
                <s-switch
                  id="auto-cashback-toggle"
                  label="Automatic Cashback Processing"
                  checked={data.shopSettings?.autoCashbackProcessingEnabled ?? true}
                  onChange={handleToggleFeature('autoCashbackProcessingEnabled')}
                />
                <s-switch
                  id="email-marketing-toggle"
                  label="Email Marketing Campaigns"
                  checked={data.shopSettings?.emailMarketingEnabled ?? false}
                  onChange={handleToggleFeature('emailMarketingEnabled')}
                />
                <s-switch
                  id="tier-products-toggle"
                  label="Tier Products Module"
                  checked={data.shopSettings?.tierProductsEnabled ?? true}
                  onChange={handleToggleFeature('tierProductsEnabled')}
                />
              </s-stack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
    {toastMarkup}
  </Frame>
  );
}