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
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { useState, useEffect } from "react";
import {
  getSubscriptionStatus,
  getAllPlans,
  type BillingResult,
  type SubscriptionStatus,
} from "~/services/billing/plan-subscription.server";

// ============================================
// LOADER - Get Current Subscription Status
// ============================================

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing, admin } = await authenticate.admin(request);

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  try {
    // Get current subscription status
    const subscriptionStatus = await getSubscriptionStatus(session.shop, billing, admin);

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
  const { session, admin, billing } = await authenticate.admin(request);

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

  try {
    // Use GraphQL Billing Service (with auto-detection of dev stores)
    const { GraphQLBillingService } = await import("~/services/billing/graphql-billing.service");
    const billingService = new GraphQLBillingService(admin);

    // Determine if this is an upgrade
    const currentStatus = await getSubscriptionStatus(session.shop, billing, admin);
    const isUpgrade = currentStatus.hasActiveSubscription;

    // Create subscription via GraphQL
    const result = await billingService.createSubscription({
      shop: session.shop,
      planType: planId as any,
      isUpgrade,
    });

    console.log(`[Billing Action] Subscription creation result:`, {
      success: result.success,
      hasConfirmationUrl: !!result.confirmationUrl,
      confirmationUrl: result.confirmationUrl,
      subscriptionId: result.subscriptionId,
      error: result.error
    });

    if (result.success && result.confirmationUrl) {
      console.log(`[Billing Action] Subscription created, returning confirmation URL:`, result.confirmationUrl);
      // Return confirmation URL for client-side redirect (embedded app compatible)
      return json<BillingResult>({
        success: true,
        confirmationUrl: result.confirmationUrl,
        subscriptionId: result.subscriptionId,
      });
    }

    if (!result.success) {
      console.error(`[Billing Action] Failed to create subscription:`, result.error);
      return json<BillingResult>({
        success: false,
        error: result.error || "Failed to create subscription",
      });
    }

    return json<BillingResult>(result);
  } catch (error) {
    // Handle errors
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
  const app = useAppBridge();

  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');

  // Check URL params for cancellation or errors
  const [searchParams] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  });
  const cancelled = searchParams.get('cancelled') === 'true';
  const successParam = searchParams.get('success') === 'true';
  const successPlan = searchParams.get('plan');
  const urlError = searchParams.get('error');

  // Handle redirect to Shopify confirmation page using App Bridge
  useEffect(() => {
    console.log('[Billing] useEffect triggered:', {
      hasActionData: !!actionData,
      success: actionData?.success,
      hasConfirmationUrl: !!actionData?.confirmationUrl,
      confirmationUrl: actionData?.confirmationUrl,
      hasApp: !!app,
      hasAppRedirect: !!(app && app.redirect),
      appType: typeof app
    });

    if (actionData?.success && actionData.confirmationUrl) {
      console.log('[Billing] ⚠️ Attempting redirect to Shopify confirmation page');
      console.log('[Billing] Confirmation URL:', actionData.confirmationUrl);

      // Use App Bridge redirect for embedded apps
      if (app && typeof app.redirect === 'object' && app.redirect.toRemote) {
        console.log('[Billing] ✅ App Bridge available, calling toRemote()');
        try {
          app.redirect.toRemote(actionData.confirmationUrl);
          console.log('[Billing] ✅ Redirect initiated successfully');
        } catch (error) {
          console.error('[Billing] ❌ Redirect failed:', error);
        }
      } else {
        console.error('[Billing] ❌ App Bridge redirect not available');
        console.error('[Billing] App object:', {
          hasApp: !!app,
          hasRedirect: !!(app && app.redirect),
          redirectType: app && app.redirect ? typeof app.redirect : 'undefined',
          hasToRemote: !!(app && app.redirect && app.redirect.toRemote)
        });
        // Fallback: try window redirect (won't work in embedded app)
        console.log('[Billing] Attempting window.top.location fallback');
        if (typeof window !== 'undefined' && window.top) {
          window.top.location.href = actionData.confirmationUrl;
        }
      }
    }
  }, [actionData, app]);

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
            {/* Only show success banner if user came back from Shopify (URL param) */}
            {successParam && successPlan && (
              <Banner tone="success">
                <p>Successfully subscribed to {successPlan} plan! Your trial period has started.</p>
              </Banner>
            )}

            {/* Show success for immediate activation (no confirmation needed) */}
            {actionData?.success && !actionData.confirmationUrl && actionData.planName && (
              <Banner tone="success">
                <p>Successfully subscribed to {actionData.planName}!</p>
              </Banner>
            )}

            {cancelled && (
              <Banner tone="info">
                <p>Subscription upgrade was cancelled. Your current plan remains active.</p>
              </Banner>
            )}

            {urlError && (
              <Banner tone="critical">
                <p>Error: {urlError.replace(/_/g, ' ')}</p>
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
