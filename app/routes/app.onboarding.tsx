import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Icon,
  ProgressBar,
  Box,
  Badge,
  Banner,
  TextField,
  Select,
  Divider,
} from "@shopify/polaris";
import {
  CheckCircleIcon,
  AlertCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  RefreshIcon,
} from "~/utils/polaris-icons";
import { authenticate } from "../shopify.server";
import db from "../db.server";

interface LoaderData {
  shop: string;
  onboarding: {
    syncedOrders: boolean;
    createdTiers: boolean;
    syncedCustomers: boolean;
    configuredSettings: boolean;
    completed: boolean;
  };
  counts: {
    orders: number;
    tiers: number;
    customers: number;
  };
  settings: {
    storeCurrency: string | null;
    storeName: string | null;
  };
  currentStep: number;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Fetch onboarding status
  const shopSettings = await db.shopSettings.findUnique({
    where: { shop },
    select: {
      onboardingSyncedOrders: true,
      onboardingCreatedTiers: true,
      onboardingSyncedCustomers: true,
      onboardingConfiguredSettings: true,
      onboardingCompleted: true,
      onboardingDismissed: true,
      storeCurrency: true,
      storeName: true,
    },
  });

  // Redirect to dashboard if onboarding is completed or dismissed
  if (shopSettings?.onboardingCompleted || shopSettings?.onboardingDismissed) {
    return redirect("/app");
  }

  // Get counts for display
  const [orderCount, tierCount, customerCount] = await Promise.all([
    db.order.count({ where: { shop } }),
    db.tier.count({ where: { shop } }),
    db.customer.count({ where: { shop } }),
  ]);

  // Determine current step based on completion status
  let currentStep = 1;
  if (shopSettings?.onboardingSyncedOrders) currentStep = 2;
  if (shopSettings?.onboardingCreatedTiers) currentStep = 3;
  if (shopSettings?.onboardingSyncedCustomers) currentStep = 4;

  // Check URL parameter for step override
  const url = new URL(request.url);
  const stepParam = url.searchParams.get("step");
  if (stepParam) {
    const step = parseInt(stepParam, 10);
    if (step >= 1 && step <= 4) {
      currentStep = step;
    }
  }

