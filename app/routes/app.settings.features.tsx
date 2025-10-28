import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Banner,
  BlockStack,
  Text,
  Box,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// ============= TYPES =============

type FeatureToggles = {
  advancedAnalyticsEnabled: boolean;
  autoCashbackProcessingEnabled: boolean;
  emailMarketingEnabled: boolean;
  tierProductsEnabled: boolean;
};

type LoaderData = {
  features: FeatureToggles;
  shop: string;
};

// ============= LOADER =============

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Fetch current feature toggles from shopSettings
  const shopSettings = await db.shopSettings.findUnique({
    where: { shop },
    select: {
      advancedAnalyticsEnabled: true,
      autoCashbackProcessingEnabled: true,
      emailMarketingEnabled: true,
      tierProductsEnabled: true,
    },
  });

  // If no settings exist, create them with defaults
  if (!shopSettings) {
    await db.shopSettings.upsert({
      where: { shop },
      create: {
        shop,
        storeName: shop,
        storeUrl: `https://${shop}`,
        advancedAnalyticsEnabled: true,
        autoCashbackProcessingEnabled: true,
        emailMarketingEnabled: false,
        tierProductsEnabled: true,
      },
      update: {},
    });
  }

  const features: FeatureToggles = {
    advancedAnalyticsEnabled: shopSettings?.advancedAnalyticsEnabled ?? true,
    autoCashbackProcessingEnabled: shopSettings?.autoCashbackProcessingEnabled ?? true,
    emailMarketingEnabled: shopSettings?.emailMarketingEnabled ?? false,
    tierProductsEnabled: shopSettings?.tierProductsEnabled ?? true,
  };

  return json<LoaderData>({ features, shop });
};

// ============= COMPONENT =============

// Rectangular Toggle Button Component
interface ToggleButtonProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

function ToggleButton({ label, description, enabled, onToggle }: ToggleButtonProps) {
  return (
    <Box
      padding="400"
      background={enabled ? "bg-fill-success-secondary" : "bg-fill-secondary"}
      borderRadius="200"
    >
      <BlockStack gap="300">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <BlockStack gap="100">
            <Text variant="headingSm" as="h3" fontWeight="semibold">
              {label}
            </Text>
            <Text variant="bodySm" as="p" tone="subdued">
              {description}
            </Text>
          </BlockStack>

          <button
            type="button"
            onClick={onToggle}
            style={{
              padding: "8px 24px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "13px",
              transition: "all 0.2s ease",
              backgroundColor: enabled ? "#22c55e" : "#6b7280",
              color: "white",
              minWidth: "100px",
              boxShadow: enabled
                ? "0 1px 3px rgba(34, 197, 94, 0.3)"
                : "0 1px 3px rgba(0, 0, 0, 0.1)",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = enabled
                ? "0 4px 6px rgba(34, 197, 94, 0.4)"
                : "0 4px 6px rgba(0, 0, 0, 0.15)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = enabled
                ? "0 1px 3px rgba(34, 197, 94, 0.3)"
                : "0 1px 3px rgba(0, 0, 0, 0.1)";
            }}
          >
            {enabled ? "ENABLED" : "DISABLED"}
          </button>
        </div>
      </BlockStack>
    </Box>
  );
}

// ============= MAIN COMPONENT =============

export default function FeatureToggles() {
  const { features } = useLoaderData<typeof loader>();

  const [toggleStates, setToggleStates] = useState({
    advancedAnalyticsEnabled: features.advancedAnalyticsEnabled,
    autoCashbackProcessingEnabled: features.autoCashbackProcessingEnabled,
    emailMarketingEnabled: features.emailMarketingEnabled,
    tierProductsEnabled: features.tierProductsEnabled,
  });

  const handleToggle = useCallback((field: keyof typeof toggleStates) => {
    setToggleStates((prev) => ({ ...prev, [field]: !prev[field] }));
  }, []);

  return (
    <Page
      title="Feature Toggles"
      subtitle="Preview and toggle feature states (UI only)"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          {/* Info Banner */}
          <Banner tone="info">
            <BlockStack gap="200">
              <Text as="p">
                Toggle features on and off to preview their states. These toggles are UI-only
                and do not persist changes to the database. Use this to explore feature configurations.
              </Text>
            </BlockStack>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Feature Settings
              </Text>

              <BlockStack gap="300">
                {/* Advanced Analytics */}
                <ToggleButton
                  label="Advanced Analytics"
                  description="Enable detailed analytics charts, ROI calculations, and tier performance tracking"
                  enabled={toggleStates.advancedAnalyticsEnabled}
                  onToggle={() => handleToggle("advancedAnalyticsEnabled")}
                />

                {/* Automatic Cashback Processing */}
                <ToggleButton
                  label="Automatic Cashback Processing"
                  description="Automatically process and credit cashback for completed orders"
                  enabled={toggleStates.autoCashbackProcessingEnabled}
                  onToggle={() => handleToggle("autoCashbackProcessingEnabled")}
                />

                {/* Email Marketing Campaign */}
                <ToggleButton
                  label="Email Marketing Campaigns"
                  description="Enable email marketing campaigns and automated customer communications"
                  enabled={toggleStates.emailMarketingEnabled}
                  onToggle={() => handleToggle("emailMarketingEnabled")}
                />

                {/* Tier Products Module */}
                <ToggleButton
                  label="Tier Products Module"
                  description="Allow customers to purchase tier access via Shopify products and subscriptions"
                  enabled={toggleStates.tierProductsEnabled}
                  onToggle={() => handleToggle("tierProductsEnabled")}
                />
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {/* Help Card */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Feature Descriptions
              </Text>

              <BlockStack gap="300">
                <Box>
                  <Text variant="headingSm" as="h3" fontWeight="semibold">
                    Advanced Analytics
                  </Text>
                  <Text as="p" tone="subdued">
                    Provides in-depth insights into your loyalty program performance, including
                    tier comparisons, revenue attribution, and customer behavior analysis.
                  </Text>
                </Box>

                <Box>
                  <Text variant="headingSm" as="h3" fontWeight="semibold">
                    Automatic Cashback Processing
                  </Text>
                  <Text as="p" tone="subdued">
                    Automatically credits cashback rewards to customers when their orders are fulfilled.
                    Disable this if you prefer to manually approve cashback credits.
                  </Text>
                </Box>

                <Box>
                  <Text variant="headingSm" as="h3" fontWeight="semibold">
                    Email Marketing Campaigns
                  </Text>
                  <Text as="p" tone="subdued">
                    Enables automated email campaigns for tier upgrades, rewards notifications,
                    and promotional announcements to your loyalty members.
                  </Text>
                </Box>

                <Box>
                  <Text variant="headingSm" as="h3" fontWeight="semibold">
                    Tier Products Module
                  </Text>
                  <Text as="p" tone="subdued">
                    Allows you to create Shopify products that grant tier access when purchased,
                    enabling paid memberships and subscription-based tiers.
                  </Text>
                </Box>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
