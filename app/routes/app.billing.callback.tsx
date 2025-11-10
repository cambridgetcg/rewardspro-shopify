/**
 * Billing Callback Route - REBUILT
 * Handles the redirect back from Shopify after subscription confirmation
 *
 * This route is called when:
 * 1. User approves subscription on Shopify
 * 2. User declines subscription on Shopify
 *
 * URL format: /app/billing/callback?shop=example.myshopify.com&plan=pro&charge_id=xxx
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { logBillingAttempt } from "~/services/billing/plan-subscription.server";
import { updatePlanLimit, unlockShop } from "~/utils/plan-access-control.server";
import { getPlanConfig } from "~/utils/billing-config";

/**
 * Loader function - handles GET requests to callback
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const startTime = Date.now();

  // ============================================
  // STEP 1: Log Initial Request
  // ============================================
  const url = new URL(request.url);
  console.log('════════════════════════════════════════════════════════════');
  console.log('[Billing Callback] 🔔 CALLBACK RECEIVED');
  console.log('[Billing Callback] ⏰ Timestamp:', new Date().toISOString());
  console.log('[Billing Callback] 🌐 Full URL:', request.url);
  console.log('[Billing Callback] 📋 URL Params:', {
    shop: url.searchParams.get("shop"),
    plan: url.searchParams.get("plan"),
    charge_id: url.searchParams.get("charge_id"),
    host: url.searchParams.get("host"),
    timestamp: url.searchParams.get("timestamp"),
    allParams: Object.fromEntries(url.searchParams.entries())
  });
  console.log('[Billing Callback] 🔗 Referrer:', request.headers.get('referer'));
  console.log('[Billing Callback] 🖥️  User-Agent:', request.headers.get('user-agent'));
  console.log('════════════════════════════════════════════════════════════');

  // ============================================
  // STEP 2: Authenticate with Shopify
  // ============================================
  console.log('[Billing Callback] 🔐 Attempting authentication...');

  let session, admin;
  try {
    const authResult = await authenticate.admin(request);
    session = authResult.session;
    admin = authResult.admin;

    console.log('[Billing Callback] ✅ Authentication successful');
    console.log('[Billing Callback] 🏪 Session shop:', session?.shop);
    console.log('[Billing Callback] 🆔 Session ID:', session?.id);
    console.log('[Billing Callback] 👤 Session isOnline:', session?.isOnline);
    console.log('[Billing Callback] 🔑 Has admin context:', !!admin);
  } catch (error) {
    console.error('[Billing Callback] ❌ Authentication failed:', error);
    console.error('[Billing Callback] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error; // Re-throw to let Shopify handle auth redirect
  }

  // ============================================
  // STEP 3: Validate Session
  // ============================================
  if (!session?.shop) {
    console.error('[Billing Callback] ❌ No shop in session');
    console.error('[Billing Callback] Session object:', session);
    throw new Response("Unauthorized - No shop in session", { status: 401 });
  }

  const shop = session.shop;
  console.log('[Billing Callback] ✅ Session validated for shop:', shop);

  // ============================================
  // STEP 4: Extract and Validate Parameters
  // ============================================
  const planId = url.searchParams.get("plan");
  const shopParam = url.searchParams.get("shop");
  const chargeId = url.searchParams.get("charge_id");

  console.log('[Billing Callback] 📦 Extracted parameters:', {
    planId,
    shopParam,
    chargeId,
    sessionShop: shop
  });

  // Validate shop parameter matches session
  if (shopParam && shopParam !== shop) {
    console.warn('[Billing Callback] ⚠️  Shop mismatch!', {
      urlShop: shopParam,
      sessionShop: shop
    });
  }

  // ============================================
  // STEP 5: Handle Cancellation
  // ============================================
  if (!planId) {
    console.log('[Billing Callback] ⚠️  No plan ID - user likely cancelled subscription');
    await logBillingAttempt(shop, "unknown", false, "Merchant cancelled subscription");

    const embeddedAppUrl = `/app/billing?cancelled=true`;
    console.log('[Billing Callback] 🔀 Redirecting to:', embeddedAppUrl);
    console.log('[Billing Callback] ⏱️  Total time:', Date.now() - startTime, 'ms');
    console.log('════════════════════════════════════════════════════════════');

    return redirect(embeddedAppUrl);
  }

  // ============================================
  // STEP 6: Validate Plan Configuration
  // ============================================
  console.log('[Billing Callback] 🔍 Looking up plan configuration for:', planId);
  const planConfig = getPlanConfig(planId);

  if (!planConfig) {
    console.error('[Billing Callback] ❌ Invalid plan ID:', planId);
    console.error('[Billing Callback] Available plans:', Object.keys(await import("~/utils/billing-config").then(m => m.BillingConfig.plans)));

    const embeddedAppUrl = `/app/billing?error=invalid_plan`;
    console.log('[Billing Callback] 🔀 Redirecting to:', embeddedAppUrl);
    console.log('[Billing Callback] ⏱️  Total time:', Date.now() - startTime, 'ms');
    console.log('════════════════════════════════════════════════════════════');

    return redirect(embeddedAppUrl);
  }

  console.log('[Billing Callback] ✅ Plan configuration found:', {
    planId,
    planName: planConfig.name,
    price: planConfig.price,
    orderLimit: planConfig.orderLimit
  });

  // ============================================
  // STEP 7: Process Subscription
  // ============================================
  try {
    console.log('[Billing Callback] 🔄 Starting subscription verification process...');

    // Import GraphQL Billing Service
    console.log('[Billing Callback] 📥 Importing GraphQL Billing Service...');
    const { GraphQLBillingService } = await import("~/services/billing/graphql-billing.service");
    const billingService = new GraphQLBillingService(admin);
    console.log('[Billing Callback] ✅ Billing service initialized');

    // Check for pending charge in database
    console.log('[Billing Callback] 🗄️  Checking database for pending charge...');
    const db = await import("~/db.server");
    const billingSubscription = await db.default.billingSubscription.findUnique({
      where: { shop }
    });

    console.log('[Billing Callback] 📊 Database query result:', {
      found: !!billingSubscription,
      hasPendingCharge: !!billingSubscription?.pendingChargeId,
      pendingChargeId: billingSubscription?.pendingChargeId,
      subscriptionStatus: billingSubscription?.subscriptionStatus,
      createdAt: billingSubscription?.createdAt
    });

    if (!billingSubscription?.pendingChargeId) {
      console.warn('[Billing Callback] ⚠️  No pending charge found in database for shop:', shop);
      console.warn('[Billing Callback] This might mean:');
      console.warn('[Billing Callback]   1. Subscription was not properly created');
      console.warn('[Billing Callback]   2. Database record is missing');
      console.warn('[Billing Callback]   3. This is a duplicate callback');

      const embeddedAppUrl = `/app/billing?error=no_pending_charge`;
      console.log('[Billing Callback] 🔀 Redirecting to:', embeddedAppUrl);
      console.log('[Billing Callback] ⏱️  Total time:', Date.now() - startTime, 'ms');
      console.log('════════════════════════════════════════════════════════════');

      return redirect(embeddedAppUrl);
    }

    // Extract subscription ID from pending charge
    const subscriptionId = billingSubscription.pendingChargeId.split('/').pop();
    console.log('[Billing Callback] 🔑 Extracted subscription ID:', subscriptionId);
    console.log('[Billing Callback] 📋 Full pending charge ID:', billingSubscription.pendingChargeId);

    // Verify subscription is now active via GraphQL
    console.log('[Billing Callback] 📡 Verifying subscription status with Shopify GraphQL API...');
    const verifyStartTime = Date.now();
    const verifyResult = await billingService.verifySubscription(shop, subscriptionId!);
    const verifyDuration = Date.now() - verifyStartTime;

    console.log('[Billing Callback] 📊 Verification result:', {
      success: verifyResult.success,
      subscriptionId: verifyResult.subscriptionId,
      status: verifyResult.status,
      error: verifyResult.error,
      duration: verifyDuration + 'ms'
    });

    if (verifyResult.success) {
      console.log('[Billing Callback] ✅ SUBSCRIPTION CONFIRMED!');
      console.log('[Billing Callback] 🎉 Shop:', shop);
      console.log('[Billing Callback] 🎉 Plan:', planConfig.name);
      console.log('[Billing Callback] 🎉 Status:', verifyResult.status);

      // ============================================
      // STEP 8: Update Database and Shop Settings
      // ============================================
      console.log('[Billing Callback] 💾 Updating database records...');

      // Log successful subscription
      console.log('[Billing Callback] 📝 Logging billing attempt...');
      await logBillingAttempt(shop, planId, true, null, {
        subscriptionId: verifyResult.subscriptionId,
        callbackUrl: request.url,
        verifyDuration,
        totalDuration: Date.now() - startTime
      });
      console.log('[Billing Callback] ✅ Billing attempt logged');

      // Update plan limits
      console.log('[Billing Callback] 📊 Updating plan limits...');
      console.log('[Billing Callback]   - Shop:', shop);
      console.log('[Billing Callback]   - Plan name:', planConfig.name);
      console.log('[Billing Callback]   - Order limit:', planConfig.orderLimit);
      await updatePlanLimit(shop, planConfig.name, planConfig.orderLimit);
      console.log('[Billing Callback] ✅ Plan limits updated');

      // Unlock shop
      console.log('[Billing Callback] 🔓 Unlocking shop...');
      await unlockShop(shop);
      console.log('[Billing Callback] ✅ Shop unlocked');

      // ============================================
      // STEP 9: Redirect to Success Page
      // ============================================
      // Use relative URL to stay in embedded app context
      const embeddedAppUrl = `/app/billing?success=true&plan=${planId}`;

      console.log('[Billing Callback] ✅ ALL PROCESSING COMPLETE');
      console.log('[Billing Callback] 🔀 Redirecting to:', embeddedAppUrl);
      console.log('[Billing Callback] ⏱️  Total time:', Date.now() - startTime, 'ms');
      console.log('════════════════════════════════════════════════════════════');

      return redirect(embeddedAppUrl);

    } else {
      // ============================================
      // VERIFICATION FAILED
      // ============================================
      console.error('[Billing Callback] ❌ SUBSCRIPTION VERIFICATION FAILED');
      console.error('[Billing Callback] Shop:', shop);
      console.error('[Billing Callback] Plan:', planId);
      console.error('[Billing Callback] Error:', verifyResult.error);
      console.error('[Billing Callback] Subscription ID:', subscriptionId);

      // Log failed attempt
      await logBillingAttempt(shop, planId, false, verifyResult.error || "Subscription not confirmed");

      const embeddedAppUrl = `/app/billing?error=subscription_not_found`;
      console.log('[Billing Callback] 🔀 Redirecting to:', embeddedAppUrl);
      console.log('[Billing Callback] ⏱️  Total time:', Date.now() - startTime, 'ms');
      console.log('════════════════════════════════════════════════════════════');

      return redirect(embeddedAppUrl);
    }

  } catch (error) {
    // ============================================
    // ERROR HANDLING
    // ============================================
    console.error('════════════════════════════════════════════════════════════');
    console.error('[Billing Callback] ❌ ERROR PROCESSING CALLBACK');
    console.error('[Billing Callback] Shop:', shop);
    console.error('[Billing Callback] Plan:', planId);
    console.error('[Billing Callback] Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[Billing Callback] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[Billing Callback] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('════════════════════════════════════════════════════════════');

    // Log failed attempt
    await logBillingAttempt(
      shop,
      planId,
      false,
      error instanceof Error ? error.message : String(error)
    );

    const embeddedAppUrl = `/app/billing?error=callback_failed&details=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`;
    console.log('[Billing Callback] 🔀 Redirecting to error page:', embeddedAppUrl);
    console.log('[Billing Callback] ⏱️  Total time:', Date.now() - startTime, 'ms');
    console.log('════════════════════════════════════════════════════════════');

    return redirect(embeddedAppUrl);
  }
};
