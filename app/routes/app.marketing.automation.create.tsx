import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Select,
  TextField,
  Divider,
  Box,
  InlineGrid,
  ChoiceList,
  RadioButton,
  Banner,
  List,
  Checkbox,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

// ============================================
// TYPES
// ============================================

interface LoaderData {
  shop: string;
}

// ============================================
// LOADER
// ============================================

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  return json<LoaderData>({
    shop: session.shop,
  });
};

// ============================================
// COMPONENT
// ============================================

export default function CreateAutomation() {
  const data = useLoaderData<typeof loader>();
  const [selectedVariation, setSelectedVariation] = useState<string>("all");

  // Shared state for all variations (for demonstration)
  const [automationName, setAutomationName] = useState("");
  const [trigger, setTrigger] = useState("tier_change");
  const [conditions, setConditions] = useState<string[]>([]);
  const [action, setAction] = useState("send_email");
  const [template, setTemplate] = useState("");

  return (
    <Page
      title="Create Automation"
      backAction={{
        content: "Automations",
        url: "/app/marketing/automation/workflows",
      }}
      primaryAction={{
        content: "Save Automation",
        disabled: !automationName,
      }}
    >
      <Layout>
        {/* Variation Selector */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">
                  UI Variations Preview
                </Text>
                <Select
                  label=""
                  labelHidden
                  options={[
                    { label: "Show All Variations", value: "all" },
                    { label: "Option 1: Progress Steps", value: "option1" },
                    { label: "Option 2: Minimal Steps", value: "option2" },
                    { label: "Option 3: Bordered Steps", value: "option3" },
                    { label: "Option 4: Compact Steps", value: "option4" },
                  ]}
                  value={selectedVariation}
                  onChange={setSelectedVariation}
                />
              </InlineStack>
              <Text variant="bodyMd" tone="subdued">
                Choose which UI variation you prefer for creating marketing automations. All options are displayed below.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* OPTION 1: Progress Steps with Numbers */}
        {(selectedVariation === "all" || selectedVariation === "option1") && (
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                {/* Header */}
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="info">Option 1</Badge>
                      <Text variant="headingLg" as="h2">
                        Progress Steps
                      </Text>
                    </InlineStack>
                    <Text variant="bodyMd" tone="subdued">
                      Classic wizard with numbered progress indicators and connector lines
                    </Text>
                  </BlockStack>
                </InlineStack>

                <Divider />

                {/* Progress Steps */}
                <InlineStack gap="300" align="center" blockAlign="center">
                  {/* Step 1 - Completed */}
                  <InlineStack gap="200" blockAlign="center">
                    <div style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: "var(--p-color-bg-fill-success)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: "16px",
                      fontWeight: "600",
                    }}>✓</div>
                    <Text variant="bodyMd" fontWeight="semibold">Setup</Text>
                  </InlineStack>

                  <div style={{ width: "60px", height: "2px", background: "var(--p-color-border)" }} />

                  {/* Step 2 - Active */}
                  <InlineStack gap="200" blockAlign="center">
                    <div style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: "var(--p-color-bg-fill-brand)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: "16px",
                      fontWeight: "600",
                    }}>2</div>
                    <Text variant="bodyMd" fontWeight="semibold">Trigger</Text>
                  </InlineStack>

                  <div style={{ width: "60px", height: "2px", background: "var(--p-color-border)" }} />

                  {/* Step 3 - Upcoming */}
                  <InlineStack gap="200" blockAlign="center">
                    <div style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: "var(--p-color-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--p-color-text-subdued)",
                      fontSize: "16px",
                      fontWeight: "600",
                    }}>3</div>
                    <Text variant="bodyMd" tone="subdued">Action</Text>
                  </InlineStack>

                  <div style={{ width: "60px", height: "2px", background: "var(--p-color-border)" }} />

                  {/* Step 4 - Upcoming */}
                  <InlineStack gap="200" blockAlign="center">
                    <div style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: "var(--p-color-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--p-color-text-subdued)",
                      fontSize: "16px",
                      fontWeight: "600",
                    }}>4</div>
                    <Text variant="bodyMd" tone="subdued">Review</Text>
                  </InlineStack>
                </InlineStack>

                {/* Current Step Content */}
                <Card background="bg-surface-secondary">
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h3">
                      Step 2: Choose Trigger
                    </Text>

                    <Text variant="bodyMd" tone="subdued">
                      Select when this automation should run
                    </Text>

                    <Divider />

                    <BlockStack gap="300">
                      <div onClick={() => setTrigger("tier_change")} style={{ cursor: "pointer" }}>
                        <Card background={trigger === "tier_change" ? "bg-surface-active" : "bg-surface"}>
                          <InlineStack align="space-between" blockAlign="start">
                            <InlineStack gap="300" blockAlign="start">
                              <RadioButton
                                label=""
                                checked={trigger === "tier_change"}
                                onChange={() => setTrigger("tier_change")}
                              />
                              <BlockStack gap="100">
                                <Text variant="headingSm" fontWeight="semibold">
                                  Tier Change
                                </Text>
                                <Text variant="bodySm" tone="subdued">
                                  Triggered when a customer moves to a new tier
                                </Text>
                              </BlockStack>
                            </InlineStack>
                          </InlineStack>
                        </Card>
                      </div>

                      <div onClick={() => setTrigger("purchase")} style={{ cursor: "pointer" }}>
                        <Card background={trigger === "purchase" ? "bg-surface-active" : "bg-surface"}>
                          <InlineStack align="space-between" blockAlign="start">
                            <InlineStack gap="300" blockAlign="start">
                              <RadioButton
                                label=""
                                checked={trigger === "purchase"}
                                onChange={() => setTrigger("purchase")}
                              />
                              <BlockStack gap="100">
                                <Text variant="headingSm" fontWeight="semibold">
                                  Purchase Made
                                </Text>
                                <Text variant="bodySm" tone="subdued">
                                  Triggered after a customer completes a purchase
                                </Text>
                              </BlockStack>
                            </InlineStack>
                          </InlineStack>
                        </Card>
                      </div>

                      <div onClick={() => setTrigger("birthday")} style={{ cursor: "pointer" }}>
                        <Card background={trigger === "birthday" ? "bg-surface-active" : "bg-surface"}>
                          <InlineStack align="space-between" blockAlign="start">
                            <InlineStack gap="300" blockAlign="start">
                              <RadioButton
                                label=""
                                checked={trigger === "birthday"}
                                onChange={() => setTrigger("birthday")}
                              />
                              <BlockStack gap="100">
                                <Text variant="headingSm" fontWeight="semibold">
                                  Customer Birthday
                                </Text>
                                <Text variant="bodySm" tone="subdued">
                                  Triggered on the customer's birthday
                                </Text>
                              </BlockStack>
                            </InlineStack>
                          </InlineStack>
                        </Card>
                      </div>

                      <div onClick={() => setTrigger("inactive")} style={{ cursor: "pointer" }}>
                        <Card background={trigger === "inactive" ? "bg-surface-active" : "bg-surface"}>
                          <InlineStack align="space-between" blockAlign="start">
                            <InlineStack gap="300" blockAlign="start">
                              <RadioButton
                                label=""
                                checked={trigger === "inactive"}
                                onChange={() => setTrigger("inactive")}
                              />
                              <BlockStack gap="100">
                                <Text variant="headingSm" fontWeight="semibold">
                                  Inactive Customer
                                </Text>
                                <Text variant="bodySm" tone="subdued">
                                  Triggered when a customer hasn't purchased in 30+ days
                                </Text>
                              </BlockStack>
                            </InlineStack>
                          </InlineStack>
                        </Card>
                      </div>
                    </BlockStack>
                  </BlockStack>
                </Card>

                {/* Navigation */}
                <InlineStack align="end" gap="300">
                  <Button>Back</Button>
                  <Button variant="primary">Next: Choose Action</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* OPTION 2: Minimal Steps */}
        {(selectedVariation === "all" || selectedVariation === "option2") && (
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                {/* Header */}
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="success">Option 2</Badge>
                      <Text variant="headingLg" as="h2">
                        Minimal Steps
                      </Text>
                    </InlineStack>
                    <Text variant="bodyMd" tone="subdued">
                      Clean, text-focused design with subtle progress indication
                    </Text>
                  </BlockStack>
                </InlineStack>

                <Divider />

                {/* Progress Steps - Minimal */}
                <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                  <InlineStack gap="600" align="center">
                    <BlockStack gap="100">
                      <Text variant="bodySm" tone="subdued">Step 1 of 4</Text>
                      <Text variant="headingSm" fontWeight="semibold">Setup</Text>
                      <Badge tone="success">Completed</Badge>
                    </BlockStack>

                    <BlockStack gap="100">
                      <Text variant="bodySm" tone="subdued">Step 2 of 4</Text>
                      <Text variant="headingSm" fontWeight="semibold">Trigger</Text>
                      <Badge tone="info">In Progress</Badge>
                    </BlockStack>

                    <BlockStack gap="100">
                      <Text variant="bodySm" tone="subdued">Step 3 of 4</Text>
                      <Text variant="headingSm" tone="subdued">Action</Text>
                      <Badge>Not Started</Badge>
                    </BlockStack>

                    <BlockStack gap="100">
                      <Text variant="bodySm" tone="subdued">Step 4 of 4</Text>
                      <Text variant="headingSm" tone="subdued">Review</Text>
                      <Badge>Not Started</Badge>
                    </BlockStack>
                  </InlineStack>
                </Box>

                {/* Current Step Content */}
                <BlockStack gap="400">
                  <BlockStack gap="200">
                    <Text variant="headingLg" as="h2">
                      Choose Trigger
                    </Text>
                    <Text variant="bodyMd" tone="subdued">
                      Select the event that will start this automation
                    </Text>
                  </BlockStack>

                  <Divider />

                  <BlockStack gap="300">
                    <div onClick={() => setTrigger("tier_change")} style={{ cursor: "pointer" }}>
                      <Box
                        padding="400"
                        background={trigger === "tier_change" ? "bg-surface-active" : "bg-surface"}
                        borderRadius="200"
                        borderWidth="025"
                        borderColor={trigger === "tier_change" ? "border-brand" : "border"}
                      >
                        <InlineStack gap="300" blockAlign="start">
                          <RadioButton
                            label=""
                            checked={trigger === "tier_change"}
                            onChange={() => setTrigger("tier_change")}
                          />
                          <BlockStack gap="100">
                            <Text variant="headingSm" fontWeight="semibold">
                              Tier Change
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                              Triggered when a customer moves to a new tier
                            </Text>
                          </BlockStack>
                        </InlineStack>
                      </Box>
                    </div>

                    <div onClick={() => setTrigger("purchase")} style={{ cursor: "pointer" }}>
                      <Box
                        padding="400"
                        background={trigger === "purchase" ? "bg-surface-active" : "bg-surface"}
                        borderRadius="200"
                        borderWidth="025"
                        borderColor={trigger === "purchase" ? "border-brand" : "border"}
                      >
                        <InlineStack gap="300" blockAlign="start">
                          <RadioButton
                            label=""
                            checked={trigger === "purchase"}
                            onChange={() => setTrigger("purchase")}
                          />
                          <BlockStack gap="100">
                            <Text variant="headingSm" fontWeight="semibold">
                              Purchase Made
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                              Triggered after a customer completes a purchase
                            </Text>
                          </BlockStack>
                        </InlineStack>
                      </Box>
                    </div>

                    <div onClick={() => setTrigger("birthday")} style={{ cursor: "pointer" }}>
                      <Box
                        padding="400"
                        background={trigger === "birthday" ? "bg-surface-active" : "bg-surface"}
                        borderRadius="200"
                        borderWidth="025"
                        borderColor={trigger === "birthday" ? "border-brand" : "border"}
                      >
                        <InlineStack gap="300" blockAlign="start">
                          <RadioButton
                            label=""
                            checked={trigger === "birthday"}
                            onChange={() => setTrigger("birthday")}
                          />
                          <BlockStack gap="100">
                            <Text variant="headingSm" fontWeight="semibold">
                              Customer Birthday
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                              Triggered on the customer's birthday
                            </Text>
                          </BlockStack>
                        </InlineStack>
                      </Box>
                    </div>

                    <div onClick={() => setTrigger("inactive")} style={{ cursor: "pointer" }}>
                      <Box
                        padding="400"
                        background={trigger === "inactive" ? "bg-surface-active" : "bg-surface"}
                        borderRadius="200"
                        borderWidth="025"
                        borderColor={trigger === "inactive" ? "border-brand" : "border"}
                      >
                        <InlineStack gap="300" blockAlign="start">
                          <RadioButton
                            label=""
                            checked={trigger === "inactive"}
                            onChange={() => setTrigger("inactive")}
                          />
                          <BlockStack gap="100">
                            <Text variant="headingSm" fontWeight="semibold">
                              Inactive Customer
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                              Triggered when a customer hasn't purchased in 30+ days
                            </Text>
                          </BlockStack>
                        </InlineStack>
                      </Box>
                    </div>
                  </BlockStack>
                </BlockStack>

                {/* Navigation */}
                <Divider />
                <InlineStack align="space-between">
                  <Button>Back to Setup</Button>
                  <InlineStack gap="300">
                    <Button>Save Draft</Button>
                    <Button variant="primary">Continue to Action</Button>
                  </InlineStack>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* OPTION 3: Bordered Steps */}
        {(selectedVariation === "all" || selectedVariation === "option3") && (
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                {/* Header */}
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="warning">Option 3</Badge>
                      <Text variant="headingLg" as="h2">
                        Bordered Steps
                      </Text>
                    </InlineStack>
                    <Text variant="bodyMd" tone="subdued">
                      Card-based steps with clear visual separation and status colors
                    </Text>
                  </BlockStack>
                </InlineStack>

                <Divider />

                {/* Progress Steps - Bordered Cards */}
                <InlineGrid columns={4} gap="300">
                  <Card background="bg-surface-success-subdued">
                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="bodyMd" fontWeight="semibold">Step 1</Text>
                        <Badge tone="success">Done</Badge>
                      </InlineStack>
                      <Text variant="headingSm">Setup</Text>
                      <Text variant="bodySm" tone="subdued">
                        Basic information
                      </Text>
                    </BlockStack>
                  </Card>

                  <Card background="bg-surface-brand-subdued">
                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="bodyMd" fontWeight="semibold">Step 2</Text>
                        <Badge tone="info">Active</Badge>
                      </InlineStack>
                      <Text variant="headingSm">Trigger</Text>
                      <Text variant="bodySm" tone="subdued">
                        When to run
                      </Text>
                    </BlockStack>
                  </Card>

                  <Card>
                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="bodyMd" fontWeight="semibold" tone="subdued">Step 3</Text>
                        <Badge>Pending</Badge>
                      </InlineStack>
                      <Text variant="headingSm" tone="subdued">Action</Text>
                      <Text variant="bodySm" tone="subdued">
                        What to do
                      </Text>
                    </BlockStack>
                  </Card>

                  <Card>
                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="bodyMd" fontWeight="semibold" tone="subdued">Step 4</Text>
                        <Badge>Pending</Badge>
                      </InlineStack>
                      <Text variant="headingSm" tone="subdued">Review</Text>
                      <Text variant="bodySm" tone="subdued">
                        Confirm & launch
                      </Text>
                    </BlockStack>
                  </Card>
                </InlineGrid>

                {/* Current Step Content */}
                <Card background="bg-surface-secondary">
                  <BlockStack gap="500">
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingLg" as="h2">
                          Select Trigger Event
                        </Text>
                        <Text variant="bodyMd" tone="subdued">
                          Step 2 of 4
                        </Text>
                      </InlineStack>
                      <Text variant="bodyMd" tone="subdued">
                        Choose the event that will activate this automation workflow
                      </Text>
                    </BlockStack>

                    <Divider />

                    <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                      <div onClick={() => setTrigger("tier_change")} style={{ cursor: "pointer" }}>
                        <Card background={trigger === "tier_change" ? "bg-surface-brand" : "bg-surface"}>
                          <BlockStack gap="300">
                            <InlineStack gap="300" blockAlign="start">
                              <RadioButton
                                label=""
                                checked={trigger === "tier_change"}
                                onChange={() => setTrigger("tier_change")}
                              />
                              <BlockStack gap="200">
                                <Text variant="headingSm" fontWeight="semibold">
                                  Tier Change
                                </Text>
                                <Text variant="bodySm" tone="subdued">
                                  Triggered when a customer moves to a new tier
                                </Text>
                              </BlockStack>
                            </InlineStack>
                          </BlockStack>
                        </Card>
                      </div>

                      <div onClick={() => setTrigger("purchase")} style={{ cursor: "pointer" }}>
                        <Card background={trigger === "purchase" ? "bg-surface-brand" : "bg-surface"}>
                          <BlockStack gap="300">
                            <InlineStack gap="300" blockAlign="start">
                              <RadioButton
                                label=""
                                checked={trigger === "purchase"}
                                onChange={() => setTrigger("purchase")}
                              />
                              <BlockStack gap="200">
                                <Text variant="headingSm" fontWeight="semibold">
                                  Purchase Made
                                </Text>
                                <Text variant="bodySm" tone="subdued">
                                  Triggered after a customer completes a purchase
                                </Text>
                              </BlockStack>
                            </InlineStack>
                          </BlockStack>
                        </Card>
                      </div>

                      <div onClick={() => setTrigger("birthday")} style={{ cursor: "pointer" }}>
                        <Card background={trigger === "birthday" ? "bg-surface-brand" : "bg-surface"}>
                          <BlockStack gap="300">
                            <InlineStack gap="300" blockAlign="start">
                              <RadioButton
                                label=""
                                checked={trigger === "birthday"}
                                onChange={() => setTrigger("birthday")}
                              />
                              <BlockStack gap="200">
                                <Text variant="headingSm" fontWeight="semibold">
                                  Customer Birthday
                                </Text>
                                <Text variant="bodySm" tone="subdued">
                                  Triggered on the customer's birthday
                                </Text>
                              </BlockStack>
                            </InlineStack>
                          </BlockStack>
                        </Card>
                      </div>

                      <div onClick={() => setTrigger("inactive")} style={{ cursor: "pointer" }}>
                        <Card background={trigger === "inactive" ? "bg-surface-brand" : "bg-surface"}>
                          <BlockStack gap="300">
                            <InlineStack gap="300" blockAlign="start">
                              <RadioButton
                                label=""
                                checked={trigger === "inactive"}
                                onChange={() => setTrigger("inactive")}
                              />
                              <BlockStack gap="200">
                                <Text variant="headingSm" fontWeight="semibold">
                                  Inactive Customer
                                </Text>
                                <Text variant="bodySm" tone="subdued">
                                  Triggered when a customer hasn't purchased in 30+ days
                                </Text>
                              </BlockStack>
                            </InlineStack>
                          </BlockStack>
                        </Card>
                      </div>
                    </InlineGrid>
                  </BlockStack>
                </Card>

                {/* Navigation */}
                <Divider />
                <InlineStack align="space-between">
                  <Text variant="bodyMd" tone="subdued">
                    2 of 4 steps completed
                  </Text>
                  <InlineStack gap="300">
                    <Button>Previous</Button>
                    <Button variant="primary">Next Step</Button>
                  </InlineStack>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* OPTION 4: Compact Steps */}
        {(selectedVariation === "all" || selectedVariation === "option4") && (
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                {/* Header */}
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="attention">Option 4</Badge>
                      <Text variant="headingLg" as="h2">
                        Compact Steps
                      </Text>
                    </InlineStack>
                    <Text variant="bodyMd" tone="subdued">
                      Space-efficient inline layout with progress bar
                    </Text>
                  </BlockStack>
                </InlineStack>

                <Divider />

                {/* Compact Progress */}
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="600">
                      <Text variant="bodySm" fontWeight="semibold">1. Setup ✓</Text>
                      <Text variant="bodySm" fontWeight="semibold" tone="info">2. Trigger →</Text>
                      <Text variant="bodySm" tone="subdued">3. Action</Text>
                      <Text variant="bodySm" tone="subdued">4. Review</Text>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued">50% Complete</Text>
                  </InlineStack>

                  <div style={{
                    width: "100%",
                    height: "8px",
                    background: "var(--p-color-bg-fill-tertiary)",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      width: "50%",
                      height: "100%",
                      background: "var(--p-color-bg-fill-brand)",
                    }} />
                  </div>
                </BlockStack>

                {/* Current Step Content */}
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="headingLg" as="h2">
                      Trigger Event
                    </Text>
                    <Badge tone="info">Step 2</Badge>
                  </InlineStack>

                  <Banner>
                    Select the event that will start this automation. You can add conditions in the next step to further refine when it runs.
                  </Banner>

                  <BlockStack gap="200">
                    <div onClick={() => setTrigger("tier_change")} style={{ cursor: "pointer" }}>
                      <Box
                        padding="300"
                        background={trigger === "tier_change" ? "bg-surface-brand-subdued" : "bg-surface"}
                        borderRadius="200"
                      >
                        <InlineStack gap="200" blockAlign="center">
                          <RadioButton
                            label=""
                            checked={trigger === "tier_change"}
                            onChange={() => setTrigger("tier_change")}
                          />
                          <BlockStack gap="050">
                            <Text variant="bodyMd" fontWeight="semibold">
                              Tier Change
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                              When a customer moves to a new tier
                            </Text>
                          </BlockStack>
                        </InlineStack>
                      </Box>
                    </div>

                    <div onClick={() => setTrigger("purchase")} style={{ cursor: "pointer" }}>
                      <Box
                        padding="300"
                        background={trigger === "purchase" ? "bg-surface-brand-subdued" : "bg-surface"}
                        borderRadius="200"
                      >
                        <InlineStack gap="200" blockAlign="center">
                          <RadioButton
                            label=""
                            checked={trigger === "purchase"}
                            onChange={() => setTrigger("purchase")}
                          />
                          <BlockStack gap="050">
                            <Text variant="bodyMd" fontWeight="semibold">
                              Purchase Made
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                              After a customer completes a purchase
                            </Text>
                          </BlockStack>
                        </InlineStack>
                      </Box>
                    </div>

                    <div onClick={() => setTrigger("birthday")} style={{ cursor: "pointer" }}>
                      <Box
                        padding="300"
                        background={trigger === "birthday" ? "bg-surface-brand-subdued" : "bg-surface"}
                        borderRadius="200"
                      >
                        <InlineStack gap="200" blockAlign="center">
                          <RadioButton
                            label=""
                            checked={trigger === "birthday"}
                            onChange={() => setTrigger("birthday")}
                          />
                          <BlockStack gap="050">
                            <Text variant="bodyMd" fontWeight="semibold">
                              Customer Birthday
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                              On the customer's birthday
                            </Text>
                          </BlockStack>
                        </InlineStack>
                      </Box>
                    </div>

                    <div onClick={() => setTrigger("inactive")} style={{ cursor: "pointer" }}>
                      <Box
                        padding="300"
                        background={trigger === "inactive" ? "bg-surface-brand-subdued" : "bg-surface"}
                        borderRadius="200"
                      >
                        <InlineStack gap="200" blockAlign="center">
                          <RadioButton
                            label=""
                            checked={trigger === "inactive"}
                            onChange={() => setTrigger("inactive")}
                          />
                          <BlockStack gap="050">
                            <Text variant="bodyMd" fontWeight="semibold">
                              Inactive Customer
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                              When a customer hasn't purchased in 30+ days
                            </Text>
                          </BlockStack>
                        </InlineStack>
                      </Box>
                    </div>
                  </BlockStack>
                </BlockStack>

                {/* Navigation */}
                <Divider />
                <InlineStack align="end" gap="200">
                  <Button>Back</Button>
                  <Button variant="primary">Next</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
