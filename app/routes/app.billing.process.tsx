/**
 * Billing Process Route - Embedded App Handler
 * Processes the subscription after redirect from Shopify callback
 *
 * This route runs in the embedded app context (inside Shopify admin iframe)
 * where we CAN authenticate and access the session.
 *
 * Flow:
 * 1. Shopify redirects to /app/billing/callback (no auth possible)
 * 2. Callback redirects to https://{shop}/admin/apps/{app}/app/billing/process (embedded)
 * 3. This route processes subscription and redirects to billing page
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { logBillingAttempt } from "~/services/billing/plan-subscription.server";
import { updatePlanLimit, unlockShop } from "~/utils/plan-access-control.server";
import { getPlanConfig } from "~/utils/billing-config";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const startTime = Date.now();

  // ============================================
  // STEP 1: Log Processing Start
  // ============================================
  const url = new URL(request.url);
  console.log('════════════════════════════════════════════════════════════');
  console.log('[Billing Process] 🔄 PROCESSING SUBSCRIPTION');
  console.log('[Billing Process] ⏰ Timestamp:', new Date().toISOString());
  console.log('[Billing Process] 🌐 Full URL:', request.url);
  console.log('[Billing Process] 📋 URL Params:', {
    shop: url.searchParams.get("shop"),
    plan: url.searchParams.get("plan"),
    charge_id: url.searchParams.get("charge_id"),
    cancelled: url.searchParams.get("cancelled"),
    allParams: Object.fromEntries(url.searchParams.entries())
  });
  console.log('════════════════════════════════════════════════════════════');

  // ============================================
  // STEP 2: Authenticate (now we're in embedded app context)
  // ============================================
  console.log('[Billing Process] 🔐 Attempting authentication in embedded app context...');

  let session, admin;
  try {
    const authResult = await authenticate.admin(request);
    session = authResult.session;
    admin = authResult.admin;

    console.log('[Billing Process] ✅ Authentication successful');
    console.log('[Billing Process] 🏪 Session shop:', session?.shop);
    console.log('[Billing Process] 🆔 Session ID:', session?.id);
    console.log('[Billing Process] 👤 Session isOnline:', session?.isOnline);
    console.log('[Billing Process] 🔑 Has admin context:', !!admin);
  } catch (error) {
    console.error('[Billing Process] ❌ Authentication failed:', error);
    console.error('[Billing Process] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      type: typeof error
    });
    // If auth fails, redirect to main billing page
    return redirect('/app/billing?error=auth_failed');
  }

  if (!session?.shop) {
    console.error('[Billing Process] ❌ No shop in session');
    return redirect('/app/billing?error=no_session');
  }

  const shop = session.shop;
  console.log('[Billing Process] ✅ Session validated for shop:', shop);

  // ============================================
  // STEP 3: Extract and Validate Parameters
  // ============================================
  const planId = url.searchParams.get("plan");
  const chargeId = url.searchParams.get("charge_id");
  const cancelled = url.searchParams.get("cancelled") === 'true';

  console.log('[Billing Process] 📦 Processing parameters:', {
    planId,
    chargeId,
    cancelled
  });

  // ============================================
  // STEP 4: Handle Cancellation
  // ============================================
  if (cancelled || !planId) {
    console.log('[Billing Process] ⚠️  Subscription cancelled or no plan');
    await logBillingAttempt(shop, planId || "unknown", false, "Merchant cancelled subscription");

    console.log('[Billing Process] 🔀 Redirecting to billing page with cancellation message');
    console.log('[Billing Process] ⏱️  Total time:', Date.now() - startTime, 'ms');
    console.log('════════════════════════════════════════════════════════════');

    return redirect('/app/billing?cancelled=true');
  }

  // ============================================
  // STEP 5: Validate Plan Configuration
  // ============================================
  console.log('[Billing Process] 🔍 Looking up plan configuration for:', planId);
  const planConfig = getPlanConfig(planId);

  if (!planConfig) {
    console.error('[Billing Process] ❌ Invalid plan ID:', planId);

    console.log('[Billing Process] 🔀 Redirecting to billing page with error');
    console.log('[Billing Process] ⏱️  Total time:', Date.now() - startTime, 'ms');
    console.log('════════════════════════════════════════════════════════════');

    return redirect('/app/billing?error=invalid_plan');
  }

  console.log('[Billing Process] ✅ Plan configuration found:', {
    planId,
    planName: planConfig.name,
    price: planConfig.price,
    orderLimit: planConfig.orderLimit
  });

  // ============================================
  // STEP 6: Verify Subscription with Shopify
  // ============================================
  try {
    console.log('[Billing Process] 🔄 Starting subscription verification...');

    // Import GraphQL Billing Service
    console.log('[Billing Process] 📥 Importing GraphQL Billing Service...');
    const { GraphQLBillingService } = await import("~/services/billing/graphql-billing.service");
    const billingService = new GraphQLBillingService(admin);
    console.log('[Billing Process] ✅ Billing service initialized');

    // Check for pending charge in database
    console.log('[Billing Process] 🗄️  Checking database for pending charge...');
    const db = await import("~/db.server");
    const billingSubscription = await db.default.billingSubscription.findUnique({
      where: { shop }
    });

    console.log('[Billing Process] 📊 Database query result:', {
      found: !!billingSubscription,
      hasPendingCharge: !!billingSubscription?.pendingChargeId,
      pendingChargeId: billingSubscription?.pendingChargeId,
      subscriptionStatus: billingSubscription?.subscriptionStatus
    });

    if (!billingSubscription?.pendingChargeId) {
      console.warn('[Billing Process] ⚠️  No pending charge found in database');
      console.warn('[Billing Process] This might mean:');
      console.warn('[Billing Process]   1. Subscription was not properly created');
      console.warn('[Billing Process]   2. Database record is missing');
      console.warn('[Billing Process]   3. This is a duplicate callback');

      console.log('[Billing Process] 🔀 Redirecting to billing page with error');
      console.log('[Billing Process] ⏱️  Total time:', Date.now() - startTime, 'ms');
      console.log('════════════════════════════════════════════════════════════');

      return redirect('/app/billing?error=no_pending_charge');
    }

    // Extract subscription ID from pending charge
    const subscriptionId = billingSubscription.pendingChargeId.split('/').pop();
    console.log('[Billing Process] 🔑 Extracted subscription ID:', subscriptionId);
    console.log('[Billing Process] 📋 Full pending charge ID:', billingSubscription.pendingChargeId);

    // Verify subscription is now active via GraphQL
    console.log('[Billing Process] 📡 Verifying subscription status with Shopify GraphQL API...');
    const verifyStartTime = Date.now();
    const verifyResult = await billingService.verifySubscription(shop, subscriptionId!);
    const verifyDuration = Date.now() - verifyStartTime;

    console.log('[Billing Process] 📊 Verification result:', {
      success: verifyResult.success,
      subscriptionId: verifyResult.subscriptionId,
      status: verifyResult.status,
      error: verifyResult.error,
      duration: verifyDuration + 'ms'
    });

    if (verifyResult.success) {
      console.log('[Billing Process] ✅ SUBSCRIPTION CONFIRMED!');
      console.log('[Billing Process] 🎉 Shop:', shop);
      console.log('[Billing Process] 🎉 Plan:', planConfig.name);
      console.log('[Billing Process] 🎉 Status:', verifyResult.status);

      // ============================================
      // STEP 7: Update Database and Shop Settings
      // ============================================
      console.log('[Billing Process] 💾 Updating database records...');

      // Log successful subscription
      console.log('[Billing Process] 📝 Logging billing attempt...');
      await logBillingAttempt(shop, planId, true, null, {
        subscriptionId: verifyResult.subscriptionId,
        chargeId,
        verifyDuration,
        totalDuration: Date.now() - startTime
      });
      console.log('[Billing Process] ✅ Billing attempt logged');

      // Update plan limits
      console.log('[Billing Process] 📊 Updating plan limits...');
      console.log('[Billing Process]   - Shop:', shop);
      console.log('[Billing Process]   - Plan name:', planConfig.name);
      console.log('[Billing Process]   - Order limit:', planConfig.orderLimit);
      await updatePlanLimit(shop, planConfig.name, planConfig.orderLimit);
      console.log('[Billing Process] ✅ Plan limits updated');

      // Unlock shop
      console.log('[Billing Process] 🔓 Unlocking shop...');
      await unlockShop(shop);
      console.log('[Billing Process] ✅ Shop unlocked');

      // ============================================
      // STEP 8: Redirect to Success Page
      // ============================================
      console.log('[Billing Process] ✅ ALL PROCESSING COMPLETE');
      console.log('[Billing Process] 🔀 Redirecting to billing page with success');
      console.log('[Billing Process] ⏱️  Total time:', Date.now() - startTime, 'ms');
      console.log('════════════════════════════════════════════════════════════');

      return redirect(`/app/billing?success=true&plan=${planId}`);

    } else {
      // Verification failed
      console.error('[Billing Process] ❌ SUBSCRIPTION VERIFICATION FAILED');
      console.error('[Billing Process] Shop:', shop);
      console.error('[Billing Process] Plan:', planId);
      console.error('[Billing Process] Error:', verifyResult.error);

      await logBillingAttempt(shop, planId, false, verifyResult.error || "Subscription not confirmed");

      console.log('[Billing Process] 🔀 Redirecting to billing page with error');
      console.log('[Billing Process] ⏱️  Total time:', Date.now() - startTime, 'ms');
      console.log('════════════════════════════════════════════════════════════');

      return redirect('/app/billing?error=subscription_not_found');
    }

  } catch (error) {
    // ============================================
    // ERROR HANDLING
    // ============================================
    console.error('════════════════════════════════════════════════════════════');
    console.error('[Billing Process] ❌ ERROR PROCESSING SUBSCRIPTION');
    console.error('[Billing Process] Shop:', shop);
    console.error('[Billing Process] Plan:', planId);
    console.error('[Billing Process] Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[Billing Process] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[Billing Process] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('════════════════════════════════════════════════════════════');

    await logBillingAttempt(
      shop,
      planId,
      false,
      error instanceof Error ? error.message : String(error)
    );

    console.log('[Billing Process] 🔀 Redirecting to billing page with error');
    console.log('[Billing Process] ⏱️  Total time:', Date.now() - startTime, 'ms');
    console.log('════════════════════════════════════════════════════════════');

    return redirect(`/app/billing?error=processing_failed`);
  }
};
