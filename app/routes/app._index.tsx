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
} from "@shopify/polaris";
import {
  StatusActiveIcon,
  SettingsIcon,
  ChartVerticalIcon,
  CashDollarIcon,
} from "~/utils/polaris-icons";
import { authenticate, FREE_PLAN, PRO_PLAN, MAX_PLAN, ULTRA_PLAN } from "../shopify.server";
import db from "../db.server";
import { CurrentPlanCard } from "~/components/Billing";
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

  // Calculate plan usage percentage
  const planUsagePercent = data.monthlyOrderUsage
    ? (data.monthlyOrderUsage.orderCount / data.monthlyOrderUsage.planLimit) * 100
    : 0;

  return (
    <Frame>
      <Page title="Dashboard">
      <Layout>
        {/* Key Metrics Section */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
            {/* Orders This Month */}
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="start">
                  <Text variant="bodySm" tone="subdued">Orders This Month</Text>
                  <Icon source={ChartVerticalIcon} tone="base" />
                </InlineStack>
                <Text variant="heading2xl" as="h3">
                  {data.monthlyOrderUsage?.orderCount || 0}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  {data.daysRemaining} days remaining
                </Text>
              </BlockStack>
            </Card>

            {/* Plan Usage */}
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="start">
                  <Text variant="bodySm" tone="subdued">Plan Usage</Text>
                  <Icon source={StatusActiveIcon} tone="base" />
                </InlineStack>
                <Text variant="heading2xl" as="h3">
                  {Math.round(planUsagePercent)}%
                </Text>
                <ProgressBar
                  progress={planUsagePercent}
                  tone={planUsagePercent > 90 ? 'critical' : planUsagePercent > 75 ? 'warning' : 'primary'}
                  size="small"
                />
              </BlockStack>
            </Card>

            {/* Store Currency */}
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="start">
                  <Text variant="bodySm" tone="subdued">Store Currency</Text>
                  <Icon source={CashDollarIcon} tone="base" />
                </InlineStack>
                <Text variant="heading2xl" as="h3">
                  {data.shopSettings?.storeCurrency || 'USD'}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Primary currency
                </Text>
              </BlockStack>
            </Card>

            {/* Active Features */}
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="start">
                  <Text variant="bodySm" tone="subdued">Active Features</Text>
                  <Icon source={SettingsIcon} tone="base" />
                </InlineStack>
                <Text variant="heading2xl" as="h3">
                  {activeFeaturesCount}/4
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Modules enabled
                </Text>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        {/* Two-Column Layout */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            {/* Plan Details Card */}
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
          </BlockStack>
        </Layout.Section>

        {/* System Status Dashboard - Compact Version */}
        <Layout.Section variant="twoThirds">
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={StatusActiveIcon} tone="base" />
                  <Text variant="headingMd" as="h2">System Status</Text>
                </InlineStack>
                <Badge tone="success">All Systems Operational</Badge>
              </InlineStack>

              <Text variant="bodyMd" tone="subdued" as="p">
                Real-time health monitoring and configuration status
              </Text>

              <Divider />

              {/* Core Systems */}
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3" fontWeight="semibold">
                  Core Systems
                </Text>

                <InlineGrid columns={2} gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                    <BlockStack gap="050">
                      <Text variant="bodySm" fontWeight="semibold">Database</Text>
                      <Text variant="bodySm" tone="subdued">Connected</Text>
                    </BlockStack>
                  </InlineStack>

                  <InlineStack gap="200" blockAlign="center">
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: data.shopifyMetrics?.source !== 'unavailable' ? '#22c55e' : '#eab308'
                    }} />
                    <BlockStack gap="050">
                      <Text variant="bodySm" fontWeight="semibold">Shopify API</Text>
                      <Text variant="bodySm" tone="subdued">
                        {data.shopifyMetrics?.source !== 'unavailable' ? 'Operational' : 'Limited'}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </InlineGrid>
              </BlockStack>

              <Divider />

              {/* Configuration */}
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3" fontWeight="semibold">
                  Configuration
                </Text>

                <InlineGrid columns={2} gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                    <BlockStack gap="050">
                      <Text variant="bodySm" fontWeight="semibold">Loyalty Tiers</Text>
                      <Text variant="bodySm" tone="subdued">Configured</Text>
                    </BlockStack>
                  </InlineStack>

                  <InlineStack gap="200" blockAlign="center">
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: data.activeSubscription ? '#22c55e' : '#eab308'
                    }} />
                    <BlockStack gap="050">
                      <Text variant="bodySm" fontWeight="semibold">Billing Plan</Text>
                      <Text variant="bodySm" tone="subdued">
                        {data.activeSubscription ? data.activeSubscription.name : 'Free Plan'}
                      </Text>
                    </BlockStack>
                  </InlineStack>

                  <InlineStack gap="200" blockAlign="center">
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: data.shopSettings?.tierRecalculationEnabled ? '#22c55e' : '#eab308'
                    }} />
                    <BlockStack gap="050">
                      <Text variant="bodySm" fontWeight="semibold">Tier Automation</Text>
                      <Text variant="bodySm" tone="subdued">
                        {data.shopSettings?.tierRecalculationEnabled ? 'Enabled' : 'Disabled'}
                      </Text>
                    </BlockStack>
                  </InlineStack>

                  <InlineStack gap="200" blockAlign="center">
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: data.shopSettings?.storeCurrency ? '#22c55e' : '#eab308'
                    }} />
                    <BlockStack gap="050">
                      <Text variant="bodySm" fontWeight="semibold">Store Currency</Text>
                      <Text variant="bodySm" tone="subdued">
                        {data.shopSettings?.storeCurrency || 'Not Set'}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </InlineGrid>
              </BlockStack>

              <Divider />

              {/* Data Synchronization */}
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3" fontWeight="semibold">
                  Data Synchronization
                </Text>

                <InlineGrid columns={2} gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                    <BlockStack gap="050">
                      <Text variant="bodySm" fontWeight="semibold">Database Sync</Text>
                      <Text variant="bodySm" tone="subdued">Active</Text>
                    </BlockStack>
                  </InlineStack>

                  <InlineStack gap="200" blockAlign="center">
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                    <BlockStack gap="050">
                      <Text variant="bodySm" fontWeight="semibold">Customer Data</Text>
                      <Text variant="bodySm" tone="subdued">Ready</Text>
                    </BlockStack>
                  </InlineStack>
                </InlineGrid>
              </BlockStack>

              <Divider />

              {/* Status Legend */}
              <Box paddingBlockStart="200">
                <BlockStack gap="200">
                  <Text variant="bodySm" as="span" fontWeight="semibold">Status Indicators:</Text>
                  <InlineStack gap="400" wrap={false}>
                    <InlineStack gap="100" blockAlign="center">
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                      <Text variant="bodySm" tone="subdued" as="span">Operational</Text>
                    </InlineStack>
                    <InlineStack gap="100" blockAlign="center">
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#eab308' }} />
                      <Text variant="bodySm" tone="subdued" as="span">Attention Needed</Text>
                    </InlineStack>
                    <InlineStack gap="100" blockAlign="center">
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                      <Text variant="bodySm" tone="subdued" as="span">Critical</Text>
                    </InlineStack>
                  </InlineStack>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

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