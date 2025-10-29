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
  Button,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Feature Manager Mock Data
  return json({
    features: {
      advancedAnalytics: {
        enabled: true,
        name: "Advanced Analytics",
        description: "Real-time insights, custom reports, and predictive analytics",
        usageStats: "2.3k events/day",
        lastUsed: "2 hours ago",
        impact: "high",
      },
      autoCashback: {
        enabled: true,
        name: "Automatic Cashback Processing",
        description: "Automated reward calculations and instant customer credits",
        usageStats: "487 orders/week",
        lastUsed: "5 minutes ago",
        impact: "critical",
      },
      emailMarketing: {
        enabled: false,
        name: "Email Marketing Campaigns",
        description: "Personalized email campaigns and automated workflows",
        usageStats: "Not active",
        lastUsed: "Never",
        impact: "medium",
      },
      tierProducts: {
        enabled: true,
        name: "Tier Products Module",
        description: "Exclusive products and tier-based access control",
        usageStats: "156 products",
        lastUsed: "1 day ago",
        impact: "high",
      },
    }
  });
};

export default function DashboardMockups() {
  const data = useLoaderData<typeof loader>();
  const features = data.features;
  const activeCount = Object.values(features).filter(f => f.enabled).length;
  const totalCount = Object.values(features).length;

  return (
    <Page title="Feature Manager Layout Options" subtitle="Shopify Design Philosophy Aligned">
      <Layout>
        {/* Option P: Compact Professional List */}
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Box paddingBlockEnd="200">
                <BlockStack gap="100">
                  <Text variant="headingLg" as="h2">
                    Option P: Compact Professional
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    Clean list with inline controls and quick status view
                  </Text>
                </BlockStack>
              </Box>

              <Divider />

              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h3" fontWeight="semibold">
                  Feature Manager
                </Text>
                <Badge tone={activeCount === totalCount ? 'success' : 'info'}>
                  {activeCount}/{totalCount} Active
                </Badge>
              </InlineStack>

              <BlockStack gap="300">
                {/* Advanced Analytics */}
                <Box
                  padding="300"
                  background={features.advancedAnalytics.enabled ? "bg-surface-success-subdued" : "bg-surface"}
                  borderRadius="200"
                >
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="start">
                      <BlockStack gap="050">
                        <Text variant="bodyMd" fontWeight="semibold">
                          {features.advancedAnalytics.name}
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          {features.advancedAnalytics.description}
                        </Text>
                      </BlockStack>
                      <s-switch
                        id="analytics-p"
                        checked={features.advancedAnalytics.enabled}
                      />
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="info" size="small">{features.advancedAnalytics.usageStats}</Badge>
                      <Text variant="bodySm" tone="subdued">•</Text>
                      <Text variant="bodySm" tone="subdued">{features.advancedAnalytics.lastUsed}</Text>
                    </InlineStack>
                  </BlockStack>
                </Box>

                {/* Auto Cashback */}
                <Box
                  padding="300"
                  background={features.autoCashback.enabled ? "bg-surface-success-subdued" : "bg-surface"}
                  borderRadius="200"
                >
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="start">
                      <BlockStack gap="050">
                        <Text variant="bodyMd" fontWeight="semibold">
                          {features.autoCashback.name}
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          {features.autoCashback.description}
                        </Text>
                      </BlockStack>
                      <s-switch
                        id="cashback-p"
                        checked={features.autoCashback.enabled}
                      />
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="info" size="small">{features.autoCashback.usageStats}</Badge>
                      <Text variant="bodySm" tone="subdued">•</Text>
                      <Text variant="bodySm" tone="subdued">{features.autoCashback.lastUsed}</Text>
                    </InlineStack>
                  </BlockStack>
                </Box>

                {/* Email Marketing */}
                <Box
                  padding="300"
                  background={features.emailMarketing.enabled ? "bg-surface-success-subdued" : "bg-surface"}
                  borderRadius="200"
                >
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="start">
                      <BlockStack gap="050">
                        <Text variant="bodyMd" fontWeight="semibold">
                          {features.emailMarketing.name}
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          {features.emailMarketing.description}
                        </Text>
                      </BlockStack>
                      <s-switch
                        id="marketing-p"
                        checked={features.emailMarketing.enabled}
                      />
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="subdued" size="small">{features.emailMarketing.usageStats}</Badge>
                      <Text variant="bodySm" tone="subdued">•</Text>
                      <Text variant="bodySm" tone="subdued">{features.emailMarketing.lastUsed}</Text>
                    </InlineStack>
                  </BlockStack>
                </Box>

                {/* Tier Products */}
                <Box
                  padding="300"
                  background={features.tierProducts.enabled ? "bg-surface-success-subdued" : "bg-surface"}
                  borderRadius="200"
                >
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="start">
                      <BlockStack gap="050">
                        <Text variant="bodyMd" fontWeight="semibold">
                          {features.tierProducts.name}
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          {features.tierProducts.description}
                        </Text>
                      </BlockStack>
                      <s-switch
                        id="tierproducts-p"
                        checked={features.tierProducts.enabled}
                      />
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="info" size="small">{features.tierProducts.usageStats}</Badge>
                      <Text variant="bodySm" tone="subdued">•</Text>
                      <Text variant="bodySm" tone="subdued">{features.tierProducts.lastUsed}</Text>
                    </InlineStack>
                  </BlockStack>
                </Box>
              </BlockStack>

              <Divider />

              <Text variant="bodySm" tone="subdued">
                Features can be toggled instantly. Changes take effect immediately.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Option Q: Impact-Based Cards */}
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Box paddingBlockEnd="200">
                <BlockStack gap="100">
                  <Text variant="headingLg" as="h2">
                    Option Q: Impact-Based Cards
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    Organized by impact with visual hierarchy and quick actions
                  </Text>
                </BlockStack>
              </Box>

              <Divider />

              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h3" fontWeight="semibold">
                  Feature Manager
                </Text>
                <Button variant="plain" size="slim">View all</Button>
              </InlineStack>

              {/* Critical Impact */}
              <BlockStack gap="300">
                <Text variant="bodySm" fontWeight="semibold" tone="subdued">
                  CRITICAL IMPACT
                </Text>

                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="start">
                      <BlockStack gap="200">
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="headingSm" as="h4" fontWeight="semibold">
                            {features.autoCashback.name}
                          </Text>
                          <Badge tone={features.autoCashback.enabled ? 'success' : 'subdued'}>
                            {features.autoCashback.enabled ? 'Active' : 'Inactive'}
                          </Badge>
                        </InlineStack>
                        <Text variant="bodySm" tone="subdued">
                          {features.autoCashback.description}
                        </Text>
                      </BlockStack>
                    </InlineStack>

                    <Divider />

                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Usage</Text>
                        <Text variant="bodyMd" fontWeight="medium">
                          {features.autoCashback.usageStats}
                        </Text>
                      </BlockStack>
                      <BlockStack gap="050" inlineAlign="end">
                        <Text variant="bodySm" tone="subdued">Last active</Text>
                        <Text variant="bodyMd" fontWeight="medium">
                          {features.autoCashback.lastUsed}
                        </Text>
                      </BlockStack>
                      <s-switch
                        id="cashback-q"
                        checked={features.autoCashback.enabled}
                      />
                    </InlineStack>
                  </BlockStack>
                </Card>
              </BlockStack>

              {/* High Impact */}
              <BlockStack gap="300">
                <Text variant="bodySm" fontWeight="semibold" tone="subdued">
                  HIGH IMPACT
                </Text>

                <InlineGrid columns={1} gap="300">
                  <Card>
                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="050">
                          <InlineStack gap="200" blockAlign="center">
                            <Text variant="bodyMd" fontWeight="semibold">
                              {features.advancedAnalytics.name}
                            </Text>
                            <Badge tone={features.advancedAnalytics.enabled ? 'success' : 'subdued'} size="small">
                              {features.advancedAnalytics.enabled ? 'On' : 'Off'}
                            </Badge>
                          </InlineStack>
                          <Text variant="bodySm" tone="subdued">
                            {features.advancedAnalytics.usageStats} • {features.advancedAnalytics.lastUsed}
                          </Text>
                        </BlockStack>
                        <s-switch
                          id="analytics-q"
                          checked={features.advancedAnalytics.enabled}
                        />
                      </InlineStack>
                    </BlockStack>
                  </Card>

                  <Card>
                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="050">
                          <InlineStack gap="200" blockAlign="center">
                            <Text variant="bodyMd" fontWeight="semibold">
                              {features.tierProducts.name}
                            </Text>
                            <Badge tone={features.tierProducts.enabled ? 'success' : 'subdued'} size="small">
                              {features.tierProducts.enabled ? 'On' : 'Off'}
                            </Badge>
                          </InlineStack>
                          <Text variant="bodySm" tone="subdued">
                            {features.tierProducts.usageStats} • {features.tierProducts.lastUsed}
                          </Text>
                        </BlockStack>
                        <s-switch
                          id="tierproducts-q"
                          checked={features.tierProducts.enabled}
                        />
                      </InlineStack>
                    </BlockStack>
                  </Card>
                </InlineGrid>
              </BlockStack>

              {/* Medium Impact */}
              <BlockStack gap="300">
                <Text variant="bodySm" fontWeight="semibold" tone="subdued">
                  MEDIUM IMPACT
                </Text>

                <Card>
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="050">
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodyMd" fontWeight="semibold">
                            {features.emailMarketing.name}
                          </Text>
                          <Badge tone={features.emailMarketing.enabled ? 'success' : 'subdued'} size="small">
                            {features.emailMarketing.enabled ? 'On' : 'Off'}
                          </Badge>
                        </InlineStack>
                        <Text variant="bodySm" tone="subdued">
                          {features.emailMarketing.usageStats}
                        </Text>
                      </BlockStack>
                      <s-switch
                        id="marketing-q"
                        checked={features.emailMarketing.enabled}
                      />
                    </InlineStack>
                  </BlockStack>
                </Card>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Option R: Data Table Style */}
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Box paddingBlockEnd="200">
                <BlockStack gap="100">
                  <Text variant="headingLg" as="h2">
                    Option R: Data Table Style
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    Structured table layout with detailed status information
                  </Text>
                </BlockStack>
              </Box>

              <Divider />

              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="050">
                  <Text variant="headingMd" as="h3" fontWeight="semibold">
                    Feature Manager
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    {activeCount} of {totalCount} features enabled
                  </Text>
                </BlockStack>
                <Badge tone={activeCount === totalCount ? 'success' : activeCount >= 2 ? 'info' : 'warning'}>
                  {Math.round((activeCount / totalCount) * 100)}% Active
                </Badge>
              </InlineStack>

              <BlockStack gap="200">
                {/* Advanced Analytics Row */}
                <Box
                  padding="300"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodyMd" fontWeight="semibold">
                        {features.advancedAnalytics.name}
                      </Text>
                      <s-switch
                        id="analytics-r"
                        checked={features.advancedAnalytics.enabled}
                      />
                    </InlineStack>

                    <InlineGrid columns={3} gap="200">
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Status</Text>
                        <Badge tone={features.advancedAnalytics.enabled ? 'success' : 'subdued'} size="small">
                          {features.advancedAnalytics.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                      </BlockStack>
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Usage</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {features.advancedAnalytics.usageStats}
                        </Text>
                      </BlockStack>
                      <BlockStack gap="050" inlineAlign="end">
                        <Text variant="bodySm" tone="subdued">Impact</Text>
                        <Badge tone="attention" size="small">
                          {features.advancedAnalytics.impact.toUpperCase()}
                        </Badge>
                      </BlockStack>
                    </InlineGrid>
                  </BlockStack>
                </Box>

                {/* Auto Cashback Row */}
                <Box
                  padding="300"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodyMd" fontWeight="semibold">
                        {features.autoCashback.name}
                      </Text>
                      <s-switch
                        id="cashback-r"
                        checked={features.autoCashback.enabled}
                      />
                    </InlineStack>

                    <InlineGrid columns={3} gap="200">
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Status</Text>
                        <Badge tone={features.autoCashback.enabled ? 'success' : 'subdued'} size="small">
                          {features.autoCashback.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                      </BlockStack>
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Usage</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {features.autoCashback.usageStats}
                        </Text>
                      </BlockStack>
                      <BlockStack gap="050" inlineAlign="end">
                        <Text variant="bodySm" tone="subdued">Impact</Text>
                        <Badge tone="critical" size="small">
                          {features.autoCashback.impact.toUpperCase()}
                        </Badge>
                      </BlockStack>
                    </InlineGrid>
                  </BlockStack>
                </Box>

                {/* Email Marketing Row */}
                <Box
                  padding="300"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodyMd" fontWeight="semibold">
                        {features.emailMarketing.name}
                      </Text>
                      <s-switch
                        id="marketing-r"
                        checked={features.emailMarketing.enabled}
                      />
                    </InlineStack>

                    <InlineGrid columns={3} gap="200">
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Status</Text>
                        <Badge tone={features.emailMarketing.enabled ? 'success' : 'subdued'} size="small">
                          {features.emailMarketing.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                      </BlockStack>
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Usage</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {features.emailMarketing.usageStats}
                        </Text>
                      </BlockStack>
                      <BlockStack gap="050" inlineAlign="end">
                        <Text variant="bodySm" tone="subdued">Impact</Text>
                        <Badge tone="info" size="small">
                          {features.emailMarketing.impact.toUpperCase()}
                        </Badge>
                      </BlockStack>
                    </InlineGrid>
                  </BlockStack>
                </Box>

                {/* Tier Products Row */}
                <Box
                  padding="300"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodyMd" fontWeight="semibold">
                        {features.tierProducts.name}
                      </Text>
                      <s-switch
                        id="tierproducts-r"
                        checked={features.tierProducts.enabled}
                      />
                    </InlineStack>

                    <InlineGrid columns={3} gap="200">
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Status</Text>
                        <Badge tone={features.tierProducts.enabled ? 'success' : 'subdued'} size="small">
                          {features.tierProducts.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                      </BlockStack>
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Usage</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {features.tierProducts.usageStats}
                        </Text>
                      </BlockStack>
                      <BlockStack gap="050" inlineAlign="end">
                        <Text variant="bodySm" tone="subdued">Impact</Text>
                        <Badge tone="attention" size="small">
                          {features.tierProducts.impact.toUpperCase()}
                        </Badge>
                      </BlockStack>
                    </InlineGrid>
                  </BlockStack>
                </Box>
              </BlockStack>

              <Divider />

              <InlineStack align="space-between" blockAlign="center">
                <Text variant="bodySm" tone="subdued">
                  Last updated: Just now
                </Text>
                <Button variant="plain" size="slim">Configure</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
