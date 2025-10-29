import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  Box,
  Badge,
  Divider,
  ProgressBar,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Plan Details Mock Data
  return json({
    planCard: {
      planName: "RewardsPro Growth",
      planPrice: "$49.00",
      billingCycle: "monthly",
      ordersUsed: 1247,
      ordersLimit: 2000,
      percentageUsed: 62.35,
      daysRemaining: 18,
      daysInCycle: 30,
      renewalDate: "November 16, 2025",
      nextBillingAmount: "$49.00",
      projectedOrders: 1850,
      projectedUsage: 92.5,
      overageRate: "$0.05",
      estimatedOverage: "$0.00",
      averageDailyOrders: 41.6,
      peakDailyOrders: 89,
      status: "active",
      autoRenew: true,
      canUpgrade: true,
      canDowngrade: false,
      efficiency: 78.2,
      costPerOrder: 0.039,
      lastBillingDate: "October 17, 2025",
      billingHistory: [
        { date: "Oct 17", amount: "$49.00", orders: 1892 },
        { date: "Sep 17", amount: "$49.00", orders: 1654 },
        { date: "Aug 17", amount: "$49.00", orders: 1423 },
      ],
      nextTier: {
        name: "RewardsPro Max",
        price: "$99.00",
        ordersLimit: 5000,
        savings: "$240/year vs overage"
      }
    }
  });
};

