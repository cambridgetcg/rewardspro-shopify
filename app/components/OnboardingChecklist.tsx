import { useState } from "react";
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Icon,
  ProgressBar,
  Box,
  Divider,
  Badge,
} from "@shopify/polaris";
import {
  CheckCircleIcon,
  CircleIcon,
  XIcon,
} from "~/utils/polaris-icons";
import { useNavigate, useSubmit } from "@remix-run/react";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action: () => void;
  actionLabel: string;
}

interface OnboardingChecklistProps {
  onboardingSyncedOrders: boolean;
  onboardingCreatedTiers: boolean;
  onboardingSyncedCustomers: boolean;
  onboardingConfiguredSettings: boolean;
  onboardingCompleted: boolean;
  onboardingDismissed: boolean;
}

export function OnboardingChecklist({
  onboardingSyncedOrders,
  onboardingCreatedTiers,
  onboardingSyncedCustomers,
  onboardingConfiguredSettings,
  onboardingCompleted,
  onboardingDismissed,
}: OnboardingChecklistProps) {
  const navigate = useNavigate();
  const submit = useSubmit();
  const [isExpanded, setIsExpanded] = useState(true);

  // Don't show if dismissed or all completed
  if (onboardingDismissed || onboardingCompleted) {
    return null;
  }

  const handleDismiss = () => {
    submit(
      { action: "dismiss-onboarding" },
      { method: "post", action: "/app" }
    );
  };

  const steps: OnboardingStep[] = [
    {
      id: "sync-orders",
      title: "Sync Orders",
      description: "Import your existing Shopify orders to track customer purchases",
      completed: onboardingSyncedOrders,
      action: () => navigate("/app/orders"),
      actionLabel: "Go to Orders",
    },
    {
      id: "create-tiers",
      title: "Create Tiers",
      description: "Set up loyalty tiers with different cashback percentages",
      completed: onboardingCreatedTiers,
      action: () => navigate("/app/tiers"),
      actionLabel: "Create Tiers",
    },
    {
      id: "sync-customers",
      title: "Sync Customers",
      description: "Import your Shopify customers and assign them to tiers",
      completed: onboardingSyncedCustomers,
      action: () => navigate("/app/customers"),
      actionLabel: "Go to Customers",
    },
    {
      id: "configure-settings",
      title: "Configure Settings",
      description: "Set your store currency and customize your rewards program",
      completed: onboardingConfiguredSettings,
      action: () => navigate("/app/settings"),
      actionLabel: "Go to Settings",
    },
  ];

  const completedSteps = steps.filter((step) => step.completed).length;
  const totalSteps = steps.length;
  const progress = (completedSteps / totalSteps) * 100;

  return (
    <Card>
      <BlockStack gap="400">
        {/* Header */}
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="200">
            <InlineStack gap="200" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Getting Started with RewardsPro
              </Text>
              <Badge tone={completedSteps === totalSteps ? "success" : "info"}>
                {completedSteps} of {totalSteps} complete
              </Badge>
            </InlineStack>
            <Text as="p" variant="bodySm" tone="subdued">
              Complete these steps to start rewarding your customers
            </Text>
          </BlockStack>
          <InlineStack gap="200">
            <Button
              onClick={() => setIsExpanded(!isExpanded)}
              variant="plain"
            >
              {isExpanded ? "Collapse" : "Expand"}
            </Button>
            <Button
              onClick={handleDismiss}
              variant="plain"
              icon={XIcon}
              accessibilityLabel="Dismiss onboarding"
            />
          </InlineStack>
        </InlineStack>

        {/* Progress Bar */}
        <ProgressBar
          progress={progress}
          tone={progress === 100 ? "success" : "primary"}
          size="small"
        />

        {/* Checklist */}
        {isExpanded && (
          <>
            <Divider />
            <BlockStack gap="300">
              {steps.map((step, index) => (
                <Box key={step.id}>
                  <InlineStack align="space-between" blockAlign="start">
                    <InlineStack gap="300" blockAlign="start">
                      <Box paddingBlockStart="050">
                        <Icon
                          source={step.completed ? CheckCircleIcon : CircleIcon}
                          tone={step.completed ? "success" : "base"}
                        />
                      </Box>
                      <BlockStack gap="100">
                        <Text
                          as="h3"
                          variant="bodyMd"
                          fontWeight="semibold"
                          tone={step.completed ? "subdued" : undefined}
                        >
                          {step.title}
                        </Text>
                        <Text
                          as="p"
                          variant="bodySm"
                          tone="subdued"
                        >
                          {step.description}
                        </Text>
                      </BlockStack>
                    </InlineStack>
                    {!step.completed && (
                      <Button
                        onClick={step.action}
                        size="slim"
                      >
                        {step.actionLabel}
                      </Button>
                    )}
                  </InlineStack>
                  {index < steps.length - 1 && <Box paddingBlockStart="300" />}
                </Box>
              ))}
            </BlockStack>
          </>
        )}
      </BlockStack>
    </Card>
  );
}
