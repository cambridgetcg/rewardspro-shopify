/**
 * Billing Page - Clean Implementation
 * Handles plan selection and subscription management
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Banner,
  Badge,
  Box,
  Divider,
  Icon,
  ButtonGroup,
} from "@shopify/polaris";
import { CheckCircleIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { useState } from "react";
import {
  createSubscription,
  getSubscriptionStatus,
  getAllPlans,
  type BillingResult,
  type SubscriptionStatus,
} from "~/services/billing/plan-subscription.server";

// ============================================
// LOADER - Get Current Subscription Status
// ============================================

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  try {
    // Get current subscription status
    const subscriptionStatus = await getSubscriptionStatus(session.shop, billing);

    // Get all available plans
    const plans = getAllPlans();

    return json({
      subscriptionStatus,
      plans,
      shop: session.shop,
    });
  } catch (error) {
    console.error("[Billing Loader] Error:", error);
    throw new Response("Failed to load billing information", { status: 500 });
  }
};

// ============================================
// ACTION - Handle Subscription Requests
// ============================================

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const action = formData.get("action") as string;

  // Extract plan ID from action (e.g., "subscribe-pro" -> "pro")
  const planId = action?.replace("subscribe-", "");

  if (!planId) {
    return json<BillingResult>({
      success: false,
      error: "Invalid action"
    }, { status: 400 });
  }

  console.log(`[Billing Action] Shop ${session.shop} requesting ${planId} plan`);

  // Collect metadata for audit logging
  const metadata = {
    ipAddress: request.headers.get("x-forwarded-for") ||
               request.headers.get("x-real-ip") ||
               "unknown",
    userAgent: request.headers.get("user-agent") || "unknown",
  };

  try {
    // Create subscription
    const result = await createSubscription(
      session.shop,
      planId,
      billing,
      metadata
    );

    if (result.success && result.confirmationUrl) {
      // Redirect to Shopify confirmation page
      return json<BillingResult>(result, {
        status: 302,
        headers: {
          Location: result.confirmationUrl,
        },
      });
    }

    return json<BillingResult>(result);
  } catch (error) {
    // billing.request() throws a Response when it needs merchant approval
    if (error instanceof Response) {
      console.log(`[Billing Action] Redirecting to Shopify confirmation page`);
      return error; // Return the redirect response
    }

    // Handle other errors
    console.error(`[Billing Action] Unexpected error:`, error);
    return json<BillingResult>({
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred"
    }, { status: 500 });
  }
};

// ============================================
// COMPONENT - Billing Page UI
// ============================================

export default function BillingPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');

  const handleSubscribe = (planId: string) => {
    const formData = new FormData();
    formData.set("action", `subscribe-${planId}`);
    submit(formData, { method: "post" });
  };

  const currentPlan = data.subscriptionStatus.currentPlan;

  // Define plan UI configurations with both monthly and annual pricing
  const planCards = [
    {
      id: "pro",
      idAnnual: "pro-annual",
      name: "Pro",
      monthlyPrice: "$39",
      annualPrice: "$336",
      annualMonthlyEquivalent: "$28",
      annualSavings: "Save $132/year",
      description: "Everything you need to grow your loyalty program",
      features: [
        "500 orders/month",
        "Batch processing cashback",
        "Priority support",
        "Advanced analytics",
        "$10 per 100 extra orders"
      ],
      recommended: false,
    },
    {
      id: "max",
      idAnnual: "max-annual",
      name: "Max",
      monthlyPrice: "$149",
      annualPrice: "$1,296",
      annualMonthlyEquivalent: "$108",
      annualSavings: "Save $492/year",
      description: "For established businesses with advanced needs",
      features: [
        "2,000 orders/month",
        "Sell tier memberships",
        "White label email",
        "Advanced analytics",
        "Phone support",
        "$5 per 100 extra orders"
      ],
      recommended: true,
    },
    {
      id: "ultra",
      idAnnual: "ultra-annual",
      name: "Ultra",
      monthlyPrice: "$499",
      annualPrice: "$4,296",
      annualMonthlyEquivalent: "$358",
      annualSavings: "Save $1,692/year",
      description: "Unlimited everything for growing enterprises",
      features: [
        "Unlimited orders",
        "Unlimited emails",
        "Full white label solution",
        "Custom SMTP integration",
        "A/B testing",
        "Dedicated support",
        "No overage charges"
      ],
      recommended: false,
    },
  ];

  return (
    <Page
      title="Choose Your Plan"
      subtitle="Select the perfect plan for your business"
      backAction={{ url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="600">
            {/* Success/Error Banners */}
            {actionData?.success && (
              <Banner tone="success">
                <p>Successfully subscribed to {actionData.planName}!</p>
              </Banner>
            )}

            {actionData && !actionData.success && actionData.error && (
              <Banner tone="critical">
                <p>{actionData.error}</p>
              </Banner>
            )}

            {/* Current Plan Info */}
            {currentPlan && (
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingMd">
                      Current Plan
                    </Text>
                    <Badge tone="success">Active</Badge>
                  </InlineStack>
                  <Text as="p" variant="bodyLg">
                    {currentPlan}
                  </Text>
                </BlockStack>
              </Card>
            )}

            {/* Billing Interval Toggle */}
            <InlineStack align="end" blockAlign="center">
              <ButtonGroup variant="segmented">
                <Button
                  pressed={billingInterval === 'monthly'}
                  onClick={() => setBillingInterval('monthly')}
                  size="slim"
                >
                  Monthly
                </Button>
                <Button
                  pressed={billingInterval === 'annual'}
                  onClick={() => setBillingInterval('annual')}
                  size="slim"
                >
                  Annual
                </Button>
              </ButtonGroup>
            </InlineStack>

            {/* Plan Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
            }}>
              {planCards.map((plan) => {
                const planIdToUse = billingInterval === 'annual' ? plan.idAnnual : plan.id;
                const isCurrentPlan = currentPlan === `RewardsPro ${plan.name}` ||
                                     currentPlan === `RewardsPro ${plan.name} Annual`;

                return (
                  <Card key={plan.id}>
                    <Box padding="600">
                      <BlockStack gap="400">
                        {/* Plan Header */}
                        <InlineStack align="space-between">
                          <Text as="h3" variant="headingLg">
                            {plan.name}
                          </Text>
                          {plan.recommended && (
                            <Badge tone="info">Recommended</Badge>
                          )}
                          {isCurrentPlan && (
                            <Badge tone="success">Current</Badge>
                          )}
                        </InlineStack>

                        {/* Price */}
                        <BlockStack gap="200">
                          {billingInterval === 'monthly' ? (
                            <InlineStack align="start" gap="100">
                              <Text as="p" variant="heading2xl">
                                {plan.monthlyPrice}
                              </Text>
                              <Text as="span" variant="bodyLg" tone="subdued">
                                /month
                              </Text>
                            </InlineStack>
                          ) : (
                            <BlockStack gap="100">
                              <InlineStack align="start" gap="100">
                                <Text as="p" variant="heading2xl">
                                  {plan.annualMonthlyEquivalent}
                                </Text>
                                <Text as="span" variant="bodyLg" tone="subdued">
                                  /month
                                </Text>
                              </InlineStack>
                              <Text as="p" variant="bodyMd" tone="subdued">
                                {plan.annualPrice}/year • {plan.annualSavings}
                              </Text>
                            </BlockStack>
                          )}
                        </BlockStack>

                        {/* Description */}
                        <Text as="p" variant="bodyMd" tone="subdued">
                          {plan.description}
                        </Text>

                        {/* Action Button */}
                        <Button
                          fullWidth
                          size="large"
                          variant={isCurrentPlan ? "secondary" : (plan.recommended ? "primary" : "primary")}
                          disabled={isCurrentPlan || isSubmitting}
                          loading={isSubmitting}
                          onClick={() => handleSubscribe(planIdToUse)}
                        >
                          {isCurrentPlan ? "Current Plan" : `Upgrade to ${plan.name}`}
                        </Button>

                        <Divider />

                        {/* Features List */}
                        <BlockStack gap="300" align="start">
                          <Text as="p" variant="bodyMd" fontWeight="semibold" alignment="start">
                            What's included:
                          </Text>
                          <BlockStack gap="200" align="start">
                            {plan.features.map((feature, index) => (
                              <InlineStack key={index} gap="200" align="start" blockAlign="start">
                                <div style={{ flexShrink: 0 }}>
                                  <Icon source={CheckCircleIcon} tone="success" />
                                </div>
                                <Text as="p" variant="bodyMd" alignment="start">{feature}</Text>
                              </InlineStack>
                            ))}
                          </BlockStack>
                        </BlockStack>
                      </BlockStack>
                    </Box>
                  </Card>
                );
              })}
            </div>

            {/* FAQ Section */}
            <Card>
              <Box padding="400">
                <BlockStack gap="400">
                  <Text as="h3" variant="headingLg">
                    Frequently Asked Questions
                  </Text>

                  <BlockStack gap="300">
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        Can I upgrade or downgrade my plan at any time?
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
                      </Text>
                    </BlockStack>

                    <Divider />

                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        How does billing work?
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        All plans are billed monthly through your Shopify invoice. The charge appears on your regular Shopify bill.
                      </Text>
                    </BlockStack>

                    <Divider />

                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        When will I be charged?
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Charges appear on your regular Shopify invoice. You'll be charged monthly on the same billing cycle as your Shopify subscription.
                      </Text>
                    </BlockStack>
                  </BlockStack>
                </BlockStack>
              </Box>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
