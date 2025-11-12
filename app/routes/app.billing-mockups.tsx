import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  Box,
  Badge,
  Divider,
  Button,
  Icon,
  ProgressBar,
} from "@shopify/polaris";
import { CreditCardIcon, CalendarIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Mock billing data
  return json({
    currentPlan: "RewardsPro Pro",
    subscriptionInfo: {
      test: false,
      recurringCharge: {
        amount: "49.99",
        interval: "EVERY_30_DAYS"
      },
      usageCharge: {
        cappedAmount: {
          amount: "100.00"
        }
      },
      currentPeriodEnd: "2025-02-12T00:00:00Z",
      currentPeriodStart: "2025-01-12T00:00:00Z"
    },
    // Additional mock data for variations
    usageMetrics: {
      ordersUsed: 342,
      ordersLimit: 500,
      usagePercentage: 68.4,
      daysRemaining: 18,
      averageDailyOrders: 19
    }
  });
};

export default function BillingMockups() {
  const data = useLoaderData<typeof loader>();
  const { currentPlan, subscriptionInfo, usageMetrics } = data;

  return (
    <Page title="Billing Card Variations" subtitle="Three design options for the billing page">
      <BlockStack gap="600">
        {/* Variation A: Detailed Premium */}
        <Card>
          <BlockStack gap="400">
            <Box paddingBlockEnd="200">
              <BlockStack gap="100">
                <Text variant="headingLg" as="h2">
                  Variation A: Detailed Premium
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Enhanced visual hierarchy with icons, larger pricing, and detailed metrics
                </Text>
              </BlockStack>
            </Box>

            <Divider />

            <Card>
              <BlockStack gap="400">
                {/* Header with Icon */}
                <Box
                  padding="400"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="300" blockAlign="center">
                      <Box
                        padding="200"
                        background="bg-surface-success-subdued"
                        borderRadius="100"
                      >
                        <Icon source={CreditCardIcon} tone="success" />
                      </Box>
                      <BlockStack gap="100">
                        <Text as="h2" variant="headingLg" fontWeight="bold">
                          {currentPlan.replace('RewardsPro', 'Rewards')}
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          Professional plan • Active subscription
                        </Text>
                      </BlockStack>
                    </InlineStack>
                    <Badge tone="success" size="large">Active</Badge>
                  </InlineStack>
                </Box>

                {/* Pricing Grid */}
                <InlineGrid columns={2} gap="400">
                  <Box
                    padding="400"
                    background="bg-surface"
                    borderRadius="200"
                    borderColor="border"
                    borderWidth="025"
                  >
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued" fontWeight="medium">
                        {subscriptionInfo.recurringCharge.interval === 'EVERY_30_DAYS' ? 'Monthly Payment' : 'Annual Payment'}
                      </Text>
                      <Text variant="heading2xl" as="p" fontWeight="bold">
                        ${parseFloat(subscriptionInfo.recurringCharge.amount).toFixed(0)}
                      </Text>
                      <Text variant="bodySm" tone="subdued">
                        per {subscriptionInfo.recurringCharge.interval === 'EVERY_30_DAYS' ? 'month' : 'year'}
                      </Text>
                    </BlockStack>
                  </Box>

                  <Box
                    padding="400"
                    background="bg-surface"
                    borderRadius="200"
                    borderColor="border"
                    borderWidth="025"
                  >
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued" fontWeight="medium">
                        Usage Cap
                      </Text>
                      <Text variant="heading2xl" as="p" fontWeight="bold">
                        ${parseFloat(subscriptionInfo.usageCharge.cappedAmount.amount).toFixed(0)}
                      </Text>
                      <Text variant="bodySm" tone="subdued">
                        maximum overage
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineGrid>

                {/* Billing Date */}
                <Box
                  padding="300"
                  background="bg-surface-tertiary"
                  borderRadius="200"
                >
                  <InlineStack gap="200" blockAlign="center">
                    <Icon source={CalendarIcon} tone="subdued" />
                    <Text variant="bodyMd" fontWeight="medium">
                      Next billing: {new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </InlineStack>
                </Box>

                {/* Actions */}
                <InlineStack align="space-between" blockAlign="center">
                  <Button variant="plain" tone="critical">Cancel subscription</Button>
                  <Button>Manage plan</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Card>

        {/* Variation B: Compact Minimal */}
        <Card>
          <BlockStack gap="400">
            <Box paddingBlockEnd="200">
              <BlockStack gap="100">
                <Text variant="headingLg" as="h2">
                  Variation B: Compact Minimal
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Clean, essential information in minimal space
                </Text>
              </BlockStack>
            </Box>

            <Divider />

            <Card>
              <BlockStack gap="300">
                {/* Plan Header - Compact */}
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="h2" variant="headingMd" fontWeight="semibold">
                        {currentPlan.replace('RewardsPro', 'Rewards')}
                      </Text>
                      <Badge tone="success">Active</Badge>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued">
                      ${parseFloat(subscriptionInfo.recurringCharge.amount).toFixed(0)}/{subscriptionInfo.recurringCharge.interval === 'EVERY_30_DAYS' ? 'mo' : 'yr'}
                      {' • '}
                      ${parseFloat(subscriptionInfo.usageCharge.cappedAmount.amount).toFixed(0)} usage cap
                    </Text>
                  </BlockStack>
                  <Button size="slim">Change plan</Button>
                </InlineStack>

                <Divider />

                {/* Next Billing - Single Line */}
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="bodySm" tone="subdued">
                    Next billing
                  </Text>
                  <Text variant="bodySm" fontWeight="medium">
                    {new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Card>

        {/* Variation C: Dashboard Style with Metrics */}
        <Card>
          <BlockStack gap="400">
            <Box paddingBlockEnd="200">
              <BlockStack gap="100">
                <Text variant="headingLg" as="h2">
                  Variation C: Dashboard Style
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Similar to dashboard plan card with usage metrics and progress
                </Text>
              </BlockStack>
            </Box>

            <Divider />

            <Card>
              <BlockStack gap="400">
                {/* Status Header */}
                <Box
                  padding="400"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="headingMd" as="h3" fontWeight="semibold">
                        {currentPlan.replace('RewardsPro', 'Rewards')}
                      </Text>
                      <Badge tone="success">ACTIVE</Badge>
                    </InlineStack>

                    <InlineGrid columns={2} gap="400">
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">
                          Plan Rate
                        </Text>
                        <Text variant="headingLg" as="p">
                          ${parseFloat(subscriptionInfo.recurringCharge.amount).toFixed(0)}
                        </Text>
                      </BlockStack>

                      <BlockStack gap="050" inlineAlign="end">
                        <Text variant="bodySm" tone="subdued">
                          Billing
                        </Text>
                        <Text variant="headingLg" as="p">
                          {subscriptionInfo.recurringCharge.interval === 'EVERY_30_DAYS' ? 'Monthly' : 'Annual'}
                        </Text>
                      </BlockStack>
                    </InlineGrid>
                  </BlockStack>
                </Box>

                {/* Usage Monitor */}
                <Box
                  padding="400"
                  background="bg-surface"
                  borderRadius="200"
                >
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodySm" fontWeight="semibold">
                        Order Usage
                      </Text>
                      <Text variant="bodySm" tone="subdued">
                        {usageMetrics.usagePercentage.toFixed(1)}%
                      </Text>
                    </InlineStack>

                    <ProgressBar
                      progress={usageMetrics.usagePercentage}
                      tone={usageMetrics.usagePercentage > 90 ? 'critical' : usageMetrics.usagePercentage > 75 ? 'warning' : 'success'}
                    />

                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="headingLg" as="p">
                        {usageMetrics.ordersUsed.toLocaleString()}
                      </Text>
                      <Text variant="bodySm" tone="subdued">
                        of {usageMetrics.ordersLimit.toLocaleString()}
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </Box>

                {/* Billing Cycle Info */}
                <Box
                  padding="400"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodySm" tone="subdued">
                        Current Period
                      </Text>
                      <Text variant="bodyMd" fontWeight="medium">
                        {usageMetrics.daysRemaining} days remaining
                      </Text>
                    </InlineStack>

                    <Divider />

                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodySm" tone="subdued">
                        Daily average
                      </Text>
                      <Text variant="bodyMd" fontWeight="medium">
                        {usageMetrics.averageDailyOrders} orders/day
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </Box>

                {/* Next Billing */}
                <Box
                  padding="300"
                  background="bg-surface"
                  borderRadius="200"
                >
                  <BlockStack gap="100">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodySm" fontWeight="semibold">
                        Next Billing Event
                      </Text>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued">
                      {new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • ${parseFloat(subscriptionInfo.recurringCharge.amount).toFixed(2)}
                    </Text>
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
