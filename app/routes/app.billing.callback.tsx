/**
 * Billing Callback Route
 * Handles the redirect back from Shopify after subscription confirmation
 * Now uses GraphQL Billing Service
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { logBillingAttempt } from "~/services/billing/plan-subscription.server";
import { updatePlanLimit, unlockShop } from "~/utils/plan-access-control.server";
import { getPlanConfig } from "~/utils/billing-config";

/**
 * This route is called after the merchant confirms the subscription in Shopify
 * URL format: /app/billing/callback?shop=example.myshopify.com&plan=pro
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const planId = url.searchParams.get("plan");
  const shopParam = url.searchParams.get("shop");

  console.log(`[Billing Callback] Shop: ${session.shop}, Plan: ${planId}`);

  // Handle cancellation - when merchant clicks "Cancel" on Shopify payment page
  if (!planId) {
    console.log(`[Billing Callback] Merchant cancelled subscription for ${session.shop}`);
    await logBillingAttempt(session.shop, "unknown", false, "Merchant cancelled subscription");

    // Redirect to embedded app
    const shopDomain = session.shop;
    const appHandle = "RewardsproMembership";
    const embeddedAppUrl = `https://${shopDomain}/admin/apps/${appHandle}/app/billing?cancelled=true`;

    return redirect(embeddedAppUrl);
  }

  const planConfig = getPlanConfig(planId);
  if (!planConfig) {
    console.error(`[Billing Callback] Invalid plan ID: ${planId}`);

    // Redirect to embedded app
    const shopDomain = session.shop;
    const appHandle = "RewardsproMembership";
    const embeddedAppUrl = `https://${shopDomain}/admin/apps/${appHandle}/app/billing?error=invalid_plan`;

    return redirect(embeddedAppUrl);
  }

  try {
    // Use GraphQL Billing Service to verify subscription
    const { GraphQLBillingService } = await import("~/services/billing/graphql-billing.service");
    const billingService = new GraphQLBillingService(admin);

    // Check for pending charge in database
    const db = await import("~/db.server");
    const billingSubscription = await db.default.billingSubscription.findUnique({
      where: { shop: session.shop }
    });

    if (!billingSubscription?.pendingChargeId) {
      console.warn(`[Billing Callback] No pending charge found for ${session.shop}`);

      // Redirect to embedded app
      const shopDomain = session.shop;
      const appHandle = "RewardsproMembership";
      const embeddedAppUrl = `https://${shopDomain}/admin/apps/${appHandle}/app/billing?error=no_pending_charge`;

      return redirect(embeddedAppUrl);
    }

    // Extract subscription ID from pending charge
    const subscriptionId = billingSubscription.pendingChargeId.split('/').pop();

    // Verify subscription is now active
    const verifyResult = await billingService.verifySubscription(session.shop, subscriptionId!);

    if (verifyResult.success) {
      console.log(`[Billing Callback] Subscription confirmed for ${session.shop}: ${planConfig.name}`);

      // Log successful subscription
      await logBillingAttempt(session.shop, planId, true, null, {
        subscriptionId: verifyResult.subscriptionId,
        callbackUrl: request.url
      });

      // Update plan limits and unlock shop
      await updatePlanLimit(session.shop, planConfig.name, planConfig.orderLimit);
      await unlockShop(session.shop);

      // Redirect to embedded app (not just /app/billing which triggers login)
      // Format: https://{shop}/admin/apps/{app-handle}/app/billing?success=true
      const shopDomain = session.shop;
      const appHandle = "RewardsproMembership";
      const embeddedAppUrl = `https://${shopDomain}/admin/apps/${appHandle}/app/billing?success=true&plan=${planId}`;

      console.log(`[Billing Callback] Redirecting to embedded app:`, embeddedAppUrl);
      return redirect(embeddedAppUrl);
    } else {
      console.warn(`[Billing Callback] Subscription verification failed for ${session.shop}:`, verifyResult.error);

      // Log failed attempt
      await logBillingAttempt(session.shop, planId, false, verifyResult.error || "Subscription not confirmed");

      // Redirect to embedded app error page
      const shopDomain = session.shop;
      const appHandle = "RewardsproMembership";
      const embeddedAppUrl = `https://${shopDomain}/admin/apps/${appHandle}/app/billing?error=subscription_not_found`;

      return redirect(embeddedAppUrl);
    }
  } catch (error) {
    console.error("[Billing Callback] Error processing callback:", error);

    await logBillingAttempt(
      session.shop,
      planId,
      false,
      error instanceof Error ? error.message : String(error)
    );

    // Redirect to embedded app error page
    const shopDomain = session.shop;
    const appHandle = "RewardsproMembership";
    const embeddedAppUrl = `https://${shopDomain}/admin/apps/${appHandle}/app/billing?error=callback_failed`;

    return redirect(embeddedAppUrl);
  }
};
