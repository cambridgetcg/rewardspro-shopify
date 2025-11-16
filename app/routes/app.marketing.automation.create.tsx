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
  Icon,
  Box,
  InlineGrid,
  ChoiceList,
  RadioButton,
  Banner,
  List,
  Checkbox,
} from "@shopify/polaris";
import {
  ArrowLeftIcon,
  PlusIcon,
  EmailIcon,
  ClockIcon,
  PersonIcon,
  HashtagIcon,
  ChartVerticalIcon,
  CheckCircleIcon,
  CalendarIcon,
  RefreshIcon,
  AlertCircleIcon,
} from "~/utils/polaris-icons";
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
                    { label: "Option 1: Wizard Flow", value: "wizard" },
                    { label: "Option 2: Card Builder", value: "cards" },
                    { label: "Option 3: Visual Flow", value: "visual" },
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

        {/* VARIATION 1: Wizard/Step-by-step Flow */}
        {(selectedVariation === "all" || selectedVariation === "wizard") && (
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                {/* Header */}
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="info">Option 1</Badge>
                      <Text variant="headingLg" as="h2">
                        Wizard Flow
                      </Text>
                    </InlineStack>
                    <Text variant="bodyMd" tone="subdued">
                      Step-by-step guided experience with progress tracking
                    </Text>
                  </BlockStack>
                </InlineStack>

                <Divider />

                {/* Progress Steps */}
                <InlineStack gap="400" align="start">
                  <InlineStack gap="200" blockAlign="center">
                    <div style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "var(--p-color-bg-fill-success)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <Icon source={CheckCircleIcon} tone="success" />
                    </div>
                    <Text variant="bodyMd" fontWeight="semibold">Setup</Text>
                  </InlineStack>
                  <div style={{ flex: 1, height: "2px", background: "var(--p-color-border)", marginTop: "16px" }} />
                  <InlineStack gap="200" blockAlign="center">
                    <div style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "var(--p-color-bg-fill-brand)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}>2</div>
                    <Text variant="bodyMd" fontWeight="semibold">Trigger</Text>
                  </InlineStack>
                  <div style={{ flex: 1, height: "2px", background: "var(--p-color-border)", marginTop: "16px" }} />
                  <InlineStack gap="200" blockAlign="center">
                    <div style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "var(--p-color-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--p-color-text-subdued)",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}>3</div>
                    <Text variant="bodyMd" tone="subdued">Action</Text>
                  </InlineStack>
                  <div style={{ flex: 1, height: "2px", background: "var(--p-color-border)", marginTop: "16px" }} />
                  <InlineStack gap="200" blockAlign="center">
                    <div style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "var(--p-color-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--p-color-text-subdued)",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}>4</div>
                    <Text variant="bodyMd" tone="subdued">Review</Text>
                  </InlineStack>
                </InlineStack>

                {/* Current Step Content */}
                <Card background="bg-surface-secondary">
                  <BlockStack gap="400">
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={ClockIcon} />
                      <Text variant="headingMd" as="h3">
                        Step 2: Choose Trigger
                      </Text>
                    </InlineStack>

                    <Text variant="bodyMd" tone="subdued">
                      Select when this automation should run
                    </Text>

                    <Divider />

                    <BlockStack gap="300">
                      <div onClick={() => setTrigger("tier_change")} style={{ cursor: "pointer" }}>
                        <Card background={trigger === "tier_change" ? "bg-surface-brand" : "bg-surface"}>
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
                            <Icon source={ChartVerticalIcon} />
                          </InlineStack>
                        </Card>
                      </div>

                      <div onClick={() => setTrigger("purchase")} style={{ cursor: "pointer" }}>
                        <Card background={trigger === "purchase" ? "bg-surface-brand" : "bg-surface"}>
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
                            <Icon source={CheckCircleIcon} />
                          </InlineStack>
                        </Card>
                      </div>

                      <div onClick={() => setTrigger("birthday")} style={{ cursor: "pointer" }}>
                        <Card background={trigger === "birthday" ? "bg-surface-brand" : "bg-surface"}>
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
                            <Icon source={CalendarIcon} />
                          </InlineStack>
                        </Card>
                      </div>

                      <div onClick={() => setTrigger("inactive")} style={{ cursor: "pointer" }}>
                        <Card background={trigger === "inactive" ? "bg-surface-brand" : "bg-surface"}>
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
                            <Icon source={RefreshIcon} />
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

        {/* VARIATION 2: Card-based Builder */}
        {(selectedVariation === "all" || selectedVariation === "cards") && (
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                {/* Header */}
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="success">Option 2</Badge>
                      <Text variant="headingLg" as="h2">
                        Card Builder
                      </Text>
                    </InlineStack>
                    <Text variant="bodyMd" tone="subdued">
                      All-in-one view with expandable sections for quick configuration
                    </Text>
                  </BlockStack>
                </InlineStack>

                <Divider />

                {/* All sections visible */}
                <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                  {/* Left Column */}
                  <BlockStack gap="400">
                    {/* Basic Info Card */}
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="400">
                        <InlineStack gap="200" blockAlign="center">
                          <Icon source={HashtagIcon} />
                          <Text variant="headingMd" as="h3">
                            Basic Information
                          </Text>
                        </InlineStack>
                        <TextField
                          label="Automation Name"
                          value={automationName}
                          onChange={setAutomationName}
                          placeholder="e.g., Welcome New VIP Members"
                          autoComplete="off"
                        />
                        <TextField
                          label="Description"
                          value=""
                          onChange={() => {}}
                          placeholder="Brief description of what this automation does"
                          multiline={3}
                          autoComplete="off"
                        />
                      </BlockStack>
                    </Card>

                    {/* Trigger Card */}
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="400">
                        <InlineStack gap="200" blockAlign="center">
                          <Icon source={ClockIcon} />
                          <Text variant="headingMd" as="h3">
                            Trigger Event
                          </Text>
                        </InlineStack>
                        <Select
                          label="When should this run?"
                          options={[
                            { label: "Customer tier changes", value: "tier_change" },
                            { label: "Purchase completed", value: "purchase" },
                            { label: "Customer birthday", value: "birthday" },
                            { label: "Inactive for 30+ days", value: "inactive" },
                            { label: "Cashback earned", value: "cashback" },
                            { label: "Points milestone reached", value: "points" },
                          ]}
                          value={trigger}
                          onChange={setTrigger}
                        />
                        {trigger === "tier_change" && (
                          <Banner>
                            <List>
                              <List.Item>Triggers when customer enters a new tier</List.Item>
                              <List.Item>Includes upgrades and downgrades</List.Item>
                              <List.Item>Filters can be applied below</List.Item>
                            </List>
                          </Banner>
                        )}
                      </BlockStack>
                    </Card>

                    {/* Conditions Card */}
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="400">
                        <InlineStack gap="200" blockAlign="center">
                          <Icon source={PersonIcon} />
                          <Text variant="headingMd" as="h3">
                            Conditions (Optional)
                          </Text>
                        </InlineStack>
                        <Text variant="bodySm" tone="subdued">
                          Add filters to target specific customers
                        </Text>
                        <ChoiceList
                          title="Filter by"
                          allowMultiple
                          choices={[
                            { label: "Specific tier only", value: "tier" },
                            { label: "Minimum spend amount", value: "spend" },
                            { label: "Customer tags", value: "tags" },
                            { label: "Geographic location", value: "location" },
                          ]}
                          selected={conditions}
                          onChange={setConditions}
                        />
                        {conditions.includes("tier") && (
                          <Select
                            label="Target tier"
                            options={[
                              { label: "Bronze", value: "bronze" },
                              { label: "Silver", value: "silver" },
                              { label: "Gold", value: "gold" },
                              { label: "Platinum", value: "platinum" },
                            ]}
                            value=""
                            onChange={() => {}}
                          />
                        )}
                      </BlockStack>
                    </Card>
                  </BlockStack>

                  {/* Right Column */}
                  <BlockStack gap="400">
                    {/* Action Card */}
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="400">
                        <InlineStack gap="200" blockAlign="center">
                          <Icon source={EmailIcon} />
                          <Text variant="headingMd" as="h3">
                            Action
                          </Text>
                        </InlineStack>
                        <Select
                          label="What should happen?"
                          options={[
                            { label: "Send email", value: "send_email" },
                            { label: "Add customer tag", value: "add_tag" },
                            { label: "Award bonus points", value: "award_points" },
                            { label: "Send SMS (if enabled)", value: "send_sms" },
                            { label: "Create discount code", value: "discount" },
                          ]}
                          value={action}
                          onChange={setAction}
                        />
                        {action === "send_email" && (
                          <>
                            <Select
                              label="Email template"
                              options={[
                                { label: "Select a template...", value: "" },
                                { label: "Tier Upgrade Congratulations", value: "tier_upgrade" },
                                { label: "Welcome to VIP", value: "welcome_vip" },
                                { label: "Birthday Special Offer", value: "birthday" },
                                { label: "We Miss You", value: "winback" },
                              ]}
                              value={template}
                              onChange={setTemplate}
                            />
                            <Button>Create New Template</Button>
                          </>
                        )}
                      </BlockStack>
                    </Card>

                    {/* Timing Card */}
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="400">
                        <InlineStack gap="200" blockAlign="center">
                          <Icon source={CalendarIcon} />
                          <Text variant="headingMd" as="h3">
                            Timing & Frequency
                          </Text>
                        </InlineStack>
                        <Select
                          label="Send delay"
                          options={[
                            { label: "Immediately", value: "immediate" },
                            { label: "1 hour later", value: "1h" },
                            { label: "24 hours later", value: "24h" },
                            { label: "3 days later", value: "3d" },
                            { label: "1 week later", value: "7d" },
                          ]}
                          value="immediate"
                          onChange={() => {}}
                        />
                        <Checkbox
                          label="Only send during business hours (9 AM - 5 PM)"
                          checked={false}
                          onChange={() => {}}
                        />
                        <Checkbox
                          label="Respect customer's time zone"
                          checked={true}
                          onChange={() => {}}
                        />
                      </BlockStack>
                    </Card>

                    {/* Preview Card */}
                    <Card background="bg-surface-success-subdued">
                      <BlockStack gap="300">
                        <InlineStack gap="200" blockAlign="center">
                          <Icon source={CheckCircleIcon} tone="success" />
                          <Text variant="headingMd" as="h3">
                            Summary
                          </Text>
                        </InlineStack>
                        <Divider />
                        <BlockStack gap="200">
                          <Text variant="bodySm" fontWeight="semibold">
                            When: Customer tier changes
                          </Text>
                          <Text variant="bodySm" fontWeight="semibold">
                            Then: Send email immediately
                          </Text>
                          {conditions.length > 0 && (
                            <Text variant="bodySm" tone="subdued">
                              With {conditions.length} filter(s) applied
                            </Text>
                          )}
                        </BlockStack>
                      </BlockStack>
                    </Card>
                  </BlockStack>
                </InlineGrid>

                {/* Action Buttons */}
                <Divider />
                <InlineStack align="end" gap="300">
                  <Button>Save as Draft</Button>
                  <Button variant="primary">Activate Automation</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* VARIATION 3: Visual Flow Builder */}
        {(selectedVariation === "all" || selectedVariation === "visual") && (
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                {/* Header */}
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="warning">Option 3</Badge>
                      <Text variant="headingLg" as="h2">
                        Visual Flow Builder
                      </Text>
                    </InlineStack>
                    <Text variant="bodyMd" tone="subdued">
                      Drag-and-drop interface with visual workflow representation
                    </Text>
                  </BlockStack>
                  <InlineStack gap="200">
                    <Button>Add Step</Button>
                    <Button variant="primary" icon={PlusIcon}>
                      Add Branch
                    </Button>
                  </InlineStack>
                </InlineStack>

                <Divider />

                {/* Left Sidebar + Canvas */}
                <InlineGrid columns={{ xs: 1, md: "auto 1fr" }} gap="400">
                  {/* Sidebar - Available Actions */}
                  <Box minWidth="200px">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="400">
                        <Text variant="headingSm" fontWeight="semibold">
                          Available Blocks
                        </Text>
                        <Divider />
                        <BlockStack gap="200">
                          <Text variant="bodyMd" fontWeight="medium" tone="subdued">
                            Triggers
                          </Text>
                          <Box
                            padding="300"
                            background="bg-surface"
                            borderRadius="200"
                            style={{ cursor: "grab" }}
                          >
                            <InlineStack gap="200" blockAlign="center">
                              <Icon source={ClockIcon} />
                              <Text variant="bodySm">Tier Change</Text>
                            </InlineStack>
                          </Box>
                          <Box
                            padding="300"
                            background="bg-surface"
                            borderRadius="200"
                            style={{ cursor: "grab" }}
                          >
                            <InlineStack gap="200" blockAlign="center">
                              <Icon source={CalendarIcon} />
                              <Text variant="bodySm">Birthday</Text>
                            </InlineStack>
                          </Box>
                        </BlockStack>

                        <Divider />

                        <BlockStack gap="200">
                          <Text variant="bodyMd" fontWeight="medium" tone="subdued">
                            Actions
                          </Text>
                          <Box
                            padding="300"
                            background="bg-surface"
                            borderRadius="200"
                            style={{ cursor: "grab" }}
                          >
                            <InlineStack gap="200" blockAlign="center">
                              <Icon source={EmailIcon} />
                              <Text variant="bodySm">Send Email</Text>
                            </InlineStack>
                          </Box>
                          <Box
                            padding="300"
                            background="bg-surface"
                            borderRadius="200"
                            style={{ cursor: "grab" }}
                          >
                            <InlineStack gap="200" blockAlign="center">
                              <Icon source={HashtagIcon} />
                              <Text variant="bodySm">Add Tag</Text>
                            </InlineStack>
                          </Box>
                          <Box
                            padding="300"
                            background="bg-surface"
                            borderRadius="200"
                            style={{ cursor: "grab" }}
                          >
                            <InlineStack gap="200" blockAlign="center">
                              <Icon source={ChartVerticalIcon} />
                              <Text variant="bodySm">Award Points</Text>
                            </InlineStack>
                          </Box>
                        </BlockStack>

                        <Divider />

                        <BlockStack gap="200">
                          <Text variant="bodyMd" fontWeight="medium" tone="subdued">
                            Conditions
                          </Text>
                          <Box
                            padding="300"
                            background="bg-surface"
                            borderRadius="200"
                            style={{ cursor: "grab" }}
                          >
                            <InlineStack gap="200" blockAlign="center">
                              <Icon source={PersonIcon} />
                              <Text variant="bodySm">If/Else</Text>
                            </InlineStack>
                          </Box>
                        </BlockStack>
                      </BlockStack>
                    </Card>
                  </Box>

                  {/* Canvas - Visual Flow */}
                  <Card background="bg-surface-secondary">
                    <Box padding="600">
                      <BlockStack gap="400" align="center">
                        {/* Start Node */}
                        <Box
                          padding="400"
                          background="bg-surface-success"
                          borderRadius="300"
                          minWidth="250px"
                        >
                          <InlineStack gap="300" blockAlign="center" align="center">
                            <Icon source={ClockIcon} />
                            <BlockStack gap="100">
                              <Text variant="headingSm" fontWeight="semibold">
                                Start: Tier Change
                              </Text>
                              <Text variant="bodySm" tone="subdued">
                                When customer tier changes
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </Box>

                        {/* Connector Line */}
                        <div style={{
                          width: "2px",
                          height: "40px",
                          background: "var(--p-color-border-brand)",
                        }} />

                        {/* Condition Node */}
                        <Box
                          padding="400"
                          background="bg-surface-warning"
                          borderRadius="300"
                          minWidth="250px"
                        >
                          <InlineStack gap="300" blockAlign="center" align="center">
                            <Icon source={PersonIcon} />
                            <BlockStack gap="100">
                              <Text variant="headingSm" fontWeight="semibold">
                                Check: New Tier = VIP?
                              </Text>
                              <Text variant="bodySm" tone="subdued">
                                Filter by specific tier
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </Box>

                        {/* Split Paths */}
                        <InlineGrid columns={2} gap="600">
                          {/* Yes Path */}
                          <BlockStack gap="200" align="center">
                            <Text variant="bodySm" fontWeight="semibold" tone="success">
                              YES
                            </Text>
                            <div style={{
                              width: "2px",
                              height: "30px",
                              background: "var(--p-color-border-success)",
                            }} />
                            <Box
                              padding="400"
                              background="bg-surface-brand"
                              borderRadius="300"
                              minWidth="200px"
                            >
                              <InlineStack gap="300" blockAlign="center" align="center">
                                <Icon source={EmailIcon} />
                                <BlockStack gap="100">
                                  <Text variant="headingSm" fontWeight="semibold">
                                    Send Email
                                  </Text>
                                  <Text variant="bodySm" tone="subdued">
                                    VIP Welcome Email
                                  </Text>
                                </BlockStack>
                              </InlineStack>
                            </Box>
                            <div style={{
                              width: "2px",
                              height: "30px",
                              background: "var(--p-color-border-success)",
                            }} />
                            <Box
                              padding="400"
                              background="bg-surface-brand"
                              borderRadius="300"
                              minWidth="200px"
                            >
                              <InlineStack gap="300" blockAlign="center" align="center">
                                <Icon source={ChartVerticalIcon} />
                                <BlockStack gap="100">
                                  <Text variant="headingSm" fontWeight="semibold">
                                    Award Points
                                  </Text>
                                  <Text variant="bodySm" tone="subdued">
                                    500 bonus points
                                  </Text>
                                </BlockStack>
                              </InlineStack>
                            </Box>
                          </BlockStack>

                          {/* No Path */}
                          <BlockStack gap="200" align="center">
                            <Text variant="bodySm" fontWeight="semibold" tone="subdued">
                              NO
                            </Text>
                            <div style={{
                              width: "2px",
                              height: "30px",
                              background: "var(--p-color-border)",
                            }} />
                            <Box
                              padding="400"
                              background="bg-surface"
                              borderRadius="300"
                              minWidth="200px"
                            >
                              <InlineStack gap="300" blockAlign="center" align="center">
                                <Icon source={EmailIcon} />
                                <BlockStack gap="100">
                                  <Text variant="headingSm" fontWeight="semibold">
                                    Send Email
                                  </Text>
                                  <Text variant="bodySm" tone="subdued">
                                    Standard tier change
                                  </Text>
                                </BlockStack>
                              </InlineStack>
                            </Box>
                          </BlockStack>
                        </InlineGrid>

                        {/* Add Step Button */}
                        <Button icon={PlusIcon} variant="plain">
                          Add Step
                        </Button>
                      </BlockStack>
                    </Box>
                  </Card>
                </InlineGrid>

                {/* Configuration Panel */}
                <Card background="bg-surface-tertiary">
                  <BlockStack gap="300">
                    <Text variant="headingSm" fontWeight="semibold">
                      Selected: Send Email (VIP Welcome)
                    </Text>
                    <Divider />
                    <InlineGrid columns={3} gap="400">
                      <TextField
                        label="Email template"
                        value="VIP Welcome Email"
                        onChange={() => {}}
                        autoComplete="off"
                      />
                      <Select
                        label="Send delay"
                        options={[
                          { label: "Immediately", value: "immediate" },
                          { label: "1 hour", value: "1h" },
                          { label: "24 hours", value: "24h" },
                        ]}
                        value="immediate"
                        onChange={() => {}}
                      />
                      <TextField
                        label="From name"
                        value="RewardsPro Team"
                        onChange={() => {}}
                        autoComplete="off"
                      />
                    </InlineGrid>
                  </BlockStack>
                </Card>

                {/* Action Buttons */}
                <Divider />
                <InlineStack align="space-between">
                  <Text variant="bodySm" tone="subdued">
                    5 steps configured • 2 branches • Estimated reach: 150 customers/month
                  </Text>
                  <InlineStack gap="300">
                    <Button>Test Automation</Button>
                    <Button>Save as Draft</Button>
                    <Button variant="primary">Activate</Button>
                  </InlineStack>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
