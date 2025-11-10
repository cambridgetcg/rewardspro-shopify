/**
 * Billing Callback Route - OAuth Return Handler
 * Handles the redirect back from Shopify after subscription confirmation
 *
 * IMPORTANT: This route receives a direct browser redirect from Shopify,
 * NOT an embedded app request. Therefore, we need to redirect back to
 * the embedded app context to complete the flow.
 *
 * This route is called when:
 * 1. User approves subscription on Shopify
 * 2. User declines subscription on Shopify
 *
 * URL format: /app/billing/callback?shop=example.myshopify.com&plan=pro&charge_id=xxx
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

/**
 * Loader function - handles GET requests to callback
 *
 * Since Shopify redirects here OUTSIDE the embedded app context,
 * we can't authenticate normally. Instead, we redirect to the
 * embedded app with all parameters preserved.
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
  // STEP 2: Extract Parameters
  // ============================================
  const shop = url.searchParams.get("shop");
  const planId = url.searchParams.get("plan");
  const chargeId = url.searchParams.get("charge_id");

  console.log('[Billing Callback] 📦 Extracted parameters:', {
    shop,
    planId,
    chargeId
  });

  // ============================================
  // STEP 3: Validate Required Parameters
  // ============================================
  if (!shop) {
    console.error('[Billing Callback] ❌ Missing required parameter: shop');
    console.error('[Billing Callback] Cannot proceed without shop domain');
    throw new Response("Missing shop parameter", { status: 400 });
  }

  console.log('[Billing Callback] ✅ Shop parameter validated:', shop);

  // ============================================
  // STEP 4: Build Embedded App Redirect URL
  // ============================================
  // We redirect to a processing route that runs in the embedded app context
  // where we CAN authenticate and process the subscription

  const processingParams = new URLSearchParams();
  processingParams.set('shop', shop);

  if (planId) {
    processingParams.set('plan', planId);
    console.log('[Billing Callback] ✅ Plan parameter found:', planId);
  } else {
    // No plan = user cancelled
    processingParams.set('cancelled', 'true');
    console.log('[Billing Callback] ⚠️  No plan parameter - user likely cancelled');
  }

  if (chargeId) {
    processingParams.set('charge_id', chargeId);
    console.log('[Billing Callback] ℹ️  Charge ID found:', chargeId);
  }

  // Redirect to the embedded app's billing processing route
  const embeddedAppUrl = `https://${shop}/admin/apps/${getAppHandle()}/app/billing/process?${processingParams.toString()}`;

  console.log('[Billing Callback] 🔀 Redirecting to embedded app processing route');
  console.log('[Billing Callback] 📍 Target URL:', embeddedAppUrl);
  console.log('[Billing Callback] ⏱️  Total time:', Date.now() - startTime, 'ms');
  console.log('════════════════════════════════════════════════════════════');

  // Redirect to embedded app context where we can authenticate
  return redirect(embeddedAppUrl);
};

/**
 * Get the app handle for building embedded app URLs
 * This should match your app's handle in Shopify Partner Dashboard
 */
function getAppHandle(): string {
  // TODO: Move this to environment variable if needed
  return "RewardsproMembership";
}
