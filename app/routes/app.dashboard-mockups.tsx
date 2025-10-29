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
  Icon,
  Box,
  Badge,
  Divider,
  ProgressBar,
  Banner,
} from "@shopify/polaris";
import {
  CashDollarIcon,
  ChartVerticalIcon,
  CalendarIcon,
  CartIcon,
  ClockIcon,
  StarFilledIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ArrowUpIcon,
} from "~/utils/polaris-icons";
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
    <Page title="Plan Card Layout Options" subtitle="Choose your preferred plan details design">
      <Layout>
        {/* Option J: Compact Executive */}
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Box paddingBlockEnd="200">
                <BlockStack gap="100">
                  <Text variant="headingLg" as="h2">
                    Option J: Compact Executive
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    Condensed metrics with large numbers and color-coded progress
                  </Text>
                </BlockStack>
              </Box>

              <Divider />

              {/* Plan Header */}
              <InlineStack align="space-between" blockAlign="start">
                <BlockStack gap="050">
                  <InlineStack gap="200" blockAlign="center">
                    <Icon source={StarFilledIcon} tone="warning" />
                    <Text variant="headingSm" as="h3" fontWeight="semibold">
                      {plan.planName}
                    </Text>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued">
                    {plan.billingCycle} billing
                  </Text>
                </BlockStack>
                <BlockStack gap="050" inlineAlign="end">
                  <Text variant="headingLg" as="p">{plan.planPrice}</Text>
                  <Text variant="bodySm" tone="subdued">/month</Text>
                </BlockStack>
              </InlineStack>

              <Divider />

              {/* Large Usage Display */}
              <Box
                padding="400"
                background="bg-surface-secondary"
                borderRadius="300"
              >
                <BlockStack gap="300" inlineAlign="center">
                  <Text variant="heading3xl" as="p" alignment="center">
                    {plan.ordersUsed.toLocaleString()}
                  </Text>
                  <Text variant="bodySm" tone="subdued" alignment="center">
                    of {plan.ordersLimit.toLocaleString()} orders used
                  </Text>
                  <ProgressBar
                    progress={plan.percentageUsed}
                    tone={plan.percentageUsed > 90 ? 'critical' : plan.percentageUsed > 75 ? 'warning' : 'success'}
                  />
                  <Text variant="bodySm" fontWeight="medium" alignment="center">
                    {plan.percentageUsed.toFixed(1)}% utilized
                  </Text>
                </BlockStack>
              </Box>

              {/* Quick Stats */}
              <InlineGrid columns={2} gap="300">
                <Box
                  padding="300"
                  background="bg-surface"
                  borderRadius="200"
                >
                  <BlockStack gap="100" inlineAlign="center">
                    <Icon source={ClockIcon} tone="base" />
                    <Text variant="headingMd" as="p" alignment="center">
                      {plan.daysRemaining}
                    </Text>
                    <Text variant="bodySm" tone="subdued" alignment="center">
                      days left
                    </Text>
                  </BlockStack>
                </Box>

                <Box
                  padding="300"
                  background="bg-surface"
                  borderRadius="200"
                >
                  <BlockStack gap="100" inlineAlign="center">
                    <Icon source={ChartVerticalIcon} tone="base" />
                    <Text variant="headingMd" as="p" alignment="center">
                      {plan.projectedOrders.toLocaleString()}
                    </Text>
                    <Text variant="bodySm" tone="subdued" alignment="center">
                      projected
                    </Text>
                  </BlockStack>
                </Box>
              </InlineGrid>

              {/* Renewal Info */}
              <Box
                padding="300"
                background={plan.projectedUsage > 100 ? "bg-surface-critical-subdued" : "bg-surface-success-subdued"}
                borderRadius="200"
              >
                <BlockStack gap="100">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="bodySm" fontWeight="semibold">Next Billing</Text>
                    <Badge tone={plan.projectedUsage > 100 ? "critical" : "success"}>
                      {plan.projectedUsage > 100 ? 'Over Limit' : 'On Track'}
                    </Badge>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued">
                    {plan.renewalDate} • {plan.nextBillingAmount}
                  </Text>
                  {plan.projectedUsage > 100 && (
                    <Text variant="bodySm" tone="critical">
                      Est. overage: +${((plan.projectedOrders - plan.ordersLimit) * 0.05).toFixed(2)}
                    </Text>
                  )}
                </BlockStack>
              </Box>

              {/* Footer Stats */}
              <InlineGrid columns={2} gap="200">
                <BlockStack gap="050">
                  <Text variant="bodySm" tone="subdued">Cost/Order</Text>
                  <Text variant="bodySm" fontWeight="medium">
                    ${plan.costPerOrder.toFixed(3)}
                  </Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text variant="bodySm" tone="subdued">Efficiency</Text>
                  <Text variant="bodySm" fontWeight="medium">
                    {plan.efficiency}%
                  </Text>
                </BlockStack>
              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Option K: Visual Dashboard */}
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Box paddingBlockEnd="200">
                <BlockStack gap="100">
                  <Text variant="headingLg" as="h2">
                    Option K: Visual Dashboard
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    Rich visuals with charts, badges, and detailed breakdowns
                  </Text>
                </BlockStack>
              </Box>

              <Divider />

              {/* Plan Badge Header */}
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Badge tone="success" size="large">{plan.status.toUpperCase()}</Badge>
                  <Text variant="headingMd" as="h3" fontWeight="semibold">
                    {plan.planName}
                  </Text>
                </BlockStack>
                <Text variant="heading2xl" as="p">{plan.planPrice}</Text>
              </InlineStack>

              {/* Circular Progress Visual */}
              <Box
                padding="400"
                background="bg-surface-secondary"
                borderRadius="300"
              >
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="bodySm" fontWeight="semibold">Order Usage</Text>
                    <Badge tone={plan.percentageUsed > 90 ? "critical" : plan.percentageUsed > 75 ? "warning" : "info"}>
                      {Math.round(plan.percentageUsed)}%
                    </Badge>
                  </InlineStack>

                  {/* Visual Bar Chart */}
                  <div style={{ position: 'relative', height: '60px', display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                    {/* Used */}
                    <div style={{ flex: plan.ordersUsed, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Text variant="bodySm" fontWeight="medium" alignment="center">
                        {plan.ordersUsed.toLocaleString()}
                      </Text>
                      <div style={{
                        width: '100%',
                        height: '40px',
                        backgroundColor: '#22c55e',
                        borderRadius: '4px 4px 0 0',
                        marginTop: '4px'
                      }} />
                    </div>
                    {/* Remaining */}
                    <div style={{ flex: plan.ordersLimit - plan.ordersUsed, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Text variant="bodySm" tone="subdued" alignment="center">
                        {(plan.ordersLimit - plan.ordersUsed).toLocaleString()}
                      </Text>
                      <div style={{
                        width: '100%',
                        height: '40px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '4px 4px 0 0',
                        marginTop: '4px'
                      }} />
                    </div>
                  </div>

                  <InlineStack align="space-between">
                    <Text variant="bodySm" tone="subdued">Used</Text>
                    <Text variant="bodySm" tone="subdued">Available</Text>
                  </InlineStack>
                </BlockStack>
              </Box>

              <Divider />

              {/* Detailed Metrics */}
              <BlockStack gap="200">
                <Text variant="headingSm" as="h4" fontWeight="semibold">
                  Usage Details
                </Text>

                <InlineStack align="space-between">
                  <InlineStack gap="100" blockAlign="center">
                    <Icon source={CartIcon} tone="subdued" />
                    <Text variant="bodySm">Daily Average</Text>
                  </InlineStack>
                  <Text variant="bodySm" fontWeight="medium">
                    {plan.averageDailyOrders} orders
                  </Text>
                </InlineStack>

                <InlineStack align="space-between">
                  <InlineStack gap="100" blockAlign="center">
                    <Icon source={ChartVerticalIcon} tone="subdued" />
                    <Text variant="bodySm">Peak Day</Text>
                  </InlineStack>
                  <Text variant="bodySm" fontWeight="medium">
                    {plan.peakDailyOrders} orders
                  </Text>
                </InlineStack>

                <InlineStack align="space-between">
                  <InlineStack gap="100" blockAlign="center">
                    <Icon source={CalendarIcon} tone="subdued" />
                    <Text variant="bodySm">Days Elapsed</Text>
                  </InlineStack>
                  <Text variant="bodySm" fontWeight="medium">
                    {plan.daysInCycle - plan.daysRemaining} / {plan.daysInCycle}
                  </Text>
                </InlineStack>
              </BlockStack>

              <Divider />

              {/* Projection Banner */}
              {plan.projectedUsage > 90 && (
                <Banner tone={plan.projectedUsage > 100 ? "critical" : "warning"}>
                  <BlockStack gap="100">
                    <Text variant="bodySm" fontWeight="semibold">
                      {plan.projectedUsage > 100 ? 'Projected to exceed limit' : 'Approaching limit'}
                    </Text>
                    <Text variant="bodySm">
                      At current rate: {plan.projectedOrders.toLocaleString()} orders by {plan.renewalDate.split(',')[0]}
                    </Text>
                  </BlockStack>
                </Banner>
              )}

              {/* Renewal Info */}
              <Box
                padding="300"
                background="bg-surface"
                borderRadius="200"
              >
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="bodySm" fontWeight="semibold">Next Renewal</Text>
                    <Badge tone="info">{plan.autoRenew ? 'Auto' : 'Manual'}</Badge>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued">
                    {plan.renewalDate}
                  </Text>
                  <InlineStack gap="100" blockAlign="center">
                    <Icon source={CashDollarIcon} tone="subdued" />
                    <Text variant="bodySm">{plan.nextBillingAmount}</Text>
                  </InlineStack>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Option L: Minimal Focus */}
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Box paddingBlockEnd="200">
                <BlockStack gap="100">
                  <Text variant="headingLg" as="h2">
                    Option L: Minimal Focus
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    Clean, minimal design focusing on key numbers and actions
                  </Text>
                </BlockStack>
              </Box>

              <Divider />

              {/* Minimal Header */}
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3" fontWeight="semibold">
                  {plan.planName}
                </Text>
                <InlineStack align="space-between" blockAlign="end">
                  <Text variant="heading3xl" as="p">{plan.planPrice}</Text>
                  <Text variant="bodySm" tone="subdued">per {plan.billingCycle}</Text>
                </InlineStack>
              </BlockStack>

              <Divider />

              {/* Primary Metric - Large */}
              <Box
                padding="500"
                background="bg-surface-secondary"
                borderRadius="300"
              >
                <BlockStack gap="200" inlineAlign="center">
                  <Text variant="bodySm" tone="subdued" alignment="center">
                    ORDERS THIS CYCLE
                  </Text>
                  <BlockStack gap="100" inlineAlign="center">
                    <Text variant="heading3xl" as="p" alignment="center">
                      {plan.ordersUsed.toLocaleString()}
                    </Text>
                    <Text variant="bodyMd" tone="subdued" alignment="center">
                      / {plan.ordersLimit.toLocaleString()}
                    </Text>
                  </BlockStack>
                  <ProgressBar progress={plan.percentageUsed} size="small" />
                </BlockStack>
              </Box>

              {/* Simple Stats Grid */}
              <InlineGrid columns={3} gap="300">
                <BlockStack gap="100" inlineAlign="center">
                  <Text variant="heading2xl" as="p" alignment="center">
                    {plan.daysRemaining}
                  </Text>
                  <Text variant="bodySm" tone="subdued" alignment="center">
                    days left
                  </Text>
                </BlockStack>

                <BlockStack gap="100" inlineAlign="center">
                  <Text variant="heading2xl" as="p" alignment="center">
                    {Math.round(plan.percentageUsed)}%
                  </Text>
                  <Text variant="bodySm" tone="subdued" alignment="center">
                    used
                  </Text>
                </BlockStack>

                <BlockStack gap="100" inlineAlign="center">
                  <Text variant="heading2xl" as="p" alignment="center">
                    {Math.round(plan.averageDailyOrders)}
                  </Text>
                  <Text variant="bodySm" tone="subdued" alignment="center">
                    per day
                  </Text>
                </BlockStack>
              </InlineGrid>

              <Divider />

              {/* Projection Alert */}
              {plan.projectedUsage > 80 && (
                <Box
                  padding="300"
                  background={plan.projectedUsage > 100 ? "bg-surface-critical-subdued" : "bg-surface-warning-subdued"}
                  borderRadius="200"
                >
                  <InlineStack gap="200" blockAlign="center">
                    <Icon
                      source={plan.projectedUsage > 100 ? AlertCircleIcon : ClockIcon}
                      tone={plan.projectedUsage > 100 ? "critical" : "warning"}
                    />
                    <BlockStack gap="050">
                      <Text variant="bodySm" fontWeight="semibold">
                        {plan.projectedUsage > 100 ? 'Will exceed limit' : 'High usage projected'}
                      </Text>
                      <Text variant="bodySm" tone="subdued">
                        ~{plan.projectedOrders.toLocaleString()} orders by renewal
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Box>
              )}

              {/* Renewal Date */}
              <Box
                padding="300"
                background="bg-surface"
                borderRadius="200"
              >
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="050">
                    <Text variant="bodySm" fontWeight="semibold">Renews</Text>
                    <Text variant="bodySm" tone="subdued">{plan.renewalDate}</Text>
                  </BlockStack>
                  <Badge tone="success">
                    <InlineStack gap="100" blockAlign="center">
                      <Icon source={CheckCircleIcon} />
                      <span>Active</span>
                    </InlineStack>
                  </Badge>
                </InlineStack>
              </Box>

              <Divider />

              {/* Cost Summary */}
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodySm" tone="subdued">Cost per order</Text>
                  <Text variant="bodySm" fontWeight="medium">
                    ${plan.costPerOrder.toFixed(3)}
                  </Text>
                </InlineStack>

                <InlineStack align="space-between">
                  <Text variant="bodySm" tone="subdued">Plan efficiency</Text>
                  <Text variant="bodySm" fontWeight="medium">
                    {plan.efficiency}%
                  </Text>
                </InlineStack>

                <InlineStack align="space-between">
                  <Text variant="bodySm" tone="subdued">Est. overage</Text>
                  <Text variant="bodySm" fontWeight="medium" tone={plan.estimatedOverage !== "$0.00" ? "critical" : "subdued"}>
                    {plan.estimatedOverage}
                  </Text>
                </InlineStack>
              </BlockStack>

              {/* Upgrade Suggestion */}
              {plan.canUpgrade && plan.projectedUsage > 85 && (
                <Box
                  padding="300"
                  background="bg-surface-info-subdued"
                  borderRadius="200"
                >
                  <InlineStack gap="200" blockAlign="center">
                    <Icon source={ArrowUpIcon} tone="info" />
                    <BlockStack gap="050">
                      <Text variant="bodySm" fontWeight="semibold">
                        Consider {plan.nextTier.name}
                      </Text>
                      <Text variant="bodySm" tone="subdued">
                        {plan.nextTier.ordersLimit.toLocaleString()} orders for {plan.nextTier.price}/mo
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Box>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
