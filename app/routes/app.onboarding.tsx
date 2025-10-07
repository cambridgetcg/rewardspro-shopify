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
  // New order: 1. Customers, 2. Tiers, 3. Orders, 4. Settings
  let currentStep = 1;
  if (shopSettings?.onboardingSyncedCustomers) currentStep = 2;
  if (shopSettings?.onboardingCreatedTiers) currentStep = 3;
  if (shopSettings?.onboardingSyncedOrders) currentStep = 4;

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

      case "create-tier": {
        const name = formData.get("tierName") as string;
        const minSpend = parseFloat(formData.get("tierMinSpend") as string);
        const cashbackPercent = parseFloat(formData.get("tierCashback") as string);

        // Validate inputs
        if (!name || name.trim() === "") {
          return json({ success: false, error: "Please enter a tier name" }, { status: 400 });
        }
        if (isNaN(minSpend) || minSpend < 0) {
          return json({ success: false, error: "Please enter a valid minimum spend amount" }, { status: 400 });
        }
        if (isNaN(cashbackPercent) || cashbackPercent < 0 || cashbackPercent > 100) {
          return json({ success: false, error: "Please enter a valid cashback percentage (0-100)" }, { status: 400 });
        }

        // Create the tier
        await db.tier.create({
          data: {
            shop,
            name: name.trim(),
            minSpend,
            cashbackPercent,
            evaluationPeriod: "LIFETIME",
            active: true,
          },
        });

        // Mark tiers as created
        const { updateOnboardingProgress } = await import("~/utils/onboarding");
        await updateOnboardingProgress(shop, { createdTiers: true });

        return json({ success: true, message: "Tier created successfully" });
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

  // Tier form state
  const [tierName, setTierName] = useState("");
  const [tierMinSpend, setTierMinSpend] = useState("0");
  const [tierCashback, setTierCashback] = useState("5");

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

  const handleCreateTier = () => {
    if (!tierName.trim()) {
      alert("Please enter a tier name");
      return;
    }
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("action", "create-tier");
    formData.append("tierName", tierName);
    formData.append("tierMinSpend", tierMinSpend);
    formData.append("tierCashback", tierCashback);
    submit(formData, { method: "post" });
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

              {/* Step 1: Sync Customers */}
              {data.currentStep === 1 && (
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
                        Import your Shopify customers first. This is important because orders need
                        customer records to exist. Customers will be automatically assigned to tiers
                        based on their spending history in the next step.
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
                          {data.counts.customers} customers imported from your store.
                        </Text>
                      </BlockStack>
                    </Banner>
                  ) : (
                    <Banner tone="info">
                      <BlockStack gap="300">
                        <Text as="p" variant="bodyMd">
                          Visit the Customers page to sync your customer list. This ensures that when
                          you sync orders later, they'll be properly linked to customers.
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
                    <>
                      <Banner tone="info">
                        <Text as="p" variant="bodyMd">
                          Create your first loyalty tier below. You can add more tiers later from
                          the Tier Products page.
                        </Text>
                      </Banner>

                      <Card>
                        <BlockStack gap="400">
                          <Text as="p" variant="headingSm">
                            Create Your First Tier
                          </Text>

                          <TextField
                            label="Tier Name"
                            value={tierName}
                            onChange={setTierName}
                            placeholder="e.g., Bronze, VIP, Starter"
                            autoComplete="off"
                            helpText="Give your tier a memorable name"
                          />

                          <TextField
                            label="Minimum Spend"
                            type="number"
                            value={tierMinSpend}
                            onChange={setTierMinSpend}
                            prefix={data.settings.storeCurrency || "USD"}
                            helpText="Minimum amount customers must spend to reach this tier (use 0 for entry-level tier)"
                            autoComplete="off"
                          />

                          <TextField
                            label="Cashback Percentage"
                            type="number"
                            value={tierCashback}
                            onChange={setTierCashback}
                            suffix="%"
                            helpText="Percentage of order value customers earn as store credit"
                            autoComplete="off"
                          />

                          <InlineStack align="start">
                            <Button
                              variant="primary"
                              onClick={handleCreateTier}
                              loading={isSubmitting}
                            >
                              Create Tier
                            </Button>
                          </InlineStack>
                        </BlockStack>
                      </Card>
                    </>
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

              {/* Step 3: Sync Orders */}
              {data.currentStep === 3 && (
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
                        Now that your customers are imported, sync your Shopify orders. Orders will be
                        automatically linked to existing customers, and cashback will be calculated based
                        on tier levels. This completes your loyalty program data.
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
                          {data.counts.orders} orders imported and linked to customers.
                        </Text>
                      </BlockStack>
                    </Banner>
                  ) : (
                    <Banner tone="info">
                      <BlockStack gap="300">
                        <Text as="p" variant="bodyMd">
                          Visit the Orders page to sync your order history. Orders will be automatically
                          linked to the customers you imported in step 1.
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