export default function DashboardMockups() {
  const data = useLoaderData<typeof loader>();
  const plan = data.planCard;

  return (
    <Page title="Plan Card Layout Options" subtitle="Techy & Professional Executive Designs">
      <Layout>
        {/* Option M: Terminal Dashboard */}
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Box paddingBlockEnd="200">
                <BlockStack gap="100">
                  <Text variant="headingLg" as="h2">
                    Option M: Terminal Dashboard
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    Monospace fonts, terminal-style data display, zero icons
                  </Text>
                </BlockStack>
              </Box>

              <Divider />

              {/* Terminal-style Header */}
              <Box
                padding="400"
                background="bg-surface-secondary"
                borderRadius="200"
              >
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="start">
                    <BlockStack gap="100">
                      <Text variant="bodySm" tone="subdued" fontWeight="regular">
                        $ PLAN_NAME
                      </Text>
                      <Text variant="headingLg" as="h3" fontWeight="bold">
                        {plan.planName}
                      </Text>
                    </BlockStack>
                    <BlockStack gap="100" inlineAlign="end">
                      <Text variant="bodySm" tone="subdued" fontWeight="regular">
                        $ COST
                      </Text>
                      <Text variant="headingLg" as="p" fontWeight="bold">
                        {plan.planPrice}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </BlockStack>
              </Box>

              {/* Data Grid - Monospace Style */}
              <Box>
                <BlockStack gap="200">
                  {/* Main Metric */}
                  <Box
                    padding="400"
                    background="bg-surface"
                    borderRadius="200"
                  >
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">
                          USAGE_CURRENT
                        </Text>
                        <Badge tone={plan.percentageUsed > 90 ? 'critical' : plan.percentageUsed > 75 ? 'warning' : 'success'}>
                          {plan.percentageUsed.toFixed(1)}%
                        </Badge>
                      </InlineStack>

                      <Text variant="heading3xl" as="p" alignment="center">
                        {plan.ordersUsed.toLocaleString()}
                        <Text variant="headingMd" as="span" tone="subdued">
                          {' '}/ {plan.ordersLimit.toLocaleString()}
                        </Text>
                      </Text>

                      <ProgressBar
                        progress={plan.percentageUsed}
                        tone={plan.percentageUsed > 90 ? 'critical' : plan.percentageUsed > 75 ? 'warning' : 'success'}
                        size="small"
                      />
                    </BlockStack>
                  </Box>

                  {/* System Metrics */}
                  <InlineGrid columns={2} gap="200">
                    <Box
                      padding="300"
                      background="bg-surface"
                      borderRadius="200"
                    >
                      <BlockStack gap="100">
                        <Text variant="bodySm" tone="subdued">
                          CYCLE_REMAIN
                        </Text>
                        <Text variant="headingMd" as="p">
                          {plan.daysRemaining}d
                        </Text>
                      </BlockStack>
                    </Box>

                    <Box
                      padding="300"
                      background="bg-surface"
                      borderRadius="200"
                    >
                      <BlockStack gap="100">
                        <Text variant="bodySm" tone="subdued">
                          PROJECTED
                        </Text>
                        <Text variant="headingMd" as="p">
                          {plan.projectedOrders.toLocaleString()}
                        </Text>
                      </BlockStack>
                    </Box>
                  </InlineGrid>

                  {/* Cost Efficiency */}
                  <InlineGrid columns={2} gap="200">
                    <Box
                      padding="300"
                      background="bg-surface"
                      borderRadius="200"
                    >
                      <BlockStack gap="100">
                        <Text variant="bodySm" tone="subdued">
                          COST_ORDER
                        </Text>
                        <Text variant="headingMd" as="p">
                          ${plan.costPerOrder.toFixed(3)}
                        </Text>
                      </BlockStack>
                    </Box>

                    <Box
                      padding="300"
                      background="bg-surface"
                      borderRadius="200"
                    >
                      <BlockStack gap="100">
                        <Text variant="bodySm" tone="subdued">
                          EFFICIENCY
                        </Text>
                        <Text variant="headingMd" as="p">
                          {plan.efficiency}%
                        </Text>
                      </BlockStack>
                    </Box>
                  </InlineGrid>
                </BlockStack>
              </Box>

              {/* Terminal Footer */}
              <Box
                padding="300"
                background={plan.projectedUsage > 100 ? "bg-surface-critical-subdued" : "bg-surface-secondary"}
                borderRadius="200"
              >
                <BlockStack gap="100">
                  <Text variant="bodySm" tone="subdued">
                    $ NEXT_BILLING
                  </Text>
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="bodyMd" fontWeight="semibold">
                      {plan.renewalDate}
                    </Text>
                    <Text variant="bodyMd" fontWeight="semibold">
                      {plan.nextBillingAmount}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Option N: Analytics Pro */}
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Box paddingBlockEnd="200">
                <BlockStack gap="100">
                  <Text variant="headingLg" as="h2">
                    Option N: Analytics Pro
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    Clean modern analytics with metric cards and data focus
                  </Text>
                </BlockStack>
              </Box>

              <Divider />

              {/* Clean Header */}
              <InlineStack align="space-between" blockAlign="start">
                <BlockStack gap="200">
                  <Text variant="headingLg" as="h3" fontWeight="semibold">
                    {plan.planName}
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    {plan.billingCycle} • renews {plan.renewalDate.split(',')[0]}
                  </Text>
                </BlockStack>
                <BlockStack gap="100" inlineAlign="end">
                  <Text variant="heading2xl" as="p">
                    {plan.planPrice}
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    USD/month
                  </Text>
                </BlockStack>
              </InlineStack>

              <Divider />

              {/* Primary Usage Card */}
              <Box
                padding="400"
                background="bg-surface-secondary"
                borderRadius="300"
              >
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="bodyMd" fontWeight="semibold">
                      Order Processing
                    </Text>
                    <Badge tone={plan.percentageUsed > 90 ? 'critical' : plan.percentageUsed > 75 ? 'warning' : 'info'}>
                      {Math.round(plan.percentageUsed)}% Capacity
                    </Badge>
                  </InlineStack>

                  <InlineStack align="space-between" blockAlign="end">
                    <BlockStack gap="100">
                      <Text variant="heading3xl" as="p">
                        {plan.ordersUsed.toLocaleString()}
                      </Text>
                      <Text variant="bodySm" tone="subdued">
                        Current usage
                      </Text>
                    </BlockStack>
                    <BlockStack gap="100" inlineAlign="end">
                      <Text variant="headingLg" as="p" tone="subdued">
                        {plan.ordersLimit.toLocaleString()}
                      </Text>
                      <Text variant="bodySm" tone="subdued">
                        Plan limit
                      </Text>
                    </BlockStack>
                  </InlineStack>

                  <ProgressBar
                    progress={plan.percentageUsed}
                    tone={plan.percentageUsed > 90 ? 'critical' : plan.percentageUsed > 75 ? 'warning' : 'success'}
                  />
                </BlockStack>
              </Box>

              {/* Metrics Grid */}
              <InlineGrid columns={3} gap="300">
                <Box
                  padding="300"
                  background="bg-surface"
                  borderRadius="200"
                >
                  <BlockStack gap="150" inlineAlign="center">
                    <Text variant="heading2xl" as="p" alignment="center">
                      {plan.daysRemaining}
                    </Text>
                    <Text variant="bodySm" tone="subdued" alignment="center">
                      Days left
                    </Text>
                  </BlockStack>
                </Box>

                <Box
                  padding="300"
                  background="bg-surface"
                  borderRadius="200"
                >
                  <BlockStack gap="150" inlineAlign="center">
                    <Text variant="heading2xl" as="p" alignment="center">
                      {plan.averageDailyOrders.toFixed(0)}
                    </Text>
                    <Text variant="bodySm" tone="subdued" alignment="center">
                      Daily avg
                    </Text>
                  </BlockStack>
                </Box>

                <Box
                  padding="300"
                  background="bg-surface"
                  borderRadius="200"
                >
                  <BlockStack gap="150" inlineAlign="center">
                    <Text variant="heading2xl" as="p" alignment="center">
                      {plan.peakDailyOrders}
                    </Text>
                    <Text variant="bodySm" tone="subdued" alignment="center">
                      Peak day
                    </Text>
                  </BlockStack>
                </Box>
              </InlineGrid>

              {/* Financial Metrics */}
              <Box
                padding="400"
                background="bg-surface"
                borderRadius="200"
              >
                <BlockStack gap="300">
                  <Text variant="bodyMd" fontWeight="semibold">
                    Cost Analysis
                  </Text>

                  <InlineGrid columns={2} gap="400">
                    <BlockStack gap="100">
                      <Text variant="bodySm" tone="subdued">
                        Cost per order
                      </Text>
                      <Text variant="headingMd" as="p">
                        ${plan.costPerOrder.toFixed(3)}
                      </Text>
                    </BlockStack>

                    <BlockStack gap="100" inlineAlign="end">
                      <Text variant="bodySm" tone="subdued">
                        Plan efficiency
                      </Text>
                      <Text variant="headingMd" as="p">
                        {plan.efficiency}%
                      </Text>
                    </BlockStack>
                  </InlineGrid>

                  <Divider />

                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="bodySm" tone="subdued">
                      Projected: {plan.projectedOrders.toLocaleString()} orders
                    </Text>
                    {plan.projectedUsage > 100 && (
                      <Badge tone="critical">
                        Over limit
                      </Badge>
                    )}
                  </InlineStack>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Option O: System Monitor */}
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Box paddingBlockEnd="200">
                <BlockStack gap="100">
                  <Text variant="headingLg" as="h2">
                    Option O: System Monitor
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    Technical system monitor with status indicators
                  </Text>
                </BlockStack>
              </Box>

              <Divider />

              {/* Status Header */}
              <Box
                padding="400"
                background="bg-surface-secondary"
                borderRadius="200"
              >
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="headingMd" as="h3" fontWeight="semibold">
                      {plan.planName}
                    </Text>
                    <Badge tone="success">
                      {plan.status.toUpperCase()}
                    </Badge>
                  </InlineStack>

                  <InlineGrid columns={2} gap="400">
                    <BlockStack gap="050">
                      <Text variant="bodySm" tone="subdued">
                        Plan Rate
                      </Text>
                      <Text variant="headingLg" as="p">
                        {plan.planPrice}
                      </Text>
                    </BlockStack>

                    <BlockStack gap="050" inlineAlign="end">
                      <Text variant="bodySm" tone="subdued">
                        Billing
                      </Text>
                      <Text variant="headingLg" as="p">
                        {plan.billingCycle}
                      </Text>
                    </BlockStack>
                  </InlineGrid>
                </BlockStack>
              </Box>

              {/* Resource Monitor */}
              <Box
                padding="400"
                background="bg-surface"
                borderRadius="200"
              >
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="bodySm" fontWeight="semibold">
                      Resource Utilization
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      {plan.percentageUsed.toFixed(2)}%
                    </Text>
                  </InlineStack>

                  <ProgressBar
                    progress={plan.percentageUsed}
                    tone={plan.percentageUsed > 90 ? 'critical' : plan.percentageUsed > 75 ? 'warning' : 'success'}
                  />

                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="headingLg" as="p">
                      {plan.ordersUsed.toLocaleString()}
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      of {plan.ordersLimit.toLocaleString()}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Box>

              {/* System Metrics Table */}
              <Box
                padding="400"
                background="bg-surface-secondary"
                borderRadius="200"
              >
                <BlockStack gap="300">
                  <Text variant="bodySm" fontWeight="semibold">
                    System Metrics
                  </Text>

                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodySm" tone="subdued">
                        Cycle Remaining
                      </Text>
                      <Text variant="bodyMd" fontWeight="medium">
                        {plan.daysRemaining}d / {plan.daysInCycle}d
                      </Text>
                    </InlineStack>

                    <Divider />

                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodySm" tone="subdued">
                        Daily Throughput
                      </Text>
                      <Text variant="bodyMd" fontWeight="medium">
                        {plan.averageDailyOrders.toFixed(1)} avg
                      </Text>
                    </InlineStack>

                    <Divider />

                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodySm" tone="subdued">
                        Peak Load
                      </Text>
                      <Text variant="bodyMd" fontWeight="medium">
                        {plan.peakDailyOrders} orders
                      </Text>
                    </InlineStack>

                    <Divider />

                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodySm" tone="subdued">
                        Projected Load
                      </Text>
                      <Text variant="bodyMd" fontWeight="medium">
                        {plan.projectedOrders.toLocaleString()}
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Box>

              {/* Performance Indicators */}
              <InlineGrid columns={2} gap="300">
                <Box
                  padding="300"
                  background="bg-surface"
                  borderRadius="200"
                >
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued">
                      Unit Cost
                    </Text>
                    <Text variant="headingMd" as="p">
                      ${plan.costPerOrder.toFixed(3)}
                    </Text>
                  </BlockStack>
                </Box>

                <Box
                  padding="300"
                  background="bg-surface"
                  borderRadius="200"
                >
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued">
                      Efficiency
                    </Text>
                    <Text variant="headingMd" as="p">
                      {plan.efficiency}%
                    </Text>
                  </BlockStack>
                </Box>
              </InlineGrid>

              {/* Next Billing */}
              <Box
                padding="300"
                background={plan.projectedUsage > 100 ? "bg-surface-critical-subdued" : "bg-surface"}
                borderRadius="200"
              >
                <BlockStack gap="100">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="bodySm" fontWeight="semibold">
                      Next Billing Event
                    </Text>
                    {plan.projectedUsage > 100 && (
                      <Badge tone="critical">Alert</Badge>
                    )}
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued">
                    {plan.renewalDate} • {plan.nextBillingAmount}
                  </Text>
                  {plan.projectedUsage > 100 && (
                    <Text variant="bodySm" tone="critical">
                      Estimated overage: +${((plan.projectedOrders - plan.ordersLimit) * 0.05).toFixed(2)}
                    </Text>
                  )}
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
