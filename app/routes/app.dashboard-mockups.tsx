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
  StatusActiveIcon,
  SettingsIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  DatabaseIcon,
  RefreshIcon,
  ClockIcon,
  PersonIcon,
  CashDollarIcon,
  ChartVerticalIcon,
  CalendarIcon,
  PlusIcon,
  CheckIcon,
  ArrowUpIcon,
  StarFilledIcon,
  CartIcon,
} from "~/utils/polaris-icons";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Mock data for all layouts
  return json({
    // Plan Details Mock Data
    planDetails: {
      currentPlan: {
        name: "RewardsPro Growth",
        price: "$49",
        billingCycle: "monthly",
        ordersIncluded: 2000,
        ordersUsed: 1247,
        percentageUsed: 62.35,
        daysRemaining: 18,
        renewalDate: "November 16, 2025",
        projectedOrders: 1850,
        overageRate: "$0.05",
        features: [
          "Advanced Analytics Dashboard",
          "Automatic Cashback Processing",
          "Email Marketing Campaigns",
          "Tier Products Module",
          "Priority Email Support",
          "Custom Tier Configuration"
        ],
        savings: "$156",
        yearlyEquivalent: "$588"
      },
      nextTier: {
        name: "RewardsPro Max",
        price: "$99",
        ordersIncluded: 5000,
        additionalFeatures: [
          "Dedicated Account Manager",
          "Phone Support",
          "Custom Integration",
          "Advanced API Access"
        ],
        estimatedSavings: "$240/year"
      },
      previousTier: {
        name: "RewardsPro Starter",
        price: "$19",
        ordersIncluded: 500
      },
      usage: {
        currentMonth: "October 2025",
        orderHistory: [
          { month: "Oct", orders: 1247, limit: 2000 },
          { month: "Sep", orders: 1892, limit: 2000 },
          { month: "Aug", orders: 1654, limit: 2000 },
          { month: "Jul", orders: 1423, limit: 2000 }
        ],
        averageMonthly: 1554,
        peakMonth: 1892,
        efficiency: "78%"
      }
    },

    systemHealth: {
      overall: 98.5,
      uptime: "99.9%",
      lastCheck: "2 minutes ago",
      incidents: 0,
    },
    components: [
      {
        name: "Database",
        status: "operational",
        responseTime: "12ms",
        uptime: "100%",
        lastCheck: "Just now",
        requests: "1.2M/day",
        details: "PostgreSQL 14.5 on AWS Aurora"
      },
      {
        name: "Shopify API",
        status: "operational",
        responseTime: "45ms",
        uptime: "99.8%",
        lastCheck: "1 min ago",
        requests: "856K/day",
        details: "GraphQL + ShopifyQL"
      },
      {
        name: "Loyalty Engine",
        status: "operational",
        responseTime: "8ms",
        uptime: "100%",
        lastCheck: "Just now",
        requests: "2.3M/day",
        details: "Tier calculations & rewards"
      },
      {
        name: "Email Service",
        status: "degraded",
        responseTime: "320ms",
        uptime: "97.2%",
        lastCheck: "5 min ago",
        requests: "45K/day",
        details: "Transactional emails (SendGrid)"
      },
      {
        name: "Customer Sync",
        status: "operational",
        responseTime: "156ms",
        uptime: "99.5%",
        lastCheck: "2 min ago",
        requests: "234K/day",
        details: "Real-time webhook processing"
      },
      {
        name: "Analytics Pipeline",
        status: "maintenance",
        responseTime: "N/A",
        uptime: "N/A",
        lastCheck: "Scheduled",
        requests: "N/A",
        details: "Daily aggregation at 2 AM UTC"
      },
    ],
  });
};

