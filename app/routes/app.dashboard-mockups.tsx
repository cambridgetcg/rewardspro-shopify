import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState, useEffect } from "react";
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
  Toast,
  Frame,
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

  // State for each option's features
  const [featuresP, setFeaturesP] = useState(data.features);
  const [featuresQ, setFeaturesQ] = useState(data.features);
  const [featuresR, setFeaturesR] = useState(data.features);

  // Toast state
  const [toastActive, setToastActive] = useState(false);
  const [toastContent, setToastContent] = useState('');

  const activeCountP = Object.values(featuresP).filter(f => f.enabled).length;
  const activeCountQ = Object.values(featuresQ).filter(f => f.enabled).length;
  const activeCountR = Object.values(featuresR).filter(f => f.enabled).length;
  const totalCount = Object.values(data.features).length;

  // Handler for Option P toggles
  useEffect(() => {
    const analyticsP = document.getElementById('analytics-p');
    const cashbackP = document.getElementById('cashback-p');
    const marketingP = document.getElementById('marketing-p');
    const tierproductsP = document.getElementById('tierproducts-p');

    const handleAnalyticsP = (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      setFeaturesP(prev => ({
        ...prev,
        advancedAnalytics: { ...prev.advancedAnalytics, enabled: checked }
      }));
      setToastContent(`Advanced Analytics ${checked ? 'enabled' : 'disabled'}`);
      setToastActive(true);
    };

    const handleCashbackP = (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      setFeaturesP(prev => ({
        ...prev,
        autoCashback: { ...prev.autoCashback, enabled: checked }
      }));
      setToastContent(`Automatic Cashback ${checked ? 'enabled' : 'disabled'}`);
      setToastActive(true);
    };

    const handleMarketingP = (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      setFeaturesP(prev => ({
        ...prev,
        emailMarketing: { ...prev.emailMarketing, enabled: checked }
      }));
      setToastContent(`Email Marketing ${checked ? 'enabled' : 'disabled'}`);
      setToastActive(true);
    };

    const handleTierProductsP = (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      setFeaturesP(prev => ({
        ...prev,
        tierProducts: { ...prev.tierProducts, enabled: checked }
      }));
      setToastContent(`Tier Products ${checked ? 'enabled' : 'disabled'}`);
      setToastActive(true);
    };

    analyticsP?.addEventListener('change', handleAnalyticsP);
    cashbackP?.addEventListener('change', handleCashbackP);
    marketingP?.addEventListener('change', handleMarketingP);
    tierproductsP?.addEventListener('change', handleTierProductsP);

    return () => {
      analyticsP?.removeEventListener('change', handleAnalyticsP);
      cashbackP?.removeEventListener('change', handleCashbackP);
      marketingP?.removeEventListener('change', handleMarketingP);
      tierproductsP?.removeEventListener('change', handleTierProductsP);
    };
  }, []);

  // Handler for Option Q toggles
  useEffect(() => {
    const analyticsQ = document.getElementById('analytics-q');
    const cashbackQ = document.getElementById('cashback-q');
    const marketingQ = document.getElementById('marketing-q');
    const tierproductsQ = document.getElementById('tierproducts-q');

    const handleAnalyticsQ = (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      setFeaturesQ(prev => ({
        ...prev,
        advancedAnalytics: { ...prev.advancedAnalytics, enabled: checked }
      }));
      setToastContent(`Advanced Analytics ${checked ? 'enabled' : 'disabled'}`);
      setToastActive(true);
    };

    const handleCashbackQ = (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      setFeaturesQ(prev => ({
        ...prev,
        autoCashback: { ...prev.autoCashback, enabled: checked }
      }));
      setToastContent(`Automatic Cashback ${checked ? 'enabled' : 'disabled'}`);
      setToastActive(true);
    };

    const handleMarketingQ = (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      setFeaturesQ(prev => ({
        ...prev,
        emailMarketing: { ...prev.emailMarketing, enabled: checked }
      }));
      setToastContent(`Email Marketing ${checked ? 'enabled' : 'disabled'}`);
      setToastActive(true);
    };

    const handleTierProductsQ = (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      setFeaturesQ(prev => ({
        ...prev,
        tierProducts: { ...prev.tierProducts, enabled: checked }
      }));
      setToastContent(`Tier Products ${checked ? 'enabled' : 'disabled'}`);
      setToastActive(true);
    };

    analyticsQ?.addEventListener('change', handleAnalyticsQ);
    cashbackQ?.addEventListener('change', handleCashbackQ);
    marketingQ?.addEventListener('change', handleMarketingQ);
    tierproductsQ?.addEventListener('change', handleTierProductsQ);

    return () => {
      analyticsQ?.removeEventListener('change', handleAnalyticsQ);
      cashbackQ?.removeEventListener('change', handleCashbackQ);
      marketingQ?.removeEventListener('change', handleMarketingQ);
      tierproductsQ?.removeEventListener('change', handleTierProductsQ);
    };
  }, []);

  // Handler for Option R toggles
  useEffect(() => {
    const analyticsR = document.getElementById('analytics-r');
    const cashbackR = document.getElementById('cashback-r');
    const marketingR = document.getElementById('marketing-r');
    const tierproductsR = document.getElementById('tierproducts-r');

    const handleAnalyticsR = (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      setFeaturesR(prev => ({
        ...prev,
        advancedAnalytics: { ...prev.advancedAnalytics, enabled: checked }
      }));
      setToastContent(`Advanced Analytics ${checked ? 'enabled' : 'disabled'}`);
      setToastActive(true);
    };

    const handleCashbackR = (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      setFeaturesR(prev => ({
        ...prev,
        autoCashback: { ...prev.autoCashback, enabled: checked }
      }));
      setToastContent(`Automatic Cashback ${checked ? 'enabled' : 'disabled'}`);
      setToastActive(true);
    };

    const handleMarketingR = (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      setFeaturesR(prev => ({
        ...prev,
        emailMarketing: { ...prev.emailMarketing, enabled: checked }
      }));
      setToastContent(`Email Marketing ${checked ? 'enabled' : 'disabled'}`);
      setToastActive(true);
    };

    const handleTierProductsR = (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      setFeaturesR(prev => ({
        ...prev,
        tierProducts: { ...prev.tierProducts, enabled: checked }
      }));
      setToastContent(`Tier Products ${checked ? 'enabled' : 'disabled'}`);
      setToastActive(true);
    };

    analyticsR?.addEventListener('change', handleAnalyticsR);
    cashbackR?.addEventListener('change', handleCashbackR);
    marketingR?.addEventListener('change', handleMarketingR);
    tierproductsR?.addEventListener('change', handleTierProductsR);

    return () => {
      analyticsR?.removeEventListener('change', handleAnalyticsR);
      cashbackR?.removeEventListener('change', handleCashbackR);
      marketingR?.removeEventListener('change', handleMarketingR);
      tierproductsR?.removeEventListener('change', handleTierProductsR);
    };
  }, []);

  const toastMarkup = toastActive ? (
    <Toast content={toastContent} onDismiss={() => setToastActive(false)} />
  ) : null;

  return (
    <Frame>
      {toastMarkup}
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
                <Badge tone={activeCountP === totalCount ? 'success' : 'info'}>
                  {activeCountP}/{totalCount} Active
                </Badge>
              </InlineStack>

              <BlockStack gap="300">
                {/* Advanced Analytics */}
                <Box
                  padding="300"
                  background={featuresP.advancedAnalytics.enabled ? "bg-surface-success-subdued" : "bg-surface"}
                  borderRadius="200"
                >
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="start">
                      <BlockStack gap="050">
                        <Text variant="bodyMd" fontWeight="semibold">
                          {featuresP.advancedAnalytics.name}
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          {featuresP.advancedAnalytics.description}
                        </Text>
                      </BlockStack>
                      <s-switch
                        id="analytics-p"
                        checked={featuresP.advancedAnalytics.enabled}
                      />
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="info" size="small">{featuresP.advancedAnalytics.usageStats}</Badge>
                      <Text variant="bodySm" tone="subdued">•</Text>
                      <Text variant="bodySm" tone="subdued">{featuresP.advancedAnalytics.lastUsed}</Text>
                    </InlineStack>
                  </BlockStack>
                </Box>

                {/* Auto Cashback */}
                <Box
                  padding="300"
                  background={featuresP.autoCashback.enabled ? "bg-surface-success-subdued" : "bg-surface"}
                  borderRadius="200"
                >
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="start">
                      <BlockStack gap="050">
                        <Text variant="bodyMd" fontWeight="semibold">
                          {featuresP.autoCashback.name}
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          {featuresP.autoCashback.description}
                        </Text>
                      </BlockStack>
                      <s-switch
                        id="cashback-p"
                        checked={featuresP.autoCashback.enabled}
                      />
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="info" size="small">{featuresP.autoCashback.usageStats}</Badge>
                      <Text variant="bodySm" tone="subdued">•</Text>
                      <Text variant="bodySm" tone="subdued">{featuresP.autoCashback.lastUsed}</Text>
                    </InlineStack>
                  </BlockStack>
                </Box>

                {/* Email Marketing */}
                <Box
                  padding="300"
                  background={featuresP.emailMarketing.enabled ? "bg-surface-success-subdued" : "bg-surface"}
                  borderRadius="200"
                >
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="start">
                      <BlockStack gap="050">
                        <Text variant="bodyMd" fontWeight="semibold">
                          {featuresP.emailMarketing.name}
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          {featuresP.emailMarketing.description}
                        </Text>
                      </BlockStack>
                      <s-switch
                        id="marketing-p"
                        checked={featuresP.emailMarketing.enabled}
                      />
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="subdued" size="small">{featuresP.emailMarketing.usageStats}</Badge>
                      <Text variant="bodySm" tone="subdued">•</Text>
                      <Text variant="bodySm" tone="subdued">{featuresP.emailMarketing.lastUsed}</Text>
                    </InlineStack>
                  </BlockStack>
                </Box>

                {/* Tier Products */}
                <Box
                  padding="300"
                  background={featuresP.tierProducts.enabled ? "bg-surface-success-subdued" : "bg-surface"}
                  borderRadius="200"
                >
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="start">
                      <BlockStack gap="050">
                        <Text variant="bodyMd" fontWeight="semibold">
                          {featuresP.tierProducts.name}
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          {featuresP.tierProducts.description}
                        </Text>
                      </BlockStack>
                      <s-switch
                        id="tierproducts-p"
                        checked={featuresP.tierProducts.enabled}
                      />
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="info" size="small">{featuresP.tierProducts.usageStats}</Badge>
                      <Text variant="bodySm" tone="subdued">•</Text>
                      <Text variant="bodySm" tone="subdued">{featuresP.tierProducts.lastUsed}</Text>
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
                            {featuresQ.autoCashback.name}
                          </Text>
                          <Badge tone={featuresQ.autoCashback.enabled ? 'success' : 'subdued'}>
                            {featuresQ.autoCashback.enabled ? 'Active' : 'Inactive'}
                          </Badge>
                        </InlineStack>
                        <Text variant="bodySm" tone="subdued">
                          {featuresQ.autoCashback.description}
                        </Text>
                      </BlockStack>
                    </InlineStack>

                    <Divider />

                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Usage</Text>
                        <Text variant="bodyMd" fontWeight="medium">
                          {featuresQ.autoCashback.usageStats}
                        </Text>
                      </BlockStack>
                      <BlockStack gap="050" inlineAlign="end">
                        <Text variant="bodySm" tone="subdued">Last active</Text>
                        <Text variant="bodyMd" fontWeight="medium">
                          {featuresQ.autoCashback.lastUsed}
                        </Text>
                      </BlockStack>
                      <s-switch
                        id="cashback-q"
                        checked={featuresQ.autoCashback.enabled}
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
                              {featuresQ.advancedAnalytics.name}
                            </Text>
                            <Badge tone={featuresQ.advancedAnalytics.enabled ? 'success' : 'subdued'} size="small">
                              {featuresQ.advancedAnalytics.enabled ? 'On' : 'Off'}
                            </Badge>
                          </InlineStack>
                          <Text variant="bodySm" tone="subdued">
                            {featuresQ.advancedAnalytics.usageStats} • {featuresQ.advancedAnalytics.lastUsed}
                          </Text>
                        </BlockStack>
                        <s-switch
                          id="analytics-q"
                          checked={featuresQ.advancedAnalytics.enabled}
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
                              {featuresQ.tierProducts.name}
                            </Text>
                            <Badge tone={featuresQ.tierProducts.enabled ? 'success' : 'subdued'} size="small">
                              {featuresQ.tierProducts.enabled ? 'On' : 'Off'}
                            </Badge>
                          </InlineStack>
                          <Text variant="bodySm" tone="subdued">
                            {featuresQ.tierProducts.usageStats} • {featuresQ.tierProducts.lastUsed}
                          </Text>
                        </BlockStack>
                        <s-switch
                          id="tierproducts-q"
                          checked={featuresQ.tierProducts.enabled}
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
                            {featuresQ.emailMarketing.name}
                          </Text>
                          <Badge tone={featuresQ.emailMarketing.enabled ? 'success' : 'subdued'} size="small">
                            {featuresQ.emailMarketing.enabled ? 'On' : 'Off'}
                          </Badge>
                        </InlineStack>
                        <Text variant="bodySm" tone="subdued">
                          {featuresQ.emailMarketing.usageStats}
                        </Text>
                      </BlockStack>
                      <s-switch
                        id="marketing-q"
                        checked={featuresQ.emailMarketing.enabled}
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
                    {activeCountR} of {totalCount} features enabled
                  </Text>
                </BlockStack>
                <Badge tone={activeCountR === totalCount ? 'success' : activeCountR >= 2 ? 'info' : 'warning'}>
                  {Math.round((activeCountR / totalCount) * 100)}% Active
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
                        {featuresR.advancedAnalytics.name}
                      </Text>
                      <s-switch
                        id="analytics-r"
                        checked={featuresR.advancedAnalytics.enabled}
                      />
                    </InlineStack>

                    <InlineGrid columns={3} gap="200">
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Status</Text>
                        <Badge tone={featuresR.advancedAnalytics.enabled ? 'success' : 'subdued'} size="small">
                          {featuresR.advancedAnalytics.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                      </BlockStack>
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Usage</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {featuresR.advancedAnalytics.usageStats}
                        </Text>
                      </BlockStack>
                      <BlockStack gap="050" inlineAlign="end">
                        <Text variant="bodySm" tone="subdued">Impact</Text>
                        <Badge tone="attention" size="small">
                          {featuresR.advancedAnalytics.impact.toUpperCase()}
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
                        {featuresR.autoCashback.name}
                      </Text>
                      <s-switch
                        id="cashback-r"
                        checked={featuresR.autoCashback.enabled}
                      />
                    </InlineStack>

                    <InlineGrid columns={3} gap="200">
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Status</Text>
                        <Badge tone={featuresR.autoCashback.enabled ? 'success' : 'subdued'} size="small">
                          {featuresR.autoCashback.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                      </BlockStack>
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Usage</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {featuresR.autoCashback.usageStats}
                        </Text>
                      </BlockStack>
                      <BlockStack gap="050" inlineAlign="end">
                        <Text variant="bodySm" tone="subdued">Impact</Text>
                        <Badge tone="critical" size="small">
                          {featuresR.autoCashback.impact.toUpperCase()}
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
                        {featuresR.emailMarketing.name}
                      </Text>
                      <s-switch
                        id="marketing-r"
                        checked={featuresR.emailMarketing.enabled}
                      />
                    </InlineStack>

                    <InlineGrid columns={3} gap="200">
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Status</Text>
                        <Badge tone={featuresR.emailMarketing.enabled ? 'success' : 'subdued'} size="small">
                          {featuresR.emailMarketing.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                      </BlockStack>
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Usage</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {featuresR.emailMarketing.usageStats}
                        </Text>
                      </BlockStack>
                      <BlockStack gap="050" inlineAlign="end">
                        <Text variant="bodySm" tone="subdued">Impact</Text>
                        <Badge tone="info" size="small">
                          {featuresR.emailMarketing.impact.toUpperCase()}
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
                        {featuresR.tierProducts.name}
                      </Text>
                      <s-switch
                        id="tierproducts-r"
                        checked={featuresR.tierProducts.enabled}
                      />
                    </InlineStack>

                    <InlineGrid columns={3} gap="200">
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Status</Text>
                        <Badge tone={featuresR.tierProducts.enabled ? 'success' : 'subdued'} size="small">
                          {featuresR.tierProducts.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                      </BlockStack>
                      <BlockStack gap="050">
                        <Text variant="bodySm" tone="subdued">Usage</Text>
                        <Text variant="bodySm" fontWeight="medium">
                          {featuresR.tierProducts.usageStats}
                        </Text>
                      </BlockStack>
                      <BlockStack gap="050" inlineAlign="end">
                        <Text variant="bodySm" tone="subdued">Impact</Text>
                        <Badge tone="attention" size="small">
                          {featuresR.tierProducts.impact.toUpperCase()}
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
    </Frame>
  );
}
