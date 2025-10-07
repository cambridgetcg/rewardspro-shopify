/**
 * Tier Progress Component
 * Shows current tier, progress to next tier, and spending stats
 */

import {
  Card,
  BlockStack,
  Text,
  InlineStack,
  View,
} from '@shopify/ui-extensions-react/customer-account';
import { formatCurrency } from '../../utils/formatCurrency';
import type { LoyaltyData } from '../../types/loyalty';

interface TierProgressProps {
  data: LoyaltyData;
}

export function TierProgress({ data }: TierProgressProps) {
  const { tier, nextTier, progressToNextTier = 0, amountToNextTier = 0, stats, currency = 'USD' } = data;

  // If no tier, don't render
  if (!tier) {
    return null;
  }

  const isMaxTier = !nextTier;
  const progress = Math.round(progressToNextTier);

  return (
    <Card padding>
      <BlockStack spacing="base">
        {/* Current Tier Header */}
        <InlineStack spacing="base" blockAlignment="center">
          <View>
            <Text variant="headingMd" as="h2">
              {tier.name} Member
            </Text>
            <Text appearance="subdued" size="small">
              {tier.cashbackPercent}% cashback on all orders
            </Text>
          </View>
        </InlineStack>

        {/* Progress to Next Tier */}
        {!isMaxTier && nextTier && (
          <BlockStack spacing="tight">
            <InlineStack spacing="base" blockAlignment="center">
              <Text size="small" appearance="subdued">
                Progress to {nextTier.name}
              </Text>
              <Text size="small" appearance="subdued">
                {progress}%
              </Text>
            </InlineStack>

            {/* Custom Progress Bar */}
            <View
              border="base"
              borderRadius="base"
              padding="none"
            >
              <View
                backgroundColor="base"
                borderRadius="base"
                padding="extraTight"
              >
                <View
                  backgroundColor="interactive"
                  borderRadius="base"
                  padding="none"
                  minInlineSize={`${progress}%`}
                  inlineSize={`${progress}%`}
                >
                  <Text size="small" appearance="subdued"> </Text>
                </View>
              </View>
            </View>

            <Text size="small" appearance="subdued">
              Spend {formatCurrency(amountToNextTier, currency)} more to unlock {nextTier.cashbackPercent}% cashback
            </Text>
          </BlockStack>
        )}

        {/* Max Tier Reached */}
        {isMaxTier && (
          <Text appearance="success" size="small">
            🎉 You've reached the highest tier!
          </Text>
        )}

        {/* Spending Stats */}
        {stats && (
          <BlockStack spacing="tight">
            <View
              border="base"
              padding="base"
              borderRadius="base"
            >
              <InlineStack spacing="base">
                <BlockStack spacing="extraTight">
                  <Text size="small" appearance="subdued">
                    Total Orders
                  </Text>
                  <Text variant="bodyLg">
                    {stats.orderCount}
                  </Text>
                </BlockStack>

                <View
                  borderInlineStart="base"
                  paddingInlineStart="base"
                >
                  <BlockStack spacing="extraTight">
                    <Text size="small" appearance="subdued">
                      Total Spent
                    </Text>
                    <Text variant="bodyLg">
                      {formatCurrency(stats.totalSpent, currency)}
                    </Text>
                  </BlockStack>
                </View>

                <View
                  borderInlineStart="base"
                  paddingInlineStart="base"
                >
                  <BlockStack spacing="extraTight">
                    <Text size="small" appearance="subdued">
                      Avg. Cashback
                    </Text>
                    <Text variant="bodyLg">
                      {formatCurrency(stats.averageCashbackPerOrder, currency)}
                    </Text>
                  </BlockStack>
                </View>
              </InlineStack>
            </View>
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}
