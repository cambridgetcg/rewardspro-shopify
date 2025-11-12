import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

/**
 * Billing Callback Route
 *
 * Handles the return from Shopify's subscription approval page.
 * Shopify redirects here as a top-level navigation (not embedded),
 * so we need to redirect back into the embedded app context.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const chargeId = url.searchParams.get("charge_id");
  const success = url.searchParams.get("success");

  console.log('[Billing Callback] Received callback from Shopify:', {
    shop,
    chargeId,
    success,
    fullUrl: request.url,
  });

  if (!shop) {
    console.error("[Billing Callback] Missing shop parameter");
    return redirect("/auth/login");
  }

  // Build the embedded app URL with all required parameters
  // Extract store name from shop domain (e.g., "themetester222" from "themetester222.myshopify.com")
  const storeName = shop.split('.')[0];
  const host = Buffer.from(`${storeName}.myshopify.com/admin`).toString('base64');

  // Construct the embedded billing URL with proper parameters
  const embeddedUrl = `/app/billing?` + new URLSearchParams({
    success: success || 'true',
    charge_id: chargeId || '',
    shop: shop,
    host: host,
    embedded: '1'
  }).toString();

  console.log('[Billing Callback] Redirecting to embedded URL:', embeddedUrl);

  // Return HTML that uses App Bridge to navigate within the embedded context
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Redirecting...</title>
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
      </head>
      <body>
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2>Processing your subscription...</h2>
          <p>Please wait while we redirect you back to the app.</p>
        </div>
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            var shop = "${shop}";
            var apiKey = "${process.env.SHOPIFY_API_KEY}";
            var redirectUrl = "${embeddedUrl}";

            console.log('[Billing Callback HTML] Initializing App Bridge redirect');
            console.log('[Billing Callback HTML] Shop:', shop);
            console.log('[Billing Callback HTML] Redirect URL:', redirectUrl);

            try {
              // Initialize App Bridge
              var AppBridge = window['app-bridge'];
              var createApp = AppBridge.default;
              var Redirect = AppBridge.actions.Redirect;

              var app = createApp({
                apiKey: apiKey,
                host: "${host}",
                forceRedirect: true
              });

              var redirect = Redirect.create(app);

              // Redirect to the embedded billing page with all parameters
              redirect.dispatch(Redirect.Action.APP, redirectUrl);

              console.log('[Billing Callback HTML] App Bridge redirect dispatched');
            } catch (error) {
              console.error('[Billing Callback HTML] App Bridge redirect failed:', error);

              // Fallback: Direct navigation to embedded URL
              console.log('[Billing Callback HTML] Attempting fallback redirect');
              var embeddedAppUrl = "https://" + shop + "/admin/apps/${process.env.SHOPIFY_API_KEY}" + redirectUrl;
              window.location.href = embeddedAppUrl;
            }
          });
        </script>
      </body>
    </html>
  `;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
};
