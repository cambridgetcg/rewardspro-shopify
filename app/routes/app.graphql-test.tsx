import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import {
  Page,
  Card,
  TextField,
  Button,
  BlockStack,
  Box,
  Text,
  Badge,
  Divider,
  InlineStack,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "~/shopify.server";

interface GraphQLResponse {
  data?: any;
  errors?: any[];
  extensions?: any;
}

/**
 * GraphQL Admin API Test Page
 * Allows testing GraphQL queries directly against the Shopify Admin API
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Provide some example queries
  const exampleQueries = {
    "Shop Info": `{
  shop {
    name
    email
    myshopifyDomain
    plan {
      displayName
      partnerDevelopment
      shopifyPlus
    }
    currencyCode
  }
}`,
    "Create Pro Subscription": `mutation CreateProSubscription {
  appSubscriptionCreate(
    name: "RewardsPro Pro"
    returnUrl: "${process.env.SHOPIFY_APP_URL || 'https://rewardspro-production.vercel.app'}/app/billing/callback?shop=${session.shop}&plan=pro"
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            interval: EVERY_30_DAYS
            price: {
              amount: 39.00
              currencyCode: USD
            }
          }
        }
      }
      {
        plan: {
          appUsagePricingDetails: {
            terms: "$10 per 100 additional orders over 500 orders/month (max $200/month)"
            cappedAmount: {
              amount: 200.00
              currencyCode: USD
            }
          }
        }
      }
    ]
    trialDays: 7
    test: true
  ) {
    confirmationUrl
    appSubscription {
      id
      status
      currentPeriodEnd
      lineItems {
        id
        plan {
          pricingDetails {
            __typename
            ... on AppRecurringPricing {
              price {
                amount
                currencyCode
              }
              interval
            }
            ... on AppUsagePricing {
              cappedAmount {
                amount
                currencyCode
              }
              terms
            }
          }
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}`,
    "Create Pro Annual Subscription": `mutation CreateProAnnualSubscription {
  appSubscriptionCreate(
    name: "RewardsPro Pro Annual"
    returnUrl: "${process.env.SHOPIFY_APP_URL || 'https://rewardspro-production.vercel.app'}/app/billing/callback?shop=${session.shop}&plan=proAnnual"
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            interval: ANNUAL
            price: {
              amount: 336.00
              currencyCode: USD
            }
          }
        }
      }
      {
        plan: {
          appUsagePricingDetails: {
            terms: "$10 per 100 additional orders over 500 orders/month (max $200/month)"
            cappedAmount: {
              amount: 200.00
              currencyCode: USD
            }
          }
        }
      }
    ]
    trialDays: 7
    test: true
  ) {
    confirmationUrl
    appSubscription {
      id
      status
      currentPeriodEnd
    }
    userErrors {
      field
      message
    }
  }
}`,
    "Create Max Subscription": `mutation CreateMaxSubscription {
  appSubscriptionCreate(
    name: "RewardsPro Max"
    returnUrl: "${process.env.SHOPIFY_APP_URL || 'https://rewardspro-production.vercel.app'}/app/billing/callback?shop=${session.shop}&plan=max"
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            interval: EVERY_30_DAYS
            price: {
              amount: 149.00
              currencyCode: USD
            }
          }
        }
      }
      {
        plan: {
          appUsagePricingDetails: {
            terms: "$5 per 100 additional orders over 2,000 orders/month (max $500/month)"
            cappedAmount: {
              amount: 500.00
              currencyCode: USD
            }
          }
        }
      }
    ]
    trialDays: 7
    test: true
  ) {
    confirmationUrl
    appSubscription {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}`,
    "Create Max Annual Subscription": `mutation CreateMaxAnnualSubscription {
  appSubscriptionCreate(
    name: "RewardsPro Max Annual"
    returnUrl: "${process.env.SHOPIFY_APP_URL || 'https://rewardspro-production.vercel.app'}/app/billing/callback?shop=${session.shop}&plan=maxAnnual"
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            interval: ANNUAL
            price: {
              amount: 1296.00
              currencyCode: USD
            }
          }
        }
      }
      {
        plan: {
          appUsagePricingDetails: {
            terms: "$5 per 100 additional orders over 2,000 orders/month (max $500/month)"
            cappedAmount: {
              amount: 500.00
              currencyCode: USD
            }
          }
        }
      }
    ]
    trialDays: 7
    test: true
  ) {
    confirmationUrl
    appSubscription {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}`,
    "Create Ultra Subscription": `mutation CreateUltraSubscription {
  appSubscriptionCreate(
    name: "RewardsPro Ultra"
    returnUrl: "${process.env.SHOPIFY_APP_URL || 'https://rewardspro-production.vercel.app'}/app/billing/callback?shop=${session.shop}&plan=ultra"
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            interval: EVERY_30_DAYS
            price: {
              amount: 499.00
              currencyCode: USD
            }
          }
        }
      }
    ]
    trialDays: 14
    test: true
  ) {
    confirmationUrl
    appSubscription {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}`,
    "Create Ultra Annual Subscription": `mutation CreateUltraAnnualSubscription {
  appSubscriptionCreate(
    name: "RewardsPro Ultra Annual"
    returnUrl: "${process.env.SHOPIFY_APP_URL || 'https://rewardspro-production.vercel.app'}/app/billing/callback?shop=${session.shop}&plan=ultraAnnual"
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            interval: ANNUAL
            price: {
              amount: 4296.00
              currencyCode: USD
            }
          }
        }
      }
    ]
    trialDays: 14
    test: true
  ) {
    confirmationUrl
    appSubscription {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}`,
    "Get Active Subscriptions": `{
  currentAppInstallation {
    activeSubscriptions {
      id
      name
      status
      currentPeriodEnd
      test
      lineItems {
        id
        plan {
          pricingDetails {
            __typename
            ... on AppRecurringPricing {
              price {
                amount
                currencyCode
              }
              interval
            }
            ... on AppUsagePricing {
              cappedAmount {
                amount
                currencyCode
              }
              terms
            }
          }
        }
      }
    }
  }
}`,
    "Cancel Subscription": `mutation CancelSubscription($id: ID!) {
  appSubscriptionCancel(id: $id, prorate: false) {
    appSubscription {
      id
      name
      status
    }
    userErrors {
      field
      message
    }
  }
}

# Replace YOUR_SUBSCRIPTION_ID with the actual subscription ID
# Example: gid://shopify/AppSubscription/106181230976
# Note: prorate is always false (no refunds for unused time)`,
    "Customer List": `{
  customers(first: 5) {
    edges {
      node {
        id
        firstName
        lastName
        email
        createdAt
      }
    }
  }
}`,
    "Product List": `{
  products(first: 5) {
    edges {
      node {
        id
        title
        handle
        status
        totalInventory
        priceRangeV2 {
          minVariantPrice {
            amount
            currencyCode
          }
        }
      }
    }
  }
}`,
    "Order List": `{
  orders(first: 5) {
    edges {
      node {
        id
        name
        email
        createdAt
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        lineItems(first: 3) {
          edges {
            node {
              title
              quantity
            }
          }
        }
      }
    }
  }
}`,
    "Metafield Definitions": `{
  metafieldDefinitions(first: 10, ownerType: CUSTOMER) {
    edges {
      node {
        id
        name
        namespace
        key
        type {
          name
        }
      }
    }
  }
}`,
  };

  return json({
    shop: session.shop,
    exampleQueries,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);

  if (!session?.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const query = formData.get("query") as string;

  if (!query || query.trim() === "") {
    return json({
      error: "Please enter a GraphQL query",
      executionTime: 0,
    });
  }

  try {
    const startTime = Date.now();

    // Execute the GraphQL query
    const response = await admin.graphql(query);
    const responseData: GraphQLResponse = await response.json();

    const executionTime = Date.now() - startTime;

    return json({
      response: responseData,
      executionTime,
      query,
      shop: session.shop,
    });
  } catch (error: any) {
    return json({
      error: error.message || "Failed to execute GraphQL query",
      executionTime: 0,
      query,
    });
  }
}

export default function GraphQLTestPage() {
  const { shop, exampleQueries } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [query, setQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadExampleQuery = (exampleQuery: string) => {
    setQuery(exampleQuery);
  };

  return (
    <Page
      title="GraphQL Admin API Test"
      subtitle={`Testing GraphQL queries for ${shop}`}
    >
      <BlockStack gap="400">
        {/* Example Queries Card */}
        <Card>
          <Box padding="400">
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Example Queries</Text>
              <Text as="p" tone="subdued">
                Click any example to load it into the query editor
              </Text>
              <Divider />
              <BlockStack gap="200">
                {Object.entries(exampleQueries).map(([name, exampleQuery]) => (
                  <Button
                    key={name}
                    onClick={() => loadExampleQuery(exampleQuery)}
                    textAlign="left"
                  >
                    {name}
                  </Button>
                ))}
              </BlockStack>
            </BlockStack>
          </Box>
        </Card>

        {/* Query Editor Card */}
        <Card>
          <Box padding="400">
            <Form method="post" onSubmit={() => setIsSubmitting(true)}>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">GraphQL Query</Text>

                <TextField
                  label="Query"
                  value={query}
                  onChange={setQuery}
                  multiline={12}
                  autoComplete="off"
                  placeholder="Enter your GraphQL query here..."
                  name="query"
                  helpText="Enter a valid GraphQL query to test against the Shopify Admin API"
                  monospaced
                />

                <InlineStack align="end">
                  <Button
                    submit
                    variant="primary"
                    loading={isSubmitting}
                    disabled={!query.trim()}
                  >
                    Execute Query
                  </Button>
                </InlineStack>
              </BlockStack>
            </Form>
          </Box>
        </Card>

        {/* Results Card */}
        {actionData && (
          <Card>
            <Box padding="400">
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Response</Text>
                  <InlineStack gap="200">
                    {actionData.executionTime > 0 && (
                      <Badge tone="info">
                        {actionData.executionTime}ms
                      </Badge>
                    )}
                    {actionData.error && (
                      <Badge tone="critical">Error</Badge>
                    )}
                    {actionData.response?.data && !actionData.response?.errors && (
                      <Badge tone="success">Success</Badge>
                    )}
                    {actionData.response?.errors && (
                      <Badge tone="warning">GraphQL Errors</Badge>
                    )}
                  </InlineStack>
                </InlineStack>

                <Divider />

                {actionData.error && (
                  <Box padding="400" background="bg-fill-critical-secondary">
                    <BlockStack gap="200">
                      <Text as="p" fontWeight="semibold">Error:</Text>
                      <Text as="p" tone="critical">{actionData.error}</Text>
                    </BlockStack>
                  </Box>
                )}

                {actionData.response && (
                  <BlockStack gap="400">
                    {actionData.response.errors && (
                      <Box padding="400" background="bg-fill-warning-secondary">
                        <BlockStack gap="200">
                          <Text as="p" fontWeight="semibold">GraphQL Errors:</Text>
                          <pre style={{
                            overflow: 'auto',
                            fontSize: '12px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}>
                            {JSON.stringify(actionData.response.errors, null, 2)}
                          </pre>
                        </BlockStack>
                      </Box>
                    )}

                    {actionData.response.data && (
                      <Box padding="400" background="bg-fill-success-secondary">
                        <BlockStack gap="200">
                          <Text as="p" fontWeight="semibold">Data:</Text>
                          <pre style={{
                            overflow: 'auto',
                            fontSize: '12px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            maxHeight: '500px'
                          }}>
                            {JSON.stringify(actionData.response.data, null, 2)}
                          </pre>
                        </BlockStack>
                      </Box>
                    )}

                    {actionData.response.extensions && (
                      <Box padding="400" background="bg-fill-info-secondary">
                        <BlockStack gap="200">
                          <Text as="p" fontWeight="semibold">Extensions:</Text>
                          <pre style={{
                            overflow: 'auto',
                            fontSize: '12px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}>
                            {JSON.stringify(actionData.response.extensions, null, 2)}
                          </pre>
                        </BlockStack>
                      </Box>
                    )}
                  </BlockStack>
                )}
              </BlockStack>
            </Box>
          </Card>
        )}

        {/* API Information Card */}
        <Card>
          <Box padding="400">
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">API Information</Text>
              <Divider />
              <BlockStack gap="300">
                <InlineStack gap="200">
                  <Text as="span" fontWeight="semibold">Shop:</Text>
                  <Text as="span">{shop}</Text>
                </InlineStack>
                <InlineStack gap="200">
                  <Text as="span" fontWeight="semibold">API:</Text>
                  <Text as="span">Shopify Admin GraphQL API</Text>
                </InlineStack>
                <Text as="p" tone="subdued">
                  Learn more about the Shopify Admin API at{' '}
                  <a
                    href="https://shopify.dev/docs/api/admin-graphql"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit' }}
                  >
                    shopify.dev/docs/api/admin-graphql
                  </a>
                </Text>
              </BlockStack>
            </BlockStack>
          </Box>
        </Card>
      </BlockStack>
    </Page>
  );
}

export function ErrorBoundary() {
  return (
    <Page title="GraphQL Test">
      <Card>
        <Box padding="400">
          <BlockStack gap="300">
            <Badge tone="critical">Error</Badge>
            <Text as="p">Failed to load GraphQL test page. Please try refreshing the page.</Text>
          </BlockStack>
        </Box>
      </Card>
    </Page>
  );
}
