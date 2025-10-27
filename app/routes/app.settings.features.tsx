import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  Button,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  Box,
  Checkbox,
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

// ============= ACTION =============

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "save-features") {
    const advancedAnalyticsEnabled = formData.get("advancedAnalyticsEnabled") === "true";
    const autoCashbackProcessingEnabled = formData.get("autoCashbackProcessingEnabled") === "true";
    const emailMarketingEnabled = formData.get("emailMarketingEnabled") === "true";
    const tierProductsEnabled = formData.get("tierProductsEnabled") === "true";

    await db.shopSettings.update({
      where: { shop },
      data: {
        advancedAnalyticsEnabled,
        autoCashbackProcessingEnabled,
        emailMarketingEnabled,
        tierProductsEnabled,
      },
    });

    return json({ success: true, message: "Feature settings saved successfully" });
  }

  return json({ success: false, message: "Invalid action" });
};

// ============= COMPONENT =============

export default function FeatureToggles() {
  const { features, shop } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const [formValues, setFormValues] = useState({
    advancedAnalyticsEnabled: features.advancedAnalyticsEnabled,
    autoCashbackProcessingEnabled: features.autoCashbackProcessingEnabled,
    emailMarketingEnabled: features.emailMarketingEnabled,
    tierProductsEnabled: features.tierProductsEnabled,
  });

  const handleChange = useCallback((field: string) => (value: boolean) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const isSaving = fetcher.state === "submitting";
  const showSuccess = fetcher.data?.success && fetcher.state === "idle";

  return (
    <Page
      title="Feature Toggles"
      subtitle="Enable or disable specific features for your store"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          {/* Info Banner */}
          <Banner tone="info">
            <BlockStack gap="200">
              <Text as="p">
                Control which features are active in your RewardsPro installation. Disabling
                features won't delete any data, but will hide them from your interface.
              </Text>
            </BlockStack>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          {/* Success Banner */}
          {showSuccess && (
            <Banner tone="success" onDismiss={() => fetcher.data = null}>
              Feature settings saved successfully
            </Banner>
          )}

          {/* Main Form */}
          <Card>
            <fetcher.Form method="post">
              <input type="hidden" name="action" value="save-features" />
              <input
                type="hidden"
                name="advancedAnalyticsEnabled"
                value={formValues.advancedAnalyticsEnabled.toString()}
              />
              <input
                type="hidden"
                name="autoCashbackProcessingEnabled"
                value={formValues.autoCashbackProcessingEnabled.toString()}
              />
              <input
                type="hidden"
                name="emailMarketingEnabled"
                value={formValues.emailMarketingEnabled.toString()}
              />
              <input
                type="hidden"
                name="tierProductsEnabled"
                value={formValues.tierProductsEnabled.toString()}
              />

              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Feature Settings
                </Text>

                <FormLayout>
                  {/* Advanced Analytics */}
                  <Box>
                    <Checkbox
                      label="Advanced Analytics"
                      checked={formValues.advancedAnalyticsEnabled}
                      onChange={handleChange("advancedAnalyticsEnabled")}
                      helpText="Enable detailed analytics charts, ROI calculations, and tier performance tracking"
                    />
                  </Box>

                  {/* Automatic Cashback Processing */}
                  <Box>
                    <Checkbox
                      label="Automatic Cashback Processing"
                      checked={formValues.autoCashbackProcessingEnabled}
                      onChange={handleChange("autoCashbackProcessingEnabled")}
                      helpText="Automatically process and credit cashback for completed orders"
                    />
                  </Box>

                  {/* Email Marketing Campaign */}
                  <Box>
                    <Checkbox
                      label="Email Marketing Campaigns"
                      checked={formValues.emailMarketingEnabled}
                      onChange={handleChange("emailMarketingEnabled")}
                      helpText="Enable email marketing campaigns and automated customer communications"
                    />
                  </Box>

                  {/* Tier Products Module */}
                  <Box>
                    <Checkbox
                      label="Tier Products Module"
                      checked={formValues.tierProductsEnabled}
                      onChange={handleChange("tierProductsEnabled")}
                      helpText="Allow customers to purchase tier access via Shopify products and subscriptions"
                    />
                  </Box>
                </FormLayout>

                <InlineStack align="end">
                  <Button
                    variant="primary"
                    submit
                    loading={isSaving}
                  >
                    Save Settings
                  </Button>
                </InlineStack>
              </BlockStack>
            </fetcher.Form>
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
