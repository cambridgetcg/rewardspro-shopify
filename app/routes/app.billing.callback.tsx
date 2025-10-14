/**
 * Billing Callback Route
 * Handles the redirect back from Shopify after subscription confirmation
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getSubscriptionStatus, logBillingAttempt } from "~/services/billing/plan-subscription.server";
import { updatePlanLimit, unlockShop } from "~/utils/plan-access-control.server";
import { PLAN_CONFIGS } from "~/services/billing/plan-subscription.server";

/**
 * This route is called after the merchant confirms the subscription in Shopify
 * URL format: /app/billing/callback?plan=pro&charge_id=12345
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const planId = url.searchParams.get("plan");
  const chargeId = url.searchParams.get("charge_id");

  console.log(`[Billing Callback] Shop: ${session.shop}, Plan: ${planId}, Charge: ${chargeId}`);

  // Handle cancellation - when merchant clicks "Cancel" on Shopify payment page
  if (!chargeId && planId) {
    console.log(`[Billing Callback] Merchant cancelled subscription for ${session.shop}`);
    await logBillingAttempt(session.shop, planId, false, "Merchant cancelled subscription");
    return redirect("/app/billing?cancelled=true");
  }

  if (!planId) {
    console.error("[Billing Callback] No plan ID provided");
    return redirect("/app/billing?error=missing_plan");
  }

  const planConfig = PLAN_CONFIGS[planId];
  if (!planConfig) {
    console.error(`[Billing Callback] Invalid plan ID: ${planId}`);
    return redirect("/app/billing?error=invalid_plan");
  }

  try {
    // Verify the subscription was actually created
    const subscriptionStatus = await getSubscriptionStatus(session.shop, billing);

    if (subscriptionStatus.hasActiveSubscription && subscriptionStatus.currentPlan === planConfig.planName) {
      console.log(`[Billing Callback] Subscription confirmed for ${session.shop}: ${planConfig.planName}`);

      // Log successful subscription
      await logBillingAttempt(session.shop, planId, true, null, {
        chargeId,
        subscriptionId: subscriptionStatus.subscriptionId,
        callbackUrl: request.url
      });

      // Update plan limits and unlock shop
      await updatePlanLimit(session.shop, planConfig.planName, planConfig.orderLimit);
      await unlockShop(session.shop);

      // Redirect to billing page with success message
      return redirect(`/app/billing?success=true&plan=${planId}`);
    } else {
      console.warn(`[Billing Callback] Subscription not found or plan mismatch for ${session.shop}`);

      // Log failed attempt
      await logBillingAttempt(session.shop, planId, false, "Subscription not confirmed", {
        chargeId,
        expectedPlan: planConfig.planName,
        actualPlan: subscriptionStatus.currentPlan
      });

      return redirect("/app/billing?error=subscription_not_found");
    }
  } catch (error) {
    console.error("[Billing Callback] Error processing callback:", error);

    await logBillingAttempt(
      session.shop,
      planId,
      false,
      error instanceof Error ? error.message : String(error),
      { chargeId }
    );

    return redirect(`/app/billing?error=callback_failed`);
  }
};