export default function DashboardMockups() {
  const data = useLoaderData<typeof loader>();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return '#22c55e';
      case 'degraded': return '#eab308';
      case 'maintenance': return '#3b82f6';
      case 'outage': return '#ef4444';
      default: return '#9ca3af';
    }
  };

  const getStatusBadgeTone = (status: string): 'success' | 'warning' | 'info' | 'critical' => {
    switch (status) {
      case 'operational': return 'success';
      case 'degraded': return 'warning';
      case 'maintenance': return 'info';
      case 'outage': return 'critical';
      default: return 'info';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'operational': return 'Operational';
      case 'degraded': return 'Degraded';
      case 'maintenance': return 'Maintenance';
      case 'outage': return 'Outage';
      default: return 'Unknown';
    }
  };

  return (
    <Page title="Dashboard Layout Options" subtitle="System Status (A-C) • Plan Details (D-F) • Choose your preferred designs">
      <Layout>
        {/* Option A: Mission Control - Grid Cards */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Box paddingBlockEnd="200">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingLg" as="h2">
                      Option A: Mission Control
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      Grid of cards with large icons and key metrics
                    </Text>
                  </BlockStack>
                  <Badge tone="success">System Health: {data.systemHealth.overall}%</Badge>
                </InlineStack>
              </Box>

              <Divider />

              {/* Overall Status Banner */}
              <Banner tone="success">
                <InlineStack gap="400" blockAlign="center" wrap={false}>
                  <InlineStack gap="200" blockAlign="center">
                    <Icon source={CheckCircleIcon} tone="success" />
                    <Text variant="bodyMd" fontWeight="semibold">All Systems Operational</Text>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued">•</Text>
                  <Text variant="bodySm" tone="subdued">Uptime: {data.systemHealth.uptime}</Text>
                  <Text variant="bodySm" tone="subdued">•</Text>
                  <Text variant="bodySm" tone="subdued">Last check: {data.systemHealth.lastCheck}</Text>
                  <Text variant="bodySm" tone="subdued">•</Text>
                  <Text variant="bodySm" tone="subdued">{data.systemHealth.incidents} active incidents</Text>
                </InlineStack>
              </Banner>

              {/* Grid of Component Cards */}
              <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
                {data.components.map((component) => (
                  <Card key={component.name}>
                    <BlockStack gap="300">
                      {/* Header with icon and status */}
                      <InlineStack align="space-between" blockAlign="start">
                        <Box
                          padding="200"
                          background="bg-surface-secondary"
                          borderRadius="200"
                        >
                          <Icon
                            source={
                              component.name === 'Database' ? DatabaseIcon :
                              component.name === 'Customer Sync' ? RefreshIcon :
                              component.name === 'Analytics Pipeline' ? ClockIcon :
                              StatusActiveIcon
                            }
                            tone="base"
                          />
                        </Box>
                        <Badge tone={getStatusBadgeTone(component.status)}>
                          {getStatusLabel(component.status)}
                        </Badge>
                      </InlineStack>

                      {/* Component Name */}
                      <Text variant="headingSm" as="h3" fontWeight="semibold">
                        {component.name}
                      </Text>

                      {/* Metrics */}
                      <BlockStack gap="100">
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Response:</Text>
                          <Text variant="bodySm" fontWeight="medium">{component.responseTime}</Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Uptime:</Text>
                          <Text variant="bodySm" fontWeight="medium">{component.uptime}</Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Requests:</Text>
                          <Text variant="bodySm" fontWeight="medium">{component.requests}</Text>
                        </InlineStack>
                      </BlockStack>

                      <Divider />

                      {/* Details */}
                      <Text variant="bodySm" tone="subdued">
                        {component.details}
                      </Text>
                    </BlockStack>
                  </Card>
                ))}
              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Option B: Progress Checklist - Vertical Timeline */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Box paddingBlockEnd="200">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingLg" as="h2">
                      Option B: Progress Checklist
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      Vertical timeline with progress indicators and expandable details
                    </Text>
                  </BlockStack>
                  <Badge tone="info">{data.components.filter(c => c.status === 'operational').length}/{data.components.length} Healthy</Badge>
                </InlineStack>
              </Box>

              <Divider />

              {/* Overall Progress */}
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="bodyMd" fontWeight="semibold">System Health Score</Text>
                  <Text variant="headingMd" as="p">{data.systemHealth.overall}%</Text>
                </InlineStack>
                <ProgressBar progress={data.systemHealth.overall} tone="success" />
                <Text variant="bodySm" tone="subdued">
                  All critical systems are operational. One service experiencing minor degradation.
                </Text>
              </BlockStack>

              <Divider />

              {/* Vertical Timeline */}
              <BlockStack gap="300">
                {data.components.map((component, index) => (
                  <Box key={component.name}>
                    <div style={{
                      display: 'flex',
                      gap: '16px',
                      position: 'relative'
                    }}>
                      {/* Timeline indicator */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        position: 'relative'
                      }}>
                        {/* Status circle */}
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: getStatusColor(component.status),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 1,
                        }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'white' }} />
                        </div>

                        {/* Connecting line */}
                        {index < data.components.length - 1 && (
                          <div style={{
                            width: '2px',
                            height: '100%',
                            minHeight: '40px',
                            backgroundColor: '#e5e7eb',
                            marginTop: '4px',
                          }} />
                        )}
                      </div>

                      {/* Content */}
                      <Box
                        padding="300"
                        background="bg-surface-secondary"
                        borderRadius="200"
                        width="100%"
                      >
                        <BlockStack gap="200">
                          <InlineStack align="space-between" blockAlign="start">
                            <BlockStack gap="050">
                              <Text variant="bodyMd" fontWeight="semibold">{component.name}</Text>
                              <Text variant="bodySm" tone="subdued">{component.details}</Text>
                            </BlockStack>
                            <Badge tone={getStatusBadgeTone(component.status)}>
                              {getStatusLabel(component.status)}
                            </Badge>
                          </InlineStack>

                          {/* Metrics Grid */}
                          <InlineGrid columns={3} gap="200">
                            <BlockStack gap="050">
                              <Text variant="bodySm" tone="subdued">Response</Text>
                              <Text variant="bodySm" fontWeight="medium">{component.responseTime}</Text>
                            </BlockStack>
                            <BlockStack gap="050">
                              <Text variant="bodySm" tone="subdued">Uptime</Text>
                              <Text variant="bodySm" fontWeight="medium">{component.uptime}</Text>
                            </BlockStack>
                            <BlockStack gap="050">
                              <Text variant="bodySm" tone="subdued">Last Check</Text>
                              <Text variant="bodySm" fontWeight="medium">{component.lastCheck}</Text>
                            </BlockStack>
                          </InlineGrid>
                        </BlockStack>
                      </Box>
                    </div>
                  </Box>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Option C: Metrics Dashboard - Stat Tiles */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Box paddingBlockEnd="200">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingLg" as="h2">
                      Option C: Metrics Dashboard
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      Compact tiles with key performance indicators and real-time data
                    </Text>
                  </BlockStack>
                  <InlineStack gap="200">
                    <Badge tone="success">
                      <InlineStack gap="100" blockAlign="center">
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                        <span>Live</span>
                      </InlineStack>
                    </Badge>
                  </InlineStack>
                </InlineStack>
              </Box>

              <Divider />

              {/* Compact Status Overview */}
              <InlineGrid columns={{ xs: 2, sm: 4 }} gap="300">
                <Box
                  padding="300"
                  background="bg-surface-success"
                  borderRadius="200"
                >
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued">Operational</Text>
                    <Text variant="heading2xl" as="p">4</Text>
                  </BlockStack>
                </Box>

                <Box
                  padding="300"
                  background="bg-surface-warning"
                  borderRadius="200"
                >
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued">Degraded</Text>
                    <Text variant="heading2xl" as="p">1</Text>
                  </BlockStack>
                </Box>

                <Box
                  padding="300"
                  background="bg-surface-info"
                  borderRadius="200"
                >
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued">Maintenance</Text>
                    <Text variant="heading2xl" as="p">1</Text>
                  </BlockStack>
                </Box>

                <Box
                  padding="300"
                  background="bg-surface"
                  borderRadius="200"
                >
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued">Incidents</Text>
                    <Text variant="heading2xl" as="p">0</Text>
                  </BlockStack>
                </Box>
              </InlineGrid>

              <Divider />

              {/* Detailed Component Cards - Horizontal */}
              <BlockStack gap="300">
                {data.components.map((component) => (
                  <Box
                    key={component.name}
                    padding="300"
                    background="bg-surface-secondary"
                    borderRadius="200"
                  >
                    <InlineStack align="space-between" blockAlign="center" wrap={false}>
                      {/* Component Name & Status */}
                      <InlineStack gap="300" blockAlign="center">
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: getStatusColor(component.status),
                          flexShrink: 0,
                        }} />
                        <BlockStack gap="050">
                          <Text variant="bodyMd" fontWeight="semibold">{component.name}</Text>
                          <Text variant="bodySm" tone="subdued">{component.details}</Text>
                        </BlockStack>
                      </InlineStack>

                      {/* Metrics - Horizontal */}
                      <InlineStack gap="400" blockAlign="center" wrap={false}>
                        <InlineStack gap="100" blockAlign="center">
                          <Icon source={ClockIcon} tone="subdued" />
                          <Text variant="bodySm" fontWeight="medium">{component.responseTime}</Text>
                        </InlineStack>

                        <InlineStack gap="100" blockAlign="center">
                          <Icon source={StatusActiveIcon} tone="subdued" />
                          <Text variant="bodySm" fontWeight="medium">{component.uptime}</Text>
                        </InlineStack>

                        <Badge tone={getStatusBadgeTone(component.status)}>
                          {getStatusLabel(component.status)}
                        </Badge>
                      </InlineStack>
                    </InlineStack>
                  </Box>
                ))}
              </BlockStack>

              <Divider />

              {/* Summary Footer */}
              <Box
                padding="300"
                background="bg-surface-success-subdued"
                borderRadius="200"
              >
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Icon source={CheckCircleIcon} tone="success" />
                    <Text variant="bodyMd" fontWeight="semibold">System Status: Healthy</Text>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued">
                    Last updated: {data.systemHealth.lastCheck} • Next check in 30s
                  </Text>
                </InlineStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* ========================================== */}
        {/* PLAN DETAILS LAYOUTS                       */}
        {/* ========================================== */}

        {/* Option D: Executive Summary - Large numbers with circular progress */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Box paddingBlockEnd="200">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingLg" as="h2">
                      Option D: Executive Summary
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      Large numbers, circular progress indicators, and key metrics at a glance
                    </Text>
                  </BlockStack>
                  <Badge tone="success">Active</Badge>
                </InlineStack>
              </Box>

              <Divider />

              {/* Current Plan Header */}
              <InlineStack align="space-between" blockAlign="start">
                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center">
                    <Icon source={StarFilledIcon} tone="warning" />
                    <Text variant="heading2xl" as="h3">{data.planDetails.currentPlan.name}</Text>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued">
                    Billed {data.planDetails.currentPlan.billingCycle} • Renews {data.planDetails.currentPlan.renewalDate}
                  </Text>
                </BlockStack>
                <BlockStack gap="050" inlineAlign="end">
                  <Text variant="heading2xl" as="p">{data.planDetails.currentPlan.price}</Text>
                  <Text variant="bodySm" tone="subdued">per month</Text>
                </BlockStack>
              </InlineStack>

              <Divider />

              {/* Large Metrics Grid */}
              <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
                {/* Usage Circle */}
                <Box
                  padding="400"
                  background="bg-surface-secondary"
                  borderRadius="300"
                >
                  <BlockStack gap="300" inlineAlign="center">
                    {/* Circular Progress Simulation */}
                    <div style={{
                      width: '120px',
                      height: '120px',
                      borderRadius: '50%',
                      background: `conic-gradient(#22c55e ${data.planDetails.currentPlan.percentageUsed * 3.6}deg, #e5e7eb 0deg)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative'
                    }}>
                      <div style={{
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <Text variant="heading2xl" as="p">{Math.round(data.planDetails.currentPlan.percentageUsed)}%</Text>
                        <Text variant="bodySm" tone="subdued">Used</Text>
                      </div>
                    </div>
                    <BlockStack gap="100" inlineAlign="center">
                      <Text variant="headingMd" as="p" alignment="center">
                        {data.planDetails.currentPlan.ordersUsed.toLocaleString()}
                      </Text>
                      <Text variant="bodySm" tone="subdued" alignment="center">
                        of {data.planDetails.currentPlan.ordersIncluded.toLocaleString()} orders
                      </Text>
                    </BlockStack>
                  </BlockStack>
                </Box>

                {/* Days Remaining */}
                <Box
                  padding="400"
                  background="bg-surface-secondary"
                  borderRadius="300"
                >
                  <BlockStack gap="300" inlineAlign="center">
                    <Icon source={CalendarIcon} tone="base" />
                    <BlockStack gap="100" inlineAlign="center">
                      <Text variant="heading3xl" as="p" alignment="center">
                        {data.planDetails.currentPlan.daysRemaining}
                      </Text>
                      <Text variant="bodyMd" tone="subdued" alignment="center">
                        days remaining
                      </Text>
                    </BlockStack>
                    <Text variant="bodySm" tone="subdued" alignment="center">
                      Projected: {data.planDetails.currentPlan.projectedOrders.toLocaleString()} orders
                    </Text>
                  </BlockStack>
                </Box>

                {/* Savings */}
                <Box
                  padding="400"
                  background="bg-surface-success-subdued"
                  borderRadius="300"
                >
                  <BlockStack gap="300" inlineAlign="center">
                    <Icon source={CashDollarIcon} tone="success" />
                    <BlockStack gap="100" inlineAlign="center">
                      <Text variant="heading3xl" as="p" alignment="center">
                        {data.planDetails.currentPlan.savings}
                      </Text>
                      <Text variant="bodyMd" tone="subdued" alignment="center">
                        saved vs overage
                      </Text>
                    </BlockStack>
                    <Text variant="bodySm" tone="subdued" alignment="center">
                      Yearly equivalent: {data.planDetails.currentPlan.yearlyEquivalent}
                    </Text>
                  </BlockStack>
                </Box>
              </InlineGrid>

              <Divider />

              {/* Features List - Two Columns */}
              <BlockStack gap="300">
                <Text variant="headingSm" as="h4" fontWeight="semibold">
                  Included Features
                </Text>
                <InlineGrid columns={2} gap="200">
                  {data.planDetails.currentPlan.features.map((feature) => (
                    <InlineStack gap="200" blockAlign="center" key={feature}>
                      <Icon source={CheckIcon} tone="success" />
                      <Text variant="bodySm">{feature}</Text>
                    </InlineStack>
                  ))}
                </InlineGrid>
              </BlockStack>

              {/* Upgrade CTA */}
              <Banner tone="info">
                <BlockStack gap="200">
                  <Text variant="bodyMd" fontWeight="semibold">
                    Ready for more? Upgrade to {data.planDetails.nextTier.name}
                  </Text>
                  <Text variant="bodySm">
                    Get {data.planDetails.nextTier.ordersIncluded.toLocaleString()} orders/month for {data.planDetails.nextTier.price}
                    • Save {data.planDetails.nextTier.estimatedSavings} compared to overage fees
                  </Text>
                </BlockStack>
              </Banner>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Option E: Journey Timeline - Visual upgrade path */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Box paddingBlockEnd="200">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingLg" as="h2">
                      Option E: Journey Timeline
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      Visual upgrade path showing where you are and where you can go
                    </Text>
                  </BlockStack>
                  <Badge tone="info">Growth Plan</Badge>
                </InlineStack>
              </Box>

              <Divider />

              {/* Plan Journey - Horizontal Timeline */}
              <BlockStack gap="400">
                {/* Timeline Track */}
                <Box>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                    {/* Background line */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '5%',
                      right: '5%',
                      height: '4px',
                      backgroundColor: '#e5e7eb',
                      transform: 'translateY(-50%)',
                      zIndex: 0
                    }} />

                    {/* Starter Plan */}
                    <BlockStack gap="200" inlineAlign="center" style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: '#e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto'
                      }}>
                        <Icon source={CartIcon} tone="subdued" />
                      </div>
                      <BlockStack gap="050" inlineAlign="center">
                        <Text variant="bodySm" tone="subdued" alignment="center">Starter</Text>
                        <Text variant="headingSm" as="p" alignment="center">{data.planDetails.previousTier.price}</Text>
                        <Text variant="bodySm" tone="subdued" alignment="center">
                          {data.planDetails.previousTier.ordersIncluded} orders
                        </Text>
                      </BlockStack>
                    </BlockStack>

                    {/* Growth Plan - Current */}
                    <BlockStack gap="200" inlineAlign="center" style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                      <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto',
                        boxShadow: '0 8px 16px rgba(34, 197, 94, 0.3)'
                      }}>
                        <Icon source={StarFilledIcon} tone="magic" />
                      </div>
                      <Badge tone="success">Current Plan</Badge>
                      <BlockStack gap="050" inlineAlign="center">
                        <Text variant="bodyMd" fontWeight="semibold" alignment="center">Growth</Text>
                        <Text variant="headingMd" as="p" alignment="center">{data.planDetails.currentPlan.price}</Text>
                        <Text variant="bodySm" tone="subdued" alignment="center">
                          {data.planDetails.currentPlan.ordersIncluded.toLocaleString()} orders
                        </Text>
                      </BlockStack>
                    </BlockStack>

                    {/* Max Plan */}
                    <BlockStack gap="200" inlineAlign="center" style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        border: '2px solid #3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto'
                      }}>
                        <Icon source={ArrowUpIcon} tone="info" />
                      </div>
                      <BlockStack gap="050" inlineAlign="center">
                        <Text variant="bodySm" tone="subdued" alignment="center">Max</Text>
                        <Text variant="headingSm" as="p" alignment="center">{data.planDetails.nextTier.price}</Text>
                        <Text variant="bodySm" tone="subdued" alignment="center">
                          {data.planDetails.nextTier.ordersIncluded.toLocaleString()} orders
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </div>
                </Box>

                <Divider />

                {/* Current Usage Stats */}
                <Box
                  padding="400"
                  background="bg-surface-secondary"
                  borderRadius="300"
                >
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="headingSm" as="h4" fontWeight="semibold">
                        Current Month Usage
                      </Text>
                      <Text variant="bodyMd" tone="subdued">
                        {data.planDetails.usage.currentMonth}
                      </Text>
                    </InlineStack>

                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">Orders Used</Text>
                        <Text variant="bodyMd" fontWeight="medium">
                          {data.planDetails.currentPlan.ordersUsed.toLocaleString()} / {data.planDetails.currentPlan.ordersIncluded.toLocaleString()}
                        </Text>
                      </InlineStack>
                      <ProgressBar
                        progress={data.planDetails.currentPlan.percentageUsed}
                        tone={data.planDetails.currentPlan.percentageUsed > 90 ? 'critical' : data.planDetails.currentPlan.percentageUsed > 75 ? 'warning' : 'success'}
                      />
                    </BlockStack>

                    {/* Historical Usage Mini Chart */}
                    <BlockStack gap="200">
                      <Text variant="bodySm" tone="subdued">Last 4 Months</Text>
                      <InlineStack gap="200" blockAlign="end">
                        {data.planDetails.usage.orderHistory.map((month) => {
                          const height = (month.orders / month.limit) * 80;
                          return (
                            <div key={month.month} style={{ flex: 1, textAlign: 'center' }}>
                              <div style={{
                                height: '80px',
                                display: 'flex',
                                alignItems: 'flex-end',
                                justifyContent: 'center',
                                marginBottom: '8px'
                              }}>
                                <div style={{
                                  width: '100%',
                                  height: `${height}px`,
                                  backgroundColor: month.orders > month.limit * 0.9 ? '#eab308' : '#22c55e',
                                  borderRadius: '4px 4px 0 0'
                                }} />
                              </div>
                              <Text variant="bodySm" tone="subdued">{month.month}</Text>
                            </div>
                          );
                        })}
                      </InlineStack>
                    </BlockStack>

                    {/* Key Stats */}
                    <InlineGrid columns={3} gap="200">
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Average</Text>
                        <Text variant="bodyMd" fontWeight="medium">{data.planDetails.usage.averageMonthly}</Text>
                      </BlockStack>
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Peak Month</Text>
                        <Text variant="bodyMd" fontWeight="medium">{data.planDetails.usage.peakMonth}</Text>
                      </BlockStack>
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Efficiency</Text>
                        <Text variant="bodyMd" fontWeight="medium">{data.planDetails.usage.efficiency}</Text>
                      </BlockStack>
                    </InlineGrid>
                  </BlockStack>
                </Box>

                {/* Upgrade Preview */}
                <Box
                  padding="400"
                  background="bg-surface-info-subdued"
                  borderRadius="300"
                >
                  <BlockStack gap="300">
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={ArrowUpIcon} tone="info" />
                      <Text variant="headingSm" as="h4" fontWeight="semibold">
                        Unlock More with {data.planDetails.nextTier.name}
                      </Text>
                    </InlineStack>

                    <Text variant="bodySm">
                      Your average usage of {data.planDetails.usage.averageMonthly} orders/month means you'd still have plenty of headroom with {data.planDetails.nextTier.ordersIncluded.toLocaleString()} orders.
                    </Text>

                    <BlockStack gap="100">
                      <Text variant="bodySm" fontWeight="semibold">Additional features included:</Text>
                      {data.planDetails.nextTier.additionalFeatures.map((feature) => (
                        <InlineStack gap="200" blockAlign="center" key={feature}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                          <Text variant="bodySm">{feature}</Text>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  </BlockStack>
                </Box>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Option F: Comparison Table - Side-by-side view */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Box paddingBlockEnd="200">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingLg" as="h2">
                      Option F: Comparison Table
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      Side-by-side comparison of current plan vs next tier
                    </Text>
                  </BlockStack>
                </InlineStack>
              </Box>

              <Divider />

              {/* Comparison Grid */}
              <InlineGrid columns={2} gap="400">
                {/* Current Plan Column */}
                <Box
                  padding="400"
                  background="bg-surface-success-subdued"
                  borderRadius="300"
                  borderWidth="025"
                  borderColor="border-success"
                >
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="start">
                      <BlockStack gap="100">
                        <Badge tone="success">Current Plan</Badge>
                        <Text variant="headingLg" as="h3">{data.planDetails.currentPlan.name}</Text>
                      </BlockStack>
                      <Icon source={CheckCircleIcon} tone="success" />
                    </InlineStack>

                    <Divider />

                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="end">
                        <Text variant="heading2xl" as="p">{data.planDetails.currentPlan.price}</Text>
                        <Text variant="bodySm" tone="subdued">/ month</Text>
                      </InlineStack>

                      <InlineStack align="space-between">
                        <Text variant="bodySm" tone="subdued">Orders Included</Text>
                        <Text variant="bodyMd" fontWeight="medium">
                          {data.planDetails.currentPlan.ordersIncluded.toLocaleString()}
                        </Text>
                      </InlineStack>

                      <InlineStack align="space-between">
                        <Text variant="bodySm" tone="subdued">Overage Rate</Text>
                        <Text variant="bodyMd" fontWeight="medium">
                          {data.planDetails.currentPlan.overageRate}/order
                        </Text>
                      </InlineStack>
                    </BlockStack>

                    <Divider />

                    {/* Current Usage */}
                    <BlockStack gap="200">
                      <Text variant="headingSm" as="h4" fontWeight="semibold">
                        This Month
                      </Text>
                      <BlockStack gap="100">
                        <InlineStack align="space-between">
                          <Text variant="bodySm" tone="subdued">Used</Text>
                          <Text variant="bodyMd" fontWeight="medium">
                            {data.planDetails.currentPlan.ordersUsed.toLocaleString()}
                          </Text>
                        </InlineStack>
                        <ProgressBar progress={data.planDetails.currentPlan.percentageUsed} tone="success" />
                        <InlineStack align="space-between">
                          <Text variant="bodySm" tone="subdued">Remaining</Text>
                          <Text variant="bodyMd" fontWeight="medium">
                            {(data.planDetails.currentPlan.ordersIncluded - data.planDetails.currentPlan.ordersUsed).toLocaleString()}
                          </Text>
                        </InlineStack>
                      </BlockStack>
                    </BlockStack>

                    <Divider />

                    {/* Features */}
                    <BlockStack gap="200">
                      <Text variant="headingSm" as="h4" fontWeight="semibold">
                        Features
                      </Text>
                      <BlockStack gap="100">
                        {data.planDetails.currentPlan.features.map((feature) => (
                          <InlineStack gap="200" blockAlign="center" key={feature}>
                            <Icon source={CheckIcon} tone="success" />
                            <Text variant="bodySm">{feature}</Text>
                          </InlineStack>
                        ))}
                      </BlockStack>
                    </BlockStack>
                  </BlockStack>
                </Box>

                {/* Next Tier Column */}
                <Box
                  padding="400"
                  background="bg-surface-info-subdued"
                  borderRadius="300"
                  borderWidth="025"
                  borderColor="border-info"
                >
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="start">
                      <BlockStack gap="100">
                        <Badge tone="info">Upgrade Option</Badge>
                        <Text variant="headingLg" as="h3">{data.planDetails.nextTier.name}</Text>
                      </BlockStack>
                      <Icon source={ArrowUpIcon} tone="info" />
                    </InlineStack>

                    <Divider />

                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="end">
                        <Text variant="heading2xl" as="p">{data.planDetails.nextTier.price}</Text>
                        <Text variant="bodySm" tone="subdued">/ month</Text>
                      </InlineStack>

                      <InlineStack align="space-between">
                        <Text variant="bodySm" tone="subdued">Orders Included</Text>
                        <Text variant="bodyMd" fontWeight="medium">
                          {data.planDetails.nextTier.ordersIncluded.toLocaleString()}
                        </Text>
                      </InlineStack>

                      <InlineStack align="space-between">
                        <Text variant="bodySm" tone="subdued">Overage Rate</Text>
                        <Text variant="bodyMd" fontWeight="medium">
                          $0.04/order
                        </Text>
                      </InlineStack>

                      {/* Difference Badge */}
                      <Box
                        padding="200"
                        background="bg-surface-info"
                        borderRadius="200"
                      >
                        <InlineStack gap="100" blockAlign="center">
                          <Icon source={PlusIcon} tone="info" />
                          <Text variant="bodySm" fontWeight="semibold">
                            +{(data.planDetails.nextTier.ordersIncluded - data.planDetails.currentPlan.ordersIncluded).toLocaleString()} more orders
                          </Text>
                        </InlineStack>
                      </Box>
                    </BlockStack>

                    <Divider />

                    {/* Potential Usage */}
                    <BlockStack gap="200">
                      <Text variant="headingSm" as="h4" fontWeight="semibold">
                        With Your Usage
                      </Text>
                      <BlockStack gap="100">
                        <InlineStack align="space-between">
                          <Text variant="bodySm" tone="subdued">Current: {data.planDetails.currentPlan.ordersUsed.toLocaleString()}</Text>
                          <Text variant="bodyMd" fontWeight="medium">
                            {Math.round((data.planDetails.currentPlan.ordersUsed / data.planDetails.nextTier.ordersIncluded) * 100)}%
                          </Text>
                        </InlineStack>
                        <ProgressBar
                          progress={(data.planDetails.currentPlan.ordersUsed / data.planDetails.nextTier.ordersIncluded) * 100}
                          tone="info"
                        />
                        <Text variant="bodySm" tone="subdued">
                          Room for {(data.planDetails.nextTier.ordersIncluded - data.planDetails.currentPlan.ordersUsed).toLocaleString()} more orders
                        </Text>
                      </BlockStack>
                    </BlockStack>

                    <Divider />

                    {/* All Features + Additional */}
                    <BlockStack gap="200">
                      <Text variant="headingSm" as="h4" fontWeight="semibold">
                        Everything in Growth, plus:
                      </Text>
                      <BlockStack gap="100">
                        {data.planDetails.nextTier.additionalFeatures.map((feature) => (
                          <InlineStack gap="200" blockAlign="center" key={feature}>
                            <Icon source={PlusIcon} tone="info" />
                            <Text variant="bodySm" fontWeight="semibold">{feature}</Text>
                          </InlineStack>
                        ))}
                      </BlockStack>

                      <Box
                        padding="200"
                        background="bg-surface-success"
                        borderRadius="200"
                      >
                        <Text variant="bodySm" fontWeight="semibold" alignment="center">
                          Save {data.planDetails.nextTier.estimatedSavings}
                        </Text>
                      </Box>
                    </BlockStack>
                  </BlockStack>
                </Box>
              </InlineGrid>

              {/* Quick Stats Footer */}
              <Box
                padding="300"
                background="bg-surface-secondary"
                borderRadius="200"
              >
                <InlineGrid columns={3} gap="400">
                  <BlockStack gap="050" inlineAlign="center">
                    <Icon source={ChartVerticalIcon} tone="base" />
                    <Text variant="bodyMd" fontWeight="semibold">
                      {data.planDetails.usage.efficiency}
                    </Text>
                    <Text variant="bodySm" tone="subdued">Plan Efficiency</Text>
                  </BlockStack>
                  <BlockStack gap="050" inlineAlign="center">
                    <Icon source={CalendarIcon} tone="base" />
                    <Text variant="bodyMd" fontWeight="semibold">
                      {data.planDetails.currentPlan.daysRemaining} days
                    </Text>
                    <Text variant="bodySm" tone="subdued">Until Renewal</Text>
                  </BlockStack>
                  <BlockStack gap="050" inlineAlign="center">
                    <Icon source={CartIcon} tone="base" />
                    <Text variant="bodyMd" fontWeight="semibold">
                      {data.planDetails.usage.averageMonthly}
                    </Text>
                    <Text variant="bodySm" tone="subdued">Avg Monthly Orders</Text>
                  </BlockStack>
                </InlineGrid>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
