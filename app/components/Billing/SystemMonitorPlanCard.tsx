import {
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  InlineStack,
  InlineGrid,
  Text,
  Badge,
  ProgressBar,
} from "@shopify/polaris";
import {
  getPlanDetails,
  calculateUsageMetrics,
} from "~/constants/billing.constants";
import { PlanOverLimitBanner } from "./PlanOverLimitBanner";

export interface SystemMonitorPlanCardProps {
  // Plan data
  activeSubscription?: {
    name: string;
    status: string;
  } | null;
  currentPlan?: {
    planName: string;
    status: string;
  } | null;

  // Usage data
  monthlyOrderUsage?: {
    orderCount: number;
    planLimit: number;
    projectedOrders: number;
    currentMonth?: string;
  } | null;

  // UI options
  showUpgradeButton?: boolean;
  showOverageBanner?: boolean;

  // Actions
  onUpgrade?: () => void;
}

export function SystemMonitorPlanCard({
  activeSubscription,
  currentPlan,
  monthlyOrderUsage,
  showUpgradeButton = true,
  showOverageBanner = true,
  onUpgrade,
}: SystemMonitorPlanCardProps) {
  // Get plan details and usage metrics
  const planDetails = getPlanDetails(activeSubscription, currentPlan);
  const usageMetrics = calculateUsageMetrics(monthlyOrderUsage, planDetails);

  // Calculate additional metrics
  const daysInCycle = 30;
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysRemaining = Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const averageDailyOrders = monthlyOrderUsage?.orderCount
    ? (monthlyOrderUsage.orderCount / (daysInCycle - daysRemaining))
    : 0;

  const peakDailyOrders = Math.ceil(averageDailyOrders * 1.8); // Estimate peak as 180% of average

  // Format renewal date
  const renewalDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Use correct field names from calculateUsageMetrics
  const utilization = usageMetrics.usagePercentage;
  const projectedUtilization = usageMetrics.projectedPercentage;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Over Limit Banner */}
      {showOverageBanner && onUpgrade && (
        <div style={{ marginBottom: '1rem' }}>
          <PlanOverLimitBanner
            planDetails={planDetails}
            usageMetrics={usageMetrics}
            onUpgrade={onUpgrade}
          />
        </div>
      )}

      {/* Main Card */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Card>
            <BlockStack gap="400" inlineAlign="stretch">
          {/* Status Header */}
          <Box
            padding="400"
            background="bg-surface-secondary"
            borderRadius="200"
          >
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h3" fontWeight="semibold">
                  {planDetails.displayName}
                </Text>
                <Badge tone="success">
                  ACTIVE
                </Badge>
              </InlineStack>

              <InlineGrid columns={2} gap="400">
                <BlockStack gap="050">
                  <Text variant="bodySm" tone="subdued">
                    Plan Rate
                  </Text>
                  <Text variant="headingLg" as="p">
                    ${planDetails.price}
                  </Text>
                </BlockStack>

                <BlockStack gap="050" inlineAlign="end">
                  <Text variant="bodySm" tone="subdued">
                    Billing
                  </Text>
                  <Text variant="headingLg" as="p">
                    {planDetails.interval}
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
                  {utilization.toFixed(2)}%
                </Text>
              </InlineStack>

              <ProgressBar
                progress={utilization}
                tone={utilization > 90 ? 'critical' : utilization > 75 ? 'warning' : 'success'}
              />

              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingLg" as="p">
                  {usageMetrics.currentUsage.toLocaleString()}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  of {usageMetrics.planLimit.toLocaleString()}
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
                    {daysRemaining}d / {daysInCycle}d
                  </Text>
                </InlineStack>

                <Divider />

                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="bodySm" tone="subdued">
                    Daily Throughput
                  </Text>
                  <Text variant="bodyMd" fontWeight="medium">
                    {averageDailyOrders.toFixed(1)} avg
                  </Text>
                </InlineStack>

                <Divider />

                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="bodySm" tone="subdued">
                    Peak Load
                  </Text>
                  <Text variant="bodyMd" fontWeight="medium">
                    {peakDailyOrders} orders
                  </Text>
                </InlineStack>

                <Divider />

                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="bodySm" tone="subdued">
                    Projected Load
                  </Text>
                  <Text variant="bodyMd" fontWeight="medium">
                    {monthlyOrderUsage?.projectedOrders.toLocaleString() || 0}
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
                  ${(planDetails.price / (monthlyOrderUsage?.orderCount || 1)).toFixed(3)}
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
                  {utilization.toFixed(1)}%
                </Text>
              </BlockStack>
            </Box>
          </InlineGrid>

          {/* Next Billing */}
          <Box
            padding="300"
            background={projectedUtilization > 100 ? "bg-surface-critical-subdued" : "bg-surface"}
            borderRadius="200"
          >
            <BlockStack gap="100">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="bodySm" fontWeight="semibold">
                  Next Billing Event
                </Text>
                {projectedUtilization > 100 && (
                  <Badge tone="critical">Alert</Badge>
                )}
              </InlineStack>
              <Text variant="bodySm" tone="subdued">
                {renewalDate} • ${planDetails.price}
              </Text>
              {projectedUtilization > 100 && monthlyOrderUsage && (
                <Text variant="bodySm" tone="critical">
                  Estimated overage: +${((monthlyOrderUsage.projectedOrders - monthlyOrderUsage.planLimit) * (planDetails.overageRate || 0.05)).toFixed(2)}
                </Text>
              )}
            </BlockStack>
          </Box>

          {/* Upgrade Button */}
          {showUpgradeButton && onUpgrade && (
            <Button
              fullWidth
              onClick={onUpgrade}
              variant={usageMetrics.isOverLimit ? "primary" : "plain"}
            >
              {usageMetrics.isOverLimit ? "Upgrade now" : "View plans"}
            </Button>
          )}
        </BlockStack>
          </Card>
        </div>
      </div>
    </div>
  );
}
