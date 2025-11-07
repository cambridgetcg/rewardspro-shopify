import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Page, Layout, Card, Text, BlockStack } from "@shopify/polaris";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return json({
    apiUrl: process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://rewardspro-production.vercel.app",
  });
};

export default function ProxyTestPage() {
  const { apiUrl } = useLoaderData<typeof loader>();

  return (
    <Page title="🔬 Proxy Data API Test" subtitle="Test the app proxy endpoint and inspect request/response data">
      <Layout>
        <Layout.Section>
          <div style={{ height: 'calc(100vh - 200px)', minHeight: '800px' }}>
            <iframe
              src="/test-proxy.html"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
              title="Proxy API Test Tool"
            />
          </div>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                How to Use This Tool
              </Text>

              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">
                  <strong>1. Configure Test Parameters:</strong> Enter the shop domain and customer ID you want to test. Defaults are provided.
                </Text>

                <Text as="p" variant="bodyMd">
                  <strong>2. Select Endpoint:</strong> Choose which proxy endpoint to test (membership widget or test endpoint).
                </Text>

                <Text as="p" variant="bodyMd">
                  <strong>3. Run Test:</strong> Click the "Run Test" button to send a request to the proxy endpoint.
                </Text>

                <Text as="p" variant="bodyMd">
                  <strong>4. Inspect Results:</strong> View request details, response statistics, customer data, and raw JSON response.
                </Text>
              </BlockStack>

              <Text as="h2" variant="headingMd">
                What You'll See
              </Text>

              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">
                  • <strong>Request Details:</strong> URL, method, shop domain, customer ID
                </Text>

                <Text as="p" variant="bodyMd">
                  • <strong>Response Statistics:</strong> Query method (AWS Aurora Data API), execution time, database status
                </Text>

                <Text as="p" variant="bodyMd">
                  • <strong>Customer Data:</strong> Store credit, total earned, membership tier, last sync time
                </Text>

                <Text as="p" variant="bodyMd">
                  • <strong>Raw JSON:</strong> Complete response payload for debugging
                </Text>
              </BlockStack>

              <Text as="h2" variant="headingMd">
                Authentication Note
              </Text>

              <Text as="p" variant="bodyMd" tone="caution">
                When testing from this page, the request must go through Shopify's app proxy to include proper HMAC authentication.
                Direct API access without going through the proxy will be rejected with a 401 error.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
