import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { json as remixJson } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit, useActionData, useNavigation } from "@remix-run/react";
import { useState, useEffect } from "react";
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
  Divider,
  Modal,
  List,
} from "@shopify/polaris";
import {
  CheckCircleIcon,
  AlertCircleIcon,
  StarFilledIcon,
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
  maxAllowedStep: number;
}

// Helper function to calculate max allowed step based on completion
function getMaxAllowedStep(onboarding: LoaderData["onboarding"]): number {
  // Step 0 (welcome) is always accessible
  if (!onboarding.syncedCustomers) return 1;
  if (!onboarding.createdTiers) return 2;
  if (!onboarding.syncedOrders) return 3;
  return 4;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  console.log("=".repeat(80));
  console.log("[Onboarding Loader] ⚡ REQUEST RECEIVED");
  console.log("[Onboarding Loader] URL:", url.pathname + url.search);
  console.log("[Onboarding Loader] Method:", request.method);
  console.log("[Onboarding Loader] Headers:", {
    referer: request.headers.get("referer"),
    host: request.headers.get("host"),
    userAgent: request.headers.get("user-agent"),
  });
  console.log("=".repeat(80));

  try {
    console.log("[Onboarding Loader] 🔐 Starting authentication...");
    const { session } = await authenticate.admin(request);
    const shop = session.shop;
    console.log("[Onboarding Loader] ✅ Authentication successful");
    console.log("[Onboarding Loader] Shop:", shop);

    // Fetch onboarding status
    console.log("[Onboarding Loader] 📊 Fetching shop settings...");
    const shopSettings = await db.shopSettings.findUnique({
      where: { shop },
    });
    console.log("[Onboarding Loader] Shop settings:", {
      found: !!shopSettings,
      completed: shopSettings?.onboardingCompleted,
      dismissed: shopSettings?.onboardingDismissed,
      syncedCustomers: shopSettings?.onboardingSyncedCustomers,
      createdTiers: shopSettings?.onboardingCreatedTiers,
      syncedOrders: shopSettings?.onboardingSyncedOrders,
      configuredSettings: shopSettings?.onboardingConfiguredSettings,
    });

    // Check if user wants to force view onboarding (for testing or re-onboarding)
    const forceView = url.searchParams.get("force") === "true";

    // Redirect to dashboard if onboarding is completed or dismissed (unless forced)
    if ((shopSettings?.onboardingCompleted || shopSettings?.onboardingDismissed) && !forceView) {
      console.log("[Onboarding Loader] 🔄 Redirecting to /app (completed or dismissed)");
      return redirect("/app");
    }

    if (forceView) {
      console.log("[Onboarding Loader] ⚠️  Force view enabled, bypassing completion check");
    }

    // Get counts for display
    console.log("[Onboarding Loader] 📈 Fetching counts...");
    const [orderCount, tierCount, customerCount] = await Promise.all([
      db.order.count({ where: { shop } }),
      db.tier.count({ where: { shop } }),
      db.customer.count({ where: { shop } }),
    ]);
    console.log("[Onboarding Loader] Counts:", { orders: orderCount, tiers: tierCount, customers: customerCount });

    const onboarding = {
      syncedOrders: shopSettings?.onboardingSyncedOrders || false,
      createdTiers: shopSettings?.onboardingCreatedTiers || false,
      syncedCustomers: shopSettings?.onboardingSyncedCustomers || false,
      configuredSettings: shopSettings?.onboardingConfiguredSettings || false,
      completed: shopSettings?.onboardingCompleted || false,
    };

    // Calculate max allowed step based on completion
    const maxAllowedStep = getMaxAllowedStep(onboarding);
    console.log("[Onboarding Loader] 🎯 Max allowed step:", maxAllowedStep);

    // Determine current step from URL or from completion status
    const stepParam = url.searchParams.get("step");
    let currentStep = 0; // Default to welcome screen
    console.log("[Onboarding Loader] Step parameter from URL:", stepParam);

    if (stepParam) {
      const requestedStep = parseInt(stepParam, 10);
      console.log("[Onboarding Loader] Requested step (parsed):", requestedStep);

      // Enforce step gating - can't skip ahead
      if (requestedStep >= 0 && requestedStep <= 4) {
        currentStep = Math.min(requestedStep, maxAllowedStep);
        console.log("[Onboarding Loader] Current step set to:", currentStep);

        // If user tried to skip ahead, redirect to max allowed step
        if (requestedStep > maxAllowedStep) {
          console.log("[Onboarding Loader] ⚠️  User tried to skip ahead!");
          console.log("[Onboarding Loader] 🔄 Redirecting to step:", maxAllowedStep);
          return redirect(`/app/onboarding?step=${maxAllowedStep}`);
        }
      } else {
        console.log("[Onboarding Loader] ⚠️  Invalid step parameter, defaulting to 0");
      }
    } else {
      console.log("[Onboarding Loader] No step parameter, showing welcome screen (step 0)");
    }

    console.log("[Onboarding Loader] 📍 Final current step:", currentStep);

    const responseData = {
      shop,
      onboarding,
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
      maxAllowedStep,
    };

    console.log("[Onboarding Loader] 📦 Response data prepared:");
    console.log(JSON.stringify(responseData, null, 2));
    console.log("[Onboarding Loader] ✅ Successfully returning data");
    console.log("=".repeat(80));
    return remixJson<LoaderData>(responseData);
  } catch (error) {
    console.error("=".repeat(80));
    console.error("[Onboarding Loader] ❌ ERROR OCCURRED");
    console.error("[Onboarding Loader] Error:", error);
    console.error("[Onboarding Loader] Error name:", error instanceof Error ? error.name : 'Unknown');
    console.error("[Onboarding Loader] Error message:", error instanceof Error ? error.message : 'No message');
    console.error("[Onboarding Loader] Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    console.error("=".repeat(80));
    throw error;
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("[Onboarding Action] Request received");

  try {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    const formData = await request.formData();
    const actionType = formData.get("action");
    console.log("[Onboarding Action] Action type:", actionType);

    switch (actionType) {
      case "start-onboarding": {
        console.log("[Onboarding Action] Starting onboarding");
        // Just navigate to step 1
        return remixJson({ success: true, nextStep: 1 });
      }

      case "dismiss-onboarding": {
        console.log("[Onboarding Action] Dismissing onboarding");
        await db.shopSettings.update({
          where: { shop },
          data: { onboardingDismissed: true },
        });
        return redirect("/app");
      }

      case "reset-onboarding": {
        console.log("[Onboarding Action] Resetting onboarding progress");
        await db.shopSettings.update({
          where: { shop },
          data: {
            onboardingCompleted: false,
            onboardingDismissed: false,
            onboardingSyncedCustomers: false,
            onboardingCreatedTiers: false,
            onboardingSyncedOrders: false,
            onboardingConfiguredSettings: false,
          },
        });
        console.log("[Onboarding Action] Onboarding reset complete");
        return remixJson({ success: true, message: "Onboarding has been reset" });
      }

      case "create-tier": {
        const name = formData.get("tierName") as string;
        const minSpend = Number(formData.get("tierMinSpend"));
        const cashbackPercent = Number(formData.get("tierCashback"));
        const evaluationPeriod = (formData.get("tierEvaluationPeriod") as string) || "ANNUAL";

        console.log("[Onboarding Action] Creating tier:", { name, minSpend, cashbackPercent, evaluationPeriod });

        // Validate inputs
        if (!name || name.trim().length === 0) {
          return remixJson({ success: false, error: "Please enter a tier name" }, { status: 400 });
        }
        if (isNaN(minSpend) || minSpend < 0) {
          return remixJson({ success: false, error: "Please enter a valid minimum spend amount" }, { status: 400 });
        }
        if (isNaN(cashbackPercent) || cashbackPercent < 0 || cashbackPercent > 100) {
          return remixJson({ success: false, error: "Please enter a valid cashback percentage (0-100)" }, { status: 400 });
        }

        // Check for duplicate tier name
        const existing = await db.tier.findFirst({
          where: { shop, name: name.trim() },
        });

        if (existing) {
          return remixJson({ success: false, error: `A tier named "${name}" already exists` }, { status: 400 });
        }

        // Create tier ID
        const storeName = shop.split('.')[0];
        const tierId = `${storeName}-${name.trim().toLowerCase().replace(/\s+/g, '-')}`;

        // Create the tier
        await db.tier.create({
          data: {
            id: tierId,
            shop,
            name: name.trim(),
            minSpend,
            cashbackPercent,
            evaluationPeriod: evaluationPeriod as "ANNUAL" | "LIFETIME",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Mark tiers as created
        await db.shopSettings.update({
          where: { shop },
          data: { onboardingCreatedTiers: true },
        });

        console.log("[Onboarding Action] Tier created successfully");
        return remixJson({ success: true, message: "Tier created successfully!" });
      }

      case "save-settings": {
        const currency = formData.get("currency") as string;
        const storeName = formData.get("storeName") as string;

        console.log("[Onboarding Action] Saving settings:", { currency, storeName });

        if (!storeName || !storeName.trim()) {
          return remixJson({ success: false, error: "Please enter your store name" }, { status: 400 });
        }

        await db.shopSettings.update({
          where: { shop },
          data: {
            storeCurrency: currency,
            storeName: storeName,
            onboardingConfiguredSettings: true,
            onboardingCompleted: true,
          },
        });

        console.log("[Onboarding Action] Settings saved, onboarding complete");
        return remixJson({ success: true, completed: true });
      }

      default:
        console.log("[Onboarding Action] Invalid action:", actionType);
        return remixJson({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[Onboarding Action] Error:", error);
    return remixJson({ success: false, error: "Action failed" }, { status: 500 });
  }
};

export default function OnboardingPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const submit = useSubmit();

  // State
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tier form state
  const [tierName, setTierName] = useState("");
  const [tierMinSpend, setTierMinSpend] = useState("0");
  const [tierCashback, setTierCashback] = useState("5");
  const [tierEvaluationPeriod, setTierEvaluationPeriod] = useState<"ANNUAL" | "LIFETIME">("ANNUAL");

  // Settings form state
  const [storeName, setStoreName] = useState(data.settings.storeName || "");
  const [currency, setCurrency] = useState(data.settings.storeCurrency || "USD");

  const isSubmitting = navigation.state === "submitting";

  // Handle action responses
  useEffect(() => {
    if (actionData) {
      console.log("[Onboarding Component] Action data received:", actionData);

      if ("success" in actionData && actionData.success) {
        if ("completed" in actionData && actionData.completed) {
          // Show completion modal
          setShowCompletionModal(true);
        } else if ("message" in actionData) {
          setSuccessMessage(actionData.message as string);
          setErrorMessage(null);
          // Reset tier form
          setTierName("");
          setTierMinSpend("0");
          setTierCashback("5");
          setTierEvaluationPeriod("ANNUAL");
          // Navigate to next step after brief delay to show success message
          setTimeout(() => {
            navigate(`/app/onboarding?step=3`);
          }, 1000);
        }
      } else if ("error" in actionData) {
        setErrorMessage(actionData.error as string);
        setSuccessMessage(null);
      }
    }
  }, [actionData, navigate]);

  const handleStartOnboarding = () => {
    console.log("[Onboarding Component] Starting onboarding");
    navigate("/app/onboarding?step=1");
  };

  const handleDismiss = () => {
    console.log("[Onboarding Component] Dismissing onboarding");
    submit({ action: "dismiss-onboarding" }, { method: "post" });
  };

  const handleNextStep = () => {
    const nextStep = data.currentStep + 1;
    console.log("[Onboarding Component] Moving to next step:", nextStep);
    if (nextStep <= 4) {
      navigate(`/app/onboarding?step=${nextStep}`);
    }
  };

  const handlePreviousStep = () => {
    const prevStep = data.currentStep - 1;
    console.log("[Onboarding Component] Moving to previous step:", prevStep);
    if (prevStep >= 0) {
      navigate(`/app/onboarding?step=${prevStep}`);
    }
  };

  const handleCreateTier = () => {
    if (!tierName.trim()) {
      setErrorMessage("Please enter a tier name");
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.append("action", "create-tier");
    formData.append("tierName", tierName);
    formData.append("tierMinSpend", tierMinSpend);
    formData.append("tierCashback", tierCashback);
    formData.append("tierEvaluationPeriod", tierEvaluationPeriod);
    submit(formData, { method: "post" });
  };

  const handleSaveSettings = () => {
    if (!storeName.trim()) {
      setErrorMessage("Please enter your store name");
      return;
    }
    setErrorMessage(null);

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

  const totalSteps = 4;
  const progress = data.currentStep === 0 ? 0 : (data.currentStep / totalSteps) * 100;

  // Check if current step can proceed
  const canProceedFromStep = (step: number): boolean => {
    switch (step) {
      case 0: return true; // Welcome screen can always proceed
      case 1: return data.onboarding.syncedCustomers;
      case 2: return data.onboarding.createdTiers;
      case 3: return data.onboarding.syncedOrders;
      case 4: return data.onboarding.configuredSettings;
      default: return false;
    }
  };

  return (
    <Page
      title={data.currentStep === 0 ? "Welcome to RewardsPro!" : "Getting Started"}
      subtitle={data.currentStep === 0 ? "Set up your loyalty program in just a few minutes" : undefined}
      secondaryActions={data.currentStep > 0 ? [
        {
          content: "I'll Do This Later",
          onAction: handleDismiss,
        },
      ] : undefined}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              {/* Progress indicator (hide on welcome screen) */}
              {data.currentStep > 0 && (
                <>
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Step {data.currentStep} of {totalSteps}
                    </Text>
                    <Badge tone="info">
                      {`${Math.round(progress)}% Complete`}
                    </Badge>
                  </InlineStack>
                  <ProgressBar
                    progress={progress}
                    tone="primary"
                    size="small"
                  />
                  <Divider />
                </>
              )}

              {/* Welcome Screen (Step 0) */}
              {data.currentStep === 0 && (
                <BlockStack gap="500">
                  <Box paddingBlockStart="400">
                    <BlockStack gap="300">
                      <InlineStack gap="200" blockAlign="center">
                        <Icon source={StarFilledIcon} tone="magic" />
                        <Text as="h2" variant="headingLg">
                          Let's set up your loyalty program
                        </Text>
                      </InlineStack>

                      <Text as="p" variant="bodyLg" tone="subdued">
                        In just a few minutes, you'll have a fully functional rewards program
                        that automatically tracks customer spending and issues cashback rewards.
                      </Text>
                    </BlockStack>
                  </Box>

                  <Card>
                    <BlockStack gap="400">
                      <Text as="h3" variant="headingSm">
                        What you'll set up:
                      </Text>

                      <BlockStack gap="300">
                        <InlineStack gap="300" blockAlign="start">
                          <Icon source={CheckCircleIcon} tone="subdued" />
                          <BlockStack gap="100">
                            <Text as="p" variant="bodyMd" fontWeight="semibold">
                              Import your customers
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              We'll import your Shopify customers to track their rewards
                            </Text>
                          </BlockStack>
                        </InlineStack>

                        <InlineStack gap="300" blockAlign="start">
                          <Icon source={CheckCircleIcon} tone="subdued" />
                          <BlockStack gap="100">
                            <Text as="p" variant="bodyMd" fontWeight="semibold">
                              Create reward tiers
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              Set up tiers with different cashback percentages
                            </Text>
                          </BlockStack>
                        </InlineStack>

                        <InlineStack gap="300" blockAlign="start">
                          <Icon source={CheckCircleIcon} tone="subdued" />
                          <BlockStack gap="100">
                            <Text as="p" variant="bodyMd" fontWeight="semibold">
                              Sync order history
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              Import past orders to calculate existing rewards
                            </Text>
                          </BlockStack>
                        </InlineStack>

                        <InlineStack gap="300" blockAlign="start">
                          <Icon source={CheckCircleIcon} tone="subdued" />
                          <BlockStack gap="100">
                            <Text as="p" variant="bodyMd" fontWeight="semibold">
                              Configure store settings
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              Set your currency and store details
                            </Text>
                          </BlockStack>
                        </InlineStack>
                      </BlockStack>
                    </BlockStack>
                  </Card>

                  <Banner tone="info">
                    <Text as="p" variant="bodySm">
                      <strong>Estimated time:</strong> 5 minutes
                    </Text>
                  </Banner>

                  <InlineStack align="end" gap="200">
                    <Button onClick={handleDismiss}>
                      I'll Do This Later
                    </Button>
                    <Button variant="primary" onClick={handleStartOnboarding}>
                      Get Started
                    </Button>
                  </InlineStack>
                </BlockStack>
              )}

              {/* Step 1: Import Customers */}
              {data.currentStep === 1 && (
                <BlockStack gap="400">
                  <InlineStack gap="300" blockAlign="start">
                    <Icon
                      source={data.onboarding.syncedCustomers ? CheckCircleIcon : AlertCircleIcon}
                      tone={data.onboarding.syncedCustomers ? "success" : "base"}
                    />
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingLg">
                        Import Your Customers
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Customer records must exist before we can link orders and calculate rewards.
                        We'll import all your Shopify customers now.
                      </Text>
                    </BlockStack>
                  </InlineStack>

                  {data.onboarding.syncedCustomers ? (
                    <Banner tone="success">
                      <BlockStack gap="200">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          ✓ Successfully imported {data.counts.customers} customers
                        </Text>
                        <Text as="p" variant="bodySm">
                          Your customer data is ready. You can now create reward tiers.
                        </Text>
                      </BlockStack>
                    </Banner>
                  ) : (
                    <>
                      <Banner tone="info">
                        <BlockStack gap="300">
                          <Text as="p" variant="bodyMd">
                            To import customers, please visit the Customers page. You can return here
                            after the sync is complete to continue setting up your rewards program.
                          </Text>
                          <InlineStack gap="200">
                            <Button onClick={() => navigate("/app/customers")}>
                              Go to Customers Page
                            </Button>
                          </InlineStack>
                        </BlockStack>
                      </Banner>

                      <Banner tone="warning">
                        <Text as="p" variant="bodySm">
                          <strong>Note:</strong> You'll need to complete this step before you can proceed
                          to creating reward tiers.
                        </Text>
                      </Banner>
                    </>
                  )}

                  <Divider />

                  <InlineStack align="space-between">
                    <Button onClick={handlePreviousStep}>
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleNextStep}
                      disabled={!canProceedFromStep(1)}
                    >
                      {canProceedFromStep(1) ? "Continue" : "Complete This Step First"}
                    </Button>
                  </InlineStack>
                </BlockStack>
              )}

              {/* Step 2: Create Tiers */}
              {data.currentStep === 2 && (
                <BlockStack gap="400">
                  <InlineStack gap="300" blockAlign="start">
                    <Icon
                      source={data.onboarding.createdTiers ? CheckCircleIcon : AlertCircleIcon}
                      tone={data.onboarding.createdTiers ? "success" : "base"}
                    />
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingLg">
                        Create Your First Reward Tier
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Reward tiers give different cashback percentages based on customer spending.
                        Start with one tier and add more later from the Tier Products page.
                      </Text>
                    </BlockStack>
                  </InlineStack>

                  {data.onboarding.createdTiers ? (
                    <Banner tone="success">
                      <BlockStack gap="200">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          ✓ You've created {data.counts.tiers} reward tier{data.counts.tiers !== 1 ? 's' : ''}
                        </Text>
                        <Text as="p" variant="bodySm">
                          Great! Now let's import your orders to calculate rewards.
                        </Text>
                      </BlockStack>
                    </Banner>
                  ) : (
                    <>
                      {successMessage && (
                        <Banner tone="success" onDismiss={() => setSuccessMessage(null)}>
                          {successMessage}
                        </Banner>
                      )}

                      {errorMessage && (
                        <Banner tone="critical" onDismiss={() => setErrorMessage(null)}>
                          {errorMessage}
                        </Banner>
                      )}

                      <Banner tone="info">
                        <Text as="p" variant="bodySm">
                          <strong>Example:</strong> A "Bronze" tier with 5% cashback for customers who've spent $0 or more
                        </Text>
                      </Banner>

                      <Card>
                        <BlockStack gap="400">
                          <TextField
                            label="Tier Name"
                            value={tierName}
                            onChange={setTierName}
                            placeholder="e.g., Bronze, Silver, Gold"
                            helpText="Give your tier a memorable name"
                            autoComplete="off"
                          />

                          <TextField
                            label="Minimum Spend"
                            type="number"
                            value={tierMinSpend}
                            onChange={setTierMinSpend}
                            prefix={data.settings.storeCurrency || "USD"}
                            helpText="Use 0 for entry-level tier - customers need to spend this much to qualify"
                            autoComplete="off"
                          />

                          <TextField
                            label="Cashback Percentage"
                            type="number"
                            value={tierCashback}
                            onChange={setTierCashback}
                            suffix="%"
                            helpText="Percentage of each order value returned as store credit"
                            autoComplete="off"
                          />

                          <BlockStack gap="200">
                            <Text as="p" variant="bodyMd" fontWeight="semibold">
                              Evaluation Period
                            </Text>
                            <BlockStack gap="200">
                              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                                <input
                                  type="radio"
                                  value="LIFETIME"
                                  checked={tierEvaluationPeriod === "LIFETIME"}
                                  onChange={() => setTierEvaluationPeriod("LIFETIME")}
                                  style={{ cursor: "pointer" }}
                                />
                                <Text as="span" variant="bodyMd">
                                  Lifetime - Cumulative spending tracked forever
                                </Text>
                              </label>
                              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                                <input
                                  type="radio"
                                  value="ANNUAL"
                                  checked={tierEvaluationPeriod === "ANNUAL"}
                                  onChange={() => setTierEvaluationPeriod("ANNUAL")}
                                  style={{ cursor: "pointer" }}
                                />
                                <Text as="span" variant="bodyMd">
                                  Annual - Spending resets each January
                                </Text>
                              </label>
                            </BlockStack>
                            <Text as="p" variant="bodySm" tone="subdued">
                              Choose how customer spending is calculated for tier qualification
                            </Text>
                          </BlockStack>

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

                  <InlineStack align="space-between">
                    <Button onClick={handlePreviousStep}>
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleNextStep}
                      disabled={!canProceedFromStep(2)}
                    >
                      {canProceedFromStep(2) ? "Continue" : "Create a Tier First"}
                    </Button>
                  </InlineStack>
                </BlockStack>
              )}

              {/* Step 3: Sync Orders */}
              {data.currentStep === 3 && (
                <BlockStack gap="400">
                  <InlineStack gap="300" blockAlign="start">
                    <Icon
                      source={data.onboarding.syncedOrders ? CheckCircleIcon : AlertCircleIcon}
                      tone={data.onboarding.syncedOrders ? "success" : "base"}
                    />
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingLg">
                        Import Order History
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Now we'll import your orders and link them to customers. This calculates
                        their tier status and cashback balance based on past purchases.
                      </Text>
                    </BlockStack>
                  </InlineStack>

                  {data.onboarding.syncedOrders ? (
                    <Banner tone="success">
                      <BlockStack gap="200">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          ✓ Successfully imported {data.counts.orders} orders
                        </Text>
                        <Text as="p" variant="bodySm">
                          Orders are linked to customers and rewards have been calculated.
                          Let's finish by configuring your store settings.
                        </Text>
                      </BlockStack>
                    </Banner>
                  ) : (
                    <>
                      <Banner tone="info">
                        <BlockStack gap="300">
                          <Text as="p" variant="bodyMd">
                            To import orders, please visit the Orders page. Orders will be automatically
                            linked to the customers you imported in Step 1, and rewards will be calculated
                            based on your tier settings.
                          </Text>
                          <InlineStack gap="200">
                            <Button onClick={() => navigate("/app/orders")}>
                              Go to Orders Page
                            </Button>
                          </InlineStack>
                        </BlockStack>
                      </Banner>

                      <Banner tone="warning">
                        <Text as="p" variant="bodySm">
                          <strong>Note:</strong> Orders without matching customers will be skipped.
                          This is why we imported customers first.
                        </Text>
                      </Banner>
                    </>
                  )}

                  <Divider />

                  <InlineStack align="space-between">
                    <Button onClick={handlePreviousStep}>
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleNextStep}
                      disabled={!canProceedFromStep(3)}
                    >
                      {canProceedFromStep(3) ? "Continue" : "Complete This Step First"}
                    </Button>
                  </InlineStack>
                </BlockStack>
              )}

              {/* Step 4: Configure Settings */}
              {data.currentStep === 4 && (
                <BlockStack gap="400">
                  <InlineStack gap="300" blockAlign="start">
                    <Icon
                      source={data.onboarding.configuredSettings ? CheckCircleIcon : AlertCircleIcon}
                      tone={data.onboarding.configuredSettings ? "success" : "base"}
                    />
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingLg">
                        Configure Store Settings
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Almost done! Just set your store details so we can display rewards
                        correctly to your customers.
                      </Text>
                    </BlockStack>
                  </InlineStack>

                  {errorMessage && (
                    <Banner tone="critical" onDismiss={() => setErrorMessage(null)}>
                      {errorMessage}
                    </Banner>
                  )}

                  <Banner tone="success">
                    <Text as="p" variant="bodyMd">
                      🎉 <strong>You're almost there!</strong> Just one more step to complete your setup.
                    </Text>
                  </Banner>

                  <Card>
                    <BlockStack gap="400">
                      <TextField
                        label="Store Name"
                        value={storeName}
                        onChange={setStoreName}
                        placeholder="My Awesome Store"
                        helpText="Used in customer emails and notifications"
                        autoComplete="off"
                      />

                      <BlockStack gap="200">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          Store Currency
                        </Text>
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          style={{
                            padding: "8px 12px",
                            fontSize: "14px",
                            border: "1px solid #c9cccf",
                            borderRadius: "8px",
                            width: "100%",
                          }}
                        >
                          {currencyOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <Text as="p" variant="bodySm" tone="subdued">
                          All reward amounts will be displayed in this currency
                        </Text>
                      </BlockStack>

                      <InlineStack align="start">
                        <Button
                          variant="primary"
                          onClick={handleSaveSettings}
                          loading={isSubmitting}
                        >
                          Complete Setup
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </Card>

                  <Divider />

                  <InlineStack align="start">
                    <Button onClick={handlePreviousStep}>
                      Back
                    </Button>
                  </InlineStack>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Completion Modal */}
      <Modal
        open={showCompletionModal}
        onClose={() => {
          setShowCompletionModal(false);
          navigate("/app");
        }}
        title="🎉 You're All Set!"
        primaryAction={{
          content: "Go to Dashboard",
          onAction: () => navigate("/app"),
        }}
        secondaryActions={[
          {
            content: "View Analytics",
            onAction: () => navigate("/app/analytics"),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" variant="bodyMd">
              Your loyalty program is now active and ready to reward your customers!
            </Text>

            <BlockStack gap="300">
              <Text as="p" variant="headingSm">
                What you've accomplished:
              </Text>
              <List type="bullet">
                <List.Item>Imported {data.counts.customers} customers</List.Item>
                <List.Item>Created {data.counts.tiers} reward tier{data.counts.tiers !== 1 ? 's' : ''}</List.Item>
                <List.Item>Synced {data.counts.orders} orders</List.Item>
                <List.Item>Configured store settings</List.Item>
              </List>
            </BlockStack>

            <Banner tone="info">
              <BlockStack gap="200">
                <Text as="p" variant="headingSm">
                  Next steps:
                </Text>
                <List type="bullet">
                  <List.Item>View your analytics dashboard to see customer insights</List.Item>
                  <List.Item>Add more reward tiers from the Tier Products page</List.Item>
                  <List.Item>Customize customer notifications in Settings</List.Item>
                </List>
              </BlockStack>
            </Banner>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
