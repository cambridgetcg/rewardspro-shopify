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
} from "~/utils/polaris-icons";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Mock data for all layouts
  return json({
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
    <Page title="System Status Layout Options" subtitle="Choose your preferred design">
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
      </Layout>
    </Page>
  );
}