  return json<LoaderData>({
    shop,
    onboarding: {
      syncedOrders: shopSettings?.onboardingSyncedOrders || false,
      createdTiers: shopSettings?.onboardingCreatedTiers || false,
      syncedCustomers: shopSettings?.onboardingSyncedCustomers || false,
      configuredSettings: shopSettings?.onboardingConfiguredSettings || false,
      completed: shopSettings?.onboardingCompleted || false,
    },
    counts: {
      orders: orderCount,
      tiers: tierCount,
      customers: customerCount,
    },
    settings: {
      storeCurrency: shopSettings?.storeCurrency || null,
      storeName: shopSettings?.storeName || null,
    },
    currentStep,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("action");

  try {
    switch (actionType) {
      case "save-settings": {
        const currency = formData.get("currency") as string;
        const storeName = formData.get("storeName") as string;

        await db.shopSettings.update({
          where: { shop },
          data: {
            storeCurrency: currency,
            storeName: storeName,
            onboardingConfiguredSettings: true,
            onboardingCompleted: true, // Mark as completed when settings saved
          },
        });

        return redirect("/app?onboarding=completed");
      }

      case "skip-onboarding": {
        await db.shopSettings.update({
          where: { shop },
          data: { onboardingDismissed: true },
        });

        return redirect("/app");
      }

      case "create-default-tiers": {
        // Check if tiers already exist
        const existingTiers = await db.tier.count({ where: { shop } });
        if (existingTiers > 0) {
          return json({ success: true, message: "Tiers already exist" });
        }

        // Create default tiers
        const defaultTiers = [
          {
            name: "Bronze",
            minSpend: 0,
            cashbackPercent: 2,
            color: "#CD7F32",
          },
          {
            name: "Silver",
            minSpend: 500,
            cashbackPercent: 5,
            color: "#C0C0C0",
          },
          {
            name: "Gold",
            minSpend: 1000,
            cashbackPercent: 10,
            color: "#FFD700",
          },
        ];

        await Promise.all(
          defaultTiers.map((tier) =>
            db.tier.create({
              data: {
                shop,
                name: tier.name,
                minSpend: tier.minSpend,
                cashbackPercent: tier.cashbackPercent,
                color: tier.color,
                active: true,
              },
            })
          )
        );

        // Mark tiers as created
        const { updateOnboardingProgress } = await import("~/utils/onboarding");
        await updateOnboardingProgress(shop, { createdTiers: true });

        return json({ success: true, message: "Default tiers created" });
      }

      default:
        return json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error(`[Onboarding] Error processing action ${actionType}:`, error);
    return json({ success: false, error: "Action failed" }, { status: 500 });
  }
};

export default function OnboardingPage() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [currency, setCurrency] = useState(data.settings.storeCurrency || "USD");
  const [storeName, setStoreName] = useState(data.settings.storeName || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalSteps = 4;
  const progress = (data.currentStep / totalSteps) * 100;

  const handleNextStep = () => {
    if (data.currentStep < totalSteps) {
      navigate(`/app/onboarding?step=${data.currentStep + 1}`);
    }
  };

  const handlePreviousStep = () => {
    if (data.currentStep > 1) {
      navigate(`/app/onboarding?step=${data.currentStep - 1}`);
    }
  };

  const handleSkip = () => {
    submit({ action: "skip-onboarding" }, { method: "post" });
  };

  const handleCreateDefaultTiers = () => {
    setIsSubmitting(true);
    submit({ action: "create-default-tiers" }, { method: "post" });
  };

  const handleSaveSettings = () => {
    if (!storeName.trim()) {
      alert("Please enter your store name");
      return;
    }
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("action", "save-settings");
    formData.append("currency", currency);
    formData.append("storeName", storeName);
    submit(formData, { method: "post" });
  };

  const currencyOptions = [
    { label: "USD - US Dollar", value: "USD" },
    { label: "EUR - Euro", value: "EUR" },
    { label: "GBP - British Pound", value: "GBP" },
    { label: "CAD - Canadian Dollar", value: "CAD" },
    { label: "AUD - Australian Dollar", value: "AUD" },
    { label: "JPY - Japanese Yen", value: "JPY" },
    { label: "CNY - Chinese Yuan", value: "CNY" },
    { label: "INR - Indian Rupee", value: "INR" },
  ];

  return (
    <Page
      title="Welcome to RewardsPro"
      subtitle="Let's get your loyalty program set up in 4 simple steps"
      secondaryActions={[
        {
          content: "Skip Setup",
          onAction: handleSkip,
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              {/* Progress Header */}
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Step {data.currentStep} of {totalSteps}
                  </Text>
                  <Badge tone="info">
                    {Math.round(progress)}% Complete
                  </Badge>
                </InlineStack>
                <ProgressBar progress={progress} tone="primary" />
              </BlockStack>

              <Divider />

              {/* Step 1: Sync Orders */}
              {data.currentStep === 1 && (
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="start">
                    <BlockStack gap="200">
                      <InlineStack gap="200" blockAlign="center">
                        <Icon
                          source={data.onboarding.syncedOrders ? CheckCircleIcon : AlertCircleIcon}
                          tone={data.onboarding.syncedOrders ? "success" : "base"}
                        />
                        <Text as="h3" variant="headingLg">
                          Sync Your Orders
                        </Text>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Import your existing Shopify orders to track customer purchases and reward
                        past transactions. This helps you understand customer spending patterns and
                        automatically calculate tier eligibility.
                      </Text>
                    </BlockStack>
                  </InlineStack>

                  {data.onboarding.syncedOrders ? (
                    <Banner tone="success">
                      <BlockStack gap="200">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          ✓ Orders Synced Successfully
                        </Text>
                        <Text as="p" variant="bodySm">
                          {data.counts.orders} orders imported from your store.
                        </Text>
                      </BlockStack>
                    </Banner>
                  ) : (
                    <Banner tone="info">
                      <BlockStack gap="300">
                        <Text as="p" variant="bodyMd">
                          Click the button below to sync your orders, or visit the Orders page to
                          start the sync process.
                        </Text>
                        <InlineStack gap="200">
                          <Button
                            icon={RefreshIcon}
                            onClick={() => navigate("/app/orders")}
                          >
                            Go to Orders Page
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    </Banner>
                  )}

                  <Divider />

                  {/* Navigation */}
                  <InlineStack align="end" gap="200">
                    <Button
                      onClick={handleNextStep}
                      variant="primary"
                      icon={ArrowRightIcon}
                    >
                      Next Step
                    </Button>
                  </InlineStack>
                </BlockStack>
              )}

              {/* Step 2: Create Tiers */}
              {data.currentStep === 2 && (
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="start">
                    <BlockStack gap="200">
                      <InlineStack gap="200" blockAlign="center">
                        <Icon
                          source={data.onboarding.createdTiers ? CheckCircleIcon : AlertCircleIcon}
                          tone={data.onboarding.createdTiers ? "success" : "base"}
                        />
                        <Text as="h3" variant="headingLg">
                          Create Loyalty Tiers
                        </Text>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Set up loyalty tiers with different cashback percentages to reward your
                        best customers. Customers automatically move up tiers based on their total
                        spending.
                      </Text>
                    </BlockStack>
                  </InlineStack>

                  {data.onboarding.createdTiers ? (
                    <Banner tone="success">
                      <BlockStack gap="200">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          ✓ Tiers Created Successfully
                        </Text>
                        <Text as="p" variant="bodySm">
                          {data.counts.tiers} loyalty tiers are active.
                        </Text>
                      </BlockStack>
                    </Banner>
                  ) : (
                    <Banner tone="info">
                      <BlockStack gap="300">
                        <Text as="p" variant="bodyMd">
                          We can create default tiers for you (Bronze 2%, Silver 5%, Gold 10%), or
                          you can create custom tiers on the Tiers page.
                        </Text>
                        <InlineStack gap="200">
                          <Button
                            variant="primary"
                            onClick={handleCreateDefaultTiers}
                            loading={isSubmitting}
                          >
                            Create Default Tiers
                          </Button>
                          <Button onClick={() => navigate("/app/tiers")}>
                            Create Custom Tiers
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    </Banner>
                  )}

                  {/* Example Tiers Display */}
                  {!data.onboarding.createdTiers && (
                    <Card>
                      <BlockStack gap="300">
                        <Text as="p" variant="headingSm">
                          Default Tier Structure
                        </Text>
                        <BlockStack gap="200">
                          <InlineStack align="space-between" blockAlign="center">
                            <InlineStack gap="200" blockAlign="center">
                              <Box
                                background="bg-fill-warning"
                                borderRadius="100"
                                padding="100"
                                minWidth="8px"
                                minHeight="8px"
                              />
                              <Text as="span" variant="bodyMd">
                                Bronze
                              </Text>
                            </InlineStack>
                            <Text as="span" variant="bodyMd" tone="subdued">
                              $0+ spent • 2% cashback
                            </Text>
                          </InlineStack>
                          <InlineStack align="space-between" blockAlign="center">
                            <InlineStack gap="200" blockAlign="center">
                              <Box
                                background="bg-fill"
                                borderRadius="100"
                                padding="100"
                                minWidth="8px"
                                minHeight="8px"
                              />
                              <Text as="span" variant="bodyMd">
                                Silver
                              </Text>
                            </InlineStack>
                            <Text as="span" variant="bodyMd" tone="subdued">
                              $500+ spent • 5% cashback
                            </Text>
                          </InlineStack>
                          <InlineStack align="space-between" blockAlign="center">
                            <InlineStack gap="200" blockAlign="center">
                              <Box
                                background="bg-fill-success"
                                borderRadius="100"
                                padding="100"
                                minWidth="8px"
                                minHeight="8px"
                              />
                              <Text as="span" variant="bodyMd">
                                Gold
                              </Text>
                            </InlineStack>
                            <Text as="span" variant="bodyMd" tone="subdued">
                              $1000+ spent • 10% cashback
                            </Text>
                          </InlineStack>
                        </BlockStack>
                      </BlockStack>
                    </Card>
                  )}

                  <Divider />

                  {/* Navigation */}
                  <InlineStack align="space-between">
                    <Button onClick={handlePreviousStep} icon={ArrowLeftIcon}>
                      Previous
                    </Button>
                    <Button
                      onClick={handleNextStep}
                      variant="primary"
                      icon={ArrowRightIcon}
                    >
                      Next Step
                    </Button>
                  </InlineStack>
                </BlockStack>
              )}

              {/* Step 3: Sync Customers */}
              {data.currentStep === 3 && (
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="start">
                    <BlockStack gap="200">
                      <InlineStack gap="200" blockAlign="center">
                        <Icon
                          source={data.onboarding.syncedCustomers ? CheckCircleIcon : AlertCircleIcon}
                          tone={data.onboarding.syncedCustomers ? "success" : "base"}
                        />
                        <Text as="h3" variant="headingLg">
                          Sync Your Customers
                        </Text>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Import your Shopify customers and automatically assign them to loyalty
                        tiers based on their spending history. This ensures everyone starts at the
                        right tier level.
                      </Text>
                    </BlockStack>
                  </InlineStack>

                  {data.onboarding.syncedCustomers ? (
                    <Banner tone="success">
                      <BlockStack gap="200">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          ✓ Customers Synced Successfully
                        </Text>
                        <Text as="p" variant="bodySm">
                          {data.counts.customers} customers imported and assigned to tiers.
                        </Text>
                      </BlockStack>
                    </Banner>
                  ) : (
                    <Banner tone="info">
                      <BlockStack gap="300">
                        <Text as="p" variant="bodyMd">
                          Visit the Customers page to sync your customer list and assign them to
                          tiers automatically.
                        </Text>
                        <InlineStack gap="200">
                          <Button
                            icon={RefreshIcon}
                            onClick={() => navigate("/app/customers")}
                          >
                            Go to Customers Page
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    </Banner>
                  )}

                  <Divider />

                  {/* Navigation */}
                  <InlineStack align="space-between">
                    <Button onClick={handlePreviousStep} icon={ArrowLeftIcon}>
                      Previous
                    </Button>
                    <Button
                      onClick={handleNextStep}
                      variant="primary"
                      icon={ArrowRightIcon}
                    >
                      Next Step
                    </Button>
                  </InlineStack>
                </BlockStack>
              )}

              {/* Step 4: Configure Settings */}
              {data.currentStep === 4 && (
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="start">
                    <BlockStack gap="200">
                      <InlineStack gap="200" blockAlign="center">
                        <Icon
                          source={data.onboarding.configuredSettings ? CheckCircleIcon : AlertCircleIcon}
                          tone={data.onboarding.configuredSettings ? "success" : "base"}
                        />
                        <Text as="h3" variant="headingLg">
                          Configure Your Settings
                        </Text>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Set your store's currency and name to complete your rewards program setup.
                        These settings ensure cashback amounts are displayed correctly.
                      </Text>
                    </BlockStack>
                  </InlineStack>

                  <Card>
                    <BlockStack gap="400">
                      <TextField
                        label="Store Name"
                        value={storeName}
                        onChange={setStoreName}
                        placeholder="Enter your store name"
                        autoComplete="off"
                        helpText="This will be displayed in customer communications"
                      />

                      <Select
                        label="Store Currency"
                        options={currencyOptions}
                        value={currency}
                        onChange={setCurrency}
                        helpText="Select the primary currency for your store"
                      />
                    </BlockStack>
                  </Card>

                  <Banner tone="success">
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        🎉 Almost Done!
                      </Text>
                      <Text as="p" variant="bodySm">
                        Click "Complete Setup" to finish onboarding and start rewarding your
                        customers.
                      </Text>
                    </BlockStack>
                  </Banner>

                  <Divider />

                  {/* Navigation */}
                  <InlineStack align="space-between">
                    <Button onClick={handlePreviousStep} icon={ArrowLeftIcon}>
                      Previous
                    </Button>
                    <Button
                      onClick={handleSaveSettings}
                      variant="primary"
                      loading={isSubmitting}
                    >
                      Complete Setup
                    </Button>
                  </InlineStack>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
