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
  Icon,
  Box,
  Badge,
  Banner,
  Collapsible,
  Toast,
  Frame,
} from "@shopify/polaris";
import {
  ChevronDownIcon,
  ChevronUpIcon,
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
      // Shop settings for feature manager
      db.shopSettings.findUnique({
        where: { shop },
        select: {
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
      case 'success': return { color: '#22c55e' };
      case 'warning': return { color: '#eab308' };
      case 'critical': return { color: '#ef4444' };
      default: return { color: '#9ca3af' };
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
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: lightColors.color,
        }} />

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
  const fetcher = useFetcher();

  // System status expanded items state
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Toast state for feature toggle feedback
  const [toastActive, setToastActive] = useState(false);
  const [toastContent, setToastContent] = useState('');

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

  return (
    <Frame>
      <Page
        title="Dashboard"
    >
      <Layout>
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
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '16px',
                  }}>
                    {/* Operating Normally */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#22c55e',
                      }} />
                      <Text variant="bodySm" as="span" fontWeight="medium">
                        Operating normally
                      </Text>
                    </div>

                    {/* Configuration Recommended */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#eab308',
                      }} />
                      <Text variant="bodySm" as="span" fontWeight="medium">
                        Configuration recommended
                      </Text>
                    </div>

                    {/* Needs Attention */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#ef4444',
                      }} />
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
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: (data.setupComplete && data.shopSettings?.customersInitialSynced) ? '#22c55e' : '#eab308',
                  }} />
                  <Text variant="headingSm" as="h3" fontWeight="bold">
                    {(data.setupComplete && data.shopSettings?.customersInitialSynced)
                      ? '✓ All Systems Operational'
                      : 'Setup in Progress'}
                  </Text>
                </InlineStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Feature Manager */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">Feature Manager</Text>
                <Text variant="bodySm" tone="subdued" as="span">
                  Control which features are active
                </Text>
              </InlineStack>

              <Text variant="bodyMd" tone="subdued" as="p">
                Enable or disable specific features for your store. Changes take effect immediately.
              </Text>

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