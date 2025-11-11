/**
 * Billing Page - Using Shopify App Remix Billing
 * Handles plan selection and subscription management with billing.request()
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
  getAllPlans,
} from "~/services/billing/plan-subscription.server";
import { detectNewSubscription } from "~/utils/billing-success-detection.server";
import {
  PRO_PLAN,
  PRO_ANNUAL_PLAN,
  MAX_PLAN,
  MAX_ANNUAL_PLAN,
  ULTRA_PLAN,
  ULTRA_ANNUAL_PLAN,
} from "~/constants/plans";

// Map plan IDs to Shopify plan constants
function getPlanConstant(planId: string): string {
  const planMap: Record<string, string> = {
    'pro': PRO_PLAN,
    'pro-annual': PRO_ANNUAL_PLAN,
    'max': MAX_PLAN,
    'max-annual': MAX_ANNUAL_PLAN,
    'ultra': ULTRA_PLAN,
    'ultra-annual': ULTRA_ANNUAL_PLAN,
  };
  return planMap[planId] || PRO_PLAN;
}

// ============================================
// LOADER - Get Current Subscription Status
// ============================================

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  try {
    console.log('[Billing Loader] Starting for shop:', session.shop);

    // Check actual subscription status with billing.check()
    const billingCheck = await billing.check({
      plans: [
        PRO_PLAN,
        PRO_ANNUAL_PLAN,
        MAX_PLAN,
        MAX_ANNUAL_PLAN,
        ULTRA_PLAN,
        ULTRA_ANNUAL_PLAN
      ],
      isTest: process.env.NODE_ENV === 'development',
    });

    console.log('[Billing Loader] Billing check result:', {
      hasActivePayment: billingCheck.hasActivePayment,
      subscriptionCount: billingCheck.appSubscriptions.length,
      subscriptions: billingCheck.appSubscriptions.map(s => ({
        id: s.id,
        name: s.name,
        test: s.test
      })),
    });

    // Get URL params to detect return from Shopify
    const url = new URL(request.url);
    const returnedFromShopify = url.searchParams.get('success') === 'true';

    console.log('[Billing Loader] Returned from Shopify:', returnedFromShopify);

    // Detect if this is a NEW subscription (just completed)
    const justSubscribed = await detectNewSubscription(
      session,
      billingCheck,
      returnedFromShopify
    );

    // Detect cancellation (returned from Shopify but no active payment)
    const cancelled = returnedFromShopify && !billingCheck.hasActivePayment;

    console.log('[Billing Loader] Final state:', {
      justSubscribed,
      cancelled,
    });

    // Get all available plans for UI
    const plans = getAllPlans();

    return json({
      hasActivePayment: billingCheck.hasActivePayment,
      appSubscriptions: billingCheck.appSubscriptions,
      oneTimePurchases: billingCheck.oneTimePurchases,
      justSubscribed,
      cancelled,
      newSubscriptionPlan: justSubscribed ? billingCheck.appSubscriptions[0]?.name : null,
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
    return json({
      success: false,
      error: "Invalid action"
    }, { status: 400 });
  }

  console.log(`[Billing Action] Shop ${session.shop} requesting ${planId} plan`);

  try {
    // Map plan ID to plan constant
    const planConstant = getPlanConstant(planId) as keyof typeof import("../shopify.server");

    console.log(`[Billing Action] Requesting billing for plan: ${planConstant}`);

    // Use billing.request() - this will automatically redirect to Shopify's confirmation page
    // and then return the user back to the returnUrl after approval
    // We include success=true to signal return from Shopify, but verify with billing.check()
    await billing.request({
      plan: planConstant,
      isTest: process.env.NODE_ENV === 'development' || session.shop.includes('.myshopify.com'),
      returnUrl: `${process.env.SHOPIFY_APP_URL}/app/billing?success=true`,
    });

    // billing.request() throws a redirect, so this code won't be reached
    // But TypeScript needs a return statement
    return json({ success: true });
  } catch (error) {
    // Handle errors (billing.request() throws redirects, not errors for success)
    console.error(`[Billing Action] Error:`, error);
    return json({
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

  // Get current plan from billing.check() data
  const currentSubscription = data.appSubscriptions[0];
  const currentPlan = currentSubscription?.name;
  const isCurrentPlanActive = data.hasActivePayment;

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
            {/* Show success banner based on verified subscription data */}
            {data.justSubscribed && data.newSubscriptionPlan && (
              <Banner tone="success">
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">
                    🎉 Subscription Activated!
                  </Text>
                  <Text as="p">
                    You're now subscribed to <strong>{data.newSubscriptionPlan}</strong>.
                    {currentSubscription?.test && ' (Test Mode)'}
                  </Text>
                  <Text as="p" tone="subdued">
                    Your trial period has started. You won't be charged until the trial ends.
                  </Text>
                </BlockStack>
              </Banner>
            )}

            {/* Show cancellation message */}
            {data.cancelled && (
              <Banner tone="info">
                <Text as="p">
                  Subscription was not completed. Your current plan remains active.
                </Text>
              </Banner>
            )}

            {/* Show errors if billing.request() fails */}
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
                    {currentPlan.replace('RewardsPro', 'Rewards')}
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
                // Check if this plan matches the current subscription
                const planConstantMonthly = getPlanConstant(plan.id);
                const planConstantAnnual = getPlanConstant(plan.idAnnual);
                const isCurrentPlan = currentPlan === planConstantMonthly ||
                                     currentPlan === planConstantAnnual;

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
                          {isCurrentPlan ? "Current Plan" : "Subscribe"}
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
                        How does billing work?
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        All billing is handled through Shopify. Charges appear on your regular Shopify invoice—the same monthly invoice you already receive for your Shopify subscription. We never charge your card directly; all payments flow through Shopify's secure billing system.
                      </Text>
                    </BlockStack>

                    <Divider />

                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        What's the difference between monthly and annual billing?
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Annual plans charge the yearly total up front (e.g., Pro Annual is $336/year instead of $39/month) and offer significant savings—up to 28% off. When you switch from monthly to annual or vice versa, Shopify automatically handles proration of your existing subscription. The new billing agreement starts immediately.
                      </Text>
                    </BlockStack>

                    <Divider />

                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        What are overage/usage charges?
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Pro and Max plans include usage-based billing for orders beyond your monthly limit. Pro: $10 per 100 orders over 500 (capped at $50/month). Max: $5 per 100 orders over 2,000 (capped at $100/month). These charges appear as usage line items on your Shopify invoice. Ultra plan has unlimited orders with no overage charges.
                      </Text>
                    </BlockStack>

                    <Divider />

                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        Can I upgrade or downgrade my plan at any time?
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Yes! Plan changes take effect immediately. Upgrades remove any "plan locked" state instantly and increase your order limit right away. Downgrades or returns to the free plan also apply instantly, though you may be locked again if your current usage exceeds the new limit.
                      </Text>
                    </BlockStack>

                    <Divider />

                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        What happens when I reach my order limit?
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        When you hit your order limit, your store is automatically locked and the dashboard will prompt you to upgrade. Premium features will be locked or greyed out. Upgrading instantly unlocks your store and raises the limit. Pro and Max plans with usage billing will continue processing orders and charge the overage rate (up to the monthly cap).
                      </Text>
                    </BlockStack>

                    <Divider />

                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        What happens after I cancel my subscription?
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Cancellation instantly reverts your account to the Free plan with a 100 order/month limit. Your existing configuration (tiers, rewards, etc.) stays intact, but premium features lock or grey out once the free plan limit is reached. No data is lost—you can re-upgrade anytime.
                      </Text>
                    </BlockStack>

                    <Divider />

                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        What if I cancel my annual plan mid-term?
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Shopify handles annual subscription cancellations automatically. Any prorated refunds or final charges are processed through Shopify Billing. Once cancelled, we receive a webhook and immediately downgrade your account to Free. To ensure billing stops, complete the full cancellation flow in Shopify.
                      </Text>
                    </BlockStack>

                    <Divider />

                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        What is your refund policy?
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Since all billing is handled through Shopify, any refunds must go through Shopify's billing channels. Contact Shopify Support or reach out to our support team, who can initiate the refund process via Shopify on your behalf.
                      </Text>
                    </BlockStack>

                    <Divider />

                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        How do I cancel my subscription?
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Visit the Billing page, click "Manage plan," and follow the confirmation flow in Shopify. Make sure to complete all steps in the Shopify confirmation page to ensure billing stops. If you encounter any issues, contact our support team for assistance.
                      </Text>
                    </BlockStack>

                    <Divider />

                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        I see "shop cannot accept the provided charge" — what does this mean?
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        This message appears when the app is still in development mode and billing hasn't been approved yet. If you're seeing this on a live store, please contact our support team to enable billing for your shop.
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
