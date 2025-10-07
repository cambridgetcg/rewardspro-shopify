/**
 * Store Credit Card Component
 * Displays store credit balance, tier status and membership information
 * Following Shopify Polaris design guidelines and customer account UX best practices
 */

import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Divider,
  Progress,
} from '@shopify/ui-extensions-react/customer-account';
import { formatCurrency } from '../../utils/formatCurrency';
import type { LoyaltyData } from '../../types/loyalty';

interface BalanceCardProps {
  data: LoyaltyData;
}

export function BalanceCard({ data }: BalanceCardProps) {
  const {
    balance = 0,
    tier,
    nextTier,
    progressToNextTier = 0,
    totalEarned = 0,
    currency = 'USD'
  } = data;

  // Determine tier badge tone based on tier name (following Polaris color patterns)
  const getTierTone = (tierName: string): 'success' | 'info' | 'warning' | 'critical' => {
    const name = tierName.toLowerCase();
    if (name.includes('platinum') || name.includes('diamond')) return 'success';
    if (name.includes('gold')) return 'warning';
    if (name.includes('silver')) return 'info';
    return 'info';
  };

  return (
    <Card padding>
      <BlockStack spacing="base">
        {/* Card Title - Semantic heading for accessibility */}
        <Text variant="headingMd" as="h2">
          Your rewards
        </Text>

        {/* Store Credit Section */}
        <BlockStack spacing="tight">
          <Text variant="headingSm" as="h3">
            Store credit
          </Text>
          <Text variant="heading2xl" as="p">
            {formatCurrency(balance, currency)}
          </Text>
          <Text appearance="subdued" size="small">
            Available to use
          </Text>
        </BlockStack>

        <Divider />

        {/* Membership Tier Section */}
        {tier && (
          <BlockStack spacing="base">
            <InlineStack spacing="tight" blockAlignment="center">
              <Text variant="headingSm" as="h3">
                Membership tier
              </Text>
              <Badge tone={getTierTone(tier.name)}>
                {tier.name}
              </Badge>
            </InlineStack>

            {/* Tier Benefits */}
            <Text>
              Earning {tier.cashbackPercent}% cashback on all purchases
            </Text>

            {/* Tier Progress Indicator */}
            {nextTier && progressToNextTier < 100 && (
              <BlockStack spacing="tight">
                <Text appearance="subdued" size="small">
                  {Math.floor(progressToNextTier)}% to {nextTier.name}
                </Text>
                <Progress
                  value={progressToNextTier}
                  max={100}
                  accessibilityLabel={`${Math.floor(progressToNextTier)}% progress to ${nextTier.name} tier`}
                />
              </BlockStack>
            )}
          </BlockStack>
        )}

        <Divider />

        {/* Lifetime Earned Summary */}
        {totalEarned > 0 && (
          <BlockStack spacing="tight">
            <Text appearance="subdued" size="small">
              Total earned
            </Text>
            <Text variant="headingSm">
              {formatCurrency(totalEarned, currency)}
            </Text>
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}
