import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useFetcher } from "@remix-run/react";
import {
  Page,
  Card,
  Button,
  Text,
  Box,
  BlockStack,
  Banner,
  Badge,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "~/shopify.server";
import { useState, useEffect, useRef } from "react";

interface LogEntry {
  timestamp: string;
  level: "info" | "error" | "success" | "warning";
  step: string;
  message: string;
  data?: any;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  return json({
    shop: session.shop,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const action = formData.get("action");

  const logs: LogEntry[] = [];

  function addLog(level: LogEntry["level"], step: string, message: string, data?: any) {
    const log = {
      timestamp: new Date().toISOString(),
      level,
      step,
      message,
      data
    };
    logs.push(log);
    console.log(`[${level.toUpperCase()}] [${step}] ${message}`, data || '');
  }

  if (action === "test_sync") {
    try {
      addLog("info", "INIT", "Starting order sync test", { shop: session.shop });

      // Step 1: Test GraphQL connection
      addLog("info", "STEP_1", "Testing GraphQL connection...");

      const testQuery = `#graphql
        query {
          shop {
            name
            email
            currencyCode
          }
        }
      `;

      let shopData;
      try {
        const response = await admin.graphql(testQuery);
        const result = await response.json();
        shopData = result.data?.shop;

        if (result.errors) {
          addLog("error", "STEP_1", "GraphQL errors", result.errors);
          return json({ success: false, logs, error: "GraphQL connection failed" });
        }

        addLog("success", "STEP_1", "GraphQL connection successful", shopData);
      } catch (error) {
        addLog("error", "STEP_1", "GraphQL connection failed", error);
        return json({ success: false, logs, error: String(error) });
      }

      // Step 2: Build order query
      addLog("info", "STEP_2", "Building order query...");

      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
      const endDate = new Date();
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const queryParts = [
        `created_at:>=${startDateStr}`,
        `created_at:<=${endDateStr}`,
        `financial_status:paid OR financial_status:partially_refunded OR financial_status:refunded`
      ];
      const query = queryParts.join(' AND ');

      addLog("success", "STEP_2", "Query built", { query, startDate: startDateStr, endDate: endDateStr });

      // Step 3: Fetch first batch of orders
      addLog("info", "STEP_3", "Fetching first batch of orders (limit 5)...");

      const ordersQuery = `#graphql
        query GetOrdersBatch($first: Int!, $query: String) {
          orders(first: $first, query: $query, reverse: true) {
            edges {
              cursor
              node {
                id
                name
                orderNumber
                email
                createdAt
                updatedAt
                currency
                subtotalPrice
                totalDiscounts
                totalShippingPrice
                totalTax
                totalPrice
                totalRefunded
                netPayment
                financialStatus
                fulfillmentStatus
                customer {
                  id
                  email
                  displayName
                }
                lineItems(first: 5) {
                  edges {
                    node {
                      id
                      title
                      quantity
                      price
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;

      let ordersResult;
      try {
        const response = await admin.graphql(ordersQuery, {
          variables: { first: 5, query }
        });
        ordersResult = await response.json();

        if (ordersResult.errors) {
          addLog("error", "STEP_3", "Orders query failed", ordersResult.errors);
          return json({ success: false, logs, error: "Orders query failed" });
        }

        const orders = ordersResult.data?.orders?.edges || [];
        const pageInfo = ordersResult.data?.orders?.pageInfo || {};

        addLog("success", "STEP_3", `Fetched ${orders.length} orders`, {
          orderCount: orders.length,
          hasNextPage: pageInfo.hasNextPage,
          firstOrder: orders[0]?.node?.name
        });

        // Step 4: Analyze orders
        addLog("info", "STEP_4", "Analyzing order data...");

        const orderSummaries = orders.map((edge: any) => {
          const order = edge.node;
          return {
            id: order.id,
            name: order.name,
            email: order.email,
            customer: order.customer?.email || 'Guest',
            total: order.totalPrice,
            currency: order.currency,
            status: order.financialStatus,
            lineItemCount: order.lineItems?.edges?.length || 0,
            hasCustomer: !!order.customer,
            customerId: order.customer?.id
          };
        });

        addLog("success", "STEP_4", "Order analysis complete", {
          totalOrders: orderSummaries.length,
          ordersWithCustomers: orderSummaries.filter(o => o.hasCustomer).length,
          ordersWithoutCustomers: orderSummaries.filter(o => !o.hasCustomer).length,
          samples: orderSummaries.slice(0, 2)
        });

        // Step 5: Test customer lookup
        addLog("info", "STEP_5", "Testing customer lookup in database...");

        const firstOrderWithCustomer = orderSummaries.find(o => o.customerId);

        if (firstOrderWithCustomer) {
          const shopifyCustomerId = firstOrderWithCustomer.customerId.replace('gid://shopify/Customer/', '');

          addLog("info", "STEP_5", "Looking up customer", {
            shopifyCustomerId,
            shop: session.shop
          });

          const { db } = await import("~/db.server");

          const customer = await db.customer.findFirst({
            where: {
              shop: session.shop,
              shopifyCustomerId
            },
            include: {
              currentTier: true
            }
          });

          if (customer) {
            addLog("success", "STEP_5", "Customer found in database", {
              email: customer.email,
              hasTier: !!customer.currentTier,
              tierName: customer.currentTier?.name
            });
          } else {
            addLog("warning", "STEP_5", "Customer NOT found in database", {
              shopifyCustomerId,
              suggestion: "Customer may need to be created first"
            });
          }
        } else {
          addLog("warning", "STEP_5", "No orders with customers found in batch");
        }

        // Step 6: Test order creation (dry run)
        addLog("info", "STEP_6", "Testing order creation (dry run - no actual creation)...");

        if (orders.length > 0) {
          const testOrder = orders[0].node;
          const shopifyOrderId = testOrder.id.replace('gid://shopify/Order/', '');

          const { db } = await import("~/db.server");

          const existingOrder = await db.order.findFirst({
            where: {
              shop: session.shop,
              shopifyOrderId
            }
          });

          if (existingOrder) {
            addLog("info", "STEP_6", "Order already exists in database", {
              orderName: testOrder.name,
              shopifyOrderId,
              existingId: existingOrder.id
            });
          } else {
            addLog("success", "STEP_6", "Order does NOT exist - would be created", {
              orderName: testOrder.name,
              shopifyOrderId,
              totalPrice: testOrder.totalPrice,
              customer: testOrder.customer?.email || 'Guest'
            });
          }
        }

        // Step 7: Rate limit check
        addLog("info", "STEP_7", "Checking API rate limit status...");

        try {
          const rateLimitQuery = `#graphql
            query {
              shop {
                name
              }
            }
          `;

          const start = Date.now();
          const response = await admin.graphql(rateLimitQuery);
          const duration = Date.now() - start;

          // Check response headers for rate limit info
          const costHeader = response.headers.get('X-Shopify-Shop-Api-Call-Limit');

          addLog("success", "STEP_7", "Rate limit check complete", {
            requestDuration: `${duration}ms`,
            rateLimitInfo: costHeader || 'Not available'
          });
        } catch (error) {
          addLog("error", "STEP_7", "Rate limit check failed", error);
        }

        // Final summary
        addLog("success", "COMPLETE", "Test completed successfully", {
          totalSteps: 7,
          ordersFound: orders.length,
          readyForSync: orders.length > 0
        });

        return json({
          success: true,
          logs,
          summary: {
            ordersFound: orders.length,
            orderSummaries: orderSummaries.slice(0, 3),
            pageInfo
          }
        });

      } catch (error) {
        addLog("error", "STEP_3", "Failed to fetch orders", error);
        return json({ success: false, logs, error: String(error) });
      }

    } catch (error) {
      addLog("error", "FATAL", "Test failed with exception", error);
      return json({
        success: false,
        logs,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return json({ success: false, logs, error: "Invalid action" });
}

export default function TestOrderSyncPage() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<any>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const isLoading = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.logs) {
      setLogs(fetcher.data.logs);
    }
  }, [fetcher.data]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleTest = () => {
    setLogs([]);
    const formData = new FormData();
    formData.set("action", "test_sync");
    fetcher.submit(formData, { method: "post" });
  };

  const getLevelColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "success": return "success";
      case "error": return "critical";
      case "warning": return "warning";
      default: return "info";
    }
  };

  return (
    <Page
      title="Order Sync Test"
      subtitle="Debug order sync with detailed logging"
      backAction={{ url: "/app" }}
      primaryAction={{
        content: "Run Test",
        onAction: handleTest,
        disabled: isLoading,
        loading: isLoading
      }}
    >
      <BlockStack gap="400">
        {/* Instructions */}
        <Card>
          <Box padding="400">
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Test Overview</Text>
              <Text as="p">
                This test will verify each step of the order sync process and log detailed information
                to help diagnose any issues.
              </Text>

              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" fontWeight="semibold">Test Steps:</Text>
                <Text as="p">1. Test GraphQL connection</Text>
                <Text as="p">2. Build order query (last 30 days)</Text>
                <Text as="p">3. Fetch first 5 orders</Text>
                <Text as="p">4. Analyze order data</Text>
                <Text as="p">5. Test customer lookup</Text>
                <Text as="p">6. Test order creation (dry run)</Text>
                <Text as="p">7. Check API rate limits</Text>
              </BlockStack>
            </BlockStack>
          </Box>
        </Card>

        {/* Results */}
        {fetcher.data && (
          <Card>
            <Box padding="400">
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Test Results</Text>

                {fetcher.data.success ? (
                  <Banner tone="success" title="Test Completed Successfully">
                    <BlockStack gap="200">
                      {fetcher.data.summary && (
                        <>
                          <Text>Orders found: {fetcher.data.summary.ordersFound}</Text>
                          {fetcher.data.summary.orderSummaries?.length > 0 && (
                            <Text>Sample orders: {fetcher.data.summary.orderSummaries.map((o: any) => o.name).join(', ')}</Text>
                          )}
                        </>
                      )}
                    </BlockStack>
                  </Banner>
                ) : (
                  <Banner tone="critical" title="Test Failed">
                    <Text>{fetcher.data.error}</Text>
                  </Banner>
                )}
              </BlockStack>
            </Box>
          </Card>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <Card>
            <Box padding="400">
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Detailed Logs ({logs.length} entries)</Text>

                <Box
                  background="bg-surface-secondary"
                  padding="400"
                  borderRadius="200"
                  style={{
                    maxHeight: '600px',
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '12px'
                  }}
                >
                  <BlockStack gap="300">
                    {logs.map((log, index) => (
                      <Box key={index}>
                        <BlockStack gap="100">
                          <Box>
                            <Badge tone={getLevelColor(log.level)}>
                              {log.level.toUpperCase()}
                            </Badge>
                            {' '}
                            <Text as="span" fontWeight="semibold">[{log.step}]</Text>
                            {' '}
                            <Text as="span" tone="subdued">{new Date(log.timestamp).toLocaleTimeString()}</Text>
                          </Box>

                          <Text as="p">{log.message}</Text>

                          {log.data && (
                            <Box
                              background="bg-surface"
                              padding="200"
                              borderRadius="100"
                            >
                              <pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                                {JSON.stringify(log.data, null, 2)}
                              </pre>
                            </Box>
                          )}
                        </BlockStack>

                        {index < logs.length - 1 && <Divider />}
                      </Box>
                    ))}
                    <div ref={logsEndRef} />
                  </BlockStack>
                </Box>
              </BlockStack>
            </Box>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
